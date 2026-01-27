/**
 * DOCX Converter - DocFusion
 *
 * Converts Tiptap JSONContent to DOCX format using the docx library.
 * Handles formatting, styles, tables, and images.
 */

import type { JSONContent } from "@tiptap/react";
import type { BrandingConfig, RenderOptions } from "@/lib/types/opportunity";

// ============================================================================
// Types
// ============================================================================

/**
 * Intermediate representation for DOCX conversion.
 * Since docx library needs to be imported dynamically on server,
 * we create an IR that can be serialized.
 */
export interface DocxElement {
	type: "paragraph" | "heading" | "table" | "image" | "bulletList" | "numberedList" | "pageBreak";
	level?: number; // For headings (1-6)
	children?: DocxTextRun[];
	rows?: DocxTableRow[];
	listItems?: DocxListItem[];
	src?: string; // For images
	width?: number;
	height?: number;
	alignment?: "left" | "center" | "right" | "justify";
}

export interface DocxTextRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strike?: boolean;
	code?: boolean;
	link?: string;
	highlight?: string;
	subscript?: boolean;
	superscript?: boolean;
}

export interface DocxTableRow {
	cells: DocxTableCell[];
	isHeader?: boolean;
}

export interface DocxTableCell {
	content: DocxTextRun[];
	colspan?: number;
	rowspan?: number;
}

export interface DocxListItem {
	content: DocxTextRun[];
	children?: DocxListItem[];
}

export interface DocxDocument {
	elements: DocxElement[];
	metadata?: {
		title?: string;
		author?: string;
		subject?: string;
		keywords?: string[];
		createdDate?: Date;
	};
	branding?: BrandingConfig;
	options: RenderOptions;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert text node with marks to DocxTextRun.
 */
function convertTextToRun(node: JSONContent): DocxTextRun {
	const run: DocxTextRun = {
		text: node.text || "",
	};

	if (node.marks) {
		for (const mark of node.marks) {
			switch (mark.type) {
				case "bold":
					run.bold = true;
					break;
				case "italic":
					run.italic = true;
					break;
				case "underline":
					run.underline = true;
					break;
				case "strike":
					run.strike = true;
					break;
				case "code":
					run.code = true;
					break;
				case "link":
					run.link = mark.attrs?.href;
					break;
				case "highlight":
					run.highlight = mark.attrs?.color || "yellow";
					break;
				case "subscript":
					run.subscript = true;
					break;
				case "superscript":
					run.superscript = true;
					break;
			}
		}
	}

	return run;
}

/**
 * Convert inline content to array of text runs.
 */
function convertInlineContent(content: JSONContent[] | undefined): DocxTextRun[] {
	if (!content) return [];

	const runs: DocxTextRun[] = [];

	for (const node of content) {
		if (node.type === "text") {
			runs.push(convertTextToRun(node));
		} else if (node.type === "hardBreak") {
			runs.push({ text: "\n" });
		}
	}

	return runs;
}

/**
 * Convert a heading node.
 */
function convertHeading(node: JSONContent): DocxElement {
	return {
		type: "heading",
		level: node.attrs?.level || 1,
		children: convertInlineContent(node.content),
	};
}

/**
 * Convert a paragraph node.
 */
function convertParagraph(node: JSONContent): DocxElement {
	const alignment = node.attrs?.textAlign as DocxElement["alignment"];
	return {
		type: "paragraph",
		children: convertInlineContent(node.content),
		alignment,
	};
}

/**
 * Convert a bullet list.
 */
function convertBulletList(node: JSONContent): DocxElement {
	const items: DocxListItem[] = (node.content || []).map((item) => ({
		content: item.content
			? item.content.flatMap((child) => {
					if (child.type === "paragraph") {
						return convertInlineContent(child.content);
					}
					return [];
				})
			: [],
	}));

	return {
		type: "bulletList",
		listItems: items,
	};
}

/**
 * Convert an ordered list.
 */
function convertOrderedList(node: JSONContent): DocxElement {
	const items: DocxListItem[] = (node.content || []).map((item) => ({
		content: item.content
			? item.content.flatMap((child) => {
					if (child.type === "paragraph") {
						return convertInlineContent(child.content);
					}
					return [];
				})
			: [],
	}));

	return {
		type: "numberedList",
		listItems: items,
	};
}

/**
 * Convert a table.
 */
function convertTable(node: JSONContent): DocxElement {
	const rows: DocxTableRow[] = (node.content || []).map((row, index) => {
		const isHeader = row.content?.[0]?.type === "tableHeader";
		const cells: DocxTableCell[] = (row.content || []).map((cell) => {
			const cellContent = cell.content || [];
			const runs: DocxTextRun[] = cellContent.flatMap((child) => {
				if (child.type === "paragraph") {
					return convertInlineContent(child.content);
				}
				return [];
			});

			return {
				content: runs,
				colspan: cell.attrs?.colspan,
				rowspan: cell.attrs?.rowspan,
			};
		});

		return { cells, isHeader };
	});

	return {
		type: "table",
		rows,
	};
}

/**
 * Convert an image.
 */
function convertImage(node: JSONContent): DocxElement {
	return {
		type: "image",
		src: node.attrs?.src,
		width: node.attrs?.width,
		height: node.attrs?.height,
	};
}

/**
 * Convert blockquote (as indented paragraph).
 */
function convertBlockquote(node: JSONContent): DocxElement[] {
	const elements: DocxElement[] = [];

	for (const child of node.content || []) {
		if (child.type === "paragraph") {
			elements.push({
				type: "paragraph",
				children: convertInlineContent(child.content),
				alignment: "left",
			});
		}
	}

	return elements;
}

/**
 * Convert a single node to DocxElement(s).
 */
function convertNode(node: JSONContent): DocxElement[] {
	switch (node.type) {
		case "heading":
			return [convertHeading(node)];
		case "paragraph":
			return [convertParagraph(node)];
		case "bulletList":
			return [convertBulletList(node)];
		case "orderedList":
			return [convertOrderedList(node)];
		case "table":
			return [convertTable(node)];
		case "image":
			return [convertImage(node)];
		case "blockquote":
			return convertBlockquote(node);
		case "horizontalRule":
			// DOCX doesn't have native HR, use a paragraph with border
			return [{ type: "paragraph", children: [{ text: "" }] }];
		case "codeBlock":
			// Code block as paragraph with monospace
			const code = node.content?.[0]?.text || "";
			return [{
				type: "paragraph",
				children: [{ text: code, code: true }],
			}];
		default:
			// Try to process children
			if (node.content) {
				return node.content.flatMap(convertNode);
			}
			return [];
	}
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Convert Tiptap JSONContent to DocxDocument intermediate representation.
 */
export function tiptapToDocxIR(
	content: JSONContent,
	options: RenderOptions = { format: "docx" }
): DocxDocument {
	const elements = (content.content || []).flatMap(convertNode);

	return {
		elements,
		metadata: options.metadata,
		branding: options.branding,
		options,
	};
}

/**
 * Generate DOCX buffer from DocxDocument IR.
 * Note: This must be called in a server context where docx package is available.
 */
export async function generateDocxBuffer(doc: DocxDocument): Promise<Buffer> {
	// Dynamic import of docx library (only available server-side)
	const {
		Document,
		Paragraph,
		TextRun,
		HeadingLevel,
		Table,
		TableRow,
		TableCell,
		WidthType,
		AlignmentType,
		Packer,
		Header,
		Footer,
		PageNumber,
		NumberFormat,
	} = await import("docx");

	// Map heading level
	const headingLevelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
		1: HeadingLevel.HEADING_1,
		2: HeadingLevel.HEADING_2,
		3: HeadingLevel.HEADING_3,
		4: HeadingLevel.HEADING_4,
		5: HeadingLevel.HEADING_5,
		6: HeadingLevel.HEADING_6,
	};

	// Map alignment
	const alignmentMap: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
		left: AlignmentType.LEFT,
		center: AlignmentType.CENTER,
		right: AlignmentType.RIGHT,
		justify: AlignmentType.JUSTIFIED,
	};

	// Convert text runs
	const createTextRuns = (runs: DocxTextRun[]) => {
		return runs.map((run) => {
			return new TextRun({
				text: run.text,
				bold: run.bold,
				italics: run.italic,
				underline: run.underline ? {} : undefined,
				strike: run.strike,
				font: run.code ? "Courier New" : undefined,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				highlight: run.highlight as any,
				subScript: run.subscript,
				superScript: run.superscript,
			});
		});
	};

	// Convert elements to docx children
	const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

	for (const element of doc.elements) {
		switch (element.type) {
			case "heading":
				children.push(
					new Paragraph({
						heading: headingLevelMap[element.level || 1],
						children: createTextRuns(element.children || []),
					})
				);
				break;

			case "paragraph":
				children.push(
					new Paragraph({
						children: createTextRuns(element.children || []),
						alignment: element.alignment
							? alignmentMap[element.alignment]
							: undefined,
					})
				);
				break;

			case "bulletList":
				for (const item of element.listItems || []) {
					children.push(
						new Paragraph({
							bullet: { level: 0 },
							children: createTextRuns(item.content),
						})
					);
				}
				break;

			case "numberedList":
				for (let i = 0; i < (element.listItems || []).length; i++) {
					const item = element.listItems![i];
					children.push(
						new Paragraph({
							numbering: { reference: "default-numbering", level: 0 },
							children: createTextRuns(item.content),
						})
					);
				}
				break;

			case "table":
				if (element.rows) {
					children.push(
						new Table({
							width: { size: 100, type: WidthType.PERCENTAGE },
							rows: element.rows.map(
								(row) =>
									new TableRow({
										children: row.cells.map(
											(cell) =>
												new TableCell({
													children: [
														new Paragraph({
															children: createTextRuns(cell.content),
														}),
													],
													columnSpan: cell.colspan,
													rowSpan: cell.rowspan,
												})
										),
									})
							),
						})
					);
				}
				break;
		}
	}

	// Build header if branding provided
	const headers = doc.branding
		? {
				default: new Header({
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: doc.branding.companyName || "",
									bold: true,
								}),
							],
							alignment: AlignmentType.LEFT,
						}),
					],
				}),
			}
		: undefined;

	// Build footer with page numbers
	const footers = {
		default: new Footer({
			children: [
				new Paragraph({
					children: [
						new TextRun({ text: "Page " }),
						new TextRun({
							children: [PageNumber.CURRENT],
						}),
						new TextRun({ text: " of " }),
						new TextRun({
							children: [PageNumber.TOTAL_PAGES],
						}),
					],
					alignment: AlignmentType.CENTER,
				}),
			],
		}),
	};

	// Create document
	const docxDoc = new Document({
		title: doc.metadata?.title,
		creator: doc.metadata?.author,
		subject: doc.metadata?.subject,
		keywords: doc.metadata?.keywords?.join(", "),
		sections: [
			{
				headers,
				footers,
				children,
			},
		],
		numbering: {
			config: [
				{
					reference: "default-numbering",
					levels: [
						{
							level: 0,
							format: NumberFormat.DECIMAL,
							text: "%1.",
							alignment: AlignmentType.START,
						},
					],
				},
			],
		},
	});

	// Pack to buffer
	const buffer = await Packer.toBuffer(docxDoc);
	return Buffer.from(buffer);
}

/**
 * Convert Tiptap content directly to DOCX buffer.
 */
export async function tiptapToDocx(
	content: JSONContent,
	options: RenderOptions = { format: "docx" }
): Promise<Buffer> {
	const ir = tiptapToDocxIR(content, options);
	return generateDocxBuffer(ir);
}
