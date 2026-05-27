import "./load-env";

import crypto from "node:crypto";
import path from "node:path";
import { Pool } from "pg";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	ProofCleanupRegistry,
	type CleanupResult,
	type EvidenceRecord,
} from "./platform-proof/core";
import { and, eq, inArray } from "drizzle-orm";
import { closeDatabaseConnection, db } from "@/lib/db";
import {
	documents,
	opportunities,
	opportunityDocuments,
	proposalDocuments,
	rfpDocuments,
	rfpRequirements,
	winThemes,
} from "@/lib/db/schema";
import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import { fetchKenyaPpipOpportunities } from "@/lib/services/kenya-ppip-client";
import { checkDoclingHealth, convertDocument, type DoclingConvertResponse } from "@/lib/services/docling-client";
import { buildLiveResponsePackage, type LiveResponsePackage } from "@/lib/services/live-response-package";
import { fetchUngmOpportunities } from "@/lib/services/ungm-client";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import type { ProposalDocumentType } from "@/lib/types/opportunity";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const SOURCE_KIND = normalizeSourceKind(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_SOURCE_KIND);
const PROOF_RUN_PREFIX = process.env.LIVE_PERSISTED_IMPORT_RESPONSE_PROOF_PREFIX ?? (
	SOURCE_KIND === "kenya_ppip" ? "live_kenya_ppip_persisted_import_response" : "live_persisted_import_response"
);
const RUN_ID = process.env.LIVE_PERSISTED_IMPORT_RESPONSE_PROOF_RUN_ID ?? createProofRunId(PROOF_RUN_PREFIX);
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-persisted-import-response" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-persisted-import-response-evidence.md");
const SOURCE_URL = process.env.LIVE_PERSISTED_IMPORT_RESPONSE_SOURCE_URL ?? (
	SOURCE_KIND === "kenya_ppip" ? "https://tenders.go.ke/tenders" : "https://www.ungm.org/Public/Notice?title=software"
);
const MAX_DOCUMENT_BYTES = Number(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_MAX_DOCUMENT_BYTES ?? 10 * 1024 * 1024);
const SOURCE_PAGE_LIMIT = Number(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_PAGE_LIMIT ?? (SOURCE_KIND === "kenya_ppip" ? 25 : 10));
const SOURCE_LIMIT = Number(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_SOURCE_LIMIT ?? 10);
const SOURCE_DETAIL_LIMIT = Number(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_DETAIL_LIMIT ?? 5);
const DOCLING_CONVERSION_ATTEMPTS = Number(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_DOCLING_ATTEMPTS ?? 3);
const DB_CONNECTION_TIMEOUT_MS = Number(process.env.LIVE_PERSISTED_IMPORT_RESPONSE_DB_TIMEOUT_MS ?? 5000);

interface PersistedProofIds {
	organizationId: string;
	userId: string;
	opportunityId: string;
	opportunityDocumentId: string;
	rfpDocumentId: string;
	requirementIds: string[];
	documentIds: string[];
	proposalDocumentIds: string[];
	winThemeIds: string[];
}

interface LivePersistedImportResponseProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		kind: LivePersistedSourceKind;
		url: string;
		searchUrl?: string;
		apiUrl?: string;
		total?: number;
		opportunityCount: number;
	};
	opportunity?: {
		title: string;
		organization?: string;
		sourceId?: string;
		portalUrl?: string;
		documentUrl: string;
	};
	document?: {
		url: string;
		status: number;
		contentType?: string;
		byteLength: number;
		extractedTextLength: number;
		doclingStatus?: string;
		fileHash: string;
	};
	responseReadiness?: {
		sourceRequirementCount: number;
		evaluationCriteriaCount: number;
		responseDocumentCount: number;
		responseDocumentTypes: ProposalDocumentType[];
		totalDraftWordCount: number;
		winThemeSeedCount: number;
		readinessStatus: string;
		readinessWarnings: string[];
		missingDraftEvaluationCriteriaIds: string[];
		missingWinThemeEvaluationCriteriaIds: string[];
	};
	persisted?: {
		ids: PersistedProofIds;
		verified: {
			opportunityRows: number;
			opportunityDocumentRows: number;
			rfpDocumentRows: number;
			requirementRows: number;
			proposalDocumentRows: number;
			responseDocumentRows: number;
			winThemeRows: number;
			responseDocumentTypes: string[];
			minResponseDocumentWordCount: number;
			winThemeCriteriaIds: string[];
			draftCoveredEvaluationCriteriaIds: string[];
		};
	};
	schema?: {
		checkedColumns: string[];
		checkedIndexes: string[];
	};
	database?: {
		configured: boolean;
		host?: string;
		port?: string;
		database?: string;
		sslMode?: string;
		connectionTimeoutMs: number;
		schemaPreflight: "not-run" | "passed";
	};
	cleanup?: {
		results: CleanupResult[];
		remainingRows?: Record<string, number>;
	};
	error?: string;
}

interface ExtractedSourceDocument {
	url: string;
	status: number;
	contentType?: string;
	bytes: Buffer;
	fileHash: string;
	sourceText: string;
	doclingStatus?: string;
}

interface SourceDocumentConversion {
	converted: DoclingConvertResponse;
	sourceText: string;
}

type LivePersistedSourceKind = "ungm" | "kenya_ppip";

interface LivePersistedSourceResult {
	kind: LivePersistedSourceKind;
	url: string;
	searchUrl?: string;
	apiUrl?: string;
	total?: number;
	opportunities: OpportunityData[];
}

async function main() {
	const cleanup = new ProofCleanupRegistry();
	const proof: LivePersistedImportResponseProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			kind: SOURCE_KIND,
			url: SOURCE_URL,
			opportunityCount: 0,
		},
		database: databaseTargetFromEnv(),
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		Object.assign(proof, await proveLivePersistedImportResponse(cleanup));
		proof.completedAt = new Date().toISOString();
		disposition = "pass";
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		disposition = "fail";
	} finally {
		proof.cleanup = {
			results: await cleanup.cleanupAll(),
		};
		if (proof.persisted?.ids) {
			proof.cleanup.remainingRows = await countRemainingProofRows(proof.persisted.ids);
		}
		if (Object.values(proof.cleanup.remainingRows ?? {}).some((count) => count > 0)) {
			proof.error = "Live persisted import-response proof cleanup left rows behind";
			disposition = "fail";
		}
		await writeArtifacts(proof, disposition);
		await closeDatabaseConnection();
	}

	console.log(JSON.stringify(proof, null, 2));
	if (disposition !== "pass") process.exit(1);
}

async function proveLivePersistedImportResponse(
	cleanup: ProofCleanupRegistry
): Promise<Partial<LivePersistedImportResponseProof>> {
	const schema = await assertPersistedProofSchemaReady();
	const source = await fetchSourceOpportunities();
	const opportunity = selectResponseReadyOpportunity(source.opportunities);
	const documentUrl = opportunity?.rfpLink ?? opportunity?.documentUrl;
	if (!opportunity || !documentUrl) {
		throw new Error(`${source.kind} source returned no response-ready opportunity with a direct source document`);
	}

	const extracted = await fetchAndExtractSourceDocument(documentUrl);
	const responsePackage = buildLiveResponsePackage({
		opportunity,
		sourceText: extracted.sourceText,
	});
	if (responsePackage.readiness.status !== "ready_for_review") {
		throw new Error(`Response package was not ready for review: ${responsePackage.readiness.blockers.join("; ")}`);
	}
	const persisted = await persistProofRecords(opportunity, extracted, responsePackage, cleanup);

	return {
		source: {
			kind: source.kind,
			url: SOURCE_URL,
			searchUrl: source.searchUrl,
			apiUrl: source.apiUrl,
			total: source.total,
			opportunityCount: source.opportunities.length,
		},
		opportunity: {
			title: opportunity.title,
			organization: opportunity.organization,
			sourceId: opportunity.sourceId,
			portalUrl: opportunity.portalUrl,
			documentUrl,
		},
		document: {
			url: extracted.url,
			status: extracted.status,
			contentType: extracted.contentType,
			byteLength: extracted.bytes.length,
			extractedTextLength: extracted.sourceText.length,
			doclingStatus: extracted.doclingStatus,
			fileHash: extracted.fileHash,
		},
		responseReadiness: {
			sourceRequirementCount: responsePackage.requirements.length,
			evaluationCriteriaCount: responsePackage.evaluationCriteria.length,
			responseDocumentCount: responsePackage.documents.length,
			responseDocumentTypes: responsePackage.documents.map((document) => document.documentType),
			totalDraftWordCount: responsePackage.totalWordCount,
			winThemeSeedCount: responsePackage.winThemeSeeds.length,
			readinessStatus: responsePackage.readiness.status,
			readinessWarnings: responsePackage.readiness.warnings,
			missingDraftEvaluationCriteriaIds: responsePackage.readiness.missingDraftEvaluationCriteriaIds,
			missingWinThemeEvaluationCriteriaIds: responsePackage.readiness.missingWinThemeEvaluationCriteriaIds,
		},
		schema,
		database: {
			...databaseTargetFromEnv(),
			schemaPreflight: "passed",
		},
		persisted,
	};
}

const REQUIRED_DB_COLUMNS = [
	["opportunities", "organization_id"],
	["opportunity_documents", "organization_id"],
	["proposal_documents", "organization_id"],
	["rfp_documents", "organization_id"],
	["rfp_requirements", "organization_id"],
] as const;

const REQUIRED_DB_INDEXES = [
	"opportunities_organization_idx",
	"opp_docs_organization_idx",
	"proposal_docs_organization_idx",
	"opportunities_source_id_file_idx",
	"opportunities_fingerprint_idx",
] as const;

async function assertPersistedProofSchemaReady(): Promise<NonNullable<LivePersistedImportResponseProof["schema"]>> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required for live persisted schema preflight");

	const pool = new Pool({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false },
		connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
	});
	try {
		const columnPredicate = REQUIRED_DB_COLUMNS
			.map((_, index) => `(table_name::text = $${(index * 2) + 1} AND column_name::text = $${(index * 2) + 2})`)
			.join(" OR ");
		const columnParams = REQUIRED_DB_COLUMNS.flatMap(([table, column]) => [table, column]);
		const columns = await pool.query<{ table_name: string; column_name: string }>(
			`SELECT table_name::text AS table_name, column_name::text AS column_name
			 FROM information_schema.columns
			 WHERE table_schema = 'public' AND (${columnPredicate})`,
			columnParams
		);
		const presentColumns = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
		const checkedColumns = REQUIRED_DB_COLUMNS.map(([table, column]) => `${table}.${column}`);
		const missingColumns = checkedColumns.filter((column) => !presentColumns.has(column));

		const indexParams = [...REQUIRED_DB_INDEXES];
		const indexPlaceholders = indexParams.map((_, index) => `$${index + 1}`).join(", ");
		const indexes = await pool.query<{ indexname: string }>(
			`SELECT indexname
			 FROM pg_indexes
			 WHERE schemaname = 'public' AND indexname IN (${indexPlaceholders})`,
			indexParams
		);
		const presentIndexes = new Set(indexes.rows.map((row) => row.indexname));
		const checkedIndexes = [...REQUIRED_DB_INDEXES];
		const missingIndexes = checkedIndexes.filter((index) => !presentIndexes.has(index));

		if (missingColumns.length || missingIndexes.length) {
			throw new Error([
				"Live persisted import-response schema is not ready.",
				missingColumns.length ? `Missing columns: ${missingColumns.join(", ")}` : undefined,
				missingIndexes.length ? `Missing indexes: ${missingIndexes.join(", ")}` : undefined,
				"Apply frontend/drizzle/0032_live_response_persistence_tenant_repair.sql before rerunning.",
			].filter(Boolean).join(" "));
		}

		return { checkedColumns, checkedIndexes };
	} finally {
		await pool.end();
	}
}

async function fetchSourceOpportunities(): Promise<LivePersistedSourceResult> {
	if (SOURCE_KIND === "kenya_ppip") {
		const source = await fetchKenyaPpipOpportunities(SOURCE_URL, {
			limit: SOURCE_LIMIT,
			timeoutMs: 20000,
		});
		return {
			kind: "kenya_ppip",
			url: SOURCE_URL,
			apiUrl: source.apiUrl,
			total: source.total,
			opportunities: source.opportunities,
		};
	}

	const source = await fetchUngmOpportunities(SOURCE_URL, {
		limit: SOURCE_LIMIT,
		timeoutMs: 20000,
		detailLimit: SOURCE_DETAIL_LIMIT,
	});
	return {
		kind: "ungm",
		url: SOURCE_URL,
		searchUrl: source.searchUrl,
		total: source.total,
		opportunities: source.opportunities,
	};
}

function selectResponseReadyOpportunity(opportunities: OpportunityData[]): OpportunityData | undefined {
	return opportunities.find((opportunity) => {
		const documentUrl = opportunity.rfpLink ?? opportunity.documentUrl ?? "";
		const haystack = `${opportunity.title} ${opportunity.projectSummary ?? ""} ${documentUrl}`.toLowerCase();
		return /\.(pdf|docx?)(?:[?#]|$)/i.test(documentUrl)
			&& [
				"software",
				"system",
				"api",
				"security",
				"digital",
				"data",
				"consultancy",
				"services",
				"survey",
				"ict",
			].some((term) => haystack.includes(term));
	});
}

async function fetchAndExtractSourceDocument(documentUrl: string): Promise<ExtractedSourceDocument> {
	const doclingHealthy = await checkDoclingHealth();
	if (!doclingHealthy) {
		throw new Error("Docling health check failed before live persisted source extraction");
	}

	const response = await fetchPublicHttpUrl(documentUrl, {
		headers: {
			"User-Agent": "DocFusion/1.0 live-persisted-import-response-proof",
		},
		timeoutMs: 30000,
		allowInvalidTlsForHosts: ["tenders.go.ke"],
	}, "live persisted import-response source document");
	if (!response.ok) {
		throw new Error(`Live persisted source document returned HTTP ${response.status}`);
	}

	const contentType = response.headers.get("content-type") ?? undefined;
	const bytes = Buffer.from(await response.arrayBuffer());
	if (bytes.length > MAX_DOCUMENT_BYTES) {
		throw new Error(`Live persisted source document exceeded ${MAX_DOCUMENT_BYTES} bytes`);
	}

	const { converted, sourceText } = await convertSourceDocumentWithRetries(bytes, filenameFromUrl(documentUrl));

	return {
		url: documentUrl,
		status: response.status,
		contentType,
		bytes,
		fileHash: crypto.createHash("sha256").update(bytes).digest("hex"),
		sourceText,
		doclingStatus: converted.status,
	};
}

async function convertSourceDocumentWithRetries(
	bytes: Buffer,
	filename: string
): Promise<SourceDocumentConversion> {
	let lastError: Error | undefined;
	for (let attempt = 1; attempt <= DOCLING_CONVERSION_ATTEMPTS; attempt += 1) {
		try {
			const converted = await convertDocument(bytes, filename, {
				outputFormat: "text",
				ocr: false,
				extractTables: false,
				extractImages: false,
				pageRange: [1, SOURCE_PAGE_LIMIT],
				documentTimeoutSeconds: 90,
			});
			if (converted.status && converted.status !== "success" && converted.status !== "partial_success") {
				throw new Error(`Docling conversion did not succeed: ${converted.status}`);
			}
			const sourceText = cleanExtractedText(converted.text ?? converted.markdown ?? "");
			if (sourceText.length < 1000) {
				throw new Error(`Docling extracted too little source text: ${sourceText.length} characters`);
			}
			return { converted, sourceText };
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < DOCLING_CONVERSION_ATTEMPTS) {
				await delay(750 * attempt);
			}
		}
	}

	throw lastError ?? new Error("Docling conversion failed without an error detail");
}

async function persistProofRecords(
	opportunity: OpportunityData,
	extracted: ExtractedSourceDocument,
	responsePackage: LiveResponsePackage,
	cleanup: ProofCleanupRegistry
): Promise<NonNullable<LivePersistedImportResponseProof["persisted"]>> {
	const organizationId = `proof-org-${RUN_ID}`.slice(0, 100);
	const userId = `proof-user-${RUN_ID}`.slice(0, 100);
	const now = new Date();
	const proofMetadata = {
		proofRunId: RUN_ID,
		source: "live-persisted-import-response",
	};
	const documentUrl = opportunity.rfpLink ?? opportunity.documentUrl;

	const [createdOpportunity] = await db.insert(opportunities).values({
		organizationId,
		sourceId: `${opportunity.sourceId ?? "live"}-${RUN_ID}`.slice(0, 50),
		title: opportunity.title,
		category: opportunity.category,
		countryRegion: opportunity.countryRegion,
		organization: opportunity.organization,
		deadline: dateOrUndefined(opportunity.deadline),
		projectSummary: opportunity.projectSummary,
		submissionMethod: opportunity.submissionMethod,
		rfpLink: documentUrl,
		sourcePlatform: sourcePlatformLabel(opportunity.source),
		sourceFile: `proof:${RUN_ID}`.slice(0, 500),
		opportunityType: opportunity.opportunityType ?? "eoi",
		source: opportunity.source,
		fingerprint: crypto.createHash("sha256").update(`${RUN_ID}:${documentUrl ?? opportunity.portalUrl ?? opportunity.title}`).digest("hex"),
		noticeId: opportunity.noticeId,
		portalUrl: opportunity.portalUrl,
		documentUrl,
		scrapedAt: now,
		publishedDate: dateOrUndefined(opportunity.publishedDate),
		priorityRank: 4,
		decisionStatus: "pending",
		assignedTo: userId,
		isReviewed: true,
		tags: [...new Set([...(opportunity.tags ?? []), "proof", "live-persisted"])],
		metadata: {
			...(opportunity.metadata ?? {}),
			proof: proofMetadata,
		},
		documentsDiscovered: true,
		documentsDiscoveredAt: now,
		documentsDownloadedCount: 1,
		lastDocumentScanAt: now,
	}).returning({ id: opportunities.id });
	if (!createdOpportunity?.id) throw new Error("Persisted proof opportunity insert returned no id");
	cleanup.register({
		id: createdOpportunity.id,
		kind: "opportunity",
		cleanup: async () => {
			await db.delete(opportunities).where(eq(opportunities.id, createdOpportunity.id));
		},
	});

	const [createdOpportunityDocument] = await db.insert(opportunityDocuments).values({
		organizationId,
		opportunityId: createdOpportunity.id,
		documentName: filenameFromUrl(extracted.url),
		documentType: "rfp",
		description: "Live persisted proof source document.",
		sourceUrl: extracted.url,
		localPath: `proof-runs/${RUN_ID}/${filenameFromUrl(extracted.url)}`,
		fileSizeBytes: extracted.bytes.length,
		mimeType: extracted.contentType,
		fileHash: extracted.fileHash,
		downloadedAt: now,
		downloadAttempts: 1,
		extractedText: extracted.sourceText,
		extractedAt: now,
		isAnalyzed: true,
		analyzedAt: now,
		analysisResults: {
			requirementCount: responsePackage.requirements.length,
			readiness: responsePackage.readiness,
		},
		status: "analyzed",
		isSelected: true,
		downloadedBy: userId,
	}).returning({ id: opportunityDocuments.id });
	if (!createdOpportunityDocument?.id) throw new Error("Persisted proof opportunity document insert returned no id");
	cleanup.register({
		id: createdOpportunityDocument.id,
		kind: "opportunity_document",
		cleanup: async () => {
			await db.delete(opportunityDocuments).where(eq(opportunityDocuments.id, createdOpportunityDocument.id));
		},
	});

	const [createdRfpDocument] = await db.insert(rfpDocuments).values({
		organizationId,
		opportunityId: createdOpportunity.id,
		filename: filenameFromUrl(extracted.url),
		fileType: fileTypeFromUrl(extracted.url),
		fileSize: extracted.bytes.length,
		storagePath: `proof-runs/${RUN_ID}/${filenameFromUrl(extracted.url)}`,
		fileHash: extracted.fileHash,
		rfpFormat: opportunity.opportunityType ?? "eoi",
		parsingStatus: "completed",
		parsingProgress: 100,
		parsingStartedAt: now,
		parsingCompletedAt: now,
		extractedTitle: opportunity.title,
		issuingOrganization: opportunity.organization,
		solicitationNumber: opportunity.sourceId ?? opportunity.noticeId,
		responseDeadline: dateOrUndefined(opportunity.deadline),
		submissionInstructions: opportunity.submissionMethod,
		wordCount: countWords(extracted.sourceText),
		detectedSections: responsePackage.requirements.map((requirement) => requirement.sourceSection).filter(Boolean),
		aiSummary: compactText(extracted.sourceText, 1200),
		keyThemes: responsePackage.relevantSnippetShortcuts.slice(0, 12),
		parsingConfidence: 95,
		extractedText: extracted.sourceText,
		uploadedBy: userId,
		metadata: {
			proof: proofMetadata,
			sourceUrl: extracted.url,
			responseReadiness: responsePackage.readiness,
		},
	}).returning({ id: rfpDocuments.id });
	if (!createdRfpDocument?.id) throw new Error("Persisted proof RFP document insert returned no id");
	cleanup.register({
		id: createdRfpDocument.id,
		kind: "rfp_document",
		cleanup: async () => {
			await db.delete(rfpDocuments).where(eq(rfpDocuments.id, createdRfpDocument.id));
		},
	});

	const createdRequirements = await db.insert(rfpRequirements).values(responsePackage.requirements.map((requirement) => ({
		organizationId,
		rfpDocumentId: createdRfpDocument.id,
		opportunityId: createdOpportunity.id,
		requirementNumber: requirement.id,
		title: compactText(requirement.text, 120),
		requirementText: requirement.text,
		sourceQuote: requirement.text,
		sourceSection: requirement.sourceSection,
		category: requirement.documentType,
		requirementType: requirement.priority === "mandatory" ? "shall" : "should",
		priority: requirement.priority === "administrative" ? "optional" : requirement.priority,
		riskLevel: requirement.priority === "mandatory" ? "high" : "medium",
		extractionConfidence: 90,
		aiAnalysis: {
			responseStrategy: requirement.responseStrategy,
		},
		complianceStatus: "addressed",
		responseStrategy: requirement.responseStrategy,
		assignedTo: userId,
		tags: ["live-proof", requirement.documentType],
		metadata: {
			proof: proofMetadata,
		},
	}))).returning({ id: rfpRequirements.id });
	cleanup.register({
		id: createdRfpDocument.id,
		kind: "rfp_requirements",
		cleanup: async () => {
			await db.delete(rfpRequirements).where(eq(rfpRequirements.rfpDocumentId, createdRfpDocument.id));
		},
	});
	if (createdRequirements.length !== responsePackage.requirements.length) {
		throw new Error("Persisted proof requirement insert count mismatch");
	}

	const createdDocuments = await db.insert(documents).values(responsePackage.documents.map((document) => ({
		title: document.title,
		content: markdownDocumentContent(document.markdown),
		plainText: document.markdown,
		status: "draft",
		visibility: "private",
		ownerId: userId,
		tags: ["live-proof", document.documentType],
		wordCount: document.wordCount,
		characterCount: document.markdown.length,
		metadata: {
			proof: proofMetadata,
			documentType: document.documentType,
			requirementIds: document.requirementIds,
			evaluationCriteriaIds: document.evaluationCriteriaIds,
			relevantSnippetShortcuts: document.relevantSnippetShortcuts,
		},
	}))).returning({ id: documents.id, title: documents.title });
	const documentIds = createdDocuments.map((document) => document.id);
	cleanup.register({
		id: createdOpportunity.id,
		kind: "response_documents",
		cleanup: async () => {
			await db.delete(documents).where(inArray(documents.id, documentIds));
		},
	});
	if (createdDocuments.length !== responsePackage.documents.length) {
		throw new Error("Persisted proof response document insert count mismatch");
	}

	const createdProposalDocuments = await db.insert(proposalDocuments).values(responsePackage.documents.map((document, index) => ({
		organizationId,
		opportunityId: createdOpportunity.id,
		documentId: documentIds[index],
		documentType: document.documentType,
		sectionOrder: index + 1,
		status: "draft",
		assignedTo: userId,
		aiAnalysisScore: responsePackage.readiness.metrics.sourceRequirementCoverage * 100,
		aiAnalysisAt: now,
		notes: `Live persisted proof ${RUN_ID}; requirements=${document.requirementIds.join(",")}`,
	}))).returning({ id: proposalDocuments.id });
	cleanup.register({
		id: createdOpportunity.id,
		kind: "proposal_documents",
		cleanup: async () => {
			await db.delete(proposalDocuments).where(eq(proposalDocuments.opportunityId, createdOpportunity.id));
		},
	});
	if (createdProposalDocuments.length !== responsePackage.documents.length) {
		throw new Error("Persisted proof proposal document insert count mismatch");
	}

	const createdWinThemes = await db.insert(winThemes).values(responsePackage.winThemeSeeds.map((seed, index) => ({
		opportunityId: createdOpportunity.id,
		themeStatement: seed.statement,
		shortVersion: seed.shortVersion,
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
		createdBy: userId,
	}))).returning({ id: winThemes.id });
	const winThemeIds = createdWinThemes.map((theme) => theme.id);
	cleanup.register({
		id: createdOpportunity.id,
		kind: "win_themes",
		cleanup: async () => {
			await db.delete(winThemes).where(inArray(winThemes.id, winThemeIds));
		},
	});
	if (createdWinThemes.length !== responsePackage.winThemeSeeds.length) {
		throw new Error("Persisted proof win theme insert count mismatch");
	}

	const ids: PersistedProofIds = {
		organizationId,
		userId,
		opportunityId: createdOpportunity.id,
		opportunityDocumentId: createdOpportunityDocument.id,
		rfpDocumentId: createdRfpDocument.id,
		requirementIds: createdRequirements.map((requirement) => requirement.id),
		documentIds,
		proposalDocumentIds: createdProposalDocuments.map((document) => document.id),
		winThemeIds,
	};
	return {
		ids,
		verified: await verifyPersistedProofRows(ids),
	};
}

async function verifyPersistedProofRows(ids: PersistedProofIds): Promise<NonNullable<NonNullable<LivePersistedImportResponseProof["persisted"]>["verified"]>> {
	const opportunityRows = await db.select({ id: opportunities.id }).from(opportunities).where(and(
		eq(opportunities.id, ids.opportunityId),
		eq(opportunities.organizationId, ids.organizationId)
	));
	const opportunityDocumentRows = await db.select({ id: opportunityDocuments.id }).from(opportunityDocuments).where(and(
		eq(opportunityDocuments.id, ids.opportunityDocumentId),
		eq(opportunityDocuments.organizationId, ids.organizationId)
	));
	const rfpDocumentRows = await db.select({ id: rfpDocuments.id }).from(rfpDocuments).where(and(
		eq(rfpDocuments.id, ids.rfpDocumentId),
		eq(rfpDocuments.organizationId, ids.organizationId)
	));
	const requirementRows = await db.select({ id: rfpRequirements.id }).from(rfpRequirements).where(and(
		eq(rfpRequirements.rfpDocumentId, ids.rfpDocumentId),
		eq(rfpRequirements.organizationId, ids.organizationId)
	));
	const responseDocumentRows = await db.select({
		id: documents.id,
		wordCount: documents.wordCount,
		metadata: documents.metadata,
	}).from(documents).where(inArray(documents.id, ids.documentIds));
	const proposalDocumentRows = await db.select({
		id: proposalDocuments.id,
		documentType: proposalDocuments.documentType,
	}).from(proposalDocuments).where(and(
		eq(proposalDocuments.opportunityId, ids.opportunityId),
		eq(proposalDocuments.organizationId, ids.organizationId)
	));
	const winThemeRows = await db.select({
		id: winThemes.id,
		evaluationCriteriaIds: winThemes.evaluationCriteriaIds,
	}).from(winThemes).where(inArray(winThemes.id, ids.winThemeIds));
	const responseDocumentTypes = proposalDocumentRows.map((row) => row.documentType).sort();
	const minResponseDocumentWordCount = Math.min(...responseDocumentRows.map((row) => row.wordCount));
	const winThemeCriteriaIds = [...new Set(winThemeRows.flatMap((row) => row.evaluationCriteriaIds ?? []))].sort();
	const draftCoveredEvaluationCriteriaIds = [...new Set(responseDocumentRows.flatMap((row) =>
		evaluationCriteriaIdsFromMetadata(row.metadata)
	))].sort();

	if (opportunityRows.length !== 1) throw new Error("Persisted proof opportunity verification failed");
	if (opportunityDocumentRows.length !== 1) throw new Error("Persisted proof opportunity document verification failed");
	if (rfpDocumentRows.length !== 1) throw new Error("Persisted proof RFP document verification failed");
	if (requirementRows.length < 3) throw new Error("Persisted proof requirement verification found too few rows");
	if (proposalDocumentRows.length !== 6) throw new Error("Persisted proof proposal document verification failed");
	if (responseDocumentRows.length !== 6) throw new Error("Persisted proof response document verification failed");
	if (winThemeRows.length < 1) throw new Error("Persisted proof win theme verification failed");
	if (minResponseDocumentWordCount < 250) throw new Error("Persisted proof response documents are too thin");

	return {
		opportunityRows: opportunityRows.length,
		opportunityDocumentRows: opportunityDocumentRows.length,
		rfpDocumentRows: rfpDocumentRows.length,
		requirementRows: requirementRows.length,
		proposalDocumentRows: proposalDocumentRows.length,
		responseDocumentRows: responseDocumentRows.length,
		winThemeRows: winThemeRows.length,
		responseDocumentTypes,
		minResponseDocumentWordCount,
		winThemeCriteriaIds,
		draftCoveredEvaluationCriteriaIds,
	};
}

function evaluationCriteriaIdsFromMetadata(metadata: unknown): string[] {
	if (!metadata || typeof metadata !== "object" || !("evaluationCriteriaIds" in metadata)) return [];
	const value = (metadata as { evaluationCriteriaIds?: unknown }).evaluationCriteriaIds;
	return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
}

async function countRemainingProofRows(ids: PersistedProofIds): Promise<Record<string, number>> {
	const [
		opportunityRows,
		opportunityDocumentRows,
		rfpDocumentRows,
		requirementRows,
		proposalDocumentRows,
		responseDocumentRows,
		winThemeRows,
	] = await Promise.all([
		db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, ids.opportunityId)),
		db.select({ id: opportunityDocuments.id }).from(opportunityDocuments).where(eq(opportunityDocuments.id, ids.opportunityDocumentId)),
		db.select({ id: rfpDocuments.id }).from(rfpDocuments).where(eq(rfpDocuments.id, ids.rfpDocumentId)),
		db.select({ id: rfpRequirements.id }).from(rfpRequirements).where(eq(rfpRequirements.rfpDocumentId, ids.rfpDocumentId)),
		db.select({ id: proposalDocuments.id }).from(proposalDocuments).where(eq(proposalDocuments.opportunityId, ids.opportunityId)),
		db.select({ id: documents.id }).from(documents).where(inArray(documents.id, ids.documentIds)),
		db.select({ id: winThemes.id }).from(winThemes).where(inArray(winThemes.id, ids.winThemeIds)),
	]);
	return {
		opportunities: opportunityRows.length,
		opportunityDocuments: opportunityDocumentRows.length,
		rfpDocuments: rfpDocumentRows.length,
		rfpRequirements: requirementRows.length,
		proposalDocuments: proposalDocumentRows.length,
		responseDocuments: responseDocumentRows.length,
		winThemes: winThemeRows.length,
	};
}

function markdownDocumentContent(markdown: string) {
	return {
		type: "doc",
		content: markdown.split(/\n{2,}/).slice(0, 80).map((paragraph) => ({
			type: "paragraph",
			content: [{ type: "text", text: paragraph.slice(0, 5000) }],
		})),
	};
}

function filenameFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		const filename = pathname.split("/").filter(Boolean).pop();
		return filename || "source-document.pdf";
	} catch {
		return "source-document.pdf";
	}
}

function fileTypeFromUrl(url: string): string {
	const filename = filenameFromUrl(url).toLowerCase();
	if (filename.endsWith(".docx")) return "docx";
	if (filename.endsWith(".doc")) return "doc";
	if (filename.endsWith(".html") || filename.endsWith(".htm")) return "html";
	return "pdf";
}

function normalizeSourceKind(value: string | undefined): LivePersistedSourceKind {
	if (value === "kenya_ppip") return "kenya_ppip";
	return "ungm";
}

function sourcePlatformLabel(source: OpportunityData["source"]): string {
	if (source === "ungm") return "UNGM";
	if (source === "kenya_ppip") return "Kenya PPIP";
	return "Live source discovery";
}

function databaseTargetFromEnv(): NonNullable<LivePersistedImportResponseProof["database"]> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		return {
			configured: false,
			connectionTimeoutMs: DB_CONNECTION_TIMEOUT_MS,
			schemaPreflight: "not-run",
		};
	}

	try {
		const parsed = new URL(databaseUrl);
		return {
			configured: true,
			host: parsed.hostname,
			port: parsed.port || "5432",
			database: parsed.pathname.replace(/^\/+/u, "") || undefined,
			sslMode: parsed.searchParams.get("sslmode") ?? undefined,
			connectionTimeoutMs: DB_CONNECTION_TIMEOUT_MS,
			schemaPreflight: "not-run",
		};
	} catch {
		return {
			configured: true,
			host: "unparseable",
			connectionTimeoutMs: DB_CONNECTION_TIMEOUT_MS,
			schemaPreflight: "not-run",
		};
	}
}

function cleanExtractedText(text: string): string {
	return text
		.replace(/!\[Image]\(data:image\/[^)]+\)/g, " ")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function dateOrUndefined(value: OpportunityData["deadline"] | OpportunityData["publishedDate"]): Date | undefined {
	if (!value) return undefined;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

function compactText(text: string, maxLength: number): string {
	const compacted = text.replace(/\s+/g, " ").trim();
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeArtifacts(
	proof: LivePersistedImportResponseProof,
	disposition: EvidenceRecord["disposition"]
) {
	const rawPath = await writeProofJson(LOG_DIR, "live-persisted-import-response.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	const cleanupRemaining = Object.values(proof.cleanup?.remainingRows ?? {}).reduce((total, count) => total + count, 0);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001/F-005/F-008/F-020",
		journey: "J1/O1/O4",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source-kind:${proof.source.kind}`,
			`source:${proof.source.url}`,
			`database-host:${proof.database?.host ?? "unconfigured"}`,
			`database-port:${proof.database?.port ?? "unknown"}`,
			`database-schema-preflight:${proof.database?.schemaPreflight ?? "not-run"}`,
			...(proof.source.apiUrl ? [`source-api:${proof.source.apiUrl}`] : []),
			`opportunities:${proof.source.opportunityCount}`,
			`document-bytes:${proof.document?.byteLength ?? 0}`,
			`docling-text:${proof.document?.extractedTextLength ?? 0}`,
			`docling-status:${proof.document?.doclingStatus ?? "not-run"}`,
			`source-requirements:${proof.responseReadiness?.sourceRequirementCount ?? 0}`,
			`evaluator-criteria:${proof.responseReadiness?.evaluationCriteriaCount ?? 0}`,
			`readiness:${proof.responseReadiness?.readinessStatus ?? "not-run"}`,
			`readiness-warnings:${proof.responseReadiness?.readinessWarnings.length ?? 0}`,
			`readiness-missing-draft-criteria:${proof.responseReadiness?.missingDraftEvaluationCriteriaIds.length ?? 0}`,
			`readiness-missing-win-theme-criteria:${proof.responseReadiness?.missingWinThemeEvaluationCriteriaIds.length ?? 0}`,
			`opportunity-row:${proof.persisted?.verified.opportunityRows ?? 0}`,
			`source-document-row:${proof.persisted?.verified.opportunityDocumentRows ?? 0}`,
			`rfp-document-row:${proof.persisted?.verified.rfpDocumentRows ?? 0}`,
			`requirement-rows:${proof.persisted?.verified.requirementRows ?? 0}`,
			`proposal-document-rows:${proof.persisted?.verified.proposalDocumentRows ?? 0}`,
			`response-document-rows:${proof.persisted?.verified.responseDocumentRows ?? 0}`,
			`response-draft-words:${proof.responseReadiness?.totalDraftWordCount ?? 0}`,
			`win-theme-rows:${proof.persisted?.verified.winThemeRows ?? 0}`,
			`win-theme-criteria:${proof.persisted?.verified.winThemeCriteriaIds.length ?? 0}`,
			`draft-criteria:${proof.persisted?.verified.draftCoveredEvaluationCriteriaIds.length ?? 0}`,
			`cleanup-remaining:${cleanupRemaining}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe persisted import-to-response",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: cleanupStatusFor(disposition, cleanupRemaining),
		disposition,
		notes: disposition === "pass"
			? "Live opportunity, source document, parsed RFP, requirements, response draft records, and win themes were persisted, verified, and cleaned up."
			: proof.error ?? "Live persisted import-to-response proof failed.",
	}], {
		title: "Platform Live Persisted Import Response Evidence",
	});
}

function cleanupStatusFor(
	disposition: EvidenceRecord["disposition"],
	cleanupRemaining: number
): EvidenceRecord["cleanup_status"] {
	if (disposition === "pass") return "restored";
	return cleanupRemaining > 0 ? "cleanup-pending" : "idempotent-noop";
}

main().catch(async (error) => {
	console.error(error instanceof Error ? error.message : error);
	await closeDatabaseConnection().catch(() => undefined);
	process.exit(1);
});
