import JSZip from "jszip";

type Worksheet = unknown[][];

interface WorkbookSheetRef {
	name: string;
	rid: string;
}

const CELL_REF = /^([A-Z]+)(\d+)$/;
const MAX_SHEET_ROWS = 250;
const MAX_SHEET_COLUMNS = 40;

export async function extractXlsxText(buffer: Buffer): Promise<string> {
	const zip = await JSZip.loadAsync(buffer);
	const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
	const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
	if (!workbookXml || !relsXml) return "";

	const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("text");
	const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
	const relationships = parseRelationships(relsXml);
	const sheetRefs = parseWorkbookSheets(workbookXml);
	const chunks: string[] = [];

	for (const sheetRef of sheetRefs) {
		const target = relationships[sheetRef.rid];
		if (!target) continue;
		const entry = target.startsWith("xl/") ? target : `xl/${target.replace(/^\/?xl\//, "")}`;
		const worksheetXml = await zip.file(entry)?.async("text");
		if (!worksheetXml) continue;
		const rows = parseWorksheet(worksheetXml, sharedStrings);
		const text = worksheetToText(sheetRef.name, rows);
		if (text) chunks.push(text);
	}

	return chunks.join("\n\n").trim();
}

function worksheetToText(sheetName: string, rows: Worksheet): string {
	const nonEmptyRows = rows
		.map((row) => row
			.slice(0, MAX_SHEET_COLUMNS)
			.map((value) => String(value ?? "").replace(/\s+/g, " ").trim()))
		.filter((row) => row.some(Boolean))
		.slice(0, MAX_SHEET_ROWS);
	if (nonEmptyRows.length === 0) return "";
	return [
		`Sheet: ${sheetName}`,
		...nonEmptyRows.map((row) => row.join(" | ").replace(/\s+\|\s+$/g, "")),
	].join("\n");
}

function parseRelationships(xml: string): Record<string, string> {
	const relationships: Record<string, string> = {};
	for (const attrs of matchElements(xml, "Relationship")) {
		const id = attr(attrs, "Id");
		const target = attr(attrs, "Target");
		if (id && target) relationships[id] = target;
	}
	return relationships;
}

function parseWorkbookSheets(xml: string): WorkbookSheetRef[] {
	return matchElements(xml, "sheet").map((attrs) => ({
		name: decodeXml(attr(attrs, "name") ?? "Sheet"),
		rid: attr(attrs, "r:id") ?? "",
	}));
}

function parseSharedStrings(xml: string): string[] {
	const strings: string[] = [];
	const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
	let match: RegExpExecArray | null;
	while ((match = itemPattern.exec(xml))) {
		const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
			.map((part) => decodeXml(part[1]));
		strings.push(textParts.join(""));
	}
	return strings;
}

function parseWorksheet(xml: string, sharedStrings: string[]): Worksheet {
	const rows: Worksheet = [];
	const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
	let rowMatch: RegExpExecArray | null;
	while ((rowMatch = rowPattern.exec(xml))) {
		const row: unknown[] = [];
		const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
		let cellMatch: RegExpExecArray | null;
		while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
			const attrs = cellMatch[1];
			const ref = attr(attrs, "r");
			const type = attr(attrs, "t");
			const index = ref ? columnIndex(ref) : row.length;
			row[index] = parseCellValue(cellMatch[2], type, sharedStrings);
		}
		rows.push(row);
	}
	return rows;
}

function parseCellValue(xml: string, type: string | undefined, sharedStrings: string[]): unknown {
	if (type === "inlineStr") {
		const text = xml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1];
		return text ? decodeXml(text) : "";
	}

	const value = xml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
	if (value === undefined) return "";
	if (type === "s") return sharedStrings[Number(value)] ?? "";
	if (type === "b") return value === "1";
	if (type === "str") return decodeXml(value);

	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : decodeXml(value);
}

function columnIndex(cellRef: string): number {
	const match = CELL_REF.exec(cellRef);
	if (!match) return 0;
	return [...match[1]].reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function matchElements(xml: string, tag: string): string[] {
	const pattern = new RegExp(`<${tag}\\b([^>]*)\\/?>(?:</${tag}>)?`, "g");
	const matches: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(xml))) {
		matches.push(match[1]);
	}
	return matches;
}

function attr(attrs: string, name: string): string | undefined {
	const escaped = name.replace(":", "\\:");
	const pattern = new RegExp(`${escaped}=(?:"([^"]*)"|'([^']*)')`);
	const match = attrs.match(pattern);
	return match?.[1] ?? match?.[2];
}

function decodeXml(value: string): string {
	return value
		.replace(/&quot;/g, "\"")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}
