/**
 * POST /api/opportunities/discovery/presets/run
 *
 * Scheduled entrypoint for reusable live discovery presets. This route is meant
 * for cron/API-key execution and runs presets owned by DISCOVERY_IMPORT_USER_ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { executeOpportunityDiscoveryImport } from "@/lib/services/opportunity-discovery-import";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";
import { withDefaultDiscoveryRuntimeOptions } from "@/lib/services/default-discovery-sources";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DiscoveryImportInput, DiscoveryImportResult } from "@/lib/services/opportunity-discovery-import";

const DISCOVERY_PRESET_KIND = "opportunity_discovery_preset";
const MAX_PRESETS_PER_RUN = 25;

type DiscoveryPresetRunBody = {
	presetIds?: string[];
	dryRun?: boolean;
	limit?: number;
};

type DiscoveryPresetPayload = {
	kind?: string;
	input?: DiscoveryImportInput;
};

type DiscoveryPresetRow = typeof savedSearches.$inferSelect;

type DiscoveryPresetRunResult = {
	presetId: string;
	name: string;
	success: boolean;
	importId?: string;
	results?: DiscoveryImportResult["results"];
	errors?: DiscoveryImportResult["errors"];
	message?: string;
};

function optionalStringArray(value: unknown, field: string): string[] | undefined {
	if (value === undefined) return undefined;
	if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
		return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
	}
	throw new Error(`${field} must be an array of strings`);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	throw new Error(`${field} must be a boolean`);
}

function optionalNumber(value: unknown, field: string): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	throw new Error(`${field} must be a finite number`);
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
	const raw = await request.text();
	if (!raw.trim()) return {};

	const parsed = JSON.parse(raw);
	if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
		return parsed as Record<string, unknown>;
	}
	throw new Error("request body must be a JSON object");
}

function parseRunBody(body: Record<string, unknown>): DiscoveryPresetRunBody {
	const limit = optionalNumber(body.limit, "limit");
	return {
		presetIds: optionalStringArray(body.presetIds, "presetIds"),
		dryRun: optionalBoolean(body.dryRun, "dryRun") ?? false,
		limit: limit === undefined ? undefined : Math.min(MAX_PRESETS_PER_RUN, Math.max(1, Math.trunc(limit))),
	};
}

function presetInputFromRow(row: DiscoveryPresetRow): DiscoveryImportInput {
	const payload = row.filters as DiscoveryPresetPayload;
	if (payload.kind !== DISCOVERY_PRESET_KIND || !payload.input) {
		throw new Error(`Saved search is not a discovery preset: ${row.id}`);
	}
	return withDefaultDiscoveryRuntimeOptions(payload.input);
}

async function loadPresetRows(
	userId: string,
	presetIds: string[] | undefined,
	limit: number
): Promise<DiscoveryPresetRow[]> {
	const conditions = [
		eq(savedSearches.userId, userId),
		sql`${savedSearches.filters}->>'kind' = ${DISCOVERY_PRESET_KIND}`,
	];
	if (presetIds?.length) {
		conditions.push(inArray(savedSearches.id, presetIds));
	}

	return db
		.select()
		.from(savedSearches)
		.where(and(...conditions))
		.orderBy(desc(savedSearches.updatedAt))
		.limit(limit);
}

export async function POST(request: NextRequest) {
	try {
		const unauthorized = await requireScraperAccess(request, { allowApiKey: true });
		if (unauthorized) return unauthorized;

		const serviceUserId = process.env.DISCOVERY_IMPORT_USER_ID?.trim();
		const serviceOrganizationId = process.env.DISCOVERY_IMPORT_ORGANIZATION_ID?.trim();
		if (!serviceUserId) {
			return NextResponse.json(
				{
					success: false,
					message: "DISCOVERY_IMPORT_USER_ID is required for scheduled discovery preset runs",
				},
				{ status: 503 }
			);
		}
		if (!serviceOrganizationId) {
			return NextResponse.json(
				{
					success: false,
					message: "DISCOVERY_IMPORT_ORGANIZATION_ID is required for scheduled discovery preset runs",
				},
				{ status: 503 }
			);
		}

		let runBody: DiscoveryPresetRunBody;
		try {
			runBody = parseRunBody(await readJsonBody(request));
		} catch (error) {
			return NextResponse.json(
				{
					success: false,
					message: error instanceof Error ? error.message : "Invalid discovery preset run request",
				},
				{ status: 400 }
			);
		}

		const rows = await loadPresetRows(
			serviceUserId,
			runBody.presetIds,
			runBody.limit ?? MAX_PRESETS_PER_RUN
		);

		if (runBody.dryRun) {
			return NextResponse.json({
				success: true,
				dryRun: true,
				assigneeUserId: serviceUserId,
				presets: rows.map((row) => ({
					presetId: row.id,
					name: row.name,
					input: presetInputFromRow(row),
				})),
			});
		}

		const presetResults: DiscoveryPresetRunResult[] = [];
		for (const row of rows) {
			try {
				const result = await executeOpportunityDiscoveryImport(
					presetInputFromRow(row),
					serviceUserId,
					serviceOrganizationId
				);
				presetResults.push({
					presetId: row.id,
					name: row.name,
					success: true,
					importId: result.importId,
					results: result.results,
					errors: result.errors,
				});
			} catch (error) {
				presetResults.push({
					presetId: row.id,
					name: row.name,
					success: false,
					message: error instanceof Error ? error.message : "Discovery preset run failed",
				});
			}
		}

		const failed = presetResults.filter((result) => !result.success).length;
		return NextResponse.json({
			success: failed === 0,
			message: failed === 0
				? `Ran ${presetResults.length} discovery presets`
				: `Ran ${presetResults.length} discovery presets with ${failed} failures`,
			assigneeUserId: serviceUserId,
			totalPresets: presetResults.length,
			failedPresets: failed,
			presets: presetResults,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Scheduled discovery preset run failed";
		return NextResponse.json(
			{ success: false, message },
			{ status: message === "Unauthorized" ? 401 : 500 }
		);
	}
}
