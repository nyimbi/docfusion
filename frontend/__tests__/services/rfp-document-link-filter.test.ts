import { describe, expect, it } from "vitest";

import { isLowValueProcurementDocumentLink } from "@/lib/services/rfp-document-link-filter";

describe("RFP document link filtering", () => {
	it("rejects award/report documents before they consume source-document or parser capacity", () => {
		expect(isLowValueProcurementDocumentLink({
			label: "Contract awards above USD 100K",
			url: "https://example.org/UNwomen-ContractAwardsAboveUSD100K-2025.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			url: "https://example.org/UNwomen-ContractAwardsAboveUSD100K-2016.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "Notice of Award RFP23-6059 - Preferred Supplier for Graphic Designers and Illustrators",
			url: "https://example.org/documents/Notice%20of%20Award%20RFP23-6059.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "Annual Report",
			url: "https://example.org/reports/annual-report-2025.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "Supplier Code of Conduct",
			url: "https://example.org/supplier-code-of-conduct.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "JAGGAER supplier guide",
			url: "https://example.org/Jaggaer_Supplier_Guide_V3.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			url: "https://example.org/Jaggaer_Supplier_Guide_V3.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			url: "https://example.org/Cover_page.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			url: "https://example.org/Regret_Letter_for_Unsuccessful_Suppliers.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			url: "https://example.org/Tender_Cancellation_Letter_Template_for_Invitation_to_Tender_01.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "Quality Control Plan or Inspection Test Plan QCP or ITP",
			url: "https://example.org/240-109253302_QCP_or_ITP_rev_2.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "Satellite procurement solutions",
			url: "https://example.org/PRESS%20RELEASES/satellite-procurement-solutions.pdf",
		})).toBe(true);
	});

	it("keeps active solicitations and terms of reference eligible", () => {
		expect(isLowValueProcurementDocumentLink({
			label: "Request for Proposals - digital platform",
			url: "https://example.org/rfp-digital-platform.pdf",
		})).toBe(false);
		expect(isLowValueProcurementDocumentLink({
			label: "Terms of Reference for consultancy services",
			url: "https://example.org/tor-consultancy-services.pdf",
		})).toBe(false);
	});
});
