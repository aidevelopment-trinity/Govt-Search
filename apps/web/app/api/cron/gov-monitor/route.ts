import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { runDueMonitorSearches } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const maxRuns = clampNumber(url.searchParams.get("maxRuns"), 1, 5, 3);
  const result = await runDueMonitorSearches({ triggerType: "cron", maxRuns, timeBudgetMs: 54_000, perSearchTimeoutMs: 45_000 });
  return NextResponse.json(result, { status: result.ok || result.configured === false ? 200 : 502 });
}

function clampNumber(value: string | null, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(numeric)));
}
