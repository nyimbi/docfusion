/**
 * Debug logging utility for DocFusion.
 *
 * Provides structured logging that can be disabled in production.
 * Each logger instance has a namespace for easy filtering.
 */

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const DEBUG_ENABLED = IS_DEVELOPMENT || process.env.NEXT_PUBLIC_DEBUG === "true";

/**
 * Log levels for filtering output.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Color codes for different log levels in browser console.
 */
const LOG_COLORS: Record<LogLevel, string> = {
	debug: "#888888",
	info: "#2196F3",
	warn: "#FF9800",
	error: "#F44336",
};

/**
 * Creates a namespaced debug logger.
 *
 * @param namespace - The logger namespace (e.g., "Yjs", "Pusher")
 * @param enabled - Override the default enabled state
 *
 * @example
 * ```ts
 * const log = createDebugLogger("Yjs");
 * log.info("Document synced", { docId: "123" });
 * log.error("Sync failed", error);
 * ```
 */
export function createDebugLogger(namespace: string, enabled = DEBUG_ENABLED) {
	const prefix = `[${namespace}]`;

	const createLogFn =
		(level: LogLevel, consoleFn: typeof console.log) =>
		(message: string, ...args: unknown[]) => {
			if (!enabled) return;

			const color = LOG_COLORS[level];
			const timestamp = new Date().toISOString().slice(11, 23);

			// In development, use colored output
			if (typeof window !== "undefined" && IS_DEVELOPMENT) {
				consoleFn(
					`%c${timestamp} ${prefix} ${message}`,
					`color: ${color}; font-weight: ${level === "error" ? "bold" : "normal"}`,
					...args
				);
			} else {
				// In production (if enabled) or server-side, use plain output
				consoleFn(`${timestamp} ${prefix} ${message}`, ...args);
			}
		};

	return {
		debug: createLogFn("debug", console.log),
		info: createLogFn("info", console.log),
		warn: createLogFn("warn", console.warn),
		error: createLogFn("error", console.error),
		/**
		 * Log only in development, always disabled in production.
		 */
		devOnly: (message: string, ...args: unknown[]) => {
			if (IS_DEVELOPMENT) {
				console.log(`[${namespace}] ${message}`, ...args);
			}
		},
	};
}

/**
 * Pre-configured loggers for common namespaces.
 */
export const loggers = {
	yjs: createDebugLogger("Yjs"),
	pusher: createDebugLogger("Pusher"),
	pusherYjs: createDebugLogger("PusherYjs"),
	query: createDebugLogger("Query"),
	ai: createDebugLogger("AI"),
};

/**
 * Disable all debug logging.
 * Call this in production entry point if needed.
 */
export function disableDebugLogging() {
	Object.values(loggers).forEach((logger) => {
		// Replace all methods with no-ops
		Object.keys(logger).forEach((key) => {
			(logger as Record<string, unknown>)[key] = () => {};
		});
	});
}
