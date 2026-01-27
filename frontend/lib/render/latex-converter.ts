/**
 * LaTeX Converter - DocFusion
 *
 * Converts Tiptap JSONContent to LaTeX format for professional PDF generation.
 * Handles document structure, formatting, tables, images, and branding.
 */

import type { JSONContent } from "@tiptap/react";
import type { BrandingConfig, RenderOptions, PaperSize, PageOrientation } from "@/lib/types/opportunity";

// ============================================================================
// Types
// ============================================================================

interface LaTeXContext {
	inList: boolean;
	listType: "itemize" | "enumerate" | null;
	inTable: boolean;
	tableColumns: number;
	options: RenderOptions;
	branding?: BrandingConfig;
}

// ============================================================================
// Constants
// ============================================================================

const PAPER_SIZES: Record<PaperSize, string> = {
	letter: "letterpaper",
	a4: "a4paper",
	legal: "legalpaper",
};

const DEFAULT_MARGINS = {
	top: 1,
	bottom: 1,
	left: 1,
	right: 1,
};

// ============================================================================
// Escape Functions
// ============================================================================

/**
 * Escape special LaTeX characters in text.
 */
function escapeLatex(text: string): string {
	if (!text) return "";
	return text
		.replace(/\\/g, "\\textbackslash{}")
		.replace(/&/g, "\\&")
		.replace(/%/g, "\\%")
		.replace(/\$/g, "\\$")
		.replace(/#/g, "\\#")
		.replace(/_/g, "\\_")
		.replace(/\{/g, "\\{")
		.replace(/\}/g, "\\}")
		.replace(/~/g, "\\textasciitilde{}")
		.replace(/\^/g, "\\textasciicircum{}")
		.replace(/</g, "\\textless{}")
		.replace(/>/g, "\\textgreater{}");
}

/**
 * Convert hex color to LaTeX xcolor format.
 */
function hexToLatexColor(hex: string): string {
	if (!hex) return "black";
	const clean = hex.replace("#", "");
	return `HTML{${clean.toUpperCase()}}`;
}

// ============================================================================
// Document Preamble
// ============================================================================

/**
 * Generate LaTeX document preamble with packages and settings.
 */
function generatePreamble(options: RenderOptions): string {
	const paperSize = PAPER_SIZES[options.paperSize || "letter"];
	const orientation = options.orientation === "landscape" ? ",landscape" : "";
	const margins = options.margins || DEFAULT_MARGINS;

	const lines: string[] = [
		`\\documentclass[11pt${orientation}]{article}`,
		"",
		"% Page geometry",
		`\\usepackage[${paperSize},top=${margins.top}in,bottom=${margins.bottom}in,left=${margins.left}in,right=${margins.right}in]{geometry}`,
		"",
		"% Essential packages",
		"\\usepackage[utf8]{inputenc}",
		"\\usepackage[T1]{fontenc}",
		"\\usepackage{lmodern}",
		"\\usepackage{microtype}",
		"",
		"% Graphics and colors",
		"\\usepackage{graphicx}",
		"\\usepackage{xcolor}",
		"\\usepackage{float}",
		"",
		"% Tables",
		"\\usepackage{booktabs}",
		"\\usepackage{tabularx}",
		"\\usepackage{longtable}",
		"\\usepackage{multirow}",
		"",
		"% Lists",
		"\\usepackage{enumitem}",
		"\\setlist{nosep}",
		"",
		"% Links and references",
		"\\usepackage{hyperref}",
		"\\hypersetup{",
		"  colorlinks=true,",
		"  linkcolor=blue,",
		"  urlcolor=blue,",
		"  citecolor=blue",
		"}",
		"",
		"% Code blocks",
		"\\usepackage{listings}",
		"\\lstset{",
		"  basicstyle=\\ttfamily\\small,",
		"  breaklines=true,",
		"  frame=single,",
		"  backgroundcolor=\\color{gray!10}",
		"}",
		"",
		"% Headers and footers",
		"\\usepackage{fancyhdr}",
		"\\pagestyle{fancy}",
		"\\fancyhf{}",
	];

	// Page numbers
	if (options.includePageNumbers !== false) {
		lines.push("\\fancyfoot[C]{\\thepage}");
	}

	// Header content
	if (options.includeHeader && options.branding) {
		lines.push(
			`\\fancyhead[L]{\\small ${escapeLatex(options.branding.companyName || "")}}`,
			`\\fancyhead[R]{\\small ${escapeLatex(options.headerContent || options.branding.headerText || "")}}`
		);
	}

	// Footer content
	if (options.includeFooter && options.footerContent) {
		lines.push(`\\fancyfoot[L]{\\small ${escapeLatex(options.footerContent)}}`);
	}

	lines.push(
		"\\renewcommand{\\headrulewidth}{0.4pt}",
		"\\renewcommand{\\footrulewidth}{0.4pt}",
		""
	);

	// Watermark
	if (options.watermark) {
		lines.push(
			"\\usepackage{draftwatermark}",
			`\\SetWatermarkText{${escapeLatex(options.watermark)}}`,
			"\\SetWatermarkScale{1}",
			"\\SetWatermarkColor[gray]{0.9}",
			""
		);
	}

	// Table of contents settings
	if (options.includeTableOfContents) {
		lines.push(
			"\\usepackage{tocloft}",
			"\\renewcommand{\\cftsecleader}{\\cftdotfill{\\cftdotsep}}",
			""
		);
	}

	// Custom colors from branding
	if (options.branding?.primaryColor) {
		const color = options.branding.primaryColor.replace("#", "");
		lines.push(`\\definecolor{brandprimary}{HTML}{${color}}`);
	}
	if (options.branding?.secondaryColor) {
		const color = options.branding.secondaryColor.replace("#", "");
		lines.push(`\\definecolor{brandsecondary}{HTML}{${color}}`);
	}

	// Document metadata
	if (options.metadata) {
		lines.push(
			"",
			"% Document metadata",
			`\\title{${escapeLatex(options.metadata.title || "")}}`,
			`\\author{${escapeLatex(options.metadata.author || "")}}`,
			`\\date{${options.metadata.createdDate ? options.metadata.createdDate.toLocaleDateString() : "\\today"}}`
		);
	}

	return lines.join("\n");
}

// ============================================================================
// Node Converters
// ============================================================================

/**
 * Convert a single text node with marks to LaTeX.
 */
function convertTextNode(node: JSONContent, ctx: LaTeXContext): string {
	if (node.type !== "text" || !node.text) return "";

	let text = escapeLatex(node.text);

	// Apply marks
	if (node.marks) {
		for (const mark of node.marks) {
			switch (mark.type) {
				case "bold":
					text = `\\textbf{${text}}`;
					break;
				case "italic":
					text = `\\textit{${text}}`;
					break;
				case "strike":
					text = `\\sout{${text}}`;
					break;
				case "underline":
					text = `\\underline{${text}}`;
					break;
				case "code":
					text = `\\texttt{${text}}`;
					break;
				case "link":
					const href = mark.attrs?.href || "";
					text = `\\href{${href}}{${text}}`;
					break;
				case "subscript":
					text = `\\textsubscript{${text}}`;
					break;
				case "superscript":
					text = `\\textsuperscript{${text}}`;
					break;
				case "highlight":
					const color = mark.attrs?.color || "yellow";
					text = `\\colorbox{${color}}{${text}}`;
					break;
			}
		}
	}

	return text;
}

/**
 * Convert inline content (array of text/marks) to LaTeX.
 */
function convertInlineContent(content: JSONContent[] | undefined, ctx: LaTeXContext): string {
	if (!content) return "";
	return content.map((node) => {
		if (node.type === "text") {
			return convertTextNode(node, ctx);
		}
		if (node.type === "hardBreak") {
			return " \\\\\n";
		}
		return "";
	}).join("");
}

/**
 * Convert a heading node to LaTeX.
 */
function convertHeading(node: JSONContent, ctx: LaTeXContext): string {
	const level = node.attrs?.level || 1;
	const text = convertInlineContent(node.content, ctx);

	const commands: Record<number, string> = {
		1: "section",
		2: "subsection",
		3: "subsubsection",
		4: "paragraph",
		5: "subparagraph",
		6: "subparagraph",
	};

	const cmd = commands[level] || "paragraph";
	return `\\${cmd}{${text}}\n\n`;
}

/**
 * Convert a paragraph node to LaTeX.
 */
function convertParagraph(node: JSONContent, ctx: LaTeXContext): string {
	const text = convertInlineContent(node.content, ctx);
	if (!text.trim()) return "\n";
	return `${text}\n\n`;
}

/**
 * Convert a blockquote node to LaTeX.
 */
function convertBlockquote(node: JSONContent, ctx: LaTeXContext): string {
	const content = convertContent(node.content, ctx);
	return `\\begin{quote}\n${content}\\end{quote}\n\n`;
}

/**
 * Convert a code block to LaTeX.
 */
function convertCodeBlock(node: JSONContent, ctx: LaTeXContext): string {
	const language = node.attrs?.language || "";
	const code = node.content?.[0]?.text || "";

	// Use listings package
	if (language) {
		return `\\begin{lstlisting}[language=${language}]\n${code}\n\\end{lstlisting}\n\n`;
	}
	return `\\begin{lstlisting}\n${code}\n\\end{lstlisting}\n\n`;
}

/**
 * Convert a bullet list to LaTeX.
 */
function convertBulletList(node: JSONContent, ctx: LaTeXContext): string {
	const items = (node.content || []).map((item) => {
		const itemCtx = { ...ctx, inList: true, listType: "itemize" as const };
		const content = convertContent(item.content, itemCtx);
		return `\\item ${content.trim()}`;
	});

	return `\\begin{itemize}\n${items.join("\n")}\n\\end{itemize}\n\n`;
}

/**
 * Convert an ordered list to LaTeX.
 */
function convertOrderedList(node: JSONContent, ctx: LaTeXContext): string {
	const start = node.attrs?.start || 1;
	const items = (node.content || []).map((item) => {
		const itemCtx = { ...ctx, inList: true, listType: "enumerate" as const };
		const content = convertContent(item.content, itemCtx);
		return `\\item ${content.trim()}`;
	});

	let result = "\\begin{enumerate}";
	if (start !== 1) {
		result += `\\setcounter{enumi}{${start - 1}}`;
	}
	result += `\n${items.join("\n")}\n\\end{enumerate}\n\n`;
	return result;
}

/**
 * Convert a horizontal rule to LaTeX.
 */
function convertHorizontalRule(node: JSONContent, ctx: LaTeXContext): string {
	return "\\noindent\\rule{\\textwidth}{0.4pt}\n\n";
}

/**
 * Convert an image to LaTeX.
 */
function convertImage(node: JSONContent, ctx: LaTeXContext): string {
	const src = node.attrs?.src || "";
	const alt = escapeLatex(node.attrs?.alt || "");
	const title = escapeLatex(node.attrs?.title || "");
	const width = node.attrs?.width;

	let widthSpec = "\\textwidth";
	if (width) {
		// If width is percentage, convert
		if (typeof width === "string" && width.endsWith("%")) {
			const pct = parseInt(width) / 100;
			widthSpec = `${pct}\\textwidth`;
		}
	}

	// Note: In production, you'd need to download remote images or convert base64
	return [
		"\\begin{figure}[H]",
		"\\centering",
		`\\includegraphics[width=${widthSpec}]{${src}}`,
		title ? `\\caption{${title}}` : "",
		"\\end{figure}",
		"",
	].filter(Boolean).join("\n") + "\n";
}

/**
 * Convert a table to LaTeX.
 */
function convertTable(node: JSONContent, ctx: LaTeXContext): string {
	const rows = node.content || [];
	if (rows.length === 0) return "";

	// Determine column count from first row
	const firstRow = rows[0];
	const colCount = firstRow.content?.length || 1;

	// Build column spec
	const colSpec = Array(colCount).fill("l").join(" ");

	const tableCtx = { ...ctx, inTable: true, tableColumns: colCount };
	const rowsLatex: string[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const cells = (row.content || []).map((cell) => {
			const isHeader = cell.type === "tableHeader";
			const cellContent = convertContent(cell.content, tableCtx).trim();
			return isHeader ? `\\textbf{${cellContent}}` : cellContent;
		});
		rowsLatex.push(cells.join(" & ") + " \\\\");

		// Add horizontal line after header row
		if (i === 0 && row.content?.[0]?.type === "tableHeader") {
			rowsLatex.push("\\hline");
		}
	}

	return [
		"\\begin{table}[H]",
		"\\centering",
		`\\begin{tabular}{${colSpec}}`,
		"\\toprule",
		rowsLatex.join("\n"),
		"\\bottomrule",
		"\\end{tabular}",
		"\\end{table}",
		"",
	].join("\n") + "\n";
}

/**
 * Convert any node to LaTeX based on its type.
 */
function convertNode(node: JSONContent, ctx: LaTeXContext): string {
	switch (node.type) {
		case "heading":
			return convertHeading(node, ctx);
		case "paragraph":
			return convertParagraph(node, ctx);
		case "blockquote":
			return convertBlockquote(node, ctx);
		case "codeBlock":
			return convertCodeBlock(node, ctx);
		case "bulletList":
			return convertBulletList(node, ctx);
		case "orderedList":
			return convertOrderedList(node, ctx);
		case "listItem":
			return convertContent(node.content, ctx);
		case "horizontalRule":
			return convertHorizontalRule(node, ctx);
		case "image":
			return convertImage(node, ctx);
		case "table":
			return convertTable(node, ctx);
		case "hardBreak":
			return " \\\\\n";
		case "text":
			return convertTextNode(node, ctx);
		default:
			// For unknown types, try to process content recursively
			if (node.content) {
				return convertContent(node.content, ctx);
			}
			return "";
	}
}

/**
 * Convert an array of content nodes to LaTeX.
 */
function convertContent(content: JSONContent[] | undefined, ctx: LaTeXContext): string {
	if (!content) return "";
	return content.map((node) => convertNode(node, ctx)).join("");
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Convert Tiptap JSONContent to LaTeX document string.
 */
export function tiptapToLatex(
	content: JSONContent,
	options: RenderOptions = { format: "latex" }
): string {
	const ctx: LaTeXContext = {
		inList: false,
		listType: null,
		inTable: false,
		tableColumns: 0,
		options,
		branding: options.branding,
	};

	const preamble = generatePreamble(options);
	const body = convertContent(content.content, ctx);

	const documentParts: string[] = [
		preamble,
		"",
		"\\begin{document}",
		"",
	];

	// Add title page if metadata present
	if (options.metadata?.title) {
		documentParts.push("\\maketitle", "");
	}

	// Add table of contents
	if (options.includeTableOfContents) {
		documentParts.push("\\tableofcontents", "\\newpage", "");
	}

	documentParts.push(body, "", "\\end{document}");

	return documentParts.join("\n");
}

/**
 * Extract plain text from Tiptap content (for search/preview).
 */
export function tiptapToPlainText(content: JSONContent): string {
	const extractText = (node: JSONContent): string => {
		if (node.type === "text") {
			return node.text || "";
		}
		if (node.content) {
			return node.content.map(extractText).join("");
		}
		return "";
	};

	return extractText(content);
}

/**
 * Generate a LaTeX template for a specific document type.
 */
export function generateProposalTemplate(
	documentType: string,
	branding?: BrandingConfig
): string {
	const templates: Record<string, string> = {
		cover_letter: `
\\section*{Cover Letter}

\\vspace{1cm}

[Date]

\\vspace{0.5cm}

[Recipient Name]\\\\
[Title]\\\\
[Organization]\\\\
[Address]

\\vspace{0.5cm}

Dear [Recipient],

\\vspace{0.5cm}

[Introduction paragraph...]

[Body paragraphs...]

[Closing paragraph...]

\\vspace{0.5cm}

Sincerely,

\\vspace{1cm}

[Your Name]\\\\
[Title]\\\\
${branding?.companyName || "[Company Name]"}
`,
		executive_summary: `
\\section{Executive Summary}

\\subsection{Introduction}
[Brief overview of the proposal and key value proposition...]

\\subsection{Understanding of Requirements}
[Demonstrate understanding of the client's needs...]

\\subsection{Proposed Solution}
[High-level description of the approach...]

\\subsection{Key Benefits}
\\begin{itemize}
\\item [Benefit 1]
\\item [Benefit 2]
\\item [Benefit 3]
\\end{itemize}

\\subsection{Qualifications}
[Brief summary of relevant experience and capabilities...]
`,
		technical_approach: `
\\section{Technical Approach}

\\subsection{Methodology}
[Describe the technical methodology...]

\\subsection{Work Plan}
[Outline the work plan and phases...]

\\subsection{Deliverables}
\\begin{enumerate}
\\item [Deliverable 1]
\\item [Deliverable 2]
\\item [Deliverable 3]
\\end{enumerate}

\\subsection{Quality Assurance}
[Describe QA processes...]

\\subsection{Risk Mitigation}
[Identify risks and mitigation strategies...]
`,
	};

	return templates[documentType] || "";
}
