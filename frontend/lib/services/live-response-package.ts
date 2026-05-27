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

export interface LiveResponseEvaluationSignal {
	id: string;
	text: string;
	sourceSection?: string;
	weight?: string;
	documentType: ProposalDocumentType;
	responseStrategy: string;
}

export interface LiveResponseWinThemeSeed {
	id: string;
	statement: string;
	shortVersion: string;
	type: "value_prop" | "differentiator" | "proof_point" | "risk_mitigation";
	priority: 1 | 2 | 3 | 4 | 5;
	evaluationCriteriaIds: string[];
	requirementIds: string[];
	targetDocumentTypes: ProposalDocumentType[];
	supportingEvidence: string[];
	keywords: string[];
	rationale: string;
}

export interface LiveResponseDraftDocument {
	documentType: ProposalDocumentType;
	title: string;
	markdown: string;
	wordCount: number;
	sectionSeedCount: number;
	requirementIds: string[];
	evaluationCriteriaIds: string[];
	relevantSnippetShortcuts: string[];
}

export interface LiveResponsePackage {
	opportunityTitle: string;
	clientName: string;
	solicitationNumber?: string;
	generatedAt: string;
	requirements: LiveResponseRequirementSignal[];
	evaluationCriteria: LiveResponseEvaluationSignal[];
	winThemeSeeds: LiveResponseWinThemeSeed[];
	documents: LiveResponseDraftDocument[];
	totalWordCount: number;
	relevantSnippetCount: number;
	relevantSnippetShortcuts: string[];
	readiness: LiveResponseReadinessAssessment;
}

export interface LiveResponseReadinessAssessment {
	status: "ready_for_review" | "blocked";
	blockers: string[];
	warnings: string[];
	evaluationCriteriaIds: string[];
	draftCoveredEvaluationCriteriaIds: string[];
	winThemeCoveredEvaluationCriteriaIds: string[];
	missingDraftEvaluationCriteriaIds: string[];
	missingWinThemeEvaluationCriteriaIds: string[];
	metrics: {
		documentTypeCoverage: number;
		sourceRequirementCoverage: number;
		mandatoryRequirementCoverage: number;
		evaluationCriteriaCoverage: number;
		winThemeCriteriaCoverage: number;
		evidenceCueCoverage: number;
		reviewGateCoverage: number;
		unresolvedPlaceholderCount: number;
		minDocumentWordCount: number;
		totalDraftWordCount: number;
		relevantSnippetCount: number;
		winThemeSeedCount: number;
	};
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
	const evaluationCriteria = extractLiveResponseEvaluationSignals(input.sourceText);
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
		const assignedEvaluationCriteria = evaluationCriteriaForDocumentType(evaluationCriteria, documentType);
		const snippets = snippetsForDocumentType(relevantSnippets, documentType);
		const markdown = buildDocumentMarkdown({
			documentType,
			seedText,
			opportunity: input.opportunity,
			clientName,
			requirements: assignedRequirements,
			evaluationCriteria: assignedEvaluationCriteria,
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
			evaluationCriteriaIds: assignedEvaluationCriteria.map((criterion) => criterion.id),
			relevantSnippetShortcuts: snippets.map((snippet) => snippet.shortcut),
		};
	});
	const winThemeSeeds = buildLiveResponseWinThemeSeeds({
		opportunity: input.opportunity,
		requirements,
		evaluationCriteria,
		documents,
		relevantSnippetShortcuts: relevantSnippets.map((snippet) => snippet.shortcut),
	});

	for (const document of documents) {
		if (document.wordCount < 250) {
			throw new Error(`${document.documentType} live response draft is too thin: ${document.wordCount} words`);
		}
		if (/\{\{[^}]+\}\}/.test(document.markdown)) {
			throw new Error(`${document.documentType} live response draft still contains unresolved placeholders`);
		}
	}

	const responsePackage = {
		opportunityTitle: input.opportunity.title,
		clientName,
		solicitationNumber: input.opportunity.sourceId ?? input.opportunity.noticeId,
		generatedAt: generatedAt.toISOString(),
		requirements,
		evaluationCriteria,
		winThemeSeeds,
		documents,
		totalWordCount: documents.reduce((total, document) => total + document.wordCount, 0),
		relevantSnippetCount: relevantSnippets.length,
		relevantSnippetShortcuts: relevantSnippets.map((snippet) => snippet.shortcut),
		readiness: emptyReadinessAssessment(),
	};
	return {
		...responsePackage,
		readiness: assessLiveResponsePackageReadiness(responsePackage),
	};
}

export function assessLiveResponsePackageReadiness(
	responsePackage: Omit<LiveResponsePackage, "readiness"> | LiveResponsePackage
): LiveResponseReadinessAssessment {
	const blockers: string[] = [];
	const warnings: string[] = [];
	const documentTypes = new Set(responsePackage.documents.map((document) => document.documentType));
	const missingDocumentTypes = LIVE_RESPONSE_DOCUMENT_TYPES.filter((type) => !documentTypes.has(type));
	const assignedRequirementIds = new Set(responsePackage.documents.flatMap((document) => document.requirementIds));
	const assignedEvaluationCriteriaIds = new Set(responsePackage.documents.flatMap((document) => document.evaluationCriteriaIds));
	const winThemeEvaluationCriteriaIds = new Set(responsePackage.winThemeSeeds.flatMap((seed) => seed.evaluationCriteriaIds));
	const requirementIds = responsePackage.requirements.map((requirement) => requirement.id);
	const evaluationCriteriaIds = responsePackage.evaluationCriteria.map((criterion) => criterion.id);
	const mandatoryRequirementIds = responsePackage.requirements
		.filter((requirement) => requirement.priority === "mandatory")
		.map((requirement) => requirement.id);
	const coveredRequirementCount = requirementIds.filter((id) => assignedRequirementIds.has(id)).length;
	const coveredEvaluationCriteriaCount = evaluationCriteriaIds.filter((id) => assignedEvaluationCriteriaIds.has(id)).length;
	const winThemeCoveredEvaluationCriteriaCount = evaluationCriteriaIds.filter((id) => winThemeEvaluationCriteriaIds.has(id)).length;
	const draftCoveredEvaluationCriteriaIds = evaluationCriteriaIds.filter((id) => assignedEvaluationCriteriaIds.has(id));
	const winThemeCoveredEvaluationCriteriaIds = evaluationCriteriaIds.filter((id) => winThemeEvaluationCriteriaIds.has(id));
	const missingDraftEvaluationCriteriaIds = evaluationCriteriaIds.filter((id) => !assignedEvaluationCriteriaIds.has(id));
	const missingWinThemeEvaluationCriteriaIds = evaluationCriteriaIds.filter((id) => !winThemeEvaluationCriteriaIds.has(id));
	const coveredMandatoryRequirementCount = mandatoryRequirementIds.filter((id) => assignedRequirementIds.has(id)).length;
	const documentsWithEvidence = responsePackage.documents.filter((document) => document.relevantSnippetShortcuts.length > 0).length;
	const documentsWithReviewGates = responsePackage.documents.filter((document) => document.markdown.includes("## Review Gates")).length;
	const unresolvedPlaceholderCount = responsePackage.documents.reduce(
		(total, document) => total + (document.markdown.match(/\{\{[^}]+\}\}/g)?.length ?? 0),
		0
	);
	const minDocumentWordCount = responsePackage.documents.length > 0
		? Math.min(...responsePackage.documents.map((document) => document.wordCount))
		: 0;
	const metrics = {
		documentTypeCoverage: ratio(LIVE_RESPONSE_DOCUMENT_TYPES.length - missingDocumentTypes.length, LIVE_RESPONSE_DOCUMENT_TYPES.length),
		sourceRequirementCoverage: ratio(coveredRequirementCount, requirementIds.length),
		mandatoryRequirementCoverage: ratio(coveredMandatoryRequirementCount, mandatoryRequirementIds.length),
		evaluationCriteriaCoverage: ratio(coveredEvaluationCriteriaCount, evaluationCriteriaIds.length),
		winThemeCriteriaCoverage: ratio(winThemeCoveredEvaluationCriteriaCount, evaluationCriteriaIds.length),
		evidenceCueCoverage: ratio(documentsWithEvidence, responsePackage.documents.length),
		reviewGateCoverage: ratio(documentsWithReviewGates, responsePackage.documents.length),
		unresolvedPlaceholderCount,
		minDocumentWordCount,
		totalDraftWordCount: responsePackage.totalWordCount,
		relevantSnippetCount: responsePackage.relevantSnippetCount,
		winThemeSeedCount: responsePackage.winThemeSeeds.length,
	};

	if (missingDocumentTypes.length > 0) {
		blockers.push(`Missing required response document types: ${missingDocumentTypes.join(", ")}`);
	}
	if (responsePackage.requirements.length === 0) {
		blockers.push("No source requirement signals were extracted from the solicitation text");
	}
	if (metrics.sourceRequirementCoverage < 1) {
		blockers.push(`Only ${coveredRequirementCount}/${requirementIds.length} source requirement signals are represented in draft documents`);
	}
	if (metrics.mandatoryRequirementCoverage < 1) {
		blockers.push(`Only ${coveredMandatoryRequirementCount}/${mandatoryRequirementIds.length} mandatory source requirement signals are represented in draft documents`);
	}
	if (responsePackage.evaluationCriteria.length > 0 && metrics.evaluationCriteriaCoverage < 1) {
		blockers.push(`Only ${coveredEvaluationCriteriaCount}/${evaluationCriteriaIds.length} evaluator criteria are represented in draft documents`);
	}
	if (responsePackage.evaluationCriteria.length > 0 && metrics.winThemeCriteriaCoverage < 1) {
		blockers.push(`Only ${winThemeCoveredEvaluationCriteriaCount}/${evaluationCriteriaIds.length} evaluator criteria are represented in win theme seeds`);
	}
	if (responsePackage.requirements.length > 0 && responsePackage.winThemeSeeds.length === 0) {
		blockers.push("No win theme seeds were generated from the response package");
	}
	if (unresolvedPlaceholderCount > 0) {
		blockers.push(`${unresolvedPlaceholderCount} unresolved template placeholder(s) remain in draft documents`);
	}
	if (minDocumentWordCount < 250) {
		blockers.push(`At least one response draft is below the 250-word minimum (${minDocumentWordCount} words)`);
	}
	if (responsePackage.relevantSnippetCount < 10) {
		blockers.push(`Only ${responsePackage.relevantSnippetCount} relevant Datacraft evidence snippets matched the opportunity`);
	}
	if (metrics.evidenceCueCoverage < 1) {
		blockers.push("At least one response draft has no Datacraft evidence cues");
	}
	if (metrics.reviewGateCoverage < 1) {
		blockers.push("At least one response draft is missing review gates");
	}

	for (const document of responsePackage.documents) {
		if (document.requirementIds.length === 0) {
			warnings.push(`${document.documentType} has no directly assigned source requirement signal`);
		}
		if (responsePackage.evaluationCriteria.length > 0 && document.evaluationCriteriaIds.length === 0) {
			warnings.push(`${document.documentType} has no evaluator criteria alignment`);
		}
		if (document.relevantSnippetShortcuts.length < 3) {
			warnings.push(`${document.documentType} has fewer than three Datacraft evidence cues`);
		}
	}
	if (responsePackage.evaluationCriteria.length === 0) {
		warnings.push("No explicit evaluator scoring criteria were extracted from the source text");
	}

	return {
		status: blockers.length === 0 ? "ready_for_review" : "blocked",
		blockers,
		warnings,
		evaluationCriteriaIds,
		draftCoveredEvaluationCriteriaIds,
		winThemeCoveredEvaluationCriteriaIds,
		missingDraftEvaluationCriteriaIds,
		missingWinThemeEvaluationCriteriaIds,
		metrics,
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

export function extractLiveResponseEvaluationSignals(sourceText: string): LiveResponseEvaluationSignal[] {
	const lines = sourceText.split(/\r?\n/);
	const criteria: LiveResponseEvaluationSignal[] = [];
	let sourceSection = "Source Document";

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+/g, " ").trim();
		if (!line) continue;

		if (isLikelyHeading(line)) {
			sourceSection = stripMarkdownHeading(line);
			continue;
		}
		if (!isEvaluationCriteriaLine(line, sourceSection)) continue;

		const text = line.replace(/^(?:[-*]|\d+(?:\.\d+)*[.)]|[a-z][.)])\s+/i, "").trim();
		if (text.length < 25) continue;

		const documentType = documentTypeForRequirementText(text);
		criteria.push({
			id: `LIVE-EVAL-${String(criteria.length + 1).padStart(3, "0")}`,
			text: compactText(text, 360),
			sourceSection,
			weight: extractEvaluationWeight(text),
			documentType,
			responseStrategy: evaluationStrategyFor(documentType, text),
		});
		if (criteria.length >= 16) break;
	}

	return criteria;
}

export function buildLiveResponseWinThemeSeeds(input: {
	opportunity: OpportunityData;
	requirements: LiveResponseRequirementSignal[];
	evaluationCriteria: LiveResponseEvaluationSignal[];
	documents?: LiveResponseDraftDocument[];
	relevantSnippetShortcuts?: string[];
}): LiveResponseWinThemeSeed[] {
	const seeds: LiveResponseWinThemeSeed[] = [];
	const mandatoryRequirements = input.requirements.filter((requirement) => requirement.priority === "mandatory");
	const requirementFallback = mandatoryRequirements.length > 0 ? mandatoryRequirements : input.requirements;
	const sortedCriteria = [...input.evaluationCriteria].sort((left, right) =>
		numericEvaluationWeight(right.weight) - numericEvaluationWeight(left.weight)
	);

	for (const criterion of sortedCriteria) {
		const relatedRequirements = input.requirements
			.filter((requirement) => requirement.documentType === criterion.documentType)
			.slice(0, 3);
		const requirementAnchors = relatedRequirements.length > 0
			? relatedRequirements
			: requirementFallback.slice(0, 2);
		const targetDocumentTypes = uniqueProposalDocumentTypes([
			criterion.documentType,
			...(input.documents ?? [])
				.filter((document) => document.evaluationCriteriaIds.includes(criterion.id))
				.map((document) => document.documentType),
		]).slice(0, 4);
		const statement = compactText(
			`Datacraft will win ${criterion.text} by turning ${getDocumentTypeLabel(criterion.documentType).toLowerCase()} into measurable delivery proof, risk control, and buyer-specific value.`,
			280
		);

		seeds.push({
			id: `LIVE-WIN-${String(seeds.length + 1).padStart(3, "0")}`,
			statement,
			shortVersion: compactText(statement, 96),
			type: winThemeTypeForDocumentType(criterion.documentType),
			priority: winThemePriorityForIndex(seeds.length),
			evaluationCriteriaIds: [criterion.id],
			requirementIds: requirementAnchors.map((requirement) => requirement.id),
			targetDocumentTypes,
			supportingEvidence: uniqueStrings([
				`Evaluator criterion ${criterion.id}: ${criterion.text}`,
				...requirementAnchors.map((requirement) => `Requirement ${requirement.id}: ${requirement.text}`),
				...(input.relevantSnippetShortcuts?.slice(0, 4).map((shortcut) => `Datacraft evidence shortcut: ${shortcut}`) ?? []),
			]).slice(0, 8),
			keywords: keywordsForWinTheme(`${criterion.text} ${criterion.responseStrategy}`),
			rationale: criterion.responseStrategy,
		});
		if (seeds.length >= 8) break;
	}

	if (seeds.length === 0) {
		for (const requirement of uniqueRequirementsByDocumentType(requirementFallback).slice(0, 4)) {
			const statement = compactText(
				`Datacraft reduces buyer risk for ${requirement.text} through a documented ${getDocumentTypeLabel(requirement.documentType).toLowerCase()} response backed by delivery evidence.`,
				280
			);
			seeds.push({
				id: `LIVE-WIN-${String(seeds.length + 1).padStart(3, "0")}`,
				statement,
				shortVersion: compactText(statement, 96),
				type: winThemeTypeForDocumentType(requirement.documentType),
				priority: winThemePriorityForIndex(seeds.length),
				evaluationCriteriaIds: [],
				requirementIds: [requirement.id],
				targetDocumentTypes: [requirement.documentType],
				supportingEvidence: uniqueStrings([
					`Requirement ${requirement.id}: ${requirement.text}`,
					...(input.relevantSnippetShortcuts?.slice(0, 4).map((shortcut) => `Datacraft evidence shortcut: ${shortcut}`) ?? []),
				]).slice(0, 6),
				keywords: keywordsForWinTheme(`${requirement.text} ${requirement.responseStrategy}`),
				rationale: requirement.responseStrategy,
			});
		}
	}

	return seeds;
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
	evaluationCriteria: LiveResponseEvaluationSignal[];
	snippets: DatacraftResponseSnippetInput[];
	generatedAt: Date;
}): string {
	const label = getDocumentTypeLabel(input.documentType);
	const requirementLines = input.requirements.length > 0
		? input.requirements.map((requirement) =>
			`- ${requirement.id} (${requirement.priority}, ${requirement.sourceSection ?? "source"}): ${requirement.text} Response plan: ${requirement.responseStrategy}`
		)
		: ["- No source requirement was assigned to this document type; review the source extraction before final approval."];
	const evaluationLines = input.evaluationCriteria.length > 0
		? input.evaluationCriteria.map((criterion) => {
			const weight = criterion.weight ? `, ${criterion.weight}` : "";
			return `- ${criterion.id} (${criterion.sourceSection ?? "source"}${weight}): ${criterion.text} Win response: ${criterion.responseStrategy}`;
		})
		: ["- No explicit evaluator or scoring criterion was assigned to this document type; validate evaluator criteria before final approval."];
	const sourceCitationLines = buildSourceCitationLines(input.requirements, input.evaluationCriteria);
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
		"## Evaluator Alignment Plan",
		...evaluationLines,
		"",
		"## Source Citation Map",
		...sourceCitationLines,
		"",
		"## Datacraft Evidence To Weave In",
		...snippetLines,
		"",
		"## Review Gates",
		"- Verify every Source Citation Map item is reflected in the final compliance matrix and response narrative.",
		"- Confirm every mandatory source requirement is mapped to a compliance matrix row.",
		"- Confirm every explicit evaluator criterion is mapped to a win theme, proof point, and response section.",
		"- Confirm pricing, assumptions, exclusions, and evidence citations are approved before rendering final artifacts.",
		"",
	].join("\n");
}

function buildSourceCitationLines(
	requirements: LiveResponseRequirementSignal[],
	evaluationCriteria: LiveResponseEvaluationSignal[]
): string[] {
	const lines = [
		...requirements.map((requirement) =>
			`- Source requirement ${requirement.id} from ${requirement.sourceSection ?? "source document"}: "${compactText(requirement.text, 220)}"`
		),
		...evaluationCriteria.map((criterion) => {
			const weight = criterion.weight ? ` (${criterion.weight})` : "";
			return `- Evaluator criterion ${criterion.id} from ${criterion.sourceSection ?? "source document"}${weight}: "${compactText(criterion.text, 220)}"`;
		}),
	];

	return lines.length > 0
		? lines
		: ["- No source citations were extracted for this draft; refresh source parsing before final submission."];
}

function requirementsForDocumentType(
	requirements: LiveResponseRequirementSignal[],
	documentType: ProposalDocumentType
): LiveResponseRequirementSignal[] {
	const direct = requirements.filter((requirement) => requirement.documentType === documentType);
	if (documentType === "cover_letter" || documentType === "executive_summary") {
		return adaptRequirementsForDocumentType(uniqueRequirementSignals([
			...direct,
			...requirements.filter((requirement) => requirement.priority === "mandatory"),
		]).slice(0, 8), documentType);
	}

	if (direct.length > 0) return direct.slice(0, 8);

	const mandatory = requirements.filter((requirement) => requirement.priority === "mandatory");
	const sourceAnchors = mandatory.length > 0 ? mandatory : requirements;
	return adaptRequirementsForDocumentType(sourceAnchors.slice(0, 3), documentType);
}

function adaptRequirementsForDocumentType(
	requirements: LiveResponseRequirementSignal[],
	documentType: ProposalDocumentType
): LiveResponseRequirementSignal[] {
	return requirements.map((requirement) => {
		if (requirement.documentType === documentType) return requirement;
		return {
			...requirement,
			documentType,
			responseStrategy: responseStrategyFor(documentType, requirement.text),
		};
	});
}

function evaluationCriteriaForDocumentType(
	criteria: LiveResponseEvaluationSignal[],
	documentType: ProposalDocumentType
): LiveResponseEvaluationSignal[] {
	const direct = criteria.filter((criterion) => criterion.documentType === documentType);
	if (documentType === "cover_letter" || documentType === "executive_summary") {
		return adaptEvaluationCriteriaForDocumentType(uniqueEvaluationSignals([
			...direct,
			...criteria,
		]).slice(0, 8), documentType);
	}

	if (direct.length > 0) return direct.slice(0, 8);
	return adaptEvaluationCriteriaForDocumentType(criteria.slice(0, 3), documentType);
}

function adaptEvaluationCriteriaForDocumentType(
	criteria: LiveResponseEvaluationSignal[],
	documentType: ProposalDocumentType
): LiveResponseEvaluationSignal[] {
	return criteria.map((criterion) => {
		if (criterion.documentType === documentType) return criterion;
		return {
			...criterion,
			documentType,
			responseStrategy: evaluationStrategyFor(documentType, criterion.text),
		};
	});
}

function uniqueEvaluationSignals(criteria: LiveResponseEvaluationSignal[]): LiveResponseEvaluationSignal[] {
	const seen = new Set<string>();
	return criteria.filter((criterion) => {
		if (seen.has(criterion.id)) return false;
		seen.add(criterion.id);
		return true;
	});
}

function uniqueRequirementSignals(requirements: LiveResponseRequirementSignal[]): LiveResponseRequirementSignal[] {
	const seen = new Set<string>();
	return requirements.filter((requirement) => {
		if (seen.has(requirement.id)) return false;
		seen.add(requirement.id);
		return true;
	});
}

function uniqueRequirementsByDocumentType(requirements: LiveResponseRequirementSignal[]): LiveResponseRequirementSignal[] {
	const seen = new Set<ProposalDocumentType>();
	return requirements.filter((requirement) => {
		if (seen.has(requirement.documentType)) return false;
		seen.add(requirement.documentType);
		return true;
	});
}

function uniqueProposalDocumentTypes(documentTypes: ProposalDocumentType[]): ProposalDocumentType[] {
	const seen = new Set<ProposalDocumentType>();
	return documentTypes.filter((documentType) => {
		if (seen.has(documentType)) return false;
		seen.add(documentType);
		return true;
	});
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = value.trim();
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
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

function evaluationStrategyFor(documentType: ProposalDocumentType, text: string): string {
	const topic = compactText(text, 140);
	switch (documentType) {
		case "cost_proposal":
			return `Show price realism, assumption control, and value evidence that protect the score for ${topic}.`;
		case "past_performance":
			return `Convert comparable Lindela, MeGuard, and Wakala work into evaluator confidence for ${topic}.`;
		case "management_plan":
			return `Tie staffing, governance, schedule control, and quality checks directly to the scoring language for ${topic}.`;
		case "cover_letter":
			return `Signal compliance, buyer understanding, and score-aware executive intent for ${topic}.`;
		case "executive_summary":
			return `Turn the criterion into a clear win theme with named proof points and client outcomes for ${topic}.`;
		default:
			return `Map the technical approach, acceptance evidence, security controls, and delivery proof to the score for ${topic}.`;
	}
}

function winThemeTypeForDocumentType(documentType: ProposalDocumentType): LiveResponseWinThemeSeed["type"] {
	switch (documentType) {
		case "cost_proposal":
			return "value_prop";
		case "past_performance":
			return "proof_point";
		case "management_plan":
			return "risk_mitigation";
		default:
			return "differentiator";
	}
}

function winThemePriorityForIndex(index: number): LiveResponseWinThemeSeed["priority"] {
	return Math.min(index + 1, 5) as LiveResponseWinThemeSeed["priority"];
}

function keywordsForWinTheme(text: string): string[] {
	const stopWords = new Set([
		"and",
		"are",
		"for",
		"from",
		"into",
		"that",
		"the",
		"this",
		"will",
		"with",
	]);
	const words = text
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, " ")
		.split(/\s+/)
		.filter((word) => word.length >= 4 && !stopWords.has(word));
	return uniqueStrings(words).slice(0, 12);
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

function isEvaluationCriteriaLine(line: string, sourceSection: string): boolean {
	const sectionSignalsEvaluation = /\b(evaluation|scoring|award|selection criteria|criteria|basis of award|methodology)\b/i.test(sourceSection);
	const hasEvaluationCue = /\b(evaluat(?:ed|ion)|score|scoring|points?|marks?|weight(?:ed|ing)?|criteria|criterion|basis of award|selection)\b/i.test(line);
	const hasWeight = /\b\d{1,3}(?:\.\d+)?\s*(?:%|percent|points?|marks?)\b/i.test(line);
	const hasEvaluationPhrase = /\b(?:will|shall|must)\s+be\s+evaluated\b/i.test(line) ||
		/\b(?:evaluation|selection)\s+criteria\b/i.test(line) ||
		/\bbasis\s+of\s+award\b/i.test(line);
	const isListItem = /^(?:[-*]|\d+(?:\.\d+)*[.)]|[a-z][.)])\s+.{20,}$/.test(line);

	return (hasEvaluationCue && (hasWeight || hasEvaluationPhrase)) ||
		(sectionSignalsEvaluation && isListItem && (hasEvaluationCue || hasWeight));
}

function extractEvaluationWeight(text: string): string | undefined {
	const match = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*(%|percent|points?|marks?)\b/i);
	if (!match) return undefined;
	const unit = match[2].toLowerCase() === "percent" ? "%" : match[2].toLowerCase();
	return `${match[1]} ${unit}`;
}

function numericEvaluationWeight(weight: string | undefined): number {
	if (!weight) return 0;
	const parsed = Number.parseFloat(weight);
	return Number.isFinite(parsed) ? parsed : 0;
}

function renderPlaceholders(text: string, values: Record<string, string>): string {
	return Object.entries(values).reduce(
		(rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
		text
	);
}

function emptyReadinessAssessment(): LiveResponseReadinessAssessment {
	return {
		status: "blocked",
		blockers: [],
		warnings: [],
		evaluationCriteriaIds: [],
		draftCoveredEvaluationCriteriaIds: [],
		winThemeCoveredEvaluationCriteriaIds: [],
		missingDraftEvaluationCriteriaIds: [],
		missingWinThemeEvaluationCriteriaIds: [],
		metrics: {
			documentTypeCoverage: 0,
			sourceRequirementCoverage: 0,
			mandatoryRequirementCoverage: 0,
			evaluationCriteriaCoverage: 0,
			winThemeCriteriaCoverage: 0,
			evidenceCueCoverage: 0,
			reviewGateCoverage: 0,
			unresolvedPlaceholderCount: 0,
			minDocumentWordCount: 0,
			totalDraftWordCount: 0,
			relevantSnippetCount: 0,
			winThemeSeedCount: 0,
		},
	};
}

function ratio(numerator: number, denominator: number): number {
	return denominator > 0 ? numerator / denominator : 1;
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
