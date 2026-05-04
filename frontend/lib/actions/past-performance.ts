/**
 * Past Performance Server Actions
 *
 * Server actions for managing past performance projects,
 * calculating relevance scores, and generating narratives.
 *
 * Implements full CRUD operations with PostgreSQL database
 * and AI-powered narrative generation.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
	projects,
	projectRelevanceScores,
	type Project as DBProject,
	type NewProject,
} from "@/lib/db/schema-past-performance";
import { opportunities } from "@/lib/db/schema";
import { rfpRequirements } from "@/lib/db/schema-rfp";
import { eq, and, or, ilike, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import { complete } from "@/lib/ai/client";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Input Schemas
// ============================================================================

const CreateProjectInput = z.object({
	name: z.string().min(1).max(500),
	contractNumber: z.string().max(100).optional(),
	taskOrderNumber: z.string().max(100).optional(),
	customerName: z.string().min(1).max(500),
	customerAgency: z.string().max(500).optional(),
	customerPOC: z.string().max(200).optional(),
	customerPOCEmail: z.string().email().optional(),
	customerPOCPhone: z.string().max(50).optional(),
	contractType: z.string().max(100).optional(),
	contractValue: z.number().positive().optional(),
	periodOfPerformance: z.object({
		start: z.string(),
		end: z.string(),
		options: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
	}).optional(),
	description: z.string().optional(),
	scopeSummary: z.string().optional(),
	technicalAreas: z.array(z.string()).optional(),
	naicsCode: z.string().max(20).optional(),
	peakStaffing: z.number().int().positive().optional(),
	keyPersonnel: z.array(z.object({
		name: z.string(),
		role: z.string(),
		personnelId: z.string().optional(),
	})).optional(),
	cparRatings: z.object({
		quality: z.number().min(1).max(5),
		schedule: z.number().min(1).max(5),
		cost: z.number().min(1).max(5),
		management: z.number().min(1).max(5),
		smallBusiness: z.number().min(1).max(5).optional(),
		overall: z.number().min(1).max(5),
		narratives: z.object({
			quality: z.string().optional(),
			schedule: z.string().optional(),
			cost: z.string().optional(),
			management: z.string().optional(),
		}).optional(),
	}).optional(),
	keyAccomplishments: z.array(z.string()).optional(),
	quantifiedResults: z.array(z.object({
		metric: z.string(),
		value: z.string(),
		context: z.string(),
		impactArea: z.string().optional(),
	})).optional(),
	challenges: z.array(z.object({
		challenge: z.string(),
		resolution: z.string(),
		outcome: z.string(),
	})).optional(),
	awards: z.array(z.object({
		name: z.string(),
		date: z.string(),
		issuingOrganization: z.string(),
	})).optional(),
	securityLevel: z.string().max(50).optional(),
	primeOrSub: z.enum(["prime", "subcontractor"]).default("prime"),
	primeContractorName: z.string().max(500).optional(),
	subcontractValue: z.number().positive().optional(),
	referenceStatus: z.enum(["available", "limited", "unavailable"]).default("available"),
	referenceNotes: z.string().optional(),
});

const UpdateProjectInput = CreateProjectInput.partial();

const ProjectFilters = z.object({
	query: z.string().optional(),
	customerAgency: z.string().optional(),
	contractType: z.string().optional(),
	naicsCode: z.string().optional(),
	technicalAreas: z.array(z.string()).optional(),
	minContractValue: z.number().optional(),
	maxContractValue: z.number().optional(),
	dateRange: z.object({
		start: z.string(),
		end: z.string(),
	}).optional(),
	primeOrSub: z.enum(["prime", "subcontractor", "all"]).optional(),
	referenceStatus: z.enum(["available", "limited", "unavailable", "all"]).optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().positive().max(100).default(50),
	offset: z.number().int().min(0).default(0),
});

const RelevanceMatrixInput = z.object({
	opportunityId: z.string().uuid(),
	projectIds: z.array(z.string().uuid()).min(1).max(10),
});

// ============================================================================
// Result Types
// ============================================================================

interface ActionResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

interface Project {
	id: string;
	name: string;
	contractNumber?: string;
	customerName: string;
	customerAgency?: string;
	contractType?: string;
	contractValue?: number;
	periodOfPerformance?: {
		start: string;
		end: string;
		options?: { start: string; end: string }[];
	};
	description?: string;
	technicalAreas?: string[];
	cparRatings?: {
		quality: number;
		schedule: number;
		cost: number;
		management: number;
		overall: number;
	};
	keyAccomplishments?: string[];
	quantifiedResults?: { metric: string; value: string; context: string }[];
	isActive: boolean;
	referenceStatus: string;
	createdAt: string;
	updatedAt: string;
}

interface RelevanceScore {
	projectId: string;
	projectName: string;
	overallScore: number;
	recencyScore: number;
	sizeScore: number;
	scopeScore: number;
	customerScore: number;
	matchingRequirements: { requirementId: string; requirementText: string; matchStrength: number; matchReason: string }[];
	gaps: { area: string; severity: "critical" | "moderate" | "minor" }[];
	relevanceNarrative: string;
}

interface RelevanceMatrix {
	opportunityId: string;
	opportunityTitle: string;
	projects: RelevanceScore[];
	recommendedOrder: string[];
	coverageAnalysis: {
		totalRequirements: number;
		coveredRequirements: number;
		coveragePercentage: number;
		uncoveredAreas: string[];
	};
}

interface NarrativeResult {
	narrative: string;
	wordCount: number;
	keyPoints: string[];
}

interface GapAnalysis {
	gaps: {
		area: string;
		severity: "critical" | "moderate" | "minor";
		description: string;
		suggestedMitigation: string;
	}[];
	strengths: string[];
	recommendations: string[];
}

// ============================================================================
// Project CRUD Actions
// ============================================================================

/**
 * Create a new past performance project
 */
export async function createProject(
	input: z.infer<typeof CreateProjectInput>
): Promise<ActionResult<Project>> {
	try {
		const validatedInput = CreateProjectInput.parse(input);

		// Insert into database
		const [insertedProject] = await db
			.insert(projects)
			.values({
				name: validatedInput.name,
				contractNumber: validatedInput.contractNumber,
				taskOrderNumber: validatedInput.taskOrderNumber,
				customerName: validatedInput.customerName,
				customerAgency: validatedInput.customerAgency,
				customerPOC: validatedInput.customerPOC,
				customerPOCEmail: validatedInput.customerPOCEmail,
				customerPOCPhone: validatedInput.customerPOCPhone,
				contractType: validatedInput.contractType,
				contractValue: validatedInput.contractValue,
				periodOfPerformance: validatedInput.periodOfPerformance,
				description: validatedInput.description,
				scopeSummary: validatedInput.scopeSummary,
				technicalAreas: validatedInput.technicalAreas,
				naicsCode: validatedInput.naicsCode,
				peakStaffing: validatedInput.peakStaffing,
				keyPersonnel: validatedInput.keyPersonnel,
				cparRatings: validatedInput.cparRatings,
				keyAccomplishments: validatedInput.keyAccomplishments,
				quantifiedResults: validatedInput.quantifiedResults,
				challenges: validatedInput.challenges,
				awards: validatedInput.awards,
				securityLevel: validatedInput.securityLevel,
				primeOrSub: validatedInput.primeOrSub,
				primeContractorName: validatedInput.primeContractorName,
				subcontractValue: validatedInput.subcontractValue,
				referenceStatus: validatedInput.referenceStatus ?? "available",
				referenceNotes: validatedInput.referenceNotes,
				isActive: true,
			})
			.returning();

		const newProject: Project = mapDBProjectToProject(insertedProject);

		revalidatePath("/past-performance");

		return { success: true, data: newProject };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to create project:", error);
		return { success: false, error: "Failed to create project" };
	}
}

/**
 * Map database project row to API project type
 */
function mapDBProjectToProject(row: DBProject): Project {
	return {
		id: row.id,
		name: row.name,
		contractNumber: row.contractNumber ?? undefined,
		customerName: row.customerName,
		customerAgency: row.customerAgency ?? undefined,
		contractType: row.contractType ?? undefined,
		contractValue: row.contractValue ?? undefined,
		periodOfPerformance: row.periodOfPerformance ?? undefined,
		description: row.description ?? undefined,
		technicalAreas: row.technicalAreas ?? undefined,
		cparRatings: row.cparRatings ?? undefined,
		keyAccomplishments: row.keyAccomplishments ?? undefined,
		quantifiedResults: row.quantifiedResults ?? undefined,
		isActive: row.isActive ?? true,
		referenceStatus: row.referenceStatus ?? "available",
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
	};
}

/**
 * Update an existing project
 */
export async function updateProject(
	id: string,
	input: z.infer<typeof UpdateProjectInput>
): Promise<ActionResult<Project>> {
	try {
		const validatedInput = UpdateProjectInput.parse(input);

		// Build update object with only provided fields
		const updateData: Partial<NewProject> = {
			updatedAt: new Date(),
		};

		if (validatedInput.name !== undefined) updateData.name = validatedInput.name;
		if (validatedInput.contractNumber !== undefined) updateData.contractNumber = validatedInput.contractNumber;
		if (validatedInput.taskOrderNumber !== undefined) updateData.taskOrderNumber = validatedInput.taskOrderNumber;
		if (validatedInput.customerName !== undefined) updateData.customerName = validatedInput.customerName;
		if (validatedInput.customerAgency !== undefined) updateData.customerAgency = validatedInput.customerAgency;
		if (validatedInput.customerPOC !== undefined) updateData.customerPOC = validatedInput.customerPOC;
		if (validatedInput.customerPOCEmail !== undefined) updateData.customerPOCEmail = validatedInput.customerPOCEmail;
		if (validatedInput.customerPOCPhone !== undefined) updateData.customerPOCPhone = validatedInput.customerPOCPhone;
		if (validatedInput.contractType !== undefined) updateData.contractType = validatedInput.contractType;
		if (validatedInput.contractValue !== undefined) updateData.contractValue = validatedInput.contractValue;
		if (validatedInput.periodOfPerformance !== undefined) updateData.periodOfPerformance = validatedInput.periodOfPerformance;
		if (validatedInput.description !== undefined) updateData.description = validatedInput.description;
		if (validatedInput.scopeSummary !== undefined) updateData.scopeSummary = validatedInput.scopeSummary;
		if (validatedInput.technicalAreas !== undefined) updateData.technicalAreas = validatedInput.technicalAreas;
		if (validatedInput.naicsCode !== undefined) updateData.naicsCode = validatedInput.naicsCode;
		if (validatedInput.peakStaffing !== undefined) updateData.peakStaffing = validatedInput.peakStaffing;
		if (validatedInput.keyPersonnel !== undefined) updateData.keyPersonnel = validatedInput.keyPersonnel;
		if (validatedInput.cparRatings !== undefined) updateData.cparRatings = validatedInput.cparRatings;
		if (validatedInput.keyAccomplishments !== undefined) updateData.keyAccomplishments = validatedInput.keyAccomplishments;
		if (validatedInput.quantifiedResults !== undefined) updateData.quantifiedResults = validatedInput.quantifiedResults;
		if (validatedInput.challenges !== undefined) updateData.challenges = validatedInput.challenges;
		if (validatedInput.awards !== undefined) updateData.awards = validatedInput.awards;
		if (validatedInput.securityLevel !== undefined) updateData.securityLevel = validatedInput.securityLevel;
		if (validatedInput.primeOrSub !== undefined) updateData.primeOrSub = validatedInput.primeOrSub;
		if (validatedInput.primeContractorName !== undefined) updateData.primeContractorName = validatedInput.primeContractorName;
		if (validatedInput.subcontractValue !== undefined) updateData.subcontractValue = validatedInput.subcontractValue;
		if (validatedInput.referenceStatus !== undefined) updateData.referenceStatus = validatedInput.referenceStatus;
		if (validatedInput.referenceNotes !== undefined) updateData.referenceNotes = validatedInput.referenceNotes;

		const [updatedRow] = await db
			.update(projects)
			.set(updateData)
			.where(eq(projects.id, id))
			.returning();

		if (!updatedRow) {
			return { success: false, error: "Project not found" };
		}

		const updatedProject = mapDBProjectToProject(updatedRow);

		revalidatePath("/past-performance");
		revalidatePath(`/past-performance/${id}`);

		return { success: true, data: updatedProject };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update project:", error);
		return { success: false, error: "Failed to update project" };
	}
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<ActionResult<void>> {
	try {
		const result = await db
			.delete(projects)
			.where(eq(projects.id, id))
			.returning({ id: projects.id });

		if (result.length === 0) {
			return { success: false, error: "Project not found" };
		}

		revalidatePath("/past-performance");

		return { success: true };
	} catch (error) {
		logger.error("Failed to delete project:", error);
		return { success: false, error: "Failed to delete project" };
	}
}

/**
 * Duplicate a project
 * Creates a copy of an existing project with "(Copy)" appended to the name
 */
export async function duplicateProject(id: string): Promise<ActionResult<Project>> {
	try {
		// Fetch the original project
		const [originalProject] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, id))
			.limit(1);

		if (!originalProject) {
			return { success: false, error: "Project not found" };
		}

		// Create a new project with copied values (excluding id and timestamps)
		const [duplicatedProject] = await db
			.insert(projects)
			.values({
				name: `${originalProject.name} (Copy)`,
				contractNumber: originalProject.contractNumber,
				taskOrderNumber: originalProject.taskOrderNumber,
				customerName: originalProject.customerName,
				customerAgency: originalProject.customerAgency,
				customerPOC: originalProject.customerPOC,
				customerPOCEmail: originalProject.customerPOCEmail,
				customerPOCPhone: originalProject.customerPOCPhone,
				contractType: originalProject.contractType,
				contractValue: originalProject.contractValue,
				periodOfPerformance: originalProject.periodOfPerformance,
				description: originalProject.description,
				scopeSummary: originalProject.scopeSummary,
				technicalAreas: originalProject.technicalAreas,
				naicsCode: originalProject.naicsCode,
				peakStaffing: originalProject.peakStaffing,
				keyPersonnel: originalProject.keyPersonnel,
				cparRatings: originalProject.cparRatings,
				keyAccomplishments: originalProject.keyAccomplishments,
				quantifiedResults: originalProject.quantifiedResults,
				challenges: originalProject.challenges,
				awards: originalProject.awards,
				securityLevel: originalProject.securityLevel,
				primeOrSub: originalProject.primeOrSub,
				primeContractorName: originalProject.primeContractorName,
				subcontractValue: originalProject.subcontractValue,
				referenceStatus: originalProject.referenceStatus ?? "available",
				referenceNotes: originalProject.referenceNotes,
				isActive: true,
			})
			.returning();

		const newProject: Project = mapDBProjectToProject(duplicatedProject);

		revalidatePath("/past-performance");

		return { success: true, data: newProject };
	} catch (error) {
		logger.error("Failed to duplicate project:", error);
		return { success: false, error: "Failed to duplicate project" };
	}
}

/**
 * Search projects with filters
 */
export async function searchProjects(
	filters: z.infer<typeof ProjectFilters>
): Promise<ActionResult<{ projects: Project[]; total: number }>> {
	try {
		const validatedFilters = ProjectFilters.parse(filters);

		// Build dynamic where conditions
		const conditions = [];

		if (validatedFilters.query) {
			const searchTerm = `%${validatedFilters.query}%`;
			conditions.push(
				or(
					ilike(projects.name, searchTerm),
					ilike(projects.customerName, searchTerm),
					ilike(projects.description, searchTerm),
					ilike(projects.contractNumber, searchTerm)
				)
			);
		}

		if (validatedFilters.customerAgency) {
			conditions.push(ilike(projects.customerAgency, `%${validatedFilters.customerAgency}%`));
		}

		if (validatedFilters.contractType) {
			conditions.push(eq(projects.contractType, validatedFilters.contractType));
		}

		if (validatedFilters.naicsCode) {
			conditions.push(eq(projects.naicsCode, validatedFilters.naicsCode));
		}

		if (validatedFilters.minContractValue !== undefined) {
			conditions.push(gte(projects.contractValue, validatedFilters.minContractValue));
		}

		if (validatedFilters.maxContractValue !== undefined) {
			conditions.push(lte(projects.contractValue, validatedFilters.maxContractValue));
		}

		if (validatedFilters.primeOrSub && validatedFilters.primeOrSub !== "all") {
			conditions.push(eq(projects.primeOrSub, validatedFilters.primeOrSub));
		}

		if (validatedFilters.referenceStatus && validatedFilters.referenceStatus !== "all") {
			conditions.push(eq(projects.referenceStatus, validatedFilters.referenceStatus));
		}

		if (validatedFilters.isActive !== undefined) {
			conditions.push(eq(projects.isActive, validatedFilters.isActive));
		}

		// Execute query with filters
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [projectRows, countResult] = await Promise.all([
			db
				.select()
				.from(projects)
				.where(whereClause)
				.orderBy(desc(projects.updatedAt))
				.limit(validatedFilters.limit)
				.offset(validatedFilters.offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(projects)
				.where(whereClause),
		]);

		const mappedProjects = projectRows.map(mapDBProjectToProject);
		const total = countResult[0]?.count ?? 0;

		return {
			success: true,
			data: {
				projects: mappedProjects,
				total,
			},
		};
	} catch (error) {
		logger.error("Failed to search projects:", error);
		return { success: false, error: "Failed to search projects" };
	}
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<ActionResult<Project>> {
	try {
		const [row] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, id))
			.limit(1);

		if (!row) {
			return { success: false, error: "Project not found" };
		}

		return { success: true, data: mapDBProjectToProject(row) };
	} catch (error) {
		logger.error("Failed to get project:", error);
		return { success: false, error: "Failed to get project" };
	}
}

// ============================================================================
// Relevance Scoring Actions
// ============================================================================

/**
 * Calculate relevance scores for all projects against an opportunity
 */
export async function calculateRelevanceScores(
	opportunityId: string
): Promise<ActionResult<RelevanceScore[]>> {
	try {
		// Fetch opportunity details
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, opportunityId))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch requirements for this opportunity
		const oppRequirements = await db
			.select()
			.from(rfpRequirements)
			.where(eq(rfpRequirements.opportunityId, opportunityId));

		// Fetch all active projects
		const allProjects = await db
			.select()
			.from(projects)
			.where(eq(projects.isActive, true))
			.orderBy(desc(projects.updatedAt));

		const scores: RelevanceScore[] = [];

		for (const project of allProjects) {
			// Calculate component scores
			const recencyScore = calculateRecencyScore(project.periodOfPerformance);
			const sizeScore = calculateSizeScore(project.contractValue, opportunity.budgetNumeric);
			const scopeScore = calculateScopeScore(
				project.technicalAreas ?? [],
				project.description ?? "",
				opportunity.projectScope ?? "",
				opportunity.technicalRequirements ?? ""
			);
			const customerScore = calculateCustomerScore(
				project.customerAgency ?? "",
				opportunity.organization ?? ""
			);

			// Calculate requirement matches
			const matchingRequirements = oppRequirements
				.map((req) => {
					const matchStrength = calculateRequirementMatch(
						project.description ?? "",
						project.technicalAreas ?? [],
						req.requirementText
					);
					return {
						requirementId: req.id,
						requirementText: req.requirementText,
						matchStrength,
						matchReason: matchStrength > 0.7
							? `Strong match based on technical areas and project scope`
							: matchStrength > 0.5
							? `Moderate match based on related experience`
							: `Partial match based on transferable capabilities`,
					};
				})
				.filter((m) => m.matchStrength > 0.3)
				.sort((a, b) => b.matchStrength - a.matchStrength);

			// Identify gaps
			const gaps = identifyGaps(project, oppRequirements);

			// Calculate overall score (weighted average)
			const overallScore = Math.round(
				recencyScore * 0.2 +
				sizeScore * 0.15 +
				scopeScore * 0.4 +
				customerScore * 0.25
			);

			// Store relevance score in database
			await db
				.insert(projectRelevanceScores)
				.values({
					projectId: project.id,
					opportunityId,
					overallScore,
					recencyScore,
					sizeScore,
					scopeScore,
					customerScore,
					matchingRequirements,
					gaps,
					calculatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [projectRelevanceScores.projectId, projectRelevanceScores.opportunityId],
					set: {
						overallScore,
						recencyScore,
						sizeScore,
						scopeScore,
						customerScore,
						matchingRequirements,
						gaps,
						calculatedAt: new Date(),
					},
				});

			scores.push({
				projectId: project.id,
				projectName: project.name,
				overallScore,
				recencyScore,
				sizeScore,
				scopeScore,
				customerScore,
				matchingRequirements,
				gaps,
				relevanceNarrative: `This project demonstrates ${overallScore >= 80 ? "strong" : overallScore >= 60 ? "moderate" : "limited"} relevance to the opportunity based on scope alignment, customer experience, and contract complexity.`,
			});
		}

		// Sort by overall score
		scores.sort((a, b) => b.overallScore - a.overallScore);

		return { success: true, data: scores };
	} catch (error) {
		logger.error("Failed to calculate relevance scores:", error);
		return { success: false, error: "Failed to calculate relevance scores" };
	}
}

/**
 * Calculate recency score based on period of performance
 */
function calculateRecencyScore(pop?: { start: string; end: string } | null): number {
	if (!pop?.end) return 50;

	const endDate = new Date(pop.end);
	const now = new Date();
	const monthsAgo = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

	if (monthsAgo <= 12) return 100; // Within 1 year
	if (monthsAgo <= 24) return 90; // Within 2 years
	if (monthsAgo <= 36) return 75; // Within 3 years
	if (monthsAgo <= 60) return 60; // Within 5 years
	return 40; // Older
}

/**
 * Calculate size similarity score
 */
function calculateSizeScore(projectValue?: number | null, oppBudget?: number | null): number {
	if (!projectValue || !oppBudget) return 50;

	const ratio = projectValue / oppBudget;
	if (ratio >= 0.8 && ratio <= 1.2) return 100; // Within 20%
	if (ratio >= 0.5 && ratio <= 2.0) return 80; // Within 50-200%
	if (ratio >= 0.25 && ratio <= 4.0) return 60; // Within 25-400%
	return 40;
}

/**
 * Calculate scope similarity score using keyword matching
 */
function calculateScopeScore(
	projectAreas: string[],
	projectDesc: string,
	oppScope: string,
	oppTechReqs: string
): number {
	const projectText = (projectAreas.join(" ") + " " + projectDesc).toLowerCase();
	const oppText = (oppScope + " " + oppTechReqs).toLowerCase();

	// Extract keywords from opportunity
	const keywords = oppText
		.split(/\W+/)
		.filter((w) => w.length > 3)
		.filter((w, i, arr) => arr.indexOf(w) === i);

	if (keywords.length === 0) return 50;

	// Count matches
	const matches = keywords.filter((kw) => projectText.includes(kw)).length;
	const matchRatio = matches / keywords.length;

	return Math.round(40 + matchRatio * 60); // Scale from 40-100
}

/**
 * Calculate customer/agency similarity score
 * Uses sector-based matching optimized for international development and African contexts
 */
function calculateCustomerScore(projectAgency: string, oppOrg: string): number {
	if (!projectAgency || !oppOrg) return 50;

	const projLower = projectAgency.toLowerCase();
	const oppLower = oppOrg.toLowerCase();

	// Exact match
	if (projLower === oppLower) return 100;

	// Partial match (contains)
	if (projLower.includes(oppLower) || oppLower.includes(projLower)) return 85;

	// Same sector matching using normalized names
	const projSector = normalizeAgencyName(projectAgency);
	const oppSector = normalizeAgencyName(oppOrg);
	if (projSector === oppSector && projSector !== projectAgency) return 75;

	// Keyword-based sector matching for international development contexts
	const sectorKeywords = [
		// UN System & Multilaterals
		["united nations", "un ", " un", "undp", "unicef", "who", "wfp", "fao", "unesco", "multilateral"],
		// World Bank & Development Finance
		["world bank", "ifc", "afdb", "adb", "development bank", "dfc", "development finance"],
		// Health & Global Health
		["health", "medical", "hospital", "gavi", "global fund", "pepfar", "pharmaceutical", "clinic"],
		// Agriculture & Food Security
		["agriculture", "food", "agri", "farming", "livestock", "fisheries", "nutrition"],
		// Education & Capacity Building
		["education", "training", "capacity", "school", "university", "academic", "learning"],
		// Infrastructure & Energy
		["infrastructure", "energy", "power", "roads", "transport", "water", "sanitation", "electricity"],
		// Governance & Public Sector
		["ministry", "government", "governance", "public sector", "civil service", "administration"],
		// Regional Organizations
		["african union", "ecowas", "sadc", "eac", "comesa", "igad", "regional"],
		// Environment & Climate
		["environment", "climate", "conservation", "natural resources", "forestry", "biodiversity"],
		// Humanitarian & Emergency
		["humanitarian", "emergency", "disaster", "relief", "refugee", "crisis"],
		// Private Sector Development
		["private sector", "enterprise", "sme", "business", "trade", "investment", "commercial"],
		// Gender & Social Inclusion
		["gender", "women", "youth", "social", "inclusion", "community", "rural"],
	];

	for (const keywords of sectorKeywords) {
		const projMatch = keywords.some(kw => projLower.includes(kw));
		const oppMatch = keywords.some(kw => oppLower.includes(kw));
		if (projMatch && oppMatch) return 70;
	}

	// African government matching - boost score for same country matches
	const africanCountries = [
		"nigeria", "kenya", "south africa", "ethiopia", "ghana", "tanzania", "uganda",
		"rwanda", "senegal", "ivory coast", "côte d'ivoire", "cameroon", "morocco",
		"egypt", "algeria", "tunisia", "mozambique", "zambia", "zimbabwe", "malawi",
		"botswana", "namibia", "angola", "democratic republic of congo", "drc",
		"sudan", "south sudan", "somalia", "mali", "burkina faso", "niger", "chad",
		"benin", "togo", "guinea", "liberia", "sierra leone", "gambia"
	];

	for (const country of africanCountries) {
		if (projLower.includes(country) && oppLower.includes(country)) return 80;
	}

	return 40;
}

/**
 * Calculate requirement match strength
 */
function calculateRequirementMatch(
	projectDesc: string,
	projectAreas: string[],
	requirementText: string
): number {
	const projectText = (projectDesc + " " + projectAreas.join(" ")).toLowerCase();
	const reqLower = requirementText.toLowerCase();

	const reqWords = reqLower.split(/\W+/).filter((w) => w.length > 3);
	if (reqWords.length === 0) return 0;

	const matches = reqWords.filter((w) => projectText.includes(w)).length;
	return matches / reqWords.length;
}

/**
 * Identify capability gaps
 */
function identifyGaps(
	project: DBProject,
	oppRequirements: { id: string; requirementText: string; category?: string | null }[]
): { area: string; severity: "critical" | "moderate" | "minor" }[] {
	const gaps: { area: string; severity: "critical" | "moderate" | "minor" }[] = [];
	const projectText = (
		(project.description ?? "") +
		" " +
		(project.technicalAreas ?? []).join(" ")
	).toLowerCase();

	for (const req of oppRequirements) {
		const matchStrength = calculateRequirementMatch(
			project.description ?? "",
			project.technicalAreas ?? [],
			req.requirementText
		);

		if (matchStrength < 0.2) {
			gaps.push({
				area: req.category ?? "General",
				severity: matchStrength < 0.1 ? "critical" : "moderate",
			});
		}
	}

	// Deduplicate by area
	const uniqueGaps = gaps.reduce((acc, gap) => {
		const existing = acc.find((g) => g.area === gap.area);
		if (!existing || gap.severity === "critical") {
			return acc.filter((g) => g.area !== gap.area).concat(gap);
		}
		return acc;
	}, [] as typeof gaps);

	return uniqueGaps.slice(0, 5); // Return top 5 gaps
}

/**
 * Generate a relevance matrix comparing multiple projects against an opportunity
 */
export async function generateRelevanceMatrix(
	input: z.infer<typeof RelevanceMatrixInput>
): Promise<ActionResult<RelevanceMatrix>> {
	try {
		const validatedInput = RelevanceMatrixInput.parse(input);

		// Fetch opportunity details
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, validatedInput.opportunityId))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch requirements
		const oppRequirements = await db
			.select()
			.from(rfpRequirements)
			.where(eq(rfpRequirements.opportunityId, validatedInput.opportunityId));

		// Fetch selected projects with their relevance scores
		const selectedProjects = await db
			.select()
			.from(projects)
			.where(inArray(projects.id, validatedInput.projectIds));

		const relevanceScores = await db
			.select()
			.from(projectRelevanceScores)
			.where(
				and(
					eq(projectRelevanceScores.opportunityId, validatedInput.opportunityId),
					inArray(projectRelevanceScores.projectId, validatedInput.projectIds)
				)
			);

		// Map scores to projects
		const projectScores: RelevanceScore[] = selectedProjects.map((project) => {
			const score = relevanceScores.find((s) => s.projectId === project.id);
			return {
				projectId: project.id,
				projectName: project.name,
				overallScore: score?.overallScore ?? 0,
				recencyScore: score?.recencyScore ?? 0,
				sizeScore: score?.sizeScore ?? 0,
				scopeScore: score?.scopeScore ?? 0,
				customerScore: score?.customerScore ?? 0,
				matchingRequirements: (score?.matchingRequirements as RelevanceScore["matchingRequirements"]) ?? [],
				gaps: (score?.gaps as RelevanceScore["gaps"]) ?? [],
				relevanceNarrative: score?.relevanceNarrative ?? "",
			};
		});

		// Sort by overall score for recommended order
		const sortedProjects = [...projectScores].sort((a, b) => b.overallScore - a.overallScore);

		// Analyze requirement coverage
		const allMatchedReqIds = new Set<string>();
		for (const proj of projectScores) {
			for (const match of proj.matchingRequirements) {
				if (match.matchStrength >= 0.5) {
					allMatchedReqIds.add(match.requirementId);
				}
			}
		}

		const coveredCount = allMatchedReqIds.size;
		const totalReqs = oppRequirements.length || 1;
		const uncoveredReqs = oppRequirements
			.filter((r) => !allMatchedReqIds.has(r.id))
			.map((r) => r.category ?? "Uncategorized")
			.filter((v, i, a) => a.indexOf(v) === i);

		const matrix: RelevanceMatrix = {
			opportunityId: validatedInput.opportunityId,
			opportunityTitle: opportunity.title,
			projects: projectScores,
			recommendedOrder: sortedProjects.map((p) => p.projectId),
			coverageAnalysis: {
				totalRequirements: totalReqs,
				coveredRequirements: coveredCount,
				coveragePercentage: Math.round((coveredCount / totalReqs) * 100),
				uncoveredAreas: uncoveredReqs.slice(0, 5),
			},
		};

		return { success: true, data: matrix };
	} catch (error) {
		logger.error("Failed to generate relevance matrix:", error);
		return { success: false, error: "Failed to generate relevance matrix" };
	}
}

/**
 * Suggest the best projects for an opportunity
 */
export async function suggestProjects(
	opportunityId: string,
	limit: number = 5
): Promise<ActionResult<RelevanceScore[]>> {
	try {
		// Calculate scores for all projects and return top matches
		const scoresResult = await calculateRelevanceScores(opportunityId);

		if (!scoresResult.success || !scoresResult.data) {
			return scoresResult;
		}

		// Sort by overall score and return top N
		const sortedScores = scoresResult.data
			.sort((a, b) => b.overallScore - a.overallScore)
			.slice(0, limit);

		return { success: true, data: sortedScores };
	} catch (error) {
		return { success: false, error: "Failed to suggest projects" };
	}
}

// ============================================================================
// Narrative Generation Actions
// ============================================================================

/**
 * Generate a CPAR-style narrative for a project
 */
export async function generateCPARNarrative(
	projectId: string
): Promise<ActionResult<NarrativeResult>> {
	try {
		// Fetch project details
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		if (!project) {
			return { success: false, error: "Project not found" };
		}

		// Build context for AI
		const context = {
			name: project.name,
			customer: project.customerName,
			agency: project.customerAgency,
			contractValue: project.contractValue,
			contractType: project.contractType,
			periodOfPerformance: project.periodOfPerformance,
			description: project.description,
			technicalAreas: project.technicalAreas,
			cparRatings: project.cparRatings,
			keyAccomplishments: project.keyAccomplishments,
			quantifiedResults: project.quantifiedResults,
			challenges: project.challenges,
		};

		const prompt = `Generate a professional CPAR (Contractor Performance Assessment Report) style narrative for this government contract project.

Project Details:
${JSON.stringify(context, null, 2)}

Requirements:
1. Write in formal government documentation style
2. Highlight quantified achievements with specific metrics
3. Address all CPAR evaluation factors: Quality, Schedule, Cost, Management
4. Include specific accomplishments and their impact
5. Keep to 3-4 paragraphs
6. Use objective, third-person language ("The contractor...")

Generate the CPAR narrative:`;

		let narrative: string;
		let keyPoints: string[];

		try {
			const result = await complete(prompt, {
				maxTokens: 1000,
				temperature: 0.7,
			});
			narrative = result.content;

			// Extract key points from narrative
			keyPoints = extractKeyPoints(narrative, project);
		} catch (aiError) {
			// Fallback to template-based narrative if AI unavailable
			narrative = generateFallbackCPARNarrative(project);
			keyPoints = extractKeyPoints(narrative, project);
		}

		// Update project with generated narrative
		await db
			.update(projects)
			.set({
				cparNarrative: narrative,
				updatedAt: new Date(),
			})
			.where(eq(projects.id, projectId));

		const wordCount = narrative.split(/\s+/).length;

		return {
			success: true,
			data: {
				narrative,
				wordCount,
				keyPoints,
			},
		};
	} catch (error) {
		logger.error("Failed to generate CPAR narrative:", error);
		return { success: false, error: "Failed to generate CPAR narrative" };
	}
}

/**
 * Generate fallback CPAR narrative without AI
 */
function generateFallbackCPARNarrative(project: DBProject): string {
	const accomplishments = (project.keyAccomplishments ?? []).slice(0, 3).join(", ");
	const results = (project.quantifiedResults ?? [])
		.slice(0, 3)
		.map((r) => `${r.metric}: ${r.value}`)
		.join("; ");

	const ratings = project.cparRatings ?? { quality: 4, schedule: 4, cost: 4, management: 4, overall: 4 };
	const ratingDesc = (score: number) =>
		score >= 5 ? "Exceptional" : score >= 4 ? "Very Good" : score >= 3 ? "Satisfactory" : "Marginal";

	return `The contractor demonstrated ${ratingDesc(ratings.overall).toLowerCase()} performance on the ${project.name} contract for ${project.customerName}${project.customerAgency ? ` (${project.customerAgency})` : ""}.

${accomplishments ? `Key accomplishments included: ${accomplishments}.` : ""} ${results ? `Quantified results achieved: ${results}.` : ""}

QUALITY: Work quality was ${ratingDesc(ratings.quality).toLowerCase()}, with deliverables meeting or exceeding requirements.
SCHEDULE: Schedule performance was ${ratingDesc(ratings.schedule).toLowerCase()}, with proactive milestone management.
COST: Cost control was ${ratingDesc(ratings.cost).toLowerCase()}, demonstrating effective resource management.
MANAGEMENT: Management effectiveness was ${ratingDesc(ratings.management).toLowerCase()}, with clear communication and responsive issue resolution.

${project.contractValue ? `The contract valued at $${(project.contractValue / 1000000).toFixed(1)}M was executed as a ${project.contractType ?? "contract"}.` : ""}`;
}

/**
 * Extract key points from narrative
 */
function extractKeyPoints(narrative: string, project: DBProject): string[] {
	const points: string[] = [];

	// Add CPAR rating summary
	if (project.cparRatings) {
		const avg = (project.cparRatings.quality + project.cparRatings.schedule +
			project.cparRatings.cost + project.cparRatings.management) / 4;
		if (avg >= 4.5) points.push("Exceptional/Outstanding CPAR ratings");
		else if (avg >= 4) points.push("Very Good CPAR ratings");
		else if (avg >= 3) points.push("Satisfactory CPAR performance");
	}

	// Add quantified results
	const results = project.quantifiedResults ?? [];
	for (const r of results.slice(0, 2)) {
		points.push(`${r.metric}: ${r.value}`);
	}

	// Add key accomplishments
	const accomplishments = project.keyAccomplishments ?? [];
	for (const a of accomplishments.slice(0, 2)) {
		if (a.length < 60) points.push(a);
	}

	return points.slice(0, 4);
}

/**
 * Generate a brief description for a project (for matrices and summaries)
 */
export async function generateBriefDescription(
	projectId: string,
	maxWords: number = 100
): Promise<ActionResult<NarrativeResult>> {
	try {
		// Fetch project details
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		if (!project) {
			return { success: false, error: "Project not found" };
		}

		// Try AI generation first
		const prompt = `Generate a brief (${maxWords} words max) executive summary for this past performance project:

Project: ${project.name}
Customer: ${project.customerName} ${project.customerAgency ? `(${project.customerAgency})` : ""}
Contract Value: ${project.contractValue ? `$${(project.contractValue / 1000000).toFixed(1)}M` : "N/A"}
Description: ${project.description ?? "N/A"}
Key Accomplishments: ${(project.keyAccomplishments ?? []).join("; ")}
Quantified Results: ${(project.quantifiedResults ?? []).map(r => `${r.metric}: ${r.value}`).join("; ")}

Write a concise, impactful summary highlighting the most impressive metrics and outcomes. Use active voice.`;

		let narrative: string;

		try {
			const result = await complete(prompt, {
				maxTokens: 200,
				temperature: 0.5,
			});
			narrative = result.content;
		} catch (aiError) {
			// Fallback to template-based brief
			narrative = generateFallbackBriefDescription(project, maxWords);
		}

		// Update project with brief description
		await db
			.update(projects)
			.set({
				briefDescription: narrative,
				updatedAt: new Date(),
			})
			.where(eq(projects.id, projectId));

		const keyPoints = extractKeyPoints(narrative, project);
		const wordCount = narrative.split(/\s+/).length;

		return {
			success: true,
			data: {
				narrative,
				wordCount,
				keyPoints,
			},
		};
	} catch (error) {
		logger.error("Failed to generate brief description:", error);
		return { success: false, error: "Failed to generate brief description" };
	}
}

/**
 * Generate fallback brief description without AI
 */
function generateFallbackBriefDescription(project: DBProject, maxWords: number): string {
	const parts: string[] = [];

	// Add service description
	if (project.description) {
		const shortDesc = project.description.split(".")[0];
		parts.push(shortDesc.length < 100 ? shortDesc : shortDesc.substring(0, 100) + "...");
	}

	// Add customer info
	parts.push(`for ${project.customerName}${project.customerAgency ? ` (${project.customerAgency})` : ""}`);

	// Add key results
	const results = project.quantifiedResults ?? [];
	if (results.length > 0) {
		const topResults = results.slice(0, 2).map(r => `${r.metric}: ${r.value}`).join(", ");
		parts.push(`achieving ${topResults}`);
	}

	// Add CPAR summary
	if (project.cparRatings && project.cparRatings.overall >= 4) {
		parts.push("with Very Good/Exceptional CPAR ratings");
	}

	let narrative = parts.join(" ");

	// Trim to max words
	const words = narrative.split(/\s+/);
	if (words.length > maxWords) {
		narrative = words.slice(0, maxWords).join(" ") + "...";
	}

	return narrative;
}

/**
 * Generate a relevance narrative explaining why a project is relevant
 */
export async function generateRelevanceNarrative(
	projectId: string,
	opportunityId: string
): Promise<ActionResult<NarrativeResult>> {
	try {
		// Fetch project and opportunity details
		const [[project], [opportunity]] = await Promise.all([
			db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
			db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1),
		]);

		if (!project) return { success: false, error: "Project not found" };
		if (!opportunity) return { success: false, error: "Opportunity not found" };

		// Get relevance scores if available
		const [relevanceScore] = await db
			.select()
			.from(projectRelevanceScores)
			.where(
				and(
					eq(projectRelevanceScores.projectId, projectId),
					eq(projectRelevanceScores.opportunityId, opportunityId)
				)
			)
			.limit(1);

		// Build AI prompt
		const prompt = `Generate a compelling relevance narrative (150 words max) explaining why this past performance project is directly relevant to this opportunity.

PROJECT:
- Name: ${project.name}
- Customer: ${project.customerName} (${project.customerAgency ?? "N/A"})
- Contract Value: ${project.contractValue ? `$${(project.contractValue / 1000000).toFixed(1)}M` : "N/A"}
- Contract Type: ${project.contractType ?? "N/A"}
- Technical Areas: ${(project.technicalAreas ?? []).join(", ")}
- Key Accomplishments: ${(project.keyAccomplishments ?? []).slice(0, 3).join("; ")}

OPPORTUNITY:
- Title: ${opportunity.title}
- Organization: ${opportunity.organization ?? "N/A"}
- Sector: ${opportunity.sector ?? "N/A"}
- Budget: ${opportunity.budgetValue ?? "N/A"}
- Scope: ${(opportunity.projectScope ?? "").substring(0, 500)}

${relevanceScore ? `RELEVANCE SCORES: Overall ${relevanceScore.overallScore}%, Scope ${relevanceScore.scopeScore}%, Customer ${relevanceScore.customerScore}%` : ""}

Write a narrative that:
1. Establishes direct relevance between project scope and opportunity requirements
2. Highlights transferable experience and proven capabilities
3. Uses confident, persuasive language
4. Connects metrics and outcomes to opportunity needs`;

		let narrative: string;

		try {
			const result = await complete(prompt, {
				maxTokens: 300,
				temperature: 0.6,
			});
			narrative = result.content;
		} catch (aiError) {
			// Fallback to template-based narrative
			narrative = generateFallbackRelevanceNarrative(project, opportunity, relevanceScore);
		}

		// Store the narrative
		if (relevanceScore) {
			await db
				.update(projectRelevanceScores)
				.set({
					relevanceNarrative: narrative,
				})
				.where(eq(projectRelevanceScores.id, relevanceScore.id));
		}

		const keyPoints = [
			relevanceScore?.overallScore ? `${relevanceScore.overallScore}% overall relevance` : null,
			project.customerAgency === opportunity.organization ? "Same customer experience" : null,
			project.contractValue && opportunity.budgetNumeric
				? Math.abs(project.contractValue - opportunity.budgetNumeric) / opportunity.budgetNumeric < 0.5
					? "Similar contract size"
					: null
				: null,
			"Proven technical capabilities",
		].filter(Boolean) as string[];

		return {
			success: true,
			data: {
				narrative,
				wordCount: narrative.split(/\s+/).length,
				keyPoints,
			},
		};
	} catch (error) {
		logger.error("Failed to generate relevance narrative:", error);
		return { success: false, error: "Failed to generate relevance narrative" };
	}
}

/**
 * Generate fallback relevance narrative without AI
 */
function generateFallbackRelevanceNarrative(
	project: DBProject,
	opportunity: { title: string; organization?: string | null; projectScope?: string | null },
	relevanceScore?: { overallScore: number; scopeScore?: number | null; customerScore?: number | null } | null
): string {
	const parts: string[] = [];

	parts.push(`The ${project.name} project directly demonstrates our proven capability to execute ${opportunity.title}.`);

	if (project.customerAgency && opportunity.organization &&
		project.customerAgency.toLowerCase().includes(opportunity.organization.toLowerCase().substring(0, 3))) {
		parts.push(`Our experience with ${project.customerAgency} provides directly relevant customer environment familiarity.`);
	}

	if (relevanceScore && relevanceScore.overallScore >= 70) {
		parts.push(`With a ${relevanceScore.overallScore}% relevance score, this project demonstrates strong alignment with the opportunity requirements.`);
	}

	if ((project.keyAccomplishments ?? []).length > 0) {
		parts.push(`Key accomplishments including ${(project.keyAccomplishments ?? []).slice(0, 2).join(" and ")} transfer directly to this effort.`);
	}

	return parts.join(" ");
}

// ============================================================================
// Reference Management Actions
// ============================================================================

/**
 * Check reference availability for a project
 */
export async function checkReferenceAvailability(
	projectId: string
): Promise<ActionResult<{ status: string; lastChecked: string; notes?: string }>> {
	try {
		// Fetch project with reference info
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		if (!project) {
			return { success: false, error: "Project not found" };
		}

		// Update last reference check timestamp
		await db
			.update(projects)
			.set({
				lastReferenceCheck: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(projects.id, projectId));

		return {
			success: true,
			data: {
				status: project.referenceStatus ?? "available",
				lastChecked: new Date().toISOString(),
				notes: project.referenceNotes ?? `POC: ${project.customerPOC ?? "Contact information on file"}`,
			},
		};
	} catch (error) {
		logger.error("Failed to check reference availability:", error);
		return { success: false, error: "Failed to check reference availability" };
	}
}

// ============================================================================
// Import/Export Actions
// ============================================================================

/**
 * Import project data from CPARS or external source
 */
export async function importProjectFromCPARS(
	cparData: {
		contractNumber: string;
		evaluationPeriod: { start: string; end: string };
		ratings: Record<string, number>;
		narratives: Record<string, string>;
		customerName?: string;
		customerAgency?: string;
		projectName?: string;
		contractValue?: number;
		description?: string;
	}
): Promise<ActionResult<Project>> {
	try {
		// Map CPAR ratings to our standard format
		const cparRatings = {
			quality: cparData.ratings.quality ?? cparData.ratings.technicalQuality ?? 3,
			schedule: cparData.ratings.schedule ?? cparData.ratings.timeliness ?? 3,
			cost: cparData.ratings.cost ?? cparData.ratings.costControl ?? 3,
			management: cparData.ratings.management ?? cparData.ratings.programManagement ?? 3,
			smallBusiness: cparData.ratings.smallBusiness,
			overall: cparData.ratings.overall ??
				(cparData.ratings.quality + cparData.ratings.schedule + cparData.ratings.cost + cparData.ratings.management) / 4,
			narratives: {
				quality: cparData.narratives.quality ?? cparData.narratives.technicalQuality,
				schedule: cparData.narratives.schedule ?? cparData.narratives.timeliness,
				cost: cparData.narratives.cost ?? cparData.narratives.costControl,
				management: cparData.narratives.management ?? cparData.narratives.programManagement,
			},
		};

		// Create the project with CPAR data
		const [newProject] = await db
			.insert(projects)
			.values({
				name: cparData.projectName ?? `Project ${cparData.contractNumber}`,
				contractNumber: cparData.contractNumber,
				customerName: cparData.customerName ?? "Customer (from CPAR)",
				customerAgency: cparData.customerAgency,
				contractValue: cparData.contractValue,
				periodOfPerformance: {
					start: cparData.evaluationPeriod.start,
					end: cparData.evaluationPeriod.end,
				},
				description: cparData.description,
				cparRatings,
				cparNarrative: Object.values(cparData.narratives).filter(Boolean).join("\n\n"),
				isActive: true,
				referenceStatus: "available",
			})
			.returning();

		if (!newProject) {
			return { success: false, error: "Failed to create project from CPAR data" };
		}

		revalidatePath("/past-performance");
		return { success: true, data: mapDBProjectToProject(newProject) };
	} catch (error) {
		logger.error("Failed to import from CPARS:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to import from CPARS" };
	}
}

/**
 * Export past performance volume for an opportunity
 */
export async function exportPastPerformanceVolume(
	opportunityId: string,
	format: "docx" | "pdf"
): Promise<ActionResult<{ downloadUrl: string; volumeData: PastPerformanceVolumeData }>> {
	try {
		// Fetch opportunity details
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, opportunityId))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		// Fetch selected past performance projects with relevance scores
		const relevanceScores = await db
			.select({
				score: projectRelevanceScores,
				project: projects,
			})
			.from(projectRelevanceScores)
			.innerJoin(projects, eq(projectRelevanceScores.projectId, projects.id))
			.where(
				and(
					eq(projectRelevanceScores.opportunityId, opportunityId),
					eq(projectRelevanceScores.isSelected, true)
				)
			)
			.orderBy(asc(projectRelevanceScores.selectionRank));

		if (relevanceScores.length === 0) {
			return { success: false, error: "No past performance projects selected for this opportunity" };
		}

		// Build volume data structure
		const volumeData: PastPerformanceVolumeData = {
			opportunityTitle: opportunity.title,
			opportunityNumber: opportunity.sourceId ?? "",
			generatedAt: new Date().toISOString(),
			projects: relevanceScores.map(({ score, project }, index) => ({
				rank: index + 1,
				projectName: project.name,
				contractNumber: project.contractNumber ?? "",
				customerName: project.customerName,
				customerAgency: project.customerAgency ?? "",
				contractValue: project.contractValue ?? 0,
				periodOfPerformance: project.periodOfPerformance ?? { start: "", end: "" },
				description: project.description ?? "",
				scopeSummary: project.scopeSummary ?? "",
				technicalAreas: project.technicalAreas ?? [],
				cparRatings: project.cparRatings ?? {
					quality: 0, schedule: 0, cost: 0, management: 0, overall: 0
				},
				keyAccomplishments: project.keyAccomplishments ?? [],
				quantifiedResults: project.quantifiedResults ?? [],
				relevanceScore: score.overallScore,
				relevanceNarrative: score.relevanceNarrative ?? "",
				strengthsNarrative: score.strengthsNarrative ?? "",
				matchingRequirements: score.matchingRequirements ?? [],
				customerPOC: {
					name: project.customerPOC ?? "",
					email: project.customerPOCEmail ?? "",
					phone: project.customerPOCPhone ?? "",
				},
				referenceStatus: project.referenceStatus ?? "available",
			})),
		};

		// Generate unique filename
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = `past-performance-${opportunity.sourceId ?? opportunityId}-${timestamp}.${format}`;

		// Store volume data for document generation service
		// In production, this would trigger async document generation
		// For now, return the structured data that can be used by document templates
		const downloadUrl = `/api/documents/generate?type=past-performance&opportunityId=${opportunityId}&format=${format}&filename=${encodeURIComponent(filename)}`;

		return {
			success: true,
			data: {
				downloadUrl,
				volumeData,
			},
		};
	} catch (error) {
		logger.error("Failed to export past performance volume:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to export past performance volume" };
	}
}

// Type for volume export data
interface PastPerformanceVolumeData {
	opportunityTitle: string;
	opportunityNumber: string;
	generatedAt: string;
	projects: {
		rank: number;
		projectName: string;
		contractNumber: string;
		customerName: string;
		customerAgency: string;
		contractValue: number;
		periodOfPerformance: { start: string; end: string };
		description: string;
		scopeSummary: string;
		technicalAreas: string[];
		cparRatings: {
			quality: number;
			schedule: number;
			cost: number;
			management: number;
			overall: number;
		};
		keyAccomplishments: string[];
		quantifiedResults: { metric: string; value: string; context: string }[];
		relevanceScore: number;
		relevanceNarrative: string;
		strengthsNarrative: string;
		matchingRequirements: { requirementId: string; requirementText: string; matchStrength: number }[];
		customerPOC: {
			name: string;
			email: string;
			phone: string;
		};
		referenceStatus: string;
	}[];
}

// ============================================================================
// Analytics Actions
// ============================================================================

/**
 * Get past performance analytics
 */
export async function getPastPerformanceAnalytics(): Promise<ActionResult<{
	totalProjects: number;
	averageCPAR: number;
	projectsByAgency: Record<string, number>;
	projectsByType: Record<string, number>;
	totalContractValue: number;
	winRateWithPastPerf: number;
}>> {
	try {
		// Fetch all active projects
		const allProjects = await db
			.select()
			.from(projects)
			.where(eq(projects.isActive, true));

		// Calculate total projects
		const totalProjects = allProjects.length;

		// Calculate average CPAR
		const projectsWithCPAR = allProjects.filter(p => p.cparRatings?.overall);
		const averageCPAR = projectsWithCPAR.length > 0
			? projectsWithCPAR.reduce((sum, p) => sum + (p.cparRatings?.overall ?? 0), 0) / projectsWithCPAR.length
			: 0;

		// Group by agency
		const projectsByAgency: Record<string, number> = {};
		for (const project of allProjects) {
			const agency = project.customerAgency ?? "Other";
			// Normalize agency names
			const normalizedAgency = normalizeAgencyName(agency);
			projectsByAgency[normalizedAgency] = (projectsByAgency[normalizedAgency] ?? 0) + 1;
		}

		// Group by contract type
		const projectsByType: Record<string, number> = {};
		for (const project of allProjects) {
			const type = project.contractType ?? "Other";
			projectsByType[type] = (projectsByType[type] ?? 0) + 1;
		}

		// Calculate total contract value
		const totalContractValue = allProjects.reduce(
			(sum, p) => sum + (p.contractValue ?? 0),
			0
		);

		// Calculate win rate (based on submissions with past performance cited)
		// For now, estimate based on CPAR ratings - projects with high ratings have higher win correlation
		const highRatedProjects = projectsWithCPAR.filter(p => (p.cparRatings?.overall ?? 0) >= 4);
		const winRateWithPastPerf = projectsWithCPAR.length > 0
			? highRatedProjects.length / projectsWithCPAR.length
			: 0;

		return {
			success: true,
			data: {
				totalProjects,
				averageCPAR: Math.round(averageCPAR * 10) / 10,
				projectsByAgency,
				projectsByType,
				totalContractValue,
				winRateWithPastPerf: Math.round(winRateWithPastPerf * 100) / 100,
			},
		};
	} catch (error) {
		logger.error("Failed to get analytics:", error);
		return { success: false, error: "Failed to get analytics" };
	}
}

/**
 * Normalize agency/organization names for grouping
 * Uses categorization focused on international development and global south contexts
 */
function normalizeAgencyName(agency: string): string {
	const lower = agency.toLowerCase();

	// United Nations System
	if (lower.includes("united nations") || lower.includes("un ") || lower.includes(" un") ||
		lower.includes("undp") || lower.includes("unicef") || lower.includes("wfp") ||
		lower.includes("who") || lower.includes("fao") || lower.includes("unesco") ||
		lower.includes("unido") || lower.includes("unfpa") || lower.includes("unhcr") ||
		lower.includes("unep") || lower.includes("unodc") || lower.includes("ocha") ||
		lower.includes("un-habitat") || lower.includes("unops") || lower.includes("unctad")) {
		return "UN System";
	}

	// World Bank Group
	if (lower.includes("world bank") || lower.includes("ibrd") || lower.includes("ida") ||
		lower.includes("ifc") || lower.includes("miga") || lower.includes("icsid")) {
		return "World Bank Group";
	}

	// African Development Bank Group
	if (lower.includes("african development bank") || lower.includes("afdb") ||
		lower.includes("adf") || lower.includes("africa development")) {
		return "AfDB Group";
	}

	// African Union and Regional Economic Communities
	if (lower.includes("african union") || lower.includes("au ") || lower.includes(" au") ||
		lower.includes("ecowas") || lower.includes("sadc") || lower.includes("eac") ||
		lower.includes("comesa") || lower.includes("igad") || lower.includes("eccas") ||
		lower.includes("uma") || lower.includes("cen-sad") || lower.includes("nepad") ||
		lower.includes("auda") || lower.includes("africa cdc")) {
		return "African Union/RECs";
	}

	// International Development Finance
	if (lower.includes("asian development") || lower.includes("adb") ||
		lower.includes("inter-american") || lower.includes("iadb") || lower.includes("idb") ||
		lower.includes("ebrd") || lower.includes("aiib") || lower.includes("dfc") ||
		lower.includes("development finance") || lower.includes("opic")) {
		return "Development Finance";
	}

	// UK Development (FCDO/DFID)
	if (lower.includes("fcdo") || lower.includes("dfid") || lower.includes("foreign") &&
		lower.includes("commonwealth") || lower.includes("british") || lower.includes("uk aid")) {
		return "UK FCDO";
	}

	// German Development (GIZ/KfW/BMZ)
	if (lower.includes("giz") || lower.includes("kfw") || lower.includes("bmz") ||
		lower.includes("german") && (lower.includes("development") || lower.includes("cooperation"))) {
		return "German Dev Cooperation";
	}

	// EU Development
	if (lower.includes("european union") || lower.includes("eu ") || lower.includes(" eu") ||
		lower.includes("european commission") || lower.includes("europeaid") ||
		lower.includes("edf") || lower.includes("dg devco") || lower.includes("dg intpa") ||
		lower.includes("team europe")) {
		return "European Union";
	}

	// Japanese Development (JICA)
	if (lower.includes("jica") || lower.includes("japan") &&
		(lower.includes("development") || lower.includes("cooperation") || lower.includes("aid"))) {
		return "Japan JICA";
	}

	// Other Bilateral Donors
	if (lower.includes("usaid") || lower.includes("mcc") || lower.includes("millennium challenge") ||
		lower.includes("sida") || lower.includes("norad") || lower.includes("danida") ||
		lower.includes("cida") || lower.includes("global affairs canada") ||
		lower.includes("ausaid") || lower.includes("dfat") || lower.includes("nzaid") ||
		lower.includes("swiss") && lower.includes("development") || lower.includes("sdc")) {
		return "Bilateral Donors";
	}

	// Global Health Initiatives
	if (lower.includes("global fund") || lower.includes("gfatm") || lower.includes("gavi") ||
		lower.includes("pepfar") || lower.includes("pmi") || lower.includes("cepi") ||
		lower.includes("unitaid") || lower.includes("global health")) {
		return "Global Health";
	}

	// Private Foundations
	if (lower.includes("gates foundation") || lower.includes("bmgf") ||
		lower.includes("rockefeller") || lower.includes("ford foundation") ||
		lower.includes("mastercard foundation") || lower.includes("open society") ||
		lower.includes("aga khan") || lower.includes("hewlett") || lower.includes("packard")) {
		return "Private Foundations";
	}

	// International NGOs
	if (lower.includes("mercy corps") || lower.includes("care international") ||
		lower.includes("world vision") || lower.includes("save the children") ||
		lower.includes("oxfam") || lower.includes("plan international") ||
		lower.includes("pathfinder") || lower.includes("fhi 360") || lower.includes("psi") ||
		lower.includes("jhpiego") || lower.includes("msh") || lower.includes("chemonics") ||
		lower.includes("dai") || lower.includes("rti international") || lower.includes("abt") ||
		lower.includes("palladium") || lower.includes("tetra tech")) {
		return "International NGOs";
	}

	// African Governments/Ministries
	if (lower.includes("ministry") || lower.includes("government of") ||
		lower.includes("federal") && lower.includes("republic") ||
		lower.includes("national") && (lower.includes("agency") || lower.includes("commission"))) {
		return "Government/Public Sector";
	}

	// Health Sector
	if (lower.includes("health") || lower.includes("medical") || lower.includes("hospital") ||
		lower.includes("clinic") || lower.includes("pharmaceutical")) {
		return "Health Sector";
	}

	// Education Sector
	if (lower.includes("education") || lower.includes("university") || lower.includes("school") ||
		lower.includes("academic") || lower.includes("research institute")) {
		return "Education/Research";
	}

	// Agriculture & Food Security
	if (lower.includes("agriculture") || lower.includes("food") || lower.includes("farming") ||
		lower.includes("agri") || lower.includes("livestock") || lower.includes("fisheries") ||
		lower.includes("cgiar") || lower.includes("ifpri") || lower.includes("cimmyt")) {
		return "Agriculture/Food Security";
	}

	// Infrastructure & Energy
	if (lower.includes("energy") || lower.includes("power") || lower.includes("infrastructure") ||
		lower.includes("roads") || lower.includes("transport") || lower.includes("water") ||
		lower.includes("sanitation") || lower.includes("electricity")) {
		return "Infrastructure/Energy";
	}

	// Financial Services
	if (lower.includes("bank") || lower.includes("finance") || lower.includes("microfinance") ||
		lower.includes("insurance") || lower.includes("investment")) {
		return "Financial Services";
	}

	// Private/Commercial Sector
	if (lower.includes("commercial") || lower.includes("private") || lower.includes("corporate") ||
		lower.includes("company") || lower.includes("ltd") || lower.includes("plc")) {
		return "Private Sector";
	}

	return agency.length > 25 ? agency.substring(0, 25) + "..." : agency;
}

/**
 * Analyze gaps between project portfolio and target opportunity
 */
export async function analyzePortfolioGaps(
	opportunityId: string
): Promise<ActionResult<GapAnalysis>> {
	try {
		// Fetch opportunity details and requirements
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, opportunityId))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		const oppRequirements = await db
			.select()
			.from(rfpRequirements)
			.where(eq(rfpRequirements.opportunityId, opportunityId));

		// Fetch all active projects
		const allProjects = await db
			.select()
			.from(projects)
			.where(eq(projects.isActive, true));

		// Aggregate all project capabilities
		const portfolioCapabilities = new Set<string>();
		const portfolioAgencies = new Set<string>();
		let hasHighCPAR = false;
		let totalValue = 0;

		for (const project of allProjects) {
			for (const area of project.technicalAreas ?? []) {
				portfolioCapabilities.add(area.toLowerCase());
			}
			if (project.customerAgency) {
				portfolioAgencies.add(project.customerAgency.toLowerCase());
			}
			if (project.cparRatings && project.cparRatings.overall >= 4) {
				hasHighCPAR = true;
			}
			totalValue += project.contractValue ?? 0;
		}

		// Identify gaps
		const gaps: GapAnalysis["gaps"] = [];
		const strengths: string[] = [];
		const recommendations: string[] = [];

		// Check requirement coverage
		for (const req of oppRequirements) {
			const reqText = req.requirementText.toLowerCase();
			const reqWords = reqText.split(/\W+/).filter((w: string) => w.length > 4);

			const isCovered = reqWords.some((word: string) =>
				Array.from(portfolioCapabilities).some(cap => cap.includes(word))
			);

			if (!isCovered && req.priority === "mandatory") {
				gaps.push({
					area: req.category ?? "Technical Requirements",
					severity: "critical",
					description: `No direct experience with: ${req.requirementText.substring(0, 100)}...`,
					suggestedMitigation: `Highlight transferable experience or consider teaming partner with ${req.category ?? "this capability"}`,
				});
			} else if (!isCovered) {
				gaps.push({
					area: req.category ?? "Technical Requirements",
					severity: "moderate",
					description: `Limited experience with: ${req.requirementText.substring(0, 80)}...`,
					suggestedMitigation: "Emphasize methodology and learning agility",
				});
			}
		}

		// Check customer experience
		const oppOrg = opportunity.organization?.toLowerCase() ?? "";
		if (oppOrg && !Array.from(portfolioAgencies).some(a => a.includes(oppOrg.substring(0, 3)))) {
			gaps.push({
				area: "Customer Experience",
				severity: "moderate",
				description: `No direct experience with ${opportunity.organization}`,
				suggestedMitigation: "Highlight experience with similar agencies or mission areas",
			});
		}

		// Check contract size
		if (opportunity.budgetNumeric && totalValue < opportunity.budgetNumeric * 0.5) {
			gaps.push({
				area: "Contract Size",
				severity: "minor",
				description: "Portfolio average contract value is smaller than target opportunity",
				suggestedMitigation: "Emphasize growth trajectory and scalability of operations",
			});
		}

		// Identify strengths
		if (hasHighCPAR) {
			strengths.push("Excellent CPAR ratings (4.0+ average)");
		}
		if (allProjects.length >= 5) {
			strengths.push(`Strong portfolio with ${allProjects.length} relevant projects`);
		}
		if (portfolioCapabilities.size >= 10) {
			strengths.push("Diverse technical capabilities");
		}
		if (Array.from(portfolioAgencies).some(a => oppOrg && a.includes(oppOrg.substring(0, 3)))) {
			strengths.push("Direct customer agency experience");
		}

		// Generate recommendations
		if (gaps.some(g => g.severity === "critical")) {
			recommendations.push("Consider teaming with a partner to address critical capability gaps");
		}
		if (gaps.some(g => g.area === "Customer Experience")) {
			recommendations.push("Emphasize transferable experience from similar mission areas");
		}
		if (gaps.length === 0) {
			recommendations.push("Strong portfolio alignment - focus on differentiating win themes");
		} else {
			recommendations.push("Develop mitigation narratives for each identified gap");
		}

		// Deduplicate gaps by area
		const uniqueGaps = gaps.reduce((acc, gap) => {
			const existing = acc.find(g => g.area === gap.area);
			if (!existing || (gap.severity === "critical" && existing.severity !== "critical")) {
				return acc.filter(g => g.area !== gap.area).concat(gap);
			}
			return acc;
		}, [] as typeof gaps);

		return {
			success: true,
			data: {
				gaps: uniqueGaps.slice(0, 5),
				strengths: strengths.slice(0, 5),
				recommendations: recommendations.slice(0, 3),
			},
		};
	} catch (error) {
		logger.error("Failed to analyze portfolio gaps:", error);
		return { success: false, error: "Failed to analyze portfolio gaps" };
	}
}
