import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/rfp-parser", () => ({
	transitionRfpParseWorkflow: vi.fn(),
}));

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "leftJoin", "where", "orderBy", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { transitionRfpParseWorkflow } from "@/lib/actions/rfp-parser";
import {
	listOperationalExceptions,
	remediateOperationalException,
} from "@/lib/actions/operational-exceptions";

const rfpRow = {
	document: {
		id: "rfp-1",
		filename: "solicitation.pdf",
		parsingError: "OCR failed",
		parsingProgress: 45,
		opportunityId: "opp-1",
		uploadedBy: "proposal-lead",
		createdAt: new Date("2026-04-01T08:00:00.000Z"),
		updatedAt: new Date("2026-04-01T10:00:00.000Z"),
		metadata: {
			parseWorkflow: {
				state: "failed",
			},
		},
	},
	job: {
		id: "job-1",
		currentStep: "Extract text",
		errorMessage: "Tesseract timeout",
	},
};

const scraperRow = {
	run: {
		id: "run-db-1",
		runId: "ungm_20260401",
		sourceKey: "ungm",
		status: "failed",
		startedAt: new Date("2026-04-01T09:00:00.000Z"),
		completedAt: new Date("2026-04-01T11:00:00.000Z"),
		errorMessage: "HTTP 503",
		errorType: "http",
		opportunitiesFailed: 3,
		progress: 80,
	},
	source: {
		sourceId: "ungm",
		name: "UNGM",
	},
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("operational exception queue", () => {
	it("normalizes failed RFP parses and scraper runs into one queue", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [rfpRow] }))
			.mockReturnValueOnce(createChain({ result: [scraperRow] }));

		const exceptions = await listOperationalExceptions();

		expect(exceptions).toHaveLength(2);
		expect(exceptions[0]).toMatchObject({
			id: "scraper_run:run-db-1",
			subjectType: "scraper_run",
			subjectId: "run-db-1",
			title: "Scraper failed: UNGM",
			severity: "high",
			status: "open",
			lastError: "HTTP 503",
			ownerHint: "ungm",
			workflowActionHint: ["inspect_source", "rerun_source", "disable_source"],
		});
		expect(exceptions[1]).toMatchObject({
			id: "rfp_parse:rfp-1",
			subjectType: "rfp_parse",
			subjectId: "rfp-1",
			title: "RFP parse failed: solicitation.pdf",
			severity: "high",
			status: "open",
			lastError: "OCR failed",
			ownerHint: "proposal-lead",
			workflowActionHint: ["retry", "manual_extraction", "reject"],
			metadata: {
				jobId: "job-1",
				progress: 45,
				currentStep: "Extract text",
				opportunityId: "opp-1",
			},
		});
	});

	it("supports subject filters for the RFP parse queue", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [rfpRow] }));

		const exceptions = await listOperationalExceptions({
			subjectTypes: ["rfp_parse"],
		});

		expect(exceptions).toHaveLength(1);
		expect(exceptions[0].subjectType).toBe("rfp_parse");
		expect(dbMock.select).toHaveBeenCalledTimes(1);
	});

	it("routes RFP parse remediation through the parse workflow", async () => {
		vi.mocked(transitionRfpParseWorkflow).mockResolvedValueOnce({
			rfpDocumentId: "rfp-1",
			state: "queued",
			progress: 0,
		});

		await remediateOperationalException({
			subjectType: "rfp_parse",
			subjectId: "rfp-1",
			action: "retry",
			reason: "OCR profile fixed",
		});

		expect(transitionRfpParseWorkflow).toHaveBeenCalledWith({
			rfpDocumentId: "rfp-1",
			action: "retry",
			reason: "OCR profile fixed",
			startProcessing: true,
		});
	});

	it("blocks unsupported remediation subjects in the pilot", async () => {
		await expect(
			remediateOperationalException({
				subjectType: "scraper_run",
				subjectId: "run-db-1",
				action: "retry",
				reason: "Run source again",
			})
		).rejects.toThrow("Only RFP parse exceptions support remediation");
	});
});
