import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
	clearGoogleTokenCookies,
	createGoogleOAuthState,
	getBoundGoogleTokens,
	parseGoogleOAuthState,
	sanitizeGoogleReturnUrl,
	setBoundGoogleTokenCookies,
} from "@/lib/google/bound-tokens";

function requestWithCookies(cookies: Record<string, string>) {
	const header = Object.entries(cookies)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("; ");
	return new NextRequest("https://app.test/api/v1/google/status", {
		headers: { cookie: header },
	});
}

describe("bound Google OAuth tokens", () => {
	it("sanitizes return URLs to same-origin relative paths", () => {
		expect(sanitizeGoogleReturnUrl("/documents?id=1")).toBe("/documents?id=1");
		expect(sanitizeGoogleReturnUrl("https://evil.test/callback")).toBe("/hdsi");
		expect(sanitizeGoogleReturnUrl("//evil.test/callback")).toBe("/hdsi");
		expect(sanitizeGoogleReturnUrl("javascript:alert(1)")).toBe("/hdsi");
	});

	it("round-trips OAuth state with a sanitized return path", () => {
		const state = createGoogleOAuthState("nonce", "user-1", "https://evil.test/callback");
		expect(parseGoogleOAuthState(state)).toEqual({
			state: "nonce",
			appUserId: "user-1",
			returnUrl: "/hdsi",
		});
	});

	it("returns tokens only for the matching app session user", () => {
		const request = requestWithCookies({
			google_app_user_id: "user-1",
			google_access_token: "access",
			google_refresh_token: "refresh",
			google_user_email: "user@example.test",
		});

		expect(getBoundGoogleTokens(request, "user-1")).toEqual({
			accessToken: "access",
			refreshToken: "refresh",
			userEmail: "user@example.test",
		});
		expect(getBoundGoogleTokens(request, "user-2")).toBeNull();
	});

	it("sets and clears all app-user-bound Google cookies", () => {
		const response = NextResponse.json({ ok: true });
		setBoundGoogleTokenCookies(response, {
			sessionUserId: "user-1",
			accessToken: "access",
			refreshToken: "refresh",
			userEmail: "user@example.test",
		});

		const setCookies = response.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("google_app_user_id=user-1");
		expect(setCookies).toContain("google_access_token=access");

		clearGoogleTokenCookies(response);
		const cleared = response.headers.getSetCookie().join("\n");
		expect(cleared).toContain("google_oauth_state=");
		expect(cleared).toContain("google_oauth_app_user=");
	});
});
