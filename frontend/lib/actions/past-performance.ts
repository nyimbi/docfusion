/**
 * Past Performance Server Actions
 *
 * Server actions for managing past performance projects,
 * calculating relevance scores, and generating narratives.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

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
	matchingRequirements: { requirementId: string; requirementText: string; matchStrength: number }[];
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

		// TODO: Replace with actual database insert
		const newProject: Project = {
			id: crypto.randomUUID(),
			name: validatedInput.name,
			contractNumber: validatedInput.contractNumber,
			customerName: validatedInput.customerName,
			customerAgency: validatedInput.customerAgency,
			contractType: validatedInput.contractType,
			contractValue: validatedInput.contractValue,
			periodOfPerformance: validatedInput.periodOfPerformance,
			description: validatedInput.description,
			technicalAreas: validatedInput.technicalAreas,
			cparRatings: validatedInput.cparRatings,
			keyAccomplishments: validatedInput.keyAccomplishments,
			quantifiedResults: validatedInput.quantifiedResults,
			isActive: true,
			referenceStatus: validatedInput.referenceStatus ?? "available",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		revalidatePath("/past-performance");

		return { success: true, data: newProject };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		return { success: false, error: "Failed to create project" };
	}
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

		// TODO: Replace with actual database update
		const updatedProject: Project = {
			id,
			name: validatedInput.name ?? "Updated Project",
			customerName: validatedInput.customerName ?? "Customer",
			contractNumber: validatedInput.contractNumber,
			customerAgency: validatedInput.customerAgency,
			contractType: validatedInput.contractType,
			contractValue: validatedInput.contractValue,
			periodOfPerformance: validatedInput.periodOfPerformance,
			description: validatedInput.description,
			technicalAreas: validatedInput.technicalAreas,
			cparRatings: validatedInput.cparRatings,
			keyAccomplishments: validatedInput.keyAccomplishments,
			quantifiedResults: validatedInput.quantifiedResults,
			isActive: true,
			referenceStatus: validatedInput.referenceStatus ?? "available",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		revalidatePath("/past-performance");
		revalidatePath(`/past-performance/${id}`);

		return { success: true, data: updatedProject };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		return { success: false, error: "Failed to update project" };
	}
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<ActionResult<void>> {
	try {
		// TODO: Replace with actual database delete

		revalidatePath("/past-performance");

		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to delete project" };
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

		// TODO: Replace with actual database query
		const mockProjects: Project[] = [
			{
				id: "1",
				name: "Enterprise Cloud Migration",
				customerName: "Department of Defense",
				customerAgency: "Defense Information Systems Agency",
				contractNumber: "GS-35F-0001X",
				contractType: "FFP",
				contractValue: 15000000,
				periodOfPerformance: { start: "2023-01-01", end: "2025-12-31" },
				description: "Large-scale cloud migration supporting critical DoD systems",
				technicalAreas: ["Cloud Computing", "Security", "DevOps"],
				cparRatings: { quality: 5, schedule: 4, cost: 5, management: 5, overall: 5 },
				keyAccomplishments: [
					"Migrated 500+ applications to cloud",
					"Achieved FedRAMP High authorization",
					"Reduced infrastructure costs by 40%",
				],
				quantifiedResults: [
					{ metric: "Applications Migrated", value: "500+", context: "Within 18 months" },
					{ metric: "Cost Reduction", value: "40%", context: "Annual infrastructure costs" },
				],
				isActive: true,
				referenceStatus: "available",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		];

		return {
			success: true,
			data: {
				projects: mockProjects,
				total: mockProjects.length,
			},
		};
	} catch (error) {
		return { success: false, error: "Failed to search projects" };
	}
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<ActionResult<Project>> {
	try {
		// TODO: Replace with actual database query

		return { success: false, error: "Project not found" };
	} catch (error) {
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
		// TODO: Implement actual relevance calculation using:
		// 1. Semantic similarity between project scope and opportunity requirements
		// 2. Customer/agency matching
		// 3. Contract size similarity
		// 4. Recency weighting
		// 5. Technical area overlap

		const mockScores: RelevanceScore[] = [
			{
				projectId: "1",
				projectName: "Enterprise Cloud Migration",
				overallScore: 92,
				recencyScore: 95,
				sizeScore: 88,
				scopeScore: 94,
				customerScore: 90,
				matchingRequirements: [
					{
						requirementId: "req-1",
						requirementText: "Cloud migration experience",
						matchStrength: 0.95,
					},
					{
						requirementId: "req-2",
						requirementText: "FedRAMP authorization",
						matchStrength: 0.98,
					},
				],
				gaps: [],
				relevanceNarrative: "This project demonstrates exceptional relevance to the opportunity...",
			},
		];

		return { success: true, data: mockScores };
	} catch (error) {
		return { success: false, error: "Failed to calculate relevance scores" };
	}
}

/**
 * Generate a relevance matrix comparing multiple projects against an opportunity
 */
export async function generateRelevanceMatrix(
	input: z.infer<typeof RelevanceMatrixInput>
): Promise<ActionResult<RelevanceMatrix>> {
	try {
		const validatedInput = RelevanceMatrixInput.parse(input);

		// TODO: Implement actual matrix generation with AI analysis

		const mockMatrix: RelevanceMatrix = {
			opportunityId: validatedInput.opportunityId,
			opportunityTitle: "Cloud Modernization Initiative",
			projects: [],
			recommendedOrder: validatedInput.projectIds,
			coverageAnalysis: {
				totalRequirements: 25,
				coveredRequirements: 23,
				coveragePercentage: 92,
				uncoveredAreas: ["Specific legacy system experience"],
			},
		};

		return { success: true, data: mockMatrix };
	} catch (error) {
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
		// TODO: Implement AI-powered narrative generation

		const mockNarrative: NarrativeResult = {
			narrative: `The contractor demonstrated exceptional performance throughout the period of performance...

QUALITY: The contractor consistently delivered high-quality work products that exceeded government expectations. All deliverables were submitted on time and required minimal revisions.

SCHEDULE: The contractor maintained an exemplary schedule adherence rate of 98%, proactively identifying potential delays and implementing mitigation strategies.

COST: The contractor demonstrated excellent cost control, completing the effort under budget while delivering additional value through process improvements.

MANAGEMENT: The contractor's project management approach was highly effective, with clear communication, responsive issue resolution, and proactive risk management.`,
			wordCount: 98,
			keyPoints: [
				"Exceptional quality with minimal revisions",
				"98% schedule adherence",
				"Under budget completion",
				"Proactive risk management",
			],
		};

		return { success: true, data: mockNarrative };
	} catch (error) {
		return { success: false, error: "Failed to generate CPAR narrative" };
	}
}

/**
 * Generate a brief description for a project (for matrices and summaries)
 */
export async function generateBriefDescription(
	projectId: string,
	maxWords: number = 100
): Promise<ActionResult<NarrativeResult>> {
	try {
		// TODO: Implement AI-powered brief generation

		const mockBrief: NarrativeResult = {
			narrative: `Provided enterprise cloud migration services for DISA, successfully migrating 500+ applications to a FedRAMP High cloud environment. Achieved 40% infrastructure cost reduction while maintaining 99.9% system availability. Earned Exceptional CPAR ratings across all evaluation areas.`,
			wordCount: 42,
			keyPoints: [
				"500+ applications migrated",
				"FedRAMP High",
				"40% cost reduction",
				"Exceptional CPARs",
			],
		};

		return { success: true, data: mockBrief };
	} catch (error) {
		return { success: false, error: "Failed to generate brief description" };
	}
}

/**
 * Generate a relevance narrative explaining why a project is relevant
 */
export async function generateRelevanceNarrative(
	projectId: string,
	opportunityId: string
): Promise<ActionResult<NarrativeResult>> {
	try {
		// TODO: Implement AI-powered relevance narrative generation

		const mockNarrative: NarrativeResult = {
			narrative: `This project directly demonstrates our proven capability to execute the requirements outlined in this opportunity. Our experience with DISA's enterprise cloud migration provides directly relevant and recent experience with similar scope, complexity, and customer environment...`,
			wordCount: 45,
			keyPoints: [
				"Direct scope alignment",
				"Same customer agency",
				"Similar contract value",
				"Recent performance",
			],
		};

		return { success: true, data: mockNarrative };
	} catch (error) {
		return { success: false, error: "Failed to generate relevance narrative" };
	}
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
		// TODO: Implement actual reference check (could trigger email to POC)

		return {
			success: true,
			data: {
				status: "available",
				lastChecked: new Date().toISOString(),
				notes: "POC confirmed availability for reference calls",
			},
		};
	} catch (error) {
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
	}
): Promise<ActionResult<Project>> {
	try {
		// TODO: Implement CPARS data import and project creation

		return { success: false, error: "CPARS import not yet implemented" };
	} catch (error) {
		return { success: false, error: "Failed to import from CPARS" };
	}
}

/**
 * Export past performance volume for an opportunity
 */
export async function exportPastPerformanceVolume(
	opportunityId: string,
	format: "docx" | "pdf"
): Promise<ActionResult<{ downloadUrl: string }>> {
	try {
		// TODO: Implement volume generation and export

		return { success: false, error: "Volume export not yet implemented" };
	} catch (error) {
		return { success: false, error: "Failed to export past performance volume" };
	}
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
		// TODO: Implement analytics calculation

		return {
			success: true,
			data: {
				totalProjects: 45,
				averageCPAR: 4.2,
				projectsByAgency: {
					DoD: 18,
					DHS: 12,
					VA: 8,
					Other: 7,
				},
				projectsByType: {
					FFP: 20,
					"T&M": 15,
					CPFF: 10,
				},
				totalContractValue: 250000000,
				winRateWithPastPerf: 0.68,
			},
		};
	} catch (error) {
		return { success: false, error: "Failed to get analytics" };
	}
}

/**
 * Analyze gaps between project portfolio and target opportunity
 */
export async function analyzePortfolioGaps(
	opportunityId: string
): Promise<ActionResult<GapAnalysis>> {
	try {
		// TODO: Implement AI-powered gap analysis

		const mockAnalysis: GapAnalysis = {
			gaps: [
				{
					area: "Specific Legacy System Experience",
					severity: "moderate",
					description: "Limited direct experience with the specific legacy systems mentioned",
					suggestedMitigation: "Highlight transferable experience from similar legacy modernization projects",
				},
			],
			strengths: [
				"Strong cloud migration experience",
				"Excellent CPAR ratings",
				"Same customer agency experience",
			],
			recommendations: [
				"Consider teaming with a partner that has specific legacy system experience",
				"Emphasize our methodology for quickly learning new systems",
			],
		};

		return { success: true, data: mockAnalysis };
	} catch (error) {
		return { success: false, error: "Failed to analyze portfolio gaps" };
	}
}
