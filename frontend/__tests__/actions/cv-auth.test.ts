import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	cvs: {},
}));

import {
	createCV,
	createCVVersion,
	deleteCV,
	updateCV,
} from "@/lib/actions/cv";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("CV action auth", () => {
	it("rejects unauthenticated CV writes before database access", async () => {
		await expect(createCV({
			userId: "spoofed-user",
			fullName: "Spoofed User",
		})).rejects.toThrow("Unauthorized");
		await expect(updateCV("cv-1", { fullName: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(createCVVersion("cv-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(deleteCV("cv-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
