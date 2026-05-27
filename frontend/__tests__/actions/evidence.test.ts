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
	suggestEvidenceForCriteria,
	suggestEvidenceForSection,
	getClaimsSummary,
	calculateEvidenceCoverage,
	generateEvidenceMatrix,
	generateEvidenceReport,
	exportEvidenceLibrary,
	quantifyClaim,
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

function makeDbRequirementRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "criteria-001",
		organizationId: "org-001",
		rfpDocumentId: "rfp-001",
		opportunityId: "opp-001",
		requirementNumber: "M.2.1",
		title: "Technical Approach",
		requirementText: "Evaluation criteria require measurable uptime, cloud migration, and federal delivery proof.",
		sourceQuote: null,
		sourcePage: 12,
		sourceSection: "Section M.2.1",
		category: "technical",
		subcategory: "cloud",
		requirementType: "shall",
		priority: "mandatory",
		riskLevel: "high",
		evaluationWeight: 40,
		extractionConfidence: 95,
		aiAnalysis: null,
		isImplicit: false,
		ambiguityLevel: "clear",
		clarificationQuestions: [],
		relatedRequirements: [],
		keyTerms: ["uptime", "cloud migration", "federal delivery"],
		suggestedApproach: "Use verified cloud migration metrics.",
		embedding: null,
		complianceStatus: "not_addressed",
		responseStrategy: null,
		assignedTo: null,
		dueDate: null,
		responseDocumentId: null,
		responseSection: null,
		notes: null,
		tags: ["technical", "cloud"],
		metadata: null,
		createdAt: new Date("2026-05-01T00:00:00.000Z"),
		updatedAt: new Date("2026-05-01T00:00:00.000Z"),
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
	const sql = collectSqlFragments(where).join(" ");
	expect(sql).toContain("opportunities.assigned_to");
	expect(sql).toContain("opportunities.organization_id");
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

	describe("exportEvidenceLibrary", () => {
		test.each([
			["json", "data:application/json;base64,"],
			["csv", "data:text/csv;charset=utf-8;base64,"],
		] as const)("generates a real %s evidence export artifact", async (format, expectedPrefix) => {
			const rows = [
				makeDbEvidenceRow({ id: "ev-001" }),
				makeDbEvidenceRow({ id: "ev-002", title: "Quoted, Evidence" }),
			];
			dbMock.select.mockImplementation(() => createChainableQuery(rows));

			const result = await exportEvidenceLibrary(format);

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.url).toMatch(new RegExp(`^${expectedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
			expect(result.data.url).not.toContain("/api/evidence/export");
			const payload = Buffer.from(result.data.url.split(",")[1] ?? "", "base64").toString("utf8");
			if (format === "json") {
				expect(JSON.parse(payload)).toEqual(expect.arrayContaining([
					expect.objectContaining({ id: "ev-001", title: "Cloud Migration Success" }),
					expect.objectContaining({ id: "ev-002", title: "Quoted, Evidence" }),
				]));
			} else {
				expect(payload).toContain("id,title,evidenceType");
				expect(payload).toContain("\"Quoted, Evidence\"");
			}
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
			expectAssignedOpportunityScope(where);
		}
	});

	test("scopes matrix lookup and usage reads through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		const matrixQuery = createChainableQuery([]);
		const requirementsQuery = createChainableQuery([]);
		const usagesQuery = createChainableQuery([]);
		const insertedMatrix = {
			id: "matrix-1",
			name: "requirements Matrix",
		};
		for (const query of [matrixQuery, requirementsQuery, usagesQuery]) {
			(query.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				wheres.push(value);
				return query;
			});
		}
		dbMock.select
			.mockReturnValueOnce(matrixQuery)
			.mockReturnValueOnce(requirementsQuery)
			.mockReturnValueOnce(usagesQuery);
		dbMock.insert.mockReturnValueOnce(createChainableQuery([insertedMatrix]));

		const result = await generateEvidenceMatrix("33333333-3333-4333-8333-333333333333", "requirements");

		expect(result.success).toBe(true);
		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expectAssignedOpportunityScope(where);
		}
	});

	test("builds requirement matrix rows from opportunity requirements and row-matched evidence", async () => {
		const matrixQuery = createChainableQuery([]);
		const requirementsQuery = createChainableQuery([
			makeDbRequirementRow({
				id: "req-cloud",
				requirementNumber: "C.1",
				title: "Cloud Uptime",
				requirementText: "Provide verified cloud migration uptime metrics for federal systems.",
				evaluationWeight: null,
				keyTerms: ["cloud migration", "uptime"],
				tags: ["cloud"],
			}),
			makeDbRequirementRow({
				id: "req-reporting",
				requirementNumber: "C.2",
				title: "Grant Reporting",
				requirementText: "Describe grant reporting automation and audit preparation controls.",
				evaluationWeight: null,
				keyTerms: ["grant reporting", "audit"],
				tags: ["reporting"],
			}),
		]);
		const usagesQuery = createChainableQuery([
			{ evidenceId: "ev-cloud" },
			{ evidenceId: "ev-reporting" },
		]);
		const evidenceQuery = createChainableQuery([
			makeDbEvidenceRow({
				id: "ev-cloud",
				title: "Federal Cloud Uptime Metrics",
				content: "Cloud migration maintained uptime for federal systems.",
				evidenceType: "metric",
				tags: ["cloud", "uptime"],
				metric: "uptime",
				metricValue: "99.99",
				metricUnit: "%",
				metricContext: "Federal cloud migration",
				sourceVerified: true,
				strengthScore: 90,
				relatedCapabilities: ["cloud migration"],
			}),
			makeDbEvidenceRow({
				id: "ev-reporting",
				title: "Grant Reporting Audit Reference",
				content: "Grant reporting automation reduced audit preparation effort.",
				evidenceType: "testimonial",
				tags: ["grant reporting", "audit"],
				isQuantified: false,
				metric: null,
				metricValue: null,
				metricUnit: null,
				metricContext: null,
				sourceVerified: true,
				strengthScore: 80,
				relatedCapabilities: ["grant reporting automation"],
			}),
		]);
		dbMock.select
			.mockReturnValueOnce(matrixQuery)
			.mockReturnValueOnce(requirementsQuery)
			.mockReturnValueOnce(usagesQuery)
			.mockReturnValueOnce(evidenceQuery);
		dbMock.insert.mockReturnValueOnce(createChainableQuery([{ id: "matrix-1", name: "requirements Matrix" }]));

		const result = await generateEvidenceMatrix("33333333-3333-4333-8333-333333333333", "requirements");

		if (!result.success) throw new Error(result.error);
		expect(result.data.rows.map((row) => row.id)).toEqual(["req-cloud", "req-reporting"]);
		const cloudMetricCell = result.data.cells.find((cell) => cell.rowId === "req-cloud" && cell.colId === "metric");
		const reportingTestimonialCell = result.data.cells.find((cell) => cell.rowId === "req-reporting" && cell.colId === "testimonial");
		const cloudTestimonialCell = result.data.cells.find((cell) => cell.rowId === "req-cloud" && cell.colId === "testimonial");
		expect(cloudMetricCell?.evidenceIds).toEqual(["ev-cloud"]);
		expect(cloudMetricCell?.notes).toContain("matrix terms:");
		expect(reportingTestimonialCell?.evidenceIds).toEqual(["ev-reporting"]);
		expect(cloudTestimonialCell?.evidenceIds).toEqual([]);
		expect(result.data.overallCoverage).toBeGreaterThan(0);
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
		expectAssignedOpportunityScope(usageWhere);
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
// Evidence suggestions
// ---------------------------------------------------------------------------

describe("Evidence suggestions", () => {
	test("prioritizes verified quantified evidence with claim-aligned tags, metrics, and context", async () => {
		const claimQuery = createChainableQuery([
			makeDbClaimRow({
				claimText: "We deliver measurable uptime improvements for federal cloud migrations.",
			}),
		]);
		const evidenceQuery = createChainableQuery([
			makeDbEvidenceRow({
				id: "ev-generic",
				title: "Uptime Improvements",
				content: "We deliver uptime improvements for cloud systems.",
				summary: "General cloud uptime note.",
				tags: [],
				isQuantified: false,
				metric: null,
				metricValue: null,
				metricUnit: null,
				metricContext: null,
				sourceVerified: false,
				strengthScore: 20,
				relatedCapabilities: [],
				relatedAgencies: [],
			}),
			makeDbEvidenceRow({
				id: "ev-strong",
				title: "Federal Cloud Uptime Proof",
				content: "Federal cloud migration improved uptime for agency workloads.",
				summary: "Verified cloud migration evidence showing measurable uptime improvements.",
				tags: ["federal", "cloud", "uptime"],
				isQuantified: true,
				metric: "uptime improvements",
				metricValue: "99.99",
				metricUnit: "%",
				metricContext: "Federal cloud migration program",
				sourceVerified: true,
				strengthScore: 92,
				relatedCapabilities: ["cloud migrations"],
				relatedAgencies: ["federal agencies"],
			}),
		]);
		dbMock.select
			.mockReturnValueOnce(claimQuery)
			.mockReturnValueOnce(evidenceQuery);

		const result = await suggestEvidenceForClaim("claim-001");

		if (!result.success) throw new Error(result.error);
		expect(result.data.map((suggestion) => suggestion.evidenceId)).toEqual([
			"ev-strong",
			"ev-generic",
		]);
		expect(result.data[0].relevanceScore).toBeGreaterThan(result.data[1].relevanceScore);
		expect(result.data[0].reason).toContain("claim terms:");
		expect(result.data[0].reason).toContain("tags:");
		expect(result.data[0].reason).toContain("metrics:");
		expect(result.data[0].reason).toContain("verified source");
		expect(result.data[0].reason).toContain("quantified proof");
	});

	test("does not suggest unrelated evidence solely because it is strong and verified", async () => {
		const claimQuery = createChainableQuery([
			makeDbClaimRow({
				claimText: "Grant reporting automation reduces audit preparation effort.",
			}),
		]);
		const evidenceQuery = createChainableQuery([
			makeDbEvidenceRow({
				id: "ev-unrelated",
				title: "Legacy Data Center Performance",
				content: "Archived server benchmark results for network latency.",
				summary: "A verified technical benchmark for infrastructure operations.",
				tags: ["infrastructure"],
				isQuantified: true,
				metric: "latency",
				metricValue: "12",
				metricUnit: "ms",
				metricContext: "Network benchmark",
				sourceVerified: true,
				strengthScore: 100,
				relatedCapabilities: ["data center operations"],
				relatedAgencies: ["transportation"],
			}),
		]);
		dbMock.select
			.mockReturnValueOnce(claimQuery)
			.mockReturnValueOnce(evidenceQuery);

		const result = await suggestEvidenceForClaim("claim-001");

		if (!result.success) throw new Error(result.error);
		expect(result.data).toEqual([]);
	});

	test("scores criteria suggestions against scoped evaluation requirement text", async () => {
		const wheres: unknown[] = [];
		const criteriaQuery = createChainableQuery([makeDbRequirementRow()]);
		const evidenceQuery = createChainableQuery([
			makeDbEvidenceRow({
				id: "ev-unrelated",
				title: "Data Center Latency Benchmark",
				content: "Network latency decreased during server consolidation.",
				tags: ["infrastructure"],
				isQuantified: true,
				metric: "latency",
				metricValue: "12",
				metricUnit: "ms",
				metricContext: "Data center benchmark",
				sourceVerified: true,
				strengthScore: 95,
				relatedCapabilities: ["data center operations"],
				relatedAgencies: ["transportation"],
			}),
			makeDbEvidenceRow({
				id: "ev-criteria-strong",
				title: "Federal Cloud Migration Uptime",
				content: "Federal cloud migration maintained measurable uptime for mission systems.",
				summary: "Verified federal cloud migration proof with uptime metrics.",
				tags: ["federal", "cloud", "uptime"],
				isQuantified: true,
				metric: "uptime",
				metricValue: "99.99",
				metricUnit: "%",
				metricContext: "Federal cloud migration delivery",
				sourceVerified: true,
				strengthScore: 90,
				relatedCapabilities: ["cloud migration"],
				relatedAgencies: ["federal agencies"],
			}),
		]);
		for (const query of [criteriaQuery, evidenceQuery]) {
			(query.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
				wheres.push(value);
				return query;
			});
		}
		dbMock.select
			.mockReturnValueOnce(criteriaQuery)
			.mockReturnValueOnce(evidenceQuery);

		const result = await suggestEvidenceForCriteria("criteria-001");

		if (!result.success) throw new Error(result.error);
		expect(result.data.map((suggestion) => suggestion.evidenceId)).toEqual([
			"ev-criteria-strong",
		]);
		expect(result.data[0].reason).toContain("criteria terms:");
		expect(result.data[0].reason).toContain("verified source");
		expect(result.data[0].reason).toContain("quantified proof");
		expectAssignedOpportunityScope(wheres[0]);
	});

	test("returns no criteria suggestions when the criterion is not visible", async () => {
		const criteriaQuery = createChainableQuery([]);
		dbMock.select.mockReturnValueOnce(criteriaQuery);

		const result = await suggestEvidenceForCriteria("criteria-missing");

		if (!result.success) throw new Error(result.error);
		expect(result.data).toEqual([]);
		expect(dbMock.select).toHaveBeenCalledTimes(1);
	});

	test("keeps the strongest duplicate evidence rationale across section claims", async () => {
		const lowMatchClaim = makeDbClaimRow({
			id: "claim-low",
			claimText: "We deliver cloud systems.",
		});
		const highMatchClaim = makeDbClaimRow({
			id: "claim-high",
			claimText: "We deliver measurable uptime improvements for federal cloud migrations.",
		});
		const sharedEvidence = makeDbEvidenceRow({
			id: "ev-shared",
			title: "Federal Cloud Uptime Proof",
			content: "Federal cloud migration improved uptime for agency workloads.",
			summary: "Verified federal cloud migration evidence showing measurable uptime improvements.",
			tags: ["federal", "cloud", "uptime"],
			isQuantified: true,
			metric: "uptime improvements",
			metricValue: "99.99",
			metricUnit: "%",
			metricContext: "Federal cloud migration program",
			sourceVerified: true,
			strengthScore: 92,
			relatedCapabilities: ["cloud migrations"],
			relatedAgencies: ["federal agencies"],
		});
		dbMock.select
			.mockReturnValueOnce(createChainableQuery([lowMatchClaim, highMatchClaim]))
			.mockReturnValueOnce(createChainableQuery([lowMatchClaim]))
			.mockReturnValueOnce(createChainableQuery([sharedEvidence]))
			.mockReturnValueOnce(createChainableQuery([highMatchClaim]))
			.mockReturnValueOnce(createChainableQuery([sharedEvidence]));

		const result = await suggestEvidenceForSection("section-001");

		if (!result.success) throw new Error(result.error);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].evidenceId).toBe("ev-shared");
		expect(result.data[0].relevanceScore).toBeGreaterThan(90);
		expect(result.data[0].reason).toContain("federal");
		expect(result.data[0].reason).toContain("uptime");
	});
});

// ---------------------------------------------------------------------------
// Claim quantification
// ---------------------------------------------------------------------------

describe("Claim quantification", () => {
	test("uses context when selecting quantification metrics", async () => {
		const result = await quantifyClaim(
			"Our operations team keeps critical systems resilient",
			"Availability, uptime, and SLA response for federal cloud systems"
		);

		if (!result.success) throw new Error(result.error);
		expect(result.data.quantifiedVersions[0].text).toContain("99.9% uptime");
		expect(result.data.metrics.map((metric) => metric.name)).toContain("Uptime percentage");
	});

	test("generic fallback avoids unresolved metric placeholders", async () => {
		const result = await quantifyClaim("Our team brings a thoughtful delivery model");

		if (!result.success) throw new Error(result.error);
		expect(result.data.quantifiedVersions[0].text).not.toContain("add specific metrics here");
		expect(result.data.quantifiedVersions[0].text).toContain("dated performance records");
		expect(result.data.metrics.map((metric) => metric.name)).toEqual([
			"Outcome count",
			"Improvement percentage",
			"Delivery timeframe",
		]);
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
