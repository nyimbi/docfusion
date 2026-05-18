/**
 * Next.js Middleware for Route Protection and API Rate Limiting
 *
 * Protects application routes by checking for valid Next-Auth session.
 * Redirects unauthenticated users to sign-in and authenticated users
 * away from auth pages.
 *
 * Applies in-memory rate limiting to all /api/* routes:
 * 100 requests per 15 minutes per trusted proxy client IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// Rate limiting configuration and store
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in ms
const RATE_LIMIT_MAX = 100; // Max requests per window per IP

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

// In-memory store keyed by trusted client IP
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
 * Resolve the client IP from trusted reverse-proxy metadata.
 *
 * X-Forwarded-For can include client-supplied values when the proxy appends
 * rather than overwrites it, so it is intentionally not trusted here.
 */
export function getClientIp(request: NextRequest): string | null {
	const realIp = request.headers.get("x-real-ip")?.trim();
	return realIp || null;
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

const PUBLIC_API_PATHS = ["/api/auth"];

// Auth pages that authenticated users should be redirected away from
const AUTH_PATHS = ["/auth/sign-in", "/auth/sign-up", "/auth/forgot-password"];

const TENANT_CONTEXT_HEADERS = [
	"x-docfusion-user-id",
	"x-docfusion-organization-id",
	"x-docfusion-tenant-timestamp",
	"x-docfusion-tenant-signature",
];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// ---- Rate limiting for API routes ----
	if (pathname.startsWith("/api/")) {
		const ip = getClientIp(request);
		if (!ip) {
			return NextResponse.json(
				{ error: "Missing trusted client IP" },
				{ status: 400 },
			);
		}
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

		if (!PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
			const token = await getToken({
				req: request,
				secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
			});

			if (!token) {
				return NextResponse.json(
					{ error: "Unauthorized" },
					{
						status: 401,
						headers: {
							"X-RateLimit-Limit": String(RATE_LIMIT_MAX),
							"X-RateLimit-Remaining": String(remaining),
							"X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
						},
					},
				);
			}
		}

		const forwardedHeaders = new Headers(request.headers);
		for (const header of TENANT_CONTEXT_HEADERS) {
			forwardedHeaders.delete(header);
		}

		// Allow the request through, attaching rate-limit headers to the response
		const response = NextResponse.next({
			request: {
				headers: forwardedHeaders,
			},
		});
		response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
		response.headers.set("X-RateLimit-Remaining", String(remaining));
		response.headers.set(
			"X-RateLimit-Reset",
			String(Math.ceil(resetTime / 1000)),
		);
		return response;
	}

	// ---- Auth route protection ----
	// Check for Next-Auth JWT token in cookies
	const token = await getToken({
		req: request,
		secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
	});
	const isAuthenticated = !!token;

	// Allow public paths and static assets
	if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
		// Redirect authenticated users away from auth pages to main app
		if (isAuthenticated && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
			return NextResponse.redirect(new URL("/documents", request.url));
		}
		return NextResponse.next();
	}

	// Redirect unauthenticated users to sign-in
	if (!isAuthenticated) {
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
