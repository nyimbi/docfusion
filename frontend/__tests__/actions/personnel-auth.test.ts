import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-personnel", () => ({
	personnel: {},
	personnelExperience: {},
	personnelAvailability: {},
	positionRequirements: {},
	skillsTaxonomy: {},
	resumeTemplates: {},
}));
vi.mock("@/lib/ai/client", () => ({
	complete: completeMock,
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import {
	analyzeStaffingGaps,
	assignPersonnelToPosition,
	bulkImportResumes,
	checkAvailability,
	createPersonnel,
	createPosition,
	deletePersonnel,
	deletePosition,
	generateOrgChart,
	generateResume,
	generateStaffingMatrix,
	getExpiringCertifications,
	getPersonnel,
	getPersonnelAvailability,
	getPositionsForOpportunity,
	matchPersonnelToPosition,
	parseResume,
	searchPersonnel,
	searchSkills,
	sendCertificationReminders,
	suggestSkillsForTitle,
	unassignFromPosition,
	updateAvailability,
	updatePersonnel,
	updatePosition,
} from "@/lib/actions/personnel";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("personnel action auth", () => {
	it("rejects unauthenticated personnel and staffing actions before database or AI access", async () => {
		await expect(createPersonnel({ firstName: "Ada", lastName: "Lovelace" })).rejects.toThrow("Unauthorized");
		await expect(updatePersonnel("person-1", { currentTitle: "Engineer" })).rejects.toThrow("Unauthorized");
		await expect(deletePersonnel("person-1")).rejects.toThrow("Unauthorized");
		await expect(getPersonnel("person-1")).rejects.toThrow("Unauthorized");
		await expect(searchPersonnel("ada")).rejects.toThrow("Unauthorized");

		await expect(parseResume("Ada Lovelace\nada@example.com", "ada.txt")).rejects.toThrow("Unauthorized");
		await expect(bulkImportResumes([{ content: "Ada", fileName: "ada.txt" }])).rejects.toThrow("Unauthorized");
		await expect(generateResume("person-1", "brief")).rejects.toThrow("Unauthorized");

		await expect(matchPersonnelToPosition("position-1")).rejects.toThrow("Unauthorized");
		await expect(analyzeStaffingGaps("opp-1")).rejects.toThrow("Unauthorized");
		await expect(assignPersonnelToPosition("person-1", "position-1")).rejects.toThrow("Unauthorized");
		await expect(unassignFromPosition("position-1")).rejects.toThrow("Unauthorized");

		await expect(getPersonnelAvailability("person-1")).rejects.toThrow("Unauthorized");
		await expect(checkAvailability(["person-1"], {
			start: new Date("2026-01-01T00:00:00.000Z"),
			end: new Date("2026-01-02T00:00:00.000Z"),
		})).rejects.toThrow("Unauthorized");
		await expect(updateAvailability("person-1", {
			startDate: "2026-01-01",
			endDate: "2026-01-02",
			commitment: 50,
			status: "committed",
		})).rejects.toThrow("Unauthorized");

		await expect(getExpiringCertifications()).rejects.toThrow("Unauthorized");
		await expect(sendCertificationReminders(["person-1"])).rejects.toThrow("Unauthorized");
		await expect(generateOrgChart("opp-1")).rejects.toThrow("Unauthorized");
		await expect(generateStaffingMatrix("opp-1")).rejects.toThrow("Unauthorized");
		await expect(searchSkills("cloud")).rejects.toThrow("Unauthorized");
		await expect(suggestSkillsForTitle("software engineer")).rejects.toThrow("Unauthorized");
		await expect(createPosition({
			opportunityId: "opp-1",
			positionTitle: "Engineer",
			headcount: 1,
			hoursPerWeek: 40,
			remoteAllowed: true,
		})).rejects.toThrow("Unauthorized");
		await expect(getPositionsForOpportunity("opp-1")).rejects.toThrow("Unauthorized");
		await expect(updatePosition("position-1", { positionTitle: "Lead Engineer" })).rejects.toThrow("Unauthorized");
		await expect(deletePosition("position-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
		expect(completeMock).not.toHaveBeenCalled();
	});

	it("falls back to deterministic resume extraction when AI returns unusable parsed JSON", async () => {
		getCurrentUserIdMock.mockResolvedValueOnce("staff-user-1");
		completeMock.mockResolvedValueOnce({ content: "{}" });

		const result = await parseResume(
			"Ada Lovelace\nSenior Engineer\nada@example.com",
			"ada.txt"
		);

		expect(result).toMatchObject({
			success: true,
			data: {
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@example.com",
				currentTitle: "Senior Engineer",
				education: [],
				experience: [],
				skills: [],
				certifications: [],
			},
		});
		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
