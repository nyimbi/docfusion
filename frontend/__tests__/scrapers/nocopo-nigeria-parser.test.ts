import { describe, expect, it } from "vitest";

import {
	NOCOPO_OPEN_DATA_URL,
	parseNocopoPublishedRecordResponse,
} from "@/lib/scrapers/parsers/nocopo-nigeria";

const sampleResponse = JSON.stringify({
	iTotalRecords: 99447,
	iTotalDisplayRecords: 99421,
	aaData: [
		{
			TotalCount: 99421,
			ID: 263331,
			MDA_NAME_ONLY: "FEDERAL COLLEGE OF FORESTRY IBADAN",
			MDA_Code: "ocds-gyl66f-535011001-000010",
			pi_Project_Title: "Procurement of Laboratory and ICT Equipment, Workshop, Farm Machinery and Implements",
			pi_Package_Number: "FCF/24/01",
			pi_Lot_Number: "LOT 1",
			DatePublished: "2026-05-29T16:24:34.607",
			pb_BudgetYear: "2024",
			pb_Project_State_Item: "OYO",
			bd_Procurement_Category_FK_Item: "Goods",
			bd_Procurement_Method_FK_Item: "Open Competitive Bidding",
			bd_Contract_type_FK_Item: "Framework Contract",
			pb_Project_Estimated_Currency_FK_Item: "NGN",
			pb_Project_Estimated_Amount: 1250000,
			tp_Tendering_Period_End_Date: "2026-06-12T10:00:00",
		},
		{
			ID: 263332,
			MDA_NAME_ONLY: "FEDERAL COLLEGE OF FORESTRY IBADAN",
			MDA_Code: "ocds-gyl66f-535011001-000011",
			pi_Project_Title: "Construction and Rehabilitation, Furnishing of College Building and Spot Pavilion",
			DatePublished: "2026-05-29T16:22:45.127",
			tp_Tendering_Period_End_Date: "0001-01-01T00:00:00",
		},
	],
});

describe("NOCOPO Nigeria parser", () => {
	it("normalizes public published-record JSON into opportunities", () => {
		const opportunities = parseNocopoPublishedRecordResponse(sampleResponse);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Procurement of Laboratory and ICT Equipment, Workshop, Farm Machinery and Implements",
			source: "nocopo_nigeria",
			sourceId: "nocopo-ocds-gyl66f-535011001-000010",
			noticeId: "ocds-gyl66f-535011001-000010",
			organization: "FEDERAL COLLEGE OF FORESTRY IBADAN",
			countryRegion: "Nigeria - OYO",
			category: "Goods",
			opportunityType: "contract",
			budgetCurrency: "NGN",
			budgetNumeric: 1250000,
			portalUrl: `${NOCOPO_OPEN_DATA_URL}?search=ocds-gyl66f-535011001-000010`,
			rfpLink: "https://nocopo.bpp.gov.ng/downloadJson.ashx?ty=1&ocid=ocds-gyl66f-535011001-000010",
			submissionMethod: "Use the Nigeria Open Contracting Portal record to inspect the procurement package and contracting authority details.",
			tags: ["nocopo", "nigeria", "open-contracting", "national-procurement", "source-api"],
		});
		expect(opportunities[0]?.publishedDate).toEqual(new Date("2026-05-29T16:24:34.607"));
		expect(opportunities[0]?.deadline).toEqual(new Date("2026-06-12T10:00:00"));
		expect(opportunities[0]?.projectSummary).toContain("Package: FCF/24/01");
		expect(opportunities[0]?.projectSummary).toContain("OCDS JSON:");
		expect(opportunities[0]?.metadata?.nocopo).toMatchObject({
			id: 263331,
			ocid: "ocds-gyl66f-535011001-000010",
			totalCount: 99421,
			packageNumber: "FCF/24/01",
			lotNumber: "LOT 1",
		});
	});

	it("drops sentinel year-one dates instead of creating false deadlines", () => {
		const opportunities = parseNocopoPublishedRecordResponse(sampleResponse);

		expect(opportunities[1]?.deadline).toBeUndefined();
		expect(opportunities[1]?.publishedDate).toEqual(new Date("2026-05-29T16:22:45.127"));
	});
});
