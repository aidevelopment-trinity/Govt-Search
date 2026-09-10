import { NextResponse } from "next/server";

import { samSearchUrl } from "@/lib/gov-search";

type SamApiResponse = { opportunitiesData?: Array<Record<string, unknown>> };
type SamOpportunitySummary = NonNullable<ReturnType<typeof samOpportunity>>;

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
  prior.setDate(today.getDate() - 90);
  const postedFrom = formatSamDate(prior);
  const postedTo = formatSamDate(today);
  const strategies = samStrategies({ query, apiKey, postedFrom, postedTo });

  try {
    const responses = await Promise.all(
      strategies.map(async (strategy) => {
        const response = await fetch(`https://api.sam.gov/opportunities/v2/search?${strategy.params.toString()}`, {
          next: { revalidate: 900 },
        });

        if (!response.ok) {
          throw new Error(`SAM.gov returned ${response.status}.`);
        }

        return (await response.json()) as SamApiResponse;
      }),
    );
    const opportunities = dedupeSamOpportunities(
      responses.flatMap((data) =>
        Array.isArray(data.opportunitiesData)
          ? data.opportunitiesData
              .map((item: Record<string, unknown>) => samOpportunity(item, query))
              .filter((item): item is SamOpportunitySummary => Boolean(item))
          : [],
      ),
    ).slice(0, 30);

    return NextResponse.json({ configured: true, opportunities });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      opportunities: [],
      message: error instanceof Error ? error.message : "SAM.gov search failed.",
    });
  }
}

function samStrategies({
  query,
  apiKey,
  postedFrom,
  postedTo,
}: {
  query: string;
  apiKey: string;
  postedFrom: string;
  postedTo: string;
}) {
  const baseParams = {
    api_key: apiKey,
    limit: "10",
    postedFrom,
    postedTo,
  };
  const strategies = [
    {
      label: "title",
      params: new URLSearchParams({
        ...baseParams,
        title: query,
      }),
    },
  ];

  if (/\b(training|learning|education|course|instruction|curriculum|professional development|leadership|leader|management|manager|coaching|coach|supervisor|workforce|organizational)\b/i.test(query)) {
    strategies.push(
      {
        label: "psc-u008",
        params: new URLSearchParams({
          ...baseParams,
          ccode: "U008",
        }),
      },
      {
        label: "naics-611430",
        params: new URLSearchParams({
          ...baseParams,
          ncode: "611430",
        }),
      },
    );
  }

  return strategies;
}

function samOpportunity(item: Record<string, unknown>, query: string) {
  const title = String(item.title ?? "Untitled opportunity");
  const solicitationNumber = optionalString(item.solicitationNumber);
  const agency = optionalString(item.fullParentPathName) ?? optionalString(item.agency);
  const office = optionalString(item.officeName);
  const type = optionalString(item.type);
  const responseDeadLine = optionalString(item.responseDeadLine);
  const description = optionalString(item.description);
  const haystack = [title, solicitationNumber, agency, office, type, description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!hasDirectConceptSignal(haystack, query)) {
    return undefined;
  }

  if (isPastDeadline(responseDeadLine) || ["award notice", "justification"].includes((type ?? "").toLowerCase())) {
    return undefined;
  }

  const noticeId = optionalString(item.noticeId);
  const uiLink = noticeId ? `https://sam.gov/opp/${noticeId}/view` : optionalString(item.uiLink) ?? samSearchUrl(query);

  return {
    title,
    solicitationNumber,
    agency,
    office,
    postedDate: optionalString(item.postedDate),
    responseDeadLine,
    type,
    uiLink,
    naicsCode: optionalString(item.naicsCode),
    classificationCode: optionalString(item.classificationCode),
  };
}

function dedupeSamOpportunities<T extends { solicitationNumber?: string; title?: string; uiLink?: string }>(opportunities: T[]) {
  const deduped = new Map<string, T>();

  for (const opportunity of opportunities) {
    const key = (opportunity.solicitationNumber || opportunity.uiLink || opportunity.title || "").toLowerCase();
    if (key && !deduped.has(key)) {
      deduped.set(key, opportunity);
    }
  }

  return Array.from(deduped.values());
}

function hasDirectConceptSignal(haystack: string, query: string) {
  const normalizedQuery = query.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedQuery) {
    return true;
  }

  if (normalizedQuery.includes(" ") && haystack.includes(normalizedQuery)) {
    return true;
  }

  const directTokens = normalizedQuery
    .split(/\s+/)
    .filter((term) => term.length > 2 && !["development", "professional", "services", "service"].includes(term));

  if (directTokens.some((term) => haystack.includes(term))) {
    return true;
  }

  if (directTokens.includes("training") && /\b(learning|education|instructional|workshop|course|curriculum|facilitation)\b/i.test(haystack)) {
    return true;
  }

  if (directTokens.includes("leadership") && /\b(leader|executive|supervisor|supervisory|coaching)\b/i.test(haystack)) {
    return true;
  }

  return false;
}

function isPastDeadline(value: string | undefined) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function formatSamDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
