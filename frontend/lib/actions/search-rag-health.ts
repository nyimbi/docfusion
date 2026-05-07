"use server";

import { db } from "@/lib/db";
import {
	snippetEmbeddings,
	templateEmbeddings,
} from "@/lib/db/schema-content-library";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

type SnippetEmbeddingRow = typeof snippetEmbeddings.$inferSelect;
type TemplateEmbeddingRow = typeof templateEmbeddings.$inferSelect;

export type SearchRagHealthStatus = "healthy" | "degraded" | "stale" | "empty";

export interface SearchRagHealthInput {
	indexScope?: string;
	sampleQuery?: string;
	staleAfterDays?: number;
	minSnippetEmbeddings?: number;
	minTemplateEmbeddings?: number;
	maxRows?: number;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface SearchRagHealthMetric {
	name: string;
	value: number | string | boolean | null;
	status: "pass" | "warn" | "fail";
}

export interface SearchRagHealthResult {
	indexScope: string;
	status: SearchRagHealthStatus;
	checkedAt: string;
	checkedBy: string;
	metrics: SearchRagHealthMetric[];
	diagnostics: string[];
	repairActions: string[];
	sampleResults: Array<{
		type: "snippet" | "template";
		subjectId: string;
		modelVersion: string;
		generatedAt: string;
		matchedTerms: string[];
	}>;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const WORKFLOW_KEY = "search_rag_health";
const SUBJECT_TYPE = "search_rag_index";

export async function evaluateSearchRagHealth(
	input: SearchRagHealthInput = {}
): Promise<SearchRagHealthResult> {
	const userContext = await requireUserContext();
	const checkedAt = new Date();
	const indexScope = input.indexScope?.trim() || "content-library";
	const staleAfterDays = input.staleAfterDays ?? 30;
	const maxRows = input.maxRows ?? 500;
	const minSnippetEmbeddings = input.minSnippetEmbeddings ?? 1;
	const minTemplateEmbeddings = input.minTemplateEmbeddings ?? 0;

	const [snippetRows, templateRows] = await Promise.all([
		db.select().from(snippetEmbeddings).limit(maxRows),
		db.select().from(templateEmbeddings).limit(maxRows),
	]);

	const assessment = assessSearchRagHealth({
		snippetRows,
		templateRows,
		checkedAt,
		staleAfterDays,
		minSnippetEmbeddings,
		minTemplateEmbeddings,
		sampleQuery: input.sampleQuery,
	});

	const terminal = assessment.status === "healthy";
	const priority = priorityForStatus(assessment.status);
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: indexScope,
		fromState: "unknown",
		toState: assessment.status,
		eventType: "search_rag_health_evaluated",
		actorId: userContext.userId,
		reason: assessment.diagnostics.join(" ") || "Search/RAG health evaluated",
		priority,
		assignedTo: terminal ? null : input.assignedTo ?? null,
		assignedRole: terminal ? null : "search_operator",
		dueAt: terminal ? null : normalizeDueAt(input.dueAt, 1),
		metadata: {
			indexScope,
			checkedAt: checkedAt.toISOString(),
			metrics: assessment.metrics,
			diagnostics: assessment.diagnostics,
			repairActions: assessment.repairActions,
			sampleQuery: input.sampleQuery ?? null,
			sampleResultCount: assessment.sampleResults.length,
		},
		terminal,
		actionUrl: "/content-library",
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `search-rag-health:${indexScope}`,
		title: terminal ? "Search/RAG index health verified" : "Repair Search/RAG index health",
		description: assessment.diagnostics.join(" ") || "Search/RAG index is healthy.",
		state: terminal ? "completed" : "open",
		priority,
		assignedTo: terminal ? null : input.assignedTo ?? null,
		assignedRole: terminal ? null : "search_operator",
		dueAt: terminal ? null : normalizeDueAt(input.dueAt, 1),
		metadata: {
			indexScope,
			status: assessment.status,
			repairActions: assessment.repairActions,
			sampleResults: assessment.sampleResults,
		},
	});

	return {
		indexScope,
		status: assessment.status,
		checkedAt: checkedAt.toISOString(),
		checkedBy: userContext.userId,
		metrics: assessment.metrics,
		diagnostics: assessment.diagnostics,
		repairActions: assessment.repairActions,
		sampleResults: assessment.sampleResults,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

function assessSearchRagHealth(input: {
	snippetRows: SnippetEmbeddingRow[];
	templateRows: TemplateEmbeddingRow[];
	checkedAt: Date;
	staleAfterDays: number;
	minSnippetEmbeddings: number;
	minTemplateEmbeddings: number;
	sampleQuery?: string;
}): {
	status: SearchRagHealthStatus;
	metrics: SearchRagHealthMetric[];
	diagnostics: string[];
	repairActions: string[];
	sampleResults: SearchRagHealthResult["sampleResults"];
} {
	const staleBefore = new Date(input.checkedAt);
	staleBefore.setUTCDate(staleBefore.getUTCDate() - input.staleAfterDays);
	const staleSnippetCount = input.snippetRows.filter((row) => row.generatedAt < staleBefore).length;
	const staleTemplateCount = input.templateRows.filter((row) => row.generatedAt < staleBefore).length;
	const sampleResults = sampleSearch(input.snippetRows, input.templateRows, input.sampleQuery);
	const metrics: SearchRagHealthMetric[] = [
		{
			name: "snippet_embedding_count",
			value: input.snippetRows.length,
			status: input.snippetRows.length >= input.minSnippetEmbeddings ? "pass" : "fail",
		},
		{
			name: "template_embedding_count",
			value: input.templateRows.length,
			status: input.templateRows.length >= input.minTemplateEmbeddings ? "pass" : "fail",
		},
		{
			name: "stale_embedding_count",
			value: staleSnippetCount + staleTemplateCount,
			status: staleSnippetCount + staleTemplateCount === 0 ? "pass" : "warn",
		},
		{
			name: "sample_query_result_count",
			value: input.sampleQuery ? sampleResults.length : null,
			status: !input.sampleQuery || sampleResults.length > 0 ? "pass" : "fail",
		},
		{
			name: "acl_filtering_model",
			value: "content-library metadata scope",
			status: "warn",
		},
	];
	const diagnostics: string[] = [];
	const repairActions: string[] = [];

	if (input.snippetRows.length < input.minSnippetEmbeddings) {
		diagnostics.push("Snippet embedding coverage is below the configured minimum.");
		repairActions.push("Generate or repair snippet embeddings for approved reusable content.");
	}
	if (input.templateRows.length < input.minTemplateEmbeddings) {
		diagnostics.push("Template embedding coverage is below the configured minimum.");
		repairActions.push("Generate or repair template embeddings for active templates.");
	}
	if (staleSnippetCount + staleTemplateCount > 0) {
		diagnostics.push(`${staleSnippetCount + staleTemplateCount} embedding records are stale.`);
		repairActions.push("Refresh stale embeddings with the current embedding provider and model version.");
	}
	if (input.sampleQuery && sampleResults.length === 0) {
		diagnostics.push("Sample retrieval returned no matching embedded content.");
		repairActions.push("Inspect tokenization and indexing coverage for the sample query.");
	}
	diagnostics.push("ACL filtering is limited by current embedding rows and must be enforced by joined content metadata in browser/API retrieval paths.");

	const hardFailures = metrics.some((metric) => metric.status === "fail");
	const stale = staleSnippetCount + staleTemplateCount > 0;
	const status: SearchRagHealthStatus = hardFailures
		? input.snippetRows.length === 0 && input.templateRows.length === 0
			? "empty"
			: "degraded"
		: stale
			? "stale"
			: "healthy";

	return {
		status,
		metrics,
		diagnostics,
		repairActions,
		sampleResults,
	};
}

function sampleSearch(
	snippetRows: SnippetEmbeddingRow[],
	templateRows: TemplateEmbeddingRow[],
	query?: string
): SearchRagHealthResult["sampleResults"] {
	const terms = tokenize(query);
	if (!terms.length) return [];
	const snippetResults = snippetRows.map((row) => ({
		type: "snippet" as const,
		subjectId: row.snippetId,
		modelVersion: row.modelVersion,
		generatedAt: row.generatedAt.toISOString(),
		matchedTerms: matchedTerms(row.plainText, terms),
	}));
	const templateResults = templateRows.map((row) => ({
		type: "template" as const,
		subjectId: row.templateId,
		modelVersion: row.modelVersion,
		generatedAt: row.generatedAt.toISOString(),
		matchedTerms: matchedTerms(row.plainText, terms),
	}));
	return [...snippetResults, ...templateResults]
		.filter((result) => result.matchedTerms.length > 0)
		.sort((a, b) => b.matchedTerms.length - a.matchedTerms.length)
		.slice(0, 5);
}

function tokenize(query?: string): string[] {
	return Array.from(new Set((query ?? "")
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.map((term) => term.trim())
		.filter((term) => term.length >= 3)));
}

function matchedTerms(value: string, terms: string[]): string[] {
	const lower = value.toLowerCase();
	return terms.filter((term) => lower.includes(term));
}

function priorityForStatus(status: SearchRagHealthStatus): "critical" | "high" | "medium" | "low" {
	switch (status) {
		case "empty":
			return "critical";
		case "degraded":
			return "high";
		case "stale":
			return "medium";
		case "healthy":
			return "low";
	}
}

function normalizeDueAt(value: Date | string | null | undefined, defaultDays: number): Date {
	if (value) {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			throw new Error("Due date is invalid");
		}
		return parsed;
	}
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + defaultDays);
	return date;
}
