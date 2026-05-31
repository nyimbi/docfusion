import { describe, expect, it } from "vitest";

import {
	comesaParser,
	parseComesaOpenTendersHtml,
	parseComesaTenderDetailMarkdown,
} from "@/lib/scrapers/parsers/comesa";

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

	it("extracts current tender posts from COMESA WordPress archive HTML", () => {
		const opportunities = parseComesaOpenTendersHtml(`
<div class="post-list-item">
	<h3 class="post-title">
		<a href="https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/" rel="bookmark">
			Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat
		</a>
	</h3>
	<div class="post-meta small muted space-bottom-small">
		<span class="date">12/05/2026</span>
	</div>
	<div class="post-excerpt">
		<p>The COMESA Secretariat has set aside funding towards contracting a medical insurance service provider. <br /> <a class="read-more" href="https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/">Read more</a></p>
	</div>
</div>
<div class="post-list-item">
	<h3 class="post-title">
		<a href="https://www.comesa.int/procurement-of-consultancy-services-to-review-the-development-of-comesa-regional-agri-food-systems-investment-plan-rasip-2026-2031/" rel="bookmark">
			Procurement of Consultancy Services to Review the Development of COMESA Regional Agri Food Systems Investment Plan (RASIP) 2026-2031
		</a>
	</h3>
	<div class="post-meta small muted space-bottom-small">
		<span class="date">08/05/2026</span>
	</div>
	<div class="post-excerpt">
		<p>REQUEST FOR EXPRESSIONS OF INTEREST (REOI) Procurement Title: Procurement of Consultancy Services to Review RASIP. For more details visit https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems</p>
	</div>
</div>
		`);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			source: "comesa",
			sourceId: "tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-sec",
			category: "Tender",
			opportunityType: "tender",
			portalUrl: "https://www.comesa.int/tender-of-provision-of-staff-medical-insurance-cover-for-staff-of-the-comesa-secretariat/",
		});
		expect(opportunities[1]).toMatchObject({
			category: "Consultancy",
			opportunityType: "rfp",
			documentUrl: "https://www.nepad.org/tenders/procurement-of-consultancy-services-review-development-of-comesa-regional-agri-food-systems",
		});
	});

	it("ranks tender package attachments from detail pages", () => {
		const detail = parseComesaTenderDetailMarkdown(`
[Privacy Policy](https://www.comesa.int/wp-content/uploads/2022/09/Approved-Data-Privacy-Policy.pdf)

[Advert Medical Insurance](https://www.comesa.int/wp-content/uploads/2026/05/Advert-Medical-Insurance.docx)

[RFP Medical Scheme 2026 Final](https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx)
		`);

		expect(detail.primaryLink).toEqual(expect.objectContaining({
			description: "RFP Medical Scheme 2026 Final",
			url: "https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx",
		}));
		expect(detail.links.map((link) => link.url)).toEqual([
			"https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx",
			"https://www.comesa.int/wp-content/uploads/2026/05/Advert-Medical-Insurance.docx",
		]);
	});
});
