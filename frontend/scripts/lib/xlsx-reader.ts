import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

export interface WorkBook {
	SheetNames: string[];
	Sheets: Record<string, WorkSheet>;
}

export type WorkSheet = unknown[][];

interface SheetToJsonOptions {
	header?: 1;
	defval?: unknown;
}

interface WorkbookSheetRef {
	name: string;
	rid: string;
}

const CELL_REF = /^([A-Z]+)(\d+)$/;

export function readFile(filePath: string): WorkBook {
	const entries = listEntries(filePath);
	const workbookXml = unzipText(filePath, "xl/workbook.xml");
	const relsXml = unzipText(filePath, "xl/_rels/workbook.xml.rels");
	const sharedStrings = entries.includes("xl/sharedStrings.xml")
		? parseSharedStrings(unzipText(filePath, "xl/sharedStrings.xml"))
		: [];

	const relTargets = parseRelationships(relsXml);
	const sheetRefs = parseWorkbookSheets(workbookXml);
	const sheets: Record<string, WorkSheet> = {};

	for (const sheetRef of sheetRefs) {
		const target = relTargets[sheetRef.rid];
		if (!target) continue;
		const entry = target.startsWith("xl/") ? target : `xl/${target.replace(/^\/?xl\//, "")}`;
		if (!entries.includes(entry)) continue;
		sheets[sheetRef.name] = parseWorksheet(unzipText(filePath, entry), sharedStrings);
	}

	return {
		SheetNames: sheetRefs.map((sheet) => sheet.name).filter((name) => sheets[name]),
		Sheets: sheets,
	};
}

export function read(input: Buffer, _options?: Record<string, unknown>): WorkBook {
	const dir = mkdtempSync(path.join(tmpdir(), "docfusion-xlsx-"));
	const filePath = path.join(dir, "workbook.xlsx");
	try {
		writeFileSync(filePath, input);
		return readFile(filePath);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function sheetToJson(sheet: WorkSheet, options: SheetToJsonOptions & { header: 1 }): unknown[][];
function sheetToJson<T = Record<string, unknown>>(sheet: WorkSheet, options?: SheetToJsonOptions): T[];
function sheetToJson<T = Record<string, unknown>>(
	sheet: WorkSheet,
	options: SheetToJsonOptions = {}
): T[] | unknown[][] {
		if (options.header === 1) {
			return sheet.map((row) => [...row]);
		}

		const [headerRow, ...dataRows] = sheet;
		const headers = (headerRow ?? []).map((value) => String(value ?? "").trim());
		return dataRows
			.filter((row) => row.some((value) => value !== null && value !== undefined && value !== ""))
			.map((row) => {
				const record: Record<string, unknown> = {};
				headers.forEach((header, index) => {
					if (!header) return;
					const value = row[index];
					if (value !== undefined) {
						record[header] = value;
					} else if ("defval" in options) {
						record[header] = options.defval;
					}
				});
				return record as T;
			});
}

export const utils = {
	sheet_to_json: sheetToJson,
};

function listEntries(filePath: string): string[] {
	return execFileSync("unzip", ["-Z1", filePath], { encoding: "utf-8" })
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function unzipText(filePath: string, entry: string): string {
	return execFileSync("unzip", ["-p", filePath, entry], { encoding: "utf-8", maxBuffer: 100 * 1024 * 1024 });
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
		name: attr(attrs, "name") ?? "Sheet",
		rid: attr(attrs, "r:id") ?? "",
	}));
}

function parseSharedStrings(xml: string): string[] {
	const strings: string[] = [];
	const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
	let match: RegExpExecArray | null;
	while ((match = itemPattern.exec(xml))) {
		const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
		strings.push(textParts.join(""));
	}
	return strings;
}

function parseWorksheet(xml: string, sharedStrings: string[]): WorkSheet {
	const rows: WorkSheet = [];
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
	const pattern = new RegExp(`${escaped}="([^"]*)"`);
	return attrs.match(pattern)?.[1];
}

function decodeXml(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}
