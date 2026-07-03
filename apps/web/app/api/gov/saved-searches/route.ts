import { NextResponse } from "next/server";
import { saveSearch } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.query !== "string") {
    return NextResponse.json({ ok: false, error: "Missing search payload." }, { status: 400 });
  }

  const result = await saveSearch({
    query: body.query,
    state: typeof body.state === "string" ? body.state : "All",
    level: typeof body.level === "string" ? body.level : "All",
    resultsCount: Number(body.resultsCount ?? 0),
    searchedSourcesCount: Number(body.searchedSourcesCount ?? 0),
    pendingSourcesCount: Number(body.pendingSourcesCount ?? 0),
    errorCount: Number(body.errorCount ?? 0),
  });

  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return NextResponse.json(result, { status });
}
