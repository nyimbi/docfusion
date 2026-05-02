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
			metadata: {},
		};
		const cancelled = { ...existing, state: "cancelled", status: "cancelled" };
		let claimPatch: Record<string, unknown> | undefined;

		dbMock.select.mockReturnValueOnce(createChain({ result: [existing] }));
		dbMock.update
			.mockReturnValueOnce(createChain({ result: [cancelled] }))
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

		expect(claimPatch).toMatchObject({
			status: "resolved",
			resolution: "claim_removed",
			resolvedBy: "qa-1",
			resolutionNotes: "Cancelled by workflow compensation: Claim removed from proposal",
		});
		expect(claimPatch?.resolvedAt).toBeInstanceOf(Date);
	});
});
