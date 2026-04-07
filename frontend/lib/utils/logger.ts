import { captureException } from "@/lib/monitoring/sentry";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel: LogLevel =
	process.env.NODE_ENV === "production" ? "warn" : "debug";

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
	debug: (...args: unknown[]): void => {
		if (shouldLog("debug")) console.debug("[DEBUG]", ...args);
	},
	info: (...args: unknown[]): void => {
		if (shouldLog("info")) console.info("[INFO]", ...args);
	},
	warn: (...args: unknown[]): void => {
		if (shouldLog("warn")) console.warn("[WARN]", ...args);
	},
	error: (...args: unknown[]): void => {
		if (shouldLog("error")) console.error("[ERROR]", ...args);
	},
};

/**
 * Log an error and report it to Sentry in a single call.
 *
 * Use this instead of separate logger.error + captureException calls
 * to ensure errors are both logged locally and forwarded to the
 * monitoring backend.
 *
 * @param error - The error or throwable value to report
 * @param context - Optional structured metadata for Sentry's `extra` field
 */
export function reportError(
	error: unknown,
	context?: Record<string, unknown>,
): void {
	logger.error(error);
	captureException(error, context);
}
