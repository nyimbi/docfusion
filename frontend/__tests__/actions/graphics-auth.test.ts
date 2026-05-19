import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const sessionOrganizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const opportunityId = "33333333-3333-4333-8333-333333333333";
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));
vi.mock("@/lib/db/schema-graphics", () => ({
	proposalGraphics: {},
	graphicTemplates: {},
	graphicReferences: {},
	graphicFeedback: {},
	graphicStyleGuides: {},
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {},
	documentSections: {},
	proposalDocuments: {},
}));

import {
	approveGraphic,
	applyTemplate,
	copyGraphic,
	createGraphic,
	createGraphicFromLibraryTemplate,
	createGraphicTemplate,
	deleteGraphic,
	exportGraphics,
	generateActionCaption,
	getGraphic,
	getGraphicTemplates,
	getNextFigureNumber,
	getStyleGuide,
	listGraphics,
	recordGraphicFeedback,
	renderGraphicToSvg,
	reorderGraphics,
	searchGraphics,
	suggestGraphics,
	updateGraphic,
	updateStyleGuide,
	validateGraphicConsistency,
} from "@/lib/actions/graphics";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("graphics action auth", () => {
	it("rejects unauthenticated graphic writes before database access", async () => {
		await expect(createGraphic({
			opportunityId,
			title: "Spoofed graphic",
			graphicType: "diagram",
			format: "mermaid",
		})).rejects.toThrow("Unauthorized");
		await expect(updateGraphic("graphic-1", { title: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteGraphic("graphic-1")).rejects.toThrow("Unauthorized");
		await expect(getGraphic("graphic-1")).rejects.toThrow("Unauthorized");
		await expect(listGraphics(opportunityId)).rejects.toThrow("Unauthorized");
		await expect(suggestGraphics("section-1")).rejects.toThrow("Unauthorized");
		await expect(validateGraphicConsistency(opportunityId)).rejects.toThrow("Unauthorized");
		await expect(getNextFigureNumber(opportunityId)).rejects.toThrow("Unauthorized");
		await expect(searchGraphics("win theme")).rejects.toThrow("Unauthorized");
		await expect(renderGraphicToSvg("graphic-1")).rejects.toThrow("Unauthorized");
		await expect(copyGraphic("graphic-1", opportunityId)).rejects.toThrow("Unauthorized");
		await expect(generateActionCaption("graphic-1")).rejects.toThrow("Unauthorized");
		await expect(exportGraphics(opportunityId, "zip")).rejects.toThrow("Unauthorized");
		await expect(recordGraphicFeedback("graphic-1", "approval", "Looks good", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(approveGraphic("graphic-1", "spoofed-approver")).rejects.toThrow("Unauthorized");
		await expect(reorderGraphics([{ id: "graphic-1", figureNumber: "1" }])).rejects.toThrow("Unauthorized");

		await expect(createGraphicTemplate({
			name: "Spoofed template",
			graphicType: "diagram",
			format: "mermaid",
			templateCode: "graph TD; A-->B;",
		})).rejects.toThrow("Unauthorized");
		await expect(getGraphicTemplates()).rejects.toThrow("Unauthorized");
		await expect(applyTemplate("template-1", { name: "value" })).rejects.toThrow("Unauthorized");
		await expect(getStyleGuide(sessionOrganizationId)).rejects.toThrow("Unauthorized");
		await expect(updateStyleGuide("style-1", { name: "Updated" } as never)).rejects.toThrow("Unauthorized");
		await expect(createGraphicFromLibraryTemplate("mermaid-flowchart", opportunityId)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed graphic organization IDs before database access", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "graphics-user-1",
			organizationId: sessionOrganizationId,
		});

		await expect(createGraphicTemplate({
			name: "Spoofed template",
			graphicType: "diagram",
			format: "mermaid",
			templateCode: "graph TD; A-->B;",
			organizationId: otherOrganizationId,
		})).rejects.toThrow("Unauthorized");
		await expect(getStyleGuide(otherOrganizationId)).rejects.toThrow("Unauthorized");
		await expect(updateStyleGuide("style-1", {
			organizationId: otherOrganizationId,
		} as never)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
