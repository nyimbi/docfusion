import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: vi.fn(async () => "capture-lead"),
}));

vi.mock("@/lib/ai/rfp-parser", () => ({
	parseRFPWithAI: vi.fn(),
	batchExtractRequirements: vi.fn(),
}));

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

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["where", "orderBy", "limit"]) {
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
	getRfpParseLifecycle,
	reviewRfpParseConfidence,
	transitionRfpParseWorkflow,
} from "@/lib/actions/rfp-parser";

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.query.rfpDocuments.findFirst.mockResolvedValue(documentRow);
	dbMock.query.rfpParsingJobs.findFirst.mockResolvedValue(latestJob);
	dbMock.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock));
	dbMock.execute.mockResolvedValue([]);
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
});
