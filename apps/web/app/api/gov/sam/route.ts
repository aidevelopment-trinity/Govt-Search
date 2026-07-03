import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const apiKey = process.env.SAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      opportunities: [],
      message: "SAM_API_KEY is not configured.",
    });
  }

  if (query.length < 3) {
    return NextResponse.json({ configured: true, opportunities: [] });
  }

  const today = new Date();
  const prior = new Date(today);
  prior.setDate(today.getDate() - 30);

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: "10",
    keyword: query,
    postedFrom: formatSamDate(prior),
    postedTo: formatSamDate(today),
  });

  try {
    const response = await fetch(`https://api.sam.gov/opportunities/v2/search?${params.toString()}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        opportunities: [],
        message: `SAM.gov returned ${response.status}.`,
      });
    }

    const data = await response.json();
    const opportunities = Array.isArray(data.opportunitiesData)
      ? data.opportunitiesData.map((item: Record<string, unknown>) => ({
          title: String(item.title ?? "Untitled opportunity"),
          solicitationNumber: optionalString(item.solicitationNumber),
          agency: optionalString(item.fullParentPathName) ?? optionalString(item.agency),
          office: optionalString(item.officeName),
          postedDate: optionalString(item.postedDate),
          responseDeadLine: optionalString(item.responseDeadLine),
          type: optionalString(item.type),
          uiLink: optionalString(item.uiLink),
        }))
      : [];

    return NextResponse.json({ configured: true, opportunities });
  } catch {
    return NextResponse.json({
      configured: true,
      opportunities: [],
      message: "SAM.gov search failed.",
    });
  }
}

function formatSamDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
