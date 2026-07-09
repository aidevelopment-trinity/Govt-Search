import { NextResponse } from "next/server";
import { getProcurementSources } from "@/lib/gov-contracts";
import { recordSourceHealth } from "@/lib/supabase-admin";
import { searchConnectedSources } from "@/lib/source-adapters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = sanitizeSearchParam(searchParams.get("q"));
  const state = searchParams.get("state") ?? "All";
  const level = searchParams.get("level") ?? "All";

  if (query.length < 3) {
    return jsonNoStore({
      query,
      configured: Boolean(process.env.SAM_API_KEY),
      results: [],
      counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
      searchedSources: [],
      pendingSources: [],
      errors: [],
      message: "Enter a concept with at least 3 characters.",
    });
  }

  try {
    const sources = await getProcurementSources();
    const connectedSearch = await searchConnectedSources({ query, state, level, sources });
    const errorSources = new Set(connectedSearch.errors.map((error) => error.split(":")[0]));

    await withPersistenceBudget(
      recordSourceHealth([
        ...connectedSearch.searchedSources.map((sourceName) => ({
          sourceName,
          healthStatus: errorSources.has(sourceName) ? ("error" as const) : ("ok" as const),
          message: connectedSearch.errors.find((error) => error.startsWith(`${sourceName}:`)) ?? "Search completed.",
        })),
        ...connectedSearch.pendingSources.map((sourceName) => ({
          sourceName,
          healthStatus: "pending" as const,
          message: "Source is listed but not wired for live search yet.",
        })),
      ]),
    );

    return jsonNoStore({
      query,
      configured: connectedSearch.samConfigured,
      results: connectedSearch.results,
      counts: {
        opportunities: connectedSearch.results.length,
        connected: connectedSearch.searchedSources.length,
        pending: connectedSearch.pendingSources.length,
        total: connectedSearch.results.length,
      },
      searchedSources: connectedSearch.searchedSources,
      pendingSources: connectedSearch.pendingSources,
      errors: connectedSearch.errors,
      message:
        connectedSearch.results.length > 0
          ? "Search complete across connected sources."
          : "No matching opportunities found in connected sources. Broaden the search term or connect more procurement sources.",
    });
  } catch (error) {
    return jsonNoStore(
      {
        query,
        configured: Boolean(process.env.SAM_API_KEY),
        results: [],
        counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
        searchedSources: [],
        pendingSources: [],
        errors: [error instanceof Error ? error.message : "Search failed."],
        message: "Search failed before connector results could be returned.",
      },
      { status: 500 },
    );
  }
}

function sanitizeSearchParam(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
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
