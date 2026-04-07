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

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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

let dbMock: ReturnType<typeof createDbMock>;

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
	},
	discriminators: {
		id: "d.id", statement: "d.stmt", discriminatorType: "d.type", isActive: "d.active",
		effectiveAgainst: "d.against", effectivenessScore: "d.score", useCount: "d.useCount",
		winCount: "d.winCount",
	},
	ghostThemes: {
		id: "g.id", competitorId: "g.compId", useCount: "g.useCount",
	},
	competitorOpportunities: {
		id: "co.id", competitorId: "co.compId", opportunityId: "co.oppId",
	},
	competitiveAnalyses: {
		id: "ca.id", opportunityId: "ca.oppId",
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "o.id", title: "o.title", category: "o.cat", organization: "o.org",
		countryRegion: "o.region", metadata: "o.meta", budgetValue: "o.budget",
		keyRequirements: "o.reqs",
	},
	partners: { id: "p.id" },
	companySettings: { id: "cs.id" },
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

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
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

			const result = await listCompetitors("org-001");
			expect(result.success).toBe(true);
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
				competitorId: "00000000-0000-0000-0000-000000000001",
				weakness: "Poor response time",
				ghostLanguage: "Our team emphasizes rapid response...",
				isEthical: true,
				useCount: 0,
			};
			dbMock.insert.mockImplementation(() => createChainableQuery([theme]));

			const result = await createGhostTheme({
				competitorId: "00000000-0000-0000-0000-000000000001",
				weakness: "Poor response time",
				ghostLanguage: "Our team emphasizes rapid response...",
			});
			expect(result.success).toBe(true);
		});

		test("returns error when competitor not found", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await createGhostTheme({
				competitorId: "00000000-0000-0000-0000-000000000001",
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
				competitorId: "00000000-0000-0000-0000-000000000001",
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
				competitorId: "00000000-0000-0000-0000-000000000001",
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
			const theme = { id: "gt-002", competitorId: "00000000-0000-0000-0000-000000000001", weakness: "w", ghostLanguage: "g", isEthical: true, useCount: 0 };
			dbMock.insert.mockImplementation(() => createChainableQuery([theme]));

			for (const cat of ["technical", "management", "past_performance", "cost", "schedule", "risk"] as const) {
				const result = await createGhostTheme({
					competitorId: "00000000-0000-0000-0000-000000000001",
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
			// First query (check existing) returns empty
			dbMock.select.mockReturnValueOnce(createChainableQuery([]) as never);
			const link = {
				id: "link-001",
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "00000000-0000-0000-0000-000000000002",
			};
			dbMock.insert.mockImplementation(() => createChainableQuery([link]));

			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "00000000-0000-0000-0000-000000000002",
			});
			expect(result.success).toBe(true);
		});

		test("rejects duplicate link", async () => {
			const existing = {
				id: "link-001",
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "00000000-0000-0000-0000-000000000002",
			};
			dbMock.select.mockReturnValueOnce(createChainableQuery([existing]) as never);

			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "00000000-0000-0000-0000-000000000002",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("already linked");
			}
		});

		test("rejects invalid competitor ID format", async () => {
			const result = await addCompetitorToOpportunity({
				competitorId: "not-a-uuid",
				opportunityId: "00000000-0000-0000-0000-000000000002",
			});
			expect(result.success).toBe(false);
		});

		test("rejects invalid opportunity ID format", async () => {
			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});

		test("accepts optional fields", async () => {
			dbMock.select.mockReturnValueOnce(createChainableQuery([]) as never);
			const link = {
				id: "link-002",
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "00000000-0000-0000-0000-000000000002",
				likelihoodToBid: "likely",
				role: "prime",
			};
			dbMock.insert.mockImplementation(() => createChainableQuery([link]));

			const result = await addCompetitorToOpportunity({
				competitorId: "00000000-0000-0000-0000-000000000001",
				opportunityId: "00000000-0000-0000-0000-000000000002",
				likelihoodToBid: "likely",
				role: "prime",
				notes: "Strong competitor",
			});
			expect(result.success).toBe(true);
		});

		test("accepts all valid likelihood values", async () => {
			for (const likelihood of ["certain", "likely", "possible", "unlikely"] as const) {
				dbMock.select.mockReturnValueOnce(createChainableQuery([]) as never);
				dbMock.insert.mockImplementation(() => createChainableQuery([{ id: `link-${likelihood}` }]));

				const result = await addCompetitorToOpportunity({
					competitorId: "00000000-0000-0000-0000-000000000001",
					opportunityId: "00000000-0000-0000-0000-000000000002",
					likelihoodToBid: likelihood,
				});
				expect(result.success).toBe(true);
			}
		});
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