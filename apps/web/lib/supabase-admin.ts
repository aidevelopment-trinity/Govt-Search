import type { ApprovedResponseBlockRecord, CompanyProfile, DraftQuestionnaire, ProposalDraftRecord, UnifiedSearchResult } from "@/lib/gov-types";

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

type MonitorSearchInput = {
  query: string;
  state: string;
  level: string;
  frequency?: "daily" | "weekdays" | "manual";
  enabled?: boolean;
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

export type SavedSearchRecord = {
  id: string;
  query: string;
  state_filter: string;
  level_filter: string;
  monitor_enabled: boolean;
  monitor_frequency: "daily" | "weekdays" | "manual";
  last_results_count: number;
  last_searched_sources_count: number;
  last_pending_sources_count: number;
  last_error_count: number;
  last_new_results_count: number;
  last_changed_results_count: number;
  last_run_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MonitorRunRecord = {
  id: string;
  saved_search_id: string | null;
  query: string;
  state_filter: string;
  level_filter: string;
  run_status: "running" | "completed" | "failed";
  trigger_type: "manual" | "cron";
  results_count: number;
  searched_sources_count: number;
  pending_sources_count: number;
  error_count: number;
  new_results_count: number;
  changed_results_count: number;
  elapsed_ms: number;
  message: string | null;
  errors?: JsonValue;
  source_statuses?: JsonValue;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MonitorSeenOpportunityRecord = {
  id: string;
  saved_search_id: string;
  source_result_id: string;
  title: string;
  source_name: string;
  source_level: string | null;
  source_state: string | null;
  buyer: string | null;
  solicitation_id: string | null;
  deadline: string | null;
  opportunity_url: string;
  document_links?: JsonValue;
  content_hash: string;
  raw_result?: UnifiedSearchResult | null;
  first_seen_run_id: string | null;
  last_seen_run_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MonitorFindingRecord = {
  id: string;
  run_id: string;
  saved_search_id: string;
  seen_opportunity_id: string | null;
  source_result_id: string;
  finding_type: "new" | "changed";
  title: string;
  source_name: string;
  source_level: string | null;
  source_state: string | null;
  buyer: string | null;
  solicitation_id: string | null;
  old_deadline: string | null;
  new_deadline: string | null;
  opportunity_url: string;
  document_links?: JsonValue;
  raw_result?: UnifiedSearchResult | null;
  created_at: string;
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
        monitor_managed: false,
        monitor_enabled: false,
        monitor_frequency: "daily",
        last_results_count: input.resultsCount,
        last_searched_sources_count: input.searchedSourcesCount,
        last_pending_sources_count: input.pendingSourcesCount,
        last_error_count: input.errorCount,
        last_run_at: new Date().toISOString(),
      },
    ],
  });
}

export async function listMonitorSearches() {
  return supabaseRequest<SavedSearchRecord[]>("saved_searches", {
    query:
      "?monitor_managed=eq.true&select=id,query,state_filter,level_filter,monitor_enabled,monitor_frequency,last_results_count,last_searched_sources_count,last_pending_sources_count,last_error_count,last_new_results_count,last_changed_results_count,last_run_at,last_checked_at,created_at,updated_at&order=updated_at.desc&limit=100",
  });
}

export async function upsertMonitorSearch(input: MonitorSearchInput) {
  const existing = await listMonitorSearches();
  if (existing.ok) {
    const matchingSearch = existing.data.find(
      (search) =>
        search.query.trim().toLowerCase() === input.query.trim().toLowerCase() &&
        search.state_filter === input.state &&
        search.level_filter === input.level,
    );

    if (matchingSearch) {
      return updateMonitorSearch({
        id: matchingSearch.id,
        enabled: input.enabled ?? true,
        frequency: input.frequency ?? matchingSearch.monitor_frequency,
      });
    }
  }

  return supabaseRequest<SavedSearchRecord[]>("saved_searches", {
    method: "POST",
    body: [
      {
        query: input.query,
        state_filter: input.state,
        level_filter: input.level,
        monitor_managed: true,
        monitor_enabled: input.enabled ?? true,
        monitor_frequency: input.frequency ?? "daily",
      },
    ],
  });
}

export async function updateMonitorSearch(input: { id: string; enabled?: boolean; frequency?: "daily" | "weekdays" | "manual" }) {
  const updates: Record<string, JsonValue> = {};
  if (input.enabled !== undefined) {
    updates.monitor_enabled = input.enabled;
  }
  if (input.frequency) {
    updates.monitor_frequency = input.frequency;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false as const, configured: Boolean(getSupabaseConfig()), error: "No monitor search updates were provided." };
  }

  return supabaseRequest<SavedSearchRecord[]>("saved_searches", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(input.id)}`,
    body: updates,
  });
}

export async function createMonitorRun(input: {
  savedSearchId?: string | null;
  query: string;
  state: string;
  level: string;
  triggerType: "manual" | "cron";
}) {
  return supabaseRequest<MonitorRunRecord[]>("monitor_runs", {
    method: "POST",
    body: [
      {
        saved_search_id: input.savedSearchId ?? null,
        query: input.query,
        state_filter: input.state,
        level_filter: input.level,
        trigger_type: input.triggerType,
        run_status: "running",
      },
    ],
  });
}

export async function completeMonitorRun(input: {
  runId: string;
  status: "completed" | "failed";
  resultsCount: number;
  searchedSourcesCount: number;
  pendingSourcesCount: number;
  errorCount: number;
  newResultsCount: number;
  changedResultsCount: number;
  elapsedMs: number;
  message?: string;
  errors?: JsonValue;
  sourceStatuses?: JsonValue;
}) {
  return supabaseRequest<MonitorRunRecord[]>("monitor_runs", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(input.runId)}`,
    body: {
      run_status: input.status,
      results_count: input.resultsCount,
      searched_sources_count: input.searchedSourcesCount,
      pending_sources_count: input.pendingSourcesCount,
      error_count: input.errorCount,
      new_results_count: input.newResultsCount,
      changed_results_count: input.changedResultsCount,
      elapsed_ms: input.elapsedMs,
      message: input.message ?? null,
      errors: input.errors ?? [],
      source_statuses: input.sourceStatuses ?? [],
      completed_at: new Date().toISOString(),
    },
  });
}

export async function updateSearchAfterMonitor(input: {
  id: string;
  resultsCount: number;
  searchedSourcesCount: number;
  pendingSourcesCount: number;
  errorCount: number;
  newResultsCount: number;
  changedResultsCount: number;
}) {
  return supabaseRequest<SavedSearchRecord[]>("saved_searches", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(input.id)}`,
    body: {
      last_results_count: input.resultsCount,
      last_searched_sources_count: input.searchedSourcesCount,
      last_pending_sources_count: input.pendingSourcesCount,
      last_error_count: input.errorCount,
      last_new_results_count: input.newResultsCount,
      last_changed_results_count: input.changedResultsCount,
      last_run_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    },
  });
}

export async function listMonitorRuns() {
  return supabaseRequest<MonitorRunRecord[]>("monitor_runs", {
    query:
      "?select=id,saved_search_id,query,state_filter,level_filter,run_status,trigger_type,results_count,searched_sources_count,pending_sources_count,error_count,new_results_count,changed_results_count,elapsed_ms,message,started_at,completed_at,created_at,updated_at&order=started_at.desc&limit=30",
  });
}

export async function listMonitorFindings(limit = 100) {
  return supabaseRequest<MonitorFindingRecord[]>("monitor_findings", {
    query:
      `?select=id,run_id,saved_search_id,seen_opportunity_id,source_result_id,finding_type,title,source_name,source_level,source_state,buyer,solicitation_id,old_deadline,new_deadline,opportunity_url,document_links,raw_result,created_at&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 200))}`,
  });
}

export async function listSeenOpportunities(savedSearchId: string) {
  return supabaseRequest<MonitorSeenOpportunityRecord[]>("monitor_seen_opportunities", {
    query:
      `?saved_search_id=eq.${encodeURIComponent(savedSearchId)}&select=id,saved_search_id,source_result_id,title,source_name,source_level,source_state,buyer,solicitation_id,deadline,opportunity_url,document_links,content_hash,raw_result,first_seen_run_id,last_seen_run_id,first_seen_at,last_seen_at,last_changed_at,created_at,updated_at&limit=1000`,
  });
}

export async function upsertSeenOpportunity(input: {
  savedSearchId: string;
  runId: string;
  result: UnifiedSearchResult;
  contentHash: string;
  existing?: MonitorSeenOpportunityRecord;
  changed: boolean;
}) {
  return supabaseRequest<MonitorSeenOpportunityRecord[]>("monitor_seen_opportunities", {
    method: "POST",
    query: "?on_conflict=saved_search_id,source_result_id",
    body: [
      {
        saved_search_id: input.savedSearchId,
        source_result_id: input.result.id,
        title: input.result.title,
        source_name: input.result.sourceName,
        source_level: input.result.sourceLevel,
        source_state: input.result.sourceState,
        buyer: input.result.buyer,
        solicitation_id: input.result.solicitationId ?? null,
        deadline: input.result.deadline ?? null,
        opportunity_url: input.result.url,
        document_links: (input.result.documentLinks ?? []) as JsonValue,
        content_hash: input.contentHash,
        raw_result: input.result as unknown as JsonValue,
        first_seen_run_id: input.existing?.first_seen_run_id ?? input.runId,
        last_seen_run_id: input.runId,
        last_seen_at: new Date().toISOString(),
        last_changed_at: input.changed ? new Date().toISOString() : input.existing?.last_changed_at ?? null,
      },
    ],
  });
}

export async function upsertSeenOpportunities(
  items: Array<{
    savedSearchId: string;
    runId: string;
    result: UnifiedSearchResult;
    contentHash: string;
    existing?: MonitorSeenOpportunityRecord;
    changed: boolean;
  }>,
) {
  if (items.length === 0) {
    return { ok: true as const, configured: true as const, data: [] as MonitorSeenOpportunityRecord[] };
  }

  return supabaseRequest<MonitorSeenOpportunityRecord[]>("monitor_seen_opportunities", {
    method: "POST",
    query: "?on_conflict=saved_search_id,source_result_id",
    body: items.map((item) => ({
      saved_search_id: item.savedSearchId,
      source_result_id: item.result.id,
      title: item.result.title,
      source_name: item.result.sourceName,
      source_level: item.result.sourceLevel,
      source_state: item.result.sourceState,
      buyer: item.result.buyer,
      solicitation_id: item.result.solicitationId ?? null,
      deadline: item.result.deadline ?? null,
      opportunity_url: item.result.url,
      document_links: (item.result.documentLinks ?? []) as JsonValue,
      content_hash: item.contentHash,
      raw_result: item.result as unknown as JsonValue,
      first_seen_run_id: item.existing?.first_seen_run_id ?? item.runId,
      last_seen_run_id: item.runId,
      last_seen_at: new Date().toISOString(),
      last_changed_at: item.changed ? new Date().toISOString() : item.existing?.last_changed_at ?? null,
    })),
  });
}

export async function createMonitorFindings(
  findings: Array<{
    runId: string;
    savedSearchId: string;
    seenOpportunityId?: string | null;
    sourceResultId: string;
    findingType: "new" | "changed";
    title: string;
    sourceName: string;
    sourceLevel?: string | null;
    sourceState?: string | null;
    buyer?: string | null;
    solicitationId?: string | null;
    oldDeadline?: string | null;
    newDeadline?: string | null;
    opportunityUrl: string;
    documentLinks?: unknown;
    rawResult?: unknown;
  }>,
) {
  if (findings.length === 0) {
    return { ok: true as const, configured: true as const, data: [] as MonitorFindingRecord[] };
  }

  return supabaseRequest<MonitorFindingRecord[]>("monitor_findings", {
    method: "POST",
    body: findings.map((finding) => ({
      run_id: finding.runId,
      saved_search_id: finding.savedSearchId,
      seen_opportunity_id: finding.seenOpportunityId ?? null,
      source_result_id: finding.sourceResultId,
      finding_type: finding.findingType,
      title: finding.title,
      source_name: finding.sourceName,
      source_level: finding.sourceLevel ?? null,
      source_state: finding.sourceState ?? null,
      buyer: finding.buyer ?? null,
      solicitation_id: finding.solicitationId ?? null,
      old_deadline: finding.oldDeadline ?? null,
      new_deadline: finding.newDeadline ?? null,
      opportunity_url: finding.opportunityUrl,
      document_links: (finding.documentLinks ?? []) as JsonValue,
      raw_result: (finding.rawResult ?? {}) as JsonValue,
    })),
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
      "?pursuit_status=not.eq.removed&select=id,title,buyer,source_name,source_level,source_state,source_type,opportunity_url,portal_url,fit_score,opportunity_status,pursuit_status,solicitation_id,deadline,posted_date,budget,contact,summary,next_action,notes,created_at,updated_at&order=created_at.desc&limit=100",
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

export async function unsaveTrackedOpportunity(id: string) {
  return supabaseRequest<TrackedOpportunityRecord[]>("tracked_opportunities", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(id)}`,
    body: { pursuit_status: "removed" },
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

export async function deleteProposalDraft(id: string) {
  return supabaseRequest<ProposalDraftRecord[]>("proposal_drafts", {
    method: "DELETE",
    query:
      `?id=eq.${encodeURIComponent(id)}&select=id,tracked_opportunity_id,draft_title,draft_status,google_doc_id,google_doc_url,draft_markdown,questionnaire,company_snapshot,created_at,updated_at`,
  });
}

export async function listApprovedResponseBlocks() {
  return supabaseRequest<ApprovedResponseBlockRecord[]>("approved_response_blocks", {
    query: "?select=id,title,category,content,source_draft_id,source_opportunity_id,tags,approved_at,created_at,updated_at&order=created_at.desc&limit=100",
  });
}

export async function createApprovedResponseBlock(input: {
  title: string;
  category: string;
  content: string;
  sourceDraftId?: string | null;
  sourceOpportunityId?: string | null;
  tags?: string[];
}) {
  return supabaseRequest<ApprovedResponseBlockRecord[]>("approved_response_blocks", {
    method: "POST",
    body: [
      {
        title: input.title,
        category: input.category,
        content: input.content,
        source_draft_id: input.sourceDraftId ?? null,
        source_opportunity_id: input.sourceOpportunityId ?? null,
        tags: (input.tags ?? []) as JsonValue,
        approved_at: new Date().toISOString(),
      },
    ],
  });
}

export async function recordSourceHealth(items: SourceHealthInput[]) {
  if (items.length === 0) {
    return { ok: true as const, configured: true as const, data: [] as Array<{ id: string }> };
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
