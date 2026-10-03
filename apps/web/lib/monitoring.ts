import { createHash } from "node:crypto";
import { getProcurementSources } from "@/lib/gov-contracts";
import { recordRuntimeSearchRun } from "@/lib/search-observability";
import { searchConnectedSources } from "@/lib/source-adapters";
import {
  archiveMonitorSearch,
  completeMonitorRun,
  createMonitorFindings,
  createMonitorRun,
  deleteKeywordSubscription,
  failStaleMonitorRuns,
  listKeywordSubscriptions,
  listMonitorSearches,
  listSeenOpportunities,
  moveKeywordSubscription,
  recordSourceHealth,
  recordSearchRun,
  updateKeywordSubscription,
  updateSearchAfterMonitor,
  upsertMonitorSearch,
  upsertSeenOpportunities,
  type KeywordSubscriptionRecord,
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

const DEFAULT_MONITOR_SEARCH_TIMEOUT_MS = 45_000;
const DEFAULT_MONITOR_RUN_BUDGET_MS = 54_000;
const STALE_RUNNING_RUN_MS = 70 * 60 * 1000;
const MINIMUM_RUN_HEADROOM_MS = 12_000;

export async function ensureDefaultMonitorSearches() {
  const existing = await listMonitorSearches();
  if (!existing.ok || existing.data.length > 0) {
    return existing;
  }

  await upsertMonitorSearch({ query: "leadership training", state: "All", level: "All", frequency: "daily", enabled: true });
  await upsertMonitorSearch({ query: "management training", state: "TX", level: "All", frequency: "daily", enabled: true });
  return listMonitorSearches();
}

export async function cleanupDuplicateMonitorSearches() {
  const [searchesResult, subscriptionsResult] = await Promise.all([listMonitorSearches(), listKeywordSubscriptions()]);
  if (!searchesResult.ok || !subscriptionsResult.ok) {
    return {
      ok: false as const,
      configured: searchesResult.configured && subscriptionsResult.configured,
      duplicateGroups: 0,
      archivedSearches: 0,
      movedSubscriptions: 0,
      deletedSubscriptions: 0,
      errors: [searchesResult.ok ? undefined : searchesResult.error, subscriptionsResult.ok ? undefined : subscriptionsResult.error].filter(Boolean) as string[],
      message: "Duplicate monitor cleanup could not load monitor data.",
    };
  }

  const groups = new Map<string, SavedSearchRecord[]>();
  for (const search of searchesResult.data) {
    const key = monitorSearchKey(search);
    groups.set(key, [...(groups.get(key) ?? []), search]);
  }

  const subscriptions = [...subscriptionsResult.data];
  let duplicateGroups = 0;
  let archivedSearches = 0;
  let movedSubscriptions = 0;
  let deletedSubscriptions = 0;
  const errors: string[] = [];
  const archivedSearchIds = new Set<string>();

  async function mergeAndArchiveDuplicate(canonical: SavedSearchRecord, duplicate: SavedSearchRecord) {
    const duplicateSubscriptions = subscriptions.filter((subscription) => subscription.saved_search_id === duplicate.id);
    for (const subscription of duplicateSubscriptions) {
      const canonicalSubscription = subscriptions.find(
        (candidate) => candidate.id !== subscription.id && candidate.subscriber_id === subscription.subscriber_id && candidate.saved_search_id === canonical.id,
      );

      if (canonicalSubscription) {
        const mergeResult = await updateKeywordSubscription({
          id: canonicalSubscription.id,
          frequency: moreFrequentNotification(canonicalSubscription.frequency, subscription.frequency),
          isActive: canonicalSubscription.is_active || subscription.is_active,
          lastNotifiedAt: latestIso(canonicalSubscription.last_notified_at, subscription.last_notified_at),
        });
        if (!mergeResult.ok) {
          errors.push(mergeResult.error);
          continue;
        }

        const deleteResult = await deleteKeywordSubscription(subscription.id);
        if (!deleteResult.ok) {
          errors.push(deleteResult.error);
          continue;
        }

        deletedSubscriptions += 1;
        const index = subscriptions.findIndex((item) => item.id === subscription.id);
        if (index >= 0) {
          subscriptions.splice(index, 1);
        }
        Object.assign(canonicalSubscription, {
          frequency: moreFrequentNotification(canonicalSubscription.frequency, subscription.frequency),
          is_active: canonicalSubscription.is_active || subscription.is_active,
          last_notified_at: latestIso(canonicalSubscription.last_notified_at, subscription.last_notified_at),
        });
      } else {
        const moveResult = await moveKeywordSubscription({ id: subscription.id, savedSearchId: canonical.id });
        if (!moveResult.ok) {
          errors.push(moveResult.error);
          continue;
        }

        movedSubscriptions += 1;
        subscription.saved_search_id = canonical.id;
      }
    }

    const archiveResult = await archiveMonitorSearch(duplicate.id);
    if (archiveResult.ok) {
      archivedSearches += 1;
      archivedSearchIds.add(duplicate.id);
    } else {
      errors.push(archiveResult.error);
    }
  }

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    duplicateGroups += 1;
    const [canonical, ...duplicates] = [...group].sort(compareCanonicalMonitorSearch);
    for (const duplicate of duplicates) {
      await mergeAndArchiveDuplicate(canonical, duplicate);
    }
  }

  const broadGroups = new Map<string, SavedSearchRecord[]>();
  for (const search of searchesResult.data) {
    if (archivedSearchIds.has(search.id)) {
      continue;
    }

    const key = search.query.trim().toLowerCase().replace(/\s+/g, " ");
    broadGroups.set(key, [...(broadGroups.get(key) ?? []), search]);
  }

  for (const group of broadGroups.values()) {
    const canonical = group.filter((search) => search.state_filter === "All" && search.level_filter === "All").sort(compareCanonicalMonitorSearch)[0];
    if (!canonical) {
      continue;
    }

    const duplicates = group.filter((search) => search.id !== canonical.id);
    if (duplicates.length === 0) {
      continue;
    }

    duplicateGroups += 1;
    for (const duplicate of duplicates) {
      await mergeAndArchiveDuplicate(canonical, duplicate);
    }
  }

  return {
    ok: errors.length === 0,
    configured: true,
    duplicateGroups,
    archivedSearches,
    movedSubscriptions,
    deletedSubscriptions,
    errors,
    message:
      duplicateGroups === 0
        ? "No duplicate monitor searches found."
        : `Cleaned ${duplicateGroups} duplicate group${duplicateGroups === 1 ? "" : "s"}, archived ${archivedSearches} duplicate monitor${archivedSearches === 1 ? "" : "s"}, moved ${movedSubscriptions} alert${movedSubscriptions === 1 ? "" : "s"}, and removed ${deletedSubscriptions} duplicate alert${deletedSubscriptions === 1 ? "" : "s"}.`,
  };
}

export async function runMonitorSearch(
  search: SavedSearchRecord,
  triggerType: "manual" | "cron",
  options: { searchTimeoutMs?: number } = {},
): Promise<MonitorRunSummary> {
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
      timeoutMs: options.searchTimeoutMs,
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
    const monitorResults = dedupeMonitorResults(searchResult.results);
    const seenUpserts = monitorResults.map((result) => {
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
    const sourceStatuses = slimSourceStatuses(searchResult.sourceStatuses);
    recordRuntimeSearchRun({
      query: search.query,
      state: search.state_filter,
      level: search.level_filter,
      cacheStatus: "fresh",
      triggerType: "monitor",
      resultsCount: searchResult.results.length,
      searchedSourcesCount: searchResult.searchedSources.length,
      pendingSourcesCount: searchResult.pendingSources.length,
      errorCount: searchResult.errors.length,
      elapsedMs,
      samCalls: searchResult.usage.sam.calls,
      samRateLimited: searchResult.usage.sam.rateLimited,
      samRateLimit: searchResult.usage.sam.rateLimit,
      sourceStatuses,
      errors: searchResult.errors,
    });
    await recordSearchRun({
      query: search.query,
      state: search.state_filter,
      level: search.level_filter,
      triggerType: "monitor",
      cacheStatus: "fresh",
      resultsCount: searchResult.results.length,
      searchedSourcesCount: searchResult.searchedSources.length,
      pendingSourcesCount: searchResult.pendingSources.length,
      errorCount: searchResult.errors.length,
      elapsedMs,
      errors: searchResult.errors,
      sourceStatuses,
      samCalls: searchResult.usage.sam.calls,
      samRateLimited: searchResult.usage.sam.rateLimited,
      samRateLimit: searchResult.usage.sam.rateLimit,
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
    const failedRunResult = await completeMonitorRun({
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
      run: failedRunResult.ok ? failedRunResult.data[0] ?? run : run,
      message,
    };
  }
}

export async function cleanupStaleMonitorRuns(staleAfterMs = STALE_RUNNING_RUN_MS) {
  const cutoffIso = new Date(Date.now() - staleAfterMs).toISOString();
  return failStaleMonitorRuns({
    cutoffIso,
    message: `Marked failed because the monitor did not complete within ${Math.round(staleAfterMs / 60_000)} minutes.`,
  });
}

export async function runDueMonitorSearches({
  triggerType = "cron",
  maxRuns = 1,
  timeBudgetMs = DEFAULT_MONITOR_RUN_BUDGET_MS,
  perSearchTimeoutMs = DEFAULT_MONITOR_SEARCH_TIMEOUT_MS,
}: {
  triggerType?: "manual" | "cron";
  maxRuns?: number;
  timeBudgetMs?: number;
  perSearchTimeoutMs?: number;
} = {}) {
  const startedAt = Date.now();
  const [cleanupResult, searches, subscriptions] = await Promise.all([cleanupStaleMonitorRuns(), ensureDefaultMonitorSearches(), listKeywordSubscriptions()]);
  if (!searches.ok) {
    return {
      ok: false,
      configured: searches.configured,
      runs: [] as MonitorRunSummary[],
      cleanup: cleanupSummary(cleanupResult),
      message: searches.error,
    };
  }

  const subscribedSearchIds = new Set(
    subscriptions.ok
      ? subscriptions.data.filter((subscription) => subscription.is_active).map((subscription) => subscription.saved_search_id)
      : [],
  );
  const due = searches.data
    .filter(isSearchDue)
    .sort((a, b) => compareDueSearchPriority(a, b, subscribedSearchIds))
    .slice(0, Math.max(1, maxRuns));
  const runs: MonitorRunSummary[] = [];
  for (const search of due) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = timeBudgetMs - elapsedMs;
    if (remainingMs < MINIMUM_RUN_HEADROOM_MS) {
      break;
    }

    const searchTimeoutMs = Math.max(5_000, Math.min(perSearchTimeoutMs, remainingMs - 5_000));
    runs.push(await runMonitorSearch(search, triggerType, { searchTimeoutMs }));
  }

  return {
    ok: runs.every((run) => run.ok),
    configured: true,
    runs,
    cleanup: cleanupSummary(cleanupResult),
    message:
      due.length > 0
        ? `Ran ${runs.length} of ${due.length} due monitor search${due.length === 1 ? "" : "es"} within the time budget.`
        : "No monitor searches are due.",
  };
}

function cleanupSummary(result: Awaited<ReturnType<typeof failStaleMonitorRuns>>) {
  if (!result.ok) {
    return {
      ok: false,
      configured: result.configured,
      failedRunsMarked: 0,
      error: result.error,
    };
  }

  return {
    ok: true,
    configured: true,
    failedRunsMarked: result.data.length,
  };
}

function dedupeMonitorResults(results: UnifiedSearchResult[]) {
  const deduped = new Map<string, UnifiedSearchResult>();
  for (const result of results) {
    if (!deduped.has(result.id)) {
      deduped.set(result.id, result);
    }
  }

  return [...deduped.values()];
}

function compareDueSearchPriority(a: SavedSearchRecord, b: SavedSearchRecord, subscribedSearchIds: Set<string>) {
  const subscriptionPriority = Number(subscribedSearchIds.has(b.id)) - Number(subscribedSearchIds.has(a.id));
  if (subscriptionPriority !== 0) {
    return subscriptionPriority;
  }

  const neverCheckedPriority = Number(!b.last_checked_at) - Number(!a.last_checked_at);
  if (neverCheckedPriority !== 0) {
    return neverCheckedPriority;
  }

  const lastCheckedPriority = parseDateValue(a.last_checked_at) - parseDateValue(b.last_checked_at);
  if (lastCheckedPriority !== 0) {
    return lastCheckedPriority;
  }

  return parseDateValue(a.created_at) - parseDateValue(b.created_at);
}

function monitorSearchKey(search: SavedSearchRecord) {
  return [search.query.trim().toLowerCase().replace(/\s+/g, " "), search.state_filter, search.level_filter].join("::");
}

function compareCanonicalMonitorSearch(a: SavedSearchRecord, b: SavedSearchRecord) {
  const enabledPriority = Number(b.monitor_enabled) - Number(a.monitor_enabled);
  if (enabledPriority !== 0) {
    return enabledPriority;
  }

  const checkedPriority = parseDateValue(b.last_checked_at) - parseDateValue(a.last_checked_at);
  if (checkedPriority !== 0) {
    return checkedPriority;
  }

  return parseDateValue(a.created_at) - parseDateValue(b.created_at);
}

function moreFrequentNotification(
  a: KeywordSubscriptionRecord["frequency"],
  b: KeywordSubscriptionRecord["frequency"],
): KeywordSubscriptionRecord["frequency"] {
  const rank: Record<KeywordSubscriptionRecord["frequency"], number> = {
    instant: 0,
    daily: 1,
    weekly: 2,
  };

  return rank[a] <= rank[b] ? a : b;
}

function latestIso(a: string | null, b: string | null) {
  if (!a) {
    return b;
  }

  if (!b) {
    return a;
  }

  return Date.parse(a) >= Date.parse(b) ? a : b;
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

function parseDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
