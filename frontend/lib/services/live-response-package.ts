import { createHash } from "node:crypto";
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
	"apis",
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

const STRATEGIC_CAPABILITY_TERMS = [
	"api",
	"apis",
	"analytics",
	"architecture",
	"automation",
	"case management",
	"compliance",
	"data",
	"digital",
	"governance",
	"integration",
	"intelligence",
	"mobile",
	"monitoring",
	"payment",
	"platform",
	"records",
	"reporting",
	"security",
	"software",
	"system",
	"workflow",
];

const DELIVERY_CAPABILITY_TERMS = [
	"audit",
	"capacity building",
	"consultancy",
	"consultant",
	"implementation",
	"methodology",
	"project management",
	"quality assurance",
	"research",
	"risk",
	"survey",
	"technical assistance",
	"training",
];

const OPPORTUNITY_CONTEXT_TERMS = [
	"africa",
	"government",
	"institution",
	"procurement",
	"regional",
	"regulated",
	"sovereign",
	"united nations",
	"world bank",
];

const FIT_RISK_TERMS = [
	"catering",
	"cleaning",
	"construction",
	"food services",
	"food supply",
	"furniture",
	"insurance",
	"medical supplies",
	"pharmaceutical",
	"vehicle",
];

const SUPPLIER_REGISTRATION_PATTERNS = [
	/\bregistration\s+of\s+suppliers?\b/iu,
	/\bsupplier\s+registration\b/iu,
	/\bregister(?:ed|ing)?\s+(?:as\s+)?(?:a\s+)?suppliers?\b/iu,
	/\bregistration\s+for\s+goods,\s+services\s+and\s+works\b/iu,
];

const PREQUALIFICATION_PATTERNS = [
	/\bpre[-\s]?qualification\b/iu,
	/\binvitation\s+for\s+pre[-\s]?qualification\b/iu,
	/\bprequalif(?:y|ied|ication)\b/iu,
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
	artifact: LiveResponseDraftArtifact;
	wordCount: number;
	sectionSeedCount: number;
	requirementIds: string[];
	evaluationCriteriaIds: string[];
	relevantSnippetShortcuts: string[];
}

export interface LiveResponseDraftArtifact {
	format: "markdown";
	filename: string;
	contentHash: string;
	sizeBytes: number;
	generatedAt: string;
}

export interface LiveResponsePursuitFitAssessment {
	status: "strong_fit" | "review_required" | "weak_fit";
	score: number;
	pursuitRoute: "proposal_response" | "supplier_registration" | "prequalification";
	matchedCapabilities: string[];
	riskFactors: string[];
	recommendation: "pursue" | "review_before_pursuit" | "no_bid_unless_partnered";
	rationale: string;
}

export interface LiveSubmissionSchedule {
	deadlineIso?: string;
	deadlineLabel?: string;
	deadlineSource: "opportunity_metadata" | "source_text" | "not_found";
	daysUntilDeadline?: number;
	urgency: "expired" | "critical" | "urgent" | "normal" | "unknown";
	submissionMethod?: string;
	submissionRequirements: string[];
	evidenceSnippets: string[];
}

export interface LiveResponsePackage {
	opportunityTitle: string;
	clientName: string;
	solicitationNumber?: string;
	generatedAt: string;
	submissionSchedule: LiveSubmissionSchedule;
	requirements: LiveResponseRequirementSignal[];
	evaluationCriteria: LiveResponseEvaluationSignal[];
	winThemeSeeds: LiveResponseWinThemeSeed[];
	documents: LiveResponseDraftDocument[];
	totalWordCount: number;
	relevantSnippetCount: number;
	relevantSnippetShortcuts: string[];
	pursuitFit: LiveResponsePursuitFitAssessment;
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
		evidenceCitationCoverage: number;
		draftArtifactIntegrityCoverage: number;
		reviewGateCoverage: number;
		sourceCitationCoverage: number;
		unresolvedPlaceholderCount: number;
		minDocumentWordCount: number;
		totalDraftWordCount: number;
		relevantSnippetCount: number;
		winThemeSeedCount: number;
		pursuitFitScore: number;
	};
}

type QualificationPursuitRoute = Exclude<LiveResponsePursuitFitAssessment["pursuitRoute"], "proposal_response">;

export interface LiveQualificationChecklistItem {
	id: string;
	priority: "mandatory" | "review";
	text: string;
	ownerHint: "proposal_manager" | "compliance" | "technical_lead";
	sourceRequirementIds: string[];
}

export interface LiveQualificationPackage {
	pursuitRoute: QualificationPursuitRoute;
	title: string;
	summary: string;
	requiredArtifacts: string[];
	checklist: LiveQualificationChecklistItem[];
	operatorBriefMarkdown: string;
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
	const submissionSchedule = buildLiveSubmissionSchedule({
		opportunity: input.opportunity,
		sourceText: input.sourceText,
		generatedAt,
	});
	const pursuitFit = assessLiveResponsePursuitFit({
		opportunity: input.opportunity,
		sourceText: input.sourceText,
		relevantSnippetCount: relevantSnippets.length,
	});
	const sharedValues = {
		client_name: clientName,
		opportunity_name: input.opportunity.title,
		solicitation_number: input.opportunity.sourceId ?? input.opportunity.noticeId ?? "",
		submission_date: submissionSchedule.deadlineLabel ?? generatedAt.toISOString().slice(0, 10),
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
			submissionSchedule,
			generatedAt,
		});
		const title = `${getDocumentTypeLabel(documentType)} - ${input.opportunity.title}`;

		return {
			documentType,
			title,
			markdown,
			artifact: buildDraftArtifactManifest(documentType, markdown, generatedAt),
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
		submissionSchedule,
		requirements,
		evaluationCriteria,
		winThemeSeeds,
		documents,
		totalWordCount: documents.reduce((total, document) => total + document.wordCount, 0),
		relevantSnippetCount: relevantSnippets.length,
		relevantSnippetShortcuts: relevantSnippets.map((snippet) => snippet.shortcut),
		pursuitFit,
		readiness: emptyReadinessAssessment(),
	};
	return {
		...responsePackage,
		readiness: assessLiveResponsePackageReadiness(responsePackage),
	};
}

export function buildLiveQualificationPackage(responsePackage: LiveResponsePackage): LiveQualificationPackage | undefined {
	const pursuitRoute = responsePackage.pursuitFit.pursuitRoute;
	if (pursuitRoute === "proposal_response") return undefined;

	const routeLabel = pursuitRoute === "supplier_registration" ? "Supplier Registration" : "Prequalification";
	const requiredArtifacts = qualificationRequiredArtifacts(pursuitRoute);
	const checklist = buildQualificationChecklist(responsePackage, pursuitRoute);
	const summary = [
		`${routeLabel} workflow for ${responsePackage.opportunityTitle}.`,
		`Pursuit fit is ${responsePackage.pursuitFit.status} (${responsePackage.pursuitFit.score}/100).`,
		`Operator review is required before treating this as a proposal-response pursuit.`,
	].join(" ");

	const packageValue: Omit<LiveQualificationPackage, "operatorBriefMarkdown"> = {
		pursuitRoute,
		title: `${routeLabel} Package - ${responsePackage.opportunityTitle}`,
		summary,
		requiredArtifacts,
		checklist,
	};

	return {
		...packageValue,
		operatorBriefMarkdown: formatLiveQualificationBrief(packageValue, responsePackage),
	};
}

export function buildLiveSubmissionSchedule(input: {
	opportunity: OpportunityData;
	sourceText: string;
	generatedAt?: Date;
}): LiveSubmissionSchedule {
	const generatedAt = input.generatedAt ?? new Date();
	const metadataDeadline = normalizeDeadlineDate(input.opportunity.deadline);
	const sourceDeadline = metadataDeadline ? undefined : extractSourceDeadline(input.sourceText);
	const deadline = metadataDeadline ?? sourceDeadline?.deadline;
	const deadlineIso = deadline ? deadline.toISOString() : undefined;
	const daysUntilDeadline = deadline ? daysBetweenDates(generatedAt, deadline) : undefined;
	const submissionRequirements = extractSubmissionRequirements(input.sourceText);
	const evidenceSnippets = uniqueStrings([
		...(metadataDeadline && input.opportunity.deadline
			? [`Opportunity metadata deadline: ${deadlineLabel(input.opportunity.deadline)}`]
			: []),
		...(sourceDeadline ? [sourceDeadline.evidenceSnippet] : []),
		...(input.opportunity.submissionMethod ? [`Submission method: ${input.opportunity.submissionMethod}`] : []),
		...(input.opportunity.submissionRequirements ? [`Submission requirements: ${compactText(input.opportunity.submissionRequirements, 260)}`] : []),
		...submissionRequirements,
	]).slice(0, 8);

	return {
		deadlineIso,
		deadlineLabel: deadline ? deadlineLabel(deadline) : undefined,
		deadlineSource: metadataDeadline ? "opportunity_metadata" : sourceDeadline ? "source_text" : "not_found",
		daysUntilDeadline,
		urgency: deadlineUrgency(daysUntilDeadline),
		submissionMethod: input.opportunity.submissionMethod,
		submissionRequirements,
		evidenceSnippets,
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
	const documentsWithEvidenceCitations = responsePackage.documents.filter(hasCompleteEvidenceCitationMap).length;
	const documentsWithValidDraftArtifacts = responsePackage.documents.filter(hasValidDraftArtifactManifest).length;
	const documentsWithReviewGates = responsePackage.documents.filter((document) => document.markdown.includes("## Review Gates")).length;
	const documentsWithSourceCitations = responsePackage.documents.filter(hasCompleteSourceCitationMap).length;
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
		evidenceCitationCoverage: ratio(documentsWithEvidenceCitations, responsePackage.documents.length),
		draftArtifactIntegrityCoverage: ratio(documentsWithValidDraftArtifacts, responsePackage.documents.length),
		reviewGateCoverage: ratio(documentsWithReviewGates, responsePackage.documents.length),
		sourceCitationCoverage: ratio(documentsWithSourceCitations, responsePackage.documents.length),
		unresolvedPlaceholderCount,
		minDocumentWordCount,
		totalDraftWordCount: responsePackage.totalWordCount,
		relevantSnippetCount: responsePackage.relevantSnippetCount,
		winThemeSeedCount: responsePackage.winThemeSeeds.length,
		pursuitFitScore: responsePackage.pursuitFit.score,
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
	if (metrics.evidenceCitationCoverage < 1) {
		blockers.push("At least one response draft is missing a complete Datacraft evidence citation map");
	}
	if (metrics.draftArtifactIntegrityCoverage < 1) {
		blockers.push("At least one response draft has a missing or stale draft artifact integrity manifest");
	}
	if (metrics.reviewGateCoverage < 1) {
		blockers.push("At least one response draft is missing review gates");
	}
	if (metrics.sourceCitationCoverage < 1) {
		blockers.push("At least one response draft is missing a complete source citation map");
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
		if (!hasCompleteEvidenceCitationMap(document)) {
			warnings.push(`${document.documentType} has incomplete Datacraft evidence citation mapping`);
		}
		if (!hasValidDraftArtifactManifest(document)) {
			warnings.push(`${document.documentType} has a missing or stale draft artifact integrity manifest`);
		}
		if (!hasCompleteSourceCitationMap(document)) {
			warnings.push(`${document.documentType} has incomplete source citation mapping`);
		}
	}
	if (responsePackage.evaluationCriteria.length === 0) {
		warnings.push("No explicit evaluator scoring criteria were extracted from the source text");
	}
	if (responsePackage.pursuitFit.status === "review_required") {
		warnings.push(`Pursuit fit requires review before bid decision (${responsePackage.pursuitFit.score}/100): ${responsePackage.pursuitFit.rationale}`);
	}
	if (responsePackage.pursuitFit.status === "weak_fit") {
		warnings.push(`Weak pursuit fit (${responsePackage.pursuitFit.score}/100): ${responsePackage.pursuitFit.rationale}`);
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

function qualificationRequiredArtifacts(route: QualificationPursuitRoute): string[] {
	const shared = [
		"Company profile",
		"Certificate of incorporation or business registration",
		"Tax compliance certificate",
		"Relevant past performance evidence",
		"Key personnel qualifications",
		"Signed declarations and eligibility forms",
		"Submission receipt or portal acknowledgement",
	];
	if (route === "supplier_registration") {
		return [
			"Selected supplier category matrix",
			...shared,
			"Category-specific licenses or certifications",
		];
	}
	return [
		"Prequalification questionnaire response",
		...shared,
		"Financial capacity evidence",
		"Consortium or specialist partner commitments, if required",
	];
}

function buildQualificationChecklist(
	responsePackage: LiveResponsePackage,
	route: QualificationPursuitRoute
): LiveQualificationChecklistItem[] {
	const requirementIds = responsePackage.requirements.map((requirement) => requirement.id);
	const mandatoryIds = responsePackage.requirements
		.filter((requirement) => requirement.priority === "mandatory")
		.map((requirement) => requirement.id);
	const evaluationIds = responsePackage.evaluationCriteria.map((criterion) => criterion.id);
	const checklist: LiveQualificationChecklistItem[] = [
		{
			id: "QUAL-001",
			priority: "mandatory",
			text: route === "supplier_registration"
				? "Confirm the supplier categories that Datacraft should register for and exclude unrelated categories before submission."
				: "Confirm this prequalification should be pursued before preparing a full proposal-response package.",
			ownerHint: "proposal_manager",
			sourceRequirementIds: requirementIds.slice(0, 6),
		},
		{
			id: "QUAL-002",
			priority: "mandatory",
			text: "Compile legal, tax, eligibility, declaration, and registration evidence required by the source document.",
			ownerHint: "compliance",
			sourceRequirementIds: mandatoryIds.slice(0, 8),
		},
		{
			id: "QUAL-003",
			priority: "mandatory",
			text: "Map Datacraft past performance, personnel qualifications, and technical capability evidence to each selected category or prequalification criterion.",
			ownerHint: "technical_lead",
			sourceRequirementIds: [...mandatoryIds, ...evaluationIds].slice(0, 10),
		},
		{
			id: "QUAL-004",
			priority: "review",
			text: "Review specialist-domain risks and decide whether partner evidence or a no-bid decision is required.",
			ownerHint: "proposal_manager",
			sourceRequirementIds: requirementIds.slice(0, 10),
		},
		{
			id: "QUAL-005",
			priority: "mandatory",
			text: "Prepare the final submission pack and capture the portal or physical submission receipt before marking the qualification complete.",
			ownerHint: "compliance",
			sourceRequirementIds: requirementIds.slice(-8),
		},
	];

	return checklist;
}

function formatLiveQualificationBrief(
	packageValue: Omit<LiveQualificationPackage, "operatorBriefMarkdown">,
	responsePackage: LiveResponsePackage
): string {
	const lines = [
		`# ${packageValue.title}`,
		"",
		`Route: \`${packageValue.pursuitRoute}\``,
		`Pursuit fit: ${responsePackage.pursuitFit.status} (${responsePackage.pursuitFit.score}/100), ${responsePackage.pursuitFit.recommendation}`,
		responsePackage.submissionSchedule.deadlineLabel
			? `Deadline: ${responsePackage.submissionSchedule.deadlineLabel} (${responsePackage.submissionSchedule.urgency}, ${responsePackage.submissionSchedule.deadlineSource})`
			: "Deadline: not found in source evidence",
		"",
		"## Summary",
		"",
		packageValue.summary,
		"",
		"## Required Artifacts",
		"",
		...packageValue.requiredArtifacts.map((artifact) => `- ${artifact}`),
		"",
		"## Checklist",
		"",
		...packageValue.checklist.flatMap((item) => [
			`### ${item.id}`,
			"",
			`- Priority: ${item.priority}`,
			`- Owner: ${item.ownerHint}`,
			`- Task: ${item.text}`,
			`- Source signals: ${item.sourceRequirementIds.length > 0 ? item.sourceRequirementIds.join(", ") : "operator review"}`,
			"",
		]),
		"## Risk Notes",
		"",
		...(responsePackage.pursuitFit.riskFactors.length > 0
			? responsePackage.pursuitFit.riskFactors.map((risk) => `- ${risk}`)
			: ["- No specialist-domain risk factors were detected."]),
		"",
	];
	return `${lines.join("\n").trimEnd()}\n`;
}

function hasCompleteSourceCitationMap(document: LiveResponseDraftDocument): boolean {
	if (!document.markdown.includes("## Source Citation Map")) return false;
	return [...document.requirementIds, ...document.evaluationCriteriaIds].every((id) =>
		document.markdown.includes(id)
	);
}

function hasCompleteEvidenceCitationMap(document: LiveResponseDraftDocument): boolean {
	if (!document.markdown.includes("## Datacraft Evidence Citation Map")) return false;
	return document.relevantSnippetShortcuts.every((shortcut) => document.markdown.includes(shortcut));
}

function buildDraftArtifactManifest(
	documentType: ProposalDocumentType,
	markdown: string,
	generatedAt: Date
): LiveResponseDraftArtifact {
	return {
		format: "markdown",
		filename: `${documentType}.md`,
		contentHash: sha256Hex(markdown),
		sizeBytes: Buffer.byteLength(markdown, "utf8"),
		generatedAt: generatedAt.toISOString(),
	};
}

function hasValidDraftArtifactManifest(document: LiveResponseDraftDocument): boolean {
	return document.artifact?.format === "markdown"
		&& document.artifact.filename === `${document.documentType}.md`
		&& document.artifact.contentHash === sha256Hex(document.markdown)
		&& document.artifact.sizeBytes === Buffer.byteLength(document.markdown, "utf8")
		&& document.artifact.sizeBytes > 0
		&& Boolean(document.artifact.generatedAt);
}

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
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

	if (requirements.length < 3) {
		const existingTexts = new Set(requirements.map((requirement) => requirement.text));
		for (const text of extractRequirementSentences(sourceText)) {
			const compacted = compactText(text, 380);
			if (existingTexts.has(compacted)) continue;
			existingTexts.add(compacted);
			const documentType = documentTypeForRequirementText(compacted);
			const priority = /\b(shall|must|required|mandatory|submit|provide|proposal|tender|bidder)\b/i.test(compacted)
				? "mandatory"
				: "administrative";
			requirements.push({
				id: `LIVE-REQ-${String(requirements.length + 1).padStart(3, "0")}`,
				text: compacted,
				sourceSection: "Source Document",
				priority,
				documentType,
				responseStrategy: responseStrategyFor(documentType, compacted),
			});
			if (requirements.length >= 12) break;
		}
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

function extractRequirementSentences(sourceText: string): string[] {
	const normalized = sourceText
		.replace(/\r/g, "\n")
		.replace(/[ \t]+/g, " ")
		.replace(/\n+/g, ". ")
		.trim();
	if (!normalized) return [];

	return uniqueStrings(normalized
		.split(/(?<=[.;:!?])\s+/)
		.map((sentence) => sentence.replace(/^[-*]?\s*/, "").trim())
		.filter((sentence) => sentence.length >= 45 && sentence.length <= 600)
		.filter((sentence) => /\b(shall|must|required|requires|mandatory|should|submit|provide|proposal|tender|bidder|consultant|service|scope|terms of reference|deliverable|evaluation|criteria|qualification|experience|financial|technical|deadline|closing date)\b/i.test(sentence))
	).slice(0, 24);
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
		if (seeds.length >= 16) break;
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

export function assessLiveResponsePursuitFit(input: {
	opportunity: OpportunityData;
	sourceText: string;
	relevantSnippetCount?: number;
}): LiveResponsePursuitFitAssessment {
	const haystack = [
		input.opportunity.title,
		input.opportunity.organization,
		input.opportunity.category,
		input.opportunity.projectSummary,
		input.opportunity.countryRegion,
		input.sourceText,
	].filter(Boolean).join(" ").toLowerCase();
	const matchedStrategic = matchedTerms(haystack, STRATEGIC_CAPABILITY_TERMS);
	const matchedDelivery = matchedTerms(haystack, DELIVERY_CAPABILITY_TERMS);
	const matchedContext = matchedTerms(haystack, OPPORTUNITY_CONTEXT_TERMS);
	const matchedRisks = matchedTerms(haystack, FIT_RISK_TERMS)
		.filter((term) => matchedStrategic.length === 0 || term !== "medical supplies");
	const pursuitRoute = inferPursuitRoute(haystack);
	const matchedCapabilities = uniqueStrings([...matchedStrategic, ...matchedDelivery, ...matchedContext]);
	const riskFactors = matchedRisks.map((term) => `${term} domain may require specialist partner or no-bid review`);
	const strategicScore = Math.min(45, matchedStrategic.length * 7);
	const deliveryScore = Math.min(25, matchedDelivery.length * 5);
	const contextScore = Math.min(15, matchedContext.length * 3);
	const evidenceScore = Math.min(15, Math.max(0, input.relevantSnippetCount ?? 0));
	const riskPenalty = Math.min(35, matchedRisks.length * 12);
	const score = clampScore(20 + strategicScore + deliveryScore + contextScore + evidenceScore - riskPenalty);
	let status: LiveResponsePursuitFitAssessment["status"];
	if (pursuitRoute !== "proposal_response" && score >= 50) {
		status = "review_required";
	} else if (matchedRisks.length >= 2 && score >= 50) {
		status = "review_required";
	} else if (score >= 75 && matchedStrategic.length >= 2) {
		status = "strong_fit";
	} else if (score >= 50 || matchedStrategic.length > 0 || matchedDelivery.length >= 3) {
		status = "review_required";
	} else {
		status = "weak_fit";
	}
	const recommendation = status === "strong_fit"
		? "pursue"
		: status === "review_required"
			? "review_before_pursuit"
			: "no_bid_unless_partnered";
	const rationale = buildPursuitFitRationale({
		status,
		score,
		pursuitRoute,
		matchedCapabilities,
		riskFactors,
	});

	return {
		status,
		score,
		pursuitRoute,
		matchedCapabilities,
		riskFactors,
		recommendation,
		rationale,
	};
}

function matchedTerms(haystack: string, terms: string[]): string[] {
	return terms.filter((term) => termPattern(term).test(haystack));
}

function termPattern(term: string): RegExp {
	const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
	return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "iu");
}

function inferPursuitRoute(haystack: string): LiveResponsePursuitFitAssessment["pursuitRoute"] {
	if (SUPPLIER_REGISTRATION_PATTERNS.some((pattern) => pattern.test(haystack))) {
		return "supplier_registration";
	}
	if (PREQUALIFICATION_PATTERNS.some((pattern) => pattern.test(haystack))) {
		return "prequalification";
	}
	return "proposal_response";
}

function clampScore(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function buildPursuitFitRationale(input: {
	status: LiveResponsePursuitFitAssessment["status"];
	score: number;
	pursuitRoute: LiveResponsePursuitFitAssessment["pursuitRoute"];
	matchedCapabilities: string[];
	riskFactors: string[];
}): string {
	const capabilities = input.matchedCapabilities.slice(0, 6).join(", ") || "no clear Datacraft capability match";
	const risks = input.riskFactors.slice(0, 3).join("; ");
	const routePrefix = input.pursuitRoute === "supplier_registration"
		? "Supplier-registration workflow required; "
		: input.pursuitRoute === "prequalification"
			? "Prequalification workflow required; "
			: "";
	const base = input.status === "strong_fit"
		? `${routePrefix}Strong Datacraft fit based on ${capabilities}.`
		: input.status === "review_required"
			? `${routePrefix}Bid/no-bid review required; fit signals include ${capabilities}.`
			: `${routePrefix}Weak Datacraft fit; ${capabilities}.`;
	return risks ? `${base} Risk factors: ${risks}.` : base;
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
	submissionSchedule: LiveSubmissionSchedule;
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
	const evidenceCitationLines = buildEvidenceCitationLines(input.snippets);
	const opportunityContext = [
		`Client: ${input.clientName}`,
		`Opportunity: ${input.opportunity.title}`,
		input.opportunity.sourceId ? `Solicitation: ${input.opportunity.sourceId}` : null,
		input.submissionSchedule.deadlineLabel
			? `Deadline: ${input.submissionSchedule.deadlineLabel} (${input.submissionSchedule.urgency}, ${input.submissionSchedule.deadlineSource})`
			: "Deadline: not found in source evidence",
		input.submissionSchedule.submissionMethod ? `Submission method: ${input.submissionSchedule.submissionMethod}` : null,
		...input.submissionSchedule.submissionRequirements.slice(0, 2).map((requirement) =>
			`Submission requirement: ${requirement}`
		),
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
		"## Datacraft Evidence Citation Map",
		...evidenceCitationLines,
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

function buildEvidenceCitationLines(snippets: DatacraftResponseSnippetInput[]): string[] {
	const lines = snippets.slice(0, 8).map((snippet) =>
		`- Evidence ${snippet.shortcut}: ${snippet.name}; category ${snippet.topicCategory}; apply where the response addresses ${compactText(snippet.description, 180)}`
	);

	return lines.length > 0
		? lines
		: ["- No Datacraft evidence snippets were assigned to this draft; refresh snippet matching before final submission."];
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

	if (direct.length > 0) return direct;

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

	if (direct.length > 0) return direct;
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
	if (/\b(technical proposal|technical approach|methodology|sampling|data collection|technical)\b/.test(lower)) return "technical_approach";
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
	const hasCriterionTopic = /\b(technical|methodology|approach|experience|qualification|personnel|staff|work plan|schedule|quality|capacity|competence|understanding|terms of reference|similar assignment|financial|price|cost)\b/i.test(line);
	const isListItem = /^(?:[-*]|\d+(?:\.\d+)*[.)]|[a-z][.)])\s+.{20,}$/.test(line);

	return (hasEvaluationCue && (hasWeight || hasEvaluationPhrase)) ||
		(sectionSignalsEvaluation && isListItem && (hasEvaluationCue || hasWeight || hasCriterionTopic));
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
			evidenceCitationCoverage: 0,
			draftArtifactIntegrityCoverage: 0,
			reviewGateCoverage: 0,
			sourceCitationCoverage: 0,
			unresolvedPlaceholderCount: 0,
			minDocumentWordCount: 0,
			totalDraftWordCount: 0,
			relevantSnippetCount: 0,
			winThemeSeedCount: 0,
			pursuitFitScore: 0,
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

const MONTH_INDEX_BY_NAME: Record<string, number> = {
	jan: 0,
	january: 0,
	feb: 1,
	february: 1,
	mar: 2,
	march: 2,
	apr: 3,
	april: 3,
	may: 4,
	jun: 5,
	june: 5,
	jul: 6,
	july: 6,
	aug: 7,
	august: 7,
	sep: 8,
	sept: 8,
	september: 8,
	oct: 9,
	october: 9,
	nov: 10,
	november: 10,
	dec: 11,
	december: 11,
};

function normalizeDeadlineDate(value: OpportunityData["deadline"]): Date | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
	if (typeof value !== "string") return undefined;
	return parseProcurementDate(value);
}

function extractSourceDeadline(sourceText: string): { deadline: Date; evidenceSnippet: string } | undefined {
	const normalized = sourceText.replace(/\r/g, "\n");
	const patterns = [
		/(?:submission\s+deadline|deadline(?:\s+date\/time)?|closing\s+date|close(?:s|d)?(?:\s+date)?|due\s+date)\s*[:\-]?\s*([^\n]{3,160})/giu,
		/(?:before|by|not\s+later\s+than)\s+([^\n]{3,140})/giu,
	];
	for (const pattern of patterns) {
		for (const match of normalized.matchAll(pattern)) {
			const rawCandidate = compactText(match[1] ?? "", 160);
			const parsed = parseProcurementDate(rawCandidate);
			if (!parsed) continue;
			const lineStart = normalized.lastIndexOf("\n", match.index ?? 0) + 1;
			const lineEnd = normalized.indexOf("\n", match.index ?? 0);
			const line = normalized.slice(lineStart, lineEnd === -1 ? normalized.length : lineEnd);
			return {
				deadline: parsed,
				evidenceSnippet: compactText(line || match[0], 260),
			};
		}
	}
	return undefined;
}

function parseProcurementDate(value: string): Date | undefined {
	const cleaned = value
		.replace(/[*_`]+/gu, " ")
		.replace(/\b(\d{1,2})\s*(st|nd|rd|th)\b/giu, "$1")
		.replace(/\bat\s+/giu, " ")
		.replace(/\btime\s*[:\-]?\s*/giu, " ")
		.replace(/\s+/gu, " ")
		.trim();
	if (!cleaned) return undefined;

	const isoMatch = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/u);
	if (isoMatch) {
		return dateFromParts(
			Number(isoMatch[1]),
			Number(isoMatch[2]) - 1,
			Number(isoMatch[3]),
			timePartsFromText(cleaned, isoMatch[4], isoMatch[5], isoMatch[6])
		);
	}

	const numericMatch = cleaned.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?!\d)/u);
	if (numericMatch) {
		return dateFromParts(
			Number(numericMatch[3]),
			Number(numericMatch[2]) - 1,
			Number(numericMatch[1]),
			timePartsFromText(cleaned)
		);
	}

	const dayMonthYearMatch = cleaned.match(/\b(\d{1,2})[-\s]+([A-Za-z]{3,9}),?[-\s]+(\d{4})\b/u);
	if (dayMonthYearMatch) {
		const month = MONTH_INDEX_BY_NAME[dayMonthYearMatch[2].toLowerCase()];
		if (month !== undefined) {
			return dateFromParts(
				Number(dayMonthYearMatch[3]),
				month,
				Number(dayMonthYearMatch[1]),
				timePartsFromText(cleaned)
			);
		}
	}

	const monthDayYearMatch = cleaned.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/u);
	if (monthDayYearMatch) {
		const month = MONTH_INDEX_BY_NAME[monthDayYearMatch[1].toLowerCase()];
		if (month !== undefined) {
			return dateFromParts(
				Number(monthDayYearMatch[3]),
				month,
				Number(monthDayYearMatch[2]),
				timePartsFromText(cleaned)
			);
		}
	}

	const parsed = new Date(cleaned);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function timePartsFromText(
	text: string,
	hourMatch?: string,
	minuteMatch?: string,
	secondMatch?: string
): { hour: number; minute: number; second: number } | undefined {
	const explicit = hourMatch && minuteMatch
		? { hour: Number(hourMatch), minute: Number(minuteMatch), second: Number(secondMatch ?? 0) }
		: undefined;
	const timeMatch = text.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/iu)
		?? text.match(/\b(\d{1,2})\s*(am|pm)\b/iu);
	const time = explicit ?? (timeMatch
		? { hour: Number(timeMatch[1]), minute: Number(/^\d{2}$/u.test(timeMatch[2] ?? "") ? timeMatch[2] : 0), second: 0 }
		: undefined);
	if (!time) return undefined;
	const meridiem = text.match(/\b(am|pm)\b/iu)?.[1]?.toLowerCase();
	let hour = time.hour;
	if (meridiem === "pm" && hour < 12) hour += 12;
	if (meridiem === "am" && hour === 12) hour = 0;
	if (hour > 23 || time.minute > 59 || time.second > 59) return undefined;
	return { hour, minute: time.minute, second: time.second };
}

function dateFromParts(
	year: number,
	month: number,
	day: number,
	time?: { hour: number; minute: number; second: number }
): Date | undefined {
	if (year < 2000 || month < 0 || month > 11 || day < 1 || day > 31) return undefined;
	const date = new Date(Date.UTC(year, month, day, time?.hour ?? 23, time?.minute ?? 59, time?.second ?? 0));
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function daysBetweenDates(start: Date, end: Date): number {
	return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function deadlineUrgency(daysUntilDeadline: number | undefined): LiveSubmissionSchedule["urgency"] {
	if (daysUntilDeadline === undefined) return "unknown";
	if (daysUntilDeadline < 0) return "expired";
	if (daysUntilDeadline <= 2) return "critical";
	if (daysUntilDeadline <= 7) return "urgent";
	return "normal";
}

function extractSubmissionRequirements(sourceText: string): string[] {
	return uniqueStrings(sourceText
		.split(/\r?\n/)
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter((line) => /\b(submit|submission|deliver|portal|sealed|hard\s+copy|soft\s+copy|email|upload|receipt|closing\s+date|deadline)\b/iu.test(line))
		.map((line) => compactText(line.replace(/^(?:[-*]|\d+(?:\.\d+)*[.)]|[a-z][.)])\s+/iu, ""), 260))
	).slice(0, 6);
}

function deadlineLabel(value: OpportunityData["deadline"]): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
	const parsed = parseProcurementDate(value);
	return parsed ? parsed.toISOString().slice(0, 10) : value;
}

function compactText(text: string, maxLength: number): string {
	const compacted = text.replace(/\s+/g, " ").trim();
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}
