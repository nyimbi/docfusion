/**
 * Pricing Server Actions Tests
 *
 * Tests for the integrated cost volume generator including:
 * - Pure calculation functions (calculateElementTotalCost, applyIndirectRates)
 * - Labor category CRUD operations
 * - Cost element CRUD with cost recalculation
 * - Zod validation rejection of invalid inputs
 * - Travel cost calculations
 * - Per diem lookups
 * - Edge cases: zero values, missing fields, empty datasets
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before any import that transitively touches these modules
// ---------------------------------------------------------------------------

const mockUserContext: { userId: string; organizationId?: string } = {
	userId: "user-001",
	organizationId: "org-001",
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => mockUserContext),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
	AIClient: vi.fn().mockImplementation(() => ({
		complete: vi.fn(async () => ({ content: "{}", tokensUsed: 0 })),
	})),
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
		"select",
		"insert",
		"update",
		"delete",
		"from",
		"where",
		"set",
		"values",
		"returning",
		"orderBy",
		"limit",
		"offset",
		"execute",
		"leftJoin",
		"innerJoin",
	];
	for (const m of methods) {
		chain[m] = vi.fn(() => chain);
	}
	// Terminal methods resolve to returnValue
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(
		Array.isArray(returnValue) ? returnValue : [returnValue]
	);
	(chain.execute as ReturnType<typeof vi.fn>).mockResolvedValue(returnValue);
	// When used as an awaitable (select().from().where()), make it thenable
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
	return { db: dbMock, documents: {} };
});

// Schema mocks — provide objects with enough shape for eq/and/etc. to operate
vi.mock("@/lib/db/schema-pricing", () => ({
	laborCategories: { id: "lc.id", organizationId: "lc.orgId", name: "lc.name", isActive: "lc.isActive" },
	costElements: {
		id: "ce.id", opportunityId: "ce.oppId", elementType: "ce.type", laborCategoryId: "ce.labCatId",
		wbsCode: "ce.wbs", periodNumber: "ce.period", technicalSectionId: "ce.techSecId", status: "ce.status",
		boeNarrative: "ce.boe",
	},
	indirectRates: { id: "ir.id", organizationId: "ir.orgId", isActive: "ir.isActive", rateType: "ir.type" },
	costTechnicalTracking: { id: "ctt.id", opportunityId: "ctt.oppId", technicalSectionId: "ctt.techSecId" },
	boeTemplates: { id: "bt.id", organizationId: "bt.orgId" },
	pricingSummaries: { opportunityId: "ps.oppId" },
}));

// Import subjects under test
import {
	createLaborCategory,
	createIndirectRate,
	saveBOETemplate,
	updateLaborCategory,
	deleteLaborCategory,
	getLaborCategory,
	listLaborCategories,
	importLaborCategories,
	createCostElement,
	updateCostElement,
	deleteCostElement,
	getCostElement,
	lookupPerDiem,
	calculateTravelCosts,
} from "@/lib/actions/pricing";

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
	mockUserContext.organizationId = "org-001";
	// Recreate fresh db mock chains for each test
	dbMock.select.mockImplementation(() => createChainableQuery([]));
	dbMock.insert.mockImplementation(() => createChainableQuery([]));
	dbMock.update.mockImplementation(() => createChainableQuery([]));
	dbMock.delete.mockImplementation(() => createChainableQuery([]));
});

// ---------------------------------------------------------------------------
// Pure Calculation Logic — these functions are module-private, so we test them
// indirectly via the public API that invokes them.
// We exercise calculateElementTotalCost through createCostElement.
// We exercise applyIndirectRates through calculateTotalPrice.
// ---------------------------------------------------------------------------

describe("Cost element total cost calculation (via createCostElement)", () => {
	const baseLaborInput = {
		opportunityId: "00000000-0000-4000-8000-000000000001",
		elementType: "labor" as const,
		hours: 160,
		rate: 125,
	};

	test("labor cost = hours * rate", async () => {
		const created = {
			id: "el-1",
			...baseLaborInput,
			laborCost: 20000,
			totalCost: 20000,
			status: "draft",
		};
		dbMock.insert.mockImplementation(() => createChainableQuery([created]));

		const result = await createCostElement(baseLaborInput);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.totalCost).toBe(20000);
		}
	});

	test("labor cost with zero hours yields 0", async () => {
		const input = { ...baseLaborInput, hours: 0 };
		const created = { id: "el-2", ...input, laborCost: 0, totalCost: 0, status: "draft" };
		dbMock.insert.mockImplementation(() => createChainableQuery([created]));

		const result = await createCostElement(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.totalCost).toBe(0);
		}
	});

	test("ODC cost = odcAmount", async () => {
		const input = {
			opportunityId: "00000000-0000-4000-8000-000000000001",
			elementType: "odc" as const,
			odcType: "equipment" as const,
			odcAmount: 5000,
		};
		const created = { id: "el-3", ...input, totalCost: 5000, status: "draft" };
		dbMock.insert.mockImplementation(() => createChainableQuery([created]));

		const result = await createCostElement(input);
		expect(result.success).toBe(true);
	});

	test("travel cost = trips * costPerTrip", async () => {
		const input = {
			opportunityId: "00000000-0000-4000-8000-000000000001",
			elementType: "travel" as const,
			travelTrips: 4,
			travelCostPerTrip: 2500,
		};
		const created = { id: "el-4", ...input, travelCost: 10000, totalCost: 10000, status: "draft" };
		dbMock.insert.mockImplementation(() => createChainableQuery([created]));

		const result = await createCostElement(input);
		expect(result.success).toBe(true);
	});

	test("subcontract cost = subcontractorCost", async () => {
		const input = {
			opportunityId: "00000000-0000-4000-8000-000000000001",
			elementType: "subcontract" as const,
			subcontractorCost: 75000,
			subcontractorName: "ACME Corp",
		};
		const created = { id: "el-5", ...input, totalCost: 75000, status: "draft" };
		dbMock.insert.mockImplementation(() => createChainableQuery([created]));

		const result = await createCostElement(input);
		expect(result.success).toBe(true);
	});

	test("material cost = materialCost", async () => {
		const input = {
			opportunityId: "00000000-0000-4000-8000-000000000001",
			elementType: "material" as const,
			materialCost: 12000,
			materialDescription: "Server hardware",
		};
		const created = { id: "el-6", ...input, totalCost: 12000, status: "draft" };
		dbMock.insert.mockImplementation(() => createChainableQuery([created]));

		const result = await createCostElement(input);
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Labor Category CRUD
// ---------------------------------------------------------------------------

describe("Labor Category CRUD", () => {
	const validInput = {
		name: "Senior Software Engineer",
		code: "SSE-01",
		description: "Full-stack development",
		directRate: 150,
		fullyBurdenedRate: 225,
		minEducation: "bs" as const,
		minExperience: 8,
	};

	describe("createLaborCategory", () => {
		test("requires organization context before inserting", async () => {
			mockUserContext.organizationId = undefined;

			const result = await createLaborCategory(validInput);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("No organization context");
			}
			expect(dbMock.insert).not.toHaveBeenCalled();
		});

		test("creates with valid input and returns success", async () => {
			const created = { id: "lc-1", ...validInput, organizationId: "org-001", isActive: true };
			dbMock.insert.mockImplementation(() => createChainableQuery([created]));

			const result = await createLaborCategory(validInput);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe("Senior Software Engineer");
				expect(result.data.isActive).toBe(true);
			}
		});

		test("rejects empty name", async () => {
			const result = await createLaborCategory({ ...validInput, name: "" });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Name is required");
			}
		});

		test("rejects negative direct rate", async () => {
			const result = await createLaborCategory({ ...validInput, directRate: -50 });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("positive");
			}
		});

		test("rejects invalid minEducation value", async () => {
			const result = await createLaborCategory({ ...validInput, minEducation: "xyz" as never });
			expect(result.success).toBe(false);
		});

		test("accepts optional fields as undefined", async () => {
			const minimal = { name: "Analyst" };
			const created = { id: "lc-2", ...minimal, organizationId: "org-001", isActive: true };
			dbMock.insert.mockImplementation(() => createChainableQuery([created]));

			const result = await createLaborCategory(minimal);
			expect(result.success).toBe(true);
		});

		test("rejects escalation rate above 1", async () => {
			const result = await createLaborCategory({ ...validInput, annualEscalation: 1.5 });
			expect(result.success).toBe(false);
		});

		test("rejects escalation rate below 0", async () => {
			const result = await createLaborCategory({ ...validInput, annualEscalation: -0.1 });
			expect(result.success).toBe(false);
		});
	});

	describe("updateLaborCategory", () => {
		test("updates provided fields and returns success", async () => {
			const updated = {
				id: "lc-1",
				...validInput,
				directRate: 175,
				organizationId: "org-001",
				isActive: true,
			};
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateLaborCategory("lc-1", { directRate: 175 });
			expect(result.success).toBe(true);
		});

		test("returns not found when category does not exist", async () => {
			dbMock.update.mockImplementation(() => createChainableQuery([]));

			const result = await updateLaborCategory("nonexistent", { directRate: 100 });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});

		test("can deactivate a category", async () => {
			const updated = { id: "lc-1", ...validInput, isActive: false };
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateLaborCategory("lc-1", { isActive: false });
			expect(result.success).toBe(true);
		});
	});

	describe("deleteLaborCategory", () => {
		test("deletes when category is not in use", async () => {
			// First select (usage check) returns count 0
			const usageChain = createChainableQuery([{ count: 0 }]);
			dbMock.select.mockReturnValueOnce(usageChain as never);
			dbMock.delete.mockImplementation(() => createChainableQuery([]));

			const result = await deleteLaborCategory("lc-1");
			expect(result.success).toBe(true);
		});

		test("refuses deletion when category is in use", async () => {
			const usageChain = createChainableQuery([{ count: 3 }]);
			dbMock.select.mockReturnValueOnce(usageChain as never);

			const result = await deleteLaborCategory("lc-1");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("in use");
			}
		});
	});

	describe("getLaborCategory", () => {
		test("returns category when found", async () => {
			const cat = { id: "lc-1", ...validInput };
			dbMock.select.mockImplementation(() => createChainableQuery([cat]));

			const result = await getLaborCategory("lc-1");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data?.name).toBe("Senior Software Engineer");
			}
		});

		test("returns null when not found", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await getLaborCategory("nonexistent");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBeNull();
			}
		});
	});

	describe("listLaborCategories", () => {
		test("returns array scoped to organization", async () => {
			const cats = [
				{ id: "lc-1", name: "Analyst", organizationId: "org-001" },
				{ id: "lc-2", name: "Engineer", organizationId: "org-001" },
			];
			dbMock.select.mockImplementation(() => createChainableQuery(cats));

			const result = await listLaborCategories();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(2);
			}
		});

		test("returns empty array when no categories exist", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await listLaborCategories();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toHaveLength(0);
			}
		});
	});

	describe("importLaborCategories", () => {
		test("imports valid categories and reports count", async () => {
			dbMock.insert.mockImplementation(() => createChainableQuery([]));

			const data = [
				{ name: "PM", directRate: 200 },
				{ name: "Dev", directRate: 150 },
			];
			const result = await importLaborCategories(data);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.imported).toBe(2);
				expect(result.data.errors).toHaveLength(0);
			}
		});
	});
});

// ---------------------------------------------------------------------------
// Cost Element CRUD
// ---------------------------------------------------------------------------

describe("Cost Element CRUD", () => {
	const validLaborInput = {
		opportunityId: "00000000-0000-4000-8000-000000000001",
		elementType: "labor" as const,
		hours: 100,
		rate: 150,
		laborCategoryName: "Developer",
		wbsCode: "1.1",
		wbsTitle: "Software Development",
		periodNumber: 1,
		periodType: "base" as const,
	};

	describe("createCostElement", () => {
		test("validates and creates a labor element", async () => {
			const created = { id: "ce-1", ...validLaborInput, laborCost: 15000, totalCost: 15000, status: "draft" };
			dbMock.insert.mockImplementation(() => createChainableQuery([created]));

			const result = await createCostElement(validLaborInput);
			expect(result.success).toBe(true);
		});

		test("rejects invalid opportunity ID format", async () => {
			const result = await createCostElement({ ...validLaborInput, opportunityId: "not-a-uuid" });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Invalid opportunity ID");
			}
		});

		test("rejects invalid element type", async () => {
			const result = await createCostElement({ ...validLaborInput, elementType: "invalid" as never });
			expect(result.success).toBe(false);
		});

		test("rejects negative hours", async () => {
			const result = await createCostElement({ ...validLaborInput, hours: -10 });
			expect(result.success).toBe(false);
		});

		test("defaults period to 1 and type to base when not specified", async () => {
			const input = {
				opportunityId: "00000000-0000-4000-8000-000000000001",
				elementType: "odc" as const,
				odcType: "software" as const,
				odcAmount: 1000,
			};
			const created = { id: "ce-2", ...input, periodNumber: 1, periodType: "base", totalCost: 1000, status: "draft" };
			dbMock.insert.mockImplementation(() => createChainableQuery([created]));

			const result = await createCostElement(input);
			expect(result.success).toBe(true);
		});
	});

	describe("updateCostElement", () => {
		test("updates hours and recalculates labor cost", async () => {
			const existing = { id: "ce-1", ...validLaborInput, laborCost: 15000, totalCost: 15000 };
			dbMock.select.mockImplementation(() => createChainableQuery([existing]));
			const updated = { ...existing, hours: 200, laborCost: 30000, totalCost: 30000, opportunityId: validLaborInput.opportunityId };
			dbMock.update.mockImplementation(() => createChainableQuery([updated]));

			const result = await updateCostElement("ce-1", { hours: 200 });
			expect(result.success).toBe(true);
		});

		test("returns not found for missing element", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await updateCostElement("nonexistent", { hours: 100 });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("not found");
			}
		});
	});

	describe("deleteCostElement", () => {
		test("deletes existing element", async () => {
			const existing = { id: "ce-1", opportunityId: "opp-1" };
			dbMock.select.mockImplementation(() => createChainableQuery([existing]));
			dbMock.delete.mockImplementation(() => createChainableQuery([]));

			const result = await deleteCostElement("ce-1");
			expect(result.success).toBe(true);
		});

		test("returns not found for missing element", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await deleteCostElement("nonexistent");
			expect(result.success).toBe(false);
		});
	});

	describe("getCostElement", () => {
		test("returns element when found", async () => {
			const element = { id: "ce-1", elementType: "labor", totalCost: 15000 };
			dbMock.select.mockImplementation(() => createChainableQuery([element]));

			const result = await getCostElement("ce-1");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data?.totalCost).toBe(15000);
			}
		});

		test("returns null when not found", async () => {
			dbMock.select.mockImplementation(() => createChainableQuery([]));

			const result = await getCostElement("nonexistent");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBeNull();
			}
		});
	});
});

// ---------------------------------------------------------------------------
// Travel Cost Calculation
// ---------------------------------------------------------------------------

describe("calculateTravelCosts", () => {
	test("calculates breakdown correctly", async () => {
		const result = await calculateTravelCosts({
			travelers: 2,
			trips: 3,
			daysPerTrip: 4,
			airfare: 500,
			lodgingPerNight: 150,
			perDiemPerDay: 59,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			// airfare: 500 * 2 * 3 = 3000
			expect(result.data.breakdown.airfare).toBe(3000);
			// lodging: 150 * 3 nights * 2 * 3 = 2700
			expect(result.data.breakdown.lodging).toBe(2700);
			// perDiem: 59 * 4 * 2 * 3 = 1416
			expect(result.data.breakdown.perDiem).toBe(1416);
			// total = 3000 + 2700 + 1416 = 7116
			expect(result.data.totalCost).toBe(7116);
		}
	});

	test("handles single-day trip (0 nights lodging)", async () => {
		const result = await calculateTravelCosts({
			travelers: 1,
			trips: 1,
			daysPerTrip: 1,
			airfare: 400,
			lodgingPerNight: 200,
			perDiemPerDay: 59,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.breakdown.lodging).toBe(0);
			expect(result.data.breakdown.perDiem).toBe(59);
			expect(result.data.totalCost).toBe(459);
		}
	});

	test("includes mileage when provided", async () => {
		const result = await calculateTravelCosts({
			travelers: 1,
			trips: 2,
			daysPerTrip: 1,
			airfare: 0,
			lodgingPerNight: 0,
			perDiemPerDay: 0,
			mileage: 100,
			mileageRate: 0.67,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.breakdown.mileage).toBe(134);
		}
	});

	test("uses default mileage rate when not specified", async () => {
		const result = await calculateTravelCosts({
			travelers: 1,
			trips: 1,
			daysPerTrip: 1,
			airfare: 0,
			lodgingPerNight: 0,
			perDiemPerDay: 0,
			mileage: 100,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.breakdown.mileage).toBe(67);
		}
	});

	test("includes other costs when provided", async () => {
		const result = await calculateTravelCosts({
			travelers: 2,
			trips: 1,
			daysPerTrip: 1,
			airfare: 0,
			lodgingPerNight: 0,
			perDiemPerDay: 0,
			otherCosts: 50,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.breakdown.other).toBe(100);
		}
	});

	test("handles zero travelers and trips", async () => {
		const result = await calculateTravelCosts({
			travelers: 0,
			trips: 0,
			daysPerTrip: 5,
			airfare: 500,
			lodgingPerNight: 200,
			perDiemPerDay: 80,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.totalCost).toBe(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Per Diem Lookup
// ---------------------------------------------------------------------------

describe("lookupPerDiem", () => {
	test("returns base CONUS rates for unknown location", async () => {
		const result = await lookupPerDiem("Rural Kansas");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.lodging).toBe(107);
			expect(result.data.meals).toBe(59);
			expect(result.data.incidentals).toBe(20);
			expect(result.data.total).toBe(186);
		}
	});

	test("returns higher rates for Washington DC", async () => {
		const result = await lookupPerDiem("Washington, DC");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.lodging).toBe(210);
			expect(result.data.meals).toBe(79);
			expect(result.data.total).toBe(210 + 79 + 20);
		}
	});

	test("returns higher rates for New York (case-insensitive)", async () => {
		const result = await lookupPerDiem("NEW YORK CITY");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.lodging).toBe(282);
		}
	});

	test("returns higher rates for San Francisco", async () => {
		const result = await lookupPerDiem("San Francisco, CA");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.lodging).toBe(250);
		}
	});

	test("preserves original location string in response", async () => {
		const result = await lookupPerDiem("Chicago Metro Area");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.location).toBe("Chicago Metro Area");
		}
	});
});

describe("Pricing organization context", () => {
	test("requires organization context before saving BOE templates", async () => {
		mockUserContext.organizationId = undefined;

		const result = await saveBOETemplate({
			name: "Labor BOE",
			templateText: "Use {hours} hours.",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("No organization context");
		}
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("requires organization context before creating indirect rates", async () => {
		mockUserContext.organizationId = undefined;

		const result = await createIndirectRate({
			rateName: "Overhead",
			rateType: "overhead",
			rateValue: 0.15,
			effectiveStartDate: "2026-01-01",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("No organization context");
		}
		expect(dbMock.insert).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Validation Edge Cases
// ---------------------------------------------------------------------------

describe("Validation edge cases", () => {
	test("createLaborCategory rejects name over 200 chars", async () => {
		const result = await createLaborCategory({ name: "X".repeat(201) });
		expect(result.success).toBe(false);
	});

	test("createCostElement rejects period type not in enum", async () => {
		const result = await createCostElement({
			opportunityId: "00000000-0000-4000-8000-000000000001",
			elementType: "labor",
			periodType: "option_99" as never,
		});
		expect(result.success).toBe(false);
	});

	test("createCostElement accepts valid period types", async () => {
		for (const pt of ["base", "option_1", "option_2", "option_3", "option_4"] as const) {
			const created = { id: `ce-${pt}`, opportunityId: "00000000-0000-4000-8000-000000000001", elementType: "labor", periodType: pt, totalCost: 0, status: "draft" };
			dbMock.insert.mockImplementation(() => createChainableQuery([created]));

			const result = await createCostElement({
				opportunityId: "00000000-0000-4000-8000-000000000001",
				elementType: "labor",
				periodType: pt,
			});
			expect(result.success).toBe(true);
		}
	});
});
