import "server-only";

import { conceptTerms, samSearchUrl } from "@/lib/gov-search";
import type { OpportunityDocumentLink, ProcurementSource, SourceSearchStatus, UnifiedSearchResult } from "@/lib/gov-types";

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
type ResultQualityTier = NonNullable<UnifiedSearchResult["qualityTier"]>;
type BeaconDateValue = { utcDate?: string; specifiedZone?: string } | string | null | undefined;
type BeaconDocument = { name?: string; detail?: string; key?: string; type?: string; bytes?: number };
type BeaconContact = { name?: string; email?: string; phone?: string };
type BeaconSolicitation = {
  id?: string;
  refnum?: string;
  title?: string;
  status?: string;
  type?: string;
  issueDate?: BeaconDateValue;
  dueDate?: BeaconDateValue;
  description?: { html?: string } | string | null;
  documents?: BeaconDocument[];
  primaryContact?: BeaconContact | null;
  additionalContacts?: BeaconContact[];
  agency?: {
    id?: string;
    tag?: string;
    name?: string;
    location?: { region?: { name?: string; abbr?: string } };
  };
};
type BeaconSolicitationsResponse = {
  data?: { solicitations?: { total?: number; data?: BeaconSolicitation[] } };
  errors?: Array<{ message?: string }>;
};
type GsaForecastSuggestion = {
  id_node?: number;
  title_node?: string;
  body_node?: string;
  id_parent_group?: number;
  id_group?: number;
  title?: string;
  body?: string;
  field_federal_users_only?: boolean;
};
type GsaForecastSuggestionsResponse = {
  data?: GsaForecastSuggestion[];
};
type GsaForecastContent = Record<string, Array<Record<string, unknown>> | undefined>;

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
  state?: string;
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
  state?: string;
  departmentId?: string;
};
type DemandStarSource = {
  sourceName: string;
  buyer: string;
  agencyGuid: string;
  portalUrl: string;
  level: string;
  state: string;
};
type WorkdaySource = {
  sourceName: string;
  buyer: string;
  portalUrl: string;
  level: string;
};
type BeaconSource = {
  sourceName: string;
  buyer: string;
  agencyTag: string;
  portalUrl: string;
  level: string;
  state: string;
  submissionInstructions: string;
};
type OracleNegotiationSource = {
  sourceName: string;
  buyer: string;
  pageUrl: string;
  level: string;
  state: string;
  timeZone: string;
  submissionInstructions: string;
};
type AdvantageVssSource = {
  sourceName: string;
  buyer: string;
  portalUrl: string;
  applicationUrl: string;
  level: string;
  state: string;
  timeZone: string;
  sourceType: string;
  submissionInstructions: string;
  departmentPattern?: RegExp;
};
type AdvantageVssActionLeaf = {
  key?: string;
  name?: string;
  title?: string;
  targetQualifiedName?: string;
  targetLocation?: string;
  targetComponentType?: string;
  viewName?: string | null;
  order?: number;
};
type AdvantageVssSessionInfo = {
  session_id?: string;
  page_id?: string;
  csrf_token?: string;
};
type AdvantageVssResponse = {
  page_metadata?: Record<string, unknown> & { key?: string; title?: string };
  data?: {
    ds_data?: Record<
      string,
      {
        row_data?: AdvantageVssRow[];
        rows_per_page?: number;
      }
    >;
  };
  session_info?: AdvantageVssSessionInfo;
};
type AdvantageVssRow = {
  ADV_ROW_ID?: string;
  DOC_DSCR?: string;
  DOC_REF?: string;
  DOC_CD?: string;
  DOC_CD_CONCAT?: string;
  SO_CAT_CD?: string;
  SO_STA?: string;
  SO_CLSNG_DT_TM?: number | string;
  PUB_DT?: number | string;
  AMND_DT?: number | string;
  INTENT_POSTED_DT?: number | string;
  PUB_BID_OP_DT?: number | string;
  DEPT_NM?: string;
  BUYR_NM?: string;
  BUYR_EMAIL_AD?: string;
  BUYR_PH_NO?: string;
  BUYR_FAX_NO?: string;
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
  {
    sourceName: "Houston METRO Procurement",
    buyer: "Houston METRO",
    portalUrl: "https://ridemetro.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Adjacent",
  },
  {
    sourceName: "Broward County Purchasing",
    buyer: "Broward County",
    portalUrl: "https://broward.bonfirehub.com/portal",
    level: "Local",
    state: "FL",
  },
  {
    sourceName: "City of Charlotte Procurement",
    buyer: "City of Charlotte",
    portalUrl: "https://charlottenc.bonfirehub.com/portal/?tab=openOpportunities",
    level: "Local",
    state: "NC",
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
    currentBidsUrl: "https://dentontx.ionwave.net/SourcingEvents.aspx?SourceType=1",
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
  {
    sourceName: "San Antonio Water System Purchasing",
    buyer: "San Antonio Water System",
    currentBidsUrl: "https://sawsbid.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://sawsbid.ionwave.net/Login.aspx",
    level: "Adjacent",
  },
  {
    sourceName: "TIPS-USA Cooperative Bid Opportunities",
    buyer: "TIPS-USA / The Interlocal Purchasing System",
    currentBidsUrl: "https://tips.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://tips.ionwave.net/Login.aspx",
    level: "Adjacent",
  },
  {
    sourceName: "Goodbuy Purchasing Cooperative Bid Opportunities",
    buyer: "Goodbuy Purchasing Cooperative / ESC Region 2",
    currentBidsUrl: "https://goodbuy.ionwave.net/SourcingEvents.aspx?SourceType=1",
    portalUrl: "https://goodbuy.ionwave.net/Login.aspx",
    level: "Adjacent",
  },
];
const TEXAS_IONWAVE_SOURCE_BY_NAME = new Map(TEXAS_IONWAVE_SOURCES.map((source) => [source.sourceName, source]));
const OPENGOV_SOURCES: OpenGovSource[] = [
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
  {
    sourceName: "Ector County Purchasing",
    buyer: "Ector County",
    portalCode: "ectorcountytx",
    portalUrl: "https://procurement.opengov.com/portal/ectorcountytx",
    level: "Local",
  },
  {
    sourceName: "HGACBuy Cooperative Bid/RFP Notices",
    buyer: "HGACBuy / Houston-Galveston Area Council",
    portalCode: "h-gac",
    portalUrl: "https://procurement.opengov.com/portal/h-gac?departmentId=3252&status=open",
    level: "Adjacent",
    departmentId: "3252",
  },
  {
    sourceName: "City of Tampa Purchasing",
    buyer: "City of Tampa",
    portalCode: "cityoftampa",
    portalUrl: "https://procurement.opengov.com/portal/cityoftampa",
    level: "Local",
    state: "FL",
  },
  {
    sourceName: "RTD Procurement and Contracting",
    buyer: "Regional Transportation District",
    portalCode: "rtd-denver",
    portalUrl: "https://procurement.opengov.com/portal/rtd-denver",
    level: "Adjacent",
    state: "CO",
  },
  {
    sourceName: "Cobb County Purchasing",
    buyer: "Cobb County",
    portalCode: "cobbcoga",
    portalUrl: "https://procurement.opengov.com/portal/cobbcoga",
    level: "Local",
    state: "GA",
  },
  {
    sourceName: "City of Orlando Procurement and Contracts",
    buyer: "City of Orlando",
    portalCode: "orlando",
    portalUrl: "https://procurement.opengov.com/portal/orlando",
    level: "Local",
    state: "FL",
  },
  {
    sourceName: "Orange County Florida OrangeBids",
    buyer: "Orange County, Florida",
    portalCode: "orangecountyfl",
    portalUrl: "https://procurement.opengov.com/portal/orangecountyfl",
    level: "Local",
    state: "FL",
  },
];
const OPENGOV_SOURCE_BY_NAME = new Map(OPENGOV_SOURCES.map((source) => [source.sourceName, source]));
const DEMANDSTAR_SOURCES: DemandStarSource[] = [
  {
    sourceName: "Hillsborough County Procurement",
    buyer: "Hillsborough County Board of County Commissioners",
    agencyGuid: "f99704d5-ff5e-4cee-84da-d74d8a525324",
    portalUrl:
      "https://www.demandstar.com/app/agencies/florida/hillsborough-county-bocc/procurement-opportunities/f99704d5-ff5e-4cee-84da-d74d8a525324/",
    level: "Local",
    state: "FL",
  },
  {
    sourceName: "City of Allen Purchasing",
    buyer: "City of Allen Purchasing",
    agencyGuid: "bb50e6cc-3403-4b53-9e22-d245a4d553da",
    portalUrl:
      "https://www.demandstar.com/app/agencies/texas/city-of-allen-purchasing/procurement-opportunities/bb50e6cc-3403-4b53-9e22-d245a4d553da/",
    level: "Local",
    state: "TX",
  },
];
const DEMANDSTAR_SOURCE_BY_NAME = new Map(DEMANDSTAR_SOURCES.map((source) => [source.sourceName, source]));
const TEXAS_WORKDAY_SOURCES: WorkdaySource[] = [
  {
    sourceName: "Dallas College Supplier Information",
    buyer: "Dallas College",
    portalUrl: "https://dallas-college.public-portal.us.workdayspend.com/",
    level: "Education",
  },
  {
    sourceName: "Port Houston Procurement",
    buyer: "Port Houston",
    portalUrl: "https://port-of-houston-authority.public-portal.us.workdayspend.com/",
    level: "Adjacent",
  },
];
const TEXAS_WORKDAY_SOURCE_BY_NAME = new Map(TEXAS_WORKDAY_SOURCES.map((source) => [source.sourceName, source]));
const BEACON_SOURCES: BeaconSource[] = [
  {
    sourceName: "City of Houston Procurement",
    buyer: "City of Houston",
    agencyTag: "city-of-houston",
    portalUrl: "https://www.beaconbid.com/solicitations/city-of-houston/open",
    level: "Local",
    state: "TX",
    submissionInstructions:
      "Open the Beacon posting, subscribe/register as required by the City of Houston, download the official documents, confirm addenda and question deadlines, and submit through Beacon before the closing date.",
  },
  {
    sourceName: "City of Memphis Purchasing",
    buyer: "City of Memphis",
    agencyTag: "city-of-memphis-95",
    portalUrl: "https://www.beaconbid.com/solicitations/city-of-memphis-95/open",
    level: "Local",
    state: "TN",
    submissionInstructions:
      "Open the Beacon posting, complete the free Beacon interest/subscription flow to access official attachments and updates, confirm addenda and question deadlines, and follow the City of Memphis submission instructions before the closing date.",
  },
];
const BEACON_SOURCE_BY_NAME = new Map(BEACON_SOURCES.map((source) => [source.sourceName, source]));
const ORACLE_NEGOTIATION_SOURCES: OracleNegotiationSource[] = [
  {
    sourceName: "City of Atlanta Procurement",
    buyer: "City of Atlanta",
    pageUrl: "https://ehxr.fa.us2.oraclecloud.com/fscmUI/faces/NegotiationAbstracts?prcBuId=300000001273072",
    level: "Local",
    state: "GA",
    timeZone: "America/New_York",
    submissionInstructions:
      "Open the Oracle Negotiation Abstracts portal, select the Details icon for the solicitation, download the official attachments and addenda, then submit through the listed Oracle/City of Atlanta instructions before the close date.",
  },
  {
    sourceName: "Metro Nashville Procurement",
    buyer: "Metropolitan Government of Nashville and Davidson County",
    pageUrl: "https://ibqhjb.fa.ocs.oraclecloud.com/fscmUI/faces/NegotiationAbstracts?prcBuId=300000006739049",
    level: "Local",
    state: "TN",
    timeZone: "America/Chicago",
    submissionInstructions:
      "Open the Oracle Negotiation Abstracts portal, select the Details icon for the negotiation, download the official attachments and addenda, then submit through Metro Nashville's listed Oracle instructions before the close date.",
  },
];
const ORACLE_NEGOTIATION_SOURCE_BY_NAME = new Map(ORACLE_NEGOTIATION_SOURCES.map((source) => [source.sourceName, source]));
const COLORADO_VSS_APPLICATION_URL = "https://prd.co.cgiadvantage.com/PRDVSS1X1/Advantage4";
const PALM_BEACH_VSS_APPLICATION_URL = "https://pbcvssp.pbc.gov/vssprd/Advantage4";
const MECKLENBURG_VSS_APPLICATION_URL = "https://mecknc-vss.hostams.com/PRDVSS1X1/Advantage4";
const ADVANTAGE_VSS_SOURCES: AdvantageVssSource[] = [
  {
    sourceName: "Colorado Vendor Self Service",
    buyer: "State of Colorado",
    portalUrl: "https://vss.state.co.us/",
    applicationUrl: COLORADO_VSS_APPLICATION_URL,
    level: "State",
    state: "CO",
    timeZone: "America/Denver",
    sourceType: "Colorado Advantage VSS public published solicitations feed",
    submissionInstructions:
      "Open Colorado VSS, select the published solicitation row, download the official documents and addenda, confirm registration/submission requirements, and submit through ColoradoVSS before the close date.",
  },
  {
    sourceName: "Colorado VSS Published Solicitations",
    buyer: "State of Colorado",
    portalUrl: COLORADO_VSS_APPLICATION_URL,
    applicationUrl: COLORADO_VSS_APPLICATION_URL,
    level: "State",
    state: "CO",
    timeZone: "America/Denver",
    sourceType: "Colorado Advantage VSS public published solicitations feed",
    submissionInstructions:
      "Open the Colorado VSS published solicitation page, select the row matching the solicitation ID, download the official files and addenda, and submit through ColoradoVSS before the close date.",
  },
  {
    sourceName: "Colorado Department of Human Services Procurement",
    buyer: "Colorado Department of Human Services",
    portalUrl: "https://cdhs.colorado.gov/procurement",
    applicationUrl: COLORADO_VSS_APPLICATION_URL,
    level: "State",
    state: "CO",
    timeZone: "America/Denver",
    sourceType: "Colorado Advantage VSS public published solicitations feed filtered to CDHS-related buyers",
    departmentPattern: /\bCDHS\b|Human Services|Office of Behavioral Health|Office of Children|Youth and Families/i,
    submissionInstructions:
      "Open the ColoradoVSS posting for the CDHS-related solicitation, download the official documents and addenda, confirm question deadlines and registration needs, and submit through ColoradoVSS before the close date.",
  },
  {
    sourceName: "Palm Beach County Purchasing",
    buyer: "Palm Beach County",
    portalUrl: "https://discover.pbc.gov/procurement/Pages/default.aspx",
    applicationUrl: PALM_BEACH_VSS_APPLICATION_URL,
    level: "Local",
    state: "FL",
    timeZone: "America/New_York",
    sourceType: "Palm Beach County Advantage VSS public published solicitations feed",
    submissionInstructions:
      "Open the Palm Beach County VSS posting, select the solicitation row, download official IFB/RFP documents and addenda, confirm vendor registration and submission requirements, and submit before the close date.",
  },
  {
    sourceName: "Mecklenburg County Vendor Opportunities",
    buyer: "Mecklenburg County",
    portalUrl: "https://fin.mecknc.gov/procurement",
    applicationUrl: MECKLENBURG_VSS_APPLICATION_URL,
    level: "Local",
    state: "NC",
    timeZone: "America/New_York",
    sourceType: "Mecklenburg County Advantage VSS public published solicitations feed",
    submissionInstructions:
      "Open the Mecklenburg County VSS posting, select the solicitation row, download the official documents and addenda, confirm vendor registration/submission requirements, and submit through MeckProcure/VSS before the close date.",
  },
];
const ADVANTAGE_VSS_SOURCE_BY_NAME = new Map(ADVANTAGE_VSS_SOURCES.map((source) => [source.sourceName, source]));
const TENNESSEE_RFP_URL =
  "https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/supplier-information/request-for-proposals--rfp--opportunities1.html";
const TENNESSEE_ITB_URL =
  "https://www.tn.gov/generalservices/procurement/central-procurement-office--cpo-/supplier-information/invitations-to-bid--itb-.html";
const TEXAS_DIR_SOLICITATION_SCHEDULE_URL =
  "https://dir.texas.gov/it-solutions-and-services/selling-through-dir/schedule-of-solicitation-opportunities";
const BUYBOARD_PROPOSAL_INVITATIONS_URL = "https://www.buyboard.com/vendor/proposal-invitations";
const CHOICE_PARTNERS_CURRENT_RFPS_URL = "https://www.choicepartners.org/current-rfps";
const CHOICE_PARTNERS_UPCOMING_CONTRACTS_URL = "https://www.choicepartners.org/upcoming-contracts";
const SOURCEWELL_SOLICITATIONS_URL = "https://www.sourcewell-mn.gov/solicitations";
const NASPO_VALUEPOINT_SOLICITATIONS_URL = "https://naspovaluepoint.org/solicitation-status/";
const OMNIA_SOLICITATIONS_URL = "https://www.omniapartners.com/get-started/solicitations";
const EQUALIS_SOLICITATIONS_URL = "https://equalisgroup.org/current-solicitations/";
const THE_WOODLANDS_BIDS_URL =
  "https://www.thewoodlandstownship-tx.gov/Departments/Finance/Purchasing-Procurement/Bids";
const VISIT_THE_WOODLANDS_BIDS_URL = "https://www.visitthewoodlands.com/about/public-documents/bids-proposals/";
const AUSTIN_SOLICITATIONS_URL = "https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitations.cfm";
const FRISCO_CURRENT_BIDS_URL = "https://www.friscotexas.gov/883/Current-Bids";
const BEXAR_BIDS_URL = "https://www.bexar.org/Bids.aspx";
const MIDLAND_COUNTY_RFP_URL = "https://www.co.midland.tx.us/593/Midland-County-Request-for-Proposal";
const HOUSTON_AIRPORT_SOLICITATIONS_URL =
  "https://www.fly2houston.com/airport-business/business-partnerships/contracting/solicitations/?pageIndex=1&status=Open";
const CAPMETRO_PURCHASING_URL = "https://www.capmetro.org/purchasing";
const VIA_SOLICITATIONS_URL = "https://via.sbecompliance.com/FrontEnd/ProposalSearchPublic.asp?TN=via&XID=2006";
const CPS_ENERGY_B2GNOW_PROPOSALS_URL = "https://cpsenergy.sbecompliance.com/FrontEnd/ProposalSearchPublic.asp?TN=cpsenergy&XID=";
const HOUSTON_METRO_PROCUREMENT_URL = "https://www.ridemetro.org/about/business-to-business/procurement-opportunities";
const NTTA_MARKETPLACE_URL = "https://www.nttamarketplace.org/bso/view/search/external/advancedSearchBid.xhtml?openBids=true";
const AUSTIN_ENERGY_RFPS_URL = "https://austinenergy.com/contractors/working-with-austin-energy/rfps";
const ARAPAHOE_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/arapahoe-county";
const ARAPAHOE_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/arapahoe-county/solicitations/open-bids?selectedContent=BUYER";
const COLORADO_SPRINGS_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/city-of-colorado-springs";
const COLORADO_SPRINGS_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/city-of-colorado-springs/solicitations/open-bids?selectedContent=BUYER";
const AURORA_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/city-of-aurora";
const AURORA_BIDNET_OPEN_BIDS_URL = "https://www.bidnetdirect.com/colorado/city-of-aurora/solicitations/open-bids?selectedContent=BUYER";
const FORT_COLLINS_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/city-of-fort-collins";
const FORT_COLLINS_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/city-of-fort-collins/solicitations/open-bids?selectedContent=BUYER";
const DENVER_PUBLIC_SCHOOLS_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/denver-public-schools";
const DENVER_PUBLIC_SCHOOLS_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/denver-public-schools/solicitations/open-bids?selectedContent=BUYER";
const DENVER_AIRPORT_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/cityandcountyofdenverdepartmentofaviation";
const DENVER_AIRPORT_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/cityandcountyofdenverdepartmentofaviation/solicitations/open-bids?selectedContent=BUYER";
const DOUGLAS_COUNTY_CO_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/douglas-county-government";
const DOUGLAS_COUNTY_CO_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/douglas-county-government/solicitations/open-bids?selectedContent=BUYER";
const COLORADO_STATE_UNIVERSITY_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/colorado-state-university";
const COLORADO_STATE_UNIVERSITY_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/colorado-state-university/solicitations/open-bids?selectedContent=BUYER";
const UNIVERSITY_OF_COLORADO_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/colorado/universityofcolorado";
const UNIVERSITY_OF_COLORADO_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/colorado/universityofcolorado/solicitations/open-bids?selectedContent=BUYER";
const BOULDER_COUNTY_BIDS_URL = "https://bouldercounty.gov/government/budget-and-finance/procurement/bid-opportunities/";
const BOULDER_COUNTY_PROCUREMENT_PORTAL_URL = "https://bouldercounty.bonfirehub.com/portal";
const DENVER_CURRENT_BIDS_URL = "https://www.denvergov.org/Business/Contract-Administration/Current";
const ADDISON_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/texas/townofaddison";
const ADDISON_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/texas/townofaddison/solicitations/open-bids?selectedContent=BUYER";
const FULTON_COUNTY_BIDNET_PORTAL_URL = "https://www.bidnetdirect.com/georgia/fultoncounty";
const FULTON_COUNTY_BIDNET_OPEN_BIDS_URL =
  "https://www.bidnetdirect.com/georgia/fultoncounty/solicitations/open-bids?selectedContent=BUYER";
const GEORGIA_GPR_URL = "https://ssl.doas.state.ga.us/gpr/";
const GEORGIA_GPR_EVENT_SEARCH_URL = "https://ssl.doas.state.ga.us/gpr/eventSearch";
const MIAMI_DADE_CURRENT_SOLICITATIONS_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/CurrentSolicitations";
const MIAMI_DADE_CURRENT_SOLICITATIONS_API_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/CurrentSolicitationsList";
const MIAMI_DADE_FUTURE_SOLICITATIONS_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/FutureSolicitations";
const MIAMI_DADE_FUTURE_SOLICITATIONS_API_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/FutureSolicitationsList";
const MIAMI_DADE_FUTURE_SOLICITATION_DOC_BASE_URL = "https://www.miamidade.gov/Apps/ISD/StratProc/ProcurementNAS/pdf_Files/FutureSolicitations/";
const GWINNETT_COUNTY_SOLICITATIONS_URL = "https://www.gwinnettcounty.com/government/departments/financial-services/purchasing/solicitations";
const NORTH_CAROLINA_EVP_SOLICITATIONS_URL = "https://evp.nc.gov/solicitations/?status=0";
const NORTH_CAROLINA_EVP_GRID_URL = "https://evp.nc.gov/_services/entity-grid-data.json/863ea987-6d3e-ed11-9daf-001dd805ec0b";
const NORTH_CAROLINA_EVP_TOKEN_URL = "https://evp.nc.gov/_layout/tokenhtml";
const NORTH_CAROLINA_EVP_DETAIL_URL = "https://evp.nc.gov/solicitations/details/";
const GSA_FORECAST_URL = "https://acquisitiongateway.gov/forecast";
const GSA_FORECAST_SUGGESTIONS_URL = "https://ag-dashboard.acquisitiongateway.gov/api/v3.0/suggestions";
const GSA_FORECAST_CONTENT_URL = "https://ag-dashboard.acquisitiongateway.gov/api/v3.0/content/";
const DEMANDSTAR_API_BASE_URL = "https://api.demandstar.com";
const HANDLED_SOURCE_NAMES = new Set([
  "SAM.gov Contract Opportunities",
  "Texas Electronic State Business Daily",
  "GSA Forecast of Contracting Opportunities",
  "The Woodlands Township Bids",
  "Texas DIR Schedule of Solicitation Opportunities",
  "BuyBoard Current Proposal Invitations",
  "Choice Partners Current RFPs",
  "Choice Partners Upcoming Contracts",
  "Sourcewell Open Solicitations",
  "NASPO ValuePoint Current Solicitations",
  "OMNIA Partners Current Solicitations",
  "Equalis Group Current Solicitations",
  "City of Austin Purchasing",
  "City of Frisco Purchasing",
  "Bexar County Purchasing",
  "Midland County Purchasing",
  "Austin-Bergstrom Airport Business",
  "Houston Airport System Business",
  "CapMetro Procurement",
  "VIA Metropolitan Transit Procurement",
  "Houston METRO Procurement",
  "North Texas Tollway Authority Procurement",
  "Austin Energy Vendor Information",
  "Tennessee RFP Opportunities",
  "Tennessee ITB Opportunities",
  ...TEXAS_ESBD_AGENCY_SOURCE_BY_NAME.keys(),
  ...TEXAS_BONFIRE_SOURCE_BY_NAME.keys(),
  ...TEXAS_IONWAVE_SOURCE_BY_NAME.keys(),
  ...OPENGOV_SOURCE_BY_NAME.keys(),
  ...DEMANDSTAR_SOURCE_BY_NAME.keys(),
  ...TEXAS_WORKDAY_SOURCE_BY_NAME.keys(),
  ...BEACON_SOURCE_BY_NAME.keys(),
  ...ORACLE_NEGOTIATION_SOURCE_BY_NAME.keys(),
  ...ADVANTAGE_VSS_SOURCE_BY_NAME.keys(),
  ...TEXAS_REFERENCE_SOURCE_NAMES,
]);
const OFFICIAL_PAGE_SOURCE_NAMES = new Set([
  "Colorado Department of Transportation Bidding",
  "Shelby County Purchasing",
  "Tennessee Board of Regents Procurement Opportunities",
  "University of Florida Procurement Bid Schedule",
]);
const REFERENCE_ONLY_SOURCE_NAMES = new Set([
  "Acquisition.gov",
  "Colorado BIDS Price Agreements",
  "Colorado State Purchasing and Contracts",
  "Department of Defense Office of Small Business Programs",
  "Department of Health and Human Services Contracts",
  "Department of Homeland Security Vendor Resources",
  "Department of Labor Contract Opportunities",
  "Department of Transportation Procurement",
  "Department of Veterans Affairs Vendor Portal",
  "Federal Procurement Data System",
  "Florida State Purchasing / MFMP",
  "Georgia DOAS Bids and Contracts",
  "GSA eBuy",
  "GSA Multiple Award Schedule",
  "MyFloridaMarketPlace Vendor Information Portal",
  "NC eProcurement",
  "Small Business Administration Contracting Guide",
  "Tennessee Central Procurement Office Supplier Info",
  "UNC System Procurement",
  "University System of Georgia Procurement",
  "USAspending.gov",
]);
const SERVER_BLOCKED_SOURCE_NAMES = new Set(["Equalis Group Current Solicitations"]);
const PENDING_SOURCE_MESSAGES = new Map<string, string>([
  [
    "City of Addison Purchasing",
    "The official page blocks server-side fetching and points procurement through BidNetDirect. Connect BidNetDirect alerts or an approved browser collector.",
  ],
  [
    "Capital Area Council of Governments Procurement",
    "The official CAPCOG page is behind Cloudflare challenge protection from the server environment. Use alerts, email ingestion, or an approved browser collector.",
  ],
  [
    "Equalis Group Current Solicitations",
    "The current-solicitations page is public in a browser, but Cloudflare blocks Vercel/server-side fetching. Use alerts, email ingestion, or an approved browser collector before marking this source live.",
  ],
]);
const SAM_SUCCESS_CACHE_MS = 15 * 60 * 1000;
const SAM_ERROR_CACHE_MS = 2 * 60 * 1000;
const SAM_RATE_LIMIT_CACHE_MS = 10 * 60 * 1000;
const SAM_RETRY_DELAYS_MS = [0, 1500, 4000];
const SAM_FETCH_TIMEOUT_MS = 12000;
const TEXAS_ESBD_SUCCESS_CACHE_MS = 5 * 60 * 1000;
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
const DEMANDSTAR_SUCCESS_CACHE_MS = 10 * 60 * 1000;
const DEMANDSTAR_ERROR_CACHE_MS = 2 * 60 * 1000;
const DEMANDSTAR_FETCH_TIMEOUT_MS = 12000;
const WORKDAY_SUCCESS_CACHE_MS = 10 * 60 * 1000;
const WORKDAY_ERROR_CACHE_MS = 2 * 60 * 1000;
const WORKDAY_FETCH_TIMEOUT_MS = 12000;
const ADVANTAGE_VSS_SUCCESS_CACHE_MS = 10 * 60 * 1000;
const ADVANTAGE_VSS_FETCH_TIMEOUT_MS = 20000;
const SEARCH_TASK_TIMEOUT_MS = 45000;
const SEARCH_TOTAL_TIMEOUT_MS = 56000;
const SEARCH_TASK_CONCURRENCY = 10;
const MAX_RESULTS = 120;

const samCache = getGlobalMap<{ expiresAt: number; value: SamSearchResult }>("__govContractFinderSamCache");
const samInFlight = getGlobalMap<Promise<SamSearchResult>>("__govContractFinderSamInFlight");
const texasEsbdBatchCache = getGlobalMap<{ expiresAt: number; value: TexasEsbdBatchResult }>("__govContractFinderTexasEsbdBatchCache");
const texasEsbdBatchInFlight = getGlobalMap<Promise<TexasEsbdBatchResult>>("__govContractFinderTexasEsbdBatchInFlight");
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
const demandStarCache = getGlobalMap<{ expiresAt: number; value: ConnectorSearchResult }>("__govContractFinderDemandStarCache");
const demandStarInFlight = getGlobalMap<Promise<ConnectorSearchResult>>("__govContractFinderDemandStarInFlight");
const workdayCache = getGlobalMap<{ expiresAt: number; value: ConnectorSearchResult }>("__govContractFinderWorkdayCache");
const workdayInFlight = getGlobalMap<Promise<ConnectorSearchResult>>("__govContractFinderWorkdayInFlight");
const northCarolinaEvpCache = getGlobalMap<{ expiresAt: number; records: NorthCarolinaEvpRecord[] }>("__govContractFinderNorthCarolinaEvpCache");
const northCarolinaEvpInFlight = getGlobalMap<Promise<NorthCarolinaEvpRecord[]>>("__govContractFinderNorthCarolinaEvpInFlight");
const advantageVssRowsCache = getGlobalMap<{ expiresAt: number; rows: AdvantageVssRow[] }>("__govContractFinderAdvantageVssRowsCache");
const advantageVssRowsInFlight = getGlobalMap<Promise<AdvantageVssRow[]>>("__govContractFinderAdvantageVssRowsInFlight");

export async function searchConnectedSources({ query, state, level, sources }: SearchFilters): Promise<ConnectedSearchResponse> {
  const tasks: SearchTask[] = [];
  const searchedSources: string[] = [];
  const pendingSources = sources
    .filter((source) => matchesFilter({ sourceState: source.state, sourceLevel: source.level, state, level }))
    .filter((source) => !REFERENCE_ONLY_SOURCE_NAMES.has(source.source_name))
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
    if (REFERENCE_ONLY_SOURCE_NAMES.has(source.source_name)) {
      continue;
    }

    if (TEXAS_REFERENCE_SOURCE_NAMES.has(source.source_name)) {
      removePending(pendingSources, source.source_name);
      continue;
    }

    if (SERVER_BLOCKED_SOURCE_NAMES.has(source.source_name)) {
      continue;
    }

    if (matchesFilter({ sourceState: source.state, sourceLevel: source.level, state, level })) {
      const customTexasTask = texasCustomSourceTask(source.source_name, query);
      if (customTexasTask) {
        searchedSources.push(source.source_name);
        removePending(pendingSources, source.source_name);
        const task = { source: source.source_name, run: customTexasTask };
        if (source.source_name === "San Antonio Water System Purchasing") {
          tasks.unshift(task);
        } else {
          tasks.push(task);
        }
        continue;
      }

      if (source.source_name === "City of Austin Purchasing") {
        searchedSources.push("City of Austin Purchasing");
        removePending(pendingSources, "City of Austin Purchasing");
        tasks.push({ source: "City of Austin Purchasing", run: () => searchAustinSolicitations(query) });
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

      const openGovSource = OPENGOV_SOURCE_BY_NAME.get(source.source_name);
      if (openGovSource) {
        searchedSources.push(openGovSource.sourceName);
        removePending(pendingSources, openGovSource.sourceName);
        tasks.push({ source: openGovSource.sourceName, run: () => searchOpenGov(query, openGovSource) });
        continue;
      }

      const demandStarSource = DEMANDSTAR_SOURCE_BY_NAME.get(source.source_name);
      if (demandStarSource) {
        searchedSources.push(demandStarSource.sourceName);
        removePending(pendingSources, demandStarSource.sourceName);
        tasks.push({ source: demandStarSource.sourceName, run: () => searchDemandStar(query, demandStarSource) });
        continue;
      }

      const texasWorkdaySource = TEXAS_WORKDAY_SOURCE_BY_NAME.get(source.source_name);
      if (texasWorkdaySource) {
        searchedSources.push(texasWorkdaySource.sourceName);
        removePending(pendingSources, texasWorkdaySource.sourceName);
        tasks.push({ source: texasWorkdaySource.sourceName, run: () => searchWorkday(query, texasWorkdaySource) });
        continue;
      }

      const beaconSource = BEACON_SOURCE_BY_NAME.get(source.source_name);
      if (beaconSource) {
        searchedSources.push(beaconSource.sourceName);
        removePending(pendingSources, beaconSource.sourceName);
        tasks.push({ source: beaconSource.sourceName, run: () => searchBeaconSolicitations(query, beaconSource) });
        continue;
      }

      const oracleNegotiationSource = ORACLE_NEGOTIATION_SOURCE_BY_NAME.get(source.source_name);
      if (oracleNegotiationSource) {
        searchedSources.push(oracleNegotiationSource.sourceName);
        removePending(pendingSources, oracleNegotiationSource.sourceName);
        tasks.push({
          source: oracleNegotiationSource.sourceName,
          run: () => searchOracleNegotiationAbstracts(query, oracleNegotiationSource),
        });
        continue;
      }

      const advantageVssSource = ADVANTAGE_VSS_SOURCE_BY_NAME.get(source.source_name);
      if (advantageVssSource) {
        searchedSources.push(advantageVssSource.sourceName);
        removePending(pendingSources, advantageVssSource.sourceName);
        tasks.push({
          source: advantageVssSource.sourceName,
          run: () => searchAdvantageVssPublishedSolicitations(query, advantageVssSource),
        });
        continue;
      }

      if (source.source_name === "GSA Forecast of Contracting Opportunities") {
        searchedSources.push("GSA Forecast of Contracting Opportunities");
        removePending(pendingSources, "GSA Forecast of Contracting Opportunities");
        tasks.push({ source: "GSA Forecast of Contracting Opportunities", run: () => searchGsaForecast(query) });
        continue;
      }

      const texasAgencySource = TEXAS_ESBD_AGENCY_SOURCE_BY_NAME.get(source.source_name);
      if (texasAgencySource) {
        searchedSources.push(texasAgencySource.sourceName);
        removePending(pendingSources, texasAgencySource.sourceName);
        tasks.push({ source: texasAgencySource.sourceName, run: () => searchTexasAgencyEsbd(query, texasAgencySource) });
        continue;
      }

      if (OFFICIAL_PAGE_SOURCE_NAMES.has(source.source_name)) {
        searchedSources.push(source.source_name);
        removePending(pendingSources, source.source_name);
        tasks.push({ source: source.source_name, run: () => searchOfficialSource(query, source) });
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

  const settled = await runSearchTasks([...tasks].sort((a, b) => searchTaskPriority(a.source) - searchTaskPriority(b.source)), SEARCH_TASK_CONCURRENCY, SEARCH_TOTAL_TIMEOUT_MS);
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

function texasCustomSourceTask(sourceName: string, query: string): (() => Promise<SearchTaskResult>) | undefined {
  switch (sourceName) {
    case "Texas DIR Schedule of Solicitation Opportunities":
      return () => searchTexasDirSolicitationSchedule(query);
    case "BuyBoard Current Proposal Invitations":
      return () => searchBuyBoardProposalInvitations(query);
    case "Choice Partners Current RFPs":
      return () => searchChoicePartnersCurrentRfps(query);
    case "Choice Partners Upcoming Contracts":
      return () => searchChoicePartnersUpcomingContracts(query);
    case "Sourcewell Open Solicitations":
      return () => searchSourcewellOpenSolicitations(query);
    case "NASPO ValuePoint Current Solicitations":
      return () => searchNaspoValuePointSolicitations(query);
    case "OMNIA Partners Current Solicitations":
      return () => searchOmniaCurrentSolicitations(query);
    case "Equalis Group Current Solicitations":
      return () => searchEqualisCurrentSolicitations(query);
    case "Bexar County Purchasing":
      return () => searchBexarCountyBids(query);
    case "Midland County Purchasing":
      return () => searchMidlandCountyRfps(query);
    case "Austin-Bergstrom Airport Business":
      return () => searchAustinBergstromSolicitations(query);
    case "Houston Airport System Business":
      return () => searchHoustonAirportSolicitations(query);
    case "CapMetro Procurement":
      return () => searchCapMetroProcurement(query);
    case "VIA Metropolitan Transit Procurement":
      return () => searchViaProcurement(query);
    case "Houston METRO Procurement":
      return () => searchHoustonMetroProcurement(query);
    case "CPS Energy Procurement and Suppliers":
      return () => searchCpsEnergyProcurement(query);
    case "North Texas Tollway Authority Procurement":
      return () => searchNttaProcurement(query);
    case "Austin Energy Vendor Information":
      return () => searchAustinEnergyRfps(query);
    case "San Antonio Water System Purchasing":
      return () => searchSawsProcurement(query);
    case "Arapahoe County Purchasing":
      return () => searchArapahoeCountyPurchasing(query);
    case "City of Aurora Purchasing":
      return () => searchAuroraPurchasing(query);
    case "City of Colorado Springs Procurement":
      return () => searchColoradoSpringsPurchasing(query);
    case "City of Fort Collins Purchasing":
      return () => searchFortCollinsPurchasing(query);
    case "Denver Public Schools Purchasing":
      return () => searchDenverPublicSchoolsPurchasing(query);
    case "Denver International Airport Business Opportunities":
      return () => searchDenverAirportBusinessOpportunities(query);
    case "Douglas County Purchasing":
      return () => searchDouglasCountyColoradoPurchasing(query);
    case "Colorado State University Procurement Services":
      return () => searchColoradoStateUniversityPurchasing(query);
    case "University of Colorado Procurement Service Center":
      return () => searchUniversityOfColoradoPurchasing(query);
    case "Boulder County Purchasing":
      return () => searchBoulderCountyPurchasing(query);
    case "City and County of Denver Bidding Opportunities":
      return () => searchDenverCurrentBids(query);
    case "City of Addison Purchasing":
      return () => searchAddisonPurchasing(query);
    case "Fulton County Bid Opportunities":
      return () => searchFultonCountyBidOpportunities(query);
    case "Georgia Procurement Registry":
      return () => searchGeorgiaProcurementRegistry(query);
    case "Miami-Dade County Procurement":
      return () => searchMiamiDadeProcurement(query);
    case "Gwinnett County Purchasing":
      return () => searchGwinnettCountyPurchasing(query);
    case "North Carolina eVP Solicitations":
      return () => searchNorthCarolinaEvpSolicitations(query);
    case "City of Raleigh Current Bidding Opportunities":
      return () => searchNorthCarolinaEvpSolicitations(query, {
        sourceName: "City of Raleigh Current Bidding Opportunities",
        buyer: "City of Raleigh",
        sourceLevel: "Local",
        departmentPattern: /\bCITY\s+OF\s+RALEIGH\b/i,
      });
    case "Wake County Procurement Services":
      return () => searchNorthCarolinaEvpSolicitations(query, {
        sourceName: "Wake County Procurement Services",
        buyer: "Wake County",
        sourceLevel: "Local",
        departmentPattern: /\bWAKE\s+COUNTY\b/i,
      });
    default:
      return undefined;
  }
}

async function searchAddisonPurchasing(query: string): Promise<SearchTaskResult> {
  const source = "City of Addison Purchasing";
  try {
    const response = await fetchPublicPage(ADDISON_BIDNET_OPEN_BIDS_URL);
    if (!response.ok) {
      return { source, results: [], error: `BidNet Direct returned ${response.status}` };
    }

    return {
      source,
      results: parseBidNetAgencySolicitations(await response.text(), query, {
        sourceName: source,
        buyer: "Town of Addison",
        sourceLevel: "Local",
        sourceState: "TX",
        sourceType: "BidNet Direct public opportunity page",
        portalUrl: ADDISON_BIDNET_PORTAL_URL,
        openBidsUrl: ADDISON_BIDNET_OPEN_BIDS_URL,
        submissionInstructions:
          "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm whether electronic or sealed submission is required, and submit before the closing date.",
      }),
    };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

async function searchDenverCurrentBids(query: string): Promise<SearchTaskResult> {
  const source = "City and County of Denver Bidding Opportunities";
  try {
    const response = await fetchPublicPage(DENVER_CURRENT_BIDS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Denver current bids page returned ${response.status}` };
    }

    return { source, results: parseDenverCurrentBids(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseDenverCurrentBids(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<div[^>]*class=["'][^"']*\blist-item-container\b[^"']*["'][^>]*>([\s\S]*?)<\/article>\s*<\/div>/gi));

  return rows
    .map((row, index) => denverCurrentBidToResult(row[1], terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function denverCurrentBidToResult(rowHtml: string, terms: string[], index: number): UnifiedSearchResult | undefined {
  const linkMatch = rowHtml.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
  const linkHtml = linkMatch?.[3] ?? rowHtml;
  const title = cleanText(linkHtml.match(/<h2[^>]*class=["'][^"']*\blist-item-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const url = safeAbsoluteUrl(decodeHtml(linkMatch?.[2] ?? ""), DENVER_CURRENT_BIDS_URL) ?? DENVER_CURRENT_BIDS_URL;
  const solicitationId = fieldFromText(htmlToText(linkHtml), /Reference number:\s*([^]+?)(?=\s+Closing date|\s+Status:|$)/i);
  const deadline = fieldFromText(htmlToText(linkHtml), /Closing date\s*([^]+?)(?=\s+Status:|$)/i);
  const status = fieldFromText(htmlToText(linkHtml), /Status:\s*([A-Za-z ]+?)(?=$)/i) ?? "Open";
  const paragraphs = Array.from(linkHtml.matchAll(/<p\b(?![^>]*class=["'][^"']*(?:reference-number|applications-closing|status-list)[^"']*["'])[^>]*>([\s\S]*?)<\/p>/gi))
    .map((paragraph) => cleanText(paragraph[1]))
    .filter(Boolean);
  const description = paragraphs.join(" ");
  const haystack = [title, solicitationId, deadline, status, description, "City and County of Denver bid rfq rfp contract"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 74 - Math.min(index, 25));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `denver-current:${solicitationId ?? title}`,
    resultType: "opportunity",
    title,
    buyer: "City and County of Denver",
    sourceName: "City and County of Denver Bidding Opportunities",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "Official Denver current bidding opportunities page",
    url,
    portalUrl: DENVER_CURRENT_BIDS_URL,
    score,
    status,
    solicitationId,
    deadline,
    documents: ["Denver detail page may include plan holders, bid documents, addenda, and submission details."],
    documentLinks: [{ label: "Denver opportunity detail and documents", url }],
    submissionInstructions:
      "Open the Denver opportunity detail page, review the official bid/RFQ documents and addenda, then follow the listed submission method and deadline.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [description, solicitationId ? `Reference: ${solicitationId}.` : "", deadline ? `Closes ${deadline}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the Denver detail page, download the official documents and addenda, then decide whether to save it for drafting.",
  };
}

async function searchBoulderCountyPurchasing(query: string): Promise<SearchTaskResult> {
  const source = "Boulder County Purchasing";
  try {
    const response = await fetchPublicPage(BOULDER_COUNTY_BIDS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Boulder County bids page returned ${response.status}` };
    }

    return { source, results: parseBoulderCountyBids(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseBoulderCountyBids(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const currentStart = html.search(/<h2[^>]*>\s*Current Solicitations Chart\s*<\/h2>/i);
  const currentEnd = html.search(/<h2[^>]*>\s*Notices of Final Settlement\s*<\/h2>/i);
  const currentSection = currentStart >= 0 ? html.slice(currentStart, currentEnd > currentStart ? currentEnd : undefined) : html;
  const rows = Array.from(currentSection.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index) => boulderCountyRowToResult(row[1], terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function boulderCountyRowToResult(rowHtml: string, terms: string[], index: number): UnifiedSearchResult | undefined {
  const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);
  if (cells.length < 4) {
    return undefined;
  }

  const deadline = cleanText(cells[0]);
  const solicitationId = cleanText(cells[1]);
  const titleLink = cells[2].match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
  const title = cleanText(titleLink?.[3] ?? cells[2]);
  const department = cleanText(cells[3]);
  const url = stableBonfireOpportunityUrl(safeAbsoluteUrl(decodeHtml(titleLink?.[2] ?? ""), BOULDER_COUNTY_BIDS_URL)) ?? BOULDER_COUNTY_BIDS_URL;
  const haystack = [title, solicitationId, department, "Boulder County bid proposal solicitation Bonfire"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 74 - Math.min(index, 25));

  if (!title || !solicitationId || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `boulder-county:${solicitationId}:${title}`,
    resultType: "opportunity",
    title,
    buyer: "Boulder County",
    sourceName: "Boulder County Purchasing",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "Official county solicitation chart with Bonfire portal links",
    url,
    portalUrl: BOULDER_COUNTY_PROCUREMENT_PORTAL_URL,
    score,
    status: "Open public solicitation",
    solicitationId,
    deadline,
    documents: [department ? `Department: ${department}` : undefined].filter((value): value is string => Boolean(value)),
    documentLinks: [{ label: "Boulder County Bonfire opportunity and documents", url }],
    submissionInstructions:
      "Open the Boulder County Bonfire opportunity, review the official files and addenda, register or sign in if submission is required, and submit through the procurement portal before the due date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [solicitationId ? `Solicitation ${solicitationId}.` : "", department ? `Department: ${department}.` : "", deadline ? `Due ${deadline}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the Bonfire opportunity, download the official documents and addenda, then decide whether to save it for drafting.",
  };
}

function stableBonfireOpportunityUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.startsWith("__cf_")) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

async function searchArapahoeCountyPurchasing(query: string): Promise<SearchTaskResult> {
  const source = "Arapahoe County Purchasing";
  try {
    const response = await fetchPublicPage(ARAPAHOE_BIDNET_OPEN_BIDS_URL);
    if (!response.ok) {
      return { source, results: [], error: `BidNet Direct returned ${response.status}` };
    }

    return {
      source,
      results: parseBidNetAgencySolicitations(await response.text(), query, {
        sourceName: source,
        buyer: "Arapahoe County",
        sourceLevel: "Local",
        sourceState: "CO",
        sourceType: "BidNet Direct public opportunity page",
        portalUrl: ARAPAHOE_BIDNET_PORTAL_URL,
        openBidsUrl: ARAPAHOE_BIDNET_OPEN_BIDS_URL,
        submissionInstructions:
          "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
      }),
    };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

type BidNetAgencySource = {
  sourceName: string;
  buyer: string;
  sourceLevel: string;
  sourceState: string;
  sourceType: string;
  portalUrl: string;
  openBidsUrl: string;
  submissionInstructions: string;
};

async function searchBidNetAgency(query: string, source: BidNetAgencySource): Promise<SearchTaskResult> {
  try {
    const response = await fetchPublicPage(source.openBidsUrl);
    if (!response.ok) {
      return { source: source.sourceName, results: [], error: `BidNet Direct returned ${response.status}` };
    }

    return {
      source: source.sourceName,
      results: parseBidNetAgencySolicitations(await response.text(), query, source),
    };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

function searchColoradoSpringsPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "City of Colorado Springs Procurement",
    buyer: "City of Colorado Springs",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: COLORADO_SPRINGS_BIDNET_PORTAL_URL,
    openBidsUrl: COLORADO_SPRINGS_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchAuroraPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "City of Aurora Purchasing",
    buyer: "City of Aurora",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: AURORA_BIDNET_PORTAL_URL,
    openBidsUrl: AURORA_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchFortCollinsPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "City of Fort Collins Purchasing",
    buyer: "City of Fort Collins",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: FORT_COLLINS_BIDNET_PORTAL_URL,
    openBidsUrl: FORT_COLLINS_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchDenverPublicSchoolsPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "Denver Public Schools Purchasing",
    buyer: "Denver Public Schools",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: DENVER_PUBLIC_SCHOOLS_BIDNET_PORTAL_URL,
    openBidsUrl: DENVER_PUBLIC_SCHOOLS_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchDenverAirportBusinessOpportunities(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "Denver International Airport Business Opportunities",
    buyer: "City and County of Denver Department of Aviation",
    sourceLevel: "Adjacent",
    sourceState: "CO",
    sourceType: "BidNet Direct / Rocky Mountain E-Purchasing public opportunity page",
    portalUrl: DENVER_AIRPORT_BIDNET_PORTAL_URL,
    openBidsUrl: DENVER_AIRPORT_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchDouglasCountyColoradoPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "Douglas County Purchasing",
    buyer: "Douglas County Colorado",
    sourceLevel: "Local",
    sourceState: "CO",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: DOUGLAS_COUNTY_CO_BIDNET_PORTAL_URL,
    openBidsUrl: DOUGLAS_COUNTY_CO_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchUniversityOfColoradoPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "University of Colorado Procurement Service Center",
    buyer: "University of Colorado",
    sourceLevel: "Education",
    sourceState: "CO",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: UNIVERSITY_OF_COLORADO_BIDNET_PORTAL_URL,
    openBidsUrl: UNIVERSITY_OF_COLORADO_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchColoradoStateUniversityPurchasing(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "Colorado State University Procurement Services",
    buyer: "Colorado State University System",
    sourceLevel: "Education",
    sourceState: "CO",
    sourceType: "BidNet Direct / Rocky Mountain E-Purchasing public opportunity page",
    portalUrl: COLORADO_STATE_UNIVERSITY_BIDNET_PORTAL_URL,
    openBidsUrl: COLORADO_STATE_UNIVERSITY_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Rocky Mountain E-Purchasing before the closing date.",
  });
}

function searchFultonCountyBidOpportunities(query: string): Promise<SearchTaskResult> {
  return searchBidNetAgency(query, {
    sourceName: "Fulton County Bid Opportunities",
    buyer: "Fulton County",
    sourceLevel: "Local",
    sourceState: "GA",
    sourceType: "BidNet Direct public opportunity page",
    portalUrl: FULTON_COUNTY_BIDNET_PORTAL_URL,
    openBidsUrl: FULTON_COUNTY_BIDNET_OPEN_BIDS_URL,
    submissionInstructions:
      "Open the BidNet Direct posting, download the solicitation packet and addenda, confirm registration/submission requirements, and submit through BidNet Direct/Georgia Purchasing Group before the closing date.",
  });
}

async function searchGeorgiaProcurementRegistry(query: string): Promise<SearchTaskResult> {
  const source = "Georgia Procurement Registry";

  try {
    const response = await fetchWithTimeout(
      GEORGIA_GPR_EVENT_SEARCH_URL,
      {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: GEORGIA_GPR_URL,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: georgiaGprSearchBody(),
        cache: "no-store",
      },
      15000,
    );

    if (!response.ok) {
      return { source, results: [], error: `Georgia Procurement Registry returned ${response.status}` };
    }

    const payload = (await response.json()) as GeorgiaGprEventSearchResponse;
    if (payload.error) {
      return { source, results: [], error: payload.error };
    }

    return { source, results: parseGeorgiaGprEvents(payload.data ?? [], query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function georgiaGprSearchBody() {
  const params = new URLSearchParams();
  const columns = ["", "", "title", "agencyName", "", "closingDate", "postingDate", "status"];

  params.set("draw", "1");
  columns.forEach((column, index) => {
    params.set(`columns[${index}][data]`, column);
    params.set(`columns[${index}][name]`, "");
    params.set(`columns[${index}][searchable]`, "true");
    params.set(`columns[${index}][orderable]`, "true");
    params.set(`columns[${index}][search][value]`, "");
    params.set(`columns[${index}][search][regex]`, "false");
  });
  params.set("order[0][column]", "5");
  params.set("order[0][dir]", "asc");
  params.set("start", "0");
  params.set("length", "500");
  params.set("search[value]", "");
  params.set("search[regex]", "false");
  params.set("responseType", "");
  params.set("eventStatus", "OPEN");
  params.set("eventIdTitle", "");
  params.set("govType", "ALL");
  params.set("govEntity", "");
  params.set("catType", "");
  params.set("eventProcessType", "");
  params.set("dateRangeType", "");
  params.set("rangeStartDate", "");
  params.set("rangeEndDate", "");
  params.set("isReset", "false");
  params.set("persisted", "false");
  params.set("refreshSearchData", "true");

  return params.toString();
}

function parseGeorgiaGprEvents(events: GeorgiaGprEvent[], query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return events
    .map((event, index) => georgiaGprEventToResult(event, terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function georgiaGprEventToResult(event: GeorgiaGprEvent, terms: string[], index: number): UnifiedSearchResult | undefined {
  const title = event.title?.trim();
  const solicitationId = event.esourceNumber?.trim();
  const buyer = event.agencyName?.trim() || "Georgia Procurement Registry";
  const deadline = event.closingDateStr?.trim() || event.closingDate?.trim();
  const postedDate = event.postingDateStr?.trim() || event.postingDate?.trim();
  const governmentType = event.governmentType?.trim();
  const bidProcessType = event.bidProcessType?.trim();
  const detailKey = event.esourceNumberKey?.trim() || solicitationId;
  const sourceSystemType = event.sourceId?.trim();
  const detailUrl =
    detailKey && sourceSystemType
      ? `${GEORGIA_GPR_URL}eventDetails?eSourceNumber=${encodeURIComponent(detailKey)}&sourceSystemType=${encodeURIComponent(sourceSystemType)}`
      : GEORGIA_GPR_URL;
  const haystack = [
    title,
    solicitationId,
    buyer,
    event.status,
    governmentType,
    bidProcessType,
    event.electronicBid ? "electronic bid online submission" : "",
    "Georgia Procurement Registry bid RFP RFQ solicitation state local government",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 73 - Math.min(index, 40));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const documents = [
    solicitationId ? `Solicitation ID: ${solicitationId}` : undefined,
    bidProcessType ? `Process type: ${bidProcessType}` : undefined,
    governmentType ? `Government type: ${governmentType}` : undefined,
    postedDate ? `Posted: ${postedDate}` : undefined,
    typeof event.electronicBid === "boolean" ? `Electronic bid: ${event.electronicBid ? "Yes" : "No"}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    id: `georgia-gpr:${solicitationId || title}`,
    resultType: "opportunity",
    title,
    buyer,
    sourceName: "Georgia Procurement Registry",
    sourceLevel: "State",
    sourceState: "GA",
    sourceType: "Georgia Procurement Registry public eventSearch feed",
    url: detailUrl,
    portalUrl: GEORGIA_GPR_URL,
    score,
    status: event.status || "Open public registry event",
    solicitationId,
    postedDate,
    deadline,
    documents,
    documentLinks: [{ label: "Georgia Procurement Registry event detail", url: detailUrl }],
    submissionInstructions:
      "Open the Georgia Procurement Registry event detail, download the official attachments and addenda, confirm vendor registration or electronic-bid requirements, and submit by the closing date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [
      solicitationId ? `Solicitation ${solicitationId}.` : "",
      bidProcessType ? `${bidProcessType}.` : "",
      deadline ? `Closes ${deadline}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the GPR event detail, download the official documents and addenda, then decide whether to save it for draft response work.",
  };
}

async function searchMiamiDadeProcurement(query: string): Promise<SearchTaskResult> {
  const source = "Miami-Dade County Procurement";

  try {
    const [currentResult, futureResult] = await Promise.allSettled([
      fetchMiamiDadeCurrentSolicitations(),
      fetchMiamiDadeFutureSolicitations(),
    ]);
    const currentRows = currentResult.status === "fulfilled" ? currentResult.value : [];
    const futureRows = futureResult.status === "fulfilled" ? futureResult.value : [];

    if (currentResult.status === "rejected" && futureResult.status === "rejected") {
      return {
        source,
        results: [],
        error: `Miami-Dade current and future solicitation feeds failed: ${errorMessage(currentResult.reason)}; ${errorMessage(futureResult.reason)}`,
      };
    }

    return {
      source,
      results: [
        ...parseMiamiDadeCurrentSolicitations(currentRows, query),
        ...parseMiamiDadeFutureSolicitations(futureRows, query),
      ].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)),
    };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

async function fetchMiamiDadeCurrentSolicitations() {
  return fetchMiamiDadeJson<MiamiDadeCurrentSolicitation[]>(
    MIAMI_DADE_CURRENT_SOLICITATIONS_API_URL,
    MIAMI_DADE_CURRENT_SOLICITATIONS_URL,
  );
}

async function fetchMiamiDadeFutureSolicitations() {
  return fetchMiamiDadeJson<MiamiDadeFutureSolicitation[]>(MIAMI_DADE_FUTURE_SOLICITATIONS_API_URL, MIAMI_DADE_FUTURE_SOLICITATIONS_URL);
}

async function fetchMiamiDadeJson<T>(url: string, referer: string): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: referer,
        "X-Requested-With": "XMLHttpRequest",
      },
      cache: "no-store",
    },
    12000,
  );

  if (!response.ok) {
    throw new Error(`Miami-Dade feed returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseMiamiDadeCurrentSolicitations(rows: MiamiDadeCurrentSolicitation[], query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return rows
    .map((row, index) => miamiDadeCurrentSolicitationToResult(row, terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result));
}

function miamiDadeCurrentSolicitationToResult(
  row: MiamiDadeCurrentSolicitation,
  terms: string[],
  index: number,
): UnifiedSearchResult | undefined {
  const title = row.title?.trim();
  const solicitationId = row.solicitationNumber?.trim();
  const solicitationType = row.solicitationType?.trim();
  const deadline = row.openingDate?.trim();
  const postedDate = row.postedDate?.trim();
  const haystack = [title, solicitationId, solicitationType, "Miami-Dade County construction bids contracts solicitation"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 75 - Math.min(index, 35));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const url = solicitationId
    ? `${MIAMI_DADE_CURRENT_SOLICITATIONS_URL.replace(/CurrentSolicitations$/, "SolicitationDetails")}?solNumber=${encodeURIComponent(solicitationId)}`
    : MIAMI_DADE_CURRENT_SOLICITATIONS_URL;
  const documents = [
    solicitationType ? `Solicitation type: ${solicitationType}` : undefined,
    postedDate ? `Posted: ${postedDate}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    id: `miami-dade:current:${solicitationId ?? title}`,
    resultType: "opportunity",
    title,
    buyer: "Miami-Dade County",
    sourceName: "Miami-Dade County Procurement",
    sourceLevel: "Local",
    sourceState: "FL",
    sourceType: "Miami-Dade public solicitations JSON feed",
    url,
    portalUrl: MIAMI_DADE_CURRENT_SOLICITATIONS_URL,
    score,
    status: "Open public solicitation",
    solicitationId,
    postedDate,
    deadline,
    documents,
    documentLinks: [{ label: "Miami-Dade solicitation detail", url }],
    submissionInstructions:
      "Open the Miami-Dade solicitation detail page, download the official documents and addenda, confirm registration and submission requirements, and submit before the opening date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [solicitationId ? `Solicitation ${solicitationId}.` : "", postedDate ? `Posted ${postedDate}.` : "", deadline ? `Opens ${deadline}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the Miami-Dade detail page, download the official solicitation packet and addenda, then decide whether to save it for drafting.",
  };
}

function parseMiamiDadeFutureSolicitations(rows: MiamiDadeFutureSolicitation[], query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return rows
    .map((row, index) => miamiDadeFutureSolicitationToResult(row, terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result));
}

function miamiDadeFutureSolicitationToResult(
  row: MiamiDadeFutureSolicitation,
  terms: string[],
  index: number,
): UnifiedSearchResult | undefined {
  const title = row.documentTitle?.trim();
  const postedDate = row.releaseDate?.trim();
  const deadline = row.removalDate?.trim();
  const contact = row.emailAddress?.trim();
  const fileName = row.fileName?.trim();
  const url = fileName ? safeAbsoluteUrl(fileName, MIAMI_DADE_FUTURE_SOLICITATION_DOC_BASE_URL) ?? MIAMI_DADE_FUTURE_SOLICITATIONS_URL : MIAMI_DADE_FUTURE_SOLICITATIONS_URL;
  const haystack = [title, postedDate, deadline, contact, "Miami-Dade future solicitation forecast feedback procurement"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 69 - Math.min(index, 35));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `miami-dade:future:${fileName ?? title}`,
    resultType: "opportunity",
    title,
    buyer: "Miami-Dade County",
    sourceName: "Miami-Dade County Procurement",
    sourceLevel: "Local",
    sourceState: "FL",
    sourceType: "Miami-Dade future solicitations JSON feed",
    url,
    portalUrl: MIAMI_DADE_FUTURE_SOLICITATIONS_URL,
    score,
    status: "Future solicitation notice",
    postedDate,
    deadline,
    contact,
    documents: [postedDate ? `Released: ${postedDate}` : undefined, deadline ? `Notice removal date: ${deadline}` : undefined].filter(
      (value): value is string => Boolean(value),
    ),
    documentLinks: [{ label: "Miami-Dade future solicitation notice", url }],
    submissionInstructions:
      "Open the future solicitation notice, review the preview documents, save the buyer contact if listed, and monitor Miami-Dade for the official solicitation release.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: false,
      hasDeadline: Boolean(deadline),
      hasDocuments: Boolean(fileName),
      hasContact: Boolean(contact),
    }),
    summary: [postedDate ? `Released ${postedDate}.` : "", deadline ? `Notice remains posted until ${deadline}.` : "", contact ? `Contact: ${contact}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the future solicitation notice and prepare discovery questions or draft response material before the official solicitation opens.",
  };
}

async function searchGwinnettCountyPurchasing(query: string): Promise<SearchTaskResult> {
  const source = "Gwinnett County Purchasing";
  try {
    const response = await fetchPublicPage(GWINNETT_COUNTY_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Gwinnett County solicitations page returned ${response.status}` };
    }

    return { source, results: parseGwinnettCountySolicitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseGwinnettCountySolicitations(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<li\b[^>]*class=["'][^"']*\blist-group-item\b[^"']*\blist-group-item-flex\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi));

  return rows
    .map((row, index) => gwinnettCountySolicitationToResult(row[1], terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function gwinnettCountySolicitationToResult(rowHtml: string, terms: string[], index: number): UnifiedSearchResult | undefined {
  const paragraphs = Array.from(rowHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map((paragraph) => paragraph[1]);
  const idAnchor = paragraphs[0]?.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
  const solicitationId = cleanText(idAnchor?.[3] ?? paragraphs[0] ?? "");
  const title = cleanText(paragraphs[1] ?? "");
  const rowText = htmlToText(rowHtml);
  const contact = cleanText(rowHtml.match(/mailto:([^"'>\s]+)/i)?.[1] ?? "");
  const deadline = fieldFromText(rowText, /Opening Date\s*:\s*([^]+?)(?=\s+(?:Virtual Bid Opening|Addendum|Buyer Contact)|$)/i);
  const documentLinks = dedupeDocumentLinks(extractAnchorLinks(rowHtml, GWINNETT_COUNTY_SOLICITATIONS_URL));
  const url = documentLinks[0]?.url ?? GWINNETT_COUNTY_SOLICITATIONS_URL;
  const haystack = [title, solicitationId, contact, deadline, rowText, "Gwinnett County bid solicitation purchasing"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 73 - Math.min(index, 35));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `gwinnett:${solicitationId || title}`,
    resultType: "opportunity",
    title,
    buyer: "Gwinnett County",
    sourceName: "Gwinnett County Purchasing",
    sourceLevel: "Local",
    sourceState: "GA",
    sourceType: "Official county solicitations page",
    url,
    portalUrl: GWINNETT_COUNTY_SOLICITATIONS_URL,
    score,
    status: "Open public solicitation",
    solicitationId,
    deadline,
    contact,
    documents: [
      solicitationId ? `Solicitation ID: ${solicitationId}` : undefined,
      contact ? `Buyer contact: ${contact}` : undefined,
      documentLinks.length ? `${documentLinks.length} public document link(s) captured` : undefined,
    ].filter((value): value is string => Boolean(value)),
    documentLinks,
    submissionInstructions:
      "Open the Gwinnett County notice and addenda, review the official package, contact the listed buyer with questions if needed, and follow the county's submission instructions before the opening date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: documentLinks.length > 0,
      hasContact: Boolean(contact),
    }),
    summary: [solicitationId ? `Solicitation ${solicitationId}.` : "", deadline ? `Opens ${deadline}.` : "", contact ? `Buyer contact: ${contact}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the notice and addenda, download the county documents, then decide whether to save it for draft response work.",
  };
}

async function searchNorthCarolinaEvpSolicitations(
  query: string,
  scope: NorthCarolinaEvpSourceScope = {
    sourceName: "North Carolina eVP Solicitations",
    buyer: "North Carolina eVP",
    sourceLevel: "State",
  },
): Promise<SearchTaskResult> {
  try {
    const records = await fetchNorthCarolinaEvpRecords(query);
    return {
      source: scope.sourceName,
      results: parseNorthCarolinaEvpRecords(records, query, scope),
    };
  } catch (error) {
    return { source: scope.sourceName, results: [], error: errorMessage(error) };
  }
}

async function fetchNorthCarolinaEvpRecords(query: string): Promise<NorthCarolinaEvpRecord[]> {
  const normalizedQuery = query.toLowerCase().trim();
  const cacheKey = `nc-evp:${normalizedQuery}`;
  const cached = northCarolinaEvpCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.records;
  }

  const existingRequest = northCarolinaEvpInFlight.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetchNorthCarolinaEvpRecordsUncached(query).finally(() => {
    northCarolinaEvpInFlight.delete(cacheKey);
  });
  northCarolinaEvpInFlight.set(cacheKey, request);
  const records = await request;
  northCarolinaEvpCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000, records });
  return records;
}

async function fetchNorthCarolinaEvpRecordsUncached(query: string): Promise<NorthCarolinaEvpRecord[]> {
  const userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1";
  const pageResponse = await fetchWithTimeout(
    NORTH_CAROLINA_EVP_SOLICITATIONS_URL,
    {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    },
    15000,
  );

  if (!pageResponse.ok) {
    throw new Error(`North Carolina eVP page returned ${pageResponse.status}`);
  }

  const pageHtml = await pageResponse.text();
  const viewLayouts = htmlAttributeValue(pageHtml, "data-view-layouts");
  if (!viewLayouts) {
    throw new Error("North Carolina eVP page did not include grid configuration");
  }

  const configurations = JSON.parse(Buffer.from(viewLayouts, "base64").toString("utf8")) as Array<{
    Base64SecureConfiguration?: string;
    Configuration?: { SortExpression?: string };
  }>;
  const secureConfiguration = configurations[0]?.Base64SecureConfiguration;
  if (!secureConfiguration) {
    throw new Error("North Carolina eVP grid configuration did not include secure configuration");
  }

  const firstCookieHeader = cookieHeaderFromResponse(pageResponse);
  const tokenResponse = await fetchWithTimeout(
    NORTH_CAROLINA_EVP_TOKEN_URL,
    {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
        Cookie: firstCookieHeader,
        Referer: NORTH_CAROLINA_EVP_SOLICITATIONS_URL,
      },
      cache: "no-store",
    },
    10000,
  );

  if (!tokenResponse.ok) {
    throw new Error(`North Carolina eVP token endpoint returned ${tokenResponse.status}`);
  }

  const tokenHtml = await tokenResponse.text();
  const requestVerificationToken = tokenHtml.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i)?.[1];
  if (!requestVerificationToken) {
    throw new Error("North Carolina eVP token endpoint did not return a request token");
  }

  const cookieHeader = mergeCookieHeaders(firstCookieHeader, cookieHeaderFromResponse(tokenResponse));
  const response = await fetchWithTimeout(
    NORTH_CAROLINA_EVP_GRID_URL,
    {
      method: "POST",
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "__RequestVerificationToken": requestVerificationToken,
        Cookie: cookieHeader,
        Referer: NORTH_CAROLINA_EVP_SOLICITATIONS_URL,
      },
      body: JSON.stringify({
        base64SecureConfiguration: secureConfiguration,
        sortExpression: configurations[0]?.Configuration?.SortExpression || "evp_posteddate DESC",
        search: query.trim(),
        page: 1,
        pageSize: 250,
        pagingCookie: "",
        filter: null,
        metaFilter: "0=&1=&2=&3=0&4=&5=&7=",
        nlSearchFilter: null,
        timezoneOffset: 360,
        customParameters: [],
      }),
      cache: "no-store",
    },
    18000,
  );

  if (!response.ok) {
    throw new Error(`North Carolina eVP grid returned ${response.status}`);
  }

  const payload = (await response.json()) as NorthCarolinaEvpGridResponse;
  return payload.Records ?? [];
}

function parseNorthCarolinaEvpRecords(records: NorthCarolinaEvpRecord[], query: string, scope: NorthCarolinaEvpSourceScope): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return records
    .map((record, index) => northCarolinaEvpRecordToResult(record, terms, index, scope))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function northCarolinaEvpRecordToResult(
  record: NorthCarolinaEvpRecord,
  terms: string[],
  index: number,
  scope: NorthCarolinaEvpSourceScope,
): UnifiedSearchResult | undefined {
  const attributes = northCarolinaEvpAttributes(record);
  const department = attributes.get("owningbusinessunit");
  if (scope.departmentPattern && !scope.departmentPattern.test(department ?? "")) {
    return undefined;
  }

  const title = attributes.get("evp_name");
  const solicitationId = attributes.get("evp_solicitationnbr");
  const description = attributes.get("evp_description");
  const deadline = attributes.get("evp_opendate");
  const postedDate = attributes.get("evp_posteddate");
  const status = attributes.get("statuscode") || "Open";
  const recordId = record.Id || attributes.get("evp_solicitationid");
  const detailUrl = recordId
    ? `${NORTH_CAROLINA_EVP_DETAIL_URL}?id=${encodeURIComponent(recordId)}`
    : NORTH_CAROLINA_EVP_SOLICITATIONS_URL;
  const buyer = department || scope.buyer;
  const haystack = [
    title,
    solicitationId,
    description,
    buyer,
    status,
    "North Carolina eVP bid RFP RFQ solicitation state local government public procurement",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 76 - Math.min(index, 45));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const documents = [
    solicitationId ? `Solicitation ID: ${solicitationId}` : undefined,
    department ? `Department: ${department}` : undefined,
    postedDate ? `Posted: ${postedDate}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    id: `nc-evp:${scope.sourceName}:${recordId || solicitationId || title}`,
    resultType: "opportunity",
    title,
    buyer,
    sourceName: scope.sourceName,
    sourceLevel: scope.sourceLevel,
    sourceState: "NC",
    sourceType: "North Carolina eVP public solicitation grid",
    url: detailUrl,
    portalUrl: NORTH_CAROLINA_EVP_SOLICITATIONS_URL,
    score,
    status,
    solicitationId,
    postedDate,
    deadline,
    documents,
    documentLinks: [{ label: "NC eVP solicitation detail and documents", url: detailUrl }],
    submissionInstructions:
      "Open the NC eVP solicitation detail, download the official documents and addenda, confirm eVP registration and question deadline, then submit through the listed eVP process before the opening date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [description, solicitationId ? `Solicitation ${solicitationId}.` : "", deadline ? `Opens ${deadline}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the NC eVP detail page, download the solicitation packet and addenda, then decide whether to save it for draft response work.",
  };
}

function northCarolinaEvpAttributes(record: NorthCarolinaEvpRecord) {
  const attributes = new Map<string, string>();
  for (const attribute of record.Attributes ?? []) {
    if (!attribute.Name) {
      continue;
    }

    attributes.set(attribute.Name, northCarolinaEvpAttributeText(attribute));
  }

  return attributes;
}

function northCarolinaEvpAttributeText(attribute: NorthCarolinaEvpAttribute) {
  if (attribute.DisplayValue) {
    return cleanText(attribute.DisplayValue);
  }

  if (attribute.FormattedValue) {
    return cleanText(attribute.FormattedValue);
  }

  const value = attribute.Value;
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (value && typeof value === "object" && "Name" in value && typeof value.Name === "string") {
    return cleanText(value.Name);
  }

  if (value && typeof value === "object" && "Value" in value) {
    const primitiveValue = value.Value;
    if (typeof primitiveValue === "string" || typeof primitiveValue === "number") {
      return String(primitiveValue);
    }
  }

  return "";
}

function parseBidNetAgencySolicitations(html: string, query: string, source: BidNetAgencySource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<tr\b[^>]*class=["'][^"']*\bmets-table-row\b[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index) => bidNetAgencyRowToResult(row[1], terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function bidNetAgencyRowToResult(
  rowHtml: string,
  terms: string[],
  index: number,
  source: BidNetAgencySource,
): UnifiedSearchResult | undefined {
  const solicitationId = cleanText(rowHtml.match(/<div[^>]*class=["'][^"']*\bsol-num\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const linkMatch = rowHtml.match(/<a\b(?=[^>]*\bsolicitation-link\b)[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
  const title = cleanText(linkMatch?.[3] ?? "");
  const url = safeAbsoluteUrl(decodeHtml(linkMatch?.[2] ?? ""), source.openBidsUrl) ?? source.openBidsUrl;
  const region = cleanText(rowHtml.match(/<div[^>]*class=["'][^"']*\bsol-region\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*\bsol-region-item\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const dateValues = Array.from(rowHtml.matchAll(/<span[^>]*class=["'][^"']*\bdate-value\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)).map((date) =>
    cleanText(date[1]),
  );
  const postedDate = dateValues[0];
  const deadline = dateValues[1];
  const haystack = [title, solicitationId, region, postedDate, deadline, source.sourceName, source.buyer, "bid solicitation rfp rfq"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 72 - Math.min(index, 30));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const documents = [
    solicitationId ? `Solicitation ID: ${solicitationId}` : undefined,
    postedDate ? `Published: ${postedDate}` : undefined,
    region ? `Region: ${region}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    id: `bidnet:${source.sourceName}:${solicitationId || title}`,
    resultType: "opportunity",
    title,
    buyer: source.buyer,
    sourceName: source.sourceName,
    sourceLevel: source.sourceLevel,
    sourceState: source.sourceState,
    sourceType: source.sourceType,
    url,
    portalUrl: source.portalUrl,
    score,
    status: "Open public BidNet posting",
    solicitationId,
    postedDate,
    deadline,
    documents,
    documentLinks: [{ label: "BidNet posting, documents, and addenda", url }],
    submissionInstructions: source.submissionInstructions,
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [solicitationId ? `Solicitation ${solicitationId}.` : "", postedDate ? `Published ${postedDate}.` : "", deadline ? `Closes ${deadline}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the BidNet posting, download the official documents and addenda, then decide whether to save it for draft response work.",
  };
}

async function searchTheWoodlands(query: string): Promise<{ source: string; results: UnifiedSearchResult[]; error?: string }> {
  try {
    const response = await fetchPublicPage(THE_WOODLANDS_BIDS_URL);

    if (response.ok) {
      const html = await response.text();
      return {
        source: "The Woodlands Township Bids",
        results: parseTheWoodlandsBids(html, query),
      };
    }

    const fallbackResponse = await fetchPublicPage(VISIT_THE_WOODLANDS_BIDS_URL);
    if (!fallbackResponse.ok) {
      return {
        source: "The Woodlands Township Bids",
        results: [],
        error: `Township page returned ${response.status}; Visit The Woodlands fallback returned ${fallbackResponse.status}`,
      };
    }

    const html = await fallbackResponse.text();
    return {
      source: "The Woodlands Township Bids",
      results: parseVisitTheWoodlandsBids(html, query),
    };
  } catch (error) {
    return { source: "The Woodlands Township Bids", results: [], error: errorMessage(error) };
  }
}

function parseTheWoodlandsBids(html: string, query: string): UnifiedSearchResult[] {
  const openStart = html.search(/<h3\b[^>]*>\s*Open Bids\s*<\/h3>/i);
  const closedStart = html.search(/<h3\b[^>]*>\s*Closed\/Awarded Bids\s*<\/h3>/i);
  const mainEnd = html.indexOf("</main>", openStart);
  const openSection =
    openStart >= 0
      ? html.slice(openStart, closedStart > openStart ? closedStart : mainEnd > openStart ? mainEnd : undefined)
      : "";
  const entries = Array.from(openSection.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|$)/gi));
  const terms = conceptTerms(query);

  return entries
    .map((entry, index) => theWoodlandsEntryToResult(entry[1], entry[2], terms, index))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function parseVisitTheWoodlandsBids(html: string, query: string): UnifiedSearchResult[] {
  const openStart = html.search(/<h4\b[^>]*>\s*OPEN\s*<\/h4>/i);
  const closedStart = html.search(/<h4\b[^>]*>\s*CLOSED\s*<\/h4>/i);
  const openSection =
    openStart >= 0
      ? html.slice(openStart, closedStart > openStart ? closedStart : undefined)
      : "";
  const entries = Array.from(openSection.matchAll(/<h6\b[^>]*>([\s\S]*?)<\/h6>([\s\S]*?)(?=<h6\b|$)/gi));
  const terms = conceptTerms(query);

  return entries
    .map((entry, index) => theWoodlandsEntryToResult(entry[1], entry[2], terms, index, VISIT_THE_WOODLANDS_BIDS_URL))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function theWoodlandsEntryToResult(
  titleHtml: string,
  bodyHtml: string,
  terms: string[],
  index: number,
  baseUrl = THE_WOODLANDS_BIDS_URL,
): UnifiedSearchResult | undefined {
  const title = cleanText(titleHtml);
  const description = cleanText(bodyHtml.split(/<strong>\s*Closing Date/i)[0] ?? bodyHtml);
  const deadline = cleanText(bodyHtml.match(/<strong>\s*Closing Date:?<\/strong>\s*:?\s*([\s\S]*?)(?:<br|<\/p>)/i)?.[1] ?? "");
  const contact = cleanText(bodyHtml.match(/<strong>\s*Contact:?[\s\S]*?<\/strong>\s*([\s\S]*?)(?:<\/p>|<br)/i)?.[1] ?? "");
  const documentLinks = dedupeDocumentLinks(extractAnchorLinks(bodyHtml, baseUrl)).filter((link) => !link.url.startsWith("mailto:"));
  const url = documentLinks[0]?.url ?? baseUrl;
  const documents = documentLinks.map((link) => link.label).filter(Boolean);
  const haystack = [title, description, deadline, contact, documents.join(" "), "the woodlands township bids"].filter(Boolean).join(" ").toLowerCase();
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
    portalUrl: baseUrl,
    score,
    status: "Open/public posting",
    deadline,
    contact,
    documents,
    documentLinks: documentLinks.length ? documentLinks : undefined,
    submissionInstructions: "Open the Township bid document and follow the stated submission method, required forms, and closing date.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: Boolean(deadline), hasDocuments: documentLinks.length > 0, hasContact: Boolean(contact) }),
    summary: [description, contact ? `Contact: ${contact}.` : ""].filter(Boolean).join(" "),
    nextAction: "Open the Township bid document, confirm the submission method and due date, then route it for human review.",
  };
}

async function searchTexasDirSolicitationSchedule(query: string): Promise<SearchTaskResult> {
  const source = "Texas DIR Schedule of Solicitation Opportunities";
  try {
    const response = await fetchWithTimeout(TEXAS_DIR_SOLICITATION_SCHEDULE_URL, { cache: "no-store" }, 12000);
    if (!response.ok) {
      return { source, results: [], error: `Texas DIR schedule returned ${response.status}` };
    }

    return { source, results: parseTexasDirSolicitationSchedule(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseTexasDirSolicitationSchedule(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const items = Array.from(html.matchAll(/<div[^>]*class="[^"]*\bparagraph--type--accordion-item\b[^"]*"[^>]*>[\s\S]*?<div[^>]*class="heading"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div[^>]*class="accordion-body"[^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/gi));

  return items
    .map((item, index): UnifiedSearchResult | undefined => {
      const title = cleanText(item[1]);
      const bodyHtml = item[2];
      const bodyText = htmlToText(bodyHtml);
      const phase = nearestPreviousHeading(html, item.index ?? 0) ?? "DIR solicitation schedule";
      const solicitationId = fieldFromText(bodyText, /RFO Number:?\s*([A-Z0-9# -]+(?:SOL-\d+)?)/i);
      const releaseDate =
        fieldFromText(bodyText, /Tentative Solicitation Release Date:?\s*([^•]+?)(?=\s+DIR Contact:|\s+RFO Number:|\s+Procurement Type:|$)/i) ??
        fieldFromText(bodyText, /Solicitation Release Date:?\s*([^•]+?)(?=\s+DIR Contact:|\s+RFO Number:|\s+Procurement Type:|$)/i);
      const startDate =
        fieldFromText(bodyText, /Start Date(?: for Planning)?:?\s*([^•]+?)(?=\s+Solicitation Release Date:|\s+Tentative Solicitation Release Date:|\s+DIR Contact:|$)/i);
      const procurementType = fieldFromText(bodyText, /Procurement Type:?\s*([^•]+?)(?=\s+Start Date:|\s+DIR Contact:|\s+RFO Number:|$)/i);
      const contact = fieldFromText(bodyText, /DIR Contact:?\s*([^•]+?)(?=\s+DIR Email:|\s+RFO Number:|$)/i);
      const documentLinks = extractAnchorLinks(bodyHtml, TEXAS_DIR_SOLICITATION_SCHEDULE_URL)
        .filter((link) => /txsmartbuy|esbd|sol|rfo/i.test(`${link.label} ${link.url}`))
        .slice(0, 4);
      const description = bodyText
        .replace(/\s*(Start Date|Solicitation Release Date|Tentative Solicitation Release Date|DIR Contact|DIR Email|RFO Number|Procurement Type):[\s\S]*$/i, "")
        .trim();
      const haystack = [title, description, phase, solicitationId, releaseDate, procurementType, contact].filter(Boolean).join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, phase.toLowerCase().includes("posting") ? 72 : 58);

      if (!title || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      const url = documentLinks[0]?.url ?? TEXAS_DIR_SOLICITATION_SCHEDULE_URL;
      const documents = [
        `Phase: ${phase}`,
        procurementType ? `Procurement type: ${procurementType}` : undefined,
        releaseDate ? `Solicitation release: ${releaseDate}` : undefined,
      ].filter((value): value is string => Boolean(value));

      return {
        id: `texas-dir:${solicitationId ?? title}`,
        resultType: "opportunity",
        title,
        buyer: "Texas Department of Information Resources",
        sourceName: "Texas DIR Schedule of Solicitation Opportunities",
        sourceLevel: "State",
        sourceState: "TX",
        sourceType: "Official DIR solicitation schedule",
        url,
        portalUrl: TEXAS_DIR_SOLICITATION_SCHEDULE_URL,
        score,
        status: phase.toLowerCase().includes("posting") ? "Posting phase / active solicitation" : `${phase} / upcoming solicitation`,
        solicitationId,
        postedDate: startDate,
        deadline: releaseDate,
        contact,
        documents,
        documentLinks: documentLinks.length ? documentLinks : [{ label: "DIR solicitation schedule", url: TEXAS_DIR_SOLICITATION_SCHEDULE_URL }],
        submissionInstructions:
          phase.toLowerCase().includes("posting")
            ? "Open the linked DIR/ESBD posting, download all response documents and addenda, and follow the official RFO submission instructions."
            : "This is a schedule or pre-solicitation item. Track the release date and monitor the linked ESBD/DIR posting for official response documents.",
        applicationChecklist: applicationChecklist({
          hasSolicitationId: Boolean(solicitationId),
          hasDeadline: Boolean(releaseDate),
          hasDocuments: documentLinks.length > 0,
          hasContact: Boolean(contact),
        }),
        summary: [description, releaseDate ? `Release date: ${releaseDate}.` : "", contact ? `DIR contact: ${contact}.` : ""]
          .filter(Boolean)
          .join(" "),
        nextAction: "Open the DIR schedule or linked ESBD posting, confirm whether it is active or upcoming, then add it to the pursuit tracker if relevant.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchBuyBoardProposalInvitations(query: string): Promise<SearchTaskResult> {
  const source = "BuyBoard Current Proposal Invitations";
  try {
    const response = await fetchPublicPage(BUYBOARD_PROPOSAL_INVITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `BuyBoard proposal invitations returned ${response.status}` };
    }

    return { source, results: parseBuyBoardProposalInvitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseBuyBoardProposalInvitations(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const currentStart = html.search(/<h2[^>]*id=["']current-proposal-invitations["'][^>]*>/i);
  const upcomingStart = html.search(/<h2[^>]*id=["']upcoming-proposal-invitations["'][^>]*>/i);
  const currentSection = currentStart >= 0 ? html.slice(currentStart, upcomingStart > currentStart ? upcomingStart : undefined) : html;
  const rows = Array.from(currentSection.matchAll(/<tr>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index): UnifiedSearchResult | undefined => {
      const cells = Array.from(row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);
      if (cells.length < 4 || /Proposal No/i.test(cleanText(cells[0]))) {
        return undefined;
      }

      const proposalLinks = extractAnchorLinks(cells[0], BUYBOARD_PROPOSAL_INVITATIONS_URL);
      const addendumLinks = extractAnchorLinks(cells[1], BUYBOARD_PROPOSAL_INVITATIONS_URL);
      const solicitationId = cleanText(cells[0]);
      const proposalName = cleanText(cells[2]);
      const deadline = cleanText(cells[3]);
      const documentLinks = [...proposalLinks, ...addendumLinks].slice(0, 8);
      const documents = documentLinks.map((link) => link.label).filter(Boolean);
      const title = [solicitationId, proposalName].filter(Boolean).join(": ");
      const haystack = [title, documents.join(" "), deadline, "BuyBoard local government purchasing cooperative proposal invitation"]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const score = scoreOpportunity(haystack, terms, 72 - Math.min(index, 30));

      if (!solicitationId || !proposalName || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (isPastDeadline(deadline)) {
        return undefined;
      }

      return {
        id: `buyboard:${solicitationId}:${proposalName}`,
        resultType: "opportunity",
        title,
        buyer: "BuyBoard / Local Government Purchasing Cooperative",
        sourceName: "BuyBoard Current Proposal Invitations",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Public cooperative proposal invitations",
        url: documentLinks[0]?.url ?? BUYBOARD_PROPOSAL_INVITATIONS_URL,
        portalUrl: BUYBOARD_PROPOSAL_INVITATIONS_URL,
        score,
        status: "Current public proposal invitation",
        solicitationId,
        deadline,
        documents,
        documentLinks,
        submissionInstructions:
          "Download the BuyBoard proposal packet and all addenda, complete the required forms locally, then submit through the BuyBoard electronic proposal system before the due date.",
        applicationChecklist: applicationChecklist({
          hasSolicitationId: Boolean(solicitationId),
          hasDeadline: Boolean(deadline),
          hasDocuments: documentLinks.length > 0,
          hasContact: false,
        }),
        summary: `${proposalName}. Proposal due ${deadline}.`,
        nextAction: "Open the proposal PDF, review forms/addenda, and decide whether to add this cooperative category to the pursuit tracker.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchChoicePartnersCurrentRfps(query: string): Promise<SearchTaskResult> {
  const source = "Choice Partners Current RFPs";
  try {
    const response = await fetchPublicPage(CHOICE_PARTNERS_CURRENT_RFPS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Choice Partners current RFPs returned ${response.status}` };
    }

    return { source, results: parseChoicePartnersCurrentRfps(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseChoicePartnersCurrentRfps(html: string, query: string): UnifiedSearchResult[] {
  if (/No Current Solicitations Available at This Time/i.test(htmlToText(html))) {
    return [];
  }

  const terms = conceptTerms(query);
  const links = dedupeDocumentLinks(extractAnchorLinks(html, CHOICE_PARTNERS_CURRENT_RFPS_URL)).filter((link) =>
    hasOpportunityLanguage(`${link.label} ${link.url}`),
  );

  return links
    .map((link, index): UnifiedSearchResult | undefined => {
      const haystack = [link.label, link.url, "Choice Partners Harris County Department of Education cooperative RFP"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 58 - Math.min(index, 20));

      if (terms.length > 0 && score <= 0) {
        return undefined;
      }

      return {
        id: `choice-current:${link.url}`,
        resultType: "opportunity",
        title: link.label || "Choice Partners current RFP",
        buyer: "Choice Partners / Harris County Department of Education",
        sourceName: "Choice Partners Current RFPs",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Public cooperative RFP page",
        url: link.url,
        portalUrl: CHOICE_PARTNERS_CURRENT_RFPS_URL,
        score,
        status: "Current public RFP link",
        documents: [link.label],
        documentLinks: [link],
        submissionInstructions:
          "Open the Choice Partners RFP link, review the posted documents and addenda, then follow the e-procurement submission instructions.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: true, hasContact: false }),
        summary: "Matching current RFP link found on the Choice Partners page.",
        nextAction: "Open the Choice Partners RFP link, capture the deadline and required forms, then decide whether to pursue.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchChoicePartnersUpcomingContracts(query: string): Promise<SearchTaskResult> {
  const source = "Choice Partners Upcoming Contracts";
  try {
    const response = await fetchPublicPage(CHOICE_PARTNERS_UPCOMING_CONTRACTS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Choice Partners upcoming contracts returned ${response.status}` };
    }

    return { source, results: parseChoicePartnersUpcomingContracts(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseChoicePartnersUpcomingContracts(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<tr[^>]*class=(["'])tblrows[12]\1[^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index): UnifiedSearchResult | undefined => {
      const rowHtml = row[2].replace(/<!--[\s\S]*?-->/g, "");
      const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => htmlToText(cell[1]));
      const title = cells[0];
      const estimatedAdvertiseDate = cells[1];
      const haystack = [title, estimatedAdvertiseDate, "Choice Partners upcoming cooperative contract RFP schedule"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 50 - Math.min(index, 20));

      if (!title || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (estimatedAdvertiseDate && isPastDeadline(estimatedAdvertiseDate)) {
        return undefined;
      }

      return {
        id: `choice-upcoming:${title}:${estimatedAdvertiseDate}`,
        resultType: "opportunity",
        title,
        buyer: "Choice Partners / Harris County Department of Education",
        sourceName: "Choice Partners Upcoming Contracts",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Public cooperative contract schedule",
        url: CHOICE_PARTNERS_UPCOMING_CONTRACTS_URL,
        portalUrl: CHOICE_PARTNERS_UPCOMING_CONTRACTS_URL,
        score,
        status: "Upcoming cooperative contract category",
        postedDate: estimatedAdvertiseDate,
        documents: estimatedAdvertiseDate ? [`Estimated advertise date: ${estimatedAdvertiseDate}`] : ["Upcoming contract schedule"],
        documentLinks: [{ label: "Choice Partners upcoming contracts schedule", url: CHOICE_PARTNERS_UPCOMING_CONTRACTS_URL }],
        submissionInstructions:
          "This is a planning item, not an active solicitation. Monitor the Choice Partners current RFP page near the estimated advertise date.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: true, hasContact: false }),
        summary: estimatedAdvertiseDate ? `Estimated advertise date: ${estimatedAdvertiseDate}.` : "Upcoming cooperative contract category.",
        nextAction: "Add this to the pipeline calendar and re-check Choice Partners current RFPs near the estimated advertise date.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchSourcewellOpenSolicitations(query: string): Promise<SearchTaskResult> {
  const source = "Sourcewell Open Solicitations";
  try {
    const response = await fetchPublicPage(SOURCEWELL_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Sourcewell solicitations returned ${response.status}` };
    }

    return { source, results: parseSourcewellOpenSolicitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseSourcewellOpenSolicitations(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const openStart = html.search(/<h2[^>]*>\s*Open\s*<\/h2>/i);
  const pendingStart = html.search(/<h2[^>]*>\s*Pending\s*<\/h2>/i);
  const openSection = openStart >= 0 ? html.slice(openStart, pendingStart > openStart ? pendingStart : undefined) : html;
  const rows = Array.from(
    openSection.matchAll(
      /<div class="row tr[^"]*"[^>]*>\s*<div class="col-xs-12 col-sm-8 td">\s*<a href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>\s*<\/div>\s*<div class="col-xs-12 col-sm-4 td">([\s\S]*?)<\/div>\s*<\/div>/gi,
    ),
  );

  return rows
    .map((row, index): UnifiedSearchResult | undefined => {
      const title = cleanText(row[3]);
      const url = safeAbsoluteUrl(decodeHtml(row[2]), SOURCEWELL_SOLICITATIONS_URL) ?? SOURCEWELL_SOLICITATIONS_URL;
      const deadline = htmlToText(row[4]);
      const haystack = [title, deadline, "Sourcewell national cooperative RFP solicitation public procurement"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 68 - Math.min(index, 25));

      if (!title || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (isPastDeadline(deadline)) {
        return undefined;
      }

      return {
        id: `sourcewell:${url}`,
        resultType: "opportunity",
        title,
        buyer: "Sourcewell",
        sourceName: "Sourcewell Open Solicitations",
        sourceLevel: "Adjacent",
        sourceState: "US",
        sourceType: "Public cooperative solicitation list",
        url,
        portalUrl: SOURCEWELL_SOLICITATIONS_URL,
        score,
        status: "Open public Sourcewell solicitation",
        deadline,
        documents: ["Sourcewell solicitation detail page"],
        documentLinks: [
          { label: "Sourcewell solicitation detail", url },
          { label: "Sourcewell procurement portal", url: "https://proportal.sourcewell-mn.gov/Module/Tenders/en" },
        ],
        submissionInstructions:
          "Open the Sourcewell solicitation detail and procurement portal, download the RFP/addenda, and submit through the Sourcewell portal before the due date.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: false }),
        summary: deadline ? `Response due ${deadline}.` : "Open Sourcewell solicitation.",
        nextAction: "Open the Sourcewell detail page, confirm scope and portal requirements, then add it to the tracker if the category fits.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchNaspoValuePointSolicitations(query: string): Promise<SearchTaskResult> {
  const source = "NASPO ValuePoint Current Solicitations";
  try {
    const response = await fetchPublicPage(NASPO_VALUEPOINT_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `NASPO ValuePoint solicitations returned ${response.status}` };
    }

    return { source, results: parseNaspoValuePointSolicitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseNaspoValuePointSolicitations(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const publishedStart = html.search(/Published Solicitations/i);
  const activeStart = html.search(/Active Solicitations/i);
  const publishedSection = publishedStart >= 0 ? html.slice(publishedStart, activeStart > publishedStart ? activeStart : undefined) : html;
  const blocks = publishedSection
    .split(/<div class="row solicitations-row solicitation-upcoming">/i)
    .slice(1)
    .map((block) => block.slice(0, block.search(/<div class="row solicitations-row solicitation-upcoming">/i) > 0 ? block.search(/<div class="row solicitations-row solicitation-upcoming">/i) : undefined));

  return blocks
    .map((block, index): UnifiedSearchResult | undefined => {
      const title = cleanText(block.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
      const leadState = htmlFieldFromSpan(block, "Lead State");
      const contact = htmlFieldFromSpan(block, "Contact Info");
      const solicitationId = htmlFieldFromSpan(block, "Solicitation Number");
      const releaseDate = htmlFieldFromSpan(block, "Release Date");
      const deadline = htmlFieldFromSpan(block, "Close Date");
      const documentLinks = extractAnchorLinks(block, NASPO_VALUEPOINT_SOLICITATIONS_URL).filter((link) =>
        /download|rfp|rfi|solicitation|event|bids|procurement/i.test(`${link.label} ${link.url}`),
      );
      const description = htmlToText(block.match(/<div class="col-xs-12 col-md-6 offset-md-1">([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const haystack = [
        title,
        leadState,
        contact,
        solicitationId,
        releaseDate,
        deadline,
        description,
        documentLinks.map((link) => link.label).join(" "),
        "NASPO ValuePoint cooperative procurement solicitation",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const score = scoreOpportunity(haystack, terms, 74 - Math.min(index, 25));

      if (!title || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (isPastDeadline(deadline)) {
        return undefined;
      }

      return {
        id: `naspo:${solicitationId || title}`,
        resultType: "opportunity",
        title,
        buyer: leadState ? `NASPO ValuePoint lead state: ${leadState}` : "NASPO ValuePoint",
        sourceName: "NASPO ValuePoint Current Solicitations",
        sourceLevel: "Adjacent",
        sourceState: "US",
        sourceType: "Public cooperative solicitation status page",
        url: documentLinks[0]?.url ?? NASPO_VALUEPOINT_SOLICITATIONS_URL,
        portalUrl: NASPO_VALUEPOINT_SOLICITATIONS_URL,
        score,
        status: "Published public NASPO ValuePoint solicitation",
        solicitationId,
        deadline,
        postedDate: releaseDate,
        contact,
        documents: [
          leadState ? `Lead state: ${leadState}` : undefined,
          releaseDate ? `Release date: ${releaseDate}` : undefined,
          ...documentLinks.map((link) => link.label),
        ].filter((item): item is string => Boolean(item)),
        documentLinks: documentLinks.length ? documentLinks : [{ label: "NASPO solicitation status page", url: NASPO_VALUEPOINT_SOLICITATIONS_URL }],
        submissionInstructions:
          "Open the NASPO lead-state solicitation link, download the RFP/RFI and addenda, then follow the lead state's submission portal instructions.",
        applicationChecklist: applicationChecklist({
          hasSolicitationId: Boolean(solicitationId),
          hasDeadline: Boolean(deadline),
          hasDocuments: documentLinks.length > 0,
          hasContact: Boolean(contact),
        }),
        summary: [leadState ? `Lead state: ${leadState}.` : "", deadline ? `Close date ${deadline}.` : "", description]
          .filter(Boolean)
          .join(" "),
        nextAction: "Open the lead-state link, confirm documents and submission rules, then add it to the tracker if the scope fits.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchOmniaCurrentSolicitations(query: string): Promise<SearchTaskResult> {
  const source = "OMNIA Partners Current Solicitations";
  try {
    const response = await fetchPublicPage(OMNIA_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `OMNIA solicitations page returned ${response.status}` };
    }

    return { source, results: parseOmniaCurrentSolicitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseOmniaCurrentSolicitations(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const currentStart = html.search(/Current Solicitations/i);
  const evaluationStart = html.search(/Solicitations in Evaluation/i);
  const currentSection = currentStart >= 0 ? html.slice(currentStart, evaluationStart > currentStart ? evaluationStart : undefined) : html;
  const blocks = currentSection
    .split(/<div id="c\d+" class="ce\s+ce-solicitation">/i)
    .slice(1)
    .map((block) => block.slice(0, block.search(/<div id="c\d+" class="ce\s+(?:ce-solicitation|ce-textpic)/i) > 0 ? block.search(/<div id="c\d+" class="ce\s+(?:ce-solicitation|ce-textpic)/i) : undefined));

  return blocks
    .map((block, index): UnifiedSearchResult | undefined => {
      const solicitationId = cleanText(block.match(/solicitation-ce__reference">([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const titleText = cleanText(block.match(/solicitation-ce__title">([\s\S]*?)<\/h3>/i)?.[1] ?? "");
      const leadAgency = cleanText(block.match(/solicitation-ce__agency">([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const deadline = cleanText(block.match(/solicitation-ce__response-due">Response Due:\s*([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const documentLinks = dedupeDocumentLinks(extractAnchorLinks(block, OMNIA_SOLICITATIONS_URL)).slice(0, 10);
      const documents = documentLinks.map((link) => link.label).filter(Boolean);
      const description = htmlToText(block.match(/solicitation-ce__decription">([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const title = [solicitationId, titleText].filter(Boolean).join(": ");
      const haystack = [title, leadAgency, deadline, description, documents.join(" "), "OMNIA Partners public sector cooperative solicitation"]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const score = scoreOpportunity(haystack, terms, 72 - Math.min(index, 30));

      if (!titleText || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (isPastDeadline(deadline)) {
        return undefined;
      }

      return {
        id: `omnia:${solicitationId || titleText}`,
        resultType: "opportunity",
        title,
        buyer: leadAgency ? `OMNIA lead agency: ${leadAgency}` : "OMNIA Partners",
        sourceName: "OMNIA Partners Current Solicitations",
        sourceLevel: "Adjacent",
        sourceState: "US",
        sourceType: "Public cooperative solicitation page",
        url: documentLinks[0]?.url ?? OMNIA_SOLICITATIONS_URL,
        portalUrl: OMNIA_SOLICITATIONS_URL,
        score,
        status: "Current public cooperative solicitation",
        solicitationId,
        deadline,
        documents,
        documentLinks,
        submissionInstructions:
          "Open the OMNIA lead-agency solicitation link and any addenda, then follow that lead agency portal's response instructions and deadline.",
        applicationChecklist: applicationChecklist({
          hasSolicitationId: Boolean(solicitationId),
          hasDeadline: Boolean(deadline),
          hasDocuments: documentLinks.length > 0,
          hasContact: Boolean(leadAgency),
        }),
        summary: [leadAgency ? `Lead agency: ${leadAgency}.` : "", deadline ? `Response due ${deadline}.` : "", description]
          .filter(Boolean)
          .join(" "),
        nextAction: "Open the lead-agency solicitation link, confirm documents and portal requirements, then add it to the tracker if the category fits.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchEqualisCurrentSolicitations(query: string): Promise<SearchTaskResult> {
  const source = "Equalis Group Current Solicitations";
  try {
    const response = await fetchPublicPage(EQUALIS_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Equalis solicitations page returned ${response.status}` };
    }

    return { source, results: parseEqualisCurrentSolicitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseEqualisCurrentSolicitations(html: string, query: string): UnifiedSearchResult[] {
  if (/no solicitations currently open/i.test(htmlToText(html))) {
    return [];
  }

  const terms = conceptTerms(query);
  const currentStart = html.search(/Current Solicitations/i);
  const faqStart = html.search(/Commonly Asked Questions/i);
  const currentSection = currentStart >= 0 ? html.slice(currentStart, faqStart > currentStart ? faqStart : undefined) : html;
  const links = dedupeDocumentLinks(extractAnchorLinks(currentSection, EQUALIS_SOLICITATIONS_URL)).filter((link) =>
    hasOpportunityLanguage(`${link.label} ${link.url}`),
  );

  return links
    .map((link, index): UnifiedSearchResult | undefined => {
      const haystack = [link.label, link.url, "Equalis Group lead agency solicitation cooperative public sector"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 58 - Math.min(index, 20));

      if (terms.length > 0 && score <= 0) {
        return undefined;
      }

      return {
        id: `equalis:${link.url}`,
        resultType: "opportunity",
        title: link.label || "Equalis Group current solicitation",
        buyer: "Equalis Group lead agency",
        sourceName: "Equalis Group Current Solicitations",
        sourceLevel: "Adjacent",
        sourceState: "US",
        sourceType: "Public cooperative solicitation page",
        url: link.url,
        portalUrl: EQUALIS_SOLICITATIONS_URL,
        score,
        status: "Current public solicitation link",
        documents: [link.label],
        documentLinks: [link],
        submissionInstructions:
          "Open the Equalis lead-agency solicitation link, download the packet and addenda, then follow the listed portal instructions.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: true, hasContact: false }),
        summary: "Matching solicitation link found on the Equalis current solicitations page.",
        nextAction: "Open the Equalis link, capture deadline and submission rules, then decide whether to pursue.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
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
        documentLinks: [{ label: "SAM.gov opportunity package", url }],
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
    const useSharedNigpBatches = agencySource.agencyNumbers.length > 4 && nigpCodes.length > 0;
    const batchTasks = useSharedNigpBatches
      ? nigpCodes.map((nigp) => () => fetchTexasEsbdBatch({ nigp, status: TEXAS_ESBD_ACTIVE_STATUS }))
      : agencySource.agencyNumbers.flatMap((agencyNumber) =>
          nigpCodes.length > 0
            ? nigpCodes.map((nigp) => () => fetchTexasEsbdBatch({ agencyNumber, nigp, status: TEXAS_ESBD_ACTIVE_STATUS }))
            : [() => fetchTexasEsbdPages({ agencyNumber, status: TEXAS_ESBD_ACTIVE_STATUS }, TEXAS_ESBD_DEFAULT_RECENT_PAGES)],
        );
    const batches = await runLimited(batchTasks, 4);

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

type TexasEsbdBatchResult = { lines: TexasEsbdLine[]; error?: string };

async function fetchTexasEsbdBatch(params: Record<string, string>): Promise<TexasEsbdBatchResult> {
  const cacheKey = `esbd-batch:${stableParamKey(params)}`;
  const cached = texasEsbdBatchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingRequest = texasEsbdBatchInFlight.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetchTexasEsbdBatchUncached(params).finally(() => {
    texasEsbdBatchInFlight.delete(cacheKey);
  });
  texasEsbdBatchInFlight.set(cacheKey, request);

  const value = await request;
  if (!value.error) {
    texasEsbdBatchCache.set(cacheKey, { expiresAt: Date.now() + TEXAS_ESBD_SUCCESS_CACHE_MS, value });
  }

  return value;
}

async function fetchTexasEsbdBatchUncached(params: Record<string, string>): Promise<TexasEsbdBatchResult> {
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

function stableParamKey(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

async function fetchTexasEsbdPage(payload: Record<string, string>, attempt = 0): Promise<{ data: TexasEsbdResponse; error?: string }> {
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
      if (response.status === 503 && attempt < 1) {
        await delay(1000);
        return fetchTexasEsbdPage(payload, attempt + 1);
      }

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
    documents: [`${kind} posting document`],
    documentLinks: [{ label: `${kind} posting document`, url: documentUrl }],
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
    documentLinks: [{ label: "ESBD posting and solicitation packet", url: new URL(href, TEXAS_ESBD_URL).toString() }],
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

  const url = new URL(line.url || line.repostURL || (solicitationId ? `/esbd/${encodeURIComponent(solicitationId)}` : TEXAS_ESBD_URL), TEXAS_ESBD_URL).toString();

  return {
    id: `tx-esbd:${solicitationId ?? line.internalid ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer,
    sourceName: options.sourceName ?? "Texas ESBD",
    sourceLevel: "State",
    sourceState: "TX",
    sourceType: "Official ESBD service",
    url,
    portalUrl: TEXAS_ESBD_URL,
    score,
    status,
    solicitationId,
    deadline,
    postedDate: line.postingDate,
    documents: line.nigpCodes ? [`NIGP: ${line.nigpCodes}`] : [],
    documentLinks: [{ label: "ESBD posting and solicitation packet", url }],
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
type DemandStarBid = {
  bidId?: number | string;
  bidName?: string;
  bidIdentifier?: string;
  agency?: string;
  broadCastDate?: string;
  dueDate?: string;
  city?: string;
  state?: string;
  status?: string;
  planholders?: number;
};
type DemandStarAgencySearchResponse = {
  result?: DemandStarBid[];
  total?: number;
};
type GeorgiaGprEvent = {
  esourceNumber?: string;
  title?: string;
  agencyName?: string;
  closingDate?: string;
  postingDate?: string;
  status?: string;
  governmentType?: string;
  bidProcessType?: string;
  closingDateStr?: string;
  postingDateStr?: string;
  electronicBid?: boolean;
  sourceId?: string;
  esourceNumberKey?: string;
};
type GeorgiaGprEventSearchResponse = {
  data?: GeorgiaGprEvent[];
  recordsTotal?: number;
  recordsFiltered?: number;
  error?: string;
};
type NorthCarolinaEvpAttribute = {
  Name?: string;
  Value?: unknown;
  DisplayValue?: string;
  FormattedValue?: string;
};
type NorthCarolinaEvpRecord = {
  Id?: string;
  Attributes?: NorthCarolinaEvpAttribute[];
};
type NorthCarolinaEvpGridResponse = {
  MoreRecords?: boolean;
  Records?: NorthCarolinaEvpRecord[];
  NextPagePagingCookie?: string;
};
type NorthCarolinaEvpSourceScope = {
  sourceName: string;
  buyer: string;
  sourceLevel: string;
  departmentPattern?: RegExp;
};
type MiamiDadeCurrentSolicitation = {
  solicitationNumber?: string;
  solicitationType?: string;
  title?: string;
  openingDate?: string;
  postedDate?: string;
};
type MiamiDadeFutureSolicitation = {
  documentTitle?: string;
  releaseDate?: string;
  removalDate?: string;
  emailAddress?: string;
  sendFeedBack?: string;
  fileName?: string;
};
type WorkdayEvent = {
  id?: string;
  projectId?: string;
  title?: string;
  bidSubmissionDeadline?: string;
  publishedAt?: string;
  requestType?: string;
  state?: string;
  translatedState?: string;
  restricted?: boolean;
  commodityCodes?: string[];
  bidUrl?: string;
};
type WorkdayEventsResponse = {
  data?: {
    events?: {
      nodes?: WorkdayEvent[];
      totalCount?: number;
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string;
      };
    };
  };
  errors?: Array<{ message?: string }>;
};

const WORKDAY_BID_OPPORTUNITIES_QUERY = `query BidOpportunitiesQuery($first: Int, $last: Int, $before: String, $after: String, $input: EventInput!, $sortDirection: SortDirection, $sortColumn: EventSortColumn) {
  events(input: $input, first: $first, last: $last, before: $before, after: $after, sortColumn: $sortColumn, sortDirection: $sortDirection) {
    nodes {
      id
      projectId
      title
      bidSubmissionDeadline
      publishedAt
      requestType
      state
      translatedState
      restricted
      commodityCodes
      bidUrl
    }
    pageInfo {
      endCursor
      hasNextPage
    }
    totalCount
  }
}`;

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
  const title = html.match(/<title[^>]*>\s*([\s\S]*?)\s*<\/title>/i)?.[1];
  if (/Just a moment/i.test(title ?? "")) {
    return { results: [], error: "IonWave rate limited the public bid table with a platform challenge; retry after cooldown." };
  }
  if (/An error has occurred|Invalid Request/i.test(title ?? "")) {
    return { results: [], error: "IonWave returned a platform error page instead of the public bid table." };
  }

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
    documents: ["Public bid table row; packet access may require IonWave registration."],
    documentLinks: [{ label: "IonWave current bid table", url: source.currentBidsUrl }],
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
    sourceState: source.state ?? "TX",
    sourceType: "Bonfire official API",
    url: projectUrl,
    portalUrl: source.portalUrl,
    score,
    status: "Open public opportunity",
    solicitationId,
    deadline,
    documentLinks: [{ label: "Bonfire opportunity detail and files", url: projectUrl }],
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
  const departmentId = source.departmentId ?? "all";
  const url = `https://procurement.opengov.com/portal/embed/${source.portalCode}/project-list?departmentId=${encodeURIComponent(departmentId)}&status=open`;
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
  const portalBaseUrl = source.portalUrl.replace(/[?#].*$/, "").replace(/\/$/, "");
  const projectUrl = project.id ? `${portalBaseUrl}/projects/${project.id}` : source.portalUrl;

  return {
    id: `opengov:${source.sourceName}:${project.id ?? solicitationId ?? title}`,
    resultType: "opportunity",
    title: [procurementType, solicitationId, title].filter(Boolean).join(" "),
    buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: source.state ?? "TX",
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
    documentLinks: [{ label: "OpenGov project detail and documents", url: projectUrl }],
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

async function searchDemandStar(query: string, source: DemandStarSource): Promise<SearchTaskResult> {
  try {
    const cacheKey = `demandstar:${source.sourceName}:${query.toLowerCase()}`;
    const cached = demandStarCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { source: source.sourceName, ...cached.value };
    }

    const existingRequest = demandStarInFlight.get(cacheKey);
    if (existingRequest) {
      return { source: source.sourceName, ...(await existingRequest) };
    }

    const request: Promise<ConnectorSearchResult> = fetchDemandStarBids(source)
      .then((bids) => ({ results: parseDemandStarBids(bids, query, source) }))
      .finally(() => {
        demandStarInFlight.delete(cacheKey);
      });
    demandStarInFlight.set(cacheKey, request);

    const value = await request;
    demandStarCache.set(cacheKey, {
      expiresAt: Date.now() + (value.error ? DEMANDSTAR_ERROR_CACHE_MS : DEMANDSTAR_SUCCESS_CACHE_MS),
      value,
    });

    return { source: source.sourceName, ...value };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function fetchDemandStarBids(source: DemandStarSource): Promise<DemandStarBid[]> {
  const url = `${DEMANDSTAR_API_BASE_URL}/agency/search?id=${encodeURIComponent(source.agencyGuid)}`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "application/json, text/plain, */*",
        Referer: source.portalUrl,
      },
      cache: "no-store",
    },
    DEMANDSTAR_FETCH_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`DemandStar agency feed returned ${response.status}`);
  }

  const data = (await response.json()) as DemandStarAgencySearchResponse | DemandStarBid[];
  return Array.isArray(data) ? data : data.result ?? [];
}

function parseDemandStarBids(bids: DemandStarBid[], query: string, source: DemandStarSource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return bids
    .map((bid, index) => demandStarBidToResult(bid, terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function demandStarBidToResult(
  bid: DemandStarBid,
  terms: string[],
  index: number,
  source: DemandStarSource,
): UnifiedSearchResult | undefined {
  const bidId = typeof bid.bidId === "number" ? String(bid.bidId) : bid.bidId?.trim();
  const title = bid.bidName?.trim();
  const solicitationId = bid.bidIdentifier?.trim();
  const postedDate = formatIsoDateTime(bid.broadCastDate);
  const deadline = formatIsoDateTime(bid.dueDate);
  const status = bid.status?.trim() || "Open public DemandStar posting";
  const buyer = bid.agency?.trim() || source.buyer;
  const location = [bid.city, bid.state].filter(Boolean).join(", ");
  const haystack = [title, solicitationId, buyer, location, status, "DemandStar bid rfp rfq solicitation"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 72 - Math.min(index, 45));

  if (!title || (terms.length > 0 && score <= 0)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const url = bidId ? `https://www.demandstar.com/app/limited/bids/${encodeURIComponent(bidId)}/details` : source.portalUrl;
  const documents = [
    solicitationId ? `Bid identifier: ${solicitationId}` : undefined,
    postedDate ? `Broadcast date: ${postedDate}` : undefined,
    location ? `Location: ${location}` : undefined,
    typeof bid.planholders === "number" ? `Planholders: ${bid.planholders}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    id: `demandstar:${source.sourceName}:${bidId ?? solicitationId ?? title}`,
    resultType: "opportunity",
    title,
    buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: source.state,
    sourceType: "DemandStar public agency feed",
    url,
    portalUrl: source.portalUrl,
    score,
    status,
    solicitationId,
    postedDate,
    deadline,
    documents,
    documentLinks: [{ label: "DemandStar posting and documents", url }],
    submissionInstructions:
      "Open the DemandStar posting, register or sign in if required, download the official documents and addenda, then submit through the listed DemandStar or agency process before the due date.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [solicitationId ? `Bid ${solicitationId}.` : "", postedDate ? `Broadcast ${postedDate}.` : "", deadline ? `Due ${deadline}.` : ""]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the DemandStar posting, download the official package and addenda, then decide whether to save it for drafting.",
  };
}

async function searchWorkday(query: string, source: WorkdaySource): Promise<SearchTaskResult> {
  try {
    const cacheKey = `workday:${source.sourceName}:${query.toLowerCase()}`;
    const cached = workdayCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { source: source.sourceName, ...cached.value };
    }

    const existingRequest = workdayInFlight.get(cacheKey);
    if (existingRequest) {
      return { source: source.sourceName, ...(await existingRequest) };
    }

    const request: Promise<ConnectorSearchResult> = fetchWorkdayEvents(source)
      .then((events) => ({ results: parseWorkdayEvents(events, query, source) }))
      .finally(() => {
        workdayInFlight.delete(cacheKey);
      });
    workdayInFlight.set(cacheKey, request);

    const value = await request;
    workdayCache.set(cacheKey, {
      expiresAt: Date.now() + (value.error ? WORKDAY_ERROR_CACHE_MS : WORKDAY_SUCCESS_CACHE_MS),
      value,
    });

    return { source: source.sourceName, ...value };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

type WorkdaySession = {
  cookieHeader: string;
  xsrfToken: string;
};

async function fetchWorkdayEvents(source: WorkdaySource): Promise<WorkdayEvent[]> {
  let session = await createWorkdaySession(source);
  const events: WorkdayEvent[] = [];
  let after: string | undefined;

  for (let page = 0; page < 4; page += 1) {
    const pageResult = await fetchWorkdayEventsPage(source, session, after);
    session = pageResult.session;
    events.push(...pageResult.events);

    if (!pageResult.hasNextPage || !pageResult.endCursor) {
      break;
    }

    after = pageResult.endCursor;
  }

  return events;
}

async function createWorkdaySession(source: WorkdaySource): Promise<WorkdaySession> {
  const response = await fetchWithTimeout(
    `${source.portalUrl}?state=PUBLISHED`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    },
    WORKDAY_FETCH_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`Workday portal returned ${response.status}`);
  }

  return workdaySessionFromHeaders(response.headers);
}

async function fetchWorkdayEventsPage(
  source: WorkdaySource,
  session: WorkdaySession,
  after?: string,
): Promise<{ events: WorkdayEvent[]; hasNextPage: boolean; endCursor?: string; session: WorkdaySession }> {
  const response = await fetchWithTimeout(
    new URL("/graphql", source.portalUrl).toString(),
    {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: session.cookieHeader,
        "X-XSRF-Token": session.xsrfToken,
        "X-Requested-With": "XMLHttpRequest",
        operationName: "BidOpportunitiesQuery",
        operationType: "query",
        Referer: `${source.portalUrl}?state=PUBLISHED`,
      },
      body: JSON.stringify({
        operationName: "BidOpportunitiesQuery",
        variables: {
          input: {
            search: "",
            commodityCodes: [],
            requestType: [],
            state: ["PUBLISHED"],
            bidSubmissionDeadline: null,
            closedAt: null,
            publishedAt: null,
            questionDeadline: null,
            rsvpDeadline: null,
            projectIds: [],
            eventId: "",
            restricted: null,
          },
          first: 50,
          after,
          sortColumn: "publishedAt",
          sortDirection: "desc",
        },
        query: WORKDAY_BID_OPPORTUNITIES_QUERY,
      }),
      cache: "no-store",
    },
    WORKDAY_FETCH_TIMEOUT_MS,
  );

  const nextSession = workdaySessionFromHeaders(response.headers, session);

  if (!response.ok) {
    throw new Error(`Workday GraphQL returned ${response.status}`);
  }

  const data = (await response.json()) as WorkdayEventsResponse;
  if (data.errors?.length) {
    throw new Error(data.errors.map((error) => error.message).filter(Boolean).join("; ") || "Workday GraphQL returned an error");
  }

  return {
    events: data.data?.events?.nodes ?? [],
    hasNextPage: Boolean(data.data?.events?.pageInfo?.hasNextPage),
    endCursor: data.data?.events?.pageInfo?.endCursor,
    session: nextSession,
  };
}

function parseWorkdayEvents(events: WorkdayEvent[], query: string, source: WorkdaySource): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return events
    .map((event, index) => workdayEventToResult(event, terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function workdayEventToResult(
  event: WorkdayEvent,
  terms: string[],
  index: number,
  source: WorkdaySource,
): UnifiedSearchResult | undefined {
  const title = event.title?.trim();
  if (!title || event.state !== "PUBLISHED") {
    return undefined;
  }

  const deadline = formatIsoDateTime(event.bidSubmissionDeadline, "America/Chicago");
  const postedDate = formatIsoDateTime(event.publishedAt, "America/Chicago");
  const requestType = event.requestType?.trim();
  const status = event.translatedState?.trim() || "Open";
  const solicitationId = title.match(/\b(?:RFP|RFQ|RFB|IFB|ITB|RFI|BID)[A-Z0-9-]*\b/i)?.[0] ?? event.id;
  const commodityCodes = event.commodityCodes?.filter(Boolean) ?? [];
  const haystack = [title, requestType, status, solicitationId, event.projectId, commodityCodes.join(" "), source.buyer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 76 - Math.min(index, 30));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const detailUrl = event.id ? new URL(`/bid-details/${event.id}`, source.portalUrl).toString() : source.portalUrl;
  const bidUrl = event.bidUrl ? safeAbsoluteUrl(event.bidUrl, source.portalUrl) ?? event.bidUrl : undefined;
  const documents = [
    requestType ? `Request type: ${requestType}` : undefined,
    event.projectId ? `Project ID: ${event.projectId}` : undefined,
    ...commodityCodes.slice(0, 8),
    bidUrl ? `Workday public bid URL: ${bidUrl}` : undefined,
  ].filter((item): item is string => Boolean(item));
  const documentLinks = dedupeDocumentLinks(
    [
      { label: "Workday public bid detail", url: detailUrl },
      bidUrl ? { label: "Workday public bid package", url: bidUrl } : undefined,
    ].filter((link): link is OpportunityDocumentLink => Boolean(link)),
  );

  return {
    id: `workday:${source.sourceName}:${event.id ?? title}`,
    resultType: "opportunity",
    title,
    buyer: source.buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: "TX",
    sourceType: "Workday Strategic Sourcing public portal",
    url: detailUrl,
    portalUrl: source.portalUrl,
    score,
    status: event.restricted ? `${status} / restricted` : status,
    solicitationId,
    deadline,
    postedDate,
    documents,
    documentLinks,
    submissionInstructions:
      "Open the Workday public bid detail, register or sign in if required, download the solicitation documents and addenda, then submit through Workday before the deadline.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: documents.length > 0,
      hasContact: false,
    }),
    summary: [
      requestType ? `${requestType} opportunity.` : "",
      event.projectId ? `Project ${event.projectId}.` : "",
      postedDate ? `Published ${postedDate}.` : "",
      deadline ? `Closes ${deadline}.` : "",
      commodityCodes.length ? `Commodity codes: ${commodityCodes.slice(0, 4).join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the Workday bid detail, confirm fit and required attachments, then route it for human review.",
  };
}

const BEACON_LIST_SOLICITATIONS_QUERY = `
query ListSolicitations($agencyTag: String, $status: String, $filter: String, $start: Int, $pageSize: Int, $sort: String) {
  solicitations(agencyTag: $agencyTag, status: $status, filter: $filter, start: $start, pageSize: $pageSize, sort: $sort) {
    total
    data {
      id
      refnum
      title
      status
      type
      issueDate
      dueDate
      description
      documents
      primaryContact
      additionalContacts
      agency {
        id
        tag
        name
        location {
          region {
            name
            abbr
          }
        }
      }
    }
  }
}
`;

async function searchBeaconSolicitations(query: string, source: BeaconSource): Promise<SearchTaskResult> {
  try {
    const response = await fetchWithTimeout(
      "https://www.beaconbid.com/api/gql?operation=ListSolicitations",
      {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://www.beaconbid.com",
          Referer: source.portalUrl,
          "x-cver": "0",
        },
        body: JSON.stringify({
          operationName: "ListSolicitations",
          query: BEACON_LIST_SOLICITATIONS_QUERY,
          variables: {
            agencyTag: source.agencyTag,
            status: "open",
            filter: "",
            start: 0,
            pageSize: 100,
            sort: "issueDate desc",
          },
        }),
        cache: "no-store",
      },
      12000,
    );

    if (!response.ok) {
      return { source: source.sourceName, results: [], error: `Beacon returned ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { source: source.sourceName, results: [], error: "Beacon returned a non-JSON challenge page" };
    }

    const data = (await response.json()) as BeaconSolicitationsResponse;
    if (data.errors?.length) {
      return {
        source: source.sourceName,
        results: [],
        error: data.errors.map((error) => error.message).filter(Boolean).join("; ") || "Beacon GraphQL returned an error",
      };
    }

    return {
      source: source.sourceName,
      results: parseBeaconSolicitations(data.data?.solicitations?.data ?? [], query, source),
    };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

function parseBeaconSolicitations(solicitations: BeaconSolicitation[], query: string, source: BeaconSource) {
  const terms = conceptTerms(query);

  return solicitations
    .map((solicitation, index) => beaconSolicitationToResult(solicitation, terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function beaconSolicitationToResult(
  solicitation: BeaconSolicitation,
  terms: string[],
  index: number,
  source: BeaconSource,
): UnifiedSearchResult | undefined {
  const title = solicitation.title?.trim();
  if (!title || !solicitation.id) {
    return undefined;
  }

  const descriptionHtml = beaconDescriptionHtml(solicitation.description);
  const descriptionText = cleanText(descriptionHtml);
  const deadline = formatBeaconDate(solicitation.dueDate, source.state === "TN" ? "America/Chicago" : "America/Chicago");
  const postedDate = formatBeaconDate(solicitation.issueDate, source.state === "TN" ? "America/Chicago" : "America/Chicago");
  const solicitationId = solicitation.refnum?.trim() || solicitation.id;
  const agencyName = solicitation.agency?.name?.trim() || source.buyer;
  const documents = (solicitation.documents ?? [])
    .map((document) => [document.detail, document.name].filter(Boolean).join(": "))
    .filter((document) => document.length > 0);
  const contact = beaconContactText(solicitation.primaryContact);
  const haystack = [
    title,
    solicitationId,
    solicitation.type,
    solicitation.status,
    agencyName,
    descriptionText,
    documents.join(" "),
    contact,
    ...(solicitation.additionalContacts ?? []).map(beaconContactText),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 76 - Math.min(index, 35));

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const detailUrl = beaconSolicitationUrl(source.agencyTag, solicitation.id, title);
  const externalLinks = extractAnchorLinks(descriptionHtml, detailUrl).filter((link) => !link.url.startsWith("mailto:"));
  const documentLinks = dedupeDocumentLinks([{ label: "Beacon solicitation detail", url: detailUrl }, ...externalLinks]);
  const allContacts = [contact, ...(solicitation.additionalContacts ?? []).map(beaconContactText)].filter(Boolean);

  return {
    id: `beacon:${source.agencyTag}:${solicitation.id}`,
    resultType: "opportunity",
    title,
    buyer: agencyName,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: source.state,
    sourceType: "Beacon public solicitation GraphQL feed",
    url: detailUrl,
    portalUrl: source.portalUrl,
    score,
    status: solicitation.status ? beaconStatusLabel(solicitation.status) : "Open",
    solicitationId,
    deadline,
    postedDate,
    contact: allContacts[0],
    documents,
    documentLinks,
    submissionInstructions: source.submissionInstructions,
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: documents.length > 0 || documentLinks.length > 1,
      hasContact: allContacts.length > 0,
    }),
    summary: [
      solicitation.type ? `${solicitation.type}.` : "",
      descriptionText ? descriptionText.slice(0, 260) : "",
      documents.length ? `Documents listed: ${documents.slice(0, 4).join("; ")}.` : "",
      postedDate ? `Posted ${postedDate}.` : "",
      deadline ? `Closes ${deadline}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the Beacon detail page, confirm fit, download official attachments through Beacon, and route it for human review.",
  };
}

function beaconDescriptionHtml(description: BeaconSolicitation["description"]) {
  if (!description) {
    return "";
  }

  return typeof description === "string" ? description : description.html ?? "";
}

function beaconContactText(contact?: BeaconContact | null) {
  if (!contact) {
    return undefined;
  }

  return [contact.name, contact.email, contact.phone].filter(Boolean).join(" | ") || undefined;
}

function beaconStatusLabel(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function beaconSolicitationUrl(agencyTag: string, id: string, title: string) {
  return `https://www.beaconbid.com/solicitations/${encodeURIComponent(agencyTag)}/${encodeURIComponent(id)}/${slugifyForUrl(title)}`;
}

function formatBeaconDate(value: BeaconDateValue, fallbackTimeZone: string) {
  const raw = typeof value === "string" ? value : value?.utcDate;
  const timeZone = typeof value === "object" && value?.specifiedZone ? value.specifiedZone : fallbackTimeZone;
  return formatIsoDateTime(raw, timeZone);
}

function slugifyForUrl(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function searchGsaForecast(query: string): Promise<SearchTaskResult> {
  const source = "GSA Forecast of Contracting Opportunities";
  try {
    const url = `${GSA_FORECAST_SUGGESTIONS_URL}?search=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
          Accept: "application/json",
          Referer: GSA_FORECAST_URL,
        },
        cache: "no-store",
      },
      12000,
    );

    if (!response.ok) {
      return { source, results: [], error: `GSA Forecast suggestions returned ${response.status}` };
    }

    const data = (await response.json()) as GsaForecastSuggestionsResponse;
    const forecastSuggestions = (data.data ?? [])
      .filter((item) => item.id_node && item.id_parent_group === 2 && item.field_federal_users_only !== true)
      .slice(0, 16);

    const results = await runLimited(
      forecastSuggestions.map((suggestion, index) => async () => {
        try {
          const content = await fetchGsaForecastContent(suggestion.id_node as number);
          return gsaForecastContentToResult(content, suggestion, query, index);
        } catch {
          return gsaForecastSuggestionToResult(suggestion, query, index);
        }
      }),
      4,
    );

    return {
      source,
      results: results
        .filter((result): result is UnifiedSearchResult => Boolean(result))
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)),
    };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

async function fetchGsaForecastContent(id: number): Promise<GsaForecastContent> {
  const response = await fetchWithTimeout(
    `${GSA_FORECAST_CONTENT_URL}${encodeURIComponent(String(id))}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
        Accept: "application/json",
        Referer: GSA_FORECAST_URL,
      },
      cache: "no-store",
    },
    12000,
  );

  if (!response.ok) {
    throw new Error(`GSA Forecast content returned ${response.status}`);
  }

  return (await response.json()) as GsaForecastContent;
}

function gsaForecastContentToResult(
  content: GsaForecastContent,
  suggestion: GsaForecastSuggestion,
  query: string,
  index: number,
): UnifiedSearchResult | undefined {
  if (gsaFieldTargetId(content, "type") !== "forecast_tool") {
    return undefined;
  }

  const terms = conceptTerms(query);
  const id = gsaFieldValue(content, "nid") ?? String(suggestion.id_node ?? "");
  const title = gsaFieldValue(content, "title") ?? suggestion.title_node ?? suggestion.title;
  const body = gsaBodyText(content) || suggestion.body_node || suggestion.body || "";
  if (!id || !title) {
    return undefined;
  }

  const sourceListingId = gsaFieldValue(content, "field_source_listing_id") ?? id;
  const estimatedSolicitationDate = gsaFieldValue(content, "field_estimated_solicitation_dat");
  const period = gsaPeriodOfPerformance(content);
  const place = gsaPlaceOfPerformance(content);
  const contact = gsaContact(content);
  const budget = gsaBudget(content);
  const haystack = [title, body, sourceListingId, estimatedSolicitationDate, period, place, contact, budget]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 78 - Math.min(index, 35));
  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  const detailUrl = `https://acquisitiongateway.gov/forecast/resources/${encodeURIComponent(id)}`;
  const solicitationLink = gsaLink(content, "field_solicitation_link", detailUrl);
  const documentLinks = dedupeDocumentLinks(
    [
      { label: "GSA Forecast detail", url: detailUrl },
      solicitationLink,
    ].filter((link): link is OpportunityDocumentLink => Boolean(link)),
  );
  const documents = [
    estimatedSolicitationDate ? `Estimated solicitation date: ${estimatedSolicitationDate}` : undefined,
    period ? `Period of performance: ${period}` : undefined,
    place ? `Place of performance: ${place}` : undefined,
    budget ? `Budget/value: ${budget}` : undefined,
    "Forecast data is planning information; confirm active solicitation details on SAM.gov or the listed agency link before pursuing.",
  ].filter((item): item is string => Boolean(item));

  return {
    id: `gsa-forecast:${sourceListingId}`,
    resultType: "opportunity",
    title,
    buyer: "Federal agency forecast",
    sourceName: "GSA Forecast of Contracting Opportunities",
    sourceLevel: "Federal",
    sourceState: "US",
    sourceType: "GSA Acquisition Gateway Forecast Tool public suggestions/content API",
    url: detailUrl,
    portalUrl: GSA_FORECAST_URL,
    score,
    status: "Forecast/planned",
    solicitationId: sourceListingId,
    postedDate: estimatedSolicitationDate,
    budget,
    contact,
    documents,
    documentLinks,
    submissionInstructions:
      "Use the GSA Forecast detail to prepare early, then monitor SAM.gov and the listed agency contact/link for the official solicitation before submitting anything.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(sourceListingId),
      hasDeadline: false,
      hasDocuments: documentLinks.length > 0,
      hasContact: Boolean(contact),
    }),
    summary: [
      body.slice(0, 320),
      estimatedSolicitationDate ? `Estimated solicitation date: ${estimatedSolicitationDate}.` : "",
      place ? `Place of performance: ${place}.` : "",
      budget ? `Budget/value: ${budget}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the GSA Forecast detail, save the agency contact, and set a reminder to watch SAM.gov for the formal solicitation.",
  };
}

function gsaForecastSuggestionToResult(
  suggestion: GsaForecastSuggestion,
  query: string,
  index: number,
): UnifiedSearchResult | undefined {
  if (!suggestion.id_node || suggestion.id_parent_group !== 2) {
    return undefined;
  }

  const terms = conceptTerms(query);
  const title = suggestion.title_node ?? suggestion.title;
  const body = suggestion.body_node ?? suggestion.body ?? "";
  if (!title) {
    return undefined;
  }

  const haystack = [title, body].join(" ").toLowerCase();
  const score = scoreOpportunity(haystack, terms, 68 - Math.min(index, 25));
  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  const detailUrl = `https://acquisitiongateway.gov/forecast/resources/${encodeURIComponent(String(suggestion.id_node))}`;
  return {
    id: `gsa-forecast:${suggestion.id_node}`,
    resultType: "opportunity",
    title,
    buyer: "Federal agency forecast",
    sourceName: "GSA Forecast of Contracting Opportunities",
    sourceLevel: "Federal",
    sourceState: "US",
    sourceType: "GSA Acquisition Gateway Forecast Tool public suggestions API",
    url: detailUrl,
    portalUrl: GSA_FORECAST_URL,
    score,
    status: "Forecast/planned",
    solicitationId: String(suggestion.id_node),
    documents: ["Forecast row matched through the public GSA Acquisition Gateway suggestions API."],
    documentLinks: [{ label: "GSA Forecast detail", url: detailUrl }],
    submissionInstructions:
      "Use the GSA Forecast detail to prepare early, then monitor SAM.gov and the listed agency contact/link for the official solicitation before submitting anything.",
    applicationChecklist: applicationChecklist({
      hasSolicitationId: true,
      hasDeadline: false,
      hasDocuments: true,
      hasContact: false,
    }),
    summary: body.slice(0, 320),
    nextAction: "Open the GSA Forecast detail, confirm the agency and forecast status, and watch SAM.gov for the formal solicitation.",
  };
}

function gsaFieldValue(content: GsaForecastContent, field: string) {
  const value = content[field]?.[0]?.value;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function gsaFieldTargetId(content: GsaForecastContent, field: string) {
  const value = content[field]?.[0]?.target_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function gsaBodyText(content: GsaForecastContent) {
  const body = content.body?.[0];
  const processed = body?.processed;
  const value = body?.value;
  return typeof processed === "string" ? htmlToText(processed) : typeof value === "string" ? htmlToText(value) : "";
}

function gsaPeriodOfPerformance(content: GsaForecastContent) {
  const period = content.field_period_of_performance?.[0];
  const start = period?.value;
  const end = period?.end_value;
  if (typeof start !== "string" && typeof end !== "string") {
    return undefined;
  }

  return [start, end].filter((value): value is string => typeof value === "string" && value.length > 0).join(" to ");
}

function gsaPlaceOfPerformance(content: GsaForecastContent) {
  const place = content.field_place_of_performance?.[0];
  if (!place) {
    return undefined;
  }

  const parts = [place.locality, place.administrative_area, place.country_code].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return parts.join(", ") || undefined;
}

function gsaContact(content: GsaForecastContent) {
  const contact = [gsaFieldValue(content, "field_point_of_contact_name"), gsaFieldValue(content, "field_point_of_contact_email")]
    .filter(Boolean)
    .join(" | ");
  const advisor = [gsaFieldValue(content, "field_advisor_info_name"), gsaFieldValue(content, "field_advisor_info_email")]
    .filter(Boolean)
    .join(" | ");
  return contact || advisor || undefined;
}

function gsaBudget(content: GsaForecastContent) {
  const value =
    gsaFieldValue(content, "field_basic_exercised_value") ??
    gsaFieldValue(content, "field_delivery_order_value") ??
    gsaFieldValue(content, "field_current_fy_proj_obligation");
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : value;
}

function gsaLink(content: GsaForecastContent, field: string, baseUrl: string): OpportunityDocumentLink | undefined {
  const link = content[field]?.[0];
  const rawUrl = link?.uri ?? link?.url ?? link?.value;
  const title = link?.title;
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return undefined;
  }

  const url = safeAbsoluteUrl(rawUrl, baseUrl);
  return url ? { label: typeof title === "string" && title.length > 0 ? title : "Related solicitation link", url } : undefined;
}

async function searchOracleNegotiationAbstracts(query: string, source: OracleNegotiationSource): Promise<SearchTaskResult> {
  try {
    const html = await fetchOracleNegotiationAbstractHtml(source);
    return {
      source: source.sourceName,
      results: parseOracleNegotiationAbstracts(html, query, source),
    };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function fetchOracleNegotiationAbstractHtml(source: OracleNegotiationSource) {
  const initial = await fetchOraclePageWithRedirects(source.pageUrl);
  if (initial.status < 200 || initial.status >= 300) {
    throw new Error(`Oracle Negotiation Abstracts returned ${initial.status}`);
  }

  if (initial.html.includes('AT1:_ATp:resId1') && initial.html.includes("_afrRK")) {
    return initial.html;
  }

  const loopback = oracleLoopbackParams(initial.html);
  if (!loopback) {
    throw new Error("Oracle Negotiation Abstracts did not expose public table parameters");
  }

  const realPageUrl = oracleLoopbackUrl(source.pageUrl, loopback);
  const realPage = await fetchOraclePageWithRedirects(realPageUrl, initial.cookieHeader, source.pageUrl);
  if (realPage.status < 200 || realPage.status >= 300) {
    throw new Error(`Oracle Negotiation Abstracts returned ${realPage.status}`);
  }

  return realPage.html;
}

async function fetchOraclePageWithRedirects(startUrl: string, cookieHeader = "", referer?: string) {
  let currentUrl = startUrl;
  let cookies = cookieHeader;

  for (let redirectCount = 0; redirectCount < 8; redirectCount += 1) {
    const response = await fetchWithTimeout(
      currentUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GovContractFinder/0.1",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...(cookies ? { Cookie: cookies } : {}),
          ...(referer ? { Referer: referer } : {}),
        },
        redirect: "manual",
        cache: "no-store",
      },
      12000,
    );
    cookies = mergeCookieHeaders(cookies, cookieHeaderFromResponse(response));

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return { status: response.status, html: await response.text(), cookieHeader: cookies, finalUrl: currentUrl };
      }

      referer = currentUrl;
      currentUrl = safeAbsoluteUrl(location, currentUrl) ?? location;
      continue;
    }

    return { status: response.status, html: await response.text(), cookieHeader: cookies, finalUrl: currentUrl };
  }

  throw new Error("Oracle Negotiation Abstracts redirected too many times");
}

function oracleLoopbackParams(html: string) {
  const afrLoop = html.match(/_addParam\(query,\s*["_']_afrLoop["_'],\s*["_']([^"']+)["']\)/)?.[1];
  const ctrlState = html.match(/["_']_adf\.ctrl-state["_']\s*:\s*["_']([^"']+)["']/)?.[1];

  return afrLoop && ctrlState ? { afrLoop, ctrlState } : undefined;
}

function oracleLoopbackUrl(pageUrl: string, params: { afrLoop: string; ctrlState: string }) {
  const url = new URL(pageUrl);
  url.searchParams.set("_afrLoop", params.afrLoop);
  url.searchParams.set("_afrWindowMode", "0");
  url.searchParams.set("_afrWindowId", "null");
  url.searchParams.set("_afrMT", "screen");
  url.searchParams.set("_afrFS", "16");
  url.searchParams.set("_afrMFW", "1366");
  url.searchParams.set("_afrMFH", "768");
  url.searchParams.set("_afrMFDW", "1366");
  url.searchParams.set("_afrMFDH", "768");
  url.searchParams.set("_afrMFC", "8");
  url.searchParams.set("_afrMFCI", "0");
  url.searchParams.set("_afrMFM", "0");
  url.searchParams.set("_afrMFR", "96");
  url.searchParams.set("_afrMFG", "0");
  url.searchParams.set("_afrMFS", "0");
  url.searchParams.set("_afrMFO", "0");
  url.searchParams.set("_adf.ctrl-state", params.ctrlState);
  return url.toString();
}

function parseOracleNegotiationAbstracts(html: string, query: string, source: OracleNegotiationSource) {
  const terms = conceptTerms(query);
  const tableStart = html.indexOf('id="pt1:r1:0:pt1:AP1:AT1:_ATp:resId1"');
  const fallbackTableStart = tableStart >= 0 ? tableStart : html.indexOf("AT1:_ATp:resId1");
  const tableEnd =
    fallbackTableStart >= 0 ? html.indexOf('id="pt1:r1:0:pt1:AP1:AT1:_ATp:_bTbx"', fallbackTableStart) : -1;
  const tableHtml =
    fallbackTableStart >= 0
      ? html.slice(fallbackTableStart, tableEnd > fallbackTableStart ? tableEnd : undefined)
      : html;
  const rows = Array.from(tableHtml.matchAll(/<tr\b[^>]*\b_afrRK=(["'])[^"']+\1[^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index) => oracleNegotiationRowToResult(row[2], terms, index, source))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function oracleNegotiationRowToResult(
  rowHtml: string,
  terms: string[],
  index: number,
  source: OracleNegotiationSource,
): UnifiedSearchResult | undefined {
  const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cleanText(cell[1]));
  if (cells.length < 7) {
    return undefined;
  }

  const [solicitationId, title, negotiationType, status, postedDate, openDate, deadline] = cells;
  if (!title || !solicitationId || !/active|amended|preview|upcoming/i.test(status)) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const haystack = [title, solicitationId, negotiationType, status, postedDate, openDate, deadline, source.buyer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 78 - Math.min(index, 35));
  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  const documents = [
    `Negotiation type: ${negotiationType}`,
    openDate ? `Open/publish date: ${openDate}` : undefined,
    `Oracle portal dates are shown in ${source.timeZone}.`,
    "Use the Details icon in the Oracle Negotiation Abstracts table to open official attachments, addenda, and response instructions.",
  ].filter((item): item is string => Boolean(item));

  return {
    id: `oracle-negotiation:${source.sourceName}:${solicitationId}`,
    resultType: "opportunity",
    title,
    buyer: source.buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: source.state,
    sourceType: "Oracle Fusion public Negotiation Abstracts portal",
    url: source.pageUrl,
    portalUrl: source.pageUrl,
    score,
    status,
    solicitationId,
    deadline,
    postedDate,
    documents,
    documentLinks: [{ label: "Oracle Negotiation Abstracts portal", url: source.pageUrl }],
    submissionInstructions: source.submissionInstructions,
    applicationChecklist: applicationChecklist({
      hasSolicitationId: true,
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: false,
    }),
    summary: [
      `${negotiationType || "Negotiation"} listed as ${status}.`,
      postedDate ? `Posted ${postedDate}.` : "",
      openDate ? `Opened ${openDate}.` : "",
      deadline ? `Closes ${deadline}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: "Open the Oracle portal, use the Details icon for this solicitation, download the official documents, and route it for human review.",
  };
}

async function searchAdvantageVssPublishedSolicitations(query: string, source: AdvantageVssSource): Promise<SearchTaskResult> {
  try {
    const rows = await fetchAdvantageVssRows(source);
    return {
      source: source.sourceName,
      results: parseAdvantageVssRows(rows, query, source),
    };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function fetchAdvantageVssRows(source: AdvantageVssSource) {
  const cacheKey = source.applicationUrl;
  const cached = advantageVssRowsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const inFlight = advantageVssRowsInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = fetchAdvantageVssRowsUncached(source)
    .then((rows) => {
      advantageVssRowsCache.set(cacheKey, { expiresAt: Date.now() + ADVANTAGE_VSS_SUCCESS_CACHE_MS, rows });
      return rows;
    })
    .finally(() => {
      advantageVssRowsInFlight.delete(cacheKey);
    });

  advantageVssRowsInFlight.set(cacheKey, promise);
  return promise;
}

async function fetchAdvantageVssRowsUncached(source: AdvantageVssSource) {
  const jar = { cookieHeader: "" };
  const initialResponse = await fetchWithTimeout(
    source.applicationUrl,
    {
      headers: {
        "User-Agent": advantageVssUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Upgrade-Insecure-Requests": "1",
      },
      cache: "no-store",
    },
    ADVANTAGE_VSS_FETCH_TIMEOUT_MS,
  );

  jar.cookieHeader = mergeCookieHeaders(jar.cookieHeader, cookieHeaderFromResponse(initialResponse));
  if (!initialResponse.ok) {
    throw new Error(`Advantage VSS returned ${initialResponse.status}`);
  }

  const initialHtml = await initialResponse.text();
  const initial = extractJavascriptObject<AdvantageVssResponse>(initialHtml, "moInitialResponse");
  const sessionId = initial.session_info?.session_id || initialResponse.headers.get("Adv-Session-Id") || undefined;
  const csrfToken = initial.session_info?.csrf_token;
  const conversationId = initialResponse.headers.get("Adv-Conversation-Id") || "null";
  if (!sessionId || !csrfToken) {
    throw new Error("Advantage VSS did not issue public session metadata");
  }

  const windowId = cryptoRandomId();
  const startupLeaves = advantageVssStartupLeaves(initial.page_metadata);
  let carousel: AdvantageVssResponse | undefined;
  for (const [index, leaf] of startupLeaves.entries()) {
    const response = await postAdvantageVssJson(
      source.applicationUrl,
      {
        action: {
          key: leaf.key,
          actionType: "pageOpen",
          params: {
            targetLocation: leaf.targetLocation,
            targetComponentType: leaf.targetComponentType,
          },
          targetQualifiedName: leaf.targetQualifiedName,
          viewName: leaf.viewName ?? null,
        },
        session_info: {
          session_id: sessionId,
          csrf_token: csrfToken,
        },
      },
      {
        windowId,
        cookieHeader: jar.cookieHeader,
        requestId: String(index),
        conversationId: "null",
        sessionId: "null",
        actionType: "pageOpen",
        referer: source.applicationUrl,
      },
    );
    jar.cookieHeader = mergeCookieHeaders(jar.cookieHeader, response.cookieHeader);
    if (/carou/i.test(`${leaf.name ?? ""} ${leaf.key ?? ""}`)) {
      carousel = response.json;
    }
  }

  if (!carousel) {
    throw new Error("Advantage VSS carousel action was not available");
  }

  const solicitationLeaf = advantageVssSolicitationLeaf(carousel.page_metadata);
  const pageId = carousel.session_info?.page_id;
  if (!solicitationLeaf?.key || !solicitationLeaf.targetQualifiedName || !pageId) {
    throw new Error("Advantage VSS published solicitations page was not available");
  }

  const solicitationResponse = await postAdvantageVssJson(
    source.applicationUrl,
    {
      action: {
        params: {
          targetLocation: "noDisplay",
          targetComponentType: solicitationLeaf.targetComponentType || "SystemInquiryPage",
        },
        actionType: "pageOpen",
        targetQualifiedName: solicitationLeaf.targetQualifiedName,
      },
      session_info: {
        page_id: pageId,
        csrf_token: csrfToken,
        session_id: sessionId,
      },
      key: solicitationLeaf.key,
      viewState: {
        ...(carousel.page_metadata?.key
          ? {
              [carousel.page_metadata.key]: {
                editable: false,
                hidden: false,
                closed: false,
                required: false,
                protected: false,
              },
            }
          : {}),
        TOP_LEVEL_KV_PAIRS_MAP: {},
      },
    },
    {
      windowId,
      cookieHeader: jar.cookieHeader,
      requestId: String(startupLeaves.length + 1),
      conversationId,
      sessionId,
      pageId,
      actionType: "pageOpen",
      referer: source.applicationUrl,
    },
  );

  jar.cookieHeader = mergeCookieHeaders(jar.cookieHeader, solicitationResponse.cookieHeader);
  const rowSet = Object.values(solicitationResponse.json.data?.ds_data ?? {}).find((item) => Array.isArray(item?.row_data));
  return rowSet?.row_data ?? [];
}

async function postAdvantageVssJson(
  url: string,
  body: unknown,
  options: {
    windowId: string;
    cookieHeader: string;
    requestId: string;
    conversationId: string;
    sessionId: string;
    actionType: string;
    referer: string;
    pageId?: string;
  },
) {
  const headers: Record<string, string> = {
    "User-Agent": advantageVssUserAgent(),
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Referer: options.referer,
    "Adv-Window-Id": options.windowId,
    "Adv-Conversation-Id": options.conversationId,
    "Adv-Session-Id": options.sessionId,
    "Adv-Request-Id": options.requestId,
    "Adv-Action-Type": options.actionType,
    ...(options.pageId ? { "Adv-Page-Id": options.pageId } : {}),
    ...(options.cookieHeader ? { Cookie: options.cookieHeader } : {}),
  };
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    },
    ADVANTAGE_VSS_FETCH_TIMEOUT_MS,
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Advantage VSS returned ${response.status}`);
  }

  const json = JSON.parse(text) as AdvantageVssResponse;
  if (text.includes("SessionInvalid")) {
    throw new Error("Advantage VSS public session became invalid");
  }

  return {
    json,
    cookieHeader: cookieHeaderFromResponse(response),
  };
}

function parseAdvantageVssRows(rows: AdvantageVssRow[], query: string, source: AdvantageVssSource) {
  const terms = conceptTerms(query);

  return rows
    .filter((row) => advantageVssRowMatchesSource(row, source))
    .map((row, index) => advantageVssRowToResult(row, terms, index, source, query))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function advantageVssRowMatchesSource(row: AdvantageVssRow, source: AdvantageVssSource) {
  if (!source.departmentPattern) {
    return true;
  }

  return source.departmentPattern.test([row.DEPT_NM, row.BUYR_NM, row.DOC_DSCR, row.DOC_CD_CONCAT].filter(Boolean).join(" "));
}

function advantageVssRowToResult(
  row: AdvantageVssRow,
  terms: string[],
  index: number,
  source: AdvantageVssSource,
  query: string,
): UnifiedSearchResult | undefined {
  const title = row.DOC_DSCR?.trim();
  const solicitationId = advantageVssSolicitationId(row);
  const department = row.DEPT_NM?.trim();
  const buyerName = row.BUYR_NM?.trim();
  const deadline = formatAdvantageVssDate(row.SO_CLSNG_DT_TM, source.timeZone);
  const postedDate = formatAdvantageVssDate(row.PUB_DT, source.timeZone, "date");
  const amendedDate = formatAdvantageVssDate(row.AMND_DT, source.timeZone, "date");
  const type = row.DOC_CD_CONCAT?.trim() || row.DOC_CD?.trim();
  const status = advantageVssStatusLabel(row.SO_STA);
  const contact = advantageVssContact(row);
  const haystack = [
    title,
    solicitationId,
    department,
    buyerName,
    type,
    row.SO_CAT_CD,
    status,
    row.BUYR_EMAIL_AD,
    "RFP RFQ IFB bid solicitation public procurement",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const score = scoreOpportunity(haystack, terms, 74 - Math.min(index, 35));
  const shouldRequireDirectSignal = hasTrainingBusinessIntent(normalizeConcept(query));

  if (!title || (terms.length > 0 && (score <= 0 || (shouldRequireDirectSignal && !hasDirectConceptSignal(haystack, query))))) {
    return undefined;
  }

  if (isPastDeadline(deadline)) {
    return undefined;
  }

  const documents = [
    solicitationId ? `Solicitation ID: ${solicitationId}` : undefined,
    type ? `Type: ${type}` : undefined,
    department ? `Department: ${department}` : undefined,
    buyerName ? `Buyer: ${buyerName}` : undefined,
    postedDate ? `Published: ${postedDate}` : undefined,
    amendedDate ? `Amended: ${amendedDate}` : undefined,
    "Official solicitation documents, addenda, and response forms are available from the solicitation row in the VSS portal.",
  ].filter((item): item is string => Boolean(item));

  return {
    id: `advantage-vss:${source.sourceName}:${solicitationId || row.ADV_ROW_ID || title}`,
    resultType: "opportunity",
    title,
    buyer: department || source.buyer,
    sourceName: source.sourceName,
    sourceLevel: source.level,
    sourceState: source.state,
    sourceType: source.sourceType,
    url: source.applicationUrl,
    portalUrl: source.portalUrl,
    score,
    status,
    solicitationId,
    deadline,
    postedDate,
    contact,
    documents,
    documentLinks: [{ label: `${source.sourceName} VSS published solicitation portal`, url: source.applicationUrl }],
    submissionInstructions: source.submissionInstructions,
    applicationChecklist: applicationChecklist({
      hasSolicitationId: Boolean(solicitationId),
      hasDeadline: Boolean(deadline),
      hasDocuments: true,
      hasContact: Boolean(contact),
    }),
    summary: [
      type ? `${type}.` : "",
      department ? `Department: ${department}.` : "",
      buyerName ? `Buyer: ${buyerName}.` : "",
      deadline ? `Closes ${deadline}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction:
      "Open the VSS portal, find this solicitation ID in View Published Solicitations, download the official packet and addenda, then save it for draft response work.",
  };
}

function advantageVssStartupLeaves(pageMetadata: AdvantageVssResponse["page_metadata"]) {
  const leaves = walkAdvantageVssLeaves(pageMetadata).filter((leaf) =>
    /logo|login|carou|AdvIntelligence|footer/i.test(`${leaf.name ?? ""} ${leaf.key ?? ""}`),
  );

  return leaves
    .filter((leaf) => leaf.key && leaf.targetQualifiedName)
    .sort((a, b) => advantageVssStartupOrder(a) - advantageVssStartupOrder(b));
}

function advantageVssStartupOrder(leaf: AdvantageVssActionLeaf) {
  const label = `${leaf.name ?? ""} ${leaf.key ?? ""}`;
  if (/logo/i.test(label)) {
    return 0;
  }
  if (/login/i.test(label)) {
    return 1;
  }
  if (/carou/i.test(label)) {
    return 2;
  }
  if (/AdvIntelligence/i.test(label)) {
    return 3;
  }
  if (/footer/i.test(label)) {
    return 4;
  }

  return leaf.order ?? 10;
}

function advantageVssSolicitationLeaf(pageMetadata: AdvantageVssResponse["page_metadata"]) {
  const leaves = walkAdvantageVssLeaves(pageMetadata);
  return (
    leaves.find((leaf) => /View Published Solicitations/i.test(leaf.title ?? "")) ??
    leaves.find((leaf) => /solicit/i.test(`${leaf.name ?? ""} ${leaf.key ?? ""} ${leaf.title ?? ""}`))
  );
}

function walkAdvantageVssLeaves(value: unknown, leaves: AdvantageVssActionLeaf[] = []) {
  if (!value || typeof value !== "object") {
    return leaves;
  }

  const maybeContainer = value as {
    leafElemsMap?: Record<string, AdvantageVssActionLeaf>;
    containerElemsMap?: Record<string, unknown>;
  };
  for (const leaf of Object.values(maybeContainer.leafElemsMap ?? {})) {
    leaves.push(leaf);
  }
  for (const child of Object.values(maybeContainer.containerElemsMap ?? {})) {
    walkAdvantageVssLeaves(child, leaves);
  }

  return leaves;
}

function extractJavascriptObject<T>(html: string, assignmentName: string): T {
  const marker = `var ${assignmentName} = `;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`${assignmentName} was not found`);
  }

  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) {
    throw new Error(`${assignmentName} did not contain an object`);
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        inString = false;
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      inString = true;
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(html.slice(start, index + 1)) as T;
      }
    }
  }

  throw new Error(`${assignmentName} object was not closed`);
}

function advantageVssSolicitationId(row: AdvantageVssRow) {
  const docRef = row.DOC_REF?.trim();
  if (!docRef) {
    return undefined;
  }

  return docRef.match(/\]\[([^\]]+)\]/)?.[1] ?? docRef.replace(/^\[|\]$/g, "");
}

function advantageVssStatusLabel(status?: string) {
  const code = status?.trim().toUpperCase();
  switch (code) {
    case "O":
      return "Open";
    case "A":
      return "Amended";
    case "C":
      return "Closed";
    case "X":
      return "Cancelled";
    default:
      return status?.trim() || "Published";
  }
}

function advantageVssContact(row: AdvantageVssRow) {
  return [row.BUYR_NM, row.BUYR_EMAIL_AD, row.BUYR_PH_NO].filter(Boolean).join(" | ") || undefined;
}

function formatAdvantageVssDate(value: number | string | undefined, timeZone: string, mode: "date" | "dateTime" = "dateTime") {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  const parsed = Number.isFinite(numeric) ? new Date(numeric) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return mode === "date"
    ? parsed.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric", timeZone })
    : parsed.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone,
      });
}

function advantageVssUserAgent() {
  return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 GovContractFinder/0.1";
}

function cryptoRandomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function workdaySessionFromHeaders(headers: Headers, previous?: WorkdaySession): WorkdaySession {
  const cookieValues = new Map<string, string>();

  if (previous) {
    for (const cookie of previous.cookieHeader.split(";")) {
      const [name, ...valueParts] = cookie.trim().split("=");
      if (name && valueParts.length > 0) {
        cookieValues.set(name, valueParts.join("="));
      }
    }
  }

  for (const setCookie of setCookieHeaders(headers)) {
    const pair = setCookie.split(";")[0];
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);
    if (name.startsWith("_pp_")) {
      cookieValues.set(name, value);
    }
  }

  const xsrfToken = cookieValues.get("_pp_xsrf");
  const sessionCookie = cookieValues.get("_pp_session");
  if (!xsrfToken || !sessionCookie) {
    throw new Error("Workday public session cookies were not issued");
  }

  return {
    xsrfToken,
    cookieHeader: Array.from(cookieValues.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; "),
  };
}

function setCookieHeaders(headers: Headers) {
  const headersWithGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const direct = headersWithGetSetCookie.getSetCookie?.();
  if (direct?.length) {
    return direct;
  }

  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }

  return combined.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
}

type AustinSolicitationOptions = {
  sourceName: string;
  buyer: string;
  level: string;
  sourceType?: string;
  filterTerms?: string[];
  submissionInstructions?: string;
  nextAction?: string;
};

async function searchAustinSolicitations(query: string): Promise<SearchTaskResult> {
  return searchAustinSolicitationsForSource(query, {
    sourceName: "City of Austin Purchasing",
    buyer: "City of Austin",
    level: "Local",
    sourceType: "Austin Finance Online",
  });
}

async function searchAustinBergstromSolicitations(query: string): Promise<SearchTaskResult> {
  return searchAustinSolicitationsForSource(query, {
    sourceName: "Austin-Bergstrom Airport Business",
    buyer: "Austin-Bergstrom International Airport / City of Austin",
    level: "Adjacent",
    sourceType: "Austin Finance Online airport-related solicitations",
    filterTerms: ["airport", "aviation", "bergstrom", "aus", "terminal", "airfield"],
    submissionInstructions:
      "Open the Austin Finance Online solicitation, confirm that it is airport-related, review attachments and addenda, then submit the eResponse before the response due time.",
    nextAction: "Open the Austin Finance Online solicitation, confirm airport fit and due date, then route it for human review.",
  });
}

async function searchAustinSolicitationsForSource(query: string, options: AustinSolicitationOptions): Promise<SearchTaskResult> {
  const source = options.sourceName;
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
        options,
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

function parseAustinSolicitationDetails(
  pages: Array<{ url: string; html: string }>,
  query: string,
  options: AustinSolicitationOptions,
): UnifiedSearchResult[] {
  const terms = conceptTerms(query);

  return pages
    .map((page, index) => austinDetailToResult(page, terms, index, options))
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function austinDetailToResult(
  page: { url: string; html: string },
  terms: string[],
  index: number,
  options: AustinSolicitationOptions,
): UnifiedSearchResult | undefined {
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
  const requiredSourceTerms = options.filterTerms?.map((term) => term.toLowerCase()) ?? [];

  if (requiredSourceTerms.length > 0 && !requiredSourceTerms.some((term) => haystack.includes(term))) {
    return undefined;
  }

  if (terms.length > 0 && score <= 0) {
    return undefined;
  }

  if (status.toLowerCase().includes("closed") || isPastDeadline(deadline)) {
    return undefined;
  }

  return {
    id: `austin:${options.sourceName}:${solicitationId ?? index}:${title}`,
    resultType: "opportunity",
    title,
    buyer: options.buyer,
    sourceName: options.sourceName,
    sourceLevel: options.level,
    sourceState: "TX",
    sourceType: options.sourceType ?? "Austin Finance Online",
    url: page.url,
    portalUrl: AUSTIN_SOLICITATIONS_URL,
    score,
    status,
    solicitationId,
    deadline,
    contact,
    documents,
    submissionInstructions:
      options.submissionInstructions ??
      "Create or sign into Austin Finance Online, review the solicitation packet and attachments, then submit the eResponse before the response due time.",
    applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: documents.length > 0, hasContact: Boolean(contact) }),
    summary: summary || [solicitationId ? `Solicitation ${solicitationId}.` : "", deadline ? `Response due ${deadline}.` : ""].filter(Boolean).join(" "),
    nextAction: options.nextAction ?? "Open the Austin Finance Online solicitation, confirm scope and due date, then route it for human review.",
  };
}

async function searchBexarCountyBids(query: string): Promise<SearchTaskResult> {
  const source = "Bexar County Purchasing";
  try {
    const response = await fetchPublicPage(BEXAR_BIDS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Bexar County bids returned ${response.status}` };
    }

    return { source, results: parseBexarCountyBids(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseBexarCountyBids(html: string, query: string): UnifiedSearchResult[] {
  if (/there are no open bid postings at this time/i.test(html)) {
    return [];
  }

  const terms = conceptTerms(query);
  const bidSection = html.match(/<div[^>]*class="[^"]*bidItems[^"]*"[^>]*>([\s\S]*?)(?:<\/main>|<\/section>)/i)?.[1] ?? html;
  const links = Array.from(bidSection.matchAll(/<a\b[^>]*href=(["'])([^"']*Bid[^"']*?)\1[^>]*>([\s\S]*?)<\/a>/gi));
  const seen = new Set<string>();

  return links
    .map((link, index): UnifiedSearchResult | undefined => {
      const title = cleanText(link[3]);
      const url = safeAbsoluteUrl(decodeHtml(link[2]), BEXAR_BIDS_URL) ?? BEXAR_BIDS_URL;
      const haystack = [title, "Bexar County purchasing bid rfp solicitation"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 62 - Math.min(index, 20));

      if (!title || seen.has(url)) {
        return undefined;
      }
      seen.add(url);

      if (terms.length > 0 && score <= 0) {
        return undefined;
      }

      return {
        id: `bexar:${url}`,
        resultType: "opportunity",
        title,
        buyer: "Bexar County",
        sourceName: "Bexar County Purchasing",
        sourceLevel: "Local",
        sourceState: "TX",
        sourceType: "CivicEngage public bids page",
        url,
        portalUrl: BEXAR_BIDS_URL,
        score,
        status: "Open/public posting",
        submissionInstructions: "Open the Bexar County bid posting, download the solicitation packet and addenda, then follow the stated submission instructions.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: true, hasContact: false }),
        summary: "Matching public bid link found on the official Bexar County bids page.",
        nextAction: "Open the Bexar County posting, confirm scope and deadline, then route it for human review.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchMidlandCountyRfps(query: string): Promise<SearchTaskResult> {
  const source = "Midland County Purchasing";
  try {
    const response = await fetchPublicPage(MIDLAND_COUNTY_RFP_URL);
    if (!response.ok) {
      return { source, results: [], error: `Midland County RFP page returned ${response.status}` };
    }

    return { source, results: parseMidlandCountyRfps(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseMidlandCountyRfps(html: string, query: string): UnifiedSearchResult[] {
  const start = html.search(/<h3>Current RFP/i);
  if (start < 0) {
    return [];
  }

  const sectionEnd = html.indexOf("</section>", start);
  const section = html.slice(start, sectionEnd > start ? sectionEnd : undefined);
  const terms = conceptTerms(query);
  const groups = Array.from(section.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|$)/gi));

  return groups
    .map((group, index): UnifiedSearchResult | undefined => {
      const title = cleanText(group[1]);
      const links = Array.from(group[2].matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)).map((match) => ({
        url: safeAbsoluteUrl(decodeHtml(match[2]), MIDLAND_COUNTY_RFP_URL) ?? MIDLAND_COUNTY_RFP_URL,
        label: cleanText(match[3]),
      }));
      const solicitationId = title.match(/\b\d{2}MCO\d+\b/i)?.[0];
      const documents = links.map((link) => link.label).filter(Boolean).slice(0, 8);
      const haystack = [title, documents.join(" "), "Midland County current RFP"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 68 - Math.min(index, 20));

      if (!title || links.length === 0) {
        return undefined;
      }

      if (terms.length > 0 && score <= 0) {
        return undefined;
      }

      return {
        id: `midland-county:${solicitationId ?? title}`,
        resultType: "opportunity",
        title,
        buyer: "Midland County",
        sourceName: "Midland County Purchasing",
        sourceLevel: "Local",
        sourceState: "TX",
        sourceType: "Official RFP document list",
        url: links[0].url,
        portalUrl: MIDLAND_COUNTY_RFP_URL,
        score,
        status: "Current RFP document posted",
        solicitationId,
        documents,
        documentLinks: links.slice(0, 8),
        submissionInstructions: "Open the Midland County RFP documents, download the main packet and addenda, then follow the instructions and deadline stated in the PDF.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: false, hasDocuments: documents.length > 0, hasContact: false }),
        summary: `${documents.length} current document${documents.length === 1 ? "" : "s"} listed on Midland County's official RFP page.`,
        nextAction: "Open the main RFP document, capture the due date and submission method, then route it for human review.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchHoustonAirportSolicitations(query: string): Promise<SearchTaskResult> {
  const source = "Houston Airport System Business";
  try {
    const response = await fetchPublicPage(HOUSTON_AIRPORT_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Houston Airport solicitations returned ${response.status}` };
    }

    return { source, results: parseHoustonAirportSolicitations(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseHoustonAirportSolicitations(html: string, query: string): UnifiedSearchResult[] {
  const decoded = html.replace(/\\"/g, "\"").replace(/\\n/g, " ");
  const terms = conceptTerms(query);
  const seen = new Set<string>();
  const results: UnifiedSearchResult[] = [];

  for (const match of decoded.matchAll(/"contentType":"solicitation"/g)) {
    const window = decoded.slice(match.index ?? 0, (match.index ?? 0) + 30_000);
    const solicitationId = jsonishString(window, "solicitationNumber");
    const title = jsonishString(window, "title");
    const status = jsonishString(window, "status") ?? "Open";
    const slug = jsonishString(window, "slug");
    const proposalDue = formatIsoDateTime(jsonishString(window, "proposalDue"), "America/Chicago");
    const questionsDue = formatIsoDateTime(jsonishString(window, "questionsDue"), "America/Chicago");
    const contactName = jsonishString(window, "contactName");
    const contactEmail = jsonishString(window, "contactEmail");
    const contactPhone = jsonishString(window, "contactPhone");
    const projectDescription = jsonishString(window, "projectDescription");
    const budget = jsonishString(window, "contractAmount")?.replace(/^\$\$/, "$");
    const documentLinks = Array.from(window.matchAll(/"fields":\{"title":"((?:\\.|[^"\\])*)"[\s\S]*?"file":\{"url":"((?:\\.|[^"\\])*)"/g))
      .map((documentMatch) => ({
        label: decodeJsonishString(documentMatch[1]),
        url: normalizeDocumentUrl(decodeJsonishString(documentMatch[2])),
      }))
      .filter((link): link is OpportunityDocumentLink => Boolean(link.label && link.url && link.label !== title))
      .slice(0, 8);
    const documents = documentLinks.map((link) => link.label);
    const key = solicitationId ?? title;

    if (!key || seen.has(key) || !title || status.toLowerCase() !== "open") {
      continue;
    }
    seen.add(key);

    const haystack = [title, solicitationId, projectDescription, status, documents.join(" "), "Houston Airport System HAS IAH HOU"].filter(Boolean).join(" ").toLowerCase();
    const score = scoreOpportunity(haystack, terms, 74 - Math.min(results.length, 30));

    if (terms.length > 0 && score <= 0) {
      continue;
    }

    if (isPastDeadline(proposalDue)) {
      continue;
    }

    results.push({
      id: `houston-airport:${solicitationId ?? title}`,
      resultType: "opportunity",
      title,
      buyer: "Houston Airport System",
      sourceName: "Houston Airport System Business",
      sourceLevel: "Adjacent",
      sourceState: "TX",
      sourceType: "Official airport solicitations page",
      url: slug
        ? `https://www.fly2houston.com/airport-business/business-partnerships/contracting/solicitations/${slug}`
        : HOUSTON_AIRPORT_SOLICITATIONS_URL,
      portalUrl: HOUSTON_AIRPORT_SOLICITATIONS_URL,
      score,
      status,
      solicitationId,
      deadline: proposalDue,
      budget,
      contact: [contactName, contactEmail, contactPhone].filter(Boolean).join(" / "),
      documents,
      documentLinks,
      submissionInstructions: "Open the Houston Airport solicitation page, download all bid documents and addenda, then follow the listed submission and question instructions.",
      applicationChecklist: applicationChecklist({
        hasSolicitationId: Boolean(solicitationId),
        hasDeadline: Boolean(proposalDue),
        hasDocuments: documents.length > 0,
        hasContact: Boolean(contactName || contactEmail || contactPhone),
      }),
      summary: [projectDescription, questionsDue ? `Questions due ${questionsDue}.` : "", budget ? `Budget/contract amount: ${budget}.` : ""]
        .filter(Boolean)
        .join(" "),
      nextAction: "Open the Houston Airport posting, confirm scope and submission method, then route it for human review.",
    });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchCapMetroProcurement(query: string): Promise<SearchTaskResult> {
  const source = "CapMetro Procurement";
  try {
    const response = await fetchPublicPage(CAPMETRO_PURCHASING_URL);
    if (!response.ok) {
      return { source, results: [], error: `CapMetro purchasing page returned ${response.status}` };
    }

    return { source, results: parseCapMetroProcurement(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseCapMetroProcurement(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const results: UnifiedSearchResult[] = [];
  const revised = htmlToText(html).match(/Revised\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];
  const noticeDeadline = htmlToText(html).match(/If no responses are received by\s+([^,]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
  const noticeId = htmlToText(html).match(/Solicitation #:\s*(SSP-\s*\d+)/i)?.[1]?.replace(/\s+/g, "");

  if (noticeId && !isPastDeadline(noticeDeadline)) {
    const noticeTitle = `${noticeId}: Notice of Intent to Award Sole Source`;
    const haystack = [noticeTitle, htmlToText(html).slice(0, 2500)].join(" ").toLowerCase();
    const score = scoreOpportunity(haystack, terms, 63);
    if (terms.length === 0 || score > 0) {
      results.push({
        id: `capmetro:${noticeId}`,
        resultType: "opportunity",
        title: noticeTitle,
        buyer: "CapMetro",
        sourceName: "CapMetro Procurement",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Official notice page",
        url: CAPMETRO_PURCHASING_URL,
        portalUrl: CAPMETRO_PURCHASING_URL,
        score,
        status: "Notice/open response window",
        solicitationId: noticeId,
        deadline: noticeDeadline,
        contact: "Raymond.Lalley@capmetro.org",
        submissionInstructions: "Email an unsolicited proposal to the listed CapMetro contact before the response deadline if the business can meet the requirement.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: true, hasDeadline: Boolean(noticeDeadline), hasDocuments: false, hasContact: true }),
        summary: "CapMetro notice of intent to award sole source; responsible sources may submit an unsolicited proposal before the stated deadline.",
        nextAction: "Review the notice and decide whether a credible challenge/unsolicited proposal is appropriate.",
      });
    }
  }

  const futureStart = html.search(/Future Procurement Opportunities/i);
  const futureSection = futureStart >= 0 ? html.slice(futureStart, html.indexOf("</section>", futureStart) > futureStart ? html.indexOf("</section>", futureStart) : undefined) : "";
  for (const group of futureSection.matchAll(/<strong>([\s\S]*?)<\/strong>[\s\S]*?<ul>([\s\S]*?)<\/ul>/gi)) {
    const timing = cleanText(group[1]);
    const items = Array.from(group[2].matchAll(/<li>([\s\S]*?)<\/li>/gi)).map((item) => cleanText(item[1]));
    for (const [index, title] of items.entries()) {
      const haystack = [title, timing, "CapMetro future procurement"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 52 - Math.min(index, 12));
      if (!title || (terms.length > 0 && (score <= 0 || !hasDirectConceptSignal(haystack, query)))) {
        continue;
      }

      results.push({
        id: `capmetro-forecast:${timing}:${title}`,
        resultType: "opportunity",
        title,
        buyer: "CapMetro",
        sourceName: "CapMetro Procurement",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Official procurement forecast",
        url: CAPMETRO_PURCHASING_URL,
        portalUrl: CAPMETRO_PURCHASING_URL,
        score,
        status: "Forecast/possible future solicitation",
        postedDate: revised,
        documents: [`Forecast timing: ${timing}`],
        submissionInstructions: "Do not submit yet. Watch the CapMetro PlanetBids portal and register for alerts so the official solicitation can be reviewed when advertised.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: false, hasContact: false }),
        summary: `CapMetro lists this as a possible future procurement. Forecast timing: ${timing}.`,
        nextAction: "Add this forecast to the watch list and monitor PlanetBids for the official solicitation.",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchViaProcurement(query: string): Promise<SearchTaskResult> {
  const source = "VIA Metropolitan Transit Procurement";
  try {
    const response = await fetchPublicPage(VIA_SOLICITATIONS_URL);
    if (!response.ok) {
      return { source, results: [], error: `VIA public proposal search returned ${response.status}` };
    }

    return { source, results: parseViaProcurement(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

async function searchCpsEnergyProcurement(query: string): Promise<SearchTaskResult> {
  const source = "CPS Energy Procurement and Suppliers";
  try {
    const response = await fetchPublicPage(CPS_ENERGY_B2GNOW_PROPOSALS_URL);
    if (!response.ok) {
      return { source, results: [], error: `CPS Energy public proposal search returned ${response.status}` };
    }

    return { source, results: parseCpsEnergyProcurement(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseCpsEnergyProcurement(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const detailPrefix =
    html.match(/src=(["'])([^"']*ProposalSearchPublicDetail\.asp\?XID=\d+&TN=cpsenergy&PID=)\1/i)?.[2] ??
    "/FrontEnd/ProposalSearchPublicDetail.asp?TN=cpsenergy&PID=";
  const tiles = Array.from(html.matchAll(/<a class='RecordTile' href="javascript:\s*ViewDetail\('([^']+)'\)">([\s\S]*?)(?=<a class='RecordTile'|<\/form>)/gi));

  return tiles
    .map((tile, index): UnifiedSearchResult | undefined => {
      const detailId = tile[1];
      const tileHtml = tile[2];
      const tileText = htmlToText(tileHtml);
      const deadline = cleanText(tileHtml.match(/<div class='DateDue'><div class='Label'>Due<\/div>([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const questionsDeadline = cleanText(
        tileHtml.match(/<div class='DateQuestions'><div class='Label'>Question Deadline<\/div>([\s\S]*?)<\/div>/i)?.[1] ?? "",
      );
      const preBidConference = cleanText(
        tileHtml.match(/<div class='DatePreBidConference'><div class='Label'>Pre-Bid Conference<\/div>([\s\S]*?)<\/div>/i)?.[1] ?? "",
      );
      const status = cleanText(tileHtml.match(/<div class='Status'[^>]*><strong>([\s\S]*?)<\/strong><\/div>/i)?.[1] ?? "Open");
      const description = cpsEnergyTileDescription(tileText, { deadline, questionsDeadline, preBidConference, status });
      const solicitationId = description.match(/^([A-Z0-9-]{5,})\s+-/i)?.[1];
      const haystack = [description, solicitationId, status, questionsDeadline, preBidConference, "CPS Energy B2GNow bid opportunity"].filter(Boolean).join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 70 - Math.min(index, 25));

      if (!description || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (isPastDeadline(deadline)) {
        return undefined;
      }

      const detailUrl = safeAbsoluteUrl(`${detailPrefix}${encodeURIComponent(detailId)}`, CPS_ENERGY_B2GNOW_PROPOSALS_URL) ?? CPS_ENERGY_B2GNOW_PROPOSALS_URL;
      const documents = [
        questionsDeadline ? `Question deadline: ${questionsDeadline}` : undefined,
        preBidConference ? `Pre-bid conference: ${preBidConference}` : undefined,
        "Official solicitation details and response options are available from the CPS Energy B2GNow detail page.",
      ].filter((item): item is string => Boolean(item));

      return {
        id: `cps-energy:${detailId}`,
        resultType: "opportunity",
        title: description,
        buyer: "CPS Energy",
        sourceName: "CPS Energy Procurement and Suppliers",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "B2GNow public proposal search",
        url: detailUrl,
        portalUrl: CPS_ENERGY_B2GNOW_PROPOSALS_URL,
        score,
        status,
        solicitationId,
        deadline,
        documents,
        documentLinks: [{ label: "CPS Energy B2GNow proposal detail and documents", url: detailUrl }],
        submissionInstructions:
          "Open the CPS Energy B2GNow detail page, create or sign into the supplier account if required, download the solicitation documents and addenda, and submit through the portal before the due date.",
        applicationChecklist: applicationChecklist({
          hasSolicitationId: Boolean(solicitationId),
          hasDeadline: Boolean(deadline),
          hasDocuments: true,
          hasContact: false,
        }),
        summary: [solicitationId ? `Reference ${solicitationId}.` : "", deadline ? `Due ${deadline}.` : "", questionsDeadline ? `Questions due ${questionsDeadline}.` : ""]
          .filter(Boolean)
          .join(" "),
        nextAction: "Open the CPS Energy B2GNow detail page, confirm scope and documents, then route it for human review if it fits.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function cpsEnergyTileDescription(
  tileText: string,
  fields: { deadline?: string; questionsDeadline?: string; preBidConference?: string; status?: string },
) {
  let description = tileText;
  for (const value of [fields.deadline, fields.questionsDeadline, fields.preBidConference, fields.status]) {
    if (value) {
      description = description.replace(value, " ");
    }
  }

  return cleanText(
    description
      .replace(/\bDue\b/gi, " ")
      .replace(/\bQuestion Deadline\b/gi, " ")
      .replace(/\bPre-Bid Conference\b/gi, " ")
      .replace(/\bUS\/Central\b/gi, " "),
  );
}

function parseViaProcurement(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const tiles = Array.from(html.matchAll(/<a class='RecordTile' href="javascript:\s*ViewDetail\('([^']+)'\)">([\s\S]*?)(?=<a class='RecordTile'|<\/form>)/gi));

  return tiles
    .map((tile, index): UnifiedSearchResult | undefined => {
      const detailId = tile[1];
      const tileHtml = tile[2];
      const deadline = cleanText(tileHtml.match(/<div class='DateDue'><div class='Label'>Due<\/div>([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const status = cleanText(tileHtml.match(/<div class='Status'[^>]*><strong>([\s\S]*?)<\/strong><\/div>/i)?.[1] ?? "Open");
      const description = cleanText(tileHtml.match(/<div class='Status'[^>]*>[\s\S]*?<\/div>([\s\S]*?)<\/div>\s*<div style=/i)?.[1] ?? "");
      const solicitationId = description.match(/^([A-Z0-9-]+)\s+-/i)?.[1];
      const haystack = [description, solicitationId, status, "VIA Metropolitan Transit procurement"].filter(Boolean).join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 70 - Math.min(index, 20));

      if (!description || (terms.length > 0 && score <= 0)) {
        return undefined;
      }

      if (isPastDeadline(deadline)) {
        return undefined;
      }

      return {
        id: `via:${detailId}`,
        resultType: "opportunity",
        title: description,
        buyer: "VIA Metropolitan Transit",
        sourceName: "VIA Metropolitan Transit Procurement",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "SBE public proposal search",
        url: `https://via.sbecompliance.com/FrontEnd/ProposalSearchPublicDetail.asp?XID=1136&TN=via&PID=${encodeURIComponent(detailId)}`,
        portalUrl: VIA_SOLICITATIONS_URL,
        score,
        status,
        solicitationId,
        deadline,
        submissionInstructions: "Open the VIA proposal detail page, download all documents and addenda, then follow the stated submission method and close time.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: false }),
        summary: [solicitationId ? `Reference ${solicitationId}.` : "", deadline ? `Due ${deadline}.` : ""].filter(Boolean).join(" "),
        nextAction: "Open the VIA detail page, confirm fit and due date, then route it for human review.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchHoustonMetroProcurement(query: string): Promise<SearchTaskResult> {
  const source = "Houston METRO Procurement";
  try {
    const response = await fetchPublicPage(HOUSTON_METRO_PROCUREMENT_URL);
    if (!response.ok) {
      return { source, results: [], error: `Houston METRO procurement page returned ${response.status}` };
    }

    return { source, results: parseHoustonMetroProcurement(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseHoustonMetroProcurement(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const results: UnifiedSearchResult[] = [];

  for (const [index, row] of Array.from(
    html.matchAll(/<tr>\s*<td scope="row"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi),
  ).entries()) {
    const url = decodeHtml(row[1]);
    const solicitationId = cleanText(row[2]);
    const title = cleanText(row[3]);
    const deadline = cleanText(row[4]);
    const haystack = [title, solicitationId, deadline, "Houston METRO Bonfire procurement"].join(" ").toLowerCase();
    const score = scoreOpportunity(haystack, terms, 73 - Math.min(index, 20));

    if (!title || (terms.length > 0 && score <= 0) || isPastDeadline(deadline)) {
      continue;
    }

    results.push({
      id: `houston-metro-open:${solicitationId}:${title}`,
      resultType: "opportunity",
      title: [solicitationId, title].filter(Boolean).join(": "),
      buyer: "Houston METRO",
      sourceName: "Houston METRO Procurement",
      sourceLevel: "Adjacent",
      sourceState: "TX",
      sourceType: "Official open procurements table",
      url,
      portalUrl: HOUSTON_METRO_PROCUREMENT_URL,
      score,
      status: "Open public opportunity",
      solicitationId,
      deadline,
      submissionInstructions: "Open the METRO opportunity, register in the listed portal if required, download all documents and addenda, then submit before the close date.",
      applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: false }),
      summary: deadline ? `Closes ${deadline}.` : "Open procurement listed by Houston METRO.",
      nextAction: "Open the METRO posting, confirm scope and submission rules, then route it for human review.",
    });
  }

  const forecastRows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((row) => Array.from(row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cleanText(cell[1])))
    .filter((cells) => cells.length === 2 && /^(IFB|RFP|RFQ|RFTP|DIR|TBD)$/i.test(cells[1]));

  for (const [index, row] of forecastRows.entries()) {
    const title = row[0];
    const method = row[1];
    const haystack = [title, method, "Houston METRO anticipated procurement forecast"].join(" ").toLowerCase();
    const score = scoreOpportunity(haystack, terms, 55 - Math.min(index, 30));

    if (!title || (terms.length > 0 && (score <= 0 || !hasDirectConceptSignal(haystack, query)))) {
      continue;
    }

    results.push({
      id: `houston-metro-forecast:${method}:${title}`,
      resultType: "opportunity",
      title,
      buyer: "Houston METRO",
      sourceName: "Houston METRO Procurement",
      sourceLevel: "Adjacent",
      sourceState: "TX",
      sourceType: "Official anticipated procurement forecast",
      url: HOUSTON_METRO_PROCUREMENT_URL,
      portalUrl: HOUSTON_METRO_PROCUREMENT_URL,
      score,
      status: "Forecast/anticipated procurement",
      documents: [`Procurement method: ${method}`],
      submissionInstructions: "Do not submit yet. Monitor the METRO open procurements table and vendor portal until the official solicitation is released.",
      applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: false, hasContact: false }),
      summary: `Houston METRO lists this as an anticipated procurement. Expected method: ${method}.`,
      nextAction: "Add this forecast to the watch list and monitor Houston METRO for the official posting.",
    });
  }

  return dedupeResults(results).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchNttaProcurement(query: string): Promise<SearchTaskResult> {
  const source = "North Texas Tollway Authority Procurement";
  try {
    const response = await fetchPublicPage(NTTA_MARKETPLACE_URL);
    if (!response.ok) {
      return { source, results: [], error: `NTTA marketplace returned ${response.status}` };
    }

    return { source, results: parseNttaProcurement(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseNttaProcurement(html: string, query: string): UnifiedSearchResult[] {
  const terms = conceptTerms(query);
  const rows = Array.from(html.matchAll(/<tr\b[^>]*data-ri="[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((row, index): UnifiedSearchResult | undefined => {
      const cells = Array.from(row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);
      if (cells.length < 11) {
        return undefined;
      }

      const linkMatch = cells[0].match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const solicitationId = cleanText(linkMatch?.[2] ?? cells[0]);
      const buyer = cleanText(cells[2]) || "North Texas Tollway Authority";
      const contact = cleanText(cells[5]);
      const title = cleanText(cells[6]);
      const deadline = cleanText(cells[7]);
      const status = cleanText(cells[10]) || "Open";
      const url = linkMatch ? safeAbsoluteUrl(decodeHtml(linkMatch[1]), NTTA_MARKETPLACE_URL) ?? NTTA_MARKETPLACE_URL : NTTA_MARKETPLACE_URL;
      const haystack = [title, solicitationId, buyer, contact, status].filter(Boolean).join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 71 - Math.min(index, 20));

      if (!title || (terms.length > 0 && score <= 0) || isPastDeadline(deadline)) {
        return undefined;
      }

      return {
        id: `ntta:${solicitationId}:${title}`,
        resultType: "opportunity",
        title: [solicitationId, title].filter(Boolean).join(": "),
        buyer,
        sourceName: "North Texas Tollway Authority Procurement",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Bidsync public open-bids table",
        url,
        portalUrl: NTTA_MARKETPLACE_URL,
        score,
        status,
        solicitationId,
        deadline,
        contact,
        submissionInstructions: "Open the NTTA marketplace bid detail page, register or sign in if required, download documents and addenda, then submit before the bid opening date.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: Boolean(solicitationId), hasDeadline: Boolean(deadline), hasDocuments: true, hasContact: Boolean(contact) }),
        summary: [contact ? `Buyer: ${contact}.` : "", deadline ? `Bid opening ${deadline}.` : ""].filter(Boolean).join(" "),
        nextAction: "Open the NTTA bid detail page, confirm scope and submission rules, then route it for human review.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

async function searchSawsProcurement(query: string): Promise<SearchTaskResult> {
  const source = TEXAS_IONWAVE_SOURCE_BY_NAME.get("San Antonio Water System Purchasing");
  if (!source) {
    return { source: "San Antonio Water System Purchasing", results: [], error: "SAWS IonWave source is not configured" };
  }

  try {
    let response = await fetchPublicPage(source.currentBidsUrl);
    if (response.status === 429) {
      await delay(5500);
      response = await fetchPublicPage(source.currentBidsUrl);
    }

    if (!response.ok) {
      return { source: source.sourceName, results: [], error: `SAWS public bid table returned ${response.status}` };
    }

    return { source: source.sourceName, results: parseIonWaveRows(await response.text(), query, source) };
  } catch (error) {
    return { source: source.sourceName, results: [], error: errorMessage(error) };
  }
}

async function searchAustinEnergyRfps(query: string): Promise<SearchTaskResult> {
  const source = "Austin Energy Vendor Information";
  try {
    const response = await fetchPublicPage(AUSTIN_ENERGY_RFPS_URL);
    if (!response.ok) {
      return { source, results: [], error: `Austin Energy RFP page returned ${response.status}` };
    }

    return { source, results: parseAustinEnergyRfps(await response.text(), query) };
  } catch (error) {
    return { source, results: [], error: errorMessage(error) };
  }
}

function parseAustinEnergyRfps(html: string, query: string): UnifiedSearchResult[] {
  const start = html.search(/Current RFPs Available from Austin Energy/i);
  const section = start >= 0 ? html.slice(start, html.indexOf("Date last reviewed", start) > start ? html.indexOf("Date last reviewed", start) : undefined) : html;
  const terms = conceptTerms(query);
  const entries = Array.from(section.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<p><a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));

  return entries
    .map((entry, index): UnifiedSearchResult | undefined => {
      const title = cleanText(entry[1]);
      const summary = cleanText(entry[2]);
      const url = safeAbsoluteUrl(decodeHtml(entry[3]), AUSTIN_ENERGY_RFPS_URL) ?? AUSTIN_ENERGY_RFPS_URL;
      const haystack = [title, summary, "Austin Energy RFP renewable energy resource"].join(" ").toLowerCase();
      const score = scoreOpportunity(haystack, terms, 61 - Math.min(index, 20));

      if (!title || (terms.length > 0 && (score <= 0 || !hasDirectConceptSignal(haystack, query)))) {
        return undefined;
      }

      return {
        id: `austin-energy:${title}`,
        resultType: "opportunity",
        title,
        buyer: "Austin Energy / City of Austin",
        sourceName: "Austin Energy Vendor Information",
        sourceLevel: "Adjacent",
        sourceState: "TX",
        sourceType: "Official Austin Energy RFP page",
        url,
        portalUrl: AUSTIN_ENERGY_RFPS_URL,
        score,
        status: "Current RFP page listing",
        documents: ["RFP detail page"],
        submissionInstructions: "Open the Austin Energy RFP detail page, download the full RFP materials, then follow the stated submission instructions and due date.",
        applicationChecklist: applicationChecklist({ hasSolicitationId: false, hasDeadline: false, hasDocuments: true, hasContact: false }),
        summary,
        nextAction: "Open the Austin Energy RFP detail page, capture the deadline and submission method, then route it for human review.",
      };
    })
    .filter((result): result is UnifiedSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
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
  const documentLinks = result.documentLinks?.length ? result.documentLinks : [{ label: "Posting/detail page", url: result.url }];
  const evidenceText = [
    result.title,
    result.summary,
    result.solicitationId,
    result.documents?.join(" "),
    documentLinks.map((link) => link.label).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
    documentLinks.map((link) => link.label).join(" "),
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

  if (result.documents?.length || documentLinks.length) {
    fitScore += 6;
    fitReasons.push(result.documentLinks?.length ? "Direct document/detail link was captured." : "Official posting link was captured.");
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

  const quality = classifyResultQuality({
    query,
    result,
    evidenceText,
    matchedTerms,
  });

  fitScore += quality.scoreAdjustment;
  fitReasons.push(...quality.fitReasons);
  riskFlags.push(...quality.riskFlags);

  if (quality.tier === "strong") {
    fitScore = Math.max(fitScore, 76);
  } else if (quality.tier === "possible") {
    fitScore = Math.min(fitScore, 84);
  } else {
    fitScore = Math.min(fitScore, 58);
  }

  return {
    ...result,
    documentLinks,
    qualityTier: quality.tier,
    score: Math.max(1, Math.min(100, Math.round(fitScore))),
    fitReasons: fitReasons.slice(0, 5),
    riskFlags: riskFlags.slice(0, 5),
  };
}

function classifyResultQuality({
  query,
  result,
  evidenceText,
  matchedTerms,
}: {
  query: string;
  result: UnifiedSearchResult;
  evidenceText: string;
  matchedTerms: string[];
}): { tier: ResultQualityTier; scoreAdjustment: number; fitReasons: string[]; riskFlags: string[] } {
  const normalizedQuery = normalizeConcept(query);
  const titleText = result.title.toLowerCase();
  const importantTokens = importantConceptTokens(normalizedQuery);
  const matchedImportantTokens = importantTokens.filter((term) => termInText(evidenceText, term));
  const titleImportantTokens = importantTokens.filter((term) => termInText(titleText, term));
  const exactPhrase = normalizedQuery.includes(" ") && evidenceText.includes(normalizedQuery);
  const titlePhrase = exactPhrase && titleText.includes(normalizedQuery);
  const isTrainingSearch = hasTrainingBusinessIntent(normalizedQuery);
  const trainingSignal = TRAINING_DELIVERY_PATTERN.test(evidenceText);
  const leadershipSignal = LEADERSHIP_MANAGEMENT_PATTERN.test(evidenceText);
  const titleTrainingSignal = TITLE_TRAINING_DELIVERY_PATTERN.test(titleText);
  const titleLeadershipSignal = LEADERSHIP_MANAGEMENT_PATTERN.test(titleText);
  const titleConceptSignal = titlePhrase || titleImportantTokens.length > 0 || titleTrainingSignal || titleLeadershipSignal;
  const serviceIntentSignal = isTrainingSearch ? trainingSignal && (leadershipSignal || matchedImportantTokens.length >= 2) : matchedImportantTokens.length >= 2;
  const documentSignal = Boolean(result.documentLinks?.length || result.documents?.length);
  const mismatchLabels = mismatchPatternsFor(evidenceText);
  const hasMultiTermQuery = importantTokens.length > 1 || normalizedQuery.includes(" ");
  const fitReasons: string[] = [];
  const riskFlags: string[] = [];
  let scoreAdjustment = 0;

  if (titlePhrase) {
    scoreAdjustment += 18;
    fitReasons.push("Search phrase appears in the opportunity title.");
  } else if (exactPhrase) {
    scoreAdjustment += 14;
    fitReasons.push("Search phrase appears in the posting details.");
  }

  if (serviceIntentSignal) {
    scoreAdjustment += 12;
    fitReasons.push(isTrainingSearch ? "Matches training or leadership service intent." : "Matches multiple important search terms.");
  } else if (matchedImportantTokens.length === 1 && matchedTerms.length > 0) {
    scoreAdjustment -= 14;
    riskFlags.push("Only one important search term was found, so this may be a broad match.");
  }

  if (documentSignal && (exactPhrase || serviceIntentSignal)) {
    scoreAdjustment += 5;
  }

  if (isTrainingSearch && hasMultiTermQuery && !titleConceptSignal && !exactPhrase) {
    scoreAdjustment -= 18;
    riskFlags.push("The title does not show a clear match to the full search concept.");
  }

  if (mismatchLabels.length > 0) {
    scoreAdjustment -= Math.min(30, mismatchLabels.length * 14);
    riskFlags.push(`Downranked because it appears related to ${mismatchLabels.slice(0, 2).join(" and ")}.`);
  }

  let tier: ResultQualityTier = "weak";
  if (exactPhrase || (isTrainingSearch && titleTrainingSignal && titleLeadershipSignal && mismatchLabels.length === 0)) {
    tier = "strong";
  } else if (isTrainingSearch && titleConceptSignal && (serviceIntentSignal || titleTrainingSignal || titleLeadershipSignal)) {
    tier = "possible";
  } else if (!isTrainingSearch && (serviceIntentSignal || matchedImportantTokens.length >= Math.min(2, Math.max(1, importantTokens.length)))) {
    tier = "possible";
  }

  if (mismatchLabels.length > 0 && !exactPhrase) {
    tier = tier === "strong" ? "possible" : "weak";
  }

  if (isTrainingSearch && hasMultiTermQuery && !titleConceptSignal && !exactPhrase) {
    tier = "weak";
  }

  if (importantTokens.length > 1 && matchedImportantTokens.length === 0) {
    tier = "weak";
    scoreAdjustment -= 18;
    riskFlags.push("The connected source did not expose the important search terms in the posting text.");
  }

  return { tier, scoreAdjustment, fitReasons, riskFlags };
}

const BROAD_CONCEPT_TERMS = new Set(["and", "for", "the", "with", "services", "service", "development", "professional", "program", "programs", "solution", "solutions"]);
const TRAINING_DELIVERY_PATTERN =
  /\b(training|trainings|learning|education|educational|instructional|workshop|workshops|course|courses|curriculum|curricula|facilitation|facilitator|coaching|coach|mentoring|professional development|staff development|leadership development|management development)\b/i;
const TITLE_TRAINING_DELIVERY_PATTERN =
  /\b(training|trainings|learning|development|education|educational|instructional|workshop|workshops|course|courses|curriculum|facilitation|coaching|coach|mentoring)\b/i;
const LEADERSHIP_MANAGEMENT_PATTERN =
  /\b(leadership|leader|leaders|management|manager|managers|supervisor|supervisors|supervisory|executive|executives|organizational|organization|workforce|team|teams|change management|coaching|coach)\b/i;
const TRAINING_BUSINESS_QUERY_PATTERN =
  /\b(leadership|management|manager|supervisor|executive|coaching|training|learning|development|workforce|organizational|organization|facilitation|curriculum|professional)\b/i;
const QUALITY_MISMATCH_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "software/platform procurement",
    pattern:
      /\b(lms|learning management system|software|platform|system implementation|application development|license|licensing|subscription|subscriptions|saas|cloud hosting|managed services|information system)\b/i,
  },
  { label: "exam or testing administration", pattern: /\b(licensing examination|exam administration|testing services|test administration|assessment platform|psychometric)\b/i },
  { label: "clinical or medical staffing", pattern: /\b(psychologist|diagnostician|clinical|medical|nursing|healthcare|therapy|therapist|physician|patient)\b/i },
  { label: "temporary staffing or recruiting", pattern: /\b(staffing|temporary labor|recruiting|recruitment|background check|background checks|personnel services)\b/i },
  { label: "construction or facility work", pattern: /\b(construction|renovation|roofing|hvac|plumbing|janitorial|custodial|landscaping|maintenance)\b/i },
  { label: "specialized school or student services", pattern: /\b(special education|student enrichment|student activities|educational interpreting|interpreter services|teacher certification|teaching and instruction|tutoring|school psychologist)\b/i },
  { label: "trade or operational training", pattern: /\b(aircraft|pilot|fire training fuel|crane|rigging|signaling|dietician|physical fitness|forklift|equipment operator)\b/i },
];

function normalizeConcept(value: string) {
  return value.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function importantConceptTokens(normalizedQuery: string) {
  return normalizedQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !BROAD_CONCEPT_TERMS.has(term));
}

function hasTrainingBusinessIntent(normalizedQuery: string) {
  return TRAINING_BUSINESS_QUERY_PATTERN.test(normalizedQuery);
}

function mismatchPatternsFor(text: string) {
  return QUALITY_MISMATCH_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

function termInText(text: string, term: string) {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  return /rate limited|returned 429|returned 503|service unavailable|timed out|not completed/i.test(error);
}

function pendingSourceMessage(sourceName: string) {
  const sourceSpecificMessage = PENDING_SOURCE_MESSAGES.get(sourceName);
  if (sourceSpecificMessage) {
    return sourceSpecificMessage;
  }

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

  if (/returned 429/i.test(error)) {
    return "Rate limited by the source; cached cooldown is active.";
  }

  if (/returned 503|service unavailable/i.test(error)) {
    return "Source service is temporarily unavailable; retry after cooldown.";
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

function hasDirectConceptSignal(haystack: string, query: string) {
  const normalizedQuery = query.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedQuery) {
    return true;
  }

  if (normalizedQuery.includes(" ") && haystack.includes(normalizedQuery)) {
    return true;
  }

  const directTokens = normalizedQuery
    .split(/\s+/)
    .filter((term) => term.length > 2 && !["development", "professional", "services", "service"].includes(term));

  if (directTokens.some((term) => haystack.includes(term))) {
    return true;
  }

  if (directTokens.includes("training") && /\b(learning|education|instructional|workshop|course|curriculum|facilitation)\b/i.test(haystack)) {
    return true;
  }

  if (directTokens.includes("leadership") && /\b(leader|executive|supervisor|supervisory|coaching)\b/i.test(haystack)) {
    return true;
  }

  return false;
}

function resultRankScore(result: UnifiedSearchResult) {
  const qualityBoost = result.qualityTier === "strong" ? 18 : result.qualityTier === "possible" ? 5 : result.qualityTier === "weak" ? -24 : 0;

  return (
    result.score +
    qualityBoost +
    (result.deadline ? 8 : 0) +
    (result.solicitationId ? 6 : 0) +
    (result.documents?.length || result.documentLinks?.length ? 5 : 0) +
    (result.contact ? 4 : 0) +
    (result.budget ? 4 : 0) +
    (result.summary.length > 80 ? 3 : 0)
  );
}

function searchTaskPriority(sourceName: string) {
  if (TEXAS_IONWAVE_SOURCE_BY_NAME.has(sourceName)) {
    return 0;
  }

  if (TEXAS_BONFIRE_SOURCE_BY_NAME.has(sourceName)) {
    return 0;
  }

  if (/SAM.gov|Texas Electronic State Business Daily|Texas ESBD|Sourcewell|NASPO|OMNIA|BuyBoard|Choice Partners|Texas DIR/i.test(sourceName)) {
    return 0;
  }

  return 1;
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

  const numericMatch = deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    const rawYear = Number(numericMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
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

function formatIsoDateTime(value?: string, timeZone = "America/Chicago") {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function jsonishString(window: string, key: string) {
  const match = window.match(new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`, "i"));
  return match ? decodeJsonishString(match[1]) : undefined;
}

function decodeJsonishString(value: string) {
  try {
    return cleanText(JSON.parse(`"${value.replace(/"/g, "\\\"")}"`) as string);
  } catch {
    return cleanText(value.replace(/\\n/g, " ").replace(/\\\\/g, "\\"));
  }
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

async function runIonWaveQueued<T>(task: () => Promise<T>, queueKey = "default"): Promise<T> {
  const globalStore = globalThis as typeof globalThis & { __govContractFinderIonWaveQueues?: Map<string, Promise<void>> };
  const queues = (globalStore.__govContractFinderIonWaveQueues ??= new Map<string, Promise<void>>());
  const previous = queues.get(queueKey) ?? Promise.resolve();
  let release!: () => void;
  queues.set(queueKey, new Promise<void>((resolve) => {
    release = resolve;
  }));

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

function nearestPreviousHeading(html: string, index: number) {
  const headings = Array.from(html.slice(0, index).matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi));
  const lastHeading = headings.at(-1);
  return lastHeading ? cleanText(lastHeading[1]) : undefined;
}

function fieldFromText(text: string, pattern: RegExp) {
  const value = text.match(pattern)?.[1];
  return value ? cleanText(value.replace(/\s+/g, " ").replace(/[.;]\s*$/, "")) : undefined;
}

function htmlFieldFromSpan(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = html.match(new RegExp(`<span>${escapedLabel}:\\s*([\\s\\S]*?)<\\/span>`, "i"))?.[1];
  return value ? htmlToText(value) : undefined;
}

function htmlAttributeValue(html: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = html.match(new RegExp(`${escapedName}=(["'])([\\s\\S]*?)\\1`, "i"))?.[2];
  return value ? decodeHtml(value) : undefined;
}

function cookieHeaderFromResponse(response: Response) {
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = responseHeaders.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);
  return setCookieHeaders
    .flatMap((header) => header.split(/,(?=\s*[^;,]+=)/))
    .map((header) => header.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookieHeaders(...headers: Array<string | undefined>) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const cookie of header?.split(";") ?? []) {
      const trimmed = cookie.trim();
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      cookies.set(trimmed.slice(0, separatorIndex), trimmed.slice(separatorIndex + 1));
    }
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function extractAnchorLinks(html: string, baseUrl: string): OpportunityDocumentLink[] {
  return Array.from(html.matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi))
    .map((anchor) => {
      const href = decodeHtml(anchor[2]).trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return undefined;
      }

      const url = safeAbsoluteUrl(href, baseUrl);
      const label = cleanText(anchor[3]) || url;
      return url && label ? { label, url } : undefined;
    })
    .filter((link): link is OpportunityDocumentLink => Boolean(link));
}

function dedupeDocumentLinks(links: OpportunityDocumentLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.url}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function safeAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function normalizeDocumentUrl(url?: string) {
  if (!url) {
    return "";
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url;
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
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
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
