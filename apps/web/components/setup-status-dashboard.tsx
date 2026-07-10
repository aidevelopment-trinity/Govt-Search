"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, FileText, RefreshCw, Search, Settings } from "lucide-react";
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
  };
  counts: {
    trackedOpportunities: number;
    proposalDrafts: number;
    approvedResponseBlocks: number;
    companyProfile: number;
  };
  checks: Array<{ name: string; ok: boolean; message: string }>;
  nextSteps: string[];
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
            <div className="grid gap-3 lg:grid-cols-2">
              <ServiceCard
                title="Supabase"
                ok={health.services.supabase.configured && health.services.supabase.reachable}
                status={health.services.supabase.status}
                message={health.services.supabase.message}
              />
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
              </div>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
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
