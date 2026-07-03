import type { UnifiedSearchResult } from "@/lib/gov-types";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type SupabaseResponse<T> =
  | { ok: true; configured: true; data: T }
  | { ok: false; configured: false; error: string }
  | { ok: false; configured: true; error: string };

type SavedSearchInput = {
  query: string;
  state: string;
  level: string;
  resultsCount: number;
  searchedSourcesCount: number;
  pendingSourcesCount: number;
  errorCount: number;
};

type SourceHealthInput = {
  sourceName: string;
  sourceState?: string;
  sourceLevel?: string;
  healthStatus: "ok" | "error" | "pending";
  message?: string;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseConfig());
}

async function supabaseRequest<T>(path: string, options: { method?: string; body?: JsonValue; query?: string } = {}): Promise<SupabaseResponse<T>> {
  const config = getSupabaseConfig();

  if (!config) {
    return { ok: false, configured: false, error: "Supabase environment variables are not configured." };
  }

  const endpoint = `${config.url}/rest/v1/${path}${options.query ?? ""}`;
  const response = await fetch(endpoint, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      configured: true,
      error: `Supabase ${response.status}: ${text || response.statusText}`,
    };
  }

  const data = (await response.json().catch(() => null)) as T;
  return { ok: true, configured: true, data };
}

export async function saveSearch(input: SavedSearchInput) {
  return supabaseRequest<Array<{ id: string }>>("saved_searches", {
    method: "POST",
    body: [
      {
        query: input.query,
        state_filter: input.state,
        level_filter: input.level,
        last_results_count: input.resultsCount,
        last_searched_sources_count: input.searchedSourcesCount,
        last_pending_sources_count: input.pendingSourcesCount,
        last_error_count: input.errorCount,
        last_run_at: new Date().toISOString(),
      },
    ],
  });
}

export async function trackOpportunity(result: UnifiedSearchResult) {
  return supabaseRequest<Array<{ id: string }>>("tracked_opportunities", {
    method: "POST",
    query: "?on_conflict=source_result_id",
    body: [
      {
        source_result_id: result.id,
        title: result.title,
        buyer: result.buyer,
        source_name: result.sourceName,
        source_level: result.sourceLevel,
        source_state: result.sourceState,
        source_type: result.sourceType,
        opportunity_url: result.url,
        portal_url: result.portalUrl,
        fit_score: result.score,
        opportunity_status: result.status,
        pursuit_status: "tracked",
        solicitation_id: result.solicitationId ?? null,
        deadline: result.deadline ?? null,
        posted_date: result.postedDate ?? null,
        budget: result.budget ?? null,
        contact: result.contact ?? null,
        summary: result.summary,
        next_action: result.nextAction,
        raw_result: result as unknown as JsonValue,
      },
    ],
  });
}

export async function listTrackedOpportunities() {
  return supabaseRequest<
    Array<{
      id: string;
      title: string;
      buyer: string | null;
      source_name: string;
      source_state: string | null;
      deadline: string | null;
      budget: string | null;
      pursuit_status: string;
      opportunity_url: string;
      portal_url: string | null;
      created_at: string;
    }>
  >("tracked_opportunities", {
    query:
      "?select=id,title,buyer,source_name,source_state,deadline,budget,pursuit_status,opportunity_url,portal_url,created_at&order=created_at.desc&limit=20",
  });
}

export async function recordSourceHealth(items: SourceHealthInput[]) {
  if (items.length === 0) {
    return { ok: true, configured: Boolean(getSupabaseConfig()), data: [] };
  }

  return supabaseRequest<Array<{ id: string }>>("source_health", {
    method: "POST",
    query: "?on_conflict=source_name",
    body: items.map((item) => ({
      source_name: item.sourceName,
      source_state: item.sourceState ?? null,
      source_level: item.sourceLevel ?? null,
      health_status: item.healthStatus,
      message: item.message ?? null,
      checked_at: new Date().toISOString(),
    })),
  });
}
