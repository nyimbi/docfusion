import { describe, expect, it } from "vitest";
import {
	DATACRAFT_PROPOSAL_DOCUMENT_CONTENT,
	DATACRAFT_RESPONSE_SNIPPETS,
	DATACRAFT_RESPONSE_TEMPLATE_INPUTS,
	getDatacraftProposalDocumentContent,
	getDatacraftProposalSectionSeeds,
} from "@/lib/data/datacraft-response-content";

function flattenText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(flattenText).join(" ");
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return [record.text, record.content].map(flattenText).join(" ");
	}
	return "";
}

describe("Datacraft response content", () => {
	it("ships real Datacraft proposal templates instead of placeholder-only prompts", () => {
		expect(DATACRAFT_RESPONSE_TEMPLATE_INPUTS).toHaveLength(3);

		const allText = DATACRAFT_RESPONSE_TEMPLATE_INPUTS
			.map((template) => flattenText(template.content))
			.join(" ");

		expect(allText).toContain("Datacraft Ltd");
		expect(allText).toContain("Lindela");
		expect(allText).toContain("MeGuard");
		expect(allText).toContain("Wakala");
		expect(allText).toContain("IGAD");
		expect(allText).not.toContain("[AI will generate content");
	});

	it("provides reusable response snippets with searchable metadata", () => {
		expect(DATACRAFT_RESPONSE_SNIPPETS.length).toBeGreaterThanOrEqual(85);

		const shortcuts = new Set(DATACRAFT_RESPONSE_SNIPPETS.map((snippet) => snippet.shortcut));
		expect(shortcuts.size).toBe(DATACRAFT_RESPONSE_SNIPPETS.length);

		const names = DATACRAFT_RESPONSE_SNIPPETS.map((snippet) => snippet.name).join(" ");
		expect(names).toContain("Executive Summary");
		expect(names).toContain("Security");
		expect(names).toContain("Past Performance");
		expect(names).toContain("Solution Architecture");
		expect(names).toContain("AI Governance");
		expect(names).toContain("Commercial and Pricing");
		expect(names).toContain("Mobilization and Transition");

		expect(Array.from(shortcuts)).toEqual(
			expect.arrayContaining([
				"/dc-traceability",
				"/dc-win-themes",
				"/dc-architecture",
				"/dc-integration-migration",
				"/dc-data-governance",
				"/dc-ai-governance",
				"/dc-project-governance",
				"/dc-staffing",
				"/dc-training",
				"/dc-qa-testing",
				"/dc-risk",
				"/dc-service-management",
				"/dc-sla",
				"/dc-reporting",
				"/dc-pricing",
				"/dc-assumptions",
				"/dc-transition",
				"/dc-local-capacity",
				"/dc-teaming",
				"/dc-ux",
				"/dc-roadmap",
				"/dc-portfolio",
				"/dc-cover-letter",
				"/dc-scope-deliverables",
				"/dc-workplan",
				"/dc-acceptance-handover",
				"/dc-deployment-hosting",
				"/dc-devsecops",
				"/dc-privacy",
				"/dc-bcdr",
				"/dc-performance",
				"/dc-observability",
				"/dc-legal-commercial",
				"/dc-ethics",
				"/dc-esg-impact",
				"/dc-demo-oral",
				"/dc-consulting-discovery",
				"/dc-pmo",
				"/dc-raci",
				"/dc-raid",
				"/dc-change-control",
				"/dc-current-state",
				"/dc-future-state",
				"/dc-gap-roadmap",
				"/dc-maturity",
				"/dc-bpr",
				"/dc-benefits",
				"/dc-kpis",
				"/dc-readiness",
				"/dc-cutover",
				"/dc-hypercare",
				"/dc-operating-model",
			])
		);

		for (const snippet of DATACRAFT_RESPONSE_SNIPPETS) {
			expect(snippet.shortcut).toMatch(/^\/dc-/);
			expect(snippet.tags).toContain("datacraft");
			const text = flattenText(snippet.content);
			expect(text.length).toBeGreaterThan(500);
			expect(text).not.toContain("[AI will generate content");
		}
	});

	it("covers the major sections evaluators expect in a complete RFP response", () => {
		const topicCategories = new Set(DATACRAFT_RESPONSE_SNIPPETS.map((snippet) => snippet.topicCategory));

		expect(Array.from(topicCategories)).toEqual(
			expect.arrayContaining([
				"Executive",
				"Company",
				"Understanding",
				"Technical",
				"Security",
				"Compliance",
				"Architecture",
				"Integration",
				"Data Governance",
				"AI Governance",
				"Governance",
				"Staffing",
				"Adoption",
				"Quality",
				"Risk",
				"Support",
				"Service Levels",
				"Reporting",
				"Commercial",
				"Assumptions",
				"Transition",
				"Sustainability",
				"Partnerships",
				"User Experience",
				"Roadmap",
				"Portfolio",
				"Transmittal",
				"Requirements",
				"Scope",
				"Schedule",
				"Acceptance",
				"Communications",
				"Stakeholders",
				"Deployment",
				"Release Management",
				"Privacy",
				"Business Continuity",
				"Performance",
				"Observability",
				"Interoperability",
				"Knowledge Management",
				"Legal",
				"Ethics",
				"ESG",
				"Demonstration",
				"Clarifications",
				"Discovery",
				"PMO",
				"Decision Rights",
				"RAID",
				"Change Control",
				"Delivery Controls",
				"Current State",
				"Future State",
				"Gap Analysis",
				"Maturity",
				"Process Reengineering",
				"Facilitation",
				"Requirements Elicitation",
				"Options Analysis",
				"Benefits Realization",
				"Measurement",
				"Vendor Management",
				"Procurement Support",
				"Migration Governance",
				"Readiness",
				"Cutover",
				"Hypercare",
				"Lessons Learned",
				"Executive Advisory",
				"Programme Assurance",
				"Delivery Method",
				"Capacity Planning",
				"Risk-Adjusted Roadmap",
				"Decision Briefing",
				"Operating Model",
			])
		);

		const allText = DATACRAFT_RESPONSE_SNIPPETS.map((snippet) => flattenText(snippet.content)).join(" ");

		expect(allText).toContain("acceptance criteria");
		expect(allText).toContain("data governance");
		expect(allText).toMatch(/human control/i);
		expect(allText).toContain("service levels");
		expect(allText).toContain("total cost of ownership");
		expect(allText).toContain("knowledge transfer");
		expect(allText).toContain("RAID register");
		expect(allText).toContain("target operating model");
		expect(allText).toContain("go-live");
		expect(allText).toMatch(/benefits realization/i);
		expect(allText).toContain("change request");
	});

	it("prepopulates standard proposal document types with Datacraft response sections", () => {
		expect(Object.keys(DATACRAFT_PROPOSAL_DOCUMENT_CONTENT)).toEqual(
			expect.arrayContaining([
				"cover_letter",
				"executive_summary",
				"technical_approach",
				"management_plan",
				"past_performance",
				"cost_proposal",
			])
		);

		const executiveText = flattenText(getDatacraftProposalDocumentContent("executive_summary"));
		expect(executiveText).toContain("sovereign institutional operating system");
		expect(executiveText).toContain("production footprint");

		const technicalSections = getDatacraftProposalSectionSeeds("technical_approach");
		expect(technicalSections.map((section) => section.sectionName)).toEqual(
			expect.arrayContaining([
				"Unified Data Spine",
				"Workflow-First Delivery",
				"AI With Evidence Discipline",
			])
		);
	});
});
