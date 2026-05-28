import { afterEach, describe, expect, it, vi } from "vitest";

import { aiibParser } from "@/lib/scrapers/parsers/aiib";

const aiibDataScript = `
var ppoData = [
{id:"May 27, 2026",cd:"",mb:"Azerbaijan",pj:"Baku Metro Expansion Project - Phase II (Green Line)",ds:"",cr:"",sd:"",pc:"",st:"Transport",ct:"Notices",tp:"General Procurement Notice",dc:"/en/projects/details/2026/_download/Azerbaijan/BMEP_P2-General-Procurement-Notice-GPN-rev01-EN-1.pdf"},
{id:"May 12, 2026",cd:"June 10,2026",mb:"Pakistan",pj:"Reconstruction of National Highway N-5 under Pakistan&#8217;s Resilient Recovery, Rehabilitation and Reconstruction Framework Project",ds:"",cr:"",sd:"",pc:"",st:"Transport",ct:"Notices",tp:"Extension of Tender Submission",dc:"/en/projects/details/2026/_download/Pakistan/Corrigendum-No-01-1.pdf"},
{id:"May 6, 2026",cd:"June 16, 2026",mb:"Uzbekistan",pj:"Bukhara Region Water Supply and Sewerage Project - Phase 1",ds:"",cr:"",sd:"",pc:"",st:"Water",ct:"Notices",tp:"Specific Procurement Notice",dc:"/en/projects/details/2026/_download/Uzbekistan/BWSP21-22-PESH-SPN_Final.pdf"},
{id:"April 22, 2026",cd:"",mb:"India",pj:"Andhra Pradesh Urban Water Supply and Septage Management Improvement",ds:"Water Supply Improvement Schemes",cr:"M/s. Megha Engineering and Infrastructures Limited",sd:"N/A",pc:"INR 4,647,906,559.31",st:"Water",ct:"Contract Awards",tp:"Contract Award Notice",dc:"/en/projects/details/2026/_download/India/Contract_Award.pdf"},
{id:"April 21, 2026",cd:"April 30, 2026",mb:"Tajikistan",pj:"Rogun Hydropower Development Project - Phase 1",ds:"",cr:"",sd:"",pc:"",st:"Energy",ct:"Notices",tp:"Specific Procurement Notice",dc:"/en/projects/details/2026/_download/Tajikistan/SPN_final.pdf"}
];
`;

describe("AIIB project procurement parser", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("extracts current project procurement notices from AIIB data script", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 28));

		const result = await aiibParser.parse({
			url: "https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
			html: aiibDataScript,
			links: [],
		});

		expect(result.opportunities).toHaveLength(3);
		expect(result.opportunities[0]).toMatchObject({
			title: "Baku Metro Expansion Project - Phase II (Green Line)",
			source: "aiib",
			sourceId: "aiib-bmep-p2-general-procurement-notice-gpn-rev01",
			organization: "Asian Infrastructure Investment Bank",
			countryRegion: "Azerbaijan",
			category: "General Procurement Notice",
			opportunityType: "tender",
			portalUrl: "https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
			documentUrl: "https://www.aiib.org/en/projects/details/2026/_download/Azerbaijan/BMEP_P2-General-Procurement-Notice-GPN-rev01-EN-1.pdf",
			rfpLink: "https://www.aiib.org/en/projects/details/2026/_download/Azerbaijan/BMEP_P2-General-Procurement-Notice-GPN-rev01-EN-1.pdf",
			tags: ["aiib", "development-bank", "project-procurement", "source-scrape"],
		});
		expect(result.opportunities[1]).toMatchObject({
			countryRegion: "Pakistan",
			opportunityType: "tender",
			deadline: new Date(2026, 5, 10),
		});
		expect(result.opportunities[2]).toMatchObject({
			countryRegion: "Uzbekistan",
			deadline: new Date(2026, 5, 16),
		});
		expect(result.opportunities.map((opportunity) => opportunity.title)).not.toContain("Rogun Hydropower Development Project - Phase 1");
		expect(result.opportunities.map((opportunity) => opportunity.category)).not.toContain("Contract Award Notice");
	});

	it("fetches the list page and current data script when scraper content is empty", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 28));
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: async () => "<script src=\"/en/opportunities/business/project-procurement/_common/ppo-data-all.js?t=1775103189438\"></script>",
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () => aiibDataScript,
			});
		vi.stubGlobal("fetch", fetchMock);

		const result = await aiibParser.parse({
			url: "https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
			html: "<html><body>AIIB opportunities</body></html>",
			links: [],
		});

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
			expect.objectContaining({ headers: expect.any(Object) })
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://www.aiib.org/en/opportunities/business/project-procurement/_common/ppo-data-all.js?t=1775103189438",
			expect.objectContaining({ headers: expect.any(Object) })
		);
		expect(result.opportunities).toHaveLength(3);
		expect(result.error).toBeUndefined();
	});
});
