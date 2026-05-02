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
		expect(DATACRAFT_RESPONSE_SNIPPETS.length).toBeGreaterThanOrEqual(35);

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
			])
		);

		const allText = DATACRAFT_RESPONSE_SNIPPETS.map((snippet) => flattenText(snippet.content)).join(" ");

		expect(allText).toContain("acceptance criteria");
		expect(allText).toContain("data governance");
		expect(allText).toMatch(/human control/i);
		expect(allText).toContain("service levels");
		expect(allText).toContain("total cost of ownership");
		expect(allText).toContain("knowledge transfer");
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
