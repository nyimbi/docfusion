import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(
	() =>
		new Proxy(
			{},
			{
				get() {
					dbAccessMock();
					throw new Error("database should not be touched before auth");
				},
			}
		)
);

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	requireUserContext: requireUserContextMock,
	userHasAuthorityRole: vi.fn(() => false),
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {},
	proposalDocuments: {},
	documentSections: {},
}));

import {
	bulkAssign,
	bulkUpdateStatus,
	createProposalDocument,
	createSection,
	createStandardProposalSet,
	deleteProposalDocument,
	deleteSection,
	linkExistingDocument,
	reorderProposalDocuments,
	reorderSections,
	unlinkProposalDocument,
	updateProposalDocument,
	updateSection,
} from "@/lib/actions/proposal-documents";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("proposal document action auth", () => {
	it("rejects unauthenticated proposal document writes before database access", async () => {
		await expect(createProposalDocument({
			opportunityId: "00000000-0000-0000-0000-000000000001",
			documentType: "cover_letter",
			assignedTo: "spoofed-user",
		})).rejects.toThrow("Unauthorized");
		await expect(linkExistingDocument({
			opportunityId: "00000000-0000-0000-0000-000000000001",
			documentId: "00000000-0000-0000-0000-000000000002",
			documentType: "technical_approach",
		})).rejects.toThrow("Unauthorized");
		await expect(updateProposalDocument("proposal-doc-1", { status: "approved" })).rejects.toThrow(
			"Unauthorized"
		);
		await expect(unlinkProposalDocument("proposal-doc-1")).rejects.toThrow("Unauthorized");
		await expect(deleteProposalDocument("proposal-doc-1")).rejects.toThrow("Unauthorized");
		await expect(reorderProposalDocuments("opportunity-1", ["proposal-doc-1"])).rejects.toThrow(
			"Unauthorized"
		);
		await expect(createStandardProposalSet("opportunity-1")).rejects.toThrow("Unauthorized");
		await expect(bulkUpdateStatus(["proposal-doc-1"], "in_review")).rejects.toThrow("Unauthorized");
		await expect(bulkAssign(["proposal-doc-1"], "spoofed-user")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated section writes before database access", async () => {
		await expect(createSection({
			proposalDocumentId: "proposal-doc-1",
			sectionName: "Technical approach",
		})).rejects.toThrow("Unauthorized");
		await expect(updateSection("section-1", { status: "drafting" })).rejects.toThrow("Unauthorized");
		await expect(deleteSection("section-1")).rejects.toThrow("Unauthorized");
		await expect(reorderSections("proposal-doc-1", ["section-1"])).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
