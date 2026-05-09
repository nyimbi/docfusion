/**
 * Compliance Matrix API Route
 *
 * Returns a compliance matrix with all entries for display and management,
 * scoped to the caller's organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { db } from "@/lib/db";
import {
	complianceMatrices,
	complianceEntries,
	rfpRequirements,
	MATRIX_STATUSES,
} from "@/lib/db/schema-rfp";
import { and, eq, asc } from "drizzle-orm";

interface ComplianceEntryResponse {
	id: string;
	requirementId: string;
	requirementNumber: string;
	requirementTitle: string | null;
	requirementText: string;
	category: string;
	priority: string;
	sourceSection: string | null;
	complianceStatus: string;
	complianceJustification: string | null;
	responseReference: string | null;
	responseSummary: string | null;
	strengthAssessment: string | null;
	riskLevel: string | null;
	mitigationStrategy: string | null;
	assignedTo: string | null;
	dueDate: string | null;
	completionPercent: number;
	status: string;
}

interface ComplianceMatrixResponse {
	id: string;
	name: string;
	description: string | null;
	version: number;
	status: string;
	opportunityId: string;
	rfpDocumentId: string | null;
	totalRequirements: number;
	mandatoryCount: number;
	compliantCount: number;
	partialCount: number;
	nonCompliantCount: number;
	notAddressedCount: number;
	complianceScore: number | null;
	mandatoryComplianceScore: number | null;
	entries: ComplianceEntryResponse[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PatchSchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		description: z.string().nullable().optional(),
		status: z.enum(MATRIX_STATUSES).optional(),
	})
	.strict();

export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ matrixId: string }> },
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { matrixId } = await context.params;
	if (!UUID_RE.test(matrixId)) {
		return NextResponse.json({ error: "Invalid matrixId" }, { status: 400 });
	}

	try {
		const matrix = await db.query.complianceMatrices.findFirst({
			where: and(
				eq(complianceMatrices.id, matrixId),
				eq(complianceMatrices.organizationId, ctx.organizationId),
			),
		});

		if (!matrix) {
			return NextResponse.json(
				{ error: "Compliance matrix not found" },
				{ status: 404 },
			);
		}

		const entries = await db
			.select({
				entry: complianceEntries,
				requirement: rfpRequirements,
			})
			.from(complianceEntries)
			.innerJoin(
				rfpRequirements,
				eq(complianceEntries.requirementId, rfpRequirements.id),
			)
			.where(
				and(
					eq(complianceEntries.matrixId, matrixId),
					eq(complianceEntries.organizationId, ctx.organizationId),
				),
			)
			.orderBy(
				asc(complianceEntries.sortOrder),
				asc(rfpRequirements.requirementNumber),
			);

		const formattedEntries: ComplianceEntryResponse[] = entries.map(
			({ entry, requirement }) => ({
				id: entry.id,
				requirementId: requirement.id,
				requirementNumber: requirement.requirementNumber ?? requirement.id,
				requirementTitle: requirement.title,
				requirementText: requirement.requirementText,
				category: requirement.category ?? "other",
				priority: requirement.priority ?? "medium",
				sourceSection: requirement.sourceSection,
				complianceStatus: entry.complianceStatus,
				complianceJustification: entry.complianceJustification,
				responseReference: entry.responseReference,
				responseSummary: entry.responseSummary,
				strengthAssessment: entry.strengthAssessment,
				riskLevel: entry.riskLevel,
				mitigationStrategy: entry.mitigationStrategy,
				assignedTo: entry.assignedTo,
				dueDate: entry.dueDate?.toISOString() ?? null,
				completionPercent: entry.completionPercent,
				status: entry.status,
			}),
		);

		const response: ComplianceMatrixResponse = {
			id: matrix.id,
			name: matrix.name,
			description: matrix.description,
			version: matrix.version,
			status: matrix.status,
			opportunityId: matrix.opportunityId,
			rfpDocumentId: matrix.rfpDocumentId,
			totalRequirements: matrix.totalRequirements,
			mandatoryCount: matrix.mandatoryCount,
			compliantCount: matrix.compliantCount,
			partialCount: matrix.partialCount,
			nonCompliantCount: matrix.nonCompliantCount,
			notAddressedCount: matrix.notAddressedCount,
			complianceScore: matrix.complianceScore,
			mandatoryComplianceScore: matrix.mandatoryComplianceScore,
			entries: formattedEntries,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Compliance matrix error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string }> },
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { matrixId } = await context.params;
	if (!UUID_RE.test(matrixId)) {
		return NextResponse.json({ error: "Invalid matrixId" }, { status: 400 });
	}

	const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid body", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	try {
		const [updated] = await db
			.update(complianceMatrices)
			.set({ ...parsed.data, updatedAt: new Date() })
			.where(
				and(
					eq(complianceMatrices.id, matrixId),
					eq(complianceMatrices.organizationId, ctx.organizationId),
				),
			)
			.returning();

		if (!updated) {
			return NextResponse.json(
				{ error: "Compliance matrix not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json(updated);
	} catch (error) {
		console.error("Compliance matrix update error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
