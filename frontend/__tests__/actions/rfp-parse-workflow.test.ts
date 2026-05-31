import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

const requireUserContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => {
	const userHasAuthorityRole = (
		context: { role?: string; roles?: string[] },
		requiredRole: string
	) => {
		const roles = new Set([context.role, ...(context.roles ?? [])]
			.filter(Boolean)
			.map((value) => String(value).trim().toLowerCase()));
		return roles.has("admin") || roles.has(requiredRole.trim().toLowerCase());
	};
	return {
		getCurrentUserId: vi.fn(async () => "capture-lead"),
		requireUserContext: requireUserContextMock,
		userHasAuthorityRole,
	};
});

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: vi.fn(async () => ({
		userId: "capture-lead",
		organizationId: "org-1",
		roles: ["admin"],
	})),
}));

vi.mock("@/lib/ai/rfp-parser", () => ({
	parseRFPWithAI: vi.fn(),
	batchExtractRequirements: vi.fn(),
}));

const pdfTextMock = vi.hoisted(() => ({
	extractPdfTextWithPdftotext: vi.fn(),
	extractPdfTextWithPdfParse: vi.fn(),
}));

vi.mock("@/lib/documents/pdf-text", () => pdfTextMock);

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

const workflowRuntimeMock = vi.hoisted(() => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({
		id: "00000000-0000-4000-8000-000000000901",
	})),
	upsertWorkflowRuntimeTask: vi.fn(async () => undefined),
}));

vi.mock("@/lib/actions/workflow-runtime", () => workflowRuntimeMock);

const storageMock = vi.hoisted(() => ({
	downloadFromLinodeE3: vi.fn(),
	getLinodeE3ConfigFromEnv: vi.fn(),
}));

vi.mock("@/lib/storage/linode-e3", () => storageMock);

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit"]) {
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
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

const documentRow = {
	id: "00000000-0000-4000-8000-000000000101",
	opportunityId: "00000000-0000-4000-8000-000000000201",
	filename: "rfp.pdf",
	fileType: "pdf",
	fileSize: 1024,
	storagePath: "/uploads/rfp/rfp.pdf",
	fileHash: "hash",
	parsingStatus: "failed",
	parsingProgress: 42,
	parsingError: "OCR failed",
	metadata: {
		parseWorkflow: {
			state: "failed",
			attempt: 1,
			history: [],
		},
	},
};

const latestJob = {
	id: "00000000-0000-4000-8000-000000000301",
	rfpDocumentId: documentRow.id,
	status: "failed",
	currentStep: "Extracting text",
	progress: 42,
	errorMessage: "OCR failed",
	parsingOptions: {
		extractRequirements: true,
		generateEmbeddings: true,
		detectSections: true,
		classifyRequirements: true,
	},
	metadata: null,
	createdAt: new Date("2026-04-01T00:00:00.000Z"),
};

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		query: {
			rfpDocuments: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
			},
			rfpParsingJobs: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
			},
			rfpRequirements: {
				findMany: vi.fn(),
			},
			opportunities: {
				findFirst: vi.fn(),
			},
		},
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		delete: vi.fn(() => createChain()),
		execute: vi.fn(async () => []),
		transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock)),
	};
	return { db: dbMock };
});

import {
	applyRfpAmendmentSupersession,
	getRfpParseLifecycle,
	processRfpParsingJob,
	reviewRfpParseConfidence,
	transitionRfpParseWorkflow,
	uniqueRfpRequirementNumber,
} from "@/lib/actions/rfp-parser";
import { batchExtractRequirements, parseRFPWithAI } from "@/lib/ai/rfp-parser";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "capture-lead",
		organizationId: "org-1",
		roles: ["proposal_manager"],
	});
	dbMock.query.rfpDocuments.findFirst.mockResolvedValue(documentRow);
	dbMock.query.rfpParsingJobs.findFirst.mockResolvedValue(latestJob);
	dbMock.query.opportunities.findFirst.mockResolvedValue(undefined);
	dbMock.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock));
	dbMock.execute.mockResolvedValue([]);
	storageMock.getLinodeE3ConfigFromEnv.mockReturnValue({
		endpoint: "https://objects.example.com",
		region: "gb-lon-1",
		bucket: "mansa",
		accessKeyId: "access-key",
		secretAccessKey: "secret-key",
	});
	storageMock.downloadFromLinodeE3.mockResolvedValue({
		body: Buffer.from("stored-rfp-bytes"),
		contentType: "application/pdf",
		contentLength: 16,
		etag: "\"etag\"",
	});
	pdfTextMock.extractPdfTextWithPdftotext.mockResolvedValue(undefined);
	pdfTextMock.extractPdfTextWithPdfParse.mockResolvedValue(undefined);
});

describe("RFP parse workflow", () => {
	it("returns the latest metadata-backed parse lifecycle", async () => {
		const lifecycle = await getRfpParseLifecycle(documentRow.id);

		expect(lifecycle).toMatchObject({
			rfpDocumentId: documentRow.id,
			jobId: latestJob.id,
			state: "failed",
			progress: 42,
			currentStep: "Extracting text",
			error: "OCR failed",
		});
	});

	it("retries a failed parse with a new queued job and document history", async () => {
		let insertedJob: Record<string, unknown> | undefined;
		let documentUpdate: Record<string, unknown> | undefined;
		const newJob = { id: "00000000-0000-4000-8000-000000000302" };

		dbMock.insert.mockReturnValueOnce(createChain({
			onValues: (value) => {
				insertedJob = value;
			},
			result: [newJob],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				documentUpdate = value;
			},
		}));

		const result = await transitionRfpParseWorkflow({
			rfpDocumentId: documentRow.id,
			action: "retry",
			reason: "OCR profile updated",
			startProcessing: false,
		});

		expect(result).toMatchObject({
			rfpDocumentId: documentRow.id,
			jobId: newJob.id,
			state: "queued",
			progress: 0,
		});
		expect(dbMock.execute).toHaveBeenCalledTimes(1);
		expect(insertedJob).toMatchObject({
			rfpDocumentId: documentRow.id,
			status: "queued",
			currentStep: "Queued for retry",
			initiatedBy: "capture-lead",
		});
		expect(documentUpdate).toMatchObject({
			parsingStatus: "pending",
			parsingProgress: 0,
			parsingError: null,
		});
		expect((documentUpdate?.metadata as any).parseWorkflow.history[0]).toMatchObject({
			action: "retry",
			from: "failed",
			to: "queued",
			actorId: "capture-lead",
			reason: "OCR profile updated",
			jobId: newJob.id,
		});
	});

	it("rejects a failed parse as terminal workflow metadata", async () => {
		let jobUpdate: Record<string, unknown> | undefined;
		let documentUpdate: Record<string, unknown> | undefined;

		dbMock.update
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					jobUpdate = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					documentUpdate = value;
				},
			}));

		const result = await transitionRfpParseWorkflow({
			rfpDocumentId: documentRow.id,
			action: "reject",
			reason: "Duplicate upload",
			startProcessing: false,
		});

		expect(result?.state).toBe("rejected");
		expect(jobUpdate).toMatchObject({
			status: "failed",
			errorMessage: "Duplicate upload",
		});
		expect(documentUpdate).toMatchObject({
			parsingStatus: "failed",
			parsingError: "Duplicate upload",
		});
		expect((documentUpdate?.metadata as any).parseWorkflow.state).toBe("rejected");
	});

	it("requires proposal or operations authority before rejecting a failed parse", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "writer-1",
			organizationId: "org-1",
			roles: ["writer"],
		});

		await expect(
			transitionRfpParseWorkflow({
				rfpDocumentId: documentRow.id,
				action: "reject",
				reason: "Duplicate upload",
				startProcessing: false,
			})
		).rejects.toBeInstanceOf(WorkflowAuthorityDeniedError);

		expect(dbMock.transaction).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});

	it("blocks retry while a parse is already processing", async () => {
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			parsingStatus: "processing",
			metadata: null,
		});
		dbMock.query.rfpParsingJobs.findFirst.mockResolvedValue({
			...latestJob,
			status: "processing",
			progress: 50,
		});

		await expect(
			transitionRfpParseWorkflow({
				rfpDocumentId: documentRow.id,
				action: "retry",
				reason: "Operator clicked retry",
				startProcessing: false,
			})
		).rejects.toThrow("Cannot retry RFP parse from processing state");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("records human parse confidence acceptance metadata", async () => {
		let documentUpdate: Record<string, unknown> | undefined;
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			parsingStatus: "completed",
			parsingConfidence: 55,
			metadata: {
				parseReview: {
					state: "needs_review",
					confidence: 55,
					threshold: 80,
				},
			},
		});
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				documentUpdate = value;
			},
		}));

		const result = await reviewRfpParseConfidence({
			rfpDocumentId: documentRow.id,
			action: "accept",
			reason: "Reviewed source text and accepted parser output",
		});

		expect(result).toMatchObject({ success: true, state: "accepted" });
		expect((documentUpdate?.metadata as any).parseReview).toMatchObject({
			state: "accepted",
			confidence: 55,
			threshold: 80,
			reviewedBy: "capture-lead",
			reason: "Reviewed source text and accepted parser output",
		});
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: `rfp-parse-confidence:${documentRow.id}`,
				state: "completed",
				metadata: expect.objectContaining({
					reviewState: "accepted",
				}),
			})
		);
	});

	it("requires proposal or capture authority before reviewing parser confidence", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "writer-1",
			organizationId: "org-1",
			roles: ["writer"],
		});

		const result = await reviewRfpParseConfidence({
			rfpDocumentId: documentRow.id,
			action: "accept",
			reason: "Reviewed source text and accepted parser output",
		});

		expect(result).toMatchObject({
			success: false,
			error: "Reviewing parser output requires proposal or capture authority: requires proposal_manager or capture_manager",
		});
		expect(dbMock.query.rfpDocuments.findFirst).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});

	it("blocks parser confidence review until parsing is completed", async () => {
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			parsingStatus: "failed",
			parsingConfidence: 55,
			metadata: {
				parseReview: {
					state: "needs_review",
					confidence: 55,
					threshold: 80,
				},
			},
		});

		const result = await reviewRfpParseConfidence({
			rfpDocumentId: documentRow.id,
			action: "accept",
			reason: "Cannot accept failed parse",
		});

		expect(result).toMatchObject({
			success: false,
			error: "Parser output can only be reviewed after parsing completes",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("leaves successful parse jobs at completed progress", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "Submission instructions and technical requirements.",
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		vi.mocked(parseRFPWithAI).mockResolvedValue({
			issuingAgency: "UNICEF",
			solicitationNumber: "UNICEF-2026",
			sections: [{
				sectionId: "s1",
				title: "Submission Requirements",
				pageStart: 1,
				pageEnd: 1,
				content: "Submit a technical proposal.",
			}],
			confidence: 0.91,
		});
		vi.mocked(batchExtractRequirements).mockResolvedValue(new Map([[
			"s1",
			{
				source: "ai",
				requirements: [{
					requirementNumber: "REQ-001",
					sectionReference: "s1",
					title: "Technical Proposal",
					fullText: "Submit a technical proposal.",
					category: "technical",
					requirementType: "shall",
					priority: "mandatory",
					confidenceScore: 0.88,
					pageNumber: 1,
				}],
			},
		]]));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(updates).toEqual(expect.arrayContaining([
			expect.objectContaining({
				progress: 90,
				currentStep: "Finalizing",
			}),
			expect.objectContaining({
				status: "completed",
				progress: 100,
				currentStep: "Completed",
				requirementsExtracted: 1,
			}),
			expect.objectContaining({
				parsingStatus: "completed",
				parsingProgress: 100,
			}),
		]));
		const finalizingIndex = updates.findIndex((update) =>
			update.progress === 90 && update.currentStep === "Finalizing"
		);
		const completedIndex = updates.findIndex((update) =>
			update.status === "completed" && update.progress === 100 && update.currentStep === "Completed"
		);
		expect(finalizingIndex).toBeGreaterThanOrEqual(0);
		expect(completedIndex).toBeGreaterThan(finalizingIndex);
	});

	it("stores AI parsed metadata within database varchar limits", async () => {
		const updates: Record<string, unknown>[] = [];
		let insertedRequirements: Record<string, unknown>[] | undefined;
		const repeated = (value: string, length: number) => value.repeat(length);
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "Submission instructions and technical requirements.",
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert.mockReturnValue(createChain({
			onValues: (value) => {
				if (Array.isArray(value)) insertedRequirements = value;
			},
		}));
		vi.mocked(parseRFPWithAI).mockResolvedValue({
			issuingAgency: repeated("Agency ", 100),
			solicitationNumber: repeated("SOL-", 80),
			contractType: repeated("Cost reimbursement and fixed price ", 10),
			setAside: repeated("Set aside ", 20),
			sections: [{
				sectionId: "s1",
				title: repeated("Submission requirements ", 60),
				pageStart: 1,
				pageEnd: 1,
				content: "Submit a technical proposal.",
			}],
			confidence: 0.91,
		});
		vi.mocked(batchExtractRequirements).mockResolvedValue(new Map([[
			"s1",
			{
				source: "ai",
				requirements: [{
					requirementNumber: repeated("REQ-", 20),
					sectionReference: repeated("Section L.4 ", 20),
					title: repeated("Technical proposal ", 40),
					fullText: "Submit a technical proposal.",
					category: repeated("technical ", 10),
					subcategory: repeated("software implementation ", 10),
					requirementType: repeated("shall ", 10),
					priority: repeated("mandatory ", 10),
					confidenceScore: 0.88,
					pageNumber: 1,
				}],
			},
		]]) as any);

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		const metadataUpdate = updates.find((update) => update.parsingConfidence === 91);
		expect(String(metadataUpdate?.extractedTitle)).toHaveLength(1000);
		expect(String(metadataUpdate?.issuingOrganization)).toHaveLength(500);
		expect(String(metadataUpdate?.solicitationNumber)).toHaveLength(200);
		expect(String(metadataUpdate?.contractType)).toHaveLength(100);
		expect(String(metadataUpdate?.setAsideType)).toHaveLength(100);
		expect(insertedRequirements?.[0]).toMatchObject({
			requirementText: "Submit a technical proposal.",
			complianceStatus: "not_addressed",
		});
		expect(String(insertedRequirements?.[0]?.requirementNumber)).toHaveLength(50);
		expect(String(insertedRequirements?.[0]?.sourceSection)).toHaveLength(100);
		expect(String(insertedRequirements?.[0]?.title)).toHaveLength(500);
		expect(String(insertedRequirements?.[0]?.category)).toHaveLength(50);
		expect(String(insertedRequirements?.[0]?.subcategory)).toHaveLength(100);
		expect(String(insertedRequirements?.[0]?.requirementType)).toHaveLength(20);
		expect(String(insertedRequirements?.[0]?.priority)).toHaveLength(20);
	});

	it("deduplicates compacted requirement numbers before persistence", () => {
		const used = new Set<string>();
		const repeated = (value: string, length: number) => value.repeat(length);

		expect(uniqueRfpRequirementNumber("1", 0, used)).toBe("1");
		expect(uniqueRfpRequirementNumber("1", 1, used)).toBe("1-2");
		expect(uniqueRfpRequirementNumber(undefined, 2, used)).toBe("REQ-003");

		const longNumber = repeated("REQ-", 20);
		const first = uniqueRfpRequirementNumber(longNumber, 3, used);
		const second = uniqueRfpRequirementNumber(longNumber, 4, used);

		expect(first).toHaveLength(50);
		expect(second).toHaveLength(50);
		expect(second.endsWith("-2")).toBe(true);
		expect(new Set([first, second]).size).toBe(2);
	});

	it("normalizes AI parse results that omit sections before requirement extraction", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "ADB procurement notice with submission instructions and technical requirements.",
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		vi.mocked(parseRFPWithAI).mockResolvedValue({
			issuingAgency: "Asian Development Bank",
			solicitationNumber: "ADB-2026",
			confidence: 0.82,
		} as any);
		vi.mocked(batchExtractRequirements).mockResolvedValue(new Map([[
			"section-1",
			{
				source: "heuristic",
				requirements: [{
					requirementNumber: "REQ-001",
					sectionReference: "section-1",
					title: "Submission Instructions",
					fullText: "Submit a technical proposal.",
					category: "technical",
					requirementType: "shall",
					priority: "mandatory",
					confidenceScore: 0.72,
					pageNumber: 1,
				}],
			},
		]]));

		const result = await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(result).toEqual({ status: "completed" });
		expect(batchExtractRequirements).toHaveBeenCalledWith([
			expect.objectContaining({
				id: "section-1",
				text: "ADB procurement notice with submission instructions and technical requirements.",
			}),
		]);
		expect(updates).toEqual(expect.arrayContaining([
			expect.objectContaining({
				extractedTitle: "Document",
				detectedSections: ["Document"],
				parsingConfidence: 82,
			}),
			expect.objectContaining({
				status: "completed",
				requirementsExtracted: 1,
			}),
		]));
	});

	it("forces parser review when a completed parse extracts zero requirements", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "Submission instructions and technical requirements.",
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		vi.mocked(parseRFPWithAI).mockResolvedValue({
			issuingAgency: "COMESA",
			solicitationNumber: "COMESA-2026",
			sections: [{
				sectionId: "s1",
				title: "Requirements",
				pageStart: 1,
				pageEnd: 1,
				content: "Submission instructions and technical requirements.",
			}],
			confidence: 0.95,
		});
		vi.mocked(batchExtractRequirements).mockResolvedValue(new Map([[
			"s1",
			{
				source: "ai",
				requirements: [],
			},
		]]));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(updates).toEqual(expect.arrayContaining([
			expect.objectContaining({
				status: "completed",
				progress: 100,
				requirementsExtracted: 0,
			}),
		]));
		const finalDocumentUpdate = updates.find((update) =>
			update.parsingStatus === "completed" &&
			(update.metadata as any)?.parseReview?.qualitySignals?.includes("zero_requirements_extracted")
		);
		expect(finalDocumentUpdate).toMatchObject({
			parsingStatus: "completed",
			parsingProgress: 100,
			metadata: {
				parseReview: {
					state: "needs_review",
					confidence: 95,
					qualitySignals: ["zero_requirements_extracted"],
					reason: "Parser completed without extracting any actionable requirements.",
				},
				extractionProvenance: {
					source: "ai",
					aiSectionCount: 1,
					heuristicSectionCount: 0,
				},
			},
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "needs_confidence_review",
				reason: expect.stringContaining("without extracting any actionable requirements"),
				metadata: expect.objectContaining({
					qualitySignals: ["zero_requirements_extracted"],
				}),
			})
		);
	});

	it("derives review-required fallback requirements from opportunity metadata when notice parsing extracts none", async () => {
		const updates: Record<string, unknown>[] = [];
		let insertedRequirements: Record<string, unknown>[] | undefined;
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "Avis d'appel d'offres with deadline and DAO retrieval instructions.",
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.query.opportunities.findFirst.mockResolvedValue({
			id: documentRow.opportunityId,
			organizationId: "org-1",
			title: "Acquisition de materiel informatique pour les communes",
			deadline: new Date("2026-07-15T10:00:00.000Z"),
			projectSummary: "Supply and install computers, printers, and network equipment.",
			projectScope: null,
			keyRequirements: "Provide warranty, delivery schedule, and after-sales service.",
			technicalRequirements: "Equipment must meet the minimum specifications in the notice.",
			submissionMethod: "Depot physique au secretariat de la PRMP.",
			submissionRequirements: "Include administrative, technical, and financial offers.",
			sourcePlatform: "Benin Public Procurement Portal",
		});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert.mockReturnValue(createChain({
			onValues: (value) => {
				if (Array.isArray(value)) insertedRequirements = value;
			},
		}));
		vi.mocked(parseRFPWithAI).mockResolvedValue({
			issuingAgency: "Benin PRMP",
			solicitationNumber: "AO-2026",
			sections: [{
				sectionId: "s1",
				title: "Avis",
				pageStart: 1,
				pageEnd: 1,
				content: "Avis d'appel d'offres with deadline and DAO retrieval instructions.",
			}],
			confidence: 0.93,
		});
		vi.mocked(batchExtractRequirements).mockResolvedValue(new Map([[
			"s1",
			{
				source: "ai",
				requirements: [],
			},
		]]));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(insertedRequirements?.length).toBeGreaterThanOrEqual(6);
		expect(insertedRequirements).toEqual(expect.arrayContaining([
			expect.objectContaining({
				requirementNumber: "META-001",
				sourceSection: "Opportunity metadata: title",
				requirementText: expect.stringContaining("Acquisition de materiel informatique"),
				category: "administrative",
				aiAnalysis: expect.objectContaining({
					source: "opportunity_metadata_fallback",
				}),
			}),
			expect.objectContaining({
				sourceSection: "Opportunity metadata: deadline",
				requirementText: "Submit the response by the published deadline: 2026-07-15T10:00:00.000Z.",
				category: "administrative",
			}),
			expect.objectContaining({
				sourceSection: "Opportunity metadata: technicalRequirements",
				category: "technical",
			}),
		]));
		expect(updates).toEqual(expect.arrayContaining([
			expect.objectContaining({
				status: "completed",
				progress: 100,
				requirementsExtracted: insertedRequirements?.length,
			}),
		]));
		const finalDocumentUpdate = updates.find((update) =>
			update.parsingStatus === "completed" &&
			(update.metadata as any)?.parseReview?.qualitySignals?.includes("metadata_fallback_requirements")
		);
		expect(finalDocumentUpdate).toMatchObject({
			parsingStatus: "completed",
			parsingProgress: 100,
			metadata: {
				parseReview: {
					state: "needs_review",
					confidence: 93,
					qualitySignals: ["metadata_fallback_requirements"],
					reason: "Parser extracted no document requirements; fallback requirements were derived from opportunity metadata and require review.",
				},
				extractionProvenance: {
					source: "metadata_fallback",
					aiSectionCount: 1,
					heuristicSectionCount: 0,
					metadataFallbackRequirementCount: insertedRequirements?.length,
				},
			},
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "needs_confidence_review",
				reason: expect.stringContaining("fallback requirements were derived"),
				metadata: expect.objectContaining({
					qualitySignals: ["metadata_fallback_requirements"],
				}),
			})
		);
	});

	it("uses opportunity metadata fallback when document text extraction is unreadable", async () => {
		const updates: Record<string, unknown>[] = [];
		let insertedRequirements: Record<string, unknown>[] | undefined;
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "",
			fileHash: undefined,
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.query.opportunities.findFirst.mockResolvedValue({
			id: documentRow.opportunityId,
			organizationId: "org-1",
			title: "Consulting services for public finance platform support",
			organization: "DGMP Mali",
			deadline: new Date("2026-08-20T12:00:00.000Z"),
			projectSummary: "Recruit a consultant to support digital procurement reporting.",
			projectScope: null,
			keyRequirements: "Demonstrate similar assignments and regional experience.",
			technicalRequirements: null,
			submissionMethod: "Email submission to the procurement unit.",
			submissionRequirements: "Submit CV, technical approach, and financial proposal.",
			sourcePlatform: "DGMP Mali",
		});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));
		dbMock.insert.mockReturnValue(createChain({
			onValues: (value) => {
				if (Array.isArray(value)) insertedRequirements = value;
			},
		}));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(parseRFPWithAI).not.toHaveBeenCalled();
		expect(batchExtractRequirements).not.toHaveBeenCalled();
		expect(insertedRequirements?.length).toBeGreaterThanOrEqual(5);
		expect(insertedRequirements).toEqual(expect.arrayContaining([
			expect.objectContaining({
				sourceSection: "Opportunity metadata: submissionRequirements",
				requirementText: expect.stringContaining("technical approach"),
				aiAnalysis: expect.objectContaining({
					source: "opportunity_metadata_fallback",
				}),
			}),
		]));
		const parsedMetadataUpdate = updates.find((update) => update.parsingConfidence === 20);
		expect(parsedMetadataUpdate).toMatchObject({
			extractedTitle: "Consulting services for public finance platform support",
			issuingOrganization: "DGMP Mali",
			responseDeadline: new Date("2026-08-20T12:00:00.000Z"),
			detectedSections: ["Consulting services for public finance platform support"],
		});
		const finalDocumentUpdate = updates.find((update) =>
			update.parsingStatus === "completed" &&
			(update.metadata as any)?.extractionProvenance?.documentTextMetadataFallback
		);
		expect(finalDocumentUpdate).toMatchObject({
			parsingStatus: "completed",
			metadata: {
				parseReview: {
					state: "needs_review",
					qualitySignals: [
						"metadata_fallback_requirements",
						"unreadable_document_metadata_fallback",
					],
				},
				extractionProvenance: {
					source: "metadata_fallback",
					metadataFallbackRequirementCount: insertedRequirements?.length,
					documentTextMetadataFallback: true,
				},
			},
		});
	});

	it("fails parsing jobs when text extraction returns no readable text", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.rfpDocuments.findFirst
			.mockResolvedValueOnce({
				...documentRow,
				extractedText: "",
				storagePath: "/path/does-not-exist.pdf",
				parsingStatus: "pending",
				metadata: null,
			})
			.mockResolvedValueOnce({
				...documentRow,
				parsingStatus: "processing",
				metadata: null,
			});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(parseRFPWithAI).not.toHaveBeenCalled();
		expect(updates).toEqual(expect.arrayContaining([
			expect.objectContaining({
				status: "failed",
				errorMessage: expect.stringContaining("RFP text extraction produced no readable text for rfp.pdf"),
			}),
			expect.objectContaining({
				parsingStatus: "failed",
				parsingError: expect.stringContaining("RFP text extraction produced no readable text for rfp.pdf"),
			}),
		]));
	});

	it("uses pdftotext before pdf-parse when a stored PDF lacks pre-extracted text", async () => {
		const insertedRequirements: Record<string, unknown>[][] = [];
		const pdfBuffer = Buffer.from("stored-rfp-bytes");
		const fileHash = createHash("sha256").update(pdfBuffer).digest("hex");
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			...documentRow,
			extractedText: "",
			storagePath: "s3://mansa/rfp/opportunity/document/rfp.pdf",
			fileHash,
			parsingStatus: "pending",
			metadata: null,
		});
		dbMock.insert.mockReturnValue(createChain({
			onValues: (value) => {
				if (Array.isArray(value)) insertedRequirements.push(value);
			},
		}));
		pdfTextMock.extractPdfTextWithPdftotext.mockResolvedValue({
			text: "RFP submission instructions and technical requirements from pdftotext.",
			extractor: "local_pdftotext",
		});
		vi.mocked(parseRFPWithAI).mockResolvedValue({
			issuingAgency: "AIIB",
			solicitationNumber: "AIIB-2026",
			sections: [{
				sectionId: "s1",
				title: "Submission Requirements",
				pageStart: 1,
				pageEnd: 1,
				content: "Submit a technical proposal.",
			}],
			confidence: 0.91,
		});
		vi.mocked(batchExtractRequirements).mockResolvedValue(new Map([[
			"s1",
			{
				source: "ai",
				requirements: [{
					requirementNumber: "REQ-001",
					sectionReference: "s1",
					title: "Technical Proposal",
					fullText: "Submit a technical proposal.",
					category: "technical",
					requirementType: "shall",
					priority: "mandatory",
					confidenceScore: 0.88,
					pageNumber: 1,
				}],
			},
		]]));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(pdfTextMock.extractPdfTextWithPdftotext).toHaveBeenCalledWith(
			pdfBuffer,
			"rfp.pdf",
			expect.objectContaining({ timeoutMs: 30_000 })
		);
		expect(pdfTextMock.extractPdfTextWithPdfParse).not.toHaveBeenCalled();
		expect(parseRFPWithAI).toHaveBeenCalledWith("RFP submission instructions and technical requirements from pdftotext.");
		expect(insertedRequirements[0]?.[0]).toMatchObject({
			requirementNumber: "REQ-001",
			requirementText: "Submit a technical proposal.",
		});
	});

	it("fails parsing jobs before AI extraction when stored RFP bytes do not match the recorded hash", async () => {
		const updates: Record<string, unknown>[] = [];
		dbMock.query.rfpDocuments.findFirst
			.mockResolvedValueOnce({
				...documentRow,
				extractedText: "",
				storagePath: "s3://mansa/rfp/opportunity/document/rfp.pdf",
				fileHash: "0".repeat(64),
				parsingStatus: "pending",
				metadata: null,
			})
			.mockResolvedValueOnce({
				...documentRow,
				parsingStatus: "processing",
				metadata: null,
			});
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));

		await processRfpParsingJob({
			jobId: latestJob.id,
			rfpDocumentId: documentRow.id,
			tenantContext: { userId: "capture-lead", organizationId: "org-1" },
		});

		expect(storageMock.downloadFromLinodeE3).toHaveBeenCalledWith(
			expect.any(Object),
			"s3://mansa/rfp/opportunity/document/rfp.pdf"
		);
		expect(parseRFPWithAI).not.toHaveBeenCalled();
		expect(updates).toEqual(expect.arrayContaining([
			expect.objectContaining({
				status: "failed",
				errorMessage: "RFP document hash mismatch",
			}),
			expect.objectContaining({
				parsingStatus: "failed",
				parsingError: "RFP document hash mismatch",
			}),
		]));
	});

	it("requires proposal or capture authority before applying amendment impact", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "writer-1",
			organizationId: "org-1",
			roles: ["writer"],
		});

		const result = await applyRfpAmendmentSupersession({
			amendmentDocumentId: "00000000-0000-4000-8000-000000000701",
			targetDocumentId: "00000000-0000-4000-8000-000000000702",
			impactMode: "supersede",
			reason: "Amendment changes staffing submission instructions",
		});

		expect(result).toMatchObject({
			success: false,
			amendmentDocumentId: "00000000-0000-4000-8000-000000000701",
			targetDocumentId: "00000000-0000-4000-8000-000000000702",
			impactMode: "supersede",
			impactedRequirementIds: [],
			error: "Applying RFP amendment impact requires proposal or capture authority: requires proposal_manager or capture_manager",
		});
		expect(dbMock.transaction).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).not.toHaveBeenCalled();
	});

	it("applies amendment supersession and projects impact review work", async () => {
		const amendmentDocument = {
			...documentRow,
			id: "00000000-0000-4000-8000-000000000701",
			filename: "amendment-01.pdf",
			opportunityId: documentRow.opportunityId,
			metadata: null,
		};
		const targetDocument = {
			...documentRow,
			id: "00000000-0000-4000-8000-000000000702",
			filename: "base-rfp.pdf",
			opportunityId: documentRow.opportunityId,
			metadata: null,
		};
		const impactedRequirement = {
			id: "00000000-0000-4000-8000-000000000801",
			rfpDocumentId: targetDocument.id,
			opportunityId: documentRow.opportunityId,
			requirementNumber: "REQ-001",
			title: "Staffing plan",
			requirementText: "Submit a staffing plan.",
			sourceQuote: "Staffing plan required.",
			sourcePage: 4,
			sourceSection: "L.4",
			category: "management",
			subcategory: null,
			requirementType: "shall",
			priority: "mandatory",
			riskLevel: "high",
			evaluationWeight: null,
			extractionConfidence: 90,
			aiAnalysis: null,
			isImplicit: false,
			ambiguityLevel: null,
			clarificationQuestions: [],
			relatedRequirements: [],
			keyTerms: [],
			suggestedApproach: null,
			embedding: null,
			complianceStatus: "compliant",
			responseStrategy: null,
			assignedTo: "writer-1",
			dueDate: new Date("2026-05-15T00:00:00.000Z"),
			responseDocumentId: null,
			responseSection: null,
			notes: null,
			tags: [],
			metadata: {
				workflow: {
					state: "accepted",
					history: [],
				},
			},
			createdAt: new Date("2026-04-01T00:00:00.000Z"),
			updatedAt: new Date("2026-04-01T00:00:00.000Z"),
		};
		const updates: Record<string, unknown>[] = [];

		dbMock.query.rfpDocuments.findFirst
			.mockResolvedValueOnce(amendmentDocument)
			.mockResolvedValueOnce(targetDocument);
		dbMock.select.mockReturnValueOnce(createChain({ result: [impactedRequirement] }));
		dbMock.update.mockReturnValue(createChain({
			onSet: (value) => {
				updates.push(value);
			},
		}));

		const result = await applyRfpAmendmentSupersession({
			amendmentDocumentId: amendmentDocument.id,
			targetDocumentId: targetDocument.id,
			impactMode: "supersede",
			reason: "Amendment changes staffing submission instructions",
		});

		expect(result.error).toBeUndefined();
		expect(result).toMatchObject({
			success: true,
			amendmentDocumentId: amendmentDocument.id,
			targetDocumentId: targetDocument.id,
			impactMode: "supersede",
			impactedRequirementIds: [impactedRequirement.id],
			workflowInstanceId: "00000000-0000-4000-8000-000000000901",
		});
		expect(updates[0]).toMatchObject({
			complianceStatus: "partial",
			metadata: {
				workflow: expect.objectContaining({
					state: "review",
				}),
				amendmentImpact: expect.objectContaining({
					state: "impact_review",
					impactMode: "supersede",
					previousWorkflowState: "accepted",
					previousComplianceStatus: "compliant",
				}),
			},
		});
		expect(updates[1]).toMatchObject({
			metadata: {
				documentRole: "amendment",
				amendmentWorkflow: expect.objectContaining({
					state: "impact_review",
					targetDocumentId: targetDocument.id,
					impactedRequirementIds: [impactedRequirement.id],
				}),
			},
		});
		expect(updates[2]).toMatchObject({
			metadata: {
				supersession: expect.objectContaining({
					state: "superseded_by_amendment",
					amendmentDocumentId: amendmentDocument.id,
					impactedRequirementCount: 1,
				}),
			},
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "rfp_amendment_supersession",
				subjectType: "rfp_document",
				subjectId: amendmentDocument.id,
				toState: "impact_review",
				priority: "critical",
			}),
			dbMock
		);
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: `rfp-amendment-impact:${amendmentDocument.id}`,
				state: "open",
				priority: "critical",
				metadata: expect.objectContaining({
					impactedRequirementIds: [impactedRequirement.id],
				}),
			}),
			dbMock
		);
	});
});
