import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const lookupMock = vi.hoisted(() =>
	vi.fn<() => Promise<Array<{ address: string; family: 4 | 6 }>>>()
);
const httpRequestMock = vi.hoisted(() => vi.fn());
const httpsRequestMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
	lookup: lookupMock,
}));
vi.mock("node:http", () => ({
	request: httpRequestMock,
}));
vi.mock("node:https", () => ({
	request: httpsRequestMock,
}));

import {
	assertPublicHttpUrl,
	createPinnedPublicLookup,
	fetchPublicHttpUrl,
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

	it("pins outbound fetch lookup to the already validated public address", async () => {
		lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
		const lookup = await createPinnedPublicLookup(new URL("https://example.com/report.pdf"));

		const resolved = await new Promise<{ address: string; family: number }>((resolve, reject) => {
			lookup("example.com", {}, (error, address, family) => {
				if (error) {
					reject(error);
					return;
				}
				resolve({ address: String(address), family: Number(family) });
			});
		});

		expect(resolved).toEqual({ address: "93.184.216.34", family: 4 });
		expect(lookupMock).toHaveBeenCalledTimes(1);
	});

	it("sends POST bodies through the pinned public request helper", async () => {
		const body = JSON.stringify({ ok: true });
		const writes: string[] = [];
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		httpRequestMock.mockImplementation((_url, _options, callback) => {
			const response = new EventEmitter() as EventEmitter & {
				headers: Record<string, string>;
				statusCode: number;
				statusMessage: string;
			};
			response.headers = { "x-delivered": "yes" };
			response.statusCode = 202;
			response.statusMessage = "Accepted";

			const request = new EventEmitter() as EventEmitter & {
				write: ReturnType<typeof vi.fn>;
				end: ReturnType<typeof vi.fn>;
				setTimeout: ReturnType<typeof vi.fn>;
				destroy: ReturnType<typeof vi.fn>;
			};
			request.destroy = vi.fn();
			request.setTimeout = vi.fn();
			request.write = vi.fn((chunk: string | Buffer | Uint8Array) => {
				writes.push(Buffer.from(chunk).toString("utf8"));
			});
			request.end = vi.fn(() => {
				callback(response);
				response.emit("data", Buffer.from("accepted"));
				response.emit("end");
			});
			return request;
		});

		const response = await fetchPublicHttpUrl(
			"http://example.com/notify",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
				timeoutMs: 15_000,
			},
			"notification URL",
		);

		expect(response.status).toBe(202);
		await expect(response.text()).resolves.toBe("accepted");
		expect(writes).toEqual([body]);
		expect(httpRequestMock).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: "example.com", pathname: "/notify" }),
			expect.objectContaining({
				method: "POST",
				headers: {
					"content-length": String(Buffer.byteLength(body)),
					"content-type": "application/json",
				},
				lookup: expect.any(Function),
			}),
			expect.any(Function),
		);
		const request = httpRequestMock.mock.results[0].value;
		expect(request.setTimeout).toHaveBeenCalledWith(15_000, expect.any(Function));
	});

	it("allows invalid TLS only for explicitly listed HTTPS hosts", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		httpsRequestMock.mockImplementation((_url, _options, callback) =>
			createMockRequest(callback, {
				body: "pdf",
				headers: { "content-type": "application/pdf" },
				statusCode: 200,
				statusMessage: "OK",
			})
		);

		const response = await fetchPublicHttpUrl("https://tenders.go.ke/storage/Documents/rfp.pdf", {
			allowInvalidTlsForHosts: ["tenders.go.ke"],
		});

		expect(response.status).toBe(200);
		expect(httpsRequestMock).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: "tenders.go.ke" }),
			expect.objectContaining({
				rejectUnauthorized: false,
				lookup: expect.any(Function),
			}),
			expect.any(Function),
		);
	});

	it("follows redirects only after revalidating and repinning the next URL", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		httpRequestMock.mockImplementation((_url, _options, callback) =>
			createMockRequest(callback, {
				headers: { location: "https://cdn.example/final.pdf" },
				statusCode: 302,
				statusMessage: "Found",
			})
		);
		httpsRequestMock.mockImplementation((_url, _options, callback) =>
			createMockRequest(callback, {
				body: "final-body",
				headers: { "content-type": "application/pdf" },
				statusCode: 200,
				statusMessage: "OK",
			})
		);

		const response = await fetchPublicHttpUrl("http://example.com/start.pdf");

		expect(response.status).toBe(200);
		await expect(response.text()).resolves.toBe("final-body");
		expect(httpRequestMock).toHaveBeenCalledTimes(1);
		expect(httpsRequestMock).toHaveBeenCalledTimes(1);
		expect(lookupMock).toHaveBeenCalledTimes(4);
	});

	it("rejects redirects to non-public targets", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
		httpRequestMock.mockImplementation((_url, _options, callback) =>
			createMockRequest(callback, {
				headers: { location: "http://127.0.0.1/admin" },
				statusCode: 302,
				statusMessage: "Found",
			})
		);

		await expect(fetchPublicHttpUrl("http://example.com/start")).rejects.toBeInstanceOf(UnsafePublicUrlError);
		expect(httpRequestMock).toHaveBeenCalledTimes(1);
		expect(httpsRequestMock).not.toHaveBeenCalled();
	});
});

function createMockRequest(
	callback: (response: EventEmitter) => void,
	responseInit: {
		body?: string;
		headers?: Record<string, string>;
		statusCode: number;
		statusMessage: string;
	},
) {
	const response = new EventEmitter() as EventEmitter & {
		headers: Record<string, string>;
		statusCode: number;
		statusMessage: string;
	};
	response.headers = responseInit.headers ?? {};
	response.statusCode = responseInit.statusCode;
	response.statusMessage = responseInit.statusMessage;

	const request = new EventEmitter() as EventEmitter & {
		destroy: ReturnType<typeof vi.fn>;
		end: ReturnType<typeof vi.fn>;
		setTimeout: ReturnType<typeof vi.fn>;
		write: ReturnType<typeof vi.fn>;
	};
	request.destroy = vi.fn((error?: Error) => {
		if (error) request.emit("error", error);
	});
	request.setTimeout = vi.fn();
	request.write = vi.fn();
	request.end = vi.fn(() => {
		callback(response);
		if (responseInit.body) {
			response.emit("data", Buffer.from(responseInit.body));
		}
		response.emit("end");
	});
	return request;
}
