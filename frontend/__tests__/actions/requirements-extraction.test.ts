import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantContextMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn());
const providerManagerMock = vi.hoisted(() => ({
	initialize: vi.fn(),
	isAvailable: vi.fn(),
	complete: completeMock,
}));

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: requireTenantContextMock,
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(),
	userHasAuthorityRole: vi.fn(() => false),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		organizationId: "opportunities.organizationId",
		assignedTo: "opportunities.assignedTo",
	},
}));

vi.mock("@/lib/db/schema-rfp", () => ({
	rfpRequirements: {
		id: "rfpRequirements.id",
		opportunityId: "rfpRequirements.opportunityId",
		organizationId: "rfpRequirements.organizationId",
	},
}));

vi.mock("@/lib/db/schema-tasks", () => ({
	proposalTasks: {
		id: "proposalTasks.id",
		opportunityId: "proposalTasks.opportunityId",
		organizationId: "proposalTasks.organizationId",
		requirementId: "proposalTasks.requirementId",
		sourceType: "proposalTasks.sourceType",
	},
	taskActivity: {},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
	and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
	or: vi.fn((...conditions: unknown[]) => ({ op: "or", conditions })),
	ilike: vi.fn(),
	inArray: vi.fn(),
	isNull: vi.fn((column: unknown) => ({ op: "isNull", column })),
	isNotNull: vi.fn(),
	lt: vi.fn(),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values })),
	desc: vi.fn(),
	asc: vi.fn(),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
	upsertWorkflowRuntimeTask: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => providerManagerMock),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { extractRequirements } from "@/lib/actions/requirements";

beforeEach(() => {
	vi.clearAllMocks();
	requireTenantContextMock.mockResolvedValue({
		userId: "requirements-user-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReturnValue(createChain({ result: [{ id: "opp-1" }] }));
	providerManagerMock.initialize.mockResolvedValue(undefined);
	providerManagerMock.isAvailable.mockResolvedValue(true);
});

describe("requirement extraction fallbacks", () => {
	it("falls back to heuristic extraction when AI returns unusable requirement objects", async () => {
		completeMock.mockResolvedValue({
			content: JSON.stringify({
				requirements: [{}],
				documentInfo: { title: "   ", organization: "", deadline: null },
				confidence: 0.99,
			}),
		});

		const result = await extractRequirements(
			"opp-1",
			"Section L. The contractor shall provide staffing and submit a transition plan within 10 days."
		);

		expect(result.requirements.length).toBeGreaterThan(0);
		expect(result.requirements[0]).toEqual(expect.objectContaining({
			text: expect.stringContaining("contractor shall provide staffing"),
			priority: "mandatory",
		}));
		expect(result.confidence).toBeLessThan(0.99);
	});
});
