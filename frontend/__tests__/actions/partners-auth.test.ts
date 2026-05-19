import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	partners: {},
	opportunityPartners: {},
	opportunities: {},
	submissions: {},
}));

import {
	assignPartnerToOpportunity,
	createPartner,
	deletePartner,
	getOpportunityPartners,
	getPartner,
	getPartnerOpportunities,
	getPartnerPerformance,
	getPartnerStats,
	getPartners,
	getPartnersByCountry,
	getPartnersByRegion,
	getPartnersGroupedByRegion,
	getTier1Partners,
	getTopPartners,
	getUniqueCapabilities,
	getUniqueCountries,
	getUniqueRegions,
	removePartnerFromOpportunity,
	searchPartnersByCapability,
	updatePartner,
	updatePartnerAssignment,
	updatePartnerRating,
} from "@/lib/actions/partners";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("partner action auth", () => {
	it("rejects unauthenticated partner reads and mutations before database access", async () => {
		await expect(createPartner({ name: "Partner", type: "subcontractor" as never })).rejects.toThrow("Unauthorized");
		await expect(getPartner("partner-1")).rejects.toThrow("Unauthorized");
		await expect(updatePartner("partner-1", { name: "Updated Partner" })).rejects.toThrow("Unauthorized");
		await expect(deletePartner("partner-1")).rejects.toThrow("Unauthorized");
		await expect(getPartners()).rejects.toThrow("Unauthorized");
		await expect(searchPartnersByCapability("cloud")).rejects.toThrow("Unauthorized");

		await expect(assignPartnerToOpportunity({
			opportunityId: "opp-1",
			partnerId: "partner-1",
			role: "Prime",
		})).rejects.toThrow("Unauthorized");
		await expect(updatePartnerAssignment({
			assignmentId: "assignment-1",
			status: "active" as never,
		})).rejects.toThrow("Unauthorized");
		await expect(removePartnerFromOpportunity("assignment-1")).rejects.toThrow("Unauthorized");
		await expect(getOpportunityPartners("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getPartnerOpportunities("partner-1")).rejects.toThrow("Unauthorized");

		await expect(getPartnerPerformance("partner-1")).rejects.toThrow("Unauthorized");
		await expect(updatePartnerRating("partner-1", 3)).rejects.toThrow("Unauthorized");
		await expect(getTopPartners()).rejects.toThrow("Unauthorized");
		await expect(getUniqueCapabilities()).rejects.toThrow("Unauthorized");

		await expect(getPartnersGroupedByRegion()).rejects.toThrow("Unauthorized");
		await expect(getUniqueRegions()).rejects.toThrow("Unauthorized");
		await expect(getUniqueCountries()).rejects.toThrow("Unauthorized");
		await expect(getPartnersByRegion("Africa")).rejects.toThrow("Unauthorized");
		await expect(getPartnersByCountry("Kenya")).rejects.toThrow("Unauthorized");
		await expect(getTier1Partners()).rejects.toThrow("Unauthorized");
		await expect(getPartnerStats()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
