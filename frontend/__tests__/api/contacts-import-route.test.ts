import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

function createInsertChain(result: unknown[], onValues?: (value: Record<string, unknown>) => void) {
	const chain: Record<string, any> = {};
	chain.values = vi.fn((value: Record<string, unknown>) => {
		onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => result);
	return chain;
}

function createUpdateChain(onWhere?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	chain.set = vi.fn(() => chain);
	chain.where = vi.fn(async (value: unknown) => {
		onWhere?.(value);
	});
	return chain;
}

const tenantMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })));
const ilikeMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ op: "ilike", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })));
const dbMock = vi.hoisted(() => ({
	query: {
		contactImports: { findFirst: vi.fn() },
		contacts: { findFirst: vi.fn() },
		accounts: { findFirst: vi.fn() },
	},
	insert: vi.fn(),
	update: vi.fn(),
}));
const parserMock = vi.hoisted(() => ({
	autoParseContacts: vi.fn(),
	detectCSVFields: vi.fn(),
	parseCSV: vi.fn(),
}));

vi.mock("@/lib/auth/route-tenant", () => ({
	requireRouteTenantContext: tenantMock,
	isTenantResponse: (value: unknown) => value instanceof Response,
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/db/schema-crm", () => ({
	contactImports: {
		id: "contact_imports.id",
		importedBy: "contact_imports.imported_by",
		organizationId: "contact_imports.organization_id",
	},
	contacts: {
		id: "contacts.id",
		email: "contacts.email",
		ownerId: "contacts.owner_id",
		organizationId: "contacts.organization_id",
	},
	accounts: {
		id: "accounts.id",
		name: "accounts.name",
		ownerId: "accounts.owner_id",
	},
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	ilike: ilikeMock,
	and: andMock,
}));
vi.mock("@/lib/import/contact-parsers", () => parserMock);

import { POST, PUT } from "@/app/api/v1/contacts/import/route";

beforeEach(() => {
	vi.clearAllMocks();
	tenantMock.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
	parserMock.autoParseContacts.mockResolvedValue({
		contacts: [{
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@example.test",
			company: "Analytical Engines",
		}],
		totalParsed: 1,
		errors: [],
		warnings: [],
	});
	parserMock.detectCSVFields.mockReturnValue({
		headers: ["firstName", "lastName", "email", "company"],
		suggestedMapping: { firstName: "firstName", lastName: "lastName", email: "email", company: "company" },
		confidence: {},
	});
});

describe("contacts import route tenant scoping", () => {
	it("requires an organization context before parsing uploads", async () => {
		tenantMock.mockResolvedValueOnce(
			NextResponse.json({ error: "No organization context" }, { status: 403 })
		);

		const response = await POST(csvUploadRequest("firstName,lastName,email\nAda,Lovelace,ada@example.test"));

		expect(response.status).toBe(403);
		expect(parserMock.autoParseContacts).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("stores previews under the session organization and scopes preview lookups", async () => {
		const inserted: Record<string, unknown>[] = [];
		dbMock.insert.mockReturnValueOnce(createInsertChain([{ id: "import-1" }], (value) => inserted.push(value)));
		dbMock.query.contacts.findFirst.mockResolvedValueOnce({ id: "contact-1" });
		dbMock.query.accounts.findFirst.mockResolvedValueOnce({ name: "Analytical Engines" });

		const response = await POST(csvUploadRequest("firstName,lastName,email,company\nAda,Lovelace,ada@example.test,Analytical Engines"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.preview.contacts[0]).toMatchObject({
			existingContact: true,
			existingAccount: "Analytical Engines",
		});
		expect(inserted[0]).toMatchObject({
			importedBy: "user-1",
			organizationId: "org-1",
		});
		expect(eqMock).toHaveBeenCalledWith("contacts.owner_id", "user-1");
		expect(eqMock).toHaveBeenCalledWith("contacts.organization_id", "org-1");
		expect(eqMock).toHaveBeenCalledWith("accounts.owner_id", "user-1");
	});

	it("confirms only tenant-owned imports and writes tenant-scoped contacts", async () => {
		const insertedContacts: Record<string, unknown>[] = [];
		const updatePredicates: unknown[] = [];
		dbMock.query.contactImports.findFirst.mockResolvedValueOnce({
			id: "import-1",
			filename: "contacts.csv",
			fieldMapping: undefined,
			status: "pending",
		});
		dbMock.query.contacts.findFirst.mockResolvedValueOnce(null);
		dbMock.query.accounts.findFirst.mockResolvedValueOnce({ id: "account-1" });
		dbMock.update
			.mockReturnValueOnce(createUpdateChain((value) => updatePredicates.push(value)))
			.mockReturnValueOnce(createUpdateChain((value) => updatePredicates.push(value)));
		dbMock.insert.mockReturnValueOnce(createInsertChain([{ id: "contact-1" }], (value) => insertedContacts.push(value)));

		const response = await PUT(jsonRequest({
			importId: "import-1",
			fileContent: Buffer.from("firstName,lastName,email,company\nAda,Lovelace,ada@example.test,Analytical Engines").toString("base64"),
			options: { visibility: "private" },
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.stats).toMatchObject({ imported: 1, updated: 0, skipped: 0, failed: 0 });
		expect(insertedContacts[0]).toMatchObject({
			ownerId: "user-1",
			organizationId: "org-1",
			accountId: "account-1",
		});
		expect(eqMock).toHaveBeenCalledWith("contact_imports.imported_by", "user-1");
		expect(eqMock).toHaveBeenCalledWith("contact_imports.organization_id", "org-1");
		expect(eqMock).toHaveBeenCalledWith("contacts.owner_id", "user-1");
		expect(eqMock).toHaveBeenCalledWith("contacts.organization_id", "org-1");
		expect(eqMock).toHaveBeenCalledWith("accounts.owner_id", "user-1");
		expect(updatePredicates).toHaveLength(2);
	});
});

function csvUploadRequest(content: string) {
	const formData = new FormData();
	formData.set("file", new File([content], "contacts.csv", { type: "text/csv" }));
	return new NextRequest("https://app.test/api/v1/contacts/import", {
		method: "POST",
		body: formData,
	});
}

function jsonRequest(body: Record<string, unknown>) {
	return new NextRequest("https://app.test/api/v1/contacts/import", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}
