import { beforeEach, describe, expect, it, vi } from "vitest";

interface ChainConfig {
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "where", "limit", "returning"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
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
		rfpDocuments: {
			findFirst: vi.fn(),
		},
		userWorkspaces: {
			findFirst: vi.fn(),
		},
	},
	select: vi.fn(),
	insert: vi.fn(),
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

const dnsLookupMock = vi.hoisted(() =>
	vi.fn<() => Promise<Array<{ address: string; family: 4 | 6 }>>>()
);
const fetchPublicHttpUrlMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
	lookup: dnsLookupMock,
}));

vi.mock("@/lib/security/public-url", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/security/public-url")>();
	return {
		...actual,
		fetchPublicHttpUrl: fetchPublicHttpUrlMock,
	};
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/services/docling-client", () => doclingMock);
vi.mock("@/lib/storage/linode-e3", () => storageMock);
vi.mock("@/lib/actions/rfp-parser", () => ({
	processRfpParsingJob: vi.fn(async () => undefined),
}));
const workflowRuntimeMock = vi.hoisted(() => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000601" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => undefined),
}));
vi.mock("@/lib/actions/workflow-runtime", () => workflowRuntimeMock);
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
	getOpportunityDocumentFileForActor,
	OpportunityDocumentAccessError,
} from "@/lib/services/rfp-document-service";
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";

beforeEach(() => {
	vi.clearAllMocks();
	dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
	dbMock.$count.mockResolvedValue(1);
	dbMock.select.mockImplementation(() => createChain({ result: [] }));
	dbMock.query.rfpDocuments.findFirst.mockResolvedValue(null);
	dbMock.query.userWorkspaces.findFirst.mockResolvedValue({
		id: "00000000-0000-4000-8000-000000000701",
		organizationId: "org-1",
	});
	dbMock.insert.mockImplementation(() => createChain());
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
	fetchPublicHttpUrlMock.mockResolvedValue(new Response("downloaded-pdf", {
		status: 200,
		headers: {
			"content-length": "14",
			"content-type": "application/pdf",
		},
	}));
});

describe("RFP document fetch storage", () => {
	it("stores fetched RFP downloads in Linode E3 and records the s3 storage path", async () => {
		const updates: Record<string, unknown>[] = [];
		const insertedValues: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
				onValues: (value) => insertedValues.push(value),
			}));
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			documentId: baseDocument.id,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
			localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			storagePath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			storageReceipt: {
				provider: "linode_e3",
				bucket: "mansa",
				key: "rfp/opportunity/document/Main-RFP.pdf",
				sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
				byteLength: 14,
			},
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
		expect(insertedValues[0]).toMatchObject({
			opportunityId: baseDocument.opportunityId,
			filename: "Main RFP.pdf",
			fileType: "pdf",
			storagePath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
			fileHash: expect.stringMatching(/^[a-f0-9]{64}$/),
			extractedText: "Extracted RFP text",
			pageCount: 3,
			metadata: expect.objectContaining({
				ingestWorkflow: expect.objectContaining({
					state: "queued_for_parse",
					sourceOpportunityDocumentId: baseDocument.id,
				}),
				storage: expect.objectContaining({
					provider: "linode_e3",
					sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
				}),
				parserPolicy: expect.objectContaining({
					parser: "next_rfp_parser",
					confidenceGateThreshold: 80,
				}),
			}),
		});
		expect(insertedValues[1]).toMatchObject({
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			status: "queued",
			currentStep: "Queued from discovered RFP download",
		});
		expect(processRfpParsingJob).toHaveBeenCalledWith({
			jobId: "00000000-0000-4000-8000-000000000501",
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			tenantContext: {
				userId: "capture-user",
				organizationId: "org-1",
			},
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "discovery_rfp_ingest",
				subjectType: "opportunity_document",
				subjectId: baseDocument.id,
				toState: "queued_for_parse",
				metadata: expect.objectContaining({
					rfpDocumentId: "00000000-0000-4000-8000-000000000401",
					parsingJobId: "00000000-0000-4000-8000-000000000501",
				}),
			})
		);
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

	it("blocks download when the caller opportunity does not match the document", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);

		const result = await downloadDocument(
			baseDocument.id,
			"capture-user",
			"00000000-0000-4000-8000-000000000999"
		);

		expect(result).toMatchObject({
			success: false,
			documentId: baseDocument.id,
			error: "Document does not belong to this opportunity",
		});
		expect(fetchPublicHttpUrlMock).not.toHaveBeenCalled();
		expect(storageMock.uploadToLinodeE3).not.toHaveBeenCalled();
	});

	it("blocks downloads from non-public source URLs before fetching bytes", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			sourceUrl: "http://127.0.0.1/admin",
		});

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: false,
			documentId: baseDocument.id,
			error: expect.stringContaining("non-public"),
		});
		expect(fetchPublicHttpUrlMock).not.toHaveBeenCalled();
		expect(storageMock.uploadToLinodeE3).not.toHaveBeenCalled();
	});
});

describe("opportunity document scoped access", () => {
	it("requires the route opportunity id to match the document", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [] }));

		const result = await getOpportunityDocumentFileForActor(
			{ userId: "user-1", roles: ["writer"] },
			"00000000-0000-4000-8000-000000000999",
			baseDocument.id
		);

		expect(result).toBeNull();
		expect(storageMock.downloadFromLinodeE3).not.toHaveBeenCalled();
	});

	it("denies matched documents when the actor has no row-local permission", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				document: {
					...baseDocument,
					localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
					mimeType: "application/pdf",
					downloadedBy: "capture-user",
				},
				opportunity: {
					id: baseDocument.opportunityId,
					assignedTo: "other-user",
				},
			}],
		}));

		await expect(getOpportunityDocumentFileForActor(
			{ userId: "user-1", roles: ["writer"] },
			baseDocument.opportunityId,
			baseDocument.id
		)).rejects.toBeInstanceOf(OpportunityDocumentAccessError);
		expect(storageMock.downloadFromLinodeE3).not.toHaveBeenCalled();
	});

	it("allows assigned users and admins to read the scoped document bytes", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				document: {
					...baseDocument,
					localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
					mimeType: "application/pdf",
					downloadedBy: "capture-user",
				},
				opportunity: {
					id: baseDocument.opportunityId,
					assignedTo: "assigned-user",
				},
			}],
		}));

		const assignedResult = await getOpportunityDocumentFileForActor(
			{ userId: "assigned-user", roles: ["writer"] },
			baseDocument.opportunityId,
			baseDocument.id
		);

		expect(assignedResult).toMatchObject({
			buffer: Buffer.from("downloaded-pdf"),
			mimeType: "application/pdf",
			filename: "Main RFP.pdf",
		});

		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				document: {
					...baseDocument,
					localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
					mimeType: "application/pdf",
					downloadedBy: "capture-user",
				},
				opportunity: {
					id: baseDocument.opportunityId,
					assignedTo: "other-user",
				},
			}],
		}));

		const adminResult = await getOpportunityDocumentFileForActor(
			{ userId: "admin-1", roles: ["admin"] },
			baseDocument.opportunityId,
			baseDocument.id
		);

		expect(adminResult?.buffer).toEqual(Buffer.from("downloaded-pdf"));
	});
});
