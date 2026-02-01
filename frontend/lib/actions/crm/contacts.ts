"use server";

/**
 * CRM Contact Server Actions
 *
 * CRUD operations for managing contacts (individual people).
 * Includes relationship management, communication preferences,
 * bulk import functionality, and privacy/sharing controls.
 *
 * Privacy Model:
 * - Each contact has an ownerId (the user who created/uploaded it)
 * - visibility can be: "private", "shared", or "organization"
 * - "private": Only the owner can see/edit
 * - "shared": Owner + users in sharedWith array can see/edit
 * - "organization": All users in the organization can see/edit
 *
 * All read operations respect these visibility rules.
 */

import { db } from "@/lib/db";
import { contacts, accounts, activities, crmDocuments, contactImports } from "@/lib/db/schema-crm";
import { eq, and, or, gte, lte, ilike, inArray, desc, asc, sql, count, isNull, isNotNull, type SQL } from "drizzle-orm";
import type { ContactImportRow } from "@/lib/db/schema-crm";
import type {
	ContactFilters,
	Pagination,
	PaginatedResponse,
	CreateContactInput,
	UpdateContactInput,
	ImportContactInput,
	ImportResult,
	ContactWithRelations,
} from "@/lib/types/crm";
import type { ContactRow, NewContact, AccountRow } from "@/lib/db/schema-crm";

// ============================================================================
// TYPES FOR PRIVACY/SHARING
// ============================================================================

export type ContactVisibility = "private" | "shared" | "organization";

export interface UserContext {
	userId: string;
	organizationId?: string;
}

export interface ShareContactInput {
	contactId: string;
	userIds: string[];
}

export interface ChangeVisibilityInput {
	contactId: string;
	visibility: ContactVisibility;
	sharedWith?: string[];
}

// ============================================================================
// VISIBILITY HELPERS
// ============================================================================

/**
 * Build SQL condition for contact visibility filtering.
 * Returns contacts where:
 * - User is the owner, OR
 * - Visibility is "shared" AND user is in sharedWith array, OR
 * - Visibility is "organization" AND contact belongs to user's organization
 */
function buildVisibilityCondition(userContext: UserContext): SQL<unknown> | undefined {
	const { userId, organizationId } = userContext;

	const conditions: SQL<unknown>[] = [
		// Owner can always see their contacts
		eq(contacts.ownerId, userId),
	];

	// Can see contacts shared with them
	conditions.push(
		and(
			eq(contacts.visibility, "shared"),
			sql`${contacts.sharedWith}::jsonb ? ${userId}`
		) as SQL<unknown>
	);

	// Can see organization-wide contacts if in same org
	if (organizationId) {
		conditions.push(
			and(
				eq(contacts.visibility, "organization"),
				eq(contacts.organizationId, organizationId)
			) as SQL<unknown>
		);
	}

	return or(...conditions);
}

/**
 * Check if a user can access a specific contact.
 */
async function canUserAccessContact(
	contactId: string,
	userContext: UserContext
): Promise<{ canAccess: boolean; isOwner: boolean; contact: ContactRow | null }> {
	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, contactId),
	});

	if (!contact) {
		return { canAccess: false, isOwner: false, contact: null };
	}

	const isOwner = contact.ownerId === userContext.userId;

	// Owner always has access
	if (isOwner) {
		return { canAccess: true, isOwner: true, contact };
	}

	// Check shared visibility
	if (contact.visibility === "shared") {
		const sharedWith = (contact.sharedWith as string[]) ?? [];
		if (sharedWith.includes(userContext.userId)) {
			return { canAccess: true, isOwner: false, contact };
		}
	}

	// Check organization visibility
	if (contact.visibility === "organization") {
		if (userContext.organizationId && contact.organizationId === userContext.organizationId) {
			return { canAccess: true, isOwner: false, contact };
		}
	}

	return { canAccess: false, isOwner: false, contact };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new contact.
 *
 * @param input - Contact data
 * @param userContext - Current user context (required for ownership)
 * @param visibility - Contact visibility setting (default: "private")
 * @param sharedWith - User IDs to share with (when visibility is "shared")
 */
export async function createContact(
	input: CreateContactInput,
	userContext: UserContext,
	visibility: ContactVisibility = "private",
	sharedWith: string[] = []
): Promise<ContactRow> {
	const now = new Date();

	// Compute full name if not provided
	const fullName = input.fullName ?? `${input.firstName} ${input.lastName}`.trim();

	const newContact: NewContact = {
		accountId: input.accountId,
		firstName: input.firstName,
		lastName: input.lastName,
		fullName,
		salutation: input.salutation,
		title: input.title,
		department: input.department,
		role: input.role,
		seniority: input.seniority,
		email: input.email,
		emailSecondary: input.emailSecondary,
		phone: input.phone,
		phoneMobile: input.phoneMobile,
		phoneWork: input.phoneWork,
		linkedinUrl: input.linkedinUrl,
		country: input.country,
		city: input.city,
		timezone: input.timezone,
		preferredLanguage: input.preferredLanguage ?? "en",
		preferredContactMethod: input.preferredContactMethod,
		bestTimeToContact: input.bestTimeToContact,
		doNotContact: input.doNotContact ?? false,
		doNotEmail: input.doNotEmail ?? false,
		doNotCall: input.doNotCall ?? false,
		isPrimaryContact: input.isPrimaryContact ?? false,
		relationshipStrength: input.relationshipStrength,
		influence: input.influence,
		sentiment: input.sentiment,
		notes: input.notes,
		tags: input.tags ?? [],
		// Privacy fields
		ownerId: userContext.userId,
		visibility,
		sharedWith: visibility === "shared" ? sharedWith : [],
		organizationId: userContext.organizationId,
		// Audit
		createdBy: userContext.userId,
		createdAt: now,
		updatedAt: now,
	};

	const result = await db.insert(contacts).values(newContact).returning();
	const created = result[0];

	// If this is marked as primary contact, unset other primary contacts for the account
	if (input.isPrimaryContact && input.accountId) {
		await db
			.update(contacts)
			.set({ isPrimaryContact: false, updatedAt: now })
			.where(
				and(
					eq(contacts.accountId, input.accountId),
					eq(contacts.isPrimaryContact, true),
					sql`${contacts.id} != ${created.id}`
				)
			);
	}

	return created;
}

/**
 * Legacy createContact for backward compatibility.
 * Creates a private contact owned by the userId.
 *
 * @deprecated Use createContact with UserContext instead
 */
export async function createContactLegacy(
	input: CreateContactInput,
	userId?: string
): Promise<ContactRow> {
	if (!userId) {
		throw new Error("userId is required to create a contact");
	}
	return createContact(input, { userId }, "private", []);
}

/**
 * Update an existing contact.
 *
 * Only the owner or users with access can update a contact.
 */
export async function updateContact(
	id: string,
	input: UpdateContactInput,
	userContext: UserContext
): Promise<ContactRow | null> {
	// Check access
	const { canAccess, contact: existing } = await canUserAccessContact(id, userContext);

	if (!existing) {
		return null;
	}

	if (!canAccess) {
		throw new Error("You do not have permission to update this contact");
	}

	// Recompute full name if first or last name changed
	let fullName = input.fullName;
	if (!fullName && (input.firstName || input.lastName)) {
		const firstName = input.firstName ?? existing.firstName;
		const lastName = input.lastName ?? existing.lastName;
		fullName = `${firstName} ${lastName}`.trim();
	}

	const now = new Date();

	const [updated] = await db
		.update(contacts)
		.set({
			...input,
			fullName: fullName ?? existing.fullName,
			updatedAt: now,
		})
		.where(eq(contacts.id, id))
		.returning();

	// Handle primary contact toggle
	if (input.isPrimaryContact === true && existing.accountId) {
		await db
			.update(contacts)
			.set({ isPrimaryContact: false, updatedAt: now })
			.where(
				and(
					eq(contacts.accountId, existing.accountId),
					eq(contacts.isPrimaryContact, true),
					sql`${contacts.id} != ${id}`
				)
			);
	}

	return updated;
}

/**
 * Legacy updateContact for backward compatibility.
 * @deprecated Use updateContact with UserContext instead
 */
export async function updateContactLegacy(
	id: string,
	input: UpdateContactInput,
	userId?: string
): Promise<ContactRow | null> {
	if (!userId) {
		throw new Error("userId is required to update a contact");
	}
	return updateContact(id, input, { userId });
}

/**
 * Delete a contact.
 *
 * Only the owner can delete a contact.
 */
export async function deleteContact(
	id: string,
	userContext: UserContext
): Promise<boolean> {
	// Check ownership - only owner can delete
	const { isOwner, contact } = await canUserAccessContact(id, userContext);

	if (!contact) {
		return false;
	}

	if (!isOwner) {
		throw new Error("Only the owner can delete a contact");
	}

	const result = await db.delete(contacts).where(eq(contacts.id, id));
	return (result.rowCount ?? 0) > 0;
}

/**
 * Legacy deleteContact for backward compatibility.
 * @deprecated Use deleteContact with UserContext instead
 */
export async function deleteContactLegacy(
	id: string,
	userId?: string
): Promise<boolean> {
	if (!userId) {
		throw new Error("userId is required to delete a contact");
	}
	return deleteContact(id, { userId });
}

/**
 * Get a single contact by ID.
 *
 * Respects visibility rules - returns null if user doesn't have access.
 */
export async function getContact(
	id: string,
	userContext: UserContext
): Promise<ContactRow | null> {
	const { canAccess, contact } = await canUserAccessContact(id, userContext);

	if (!canAccess || !contact) {
		return null;
	}

	return contact;
}

/**
 * Get a single contact by ID without visibility check.
 * Use only for internal operations where access has already been verified.
 */
export async function getContactInternal(id: string): Promise<ContactRow | null> {
	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, id),
	});
	return contact ?? null;
}

/**
 * Get contact with related entities.
 *
 * Respects visibility rules - returns null if user doesn't have access.
 */
export async function getContactWithRelations(
	id: string,
	userContext: UserContext
): Promise<ContactWithRelations | null> {
	// First check access
	const { canAccess } = await canUserAccessContact(id, userContext);

	if (!canAccess) {
		return null;
	}

	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, id),
		with: {
			account: true,
			documents: {
				limit: 20,
				orderBy: desc(crmDocuments.createdAt),
			},
		},
	});

	if (!contact) return null;

	// Get recent activities
	const recentActivities = await db.query.activities.findMany({
		where: eq(activities.contactId, id),
		limit: 20,
		orderBy: desc(activities.createdAt),
	});

	return {
		...contact,
		recentActivities,
	};
}

/**
 * Get contacts with filters and pagination.
 *
 * Returns only contacts the user has access to (owned, shared with, or org-wide).
 */
export async function getContacts(
	userContext: UserContext,
	filters?: ContactFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ContactRow>> {
	const filterConditions = buildContactFilterConditions(filters);

	// Add visibility condition
	const visibilityCondition = buildVisibilityCondition(userContext);

	// Combine all conditions
	const allConditions: SQL<unknown>[] = [];
	if (visibilityCondition) {
		allConditions.push(visibilityCondition);
	}
	allConditions.push(...filterConditions);

	const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(contacts)
		.where(whereClause);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(contacts)
		.where(whereClause)
		.orderBy(asc(contacts.lastName), asc(contacts.firstName))
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
 * Get all contacts for a specific account that the user has access to.
 */
export async function getAccountContacts(
	accountId: string,
	userContext: UserContext
): Promise<ContactRow[]> {
	const visibilityCondition = buildVisibilityCondition(userContext);

	const results = await db
		.select()
		.from(contacts)
		.where(
			and(
				eq(contacts.accountId, accountId),
				visibilityCondition
			)
		)
		.orderBy(desc(contacts.isPrimaryContact), asc(contacts.lastName), asc(contacts.firstName));

	return results;
}

/**
 * Get primary contact for an account (if user has access).
 */
export async function getPrimaryContact(
	accountId: string,
	userContext: UserContext
): Promise<ContactRow | null> {
	const visibilityCondition = buildVisibilityCondition(userContext);

	const results = await db
		.select()
		.from(contacts)
		.where(
			and(
				eq(contacts.accountId, accountId),
				eq(contacts.isPrimaryContact, true),
				visibilityCondition
			)
		)
		.limit(1);

	return results[0] ?? null;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Import options for bulk contact import.
 */
export interface ImportOptions {
	visibility?: ContactVisibility;
	sharedWith?: string[];
	updateExisting?: boolean;
}

/**
 * Import contacts in bulk.
 *
 * All imported contacts are owned by the importing user.
 */
export async function importContacts(
	data: ImportContactInput[],
	userContext: UserContext,
	options: ImportOptions = {}
): Promise<ImportResult> {
	const { visibility = "private", sharedWith = [], updateExisting = true } = options;

	const result: ImportResult = {
		success: true,
		totalRecords: data.length,
		importedCount: 0,
		updatedCount: 0,
		skippedCount: 0,
		failedCount: 0,
		errors: [],
	};

	for (let i = 0; i < data.length; i++) {
		const row = data[i];

		try {
			// Validate required fields
			if (!row.firstName || !row.lastName) {
				result.errors.push({
					row: i + 1,
					message: "First name and last name are required",
				});
				result.failedCount++;
				continue;
			}

			// Find or create account if account name provided
			let accountId = row.accountId;
			if (!accountId && row.accountName) {
				const existingAccount = await db.query.accounts.findFirst({
					where: ilike(accounts.name, row.accountName),
					columns: { id: true },
				});

				if (existingAccount) {
					accountId = existingAccount.id;
				} else if (row.accountType) {
					// Create new account
					const [newAccount] = await db
						.insert(accounts)
						.values({
							name: row.accountName,
							type: row.accountType,
							createdBy: userContext.userId,
						})
						.returning({ id: accounts.id });
					accountId = newAccount.id;
				}
			}

			// Check for existing contact by email that the user owns
			let existingContact: ContactRow | undefined;
			if (row.email) {
				existingContact = await db.query.contacts.findFirst({
					where: and(
						eq(contacts.email, row.email),
						eq(contacts.ownerId, userContext.userId)
					),
				});
			}

			if (existingContact && updateExisting) {
				// Update existing contact (only if user owns it)
				await updateContact(existingContact.id, { ...row, accountId }, userContext);
				result.updatedCount++;
			} else if (existingContact && !updateExisting) {
				// Skip if exists and updateExisting is false
				result.skippedCount++;
			} else {
				// Create new contact owned by the importing user
				await createContact({ ...row, accountId }, userContext, visibility, sharedWith);
				result.importedCount++;
			}
		} catch (error) {
			result.errors.push({
				row: i + 1,
				message: error instanceof Error ? error.message : "Unknown error",
			});
			result.failedCount++;
		}
	}

	result.success = result.failedCount === 0;
	return result;
}

/**
 * Bulk update contact tags.
 *
 * Only updates contacts the user has access to.
 */
export async function bulkAddContactTags(
	contactIds: string[],
	tagsToAdd: string[],
	userContext: UserContext
): Promise<number> {
	let updateCount = 0;
	const now = new Date();

	for (const id of contactIds) {
		const { canAccess, contact } = await canUserAccessContact(id, userContext);

		if (canAccess && contact) {
			const existingTags = (contact.tags as string[]) ?? [];
			const newTags = [...new Set([...existingTags, ...tagsToAdd])];

			await db
				.update(contacts)
				.set({ tags: newTags, updatedAt: now })
				.where(eq(contacts.id, id));

			updateCount++;
		}
	}

	return updateCount;
}

/**
 * Bulk delete contacts.
 *
 * Only deletes contacts the user owns.
 */
export async function bulkDeleteContacts(
	contactIds: string[],
	userContext: UserContext
): Promise<number> {
	// Only delete contacts the user owns
	const result = await db
		.delete(contacts)
		.where(
			and(
				inArray(contacts.id, contactIds),
				eq(contacts.ownerId, userContext.userId)
			)
		);
	return result.rowCount ?? 0;
}

/**
 * Move contacts to a different account.
 *
 * Only moves contacts the user has access to.
 */
export async function moveContactsToAccount(
	contactIds: string[],
	newAccountId: string,
	userContext: UserContext
): Promise<number> {
	const visibilityCondition = buildVisibilityCondition(userContext);

	const result = await db
		.update(contacts)
		.set({
			accountId: newAccountId,
			isPrimaryContact: false, // Reset primary status when moving
			updatedAt: new Date(),
		})
		.where(
			and(
				inArray(contacts.id, contactIds),
				visibilityCondition
			)
		);

	return result.rowCount ?? 0;
}

// ============================================================================
// SEARCH AND LOOKUP
// ============================================================================

/**
 * Search contacts by name or email (for autocomplete).
 *
 * Only returns contacts the user has access to.
 */
export async function searchContacts(
	query: string,
	userContext: UserContext,
	accountId?: string,
	limit = 10
): Promise<Pick<ContactRow, "id" | "firstName" | "lastName" | "fullName" | "email" | "title" | "accountId">[]> {
	const searchTerm = `%${query}%`;
	const visibilityCondition = buildVisibilityCondition(userContext);

	const conditions: (SQL<unknown> | undefined)[] = [
		visibilityCondition,
		or(
			ilike(contacts.fullName, searchTerm),
			ilike(contacts.firstName, searchTerm),
			ilike(contacts.lastName, searchTerm),
			ilike(contacts.email, searchTerm)
		),
	];

	if (accountId) {
		conditions.push(eq(contacts.accountId, accountId));
	}

	return db
		.select({
			id: contacts.id,
			firstName: contacts.firstName,
			lastName: contacts.lastName,
			fullName: contacts.fullName,
			email: contacts.email,
			title: contacts.title,
			accountId: contacts.accountId,
		})
		.from(contacts)
		.where(and(...conditions.filter(Boolean) as SQL<unknown>[]))
		.limit(limit)
		.orderBy(contacts.fullName);
}

/**
 * Find contact by email that the user has access to.
 */
export async function findContactByEmail(
	email: string,
	userContext: UserContext
): Promise<ContactRow | null> {
	const visibilityCondition = buildVisibilityCondition(userContext);

	const results = await db
		.select()
		.from(contacts)
		.where(
			and(
				eq(contacts.email, email),
				visibilityCondition
			)
		)
		.limit(1);

	return results[0] ?? null;
}

/**
 * Find contact by email owned by the user (for import deduplication).
 */
export async function findOwnedContactByEmail(
	email: string,
	userId: string
): Promise<ContactRow | null> {
	const contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.email, email),
			eq(contacts.ownerId, userId)
		),
	});
	return contact ?? null;
}

/**
 * Get contacts needing follow-up that the user has access to.
 */
export async function getContactsNeedingFollowup(
	userContext: UserContext,
	daysOverdue = 0
): Promise<ContactRow[]> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

	const visibilityCondition = buildVisibilityCondition(userContext);

	const results = await db
		.select()
		.from(contacts)
		.where(
			and(
				lte(contacts.nextFollowUpDate, cutoffDate),
				eq(contacts.doNotContact, false),
				visibilityCondition
			)
		)
		.orderBy(asc(contacts.nextFollowUpDate))
		.limit(50);

	return results;
}

/**
 * Update contact interaction stats.
 *
 * Only updates if user has access to the contact.
 */
/**
 * Update contact interaction stats.
 *
 * Only updates if user has access to the contact.
 */
export async function recordContactInteraction(
	contactId: string,
	userContext: UserContext,
	interactionDate?: Date
): Promise<void> {
	const { canAccess } = await canUserAccessContact(contactId, userContext);

	if (!canAccess) {
		throw new Error("You do not have access to this contact");
	}

	const now = interactionDate ?? new Date();

	await db
		.update(contacts)
		.set({
			lastContactDate: now,
			totalInteractions: sql`COALESCE(${contacts.totalInteractions}, 0) + 1`,
			updatedAt: now,
		})
		.where(eq(contacts.id, contactId));
}

/**
 * Internal function to record contact interaction without access check.
 * Use only from activities.ts where access is already verified.
 */
export async function recordContactInteractionInternal(
	contactId: string,
	interactionDate?: Date
): Promise<void> {
	const now = interactionDate ?? new Date();

	await db
		.update(contacts)
		.set({
			lastContactDate: now,
			totalInteractions: sql`COALESCE(${contacts.totalInteractions}, 0) + 1`,
			updatedAt: now,
		})
		.where(eq(contacts.id, contactId));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build filter conditions for contact queries.
 */
function buildContactFilterConditions(filters?: ContactFilters) {
	const conditions: SQL<unknown>[] = [];

	if (!filters) return conditions;

	// Account filter - null means standalone (no account), undefined means any
	if (filters.accountId === null) {
		conditions.push(isNull(contacts.accountId));
	} else if (filters.accountId) {
		conditions.push(eq(contacts.accountId, filters.accountId));
	}

	// Role filter
	if (filters.role) {
		if (Array.isArray(filters.role)) {
			conditions.push(inArray(contacts.role, filters.role));
		} else {
			conditions.push(eq(contacts.role, filters.role));
		}
	}

	// Seniority filter
	if (filters.seniority) {
		if (Array.isArray(filters.seniority)) {
			conditions.push(inArray(contacts.seniority, filters.seniority));
		} else {
			conditions.push(eq(contacts.seniority, filters.seniority));
		}
	}

	// Primary contact filter
	if (filters.isPrimaryContact !== undefined) {
		conditions.push(eq(contacts.isPrimaryContact, filters.isPrimaryContact));
	}

	// Relationship strength filter
	if (filters.relationshipStrength) {
		if (Array.isArray(filters.relationshipStrength)) {
			conditions.push(inArray(contacts.relationshipStrength, filters.relationshipStrength));
		} else {
			conditions.push(eq(contacts.relationshipStrength, filters.relationshipStrength));
		}
	}

	// Sentiment filter
	if (filters.sentiment) {
		if (Array.isArray(filters.sentiment)) {
			conditions.push(inArray(contacts.sentiment, filters.sentiment));
		} else {
			conditions.push(eq(contacts.sentiment, filters.sentiment));
		}
	}

	// Do not contact filter
	if (filters.doNotContact !== undefined) {
		conditions.push(eq(contacts.doNotContact, filters.doNotContact));
	}

	// Date filters
	if (filters.lastContactBefore) {
		conditions.push(lte(contacts.lastContactDate, filters.lastContactBefore));
	}
	if (filters.lastContactAfter) {
		conditions.push(gte(contacts.lastContactDate, filters.lastContactAfter));
	}

	// Search filter
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		const searchCondition = or(
			ilike(contacts.fullName, searchTerm),
			ilike(contacts.firstName, searchTerm),
			ilike(contacts.lastName, searchTerm),
			ilike(contacts.email, searchTerm),
			ilike(contacts.title, searchTerm)
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	return conditions;
}

/**
 * Get contact counts by role for an account.
 *
 * Only counts contacts the user has access to.
 */
export async function getContactRoleCounts(
	accountId: string,
	userContext: UserContext
): Promise<{ role: string; count: number }[]> {
	const visibilityCondition = buildVisibilityCondition(userContext);

	const results = await db
		.select({
			role: contacts.role,
			count: count(),
		})
		.from(contacts)
		.where(
			and(
				eq(contacts.accountId, accountId),
				visibilityCondition
			)
		)
		.groupBy(contacts.role);

	return results.map((r) => ({
		role: r.role ?? "unspecified",
		count: r.count,
	}));
}

// ============================================================================
// PEOPLE / STANDALONE CONTACTS
// ============================================================================

/**
 * Get standalone contacts (not linked to any account).
 * These are "People" in the CRM - independent contacts.
 *
 * Only returns contacts the user has access to.
 */
export async function getStandaloneContacts(
	userContext: UserContext,
	filters?: ContactFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ContactRow>> {
	const filterConditions = buildContactFilterConditions(filters);
	const visibilityCondition = buildVisibilityCondition(userContext);

	// Combine all conditions
	const allConditions: SQL<unknown>[] = [isNull(contacts.accountId)];
	if (visibilityCondition) {
		allConditions.push(visibilityCondition);
	}
	allConditions.push(...filterConditions);

	const whereClause = and(...allConditions);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(contacts)
		.where(whereClause);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(contacts)
		.where(whereClause)
		.orderBy(asc(contacts.lastName), asc(contacts.firstName))
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
 * Get contacts linked to accounts (company contacts).
 *
 * Only returns contacts the user has access to.
 */
export async function getLinkedContacts(
	userContext: UserContext,
	filters?: ContactFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ContactRow>> {
	const filterConditions = buildContactFilterConditions(filters);
	const visibilityCondition = buildVisibilityCondition(userContext);

	// Combine all conditions
	const allConditions: SQL<unknown>[] = [isNotNull(contacts.accountId)];
	if (visibilityCondition) {
		allConditions.push(visibilityCondition);
	}
	allConditions.push(...filterConditions);

	const whereClause = and(...allConditions);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(contacts)
		.where(whereClause);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(contacts)
		.where(whereClause)
		.orderBy(asc(contacts.lastName), asc(contacts.firstName))
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
 * Link a standalone contact to an account.
 * Only the owner can link their contact.
 */
export async function linkContactToAccount(
	contactId: string,
	accountId: string,
	userContext: UserContext,
	isPrimary = false
): Promise<ContactRow | null> {
	const { isOwner } = await canUserAccessContact(contactId, userContext);
	if (!isOwner) throw new Error("Only the owner can link a contact to an account");

	const now = new Date();
	if (isPrimary) {
		await db.update(contacts).set({ isPrimaryContact: false, updatedAt: now })
			.where(and(eq(contacts.accountId, accountId), eq(contacts.isPrimaryContact, true)));
	}

	const [updated] = await db.update(contacts)
		.set({ accountId, isPrimaryContact: isPrimary, updatedAt: now })
		.where(eq(contacts.id, contactId)).returning();

	return updated ?? null;
}

/**
 * Unlink a contact from its account. Only the owner can unlink.
 */
export async function unlinkContactFromAccount(
	contactId: string,
	userContext: UserContext
): Promise<ContactRow | null> {
	const { isOwner } = await canUserAccessContact(contactId, userContext);
	if (!isOwner) throw new Error("Only the owner can unlink a contact");

	const [updated] = await db.update(contacts)
		.set({ accountId: null, isPrimaryContact: false, updatedAt: new Date() })
		.where(eq(contacts.id, contactId)).returning();

	return updated ?? null;
}

// ============================================================================
// SHARING & VISIBILITY MANAGEMENT
// ============================================================================

/**
 * Share a contact with specific users. Only owner can share.
 */
export async function shareContact(
	contactId: string,
	userIdsToShare: string[],
	userContext: UserContext
): Promise<ContactRow | null> {
	const { isOwner, contact } = await canUserAccessContact(contactId, userContext);
	if (!isOwner || !contact) throw new Error("Only the owner can share a contact");

	const existingShared = (contact.sharedWith as string[]) ?? [];
	const newShared = [...new Set([...existingShared, ...userIdsToShare])];

	const [updated] = await db.update(contacts)
		.set({ visibility: "shared", sharedWith: newShared, updatedAt: new Date() })
		.where(eq(contacts.id, contactId)).returning();

	return updated ?? null;
}

/**
 * Unshare a contact from specific users. Only owner can unshare.
 */
export async function unshareContact(
	contactId: string,
	userIdsToRemove: string[],
	userContext: UserContext
): Promise<ContactRow | null> {
	const { isOwner, contact } = await canUserAccessContact(contactId, userContext);
	if (!isOwner || !contact) throw new Error("Only the owner can modify sharing");

	const existingShared = (contact.sharedWith as string[]) ?? [];
	const newShared = existingShared.filter(id => !userIdsToRemove.includes(id));

	const [updated] = await db.update(contacts)
		.set({
			sharedWith: newShared,
			visibility: newShared.length === 0 ? "private" : "shared",
			updatedAt: new Date()
		})
		.where(eq(contacts.id, contactId)).returning();

	return updated ?? null;
}

/**
 * Change contact visibility. Only owner can change.
 */
export async function setContactVisibility(
	contactId: string,
	visibility: ContactVisibility,
	userContext: UserContext,
	sharedWith?: string[]
): Promise<ContactRow | null> {
	const { isOwner, contact } = await canUserAccessContact(contactId, userContext);
	if (!isOwner || !contact) throw new Error("Only the owner can change visibility");

	const updates: Partial<ContactRow> = {
		visibility,
		updatedAt: new Date(),
	};

	if (visibility === "shared" && sharedWith) {
		updates.sharedWith = sharedWith;
	} else if (visibility === "private") {
		updates.sharedWith = [];
	}

	if (visibility === "organization" && !contact.organizationId) {
		updates.organizationId = userContext.organizationId;
	}

	const [updated] = await db.update(contacts)
		.set(updates)
		.where(eq(contacts.id, contactId)).returning();

	return updated ?? null;
}

/**
 * Get users a contact is shared with.
 */
export async function getContactSharing(
	contactId: string,
	userContext: UserContext
): Promise<{ visibility: string; sharedWith: string[] } | null> {
	const { canAccess, contact } = await canUserAccessContact(contactId, userContext);
	if (!canAccess || !contact) return null;

	return {
		visibility: contact.visibility,
		sharedWith: (contact.sharedWith as string[]) ?? [],
	};
}

// ============================================================================
// IMPORT TRACKING
// ============================================================================

/**
 * Get contact imports for the current user.
 */
export async function getContactImports(
	userContext: UserContext,
	pagination?: Pagination
): Promise<PaginatedResponse<ContactImportRow>> {
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 20;
	const offset = (page - 1) * pageSize;

	const whereClause = eq(contactImports.importedBy, userContext.userId);

	const [{ total }] = await db.select({ total: count() }).from(contactImports).where(whereClause);

	const results = await db.select().from(contactImports)
		.where(whereClause)
		.orderBy(desc(contactImports.createdAt))
		.limit(pageSize).offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return { data: results, total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 };
}

/**
 * Get a specific contact import (only if user owns it).
 */
export async function getContactImport(id: string, userContext: UserContext): Promise<ContactImportRow | null> {
	const importRecord = await db.query.contactImports.findFirst({
		where: and(eq(contactImports.id, id), eq(contactImports.importedBy, userContext.userId)),
	});
	return importRecord ?? null;
}

/**
 * Delete a contact import record (only if user owns it).
 */
export async function deleteContactImport(id: string, userContext: UserContext): Promise<boolean> {
	const result = await db.delete(contactImports)
		.where(and(eq(contactImports.id, id), eq(contactImports.importedBy, userContext.userId)));
	return (result.rowCount ?? 0) > 0;
}

/**
 * Get import statistics for the current user.
 */
export async function getImportStatsSummary(userContext: UserContext): Promise<{
	totalImports: number;
	totalImported: number;
	totalUpdated: number;
	totalFailed: number;
	recentImports: ContactImportRow[];
}> {
	const whereClause = eq(contactImports.importedBy, userContext.userId);

	const [stats] = await db.select({
		totalImports: count(),
		totalImported: sql<number>`COALESCE(SUM(${contactImports.importedRecords}), 0)`,
		totalUpdated: sql<number>`COALESCE(SUM(${contactImports.updatedRecords}), 0)`,
		totalFailed: sql<number>`COALESCE(SUM(${contactImports.failedRecords}), 0)`,
	}).from(contactImports).where(whereClause);

	const recentImports = await db.select().from(contactImports)
		.where(whereClause).orderBy(desc(contactImports.createdAt)).limit(5);

	return {
		totalImports: stats.totalImports,
		totalImported: Number(stats.totalImported),
		totalUpdated: Number(stats.totalUpdated),
		totalFailed: Number(stats.totalFailed),
		recentImports,
	};
}
