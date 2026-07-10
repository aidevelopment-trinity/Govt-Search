import type { CompanyProfile, DraftQuestionnaire, ProposalDraftRecord, UnifiedSearchResult } from "@/lib/gov-types";

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

export type TrackedOpportunityRecord = {
  id: string;
  source_result_id?: string;
  title: string;
  buyer: string | null;
  source_name: string;
  source_level: string | null;
  source_state: string | null;
  source_type: string | null;
  opportunity_url: string;
  portal_url: string | null;
  fit_score: number | null;
  opportunity_status: string | null;
  pursuit_status: string;
  solicitation_id: string | null;
  deadline: string | null;
  posted_date: string | null;
  budget: string | null;
  contact: string | null;
  summary: string | null;
  next_action: string | null;
  notes: string | null;
  raw_result?: UnifiedSearchResult | null;
  created_at: string;
  updated_at: string;
};

type UpdateTrackedOpportunityInput = {
  id: string;
  pursuitStatus?: string;
  notes?: string;
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
  const headers: Record<string, string> = {
    apikey: config.serviceRoleKey,
    "Content-Type": "application/json",
    Prefer: "return=representation,resolution=merge-duplicates",
  };

  if (!isNewSupabaseApiKey(config.serviceRoleKey)) {
    headers.Authorization = `Bearer ${config.serviceRoleKey}`;
  }

  const response = await fetch(endpoint, {
    method: options.method ?? "GET",
    headers,
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

function isNewSupabaseApiKey(value: string) {
  return value.startsWith("sb_secret_") || value.startsWith("sb_publishable_");
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
  return supabaseRequest<TrackedOpportunityRecord[]>("tracked_opportunities", {
    query:
      "?select=id,title,buyer,source_name,source_level,source_state,source_type,opportunity_url,portal_url,fit_score,opportunity_status,pursuit_status,solicitation_id,deadline,posted_date,budget,contact,summary,next_action,notes,created_at,updated_at&order=created_at.desc&limit=100",
  });
}

export async function getTrackedOpportunity(id: string) {
  return supabaseRequest<TrackedOpportunityRecord[]>("tracked_opportunities", {
    query:
      `?id=eq.${encodeURIComponent(id)}&select=id,source_result_id,title,buyer,source_name,source_level,source_state,source_type,opportunity_url,portal_url,fit_score,opportunity_status,pursuit_status,solicitation_id,deadline,posted_date,budget,contact,summary,next_action,notes,raw_result,created_at,updated_at&limit=1`,
  });
}

export async function updateTrackedOpportunity(input: UpdateTrackedOpportunityInput) {
  const updates: Record<string, JsonValue> = {};

  if (input.pursuitStatus) {
    updates.pursuit_status = input.pursuitStatus;
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false as const, configured: Boolean(getSupabaseConfig()), error: "No tracked opportunity updates were provided." };
  }

  return supabaseRequest<TrackedOpportunityRecord[]>("tracked_opportunities", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(input.id)}`,
    body: updates,
  });
}

export async function getCompanyProfile() {
  return supabaseRequest<CompanyProfile[]>("company_profile", {
    query:
      "?id=eq.default&select=id,company_name,website,headquarters,service_summary,differentiators,certifications,past_performance,team_bios,standard_language,created_at,updated_at&limit=1",
  });
}

export async function upsertCompanyProfile(input: Partial<CompanyProfile>) {
  return supabaseRequest<CompanyProfile[]>("company_profile", {
    method: "POST",
    query: "?on_conflict=id",
    body: [
      {
        id: "default",
        company_name: input.company_name ?? "",
        website: input.website ?? null,
        headquarters: input.headquarters ?? null,
        service_summary: input.service_summary ?? null,
        differentiators: input.differentiators ?? null,
        certifications: input.certifications ?? null,
        past_performance: input.past_performance ?? null,
        team_bios: input.team_bios ?? null,
        standard_language: input.standard_language ?? null,
      },
    ],
  });
}

export async function createProposalDraft(input: {
  trackedOpportunityId: string;
  draftTitle: string;
  draftMarkdown: string;
  questionnaire: DraftQuestionnaire;
  companySnapshot: Partial<CompanyProfile> | null;
  googleDocId?: string | null;
  googleDocUrl?: string | null;
}) {
  return supabaseRequest<ProposalDraftRecord[]>("proposal_drafts", {
    method: "POST",
    body: [
      {
        tracked_opportunity_id: input.trackedOpportunityId,
        draft_title: input.draftTitle,
        draft_status: input.googleDocUrl ? "google_doc_created" : "draft_created",
        google_doc_id: input.googleDocId ?? null,
        google_doc_url: input.googleDocUrl ?? null,
        draft_markdown: input.draftMarkdown,
        questionnaire: input.questionnaire as JsonValue,
        company_snapshot: input.companySnapshot as JsonValue,
      },
    ],
  });
}

export async function listProposalDrafts(trackedOpportunityId?: string) {
  const filter = trackedOpportunityId ? `&tracked_opportunity_id=eq.${encodeURIComponent(trackedOpportunityId)}` : "";
  return supabaseRequest<ProposalDraftRecord[]>("proposal_drafts", {
    query:
      `?select=id,tracked_opportunity_id,draft_title,draft_status,google_doc_id,google_doc_url,draft_markdown,questionnaire,company_snapshot,created_at,updated_at${filter}&order=created_at.desc&limit=50`,
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
