import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: vi.fn(),
}));

import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { requireTenantContext } from "@/lib/auth/tenant-context";

describe("requireRouteTenantContext", () => {
	beforeEach(() => vi.resetAllMocks());

	it("returns context when present", async () => {
		(requireTenantContext as ReturnType<typeof vi.fn>).mockResolvedValue({
			userId: "u",
			organizationId: "o",
		});
		const result = await requireRouteTenantContext();
		expect(isTenantResponse(result)).toBe(false);
		expect(result).toEqual({ userId: "u", organizationId: "o" });
	});

	it("returns 401 NextResponse on Unauthorized", async () => {
		(requireTenantContext as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Unauthorized"),
		);
		const result = await requireRouteTenantContext();
		expect(isTenantResponse(result)).toBe(true);
		expect((result as NextResponse).status).toBe(401);
	});

	it("returns 403 NextResponse on missing org context", async () => {
		(requireTenantContext as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("No organization context"),
		);
		const result = await requireRouteTenantContext();
		expect(isTenantResponse(result)).toBe(true);
		expect((result as NextResponse).status).toBe(403);
	});
});
