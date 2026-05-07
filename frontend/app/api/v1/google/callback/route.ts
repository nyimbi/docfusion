/**
 * Google OAuth Callback Route
 *
 * Handles the OAuth callback from Google, exchanges code for tokens,
 * and stores the access token for use with Google Docs API.
 */

import { NextRequest, NextResponse } from "next/server";
import { isRouteSessionResponse, requireRouteSessionOr401 } from "@/lib/auth/route-session";
import {
	parseGoogleOAuthState,
	sanitizeGoogleReturnUrl,
	setBoundGoogleTokenCookies,
} from "@/lib/google/bound-tokens";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/v1/google/callback`;

export async function GET(request: NextRequest) {
  const authResult = await requireRouteSessionOr401();
  if (isRouteSessionResponse(authResult)) {
    return NextResponse.redirect(new URL("/hdsi?google_error=app_auth_required", request.url));
  }
  const sessionUserId = authResult.session.user.id;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const parsedState = parseGoogleOAuthState(state);
  const error = searchParams.get("error");

  // Handle errors from Google
  if (error) {
    const returnUrl = parsedState.returnUrl || "/hdsi";
    return NextResponse.redirect(buildGoogleRedirect(request, returnUrl, "google_error", error));
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/hdsi?google_error=no_code", request.url)
    );
  }

  // Verify state
  const storedState = request.cookies.get("google_oauth_state")?.value;
  const storedAppUser = request.cookies.get("google_oauth_app_user")?.value;

  if (
    !storedState ||
    storedState !== parsedState.state ||
    !storedAppUser ||
    storedAppUser !== sessionUserId ||
    parsedState.appUserId !== sessionUserId
  ) {
    return NextResponse.redirect(
      new URL("/hdsi?google_error=invalid_state", request.url)
    );
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/hdsi?google_error=not_configured", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/hdsi?google_error=token_exchange_failed", request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info for display
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let userEmail = "Unknown";
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      userEmail = userInfo.email || "Unknown";
    }

	    // Create response with redirect
	    const decodedReturnUrl = parsedState.returnUrl || "/hdsi";
	    const response = NextResponse.redirect(
	      buildGoogleRedirect(request, decodedReturnUrl, "google_connected", "true")
	    );
	
	    setBoundGoogleTokenCookies(response, {
	      sessionUserId,
	      accessToken: tokens.access_token,
	      refreshToken: tokens.refresh_token,
	      userEmail,
	      accessTokenMaxAge: tokens.expires_in || 3600,
	    });

	    // Clear the state cookie
	    response.cookies.delete("google_oauth_state");
	    response.cookies.delete("google_oauth_app_user");

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/hdsi?google_error=callback_failed", request.url)
    );
  }
}

function buildGoogleRedirect(
	request: NextRequest,
	returnUrl: string,
	key: string,
	value: string
): URL {
	const redirect = new URL(sanitizeGoogleReturnUrl(returnUrl), request.url);
	redirect.searchParams.set(key, value);
	return redirect;
}
