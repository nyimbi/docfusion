import { describe, expect, it } from "vitest";
import { scanRfpUploadBuffer, validateRfpUploadMetadata } from "@/lib/rfp/upload-validation";

describe("RFP upload validation", () => {
	it("rejects unsupported metadata before storage or parser handoff", () => {
		expect(validateRfpUploadMetadata({
			filename: "malware.exe",
			contentType: "application/octet-stream",
			size: 10,
		})).toMatchObject({
			valid: false,
			fileType: null,
			errors: expect.arrayContaining([
				expect.stringContaining("Unsupported file type"),
				"Unsupported content type: application/octet-stream",
			]),
		});
	});

	it("records file signature warnings without blocking valid extensions", () => {
		expect(scanRfpUploadBuffer(Buffer.from("not really a pdf"), "pdf")).toEqual({
			status: "warning",
			findings: ["pdf_signature_not_confirmed"],
		});
		expect(scanRfpUploadBuffer(Buffer.from("%PDF-1.7"), "pdf")).toEqual({
			status: "passed",
			findings: [],
		});
	});

	it("fails empty uploads", () => {
		expect(scanRfpUploadBuffer(Buffer.alloc(0), "pdf")).toEqual({
			status: "failed",
			findings: ["empty_file"],
		});
	});
});

