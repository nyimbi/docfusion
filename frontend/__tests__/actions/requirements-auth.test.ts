import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const getProviderManagerMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: requireTenantContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-rfp", () => ({
	rfpRequirements: {},
}));
vi.mock("@/lib/db/schema-tasks", () => ({
	proposalTasks: {},
	taskActivity: {},
}));
vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
	upsertWorkflowRuntimeTask: vi.fn(),
}));
vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: getProviderManagerMock,
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import {
	createRequirements,
	extractRequirements,
	saveExtractedRequirements,
} from "@/lib/actions/requirements";

beforeEach(() => {
	vi.clearAllMocks();
	requireTenantContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("requirement action auth", () => {
	it("requires tenant auth before extraction providers, database access, or empty bulk saves", async () => {
		await expect(createRequirements([])).rejects.toThrow("Unauthorized");
		await expect(extractRequirements("opp-1", "The contractor shall provide staffing.")).rejects.toThrow("Unauthorized");
		await expect(saveExtractedRequirements("opp-1", [])).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
		expect(getProviderManagerMock).not.toHaveBeenCalled();
	});
});
