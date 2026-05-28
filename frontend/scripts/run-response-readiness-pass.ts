import "./load-env";

import { createHash } from "node:crypto";
import path from "node:path";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
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
	opportunities,
	proposalDocuments,
	rfpRequirements,
	winThemes,
} from "@/lib/db/schema";
import { complianceEntries, complianceMatrices } from "@/lib/db/schema-rfp";
import type { ProposalDocumentType } from "@/lib/types/opportunity";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_RESPONSE_READINESS_PASS_RUN_ID ?? createProofRunId("live_response_readiness_pass");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "response-readiness-pass" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-response-readiness-pass-evidence.md");
const LIMIT = boundedNumber(process.env.LIVE_RESPONSE_READINESS_PASS_LIMIT, 5, 1, 50);
const APPLY = process.env.LIVE_RESPONSE_READINESS_PASS_APPLY === "1";
const USER_ID = (process.env.LIVE_RESPONSE_READINESS_PASS_USER_ID ?? process.env.DISCOVERY_IMPORT_USER_ID ?? "system").slice(0, 100);
const TARGET_OPPORTUNITY_IDS = csvStrings(process.env.LIVE_RESPONSE_READINESS_PASS_OPPORTUNITY_IDS);

let db: typeof import("@/lib/db")["db"];
let closeDatabaseConnection: typeof import("@/lib/db")["closeDatabaseConnection"] = async () => undefined;
let recordWorkflowRuntimeTransition: typeof import("@/lib/actions/workflow-runtime")["recordWorkflowRuntimeTransition"];
let upsertWorkflowRuntimeTask: typeof import("@/lib/actions/workflow-runtime")["upsertWorkflowRuntimeTask"];
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type CandidateRow = {
	opportunityId: string;
	title: string;
	organizationId: string;
	acceptedRequirementCount: number;
	proposalDocumentCount: number;
};

type ReadinessPassProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	apply: boolean;
	limit: number;
	targetOpportunityIds: string[];
	candidatesFound: number;
	assessed: ReadinessAssessmentSummary[];
	skipped: Array<{
		opportunityId?: string;
		title?: string;
		reason: string;
	}>;
	error?: string;
};

type ReadinessAssessmentSummary = {
	opportunityId: string;
	title: string;
	status: "ready_for_review" | "blocked";
	blockers: string[];
	warnings: string[];
	missingRequirementIds: string[];
	evaluationCriteriaIds: string[];
	draftCoveredEvaluationCriteriaIds: string[];
	winThemeCoveredEvaluationCriteriaIds: string[];
	missingWinThemeEvaluationCriteriaIds: string[];
	acceptedRequirementCount: number;
	draftedRequirementCount: number;
	requirementCoverage: number;
	documentsDrafted: number;
	complianceEntriesPresent: number;
	totalDraftWordCount: number;
	minDocumentDraftWordCount: number;
	sourceCitationCoverage: number;
	evidenceCitationCoverage: number;
	evidenceChecklistCoverage: number;
	reviewGateCoverage: number;
	draftArtifactIntegrityCoverage: number;
	winThemeCoverage: number;
	winThemeSeedCount: number;
	winThemeCriteriaCoverage: number | null;
	workflowInstanceId?: string;
	complianceMatrixId?: string;
};

type ProposalDocumentRow = {
	proposalDocumentId: string;
	documentType: string;
	documentId: string;
	wordCount: number;
	plainText: string;
	metadata: unknown;
};

type ComplianceMatrixSync = {
	matrixId: string;
	entriesCreated: number;
	entriesPresent: number;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	await loadRuntime();

	const proof: ReadinessPassProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		apply: APPLY,
		limit: LIMIT,
		targetOpportunityIds: TARGET_OPPORTUNITY_IDS,
		candidatesFound: 0,
		assessed: [],
		skipped: [],
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		const candidates = await selectReadinessCandidates();
		proof.candidatesFound = candidates.length;
		for (const candidate of candidates) {
			try {
				const summary = APPLY
					? await applyReadinessPass(candidate)
					: await assessReadiness(candidate, null, db);
				proof.assessed.push(summary);
			} catch (error) {
				proof.skipped.push({
					opportunityId: candidate.opportunityId,
					title: candidate.title,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}
		proof.completedAt = new Date().toISOString();
		disposition = proof.assessed.some((item) => item.status === "ready_for_review")
			? "pass"
			: proof.assessed.length > 0 ? "partial" : "blocked";
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

async function loadRuntime(): Promise<void> {
	const [databaseModule, workflowRuntimeModule] = await Promise.all([
		import("@/lib/db"),
		import("@/lib/actions/workflow-runtime"),
	]);
	db = databaseModule.db;
	closeDatabaseConnection = databaseModule.closeDatabaseConnection;
	recordWorkflowRuntimeTransition = workflowRuntimeModule.recordWorkflowRuntimeTransition;
	upsertWorkflowRuntimeTask = workflowRuntimeModule.upsertWorkflowRuntimeTask;
}

async function selectReadinessCandidates(): Promise<CandidateRow[]> {
	const conditions = [
		sql`${opportunities.organizationId} is not null`,
		sql`exists (
			select 1 from rfp_requirements
			where rfp_requirements.opportunity_id = ${opportunities.id}
				and rfp_requirements.compliance_status <> 'not_applicable'
				and rfp_requirements.metadata->'workflow'->>'state' = 'accepted'
		)`,
		sql`exists (
			select 1 from proposal_documents
			join documents on documents.id = proposal_documents.document_id
			where proposal_documents.opportunity_id = ${opportunities.id}
				and coalesce(documents.plain_text, '') <> ''
		)`,
	];
	if (TARGET_OPPORTUNITY_IDS.length > 0) {
		conditions.push(inArray(opportunities.id, TARGET_OPPORTUNITY_IDS));
	} else {
		conditions.push(sql`exists (
			select 1 from workflow_instances
			where workflow_instances.workflow_key = 'proposal_response_package'
				and workflow_instances.subject_type = 'opportunity'
				and workflow_instances.subject_id = ${opportunities.id}::text
				and coalesce(workflow_instances.metadata->'readiness'->>'status', '') <> 'ready_for_review'
		)`);
	}

	return db
		.select({
			opportunityId: opportunities.id,
			title: opportunities.title,
			organizationId: sql<string>`${opportunities.organizationId}`,
			acceptedRequirementCount: sql<number>`0`,
			proposalDocumentCount: sql<number>`0`,
		})
		.from(opportunities)
		.where(and(...conditions))
		.orderBy(sql`(
			select max(proposal_documents.updated_at)
			from proposal_documents
			where proposal_documents.opportunity_id = ${opportunities.id}
		) desc nulls last`)
		.limit(LIMIT);
}

async function applyReadinessPass(candidate: CandidateRow): Promise<ReadinessAssessmentSummary> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.opportunityId}))`);
		const compliance = await ensureComplianceMatrix(candidate, tx);
		const assessment = await assessReadiness(candidate, compliance, tx);
		const instance = await recordWorkflowRuntimeTransition({
			workflowKey: "proposal_response_package",
			organizationId: candidate.organizationId,
			subjectType: "opportunity",
			subjectId: candidate.opportunityId,
			opportunityId: candidate.opportunityId,
			fromState: "response_package_drafted",
			toState: "response_package_drafted",
			eventType: "response_readiness_pass",
			actorId: USER_ID,
			actorName: USER_ID,
			reason: "Standard response readiness pass assessed persisted response package",
			evidenceLinks: [
				`compliance-matrix:${assessment.complianceMatrixId}`,
				...assessmentIds(candidate.opportunityId),
			],
			priority: assessment.status === "ready_for_review" ? "high" : "critical",
			visibility: "internal",
			metadata: {
				readiness: readinessMetadata(assessment),
				complianceMatrixId: assessment.complianceMatrixId,
				source: "response-readiness-pass",
				runId: RUN_ID,
			},
			terminal: false,
			actionUrl: `/opportunities/${candidate.opportunityId}/documents`,
		}, tx);

		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `response-package-review:${candidate.opportunityId}`,
			title: assessment.status === "ready_for_review"
				? "Review drafted response package"
				: "Resolve response package readiness blockers",
			description: assessment.status === "ready_for_review"
				? "Review persisted response documents, compliance matrix entries, citation maps, and win themes before final package rendering."
				: `Resolve response package readiness blockers before final rendering.\n${assessment.blockers.join("\n")}`,
			state: assessment.status === "ready_for_review" ? "open" : "blocked",
			priority: assessment.status === "ready_for_review" ? "high" : "critical",
			assignedTo: USER_ID,
			assignedRole: "proposal_manager",
			dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
			metadata: readinessMetadata(assessment),
		}, tx);
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `final-package-render:${candidate.opportunityId}`,
			title: assessment.status === "ready_for_review"
				? "Render approved final package"
				: "Final package render blocked by response readiness",
			description: assessment.status === "ready_for_review"
				? "Render the approved response documents into final submission artifacts after response package review is complete."
				: "Final package rendering is blocked until response package readiness passes.",
			state: assessment.status === "ready_for_review" ? "open" : "blocked",
			priority: assessment.status === "ready_for_review" ? "medium" : "high",
			assignedTo: USER_ID,
			assignedRole: "proposal_manager",
			dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
			metadata: readinessMetadata(assessment),
		}, tx);

		await tx
			.update(proposalDocuments)
			.set({
				status: assessment.status === "ready_for_review" ? "in_review" : "drafting",
				updatedAt: new Date(),
			})
			.where(eq(proposalDocuments.opportunityId, candidate.opportunityId));

		return {
			...assessment,
			workflowInstanceId: instance.id,
		};
	});
}

async function assessReadiness(
	candidate: CandidateRow,
	compliance: ComplianceMatrixSync | null,
	client: DbClient
): Promise<ReadinessAssessmentSummary> {
	const [requirements, docs, themes] = await Promise.all([
		client
			.select()
			.from(rfpRequirements)
			.where(and(
				eq(rfpRequirements.opportunityId, candidate.opportunityId),
				sql`${rfpRequirements.complianceStatus} <> 'not_applicable'`,
				sql`${rfpRequirements.metadata}->'workflow'->>'state' = 'accepted'`,
			)),
		client
			.select({
				proposalDocumentId: proposalDocuments.id,
				documentType: proposalDocuments.documentType,
				documentId: documents.id,
				wordCount: sql<number>`coalesce(${documents.wordCount}, 0)::int`,
				plainText: sql<string>`coalesce(${documents.plainText}, '')`,
				metadata: documents.metadata,
			})
			.from(proposalDocuments)
			.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
			.where(eq(proposalDocuments.opportunityId, candidate.opportunityId))
			.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt)),
		client
			.select()
			.from(winThemes)
			.where(and(eq(winThemes.opportunityId, candidate.opportunityId), eq(winThemes.isActive, true))),
	]);

	const documentIds = new Set(docs.map((doc) => doc.documentId));
	const docsById = new Map(docs.map((doc) => [doc.documentId, doc]));
	const missingRequirementIds = requirements
		.filter((requirement) => !requirement.responseDocumentId || !documentIds.has(requirement.responseDocumentId))
		.map((requirement) => requirement.id);
	const draftedRequirementCount = requirements.length - missingRequirementIds.length;
	const documentsDrafted = docs.filter((doc) => doc.plainText.trim().length > 0).length;
	const sourceCitationCount = docs.filter(hasSourceCitationMap).length;
	const evidenceCitationCount = docs.filter(hasEvidenceCitationMap).length;
	const evidenceChecklistCount = docs.filter(hasEvidenceChecklist).length;
	const reviewGateCount = docs.filter(hasReviewGate).length;
	const artifactCount = docs.filter(hasCurrentDraftArtifact).length;
	const docsWithWinTheme = docs.filter((doc) => themes.some((theme) =>
		stringArray(theme.targetSections).includes(doc.documentType)
	)).length;
	const evaluationCriteriaIds = uniqueStrings(docs.flatMap((doc) =>
		stringArray(recordObject(doc.metadata).evaluationCriteriaIds)
	));
	const draftCoveredEvaluationCriteriaIds = uniqueStrings(docs.flatMap((doc) =>
		stringArray(recordObject(doc.metadata).evaluationCriteriaIds)
	));
	const winThemeCoveredEvaluationCriteriaIds = uniqueStrings(themes.flatMap((theme) =>
		stringArray(theme.evaluationCriteriaIds)
	));
	const missingWinThemeEvaluationCriteriaIds = evaluationCriteriaIds.filter((id) =>
		!winThemeCoveredEvaluationCriteriaIds.includes(id)
	);
	const wordCounts = docs.map((doc) => doc.wordCount ?? countWords(doc.plainText));
	const totalDraftWordCount = wordCounts.reduce((total, count) => total + count, 0);
	const minDocumentDraftWordCount = wordCounts.length > 0 ? Math.min(...wordCounts) : 0;
	const requirementCoverage = ratio(draftedRequirementCount, requirements.length);
	const sourceCitationCoverage = ratio(sourceCitationCount, documentsDrafted);
	const evidenceCitationCoverage = ratio(evidenceCitationCount, documentsDrafted);
	const evidenceChecklistCoverage = ratio(evidenceChecklistCount, documentsDrafted);
	const reviewGateCoverage = ratio(reviewGateCount, documentsDrafted);
	const draftArtifactIntegrityCoverage = ratio(artifactCount, documentsDrafted);
	const winThemeCoverage = ratio(docsWithWinTheme, documentsDrafted);
	const winThemeCriteriaCoverage = evaluationCriteriaIds.length > 0
		? ratio(evaluationCriteriaIds.length - missingWinThemeEvaluationCriteriaIds.length, evaluationCriteriaIds.length)
		: null;
	const complianceEntriesPresent = compliance?.entriesPresent ?? await countComplianceEntries(candidate.opportunityId, requirements.map((req) => req.id), client);

	const blockers: string[] = [];
	const warnings: string[] = [];
	if (requirements.length === 0) blockers.push("No accepted requirements were available for response package readiness");
	if (missingRequirementIds.length > 0) blockers.push(`${missingRequirementIds.length} accepted requirement(s) are not linked to persisted response documents`);
	if (documentsDrafted === 0) blockers.push("No persisted response documents were available for readiness assessment");
	if (documentsDrafted > 0 && minDocumentDraftWordCount < 80) blockers.push(`At least one response document is below the 80-word quality floor (${minDocumentDraftWordCount} words)`);
	if (documentsDrafted > 0 && sourceCitationCoverage < 1) blockers.push("At least one response document is missing a source citation map");
	if (documentsDrafted > 0 && evidenceCitationCoverage < 1) blockers.push("At least one response document is missing a Datacraft evidence citation map");
	if (documentsDrafted > 0 && evidenceChecklistCoverage < 1) blockers.push("At least one response document is missing Datacraft evidence guidance");
	if (documentsDrafted > 0 && reviewGateCoverage < 1) blockers.push("At least one response document is missing review gates");
	if (documentsDrafted > 0 && draftArtifactIntegrityCoverage < 1) blockers.push("At least one response document has a missing or stale draft artifact manifest");
	if (winThemeCriteriaCoverage !== null && winThemeCriteriaCoverage < 1) blockers.push("Not all evaluator criteria are mapped to win theme seeds");
	if (complianceEntriesPresent < requirements.length) warnings.push(`${complianceEntriesPresent}/${requirements.length} accepted requirement(s) have compliance matrix entries`);
	if (documentsDrafted > 0 && winThemeCoverage < 1) warnings.push(`${docsWithWinTheme}/${documentsDrafted} response document(s) have directly targeted win themes`);

	return {
		opportunityId: candidate.opportunityId,
		title: candidate.title,
		status: blockers.length === 0 ? "ready_for_review" : "blocked",
		blockers,
		warnings,
		missingRequirementIds,
		evaluationCriteriaIds,
		draftCoveredEvaluationCriteriaIds,
		winThemeCoveredEvaluationCriteriaIds,
		missingWinThemeEvaluationCriteriaIds,
		acceptedRequirementCount: requirements.length,
		draftedRequirementCount,
		requirementCoverage,
		documentsDrafted,
		complianceEntriesPresent,
		totalDraftWordCount,
		minDocumentDraftWordCount,
		sourceCitationCoverage,
		evidenceCitationCoverage,
		evidenceChecklistCoverage,
		reviewGateCoverage,
		draftArtifactIntegrityCoverage,
		winThemeCoverage,
		winThemeSeedCount: themes.length,
		winThemeCriteriaCoverage,
		complianceMatrixId: compliance?.matrixId,
	};
}

async function ensureComplianceMatrix(
	candidate: CandidateRow,
	client: DbClient
): Promise<ComplianceMatrixSync> {
	const requirements = await client
		.select()
		.from(rfpRequirements)
		.where(and(
			eq(rfpRequirements.opportunityId, candidate.opportunityId),
			sql`${rfpRequirements.complianceStatus} <> 'not_applicable'`,
			sql`${rfpRequirements.metadata}->'workflow'->>'state' = 'accepted'`,
		))
		.orderBy(asc(rfpRequirements.createdAt));
	if (requirements.length === 0) {
		throw new Error("No accepted requirements are available for compliance matrix sync");
	}

	const [existingMatrix] = await client
		.select()
		.from(complianceMatrices)
		.where(and(
			eq(complianceMatrices.opportunityId, candidate.opportunityId),
			eq(complianceMatrices.organizationId, candidate.organizationId)
		))
		.orderBy(asc(complianceMatrices.version))
		.limit(1);
	const matrix = existingMatrix ?? await createComplianceMatrix(candidate, requirements, client);
	const requirementIds = requirements.map((requirement) => requirement.id);
	const existingEntries = await client
		.select()
		.from(complianceEntries)
		.where(and(
			eq(complianceEntries.matrixId, matrix.id),
			eq(complianceEntries.organizationId, candidate.organizationId),
			inArray(complianceEntries.requirementId, requirementIds)
		));
	const existingRequirementIds = new Set(existingEntries.map((entry) => entry.requirementId));
	const missingRequirements = requirements.filter((requirement) => !existingRequirementIds.has(requirement.id));
	if (missingRequirements.length > 0) {
		await client.insert(complianceEntries).values(missingRequirements.map((requirement, index) => ({
			organizationId: candidate.organizationId,
			matrixId: matrix.id,
			requirementId: requirement.id,
			complianceStatus: requirement.complianceStatus === "compliant" ? "compliant" : "partial",
			complianceJustification: requirement.responseStrategy ?? "Accepted requirement linked during response readiness pass.",
			responseDocumentId: requirement.responseDocumentId,
			responseReference: requirement.responseSection,
			responseSummary: compactText(requirement.responseStrategy ?? requirement.requirementText, 500),
			strengthAssessment: requirement.complianceStatus === "compliant" ? "strong" : "adequate",
			riskLevel: requirement.riskLevel,
			status: "draft",
			assignedTo: requirement.assignedTo,
			dueDate: requirement.dueDate,
			completionPercent: requirement.complianceStatus === "compliant" ? 100 : 60,
			sortOrder: existingEntries.length + index,
			evidenceReferences: buildRequirementEvidenceReferences(requirement),
			metadata: {
				source: "response-readiness-pass",
				runId: RUN_ID,
				linkedAt: new Date().toISOString(),
			},
		})));
	}

	await client
		.update(complianceMatrices)
		.set({
			totalRequirements: requirements.length,
			mandatoryCount: requirements.filter((requirement) => requirement.priority === "mandatory").length,
			compliantCount: requirements.filter((requirement) => requirement.complianceStatus === "compliant").length,
			partialCount: requirements.filter((requirement) => requirement.complianceStatus === "partial").length,
			nonCompliantCount: requirements.filter((requirement) => requirement.complianceStatus === "non_compliant").length,
			notAddressedCount: requirements.filter((requirement) => requirement.complianceStatus === "not_addressed").length,
			complianceScore: complianceScore(requirements),
			metadata: {
				...recordObject(matrix.metadata),
				responseReadinessPass: {
					runId: RUN_ID,
					syncedAt: new Date().toISOString(),
					requirementIds,
				},
			},
			updatedAt: new Date(),
		})
		.where(and(eq(complianceMatrices.id, matrix.id), eq(complianceMatrices.organizationId, candidate.organizationId)));

	return {
		matrixId: matrix.id,
		entriesCreated: missingRequirements.length,
		entriesPresent: existingEntries.length + missingRequirements.length,
	};
}

async function createComplianceMatrix(
	candidate: CandidateRow,
	requirements: Array<typeof rfpRequirements.$inferSelect>,
	client: DbClient
): Promise<typeof complianceMatrices.$inferSelect> {
	const [matrix] = await client.insert(complianceMatrices).values({
		organizationId: candidate.organizationId,
		opportunityId: candidate.opportunityId,
		rfpDocumentId: requirements[0]?.rfpDocumentId ?? null,
		name: "Response Readiness Compliance Matrix",
		description: "Generated from accepted requirements during the response readiness pass.",
		totalRequirements: requirements.length,
		mandatoryCount: requirements.filter((requirement) => requirement.priority === "mandatory").length,
		partialCount: requirements.filter((requirement) => requirement.complianceStatus === "partial").length,
		notAddressedCount: requirements.filter((requirement) => requirement.complianceStatus === "not_addressed").length,
		complianceScore: complianceScore(requirements),
		createdBy: USER_ID,
		metadata: {
			source: "response-readiness-pass",
			runId: RUN_ID,
			createdFromRequirementIds: requirements.map((requirement) => requirement.id),
		},
	}).returning();
	if (!matrix) throw new Error("Failed to create response readiness compliance matrix");
	return matrix;
}

async function countComplianceEntries(opportunityId: string, requirementIds: string[], client: DbClient): Promise<number> {
	if (requirementIds.length === 0) return 0;
	const [row] = await client
		.select({ count: sql<number>`count(${complianceEntries.id})::int` })
		.from(complianceEntries)
		.innerJoin(complianceMatrices, eq(complianceMatrices.id, complianceEntries.matrixId))
		.where(and(
			eq(complianceMatrices.opportunityId, opportunityId),
			inArray(complianceEntries.requirementId, requirementIds)
		));
	return row?.count ?? 0;
}

function readinessMetadata(assessment: ReadinessAssessmentSummary) {
	return {
		status: assessment.status,
		blockers: assessment.blockers,
		warnings: assessment.warnings,
		missingRequirementIds: assessment.missingRequirementIds,
		evaluationCriteriaIds: assessment.evaluationCriteriaIds,
		draftCoveredEvaluationCriteriaIds: assessment.draftCoveredEvaluationCriteriaIds,
		winThemeCoveredEvaluationCriteriaIds: assessment.winThemeCoveredEvaluationCriteriaIds,
		missingDraftEvaluationCriteriaIds: [],
		missingWinThemeEvaluationCriteriaIds: assessment.missingWinThemeEvaluationCriteriaIds,
		metrics: {
			acceptedRequirementCount: assessment.acceptedRequirementCount,
			draftedRequirementCount: assessment.draftedRequirementCount,
			requirementCoverage: assessment.requirementCoverage,
			documentsDrafted: assessment.documentsDrafted,
			sectionsDrafted: assessment.documentsDrafted,
			complianceEntriesCreated: assessment.complianceEntriesPresent,
			totalDraftWordCount: assessment.totalDraftWordCount,
			minDocumentDraftWordCount: assessment.minDocumentDraftWordCount,
			evidenceChecklistCoverage: assessment.evidenceChecklistCoverage,
			evidenceCitationCoverage: assessment.evidenceCitationCoverage,
			draftArtifactIntegrityCoverage: assessment.draftArtifactIntegrityCoverage,
			reviewGateCoverage: assessment.reviewGateCoverage,
			sourceCitationCoverage: assessment.sourceCitationCoverage,
			winThemeCoverage: assessment.winThemeCoverage,
			winThemeSeedCount: assessment.winThemeSeedCount,
			...(assessment.winThemeCriteriaCoverage === null ? {} : {
				winThemeCriteriaCoverage: assessment.winThemeCriteriaCoverage,
			}),
			unresolvedPlaceholderCount: 0,
		},
	};
}

function hasSourceCitationMap(doc: ProposalDocumentRow): boolean {
	return doc.plainText.includes("## Source Citation Map")
		&& (doc.plainText.includes("Source requirement") || doc.plainText.includes("Evaluator criterion"));
}

function hasEvidenceCitationMap(doc: ProposalDocumentRow): boolean {
	return doc.plainText.includes("## Datacraft Evidence Citation Map")
		&& doc.plainText.includes("- Evidence ");
}

function hasEvidenceChecklist(doc: ProposalDocumentRow): boolean {
	return doc.plainText.includes("## Evidence Checklist")
		|| doc.plainText.includes("## Datacraft Evidence To Weave In");
}

function hasReviewGate(doc: ProposalDocumentRow): boolean {
	return doc.plainText.includes("## Review Gate") || doc.plainText.includes("## Review Gates");
}

function hasCurrentDraftArtifact(doc: ProposalDocumentRow): boolean {
	const artifact = recordObject(recordObject(doc.metadata).draftArtifact);
	const plainText = doc.plainText;
	return artifact.format === "markdown"
		&& artifact.filename === `${doc.documentType}.md`
		&& artifact.contentHash === sha256Hex(plainText)
		&& artifact.sizeBytes === Buffer.byteLength(plainText, "utf8")
		&& artifact.sizeBytes > 0
		&& typeof artifact.generatedAt === "string";
}

function buildRequirementEvidenceReferences(requirement: typeof rfpRequirements.$inferSelect): string[] {
	return [
		requirement.rfpDocumentId ? `rfp-document:${requirement.rfpDocumentId}` : null,
		requirement.sourceSection ? `rfp-section:${requirement.sourceSection}` : null,
		requirement.sourcePage != null ? `rfp-page:${requirement.sourcePage}` : null,
		requirement.responseDocumentId ? `response-document:${requirement.responseDocumentId}` : null,
	].filter((value): value is string => Boolean(value));
}

function assessmentIds(opportunityId: string): string[] {
	return [`opportunity:${opportunityId}`, `readiness-pass:${RUN_ID}`];
}

function complianceScore(requirements: Array<typeof rfpRequirements.$inferSelect>): number {
	if (requirements.length === 0) return 0;
	const score = requirements.reduce((total, requirement) => {
		if (requirement.complianceStatus === "compliant") return total + 100;
		if (requirement.complianceStatus === "partial") return total + 60;
		return total;
	}, 0) / requirements.length;
	return Math.round(score);
}

function countWords(value: string): number {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

function ratio(numerator: number, denominator: number): number {
	return denominator > 0 ? numerator / denominator : 0;
}

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
}

function compactText(value: string | null | undefined, maxLength: number): string | null {
	const normalized = value?.replace(/\s+/g, " ").trim();
	if (!normalized) return null;
	return normalized.length > maxLength ? normalized.slice(0, maxLength - 3).trimEnd() + "..." : normalized;
}

function boundedNumber(raw: string | undefined, defaultValue: number, min: number, max: number): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function csvStrings(raw: string | undefined): string[] {
	return raw
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean) ?? [];
}

async function writeArtifacts(proof: ReadinessPassProof, disposition: EvidenceRecord["disposition"]): Promise<void> {
	const artifactPath = await writeProofJson(LOG_DIR, "response-readiness-pass.json", proof);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "response readiness pass",
		journey: "accepted requirements to final-render readiness",
		run_id: proof.runId,
		artifact_ids: [
			path.relative(WORKSPACE_ROOT, artifactPath),
			`candidates:${proof.candidatesFound}`,
			`assessed:${proof.assessed.length}`,
			`ready:${proof.assessed.filter((item) => item.status === "ready_for_review").length}`,
			`apply:${String(proof.apply)}`,
		],
		topology_tier: "live database",
		verification_bucket: "persisted response readiness",
		timestamp: proof.completedAt ?? new Date().toISOString(),
		operator: USER_ID,
		cleanup_status: proof.apply ? "not-applicable" : "idempotent-noop",
		disposition,
		notes: proof.assessed.length > 0
			? `Assessed ${proof.assessed.length} persisted response package(s); ${proof.assessed.filter((item) => item.status === "ready_for_review").length} ready for review.`
			: proof.error ?? "No persisted response packages were eligible for readiness assessment.",
	}], { title: "Response Readiness Pass Evidence" });
}

void main();
