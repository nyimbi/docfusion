import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

const requireServerSessionMock = vi.hoisted(() => vi.fn(async () => ({
	user: { id: "ops-user", role: "operations" as string | undefined, roles: undefined as string[] | undefined },
})));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: requireServerSessionMock,
}));

const workflowRuntimeMock = vi.hoisted(() => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({
		id: "00000000-0000-4000-8000-00000000wf01",
	})),
	upsertWorkflowRuntimeTask: vi.fn(async () => undefined),
}));

vi.mock("@/lib/actions/workflow-runtime", () => workflowRuntimeMock);

const scraperQueueMock = vi.hoisted(() => ({
	add: vi.fn(async () => "00000000-0000-4000-8000-00000000job1"),
	cancel: vi.fn(async () => true),
}));

const scraperRuntimeMock = vi.hoisted(() => ({
	cancel: vi.fn(() => false),
}));

vi.mock("@/lib/scrapers/queue", () => ({
	scraperQueue: scraperQueueMock,
}));

vi.mock("@/lib/scrapers/runtime", () => ({
	initializeScraperQueue: vi.fn(),
	scraperRuntime: scraperRuntimeMock,
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["where", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

const sourceRow = {
	id: "00000000-0000-4000-8000-000000000101",
	sourceId: "world-bank",
	name: "World Bank",
	url: "https://example.test",
	sourceType: "mdb",
	scheduleTier: 1,
	priority: 1,
	enabled: true,
	healthStatus: "healthy",
};

const activeJobRow = {
	id: "00000000-0000-4000-8000-000000000201",
	sourceId: sourceRow.id,
	sourceKey: sourceRow.sourceId,
	sourceName: sourceRow.name,
	status: "running",
	priority: 1,
	tier: 1,
};

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		query: {
			scraperSources: {
				findFirst: vi.fn(),
			},
			scraperJobs: {
				findFirst: vi.fn(),
			},
		},
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import {
	cancelScraperJobWorkflow,
	evaluateScraperSourceHealthWorkflow,
	startScraperSourceRunWorkflow,
	transitionScraperSourceEnabledWorkflow,
} from "@/lib/actions/scraper-workflows";

beforeEach(() => {
	vi.clearAllMocks();
	requireServerSessionMock.mockResolvedValue({ user: { id: "ops-user", role: "operations", roles: undefined } });
	dbMock.query.scraperSources.findFirst.mockResolvedValue(sourceRow);
	dbMock.query.scraperJobs.findFirst.mockResolvedValue(null);
	dbMock.update.mockReturnValue(createChain());
	scraperQueueMock.add.mockResolvedValue("00000000-0000-4000-8000-00000000job1");
	scraperQueueMock.cancel.mockResolvedValue(true);
	scraperRuntimeMock.cancel.mockReturnValue(false);
});

describe("scraper source workflows", () => {
	it("rejects unauthenticated workflow actions before database access", async () => {
		requireServerSessionMock.mockRejectedValue(new Error("Unauthorized"));

		await expect(startScraperSourceRunWorkflow(sourceRow.id)).rejects.toThrow("Unauthorized");
		await expect(transitionScraperSourceEnabledWorkflow(sourceRow.id, false)).rejects.toThrow("Unauthorized");
		await expect(cancelScraperJobWorkflow(activeJobRow.id)).rejects.toThrow("Unauthorized");
		await expect(evaluateScraperSourceHealthWorkflow(sourceRow.id)).rejects.toThrow("Unauthorized");

		expect(dbMock.query.scraperSources.findFirst).not.toHaveBeenCalled();
		expect(dbMock.query.scraperJobs.findFirst).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(scraperQueueMock.add).not.toHaveBeenCalled();
		expect(scraperQueueMock.cancel).not.toHaveBeenCalled();
	});

	it("rejects non-control-plane roles before workflow side effects", async () => {
		requireServerSessionMock.mockResolvedValue({ user: { id: "writer-1", role: "writer", roles: ["writer"] } });

		await expect(startScraperSourceRunWorkflow(sourceRow.id)).rejects.toThrow("requires operations or admin");
		await expect(transitionScraperSourceEnabledWorkflow(sourceRow.id, true)).rejects.toThrow("requires operations or admin");

		expect(dbMock.query.scraperSources.findFirst).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
		expect(scraperQueueMock.add).not.toHaveBeenCalled();
	});

	it("allows sessions with an admin role in the roles array", async () => {
		requireServerSessionMock.mockResolvedValue({ user: { id: "admin-1", role: undefined, roles: ["admin"] } });

		const result = await startScraperSourceRunWorkflow(sourceRow.id, {
			reason: "Admin test run",
		});

		expect(result).toMatchObject({ success: true, state: "queued" });
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: "admin-1",
				authorityPolicy: expect.objectContaining({
					requiredRoles: ["operations", "admin"],
				}),
			})
		);
	});

	it("queues enabled source runs and projects a monitor task", async () => {
		const result = await startScraperSourceRunWorkflow(sourceRow.id, {
			reason: "Operator test run",
		});

		expect(result).toMatchObject({
			success: true,
			sourceId: sourceRow.id,
			jobId: "00000000-0000-4000-8000-00000000job1",
			state: "queued",
		});
		expect(scraperQueueMock.add).toHaveBeenCalledWith(expect.objectContaining({
			sourceId: sourceRow.id,
			sourceKey: sourceRow.sourceId,
			sourceName: sourceRow.name,
			priority: 1,
			tier: 1,
		}));
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "scraper_source_run",
				subjectType: "scraper_source",
				subjectId: sourceRow.id,
				toState: "queued",
				eventType: "scraper_source_queued",
				actorId: "ops-user",
				authorityPolicy: expect.objectContaining({
					requiredRoles: ["operations", "admin"],
				}),
			})
		);
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "monitor-scraper-run:00000000-0000-4000-8000-00000000job1",
				state: "open",
				assignedRole: "operations",
			})
		);
	});

	it("blocks disabled source runs with terminal workflow audit", async () => {
		dbMock.query.scraperSources.findFirst.mockResolvedValue({
			...sourceRow,
			enabled: false,
			healthStatus: "disabled",
		});

		const result = await startScraperSourceRunWorkflow(sourceRow.id);

		expect(result).toMatchObject({
			success: false,
			state: "blocked_disabled",
			error: "Source is disabled",
		});
		expect(scraperQueueMock.add).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "blocked_disabled",
				terminal: true,
			})
		);
	});

	it("creates duplicate active run review tasks instead of queuing twice", async () => {
		dbMock.query.scraperJobs.findFirst.mockResolvedValue(activeJobRow);

		const result = await startScraperSourceRunWorkflow(sourceRow.id);

		expect(result).toMatchObject({
			success: false,
			jobId: activeJobRow.id,
			state: "duplicate_active",
		});
		expect(scraperQueueMock.add).not.toHaveBeenCalled();
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: `scraper-duplicate-review:${sourceRow.id}`,
				state: "open",
				assignedRole: "operations",
				metadata: expect.objectContaining({
					activeJobId: activeJobRow.id,
				}),
			})
		);
	});

	it("records source enablement governance transitions", async () => {
		const updatedSource = {
			...sourceRow,
			enabled: false,
			healthStatus: "disabled",
		};
		let updatePayload: Record<string, unknown> | undefined;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [updatedSource],
			onSet: (value) => {
				updatePayload = value;
			},
		}));

		const result = await transitionScraperSourceEnabledWorkflow(
			sourceRow.id,
			false,
			"Disable noisy source"
		);

		expect(result).toMatchObject({ success: true, source: updatedSource });
		expect(updatePayload).toMatchObject({
			enabled: false,
			healthStatus: "disabled",
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "scraper_source_governance",
				fromState: "enabled",
				toState: "disabled",
				reason: "Disable noisy source",
				terminal: true,
			})
		);
	});

	it("records terminal scraper job cancellation transitions", async () => {
		dbMock.query.scraperJobs.findFirst.mockResolvedValue(activeJobRow);

		const result = await cancelScraperJobWorkflow(activeJobRow.id, "Cancel stale job");

		expect(result).toMatchObject({ success: true, jobId: activeJobRow.id });
		expect(scraperQueueMock.cancel).toHaveBeenCalledWith(activeJobRow.id);
		expect(scraperRuntimeMock.cancel).toHaveBeenCalledWith(activeJobRow.id);
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "scraper_source_run",
				subjectType: "scraper_job",
				subjectId: activeJobRow.id,
				fromState: "running",
				toState: "cancelled",
				eventType: "scraper_job_cancelled",
				terminal: true,
			})
		);
	});

	it("projects stale source freshness remediation tasks", async () => {
		const now = new Date("2026-05-05T13:10:00.000Z");
		const staleSource = {
			...sourceRow,
			lastRunAt: new Date("2026-05-03T00:00:00.000Z"),
			lastSuccessAt: new Date("2026-05-03T00:00:00.000Z"),
			failedRuns: 0,
			successRate: 95,
			dataQualityScore: 85,
		};
		let updatePayload: Record<string, unknown> | undefined;
		dbMock.query.scraperSources.findFirst.mockResolvedValue(staleSource);
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...staleSource, healthStatus: "degraded" }],
			onSet: (value) => {
				updatePayload = value;
			},
		}));

		const result = await evaluateScraperSourceHealthWorkflow(staleSource.id, { now });

		expect(result).toMatchObject({
			success: true,
			sourceId: staleSource.id,
			state: "stale",
		});
		expect(updatePayload).toMatchObject({
			healthStatus: "degraded",
			updatedAt: now,
		});
		expect(workflowRuntimeMock.recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "scraper_source_health",
				subjectType: "scraper_source",
				toState: "stale",
				eventType: "scraper_source_health_stale",
				priority: "critical",
				assignedRole: "operations",
				metadata: expect.objectContaining({
					freshnessSlaHours: 8,
					sourceHealthStatus: "degraded",
				}),
			})
		);
		expect(workflowRuntimeMock.upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: `scraper-source-health:${staleSource.id}`,
				state: "open",
				assignedRole: "operations",
				metadata: expect.objectContaining({
					workflowState: "stale",
				}),
			})
		);
	});
});
