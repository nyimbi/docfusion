import { describe, expect, it } from "vitest";

import {
	isDirectDocumentIntakeSource,
	isLikelySolicitationSource,
	isRoutineSourceCandidate,
	isSupportedDocumentSource,
	parseCsvList,
	scoreSourceDocumentIntakeCandidate,
} from "../../scripts/run-source-document-intake";

describe("source document intake selection helpers", () => {
	it("keeps fresh direct documents from normal hosts in routine intake", () => {
		expect(isRoutineSourceCandidate({
			sourceUrl: "https://tenders.go.ke/storage/Documents/rfp.pdf",
			status: "discovered",
			downloadAttempts: 0,
			lastError: null,
		})).toBe(true);
	});

	it("skips newly discovered protected portal rows in routine intake", () => {
		expect(isRoutineSourceCandidate({
			sourceUrl: "https://www.dgmarket.com/tender/108981664",
			status: "discovered",
			downloadAttempts: 0,
			lastError: null,
		})).toBe(false);
	});

	it("skips prior protected 403 rows in routine intake", () => {
		expect(isRoutineSourceCandidate({
			sourceUrl: "https://dgmarket.com/tender/108981691",
			status: "failed",
			downloadAttempts: 1,
			lastError: "HTTP 403: Forbidden",
		})).toBe(false);
	});

	it("skips generic procurement guidance documents while keeping actual solicitations", () => {
		expect(isLikelySolicitationSource({
			documentName: "guide-2_submit-quotations-bids-proposals.pdf",
			sourceUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/guide-2_submit-quotations-bids-proposals.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "bidder-instructions-goods-en.pdf",
			sourceUrl: "https://www.cbd.int/doc/procurement/bidder-instructions-goods-en.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Entities - 2021 Quarter 1.pdf",
			sourceUrl: "https://ocpo.treasury.gov.za/Suppliers_Area/Tender%20-%20Bid%20Opportunities/Entities%20-%202021%20Quarter%201.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "NPM-No.-122-2013.pdf",
			sourceUrl: "https://www.gppb.gov.ph/wp-content/uploads/2023/07/NPM-No.-122-2013.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "P000913_Publication_of_Procurement_Plan.xlsx",
			sourceUrl: "https://www.aiib.org/en/projects/details/2026/_download/Pakistan/P000913_Publication_of_Procurement_Plan.xlsx",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "C5ACorrigendumNo1_20260317.pdf",
			sourceUrl: "https://www.aiib.org/en/projects/details/2026/_download/India/C5ACorrigendumNo1_20260317.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Annexure_C_D_E_Local_Imported_Content_Declaration_Forms.xls",
			sourceUrl: "https://www.etenders.gov.za/home/Download?downloadedFileName=Annexure%20C%2C%20D%20%26%20E_Local%20%26%20Imported%20Content%20Declaration%20Forms.xls",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "30000022851_request-for-proposal_0.pdf",
			sourceUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/30000022851_request-for-proposal_0.pdf",
		})).toBe(true);
	});

	it("prioritizes response-worthy RFP and consulting documents over commodity supply files", () => {
		const rfpScore = scoreSourceDocumentIntakeCandidate({
			documentName: "RFP-Eswatini-Data-Policy.pdf",
			sourceUrl: "https://smartafrica.org/wp-content/uploads/2025/07/RFP-Eswatini-Data-Policy.pdf",
		});
		const consultingScore = scoreSourceDocumentIntakeCandidate({
			documentName: "PRQ20250383-Capacity-Building-for-the-CBT-under-the-Borderlands-project.pdf",
			sourceUrl: "https://trademarkafrica.com/wp-content/uploads/2025/11/PRQ20250383-Capacity-Building-for-the-CBT-under-the-Borderlands-project.pdf",
		});
		const commodityScore = scoreSourceDocumentIntakeCandidate({
			documentName: "supply-and-delivery-of-football-balls-under-framework-agreement.pdf",
			sourceUrl: "https://tenders.go.ke/storage/Documents/supply-and-delivery-of-football-balls-under-framework-agreement.pdf",
		});

		expect(rfpScore).toBeGreaterThan(commodityScore);
		expect(consultingScore).toBeGreaterThan(commodityScore);
	});

	it("parses source-platform filters for targeted intake runs", () => {
		expect(parseCsvList(" ESPPRA Eswatini,UNGM,ESPPRA Eswatini ,, ")).toEqual([
			"ESPPRA Eswatini",
			"UNGM",
		]);
		expect(parseCsvList(undefined)).toEqual([]);
	});

	it("accepts trusted national notice download endpoints without file extensions", () => {
		expect(isSupportedDocumentSource({
			documentName: "downloadNoticeForAdvSearch.do",
			sourceUrl: "https://www.ghaneps.gov.gh/epps/cft/downloadNoticeForAdvSearch.do?resourceId=2942583",
		})).toBe(true);
		expect(isSupportedDocumentSource({
			documentName: "downloadNoticeForAdvSearch.do",
			sourceUrl: "https://eprocure.zppa.org.zm/epps/cft/downloadNoticeForAdvSearch.do?resourceId=26822144",
		})).toBe(true);
		expect(isSupportedDocumentSource({
			documentName: "selectListAdvertisingListForGU.do",
			sourceUrl: "https://www.umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do?menuId=EB01020100",
		})).toBe(false);
	});

	it("accepts Rwanda UMUCYO per-tender detail endpoints without accepting the shared list page", () => {
		expect(isSupportedDocumentSource({
			documentName: "selectAdvertisingDtlInfo.do",
			sourceUrl: "https://www.umucyo.gov.rw/eb/bav/selectAdvertisingDtlInfo.do?tendReferNo=000008%2FC%2FNCB%2F2025%2F2026%2F4900000000&tendStageCd=O&tendTypeCd=C",
		})).toBe(true);
		expect(isSupportedDocumentSource({
			documentName: "Digital records management platform.html",
			sourceUrl: "https://nest.go.tz/gateway/nest-data-portal-api/api/releases/ocds-mv5oob-122383-3-2025-2026-G-32-S003/6eaef89e-e6c9-4b40-8622-f1afc6a61273",
		})).toBe(true);
		expect(isSupportedDocumentSource({
			documentName: "selectListAdvertisingListForGU.do",
			sourceUrl: "https://www.umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do?menuId=EB01020100&recordCountPerPage=50",
		})).toBe(false);
	});

	it("separates direct document intake from generic HTML detail pages", () => {
		expect(isDirectDocumentIntakeSource({
			documentName: "1779370874117-supply-and-delivery-of-ict-equipment-under-framework-agreement.pdf",
			sourceUrl: "https://tenders.go.ke/storage/Documents/1779370874117-supply-and-delivery-of-ict-equipment-under-framework-agreement.pdf",
		})).toBe(true);
		expect(isDirectDocumentIntakeSource({
			documentName: "selectAdvertisingDtlInfo.do",
			sourceUrl: "https://www.umucyo.gov.rw/eb/bav/selectAdvertisingDtlInfo.do?tendReferNo=000008%2FC%2FNCB%2F2025%2F2026%2F4900000000&tendStageCd=O&tendTypeCd=C",
		})).toBe(true);
		expect(isDirectDocumentIntakeSource({
			documentName: "Digital records management platform.html",
			sourceUrl: "https://nest.go.tz/gateway/nest-data-portal-api/api/releases/ocds-mv5oob-122383-3-2025-2026-G-32-S003/6eaef89e-e6c9-4b40-8622-f1afc6a61273",
		})).toBe(true);
		expect(isSupportedDocumentSource({
			documentName: "AMI - Mali - technical assistance.html",
			sourceUrl: "https://www.afdb.org/en/documents/ami-mali-technical-assistance",
		})).toBe(true);
		expect(isDirectDocumentIntakeSource({
			documentName: "AMI - Mali - technical assistance.html",
			sourceUrl: "https://www.afdb.org/en/documents/ami-mali-technical-assistance",
		})).toBe(false);
	});
});
