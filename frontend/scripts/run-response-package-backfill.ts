import "./load-env";

import path from "node:path";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { forceLocalEnv } from "./env-utils";
import {
	documents,
	documentVersions,
	opportunities,
	proposalDocuments,
	rfpDocuments,
	rfpRequirements,
	winThemes,
} from "@/lib/db/schema";
import { markdownToContent } from "@/lib/editor/markdown-sync";
import { buildLiveResponsePackage, type LiveResponsePackage } from "@/lib/services/live-response-package";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import type { ProposalDocumentType } from "@/lib/types/opportunity";
import { getDocumentTypeLabel } from "@/lib/utils/proposal-labels";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_RESPONSE_BACKFILL_RUN_ID ?? createProofRunId("live_response_package_backfill");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "response-package-backfill" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-response-package-backfill-evidence.md");
const LIMIT = boundedNumber(process.env.LIVE_RESPONSE_BACKFILL_LIMIT, 3, 1, 25);
const MIN_SOURCE_TEXT_CHARS = boundedNumber(process.env.LIVE_RESPONSE_BACKFILL_MIN_TEXT_CHARS, 1000, 250, 50_000);
const MIN_PURSUIT_FIT_SCORE = boundedNumber(process.env.LIVE_RESPONSE_BACKFILL_MIN_FIT_SCORE, 60, 0, 100);
const REQUIRE_PARSE_REVIEW_READY = process.env.LIVE_RESPONSE_BACKFILL_REQUIRE_PARSE_REVIEW_READY !== "0";
const DRY_RUN = process.env.LIVE_RESPONSE_BACKFILL_DRY_RUN !== "0";
const USER_ID = (process.env.LIVE_RESPONSE_BACKFILL_USER_ID ?? process.env.DISCOVERY_IMPORT_USER_ID ?? "system").slice(0, 100);
const TARGET_OPPORTUNITY_IDS = csvStrings(process.env.LIVE_RESPONSE_BACKFILL_OPPORTUNITY_IDS);
const SOURCE_PLATFORMS = csvStrings(process.env.LIVE_RESPONSE_BACKFILL_SOURCE_PLATFORMS);

let db: typeof import("@/lib/db")["db"];
let closeDatabaseConnection: typeof import("@/lib/db")["closeDatabaseConnection"] = async () => undefined;
let recordWorkflowRuntimeTransition: typeof import("@/lib/actions/workflow-runtime")["recordWorkflowRuntimeTransition"];
let upsertWorkflowRuntimeTask: typeof import("@/lib/actions/workflow-runtime")["upsertWorkflowRuntimeTask"];

type CandidateRow = {
	rfpDocument: typeof rfpDocuments.$inferSelect;
	opportunity: typeof opportunities.$inferSelect;
	requirementCount: number;
	acceptedRequirementCount: number;
};

type PersistedPackageSummary = {
	opportunityId: string;
	rfpDocumentId: string;
	title: string;
	sourceReadinessStatus: string;
	readinessStatus: string;
	readinessBlockers: string[];
	readinessWarnings: string[];
	pursuitFitScore: number;
	pursuitRecommendation: string;
	requirementsLinked: number;
	responseDocuments: number;
	proposalDocuments: number;
	winThemes: number;
	totalDraftWordCount: number;
	minDraftWordCount: number;
};

type BackfillProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	dryRun: boolean;
	limit: number;
	minSourceTextChars: number;
	minPursuitFitScore: number;
	requireParseReviewReady: boolean;
	targetOpportunityIds: string[];
	sourcePlatforms: string[];
	candidatesFound: number;
	selected: Array<{
		opportunityId: string;
		rfpDocumentId: string;
		title: string;
		requirementCount: number;
		acceptedRequirementCount: number;
		extractedTextLength: number;
		parseReviewState: string | null;
	}>;
	persisted: PersistedPackageSummary[];
	skipped: Array<{
		opportunityId?: string;
		rfpDocumentId?: string;
		title?: string;
		reason: string;
	}>;
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	await loadDatabaseModule();

	const proof: BackfillProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		dryRun: DRY_RUN,
		limit: LIMIT,
		minSourceTextChars: MIN_SOURCE_TEXT_CHARS,
		minPursuitFitScore: MIN_PURSUIT_FIT_SCORE,
		requireParseReviewReady: REQUIRE_PARSE_REVIEW_READY,
		targetOpportunityIds: TARGET_OPPORTUNITY_IDS,
		sourcePlatforms: SOURCE_PLATFORMS,
		candidatesFound: 0,
		selected: [],
		persisted: [],
		skipped: [],
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		const candidates = await selectBackfillCandidates();
		proof.candidatesFound = candidates.length;
		proof.selected = candidates.map((candidate) => ({
			opportunityId: candidate.opportunity.id,
			rfpDocumentId: candidate.rfpDocument.id,
			title: candidate.opportunity.title,
			requirementCount: candidate.requirementCount,
			acceptedRequirementCount: candidate.acceptedRequirementCount,
			extractedTextLength: candidate.rfpDocument.extractedText?.length ?? 0,
			parseReviewState: parseReviewState(candidate.rfpDocument.metadata),
		}));

		for (const candidate of candidates) {
			try {
				const expiredReason = expiredCandidateReason(candidate);
				if (expiredReason) {
					proof.skipped.push({
						opportunityId: candidate.opportunity.id,
						rfpDocumentId: candidate.rfpDocument.id,
						title: candidate.opportunity.title,
						reason: expiredReason,
					});
					continue;
				}
				const responsePackage = buildLiveResponsePackage({
					opportunity: toOpportunityData(candidate.opportunity),
					sourceText: candidate.rfpDocument.extractedText ?? "",
				});
				if (responsePackage.readiness.status !== "ready_for_review") {
					proof.skipped.push({
						opportunityId: candidate.opportunity.id,
						rfpDocumentId: candidate.rfpDocument.id,
						title: candidate.opportunity.title,
						reason: `response package blocked: ${responsePackage.readiness.blockers.join("; ")}`,
					});
					continue;
				}
				if (responsePackage.pursuitFit.score < MIN_PURSUIT_FIT_SCORE) {
					proof.skipped.push({
						opportunityId: candidate.opportunity.id,
						rfpDocumentId: candidate.rfpDocument.id,
						title: candidate.opportunity.title,
						reason: `pursuit fit ${responsePackage.pursuitFit.score}/100 is below unattended backfill floor ${MIN_PURSUIT_FIT_SCORE}/100`,
					});
					continue;
				}

				if (DRY_RUN) {
					proof.persisted.push(summarizeDryRun(candidate, responsePackage));
				} else {
					proof.persisted.push(await persistResponsePackage(candidate, responsePackage));
				}
			} catch (error) {
				proof.skipped.push({
					opportunityId: candidate.opportunity.id,
					rfpDocumentId: candidate.rfpDocument.id,
					title: candidate.opportunity.title,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}

		proof.completedAt = new Date().toISOString();
		disposition = proof.persisted.some((item) => item.readinessStatus === "ready_for_review")
			? "pass"
			: proof.persisted.length > 0 ? "partial" : "blocked";
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		disposition = "fail";
	} finally {
		await writeArtifacts(proof, disposition);
		await closeDatabaseConnection().catch(() => undefined);
	}

	console.log(JSON.stringify(proof, null, 2));
	if (disposition === "fail") process.exit(1);
}

async function loadDatabaseModule(): Promise<void> {
	const [databaseModule, workflowRuntimeModule] = await Promise.all([
		import("@/lib/db"),
		import("@/lib/actions/workflow-runtime"),
	]);
	db = databaseModule.db;
	closeDatabaseConnection = databaseModule.closeDatabaseConnection;
	recordWorkflowRuntimeTransition = workflowRuntimeModule.recordWorkflowRuntimeTransition;
	upsertWorkflowRuntimeTask = workflowRuntimeModule.upsertWorkflowRuntimeTask;
}

async function selectBackfillCandidates(): Promise<CandidateRow[]> {
	const conditions = [
		eq(rfpDocuments.parsingStatus, "completed"),
		sql`${rfpDocuments.extractedText} is not null`,
		sql`char_length(${rfpDocuments.extractedText}) >= ${MIN_SOURCE_TEXT_CHARS}`,
		sql`not exists (
			select 1 from proposal_documents
			where proposal_documents.opportunity_id = ${rfpDocuments.opportunityId}
		)`,
		sql`(${opportunities.deadline} is null or ${opportunities.deadline} >= now())`,
		sql`(${rfpDocuments.responseDeadline} is null or ${rfpDocuments.responseDeadline} >= now())`,
	];
	if (REQUIRE_PARSE_REVIEW_READY) {
		conditions.push(sql`coalesce(${rfpDocuments.metadata}->'parseReview'->>'state', '') in ('accepted', 'auto_accepted')`);
		conditions.push(sql`coalesce(jsonb_array_length(coalesce(${rfpDocuments.metadata}->'parseReview'->'qualitySignals', '[]'::jsonb)), 0) = 0`);
	}
	if (TARGET_OPPORTUNITY_IDS.length > 0) {
		conditions.push(inArray(opportunities.id, TARGET_OPPORTUNITY_IDS));
	}
	if (SOURCE_PLATFORMS.length > 0) {
		conditions.push(inArray(opportunities.sourcePlatform, SOURCE_PLATFORMS));
	}

	const rows = await db
		.select({
			rfpDocument: rfpDocuments,
			opportunity: opportunities,
			requirementCount: sql<number>`count(${rfpRequirements.id})::int`,
			acceptedRequirementCount: sql<number>`count(${rfpRequirements.id}) filter (where ${rfpRequirements.metadata}->'workflow'->>'state' = 'accepted')::int`,
		})
		.from(rfpDocuments)
		.innerJoin(opportunities, eq(opportunities.id, rfpDocuments.opportunityId))
		.leftJoin(rfpRequirements, eq(rfpRequirements.rfpDocumentId, rfpDocuments.id))
		.where(and(...conditions))
		.groupBy(rfpDocuments.id, opportunities.id)
		.orderBy(sql`count(${rfpRequirements.id}) desc`, desc(rfpDocuments.createdAt))
		.limit(LIMIT);

	return rows.filter((row) => row.requirementCount > 0);
}

async function persistResponsePackage(
	candidate: CandidateRow,
	responsePackage: LiveResponsePackage
): Promise<PersistedPackageSummary> {
	const now = new Date();
	const organizationId = candidate.rfpDocument.organizationId;
	const metadata = {
		source: "response-package-backfill",
		runId: RUN_ID,
		rfpDocumentId: candidate.rfpDocument.id,
		opportunityId: candidate.opportunity.id,
		readiness: responsePackage.readiness,
		pursuitFit: responsePackage.pursuitFit,
	};

	const result = await db.transaction(async (tx) => {
		const createdDocuments = await tx.insert(documents).values(responsePackage.documents.map((document) => ({
			title: compactText(document.title, 500),
			content: markdownToContent(document.markdown),
			plainText: document.markdown,
			status: "draft",
			visibility: "private",
			ownerId: USER_ID,
			tags: ["response-package-backfill", document.documentType],
			wordCount: document.wordCount,
			characterCount: document.markdown.length,
			metadata: {
				...metadata,
				documentType: document.documentType,
				sourceRequirementIds: document.requirementIds,
				evaluationCriteriaIds: document.evaluationCriteriaIds,
				relevantSnippetShortcuts: document.relevantSnippetShortcuts,
				draftArtifact: document.artifact,
			},
			createdAt: now,
			updatedAt: now,
		}))).returning({ id: documents.id, wordCount: documents.wordCount });
		if (createdDocuments.length !== responsePackage.documents.length) {
			throw new Error("Response document insert count mismatch");
		}

		await tx.insert(documentVersions).values(createdDocuments.map((document, index) => ({
			documentId: document.id,
			versionNumber: 1,
			content: markdownToContent(responsePackage.documents[index].markdown),
			changeDescription: `Generated response package from parsed RFP ${candidate.rfpDocument.id}`,
			createdBy: USER_ID,
			createdAt: now,
		})));

		const createdProposalDocuments = await tx.insert(proposalDocuments).values(responsePackage.documents.map((document, index) => ({
			organizationId,
			opportunityId: candidate.opportunity.id,
			documentId: createdDocuments[index].id,
			documentType: document.documentType,
			sectionOrder: index + 1,
			status: "draft",
			assignedTo: USER_ID,
			aiAnalysisScore: responsePackage.readiness.metrics.sourceRequirementCoverage * 100,
			aiAnalysisAt: now,
			notes: `Generated by ${RUN_ID}; source RFP document ${candidate.rfpDocument.id}`,
			createdAt: now,
			updatedAt: now,
		}))).returning({ id: proposalDocuments.id, documentType: proposalDocuments.documentType, documentId: proposalDocuments.documentId });
		if (createdProposalDocuments.length !== responsePackage.documents.length) {
			throw new Error("Proposal document insert count mismatch");
		}

		const createdWinThemes = responsePackage.winThemeSeeds.length > 0
			? await tx.insert(winThemes).values(responsePackage.winThemeSeeds.map((seed, index) => ({
				opportunityId: candidate.opportunity.id,
				themeStatement: seed.statement,
				shortVersion: compactText(seed.shortVersion, 200),
				themeType: seed.type,
				priority: index + 1,
				supportingEvidence: seed.supportingEvidence,
				relatedProjects: [],
				evaluationCriteriaIds: seed.evaluationCriteriaIds,
				keywords: seed.keywords,
				variations: [seed.rationale],
				targetSections: seed.targetDocumentTypes,
				minOccurrences: Math.max(2, Math.min(4, seed.targetDocumentTypes.length || 3)),
				isActive: true,
				createdBy: USER_ID,
				createdAt: now,
				updatedAt: now,
			}))).returning({ id: winThemes.id })
			: [];

		const requirements = await tx
			.select()
			.from(rfpRequirements)
			.where(eq(rfpRequirements.rfpDocumentId, candidate.rfpDocument.id));
		const acceptedRequirements = requirements.filter((requirement) => requirementWorkflowState(requirement.metadata) === "accepted");
		const documentIdByType = new Map<ProposalDocumentType, string>();
		for (const [index, document] of responsePackage.documents.entries()) {
			documentIdByType.set(document.documentType, createdDocuments[index].id);
		}

		for (const requirement of acceptedRequirements) {
			if (requirement.complianceStatus === "not_applicable") continue;
			const documentType = documentTypeForRequirement(requirement.category);
			const responseDocumentId = documentIdByType.get(documentType) ?? createdDocuments[0].id;
			await tx
				.update(rfpRequirements)
				.set({
					responseDocumentId,
					responseSection: getDocumentTypeLabel(documentType),
					responseStrategy: requirement.responseStrategy
						?? `Drafted into ${getDocumentTypeLabel(documentType)} by response-package backfill ${RUN_ID}; review evidence and final compliance before submission.`,
					complianceStatus: ["addressed", "compliant", "not_applicable"].includes(requirement.complianceStatus ?? "")
						? requirement.complianceStatus
						: "partial",
					assignedTo: requirement.assignedTo ?? USER_ID,
					updatedAt: now,
				})
				.where(eq(rfpRequirements.id, requirement.id));
		}

		await tx
			.update(opportunities)
			.set({
				decisionStatus: "drafting",
				assignedTo: candidate.opportunity.assignedTo ?? USER_ID,
				metadata: {
					...recordObject(candidate.opportunity.metadata),
					responsePackageBackfill: {
						runId: RUN_ID,
						rfpDocumentId: candidate.rfpDocument.id,
						responseDocumentCount: createdDocuments.length,
						winThemeCount: createdWinThemes.length,
						readinessStatus: responsePackage.readiness.status,
						totalDraftWordCount: responsePackage.totalWordCount,
						generatedAt: now.toISOString(),
					},
				},
				updatedAt: now,
			})
			.where(eq(opportunities.id, candidate.opportunity.id));

		const workflowReadiness = buildBackfillWorkflowReadiness({
			responsePackage,
			acceptedRequirements,
			requirements,
			createdDocuments,
			createdWinThemes: createdWinThemes.length,
		});
		const workflowInstance = await recordWorkflowRuntimeTransition({
			workflowKey: "proposal_response_package",
			organizationId,
			subjectType: "opportunity",
			subjectId: candidate.opportunity.id,
			opportunityId: candidate.opportunity.id,
			fromState: acceptedRequirements.length > 0 ? "requirements_accepted" : "requirements_pending_acceptance",
			toState: "response_package_drafted",
			eventType: "response_package_backfilled",
			actorId: USER_ID,
			actorName: USER_ID,
			reason: "Backfilled response package from parsed RFP text",
			evidenceLinks: [
				`rfp-document:${candidate.rfpDocument.id}`,
				...createdDocuments.map((document) => `document:${document.id}`),
			],
			priority: workflowReadiness.status === "ready_for_review" ? "high" : "critical",
			visibility: "internal",
			metadata: {
				documentsCreated: createdDocuments.length,
				proposalDocumentIds: createdProposalDocuments.map((document) => document.id),
				documentIds: createdDocuments.map((document) => document.id),
				requirementIds: acceptedRequirements.map((requirement) => requirement.id),
				requirementCount: acceptedRequirements.length,
				proposalDocumentCount: createdProposalDocuments.length,
				documentVersionNumber: 1,
				readiness: workflowReadiness,
				source: "response-package-backfill",
				runId: RUN_ID,
			},
			terminal: false,
			actionUrl: `/opportunities/${candidate.opportunity.id}/documents`,
		}, tx);
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: workflowInstance.id,
			taskKey: `response-package-review:${candidate.opportunity.id}`,
			title: workflowReadiness.status === "ready_for_review"
				? "Review drafted response package"
				: "Resolve response package readiness blockers",
			description: workflowReadiness.status === "ready_for_review"
				? "Review backfilled response documents, source citations, and win themes before final package rendering."
				: `Response package is drafted, but final rendering is blocked.\n${workflowReadiness.blockers.join("\n")}`,
			state: workflowReadiness.status === "ready_for_review" ? "open" : "blocked",
			priority: workflowReadiness.status === "ready_for_review" ? "high" : "critical",
			assignedTo: USER_ID,
			assignedRole: "proposal_manager",
			dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
			metadata: {
				readiness: workflowReadiness,
				proposalDocumentIds: createdProposalDocuments.map((document) => document.id),
				documentIds: createdDocuments.map((document) => document.id),
			},
		}, tx);
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: workflowInstance.id,
			taskKey: `final-package-render:${candidate.opportunity.id}`,
			title: workflowReadiness.status === "ready_for_review"
				? "Render approved final package"
				: "Final package render blocked by response readiness",
			description: workflowReadiness.status === "ready_for_review"
				? "Render the approved response documents into final submission artifacts after response package review is complete."
				: "Final package rendering is blocked until response package readiness passes.",
			state: workflowReadiness.status === "ready_for_review" ? "open" : "blocked",
			priority: "medium",
			assignedTo: USER_ID,
			assignedRole: "proposal_manager",
			dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
			metadata: {
				readiness: workflowReadiness,
				proposalDocumentIds: createdProposalDocuments.map((document) => document.id),
				documentIds: createdDocuments.map((document) => document.id),
				versionNumber: 1,
			},
		}, tx);

		return {
			documentsCreated: createdDocuments.length,
			proposalDocumentsCreated: createdProposalDocuments.length,
			winThemesCreated: createdWinThemes.length,
			requirementsLinked: acceptedRequirements.length,
			minDraftWordCount: Math.min(...createdDocuments.map((document) => document.wordCount)),
			workflowReadiness,
		};
	});

	return {
		opportunityId: candidate.opportunity.id,
		rfpDocumentId: candidate.rfpDocument.id,
		title: candidate.opportunity.title,
		sourceReadinessStatus: responsePackage.readiness.status,
		readinessStatus: result.workflowReadiness.status,
		readinessBlockers: result.workflowReadiness.blockers,
		readinessWarnings: result.workflowReadiness.warnings,
		pursuitFitScore: responsePackage.pursuitFit.score,
		pursuitRecommendation: responsePackage.pursuitFit.recommendation,
		requirementsLinked: result.requirementsLinked,
		responseDocuments: result.documentsCreated,
		proposalDocuments: result.proposalDocumentsCreated,
		winThemes: result.winThemesCreated,
		totalDraftWordCount: responsePackage.totalWordCount,
		minDraftWordCount: result.minDraftWordCount,
	};
}

function summarizeDryRun(candidate: CandidateRow, responsePackage: LiveResponsePackage): PersistedPackageSummary {
	const readinessBlocked = candidate.acceptedRequirementCount === 0;
	return {
		opportunityId: candidate.opportunity.id,
		rfpDocumentId: candidate.rfpDocument.id,
		title: candidate.opportunity.title,
		sourceReadinessStatus: responsePackage.readiness.status,
		readinessStatus: "blocked",
		readinessBlockers: [
			"Backfilled response packages require the standard response readiness pass before final rendering",
			...(readinessBlocked
				? ["Parsed requirements are still pending acceptance; review and accept requirements before final package rendering"]
				: responsePackage.readiness.blockers),
		],
		readinessWarnings: responsePackage.readiness.warnings,
		pursuitFitScore: responsePackage.pursuitFit.score,
		pursuitRecommendation: responsePackage.pursuitFit.recommendation,
		requirementsLinked: candidate.acceptedRequirementCount,
		responseDocuments: responsePackage.documents.length,
		proposalDocuments: responsePackage.documents.length,
		winThemes: responsePackage.winThemeSeeds.length,
		totalDraftWordCount: responsePackage.totalWordCount,
		minDraftWordCount: Math.min(...responsePackage.documents.map((document) => document.wordCount)),
	};
}

function expiredCandidateReason(candidate: CandidateRow): string | null {
	const opportunityReason = expiredDeadlineReason("opportunity deadline", candidate.opportunity.deadline);
	if (opportunityReason) return opportunityReason;
	return expiredDeadlineReason("RFP response deadline", candidate.rfpDocument.responseDeadline);
}

function expiredDeadlineReason(label: string, value: Date | null): string | null {
	if (!value || Number.isNaN(value.getTime()) || value >= new Date()) return null;
	return `expired ${label} ${value.toISOString()}`;
}

function toOpportunityData(opportunity: typeof opportunities.$inferSelect): OpportunityData {
	return {
		title: opportunity.title,
		organization: opportunity.organization ?? undefined,
		deadline: opportunity.deadline,
		source: opportunity.source ?? "persisted_rfp",
		sourceId: opportunity.sourceId ?? undefined,
		noticeId: opportunity.noticeId ?? undefined,
		portalUrl: opportunity.portalUrl ?? undefined,
		documentUrl: opportunity.documentUrl ?? undefined,
		category: opportunity.category ?? undefined,
		itCategory: opportunity.itCategory ?? undefined,
		sector: opportunity.sector ?? undefined,
		countryRegion: opportunity.countryRegion ?? undefined,
		funder: opportunity.funder ?? undefined,
		budgetValue: opportunity.budgetValue ?? undefined,
		budgetNumeric: opportunity.budgetNumeric ?? undefined,
		budgetCurrency: opportunity.budgetCurrency ?? undefined,
		projectSummary: opportunity.projectSummary ?? undefined,
		projectScope: opportunity.projectScope ?? undefined,
		keyRequirements: opportunity.keyRequirements ?? undefined,
		technicalRequirements: opportunity.technicalRequirements ?? undefined,
		submissionMethod: opportunity.submissionMethod ?? undefined,
		submissionRequirements: opportunity.submissionRequirements ?? undefined,
		rfpLink: opportunity.rfpLink ?? undefined,
		opportunityType: opportunityType(opportunity.opportunityType),
		publishedDate: opportunity.publishedDate,
		tags: stringArray(opportunity.tags),
		metadata: recordObject(opportunity.metadata),
	};
}

function buildBackfillWorkflowReadiness(input: {
	responsePackage: LiveResponsePackage;
	acceptedRequirements: Array<typeof rfpRequirements.$inferSelect>;
	requirements: Array<typeof rfpRequirements.$inferSelect>;
	createdDocuments: Array<{ id: string; wordCount: number }>;
	createdWinThemes: number;
}) {
	const blockers: string[] = [];
	const warnings = [...input.responsePackage.readiness.warnings];
	blockers.push("Backfilled response packages require the standard response readiness pass before final rendering");
	if (input.acceptedRequirements.length === 0) {
		blockers.push("Parsed requirements are still pending acceptance; review and accept requirements before final package rendering");
	}
	const acceptedRequirementIds = input.acceptedRequirements.map((requirement) => requirement.id);
	const missingRequirementIds = acceptedRequirementIds.length > 0
		? acceptedRequirementIds
		: input.requirements.map((requirement) => requirement.id);
	const documentsDrafted = input.createdDocuments.length;
	const minDocumentDraftWordCount = Math.min(...input.createdDocuments.map((document) => document.wordCount));
	const totalDraftWordCount = input.createdDocuments.reduce((total, document) => total + document.wordCount, 0);
	const draftArtifactIntegrityCoverage = input.responsePackage.documents.every((document) =>
		Boolean(document.artifact?.contentHash && document.artifact.sizeBytes > 0)
	) ? 1 : 0;
	const ready = blockers.length === 0 && input.responsePackage.readiness.status === "ready_for_review";
	return {
		status: ready ? "ready_for_review" : "blocked",
		blockers: [
			...blockers,
			...(input.responsePackage.readiness.status === "ready_for_review"
				? []
				: input.responsePackage.readiness.blockers),
		],
		warnings,
		missingRequirementIds,
		evaluationCriteriaIds: input.responsePackage.evaluationCriteria.map((criterion) => criterion.id),
		draftCoveredEvaluationCriteriaIds: input.responsePackage.readiness.draftCoveredEvaluationCriteriaIds,
		winThemeCoveredEvaluationCriteriaIds: input.responsePackage.readiness.winThemeCoveredEvaluationCriteriaIds,
		missingDraftEvaluationCriteriaIds: input.responsePackage.readiness.missingDraftEvaluationCriteriaIds,
		missingWinThemeEvaluationCriteriaIds: input.responsePackage.readiness.missingWinThemeEvaluationCriteriaIds,
		metrics: {
			acceptedRequirementCount: acceptedRequirementIds.length,
			draftedRequirementCount: 0,
			requirementCoverage: 0,
			documentsDrafted,
			sectionsDrafted: documentsDrafted,
			complianceEntriesCreated: 0,
			totalDraftWordCount,
			minDocumentDraftWordCount,
			evidenceChecklistCoverage: 0,
			evidenceCitationCoverage: 0,
			draftArtifactIntegrityCoverage,
			reviewGateCoverage: 0,
			sourceCitationCoverage: 0,
			winThemeCoverage: 0,
			winThemeCriteriaCoverage: 0,
			winThemeSeedCount: input.createdWinThemes,
			unresolvedPlaceholderCount: input.responsePackage.readiness.metrics.unresolvedPlaceholderCount,
		},
	};
}

function parseReviewState(metadata: unknown): string | null {
	const parseReview = recordObject(recordObject(metadata).parseReview);
	return typeof parseReview.state === "string" ? parseReview.state : null;
}

function requirementWorkflowState(metadata: unknown): string {
	const workflow = recordObject(recordObject(metadata).workflow);
	return typeof workflow.state === "string" ? workflow.state : "review";
}

function documentTypeForRequirement(category: string | null): ProposalDocumentType {
	const normalized = category?.toLowerCase() ?? "";
	if (normalized.includes("cost") || normalized.includes("financial") || normalized.includes("price")) return "cost_proposal";
	if (normalized.includes("past")) return "past_performance";
	if (normalized.includes("staff") || normalized.includes("personnel")) return "management_plan";
	if (normalized.includes("management") || normalized.includes("delivery")) return "management_plan";
	if (normalized.includes("admin") || normalized.includes("submission")) return "cover_letter";
	if (normalized.includes("executive")) return "executive_summary";
	return "technical_approach";
}

function opportunityType(value: string): OpportunityData["opportunityType"] {
	if (value === "rfp" || value === "eoi" || value === "tender" || value === "grant" || value === "contract") {
		return value;
	}
	return "rfp";
}

function compactText(value: string, maxLength: number): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized.length > maxLength ? normalized.slice(0, maxLength - 3).trimEnd() + "..." : normalized;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function csvStrings(raw: string | undefined): string[] {
	return [...new Set(raw?.split(",").map((value) => value.trim()).filter(Boolean) ?? [])];
}

function recordObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
}

function boundedNumber(raw: string | undefined, defaultValue: number, min: number, max: number): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

async function writeArtifacts(proof: BackfillProof, disposition: EvidenceRecord["disposition"]): Promise<void> {
	const artifactPath = await writeProofJson(LOG_DIR, "response-package-backfill.json", proof);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "response package persistence backfill",
		journey: "parsed RFP to persisted drafts",
		run_id: proof.runId,
		artifact_ids: [
			path.relative(WORKSPACE_ROOT, artifactPath),
			`candidates:${proof.candidatesFound}`,
			`persisted:${proof.persisted.length}`,
			`dry_run:${String(proof.dryRun)}`,
		],
		topology_tier: "live database",
		verification_bucket: "parsed-rfp response creation",
		timestamp: proof.completedAt ?? new Date().toISOString(),
		operator: USER_ID,
		cleanup_status: proof.dryRun ? "idempotent-noop" : "not-applicable",
		disposition,
		notes: proof.persisted.length > 0
			? `Response packages ${proof.dryRun ? "validated" : "persisted"} for ${proof.persisted.length} parsed RFP opportunity(ies).`
			: proof.error ?? "No parsed RFP opportunities were eligible for response-package backfill.",
	}], { title: "Response Package Backfill Evidence" });
}

void main();
