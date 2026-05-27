import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantContextMock = vi.hoisted(() => vi.fn());
const promptMock = vi.hoisted(() => vi.fn());
const getProviderManagerMock = vi.hoisted(() => vi.fn());
const getCompanyCapabilitiesMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onValues?: (value: unknown) => void;
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
	chain.values = vi.fn((value: unknown) => {
		config.onValues?.(value);
		return chain;
	});
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

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: requireTenantContextMock,
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

import {
	calculateFitScore,
	calculateFitScoreWithLLM,
	generateOpportunitySummary,
	getAIScoreHistory,
} from "@/lib/actions/opportunity-ai";

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
	requireTenantContextMock.mockResolvedValue({
		userId: "ai-user-1",
		organizationId: "org-ai-1",
	});
	getProviderManagerMock.mockReturnValue({
		initialize: vi.fn(async () => undefined),
		isAvailable: vi.fn(async () => false),
	});
	getCompanyCapabilitiesMock.mockResolvedValue({
		capabilities: ["GIS", "PostgreSQL", "API delivery"],
		differentiators: ["secure government delivery"],
		certifications: ["ISO 27001"],
	});
});

describe("opportunity AI row scoping", () => {
	it("scopes fit-score opportunity reads, inserts, and updates to the assigned tenant actor", async () => {
		let loadWhere: unknown;
		let insertValues: unknown;
		let updateWhere: unknown;

		dbMock.select.mockReturnValueOnce(createChain({
			result: [opportunity],
			onWhere: (value) => {
				loadWhere = value;
			},
		}));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [score],
			onValues: (value) => {
				insertValues = value;
			},
		}));
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
		expect(collectSqlFragments(loadWhere).join(" ")).toContain("organization_id");
		expect(insertValues).toMatchObject({ organizationId: "org-ai-1" });
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("assigned_to");
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("organization_id");
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

	it("uses heuristic fit factors when AI returns unusable factor objects", async () => {
		let insertValues: unknown;
		getProviderManagerMock.mockReturnValue({
			initialize: vi.fn(async () => undefined),
			isAvailable: vi.fn(async () => true),
			complete: vi.fn(async () => ({ content: JSON.stringify({ factors: [{}] }) })),
		});
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [score],
			onValues: (value) => {
				insertValues = value;
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain());

		const result = await calculateFitScore(opportunity.id);

		expect(result).toMatchObject({
			id: score.id,
			opportunityId: opportunity.id,
			scoreType: "fit",
		});
		expect(insertValues).toMatchObject({
			organizationId: "org-ai-1",
			scoreType: "fit",
			factors: expect.arrayContaining([
				expect.objectContaining({
					factor: "Budget Alignment",
					reasoning: expect.stringContaining("Budget"),
				}),
			]),
		});
		expect(JSON.stringify(insertValues)).not.toContain("\"factor\":{}");
	});

	it("generates a metadata-backed opportunity summary when AI is unavailable", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));

		const summary = await generateOpportunitySummary(opportunity.id);

		expect(summary).toContain("Secure Data Platform");
		expect(summary).toContain("Ministry of Data");
		expect(summary).toContain("Generated from available opportunity metadata");
		expect(summary).not.toContain("AI summary not available");
		expect(summary).not.toContain("Unable to generate summary");
		expect(promptMock).not.toHaveBeenCalled();
	});

	it("scopes AI score history and normalizes caller limits", async () => {
		let historyWhere: unknown;
		const historyChain = createChain({
			result: [],
			onWhere: (value) => {
				historyWhere = value;
			},
		});
		const unusedInitialChain = createChain({ result: [] });
		const typedHistoryChain = createChain({ result: [] });
		dbMock.select
			.mockReturnValueOnce(historyChain)
			.mockReturnValueOnce(unusedInitialChain)
			.mockReturnValueOnce(typedHistoryChain);

		await expect(getAIScoreHistory(opportunity.id, undefined, -20)).resolves.toEqual([]);
		await expect(getAIScoreHistory(opportunity.id, "fit", 2500)).resolves.toEqual([]);

		expect(historyChain.limit).toHaveBeenCalledWith(1);
		expect(typedHistoryChain.limit).toHaveBeenCalledWith(1000);
		expect(collectSqlFragments(historyWhere).join(" ")).toContain("assigned_to");
		expect(collectSqlFragments(historyWhere).join(" ")).toContain("organization_id");
	});
});
