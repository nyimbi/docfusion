import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ebrdParser,
	parseEbrdNoticeApiResponse,
	parseEbrdDate,
} from "@/lib/scrapers/parsers/ebrd";

const ebrdApiResponse = {
	resultCount: [{ resultCount: 2, cardType: "procurement-notices" }],
	searchResult: [
		{
			pagePath: "/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices/syunik-customs-and-logistics-centre-9730-oth-54703.html",
			title: "Syunik Customs and Logistics Centre 9730-OTH-54703",
			projectUrl: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices/syunik-customs-and-logistics-centre-9730-oth-54703.html",
			projectCountry: "Armenia",
			projectSector: "Municipal Infrastructure",
			projectContractType: "Other Notices",
			projectNoticeType: "Invitation for expressions of interest",
			projectIssueDate: "18 May 2026",
			projectCloseDate: "18 Mar 2027",
		},
		{
			pagePath: "/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices/energy-market-surveillance-system--remit--for-ukraine.html",
			title: "Energy Market Surveillance System (REMIT) for Ukraine",
			projectUrl: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices/energy-market-surveillance-system--remit--for-ukraine.html",
			projectCountry: "Ukraine",
			projectSector: "Power and energy",
			projectContractType: "Project goods, works and services",
			projectNoticeType: "General Procurement Notices",
			projectIssueDate: "08 Apr 2026",
			projectCloseDate: "31 May 2026",
		},
	],
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("EBRD parser", () => {
	it("extracts procurement notice opportunities from the public filter endpoint response", () => {
		const result = parseEbrdNoticeApiResponse(ebrdApiResponse);

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			title: "Syunik Customs and Logistics Centre 9730-OTH-54703",
			source: "ebrd",
			sourceId: "ebrd-9730-OTH-54703",
			noticeId: "9730-OTH-54703",
			organization: "European Bank for Reconstruction and Development",
			countryRegion: "Armenia",
			sector: "Municipal Infrastructure",
			category: "Invitation for expressions of interest",
			opportunityType: "eoi",
			portalUrl: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices/syunik-customs-and-logistics-centre-9730-oth-54703.html",
			documentUrl: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices/syunik-customs-and-logistics-centre-9730-oth-54703.html",
			tags: ["ebrd", "development-bank", "global-procurement", "source-scrape"],
			metadata: {
				ebrd: expect.objectContaining({
					contractType: "Other Notices",
					noticeType: "Invitation for expressions of interest",
					resultCount: 2,
				}),
			},
		});
		expect(result[1]).toMatchObject({
			countryRegion: "Ukraine",
			opportunityType: "tender",
		});
	});

	it("posts the discovered AEM search configuration to EBRD's filter endpoint", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ebrdApiResponse,
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await ebrdParser.parse({
			url: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
			html: `<section data-cardType="procurement-notices" data-filterPath="/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices"></section>`,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.ebrd.com/bin/ebrd_dxp/filterlistservlet",
			expect.objectContaining({
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded;charset=UTF-8",
				},
			})
		);
		const requestBody = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
		expect(requestBody.get("parentPath")).toBe("/content/ebrd_dxp/uk/en/home/work-with-us/project-procurement/procurement-notices");
		expect(requestBody.get("cardType")).toBe("procurement-notices");
		expect(requestBody.get("sortBy")).toBe("newest-first");
	});

	it("reports endpoint failures without fabricating opportunities", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			ok: false,
			status: 503,
			json: async () => ({}),
		}));

		const result = await ebrdParser.parse({
			url: "https://www.ebrd.com/home/work-with-us/project-procurement.html",
			markdown: "EBRD project procurement",
		});

		expect(result.opportunities).toEqual([]);
		expect(result.error).toBe("EBRD filter endpoint returned HTTP 503");
	});

	it("parses EBRD date labels", () => {
		expect(parseEbrdDate("18 May 2026")).toEqual(new Date(Date.parse("18 May 2026")));
		expect(parseEbrdDate("")).toBeUndefined();
	});
});
