import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const sessionOrganizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const opportunityId = "33333333-3333-4333-8333-333333333333";
const pipelineId = "44444444-4444-4444-8444-444444444444";
const activityId = "55555555-5555-4555-8555-555555555555";
const gateReviewId = "66666666-6666-4666-8666-666666666666";
const milestoneId = "77777777-7777-4777-8777-777777777777";
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));
vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(async () => ({ content: "{}" })),
	})),
}));
vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
	upsertWorkflowRuntimeTask: vi.fn(),
}));
vi.mock("@/lib/db/schema-pipeline", () => ({
	capturePipeline: {},
	captureActivities: {},
	gateReviews: {},
	pipelineMilestones: {},
	PIPELINE_STAGES: [
		"discovery",
		"qualification",
		"capture",
		"proposal",
		"submitted",
		"evaluation",
		"awarded",
		"lost",
		"no_bid",
		"cancelled",
	],
}));
vi.mock("@/lib/db/schema", () => ({
	opportunities: {},
	opportunityPartners: {},
	partners: {},
}));

import {
	calculateSuggestedPwin,
	completeActivity,
	completeMilestone,
	conductGateReview,
	createMilestone,
	forecastPipeline,
	generateBidDecisionPackage,
	getPipeline,
	getPipelineAnalytics,
	getPipelineSummary,
	getUpcomingActivities,
	identifyAtRiskOpportunities,
	initializePipeline,
	listActivities,
	listGateReviews,
	listMilestones,
	listPipelines,
	recordActivity,
	recordBidDecision,
	scheduleGateReview,
	updateActivity,
	updateGateReview,
	updateMilestone,
	updatePipeline,
	updatePipelineStage,
	updatePwin,
} from "@/lib/actions/pipeline";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("pipeline action auth", () => {
	it("rejects unauthenticated pipeline actions before database access", async () => {
		await expect(initializePipeline(opportunityId)).rejects.toThrow("Unauthorized");
		await expect(getPipeline(opportunityId)).rejects.toThrow("Unauthorized");
		await expect(listPipelines()).rejects.toThrow("Unauthorized");
		await expect(updatePipelineStage(pipelineId, "qualification")).rejects.toThrow("Unauthorized");
		await expect(updatePipeline(pipelineId, { priority: "high" })).rejects.toThrow("Unauthorized");
		await expect(updatePwin(pipelineId, 55, "Capture access improved", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(calculateSuggestedPwin(opportunityId)).rejects.toThrow("Unauthorized");

		await expect(recordActivity(pipelineId, {
			activityType: "customer_meeting",
			title: "Customer meeting",
			createdBy: "spoofed-user",
		})).rejects.toThrow("Unauthorized");
		await expect(updateActivity(activityId, { title: "Updated", createdBy: "spoofed-user" })).rejects.toThrow("Unauthorized");
		await expect(completeActivity(activityId, "Done", 5, ["Follow up"])).rejects.toThrow("Unauthorized");
		await expect(listActivities(pipelineId)).rejects.toThrow("Unauthorized");
		await expect(getUpcomingActivities()).rejects.toThrow("Unauthorized");

		await expect(scheduleGateReview(pipelineId, "bid_no_bid", new Date(), ["Reviewer"])).rejects.toThrow("Unauthorized");
		await expect(updateGateReview(gateReviewId, { status: "in_progress" })).rejects.toThrow("Unauthorized");
		await expect(conductGateReview(gateReviewId, {
			decision: "pass",
			rationale: "Ready",
		})).rejects.toThrow("Unauthorized");
		await expect(listGateReviews(pipelineId)).rejects.toThrow("Unauthorized");

		await expect(generateBidDecisionPackage(pipelineId)).rejects.toThrow("Unauthorized");
		await expect(recordBidDecision(pipelineId, "bid", "Strategic fit", "spoofed-user")).rejects.toThrow("Unauthorized");

		await expect(createMilestone(pipelineId, { name: "Pink team" })).rejects.toThrow("Unauthorized");
		await expect(updateMilestone(milestoneId, { name: "Red team" })).rejects.toThrow("Unauthorized");
		await expect(completeMilestone(milestoneId)).rejects.toThrow("Unauthorized");
		await expect(listMilestones(pipelineId)).rejects.toThrow("Unauthorized");

		await expect(getPipelineAnalytics()).rejects.toThrow("Unauthorized");
		await expect(forecastPipeline()).rejects.toThrow("Unauthorized");
		await expect(identifyAtRiskOpportunities()).rejects.toThrow("Unauthorized");
		await expect(getPipelineSummary(pipelineId)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed pipeline organization filters before database access", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "pipeline-user-1",
			organizationId: sessionOrganizationId,
		});

		await expect(getPipelineAnalytics(otherOrganizationId)).rejects.toThrow("Unauthorized");
		await expect(forecastPipeline(otherOrganizationId)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
