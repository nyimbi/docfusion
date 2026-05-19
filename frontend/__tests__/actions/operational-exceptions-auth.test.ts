import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn());
const remediateMock = vi.hoisted(() => vi.fn());
const syncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/workflows/operational-exceptions", () => ({
	listOperationalExceptionsForActor: listMock,
	remediateOperationalExceptionForActor: remediateMock,
	syncOperationalExceptionWorkflowsForActor: syncMock,
}));

import {
	listOperationalExceptions,
	remediateOperationalException,
	syncOperationalExceptionWorkflows,
} from "@/lib/actions/operational-exceptions";

beforeEach(() => {
	vi.clearAllMocks();
	getServerSessionMock.mockResolvedValue(null);
});

describe("operational exception action auth", () => {
	it("rejects unauthenticated exception actions before internal workflow helpers", async () => {
		await expect(listOperationalExceptions()).rejects.toThrow("Unauthorized");
		await expect(remediateOperationalException({
			subjectType: "rfp_parse",
			subjectId: "rfp-1",
			action: "retry",
			reason: "retry",
		})).rejects.toThrow("Unauthorized");
		await expect(syncOperationalExceptionWorkflows()).rejects.toThrow("Unauthorized");

		expect(listMock).not.toHaveBeenCalled();
		expect(remediateMock).not.toHaveBeenCalled();
		expect(syncMock).not.toHaveBeenCalled();
	});
});
