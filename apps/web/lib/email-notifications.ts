import { createHash } from "node:crypto";
import {
  createNotificationDelivery,
  listEmailSubscribers,
  listKeywordSubscriptions,
  listMonitorFindingsForSearchSince,
  listMonitorSearches,
  updateKeywordSubscription,
  updateNotificationDelivery,
  type EmailSubscriberRecord,
  type KeywordSubscriptionRecord,
  type MonitorFindingRecord,
  type SavedSearchRecord,
} from "@/lib/supabase-admin";

type EmailSendResult = {
  ok: boolean;
  configured: boolean;
  resendEmailId?: string | null;
  error?: string;
};

export type EmailNotificationRunSummary = {
  ok: boolean;
  configured: boolean;
  checkedSubscriptions: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  message: string;
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function runDueEmailNotifications({
  limitSubscriptions = 25,
  force = false,
}: {
  limitSubscriptions?: number;
  force?: boolean;
} = {}): Promise<EmailNotificationRunSummary> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      configured: false,
      checkedSubscriptions: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: ["RESEND_API_KEY is not configured."],
      message: "Email notifications are not configured.",
    };
  }

  const [subscriberResult, subscriptionResult, searchResult] = await Promise.all([
    listEmailSubscribers(),
    listKeywordSubscriptions(),
    listMonitorSearches(),
  ]);

  if (!subscriberResult.ok || !subscriptionResult.ok || !searchResult.ok) {
    return {
      ok: false,
      configured: subscriberResult.configured && subscriptionResult.configured && searchResult.configured,
      checkedSubscriptions: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [subscriberResult.ok ? undefined : subscriberResult.error, subscriptionResult.ok ? undefined : subscriptionResult.error, searchResult.ok ? undefined : searchResult.error].filter(
        Boolean,
      ) as string[],
      message: "Email notification data could not be loaded.",
    };
  }

  const subscribersById = new Map(subscriberResult.data.map((subscriber) => [subscriber.id, subscriber]));
  const searchesById = new Map(searchResult.data.map((search) => [search.id, search]));
  const subscriptions = subscriptionResult.data
    .filter((subscription) => subscription.is_active)
    .filter((subscription) => {
      const subscriber = subscribersById.get(subscription.subscriber_id);
      const search = searchesById.get(subscription.saved_search_id);
      return Boolean(subscriber?.is_active && search?.monitor_enabled);
    })
    .filter((subscription) => force || isSubscriptionDue(subscription))
    .slice(0, Math.max(1, Math.min(limitSubscriptions, 50)));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    const subscriber = subscribersById.get(subscription.subscriber_id);
    const search = searchesById.get(subscription.saved_search_id);

    if (!subscriber || !search) {
      skipped += 1;
      continue;
    }

    const since = subscription.last_notified_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const findingsResult = await listMonitorFindingsForSearchSince(search.id, since, 50);
    if (!findingsResult.ok) {
      failed += 1;
      errors.push(findingsResult.error);
      continue;
    }

    const findings = findingsResult.data;
    if (findings.length === 0) {
      skipped += 1;
      continue;
    }

    const subject = digestSubject(search, findings);
    const deliveryResult = await createNotificationDelivery({
      subscriberId: subscriber.id,
      savedSearchId: search.id,
      monitorRunId: findings[findings.length - 1]?.run_id ?? null,
      deliveryType: subscription.frequency,
      subject,
      findingIds: findings.map((finding) => finding.id),
    });

    if (!deliveryResult.ok || !deliveryResult.data[0]) {
      failed += 1;
      errors.push(deliveryResult.ok ? "Notification delivery could not be created." : deliveryResult.error);
      continue;
    }

    const delivery = deliveryResult.data[0];
    const sendResult = await sendOpportunityDigest({ subscriber, search, subscription, findings, subject });

    if (sendResult.ok) {
      sent += 1;
      await updateNotificationDelivery({ id: delivery.id, status: "sent", resendEmailId: sendResult.resendEmailId ?? null });
      await updateKeywordSubscription({ id: subscription.id, lastNotifiedAt: findings[findings.length - 1]?.created_at ?? new Date().toISOString() });
    } else {
      failed += 1;
      const error = sendResult.error ?? "Email could not be sent.";
      errors.push(error);
      await updateNotificationDelivery({ id: delivery.id, status: "failed", errorMessage: error });
    }
  }

  return {
    ok: failed === 0,
    configured: true,
    checkedSubscriptions: subscriptions.length,
    sent,
    skipped,
    failed,
    errors,
    message: `Email notifications checked ${subscriptions.length} subscriptions, sent ${sent}, skipped ${skipped}, failed ${failed}.`,
  };
}

export async function sendTestEmailToSubscriber(subscriberId: string): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { ok: false, configured: false, error: "RESEND_API_KEY is not configured." };
  }

  const subscribers = await listEmailSubscribers();
  if (!subscribers.ok) {
    return { ok: false, configured: subscribers.configured, error: subscribers.error };
  }

  const subscriber = subscribers.data.find((item) => item.id === subscriberId);
  if (!subscriber) {
    return { ok: false, configured: true, error: "Subscriber was not found." };
  }

  const subject = "Gov Contract Finder email test";
  const deliveryResult = await createNotificationDelivery({
    subscriberId: subscriber.id,
    deliveryType: "test",
    subject,
  });

  if (!deliveryResult.ok || !deliveryResult.data[0]) {
    return { ok: false, configured: deliveryResult.configured, error: deliveryResult.ok ? "Test delivery could not be created." : deliveryResult.error };
  }

  const html = baseEmailShell({
    title: "Email alerts are connected",
    preview: "This confirms Gov Contract Finder can send updates to this address.",
    bodyHtml: `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.5">This is a test email from Gov Contract Finder. Future messages will include new monitored opportunities for the keywords assigned to this recipient.</p>`,
    unsubscribeUrl: unsubscribeUrl(subscriber),
  });
  const result = await sendRawEmail({
    to: subscriber.email,
    subject,
    html,
    text: "Gov Contract Finder email alerts are connected.",
    idempotencyKey: `test-${subscriber.id}-${Date.now()}`,
  });

  if (result.ok) {
    await updateNotificationDelivery({ id: deliveryResult.data[0].id, status: "sent", resendEmailId: result.resendEmailId ?? null });
  } else {
    await updateNotificationDelivery({ id: deliveryResult.data[0].id, status: "failed", errorMessage: result.error ?? "Test email could not be sent." });
  }

  return result;
}

async function sendOpportunityDigest({
  subscriber,
  search,
  subscription,
  findings,
  subject,
}: {
  subscriber: EmailSubscriberRecord;
  search: SavedSearchRecord;
  subscription: KeywordSubscriptionRecord;
  findings: MonitorFindingRecord[];
  subject: string;
}): Promise<EmailSendResult> {
  const bodyHtml = `
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.5">
      ${escapeHtml(findings.length.toString())} monitored ${findings.length === 1 ? "opportunity" : "opportunities"} matched <strong>${escapeHtml(search.query)}</strong>.
    </p>
    ${findings
      .slice(0, 20)
      .map(
        (finding) => `
          <div style="border:1px solid #d7e2ef;border-radius:8px;padding:14px;margin:0 0 12px;background:#f8fafc">
            <div style="margin:0 0 6px;font-size:12px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(finding.finding_type)}</div>
            <h2 style="margin:0 0 8px;font-size:17px;line-height:1.35;color:#0f172a">${escapeHtml(finding.title)}</h2>
            <p style="margin:0 0 10px;color:#64748b;font-size:14px;line-height:1.45">
              ${escapeHtml([finding.source_name, finding.buyer, finding.new_deadline ? `Due ${finding.new_deadline}` : null].filter(Boolean).join(" · "))}
            </p>
            <a href="${escapeAttribute(finding.opportunity_url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;padding:8px 11px;font-size:14px;font-weight:700">Open opportunity</a>
          </div>
        `,
      )
      .join("")}
    <p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.5">
      Frequency: ${escapeHtml(subscription.frequency)}.
    </p>
  `;

  const html = baseEmailShell({
    title: "New contract opportunities",
    preview: subject,
    bodyHtml,
    unsubscribeUrl: unsubscribeUrl(subscriber),
  });

  return sendRawEmail({
    to: subscriber.email,
    subject,
    html,
    text: findings.map((finding) => `${finding.title}\n${finding.opportunity_url}`).join("\n\n"),
    idempotencyKey: digestIdempotencyKey(subscriber.id, search.id, findings),
  });
}

async function sendRawEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, configured: false, error: "RESEND_API_KEY is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Gov Contract Finder <onboarding@resend.dev>",
      to: [to],
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      subject,
      html,
      text,
    }),
  });

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string; error?: string } | null;
  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      error: payload?.message || payload?.error || `Resend ${response.status}: ${response.statusText}`,
    };
  }

  return { ok: true, configured: true, resendEmailId: payload?.id ?? null };
}

function isSubscriptionDue(subscription: KeywordSubscriptionRecord) {
  if (!subscription.is_active) {
    return false;
  }

  if (!subscription.last_notified_at) {
    return true;
  }

  const lastNotifiedMs = Date.parse(subscription.last_notified_at);
  if (!Number.isFinite(lastNotifiedMs)) {
    return true;
  }

  const elapsedMs = Date.now() - lastNotifiedMs;
  if (subscription.frequency === "weekly") {
    return elapsedMs >= 6 * 24 * 60 * 60 * 1000;
  }

  if (subscription.frequency === "daily") {
    return elapsedMs >= 20 * 60 * 60 * 1000;
  }

  return elapsedMs >= 15 * 60 * 1000;
}

function digestSubject(search: SavedSearchRecord, findings: MonitorFindingRecord[]) {
  const changed = findings.filter((finding) => finding.finding_type === "changed").length;
  const fresh = findings.length - changed;
  const parts = [`${findings.length} ${findings.length === 1 ? "opportunity" : "opportunities"}`];
  if (fresh > 0) {
    parts.push(`${fresh} new`);
  }
  if (changed > 0) {
    parts.push(`${changed} changed`);
  }
  return `${parts.join(" · ")} for "${search.query}"`;
}

function digestIdempotencyKey(subscriberId: string, searchId: string, findings: MonitorFindingRecord[]) {
  const hash = createHash("sha256")
    .update([subscriberId, searchId, ...findings.map((finding) => finding.id)].join(":"))
    .digest("hex");
  return `gov-search-${hash}`;
}

function baseEmailShell({ title, preview, bodyHtml, unsubscribeUrl }: { title: string; preview: string; bodyHtml: string; unsubscribeUrl: string }) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
        <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preview)}</span>
        <div style="padding:24px">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d7e2ef;border-radius:10px;overflow:hidden">
            <div style="padding:20px 22px;border-bottom:1px solid #e2e8f0">
              <div style="font-size:13px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:.04em">Gov Contract Finder</div>
              <h1 style="margin:7px 0 0;color:#0f172a;font-size:24px;line-height:1.25">${escapeHtml(title)}</h1>
            </div>
            <div style="padding:22px">
              ${bodyHtml}
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5">
                <a href="${escapeAttribute(appUrl("/monitor"))}" style="color:#0f766e;text-decoration:none;font-weight:700">Open monitor dashboard</a>
                <span style="color:#94a3b8"> · </span>
                <a href="${escapeAttribute(unsubscribeUrl)}" style="color:#64748b;text-decoration:none">Unsubscribe</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function unsubscribeUrl(subscriber: EmailSubscriberRecord) {
  return appUrl(`/api/gov/email-notifications/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`);
}

function appUrl(path: string) {
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const baseUrl = rawBaseUrl ? (rawBaseUrl.startsWith("http") ? rawBaseUrl : `https://${rawBaseUrl}`) : "https://govt-search-web.vercel.app";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
