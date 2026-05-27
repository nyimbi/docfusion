import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn(async () => ({ content: "[]" })));
const revalidatePathMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
	onValues?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "set"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
}

function expectAssignedOpportunityTenantScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("presentations-user-1");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain("11111111-1111-4111-8111-111111111111");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/ai/client", () => ({
	complete: completeMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

import {
	anticipateQuestions,
	createPresentation,
	generateAnswerSuggestion,
	generatePracticeFeedback,
	generateSpeakerNotes,
	generateSlidesFromProposal,
} from "@/lib/actions/presentations";

const opportunityId = "33333333-3333-4333-8333-333333333333";
const presentationId = "44444444-4444-4444-8444-444444444444";
const proposalDocumentId = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "presentations-user-1",
		organizationId: "11111111-1111-4111-8111-111111111111",
	});
	completeMock.mockResolvedValue({ content: "[]" });
});

describe("presentation opportunity scoping", () => {
	it("checks assigned opportunity visibility before creating presentations", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		const result = await createPresentation(opportunityId, {
			title: "Oral presentation",
		});

		expect(result).toEqual({ success: false, error: "Opportunity not found" });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expectAssignedOpportunityTenantScope(opportunityWhere);
	});

	it("scopes Q&A requirement context to assigned opportunities", async () => {
		let requirementsWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					audienceDescription: "Evaluation panel",
					evaluationCriteria: [],
				}],
			}))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					requirementsWhere = value;
				},
			}));

		const result = await anticipateQuestions(presentationId);

		expect(result).toEqual({ success: true, data: [] });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
		expectAssignedOpportunityTenantScope(requirementsWhere);
	});

	it("falls back to deterministic Q&A when AI returns no usable questions for slide context", async () => {
		completeMock.mockResolvedValueOnce({ content: "[]" });
		const insertedQuestions: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					audienceDescription: "Evaluation panel",
					evaluationCriteria: [{
						criterion: "Technical Approach",
						weight: 60,
						description: "Migration execution plan",
					}],
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "slide-1",
					presentationId,
					slideNumber: 1,
					title: "Technical Approach",
					content: [{ type: "bullet", data: ["Phased migration", "Risk controls"] }],
				}],
			}))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.insert.mockImplementation(() => createChain({
			result: [{
				id: `qa-${insertedQuestions.length + 1}`,
				presentationId,
			}],
			onValues: (value) => insertedQuestions.push(value),
		}));

		const result = await anticipateQuestions(presentationId);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(insertedQuestions.length).toBeGreaterThan(0);
		expect(insertedQuestions).toEqual(expect.arrayContaining([
			expect.objectContaining({
				likelyQuestion: expect.stringContaining("technical approach"),
				questionCategory: "technical",
				isReviewed: false,
			}),
		]));
		expect(result.data.length).toBe(insertedQuestions.length);
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
	});

	it("scopes slide generation proposal reads through assigned opportunities", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					timeLimit: 60,
					qaTimeLimit: 15,
					audienceDescription: "Evaluation panel",
					evaluationCriteria: [],
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await generateSlidesFromProposal(presentationId, proposalDocumentId);

		expect(result).toEqual({ success: false, error: "Proposal document not found" });
		expect(wheres).toHaveLength(1);
		expectAssignedOpportunityTenantScope(wheres[0]);
	});

	it("falls back to a deterministic slide deck when AI returns an empty slide array", async () => {
		completeMock.mockResolvedValueOnce({ content: "[]" });
		const insertedSlides: unknown[] = [];
		const presentationUpdateChain = createChain();
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					description: "Cloud migration proposal oral presentation",
					timeLimit: 30,
					qaTimeLimit: 10,
					audienceDescription: "Evaluation panel",
					evaluationCriteria: [{
						criterion: "Technical Approach",
						weight: 60,
						description: "Migration execution plan",
					}],
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: proposalDocumentId,
					documentId: "doc-1",
					opportunityId,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "doc-1",
					plainText: "Cloud migration approach with governance, staffing, risk controls, and transition milestones.",
					content: {},
				}],
			}));
		dbMock.insert.mockImplementation(() => createChain({
			result: [{ id: `slide-${insertedSlides.length + 1}`, presentationId }],
			onValues: (value) => insertedSlides.push(value),
		}));
		dbMock.update.mockReturnValueOnce(presentationUpdateChain);

		const result = await generateSlidesFromProposal(presentationId, proposalDocumentId);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(insertedSlides.length).toBeGreaterThan(0);
		expect(insertedSlides).toEqual(expect.arrayContaining([
			expect.objectContaining({
				slideType: "title",
				title: "Oral presentation",
			}),
			expect.objectContaining({
				title: "Agenda",
			}),
		]));
		expect(presentationUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({
			slideCount: insertedSlides.length,
			sourceProposalId: proposalDocumentId,
		}));
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
	});

	it("falls back to a key-point answer when AI returns blank content", async () => {
		completeMock.mockResolvedValueOnce({ content: "   " });
		const updateChain = createChain();
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: "qa-1",
					presentationId,
					likelyQuestion: "How will you control transition risk?",
					questionCategory: "risk",
					difficulty: "medium",
					relatedSlideIds: null,
					keyPoints: ["Use a phased transition plan", "Track risks weekly"],
					thingsToAvoid: [],
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					audienceDescription: "Evaluation panel",
				}],
			}));
		dbMock.update.mockReturnValueOnce(updateChain);

		const result = await generateAnswerSuggestion("qa-1");

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toContain("Thank you for that question");
		expect(result.data).toContain("use a phased transition plan");
		expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
			suggestedAnswer: result.data,
		}));
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
	});

	it("falls back to deterministic speaker notes when AI returns blank content", async () => {
		completeMock.mockResolvedValueOnce({ content: "\n\t " });
		const updateChain = createChain();
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: "slide-1",
					presentationId,
					slideNumber: 2,
					slideType: "content",
					title: "Transition Approach",
					content: [{
						type: "bullet",
						data: ["Phased cutover", "Weekly risk review"],
					}],
					estimatedDuration: 120,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					audienceDescription: "Evaluation panel",
				}],
			}));
		dbMock.update.mockReturnValueOnce(updateChain);

		const result = await generateSpeakerNotes("slide-1");

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toContain("[SLIDE: Transition Approach]");
		expect(result.data).toContain("- Phased cutover");
		expect(result.data).toContain("TRANSITION:");
		expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
			speakerNotes: result.data,
		}));
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
	});

	it("falls back to deterministic practice feedback when AI returns blank content", async () => {
		completeMock.mockResolvedValueOnce({ content: "  \n\t" });
		const updateChain = createChain();
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: "recording-1",
					presentationId,
					duration: 540,
					overallScore: 82,
					pacingAnalysis: { averageWPM: 145, pauseScore: 80 },
					fillerWordAnalysis: [{ word: "um", count: 2 }],
					contentCoverage: [{ slideNumber: 1, coverageScore: 90 }],
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					audienceDescription: "Evaluation panel",
				}],
			}));
		dbMock.update.mockReturnValueOnce(updateChain);

		const result = await generatePracticeFeedback("recording-1");

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toContain("Practice Session Complete");
		expect(result.data).toContain("9 minutes");
		expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
			aiFeedback: result.data,
		}));
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
	});
});
