import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const sessionOrganizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
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
vi.mock("@/lib/ai/content-library", () => ({
	generateEmbedding: vi.fn(async () => ({ embedding: [] })),
	cosineSimilarity: vi.fn(() => 0),
	getContentSuggestions: vi.fn(async () => []),
}));
vi.mock("@/lib/db/schema", () => ({
	templateSnippets: {},
	templatePartials: {},
	templates: {},
	documents: {},
	opportunities: {},
	snippetEmbeddings: {},
	snippetAnalytics: {},
	snippetUsageLog: {},
	templateEmbeddings: {},
	templateAnalytics: {},
	templateUsageLog: {},
	contentSuggestions: {},
	partialEmbeddings: {},
}));

import {
	generateContentSuggestions,
	getContentEffectivenessReport,
	getContentLibraryStats,
	getSnippetsNeedingReview,
	provideSuggestionFeedback,
	recordContentUsage,
	recordProposalOutcome,
	semanticSearch,
	updateSnippetFreshness,
} from "@/lib/actions/content-library";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("content library action auth", () => {
	it("rejects unauthenticated content-library actions before database access", async () => {
		await expect(semanticSearch({ query: "past performance" })).rejects.toThrow("Unauthorized");
		await expect(recordContentUsage({
			contentType: "snippet",
			contentId: "snippet-1",
			documentId: "document-1",
		})).rejects.toThrow("Unauthorized");
		await expect(recordProposalOutcome({
			opportunityId: "opportunity-1",
			outcome: "won",
		})).rejects.toThrow("Unauthorized");
		await expect(updateSnippetFreshness("snippet-1", "current")).rejects.toThrow("Unauthorized");
		await expect(getSnippetsNeedingReview()).rejects.toThrow("Unauthorized");
		await expect(generateContentSuggestions({
			documentId: "document-1",
			contextText: "technical approach",
		})).rejects.toThrow("Unauthorized");
		await expect(provideSuggestionFeedback({
			suggestionId: "suggestion-1",
			action: "accepted",
		})).rejects.toThrow("Unauthorized");
		await expect(getContentLibraryStats()).rejects.toThrow("Unauthorized");
		await expect(getContentEffectivenessReport("snippet-1", "snippet")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed content-library organization filters before database access", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "content-user-1",
			organizationId: sessionOrganizationId,
		});

		await expect(semanticSearch({
			query: "transition",
			filters: { organizationId: otherOrganizationId },
		})).rejects.toThrow("Unauthorized");
		await expect(getContentLibraryStats(otherOrganizationId)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
