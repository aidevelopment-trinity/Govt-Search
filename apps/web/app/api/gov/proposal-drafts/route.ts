import { NextResponse } from "next/server";
import { createGoogleDocDraft, isGoogleDocsConfigured } from "@/lib/google-docs";
import type { DraftQuestionnaire } from "@/lib/gov-types";
import { buildProposalDraft, companySnapshot } from "@/lib/proposal-drafting";
import {
  createProposalDraft,
  deleteProposalDraft,
  getCompanyProfile,
  getTrackedOpportunity,
  listApprovedResponseBlocks,
  listProposalDrafts,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackedOpportunityId = url.searchParams.get("trackedOpportunityId") ?? undefined;
  const result = await listProposalDrafts(trackedOpportunityId);
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { trackedOpportunityId?: string; questionnaire?: DraftQuestionnaire } | null;

  if (!body?.trackedOpportunityId) {
    return jsonNoStore({ ok: false, error: "Missing tracked opportunity ID." }, { status: 400 });
  }

  const opportunityResult = await getTrackedOpportunity(body.trackedOpportunityId);
  if (!opportunityResult.ok) {
    const status = opportunityResult.configured ? 502 : 503;
    return jsonNoStore(opportunityResult, { status });
  }

  const opportunity = opportunityResult.data[0];
  if (!opportunity) {
    return jsonNoStore({ ok: false, configured: true, error: "Tracked opportunity was not found." }, { status: 404 });
  }

  const companyResult = await getCompanyProfile();
  if (!companyResult.ok && companyResult.configured === false) {
    return jsonNoStore(companyResult, { status: 503 });
  }

  const profile = companyResult.ok ? companyResult.data[0] ?? null : null;
  const approvedBlocksResult = await listApprovedResponseBlocks();
  const approvedBlocks = approvedBlocksResult.ok ? approvedBlocksResult.data : [];
  const questionnaire = normalizeQuestionnaire(body.questionnaire);
  const draftMarkdown = buildProposalDraft({ opportunity, companyProfile: profile, approvedBlocks, questionnaire });
  const draftTitle = `${safeTitle(profile?.company_name || "Proposal")} - ${safeTitle(opportunity.title)}`;
  const googleResult = await createGoogleDocDraft({ title: draftTitle, content: draftMarkdown });
  const savedDraft = await createProposalDraft({
    trackedOpportunityId: opportunity.id,
    draftTitle,
    draftMarkdown,
    questionnaire,
    companySnapshot: companySnapshot(profile),
    googleDocId: googleResult.ok ? googleResult.docId : null,
    googleDocUrl: googleResult.ok ? googleResult.docUrl : null,
  });

  const status = savedDraft.ok ? 200 : savedDraft.configured ? 502 : 503;
  return jsonNoStore(
    {
      ...savedDraft,
      googleDocsConfigured: isGoogleDocsConfigured(),
      googleDoc: googleResult.ok ? { id: googleResult.docId, url: googleResult.docUrl } : null,
      googleDocError: googleResult.ok ? null : googleResult.error,
    },
    { status },
  );
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = url.searchParams.get("id") ?? (typeof body?.id === "string" ? body.id : "");

  if (!id) {
    return jsonNoStore({ ok: false, error: "Missing proposal draft ID." }, { status: 400 });
  }

  const result = await deleteProposalDraft(id);
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

function normalizeQuestionnaire(value: DraftQuestionnaire | undefined): DraftQuestionnaire {
  return {
    bidDecision: clean(value?.bidDecision),
    primaryService: clean(value?.primaryService),
    projectLead: clean(value?.projectLead),
    winThemes: clean(value?.winThemes),
    pastPerformance: clean(value?.pastPerformance),
    staffingNotes: clean(value?.staffingNotes),
    pricingNotes: clean(value?.pricingNotes),
    complianceNotes: clean(value?.complianceNotes),
    missingInfo: clean(value?.missingInfo),
    tone: clean(value?.tone),
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 5000) : "";
}

function safeTitle(value: string) {
  return value.replace(/\s+/g, " ").replace(/[\\/:*?"<>|#{}%~&]/g, "").trim().slice(0, 90) || "Draft";
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
