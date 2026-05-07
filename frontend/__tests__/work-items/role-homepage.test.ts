import { describe, expect, it } from "vitest";
import {
	buildRoleHomepageProjection,
	profileForRoles,
	type RoleHomepageProjection,
} from "@/lib/work-items/role-homepage";
import type { WorkItem } from "@/lib/work-items/projections";

const now = new Date("2026-05-06T09:00:00.000Z");

const items: WorkItem[] = [
	{
		id: "workflow:breached-parse",
		kind: "exception",
		title: "RFP parse remediation breached",
		status: "breached",
		priority: "critical",
		dueAt: "2026-05-05T09:00:00.000Z",
		subjectType: "rfp_parse",
		actionUrl: "/workflows/operations",
		source: "workflow_runtime",
	},
	{
		id: "task:section",
		kind: "task",
		title: "Write technical approach section",
		status: "open",
		priority: "high",
		dueAt: "2026-05-07T09:00:00.000Z",
		subjectType: "document_section",
		actionUrl: "/documents/doc-1",
		source: "proposal_task",
	},
	{
		id: "approval:pricing",
		kind: "approval",
		title: "Pricing approval decision",
		status: "waiting",
		priority: "high",
		subjectType: "pricing_package",
		actionUrl: "/workflows",
		auditRef: "workflow-pricing",
		source: "workflow_runtime",
	},
	{
		id: "portal:evidence",
		kind: "portal",
		title: "Partner evidence upload",
		status: "open",
		priority: "medium",
		portalVisible: true,
		subjectType: "evidence_request",
		actionUrl: "/workflows/portal",
		source: "workflow_runtime",
	},
];

describe("role homepage projection", () => {
	it("selects the highest-precedence homepage for multi-role users", () => {
		expect(profileForRoles(["writer", "operations"]).id).toBe("operations");
		expect(profileForRoles(["partner", "proposal_manager"]).id).toBe("partner");
		expect(profileForRoles(["unknown-role"]).id).toBe("proposal_team");
	});

	it("focuses operations users on exceptions and failed runtime work", () => {
		const projection = buildRoleHomepageProjection(["operations"], items, now);

		expectProjection(projection, "Operations Home");
		expect(projection.focusItems.map((item) => item.id)).toEqual(["workflow:breached-parse"]);
		expect(projection.summary).toMatchObject({
			open: 1,
			blocked: 1,
			overdue: 1,
			critical: 1,
		});
		expect(projection.profile.quickLinks.map((link) => link.href)).toContain("/workflows/operations");
	});

	it("focuses writers on assigned document and requirement work", () => {
		const projection = buildRoleHomepageProjection(["writer"], items, now);

		expectProjection(projection, "Writer Home");
		expect(projection.focusItems.map((item) => item.id)).toEqual(["task:section"]);
		expect(projection.nextActions).toEqual([
			expect.objectContaining({
				id: "task:section",
				actionUrl: "/documents/doc-1",
			}),
		]);
	});

	it("focuses partners on portal-visible contribution work", () => {
		const projection = buildRoleHomepageProjection(["partner"], items, now);

		expectProjection(projection, "Partner Home");
		expect(projection.focusItems.map((item) => item.id)).toEqual(["portal:evidence"]);
		expect(projection.profile.primaryRoute).toBe("/workflows/portal");
	});
});

function expectProjection(projection: RoleHomepageProjection, title: string) {
	expect(projection.profile.title).toBe(title);
	expect(projection.generatedAt).toBe(now.toISOString());
	expect(projection.emptyState.length).toBeGreaterThan(10);
}
