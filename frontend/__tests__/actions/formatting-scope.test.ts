import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
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
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
		return chain;
	});
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
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

function expectDocumentScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("documents.owner_id");
	expect(sqlText).toContain("format-user-1");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
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

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
	applyFormatTemplate,
	exportFormattedDocument,
	getDocumentFormat,
	removeDocumentFormat,
	validateFormatCompliance,
} from "@/lib/actions/formatting";

const documentId = "11111111-1111-4111-8111-111111111111";
const templateId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "format-user-1",
		organizationId: "33333333-3333-4333-8333-333333333333",
	});
});

describe("formatting document scoping", () => {
	it("checks writable document scope before applying templates", async () => {
		let documentWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				documentWhere = value;
			},
		}));

		await expect(applyFormatTemplate(documentId, templateId)).rejects.toThrow(
			"Failed to apply format template"
		);

		expect(dbMock.insert).not.toHaveBeenCalled();
		expectDocumentScope(documentWhere);
	});

	it("scopes document format reads through readable documents", async () => {
		let formatWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				formatWhere = value;
			},
		}));

		await expect(getDocumentFormat(documentId)).resolves.toBeNull();

		const sqlText = collectSqlFragments(formatWhere).join(" ");
		expect(sqlText).toContain("documents.owner_id");
		expect(sqlText).toContain("documents.visibility");
		expect(sqlText).toContain("format-user-1");
	});

	it("scopes document format removals through writable documents", async () => {
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.delete.mockReturnValueOnce(createChain({
			onWhere: (value) => wheres.push(value),
		}));

		await removeDocumentFormat(documentId);

		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectDocumentScope(where);
		}
	});

	it("scopes formatted exports through readable documents", async () => {
		let documentWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				documentWhere = value;
			},
		}));

		await expect(exportFormattedDocument(documentId, "pdf")).rejects.toThrow(
			"Failed to export formatted document"
		);

		const sqlText = collectSqlFragments(documentWhere).join(" ");
		expect(sqlText).toContain("documents.owner_id");
		expect(sqlText).toContain("documents.visibility");
		expect(sqlText).toContain("format-user-1");
	});

	it("flags explicit font and spacing violations from document content", async () => {
		let validationPayload: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: documentId,
					content: {
						type: "doc",
						content: [
							{
								type: "paragraph",
								attrs: { lineSpacing: 1 },
								content: [{
									type: "text",
									text: "Small Arial body text",
									marks: [{ type: "textStyle", attrs: { fontFamily: "Arial", fontSize: 9 } }],
								}],
							},
							{
								type: "paragraph",
								attrs: { lineSpacing: 1.5 },
								content: [{
									type: "text",
									text: "Compliant Times New Roman body text",
									marks: [{ type: "textStyle", attrs: { fontFamily: "Times New Roman", fontSize: 11 } }],
								}],
							},
						],
					},
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "format-1",
					documentId,
					templateId,
					overrides: null,
					hasOverrides: false,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: templateId,
					name: "Agency template",
					description: null,
					agencyCode: "AGENCY",
					agencyName: "Agency",
					bodyFont: "Times New Roman",
					bodyFontSize: 11,
					headingFont: "Arial",
					lineSpacing: 1.5,
					minimumFontSize: 10,
					margins: { top: 1, bottom: 1, left: 1, right: 1 },
					pageLimits: [],
					requireImageAltText: false,
				}],
			}));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [{ id: "validation-1" }],
			onValues: (value) => {
				validationPayload = value;
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain());

		const result = await validateFormatCompliance(documentId);

		expect(result.fontCompliance).toBe(false);
		expect(result.spacingCompliance).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({
				type: "font_non_compliant",
				message: expect.stringContaining("Arial"),
				location: "Small Arial body text",
			}),
			expect.objectContaining({
				type: "font_non_compliant",
				message: expect.stringContaining("9pt"),
				severity: "critical",
			}),
			expect.objectContaining({
				type: "spacing_violation",
				message: expect.stringContaining("1) does not match required spacing (1.5)"),
			}),
		]));
		expect(validationPayload).toMatchObject({
			fontCompliance: false,
			nonCompliantFonts: ["Arial"],
			spacingCompliance: false,
			spacingViolationSections: ["Small Arial body text"],
		});
	});
});
