import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));

import {
	isControlPlaneResponse,
	requireControlPlaneAdmin,
} from "@/lib/auth/control-plane";

beforeEach(() => {
	vi.clearAllMocks();
	delete process.env.SCRAPER_API_KEY;
});

describe("control-plane admin auth", () => {
	it("rejects anonymous callers", async () => {
		authMock.mockResolvedValueOnce(null);

		const result = await requireControlPlaneAdmin(new NextRequest("https://app.test/api/import/competitive-intelligence"));

		expect(isControlPlaneResponse(result)).toBe(true);
		if (isControlPlaneResponse(result)) expect(result.status).toBe(401);
	});

	it("denies non-control-plane roles including proposal managers", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "user-1", role: "proposal_manager" } });

		const result = await requireControlPlaneAdmin(new NextRequest("https://app.test/api/admin/scraper/health"));

		expect(isControlPlaneResponse(result)).toBe(true);
		if (isControlPlaneResponse(result)) expect(result.status).toBe(403);
	});

	it("allows admin and operations sessions", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "ops-1", role: "operations" } });

		const result = await requireControlPlaneAdmin(new NextRequest("https://app.test/api/admin/scraper/stats"));

		expect(isControlPlaneResponse(result)).toBe(false);
		if (!isControlPlaneResponse(result)) {
			expect(result.actor).toMatchObject({ userId: "ops-1", roles: ["operations"] });
		}
	});

	it("allows an explicitly configured API key without consulting the app session", async () => {
		process.env.SCRAPER_API_KEY = "scraper-secret";

		const result = await requireControlPlaneAdmin(
			new NextRequest("https://app.test/api/admin/scraper/health", {
				headers: { authorization: "Bearer scraper-secret" },
			}),
			{ allowApiKeyEnv: "SCRAPER_API_KEY" }
		);

		expect(isControlPlaneResponse(result)).toBe(false);
		expect(authMock).not.toHaveBeenCalled();
	});
});
