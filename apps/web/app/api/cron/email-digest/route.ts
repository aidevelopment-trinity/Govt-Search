import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { runDueEmailNotifications } from "@/lib/email-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const result = await runDueEmailNotifications({ limitSubscriptions: 25 });
  return NextResponse.json(result, { status: result.ok || result.configured === false ? 200 : 502 });
}
