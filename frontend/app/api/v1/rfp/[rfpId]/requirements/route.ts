/**
 * RFP Requirements API Route
 *
 * Returns all extracted requirements for an RFP document with
 * filtering and pagination support.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { rfpDocuments, rfpRequirements } from "@/lib/db/schema-rfp";
import { eq, and, ilike, inArray, desc, asc, sql } from "drizzle-orm";
import type { RequirementCategory, RequirementPriority, ComplianceStatus, RiskLevel } from "@/lib/db/schema-rfp";

// ============================================================================
// Types
// ============================================================================

interface RequirementsResponse {
	requirements: Array<{
		id: string;
		requirementNumber: string;
		title: string | null;
		requirementText: string;
		sourceQuote: string | null;
		sourcePage: number | null;
		sourceSection: string | null;
		category: RequirementCategory;
		subcategory: string | null;
		requirementType: string;
		priority: RequirementPriority;
		riskLevel: RiskLevel;
		evaluationWeight: number | null;
		extractionConfidence: number | null;
		isImplicit: boolean;
		ambiguityLevel: string | null;
		clarificationQuestions: string[];
		relatedRequirements: string[];
		keyTerms: string[];
		suggestedApproach: string | null;
		complianceStatus: ComplianceStatus;
		responseStrategy: string | null;
		assignedTo: string | null;
		dueDate: string | null;
		responseDocumentId: string | null;
		responseSection: string | null;
		notes: string | null;
		tags: string[];
	}>;
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

// ============================================================================
// Handler
// ============================================================================

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ rfpId: string }> }
): Promise<NextResponse> {
	try {
		// Authenticate user
		await requireServerSession();

		const { rfpId } = await context.params;

		// Parse query parameters
		const searchParams = request.nextUrl.searchParams;
		const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
		const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50")));
		const search = searchParams.get("search") ?? "";
		const category = searchParams.get("category") as RequirementCategory | null;
		const priority = searchParams.get("priority") as RequirementPriority | null;
		const status = searchParams.get("status") as ComplianceStatus | null;
		const riskLevel = searchParams.get("riskLevel") as RiskLevel | null;
		const sortBy = searchParams.get("sortBy") ?? "requirementNumber";
		const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

		// Verify RFP document exists
		const rfpDocument = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, rfpId),
		});

		if (!rfpDocument) {
			return NextResponse.json(
				{ error: "RFP document not found" },
				{ status: 404 }
			);
		}

		// Build where conditions
		const conditions = [eq(rfpRequirements.rfpDocumentId, rfpId)];

		if (search) {
			conditions.push(
				sql`(
					${ilike(rfpRequirements.requirementNumber, `%${search}%`)} OR
					${ilike(rfpRequirements.title, `%${search}%`)} OR
					${ilike(rfpRequirements.requirementText, `%${search}%`)} OR
					${ilike(rfpRequirements.sourceSection, `%${search}%`)}
				)`
			);
		}

		if (category) {
			conditions.push(eq(rfpRequirements.category, category));
		}

		if (priority) {
			conditions.push(eq(rfpRequirements.priority, priority));
		}

		if (status) {
			conditions.push(eq(rfpRequirements.complianceStatus, status));
		}

		if (riskLevel) {
			conditions.push(eq(rfpRequirements.riskLevel, riskLevel));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(rfpRequirements)
			.where(and(...conditions));
		const total = countResult?.count ?? 0;

		// Build order by
		const orderByColumn = (() => {
			switch (sortBy) {
				case "category":
					return rfpRequirements.category;
				case "priority":
					return rfpRequirements.priority;
				case "status":
					return rfpRequirements.complianceStatus;
				case "riskLevel":
					return rfpRequirements.riskLevel;
				case "dueDate":
					return rfpRequirements.dueDate;
				default:
					return rfpRequirements.requirementNumber;
			}
		})();
		const orderBy = sortOrder === "desc" ? desc(orderByColumn) : asc(orderByColumn);

		// Fetch requirements
		const requirements = await db
			.select()
			.from(rfpRequirements)
			.where(and(...conditions))
			.orderBy(orderBy)
			.limit(pageSize)
			.offset((page - 1) * pageSize);

		// Format response
		const formattedRequirements = requirements.map((req) => ({
			id: req.id,
			requirementNumber: req.requirementNumber,
			title: req.title,
			requirementText: req.requirementText,
			sourceQuote: req.sourceQuote,
			sourcePage: req.sourcePage,
			sourceSection: req.sourceSection,
			category: req.category as RequirementCategory,
			subcategory: req.subcategory,
			requirementType: req.requirementType,
			priority: req.priority as RequirementPriority,
			riskLevel: req.riskLevel as RiskLevel,
			evaluationWeight: req.evaluationWeight,
			extractionConfidence: req.extractionConfidence,
			isImplicit: req.isImplicit,
			ambiguityLevel: req.ambiguityLevel,
			clarificationQuestions: (req.clarificationQuestions ?? []) as string[],
			relatedRequirements: (req.relatedRequirements ?? []) as string[],
			keyTerms: (req.keyTerms ?? []) as string[],
			suggestedApproach: req.suggestedApproach,
			complianceStatus: req.complianceStatus as ComplianceStatus,
			responseStrategy: req.responseStrategy,
			assignedTo: req.assignedTo,
			dueDate: req.dueDate?.toISOString() ?? null,
			responseDocumentId: req.responseDocumentId,
			responseSection: req.responseSection,
			notes: req.notes,
			tags: (req.tags ?? []) as string[],
		}));

		const response: RequirementsResponse = {
			requirements: formattedRequirements,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize),
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("RFP requirements error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
