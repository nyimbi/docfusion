/**
 * Google Connection Status Route
 *
 * Returns whether the user is connected to Google and can access Google Docs.
 */

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export async function GET(request: NextRequest) {
  // Check if Google OAuth is configured
  const isConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

  // Check if user has tokens
  const accessToken = request.cookies.get("google_access_token")?.value;
  const refreshToken = request.cookies.get("google_refresh_token")?.value;
  const userEmail = request.cookies.get("google_user_email")?.value;

  const isConnected = !!(accessToken || refreshToken);

  // If connected, verify the token is still valid
  let isValid = false;
  if (accessToken) {
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + accessToken
      );
      isValid = response.ok;
    } catch {
      isValid = false;
    }
  }

  return NextResponse.json({
    configured: isConfigured,
    connected: isConnected,
    valid: isValid || !!refreshToken, // Refresh token can get new access token
    email: isConnected ? userEmail : null,
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
  const response = NextResponse.json({
    success: true,
    message: "Disconnected from Google",
  });

  // Clear all Google-related cookies
  response.cookies.delete("google_access_token");
  response.cookies.delete("google_refresh_token");
  response.cookies.delete("google_user_email");

  return response;
}
