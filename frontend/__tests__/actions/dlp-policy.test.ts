import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "security-reviewer-1" })),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "dlp-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "dlp-task-1" })),
}));

function createChain(result: unknown[] = [], onWhere?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		onWhere?.(value);
		return chain;
	});
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { evaluateDlpExportPolicyWorkflow } from "@/lib/actions/dlp-policy";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
});

describe("DLP export policy workflow", () => {
	it("records a cleared terminal scan when no findings exist", async () => {
		let docsWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain([{
			documentId: "doc-1",
			title: "Management Plan",
			content: "Clean proposal content with no sensitive tokens.",
		}], (value) => {
			docsWhere = value;
		}));

		const result = await evaluateDlpExportPolicyWorkflow("opp-1");

		expect(result).toMatchObject({
			opportunityId: "opp-1",
			allowed: true,
			findings: [],
			blockingCount: 0,
			workflowInstanceIds: ["dlp-workflow-1"],
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "privacy_dlp_export_gate",
			subjectType: "opportunity_dlp_scan",
			subjectId: "opp-1",
			toState: "cleared",
			terminal: true,
		}));
		expect(upsertWorkflowRuntimeTask).not.toHaveBeenCalled();
		expect(collectSqlFragments(docsWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("blocks export and projects a security review task for classified findings", async () => {
		let docsWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain([{
			documentId: "doc-2",
			title: "Technical Volume",
			content: "This appendix is marked TOP SECRET and must not be exported.",
		}], (value) => {
			docsWhere = value;
		}));

		const result = await evaluateDlpExportPolicyWorkflow("opp-2");

		expect(result.allowed).toBe(false);
		expect(result.blockingCount).toBe(1);
		expect(result.findings[0]).toMatchObject({
			documentId: "doc-2",
			severity: "high",
			label: "Restricted classification marking",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "privacy_dlp_export_gate",
			subjectType: "dlp_finding",
			opportunityId: "opp-2",
			toState: "review_required",
			eventType: "dlp_finding_detected",
			priority: "high",
			assignedRole: "security_reviewer",
			terminal: false,
			actionUrl: "/documents/doc-2",
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "dlp-workflow-1",
			title: "Review Restricted classification marking",
			state: "blocked",
			priority: "high",
			assignedRole: "security_reviewer",
		}));
		expect(collectSqlFragments(docsWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
