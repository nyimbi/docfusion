import { describe, expect, it } from "vitest";

import { parseWinrockContractsHtml, winrockParser } from "@/lib/scrapers/parsers/winrock";

const SOURCE_URL = "https://winrock.org/contracts/";
const NOW = new Date("2099-05-31T00:00:00Z");

describe("winrockParser", () => {
	it("extracts current contracts from the Winrock contracts listing", async () => {
		const result = await winrockParser.parse({
			url: SOURCE_URL,
			html: `
				<div class="border-t-6 border-gray-lighter pt-4 grid md:flex gap-4">
					<div class="md:w-2/3 grid gap-2 children:mb-0">
						<h3><a href="https://winrock.org/contracts/demande-de-proposition/" class="font-bold no-underline">Demande de proposition</a></h3>
						Fonds d&#8217;acceleration RFP-WI-WEECAP-2099-04- 07 Bissau, Guinee Bissau Le consortium WEECAP invite les accelerateurs experimentes.
					</div>
				</div>
				<div class="border-t-6 border-gray-lighter pt-4 grid md:flex gap-4">
					<div class="md:w-2/3 grid gap-2 children:mb-0">
						<h3><a href="https://winrock.org/contracts/pre-qualification-of-cashew-business-development-service-providers/" class="font-bold no-underline">Pre-Qualification of Cashew Production Business Development Service Providers</a></h3>
						Program: Women Economic Empowerment through Cashew Processing (WEECAP) Countries: Cote d'Ivoire, Senegal, Guinea-Bissau Issued by: Winrock International Release Date: October 17th, 2025 Round 1 Submission Deadline: November 14, 2025 Round 2 Submission Deadline: February 14, 2026 Round 3 Submission Deadline: June 14, 2099
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Demande de proposition",
			source: "winrock",
			sourceId: "winrock-rfp-wi-weecap-2099-04-07",
			noticeId: "RFP-WI-WEECAP-2099-04-07",
			organization: "Winrock International",
			opportunityType: "rfp",
			portalUrl: "https://winrock.org/contracts/demande-de-proposition/",
			documentUrl: "https://winrock.org/contracts/demande-de-proposition/",
			tags: ["winrock", "ngo", "source-scrape", "source-documents"],
		}));
		expect(result.opportunities[1]).toEqual(expect.objectContaining({
			title: "Pre-Qualification of Cashew Production Business Development Service Providers",
			deadline: new Date(2099, 5, 14),
			countryRegion: "Cote d'Ivoire, Senegal, Guinea-Bissau",
			portalUrl: "https://winrock.org/contracts/pre-qualification-of-cashew-business-development-service-providers/",
		}));
	});

	it("extracts direct document packages from Winrock contract detail pages", () => {
		const opportunities = parseWinrockContractsHtml(`
			<main id="main">
				<h1>Pre-Qualification of Cashew Production Business Development Service Providers</h1>
				<p><strong><em>Program</em></strong>: Women Economic Empowerment through Cashew Processing (WEECAP)<br>
				<strong><em>Countries: </em></strong>Cote d'Ivoire, Senegal, Guinea-Bissau<br>
				<strong><em>Round 3 Submission Deadline: </em></strong>June 14, 2099</p>
				<p>Submissions must be received no later than June 14, 2099</p>
				<div class="wp-block-button"><a class="wp-block-button__link" href="https://winrock.org/wp-content/uploads/2099/10/WEECAP_EOI__BDSP-TK.pdf">DOWNLOAD THIS EOI</a></div>
			</main>
		`, "https://winrock.org/contracts/pre-qualification-of-cashew-business-development-service-providers/", NOW);

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			source: "winrock",
			sourceId: "winrock-pre-qualification-of-cashew-business-development-service-providers",
			deadline: new Date(2099, 5, 14),
			documentUrl: "https://winrock.org/wp-content/uploads/2099/10/WEECAP_EOI__BDSP-TK.pdf",
			rfpLink: "https://winrock.org/wp-content/uploads/2099/10/WEECAP_EOI__BDSP-TK.pdf",
		}));
		expect(opportunities[0]?.metadata?.winrock).toEqual(expect.objectContaining({
			portalUrl: "https://winrock.org/contracts/pre-qualification-of-cashew-business-development-service-providers/",
			documentLinks: [{
				url: "https://winrock.org/wp-content/uploads/2099/10/WEECAP_EOI__BDSP-TK.pdf",
				label: "DOWNLOAD THIS EOI",
			}],
		}));
	});

	it("filters expired listings when a deadline is visible", () => {
		const opportunities = parseWinrockContractsHtml(`
			<div class="border-t-6 border-gray-lighter pt-4 grid md:flex gap-4">
				<h3><a href="https://winrock.org/contracts/old-rfp/">Old RFP</a></h3>
				Request for Proposal Submission Deadline: May 1, 2099
			</div>
		`, SOURCE_URL, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(0);
	});
});
