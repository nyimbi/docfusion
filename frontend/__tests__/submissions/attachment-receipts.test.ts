import { describe, expect, it } from "vitest";
import { submissionAttachmentReceiptLines } from "@/lib/submissions/attachment-receipts";
import type { SubmissionAttachment } from "@/lib/types/opportunity";

describe("submission attachment receipt formatting", () => {
	it("summarizes final artifact storage, hash, approval, source, and lock receipts", () => {
		const attachment: SubmissionAttachment = {
			documentId: "doc-1",
			documentTitle: "Technical Approach",
			documentType: "technical_approach",
			filename: "technical-approach.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			size: 2048,
			artifactHash: "a".repeat(64),
			storageBucket: "mansa",
			storageKey: "proposal/final-artifacts/opp-1/doc-1/technical-approach.docx",
			approvedBy: "proposal-manager-1",
			approvedAt: "2026-05-05T01:00:00.000Z",
			sourceDocumentVersion: 4,
			sourceContentHash: "b".repeat(64),
			lockedAt: "2026-05-05T02:00:00.000Z",
		};

		const lines = submissionAttachmentReceiptLines(attachment);
		expect(lines.slice(0, 4)).toEqual([
			{ label: "File", value: "technical-approach.docx - 2 KB" },
			{
				label: "SHA-256",
				value: "aaaaaaaaaaaa...aaaa",
				title: "a".repeat(64),
				mono: true,
			},
			{
				label: "Storage",
				value: "mansa/proposal/final-artifacts/opp-1/doc-1/technical-approach.docx",
				mono: true,
			},
			{
				label: "Source",
				value: "v4 - bbbbbbbbbbbb...bbbb",
				title: "b".repeat(64),
				mono: true,
			},
		]);
		expect(lines[4]).toMatchObject({
			label: "Approved",
			value: expect.stringContaining("proposal-manager-1"),
		});
		expect(lines[5]).toMatchObject({ label: "Locked" });
	});

	it("falls back to document title and storage path for legacy attachments", () => {
		const attachment: SubmissionAttachment = {
			documentId: "doc-2",
			documentTitle: "Pricing Volume",
			documentType: "pricing",
			storagePath: "s3://mansa/submissions/legacy-pricing.docx",
		};

		expect(submissionAttachmentReceiptLines(attachment)).toEqual([
			{ label: "File", value: "Pricing Volume" },
			{
				label: "Storage",
				value: "s3://mansa/submissions/legacy-pricing.docx",
				mono: true,
			},
		]);
	});
});
