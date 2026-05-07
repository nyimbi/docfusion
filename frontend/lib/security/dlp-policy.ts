export type DlpSeverity = "critical" | "high" | "medium" | "low";

export interface DlpDocumentInput {
	documentId: string;
	title: string;
	content: unknown;
}

export interface DlpFinding {
	id: string;
	documentId: string;
	title: string;
	category: "secret" | "classified" | "personal_data" | "financial";
	severity: DlpSeverity;
	label: string;
	excerpt: string;
	recommendation: string;
}

interface DlpRule {
	category: DlpFinding["category"];
	severity: DlpSeverity;
	label: string;
	pattern: RegExp;
	recommendation: string;
}

const DLP_RULES: DlpRule[] = [
	{
		category: "secret",
		severity: "critical",
		label: "Private key material",
		pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi,
		recommendation: "Remove the key material, rotate the credential, and reference a secure secret store instead.",
	},
	{
		category: "secret",
		severity: "critical",
		label: "Cloud access token",
		pattern: /\b(?:AKIA|ASIA|A3T[A-Z0-9]|LINODE|DO)[A-Z0-9]{16,}\b/g,
		recommendation: "Remove the access token, rotate it, and replace it with a governed credential reference.",
	},
	{
		category: "classified",
		severity: "high",
		label: "Restricted classification marking",
		pattern: /\b(?:TOP SECRET|SECRET)\b/gi,
		recommendation: "Confirm release authority and downgrade, redact, or route the package through classified handling.",
	},
	{
		category: "personal_data",
		severity: "high",
		label: "US Social Security number",
		pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
		recommendation: "Redact the identifier or replace it with a non-sensitive reference.",
	},
	{
		category: "financial",
		severity: "medium",
		label: "Payment card number",
		pattern: /\b(?:\d[ -]*?){13,16}\b/g,
		recommendation: "Remove payment card data from the proposal package and reference the payment process separately.",
	},
];

const BLOCKING_SEVERITIES = new Set<DlpSeverity>(["critical", "high"]);

export function scanDocumentForDlpFindings(document: DlpDocumentInput): DlpFinding[] {
	const text = normalizeWhitespace(extractText(document.content));
	if (!text) return [];

	const findings: DlpFinding[] = [];
	for (const rule of DLP_RULES) {
		const matches = text.matchAll(rule.pattern);
		for (const match of matches) {
			if (match.index === undefined) continue;
			findings.push({
				id: stableFindingId(document.documentId, rule.label, match.index),
				documentId: document.documentId,
				title: document.title,
				category: rule.category,
				severity: rule.severity,
				label: rule.label,
				excerpt: redactExcerpt(text, match.index, match[0]?.length ?? 0),
				recommendation: rule.recommendation,
			});
		}
	}

	return findings;
}

export function scanDocumentsForDlpFindings(documents: DlpDocumentInput[]): DlpFinding[] {
	return documents.flatMap(scanDocumentForDlpFindings);
}

export function hasBlockingDlpFindings(findings: DlpFinding[]): boolean {
	return findings.some((finding) => BLOCKING_SEVERITIES.has(finding.severity));
}

export function summarizeDlpFindings(findings: DlpFinding[]): string {
	const critical = findings.filter((finding) => finding.severity === "critical").length;
	const high = findings.filter((finding) => finding.severity === "high").length;
	const medium = findings.filter((finding) => finding.severity === "medium").length;
	const low = findings.filter((finding) => finding.severity === "low").length;
	return [
		critical ? `${critical} critical` : null,
		high ? `${high} high` : null,
		medium ? `${medium} medium` : null,
		low ? `${low} low` : null,
	].filter(Boolean).join(", ") || "no findings";
}

function extractText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(" ");
	if (!value || typeof value !== "object") return "";

	const record = value as Record<string, unknown>;
	const text = typeof record.text === "string" ? record.text : "";
	const content = extractText(record.content);
	const attrs = extractText(record.attrs);
	return [text, content, attrs].filter(Boolean).join(" ");
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function redactExcerpt(text: string, index: number, length: number): string {
	const start = Math.max(0, index - 40);
	const end = Math.min(text.length, index + length + 40);
	return `${text.slice(start, index)}[REDACTED]${text.slice(index + length, end)}`.trim();
}

function stableFindingId(documentId: string, label: string, index: number): string {
	const seed = `${documentId}:${label}:${index}`;
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) {
		hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
	}
	return `dlp_${Math.abs(hash).toString(36)}`;
}
