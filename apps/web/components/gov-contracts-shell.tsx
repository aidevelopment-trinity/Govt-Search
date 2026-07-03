"use client";

import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  CheckCircle2,
  Database,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  Landmark,
  Link2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ProcurementSource, UnifiedSearchResult } from "@/lib/gov-types";

type UnifiedSearchResponse = {
  query: string;
  configured: boolean;
  results: UnifiedSearchResult[];
  counts: {
    opportunities: number;
    connected: number;
    pending: number;
    total: number;
  };
  searchedSources: string[];
  pendingSources: string[];
  errors: string[];
  message?: string;
};

const levelOptions = ["All", "Federal", "State", "Local", "Adjacent", "Education"];
const defaultTerms = ["leadership development", "management training", "supervisor training", "organizational development", "executive coaching"];

export function GovContractsShell({
  sources,
  initialSearchResponse: providedInitialSearchResponse,
}: {
  sources: ProcurementSource[];
  initialSearchResponse?: UnifiedSearchResponse;
}) {
  const [query, setQuery] = useState("leadership development");
  const [state, setState] = useState("All");
  const [level, setLevel] = useState("All");
  const [selectedSource, setSelectedSource] = useState("All");
  const [searchResponse, setSearchResponse] = useState<UnifiedSearchResponse>(
    () => providedInitialSearchResponse ?? initialSearchResponse("leadership development"),
  );
  const [searchBusy, setSearchBusy] = useState(false);

  const stateOptions = useMemo(() => ["All", ...Array.from(new Set(sources.map((source) => source.state))).sort()], [sources]);
  const sourceCoverage = useMemo(() => {
    return Array.from(
      sources.reduce((coverage, source) => {
        coverage.set(source.state, (coverage.get(source.state) ?? 0) + 1);
        return coverage;
      }, new Map<string, number>()),
    ).sort(([stateA], [stateB]) => stateA.localeCompare(stateB));
  }, [sources]);
  const sourceTabs = useMemo(() => {
    const counts = searchResponse.results.reduce((items, result) => {
      items.set(result.sourceName, (items.get(result.sourceName) ?? 0) + 1);
      return items;
    }, new Map<string, number>());

    return [["All", searchResponse.results.length] as const, ...Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))];
  }, [searchResponse.results]);
  const visibleResults = selectedSource === "All" ? searchResponse.results : searchResponse.results.filter((result) => result.sourceName === selectedSource);
  const hasSearched = searchResponse.searchedSources.length > 0 || searchResponse.errors.length > 0;
  const statesCount = new Set(sources.map((source) => source.state)).size;
  const runSummary = hasSearched
    ? `${searchResponse.counts.opportunities} opportunities · ${searchResponse.counts.connected} sources searched · ${searchResponse.errors.length} connector ${
        searchResponse.errors.length === 1 ? "issue" : "issues"
      }`
    : "Ready";

  async function runSearch(nextQuery = query) {
    const concept = nextQuery.trim();
    if (concept.length < 3) {
      setSearchResponse({
        query: nextQuery,
        configured: false,
        results: [],
        counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
        searchedSources: [],
        pendingSources: [],
        errors: [],
        message: "Enter at least 3 characters.",
      });
      return;
    }

    setSelectedSource("All");
    setSearchBusy(true);
    try {
      const params = new URLSearchParams({ q: concept, state, level });
      const response = await fetch(`/api/gov/search?${params.toString()}`);
      const data = (await response.json()) as UnifiedSearchResponse;
      setSearchResponse(data);
    } catch {
      setSearchResponse({
        query: concept,
        configured: false,
        results: [],
        counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
        searchedSources: [],
        pendingSources: [],
        errors: ["Search API unavailable."],
        message: "Search is unavailable.",
      });
    } finally {
      setSearchBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-white">
                <Landmark className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold md:text-2xl">Gov Contract Finder</h1>
                <p className="text-sm text-slate-500">Search connected procurement sources for actual opportunities.</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600 md:inline-flex">
              <Database className="size-4" />
              <span>{sources.length} sources</span>
            </div>
          </div>

          <form
            className="rounded-md border border-line bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_130px_130px_116px] lg:items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500" htmlFor="contract-query">
                  Concept
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="contract-query"
                    className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-signal"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Leadership training, change management, executive coaching"
                  />
                </div>
              </div>
              <Select label="State" value={state} options={stateOptions} onChange={setState} />
              <Select label="Level" value={level} options={levelOptions} onChange={setLevel} />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={searchBusy || query.trim().length < 3}
              >
                <Search className="size-4" />
                <span>{searchBusy ? "Searching" : "Search"}</span>
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {defaultTerms.map((term) => (
                <button
                  key={term}
                  className="shrink-0 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-signal hover:text-signal"
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    void runSearch(term);
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          </form>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <div className="min-w-0 space-y-4">
          <section className="rounded-md border border-line bg-white shadow-panel">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">Results</h2>
                  <span className="rounded-md border border-line bg-slate-50 px-2 py-1 text-xs text-slate-600">{runSummary}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {searchBusy ? "Searching connected sources..." : hasSearched ? `Latest search: "${searchResponse.query}"` : "Run a search to see matching opportunities."}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-slate-600">
                <Filter className="size-4" />
                <span>{state} / {level}</span>
              </div>
            </div>

            {sourceTabs.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-3">
                {sourceTabs.map(([source, count]) => (
                  <button
                    key={source}
                    className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      selectedSource === source ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-700 hover:border-signal hover:text-signal"
                    }`}
                    type="button"
                    onClick={() => setSelectedSource(source)}
                  >
                    {source} {count}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="divide-y divide-line">
              {visibleResults.slice(0, 80).map((result) => (
                <ResultRow key={result.id} result={result} />
              ))}
              {visibleResults.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">{hasSearched ? "No matching opportunities found." : "No search has run yet."}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {hasSearched ? "Try a broader concept or a narrower state filter." : "Enter a concept and click Search."}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Run Status</h2>
              {searchResponse.errors.length > 0 ? <AlertTriangle className="size-4 text-amber-500" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Results" value={searchResponse.counts.opportunities.toString()} />
              <Metric label="Searched" value={searchResponse.counts.connected.toString()} />
              <Metric label="Pending" value={searchResponse.counts.pending.toString()} />
              <Metric label="States" value={statesCount.toString()} />
            </div>
            {searchResponse.searchedSources.length > 0 && !searchResponse.configured ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                SAM.gov federal API is not connected in this run.
              </p>
            ) : null}
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Connector Issues</h2>
              <AlertTriangle className="size-4 text-slate-500" />
            </div>
            {searchResponse.errors.length > 0 ? (
              <div className="space-y-2">
                {searchResponse.errors.slice(0, 6).map((error) => (
                  <p key={error} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                    {error}
                  </p>
                ))}
                {searchResponse.errors.length > 6 ? <p className="text-xs text-slate-500">+{searchResponse.errors.length - 6} more issues.</p> : null}
              </div>
            ) : (
              <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {hasSearched ? "No connector issues in the latest run." : "No run yet."}
              </p>
            )}
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Source Coverage</h2>
              <Landmark className="size-4 text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sourceCoverage.map(([sourceState, count]) => (
                <div key={sourceState} className="rounded-md border border-line bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500">{sourceState}</p>
                  <p className="text-sm font-semibold">{count}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function ResultRow({ result }: { result: UnifiedSearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const checklist = result.applicationChecklist?.length ? result.applicationChecklist : fallbackChecklist(result);
  const documents = result.documents?.filter(Boolean) ?? [];

  return (
    <article className="px-4 py-3 hover:bg-slate-50">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-signal">{result.sourceName}</span>
            <span>{result.sourceLevel}</span>
            <span>{result.sourceState}</span>
            {result.deadline ? <span>Due {result.deadline}</span> : null}
          </div>
          <h3 className="text-sm font-semibold leading-6 text-ink md:text-base">{result.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{result.summary}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <Badge icon={Building2} label={result.buyer} />
            <Badge icon={ShieldCheck} label={result.status} />
            {result.solicitationId ? <span className="rounded-md border border-line bg-white px-2 py-1">ID {result.solicitationId}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            <span>Details</span>
          </button>
          <a
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={result.portalUrl}
          >
            <Link2 className="size-4" />
            <span>Portal</span>
          </a>
          <a
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-slate-800"
            href={result.url}
          >
            <ExternalLink className="size-4" />
            <span>Open</span>
          </a>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 rounded-md border border-line bg-slate-50 p-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <DetailCard icon={CalendarClock} label="Expires / Due" value={result.deadline || "Not found in connected source"} />
            <DetailCard icon={DollarSign} label="Budget" value={result.budget || "Not found in connected source"} />
            <DetailCard icon={Building2} label="Buyer / Contact" value={result.contact || result.buyer || "Not found in connected source"} />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <section className="rounded-md border border-line bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="size-4 text-signal" />
                <span>Application Brief</span>
              </div>
              <dl className="grid gap-2 text-sm text-slate-700">
                <InfoLine label="Status" value={result.status} />
                <InfoLine label="Reference" value={result.solicitationId || "Not found in connected source"} />
                <InfoLine label="Posted" value={result.postedDate || "Not found in connected source"} />
                <InfoLine label="Submission" value={result.submissionInstructions || result.nextAction} />
              </dl>
            </section>

            <section className="rounded-md border border-line bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-signal" />
                <span>Documents / Data Captured</span>
              </div>
              {documents.length > 0 ? (
                <ul className="space-y-1 text-sm text-slate-700">
                  {documents.slice(0, 6).map((document) => (
                    <li key={document} className="rounded-md border border-line bg-slate-50 px-2 py-1">
                      {document}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No document list was exposed by this connected source. Open the posting to download the packet and addenda.</p>
              )}
            </section>
          </div>

          <section className="mt-3 rounded-md border border-line bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Application Checklist</span>
            </div>
            <ul className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              {checklist.map((item) => (
                <li key={item} className="rounded-md border border-line bg-slate-50 px-2 py-1">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function DetailCard({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function fallbackChecklist(result: UnifiedSearchResult) {
  return [
    result.solicitationId ? "Record the solicitation/reference ID in the opportunity tracker." : "Find and record the solicitation/reference ID from the portal.",
    result.deadline ? "Confirm the response deadline and set an internal review deadline at least 48 hours earlier." : "Find the response deadline in the posting documents.",
    "Download the solicitation packet, addenda, required forms, and pricing templates.",
    "Find buyer contact information and the deadline for written questions.",
    "Confirm vendor registration, submission portal access, insurance, certifications, and required representations.",
    "Draft the technical response, pricing, assumptions, exceptions, and attachments for human review.",
  ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = `${label.toLowerCase()}-filter`;

  return (
    <div className="block text-xs font-medium text-slate-500">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="mt-1 h-10 w-full rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-signal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Badge({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1">
      <Icon className="size-3.5 text-slate-400" />
      <span>{label}</span>
    </span>
  );
}

function initialSearchResponse(query: string): UnifiedSearchResponse {
  return {
    query,
    configured: false,
    results: [],
    counts: {
      opportunities: 0,
      connected: 0,
      pending: 0,
      total: 0,
    },
    searchedSources: [],
    pendingSources: [],
    errors: [],
    message: "Ready.",
  };
}
