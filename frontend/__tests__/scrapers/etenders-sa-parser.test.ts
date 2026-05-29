import { describe, expect, it } from "vitest";

import {
	etendersSaOcdsApiUrl,
	parseEtendersSaReleasePackage,
} from "@/lib/scrapers/parsers/etenders-sa";

function formatDate(value: unknown): string | undefined {
	if (!(value instanceof Date)) return undefined;
	return value.toISOString().slice(0, 10);
}

describe("South Africa eTenders parser", () => {
	it("adds the required date window and paging parameters for the OCDS endpoint", () => {
		const apiUrl = etendersSaOcdsApiUrl(
			"https://ocds-api.etenders.gov.za/api/OCDSReleases",
			new Date("2026-05-29T12:00:00Z")
		);

		expect(apiUrl).toBe("https://ocds-api.etenders.gov.za/api/OCDSReleases?PageNumber=1&PageSize=100&dateFrom=2026-04-29&dateTo=2026-05-29");
	});

	it("extracts active OCDS releases with deadlines, buyers, and direct document links", () => {
		const opportunities = parseEtendersSaReleasePackage({
			releases: [{
				ocid: "ocds-9t57fa-157517",
				id: "ocds-9t57fa-157517-2026-05-29",
				date: "2026-05-29T00:00:00Z",
				tag: ["compiled"],
				initiationType: "tender",
				buyer: { id: "167", name: "ESKOM" },
				tender: {
					id: "157517",
					title: "E2966CXMWP",
					status: "active",
					category: "Financial service activities, except insurance and pension funding",
					province: "Gauteng",
					deliveryLocation: "02 Maxwell Drive - Sunninghill - Johannesburg - 2157",
					mainProcurementCategory: "services",
					description: "Funding analysis, lender engagement and credit impact assessment.",
					procurementMethod: "open",
					procurementMethodDetails: "Request for Proposal",
					tenderPeriod: {
						startDate: "2026-05-29T00:00:00Z",
						endDate: "2026-06-19T12:00:00Z",
					},
					procuringEntity: { id: "167", name: "ESKOM" },
					value: { amount: 2500000, currency: "ZAR" },
					documents: [{
						id: "59d27a99-7b97-49d3-ab8c-c8dc31a17297",
						documentType: "basic",
						title: "RFP Letter_NTCSA Sale Final.pdf",
						url: "https://www.etenders.gov.za/home/Download?blobName=59d27a99.pdf&downloadedFileName=RFP%20Letter.pdf",
						datePublished: "2026-05-29T10:22:50Z",
						format: "pdf",
						language: "en",
					}],
					briefingSession: {
						isSession: false,
						compulsory: false,
						date: "0001-01-01T00:00:00Z",
						venue: "N/A",
					},
					contactPerson: {
						name: "Lizo Sogoni",
						email: "sogoniml@eskom.co.za",
						telephoneNumber: "067-238-5957",
					},
				},
			}, {
				ocid: "ocds-9t57fa-expired",
				id: "ocds-9t57fa-expired-2026-05-01",
				date: "2026-05-01T00:00:00Z",
				tender: {
					id: "expired",
					title: "Expired tender",
					status: "active",
					tenderPeriod: { endDate: "2026-05-20T10:00:00Z" },
				},
			}],
		}, new Date("2026-05-29T12:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "E2966CXMWP - Funding analysis, lender engagement and credit impact assessment.",
			source: "etenders_sa",
			sourceId: "etenders-sa-ocds-9t57fa-157517",
			noticeId: "157517",
			organization: "ESKOM",
			countryRegion: "South Africa - Gauteng",
			category: "Request for Proposal",
			sector: "Financial service activities, except insurance and pension funding",
			opportunityType: "rfp",
			portalUrl: "https://ocds-api.etenders.gov.za/api/OCDSReleases/release/ocds-9t57fa-157517",
			documentUrl: "https://www.etenders.gov.za/home/Download?blobName=59d27a99.pdf&downloadedFileName=RFP%20Letter.pdf",
			rfpLink: "https://www.etenders.gov.za/home/Download?blobName=59d27a99.pdf&downloadedFileName=RFP%20Letter.pdf",
			budgetNumeric: 2500000,
			budgetCurrency: "ZAR",
			tags: ["etenders-sa", "south-africa", "national-procurement", "ocds", "source-api"],
		});
		expect(formatDate(opportunities[0].publishedDate)).toBe("2026-05-29");
		expect(formatDate(opportunities[0].deadline)).toBe("2026-06-19");
		expect(opportunities[0].metadata?.etendersSa).toMatchObject({
			ocid: "ocds-9t57fa-157517",
			tenderId: "157517",
			province: "Gauteng",
		});
	});
});
