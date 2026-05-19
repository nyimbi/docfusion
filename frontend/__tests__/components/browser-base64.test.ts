import { describe, expect, it } from "vitest";
import {
	decodeBase64Bytes,
	decodeBase64Utf8,
	encodeBytesBase64,
	encodeUtf8Base64,
} from "@/lib/utils/base64";

describe("browser-safe base64 helpers", () => {
	it("round-trips UTF-8 text without Node Buffer", () => {
		const encoded = encodeUtf8Base64("Ada Lovelace, Munchen, こんにちは");

		expect(encoded).toBe("QWRhIExvdmVsYWNlLCBNdW5jaGVuLCDjgZPjgpPjgavjgaHjga8=");
		expect(decodeBase64Utf8(encoded)).toBe("Ada Lovelace, Munchen, こんにちは");
	});

	it("round-trips large byte arrays without spreading the whole array", () => {
		const bytes = new Uint8Array(70_000);
		for (let i = 0; i < bytes.length; i++) {
			bytes[i] = i % 251;
		}

		expect(decodeBase64Bytes(encodeBytesBase64(bytes))).toEqual(bytes);
	});
});
