import { beforeEach, describe, expect, it, vi } from "vitest";

function createInsertChain(result: unknown[], onValues?: (value: Record<string, unknown>) => void) {
	const chain: Record<string, any> = {};
	chain.values = vi.fn((value: Record<string, unknown>) => {
		onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => result);
	return chain;
}

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	insert: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	update: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	delete: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	execute: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
}));
const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })));
const ilikeMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ op: "ilike", column, value })));
const descMock = vi.hoisted(() => vi.fn((column: unknown) => ({ op: "desc", column })));
const sqlMock = vi.hoisted(() => Object.assign(
	vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
	{
		raw: vi.fn((value: string) => ({ raw: value })),
	},
));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema", () => ({
	clients: {
		id: "clients.id",
		organizationId: "clients.organization_id",
		name: "clients.name",
		industry: "clients.industry",
		size: "clients.size",
		createdAt: "clients.created_at",
	},
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
	ilike: ilikeMock,
	desc: descMock,
	sql: sqlMock,
}));

import {
	createClient,
	deleteClient,
	getClient,
	getClientStats,
	getClients,
	getClientsByIndustry,
	getIndustries,
	updateClient,
	updateClientStatus,
} from "@/lib/actions/clients";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
	dbMock.select.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.insert.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.update.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.delete.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.execute.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
});

describe("client action auth", () => {
	it("rejects unauthenticated client reads and mutations before database access", async () => {
		await expect(getClients()).rejects.toThrow("Unauthorized");
		await expect(getClient("client-1")).rejects.toThrow("Unauthorized");
		await expect(createClient({ name: "Acme" })).rejects.toThrow("Unauthorized");
		await expect(updateClient("client-1", { name: "Acme Federal" })).rejects.toThrow("Unauthorized");
		await expect(updateClientStatus("client-1", "active")).rejects.toThrow("Unauthorized");
		await expect(deleteClient("client-1")).rejects.toThrow("Unauthorized");
		await expect(getClientStats()).rejects.toThrow("Unauthorized");
		await expect(getIndustries()).rejects.toThrow("Unauthorized");
		await expect(getClientsByIndustry()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("creates clients in the caller organization", async () => {
		let inserted: Record<string, unknown> | undefined;
		requireUserContextMock.mockResolvedValueOnce({ userId: "user-1", organizationId: "org-1" });
		dbMock.insert.mockReturnValueOnce(createInsertChain([{
			id: "client-1",
			organizationId: "org-1",
			name: "Acme",
			industry: null,
			size: null,
			location: null,
			contactName: null,
			contactEmail: null,
			contactPhone: null,
			relationshipType: null,
			contractValue: null,
			startDate: null,
			endDate: null,
			status: "prospect",
			notes: null,
			projects: [],
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		}], (value) => {
			inserted = value;
		}) as never);

		const client = await createClient({ name: "Acme" });

		expect(inserted).toMatchObject({ organizationId: "org-1", name: "Acme" });
		expect(client.organizationId).toBe("org-1");
	});
});
