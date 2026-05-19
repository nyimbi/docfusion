import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	opportunityVotes: {},
	opportunities: {},
}));

import {
	castVote,
	castVoteAndUpdateStatus,
	deleteVote,
	getUserVote,
	getVoteSummariesBulk,
	getVoteSummary,
	getVotes,
	updateDecisionFromVotes,
} from "@/lib/actions/opportunity-votes";

beforeEach(() => {
	vi.clearAllMocks();
	getServerSessionMock.mockResolvedValue(null);
});

describe("opportunity vote action auth", () => {
	it("rejects unauthenticated vote writes before database access", async () => {
		await expect(castVote({
			opportunityId: "opp-1",
			userId: "spoofed-user",
			userName: "Spoofed",
			vote: "go",
		})).rejects.toThrow("Unauthorized");
		await expect(castVoteAndUpdateStatus({
			opportunityId: "opp-1",
			userId: "spoofed-user",
			vote: "no_go",
		})).rejects.toThrow("Unauthorized");
		await expect(deleteVote("opp-1", "spoofed-user")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated vote reads and summaries before database access", async () => {
		await expect(getVotes("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getUserVote("opp-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(getVoteSummary("opp-1")).rejects.toThrow("Unauthorized");
		await expect(updateDecisionFromVotes("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getVoteSummariesBulk(["opp-1"])).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
