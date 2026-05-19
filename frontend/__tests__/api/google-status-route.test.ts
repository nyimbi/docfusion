import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
vi.hoisted(() => {
	process.env.GOOGLE_CLIENT_ID = "google-client";
	process.env.GOOGLE_CLIENT_SECRET = "google-secret";
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/google/status/route";

function statusRequest(cookies: Record<string, string> = {}) {
	const cookieHeader = Object.entries(cookies)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("; ");
	return new NextRequest("https://app.test/api/v1/google/status", {
		headers: cookieHeader ? { cookie: cookieHeader } : undefined,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({ user: { id: "user-1" } });
	vi.stubGlobal("fetch", vi.fn());
});

describe("Google connection status route", () => {
	it("validates access tokens without putting the token in the URL", async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));

		const response = await GET(statusRequest({
			google_app_user_id: "user-1",
			google_access_token: "secret-token",
			google_user_email: "user@example.test",
		}));

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			configured: true,
			connected: true,
			valid: true,
			email: "user@example.test",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.googleapis.com/oauth2/v2/userinfo",
			expect.objectContaining({
				headers: { Authorization: "Bearer secret-token" },
			})
		);
		expect(fetchMock.mock.calls[0][0]).not.toContain("secret-token");
	});

	it("does not validate tokens for anonymous app users", async () => {
		authMock.mockResolvedValueOnce(null);

		const response = await GET(statusRequest({
			google_app_user_id: "user-1",
			google_access_token: "secret-token",
		}));

		expect(response.status).toBe(401);
		expect(fetch).not.toHaveBeenCalled();
	});
});
