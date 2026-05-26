import "./load-env";

import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import {
	DATACRAFT_RESPONSE_SNIPPETS,
	getDatacraftProposalDocumentContent,
	getDatacraftProposalSectionSeeds,
	type DatacraftResponseSnippetInput,
} from "@/lib/data/datacraft-response-content";
import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import { checkDoclingHealth, convertDocument } from "@/lib/services/docling-client";
import { fetchUngmOpportunities } from "@/lib/services/ungm-client";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import type { DocumentContent } from "@/lib/types/document";
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
const RESPONSE_RELEVANCE_TERMS = [
	"api",
	"architecture",
	"compliance",
	"data",
	"delivery",
	"governance",
	"integration",
	"quality",
	"risk",
	"security",
	"software",
	"testing",
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
		relevantSnippetCount: number;
		relevantSnippetShortcuts: string[];
		seededDocumentWordCounts: Record<string, number>;
	};
	error?: string;
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

	const document = await fetchAndExtractSourceDocument(opportunity.rfpLink);
	const responseReadiness = proveResponseSeedReadiness(opportunity, document.extractedPreview);

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
		document,
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

async function fetchAndExtractSourceDocument(documentUrl: string): Promise<NonNullable<LiveOpportunityResponseReadinessProof["document"]>> {
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
		url: documentUrl,
		status: response.status,
		contentType,
		byteLength: documentBytes.length,
		extractedTextLength: extractedText.length,
		doclingStatus: converted.status,
		procurementIndicators,
		extractedPreview: compactText(extractedText, 500),
	};
}

function proveResponseSeedReadiness(
	opportunity: OpportunityData,
	extractedPreview: string
): NonNullable<LiveOpportunityResponseReadinessProof["responseReadiness"]> {
	const values = {
		client_name: opportunity.organization ?? "Procuring Entity",
		opportunity_name: opportunity.title,
		solicitation_number: opportunity.sourceId ?? opportunity.noticeId ?? "",
		submission_date: new Date().toISOString().slice(0, 10),
	};
	const seededDocumentWordCounts: Record<string, number> = {};
	let totalSectionSeeds = 0;

	for (const documentType of PROPOSAL_DOCUMENT_TYPES) {
		totalSectionSeeds += getDatacraftProposalSectionSeeds(documentType).length;
		const renderedText = renderPlaceholders(flattenContent(getDatacraftProposalDocumentContent(documentType)), values);
		if (/\{\{(?:client_name|opportunity_name)\}\}/.test(renderedText)) {
			throw new Error(`Response seed for ${documentType} still contains required placeholders`);
		}
		const wordCount = countWords(renderedText);
		if (wordCount < 100) {
			throw new Error(`Response seed for ${documentType} is too thin: ${wordCount} words`);
		}
		seededDocumentWordCounts[documentType] = wordCount;
	}

	const relevantSnippets = selectRelevantSnippets(opportunity, extractedPreview);
	if (relevantSnippets.length < 10) {
		throw new Error(`Too few relevant Datacraft snippets for live opportunity: ${relevantSnippets.length}`);
	}

	return {
		documentTypes: PROPOSAL_DOCUMENT_TYPES,
		totalSectionSeeds,
		relevantSnippetCount: relevantSnippets.length,
		relevantSnippetShortcuts: relevantSnippets.slice(0, 12).map((snippet) => snippet.shortcut),
		seededDocumentWordCounts,
	};
}

function selectRelevantSnippets(opportunity: OpportunityData, extractedPreview: string): DatacraftResponseSnippetInput[] {
	const opportunityText = `${opportunity.title} ${opportunity.projectSummary ?? ""} ${extractedPreview}`.toLowerCase();
	return DATACRAFT_RESPONSE_SNIPPETS.filter((snippet) => {
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

function flattenContent(content: DocumentContent): string {
	return flattenUnknown(content);
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

function renderPlaceholders(text: string, values: Record<string, string>): string {
	return Object.entries(values).reduce(
		(rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
		text
	);
}

function cleanExtractedText(text: string): string {
	return text
		.replace(/!\[Image]\(data:image\/[^)]+\)/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function compactText(text: string, maxLength: number): string {
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
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
			`response-snippets:${proof.responseReadiness?.relevantSnippetCount ?? 0}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe opportunity response readiness",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live UNGM software opportunity, source PDF extraction, and Datacraft response-package seed readiness were verified."
			: proof.error ?? "Live opportunity response readiness proof failed.",
	}], {
		title: "Platform Live Opportunity Response Readiness Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
