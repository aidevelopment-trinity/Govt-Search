"use client";

import { AlertTriangle, Bell, CheckCircle2, ClipboardList, FileText, Mail, Play, Plus, RefreshCw, Search, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EmailSubscriberRecord, KeywordSubscriptionRecord, NotificationDeliveryRecord, SavedSearchRecord } from "@/lib/supabase-admin";

type NotificationFrequency = "instant" | "daily" | "weekly";

type NotificationsResponse = {
  ok: boolean;
  configured: boolean;
  emailConfigured: boolean;
  subscribers: EmailSubscriberRecord[];
  subscriptions: KeywordSubscriptionRecord[];
  searches: SavedSearchRecord[];
  deliveries: NotificationDeliveryRecord[];
  errors?: string[];
};

const frequencyOptions: Array<{ value: NotificationFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "instant", label: "Near-real-time" },
];

export function EmailNotificationsDashboard() {
  const [subscribers, setSubscribers] = useState<EmailSubscriberRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<KeywordSubscriptionRecord[]>([]);
  const [searches, setSearches] = useState<SavedSearchRecord[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-configured">("loading");
  const [message, setMessage] = useState("");
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscriberName, setSubscriberName] = useState("");
  const [selectedSubscriberId, setSelectedSubscriberId] = useState("");
  const [selectedSearchId, setSelectedSearchId] = useState("");
  const [frequency, setFrequency] = useState<NotificationFrequency>("daily");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteConfirmSubscriberId, setDeleteConfirmSubscriberId] = useState<string | null>(null);

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    if ((!selectedSubscriberId || !subscribers.some((subscriber) => subscriber.id === selectedSubscriberId)) && subscribers[0]) {
      setSelectedSubscriberId(subscribers[0].id);
    }

    if ((!selectedSearchId || !searches.some((search) => search.id === selectedSearchId)) && searches[0]) {
      setSelectedSearchId(searches[0].id);
    }
  }, [searches, selectedSearchId, selectedSubscriberId, subscribers]);

  const subscribersById = useMemo(() => new Map(subscribers.map((subscriber) => [subscriber.id, subscriber])), [subscribers]);
  const searchesById = useMemo(() => new Map(searches.map((search) => [search.id, search])), [searches]);
  const activeSubscribers = subscribers.filter((subscriber) => subscriber.is_active);
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.is_active);
  const sentDeliveries = deliveries.filter((delivery) => delivery.status === "sent").length;
  const failedDeliveries = deliveries.filter((delivery) => delivery.status === "failed").length;

  async function loadNotifications() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/gov/email-notifications");
      const data = (await response.json()) as NotificationsResponse;
      setSubscribers(data.subscribers ?? []);
      setSubscriptions(data.subscriptions ?? []);
      setSearches(data.searches ?? []);
      setDeliveries(data.deliveries ?? []);
      setEmailConfigured(Boolean(data.emailConfigured));
      if (data.ok) {
        setStatus("ready");
      } else {
        setStatus(data.configured === false ? "not-configured" : "error");
        setMessage(data.errors?.join(" ") || "Email notification data could not be loaded.");
      }
    } catch {
      setStatus("error");
      setMessage("Email notification data could not be loaded.");
    }
  }

  async function addSubscriber() {
    setBusyAction("add-subscriber");
    setMessage("");
    try {
      const response = await fetch("/api/gov/email-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-subscriber", email: subscriberEmail, displayName: subscriberName }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.error || "Recipient could not be saved.");
      } else {
        setSubscriberEmail("");
        setSubscriberName("");
      }
      await loadNotifications();
    } catch {
      setMessage("Recipient could not be saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function addSubscription() {
    setBusyAction("add-subscription");
    setMessage("");
    try {
      const response = await fetch("/api/gov/email-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-subscription", subscriberId: selectedSubscriberId, savedSearchId: selectedSearchId, frequency }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.error || "Keyword subscription could not be saved.");
      }
      await loadNotifications();
    } catch {
      setMessage("Keyword subscription could not be saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSubscriber(subscriber: EmailSubscriberRecord, isActive: boolean) {
    await postAndReload(`subscriber:${subscriber.id}`, { action: "update-subscriber", id: subscriber.id, isActive });
  }

  async function deleteSubscriber(subscriber: EmailSubscriberRecord) {
    if (deleteConfirmSubscriberId !== subscriber.id) {
      setDeleteConfirmSubscriberId(subscriber.id);
      return;
    }

    await postAndReload(`delete-subscriber:${subscriber.id}`, { action: "delete-subscriber", id: subscriber.id });
    setDeleteConfirmSubscriberId(null);
  }

  async function updateSubscription(subscription: KeywordSubscriptionRecord, updates: { isActive?: boolean; frequency?: NotificationFrequency }) {
    await postAndReload(`subscription:${subscription.id}`, { action: "update-subscription", id: subscription.id, ...updates });
  }

  async function deleteSubscription(subscription: KeywordSubscriptionRecord) {
    await postAndReload(`delete:${subscription.id}`, { action: "delete-subscription", id: subscription.id });
  }

  async function sendTest(subscriber: EmailSubscriberRecord) {
    await postAndReload(`test:${subscriber.id}`, { action: "send-test", subscriberId: subscriber.id });
  }

  async function sendDue() {
    await postAndReload("send-due", { action: "send-due" });
  }

  async function postAndReload(actionId: string, body: Record<string, unknown>) {
    setBusyAction(actionId);
    setMessage("");
    try {
      const response = await fetch("/api/gov/email-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.message || data.error || "Email notification action failed.");
      } else if (body.action === "send-due") {
        setMessage(data.message || "Email notifications checked.");
      }
      await loadNotifications();
    } catch {
      setMessage("Email notification action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <a className="text-sm font-medium text-signal hover:underline" href="/monitor">
                Back to monitor
              </a>
              <h1 className="mt-2 text-2xl font-semibold">Email Notifications</h1>
              <p className="text-sm text-slate-500">Send monitored keyword updates to selected recipients.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <NavButton href="/" icon={Search} label="Search" />
              <NavButton href="/monitor" icon={Bell} label="Monitor" />
              <NavButton href="/proposals" icon={ClipboardList} label="Proposals" />
              <NavButton href="/drafts" icon={FileText} label="Drafts" />
              <NavButton href="/setup" icon={Settings} label="Setup" />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                type="button"
                disabled={status === "loading"}
                onClick={() => void loadNotifications()}
              >
                <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-4 px-5 py-5 lg:px-8">
        {message ? <StatePanel tone="warning" title="Notification Notice" message={message} /> : null}
        {status === "loading" ? <StatePanel loading title="Loading notifications" message="Reading recipients, keyword subscriptions, and delivery history." /> : null}
        {status === "not-configured" ? <StatePanel tone="warning" title="Supabase schema needed" message="Run the email notification SQL migration, then refresh this page." /> : null}
        {status === "error" ? <StatePanel tone="warning" title="Notifications unavailable" message={message || "Refresh and try again."} /> : null}

        {status === "ready" ? (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <Metric label="Recipients" value={`${activeSubscribers.length}/${subscribers.length}`} />
              <Metric label="Keyword alerts" value={`${activeSubscriptions.length}/${subscriptions.length}`} />
              <Metric label="Email provider" value={emailConfigured ? "Ready" : "Missing"} />
              <Metric label="Deliveries" value={`${sentDeliveries} sent${failedDeliveries ? ` / ${failedDeliveries} failed` : ""}`} />
            </section>

            {!emailConfigured ? (
              <StatePanel tone="warning" title="Resend is not connected" message="Add RESEND_API_KEY and EMAIL_FROM in Vercel before live emails can send." />
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-4">
                <section className="rounded-md border border-line bg-white p-4 shadow-panel">
                  <div className="mb-3 flex items-center gap-2">
                    <Mail className="size-4 text-slate-500" />
                    <h2 className="text-base font-semibold">Recipients</h2>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(190px,1fr)_minmax(160px,240px)_110px] md:items-end">
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-500">Email</span>
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-signal"
                        value={subscriberEmail}
                        onChange={(event) => setSubscriberEmail(event.target.value)}
                        placeholder="name@company.com"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-500">Name</span>
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-signal"
                        value={subscriberName}
                        onChange={(event) => setSubscriberName(event.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      type="button"
                      disabled={busyAction === "add-subscriber" || !subscriberEmail.trim()}
                      onClick={() => void addSubscriber()}
                    >
                      <Plus className="size-4" />
                      <span>Add</span>
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-line rounded-md border border-line">
                    {subscribers.length > 0 ? (
                      subscribers.map((subscriber) => (
                        <div key={subscriber.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_300px] md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {subscriber.is_active ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-slate-400" />}
                              <h3 className="truncate text-sm font-semibold">{subscriber.display_name || subscriber.email}</h3>
                              {subscriber.display_name ? <span className="text-xs text-slate-500">{subscriber.email}</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Added {formatDateTime(subscriber.created_at)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <button
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                              type="button"
                              disabled={busyAction === `subscriber:${subscriber.id}`}
                              onClick={() => void updateSubscriber(subscriber, !subscriber.is_active)}
                            >
                              {subscriber.is_active ? "Pause" : "Enable"}
                            </button>
                            <button
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                              type="button"
                              disabled={!emailConfigured || busyAction === `test:${subscriber.id}`}
                              onClick={() => void sendTest(subscriber)}
                            >
                              <Mail className="size-4" />
                              <span>{busyAction === `test:${subscriber.id}` ? "Sending" : "Test"}</span>
                            </button>
                            <button
                              className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:text-slate-400 ${
                                deleteConfirmSubscriberId === subscriber.id ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-line bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                              type="button"
                              disabled={busyAction === `delete-subscriber:${subscriber.id}`}
                              onClick={() => void deleteSubscriber(subscriber)}
                            >
                              <Trash2 className="size-4" />
                              <span>{deleteConfirmSubscriberId === subscriber.id ? "Confirm" : "Delete"}</span>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-sm text-slate-600">No recipients yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-line bg-white p-4 shadow-panel">
                  <div className="mb-3 flex items-center gap-2">
                    <Bell className="size-4 text-slate-500" />
                    <h2 className="text-base font-semibold">Keyword Alerts</h2>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-[minmax(160px,1fr)_minmax(180px,1fr)_140px_110px] lg:items-end">
                    <Select label="Recipient" value={selectedSubscriberId} options={subscribers.map((subscriber) => ({ value: subscriber.id, label: subscriber.email }))} onChange={setSelectedSubscriberId} />
                    <Select label="Keyword" value={selectedSearchId} options={searches.map((search) => ({ value: search.id, label: `${search.query} (${search.state_filter})` }))} onChange={setSelectedSearchId} />
                    <Select label="Frequency" value={frequency} options={frequencyOptions} onChange={(value) => setFrequency(value as NotificationFrequency)} />
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      type="button"
                      disabled={busyAction === "add-subscription" || !selectedSubscriberId || !selectedSearchId}
                      onClick={() => void addSubscription()}
                    >
                      <Plus className="size-4" />
                      <span>Add</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      type="button"
                      disabled={!emailConfigured || busyAction === "send-due"}
                      onClick={() => void sendDue()}
                    >
                      <Play className="size-4" />
                      <span>{busyAction === "send-due" ? "Sending" : "Send Pending Updates"}</span>
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-line rounded-md border border-line">
                    {subscriptions.length > 0 ? (
                      subscriptions.map((subscription) => {
                        const subscriber = subscribersById.get(subscription.subscriber_id);
                        const search = searchesById.get(subscription.saved_search_id);
                        return (
                          <div key={subscription.id} className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_150px_180px] lg:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {subscription.is_active ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-slate-400" />}
                                <h3 className="truncate text-sm font-semibold">{search?.query ?? "Deleted keyword"}</h3>
                                <span className="rounded-md border border-line bg-slate-50 px-2 py-0.5 text-xs text-slate-500">{subscriber?.email ?? "Unknown recipient"}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {search ? `${search.state_filter} · ${search.level_filter}` : "Keyword not found"} · Last sent {subscription.last_notified_at ? formatDateTime(subscription.last_notified_at) : "never"}
                              </p>
                            </div>
                            <Select
                              label="Frequency"
                              value={subscription.frequency}
                              options={frequencyOptions}
                              onChange={(value) => void updateSubscription(subscription, { frequency: value as NotificationFrequency })}
                            />
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              <button
                                className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                type="button"
                                disabled={busyAction === `subscription:${subscription.id}`}
                                onClick={() => void updateSubscription(subscription, { isActive: !subscription.is_active })}
                              >
                                {subscription.is_active ? "Pause" : "Enable"}
                              </button>
                              <button
                                className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                type="button"
                                disabled={busyAction === `delete:${subscription.id}`}
                                onClick={() => void deleteSubscription(subscription)}
                                aria-label="Remove keyword alert"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-3 py-4 text-sm text-slate-600">No keyword alerts yet.</p>
                    )}
                  </div>
                </section>
              </div>

              <aside className="rounded-md border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold">Recent Deliveries</h2>
                <div className="mt-3 space-y-2">
                  {deliveries.length > 0 ? (
                    deliveries.slice(0, 20).map((delivery) => (
                      <div key={delivery.id} className="rounded-md border border-line bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold">{delivery.subject}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {delivery.delivery_type} · {delivery.finding_ids?.length ?? 0} findings · {formatDateTime(delivery.created_at)}
                            </p>
                            {delivery.error_message ? <p className="mt-1 line-clamp-2 text-xs text-rose-700">{delivery.error_message}</p> : null}
                          </div>
                          <StatusPill status={delivery.status} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">No deliveries yet.</p>
                  )}
                </div>
              </aside>
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

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <select className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-signal" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length > 0 ? (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option value="">None</option>
        )}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 shadow-panel">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: NotificationDeliveryRecord["status"] }) {
  const className =
    status === "sent"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function StatePanel({ title, message, loading = false, tone = "default" }: { title: string; message: string; loading?: boolean; tone?: "default" | "warning" }) {
  return (
    <div className={`rounded-md border p-5 text-center shadow-panel ${tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-white"}`}>
      {loading ? <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-slate-500" /> : tone === "warning" ? <AlertTriangle className="mx-auto mb-2 size-5 text-amber-500" /> : null}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm opacity-80">{message}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
