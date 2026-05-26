import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const rollbackImportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => {
	const normalizeRoles = (context: { role?: string; roles?: string[] }) =>
		new Set([context.role, ...(context.roles ?? [])]
			.filter(Boolean)
			.map((value) => String(value).trim().toLowerCase()));
	return {
		requireUserContext: requireUserContextMock,
		assertUserHasAuthorityRole: (
			context: { role?: string; roles?: string[] },
			requiredRole: string | null | undefined,
			message: string
		) => {
			const required = requiredRole?.trim().toLowerCase();
			if (!required) throw new Error(message);
			const roles = normalizeRoles(context);
			if (!roles.has("admin") && !roles.has(required)) {
				throw new Error(`${message}: requires ${required}`);
			}
			return required;
		},
	};
});
vi.mock("@/lib/actions/import", () => ({
	rollbackImport: rollbackImportMock,
}));

import { POST } from "@/app/api/v1/import/[importId]/rollback/route";

const importId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "import-owner-1",
		organizationId: "org-1",
		roles: ["import_approver"],
	});
	rollbackImportMock.mockResolvedValue({ success: true, deletedCount: 2 });
});

describe("import rollback route", () => {
	it("requires import approval authority before rollback", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "import-owner-1",
			organizationId: "org-1",
			roles: ["data_import_operator"],
		});

		const response = await POST(
			new NextRequest(`https://app.test/api/v1/import/${importId}/rollback`, { method: "POST" }),
			{ params: Promise.resolve({ importId }) }
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ success: false, error: "Forbidden" });
		expect(rollbackImportMock).not.toHaveBeenCalled();
	});

	it("rolls back when the import owner has approval authority", async () => {
		const response = await POST(
			new NextRequest(`https://app.test/api/v1/import/${importId}/rollback`, { method: "POST" }),
			{ params: Promise.resolve({ importId }) }
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			deletedCount: 2,
		});
		expect(rollbackImportMock).toHaveBeenCalledWith(importId, expect.objectContaining({
			userId: "import-owner-1",
			organizationId: "org-1",
		}));
	});
});
