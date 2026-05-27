import { describe, expect, it } from "vitest";

import { comesaParser } from "@/lib/scrapers/parsers/comesa";

const comesaMarkdown = `
* [Open Tenders](https://www.comesa.int/category/open-tenders/)
* [Awarded Tenders](https://www.comesa.int/category/opportunities/awarded/)

[](https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/)

### [Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat](https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/)

12/05/2026

The COMESA Secretariat has set aside funding from its 2025/2026 annual budget and intends to apply part of the proceeds of the budget towards contracting a medical insurance service provider to provide Medical Insurance cover for the COMESA Secretariat Staff.
[Read more](https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/)

[](https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/)

### [Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031](https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/)

08/05/2026

REQUEST FOR EXPRESSIONS OF INTEREST (REOI) Procurement Title: Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031 For more details visit https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems
`;

describe("COMESA parser", () => {
	it("extracts dated open-tender posts without navigation category links", async () => {
		const result = await comesaParser.parse({
			url: "https://www.comesa.int/category/open-tenders/",
			markdown: comesaMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities.map((opportunity) => opportunity.title)).toEqual([
			"Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat",
			"Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031",
		]);
		expect(result.opportunities).not.toContainEqual(expect.objectContaining({ title: "Open Tenders" }));
		expect(result.opportunities[0]).toMatchObject({
			source: "comesa",
			organization: "COMESA Secretariat",
			countryRegion: "Eastern and Southern Africa",
			category: "Tender",
			opportunityType: "tender",
			portalUrl: "https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/",
			tags: ["comesa", "regional-procurement"],
		});
		expect(result.opportunities[1]).toMatchObject({
			category: "Consultancy",
			documentUrl: "https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems",
		});
	});
});
