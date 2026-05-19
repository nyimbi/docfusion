import { beforeEach, describe, expect, it, vi } from "vitest";

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit", "orderBy", "innerJoin"]) {
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
	createWorkflowTemplateDraft,
	deprecateWorkflowTemplate,
	deliverWorkflowNotifications,
	publishWorkflowTemplate,
	recordWorkflowRuntimeTransition,
	reverseWorkflowRuntimeState,
	rollbackWorkflowTemplate,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";
import { WORKFLOW_TEMPLATE_CATALOG } from "@/lib/workflows/default-templates";
import { simulateWorkflowTemplate } from "@/lib/workflows/simulation";
import type { WorkflowViewerScope } from "@/lib/workflows/viewer-scope";

const adminWorkflowScope: WorkflowViewerScope = {
	userId: "admin-1",
	roles: ["admin"],
	portalRoles: [],
	isGlobalWorkflowViewer: true,
};

beforeEach(() => {
	vi.resetAllMocks();
});

describe("workflow runtime", () => {
	it("creates a durable workflow instance, audit event, and notification", async () => {
		const futureDueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const createdInstance = {
			id: "workflow-1",
			workflowKey: "requirement_acceptance",
			subjectType: "requirement",
			subjectId: "req-1",
			status: "active",
			state: "accepted",
			priority: "high",
			assignedTo: "writer-1",
			dueAt: futureDueAt,
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
			dueAt: futureDueAt.toISOString(),
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

		const dashboard = await getWorkflowDashboard(adminWorkflowScope);

		expect(dashboard.total).toBe(2);
		expect(dashboard.items).toHaveLength(2);
		expect(dashboard.active).toBe(1);
		expect(dashboard.breached).toBe(1);
		expect(dashboard.bySubjectType).toEqual({ requirement: 1, compliance_entry: 1 });
		expect(dashboard.dueSoon).toHaveLength(1);

		dbMock.select.mockReturnValueOnce(createChain({
			result: [
				{ id: "workflow-1", subjectType: "requirement", status: "active", updatedAt: new Date() },
				{ id: "workflow-2", subjectType: "requirement", status: "active", updatedAt: new Date() },
				{ id: "workflow-3", subjectType: "proposal_task", status: "completed", updatedAt: new Date() },
			],
		}));

		const pagedDashboard = await getWorkflowDashboard(adminWorkflowScope, { limit: 1 });
		expect(pagedDashboard.total).toBe(3);
		expect(pagedDashboard.completed).toBe(1);
		expect(pagedDashboard.items).toHaveLength(1);

		dbMock.select.mockReturnValueOnce(createChain({
			result: [
				{ id: "portal-1", portalVisibility: { visibleToPortal: true, portalRole: "partner" } },
				{ id: "portal-2", portalVisibility: { visibleToPortal: true, portalRole: "reviewer" } },
			],
		}));

		const portalItems = await listPortalWorkflowItems(adminWorkflowScope, { portalRole: "partner" });
		expect(portalItems).toHaveLength(1);
		expect(portalItems[0].id).toBe("portal-1");
	});

	it("fails closed without scope and prevents portal role escalation", async () => {
		await expect(getWorkflowDashboard(undefined as unknown as WorkflowViewerScope))
			.rejects.toThrow("Workflow viewer scope is required");

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [
					{
						id: "portal-1",
						assignedTo: "partner-1",
						portalVisibility: { visibleToPortal: true, portalRole: "partner" },
					},
					{
						id: "portal-2",
						assignedTo: "partner-1",
						portalVisibility: { visibleToPortal: true, portalRole: "reviewer" },
					},
				],
			}));

		const scoped = await listPortalWorkflowItems({
			userId: "partner-1",
			roles: ["partner"],
			portalRoles: ["partner"],
			isGlobalWorkflowViewer: false,
		}, { portalRole: "reviewer" });

		expect(scoped).toHaveLength(1);
		expect(scoped[0].id).toBe("portal-1");
	});

	it("does not expose role-assigned rows without a concrete actor or opportunity link", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [] }));

		const dashboard = await getWorkflowDashboard({
			userId: "reviewer-1",
			roles: ["reviewer"],
			portalRoles: ["reviewer"],
			isGlobalWorkflowViewer: false,
		});

		expect(dashboard.total).toBe(0);
	});

	it("allows non-global workflow visibility through linked opportunity assignment", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: "00000000-0000-4000-8000-000000000777" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [
					{
						id: "workflow-opportunity",
						subjectType: "requirement",
						subjectId: "req-1",
						status: "active",
						assignedRole: "reviewer",
						assignedTo: null,
						opportunityId: "00000000-0000-4000-8000-000000000777",
						authorityPolicy: null,
						updatedAt: new Date(),
					},
				],
			}));

		const dashboard = await getWorkflowDashboard({
			userId: "owner-1",
			roles: ["reviewer"],
			portalRoles: ["reviewer"],
			isGlobalWorkflowViewer: false,
		});

		expect(dashboard.total).toBe(1);
		expect(dashboard.items[0].id).toBe("workflow-opportunity");
	});

	it("enforces role-based workflow authority", async () => {
		let denial: unknown;
		try {
			await assertWorkflowAuthority({
				actorId: "writer-1",
				actorRoles: ["writer"],
				policy: { requiredRoles: ["executive"] },
				action: "approve",
			});
			throw new Error("Expected authority denial");
		} catch (error) {
			denial = error;
		}
		expect(denial).toBeInstanceOf(WorkflowAuthorityDeniedError);
		expect(denial).toMatchObject({
			kind: "workflow_authority_denied",
			action: "approve",
			requiredRoles: ["executive"],
		});

		await expect(assertWorkflowAuthority({
			actorId: "exec-1",
			actorRoles: ["writer"],
			policy: { allowedActorIds: ["exec-1"], requiredRoles: ["executive"] },
			action: "approve",
		})).resolves.toBeUndefined();
	});

	it("records workflow reversals and cancels open runtime tasks", async () => {
		const existing = {
			id: "workflow-1",
			subjectType: "compliance_entry",
			subjectId: "entry-1",
			state: "escalated",
			status: "escalated",
			visibility: "portal",
			portalVisibility: { visibleToPortal: true, portalRole: "partner" },
			metadata: { source: "sla" },
		};
		const updated = { ...existing, state: "cancelled", status: "cancelled" };
		let instancePatch: Record<string, unknown> | undefined;
		let auditInsert: Record<string, unknown> | undefined;
		let taskPatch: Record<string, unknown> | undefined;

		dbMock.select.mockReturnValueOnce(createChain({ result: [existing] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [updated],
				onSet: (value) => {
					instancePatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					taskPatch = value;
				},
			}));
		dbMock.insert.mockReturnValueOnce(createChain({
			onValues: (value) => {
				auditInsert = value as Record<string, unknown>;
			},
		}));

		const result = await reverseWorkflowRuntimeState({
			workflowInstanceId: "workflow-1",
			action: "cancel",
			actorId: "ops-1",
			authorityChecked: true,
			reason: "Duplicate exception",
			visibility: "internal",
			portalVisibility: null,
		});

		expect(result).toEqual(updated);
		expect(instancePatch).toMatchObject({
			state: "cancelled",
			status: "cancelled",
			visibility: "internal",
			portalVisibility: null,
		});
		expect(auditInsert).toMatchObject({
			workflowInstanceId: "workflow-1",
			eventType: "workflow_cancel",
			fromState: "escalated",
			toState: "cancelled",
			actorId: "ops-1",
			reason: "Duplicate exception",
		});
		expect(taskPatch).toMatchObject({ state: "cancelled" });
	});

	it("simulates, drafts, and publishes workflow templates with version governance", async () => {
		const templateInput = {
			templateKey: "evidence_gate",
			name: "Evidence Gate",
			subjectType: "evidence_claim",
			states: ["draft", "review", "approved"],
			transitions: [
				{ action: "submit", from: ["draft"], to: "review" },
				{ action: "approve", from: ["review"], to: "approved", requiredRoles: ["approver"] },
			],
		};
		const simulation = simulateWorkflowTemplate(templateInput);
		expect(simulation).toMatchObject({
			valid: true,
			reachableStates: ["draft", "review", "approved"],
			terminalStates: ["approved"],
		});

		let draftInsert: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [{ version: 2 }] }));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [{ id: "template-3", version: 3, status: "draft" }],
			onValues: (value) => {
				draftInsert = value as Record<string, unknown>;
			},
		}));

		await expect(createWorkflowTemplateDraft(templateInput, "admin-1")).resolves.toMatchObject({
			id: "template-3",
			version: 3,
			status: "draft",
		});
		expect(draftInsert).toMatchObject({
			templateKey: "evidence_gate",
			version: 3,
			status: "draft",
			createdBy: "admin-1",
		});

		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: "template-3",
				templateKey: "evidence_gate",
				name: "Evidence Gate",
				subjectType: "evidence_claim",
				version: 3,
				status: "draft",
				states: templateInput.states,
				transitions: templateInput.transitions,
				metadata: {},
			}],
		}));
		dbMock.update
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain({
				result: [{ id: "template-3", status: "active" }],
			}));

		await expect(publishWorkflowTemplate("template-3", "admin-1")).resolves.toMatchObject({
			id: "template-3",
			status: "active",
		});
	});

	it("deprecates and rolls back workflow templates through governance actions", async () => {
		let deprecationPatch: Record<string, unknown> | undefined;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ id: "template-3", status: "deprecated" }],
			onSet: (value) => {
				deprecationPatch = value;
			},
		}));

		await expect(deprecateWorkflowTemplate("template-3", "admin-1")).resolves.toMatchObject({
			status: "deprecated",
		});
		expect(deprecationPatch).toMatchObject({
			status: "deprecated",
			deprecatedBy: "admin-1",
		});

		const rollbackTarget = {
			id: "template-2",
			templateKey: "evidence_gate",
			name: "Evidence Gate",
			subjectType: "evidence_claim",
			version: 2,
			status: "deprecated",
			states: ["draft", "review", "approved"],
			transitions: [
				{ action: "submit", from: ["draft"], to: "review" },
				{ action: "approve", from: ["review"], to: "approved" },
			],
			metadata: {},
		};
		let rollbackPatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [rollbackTarget] }));
		dbMock.update
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain({
				result: [{ ...rollbackTarget, status: "active" }],
				onSet: (value) => {
					rollbackPatch = value;
				},
			}));

		await expect(rollbackWorkflowTemplate({
			templateKey: "evidence_gate",
			targetVersion: 2,
			actorId: "admin-1",
		})).resolves.toMatchObject({
			id: "template-2",
			status: "active",
		});
		expect(rollbackPatch).toMatchObject({
			status: "active",
			publishedBy: "admin-1",
		});
		expect((rollbackPatch?.metadata as Record<string, unknown>).rollback).toMatchObject({
			rolledBackBy: "admin-1",
			targetVersion: 2,
		});
	});

	it("marks email notifications failed when recipients cannot receive delivery", async () => {
		let failurePatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				notification: {
					id: "notification-1",
					channel: "email",
					actionUrl: "/workflows",
					metadata: { existing: true },
				},
				instance: {
					workflowKey: "requirement_acceptance",
					subjectType: "requirement",
					subjectId: "req-1",
					state: "accepted",
					status: "active",
					priority: "high",
					dueAt: null,
				},
				recipient: {
					id: "user-1",
					email: null,
				},
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				failurePatch = value;
			},
		}));

		const result = await deliverWorkflowNotifications();

		expect(result).toEqual({ attempted: 1, delivered: 0, failed: 1, skipped: 0 });
		expect(failurePatch).toMatchObject({
			deliveryStatus: "failed",
			metadata: { existing: true, error: "Recipient email is missing" },
		});
	});

	it("defers queued email notifications during recipient quiet hours", async () => {
		let deferredPatch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				notification: {
					id: "notification-quiet",
					channel: "email",
					actionUrl: "/workflows",
					metadata: { existing: true },
				},
				instance: {
					workflowKey: "requirement_acceptance",
					subjectType: "requirement",
					subjectId: "req-1",
					state: "accepted",
					status: "active",
					priority: "high",
					dueAt: null,
				},
				recipient: {
					id: "user-1",
					email: "user@example.test",
					preferences: {
						notifications: {
							quietHours: {
								enabled: true,
								start: "22:00",
								end: "08:00",
							},
						},
					},
				},
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				deferredPatch = value;
			},
		}));

		const result = await deliverWorkflowNotifications({
			now: new Date("2026-05-06T23:30:00.000Z"),
		});

		expect(result).toEqual({ attempted: 1, delivered: 0, failed: 0, skipped: 1 });
		expect(deferredPatch).toEqual({
			metadata: {
				existing: true,
				quietHoursDeferred: {
					deferredAt: "2026-05-06T23:30:00.000Z",
					reason: "Recipient notification quiet hours are active",
				},
			},
		});
	});

	it("keeps default workflow templates simulation-valid across P1, P2, and strategic domains", () => {
		const keys = new Set<string>();
		for (const template of WORKFLOW_TEMPLATE_CATALOG) {
			expect(keys.has(template.templateKey)).toBe(false);
			keys.add(template.templateKey);

			const simulation = simulateWorkflowTemplate(template);
			expect(simulation.valid, `${template.templateKey}: ${simulation.errors.join("; ")}`).toBe(true);
			expect(template.metadata?.jtbdIds).toBeInstanceOf(Array);
		}
	});
});
