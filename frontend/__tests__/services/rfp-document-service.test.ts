import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import JSZip from "jszip";

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
	organizationId: "org-1",
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
const pdfParseGetTextMock = vi.hoisted(() => vi.fn());
const pdfParseDestroyMock = vi.hoisted(() => vi.fn());
const mammothExtractRawTextMock = vi.hoisted(() => vi.fn());
const execFileMock = vi.hoisted(() => vi.fn());

const dnsLookupMock = vi.hoisted(() =>
	vi.fn<() => Promise<Array<{ address: string; family: 4 | 6 }>>>()
);
const fetchPublicHttpUrlMock = vi.hoisted(() => vi.fn());
const firecrawlScrapeMock = vi.hoisted(() => vi.fn());
const browserScrapeMock = vi.hoisted(() => vi.fn());
const cloakScrapeMock = vi.hoisted(() => vi.fn());
const searchSearxngMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
	lookup: dnsLookupMock,
}));
vi.mock("node:child_process", () => ({
	execFile: execFileMock,
}));

vi.mock("@/lib/security/public-url", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/security/public-url")>();
	return {
		...actual,
		fetchPublicHttpUrl: fetchPublicHttpUrlMock,
	};
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/scrapers/firecrawl", () => ({
	FirecrawlClient: vi.fn(() => ({
		scrape: firecrawlScrapeMock,
	})),
}));
vi.mock("@/lib/services/browser-scraper-client", () => ({
	scrapeWithBrowserService: browserScrapeMock,
}));
vi.mock("@/lib/services/cloakbrowser-scraper-client", () => ({
	scrapeWithCloakBrowser: cloakScrapeMock,
}));
vi.mock("@/lib/services/searxng-client", () => ({
	searchSearxng: searchSearxngMock,
}));
vi.mock("@/lib/services/docling-client", () => doclingMock);
vi.mock("pdf-parse", () => ({
	PDFParse: vi.fn(() => ({
		getText: pdfParseGetTextMock,
		destroy: pdfParseDestroyMock,
	})),
}));
vi.mock("mammoth", () => ({
	default: {
		extractRawText: mammothExtractRawTextMock,
	},
	extractRawText: mammothExtractRawTextMock,
}));
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
	discoverDocuments,
	downloadDocument,
	extractDocumentText,
	getOpportunityDocumentFileForActor,
	OpportunityDocumentAccessError,
	OpportunityDocumentIntegrityError,
} from "@/lib/services/rfp-document-service";
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";

const downloadedPdfHash = createHash("sha256").update(Buffer.from("downloaded-pdf")).digest("hex");

async function buildXlsxWorkbook(rows: string[][]): Promise<Buffer> {
	const zip = new JSZip();
	const sharedStrings = rows.flat();
	const cell = (rowIndex: number, columnIndex: number, sharedStringIndex: number) => {
		const column = String.fromCharCode("A".charCodeAt(0) + columnIndex);
		return `<c r="${column}${rowIndex + 1}" t="s"><v>${sharedStringIndex}</v></c>`;
	};

	zip.file("xl/workbook.xml", [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
		'<sheets><sheet name="Procurement Plan" sheetId="1" r:id="rId1"/></sheets>',
		"</workbook>",
	].join(""));
	zip.file("xl/_rels/workbook.xml.rels", [
		'<?xml version="1.0" encoding="UTF-8"?>',
		"<Relationships>",
		'<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>',
		"</Relationships>",
	].join(""));
	zip.file("xl/sharedStrings.xml", [
		'<?xml version="1.0" encoding="UTF-8"?>',
		"<sst>",
		...sharedStrings.map((value) => `<si><t>${value}</t></si>`),
		"</sst>",
	].join(""));
	let sharedStringIndex = 0;
	zip.file("xl/worksheets/sheet1.xml", [
		'<?xml version="1.0" encoding="UTF-8"?>',
		"<worksheet><sheetData>",
		...rows.map((row, rowIndex) =>
			`<row r="${rowIndex + 1}">${row.map((_, columnIndex) => cell(rowIndex, columnIndex, sharedStringIndex++)).join("")}</row>`
		),
		"</sheetData></worksheet>",
	].join(""));

	return zip.generateAsync({ type: "nodebuffer" });
}

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
	firecrawlScrapeMock.mockResolvedValue({ success: false, error: "not mocked" });
	browserScrapeMock.mockResolvedValue({ success: false, error: "not mocked" });
	cloakScrapeMock.mockResolvedValue({ success: false, error: "not configured" });
	searchSearxngMock.mockResolvedValue({ results: [] });
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
	execFileMock.mockImplementation((_file, _args, _options, callback) => {
		callback(new Error("pdftotext unavailable"), "", "");
	});
	pdfParseGetTextMock.mockResolvedValue({
		text: "Locally extracted PDF RFP text with enough content.",
		total: 2,
	});
	pdfParseDestroyMock.mockResolvedValue(undefined);
	mammothExtractRawTextMock.mockResolvedValue({
		value: "Locally extracted DOCX RFP text with enough content.",
	});
	fetchPublicHttpUrlMock.mockResolvedValue(new Response("downloaded-pdf", {
		status: 200,
		headers: {
			"content-length": "14",
			"content-type": "application/pdf",
		},
	}));
});

describe("RFP document discovery", () => {
	it("classifies platform RFP URLs as RFP documents instead of forms", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(null);
		dbMock.insert.mockImplementation(() => createChain({
			onValues: (value) => insertedValues.push(value),
		}));
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "# Records Platform Tender\n\nDownload the main package.",
				links: ["/downloads/Records-Platform-RFP.pdf"],
			},
		});

		const result = await discoverDocuments("opp-1", "https://buyer.example/tenders/records");

		expect(result).toMatchObject({
			success: true,
			sourceUrl: "https://buyer.example/tenders/records",
			documents: [
				{
					name: "Records-Platform-RFP.pdf",
					url: "https://buyer.example/downloads/Records-Platform-RFP.pdf",
					type: "rfp",
				},
			],
		});
		expect(insertedValues).toEqual([
			expect.objectContaining({
				opportunityId: "opp-1",
				documentName: "Records-Platform-RFP.pdf",
				documentType: "rfp",
				sourceUrl: "https://buyer.example/downloads/Records-Platform-RFP.pdf",
			}),
		]);
	});

	it("does not mark discovery successful when no downloadable documents are found", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(null);
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "# Records Platform Tender\n\nNo downloadable files are published yet.",
				links: ["https://buyer.example/tenders/records"],
				extract: {
					documents: [{ name: "   ", url: "   ", type: "rfp" }, {}],
				},
			},
		});

		const result = await discoverDocuments("opp-1", "https://buyer.example/tenders/records");

		expect(result).toEqual({
			success: false,
			documents: [],
			error: "No downloadable RFP documents found",
			sourceUrl: "https://buyer.example/tenders/records",
		});
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});
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

	it("awaits RFP parsing when downloads run in inline parse mode", async () => {
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
		const parserEvents: string[] = [];
		vi.mocked(processRfpParsingJob).mockImplementationOnce(async () => {
			parserEvents.push("completed");
			return { status: "completed" };
		});

		const result = await downloadDocument(
			baseDocument.id,
			"capture-user",
			undefined,
			{ parseMode: "inline" }
		);

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
			parsingStatus: "completed",
		});
		expect(parserEvents).toEqual(["completed"]);
		expect(processRfpParsingJob).toHaveBeenCalledWith({
			jobId: "00000000-0000-4000-8000-000000000501",
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			tenantContext: {
				userId: "capture-user",
				organizationId: "org-1",
			},
		});
		expect(insertedValues[1]).toMatchObject({
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			status: "queued",
		});
	});

	it("extracts and queues a supported RFP document from a downloaded ZIP package", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		const updates: Record<string, unknown>[] = [];
		const zip = new JSZip();
		zip.file("readme.txt", "General package notes.");
		zip.file("docs/Terms-of-Reference-RFP.pdf", Buffer.from("inner-pdf"));
		const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "Procurement-Package.zip",
			sourceUrl: "https://buyer.example/rfp/Procurement-Package.zip",
		});
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
				onValues: (value) => insertedValues.push(value),
			}));
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(new Blob([zipBuffer as unknown as BlobPart]), {
			status: 200,
			headers: {
				"content-length": String(zipBuffer.length),
				"content-type": "application/zip",
			},
		}));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
			mimeType: "application/pdf",
			fileSize: Buffer.from("inner-pdf").length,
		});
		expect(storageMock.uploadToLinodeE3).toHaveBeenCalledWith(
			storageConfig,
			expect.objectContaining({
				body: Buffer.from("inner-pdf"),
				contentType: "application/pdf",
				contentLength: Buffer.from("inner-pdf").length,
			})
		);
		expect(updates).toContainEqual(expect.objectContaining({
			status: "downloaded",
			mimeType: "application/pdf",
			extractedText: "Extracted RFP text",
		}));
		expect(insertedValues[0]).toMatchObject({
			filename: "Terms-of-Reference-RFP.pdf",
			fileType: "pdf",
			fileSize: Buffer.from("inner-pdf").length,
			extractedText: "Extracted RFP text",
			metadata: expect.objectContaining({
				sourceUrl: "https://buyer.example/rfp/Procurement-Package.zip",
				ingestWorkflow: expect.objectContaining({
					sourceOpportunityDocumentId: baseDocument.id,
				}),
			}),
		});
		expect(processRfpParsingJob).toHaveBeenCalledWith({
			jobId: "00000000-0000-4000-8000-000000000501",
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			tenantContext: {
				userId: "capture-user",
				organizationId: "org-1",
			},
		});
	});

	it("reports inline parser failures without downgrading the successful download", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
			}));
		vi.mocked(processRfpParsingJob).mockResolvedValueOnce({
			status: "failed",
			error: "AI parser returned malformed sections",
		});

		const result = await downloadDocument(
			baseDocument.id,
			"capture-user",
			undefined,
			{ parseMode: "inline" }
		);

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
			parsingStatus: "failed",
			parsingError: "AI parser returned malformed sections",
		});
	});

	it("uses pdftotext before DocLing for PDF extraction during download", async () => {
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
		execFileMock.mockImplementation((_file, args, _options, callback) => {
			expect(args).toEqual(expect.arrayContaining(["-layout", "-enc", "UTF-8", "-"]));
			callback(null, "pdftotext extracted RFP text with enough content.", "");
		});

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
		});
		expect(doclingMock.processRfpDocument).not.toHaveBeenCalled();
		expect(pdfParseGetTextMock).not.toHaveBeenCalled();
		expect(updates).toContainEqual(expect.objectContaining({
			status: "downloaded",
			extractedText: "pdftotext extracted RFP text with enough content.",
			extractedAt: expect.any(Date),
		}));
		expect(insertedValues[0]).toMatchObject({
			extractedText: "pdftotext extracted RFP text with enough content.",
		});
	});

	it("falls back to local PDF extraction when pdftotext and DocLing are unavailable during download", async () => {
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
		doclingMock.processRfpDocument.mockRejectedValue(new Error("DocLing unavailable"));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
		});
		expect(pdfParseGetTextMock).toHaveBeenCalledWith({ pageJoiner: "\n\n" });
		expect(pdfParseDestroyMock).toHaveBeenCalled();
		expect(updates).toContainEqual(expect.objectContaining({
			status: "downloaded",
			extractedText: "Locally extracted PDF RFP text with enough content.",
			pageCount: 2,
			extractedAt: expect.any(Date),
		}));
		expect(insertedValues[0]).toMatchObject({
			extractedText: "Locally extracted PDF RFP text with enough content.",
			pageCount: 2,
		});
	});

	it("falls back to local DOCX extraction when later text extraction cannot reach DocLing", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "Main RFP.docx",
			localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			extractedText: null,
		});
		doclingMock.processRfpDocument.mockRejectedValue(new Error("DocLing unavailable"));

		const text = await extractDocumentText(baseDocument.id);

		expect(text).toBe("Locally extracted DOCX RFP text with enough content.");
		expect(mammothExtractRawTextMock).toHaveBeenCalledWith({ buffer: Buffer.from("downloaded-pdf") });
		expect(dbMock.update).toHaveBeenCalled();
	});

	it("falls back from DocLing to sanitized legacy DOC text without storing binary control bytes", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		const updates: Record<string, unknown>[] = [];
		const readableText = [
			"Request for Proposal for procurement of data loggers.",
			"Tender submission must include delivery schedule, warranty, bidder qualifications, and pricing.",
			"Expression of Interest responses are due before the submission deadline.",
		].join(" ");
		const legacyDocBuffer = Buffer.concat([
			Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00]),
			Buffer.from(readableText, "utf16le"),
		]);

		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "Supplier-EOI.doc",
			sourceUrl: "https://buyer.example/rfp/Supplier-EOI.doc",
			mimeType: "application/msword",
		});
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
				onValues: (value) => insertedValues.push(value),
			}));
		doclingMock.processRfpDocument.mockRejectedValueOnce(new Error("DocLing unavailable"));
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(new Blob([legacyDocBuffer as unknown as BlobPart]), {
			status: 200,
			headers: {
				"content-length": String(legacyDocBuffer.length),
				"content-type": "application/msword",
			},
		}));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			mimeType: "application/msword",
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
		});
		expect(doclingMock.processRfpDocument).toHaveBeenCalled();
		expect(updates).toContainEqual(expect.objectContaining({
			status: "downloaded",
			extractedText: expect.stringContaining("Request for Proposal"),
			extractedAt: expect.any(Date),
		}));
		expect(insertedValues[0]).toMatchObject({
			filename: "Supplier-EOI.doc",
			fileType: "doc",
			extractedText: expect.stringContaining("Tender submission"),
		});
		expect(String(insertedValues[0].extractedText)).not.toContain("\u0000");
	});

	it("extracts and queues procurement-plan text from downloaded XLSX source documents", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		const updates: Record<string, unknown>[] = [];
		const xlsxBuffer = await buildXlsxWorkbook([
			["Package", "Method", "Deadline"],
			["Consulting services for feasibility study", "Request for Bids", "June 16 2026"],
		]);

		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "Procurement-Plan.xlsx",
			sourceUrl: "https://buyer.example/rfp/Procurement-Plan.xlsx",
		});
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
				onValues: (value) => insertedValues.push(value),
			}));
		doclingMock.processRfpDocument.mockRejectedValueOnce(new Error("DocLing unavailable"));
		fetchPublicHttpUrlMock.mockResolvedValue(new Response(new Blob([xlsxBuffer as unknown as BlobPart]), {
			status: 200,
			headers: {
				"content-length": String(xlsxBuffer.length),
				"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		}));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			fileSize: xlsxBuffer.length,
		});
		expect(updates).toContainEqual(expect.objectContaining({
			status: "downloaded",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			extractedText: expect.stringContaining("Sheet: Procurement Plan"),
		}));
		expect(insertedValues[0]).toMatchObject({
			filename: "Procurement-Plan.xlsx",
			fileType: "xlsx",
			fileSize: xlsxBuffer.length,
			extractedText: expect.stringContaining("Consulting services for feasibility study"),
		});
		expect(insertedValues[0].extractedText).toContain("Request for Bids");
		expect(insertedValues[0].extractedText).toContain("June 16 2026");
		expect(processRfpParsingJob).toHaveBeenCalledWith({
			jobId: "00000000-0000-4000-8000-000000000501",
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			tenantContext: {
				userId: "capture-user",
				organizationId: "org-1",
			},
		});
	});

	it("allows invalid TLS only for Kenya PPIP source document downloads", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			sourceUrl: "https://tenders.go.ke/storage/Documents/registration.pdf",
		});
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
			}));

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result.success).toBe(true);
		expect(fetchPublicHttpUrlMock).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: "tenders.go.ke" }),
			expect.objectContaining({
				allowInvalidTlsForHosts: ["tenders.go.ke"],
			}),
			"Document source URL"
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

	it("records remediation workflow when a downloaded RFP cannot be queued without a default workspace", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);
		dbMock.query.userWorkspaces.findFirst.mockResolvedValue(null);

		const result = await downloadDocument(baseDocument.id, "capture-user");

		expect(result).toMatchObject({
			success: true,
			documentId: baseDocument.id,
			rfpDocumentId: undefined,
			parsingJobId: undefined,
		});
		expect(processRfpParsingJob).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "discovery_rfp_ingest",
				subjectType: "opportunity_document",
				subjectId: baseDocument.id,
				toState: "parse_queue_failed",
				reason: "Downloaded document could not be queued because the user has no default workspace.",
				priority: "high",
				assignedTo: "capture-user",
			})
		);
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: `rfp-ingest-remediation:${baseDocument.id}`,
				state: "open",
				priority: "high",
				assignedTo: "capture-user",
			})
		);
	});

	it("queues automated discovery downloads under the document organization without a user workspace", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);
		dbMock.query.userWorkspaces.findFirst.mockResolvedValue(null);
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
				onValues: (value) => insertedValues.push(value),
			}));

		const result = await downloadDocument(baseDocument.id, "system");

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
		});
		expect(insertedValues[0]).toMatchObject({
			organizationId: "org-1",
			uploadedBy: "system",
		});
		expect(processRfpParsingJob).toHaveBeenCalledWith({
			jobId: "00000000-0000-4000-8000-000000000501",
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			tenantContext: {
				userId: "system",
				organizationId: "org-1",
			},
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "queued_for_parse",
				actorId: "system",
				assignedTo: null,
			})
		);
	});

	it("recovers blocked source document downloads from a Firecrawl-scraped landing page", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		const updates: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "Medicines-Tender-Calendar-2025-2026.pdf",
			sourceUrl: "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf",
		});
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000401", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000501" }],
				onValues: (value) => insertedValues.push(value),
			}));
		fetchPublicHttpUrlMock.mockResolvedValue(new Response("blocked", {
			status: 403,
			statusText: "Forbidden",
			headers: { "content-type": "text/html" },
		}));
		searchSearxngMock.mockResolvedValue({
			results: [{
				url: "https://www.unicef.org/supply/documents/medicines-tender-calendar",
				title: "Medicines Tender Calendar | UNICEF Supply Division",
				content: "Medicines Tender Calendar 2025-2026 pdf procurement",
				engine: "brave",
				score: 1,
			}],
		});
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Medicines Tender Calendar",
					"2025-2026 calendar for the yearly bidding exercise for medicines procurement.",
					"Files available for download",
					"[Medicines Tender Calendar 2025-2026 (pdf)](https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf)",
					"Suppliers should register on UNGM and monitor tender launch timing.",
				].join("\n\n"),
				links: ["https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf"],
			},
		});
		doclingMock.processRfpDocument.mockRejectedValue(new Error("DocLing unavailable"));

		const result = await downloadDocument(baseDocument.id, "system");

		expect(result).toMatchObject({
			success: true,
			rfpDocumentId: "00000000-0000-4000-8000-000000000401",
			parsingJobId: "00000000-0000-4000-8000-000000000501",
			mimeType: "text/html",
			provenance: expect.objectContaining({
				sourceUrl: "https://www.unicef.org/supply/documents/medicines-tender-calendar",
				originalSourceUrl: "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf",
				downloadMethod: "firecrawl_landing_page_html",
			}),
		});
		expect(searchSearxngMock).toHaveBeenCalled();
		expect(firecrawlScrapeMock).toHaveBeenCalledWith(
			"https://www.unicef.org/supply/documents/medicines-tender-calendar",
			expect.objectContaining({ formats: ["markdown", "html", "links"] })
		);
		expect(storageMock.uploadToLinodeE3).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				contentType: "text/html",
				key: expect.stringContaining("Main-RFP.pdf"),
			})
		);
		expect(updates).toContainEqual(expect.objectContaining({
			status: "downloaded",
			mimeType: "text/html",
			extractedText: expect.stringContaining("Medicines Tender Calendar"),
		}));
		expect(insertedValues[0]).toMatchObject({
			fileType: "html",
			extractedText: expect.stringContaining("Medicines Tender Calendar"),
			metadata: expect.objectContaining({
				sourceUrl: "https://www.unicef.org/supply/documents/medicines-tender-calendar",
			}),
		});
	});

	it("uses the browser scraper when Firecrawl recovery returns a challenge page", async () => {
		const insertedValues: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "Medicines-Tender-Calendar-2025-2026.pdf",
			sourceUrl: "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf",
		});
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000411", organizationId: "org-1" }],
				onValues: (value) => insertedValues.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000511" }],
				onValues: (value) => insertedValues.push(value),
			}));
		fetchPublicHttpUrlMock.mockResolvedValue(new Response("blocked", {
			status: 403,
			statusText: "Forbidden",
			headers: { "content-type": "text/html" },
		}));
		firecrawlScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: "<title>Just a moment...</title> checking your browser before accessing unicef.org",
				html: "<html><title>Just a moment...</title></html>",
				links: [],
			},
		});
		browserScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# Medicines Tender Calendar",
					"2025-2026 calendar for medicines procurement bidding.",
					"Suppliers should monitor tender launch timing through UNICEF Supply Division.",
					"The recovered procurement page includes bid-plan context, expected tender windows, supplier registration guidance, and links back to the blocked source document.",
					"This content is long enough to be stored as the source-page surrogate when the original PDF remains unavailable to server-side fetch.",
				].join("\n\n"),
				html: "<html><body><h1>Medicines Tender Calendar</h1></body></html>",
				links: ["https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf"],
			},
		});
		doclingMock.processRfpDocument.mockRejectedValue(new Error("DocLing unavailable"));

		const result = await downloadDocument(baseDocument.id, "system");

		expect(result).toMatchObject({
			success: true,
			mimeType: "text/html",
			provenance: expect.objectContaining({
				sourceUrl: "https://www.unicef.org/supply/documents/medicines-tender-calendar",
				originalSourceUrl: "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf",
				downloadMethod: "browser_landing_page_html",
			}),
		});
		expect(browserScrapeMock).toHaveBeenCalledWith(
			"http://84.247.181.100:3003",
			"https://www.unicef.org/supply/documents/medicines-tender-calendar",
			expect.objectContaining({
				formats: ["markdown", "html", "links"],
				humanScroll: true,
				blockMedia: true,
			})
		);
		expect(insertedValues[0]).toMatchObject({
			fileType: "html",
			extractedText: expect.stringContaining("Medicines Tender Calendar"),
			metadata: expect.objectContaining({
				downloadMethod: "browser_landing_page_html",
			}),
		});
	});

	it("uses CloakBrowser recovery when Firecrawl and the browser service cannot scrape a candidate", async () => {
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			...baseDocument,
			documentName: "UNICEF-Nutrition-Bid-Plan-4Q-2024-2025.pdf",
			sourceUrl: "https://www.unicef.org/supply/media/22861/file/UNICEF-Nutrition-Bid-Plan-4Q-2024-2025.pdf",
		});
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000421", organizationId: "org-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000521" }],
			}));
		fetchPublicHttpUrlMock.mockResolvedValue(new Response("blocked", {
			status: 403,
			statusText: "Forbidden",
			headers: { "content-type": "text/html" },
		}));
		firecrawlScrapeMock.mockResolvedValue({ success: false, error: "blocked by challenge" });
		browserScrapeMock.mockResolvedValue({ success: false, error: "browser service returned challenge page" });
		cloakScrapeMock.mockResolvedValue({
			success: true,
			data: {
				markdown: [
					"# UNICEF Nutrition Bid Plan",
					"4Q 2024-2025 plan for nutrition procurement bidding.",
					"The CloakBrowser-rendered procurement page includes bid-plan context, expected tender windows, supplier registration guidance, and links back to the blocked source document.",
					"This rendered page is long enough to be stored as a source-page surrogate when direct PDF fetches and hosted scraping services both fail.",
				].join("\n\n"),
				html: "<html><body><h1>UNICEF Nutrition Bid Plan</h1></body></html>",
				links: [],
			},
		});
		doclingMock.processRfpDocument.mockRejectedValue(new Error("DocLing unavailable"));

		const result = await downloadDocument(baseDocument.id, "system");

		expect(result).toMatchObject({
			success: true,
			mimeType: "text/html",
			provenance: expect.objectContaining({
				downloadMethod: "cloakbrowser_landing_page_html",
			}),
		});
		expect(cloakScrapeMock).toHaveBeenCalledWith(
			"https://www.unicef.org/supply/documents/unicef-nutrition-bid-plan-4q",
			expect.objectContaining({
				humanScroll: true,
				blockMedia: true,
			})
		);
	});

	it("rejects oversized downloads even when content-length is absent", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(baseDocument);
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		fetchPublicHttpUrlMock.mockResolvedValue({
			ok: true,
			headers: new Headers({
				"content-type": "application/pdf",
			}),
			arrayBuffer: vi.fn(async () => new ArrayBuffer(1)),
		});
		const bufferFromSpy = vi
			.spyOn(Buffer, "from")
			.mockReturnValueOnce({ length: 101 * 1024 * 1024 } as unknown as Buffer<ArrayBuffer>);

		let result;
		try {
			result = await downloadDocument(baseDocument.id, "capture-user");
		} finally {
			bufferFromSpy.mockRestore();
		}

		expect(result).toMatchObject({
			success: false,
			documentId: baseDocument.id,
			error: "File too large: 101.0MB (max 100MB)",
		});
		expect(storageMock.uploadToLinodeE3).not.toHaveBeenCalled();
		expect(doclingMock.processRfpDocument).not.toHaveBeenCalled();
		expect(updates).toContainEqual(expect.objectContaining({
			status: "failed",
			lastError: "File too large: 101.0MB (max 100MB)",
		}));
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
					fileHash: downloadedPdfHash,
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
					fileHash: downloadedPdfHash,
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

	it("rejects scoped document reads when stored bytes do not match the recorded hash", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				document: {
					...baseDocument,
					localPath: "s3://mansa/rfp/opportunity/document/Main-RFP.pdf",
					mimeType: "application/pdf",
					fileHash: "0".repeat(64),
					downloadedBy: "capture-user",
				},
				opportunity: {
					id: baseDocument.opportunityId,
					assignedTo: "assigned-user",
				},
			}],
		}));

		await expect(getOpportunityDocumentFileForActor(
			{ userId: "assigned-user", roles: ["writer"] },
			baseDocument.opportunityId,
			baseDocument.id
		)).rejects.toBeInstanceOf(OpportunityDocumentIntegrityError);
	});
});
