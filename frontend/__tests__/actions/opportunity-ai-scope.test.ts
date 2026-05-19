import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const promptMock = vi.hoisted(() => vi.fn());
const getProviderManagerMock = vi.hoisted(() => vi.fn());
const getCompanyCapabilitiesMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "groupBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.values = vi.fn(() => chain);
	chain.set = vi.fn(() => chain);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/lib/ai/providers", () => ({
	prompt: promptMock,
	getProviderManager: getProviderManagerMock,
}));

vi.mock("@/lib/actions/company-settings", () => ({
	getCompanyCapabilities: getCompanyCapabilitiesMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import { calculateFitScore, calculateFitScoreWithLLM } from "@/lib/actions/opportunity-ai";

const opportunity = {
	id: "11111111-1111-4111-8111-111111111111",
	title: "Secure Data Platform",
	organization: "Ministry of Data",
	budgetNumeric: 150000,
	daysLeft: 42,
	category: "GIS",
	sector: "Government",
	countryRegion: "Kenya",
	projectSummary: "Build a secure data platform.",
	keyRequirements: "PostgreSQL, APIs, and GIS dashboards.",
	technicalRequirements: "PostgreSQL APIs GIS",
	submissionRequirements: "Email submission",
	assignedTo: "ai-user-1",
};

const score = {
	id: "22222222-2222-4222-8222-222222222222",
	opportunityId: opportunity.id,
	scoreType: "fit",
	score: 82,
	factors: [],
	modelVersion: "v1.0-heuristic",
	reasoning: "Good fit",
	createdAt: new Date("2026-05-19T12:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("ai-user-1");
	getProviderManagerMock.mockReturnValue({
		initialize: vi.fn(async () => undefined),
		isAvailable: vi.fn(async () => false),
	});
});

describe("opportunity AI row scoping", () => {
	it("scopes fit-score opportunity reads and updates to the assigned actor", async () => {
		let loadWhere: unknown;
		let updateWhere: unknown;

		dbMock.select.mockReturnValueOnce(createChain({
			result: [opportunity],
			onWhere: (value) => {
				loadWhere = value;
			},
		}));
		dbMock.insert.mockReturnValueOnce(createChain({ result: [score] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await calculateFitScore(opportunity.id);

		expect(result).toMatchObject({
			id: score.id,
			opportunityId: opportunity.id,
			scoreType: "fit",
		});
		expect(collectSqlFragments(loadWhere).join(" ")).toContain("assigned_to");
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("assigned_to");
	});

	it("awaits provider availability before falling back from LLM scoring", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));
		dbMock.insert.mockReturnValueOnce(createChain({ result: [score] }));
		dbMock.update.mockReturnValueOnce(createChain());

		const result = await calculateFitScoreWithLLM(opportunity.id);

		expect(result).toMatchObject({
			id: score.id,
			opportunityId: opportunity.id,
			scoreType: "fit",
		});
		expect(promptMock).not.toHaveBeenCalled();
		expect(getCompanyCapabilitiesMock).not.toHaveBeenCalled();
	});
});
