/**
 * Base Repository - DocFusion
 *
 * Abstract data access layer encapsulating Drizzle ORM queries behind a
 * testable interface. Concrete repositories extend this class to add
 * domain-specific query methods while inheriting standard CRUD operations.
 *
 * Design decisions:
 * - The `db` accessor is a protected getter so subclasses (and test doubles)
 *   can override the database instance without constructor gymnastics.
 * - Generic parameters mirror Drizzle's inferred select/insert types so the
 *   repository surface stays type-safe end-to-end.
 * - All methods return plain data objects, never Drizzle query builders,
 *   keeping the query boundary inside the repository.
 */

import { db as defaultDb } from "@/lib/db";
import { SQL, and, eq, desc, asc, count, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * Pagination and ordering options for multi-row queries.
 */
export interface FindManyOptions {
	orderBy?: SQL;
	limit?: number;
	offset?: number;
}

/**
 * Standard paginated response envelope reusable across domains.
 */
export interface PaginatedResult<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

/**
 * Abstract base providing CRUD primitives for a single Drizzle table.
 *
 * @typeParam TTable  - The Drizzle `pgTable` definition
 * @typeParam TSelect - Row type returned by SELECT (inferred via `$inferSelect`)
 * @typeParam TInsert - Row type accepted by INSERT (inferred via `$inferInsert`)
 */
export abstract class BaseRepository<
	TTable extends PgTable,
	TSelect,
	TInsert,
> {
	constructor(protected table: TTable) {}

	/**
	 * Database instance accessor. Override in tests to inject a mock/stub.
	 */
	protected get db() {
		return defaultDb;
	}

	// ────────────────────────────────────────────────────────────────────────
	// Read
	// ────────────────────────────────────────────────────────────────────────

	/**
	 * Retrieve a single row by its `id` column.
	 * Returns `null` when the row does not exist rather than throwing.
	 */
	async findById(id: string): Promise<TSelect | null> {
		const results = await this.db
			.select()
			.from(this.table)
			.where(eq((this.table as any).id, id))
			.limit(1);
		return (results[0] as TSelect) ?? null;
	}

	/**
	 * Retrieve multiple rows matching an optional set of conditions.
	 *
	 * @param conditions - Array of SQL predicates combined with AND
	 * @param options    - Ordering, limit, and offset
	 */
	async findMany(
		conditions?: SQL[],
		options?: FindManyOptions,
	): Promise<TSelect[]> {
		let query = this.db.select().from(this.table);

		if (conditions?.length) {
			query = query.where(and(...conditions)) as any;
		}
		if (options?.orderBy) {
			query = (query as any).orderBy(options.orderBy);
		}
		if (options?.limit) {
			query = (query as any).limit(options.limit);
		}
		if (options?.offset) {
			query = (query as any).offset(options.offset);
		}

		return query as unknown as Promise<TSelect[]>;
	}

	// ────────────────────────────────────────────────────────────────────────
	// Write
	// ────────────────────────────────────────────────────────────────────────

	/**
	 * Insert a single row and return the created record.
	 */
	async create(data: TInsert): Promise<TSelect> {
		const results = await this.db
			.insert(this.table)
			.values(data as any)
			.returning();
		return results[0] as TSelect;
	}

	/**
	 * Update a row by `id` and return the updated record.
	 * Throws if the row does not exist (prevents silent no-ops).
	 */
	async update(id: string, data: Partial<TInsert>): Promise<TSelect> {
		const results = await this.db
			.update(this.table)
			.set(data as any)
			.where(eq((this.table as any).id, id))
			.returning();
		if (!results.length) {
			throw new Error(`Record not found: ${id}`);
		}
		return results[0] as TSelect;
	}

	/**
	 * Delete a row by `id`. Returns `true` when a row was actually removed.
	 */
	async delete(id: string): Promise<boolean> {
		const result = await this.db
			.delete(this.table)
			.where(eq((this.table as any).id, id));
		return (result as any).rowCount > 0;
	}

	// ────────────────────────────────────────────────────────────────────────
	// Aggregation
	// ────────────────────────────────────────────────────────────────────────

	/**
	 * Count rows matching an optional set of conditions.
	 */
	async count(conditions?: SQL[]): Promise<number> {
		let query = this.db.select({ count: count() }).from(this.table);

		if (conditions?.length) {
			query = query.where(and(...conditions)) as any;
		}

		const result = await query;
		return Number(result[0]?.count ?? 0);
	}

	// ────────────────────────────────────────────────────────────────────────
	// Helpers
	// ────────────────────────────────────────────────────────────────────────

	/**
	 * Build a standard paginated result envelope.
	 */
	protected buildPaginatedResult<T>(
		data: T[],
		total: number,
		page: number,
		pageSize: number,
	): PaginatedResult<T> {
		return {
			data,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize),
		};
	}
}
