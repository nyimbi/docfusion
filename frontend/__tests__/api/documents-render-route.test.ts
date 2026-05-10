import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// requireRouteTenantContext reads getServerSession from @/lib/auth-utils.
// Each test stubs the resolved session to drive the gating behaviour
// without spinning up NextAuth.
const sessionMock = vi.hoisted(() => ({
	getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => sessionMock);

import { POST } from "@/app/api/v1/documents/[documentId]/render/route";

const VALID_DOCUMENT_ID = "069fd26a-1099-787c-8000-0e7fd09e2b39";

function renderRequest(
	body: Record<string, unknown> = { output_format: "pdf" },
	documentId: string = VALID_DOCUMENT_ID,
) {
	return new NextRequest(
		`http://localhost/api/v1/documents/${documentId}/render`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
	);
}

function paramsFor(documentId: string) {
	return { params: Promise.resolve({ documentId }) };
}

beforeEach(() => {
	vi.clearAllMocks();
	sessionMock.getServerSession.mockResolvedValue({
		user: { id: "user-1", organizationId: "org-1" },
	});
});

describe("Documents render BFF route", () => {
	it("returns 401 when no session", async () => {
		sessionMock.getServerSession.mockResolvedValue(null);

		const res = await POST(renderRequest(), paramsFor(VALID_DOCUMENT_ID));

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Unauthorized" });
	});

	it("returns 403 when session has no organizationId", async () => {
		sessionMock.getServerSession.mockResolvedValue({
			user: { id: "user-1" }, // organizationId missing
		});

		const res = await POST(renderRequest(), paramsFor(VALID_DOCUMENT_ID));

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "No organization context" });
	});

	it("rejects a documentId that fails the safe-char regex", async () => {
		const res = await POST(
			renderRequest({ output_format: "pdf" }, "../etc/passwd"),
			paramsFor("../etc/passwd"),
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "Invalid documentId" });
	});

	it("rejects an empty documentId", async () => {
		const res = await POST(renderRequest({ output_format: "pdf" }, ""), paramsFor(""));
		expect(res.status).toBe(400);
	});

	it.each([
		[".."],
		["."],
		["..."],
		[".envrc"],
		["-startsWithDash"],
		["_startsWithUnderscore"],
	])("rejects dotfile-shaped or sigil-leading documentId %s", async (badId) => {
		const res = await POST(renderRequest({ output_format: "pdf" }, badId), paramsFor(badId));
		expect(res.status).toBe(400);
	});

	it("forwards the request to FastAPI with tenant headers and pipes the binary body back", async () => {
		const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(fakePdf, {
					status: 200,
					headers: {
						"content-type": "application/pdf",
						"content-disposition": `attachment; filename="${VALID_DOCUMENT_ID}.pdf"`,
					},
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const res = await POST(
			renderRequest({ output_format: "pdf", content_override: "<h1>Hi</h1>" }),
			paramsFor(VALID_DOCUMENT_ID),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/pdf");
		expect(res.headers.get("content-disposition")).toContain(
			`${VALID_DOCUMENT_ID}.pdf`,
		);

		expect(fetchMock).toHaveBeenCalledOnce();
		const call = fetchMock.mock.calls[0];
		expect(call).toBeDefined();
		const [url, init] = call!;
		expect(url).toBe(
			`http://localhost:8000/api/v1/documents/${VALID_DOCUMENT_ID}/render`,
		);
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers["x-docfusion-user-id"]).toBe("user-1");
		expect(headers["x-docfusion-organization-id"]).toBe("org-1");
		expect(headers["Content-Type"]).toBe("application/json");

		// Body forwarded verbatim — the BFF does not re-shape the JSON.
		expect(JSON.parse(init?.body as string)).toEqual({
			output_format: "pdf",
			content_override: "<h1>Hi</h1>",
		});

		// Binary payload should reach the response intact.
		const buffer = new Uint8Array(await res.arrayBuffer());
		expect(buffer).toEqual(fakePdf);
	});

	it("returns 502 when the upstream fetch throws", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("ECONNREFUSED");
			}),
		);

		const res = await POST(renderRequest(), paramsFor(VALID_DOCUMENT_ID));
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: "Render service unreachable" });
	});
});
