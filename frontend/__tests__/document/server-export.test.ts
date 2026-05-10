import { describe, expect, it } from "vitest";
import {
	MAX_RENDER_CONTENT_BYTES,
	describeRenderError,
	sanitizeRenderFilename,
} from "@/lib/document/server-export";

// triggerBlobDownload is exercised indirectly by the component tests
// (DocumentActionsMenu / PublishingToolbar). It only touches DOM
// primitives — document.createElement, body.append/remove,
// URL.createObjectURL / revokeObjectURL — and the project default
// vitest env is `node` without jsdom installed. Splitting that
// DOM-bound helper into its own jsdom-env test file is not worth a
// new dependency for one assertion; static review of the function
// is the existing convention.

describe("sanitizeRenderFilename", () => {
	it("collapses non-word chars and appends the extension", () => {
		expect(sanitizeRenderFilename("Quarterly Report (2026)", "pdf")).toBe(
			"Quarterly_Report_2026.pdf",
		);
	});

	it("strips leading and trailing underscores", () => {
		expect(sanitizeRenderFilename("--Report--", "docx")).toBe("Report.docx");
	});

	it("falls back to 'document' when the title is empty after normalization", () => {
		expect(sanitizeRenderFilename("📄✨🎯", "pdf")).toBe("document.pdf");
		expect(sanitizeRenderFilename("———", "pdf")).toBe("document.pdf");
		expect(sanitizeRenderFilename("", "pdf")).toBe("document.pdf");
	});

	it("caps the stem at 120 chars to stay under filesystem limits", () => {
		const long = "a".repeat(500);
		const result = sanitizeRenderFilename(long, "pdf");
		// 120 stem + 4 extension
		expect(result.length).toBe(124);
		expect(result.endsWith(".pdf")).toBe(true);
	});
});

describe("describeRenderError", () => {
	function withStatus(status: number): Response {
		return new Response(null, { status });
	}

	it("masks 422 validator dumps with a friendly message", () => {
		expect(
			describeRenderError(
				withStatus(422),
				'{"detail":[{"loc":["body","content_override"],"msg":"String should have at most 2000000 characters"}]}',
			),
		).toBe("Document content is invalid or too large to render.");
	});

	it("masks 413 the same way", () => {
		expect(describeRenderError(withStatus(413), "Payload Too Large")).toBe(
			"Document content is invalid or too large to render.",
		);
	});

	it("distinguishes auth errors from validation errors", () => {
		expect(describeRenderError(withStatus(401), "")).toBe(
			"You don't have permission to export this document.",
		);
		expect(describeRenderError(withStatus(403), "")).toBe(
			"You don't have permission to export this document.",
		);
	});

	it("surfaces 404 as 'Document not found'", () => {
		expect(describeRenderError(withStatus(404), "")).toBe("Document not found.");
	});

	it("treats 502 as a transient upstream outage", () => {
		expect(describeRenderError(withStatus(502), "")).toBe(
			"Render service is unreachable. Try again in a moment.",
		);
	});

	it("treats 504 as a render timeout with retry guidance", () => {
		expect(describeRenderError(withStatus(504), "")).toBe(
			"Render service timed out. Try a smaller document or retry shortly.",
		);
	});

	it("includes the status code on generic 5xx", () => {
		expect(describeRenderError(withStatus(503), "")).toBe(
			"Render failed (HTTP 503).",
		);
	});

	it("falls back to upstream text on unmapped statuses", () => {
		expect(describeRenderError(withStatus(418), "I'm a teapot")).toBe(
			"I'm a teapot",
		);
	});
});

describe("MAX_RENDER_CONTENT_BYTES", () => {
	it("matches the backend RenderRequest.content_override max_length", () => {
		// If the backend cap moves, raise this constant in lockstep —
		// the client guard must always be <= server limit so we never
		// leak the raw 422 phrasing to the user.
		expect(MAX_RENDER_CONTENT_BYTES).toBe(2_000_000);
	});
});
