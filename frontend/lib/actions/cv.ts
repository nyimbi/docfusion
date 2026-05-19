/**
 * CV Server Actions - DocFusion
 *
 * Server actions for managing CVs and team member resumes.
 */

"use server";

import { db } from "@/lib/db";
import { cvs, type CVRow } from "@/lib/db/schema";
import { eq, and, ilike, desc } from "drizzle-orm";
import type {
	CV,
	CreateCVInput,
	UpdateCVInput,
	CVFilters,
} from "@/lib/types/company";
import { getCurrentUserId } from "@/lib/auth-utils";

// ============================================================================
// Configuration
// ============================================================================

/** Organization ID for Datacraft */
const ORGANIZATION_ID = "datacraft";

async function requireCVActor(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

// ============================================================================
// CV CRUD
// ============================================================================

/**
 * Get all CVs with optional filtering.
 */
export async function getCVs(filters?: CVFilters): Promise<CV[]> {
	const conditions = [eq(cvs.organizationId, ORGANIZATION_ID)];

	if (filters?.search) {
		conditions.push(
			ilike(cvs.fullName, `%${filters.search}%`)
		);
	}

	if (filters?.isActive !== undefined) {
		conditions.push(eq(cvs.isActive, filters.isActive));
	}

	const rows = await db
		.select()
		.from(cvs)
		.where(and(...conditions))
		.orderBy(cvs.fullName);

	return rows.map(transformCV);
}

/**
 * Get a CV by ID.
 */
export async function getCV(id: string): Promise<CV | null> {
	const [row] = await db
		.select()
		.from(cvs)
		.where(eq(cvs.id, id));

	return row ? transformCV(row) : null;
}

/**
 * Get the active CV for a user.
 */
export async function getUserCV(userId: string): Promise<CV | null> {
	const [row] = await db
		.select()
		.from(cvs)
		.where(
			and(
				eq(cvs.userId, userId),
				eq(cvs.organizationId, ORGANIZATION_ID),
				eq(cvs.isActive, true)
			)
		)
		.orderBy(desc(cvs.version))
		.limit(1);

	return row ? transformCV(row) : null;
}

/**
 * Create a new CV.
 */
export async function createCV(input: CreateCVInput): Promise<CV> {
	const actorId = await requireCVActor();
	const [row] = await db
		.insert(cvs)
		.values({
			organizationId: ORGANIZATION_ID,
			userId: actorId,
			fullName: input.fullName,
			title: input.title ?? null,
			summary: input.summary ?? null,
			experience: input.experience ?? [],
			education: input.education ?? [],
			skills: input.skills ?? [],
			certifications: input.certifications ?? [],
			projects: input.projects ?? [],
			languages: input.languages ?? [],
			publications: input.publications ?? [],
			email: input.email ?? null,
			phone: input.phone ?? null,
			linkedinUrl: input.linkedinUrl ?? null,
			portfolioUrl: input.portfolioUrl ?? null,
			version: 1,
			isActive: true,
		})
		.returning();

	return transformCV(row);
}

/**
 * Update a CV.
 */
export async function updateCV(id: string, input: UpdateCVInput): Promise<CV> {
	const actorId = await requireCVActor();
	const updateData: Partial<CVRow> = {
		updatedAt: new Date(),
	};

	if (input.fullName !== undefined) updateData.fullName = input.fullName;
	if (input.title !== undefined) updateData.title = input.title;
	if (input.summary !== undefined) updateData.summary = input.summary;
	if (input.experience !== undefined) updateData.experience = input.experience;
	if (input.education !== undefined) updateData.education = input.education;
	if (input.skills !== undefined) updateData.skills = input.skills;
	if (input.certifications !== undefined) updateData.certifications = input.certifications;
	if (input.projects !== undefined) updateData.projects = input.projects;
	if (input.languages !== undefined) updateData.languages = input.languages;
	if (input.publications !== undefined) updateData.publications = input.publications;
	if (input.email !== undefined) updateData.email = input.email;
	if (input.phone !== undefined) updateData.phone = input.phone;
	if (input.linkedinUrl !== undefined) updateData.linkedinUrl = input.linkedinUrl;
	if (input.portfolioUrl !== undefined) updateData.portfolioUrl = input.portfolioUrl;

	const [row] = await db
		.update(cvs)
		.set(updateData)
		.where(and(eq(cvs.id, id), eq(cvs.userId, actorId), eq(cvs.organizationId, ORGANIZATION_ID)))
		.returning();

	if (!row) {
		throw new Error(`CV ${id} not found`);
	}

	return transformCV(row);
}

/**
 * Create a new version of a CV.
 */
export async function createCVVersion(id: string, _userId?: string): Promise<CV> {
	const actorId = await requireCVActor();
	const [existingRow] = await db
		.select()
		.from(cvs)
		.where(and(eq(cvs.id, id), eq(cvs.userId, actorId), eq(cvs.organizationId, ORGANIZATION_ID)))
		.limit(1);

	if (!existingRow) {
		throw new Error(`CV ${id} not found`);
	}

	const existing = transformCV(existingRow);

	// Deactivate the current version
	await db
		.update(cvs)
		.set({ isActive: false, updatedAt: new Date() })
		.where(and(eq(cvs.id, id), eq(cvs.userId, actorId), eq(cvs.organizationId, ORGANIZATION_ID)));

	// Create new version
	const [row] = await db
		.insert(cvs)
		.values({
			organizationId: ORGANIZATION_ID,
			userId: actorId,
			fullName: existing.fullName,
			title: existing.title,
			summary: existing.summary,
			experience: existing.experience,
			education: existing.education,
			skills: existing.skills,
			certifications: existing.certifications,
			projects: existing.projects,
			languages: existing.languages,
			publications: existing.publications,
			email: existing.email,
			phone: existing.phone,
			linkedinUrl: existing.linkedinUrl,
			portfolioUrl: existing.portfolioUrl,
			version: existing.version + 1,
			isActive: true,
		})
		.returning();

	return transformCV(row);
}

/**
 * Delete a CV.
 */
export async function deleteCV(id: string): Promise<void> {
	const actorId = await requireCVActor();
	await db
		.delete(cvs)
		.where(and(eq(cvs.id, id), eq(cvs.userId, actorId), eq(cvs.organizationId, ORGANIZATION_ID)));
}

/**
 * Get CV versions for a user.
 */
export async function getCVVersions(userId: string): Promise<CV[]> {
	const rows = await db
		.select()
		.from(cvs)
		.where(and(eq(cvs.userId, userId), eq(cvs.organizationId, ORGANIZATION_ID)))
		.orderBy(desc(cvs.version));

	return rows.map(transformCV);
}

// ============================================================================
// Transformers
// ============================================================================

function transformCV(row: CVRow): CV {
	return {
		id: row.id,
		userId: row.userId ?? null,
		organizationId: row.organizationId,
		fullName: row.fullName,
		title: row.title,
		summary: row.summary,
		experience: (row.experience ?? []) as CV["experience"],
		education: (row.education ?? []) as CV["education"],
		skills: (row.skills ?? []) as CV["skills"],
		certifications: (row.certifications ?? []) as CV["certifications"],
		projects: (row.projects ?? []) as CV["projects"],
		languages: (row.languages ?? []) as CV["languages"],
		publications: (row.publications ?? []) as CV["publications"],
		email: row.email,
		phone: row.phone,
		linkedinUrl: row.linkedinUrl,
		portfolioUrl: row.portfolioUrl,
		version: row.version,
		isActive: row.isActive,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
