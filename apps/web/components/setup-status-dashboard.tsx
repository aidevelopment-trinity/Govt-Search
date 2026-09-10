"use client";

import { AlertTriangle, Bell, CheckCircle2, ClipboardList, FileText, Mail, RefreshCw, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";

type HealthResponse = {
  ok: boolean;
  completedAt: string;
  services: {
    supabase: {
      configured: boolean;
      reachable: boolean;
      status: string;
      message: string;
    };
    googleDocs: {
      configured: boolean;
      driveFolderConfigured: boolean;
      reviewerConfigured: boolean;
      status: string;
      message: string;
    };
    monitoring: {
      configured: boolean;
      schemaReady: boolean;
      cronSecretConfigured: boolean;
      status: string;
      message: string;
    };
    emailNotifications: {
      configured: boolean;
      providerConfigured: boolean;
      schemaReady: boolean;
      status: string;
      message: string;
    };
    searchObservability: {
      configured: boolean;
      schemaReady: boolean;
      status: string;
      message: string;
    };
  };
  counts: {
    trackedOpportunities: number;
    proposalDrafts: number;
    approvedResponseBlocks: number;
    companyProfile: number;
    emailSubscribers: number;
    keywordSubscriptions: number;
    notificationDeliveries: number;
    sourceHealthOk: number;
    sourceHealthPending: number;
    sourceHealthError: number;
    searchRuns: number;
  };
  sourceHealth: {
    recent: SourceHealthView[];
    issues: SourceHealthView[];
  };
  searchRuns: {
    recent: SearchRunView[];
    runtimeRecent: SearchRunView[];
  };
  samUsage: {
    date: string;
    runtimeCallsToday: number;
    runtimeRateLimitedToday: number;
    lastStatus?: number | "error";
    lastCheckedAt?: string;
    lastMessage?: string;
    lastRateLimit?: {
      limit?: string;
      remaining?: string;
      reset?: string;
      retryAfter?: string;
    };
  };
  checks: Array<{ name: string; ok: boolean; message: string }>;
  nextSteps: string[];
};

type SourceHealthView = {
  sourceName: string;
  sourceState: string | null;
  sourceLevel: string | null;
  status: string;
  message: string | null;
  checkedAt: string;
};

type SearchRunView = {
  id: string;
  query: string;
  state: string;
  level: string;
  cacheStatus: string;
  resultsCount: number;
  searchedSourcesCount: number;
  pendingSourcesCount: number;
  errorCount: number;
  elapsedMs: number;
  samCalls: number;
  samRateLimited: boolean;
  completedAt: string;
};

export function SetupStatusDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void loadHealth();
  }, []);

  async function loadHealth() {
    setStatus("loading");
    try {
      const response = await fetch("/api/gov/system-health");
      const data = (await response.json()) as HealthResponse;
      setHealth(data);
      setStatus("ready");
    } catch {
      setStatus("error");
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
              <h1 className="mt-2 text-2xl font-semibold">Setup Status</h1>
              <p className="text-sm text-slate-500">Check database, draft, and Google Docs readiness from one place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <NavButton href="/" icon={Search} label="Search" />
              <NavButton href="/monitor" icon={Bell} label="Monitor" />
              <NavButton href="/notifications" icon={Mail} label="Email" />
              <NavButton href="/proposals" icon={ClipboardList} label="Proposals" />
              <NavButton href="/drafts" icon={FileText} label="Drafts" />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                type="button"
                disabled={status === "loading"}
                onClick={() => void loadHealth()}
              >
                <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-4 px-5 py-5 lg:px-8">
        {status === "error" ? <StatePanel title="Could not load setup status" message="Refresh and try again." /> : null}
        {status === "loading" ? <StatePanel loading title="Checking setup" message="Reading production configuration and database tables." /> : null}

        {health && status === "ready" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <ServiceCard
                title="Supabase"
                ok={health.services.supabase.configured && health.services.supabase.reachable}
                status={health.services.supabase.status}
                message={health.services.supabase.message}
              />
              <ServiceCard
                title="Monitoring"
                ok={health.services.monitoring.configured}
                status={health.services.monitoring.status}
                message={health.services.monitoring.message}
              >
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <SetupFlag label="Schema" ok={health.services.monitoring.schemaReady} />
                  <SetupFlag label="Cron secret" ok={health.services.monitoring.cronSecretConfigured} />
                </div>
              </ServiceCard>
              <ServiceCard
                title="Email"
                ok={health.services.emailNotifications.configured}
                status={health.services.emailNotifications.status}
                message={health.services.emailNotifications.message}
              >
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <SetupFlag label="Schema" ok={health.services.emailNotifications.schemaReady} />
                  <SetupFlag label="Resend" ok={health.services.emailNotifications.providerConfigured} />
                </div>
              </ServiceCard>
              <ServiceCard
                title="Search Logs"
                ok={health.services.searchObservability.configured}
                status={health.services.searchObservability.status}
                message={health.services.searchObservability.message}
              >
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <SetupFlag label="Schema" ok={health.services.searchObservability.schemaReady} />
                </div>
              </ServiceCard>
              <ServiceCard
                title="Google Docs"
                ok={health.services.googleDocs.configured}
                status={health.services.googleDocs.status}
                message={health.services.googleDocs.message}
              >
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <SetupFlag label="Drive folder" ok={health.services.googleDocs.driveFolderConfigured} />
                  <SetupFlag label="Reviewer email" ok={health.services.googleDocs.reviewerConfigured} />
                </div>
              </ServiceCard>
            </div>

            <section className="rounded-md border border-line bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <Settings className="size-4 text-slate-500" />
                <h2 className="text-base font-semibold">Production Data</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Saved proposals" value={health.counts.trackedOpportunities} />
                <Metric label="Drafts" value={health.counts.proposalDrafts} />
                <Metric label="Approved blocks" value={health.counts.approvedResponseBlocks} />
                <Metric label="Company memory" value={health.counts.companyProfile ? "Ready" : "Empty"} />
                <Metric label="Email recipients" value={health.counts.emailSubscribers} />
                <Metric label="Keyword alerts" value={health.counts.keywordSubscriptions} />
                <Metric label="Email deliveries" value={health.counts.notificationDeliveries} />
                <Metric label="Search runs" value={health.counts.searchRuns || health.searchRuns.runtimeRecent.length} />
                <Metric label="Sources OK" value={health.counts.sourceHealthOk} />
                <Metric label="Sources pending" value={health.counts.sourceHealthPending} />
                <Metric label="Source errors" value={health.counts.sourceHealthError} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-md border border-line bg-white p-4 shadow-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">SAM.gov Usage</h2>
                    <p className="text-sm text-slate-500">Runtime counters from this deployment instance.</p>
                  </div>
                  {health.samUsage.runtimeRateLimitedToday > 0 ? (
                    <AlertTriangle className="size-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  )}
                </div>
                <div className="mt-3 grid gap-2">
                  <Metric label="Calls today" value={health.samUsage.runtimeCallsToday} />
                  <Metric label="Rate limited today" value={health.samUsage.runtimeRateLimitedToday} />
                  <Metric label="Last status" value={health.samUsage.lastStatus ?? "No calls"} />
                  <Metric label="Remaining header" value={health.samUsage.lastRateLimit?.remaining ?? "Not sent"} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  SAM does not always send daily quota headers. This shows what the API returned to the app.
                </p>
              </div>

              <RecentSearchRuns runs={health.searchRuns.recent.length > 0 ? health.searchRuns.recent : health.searchRuns.runtimeRecent} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-md border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold">Table Checks</h2>
                <div className="mt-3 divide-y divide-line rounded-md border border-line">
                  {health.checks.length > 0 ? (
                    health.checks.map((check) => (
                      <div key={check.name} className="flex items-start gap-3 px-3 py-2">
                        {check.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />}
                        <div>
                          <p className="text-sm font-medium">{check.name}</p>
                          <p className="text-sm text-slate-500">{check.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-slate-600">No table checks have run yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold">Next Steps</h2>
                {health.nextSteps.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {health.nextSteps.map((step) => (
                      <li key={step} className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {step}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-700">Core setup is ready.</p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-line bg-white p-4 shadow-panel">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Source Health Issues</h2>
                  <p className="text-sm text-slate-500">Sources that are pending, blocked, rate-limited, or returning errors.</p>
                </div>
                <p className="text-sm text-slate-500">{health.sourceHealth.issues.length} shown</p>
              </div>
              <div className="mt-3 overflow-hidden rounded-md border border-line">
                {health.sourceHealth.issues.length > 0 ? (
                  <div className="divide-y divide-line">
                    {health.sourceHealth.issues.map((source) => (
                      <div key={`${source.sourceName}-${source.checkedAt}`} className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_120px_140px] md:items-center">
                        <div>
                          <p className="font-medium">{source.sourceName}</p>
                          <p className="mt-1 text-sm text-slate-500">{source.message ?? "No message captured."}</p>
                        </div>
                        <StatusPill status={source.status} />
                        <p className="text-sm text-slate-500">{formatDateTime(source.checkedAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-600">No current source issues captured.</p>
                )}
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

function ServiceCard({ title, ok, status, message, children }: { title: string; ok: boolean; status: string; message: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
        </div>
        {ok ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-5 shrink-0 text-amber-500" />}
      </div>
      <span className="mt-3 inline-flex rounded-md border border-line bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">{statusLabel(status)}</span>
      {children}
    </section>
  );
}

function SetupFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-line bg-slate-50 px-2 py-1">
      {ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-500" />}
      <span>{label}</span>
    </div>
  );
}

function RecentSearchRuns({ runs }: { runs: SearchRunView[] }) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Recent Search Runs</h2>
          <p className="text-sm text-slate-500">Fresh searches, cache hits, result counts, and SAM calls.</p>
        </div>
        <p className="text-sm text-slate-500">{runs.length} shown</p>
      </div>
      <div className="mt-3 overflow-hidden rounded-md border border-line">
        {runs.length > 0 ? (
          <div className="divide-y divide-line">
            {runs.slice(0, 10).map((run) => (
              <div key={run.id} className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_88px_88px_88px_130px] lg:items-center">
                <div>
                  <p className="font-medium">{run.query}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {run.state} / {run.level} · {statusLabel(run.cacheStatus)} · {formatDateTime(run.completedAt)}
                  </p>
                </div>
                <MetricCompact label="Results" value={run.resultsCount} />
                <MetricCompact label="Sources" value={run.searchedSourcesCount} />
                <MetricCompact label="SAM calls" value={run.samCalls} />
                <div className="flex items-center gap-2 lg:justify-end">
                  {run.samRateLimited ? <AlertTriangle className="size-4 text-amber-500" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
                  <span className="text-sm text-slate-600">{run.elapsedMs ? `${Math.round(run.elapsedMs / 100) / 10}s` : "0s"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 py-3 text-sm text-slate-600">No search runs captured yet. Run a search, then refresh this page.</p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function MetricCompact({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-2 py-1">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${className}`}>{status}</span>;
}

function StatePanel({ title, message, loading = false }: { title: string; message: string; loading?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-white p-8 text-center shadow-panel">
      <RefreshCw className={`mx-auto mb-3 size-6 text-slate-500 ${loading ? "animate-spin" : ""}`} />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">{message}</p>
    </div>
  );
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
