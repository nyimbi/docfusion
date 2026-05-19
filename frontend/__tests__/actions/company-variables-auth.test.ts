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
	companyVariables: {},
	companySettings: {},
	products: {},
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
	getCurrentUserIdMock.mockResolvedValue(null);
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

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
