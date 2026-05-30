export const LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_REGEX_SOURCE = String.raw`(?:\bannual[-_\s]?report\b|\bcontract[-_\s]?awards?\b|\bcontractawards?(?:above)?|\bawards?(?:[-_\s]?above|above)|\baward[-_\s]?notice\b|\bnotice[-_\s]?of[-_\s]?awards?\b|\bprocurement[-_\s]?plan\b|\bvendor[-_\s]?profile\b|(?:^|[^a-z0-9])supplier[-_\s]?(?:code|conduct|guide|manual)(?:\b|[-_\s])|\bcode[-_\s]?of[-_\s]?conduct\b|\bfinancial[-_\s]?(?:statement|report)\b|\baudit[-_\s]?report\b|\bnewsletter\b|\bpress[-_\s]?releases?\b|\bprivacy[-_\s]?notice\b|\bterms[-_\s]?of[-_\s]?use\b|\bcover[-_\s]?page\b|\bregret[-_\s]?letter\b|\bcancell?ation[-_\s]?letter\b|\btender[-_\s]?cancell?ation\b|\bquality[-_\s]?control[-_\s]?plan\b|\binspection[-_\s]?test[-_\s]?plan\b|\bqcp\b|\bitp\b)`;

export const LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_PATTERN = new RegExp(
	LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_REGEX_SOURCE,
	"i"
);

export function isLowValueProcurementDocumentLink(link: { label?: string | null; url?: string | null }): boolean {
	const haystack = `${link.label ?? ""} ${safeDecodeUrl(link.url ?? "")}`.replace(/[-_]+/g, " ");
	return LOW_VALUE_PROCUREMENT_DOCUMENT_LINK_PATTERN.test(haystack);
}

function safeDecodeUrl(url: string): string {
	try {
		return decodeURIComponent(url);
	} catch {
		return url;
	}
}
