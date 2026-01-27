/**
 * PPTX Converter - DocFusion
 *
 * Converts Tiptap JSONContent to PowerPoint presentations.
 * Extracts key sections and creates slides with proper formatting.
 */

import type { JSONContent } from "@tiptap/react";
import type { BrandingConfig, RenderOptions } from "@/lib/types/opportunity";

// ============================================================================
// Types
// ============================================================================

export type SlideTemplate = "default" | "executive" | "technical" | "minimal";

export interface PptxSlide {
	type: "title" | "content" | "section" | "bullets" | "table" | "image" | "twoColumn";
	title?: string;
	subtitle?: string;
	content?: PptxContent[];
	bullets?: string[];
	table?: PptxTable;
	image?: PptxImage;
	leftColumn?: PptxContent[];
	rightColumn?: PptxContent[];
	notes?: string;
}

export interface PptxContent {
	type: "text" | "bullet" | "numbered";
	text: string;
	level?: number;
	bold?: boolean;
	italic?: boolean;
}

export interface PptxTable {
	headers: string[];
	rows: string[][];
}

export interface PptxImage {
	src: string;
	width?: number;
	height?: number;
	caption?: string;
}

export interface PptxDocument {
	slides: PptxSlide[];
	metadata?: {
		title?: string;
		author?: string;
		subject?: string;
	};
	branding?: BrandingConfig;
	template: SlideTemplate;
}

// ============================================================================
// Content Extraction
// ============================================================================

/**
 * Extract plain text from a node.
 */
function extractText(node: JSONContent): string {
	if (node.type === "text") {
		return node.text || "";
	}
	if (node.content) {
		return node.content.map(extractText).join("");
	}
	return "";
}

/**
 * Extract text from inline content with basic formatting info.
 */
function extractFormattedText(content: JSONContent[] | undefined): PptxContent[] {
	if (!content) return [];

	const result: PptxContent[] = [];

	for (const node of content) {
		if (node.type === "text" && node.text) {
			const item: PptxContent = { type: "text", text: node.text };
			if (node.marks) {
				for (const mark of node.marks) {
					if (mark.type === "bold") item.bold = true;
					if (mark.type === "italic") item.italic = true;
				}
			}
			result.push(item);
		}
	}

	return result;
}

/**
 * Extract bullet points from a list.
 */
function extractBullets(node: JSONContent): string[] {
	if (!node.content) return [];

	return node.content.map((item) => {
		if (item.content) {
			return item.content.map(extractText).join("").trim();
		}
		return "";
	}).filter(Boolean);
}

/**
 * Extract table data.
 */
function extractTable(node: JSONContent): PptxTable | null {
	if (!node.content || node.content.length === 0) return null;

	const rows = node.content;
	const headers: string[] = [];
	const dataRows: string[][] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const cells = (row.content || []).map((cell) => extractText(cell).trim());

		if (i === 0 && row.content?.[0]?.type === "tableHeader") {
			headers.push(...cells);
		} else {
			dataRows.push(cells);
		}
	}

	// If no explicit headers, use first row
	if (headers.length === 0 && dataRows.length > 0) {
		headers.push(...dataRows.shift()!);
	}

	return { headers, rows: dataRows };
}

// ============================================================================
// Slide Generation
// ============================================================================

/**
 * Create a title slide.
 */
function createTitleSlide(title: string, subtitle?: string, branding?: BrandingConfig): PptxSlide {
	return {
		type: "title",
		title,
		subtitle: subtitle || branding?.companyName,
	};
}

/**
 * Create a section divider slide.
 */
function createSectionSlide(title: string): PptxSlide {
	return {
		type: "section",
		title,
	};
}

/**
 * Create a bullet point slide.
 */
function createBulletSlide(title: string, bullets: string[]): PptxSlide {
	return {
		type: "bullets",
		title,
		bullets,
	};
}

/**
 * Create a content slide with paragraphs.
 */
function createContentSlide(title: string, content: PptxContent[]): PptxSlide {
	return {
		type: "content",
		title,
		content,
	};
}

/**
 * Create a table slide.
 */
function createTableSlide(title: string, table: PptxTable): PptxSlide {
	return {
		type: "table",
		title,
		table,
	};
}

// ============================================================================
// Document Processing
// ============================================================================

interface ProcessingState {
	currentSection: string | null;
	currentContent: PptxContent[];
	currentBullets: string[];
	slides: PptxSlide[];
}

/**
 * Flush accumulated content to slides.
 */
function flushContent(state: ProcessingState): void {
	if (state.currentBullets.length > 0 && state.currentSection) {
		state.slides.push(
			createBulletSlide(state.currentSection, state.currentBullets)
		);
		state.currentBullets = [];
	} else if (state.currentContent.length > 0 && state.currentSection) {
		state.slides.push(
			createContentSlide(state.currentSection, state.currentContent)
		);
		state.currentContent = [];
	}
}

/**
 * Process a node and add to slides.
 */
function processNode(node: JSONContent, state: ProcessingState): void {
	switch (node.type) {
		case "heading": {
			const level = node.attrs?.level || 1;
			const text = extractText(node);

			if (level === 1) {
				// Major section - create section slide
				flushContent(state);
				state.slides.push(createSectionSlide(text));
				state.currentSection = text;
			} else if (level === 2) {
				// Subsection - new content slide
				flushContent(state);
				state.currentSection = text;
			} else {
				// Lower level heading - add to content
				state.currentContent.push({
					type: "text",
					text: text,
					bold: true,
				});
			}
			break;
		}

		case "paragraph": {
			const text = extractText(node).trim();
			if (text) {
				state.currentContent.push({
					type: "text",
					text,
				});
			}
			break;
		}

		case "bulletList": {
			const bullets = extractBullets(node);
			state.currentBullets.push(...bullets);
			break;
		}

		case "orderedList": {
			const items = extractBullets(node);
			// Convert to numbered format
			items.forEach((item, i) => {
				state.currentContent.push({
					type: "numbered",
					text: `${i + 1}. ${item}`,
					level: 0,
				});
			});
			break;
		}

		case "table": {
			const table = extractTable(node);
			if (table && state.currentSection) {
				flushContent(state);
				state.slides.push(createTableSlide(state.currentSection, table));
			}
			break;
		}

		case "blockquote": {
			const text = extractText(node).trim();
			if (text) {
				state.currentContent.push({
					type: "text",
					text: `"${text}"`,
					italic: true,
				});
			}
			break;
		}

		default:
			// Process children
			if (node.content) {
				for (const child of node.content) {
					processNode(child, state);
				}
			}
	}
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Convert Tiptap JSONContent to PptxDocument structure.
 */
export function tiptapToPptxIR(
	content: JSONContent,
	options: RenderOptions = { format: "pptx" }
): PptxDocument {
	const state: ProcessingState = {
		currentSection: null,
		currentContent: [],
		currentBullets: [],
		slides: [],
	};

	// Add title slide
	if (options.metadata?.title) {
		state.slides.push(
			createTitleSlide(
				options.metadata.title,
				options.metadata.subject,
				options.branding
			)
		);
	}

	// Process content
	if (content.content) {
		for (const node of content.content) {
			processNode(node, state);
		}
	}

	// Flush remaining content
	flushContent(state);

	return {
		slides: state.slides,
		metadata: options.metadata,
		branding: options.branding,
		template: (options.slideTemplate as SlideTemplate) || "default",
	};
}

/**
 * Generate PPTX buffer from PptxDocument.
 * Note: This must be called in a server context where pptxgenjs is available.
 */
export async function generatePptxBuffer(doc: PptxDocument): Promise<Buffer> {
	// Dynamic import of pptxgenjs
	const PptxGenJS = (await import("pptxgenjs")).default;

	const pptx = new PptxGenJS();

	// Set document properties
	if (doc.metadata?.title) pptx.title = doc.metadata.title;
	if (doc.metadata?.author) pptx.author = doc.metadata.author;
	if (doc.metadata?.subject) pptx.subject = doc.metadata.subject;

	// Template-specific settings
	const templates = {
		default: {
			titleFontSize: 44,
			bodyFontSize: 18,
			bulletFontSize: 16,
			primaryColor: doc.branding?.primaryColor || "363636",
			secondaryColor: doc.branding?.secondaryColor || "666666",
		},
		executive: {
			titleFontSize: 36,
			bodyFontSize: 16,
			bulletFontSize: 14,
			primaryColor: doc.branding?.primaryColor || "1a365d",
			secondaryColor: doc.branding?.secondaryColor || "4a5568",
		},
		technical: {
			titleFontSize: 32,
			bodyFontSize: 14,
			bulletFontSize: 12,
			primaryColor: doc.branding?.primaryColor || "2d3748",
			secondaryColor: doc.branding?.secondaryColor || "718096",
		},
		minimal: {
			titleFontSize: 40,
			bodyFontSize: 18,
			bulletFontSize: 16,
			primaryColor: doc.branding?.primaryColor || "1a1a1a",
			secondaryColor: doc.branding?.secondaryColor || "888888",
		},
	};

	const template = templates[doc.template] || templates.default;

	// Process each slide
	for (const slideData of doc.slides) {
		const slide = pptx.addSlide();

		switch (slideData.type) {
			case "title":
				// Title slide
				slide.addText(slideData.title || "", {
					x: 0.5,
					y: "35%",
					w: "90%",
					h: 1.5,
					fontSize: template.titleFontSize,
					bold: true,
					color: template.primaryColor.replace("#", ""),
					align: "center",
				});
				if (slideData.subtitle) {
					slide.addText(slideData.subtitle, {
						x: 0.5,
						y: "55%",
						w: "90%",
						h: 0.75,
						fontSize: template.bodyFontSize,
						color: template.secondaryColor.replace("#", ""),
						align: "center",
					});
				}
				break;

			case "section":
				// Section divider
				slide.addText(slideData.title || "", {
					x: 0.5,
					y: "40%",
					w: "90%",
					h: 1.5,
					fontSize: template.titleFontSize - 4,
					bold: true,
					color: template.primaryColor.replace("#", ""),
					align: "center",
				});
				break;

			case "bullets":
				// Title
				if (slideData.title) {
					slide.addText(slideData.title, {
						x: 0.5,
						y: 0.5,
						w: "90%",
						h: 1,
						fontSize: template.titleFontSize - 12,
						bold: true,
						color: template.primaryColor.replace("#", ""),
					});
				}
				// Bullets
				if (slideData.bullets && slideData.bullets.length > 0) {
					const bulletText = slideData.bullets.map((b) => ({
						text: b,
						options: {
							bullet: true,
							fontSize: template.bulletFontSize,
							color: template.secondaryColor.replace("#", ""),
						},
					}));
					slide.addText(bulletText, {
						x: 0.5,
						y: 1.5,
						w: "90%",
						h: 4,
						valign: "top",
					});
				}
				break;

			case "content":
				// Title
				if (slideData.title) {
					slide.addText(slideData.title, {
						x: 0.5,
						y: 0.5,
						w: "90%",
						h: 1,
						fontSize: template.titleFontSize - 12,
						bold: true,
						color: template.primaryColor.replace("#", ""),
					});
				}
				// Content
				if (slideData.content && slideData.content.length > 0) {
					const contentText = slideData.content.map((c) => ({
						text: c.text + "\n\n",
						options: {
							fontSize: template.bodyFontSize,
							bold: c.bold,
							italic: c.italic,
							color: template.secondaryColor.replace("#", ""),
						},
					}));
					slide.addText(contentText, {
						x: 0.5,
						y: 1.5,
						w: "90%",
						h: 4,
						valign: "top",
					});
				}
				break;

			case "table":
				// Title
				if (slideData.title) {
					slide.addText(slideData.title, {
						x: 0.5,
						y: 0.5,
						w: "90%",
						h: 0.75,
						fontSize: template.titleFontSize - 12,
						bold: true,
						color: template.primaryColor.replace("#", ""),
					});
				}
				// Table
				if (slideData.table) {
					// pptxgenjs accepts string[][] for simple tables
					const tableData: string[][] = [
						slideData.table.headers,
						...slideData.table.rows,
					];
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					slide.addTable(tableData as any, {
						x: 0.5,
						y: 1.5,
						w: 9,
						colW: Array(slideData.table.headers.length).fill(
							9 / slideData.table.headers.length
						),
						border: { pt: 1, color: "CCCCCC" },
						fontFace: "Arial",
						fontSize: 12,
						color: template.secondaryColor.replace("#", ""),
						autoPage: true,
					});
				}
				break;
		}

		// Add slide number (except title slide)
		if (slideData.type !== "title") {
			slide.addText(doc.slides.indexOf(slideData) + 1 + "", {
				x: "90%",
				y: "95%",
				w: 0.5,
				h: 0.25,
				fontSize: 10,
				color: "999999",
				align: "right",
			});
		}

		// Add company logo/name if branding
		if (doc.branding?.companyName && slideData.type !== "title") {
			slide.addText(doc.branding.companyName, {
				x: 0.5,
				y: "95%",
				w: 3,
				h: 0.25,
				fontSize: 10,
				color: "999999",
			});
		}
	}

	// Write to buffer
	const output = await pptx.write({ outputType: "nodebuffer" });
	return Buffer.from(output as ArrayBuffer);
}

/**
 * Convert Tiptap content directly to PPTX buffer.
 */
export async function tiptapToPptx(
	content: JSONContent,
	options: RenderOptions = { format: "pptx" }
): Promise<Buffer> {
	const ir = tiptapToPptxIR(content, options);
	return generatePptxBuffer(ir);
}

/**
 * Get estimated slide count without generating.
 */
export function estimateSlideCount(content: JSONContent): number {
	let count = 1; // Title slide

	const processNode = (node: JSONContent): void => {
		if (node.type === "heading") {
			const level = node.attrs?.level || 1;
			if (level <= 2) count++;
		}
		if (node.type === "table") count++;
		if (node.content) {
			for (const child of node.content) {
				processNode(child);
			}
		}
	};

	if (content.content) {
		for (const node of content.content) {
			processNode(node);
		}
	}

	return count;
}
