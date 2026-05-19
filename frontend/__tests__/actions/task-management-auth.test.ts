import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServerSessionMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: requireServerSessionMock,
}));

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createChainableQuery(returnValue: unknown = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "orderBy", "values", "returning", "set"]) {
		chain[method] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(
		Array.isArray(returnValue) ? returnValue : [returnValue]
	);
	(chain as Record<string, unknown>).then = (resolve: (value: unknown) => void) =>
		Promise.resolve(Array.isArray(returnValue) ? returnValue : [returnValue]).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
}

describe("task-management action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireServerSessionMock.mockResolvedValue({
			user: { id: "author-1", name: "Author One", email: "author@example.com" },
		});
		mockDb.select.mockImplementation(() => createChainableQuery([]));
		mockDb.insert.mockImplementation(() => createChainableQuery([]));
		mockDb.update.mockImplementation(() => createChainableQuery([]));
		mockDb.delete.mockImplementation(() => createChainableQuery([]));
	});

	it("requires a session before creating proposal tasks", async () => {
		requireServerSessionMock.mockRejectedValueOnce(new Error("Unauthorized"));
		const { createTask } = await import("@/lib/actions/task-management");

		const result = await createTask({
			opportunityId: "00000000-0000-4000-8000-000000000001",
			title: "Draft management approach",
			taskType: "writing",
			priority: "medium",
		});

		expect(result).toEqual({ success: false, error: "Unauthorized" });
		expect(mockDb.insert).not.toHaveBeenCalled();
		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("rejects spoofed time log user IDs before reading tasks", async () => {
		const { logTime } = await import("@/lib/actions/task-management");

		const result = await logTime("task-1", 2, "Drafted section", "other-user");

		expect(result).toEqual({ success: false, error: "Unauthorized" });
		expect(mockDb.select).not.toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("scopes compliance task generation requirements by assigned opportunity", async () => {
		let requirementsWhere: unknown;
		const requirementsChain = createChainableQuery([]);
		(requirementsChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			requirementsWhere = value;
			return requirementsChain;
		});
		mockDb.select.mockImplementationOnce(() => requirementsChain);
		const { generateTasksFromCompliance } = await import("@/lib/actions/task-management");

		const result = await generateTasksFromCompliance(
			"matrix-1",
			"00000000-0000-4000-8000-000000000001"
		);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(requirementsWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes progress report task reads by assigned opportunity", async () => {
		let tasksWhere: unknown;
		const tasksChain = createChainableQuery([]);
		(tasksChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			tasksWhere = value;
			return tasksChain;
		});
		mockDb.select.mockImplementationOnce(() => tasksChain);
		const { generateProgressReport } = await import("@/lib/actions/task-management");

		const result = await generateProgressReport("00000000-0000-4000-8000-000000000001");

		expect(result.success).toBe(true);
		expect(collectSqlFragments(tasksWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes task numbering and summary maintenance by assigned opportunity", async () => {
		let numberWhere: unknown;
		let summaryTasksWhere: unknown;
		let summaryReadWhere: unknown;
		const numberChain = createChainableQuery([{ count: 0 }]);
		(numberChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			numberWhere = value;
			return numberChain;
		});
		const summaryTasksChain = createChainableQuery([]);
		(summaryTasksChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			summaryTasksWhere = value;
			return summaryTasksChain;
		});
		const summaryReadChain = createChainableQuery([]);
		(summaryReadChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			summaryReadWhere = value;
			return summaryReadChain;
		});
		mockDb.select
			.mockImplementationOnce(() => numberChain)
			.mockImplementationOnce(() => summaryTasksChain)
			.mockImplementationOnce(() => summaryReadChain);
		mockDb.insert
			.mockImplementationOnce(() => createChainableQuery([{
				id: "task-1",
				opportunityId: "00000000-0000-4000-8000-000000000001",
				status: "pending",
			}]))
			.mockImplementation(() => createChainableQuery([]));
		const { createTask } = await import("@/lib/actions/task-management");

		const result = await createTask({
			opportunityId: "00000000-0000-4000-8000-000000000001",
			title: "Draft management approach",
			taskType: "writing",
			priority: "medium",
		});

		expect(result.success).toBe(true);
		expect(collectSqlFragments(numberWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(collectSqlFragments(summaryTasksWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(collectSqlFragments(summaryReadWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
