/**
 * Next.js Middleware for Route Protection
 *
 * Protects application routes by checking for valid session cookies.
 * Redirects unauthenticated users to sign-in and authenticated users
 * away from auth pages.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/auth", "/api/auth", "/", "/hdsi"];

// Auth pages that authenticated users should be redirected away from
const AUTH_PATHS = ["/auth/sign-in", "/auth/sign-up", "/auth/forgot-password"];

export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);
	const { pathname } = request.nextUrl;

	// Allow public paths and static assets
	if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
		// Redirect authenticated users away from auth pages to main app
		if (sessionCookie && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
			return NextResponse.redirect(new URL("/documents", request.url));
		}
		return NextResponse.next();
	}

	// Redirect unauthenticated users to sign-in
	if (!sessionCookie) {
		const signInUrl = new URL("/auth/sign-in", request.url);
		signInUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(signInUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (png, svg, etc.)
		 * - service worker files
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|sw.js|workbox-.*\\.js).*)",
	],
};
