import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const competitiveMock = vi.hoisted(() => ({
	bulkImportCompetitiveIntelligence: vi.fn(),
}));
vi.hoisted(() => {
	delete process.env.COMPETITIVE_INTELLIGENCE_CSV_PATH;
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/actions/competitive", () => competitiveMock);

import {
	GET,
	POST,
} from "@/app/api/import/competitive-intelligence/route";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("competitive intelligence import route", () => {
	it("requires control-plane auth for GET and POST", async () => {
		authMock.mockResolvedValueOnce(null);
		const getResponse = await GET(new NextRequest("https://app.test/api/import/competitive-intelligence"));
		expect(getResponse.status).toBe(401);

		authMock.mockResolvedValueOnce(null);
		const postResponse = await POST(new NextRequest("https://app.test/api/import/competitive-intelligence", {
			method: "POST",
			body: JSON.stringify({ filePath: "/etc/passwd" }),
		}));
		expect(postResponse.status).toBe(401);
		expect(competitiveMock.bulkImportCompetitiveIntelligence).not.toHaveBeenCalled();
	});

	it("does not reveal or accept caller-supplied filesystem paths", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "ops-1", role: "operations" } });
		const getResponse = await GET(new NextRequest("https://app.test/api/import/competitive-intelligence"));
		const getBody = await getResponse.json();

		expect(getResponse.status).toBe(200);
		expect(JSON.stringify(getBody)).not.toContain("/Users/");
		expect(JSON.stringify(getBody)).not.toContain("filePath");

		authMock.mockResolvedValueOnce({ user: { id: "ops-1", role: "operations" } });
		const postResponse = await POST(new NextRequest("https://app.test/api/import/competitive-intelligence", {
			method: "POST",
			body: JSON.stringify({ filePath: "/etc/passwd" }),
		}));

		expect(postResponse.status).toBe(503);
		expect(await postResponse.json()).toEqual({
			error: "Competitive intelligence CSV import source is not configured",
		});
		expect(competitiveMock.bulkImportCompetitiveIntelligence).not.toHaveBeenCalled();
	});
});
