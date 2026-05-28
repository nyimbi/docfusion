import { describe, expect, it } from "vitest";
import { cleanTextForUtf8Storage, extractReadableTextFromBinaryDocument } from "@/lib/documents/binary-text";

describe("binary document text extraction", () => {
	it("extracts readable procurement text from legacy binary documents without NUL bytes", () => {
		const readableText = [
			"Request for Proposal for procurement of data loggers.",
			"Tender submission must include delivery schedule, warranty, bidder qualifications, and pricing.",
			"Expression of Interest responses are due before the submission deadline.",
		].join(" ");
		const buffer = Buffer.concat([
			Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00]),
			Buffer.from(readableText, "utf16le"),
		]);

		const text = extractReadableTextFromBinaryDocument(buffer);

		expect(text).toContain("Request for Proposal");
		expect(text).toContain("Tender submission");
		expect(text).not.toContain("\u0000");
	});

	it("removes unsafe control bytes from decoded text", () => {
		expect(cleanTextForUtf8Storage("alpha\u0000beta\u0007 gamma")).toBe("alpha beta gamma");
	});
});
