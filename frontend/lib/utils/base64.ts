const BYTE_CHUNK_SIZE = 0x8000;

type BufferLike = {
	from(value: Uint8Array | string, encoding?: BufferEncoding): Uint8Array & {
		toString(encoding?: BufferEncoding): string;
	};
};

type BufferEncoding = "base64" | "utf-8";

function getBuffer(): BufferLike | undefined {
	return (globalThis as typeof globalThis & { Buffer?: BufferLike }).Buffer;
}

export function encodeBytesBase64(bytes: Uint8Array): string {
	if (typeof btoa === "function") {
		let binary = "";
		for (let offset = 0; offset < bytes.length; offset += BYTE_CHUNK_SIZE) {
			const chunk = bytes.subarray(offset, offset + BYTE_CHUNK_SIZE);
			binary += String.fromCharCode(...chunk);
		}
		return btoa(binary);
	}

	const Buffer = getBuffer();
	if (Buffer) {
		return Buffer.from(bytes).toString("base64");
	}

	throw new Error("Base64 encoding is not available in this environment");
}

export function decodeBase64Bytes(base64: string): Uint8Array {
	if (typeof atob === "function") {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}

	const Buffer = getBuffer();
	if (Buffer) {
		return new Uint8Array(Buffer.from(base64, "base64"));
	}

	throw new Error("Base64 decoding is not available in this environment");
}

export function encodeUtf8Base64(value: string): string {
	return encodeBytesBase64(new TextEncoder().encode(value));
}

export function decodeBase64Utf8(base64: string): string {
	return new TextDecoder().decode(decodeBase64Bytes(base64));
}
