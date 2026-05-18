import * as dns from "node:dns/promises";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export class UnsafePublicUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnsafePublicUrlError";
	}
}

interface PublicHttpRequestInit {
	headers?: HeadersInit;
	method?: string;
	body?: string | Buffer | Uint8Array;
	signal?: AbortSignal;
	timeoutMs?: number;
}

export async function assertPublicHttpUrl(rawUrl: string, label = "URL"): Promise<URL> {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new UnsafePublicUrlError(`${label} must be a valid URL`);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new UnsafePublicUrlError(`${label} must use HTTP or HTTPS`);
	}
	if (url.username || url.password) {
		throw new UnsafePublicUrlError(`${label} must not include credentials`);
	}

	const hostname = normalizeHostname(url.hostname);
	await resolvePublicHostAddresses(hostname, label);

	return url;
}

export async function fetchPublicHttpUrl(
	rawUrl: string | URL,
	init: PublicHttpRequestInit = {},
	label = "URL",
): Promise<Response> {
	const url = await assertPublicHttpUrl(rawUrl.toString(), label);
	const lookup = await createPinnedPublicLookup(url, label);
	const requester = url.protocol === "https:" ? httpsRequest : httpRequest;
	const headers = new Headers(init.headers);
	if (init.body !== undefined && !headers.has("content-length")) {
		headers.set("content-length", String(getBodyByteLength(init.body)));
	}
	const requestHeaders = Object.fromEntries(headers.entries());

	return new Promise<Response>((resolve, reject) => {
		let settled = false;
		const abortError = new Error(`${label} request aborted`);
		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			init.signal?.removeEventListener("abort", abortRequest);
			reject(error);
		};
		const abortRequest = () => {
			request.destroy(abortError);
			fail(abortError);
		};
		const request = requester(
			url,
			{
				method: init.method ?? "GET",
				headers: requestHeaders,
				lookup,
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});
				response.on("end", () => {
					if (settled) return;
					settled = true;
					init.signal?.removeEventListener("abort", abortRequest);
					resolve(new Response(Buffer.concat(chunks), {
						status: response.statusCode ?? 0,
						statusText: response.statusMessage,
						headers: response.headers as HeadersInit,
					}));
				});
			},
		);

		request.on("error", fail);
		if (init.timeoutMs !== undefined) {
			request.setTimeout(init.timeoutMs, () => {
				request.destroy(new Error(`${label} request timed out`));
			});
		}
		if (init.signal?.aborted) {
			abortRequest();
			return;
		}
		init.signal?.addEventListener("abort", abortRequest, { once: true });
		if (init.body !== undefined) {
			request.write(init.body);
		}
		request.end();
	});
}

export async function createPinnedPublicLookup(
	url: URL,
	label = "URL",
): Promise<NonNullable<RequestOptions["lookup"]>> {
	const hostname = normalizeHostname(url.hostname);
	const [pinned] = await resolvePublicHostAddresses(hostname, label);

	return ((_hostname, options, callback) => {
		if (options?.all) {
			callback(null, [pinned]);
			return;
		}
		callback(null, pinned.address, pinned.family);
	}) as NonNullable<RequestOptions["lookup"]>;
}

export async function resolvePublicHostAddresses(
	hostname: string,
	label = "URL",
): Promise<Array<{ address: string; family: 4 | 6 }>> {
	const normalized = normalizeHostname(hostname);
	if (!normalized || normalized === "localhost") {
		throw new UnsafePublicUrlError(`${label} host is not allowed`);
	}

	const records = await resolveHostAddresses(normalized, label);
	if (records.length === 0) {
		throw new UnsafePublicUrlError(`${label} host could not be resolved`);
	}

	for (const record of records) {
		if (!isPublicIpAddress(record.address)) {
			throw new UnsafePublicUrlError(`${label} host resolves to a non-public address`);
		}
	}

	return records;
}

export function isPublicIpAddress(rawAddress: string): boolean {
	const address = normalizeHostname(rawAddress);
	const family = isIP(address);

	if (family === 4) {
		return isPublicIpv4Address(address);
	}
	if (family === 6) {
		return isPublicIpv6Address(address);
	}
	return false;
}

async function resolveHostAddresses(
	hostname: string,
	label: string,
): Promise<Array<{ address: string; family: 4 | 6 }>> {
	const literalFamily = isIP(hostname);
	if (literalFamily === 4 || literalFamily === 6) {
		return [{ address: hostname, family: literalFamily }];
	}

	try {
		const records = await dns.lookup(hostname, { all: true, verbatim: true });
		return records.map((record) => ({
			address: record.address,
			family: record.family === 6 ? 6 : 4,
		}));
	} catch {
		throw new UnsafePublicUrlError(`${label} host could not be resolved`);
	}
}

function normalizeHostname(hostname: string): string {
	return hostname.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

function getBodyByteLength(body: string | Buffer | Uint8Array): number {
	return typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
}

function isPublicIpv4Address(address: string): boolean {
	const octets = parseIpv4Octets(address);
	if (!octets) return false;

	const [first, second, third] = octets;
	if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
	if (first === 100 && second >= 64 && second <= 127) return false;
	if (first === 169 && second === 254) return false;
	if (first === 172 && second >= 16 && second <= 31) return false;
	if (first === 192 && second === 168) return false;
	if (first === 192 && second === 0 && (third === 0 || third === 2)) return false;
	if (first === 192 && second === 88 && third === 99) return false;
	if (first === 198 && (second === 18 || second === 19)) return false;
	if (first === 198 && second === 51 && third === 100) return false;
	if (first === 203 && second === 0 && third === 113) return false;
	if (first === 255) return false;

	return true;
}

function isPublicIpv6Address(address: string): boolean {
	const parts = parseIpv6Parts(address);
	if (!parts) return false;

	if (parts.every((part) => part === 0)) return false;
	if (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) return false;
	if (isIpv4MappedIpv6(parts)) {
		const mappedIpv4 = [
			parts[6] >> 8,
			parts[6] & 0xff,
			parts[7] >> 8,
			parts[7] & 0xff,
		].join(".");
		return isPublicIpv4Address(mappedIpv4);
	}

	const first = parts[0];
	if ((first & 0xfe00) === 0xfc00) return false;
	if ((first & 0xffc0) === 0xfe80) return false;
	if ((first & 0xff00) === 0xff00) return false;
	if (first === 0x2001 && parts[1] === 0x0db8) return false;
	if (first === 0x2002) return false;
	if (first === 0x0064 && parts[1] === 0xff9b && parts.slice(2, 6).every((part) => part === 0)) {
		return false;
	}

	return true;
}

function parseIpv4Octets(address: string): number[] | null {
	const octets = address.split(".");
	if (octets.length !== 4) return null;

	const parsed = octets.map((octet) => Number(octet));
	if (parsed.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
		return null;
	}
	return parsed;
}

function parseIpv6Parts(rawAddress: string): number[] | null {
	let address = rawAddress.toLowerCase();
	if (address.includes(".")) {
		const lastColon = address.lastIndexOf(":");
		if (lastColon === -1) return null;

		const ipv4 = parseIpv4Octets(address.slice(lastColon + 1));
		if (!ipv4) return null;

		const high = (ipv4[0] << 8) + ipv4[1];
		const low = (ipv4[2] << 8) + ipv4[3];
		address = `${address.slice(0, lastColon)}:${high.toString(16)}:${low.toString(16)}`;
	}

	const doubleColonParts = address.split("::");
	if (doubleColonParts.length > 2) return null;

	const head = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
	const tail = doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
	const missing = 8 - head.length - tail.length;

	if (doubleColonParts.length === 1 && missing !== 0) return null;
	if (doubleColonParts.length === 2 && missing < 1) return null;

	const parts = [
		...head,
		...Array.from({ length: doubleColonParts.length === 2 ? missing : 0 }, () => "0"),
		...tail,
	].map((part) => Number.parseInt(part, 16));

	if (parts.length !== 8 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) {
		return null;
	}
	return parts;
}

function isIpv4MappedIpv6(parts: number[]): boolean {
	return parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
}
