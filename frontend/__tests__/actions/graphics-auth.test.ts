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
	recordGraphicFeedback,
	reorderGraphics,
	updateGraphic,
	updateStyleGuide,
} from "@/lib/actions/graphics";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("graphics action auth", () => {
	it("rejects unauthenticated graphic writes before database access", async () => {
		await expect(createGraphic({
			opportunityId: "00000000-0000-4000-8000-000000000001",
			title: "Spoofed graphic",
			graphicType: "diagram",
			format: "mermaid",
		})).rejects.toThrow("Unauthorized");
		await expect(updateGraphic("graphic-1", { title: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteGraphic("graphic-1")).rejects.toThrow("Unauthorized");
		await expect(copyGraphic("graphic-1", "00000000-0000-4000-8000-000000000002")).rejects.toThrow("Unauthorized");
		await expect(generateActionCaption("graphic-1")).rejects.toThrow("Unauthorized");
		await expect(exportGraphics("00000000-0000-4000-8000-000000000001", "zip")).rejects.toThrow("Unauthorized");
		await expect(recordGraphicFeedback("graphic-1", "approval", "Looks good", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(approveGraphic("graphic-1", "spoofed-approver")).rejects.toThrow("Unauthorized");
		await expect(reorderGraphics([{ id: "graphic-1", figureNumber: "1" }])).rejects.toThrow("Unauthorized");

		await expect(createGraphicTemplate({
			name: "Spoofed template",
			graphicType: "diagram",
			format: "mermaid",
			templateCode: "graph TD; A-->B;",
		})).rejects.toThrow("Unauthorized");
		await expect(applyTemplate("template-1", { name: "value" })).rejects.toThrow("Unauthorized");
		await expect(updateStyleGuide("style-1", { name: "Updated" } as never)).rejects.toThrow("Unauthorized");
		await expect(createGraphicFromLibraryTemplate("mermaid-flowchart", "00000000-0000-4000-8000-000000000001")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
