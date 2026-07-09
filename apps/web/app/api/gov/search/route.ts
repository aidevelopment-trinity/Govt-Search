import { NextResponse } from "next/server";
import { getProcurementSources } from "@/lib/gov-contracts";
import { recordSourceHealth } from "@/lib/supabase-admin";
import { searchConnectedSources } from "@/lib/source-adapters";
import type { UnifiedSearchResponse } from "@/lib/gov-types";

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
      return jsonNoStore({
        ...cached.body,
        cached: true,
        cacheAgeMs: Date.now() - cached.savedAt,
        elapsedMs: Date.now() - startedAt,
      });
    }

    const sources = await getProcurementSources();
    const connectedSearch = await searchConnectedSources({ query, state, level, sources });
    const sourcesByName = new Map(sources.map((source) => [source.source_name, source]));

    await withPersistenceBudget(
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
    );

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

    return jsonNoStore(body);
  } catch (error) {
    return jsonNoStore(
      {
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
      } satisfies UnifiedSearchResponse,
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

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
