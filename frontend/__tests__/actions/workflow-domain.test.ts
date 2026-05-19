import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: vi.fn(async () => ({
		userId: "workflow-operator-1",
		organizationId: "org-1",
		roles: ["admin"],
	})),
}));

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
	startDomainWorkflowFromTemplate,
	transitionDomainWorkflow,
} from "@/lib/actions/workflow-domain";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("workflow domain integrations", () => {
	it("starts a domain workflow from an active template and projects partner assignment state", async () => {
		const template = {
			id: "template-1",
			templateKey: "partner_portal_contribution",
			name: "Partner Portal Contribution",
			description: "Partner scoped workflow",
			subjectType: "partner_assignment",
			version: 1,
			status: "active",
			states: ["invited", "assigned", "accepted_final"],
			transitions: [
				{ action: "assign_scope", from: ["invited"], to: "assigned", requiredRoles: ["proposal_manager"] },
				{ action: "accept", from: ["assigned"], to: "accepted_final", requiredRoles: ["reviewer"] },
			],
			slaPolicy: { defaultHours: 24, escalationRole: "partner_manager" },
			portalPolicy: { visibleStates: ["invited", "assigned"], portalRole: "partner" },
			metadata: {},
		};
		const instance = {
			id: "workflow-1",
			workflowKey: "partner_portal_contribution",
			subjectType: "partner_assignment",
			subjectId: "assignment-1",
			state: "invited",
			status: "active",
			assignedTo: "partner-user-1",
			assignedRole: null,
			dueAt: new Date("2026-05-03T00:00:00.000Z"),
		};
		let instanceInsert: Record<string, unknown> | undefined;
		let partnerPatch: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [template] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [instance],
				onValues: (value) => {
					instanceInsert = value as Record<string, unknown>;
				},
			}))
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain());
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				partnerPatch = value;
			},
		}));

		const result = await startDomainWorkflowFromTemplate({
			templateKey: "partner_portal_contribution",
			subjectId: "assignment-1",
			actorId: "pm-1",
			actorRoles: ["proposal_manager"],
			assignedTo: "partner-user-1",
		});

		expect(result).toEqual(instance);
		expect(instanceInsert).toMatchObject({
			workflowKey: "partner_portal_contribution",
			subjectType: "partner_assignment",
			subjectId: "assignment-1",
			state: "invited",
			visibility: "portal",
		});
		expect(partnerPatch).toMatchObject({ status: "invited" });
	});

	it("denies workflow starts when the actor lacks template start authority", async () => {
		const template = {
			id: "template-1",
			templateKey: "pricing_approval",
			name: "Pricing Approval",
			subjectType: "pricing_package",
			version: 1,
			status: "active",
			states: ["draft", "authority_review", "locked"],
			transitions: [
				{ action: "submit", from: ["draft"], to: "authority_review", requiredRoles: ["finance_approver"] },
			],
			slaPolicy: {},
			portalPolicy: {},
			metadata: {},
		};
		dbMock.select.mockReturnValueOnce(createChain({ result: [template] }));

		await expect(startDomainWorkflowFromTemplate({
			templateKey: "pricing_approval",
			subjectId: "pricing-1",
			actorId: "writer-1",
			actorRoles: ["writer"],
		})).rejects.toThrow("requires finance_approver");
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("applies template transitions and resolves pricing packages into approved cost elements", async () => {
		const instance = {
			id: "workflow-1",
			workflowKey: "pricing_approval",
			subjectType: "pricing_package",
			subjectId: "00000000-0000-4000-8000-000000000001",
			opportunityId: "00000000-0000-4000-8000-000000000001",
			state: "authority_review",
			status: "active",
			assignedTo: null,
			assignedRole: null,
			dueAt: null,
			metadata: { templateVersion: 1 },
		};
		const template = {
			id: "template-1",
			templateKey: "pricing_approval",
			name: "Pricing Approval",
			subjectType: "pricing_package",
			version: 1,
			status: "active",
			states: ["draft", "authority_review", "locked"],
			transitions: [
				{ action: "lock", from: ["authority_review"], to: "locked", requiredRoles: ["finance_approver"] },
			],
			slaPolicy: {},
			portalPolicy: {},
			metadata: {},
		};
		const updated = { ...instance, state: "locked", status: "completed" };
		let pricingPatch: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [instance] }))
			.mockReturnValueOnce(createChain({ result: [template] }))
			.mockReturnValueOnce(createChain({ result: [instance] }))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.update
			.mockReturnValueOnce(createChain({ result: [updated] }))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					pricingPatch = value;
				},
			}));
		dbMock.insert
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain());

		const result = await transitionDomainWorkflow({
			workflowInstanceId: "workflow-1",
			action: "lock",
			actorId: "finance-1",
			actorRoles: ["finance_approver"],
			reason: "Authority approved",
		});

		expect(result).toEqual(updated);
		expect(pricingPatch).toMatchObject({
			status: "approved",
			approvedBy: "finance-1",
		});
		expect(pricingPatch?.approvedAt).toBeInstanceOf(Date);
	});

	it("applies domain compensation when cancelling evidence claim workflows", async () => {
		const existing = {
			id: "workflow-1",
			workflowKey: "evidence_claim_remediation",
			subjectType: "evidence_claim",
			subjectId: "claim-1",
			state: "review",
			status: "active",
			visibility: "portal",
			portalVisibility: { visibleToPortal: true, portalRole: "partner" },
			metadata: {},
		};
		const cancelled = { ...existing, state: "cancelled", status: "cancelled" };
		const template = {
			templateKey: existing.workflowKey,
			version: 1,
			status: "active",
			portalPolicy: { visibleStates: ["review"], portalRole: "partner" },
			transitions: [
				{ action: "cancel", from: ["review"], to: "cancelled", requiredRoles: ["reviewer"] },
			],
		};
		let workflowPatch: Record<string, unknown> | undefined;
		let claimPatch: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [existing] }))
			.mockReturnValueOnce(createChain({ result: [template] }))
			.mockReturnValueOnce(createChain({ result: [existing] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [cancelled],
				onSet: (value) => {
					workflowPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					claimPatch = value;
				},
			}));
		dbMock.insert
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain());

		await expect(transitionDomainWorkflow({
			workflowInstanceId: "workflow-1",
			action: "cancel",
			actorId: "qa-1",
			actorRoles: ["reviewer"],
			reason: "Claim removed from proposal",
		})).resolves.toEqual(cancelled);

		expect(workflowPatch).toMatchObject({
			state: "cancelled",
			status: "cancelled",
			visibility: "internal",
			portalVisibility: null,
		});
		expect(claimPatch).toMatchObject({
			status: "resolved",
			resolution: "claim_removed",
			resolvedBy: "qa-1",
			resolutionNotes: "Cancelled by workflow compensation: Claim removed from proposal",
		});
		expect(claimPatch?.resolvedAt).toBeInstanceOf(Date);
	});

	it("reopens final document artifacts through domain compensation", async () => {
		const existing = {
			id: "workflow-1",
			workflowKey: "final_artifact_render_export",
			subjectType: "document",
			subjectId: "doc-1",
			state: "artifact_approved",
			status: "completed",
			metadata: {},
		};
		const reopened = { ...existing, state: "artifact_reopened", status: "active" };
		const template = {
			templateKey: existing.workflowKey,
			version: 1,
			status: "active",
			transitions: [
				{ action: "reopen", from: ["artifact_approved"], to: "artifact_reopened", requiredRoles: ["proposal_manager"] },
			],
		};
		const document = {
			id: "doc-1",
			status: "final",
			metadata: {
				finalArtifact: { artifactHash: "a".repeat(64), filename: "proposal.docx" },
			},
		};
		let documentPatch: Record<string, unknown> | undefined;
		let proposalPatch: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [existing] }))
			.mockReturnValueOnce(createChain({ result: [template] }))
			.mockReturnValueOnce(createChain({ result: [existing] }))
			.mockReturnValueOnce(createChain({ result: [document] }));
		dbMock.update
			.mockReturnValueOnce(createChain({ result: [reopened] }))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					documentPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					proposalPatch = value;
				},
			}));
		dbMock.insert
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain());

		await expect(transitionDomainWorkflow({
			workflowInstanceId: "workflow-1",
			action: "reopen",
			actorId: "pm-1",
			actorRoles: ["proposal_manager"],
			reason: "Customer correction changed the final artifact",
			targetState: "artifact_reopened",
		})).resolves.toEqual(reopened);

		expect(documentPatch).toMatchObject({
			status: "draft",
			metadata: {
				finalArtifact: null,
				finalArtifactWorkflow: {
					state: "artifact_reopened",
					reopenedBy: "pm-1",
					reason: "Customer correction changed the final artifact",
				},
				finalizationCompensation: {
					action: "reopen",
					reason: "Customer correction changed the final artifact",
					actorId: "pm-1",
				},
			},
		});
		expect(proposalPatch).toMatchObject({
			status: "in_review",
			approvedBy: null,
			approvedAt: null,
			notes: "Reopened by workflow compensation: Customer correction changed the final artifact",
		});
	});

	it.each([
		{
			subjectType: "rfp_parse",
			action: "cancel",
			reason: "Parser output was invalid",
			expectedPatch: {
				parsingStatus: "failed",
				parsingProgress: 0,
				parsingError: "Cancelled by workflow compensation: Parser output was invalid",
			},
		},
		{
			subjectType: "requirement",
			action: "resolve",
			reason: "Requirement accepted into the response plan",
			expectedPatch: {
				complianceStatus: "addressed",
			},
		},
		{
			subjectType: "compliance_entry",
			action: "resolve",
			reason: "Compliance evidence approved",
			expectedPatch: {
				status: "approved",
				complianceStatus: "full",
				reviewerNotes: "Resolved by workflow: Compliance evidence approved",
				reviewedBy: "owner-1",
				approvedBy: "owner-1",
				completionPercent: 100,
			},
		},
		{
			subjectType: "gate_review",
			action: "cancel",
			reason: "Gate deferred pending customer amendment",
			expectedPatch: {
				status: "cancelled",
				decision: "defer",
				rationale: "Cancelled by workflow compensation: Gate deferred pending customer amendment",
			},
		},
		{
			subjectType: "proposal_task",
			action: "resolve",
			reason: "Assigned work accepted",
			expectedPatch: {
				status: "completed",
				completedBy: "owner-1",
				progress: 100,
			},
		},
		{
			subjectType: "proposal_review",
			action: "resolve",
			reason: "Color review closed",
			expectedPatch: {
				status: "completed",
				recommendation: "ready_to_submit",
			},
		},
		{
			subjectType: "review_comment",
			action: "resolve",
			reason: "Critical finding fixed and verified",
			expectedPatch: {
				resolutionStatus: "resolved",
				resolutionAction: "revised",
				resolvedBy: "owner-1",
				verifiedBy: "owner-1",
				verificationNotes: "Verified by workflow: Critical finding fixed and verified",
			},
		},
		{
			subjectType: "document_approval",
			action: "cancel",
			reason: "Approval package withdrawn",
			expectedPatch: {
				status: "rejected",
				notes: "Cancelled by workflow compensation: Approval package withdrawn",
				rejectionReason: "Approval package withdrawn",
			},
		},
		{
			subjectType: "submission",
			action: "resolve",
			reason: "Receipt confirmed",
			expectedPatch: {
				status: "submitted",
				outcomeNotes: "Resolved by workflow: Receipt confirmed",
			},
		},
		{
			subjectType: "cost_element",
			action: "resolve",
			reason: "Element approved by finance",
			expectedPatch: {
				status: "approved",
				approvedBy: "owner-1",
			},
		},
		{
			subjectType: "opportunity",
			action: "resolve",
			reason: "Pursuit accepted",
			expectedPatch: {
				decisionStatus: "go",
				decisionReason: "Resolved by workflow: Pursuit accepted",
				isReviewed: true,
			},
		},
		{
			subjectType: "scraper_run",
			action: "cancel",
			reason: "Source disabled after repeated failures",
			expectedPatch: {
				status: "cancelled",
				errorMessage: "Cancelled by workflow compensation: Source disabled after repeated failures",
				errorType: "workflow_cancelled",
			},
		},
		{
			subjectType: "ai_governance_event",
			action: "resolve",
			reason: "Evaluation accepted",
			expectedPatch: {
				metadata: {
					domainStateModel: {
						subjectType: "ai_governance_event",
						storage: "workflow_instances.metadata.domainState",
					},
					domainState: {
						status: "approved",
						action: "resolve",
						reason: "Evaluation accepted",
						actorId: "owner-1",
					},
				},
			},
		},
		{
			subjectType: "audit_report_package",
			action: "resolve",
			reason: "Audit package published",
			expectedPatch: {
				metadata: {
					domainStateModel: {
						subjectType: "audit_report_package",
						storage: "workflow_instances.metadata.domainState",
					},
					domainState: {
						status: "published",
						action: "resolve",
						reason: "Audit package published",
						actorId: "owner-1",
					},
				},
			},
		},
		{
			subjectType: "offline_action_batch",
			action: "cancel",
			reason: "Offline edits superseded",
			expectedPatch: {
				metadata: {
					domainStateModel: {
						subjectType: "offline_action_batch",
						storage: "workflow_instances.metadata.domainState",
					},
					domainState: {
						status: "rejected",
						action: "cancel",
						reason: "Offline edits superseded",
						actorId: "owner-1",
					},
				},
			},
		},
	])("projects $subjectType workflow compensation into durable domain state", async ({ subjectType, action, reason, expectedPatch }) => {
		const existing = {
			id: "workflow-1",
			workflowKey: `${subjectType}_workflow`,
			subjectType,
			subjectId: "subject-1",
			state: "review",
			status: "active",
			metadata: {},
		};
		const updated = {
			...existing,
			state: action === "cancel" ? "cancelled" : "resolved",
			status: action === "cancel" ? "cancelled" : "completed",
		};
		const template = {
			templateKey: existing.workflowKey,
			version: 1,
			status: "active",
			transitions: [
				{ action, from: ["review"], to: updated.state, requiredRoles: ["proposal_manager"] },
			],
		};
		let domainPatch: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [existing] }))
			.mockReturnValueOnce(createChain({ result: [template] }))
			.mockReturnValueOnce(createChain({ result: [existing] }));
		dbMock.update
			.mockReturnValueOnce(createChain({ result: [updated] }))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					if (action === "cancel") return;
					domainPatch = value;
				},
			}));
		if (action === "cancel") {
			dbMock.update
				.mockReturnValueOnce(createChain({
					onSet: (value) => {
						domainPatch = value;
					},
				}));
		}
		dbMock.insert
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain());

		await expect(transitionDomainWorkflow({
			workflowInstanceId: "workflow-1",
			action,
			actorId: "owner-1",
			actorRoles: ["proposal_manager"],
			reason,
		})).resolves.toEqual(updated);

		expect(domainPatch).toMatchObject(expectedPatch);
	});
});
