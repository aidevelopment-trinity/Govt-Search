"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  RefreshCw,
  Save,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CompanyProfilePanel, DraftResponseWorkflow } from "@/components/proposal-draft-workflow";
import type { TrackedOpportunityRecord } from "@/lib/supabase-admin";

type ApiResponse =
  | { ok: true; configured: true; data: TrackedOpportunityRecord[] }
  | { ok: false; configured: boolean; error: string };

const pursuitStatuses = ["tracked", "reviewing", "bid", "no_bid", "submitted", "won", "lost"];

export function SavedProposalsDashboard() {
  const [proposals, setProposals] = useState<TrackedOpportunityRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-configured">("loading");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadProposals();
  }, []);

  const filteredProposals = useMemo(() => {
    if (statusFilter === "all") {
      return proposals;
    }

    return proposals.filter((proposal) => proposal.pursuit_status === statusFilter);
  }, [proposals, statusFilter]);

  const statusCounts = useMemo(() => {
    return proposals.reduce((counts, proposal) => {
      counts.set(proposal.pursuit_status, (counts.get(proposal.pursuit_status) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
  }, [proposals]);

  async function loadProposals() {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/gov/tracked-opportunities");
      const data = (await response.json()) as ApiResponse;

      if (data.ok) {
        setProposals(data.data);
        setStatus("ready");
      } else {
        setStatus(data.configured === false ? "not-configured" : "error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Saved proposals could not be loaded.");
    }
  }

  function updateProposal(updated: TrackedOpportunityRecord) {
    setProposals((current) => current.map((proposal) => (proposal.id === updated.id ? updated : proposal)));
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
              <h1 className="mt-2 text-2xl font-semibold">Saved Proposals</h1>
              <p className="text-sm text-slate-500">Review the opportunities you want to pursue, update status, and keep working notes in one place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/drafts"
              >
                <FileText className="size-4" />
                <span>Drafts Library</span>
              </a>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/setup"
              >
                <Settings className="size-4" />
                <span>Setup</span>
              </a>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                type="button"
                disabled={status === "loading"}
                onClick={() => void loadProposals()}
              >
                <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterButton active={statusFilter === "all"} label={`All ${proposals.length}`} onClick={() => setStatusFilter("all")} />
            {pursuitStatuses.map((proposalStatus) => (
              <FilterButton
                key={proposalStatus}
                active={statusFilter === proposalStatus}
                label={`${statusLabel(proposalStatus)} ${statusCounts.get(proposalStatus) ?? 0}`}
                onClick={() => setStatusFilter(proposalStatus)}
              />
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
        <div className="mb-4">
          <CompanyProfilePanel />
        </div>

        {status === "not-configured" ? (
          <StatePanel
            icon="warning"
            title="Supabase is not connected yet"
            message="Add the Supabase environment variables in Vercel and run the SQL schema. After that, saved proposals will appear here."
          />
        ) : null}

        {status === "error" ? <StatePanel icon="warning" title="Could not load saved proposals" message={message || "Try refreshing the page."} /> : null}

        {status === "loading" ? <StatePanel icon="loading" title="Loading saved proposals" message="Checking Supabase for tracked opportunities." /> : null}

        {status === "ready" && filteredProposals.length === 0 ? (
          <StatePanel
            icon="ok"
            title={proposals.length === 0 ? "No saved proposals yet" : "No proposals in this status"}
            message={proposals.length === 0 ? "Run a search, then click Save Proposal on any result you want to pursue." : "Choose another status filter."}
          />
        ) : null}

        {status === "ready" && filteredProposals.length > 0 ? (
          <div className="grid gap-3">
            {filteredProposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} onUpdated={updateProposal} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ProposalCard({
  proposal,
  onUpdated,
}: {
  proposal: TrackedOpportunityRecord;
  onUpdated: (proposal: TrackedOpportunityRecord) => void;
}) {
  const [pursuitStatus, setPursuitStatus] = useState(proposal.pursuit_status);
  const [notes, setNotes] = useState(proposal.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveChanges() {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/gov/tracked-opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, pursuitStatus, notes }),
      });
      const data = (await response.json()) as
        | { ok: true; data: TrackedOpportunityRecord[] }
        | { ok: false; error: string };

      if (data.ok && data.data[0]) {
        onUpdated(data.data[0]);
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <article className="rounded-md border border-line bg-white p-4 shadow-panel">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-md border border-line bg-slate-50 px-2 py-1 font-medium text-signal">{proposal.source_name}</span>
            {proposal.source_state ? <span>{proposal.source_state}</span> : null}
            {proposal.solicitation_id ? <span>ID {proposal.solicitation_id}</span> : null}
            {proposal.fit_score !== null ? <span>Fit {proposal.fit_score}</span> : null}
          </div>
          <h2 className="text-base font-semibold leading-6">{proposal.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{proposal.summary || "No summary captured yet."}</p>

          <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
            <InfoPill icon={Building2} label={proposal.buyer || "Buyer not captured"} />
            <InfoPill icon={CalendarClock} label={proposal.deadline ? `Due ${proposal.deadline}` : "Due date not captured"} />
            <InfoPill icon={ClipboardList} label={proposal.opportunity_status || "Status not captured"} />
            <InfoPill icon={FileText} label={proposal.budget || "Budget not captured"} />
          </div>

          {proposal.next_action ? (
            <div className="mt-3 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Next action: </span>
              {proposal.next_action}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-500" htmlFor={`status-${proposal.id}`}>
            Pursuit Status
          </label>
          <select
            id={`status-${proposal.id}`}
            className="h-10 w-full rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-signal"
            value={pursuitStatus}
            onChange={(event) => {
              setPursuitStatus(event.target.value);
              setSaveStatus("idle");
            }}
          >
            {pursuitStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-slate-500" htmlFor={`notes-${proposal.id}`}>
            Notes
          </label>
          <textarea
            id={`notes-${proposal.id}`}
            className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-signal"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setSaveStatus("idle");
            }}
            placeholder="Capture fit, questions, required forms, review owner, or bid/no-bid reasoning."
          />

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              type="button"
              disabled={saveStatus === "saving"}
              onClick={() => void saveChanges()}
            >
              <Save className="size-4" />
              <span>{saveButtonLabel(saveStatus)}</span>
            </button>
            <a
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={proposal.opportunity_url}
              rel="noreferrer"
              target="_blank"
            >
              <ArrowUpRight className="size-4" />
              <span>Open</span>
            </a>
          </div>
        </div>
        <div className="xl:col-span-2">
          <DraftResponseWorkflow proposal={proposal} />
        </div>
      </div>
    </article>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-700 hover:border-signal hover:text-signal"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InfoPill({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-md border border-line bg-white px-2 py-1">
      <Icon className="size-4 shrink-0 text-slate-400" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function StatePanel({ icon, title, message }: { icon: "ok" | "warning" | "loading"; title: string; message: string }) {
  const Icon = icon === "warning" ? AlertTriangle : icon === "loading" ? RefreshCw : CheckCircle2;
  return (
    <div className="rounded-md border border-line bg-white p-8 text-center shadow-panel">
      <Icon className={`mx-auto mb-3 size-6 ${icon === "warning" ? "text-amber-500" : icon === "loading" ? "animate-spin text-slate-500" : "text-emerald-600"}`} />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">{message}</p>
    </div>
  );
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function saveButtonLabel(status: "idle" | "saving" | "saved" | "error") {
  if (status === "saving") return "Saving";
  if (status === "saved") return "Saved";
  if (status === "error") return "Save Failed";
  return "Save";
}
