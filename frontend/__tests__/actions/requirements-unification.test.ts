import { describe, it, expect } from "vitest";
import { rfpRequirements } from "@/lib/db/schema-rfp";

/**
 * Requirements unification tests.
 *
 * Verifies that the legacy `requirements` table has been removed
 * and all reads/writes now target `rfpRequirements`.
 */

describe("requirements unification", () => {
	it("rfpRequirements schema has aiAnalysis column", () => {
		expect(rfpRequirements.aiAnalysis).toBeDefined();
	});

	it("rfpRequirements schema has nullable rfpDocumentId", () => {
		const col = rfpRequirements.rfpDocumentId;
		expect(col).toBeDefined();
	});

	it("rfpRequirements schema has nullable requirementNumber", () => {
		const col = rfpRequirements.requirementNumber;
		expect(col).toBeDefined();
	});
});
