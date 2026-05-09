import { NextResponse } from "next/server";
import {
	requireTenantContext,
	type TenantContext,
} from "@/lib/auth/tenant-context";

export type RouteTenantResult = TenantContext | NextResponse;

/**
 * Resolve tenant context for a route handler.
 *
 * Returns either a `TenantContext` or a NextResponse. Use `isTenantResponse()`
 * to discriminate — the Next.js convention for early-return guards.
 *
 * - 401 when no session / no user id (`Unauthorized`).
 * - 403 when session exists but `organizationId` is missing (`No organization context`).
 */
export async function requireRouteTenantContext(): Promise<RouteTenantResult> {
	try {
		return await requireTenantContext();
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unauthorized";
		if (message === "No organization context") {
			return NextResponse.json({ error: message }, { status: 403 });
		}
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
}

export function isTenantResponse(value: RouteTenantResult): value is NextResponse {
	return value instanceof NextResponse;
}
