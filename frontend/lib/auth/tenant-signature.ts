import { createHmac } from "crypto";

export const TENANT_HEADER_SECRET_ENV = "DOCFUSION_TENANT_HEADER_SECRET";

interface TenantHeaderInput {
	readonly method: string;
	readonly path: string;
	readonly userId: string;
	readonly organizationId: string;
	readonly timestamp?: number;
}

function getTenantHeaderSecret(): string {
	const secret = process.env[TENANT_HEADER_SECRET_ENV];
	if (!secret) {
		throw new Error(`${TENANT_HEADER_SECRET_ENV} is required`);
	}
	return secret;
}

function signTenantContext({
	method,
	path,
	userId,
	organizationId,
	timestamp,
}: Required<TenantHeaderInput>): string {
	const payload = [
		"v1",
		method.toUpperCase(),
		path,
		userId,
		organizationId,
		String(timestamp),
	].join("\n");
	return createHmac("sha256", getTenantHeaderSecret())
		.update(payload)
		.digest("hex");
}

export function buildSignedTenantHeaders(input: TenantHeaderInput): Record<string, string> {
	const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
	return {
		"x-docfusion-user-id": input.userId,
		"x-docfusion-organization-id": input.organizationId,
		"x-docfusion-tenant-timestamp": String(timestamp),
		"x-docfusion-tenant-signature": signTenantContext({
			...input,
			timestamp,
		}),
	};
}
