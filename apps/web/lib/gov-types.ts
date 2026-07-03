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
  submissionInstructions?: string;
  applicationChecklist?: string[];
  summary: string;
  nextAction: string;
};
