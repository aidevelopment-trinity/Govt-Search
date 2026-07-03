export function samSearchUrl(query: string) {
  const params = new URLSearchParams({
    index: "opp",
    page: "1",
    sort: "-modifiedDate",
    sfm: "simpleSearch",
    keywords: query,
  });
  return `https://sam.gov/search/?${params.toString()}`;
}

export function conceptTerms(query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const expanded = new Set(terms);
  if (expanded.has("development")) {
    expanded.add("training");
  }

  return Array.from(expanded);
}
