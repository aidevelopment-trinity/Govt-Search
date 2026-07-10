"use client";

import { ArrowUpRight, Building2, CheckCircle2, Copy, FileText, RefreshCw, Save, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyProfile, DraftQuestionnaire, ProposalDraftRecord } from "@/lib/gov-types";
import type { TrackedOpportunityRecord } from "@/lib/supabase-admin";

type CompanyProfileResponse =
  | { ok: true; configured: true; data: CompanyProfile | null }
  | { ok: false; configured: boolean; error: string };

type DraftResponse =
  | {
      ok: true;
      configured: true;
      data: ProposalDraftRecord[];
      googleDocsConfigured: boolean;
      googleDoc: { id: string; url: string } | null;
      googleDocError: string | null;
    }
  | { ok: false; configured: boolean; error: string; googleDocsConfigured?: boolean; googleDocError?: string | null };

const emptyProfile: Partial<CompanyProfile> = {
  company_name: "",
  website: "",
  headquarters: "",
  service_summary: "",
  differentiators: "",
  certifications: "",
  past_performance: "",
  team_bios: "",
  standard_language: "",
};

const emptyQuestionnaire: DraftQuestionnaire = {
  bidDecision: "Reviewing",
  primaryService: "",
  projectLead: "",
  winThemes: "",
  pastPerformance: "",
  staffingNotes: "",
  pricingNotes: "",
  complianceNotes: "",
  missingInfo: "",
  tone: "Formal, clear, and practical",
};

export function CompanyProfilePanel() {
  const [profile, setProfile] = useState<Partial<CompanyProfile>>(emptyProfile);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error" | "not-configured">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/gov/company-profile");
      const data = (await response.json()) as CompanyProfileResponse;

      if (data.ok) {
        setProfile(data.data ?? emptyProfile);
        setStatus("ready");
      } else {
        setStatus(data.configured === false ? "not-configured" : "error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Company profile could not be loaded.");
    }
  }

  async function saveProfile() {
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/gov/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = (await response.json()) as CompanyProfileResponse;

      if (data.ok) {
        setProfile(data.data ?? emptyProfile);
        setStatus("saved");
      } else {
        setStatus(data.configured === false ? "not-configured" : "error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Company profile could not be saved.");
    }
  }

  function updateField(field: keyof CompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    if (status === "saved") {
      setStatus("ready");
    }
  }

  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-panel">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-signal" />
            <h2 className="text-base font-semibold">Company Memory</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Saved facts used to prefill every draft response.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            type="button"
            disabled={status === "loading" || status === "saving"}
            onClick={() => void loadProfile()}
          >
            <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            disabled={status === "loading" || status === "saving" || status === "not-configured"}
            onClick={() => void saveProfile()}
          >
            <Save className="size-4" />
            <span>{profileSaveLabel(status)}</span>
          </button>
        </div>
      </div>

      {status === "not-configured" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Supabase is not connected yet, so company memory cannot be saved.
        </p>
      ) : null}
      {status === "error" ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{message}</p> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <TextInput label="Company Name" value={profile.company_name ?? ""} onChange={(value) => updateField("company_name", value)} />
        <TextInput label="Website" value={profile.website ?? ""} onChange={(value) => updateField("website", value)} />
        <TextInput label="Headquarters" value={profile.headquarters ?? ""} onChange={(value) => updateField("headquarters", value)} />
        <TextInput label="Primary Services" value={profile.service_summary ?? ""} onChange={(value) => updateField("service_summary", value)} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <TextArea label="Differentiators" value={profile.differentiators ?? ""} onChange={(value) => updateField("differentiators", value)} />
        <TextArea label="Certifications / Compliance" value={profile.certifications ?? ""} onChange={(value) => updateField("certifications", value)} />
        <TextArea label="Past Performance" value={profile.past_performance ?? ""} onChange={(value) => updateField("past_performance", value)} />
        <TextArea label="Team Bios" value={profile.team_bios ?? ""} onChange={(value) => updateField("team_bios", value)} />
      </div>

      <div className="mt-3">
        <TextArea label="Standard Language" value={profile.standard_language ?? ""} onChange={(value) => updateField("standard_language", value)} />
      </div>
    </section>
  );
}

export function DraftResponseWorkflow({ proposal }: { proposal: TrackedOpportunityRecord }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<DraftQuestionnaire>(emptyQuestionnaire);
  const [status, setStatus] = useState<"idle" | "drafting" | "ready" | "error" | "not-configured">("idle");
  const [draft, setDraft] = useState<ProposalDraftRecord | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function createDraft() {
    setStatus("drafting");
    setMessage("");
    setCopied(false);

    try {
      const response = await fetch("/api/gov/proposal-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackedOpportunityId: proposal.id, questionnaire: answers }),
      });
      const data = (await response.json()) as DraftResponse;

      if (data.ok && data.data[0]) {
        setDraft(data.data[0]);
        setStatus("ready");
        if (!data.googleDoc) {
          setMessage(data.googleDocError || "Draft saved. Google Docs is not configured yet, so copy the draft into a Google Doc for review.");
        }
      } else {
        setStatus(data.configured === false ? "not-configured" : "error");
        setMessage("error" in data ? data.error : "Draft could not be created.");
      }
    } catch {
      setStatus("error");
      setMessage("Draft could not be created.");
    }
  }

  async function copyDraft() {
    if (!draft?.draft_markdown) {
      return;
    }

    await navigator.clipboard.writeText(draft.draft_markdown);
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Sparkles className="size-4" />
        <span>Draft Response</span>
      </button>

      {open ? (
        <section className="rounded-md border border-line bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Draft Response Wizard</h3>
              <p className="text-xs text-slate-500">Answer what you know. Unknowns will be marked for review.</p>
            </div>
            <button
              className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-slate-50"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close draft wizard"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="Bid Decision" value={answers.bidDecision ?? ""} onChange={(value) => setAnswers((current) => ({ ...current, bidDecision: value }))} />
            <TextInput
              label="Primary Service"
              value={answers.primaryService ?? ""}
              onChange={(value) => setAnswers((current) => ({ ...current, primaryService: value }))}
            />
            <TextInput label="Project Lead" value={answers.projectLead ?? ""} onChange={(value) => setAnswers((current) => ({ ...current, projectLead: value }))} />
            <TextInput label="Tone" value={answers.tone ?? ""} onChange={(value) => setAnswers((current) => ({ ...current, tone: value }))} />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TextArea label="Win Themes" value={answers.winThemes ?? ""} onChange={(value) => setAnswers((current) => ({ ...current, winThemes: value }))} />
            <TextArea
              label="Past Performance"
              value={answers.pastPerformance ?? ""}
              onChange={(value) => setAnswers((current) => ({ ...current, pastPerformance: value }))}
            />
            <TextArea
              label="Staffing Notes"
              value={answers.staffingNotes ?? ""}
              onChange={(value) => setAnswers((current) => ({ ...current, staffingNotes: value }))}
            />
            <TextArea
              label="Pricing Notes"
              value={answers.pricingNotes ?? ""}
              onChange={(value) => setAnswers((current) => ({ ...current, pricingNotes: value }))}
            />
            <TextArea
              label="Compliance Notes"
              value={answers.complianceNotes ?? ""}
              onChange={(value) => setAnswers((current) => ({ ...current, complianceNotes: value }))}
            />
            <TextArea
              label="Missing Information"
              value={answers.missingInfo ?? ""}
              onChange={(value) => setAnswers((current) => ({ ...current, missingInfo: value }))}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              type="button"
              disabled={status === "drafting"}
              onClick={() => void createDraft()}
            >
              <Sparkles className="size-4" />
              <span>{status === "drafting" ? "Drafting" : "Create Draft"}</span>
            </button>
            {draft?.google_doc_url ? (
              <a
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={draft.google_doc_url}
                rel="noreferrer"
                target="_blank"
              >
                <ArrowUpRight className="size-4" />
                <span>Open Google Doc</span>
              </a>
            ) : null}
            {draft?.draft_markdown ? (
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => void copyDraft()}
              >
                <Copy className="size-4" />
                <span>{copied ? "Copied" : "Copy Draft"}</span>
              </button>
            ) : null}
            {draft && !draft.google_doc_url ? (
              <a
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="https://docs.new"
                rel="noreferrer"
                target="_blank"
              >
                <FileText className="size-4" />
                <span>Open Docs</span>
              </a>
            ) : null}
          </div>

          {status === "ready" ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <CheckCircle2 className="mr-2 inline size-4" />
              Draft created and saved.
            </p>
          ) : null}
          {message ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="block text-xs font-medium text-slate-500" htmlFor={id}>
      {label}
      <input
        id={id}
        className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="block text-xs font-medium text-slate-500" htmlFor={id}>
      {label}
      <textarea
        id={id}
        className="mt-1 min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-signal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function profileSaveLabel(status: "loading" | "ready" | "saving" | "saved" | "error" | "not-configured") {
  if (status === "saving") return "Saving";
  if (status === "saved") return "Saved";
  if (status === "not-configured") return "Connect Supabase";
  return "Save Memory";
}
