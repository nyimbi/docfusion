import { describe, expect, it } from "vitest";

import {
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
});
