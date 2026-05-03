import type { DocumentContent } from "@/lib/types/document";

const EMPTY_DOCUMENT: DocumentContent = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

function paragraphs(text: string): DocumentContent {
	const blocks = text
		.split(/\n{2,}/)
		.map((part) => part.trim())
		.filter(Boolean);

	return {
		type: "doc",
		content: blocks.length > 0
			? blocks.map((block) => ({
					type: "paragraph",
					content: [{ type: "text", text: block }],
				}))
			: [{ type: "paragraph" }],
	};
}

export function normalizeSnippetContent(content: DocumentContent | string | unknown): DocumentContent {
	if (typeof content === "string") {
		try {
			return normalizeSnippetContent(JSON.parse(content));
		} catch {
			return paragraphs(content);
		}
	}

	if (!content || typeof content !== "object" || Array.isArray(content)) {
		return EMPTY_DOCUMENT;
	}

	const record = content as DocumentContent;
	if (record.type === "doc") {
		return {
			...record,
			content: Array.isArray(record.content) ? record.content : [],
		};
	}

	if (typeof record.type === "string") {
		return {
			type: "doc",
			content: [record],
		};
	}

	return EMPTY_DOCUMENT;
}

export function extractPlainTextFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map(extractPlainTextFromContent).filter(Boolean).join("\n");
	}
	if (content && typeof content === "object") {
		const record = content as Record<string, unknown>;
		if (record.type === "hardBreak") return "\n";
		const ownText = typeof record.text === "string" ? record.text : "";
		if (ownText) return ownText;
		if (Array.isArray(record.content)) {
			const separator =
				record.type === "doc" ||
				record.type === "bulletList" ||
				record.type === "orderedList"
					? "\n"
					: "";
			return record.content
				.map(extractPlainTextFromContent)
				.filter(Boolean)
				.join(separator);
		}
	}
	return "";
}

export function normalizeSnippetPayload(content: DocumentContent | string | unknown) {
	const normalized = normalizeSnippetContent(content);
	const plainTextPreview = extractPlainTextFromContent(normalized).trim();
	return {
		content: normalized,
		plainTextPreview,
	};
}
