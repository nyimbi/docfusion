import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((left, right) => ({ op: "eq", left, right })));
const andMock = vi.hoisted(() => vi.fn((...conditions) => ({ op: "and", conditions })));

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

function createChain(result: unknown[] = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "orderBy", "offset", "values", "set", "returning"]) {
		chain[method] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(result);
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema-presentations", () => ({
	oralPresentations: {
		id: "oralPresentations.id",
		organizationId: "oralPresentations.organizationId",
		opportunityId: "oralPresentations.opportunityId",
		title: "oralPresentations.title",
		description: "oralPresentations.description",
		status: "oralPresentations.status",
		presentationDate: "oralPresentations.presentationDate",
		updatedAt: "oralPresentations.updatedAt",
	},
	presentationSlides: {
		id: "presentationSlides.id",
		presentationId: "presentationSlides.presentationId",
		slideNumber: "presentationSlides.slideNumber",
		isHidden: "presentationSlides.isHidden",
	},
	presentationQA: {
		id: "presentationQA.id",
		presentationId: "presentationQA.presentationId",
		probability: "presentationQA.probability",
	},
	practiceRecordings: {
		id: "practiceRecordings.id",
		presentationId: "practiceRecordings.presentationId",
		recordedAt: "practiceRecordings.recordedAt",
	},
	presentationTeam: {
		id: "presentationTeam.id",
		presentationId: "presentationTeam.presentationId",
	},
}));
vi.mock("@/lib/db/schema", () => ({
	opportunities: { id: "opportunities.id" },
	proposalDocuments: { id: "proposalDocuments.id", documentId: "proposalDocuments.documentId" },
	documents: { id: "documents.id" },
}));
vi.mock("@/lib/db/schema-rfp", () => ({
	rfpRequirements: { opportunityId: "rfpRequirements.opportunityId" },
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
	or: vi.fn((...conditions) => ({ op: "or", conditions })),
	ilike: vi.fn((left, right) => ({ op: "ilike", left, right })),
	desc: vi.fn((field) => ({ op: "desc", field })),
	asc: vi.fn((field) => ({ op: "asc", field })),
	inArray: vi.fn((field, values) => ({ op: "inArray", field, values })),
	gte: vi.fn((left, right) => ({ op: "gte", left, right })),
	lte: vi.fn((left, right) => ({ op: "lte", left, right })),
	sql: vi.fn((strings, ...values) => ({ strings, values })),
}));
vi.mock("@/lib/ai/client", () => ({
	complete: vi.fn(),
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { exportPresentation } from "@/lib/actions/presentations";

const presentation = {
	id: "44444444-4444-4444-8444-444444444444",
	opportunityId: "33333333-3333-4333-8333-333333333333",
	organizationId: "11111111-1111-4111-8111-111111111111",
	title: "Datacraft Oral Presentation",
	description: "Evaluation-ready implementation narrative",
	presentationDate: new Date("2026-06-15T12:00:00Z"),
	venue: "Virtual",
	isVirtual: true,
	theme: "default",
	customBranding: {
		primaryColor: "#123456",
		secondaryColor: "#2563eb",
		fontFamily: "Aptos",
	},
};

const slides = [
	{
		id: "slide-1",
		presentationId: presentation.id,
		slideNumber: 1,
		slideType: "title",
		title: "Why Datacraft Wins",
		content: [
			{ type: "text", data: "Our implementation plan directly maps to evaluator outcomes." },
			{ type: "bullet", data: ["Mobilize in 30 days", "Reduce reporting latency by 40%"] },
		],
		speakerNotes: "Open with the evidence-backed delivery story.",
		layout: "default",
		backgroundImage: null,
		backgroundColor: "#ffffff",
	},
];

const team = [
	{
		id: "team-1",
		presentationId: presentation.id,
		name: "Amina Lead",
		role: "Capture manager",
		assignedSlideIds: ["slide-1"],
	},
];

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "presentations-user-1",
		organizationId: presentation.organizationId,
	});
	dbMock.select
		.mockReturnValueOnce(createChain([presentation]))
		.mockReturnValueOnce(createChain(slides))
		.mockReturnValueOnce(createChain([]))
		.mockReturnValueOnce(createChain(team))
		.mockReturnValueOnce(createChain([]));
});

describe("presentation export artifacts", () => {
	it.each([
		["html", "data:text/html;charset=utf-8;base64,"],
		["pdf", "data:application/pdf;base64,"],
		["pptx", "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,"],
	] as const)("generates a real %s download artifact", async (format, expectedPrefix) => {
		const result = await exportPresentation(presentation.id, format);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.downloadUrl).toMatch(new RegExp(`^${expectedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
		expect(result.data.downloadUrl).not.toContain("/api/presentations/export");
		expect(result.data.filename).toMatch(new RegExp(`^presentation-${presentation.id.slice(0, 8)}-.*\\.${format}$`));
		expect(result.data.mimeType.length).toBeGreaterThan(0);
	});

	it("includes slide content and speaker notes in HTML exports", async () => {
		const result = await exportPresentation(presentation.id, "html");

		expect(result.success).toBe(true);
		if (!result.success) return;
		const encoded = result.data.downloadUrl.split(",")[1] ?? "";
		const html = Buffer.from(encoded, "base64").toString("utf8");
		expect(html).toContain("Datacraft Oral Presentation");
		expect(html).toContain("Why Datacraft Wins");
		expect(html).toContain("Mobilize in 30 days");
		expect(html).toContain("Open with the evidence-backed delivery story.");
		expect(html).toContain("Amina Lead");
	});
});
