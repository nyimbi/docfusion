import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
	auth: authMock,
}));

import { requireScraperAccess } from "@/lib/scrapers/api-auth";

beforeEach(() => {
	vi.clearAllMocks();
	delete process.env.SCRAPER_API_KEY;
});

describe("scraper API auth", () => {
	it("rejects anonymous callers", async () => {
		authMock.mockResolvedValueOnce(null);

		const result = await requireScraperAccess(new NextRequest("https://app.test/api/scrapers/run"));

		expect(result?.status).toBe(401);
	});

	it("denies ordinary authenticated users", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "pm-1", role: "proposal_manager" } });

		const result = await requireScraperAccess(new NextRequest("https://app.test/api/scrapers/run"));

		expect(result?.status).toBe(403);
	});

	it("allows scraper operators and operations roles", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "operator-1", roles: ["scraper_operator"] } });
		await expect(requireScraperAccess(new NextRequest("https://app.test/api/scrapers/run"))).resolves.toBeNull();

		authMock.mockResolvedValueOnce({ user: { id: "ops-1", role: "operations" } });
		await expect(requireScraperAccess(new NextRequest("https://app.test/api/scrapers/batch"))).resolves.toBeNull();
	});

	it("allows configured API keys when explicitly enabled", async () => {
		process.env.SCRAPER_API_KEY = "scraper-secret";

		const result = await requireScraperAccess(
			new NextRequest("https://app.test/api/scrapers/schedule", {
				headers: { authorization: "Bearer scraper-secret" },
			}),
			{ allowApiKey: true }
		);

		expect(result).toBeNull();
		expect(authMock).not.toHaveBeenCalled();
	});
});
