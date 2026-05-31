import { describe, expect, it } from "vitest";

import { parseFindTenderReleasePackage } from "@/lib/scrapers/parsers/find-tender";

describe("UK Find a Tender OCDS parser", () => {
	it("maps active tender releases into deadline-backed opportunities", () => {
		const opportunities = parseFindTenderReleasePackage({
			releases: [{
				ocid: "ocds-h6vhtk-06abcd",
				id: "051999-2099",
				date: "2099-05-29T16:10:39+01:00",
				tag: ["tender"],
				initiationType: "tender",
				tender: {
					id: "ocds-h6vhtk-06abcd",
					title: "Digital case management platform",
					status: "active",
					classification: {
						scheme: "CPV",
						id: "72262000",
						description: "Software development services",
					},
					mainProcurementCategory: "services",
					description: "Procurement of a case management platform and implementation services.",
					value: {
						amount: 2500000,
						currency: "GBP",
					},
					procurementMethod: "open",
					procurementMethodDetails: "Open procedure",
					submissionMethod: ["electronicSubmission"],
					submissionMethodDetails: "https://buyer.example/tenders/case-platform",
					tenderPeriod: {
						startDate: "2099-05-29T16:10:39+01:00",
						endDate: "2099-07-13T12:00:00+01:00",
					},
					lots: [{
						id: "1",
						description: "Implementation, support, and training.",
						status: "active",
					}],
					items: [{
						id: "1",
						deliveryAddresses: [{
							region: "UKI",
							countryName: "United Kingdom",
						}],
					}],
				},
				buyer: {
					id: "GB-FTS-1",
					name: "Digital Services Authority",
				},
				parties: [{
					id: "GB-FTS-1",
					name: "Digital Services Authority",
					roles: ["buyer"],
					address: {
						locality: "London",
						region: "UKI",
						countryName: "United Kingdom",
					},
					contactPoint: {
						email: "procurement@example.gov.uk",
						url: "https://buyer.example/tenders",
					},
				}],
			}],
		}, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Digital case management platform",
			source: "find_tender",
			sourceId: "find-tender-051999-2099",
			noticeId: "051999-2099",
			organization: "Digital Services Authority",
			countryRegion: "United Kingdom",
			category: "Open procedure",
			sector: "Software development services",
			opportunityType: "tender",
			portalUrl: "https://www.find-tender.service.gov.uk/Notice/051999-2099",
			documentUrl: "https://buyer.example/tenders/case-platform",
			budgetNumeric: 2500000,
			budgetCurrency: "GBP",
			tags: ["find-tender", "uk", "public-procurement", "ocds", "source-api"],
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("2099-07-13T11:00:00.000Z"));
	});

	it("filters expired, non-tender, and withdrawn releases", () => {
		const opportunities = parseFindTenderReleasePackage({
			releases: [
				{
					id: "050001-2099",
					tag: ["award"],
					tender: {
						id: "050001-2099",
						title: "Award notice",
						status: "active",
						tenderPeriod: { endDate: "2099-06-30T12:00:00Z" },
					},
				},
				{
					id: "050002-2099",
					tag: ["tender"],
					tender: {
						id: "050002-2099",
						title: "Expired notice",
						status: "active",
						tenderPeriod: { endDate: "2099-01-30T12:00:00Z" },
					},
				},
				{
					id: "050003-2099",
					tag: ["tender"],
					tender: {
						id: "050003-2099",
						title: "Withdrawn notice",
						status: "withdrawn",
						tenderPeriod: { endDate: "2099-06-30T12:00:00Z" },
					},
				},
			],
		}, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toEqual([]);
	});
});
