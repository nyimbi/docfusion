import { afterEach, describe, expect, it, vi } from "vitest";

import {
	TRADEMARK_AFRICA_PROCUREMENT_URL,
	parseTradeMarkAfricaProcurementHtml,
	tradeMarkAfricaParser,
} from "@/lib/scrapers/parsers/trademark-africa";

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.TRADEMARK_AFRICA_DETAIL_LIMIT;
});

describe("TradeMark Africa tenders parser", () => {
	it("extracts current procurement cards with submission deadlines", () => {
		const opportunities = parseTradeMarkAfricaProcurementHtml(`
			<div class="uc_post_title"><a data-post-link="https://trademarkafrica.com/tma-fwa-dts-01-2026-cloud-hosting/" href="javascrpit:void(0)">
				<div class="ue_p_title">TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms</div>
			</a></div>
			<div class="uc_post_text">Tender Advert Tender Document Bid Extension TMA Supplier Code of Conduct Submission Deadline: 04 JUNE 2099 ON OR BEFORE 10.00 AM (KENYA TIME)</div>
		`, TRADEMARK_AFRICA_PROCUREMENT_URL, new Date("2099-05-31T00:00:00.000Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			title: "TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms",
			source: "trademark_africa",
			sourceId: "trademark-africa-tma-fwa-dts-01-2026",
			noticeId: "TMA/FWA/DTS/01/2026",
			organization: "TradeMark Africa",
			countryRegion: "Africa",
			portalUrl: "https://trademarkafrica.com/tma-fwa-dts-01-2026-cloud-hosting/",
			documentUrl: "https://trademarkafrica.com/tma-fwa-dts-01-2026-cloud-hosting/",
			tags: expect.arrayContaining(["trademark-africa", "source-documents"]),
		}));
		expect(opportunities[0]?.deadline).toEqual(new Date("2099-06-04T07:00:00.000Z"));
	});

	it("fetches detail pages and prioritizes tender documents", async () => {
		process.env.TRADEMARK_AFRICA_DETAIL_LIMIT = "1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === TRADEMARK_AFRICA_PROCUREMENT_URL) {
				return new Response(`
					<div class="uc_post_title"><a data-post-link="https://trademarkafrica.com/tma-fwa-dts-01-2026-cloud-hosting/" href="javascrpit:void(0)">
						<div class="ue_p_title">TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms</div>
					</a></div>
					<div class="uc_post_text">Tender Advert Tender Document Bid Extension TMA Supplier Code of Conduct Submission Deadline: 04 JUNE 2099 ON OR BEFORE 10.00 AM (KENYA TIME)</div>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response(`
				<h1 class="elementor-heading-title">TMA/FWA/DTS/01/2026: Prequalification of Cloud Hosting and Digital Infrastructure Service Providers for TradeMark Africa Digital Platforms</h1>
				<ul>
					<li><a href="/wp-content/uploads/2099/04/FWK-Advert.pdf">Tender Advert</a></li>
					<li><a href="/wp-content/uploads/2099/04/TMA-FWA-DTS-01-2099.pdf">Tender Document</a></li>
					<li><a href="/wp-content/uploads/2099/04/TMA-Framework-Bid-Extension.pdf">Bid Extension</a></li>
				</ul>
				<p><strong>Submission Deadline: 04 JUNE 2099 ON OR BEFORE 10.00 AM (KENYA TIME)</strong></p>
			`, { status: 200, headers: { "content-type": "text/html" } });
		});

		const result = await tradeMarkAfricaParser.parse({ url: TRADEMARK_AFRICA_PROCUREMENT_URL });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.opportunities).toEqual([
			expect.objectContaining({
				source: "trademark_africa",
				documentUrl: "https://trademarkafrica.com/wp-content/uploads/2099/04/TMA-FWA-DTS-01-2099.pdf",
				rfpLink: "https://trademarkafrica.com/wp-content/uploads/2099/04/TMA-FWA-DTS-01-2099.pdf",
				metadata: {
					tradeMarkAfrica: expect.objectContaining({
						documentLinks: expect.arrayContaining([
							{ label: "Tender Document", url: "https://trademarkafrica.com/wp-content/uploads/2099/04/TMA-FWA-DTS-01-2099.pdf" },
						]),
					}),
				},
			}),
		]);
	});
});
