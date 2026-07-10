import "server-only";

import type { ApprovedResponseBlockRecord, CompanyProfile, DraftQuestionnaire, UnifiedSearchResult } from "@/lib/gov-types";
import type { TrackedOpportunityRecord } from "@/lib/supabase-admin";

type DraftInput = {
  opportunity: TrackedOpportunityRecord;
  companyProfile?: CompanyProfile | null;
  approvedBlocks?: ApprovedResponseBlockRecord[];
  questionnaire: DraftQuestionnaire;
};

export function buildProposalDraft({ opportunity, companyProfile, approvedBlocks = [], questionnaire }: DraftInput) {
  const rawResult = opportunity.raw_result;
  const companyName = cleanValue(companyProfile?.company_name) || "[COMPANY NAME]";
  const opportunityTitle = cleanValue(opportunity.title);
  const solicitationId = cleanValue(opportunity.solicitation_id) || "[SOLICITATION ID]";
  const buyer = cleanValue(opportunity.buyer) || "[BUYER]";
  const deadline = cleanValue(opportunity.deadline) || "[DUE DATE]";
  const serviceLine = cleanValue(questionnaire.primaryService) || cleanValue(companyProfile?.service_summary) || "[PRIMARY SERVICE LINE]";
  const projectLead = cleanValue(questionnaire.projectLead) || "[PROJECT LEAD]";
  const winThemes = cleanValue(questionnaire.winThemes) || cleanValue(companyProfile?.differentiators) || "[WIN THEMES TO CONFIRM]";
  const pastPerformance = cleanValue(questionnaire.pastPerformance) || cleanValue(companyProfile?.past_performance) || "[RELEVANT PAST PERFORMANCE]";
  const staffingNotes = cleanValue(questionnaire.staffingNotes) || cleanValue(companyProfile?.team_bios) || "[STAFFING / KEY PERSONNEL]";
  const pricingNotes = cleanValue(questionnaire.pricingNotes) || "[PRICING APPROACH / ASSUMPTIONS]";
  const complianceNotes = cleanValue(questionnaire.complianceNotes) || "[COMPLIANCE NOTES]";
  const missingInfo = cleanValue(questionnaire.missingInfo) || "[MISSING INFORMATION TO COLLECT]";
  const tone = cleanValue(questionnaire.tone) || "Formal, clear, and practical";
  const documentLinks = rawResult?.documentLinks?.length
    ? rawResult.documentLinks
    : [{ label: "Opportunity posting", url: opportunity.opportunity_url }];
  const checklist = rawResult?.applicationChecklist?.length
    ? rawResult.applicationChecklist
    : [
        "Confirm due date, delivery method, and submission portal.",
        "Download solicitation packet, addenda, forms, and pricing templates.",
        "Confirm required licenses, insurance, certifications, references, and signatures.",
        "Create internal review deadline before the buyer due date.",
      ];
  const complianceRows = buildComplianceRows({ checklist, deadline, projectLead, rawResult, opportunity });
  const matchedApprovedBlocks = selectApprovedBlocks(approvedBlocks, [serviceLine, opportunityTitle, buyer, rawResult?.sourceName ?? opportunity.source_name]);

  return [
    `${companyName} Draft Response`,
    "",
    `Opportunity: ${opportunityTitle}`,
    `Buyer: ${buyer}`,
    `Solicitation / Reference: ${solicitationId}`,
    `Due: ${deadline}`,
    `Draft tone: ${tone}`,
    "",
    "Human Review Notes",
    "- This is a working draft. Confirm every requirement against the official solicitation documents before submission.",
    "- Replace every bracketed item before final review.",
    "- Keep final submission in the buyer's required format, portal, and file naming rules.",
    "",
    "Document Links",
    ...documentLinks.slice(0, 10).map((link) => `- ${link.label}: ${link.url}`),
    "",
    "Source Document Review Matrix",
    "| Document | Review Purpose | Status | Notes |",
    "| --- | --- | --- | --- |",
    ...documentLinks.slice(0, 10).map((link) => `| ${escapeTable(link.label)} | Confirm scope, forms, addenda, deadline, and submission instructions. | Not reviewed | ${escapeTable(link.url)} |`),
    "",
    "Bid / No-Bid Snapshot",
    `Current decision: ${cleanValue(questionnaire.bidDecision) || "[REVIEW]"}`,
    `Primary service fit: ${serviceLine}`,
    `Internal owner: ${projectLead}`,
    "",
    "Compliance Checklist",
    ...checklist.map((item) => `- [ ] ${item}`),
    `- [ ] Confirm deadline: ${deadline}`,
    `- [ ] Confirm response owner: ${projectLead}`,
    "- [ ] Confirm required forms, pricing templates, signatures, exceptions, and addenda.",
    "- [ ] Confirm whether questions must be submitted before a separate Q&A deadline.",
    "",
    "Compliance Matrix",
    "| Requirement / Task | Source | Response Owner | Status | Draft Location / Notes |",
    "| --- | --- | --- | --- | --- |",
    ...complianceRows,
    "",
    "Executive Summary",
    `${companyName} is pleased to submit this response for ${opportunityTitle}. Based on the opportunity description and available source data, the requested work appears aligned with ${sentenceFragment(serviceLine)}.`,
    "",
    `${companyName} brings the following strengths to this engagement: ${sentenceFragment(winThemes)}.`,
    "",
    "We understand that public-sector buyers need a partner that can deliver practical results, communicate clearly, meet deadlines, and reduce administrative burden. Our proposed approach is built around clear planning, accountable delivery, and measurable outcomes.",
    "",
    "Understanding of Need",
    `The buyer is seeking support related to ${sentenceFragment(serviceLine)}. The source summary captured for this opportunity is:`,
    "",
    cleanValue(opportunity.summary) || "[SUMMARY FROM SOLICITATION TO ADD]",
    "",
    "Items to verify in the solicitation documents:",
    "- Scope of work and required deliverables",
    "- Minimum qualifications and required certifications",
    "- Evaluation criteria and scoring weights",
    "- Submission format, page limits, forms, and portal rules",
    "- Contract term, budget, pricing model, and renewal options",
    "",
    "Proposed Approach",
    `Our approach will be led by ${projectLead} and organized around the following work plan:`,
    "",
    "1. Discovery and kickoff",
    "- Confirm goals, stakeholders, schedule, reporting cadence, and success measures.",
    "- Review existing materials, constraints, participant groups, and required outcomes.",
    "",
    "2. Design and planning",
    "- Build a practical delivery plan aligned to the buyer's goals.",
    "- Confirm content, facilitation methods, evaluation tools, and implementation timeline.",
    "",
    "3. Delivery",
    "- Deliver the approved training, coaching, facilitation, or advisory services.",
    "- Maintain clear communication with the buyer's project manager.",
    "",
    "4. Measurement and closeout",
    "- Collect feedback, document outcomes, and recommend next steps.",
    "- Provide final materials, attendance records, reports, or other required closeout items.",
    "",
    "Differentiators",
    winThemes,
    "",
    "Relevant Past Performance",
    pastPerformance,
    "",
    "Approved Language To Consider",
    ...(matchedApprovedBlocks.length
      ? matchedApprovedBlocks.flatMap((block) => [`${block.title} (${block.category})`, block.content, ""])
      : ["[No approved response-library blocks matched yet. Add approved language from reviewed drafts to improve future responses.]", ""]),
    "Team and Staffing",
    staffingNotes,
    "",
    "Certifications / Compliance",
    cleanValue(companyProfile?.certifications) || complianceNotes,
    "",
    "Pricing / Budget Notes",
    pricingNotes,
    "",
    "Assumptions and Exceptions",
    "- [NEEDS INPUT] Confirm pricing assumptions.",
    "- [NEEDS INPUT] Confirm whether travel, materials, technology, or facility costs are included.",
    "- [NEEDS INPUT] Confirm any exceptions to terms and conditions.",
    "",
    "Questions for Buyer",
    "- [NEEDS INPUT] Add any clarification questions before the Q&A deadline.",
    "",
    "Missing Information",
    missingInfo,
    "",
    "Reusable Approved Language Candidates",
    "After human review, approved sections from this draft can be saved back into the company profile or response library for future opportunities.",
    "",
    "Next Actions",
    "- Review the official solicitation packet and addenda.",
    "- Fill in all bracketed items.",
    "- Assign internal reviewers.",
    "- Finalize required attachments and forms.",
    "- Submit only after human approval.",
    "",
  ].join("\n");
}

export function companySnapshot(profile?: CompanyProfile | null) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    company_name: profile.company_name,
    website: profile.website,
    headquarters: profile.headquarters,
    service_summary: profile.service_summary,
    differentiators: profile.differentiators,
    certifications: profile.certifications,
    past_performance: profile.past_performance,
    team_bios: profile.team_bios,
    standard_language: profile.standard_language,
  };
}

function cleanValue(value?: string | null) {
  return value?.trim() || "";
}

function sentenceFragment(value: string) {
  return cleanValue(value).replace(/[.!?]+$/g, "");
}

function buildComplianceRows({
  checklist,
  deadline,
  projectLead,
  rawResult,
  opportunity,
}: {
  checklist: string[];
  deadline: string;
  projectLead: string;
  rawResult?: UnifiedSearchResult | null;
  opportunity: TrackedOpportunityRecord;
}) {
  const rows = [
    ...checklist.map((item) => ({
      requirement: item,
      source: "Application checklist",
      owner: projectLead,
      status: "Open",
      notes: "Confirm against official solicitation documents.",
    })),
    {
      requirement: `Submit response by ${deadline}`,
      source: "Opportunity metadata",
      owner: projectLead,
      status: deadline.includes("[") ? "Needs date" : "Open",
      notes: "Set an internal deadline at least 48 hours before buyer deadline.",
    },
    {
      requirement: "Download and review all addenda before submission",
      source: rawResult?.documentLinks?.length ? "Captured document links" : "Opportunity posting",
      owner: projectLead,
      status: "Open",
      notes: "Addenda may change forms, scope, or deadline.",
    },
    {
      requirement: "Confirm submission portal and vendor registration",
      source: opportunity.portal_url ?? opportunity.opportunity_url,
      owner: projectLead,
      status: "Open",
      notes: "Do not wait until due date to confirm portal access.",
    },
  ];

  return rows.map(
    (row) =>
      `| ${escapeTable(row.requirement)} | ${escapeTable(row.source)} | ${escapeTable(row.owner)} | ${escapeTable(row.status)} | ${escapeTable(row.notes)} |`,
  );
}

function selectApprovedBlocks(blocks: ApprovedResponseBlockRecord[], terms: string[]) {
  const normalizedTerms = terms
    .flatMap((term) => term.toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length > 3);

  return blocks
    .map((block) => {
      const haystack = [block.title, block.category, block.content, block.tags.join(" ")].join(" ").toLowerCase();
      const score = normalizedTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { block, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.block.title.localeCompare(b.block.title))
    .slice(0, 5)
    .map((item) => item.block);
}

function escapeTable(value?: string | null) {
  return cleanValue(value).replace(/\|/g, "\\|").replace(/\n+/g, " ");
}
