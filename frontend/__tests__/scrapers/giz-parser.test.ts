import { describe, expect, it } from "vitest";

import { gizParser } from "@/lib/scrapers/parsers/giz";

const ghanaMarkdown = `
![Country flag Ghana](https://www.giz.de/themes/custom/dreist/build/assets/flags/svg/gh.svg)

Ghana
=====

Tenders
-------

Deadline: 11.06.2026

Procurement Of Service: Consultancy for The Design and Implementation of a Business Development Program for Creators

Business-Development-for-Content-Creators.zip

zip

727.24 KB

[](https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip "dd_media.zip.download")

Deadline: 08.06.2026

Procurement of Goods: Printing of Study in Europe Desk Information Materials

PRINTING-OF-STUDY-IN-EUROPE-DESK-INFORMATION-MATERIALS-15.05.2026.pdf

pdf

208.53 KB

[](https://www.giz.de/sites/default/files/media/els-document/2026-05/giz-reoi-printing-study-europe-desk-information-materials-15-05-2026.pdf "Download PDF")
`;

const southAfricaMarkdown = `
South Africa
============

Tenders
-------

All bids to be submitted electronically in PDF ONLY!

Deadline: 06.06.2026

Expression of Interest (7000005607): Supply and Delivery of GSM Data loggers

The Deutsche Gesellschaft für Internationale Zusammenarbeit (GIZ) GmbH invites eligible and professional suppliers with local presence in South Africa to participate in this Expression of Interest (EOI) for the supply and delivery of GSM Data loggers. EOI documents are available below for download.

7000005607-EOI_Technical-Criteria-Supply-and-Delivery-of-Data-Loggers-Suppliers-to-complete-final.xlsx

xlsx

19.85 KB

[](https://www.giz.de/sites/default/files/media/els-document/2026-05/7000005607-eoi-technical-criteria-supply-and-delivery-data-loggers-suppliers-complete-final.xlsx "dd_media.xls.download")

7000005607_Advert_EOI_Supply-and-Delivery-of-Data-Loggers-final11.pdf

pdf

103.15 KB

[](https://www.giz.de/sites/default/files/media/els-document/2026-05/7000005607-advert-eoi-supply-and-delivery-data-loggers-final11.pdf "Download PDF")
`;

describe("GIZ country tender parser", () => {
	it("extracts Ghana tender blocks with downloadable package links", async () => {
		const result = await gizParser.parse({
			url: "https://www.giz.de/en/regions/africa/ghana/tenders",
			markdown: ghanaMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toMatchObject({
			title: "Procurement Of Service: Consultancy for The Design and Implementation of a Business Development Program for Creators",
			source: "giz",
			sourceId: "giz-7000010646",
			organization: "GIZ Ghana",
			countryRegion: "Ghana",
			category: "GIZ tender",
			opportunityType: "tender",
			portalUrl: "https://www.giz.de/en/regions/africa/ghana/tenders",
			documentUrl: "https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip",
			rfpLink: "https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip",
			tags: ["giz", "bilateral-donor", "source-scrape"],
		});
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2026, 5, 11));
		expect(result.opportunities[0]?.metadata?.giz).toEqual(expect.objectContaining({
			deadline: "11.06.2026",
			documentLinks: [
				expect.objectContaining({
					url: "https://www.giz.de/sites/default/files/media/els-document/2026-05/7000010646-contract-documents-bus-dev-4-content-creators.zip",
				}),
			],
		}));
	});

	it("keeps EOI reference numbers and multiple source document links", async () => {
		const result = await gizParser.parse({
			url: "https://www.giz.de/en/regions/africa/south-africa/tenders",
			markdown: southAfricaMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toMatchObject({
			title: "Expression of Interest (7000005607): Supply and Delivery of GSM Data loggers",
			sourceId: "giz-7000005607",
			organization: "GIZ South Africa",
			countryRegion: "South Africa",
			opportunityType: "eoi",
			documentUrl: "https://www.giz.de/sites/default/files/media/els-document/2026-05/7000005607-eoi-technical-criteria-supply-and-delivery-data-loggers-suppliers-complete-final.xlsx",
		});
		expect((result.opportunities[0]?.metadata?.giz as { documentLinks: unknown[] }).documentLinks).toHaveLength(2);
	});
});
