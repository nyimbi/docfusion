import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

var authMock: ReturnType<typeof vi.fn>;

const dbMock = vi.hoisted(() => ({
	query: {
		companySettings: {
			findFirst: vi.fn(),
		},
	},
	select: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: authMock = vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
	getAIClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/db/schema", () => ({
	companySettings: {},
}));

vi.mock("@/lib/db/schema-company", () => ({
	companyProfiles: { organizationId: "company_profiles.organization_id" },
	products: { organizationId: "products.organization_id" },
	services: { organizationId: "services.organization_id" },
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ left, right })),
}));

import { POST as extractPost } from "@/app/api/v1/research/extract/route";
import { POST as searchPost, PUT as searchPut } from "@/app/api/v1/research/search/route";

function jsonRequest(path: string, body: Record<string, unknown>): NextRequest {
	return new NextRequest(`https://app.test${path}`, {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

describe("research URL validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authMock.mockResolvedValue({ user: { id: "user-1", organizationId: "org-1" } });
		vi.stubGlobal("fetch", vi.fn());
	});

	it("rejects direct research scrape requests for private URLs", async () => {
		const response = await searchPut(jsonRequest("/api/v1/research/search", {
			url: "http://127.0.0.1:8080/admin",
		}));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: expect.stringContaining("non-public"),
		});
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("rejects research search URL inputs before forwarding them to Firecrawl", async () => {
		const response = await searchPost(jsonRequest("/api/v1/research/search", {
			category: "company_info",
			query: "",
			url: "http://169.254.169.254/latest/meta-data",
		}));

		expect(response.status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("rejects extract website inputs before scraping or database enrichment", async () => {
		const response = await extractPost(jsonRequest("/api/v1/research/extract", {
			accountName: "Internal Host",
			website: "http://localhost/admin",
		}));

		expect(response.status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("does not require organization context before request validation", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "user-1" } });

		const response = await extractPost(jsonRequest("/api/v1/research/extract", {
			accountName: "",
		}));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			error: "Account name is required",
		});
		expect(dbMock.select).not.toHaveBeenCalled();
	});
});
