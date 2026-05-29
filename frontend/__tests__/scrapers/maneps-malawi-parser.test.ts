import { describe, expect, it } from "vitest";

import {
	manepsMalawiParser,
	parseManepsActiveTendersResponse,
	type ManepsActiveTendersResponse,
} from "@/lib/scrapers/parsers/maneps-malawi";

const activeTendersResponse: ManepsActiveTendersResponse = {
	count: 2,
	data: [
		{
			id: "ac48e846-41c3-4ff3-9755-4361e30739de",
			objectType: "RFX",
			name: "Procurement of Blank Number Plate",
			description: "Procurement of blank number plate",
			procurementCategory: "Goods",
			procurementReferenceNumber: "PVHES-0057-3-26",
			status: "Published",
			budgetAmount: 22000000,
			budgetAmountCurrency: "MWK",
			organizationName: "Plant & Vehicle Hire and Engineering Services",
			publishedDate: "2026-05-29T17:00:00.000Z",
			closingDate: "2026-06-03T07:00:00.000Z",
			tenderProcurementMechanism: {
				PRProcurementMechanisms: {
					organizationName: "Plant & Vehicle Hire and Engineering Services",
					fundingSource: "Internal Revenue",
					procurementMethod: "Request for Quotation (RFQ)",
					procurementType: "Goods",
					targetGroup: ["Medium Enterprises"],
					isOnline: true,
					invitationType: "open",
					stage: "Single",
					marketType: "National",
				},
			},
		},
		{
			id: "53f97d63-fd97-43ca-99dc-29ff84dcd551",
			objectType: "RFX",
			name: "Airticket",
			description: "Consultancy support travel for programme implementation",
			procurementCategory: "Non Consultancy Services",
			procurementReferenceNumber: "013-0121-1-26",
			status: "Published",
			organizationName: "National Aids Commission (NAC)",
			publishedDate: "2026-05-29T10:55:00.000Z",
			closingDate: "2026-06-01T10:00:00.000Z",
			tenderProcurementMechanism: {
				PRProcurementMechanisms: {
					procurementMethod: "Request for Proposal",
					procurementType: "Non Consultancy Services",
					invitationType: "open",
					marketType: "National",
				},
			},
		},
	],
};

describe("MANEPS Malawi parser", () => {
	it("extracts active tender API records with Malawi source metadata", () => {
		const opportunities = parseManepsActiveTendersResponse(activeTendersResponse, new Date("2026-05-29T12:00:00Z"));

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Procurement of Blank Number Plate",
			source: "maneps_malawi",
			sourceId: "maneps-ac48e846-41c3-4ff3-9755-4361e30739de",
			noticeId: "PVHES-0057-3-26",
			organization: "Plant & Vehicle Hire and Engineering Services",
			countryRegion: "Malawi",
			category: "Request for Quotation (RFQ)",
			sector: "Goods",
			opportunityType: "tender",
			portalUrl: "https://maneps.mw/procurement-notice/rfx/ac48e846-41c3-4ff3-9755-4361e30739de",
			rfpLink: "https://maneps.mw/procurement-notice/rfx/ac48e846-41c3-4ff3-9755-4361e30739de",
			budgetNumeric: 22000000,
			budgetCurrency: "MWK",
			budgetValue: "MWK 22000000",
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("2026-06-03T07:00:00.000Z"));
		expect(opportunities[0]?.publishedDate).toEqual(new Date("2026-05-29T17:00:00.000Z"));
		expect(opportunities[1]).toMatchObject({
			sourceId: "maneps-53f97d63-fd97-43ca-99dc-29ff84dcd551",
			opportunityType: "rfp",
			organization: "National Aids Commission (NAC)",
		});
	});

	it("supports the TenderParser interface from JSON payloads", async () => {
		const result = await manepsMalawiParser.parse({
			html: JSON.stringify(activeTendersResponse),
			url: "https://maneps.mw/rms/api/tender-notices/active-tenders-search",
		});

		expect(result.error).toBeUndefined();
		expect(result.opportunities.map((opportunity) => opportunity.sourceId)).toEqual([
			"maneps-ac48e846-41c3-4ff3-9755-4361e30739de",
			"maneps-53f97d63-fd97-43ca-99dc-29ff84dcd551",
		]);
		expect(manepsMalawiParser.getPageUrl("", 1)).toBe("https://maneps.mw/rms/api/tender-notices/active-tenders-search");
	});
});
