/**
 * Client Server Actions - DocFusion
 *
 * Server actions for managing clients and customer relationships.
 */

"use server";

import { db } from "@/lib/db";
import { requireUserContext } from "@/lib/auth-utils";
import { clients, type ClientRow } from "@/lib/db/schema";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import type {
	Client,
	CreateClientInput,
	UpdateClientInput,
	ClientFilters,
	ClientStatus,
} from "@/lib/types/company";

async function requireClientContext(): Promise<{ userId: string; organizationId: string }> {
	const context = await requireUserContext();
	if (!context.organizationId) {
		throw new Error("Organization context required");
	}
	return {
		userId: context.userId,
		organizationId: context.organizationId,
	};
}

// ============================================================================
// Client CRUD
// ============================================================================

/**
 * Get all clients with optional filtering.
 */
export async function getClients(filters?: ClientFilters): Promise<Client[]> {
	const { organizationId } = await requireClientContext();

	const conditions = [eq(clients.organizationId, organizationId)];

	if (filters?.search) {
		conditions.push(
			ilike(clients.name, `%${filters.search}%`)
		);
	}

	if (filters?.status) {
		conditions.push(eq(clients.status, filters.status));
	}

	if (filters?.industry) {
		conditions.push(eq(clients.industry, filters.industry));
	}

	if (filters?.size) {
		conditions.push(eq(clients.size, filters.size));
	}

	const rows = await db
		.select()
		.from(clients)
		.where(and(...conditions))
		.orderBy(desc(clients.createdAt));

	return rows.map(transformClient);
}

/**
 * Get a client by ID.
 */
export async function getClient(id: string): Promise<Client | null> {
	const { organizationId } = await requireClientContext();

	const [row] = await db
		.select()
		.from(clients)
		.where(
			and(
				eq(clients.id, id),
				eq(clients.organizationId, organizationId)
			)
		);

	return row ? transformClient(row) : null;
}

/**
 * Create a new client.
 */
export async function createClient(input: CreateClientInput): Promise<Client> {
	const { organizationId } = await requireClientContext();

	const [row] = await db
		.insert(clients)
		.values({
			organizationId,
			name: input.name,
			industry: input.industry ?? null,
			size: input.size ?? null,
			location: input.location ?? null,
			contactName: input.contactName ?? null,
			contactEmail: input.contactEmail ?? null,
			contactPhone: input.contactPhone ?? null,
			relationshipType: input.relationshipType ?? null,
			contractValue: input.contractValue ?? null,
			startDate: input.startDate ? new Date(input.startDate) : null,
			endDate: input.endDate ? new Date(input.endDate) : null,
			status: input.status ?? "prospect",
			notes: input.notes ?? null,
			projects: input.projects ?? [],
		})
		.returning();

	return transformClient(row);
}

/**
 * Update a client.
 */
export async function updateClient(
	id: string,
	input: UpdateClientInput
): Promise<Client> {
	const { organizationId } = await requireClientContext();

	const updateData: Partial<ClientRow> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.industry !== undefined) updateData.industry = input.industry;
	if (input.size !== undefined) updateData.size = input.size;
	if (input.location !== undefined) updateData.location = input.location;
	if (input.contactName !== undefined) updateData.contactName = input.contactName;
	if (input.contactEmail !== undefined) updateData.contactEmail = input.contactEmail;
	if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
	if (input.relationshipType !== undefined) updateData.relationshipType = input.relationshipType;
	if (input.contractValue !== undefined) updateData.contractValue = input.contractValue;
	if (input.startDate !== undefined) {
		updateData.startDate = input.startDate
			? new Date(input.startDate)
			: null;
	}
	if (input.endDate !== undefined) {
		updateData.endDate = input.endDate ? new Date(input.endDate) : null;
	}
	if (input.status !== undefined) updateData.status = input.status;
	if (input.notes !== undefined) updateData.notes = input.notes;
	if (input.projects !== undefined) updateData.projects = input.projects;

	const [row] = await db
		.update(clients)
		.set(updateData)
		.where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)))
		.returning();

	if (!row) {
		throw new Error(`Client ${id} not found`);
	}

	return transformClient(row);
}

/**
 * Update client status.
 */
export async function updateClientStatus(
	id: string,
	status: ClientStatus
): Promise<Client> {
	const { organizationId } = await requireClientContext();

	const [row] = await db
		.update(clients)
		.set({
			status,
			updatedAt: new Date(),
		})
		.where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)))
		.returning();

	if (!row) {
		throw new Error(`Client ${id} not found`);
	}

	return transformClient(row);
}

/**
 * Delete a client.
 */
export async function deleteClient(id: string): Promise<void> {
	const { organizationId } = await requireClientContext();

	await db
		.delete(clients)
		.where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
}

// ============================================================================
// Client Analytics
// ============================================================================

/**
 * Get client statistics.
 */
export async function getClientStats(): Promise<{
	totalClients: number;
	activeClients: number;
	formerClients: number;
	prospectClients: number;
	totalContractValue: number;
}> {
	const { organizationId } = await requireClientContext();

	const counts = await db.execute(
		sql`SELECT
			COUNT(*) as total,
			SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
			SUM(CASE WHEN status = 'former' THEN 1 ELSE 0 END) as former,
			SUM(CASE WHEN status = 'prospect' THEN 1 ELSE 0 END) as prospect,
			SUM(COALESCE(contract_value, 0)) as total_value
		FROM clients
		WHERE organization_id = ${organizationId}
	`);

	const row = counts.rows[0] as Record<string, unknown>;

	return {
		totalClients: Number(row?.total ?? 0),
		activeClients: Number(row?.active ?? 0),
		formerClients: Number(row?.former ?? 0),
		prospectClients: Number(row?.prospect ?? 0),
		totalContractValue: Number(row?.total_value ?? 0),
	};
}

/**
 * Get unique industries.
 */
export async function getIndustries(): Promise<string[]> {
	const { organizationId } = await requireClientContext();

	const rows = await db
		.select({ industry: clients.industry })
		.from(clients)
		.where(eq(clients.organizationId, organizationId))
		.groupBy(clients.industry)
		.orderBy(clients.industry);

	return rows.map((r) => r.industry).filter(Boolean) as string[];
}

/**
 * Get clients by industry for summary.
 */
export async function getClientsByIndustry(): Promise<
	{ industry: string; count: number; active: number }[]
> {
	const { organizationId } = await requireClientContext();

	const result = await db.execute(sql`
			SELECT
			industry,
			COUNT(*) as count,
			SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
			FROM clients
		WHERE organization_id = ${organizationId}
		GROUP BY industry
		ORDER BY count DESC
	`);

	return result.rows.map((row) => {
		const r = row as Record<string, unknown>;
		return {
			industry: (r.industry as string) || "unknown",
			count: Number(r.count) || 0,
			active: Number(r.active) || 0,
		};
	});
}

// ============================================================================
// Transformers
// ============================================================================

function transformClient(row: ClientRow): Client {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		industry: row.industry,
		size: row.size,
		location: row.location,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		relationshipType: row.relationshipType,
		contractValue: row.contractValue,
		startDate: row.startDate,
		endDate: row.endDate,
		status: row.status as ClientStatus,
		notes: row.notes,
		projects: (row.projects ?? []) as Client["projects"],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
