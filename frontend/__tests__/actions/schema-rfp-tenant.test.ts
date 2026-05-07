import { describe, it, expect } from "vitest";
import {
	rfpDocuments,
	rfpRequirements,
	rfpParsingJobs,
	complianceMatrices,
	complianceEntries,
} from "@/lib/db/schema-rfp";

/**
 * RFP tenant isolation schema test.
 *
 * Asserts that every RFP-domain table carries a NOT NULL `organizationId`
 * column, the foundation for tenant-scoped queries in W1. This test fails
 * until W0 Task 3 ships the schema change.
 */

describe("RFP tenant isolation schema", () => {
	const tablesUnderTest = [
		{ name: "rfpDocuments", table: rfpDocuments },
		{ name: "rfpRequirements", table: rfpRequirements },
		{ name: "rfpParsingJobs", table: rfpParsingJobs },
		{ name: "complianceMatrices", table: complianceMatrices },
		{ name: "complianceEntries", table: complianceEntries },
	] as const;

	for (const { name, table } of tablesUnderTest) {
		it(`${name} carries a NOT NULL organizationId column`, () => {
			const col = (table as unknown as Record<string, unknown>).organizationId;
			expect(col, `${name}.organizationId must exist`).toBeDefined();
			const meta = col as { notNull?: boolean };
			expect(meta.notNull, `${name}.organizationId must be NOT NULL`).toBe(true);
		});
	}
});
