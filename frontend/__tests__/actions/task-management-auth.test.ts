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

describe("task-management action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireServerSessionMock.mockResolvedValue({
			user: { id: "author-1", name: "Author One", email: "author@example.com" },
		});
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
});
