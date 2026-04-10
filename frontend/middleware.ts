/**
 * Next.js Middleware for Route Protection and API Rate Limiting
 *
 * Protects application routes by checking for valid session cookies.
 * Redirects unauthenticated users to sign-in and authenticated users
 * away from auth pages.
 *
 * Applies in-memory rate limiting to all /api/* routes:
 * 100 requests per 15 minutes per IP address.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// ---------------------------------------------------------------------------
// Rate limiting configuration and store
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in ms
const RATE_LIMIT_MAX = 100; // Max requests per window per IP

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

// In-memory store keyed by client IP
const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries every 5 minutes to prevent memory leaks.
// Runs on a setInterval so it only fires once per server process lifetime.
let cleanupStarted = false;

function startCleanup() {
	if (cleanupStarted) return;
	cleanupStarted = true;
	setInterval(() => {
		const now = Date.now();
		rateLimitStore.forEach((entry, ip) => {
			if (now > entry.resetTime) {
				rateLimitStore.delete(ip);
			}
		});
	}, 5 * 60 * 1000);
}

/**
 * Resolve the client IP from the request, accounting for reverse proxies
 * that set X-Forwarded-For.
 */
function getClientIp(request: NextRequest): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		// X-Forwarded-For may contain multiple IPs; the first is the original client
		return forwarded.split(",")[0].trim();
	}
	// Fallback: Next.js may populate this from the connection
	return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Check rate limit for a given IP. Returns { allowed, remaining, resetTime }.
 */
function checkRateLimit(ip: string): {
	allowed: boolean;
	remaining: number;
	resetTime: number;
} {
	startCleanup();

	const now = Date.now();
	const entry = rateLimitStore.get(ip);

	// No existing entry or window has expired - start fresh
	if (!entry || now > entry.resetTime) {
		const resetTime = now + RATE_LIMIT_WINDOW;
		rateLimitStore.set(ip, { count: 1, resetTime });
		return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetTime };
	}

	// Within current window - increment counter
	entry.count += 1;

	if (entry.count > RATE_LIMIT_MAX) {
		return { allowed: false, remaining: 0, resetTime: entry.resetTime };
	}

	return {
		allowed: true,
		remaining: RATE_LIMIT_MAX - entry.count,
		resetTime: entry.resetTime,
	};
}

// ---------------------------------------------------------------------------
// Route protection configuration
// ---------------------------------------------------------------------------

// Routes that don't require authentication
const PUBLIC_PATHS = ["/auth", "/api/auth", "/", "/hdsi"];

// Auth pages that authenticated users should be redirected away from
const AUTH_PATHS = ["/auth/sign-in", "/auth/sign-up", "/auth/forgot-password"];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// ---- Rate limiting for API routes ----
	if (pathname.startsWith("/api/")) {
		const ip = getClientIp(request);
		const { allowed, remaining, resetTime } = checkRateLimit(ip);

		if (!allowed) {
			const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
			return new NextResponse(
				JSON.stringify({
					error: "Too Many Requests",
					message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"Retry-After": String(retryAfter),
						"X-RateLimit-Limit": String(RATE_LIMIT_MAX),
						"X-RateLimit-Remaining": "0",
						"X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
					},
				},
			);
		}

		// Allow the request through, attaching rate-limit headers to the response
		const response = NextResponse.next();
		response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
		response.headers.set("X-RateLimit-Remaining", String(remaining));
		response.headers.set(
			"X-RateLimit-Reset",
			String(Math.ceil(resetTime / 1000)),
		);
		return response;
	}

	// ---- Auth route protection (existing logic) ----
	const sessionCookie = getSessionCookie(request);

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