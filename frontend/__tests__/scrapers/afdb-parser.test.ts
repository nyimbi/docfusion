import { describe, expect, it } from "vitest";

import { afdbParser, parseAfdbNoticeDetailMarkdown } from "@/lib/scrapers/parsers/afdb";

const afdbMarkdown = `
* [New procurement framework](https://www.afdb.org/en/projects-and-operations/procurement/new-procurement-policy)

26-May-2026

[EOI - Ethiopia - Development of Meteorological and Climate Mobile Application - BREFONS-Ethiopia](https://www.afdb.org/en/documents/eoi-ethiopia-development-meteorological-and-climate-mobile-application-brefons-ethiopia)

26-May-2026

[SPN - Rwanda - Upgrading works of Kinigi-Kora(28.1km) - BRIDEP](https://www.afdb.org/en/documents/spn-rwanda-upgrading-works-kinigi-kora281km-bridep)

22-May-2026

[PPM - RDC - Project procurement plan - FSRDC](https://www.afdb.org/en/documents/ppm-rdc-project-procurement-plan-fsrdc)

22-May-2026

[Contract Awards - Angola - Individual Consultant for the Position of Entrepreneurship Specialist - AYEP](https://www.afdb.org/en/documents/contract-awards-angola-individual-consultant-position-entrepreneurship-specialist-ayep)
`;

describe("AFDB parser", () => {
	it("extracts dated procurement document notices without policy or award links", async () => {
		const result = await afdbParser.parse({
			url: "https://www.afdb.org/en/projects-and-operations/procurement",
			markdown: afdbMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities.map((opportunity) => opportunity.title)).toEqual([
			"EOI - Ethiopia - Development of Meteorological and Climate Mobile Application - BREFONS-Ethiopia",
			"SPN - Rwanda - Upgrading works of Kinigi-Kora(28.1km) - BRIDEP",
		]);
		expect(result.opportunities).not.toContainEqual(expect.objectContaining({ countryRegion: "RDC" }));
		expect(result.opportunities[0]).toMatchObject({
			source: "afdb",
			organization: "African Development Bank",
			countryRegion: "Ethiopia",
			category: "Expression of interest",
			opportunityType: "eoi",
			portalUrl: "https://www.afdb.org/en/documents/eoi-ethiopia-development-meteorological-and-climate-mobile-application-brefons-ethiopia",
			documentUrl: "https://www.afdb.org/en/documents/eoi-ethiopia-development-meteorological-and-climate-mobile-application-brefons-ethiopia",
			tags: ["afdb", "development-bank", "regional-procurement"],
			metadata: {
				afdb: expect.objectContaining({
					noticePrefix: "EOI",
					language: "en",
				}),
			},
		});
		expect(result.opportunities[1]).toMatchObject({
			countryRegion: "Rwanda",
			category: "Tender",
			opportunityType: "tender",
		});
	});

	it("ranks downloadable procurement documents from AFDB detail pages", () => {
		const detail = parseAfdbNoticeDetailMarkdown(`
[Follow us on X](https://twitter.com/AfDB_Group)

[](https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi_for_meteorology_mobile_application87.pdf "Download PDF")

https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi\\_for\\_meteorology\\_mobile\\_application87.pdf
		`);

		expect(detail.primaryLink).toEqual(expect.objectContaining({
			url: "https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi_for_meteorology_mobile_application87.pdf",
		}));
		expect(detail.links.map((link) => link.url)).toEqual([
			"https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi_for_meteorology_mobile_application87.pdf",
		]);
	});
});
