import { describe, expect, it } from "vitest";

import { parseContractsFinderReleasePackage } from "@/lib/scrapers/parsers/contracts-finder";

describe("UK Contracts Finder OCDS parser", () => {
	it("maps active tender releases into stable source-backed opportunities", () => {
		const opportunities = parseContractsFinderReleasePackage({
			releases: [{
				ocid: "ocds-b5fd17-07ec2535-27cf-4ca2-86e0-3298e6c1b3af",
				id: "5f8725b0-d8ae-49a5-93a1-978d948733b3-899683",
				date: "2099-05-29T15:09:40+01:00",
				tag: ["tenderAmendment"],
				initiationType: "tender",
				tender: {
					id: "Digital assessments for businesses",
					title: "The Delivery of a Digital Assessment to Action Programme",
					description: "Provide small businesses with a digital assessment and action plan.",
					datePublished: "2099-05-19T12:04:39+01:00",
					status: "active",
					classification: {
						scheme: "CPV",
						id: "72000000",
						description: "IT services: consulting, software development, Internet and support",
					},
					additionalClassifications: [{
						id: "73000000",
						description: "Research and development services and related consultancy services",
					}],
					value: {
						amount: 10000,
						currency: "GBP",
					},
					procurementMethod: "open",
					procurementMethodDetails: "Open procedure",
					tenderPeriod: {
						endDate: "2099-06-08T09:00:00+01:00",
					},
					mainProcurementCategory: "services",
					documents: [
						{
							id: "1",
							documentType: "tenderNotice",
							description: "Opportunity notice on Contracts Finder",
							url: "https://www.contractsfinder.service.gov.uk/Notice/5f8725b0-d8ae-49a5-93a1-978d948733b3",
							format: "text/html",
						},
						{
							id: "2",
							documentType: "technicalSpecifications",
							description: "Specification",
							url: "https://www.contractsfinder.service.gov.uk/Notice/Attachment/01ac2251-35eb-4dbb-b0e1-0de57ddee11b",
							format: "application/pdf",
						},
					],
					items: [{
						id: "1",
						deliveryAddresses: [{
							region: "South East",
							countryName: "United Kingdom",
						}],
					}],
				},
				parties: [{
					id: "GB-CFS-1",
					name: "Winchester City Council",
					roles: ["buyer"],
					address: {
						countryName: "England",
					},
					contactPoint: {
						name: "Emily Reason",
						email: "ereason@example.gov.uk",
					},
				}],
				buyer: {
					id: "GB-CFS-1",
					name: "Winchester City Council",
				},
			}],
		}, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "The Delivery of a Digital Assessment to Action Programme",
			source: "contracts_finder",
			sourceId: "contracts-finder-5f8725b0-d8ae-49a5-93a1-978d948733b3",
			noticeId: "5f8725b0-d8ae-49a5-93a1-978d948733b3",
			organization: "Winchester City Council",
			countryRegion: "England",
			category: "Open procedure",
			sector: "IT services: consulting, software development, Internet and support",
			opportunityType: "rfp",
			portalUrl: "https://www.contractsfinder.service.gov.uk/Notice/5f8725b0-d8ae-49a5-93a1-978d948733b3",
			documentUrl: "https://www.contractsfinder.service.gov.uk/Notice/Attachment/01ac2251-35eb-4dbb-b0e1-0de57ddee11b",
			budgetNumeric: 10000,
			budgetCurrency: "GBP",
			tags: ["contracts-finder", "uk", "public-procurement", "ocds", "source-api"],
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("2099-06-08T08:00:00.000Z"));
		expect(opportunities[0]?.metadata?.contractsFinder).toMatchObject({
			documentLinks: expect.arrayContaining([
				expect.objectContaining({
					url: "https://www.contractsfinder.service.gov.uk/Notice/Attachment/01ac2251-35eb-4dbb-b0e1-0de57ddee11b",
					format: "application/pdf",
				}),
			]),
		});
	});

	it("deduplicates amendments and filters expired, award-only, and withdrawn releases", () => {
		const opportunities = parseContractsFinderReleasePackage({
			releases: [
				{
					ocid: "ocds-b5fd17-same",
					id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa-899683",
					tag: ["tenderAmendment"],
					tender: {
						id: "first",
						title: "First amended notice",
						status: "active",
						tenderPeriod: { endDate: "2099-06-08T09:00:00+01:00" },
					},
				},
				{
					ocid: "ocds-b5fd17-same",
					id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa-899621",
					tag: ["tenderAmendment"],
					tender: {
						id: "second",
						title: "Older amended notice",
						status: "active",
						tenderPeriod: { endDate: "2099-06-08T09:00:00+01:00" },
					},
				},
				{
					id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
					tag: ["award"],
					tender: {
						id: "award",
						title: "Award notice",
						status: "active",
						tenderPeriod: { endDate: "2099-06-30T12:00:00Z" },
					},
				},
				{
					id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
					tag: ["tender"],
					tender: {
						id: "expired",
						title: "Expired notice",
						status: "active",
						tenderPeriod: { endDate: "2099-01-30T12:00:00Z" },
					},
				},
				{
					id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
					tag: ["tender"],
					tender: {
						id: "withdrawn",
						title: "Withdrawn notice",
						status: "withdrawn",
						tenderPeriod: { endDate: "2099-06-30T12:00:00Z" },
					},
				},
			],
		}, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]?.title).toBe("First amended notice");
		expect(opportunities[0]?.sourceId).toBe("contracts-finder-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
	});
});
