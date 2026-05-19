import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	roles: {},
	companyProfiles: {},
	products: {},
	services: {},
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
	getCurrentUserIdMock.mockResolvedValue(null);
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
});
