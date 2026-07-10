import "server-only";

import type { CompanyProfile, DraftQuestionnaire, UnifiedSearchResult } from "@/lib/gov-types";
import type { TrackedOpportunityRecord } from "@/lib/supabase-admin";

type DraftInput = {
  opportunity: TrackedOpportunityRecord;
  companyProfile?: CompanyProfile | null;
  questionnaire: DraftQuestionnaire;
};

export function buildProposalDraft({ opportunity, companyProfile, questionnaire }: DraftInput) {
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
    "Executive Summary",
    `${companyName} is pleased to submit this response for ${opportunityTitle}. Based on the opportunity description and available source data, the requested work appears aligned with ${serviceLine}.`,
    "",
    `${companyName} brings the following strengths to this engagement: ${winThemes}.`,
    "",
    "We understand that public-sector buyers need a partner that can deliver practical results, communicate clearly, meet deadlines, and reduce administrative burden. Our proposed approach is built around clear planning, accountable delivery, and measurable outcomes.",
    "",
    "Understanding of Need",
    `The buyer is seeking support related to ${serviceLine}. The source summary captured for this opportunity is:`,
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
