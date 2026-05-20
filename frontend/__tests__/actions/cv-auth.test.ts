import { beforeEach, describe, expect, it, vi } from "vitest";

function createInsertChain(result: unknown[], onValues?: (value: Record<string, unknown>) => void) {
	const chain: Record<string, any> = {};
	chain.values = vi.fn((value: Record<string, unknown>) => {
		onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => result);
	return chain;
}

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	insert: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	update: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
	delete: vi.fn(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	}),
}));
const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ type: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })));
const ilikeMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ type: "ilike", column, value })));
const descMock = vi.hoisted(() => vi.fn((column: unknown) => ({ type: "desc", column })));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema", () => ({
	cvs: {
		id: "cvs.id",
		organizationId: "cvs.organization_id",
		userId: "cvs.user_id",
		fullName: "cvs.full_name",
		isActive: "cvs.is_active",
		version: "cvs.version",
	},
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
	ilike: ilikeMock,
	desc: descMock,
}));

import {
	createCV,
	createCVVersion,
	deleteCV,
	getCV,
	getCVs,
	getCVVersions,
	getUserCV,
	updateCV,
} from "@/lib/actions/cv";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
	dbMock.select.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.insert.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.update.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
	dbMock.delete.mockImplementation(() => {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	});
});

describe("CV action auth", () => {
	it("rejects unauthenticated CV reads and writes before database access", async () => {
		await expect(getCVs()).rejects.toThrow("Unauthorized");
		await expect(getCV("cv-1")).rejects.toThrow("Unauthorized");
		await expect(getUserCV("user-1")).rejects.toThrow("Unauthorized");
		await expect(getCVVersions("user-1")).rejects.toThrow("Unauthorized");
		await expect(createCV({
			userId: "spoofed-user",
			fullName: "Spoofed User",
		})).rejects.toThrow("Unauthorized");
		await expect(updateCV("cv-1", { fullName: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(createCVVersion("cv-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(deleteCV("cv-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("creates CVs in the caller organization for the authenticated actor", async () => {
		let inserted: Record<string, unknown> | undefined;
		requireUserContextMock.mockResolvedValueOnce({
			userId: "actor-1",
			organizationId: "org-1",
		});
		dbMock.insert.mockReturnValueOnce(createInsertChain([{
			id: "cv-1",
			userId: "actor-1",
			organizationId: "org-1",
			fullName: "Team Member",
			title: null,
			summary: null,
			experience: [],
			education: [],
			skills: [],
			certifications: [],
			projects: [],
			languages: [],
			publications: [],
			email: null,
			phone: null,
			linkedinUrl: null,
			portfolioUrl: null,
			version: 1,
			isActive: true,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		}], (value) => {
			inserted = value;
		}) as never);

		const cv = await createCV({
			userId: "spoofed-user",
			fullName: "Team Member",
		});

		expect(inserted).toMatchObject({
			organizationId: "org-1",
			userId: "actor-1",
			fullName: "Team Member",
		});
		expect(cv.organizationId).toBe("org-1");
		expect(cv.userId).toBe("actor-1");
	});
});
