import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "capture-manager-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "resource-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "resource-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectAssignedOpportunityScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain("org-1");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("capture-manager-1");
}

function expectOrganizationScope(where: unknown) {
	expect(collectSqlFragments(where).join(" ")).toContain("org-1");
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import {
	transitionPastPerformanceReuseWorkflow,
	transitionPersonnelReuseWorkflow,
} from "@/lib/actions/resource-reuse-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const position = {
	id: "position-1",
	opportunityId: "opp-1",
	positionTitle: "Programme Director",
	positionCategory: "key_personnel",
	assignedPersonnelId: null,
	assignmentStatus: "open",
	assignmentNotes: null,
	assignedAt: null,
	assignedBy: null,
	matchScore: 92,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const person = {
	id: "person-1",
	firstName: "Amina",
	lastName: "Okello",
	email: "amina@datacraft.co.ke",
	organizationId: "org-1",
	currentProposals: [],
	availability: "available",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const project = {
	id: "project-1",
	organizationId: "org-1",
	name: "National Data Platform Modernisation",
	customerName: "Ministry of Digital Services",
	customerAgency: "MDS",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const relevance = {
	id: "relevance-1",
	projectId: "project-1",
	opportunityId: "opp-1",
	overallScore: 91,
	isSelected: false,
	selectionRank: null,
	selectionNotes: null,
	gaps: [],
	calculatedAt: new Date("2026-05-01T00:00:00.000Z"),
	calculatedBy: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
	dbMock.update.mockReset();
	requireUserContextMock.mockResolvedValue({
		userId: "capture-manager-1",
		organizationId: "org-1",
	});
});

describe("resource reuse workflow", () => {
	it("assigns personnel to a position, updates proposal membership, and projects workflow work", async () => {
		let positionPatch: Record<string, unknown> | undefined;
		let personnelPatch: Record<string, unknown> | undefined;
		const positionWheres: unknown[] = [];
		const personnelWheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [position],
				onWhere: (value) => {
					positionWheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [person],
				onWhere: (value) => {
					personnelWheres.push(value);
				},
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{
					...position,
					assignedPersonnelId: "person-1",
					assignmentStatus: "assigned",
				}],
				onSet: (value) => {
					positionPatch = value;
				},
				onWhere: (value) => {
					positionWheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...person, currentProposals: ["opp-1"] }],
				onSet: (value) => {
					personnelPatch = value;
				},
				onWhere: (value) => {
					personnelWheres.push(value);
				},
			}));

		const result = await transitionPersonnelReuseWorkflow({
			positionId: "position-1",
			personnelId: "person-1",
			action: "assign",
			reason: "Best match for programme leadership",
			assignedTo: "staffing-lead-1",
			dueAt: "2026-05-10T00:00:00.000Z",
		});

		expect(result).toMatchObject({
			subjectId: "position-1",
			opportunityId: "opp-1",
			fromState: "open",
			toState: "assigned",
			taskProjected: true,
		});
		expect(positionPatch).toMatchObject({
			assignedPersonnelId: "person-1",
			assignmentStatus: "assigned",
			assignmentNotes: "Best match for programme leadership",
			assignedBy: "capture-manager-1",
		});
		expect(personnelPatch).toMatchObject({
			currentProposals: ["opp-1"],
		});
		expect(positionWheres).toHaveLength(2);
		expectAssignedOpportunityScope(positionWheres[0]);
		expectAssignedOpportunityScope(positionWheres[1]);
		expect(personnelWheres).toHaveLength(2);
		expectOrganizationScope(personnelWheres[0]);
		expectOrganizationScope(personnelWheres[1]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "personnel_resource_reuse",
			organizationId: "org-1",
			subjectType: "position_requirement",
			subjectId: "position-1",
			opportunityId: "opp-1",
			toState: "assigned",
			assignedRole: "staffing_manager",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "resource-workflow-1",
			taskKey: "personnel-reuse:position-1",
			state: "in_progress",
			assignedRole: "staffing_manager",
		}));
	});

	it("releases assigned personnel and removes the opportunity from current proposals", async () => {
		let positionPatch: Record<string, unknown> | undefined;
		let personnelPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					...position,
					assignedPersonnelId: "person-1",
					assignmentStatus: "confirmed",
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...person, currentProposals: ["opp-1", "opp-2"] }],
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...position, assignedPersonnelId: null, assignmentStatus: "open" }],
				onSet: (value) => {
					positionPatch = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...person, currentProposals: ["opp-2"] }],
				onSet: (value) => {
					personnelPatch = value;
				},
			}));

		await transitionPersonnelReuseWorkflow({
			positionId: "position-1",
			action: "release",
			reason: "No longer available for this bid",
		});

		expect(positionPatch).toMatchObject({
			assignedPersonnelId: null,
			assignmentStatus: "open",
			assignmentNotes: "Released: No longer available for this bid",
		});
		expect(personnelPatch).toMatchObject({
			currentProposals: ["opp-2"],
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "released",
			terminal: true,
			assignedRole: null,
		}));
	});

	it("selects a past-performance project for opportunity reuse", async () => {
		let relevancePatch: Record<string, unknown> | undefined;
		let projectWhere: unknown;
		const relevanceWheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [project],
				onWhere: (value) => {
					projectWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [relevance],
				onWhere: (value) => {
					relevanceWheres.push(value);
				},
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...relevance,
				isSelected: true,
				selectionRank: 1,
				selectionNotes: "Strong platform modernisation relevance",
			}],
			onSet: (value) => {
				relevancePatch = value;
			},
			onWhere: (value) => {
				relevanceWheres.push(value);
			},
		}));

		const result = await transitionPastPerformanceReuseWorkflow({
			projectId: "project-1",
			opportunityId: "opp-1",
			action: "select",
			reason: "Strong platform modernisation relevance",
			selectionRank: 1,
		});

		expect(result).toMatchObject({
			subjectId: "project-1",
			opportunityId: "opp-1",
			fromState: "review",
			toState: "selected",
			taskProjected: true,
		});
		expect(relevancePatch).toMatchObject({
			isSelected: true,
			selectionRank: 1,
			selectionNotes: "Strong platform modernisation relevance",
			calculatedBy: "capture-manager-1",
		});
		expectOrganizationScope(projectWhere);
		expect(relevanceWheres).toHaveLength(2);
		expectAssignedOpportunityScope(relevanceWheres[0]);
		expectAssignedOpportunityScope(relevanceWheres[1]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "past_performance_reuse",
			organizationId: "org-1",
			subjectType: "past_performance_project",
			subjectId: "project-1",
			toState: "selected",
			assignedRole: "past_performance_lead",
		}));
	});

	it("rejects unauthorized past-performance reuse across organizations", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "capture-manager-1",
			organizationId: "org-1",
		});
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ ...project, organizationId: "other-org" }],
			}))
			.mockReturnValueOnce(createChain({ result: [relevance] }));

		await expect(
			transitionPastPerformanceReuseWorkflow({
				projectId: "project-1",
				opportunityId: "opp-1",
				action: "select",
				reason: "Try reuse",
			})
		).rejects.toThrow("Unauthorized to reuse this past performance project");
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});

	it("requires a reason", async () => {
		await expect(
			transitionPersonnelReuseWorkflow({
				positionId: "position-1",
				action: "reopen",
				reason: " ",
			})
		).rejects.toThrow("Personnel reuse transitions require a reason");

		await expect(
			transitionPastPerformanceReuseWorkflow({
				projectId: "project-1",
				opportunityId: "opp-1",
				action: "select",
				reason: " ",
			})
		).rejects.toThrow("Past performance reuse transitions require a reason");
	});
});
