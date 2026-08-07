import { NextResponse } from "next/server";
import { unsubscribeEmailSubscriberByToken } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await unsubscribeEmailSubscriberByToken(token);
  const title = result.ok ? "Unsubscribed" : "Unsubscribe link could not be processed";
  const message = result.ok
    ? "This email address has been removed from Gov Contract Finder alerts."
    : result.configured === false
      ? "The notification database is not configured."
      : result.error;

  return new NextResponse(
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif">
        <main style="max-width:620px;margin:60px auto;background:#fff;border:1px solid #d7e2ef;border-radius:10px;padding:28px">
          <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2">${escapeHtml(title)}</h1>
          <p style="margin:0;color:#475569;font-size:16px;line-height:1.5">${escapeHtml(message)}</p>
        </main>
      </body>
    </html>`,
    {
      status: result.ok || result.configured === false ? 200 : 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
