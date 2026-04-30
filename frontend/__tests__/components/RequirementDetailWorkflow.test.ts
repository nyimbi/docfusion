import { describe, expect, it, vi } from "vitest";
import type { Requirement } from "@/lib/types/opportunity";

vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: null }),
}));

vi.mock("@/lib/actions/requirements", () => ({
	updateRequirement: vi.fn(),
	assignRequirement: vi.fn(),
	transitionRequirementWorkflow: vi.fn(),
}));

import { getWorkflowGateStatus } from "@/components/requirements/RequirementDetail";

const baseRequirement: Requirement = {
	id: "req-1",
	opportunityId: "opp-1",
	requirementId: "REQ-001",
	category: "technical",
	subcategory: null,
	text: "Provide security controls.",
	source: "Security controls are mandatory.",
	sourcePageRef: "3.1",
	priority: "mandatory",
	complianceStatus: "not_addressed",
	responseStrategy: null,
	assignedTo: "writer-1",
	dueDate: new Date("2026-05-10T00:00:00.000Z"),
	notes: null,
	riskLevel: "high",
	aiAnalysis: null,
	workflowState: "review",
	createdAt: new Date("2026-04-01T00:00:00.000Z"),
	updatedAt: new Date("2026-04-01T00:00:00.000Z"),
};

describe("RequirementDetail workflow gates", () => {
	it("marks all acceptance gates ready when the requirement is complete", () => {
		const gates = getWorkflowGateStatus(baseRequirement, {}, "capture-lead");

		expect(gates.every((gate) => gate.ready)).toBe(true);
		expect(gates.map((gate) => gate.label)).toEqual([
			"source trace",
			"category",
			"priority",
			"owner",
			"due date",
		]);
	});

	it("uses form edits and current user to resolve missing gates", () => {
		const incompleteRequirement: Requirement = {
			...baseRequirement,
			category: null,
			source: null,
			sourcePageRef: null,
			assignedTo: null,
			dueDate: null,
		};

		const gates = getWorkflowGateStatus(
			incompleteRequirement,
			{
				category: "legal",
				source: "Updated source quote",
				dueDate: "2026-05-12",
			},
			"capture-lead"
		);

		expect(gates).toEqual([
			{ label: "source trace", ready: true },
			{ label: "category", ready: true },
			{ label: "priority", ready: true },
			{ label: "owner", ready: true },
			{ label: "due date", ready: true },
		]);
	});
});
