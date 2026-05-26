import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const getOpportunityDocumentFileForActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/services/rfp-document-service", () => {
	class OpportunityDocumentAccessError extends Error {
		constructor(message: string, public readonly status: number) {
			super(message);
			this.name = "OpportunityDocumentAccessError";
		}
	}
	class OpportunityDocumentIntegrityError extends OpportunityDocumentAccessError {
		constructor(message = "Document hash mismatch") {
			super(message, 409);
			this.name = "OpportunityDocumentIntegrityError";
		}
	}
	return {
		getOpportunityDocumentFileForActor: getOpportunityDocumentFileForActorMock,
		OpportunityDocumentAccessError,
		OpportunityDocumentIntegrityError,
	};
});

import { GET } from "@/app/api/v1/opportunities/[id]/documents/[documentId]/download/route";
import {
	OpportunityDocumentAccessError,
	OpportunityDocumentIntegrityError,
} from "@/lib/services/rfp-document-service";

function request() {
	return new NextRequest("https://app.test/api/v1/opportunities/opp-1/documents/doc-1/download");
}

function params() {
	return {
		params: Promise.resolve({
			id: "opp-1",
			documentId: "doc-1",
		}),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({
		user: {
			id: "user-1",
			role: "writer",
			roles: ["writer"],
		},
	});
});

describe("opportunity document download route", () => {
	it("streams scoped downloaded RFP bytes with attachment headers", async () => {
		getOpportunityDocumentFileForActorMock.mockResolvedValueOnce({
			buffer: Buffer.from("downloaded-pdf"),
			mimeType: "application/pdf",
			filename: "Main RFP.pdf",
		});

		const response = await GET(request(), params());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain("Main%20RFP.pdf");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from("downloaded-pdf"));
		expect(getOpportunityDocumentFileForActorMock).toHaveBeenCalledWith(
			{ userId: "user-1", role: "writer", roles: ["writer"] },
			"opp-1",
			"doc-1"
		);
	});

	it("maps scoped storage integrity failures to conflict responses", async () => {
		getOpportunityDocumentFileForActorMock.mockRejectedValueOnce(
			new OpportunityDocumentIntegrityError()
		);

		const response = await GET(request(), params());

		expect(response.status).toBe(409);
		expect(await response.text()).toBe("Document hash mismatch");
	});

	it("maps scoped authorization failures to their service status", async () => {
		getOpportunityDocumentFileForActorMock.mockRejectedValueOnce(
			new OpportunityDocumentAccessError("Forbidden", 403)
		);

		const response = await GET(request(), params());

		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Forbidden");
	});
});
