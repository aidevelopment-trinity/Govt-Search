"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type MonitorFrequency = "daily" | "weekdays" | "manual";

type MonitorSearch = {
  id: string;
  query: string;
  state_filter: string;
  level_filter: string;
  monitor_enabled: boolean;
  monitor_frequency: MonitorFrequency;
  last_results_count: number;
  last_searched_sources_count: number;
  last_pending_sources_count: number;
  last_error_count: number;
  last_new_results_count: number;
  last_changed_results_count: number;
  last_run_at: string | null;
  last_checked_at: string | null;
  updated_at: string;
};

type MonitorRun = {
  id: string;
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
  started_at: string;
  completed_at: string | null;
};

type MonitorFinding = {
  id: string;
  finding_type: "new" | "changed";
  title: string;
  source_name: string;
  source_state: string | null;
  source_level: string | null;
  buyer: string | null;
  solicitation_id: string | null;
  old_deadline: string | null;
  new_deadline: string | null;
  opportunity_url: string;
  created_at: string;
};

type MonitorResponse = {
  ok: boolean;
  configured: boolean;
  searches: MonitorSearch[];
  runs: MonitorRun[];
  findings: MonitorFinding[];
  errors?: string[];
};

const stateOptions = ["All", "TX", "CO", "FL", "TN", "NC", "GA", "US"];
const levelOptions = ["All", "Federal", "State", "Local", "Adjacent", "Education"];
const frequencyOptions: Array<{ value: MonitorFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "manual", label: "Manual" },
];

export function MonitorDashboard() {
  const [searches, setSearches] = useState<MonitorSearch[]>([]);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [findings, setFindings] = useState<MonitorFinding[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-configured">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("leadership training");
  const [state, setState] = useState("All");
  const [level, setLevel] = useState("All");
  const [frequency, setFrequency] = useState<MonitorFrequency>("daily");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void loadMonitor();
  }, []);

  const enabledCount = searches.filter((search) => search.monitor_enabled).length;
  const recentNewCount = findings.filter((finding) => finding.finding_type === "new").length;
  const recentChangedCount = findings.filter((finding) => finding.finding_type === "changed").length;
  const latestRun = runs[0] ?? null;

  const searchesByFreshness = useMemo(() => {
    return [...searches].sort((a, b) => {
      const aTime = a.last_checked_at ? Date.parse(a.last_checked_at) : 0;
      const bTime = b.last_checked_at ? Date.parse(b.last_checked_at) : 0;
      return aTime - bTime;
    });
  }, [searches]);

  async function loadMonitor() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/gov/monitor");
      const data = (await response.json()) as MonitorResponse;
      if (data.ok) {
        setSearches(data.searches);
        setRuns(data.runs);
        setFindings(data.findings);
        setStatus("ready");
      } else {
        setSearches(data.searches ?? []);
        setRuns(data.runs ?? []);
        setFindings(data.findings ?? []);
        setStatus(data.configured === false ? "not-configured" : "error");
        setMessage(data.errors?.join(" ") || "Monitor data could not be loaded.");
      }
    } catch {
      setStatus("error");
      setMessage("Monitor data could not be loaded.");
    }
  }

  async function createSearch() {
    const concept = query.trim();
    if (concept.length < 3) {
      setMessage("Search term must be at least 3 characters.");
      return;
    }

    setBusyAction("create");
    setMessage("");
    try {
      const response = await fetch("/api/gov/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-search", query: concept, state, level, frequency }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.error || "Monitor search could not be saved.");
      }
      await loadMonitor();
    } catch {
      setMessage("Monitor search could not be saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSearch(search: MonitorSearch, updates: { enabled?: boolean; frequency?: MonitorFrequency }) {
    setBusyAction(search.id);
    setMessage("");
    try {
      const response = await fetch("/api/gov/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-search", id: search.id, ...updates }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.error || "Monitor search could not be updated.");
      }
      await loadMonitor();
    } catch {
      setMessage("Monitor search could not be updated.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runSearch(search: MonitorSearch) {
    setBusyAction(`run:${search.id}`);
    setMessage("");
    try {
      const response = await fetch("/api/gov/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-search", id: search.id }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.message || data.error || "Monitor run failed.");
      }
      await loadMonitor();
    } catch {
      setMessage("Monitor run failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runDue() {
    setBusyAction("run-due");
    setMessage("");
    try {
      const response = await fetch("/api/gov/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-due", maxRuns: 1 }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.message || data.error || "Monitor run failed.");
      }
      await loadMonitor();
    } catch {
      setMessage("Monitor run failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <a className="text-sm font-medium text-signal hover:underline" href="/">
                Back to search
              </a>
              <h1 className="mt-2 text-2xl font-semibold">Monitor</h1>
              <p className="text-sm text-slate-500">Scheduled checks, new opportunities, and source health changes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <NavButton href="/" icon={Search} label="Search" />
              <NavButton href="/proposals" icon={ClipboardList} label="Proposals" />
              <NavButton href="/drafts" icon={FileText} label="Drafts" />
              <NavButton href="/setup" icon={Settings} label="Setup" />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                type="button"
                disabled={status === "loading"}
                onClick={() => void loadMonitor()}
              >
                <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-4 px-5 py-5 lg:px-8">
        {message ? <StatePanel tone="warning" title="Monitor Notice" message={message} /> : null}
        {status === "loading" ? <StatePanel loading title="Loading monitor" message="Reading monitor searches and findings." /> : null}
        {status === "not-configured" ? <StatePanel tone="warning" title="Supabase needs the monitoring schema" message="Run the updated SQL schema, then refresh this page." /> : null}
        {status === "error" ? <StatePanel tone="warning" title="Monitor unavailable" message={message || "Refresh and try again."} /> : null}

        {status === "ready" ? (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <Metric label="Monitors" value={`${enabledCount}/${searches.length}`} />
              <Metric label="New findings" value={recentNewCount} />
              <Metric label="Changed" value={recentChangedCount} />
              <Metric label="Latest run" value={latestRun ? runStatusLabel(latestRun) : "-"} />
            </section>

            <section className="rounded-md border border-line bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <Bell className="size-4 text-slate-500" />
                <h2 className="text-base font-semibold">Monitor Searches</h2>
              </div>
              <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_120px_130px_130px_110px] lg:items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500" htmlFor="monitor-query">
                    Concept
                  </label>
                  <input
                    id="monitor-query"
                    className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-signal"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <Select label="State" value={state} options={stateOptions} onChange={setState} />
                <Select label="Level" value={level} options={levelOptions} onChange={setLevel} />
                <Select label="Frequency" value={frequency} options={frequencyOptions.map((option) => option.value)} onChange={(value) => setFrequency(value as MonitorFrequency)} />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  type="button"
                  disabled={busyAction === "create" || query.trim().length < 3}
                  onClick={() => void createSearch()}
                >
                  <Plus className="size-4" />
                  <span>Add</span>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  type="button"
                  disabled={busyAction === "run-due"}
                  onClick={() => void runDue()}
                >
                  <Play className="size-4" />
                  <span>{busyAction === "run-due" ? "Running" : "Run Due"}</span>
                </button>
              </div>

              <div className="mt-4 divide-y divide-line rounded-md border border-line">
                {searchesByFreshness.length > 0 ? (
                  searchesByFreshness.map((search) => (
                    <div key={search.id} className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_150px_180px_160px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {search.monitor_enabled ? <CheckCircle2 className="size-4 text-emerald-600" /> : <PauseCircle className="size-4 text-slate-400" />}
                          <h3 className="truncate text-sm font-semibold">{search.query}</h3>
                          <span className="rounded-md border border-line bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                            {search.state_filter} · {search.level_filter}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {search.last_checked_at ? `Checked ${formatDateTime(search.last_checked_at)}` : "Not checked yet"} · {search.last_results_count} results · {search.last_pending_sources_count} pending
                        </p>
                      </div>
                      <Select
                        label="Frequency"
                        value={search.monitor_frequency}
                        options={frequencyOptions.map((option) => option.value)}
                        onChange={(value) => void updateSearch(search, { frequency: value as MonitorFrequency })}
                      />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <Metric label="New" value={search.last_new_results_count} compact />
                        <Metric label="Changed" value={search.last_changed_results_count} compact />
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          type="button"
                          disabled={busyAction === search.id}
                          onClick={() => void updateSearch(search, { enabled: !search.monitor_enabled })}
                        >
                          {search.monitor_enabled ? "Pause" : "Enable"}
                        </button>
                        <button
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                          type="button"
                          disabled={busyAction === `run:${search.id}`}
                          onClick={() => void runSearch(search)}
                        >
                          <Play className="size-4" />
                          <span>{busyAction === `run:${search.id}` ? "Running" : "Run"}</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-4 text-sm text-slate-600">No monitor searches yet.</p>
                )}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-md border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold">Findings</h2>
                <div className="mt-3 divide-y divide-line rounded-md border border-line">
                  {findings.length > 0 ? (
                    findings.slice(0, 30).map((finding) => (
                      <a key={finding.id} className="block px-3 py-3 hover:bg-slate-50" href={finding.opportunity_url} target="_blank" rel="noreferrer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${finding.finding_type === "new" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                {finding.finding_type === "new" ? "New" : "Changed"}
                              </span>
                              <span className="text-xs text-slate-500">{finding.source_name}</span>
                            </div>
                            <h3 className="mt-1 text-sm font-semibold">{finding.title}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {finding.buyer ? `${finding.buyer} · ` : ""}
                              {finding.new_deadline ? `Due ${finding.new_deadline}` : "No deadline captured"} · {formatDateTime(finding.created_at)}
                            </p>
                          </div>
                          <ExternalLink className="mt-1 size-4 shrink-0 text-slate-400" />
                        </div>
                      </a>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-sm text-slate-600">No findings yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold">Recent Runs</h2>
                <div className="mt-3 space-y-2">
                  {runs.length > 0 ? (
                    runs.slice(0, 12).map((run) => (
                      <div key={run.id} className="rounded-md border border-line bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{run.query}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {run.trigger_type} · {run.results_count} results · {run.new_results_count} new · {formatDuration(run.elapsed_ms)}
                            </p>
                          </div>
                          <RunStatusIcon status={run.run_status} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">No runs yet.</p>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function NavButton({ href, icon: Icon, label }: { href: string; icon: typeof Search; label: string }) {
  return (
    <a className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" href={href}>
      <Icon className="size-4" />
      <span>{label}</span>
    </a>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <select className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-signal" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {frequencyOptions.find((item) => item.value === option)?.label ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: number | string; compact?: boolean }) {
  return (
    <div className={`rounded-md border border-line bg-slate-50 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${compact ? "text-sm" : "text-lg"} font-semibold`}>{value}</p>
    </div>
  );
}

function RunStatusIcon({ status }: { status: MonitorRun["run_status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  }

  if (status === "running") {
    return <RefreshCw className="size-4 animate-spin text-slate-500" />;
  }

  return <AlertTriangle className="size-4 text-amber-500" />;
}

function StatePanel({ title, message, loading = false, tone = "default" }: { title: string; message: string; loading?: boolean; tone?: "default" | "warning" }) {
  return (
    <div className={`rounded-md border p-5 text-center shadow-panel ${tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-white"}`}>
      {loading ? <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-slate-500" /> : tone === "warning" ? <AlertTriangle className="mx-auto mb-2 size-5 text-amber-500" /> : null}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm opacity-80">{message}</p>
    </div>
  );
}

function runStatusLabel(run: MonitorRun) {
  if (run.run_status === "running") {
    return "Running";
  }

  if (run.run_status === "failed") {
    return "Failed";
  }

  return `${run.new_results_count} new`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
