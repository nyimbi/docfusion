/**
 * Google OAuth Initiation Route
 *
 * Redirects user to Google OAuth consent screen for Docs/Drive access.
 * Used specifically for importing Google Docs content.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRouteSessionOr401, isRouteSessionResponse } from "@/lib/auth/route-session";
import { createGoogleOAuthState, sanitizeGoogleReturnUrl } from "@/lib/google/bound-tokens";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/v1/google/callback`;

// Scopes needed for reading Google Docs
const SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(request: NextRequest) {
  const authResult = await requireRouteSessionOr401();
  if (isRouteSessionResponse(authResult)) return authResult;
  const sessionUserId = authResult.session.user.id;

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      {
        error: "Google OAuth not configured",
        message: "Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables",
        setup: {
          steps: [
            "1. Go to https://console.cloud.google.com/",
            "2. Create a new project or select existing",
            "3. Enable Google Docs API and Google Drive API",
            "4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID",
            "5. Set authorized redirect URI to: " + GOOGLE_REDIRECT_URI,
            "6. Copy Client ID and Client Secret to your .env.local file",
          ],
          requiredEnvVars: [
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "GOOGLE_REDIRECT_URI (optional, defaults to /api/v1/google/callback)",
          ],
        },
      },
      { status: 503 }
    );
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Store the return URL from query params
  const returnUrl = sanitizeGoogleReturnUrl(request.nextUrl.searchParams.get("returnUrl") || "/hdsi");

  // Build Google OAuth URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", createGoogleOAuthState(state, sessionUserId, returnUrl));

  // Create response with redirect
  const response = NextResponse.redirect(authUrl.toString());

  // Store state in cookie for verification
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });
  response.cookies.set("google_oauth_app_user", sessionUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
  });

  return response;
}
