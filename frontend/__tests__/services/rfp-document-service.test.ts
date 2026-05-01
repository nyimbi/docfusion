import { beforeEach, describe, expect, it, vi } from "vitest";

interface ChainConfig {
	onSet?: (value: Record<string, unknown>) => void;
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["where", "returning"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

const baseDocument = {
	id: "00000000-0000-4000-8000-000000000901",
	opportunityId: "00000000-0000-4000-8000-000000000902",
	documentName: "Main RFP.pdf",
	documentType: "rfp",
	sourceUrl: "https://buyer.example/rfp/Main%20RFP.pdf",
	status: "discovered",
	localPath: null,
	mimeType: null,
	downloadAttempts: 0,
	extractedText: null,
};

const storageConfig = {
	endpoint: "https://gb-lon-1.linodeobjects.com",
	region: "gb-lon-1",
	bucket: "mansa",
	accessKeyId: "access-key",
	secretAccessKey: "secret-key",
	prefix: "rfp",
};

const dbMock = vi.hoisted(() => ({
	query: {
		opportunityDocuments: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
		},
	},
	update: vi.fn(),
	delete: vi.fn(),
	$count: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({
	buildRfpObjectKey: vi.fn(() => "rfp/opportunity/document/Main-RFP.pdf"),
	downloadFromLinodeE3: vi.fn(),
	getLinodeE3ConfigFromEnv: vi.fn(),
	uploadToLinodeE3: vi.fn(),
}));

const doclingMock = vi.hoisted(() => ({
	isSupportedFileType: vi.fn(),
	processRfpDocument: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/services/docling-client", () => doclingMock);
vi.mock("@/lib/storage/linode-e3", () => storageMock);
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

import {
	downloadDocument,
	extractDocumentText,
} from "@/lib/services/rfp-document-service";

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.$count.mockResolvedValue(1);
	dbMock.update.mockImplementation(() => createChain());
	dbMock.delete.mockImplementation(() => createChain());
	storageMock.getLinodeE3ConfigFromEnv.mockReturnValue(storageConfig);
	storageMock.uploadToLinodeE3.mockResolvedValue({
		bucket: "mansa",
		key: "rfp/opportunity/document/Main-RFP.pdf",
		storagePath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
		etag: "\"etag\"",
		endpoint: "https://gb-lon-1.linodeobjects.com",
	});
	storageMock.downloadFromLinodeE3.mockResolvedValue({
		body: Buffer.from("downloaded-pdf"),
		contentType: "application/pdf",
		contentLength: 14,
		etag: "\"etag\"",
	});
	doclingMock.isSupportedFileType.mockReturnValue(true);
	doclingMock.processRfpDocument.mockResolvedValue({
		text: "Extracted RFP text",
		pageCount: 3,
	});
	vi.stubGlobal("fetch", vi.fn(async () => new Response("downloaded-pdf", {
		status: 200,
		headers: {
			"content-length": "14",
			"content-type": "application/pdf",
		},
	})));
});

describe("RFP document fetch storage", () => {
	it("stores fetched RFP downloads in Linode E3 and records the s3 storage path", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			documentId: baseDocument.id,
			localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			storagePath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			fileSize: 14,
			mimeType: "application/pdf",
		});
		expect(storageMock.uploadToLinodeE3).toHaveBeenCalledWith(
			storageConfig,
			expect.objectContaining({
				key: "rfp/opportunity/document/Main-RFP.pdf",
				body: Buffer.from("downloaded-pdf"),
				contentType: "application/pdf",
				contentLength: 14,
			})
		);
		expect(updates).toContainEqual(expect.objectContaining({
			localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			status: "downloaded",
			extractedText: "Extracted RFP text",
			pageCount: 3,
		}));
	});

	it("fetches downloaded RFP bytes from Linode E3 during later text extraction", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			mimeType: "application/pdf",
			extractedText: null,
		});

		const text = await extractDocumentText(baseDocument.id);

		expect(text).toBe("Extracted RFP text");
		expect(storageMock.downloadFromLinodeE3).toHaveBeenCalledWith(
			storageConfig,
			"s3://mansa/rfp/opportunity/document/Main-RFP.pdf"
		);
		expect(doclingMock.processRfpDocument).toHaveBeenCalledWith(
			Buffer.from("downloaded-pdf"),
			"Main RFP.pdf"
		);
	});
});
