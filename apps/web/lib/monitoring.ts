import { createHash } from "node:crypto";
import { getProcurementSources } from "@/lib/gov-contracts";
import { searchConnectedSources } from "@/lib/source-adapters";
import {
  completeMonitorRun,
  createMonitorFindings,
  createMonitorRun,
  listMonitorSearches,
  listSeenOpportunities,
  recordSourceHealth,
  updateSearchAfterMonitor,
  upsertMonitorSearch,
  upsertSeenOpportunities,
  type MonitorFindingRecord,
  type MonitorRunRecord,
  type SavedSearchRecord,
} from "@/lib/supabase-admin";
import type { SourceSearchStatus, UnifiedSearchResult } from "@/lib/gov-types";

export type MonitorRunSummary = {
  ok: boolean;
  configured: boolean;
  search?: SavedSearchRecord;
  run?: MonitorRunRecord;
  findings?: MonitorFindingRecord[];
  message: string;
};

export async function ensureDefaultMonitorSearches() {
  const existing = await listMonitorSearches();
  if (!existing.ok || existing.data.length > 0) {
    return existing;
  }

  await upsertMonitorSearch({ query: "leadership training", state: "All", level: "All", frequency: "daily", enabled: true });
  await upsertMonitorSearch({ query: "management training", state: "TX", level: "All", frequency: "daily", enabled: true });
  return listMonitorSearches();
}

export async function runMonitorSearch(search: SavedSearchRecord, triggerType: "manual" | "cron"): Promise<MonitorRunSummary> {
  const startedAt = Date.now();
  const runResult = await createMonitorRun({
    savedSearchId: search.id,
    query: search.query,
    state: search.state_filter,
    level: search.level_filter,
    triggerType,
  });

  if (!runResult.ok) {
    return {
      ok: false,
      configured: runResult.configured,
      search,
      message: runResult.error,
    };
  }

  const run = runResult.data[0];
  if (!run) {
    return {
      ok: false,
      configured: true,
      search,
      message: "Monitor run could not be created.",
    };
  }

  try {
    const sources = await getProcurementSources();
    const searchResult = await searchConnectedSources({
      query: search.query,
      state: search.state_filter,
      level: search.level_filter,
      sources,
    });
    const sourcesByName = new Map(sources.map((source) => [source.source_name, source]));

    await recordSourceHealth(
      searchResult.sourceStatuses.map((status) => {
        const source = sourcesByName.get(status.sourceName);
        return {
          sourceName: status.sourceName,
          sourceState: source?.state,
          sourceLevel: source?.level,
          healthStatus: status.status,
          message: status.message,
        };
      }),
    );

    const seenResult = await listSeenOpportunities(search.id);
    if (!seenResult.ok) {
      throw new Error(seenResult.error);
    }

    const seenByResultId = new Map(seenResult.data.map((item) => [item.source_result_id, item]));
    const seenUpserts = searchResult.results.map((result) => {
      const existing = seenByResultId.get(result.id);
      const contentHash = monitorContentHash(result);
      const changed = Boolean(existing && (existing.content_hash !== contentHash || existing.deadline !== (result.deadline ?? null) || existing.opportunity_url !== result.url));
      return {
        savedSearchId: search.id,
        runId: run.id,
        result,
        contentHash,
        existing,
        changed,
      };
    });

    const upsertResult = await upsertSeenOpportunities(seenUpserts);
    if (!upsertResult.ok) {
      throw new Error(upsertResult.error);
    }

    const findingsToCreate = seenUpserts
      .filter((item) => !item.existing || item.changed)
      .map((item) => ({
        runId: run.id,
        savedSearchId: search.id,
        seenOpportunityId: item.existing?.id ?? null,
        sourceResultId: item.result.id,
        findingType: item.existing ? ("changed" as const) : ("new" as const),
        title: item.result.title,
        sourceName: item.result.sourceName,
        sourceLevel: item.result.sourceLevel,
        sourceState: item.result.sourceState,
        buyer: item.result.buyer,
        solicitationId: item.result.solicitationId ?? null,
        oldDeadline: item.existing?.deadline ?? null,
        newDeadline: item.result.deadline ?? null,
        opportunityUrl: item.result.url,
        documentLinks: item.result.documentLinks ?? [],
        rawResult: item.result as unknown as Record<string, unknown>,
      }));

    const findingsResult = await createMonitorFindings(findingsToCreate);
    if (!findingsResult.ok) {
      throw new Error(findingsResult.error);
    }

    const newCount = findingsToCreate.filter((finding) => finding.findingType === "new").length;
    const changedCount = findingsToCreate.filter((finding) => finding.findingType === "changed").length;
    const elapsedMs = Date.now() - startedAt;
    await updateSearchAfterMonitor({
      id: search.id,
      resultsCount: searchResult.results.length,
      searchedSourcesCount: searchResult.searchedSources.length,
      pendingSourcesCount: searchResult.pendingSources.length,
      errorCount: searchResult.errors.length,
      newResultsCount: newCount,
      changedResultsCount: changedCount,
    });

    const completedRunResult = await completeMonitorRun({
      runId: run.id,
      status: "completed",
      resultsCount: searchResult.results.length,
      searchedSourcesCount: searchResult.searchedSources.length,
      pendingSourcesCount: searchResult.pendingSources.length,
      errorCount: searchResult.errors.length,
      newResultsCount: newCount,
      changedResultsCount: changedCount,
      elapsedMs,
      message: `Found ${newCount} new and ${changedCount} changed opportunities.`,
      errors: searchResult.errors,
      sourceStatuses: slimSourceStatuses(searchResult.sourceStatuses),
    });

    return {
      ok: true,
      configured: true,
      search,
      run: completedRunResult.ok ? completedRunResult.data[0] : run,
      findings: findingsResult.data,
      message: `Monitor completed for "${search.query}".`,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Monitor run failed.";
    await completeMonitorRun({
      runId: run.id,
      status: "failed",
      resultsCount: 0,
      searchedSourcesCount: 0,
      pendingSourcesCount: 0,
      errorCount: 1,
      newResultsCount: 0,
      changedResultsCount: 0,
      elapsedMs,
      message,
      errors: [message],
      sourceStatuses: [],
    });

    return {
      ok: false,
      configured: true,
      search,
      run,
      message,
    };
  }
}

export async function runDueMonitorSearches({ triggerType = "cron", maxRuns = 1 }: { triggerType?: "manual" | "cron"; maxRuns?: number } = {}) {
  const searches = await ensureDefaultMonitorSearches();
  if (!searches.ok) {
    return {
      ok: false,
      configured: searches.configured,
      runs: [] as MonitorRunSummary[],
      message: searches.error,
    };
  }

  const due = searches.data.filter(isSearchDue).slice(0, Math.max(1, maxRuns));
  const runs: MonitorRunSummary[] = [];
  for (const search of due) {
    runs.push(await runMonitorSearch(search, triggerType));
  }

  return {
    ok: runs.every((run) => run.ok),
    configured: true,
    runs,
    message: due.length > 0 ? `Ran ${runs.length} monitor search${runs.length === 1 ? "" : "es"}.` : "No monitor searches are due.",
  };
}

function isSearchDue(search: SavedSearchRecord) {
  if (!search.monitor_enabled || search.monitor_frequency === "manual") {
    return false;
  }

  const now = new Date();
  if (search.monitor_frequency === "weekdays" && [0, 6].includes(now.getUTCDay())) {
    return false;
  }

  if (!search.last_checked_at) {
    return true;
  }

  const lastChecked = new Date(search.last_checked_at);
  if (Number.isNaN(lastChecked.getTime())) {
    return true;
  }

  return now.getTime() - lastChecked.getTime() > 20 * 60 * 60 * 1000;
}

function monitorContentHash(result: UnifiedSearchResult) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: result.title,
        deadline: result.deadline ?? null,
        status: result.status,
        url: result.url,
        solicitationId: result.solicitationId ?? null,
        documentLinks: result.documentLinks ?? [],
      }),
    )
    .digest("hex");
}

function slimSourceStatuses(statuses: SourceSearchStatus[]) {
  return statuses.map((status) => ({
    sourceName: status.sourceName,
    status: status.status,
    message: status.message,
    resultCount: status.resultCount,
  }));
}
