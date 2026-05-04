import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

type RouteSessionResult = { session: Session } | NextResponse;

export async function requireRouteSessionOr401(): Promise<RouteSessionResult> {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	return { session };
}

export function isRouteSessionResponse(
	value: RouteSessionResult
): value is NextResponse {
	return value instanceof NextResponse;
}
