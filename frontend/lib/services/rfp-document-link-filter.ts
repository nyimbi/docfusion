export const LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_REGEX_SOURCE = String.raw`(?:\bannual[-_\s]?report\b|\bcontract[-_\s]?awards?\b|\bcontractawards?(?:above)?|\bawards?(?:[-_\s]?above|above)|\baward[-_\s]?notice\b|\bnotice[-_\s]?of[-_\s]?awards?\b|\bprocurement[-_\s]?plan\b|\bvendor[-_\s]?profile\b|(?:^|[^a-z0-9])supplier[-_\s]?(?:code|conduct|guide|manual)(?:\b|[-_\s])|\bcode[-_\s]?of[-_\s]?conduct\b|\bfinancial[-_\s]?(?:statement|report)\b|\baudit[-_\s]?report\b|\bnewsletter\b|\bpress[-_\s]?release\b|\bprivacy[-_\s]?notice\b|\bterms[-_\s]?of[-_\s]?use\b)`;

export const LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_PATTERN = new RegExp(
	LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_REGEX_SOURCE,
	"i"
);

export function isLowValueProcurementDocumentLink(link: { label?: string | null; url?: string | null }): boolean {
	const haystack = `${link.label ?? ""} ${safeDecodeUrl(link.url ?? "")}`;
	return LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_PATTERN.test(haystack);
}

function safeDecodeUrl(url: string): string {
	try {
		return decodeURIComponent(url);
	} catch {
		return url;
	}
}
