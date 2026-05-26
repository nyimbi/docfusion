import "./load-env";

import path from "node:path";
import fs from "node:fs/promises";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import { checkDoclingHealth, convertDocument } from "@/lib/services/docling-client";
import {
	buildLiveResponsePackage,
	type LiveResponsePackage,
} from "@/lib/services/live-response-package";
import { fetchUngmOpportunities } from "@/lib/services/ungm-client";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import type { ProposalDocumentType } from "@/lib/types/opportunity";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_RESPONSE_READINESS_PROOF_RUN_ID ?? createProofRunId("live_response_readiness");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-response-readiness" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-opportunity-response-readiness-evidence.md");
const SOURCE_URL = process.env.LIVE_RESPONSE_READINESS_SOURCE_URL ?? "https://www.ungm.org/Public/Notice?title=software";
const MAX_DOCUMENT_BYTES = Number(process.env.LIVE_RESPONSE_READINESS_MAX_DOCUMENT_BYTES ?? 10 * 1024 * 1024);
const SOURCE_LIMIT = Number(process.env.LIVE_RESPONSE_READINESS_SOURCE_LIMIT ?? 10);
const SOURCE_DETAIL_LIMIT = Number(process.env.LIVE_RESPONSE_READINESS_DETAIL_LIMIT ?? 5);
const PROPOSAL_DOCUMENT_TYPES: ProposalDocumentType[] = [
	"cover_letter",
	"executive_summary",
	"technical_approach",
	"management_plan",
	"past_performance",
	"cost_proposal",
];
const PROCUREMENT_INDICATORS = [
	"request for expression of interest",
	"request for proposal",
	"eoi",
	"proposal",
	"tender",
	"procurement",
	"submission",
];

interface LiveOpportunityResponseReadinessProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		url: string;
		searchUrl?: string;
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
		procurementIndicators: string[];
		extractedPreview: string;
	};
	responseReadiness?: {
		documentTypes: ProposalDocumentType[];
		totalSectionSeeds: number;
		sourceRequirementCount: number;
		relevantSnippetCount: number;
		relevantSnippetShortcuts: string[];
		seededDocumentWordCounts: Record<string, number>;
		totalDraftWordCount: number;
		draftArtifactPaths: string[];
	};
	error?: string;
}

interface ExtractedSourceDocument {
	document: NonNullable<LiveOpportunityResponseReadinessProof["document"]>;
	sourceText: string;
}

async function main() {
	const proof: LiveOpportunityResponseReadinessProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			url: SOURCE_URL,
			opportunityCount: 0,
		},
	};

	try {
		const result = await proveLiveOpportunityResponseReadiness();
		Object.assign(proof, result);
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function proveLiveOpportunityResponseReadiness(): Promise<Partial<LiveOpportunityResponseReadinessProof>> {
	const source = await fetchUngmOpportunities(SOURCE_URL, {
		limit: SOURCE_LIMIT,
		timeoutMs: 20000,
		detailLimit: SOURCE_DETAIL_LIMIT,
	});
	const opportunity = selectResponseReadyOpportunity(source.opportunities);
	if (!opportunity?.rfpLink) {
		throw new Error("UNGM software source returned no response-ready opportunity with a direct source document");
	}

	const extracted = await fetchAndExtractSourceDocument(opportunity.rfpLink);
	const responsePackage = buildLiveResponsePackage({
		opportunity,
		sourceText: extracted.sourceText,
	});
	const draftArtifactPaths = await writeResponsePackageArtifacts(responsePackage);
	const responseReadiness = proveResponseSeedReadiness(responsePackage, draftArtifactPaths);

	return {
		source: {
			url: SOURCE_URL,
			searchUrl: source.searchUrl,
			total: source.total,
			opportunityCount: source.opportunities.length,
		},
		opportunity: {
			title: opportunity.title,
			organization: opportunity.organization,
			sourceId: opportunity.sourceId,
			portalUrl: opportunity.portalUrl,
			documentUrl: opportunity.rfpLink,
		},
		document: extracted.document,
		responseReadiness,
	};
}

function selectResponseReadyOpportunity(opportunities: OpportunityData[]): OpportunityData | undefined {
	return opportunities.find((opportunity) => {
		const documentUrl = opportunity.rfpLink ?? "";
		const haystack = `${opportunity.title} ${opportunity.projectSummary ?? ""} ${documentUrl}`.toLowerCase();
		return documentUrl.toLowerCase().endsWith(".pdf")
			&& ["software", "system", "api", "security", "digital", "data"].some((term) => haystack.includes(term));
	});
}

async function fetchAndExtractSourceDocument(documentUrl: string): Promise<ExtractedSourceDocument> {
	const doclingHealthy = await checkDoclingHealth();
	if (!doclingHealthy) {
		throw new Error("Docling health check failed before live response source extraction");
	}

	const response = await fetchPublicHttpUrl(documentUrl, {
		headers: {
			"User-Agent": "DocFusion/1.0 live-response-readiness-proof",
		},
		timeoutMs: 30000,
	}, "live response readiness source document");
	if (!response.ok) {
		throw new Error(`Live response source document returned HTTP ${response.status}`);
	}

	const contentType = response.headers.get("content-type") ?? undefined;
	const documentBytes = Buffer.from(await response.arrayBuffer());
	if (documentBytes.length > MAX_DOCUMENT_BYTES) {
		throw new Error(`Live response source document exceeded ${MAX_DOCUMENT_BYTES} bytes`);
	}

	const filename = filenameFromUrl(documentUrl);
	const converted = await convertDocument(documentBytes, filename, {
		outputFormat: "text",
		ocr: false,
		extractTables: false,
		extractImages: false,
		pageRange: [1, 2],
		documentTimeoutSeconds: 60,
	});
	const extractedText = cleanExtractedText(converted.text ?? converted.markdown ?? "");
	if (converted.status && converted.status !== "success") {
		throw new Error(`Docling conversion did not succeed: ${converted.status}`);
	}
	if (extractedText.length < 1000) {
		throw new Error(`Docling extracted too little source text: ${extractedText.length} characters`);
	}
	const procurementIndicators = PROCUREMENT_INDICATORS.filter((indicator) => extractedText.toLowerCase().includes(indicator));
	if (procurementIndicators.length === 0) {
		throw new Error("Docling source text did not contain procurement response language");
	}

	return {
		document: {
			url: documentUrl,
			status: response.status,
			contentType,
			byteLength: documentBytes.length,
			extractedTextLength: extractedText.length,
			doclingStatus: converted.status,
			procurementIndicators,
			extractedPreview: compactText(extractedText.replace(/\s+/g, " "), 500),
		},
		sourceText: extractedText,
	};
}

function proveResponseSeedReadiness(
	responsePackage: LiveResponsePackage,
	draftArtifactPaths: string[]
): NonNullable<LiveOpportunityResponseReadinessProof["responseReadiness"]> {
	const seededDocumentWordCounts: Record<string, number> = {};
	let totalSectionSeeds = 0;

	for (const document of responsePackage.documents) {
		totalSectionSeeds += document.sectionSeedCount;
		if (/\{\{(?:client_name|opportunity_name)\}\}/.test(document.markdown)) {
			throw new Error(`Response draft for ${document.documentType} still contains required placeholders`);
		}
		seededDocumentWordCounts[document.documentType] = document.wordCount;
	}

	if (responsePackage.requirements.length < 3) {
		throw new Error(`Too few source requirement signals for live response package: ${responsePackage.requirements.length}`);
	}
	if (responsePackage.relevantSnippetCount < 10) {
		throw new Error(`Too few relevant Datacraft snippets for live opportunity: ${responsePackage.relevantSnippetCount}`);
	}
	if (responsePackage.totalWordCount < 2000) {
		throw new Error(`Live response package draft is too thin: ${responsePackage.totalWordCount} words`);
	}

	return {
		documentTypes: PROPOSAL_DOCUMENT_TYPES,
		totalSectionSeeds,
		sourceRequirementCount: responsePackage.requirements.length,
		relevantSnippetCount: responsePackage.relevantSnippetCount,
		relevantSnippetShortcuts: responsePackage.relevantSnippetShortcuts.slice(0, 12),
		seededDocumentWordCounts,
		totalDraftWordCount: responsePackage.totalWordCount,
		draftArtifactPaths,
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

function cleanExtractedText(text: string): string {
	return text
		.replace(/!\[Image]\(data:image\/[^)]+\)/g, " ")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function compactText(text: string, maxLength: number): string {
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

async function writeResponsePackageArtifacts(responsePackage: LiveResponsePackage): Promise<string[]> {
	const packageDir = path.resolve(LOG_DIR, "response-package");
	await fs.mkdir(packageDir, { recursive: true });
	const relativePaths: string[] = [];
	for (const document of responsePackage.documents) {
		const filename = `${document.documentType}.md`;
		const filePath = path.resolve(packageDir, filename);
		await fs.writeFile(filePath, document.markdown, "utf8");
		relativePaths.push(path.relative(WORKSPACE_ROOT, filePath));
	}
	await writeProofJson(packageDir, "response-package-summary.json", responsePackage);
	relativePaths.push(path.relative(WORKSPACE_ROOT, path.resolve(packageDir, "response-package-summary.json")));
	return relativePaths;
}

async function writeArtifacts(
	proof: LiveOpportunityResponseReadinessProof,
	disposition: EvidenceRecord["disposition"]
) {
	const rawPath = await writeProofJson(LOG_DIR, "live-opportunity-response-readiness.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001/F-005/F-020",
		journey: "J1/O1/O4",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			`document-bytes:${proof.document?.byteLength ?? 0}`,
			`docling-text:${proof.document?.extractedTextLength ?? 0}`,
			`response-doc-types:${proof.responseReadiness?.documentTypes.length ?? 0}`,
			`source-requirements:${proof.responseReadiness?.sourceRequirementCount ?? 0}`,
			`response-draft-words:${proof.responseReadiness?.totalDraftWordCount ?? 0}`,
			`response-snippets:${proof.responseReadiness?.relevantSnippetCount ?? 0}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe opportunity response readiness",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live UNGM software opportunity, source PDF extraction, and concrete Datacraft response-package drafts were verified."
			: proof.error ?? "Live opportunity response readiness proof failed.",
	}], {
		title: "Platform Live Opportunity Response Readiness Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
