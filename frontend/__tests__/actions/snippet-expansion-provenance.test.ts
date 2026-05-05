import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: vi.fn(async () => ({
		user: { id: "writer-1", organizationId: "org-1" },
	})),
}));

const resolverMock = vi.hoisted(() => ({
	resolveSnippetContent: vi.fn(),
	adaptResolvedSnippet: vi.fn(),
}));

vi.mock("@/lib/snippets/resolve-snippet-content", () => resolverMock);

function createChain(result: unknown[] = []) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit", "set"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
	templateSnippets: {
		id: "template_snippets.id",
		name: "template_snippets.name",
		shortcut: "template_snippets.shortcut",
		content: "template_snippets.content",
		placeholders: "template_snippets.placeholders",
		description: "template_snippets.description",
		tags: "template_snippets.tags",
		category: "template_snippets.category",
		createdBy: "template_snippets.createdBy",
		organizationId: "template_snippets.organizationId",
		useCount: "template_snippets.useCount",
		isPublic: "template_snippets.isPublic",
		createdAt: "template_snippets.createdAt",
		updatedAt: "template_snippets.updatedAt",
	},
}));

import { expandShortcut } from "@/lib/actions/snippets";

const snippetRow = {
	id: "snippet-1",
	name: "Executive Summary",
	shortcut: "/dc-exec-summary",
	content: {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text: "{{client_name}}" }] }],
	},
	placeholders: [{
		id: "client_name",
		name: "Client name",
		key: "client_name",
		variableName: "client_name",
		type: "text",
		required: true,
	}],
	description: "Datacraft executive summary",
	tags: ["datacraft"],
	category: "proposal",
	createdBy: "writer-1",
	organizationId: "org-1",
	useCount: 7,
	isPublic: true,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select
		.mockReturnValueOnce(createChain([snippetRow]))
		.mockReturnValueOnce(createChain([{ useCount: 7 }]));
	dbMock.update.mockReturnValue(createChain());
	resolverMock.resolveSnippetContent.mockResolvedValue({
		snippetId: "snippet-1",
		shortcut: "/dc-exec-summary",
		originalContent: snippetRow.content,
		resolvedContent: {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "Acme Health" }] }],
		},
		plainTextPreview: "Acme Health",
		unresolvedPlaceholders: [{ key: "delivery_model", token: "{{delivery_model}}", path: "content.0" }],
		resolvedValues: { client_name: "Acme Health" },
		valueSources: { client_name: "opportunity.organization" },
		placeholderMetadata: snippetRow.placeholders,
		diagnostics: [],
	});
	resolverMock.adaptResolvedSnippet.mockResolvedValue({
		adaptedContent: {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "Acme Health adapted" }] }],
		},
		plainTextPreview: "Acme Health adapted",
		unresolvedPlaceholders: [{ key: "delivery_model", token: "{{delivery_model}}", path: "content.0" }],
		adaptationNotes: [
			"Adapted after deterministic placeholder resolution.",
			"Used selected requirement text.",
		],
		diagnostics: [],
	});
});

describe("shortcut expansion provenance", () => {
	it("returns source, adaptation, context, and unresolved placeholder metadata", async () => {
		const expansion = await expandShortcut({
			shortcut: "/dc-exec-summary",
			documentId: "doc-1",
			opportunityId: "opp-1",
			requirementId: "req-1",
			requirementText: "Describe governance.",
			surroundingText: "This section describes implementation controls.",
			sectionTitle: "Technical Approach",
		});

		expect(expansion).not.toBeNull();
		expect(expansion?.plainTextPreview).toBe("Acme Health adapted");
		expect(expansion?.adaptationNotes).toEqual([
			"Adapted after deterministic placeholder resolution.",
			"Used selected requirement text.",
		]);
		expect(expansion?.provenance).toMatchObject({
			snippetId: "snippet-1",
			shortcut: "/dc-exec-summary",
			placeholderCount: 1,
			resolvedKeys: ["client_name"],
			unresolvedKeys: ["delivery_model"],
			valueSources: { client_name: "opportunity.organization" },
			adaptation: {
				usedAI: true,
				notes: [
					"Adapted after deterministic placeholder resolution.",
					"Used selected requirement text.",
				],
			},
			context: {
				documentId: "doc-1",
				opportunityId: "opp-1",
				requirementId: "req-1",
				hasRequirementText: true,
				hasSurroundingText: true,
				sectionTitle: "Technical Approach",
			},
		});
		expect(expansion?.provenance?.resolvedAt).toEqual(expect.any(String));
	});
});
