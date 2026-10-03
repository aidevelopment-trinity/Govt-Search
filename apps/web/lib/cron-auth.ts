import { NextResponse } from "next/server";

const CRON_SECRET_NAMES = ["CRON_SECRET", "CRON_BACKUP_SECRET"] as const;

export function authorizeCronRequest(request: Request) {
  const configuredSecrets = CRON_SECRET_NAMES.map((name) => process.env[name]).filter(Boolean);

  if (configuredSecrets.length === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "No cron secret is configured. Set CRON_SECRET or CRON_BACKUP_SECRET." }, { status: 503 }),
    };
  }

  const authorization = request.headers.get("authorization");
  const authorized = configuredSecrets.some((secret) => authorization === `Bearer ${secret}`);

  if (!authorized) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }),
    };
  }

  return { ok: true as const };
}

export function getCronSecretStatus() {
  return {
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    cronBackupSecretConfigured: Boolean(process.env.CRON_BACKUP_SECRET),
    anyCronSecretConfigured: Boolean(process.env.CRON_SECRET || process.env.CRON_BACKUP_SECRET),
  };
}
