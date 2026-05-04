"use client";

type SentryBrowserModule = typeof import("@sentry/nextjs");

let sentry: SentryBrowserModule | null = null;
let initPromise: Promise<SentryBrowserModule | null> | null = null;

async function getSentry(): Promise<SentryBrowserModule | null> {
	const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
	if (!dsn) return null;

	if (sentry) return sentry;
	if (!initPromise) {
		initPromise = import("@sentry/nextjs")
			.then((mod) => {
				mod.init({
					dsn,
					environment: process.env.NODE_ENV,
					tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
					replaysSessionSampleRate: 0,
					replaysOnErrorSampleRate: 1.0,
					beforeSend(event) {
						if (event.user) {
							delete event.user.email;
							delete event.user.ip_address;
						}
						return event;
					},
				});
				sentry = mod;
				return mod;
			})
			.catch(() => null);
	}

	return initPromise;
}

export function captureClientException(
	error: unknown,
	context?: Record<string, unknown>
): void {
	void getSentry().then((mod) => {
		mod?.captureException(error, { extra: context });
	});
}
