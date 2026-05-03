import { describe, expect, it } from "vitest";

import {
	extractPlainTextFromContent,
	normalizeSnippetContent,
	normalizeSnippetPayload,
} from "@/lib/snippets/content-normalization";

describe("snippet content normalization", () => {
	it("converts legacy string snippets to Tiptap document content", () => {
		const normalized = normalizeSnippetContent("A first paragraph.\n\nA second paragraph.");

		expect(normalized).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "A first paragraph." }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "A second paragraph." }],
				},
			],
		});
		expect(extractPlainTextFromContent(normalized)).toBe(
			"A first paragraph.\nA second paragraph."
		);
	});

	it("returns a plain-text preview alongside normalized content", () => {
		const payload = normalizeSnippetPayload({
			type: "doc",
			content: [
				{
					type: "heading",
					content: [{ type: "text", text: "Executive Summary" }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "Datacraft delivery narrative." }],
				},
			],
		});

		expect(payload.plainTextPreview).toBe(
			"Executive Summary\nDatacraft delivery narrative."
		);
	});
});
