/**
 * Import Templates API Route
 *
 * GET /api/v1/import/templates - List templates
 * POST /api/v1/import/templates - Create a template
 */

import { NextRequest, NextResponse } from "next/server";
import {
	isTenantResponse,
	requireRouteTenantContext,
	type RouteTenantResult,
} from "@/lib/auth/route-tenant";
import { db } from "@/lib/db";
import { importMappingTemplates } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { ImportTargetTable, ColumnMapping } from "@/lib/types/import";
import type { ColumnMappingConfig } from "@/lib/db/schema-import";

/**
 * Get authenticated user context.
 */
async function getUserContext(): Promise<RouteTenantResult> {
	return requireRouteTenantContext();
}

/**
 * GET /api/v1/import/templates
 * List available templates, optionally filtered by target table.
 */
export async function GET(request: NextRequest) {
	// Authenticate
	const userContext = await getUserContext();
	if (isTenantResponse(userContext)) {
		return userContext;
	}

	try {
		const { searchParams } = new URL(request.url);
		const targetTable = searchParams.get("targetTable") as ImportTargetTable | null;

		const whereClause = eq(importMappingTemplates.organizationId, userContext.organizationId);

		const query = db
			.select({
				id: importMappingTemplates.id,
				name: importMappingTemplates.name,
				description: importMappingTemplates.description,
				targetTable: importMappingTemplates.targetTable,
				useCount: importMappingTemplates.useCount,
				lastUsedAt: importMappingTemplates.lastUsedAt,
				createdAt: importMappingTemplates.createdAt,
			})
			.from(importMappingTemplates)
			.where(whereClause)
			.orderBy(sql`${importMappingTemplates.useCount} DESC`);

		const records = await query;

		// Filter by target table if specified
		const filtered = targetTable
			? records.filter((r) => r.targetTable === targetTable)
			: records;

		const templates = filtered.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description || undefined,
			targetTable: r.targetTable as ImportTargetTable,
			useCount: r.useCount || 0,
			lastUsedAt: r.lastUsedAt?.toISOString(),
			createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
		}));

		return NextResponse.json({
			success: true,
			templates,
		});
	} catch (error) {
		console.error("List templates error:", error);
		const message = error instanceof Error ? error.message : "Failed to list templates";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/v1/import/templates
 * Create a new template.
 */
export async function POST(request: NextRequest) {
	// Authenticate
	const userContext = await getUserContext();
	if (isTenantResponse(userContext)) {
		return userContext;
	}

	try {
		const body = await request.json();
		const { name, description, targetTable, mappings } = body as {
			name: string;
			description?: string;
			targetTable: ImportTargetTable;
			mappings: ColumnMapping[];
		};

		// Validate required fields
		if (!name || !targetTable || !mappings) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields: name, targetTable, mappings" },
				{ status: 400 }
			);
		}

		if (!Array.isArray(mappings) || mappings.length === 0) {
			return NextResponse.json(
				{ success: false, error: "At least one mapping is required" },
				{ status: 400 }
			);
		}

		// Convert mappings to storage format
		const mappingsForStorage: ColumnMappingConfig[] = mappings.map((m) => ({
			targetColumn: m.targetColumn,
			sourceColumns: m.sourceColumns,
			separator: m.separator,
			transform: m.transform,
			defaultValue: m.defaultValue,
			required: m.required,
		}));

		// Create template
		const [template] = await db
			.insert(importMappingTemplates)
			.values({
				organizationId: userContext.organizationId,
				name,
				description,
				targetTable,
				mappings: mappingsForStorage,
				createdBy: userContext.userId,
			})
			.returning({ id: importMappingTemplates.id });

		return NextResponse.json({
			success: true,
			templateId: template.id,
		});
	} catch (error) {
		console.error("Create template error:", error);
		const message = error instanceof Error ? error.message : "Failed to create template";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
