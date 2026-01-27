/** API client for backend communication */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/**
 * Convenience API client object with standard HTTP methods.
 */
export const apiClient = {
	get: <T>(endpoint: string, options?: RequestInit) =>
		fetcher<T>(endpoint, { ...options, method: "GET" }),
	post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
		fetcher<T>(endpoint, {
			...options,
			method: "POST",
			body: body ? JSON.stringify(body) : undefined,
		}),
	put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
		fetcher<T>(endpoint, {
			...options,
			method: "PUT",
			body: body ? JSON.stringify(body) : undefined,
		}),
	patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
		fetcher<T>(endpoint, {
			...options,
			method: "PATCH",
			body: body ? JSON.stringify(body) : undefined,
		}),
	delete: <T>(endpoint: string, options?: RequestInit) =>
		fetcher<T>(endpoint, { ...options, method: "DELETE" }),
};

/**
 * Standard JSON fetcher for API requests.
 */
export async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

/**
 * Streaming fetcher for Server-Sent Events (SSE) responses.
 * Returns an async generator that yields text chunks.
 */
export async function* fetcherStream(
	endpoint: string,
	options?: RequestInit
): AsyncGenerator<string, void, undefined> {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
			...options?.headers,
		},
	});

	if (!res.ok) {
		throw new Error(await res.text());
	}

	if (!res.body) {
		throw new Error("Response body is null");
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			yield chunk;
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * API error class with status code.
 */
export class APIError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "APIError";
		this.status = status;
	}
}

/**
 * Enhanced fetcher with better error handling.
 */
export async function fetcherWithError<T>(
	endpoint: string,
	options?: RequestInit
): Promise<T> {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new APIError(errorText || res.statusText, res.status);
	}

	return res.json();
}
