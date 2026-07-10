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
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProcurementSource, SourceSearchStatus, UnifiedSearchResponse, UnifiedSearchResult } from "@/lib/gov-types";

type SavedProposal = {
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
};

const levelOptions = ["All", "Federal", "State", "Local", "Adjacent", "Education"];
const defaultTerms = ["leadership development", "management training", "supervisor training", "organizational development", "executive coaching"];
const lastSearchStorageKey = "gov-contract-finder:last-search";

type LastSearchState = {
  query: string;
  state: string;
  level: string;
  selectedSource: string;
  searchResponse: UnifiedSearchResponse;
  savedAt: string;
};

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
  const [lastSearchFilters, setLastSearchFilters] = useState({ state: "All", level: "All" });
  const [searchResponse, setSearchResponse] = useState<UnifiedSearchResponse>(
    () => providedInitialSearchResponse ?? initialSearchResponse("leadership development"),
  );
  const [searchBusy, setSearchBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error" | "not-configured">("idle");
  const [savedProposals, setSavedProposals] = useState<SavedProposal[]>([]);
  const [savedProposalsStatus, setSavedProposalsStatus] = useState<"idle" | "loading" | "loaded" | "error" | "not-configured">("idle");

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
  const sourceStatuses = searchResponse.sourceStatuses ?? [];
  const visibleResults = selectedSource === "All" ? searchResponse.results : searchResponse.results.filter((result) => result.sourceName === selectedSource);
  const hasSearched = searchResponse.searchedSources.length > 0 || searchResponse.errors.length > 0;
  const statesCount = new Set(sources.map((source) => source.state)).size;
  const sourceIssueCount = sourceStatuses.filter((status) => status.status !== "ok").length;
  const runSummary = hasSearched
    ? `${searchResponse.counts.opportunities} opportunities · ${searchResponse.counts.connected} sources searched · ${sourceIssueCount} source ${
        sourceIssueCount === 1 ? "issue" : "issues"
      }`
    : "Ready";

  useEffect(() => {
    restoreLastSearch();
    void loadSavedProposals();
  }, []);

  useEffect(() => {
    if (!hasSearched) {
      return;
    }

    saveLastSearch({
      query: searchResponse.query,
      state: lastSearchFilters.state,
      level: lastSearchFilters.level,
      selectedSource,
      searchResponse,
      savedAt: new Date().toISOString(),
    });
  }, [hasSearched, lastSearchFilters.level, lastSearchFilters.state, searchResponse, selectedSource]);

  function restoreLastSearch() {
    try {
      const rawValue = window.sessionStorage.getItem(lastSearchStorageKey);
      if (!rawValue) {
        return;
      }

      const cached = JSON.parse(rawValue) as Partial<LastSearchState>;
      if (!cached.query || !cached.searchResponse?.results || !cached.searchResponse.counts) {
        return;
      }

      setQuery(cached.query);
      setState(cached.state ?? "All");
      setLevel(cached.level ?? "All");
      setLastSearchFilters({ state: cached.state ?? "All", level: cached.level ?? "All" });
      setSelectedSource(cached.selectedSource ?? "All");
      setSearchResponse({ ...cached.searchResponse, sourceStatuses: cached.searchResponse.sourceStatuses ?? [] });
    } catch {
      window.sessionStorage.removeItem(lastSearchStorageKey);
    }
  }

  function saveLastSearch(value: LastSearchState) {
    try {
      window.sessionStorage.setItem(lastSearchStorageKey, JSON.stringify(value));
    } catch {
      // Search restore is a convenience; storage failures should not affect search.
    }
  }

  async function loadSavedProposals() {
    setSavedProposalsStatus("loading");
    try {
      const response = await fetch("/api/gov/tracked-opportunities");
      const data = (await response.json()) as { ok: boolean; configured?: boolean; data?: SavedProposal[] };

      if (data.ok) {
        setSavedProposals(data.data ?? []);
        setSavedProposalsStatus("loaded");
      } else {
        setSavedProposalsStatus(data.configured === false ? "not-configured" : "error");
      }
    } catch {
      setSavedProposalsStatus("error");
    }
  }

  async function runSearch(nextQuery = query, options: { forceRefresh?: boolean } = {}) {
    const concept = nextQuery.trim();
    if (concept.length < 3) {
      setSearchResponse({
        query: nextQuery,
        configured: false,
        results: [],
        counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
        searchedSources: [],
        pendingSources: [],
        sourceStatuses: [],
        errors: [],
        message: "Enter at least 3 characters.",
      });
      return;
    }

    setSelectedSource("All");
    const searchFilters = { state, level };
    setLastSearchFilters(searchFilters);
    setSearchBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65000);
    try {
      const params = new URLSearchParams({ q: concept, state, level });
      if (options.forceRefresh) {
        params.set("cache", "refresh");
      }
      const response = await fetch(`/api/gov/search?${params.toString()}`, { signal: controller.signal });
      const data = (await response.json()) as UnifiedSearchResponse;
      const normalizedData = { ...data, sourceStatuses: data.sourceStatuses ?? [] };
      setSearchResponse(normalizedData);
      saveLastSearch({ query: concept, state: searchFilters.state, level: searchFilters.level, selectedSource: "All", searchResponse: normalizedData, savedAt: new Date().toISOString() });
    } catch (error) {
      setSearchResponse({
        query: concept,
        configured: false,
        cached: false,
        results: [],
        counts: { opportunities: 0, connected: 0, pending: 0, total: 0 },
        searchedSources: [],
        pendingSources: [],
        sourceStatuses: [],
        errors: [error instanceof Error && error.name === "AbortError" ? "Search took too long and was stopped." : "Search API unavailable."],
        message: error instanceof Error && error.name === "AbortError" ? "Search timed out before results could be returned." : "Search is unavailable.",
      });
    } finally {
      window.clearTimeout(timeout);
      setSearchBusy(false);
    }
  }

  async function saveCurrentSearch() {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/gov/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchResponse.query,
          state: lastSearchFilters.state,
          level: lastSearchFilters.level,
          resultsCount: searchResponse.counts.opportunities,
          searchedSourcesCount: searchResponse.counts.connected,
          pendingSourcesCount: searchResponse.counts.pending,
          errorCount: searchResponse.errors.length,
        }),
      });

      const data = (await response.json()) as { ok: boolean; configured?: boolean };
      if (data.ok) {
        setSaveStatus("saved");
      } else {
        setSaveStatus(data.configured === false ? "not-configured" : "error");
      }
    } catch {
      setSaveStatus("error");
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
            <a
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href="/proposals"
            >
              <ClipboardList className="size-4" />
              <span>Saved Proposals</span>
            </a>
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
                  {searchBusy
                    ? "Searching connected sources..."
                    : hasSearched
                      ? `Latest search: "${searchResponse.query}"${searchResponse.cached ? ` · cached ${formatDuration(searchResponse.cacheAgeMs)} ago` : ""}`
                      : "Run a search to see matching opportunities."}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-slate-600">
                <Filter className="size-4" />
                <span>{state} / {level}</span>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                type="button"
                disabled={!hasSearched || searchBusy}
                onClick={() => void runSearch(searchResponse.query, { forceRefresh: true })}
              >
                <RefreshCw className={`size-4 ${searchBusy ? "animate-spin" : ""}`} />
                <span>Refresh Sources</span>
              </button>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                type="button"
                disabled={!hasSearched || saveStatus === "saving"}
                onClick={() => void saveCurrentSearch()}
              >
                <Save className="size-4" />
                <span>{saveStatusLabel(saveStatus)}</span>
              </button>
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
                <ResultRow key={result.id} result={result} onSaved={() => void loadSavedProposals()} />
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Saved Proposals</h2>
                <p className="text-xs text-slate-500">{savedProposalsStatusLabel(savedProposalsStatus)}</p>
              </div>
              <button
                className="inline-flex size-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                type="button"
                disabled={savedProposalsStatus === "loading"}
                onClick={() => void loadSavedProposals()}
                aria-label="Refresh saved proposals"
              >
                <RefreshCw className={`size-4 ${savedProposalsStatus === "loading" ? "animate-spin" : ""}`} />
              </button>
            </div>
            {savedProposals.length > 0 ? (
              <div className="space-y-2">
                {savedProposals.slice(0, 8).map((proposal) => (
                  <a
                    key={proposal.id}
                    className="block rounded-md border border-line bg-slate-50 px-3 py-2 hover:border-signal"
                    href={proposal.opportunity_url}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-ink">{proposal.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {proposal.source_name}
                      {proposal.source_state ? ` · ${proposal.source_state}` : ""}
                      {proposal.deadline ? ` · Due ${proposal.deadline}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {savedProposalsStatus === "not-configured" ? "Connect Supabase to save proposals." : "No saved proposals yet."}
              </p>
            )}
          </section>

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
              <Metric label="Cache" value={hasSearched ? (searchResponse.cached ? "Hit" : "Fresh") : "-"} />
              <Metric label="Time" value={hasSearched ? formatDuration(searchResponse.elapsedMs) : "-"} />
            </div>
            {searchResponse.searchedSources.length > 0 && !searchResponse.configured ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                SAM.gov federal API is not connected in this run.
              </p>
            ) : null}
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Source Health</h2>
              {sourceIssueCount > 0 ? <AlertTriangle className="size-4 text-amber-500" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
            </div>
            {sourceStatuses.length > 0 ? (
              <div className="space-y-2">
                {sourceStatuses.slice(0, 8).map((status) => (
                  <SourceStatusRow key={`${status.sourceName}:${status.status}`} status={status} />
                ))}
                {sourceStatuses.length > 8 ? <p className="text-xs text-slate-500">+{sourceStatuses.length - 8} more sources.</p> : null}
              </div>
            ) : (
              <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {hasSearched ? "No source status details were returned." : "No run yet."}
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

function ResultRow({ result, onSaved }: { result: UnifiedSearchResult; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [trackStatus, setTrackStatus] = useState<"idle" | "saving" | "saved" | "error" | "not-configured">("idle");
  const checklist = result.applicationChecklist?.length ? result.applicationChecklist : fallbackChecklist(result);
  const documents = result.documents?.filter(Boolean) ?? [];
  const documentLinks = result.documentLinks?.filter((link) => link.label && link.url) ?? [];

  async function trackResult() {
    setTrackStatus("saving");
    try {
      const response = await fetch("/api/gov/tracked-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = (await response.json()) as { ok: boolean; configured?: boolean };
      if (data.ok) {
        setTrackStatus("saved");
        onSaved();
      } else {
        setTrackStatus(data.configured === false ? "not-configured" : "error");
      }
    } catch {
      setTrackStatus("error");
    }
  }

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
            <Badge icon={CheckCircle2} label={`Fit ${result.score}`} />
            <Badge icon={Building2} label={result.buyer} />
            <Badge icon={ShieldCheck} label={result.status} />
            {result.solicitationId ? <span className="rounded-md border border-line bg-white px-2 py-1">ID {result.solicitationId}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            type="button"
            disabled={trackStatus === "saving" || trackStatus === "saved"}
            onClick={() => void trackResult()}
          >
            <Save className="size-4" />
            <span>{trackStatusLabel(trackStatus)}</span>
          </button>
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
          {documentLinks[0] ? (
            <a
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={documentLinks[0].url}
              rel="noreferrer"
              target="_blank"
            >
              <FileText className="size-4" />
              <span>Docs</span>
            </a>
          ) : null}
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
              {documentLinks.length > 0 || documents.length > 0 ? (
                <ul className="space-y-1 text-sm text-slate-700">
                  {documentLinks.slice(0, 6).map((document) => (
                    <li key={`${document.label}:${document.url}`} className="rounded-md border border-line bg-slate-50 px-2 py-1">
                      <a
                        className="inline-flex items-center gap-2 font-medium text-signal hover:text-teal-900"
                        href={document.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>{document.label}</span>
                      </a>
                    </li>
                  ))}
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
              <span>Fit Analysis</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">Why It Matched</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {(result.fitReasons?.length ? result.fitReasons : ["The title or source data matched the search concept."]).map((reason) => (
                    <li key={reason} className="rounded-md border border-line bg-slate-50 px-2 py-1">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-500">Watch Items</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {(result.riskFlags?.length ? result.riskFlags : ["No major missing fields were detected from the connected source."]).map((flag) => (
                    <li key={flag} className="rounded-md border border-line bg-slate-50 px-2 py-1">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

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

function saveStatusLabel(status: "idle" | "saving" | "saved" | "error" | "not-configured") {
  if (status === "saving") return "Saving";
  if (status === "saved") return "Saved";
  if (status === "not-configured") return "Connect Supabase";
  if (status === "error") return "Save failed";
  return "Save Search";
}

function trackStatusLabel(status: "idle" | "saving" | "saved" | "error" | "not-configured") {
  if (status === "saving") return "Saving";
  if (status === "saved") return "Saved";
  if (status === "not-configured") return "Connect Supabase";
  if (status === "error") return "Save failed";
  return "Save Proposal";
}

function savedProposalsStatusLabel(status: "idle" | "loading" | "loaded" | "error" | "not-configured") {
  if (status === "loading") return "Loading";
  if (status === "loaded") return "Latest saved list";
  if (status === "not-configured") return "Supabase not connected";
  if (status === "error") return "Could not load";
  return "Ready";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function SourceStatusRow({ status }: { status: SourceSearchStatus }) {
  const colorClass =
    status.status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : status.status === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${colorClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{status.sourceName}</p>
        <span className="shrink-0 uppercase">{status.status}</span>
      </div>
      <p className="mt-1">{status.message}</p>
      <p className="mt-1 text-[11px] opacity-80">
        {status.resultCount} result{status.resultCount === 1 ? "" : "s"}
        {status.durationMs !== undefined ? ` · ${formatDuration(status.durationMs)}` : ""}
      </p>
    </div>
  );
}

function formatDuration(ms?: number) {
  if (ms === undefined) {
    return "-";
  }

  if (ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }

  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
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
    sourceStatuses: [],
    errors: [],
    message: "Ready.",
  };
}
