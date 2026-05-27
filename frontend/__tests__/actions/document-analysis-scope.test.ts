import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const getProviderManagerMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.values = vi.fn(() => chain);
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectDocumentScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("documents.owner_id");
	expect(sqlText).toContain("analysis-user-1");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: getProviderManagerMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import {
	analyzeDocument,
	deleteAnalysis,
	getAnalysis,
	getAnalysisHistory,
} from "@/lib/actions/document-analysis";

const documentId = "11111111-1111-4111-8111-111111111111";
const proposalDocumentId = "22222222-2222-4222-8222-222222222222";
const analysisId = "33333333-3333-4333-8333-333333333333";
const documentRow = {
	id: documentId,
	content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Draft text" }] }] },
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("analysis-user-1");
	getProviderManagerMock.mockReturnValue({
		initialize: vi.fn(async () => undefined),
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(),
	});
});

describe("document analysis document scoping", () => {
	it("scopes proposal-linked analysis through writable documents before inserting", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [documentRow],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		await expect(analyzeDocument({ documentId, proposalDocumentId })).rejects.toThrow(
			"Proposal document not found"
		);

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectDocumentScope(where);
		}
	});

	it("scopes analysis reads and history through readable documents", async () => {
		const wheres: unknown[] = [];
		const latestAnalysisChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		const historyChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		dbMock.select
			.mockReturnValueOnce(latestAnalysisChain)
			.mockReturnValueOnce(historyChain);

		await expect(getAnalysis(documentId)).resolves.toBeNull();
		await expect(getAnalysisHistory(documentId, -25)).resolves.toEqual([]);

		expect(historyChain.limit).toHaveBeenCalledWith(1);
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectDocumentScope(where);
		}
	});

	it("scopes analysis deletes through writable documents", async () => {
		let deleteWhere: unknown;
		dbMock.delete.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				deleteWhere = value;
			},
		}));

		await expect(deleteAnalysis(analysisId)).resolves.toBe(false);

		expectDocumentScope(deleteWhere);
	});

	it("records explicit deterministic fallback findings when AI analysis is unavailable", async () => {
		const savedAt = new Date("2026-05-27T08:00:00.000Z");
		const richDocumentRow = {
			id: documentId,
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{
							type: "text",
							text: "Datacraft will deliver the required analytics platform with 35% faster reporting. Therefore the proposal includes evidence [1] and Source: https://example.com.",
						}],
					},
					{
						type: "paragraph",
						content: [{
							type: "text",
							text: "The implementation includes governance, migration, integration, risk controls, and clear acceptance criteria for the committee.",
						}],
					},
					{
						type: "paragraph",
						content: [{
							type: "text",
							text: "Finally, the team will provide training and operational handover within 6 weeks.",
						}],
					},
				],
			},
		};
		const documentAnalysisInsert = createChain({ result: [{ id: analysisId, analyzedAt: savedAt }] });
		const paragraphInsert = createChain();
		dbMock.select.mockReturnValueOnce(createChain({ result: [richDocumentRow] }));
		dbMock.insert
			.mockReturnValueOnce(documentAnalysisInsert)
			.mockReturnValueOnce(paragraphInsert);

		const result = await analyzeDocument({
			documentId,
			categories: ["technical"],
			includeParagraphs: false,
		});

		expect(result.factors).toHaveLength(8);
		expect(result.factors.every((factor) => factor.score !== 75)).toBe(true);
		expect(result.factors.every((factor) =>
			factor.issues.some((issue) => issue.message.includes("deterministic fallback scoring because AI provider unavailable"))
		)).toBe(true);
		expect(result.suggestions.some((suggestion) =>
			suggestion.text.includes("Add a dedicated heuristic or reliable AI analysis path")
		)).toBe(true);
	});
});
