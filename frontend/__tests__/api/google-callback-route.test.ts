import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
vi.hoisted(() => {
	process.env.GOOGLE_CLIENT_ID = "google-client";
	process.env.GOOGLE_CLIENT_SECRET = "google-secret";
	process.env.GOOGLE_REDIRECT_URI = "https://app.test/api/v1/google/callback";
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/google/callback/route";

function oauthState(nonce: string, appUserId: string, returnUrl = "/hdsi") {
	return `${nonce}:${encodeURIComponent(appUserId)}:${encodeURIComponent(returnUrl)}`;
}

function callbackRequest(
	query: Record<string, string>,
	cookies: Record<string, string> = {}
) {
	const search = new URLSearchParams(query);
	const cookieHeader = Object.entries(cookies)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("; ");
	return new NextRequest(`https://app.test/api/v1/google/callback?${search}`, {
		headers: cookieHeader ? { cookie: cookieHeader } : undefined,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({ user: { id: "user-1" } });
	vi.stubGlobal("fetch", vi.fn());
});

describe("Google OAuth callback route", () => {
	it("rejects callbacks with invalid state", async () => {
		const response = await GET(callbackRequest({
			code: "auth-code",
			state: oauthState("wrong-nonce", "user-1"),
		}, {
			google_oauth_state: "expected-nonce",
			google_oauth_app_user: "user-1",
		}));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://app.test/hdsi?google_error=invalid_state");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("rejects callbacks bound to a different app user", async () => {
		const response = await GET(callbackRequest({
			code: "auth-code",
			state: oauthState("nonce", "user-1"),
		}, {
			google_oauth_state: "nonce",
			google_oauth_app_user: "user-2",
		}));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://app.test/hdsi?google_error=invalid_state");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("sanitizes hostile return URLs on the early Google error branch", async () => {
		const response = await GET(callbackRequest({
			error: "access_denied",
			state: oauthState("nonce", "user-1", "https://evil.test/capture"),
		}));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://app.test/hdsi?google_error=access_denied");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("sets bound token cookies and clears OAuth state cookies on success", async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({
				access_token: "google-access",
				refresh_token: "google-refresh",
				expires_in: 1800,
			}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				email: "user@example.test",
			}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}));

		const response = await GET(callbackRequest({
			code: "auth-code",
			state: oauthState("nonce", "user-1", "/documents?source=google"),
		}, {
			google_oauth_state: "nonce",
			google_oauth_app_user: "user-1",
		}));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://app.test/documents?source=google&google_connected=true");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const setCookies = response.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("google_access_token=google-access");
		expect(setCookies).toContain("google_refresh_token=google-refresh");
		expect(setCookies).toContain("google_app_user_id=user-1");
		expect(setCookies).toContain("google_oauth_state=");
		expect(setCookies).toContain("google_oauth_app_user=");
	});
});
