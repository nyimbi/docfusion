import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserContextMock = vi.hoisted(() => vi.fn());
const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getUserContext: getUserContextMock,
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
	templatePartials: {},
	templates: {},
	templateEdits: {},
	templateVersions: {},
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	applyPartialPlaceholders,
	combinePartials,
	createPartial,
	deletePartial,
	getPartial,
	getPartialUsages,
	getPartialsByIds,
	getUnusedPartials,
	listPartials,
	searchPartials,
	trackPartialUsage,
	updatePartial,
} from "@/lib/actions/partials";
import {
	createTemplateVersion,
	deleteTemplateVersion,
	getEdit,
	getTemplateEditHistory,
	getTemplateVersion,
	getTemplateVersions,
	logTemplateEdit,
	recordContentChange,
	recordTemplatePublish,
	revertTemplateToVersion,
} from "@/lib/actions/template-editor";

const emptyDoc = { type: "doc", content: [] };

beforeEach(() => {
	vi.clearAllMocks();
	getUserContextMock.mockResolvedValue(null);
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("template session auth", () => {
	it("rejects unauthenticated partial actions before database access", async () => {
		await expect(listPartials()).rejects.toThrow("Unauthorized");
		await expect(getPartial("partial-1" as never)).rejects.toThrow("Unauthorized");
		await expect(createPartial({
			name: "Partial",
			content: emptyDoc,
		} as never)).rejects.toThrow("Unauthorized");
		await expect(updatePartial("partial-1" as never, { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deletePartial("partial-1" as never)).rejects.toThrow("Unauthorized");
		await expect(getPartialsByIds(["partial-1" as never])).rejects.toThrow("Unauthorized");
		await expect(combinePartials(["partial-1" as never])).rejects.toThrow("Unauthorized");
		await expect(applyPartialPlaceholders("partial-1" as never, {})).rejects.toThrow("Unauthorized");
		await expect(trackPartialUsage("partial-1" as never, "template-1")).rejects.toThrow("Unauthorized");
		await expect(getUnusedPartials()).rejects.toThrow("Unauthorized");
		await expect(getPartialUsages("partial-1" as never)).rejects.toThrow("Unauthorized");
		await expect(searchPartials("partial")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated template edit mutations before database access", async () => {
		await expect(logTemplateEdit("template-1", "edit", { after: emptyDoc })).rejects.toThrow("Unauthorized");
		await expect(recordContentChange("template-1", emptyDoc)).rejects.toThrow("Unauthorized");
		await expect(recordTemplatePublish("template-1")).rejects.toThrow("Unauthorized");
		await expect(createTemplateVersion("template-1", emptyDoc)).rejects.toThrow("Unauthorized");
		await expect(revertTemplateToVersion("template-1", 1)).rejects.toThrow("Unauthorized");
		await expect(deleteTemplateVersion("template-1", 1)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated template edit reads before database access", async () => {
		await expect(getTemplateEditHistory("template-1")).rejects.toThrow("Unauthorized");
		await expect(getEdit("edit-1")).rejects.toThrow("Unauthorized");
		await expect(getTemplateVersions("template-1")).rejects.toThrow("Unauthorized");
		await expect(getTemplateVersion("template-1", 1)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
