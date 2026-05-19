/**
 * Shared client-side helpers for server-rendered document exports.
 *
 * Both `DocumentActionsMenu` (editor HTML) and `PublishingToolbar`
 * (HDSI tree) POST to `/api/v1/documents/{id}/render` and download the
 * resulting binary blob. This module factors out the parts that are
 * easy to get subtly wrong:
 *
 * - bounding the payload before it hits the network
 * - producing a filesystem-safe filename from an untrusted title
 * - mapping backend errors to messages a user can act on
 * - triggering the download without revoking the blob URL too early
 */

// Mirrors the server-side max_length on RenderRequest.content_override.
// Keep these constants in lockstep; if the backend grows the cap, raise
// this one too rather than letting the server's 422 surface to users.
export const MAX_RENDER_CONTENT_BYTES = 2_000_000;

/**
 * Build a download filename for a server-rendered export.
 *
 * - Collapses runs of non-word chars to underscores
 * - Strips leading/trailing underscores
 * - Caps the stem at 120 chars so we stay well under common filesystem
 *   limits even after the extension is appended
 * - Falls back to "document" when the title is empty after normalization
 *   (e.g. all-emoji, all-CJK, or all-whitespace titles)
 */
export function sanitizeRenderFilename(title: string, format: string): string {
	const stem = title
		.replace(/[^\w]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 120);
	return `${stem || "document"}.${format}`;
}

/**
 * Translate an upstream render failure into a user-facing message.
 *
 * Avoids leaking raw FastAPI validator dumps (e.g. nested `{"detail":
 * [{"loc": [...], "msg": ...}]}` from a 422) into a toast. Falls back
 * to the upstream text only when the status code is unrecognized.
 */
export function describeRenderError(
	response: Response,
	upstreamText: string,
): string {
	if (response.status === 413 || response.status === 422) {
		return "Document content is invalid or too large to render.";
	}
	if (response.status === 401 || response.status === 403) {
		return "You don't have permission to export this document.";
	}
	if (response.status === 404) {
		return "Document not found.";
	}
	if (response.status === 502) {
		return "Render service is unreachable. Try again in a moment.";
	}
	if (response.status === 504) {
		return "Render service timed out. Try a smaller document or retry shortly.";
	}
	if (response.status >= 500) {
		return `Render failed (HTTP ${response.status}).`;
	}
	return upstreamText || `Render failed (HTTP ${response.status}).`;
}

/**
 * Trigger a browser download for a blob, then defer URL revocation.
 *
 * Safari and Firefox have intermittently dropped downloads when the
 * blob URL was revoked in the same task as the synthetic click. The
 * setTimeout-0 schedules the revoke on the next task, which is the
 * documented workaround. Chrome is unaffected but the delay is
 * harmless there.
 *
 * Appending the anchor to `body` is required for Firefox — programmatic
 * clicks on detached anchors are ignored on that engine.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function buildIsolatedPrintHtml(title: string, bodyHtml: string): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || "Document")}</title>
<style>
	body {
		margin: 0;
		padding: 32px;
		color: #111827;
		background: #fff;
		font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
		line-height: 1.55;
	}
	main {
		max-width: 760px;
		margin: 0 auto;
	}
	img, svg {
		max-width: 100%;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th, td {
		border: 1px solid #d1d5db;
		padding: 6px 8px;
	}
	@page {
		margin: 0.75in;
	}
</style>
</head>
<body>
<main>${bodyHtml || "<p></p>"}</main>
<script>
	window.addEventListener("load", function () {
		window.focus();
		window.print();
	});
	window.addEventListener("afterprint", function () {
		window.close();
	});
</script>
</body>
</html>`;
}

export function printIsolatedHtmlDocument(title: string, bodyHtml: string): void {
	const printWindow = window.open("", "_blank");
	if (!printWindow) {
		throw new Error("Print window was blocked. Allow pop-ups and try again.");
	}

	printWindow.opener = null;
	printWindow.document.open();
	printWindow.document.write(buildIsolatedPrintHtml(title, bodyHtml));
	printWindow.document.close();
}
