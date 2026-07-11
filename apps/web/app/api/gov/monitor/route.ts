import { NextResponse } from "next/server";
import { ensureDefaultMonitorSearches, runDueMonitorSearches, runMonitorSearch } from "@/lib/monitoring";
import { listMonitorFindings, listMonitorRuns, listMonitorSearches, updateMonitorSearch, upsertMonitorSearch } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const searches = await ensureDefaultMonitorSearches();
  const runs = await listMonitorRuns();
  const findings = await listMonitorFindings(100);

  const configured = searches.configured && runs.configured && findings.configured;
  const ok = searches.ok && runs.ok && findings.ok;
  return jsonNoStore({
    ok,
    configured,
    searches: searches.ok ? searches.data : [],
    runs: runs.ok ? runs.data : [],
    findings: findings.ok ? findings.data : [],
    errors: [searches.ok ? undefined : searches.error, runs.ok ? undefined : runs.error, findings.ok ? undefined : findings.error].filter(Boolean),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return jsonNoStore({ ok: false, error: "Missing monitor action." }, { status: 400 });
  }

  if (body.action === "create-search") {
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (query.length < 3) {
      return jsonNoStore({ ok: false, error: "Search term must be at least 3 characters." }, { status: 400 });
    }

    const result = await upsertMonitorSearch({
      query,
      state: typeof body.state === "string" ? body.state : "All",
      level: typeof body.level === "string" ? body.level : "All",
      frequency: isMonitorFrequency(body.frequency) ? body.frequency : "daily",
      enabled: body.enabled !== false,
    });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "update-search") {
    if (typeof body.id !== "string") {
      return jsonNoStore({ ok: false, error: "Missing monitor search id." }, { status: 400 });
    }

    const result = await updateMonitorSearch({
      id: body.id,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      frequency: isMonitorFrequency(body.frequency) ? body.frequency : undefined,
    });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "run-search") {
    if (typeof body.id !== "string") {
      return jsonNoStore({ ok: false, error: "Missing monitor search id." }, { status: 400 });
    }

    const searches = await listMonitorSearches();
    if (!searches.ok) {
      return jsonNoStore(searches, { status: searches.configured === false ? 200 : 502 });
    }

    const search = searches.data.find((item) => item.id === body.id);
    if (!search) {
      return jsonNoStore({ ok: false, configured: true, error: "Monitor search was not found." }, { status: 404 });
    }

    const result = await runMonitorSearch(search, "manual");
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "run-due") {
    const maxRuns = Number.isFinite(Number(body.maxRuns)) ? Number(body.maxRuns) : 1;
    const result = await runDueMonitorSearches({ triggerType: "manual", maxRuns });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  return jsonNoStore({ ok: false, error: "Unknown monitor action." }, { status: 400 });
}

function isMonitorFrequency(value: unknown): value is "daily" | "weekdays" | "manual" {
  return value === "daily" || value === "weekdays" || value === "manual";
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
