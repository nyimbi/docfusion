import {
	deriveCommandCenterBlockers,
	deriveCommandCenterNextActions,
	normalizeWorkItems,
	summarizeWorkItems,
	type CommandCenterBlocker,
	type CommandCenterNextAction,
	type WorkItem,
	type WorkItemSummary,
} from "@/lib/work-items/projections";

export type RoleHomepageId =
	| "proposal_manager"
	| "writer"
	| "reviewer"
	| "approver"
	| "partner"
	| "operations"
	| "admin"
	| "auditor"
	| "proposal_team";

export interface RoleHomepageProfile {
	id: RoleHomepageId;
	title: string;
	job: string;
	primaryRoute: string;
	primaryAction: string;
	quickLinks: Array<{
		label: string;
		href: string;
		priority: "primary" | "secondary";
	}>;
}

export interface RoleHomepageProjection {
	profile: RoleHomepageProfile;
	roles: string[];
	focusItems: WorkItem[];
	blockers: CommandCenterBlocker[];
	nextActions: CommandCenterNextAction[];
	summary: WorkItemSummary;
	generatedAt: string;
	emptyState: string;
}

const ROLE_ALIASES: Record<string, RoleHomepageId> = {
	admin: "admin",
	workflow_admin: "admin",
	operations: "operations",
	operator: "operations",
	ops: "operations",
	auditor: "auditor",
	approver: "approver",
	executive: "approver",
	reviewer: "reviewer",
	color_team_reviewer: "reviewer",
	writer: "writer",
	author: "writer",
	partner: "partner",
	contributor: "partner",
	external: "partner",
	proposal_manager: "proposal_manager",
	capture_manager: "proposal_manager",
	pursuit_lead: "proposal_manager",
};

const ROLE_PRECEDENCE: RoleHomepageId[] = [
	"admin",
	"operations",
	"auditor",
	"approver",
	"reviewer",
	"writer",
	"partner",
	"proposal_manager",
	"proposal_team",
];

const PROFILES: Record<RoleHomepageId, RoleHomepageProfile> = {
	proposal_manager: {
		id: "proposal_manager",
		title: "Proposal Manager Home",
		job: "Control pursuits, deadlines, blockers, bid decisions, readiness, and cross-functional handoffs.",
		primaryRoute: "/opportunities",
		primaryAction: "Review Pursuits",
		quickLinks: [
			{ label: "Opportunities", href: "/opportunities", priority: "primary" },
			{ label: "Pipeline", href: "/pipeline", priority: "secondary" },
			{ label: "Operational Inbox", href: "/tasks", priority: "secondary" },
			{ label: "Reviews", href: "/reviews", priority: "secondary" },
		],
	},
	writer: {
		id: "writer",
		title: "Writer Home",
		job: "Finish assigned sections, resolve requirements, close evidence gaps, and keep narrative work moving.",
		primaryRoute: "/tasks",
		primaryAction: "Open Assignments",
		quickLinks: [
			{ label: "Assignments", href: "/tasks", priority: "primary" },
			{ label: "Documents", href: "/documents", priority: "secondary" },
			{ label: "Content Library", href: "/content-library", priority: "secondary" },
			{ label: "Evidence", href: "/past-performance", priority: "secondary" },
		],
	},
	reviewer: {
		id: "reviewer",
		title: "Reviewer Home",
		job: "Review packages, resolve comments, approve findings, and return actionable feedback before gate deadlines.",
		primaryRoute: "/reviews",
		primaryAction: "Open Reviews",
		quickLinks: [
			{ label: "Reviews", href: "/reviews", priority: "primary" },
			{ label: "Tasks", href: "/tasks", priority: "secondary" },
			{ label: "Documents", href: "/documents", priority: "secondary" },
			{ label: "Audit", href: "/workflows/audit", priority: "secondary" },
		],
	},
	approver: {
		id: "approver",
		title: "Approver Home",
		job: "Make authority-bound decisions with frozen artifacts, rationale, quorum, and reversal visibility.",
		primaryRoute: "/workflows",
		primaryAction: "Open Decisions",
		quickLinks: [
			{ label: "Workflow Decisions", href: "/workflows", priority: "primary" },
			{ label: "Reviews", href: "/reviews", priority: "secondary" },
			{ label: "Audit", href: "/workflows/audit", priority: "secondary" },
			{ label: "Submission Readiness", href: "/workflows/operations", priority: "secondary" },
		],
	},
	partner: {
		id: "partner",
		title: "Partner Home",
		job: "See scoped contribution requests, upload evidence, answer clarifications, and track externally visible deadlines.",
		primaryRoute: "/workflows/portal",
		primaryAction: "Open Portal Work",
		quickLinks: [
			{ label: "Portal Work", href: "/workflows/portal", priority: "primary" },
			{ label: "Tasks", href: "/tasks", priority: "secondary" },
			{ label: "Documents", href: "/documents", priority: "secondary" },
			{ label: "Partners", href: "/partners", priority: "secondary" },
		],
	},
	operations: {
		id: "operations",
		title: "Operations Home",
		job: "Recover failed jobs, breached SLAs, source freshness issues, notification failures, imports, and platform incidents.",
		primaryRoute: "/workflows/operations",
		primaryAction: "Open Operations",
		quickLinks: [
			{ label: "Operations", href: "/workflows/operations", priority: "primary" },
			{ label: "Workflow Dashboard", href: "/workflows", priority: "secondary" },
			{ label: "Import Data", href: "/import", priority: "secondary" },
			{ label: "Audit", href: "/workflows/audit", priority: "secondary" },
		],
	},
	admin: {
		id: "admin",
		title: "Admin Home",
		job: "Govern workflow templates, configuration, system health, permissions, audit exceptions, and publication safety.",
		primaryRoute: "/workflows/templates",
		primaryAction: "Open Template Studio",
		quickLinks: [
			{ label: "Template Studio", href: "/workflows/templates", priority: "primary" },
			{ label: "Operations", href: "/workflows/operations", priority: "secondary" },
			{ label: "Settings", href: "/settings", priority: "secondary" },
			{ label: "Audit", href: "/workflows/audit", priority: "secondary" },
		],
	},
	auditor: {
		id: "auditor",
		title: "Auditor Home",
		job: "Reconstruct decision chains, artifact hashes, approvals, reversals, dispatch events, and exported evidence.",
		primaryRoute: "/workflows/audit",
		primaryAction: "Open Audit Explorer",
		quickLinks: [
			{ label: "Audit Explorer", href: "/workflows/audit", priority: "primary" },
			{ label: "Workflow Dashboard", href: "/workflows", priority: "secondary" },
			{ label: "Operations", href: "/workflows/operations", priority: "secondary" },
			{ label: "Reports", href: "/analytics", priority: "secondary" },
		],
	},
	proposal_team: {
		id: "proposal_team",
		title: "Proposal Team Home",
		job: "See the highest-priority proposal work, blockers, deadlines, and workflow actions across assigned pursuits.",
		primaryRoute: "/tasks",
		primaryAction: "Open Work Queue",
		quickLinks: [
			{ label: "Operational Inbox", href: "/tasks", priority: "primary" },
			{ label: "Opportunities", href: "/opportunities", priority: "secondary" },
			{ label: "Documents", href: "/documents", priority: "secondary" },
			{ label: "Workflows", href: "/workflows", priority: "secondary" },
		],
	},
};

export function buildRoleHomepageProjection(
	roles: string[],
	items: WorkItem[],
	now = new Date()
): RoleHomepageProjection {
	const normalizedRoles = normalizeRoles(roles);
	const profile = profileForRoles(normalizedRoles);
	const normalizedItems = normalizeWorkItems(items, now);
	const focusItems = normalizedItems
		.filter((item) => itemMatchesProfile(profile.id, item))
		.slice(0, 8);
	const visibleItems = focusItems.length > 0 ? focusItems : normalizedItems.slice(0, 8);

	return {
		profile,
		roles: normalizedRoles,
		focusItems: visibleItems,
		blockers: deriveCommandCenterBlockers(visibleItems, now),
		nextActions: deriveCommandCenterNextActions(visibleItems, now),
		summary: summarizeWorkItems(visibleItems, now),
		generatedAt: now.toISOString(),
		emptyState: emptyStateForProfile(profile.id),
	};
}

export function profileForRoles(roles: string[]): RoleHomepageProfile {
	const normalized = normalizeRoles(roles);
	const matched = normalized
		.map((role) => ROLE_ALIASES[role])
		.filter((role): role is RoleHomepageId => Boolean(role));
	for (const profileId of ROLE_PRECEDENCE) {
		if (matched.includes(profileId)) return PROFILES[profileId];
	}
	return PROFILES.proposal_team;
}

function normalizeRoles(roles: string[]): string[] {
	return [...new Set(roles.map((role) => role.trim().toLowerCase()).filter(Boolean))];
}

function itemMatchesProfile(profileId: RoleHomepageId, item: WorkItem): boolean {
	const status = item.status.toLowerCase();
	const subjectType = item.subjectType?.toLowerCase() ?? "";
	const source = item.source.toLowerCase();
	const title = item.title.toLowerCase();
	const text = `${subjectType} ${source} ${title}`;
	switch (profileId) {
		case "admin":
			return text.includes("template") || text.includes("config") || item.kind === "exception";
		case "operations":
			return item.kind === "exception" || status === "failed" || status === "breached" || status === "escalated" || text.includes("import") || text.includes("notification") || text.includes("source");
		case "auditor":
			return Boolean(item.auditRef) || text.includes("approval") || text.includes("audit") || text.includes("submission");
		case "approver":
			return item.kind === "approval" || text.includes("approval") || text.includes("pricing") || text.includes("gate") || text.includes("submission");
		case "reviewer":
			return item.kind === "comment" || text.includes("review") || text.includes("comment") || text.includes("finding");
		case "writer":
			return item.portalVisible !== true && (
				item.kind === "task" ||
				text.includes("document") ||
				text.includes("section") ||
				text.includes("requirement") ||
				text.includes("evidence")
			);
		case "partner":
			return item.kind === "portal" || item.portalVisible === true || text.includes("partner") || text.includes("external");
		case "proposal_manager":
			return item.kind !== "notification" || status === "failed";
		case "proposal_team":
			return true;
	}
}

function emptyStateForProfile(profileId: RoleHomepageId): string {
	switch (profileId) {
		case "admin":
			return "No template, configuration, or system governance work is currently projected.";
		case "operations":
			return "No operational exceptions, failed jobs, SLA breaches, or source health issues are currently projected.";
		case "auditor":
			return "No audit-linked work is currently projected. Use Audit Explorer for historical reconstruction.";
		case "approver":
			return "No approval decisions are waiting for your authority.";
		case "reviewer":
			return "No review packages, comments, or findings are waiting for review.";
		case "writer":
			return "No writing, requirement, section, or evidence assignments are currently projected.";
		case "partner":
			return "No portal-visible contribution requests are currently assigned.";
		case "proposal_manager":
			return "No active pursuit blockers or next actions are currently projected.";
		case "proposal_team":
			return "No work items are currently projected.";
	}
}
