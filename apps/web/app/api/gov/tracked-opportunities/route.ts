import { NextResponse } from "next/server";
import type { UnifiedSearchResult } from "@/lib/gov-types";
import { listTrackedOpportunities, trackOpportunity, updateTrackedOpportunity } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listTrackedOpportunities();
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UnifiedSearchResult | null;

  if (!body?.id || !body.title || !body.url) {
    return NextResponse.json({ ok: false, error: "Missing opportunity payload." }, { status: 400 });
  }

  const result = await trackOpportunity(body);
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.id !== "string") {
    return jsonNoStore({ ok: false, error: "Missing tracked opportunity ID." }, { status: 400 });
  }

  const pursuitStatus = typeof body.pursuitStatus === "string" ? body.pursuitStatus : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const result = await updateTrackedOpportunity({ id: body.id, pursuitStatus, notes });
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
