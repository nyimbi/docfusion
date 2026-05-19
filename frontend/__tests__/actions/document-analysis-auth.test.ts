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
	documents: {},
	documentAnalyses: {},
	paragraphAnalyses: {},
	proposalDocuments: {},
}));
vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(),
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

import {
	analyzeDocument,
	deleteAnalysis,
	getAnalysis,
	getAnalysisHistory,
} from "@/lib/actions/document-analysis";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("document analysis action auth", () => {
	it("rejects unauthenticated analysis actions before database access", async () => {
		await expect(analyzeDocument({ documentId: "doc-1" })).rejects.toThrow("Unauthorized");
		await expect(getAnalysis("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getAnalysisHistory("doc-1")).rejects.toThrow("Unauthorized");
		await expect(deleteAnalysis("analysis-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
