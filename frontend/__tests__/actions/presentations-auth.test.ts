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

function createChain(result: unknown = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "orderBy", "offset", "values", "set", "returning"]) {
		chain[method] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(Array.isArray(result) ? result : [result]);
	chain.then = (resolve: (value: unknown) => void) =>
		Promise.resolve(Array.isArray(result) ? result : [result]).then(resolve);
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

import {
	createPresentation,
	listPresentations,
	recordPractice,
} from "@/lib/actions/presentations";

const sessionContext = {
	userId: "presentation-user-1",
	organizationId: "11111111-1111-4111-8111-111111111111",
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue(sessionContext);
	dbMock.select.mockImplementation(() => createChain([]));
	dbMock.insert.mockImplementation(() => createChain([]));
	dbMock.update.mockImplementation(() => createChain([]));
	dbMock.delete.mockImplementation(() => createChain([]));
});

describe("presentation action auth", () => {
	it("rejects unauthenticated presentation creation before database access", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await createPresentation("22222222-2222-4222-8222-222222222222", {
			title: "Oral presentation",
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("binds created presentations to the session organization and actor", async () => {
		const insertChain = createChain([
			{
				id: "presentation-1",
				opportunityId: "22222222-2222-4222-8222-222222222222",
				title: "Oral presentation",
				organizationId: sessionContext.organizationId,
				createdBy: sessionContext.userId,
			},
		]);

		dbMock.select.mockReturnValueOnce(createChain([{ id: "opportunity-1" }]));
		dbMock.insert.mockReturnValueOnce(insertChain);

		const result = await createPresentation("22222222-2222-4222-8222-222222222222", {
			title: "Oral presentation",
		});

		expect(result.success).toBe(true);
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: sessionContext.organizationId,
				createdBy: sessionContext.userId,
			})
		);
	});

	it("scopes presentation lists to the session organization", async () => {
		await listPresentations();

		expect(eqMock).toHaveBeenCalledWith(
			"oralPresentations.organizationId",
			sessionContext.organizationId
		);
	});

	it("records practice sessions as the session actor", async () => {
		const insertChain = createChain([
			{
				id: "recording-1",
				presentationId: "presentation-1",
				recordedBy: sessionContext.userId,
			},
		]);

		dbMock.select.mockReturnValueOnce(createChain([
			{
				id: "presentation-1",
				organizationId: sessionContext.organizationId,
			},
		]));
		dbMock.insert.mockReturnValueOnce(insertChain);

		const result = await recordPractice(
			"presentation-1",
			"https://example.test/recording.mp4",
			600,
			{ recordedBy: "spoofed-user" }
		);

		expect(result.success).toBe(true);
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				recordedBy: sessionContext.userId,
			})
		);
	});
});
