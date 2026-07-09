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
  const normalizedQuery = query.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  const terms = normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const expanded = new Set(terms);
  if (normalizedQuery.includes(" ")) {
    expanded.add(normalizedQuery);
  }

  const synonymGroups = [
    ["leadership", "leader", "executive", "management", "supervisor", "supervisory", "coaching"],
    ["management", "manager", "supervisor", "supervisory", "leadership"],
    ["training", "learning", "education", "instructional", "workshop", "course", "curriculum", "facilitation"],
    ["development", "training", "learning", "professional", "workforce", "organizational"],
    ["organizational", "organization", "change", "workforce", "culture"],
    ["coaching", "mentoring", "facilitation", "executive"],
  ];

  for (const group of synonymGroups) {
    if (group.some((term) => expanded.has(term))) {
      group.forEach((term) => expanded.add(term));
    }
  }

  ["leadership training", "management training", "professional development", "workforce development", "supervisor training"].forEach((phrase) => {
    if (phrase.includes(normalizedQuery) || normalizedQuery.includes(phrase.split(" ")[0])) {
      expanded.add(phrase);
    }
  });

  return Array.from(expanded);
}
