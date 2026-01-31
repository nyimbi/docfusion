"use server";

/**
 * CRM Contact Server Actions
 *
 * CRUD operations for managing contacts (individual people).
 * Includes relationship management, communication preferences,
 * and bulk import functionality.
 */

import { db } from "@/lib/db";
import { contacts, accounts, activities, crmDocuments } from "@/lib/db/schema-crm";
import { eq, and, or, gte, lte, ilike, inArray, desc, asc, sql, count, type SQL } from "drizzle-orm";
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
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new contact.
 */
export async function createContact(
	input: CreateContactInput,
	userId?: string
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
		createdBy: userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(contacts).values(newContact).returning();

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
 * Update an existing contact.
 */
export async function updateContact(
	id: string,
	input: UpdateContactInput,
	userId?: string
): Promise<ContactRow | null> {
	const existing = await db.query.contacts.findFirst({
		where: eq(contacts.id, id),
	});

	if (!existing) {
		return null;
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
 * Delete a contact.
 */
export async function deleteContact(id: string): Promise<boolean> {
	const result = await db.delete(contacts).where(eq(contacts.id, id));
	return (result.rowCount ?? 0) > 0;
}

/**
 * Get a single contact by ID.
 */
export async function getContact(id: string): Promise<ContactRow | null> {
	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, id),
	});
	return contact ?? null;
}

/**
 * Get contact with related entities.
 */
export async function getContactWithRelations(
	id: string
): Promise<ContactWithRelations | null> {
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
 */
export async function getContacts(
	filters?: ContactFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<ContactRow>> {
	const conditions = buildContactFilterConditions(filters);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(contacts)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(contacts)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
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
 * Get all contacts for a specific account.
 */
export async function getAccountContacts(
	accountId: string
): Promise<ContactRow[]> {
	return db.query.contacts.findMany({
		where: eq(contacts.accountId, accountId),
		orderBy: [desc(contacts.isPrimaryContact), asc(contacts.lastName), asc(contacts.firstName)],
	});
}

/**
 * Get primary contact for an account.
 */
export async function getPrimaryContact(
	accountId: string
): Promise<ContactRow | null> {
	const contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.accountId, accountId),
			eq(contacts.isPrimaryContact, true)
		),
	});
	return contact ?? null;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Import contacts in bulk.
 */
export async function importContacts(
	data: ImportContactInput[],
	userId?: string
): Promise<ImportResult> {
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
							createdBy: userId,
						})
						.returning({ id: accounts.id });
					accountId = newAccount.id;
				}
			}

			// Check for existing contact by email
			let existingContact: ContactRow | undefined;
			if (row.email) {
				existingContact = await db.query.contacts.findFirst({
					where: eq(contacts.email, row.email),
				});
			}

			if (existingContact) {
				// Update existing contact
				await updateContact(existingContact.id, { ...row, accountId }, userId);
				result.updatedCount++;
			} else {
				// Create new contact
				await createContact({ ...row, accountId }, userId);
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
 */
export async function bulkAddContactTags(
	contactIds: string[],
	tagsToAdd: string[],
	userId?: string
): Promise<number> {
	let count = 0;
	const now = new Date();

	for (const id of contactIds) {
		const contact = await db.query.contacts.findFirst({
			where: eq(contacts.id, id),
			columns: { tags: true },
		});

		if (contact) {
			const existingTags = (contact.tags as string[]) ?? [];
			const newTags = [...new Set([...existingTags, ...tagsToAdd])];

			await db
				.update(contacts)
				.set({ tags: newTags, updatedAt: now })
				.where(eq(contacts.id, id));

			count++;
		}
	}

	return count;
}

/**
 * Bulk delete contacts.
 */
export async function bulkDeleteContacts(contactIds: string[]): Promise<number> {
	const result = await db.delete(contacts).where(inArray(contacts.id, contactIds));
	return result.rowCount ?? 0;
}

/**
 * Move contacts to a different account.
 */
export async function moveContactsToAccount(
	contactIds: string[],
	newAccountId: string,
	userId?: string
): Promise<number> {
	const result = await db
		.update(contacts)
		.set({
			accountId: newAccountId,
			isPrimaryContact: false, // Reset primary status when moving
			updatedAt: new Date(),
		})
		.where(inArray(contacts.id, contactIds));

	return result.rowCount ?? 0;
}

// ============================================================================
// SEARCH AND LOOKUP
// ============================================================================

/**
 * Search contacts by name or email (for autocomplete).
 */
export async function searchContacts(
	query: string,
	accountId?: string,
	limit = 10
): Promise<Pick<ContactRow, "id" | "firstName" | "lastName" | "fullName" | "email" | "title" | "accountId">[]> {
	const searchTerm = `%${query}%`;
	const conditions = [
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
		.where(and(...conditions))
		.limit(limit)
		.orderBy(contacts.fullName);
}

/**
 * Find contact by email.
 */
export async function findContactByEmail(
	email: string
): Promise<ContactRow | null> {
	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.email, email),
	});
	return contact ?? null;
}

/**
 * Get contacts needing follow-up.
 */
export async function getContactsNeedingFollowup(
	daysOverdue = 0,
	userId?: string
): Promise<ContactRow[]> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

	const conditions = [
		lte(contacts.nextFollowUpDate, cutoffDate),
		eq(contacts.doNotContact, false),
	];

	return db.query.contacts.findMany({
		where: and(...conditions),
		orderBy: asc(contacts.nextFollowUpDate),
		limit: 50,
	});
}

/**
 * Update contact interaction stats.
 */
export async function recordContactInteraction(
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

	// Account filter
	if (filters.accountId) {
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
 */
export async function getContactRoleCounts(
	accountId: string
): Promise<{ role: string; count: number }[]> {
	const results = await db
		.select({
			role: contacts.role,
			count: count(),
		})
		.from(contacts)
		.where(eq(contacts.accountId, accountId))
		.groupBy(contacts.role);

	return results.map((r) => ({
		role: r.role ?? "unspecified",
		count: r.count,
	}));
}
