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
	templates: {},
	templateCategories: {},
	documents: {},
}));
vi.mock("@/lib/actions/company-variables", () => ({
	getAllTemplateVariables: vi.fn(),
}));

import {
	createDocumentFromTemplate,
	rateTemplate,
} from "@/lib/actions/templates";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("template server action auth", () => {
	it("rejects unauthenticated template rating before database access", async () => {
		await expect(rateTemplate({
			templateId: "template-1",
			rating: 5,
		})).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated document creation before system ownership fallback", async () => {
		await expect(createDocumentFromTemplate({
			templateId: "template-1",
			title: "Draft",
			placeholderValues: {},
		})).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
