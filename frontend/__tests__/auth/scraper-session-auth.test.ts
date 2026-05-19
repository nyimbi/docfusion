import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServerSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: requireServerSessionMock,
}));

import { requireScraperOperatorSession } from "@/lib/scrapers/session-auth";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("scraper server-action auth", () => {
	it("propagates unauthenticated sessions as unauthorized", async () => {
		requireServerSessionMock.mockRejectedValueOnce(new Error("Unauthorized"));

		await expect(requireScraperOperatorSession()).rejects.toThrow("Unauthorized");
	});

	it("rejects ordinary authenticated users", async () => {
		requireServerSessionMock.mockResolvedValueOnce({
			user: { id: "pm-1", role: "proposal_manager" },
		});

		await expect(requireScraperOperatorSession()).rejects.toThrow("Forbidden");
	});

	it("allows scraper operators", async () => {
		requireServerSessionMock.mockResolvedValueOnce({
			user: { id: "operator-1", roles: ["scraper_operator"] },
		});

		await expect(requireScraperOperatorSession()).resolves.toBeUndefined();
	});
});
