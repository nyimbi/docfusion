import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
vi.hoisted(() => {
	process.env.GOOGLE_CLIENT_ID = "google-client";
	process.env.GOOGLE_CLIENT_SECRET = "google-secret";
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/google/docs/[docId]/route";

function googleDocsRequest(cookies: Record<string, string>) {
	const cookieHeader = Object.entries(cookies)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("; ");
	return new NextRequest("https://app.test/api/v1/google/docs/doc-1", {
		headers: { cookie: cookieHeader },
	});
}

function googleDocResponse(title = "Capture Plan") {
	return {
		title,
		body: {
			content: [
				{
					paragraph: {
						elements: [
							{ textRun: { content: "Hello world" } },
						],
					},
				},
			],
		},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({ user: { id: "user-1" } });
	vi.stubGlobal("fetch", vi.fn());
});

describe("Google Docs route", () => {
	it("persists a refreshed access token when the first document fetch succeeds", async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "new-access" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}))
			.mockResolvedValueOnce(new Response(JSON.stringify(googleDocResponse()), {
				status: 200,
				headers: { "content-type": "application/json" },
			}));

		const response = await GET(googleDocsRequest({
			google_app_user_id: "user-1",
			google_refresh_token: "refresh-token",
			google_user_email: "user@example.test",
		}), {
			params: Promise.resolve({ docId: "doc-1" }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			success: true,
			title: "Capture Plan",
			content: "Hello world",
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://docs.googleapis.com/v1/documents/doc-1",
			expect.objectContaining({
				headers: { Authorization: "Bearer new-access" },
			})
		);
		const setCookies = response.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("google_access_token=new-access");
		expect(setCookies).toContain("google_refresh_token=refresh-token");
		expect(setCookies).toContain("google_app_user_id=user-1");
	});

	it("persists a refreshed access token after a 401 retry succeeds", async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "expired" } }), {
				status: 401,
				headers: { "content-type": "application/json" },
			}))
			.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "retry-access" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}))
			.mockResolvedValueOnce(new Response(JSON.stringify(googleDocResponse("Retry Plan")), {
				status: 200,
				headers: { "content-type": "application/json" },
			}));

		const response = await GET(googleDocsRequest({
			google_app_user_id: "user-1",
			google_access_token: "old-access",
			google_refresh_token: "refresh-token",
			google_user_email: "user@example.test",
		}), {
			params: Promise.resolve({ docId: "doc-1" }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			success: true,
			title: "Retry Plan",
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"https://docs.googleapis.com/v1/documents/doc-1",
			expect.objectContaining({
				headers: { Authorization: "Bearer retry-access" },
			})
		);
		const setCookies = response.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("google_access_token=retry-access");
		expect(setCookies).toContain("google_refresh_token=refresh-token");
		expect(setCookies).toContain("google_app_user_id=user-1");
	});
});
