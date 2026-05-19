import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "search-operator-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "search-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "search-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { evaluateSearchRagHealth } from "@/lib/actions/search-rag-health";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const freshSnippetEmbedding = {
	id: "snippet-embedding-1",
	snippetId: "snippet-1",
	embedding: [0.1, 0.2, 0.3],
	plainText: "Datacraft delivers evidence-led programme management and accountable governance.",
	modelVersion: "text-embedding-3-small",
	generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
};

const staleSnippetEmbedding = {
	...freshSnippetEmbedding,
	id: "snippet-embedding-2",
	snippetId: "snippet-2",
	plainText: "Legacy delivery statement",
	generatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const freshTemplateEmbedding = {
	id: "template-embedding-1",
	templateId: "template-1",
	embedding: [0.4, 0.5, 0.6],
	plainText: "Technical proposal template for implementation governance.",
	modelVersion: "text-embedding-3-small",
	generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "search-operator-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
});

describe("search/RAG health workflow", () => {
	it("marks the index healthy when embedding coverage, freshness, and sample retrieval pass", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [freshSnippetEmbedding] }))
			.mockReturnValueOnce(createChain({ result: [freshTemplateEmbedding] }));

		const result = await evaluateSearchRagHealth({
			sampleQuery: "evidence governance",
			staleAfterDays: 10,
			minSnippetEmbeddings: 1,
			minTemplateEmbeddings: 1,
		});

		expect(result).toMatchObject({
			indexScope: "content-library",
			status: "healthy",
			checkedBy: "search-operator-1",
			taskProjected: true,
		});
		expect(result.sampleResults[0]).toMatchObject({
			type: "snippet",
			subjectId: "snippet-1",
			matchedTerms: ["evidence", "governance"],
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "search_rag_health",
			subjectType: "search_rag_index",
			subjectId: "content-library",
			toState: "healthy",
			assignedRole: null,
			terminal: true,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "search-rag-health:content-library",
			state: "completed",
			priority: "low",
		}));
	});

	it("projects stale-index repair work when embeddings exceed the freshness window", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [freshSnippetEmbedding, staleSnippetEmbedding] }))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await evaluateSearchRagHealth({
			indexScope: "datacraft-snippets",
			sampleQuery: "programme management",
			staleAfterDays: 30,
			minSnippetEmbeddings: 1,
			assignedTo: "operator-2",
		});

		expect(result.status).toBe("stale");
		expect(result.repairActions).toContain("Refresh stale embeddings with the current embedding provider and model version.");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "stale",
			priority: "medium",
			assignedTo: "operator-2",
			assignedRole: "search_operator",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "search-rag-health:datacraft-snippets",
			state: "open",
			assignedTo: "operator-2",
		}));
	});

	it("reports an empty index as critical repair work", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await evaluateSearchRagHealth({
			sampleQuery: "delivery governance",
			minSnippetEmbeddings: 1,
		});

		expect(result.status).toBe("empty");
		expect(result.diagnostics).toContain("Snippet embedding coverage is below the configured minimum.");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "empty",
			priority: "critical",
			assignedRole: "search_operator",
		}));
	});

	it("reports degraded retrieval when sample query returns no embedded content", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [freshSnippetEmbedding] }))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await evaluateSearchRagHealth({
			sampleQuery: "unrelated hydroelectric telemetry",
			minSnippetEmbeddings: 1,
		});

		expect(result.status).toBe("degraded");
		expect(result.sampleResults).toHaveLength(0);
		expect(result.repairActions).toContain("Inspect tokenization and indexing coverage for the sample query.");
	});
});
