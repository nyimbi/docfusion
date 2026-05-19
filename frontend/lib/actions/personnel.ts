/**
 * Personnel Server Actions
 *
 * Server-side actions for managing personnel records, resumes,
 * skills matching, and position assignments.
 *
 * Implements full CRUD operations with PostgreSQL database
 * and AI-powered matching/generation features.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	personnel,
	personnelExperience,
	personnelAvailability,
	positionRequirements,
	skillsTaxonomy,
	resumeTemplates,
	type Personnel as DBPersonnel,
	type NewPersonnel,
	type PersonnelExperience as DBPersonnelExperience,
	type NewPersonnelExperience,
	type PersonnelAvailability as DBPersonnelAvailability,
	type PositionRequirement as DBPositionRequirement,
	type NewPositionRequirement,
} from "@/lib/db/schema-personnel";
import { eq, and, or, ilike, gte, lte, desc, asc, sql, inArray, ne, isNull, isNotNull, type SQL } from "drizzle-orm";
import { complete } from "@/lib/ai/client";
import { getCurrentUserId } from "@/lib/auth-utils";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Types
// ============================================================================

interface PersonnelFilters {
	search?: string;
	department?: string;
	employmentType?: string;
	clearanceLevel?: string;
	availability?: string;
	skills?: string[];
	minExperience?: number;
	hasCertification?: string;
	isActive?: boolean;
	limit?: number;
	offset?: number;
}

interface PersonnelMatch {
	personnelId: string;
	personnelName: string;
	matchScore: number;
	matchDetails: {
		skillsMatch: number;
		experienceMatch: number;
		educationMatch: number;
		clearanceMatch: number;
		certificationMatch: number;
		availabilityMatch: number;
		gaps: string[];
	};
	availability: string;
}

interface GapAnalysis {
	opportunityId: string;
	totalPositions: number;
	filledPositions: number;
	openPositions: number;
	gaps: {
		positionId: string;
		positionTitle: string;
		missingRequirements: string[];
		suggestedActions: string[];
		urgency: "critical" | "high" | "medium" | "low";
	}[];
	recommendations: string[];
}

interface ParsedResume {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	currentTitle?: string;
	professionalSummary?: string;
	education: Array<{
		degree: string;
		field: string;
		institution: string;
		year: number;
	}>;
	experience: Array<{
		title: string;
		company: string;
		startDate: string;
		endDate?: string;
		description: string;
		accomplishments: string[];
	}>;
	skills: Array<{
		skillName: string;
		proficiency: string;
		yearsExperience?: number;
	}>;
	certifications: Array<{
		name: string;
		issuer: string;
		dateObtained?: string;
	}>;
	clearance?: {
		level: string;
		status: string;
	};
}

interface DateRange {
	start: Date;
	end: Date;
}

interface OrgChartData {
	nodes: Array<{
		id: string;
		personnelId?: string;
		name: string;
		title: string;
		level: number;
		parentId?: string;
	}>;
	edges: Array<{
		from: string;
		to: string;
	}>;
}

interface StaffingMatrix {
	positions: Array<{
		id: string;
		title: string;
		laborCategory: string;
		headcount: number;
		assigned: Array<{
			personnelId: string;
			name: string;
			matchScore: number;
		}>;
		status: string;
	}>;
	summary: {
		totalPositions: number;
		totalHeadcount: number;
		assignedCount: number;
		openCount: number;
		fillRate: number;
	};
}

interface ActionResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const PersonnelSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	email: z.string().email().optional().nullable(),
	phone: z.string().optional().nullable(),
	employmentType: z.string().optional().nullable(),
	startDate: z.string().optional().nullable(),
	endDate: z.string().optional().nullable(),
	department: z.string().optional().nullable(),
	currentTitle: z.string().optional().nullable(),
	location: z.string().optional().nullable(),
	clearanceLevel: z.string().optional().nullable(),
	clearanceStatus: z.string().optional().nullable(),
	clearanceExpiration: z.string().optional().nullable(),
	clearanceInvestigationType: z.string().optional().nullable(),
	clearancePolygraph: z.boolean().optional(),
	availability: z.string().optional().nullable(),
	availableDate: z.string().optional().nullable(),
	maxCommitment: z.number().int().min(0).max(100).optional(),
	professionalSummary: z.string().optional().nullable(),
	yearsOfExperience: z.number().int().min(0).optional().nullable(),
	resumeFull: z.string().optional().nullable(),
	resumeBrief: z.string().optional().nullable(),
	resumeFederal: z.string().optional().nullable(),
	linkedInUrl: z.string().url().optional().nullable(),
	education: z.array(z.object({
		degree: z.string(),
		field: z.string(),
		institution: z.string(),
		year: z.number(),
		gpa: z.number().optional(),
		honors: z.string().optional(),
	})).optional(),
	certifications: z.array(z.object({
		name: z.string(),
		issuer: z.string(),
		dateObtained: z.string(),
		expirationDate: z.string().optional(),
		certificationNumber: z.string().optional(),
		status: z.enum(["active", "expired", "pending"]),
	})).optional(),
	skills: z.array(z.object({
		skillId: z.string(),
		skillName: z.string(),
		proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
		yearsExperience: z.number(),
		lastUsed: z.string().optional(),
	})).optional(),
	languages: z.array(z.object({
		language: z.string(),
		proficiency: z.enum(["basic", "conversational", "professional", "native"]),
	})).optional(),
	keyAchievements: z.array(z.string()).optional(),
	laborCategories: z.array(z.object({
		contractVehicle: z.string(),
		laborCategory: z.string(),
		rate: z.number().optional(),
	})).optional(),
	isActive: z.boolean().optional(),
});

const PositionSchema = z.object({
	opportunityId: z.string().uuid().optional(),
	positionTitle: z.string().min(1, "Position title is required"),
	positionCategory: z.string().optional().nullable(),
	laborCategory: z.string().optional().nullable(),
	positionNumber: z.string().optional().nullable(),
	headcount: z.number().int().positive().default(1),
	requiredExperience: z.number().int().optional().nullable(),
	preferredExperience: z.number().int().optional().nullable(),
	requiredClearance: z.string().optional().nullable(),
	requiredEducation: z.string().optional().nullable(),
	minimumEducation: z.string().optional().nullable(),
	preferredEducation: z.string().optional().nullable(),
	description: z.string().optional().nullable(),
	responsibilities: z.array(z.string()).optional(),
	requiredSkills: z.array(z.object({
		skillId: z.string(),
		skillName: z.string(),
		minProficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
		required: z.boolean(),
	})).optional(),
	requiredCertifications: z.array(z.string()).optional(),
	preferredCertifications: z.array(z.string()).optional(),
	startDate: z.string().optional().nullable(),
	endDate: z.string().optional().nullable(),
	duration: z.number().int().optional().nullable(),
	hoursPerWeek: z.number().int().default(40),
	locationRequired: z.string().optional().nullable(),
	remoteAllowed: z.boolean().default(false),
});

const AvailabilitySchema = z.object({
	startDate: z.string(),
	endDate: z.string(),
	commitment: z.number().int().min(0).max(100),
	opportunityId: z.string().uuid().optional(),
	opportunityName: z.string().optional(),
	status: z.enum(["committed", "tentative", "blocked", "available"]),
	notes: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Personnel API type - serialized version with string dates for client use
 */
export type PersonnelAPI = ReturnType<typeof mapDBPersonnelToPersonnel>;

/**
 * Map database personnel row to API type
 */
function mapDBPersonnelToPersonnel(row: DBPersonnel) {
	return {
		id: row.id,
		organizationId: row.organizationId ?? undefined,
		firstName: row.firstName,
		lastName: row.lastName,
		email: row.email ?? undefined,
		phone: row.phone ?? undefined,
		photoUrl: row.photoUrl ?? undefined,
		employmentType: row.employmentType ?? undefined,
		startDate: row.startDate ?? undefined,
		endDate: row.endDate ?? undefined,
		department: row.department ?? undefined,
		currentTitle: row.currentTitle ?? undefined,
		location: row.location ?? undefined,
		resumeFull: row.resumeFull ?? undefined,
		resumeBrief: row.resumeBrief ?? undefined,
		resumeFederal: row.resumeFederal ?? undefined,
		linkedInUrl: row.linkedInUrl ?? undefined,
		education: row.education ?? [],
		certifications: row.certifications ?? [],
		clearanceLevel: row.clearanceLevel ?? undefined,
		clearanceStatus: row.clearanceStatus ?? undefined,
		clearanceExpiration: row.clearanceExpiration ?? undefined,
		clearancePolygraph: row.clearancePolygraph ?? false,
		clearanceInvestigationType: row.clearanceInvestigationType ?? undefined,
		availability: row.availability ?? "available",
		availableDate: row.availableDate ?? undefined,
		currentProposals: row.currentProposals ?? [],
		maxCommitment: row.maxCommitment ?? 100,
		skills: row.skills ?? [],
		professionalSummary: row.professionalSummary ?? undefined,
		keyAchievements: row.keyAchievements ?? [],
		publications: row.publications ?? [],
		awards: row.awards ?? [],
		languages: row.languages ?? [],
		laborCategories: row.laborCategories ?? [],
		proposalWinCount: row.proposalWinCount ?? 0,
		proposalSubmitCount: row.proposalSubmitCount ?? 0,
		yearsOfExperience: row.yearsOfExperience ?? undefined,
		isActive: row.isActive ?? true,
		lastResumeUpdate: row.lastResumeUpdate?.toISOString() ?? undefined,
		createdBy: row.createdBy ?? undefined,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		embeddingUpdatedAt: row.embeddingUpdatedAt?.toISOString() ?? undefined,
	};
}

/**
 * Calculate skill match score between personnel skills and required skills
 */
function calculateSkillMatchScore(
	personnelSkills: DBPersonnel["skills"],
	requiredSkills: DBPositionRequirement["requiredSkills"]
): { score: number; gaps: string[] } {
	if (!requiredSkills || requiredSkills.length === 0) {
		return { score: 100, gaps: [] };
	}

	const gaps: string[] = [];
	let totalWeight = 0;
	let matchedWeight = 0;

	const proficiencyLevels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };

	for (const reqSkill of requiredSkills) {
		const weight = reqSkill.required ? 2 : 1;
		totalWeight += weight;

		const personSkill = personnelSkills?.find(
			(s) => s.skillId === reqSkill.skillId || s.skillName.toLowerCase() === reqSkill.skillName.toLowerCase()
		);

		if (personSkill) {
			const reqLevel = proficiencyLevels[reqSkill.minProficiency] || 2;
			const personLevel = proficiencyLevels[personSkill.proficiency] || 2;

			if (personLevel >= reqLevel) {
				matchedWeight += weight;
			} else {
				// Partial credit
				matchedWeight += weight * (personLevel / reqLevel);
				gaps.push(`${reqSkill.skillName}: Has ${personSkill.proficiency}, needs ${reqSkill.minProficiency}`);
			}
		} else {
			if (reqSkill.required) {
				gaps.push(`Missing required skill: ${reqSkill.skillName}`);
			} else {
				gaps.push(`Missing preferred skill: ${reqSkill.skillName}`);
			}
		}
	}

	const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 100;
	return { score, gaps };
}

/**
 * Calculate experience match score
 */
function calculateExperienceMatchScore(
	personnelYears: number | undefined | null,
	requiredYears: number | undefined | null,
	preferredYears: number | undefined | null
): number {
	if (!requiredYears && !preferredYears) return 100;

	const personYears = personnelYears ?? 0;
	const required = requiredYears ?? 0;
	const preferred = preferredYears ?? required;

	if (personYears >= preferred) return 100;
	if (personYears >= required) {
		// Linear interpolation between required and preferred
		return 70 + ((personYears - required) / (preferred - required)) * 30;
	}
	// Below required
	return Math.max(0, (personYears / required) * 70);
}

/**
 * Calculate education match score
 */
function calculateEducationMatchScore(
	personnelEducation: DBPersonnel["education"],
	requiredEducation: string | null | undefined,
	minimumEducation: string | null | undefined
): number {
	if (!requiredEducation && !minimumEducation) return 100;

	const eduLevels: Record<string, number> = {
		"high_school": 1,
		"associate": 2,
		"bachelors": 3,
		"masters": 4,
		"doctorate": 5,
		"phd": 5,
	};

	const requiredLevel = eduLevels[minimumEducation?.toLowerCase() ?? ""] ?? 0;
	const preferredLevel = eduLevels[requiredEducation?.toLowerCase() ?? ""] ?? requiredLevel;

	// Find highest education level from personnel
	let highestLevel = 0;
	for (const edu of personnelEducation ?? []) {
		const degreeLevel = eduLevels[edu.degree.toLowerCase()] ??
			(edu.degree.toLowerCase().includes("bachelor") ? 3 :
				edu.degree.toLowerCase().includes("master") ? 4 :
					edu.degree.toLowerCase().includes("doctor") || edu.degree.toLowerCase().includes("phd") ? 5 : 2);
		highestLevel = Math.max(highestLevel, degreeLevel);
	}

	if (highestLevel >= preferredLevel) return 100;
	if (highestLevel >= requiredLevel) return 75;
	if (highestLevel > 0) return 50;
	return 0;
}

/**
 * Calculate clearance match score
 */
function calculateClearanceMatchScore(
	personnelClearance: string | null | undefined,
	personnelClearanceStatus: string | null | undefined,
	requiredClearance: string | null | undefined
): number {
	if (!requiredClearance || requiredClearance.toLowerCase() === "none") return 100;

	const clearanceLevels: Record<string, number> = {
		"none": 0,
		"public trust": 1,
		"confidential": 2,
		"secret": 3,
		"top secret": 4,
		"ts/sci": 5,
	};

	const requiredLevel = clearanceLevels[requiredClearance.toLowerCase()] ?? 0;
	const personnelLevel = clearanceLevels[personnelClearance?.toLowerCase() ?? ""] ?? 0;

	if (personnelClearanceStatus?.toLowerCase() !== "active") {
		return personnelLevel > 0 ? 30 : 0; // Has inactive clearance
	}

	if (personnelLevel >= requiredLevel) return 100;
	if (personnelLevel === requiredLevel - 1) return 60; // One level below
	return personnelLevel > 0 ? 30 : 0;
}

/**
 * Calculate certification match score
 */
function calculateCertificationMatchScore(
	personnelCerts: DBPersonnel["certifications"],
	requiredCerts: string[] | null | undefined,
	preferredCerts: string[] | null | undefined
): number {
	const required = requiredCerts ?? [];
	const preferred = preferredCerts ?? [];

	if (required.length === 0 && preferred.length === 0) return 100;

	const personnelCertNames = (personnelCerts ?? [])
		.filter((c) => c.status === "active")
		.map((c) => c.name.toLowerCase());

	let requiredMatched = 0;
	let preferredMatched = 0;

	for (const cert of required) {
		if (personnelCertNames.some((pc) => pc.includes(cert.toLowerCase()) || cert.toLowerCase().includes(pc))) {
			requiredMatched++;
		}
	}

	for (const cert of preferred) {
		if (personnelCertNames.some((pc) => pc.includes(cert.toLowerCase()) || cert.toLowerCase().includes(pc))) {
			preferredMatched++;
		}
	}

	const requiredScore = required.length > 0 ? (requiredMatched / required.length) * 70 : 70;
	const preferredScore = preferred.length > 0 ? (preferredMatched / preferred.length) * 30 : 30;

	return Math.round(requiredScore + preferredScore);
}

/**
 * Calculate availability match score
 */
function calculateAvailabilityMatchScore(
	personnelAvail: string | null | undefined,
	personnelAvailDate: string | null | undefined,
	positionStartDate: string | null | undefined
): number {
	if (personnelAvail === "available") return 100;
	if (personnelAvail === "partial") return 70;
	if (personnelAvail === "committed") {
		// Check if they become available before position start
		if (personnelAvailDate && positionStartDate) {
			const availDate = new Date(personnelAvailDate);
			const startDate = new Date(positionStartDate);
			if (availDate <= startDate) return 80;
		}
		return 30;
	}
	return 0; // unavailable
}

// ============================================================================
// CRUD Operations
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function positionRequirementsByOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(positionRequirements.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

/**
 * Create a new personnel record
 */
export async function createPersonnel(
	data: z.infer<typeof PersonnelSchema>
): Promise<ActionResult<{ id: string }>> {
	await requireCurrentUserId();

	try {
		const validated = PersonnelSchema.parse(data);

		const newPersonnel: NewPersonnel = {
			firstName: validated.firstName,
			lastName: validated.lastName,
			email: validated.email,
			phone: validated.phone,
			employmentType: validated.employmentType,
			startDate: validated.startDate,
			endDate: validated.endDate,
			department: validated.department,
			currentTitle: validated.currentTitle,
			location: validated.location,
			clearanceLevel: validated.clearanceLevel,
			clearanceStatus: validated.clearanceStatus,
			clearanceExpiration: validated.clearanceExpiration,
			clearanceInvestigationType: validated.clearanceInvestigationType,
			clearancePolygraph: validated.clearancePolygraph ?? false,
			availability: validated.availability ?? "available",
			availableDate: validated.availableDate,
			maxCommitment: validated.maxCommitment ?? 100,
			professionalSummary: validated.professionalSummary,
			yearsOfExperience: validated.yearsOfExperience,
			resumeFull: validated.resumeFull,
			resumeBrief: validated.resumeBrief,
			resumeFederal: validated.resumeFederal,
			linkedInUrl: validated.linkedInUrl,
			education: validated.education ?? [],
			certifications: validated.certifications ?? [],
			skills: validated.skills ?? [],
			languages: validated.languages ?? [],
			keyAchievements: validated.keyAchievements ?? [],
			laborCategories: validated.laborCategories ?? [],
			isActive: validated.isActive ?? true,
			lastResumeUpdate: new Date(),
		};

		const [inserted] = await db
			.insert(personnel)
			.values(newPersonnel)
			.returning({ id: personnel.id });

		revalidatePath("/personnel");

		return { success: true, data: { id: inserted.id } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to create personnel record:", error);
		return { success: false, error: "Failed to create personnel record" };
	}
}

/**
 * Update an existing personnel record
 */
export async function updatePersonnel(
	id: string,
	data: Partial<z.infer<typeof PersonnelSchema>>
): Promise<ActionResult<void>> {
	await requireCurrentUserId();

	try {
		const validated = PersonnelSchema.partial().parse(data);

		const updateData: Partial<NewPersonnel> = {
			updatedAt: new Date(),
		};

		if (validated.firstName !== undefined) updateData.firstName = validated.firstName;
		if (validated.lastName !== undefined) updateData.lastName = validated.lastName;
		if (validated.email !== undefined) updateData.email = validated.email;
		if (validated.phone !== undefined) updateData.phone = validated.phone;
		if (validated.employmentType !== undefined) updateData.employmentType = validated.employmentType;
		if (validated.startDate !== undefined) updateData.startDate = validated.startDate;
		if (validated.endDate !== undefined) updateData.endDate = validated.endDate;
		if (validated.department !== undefined) updateData.department = validated.department;
		if (validated.currentTitle !== undefined) updateData.currentTitle = validated.currentTitle;
		if (validated.location !== undefined) updateData.location = validated.location;
		if (validated.clearanceLevel !== undefined) updateData.clearanceLevel = validated.clearanceLevel;
		if (validated.clearanceStatus !== undefined) updateData.clearanceStatus = validated.clearanceStatus;
		if (validated.clearanceExpiration !== undefined) updateData.clearanceExpiration = validated.clearanceExpiration;
		if (validated.clearanceInvestigationType !== undefined) updateData.clearanceInvestigationType = validated.clearanceInvestigationType;
		if (validated.clearancePolygraph !== undefined) updateData.clearancePolygraph = validated.clearancePolygraph;
		if (validated.availability !== undefined) updateData.availability = validated.availability;
		if (validated.availableDate !== undefined) updateData.availableDate = validated.availableDate;
		if (validated.maxCommitment !== undefined) updateData.maxCommitment = validated.maxCommitment;
		if (validated.professionalSummary !== undefined) updateData.professionalSummary = validated.professionalSummary;
		if (validated.yearsOfExperience !== undefined) updateData.yearsOfExperience = validated.yearsOfExperience;
		if (validated.resumeFull !== undefined) updateData.resumeFull = validated.resumeFull;
		if (validated.resumeBrief !== undefined) updateData.resumeBrief = validated.resumeBrief;
		if (validated.resumeFederal !== undefined) updateData.resumeFederal = validated.resumeFederal;
		if (validated.linkedInUrl !== undefined) updateData.linkedInUrl = validated.linkedInUrl;
		if (validated.education !== undefined) updateData.education = validated.education;
		if (validated.certifications !== undefined) updateData.certifications = validated.certifications;
		if (validated.skills !== undefined) updateData.skills = validated.skills;
		if (validated.languages !== undefined) updateData.languages = validated.languages;
		if (validated.keyAchievements !== undefined) updateData.keyAchievements = validated.keyAchievements;
		if (validated.laborCategories !== undefined) updateData.laborCategories = validated.laborCategories;
		if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

		// If resume content changed, update lastResumeUpdate
		if (validated.resumeFull !== undefined || validated.resumeBrief !== undefined || validated.resumeFederal !== undefined) {
			updateData.lastResumeUpdate = new Date();
		}

		const result = await db
			.update(personnel)
			.set(updateData)
			.where(eq(personnel.id, id))
			.returning({ id: personnel.id });

		if (result.length === 0) {
			return { success: false, error: "Personnel not found" };
		}

		revalidatePath("/personnel");
		revalidatePath(`/personnel/${id}`);

		return { success: true };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update personnel record:", error);
		return { success: false, error: "Failed to update personnel record" };
	}
}

/**
 * Delete a personnel record (soft delete by setting isActive to false)
 */
export async function deletePersonnel(
	id: string
): Promise<ActionResult<void>> {
	await requireCurrentUserId();

	try {
		const result = await db
			.update(personnel)
			.set({
				isActive: false,
				updatedAt: new Date(),
			})
			.where(eq(personnel.id, id))
			.returning({ id: personnel.id });

		if (result.length === 0) {
			return { success: false, error: "Personnel not found" };
		}

		revalidatePath("/personnel");

		return { success: true };
	} catch (error) {
		logger.error("Failed to delete personnel record:", error);
		return { success: false, error: "Failed to delete personnel record" };
	}
}

/**
 * Get a single personnel record with full details
 */
export async function getPersonnel(
	id: string
): Promise<ActionResult<ReturnType<typeof mapDBPersonnelToPersonnel>>> {
	await requireCurrentUserId();

	try {
		const [row] = await db
			.select()
			.from(personnel)
			.where(eq(personnel.id, id))
			.limit(1);

		if (!row) {
			return { success: false, error: "Personnel not found" };
		}

		return { success: true, data: mapDBPersonnelToPersonnel(row) };
	} catch (error) {
		logger.error("Failed to fetch personnel record:", error);
		return { success: false, error: "Failed to fetch personnel record" };
	}
}

/**
 * Search personnel with filters
 */
export async function searchPersonnel(
	query: string,
	filters?: PersonnelFilters
): Promise<ActionResult<ReturnType<typeof mapDBPersonnelToPersonnel>[]>> {
	await requireCurrentUserId();

	try {
		const conditions = [];

		// Default to active only
		if (filters?.isActive !== false) {
			conditions.push(eq(personnel.isActive, true));
		}

		// Full-text search on name, title, summary
		if (query && query.trim().length > 0) {
			const searchTerm = `%${query.trim()}%`;
			conditions.push(
				or(
					ilike(personnel.firstName, searchTerm),
					ilike(personnel.lastName, searchTerm),
					ilike(personnel.currentTitle, searchTerm),
					ilike(personnel.professionalSummary, searchTerm),
					ilike(personnel.email, searchTerm)
				)
			);
		}

		// Department filter
		if (filters?.department) {
			conditions.push(ilike(personnel.department, `%${filters.department}%`));
		}

		// Employment type filter
		if (filters?.employmentType) {
			conditions.push(eq(personnel.employmentType, filters.employmentType));
		}

		// Clearance level filter
		if (filters?.clearanceLevel) {
			conditions.push(eq(personnel.clearanceLevel, filters.clearanceLevel));
		}

		// Availability filter
		if (filters?.availability) {
			conditions.push(eq(personnel.availability, filters.availability));
		}

		// Minimum experience filter
		if (filters?.minExperience !== undefined) {
			conditions.push(gte(personnel.yearsOfExperience, filters.minExperience));
		}

		const limit = filters?.limit ?? 50;
		const offset = filters?.offset ?? 0;

		const rows = await db
			.select()
			.from(personnel)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(personnel.updatedAt))
			.limit(limit)
			.offset(offset);

		// Post-filter for skills (JSON field filtering)
		let filtered = rows;
		if (filters?.skills && filters.skills.length > 0) {
			filtered = rows.filter((row) => {
				const personnelSkillNames = (row.skills ?? []).map((s) => s.skillName.toLowerCase());
				return filters.skills!.some((s) => personnelSkillNames.includes(s.toLowerCase()));
			});
		}

		// Post-filter for certification
		if (filters?.hasCertification) {
			filtered = filtered.filter((row) => {
				const certNames = (row.certifications ?? []).map((c) => c.name.toLowerCase());
				return certNames.some((c) => c.includes(filters.hasCertification!.toLowerCase()));
			});
		}

		const results = filtered.map(mapDBPersonnelToPersonnel);

		return { success: true, data: results };
	} catch (error) {
		logger.error("Failed to search personnel:", error);
		return { success: false, error: "Failed to search personnel" };
	}
}

// ============================================================================
// Resume Operations
// ============================================================================

/**
 * Parse a resume file using AI
 */
export async function parseResume(
	fileContent: string,
	fileName: string
): Promise<ActionResult<ParsedResume>> {
	await requireCurrentUserId();

	try {
		const prompt = `Parse the following resume content and extract structured information. Return a JSON object with these fields:
- firstName: string
- lastName: string
- email: string (optional)
- phone: string (optional)
- currentTitle: string (optional)
- professionalSummary: string (optional, 2-3 sentences)
- education: array of {degree, field, institution, year}
- experience: array of {title, company, startDate (YYYY-MM), endDate (YYYY-MM or empty), description, accomplishments: string[]}
- skills: array of {skillName, proficiency (beginner/intermediate/advanced/expert), yearsExperience}
- certifications: array of {name, issuer, dateObtained (YYYY-MM)}
- clearance: {level, status} (optional)

Resume content from file "${fileName}":
${fileContent.substring(0, 10000)}

Return ONLY valid JSON, no additional text.`;

		let parsed: ParsedResume;

		try {
			const result = await complete(prompt, {
				maxTokens: 2000,
				temperature: 0.1,
			});

			// Extract JSON from response
			const jsonMatch = result.content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in AI response");
			}

			parsed = JSON.parse(jsonMatch[0]) as ParsedResume;
		} catch (aiError) {
			logger.error("AI parsing failed, using fallback extraction:", aiError);

			// Fallback: Basic extraction
			const lines = fileContent.split("\n");
			const emailMatch = fileContent.match(/[\w.-]+@[\w.-]+\.\w+/);
			const phoneMatch = fileContent.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

			parsed = {
				firstName: lines[0]?.split(" ")[0] || "Unknown",
				lastName: lines[0]?.split(" ").slice(1).join(" ") || "Unknown",
				email: emailMatch?.[0],
				phone: phoneMatch?.[0],
				currentTitle: lines[1]?.trim(),
				education: [],
				experience: [],
				skills: [],
				certifications: [],
			};
		}

		return { success: true, data: parsed };
	} catch (error) {
		logger.error("Failed to parse resume:", error);
		return { success: false, error: "Failed to parse resume" };
	}
}

/**
 * Bulk import resumes
 */
export async function bulkImportResumes(
	files: Array<{ content: string; fileName: string }>
): Promise<{ success: boolean; imported: number; errors: number; details?: string[] }> {
	await requireCurrentUserId();

	try {
		const results = {
			imported: 0,
			errors: 0,
			details: [] as string[],
		};

		for (const file of files) {
			try {
				const parseResult = await parseResume(file.content, file.fileName);
				if (parseResult.success && parseResult.data) {
					const createResult = await createPersonnel({
						firstName: parseResult.data.firstName,
						lastName: parseResult.data.lastName,
						email: parseResult.data.email,
						phone: parseResult.data.phone,
						currentTitle: parseResult.data.currentTitle,
						professionalSummary: parseResult.data.professionalSummary,
						clearanceLevel: parseResult.data.clearance?.level,
						clearanceStatus: parseResult.data.clearance?.status,
						education: parseResult.data.education.map((e) => ({
							...e,
							gpa: undefined,
							honors: undefined,
						})),
						certifications: parseResult.data.certifications.map((c) => ({
							...c,
							dateObtained: c.dateObtained ?? new Date().toISOString().slice(0, 7),
							status: "active" as const,
						})),
						skills: parseResult.data.skills.map((s) => ({
							skillId: crypto.randomUUID(),
							skillName: s.skillName,
							proficiency: (s.proficiency || "intermediate") as "beginner" | "intermediate" | "advanced" | "expert",
							yearsExperience: s.yearsExperience ?? 1,
						})),
					});

					if (createResult.success) {
						// Create experience records
						for (const exp of parseResult.data.experience) {
							await createPersonnelExperience(createResult.data!.id, {
								title: exp.title,
								company: exp.company,
								startDate: exp.startDate,
								endDate: exp.endDate,
								description: exp.description,
								accomplishments: exp.accomplishments,
								isCurrent: !exp.endDate,
							});
						}

						results.imported++;
						results.details.push(`Imported: ${file.fileName}`);
					} else {
						results.errors++;
						results.details.push(`Failed: ${file.fileName} - ${createResult.error}`);
					}
				} else {
					results.errors++;
					results.details.push(`Failed: ${file.fileName} - ${parseResult.error}`);
				}
			} catch {
				results.errors++;
				results.details.push(`Failed: ${file.fileName} - Unknown error`);
			}
		}

		revalidatePath("/personnel");

		return { success: true, ...results };
	} catch (error) {
		logger.error("Failed to bulk import resumes:", error);
		return { success: false, imported: 0, errors: files.length };
	}
}

/**
 * Generate a formatted resume for a personnel
 */
export async function generateResume(
	personnelId: string,
	format: "federal" | "commercial" | "brief" | "technical"
): Promise<ActionResult<string>> {
	await requireCurrentUserId();

	try {
		// Fetch personnel with experience
		const [person] = await db
			.select()
			.from(personnel)
			.where(eq(personnel.id, personnelId))
			.limit(1);

		if (!person) {
			return { success: false, error: "Personnel not found" };
		}

		const experience = await db
			.select()
			.from(personnelExperience)
			.where(eq(personnelExperience.personnelId, personnelId))
			.orderBy(desc(personnelExperience.startDate));

		// Try AI generation
		const prompt = `Generate a professional ${format} format resume for this person:

Name: ${person.firstName} ${person.lastName}
Title: ${person.currentTitle ?? "Professional"}
Summary: ${person.professionalSummary ?? "Experienced professional"}

Education:
${(person.education ?? []).map((e) => `- ${e.degree} in ${e.field}, ${e.institution} (${e.year})`).join("\n")}

Experience:
${experience.map((e) => `
- ${e.title} at ${e.company ?? "Company"} (${e.startDate} - ${e.endDate ?? "Present"})
  ${e.description ?? ""}
  Accomplishments: ${(e.accomplishments ?? []).join("; ")}
`).join("\n")}

Skills: ${(person.skills ?? []).map((s) => `${s.skillName} (${s.proficiency})`).join(", ")}

Certifications: ${(person.certifications ?? []).map((c) => c.name).join(", ")}

Clearance: ${person.clearanceLevel ?? "None"}

Format requirements:
${format === "federal"
				? "Use federal resume format with detailed position descriptions, hours per week, supervisor info placeholders, and measurable accomplishments."
				: format === "commercial"
					? "Use standard commercial resume format with concise bullet points and achievements."
					: format === "brief"
						? "Create a 1-paragraph executive summary highlighting key qualifications and achievements."
						: "Focus on technical skills, tools, methodologies, and technical accomplishments."}

Generate the resume text:`;

		let resumeContent: string;

		try {
			const result = await complete(prompt, {
				maxTokens: 2000,
				temperature: 0.7,
			});
			resumeContent = result.content;
		} catch (aiError) {
			logger.error("AI generation failed, using template:", aiError);

			// Fallback template
			resumeContent = generateFallbackResume(person, experience, format);
		}

		// Store generated resume
		const updateField = format === "federal" ? "resumeFederal" : format === "brief" ? "resumeBrief" : "resumeFull";
		await db
			.update(personnel)
			.set({
				[updateField]: resumeContent,
				lastResumeUpdate: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(personnel.id, personnelId));

		return { success: true, data: resumeContent };
	} catch (error) {
		logger.error("Failed to generate resume:", error);
		return { success: false, error: "Failed to generate resume" };
	}
}

/**
 * Fallback resume generator
 */
function generateFallbackResume(
	person: DBPersonnel,
	experience: DBPersonnelExperience[],
	format: string
): string {
	const name = `${person.firstName} ${person.lastName}`;
	const title = person.currentTitle ?? "Professional";

	if (format === "brief") {
		return `${name} is ${person.yearsOfExperience ? `a ${person.yearsOfExperience}-year veteran` : "an experienced"} ${title} ${person.clearanceLevel ? `with ${person.clearanceLevel} clearance` : ""}. ${person.professionalSummary ?? "Skilled professional with diverse experience."}`;
	}

	const sections = [
		`${name.toUpperCase()}`,
		`${title}`,
		"",
		"PROFESSIONAL SUMMARY",
		person.professionalSummary ?? "Experienced professional with proven track record of success.",
		"",
		"EXPERIENCE",
	];

	for (const exp of experience.slice(0, 5)) {
		sections.push(`${exp.title} | ${exp.company ?? "Organization"}`);
		sections.push(`${exp.startDate} - ${exp.endDate ?? "Present"}`);
		if (exp.description) sections.push(exp.description);
		for (const acc of (exp.accomplishments ?? []).slice(0, 3)) {
			sections.push(`• ${acc}`);
		}
		sections.push("");
	}

	sections.push("EDUCATION");
	for (const edu of (person.education ?? []).slice(0, 3)) {
		sections.push(`${edu.degree} in ${edu.field}, ${edu.institution} (${edu.year})`);
	}

	sections.push("");
	sections.push("SKILLS");
	sections.push((person.skills ?? []).map((s) => s.skillName).join(" • "));

	if ((person.certifications ?? []).length > 0) {
		sections.push("");
		sections.push("CERTIFICATIONS");
		for (const cert of (person.certifications ?? []).slice(0, 5)) {
			sections.push(`${cert.name} - ${cert.issuer}`);
		}
	}

	if (person.clearanceLevel) {
		sections.push("");
		sections.push(`SECURITY CLEARANCE: ${person.clearanceLevel} (${person.clearanceStatus ?? "Active"})`);
	}

	return sections.join("\n");
}

// ============================================================================
// Personnel Experience Operations
// ============================================================================

/**
 * Create a personnel experience record
 */
async function createPersonnelExperience(
	personnelId: string,
	data: {
		title: string;
		company?: string;
		client?: string;
		startDate?: string;
		endDate?: string;
		isCurrent?: boolean;
		description?: string;
		accomplishments?: string[];
		skillsUsed?: string[];
	}
): Promise<ActionResult<{ id: string }>> {
	try {
		const expData: NewPersonnelExperience = {
			personnelId,
			title: data.title,
			company: data.company,
			client: data.client,
			startDate: data.startDate,
			endDate: data.endDate,
			isCurrent: data.isCurrent ?? false,
			description: data.description,
			accomplishments: data.accomplishments ?? [],
			skillsUsed: data.skillsUsed ?? [],
		};

		const [inserted] = await db
			.insert(personnelExperience)
			.values(expData)
			.returning({ id: personnelExperience.id });

		return { success: true, data: { id: inserted.id } };
	} catch (error) {
		logger.error("Failed to create personnel experience:", error);
		return { success: false, error: "Failed to create experience record" };
	}
}

// ============================================================================
// Position Matching
// ============================================================================

/**
 * Match personnel to a position requirement
 */
export async function matchPersonnelToPosition(
	positionId: string
): Promise<ActionResult<PersonnelMatch[]>> {
	await requireCurrentUserId();

	try {
		// Fetch position requirements
		const [position] = await db
			.select()
			.from(positionRequirements)
			.where(eq(positionRequirements.id, positionId))
			.limit(1);

		if (!position) {
			return { success: false, error: "Position not found" };
		}

		// Fetch all available personnel
		const allPersonnel = await db
			.select()
			.from(personnel)
			.where(
				and(
					eq(personnel.isActive, true),
					or(
						eq(personnel.availability, "available"),
						eq(personnel.availability, "partial")
					)
				)
			);

		const matches: PersonnelMatch[] = [];

		for (const person of allPersonnel) {
			const skillResult = calculateSkillMatchScore(person.skills, position.requiredSkills);

			const experienceMatch = calculateExperienceMatchScore(
				person.yearsOfExperience,
				position.requiredExperience,
				position.preferredExperience
			);

			const educationMatch = calculateEducationMatchScore(
				person.education,
				position.requiredEducation,
				position.minimumEducation
			);

			const clearanceMatch = calculateClearanceMatchScore(
				person.clearanceLevel,
				person.clearanceStatus,
				position.requiredClearance
			);

			const certificationMatch = calculateCertificationMatchScore(
				person.certifications,
				position.requiredCertifications,
				position.preferredCertifications
			);

			const availabilityMatch = calculateAvailabilityMatchScore(
				person.availability,
				person.availableDate,
				position.startDate
			);

			// Weighted overall score
			const overallScore = Math.round(
				skillResult.score * 0.30 +
				experienceMatch * 0.20 +
				educationMatch * 0.10 +
				clearanceMatch * 0.20 +
				certificationMatch * 0.10 +
				availabilityMatch * 0.10
			);

			matches.push({
				personnelId: person.id,
				personnelName: `${person.firstName} ${person.lastName}`,
				matchScore: overallScore,
				matchDetails: {
					skillsMatch: skillResult.score,
					experienceMatch: Math.round(experienceMatch),
					educationMatch: Math.round(educationMatch),
					clearanceMatch: Math.round(clearanceMatch),
					certificationMatch: Math.round(certificationMatch),
					availabilityMatch: Math.round(availabilityMatch),
					gaps: skillResult.gaps,
				},
				availability: person.availability ?? "available",
			});
		}

		// Sort by match score descending
		matches.sort((a, b) => b.matchScore - a.matchScore);

		return { success: true, data: matches };
	} catch (error) {
		logger.error("Failed to match personnel:", error);
		return { success: false, error: "Failed to match personnel" };
	}
}

/**
 * Analyze staffing gaps for an opportunity
 */
export async function analyzeStaffingGaps(
	opportunityId: string
): Promise<ActionResult<GapAnalysis>> {
	const userId = await requireCurrentUserId();

	try {
		// Fetch all positions for the opportunity
		const positions = await db
			.select()
			.from(positionRequirements)
			.where(positionRequirementsByOpportunityCondition(opportunityId, userId));

		if (positions.length === 0) {
			return {
				success: true,
				data: {
					opportunityId,
					totalPositions: 0,
					filledPositions: 0,
					openPositions: 0,
					gaps: [],
					recommendations: ["No positions defined for this opportunity"],
				},
			};
		}

		const gaps: GapAnalysis["gaps"] = [];
		let filledPositions = 0;
		let openPositions = 0;

		for (const position of positions) {
			if (position.assignedPersonnelId && position.assignmentStatus === "assigned") {
				filledPositions++;
				continue;
			}

			openPositions++;

			// Find matches for this position
			const matchResult = await matchPersonnelToPosition(position.id);
			const topMatches = matchResult.success && matchResult.data ? matchResult.data.slice(0, 3) : [];
			const bestMatch = topMatches[0];

			const missingRequirements: string[] = [];
			const suggestedActions: string[] = [];

			// Identify missing requirements based on best match or lack thereof
			if (!bestMatch || bestMatch.matchScore < 60) {
				if (position.requiredClearance) {
					missingRequirements.push(`${position.requiredClearance} clearance required`);
				}
				if (position.requiredExperience) {
					missingRequirements.push(`${position.requiredExperience}+ years experience required`);
				}
				if ((position.requiredCertifications ?? []).length > 0) {
					missingRequirements.push(`Certifications: ${position.requiredCertifications!.join(", ")}`);
				}

				suggestedActions.push("Consider external recruiting");
				suggestedActions.push("Explore teaming partner options");
			} else if (bestMatch.matchScore < 80) {
				missingRequirements.push(...bestMatch.matchDetails.gaps.slice(0, 3));
				suggestedActions.push(`Consider assigning ${bestMatch.personnelName} with training plan`);
			} else {
				suggestedActions.push(`Assign ${bestMatch.personnelName} (${bestMatch.matchScore}% match)`);
			}

			// Determine urgency based on position category and start date
			let urgency: "critical" | "high" | "medium" | "low" = "medium";
			if (position.positionCategory === "key_personnel") {
				urgency = "critical";
			} else if (position.startDate) {
				const daysUntilStart = Math.ceil(
					(new Date(position.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
				);
				if (daysUntilStart <= 30) urgency = "critical";
				else if (daysUntilStart <= 60) urgency = "high";
			}

			gaps.push({
				positionId: position.id,
				positionTitle: position.positionTitle,
				missingRequirements,
				suggestedActions,
				urgency,
			});
		}

		// Generate recommendations
		const recommendations: string[] = [];
		const criticalGaps = gaps.filter((g) => g.urgency === "critical").length;
		const highGaps = gaps.filter((g) => g.urgency === "high").length;

		if (criticalGaps > 0) {
			recommendations.push(`${criticalGaps} critical position(s) need immediate attention`);
		}
		if (highGaps > 0) {
			recommendations.push(`${highGaps} high-priority position(s) should be addressed within 2 weeks`);
		}
		if (openPositions > positions.length * 0.5) {
			recommendations.push("Consider teaming arrangements to fill capability gaps");
		}
		if (gaps.some((g) => g.missingRequirements.some((r) => r.includes("clearance")))) {
			recommendations.push("Initiate clearance processing for qualified candidates");
		}

		return {
			success: true,
			data: {
				opportunityId,
				totalPositions: positions.length,
				filledPositions,
				openPositions,
				gaps,
				recommendations,
			},
		};
	} catch (error) {
		logger.error("Failed to analyze gaps:", error);
		return { success: false, error: "Failed to analyze gaps" };
	}
}

/**
 * Assign personnel to a position
 */
export async function assignPersonnelToPosition(
	personnelId: string,
	positionId: string,
	_assignedBy?: string
): Promise<ActionResult<void>> {
	const assignedBy = await requireCurrentUserId();

	try {
		// Verify personnel exists and is available
		const [person] = await db
			.select()
			.from(personnel)
			.where(eq(personnel.id, personnelId))
			.limit(1);

		if (!person) {
			return { success: false, error: "Personnel not found" };
		}

		// Verify position exists
		const [position] = await db
			.select()
			.from(positionRequirements)
			.where(eq(positionRequirements.id, positionId))
			.limit(1);

		if (!position) {
			return { success: false, error: "Position not found" };
		}

		// Calculate match score for records
		const skillResult = calculateSkillMatchScore(person.skills, position.requiredSkills);
		const experienceMatch = calculateExperienceMatchScore(person.yearsOfExperience, position.requiredExperience, position.preferredExperience);
		const educationMatch = calculateEducationMatchScore(person.education, position.requiredEducation, position.minimumEducation);
		const clearanceMatch = calculateClearanceMatchScore(person.clearanceLevel, person.clearanceStatus, position.requiredClearance);
		const certificationMatch = calculateCertificationMatchScore(person.certifications, position.requiredCertifications, position.preferredCertifications);
		const availabilityMatch = calculateAvailabilityMatchScore(person.availability, person.availableDate, position.startDate);

		const overallScore = Math.round(
			skillResult.score * 0.30 +
			experienceMatch * 0.20 +
			educationMatch * 0.10 +
			clearanceMatch * 0.20 +
			certificationMatch * 0.10 +
			availabilityMatch * 0.10
		);

		// Update position with assignment
		await db
			.update(positionRequirements)
			.set({
				assignedPersonnelId: personnelId,
				assignmentStatus: "assigned",
				assignedAt: new Date(),
				assignedBy,
				matchScore: overallScore,
				matchDetails: {
					skillsMatch: skillResult.score,
					experienceMatch: Math.round(experienceMatch),
					educationMatch: Math.round(educationMatch),
					clearanceMatch: Math.round(clearanceMatch),
					certificationMatch: Math.round(certificationMatch),
					availabilityMatch: Math.round(availabilityMatch),
					gaps: skillResult.gaps,
				},
				updatedAt: new Date(),
			})
			.where(eq(positionRequirements.id, positionId));

		// Update personnel availability if position has opportunityId
		if (position.opportunityId) {
			const currentProposals = (person.currentProposals ?? []) as string[];
			if (!currentProposals.includes(position.opportunityId)) {
				await db
					.update(personnel)
					.set({
						currentProposals: [...currentProposals, position.opportunityId],
						updatedAt: new Date(),
					})
					.where(eq(personnel.id, personnelId));
			}
		}

		revalidatePath("/staffing");
		revalidatePath(`/positions/${positionId}`);
		revalidatePath(`/personnel/${personnelId}`);

		return { success: true };
	} catch (error) {
		logger.error("Failed to assign personnel:", error);
		return { success: false, error: "Failed to assign personnel" };
	}
}

/**
 * Unassign personnel from a position
 */
export async function unassignFromPosition(
	positionId: string
): Promise<ActionResult<void>> {
	await requireCurrentUserId();

	try {
		const [position] = await db
			.select()
			.from(positionRequirements)
			.where(eq(positionRequirements.id, positionId))
			.limit(1);

		if (!position) {
			return { success: false, error: "Position not found" };
		}

		const previousPersonnelId = position.assignedPersonnelId;

		await db
			.update(positionRequirements)
			.set({
				assignedPersonnelId: null,
				assignmentStatus: "open",
				assignedAt: null,
				assignedBy: null,
				matchScore: null,
				matchDetails: null,
				updatedAt: new Date(),
			})
			.where(eq(positionRequirements.id, positionId));

		// Remove opportunity from personnel's currentProposals if applicable
		if (previousPersonnelId && position.opportunityId) {
			const [person] = await db
				.select()
				.from(personnel)
				.where(eq(personnel.id, previousPersonnelId))
				.limit(1);

			if (person) {
				const currentProposals = (person.currentProposals ?? []) as string[];
				const updatedProposals = currentProposals.filter((p) => p !== position.opportunityId);
				await db
					.update(personnel)
					.set({
						currentProposals: updatedProposals,
						updatedAt: new Date(),
					})
					.where(eq(personnel.id, previousPersonnelId));
			}
		}

		revalidatePath("/staffing");
		revalidatePath(`/positions/${positionId}`);

		return { success: true };
	} catch (error) {
		logger.error("Failed to unassign personnel:", error);
		return { success: false, error: "Failed to unassign personnel" };
	}
}

// ============================================================================
// Availability & Scheduling
// ============================================================================

/**
 * Get personnel availability for a date range
 */
export async function getPersonnelAvailability(
	personnelId: string,
	dateRange?: DateRange
): Promise<ActionResult<{
	personnelId: string;
	personnelName: string;
	availability: string;
	availableDate: string | null;
	maxCommitment: number;
	commitments: Array<{
		id: string;
		startDate: string;
		endDate: string;
		commitment: number;
		opportunityName: string | null;
		status: string;
	}>;
	totalCommitmentInRange: number;
}>> {
	await requireCurrentUserId();

	try {
		const [person] = await db
			.select()
			.from(personnel)
			.where(eq(personnel.id, personnelId))
			.limit(1);

		if (!person) {
			return { success: false, error: "Personnel not found" };
		}

		const conditions = [eq(personnelAvailability.personnelId, personnelId)];

		if (dateRange) {
			conditions.push(lte(personnelAvailability.startDate, dateRange.end.toISOString().split("T")[0]));
			conditions.push(gte(personnelAvailability.endDate, dateRange.start.toISOString().split("T")[0]));
		}

		const availabilityRecords = await db
			.select()
			.from(personnelAvailability)
			.where(and(...conditions))
			.orderBy(asc(personnelAvailability.startDate));

		const commitments = availabilityRecords.map((r) => ({
			id: r.id,
			startDate: r.startDate,
			endDate: r.endDate,
			commitment: r.commitment,
			opportunityName: r.opportunityName,
			status: r.status ?? "committed",
		}));

		// Calculate total commitment in range
		let totalCommitmentInRange = 0;
		for (const commitment of commitments) {
			if (commitment.status === "committed" || commitment.status === "tentative") {
				totalCommitmentInRange += commitment.commitment;
			}
		}

		return {
			success: true,
			data: {
				personnelId,
				personnelName: `${person.firstName} ${person.lastName}`,
				availability: person.availability ?? "available",
				availableDate: person.availableDate,
				maxCommitment: person.maxCommitment ?? 100,
				commitments,
				totalCommitmentInRange: Math.min(totalCommitmentInRange, 100),
			},
		};
	} catch (error) {
		logger.error("Failed to get personnel availability:", error);
		return { success: false, error: "Failed to get personnel availability" };
	}
}

/**
 * Check availability for multiple personnel over a date range
 */
export async function checkAvailability(
	personnelIds: string[],
	dates: DateRange
): Promise<ActionResult<Record<string, { available: boolean; commitment: number; conflicts: string[] }>>> {
	await requireCurrentUserId();

	try {
		const availability: Record<string, { available: boolean; commitment: number; conflicts: string[] }> = {};

		for (const id of personnelIds) {
			const result = await getPersonnelAvailability(id, dates);

			if (result.success && result.data) {
				const remainingCapacity = result.data.maxCommitment - result.data.totalCommitmentInRange;
				const conflicts = result.data.commitments
					.filter((c) => c.status === "committed")
					.map((c) => c.opportunityName ?? "Unknown project");

				availability[id] = {
					available: remainingCapacity > 0,
					commitment: result.data.totalCommitmentInRange,
					conflicts,
				};
			} else {
				availability[id] = {
					available: false,
					commitment: 0,
					conflicts: ["Personnel not found"],
				};
			}
		}

		return { success: true, data: availability };
	} catch (error) {
		logger.error("Failed to check availability:", error);
		return { success: false, error: "Failed to check availability" };
	}
}

/**
 * Update personnel availability
 */
export async function updateAvailability(
	personnelId: string,
	availability: z.infer<typeof AvailabilitySchema>
): Promise<ActionResult<{ id: string }>> {
	await requireCurrentUserId();

	try {
		const validated = AvailabilitySchema.parse(availability);

		// Insert new availability record
		const [inserted] = await db
			.insert(personnelAvailability)
			.values({
				personnelId,
				startDate: validated.startDate,
				endDate: validated.endDate,
				commitment: validated.commitment,
				opportunityId: validated.opportunityId ?? null,
				opportunityName: validated.opportunityName ?? null,
				status: validated.status,
				notes: validated.notes ?? null,
			})
			.returning({ id: personnelAvailability.id });

		// Update personnel overall availability status based on commitments
		const totalCommitments = await db
			.select({ total: sql<number>`SUM(${personnelAvailability.commitment})` })
			.from(personnelAvailability)
			.where(
				and(
					eq(personnelAvailability.personnelId, personnelId),
					or(
						eq(personnelAvailability.status, "committed"),
						eq(personnelAvailability.status, "tentative")
					)
				)
			);

		const totalCommitment = totalCommitments[0]?.total ?? 0;
		let newAvailability: string;
		if (totalCommitment >= 100) {
			newAvailability = "committed";
		} else if (totalCommitment >= 50) {
			newAvailability = "partial";
		} else {
			newAvailability = "available";
		}

		await db
			.update(personnel)
			.set({
				availability: newAvailability,
				updatedAt: new Date(),
			})
			.where(eq(personnel.id, personnelId));

		revalidatePath(`/personnel/${personnelId}`);
		revalidatePath("/staffing");

		return { success: true, data: { id: inserted.id } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update availability:", error);
		return { success: false, error: "Failed to update availability" };
	}
}

// ============================================================================
// Certification Tracking
// ============================================================================

/**
 * Get certifications expiring soon
 */
export async function getExpiringCertifications(
	daysAhead: number = 90
): Promise<ActionResult<Array<{
	personnelId: string;
	personnelName: string;
	certification: string;
	expirationDate: string;
	daysUntilExpiration: number;
}>>> {
	await requireCurrentUserId();

	try {
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + daysAhead);

		const allPersonnel = await db
			.select()
			.from(personnel)
			.where(eq(personnel.isActive, true));

		const expiring: Array<{
			personnelId: string;
			personnelName: string;
			certification: string;
			expirationDate: string;
			daysUntilExpiration: number;
		}> = [];

		const now = new Date();

		for (const person of allPersonnel) {
			for (const cert of person.certifications ?? []) {
				if (cert.expirationDate && cert.status === "active") {
					const expDate = new Date(cert.expirationDate);
					if (expDate <= futureDate && expDate >= now) {
						const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
						expiring.push({
							personnelId: person.id,
							personnelName: `${person.firstName} ${person.lastName}`,
							certification: cert.name,
							expirationDate: cert.expirationDate,
							daysUntilExpiration: daysUntil,
						});
					}
				}
			}
		}

		// Sort by days until expiration
		expiring.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

		return { success: true, data: expiring };
	} catch (error) {
		logger.error("Failed to get expiring certifications:", error);
		return { success: false, error: "Failed to get expiring certifications" };
	}
}

/**
 * Send certification renewal reminders
 */
export async function sendCertificationReminders(
	personnelIds: string[]
): Promise<ActionResult<{ sent: number }>> {
	await requireCurrentUserId();

	try {
		// In production, this would send emails via email service
		// For now, just count and return

		const personnelToNotify = await db
			.select()
			.from(personnel)
			.where(inArray(personnel.id, personnelIds));

		// Log the reminder action (in production, integrate with notification service)
		const sentCount = personnelToNotify.filter((p) => p.email).length;

		return { success: true, data: { sent: sentCount } };
	} catch (error) {
		logger.error("Failed to send reminders:", error);
		return { success: false, error: "Failed to send reminders" };
	}
}

// ============================================================================
// Org Chart & Staffing Matrix
// ============================================================================

/**
 * Generate org chart data for an opportunity
 */
export async function generateOrgChart(
	opportunityId: string
): Promise<ActionResult<OrgChartData>> {
	const userId = await requireCurrentUserId();

	try {
		// Fetch all positions for the opportunity with assigned personnel
		const positions = await db
			.select()
			.from(positionRequirements)
			.where(positionRequirementsByOpportunityCondition(opportunityId, userId))
			.orderBy(asc(positionRequirements.positionCategory));

		const nodes: OrgChartData["nodes"] = [];
		const edges: OrgChartData["edges"] = [];

		// Determine hierarchy based on position category
		const categoryLevels: Record<string, number> = {
			"key_personnel": 0,
			"management": 1,
			"technical": 2,
			"support": 3,
		};

		// Find PM or lead for the root
		const keyPersonnel = positions.filter((p) => p.positionCategory === "key_personnel");
		let rootId: string | undefined;

		for (const position of positions) {
			let personName = "TBD";
			if (position.assignedPersonnelId) {
				const [assignedPerson] = await db
					.select()
					.from(personnel)
					.where(eq(personnel.id, position.assignedPersonnelId))
					.limit(1);
				if (assignedPerson) {
					personName = `${assignedPerson.firstName} ${assignedPerson.lastName}`;
				}
			}

			const level = categoryLevels[position.positionCategory ?? "technical"] ?? 2;
			const nodeId = position.id;

			nodes.push({
				id: nodeId,
				personnelId: position.assignedPersonnelId ?? undefined,
				name: personName,
				title: position.positionTitle,
				level,
			});

			// Set root and create edges
			if (level === 0) {
				rootId = nodeId;
			} else if (rootId && level === 1) {
				edges.push({ from: rootId, to: nodeId });
			} else if (level === 2) {
				// Connect to management level
				const manager = nodes.find((n) => n.level === 1);
				if (manager) {
					edges.push({ from: manager.id, to: nodeId });
				} else if (rootId) {
					edges.push({ from: rootId, to: nodeId });
				}
			} else if (level === 3) {
				// Connect to technical level
				const techLead = nodes.find((n) => n.level === 2);
				if (techLead) {
					edges.push({ from: techLead.id, to: nodeId });
				}
			}
		}

		// Update parent IDs based on edges
		for (const edge of edges) {
			const childNode = nodes.find((n) => n.id === edge.to);
			if (childNode) {
				childNode.parentId = edge.from;
			}
		}

		return { success: true, data: { nodes, edges } };
	} catch (error) {
		logger.error("Failed to generate org chart:", error);
		return { success: false, error: "Failed to generate org chart" };
	}
}

/**
 * Generate staffing matrix for an opportunity
 */
export async function generateStaffingMatrix(
	opportunityId: string
): Promise<ActionResult<StaffingMatrix>> {
	const userId = await requireCurrentUserId();

	try {
		const positions = await db
			.select()
			.from(positionRequirements)
			.where(positionRequirementsByOpportunityCondition(opportunityId, userId));

		const matrixPositions: StaffingMatrix["positions"] = [];
		let totalHeadcount = 0;
		let assignedCount = 0;

		for (const position of positions) {
			const assigned: Array<{ personnelId: string; name: string; matchScore: number }> = [];

			if (position.assignedPersonnelId) {
				const [assignedPerson] = await db
					.select()
					.from(personnel)
					.where(eq(personnel.id, position.assignedPersonnelId))
					.limit(1);

				if (assignedPerson) {
					assigned.push({
						personnelId: assignedPerson.id,
						name: `${assignedPerson.firstName} ${assignedPerson.lastName}`,
						matchScore: position.matchScore ?? 0,
					});
					assignedCount++;
				}
			}

			const headcount = position.headcount ?? 1;
			totalHeadcount += headcount;

			let status: string;
			if (assigned.length >= headcount) {
				status = "assigned";
			} else if (assigned.length > 0) {
				status = "partial";
			} else {
				status = "open";
			}

			matrixPositions.push({
				id: position.id,
				title: position.positionTitle,
				laborCategory: position.laborCategory ?? "Unspecified",
				headcount,
				assigned,
				status,
			});
		}

		const openCount = totalHeadcount - assignedCount;
		const fillRate = totalHeadcount > 0 ? Math.round((assignedCount / totalHeadcount) * 100) : 0;

		return {
			success: true,
			data: {
				positions: matrixPositions,
				summary: {
					totalPositions: positions.length,
					totalHeadcount,
					assignedCount,
					openCount,
					fillRate,
				},
			},
		};
	} catch (error) {
		logger.error("Failed to generate staffing matrix:", error);
		return { success: false, error: "Failed to generate staffing matrix" };
	}
}

// ============================================================================
// Skills Taxonomy
// ============================================================================

/**
 * Search skills taxonomy
 */
export async function searchSkills(
	query: string,
	category?: string
): Promise<ActionResult<Array<{ id: string; name: string; category: string }>>> {
	await requireCurrentUserId();

	try {
		const conditions = [eq(skillsTaxonomy.isActive, true)];

		if (query && query.trim().length > 0) {
			const searchCondition = or(
				ilike(skillsTaxonomy.name, `%${query}%`),
				sql`${skillsTaxonomy.synonyms}::text ILIKE ${`%${query}%`}`
			);
			if (searchCondition) {
				conditions.push(searchCondition);
			}
		}

		if (category) {
			conditions.push(eq(skillsTaxonomy.category, category));
		}

		const skills = await db
			.select({
				id: skillsTaxonomy.id,
				name: skillsTaxonomy.name,
				category: skillsTaxonomy.category,
			})
			.from(skillsTaxonomy)
			.where(and(...conditions))
			.orderBy(desc(skillsTaxonomy.usageCount))
			.limit(20);

		return { success: true, data: skills };
	} catch (error) {
		logger.error("Failed to search skills:", error);
		return { success: false, error: "Failed to search skills" };
	}
}

/**
 * Get skill suggestions based on job title
 */
export async function suggestSkillsForTitle(
	title: string
): Promise<ActionResult<string[]>> {
	await requireCurrentUserId();

	try {
		const titleLower = title.toLowerCase();

		// Common title-to-skill mappings
		const skillMappings: Record<string, string[]> = {
			"software engineer": ["JavaScript", "Python", "Java", "Git", "Agile"],
			"project manager": ["Project Management", "Agile", "Risk Management", "Stakeholder Management", "MS Project"],
			"data scientist": ["Python", "Machine Learning", "SQL", "Statistics", "TensorFlow"],
			"systems architect": ["Cloud Architecture", "AWS", "System Design", "Security", "Enterprise Architecture"],
			"business analyst": ["Requirements Analysis", "SQL", "Business Process", "Stakeholder Management", "Documentation"],
		};

		// Find matching title
		for (const [key, skills] of Object.entries(skillMappings)) {
			if (titleLower.includes(key)) {
				return { success: true, data: skills };
			}
		}

		// Default suggestions based on common technical skills
		return {
			success: true,
			data: ["Communication", "Problem Solving", "Team Leadership", "Technical Writing", "Project Management"],
		};
	} catch (error) {
		logger.error("Failed to suggest skills:", error);
		return { success: false, error: "Failed to suggest skills" };
	}
}

// ============================================================================
// Position Requirements
// ============================================================================

/**
 * Create a position requirement
 */
export async function createPosition(
	data: z.infer<typeof PositionSchema>
): Promise<ActionResult<{ id: string }>> {
	await requireCurrentUserId();

	try {
		const validated = PositionSchema.parse(data);

		const positionData: NewPositionRequirement = {
			opportunityId: validated.opportunityId,
			positionTitle: validated.positionTitle,
			positionCategory: validated.positionCategory,
			laborCategory: validated.laborCategory,
			positionNumber: validated.positionNumber,
			headcount: validated.headcount,
			requiredExperience: validated.requiredExperience,
			preferredExperience: validated.preferredExperience,
			requiredClearance: validated.requiredClearance,
			requiredEducation: validated.requiredEducation,
			minimumEducation: validated.minimumEducation,
			preferredEducation: validated.preferredEducation,
			description: validated.description,
			responsibilities: validated.responsibilities ?? [],
			requiredSkills: validated.requiredSkills ?? [],
			requiredCertifications: validated.requiredCertifications ?? [],
			preferredCertifications: validated.preferredCertifications ?? [],
			startDate: validated.startDate,
			endDate: validated.endDate,
			duration: validated.duration,
			hoursPerWeek: validated.hoursPerWeek,
			locationRequired: validated.locationRequired,
			remoteAllowed: validated.remoteAllowed,
			assignmentStatus: "open",
		};

		const [inserted] = await db
			.insert(positionRequirements)
			.values(positionData)
			.returning({ id: positionRequirements.id });

		revalidatePath("/staffing");

		return { success: true, data: { id: inserted.id } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to create position:", error);
		return { success: false, error: "Failed to create position" };
	}
}

/**
 * Get positions for an opportunity
 */
export async function getPositionsForOpportunity(
	opportunityId: string
): Promise<ActionResult<Array<{
	id: string;
	positionTitle: string;
	laborCategory: string | null;
	headcount: number;
	requiredClearance: string | null;
	assignmentStatus: string;
	assignedPersonnel: { id: string; name: string } | null;
	matchScore: number | null;
}>>> {
	const userId = await requireCurrentUserId();

	try {
		const positions = await db
			.select()
			.from(positionRequirements)
			.where(positionRequirementsByOpportunityCondition(opportunityId, userId))
			.orderBy(asc(positionRequirements.positionTitle));

		const results = [];

		for (const position of positions) {
			let assignedPersonnel: { id: string; name: string } | null = null;

			if (position.assignedPersonnelId) {
				const [person] = await db
					.select()
					.from(personnel)
					.where(eq(personnel.id, position.assignedPersonnelId))
					.limit(1);

				if (person) {
					assignedPersonnel = {
						id: person.id,
						name: `${person.firstName} ${person.lastName}`,
					};
				}
			}

			results.push({
				id: position.id,
				positionTitle: position.positionTitle,
				laborCategory: position.laborCategory,
				headcount: position.headcount ?? 1,
				requiredClearance: position.requiredClearance,
				assignmentStatus: position.assignmentStatus ?? "open",
				assignedPersonnel,
				matchScore: position.matchScore,
			});
		}

		return { success: true, data: results };
	} catch (error) {
		logger.error("Failed to get positions:", error);
		return { success: false, error: "Failed to get positions" };
	}
}

/**
 * Update position requirement
 */
export async function updatePosition(
	id: string,
	data: Partial<z.infer<typeof PositionSchema>>
): Promise<ActionResult<void>> {
	await requireCurrentUserId();

	try {
		const validated = PositionSchema.partial().parse(data);

		const updateData: Partial<NewPositionRequirement> = {
			updatedAt: new Date(),
		};

		if (validated.positionTitle !== undefined) updateData.positionTitle = validated.positionTitle;
		if (validated.positionCategory !== undefined) updateData.positionCategory = validated.positionCategory;
		if (validated.laborCategory !== undefined) updateData.laborCategory = validated.laborCategory;
		if (validated.positionNumber !== undefined) updateData.positionNumber = validated.positionNumber;
		if (validated.headcount !== undefined) updateData.headcount = validated.headcount;
		if (validated.requiredExperience !== undefined) updateData.requiredExperience = validated.requiredExperience;
		if (validated.preferredExperience !== undefined) updateData.preferredExperience = validated.preferredExperience;
		if (validated.requiredClearance !== undefined) updateData.requiredClearance = validated.requiredClearance;
		if (validated.requiredEducation !== undefined) updateData.requiredEducation = validated.requiredEducation;
		if (validated.minimumEducation !== undefined) updateData.minimumEducation = validated.minimumEducation;
		if (validated.preferredEducation !== undefined) updateData.preferredEducation = validated.preferredEducation;
		if (validated.description !== undefined) updateData.description = validated.description;
		if (validated.responsibilities !== undefined) updateData.responsibilities = validated.responsibilities;
		if (validated.requiredSkills !== undefined) updateData.requiredSkills = validated.requiredSkills;
		if (validated.requiredCertifications !== undefined) updateData.requiredCertifications = validated.requiredCertifications;
		if (validated.preferredCertifications !== undefined) updateData.preferredCertifications = validated.preferredCertifications;
		if (validated.startDate !== undefined) updateData.startDate = validated.startDate;
		if (validated.endDate !== undefined) updateData.endDate = validated.endDate;
		if (validated.duration !== undefined) updateData.duration = validated.duration;
		if (validated.hoursPerWeek !== undefined) updateData.hoursPerWeek = validated.hoursPerWeek;
		if (validated.locationRequired !== undefined) updateData.locationRequired = validated.locationRequired;
		if (validated.remoteAllowed !== undefined) updateData.remoteAllowed = validated.remoteAllowed;

		const result = await db
			.update(positionRequirements)
			.set(updateData)
			.where(eq(positionRequirements.id, id))
			.returning({ id: positionRequirements.id });

		if (result.length === 0) {
			return { success: false, error: "Position not found" };
		}

		revalidatePath("/staffing");
		revalidatePath(`/positions/${id}`);

		return { success: true };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update position:", error);
		return { success: false, error: "Failed to update position" };
	}
}

/**
 * Delete position requirement
 */
export async function deletePosition(
	id: string
): Promise<ActionResult<void>> {
	await requireCurrentUserId();

	try {
		const result = await db
			.delete(positionRequirements)
			.where(eq(positionRequirements.id, id))
			.returning({ id: positionRequirements.id });

		if (result.length === 0) {
			return { success: false, error: "Position not found" };
		}

		revalidatePath("/staffing");

		return { success: true };
	} catch (error) {
		logger.error("Failed to delete position:", error);
		return { success: false, error: "Failed to delete position" };
	}
}
