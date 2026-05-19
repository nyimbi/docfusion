import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const readdirMock = vi.hoisted(() => vi.fn());
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
vi.mock("fs/promises", () => ({
	default: {
		readFile: readFileMock,
		readdir: readdirMock,
	},
	readFile: readFileMock,
	readdir: readdirMock,
}));
vi.mock("@/lib/db/schema", () => ({
	opportunities: {},
	opportunityImports: {},
}));
vi.mock("@/lib/actions/opportunities", () => ({
	createImportRecord: vi.fn(),
	updateImportRecord: vi.fn(),
	createOpportunity: vi.fn(),
	updateOpportunity: vi.fn(),
}));

import {
	importAllScraperExports,
	importFromBuffer,
	importFromDirectory,
	importFromFile,
	importFromScraperExport,
	previewImport,
} from "@/lib/actions/import-opportunities";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("opportunity import action auth", () => {
	it("rejects unauthenticated import actions before filesystem or database access", async () => {
		await expect(importFromFile("/tmp/opportunities.csv")).rejects.toThrow("Unauthorized");
		await expect(importFromBuffer(Buffer.from("title\nExample"), "opportunities.csv")).rejects.toThrow("Unauthorized");
		await expect(previewImport("/tmp/opportunities.csv")).rejects.toThrow("Unauthorized");
		await expect(importFromScraperExport("/tmp/export.jsonl")).rejects.toThrow("Unauthorized");
		await expect(importAllScraperExports("/tmp/sync")).rejects.toThrow("Unauthorized");
		await expect(importFromDirectory("/tmp/imports")).rejects.toThrow("Unauthorized");

		expect(readFileMock).not.toHaveBeenCalled();
		expect(readdirMock).not.toHaveBeenCalled();
		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
