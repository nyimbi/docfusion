import * as dns from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafePublicUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnsafePublicUrlError";
	}
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
	if (!hostname || hostname === "localhost") {
		throw new UnsafePublicUrlError(`${label} host is not allowed`);
	}

	const addresses = await resolveHostAddresses(hostname, label);
	if (addresses.length === 0) {
		throw new UnsafePublicUrlError(`${label} host could not be resolved`);
	}

	for (const address of addresses) {
		if (!isPublicIpAddress(address)) {
			throw new UnsafePublicUrlError(`${label} host resolves to a non-public address`);
		}
	}

	return url;
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

async function resolveHostAddresses(hostname: string, label: string): Promise<string[]> {
	if (isIP(hostname)) {
		return [hostname];
	}

	try {
		const records = await dns.lookup(hostname, { all: true, verbatim: true });
		return records.map((record) => record.address);
	} catch {
		throw new UnsafePublicUrlError(`${label} host could not be resolved`);
	}
}

function normalizeHostname(hostname: string): string {
	return hostname.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
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
