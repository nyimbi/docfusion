import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

interface ChainConfig {
	result?: unknown[];
	onValues?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	return chain;
}

const authMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	query: {
		rfpDocuments: {
			findFirst: vi.fn(),
		},
	},
	insert: vi.fn(),
}));
const storageMock = vi.hoisted(() => ({
	buildRfpObjectKey: vi.fn(() => "rfp/opportunity/document.pdf"),
	getLinodeE3ConfigFromEnv: vi.fn(),
	uploadToLinodeE3: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/storage/linode-e3", () => storageMock);

import { POST } from "@/app/api/v1/rfp/upload/route";

function uploadRequest(file: File) {
	const formData = new FormData();
	formData.set("file", file);
	formData.set("opportunityId", "00000000-0000-4000-8000-000000000101");
	return new NextRequest("https://app.test/api/v1/rfp/upload", {
		method: "POST",
		body: formData,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.insert.mockReset();
	dbMock.query.rfpDocuments.findFirst.mockReset();
	storageMock.getLinodeE3ConfigFromEnv.mockReset();
	storageMock.uploadToLinodeE3.mockReset();
	storageMock.buildRfpObjectKey.mockReset();
	storageMock.buildRfpObjectKey.mockReturnValue("rfp/opportunity/document.pdf");
	dbMock.query.rfpDocuments.findFirst.mockResolvedValue(null);
	dbMock.insert.mockImplementation(() => createChain({ result: [{ id: "created-row" }] }));
	storageMock.getLinodeE3ConfigFromEnv.mockReturnValue(null);
	storageMock.uploadToLinodeE3.mockResolvedValue({
		bucket: "mansa",
		key: "rfp/opportunity/document.pdf",
		storagePath: "s3://mansa/rfp/opportunity/document.pdf",
		endpoint: "https://mansa.gb-lon-1.linodeobjects.com",
		etag: "\"etag\"",
	});
	vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
		status: 201,
		headers: { "content-type": "application/json" },
	})));
});

describe("RFP upload route", () => {
	it("requires app authentication before parsing or proxying", async () => {
		authMock.mockResolvedValueOnce(null);

		const response = await POST(uploadRequest(new File(["pdf"], "rfp.pdf", { type: "application/pdf" })));

		expect(response.status).toBe(401);
		expect(fetch).not.toHaveBeenCalled();
		expect(storageMock.getLinodeE3ConfigFromEnv).not.toHaveBeenCalled();
	});

	it("rejects unsupported uploads before the Python fallback", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "user-1", email: "user@example.test" } });

		const response = await POST(uploadRequest(new File(["bad"], "rfp.exe", { type: "application/octet-stream" })));

		expect(response.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("proxies only validated uploads with authenticated user context when E3 is absent", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "user-1", email: "user@example.test" } });

		const response = await POST(uploadRequest(new File(["pdf"], "rfp.pdf", { type: "application/pdf" })));

		expect(response.status).toBe(201);
		expect(fetch).toHaveBeenCalledWith(
			"http://localhost:8000/api/v1/rfp/upload",
			expect.objectContaining({
				method: "POST",
				headers: { "x-docfusion-user-id": "user-1" },
				body: expect.any(FormData),
			})
		);
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("stores validated uploads in Linode E3 when object storage is configured", async () => {
		const inserted: Record<string, unknown>[] = [];
		authMock.mockResolvedValueOnce({ user: { id: "user-1", email: "user@example.test" } });
		storageMock.getLinodeE3ConfigFromEnv.mockReturnValue({
			bucket: "mansa",
			endpoint: "https://mansa.gb-lon-1.linodeobjects.com",
			prefix: "rfp",
			region: "gb-lon-1",
			accessKeyId: "key",
			secretAccessKey: "secret",
		});
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "rfp-doc-1" }],
				onValues: (value) => inserted.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "parse-job-1" }],
				onValues: (value) => inserted.push(value),
			}));

		const response = await POST(uploadRequest(new File(["pdf"], "rfp.pdf", { type: "application/pdf" })));

		expect(response.status).toBe(201);
		expect(fetch).not.toHaveBeenCalled();
		expect(storageMock.uploadToLinodeE3).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				key: "rfp/opportunity/document.pdf",
				contentType: "application/pdf",
				metadata: expect.objectContaining({
					"uploaded-by": "user-1",
					"sha256": expect.any(String),
				}),
			})
		);
		expect(inserted[0]).toMatchObject({
			filename: "rfp.pdf",
			fileType: "pdf",
			storagePath: "s3://mansa/rfp/opportunity/document.pdf",
			uploadedBy: "user-1",
			metadata: expect.objectContaining({
				sha256: expect.any(String),
				securityScan: {
					status: "warning",
					findings: ["pdf_signature_not_confirmed"],
				},
			}),
		});
		expect(inserted[1]).toMatchObject({
			rfpDocumentId: expect.any(String),
			status: "queued",
			initiatedBy: "user-1",
		});
	});
});
