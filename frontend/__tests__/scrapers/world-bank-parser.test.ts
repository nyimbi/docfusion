import { afterEach, describe, expect, it, vi } from "vitest";

import {
	parseWorldBankNoticeListApiResponse,
	parseWorldBankNoticeDetailApiResponse,
	parseWorldBankNoticeDetailMarkdown,
	worldBankNoticeApiUrl,
	worldBankNoticeListFallbackApiUrl,
	worldBankNoticeListApiUrl,
	worldBankParser,
} from "@/lib/scrapers/parsers/world-bank";

const worldBankMarkdown = `
| Description | Country | Project Title | Notice Type | Language | Published Date |
| --- | --- | --- | --- | --- | --- |
| [Contratacao de Especialista em Conectividade](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00428547) | Angola | [Angola Digital Acceleration Project - P180693](http://projects.worldbank.org/en/projects-operations/project-detail/P180693) | Request for Expression of Interest | Portuguese | May 25, 2026 |
| [Procurement of Battery Energy Storage Systems](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00431982) | Ukraine | [Improving Power System Resilience - P176114](http://projects.worldbank.org/en/projects-operations/project-detail/P176114) | Invitation for Bids | English | May 25, 2026 |
| [Awarded consultant contract](http://projects.worldbank.org/en/projects-operations/procurement-detail/OP00440000) | Kenya | [Awarded Project - P100000](http://projects.worldbank.org/en/projects-operations/project-detail/P100000) | Contract Award | English | May 25, 2026 |
`;

afterEach(() => {
	vi.unstubAllGlobals();
});

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

	it("extracts rich detail fields from procurement notice pages", () => {
		const detail = parseWorldBankNoticeDetailMarkdown(`
Overview
--------

#### NOTICE AT-A-GLANCE

*   Project ID

    P180693

*   Project Title

    Angola Digital Acceleration Project

*   Notice No

    OP00428547

*   Notice Type

    Request for Expression of Interest

*   Borrower Bid Reference

    05./C-105/COMP.1/ICS/PADA-2026/005

*   Procurement Method

    Individual Consultant Selection

*   Language of Notice

    Portuguese

*   Submission Deadline Date/Time

    May 29, 2026 15:00

*   Published Date

    May 25, 2026

#### CONTACT INFORMATION

*   Organization/Department

    Institute of Administrative Modernization

*   Email

    [consultor.conectividade@ima.gov.ao](mailto:consultor.conectividade@ima.gov.ao)

Details
-------

**SOLICITACAO DE MANIFESTACAO DE INTERESSE**

The services include support to digital infrastructure planning and supervision.

Feedback Survey
		`);

		expect(detail).toMatchObject({
			projectId: "P180693",
			projectTitle: "Angola Digital Acceleration Project",
			noticeNo: "OP00428547",
			noticeType: "Request for Expression of Interest",
			borrowerBidReference: "05./C-105/COMP.1/ICS/PADA-2026/005",
			procurementMethod: "Individual Consultant Selection",
			language: "Portuguese",
			organization: "Institute of Administrative Modernization",
			contactEmail: "consultor.conectividade@ima.gov.ao",
		});
		expect(detail.submissionDeadline).toEqual(new Date(Date.parse("May 29, 2026 15:00")));
		expect(detail.publishedDate).toEqual(new Date(2026, 4, 25));
		expect(detail.details).toContain("SOLICITACAO DE MANIFESTACAO DE INTERESSE");
		expect(detail.details).toContain("digital infrastructure planning");
	});

	it("extracts rich detail fields from the public World Bank notice API", () => {
		const detail = parseWorldBankNoticeDetailApiResponse({
			procnotices: [{
				id: "OP00428547",
				notice_type: "Request for Expression of Interest",
				noticedate: "25-May-2026",
				notice_lang_name: "Portuguese",
				submission_deadline_date: "2026-05-29T00:00:00Z",
				submission_deadline_time: "15:00",
				project_id: "P180693",
				project_name: "Angola Digital Acceleration Project",
				bid_reference_no: "05./C-105/COMP.1/ICS/PADA-2026/005",
				procurement_method_name: "Individual Consultant Selection",
				contact_email: "consultor.conectividade@ima.gov.ao",
				contact_organization: "Institute of Administrative Modernization",
				notice_text: "<p><strong>SOLICITA&Ccedil;&Atilde;O DE MANIFESTA&Ccedil;&Atilde;O DE INTERESSE</strong></p><p>Support to digital infrastructure planning.</p>",
			}],
		});

		expect(worldBankNoticeApiUrl("OP00428547")).toBe("https://search.worldbank.org/api/procnotices?format=json&apilang=en&id=OP00428547");
		expect(detail).toMatchObject({
			projectId: "P180693",
			projectTitle: "Angola Digital Acceleration Project",
			noticeNo: "OP00428547",
			noticeType: "Request for Expression of Interest",
			borrowerBidReference: "05./C-105/COMP.1/ICS/PADA-2026/005",
			procurementMethod: "Individual Consultant Selection",
			language: "Portuguese",
			organization: "Institute of Administrative Modernization",
			contactEmail: "consultor.conectividade@ima.gov.ao",
		});
		expect(detail.submissionDeadline).toEqual(new Date(Date.parse("2026-05-29 15:00")));
		expect(detail.publishedDate).toEqual(new Date(2026, 4, 25));
		expect(detail.details).toContain("SOLICITACAO DE MANIFESTACAO DE INTERESSE");
		expect(detail.details).toContain("digital infrastructure planning");
	});

	it("maps public World Bank notice API list records into active procurement opportunities", () => {
		const opportunities = parseWorldBankNoticeListApiResponse({
			procnotices: [
				{
					id: "OP00440843",
					bid_description: "Support the development of energy management systems and capacity building",
					project_ctry_name: "Viet Nam",
					project_id: "P164938",
					project_name: "Vietnam Scaling Up Energy Efficiency Project",
					notice_type: "Request for Expression of Interest",
					notice_status: "Published",
					notice_lang_name: "English",
					noticedate: "26-May-2026",
				},
				{
					id: "OP00440000",
					bid_description: "Awarded consultant contract",
					project_ctry_name: "Kenya",
					project_name: "Awarded Project",
					notice_type: "Contract Award",
					notice_status: "Published",
					notice_lang_name: "English",
					noticedate: "26-May-2026",
				},
			],
		});

		expect(worldBankNoticeListApiUrl(5, 10)).toContain("/api/v2/procnotices");
		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Support the development of energy management systems and capacity building",
			source: "world_bank",
			sourceId: "OP00440843",
			noticeId: "OP00440843",
			organization: "World Bank",
			countryRegion: "Viet Nam",
			category: "Request for Expression of Interest",
			opportunityType: "eoi",
			portalUrl: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00440843",
			documentUrl: "https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00440843",
			tags: ["world-bank", "development-bank", "global-procurement", "api-list"],
			metadata: {
				worldBank: expect.objectContaining({
					projectTitle: "Vietnam Scaling Up Energy Efficiency Project",
					projectUrl: "https://projects.worldbank.org/en/projects-operations/project-detail/P164938",
					noticeType: "Request for Expression of Interest",
					noticeStatus: "Published",
					language: "English",
					discoveryMethod: "procnotices-api-v2",
				}),
			},
		});
	});

	it("uses the public notice list API when called as a source API parser", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				procnotices: [{
					id: "OP00440843",
					bid_description: "Support the development of energy management systems and capacity building",
					project_ctry_name: "Viet Nam",
					project_id: "P164938",
					project_name: "Vietnam Scaling Up Energy Efficiency Project",
					notice_type: "Request for Expression of Interest",
					notice_status: "Published",
					notice_lang_name: "English",
					noticedate: "26-May-2026",
				}],
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const result = await worldBankParser.parse({
			url: "https://projects.worldbank.org/en/projects-operations/procurement",
			sourceLimit: 75,
		});

		expect(fetchMock).toHaveBeenCalledWith(worldBankNoticeListApiUrl(75, 0), expect.objectContaining({
			headers: { Accept: "application/json" },
		}));
		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toMatchObject({
			source: "world_bank",
			sourceId: "OP00440843",
			title: "Support the development of energy management systems and capacity building",
			tags: ["world-bank", "development-bank", "global-procurement", "api-list"],
		});
	});

	it("falls back to the lean public notice list API when the faceted query fails", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					procnotices: [{
						id: "OP00447514",
						bid_description: "Procurement of climate resilience consulting services",
						project_ctry_name: "Western and Central Africa",
						project_id: "P178132",
						project_name: "West Africa Food System Resilience Program",
						notice_type: "Request for Expression of Interest",
						notice_status: "Published",
						notice_lang_name: "English",
						noticedate: "28-May-2026",
					}],
				}),
			});
		vi.stubGlobal("fetch", fetchMock);

		const result = await worldBankParser.parse({
			url: "https://projects.worldbank.org/en/projects-operations/procurement",
			sourceLimit: 125,
		});

		expect(fetchMock).toHaveBeenNthCalledWith(1, worldBankNoticeListApiUrl(125, 0), expect.objectContaining({
			headers: { Accept: "application/json" },
		}));
		expect(fetchMock).toHaveBeenNthCalledWith(2, worldBankNoticeListFallbackApiUrl(125, 0), expect.objectContaining({
			headers: { Accept: "application/json" },
		}));
		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toMatchObject({
			source: "world_bank",
			sourceId: "OP00447514",
			title: "Procurement of climate resilience consulting services",
			category: "Request for Expression of Interest",
			opportunityType: "eoi",
		});
	});
});
