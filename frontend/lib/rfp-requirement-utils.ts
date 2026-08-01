// Pure sync utilities for RFP requirement number handling.
// Kept separate from lib/actions/rfp-parser.ts because 'use server' files
// require all exports to be async functions (Next.js 15.5+).

const RFP_REQUIREMENT_NUMBER_MAX_LENGTH = 50;

function compactText(value: string | null | undefined, maxLength: number): string | undefined {
	const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
	if (!text) return undefined;
	return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function uniqueRfpRequirementNumber(
	rawRequirementNumber: string | null | undefined,
	index: number,
	usedRequirementNumbers: Set<string>,
): string {
	const fallback = `REQ-${String(index + 1).padStart(3, "0")}`;
	const compacted = compactText(rawRequirementNumber, RFP_REQUIREMENT_NUMBER_MAX_LENGTH) ?? fallback;

	if (!usedRequirementNumbers.has(compacted)) {
		usedRequirementNumbers.add(compacted);
		return compacted;
	}

	for (let suffix = 2; ; suffix += 1) {
		const suffixText = `-${suffix}`;
		const baseLimit = RFP_REQUIREMENT_NUMBER_MAX_LENGTH - suffixText.length;
		const candidateBase = compacted.slice(0, Math.max(1, baseLimit));
		const candidate = `${candidateBase}${suffixText}`;
		if (!usedRequirementNumbers.has(candidate)) {
			usedRequirementNumbers.add(candidate);
			return candidate;
		}
	}
}
