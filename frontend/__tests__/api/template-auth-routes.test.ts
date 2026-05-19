import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const templateActionsMock = vi.hoisted(() => ({
	createDocumentFromTemplate: vi.fn(),
	rateTemplate: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/actions/templates", () => templateActionsMock);

import { POST as createFromTemplate } from "@/app/api/v1/documents/from-template/route";
import { POST as rateTemplateRoute } from "@/app/api/v1/templates/[id]/rate/route";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("session-user-1");
	templateActionsMock.createDocumentFromTemplate.mockResolvedValue({
		documentId: "doc-1",
		title: "Response Draft",
		success: true,
	});
	templateActionsMock.rateTemplate.mockResolvedValue({
		success: true,
		newRating: 4.5,
		newRatingCount: 8,
	});
});

describe("template write API auth", () => {
	it("rejects anonymous document creation before trusting request body identity", async () => {
		getCurrentUserIdMock.mockResolvedValueOnce(null);

		const response = await createFromTemplate(jsonRequest("/api/v1/documents/from-template", {
			templateId: "template-1",
			title: "Response Draft",
			userId: "spoofed-user",
		}));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(templateActionsMock.createDocumentFromTemplate).not.toHaveBeenCalled();
	});

	it("creates documents with the session user instead of a supplied user id", async () => {
		const response = await createFromTemplate(jsonRequest("/api/v1/documents/from-template", {
			templateId: "template-1",
			title: " Response Draft ",
			placeholderValues: { company: "Acme" },
			userId: "spoofed-user",
		}));

		expect(response.status).toBe(200);
		expect(templateActionsMock.createDocumentFromTemplate).toHaveBeenCalledWith(
			{
				templateId: "template-1",
				title: "Response Draft",
				placeholderValues: { company: "Acme" },
				useAIFill: false,
			}
		);
	});

	it("rejects anonymous ratings before trusting request body identity", async () => {
		getCurrentUserIdMock.mockResolvedValueOnce(null);

		const response = await rateTemplateRoute(
			jsonRequest("/api/v1/templates/template-1/rate", {
				rating: 5,
				userId: "spoofed-user",
			}),
			{ params: Promise.resolve({ id: "template-1" }) },
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(templateActionsMock.rateTemplate).not.toHaveBeenCalled();
	});

	it("rates templates with the session user instead of a supplied user id", async () => {
		const response = await rateTemplateRoute(
			jsonRequest("/api/v1/templates/template-1/rate", {
				rating: 4,
				userId: "spoofed-user",
			}),
			{ params: Promise.resolve({ id: "template-1" }) },
		);

		expect(response.status).toBe(200);
		expect(templateActionsMock.rateTemplate).toHaveBeenCalledWith({
			templateId: "template-1",
			rating: 4,
			userId: "session-user-1",
		});
	});
});

function jsonRequest(path: string, body: Record<string, unknown>): NextRequest {
	return new NextRequest(`https://app.test${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}
