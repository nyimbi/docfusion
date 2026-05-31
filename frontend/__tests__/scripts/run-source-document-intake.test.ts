import { describe, expect, it } from "vitest";

import {
	isDirectDocumentIntakeSource,
	isLikelySolicitationSource,
	isRoutineSourceCandidate,
	parseSourceDocumentHostLimit,
	parseSourceDocumentIntakeLimit,
	isSupportedDocumentSource,
	parseCsvList,
	scoreSourceDocumentIntakeCandidate,
	summarizeResults,
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
			documentName: "APPROVED-2026-PP-WORKS-VF.pdf",
			sourceUrl: "https://www.ecowas.int/wp-content/uploads/2026/02/APPROVED-2026-PP-WORKS-VF.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Parliament-PP2026-Goods-and-Services-English.pdf",
			sourceUrl: "https://www.ecowas.int/wp-content/uploads/2026/02/Parliament-PP2026-Goods-and-Services-English.pdf",
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
			documentName: "MODELES-DAVIS-DATTRIBUTION-PROVISOIRE-ET-DEFINITIVE.docx",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2024/07/MODELES-DAVIS-DATTRIBUTION-PROVISOIRE-ET-DEFINITIVE.docx",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "avis-dattribution-definitive-du-marche.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2026/05/avis-dattribution-definitive-du-marche.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Avis-dannulation-de-la-DP.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2024/09/Avis-dannulation-de-la-DP.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Resultat-Evaluation_DAO.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2024/10/Resultat-Evaluation_DAO.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "PV-PUBLICATION-DES-RESULTATS-DEVALUATION-DES-OFFRES-BON_0001.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2024/11/PV-PUBLICATION-DES-RESULTATS-DEVALUATION-DES-OFFRES-BON_0001.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "PV-de-resultat_Adduction-deau-Cinkasse.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2024/11/PV-de-resultat_Adduction-deau-Cinkasse.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "PV-DOUVERTURE-DES-OFFRES.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2025/02/PV-DOUVERTURE-DES-OFFRES.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "RESULTATS-BALAYAGE-CGOLFE1_2025.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2025/02/RESULTATS-BALAYAGE-CGOLFE1_2025.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "gbg_master.pdf",
			sourceUrl: "https://www.ungm.org/Areas/Public/Downloads/gbg_master.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "pm.pdf",
			sourceUrl: "https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/files/attachment/page/pdf/pm.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Job-Application-Form-ECOWAS.docx",
			sourceUrl: "https://ecreee.org/wp-content/uploads/2026/05/Job-Application-Form-ECOWAS.docx",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Job-Profile-Driver-ECOWAS-Cabo-Verde.pdf",
			sourceUrl: "https://ecreee.org/wp-content/uploads/2026/05/Job-Profile-Driver-ECOWAS-Cabo-Verde.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "FRENCH-GGSP-CALAO-Job-Description-Programme-Manager-Standards-SPS-and-NTBs.pdf",
			sourceUrl: "https://trademarkafrica.com/wp-content/uploads/2026/03/FRENCH-GGSP-CALAO-Job-Description-Programme-Manager-Standards-SPS-and-NTBs.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Profil-du-poste-de-chauffeur-CEDEAO-Cabo-Verde.pdf",
			sourceUrl: "https://ecreee.org/wp-content/uploads/2026/05/Profil-du-poste-de-chauffeur-CEDEAO-Cabo-Verde.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "Perfil-do-cargo-de-Motorista-CEDEAO-Cabo-Verde.pdf",
			sourceUrl: "https://ecreee.org/wp-content/uploads/2026/02/Perfil-do-cargo-de-Motorista-CEDEAO-Cabo-Verde.pdf",
		})).toBe(false);
		expect(isLikelySolicitationSource({
			documentName: "30000022851_request-for-proposal_0.pdf",
			sourceUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/30000022851_request-for-proposal_0.pdf",
		})).toBe(true);
		expect(isLikelySolicitationSource({
			documentName: "ToR-Recruitment-Data-Management-Specialist-ReCCAWA.pdf",
			sourceUrl: "https://ecreee.org/wp-content/uploads/2026/05/ToR-Recruitment-Data-Management-Specialist-ReCCAWA.pdf",
		})).toBe(true);
		expect(isLikelySolicitationSource({
			documentName: "DAO-FORAGES-2.pdf",
			sourceUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2024/11/DAO-FORAGES-2.pdf",
		})).toBe(true);
		expect(isLikelySolicitationSource({
			documentName: "INVITATION-TO-BID-NIGERIA-ROGEAP-PILOT-PROJECT.pdf",
			sourceUrl: "https://www.ecowas.int/wp-content/uploads/2026/05/INVITATION-TO-BID-NIGERIA-ROGEAP-PILOT-PROJECT.pdf",
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

	it("allows larger live intake batches while keeping a bounded ceiling", () => {
		expect(parseSourceDocumentIntakeLimit("50")).toBe(50);
		expect(parseSourceDocumentIntakeLimit("250")).toBe(100);
		expect(parseSourceDocumentIntakeLimit("0")).toBe(1);
		expect(parseSourceDocumentIntakeLimit(undefined)).toBe(5);
	});

	it("allows explicit high per-host caps for proven single-host drains", () => {
		expect(parseSourceDocumentHostLimit("50", 2)).toBe(50);
		expect(parseSourceDocumentHostLimit("250", 2)).toBe(100);
		expect(parseSourceDocumentHostLimit("0", 2)).toBe(1);
		expect(parseSourceDocumentHostLimit(undefined, 2)).toBe(2);
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

	it("accepts UNDP negotiation detail pages as local HTML source documents", () => {
		const source = {
			documentName: "view_negotiation.cfm",
			sourceUrl: "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45765",
		};
		expect(isSupportedDocumentSource(source)).toBe(true);
		expect(isDirectDocumentIntakeSource(source)).toBe(true);
	});

	it("accepts UNDP public notice pages as local HTML source documents", () => {
		const source = {
			documentName: "view_notice.cfm",
			sourceUrl: "https://procurement-notices.undp.org/view_notice.cfm?notice_id=98842",
		};
		expect(isSupportedDocumentSource(source)).toBe(true);
		expect(isDirectDocumentIntakeSource(source)).toBe(true);
	});

	it("accepts IDB direct document endpoints without file extensions", () => {
		const source = {
			documentName: "getdocument.aspx",
			sourceUrl: "https://idbdocs.iadb.org/wsdocs/getdocument.aspx?docnum=EZIDB0000647-1931927994-2389",
		};
		expect(isSupportedDocumentSource(source)).toBe(true);
		expect(isDirectDocumentIntakeSource(source)).toBe(true);
	});

	it("accepts UNDP SharePoint package folders for notice-detail recovery", () => {
		const source = {
			documentName: "AllItems.aspx",
			sourceUrl: "https://undp.sharepoint.com/sites/Docs-Public/Procurement/Forms/AllItems.aspx?env=Embedded&FilterField1=NegotiationNumber&FilterValue1=UNDP-IND-00772%2C1",
		};
		expect(isSupportedDocumentSource(source)).toBe(true);
		expect(isDirectDocumentIntakeSource(source)).toBe(false);
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

	it("summarizes duplicate and not-queued parse outcomes explicitly", () => {
		const summary = summarizeResults({
			selected: [{ id: "doc-1" }, { id: "doc-2" }, { id: "doc-3" }],
			results: [
				{ disposition: "downloaded", success: true, parsingStatus: "duplicate" },
				{ disposition: "downloaded", success: true, parsingStatus: "not_queued" },
				{ disposition: "downloaded", success: true, parseWait: { status: "completed", requirementsExtracted: 0, timedOut: false } },
			],
		} as never);

		expect(summary).toMatchObject({
			selected: 3,
			downloaded: 3,
			parseCompleted: 1,
			parseZeroRequirements: 1,
			parseDuplicate: 1,
			parseNotQueued: 1,
			parseFailed: 0,
		});
	});
});
