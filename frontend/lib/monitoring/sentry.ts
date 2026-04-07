/**
 * Sentry error monitoring configuration for DocFusion.
 *
 * This module provides an optional integration with Sentry for error tracking,
 * performance monitoring, and session replay on errors. The integration is
 * completely optional -- the application functions identically without it.
 *
 * Setup:
 *   1. npm install @sentry/nextjs
 *   2. Add NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/... to .env.local
 *
 * Architecture notes:
 *   - Sentry is loaded lazily via dynamic import to avoid bundling it when
 *     the DSN is not configured or the package is not installed.
 *   - All public functions are no-ops when Sentry is unavailable, so callers
 *     never need to check availability themselves.
 *   - PII (email, IP) is stripped from events via beforeSend to comply with
 *     data minimization principles.
 */

type SentryModule = typeof import("@sentry/nextjs");

let _sentry: SentryModule | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Initialize the Sentry SDK. Safe to call multiple times -- subsequent calls
 * are no-ops. Returns immediately if NEXT_PUBLIC_SENTRY_DSN is not set.
 *
 * Call this once at application startup (e.g. in a root layout or
 * instrumentation hook).
 */
export async function initSentry(): Promise<void> {
	// Deduplicate concurrent initialization attempts
	if (_initPromise) return _initPromise;

	_initPromise = _doInit();
	return _initPromise;
}

async function _doInit(): Promise<void> {
	const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
	if (!dsn) return;

	try {
		const mod = await import("@sentry/nextjs");
		mod.init({
			dsn,
			environment: process.env.NODE_ENV,
			// In production, sample 10% of transactions for performance monitoring.
			// In development, capture everything for full observability.
			tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
			// Session replays: only capture replays when an error occurs.
			replaysSessionSampleRate: 0,
			replaysOnErrorSampleRate: 1.0,
			beforeSend(event) {
				// Strip personally identifiable information from error reports.
				// We keep the user ID for correlation but remove email and IP.
				if (event.user) {
					delete event.user.email;
					delete event.user.ip_address;
				}
				return event;
			},
		});
		_sentry = mod;
	} catch {
		// @sentry/nextjs is not installed -- silent fallback.
		// This is expected in development environments or deployments
		// that have not opted into Sentry.
	}
}

/**
 * Report an exception to Sentry with optional structured context.
 *
 * No-op when Sentry is not initialized.
 *
 * @param error - The error or throwable value to report
 * @param context - Arbitrary key-value metadata attached as `extra` on the event
 */
export function captureException(
	error: unknown,
	context?: Record<string, unknown>,
): void {
	if (_sentry) {
		_sentry.captureException(error, { extra: context });
	}
}

/**
 * Send a structured message to Sentry at the given severity level.
 *
 * No-op when Sentry is not initialized.
 *
 * @param message - Human-readable message string
 * @param level - Sentry severity level (defaults to "info")
 */
export function captureMessage(
	message: string,
	level: "info" | "warning" | "error" = "info",
): void {
	if (_sentry) {
		_sentry.captureMessage(message, level);
	}
}

/**
 * Associate the current Sentry scope with a user. Pass null to clear
 * the user context (e.g. on logout).
 *
 * Only the user ID and optional username are forwarded -- email and
 * other PII fields are intentionally excluded.
 *
 * No-op when Sentry is not initialized.
 *
 * @param user - User identity to associate, or null to clear
 */
export function setUser(
	user: { id: string; username?: string } | null,
): void {
	if (_sentry) {
		_sentry.setUser(user);
	}
}
