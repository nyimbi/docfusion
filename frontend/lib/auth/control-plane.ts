import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export interface ControlPlaneActor {
	userId: string;
	role?: string;
	roles: string[];
	isApiKey: boolean;
}

export async function requireControlPlaneAdmin(
	request: NextRequest,
	options: {
		allowedRoles?: string[];
		allowApiKeyEnv?: string;
	} = {}
): Promise<{ actor: ControlPlaneActor } | NextResponse> {
	const allowedRoles = new Set(options.allowedRoles ?? ["admin", "operations"]);
	const apiKeyEnv = options.allowApiKeyEnv;
	if (apiKeyEnv) {
		const configured = process.env[apiKeyEnv]?.trim();
		const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
		if (configured && supplied === configured) {
			return {
				actor: {
					userId: "api-key",
					role: "api_key",
					roles: ["api_key"],
					isApiKey: true,
				},
			};
		}
	}

	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = session.user as {
		id: string;
		role?: string;
		roles?: string[];
	};
	const roles = normalizeRoles(user.role, user.roles);
	if (!roles.some((role) => allowedRoles.has(role))) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	return {
		actor: {
			userId: user.id,
			role: user.role,
			roles,
			isApiKey: false,
		},
	};
}

export function isControlPlaneResponse(value: { actor: ControlPlaneActor } | NextResponse): value is NextResponse {
	return value instanceof NextResponse;
}

function normalizeRoles(role?: string, roles?: string[]): string[] {
	return [...new Set([role, ...(roles ?? [])].filter((value): value is string => Boolean(value)))];
}
