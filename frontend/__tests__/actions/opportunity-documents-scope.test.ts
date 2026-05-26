import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServerSessionMock = vi.hoisted(() => vi.fn());
const getOpportunityDocumentsMock = vi.hoisted(() => vi.fn());
const updateDocumentSelectionMock = vi.hoisted(() => vi.fn());
const updateAllDocumentSelectionsMock = vi.hoisted(() => vi.fn());
const downloadDocumentMock = vi.hoisted(() => vi.fn());
const downloadSelectedDocumentsMock = vi.hoisted(() => vi.fn());
const deleteDocumentMock = vi.hoisted(() => vi.fn());
const discoverDocumentsMock = vi.hoisted(() => vi.fn());
const discoverDocumentsWithAgentMock = vi.hoisted(() => vi.fn());
const extractDocumentTextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectAssignedOpportunityScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.assignedTo");
	expect(sqlText).toContain("document-user-1");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	query: {
		opportunityDocuments: {
			findFirst: ReturnType<typeof vi.fn>;
		};
		rfpDocuments: {
			findFirst: ReturnType<typeof vi.fn>;
		};
		rfpParsingJobs: {
			findFirst: ReturnType<typeof vi.fn>;
		};
	};
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: requireServerSessionMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		query: {
			opportunityDocuments: {
				findFirst: vi.fn(),
			},
			rfpDocuments: {
				findFirst: vi.fn(),
			},
			rfpParsingJobs: {
				findFirst: vi.fn(),
			},
		},
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		assignedTo: "opportunities.assignedTo",
		title: "opportunities.title",
		rfpLink: "opportunities.rfpLink",
		portalUrl: "opportunities.portalUrl",
		documentUrl: "opportunities.documentUrl",
		documentsDiscovered: "opportunities.documentsDiscovered",
		documentsDiscoveredAt: "opportunities.documentsDiscoveredAt",
		lastDocumentScanAt: "opportunities.lastDocumentScanAt",
	},
	opportunityDocuments: {
		id: "opportunityDocuments.id",
		opportunityId: "opportunityDocuments.opportunityId",
		sourceUrl: "opportunityDocuments.sourceUrl",
		documentName: "opportunityDocuments.documentName",
		documentType: "opportunityDocuments.documentType",
		description: "opportunityDocuments.description",
		status: "opportunityDocuments.status",
		isSelected: "opportunityDocuments.isSelected",
	},
}));

vi.mock("@/lib/db/schema-rfp", () => ({
	rfpDocuments: {
		id: "rfpDocuments.id",
		opportunityId: "rfpDocuments.opportunityId",
		fileHash: "rfpDocuments.fileHash",
		createdAt: "rfpDocuments.createdAt",
	},
	rfpParsingJobs: {
		id: "rfpParsingJobs.id",
		rfpDocumentId: "rfpParsingJobs.rfpDocumentId",
		createdAt: "rfpParsingJobs.createdAt",
	},
}));

vi.mock("@/lib/services/rfp-document-service", () => ({
	discoverDocuments: discoverDocumentsMock,
	downloadDocument: downloadDocumentMock,
	downloadSelectedDocuments: downloadSelectedDocumentsMock,
	getOpportunityDocuments: getOpportunityDocumentsMock,
	updateDocumentSelection: updateDocumentSelectionMock,
	updateAllDocumentSelections: updateAllDocumentSelectionsMock,
	getDocumentFile: vi.fn(),
	deleteDocument: deleteDocumentMock,
	extractDocumentText: extractDocumentTextMock,
}));

vi.mock("@/lib/services/document-discovery-agent", () => ({
	discoverDocumentsWithAgent: discoverDocumentsWithAgentMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import {
	deleteOpportunityDocument,
	downloadSelectedOpportunityDocuments,
	getOpportunityDocumentsAction,
	ingestOpportunitySourceDocument,
	toggleDocumentSelection,
} from "@/lib/actions/opportunity-documents";

const opportunityId = "11111111-1111-4111-8111-111111111111";
const otherOpportunityId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
	vi.clearAllMocks();
	requireServerSessionMock.mockResolvedValue({ user: { id: "document-user-1" } });
	dbMock.query.opportunityDocuments.findFirst.mockReset();
	dbMock.query.rfpDocuments.findFirst.mockReset();
	dbMock.query.rfpParsingJobs.findFirst.mockReset();
	dbMock.insert.mockReset();
	dbMock.update.mockReset();
});

describe("opportunity document action scoping", () => {
	it("does not list documents until the opportunity is assigned to the actor", async () => {
		let where: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				where = value;
			},
		}));

		const result = await getOpportunityDocumentsAction(opportunityId);

		expect(result).toEqual({
			success: false,
			error: "Opportunity not found or not permitted",
		});
		expect(getOpportunityDocumentsMock).not.toHaveBeenCalled();
		expectAssignedOpportunityScope(where);
	});

	it("scopes bulk document downloads by assigned opportunity", async () => {
		let where: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ id: opportunityId }],
			onWhere: (value) => {
				where = value;
			},
		}));
		downloadSelectedDocumentsMock.mockResolvedValue({
			success: 1,
			failed: 0,
			results: [{ success: true, documentId }],
		});

		await expect(downloadSelectedOpportunityDocuments(opportunityId)).resolves.toMatchObject({
			success: true,
			downloaded: 1,
			failed: 0,
		});

		expect(downloadSelectedDocumentsMock).toHaveBeenCalledWith(opportunityId, "document-user-1");
		expectAssignedOpportunityScope(where);
	});

	it("scopes single-document mutations through the assigned opportunity", async () => {
		let where: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ id: documentId, opportunityId }],
			onWhere: (value) => {
				where = value;
			},
		}));
		updateDocumentSelectionMock.mockResolvedValue([{ id: documentId, isSelected: false }]);

		const result = await toggleDocumentSelection(documentId, false);

		expect(result).toEqual({
			success: true,
			document: { id: documentId, isSelected: false },
		});
		expect(updateDocumentSelectionMock).toHaveBeenCalledWith(documentId, false);
		expectAssignedOpportunityScope(where);
		expect(collectSqlFragments(where).join(" ")).toContain("opportunityDocuments.id");
	});

	it("refuses document deletes when the assigned document belongs to another opportunity", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ id: documentId, opportunityId: otherOpportunityId }],
		}));

		const result = await deleteOpportunityDocument(opportunityId, documentId);

		expect(result).toEqual({
			success: false,
			error: "Document does not belong to this opportunity",
		});
		expect(deleteDocumentMock).not.toHaveBeenCalled();
	});

	it("creates a source document and queues RFP intake for direct opportunity links", async () => {
		let insertedSourceDocument: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: opportunityId,
				title: "Case Management Platform RFP",
				rfpLink: "https://example.test/tender",
				portalUrl: "https://example.test/tender",
				documentUrl: "https://example.test/downloads/rfp.pdf",
			}],
		}));
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue(null);
		dbMock.insert.mockReturnValueOnce({
			values: vi.fn((value: Record<string, unknown>) => {
				insertedSourceDocument = value;
				return {
					returning: vi.fn(async () => [{ id: documentId }]),
				};
			}),
		});
		dbMock.update.mockReturnValueOnce({
			set: vi.fn(() => ({
				where: vi.fn(async () => undefined),
			})),
		});
		downloadDocumentMock.mockResolvedValue({
			success: true,
			documentId,
			rfpDocumentId: "rfp-1",
			parsingJobId: "parse-1",
			storagePath: "s3://rfp/rfp.pdf",
		});

		const result = await ingestOpportunitySourceDocument(opportunityId);

		expect(result).toMatchObject({
			success: true,
			status: "queued_from_source",
			documentId,
			rfpDocumentId: "rfp-1",
			parsingJobId: "parse-1",
		});
		expect(insertedSourceDocument).toMatchObject({
			sourceUrl: "https://example.test/downloads/rfp.pdf",
			documentName: "rfp.pdf",
			documentType: "rfp",
			status: "discovered",
			isSelected: true,
		});
		expect(downloadDocumentMock).toHaveBeenCalledWith(documentId, "document-user-1", opportunityId);
	});

	it("returns linked parser references when a source document was already ingested", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: opportunityId,
				title: "Case Management Platform RFP",
				rfpLink: "https://example.test/rfp.pdf",
				portalUrl: "https://example.test/tender",
				documentUrl: null,
			}],
		}));
		dbMock.query.opportunityDocuments.findFirst.mockResolvedValue({
			id: documentId,
			status: "downloaded",
			localPath: "s3://rfp/rfp.pdf",
			fileSizeBytes: 1024,
			mimeType: "application/pdf",
			fileHash: "hash-1",
		});
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			id: "rfp-existing-1",
		});
		dbMock.query.rfpParsingJobs.findFirst.mockResolvedValue({
			id: "parse-existing-1",
		});

		const result = await ingestOpportunitySourceDocument(opportunityId);

		expect(result).toMatchObject({
			success: true,
			status: "already_downloaded",
			documentId,
			rfpDocumentId: "rfp-existing-1",
			parsingJobId: "parse-existing-1",
			storagePath: "s3://rfp/rfp.pdf",
		});
		expect(downloadDocumentMock).not.toHaveBeenCalled();
	});
});
