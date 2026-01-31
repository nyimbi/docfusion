"use server";

/**
 * CRM Document Server Actions
 *
 * CRUD operations for managing CRM documents (files attached to accounts,
 * contacts, deals, and activities).
 */

import { db } from "@/lib/db";
import { crmDocuments, accounts, contacts, deals, activities } from "@/lib/db/schema-crm";
import { eq, and, or, gte, lte, ilike, inArray, desc, asc, sql, count, isNotNull } from "drizzle-orm";
import type {
	CrmDocumentType,
	Pagination,
	PaginatedResponse,
	UploadDocumentInput,
	UpdateDocumentInput,
} from "@/lib/types/crm";
import type { CrmDocumentRow, NewCrmDocument } from "@/lib/db/schema-crm";

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Upload/create a new document.
 */
export async function uploadDocument(
	input: UploadDocumentInput,
	userId?: string
): Promise<CrmDocumentRow> {
	const now = new Date();

	const newDocument: NewCrmDocument = {
		accountId: input.accountId,
		contactId: input.contactId,
		dealId: input.dealId,
		activityId: input.activityId,
		name: input.name,
		type: input.type,
		fileName: input.fileName,
		fileSize: input.fileSize,
		mimeType: input.mimeType,
		storageUrl: input.storageUrl,
		description: input.description,
		version: 1,
		validFrom: input.validFrom,
		validTo: input.validTo,
		issuedBy: input.issuedBy,
		createdBy: userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(crmDocuments).values(newDocument).returning();

	return created;
}

/**
 * Update document metadata.
 */
export async function updateDocument(
	id: string,
	input: UpdateDocumentInput,
	userId?: string
): Promise<CrmDocumentRow | null> {
	const existing = await db.query.crmDocuments.findFirst({
		where: eq(crmDocuments.id, id),
	});

	if (!existing) {
		return null;
	}

	const [updated] = await db
		.update(crmDocuments)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(eq(crmDocuments.id, id))
		.returning();

	return updated;
}

/**
 * Delete a document.
 */
export async function deleteDocument(id: string): Promise<boolean> {
	const result = await db.delete(crmDocuments).where(eq(crmDocuments.id, id));
	return (result.rowCount ?? 0) > 0;
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id: string): Promise<CrmDocumentRow | null> {
	const document = await db.query.crmDocuments.findFirst({
		where: eq(crmDocuments.id, id),
	});
	return document ?? null;
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get documents for an account.
 */
export async function getAccountDocuments(
	accountId: string,
	type?: CrmDocumentType,
	pagination?: Pagination
): Promise<PaginatedResponse<CrmDocumentRow>> {
	const conditions = [eq(crmDocuments.accountId, accountId)];

	if (type) {
		conditions.push(eq(crmDocuments.type, type));
	}

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(crmDocuments)
		.where(and(...conditions));

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(crmDocuments)
		.where(and(...conditions))
		.orderBy(desc(crmDocuments.createdAt))
		.limit(pageSize)
		.offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return {
		data: results,
		total,
		page,
		pageSize,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	};
}

/**
 * Get documents for a contact.
 */
export async function getContactDocuments(
	contactId: string,
	type?: CrmDocumentType
): Promise<CrmDocumentRow[]> {
	const conditions = [eq(crmDocuments.contactId, contactId)];

	if (type) {
		conditions.push(eq(crmDocuments.type, type));
	}

	return db.query.crmDocuments.findMany({
		where: and(...conditions),
		orderBy: desc(crmDocuments.createdAt),
	});
}

/**
 * Get documents for a deal.
 */
export async function getDealDocuments(
	dealId: string,
	type?: CrmDocumentType
): Promise<CrmDocumentRow[]> {
	const conditions = [eq(crmDocuments.dealId, dealId)];

	if (type) {
		conditions.push(eq(crmDocuments.type, type));
	}

	return db.query.crmDocuments.findMany({
		where: and(...conditions),
		orderBy: desc(crmDocuments.createdAt),
	});
}

/**
 * Get documents for an activity.
 */
export async function getActivityDocuments(
	activityId: string
): Promise<CrmDocumentRow[]> {
	return db.query.crmDocuments.findMany({
		where: eq(crmDocuments.activityId, activityId),
		orderBy: desc(crmDocuments.createdAt),
	});
}

/**
 * Get documents expiring within specified days.
 */
export async function getExpiringDocuments(
	days: number
): Promise<CrmDocumentRow[]> {
	const now = new Date();
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + days);

	return db.query.crmDocuments.findMany({
		where: and(
			isNotNull(crmDocuments.validTo),
			gte(crmDocuments.validTo, now),
			lte(crmDocuments.validTo, futureDate)
		),
		orderBy: asc(crmDocuments.validTo),
		limit: 100,
	});
}

/**
 * Get expired documents.
 */
export async function getExpiredDocuments(): Promise<CrmDocumentRow[]> {
	const now = new Date();

	return db.query.crmDocuments.findMany({
		where: and(isNotNull(crmDocuments.validTo), lte(crmDocuments.validTo, now)),
		orderBy: desc(crmDocuments.validTo),
		limit: 100,
	});
}

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

/**
 * Upload a new version of a document.
 */
export async function uploadNewVersion(
	existingDocumentId: string,
	input: Omit<UploadDocumentInput, "accountId" | "contactId" | "dealId" | "activityId">,
	userId?: string
): Promise<CrmDocumentRow | null> {
	const existing = await db.query.crmDocuments.findFirst({
		where: eq(crmDocuments.id, existingDocumentId),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();
	const newVersion = (existing.version ?? 1) + 1;

	const newDocument: NewCrmDocument = {
		accountId: existing.accountId,
		contactId: existing.contactId,
		dealId: existing.dealId,
		activityId: existing.activityId,
		name: input.name ?? existing.name,
		type: input.type ?? existing.type,
		fileName: input.fileName,
		fileSize: input.fileSize,
		mimeType: input.mimeType,
		storageUrl: input.storageUrl,
		description: input.description ?? existing.description,
		version: newVersion,
		previousVersionId: existingDocumentId,
		validFrom: input.validFrom ?? existing.validFrom,
		validTo: input.validTo ?? existing.validTo,
		issuedBy: input.issuedBy ?? existing.issuedBy,
		createdBy: userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(crmDocuments).values(newDocument).returning();

	return created;
}

/**
 * Get document version history.
 */
export async function getDocumentVersionHistory(
	documentId: string
): Promise<CrmDocumentRow[]> {
	const history: CrmDocumentRow[] = [];
	let currentId: string | null = documentId;

	// Walk back through previous versions
	while (currentId) {
		const doc: CrmDocumentRow | undefined = await db.query.crmDocuments.findFirst({
			where: eq(crmDocuments.id, currentId),
		});

		if (doc) {
			history.push(doc);
			currentId = doc.previousVersionId;
		} else {
			break;
		}
	}

	return history;
}

// ============================================================================
// SEARCH AND UTILITIES
// ============================================================================

/**
 * Search documents by name.
 */
export async function searchDocuments(
	query: string,
	entityId?: string,
	entityType?: "account" | "contact" | "deal" | "activity",
	limit = 20
): Promise<CrmDocumentRow[]> {
	const conditions = [ilike(crmDocuments.name, `%${query}%`)];

	if (entityId && entityType) {
		switch (entityType) {
			case "account":
				conditions.push(eq(crmDocuments.accountId, entityId));
				break;
			case "contact":
				conditions.push(eq(crmDocuments.contactId, entityId));
				break;
			case "deal":
				conditions.push(eq(crmDocuments.dealId, entityId));
				break;
			case "activity":
				conditions.push(eq(crmDocuments.activityId, entityId));
				break;
		}
	}

	return db.query.crmDocuments.findMany({
		where: and(...conditions),
		orderBy: desc(crmDocuments.createdAt),
		limit,
	});
}

/**
 * Get document counts by type for an entity.
 */
export async function getDocumentTypeCounts(
	entityId: string,
	entityType: "account" | "contact" | "deal"
): Promise<{ type: string; count: number }[]> {
	let condition;

	switch (entityType) {
		case "account":
			condition = eq(crmDocuments.accountId, entityId);
			break;
		case "contact":
			condition = eq(crmDocuments.contactId, entityId);
			break;
		case "deal":
			condition = eq(crmDocuments.dealId, entityId);
			break;
	}

	const results = await db
		.select({
			type: crmDocuments.type,
			count: count(),
		})
		.from(crmDocuments)
		.where(condition)
		.groupBy(crmDocuments.type);

	return results.map((r) => ({
		type: r.type,
		count: r.count,
	}));
}

/**
 * Get total storage used by an account.
 */
export async function getAccountStorageUsage(
	accountId: string
): Promise<{ totalSize: number; documentCount: number }> {
	const [result] = await db
		.select({
			totalSize: sql<number>`COALESCE(SUM(${crmDocuments.fileSize}), 0)`,
			documentCount: count(),
		})
		.from(crmDocuments)
		.where(eq(crmDocuments.accountId, accountId));

	return {
		totalSize: Number(result.totalSize) || 0,
		documentCount: result.documentCount,
	};
}

/**
 * Bulk delete documents.
 */
export async function bulkDeleteDocuments(
	documentIds: string[]
): Promise<number> {
	const result = await db
		.delete(crmDocuments)
		.where(inArray(crmDocuments.id, documentIds));

	return result.rowCount ?? 0;
}

/**
 * Move document to a different entity.
 */
export async function moveDocument(
	documentId: string,
	newEntityId: string,
	entityType: "account" | "contact" | "deal" | "activity"
): Promise<CrmDocumentRow | null> {
	const updateData: Record<string, string | null> = {
		accountId: null,
		contactId: null,
		dealId: null,
		activityId: null,
	};

	switch (entityType) {
		case "account":
			updateData.accountId = newEntityId;
			break;
		case "contact":
			updateData.contactId = newEntityId;
			break;
		case "deal":
			updateData.dealId = newEntityId;
			break;
		case "activity":
			updateData.activityId = newEntityId;
			break;
	}

	const [updated] = await db
		.update(crmDocuments)
		.set({
			...updateData,
			updatedAt: new Date(),
		})
		.where(eq(crmDocuments.id, documentId))
		.returning();

	return updated;
}

/**
 * Copy document to another entity.
 */
export async function copyDocument(
	documentId: string,
	targetEntityId: string,
	entityType: "account" | "contact" | "deal" | "activity",
	userId?: string
): Promise<CrmDocumentRow | null> {
	const existing = await db.query.crmDocuments.findFirst({
		where: eq(crmDocuments.id, documentId),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();

	const newDocument: NewCrmDocument = {
		accountId: entityType === "account" ? targetEntityId : null,
		contactId: entityType === "contact" ? targetEntityId : null,
		dealId: entityType === "deal" ? targetEntityId : null,
		activityId: entityType === "activity" ? targetEntityId : null,
		name: existing.name,
		type: existing.type,
		fileName: existing.fileName,
		fileSize: existing.fileSize,
		mimeType: existing.mimeType,
		storageUrl: existing.storageUrl,
		description: existing.description,
		version: 1,
		validFrom: existing.validFrom,
		validTo: existing.validTo,
		issuedBy: existing.issuedBy,
		createdBy: userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(crmDocuments).values(newDocument).returning();

	return created;
}
