import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge.
 *
 * This utility solves the problem of conflicting Tailwind classes:
 * - clsx handles conditional classes and arrays
 * - twMerge resolves Tailwind conflicts (e.g., "px-2 px-4" → "px-4")
 *
 * @example
 * cn("px-2 py-1", condition && "bg-red-500", "px-4")
 * // Returns: "py-1 px-4 bg-red-500" (if condition is true)
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Formats a date for display.
 * Uses Intl.DateTimeFormat for localization support.
 */
export function formatDate(
	date: Date | string | number,
	options: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
	}
): string {
	return new Intl.DateTimeFormat("en-US", options).format(new Date(date));
}

/**
 * Formats a relative time (e.g., "2 hours ago", "in 3 days").
 */
export function formatRelativeTime(date: Date | string | number): string {
	const now = Date.now();
	const target = new Date(date).getTime();
	const diffInSeconds = Math.floor((target - now) / 1000);
	const absSeconds = Math.abs(diffInSeconds);

	const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
		{ unit: "year", seconds: 31536000 },
		{ unit: "month", seconds: 2592000 },
		{ unit: "week", seconds: 604800 },
		{ unit: "day", seconds: 86400 },
		{ unit: "hour", seconds: 3600 },
		{ unit: "minute", seconds: 60 },
		{ unit: "second", seconds: 1 },
	];

	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

	for (const { unit, seconds } of units) {
		if (absSeconds >= seconds || unit === "second") {
			const value = Math.floor(diffInSeconds / seconds);
			return rtf.format(value, unit);
		}
	}

	return "just now";
}

/**
 * Debounces a function call.
 * Returns a function that will only execute after `wait` ms have passed
 * since the last invocation.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			func(...args);
			timeoutId = null;
		}, wait);
	};
}

/**
 * Throttles a function call.
 * Ensures the function is called at most once per `limit` ms.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle = false;

	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}

/**
 * Generates a random ID for client-side use.
 * Not suitable for database IDs - use UUID v7 from backend.
 */
export function generateClientId(prefix = "id"): string {
	return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Safely parses JSON with a fallback value.
 */
export function safeParseJson<T>(json: string, fallback: T): T {
	try {
		return JSON.parse(json) as T;
	} catch {
		return fallback;
	}
}

/**
 * Truncates text to a maximum length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + "...";
}

/**
 * Converts bytes to human-readable format.
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Counts words in text content.
 */
export function countWords(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
}

/**
 * Estimates reading time in minutes.
 * Based on average reading speed of 200 words per minute.
 */
export function estimateReadingTime(text: string, wordsPerMinute = 200): number {
	const words = countWords(text);
	return Math.ceil(words / wordsPerMinute);
}
