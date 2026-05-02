import { beforeEach, describe, expect, it, vi } from "vitest";

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.values = vi.fn((value: unknown) => {
		config.onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	execute: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		execute: vi.fn(),
	},
}));

import {
	assertWorkflowAuthority,
	evaluateWorkflowSla,
	getWorkflowDashboard,
	listPortalWorkflowItems,
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("workflow runtime", () => {
	it("creates a durable workflow instance, audit event, and notification", async () => {
		const createdInstance = {
			id: "workflow-1",
			workflowKey: "requirement_acceptance",
			subjectType: "requirement",
			subjectId: "req-1",
			status: "active",
			state: "accepted",
			priority: "high",
			assignedTo: "writer-1",
			dueAt: new Date("2026-05-10T00:00:00.000Z"),
		};
		let instanceInsert: unknown;
		let auditInsert: unknown;
		let notificationInsert: unknown;

		dbMock.select.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [createdInstance],
				onValues: (value) => {
					instanceInsert = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					auditInsert = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					notificationInsert = value;
				},
			}));

		const result = await recordWorkflowRuntimeTransition({
			workflowKey: "requirement_acceptance",
			subjectType: "requirement",
			subjectId: "req-1",
			opportunityId: "00000000-0000-4000-8000-000000000001",
			fromState: "review",
			toState: "accepted",
			eventType: "requirement_accept",
			actorId: "pm-1",
			reason: "Ready",
			priority: "high",
			assignedTo: "writer-1",
			dueAt: "2026-05-10",
			notificationRecipients: ["writer-1"],
			terminal: false,
		});

		expect(result.id).toBe("workflow-1");
		expect(instanceInsert).toMatchObject({
			workflowKey: "requirement_acceptance",
			subjectType: "requirement",
			subjectId: "req-1",
			status: "active",
			state: "accepted",
			assignedTo: "writer-1",
		});
		expect(auditInsert).toMatchObject({
			workflowInstanceId: "workflow-1",
			eventType: "requirement_accept",
			fromState: "review",
			toState: "accepted",
			actorId: "pm-1",
			reason: "Ready",
		});
		expect(notificationInsert).toEqual([
			expect.objectContaining({
				workflowInstanceId: "workflow-1",
				recipientId: "writer-1",
				eventType: "requirement_accept",
			}),
		]);
	});

	it("updates existing runtime tasks instead of duplicating them", async () => {
		let taskPatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: "runtime-task-1",
				workflowInstanceId: "workflow-1",
				taskKey: "gap:req-1",
				state: "open",
				metadata: { previous: true },
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ id: "runtime-task-1" }],
			onSet: (value) => {
				taskPatch = value;
			},
		}));

		await upsertWorkflowRuntimeTask({
			workflowInstanceId: "workflow-1",
			taskKey: "gap:req-1",
			title: "Resolve gap",
			state: "completed",
			metadata: { closedBy: "qa" },
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(taskPatch).toMatchObject({
			title: "Resolve gap",
			state: "completed",
			metadata: { previous: true, closedBy: "qa" },
		});
		expect(taskPatch?.completedAt).toBeInstanceOf(Date);
	});

	it("marks overdue active workflows as escalated and writes audit evidence", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: "workflow-1",
				subjectType: "rfp_parse",
				subjectId: "rfp-1",
				status: "active",
				state: "manual_extraction",
				dueAt: new Date("2026-05-01T00:00:00.000Z"),
				authorityPolicy: { escalationRole: "operations_lead" },
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({ result: [{ id: "workflow-1" }] }));
		dbMock.insert.mockReturnValueOnce(createChain());

		const result = await evaluateWorkflowSla({
			now: new Date("2026-05-02T00:00:00.000Z"),
		});

		expect(result).toEqual({ breached: 1, escalated: 1 });
		expect(dbMock.update).toHaveBeenCalledTimes(1);
		expect(dbMock.insert).toHaveBeenCalledTimes(1);
	});

	it("summarizes dashboard and portal-visible workflows", async () => {
		const rows = [
			{
				id: "workflow-1",
				subjectType: "requirement",
				status: "active",
				dueAt: new Date(Date.now() + 60 * 60 * 1000),
				updatedAt: new Date(),
			},
			{
				id: "workflow-2",
				subjectType: "compliance_entry",
				status: "breached",
				dueAt: new Date("2026-05-01T00:00:00.000Z"),
				updatedAt: new Date(),
			},
		];
		dbMock.select.mockReturnValueOnce(createChain({ result: rows }));

		const dashboard = await getWorkflowDashboard();

		expect(dashboard.total).toBe(2);
		expect(dashboard.active).toBe(1);
		expect(dashboard.breached).toBe(1);
		expect(dashboard.bySubjectType).toEqual({ requirement: 1, compliance_entry: 1 });
		expect(dashboard.dueSoon).toHaveLength(1);

		dbMock.select.mockReturnValueOnce(createChain({
			result: [
				{ id: "portal-1", portalVisibility: { visibleToPortal: true, portalRole: "partner" } },
				{ id: "portal-2", portalVisibility: { visibleToPortal: true, portalRole: "reviewer" } },
			],
		}));

		const portalItems = await listPortalWorkflowItems({ portalRole: "partner" });
		expect(portalItems).toHaveLength(1);
		expect(portalItems[0].id).toBe("portal-1");
	});

	it("enforces role-based workflow authority", async () => {
		await expect(assertWorkflowAuthority({
			actorId: "writer-1",
			actorRoles: ["writer"],
			policy: { requiredRoles: ["executive"] },
			action: "approve",
		})).rejects.toThrow("requires executive");

		await expect(assertWorkflowAuthority({
			actorId: "exec-1",
			actorRoles: ["writer"],
			policy: { allowedActorIds: ["exec-1"], requiredRoles: ["executive"] },
			action: "approve",
		})).resolves.toBeUndefined();
	});
});
