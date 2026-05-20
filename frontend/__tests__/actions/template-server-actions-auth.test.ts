import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema", () => ({
	templates: {
		id: "templates.id",
		status: "templates.status",
		createdBy: "templates.createdBy",
		rating: "templates.rating",
		ratingCount: "templates.ratingCount",
	},
	templateCategories: {},
	documents: {},
}));
vi.mock("@/lib/actions/company-variables", () => ({
	getAllTemplateVariables: vi.fn(),
}));
vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ op: "eq", left, right })),
	and: vi.fn((...conditions) => ({ op: "and", conditions })),
	or: vi.fn((...conditions) => ({ op: "or", conditions })),
	ilike: vi.fn((left, right) => ({ op: "ilike", left, right })),
	desc: vi.fn((field) => ({ op: "desc", field })),
	asc: vi.fn((field) => ({ op: "asc", field })),
	inArray: vi.fn((field, values) => ({ op: "inArray", field, values })),
	sql: Object.assign(
		vi.fn((strings, ...values) => ({ strings, values })),
		{
			join: vi.fn((items, separator) => ({ items, separator })),
		}
	),
}));

import {
	createDocumentFromTemplate,
	duplicateTemplate,
	getTemplate,
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

		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated document creation before system ownership fallback", async () => {
		await expect(createDocumentFromTemplate({
			templateId: "template-1",
			title: "Draft",
			placeholderValues: {},
		})).rejects.toThrow("Unauthorized");

		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated template reads before database access", async () => {
		await expect(getTemplate("template-1")).rejects.toThrow("Unauthorized");

		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("scopes template reads to the session user's visible templates", async () => {
		const whereMock = vi.fn(async () => [
			{
				id: "template-1",
				name: "Visible",
				description: "Visible template",
				content: { type: "doc", content: [] },
				status: "published",
				visibility: "organization",
				createdBy: "source-owner",
				categoryIds: [],
				tags: [],
				placeholders: [],
				aiInstructions: [],
				complianceRequirements: [],
				useCount: 1,
				rating: null,
				ratingCount: 0,
				previewImageUrl: null,
				estimatedTime: null,
				difficulty: null,
				defaultMetadata: null,
				createdAt: new Date("2025-01-01T00:00:00.000Z"),
				updatedAt: new Date("2025-01-01T00:00:00.000Z"),
			},
		]);
		getCurrentUserIdMock.mockResolvedValue("session-user-1");
		dbMock.select.mockReturnValueOnce({
			from: vi.fn(() => ({
				where: whereMock,
			})),
		});

		const result = await getTemplate("template-1");

		expect(result?.id).toBe("template-1");
		const whereCondition = (whereMock.mock.calls[0] as unknown as [unknown])[0];
		expect(JSON.stringify(whereCondition)).toContain("session-user-1");
	});

	it("scopes template ratings to the session user's visible templates", async () => {
		const whereMock = vi.fn(async () => [{ rating: 4, ratingCount: 2 }]);
		const updateWhereMock = vi.fn(async () => []);
		getCurrentUserIdMock.mockResolvedValue("session-user-1");
		dbMock.select.mockReturnValueOnce({
			from: vi.fn(() => ({
				where: whereMock,
			})),
		});
		dbMock.update.mockReturnValueOnce({
			set: vi.fn(() => ({
				where: updateWhereMock,
			})),
		});

		const result = await rateTemplate({
			templateId: "template-1",
			rating: 5,
			userId: "spoofed-user",
		});

		expect(result).toMatchObject({ success: true, newRating: 4.33, newRatingCount: 3 });
		const whereCondition = (whereMock.mock.calls[0] as unknown as [unknown])[0];
		expect(JSON.stringify(whereCondition)).toContain("session-user-1");
		expect(JSON.stringify(whereCondition)).not.toContain("spoofed-user");
	});

	it("rejects document creation from templates outside the session user's visibility", async () => {
		const whereMock = vi.fn(async () => []);
		getCurrentUserIdMock.mockResolvedValue("session-user-1");
		dbMock.select.mockReturnValueOnce({
			from: vi.fn(() => ({
				where: whereMock,
			})),
		});

		await expect(createDocumentFromTemplate({
			templateId: "template-1",
			title: "Draft",
			placeholderValues: {},
		})).rejects.toThrow("Template not found");

		expect(dbMock.insert).not.toHaveBeenCalled();
		const whereCondition = (whereMock.mock.calls[0] as unknown as [unknown])[0];
		expect(JSON.stringify(whereCondition)).toContain("session-user-1");
	});

	it("rejects unauthenticated template duplication before database access", async () => {
		await expect(duplicateTemplate("template-1")).rejects.toThrow("Unauthorized");

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("uses the session user when duplicating templates", async () => {
		const valuesMock = vi.fn(() => ({
			returning: vi.fn(async () => [
				{
					id: "duplicated-template",
					name: "Copied",
					description: "Original description",
					content: { type: "doc", content: [] },
					status: "draft",
					visibility: "private",
					createdBy: "session-user-1",
					categoryIds: ["cat-1"],
					tags: ["tag"],
					placeholders: [],
					aiInstructions: [],
					complianceRequirements: [],
					useCount: 0,
					rating: null,
					ratingCount: 0,
					previewImageUrl: null,
					estimatedTime: null,
					difficulty: null,
					defaultMetadata: null,
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					updatedAt: new Date("2026-01-01T00:00:00.000Z"),
				},
			]),
		}));

		getCurrentUserIdMock.mockResolvedValue("session-user-1");
		dbMock.select.mockReturnValueOnce({
			from: vi.fn(() => ({
				where: vi.fn(async () => [
					{
						id: "source-template",
						name: "Source",
						description: "Original description",
						content: { type: "doc", content: [] },
						status: "published",
						visibility: "organization",
						createdBy: "source-owner",
						categoryIds: ["cat-1"],
						tags: ["tag"],
						placeholders: [],
						aiInstructions: [],
						complianceRequirements: [],
						useCount: 4,
						rating: 4.5,
						ratingCount: 2,
						previewImageUrl: null,
						estimatedTime: null,
						difficulty: null,
						defaultMetadata: null,
						createdAt: new Date("2025-01-01T00:00:00.000Z"),
						updatedAt: new Date("2025-01-01T00:00:00.000Z"),
					},
				]),
			})),
		});
		dbMock.insert.mockReturnValueOnce({ values: valuesMock });

		const result = await duplicateTemplate("source-template", {
			newName: "Copied",
			createdBy: "spoofed-user",
		} as never);

		expect(result?.createdBy).toBe("session-user-1");
		expect(valuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Copied",
				status: "draft",
				visibility: "private",
				createdBy: "session-user-1",
			})
		);
	});
});
