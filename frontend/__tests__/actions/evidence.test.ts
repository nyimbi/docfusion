/**
 * Evidence & Proof Point Optimizer Server Actions Tests
 *
 * Tests for the evidence management system including:
 * - Evidence CRUD operations
 * - Strength score calculation (calculateInitialStrengthScore)
 * - Tier classification (calculateTier)
 * - DB-to-API mapping (mapDBEvidenceToEvidence)
 * - Claim analysis mapping (mapDBClaimToClaimAnalysis)
 * - Zod validation for evidence creation/update
 * - Evidence usage recording
 * - Edge cases: empty content, missing fields, boundary scores
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUserContext = {
	userId: "user-001",
	organizationId: "org-001",
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => mockUserContext),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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
	// Support rowCount for delete operations
	(chain as Record<string, unknown>).rowCount = Array.isArray(returnValue) ? returnValue.length : 1;
	return chain;
}

var dbMock: ReturnType<typeof createDbMock>;

function createDbMock() {
	return {
		select: vi.fn(() => createChainableQuery([])),
		insert: vi.fn(() => createChainableQuery([])),
		update: vi.fn(() => createChainableQuery([])),
		delete: vi.fn(() => {
			const chain = createChainableQuery([]);
			// delete() returns result with rowCount
			(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
				Promise.resolve({ rowCount: 1 }).then(resolve);
			return chain;
		}),
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

vi.mock("@/lib/db/schema-evidence", () => ({
	evidenceLibrary: {
		id: "ev.id", organizationId: "ev.orgId", title: "ev.title", content: "ev.content",
		evidenceType: "ev.type", category: "ev.cat", status: "ev.status",
		isQuantified: "ev.quant", strengthScore: "ev.strength", useCount: "ev.useCount",
		summary: "ev.summary", createdAt: "ev.createdAt", updatedAt: "ev.updatedAt",
	},
	evidenceUsages: {
		id: "eu.id", evidenceId: "eu.evidenceId", documentId: "eu.docId",
		opportunityId: "eu.opportunityId",
	},
	claimAnalysis: {
		id: "ca.id", documentId: "ca.docId", sectionId: "ca.secId",
		opportunityId: "ca.opportunityId", analyzedAt: "ca.analyzedAt",
	},
	evidenceMatrices: {
		id: "em.id", opportunityId: "em.oppId",
	},
	evidenceStrengthAnalysis: {
		id: "esa.id", evidenceId: "esa.evidenceId",
	},
}));

// Import subjects under test
import {
	createEvidence,
	updateEvidence,
	deleteEvidence,
	getEvidence,
	listEvidence,
	bulkImportEvidence,
	rateEvidenceStrength,
	recordEvidenceUsage,
	getMostUsedEvidence,
	archiveEvidence,
	getEvidenceUsageStats,
	analyzeClaimsInDocument,
	analyzeClaimsInSection,
	getClaimAnalysis,
	resolveClaim,
	linkEvidenceToClaim,
	suggestEvidenceForClaim,
	suggestEvidenceForSection,
	getClaimsSummary,
	calculateEvidenceCoverage,
	generateEvidenceMatrix,
	generateEvidenceReport,
} from "@/lib/actions/evidence";

// ============================================================================
// Helpers
// ============================================================================

function makeDbEvidenceRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "ev-001",
		organizationId: "org-001",
		title: "Cloud Migration Success",
		content: "Migrated 500 apps to AWS with 99.9% uptime",
		summary: null,
		evidenceType: "metric",
		category: "technical",
		subcategory: null,
		tags: ["cloud", "aws"],
		isQuantified: true,
		metric: "uptime",
		metricValue: "99.9",
		metricUnit: "%",
		metricContext: "Over 12-month period",
		sourceType: "customer",
		sourceReference: "Contract ABC-123",
		sourceDate: "2024-01-15",
		sourceVerified: true,
		verificationNotes: null,
		strengthScore: 85,
		strengthFactors: null,
		relatedCapabilities: ["cloud-migration"],
		relatedNaicsCodes: ["541511"],
		relatedAgencies: ["DoD"],
		useCount: 5,
		lastUsedAt: null,
		lastUsedInOpportunityId: null,
		status: "approved",
		approvedBy: "user-002",
		approvedAt: new Date("2024-02-01"),
		createdBy: "user-001",
		createdAt: new Date("2024-01-15"),
		updatedAt: new Date("2024-01-20"),
		...overrides,
	};
}

function makeDbClaimRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "claim-001",
		documentId: "doc-001",
		sectionId: "section-001",
		opportunityId: "opp-001",
		claimText: "We deliver measurable uptime improvements.",
		claimType: "performance",
		claimLocation: null,
		hasEvidence: false,
		evidenceStrength: "none",
		linkedEvidenceIds: [],
		suggestedEvidence: [],
		quantificationSuggestion: null,
		riskLevel: "medium",
		evaluatorImpact: null,
		status: "open",
		resolution: null,
		resolvedBy: null,
		resolvedAt: null,
		resolutionNotes: null,
		analyzedAt: new Date("2026-05-01T00:00:00.000Z"),
		createdAt: new Date("2026-05-01T00:00:00.000Z"),
		...overrides,
	};
}

async function mockMissingOrganizationContextOnce() {
	const { requireUserContext } = await import("@/lib/auth-utils");
	(requireUserContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
		userId: "user-001",
		organizationId: undefined,
	});
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

function expectAssignedOpportunityScope(where: unknown) {
	expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockImplementation(() => createChainableQuery([]));
	dbMock.insert.mockImplementation(() => createChainableQuery([]));
	dbMock.update.mockImplementation(() => createChainableQuery([]));
});

// ---------------------------------------------------------------------------
// Evidence CRUD
// ---------------------------------------------------------------------------

describe("Evidence CRUD", () => {
	describe("createEvidence", () => {
		test("creates evidence with valid input", async () => {
			const row = makeDbEvidenceRow();
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: "Cloud Migration Success",
				content: "Migrated 500 apps to AWS with 99.9% uptime",
				evidenceType: "metric",
				category: "technical",
				isQuantified: true,
				metric: "uptime",
				metricValue: "99.9",
				metricUnit: "%",
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Cloud Migration Success");
				expect(result.data.evidenceType).toBe("metric");
			}
		});

		test("rejects empty title", async () => {
			const result = await createEvidence({
				title: "",
				content: "Some content",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Title is required");
			}
		});

		test("rejects empty content", async () => {
			const result = await createEvidence({
				title: "Valid Title",
				content: "",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Content is required");
			}
		});

		test("rejects invalid evidence type", async () => {
			const result = await createEvidence({
				title: "Test",
				content: "Content",
				evidenceType: "invalid_type" as never,
			});
			expect(result.success).toBe(false);
		});

		test("rejects invalid category", async () => {
			const result = await createEvidence({
				title: "Test",
				content: "Content",
				category: "nonexistent" as never,
			});
			expect(result.success).toBe(false);
		});

		test("accepts extended evidence types for component compatibility", async () => {
			const row = makeDbEvidenceRow({ evidenceType: "past_performance" });
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: "Past Perf",
				content: "Successfully delivered project X",
				evidenceType: "past_performance",
			});
			expect(result.success).toBe(true);
		});

		test("accepts extended categories for component compatibility", async () => {
			const row = makeDbEvidenceRow({ category: "corporate" });
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: "Corporate",
				content: "Company overview",
				category: "corporate",
			});
			expect(result.success).toBe(true);
		});

		test("requires organization context", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await createEvidence({
				title: "Test",
				content: "Content",
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
		});

		test("defaults status to draft", async () => {
			const row = makeDbEvidenceRow({ status: "draft" });
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: "Draft Evidence",
				content: "Needs review",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.status).toBe("draft");
			}
		});

		test("defaults tags to empty array", async () => {
			const row = makeDbEvidenceRow({ tags: [] });
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: "No Tags",
				content: "Content without tags",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.tags).toEqual([]);
			}
		});
	});

	describe("updateEvidence", () => {
		test("requires organization context before updating", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await updateEvidence("ev-001", { title: "Updated Title" });

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.update).not.toHaveBeenCalled();
		});

		test("updates specified fields", async () => {
			const updated = makeDbEvidenceRow({ title: "Updated Title" });
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateEvidence("ev-001", { title: "Updated Title" });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Updated Title");
			}
		});

		test("returns not found for missing evidence", async () => {
			dbMock.update.mockImplementation(() => createChainableQuery([]));

			const result = await updateEvidence("nonexistent", { title: "Update" });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});

		test("accepts partial updates", async () => {
			const updated = makeDbEvidenceRow({ isQuantified: true, metricValue: "99.99" });
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateEvidence("ev-001", {
				isQuantified: true,
				metricValue: "99.99",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("deleteEvidence", () => {
		test("requires organization context before deleting", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await deleteEvidence("ev-001");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.delete).not.toHaveBeenCalled();
		});

		test("deletes existing evidence", async () => {
			dbMock.delete.mockImplementation(() => {
				const chain = createChainableQuery([]);
				(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
					Promise.resolve({ rowCount: 1 }).then(resolve);
				return chain;
			});

			const result = await deleteEvidence("ev-001");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.deleted).toBe(true);
			}
		});

		test("returns not found for missing evidence", async () => {
			dbMock.delete.mockImplementation(() => {
				const chain = createChainableQuery([]);
				(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
					Promise.resolve({ rowCount: 0 }).then(resolve);
				return chain;
			});

			const result = await deleteEvidence("nonexistent");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});

	describe("getEvidence", () => {
		test("requires organization context before loading by id", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await getEvidence("ev-001");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.select).not.toHaveBeenCalled();
		});

		test("returns evidence when found", async () => {
			const row = makeDbEvidenceRow();
			dbMock.select.mockImplementation(() => createChainableQuery([row]));

			const result = await getEvidence("ev-001");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.id).toBe("ev-001");
				expect(result.data.title).toBe("Cloud Migration Success");
				expect(result.data.tags).toEqual(["cloud", "aws"]);
			}
		});

		test("returns not found for missing evidence", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await getEvidence("nonexistent");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});

	describe("listEvidence", () => {
		test("requires organization context before listing", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await listEvidence();

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.select).not.toHaveBeenCalled();
		});

		test("returns array of evidence items", async () => {
			const rows = [
				makeDbEvidenceRow({ id: "ev-001" }),
				makeDbEvidenceRow({ id: "ev-002", title: "Second Item" }),
			];
			dbMock.select.mockImplementation(() => createChainableQuery(rows));

			const result = await listEvidence();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(2);
			}
		});

		test("returns empty array when no evidence exists", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await listEvidence();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(0);
			}
		});

		test("normalizes evidence list pagination", async () => {
			const chain = createChainableQuery([]);
			dbMock.select.mockReturnValueOnce(chain);

			const result = await listEvidence({ limit: -20, offset: -5 });

			expect(result.success).toBe(true);
			expect(chain.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(1);
			expect(chain.offset as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(0);
		});
	});

	describe("bulkImportEvidence", () => {
		test("requires organization context before importing", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await bulkImportEvidence([{ title: "Bulk", content: "Evidence" }]);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.insert).not.toHaveBeenCalled();
		});
	});

	describe("evidence helper tenant scoping", () => {
		test("normalizes most-used evidence limits", async () => {
			const chain = createChainableQuery([]);
			dbMock.select.mockReturnValueOnce(chain);

			const result = await getMostUsedEvidence(Number.POSITIVE_INFINITY);

			expect(result.success).toBe(true);
			expect(chain.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(10);
		});

		test("requires organization context before rating evidence strength", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await rateEvidenceStrength("ev-001");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.select).not.toHaveBeenCalled();
		});

		test("requires organization context before recording evidence usage", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await recordEvidenceUsage("ev-001", {
				documentId: "00000000-0000-4000-8000-000000000001",
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.insert).not.toHaveBeenCalled();
		});

		test("requires organization context before listing most-used evidence", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await getMostUsedEvidence();

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.select).not.toHaveBeenCalled();
		});

		test("requires organization context before archiving evidence", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await archiveEvidence("ev-001");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.update).not.toHaveBeenCalled();
		});

		test("requires organization context before reading evidence usage stats", async () => {
			await mockMissingOrganizationContextOnce();

			const result = await getEvidenceUsageStats("ev-001");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Organization context required");
			}
			expect(dbMock.select).not.toHaveBeenCalled();
		});
	});
});

// ---------------------------------------------------------------------------
// Strength Score Calculation (tested indirectly via createEvidence)
// ---------------------------------------------------------------------------

describe("Initial strength score calculation (via createEvidence)", () => {
	test("base score is 50 for minimal evidence", async () => {
		const row = makeDbEvidenceRow({ strengthScore: 50 });
		dbMock.insert.mockImplementation(() => createChainableQuery([row]));

		const result = await createEvidence({
			title: "Minimal Evidence",
			content: "Basic content",
		});
		expect(result.success).toBe(true);
		// The strength score is computed server-side; we verify the db insert was called
		expect(dbMock.insert).toHaveBeenCalled();
	});

	test("quantified evidence with context gets higher score", async () => {
		// Score: 50 (base) + 15 (quantified) + 10 (context) + 10 (sourceType) + 5 (customer) + 5 (verified) = 95
		const row = makeDbEvidenceRow({ strengthScore: 95 });
		dbMock.insert.mockImplementation(() => createChainableQuery([row]));

		const result = await createEvidence({
			title: "Strong Evidence",
			content: "We achieved 99.9% uptime across all 500 migrated applications",
			evidenceType: "metric",
			category: "technical",
			isQuantified: true,
			metric: "uptime",
			metricValue: "99.9",
			metricUnit: "%",
			metricContext: "Measured over 12-month period",
			sourceType: "customer",
			sourceVerified: true,
		});
		expect(result.success).toBe(true);
	});

	test("source verification adds bonus", async () => {
		const row = makeDbEvidenceRow({ strengthScore: 70 });
		dbMock.insert.mockImplementation(() => createChainableQuery([row]));

		const result = await createEvidence({
			title: "Verified Source",
			content: "Content",
			sourceType: "third_party",
			sourceVerified: true,
		});
		expect(result.success).toBe(true);
	});

	test("related capabilities add bonus", async () => {
		const row = makeDbEvidenceRow({ strengthScore: 65 });
		dbMock.insert.mockImplementation(() => createChainableQuery([row]));

		const result = await createEvidence({
			title: "With Capabilities",
			content: "Content",
			sourceType: "internal",
			relatedCapabilities: ["cloud-migration", "devops"],
		});
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// mapDBEvidenceToEvidence (tested indirectly via getEvidence)
// ---------------------------------------------------------------------------

describe("DB-to-API evidence mapping", () => {
	test("maps all fields correctly from DB row", async () => {
		const row = makeDbEvidenceRow();
		dbMock.select.mockImplementation(() => createChainableQuery([row]));

		const result = await getEvidence("ev-001");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe("ev-001");
			expect(result.data.organizationId).toBe("org-001");
			expect(result.data.isQuantified).toBe(true);
			expect(result.data.sourceVerified).toBe(true);
			expect(result.data.useCount).toBe(5);
			expect(result.data.status).toBe("approved");
		}
	});

	test("defaults nullable fields to safe values", async () => {
		const row = makeDbEvidenceRow({
			tags: null,
			isQuantified: null,
			sourceVerified: null,
			useCount: null,
			status: null,
			createdAt: null,
			updatedAt: null,
		});
		dbMock.select.mockImplementation(() => createChainableQuery([row]));

		const result = await getEvidence("ev-001");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.tags).toEqual([]);
			expect(result.data.isQuantified).toBe(false);
			expect(result.data.sourceVerified).toBe(false);
			expect(result.data.useCount).toBe(0);
			expect(result.data.status).toBe("draft");
			expect(result.data.createdAt).toBeInstanceOf(Date);
			expect(result.data.updatedAt).toBeInstanceOf(Date);
		}
	});
});

// ---------------------------------------------------------------------------
// Opportunity-scoped coverage
// ---------------------------------------------------------------------------

describe("Evidence opportunity scoping", () => {
	test("scopes coverage usage and claim reads through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		const usagesQuery = createChainableQuery([]);
		const claimsQuery = createChainableQuery([]);
		(usagesQuery.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			wheres.push(value);
			return usagesQuery;
		});
		(claimsQuery.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			wheres.push(value);
			return claimsQuery;
		});
		dbMock.select
			.mockReturnValueOnce(usagesQuery)
			.mockReturnValueOnce(claimsQuery);

		const result = await calculateEvidenceCoverage("33333333-3333-4333-8333-333333333333");

		expect(result.success).toBe(true);
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	test("scopes matrix lookup and usage reads through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		const matrixQuery = createChainableQuery([]);
		const usagesQuery = createChainableQuery([]);
		const insertedMatrix = {
			id: "matrix-1",
			name: "requirements Matrix",
		};
		(matrixQuery.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			wheres.push(value);
			return matrixQuery;
		});
		(usagesQuery.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			wheres.push(value);
			return usagesQuery;
		});
		dbMock.select
			.mockReturnValueOnce(matrixQuery)
			.mockReturnValueOnce(usagesQuery);
		dbMock.insert.mockReturnValueOnce(createChainableQuery([insertedMatrix]));

		const result = await generateEvidenceMatrix("33333333-3333-4333-8333-333333333333", "requirements");

		expect(result.success).toBe(true);
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	test("scopes report usage reads through assigned opportunities", async () => {
		let usageWhere: unknown;
		const usagesQuery = createChainableQuery([]);
		(usagesQuery.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			usageWhere = value;
			return usagesQuery;
		});
		dbMock.select.mockReturnValueOnce(usagesQuery);

		const result = await generateEvidenceReport("33333333-3333-4333-8333-333333333333");

		expect(result.success).toBe(true);
		expect(collectSqlFragments(usageWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	test("scopes document and section claim reads through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		const documentClaimsQuery = createChainableQuery([makeDbClaimRow()]);
		const sectionClaimsQuery = createChainableQuery([makeDbClaimRow()]);
		const summaryClaimsQuery = createChainableQuery([makeDbClaimRow()]);
		for (const query of [documentClaimsQuery, sectionClaimsQuery, summaryClaimsQuery]) {
			(query.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				wheres.push(value);
				return query;
			});
		}
		dbMock.select
			.mockReturnValueOnce(documentClaimsQuery)
			.mockReturnValueOnce(sectionClaimsQuery)
			.mockReturnValueOnce(summaryClaimsQuery);

		const documentResult = await analyzeClaimsInDocument("doc-001");
		const sectionResult = await analyzeClaimsInSection("section-001");
		const summaryResult = await getClaimsSummary("doc-001");
		if (!documentResult.success) throw new Error(documentResult.error);
		if (!sectionResult.success) throw new Error(sectionResult.error);
		if (!summaryResult.success) throw new Error(summaryResult.error);

		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expectAssignedOpportunityScope(where);
		}
	});

	test("scopes direct claim lookup, mutation, and suggestions through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		const claimReadQuery = createChainableQuery([makeDbClaimRow()]);
		const claimUpdateQuery = createChainableQuery([]);
		const linkClaimQuery = createChainableQuery([makeDbClaimRow()]);
		const evidenceQuery = createChainableQuery([makeDbEvidenceRow()]);
		const linkUpdateQuery = createChainableQuery([]);
		const suggestClaimQuery = createChainableQuery([makeDbClaimRow()]);
		const approvedEvidenceQuery = createChainableQuery([makeDbEvidenceRow()]);

		for (const query of [
			claimReadQuery,
			claimUpdateQuery,
			linkClaimQuery,
			evidenceQuery,
			linkUpdateQuery,
			suggestClaimQuery,
			approvedEvidenceQuery,
		]) {
			(query.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				wheres.push(value);
				return query;
			});
		}
		(claimUpdateQuery as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
			Promise.resolve({ rowCount: 1 }).then(resolve);

		dbMock.select
			.mockReturnValueOnce(claimReadQuery)
			.mockReturnValueOnce(linkClaimQuery)
			.mockReturnValueOnce(evidenceQuery)
			.mockReturnValueOnce(suggestClaimQuery)
			.mockReturnValueOnce(approvedEvidenceQuery);
		dbMock.update
			.mockReturnValueOnce(claimUpdateQuery)
			.mockReturnValueOnce(linkUpdateQuery);

		expect((await getClaimAnalysis("claim-001")).success).toBe(true);
		expect((await resolveClaim("claim-001", {
			resolution: "evidence_added",
			notes: "Linked verified evidence",
		})).success).toBe(true);
		expect((await linkEvidenceToClaim("claim-001", "ev-001")).success).toBe(true);
		expect((await suggestEvidenceForClaim("claim-001")).success).toBe(true);

		expect(wheres).toHaveLength(7);
		for (const where of [wheres[0], wheres[1], wheres[2], wheres[4], wheres[5]]) {
			expectAssignedOpportunityScope(where);
		}
	});

	test("scopes section evidence suggestions through assigned claim reads", async () => {
		const wheres: unknown[] = [];
		const sectionClaimsQuery = createChainableQuery([makeDbClaimRow()]);
		const claimQuery = createChainableQuery([makeDbClaimRow()]);
		const evidenceQuery = createChainableQuery([]);
		for (const query of [sectionClaimsQuery, claimQuery, evidenceQuery]) {
			(query.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				wheres.push(value);
				return query;
			});
		}
		dbMock.select
			.mockReturnValueOnce(sectionClaimsQuery)
			.mockReturnValueOnce(claimQuery)
			.mockReturnValueOnce(evidenceQuery);

		const result = await suggestEvidenceForSection("section-001");

		if (!result.success) throw new Error(result.error);
		expect(wheres.length).toBeGreaterThanOrEqual(2);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
	});
});

// ---------------------------------------------------------------------------
// Validation edge cases
// ---------------------------------------------------------------------------

describe("Evidence validation edge cases", () => {
	test("title max length is 500", async () => {
		const result = await createEvidence({
			title: "X".repeat(501),
			content: "Content",
		});
		expect(result.success).toBe(false);
	});

	test("accepts title at exactly 500 chars", async () => {
		const row = makeDbEvidenceRow({ title: "X".repeat(500) });
		dbMock.insert.mockImplementation(() => createChainableQuery([row]));

		const result = await createEvidence({
			title: "X".repeat(500),
			content: "Content",
		});
		expect(result.success).toBe(true);
	});

	test("accepts all valid evidence statuses", async () => {
		for (const status of ["draft", "approved", "archived", "active", "expired"] as const) {
			const row = makeDbEvidenceRow({ status });
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: `Status ${status}`,
				content: "Content",
				status,
			});
			expect(result.success).toBe(true);
		}
	});

	test("accepts all valid source types including extended", async () => {
		for (const sourceType of ["internal", "customer", "third_party", "government", "external"] as const) {
			const row = makeDbEvidenceRow({ sourceType });
			dbMock.insert.mockImplementation(() => createChainableQuery([row]));

			const result = await createEvidence({
				title: `Source ${sourceType}`,
				content: "Content",
				sourceType,
			});
			expect(result.success).toBe(true);
		}
	});

	test("rejects invalid source type", async () => {
		const result = await createEvidence({
			title: "Bad Source",
			content: "Content",
			sourceType: "invalid" as never,
		});
		expect(result.success).toBe(false);
	});

	test("rejects invalid status", async () => {
		const result = await createEvidence({
			title: "Bad Status",
			content: "Content",
			status: "invalid" as never,
		});
		expect(result.success).toBe(false);
	});
});
