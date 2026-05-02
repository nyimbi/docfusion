import { beforeEach, describe, expect, it, vi } from "vitest";

const contextMock = vi.hoisted(() => ({
	loadSnippetPlaceholderContext: vi.fn(),
}));

const companyVariableMock = vi.hoisted(() => ({
	getAllTemplateVariables: vi.fn(),
}));

const aiMock = vi.hoisted(() => ({
	chat: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn(),
	},
	templateSnippets: {
		id: "template_snippets.id",
		shortcut: "template_snippets.shortcut",
	},
}));

vi.mock("@/lib/placeholders/context-resolution", () => contextMock);
vi.mock("@/lib/actions/company-variables", () => companyVariableMock);
vi.mock("@/lib/ai/client", () => aiMock);

import {
	adaptResolvedSnippet,
	resolveSnippetContent,
} from "@/lib/snippets/resolve-snippet-content";
import {
	findUnresolvedPlaceholders,
	substitutePlaceholdersInString,
} from "@/lib/placeholders/substitution";

describe("snippet placeholder resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		contextMock.loadSnippetPlaceholderContext.mockResolvedValue({
			values: {
				client_name: "Acme Health",
				opportunity_name: "Digital Casework Modernisation",
			},
			valueSources: {
				client_name: "opportunity.organization",
				opportunity_name: "opportunity.title",
			},
			diagnostics: [],
		});
		companyVariableMock.getAllTemplateVariables.mockResolvedValue({
			company_name: "Datacraft",
		});
	});

	it("substitutes deterministic values and reports unresolved placeholders", async () => {
		const resolved = await resolveSnippetContent({
			content:
				"{{company_name}} will help {{client_name}} deliver {{opportunity_name}} for {{missing_scope}}.",
			placeholders: [
				{
					id: "missing_scope",
					name: "Missing scope",
					variableName: "missing_scope",
					type: "text",
					required: true,
				},
			],
			documentId: "doc-1",
			opportunityId: "opp-1",
		});

		expect(resolved.plainTextPreview).toBe(
			"Datacraft will help Acme Health deliver Digital Casework Modernisation for {{missing_scope}}."
		);
		expect(resolved.resolvedValues).toMatchObject({
			company_name: "Datacraft",
			client_name: "Acme Health",
			opportunity_name: "Digital Casework Modernisation",
		});
		expect(resolved.valueSources.client_name).toBe("opportunity.organization");
		expect(resolved.unresolvedPlaceholders).toEqual([
			expect.objectContaining({
				key: "missing_scope",
				token: "{{missing_scope}}",
			}),
		]);
	});

	it("lets request values override context values", async () => {
		const resolved = await resolveSnippetContent({
			content: "Client: {{client_name}}. Company: {{company_name}}.",
			placeholderValues: {
				client_name: "Explicit Client",
				company_name: "Explicit Company",
			},
		});

		expect(resolved.plainTextPreview).toBe("Client: Explicit Client. Company: Explicit Company.");
		expect(resolved.valueSources.client_name).toBe("request.placeholderValues");
		expect(resolved.valueSources.company_name).toBe("request.placeholderValues");
	});

	it("adapts only after deterministic resolution and preserves unresolved tokens", async () => {
		aiMock.chat.mockResolvedValue({
			content:
				"Datacraft will shape a compliant Acme Health response while preserving {{missing_scope}} for confirmation.",
		});

		const resolved = await resolveSnippetContent({
			content:
				"{{company_name}} supports {{client_name}}. Confirm {{missing_scope}}.",
		});

		const adapted = await adaptResolvedSnippet({
			resolved,
			richContext: {
				requirementText: "Describe the delivery approach.",
				sectionTitle: "Technical Approach",
				surroundingText: "The section explains delivery governance.",
			},
		});

		expect(aiMock.chat).toHaveBeenCalledTimes(1);
		expect(adapted.plainTextPreview).toContain("Datacraft");
		expect(adapted.plainTextPreview).toContain("Acme Health");
		expect(adapted.plainTextPreview).toContain("{{missing_scope}}");
		const prompt = aiMock.chat.mock.calls[0][0][1].content;
		expect(prompt).toContain("Requirement: Describe the delivery approach.");
		expect(prompt).toContain("Section: Technical Approach");
		expect(prompt).toContain("Surrounding text: The section explains delivery governance.");
		expect(adapted.unresolvedPlaceholders).toEqual(
			expect.arrayContaining([expect.objectContaining({ key: "missing_scope" })])
		);
		expect(adapted.adaptationNotes).toEqual(
			expect.arrayContaining([
				"Adapted after deterministic placeholder resolution.",
				"Used selected requirement text.",
				"Used surrounding text for continuity.",
			])
		);
	});

	it("falls back to deterministic content when AI adaptation fails", async () => {
		aiMock.chat.mockRejectedValue(new Error("provider unavailable"));

		const resolved = await resolveSnippetContent({
			content: "{{company_name}} supports {{client_name}}.",
		});

		const adapted = await adaptResolvedSnippet({
			resolved,
			richContext: {
				requirementText: "Explain implementation governance.",
			},
		});

		expect(adapted.adaptedContent).toEqual(resolved.resolvedContent);
		expect(adapted.plainTextPreview).toBe(resolved.plainTextPreview);
		expect(adapted.diagnostics).toEqual([
			expect.objectContaining({
				code: "aiAdaptationUnavailable",
				message: "provider unavailable",
			}),
		]);
	});

	it("uses placeholder defaults after context and company variables", async () => {
		contextMock.loadSnippetPlaceholderContext.mockResolvedValueOnce({
			values: {},
			valueSources: {},
			diagnostics: [],
		});
		companyVariableMock.getAllTemplateVariables.mockResolvedValueOnce({});

		const resolved = await resolveSnippetContent({
			content: "Delivery model: {{delivery_model}}.",
			placeholders: [
				{
					id: "delivery_model",
					name: "Delivery model",
					variableName: "{{ delivery_model }}",
					type: "text",
					required: false,
					defaultValue: "hybrid agile delivery",
				},
			],
		});

		expect(resolved.plainTextPreview).toBe("Delivery model: hybrid agile delivery.");
		expect(resolved.valueSources.delivery_model).toBe("placeholder.defaultValue");
		expect(resolved.placeholderMetadata[0]).toMatchObject({
			key: "delivery_model",
			variableName: "delivery_model",
		});
	});

	it("normalizes moustache placeholders in plain strings", () => {
		const result = substitutePlaceholdersInString("Hello {{ client.name }}", {
			"client.name": "Nairobi County",
		});

		expect(result.text).toBe("Hello Nairobi County");
		expect(result.unresolved).toEqual([]);
		expect(findUnresolvedPlaceholders({ text: "{{client_name}}" })).toEqual([
			expect.objectContaining({ key: "client_name" }),
		]);
	});
});
