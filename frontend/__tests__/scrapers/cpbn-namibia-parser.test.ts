import { describe, expect, it } from "vitest";

import {
	cpbnNamibiaParser,
	parseCpbnNamibiaOpenBidsHtml,
} from "@/lib/scrapers/parsers/cpbn-namibia";

const openBidsHtml = `
<table id="activeBidsTable">
	<tbody>
		<tr><td>
			<div class="card">
				<h4 class="card-title">
					<a href="https://www.cpbn.com.na/index/bid/108">Procurement of Wastewater Treatment Plant Management Services for a Period of Five (5) Years in Swakopmund, Erongo Region.: W/ONB/CPBN-06/2026</a>
				</h4>
				<ul><li><strong>Reference number:</strong> W/ONB/CPBN-06/2026 | <strong>Closing Date and Time:</strong> 15th July, 2026 11:00 | <i><strong><a href="https://www.cpbn.com.na/index/bid/108">More Details</a></strong></i></li></ul>
				<div class="card-body">
					<a href="javascript:void(0)" onclick="openModalRemoteContent('https://www.cpbn.com.na/ajax/download/455')" class="download-link">
						<span><i class="fas fa-file-pdf"></i></span>&nbsp;Full Advert - Swakopmund Wastewater.pdf
					</a>
				</div>
			</div>
		</td></tr>
		<tr><td>
			<div class="card">
				<h4 class="card-title">
					<a href="https://www.cpbn.com.na/index/bid/107">Consultancy Services for Programme Design: CS/RFP/CPBN-03/2026</a>
				</h4>
				<ul><li><strong>Reference number:</strong> CS/RFP/CPBN-03/2026 | <strong>Closing Date and Time:</strong> 26th June, 2026 11:00 | <a href="https://www.cpbn.com.na/index/bid/107">More Details</a></li></ul>
				<div class="card-body">
					<a href="javascript:void(0)" onclick="openModalRemoteContent('https://www.cpbn.com.na/ajax/download/454')" class="download-link">
						<span><i class="fas fa-file-pdf"></i></span>&nbsp;Request for Proposal.pdf
					</a>
				</div>
			</div>
		</td></tr>
	</tbody>
</table>
`;

describe("Namibia CPBN parser", () => {
	it("extracts open bids without treating gated modal downloads as direct documents", () => {
		const opportunities = parseCpbnNamibiaOpenBidsHtml(openBidsHtml);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Procurement of Wastewater Treatment Plant Management Services for a Period of Five (5) Years in Swakopmund, Erongo Region.",
			source: "cpbn_namibia",
			sourceId: "cpbn-108",
			noticeId: "W/ONB/CPBN-06/2026",
			organization: "Central Procurement Board of Namibia",
			countryRegion: "Namibia",
			opportunityType: "tender",
			portalUrl: "https://www.cpbn.com.na/index/bid/108",
			rfpLink: "https://www.cpbn.com.na/index/bid/108",
		});
		expect(opportunities[0]?.documentUrl).toBeUndefined();
		expect(opportunities[0]?.deadline).toEqual(new Date("2026-07-15T09:00:00.000Z"));
		expect(opportunities[0]?.metadata?.cpbnNamibia).toMatchObject({
			bidId: "108",
			referenceNumber: "W/ONB/CPBN-06/2026",
			deadlineText: "15th July, 2026 11:00",
			documentRequests: [{
				label: "Full Advert - Swakopmund Wastewater.pdf",
				url: "https://www.cpbn.com.na/ajax/download/455",
			}],
		});
		expect(opportunities[1]).toMatchObject({
			sourceId: "cpbn-107",
			opportunityType: "rfp",
			noticeId: "CS/RFP/CPBN-03/2026",
		});
	});

	it("supports the TenderParser interface from HTML payloads", async () => {
		const result = await cpbnNamibiaParser.parse({
			html: openBidsHtml,
			url: "https://www.cpbn.com.na/index/external/2",
		});

		expect(result.error).toBeUndefined();
		expect(result.opportunities.map((opportunity) => opportunity.sourceId)).toEqual(["cpbn-108", "cpbn-107"]);
		expect(cpbnNamibiaParser.getPageUrl("", 1)).toBe("https://www.cpbn.com.na/index/external/2");
	});
});
