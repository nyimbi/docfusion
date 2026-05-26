import { beforeEach, describe, expect, it, vi } from "vitest";

const recordTransitionMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());
const opportunityActionsMock = vi.hoisted(() => ({
	getSavedSearches: vi.fn(),
	getOpportunities: vi.fn(),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: recordTransitionMock,
}));

vi.mock("@/lib/actions/opportunities", () => opportunityActionsMock);

vi.mock("@/lib/auth-utils", () => {
	const userHasAuthorityRole = (
		context: { role?: string; roles?: string[] },
		requiredRole: string
	) => {
		const roles = new Set([context.role, ...(context.roles ?? [])]
			.filter(Boolean)
			.map((value) => String(value).trim().toLowerCase()));
		return roles.has("admin") || roles.has(requiredRole.trim().toLowerCase());
	};
	return {
		requireUserContext: requireUserContextMock,
		userHasAuthorityRole,
	};
});

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { sendOpportunityDigestWorkflow } from "@/lib/actions/opportunity-digest";

const savedSearch = {
	id: "search-1",
	userId: "pm-1",
	name: "Africa data platforms",
	filters: { search: "data platform" },
	sort: { field: "deadline", direction: "asc" },
	isDefault: true,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const opportunity = {
	id: "00000000-0000-4000-8000-000000000101",
	sourceId: "WB-001",
	title: "National Data Platform",
	category: "ICT",
	countryRegion: "Kenya",
	organization: "World Bank",
	deadline: new Date("2026-06-01T00:00:00.000Z"),
	daysLeft: 27,
	isExpired: false,
	budgetValue: "$5M",
	priorityRank: 5,
	fitScore: 91,
	decisionStatus: "pending",
	assignedTo: null,
	tags: [],
	rfpLink: "https://example.test/rfp",
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "pm-1",
		roles: ["proposal_manager"],
	});
	recordTransitionMock.mockResolvedValue({
		id: "00000000-0000-4000-8000-00000000wf01",
	});
	opportunityActionsMock.getSavedSearches.mockResolvedValue([savedSearch]);
	opportunityActionsMock.getOpportunities.mockResolvedValue({
		data: [opportunity],
		total: 1,
		page: 1,
		pageSize: 5,
		totalPages: 1,
	});
});

describe("sendOpportunityDigestWorkflow", () => {
	it("queues a digest notification from saved search matches", async () => {
		const result = await sendOpportunityDigestWorkflow({
			userId: "pm-1",
			digestDate: "2026-05-05T06:30:00.000Z",
			reason: "Morning digest",
		});

		expect(result).toMatchObject({
			success: true,
			userId: "pm-1",
			state: "queued_for_delivery",
			digestKey: "pm-1:2026-05-05",
			opportunityIds: [opportunity.id],
			savedSearchIds: [savedSearch.id],
			workflowInstanceId: "00000000-0000-4000-8000-00000000wf01",
		});
		expect(opportunityActionsMock.getOpportunities).toHaveBeenCalledWith(
			savedSearch.filters,
			savedSearch.sort,
			{ page: 1, pageSize: 5 }
		);
		expect(recordTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "opportunity_digest",
			subjectType: "opportunity_digest",
			subjectId: "pm-1:2026-05-05",
			toState: "queued_for_delivery",
			eventType: "opportunity_digest_queued",
			actorId: "pm-1",
			assignedTo: "pm-1",
			notificationRecipients: ["pm-1"],
			metadata: expect.objectContaining({
				opportunityIds: [opportunity.id],
				savedSearchIds: [savedSearch.id],
				emptyDigestPolicy: "audit-only-skip-delivery",
			}),
		}));
	});

	it("audits empty digests without queuing delivery", async () => {
		opportunityActionsMock.getOpportunities.mockResolvedValue({
			data: [],
			total: 0,
			page: 1,
			pageSize: 5,
			totalPages: 0,
		});

		const result = await sendOpportunityDigestWorkflow({
			userId: "pm-1",
			digestDate: "2026-05-05T06:30:00.000Z",
		});

		expect(result).toMatchObject({
			success: true,
			state: "skipped_empty",
			opportunityIds: [],
			savedSearchIds: [savedSearch.id],
		});
		expect(recordTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			toState: "skipped_empty",
			eventType: "opportunity_digest_skipped_empty",
			actorId: "pm-1",
			terminal: true,
			notificationRecipients: [],
		}));
	});

	it("rejects attempts to evaluate another user's digest", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "attacker-1",
			roles: ["proposal_manager"],
		});

		await expect(sendOpportunityDigestWorkflow({
			userId: "pm-1",
			digestDate: "2026-05-05T06:30:00.000Z",
		})).rejects.toThrow("Unauthorized");

		expect(opportunityActionsMock.getSavedSearches).not.toHaveBeenCalled();
		expect(recordTransitionMock).not.toHaveBeenCalled();
	});

	it("requires proposal or capture authority before evaluating digest matches", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "pm-1",
			roles: ["writer"],
		});

		await expect(sendOpportunityDigestWorkflow({
			userId: "pm-1",
			digestDate: "2026-05-05T06:30:00.000Z",
		})).rejects.toThrow("Sending opportunity digest requires proposal or capture authority");

		expect(opportunityActionsMock.getSavedSearches).not.toHaveBeenCalled();
		expect(opportunityActionsMock.getOpportunities).not.toHaveBeenCalled();
		expect(recordTransitionMock).not.toHaveBeenCalled();
	});
});
