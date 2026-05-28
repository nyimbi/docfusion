import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { cleanTextForUtf8Storage } from "@/lib/documents/binary-text";

const DEFAULT_PDFTOTEXT_BIN = process.env.PDFTOTEXT_BIN?.trim() || "pdftotext";
const DEFAULT_PDFTOTEXT_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_EXTRACTED_TEXT_LENGTH = 10;

export type PdfTextExtractor = "local_pdftotext" | "local_pdf_parse";

export interface PdfTextExtractionResult {
	text: string;
	pageCount?: number;
	extractor: PdfTextExtractor;
}

export interface PdftotextOptions {
	bin?: string;
	timeoutMs?: number;
	minLength?: number;
	pageLimit?: number;
	maxBuffer?: number;
}

export interface PdfParseOptions {
	minLength?: number;
	pageLimit?: number;
}

export async function extractPdfTextWithPdftotext(
	buffer: Buffer,
	filename: string,
	options: PdftotextOptions = {}
): Promise<PdfTextExtractionResult | undefined> {
	const tempDir = await mkdtemp(join(tmpdir(), "docfusion-pdftotext-"));
	const tempPdfPath = join(tempDir, safeTempPdfFilename(filename));
	try {
		await writeFile(tempPdfPath, buffer);
		const pageArgs = options.pageLimit && options.pageLimit > 0
			? ["-f", "1", "-l", String(Math.floor(options.pageLimit))]
			: [];
		const { stdout } = await execFileAsync(options.bin || DEFAULT_PDFTOTEXT_BIN, [
			...pageArgs,
			"-layout",
			"-enc",
			"UTF-8",
			tempPdfPath,
			"-",
		], {
			timeout: options.timeoutMs ?? DEFAULT_PDFTOTEXT_TIMEOUT_MS,
			maxBuffer: options.maxBuffer ?? Math.max(buffer.length * 4, 16 * 1024 * 1024),
		});
		const text = cleanTextForUtf8Storage(stdout);
		if (text.length < (options.minLength ?? DEFAULT_MIN_EXTRACTED_TEXT_LENGTH)) return undefined;
		return { text, extractor: "local_pdftotext" };
	} finally {
		await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
	}
}

export async function extractPdfTextWithPdfParse(
	buffer: Buffer,
	options: PdfParseOptions = {}
): Promise<PdfTextExtractionResult | undefined> {
	const { PDFParse } = await import("pdf-parse");
	const parser = new PDFParse({ data: buffer });
	try {
		const result = await parser.getText({
			...(options.pageLimit && options.pageLimit > 0 ? { first: Math.floor(options.pageLimit) } : {}),
			pageJoiner: "\n\n",
		});
		const text = cleanTextForUtf8Storage(result.text ?? "");
		if (text.length < (options.minLength ?? DEFAULT_MIN_EXTRACTED_TEXT_LENGTH)) return undefined;
		const pageCount = typeof (result as { total?: unknown }).total === "number"
			? (result as { total: number }).total
			: undefined;
		return { text, pageCount, extractor: "local_pdf_parse" };
	} finally {
		await parser.destroy();
	}
}

function execFileAsync(
	file: string,
	args: string[],
	options: {
		timeout: number;
		maxBuffer: number;
	}
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		execFile(file, args, {
			...options,
			encoding: "utf8",
		}, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			resolve({
				stdout,
				stderr,
			});
		});
	});
}

function safeTempPdfFilename(filename: string): string {
	const base = basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
	return base.toLowerCase().endsWith(".pdf") ? base : `${base || "document"}.pdf`;
}
