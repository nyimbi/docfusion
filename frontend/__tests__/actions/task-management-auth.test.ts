import { beforeEach, describe, expect, it, vi } from "vitest";

const requireServerSessionMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
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
	revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createChainableQuery(returnValue: unknown = [], onValues?: (value: unknown) => void) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "orderBy", "returning", "set"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.values = vi.fn((value: unknown) => {
		onValues?.(value);
		return chain;
	});
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

function expectOpportunityTenantScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain("org-1");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("author-1");
}

describe("task-management action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireServerSessionMock.mockResolvedValue({
			user: {
				id: "author-1",
				name: "Author One",
				email: "author@example.com",
				organizationId: "org-1",
			},
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
		expectOpportunityTenantScope(requirementsWhere);
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
		expectOpportunityTenantScope(tasksWhere);
	});

	it("scopes task numbering and summary maintenance by assigned opportunity", async () => {
		let numberWhere: unknown;
		let summaryTasksWhere: unknown;
		let summaryReadWhere: unknown;
		let insertedTask: Record<string, unknown> | undefined;
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
			}], (value) => {
				insertedTask = value as Record<string, unknown>;
			}))
			.mockImplementation(() => createChainableQuery([]));
		const { createTask } = await import("@/lib/actions/task-management");

		const result = await createTask({
			opportunityId: "00000000-0000-4000-8000-000000000001",
			title: "Draft management approach",
			taskType: "writing",
			priority: "medium",
		});

		expect(result.success).toBe(true);
		expect(insertedTask).toMatchObject({ organizationId: "org-1" });
		expectOpportunityTenantScope(numberWhere);
		expectOpportunityTenantScope(summaryTasksWhere);
		expectOpportunityTenantScope(summaryReadWhere);
		expect(revalidatePathMock).toHaveBeenCalledWith("/tasks");
		expect(revalidatePathMock).toHaveBeenCalledWith("/opportunities/00000000-0000-4000-8000-000000000001");
		expect(revalidatePathMock).toHaveBeenCalledWith("/opportunities/00000000-0000-4000-8000-000000000001/requirements");
		expect(revalidatePathMock).not.toHaveBeenCalledWith("/opportunities/[id]/tasks", "page");
	});

	it("scopes task listing and single-task reads by assigned opportunity", async () => {
		let listAllWhere: unknown;
		let listWhere: unknown;
		let getWhere: unknown;
		const listAllChain = createChainableQuery([]);
		(listAllChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			listAllWhere = value;
			return listAllChain;
		});
		const listChain = createChainableQuery([]);
		(listChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			listWhere = value;
			return listChain;
		});
		const getChain = createChainableQuery([{
			id: "task-1",
			opportunityId: "00000000-0000-4000-8000-000000000001",
		}]);
		(getChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			getWhere = value;
			return getChain;
		});
		mockDb.select
			.mockImplementationOnce(() => listAllChain)
			.mockImplementationOnce(() => listChain)
			.mockImplementationOnce(() => getChain);
		const { listAllTasks, listTasks, getTask } = await import("@/lib/actions/task-management");

		await expect(listAllTasks()).resolves.toMatchObject({ success: true });
		await expect(listTasks("00000000-0000-4000-8000-000000000001")).resolves.toMatchObject({ success: true });
		await expect(getTask("task-1")).resolves.toMatchObject({ success: true });

		expectOpportunityTenantScope(listAllWhere);
		expectOpportunityTenantScope(listWhere);
		expectOpportunityTenantScope(getWhere);
	});

	it("normalizes task and team member list limits", async () => {
		const taskChain = createChainableQuery([]);
		const teamChain = createChainableQuery([]);
		mockDb.select
			.mockImplementationOnce(() => taskChain)
			.mockImplementationOnce(() => teamChain);
		const { listAllTasks, listTeamMembers } = await import("@/lib/actions/task-management");

		await expect(listAllTasks({ limit: -20 })).resolves.toMatchObject({ success: true });
		await expect(listTeamMembers({ limit: Number.POSITIVE_INFINITY })).resolves.toMatchObject({ success: true });

		expect(taskChain.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(1);
		expect(teamChain.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(100);
	});

	it("scopes task updates and deletes by assigned opportunity", async () => {
		let updateReadWhere: unknown;
		let updateWriteWhere: unknown;
		let deleteReadWhere: unknown;
		let deleteWriteWhere: unknown;
		const task = {
			id: "task-1",
			opportunityId: "00000000-0000-4000-8000-000000000001",
			status: "pending",
			assignedTo: null,
			progress: 0,
		};
		const updateReadChain = createChainableQuery([task]);
		(updateReadChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateReadWhere = value;
			return updateReadChain;
		});
		const updateWriteChain = createChainableQuery([{ ...task, title: "Updated" }]);
		(updateWriteChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateWriteWhere = value;
			return updateWriteChain;
		});
		const summaryTasksChain = createChainableQuery([]);
		const summaryReadChain = createChainableQuery([]);
		const deleteReadChain = createChainableQuery([{ opportunityId: task.opportunityId }]);
		(deleteReadChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			deleteReadWhere = value;
			return deleteReadChain;
		});
		const deleteActivityChain = createChainableQuery([]);
		const deleteTaskChain = createChainableQuery([]);
		(deleteTaskChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			deleteWriteWhere = value;
			return deleteTaskChain;
		});

		mockDb.select
			.mockImplementationOnce(() => updateReadChain)
			.mockImplementationOnce(() => summaryTasksChain)
			.mockImplementationOnce(() => summaryReadChain)
			.mockImplementationOnce(() => deleteReadChain)
			.mockImplementationOnce(() => summaryTasksChain)
			.mockImplementationOnce(() => summaryReadChain);
		mockDb.update.mockImplementationOnce(() => updateWriteChain);
		mockDb.delete
			.mockImplementationOnce(() => deleteActivityChain)
			.mockImplementationOnce(() => deleteTaskChain);
		const { updateTask, deleteTask } = await import("@/lib/actions/task-management");

		await expect(updateTask("task-1", { title: "Updated" })).resolves.toMatchObject({ success: true });
		await expect(deleteTask("task-1")).resolves.toMatchObject({ success: true });

		expectOpportunityTenantScope(updateReadWhere);
		expectOpportunityTenantScope(updateWriteWhere);
		expectOpportunityTenantScope(deleteReadWhere);
		expectOpportunityTenantScope(deleteWriteWhere);
		expect(revalidatePathMock).toHaveBeenCalledWith("/tasks");
		expect(revalidatePathMock).toHaveBeenCalledWith("/opportunities/00000000-0000-4000-8000-000000000001");
		expect(revalidatePathMock).not.toHaveBeenCalledWith("/opportunities/[id]/tasks", "page");
	});

	it("scopes workload, task activity, and time logging by assigned opportunity", async () => {
		let workloadWhere: unknown;
		let activityWhere: unknown;
		let timeReadWhere: unknown;
		let timeWriteWhere: unknown;
		const authorChain = createChainableQuery([{ userId: "author-2", userName: "Author Two" }]);
		const workloadChain = createChainableQuery([]);
		(workloadChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			workloadWhere = value;
			return workloadChain;
		});
		const activityChain = createChainableQuery([]);
		(activityChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			activityWhere = value;
			return activityChain;
		});
		const taskChain = createChainableQuery([{
			id: "task-1",
			opportunityId: "00000000-0000-4000-8000-000000000001",
			hoursLogged: [],
			actualHours: 0,
		}]);
		(taskChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			timeReadWhere = value;
			return taskChain;
		});
		const timeUpdateChain = createChainableQuery([]);
		(timeUpdateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			timeWriteWhere = value;
			return timeUpdateChain;
		});
		mockDb.select
			.mockImplementationOnce(() => authorChain)
			.mockImplementationOnce(() => workloadChain)
			.mockImplementationOnce(() => activityChain)
			.mockImplementationOnce(() => taskChain);
		mockDb.update.mockImplementationOnce(() => timeUpdateChain);
		const { getWorkloadSummary, getTaskActivity, logTime } = await import("@/lib/actions/task-management");

		await expect(getWorkloadSummary("author-2")).resolves.toMatchObject({ success: true });
		await expect(getTaskActivity("task-1")).resolves.toMatchObject({ success: true });
		await expect(logTime("task-1", 2, "Drafting")).resolves.toMatchObject({ success: true });

		expectOpportunityTenantScope(workloadWhere);
		expectOpportunityTenantScope(activityWhere);
		expectOpportunityTenantScope(timeReadWhere);
		expectOpportunityTenantScope(timeWriteWhere);
	});

	it("prevents spoofed author expertise reads before querying", async () => {
		const { getAuthorExpertise } = await import("@/lib/actions/task-management");

		const result = await getAuthorExpertise("other-user");

		expect(result).toEqual({ success: false, error: "Unauthorized" });
		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("scopes author expertise refresh task metrics by assigned opportunity", async () => {
		let completedTasksWhere: unknown;
		const authorChain = createChainableQuery([{ userId: "author-1", userName: "Author One" }]);
		const completedTasksChain = createChainableQuery([]);
		(completedTasksChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			completedTasksWhere = value;
			return completedTasksChain;
		});
		mockDb.select
			.mockImplementationOnce(() => authorChain)
			.mockImplementationOnce(() => completedTasksChain);
		mockDb.update.mockImplementationOnce(() => createChainableQuery([{ userId: "author-1" }]));
		const { updateAuthorExpertise } = await import("@/lib/actions/task-management");

		await expect(updateAuthorExpertise("author-1")).resolves.toMatchObject({ success: true });

		expectOpportunityTenantScope(completedTasksWhere);
	});
});
