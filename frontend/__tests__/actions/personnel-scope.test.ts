import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

function createChainableQuery(returnValue: unknown = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "orderBy", "limit", "offset", "values", "returning"]) {
		chain[method] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(
		Array.isArray(returnValue) ? returnValue : [returnValue]
	);
	(chain as Record<string, unknown>).then = (resolve: (value: unknown) => void) =>
		Promise.resolve(Array.isArray(returnValue) ? returnValue : [returnValue]).then(resolve);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
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

vi.mock("@/lib/db/schema-personnel", () => ({
	personnel: {
		id: "p.id",
		firstName: "p.firstName",
		lastName: "p.lastName",
		currentTitle: "p.currentTitle",
		professionalSummary: "p.professionalSummary",
		email: "p.email",
		department: "p.department",
		employmentType: "p.employmentType",
		clearanceLevel: "p.clearanceLevel",
		availability: "p.availability",
		yearsOfExperience: "p.yearsOfExperience",
		isActive: "p.isActive",
		updatedAt: "p.updatedAt",
	},
	personnelExperience: {},
	personnelAvailability: {},
	positionRequirements: {
		id: "pr.id",
		opportunityId: "pr.opportunityId",
		positionTitle: "pr.positionTitle",
		positionCategory: "pr.positionCategory",
		assignedPersonnelId: "pr.assignedPersonnelId",
	},
	skillsTaxonomy: {},
	resumeTemplates: {},
}));

vi.mock("@/lib/ai/client", () => ({
	complete: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
	analyzeStaffingGaps,
	generateOrgChart,
	generateStaffingMatrix,
	getPositionsForOpportunity,
	searchPersonnel,
} from "@/lib/actions/personnel";

describe("personnel opportunity scoping", () => {
	const opportunityId = "00000000-0000-4000-8000-000000000001";

	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("staffing-user-1");
		dbMock.select.mockImplementation(() => createChainableQuery([]));
		dbMock.insert.mockImplementation(() => createChainableQuery([]));
		dbMock.update.mockImplementation(() => createChainableQuery([]));
		dbMock.delete.mockImplementation(() => createChainableQuery([]));
	});

	it("scopes staffing gap positions by assigned opportunity", async () => {
		let where: unknown;
		const chain = createChainableQuery([]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await analyzeStaffingGaps(opportunityId);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes org chart positions by assigned opportunity", async () => {
		let where: unknown;
		const chain = createChainableQuery([]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await generateOrgChart(opportunityId);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes staffing matrix positions by assigned opportunity", async () => {
		let where: unknown;
		const chain = createChainableQuery([]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await generateStaffingMatrix(opportunityId);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes position listing by assigned opportunity", async () => {
		let where: unknown;
		const chain = createChainableQuery([]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await getPositionsForOpportunity(opportunityId);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
	});

	it("normalizes personnel search pagination before querying", async () => {
		const chain = createChainableQuery([]);
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await searchPersonnel("ada", { limit: -20, offset: -5 });

		expect(result.success).toBe(true);
		expect(chain.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(1);
		expect(chain.offset as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(0);
	});
});
