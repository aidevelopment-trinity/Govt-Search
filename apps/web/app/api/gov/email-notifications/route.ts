import { NextResponse } from "next/server";
import { isEmailConfigured, runDueEmailNotifications, sendTestEmailToSubscriber } from "@/lib/email-notifications";
import { ensureDefaultMonitorSearches } from "@/lib/monitoring";
import {
  createKeywordSubscription,
  deleteEmailSubscriber,
  deleteFailedTestDeliveries,
  deleteKeywordSubscription,
  listEmailSubscribers,
  listKeywordSubscriptions,
  listNotificationDeliveries,
  updateEmailSubscriber,
  updateKeywordSubscription,
  upsertEmailSubscriber,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const [subscribers, subscriptions, searches, deliveries] = await Promise.all([
    listEmailSubscribers(),
    listKeywordSubscriptions(),
    ensureDefaultMonitorSearches(),
    listNotificationDeliveries(50),
  ]);

  const ok = subscribers.ok && subscriptions.ok && searches.ok && deliveries.ok;
  const configured = subscribers.configured && subscriptions.configured && searches.configured && deliveries.configured;

  return jsonNoStore({
    ok,
    configured,
    emailConfigured: isEmailConfigured(),
    subscribers: subscribers.ok ? subscribers.data : [],
    subscriptions: subscriptions.ok ? subscriptions.data : [],
    searches: searches.ok ? searches.data : [],
    deliveries: deliveries.ok ? deliveries.data : [],
    errors: [subscribers.ok ? undefined : subscribers.error, subscriptions.ok ? undefined : subscriptions.error, searches.ok ? undefined : searches.error, deliveries.ok ? undefined : deliveries.error].filter(Boolean),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return jsonNoStore({ ok: false, error: "Missing email notification action." }, { status: 400 });
  }

  if (body.action === "add-subscriber") {
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    if (!isValidEmail(email)) {
      return jsonNoStore({ ok: false, error: "Enter a plain email address like name@company.com." }, { status: 400 });
    }

    const result = await upsertEmailSubscriber({
      email,
      displayName: typeof body.displayName === "string" ? body.displayName : null,
      active: true,
    });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "update-subscriber") {
    if (typeof body.id !== "string") {
      return jsonNoStore({ ok: false, error: "Missing subscriber id." }, { status: 400 });
    }

    const result = await updateEmailSubscriber({
      id: body.id,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "delete-subscriber") {
    if (typeof body.id !== "string") {
      return jsonNoStore({ ok: false, error: "Missing subscriber id." }, { status: 400 });
    }

    const result = await deleteEmailSubscriber(body.id);
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "add-subscription") {
    if (typeof body.subscriberId !== "string" || typeof body.savedSearchId !== "string") {
      return jsonNoStore({ ok: false, error: "Choose a recipient and a keyword." }, { status: 400 });
    }

    const result = await createKeywordSubscription({
      subscriberId: body.subscriberId,
      savedSearchId: body.savedSearchId,
      frequency: isNotificationFrequency(body.frequency) ? body.frequency : "daily",
      active: true,
    });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "update-subscription") {
    if (typeof body.id !== "string") {
      return jsonNoStore({ ok: false, error: "Missing subscription id." }, { status: 400 });
    }

    const result = await updateKeywordSubscription({
      id: body.id,
      frequency: isNotificationFrequency(body.frequency) ? body.frequency : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "delete-subscription") {
    if (typeof body.id !== "string") {
      return jsonNoStore({ ok: false, error: "Missing subscription id." }, { status: 400 });
    }

    const result = await deleteKeywordSubscription(body.id);
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "delete-failed-test-deliveries") {
    const result = await deleteFailedTestDeliveries();
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "send-due") {
    const result = await runDueEmailNotifications({ force: true, limitSubscriptions: 50 });
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  if (body.action === "send-test") {
    if (typeof body.subscriberId !== "string") {
      return jsonNoStore({ ok: false, error: "Missing subscriber id." }, { status: 400 });
    }

    const result = await sendTestEmailToSubscriber(body.subscriberId);
    return jsonNoStore(result, { status: result.ok || result.configured === false ? 200 : 502 });
  }

  return jsonNoStore({ ok: false, error: "Unknown email notification action." }, { status: 400 });
}

function isNotificationFrequency(value: unknown): value is "instant" | "daily" | "weekly" {
  return value === "instant" || value === "daily" || value === "weekly";
}

function normalizeEmail(value: string) {
  return value.trim().replace(/^mailto:/i, "").toLowerCase();
}

function isValidEmail(value: string) {
  if (value.length > 254) {
    return false;
  }

  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
