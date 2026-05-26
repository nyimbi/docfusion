import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());

function createChainableQuery(returnValue: unknown = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "set", "values", "returning"]) {
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
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
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
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		organizationId: "opportunities.organization_id",
		assignedTo: "opportunities.assignedTo",
		metadata: "opportunities.metadata",
	},
	opportunityVotes: {
		organizationId: "opportunityVotes.organization_id",
		opportunityId: "opportunityVotes.opportunityId",
	},
}));

import {
	deleteOpportunity,
	duplicateOpportunity,
	getOpportunityById,
	updateOpportunity,
} from "@/lib/actions/opportunities-crud";

describe("opportunities CRUD assigned-opportunity scoping", () => {
	const opportunityId = "00000000-0000-4000-8000-000000000001";
	const opportunityRow = {
		id: opportunityId,
		title: "Health data platform RFP",
		tags: [],
		priorityRank: 3,
		decisionStatus: "pending",
		opportunityType: "rfp",
		metadata: {},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("capture-user-1");
		requireUserContextMock.mockResolvedValue({
			userId: "capture-user-1",
			organizationId: "org-1",
			roles: [],
		});
		dbMock.select.mockImplementation(() => createChainableQuery([]));
		dbMock.insert.mockImplementation(() => createChainableQuery([]));
		dbMock.update.mockImplementation(() => createChainableQuery([]));
		dbMock.delete.mockImplementation(() => createChainableQuery([]));
	});

	it("scopes single opportunity reads by assignment", async () => {
		let where: unknown;
		const chain = createChainableQuery([opportunityRow]);
		(chain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			where = value;
			return chain;
		});
		dbMock.select.mockImplementationOnce(() => chain);

		const result = await getOpportunityById(opportunityId);

		expect(result?.id).toBe(opportunityId);
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assignedTo");
		expect(collectSqlFragments(where).join(" ")).toContain("opportunities.organization_id");
	});

	it("scopes metadata reads and updates by assignment", async () => {
		let metadataWhere: unknown;
		let updateWhere: unknown;
		const metadataChain = createChainableQuery([{ metadata: { existing: true } }]);
		(metadataChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			metadataWhere = value;
			return metadataChain;
		});
		const updateChain = createChainableQuery([{ ...opportunityRow, metadata: { existing: true, next: true } }]);
		(updateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateWhere = value;
			return updateChain;
		});
		dbMock.select.mockImplementationOnce(() => metadataChain);
		dbMock.update.mockImplementationOnce(() => updateChain);

		const result = await updateOpportunity(opportunityId, { metadata: { next: true } });

		expect(result.id).toBe(opportunityId);
		expect(collectSqlFragments(metadataWhere).join(" ")).toContain("opportunities.assignedTo");
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assignedTo");
		expect(collectSqlFragments(metadataWhere).join(" ")).toContain("opportunities.organization_id");
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.organization_id");
	});

	it("scopes opportunity and vote deletes by assignment", async () => {
		let votesWhere: unknown;
		let opportunityWhere: unknown;
		const votesDelete = createChainableQuery([]);
		(votesDelete.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			votesWhere = value;
			return votesDelete;
		});
		const opportunityDelete = createChainableQuery([]);
		(opportunityDelete.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			opportunityWhere = value;
			return opportunityDelete;
		});
		dbMock.delete
			.mockImplementationOnce(() => votesDelete)
			.mockImplementationOnce(() => opportunityDelete);

		await deleteOpportunity(opportunityId);

		expect(collectSqlFragments(votesWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assignedTo");
		expect(collectSqlFragments(votesWhere).join(" ")).toContain("opportunityVotes.organization_id");
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.organization_id");
	});

	it("scopes duplicate source and source vote reads by assignment", async () => {
		let sourceWhere: unknown;
		let votesWhere: unknown;
		const sourceChain = createChainableQuery([opportunityRow]);
		(sourceChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			sourceWhere = value;
			return sourceChain;
		});
		const votesChain = createChainableQuery([]);
		(votesChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			votesWhere = value;
			return votesChain;
		});
		dbMock.select
			.mockImplementationOnce(() => sourceChain)
			.mockImplementationOnce(() => votesChain);
		dbMock.insert.mockImplementationOnce(() => createChainableQuery([{ ...opportunityRow, id: "copy-1" }]));

		const result = await duplicateOpportunity(opportunityId);

		expect(result.id).toBe("copy-1");
		expect(collectSqlFragments(sourceWhere).join(" ")).toContain("opportunities.assignedTo");
		expect(collectSqlFragments(votesWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(collectSqlFragments(sourceWhere).join(" ")).toContain("opportunities.organization_id");
		expect(collectSqlFragments(votesWhere).join(" ")).toContain("opportunityVotes.organization_id");
	});
});
