import { NextResponse } from "next/server";
import { getProcurementSources } from "@/lib/gov-contracts";
import { recordSourceHealth } from "@/lib/supabase-admin";
import { searchConnectedSources } from "@/lib/source-adapters";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const state = searchParams.get("state") ?? "All";
  const level = searchParams.get("level") ?? "All";

  if (query.length < 3) {
    return NextResponse.json({
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

  const sources = await getProcurementSources();
  const connectedSearch = await searchConnectedSources({ query, state, level, sources });
  const errorSources = new Set(connectedSearch.errors.map((error) => error.split(":")[0]));

  await recordSourceHealth([
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
  ]);

  return NextResponse.json({
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
}
