import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.values = vi.fn(() => chain);
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") return [value];
	if (!value || typeof value !== "object") return [];
	if (seen.has(value)) return [];
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
	update: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: vi.fn(),
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		update: vi.fn(),
		insert: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/db/schema-personnel", () => ({
	personnel: {
		id: "personnel.id",
		organizationId: "personnel.organization_id",
		isActive: "personnel.is_active",
		firstName: "personnel.first_name",
		lastName: "personnel.last_name",
		email: "personnel.email",
		certifications: "personnel.certifications",
		updatedAt: "personnel.updated_at",
	},
	personnelExperience: {},
	personnelAvailability: {},
	positionRequirements: {},
	skillsTaxonomy: {},
	resumeTemplates: {},
}));

vi.mock("@/lib/ai/client", () => ({
	complete: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ op: "eq", left, right })),
	and: vi.fn((...conditions) => ({ op: "and", conditions })),
	or: vi.fn((...conditions) => ({ op: "or", conditions })),
	ilike: vi.fn((left, right) => ({ op: "ilike", left, right })),
	gte: vi.fn((left, right) => ({ op: "gte", left, right })),
	lte: vi.fn((left, right) => ({ op: "lte", left, right })),
	desc: vi.fn((field) => ({ op: "desc", field })),
	asc: vi.fn((field) => ({ op: "asc", field })),
	sql: vi.fn((strings, ...values) => ({ strings: Array.from(strings), values })),
	inArray: vi.fn((field, values) => ({ op: "inArray", field, values })),
	ne: vi.fn((left, right) => ({ op: "ne", left, right })),
	isNull: vi.fn((field) => ({ op: "isNull", field })),
	isNotNull: vi.fn((field) => ({ op: "isNotNull", field })),
}));

import { sendCertificationReminders } from "@/lib/actions/personnel";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "personnel-manager-1",
		organizationId: "org-1",
	});
});

describe("certification reminders", () => {
	it("returns zero without database work when no personnel IDs are provided", async () => {
		const result = await sendCertificationReminders([]);

		expect(result).toMatchObject({ success: true, data: { sent: 0 } });
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("records reminder metadata for organization-scoped personnel with expiring certifications", async () => {
		const updatedPayloads: Record<string, unknown>[] = [];
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [
				{
					id: "person-1",
					organizationId: "org-1",
					firstName: "Amina",
					lastName: "Lead",
					email: "amina@example.test",
					certifications: [
						{
							name: "PMP",
							issuer: "PMI",
							dateObtained: "2024-01-01",
							expirationDate: "2026-08-01",
							status: "active",
						},
						{
							name: "Expired Security+",
							issuer: "CompTIA",
							dateObtained: "2020-01-01",
							expirationDate: "2023-01-01",
							status: "expired",
						},
					],
				},
				{
					id: "person-2",
					organizationId: "org-1",
					firstName: "No",
					lastName: "Email",
					email: null,
					certifications: [{
						name: "AWS",
						issuer: "Amazon",
						dateObtained: "2025-01-01",
						expirationDate: "2026-09-01",
						status: "active",
					}],
				},
			],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => updatedPayloads.push(value),
			onWhere: (value) => wheres.push(value),
		}));

		const result = await sendCertificationReminders(["person-1", "person-2"]);

		expect(result).toMatchObject({ success: true, data: { sent: 1 } });
		expect(dbMock.update).toHaveBeenCalledTimes(1);
		expect(updatedPayloads[0].certifications).toEqual([
			expect.objectContaining({
				name: "PMP",
				reminder: expect.objectContaining({
					reminderCount: 1,
					sentBy: "personnel-manager-1",
					sentTo: "amina@example.test",
					channel: "email",
				}),
			}),
			expect.not.objectContaining({ reminder: expect.anything() }),
		]);
		const sqlText = collectSqlFragments(wheres).join(" ");
		expect(sqlText).toContain("personnel.organization_id");
		expect(sqlText).toContain("org-1");
		expect(sqlText).toContain("person-1");
		expect(sqlText).toContain("person-2");
	});
});
