import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: vi.fn(),
}));

import { requireTenantContext } from "@/lib/auth/tenant-context";
import { getServerSession } from "@/lib/auth-utils";

describe("requireTenantContext", () => {
	beforeEach(() => vi.resetAllMocks());

	it("returns userId and organizationId when both are present", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			user: { id: "user-123", organizationId: "org-abc" },
		});
		await expect(requireTenantContext()).resolves.toEqual({
			userId: "user-123",
			organizationId: "org-abc",
		});
	});

	it("throws Unauthorized when session is missing", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		await expect(requireTenantContext()).rejects.toThrow("Unauthorized");
	});

	it("throws Unauthorized when userId is missing", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			user: { organizationId: "org-abc" },
		});
		await expect(requireTenantContext()).rejects.toThrow("Unauthorized");
	});

	it("throws No organization context when org is missing", async () => {
		(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			user: { id: "user-123" },
		});
		await expect(requireTenantContext()).rejects.toThrow("No organization context");
	});
});
