import "server-only";

import { conceptTerms, samSearchUrl } from "@/lib/gov-search";
import type { ProcurementSource, SourceSearchStatus, UnifiedSearchResult } from "@/lib/gov-types";

type SearchFilters = {
  query: string;
  state: string;
  level: string;
  sources: ProcurementSource[];
};

type ConnectedSearchResponse = {
  results: UnifiedSearchResult[];
  searchedSources: string[];
  pendingSources: string[];
  sourceStatuses: SourceSearchStatus[];
  errors: string[];
  samConfigured: boolean;
};

type SearchTaskResult = { source: string; results: UnifiedSearchResult[]; error?: string; durationMs?: number };
type SearchTask = { source: string; run: () => Promise<SearchTaskResult> };
type SamSearchResult = { results: UnifiedSearchResult[]; error?: string };
type ConnectorSearchResult = { results: UnifiedSearchResult[]; error?: string };

const TEXAS_ESBD_URL = "https://www.txsmartbuy.gov/esbd";
const TEXAS_ESBD_SERVICE_URL = "https://www.txsmartbuy.gov/app/extensions/CPA/CPAMain/1.0.0/services/ESBD.Service.ss";
const TEXAS_ESBD_ACTIVE_STATUS = "1";
const TEXAS_ESBD_NIGP_CODES_BY_CONCEPT: Array<{ terms: string[]; codes: string[] }> = [
  { terms: ["training", "education", "educational", "learning", "development", "professional"], codes: ["92400", "92416", "92478", "91838"] },
  { terms: ["leadership", "management", "manager", "supervisor", "executive", "coaching"], codes: ["91838", "91865", "91883", "92416"] },
  { terms: ["human", "hr", "workforce", "organizational", "organization"], codes: ["91865", "91883", "91838"] },
];
const TEXAS_ESBD_DEFAULT_RECENT_PAGES = 3;
type TexasEsbdAgencySource = {
  sourceName: string;
  agencyNumbers: string[];
  buyer: string;
};
const TEXAS_ESBD_AGENCY_SOURCES: TexasEsbdAgencySource[] = [
  { sourceName: "Texas Health and Human Services Commission Contracting", agencyNumbers: ["529"], buyer: "Health & Human Services Commission" },
  { sourceName: "Texas Department of Criminal Justice Business and Finance", agencyNumbers: ["696"], buyer: "Texas Department of Criminal Justice" },
  { sourceName: "Texas Department of Transportation Business", agencyNumbers: ["601"], buyer: "Texas Department of Transportation" },
  { sourceName: "Texas Workforce Commission Procurement", agencyNumbers: ["320"], buyer: "Texas Workforce Commission" },
  { sourceName: "Travis County Purchasing", agencyNumbers: ["C2270"], buyer: "Travis County" },
  { sourceName: "Dallas County Purchasing", agencyNumbers: ["C0570"], buyer: "Dallas County" },
  { sourceName: "City of San Antonio Procurement", agencyNumbers: ["M0152"], buyer: "City of San Antonio" },
  { sourceName: "City of Irving Purchasing", agencyNumbers: ["M0570"], buyer: "City of Irving" },
  { sourceName: "City of Waco Purchasing", agencyNumbers: ["M1612"], buyer: "City of Waco" },
  { sourceName: "City of Odessa Purchasing", agencyNumbers: ["M0680"], buyer: "City of Odessa" },
  { sourceName: "Williamson County Purchasing", agencyNumbers: ["C2460"], buyer: "Williamson County" },
  { sourceName: "City of Georgetown Purchasing", agencyNumbers: ["M2461"], buyer: "City of Georgetown" },
  { sourceName: "City of Grapevine Purchasing", agencyNumbers: ["M2201"], buyer: "City of Grapevine" },
  { sourceName: "City of Galveston Purchasing", agencyNumbers: ["M0843"], buyer: "City of Galveston" },
  { sourceName: "San Antonio International Airport Business", agencyNumbers: ["M0152"], buyer: "City of San Antonio" },
  { sourceName: "University of Texas System Supplier Information", agencyNumbers: ["720"], buyer: "University Of Texas System" },
  { sourceName: "Texas A&M University System Doing Business", agencyNumbers: ["711", "715", "751", "555", "556", "712", "716", "576"], buyer: "Texas A&M University System" },
  { sourceName: "University of Texas at Austin Purchasing", agencyNumbers: ["721"], buyer: "University Of Texas At Austin" },
  { sourceName: "Texas A&M University Purchasing", agencyNumbers: ["711"], buyer: "Texas A & M University" },
  { sourceName: "University of Houston Purchasing", agencyNumbers: ["730"], buyer: "University Of Houston" },
  { sourceName: "Texas Tech University System Procurement", agencyNumbers: ["768", "733", "739", "774"], buyer: "Texas Tech University System" },
  { sourceName: "Dallas ISD Procurement", agencyNumbers: ["S5573"], buyer: "Dallas ISD" },
  { sourceName: "Fort Worth ISD Purchasing", agencyNumbers: ["S2209"], buyer: "Fort Worth ISD" },
  { sourceName: "Alamo Colleges Purchasing", agencyNumbers: ["J0150"], buyer: "Alamo Community College District" },
  { sourceName: "Austin Community College Purchasing", agencyNumbers: ["J2270"], buyer: "Austin Community College" },
  { sourceName: "Lone Star College Purchasing", agencyNumbers: ["J1010"], buyer: "Lone Star College System" },
  { sourceName: "North Central Texas Council of Governments Purchasing", agencyNumbers: ["G2200"], buyer: "North Central Texas Council of Governments" },
  { sourceName: "Houston-Galveston Area Council Procurement", agencyNumbers: ["G1010"], buyer: "Houston-Galveston Area Council" },
  { sourceName: "Lower Colorado River Authority Business", agencyNumbers: ["K0042"], buyer: "Lower Colorado River Authority" },
];
const TEXAS_ESBD_AGENCY_SOURCE_BY_NAME = new Map(TEXAS_ESBD_AGENCY_SOURCES.map((source) => [source.sourceName, source]));
const TEXAS_REFERENCE_SOURCE_NAMES = new Set(["Texas Statewide Procurement Division", "Texas Centralized Master Bidders List", "Texas HUB Program"]);
type BonfireSource = {
  sourceName: string;
  buyer: string;
  portalUrl: string;
  level: string;
};
type IonWaveSource = {
  sourceName: string;
  buyer: string;
  currentBidsUrl: string;
  portalUrl: string;
  level: string;
};
type OpenGovSource = {
  sourceName: string;
  buyer: string;
  portalCode: string;
  portalUrl: string;
  level: string;
};
const TEXAS_BONFIRE_SOURCES: BonfireSource[] = [
  {
    sourceName: "City of Dallas Procurement Services",
    buyer: "City of Dallas",
    portalUrl: "https://dallascityhall.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "Harris County Purchasing",
    buyer: "Harris County",
    portalUrl: "https://harriscountytx.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "City of Fort Worth Purchasing",
    buyer: "City of Fort Worth",
    portalUrl: "https://fortworthtexas.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "City of Frisco Purchasing",
    buyer: "City of Frisco",
    portalUrl: "https://friscotexas.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "City of Round Rock Purchasing",
    buyer: "City of Round Rock",
    portalUrl: "https://roundrocktexas.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "City of McKinney Purchasing",
    buyer: "City of McKinney",
    portalUrl: "https://mckinneytexas.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "Denton County Purchasing",
    buyer: "Denton County",
    portalUrl: "https://dentoncounty.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "City of Midland Purchasing",
    buyer: "City of Midland",
    portalUrl: "https://midlandtexas.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
  },
  {
    sourceName: "Austin ISD Purchasing",
    buyer: "Austin ISD",
    portalUrl: "https://austinisd.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Education",
  },
  {
    sourceName: "DFW Airport Solicitations",
    buyer: "DFW Airport",
    portalUrl: "https://dfwairport.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Adjacent",
  },
  {
    sourceName: "DART Procurement",
    buyer: "DART",
    portalUrl: "https://dart.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Adjacent",
  },
  {
    sourceName: "San Antonio ISD Purchasing",
    buyer: "San Antonio ISD",
    portalUrl: "https://saisd.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Education",
  },
  {
    sourceName: "San Antonio River Authority Business Opportunities",
    buyer: "San Antonio River Authority",
    portalUrl: "https://sara-tx.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Adjacent",
  },
  {
    sourceName: "North Texas Municipal Water District Business Opportunities",
    buyer: "North Texas Municipal Water District",
    portalUrl: "https://ntmwd.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Adjacent",
  },
];
const TEXAS_BONFIRE_SOURCE_BY_NAME = new Map(TEXAS_BONFIRE_SOURCES.map((source) => [source.sourceName, source]));
const TEXAS_IONWAVE_SOURCES: IonWaveSource[] = [
  {
    sourceName: "Tarrant County Purchasing",
    buyer: "Tarrant County",
    currentBidsUrl: "https://tarrantcountytx.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://tarrantcountytx.ionwave.net/Login.aspx",
    level: "Local",
  },
  {
    sourceName: "City of Plano Purchasing",
    buyer: "City of Plano",
    currentBidsUrl: "https://planotx.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://planotx.ionwave.net/Login.aspx",
    level: "Local",
  },
  {
    sourceName: "City of Denton Purchasing",
    buyer: "City of Denton",
    currentBidsUrl: "https://dentontx.ionwave.net/SourcingEvents.aspx?SourceType=112",
    portalUrl: "https://dentontx.ionwave.net/Login.aspx",
    level: "Local",
  },
  {
    sourceName: "City of Irving Purchasing",
    buyer: "City of Irving",
    currentBidsUrl: "https://cityofirving.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://cityofirving.ionwave.net/Login.aspx",
    level: "Local",
  },
  {
    sourceName: "City of Georgetown Purchasing",
    buyer: "City of Georgetown",
    currentBidsUrl: "https://gtowntx.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://gtowntx.ionwave.net/Login.aspx",
    level: "Local",
  },
  {
    sourceName: "Lone Star College Purchasing",
    buyer: "Lone Star College System",
    currentBidsUrl: "https://lonestar.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://lonestar.ionwave.net/Login.aspx",
    level: "Education",
  },
  {
    sourceName: "Houston ISD Procurement",
    buyer: "Houston ISD",
    currentBidsUrl: "https://houstonisd.ionwave.net/SourcingEvents.aspx?SourceType=114",
    portalUrl: "https://houstonisd.ionwave.net/Login.aspx",
    level: "Education",
  },
];
const TEXAS_IONWAVE_SOURCE_BY_NAME = new Map(TEXAS_IONWAVE_SOURCES.map((source) => [source.sourceName, source]));
const TEXAS_OPENGOV_SOURCES: OpenGovSource[] = [
  {
    sourceName: "Collin County Purchasing",
    buyer: "Collin County",
    portalCode: "collincountytx",
    portalUrl: "https://procurement.opengov.com/portal/collincountytx",
    level: "Local",
  },
  {
    sourceName: "City of Sugar Land Purchasing",
    buyer: "City of Sugar Land",
    portalCode: "sugarlandtx",
    portalUrl: "https://procurement.opengov.com/portal/sugarlandtx",
    level: "Local",
  },
];
const TEXAS_OPENGOV_SOURCE_BY_NAME = new Map(TEXAS_OPENGOV_SOURCES.map((source) => [source.sourceName, source]));
const TENNESSEE_RFP_URL =
  "https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/supplier-information/request-for-proposals--rfp--opportunities1.html";
const TENNESSEE_ITB_URL =
  "https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/supplier-information/invitations-to-bid--itb-.html";
const THE_WOODLANDS_BIDS_URL =
  "https://www.thewoodlandstownship-tx.gov/Departments/Finance/Purchasing-Procurement/Bids";
const AUSTIN_SOLICITATIONS_URL = "https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitations.cfm";
const FRISCO_CURRENT_BIDS_URL = "https://www.friscotexas.gov/883/Current-Bids";
const HANDLED_SOURCE_NAMES = new Set([
  "SAM.gov Contract Opportunities",
  "Texas Electronic State Business Daily",
  "The Woodlands Township Bids",
  "City of Austin Purchasing",
  "City of Frisco Purchasing",
  "Tennessee RFP Opportunities",
  "Tennessee ITB Opportunities",
  ...TEXAS_ESBD_AGENCY_SOURCE_BY_NAME.keys(),
  ...TEXAS_BONFIRE_SOURCE_BY_NAME.keys(),
  ...TEXAS_IONWAVE_SOURCE_BY_NAME.keys(),
  ...TEXAS_OPENGOV_SOURCE_BY_NAME.keys(),
  ...TEXAS_REFERENCE_SOURCE_NAMES,
]);
const SERVER_BLOCKED_SOURCE_NAMES = new Set(["The Woodlands Township Bids"]);
const SAM_SUCCESS_CACHE_MS = 15 * 60 * 1000;
const SAM_ERROR_CACHE_MS = 2 * 60 * 1000;
const SAM_RATE_LIMIT_CACHE_MS = 10 * 60 * 1000;
const SAM_RETRY_DELAYS_MS = [0, 1500, 4000];
const SAM_FETCH_TIMEOUT_MS = 12000;
const BONFIRE_SUCCESS_CACHE_MS = 10 * 60 * 1000;
const BONFIRE_ERROR_CACHE_MS = 90 * 1000;
const BONFIRE_RATE_LIMIT_CACHE_MS = 5 * 60 * 1000;
const BONFIRE_QUEUE_GAP_MS = 2500;
const BONFIRE_FETCH_TIMEOUT_MS = 12000;
const IONWAVE_SUCCESS_CACHE_MS = 10 * 60 * 1000;
const IONWAVE_ERROR_CACHE_MS = 3 * 60 * 1000;
const IONWAVE_RATE_LIMIT_CACHE_MS = 8 * 60 * 1000;
const IONWAVE_QUEUE_GAP_MS = 4500;
const IONWAVE_FETCH_TIMEOUT_MS = 12000;
const OPENGOV_SUCCESS_CACHE_MS = 10 * 60 * 1000;
const OPENGOV_ERROR_CACHE_MS = 2 * 60 * 1000;
const OPENGOV_FETCH_TIMEOUT_MS = 12000;
const SEARCH_TASK_TIMEOUT_MS = 45000;
const SEARCH_TOTAL_TIMEOUT_MS = 56000;
const SEARCH_TASK_CONCURRENCY = 10;
const MAX_RESULTS = 120;

const samCache = getGlobalMap<{ expiresAt: number; value: SamSearchResult }>("__govContractFinderSamCache");
const samInFlight = getGlobalMap<Promise<SamSearchResult>>("__govContractFinderSamInFlight");
const bonfireCache = getGlobalMap<{ expiresAt: number; value: ConnectorSearchResult }>("__govContractFinderBonfireCache");
const bonfireInFlight = getGlobalMap<Promise<ConnectorSearchResult>>("__govContractFinderBonfireInFlight");
const bonfireProjectsCache = getGlobalMap<{ expiresAt: number; projects: BonfireProject[] }>("__govContractFinderBonfireProjectsCache");
const bonfireProjectsInFlight = getGlobalMap<Promise<ConnectorSearchResult & { projects?: BonfireProject[] }>>(
  "__govContractFinderBonfireProjectsInFlight",
);
const ionWaveCache = getGlobalMap<{ expiresAt: number; value: ConnectorSearchResult }>("__govContractFinderIonWaveCache");
const ionWaveInFlight = getGlobalMap<Promise<ConnectorSearchResult>>("__govContractFinderIonWaveInFlight");
const ionWavePageCache = getGlobalMap<{ expiresAt: number; html: string }>("__govContractFinderIonWavePageCache");
const openGovCache = getGlobalMap<{ expiresAt: number; value: ConnectorSearchResult }>("__govContractFinderOpenGovCache");
const openGovInFlight = getGlobalMap<Promise<ConnectorSearchResult>>("__govContractFinderOpenGovInFlight");

export async function searchConnectedSources({ query, state, level, sources }: SearchFilters): Promise<ConnectedSearchResponse> {
  const tasks: SearchTask[] = [];
  const searchedSources: string[] = [];
  const pendingSources = sources
    .filter((source) => matchesFilter({ sourceState: source.state, sourceLevel: source.level, state, level }))
    .map((source) => source.source_name);
  const samConfigured = Boolean(process.env.SAM_API_KEY);

  if (matchesFilter({ sourceState: "US", sourceLevel: "Federal", state, level }) && samConfigured) {
    searchedSources.push("SAM.gov Contract Opportunities");
    removePending(pendingSources, "SAM.gov Contract Opportunities");
    removePending(pendingSources, "SAM.gov Get Opportunities API");
    tasks.push({ source: "SAM.gov Contract Opportunities", run: () => searchSam(query) });
  }

  if (matchesFilter({ sourceState: "TX", sourceLevel: "State", state, level })) {
    searchedSources.push("Texas Electronic State Business Daily");
    removePending(pendingSources, "Texas Electronic State Business Daily");
    tasks.push({ source: "Texas Electronic State Business Daily", run: () => searchTexasEsbd(query) });

  }

  if (matchesFilter({ sourceState: "TN", sourceLevel: "State", state, level })) {
    searchedSources.push("Tennessee RFP Opportunities");
    searchedSources.push("Tennessee ITB Opportunities");
    removePending(pendingSources, "Tennessee RFP Opportunities");
    removePending(pendingSources, "Tennessee ITB Opportunities");
    tasks.push({
      source: "Tennessee RFP Opportunities",
      run: () => searchTennesseePage(query, "Tennessee RFP Opportunities", TENNESSEE_RFP_URL, "RFP/RFI/RFQ"),
    });
    tasks.push({
      source: "Tennessee ITB Opportunities",
      run: () => searchTennesseePage(query, "Tennessee ITB Opportunities", TENNESSEE_ITB_URL, "ITB"),
    });
  }

  for (const source of sources) {
    if (TEXAS_REFERENCE_SOURCE_NAMES.has(source.source_name)) {
      removePending(pendingSources, source.source_name);
      continue;
    }

    if (SERVER_BLOCKED_SOURCE_NAMES.has(source.source_name)) {
      continue;
    }

    if (matchesFilter({ sourceState: source.state, sourceLevel: source.level, state, level })) {
      if (source.source_name === "City of Austin Purchasing") {
        searchedSources.push("City of Austin Purchasing");
        removePending(pendingSources, "City of Austin Purchasing");
        tasks.push({ source: "City of Austin Purchasing", run: () => searchAustinSolicitations(query) });
        continue;
      }

      if (source.source_name === "City of Frisco Purchasing") {
        searchedSources.push("City of Frisco Purchasing");
        removePending(pendingSources, "City of Frisco Purchasing");
        tasks.push({ source: "City of Frisco Purchasing", run: () => searchFriscoCurrentBids(query) });
        continue;
      }

      const texasIonWaveSource = TEXAS_IONWAVE_SOURCE_BY_NAME.get(source.source_name);
      if (texasIonWaveSource) {
        searchedSources.push(texasIonWaveSource.sourceName);
        removePending(pendingSources, texasIonWaveSource.sourceName);
        tasks.push({ source: texasIonWaveSource.sourceName, run: () => searchIonWave(query, texasIonWaveSource) });
        continue;
      }

      const texasBonfireSource = TEXAS_BONFIRE_SOURCE_BY_NAME.get(source.source_name);
      if (texasBonfireSource) {
        searchedSources.push(texasBonfireSource.sourceName);
        removePending(pendingSources, texasBonfireSource.sourceName);
        tasks.push({ source: texasBonfireSource.sourceName, run: () => searchBonfire(query, texasBonfireSource) });
        continue;
      }

      const texasOpenGovSource = TEXAS_OPENGOV_SOURCE_BY_NAME.get(source.source_name);
      if (texasOpenGovSource) {
        searchedSources.push(texasOpenGovSource.sourceName);
        removePending(pendingSources, texasOpenGovSource.sourceName);
        tasks.push({ source: texasOpenGovSource.sourceName, run: () => searchOpenGov(query, texasOpenGovSource) });
        continue;
      }

      const texasAgencySource = TEXAS_ESBD_AGENCY_SOURCE_BY_NAME.get(source.source_name);
      if (texasAgencySource) {
        searchedSources.push(texasAgencySource.sourceName);
        removePending(pendingSources, texasAgencySource.sourceName);
        tasks.push({ source: texasAgencySource.sourceName, run: () => searchTexasAgencyEsbd(query, texasAgencySource) });
        continue;
      }
    }

    if (matchesFilter({ sourceState: source.state, sourceLevel: source.level, state, level }) && source.source_name === "The Woodlands Township Bids") {
      searchedSources.push("The Woodlands Township Bids");
      removePending(pendingSources, "The Woodlands Township Bids");
      tasks.push({ source: "The Woodlands Township Bids", run: () => searchTheWoodlands(query) });
      continue;
    }

    if (HANDLED_SOURCE_NAMES.has(source.source_name)) {
      continue;
    }

    if (!matchesFilter({ sourceState: source.state, sourceLevel: source.level, state, level })) {
      continue;
    }

    // Do not treat generic procurement homepages as connected searches. Each
    // source needs a real portal/API/page connector before it is counted.
    continue;
  }

  const settled = await runSearchTasks(tasks, SEARCH_TASK_CONCURRENCY, SEARCH_TOTAL_TIMEOUT_MS);
  const results = dedupeResults(settled.flatMap((item) => item.results).map((result) => enrichSearchResult(result, query)))
    .sort((a, b) => resultRankScore(b) - resultRankScore(a) || a.title.localeCompare(b.title))
    .slice(0, MAX_RESULTS);
  const errors = settled.flatMap((item) => (item.error && !isPendingConnectorIssue(item.error) ? [`${item.source}: ${item.error}`] : []));
  const sourceStatuses = [
    ...settled.map((item) => sourceStatusFromTaskResult(item)),
    ...pendingSources.map((sourceName) => ({
      sourceName,
      status: "pending" as const,
      message: pendingSourceMessage(sourceName),
      resultCount: 0,
    })),
  ].sort((a, b) => {
    const statusOrder = { error: 0, pending: 1, ok: 2 };
    return statusOrder[a.status] - statusOrder[b.status] || a.sourceName.localeCompare(b.sourceName);
  });

  return {
    results,
    searchedSources,
    pendingSources,
    sourceStatuses,
    errors,
    samConfigured,
  };
}

async function searchTheWoodlands(query: string): Promise<{ source: string; results: UnifiedSearchResult[]; error?: string }> {
  try {
    const response = await fetchPublicPage(THE_WOODLANDS_BIDS_URL);

    if (!response.ok) {
      return { source: "The Woodlands Township Bids", results: [], error: `returned ${response.status}` };
    }

    const html = await response.text();
    return {
      source: "The Woodlands Township Bids",
      results: parseTheWoodlandsBids(html, query),
    };
  } catch (error) {
    return { source: "The Woodlands Township Bids", results: [], error: errorMessage(error) };
  }
}

function parseTheWoodlandsBids(html: string, query: string): UnifiedSearchResult[] {
  const openSection = html.match(/<h3>Open Bids<\/h3>([\s\S]*?)(?:<h3>Closed\/Awarded Bids<\/h3>|<\/main>)/i)?.[1] ?? "";
  const entries = Array.from(openSection.matchAll(/<h4>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4>|$)/gi));
  const terms = conceptTerms(query);

  return entries
    .map((entry, index) => theWoodlandsEntryToResult(entry[1], entry[2], terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function theWoodlandsEntryToResult(titleHtml: string, bodyHtml: string, terms: string[], index: number): UnifiedSearchResult | undefined {
  const title = cleanText(titleHtml);
  const description = cleanText(bodyHtml.split(/<strong>\s*Closing Date/i)[0] ?? bodyHtml);
  const deadline = cleanText(bodyHtml.match(/<strong>\s*Closing Date:?<\/strong>\s*:?\s*([\s\S]*?)(?:<br|<\/p>)/i)?.[1] ?? "");
  const contact = cleanText(bodyHtml.match(/<strong>\s*Contact:?[\s\S]*?<\/strong>\s*([\s\S]*?)(?:<\/p>|<br)/i)?.[1] ?? "");
  const linkMatch = bodyHtml.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const url = linkMatch ? new URL(linkMatch[1], THE_WOODLANDS_BIDS_URL).toString() : THE_WOODLANDS_BIDS_URL;
  const linkText = linkMatch ? cleanText(linkMatch[2]) : "";
  const haystack = [title, description, deadline, contact, linkText, "the woodlands township bids"].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 65 - index);

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `the-woodlands:${title}`,
    resultType: "opportunity",
    title,
    buyer: "The Woodlands Township",
    sourceName: "The Woodlands Township Bids",
    sourceLevel: "Local",
    sourceState: "TX",
    sourceType: "Public opportunity page",
    url,
    portalUrl: THE_WOODLANDS_BIDS_URL,
    score,
    status: "Open/public posting",
    deadline,
    contact,
    documents: linkText ? [linkText] : [],
    submissionInstructions: "Open the Township bid document and follow the stated submission method, required forms, and closing date.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: Boolean(deadline), hasDocuments: Boolean(linkText), hasContact: Boolean(contact) }),
    summary: [description, contact ? `Contact: ${contact}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the Township bid document, confirm the submission method and due date, then route it for human review.",
  };
}

async function searchSam(query: string): Promise<{ source: string; results: UnifiedSearchResult[]; error?: string }> {
  const source = "SAM.gov Contract Opportunities";
  const apiKey = process.env.SAM_API_KEY;
  const terms = conceptTerms(query);

  if (!apiKey) {
    return { source, results: [], error: "SAM_API_KEY is missing" };
  }

  const today = new Date();
  const prior = new Date(today);
  prior.setDate(today.getDate() - 90);

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: "50",
    keyword: query,
    postedFrom: formatSamDate(prior),
    postedTo: formatSamDate(today),
  });

  try {
    const cacheKey = `sam:${formatSamDate(prior)}:${formatSamDate(today)}:${query.toLowerCase()}`;
    const cached = samCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { source, ...cached.value };
    }

    const existingRequest = samInFlight.get(cacheKey);
    if (existingRequest) {
      return { source, ...(await existingRequest) };
    }

    const request = fetchSamSearch(`https://api.sam.gov/opportunities/v2/search?${params.toString()}`, query, terms).finally(() => {
      samInFlight.delete(cacheKey);
    });
    samInFlight.set(cacheKey, request);

    const value = await request;
    const ttl = value.error?.includes("rate limited")
      ? SAM_RATE_LIMIT_CACHE_MS
      : value.error
        ? SAM_ERROR_CACHE_MS
        : SAM_SUCCESS_CACHE_MS;
    samCache.set(cacheKey, { expiresAt: Date.now() + ttl, value });

    return { source, ...value };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

async function fetchSamSearch(url: string, query: string, terms: string[]): Promise<SamSearchResult> {
  for (let attempt = 0; attempt < SAM_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = SAM_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      await delay(delayMs);
    }

    const response = await fetchWithTimeout(
      url,
      {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      },
      SAM_FETCH_TIMEOUT_MS,
    );

    if (response.status === 429 && attempt < SAM_RETRY_DELAYS_MS.length - 1) {
      continue;
    }

    if (response.status === 429) {
      return {
        results: [],
        error: "SAM.gov rate limited the API key. The connector is wired, cached, and will retry after a cooldown.",
      };
    }

    if (!response.ok) {
      return { results: [], error: `official API returned ${response.status}` };
    }

    const data = await response.json();
    if (!Array.isArray(data.opportunitiesData)) {
      return { results: [] };
    }

    const results = (data.opportunitiesData as Array<Record<string, unknown>>)
      .map((item: Record<string, unknown>, index: number): UnifiedSearchResult | undefined => {
      const title = stringValue(item.title) ?? "Untitled opportunity";
      const solicitation = stringValue(item.solicitationNumber);
      const url = stringValue(item.uiLink) ?? samSearchUrl(query);
      const agency = stringValue(item.fullParentPathName) ?? stringValue(item.agency) ?? "SAM.gov";
      const office = stringValue(item.officeName);
      const status = stringValue(item.type) ?? "Opportunity";
      const deadline = stringValue(item.responseDeadLine);
      const postedDate = stringValue(item.postedDate);
      const haystack = [title, solicitation, agency, office, status].filter(Boolean).join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 100 - index);

      if (terms.length > 0 && score <= 0) {
        return undefined;
      }

      if (isPastDeadline(deadline) || ["award notice", "justification"].includes(status.toLowerCase())) {
        return undefined;
      }

      return {
        id: `sam:${solicitation ?? index}:${title}`,
        resultType: "opportunity",
        title,
        buyer: [agency, office].filter(Boolean).join(" / "),
        sourceName: "SAM.gov",
        sourceLevel: "Federal",
        sourceState: "US",
        sourceType: "Official API",
        url,
        portalUrl: samSearchUrl(query),
        score,
        status,
        solicitationId: solicitation,
        deadline,
        postedDate,
        submissionInstructions: "Open the SAM.gov opportunity package and review the solicitation attachments, response format, set-aside rules, and submission method.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitation), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: Boolean(office) }),
        summary: [solicitation ? `Solicitation ${solicitation}.` : "", office ? `Office: ${office}.` : ""].filter(Boolean).join(" "),
        nextAction: "Review the solicitation package, then add the opportunity to the human-review tracker if it fits.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result));

    return { results };
  }

  return { results: [], error: "SAM.gov search failed." };
}

async function searchTexasEsbd(query: string): Promise<{ source: string; results: UnifiedSearchResult[]; error?: string }> {
  const source = "Texas Electronic State Business Daily";

  try {
    const nigpCodes = texasEsbdNigpCodes(query);
    const batches =
      nigpCodes.length > 0
        ? await Promise.all(nigpCodes.map((nigp) => fetchTexasEsbdBatch({ nigp, status: TEXAS_ESBD_ACTIVE_STATUS })))
        : [await fetchTexasEsbdPages({ status: TEXAS_ESBD_ACTIVE_STATUS }, TEXAS_ESBD_DEFAULT_RECENT_PAGES)];

    const errors = batches.flatMap((batch) => batch.error ?? []);
    const rowsById = new Map<string, TexasEsbdLine>();

    for (const batch of batches) {
      for (const line of batch.lines) {
        const key = line.solicitationId || line.internalid || `${line.title}:${line.responseDue}`;
        if (key) {
          rowsById.set(key, line);
        }
      }
    }

    return { source, results: parseTexasEsbdLines(Array.from(rowsById.values()), query), error: errors[0] };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

async function searchTexasAgencyEsbd(
  query: string,
  agencySource: TexasEsbdAgencySource,
): Promise<{ source: string; results: UnifiedSearchResult[]; error?: string }> {
  try {
    const nigpCodes = texasEsbdNigpCodes(query);
    const batches = await runLimited(
      agencySource.agencyNumbers.flatMap((agencyNumber) =>
        nigpCodes.length > 0
          ? nigpCodes.map((nigp) => () => fetchTexasEsbdBatch({ agencyNumber, nigp, status: TEXAS_ESBD_ACTIVE_STATUS }))
          : [() => fetchTexasEsbdPages({ agencyNumber, status: TEXAS_ESBD_ACTIVE_STATUS }, TEXAS_ESBD_DEFAULT_RECENT_PAGES)],
      ),
      4,
    );

    const rowsById = new Map<string, TexasEsbdLine>();
    const allowedAgencyNumbers = new Set(agencySource.agencyNumbers.map((agencyNumber) => agencyNumber.toUpperCase()));
    for (const batch of batches) {
      for (const line of batch.lines) {
        if (!line.agencyNumber || !allowedAgencyNumbers.has(line.agencyNumber.toUpperCase())) {
          continue;
        }

        const key = line.solicitationId || line.internalid || `${line.title}:${line.responseDue}`;
        if (key) {
          rowsById.set(key, line);
        }
      }
    }

    return {
      source: agencySource.sourceName,
      results: parseTexasEsbdLines(Array.from(rowsById.values()), query, {
        sourceName: agencySource.sourceName,
        buyerFallback: agencySource.buyer,
      }),
      error: batches.find((batch) => batch.error)?.error,
    };
  } catch (error) {
    return { source: agencySource.sourceName, results: [], error: errorMessage(error) };
  }
}

type TexasEsbdLine = {
  internalid?: string;
  title?: string;
  solicitationId?: string;
  responseDue?: string;
  responseTime?: string;
  agencyNumber?: string;
  agencyName?: string;
  status?: string;
  statusName?: string;
  postingDate?: string;
  created?: string;
  lastModified?: string;
  nigpCodes?: string;
  repostURL?: string;
  url?: string;
};

type TexasEsbdResponse = {
  lines?: TexasEsbdLine[];
  page?: number;
  recordsPerPage?: number;
  totalRecordsFound?: number;
};

async function fetchTexasEsbdBatch(params: Record<string, string>) {
  const firstPage = await fetchTexasEsbdPage({ ...params, page: "1", urlRoot: "esbd" });
  if (firstPage.error) {
    return { lines: [], error: firstPage.error };
  }

  const totalRecords = firstPage.data.totalRecordsFound ?? firstPage.data.lines?.length ?? 0;
  const recordsPerPage = firstPage.data.recordsPerPage || 24;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const remainingPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);
  const remaining = await runLimited(
    remainingPages.map((page) => () => fetchTexasEsbdPage({ ...params, page: String(page), urlRoot: "esbd" })),
    4,
  );

  return {
    lines: [firstPage.data, ...remaining.filter((page) => !page.error).map((page) => page.data)].flatMap((page) => page.lines ?? []),
    error: remaining.find((page) => page.error)?.error,
  };
}

async function fetchTexasEsbdPages(params: Record<string, string>, pageCount: number) {
  const pages = await runLimited(
    Array.from({ length: pageCount }, (_, index) => () => fetchTexasEsbdPage({ ...params, page: String(index + 1), urlRoot: "esbd" })),
    4,
  );

  return {
    lines: pages.filter((page) => !page.error).flatMap((page) => page.data.lines ?? []),
    error: pages.find((page) => page.error)?.error,
  };
}

async function fetchTexasEsbdPage(payload: Record<string, string>): Promise<{ data: TexasEsbdResponse; error?: string }> {
  const controller = new AbortController();
  const timeout = windowlessTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(TEXAS_ESBD_SERVICE_URL, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "X-SC-Touchpoint": "shopping",
        Origin: "https://www.txsmartbuy.gov",
        Referer: TEXAS_ESBD_URL,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { data: {}, error: `official ESBD service returned ${response.status}` };
    }

    const data = (await response.json()) as TexasEsbdResponse & { errorStatusCode?: string; errorMessage?: string };
    if (data.errorStatusCode) {
      return { data: {}, error: data.errorMessage ?? `official ESBD service returned ${data.errorStatusCode}` };
    }

    return { data };
  } catch (error) {
    return { data: {}, error: errorMessage(error).replace("8 seconds", "15 seconds") };
  } finally {
    clearTimeout(timeout);
  }
}

function texasEsbdNigpCodes(query: string) {
  const terms = conceptTerms(query);
  const codes = new Set<string>();

  for (const mapping of TEXAS_ESBD_NIGP_CODES_BY_CONCEPT) {
    if (mapping.terms.some((term) => terms.includes(term))) {
      mapping.codes.forEach((code) => codes.add(code));
    }
  }

  return Array.from(codes);
}

function parseTexasEsbdLines(
  lines: TexasEsbdLine[],
  query: string,
  options: { sourceName?: string; buyerFallback?: string } = {},
): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return lines
    .map((line, index) => texasEsbdLineToResult(line, terms, index, options))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchTennesseePage(
  query: string,
  source: string,
  url: string,
  kind: string,
): Promise<{ source: string; results: UnifiedSearchResult[]; error?: string }> {
  try {
    const response = await fetchPublicPage(url);

    if (!response.ok) {
      return { source, results: [], error: `returned ${response.status}` };
    }

    const html = await response.text();
    return {
      source,
      results: parseTennesseeTable(html, query, source, url, kind),
    };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseTennesseeTable(html: string, query: string, source: string, portalUrl: string, kind: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<tr>([\s\S]*?)<\/tr>/g));

  return rows
    .map((row, index) => tennesseeRowToResult(row[1], terms, index, source, portalUrl, kind))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function tennesseeRowToResult(
  row: string,
  terms: string[],
  index: number,
  source: string,
  portalUrl: string,
  kind: string,
): UnifiedSearchResult | undefined {
  const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((match) => match[1]);
  if (cells.length < 3) {
    return undefined;
  }

  const linkMatch = cells[0].match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (!linkMatch) {
    return undefined;
  }

  const solicitationId = cleanText(linkMatch[2]);
  const documentUrl = new URL(linkMatch[1], portalUrl).toString();
  const dates = cleanText(cells[1]).split(/\s+/).filter(Boolean);
  const postedDate = dates[0];
  const deadline = dates.slice(1).join(" ");
  const description = cleanText(cells[2]);
  const linkText = cleanText(cells[0]);
  const title = description ? `${solicitationId}: ${description}` : solicitationId;
  const haystack = [title, linkText, postedDate, deadline, source, kind].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 75 - index);

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `tn:${source}:${solicitationId}:${title}`,
    resultType: "opportunity",
    title,
    buyer: "Tennessee Central Procurement Office",
    sourceName: source,
    sourceLevel: "State",
    sourceState: "TN",
    sourceType: `${kind} public opportunity page`,
    url: documentUrl,
    portalUrl,
    score,
    status: "Open/public posting",
    solicitationId,
    deadline,
    postedDate,
    submissionInstructions: "Open the Tennessee posting document and follow the stated response instructions, required attachments, and due date.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: false }),
    summary: [solicitationId ? `Solicitation ${solicitationId}.` : "", postedDate ? `Posted ${postedDate}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the Tennessee posting document, confirm scope and due date, then add it to the tracker for human review.",
  };
}

function texasRowToResult(row: string, terms: string[], index: number): UnifiedSearchResult | undefined {
  const titleMatch = row.match(/<div class="esbd-result-title"><a href="([^"]+)">\s*([\s\S]*?)\s*<\/a>/);
  if (!titleMatch) {
    return undefined;
  }

  const title = cleanText(titleMatch[2]);
  const href = titleMatch[1];
  const labels = Object.fromEntries(
    Array.from(row.matchAll(/<strong>([^<]+)<\/strong>\s*([\s\S]*?)(?=<strong>|$)/g)).map((match) => [
      cleanText(match[1]).replace(/:$/, ""),
      cleanText(match[2]),
    ]),
  );
  const solicitationId = labels["Solicitation ID"];
  const deadline = [labels["Due Date"], labels["Due Time"]].filter(Boolean).join(" ");
  const buyer = labels["Agency/Texas SmartBuy Member Number"] ? `Agency/member ${labels["Agency/Texas SmartBuy Member Number"]}` : "Texas ESBD";
  const status = labels.Status ?? "Opportunity";
  const haystack = [title, solicitationId, buyer, status, labels["Posting Date"]].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 80 - index);

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (status.toLowerCase().includes("closed") || isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `tx-esbd:${solicitationId ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer,
    sourceName: "Texas ESBD",
    sourceLevel: "State",
    sourceState: "TX",
    sourceType: "Public opportunity page",
    url: new URL(href, TEXAS_ESBD_URL).toString(),
    portalUrl: TEXAS_ESBD_URL,
    score,
    status,
    solicitationId,
    deadline,
    postedDate: labels["Posting Date"],
    submissionInstructions: "Open the ESBD posting, download every solicitation/addendum file, confirm vendor-registration requirements, and follow the buyer's stated submission rules.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: Boolean(buyer) }),
    summary: [solicitationId ? `Solicitation ${solicitationId}.` : "", labels["Posting Date"] ? `Posted ${labels["Posting Date"]}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the ESBD posting, confirm scope and submission rules, then add it to the tracker for human review.",
  };
}

function texasEsbdLineToResult(
  line: TexasEsbdLine,
  terms: string[],
  index: number,
  options: { sourceName?: string; buyerFallback?: string } = {},
): UnifiedSearchResult | undefined {
  const title = line.title?.trim() || "Untitled ESBD opportunity";
  const solicitationId = line.solicitationId?.trim();
  const deadline = [line.responseDue, line.responseTime].filter(Boolean).join(" ");
  const buyer = line.agencyName || options.buyerFallback || (line.agencyNumber ? `Agency/member ${line.agencyNumber}` : "Texas ESBD");
  const status = line.statusName || "Opportunity";
  const haystack = [title, solicitationId, buyer, status, line.postingDate, line.nigpCodes].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 90 - Math.min(index, 40));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (status.toLowerCase().includes("closed") || isPastDeadline(deadline)) {
    return undefined;
  }

  const url = line.url || line.repostURL || (solicitationId ? `/esbd/${encodeURIComponent(solicitationId)}` : TEXAS_ESBD_URL);

  return {
    id: `tx-esbd:${solicitationId ?? line.internalid ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer,
    sourceName: options.sourceName ?? "Texas ESBD",
    sourceLevel: "State",
    sourceState: "TX",
    sourceType: "Official ESBD service",
    url: new URL(url, TEXAS_ESBD_URL).toString(),
    portalUrl: TEXAS_ESBD_URL,
    score,
    status,
    solicitationId,
    deadline,
    postedDate: line.postingDate,
    documents: line.nigpCodes ? [`NIGP: ${line.nigpCodes}`] : [],
    submissionInstructions: "Open the ESBD posting, download every solicitation/addendum file, confirm vendor-registration requirements, and follow the buyer's stated submission rules.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: Boolean(buyer) }),
    summary: [
      solicitationId ? `Solicitation ${solicitationId}.` : "",
      line.postingDate ? `Posted ${line.postingDate}.` : "",
      line.nigpCodes ? `NIGP: ${line.nigpCodes}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the ESBD posting, confirm scope and submission rules, then add it to the tracker for human review.",
  };
}

type BonfireProject = {
  ProjectID?: string;
  PrivateProjectID?: string;
  ReferenceID?: string;
  ProjectName?: string;
  DateClose?: string;
  DepartmentID?: string;
};
type OpenGovProject = {
  id?: number;
  financialId?: string;
  title?: string;
  status?: string;
  summary?: string;
  proposalDeadline?: string;
  releaseProjectDate?: string;
  department?: { name?: string };
  government?: { organization?: { name?: string; phone?: string } };
  template?: { title?: string };
  addendums?: unknown[];
};

async function searchBonfire(query: string, source: BonfireSource): Promise<SearchTaskResult> {
  try {
    const cacheKey = `bonfire:${source.sourceName}:${query.toLowerCase()}`;
    const cached = bonfireCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { source: source.sourceName, ...cached.value };
    }

    const existingRequest = bonfireInFlight.get(cacheKey);
    if (existingRequest) {
      return { source: source.sourceName, ...(await existingRequest) };
    }

    const request = getBonfireProjects(source)
      .then((value) => ({
        results: value.projects ? parseBonfireProjects(value.projects, query, source) : value.results,
        error: value.error,
      }))
      .finally(() => {
        bonfireInFlight.delete(cacheKey);
      });
    bonfireInFlight.set(cacheKey, request);

    const value = await request;
    const ttl = value.error?.includes("rate limited")
      ? BONFIRE_RATE_LIMIT_CACHE_MS
      : value.error
        ? BONFIRE_ERROR_CACHE_MS
        : BONFIRE_SUCCESS_CACHE_MS;
    bonfireCache.set(cacheKey, { expiresAt: Date.now() + ttl, value });

    return { source: source.sourceName, ...value };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function getBonfireProjects(source: BonfireSource): Promise<ConnectorSearchResult & { projects?: BonfireProject[] }> {
  const cacheKey = `bonfire-projects:${source.sourceName}`;
  const cached = bonfireProjectsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { results: [], projects: cached.projects };
  }

  const existingRequest = bonfireProjectsInFlight.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = runBonfireQueued(() => fetchBonfireProjects(source)).finally(() => {
    bonfireProjectsInFlight.delete(cacheKey);
  });
  bonfireProjectsInFlight.set(cacheKey, request);

  const value = await request;
  if (value.projects) {
    bonfireProjectsCache.set(cacheKey, { expiresAt: Date.now() + BONFIRE_SUCCESS_CACHE_MS, projects: value.projects });
  }

  return value;
}

async function fetchBonfireProjects(source: BonfireSource): Promise<ConnectorSearchResult & { projects?: BonfireProject[] }> {
  try {
    const endpoint = new URL("/PublicPortal/getOpenPublicOpportunitiesSectionData", source.portalUrl).toString();
    const response = await fetchWithTimeout(
      endpoint,
      {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        Referer: source.portalUrl,
      },
      cache: "no-store",
      },
      BONFIRE_FETCH_TIMEOUT_MS,
    );

    if (response.status === 429) {
      return { results: [], error: "Bonfire rate limited the portal request; connector is queued and cached, retry after cooldown." };
    }

    if (!response.ok) {
      return { results: [], error: `Bonfire API returned ${response.status}` };
    }

    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
      payload?: { projects?: Record<string, BonfireProject> | BonfireProject[] };
    };
    if (data.success === false) {
      return { results: [], error: data.message || "Bonfire API returned an unsuccessful response" };
    }

    const projectsPayload = data.payload?.projects ?? {};
    const projects = Array.isArray(projectsPayload) ? projectsPayload : Object.values(projectsPayload);
    return { results: [], projects };
  } catch (error) {
    return { results: [], error: errorMessage(error) };
  }
}

async function searchIonWave(query: string, source: IonWaveSource): Promise<SearchTaskResult> {
  try {
    const cacheKey = `ionwave:${source.sourceName}:${query.toLowerCase()}`;
    const cached = ionWaveCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { source: source.sourceName, ...cached.value };
    }

    const existingRequest = ionWaveInFlight.get(cacheKey);
    if (existingRequest) {
      return { source: source.sourceName, ...(await existingRequest) };
    }

    const request = runIonWaveQueued(() => fetchIonWaveCurrentBids(query, source)).finally(() => {
      ionWaveInFlight.delete(cacheKey);
    });
    ionWaveInFlight.set(cacheKey, request);

    const value = await request;
    const ttl = value.error?.includes("rate limited")
      ? IONWAVE_RATE_LIMIT_CACHE_MS
      : value.error
        ? IONWAVE_ERROR_CACHE_MS
        : IONWAVE_SUCCESS_CACHE_MS;
    ionWaveCache.set(cacheKey, { expiresAt: Date.now() + ttl, value });

    return { source: source.sourceName, ...value };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function fetchIonWaveCurrentBids(query: string, source: IonWaveSource): Promise<ConnectorSearchResult> {
  const cachedPage = ionWavePageCache.get(source.currentBidsUrl);
  if (cachedPage && cachedPage.expiresAt > Date.now()) {
    return { results: parseIonWaveRows(cachedPage.html, query, source) };
  }

  const response = await fetchWithTimeout(
    source.currentBidsUrl,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: source.portalUrl,
      },
      cache: "no-store",
    },
    IONWAVE_FETCH_TIMEOUT_MS,
  );

  if (response.status === 429) {
    return { results: [], error: "IonWave rate limited the public bid table; connector is queued and cached, retry after cooldown." };
  }

  if (!response.ok) {
    return { results: [], error: `IonWave public bid table returned ${response.status}` };
  }

  const html = await response.text();
  ionWavePageCache.set(source.currentBidsUrl, { expiresAt: Date.now() + IONWAVE_SUCCESS_CACHE_MS, html });
  return { results: parseIonWaveRows(html, query, source) };
}

function parseIonWaveRows(html: string, query: string, source: IonWaveSource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<tr\b[^>]*class=(["'])[^"']*\brg(?:Alt)?Row\b[^"']*\1[^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index) => ionWaveRowToResult(row[2], terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function ionWaveRowToResult(rowHtml: string, terms: string[], index: number, source: IonWaveSource): UnifiedSearchResult | undefined {
  const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((match) => cleanText(match[1]));
  if (cells.length < 6) {
    return undefined;
  }

  const visibleCells = cells.filter((cell) => cell.length > 0);
  const solicitationId = visibleCells[0];
  const bidTitle = visibleCells[1];
  const bidType = visibleCells[2];
  const organization = visibleCells.length >= 6 ? visibleCells[3] : undefined;
  const postedDate = visibleCells.length >= 6 ? visibleCells[4] : visibleCells[3];
  const deadline = visibleCells.length >= 6 ? visibleCells[5] : visibleCells[4];
  const title = [bidType, solicitationId, bidTitle].filter(Boolean).join(" ");
  const haystack = [title, source.buyer, organization, postedDate, deadline].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 76 - Math.min(index, 40));

  if (!solicitationId || !bidTitle) {
    return undefined;
  }

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `ionwave:${source.sourceName}:${solicitationId}:${bidTitle}`,
    resultType: "opportunity",
    title,
    buyer: source.buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: "TX",
    sourceType: "IonWave public bid table",
    url: source.currentBidsUrl,
    portalUrl: source.portalUrl,
    score,
    status: "Open public bid",
    solicitationId,
    deadline,
    postedDate,
    submissionInstructions:
      "Open the IonWave current-bids table, register or sign in if required, download the bid packet and addenda, then submit through IonWave before the close date.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: true, hasDeadline: Boolean(deadline), hasDocuments: false, hasContact: false }),
    summary: [bidType ? `${bidType} opportunity.` : "", postedDate ? `Issued ${postedDate}.` : "", deadline ? `Closes ${deadline}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the IonWave posting, confirm scope and submission rules, then route it for human review.",
  };
}

function parseBonfireProjects(projects: BonfireProject[], query: string, source: BonfireSource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return projects
    .map((project, index) => bonfireProjectToResult(project, terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function bonfireProjectToResult(
  project: BonfireProject,
  terms: string[],
  index: number,
  source: BonfireSource,
): UnifiedSearchResult | undefined {
  const title = project.ProjectName?.trim() || "Untitled Bonfire opportunity";
  const solicitationId = project.ReferenceID?.trim();
  const deadline = project.DateClose?.trim();
  const haystack = [title, solicitationId, source.buyer].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 78 - Math.min(index, 40));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const projectUrl = project.ProjectID ? new URL(`/opportunities/${project.ProjectID}`, source.portalUrl).toString() : source.portalUrl;

  return {
    id: `bonfire:${source.sourceName}:${project.ProjectID ?? solicitationId ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer: source.buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: "TX",
    sourceType: "Bonfire official API",
    url: projectUrl,
    portalUrl: source.portalUrl,
    score,
    status: "Open public opportunity",
    solicitationId,
    deadline,
    submissionInstructions: "Open the Bonfire opportunity, log in or register if required, review all project files and addenda, then submit through Bonfire before the close date.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: false }),
    summary: [solicitationId ? `Reference ${solicitationId}.` : "", deadline ? `Closes ${deadline}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the Bonfire opportunity, confirm scope and submission rules, then route it for human review.",
  };
}

async function searchOpenGov(query: string, source: OpenGovSource): Promise<SearchTaskResult> {
  try {
    const cacheKey = `opengov:${source.sourceName}:${query.toLowerCase()}`;
    const cached = openGovCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { source: source.sourceName, ...cached.value };
    }

    const existingRequest = openGovInFlight.get(cacheKey);
    if (existingRequest) {
      return { source: source.sourceName, ...(await existingRequest) };
    }

    const request: Promise<ConnectorSearchResult> = fetchOpenGovProjects(source)
      .then((projects) => ({ results: parseOpenGovProjects(projects, query, source) }))
      .finally(() => {
        openGovInFlight.delete(cacheKey);
      });
    openGovInFlight.set(cacheKey, request);

    const value = await request;
    openGovCache.set(cacheKey, {
      expiresAt: Date.now() + (value.error ? OPENGOV_ERROR_CACHE_MS : OPENGOV_SUCCESS_CACHE_MS),
      value,
    });

    return { source: source.sourceName, ...value };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function fetchOpenGovProjects(source: OpenGovSource): Promise<OpenGovProject[]> {
  const url = `https://procurement.opengov.com/portal/embed/${source.portalCode}/project-list?departmentId=all&status=open`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: source.portalUrl,
      },
      cache: "no-store",
    },
    OPENGOV_FETCH_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`OpenGov portal returned ${response.status}`);
  }

  return extractOpenGovProjectRows(await response.text());
}

function extractOpenGovProjectRows(html: string): OpenGovProject[] {
  const govProjectsIndex = html.indexOf("\"govProjects\"");
  if (govProjectsIndex < 0) {
    throw new Error("OpenGov state did not include public project data");
  }

  const rowsIndex = html.indexOf("\"rows\":[", govProjectsIndex);
  if (rowsIndex < 0) {
    return [];
  }

  const arrayStart = html.indexOf("[", rowsIndex);
  const arrayEnd = findJsonArrayEnd(html, arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) {
    throw new Error("OpenGov project rows could not be parsed");
  }

  return JSON.parse(html.slice(arrayStart, arrayEnd + 1)) as OpenGovProject[];
}

function parseOpenGovProjects(projects: OpenGovProject[], query: string, source: OpenGovSource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return projects
    .map((project, index) => openGovProjectToResult(project, terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function openGovProjectToResult(
  project: OpenGovProject,
  terms: string[],
  index: number,
  source: OpenGovSource,
): UnifiedSearchResult | undefined {
  const title = project.title?.trim();
  if (!title || project.status?.toLowerCase() !== "open") {
    return undefined;
  }

  const summary = htmlToText(project.summary ?? "");
  const solicitationId = project.financialId?.trim();
  const deadline = formatOpenGovDate(project.proposalDeadline);
  const postedDate = formatOpenGovDate(project.releaseProjectDate);
  const buyer = project.government?.organization?.name?.trim() || source.buyer;
  const department = project.department?.name?.trim();
  const procurementType = project.template?.title?.trim();
  const haystack = [title, summary, solicitationId, buyer, department, procurementType].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 80 - Math.min(index, 40));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const documents = [
    procurementType ? `Procurement type: ${procurementType}` : undefined,
    department ? `Department: ${department}` : undefined,
    project.addendums?.length ? `${project.addendums.length} addendum/addenda posted` : undefined,
  ].filter((item): item is string => Boolean(item));
  const projectUrl = project.id ? `${source.portalUrl}/projects/${project.id}` : source.portalUrl;

  return {
    id: `opengov:${source.sourceName}:${project.id ?? solicitationId ?? title}`,
    resultType: "opportunity",
    title: [procurementType, solicitationId, title].filter(Boolean).join(" "),
    buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: "TX",
    sourceType: "OpenGov public portal",
    url: projectUrl,
    portalUrl: source.portalUrl,
    score,
    status: "Open public opportunity",
    solicitationId,
    deadline,
    postedDate,
    contact: project.government?.organization?.phone,
    documents,
    submissionInstructions:
      "Open the OpenGov posting, create or sign in to the vendor account if required, download the solicitation documents and addenda, then submit through OpenGov before the close date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: documents.length > 0,
      hasContact: Boolean(project.government?.organization?.phone),
    }),
    summary: [summary, department ? `Department: ${department}.` : "", deadline ? `Closes ${deadline}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the OpenGov posting, confirm the scope and required attachments, then route it for human review.",
  };
}

async function searchAustinSolicitations(query: string): Promise<SearchTaskResult> {
  const source = "City of Austin Purchasing";
  try {
    const response = await fetchPublicPage(AUSTIN_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Austin Finance Online returned ${response.status}` };
    }

    const html = await response.text();
    const detailUrls = extractAustinSolicitationUrls(html).slice(0, 40);
    const detailPages = await runLimited(
      detailUrls.map((url) => async () => {
        try {
          const detailResponse = await fetchPublicPage(url);
          return detailResponse.ok ? { url, html: await detailResponse.text() } : undefined;
        } catch {
          return undefined;
        }
      }),
      4,
    );

    return {
      source,
      results: parseAustinSolicitationDetails(
        detailPages.filter((page): page is { url: string; html: string } => Boolean(page)),
        query,
      ),
    };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function extractAustinSolicitationUrls(html: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/href=(["'])(solicitation_details\.cfm\?sid=\d+)\1/gi)) {
    urls.add(new URL(decodeHtml(match[2]), AUSTIN_SOLICITATIONS_URL).toString());
  }

  return Array.from(urls);
}

function parseAustinSolicitationDetails(pages: Array<{ url: string; html: string }>, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return pages
    .map((page, index) => austinDetailToResult(page, terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function austinDetailToResult(page: { url: string; html: string }, terms: string[], index: number): UnifiedSearchResult | undefined {
  const text = htmlToText(page.html);
  const solicitationId = text.match(/Solicitation Number:\s*([A-Z0-9 -]+?)(?=\s+Description:)/i)?.[1]?.trim();
  const description = text.match(/Description:\s*([\s\S]*?)(?=\s+Summary:)/i)?.[1]?.trim();
  const summary = text.match(/Summary:\s*([\s\S]*?)(?=\s+My eResponse|\s+Basic Information)/i)?.[1]?.trim();
  const status = text.match(/Status:\s*([A-Za-z ]+?)(?=\s+Solicitation Number:)/i)?.[1]?.trim() || "Open";
  const deadline = text.match(/Response Due:\s*(Prior to\s*)?([^R]+?)(?=\s+Response Opening:|\s+Special Notes)/i)?.[2]?.trim();
  const contact = text.match(/Solicitation Specific Questions:\s*([\s\S]*?)(?=\s+Small Minority Business Resources Questions:|\s+Dates & Times)/i)?.[1]?.trim();
  const documents = Array.from(page.html.matchAll(/File Description\s*([\s\S]*?)\s+(?:pdf|docx|xlsx|xls|zip)\s+\d{2}\/\d{2}\/\d{4}/gi))
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .slice(0, 8);
  const title = [solicitationId, description].filter(Boolean).join(": ") || "City of Austin solicitation";
  const haystack = [title, summary, status].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 72 - Math.min(index, 35));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (status.toLowerCase().includes("closed") || isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `austin:${solicitationId ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer: "City of Austin",
    sourceName: "City of Austin Purchasing",
    sourceLevel: "Local",
    sourceState: "TX",
    sourceType: "Austin Finance Online",
    url: page.url,
    portalUrl: AUSTIN_SOLICITATIONS_URL,
    score,
    status,
    solicitationId,
    deadline,
    contact,
    documents,
    submissionInstructions: "Create or sign into Austin Finance Online, review the solicitation packet and attachments, then submit the eResponse before the response due time.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: documents.length > 0, hasContact: Boolean(contact) }),
    summary: summary || [solicitationId ? `Solicitation ${solicitationId}.` : "", deadline ? `Response due ${deadline}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the Austin Finance Online solicitation, confirm scope and due date, then route it for human review.",
  };
}

async function searchFriscoCurrentBids(query: string): Promise<SearchTaskResult> {
  const source = "City of Frisco Purchasing";
  try {
    const response = await fetchPublicPage(FRISCO_CURRENT_BIDS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Frisco current bids returned ${response.status}` };
    }

    const html = await response.text();
    return { source, results: parseFriscoCurrentBids(html, query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseFriscoCurrentBids(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const entries = Array.from(html.matchAll(/<li[^>]*class="[^"]*widgetItem[\s\S]*?<\/li>/gi));

  return entries
    .map((entry, index) => friscoCurrentBidToResult(entry[0], terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function friscoCurrentBidToResult(entryHtml: string, terms: string[], index: number): UnifiedSearchResult | undefined {
  const linkMatch = entryHtml.match(/<a[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
  if (!linkMatch) {
    return undefined;
  }

  const title = cleanText(linkMatch[3]);
  const url = safeAbsoluteUrl(decodeHtml(linkMatch[2]), FRISCO_CURRENT_BIDS_URL) ?? FRISCO_CURRENT_BIDS_URL;
  const description = cleanText(entryHtml.match(/<p[^>]*class="[^"]*widgetDesc[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const referenceId = title.match(/Reference #:\s*([^\.]+)\./i)?.[1]?.trim();
  const deadline = description.match(/Project closes\s+([^\.]+)\./i)?.[1]?.trim();
  const haystack = [title, description].filter(Boolean).join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 70 - Math.min(index, 20));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `frisco:${referenceId ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer: "City of Frisco",
    sourceName: "City of Frisco Purchasing",
    sourceLevel: "Local",
    sourceState: "TX",
    sourceType: "Official current bids page",
    url,
    portalUrl: FRISCO_CURRENT_BIDS_URL,
    score,
    status: "Open/current bid",
    solicitationId: referenceId,
    deadline,
    submissionInstructions: "Open the Frisco posting, review the linked Bonfire opportunity and attached files, then submit through the stated portal before close.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(referenceId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: false }),
    summary: description,
    nextAction: "Open the Frisco posting, confirm scope and submission rules, then route it for human review.",
  };
}

async function searchOfficialSource(query: string, source: ProcurementSource): Promise<SearchTaskResult> {
  try {
    const page = await fetchSourcePage(source);

    if (page.error) {
      return { source: source.source_name, results: [], error: page.error };
    }

    return {
      source: source.source_name,
      results: parseOfficialSourcePage(page.html, query, { ...source, url: page.url }),
    };
  } catch (error) {
    return { source: source.source_name, results: [], error: errorMessage(error) };
  }
}

async function fetchSourcePage(source: ProcurementSource): Promise<{ url: string; html: string; error?: string }> {
  try {
    const response = await fetchPublicPage(source.url);
    if (response.ok) {
      return { url: source.url, html: await response.text() };
    }

    const discovered = await discoverProcurementPage(source);
    if (discovered) {
      return discovered;
    }

    return { url: source.url, html: "", error: `returned ${response.status}` };
  } catch (error) {
    const discovered = await discoverProcurementPage(source);
    if (discovered) {
      return discovered;
    }

    return { url: source.url, html: "", error: errorMessage(error) };
  }
}

async function discoverProcurementPage(source: ProcurementSource) {
  const origin = safeOrigin(source.url);
  if (!origin) {
    return undefined;
  }

  try {
    const response = await fetchPublicPage(origin);
    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const candidateUrls = extractProcurementPageCandidates(html, origin);
    for (const candidateUrl of candidateUrls.slice(0, 6)) {
      try {
        const candidateResponse = await fetchPublicPage(candidateUrl);
        if (candidateResponse.ok) {
          return { url: candidateUrl, html: await candidateResponse.text() };
        }
      } catch {
        // Try the next discovered candidate.
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function extractProcurementPageCandidates(html: string, baseUrl: string) {
  const anchors = Array.from(html.matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi));
  const seen = new Set<string>();
  const candidates: Array<{ url: string; score: number }> = [];

  for (const anchor of anchors) {
    const href = decodeHtml(anchor[2]).trim();
    const text = cleanText(anchor[3]);
    const haystack = `${text} ${href}`.toLowerCase();
    if (!/\b(procurement|purchasing|vendor|supplier|bid|bids|rfp|rfq|solicitation|business)\b/i.test(haystack)) {
      continue;
    }

    const url = safeAbsoluteUrl(href, baseUrl);
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    const score = ["procurement", "purchasing", "bid", "rfp", "solicitation", "vendor", "supplier", "business"].reduce(
      (total, word) => total + (haystack.includes(word) ? 1 : 0),
      0,
    );
    candidates.push({ url, score });
  }

  return candidates.sort((a, b) => b.score - a.score).map((candidate) => candidate.url);
}

function parseOfficialSourcePage(html: string, query: string, source: ProcurementSource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  return extractOpportunityLinks(html, query, source, terms);
}

function extractOpportunityLinks(html: string, query: string, source: ProcurementSource, terms: string[]) {
  const anchors = Array.from(html.matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi));
  const results: UnifiedSearchResult[] = [];
  const seen = new Set<string>();

  anchors.forEach((anchor, index) => {
    const href = decodeHtml(anchor[2]).trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return;
    }

    const linkText = cleanText(anchor[3]);
    const haystack = [linkText, href].filter(Boolean).join(" ").toLowerCase();
    const score = scoreOpportunity(haystack, terms, 50 - Math.min(index, 30));
    if (score <= 0 || !hasOpportunityLanguage(haystack)) {
      return;
    }

    const url = safeAbsoluteUrl(href, source.url);
    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);
    results.push({
      id: `source-link:${source.source_name}:${url}`,
      resultType: "opportunity",
      title: linkText || `${source.source_name} matching procurement link`,
      buyer: source.source_name,
      sourceName: source.source_name,
      sourceLevel: source.level,
      sourceState: source.state,
      sourceType: `${source.source_type} official page`,
      url,
      portalUrl: source.url,
      score,
      status: "Official source checked",
      summary: `Matching procurement link found on the official ${source.source_name} page.`,
      nextAction: "Open the linked posting or portal, confirm current solicitation details, then route valid opportunities for human review.",
    });
  });

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 3);
}

function enrichSearchResult(result: UnifiedSearchResult, query: string): UnifiedSearchResult {
  const haystack = [
    result.title,
    result.summary,
    result.buyer,
    result.sourceName,
    result.sourceLevel,
    result.sourceType,
    result.status,
    result.solicitationId,
    result.documents?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const normalizedQuery = query.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  const matchedTerms = conceptTerms(query)
    .filter((term) => term.length > 2 && haystack.includes(term.toLowerCase()))
    .slice(0, 5);
  const fitReasons: string[] = [];
  const riskFlags: string[] = [];
  let fitScore = 32 + Math.min(14, Math.round(result.score / 12));

  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    fitScore += 24;
    fitReasons.push(`Strong match for "${normalizedQuery}".`);
  } else if (matchedTerms.length > 0) {
    fitScore += Math.min(22, matchedTerms.length * 6);
    fitReasons.push(`Matches ${matchedTerms.slice(0, 4).join(", ")}.`);
  }

  if (/official|api|esbd|bonfire|opengov/i.test(result.sourceType)) {
    fitScore += 8;
    fitReasons.push("Found through an official procurement source.");
  }

  if (result.deadline) {
    fitScore += 10;
    fitReasons.push(`Response deadline captured: ${result.deadline}.`);

    const daysLeft = daysUntilDeadline(result.deadline);
    if (daysLeft !== undefined && daysLeft <= 7) {
      fitScore -= 8;
      riskFlags.push(`Deadline is soon: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`);
    }
  } else {
    riskFlags.push("Deadline was not captured.");
  }

  if (result.solicitationId) {
    fitScore += 7;
    fitReasons.push(`Reference ID captured: ${result.solicitationId}.`);
  } else {
    riskFlags.push("Reference ID was not captured.");
  }

  if (result.documents?.length) {
    fitScore += 6;
    fitReasons.push("Document or classification data was captured.");
  } else {
    riskFlags.push("No document list was captured.");
  }

  if (result.contact) {
    fitScore += 4;
    fitReasons.push("Buyer/contact information was captured.");
  } else {
    riskFlags.push("Buyer contact was not captured.");
  }

  if (result.budget) {
    fitScore += 5;
    fitReasons.push(`Budget information captured: ${result.budget}.`);
  }

  if (result.summary.length > 100) {
    fitScore += 4;
  }

  return {
    ...result,
    score: Math.max(1, Math.min(100, Math.round(fitScore))),
    fitReasons: fitReasons.slice(0, 5),
    riskFlags: riskFlags.slice(0, 5),
  };
}

function sourceStatusFromTaskResult(result: SearchTaskResult): SourceSearchStatus {
  if (result.error) {
    const status = isPendingConnectorIssue(result.error) ? "pending" : "error";
    return {
      sourceName: result.source,
      status,
      message: connectorMessage(result.error),
      resultCount: result.results.length,
      durationMs: result.durationMs,
    };
  }

  return {
    sourceName: result.source,
    status: "ok",
    message: result.results.length > 0 ? "Search completed with matching opportunities." : "Search completed with no matching opportunities.",
    resultCount: result.results.length,
    durationMs: result.durationMs,
  };
}

function isPendingConnectorIssue(error: string) {
  return /rate limited|timed out|not completed/i.test(error);
}

function pendingSourceMessage(sourceName: string) {
  if (/sam\.gov/i.test(sourceName)) {
    return "Listed but not searched because the SAM.gov API key is not configured in this environment.";
  }

  if (SERVER_BLOCKED_SOURCE_NAMES.has(sourceName)) {
    return "Official page blocks Vercel/server-side fetching; use a vendor alert/email ingestion or browser collector before marking this source live.";
  }

  return "Listed in the source directory, but live search for this source is not wired yet.";
}

function connectorMessage(error: string) {
  if (/rate limited/i.test(error)) {
    return "Rate limited by the source; cached cooldown is active.";
  }

  if (/timed out|not completed/i.test(error)) {
    return "Timed out before this source finished; partial results were returned.";
  }

  if (/returned 403|forbidden/i.test(error)) {
    return "Blocked by the source with a 403 response.";
  }

  if (/returned 404|not found/i.test(error)) {
    return "The source page or endpoint was not found.";
  }

  if (/missing/i.test(error) && /api/i.test(error)) {
    return "Required API configuration is missing.";
  }

  return error;
}

function scoreOpportunity(haystack: string, terms: string[], baseScore: number) {
  if (terms.length === 0) {
    return baseScore;
  }

  const phraseTerms = terms.filter((term) => term.includes(" "));
  const singleTerms = terms.filter((term) => !term.includes(" "));
  const phraseScore = phraseTerms.reduce((score, phrase) => score + (haystack.includes(phrase) ? 34 : 0), 0);
  const termScore = singleTerms.reduce((score, term) => score + (haystack.includes(term) ? 10 : 0), 0);
  const strategicScore = [
    "training",
    "leadership",
    "management",
    "supervisor",
    "education",
    "professional",
    "coaching",
    "workforce",
    "organizational",
    "learning",
    "development",
  ].reduce(
    (score, term) => score + (haystack.includes(term) ? 4 : 0),
    0,
  );

  return phraseScore + termScore > 0 ? phraseScore + termScore + strategicScore + baseScore : 0;
}

function resultRankScore(result: UnifiedSearchResult) {
  return (
    result.score +
    (result.deadline ? 8 : 0) +
    (result.solicitationId ? 6 : 0) +
    (result.documents?.length ? 5 : 0) +
    (result.contact ? 4 : 0) +
    (result.budget ? 4 : 0) +
    (result.summary.length > 80 ? 3 : 0)
  );
}

function dedupeResults(results: UnifiedSearchResult[]) {
  const deduped = new Map<string, UnifiedSearchResult>();

  for (const result of results) {
    const key = resultDedupKey(result);
    const existing = deduped.get(key);
    if (!existing || resultRankScore(result) > resultRankScore(existing)) {
      deduped.set(key, result);
    }
  }

  return Array.from(deduped.values());
}

function resultDedupKey(result: UnifiedSearchResult) {
  const normalizedSolicitation = result.solicitationId?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalizedSolicitation && normalizedSolicitation.length > 3) {
    return `${result.sourceState}:${normalizedSolicitation}`;
  }

  const normalizedUrl = result.url.toLowerCase().replace(/[?#].*$/, "");
  if (normalizedUrl && normalizedUrl !== result.portalUrl.toLowerCase()) {
    return normalizedUrl;
  }

  return `${result.sourceState}:${result.buyer}:${result.title}`.toLowerCase().replace(/\s+/g, " ");
}

function applicationChecklist({
  hasSolicitationId,
  hasDeadline,
  hasDocuments,
  hasContact,
}: {
  hasSolicitationId: boolean;
  hasDeadline: boolean;
  hasDocuments: boolean;
  hasContact: boolean;
}) {
  return [
    hasSolicitationId ? "Record the solicitation/reference ID in the opportunity tracker." : "Find and record the solicitation/reference ID from the portal.",
    hasDeadline ? "Confirm the response deadline and set an internal review deadline at least 48 hours earlier." : "Find the response deadline in the posting documents.",
    hasDocuments ? "Download the solicitation packet, addenda, forms, and pricing templates." : "Locate the solicitation packet and required forms in the portal.",
    hasContact ? "Save the buyer/contact information and question deadline." : "Find the buyer contact and deadline for written questions.",
    "Confirm vendor registration, login, insurance, certifications, and required representations.",
    "Draft the technical response, pricing, assumptions, exceptions, and required attachments for human review.",
  ];
}

function isPastDeadline(deadline?: string) {
  const parsed = parseDeadlineDate(deadline);
  if (!parsed) {
    return false;
  }

  const endOfDeadline = new Date(parsed);
  endOfDeadline.setHours(23, 59, 59, 999);
  return endOfDeadline.getTime() < Date.now();
}

function daysUntilDeadline(deadline?: string) {
  const parsed = parseDeadlineDate(deadline);
  if (!parsed) {
    return undefined;
  }

  const endOfDeadline = new Date(parsed);
  endOfDeadline.setHours(23, 59, 59, 999);
  return Math.ceil((endOfDeadline.getTime() - Date.now()) / 86_400_000);
}

function parseDeadlineDate(deadline?: string) {
  if (!deadline) {
    return undefined;
  }

  const isoLikeMatch = deadline.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoLikeMatch) {
    const year = Number(isoLikeMatch[1]);
    const month = Number(isoLikeMatch[2]);
    const day = Number(isoLikeMatch[3]);
    if (!year || !month || !day) {
      return undefined;
    }

    return new Date(year, month - 1, day);
  }

  const numericMatch = deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    const year = Number(numericMatch[3]);
    if (!month || !day || !year) {
      return undefined;
    }

    return new Date(year, month - 1, day);
  }

  const namedMatch = deadline.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i,
  );
  if (!namedMatch) {
    return undefined;
  }

  const month = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(namedMatch[1].toLowerCase());
  const day = Number(namedMatch[2]);
  const year = Number(namedMatch[3]);

  return month >= 0 && day && year ? new Date(year, month, day) : undefined;
}

function formatOpenGovDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

function findJsonArrayEnd(value: string, startIndex: number) {
  if (startIndex < 0 || value[startIndex] !== "[") {
    return -1;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function matchesFilter({
  sourceState,
  sourceLevel,
  state,
  level,
}: {
  sourceState: string;
  sourceLevel: string;
  state: string;
  level: string;
}) {
  const stateMatch = state === "All" || state === sourceState;
  const levelMatch = level === "All" || level === sourceLevel;
  return stateMatch && levelMatch;
}

async function runLimited<T>(tasks: Array<() => Promise<T>>, concurrency: number) {
  const results: T[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

async function runSearchTasks(tasks: SearchTask[], concurrency: number, budgetMs: number) {
  const results: SearchTaskResult[] = [];
  const completedSources = new Set<string>();
  let nextIndex = 0;
  let active = 0;
  let resolved = false;

  return new Promise<SearchTaskResult[]>((resolve) => {
    const finish = () => {
      if (resolved) {
        return;
      }

      resolved = true;
      const budgetErrors = tasks
        .filter((task) => !completedSources.has(task.source))
        .map((task) => ({
          source: task.source,
          results: [],
          error: `not completed within ${Math.round(budgetMs / 1000)} second search budget; returned partial results`,
        }));
      resolve([...results, ...budgetErrors]);
    };

    const timeout = windowlessTimeout(finish, budgetMs);

    const launch = () => {
      if (resolved) {
        return;
      }

      while (active < concurrency && nextIndex < tasks.length) {
        const task = tasks[nextIndex];
        nextIndex += 1;
        active += 1;

        withTaskTimeout(task.run(), task.source, Math.min(SEARCH_TASK_TIMEOUT_MS, Math.max(3000, budgetMs - 1000)))
          .then((result) => {
            if (!resolved) {
              results.push(result);
              completedSources.add(task.source);
            }
          })
          .catch((error) => {
            if (!resolved) {
              results.push({ source: task.source, results: [], error: errorMessage(error) });
              completedSources.add(task.source);
            }
          })
          .finally(() => {
            active -= 1;
            if (resolved) {
              return;
            }

            if (nextIndex >= tasks.length && active === 0) {
              clearTimeout(timeout);
              finish();
              return;
            }

            launch();
          });
      }
    };

    launch();
  });
}

async function withTaskTimeout(task: Promise<SearchTaskResult>, source: string, timeoutMs: number): Promise<SearchTaskResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();
  try {
    const result = await Promise.race([
      task,
      new Promise<SearchTaskResult>((resolve) => {
        timeout = windowlessTimeout(() => {
          resolve({
            source,
            results: [],
            durationMs: Date.now() - startedAt,
            error: `timed out after ${Math.round(timeoutMs / 1000)} seconds; returning partial search results`,
          });
        }, timeoutMs);
      }),
    ]);
    return { ...result, durationMs: result.durationMs ?? Date.now() - startedAt };
  } catch (error) {
    return { source, results: [], durationMs: Date.now() - startedAt, error: errorMessage(error) };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function runBonfireQueued<T>(task: () => Promise<T>): Promise<T> {
  const globalStore = globalThis as typeof globalThis & { __govContractFinderBonfireQueue?: Promise<void> };
  const previous = globalStore.__govContractFinderBonfireQueue ?? Promise.resolve();
  let release!: () => void;
  globalStore.__govContractFinderBonfireQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    await delay(BONFIRE_QUEUE_GAP_MS);
    release();
  }
}

async function runIonWaveQueued<T>(task: () => Promise<T>): Promise<T> {
  const globalStore = globalThis as typeof globalThis & { __govContractFinderIonWaveQueue?: Promise<void> };
  const previous = globalStore.__govContractFinderIonWaveQueue ?? Promise.resolve();
  let release!: () => void;
  globalStore.__govContractFinderIonWaveQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    await delay(IONWAVE_QUEUE_GAP_MS);
    release();
  }
}

function removePending(pendingSources: string[], sourceName: string) {
  const index = pendingSources.findIndex((source) => source === sourceName);
  if (index >= 0) {
    pendingSources.splice(index, 1);
  }
}

function hasOpportunityLanguage(value: string) {
  return /\b(bid|bids|rfp|rfq|rfi|itb|solicitation|solicitations)\b/i.test(value);
}

function safeAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function htmlToText(html: string) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " "),
  );
}

async function fetchPublicPage(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchPublicPageOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(250 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchPublicPageOnce(url: string) {
  const controller = new AbortController();
  const timeout = windowlessTimeout(() => controller.abort(), 8000);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = windowlessTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function windowlessTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return error.name === "AbortError" ? "timed out after 8 seconds" : `${error.message}${cause}`;
  }

  return "search failed";
}

function cleanText(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatSamDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getGlobalMap<T>(key: string): Map<string, T> {
  const globalStore = globalThis as typeof globalThis & Record<string, Map<string, T> | undefined>;
  globalStore[key] ??= new Map<string, T>();
  return globalStore[key];
}
