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
