import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import {
	batchProcessDiagrams,
	convertDiagramFormat,
	generateDiagram,
	getDiagramAnalytics,
} from "@/lib/actions/diagrams";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
	vi.stubGlobal("fetch", fetchMock);
});

describe("diagram action auth", () => {
	it("rejects unauthenticated diagram actions before downstream work", async () => {
		await expect(generateDiagram({
			description: "Show a capture workflow",
			format: "mermaid",
		})).rejects.toThrow("Unauthorized");
		await expect(convertDiagramFormat({
			code: "@startuml\n@enduml",
			fromFormat: "plantuml",
			toFormat: "svg",
		})).rejects.toThrow("Unauthorized");
		await expect(batchProcessDiagrams({
			diagrams: [{ id: "diagram-1", code: "graph TD; A-->B", format: "mermaid" }],
			operation: "validate",
		})).rejects.toThrow("Unauthorized");
		await expect(getDiagramAnalytics("doc-1")).rejects.toThrow("Unauthorized");

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
