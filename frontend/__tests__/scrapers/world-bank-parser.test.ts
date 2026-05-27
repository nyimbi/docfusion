import { describe, expect, it } from "vitest";

import { worldBankParser } from "@/lib/scrapers/parsers/world-bank";

const worldBankMarkdown = `
| Description | Country | Project Title | Notice Type | Language | Published Date |
| --- | --- | --- | --- | --- | --- |
| [Contratacao de Especialista em Conectividade](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547) | Angola | [Angola Digital Acceleration Project - P180693](http://projects.worldbank.org/en/projects-operations/project-detail/P180693) | Request for Expression of Interest | Portuguese | May 25, 2026 |
| [Procurement of Battery Energy Storage Systems](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00431982) | Ukraine | [Improving Power System Resilience - P176114](http://projects.worldbank.org/en/projects-operations/project-detail/P176114) | Invitation for Bids | English | May 25, 2026 |
| [Awarded consultant contract](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00440000) | Kenya | [Awarded Project - P100000](http://projects.worldbank.org/en/projects-operations/project-detail/P100000) | Contract Award | English | May 25, 2026 |
`;

describe("World Bank parser", () => {
	it("extracts procurement notice table rows without award rows", async () => {
		const result = await worldBankParser.parse({
			url: "https://projects.worldbank.org/en/projects-operations/procurement",
			markdown: worldBankMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities.map((opportunity) => opportunity.title)).toEqual([
			"Contratacao de Especialista em Conectividade",
			"Procurement of Battery Energy Storage Systems",
		]);
		expect(result.opportunities).not.toContainEqual(expect.objectContaining({ noticeId: "OP00440000" }));
		expect(result.opportunities[0]).toMatchObject({
			source: "world_bank",
			sourceId: "OP00428547",
			noticeId: "OP00428547",
			organization: "World Bank",
			countryRegion: "Angola",
			category: "Request for Expression of Interest",
			opportunityType: "eoi",
			portalUrl: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547",
			documentUrl: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547",
			tags: ["world-bank", "development-bank", "global-procurement"],
			metadata: {
				worldBank: expect.objectContaining({
					projectTitle: "Angola Digital Acceleration Project - P180693",
					projectUrl: "https://projects.worldbank.org/en/projects-operations/project-detail/P180693",
					noticeType: "Request for Expression of Interest",
					language: "Portuguese",
				}),
			},
		});
		expect(result.opportunities[1]).toMatchObject({
			sourceId: "OP00431982",
			countryRegion: "Ukraine",
			category: "Invitation for Bids",
			opportunityType: "tender",
		});
	});
});
