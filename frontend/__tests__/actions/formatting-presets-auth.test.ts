import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

function createInsertChain(result: unknown[], onValues?: (value: Record<string, unknown>) => void) {
	const chain: Record<string, any> = {};
	chain.values = vi.fn((value: Record<string, unknown>) => {
		onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => result);
	return chain;
}

function createSelectChain(result: unknown[]) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

const dbMock = vi.hoisted(() => ({
	insert: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
	documents: {},
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
	getFormatPresets,
	saveFormatPreset,
} from "@/lib/actions/formatting";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "format-user-1",
		organizationId: "11111111-1111-4111-8111-111111111111",
	});
	dbMock.select.mockReturnValue(createSelectChain([]));
});

describe("format preset tenant context", () => {
	it("requires organization context before saving presets", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "format-user-1",
			organizationId: undefined,
		});

		await expect(saveFormatPreset("Proposal", { bodyFont: "Arial" }))
			.rejects.toThrow("No organization context");

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("saves presets under the session organization", async () => {
		const inserted: Record<string, unknown>[] = [];
		dbMock.insert.mockReturnValueOnce(createInsertChain([formatPresetRow()], (value) => inserted.push(value)));

		const preset = await saveFormatPreset("Proposal", { bodyFont: "Arial" });

		expect(preset.id).toBe("preset-1");
		expect(inserted[0]).toMatchObject({
			userId: "format-user-1",
			organizationId: "11111111-1111-4111-8111-111111111111",
			name: "Proposal",
		});
	});

	it("requires organization context before listing presets", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "format-user-1",
			organizationId: undefined,
		});

		await expect(getFormatPresets()).rejects.toThrow("No organization context");

		expect(dbMock.select).not.toHaveBeenCalled();
	});
});

function formatPresetRow() {
	return {
		id: "preset-1",
		userId: "format-user-1",
		organizationId: "11111111-1111-4111-8111-111111111111",
		name: "Proposal",
		description: null,
		tags: null,
		baseTemplateId: null,
		customSettings: { bodyFont: "Arial" },
		targetAgency: null,
		contractType: null,
		isShared: false,
		sharedAt: null,
		sharedBy: null,
		isPublic: false,
		useCount: 0,
		lastUsedAt: null,
		isActive: true,
		isFavorite: false,
		createdAt: new Date("2026-05-01T00:00:00.000Z"),
		updatedAt: new Date("2026-05-01T00:00:00.000Z"),
	};
}
