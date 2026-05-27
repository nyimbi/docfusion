/**
 * Competitive Intelligence & Discriminator Engine Server Actions Tests
 *
 * Tests for competitive analysis server actions including:
 * - Competitor CRUD operations
 * - Discriminator CRUD and effectiveness tracking
 * - Ghost theme creation and fallback language generation
 * - Competitor-opportunity linking
 * - Zod validation for all create schemas
 * - Edge cases: empty fields, duplicate links, not-found records
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const requireUserContextMock = vi.hoisted(() => vi.fn());
const testOrganizationId = "11111111-1111-1111-1111-111111111111";

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		initialize: vi.fn(),
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(async () => ({ content: "AI response" })),
	})),
}));

// ---------------------------------------------------------------------------
// Chainable query builder mock
// ---------------------------------------------------------------------------

function createChainableQuery(returnValue: unknown = []) {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select", "insert", "update", "delete", "from", "where", "set",
		"values", "returning", "orderBy", "limit", "offset", "execute",
		"leftJoin", "innerJoin",
	];
	for (const m of methods) {
		chain[m] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(
		Array.isArray(returnValue) ? returnValue : [returnValue]
	);
	(chain.execute as ReturnType<typeof vi.fn>).mockResolvedValue(returnValue);
	(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
		Promise.resolve(Array.isArray(returnValue) ? returnValue : [returnValue]).then(resolve);
	return chain;
}

var dbMock: ReturnType<typeof createDbMock>;

function createDbMock() {
	return {
		select: vi.fn(() => createChainableQuery([])),
		insert: vi.fn(() => createChainableQuery([])),
		update: vi.fn(() => createChainableQuery([])),
		delete: vi.fn(() => createChainableQuery([])),
		execute: vi.fn(async () => []),
		transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
			const txMock = {
				update: vi.fn(() => createChainableQuery()),
				select: vi.fn(() => createChainableQuery()),
				insert: vi.fn(() => createChainableQuery()),
				delete: vi.fn(() => createChainableQuery()),
			};
			return fn(txMock);
		}),
	};
}

vi.mock("@/lib/db", () => {
	dbMock = createDbMock();
	return { db: dbMock };
});

vi.mock("@/lib/db/schema-competitors", () => ({
	competitors: {
		id: "c.id", name: "c.name", organizationId: "c.orgId", description: "c.desc",
		competitorType: "c.type", sizeStandard: "c.size", capabilities: "c.caps",
		certifications: "c.certs", contractVehicles: "c.vehicles", naicsCodes: "c.naics",
		externalId: "c.externalId", winsAgainstUs: "c.winsAgainstUs", lossesToUs: "c.lossesToUs",
	},
	discriminators: {
		id: "d.id", statement: "d.stmt", discriminatorType: "d.type", isActive: "d.active",
		effectiveAgainst: "d.against", effectivenessScore: "d.score", useCount: "d.useCount",
		winCount: "d.winCount", organizationId: "d.orgId",
	},
	ghostThemes: {
		id: "g.id", competitorId: "g.compId", useCount: "g.useCount",
		organizationId: "g.orgId",
	},
	competitorOpportunities: {
		id: "co.id", competitorId: "co.compId", opportunityId: "co.oppId",
		outcome: "co.outcome",
	},
	competitiveAnalyses: {
		id: "ca.id", opportunityId: "ca.oppId", analyzedAt: "ca.analyzedAt",
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "o.id", title: "o.title", category: "o.cat", organization: "o.org",
		countryRegion: "o.region", metadata: "o.meta", budgetValue: "o.budget",
		keyRequirements: "o.reqs", assignedTo: "o.assignedTo", organizationId: "o.orgId",
	},
	partners: { id: "p.id", status: "p.status" },
	companySettings: { id: "cs.id", organizationId: "cs.orgId" },
}));

// Import subjects under test
import {
	createCompetitor,
	updateCompetitor,
	deleteCompetitor,
	getCompetitor,
	listCompetitors,
	searchCompetitors,
	createDiscriminator,
	updateDiscriminator,
	deleteDiscriminator,
	listDiscriminators,
	recordDiscriminatorUsage,
	createGhostTheme,
	listGhostThemes,
	addCompetitorToOpportunity,
	updateCompetitorOpportunity,
	identifyLikelyCompetitors,
	listCompetitorsForOpportunity,
	generateSWOT,
	suggestDiscriminators,
	suggestTeamingPartners,
	generateCompetitiveMatrix,
	getLatestCompetitiveAnalysis,
	trackCompetitorWinLoss,
	getWinLossAnalysis,
	recordGhostThemeUsage,
	getCompetitorIntelligenceSummary,
	importCompetitorFromCI,
	bulkImportCompetitiveIntelligence,
} from "@/lib/actions/competitive";

// ============================================================================
// Helpers
// ============================================================================

function makeCompetitor(overrides: Record<string, unknown> = {}) {
	return {
		id: "comp-001",
		name: "Acme Corp",
		legalName: "Acme Corporation LLC",
		website: "https://acme.com",
		description: "A major government contractor",
		logoUrl: null,
		competitorType: "prime",
		sizeStandard: "large",
		capabilities: [{ area: "IT", strength: "strong", notes: "" }],
		certifications: ["ISO 27001"],
		contractVehicles: ["GSA MAS"],
		naicsCodes: ["541511"],
		strengths: ["Strong past performance"],
		weaknesses: ["High pricing"],
		knownPartners: [],
		pricingTendency: "premium",
		laborRateComparison: "above_market",
		researchNotes: null,
		organizationId: null,
		winCount: 5,
		lossCount: 2,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeDiscriminator(overrides: Record<string, unknown> = {}) {
	return {
		id: "disc-001",
		statement: "Our team has 15 years of continuous experience with this agency",
		shortVersion: "15 years agency experience",
		proofPoints: ["Contract ABC", "Contract DEF"],
		discriminatorType: "experience",
		category: "team",
		supportingEvidence: [],
		effectiveAgainst: ["Acme Corp"],
		applicableOpportunityTypes: [],
		applicableNaicsCodes: [],
		organizationId: null,
		isActive: true,
		useCount: 3,
		winCount: 2,
		effectivenessScore: 66.67,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeOpportunity(overrides: Record<string, unknown> = {}) {
	return {
		id: "00000000-0000-4000-8000-000000000002",
		title: "GIS modernization",
		category: "IT",
		organization: "Agency",
		countryRegion: "Kenya",
		budgetValue: "$1M",
		budgetNumeric: 1000000,
		daysLeft: 30,
		keyRequirements: "Implementation support",
		technicalRequirements: "Cloud GIS",
		metadata: { contractVehicle: "GSA" },
		assignedTo: "competitive-user-1",
		...overrides,
	};
}

function makeCompetitiveIntelligenceRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 101,
		companyName: "Acme Corp",
		country: "Kenya",
		city: "Nairobi",
		foundedYear: 2015,
		companyAge: 11,
		companyType: "Software Development Agency",
		primaryBusiness: "Digital services",
		specialization: "Cloud GIS",
		website: "https://acme.example",
		linkedIn: null,
		email: null,
		phone: null,
		physicalAddress: null,
		ceoFounder: null,
		ctoTechLead: null,
		keyManagement: null,
		managementLinkedin: null,
		teamSize: "50-100",
		engineerCount: "20-50",
		keyEngineers: null,
		notableAlumni: null,
		annualRevenue: null,
		revenueRange: null,
		fundingRaised: null,
		investors: null,
		productsServices: "Software delivery",
		technologyStack: "React; Node.js",
		industriesServed: "Government",
		notableClients: null,
		recentContracts: null,
		contractValues: null,
		pursuingOpportunities: null,
		partnerships: null,
		certifications: "ISO 27001",
		awards: null,
		newsMentions: null,
		recentNews: null,
		socialMediaPresence: null,
		competitivePositioning: "Challenger",
		strengths: "Delivery",
		weaknesses: "Pricing",
		marketShare: null,
		growthTrajectory: null,
		threatLevel: "MEDIUM",
		strategicNotes: null,
		lastUpdated: "2026-02-02",
		...overrides,
	};
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
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
}

function expectAssignedOpportunityTenantScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain(testOrganizationId);
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "competitive-user-1",
		organizationId: testOrganizationId,
	});
	dbMock.select.mockImplementation(() => createChainableQuery([]));
	dbMock.insert.mockImplementation(() => createChainableQuery([]));
	dbMock.update.mockImplementation(() => createChainableQuery([]));
	dbMock.delete.mockImplementation(() => createChainableQuery([]));
});

// ---------------------------------------------------------------------------
// Competitor CRUD
// ---------------------------------------------------------------------------

describe("Competitor CRUD", () => {
	describe("createCompetitor", () => {
		test("creates competitor with valid input", async () => {
			const comp = makeCompetitor();
			dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

			const result = await createCompetitor({
				name: "Acme Corp",
				website: "https://acme.com",
				competitorType: "prime",
				sizeStandard: "large",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe("Acme Corp");
			}
		});

		test("rejects empty name", async () => {
			const result = await createCompetitor({
				name: "",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Name is required");
			}
		});

		test("rejects name over 500 chars", async () => {
			const result = await createCompetitor({
				name: "X".repeat(501),
			});
			expect(result.success).toBe(false);
		});

		test("rejects invalid website URL", async () => {
			const result = await createCompetitor({
				name: "Valid Name",
				website: "not-a-url",
			});
			expect(result.success).toBe(false);
		});

		test("accepts empty string for website (optional)", async () => {
			const comp = makeCompetitor({ website: "" });
			dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

			const result = await createCompetitor({
				name: "Valid Name",
				website: "",
			});
			expect(result.success).toBe(true);
		});

		test("rejects invalid competitor type", async () => {
			const result = await createCompetitor({
				name: "Valid Name",
				competitorType: "invalid" as never,
			});
			expect(result.success).toBe(false);
		});

		test("accepts all valid competitor types", async () => {
			for (const type of ["prime", "sub", "both"] as const) {
				const comp = makeCompetitor({ competitorType: type });
				dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

				const result = await createCompetitor({ name: `Test ${type}`, competitorType: type });
				expect(result.success).toBe(true);
			}
		});

		test("accepts all valid size standards", async () => {
			for (const size of ["small", "large", "8a", "hubzone", "sdvosb", "wosb"] as const) {
				const comp = makeCompetitor({ sizeStandard: size });
				dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

				const result = await createCompetitor({ name: `Test ${size}`, sizeStandard: size });
				expect(result.success).toBe(true);
			}
		});

		test("accepts capabilities array", async () => {
			const comp = makeCompetitor();
			dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

			const result = await createCompetitor({
				name: "With Caps",
				capabilities: [
					{ area: "Cloud", strength: "strong" },
					{ area: "AI", strength: "moderate", notes: "Growing capability" },
				],
			});
			expect(result.success).toBe(true);
		});

		test("rejects invalid capability strength", async () => {
			const result = await createCompetitor({
				name: "Bad Caps",
				capabilities: [{ area: "Test", strength: "invalid" as never }],
			});
			expect(result.success).toBe(false);
		});

		test("rejects spoofed organization ID before insert", async () => {
			const result = await createCompetitor({
				name: "Spoofed Org",
				organizationId: "22222222-2222-2222-2222-222222222222",
			});

			expect(result.success).toBe(false);
			expect(dbMock.insert).not.toHaveBeenCalled();
		});
	});

	describe("updateCompetitor", () => {
		test("updates existing competitor", async () => {
			const existing = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([existing]));
			const updated = makeCompetitor({ name: "Acme Corp Updated" });
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateCompetitor("comp-001", { name: "Acme Corp Updated" });
			expect(result.success).toBe(true);
		});

		test("returns not found for missing competitor", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await updateCompetitor("nonexistent", { name: "Update" });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});

	describe("deleteCompetitor", () => {
		test("deletes existing competitor", async () => {
			const comp = makeCompetitor();
			dbMock.delete.mockImplementation(() => createChainableQuery([comp]));

			const result = await deleteCompetitor("comp-001");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.deleted).toBe(true);
			}
		});

		test("returns not found for missing competitor", async () => {
			dbMock.delete.mockImplementation(() => createChainableQuery([]));

			const result = await deleteCompetitor("nonexistent");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});

	describe("getCompetitor", () => {
		test("returns competitor when found", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));

			const result = await getCompetitor("comp-001");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe("Acme Corp");
			}
		});

		test("returns not found for missing competitor", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await getCompetitor("nonexistent");
			expect(result.success).toBe(false);
		});
	});

	describe("listCompetitors", () => {
		test("returns all competitors when no org filter", async () => {
			const comps = [makeCompetitor(), makeCompetitor({ id: "comp-002", name: "Beta Inc" })];
			dbMock.select.mockImplementation(() => createChainableQuery(comps));

			const result = await listCompetitors();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(2);
			}
		});

		test("filters by organization ID when provided", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));

			const result = await listCompetitors(testOrganizationId);
			expect(result.success).toBe(true);
		});

		test("rejects spoofed organization filter before querying", async () => {
			const result = await listCompetitors("22222222-2222-2222-2222-222222222222");

			expect(result.success).toBe(false);
			expect(dbMock.select).not.toHaveBeenCalled();
		});

		test("returns empty array when no competitors exist", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await listCompetitors();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(0);
			}
		});
	});

	describe("searchCompetitors", () => {
		test("returns matching competitors for text query", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));

			const result = await searchCompetitors("Acme");
			expect(result.success).toBe(true);
		});

		test("applies type filter", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));

			const result = await searchCompetitors("", { competitorType: "prime" });
			expect(result.success).toBe(true);
		});

		test("applies size standard filter", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));

			const result = await searchCompetitors("", { sizeStandard: "large" });
			expect(result.success).toBe(true);
		});

		test("returns empty for no matches", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await searchCompetitors("NonexistentCompany");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(0);
			}
		});
	});
});

describe("Competitive analysis auth", () => {
	test("rejects SWOT generation before database access when unauthenticated", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await generateSWOT("opp-1");

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("scopes likely competitor opportunity and link reads to assigned opportunities", async () => {
		let opportunityWhere: unknown;
		let linkWhere: unknown;
		const opportunityChain = createChainableQuery([makeOpportunity()]);
		(opportunityChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			opportunityWhere = value;
			return opportunityChain;
		});
		const linksChain = createChainableQuery([]);
		(linksChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			linkWhere = value;
			return linksChain;
		});

		dbMock.select
			.mockImplementationOnce(() => opportunityChain)
			.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ contractVehicles: ["GSA"] })]))
			.mockImplementationOnce(() => linksChain);

		const result = await identifyLikelyCompetitors("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		const opportunitySql = collectSqlFragments(opportunityWhere).join(" ");
		expect(opportunitySql).toContain("o.assignedTo");
		expect(opportunitySql).toContain("o.orgId");
		expect(opportunitySql).toContain(testOrganizationId);
		expectAssignedOpportunityTenantScope(linkWhere);
	});

	test("scopes competitor opportunity lists to assigned opportunities", async () => {
		let where: unknown;
		const chain = createChainableQuery([]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await listCompetitorsForOpportunity("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		expectAssignedOpportunityTenantScope(where);
	});

	test("scopes SWOT competitor links to assigned opportunities", async () => {
		let linkWhere: unknown;
		const linkChain = createChainableQuery([]);
		(linkChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			linkWhere = value;
			return linkChain;
		});

		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
			.mockImplementationOnce(() => linkChain)
			.mockImplementationOnce(() => createChainableQuery([]));
		dbMock.insert.mockImplementationOnce(() => createChainableQuery([{ id: "analysis-1" }]));

		const result = await generateSWOT("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		expectAssignedOpportunityTenantScope(linkWhere);
	});

	test("stores heuristic SWOT insights with evidence signals instead of generic confidence", async () => {
		let insertedValues: Record<string, unknown> | undefined;
		const insertChain = createChainableQuery([{ id: "analysis-1" }]);
		(insertChain.values as ReturnType<typeof vi.fn>).mockImplementation((value: Record<string, unknown>) => {
			insertedValues = value;
			return insertChain;
		});
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity({
				category: "GIS",
				budgetValue: "$1M",
				keyRequirements: "Cloud GIS migration",
				daysLeft: 18,
			})]))
			.mockImplementationOnce(() => createChainableQuery([
				{
					link: { role: "incumbent" },
					competitor: makeCompetitor({
						name: "Acme Corp",
						strengths: ["Agency relationship"],
						weaknesses: ["High pricing"],
						pricingTendency: "premium",
						winCount: 4,
					}),
				},
			]))
			.mockImplementationOnce(() => createChainableQuery([
				{
					coreCapabilities: ["GIS delivery", "Cloud migration"],
					differentiators: ["Local delivery team"],
					certifications: ["ISO 27001"],
				},
			]));
		dbMock.insert.mockImplementationOnce(() => insertChain);

		const result = await generateSWOT("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		expect(insertedValues?.aiInsights).toEqual([
			expect.objectContaining({
				insight: expect.stringContaining("2 recorded capability signals"),
				source: "company-capability-evidence",
			}),
			expect.objectContaining({
				insight: expect.stringContaining("1 linked competitor"),
				source: "linked-competitor-evidence",
			}),
			expect.objectContaining({
				insight: expect.stringContaining("4 planning signals"),
				source: "opportunity-metadata-evidence",
			}),
		]);
		if (result.success) {
			expect(result.data.aiInsights.map((insight) => insight.insight).join(" ")).not.toContain("Analysis generated using heuristic methods");
			expect(result.data.aiInsights.every((insight) => insight.confidence >= 0.25 && insight.confidence <= 0.85)).toBe(true);
		}
	});

	test("scopes discriminator suggestions to assigned opportunity links", async () => {
		let linkWhere: unknown;
		const linkChain = createChainableQuery([]);
		(linkChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			linkWhere = value;
			return linkChain;
		});

		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
			.mockImplementationOnce(() => linkChain)
			.mockImplementationOnce(() => createChainableQuery([]));

		const result = await suggestDiscriminators("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		expectAssignedOpportunityTenantScope(linkWhere);
	});

	test("suggests deterministic discriminators from competitor weaknesses when AI is unavailable", async () => {
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity({
				title: "Cloud migration support",
				keyRequirements: "Cost control, transition schedule, and resilient staffing",
			})]))
			.mockImplementationOnce(() => createChainableQuery([{
				competitor: makeCompetitor({
					id: "comp-002",
					name: "Legacy Prime",
					weaknesses: ["High pricing", "Slow delivery"],
				}),
			}]))
			.mockImplementationOnce(() => createChainableQuery([]));

		const result = await suggestDiscriminators("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toEqual(expect.arrayContaining([
			expect.objectContaining({
				statement: expect.stringContaining("Legacy Prime's high pricing risk"),
				type: "cost",
				effectiveAgainst: ["comp-002"],
				isNew: true,
				rationale: expect.stringContaining("Deterministic fallback"),
			}),
			expect.objectContaining({
				statement: expect.stringContaining("Legacy Prime's slow delivery risk"),
				type: "schedule",
				effectiveAgainst: ["comp-002"],
				isNew: true,
			}),
		]));
		expect(result.data.every((suggestion) => suggestion.confidence >= 0.25 && suggestion.confidence <= 0.85)).toBe(true);
	});

	test("scopes competitive matrix links to assigned opportunities", async () => {
		let linkWhere: unknown;
		const linkChain = createChainableQuery([]);
		(linkChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			linkWhere = value;
			return linkChain;
		});

		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
			.mockImplementationOnce(() => linkChain);

		const result = await generateCompetitiveMatrix("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(false);
		expectAssignedOpportunityTenantScope(linkWhere);
	});

	test("scopes latest competitive analysis reads to assigned opportunities", async () => {
		let where: unknown;
		const chain = createChainableQuery([]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await getLatestCompetitiveAnalysis("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		expectAssignedOpportunityTenantScope(where);
	});
});

// ---------------------------------------------------------------------------
// Discriminator CRUD
// ---------------------------------------------------------------------------

describe("Discriminator CRUD", () => {
	describe("createDiscriminator", () => {
		test("creates with valid input", async () => {
			const disc = makeDiscriminator();
			dbMock.insert.mockImplementation(() => createChainableQuery([disc]));

			const result = await createDiscriminator({
				statement: "Our team has 15 years of continuous experience with this agency",
				discriminatorType: "experience",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.statement).toContain("15 years");
			}
		});

		test("rejects empty statement", async () => {
			const result = await createDiscriminator({
				statement: "",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Statement is required");
			}
		});

		test("rejects invalid discriminator type", async () => {
			const result = await createDiscriminator({
				statement: "Valid statement",
				discriminatorType: "invalid" as never,
			});
			expect(result.success).toBe(false);
		});

		test("accepts all valid discriminator types", async () => {
			const types = ["capability", "experience", "approach", "team", "cost", "schedule", "innovation", "past_performance"] as const;
			for (const type of types) {
				const disc = makeDiscriminator({ discriminatorType: type });
				dbMock.insert.mockImplementation(() => createChainableQuery([disc]));

				const result = await createDiscriminator({ statement: `Type ${type}`, discriminatorType: type });
				expect(result.success).toBe(true);
			}
		});

		test("accepts supporting evidence array", async () => {
			const disc = makeDiscriminator();
			dbMock.insert.mockImplementation(() => createChainableQuery([disc]));

			const result = await createDiscriminator({
				statement: "With evidence",
				supportingEvidence: [
					{ type: "contract", description: "Contract ABC", reference: "ABC-123" },
					{ type: "metric", description: "99.9% uptime" },
				],
			});
			expect(result.success).toBe(true);
		});

		test("rejects invalid supporting evidence type", async () => {
			const result = await createDiscriminator({
				statement: "Bad evidence type",
				supportingEvidence: [
					{ type: "invalid" as never, description: "Test" },
				],
			});
			expect(result.success).toBe(false);
		});
	});

	describe("updateDiscriminator", () => {
		test("updates existing discriminator", async () => {
			const updated = makeDiscriminator({ statement: "Updated statement" });
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateDiscriminator("disc-001", { statement: "Updated statement" });
			expect(result.success).toBe(true);
		});

		test("returns not found for missing discriminator", async () => {
			dbMock.update.mockImplementation(() => createChainableQuery([]));

			const result = await updateDiscriminator("nonexistent", { statement: "Update" });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});

	describe("deleteDiscriminator", () => {
		test("deletes existing discriminator", async () => {
			const disc = makeDiscriminator();
			dbMock.delete.mockImplementation(() => createChainableQuery([disc]));

			const result = await deleteDiscriminator("disc-001");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.deleted).toBe(true);
			}
		});

		test("returns not found for missing discriminator", async () => {
			dbMock.delete.mockImplementation(() => createChainableQuery([]));

			const result = await deleteDiscriminator("nonexistent");
			expect(result.success).toBe(false);
		});
	});

	describe("listDiscriminators", () => {
		test("returns all discriminators without filters", async () => {
			const discs = [makeDiscriminator(), makeDiscriminator({ id: "disc-002" })];
			dbMock.select.mockImplementation(() => createChainableQuery(discs));

			const result = await listDiscriminators();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(2);
			}
		});

		test("filters by type", async () => {
			const disc = makeDiscriminator();
			dbMock.select.mockImplementation(() => createChainableQuery([disc]));

			const result = await listDiscriminators({ type: "experience" });
			expect(result.success).toBe(true);
		});

		test("filters by active status", async () => {
			const disc = makeDiscriminator();
			dbMock.select.mockImplementation(() => createChainableQuery([disc]));

			const result = await listDiscriminators({ isActive: true });
			expect(result.success).toBe(true);
		});
	});

	describe("recordDiscriminatorUsage", () => {
		test("increments use count and win count on win", async () => {
			const existing = makeDiscriminator({ useCount: 3, winCount: 2 });
			dbMock.select.mockImplementation(() => createChainableQuery([existing]));
			const updated = makeDiscriminator({
				useCount: 4,
				winCount: 3,
				effectivenessScore: 75,
			});
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await recordDiscriminatorUsage("disc-001", true);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.useCount).toBe(4);
				expect(result.data.winCount).toBe(3);
			}
		});

		test("increments use count only on loss", async () => {
			const existing = makeDiscriminator({ useCount: 3, winCount: 2 });
			dbMock.select.mockImplementation(() => createChainableQuery([existing]));
			const updated = makeDiscriminator({
				useCount: 4,
				winCount: 2,
				effectivenessScore: 50,
			});
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await recordDiscriminatorUsage("disc-001", false);
			expect(result.success).toBe(true);
		});

		test("returns not found for missing discriminator", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await recordDiscriminatorUsage("nonexistent", true);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});
});

// ---------------------------------------------------------------------------
// Ghost Themes
// ---------------------------------------------------------------------------

describe("Ghost Themes", () => {
	describe("createGhostTheme", () => {
		test("creates ghost theme when competitor exists", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));
			const theme = {
				id: "gt-001",
				competitorId: "00000000-0000-4000-8000-000000000001",
				weakness: "Poor response time",
				ghostLanguage: "Our team emphasizes rapid response...",
				isEthical: true,
				useCount: 0,
			};
			dbMock.insert.mockImplementation(() => createChainableQuery([theme]));

			const result = await createGhostTheme({
				competitorId: "00000000-0000-4000-8000-000000000001",
				weakness: "Poor response time",
				ghostLanguage: "Our team emphasizes rapid response...",
			});
			expect(result.success).toBe(true);
		});

		test("returns error when competitor not found", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await createGhostTheme({
				competitorId: "00000000-0000-4000-8000-000000000001",
				weakness: "Test",
				ghostLanguage: "Test language",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Competitor not found");
			}
		});

		test("rejects empty weakness", async () => {
			const result = await createGhostTheme({
				competitorId: "00000000-0000-4000-8000-000000000001",
				weakness: "",
				ghostLanguage: "Some language",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Weakness");
			}
		});

		test("rejects empty ghost language", async () => {
			const result = await createGhostTheme({
				competitorId: "00000000-0000-4000-8000-000000000001",
				weakness: "Some weakness",
				ghostLanguage: "",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Ghost language");
			}
		});

		test("rejects invalid competitor ID format", async () => {
			const result = await createGhostTheme({
				competitorId: "not-a-uuid",
				weakness: "Test",
				ghostLanguage: "Test language",
			});
			expect(result.success).toBe(false);
		});

		test("accepts valid category values", async () => {
			const comp = makeCompetitor();
			dbMock.select.mockImplementation(() => createChainableQuery([comp]));
			const theme = { id: "gt-002", competitorId: "00000000-0000-4000-8000-000000000001", weakness: "w", ghostLanguage: "g", isEthical: true, useCount: 0 };
			dbMock.insert.mockImplementation(() => createChainableQuery([theme]));

			for (const cat of ["technical", "management", "past_performance", "cost", "schedule", "risk"] as const) {
				const result = await createGhostTheme({
					competitorId: "00000000-0000-4000-8000-000000000001",
					weakness: "Some weakness",
					ghostLanguage: "Some language",
					category: cat,
				});
				expect(result.success).toBe(true);
			}
		});
	});

	describe("listGhostThemes", () => {
		test("returns all ghost themes without filter", async () => {
			const themes = [
				{ id: "gt-001", competitorId: "comp-001", weakness: "w1", ghostLanguage: "g1", useCount: 3 },
				{ id: "gt-002", competitorId: "comp-002", weakness: "w2", ghostLanguage: "g2", useCount: 1 },
			];
			dbMock.select.mockImplementation(() => createChainableQuery(themes));

			const result = await listGhostThemes();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(2);
			}
		});

		test("filters by competitor ID", async () => {
			const theme = { id: "gt-001", competitorId: "comp-001", weakness: "w1", ghostLanguage: "g1", useCount: 1 };
			dbMock.select.mockImplementation(() => createChainableQuery([theme]));

			const result = await listGhostThemes("comp-001");
			expect(result.success).toBe(true);
		});
	});
});

// ---------------------------------------------------------------------------
// Competitor-Opportunity Linking
// ---------------------------------------------------------------------------

describe("Competitor-Opportunity Linking", () => {
	describe("addCompetitorToOpportunity", () => {
		test("creates link when it does not exist", async () => {
			let opportunityWhere: unknown;
			let existingWhere: unknown;
			const opportunityChain = createChainableQuery([makeOpportunity()]);
			(opportunityChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				opportunityWhere = value;
				return opportunityChain;
			});
			const existingChain = createChainableQuery([]);
			(existingChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				existingWhere = value;
				return existingChain;
			});
			dbMock.select
				.mockImplementationOnce(() => opportunityChain)
				.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]))
				.mockImplementationOnce(() => existingChain);
			const link = {
				id: "link-001",
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "00000000-0000-4000-8000-000000000002",
			};
			dbMock.insert.mockImplementation(() => createChainableQuery([link]));

			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "00000000-0000-4000-8000-000000000002",
			});
			expect(result.success).toBe(true);
			const opportunitySql = collectSqlFragments(opportunityWhere).join(" ");
			expect(opportunitySql).toContain("o.assignedTo");
			expect(opportunitySql).toContain("o.orgId");
			expectAssignedOpportunityTenantScope(existingWhere);
		});

		test("rejects duplicate link", async () => {
			const existing = {
				id: "link-001",
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "00000000-0000-4000-8000-000000000002",
			};
			dbMock.select
				.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
				.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]))
				.mockImplementationOnce(() => createChainableQuery([existing]));

			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "00000000-0000-4000-8000-000000000002",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("already linked");
			}
		});

		test("rejects invalid competitor ID format", async () => {
			const result = await addCompetitorToOpportunity({
				competitorId: "not-a-uuid",
				opportunityId: "00000000-0000-4000-8000-000000000002",
			});
			expect(result.success).toBe(false);
		});

		test("rejects invalid opportunity ID format", async () => {
			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});

		test("accepts optional fields", async () => {
			dbMock.select
				.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
				.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]))
				.mockImplementationOnce(() => createChainableQuery([]));
			const link = {
				id: "link-002",
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "00000000-0000-4000-8000-000000000002",
				likelihoodToBid: "likely",
				role: "prime",
			};
			dbMock.insert.mockImplementation(() => createChainableQuery([link]));

			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-4000-8000-000000000001",
				opportunityId: "00000000-0000-4000-8000-000000000002",
				likelihoodToBid: "likely",
				role: "prime",
				notes: "Strong competitor",
			});
			expect(result.success).toBe(true);
		});

		test("accepts all valid likelihood values", async () => {
			for (const likelihood of ["certain", "likely", "possible", "unlikely"] as const) {
				dbMock.select
					.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
					.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]))
					.mockImplementationOnce(() => createChainableQuery([]));
				dbMock.insert.mockImplementation(() => createChainableQuery([{ id: `link-${likelihood}` }]));

				const result = await addCompetitorToOpportunity({
					competitorId: "00000000-0000-4000-8000-000000000001",
					opportunityId: "00000000-0000-4000-8000-000000000002",
					likelihoodToBid: likelihood,
				});
				expect(result.success).toBe(true);
			}
		});
	});
});

describe("Competitive tenant-scoped utilities", () => {
	test("scopes competitor-opportunity updates through assigned opportunity tenant", async () => {
		let updateWhere: unknown;
		const updateChain = createChainableQuery([{
			id: "link-001",
			opportunityId: "00000000-0000-4000-8000-000000000002",
		}]);
		(updateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateWhere = value;
			return updateChain;
		});
		dbMock.update.mockImplementationOnce(() => updateChain);

		const result = await updateCompetitorOpportunity("link-001", { notes: "Updated intelligence" });

		expect(result.success).toBe(true);
		expectAssignedOpportunityTenantScope(updateWhere);
	});

	test("scopes win/loss updates to owned competitor and assigned opportunity", async () => {
		let competitorUpdateWhere: unknown;
		let linkSelectWhere: unknown;
		let linkUpdateWhere: unknown;
		const competitorUpdateChain = createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]);
		(competitorUpdateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			competitorUpdateWhere = value;
			return competitorUpdateChain;
		});
		const linkSelectChain = createChainableQuery([{
			id: "link-001",
			competitorId: "00000000-0000-4000-8000-000000000001",
			opportunityId: "00000000-0000-4000-8000-000000000002",
		}]);
		(linkSelectChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			linkSelectWhere = value;
			return linkSelectChain;
		});
		const linkUpdateChain = createChainableQuery([{ id: "link-001" }]);
		(linkUpdateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			linkUpdateWhere = value;
			return linkUpdateChain;
		});
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
			.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]))
			.mockImplementationOnce(() => linkSelectChain);
		dbMock.update
			.mockImplementationOnce(() => competitorUpdateChain)
			.mockImplementationOnce(() => linkUpdateChain);

		const result = await trackCompetitorWinLoss(
			"00000000-0000-4000-8000-000000000001",
			"win",
			"00000000-0000-4000-8000-000000000002",
			"Incumbent underperformed"
		);

		expect(result.success).toBe(true);
		const competitorSql = collectSqlFragments(competitorUpdateWhere).join(" ");
		expect(competitorSql).toContain("c.orgId");
		expect(competitorSql).toContain(testOrganizationId);
		expectAssignedOpportunityTenantScope(linkSelectWhere);
		expectAssignedOpportunityTenantScope(linkUpdateWhere);
	});

	test("scopes win/loss analysis encounters to assigned opportunity tenant", async () => {
		let encountersWhere: unknown;
		const encountersChain = createChainableQuery([]);
		(encountersChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			encountersWhere = value;
			return encountersChain;
		});
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]))
			.mockImplementationOnce(() => encountersChain);

		const result = await getWinLossAnalysis("00000000-0000-4000-8000-000000000001");

		expect(result.success).toBe(true);
		expectAssignedOpportunityTenantScope(encountersWhere);
	});

	test("scopes ghost theme usage updates to owned organization", async () => {
		let updateWhere: unknown;
		const updateChain = createChainableQuery([{ id: "gt-001", useCount: 4 }]);
		(updateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateWhere = value;
			return updateChain;
		});
		dbMock.update.mockImplementationOnce(() => updateChain);

		const result = await recordGhostThemeUsage("gt-001");

		expect(result.success).toBe(true);
		const sqlText = collectSqlFragments(updateWhere).join(" ");
		expect(sqlText).toContain("g.orgId");
		expect(sqlText).toContain(testOrganizationId);
	});

	test("scopes competitor intelligence summary counts and analyses to tenant", async () => {
		let competitorCountWhere: unknown;
		let recentAnalysesWhere: unknown;
		const competitorCountChain = createChainableQuery([{ count: 2 }]);
		(competitorCountChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			competitorCountWhere = value;
			return competitorCountChain;
		});
		const recentAnalysesChain = createChainableQuery([{ count: 1 }]);
		(recentAnalysesChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			recentAnalysesWhere = value;
			return recentAnalysesChain;
		});
		dbMock.select
			.mockImplementationOnce(() => competitorCountChain)
			.mockImplementationOnce(() => createChainableQuery([{ count: 1 }]))
			.mockImplementationOnce(() => createChainableQuery([{ count: 1 }]))
			.mockImplementationOnce(() => createChainableQuery([{ winsAgainstUs: 1, lossesToUs: 3 }]))
			.mockImplementationOnce(() => recentAnalysesChain);

		const result = await getCompetitorIntelligenceSummary();

		expect(result.success).toBe(true);
		const competitorSql = collectSqlFragments(competitorCountWhere).join(" ");
		expect(competitorSql).toContain("c.orgId");
		expect(competitorSql).toContain(testOrganizationId);
		const analysesSql = collectSqlFragments(recentAnalysesWhere).join(" ");
		expect(analysesSql).toContain("opportunities.organization_id");
		expect(analysesSql).toContain(testOrganizationId);
	});

	test("writes imported competitive intelligence into the current organization", async () => {
		let existingWhere: unknown;
		let insertedValues: Record<string, unknown> | undefined;
		const existingChain = createChainableQuery([]);
		(existingChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			existingWhere = value;
			return existingChain;
		});
		const insertChain = createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]);
		(insertChain.values as ReturnType<typeof vi.fn>).mockImplementation((value: Record<string, unknown>) => {
			insertedValues = value;
			return insertChain;
		});
		dbMock.select.mockImplementationOnce(() => existingChain);
		dbMock.insert.mockImplementationOnce(() => insertChain);

		const result = await importCompetitorFromCI(makeCompetitiveIntelligenceRow());

		expect(result.success).toBe(true);
		const existingSql = collectSqlFragments(existingWhere).join(" ");
		expect(existingSql).toContain("c.orgId");
		expect(existingSql).toContain(testOrganizationId);
		expect(insertedValues?.organizationId).toBe(testOrganizationId);
	});

	test("bulk competitive intelligence import checks existing rows inside tenant", async () => {
		let existingWhere: unknown;
		const existingChain = createChainableQuery([]);
		(existingChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			existingWhere = value;
			return existingChain;
		});
		dbMock.select
			.mockImplementationOnce(() => existingChain)
			.mockImplementationOnce(() => createChainableQuery([]));
		dbMock.insert.mockImplementationOnce(() => createChainableQuery([makeCompetitor({ organizationId: testOrganizationId })]));

		const result = await bulkImportCompetitiveIntelligence([makeCompetitiveIntelligenceRow()]);

		expect(result.success).toBe(true);
		const existingSql = collectSqlFragments(existingWhere).join(" ");
		expect(existingSql).toContain("c.orgId");
		expect(existingSql).toContain(testOrganizationId);
	});

	test("scopes competitor teaming candidates to tenant", async () => {
		let competitorPartnerWhere: unknown;
		const competitorPartnerChain = createChainableQuery([]);
		(competitorPartnerChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			competitorPartnerWhere = value;
			return competitorPartnerChain;
		});
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity()]))
			.mockImplementationOnce(() => createChainableQuery([{ coreCapabilities: [], certifications: [] }]))
			.mockImplementationOnce(() => createChainableQuery([]))
			.mockImplementationOnce(() => competitorPartnerChain);

		const result = await suggestTeamingPartners("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		const sqlText = collectSqlFragments(competitorPartnerWhere).join(" ");
		expect(sqlText).toContain("c.orgId");
		expect(sqlText).toContain(testOrganizationId);
	});

	test("returns partner sourcing actions when capability gaps have no active partner match", async () => {
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([makeOpportunity({
				keyRequirements: "Security operations and cloud migration support",
				technicalRequirements: "Cybersecurity controls and AWS cloud engineering",
			})]))
			.mockImplementationOnce(() => createChainableQuery([{ coreCapabilities: [], certifications: [] }]))
			.mockImplementationOnce(() => createChainableQuery([]))
			.mockImplementationOnce(() => createChainableQuery([]));

		const result = await suggestTeamingPartners("00000000-0000-4000-8000-000000000002");

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toEqual(expect.arrayContaining([
			expect.objectContaining({
				partnerName: "Partner sourcing required: security",
				gapsFilled: ["security"],
				relationshipType: "sub",
				confidence: 0.35,
			}),
			expect.objectContaining({
				partnerName: "Partner sourcing required: cloud",
				gapsFilled: ["cloud"],
			}),
		]));
	});
});

// ---------------------------------------------------------------------------
// Validation edge cases
// ---------------------------------------------------------------------------

describe("Competitive validation edge cases", () => {
	test("createCompetitor accepts pricing tendency values", async () => {
		for (const tendency of ["aggressive", "moderate", "premium"] as const) {
			const comp = makeCompetitor({ pricingTendency: tendency });
			dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

			const result = await createCompetitor({ name: `Test ${tendency}`, pricingTendency: tendency });
			expect(result.success).toBe(true);
		}
	});

	test("createCompetitor accepts labor rate comparison values", async () => {
		for (const comparison of ["below_market", "market", "above_market"] as const) {
			const comp = makeCompetitor({ laborRateComparison: comparison });
			dbMock.insert.mockImplementation(() => createChainableQuery([comp]));

			const result = await createCompetitor({ name: `Test ${comparison}`, laborRateComparison: comparison });
			expect(result.success).toBe(true);
		}
	});

	test("createDiscriminator accepts short version up to 200 chars", async () => {
		const disc = makeDiscriminator();
		dbMock.insert.mockImplementation(() => createChainableQuery([disc]));

		const result = await createDiscriminator({
			statement: "Valid statement",
			shortVersion: "X".repeat(200),
		});
		expect(result.success).toBe(true);
	});

	test("createDiscriminator rejects short version over 200 chars", async () => {
		const result = await createDiscriminator({
			statement: "Valid statement",
			shortVersion: "X".repeat(201),
		});
		expect(result.success).toBe(false);
	});
});
