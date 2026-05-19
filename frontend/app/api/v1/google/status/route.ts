/**
 * Google Connection Status Route
 *
 * Returns whether the user is connected to Google and can access Google Docs.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	isRouteSessionResponse,
	requireRouteSessionOr401,
} from "@/lib/auth/route-session";
import {
	clearGoogleTokenCookies,
	getBoundGoogleTokens,
} from "@/lib/google/bound-tokens";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export async function GET(request: NextRequest) {
	const sessionResult = await requireRouteSessionOr401();
	if (isRouteSessionResponse(sessionResult)) {
		return sessionResult;
	}

	// Check if Google OAuth is configured
	const isConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

	// Check if user has tokens
	const tokens = getBoundGoogleTokens(request, sessionResult.session.user.id);

	const isConnected = !!(tokens?.accessToken || tokens?.refreshToken);

	// If connected, verify the token is still valid
	let isValid = false;
	if (tokens?.accessToken) {
		try {
			const response = await fetch(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				{
					headers: {
						Authorization: `Bearer ${tokens.accessToken}`,
					},
				}
			);
			isValid = response.ok;
		} catch {
			isValid = false;
		}
	}

	return NextResponse.json({
		configured: isConfigured,
		connected: isConnected,
		valid: isValid || !!tokens?.refreshToken, // Refresh token can get new access token
		email: isConnected ? tokens?.userEmail : null,
		message: !isConfigured
			? "Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment."
			: !isConnected
				? "Not connected to Google. Click 'Connect Google Account' to enable Google Docs import."
				: "Connected to Google",
	});
}

/**
 * Disconnect from Google (DELETE)
 */
export async function DELETE() {
	const sessionResult = await requireRouteSessionOr401();
	if (isRouteSessionResponse(sessionResult)) {
		return sessionResult;
	}

	const response = NextResponse.json({
		success: true,
		message: "Disconnected from Google",
	});

	clearGoogleTokenCookies(response);

	return response;
}
