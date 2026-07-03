import { NextResponse } from "next/server";
import type { UnifiedSearchResult } from "@/lib/gov-types";
import { listTrackedOpportunities, trackOpportunity } from "@/lib/supabase-admin";

export async function GET() {
  const result = await listTrackedOpportunities();
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return NextResponse.json(result, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UnifiedSearchResult | null;

  if (!body?.id || !body.title || !body.url) {
    return NextResponse.json({ ok: false, error: "Missing opportunity payload." }, { status: 400 });
  }

  const result = await trackOpportunity(body);
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return NextResponse.json(result, { status });
}
