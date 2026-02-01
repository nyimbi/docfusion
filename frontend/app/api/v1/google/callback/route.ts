/**
 * Google OAuth Callback Route
 *
 * Handles the OAuth callback from Google, exchanges code for tokens,
 * and stores the access token for use with Google Docs API.
 */

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/v1/google/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle errors from Google
  if (error) {
    const returnUrl = state?.split(":")[1] || "/hdsi";
    return NextResponse.redirect(
      new URL(`${decodeURIComponent(returnUrl)}?google_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/hdsi?google_error=no_code", request.url)
    );
  }

  // Verify state
  const storedState = request.cookies.get("google_oauth_state")?.value;
  const [receivedState, returnUrl] = (state || "").split(":");

  if (!storedState || storedState !== receivedState) {
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
    const decodedReturnUrl = returnUrl ? decodeURIComponent(returnUrl) : "/hdsi";
    const response = NextResponse.redirect(
      new URL(`${decodedReturnUrl}?google_connected=true`, request.url)
    );

    // Store tokens in secure cookies
    // Access token - used for API calls
    response.cookies.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in || 3600, // Usually 1 hour
    });

    // Refresh token - used to get new access tokens
    if (tokens.refresh_token) {
      response.cookies.set("google_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    // Store user email for display (not sensitive)
    response.cookies.set("google_user_email", userEmail, {
      httpOnly: false, // Accessible from client
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Clear the state cookie
    response.cookies.delete("google_oauth_state");

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/hdsi?google_error=callback_failed", request.url)
    );
  }
}
