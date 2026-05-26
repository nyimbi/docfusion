import {
	DATACRAFT_RESPONSE_SNIPPETS,
	getDatacraftProposalDocumentContent,
	getDatacraftProposalSectionSeeds,
	type DatacraftResponseSnippetInput,
} from "@/lib/data/datacraft-response-content";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import type { DocumentContent } from "@/lib/types/document";
import type { ProposalDocumentType } from "@/lib/types/opportunity";
import { getDocumentTypeLabel } from "@/lib/utils/proposal-labels";

export const LIVE_RESPONSE_DOCUMENT_TYPES: ProposalDocumentType[] = [
	"cover_letter",
	"executive_summary",
	"technical_approach",
	"management_plan",
	"past_performance",
	"cost_proposal",
];

const RESPONSE_RELEVANCE_TERMS = [
	"api",
	"architecture",
	"compliance",
	"consultancy",
	"data",
	"delivery",
	"goaml",
	"governance",
	"integration",
	"penetration",
	"quality",
	"risk",
	"security",
	"software",
	"testing",
	"web application",
];

export interface LiveResponseRequirementSignal {
	id: string;
	text: string;
	sourceSection?: string;
	priority: "mandatory" | "preferred" | "administrative";
	documentType: ProposalDocumentType;
	responseStrategy: string;
}

export interface LiveResponseDraftDocument {
	documentType: ProposalDocumentType;
	title: string;
	markdown: string;
	wordCount: number;
	sectionSeedCount: number;
	requirementIds: string[];
	relevantSnippetShortcuts: string[];
}

export interface LiveResponsePackage {
	opportunityTitle: string;
	clientName: string;
	solicitationNumber?: string;
	generatedAt: string;
	requirements: LiveResponseRequirementSignal[];
	documents: LiveResponseDraftDocument[];
	totalWordCount: number;
	relevantSnippetCount: number;
	relevantSnippetShortcuts: string[];
}

export function buildLiveResponsePackage(input: {
	opportunity: OpportunityData;
	sourceText: string;
	generatedAt?: Date;
	documentTypes?: ProposalDocumentType[];
}): LiveResponsePackage {
	const documentTypes = input.documentTypes ?? LIVE_RESPONSE_DOCUMENT_TYPES;
	const generatedAt = input.generatedAt ?? new Date();
	const clientName = input.opportunity.organization ?? "Procuring Entity";
	const requirements = extractLiveResponseRequirementSignals(input.sourceText);
	const relevantSnippets = selectLiveResponseSnippets(input.opportunity, input.sourceText);
	const sharedValues = {
		client_name: clientName,
		opportunity_name: input.opportunity.title,
		solicitation_number: input.opportunity.sourceId ?? input.opportunity.noticeId ?? "",
		submission_date: deadlineLabel(input.opportunity.deadline) ?? generatedAt.toISOString().slice(0, 10),
	};

	const documents = documentTypes.map((documentType) => {
		const seedText = renderPlaceholders(
			flattenContent(getDatacraftProposalDocumentContent(documentType)),
			sharedValues
		);
		const assignedRequirements = requirementsForDocumentType(requirements, documentType);
		const snippets = snippetsForDocumentType(relevantSnippets, documentType);
		const markdown = buildDocumentMarkdown({
			documentType,
			seedText,
			opportunity: input.opportunity,
			clientName,
			requirements: assignedRequirements,
			snippets,
			generatedAt,
		});

		return {
			documentType,
			title: `${getDocumentTypeLabel(documentType)} - ${input.opportunity.title}`,
			markdown,
			wordCount: countWords(markdown),
			sectionSeedCount: getDatacraftProposalSectionSeeds(documentType).length,
			requirementIds: assignedRequirements.map((requirement) => requirement.id),
			relevantSnippetShortcuts: snippets.map((snippet) => snippet.shortcut),
		};
	});

	for (const document of documents) {
		if (document.wordCount < 250) {
			throw new Error(`${document.documentType} live response draft is too thin: ${document.wordCount} words`);
		}
		if (/\{\{(?:client_name|opportunity_name)\}\}/.test(document.markdown)) {
			throw new Error(`${document.documentType} live response draft still contains required placeholders`);
		}
	}

	return {
		opportunityTitle: input.opportunity.title,
		clientName,
		solicitationNumber: input.opportunity.sourceId ?? input.opportunity.noticeId,
		generatedAt: generatedAt.toISOString(),
		requirements,
		documents,
		totalWordCount: documents.reduce((total, document) => total + document.wordCount, 0),
		relevantSnippetCount: relevantSnippets.length,
		relevantSnippetShortcuts: relevantSnippets.map((snippet) => snippet.shortcut),
	};
}

export function extractLiveResponseRequirementSignals(sourceText: string): LiveResponseRequirementSignal[] {
	const lines = sourceText.split(/\r?\n/);
	const requirements: LiveResponseRequirementSignal[] = [];
	let sourceSection = "Source Document";

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+/g, " ").trim();
		if (!line) continue;

		if (isLikelyHeading(line)) {
			sourceSection = stripMarkdownHeading(line);
			continue;
		}

		if (!isRequirementLine(line)) continue;

		const text = line.replace(/^(?:[-*]|\d+(?:\.\d+)*[.)]|[a-z][.)])\s+/i, "").trim();
		if (text.length < 30) continue;

		const documentType = documentTypeForRequirementText(text);
		const priority = /\b(shall|must|required|mandatory|request|submit|provide)\b/i.test(text)
			? "mandatory"
			: /\b(should|preferred|encouraged)\b/i.test(text)
				? "preferred"
				: "administrative";

		requirements.push({
			id: `LIVE-REQ-${String(requirements.length + 1).padStart(3, "0")}`,
			text: compactText(text, 380),
			sourceSection,
			priority,
			documentType,
			responseStrategy: responseStrategyFor(documentType, text),
		});
		if (requirements.length >= 24) break;
	}

	if (requirements.length === 0) {
		const fallback = sourceText.replace(/\s+/g, " ").trim();
		if (fallback.length >= 120) {
			requirements.push({
				id: "LIVE-REQ-001",
				text: compactText(fallback, 380),
				sourceSection: "Source Document",
				priority: "mandatory",
				documentType: "technical_approach",
				responseStrategy: responseStrategyFor("technical_approach", fallback),
			});
		}
	}

	return requirements;
}

export function selectLiveResponseSnippets(
	opportunity: OpportunityData,
	sourceText: string
): DatacraftResponseSnippetInput[] {
	const opportunityText = `${opportunity.title} ${opportunity.projectSummary ?? ""} ${sourceText}`.toLowerCase();
	const matching = DATACRAFT_RESPONSE_SNIPPETS.filter((snippet) => {
		const snippetText = [
			snippet.name,
			snippet.description,
			snippet.topicCategory,
			...snippet.tags,
			...snippet.technologies,
			...snippet.keyTerms,
		].join(" ").toLowerCase();
		return RESPONSE_RELEVANCE_TERMS.some((term) => opportunityText.includes(term) || snippetText.includes(term));
	});

	return matching.length >= 12 ? matching : DATACRAFT_RESPONSE_SNIPPETS.slice(0, 12);
}

export function flattenContent(content: DocumentContent): string {
	return flattenUnknown(content);
}

function buildDocumentMarkdown(input: {
	documentType: ProposalDocumentType;
	seedText: string;
	opportunity: OpportunityData;
	clientName: string;
	requirements: LiveResponseRequirementSignal[];
	snippets: DatacraftResponseSnippetInput[];
	generatedAt: Date;
}): string {
	const label = getDocumentTypeLabel(input.documentType);
	const requirementLines = input.requirements.length > 0
		? input.requirements.map((requirement) =>
			`- ${requirement.id} (${requirement.priority}, ${requirement.sourceSection ?? "source"}): ${requirement.text} Response plan: ${requirement.responseStrategy}`
		)
		: ["- No source requirement was assigned to this document type; review the source extraction before final approval."];
	const snippetLines = input.snippets.slice(0, 8).map((snippet) =>
		`- ${snippet.shortcut}: ${snippet.name} (${snippet.topicCategory})`
	);
	const opportunityContext = [
		`Client: ${input.clientName}`,
		`Opportunity: ${input.opportunity.title}`,
		input.opportunity.sourceId ? `Solicitation: ${input.opportunity.sourceId}` : null,
		input.opportunity.deadline ? `Deadline: ${deadlineLabel(input.opportunity.deadline)}` : null,
		input.opportunity.portalUrl ? `Portal: ${input.opportunity.portalUrl}` : null,
	].filter((value): value is string => Boolean(value));

	return [
		`# ${label}`,
		"",
		"## Opportunity Context",
		...opportunityContext.map((line) => `- ${line}`),
		`- Generated: ${input.generatedAt.toISOString()}`,
		"",
		"## Datacraft Base Response",
		input.seedText,
		"",
		"## Source-Driven Response Plan",
		...requirementLines,
		"",
		"## Datacraft Evidence To Weave In",
		...snippetLines,
		"",
		"## Review Gates",
		"- Replace generic claims with direct source references before final submission.",
		"- Confirm every mandatory source requirement is mapped to a compliance matrix row.",
		"- Confirm pricing, assumptions, exclusions, and evidence citations are approved before rendering final artifacts.",
		"",
	].join("\n");
}

function requirementsForDocumentType(
	requirements: LiveResponseRequirementSignal[],
	documentType: ProposalDocumentType
): LiveResponseRequirementSignal[] {
	const direct = requirements.filter((requirement) => requirement.documentType === documentType);
	if (documentType === "cover_letter" || documentType === "executive_summary") {
		return [...direct, ...requirements.filter((requirement) => requirement.priority === "mandatory")]
			.slice(0, 8);
	}
	return direct.slice(0, 8);
}

function snippetsForDocumentType(
	snippets: DatacraftResponseSnippetInput[],
	documentType: ProposalDocumentType
): DatacraftResponseSnippetInput[] {
	const label = getDocumentTypeLabel(documentType).toLowerCase();
	const direct = snippets.filter((snippet) => {
		const haystack = `${snippet.name} ${snippet.description} ${snippet.topicCategory} ${snippet.tags.join(" ")}`.toLowerCase();
		return haystack.includes(label.split(" ")[0]) || haystack.includes(documentType.replace(/_/g, " "));
	});
	return (direct.length >= 4 ? direct : snippets).slice(0, 8);
}

function documentTypeForRequirementText(text: string): ProposalDocumentType {
	const lower = text.toLowerCase();
	if (/\b(cost|price|pricing|commercial|financial|fee|budget)\b/.test(lower)) return "cost_proposal";
	if (/\b(past performance|experience|reference|similar assignment|qualification)\b/.test(lower)) return "past_performance";
	if (/\b(management|schedule|work plan|project plan|risk|governance|consultancy)\b/.test(lower)) return "management_plan";
	if (/\b(submit|submission|deadline|eoi|cover|letter|expression of interest)\b/.test(lower)) return "cover_letter";
	return "technical_approach";
}

function responseStrategyFor(documentType: ProposalDocumentType, text: string): string {
	const topic = compactText(text, 140);
	switch (documentType) {
		case "cost_proposal":
			return `Provide transparent pricing assumptions, exclusions, and value logic for ${topic}.`;
		case "past_performance":
			return `Map Lindela, MeGuard, and Wakala proof points to evaluator risk reduction for ${topic}.`;
		case "management_plan":
			return `Show governance, staffing, schedule control, review gates, and escalation paths for ${topic}.`;
		case "cover_letter":
			return `Use the transmittal to confirm compliance intent, submission discipline, and buyer-specific understanding for ${topic}.`;
		case "executive_summary":
			return `Summarize the client outcome, Datacraft differentiators, risk controls, and evidence chain for ${topic}.`;
		default:
			return `Describe the technical architecture, security controls, integration approach, and acceptance evidence for ${topic}.`;
	}
}

function isLikelyHeading(line: string): boolean {
	return /^#{1,4}\s+\S/.test(line) ||
		(/^[A-Z][A-Z0-9 /&().,-]{8,}$/.test(line) && line.length < 120);
}

function stripMarkdownHeading(line: string): string {
	return line.replace(/^#{1,4}\s+/, "").trim();
}

function isRequirementLine(line: string): boolean {
	return /\b(shall|must|required|requires|mandatory|should|preferred|submit|provide|request|invited|deadline|expression of interest|eoi|proposal|tender)\b/i.test(line) ||
		/^(?:[-*]|\d+(?:\.\d+)*[.)]|[a-z][.)])\s+.{20,}$/.test(line);
}

function renderPlaceholders(text: string, values: Record<string, string>): string {
	return Object.entries(values).reduce(
		(rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
		text
	);
}

function flattenUnknown(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(flattenUnknown).join(" ");
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return [record.text, record.content].map(flattenUnknown).join(" ");
	}
	return "";
}

function deadlineLabel(value: OpportunityData["deadline"]): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function compactText(text: string, maxLength: number): string {
	const compacted = text.replace(/\s+/g, " ").trim();
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}
