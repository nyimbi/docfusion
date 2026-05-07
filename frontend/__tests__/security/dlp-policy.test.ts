import { describe, expect, it } from "vitest";
import {
	hasBlockingDlpFindings,
	scanDocumentForDlpFindings,
	summarizeDlpFindings,
} from "@/lib/security/dlp-policy";

describe("DLP policy scanner", () => {
	it("detects blocking secrets without returning the secret value", () => {
		const findings = scanDocumentForDlpFindings({
			documentId: "doc-1",
			title: "Technical Approach",
			content: {
				type: "doc",
				content: [{
					type: "paragraph",
					content: [{ type: "text", text: "Deploy with -----BEGIN PRIVATE KEY----- hidden in docs." }],
				}],
			},
		});

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			documentId: "doc-1",
			category: "secret",
			severity: "critical",
			label: "Private key material",
		});
		expect(findings[0]?.excerpt).toContain("[REDACTED]");
		expect(findings[0]?.excerpt).not.toContain("BEGIN PRIVATE KEY");
		expect(hasBlockingDlpFindings(findings)).toBe(true);
		expect(summarizeDlpFindings(findings)).toBe("1 critical");
	});

	it("keeps medium financial findings advisory", () => {
		const findings = scanDocumentForDlpFindings({
			documentId: "doc-2",
			title: "Cost Volume",
			content: "Legacy card reference 4111 1111 1111 1111 must be removed from appendices.",
		});

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "financial",
			severity: "medium",
			label: "Payment card number",
		});
		expect(hasBlockingDlpFindings(findings)).toBe(false);
		expect(summarizeDlpFindings(findings)).toBe("1 medium");
	});
});
