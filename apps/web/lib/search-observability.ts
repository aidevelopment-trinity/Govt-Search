import "server-only";

import { randomUUID } from "node:crypto";
import type { SourceSearchStatus } from "@/lib/gov-types";

export type SamRateLimitSnapshot = {
  limit?: string;
  remaining?: string;
  reset?: string;
  retryAfter?: string;
};

export type SamApiCallRecord = {
  id: string;
  checkedAt: string;
  strategy: string;
  status: number | "error";
  ok: boolean;
  rateLimited: boolean;
  message?: string;
  rateLimit?: SamRateLimitSnapshot;
};

export type SearchRunTelemetry = {
  id: string;
  query: string;
  state: string;
  level: string;
  cacheStatus: "fresh" | "cache_hit" | "failed";
  triggerType: "interactive" | "monitor";
  resultsCount: number;
  searchedSourcesCount: number;
  pendingSourcesCount: number;
  errorCount: number;
  elapsedMs: number;
  samCalls: number;
  samRateLimited: boolean;
  samRateLimit?: SamRateLimitSnapshot;
  sourceStatuses: SourceSearchStatus[];
  errors: string[];
  completedAt: string;
};

const MAX_RUNTIME_SEARCH_RUNS = 50;
const MAX_RUNTIME_SAM_CALLS = 250;

export function recordSamApiCall(input: Omit<SamApiCallRecord, "id" | "checkedAt">) {
  const calls = getRuntimeSamCalls();
  calls.unshift({
    id: randomUUID(),
    checkedAt: new Date().toISOString(),
    ...input,
  });
  calls.splice(MAX_RUNTIME_SAM_CALLS);
}

export function getSamUsageSummary() {
  const today = isoDate(new Date());
  const calls = getRuntimeSamCalls();
  const todayCalls = calls.filter((call) => call.checkedAt.startsWith(today));
  const lastCall = calls[0];
  const lastRateLimit = calls.find((call) => call.rateLimit)?.rateLimit;

  return {
    date: today,
    runtimeCallsToday: todayCalls.length,
    runtimeRateLimitedToday: todayCalls.filter((call) => call.rateLimited).length,
    lastStatus: lastCall?.status,
    lastCheckedAt: lastCall?.checkedAt,
    lastMessage: lastCall?.message,
    lastRateLimit,
    recentCalls: calls.slice(0, 10),
  };
}

export function recordRuntimeSearchRun(input: Omit<SearchRunTelemetry, "id" | "completedAt"> & { completedAt?: string }) {
  const runs = getRuntimeSearchRuns();
  runs.unshift({
    id: randomUUID(),
    completedAt: input.completedAt ?? new Date().toISOString(),
    ...input,
  });
  runs.splice(MAX_RUNTIME_SEARCH_RUNS);
}

export function listRuntimeSearchRuns(limit = 10) {
  return getRuntimeSearchRuns().slice(0, Math.max(1, Math.min(limit, MAX_RUNTIME_SEARCH_RUNS)));
}

export function rateLimitFromHeaders(headers: Headers): SamRateLimitSnapshot | undefined {
  const snapshot: SamRateLimitSnapshot = {
    limit: headers.get("x-ratelimit-limit") ?? undefined,
    remaining: headers.get("x-ratelimit-remaining") ?? undefined,
    reset: headers.get("x-ratelimit-reset") ?? undefined,
    retryAfter: headers.get("retry-after") ?? undefined,
  };

  return Object.values(snapshot).some(Boolean) ? snapshot : undefined;
}

function getRuntimeSamCalls() {
  const store = globalThis as typeof globalThis & { __govContractFinderSamApiCalls?: SamApiCallRecord[] };
  return (store.__govContractFinderSamApiCalls ??= []);
}

function getRuntimeSearchRuns() {
  const store = globalThis as typeof globalThis & { __govContractFinderRecentSearchRuns?: SearchRunTelemetry[] };
  return (store.__govContractFinderRecentSearchRuns ??= []);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
