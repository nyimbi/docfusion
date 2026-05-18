import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() =>
	vi.fn<() => Promise<Array<{ address: string; family: 4 | 6 }>>>()
);

vi.mock("node:dns/promises", () => ({
	lookup: lookupMock,
}));

import {
	assertPublicHttpUrl,
	isPublicIpAddress,
	UnsafePublicUrlError,
} from "@/lib/security/public-url";

describe("public URL validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("accepts HTTP and HTTPS URLs that resolve only to public addresses", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

		await expect(assertPublicHttpUrl("https://example.com/report.pdf")).resolves.toMatchObject({
			hostname: "example.com",
			protocol: "https:",
		});
		await expect(assertPublicHttpUrl("http://example.com/report.pdf")).resolves.toMatchObject({
			protocol: "http:",
		});
	});

	it("rejects unsupported schemes and embedded credentials", async () => {
		await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toBeInstanceOf(UnsafePublicUrlError);
		await expect(assertPublicHttpUrl("https://user:pass@example.com")).rejects.toThrow("credentials");
	});

	it("rejects loopback, private, shared, and documentation address ranges", async () => {
		expect(isPublicIpAddress("127.0.0.1")).toBe(false);
		expect(isPublicIpAddress("10.0.0.5")).toBe(false);
		expect(isPublicIpAddress("100.64.0.1")).toBe(false);
		expect(isPublicIpAddress("192.168.1.10")).toBe(false);
		expect(isPublicIpAddress("203.0.113.10")).toBe(false);
		expect(isPublicIpAddress("93.184.216.34")).toBe(true);
	});

	it("rejects unsafe IPv6 literals and mapped private IPv4 addresses", async () => {
		await expect(assertPublicHttpUrl("http://[::1]/")).rejects.toThrow("non-public");
		expect(isPublicIpAddress("fc00::1")).toBe(false);
		expect(isPublicIpAddress("fe80::1")).toBe(false);
		expect(isPublicIpAddress("::ffff:127.0.0.1")).toBe(false);
		expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
	});

	it("rejects hostnames when any resolved address is non-public", async () => {
		lookupMock.mockResolvedValue([
			{ address: "93.184.216.34", family: 4 },
			{ address: "10.0.0.5", family: 4 },
		]);

		await expect(assertPublicHttpUrl("https://example.com")).rejects.toThrow("non-public");
	});
});
