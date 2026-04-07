/**
 * Mock Drizzle database for testing server actions.
 *
 * Provides chainable query builder mocks that track calls.
 * Mirrors the Drizzle ORM API surface used by DocFusion server actions:
 *   db.select().from(table).where(condition).orderBy(...)
 *   db.insert(table).values(data).returning()
 *   db.update(table).set(data).where(condition).returning()
 *   db.delete(table).where(condition).returning()
 *
 * The mock builder is thenable, matching Drizzle's implicit promise
 * resolution on query chains without an explicit .execute() call.
 */
import { vi } from "vitest";

// ============================================================================
// Types
// ============================================================================

export interface MockQueryBuilder {
	select: ReturnType<typeof vi.fn>;
	from: ReturnType<typeof vi.fn>;
	where: ReturnType<typeof vi.fn>;
	groupBy: ReturnType<typeof vi.fn>;
	orderBy: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
	offset: ReturnType<typeof vi.fn>;
	leftJoin: ReturnType<typeof vi.fn>;
	innerJoin: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	values: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
	returning: ReturnType<typeof vi.fn>;
	execute: ReturnType<typeof vi.fn>;
	onConflictDoNothing: ReturnType<typeof vi.fn>;
	onConflictDoUpdate: ReturnType<typeof vi.fn>;
}

/**
 * Configuration for fine-grained mock behavior.
 * Allows different return values for different terminal operations.
 */
export interface MockDbConfig {
	/** Default data returned by terminal methods (returning, execute, then) */
	returnData?: unknown[];
	/** Override for insert().returning() specifically */
	insertReturn?: unknown[];
	/** Override for update().returning() specifically */
	updateReturn?: unknown[];
	/** Override for delete().returning() specifically */
	deleteReturn?: unknown[];
	/** If true, terminal methods reject instead of resolve */
	shouldReject?: boolean;
	/** Error to reject with when shouldReject is true */
	rejectError?: Error;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a chainable mock Drizzle query builder.
 *
 * Every chain method (select, from, where, ...) returns the builder itself,
 * enabling the natural `db.select().from(t).where(c)` pattern.
 *
 * Terminal methods (returning, execute) resolve with `returnData`.
 * The builder is also thenable so bare `await db.select().from(t)` works.
 *
 * @param configOrData - Array of return data, or a config object for fine control
 *
 * @example
 * ```ts
 * const mockDb = createMockDb([{ id: "1", title: "Test" }]);
 * // Later in test:
 * const result = await mockDb.select().from(opportunities).where(eq(id, "1"));
 * expect(result).toEqual([{ id: "1", title: "Test" }]);
 * expect(mockDb.select).toHaveBeenCalledTimes(1);
 * ```
 */
export function createMockDb(configOrData: unknown[] | MockDbConfig = []): MockQueryBuilder {
	const config: MockDbConfig = Array.isArray(configOrData)
		? { returnData: configOrData }
		: configOrData;

	const returnData = config.returnData ?? [];
	const builder: MockQueryBuilder = {} as MockQueryBuilder;

	// Chain methods - each returns the builder for fluent chaining
	const chainMethods = [
		"select", "from", "where", "groupBy", "orderBy",
		"limit", "offset", "leftJoin", "innerJoin",
		"insert", "values", "update", "set", "delete",
		"onConflictDoNothing", "onConflictDoUpdate",
	] as const;

	for (const method of chainMethods) {
		builder[method] = vi.fn().mockReturnValue(builder);
	}

	// Terminal methods - resolve (or reject) with configured data
	const terminalResult = config.shouldReject
		? Promise.reject(config.rejectError ?? new Error("Mock DB error"))
		: undefined;

	builder.returning = vi.fn().mockImplementation(() => {
		if (terminalResult) return terminalResult;
		return Promise.resolve(
			config.insertReturn ?? config.updateReturn ?? config.deleteReturn ?? returnData
		);
	});

	builder.execute = vi.fn().mockImplementation(() => {
		if (terminalResult) return terminalResult;
		return Promise.resolve(returnData);
	});

	// Make the builder itself thenable - Drizzle queries are awaitable without .execute()
	(builder as any).then = (
		resolve: (value: unknown) => void,
		reject?: (reason: unknown) => void,
	) => {
		if (config.shouldReject) {
			return reject?.(config.rejectError ?? new Error("Mock DB error"));
		}
		return resolve(returnData);
	};

	return builder;
}

/**
 * Create a mock db and register it as the `@/lib/db` module mock.
 *
 * Call this at module scope or in a beforeEach to intercept all
 * `import { db } from "@/lib/db"` references in the module under test.
 *
 * @returns The mock query builder for assertions
 *
 * @example
 * ```ts
 * const mockDb = mockDbModule([{ id: "1", title: "Test Opportunity" }]);
 *
 * // Now any server action that imports `db` from "@/lib/db" will use mockDb
 * const result = await getOpportunities();
 * expect(mockDb.select).toHaveBeenCalled();
 * ```
 */
export function mockDbModule(configOrData: unknown[] | MockDbConfig = []): MockQueryBuilder {
	const mockDb = createMockDb(configOrData);
	vi.mock("@/lib/db", () => ({
		db: mockDb,
	}));
	return mockDb;
}

/**
 * Reset all mock function call history on a mock db builder.
 * Useful in beforeEach to get clean call counts per test.
 */
export function resetMockDb(builder: MockQueryBuilder): void {
	const allMethods = [
		"select", "from", "where", "groupBy", "orderBy",
		"limit", "offset", "leftJoin", "innerJoin",
		"insert", "values", "update", "set", "delete",
		"onConflictDoNothing", "onConflictDoUpdate",
		"returning", "execute",
	] as const;

	for (const method of allMethods) {
		builder[method].mockClear();
	}
}

/**
 * Reconfigure the return data of an existing mock db builder.
 * Updates the thenable resolution and terminal method returns.
 */
export function setMockDbReturn(builder: MockQueryBuilder, newData: unknown[]): void {
	builder.returning.mockResolvedValue(newData);
	builder.execute.mockResolvedValue(newData);
	(builder as any).then = (resolve: (value: unknown) => void) => resolve(newData);
}
