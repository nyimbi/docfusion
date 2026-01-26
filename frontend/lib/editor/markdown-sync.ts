/**
 * Bidirectional synchronization between ProseMirror/Tiptap JSON and Markdown.
 *
 * This module provides utilities for converting between Tiptap's document
 * structure (ProseMirror JSON) and Markdown text, enabling the split-pane
 * editor experience where users can edit in either view.
 */

import type { DocumentContent, DocumentNode } from "@/lib/types/document";

/**
 * Block node types that create structural breaks in markdown.
 */
const BLOCK_TYPES = new Set([
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"taskList",
	"codeBlock",
	"blockquote",
	"horizontalRule",
	"table",
	"image",
]);

/**
 * Mark types that wrap inline content.
 */
interface Mark {
	type: string;
	attrs?: Record<string, unknown>;
}

/**
 * Text node with optional marks.
 */
interface TextNode {
	type: "text";
	text: string;
	marks?: Mark[];
}

/**
 * Convert a Tiptap document to Markdown string.
 *
 * @param content - The Tiptap document content (ProseMirror JSON)
 * @returns Markdown string representation
 *
 * @example
 * const markdown = contentToMarkdown(editor.getJSON());
 */
export function contentToMarkdown(content: DocumentContent): string {
	if (!content.content) return "";

	const lines: string[] = [];
	let listContext: { type: "bullet" | "ordered" | "task"; index: number }[] = [];

	function processNode(node: DocumentNode, depth: number = 0): void {
		switch (node.type) {
			case "doc":
				node.content?.forEach((child) => processNode(child, depth));
				break;

			case "paragraph":
				lines.push(processInlineContent(node.content) + "\n");
				break;

			case "heading": {
				const level = (node.attrs?.level as number) ?? 1;
				const prefix = "#".repeat(level) + " ";
				lines.push(prefix + processInlineContent(node.content) + "\n");
				break;
			}

			case "bulletList":
				listContext.push({ type: "bullet", index: 0 });
				node.content?.forEach((child) => processNode(child, depth + 1));
				listContext.pop();
				if (depth === 0) lines.push("");
				break;

			case "orderedList":
				listContext.push({ type: "ordered", index: (node.attrs?.start as number) ?? 1 });
				node.content?.forEach((child) => processNode(child, depth + 1));
				listContext.pop();
				if (depth === 0) lines.push("");
				break;

			case "taskList":
				listContext.push({ type: "task", index: 0 });
				node.content?.forEach((child) => processNode(child, depth + 1));
				listContext.pop();
				if (depth === 0) lines.push("");
				break;

			case "listItem": {
				const ctx = listContext[listContext.length - 1];
				const indent = "  ".repeat(listContext.length - 1);
				let prefix: string;

				if (ctx.type === "bullet") {
					prefix = "- ";
				} else if (ctx.type === "ordered") {
					prefix = `${ctx.index}. `;
					ctx.index++;
				} else {
					prefix = "- ";
				}

				const content = node.content
					?.map((child) => {
						if (child.type === "paragraph") {
							return processInlineContent(child.content);
						}
						return "";
					})
					.join(" ");

				lines.push(indent + prefix + (content || "") + "\n");

				// Process nested lists
				node.content?.forEach((child) => {
					if (child.type && BLOCK_TYPES.has(child.type) && child.type !== "paragraph") {
						processNode(child, depth);
					}
				});
				break;
			}

			case "taskItem": {
				const checked = node.attrs?.checked ? "x" : " ";
				const indent = "  ".repeat(listContext.length - 1);
				const content = node.content
					?.map((child) => {
						if (child.type === "paragraph") {
							return processInlineContent(child.content);
						}
						return "";
					})
					.join(" ");

				lines.push(indent + `- [${checked}] ` + (content || "") + "\n");
				break;
			}

			case "codeBlock": {
				const language = (node.attrs?.language as string) ?? "";
				lines.push("```" + language + "\n");
				lines.push((node.content?.[0] as TextNode)?.text ?? "");
				lines.push("\n```\n\n");
				break;
			}

			case "blockquote":
				node.content?.forEach((child) => {
					if (child.type === "paragraph") {
						lines.push("> " + processInlineContent(child.content) + "\n");
					} else {
						processNode(child, depth);
					}
				});
				lines.push("");
				break;

			case "horizontalRule":
				lines.push("---\n\n");
				break;

			case "image": {
				const src = node.attrs?.src as string;
				const alt = (node.attrs?.alt as string) ?? "";
				const title = node.attrs?.title as string;
				if (title) {
					lines.push(`![${alt}](${src} "${title}")\n\n`);
				} else {
					lines.push(`![${alt}](${src})\n\n`);
				}
				break;
			}

			case "table":
				processTable(node);
				break;

			case "hardBreak":
				lines.push("  \n");
				break;

			default:
				// Unknown block type - try to extract text content
				if (node.content) {
					node.content.forEach((child) => processNode(child, depth));
				}
		}
	}

	function processTable(table: DocumentNode): void {
		const rows = table.content ?? [];
		if (rows.length === 0) return;

		const processedRows: string[][] = [];
		let isHeader = true;

		for (const row of rows) {
			if (row.type !== "tableRow") continue;

			const cells: string[] = [];
			for (const cell of row.content ?? []) {
				if (cell.type === "tableHeader" || cell.type === "tableCell") {
					const content = cell.content
						?.map((p) => (p.type === "paragraph" ? processInlineContent(p.content) : ""))
						.join(" ");
					cells.push(content || "");
				}
			}
			processedRows.push(cells);

			// Add header separator after first row
			if (isHeader && cells.length > 0) {
				const separator = cells.map(() => "---");
				processedRows.push(separator);
				isHeader = false;
			}
		}

		// Generate markdown table
		for (const row of processedRows) {
			lines.push("| " + row.join(" | ") + " |\n");
		}
		lines.push("\n");
	}

	function processInlineContent(content?: DocumentNode[]): string {
		if (!content) return "";

		return content
			.map((node) => {
				if (node.type === "text") {
					const textNode = node as unknown as TextNode;
					let text = textNode.text;

					// Apply marks in order
					const marks = textNode.marks ?? [];
					for (const mark of marks) {
						text = applyMark(text, mark);
					}

					return text;
				}

				if (node.type === "hardBreak") {
					return "  \n";
				}

				// Recursively process other inline nodes
				if (node.content) {
					return processInlineContent(node.content);
				}

				return "";
			})
			.join("");
	}

	function applyMark(text: string, mark: Mark): string {
		switch (mark.type) {
			case "bold":
			case "strong":
				return `**${text}**`;
			case "italic":
			case "em":
				return `*${text}*`;
			case "strike":
				return `~~${text}~~`;
			case "code":
				return `\`${text}\``;
			case "underline":
				// Markdown doesn't have underline, use HTML
				return `<u>${text}</u>`;
			case "link": {
				const href = mark.attrs?.href as string;
				const title = mark.attrs?.title as string;
				if (title) {
					return `[${text}](${href} "${title}")`;
				}
				return `[${text}](${href})`;
			}
			case "highlight":
				return `==${text}==`;
			default:
				return text;
		}
	}

	processNode(content);

	// Clean up: remove excessive blank lines
	return lines
		.join("")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Convert Markdown string to Tiptap document content.
 *
 * @param markdown - The Markdown text to parse
 * @returns Tiptap document content (ProseMirror JSON)
 *
 * @example
 * const content = markdownToContent("# Hello\n\nWorld");
 * editor.commands.setContent(content);
 */
export function markdownToContent(markdown: string): DocumentContent {
	const lines = markdown.split("\n");
	const content: DocumentNode[] = [];
	let i = 0;

	function parseLine(): DocumentNode | DocumentNode[] | null {
		if (i >= lines.length) return null;

		const line = lines[i];

		// Empty line
		if (line.trim() === "") {
			i++;
			return null;
		}

		// Heading
		const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
		if (headingMatch) {
			i++;
			return {
				type: "heading",
				attrs: { level: headingMatch[1].length },
				content: parseInlineContent(headingMatch[2]),
			};
		}

		// Horizontal rule
		if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
			i++;
			return { type: "horizontalRule" };
		}

		// Code block
		if (line.startsWith("```")) {
			const language = line.slice(3).trim();
			i++;
			const codeLines: string[] = [];
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // Skip closing ```
			return {
				type: "codeBlock",
				attrs: { language },
				content: [{ type: "text", text: codeLines.join("\n") }],
			};
		}

		// Blockquote
		if (line.startsWith(">")) {
			const quoteLines: string[] = [];
			while (i < lines.length && (lines[i].startsWith(">") || lines[i].trim() === "")) {
				if (lines[i].startsWith(">")) {
					quoteLines.push(lines[i].slice(1).trim());
				}
				i++;
			}
			return {
				type: "blockquote",
				content: quoteLines.map((text) => ({
					type: "paragraph",
					content: parseInlineContent(text),
				})),
			};
		}

		// Task list item
		const taskMatch = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
		if (taskMatch) {
			return parseTaskList();
		}

		// Unordered list
		const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
		if (bulletMatch) {
			return parseBulletList();
		}

		// Ordered list
		const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
		if (orderedMatch) {
			return parseOrderedList();
		}

		// Table
		if (line.includes("|") && line.trim().startsWith("|")) {
			return parseTable();
		}

		// Image (standalone)
		const imageMatch = line.match(/^!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)$/);
		if (imageMatch) {
			i++;
			return {
				type: "image",
				attrs: {
					src: imageMatch[2],
					alt: imageMatch[1],
					title: imageMatch[3] ?? null,
				},
			};
		}

		// Regular paragraph
		i++;
		return {
			type: "paragraph",
			content: parseInlineContent(line),
		};
	}

	function parseTaskList(): DocumentNode {
		const items: DocumentNode[] = [];

		while (i < lines.length) {
			const match = lines[i].match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
			if (!match) break;

			items.push({
				type: "taskItem",
				attrs: { checked: match[2].toLowerCase() === "x" },
				content: [
					{
						type: "paragraph",
						content: parseInlineContent(match[3]),
					},
				],
			});
			i++;
		}

		return {
			type: "taskList",
			content: items,
		};
	}

	function parseBulletList(): DocumentNode {
		const items: DocumentNode[] = [];
		const baseIndent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;

		while (i < lines.length) {
			const indentMatch = lines[i].match(/^(\s*)/);
			const currentIndent = indentMatch?.[1].length ?? 0;

			if (currentIndent < baseIndent) break;

			const match = lines[i].match(/^(\s*)[-*+]\s+(.*)$/);
			if (!match) break;

			if (currentIndent === baseIndent) {
				items.push({
					type: "listItem",
					content: [
						{
							type: "paragraph",
							content: parseInlineContent(match[2]),
						},
					],
				});
				i++;
			} else {
				// Nested list - this is simplified, doesn't handle deep nesting
				i++;
			}
		}

		return {
			type: "bulletList",
			content: items,
		};
	}

	function parseOrderedList(): DocumentNode {
		const items: DocumentNode[] = [];
		let start = 1;
		const baseIndent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
		let isFirst = true;

		while (i < lines.length) {
			const indentMatch = lines[i].match(/^(\s*)/);
			const currentIndent = indentMatch?.[1].length ?? 0;

			if (currentIndent < baseIndent) break;

			const match = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
			if (!match) break;

			if (currentIndent === baseIndent) {
				if (isFirst) {
					start = parseInt(match[2], 10);
					isFirst = false;
				}

				items.push({
					type: "listItem",
					content: [
						{
							type: "paragraph",
							content: parseInlineContent(match[3]),
						},
					],
				});
				i++;
			} else {
				i++;
			}
		}

		return {
			type: "orderedList",
			attrs: { start },
			content: items,
		};
	}

	function parseTable(): DocumentNode {
		const rows: DocumentNode[] = [];
		let isFirstRow = true;

		while (i < lines.length && lines[i].includes("|")) {
			const line = lines[i].trim();

			// Skip separator row
			if (/^\|[\s\-:|]+\|$/.test(line)) {
				i++;
				continue;
			}

			const cells = line
				.split("|")
				.filter((c) => c.trim() !== "")
				.map((c) => c.trim());

			const cellType = isFirstRow ? "tableHeader" : "tableCell";

			rows.push({
				type: "tableRow",
				content: cells.map((cell) => ({
					type: cellType,
					content: [
						{
							type: "paragraph",
							content: parseInlineContent(cell),
						},
					],
				})),
			});

			isFirstRow = false;
			i++;
		}

		return {
			type: "table",
			content: rows,
		};
	}

	function parseInlineContent(text: string): DocumentNode[] {
		if (!text) return [];

		const nodes: DocumentNode[] = [];
		let remaining = text;

		// Pattern for inline elements
		const patterns = [
			// Bold
			{ regex: /\*\*(.+?)\*\*/g, mark: { type: "bold" } },
			{ regex: /__(.+?)__/g, mark: { type: "bold" } },
			// Italic
			{ regex: /\*(.+?)\*/g, mark: { type: "italic" } },
			{ regex: /_(.+?)_/g, mark: { type: "italic" } },
			// Strikethrough
			{ regex: /~~(.+?)~~/g, mark: { type: "strike" } },
			// Code
			{ regex: /`(.+?)`/g, mark: { type: "code" } },
			// Highlight
			{ regex: /==(.+?)==/g, mark: { type: "highlight" } },
			// Link
			{
				regex: /\[(.+?)\]\((.+?)(?:\s+"(.+?)")?\)/g,
				mark: { type: "link" },
				attrs: true,
			},
			// Image (inline)
			{
				regex: /!\[(.+?)\]\((.+?)(?:\s+"(.+?)")?\)/g,
				nodeType: "image",
			},
		];

		// Simple tokenizer - find all matches and their positions
		interface Token {
			start: number;
			end: number;
			content: string;
			mark?: Mark;
			nodeType?: string;
			attrs?: Record<string, unknown>;
		}

		const tokens: Token[] = [];

		for (const pattern of patterns) {
			const regex = new RegExp(pattern.regex);
			let match;

			while ((match = regex.exec(text)) !== null) {
				const token: Token = {
					start: match.index,
					end: match.index + match[0].length,
					content: match[1],
				};

				if (pattern.nodeType) {
					token.nodeType = pattern.nodeType;
					token.attrs = {
						src: match[2],
						alt: match[1],
						title: match[3] ?? null,
					};
				} else if (pattern.attrs && pattern.mark.type === "link") {
					token.mark = {
						type: "link",
						attrs: {
							href: match[2],
							title: match[3] ?? null,
						},
					};
				} else {
					token.mark = pattern.mark;
				}

				tokens.push(token);
			}
		}

		// Sort tokens by position
		tokens.sort((a, b) => a.start - b.start);

		// Build nodes, handling overlapping tokens by taking the first one
		let pos = 0;
		const usedRanges: { start: number; end: number }[] = [];

		for (const token of tokens) {
			// Check if this token overlaps with any used range
			const overlaps = usedRanges.some(
				(range) => token.start < range.end && token.end > range.start
			);
			if (overlaps) continue;

			// Add plain text before this token
			if (token.start > pos) {
				const plainText = text.slice(pos, token.start);
				if (plainText) {
					nodes.push({ type: "text", text: plainText } as DocumentNode);
				}
			}

			// Add the token
			if (token.nodeType === "image") {
				nodes.push({
					type: "image",
					attrs: token.attrs,
				} as DocumentNode);
			} else if (token.mark) {
				nodes.push({
					type: "text",
					text: token.content,
					marks: [token.mark],
				} as unknown as DocumentNode);
			}

			usedRanges.push({ start: token.start, end: token.end });
			pos = token.end;
		}

		// Add remaining plain text
		if (pos < text.length) {
			const plainText = text.slice(pos);
			if (plainText) {
				nodes.push({ type: "text", text: plainText } as DocumentNode);
			}
		}

		// If no tokens were found, return plain text
		if (nodes.length === 0 && text) {
			nodes.push({ type: "text", text } as DocumentNode);
		}

		return nodes;
	}

	// Parse all lines
	while (i < lines.length) {
		const node = parseLine();
		if (node) {
			if (Array.isArray(node)) {
				content.push(...node);
			} else {
				content.push(node);
			}
		}
	}

	// Ensure at least one paragraph
	if (content.length === 0) {
		content.push({ type: "paragraph", content: [] });
	}

	return {
		type: "doc",
		content,
	};
}

/**
 * MarkdownSync class for managing bidirectional synchronization.
 *
 * This class tracks the last synced state and provides methods to
 * sync changes between Tiptap and Markdown without infinite loops.
 */
export class MarkdownSync {
	private lastTiptapContent: string = "";
	private lastMarkdown: string = "";
	private isUpdating: boolean = false;

	/**
	 * Called when Tiptap content changes.
	 * Returns the new Markdown if it's different, null otherwise.
	 */
	updateFromTiptap(content: DocumentContent): string | null {
		if (this.isUpdating) return null;

		const contentJson = JSON.stringify(content);
		if (contentJson === this.lastTiptapContent) return null;

		this.isUpdating = true;
		try {
			const markdown = contentToMarkdown(content);
			if (markdown !== this.lastMarkdown) {
				this.lastTiptapContent = contentJson;
				this.lastMarkdown = markdown;
				return markdown;
			}
			return null;
		} finally {
			this.isUpdating = false;
		}
	}

	/**
	 * Called when Markdown changes.
	 * Returns the new content if it's different, null otherwise.
	 */
	updateFromMarkdown(markdown: string): DocumentContent | null {
		if (this.isUpdating) return null;

		if (markdown === this.lastMarkdown) return null;

		this.isUpdating = true;
		try {
			const content = markdownToContent(markdown);
			const contentJson = JSON.stringify(content);
			if (contentJson !== this.lastTiptapContent) {
				this.lastMarkdown = markdown;
				this.lastTiptapContent = contentJson;
				return content;
			}
			return null;
		} finally {
			this.isUpdating = false;
		}
	}

	/**
	 * Reset the sync state.
	 */
	reset(): void {
		this.lastTiptapContent = "";
		this.lastMarkdown = "";
		this.isUpdating = false;
	}

	/**
	 * Get the current Markdown.
	 */
	getMarkdown(): string {
		return this.lastMarkdown;
	}

	/**
	 * Set initial state without triggering sync.
	 */
	initialize(content: DocumentContent): string {
		const markdown = contentToMarkdown(content);
		this.lastTiptapContent = JSON.stringify(content);
		this.lastMarkdown = markdown;
		return markdown;
	}
}

/**
 * Create a new MarkdownSync instance.
 */
export function createMarkdownSync(): MarkdownSync {
	return new MarkdownSync();
}

/**
 * Calculate a diff summary between two markdown strings.
 * Useful for showing what changed.
 */
export function getMarkdownDiff(
	oldMarkdown: string,
	newMarkdown: string
): { added: number; removed: number; changed: boolean } {
	const oldLines = oldMarkdown.split("\n");
	const newLines = newMarkdown.split("\n");

	const oldSet = new Set(oldLines);
	const newSet = new Set(newLines);

	let added = 0;
	let removed = 0;

	for (const line of newLines) {
		if (!oldSet.has(line)) added++;
	}

	for (const line of oldLines) {
		if (!newSet.has(line)) removed++;
	}

	return {
		added,
		removed,
		changed: added > 0 || removed > 0,
	};
}
