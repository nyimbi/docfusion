/**
 * Company Setup Server Actions - DocFusion
 *
 * Server actions for managing company profile, roles, products, and services.
 */

"use server";

import { db } from "@/lib/db";
import { requireUserContext } from "@/lib/auth-utils";
import {
	roles,
	companyProfiles,
	products,
	services,
	type RoleRow,
	type CompanyProfileRow,
	type ProductRow,
	type ServiceRow,
} from "@/lib/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import type {
	Role,
	CompanyProfile,
	Product,
	Service,
	CreateRoleInput,
	UpdateRoleInput,
	RoleFilters,
	CompanyProfileInput,
	CreateProductInput,
	UpdateProductInput,
	ProductFilters,
	CreateServiceInput,
	UpdateServiceInput,
	ServiceFilters,
	CompanyStats,
} from "@/lib/types/company";

async function requireCompanySetupContext(): Promise<{ organizationId: string }> {
	const context = await requireUserContext();
	if (!context.organizationId) {
		throw new Error("Organization context required");
	}
	return { organizationId: context.organizationId };
}

// ============================================================================
// Role CRUD
// ============================================================================

/**
 * Get all roles with optional filtering.
 */
export async function getRoles(filters?: RoleFilters): Promise<Role[]> {
	const { organizationId } = await requireCompanySetupContext();

	const conditions = [eq(roles.organizationId, organizationId)];

	if (filters?.search) {
		conditions.push(
			ilike(roles.name, `%${filters.search}%`)
		);
	}

	if (filters?.department) {
		conditions.push(eq(roles.department, filters.department));
	}

	if (filters?.level) {
		conditions.push(eq(roles.level, filters.level));
	}

	const rows = await db
		.select()
		.from(roles)
		.where(and(...conditions))
		.orderBy(roles.department, roles.name);

	return rows.map(transformRole);
}

/**
 * Get a single role by ID.
 */
export async function getRole(id: string): Promise<Role | null> {
	const { organizationId } = await requireCompanySetupContext();

	const [row] = await db
		.select()
		.from(roles)
		.where(and(eq(roles.id, id), eq(roles.organizationId, organizationId)));

	return row ? transformRole(row) : null;
}

/**
 * Create a new role.
 */
export async function createRole(input: CreateRoleInput): Promise<Role> {
	const { organizationId } = await requireCompanySetupContext();

	const [row] = await db
		.insert(roles)
		.values({
			organizationId,
			name: input.name,
			description: input.description ?? null,
			department: input.department ?? null,
			level: input.level ?? null,
			responsibilities: input.responsibilities ?? [],
			skillsRequired: input.skillsRequired ?? [],
		})
		.returning();

	return transformRole(row);
}

/**
 * Update a role.
 */
export async function updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
	const { organizationId } = await requireCompanySetupContext();

	const updateData: Partial<RoleRow> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.department !== undefined) updateData.department = input.department;
	if (input.level !== undefined) updateData.level = input.level;
	if (input.responsibilities !== undefined) updateData.responsibilities = input.responsibilities;
	if (input.skillsRequired !== undefined) updateData.skillsRequired = input.skillsRequired;

	const [row] = await db
		.update(roles)
		.set(updateData)
		.where(and(eq(roles.id, id), eq(roles.organizationId, organizationId)))
		.returning();

	if (!row) {
		throw new Error(`Role ${id} not found`);
	}

	return transformRole(row);
}

/**
 * Delete a role.
 */
export async function deleteRole(id: string): Promise<void> {
	const { organizationId } = await requireCompanySetupContext();

	await db
		.delete(roles)
		.where(and(eq(roles.id, id), eq(roles.organizationId, organizationId)));
}

/**
 * Get unique departments.
 */
export async function getDepartments(): Promise<string[]> {
	const { organizationId } = await requireCompanySetupContext();

	const rows = await db
		.select({ department: roles.department })
		.from(roles)
		.where(eq(roles.organizationId, organizationId))
		.groupBy(roles.department)
		.orderBy(roles.department);

	return rows.map(r => r.department).filter(Boolean) as string[];
}

// ============================================================================
// Company Profile CRUD
// ============================================================================

/**
 * Get the company profile.
 */
export async function getCompanyProfile(): Promise<CompanyProfile | null> {
	const { organizationId } = await requireCompanySetupContext();

	return getCompanyProfileForOrganization(organizationId);
}

async function getCompanyProfileForOrganization(organizationId: string): Promise<CompanyProfile | null> {
	const [row] = await db
		.select()
		.from(companyProfiles)
		.where(eq(companyProfiles.organizationId, organizationId));

	return row ? transformCompanyProfile(row) : null;
}

/**
 * Create or update the company profile.
 */
export async function saveCompanyProfile(input: CompanyProfileInput): Promise<CompanyProfile> {
	const { organizationId } = await requireCompanySetupContext();

	const existing = await getCompanyProfileForOrganization(organizationId);

	if (existing) {
		const [row] = await db
			.update(companyProfiles)
			.set({
				name: input.name,
				description: input.description ?? null,
				mission: input.mission ?? null,
				vision: input.vision ?? null,
				founded: input.founded ?? null,
				employees: input.employees ?? null,
				revenue: input.revenue ?? null,
				website: input.website ?? null,
				industry: input.industry ?? null,
				specialties: input.specialties ?? [],
				certifications: input.certifications ?? [],
				awards: input.awards ?? [],
				keyClients: input.keyClients ?? [],
				updatedAt: new Date(),
			})
			.where(and(
				eq(companyProfiles.id, existing.id),
				eq(companyProfiles.organizationId, organizationId)
			))
			.returning();

		return transformCompanyProfile(row);
	}

	const [row] = await db
		.insert(companyProfiles)
		.values({
			organizationId,
			name: input.name,
			description: input.description ?? null,
			mission: input.mission ?? null,
			vision: input.vision ?? null,
			founded: input.founded ?? null,
			employees: input.employees ?? null,
			revenue: input.revenue ?? null,
			website: input.website ?? null,
			industry: input.industry ?? null,
			specialties: input.specialties ?? [],
			certifications: input.certifications ?? [],
			awards: input.awards ?? [],
			keyClients: input.keyClients ?? [],
		})
		.returning();

	return transformCompanyProfile(row);
}

// ============================================================================
// Products CRUD
// ============================================================================

/**
 * Get all products with optional filtering.
 */
export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
	const { organizationId } = await requireCompanySetupContext();

	const conditions = [eq(products.organizationId, organizationId)];

	if (filters?.search) {
		conditions.push(
			ilike(products.name, `%${filters.search}%`)
		);
	}

	if (filters?.category) {
		conditions.push(eq(products.category, filters.category));
	}

	if (filters?.status) {
		conditions.push(eq(products.status, filters.status));
	}

	const rows = await db
		.select()
		.from(products)
		.where(and(...conditions))
		.orderBy(products.category, products.name);

	return rows.map(transformProduct);
}

/**
 * Get a single product by ID.
 */
export async function getProduct(id: string): Promise<Product | null> {
	const { organizationId } = await requireCompanySetupContext();

	const [row] = await db
		.select()
		.from(products)
		.where(and(eq(products.id, id), eq(products.organizationId, organizationId)));

	return row ? transformProduct(row) : null;
}

/**
 * Create a new product.
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
	const { organizationId } = await requireCompanySetupContext();

	const [row] = await db
		.insert(products)
		.values({
			organizationId,
			name: input.name,
			category: input.category ?? null,
			description: input.description ?? null,
			shortDescription: input.shortDescription ?? null,
			longDescription: input.longDescription ?? null,
			websiteUrl: input.websiteUrl ?? null,
			logoUrl: input.logoUrl ?? null,
			features: input.features ?? [],
			pricing: input.pricing ?? null,
			availability: input.availability ?? null,
			documentation: input.documentation ?? null,
			images: input.images ?? [],
			status: input.status ?? "active",
		})
		.returning();

	return transformProduct(row);
}

/**
 * Update a product.
 */
export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
	const { organizationId } = await requireCompanySetupContext();

	const updateData: Partial<ProductRow> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.shortDescription !== undefined) updateData.shortDescription = input.shortDescription;
	if (input.longDescription !== undefined) updateData.longDescription = input.longDescription;
	if (input.websiteUrl !== undefined) updateData.websiteUrl = input.websiteUrl;
	if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
	if (input.features !== undefined) updateData.features = input.features;
	if (input.pricing !== undefined) updateData.pricing = input.pricing;
	if (input.availability !== undefined) updateData.availability = input.availability;
	if (input.documentation !== undefined) updateData.documentation = input.documentation;
	if (input.images !== undefined) updateData.images = input.images;
	if (input.status !== undefined) updateData.status = input.status;

	const [row] = await db
		.update(products)
		.set(updateData)
		.where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
		.returning();

	if (!row) {
		throw new Error(`Product ${id} not found`);
	}

	return transformProduct(row);
}

/**
 * Delete a product.
 */
export async function deleteProduct(id: string): Promise<void> {
	const { organizationId } = await requireCompanySetupContext();

	await db
		.delete(products)
		.where(and(eq(products.id, id), eq(products.organizationId, organizationId)));
}

/**
 * Get unique product categories.
 */
export async function getProductCategories(): Promise<string[]> {
	const { organizationId } = await requireCompanySetupContext();

	const rows = await db
		.select({ category: products.category })
		.from(products)
		.where(eq(products.organizationId, organizationId))
		.groupBy(products.category)
		.orderBy(products.category);

	return rows.map(r => r.category).filter(Boolean) as string[];
}

// ============================================================================
// Services CRUD
// ============================================================================

/**
 * Get all services with optional filtering.
 */
export async function getServices(filters?: ServiceFilters): Promise<Service[]> {
	const { organizationId } = await requireCompanySetupContext();

	const conditions = [eq(services.organizationId, organizationId)];

	if (filters?.search) {
		conditions.push(
			ilike(services.name, `%${filters.search}%`)
		);
	}

	if (filters?.category) {
		conditions.push(eq(services.category, filters.category));
	}

	if (filters?.status) {
		conditions.push(eq(services.status, filters.status));
	}

	const rows = await db
		.select()
		.from(services)
		.where(and(...conditions))
		.orderBy(services.category, services.name);

	return rows.map(transformService);
}

/**
 * Get a single service by ID.
 */
export async function getService(id: string): Promise<Service | null> {
	const { organizationId } = await requireCompanySetupContext();

	const [row] = await db
		.select()
		.from(services)
		.where(and(eq(services.id, id), eq(services.organizationId, organizationId)));

	return row ? transformService(row) : null;
}

/**
 * Create a new service.
 */
export async function createService(input: CreateServiceInput): Promise<Service> {
	const { organizationId } = await requireCompanySetupContext();

	const [row] = await db
		.insert(services)
		.values({
			organizationId,
			name: input.name,
			category: input.category ?? null,
			description: input.description ?? null,
			capabilities: input.capabilities ?? [],
			pricing: input.pricing ?? null,
			turnaround: input.turnaround ?? null,
			certifications: input.certifications ?? [],
			status: input.status ?? "active",
		})
		.returning();

	return transformService(row);
}

/**
 * Update a service.
 */
export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
	const { organizationId } = await requireCompanySetupContext();

	const updateData: Partial<ServiceRow> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.capabilities !== undefined) updateData.capabilities = input.capabilities;
	if (input.pricing !== undefined) updateData.pricing = input.pricing;
	if (input.turnaround !== undefined) updateData.turnaround = input.turnaround;
	if (input.certifications !== undefined) updateData.certifications = input.certifications;
	if (input.status !== undefined) updateData.status = input.status;

	const [row] = await db
		.update(services)
		.set(updateData)
		.where(and(eq(services.id, id), eq(services.organizationId, organizationId)))
		.returning();

	if (!row) {
		throw new Error(`Service ${id} not found`);
	}

	return transformService(row);
}

/**
 * Delete a service.
 */
export async function deleteService(id: string): Promise<void> {
	const { organizationId } = await requireCompanySetupContext();

	await db
		.delete(services)
		.where(and(eq(services.id, id), eq(services.organizationId, organizationId)));
}

/**
 * Get unique service categories.
 */
export async function getServiceCategories(): Promise<string[]> {
	const { organizationId } = await requireCompanySetupContext();

	const rows = await db
		.select({ category: services.category })
		.from(services)
		.where(eq(services.organizationId, organizationId))
		.groupBy(services.category)
		.orderBy(services.category);

	return rows.map(r => r.category).filter(Boolean) as string[];
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get company setup statistics.
 */
export async function getCompanyStats(): Promise<CompanyStats> {
	const { organizationId } = await requireCompanySetupContext();

	// Get basic counts
	const [roleResult, productResult, serviceResult] = await Promise.all([
		db.select({ count: sql<number>`COUNT(*)` }).from(roles).where(eq(roles.organizationId, organizationId)),
		db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.organizationId, organizationId)),
		db.select({ count: sql<number>`COUNT(*)` }).from(services).where(eq(services.organizationId, organizationId)),
	]);

	// Get profile
	const profileResult = await db
		.select({ description: companyProfiles.description })
		.from(companyProfiles)
		.where(eq(companyProfiles.organizationId, organizationId))
		.limit(1);

	// Get client counts using a simpler query
	const activeClients = await db.execute(
		sql`SELECT COUNT(*) as count FROM clients WHERE organization_id = ${organizationId} AND status = 'active'`
	);
	const formerClients = await db.execute(
		sql`SELECT COUNT(*) as count FROM clients WHERE organization_id = ${organizationId} AND status = 'former'`
	);
	const totalClients = await db.execute(
		sql`SELECT COUNT(*) as count FROM clients WHERE organization_id = ${organizationId}`
	);

	return {
		roleCount: Number(roleResult[0]?.count ?? 0),
		cvCount: 0, // Will be updated when CV table is available
		description: profileResult[0]?.description ?? null,
		clientCount: Number((totalClients.rows[0] as { count: string })?.count ?? 0),
		activeClientCount: Number((activeClients.rows[0] as { count: string })?.count ?? 0),
		formerClientCount: Number((formerClients.rows[0] as { count: string })?.count ?? 0),
		specCount: 1, // Simplified
		serviceCount: Number(serviceResult[0]?.count ?? 0),
		productCount: Number(productResult[0]?.count ?? 0),
	};
}

// ============================================================================
// Transformers
// ============================================================================

function transformRole(row: RoleRow): Role {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		description: row.description,
		department: row.department,
		level: row.level,
		responsibilities: (row.responsibilities as string[]) ?? [],
		skillsRequired: (row.skillsRequired as string[]) ?? [],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function transformCompanyProfile(row: CompanyProfileRow): CompanyProfile {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		description: row.description,
		mission: row.mission,
		vision: row.vision,
		founded: row.founded,
		employees: row.employees,
		revenue: row.revenue,
		website: row.website,
		industry: row.industry,
		specialties: (row.specialties ?? []) as { name: string; description?: string }[],
		certifications: (row.certifications ?? []) as { name: string; issuer?: string; date?: string }[],
		awards: (row.awards ?? []) as { name: string; issuer?: string; year?: number }[],
		keyClients: (row.keyClients ?? []) as { name: string; industry?: string; duration?: string }[],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function transformProduct(row: ProductRow): Product {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		category: row.category,
		description: row.description,
		shortDescription: row.shortDescription,
		longDescription: row.longDescription,
		websiteUrl: row.websiteUrl,
		logoUrl: row.logoUrl,
		features: (row.features ?? []) as { name: string; description?: string }[],
		pricing: row.pricing,
		availability: row.availability,
		documentation: row.documentation,
		images: (row.images as string[]) ?? [],
		status: row.status as "active" | "discontinued" | "development",
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function transformService(row: ServiceRow): Service {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		category: row.category,
		description: row.description,
		capabilities: (row.capabilities ?? []) as { name: string; description?: string }[],
		pricing: row.pricing,
		turnaround: row.turnaround,
		certifications: (row.certifications as string[]) ?? [],
		status: row.status as "active" | "discontinued" | "limited",
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
