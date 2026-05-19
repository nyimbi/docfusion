import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));
const eqMock = vi.hoisted(() => vi.fn((column, value) => ({ type: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions) => ({ type: "and", conditions })));
const ilikeMock = vi.hoisted(() => vi.fn((column, value) => ({ type: "ilike", column, value })));
const orderMock = vi.hoisted(() => vi.fn((column) => ({ type: "order", column })));
const sqlMock = vi.hoisted(() => vi.fn(() => ({ type: "sql" })));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema", () => ({
	companyVariables: {
		id: "company_variables.id",
		organizationId: "company_variables.organization_id",
		category: "company_variables.category",
		sortOrder: "company_variables.sort_order",
		name: "company_variables.name",
		isActive: "company_variables.is_active",
	},
	companySettings: {
		organizationId: "company_settings.organization_id",
	},
	products: {
		organizationId: "products.organization_id",
	},
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
	ilike: ilikeMock,
	asc: orderMock,
	desc: orderMock,
	sql: sqlMock,
}));

import {
	createCompanyVariable,
	deleteCompanyVariable,
	getAllTemplateVariables,
	getCompanyVariable,
	getCompanyVariableByName,
	getCompanyVariables,
	getVariableCategories,
	previewTemplateVariable,
	updateCompanyVariable,
	updateVariableSortOrder,
	validateVariableName,
} from "@/lib/actions/company-variables";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("company variable action auth", () => {
	it("rejects unauthenticated variable reads and mutations before database access", async () => {
		await expect(getCompanyVariables()).rejects.toThrow("Unauthorized");
		await expect(getCompanyVariable("var-1")).rejects.toThrow("Unauthorized");
		await expect(getCompanyVariableByName("company_name")).rejects.toThrow("Unauthorized");
		await expect(createCompanyVariable({
			name: "company_name",
			label: "Company name",
		})).rejects.toThrow("Unauthorized");
		await expect(updateCompanyVariable("var-1", { label: "Company legal name" })).rejects.toThrow("Unauthorized");
		await expect(deleteCompanyVariable("var-1")).rejects.toThrow("Unauthorized");
		await expect(updateVariableSortOrder([{ id: "var-1", sortOrder: 1 }])).rejects.toThrow("Unauthorized");
		await expect(getVariableCategories()).rejects.toThrow("Unauthorized");
		await expect(getAllTemplateVariables()).rejects.toThrow("Unauthorized");
		await expect(previewTemplateVariable("company.name")).rejects.toThrow("Unauthorized");
		await expect(validateVariableName("company_name")).rejects.toThrow("Unauthorized");

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("filters variable lists by the authenticated organization", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "user-1",
			organizationId: "org-1",
		});
		const orderByMock = vi.fn(async () => []);
		const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
		const fromMock = vi.fn(() => ({ where: whereMock }));
		dbMock.select.mockReturnValueOnce({ from: fromMock });

		await expect(getCompanyVariables()).resolves.toEqual([]);

		expect(eqMock).toHaveBeenCalledWith(
			"company_variables.organization_id",
			"org-1"
		);
		expect(whereMock).toHaveBeenCalledWith({
			type: "and",
			conditions: [{
				type: "eq",
				column: "company_variables.organization_id",
				value: "org-1",
			}],
		});
	});
});
