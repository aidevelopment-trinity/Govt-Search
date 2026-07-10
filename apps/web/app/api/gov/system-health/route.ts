import { NextResponse } from "next/server";
import { isGoogleDocsConfigured } from "@/lib/google-docs";
import {
  getCompanyProfile,
  isSupabaseConfigured,
  listApprovedResponseBlocks,
  listProposalDrafts,
  listTrackedOpportunities,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  const googleDocsConfigured = isGoogleDocsConfigured();
  const googleDriveFolderConfigured = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID);
  const googleReviewerConfigured = Boolean(process.env.GOOGLE_DOC_REVIEWER_EMAIL);

  const health = {
    ok: true,
    completedAt: new Date().toISOString(),
    services: {
      supabase: {
        configured: supabaseConfigured,
        reachable: false,
        status: supabaseConfigured ? "checking" : "missing_env",
        message: supabaseConfigured ? "Supabase environment variables are present." : "Add Supabase URL and service role key in Vercel.",
      },
      googleDocs: {
        configured: googleDocsConfigured,
        driveFolderConfigured: googleDriveFolderConfigured,
        reviewerConfigured: googleReviewerConfigured,
        status: googleDocsConfigured ? "ready_for_test" : "missing_env",
        message: googleDocsConfigured
          ? "Google service account credentials are present. Create a proposal draft to test Google Doc creation."
          : "Add Google service account email and private key in Vercel to create Google Docs.",
      },
    },
    counts: {
      trackedOpportunities: 0,
      proposalDrafts: 0,
      approvedResponseBlocks: 0,
      companyProfile: 0,
    },
    checks: [] as Array<{ name: string; ok: boolean; message: string }>,
    nextSteps: [] as string[],
  };

  if (supabaseConfigured) {
    const [tracked, drafts, blocks, companyProfile] = await Promise.all([
      listTrackedOpportunities(),
      listProposalDrafts(),
      listApprovedResponseBlocks(),
      getCompanyProfile(),
    ]);

    health.checks.push(checkResult("Tracked opportunities", tracked));
    health.checks.push(checkResult("Proposal drafts", drafts));
    health.checks.push(checkResult("Approved response blocks", blocks));
    health.checks.push(checkResult("Company profile", companyProfile));

    const supabaseOk = [tracked, drafts, blocks, companyProfile].every((result) => result.ok);
    health.services.supabase.reachable = supabaseOk;
    health.services.supabase.status = supabaseOk ? "ready" : "error";
    health.services.supabase.message = supabaseOk
      ? "Supabase is connected and core tables are readable."
      : "Supabase is configured, but one or more tables could not be read.";

    health.counts.trackedOpportunities = tracked.ok ? tracked.data.length : 0;
    health.counts.proposalDrafts = drafts.ok ? drafts.data.length : 0;
    health.counts.approvedResponseBlocks = blocks.ok ? blocks.data.length : 0;
    health.counts.companyProfile = companyProfile.ok && companyProfile.data.length > 0 ? 1 : 0;
  }

  if (!health.services.supabase.configured) {
    health.nextSteps.push("Add Supabase environment variables in Vercel and run the SQL schema.");
  } else if (!health.services.supabase.reachable) {
    health.nextSteps.push("Review the Supabase table errors and rerun the schema if a table is missing.");
  }

  if (!health.counts.companyProfile) {
    health.nextSteps.push("Fill out company memory on the Saved Proposals page.");
  }

  if (!health.services.googleDocs.configured) {
    health.nextSteps.push("Create the Google Cloud service account, enable Drive/Docs APIs, and add Google env vars in Vercel.");
  } else if (!health.services.googleDocs.driveFolderConfigured) {
    health.nextSteps.push("Add GOOGLE_DRIVE_FOLDER_ID so generated docs land in the right shared folder.");
  }

  if (!health.counts.approvedResponseBlocks) {
    health.nextSteps.push("Approve reusable language from reviewed drafts to improve future responses.");
  }

  return jsonNoStore(health);
}

function checkResult<T>(name: string, result: { ok: true; data: T } | { ok: false; error: string }) {
  return {
    name,
    ok: result.ok,
    message: result.ok ? "Readable" : result.error.slice(0, 220),
  };
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
