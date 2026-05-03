import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildRfpObjectKey,
	deleteFromLinodeE3,
	getLinodeE3ConfigFromEnv,
	parseS3StoragePath,
	uploadToLinodeE3,
} from "@/lib/storage/linode-e3";

const ORIGINAL_ENV = process.env;

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.restoreAllMocks();
});

describe("Linode E3 storage helper", () => {
	it("requires bucket, access key, and secret key before enabling object storage", () => {
		process.env = {
			...ORIGINAL_ENV,
			LINODE_E3_BUCKET: "rfps",
			LINODE_E3_ACCESS_KEY_ID: "access-key",
			LINODE_E3_SECRET_ACCESS_KEY: "",
		};

		expect(getLinodeE3ConfigFromEnv()).toBeNull();
	});

	it("builds stable RFP object keys without leaking unsafe filename characters", () => {
		expect(
			buildRfpObjectKey({
				documentId: "doc-123",
				filename: "City RFP: Phase 1?.pdf",
				opportunityId: "opp-456",
				prefix: "rfp",
			})
		).toBe("rfp/opp-456/doc-123/City-RFP-Phase-1.pdf");
	});

	it("parses stored S3 paths into bucket and key", () => {
		expect(parseS3StoragePath("s3://rfps/rfp/opp/doc/file.pdf")).toEqual({
			bucket: "rfps",
			key: "rfp/opp/doc/file.pdf",
		});
	});

	it("uploads through the app server with an AWS v4 signed PUT request", async () => {
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, {
			status: 200,
			headers: { etag: "\"etag-123\"" },
		}));
		vi.stubGlobal("fetch", fetchMock);

		const result = await uploadToLinodeE3(
			{
				endpoint: "https://gb-lon-1.linodeobjects.com",
				region: "gb-lon-1",
				bucket: "rfps",
				accessKeyId: "access-key",
				secretAccessKey: "secret-key",
			},
			{
				key: "rfp/opp/doc/file.pdf",
				body: Buffer.from("pdf"),
				contentType: "application/pdf",
				contentLength: 3,
			}
		);

		expect(result).toMatchObject({
			bucket: "rfps",
			key: "rfp/opp/doc/file.pdf",
			storagePath: "s3://rfps/rfp/opp/doc/file.pdf",
			etag: "\"etag-123\"",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(url).toBe("https://gb-lon-1.linodeobjects.com/rfps/rfp/opp/doc/file.pdf");
		expect(init.method).toBe("PUT");
		expect(headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=access-key/");
		expect(headers.host).toBe("gb-lon-1.linodeobjects.com");
	});

	it("deletes stored objects with an AWS v4 signed DELETE request", async () => {
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, {
			status: 204,
		}));
		vi.stubGlobal("fetch", fetchMock);

		const result = await deleteFromLinodeE3(
			{
				endpoint: "https://gb-lon-1.linodeobjects.com",
				region: "gb-lon-1",
				bucket: "rfps",
				accessKeyId: "access-key",
				secretAccessKey: "secret-key",
			},
			"s3://rfps/rfp/opp/doc/file.pdf"
		);

		expect(result).toEqual({
			bucket: "rfps",
			key: "rfp/opp/doc/file.pdf",
			deleted: true,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Record<string, string>;
		expect(url).toBe("https://gb-lon-1.linodeobjects.com/rfps/rfp/opp/doc/file.pdf");
		expect(init.method).toBe("DELETE");
		expect(headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=access-key/");
		expect(headers.host).toBe("gb-lon-1.linodeobjects.com");
	});
});
