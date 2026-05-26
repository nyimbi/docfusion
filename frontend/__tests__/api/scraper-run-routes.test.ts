import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";

const authMock = vi.hoisted(() => vi.fn());
const startScraperSourceRunWorkflowMock = vi.hoisted(() => vi.fn());
const cancelScraperJobWorkflowMock = vi.hoisted(() => vi.fn());
const scraperQueueMock = vi.hoisted(() => ({
	getAllJobs: vi.fn(),
	getStats: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/scrapers/queue", () => ({ scraperQueue: scraperQueueMock }));
vi.mock("@/lib/actions/scraper-workflows", () => ({
	startScraperSourceRunWorkflow: startScraperSourceRunWorkflowMock,
	cancelScraperJobWorkflow: cancelScraperJobWorkflowMock,
}));

import { POST as runPOST } from "@/app/api/scrapers/run/route";
import { POST as cancelPOST } from "@/app/api/scrapers/run/[runId]/cancel/route";

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({
		user: { id: "scraper-operator-1", role: "scraper_operator" },
	});
	startScraperSourceRunWorkflowMock.mockResolvedValue({
		success: true,
		sourceId: "source-1",
		jobId: "job-1",
		state: "queued",
	});
	cancelScraperJobWorkflowMock.mockResolvedValue({
		success: true,
		jobId: "job-1",
	});
});

describe("scraper run routes", () => {
	it("returns 403 when manual run workflow authority is denied", async () => {
		startScraperSourceRunWorkflowMock.mockRejectedValueOnce(new WorkflowAuthorityDeniedError({
			action: "scraper source workflow",
			requiredRoles: ["operations", "admin"],
		}));

		const response = await runPOST(new NextRequest("https://app.test/api/scrapers/run", {
			method: "POST",
			body: JSON.stringify({ sourceId: "source-1" }),
			headers: { "content-type": "application/json" },
		}));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ success: false, message: "Forbidden" });
	});

	it("returns 403 when cancel workflow authority is denied", async () => {
		cancelScraperJobWorkflowMock.mockRejectedValueOnce(new WorkflowAuthorityDeniedError({
			action: "scraper source workflow",
			requiredRoles: ["operations", "admin"],
		}));

		const response = await cancelPOST(
			new NextRequest("https://app.test/api/scrapers/run/job-1/cancel", { method: "POST" }),
			{ params: Promise.resolve({ runId: "job-1" }) }
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ success: false, message: "Forbidden" });
	});
});
