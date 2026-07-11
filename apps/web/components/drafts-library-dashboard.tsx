"use client";

import { ArrowUpRight, Bell, CheckCircle2, ClipboardCheck, Copy, FileText, RefreshCw, Save, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ApprovedResponseBlockRecord, ProposalDraftRecord } from "@/lib/gov-types";

type DraftsResponse =
  | { ok: true; configured: true; data: ProposalDraftRecord[] }
  | { ok: false; configured: boolean; error: string };

type BlocksResponse =
  | { ok: true; configured: true; data: ApprovedResponseBlockRecord[] }
  | { ok: false; configured: boolean; error: string };

const categories = ["executive_summary", "technical_approach", "past_performance", "staffing", "compliance", "pricing", "general"];

export function DraftsLibraryDashboard() {
  const [drafts, setDrafts] = useState<ProposalDraftRecord[]>([]);
  const [blocks, setBlocks] = useState<ApprovedResponseBlockRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-configured">("loading");
  const [message, setMessage] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "error">("idle");

  useEffect(() => {
    void loadData();
  }, []);

  const selectedDraft = useMemo(() => drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null, [drafts, selectedDraftId]);

  async function loadData() {
    setStatus("loading");
    setMessage("");
    try {
      const [draftsResponse, blocksResponse] = await Promise.all([fetch("/api/gov/proposal-drafts"), fetch("/api/gov/approved-response-blocks")]);
      const draftsData = (await draftsResponse.json()) as DraftsResponse;
      const blocksData = (await blocksResponse.json()) as BlocksResponse;

      if (draftsData.ok) {
        setDrafts(draftsData.data);
        setSelectedDraftId((current) => current ?? draftsData.data[0]?.id ?? null);
        setBlocks(blocksData.ok ? blocksData.data : []);
        setStatus("ready");
      } else {
        setStatus(draftsData.configured === false ? "not-configured" : "error");
        setMessage(draftsData.error);
      }
    } catch {
      setStatus("error");
      setMessage("Draft library could not be loaded.");
    }
  }

  async function copyDraft(draft: ProposalDraftRecord) {
    await navigator.clipboard.writeText(draft.draft_markdown);
    setCopiedDraftId(draft.id);
  }

  function addBlock(block: ApprovedResponseBlockRecord) {
    setBlocks((current) => [block, ...current]);
  }

  async function deleteDraft(draft: ProposalDraftRecord) {
    if (deleteConfirmId !== draft.id) {
      setDeleteConfirmId(draft.id);
      setDeleteStatus("idle");
      return;
    }

    setDeletingDraftId(draft.id);
    setDeleteStatus("idle");
    try {
      const response = await fetch("/api/gov/proposal-drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id }),
      });
      const data = (await response.json()) as { ok: boolean };

      if (data.ok) {
        const nextDrafts = drafts.filter((item) => item.id !== draft.id);
        setDrafts(nextDrafts);
        setSelectedDraftId((currentSelected) => (currentSelected === draft.id ? nextDrafts[0]?.id ?? null : currentSelected));
        setDeleteConfirmId(null);
      } else {
        setDeleteStatus("error");
      }
    } catch {
      setDeleteStatus("error");
    } finally {
      setDeletingDraftId(null);
    }
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <a className="text-sm font-medium text-signal hover:underline" href="/proposals">
                Back to proposals
              </a>
              <h1 className="mt-2 text-2xl font-semibold">Drafts Library</h1>
              <p className="text-sm text-slate-500">Review generated drafts and save approved language for future responses.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/"
              >
                Search
              </a>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/monitor"
              >
                <Bell className="size-4" />
                <span>Monitor</span>
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
                onClick={() => void loadData()}
              >
                <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Drafts</h2>
              <span className="rounded-md border border-line bg-slate-50 px-2 py-1 text-xs text-slate-600">{drafts.length}</span>
            </div>
            {status === "not-configured" ? <StateMessage title="Supabase schema needed" message="Run the updated Supabase schema to enable drafts." /> : null}
            {status === "error" ? <StateMessage title="Could not load drafts" message={message} /> : null}
            {status === "loading" ? <StateMessage title="Loading drafts" message="Checking saved draft responses." /> : null}
            {status === "ready" && drafts.length === 0 ? <StateMessage title="No drafts yet" message="Create a draft from a saved proposal first." /> : null}
            <div className="space-y-2">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  className={`block w-full rounded-md border px-3 py-2 text-left hover:border-signal ${
                    selectedDraft?.id === draft.id ? "border-signal bg-teal-50" : "border-line bg-slate-50"
                  }`}
                  type="button"
                  onClick={() => setSelectedDraftId(draft.id)}
                >
                  <p className="line-clamp-2 text-sm font-medium">{draft.draft_title}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(draft.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Approved Library</h2>
              <span className="rounded-md border border-line bg-slate-50 px-2 py-1 text-xs text-slate-600">{blocks.length}</span>
            </div>
            {blocks.length > 0 ? (
              <div className="space-y-2">
                {blocks.slice(0, 8).map((block) => (
                  <div key={block.id} className="rounded-md border border-line bg-slate-50 px-3 py-2">
                    <p className="line-clamp-1 text-sm font-medium">{block.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{block.category}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Save reviewed text from drafts to start building reusable language.
              </p>
            )}
          </section>
        </aside>

        <section className="min-w-0 rounded-md border border-line bg-white p-4 shadow-panel">
          {selectedDraft ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-md border border-line bg-slate-50 px-2 py-1">{selectedDraft.draft_status}</span>
                    <span>{new Date(selectedDraft.created_at).toLocaleString()}</span>
                  </div>
                  <h2 className="text-lg font-semibold">{selectedDraft.draft_title}</h2>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {selectedDraft.google_doc_url ? (
                    <a
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-slate-800"
                      href={selectedDraft.google_doc_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ArrowUpRight className="size-4" />
                      <span>Open Google Doc</span>
                    </a>
                  ) : null}
                  <button
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    type="button"
                    onClick={() => void copyDraft(selectedDraft)}
                  >
                    <Copy className="size-4" />
                    <span>{copiedDraftId === selectedDraft.id ? "Copied" : "Copy Draft"}</span>
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
                    type="button"
                    disabled={deletingDraftId === selectedDraft.id}
                    onClick={() => void deleteDraft(selectedDraft)}
                  >
                    <Trash2 className="size-4" />
                    <span>{deleteDraftButtonLabel({ confirming: deleteConfirmId === selectedDraft.id, deleting: deletingDraftId === selectedDraft.id })}</span>
                  </button>
                </div>
              </div>
              {deleteConfirmId === selectedDraft.id ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  Click Confirm Delete to permanently remove this saved draft record.
                </p>
              ) : null}
              {deleteStatus === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Could not delete this draft. Try again.</p>
              ) : null}

              <ApprovedBlockForm draft={selectedDraft} onCreated={addBlock} />

              <div className="rounded-md border border-line bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-signal" />
                  <span>Draft Text</span>
                </div>
                <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-sm leading-6 text-slate-800">
                  {selectedDraft.draft_markdown}
                </pre>
              </div>
            </div>
          ) : (
            <StateMessage title="No draft selected" message="Choose a draft from the left column." />
          )}
        </section>
      </section>
    </main>
  );
}

function ApprovedBlockForm({ draft, onCreated }: { draft: ProposalDraftRecord; onCreated: (block: ApprovedResponseBlockRecord) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setTitle("");
    setCategory("general");
    setTags("");
    setContent("");
    setStatus("idle");
  }, [draft.id]);

  async function saveBlock() {
    if (!title.trim() || !content.trim()) {
      setStatus("error");
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch("/api/gov/approved-response-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          tags,
          content,
          sourceDraftId: draft.id,
          sourceOpportunityId: draft.tracked_opportunity_id,
        }),
      });
      const data = (await response.json()) as
        | { ok: true; data: ApprovedResponseBlockRecord[] }
        | { ok: false; error: string };

      if (data.ok && data.data[0]) {
        onCreated(data.data[0]);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="rounded-md border border-line bg-slate-50 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ClipboardCheck className="size-4 text-emerald-600" />
        <span>Save Approved Language</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block text-xs font-medium text-slate-500">
          Title
          <input
            className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setStatus("idle");
            }}
            placeholder="Executive summary opening"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Category
          <select
            className="mt-1 h-10 w-full rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-signal"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setStatus("idle");
            }}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {labelize(item)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-slate-500">
        Tags
        <input
          className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal"
          value={tags}
          onChange={(event) => {
            setTags(event.target.value);
            setStatus("idle");
          }}
          placeholder="leadership, training, public sector"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-500">
        Approved Text
        <textarea
          className="mt-1 min-h-32 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-signal"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setStatus("idle");
          }}
          placeholder="Paste only language that a human reviewed and approved."
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          type="button"
          disabled={status === "saving"}
          onClick={() => void saveBlock()}
        >
          <Save className="size-4" />
          <span>{status === "saving" ? "Saving" : "Save Approved Block"}</span>
        </button>
        {status === "saved" ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" />
            Saved to response library
          </span>
        ) : null}
        {status === "error" ? <span className="text-sm text-rose-700">Add a title and approved text.</span> : null}
      </div>
    </section>
  );
}

function StateMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-3 py-4 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deleteDraftButtonLabel({ confirming, deleting }: { confirming: boolean; deleting: boolean }) {
  if (deleting) return "Deleting";
  if (confirming) return "Confirm Delete";
  return "Delete Draft";
}
