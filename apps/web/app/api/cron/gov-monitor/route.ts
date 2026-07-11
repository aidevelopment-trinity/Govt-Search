import { NextResponse } from "next/server";
import { runDueMonitorSearches } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await runDueMonitorSearches({ triggerType: "cron", maxRuns: 1 });
  return NextResponse.json(result, { status: result.ok || result.configured === false ? 200 : 502 });
}
