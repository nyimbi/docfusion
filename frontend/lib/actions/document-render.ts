/**
 * Document Render Server Actions - DocFusion
 *
 * Server actions for rendering documents to various export formats
 * (PDF, DOCX, PPTX, LaTeX) with branding support.
 */

"use server";

import { db } from "@/lib/db";
import { getCurrentUserId, requireUserContext, type UserContext } from "@/lib/auth-utils";
import { documents, proposalDocuments, opportunities } from "@/lib/db/schema";
import { eq, and, or, sql, type SQL } from "drizzle-orm";
import type { JSONContent } from "@tiptap/react";
import type {
	ExportFormat,
	RenderOptions,
	RenderResult,
	BrandingConfig,
	PreSubmissionAudit,
	AuditCheck,
	ProposalDocumentType,
	ProposalDocumentStatus,
} from "@/lib/types/opportunity";
import { tiptapToLatex } from "@/lib/render/latex-converter";
import { tiptapToDocx } from "@/lib/render/docx-converter";
import { tiptapToPptx, estimateSlideCount } from "@/lib/render/pptx-converter";
import {
	hasBlockingDlpFindings,
	scanDocumentForDlpFindings,
	summarizeDlpFindings,
	type DlpSeverity,
} from "@/lib/security/dlp-policy";

// ============================================================================
// Constants
// ============================================================================

const MIME_TYPES: Record<ExportFormat, string> = {
	pdf: "application/pdf",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	latex: "application/x-latex",
	markdown: "text/markdown",
	html: "text/html",
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
	pdf: ".pdf",
	docx: ".docx",
	pptx: ".pptx",
	latex: ".tex",
	markdown: ".md",
	html: ".html",
};

// Required document types for a complete proposal
const REQUIRED_DOCUMENT_TYPES: ProposalDocumentType[] = [
	"executive_summary",
	"technical_approach",
	"management_plan",
	"cost_proposal",
];

type DocumentRenderUserContext = UserContext & { organizationId: string };

// ============================================================================
// Helper Functions
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

async function requireCurrentUserContext(): Promise<DocumentRenderUserContext> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
	return userContext as DocumentRenderUserContext;
}

function readableDocumentCondition(documentId: string, userId: string): SQL {
	return and(
		eq(documents.id, documentId),
		or(
			eq(documents.ownerId, userId),
			eq(documents.visibility, "public"),
			sql`${documents.collaboratorIds} ? ${userId}`
		)!
	)!;
}

function assignedOpportunityCondition(userContext: DocumentRenderUserContext): SQL {
	return sql`(
		opportunities.organization_id = ${userContext.organizationId}
		or opportunities.organization_id is null
	) and opportunities.assigned_to = ${userContext.userId}`;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userContext: DocumentRenderUserContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (
				opportunities.organization_id = ${userContext.organizationId}
				or opportunities.organization_id is null
			)
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, userContext: DocumentRenderUserContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityCondition(userContext)
	)!;
}

function visibleProposalDocumentsForOpportunityCondition(
	opportunityId: string,
	userContext: DocumentRenderUserContext
): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

/**
 * Get document content from database.
 */
async function getDocumentContent(documentId: string, userId: string): Promise<{
	content: JSONContent;
	title: string;
	wordCount: number;
} | null> {
	const [doc] = await db
		.select({
			content: documents.content,
			title: documents.title,
			wordCount: documents.wordCount,
		})
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);

	if (!doc) return null;

	return {
		content: doc.content as JSONContent,
		title: doc.title,
		wordCount: doc.wordCount || 0,
	};
}

/**
 * Generate a safe filename from document title.
 */
function generateFilename(title: string, format: ExportFormat): string {
	const safeTitle = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 50);

	const timestamp = new Date().toISOString().slice(0, 10);
	return `${safeTitle}-${timestamp}${FILE_EXTENSIONS[format]}`;
}

/**
 * Convert content to Markdown format.
 */
function tiptapToMarkdown(content: JSONContent): string {
	const convertNode = (node: JSONContent, depth: number = 0): string => {
		switch (node.type) {
			case "heading": {
				const level = node.attrs?.level || 1;
				const text = node.content?.map((c) => c.text || "").join("") || "";
				return `${"#".repeat(level)} ${text}\n\n`;
			}
			case "paragraph": {
				const text = node.content?.map((c) => {
					let t = c.text || "";
					if (c.marks) {
						for (const mark of c.marks) {
							if (mark.type === "bold") t = `**${t}**`;
							if (mark.type === "italic") t = `*${t}*`;
							if (mark.type === "code") t = `\`${t}\``;
							if (mark.type === "link") t = `[${t}](${mark.attrs?.href || ""})`;
						}
					}
					return t;
				}).join("") || "";
				return text ? `${text}\n\n` : "\n";
			}
			case "bulletList": {
				return (node.content || []).map((item) => {
					const text = item.content?.map((c) => convertNode(c, depth + 1)).join("").trim() || "";
					return `${"  ".repeat(depth)}- ${text}`;
				}).join("\n") + "\n\n";
			}
			case "orderedList": {
				return (node.content || []).map((item, i) => {
					const text = item.content?.map((c) => convertNode(c, depth + 1)).join("").trim() || "";
					return `${"  ".repeat(depth)}${i + 1}. ${text}`;
				}).join("\n") + "\n\n";
			}
			case "blockquote": {
				const text = (node.content || []).map((c) => convertNode(c, depth)).join("").trim();
				return `> ${text.replace(/\n/g, "\n> ")}\n\n`;
			}
			case "codeBlock": {
				const lang = node.attrs?.language || "";
				const code = node.content?.[0]?.text || "";
				return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
			}
			case "horizontalRule":
				return "---\n\n";
			case "image": {
				const src = node.attrs?.src || "";
				const alt = node.attrs?.alt || "";
				return `![${alt}](${src})\n\n`;
			}
			case "table": {
				const rows = node.content || [];
				if (rows.length === 0) return "";

				const tableRows = rows.map((row) => {
					const cells = (row.content || []).map((cell) => {
						return cell.content?.map((c) => c.text || "").join("").trim() || "";
					});
					return `| ${cells.join(" | ")} |`;
				});

				// Add header separator
				if (tableRows.length > 0) {
					const colCount = rows[0].content?.length || 1;
					const separator = `| ${Array(colCount).fill("---").join(" | ")} |`;
					tableRows.splice(1, 0, separator);
				}

				return tableRows.join("\n") + "\n\n";
			}
			default:
				if (node.content) {
					return node.content.map((c) => convertNode(c, depth)).join("");
				}
				return "";
		}
	};

	return (content.content || []).map((n) => convertNode(n)).join("");
}

/**
 * Convert content to HTML format.
 */
function tiptapToHtml(content: JSONContent, options: RenderOptions): string {
	const convertNode = (node: JSONContent): string => {
		switch (node.type) {
			case "heading": {
				const level = node.attrs?.level || 1;
				const text = convertInline(node.content);
				return `<h${level}>${text}</h${level}>\n`;
			}
			case "paragraph": {
				const text = convertInline(node.content);
				return `<p>${text}</p>\n`;
			}
			case "bulletList": {
				const items = (node.content || []).map((item) => {
					const text = (item.content || []).map(convertNode).join("");
					return `<li>${text.trim()}</li>`;
				});
				return `<ul>\n${items.join("\n")}\n</ul>\n`;
			}
			case "orderedList": {
				const items = (node.content || []).map((item) => {
					const text = (item.content || []).map(convertNode).join("");
					return `<li>${text.trim()}</li>`;
				});
				return `<ol>\n${items.join("\n")}\n</ol>\n`;
			}
			case "blockquote": {
				const text = (node.content || []).map(convertNode).join("");
				return `<blockquote>${text}</blockquote>\n`;
			}
			case "codeBlock": {
				const lang = node.attrs?.language || "";
				const code = escapeHtml(node.content?.[0]?.text || "");
				return `<pre><code class="language-${lang}">${code}</code></pre>\n`;
			}
			case "horizontalRule":
				return "<hr>\n";
			case "image": {
				const src = node.attrs?.src || "";
				const alt = escapeHtml(node.attrs?.alt || "");
				return `<img src="${src}" alt="${alt}">\n`;
			}
			case "table": {
				const rows = (node.content || []).map((row, i) => {
					const cells = (row.content || []).map((cell) => {
						const isHeader = cell.type === "tableHeader";
						const tag = isHeader ? "th" : "td";
						const text = (cell.content || []).map(convertNode).join("").trim();
						return `<${tag}>${text}</${tag}>`;
					});
					return `<tr>${cells.join("")}</tr>`;
				});
				return `<table>\n${rows.join("\n")}\n</table>\n`;
			}
			default:
				if (node.content) {
					return node.content.map(convertNode).join("");
				}
				return "";
		}
	};

	const convertInline = (content: JSONContent[] | undefined): string => {
		if (!content) return "";
		return content.map((node) => {
			if (node.type === "text") {
				let text = escapeHtml(node.text || "");
				if (node.marks) {
					for (const mark of node.marks) {
						if (mark.type === "bold") text = `<strong>${text}</strong>`;
						if (mark.type === "italic") text = `<em>${text}</em>`;
						if (mark.type === "underline") text = `<u>${text}</u>`;
						if (mark.type === "strike") text = `<s>${text}</s>`;
						if (mark.type === "code") text = `<code>${text}</code>`;
						if (mark.type === "link") text = `<a href="${mark.attrs?.href || ""}">${text}</a>`;
					}
				}
				return text;
			}
			if (node.type === "hardBreak") return "<br>";
			return "";
		}).join("");
	};

	const escapeHtml = (text: string): string => {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	};

	const body = (content.content || []).map(convertNode).join("");
	const title = options.metadata?.title || "Document";
	const branding = options.branding;

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    h1, h2, h3 { color: ${branding?.primaryColor || "#1a1a1a"}; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 4px solid ${branding?.primaryColor || "#ddd"}; margin: 0; padding-left: 1em; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 0.5em; text-align: left; }
    th { background: #f4f4f4; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

type PdfTextBlock = {
	type: "heading" | "paragraph" | "listItem" | "code" | "quote" | "tableRow" | "rule" | "image";
	text: string;
	spans?: PdfTextSpan[];
	level?: number;
	indent?: number;
	src?: string;
	alt?: string;
	width?: number;
	height?: number;
};

type PdfTextSpan = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	code?: boolean;
	link?: string;
};

function normalizePdfText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function extractTextFromNode(node: JSONContent): string {
	if (node.type === "text") {
		return node.text || "";
	}
	if (node.type === "hardBreak") {
		return "\n";
	}
	return (node.content || []).map(extractTextFromNode).join("");
}

function extractSpansFromNode(node: JSONContent): PdfTextSpan[] {
	if (node.type === "text") {
		const span: PdfTextSpan = { text: node.text || "" };
		for (const mark of node.marks || []) {
			if (mark.type === "bold") span.bold = true;
			if (mark.type === "italic") span.italic = true;
			if (mark.type === "code") span.code = true;
			if (mark.type === "link") span.link = mark.attrs?.href;
		}
		return span.text ? [span] : [];
	}
	if (node.type === "hardBreak") {
		return [{ text: "\n" }];
	}
	return (node.content || []).flatMap(extractSpansFromNode);
}

function textFromSpans(spans: PdfTextSpan[]): string {
	return normalizePdfText(spans.map((span) => span.text).join(""));
}

function extractListBlocks(node: JSONContent, ordered: boolean, depth = 0): PdfTextBlock[] {
	return (node.content || []).flatMap((item, index) => {
		const childBlocks: PdfTextBlock[] = [];
		const directSpans = (item.content || [])
			.filter((child) => child.type === "paragraph")
			.flatMap(extractSpansFromNode);
		const label = ordered ? `${index + 1}.` : "-";
		childBlocks.push({
			type: "listItem",
			text: `${label} ${textFromSpans(directSpans)}`,
			spans: [{ text: `${label} ` }, ...directSpans],
			indent: depth,
		});
		for (const child of item.content || []) {
			if (child.type === "bulletList") {
				childBlocks.push(...extractListBlocks(child, false, depth + 1));
			}
			if (child.type === "orderedList") {
				childBlocks.push(...extractListBlocks(child, true, depth + 1));
			}
		}
		return childBlocks;
	}).filter((block) => block.text.trim() !== "-" && !/^\d+\.$/.test(block.text.trim()));
}

function extractPdfBlocks(content: JSONContent): PdfTextBlock[] {
	const convertNode = (node: JSONContent): PdfTextBlock[] => {
		switch (node.type) {
			case "heading": {
				const headingSpans = extractSpansFromNode(node);
				return [{
					type: "heading",
					level: Number(node.attrs?.level || 1),
					text: textFromSpans(headingSpans),
					spans: headingSpans,
				}];
			}
			case "paragraph": {
				const spans = extractSpansFromNode(node);
				const text = textFromSpans(spans);
				return text ? [{ type: "paragraph", text, spans }] : [];
			}
			case "bulletList":
				return extractListBlocks(node, false);
			case "orderedList":
				return extractListBlocks(node, true);
			case "blockquote": {
				const spans = extractSpansFromNode(node);
				const text = textFromSpans(spans);
				return text ? [{ type: "quote", text, spans }] : [];
			}
			case "codeBlock": {
				const text = node.content?.[0]?.text?.trim() || "";
				return text ? [{ type: "code", text }] : [];
			}
			case "table":
				return (node.content || []).map((row): PdfTextBlock => ({
					type: "tableRow",
					text: (row.content || [])
						.map((cell) => normalizePdfText(extractTextFromNode(cell)))
						.filter(Boolean)
						.join(" | "),
				})).filter((block) => block.text);
			case "image": {
				const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
				const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
				const text = alt ? `Image: ${alt}` : src ? `Image: ${src}` : "Image";
				return [{
					type: "image",
					text,
					src,
					alt,
					width: typeof node.attrs?.width === "number" ? node.attrs.width : undefined,
					height: typeof node.attrs?.height === "number" ? node.attrs.height : undefined,
				}];
			}
			case "horizontalRule":
				return [{ type: "rule", text: "" }];
			default:
				return (node.content || []).flatMap(convertNode);
		}
	};

	return (content.content || []).flatMap(convertNode);
}

function parseHexColor(value: string | undefined, fallback: [number, number, number]): [number, number, number] {
	if (!value) return fallback;
	const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
	if (!match) return fallback;
	const hex = match[1];
	return [
		Number.parseInt(hex.slice(0, 2), 16),
		Number.parseInt(hex.slice(2, 4), 16),
		Number.parseInt(hex.slice(4, 6), 16),
	];
}

async function buildPdfBuffer(
	doc: { content: JSONContent; title: string; wordCount: number },
	options: RenderOptions
): Promise<{ buffer: Buffer; pageCount: number }> {
	const { jsPDF } = await import("jspdf");
	const orientation = options.orientation === "landscape" ? "landscape" : "portrait";
	const format = options.paperSize === "a4" || options.paperSize === "legal" ? options.paperSize : "letter";
	const pdf = new jsPDF({ orientation, unit: "pt", format });
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();
	const margins = {
		top: (options.margins?.top ?? 0.75) * 72,
		bottom: (options.margins?.bottom ?? 0.75) * 72,
		left: (options.margins?.left ?? 0.75) * 72,
		right: (options.margins?.right ?? 0.75) * 72,
	};
	const bodyWidth = pageWidth - margins.left - margins.right;
	const title = options.metadata?.title || doc.title;
	const [brandR, brandG, brandB] = parseHexColor(options.branding?.primaryColor, [31, 41, 55]);
	const [mutedR, mutedG, mutedB] = parseHexColor(options.branding?.secondaryColor, [75, 85, 99]);

	pdf.setProperties({
		title,
		author: options.metadata?.author || options.branding?.companyName || "DocFusion",
		subject: options.metadata?.subject,
		keywords: options.metadata?.keywords?.join(", "),
		creator: "DocFusion",
	});

	let y = margins.top;
	let currentPage = 1;
	const pageNumbers: number[] = [1];

	const setSpanFont = (span: PdfTextSpan, fallbackStyle: "normal" | "bold" | "italic" = "normal") => {
		const family = span.code ? "courier" : "helvetica";
		const style = span.bold && span.italic ? "bolditalic" : span.bold ? "bold" : span.italic ? "italic" : fallbackStyle;
		pdf.setFont(family, style);
		if (span.link) {
			pdf.setTextColor(37, 99, 235);
		}
	};

	const addWatermark = () => {
		if (!options.watermark) return;
		pdf.setFont("helvetica", "bold");
		pdf.setFontSize(58);
		pdf.setTextColor(229, 231, 235);
		pdf.text(options.watermark, pageWidth / 2, pageHeight / 2, {
			align: "center",
			angle: -35,
		});
	};

	const addHeaderFooter = () => {
		addWatermark();
		if (options.includeHeader || options.headerContent || options.branding?.companyName) {
			pdf.setFont("helvetica", "normal");
			pdf.setFontSize(9);
			pdf.setTextColor(mutedR, mutedG, mutedB);
			pdf.text(options.headerContent || options.branding?.companyName || title, margins.left, margins.top - 22, {
				maxWidth: bodyWidth,
			});
		}
		if (options.includeFooter || options.footerContent || options.includePageNumbers !== false) {
			pdf.setFont("helvetica", "normal");
			pdf.setFontSize(9);
			pdf.setTextColor(mutedR, mutedG, mutedB);
			const footerText = [
				options.footerContent,
				options.includePageNumbers !== false ? `Page ${currentPage}` : null,
			].filter(Boolean).join("    ");
			pdf.text(footerText, margins.left, pageHeight - Math.max(24, margins.bottom / 2), {
				maxWidth: bodyWidth,
			});
		}
	};

	const addPageIfNeeded = (requiredHeight: number) => {
		if (y + requiredHeight <= pageHeight - margins.bottom) return;
		pdf.addPage();
		currentPage += 1;
		pageNumbers.push(currentPage);
		y = margins.top;
	};

	const writeWrappedText = (
		text: string,
		x: number,
		maxWidth: number,
		lineHeight: number,
		afterSpacing: number
	) => {
		const lines = pdf.splitTextToSize(text, maxWidth) as string[];
		for (const line of lines) {
			addPageIfNeeded(lineHeight);
			pdf.text(line, x, y);
			y += lineHeight;
		}
		addPageIfNeeded(afterSpacing);
		y += afterSpacing;
	};

	const writeRichText = (
		spans: PdfTextSpan[] | undefined,
		x: number,
		maxWidth: number,
		fontSize: number,
		lineHeight: number,
		afterSpacing: number,
		fallbackStyle: "normal" | "bold" | "italic",
		color: [number, number, number]
	) => {
		if (!spans || spans.length === 0) return;
		let cursorX = x;
		addPageIfNeeded(lineHeight);
		for (const span of spans) {
			const tokens = span.text.split(/(\s+)/).filter((token) => token.length > 0);
			for (const token of tokens) {
				if (token.includes("\n")) {
					y += lineHeight;
					cursorX = x;
					addPageIfNeeded(lineHeight);
					continue;
				}
				pdf.setFontSize(fontSize);
				pdf.setTextColor(...color);
				setSpanFont(span, fallbackStyle);
				const width = pdf.getTextWidth(token);
				if (!/^\s+$/.test(token) && cursorX > x && cursorX + width > x + maxWidth) {
					y += lineHeight;
					cursorX = x;
					addPageIfNeeded(lineHeight);
				}
				pdf.text(token, cursorX, y);
				cursorX += width;
			}
		}
		y += lineHeight;
		addPageIfNeeded(afterSpacing);
		y += afterSpacing;
	};

	const writeTableOfContents = (blocks: PdfTextBlock[]) => {
		if (!options.includeTableOfContents) return;
		const headings = blocks.filter((block) => block.type === "heading" && block.text);
		if (headings.length === 0) return;
		pdf.setFont("helvetica", "bold");
		pdf.setFontSize(14);
		pdf.setTextColor(brandR, brandG, brandB);
		writeWrappedText("Table of Contents", margins.left, bodyWidth, 18, 8);
		for (const heading of headings) {
			const indent = Math.max(0, (heading.level || 1) - 1) * 14;
			pdf.setFont("helvetica", heading.level === 1 ? "bold" : "normal");
			pdf.setFontSize(10);
			pdf.setTextColor(17, 24, 39);
			writeWrappedText(heading.text, margins.left + indent, bodyWidth - indent, 13, 2);
		}
		y += 10;
	};

	const renderImageBlock = (block: PdfTextBlock) => {
		addPageIfNeeded(120);
		const src = block.src || "";
		const imageType = src.match(/^data:image\/(png|jpe?g|webp);base64,/i)?.[1]?.toUpperCase().replace("JPG", "JPEG");
		if (imageType) {
			try {
				const requestedWidth = block.width && block.width > 0 ? block.width : bodyWidth;
				const requestedHeight = block.height && block.height > 0 ? block.height : requestedWidth * 0.56;
				const displayWidth = Math.min(bodyWidth, requestedWidth);
				const displayHeight = Math.min(pageHeight - margins.bottom - y, requestedHeight * (displayWidth / requestedWidth));
				pdf.addImage(src, imageType, margins.left, y, displayWidth, Math.max(48, displayHeight));
				y += Math.max(48, displayHeight) + 8;
				if (block.alt) {
					pdf.setFont("helvetica", "italic");
					pdf.setFontSize(9);
					pdf.setTextColor(75, 85, 99);
					writeWrappedText(block.alt, margins.left, bodyWidth, 12, 8);
				}
				return;
			} catch {
				// Fall through to a textual image reference so the artifact does not lose content.
			}
		}
		pdf.setFont("helvetica", "italic");
		pdf.setFontSize(10);
		pdf.setTextColor(75, 85, 99);
		writeWrappedText(block.src ? `${block.text} (${block.src})` : block.text, margins.left, bodyWidth, 14, 8);
	};

	pdf.setFont("helvetica", "bold");
	pdf.setFontSize(22);
	pdf.setTextColor(brandR, brandG, brandB);
	writeWrappedText(title, margins.left, bodyWidth, 26, 18);

	if (options.metadata?.author || options.branding?.companyName) {
		pdf.setFont("helvetica", "normal");
		pdf.setFontSize(10);
		pdf.setTextColor(mutedR, mutedG, mutedB);
		writeWrappedText(options.metadata?.author || options.branding?.companyName || "", margins.left, bodyWidth, 13, 16);
	}

	const blocks = extractPdfBlocks(doc.content);
	writeTableOfContents(blocks);

	for (const block of blocks) {
		switch (block.type) {
			case "heading": {
				const fontSize = block.level === 1 ? 18 : block.level === 2 ? 15 : 13;
				pdf.setFont("helvetica", "bold");
				pdf.setFontSize(fontSize);
				pdf.setTextColor(brandR, brandG, brandB);
				writeRichText(block.spans, margins.left, bodyWidth, fontSize, fontSize + 5, 10, "bold", [brandR, brandG, brandB]);
				break;
			}
			case "listItem": {
				const indent = (block.indent || 0) * 18;
				pdf.setFont("helvetica", "normal");
				pdf.setFontSize(11);
				pdf.setTextColor(17, 24, 39);
				writeRichText(block.spans, margins.left + indent, bodyWidth - indent, 11, 15, 5, "normal", [17, 24, 39]);
				break;
			}
			case "quote":
				pdf.setFont("helvetica", "italic");
				pdf.setFontSize(11);
				pdf.setTextColor(55, 65, 81);
				writeRichText(block.spans, margins.left + 16, bodyWidth - 16, 11, 15, 8, "italic", [55, 65, 81]);
				break;
			case "code":
				pdf.setFont("courier", "normal");
				pdf.setFontSize(9);
				pdf.setTextColor(31, 41, 55);
				writeWrappedText(block.text, margins.left + 12, bodyWidth - 12, 12, 8);
				break;
			case "tableRow":
				pdf.setFont("helvetica", "normal");
				pdf.setFontSize(9);
				pdf.setTextColor(17, 24, 39);
				writeWrappedText(block.text, margins.left, bodyWidth, 13, 5);
				break;
			case "rule":
				addPageIfNeeded(14);
				pdf.setDrawColor(209, 213, 219);
				pdf.line(margins.left, y, pageWidth - margins.right, y);
				y += 14;
				break;
			case "image":
				renderImageBlock(block);
				break;
			case "paragraph":
			default:
				pdf.setFont("helvetica", "normal");
				pdf.setFontSize(11);
				pdf.setTextColor(17, 24, 39);
				writeRichText(block.spans, margins.left, bodyWidth, 11, 15, 8, "normal", [17, 24, 39]);
				break;
		}
	}

	for (const page of pageNumbers) {
		pdf.setPage(page);
		currentPage = page;
		addHeaderFooter();
	}

	const pdfBytes = pdf.output("arraybuffer") as ArrayBuffer;
	return {
		buffer: Buffer.from(pdfBytes),
		pageCount: pageNumbers.length,
	};
}

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render document to PDF.
 */
export async function renderToPDF(
	documentId: string,
	options: RenderOptions = { format: "pdf" }
): Promise<RenderResult> {
	const userId = await requireCurrentUserId();
	const startTime = Date.now();

	try {
		const doc = await getDocumentContent(documentId, userId);
		if (!doc) {
			return { success: false, format: "pdf", error: "Document not found" };
		}

		const { buffer, pageCount } = await buildPdfBuffer(doc, {
			...options,
			metadata: {
				...options.metadata,
				title: options.metadata?.title || doc.title,
			},
		});

		return {
			success: true,
			format: "pdf",
			data: buffer.toString("base64"),
			size: buffer.length,
			mimeType: MIME_TYPES.pdf,
			filename: generateFilename(doc.title, "pdf"),
			renderTimeMs: Date.now() - startTime,
			pageCount,
		};
	} catch (error) {
		return {
			success: false,
			format: "pdf",
			error: error instanceof Error ? error.message : "Render failed",
		};
	}
}

/**
 * Render document to DOCX format.
 */
export async function renderToDOCX(
	documentId: string,
	options: RenderOptions = { format: "docx" }
): Promise<RenderResult> {
	const userId = await requireCurrentUserId();
	const startTime = Date.now();

	try {
		const doc = await getDocumentContent(documentId, userId);
		if (!doc) {
			return { success: false, format: "docx", error: "Document not found" };
		}

		const buffer = await tiptapToDocx(doc.content, {
			...options,
			metadata: {
				...options.metadata,
				title: options.metadata?.title || doc.title,
			},
		});

		return {
			success: true,
			format: "docx",
			data: buffer.toString("base64"),
			size: buffer.length,
			mimeType: MIME_TYPES.docx,
			filename: generateFilename(doc.title, "docx"),
			renderTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			success: false,
			format: "docx",
			error: error instanceof Error ? error.message : "Render failed",
		};
	}
}

/**
 * Render document to PPTX format.
 */
export async function renderToPPTX(
	documentId: string,
	options: RenderOptions = { format: "pptx" }
): Promise<RenderResult> {
	const userId = await requireCurrentUserId();
	const startTime = Date.now();

	try {
		const doc = await getDocumentContent(documentId, userId);
		if (!doc) {
			return { success: false, format: "pptx", error: "Document not found" };
		}

		const buffer = await tiptapToPptx(doc.content, {
			...options,
			metadata: {
				...options.metadata,
				title: options.metadata?.title || doc.title,
			},
		});

		const pageCount = estimateSlideCount(doc.content);

		return {
			success: true,
			format: "pptx",
			data: buffer.toString("base64"),
			size: buffer.length,
			mimeType: MIME_TYPES.pptx,
			filename: generateFilename(doc.title, "pptx"),
			renderTimeMs: Date.now() - startTime,
			pageCount,
		};
	} catch (error) {
		return {
			success: false,
			format: "pptx",
			error: error instanceof Error ? error.message : "Render failed",
		};
	}
}

/**
 * Render document to LaTeX source.
 */
export async function renderToLaTeX(
	documentId: string,
	options: RenderOptions = { format: "latex" }
): Promise<RenderResult> {
	const userId = await requireCurrentUserId();
	const startTime = Date.now();

	try {
		const doc = await getDocumentContent(documentId, userId);
		if (!doc) {
			return { success: false, format: "latex", error: "Document not found" };
		}

		const latex = tiptapToLatex(doc.content, {
			...options,
			metadata: {
				...options.metadata,
				title: options.metadata?.title || doc.title,
			},
		});

		const buffer = Buffer.from(latex, "utf-8");

		return {
			success: true,
			format: "latex",
			data: buffer.toString("base64"),
			size: buffer.length,
			mimeType: MIME_TYPES.latex,
			filename: generateFilename(doc.title, "latex"),
			renderTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			success: false,
			format: "latex",
			error: error instanceof Error ? error.message : "Render failed",
		};
	}
}

/**
 * Render document to Markdown.
 */
export async function renderToMarkdown(
	documentId: string,
	options: RenderOptions = { format: "markdown" }
): Promise<RenderResult> {
	const userId = await requireCurrentUserId();
	const startTime = Date.now();

	try {
		const doc = await getDocumentContent(documentId, userId);
		if (!doc) {
			return { success: false, format: "markdown", error: "Document not found" };
		}

		const markdown = tiptapToMarkdown(doc.content);
		const buffer = Buffer.from(markdown, "utf-8");

		return {
			success: true,
			format: "markdown",
			data: buffer.toString("base64"),
			size: buffer.length,
			mimeType: MIME_TYPES.markdown,
			filename: generateFilename(doc.title, "markdown"),
			renderTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			success: false,
			format: "markdown",
			error: error instanceof Error ? error.message : "Render failed",
		};
	}
}

/**
 * Render document to HTML.
 */
export async function renderToHTML(
	documentId: string,
	options: RenderOptions = { format: "html" }
): Promise<RenderResult> {
	const userId = await requireCurrentUserId();
	const startTime = Date.now();

	try {
		const doc = await getDocumentContent(documentId, userId);
		if (!doc) {
			return { success: false, format: "html", error: "Document not found" };
		}

		const html = tiptapToHtml(doc.content, {
			...options,
			metadata: {
				...options.metadata,
				title: options.metadata?.title || doc.title,
			},
		});

		const buffer = Buffer.from(html, "utf-8");

		return {
			success: true,
			format: "html",
			data: buffer.toString("base64"),
			size: buffer.length,
			mimeType: MIME_TYPES.html,
			filename: generateFilename(doc.title, "html"),
			renderTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			success: false,
			format: "html",
			error: error instanceof Error ? error.message : "Render failed",
		};
	}
}

/**
 * Unified render function that dispatches to appropriate format.
 */
export async function renderDocument(
	documentId: string,
	options: RenderOptions
): Promise<RenderResult> {
	await requireCurrentUserId();

	switch (options.format) {
		case "pdf":
			return renderToPDF(documentId, options);
		case "docx":
			return renderToDOCX(documentId, options);
		case "pptx":
			return renderToPPTX(documentId, options);
		case "latex":
			return renderToLaTeX(documentId, options);
		case "markdown":
			return renderToMarkdown(documentId, options);
		case "html":
			return renderToHTML(documentId, options);
		default:
			return {
				success: false,
				format: options.format,
				error: `Unsupported format: ${options.format}`,
			};
	}
}

// ============================================================================
// Pre-Submission Audit
// ============================================================================

/**
 * Run pre-submission audit for an opportunity.
 * Checks all proposal documents for completeness and quality.
 */
export async function preSubmissionAudit(
	opportunityId: string
): Promise<PreSubmissionAudit> {
	const currentUserContext = await requireCurrentUserContext();

	const checks: AuditCheck[] = [];
	const issues: string[] = [];
	const recommendations: string[] = [];

	// Get opportunity
	const [opportunity] = await db
		.select({
			id: opportunities.id,
			title: opportunities.title,
			deadline: opportunities.deadline,
			decisionStatus: opportunities.decisionStatus,
		})
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, currentUserContext))
		.limit(1);

	if (!opportunity) {
		return {
			opportunityId,
			isReady: false,
			readinessScore: 0,
			checks: [],
			documents: [],
			missingDocuments: REQUIRED_DOCUMENT_TYPES,
			issues: ["Opportunity not found"],
			recommendations: [],
			auditedAt: new Date(),
		};
	}

	// Get proposal documents
	const propDocs = await db
		.select({
			id: proposalDocuments.id,
			documentId: proposalDocuments.documentId,
			documentType: proposalDocuments.documentType,
			status: proposalDocuments.status,
			dueDate: proposalDocuments.dueDate,
			aiAnalysisScore: proposalDocuments.aiAnalysisScore,
			documentTitle: documents.title,
			wordCount: documents.wordCount,
			content: documents.content,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(proposalDocuments.documentId, documents.id))
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, currentUserContext));

	// Check for missing required documents
	const existingTypes = new Set(propDocs.map((d) => d.documentType));
	const missingDocuments = REQUIRED_DOCUMENT_TYPES.filter(
		(t) => !existingTypes.has(t)
	);

	if (missingDocuments.length > 0) {
		checks.push({
			id: "missing-docs",
			name: "Required Documents",
			category: "completeness",
			passed: false,
			severity: "error",
			message: `Missing ${missingDocuments.length} required document(s): ${missingDocuments.join(", ")}`,
		});
		issues.push(`Missing required documents: ${missingDocuments.join(", ")}`);
	} else {
		checks.push({
			id: "missing-docs",
			name: "Required Documents",
			category: "completeness",
			passed: true,
			severity: "info",
			message: "All required documents present",
		});
	}

	// Analyze each document
	const documentResults: PreSubmissionAudit["documents"] = [];

	for (const doc of propDocs) {
		const docIssues: string[] = [];
		let isReady = true;

		// Check status
		if (!["approved", "final"].includes(doc.status)) {
			docIssues.push(`Status is "${doc.status}", not approved or final`);
			isReady = false;
		}

		// Check word count (minimum 100 words for meaningful content)
		if (!doc.wordCount || doc.wordCount < 100) {
			docIssues.push("Document appears to be incomplete (< 100 words)");
			isReady = false;
		}

		// Check AI analysis score
		if (doc.aiAnalysisScore !== null && doc.aiAnalysisScore < 70) {
			docIssues.push(`Quality score (${doc.aiAnalysisScore}) below threshold (70)`);
			isReady = false;
		}

		const dlpFindings = scanDocumentForDlpFindings({
			documentId: doc.documentId,
			title: doc.documentTitle,
			content: doc.content,
		});
		if (dlpFindings.length) {
			const summary = summarizeDlpFindings(dlpFindings);
			if (hasBlockingDlpFindings(dlpFindings)) {
				docIssues.push(`Blocking DLP findings: ${summary}`);
				issues.push(`${doc.documentTitle}: blocking DLP findings (${summary})`);
				isReady = false;
			} else {
				recommendations.push(`${doc.documentTitle}: review advisory DLP findings (${summary})`);
			}
			for (const finding of dlpFindings) {
				checks.push({
					id: `dlp-${finding.id}`,
					name: `${doc.documentTitle}: ${finding.label}`,
					category: "compliance",
					passed: !isBlockingDlpSeverity(finding.severity),
					severity: auditSeverityForDlp(finding.severity),
					message: `${finding.excerpt} - ${finding.recommendation}`,
					documentId: doc.documentId,
				});
			}
		}

		documentResults.push({
			id: doc.id,
			title: doc.documentTitle,
			type: doc.documentType as ProposalDocumentType,
			status: doc.status as ProposalDocumentStatus,
			isReady,
			issues: docIssues,
		});

		// Add checks for this document
		if (!isReady) {
			checks.push({
				id: `doc-${doc.id}`,
				name: doc.documentTitle,
				category: "completeness",
				passed: false,
				severity: "warning",
				message: docIssues.join("; "),
				documentId: doc.documentId,
			});
		}
	}

	// Check deadline
	if (opportunity.deadline) {
		const now = new Date();
		const daysUntil = Math.floor(
			(opportunity.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);

		if (daysUntil < 0) {
			checks.push({
				id: "deadline",
				name: "Submission Deadline",
				category: "compliance",
				passed: false,
				severity: "error",
				message: `Deadline has passed (${Math.abs(daysUntil)} days ago)`,
			});
			issues.push("Submission deadline has passed");
		} else if (daysUntil <= 1) {
			checks.push({
				id: "deadline",
				name: "Submission Deadline",
				category: "compliance",
				passed: true,
				severity: "warning",
				message: `Deadline is ${daysUntil === 0 ? "today" : "tomorrow"}`,
			});
			recommendations.push("Submit immediately - deadline is imminent");
		} else {
			checks.push({
				id: "deadline",
				name: "Submission Deadline",
				category: "compliance",
				passed: true,
				severity: "info",
				message: `${daysUntil} days until deadline`,
			});
		}
	}

	// Calculate readiness score
	const passedChecks = checks.filter((c) => c.passed).length;
	const readinessScore = Math.round((passedChecks / checks.length) * 100);

	// Generate recommendations
	if (documentResults.some((d) => !d.isReady)) {
		recommendations.push("Review and finalize all documents before submission");
	}
	if (missingDocuments.length > 0) {
		recommendations.push("Create missing required documents");
	}

	return {
		opportunityId,
		isReady: readinessScore >= 80 && missingDocuments.length === 0,
		readinessScore,
		checks,
		documents: documentResults,
		missingDocuments,
		issues,
		recommendations,
		auditedAt: new Date(),
	};
}

function isBlockingDlpSeverity(severity: DlpSeverity): boolean {
	return severity === "critical" || severity === "high";
}

function auditSeverityForDlp(severity: DlpSeverity): AuditCheck["severity"] {
	return severity === "critical" || severity === "high" ? "error" : "warning";
}

/**
 * Get available branding configurations.
 * In production, these would come from a database or configuration.
 */
export async function getBrandingConfigs(): Promise<BrandingConfig[]> {
	await requireCurrentUserId();

	// Default branding options
	return [
		{
			id: "default",
			name: "Default",
			companyName: "DocFusion",
			primaryColor: "#2563eb",
			secondaryColor: "#64748b",
			headerText: "Proposal Document",
			footerText: "Confidential",
		},
		{
			id: "professional",
			name: "Professional",
			companyName: "DocFusion",
			primaryColor: "#1e3a5f",
			secondaryColor: "#4a5568",
			headerText: "",
			footerText: "www.docfusion.com",
		},
		{
			id: "minimal",
			name: "Minimal",
			companyName: "",
			primaryColor: "#1a1a1a",
			secondaryColor: "#666666",
			headerText: "",
			footerText: "",
		},
	];
}
