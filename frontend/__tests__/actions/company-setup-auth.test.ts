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
const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ type: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })));
const ilikeMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ type: "ilike", column, value })));
const sqlMock = vi.hoisted(() => vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema", () => ({
	roles: {
		id: "roles.id",
		organizationId: "roles.organization_id",
		name: "roles.name",
		department: "roles.department",
		level: "roles.level",
	},
	companyProfiles: {
		id: "company_profiles.id",
		organizationId: "company_profiles.organization_id",
		description: "company_profiles.description",
	},
	products: {
		id: "products.id",
		organizationId: "products.organization_id",
		name: "products.name",
		category: "products.category",
		status: "products.status",
	},
	services: {
		id: "services.id",
		organizationId: "services.organization_id",
		name: "services.name",
		category: "services.category",
		status: "services.status",
	},
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
	ilike: ilikeMock,
	sql: sqlMock,
}));

import {
	createProduct,
	createRole,
	createService,
	deleteProduct,
	deleteRole,
	deleteService,
	getCompanyProfile,
	getCompanyStats,
	getDepartments,
	getProduct,
	getProductCategories,
	getProducts,
	getRole,
	getRoles,
	getService,
	getServiceCategories,
	getServices,
	saveCompanyProfile,
	updateProduct,
	updateRole,
	updateService,
} from "@/lib/actions/company-setup";

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

describe("company setup action auth", () => {
	it("rejects unauthenticated reads and mutations before database access", async () => {
		await expect(getRoles()).rejects.toThrow("Unauthorized");
		await expect(getRole("role-1")).rejects.toThrow("Unauthorized");
		await expect(createRole({ name: "Engineer" })).rejects.toThrow("Unauthorized");
		await expect(updateRole("role-1", { name: "Lead Engineer" })).rejects.toThrow("Unauthorized");
		await expect(deleteRole("role-1")).rejects.toThrow("Unauthorized");
		await expect(getDepartments()).rejects.toThrow("Unauthorized");

		await expect(getCompanyProfile()).rejects.toThrow("Unauthorized");
		await expect(saveCompanyProfile({ name: "Datacraft" })).rejects.toThrow("Unauthorized");
		await expect(getCompanyStats()).rejects.toThrow("Unauthorized");

		await expect(getProducts()).rejects.toThrow("Unauthorized");
		await expect(getProduct("product-1")).rejects.toThrow("Unauthorized");
		await expect(createProduct({ name: "Platform" })).rejects.toThrow("Unauthorized");
		await expect(updateProduct("product-1", { name: "Platform Pro" })).rejects.toThrow("Unauthorized");
		await expect(deleteProduct("product-1")).rejects.toThrow("Unauthorized");
		await expect(getProductCategories()).rejects.toThrow("Unauthorized");

		await expect(getServices()).rejects.toThrow("Unauthorized");
		await expect(getService("service-1")).rejects.toThrow("Unauthorized");
		await expect(createService({ name: "Advisory" })).rejects.toThrow("Unauthorized");
		await expect(updateService("service-1", { name: "Delivery" })).rejects.toThrow("Unauthorized");
		await expect(deleteService("service-1")).rejects.toThrow("Unauthorized");
		await expect(getServiceCategories()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("creates roles in the caller organization", async () => {
		let inserted: Record<string, unknown> | undefined;
		requireUserContextMock.mockResolvedValueOnce({
			userId: "user-1",
			organizationId: "org-1",
		});
		dbMock.insert.mockReturnValueOnce(createInsertChain([{
			id: "role-1",
			organizationId: "org-1",
			name: "Engineer",
			description: null,
			department: null,
			level: null,
			responsibilities: [],
			skillsRequired: [],
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		}], (value) => {
			inserted = value;
		}) as never);

		const role = await createRole({ name: "Engineer" });

		expect(inserted).toMatchObject({
			organizationId: "org-1",
			name: "Engineer",
		});
		expect(role.organizationId).toBe("org-1");
	});
});
