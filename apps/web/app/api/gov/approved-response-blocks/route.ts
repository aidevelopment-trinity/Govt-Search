import { NextResponse } from "next/server";
import { createApprovedResponseBlock, listApprovedResponseBlocks } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listApprovedResponseBlocks();
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.title !== "string" || typeof body.content !== "string") {
    return jsonNoStore({ ok: false, error: "Missing approved response block title or content." }, { status: 400 });
  }

  const tags =
    typeof body.tags === "string"
      ? body.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];

  const result = await createApprovedResponseBlock({
    title: body.title.trim().slice(0, 160),
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim().slice(0, 80) : "general",
    content: body.content.trim().slice(0, 12000),
    sourceDraftId: typeof body.sourceDraftId === "string" ? body.sourceDraftId : null,
    sourceOpportunityId: typeof body.sourceOpportunityId === "string" ? body.sourceOpportunityId : null,
    tags,
  });
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return jsonNoStore(result, { status });
}

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
