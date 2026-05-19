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
	clients: {},
}));

import {
	createClient,
	deleteClient,
	getClient,
	getClientStats,
	getClients,
	getClientsByIndustry,
	getIndustries,
	updateClient,
	updateClientStatus,
} from "@/lib/actions/clients";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("client action auth", () => {
	it("rejects unauthenticated client reads and mutations before database access", async () => {
		await expect(getClients()).rejects.toThrow("Unauthorized");
		await expect(getClient("client-1")).rejects.toThrow("Unauthorized");
		await expect(createClient({ name: "Acme" })).rejects.toThrow("Unauthorized");
		await expect(updateClient("client-1", { name: "Acme Federal" })).rejects.toThrow("Unauthorized");
		await expect(updateClientStatus("client-1", "active")).rejects.toThrow("Unauthorized");
		await expect(deleteClient("client-1")).rejects.toThrow("Unauthorized");
		await expect(getClientStats()).rejects.toThrow("Unauthorized");
		await expect(getIndustries()).rejects.toThrow("Unauthorized");
		await expect(getClientsByIndustry()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
