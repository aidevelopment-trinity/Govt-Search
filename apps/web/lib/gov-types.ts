export type ProcurementSource = {
  level: string;
  state: string;
  source_name: string;
  source_type: string;
  url: string;
  registration_required: string;
  alert_available: string;
  notes: string;
  status: string;
};

export type OpportunityDocumentLink = {
  label: string;
  url: string;
};

export type UnifiedSearchResult = {
  id: string;
  resultType: "opportunity";
  title: string;
  buyer: string;
  sourceName: string;
  sourceLevel: string;
  sourceState: string;
  sourceType: string;
  url: string;
  portalUrl: string;
  score: number;
  status: string;
  solicitationId?: string;
  deadline?: string;
  postedDate?: string;
  budget?: string;
  contact?: string;
  documents?: string[];
  documentLinks?: OpportunityDocumentLink[];
  submissionInstructions?: string;
  applicationChecklist?: string[];
  fitReasons?: string[];
  riskFlags?: string[];
  summary: string;
  nextAction: string;
};

export type SourceSearchStatus = {
  sourceName: string;
  status: "ok" | "error" | "pending";
  message: string;
  resultCount: number;
  durationMs?: number;
};

export type UnifiedSearchResponse = {
  query: string;
  configured: boolean;
  cached?: boolean;
  cacheAgeMs?: number;
  elapsedMs?: number;
  completedAt?: string;
  results: UnifiedSearchResult[];
  counts: {
    opportunities: number;
    connected: number;
    pending: number;
    total: number;
  };
  searchedSources: string[];
  pendingSources: string[];
  sourceStatuses: SourceSearchStatus[];
  errors: string[];
  message?: string;
};

export type CompanyProfile = {
  id: string;
  company_name: string;
  website: string | null;
  headquarters: string | null;
  service_summary: string | null;
  differentiators: string | null;
  certifications: string | null;
  past_performance: string | null;
  team_bios: string | null;
  standard_language: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftQuestionnaire = {
  bidDecision?: string;
  primaryService?: string;
  projectLead?: string;
  winThemes?: string;
  pastPerformance?: string;
  staffingNotes?: string;
  pricingNotes?: string;
  complianceNotes?: string;
  missingInfo?: string;
  tone?: string;
};

export type ProposalDraftRecord = {
  id: string;
  tracked_opportunity_id: string;
  draft_title: string;
  draft_status: string;
  google_doc_id: string | null;
  google_doc_url: string | null;
  draft_markdown: string;
  questionnaire: DraftQuestionnaire;
  company_snapshot: Partial<CompanyProfile> | null;
  created_at: string;
  updated_at: string;
};

export type ApprovedResponseBlockRecord = {
  id: string;
  title: string;
  category: string;
  content: string;
  source_draft_id: string | null;
  source_opportunity_id: string | null;
  tags: string[];
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};
