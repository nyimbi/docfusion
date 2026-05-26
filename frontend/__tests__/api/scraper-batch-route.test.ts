import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";

function createSelectChain(result: unknown[]) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

function createDeleteChain() {
	const chain: Record<string, any> = {};
	chain.where = vi.fn(() => chain);
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve([]).then(resolve);
	return chain;
}

const authMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	delete: vi.fn(),
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());
const startScraperSourceRunWorkflowMock = vi.hoisted(() => vi.fn());
const transitionScraperSourceEnabledWorkflowMock = vi.hoisted(() => vi.fn());
const scraperQueueMock = vi.hoisted(() => ({
	getBatchJobs: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/scrapers/queue", () => ({ scraperQueue: scraperQueueMock }));
vi.mock("@/lib/actions/scraper-workflows", () => ({
	startScraperSourceRunWorkflow: startScraperSourceRunWorkflowMock,
	transitionScraperSourceEnabledWorkflow: transitionScraperSourceEnabledWorkflowMock,
}));

import { POST } from "@/app/api/scrapers/batch/route";

function batchRequest(body: unknown) {
	return new NextRequest("https://app.test/api/scrapers/batch", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReturnValue(createSelectChain([{ id: "source-1" }]));
	dbMock.delete.mockReturnValue(createDeleteChain());
	transitionScraperSourceEnabledWorkflowMock.mockResolvedValue({ success: true });
	startScraperSourceRunWorkflowMock.mockResolvedValue({
		success: true,
		sourceId: "source-1",
		jobId: "job-1",
	});
	authMock.mockResolvedValue({
		user: { id: "scraper-operator-1", role: "scraper_operator" },
	});
});

describe("scraper batch route", () => {
	it("returns 403 when a workflow authority denial reaches a bulk operation", async () => {
		transitionScraperSourceEnabledWorkflowMock.mockRejectedValueOnce(new WorkflowAuthorityDeniedError({
			action: "scraper source workflow",
			requiredRoles: ["operations", "admin"],
		}));

		const response = await POST(batchRequest({
			operation: "enable",
			sourceIds: ["source-1"],
		}));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ success: false, message: "Forbidden" });
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("keeps non-authority source failures in the batch result body", async () => {
		transitionScraperSourceEnabledWorkflowMock.mockRejectedValueOnce(new Error("Source lock timeout"));

		const response = await POST(batchRequest({
			operation: "disable",
			sourceIds: ["source-1"],
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: false,
			results: [
				{
					sourceId: "source-1",
					success: false,
					error: "Source lock timeout",
				},
			],
			summary: { succeeded: 0, failed: 1 },
		});
		expect(revalidatePathMock).toHaveBeenCalledWith("/opportunities/sources");
	});

	it("requires operations authority before deleting scraper sources", async () => {
		const response = await POST(batchRequest({
			operation: "delete",
			sourceIds: ["source-1"],
		}));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ success: false, message: "Forbidden" });
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("allows operations users to delete scraper sources", async () => {
		authMock.mockResolvedValue({
			user: { id: "ops-1", role: "operations" },
		});

		const response = await POST(batchRequest({
			operation: "delete",
			sourceIds: ["source-1"],
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			results: [{ sourceId: "source-1", success: true }],
			summary: { succeeded: 1, failed: 0 },
		});
		expect(dbMock.delete).toHaveBeenCalledTimes(1);
		expect(revalidatePathMock).toHaveBeenCalledWith("/opportunities/sources");
	});
});
