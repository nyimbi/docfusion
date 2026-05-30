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
			label: "Annual Report",
			url: "https://example.org/reports/annual-report-2025.pdf",
		})).toBe(true);
		expect(isLowValueProcurementDocumentLink({
			label: "Supplier Code of Conduct",
			url: "https://example.org/supplier-code-of-conduct.pdf",
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
