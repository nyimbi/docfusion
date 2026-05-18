import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
	getToken: getTokenMock,
}));

import { getClientIp, middleware } from "../../middleware";

function apiRequest(
	path: string,
	init: { headers?: HeadersInit; method?: string; body?: BodyInit | null } = {},
): NextRequest {
	const headers = new Headers(init.headers);
	if (!headers.has("x-real-ip")) {
		headers.set("x-real-ip", "198.51.100.7");
	}
	return new NextRequest(`https://app.test${path}`, {
		method: init.method,
		body: init.body,
		headers,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("middleware API protection", () => {
	it("rejects non-public API requests without a session token", async () => {
		getTokenMock.mockResolvedValueOnce(null);

		const response = await middleware(
			apiRequest("/api/v1/opportunities"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(getTokenMock).toHaveBeenCalledOnce();
	});

	it("allows public auth API routes without consulting the session token", async () => {
		const response = await middleware(
			apiRequest("/api/auth/session"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(getTokenMock).not.toHaveBeenCalled();
	});

	it("allows authenticated API requests through to route handlers or rewrites", async () => {
		getTokenMock.mockResolvedValueOnce({ sub: "user-1" });

		const response = await middleware(
			apiRequest("/api/v1/opportunities"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(getTokenMock).toHaveBeenCalledOnce();
	});

	it("strips tenant identity headers before API rewrites", async () => {
		getTokenMock.mockResolvedValueOnce({ sub: "user-1" });

		const response = await middleware(
			apiRequest("/api/v1/rfp/upload", {
				headers: {
					"x-real-ip": "198.51.100.7",
					"x-docfusion-user-id": "attacker",
					"x-docfusion-organization-id": "victim-org",
					"x-docfusion-tenant-timestamp": "9999999999",
					"x-docfusion-tenant-signature": "bad",
				},
			}),
		);

		const overriddenHeaders = response.headers.get("x-middleware-override-headers") ?? "";
		expect(overriddenHeaders).not.toContain("x-docfusion-user-id");
		expect(overriddenHeaders).not.toContain("x-docfusion-organization-id");
		expect(overriddenHeaders).not.toContain("x-docfusion-tenant-timestamp");
		expect(overriddenHeaders).not.toContain("x-docfusion-tenant-signature");
		expect(response.headers.get("x-middleware-request-x-docfusion-user-id")).toBeNull();
		expect(response.headers.get("x-middleware-request-x-docfusion-organization-id")).toBeNull();
	});

	it("uses trusted X-Real-IP instead of spoofable X-Forwarded-For", () => {
		const request = apiRequest("/api/v1/opportunities", {
			headers: {
				"x-forwarded-for": "203.0.113.99, 10.0.0.4",
				"x-real-ip": "198.51.100.7",
			},
		});

		expect(getClientIp(request)).toBe("198.51.100.7");
	});

	it("continues API auth checks when the trusted client IP header is missing", async () => {
		getTokenMock.mockResolvedValueOnce(null);

		const response = await middleware(
			new NextRequest("https://app.test/api/v1/opportunities"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(response.headers.get("x-ratelimit-limit")).toBeNull();
		expect(getTokenMock).toHaveBeenCalledOnce();
	});

	it("does not collapse missing trusted IPs into an unknown limiter key", () => {
		const request = new NextRequest("https://app.test/api/v1/opportunities", {
			headers: {
				"x-forwarded-for": "203.0.113.99, 10.0.0.4",
			},
		});

		expect(getClientIp(request)).toBeNull();
	});
});
