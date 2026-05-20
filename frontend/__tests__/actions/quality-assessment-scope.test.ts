import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const compareAssessmentsMock = vi.hoisted(() => vi.fn());

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
	expect(sqlText).toContain("scope-user-1");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/ai/quality-assessment", () => ({
	runQualityAssessment: vi.fn(),
	compareAssessments: compareAssessmentsMock,
	generateSummaryReport: vi.fn(),
	getPriorityCounts: vi.fn(),
	getScoreLevel: vi.fn(),
	getScoreColor: vi.fn(),
	getScoreBgColor: vi.fn(),
	QUALITY_FACTORS: [],
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn() },
}));

import {
	compareQualityAssessments,
	deleteQualityAssessment,
	getQualityAssessment,
	getQualityAssessmentHistory,
	triggerQualityAssessment,
} from "@/lib/actions/quality-assessment";

const documentId = "11111111-1111-4111-8111-111111111111";
const assessmentId = "22222222-2222-4222-8222-222222222222";
const assessmentRow = {
	id: assessmentId,
	documentId,
	versionId: null,
	overallScore: 84,
	scoreLevel: "good",
	categoryScores: [],
	factors: [],
	issues: [],
	suggestions: [],
	summary: {
		wordCount: 100,
		paragraphCount: 4,
		readabilityGrade: 10,
		activeVoicePercentage: 80,
	},
	assessedAt: new Date("2026-05-19T12:00:00.000Z"),
	modelVersion: "test-v1",
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("scope-user-1");
	compareAssessmentsMock.mockReturnValue({
		scoreDelta: 0,
		improvedFactors: [],
		declinedFactors: [],
		newIssues: [],
		resolvedIssues: [],
	});
});

describe("quality assessment document scoping", () => {
	it("scopes quality assessment document reads through readable documents", async () => {
		const wheres: unknown[] = [];
		const triggerChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		const latestAssessmentChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		const historyChain = createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		});
		dbMock.select
			.mockReturnValueOnce(triggerChain)
			.mockReturnValueOnce(latestAssessmentChain)
			.mockReturnValueOnce(historyChain);

		await expect(triggerQualityAssessment(documentId)).resolves.toMatchObject({
			success: false,
			error: "Document not found",
		});
		await expect(getQualityAssessment(documentId)).resolves.toMatchObject({ success: false });
		await expect(getQualityAssessmentHistory(documentId, -25)).resolves.toMatchObject({ success: true });

		expect(historyChain.limit).toHaveBeenCalledWith(1);
		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expectDocumentScope(where);
		}
	});

	it("scopes explicit previous assessment comparisons to the same readable document", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [assessmentRow],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		await expect(compareQualityAssessments(documentId, assessmentId)).resolves.toMatchObject({
			success: true,
		});

		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectDocumentScope(where);
		}
		expect(collectSqlFragments(wheres[1]).join(" ")).toContain("document_id");
	});

	it("scopes quality assessment deletes through writable documents", async () => {
		let deleteWhere: unknown;
		dbMock.delete.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				deleteWhere = value;
			},
		}));

		await expect(deleteQualityAssessment(assessmentId)).resolves.toMatchObject({
			success: false,
			error: "Assessment not found",
		});

		expectDocumentScope(deleteWhere);
	});
});
