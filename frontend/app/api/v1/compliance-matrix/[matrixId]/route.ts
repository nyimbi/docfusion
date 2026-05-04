/**
 * Compliance Matrix API Route
 *
 * Returns a compliance matrix with all entries for display and management.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { complianceMatrices, complianceEntries, rfpRequirements } from "@/lib/db/schema-rfp";
import { eq, asc } from "drizzle-orm";
import type { ComplianceMatrixRow, ComplianceEntryRow, RfpRequirementRow } from "@/lib/db/schema-rfp";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Handler
// ============================================================================

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string }> }
): Promise<NextResponse> {
	try {
		// Authenticate user
		await requireServerSession();

		const { matrixId } = await context.params;

		// Get compliance matrix
		const matrix = await db.query.complianceMatrices.findFirst({
			where: eq(complianceMatrices.id, matrixId),
		});

		if (!matrix) {
			return NextResponse.json(
				{ error: "Compliance matrix not found" },
				{ status: 404 }
			);
		}

		// Get all entries with requirements
		const entries = await db
			.select({
				entry: complianceEntries,
				requirement: rfpRequirements,
			})
			.from(complianceEntries)
			.innerJoin(rfpRequirements, eq(complianceEntries.requirementId, rfpRequirements.id))
			.where(eq(complianceEntries.matrixId, matrixId))
			.orderBy(asc(complianceEntries.sortOrder), asc(rfpRequirements.requirementNumber));

		// Format entries
		const formattedEntries: ComplianceEntryResponse[] = entries.map(({ entry, requirement }) => ({
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
		}));

		// Build response
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
			{ status: 500 }
		);
	}
}

// ============================================================================
// PATCH - Update matrix metadata
// ============================================================================

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string }> }
): Promise<NextResponse> {
	try {
		// Authenticate user
		await requireServerSession();

		const { matrixId } = await context.params;

		// Get existing matrix
		const existingMatrix = await db.query.complianceMatrices.findFirst({
			where: eq(complianceMatrices.id, matrixId),
		});

		if (!existingMatrix) {
			return NextResponse.json(
				{ error: "Compliance matrix not found" },
				{ status: 404 }
			);
		}

		// Parse request body
		const body = await request.json();
		const { name, description, status } = body;

		// Update matrix
		const [updated] = await db
			.update(complianceMatrices)
			.set({
				...(name !== undefined && { name }),
				...(description !== undefined && { description }),
				...(status !== undefined && { status }),
				updatedAt: new Date(),
			})
			.where(eq(complianceMatrices.id, matrixId))
			.returning();

		return NextResponse.json(updated);
	} catch (error) {
		console.error("Compliance matrix update error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
