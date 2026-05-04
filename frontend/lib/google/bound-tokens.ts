import { NextRequest, NextResponse } from "next/server";

export interface GoogleTokens {
	accessToken?: string;
	refreshToken?: string;
	userEmail?: string;
}

export function sanitizeGoogleReturnUrl(value: string | null | undefined): string {
	if (!value) return "/hdsi";
	if (value.startsWith("//")) return "/hdsi";
	try {
		const parsed = new URL(value, "http://local.invalid");
		if (parsed.origin !== "http://local.invalid") return "/hdsi";
		const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
		return path.startsWith("/") ? path : "/hdsi";
	} catch {
		return value.startsWith("/") ? value : "/hdsi";
	}
}

export function createGoogleOAuthState(state: string, appUserId: string, returnUrl: string): string {
	return `${state}:${encodeURIComponent(appUserId)}:${encodeURIComponent(sanitizeGoogleReturnUrl(returnUrl))}`;
}

export function parseGoogleOAuthState(value: string | null | undefined) {
	const [state, encodedUserId, encodedReturnUrl] = (value ?? "").split(":");
	return {
		state: state || "",
		appUserId: encodedUserId ? decodeURIComponent(encodedUserId) : "",
		returnUrl: sanitizeGoogleReturnUrl(encodedReturnUrl ? decodeURIComponent(encodedReturnUrl) : "/hdsi"),
	};
}

export function getBoundGoogleTokens(request: NextRequest, sessionUserId: string): GoogleTokens | null {
	const boundUserId = request.cookies.get("google_app_user_id")?.value;
	if (!boundUserId || boundUserId !== sessionUserId) return null;
	const accessToken = request.cookies.get("google_access_token")?.value;
	const refreshToken = request.cookies.get("google_refresh_token")?.value;
	const userEmail = request.cookies.get("google_user_email")?.value;
	if (!accessToken && !refreshToken) return null;
	return { accessToken, refreshToken, userEmail };
}

export function setBoundGoogleTokenCookies(
	response: NextResponse,
	input: {
		sessionUserId: string;
		accessToken?: string;
		refreshToken?: string;
		userEmail?: string;
		accessTokenMaxAge?: number;
	}
) {
	if (input.accessToken) {
		response.cookies.set("google_access_token", input.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: input.accessTokenMaxAge ?? 3600,
		});
	}
	if (input.refreshToken) {
		response.cookies.set("google_refresh_token", input.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 30,
		});
	}
	response.cookies.set("google_app_user_id", input.sessionUserId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 30,
	});
	if (input.userEmail) {
		response.cookies.set("google_user_email", input.userEmail, {
			httpOnly: false,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 30,
		});
	}
}

export function clearGoogleTokenCookies(response: NextResponse) {
	response.cookies.delete("google_access_token");
	response.cookies.delete("google_refresh_token");
	response.cookies.delete("google_user_email");
	response.cookies.delete("google_app_user_id");
	response.cookies.delete("google_oauth_state");
	response.cookies.delete("google_oauth_app_user");
}
