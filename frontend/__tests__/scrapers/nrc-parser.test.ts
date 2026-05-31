import { afterEach, describe, expect, it, vi } from "vitest";

import {
	nrcParser,
	parseNrcTenderDetailHtml,
	parseNrcTenderSearchResponse,
} from "@/lib/scrapers/parsers/nrc";

const SOURCE_URL = "https://www.nrc.no/themes/177/tender";
const NOW = new Date("2099-05-31T00:00:00Z");

describe("nrcParser", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		delete process.env.NRC_TENDER_MAX_PAGES;
		delete process.env.NRC_TENDER_DETAIL_LIMIT;
	});

	it("maps NRC tender category entries and detail documents into source opportunities", () => {
		const portalUrl = "https://www.nrc.no/tender/evaluation-terms-of-reference-for-the-partner-group-cash-transfer-outcome-monitoring";
		const detail = parseNrcTenderDetailHtml(`
			<script type="application/ld+json">
				{"@type":"NewsArticle","datePublished":"5/21/2099"}
			</script>
			<article>
				<h1><span>Evaluation Terms of Reference for the Partner Group Cash Transfer Outcome Monitoring</span></h1>
				<div class="article-page__rich-text richtext">
					<p>NRC is currently implementing programming across Sudan.</p>
					<p><strong>Deadline for application is 4 June 2099 at 16:00 (GMT +2).</strong></p>
					<p><strong>CONTENT OF REQUEST FOR PROPOSAL</strong></p>
				</div>
				<a href="/globalassets/pdf/tenders/sudan/partner-group-cash-transfer-outcome-monitoring/rfp-sd-pzu-061_v2.docx">
					<div class="filename">RFP-SD-PZU-061.docx</div>
					<div class="size">93.7 KB</div>
				</a>
			</article>
		`, portalUrl);
		const detailsByUrl = new Map([[portalUrl, detail]]);

		const opportunities = parseNrcTenderSearchResponse({
			searchEntries: [{
				title: "Evaluation Terms of Reference for the Partner Group Cash Transfer Outcome Monitoring",
				date: "21. May 2099",
				description: "Consultancy.",
				pageUrl: "/tender/evaluation-terms-of-reference-for-the-partner-group-cash-transfer-outcome-monitoring",
			}],
		}, SOURCE_URL, detailsByUrl, NOW);

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			title: "Evaluation Terms of Reference for the Partner Group Cash Transfer Outcome Monitoring",
			source: "nrc",
			sourceId: "nrc-rfp-sd-pzu-061",
			noticeId: "RFP-SD-PZU-061",
			organization: "Norwegian Refugee Council",
			opportunityType: "rfp",
			publishedDate: new Date(2099, 4, 21),
			deadline: new Date(2099, 5, 4),
			portalUrl,
			documentUrl: "https://www.nrc.no/globalassets/pdf/tenders/sudan/partner-group-cash-transfer-outcome-monitoring/rfp-sd-pzu-061_v2.docx",
			tags: ["nrc", "ngo", "source-api", "source-documents"],
		}));
		expect(opportunities[0]?.metadata?.nrc).toEqual(expect.objectContaining({
			sourcePage: SOURCE_URL,
			documentLinks: [{
				url: "https://www.nrc.no/globalassets/pdf/tenders/sudan/partner-group-cash-transfer-outcome-monitoring/rfp-sd-pzu-061_v2.docx",
				label: "RFP-SD-PZU-061.docx",
			}],
		}));
	});

	it("filters entries when a visible NRC deadline is expired", () => {
		const portalUrl = "https://www.nrc.no/tender/expired-rfp";
		const detailsByUrl = new Map([[
			portalUrl,
			parseNrcTenderDetailHtml(`
				<article>
					<h1>Expired RFP</h1>
					<p><strong>Deadline for application is 4 June 2099 at 16:00 (GMT +2).</strong></p>
				</article>
			`, portalUrl),
		]]);

		const opportunities = parseNrcTenderSearchResponse({
			searchEntries: [{
				title: "Expired RFP",
				date: "21. May 2099",
				description: "Consultancy.",
				pageUrl: "/tender/expired-rfp",
			}],
		}, SOURCE_URL, detailsByUrl, new Date("2099-06-05T00:00:00Z"));

		expect(opportunities).toHaveLength(0);
	});

	it("fetches NRC category API pages and tender detail pages when used as a source API parser", async () => {
		process.env.NRC_TENDER_MAX_PAGES = "1";
		process.env.NRC_TENDER_DETAIL_LIMIT = "2";
		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes("/api/SearchApi/SearchCategories")) {
				return new Response(JSON.stringify({
					searchEntries: [{
						title: "Managed Incident Response Services (SOC/SIEM Implementation)",
						date: "19. May 2099",
						description: null,
						pageUrl: "/tender/managed-incident-response-services-socsiem-implementation",
					}],
					pageNumber: 1,
					lastPage: 1,
				}), { status: 200, headers: { "content-type": "application/json" } });
			}
			return new Response(`
				<article>
					<h1>Managed Incident Response Services (SOC/SIEM Implementation)</h1>
					<span>Published 19. May 2099 </span>
					<p><strong>Deadline for submission is 7 June 2099 at 17:00.</strong></p>
					<a href="/globalassets/pdf/tenders/global/managed-incident-response-services/rfp-it-soc-2099.docx">
						<div class="filename">RFP-IT-SOC-2099.docx</div>
					</a>
				</article>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await nrcParser.parse({ url: SOURCE_URL });

		expect(result.error).toBeUndefined();
		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Managed Incident Response Services (SOC/SIEM Implementation)",
			source: "nrc",
			deadline: new Date(2099, 5, 7),
			documentUrl: "https://www.nrc.no/globalassets/pdf/tenders/global/managed-incident-response-services/rfp-it-soc-2099.docx",
		}));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
