import { NextResponse } from "next/server";
import { getProcurementSources } from "@/lib/gov-contracts";
import { recordRuntimeSearchRun } from "@/lib/search-observability";
import { recordSearchRun, recordSourceHealth } from "@/lib/supabase-admin";
import { searchConnectedSources } from "@/lib/source-adapters";
import type { SourceSearchStatus, UnifiedSearchResponse } from "@/lib/gov-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEARCH_RESPONSE_SUCCESS_CACHE_MS = 5 * 60 * 1000;
const SEARCH_RESPONSE_ERROR_CACHE_MS = 60 * 1000;
const searchResponseCache = getGlobalMap<{ savedAt: number; expiresAt: number; body: UnifiedSearchResponse }>("__govContractFinderSearchResponseCache");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = sanitizeSearchParam(searchParams.get("q"));
  const state = searchParams.get("state") ?? "All";
  const level = searchParams.get("level") ?? "All";
  const forceRefresh = searchParams.get("cache") === "refresh";
  const startedAt = Date.now();

  if (query.length < 3) {
    return jsonNoStore({
      query,
      configured: Boolean(process.env.SAM_API_KEY),
      cached: false,
      elapsedMs: 0,
      completedAt: new Date().toISOString(),
      results: [],
      counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
      searchedSources: [],
      pendingSources: [],
      sourceStatuses: [],
      errors: [],
      message: "Enter a concept with at least 3 characters.",
    } satisfies UnifiedSearchResponse);
  }

  try {
    const cacheKey = searchCacheKey({ query, state, level });
    const cached = searchResponseCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      const cachedUsage = cached.body.usage?.sam
        ? {
            ...cached.body.usage,
            sam: {
              ...cached.body.usage.sam,
              calls: 0,
            },
          }
        : cached.body.usage;
      const cachedBody = {
        ...cached.body,
        cached: true,
        cacheAgeMs: Date.now() - cached.savedAt,
        elapsedMs: Date.now() - startedAt,
        usage: cachedUsage,
      } satisfies UnifiedSearchResponse;
      await withPersistenceBudget(
        persistSearchRun({
          body: cachedBody,
          state,
          level,
          cacheStatus: "cache_hit",
          triggerType: "interactive",
        }),
      );
      return jsonNoStore(cachedBody);
    }

    const sources = await getProcurementSources();
    const connectedSearch = await searchConnectedSources({ query, state, level, sources });
    const sourcesByName = new Map(sources.map((source) => [source.source_name, source]));

    const body = {
      query,
      configured: connectedSearch.samConfigured,
      cached: false,
      elapsedMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
      results: connectedSearch.results,
      counts: {
        opportunities: connectedSearch.results.length,
        connected: connectedSearch.searchedSources.length,
        pending: connectedSearch.pendingSources.length,
        total: connectedSearch.results.length,
      },
      searchedSources: connectedSearch.searchedSources,
      pendingSources: connectedSearch.pendingSources,
      sourceStatuses: connectedSearch.sourceStatuses,
      errors: connectedSearch.errors,
      usage: connectedSearch.usage,
      message:
        connectedSearch.results.length > 0
          ? "Search complete across connected sources."
          : "No matching opportunities found in connected sources. Broaden the search term or connect more procurement sources.",
    } satisfies UnifiedSearchResponse;

    searchResponseCache.set(cacheKey, {
      savedAt: Date.now(),
      expiresAt: Date.now() + (body.errors.length > 0 ? SEARCH_RESPONSE_ERROR_CACHE_MS : SEARCH_RESPONSE_SUCCESS_CACHE_MS),
      body,
    });

    await withPersistenceBudget(
      Promise.all([
        recordSourceHealth(
          connectedSearch.sourceStatuses.map((status) => {
            const source = sourcesByName.get(status.sourceName);
            return {
              sourceName: status.sourceName,
              sourceState: source?.state,
              sourceLevel: source?.level,
              healthStatus: status.status,
              message: status.message,
            };
          }),
        ),
        persistSearchRun({
          body,
          state,
          level,
          cacheStatus: "fresh",
          triggerType: "interactive",
        }),
      ]),
    );

    return jsonNoStore(body);
  } catch (error) {
    const body = {
        query,
        configured: Boolean(process.env.SAM_API_KEY),
        cached: false,
        elapsedMs: Date.now() - startedAt,
        completedAt: new Date().toISOString(),
        results: [],
        counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
        searchedSources: [],
        pendingSources: [],
        sourceStatuses: [],
        errors: [error instanceof Error ? error.message : "Search failed."],
        message: "Search failed before connector results could be returned.",
      } satisfies UnifiedSearchResponse;
    void persistSearchRun({
      body,
      state,
      level,
      cacheStatus: "failed",
      triggerType: "interactive",
    });
    return jsonNoStore(
      body,
      { status: 500 },
    );
  }
}

function sanitizeSearchParam(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function searchCacheKey({ query, state, level }: { query: string; state: string; level: string }) {
  return [query.toLowerCase(), state, level].join("|");
}

function getGlobalMap<T>(key: string): Map<string, T> {
  const globalStore = globalThis as typeof globalThis & Record<string, Map<string, T> | undefined>;
  globalStore[key] ??= new Map<string, T>();
  return globalStore[key];
}

async function withPersistenceBudget(task: Promise<unknown>) {
  await Promise.race([
    task.catch(() => undefined),
    new Promise((resolve) => {
      setTimeout(resolve, 1500);
    }),
  ]);
}

async function persistSearchRun({
  body,
  state,
  level,
  cacheStatus,
  triggerType,
}: {
  body: UnifiedSearchResponse;
  state: string;
  level: string;
  cacheStatus: "fresh" | "cache_hit" | "failed";
  triggerType: "interactive" | "monitor";
}) {
  const sourceStatuses = slimSourceStatuses(body.sourceStatuses ?? []);
  const samUsage = body.usage?.sam;
  recordRuntimeSearchRun({
    query: body.query,
    state,
    level,
    cacheStatus,
    triggerType,
    resultsCount: body.results.length,
    searchedSourcesCount: body.searchedSources.length,
    pendingSourcesCount: body.pendingSources.length,
    errorCount: body.errors.length,
    elapsedMs: body.elapsedMs ?? 0,
    samCalls: samUsage?.calls ?? 0,
    samRateLimited: samUsage?.rateLimited ?? false,
    samRateLimit: samUsage?.rateLimit,
    sourceStatuses,
    errors: body.errors,
    completedAt: body.completedAt,
  });

  await recordSearchRun({
    query: body.query,
    state,
    level,
    triggerType,
    cacheStatus,
    resultsCount: body.results.length,
    searchedSourcesCount: body.searchedSources.length,
    pendingSourcesCount: body.pendingSources.length,
    errorCount: body.errors.length,
    elapsedMs: body.elapsedMs ?? 0,
    errors: body.errors,
    sourceStatuses,
    samCalls: samUsage?.calls ?? 0,
    samRateLimited: samUsage?.rateLimited ?? false,
    samRateLimit: samUsage?.rateLimit,
  });
}

function slimSourceStatuses(sourceStatuses: SourceSearchStatus[]) {
  return sourceStatuses.slice(0, 200).map((status) => ({
    sourceName: status.sourceName,
    status: status.status,
    message: status.message,
    resultCount: status.resultCount,
    ...(typeof status.durationMs === "number" ? { durationMs: status.durationMs } : {}),
  }));
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
