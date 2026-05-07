import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const importActionsMock = vi.hoisted(() => ({
	executeImport: vi.fn(),
	generatePreview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/actions/import", () => importActionsMock);

import { POST } from "@/app/api/v1/import/execute/route";

const validBody = {
	parsedData: {
		sampleRows: [{ name: "Acme", country: "Kenya" }],
		totalRows: 1,
		metadata: {
			filename: "accounts.csv",
			fileType: "csv",
			fileSize: 128,
		},
	},
	targetTable: "accounts",
	mappings: [
		{
			targetColumn: "name",
			sourceColumns: ["name"],
			required: true,
		},
	],
	options: {
		duplicateHandling: "skip",
		batchSize: 100,
	},
};

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({
		user: {
			id: "import-user-1",
			organizationId: "org-1",
		},
	});
	importActionsMock.generatePreview.mockResolvedValue({
		rows: [],
		validation: { isValid: true, issues: [] },
		totalRows: 1,
	});
	importActionsMock.executeImport.mockResolvedValue({
		importId: "import-1",
		success: true,
		totalRows: 1,
		importedRows: 1,
		updatedRows: 0,
		skippedRows: 0,
		failedRows: 0,
		importedIds: ["account-1"],
		errors: [],
		durationMs: 10,
	});
});

describe("import execute route sandbox behavior", () => {
	it("requires authentication before executing or previewing imports", async () => {
		authMock.mockResolvedValueOnce(null);

		const response = await POST(importRequest(validBody));

		expect(response.status).toBe(401);
		expect(importActionsMock.executeImport).not.toHaveBeenCalled();
		expect(importActionsMock.generatePreview).not.toHaveBeenCalled();
	});

	it("suppresses mutations and returns preview evidence in preview sandbox mode", async () => {
		const response = await POST(importRequest({
			...validBody,
			sandboxMode: "preview",
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			result: {
				importId: null,
				importedRows: 0,
				skippedRows: 1,
			},
			sandbox: {
				requestedMode: "preview",
				mutationAllowed: false,
				mutationSuppressed: true,
				cleanupRequired: false,
			},
		});
		expect(importActionsMock.generatePreview).toHaveBeenCalledWith(
			{
				headers: ["name", "country"],
				sampleRows: validBody.parsedData.sampleRows,
				totalRows: 1,
			},
			"accounts",
			validBody.mappings,
			1
		);
		expect(importActionsMock.executeImport).not.toHaveBeenCalled();
	});

	it("executes imports normally when no sandbox preview override is requested", async () => {
		const response = await POST(importRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			result: {
				importId: "import-1",
				importedRows: 1,
			},
			sandbox: {
				requestedMode: "live",
				mutationAllowed: true,
				mutationSuppressed: false,
			},
		});
		expect(importActionsMock.executeImport).toHaveBeenCalledWith(
			validBody.parsedData,
			"accounts",
			validBody.mappings,
			validBody.options,
			{
				userId: "import-user-1",
				organizationId: "org-1",
			}
		);
		expect(importActionsMock.generatePreview).not.toHaveBeenCalled();
	});
});

function importRequest(body: Record<string, unknown>) {
	return new NextRequest("https://app.test/api/v1/import/execute", {
		method: "POST",
		body: JSON.stringify(body),
		headers: {
			"content-type": "application/json",
		},
	});
}
