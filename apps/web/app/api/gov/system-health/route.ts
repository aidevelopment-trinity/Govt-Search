import { NextResponse } from "next/server";
import { isEmailConfigured } from "@/lib/email-notifications";
import { isGoogleDocsConfigured } from "@/lib/google-docs";
import { getSamUsageSummary, listRuntimeSearchRuns } from "@/lib/search-observability";
import {
  getCompanyProfile,
  isSupabaseConfigured,
  listEmailSubscribers,
  listKeywordSubscriptions,
  listMonitorFindings,
  listMonitorRuns,
  listMonitorSearches,
  listNotificationDeliveries,
  listSearchRuns,
  listSourceHealth,
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
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);
  const emailProviderConfigured = isEmailConfigured();

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
      monitoring: {
        configured: false,
        schemaReady: false,
        cronSecretConfigured,
        status: "checking",
        message: "Checking monitoring schema and scheduled run configuration.",
      },
      emailNotifications: {
        configured: false,
        providerConfigured: emailProviderConfigured,
        schemaReady: false,
        status: emailProviderConfigured ? "checking" : "missing_env",
        message: emailProviderConfigured ? "Checking email notification schema." : "Add RESEND_API_KEY in Vercel to send email alerts.",
      },
      searchObservability: {
        configured: false,
        schemaReady: false,
        status: supabaseConfigured ? "checking" : "missing_env",
        message: supabaseConfigured ? "Checking search run logs and source health." : "Add Supabase environment variables to store search logs.",
      },
    },
    counts: {
      trackedOpportunities: 0,
      proposalDrafts: 0,
      approvedResponseBlocks: 0,
      companyProfile: 0,
      emailSubscribers: 0,
      keywordSubscriptions: 0,
      notificationDeliveries: 0,
      sourceHealthOk: 0,
      sourceHealthPending: 0,
      sourceHealthError: 0,
      searchRuns: 0,
    },
    checks: [] as Array<{ name: string; ok: boolean; message: string }>,
    sourceHealth: {
      recent: [] as Array<{
        sourceName: string;
        sourceState: string | null;
        sourceLevel: string | null;
        status: string;
        message: string | null;
        checkedAt: string;
      }>,
      issues: [] as Array<{
        sourceName: string;
        sourceState: string | null;
        sourceLevel: string | null;
        status: string;
        message: string | null;
        checkedAt: string;
      }>,
    },
    searchRuns: {
      recent: [] as Array<{
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
      }>,
      runtimeRecent: listRuntimeSearchRuns(10).map((run) => ({
        id: run.id,
        query: run.query,
        state: run.state,
        level: run.level,
        cacheStatus: run.cacheStatus,
        resultsCount: run.resultsCount,
        searchedSourcesCount: run.searchedSourcesCount,
        pendingSourcesCount: run.pendingSourcesCount,
        errorCount: run.errorCount,
        elapsedMs: run.elapsedMs,
        samCalls: run.samCalls,
        samRateLimited: run.samRateLimited,
        completedAt: run.completedAt,
      })),
    },
    samUsage: getSamUsageSummary(),
    nextSteps: [] as string[],
  };

  if (supabaseConfigured) {
    const [
      tracked,
      drafts,
      blocks,
      companyProfile,
      monitorSearches,
      monitorRuns,
      monitorFindings,
      emailSubscribers,
      keywordSubscriptions,
      notificationDeliveries,
      sourceHealth,
      searchRuns,
    ] = await Promise.all([
      listTrackedOpportunities(),
      listProposalDrafts(),
      listApprovedResponseBlocks(),
      getCompanyProfile(),
      listMonitorSearches(),
      listMonitorRuns(),
      listMonitorFindings(1),
      listEmailSubscribers(),
      listKeywordSubscriptions(),
      listNotificationDeliveries(1),
      listSourceHealth(100),
      listSearchRuns(30),
    ]);

    health.checks.push(checkResult("Tracked opportunities", tracked));
    health.checks.push(checkResult("Proposal drafts", drafts));
    health.checks.push(checkResult("Approved response blocks", blocks));
    health.checks.push(checkResult("Company profile", companyProfile));
    health.checks.push(checkResult("Monitor searches", monitorSearches));
    health.checks.push(checkResult("Monitor runs", monitorRuns));
    health.checks.push(checkResult("Monitor findings", monitorFindings));
    health.checks.push(checkResult("Email subscribers", emailSubscribers));
    health.checks.push(checkResult("Keyword subscriptions", keywordSubscriptions));
    health.checks.push(checkResult("Notification deliveries", notificationDeliveries));
    health.checks.push(checkResult("Source health", sourceHealth));
    health.checks.push(checkResult("Search run logs", searchRuns));

    const supabaseOk = [tracked, drafts, blocks, companyProfile].every((result) => result.ok);
    const monitorSchemaOk = [monitorSearches, monitorRuns, monitorFindings].every((result) => result.ok);
    const emailSchemaOk = [emailSubscribers, keywordSubscriptions, notificationDeliveries].every((result) => result.ok);
    const searchObservabilityOk = [sourceHealth, searchRuns].every((result) => result.ok);
    health.services.supabase.reachable = supabaseOk;
    health.services.supabase.status = supabaseOk ? "ready" : "error";
    health.services.supabase.message = supabaseOk
      ? "Supabase is connected and core tables are readable."
      : "Supabase is configured, but one or more tables could not be read.";
    health.services.monitoring.configured = monitorSchemaOk && cronSecretConfigured;
    health.services.monitoring.schemaReady = monitorSchemaOk;
    health.services.monitoring.status = monitorSchemaOk ? (cronSecretConfigured ? "ready" : "missing_cron_secret") : "missing_schema";
    health.services.monitoring.message = monitorSchemaOk
      ? cronSecretConfigured
        ? "Monitoring schema and cron secret are ready."
        : "Monitoring schema is ready. Add CRON_SECRET in Vercel so scheduled runs can execute."
      : "Run the monitoring SQL migration in Supabase.";
    health.services.emailNotifications.configured = emailSchemaOk && emailProviderConfigured;
    health.services.emailNotifications.schemaReady = emailSchemaOk;
    health.services.emailNotifications.status = emailSchemaOk ? (emailProviderConfigured ? "ready" : "missing_env") : "missing_schema";
    health.services.emailNotifications.message = emailSchemaOk
      ? emailProviderConfigured
        ? "Email notification schema and provider key are ready."
        : "Email notification schema is ready. Add RESEND_API_KEY in Vercel."
      : "Run the email notification SQL migration in Supabase.";
    health.services.searchObservability.configured = searchObservabilityOk;
    health.services.searchObservability.schemaReady = searchObservabilityOk;
    health.services.searchObservability.status = searchObservabilityOk ? "ready" : "missing_schema";
    health.services.searchObservability.message = searchObservabilityOk
      ? "Source health and search run logging are readable."
      : "Run the search observability SQL migration in Supabase.";

    health.counts.trackedOpportunities = tracked.ok ? tracked.data.length : 0;
    health.counts.proposalDrafts = drafts.ok ? drafts.data.length : 0;
    health.counts.approvedResponseBlocks = blocks.ok ? blocks.data.length : 0;
    health.counts.companyProfile = companyProfile.ok && companyProfile.data.length > 0 ? 1 : 0;
    health.counts.emailSubscribers = emailSubscribers.ok ? emailSubscribers.data.length : 0;
    health.counts.keywordSubscriptions = keywordSubscriptions.ok ? keywordSubscriptions.data.length : 0;
    health.counts.notificationDeliveries = notificationDeliveries.ok ? notificationDeliveries.data.length : 0;
    if (sourceHealth.ok) {
      health.counts.sourceHealthOk = sourceHealth.data.filter((source) => source.health_status === "ok").length;
      health.counts.sourceHealthPending = sourceHealth.data.filter((source) => source.health_status === "pending").length;
      health.counts.sourceHealthError = sourceHealth.data.filter((source) => source.health_status === "error").length;
      health.sourceHealth.recent = sourceHealth.data.slice(0, 12).map(sourceHealthView);
      health.sourceHealth.issues = sourceHealth.data
        .filter((source) => source.health_status !== "ok")
        .slice(0, 12)
        .map(sourceHealthView);
    }
    if (searchRuns.ok) {
      health.counts.searchRuns = searchRuns.data.length;
      health.searchRuns.recent = searchRuns.data.slice(0, 12).map((run) => ({
        id: run.id,
        query: run.query,
        state: run.state_filter,
        level: run.level_filter,
        cacheStatus: run.cache_status,
        resultsCount: run.results_count,
        searchedSourcesCount: run.searched_sources_count,
        pendingSourcesCount: run.pending_sources_count,
        errorCount: run.error_count,
        elapsedMs: run.elapsed_ms,
        samCalls: run.sam_calls_count,
        samRateLimited: run.sam_rate_limited,
        completedAt: run.completed_at,
      }));
    }
  }

  if (!health.services.supabase.configured) {
    health.nextSteps.push("Add Supabase environment variables in Vercel and run the SQL schema.");
  } else if (!health.services.supabase.reachable) {
    health.nextSteps.push("Review the Supabase table errors and rerun the schema if a table is missing.");
  }

  if (!health.services.monitoring.schemaReady) {
    health.nextSteps.push("Run docs/supabase-monitoring-migration.sql in Supabase SQL Editor.");
  }

  if (!health.services.monitoring.cronSecretConfigured) {
    health.nextSteps.push("Add CRON_SECRET in Vercel production environment variables.");
  }

  if (!health.services.emailNotifications.schemaReady) {
    health.nextSteps.push("Run docs/supabase-email-notifications-migration.sql in Supabase SQL Editor.");
  }

  if (!health.services.searchObservability.schemaReady) {
    health.nextSteps.push("Run docs/supabase-search-observability-migration.sql in Supabase SQL Editor.");
  }

  if (!health.services.emailNotifications.providerConfigured) {
    health.nextSteps.push("Create a Resend API key and add RESEND_API_KEY plus EMAIL_FROM in Vercel.");
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

function sourceHealthView(source: {
  source_name: string;
  source_state: string | null;
  source_level: string | null;
  health_status: string;
  message: string | null;
  checked_at: string;
}) {
  return {
    sourceName: source.source_name,
    sourceState: source.source_state,
    sourceLevel: source.source_level,
    status: source.health_status,
    message: source.message,
    checkedAt: source.checked_at,
  };
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
