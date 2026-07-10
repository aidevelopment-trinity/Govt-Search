import { NextResponse } from "next/server";
import type { CompanyProfile } from "@/lib/gov-types";
import { getCompanyProfile, upsertCompanyProfile } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getCompanyProfile();
  const status = statusFromConfiguredResult(result);
  const body = result.ok ? { ...result, data: result.data[0] ?? null } : result;
  return jsonNoStore(body, { status });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<CompanyProfile> | null;

  if (!body || typeof body !== "object") {
    return jsonNoStore({ ok: false, error: "Missing company profile payload." }, { status: 400 });
  }

  const result = await upsertCompanyProfile({
    company_name: stringField(body.company_name),
    website: nullableStringField(body.website),
    headquarters: nullableStringField(body.headquarters),
    service_summary: nullableStringField(body.service_summary),
    differentiators: nullableStringField(body.differentiators),
    certifications: nullableStringField(body.certifications),
    past_performance: nullableStringField(body.past_performance),
    team_bios: nullableStringField(body.team_bios),
    standard_language: nullableStringField(body.standard_language),
  });
  const status = statusFromConfiguredResult(result);
  const responseBody = result.ok ? { ...result, data: result.data[0] ?? null } : result;
  return jsonNoStore(responseBody, { status });
}

function statusFromConfiguredResult(result: { ok: boolean; configured?: boolean }) {
  return result.ok || result.configured === false ? 200 : 502;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
