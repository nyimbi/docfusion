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
	delete process.env.OPPORTUNITY_IMPORT_ROOT;
	delete process.env.SCRAPER_EXPORT_ROOT;
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

	it("rejects authenticated path-based imports when no import root is configured", async () => {
		getCurrentUserIdMock.mockResolvedValue("importer-1");

		await expect(importFromFile("/tmp/opportunities.csv")).rejects.toThrow(
			"OPPORTUNITY_IMPORT_ROOT is not configured"
		);
		await expect(previewImport("/tmp/opportunities.csv")).rejects.toThrow(
			"OPPORTUNITY_IMPORT_ROOT is not configured"
		);
		await expect(importFromDirectory("/tmp/imports")).rejects.toThrow(
			"OPPORTUNITY_IMPORT_ROOT is not configured"
		);
		await expect(importFromScraperExport("/tmp/export.jsonl")).rejects.toThrow(
			"SCRAPER_EXPORT_ROOT is not configured"
		);
		await expect(importAllScraperExports("/tmp/sync")).rejects.toThrow(
			"SCRAPER_EXPORT_ROOT is not configured"
		);

		expect(readFileMock).not.toHaveBeenCalled();
		expect(readdirMock).not.toHaveBeenCalled();
		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects authenticated path-based imports outside configured roots", async () => {
		getCurrentUserIdMock.mockResolvedValue("importer-1");
		process.env.OPPORTUNITY_IMPORT_ROOT = "/srv/docfusion/imports";
		process.env.SCRAPER_EXPORT_ROOT = "/srv/docfusion/scraper-exports";

		await expect(importFromFile("/etc/passwd")).rejects.toThrow(
			"Import path is outside the configured import root"
		);
		await expect(previewImport("/private/tmp/opportunities.csv")).rejects.toThrow(
			"Import path is outside the configured import root"
		);
		await expect(importFromDirectory("/var/log")).rejects.toThrow(
			"Import path is outside the configured import root"
		);
		await expect(importFromScraperExport("/etc/hosts")).rejects.toThrow(
			"Import path is outside the configured import root"
		);
		await expect(importAllScraperExports("/tmp/sync")).rejects.toThrow(
			"Import path is outside the configured import root"
		);

		expect(readFileMock).not.toHaveBeenCalled();
		expect(readdirMock).not.toHaveBeenCalled();
		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
