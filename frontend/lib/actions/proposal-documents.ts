/**
 * Proposal Documents Server Actions - DocFusion
 *
 * Server actions for managing proposal documents and their relationship
 * to opportunities. Handles document creation, linking, status tracking,
 * and progress calculations.
 */

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { documents, documentVersions, proposalDocuments, documentSections, opportunities } from "@/lib/db/schema";
import { complianceEntries, complianceMatrices, rfpRequirements } from "@/lib/db/schema-rfp";
import { winThemes } from "@/lib/db/schema-win-themes";
import { workflowInstances } from "@/lib/db/schema-workflow-runtime";
import { eq, and, asc, sql, inArray, isNull, or, type SQL } from "drizzle-orm";
import type {
	ProposalDocument,
	ProposalDocumentType,
	ProposalDocumentStatus,
	CreateProposalDocumentInput,
	LinkDocumentInput,
	UpdateProposalDocumentInput,
	ProposalProgress,
	DocumentSection,
	CreateSectionInput,
	UpdateSectionInput,
	SectionProgress,
	DocumentSectionStatus,
	ExportFormat,
	ResponsePackageReadinessSummary,
} from "@/lib/types/opportunity";
import type { DocumentContent } from "@/lib/types/document";
import { getDocumentTypeLabel } from "@/lib/utils/proposal-labels";
import {
	transitionFinalArtifactWorkflow,
	type FinalArtifactAction,
} from "@/lib/actions/final-artifact-workflow";
import {
	getDatacraftProposalDocumentContent,
	getDatacraftProposalSectionSeeds,
} from "@/lib/data/datacraft-response-content";
import {
	requireUserContext,
	userHasAuthorityRole,
	type UserContext,
} from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

export interface ProposalDocumentFinalizationInput {
	action: FinalArtifactAction;
	reason: string;
	format?: ExportFormat;
	approvalRole?: string;
}

function revalidateProposalWorkflowPaths(opportunityId: string): void {
	revalidatePath(`/opportunities/${opportunityId}`);
	revalidatePath(`/opportunities/${opportunityId}/requirements`);
	revalidatePath(`/opportunities/${opportunityId}/documents`);
	revalidatePath(`/opportunities/${opportunityId}/submission`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps database row to ProposalDocument type.
 */
function mapProposalDocument(
	row: typeof proposalDocuments.$inferSelect,
	doc?: typeof documents.$inferSelect | null
): ProposalDocument {
	const metadata = asRecord(doc?.metadata);
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		documentId: row.documentId,
		documentType: row.documentType as ProposalDocumentType,
		sectionOrder: row.sectionOrder,
		status: row.status as ProposalDocumentStatus,
		assignedTo: row.assignedTo,
		dueDate: row.dueDate,
		reviewerId: row.reviewerId,
		approvedBy: row.approvedBy,
		approvedAt: row.approvedAt,
		aiAnalysisScore: row.aiAnalysisScore,
		aiAnalysisAt: row.aiAnalysisAt,
		notes: row.notes,
		renderedArtifact: latestRenderedArtifact(metadata),
		finalArtifact: artifactSummary(metadata.finalArtifact),
		finalSubmissionSignoff: signoffSummary(metadata.finalSubmissionSignoff),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		document: doc
			? {
					id: doc.id,
					title: doc.title,
					wordCount: doc.wordCount,
					status: doc.status,
					updatedAt: doc.updatedAt,
			  }
			: undefined,
	};
}

function latestRenderedArtifact(metadata: unknown): ProposalDocument["renderedArtifact"] {
	const renderedArtifacts = asRecord(asRecord(metadata).renderedArtifacts);
	const preferred = artifactSummary(renderedArtifacts.docx) ?? artifactSummary(renderedArtifacts.pdf);
	if (preferred) {
		return preferred;
	}
	for (const candidate of Object.values(renderedArtifacts).reverse()) {
		const artifact = artifactSummary(candidate);
		if (artifact) {
			return artifact;
		}
	}
	return null;
}

function artifactSummary(value: unknown): ProposalDocument["finalArtifact"] {
	const record = asRecord(value);
	const format = typeof record.format === "string" ? record.format : null;
	if (!isExportFormat(format) || typeof record.artifactHash !== "string" || typeof record.filename !== "string") {
		return null;
	}
	return {
		format,
		filename: record.filename,
		artifactHash: record.artifactHash,
		downloadUrl: typeof record.downloadUrl === "string" ? record.downloadUrl : null,
		storagePath: typeof record.storagePath === "string" ? record.storagePath : null,
		storageBucket: typeof record.storageBucket === "string" ? record.storageBucket : null,
		storageKey: typeof record.storageKey === "string" ? record.storageKey : null,
		storageEtag: typeof record.storageEtag === "string" ? record.storageEtag : null,
		storageEndpoint: typeof record.storageEndpoint === "string" ? record.storageEndpoint : null,
		approvedBy: typeof record.approvedBy === "string" ? record.approvedBy : null,
		approvedAt: typeof record.approvedAt === "string" || record.approvedAt instanceof Date ? record.approvedAt : null,
		sourceDocumentVersion: typeof record.sourceDocumentVersion === "number" ? record.sourceDocumentVersion : null,
		sourceContentHash: typeof record.sourceContentHash === "string" ? record.sourceContentHash : null,
		renderedAt: typeof record.renderedAt === "string" || record.renderedAt instanceof Date ? record.renderedAt : null,
	};
}

function signoffSummary(value: unknown): ProposalDocument["finalSubmissionSignoff"] {
	const record = asRecord(value);
	if (typeof record.signedBy !== "string" || !(typeof record.signedAt === "string" || record.signedAt instanceof Date)) {
		return null;
	}
	return {
		signedBy: record.signedBy,
		signedAt: record.signedAt,
		signoffRole: typeof record.signoffRole === "string" ? record.signoffRole : null,
	};
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function isExportFormat(value: string | null): value is ExportFormat {
	return value === "pdf" ||
		value === "docx" ||
		value === "pptx" ||
		value === "latex" ||
		value === "markdown" ||
		value === "html";
}

/**
 * Maps database row to DocumentSection type.
 */
function mapDocumentSection(row: typeof documentSections.$inferSelect): DocumentSection {
	return {
		id: row.id,
		proposalDocumentId: row.proposalDocumentId,
		sectionName: row.sectionName,
		sectionOrder: row.sectionOrder,
		status: row.status as DocumentSectionStatus,
		wordCount: row.wordCount,
		targetWordCount: row.targetWordCount,
		assignedTo: row.assignedTo,
		dueDate: row.dueDate,
		requirementIds: (row.requirementIds as string[]) || [],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function extractPlainText(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content.map(extractPlainText).filter(Boolean).join(" ");
	}

	if (content && typeof content === "object") {
		const record = content as Record<string, unknown>;
		const ownText = typeof record.text === "string" ? record.text : "";
		const childText = extractPlainText(record.content);
		return [ownText, childText].filter(Boolean).join(" ");
	}

	return "";
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

type ContentNode = NonNullable<DocumentContent["content"]>[number];

type OpportunityResponseContext = Pick<
	typeof opportunities.$inferSelect,
	| "id"
	| "title"
	| "organization"
	| "sector"
	| "countryRegion"
	| "category"
	| "deadline"
	| "budgetValue"
	| "projectSummary"
	| "projectScope"
	| "keyRequirements"
	| "technicalRequirements"
	| "submissionRequirements"
	| "fitScore"
	| "winProbability"
	| "strategicNotes"
>;

export interface RequirementAwareSectionDraftResult {
	sectionId: string;
	proposalDocumentId: string;
	documentId: string;
	requirementIds: string[];
	winThemeIds: string[];
	content: DocumentContent;
	plainText: string;
	wordCount: number;
	characterCount: number;
	versionNumber: number;
}

export interface RequirementAwareProposalDraftResult {
	proposalDocumentId: string;
	documentId: string;
	sectionsDrafted: number;
	requirementIds: string[];
	winThemeIds: string[];
	wordCount: number;
	unresolvedPlaceholderCount: number;
	evidenceChecklistCount: number;
	reviewGateCount: number;
	versionNumber: number | null;
}

export interface ResponsePackageDraftResult {
	documentsCreated: number;
	documentsDrafted: number;
	sectionsDrafted: number;
	complianceMatrixId: string;
	complianceEntriesCreated: number;
	requirementIds: string[];
	proposalDocumentIds: string[];
	documentIds: string[];
	versionNumber: number | null;
	readiness: ResponsePackageDraftReadiness;
}

export interface ResponsePackageDraftReadiness {
	status: "ready_for_review" | "blocked";
	blockers: string[];
	warnings: string[];
	missingRequirementIds: string[];
	metrics: {
		acceptedRequirementCount: number;
		draftedRequirementCount: number;
		requirementCoverage: number;
		documentsDrafted: number;
		sectionsDrafted: number;
		complianceEntriesCreated: number;
		totalDraftWordCount: number;
		minDocumentDraftWordCount: number;
		evidenceChecklistCoverage: number;
		reviewGateCoverage: number;
		winThemeCoverage: number;
		unresolvedPlaceholderCount: number;
	};
}

interface ProposalDocumentCreationOptions {
	seedAcceptedRequirementsOnly?: boolean;
}

interface StandardProposalSetOptions extends ProposalDocumentCreationOptions {}

function textNode(text: string): ContentNode {
	return { type: "text", text };
}

function headingNode(level: number, text: string): ContentNode {
	return {
		type: "heading",
		attrs: { level },
		content: [textNode(text)],
	};
}

function paragraphNode(text: string): ContentNode {
	return {
		type: "paragraph",
		content: [textNode(text)],
	};
}

function bulletListNode(items: string[]): ContentNode {
	return {
		type: "bulletList",
		content: items.map((item) => ({
			type: "listItem",
			content: [paragraphNode(item)],
		})),
	};
}

function compactText(value: string | null | undefined, maxLength = 260): string | null {
	const normalized = value?.replace(/\s+/g, " ").trim();
	if (!normalized) return null;
	return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function formatDate(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

type ProposalDocumentUserContext = UserContext & { organizationId: string };
type ResponsePackageWorkflowRow = Pick<
	typeof workflowInstances.$inferSelect,
	"id" | "state" | "metadata"
>;

function isAcceptedRequirement(requirement: typeof rfpRequirements.$inferSelect): boolean {
	const metadata = isRecord(requirement.metadata) ? requirement.metadata : {};
	const workflow = isRecord(metadata.workflow) ? metadata.workflow : {};
	return workflow.state === "accepted";
}

function isFinalProposalStatus(status: ProposalDocumentStatus | undefined): boolean {
	return status === "approved" || status === "final";
}

function isRequirementReadyForFinal(status: string | null): boolean {
	return ["addressed", "compliant", "not_applicable"].includes(status ?? "");
}

async function requireProposalDocumentContext(): Promise<ProposalDocumentUserContext> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
	return userContext as ProposalDocumentUserContext;
}

async function requireProposalDocumentMutationActor(
	finalStatus: boolean
): Promise<ProposalDocumentUserContext> {
	const userContext = await requireProposalDocumentContext();
	if (!finalStatus) {
		return userContext;
	}
	requireProposalDocumentApprovalAuthority(userContext);
	return userContext;
}

function requireProposalDocumentApprovalAuthority(userContext: UserContext) {
	const requiredRoles = ["proposal_manager", "capture_manager"];
	if (requiredRoles.some((role) => userHasAuthorityRole(userContext, role))) {
		return;
	}
	throw new Error(
		`Approving or finalizing a proposal document requires proposal approval authority: requires ${requiredRoles.join(" or ")}`
	);
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string, organizationId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (opportunities.organization_id = ${organizationId} or opportunities.organization_id is null)
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, userId: string, organizationId: string): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId, organizationId)
	)!;
}

function proposalDocumentOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(proposalDocuments.organizationId, organizationId),
		isNull(proposalDocuments.organizationId)
	)!;
}

function documentSectionOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(documentSections.organizationId, organizationId),
		isNull(documentSections.organizationId)
	)!;
}

function visibleProposalDocumentsForOpportunityCondition(opportunityId: string, userId: string, organizationId?: string): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		organizationId ? proposalDocumentOrganizationCondition(organizationId) : undefined,
		organizationId ? assignedOpportunityExistsSql(opportunityId, userId, organizationId) : undefined
	)!;
}

function visibleProposalDocumentCondition(id: string, userId: string, organizationId?: string): SQL {
	return and(
		eq(proposalDocuments.id, id),
		organizationId ? proposalDocumentOrganizationCondition(organizationId) : undefined,
		organizationId ? assignedOpportunityExistsSql(proposalDocuments.opportunityId, userId, organizationId) : undefined
	)!;
}

function visibleDocumentSectionsForProposalCondition(proposalDocumentId: string, userId: string, organizationId?: string): SQL {
	return and(
		eq(documentSections.proposalDocumentId, proposalDocumentId),
		organizationId ? documentSectionOrganizationCondition(organizationId) : undefined,
		sql`exists (
			select 1
			from proposal_documents
			join opportunities on opportunities.id = proposal_documents.opportunity_id
			where proposal_documents.id = ${proposalDocumentId}
				${organizationId ? sql`and (proposal_documents.organization_id = ${organizationId} or proposal_documents.organization_id is null)` : sql``}
				${organizationId ? sql`and (opportunities.organization_id = ${organizationId} or opportunities.organization_id is null)` : sql``}
				and opportunities.assigned_to = ${userId}
		)`
	)!;
}

function visibleDocumentSectionCondition(id: string, userId: string, organizationId?: string): SQL {
	return and(
		eq(documentSections.id, id),
		organizationId ? documentSectionOrganizationCondition(organizationId) : undefined,
		sql`exists (
			select 1
			from proposal_documents
			join opportunities on opportunities.id = proposal_documents.opportunity_id
			where proposal_documents.id = ${documentSections.proposalDocumentId}
				${organizationId ? sql`and (proposal_documents.organization_id = ${organizationId} or proposal_documents.organization_id is null)` : sql``}
				${organizationId ? sql`and (opportunities.organization_id = ${organizationId} or opportunities.organization_id is null)` : sql``}
				and opportunities.assigned_to = ${userId}
		)`
	)!;
}

function visibleRequirementsForOpportunityCondition(opportunityId: string, userId: string, organizationId: string): SQL {
	return and(
		eq(rfpRequirements.opportunityId, opportunityId),
		assignedOpportunityExistsSql(rfpRequirements.opportunityId, userId, organizationId)
	)!;
}

function visibleActiveWinThemesForOpportunityCondition(opportunityId: string, userId: string, organizationId: string): SQL {
	return and(
		eq(winThemes.opportunityId, opportunityId),
		eq(winThemes.isActive, true),
		assignedOpportunityExistsSql(winThemes.opportunityId, userId, organizationId)
	)!;
}

function visibleRequirementCondition(id: string, userId: string, organizationId: string): SQL {
	return and(
		eq(rfpRequirements.id, id),
		assignedOpportunityExistsSql(rfpRequirements.opportunityId, userId, organizationId)
	)!;
}

function opportunityContextBullets(opportunity: OpportunityResponseContext): string[] {
	return [
		opportunity.organization ? `Client: ${opportunity.organization}` : null,
		opportunity.sector ? `Sector: ${opportunity.sector}` : null,
		opportunity.countryRegion ? `Region: ${opportunity.countryRegion}` : null,
		opportunity.category ? `Opportunity category: ${opportunity.category}` : null,
		opportunity.deadline ? `Submission deadline: ${formatDate(opportunity.deadline)}` : null,
		opportunity.budgetValue ? `Budget signal: ${opportunity.budgetValue}` : null,
		opportunity.fitScore != null ? `Fit score: ${Math.round(opportunity.fitScore)} / 100` : null,
		opportunity.winProbability != null
			? `Win probability: ${Math.round(opportunity.winProbability)} / 100`
			: null,
	]
		.filter((item): item is string => Boolean(item));
}

function proofPointsForDocumentType(documentType: ProposalDocumentType): string[] {
	const common = [
		"Lindela proves source-cited intelligence, classification metadata, workflow state, and audit discipline in live institutional deployments.",
		"MeGuard proves offline-aware field operations, biometric verification, dispatch workflows, compliance tracking, and large-site operational analytics.",
		"Wakala proves transaction-grade reconciliation, idempotency, auditability, regulated payment integration, and disciplined exception handling.",
	];

	switch (documentType) {
		case "technical_approach":
			return [
				"Lead with a workflow-backed platform architecture: canonical data spine, explicit state transitions, integration boundary, and audit trail.",
				"Show how AI-assisted extraction, drafting, and triage preserve source references, confidence signals, and human approval.",
				...common,
			];
		case "management_plan":
			return [
				"Convert requirements into governance gates, acceptance criteria, RAID items, review tasks, and implementation evidence.",
				"Emphasize senior technical ownership, transparent delivery controls, change management, and customer-controlled release cadence.",
				...common,
			];
		case "staffing_plan":
			return [
				"Show named delivery accountability across product, architecture, engineering, security, data, QA, training, and support.",
				"Connect staffing to real operating needs: workflow modelling, migration, integrations, adoption, reporting, and hypercare.",
				...common,
			];
		case "past_performance":
			return [
				"Use Lindela, MeGuard, and Wakala as proof of adjacent workloads rather than generic corporate experience.",
				"Translate each proof point into evaluator risk reduction: production pressure, auditability, field constraints, and African-market fluency.",
				...common,
			];
		case "cost_proposal":
			return [
				"Frame price around total cost of ownership, reusable platform foundations, avoided manual reconciliation, and reduced adaptation risk.",
				"Separate assumptions, dependencies, optional scope, and value protection so evaluators can defend the commercial logic.",
				...common,
			];
		case "executive_summary":
		case "cover_letter":
			return [
				"Open with the client mandate, then position Datacraft as a lower-risk African institutional software partner.",
				"Connect the offer to sovereignty, auditability, field reality, payment rails, and compounding institutional memory.",
				...common,
			];
		default:
			return common;
	}
}

function requirementLabel(requirement: typeof rfpRequirements.$inferSelect): string {
	return (
		compactText(requirement.requirementNumber, 80) ||
		compactText(requirement.title, 80) ||
		requirement.id
	);
}

function requirementResponseLine(requirement: typeof rfpRequirements.$inferSelect): string {
	const label = requirementLabel(requirement);
	const requirementText = compactText(requirement.requirementText, 220) ?? "No requirement text captured.";
	const source =
		compactText(requirement.sourceSection, 80) ??
		(requirement.sourcePage != null ? `Page ${requirement.sourcePage}` : null);
	const strategy =
		compactText(requirement.responseStrategy, 180) ??
		compactText(requirement.suggestedApproach, 180) ??
		"Anchor the response in Datacraft's workflow, evidence, security, and delivery proof points.";
	const risk = requirement.riskLevel ? ` Risk: ${requirement.riskLevel}.` : "";
	const priority = requirement.priority ? ` Priority: ${requirement.priority}.` : "";
	const sourceText = source ? ` Source: ${source}.` : "";

	return `${label}: ${requirementText}${sourceText}${priority}${risk} Response strategy: ${strategy}`;
}

function complianceGapLine(requirement: typeof rfpRequirements.$inferSelect): string {
	const label = requirementLabel(requirement);
	const status = requirement.complianceStatus || "not_addressed";
	const strategy =
		compactText(requirement.responseStrategy, 160) ??
		compactText(requirement.suggestedApproach, 160) ??
		"Assign an owner, add evidence, and draft a direct compliant response.";

	return `${label}: current status ${status}. Close by ${strategy}`;
}

function appendResponsePlanContent(
	content: DocumentContent,
	opportunity: OpportunityResponseContext,
	documentType: ProposalDocumentType,
	requirements: Array<typeof rfpRequirements.$inferSelect>,
	activeWinThemes: Array<typeof winThemes.$inferSelect> = []
): DocumentContent {
	const opportunityBullets = opportunityContextBullets(opportunity);
	const contextNotes = [
		compactText(opportunity.projectSummary, 340),
		compactText(opportunity.projectScope, 340),
		compactText(opportunity.keyRequirements, 340),
		compactText(opportunity.technicalRequirements, 340),
		compactText(opportunity.submissionRequirements, 340),
		compactText(opportunity.strategicNotes, 340),
	].filter((note): note is string => Boolean(note));
	const complianceGaps = requirements.filter(
		(requirement) =>
			!["addressed", "compliant"].includes(requirement.complianceStatus ?? "")
	);

	const planNodes: ContentNode[] = [
		headingNode(2, "Opportunity-Specific Response Plan"),
		paragraphNode(
			`Use this section to tailor the ${getDocumentTypeLabel(documentType).toLowerCase()} for ${opportunity.title}. Replace generic claims with direct responses, source references, and evaluator-facing evidence.`
		),
	];

	if (opportunityBullets.length > 0) {
		planNodes.push(headingNode(3, "Opportunity Context"), bulletListNode(opportunityBullets));
	}

	if (contextNotes.length > 0) {
		planNodes.push(headingNode(3, "Evaluator Signals To Address"), bulletListNode(contextNotes));
	}

	if (activeWinThemes.length > 0) {
		planNodes.push(
			headingNode(3, "Approved Win Themes To Weave In"),
			bulletListNode(activeWinThemes.slice(0, 6).map(winThemeResponseLine))
		);
	}

	planNodes.push(headingNode(3, "Requirement Response Plan"));
	if (requirements.length > 0) {
		planNodes.push(bulletListNode(requirements.slice(0, 12).map(requirementResponseLine)));
	} else {
		planNodes.push(
			paragraphNode(
				"No extracted actionable requirements are linked to this document type yet. Once RFP requirements are extracted, regenerate or refresh this draft so every section has requirement-backed response cues."
			)
		);
	}

	planNodes.push(
		headingNode(3, "Datacraft Proof Points To Weave In"),
		bulletListNode(proofPointsForDocumentType(documentType))
	);

	if (complianceGaps.length > 0) {
		planNodes.push(
			headingNode(3, "Compliance Gap Closure"),
			bulletListNode(complianceGaps.slice(0, 8).map(complianceGapLine))
		);
	}

	return {
		...content,
		content: [...(content.content ?? []), ...planNodes],
	};
}

function winThemeResponseLine(theme: typeof winThemes.$inferSelect): string {
	const statement = compactText(theme.themeStatement, 220) ?? "Approved win theme";
	const shortVersion = compactText(theme.shortVersion, 120);
	const priority = theme.priority != null ? ` Priority: ${theme.priority}.` : "";
	const themeType = compactText(theme.themeType, 80);
	const evidence = Array.isArray(theme.supportingEvidence)
		? theme.supportingEvidence.map((item) => compactText(String(item), 160)).filter(Boolean)
		: [];
	const evidenceText = evidence.length > 0 ? ` Evidence: ${evidence.slice(0, 2).join("; ")}.` : "";
	const label = shortVersion ? `${shortVersion}: ` : "";

	return `${label}${statement}${themeType ? ` Theme type: ${themeType}.` : ""}${priority}${evidenceText}`;
}

function sectionRequirementDraftLine(requirement: typeof rfpRequirements.$inferSelect): string {
	const label = requirementLabel(requirement);
	const source =
		compactText(requirement.sourceSection, 80) ??
		(requirement.sourcePage != null ? `page ${requirement.sourcePage}` : "the solicitation");
	const strategy =
		compactText(requirement.responseStrategy, 220) ??
		compactText(requirement.suggestedApproach, 220) ??
		"Datacraft will address this through the proposed data spine, workflow controls, implementation governance, and auditable evidence chain.";

	return `${label}: The requirement from ${source} states "${compactText(requirement.requirementText, 220) ?? "response required"}". Response: ${strategy}`;
}

function sectionEvidenceLine(
	requirement: typeof rfpRequirements.$inferSelect,
	documentType: ProposalDocumentType
): string {
	const label = requirementLabel(requirement);
	const proof = proofPointsForDocumentType(documentType)[0];
	const risk = requirement.riskLevel ? ` Risk level: ${requirement.riskLevel}.` : "";
	const priority = requirement.priority ? ` Priority: ${requirement.priority}.` : "";

	return `${label}:${priority}${risk} Evidence to cite: ${proof}`;
}

function buildRequirementAwareSectionDraftContent(
	section: typeof documentSections.$inferSelect,
	proposalDocument: typeof proposalDocuments.$inferSelect,
	opportunity: OpportunityResponseContext,
	requirements: Array<typeof rfpRequirements.$inferSelect>,
	activeWinThemes: Array<typeof winThemes.$inferSelect> = []
): DocumentContent {
	const documentType = proposalDocument.documentType as ProposalDocumentType;
	const content: ContentNode[] = [
		headingNode(2, section.sectionName),
		paragraphNode(
			`This section responds to ${opportunity.title} for ${opportunity.organization ?? "the client"}. It should make a direct evaluator-facing claim, cite the requirement source, and connect Datacraft proof to the requested outcome.`
		),
		headingNode(3, "Direct Requirement Responses"),
	];

	if (requirements.length > 0) {
		content.push(bulletListNode(requirements.map(sectionRequirementDraftLine)));
	} else {
		content.push(
			paragraphNode(
				"No linked requirements were found for this section. Link extracted requirements before final review so the response can be traced."
			)
		);
	}

	if (activeWinThemes.length > 0) {
		content.push(
			headingNode(3, "Approved Win Themes To Weave In"),
			bulletListNode(activeWinThemes.slice(0, 6).map(winThemeResponseLine))
		);
	}

	content.push(
		headingNode(3, "Evaluator Win Angle"),
		paragraphNode(
			`Position Datacraft as the lower-risk implementation partner by tying ${getDocumentTypeLabel(documentType).toLowerCase()} claims to operational proof, African-market fit, sovereignty, auditability, and delivery discipline.`
		),
		headingNode(3, "Evidence Checklist"),
		bulletListNode(
			requirements.length > 0
				? requirements.map((requirement) => sectionEvidenceLine(requirement, documentType))
				: proofPointsForDocumentType(documentType)
		),
		headingNode(3, "Review Gate"),
		bulletListNode([
			"Confirm every mandatory requirement has a direct answer and no unsupported promise.",
			"Confirm source references, proof points, assumptions, risks, and owner follow-ups are visible before marking this section ready.",
			"Confirm the compliance matrix points back to this section after final edits.",
		])
	);

	return { type: "doc", content };
}

function markGeneratedSectionDraftNodes(nodes: ContentNode[], sectionId: string): ContentNode[] {
	return nodes.map((node) => ({
		...node,
		attrs: {
			...(isRecord(node.attrs) ? node.attrs : {}),
			generatedSectionDraft: true,
			sectionId,
		},
	}));
}

function replaceSectionDraftContent(
	documentContent: unknown,
	sectionId: string,
	draftContent: DocumentContent
): DocumentContent {
	const baseContent = isRecord(documentContent) ? documentContent as DocumentContent : { type: "doc", content: [] };
	const existingNodes = (baseContent.content ?? []).filter((node) => {
		const attrs = isRecord(node.attrs) ? node.attrs : {};
		return !(attrs.generatedSectionDraft === true && attrs.sectionId === sectionId);
	});

	return {
		...baseContent,
		type: "doc",
		content: [
			...existingNodes,
			...markGeneratedSectionDraftNodes(draftContent.content ?? [], sectionId),
		],
	};
}

function draftMetadata(
	metadata: unknown,
	section: typeof documentSections.$inferSelect,
	requirements: Array<typeof rfpRequirements.$inferSelect>,
	activeWinThemes: Array<typeof winThemes.$inferSelect>,
	generatedAt: string
): Record<string, unknown> {
	const base = isRecord(metadata) ? metadata : {};
	const existingDrafts = Array.isArray(base.requirementAwareSectionDrafts)
		? base.requirementAwareSectionDrafts.filter((draft) =>
			isRecord(draft) && draft.sectionId !== section.id
		)
		: [];

	return {
		...base,
		requirementAwareSectionDrafts: [
			...existingDrafts,
			{
				sectionId: section.id,
				sectionName: section.sectionName,
				requirementIds: requirements.map((requirement) => requirement.id),
				winThemeIds: activeWinThemes.map((theme) => theme.id),
				generatedAt,
			},
		],
	};
}

// Label utility functions are in @/lib/utils/proposal-labels.ts
// to avoid "use server" requirement for synchronous client functions

// ============================================================================
// Proposal Document CRUD Operations
// ============================================================================

/**
 * Get a single proposal document by ID.
 */
export async function getProposalDocument(id: string): Promise<ProposalDocument | null> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const results = await db
		.select()
		.from(proposalDocuments)
		.leftJoin(documents, eq(proposalDocuments.documentId, documents.id))
		.where(visibleProposalDocumentCondition(id, userId, userContext.organizationId))
		.limit(1);

	if (results.length === 0) return null;

	const { proposal_documents, documents: doc } = results[0];
	return mapProposalDocument(proposal_documents, doc);
}

/**
 * Get all proposal documents for an opportunity.
 */
export async function getProposalDocuments(
	opportunityId: string,
	includeDocument = true
): Promise<ProposalDocument[]> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	if (includeDocument) {
		const results = await db
			.select()
			.from(proposalDocuments)
			.leftJoin(documents, eq(proposalDocuments.documentId, documents.id))
			.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId))
			.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));

		return results.map(({ proposal_documents, documents: doc }) =>
			mapProposalDocument(proposal_documents, doc)
		);
	}

	const results = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));

	return results.map((row) => mapProposalDocument(row));
}

export async function getResponsePackageReadiness(
	opportunityId: string
): Promise<ResponsePackageReadinessSummary> {
	const userContext = await requireProposalDocumentContext();
	const [instance] = await db
		.select({
			id: workflowInstances.id,
			state: workflowInstances.state,
			metadata: workflowInstances.metadata,
		})
		.from(workflowInstances)
		.where(and(
			eq(workflowInstances.workflowKey, "proposal_response_package"),
			eq(workflowInstances.organizationId, userContext.organizationId),
			eq(workflowInstances.subjectType, "opportunity"),
			eq(workflowInstances.subjectId, opportunityId),
			assignedOpportunityExistsSql(opportunityId, userContext.userId, userContext.organizationId)
		));

	return responsePackageReadinessSummary(instance);
}

function responsePackageReadinessSummary(
	instance: ResponsePackageWorkflowRow | undefined
): ResponsePackageReadinessSummary {
	if (!instance) {
		return missingResponsePackageReadiness();
	}
	const readiness = asRecord(asRecord(instance.metadata).readiness);
	if (Object.keys(readiness).length === 0) {
		return {
			...missingResponsePackageReadiness(),
			workflowInstanceId: instance.id,
			state: instance.state,
			status: "unknown",
		};
	}
	const metrics = asRecord(readiness.metrics);
	return {
		workflowInstanceId: instance.id,
		state: instance.state,
		status: responsePackageReadinessStatus(readiness.status),
		blockers: stringArray(readiness.blockers),
		warnings: stringArray(readiness.warnings),
		missingRequirementIds: stringArray(readiness.missingRequirementIds),
		metrics: {
			acceptedRequirementCount: numberMetric(metrics.acceptedRequirementCount),
			draftedRequirementCount: numberMetric(metrics.draftedRequirementCount),
			requirementCoverage: clampRatio(numberMetric(metrics.requirementCoverage)),
			documentsDrafted: numberMetric(metrics.documentsDrafted),
			sectionsDrafted: numberMetric(metrics.sectionsDrafted),
			complianceEntriesCreated: numberMetric(metrics.complianceEntriesCreated),
			totalDraftWordCount: numberMetric(metrics.totalDraftWordCount),
			minDocumentDraftWordCount: numberMetric(metrics.minDocumentDraftWordCount),
			evidenceChecklistCoverage: clampRatio(numberMetric(metrics.evidenceChecklistCoverage)),
			reviewGateCoverage: clampRatio(numberMetric(metrics.reviewGateCoverage)),
			winThemeCoverage: clampRatio(numberMetric(metrics.winThemeCoverage)),
			unresolvedPlaceholderCount: numberMetric(metrics.unresolvedPlaceholderCount),
		},
	};
}

function missingResponsePackageReadiness(): ResponsePackageReadinessSummary {
	return {
		workflowInstanceId: null,
		state: null,
		status: "missing",
		blockers: ["Response package readiness assessment has not been recorded"],
		warnings: [],
		missingRequirementIds: [],
		metrics: {
			acceptedRequirementCount: 0,
			draftedRequirementCount: 0,
			requirementCoverage: 0,
			documentsDrafted: 0,
			sectionsDrafted: 0,
			complianceEntriesCreated: 0,
			totalDraftWordCount: 0,
			minDocumentDraftWordCount: 0,
			evidenceChecklistCoverage: 0,
			reviewGateCoverage: 0,
			winThemeCoverage: 0,
			unresolvedPlaceholderCount: 0,
		},
	};
}

function responsePackageReadinessStatus(value: unknown): ResponsePackageReadinessSummary["status"] {
	if (value === "ready_for_review" || value === "blocked") {
		return value;
	}
	return "unknown";
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberMetric(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampRatio(value: number): number {
	return Math.min(1, Math.max(0, value));
}

async function assertProposalDocumentRequirementsReadyForFinalStatus(
	proposalDocumentId: string,
	userContext: ProposalDocumentUserContext
): Promise<void> {
	const userId = userContext.userId;
	const [proposalDocument] = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(proposalDocumentId, userId, userContext.organizationId))
		.limit(1);
	if (!proposalDocument) {
		throw new Error("Proposal document not found");
	}

	const sections = await db
		.select()
		.from(documentSections)
		.where(visibleDocumentSectionsForProposalCondition(proposalDocumentId, userId, userContext.organizationId));
	const requirementIds = uniqueStrings(
		sections.flatMap((section) => (section.requirementIds as string[]) ?? [])
	);
	if (requirementIds.length === 0) {
		return;
	}

	const requirements = await db
		.select()
		.from(rfpRequirements)
		.where(and(
			inArray(rfpRequirements.id, requirementIds),
			visibleRequirementsForOpportunityCondition(proposalDocument.opportunityId, userId, userContext.organizationId)
		));
	const blockers = requirements.filter((requirement) =>
		!isRequirementReadyForFinal(requirement.complianceStatus)
	);
	if (blockers.length > 0) {
		const labels = blockers
			.slice(0, 5)
			.map((requirement) => requirementLabel(requirement))
			.join(", ");
		throw new Error(
			`Cannot mark proposal document approved or final until linked requirements are compliant: ${labels}`
		);
	}
}

/**
 * Create a new proposal document with a new underlying document.
 */
export async function createProposalDocument(
	input: CreateProposalDocumentInput,
	options: ProposalDocumentCreationOptions = {}
): Promise<ProposalDocument> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const { opportunityId, documentType, title, templateId, assignedTo, dueDate, notes } = input;

	const [opportunity] = await db
		.select({
			id: opportunities.id,
			title: opportunities.title,
			organization: opportunities.organization,
			sector: opportunities.sector,
			countryRegion: opportunities.countryRegion,
			category: opportunities.category,
			deadline: opportunities.deadline,
			budgetValue: opportunities.budgetValue,
			projectSummary: opportunities.projectSummary,
			projectScope: opportunities.projectScope,
			keyRequirements: opportunities.keyRequirements,
			technicalRequirements: opportunities.technicalRequirements,
			submissionRequirements: opportunities.submissionRequirements,
			fitScore: opportunities.fitScore,
			winProbability: opportunities.winProbability,
			strategicNotes: opportunities.strategicNotes,
		})
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}

	const requirements = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementsForOpportunityCondition(opportunityId, userId, userContext.organizationId));
	const documentRequirements = requirements.filter(
		(requirement) =>
			requirement.complianceStatus !== "not_applicable" &&
			documentTypeForRequirement(requirement) === documentType &&
			(!options.seedAcceptedRequirementsOnly || isAcceptedRequirement(requirement))
	);
	const activeWinThemes = await db
		.select()
		.from(winThemes)
		.where(visibleActiveWinThemesForOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.orderBy(asc(winThemes.priority), asc(winThemes.createdAt));

	// Generate a title if not provided
	const documentTitle = title || `${getDocumentTypeLabel(documentType)} - Draft`;

	// Get max section order for this opportunity
	const existingDocs = await db
		.select({ maxOrder: sql<number>`MAX(${proposalDocuments.sectionOrder})` })
		.from(proposalDocuments)
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId));

	const nextOrder = (existingDocs[0]?.maxOrder ?? -1) + 1;

	// Create the underlying document first
	const defaultContent = appendResponsePlanContent(
		getDatacraftProposalDocumentContent(documentType),
		opportunity,
		documentType,
		documentRequirements,
		activeWinThemes
	);
	const plainText = extractPlainText(defaultContent);
	const wordCount = countWords(plainText);
	const [newDoc] = await db
		.insert(documents)
		.values({
			title: documentTitle,
			content: defaultContent,
			plainText,
			templateId: templateId || null,
			status: "draft",
			ownerId: userId,
			tags: ["datacraft", "proposal-response", documentType],
			wordCount,
			characterCount: plainText.length,
			metadata: {
				source: "datacraft_response_sections",
				documentType,
				opportunityId,
				requirementResponsePlanVersion: "2026-05-26",
				requirementSeedPolicy: options.seedAcceptedRequirementsOnly
					? "accepted_only"
					: "applicable_by_document_type",
				seededRequirementIds: documentRequirements.map((requirement) => requirement.id),
				seededWinThemeIds: activeWinThemes.map((theme) => theme.id),
			},
		})
		.returning();

	// Create the proposal document link
	const [proposalDoc] = await db
		.insert(proposalDocuments)
		.values({
			organizationId: userContext.organizationId,
			opportunityId,
			documentId: newDoc.id,
			documentType,
			sectionOrder: nextOrder,
			status: "not_started",
			assignedTo: assignedTo || null,
			dueDate: dueDate ? new Date(dueDate) : null,
			notes: notes || null,
		})
		.returning();

	const sectionSeeds = getDatacraftProposalSectionSeeds(documentType);
	if (sectionSeeds.length > 0) {
		const estimatedSectionWords = Math.round(wordCount / sectionSeeds.length);
		await db.insert(documentSections).values(
			sectionSeeds.map((section, index) => ({
				organizationId: userContext.organizationId,
				proposalDocumentId: proposalDoc.id,
				sectionName: section.sectionName,
				sectionOrder: index,
				status: estimatedSectionWords > 0 ? "drafting" : "not_started",
				wordCount: estimatedSectionWords,
				targetWordCount: section.targetWordCount,
				assignedTo: assignedTo || null,
				dueDate: dueDate ? new Date(dueDate) : null,
				requirementIds: [],
			}))
		);
	}

	revalidateProposalWorkflowPaths(opportunityId);
	return mapProposalDocument(proposalDoc, newDoc);
}

/**
 * Link an existing document to a proposal.
 */
export async function linkExistingDocument(input: LinkDocumentInput): Promise<ProposalDocument> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const { opportunityId, documentId, documentType, sectionOrder, assignedTo, dueDate, notes } =
		input;

	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}

	// Check if document exists
	const [doc] = await db
		.select()
		.from(documents)
		.where(and(eq(documents.id, documentId), eq(documents.ownerId, userId)))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	// Check if already linked
	const existing = await db
		.select()
		.from(proposalDocuments)
		.where(
			and(
				visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId),
				eq(proposalDocuments.documentId, documentId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		throw new Error("Document is already linked to this opportunity");
	}

	// Get max section order if not provided
	let order = sectionOrder;
	if (order === undefined) {
		const existingDocs = await db
			.select({ maxOrder: sql<number>`MAX(${proposalDocuments.sectionOrder})` })
			.from(proposalDocuments)
			.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId));

		order = (existingDocs[0]?.maxOrder ?? -1) + 1;
	}

	// Create the link
	const [proposalDoc] = await db
		.insert(proposalDocuments)
		.values({
			organizationId: userContext.organizationId,
			opportunityId,
			documentId,
			documentType,
			sectionOrder: order,
			status: "not_started",
			assignedTo: assignedTo || null,
			dueDate: dueDate ? new Date(dueDate) : null,
			notes: notes || null,
		})
		.returning();

	revalidateProposalWorkflowPaths(opportunityId);
	return mapProposalDocument(proposalDoc, doc);
}

/**
 * Update a proposal document.
 */
export async function updateProposalDocument(
	id: string,
	input: UpdateProposalDocumentInput
): Promise<ProposalDocument> {
	const finalStatus = isFinalProposalStatus(input.status);
	const userContext = await requireProposalDocumentMutationActor(finalStatus);
	const userId = userContext.userId;
	if (finalStatus) {
		await assertProposalDocumentRequirementsReadyForFinalStatus(id, userContext);
	}

	const updateData: Partial<typeof proposalDocuments.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.documentType !== undefined) updateData.documentType = input.documentType;
	if (input.sectionOrder !== undefined) updateData.sectionOrder = input.sectionOrder;
	if (input.status !== undefined) updateData.status = input.status;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.dueDate !== undefined) {
		updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
	}
	if (input.reviewerId !== undefined) updateData.reviewerId = input.reviewerId;
	if (input.notes !== undefined) updateData.notes = input.notes;

	// Handle approval
	if (input.status === "approved" && !updateData.approvedAt) {
		updateData.approvedAt = new Date();
		updateData.approvedBy = userId;
	}

	const [updated] = await db
		.update(proposalDocuments)
		.set(updateData)
		.where(visibleProposalDocumentCondition(id, userId, userContext.organizationId))
		.returning();

	if (!updated) {
		throw new Error("Proposal document not found");
	}

	revalidateProposalWorkflowPaths(updated.opportunityId);

	// Fetch with document data
	return getProposalDocument(id) as Promise<ProposalDocument>;
}

/**
 * Update the status of a proposal document.
 */
export async function updateProposalDocumentStatus(
	id: string,
	status: ProposalDocumentStatus,
	notes?: string
): Promise<ProposalDocument> {
	return updateProposalDocument(id, { status, notes });
}

/**
 * Advance the final package workflow for a proposal document and return the refreshed link.
 */
export async function transitionProposalDocumentFinalization(
	id: string,
	input: ProposalDocumentFinalizationInput
): Promise<ProposalDocument> {
	const proposalDocument = await getProposalDocument(id);
	if (!proposalDocument) {
		throw new Error("Proposal document not found");
	}

	await transitionFinalArtifactWorkflow({
		documentId: proposalDocument.documentId,
		proposalDocumentId: proposalDocument.id,
		opportunityId: proposalDocument.opportunityId,
		action: input.action,
		reason: input.reason,
		format: input.format ?? "docx",
		approvalRole: input.approvalRole,
	});

	const updated = await getProposalDocument(id);
	if (!updated) {
		throw new Error("Proposal document not found after finalization transition");
	}
	revalidateProposalWorkflowPaths(updated.opportunityId);
	return updated;
}

/**
 * Delete a proposal document link (does not delete the underlying document).
 */
export async function unlinkProposalDocument(id: string): Promise<void> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const [proposalDoc] = await db
		.select({ opportunityId: proposalDocuments.opportunityId })
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(id, userId, userContext.organizationId))
		.limit(1);

	await db.delete(proposalDocuments).where(visibleProposalDocumentCondition(id, userId, userContext.organizationId));
	if (proposalDoc) {
		revalidateProposalWorkflowPaths(proposalDoc.opportunityId);
	}
}

/**
 * Delete a proposal document and its underlying document.
 */
export async function deleteProposalDocument(id: string): Promise<void> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	// Get the document ID first
	const [proposalDoc] = await db
		.select({
			documentId: proposalDocuments.documentId,
			opportunityId: proposalDocuments.opportunityId,
		})
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(id, userId, userContext.organizationId))
		.limit(1);

	if (!proposalDoc) {
		throw new Error("Proposal document not found");
	}

	// Delete proposal document link (cascades to sections)
	await db.delete(proposalDocuments).where(visibleProposalDocumentCondition(id, userId, userContext.organizationId));

	// Delete underlying document
	await db.delete(documents).where(
		and(
			eq(documents.id, proposalDoc.documentId),
			eq(documents.ownerId, userId)
		)
	);
	revalidateProposalWorkflowPaths(proposalDoc.opportunityId);
}

/**
 * Reorder proposal documents.
 */
export async function reorderProposalDocuments(
	opportunityId: string,
	orderedIds: string[]
): Promise<void> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	// Update each document with its new order
	await Promise.all(
		orderedIds.map((id, index) =>
			db
				.update(proposalDocuments)
				.set({ sectionOrder: index, updatedAt: new Date() })
				.where(and(
					visibleProposalDocumentCondition(id, userId, userContext.organizationId),
					eq(proposalDocuments.opportunityId, opportunityId)
				))
		)
	);
	revalidateProposalWorkflowPaths(opportunityId);
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Calculate proposal progress for an opportunity.
 */
export async function getProposalProgress(opportunityId: string): Promise<ProposalProgress> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const docs = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId));

	const now = new Date();

	// Initialize status counts
	const byStatus: Record<ProposalDocumentStatus, number> = {
		not_started: 0,
		drafting: 0,
		in_review: 0,
		revising: 0,
		approved: 0,
		final: 0,
	};

	let documentsOnTrack = 0;
	let documentsOverdue = 0;
	let documentsAtRisk = 0;
	let nextDeadline: Date | null = null;
	let totalAiScore = 0;
	let aiScoreCount = 0;

	for (const doc of docs) {
		// Count by status
		const status = doc.status as ProposalDocumentStatus;
		byStatus[status] = (byStatus[status] || 0) + 1;

		// Track deadlines and progress
		if (doc.dueDate) {
			const dueDate = new Date(doc.dueDate);

			// Check if this is the next upcoming deadline
			if (dueDate > now && (!nextDeadline || dueDate < nextDeadline)) {
				nextDeadline = dueDate;
			}

			// Determine status relative to deadline
			const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

			if (status === "final" || status === "approved") {
				documentsOnTrack++;
			} else if (dueDate < now) {
				documentsOverdue++;
			} else if (daysUntilDue <= 3 && status === "not_started") {
				documentsAtRisk++;
			} else if (daysUntilDue <= 7 && (status === "not_started" || status === "drafting")) {
				documentsAtRisk++;
			} else {
				documentsOnTrack++;
			}
		} else {
			// No deadline set - consider on track if not stale
			if (status !== "not_started") {
				documentsOnTrack++;
			}
		}

		// Track AI scores
		if (doc.aiAnalysisScore !== null) {
			totalAiScore += doc.aiAnalysisScore;
			aiScoreCount++;
		}
	}

	// Calculate completion percentage
	// Weight: not_started=0, drafting=20, in_review=60, revising=40, approved=80, final=100
	const statusWeights: Record<ProposalDocumentStatus, number> = {
		not_started: 0,
		drafting: 20,
		in_review: 60,
		revising: 40,
		approved: 80,
		final: 100,
	};

	let totalWeight = 0;
	for (const doc of docs) {
		totalWeight += statusWeights[doc.status as ProposalDocumentStatus] || 0;
	}

	const completionPercentage = docs.length > 0 ? Math.round(totalWeight / docs.length) : 0;

	return {
		opportunityId,
		totalDocuments: docs.length,
		byStatus,
		completionPercentage,
		documentsOnTrack,
		documentsOverdue,
		documentsAtRisk,
		nextDeadline,
		averageAiScore: aiScoreCount > 0 ? Math.round(totalAiScore / aiScoreCount) : null,
	};
}

// ============================================================================
// Document Section Operations
// ============================================================================

/**
 * Get all sections for a proposal document.
 */
export async function getDocumentSections(proposalDocumentId: string): Promise<DocumentSection[]> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const results = await db
		.select()
		.from(documentSections)
		.where(visibleDocumentSectionsForProposalCondition(proposalDocumentId, userId, userContext.organizationId))
		.orderBy(asc(documentSections.sectionOrder));

	return results.map(mapDocumentSection);
}

/**
 * Create a new document section.
 */
export async function createSection(input: CreateSectionInput): Promise<DocumentSection> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const {
		proposalDocumentId,
		sectionName,
		sectionOrder,
		targetWordCount,
		assignedTo,
		dueDate,
		requirementIds,
	} = input;

	const [proposalDocument] = await db
		.select({ id: proposalDocuments.id })
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(proposalDocumentId, userId, userContext.organizationId))
		.limit(1);

	if (!proposalDocument) {
		throw new Error("Proposal document not found");
	}

	// Get max section order if not provided
	let order = sectionOrder;
	if (order === undefined) {
		const existingSections = await db
			.select({ maxOrder: sql<number>`MAX(${documentSections.sectionOrder})` })
			.from(documentSections)
			.where(visibleDocumentSectionsForProposalCondition(proposalDocumentId, userId, userContext.organizationId));

		order = (existingSections[0]?.maxOrder ?? -1) + 1;
	}

	const [section] = await db
		.insert(documentSections)
		.values({
			organizationId: userContext.organizationId,
			proposalDocumentId,
			sectionName,
			sectionOrder: order,
			status: "not_started",
			wordCount: 0,
			targetWordCount: targetWordCount || null,
			assignedTo: assignedTo || null,
			dueDate: dueDate ? new Date(dueDate) : null,
			requirementIds: requirementIds || [],
		})
		.returning();

	return mapDocumentSection(section);
}

/**
 * Update a document section.
 */
export async function updateSection(
	id: string,
	input: UpdateSectionInput
): Promise<DocumentSection> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const updateData: Partial<typeof documentSections.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.sectionName !== undefined) updateData.sectionName = input.sectionName;
	if (input.sectionOrder !== undefined) updateData.sectionOrder = input.sectionOrder;
	if (input.status !== undefined) updateData.status = input.status;
	if (input.wordCount !== undefined) updateData.wordCount = input.wordCount;
	if (input.targetWordCount !== undefined) updateData.targetWordCount = input.targetWordCount;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.dueDate !== undefined) {
		updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
	}
	if (input.requirementIds !== undefined) updateData.requirementIds = input.requirementIds;

	const [updated] = await db
		.update(documentSections)
		.set(updateData)
		.where(visibleDocumentSectionCondition(id, userId, userContext.organizationId))
		.returning();

	if (!updated) {
		throw new Error("Document section not found");
	}

	return mapDocumentSection(updated);
}

/**
 * Update section progress (word count and status).
 */
export async function updateSectionProgress(
	id: string,
	wordCount: number,
	status?: DocumentSectionStatus
): Promise<DocumentSection> {
	return updateSection(id, { wordCount, status });
}

/**
 * Link requirements to a section.
 */
export async function linkRequirementsToSection(
	sectionId: string,
	requirementIds: string[]
): Promise<DocumentSection> {
	return updateSection(sectionId, { requirementIds });
}

/**
 * Delete a document section.
 */
export async function deleteSection(id: string): Promise<void> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	await db.delete(documentSections).where(visibleDocumentSectionCondition(id, userId, userContext.organizationId));
}

/**
 * Reorder document sections.
 */
export async function reorderSections(
	proposalDocumentId: string,
	orderedIds: string[]
): Promise<void> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	await Promise.all(
		orderedIds.map((id, index) =>
			db
				.update(documentSections)
				.set({ sectionOrder: index, updatedAt: new Date() })
				.where(
					and(
						visibleDocumentSectionCondition(id, userId, userContext.organizationId),
						eq(documentSections.proposalDocumentId, proposalDocumentId)
					)
				)
		)
	);
}

/**
 * Get section progress for a proposal document.
 */
export async function getSectionProgress(proposalDocumentId: string): Promise<SectionProgress[]> {
	const sections = await getDocumentSections(proposalDocumentId);

	return sections.map((section) => {
		const progressPercentage =
			section.targetWordCount && section.targetWordCount > 0
				? Math.min(100, Math.round((section.wordCount / section.targetWordCount) * 100))
				: section.wordCount > 0
				? 50 // If no target but has content, assume 50%
				: 0;

		return {
			sectionId: section.id,
			sectionName: section.sectionName,
			wordCount: section.wordCount,
			targetWordCount: section.targetWordCount,
			progressPercentage,
			status: section.status,
			requirementsAddressed: section.requirementIds.length,
			totalRequirements: section.requirementIds.length, // Would need requirements lookup for actual total
		};
	});
}

/**
 * Generate and persist a requirement-aware draft for one proposal section.
 */
export async function generateRequirementAwareSectionDraft(
	sectionId: string
): Promise<RequirementAwareSectionDraftResult> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const [section] = await db
		.select()
		.from(documentSections)
		.where(visibleDocumentSectionCondition(sectionId, userId, userContext.organizationId))
		.limit(1);

	if (!section) {
		throw new Error("Document section not found");
	}

	const [proposalDocument] = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(section.proposalDocumentId, userId, userContext.organizationId))
		.limit(1);
	if (!proposalDocument) {
		throw new Error("Proposal document not found");
	}

	const [document] = await db
		.select()
		.from(documents)
		.where(eq(documents.id, proposalDocument.documentId))
		.limit(1);
	if (!document) {
		throw new Error("Document not found");
	}

	const [opportunity] = await db
		.select({
			id: opportunities.id,
			title: opportunities.title,
			organization: opportunities.organization,
			sector: opportunities.sector,
			countryRegion: opportunities.countryRegion,
			category: opportunities.category,
			deadline: opportunities.deadline,
			budgetValue: opportunities.budgetValue,
			projectSummary: opportunities.projectSummary,
			projectScope: opportunities.projectScope,
			keyRequirements: opportunities.keyRequirements,
			technicalRequirements: opportunities.technicalRequirements,
			submissionRequirements: opportunities.submissionRequirements,
			fitScore: opportunities.fitScore,
			winProbability: opportunities.winProbability,
			strategicNotes: opportunities.strategicNotes,
		})
		.from(opportunities)
		.where(visibleOpportunityCondition(proposalDocument.opportunityId, userId, userContext.organizationId))
		.limit(1);
	if (!opportunity) {
		throw new Error("Opportunity not found");
	}

	const requirementIds = uniqueStrings((section.requirementIds as string[]) ?? []);
	const requirements = requirementIds.length > 0
		? await db
			.select()
			.from(rfpRequirements)
			.where(and(
				inArray(rfpRequirements.id, requirementIds),
				visibleRequirementsForOpportunityCondition(proposalDocument.opportunityId, userId, userContext.organizationId)
			))
		: [];
	const activeWinThemes = await db
		.select()
		.from(winThemes)
		.where(visibleActiveWinThemesForOpportunityCondition(proposalDocument.opportunityId, userId, userContext.organizationId))
		.orderBy(asc(winThemes.priority), asc(winThemes.createdAt));
	const draftContent = buildRequirementAwareSectionDraftContent(
		section,
		proposalDocument,
		opportunity,
		requirements,
		activeWinThemes
	);
	const mergedContent = replaceSectionDraftContent(document.content, section.id, draftContent);
	const plainText = extractPlainText(mergedContent);
	const sectionPlainText = extractPlainText(draftContent);
	const versionNumber = (document.currentVersion ?? 1) + 1;
	const generatedAt = new Date().toISOString();

	const [updatedDocument] = await db
		.update(documents)
		.set({
			content: mergedContent,
			plainText,
			wordCount: countWords(plainText),
			characterCount: plainText.length,
			currentVersion: versionNumber,
			metadata: draftMetadata(document.metadata, section, requirements, activeWinThemes, generatedAt),
			updatedAt: new Date(generatedAt),
		})
		.where(eq(documents.id, document.id))
		.returning();
	if (!updatedDocument) {
		throw new Error("Failed to update document draft");
	}

	await db.insert(documentVersions).values({
		documentId: document.id,
		versionNumber,
		content: mergedContent,
		changeDescription: `Generated requirement-aware draft for ${section.sectionName}`,
		createdBy: userId,
		createdAt: new Date(generatedAt),
	});

	await db
		.update(documentSections)
		.set({
			status: "drafting",
			wordCount: countWords(sectionPlainText),
			requirementIds,
			updatedAt: new Date(generatedAt),
		})
		.where(visibleDocumentSectionCondition(section.id, userId, userContext.organizationId));

	for (const requirement of requirements) {
		const nextStatus = requirement.complianceStatus === "not_addressed"
			? "partial"
			: requirement.complianceStatus;
		await db
			.update(rfpRequirements)
			.set({
				responseDocumentId: document.id,
				responseSection: section.sectionName,
				responseStrategy:
					requirement.responseStrategy ??
					`Drafted in ${section.sectionName}; verify evidence and final compliance before submission.`,
				complianceStatus: nextStatus,
				updatedAt: new Date(generatedAt),
			})
			.where(visibleRequirementCondition(requirement.id, userId, userContext.organizationId));
	}

	return {
		sectionId: section.id,
		proposalDocumentId: proposalDocument.id,
		documentId: document.id,
		requirementIds,
		winThemeIds: activeWinThemes.map((theme) => theme.id),
		content: draftContent,
		plainText: sectionPlainText,
		wordCount: countWords(sectionPlainText),
		characterCount: sectionPlainText.length,
		versionNumber,
	};
}

/**
 * Generate requirement-aware drafts for every section in a proposal document.
 */
export async function generateRequirementAwareProposalDraft(
	proposalDocumentId: string
): Promise<RequirementAwareProposalDraftResult> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const [proposalDocument] = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentCondition(proposalDocumentId, userId, userContext.organizationId))
		.limit(1);
	if (!proposalDocument) {
		throw new Error("Proposal document not found");
	}

	const sections = await db
		.select()
		.from(documentSections)
		.where(visibleDocumentSectionsForProposalCondition(proposalDocumentId, userId, userContext.organizationId))
		.orderBy(asc(documentSections.sectionOrder));

	const results: RequirementAwareSectionDraftResult[] = [];
	for (const section of sections) {
		results.push(await generateRequirementAwareSectionDraft(section.id));
	}

	if (results.length > 0) {
		await db
			.update(proposalDocuments)
			.set({
				status: "drafting",
				updatedAt: new Date(),
			})
			.where(visibleProposalDocumentCondition(proposalDocumentId, userId, userContext.organizationId));
	}

	revalidateProposalWorkflowPaths(proposalDocument.opportunityId);

	return {
		proposalDocumentId,
		documentId: proposalDocument.documentId,
		sectionsDrafted: results.length,
		requirementIds: uniqueStrings(results.flatMap((result) => result.requirementIds)),
		winThemeIds: uniqueStrings(results.flatMap((result) => result.winThemeIds)),
		wordCount: results.reduce((total, result) => total + result.wordCount, 0),
		unresolvedPlaceholderCount: results.reduce(
			(total, result) => total + countUnresolvedPlaceholders(result.plainText),
			0
		),
		evidenceChecklistCount: results.filter((result) => result.plainText.includes("Evidence Checklist")).length,
		reviewGateCount: results.filter((result) => result.plainText.includes("Review Gate")).length,
		versionNumber: results.length > 0
			? Math.max(...results.map((result) => result.versionNumber))
			: null,
	};
}

function documentTypeForRequirement(
	requirement: typeof rfpRequirements.$inferSelect
): ProposalDocumentType {
	switch (requirement.category) {
		case "financial":
			return "cost_proposal";
		case "experience":
			return "past_performance";
		case "personnel":
			return "staffing_plan";
		case "administrative":
		case "legal":
		case "compliance":
			return "management_plan";
		case "security":
		case "technical":
			return "technical_approach";
		default:
			return "technical_approach";
	}
}

function chooseSectionForRequirement(
	requirement: typeof rfpRequirements.$inferSelect,
	sections: Array<typeof documentSections.$inferSelect>
): typeof documentSections.$inferSelect | undefined {
	if (sections.length === 0) return undefined;

	const requestedSection = requirement.responseSection?.trim().toLowerCase();
	if (requestedSection) {
		const existing = sections.find((section) =>
			section.sectionName.toLowerCase().includes(requestedSection)
		);
		if (existing) return existing;
	}

	const categoryKeywords: Record<string, string[]> = {
		technical: ["technical", "solution", "approach", "methodology"],
		security: ["security", "risk", "technical", "solution"],
		financial: ["cost", "pricing", "budget", "financial"],
		experience: ["past", "experience", "performance", "references"],
		personnel: ["staff", "team", "personnel", "key personnel"],
		administrative: ["management", "compliance", "submission", "administrative"],
		legal: ["management", "compliance", "terms", "legal"],
		compliance: ["compliance", "management", "quality"],
	};
	const keywords = categoryKeywords[requirement.category ?? ""] ?? [];
	const matched = sections.find((section) => {
		const name = section.sectionName.toLowerCase();
		return keywords.some((keyword) => name.includes(keyword));
	});

	return matched ?? sections[0];
}

async function linkRequirementsToStandardProposalSections(
	opportunityId: string,
	proposalDocs: ProposalDocument[],
	userContext: ProposalDocumentUserContext
): Promise<void> {
	if (proposalDocs.length === 0) return;
	const userId = userContext.userId;

	const requirements = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementsForOpportunityCondition(opportunityId, userId, userContext.organizationId));

	const actionableRequirements = requirements.filter((requirement) =>
		requirement.complianceStatus !== "not_applicable" &&
		isAcceptedRequirement(requirement)
	);
	if (actionableRequirements.length === 0) return;

	const docsByType = new Map<ProposalDocumentType, ProposalDocument>();
	for (const doc of proposalDocs) {
		if (!docsByType.has(doc.documentType)) {
			docsByType.set(doc.documentType, doc);
		}
	}

	for (const [documentType, proposalDoc] of docsByType) {
		const matchingRequirements = actionableRequirements.filter((requirement) =>
			documentTypeForRequirement(requirement) === documentType
		);
		if (matchingRequirements.length === 0) continue;

		const sections = await db
			.select()
			.from(documentSections)
			.where(visibleDocumentSectionsForProposalCondition(proposalDoc.id, userId, userContext.organizationId))
			.orderBy(asc(documentSections.sectionOrder));
		if (sections.length === 0) continue;

		const requirementIdsBySection = new Map<string, string[]>();
		const sectionById = new Map(sections.map((section) => [section.id, section]));

		for (const requirement of matchingRequirements) {
			const section = chooseSectionForRequirement(requirement, sections);
			if (!section) continue;
			const ids = requirementIdsBySection.get(section.id) ?? [];
			ids.push(requirement.id);
			requirementIdsBySection.set(section.id, ids);

			await db
				.update(rfpRequirements)
				.set({
					responseDocumentId: proposalDoc.documentId,
					responseSection: section.sectionName,
					updatedAt: new Date(),
				})
				.where(visibleRequirementCondition(requirement.id, userId, userContext.organizationId));
		}

		for (const [sectionId, requirementIds] of requirementIdsBySection) {
			const section = sectionById.get(sectionId);
			if (!section) continue;
			await db
				.update(documentSections)
				.set({
					requirementIds: uniqueStrings([
						...((section.requirementIds as string[]) ?? []),
						...requirementIds,
					]),
					updatedAt: new Date(),
				})
				.where(visibleDocumentSectionCondition(sectionId, userId, userContext.organizationId));
		}
	}
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Create standard proposal document set for an opportunity.
 */
export async function createStandardProposalSet(
	opportunityId: string,
	documentTypes?: ProposalDocumentType[],
	options: StandardProposalSetOptions = {}
): Promise<ProposalDocument[]> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const types = documentTypes || [
		"cover_letter",
		"executive_summary",
		"technical_approach",
		"management_plan",
		"staffing_plan",
		"past_performance",
		"cost_proposal",
	];

	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}

	const existingDocs = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));

	const existingTypes = new Set(existingDocs.map((doc) => doc.documentType as ProposalDocumentType));
	const created: ProposalDocument[] = [];

	for (const documentType of types) {
		if (existingTypes.has(documentType)) {
			continue;
		}
		const doc = await createProposalDocument({
			opportunityId,
			documentType,
		}, {
			seedAcceptedRequirementsOnly: options.seedAcceptedRequirementsOnly,
		});
		created.push(doc);
		existingTypes.add(documentType);
	}

	const packageDocs = [
		...existingDocs
			.filter((doc) => types.includes(doc.documentType as ProposalDocumentType))
			.map((doc) => mapProposalDocument(doc)),
		...created,
	];
	await linkRequirementsToStandardProposalSections(opportunityId, packageDocs, userContext);
	revalidateProposalWorkflowPaths(opportunityId);

	return created;
}

/**
 * Create the standard response package, link accepted requirements, and draft
 * every linked standard document in one operator action.
 */
export async function createAndDraftStandardProposalSet(
	opportunityId: string,
	documentTypes?: ProposalDocumentType[]
): Promise<ResponsePackageDraftResult> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	const types = documentTypes || [
		"cover_letter",
		"executive_summary",
		"technical_approach",
		"management_plan",
		"staffing_plan",
		"past_performance",
		"cost_proposal",
	];

	const requirements = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementsForOpportunityCondition(opportunityId, userId, userContext.organizationId));
	const acceptedRequirements = requirements.filter((requirement) =>
		requirement.complianceStatus !== "not_applicable" &&
		isAcceptedRequirement(requirement)
	);
	if (acceptedRequirements.length === 0) {
		throw new Error("Accept at least one applicable requirement before drafting a response package.");
	}

	const created = await createStandardProposalSet(opportunityId, types, {
		seedAcceptedRequirementsOnly: true,
	});
	const linkedAcceptedRequirements = (await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementsForOpportunityCondition(opportunityId, userId, userContext.organizationId)))
		.filter((requirement) =>
			requirement.complianceStatus !== "not_applicable" &&
			isAcceptedRequirement(requirement)
		);
	const complianceMatrix = await ensureAcceptedRequirementsComplianceMatrix(
		opportunityId,
		linkedAcceptedRequirements,
		userId
	);
	const packageRows = await db
		.select()
		.from(proposalDocuments)
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userId, userContext.organizationId))
		.orderBy(asc(proposalDocuments.sectionOrder), asc(proposalDocuments.createdAt));
	const packageDocs = packageRows
		.filter((doc) => types.includes(doc.documentType as ProposalDocumentType))
		.map((doc) => mapProposalDocument(doc));

	const draftResults: RequirementAwareProposalDraftResult[] = [];
	for (const doc of packageDocs) {
		const result = await generateRequirementAwareProposalDraft(doc.id);
		if (result.sectionsDrafted > 0) {
			draftResults.push(result);
		}
	}
	const draftedRequirementIds = uniqueStrings(draftResults.flatMap((result) => result.requirementIds));
	const responsePackageResult: ResponsePackageDraftResult = {
		documentsCreated: created.length,
		documentsDrafted: draftResults.length,
		sectionsDrafted: draftResults.reduce((total, result) => total + result.sectionsDrafted, 0),
		complianceMatrixId: complianceMatrix.matrixId,
		complianceEntriesCreated: complianceMatrix.entriesCreated,
		requirementIds: draftedRequirementIds,
		proposalDocumentIds: draftResults.map((result) => result.proposalDocumentId),
		documentIds: draftResults.map((result) => result.documentId),
		versionNumber: draftResults.length > 0
			? Math.max(...draftResults.map((result) => result.versionNumber ?? 0))
			: null,
		readiness: assessResponsePackageDraftReadiness({
			acceptedRequirementIds: linkedAcceptedRequirements.map((requirement) => requirement.id),
			draftedRequirementIds,
			documentsDrafted: draftResults.length,
			sectionsDrafted: draftResults.reduce((total, result) => total + result.sectionsDrafted, 0),
			complianceEntriesCreated: complianceMatrix.entriesCreated,
			draftResults,
		}),
	};

	await recordResponsePackageDraftTransition({
		opportunityId,
		organizationId: userContext.organizationId,
		userId,
		result: responsePackageResult,
	});

	return responsePackageResult;
}

async function recordResponsePackageDraftTransition(input: {
	opportunityId: string;
	organizationId: string;
	userId: string;
	result: ResponsePackageDraftResult;
}): Promise<void> {
	try {
		const readinessBlocked = input.result.readiness.status !== "ready_for_review";
		const readinessBlockerText = responsePackageReadinessBlockerText(input.result.readiness);
		const instance = await recordWorkflowRuntimeTransition({
			workflowKey: "proposal_response_package",
			organizationId: input.organizationId,
			subjectType: "opportunity",
			subjectId: input.opportunityId,
			opportunityId: input.opportunityId,
			fromState: "requirements_accepted",
			toState: "response_package_drafted",
			eventType: "response_package_drafted",
			actorId: input.userId,
			actorName: input.userId,
			reason: "Standard response package drafted from accepted requirements",
			evidenceLinks: responsePackageEvidenceLinks(input.result),
			priority: readinessBlocked ? "critical" : "high",
			visibility: "internal",
			metadata: {
				...input.result,
				requirementCount: input.result.requirementIds.length,
				proposalDocumentCount: input.result.proposalDocumentIds.length,
				documentVersionNumber: input.result.versionNumber,
			},
			terminal: false,
			actionUrl: `/opportunities/${input.opportunityId}/documents`,
		});
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `response-package-review:${input.opportunityId}`,
			title: readinessBlocked ? "Resolve response package readiness blockers" : "Review drafted response package",
			description: readinessBlocked
				? `Resolve response package readiness blockers before final package rendering.\n${readinessBlockerText}`
				: "Review drafted response documents, compliance links, and requirement coverage before final package rendering.",
			state: readinessBlocked ? "blocked" : "open",
			priority: readinessBlocked ? "critical" : "high",
			assignedTo: input.userId,
			assignedRole: "proposal_manager",
			dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
			metadata: {
				...input.result,
				requirementCount: input.result.requirementIds.length,
				proposalDocumentCount: input.result.proposalDocumentIds.length,
			},
		});
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `final-package-render:${input.opportunityId}`,
			title: readinessBlocked ? "Final package render blocked by response readiness" : "Render approved final package",
			description: readinessBlocked
				? `Final package rendering is blocked until response package readiness passes.\n${readinessBlockerText}`
				: "Render the approved response documents into final submission artifacts after response package review is complete.",
			state: readinessBlocked ? "blocked" : "open",
			priority: readinessBlocked ? "high" : "medium",
			assignedTo: input.userId,
			assignedRole: "proposal_manager",
			dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
			metadata: {
				proposalDocumentIds: input.result.proposalDocumentIds,
				documentIds: input.result.documentIds,
				versionNumber: input.result.versionNumber,
				complianceMatrixId: input.result.complianceMatrixId,
				readiness: input.result.readiness,
			},
		});
	} catch {
		// Response package drafting should not fail because workflow telemetry is unavailable.
	}
}

function responsePackageReadinessBlockerText(readiness: ResponsePackageDraftReadiness): string {
	const blockers = readiness.blockers.length > 0
		? readiness.blockers
		: [`${readiness.missingRequirementIds.length} accepted requirement(s) are missing from drafted response documents`];
	const coverage = `${Math.round(readiness.metrics.requirementCoverage * 100)}% accepted requirement coverage`;
	return [`Readiness: ${readiness.status}`, `Coverage: ${coverage}`, ...blockers].join("\n");
}

function responsePackageEvidenceLinks(result: ResponsePackageDraftResult): string[] {
	return [
		`compliance-matrix:${result.complianceMatrixId}`,
		...result.requirementIds.map((id) => `requirement:${id}`),
		...result.proposalDocumentIds.map((id) => `proposal-document:${id}`),
		...result.documentIds.map((id) => `document:${id}`),
		...(result.versionNumber ? [`document-version:${result.versionNumber}`] : []),
	];
}

function assessResponsePackageDraftReadiness(input: {
	acceptedRequirementIds: string[];
	draftedRequirementIds: string[];
	documentsDrafted: number;
	sectionsDrafted: number;
	complianceEntriesCreated: number;
	draftResults: RequirementAwareProposalDraftResult[];
}): ResponsePackageDraftReadiness {
	const blockers: string[] = [];
	const warnings: string[] = [];
	const acceptedRequirementIds = uniqueStrings(input.acceptedRequirementIds);
	const draftedRequirementIds = new Set(input.draftedRequirementIds);
	const missingRequirementIds = acceptedRequirementIds.filter((id) => !draftedRequirementIds.has(id));
	const draftedRequirementCount = acceptedRequirementIds.length - missingRequirementIds.length;
	const requirementCoverage = acceptedRequirementIds.length > 0
		? draftedRequirementCount / acceptedRequirementIds.length
		: 1;
	const totalDraftWordCount = input.draftResults.reduce((total, result) => total + result.wordCount, 0);
	const minDocumentDraftWordCount = input.draftResults.length > 0
		? Math.min(...input.draftResults.map((result) => result.wordCount))
		: 0;
	const evidenceChecklistCount = input.draftResults.reduce((total, result) => total + result.evidenceChecklistCount, 0);
	const reviewGateCount = input.draftResults.reduce((total, result) => total + result.reviewGateCount, 0);
	const unresolvedPlaceholderCount = input.draftResults.reduce((total, result) => total + result.unresolvedPlaceholderCount, 0);
	const documentsWithWinThemes = input.draftResults.filter((result) => result.winThemeIds.length > 0).length;
	const evidenceChecklistCoverage = input.sectionsDrafted > 0
		? evidenceChecklistCount / input.sectionsDrafted
		: 0;
	const reviewGateCoverage = input.sectionsDrafted > 0
		? reviewGateCount / input.sectionsDrafted
		: 0;
	const winThemeCoverage = input.documentsDrafted > 0
		? documentsWithWinThemes / input.documentsDrafted
		: 0;

	if (acceptedRequirementIds.length === 0) {
		blockers.push("No accepted requirements were available for response package drafting");
	}
	if (missingRequirementIds.length > 0) {
		blockers.push(`${missingRequirementIds.length} accepted requirement(s) were not represented in drafted response documents`);
	}
	if (input.documentsDrafted === 0) {
		blockers.push("No proposal documents were drafted");
	}
	if (input.sectionsDrafted === 0) {
		blockers.push("No proposal sections were drafted");
	}
	if (unresolvedPlaceholderCount > 0) {
		blockers.push(`${unresolvedPlaceholderCount} unresolved template placeholder(s) remain in drafted response documents`);
	}
	if (input.documentsDrafted > 0 && minDocumentDraftWordCount < 80) {
		blockers.push(`At least one drafted response document is below the 80-word quality floor (${minDocumentDraftWordCount} words)`);
	}
	if (input.sectionsDrafted > 0 && evidenceChecklistCoverage < 1) {
		blockers.push("At least one drafted response section is missing an evidence checklist");
	}
	if (input.sectionsDrafted > 0 && reviewGateCoverage < 1) {
		blockers.push("At least one drafted response section is missing a review gate");
	}
	if (input.complianceEntriesCreated < acceptedRequirementIds.length) {
		warnings.push(`${input.complianceEntriesCreated}/${acceptedRequirementIds.length} accepted requirement(s) received compliance matrix entries`);
	}
	if (input.documentsDrafted > 0 && winThemeCoverage < 1) {
		warnings.push(`${documentsWithWinThemes}/${input.documentsDrafted} drafted response document(s) include approved win themes`);
	}

	return {
		status: blockers.length === 0 ? "ready_for_review" : "blocked",
		blockers,
		warnings,
		missingRequirementIds,
		metrics: {
			acceptedRequirementCount: acceptedRequirementIds.length,
			draftedRequirementCount,
			requirementCoverage,
			documentsDrafted: input.documentsDrafted,
			sectionsDrafted: input.sectionsDrafted,
			complianceEntriesCreated: input.complianceEntriesCreated,
			totalDraftWordCount,
			minDocumentDraftWordCount,
			evidenceChecklistCoverage,
			reviewGateCoverage,
			winThemeCoverage,
			unresolvedPlaceholderCount,
		},
	};
}

function countUnresolvedPlaceholders(value: string): number {
	return value.match(/\{\{[^}]+\}\}/g)?.length ?? 0;
}

async function ensureAcceptedRequirementsComplianceMatrix(
	opportunityId: string,
	acceptedRequirements: Array<typeof rfpRequirements.$inferSelect>,
	userId: string
): Promise<{ matrixId: string; entriesCreated: number }> {
	const organizationId = acceptedRequirements[0]?.organizationId;
	if (!organizationId) {
		throw new Error("Accepted requirements are missing organization scope.");
	}

	const [existingMatrix] = await db
		.select()
		.from(complianceMatrices)
		.where(and(
			eq(complianceMatrices.opportunityId, opportunityId),
			eq(complianceMatrices.organizationId, organizationId)
		))
		.orderBy(asc(complianceMatrices.version))
		.limit(1);

	const matrix = existingMatrix ?? (await createAcceptedRequirementsComplianceMatrix(
		opportunityId,
		organizationId,
		userId,
		acceptedRequirements
	));

	const requirementIds = acceptedRequirements.map((requirement) => requirement.id);
	const existingEntries = await db
		.select()
		.from(complianceEntries)
		.where(and(
			eq(complianceEntries.matrixId, matrix.id),
			eq(complianceEntries.organizationId, organizationId),
			inArray(complianceEntries.requirementId, requirementIds)
		));
	const existingRequirementIds = new Set(existingEntries.map((entry) => entry.requirementId));
	const missingRequirements = acceptedRequirements.filter((requirement) =>
		!existingRequirementIds.has(requirement.id)
	);

	if (missingRequirements.length > 0) {
		await db.insert(complianceEntries).values(missingRequirements.map((requirement, index) => ({
			organizationId,
			matrixId: matrix.id,
			requirementId: requirement.id,
			complianceStatus: requirement.complianceStatus === "compliant" ? "compliant" : "partial",
			responseDocumentId: requirement.responseDocumentId,
			responseReference: requirement.responseSection,
			responseSummary: compactText(requirement.responseStrategy ?? requirement.suggestedApproach, 500),
			strengthAssessment: requirement.complianceStatus === "compliant" ? "strong" : "adequate",
			riskLevel: requirement.riskLevel,
			status: "draft",
			assignedTo: requirement.assignedTo,
			dueDate: requirement.dueDate,
			completionPercent: requirement.complianceStatus === "compliant" ? 100 : 60,
			sortOrder: existingEntries.length + index,
			metadata: {
				source: "accepted_requirement_response_package",
				linkedBy: userId,
				linkedAt: new Date().toISOString(),
			},
		})));
	}

	await db.update(complianceMatrices)
		.set({
			totalRequirements: acceptedRequirements.length,
			mandatoryCount: acceptedRequirements.filter((requirement) => requirement.priority === "mandatory").length,
			compliantCount: acceptedRequirements.filter((requirement) => requirement.complianceStatus === "compliant").length,
			partialCount: acceptedRequirements.filter((requirement) => requirement.complianceStatus === "partial").length,
			nonCompliantCount: acceptedRequirements.filter((requirement) => requirement.complianceStatus === "non_compliant").length,
			notAddressedCount: acceptedRequirements.filter((requirement) => requirement.complianceStatus === "not_addressed").length,
			metadata: {
				...(isRecord(matrix.metadata) ? matrix.metadata : {}),
				responsePackageDraft: {
					lastSyncedAt: new Date().toISOString(),
					requirementIds,
				},
			},
			updatedAt: new Date(),
		})
		.where(and(
			eq(complianceMatrices.id, matrix.id),
			eq(complianceMatrices.organizationId, organizationId)
		));

	return { matrixId: matrix.id, entriesCreated: missingRequirements.length };
}

async function createAcceptedRequirementsComplianceMatrix(
	opportunityId: string,
	organizationId: string,
	userId: string,
	acceptedRequirements: Array<typeof rfpRequirements.$inferSelect>
): Promise<typeof complianceMatrices.$inferSelect> {
	const [matrix] = await db.insert(complianceMatrices).values({
		organizationId,
		opportunityId,
		name: "Accepted Requirements Compliance Matrix",
		description: "Generated from accepted requirements during response package drafting.",
		totalRequirements: acceptedRequirements.length,
		mandatoryCount: acceptedRequirements.filter((requirement) => requirement.priority === "mandatory").length,
		notAddressedCount: acceptedRequirements.length,
		createdBy: userId,
		metadata: {
			source: "accepted_requirement_response_package",
			createdFromRequirementIds: acceptedRequirements.map((requirement) => requirement.id),
		},
	}).returning();
	return matrix;
}

/**
 * Bulk update proposal document statuses.
 */
export async function bulkUpdateStatus(
	ids: string[],
	status: ProposalDocumentStatus
): Promise<void> {
	const finalStatus = isFinalProposalStatus(status);
	const userContext = await requireProposalDocumentMutationActor(finalStatus);
	const userId = userContext.userId;
	if (finalStatus) {
		await Promise.all(
			ids.map((id) => assertProposalDocumentRequirementsReadyForFinalStatus(id, userContext))
		);
	}
	const updateData: Partial<typeof proposalDocuments.$inferInsert> = {
		status,
		updatedAt: new Date(),
	};
	if (status === "approved") {
		updateData.approvedBy = userId;
		updateData.approvedAt = new Date();
	}
	await db
		.update(proposalDocuments)
		.set(updateData)
		.where(and(
			inArray(proposalDocuments.id, ids),
			proposalDocumentOrganizationCondition(userContext.organizationId),
			assignedOpportunityExistsSql(proposalDocuments.opportunityId, userId, userContext.organizationId)
		));
}

/**
 * Bulk assign proposal documents.
 */
export async function bulkAssign(ids: string[], assignedTo: string): Promise<void> {
	const userContext = await requireProposalDocumentContext();
	const userId = userContext.userId;
	await db
		.update(proposalDocuments)
		.set({ assignedTo, updatedAt: new Date() })
		.where(and(
			inArray(proposalDocuments.id, ids),
			proposalDocumentOrganizationCondition(userContext.organizationId),
			assignedOpportunityExistsSql(proposalDocuments.opportunityId, userId, userContext.organizationId)
		));
}
