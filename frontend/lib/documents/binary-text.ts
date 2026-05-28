const CONTROL_CHARS_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const PROCUREMENT_SIGNAL =
	/\b(rfp|request for proposals?|tender|procurement|bid|bidding|eoi|expression of interest|terms of reference|quotation|submission|contract)\b/i;

export function cleanTextForUtf8Storage(value: string | undefined | null): string {
	return value
		?.replace(CONTROL_CHARS_EXCEPT_WHITESPACE, " ")
		.replace(/\s+/g, " ")
		.trim() ?? "";
}

export function extractReadableTextFromBinaryDocument(
	buffer: Buffer,
	options: { minimumLength?: number; requireProcurementSignal?: boolean } = {}
): string {
	const minimumLength = options.minimumLength ?? 100;
	const requireProcurementSignal = options.requireProcurementSignal ?? true;
	const candidates = [
		extractPrintableRuns(buffer.toString("utf16le")),
		extractPrintableRuns(buffer.toString("latin1")),
	].map(cleanTextForUtf8Storage);

	const best = candidates
		.filter((candidate) => candidate.length >= minimumLength)
		.filter((candidate) => !requireProcurementSignal || PROCUREMENT_SIGNAL.test(candidate))
		.sort((a, b) => scoreReadableText(b) - scoreReadableText(a))[0];

	return best ?? "";
}

function extractPrintableRuns(value: string): string {
	return value
		.split("")
		.map((char) => {
			const code = char.charCodeAt(0);
			if (char === "\n" || char === "\r" || char === "\t") return char;
			if (code >= 32 && code <= 126) return char;
			return " ";
		})
		.join("")
		.replace(/\s{2,}/g, " ");
}

function scoreReadableText(value: string): number {
	const wordCount = value.split(/\s+/).filter((word) => /[a-z]{3,}/i.test(word)).length;
	const signalBonus = PROCUREMENT_SIGNAL.test(value) ? 1_000 : 0;
	return value.length + wordCount * 5 + signalBonus;
}
