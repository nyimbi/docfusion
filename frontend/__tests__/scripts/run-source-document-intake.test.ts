import { describe, expect, it } from "vitest";

import { isLikelySolicitationSource, isRoutineSourceCandidate } from "../../scripts/run-source-document-intake";

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
			documentName: "30000022851_request-for-proposal_0.pdf",
			sourceUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/30000022851_request-for-proposal_0.pdf",
		})).toBe(true);
	});
});
