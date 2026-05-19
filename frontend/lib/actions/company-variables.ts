/**
 * Company Variables Server Actions - DocFusion
 *
 * Server actions for managing custom company variables that can be used
 * in document templates for dynamic content substitution.
 */

"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
	companyVariables,
	companySettings,
	products,
	type CompanyVariableRow,
} from "@/lib/db/schema";
import { eq, and, ilike, desc, asc, sql } from "drizzle-orm";
import type {
	CompanyVariable,
	CreateVariableInput,
	UpdateVariableInput,
	VariableFilters,
	VariableCategory,
	VariableValueType,
} from "@/lib/types/company";

// ============================================================================
// Configuration
// ============================================================================

/** Organization ID for Datacraft */
const ORGANIZATION_ID = "datacraft";

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

// ============================================================================
// Company Variables CRUD
// ============================================================================

/**
 * Get all company variables with optional filtering.
 */
export async function getCompanyVariables(
	filters?: VariableFilters
): Promise<CompanyVariable[]> {
	await requireCurrentUserId();

	const conditions = [eq(companyVariables.organizationId, ORGANIZATION_ID)];

	if (filters?.search) {
		conditions.push(
			ilike(companyVariables.name, `%${filters.search}%`)
		);
	}

	if (filters?.category) {
		conditions.push(eq(companyVariables.category, filters.category));
	}

	if (filters?.isActive !== undefined) {
		conditions.push(eq(companyVariables.isActive, filters.isActive));
	}

	const rows = await db
		.select()
		.from(companyVariables)
		.where(and(...conditions))
		.orderBy(companyVariables.category, asc(companyVariables.sortOrder), companyVariables.name);

	return rows.map(transformVariable);
}

/**
 * Get a single company variable by ID.
 */
export async function getCompanyVariable(id: string): Promise<CompanyVariable | null> {
	await requireCurrentUserId();

	const [row] = await db
		.select()
		.from(companyVariables)
		.where(and(eq(companyVariables.id, id), eq(companyVariables.organizationId, ORGANIZATION_ID)));

	return row ? transformVariable(row) : null;
}

/**
 * Get a company variable by name.
 */
export async function getCompanyVariableByName(name: string): Promise<CompanyVariable | null> {
	await requireCurrentUserId();

	const [row] = await db
		.select()
		.from(companyVariables)
		.where(and(
			eq(companyVariables.name, name),
			eq(companyVariables.organizationId, ORGANIZATION_ID)
		));

	return row ? transformVariable(row) : null;
}

/**
 * Create a new company variable.
 */
export async function createCompanyVariable(
	input: CreateVariableInput
): Promise<CompanyVariable> {
	await requireCurrentUserId();

	// Validate name format (must be a valid identifier)
	const nameRegex = /^[a-z][a-z0-9_]*$/i;
	if (!nameRegex.test(input.name)) {
		throw new Error(
			"Variable name must start with a letter and contain only letters, numbers, and underscores"
		);
	}

	// Check for duplicate name
	const existing = await getCompanyVariableByName(input.name);
	if (existing) {
		throw new Error(`A variable with the name "${input.name}" already exists`);
	}

	// Get next sort order for category
	const [maxOrder] = await db
		.select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), 0)` })
		.from(companyVariables)
		.where(and(
			eq(companyVariables.organizationId, ORGANIZATION_ID),
			input.category ? eq(companyVariables.category, input.category) : sql`TRUE`
		));

	const [row] = await db
		.insert(companyVariables)
		.values({
			organizationId: ORGANIZATION_ID,
			name: input.name,
			label: input.label,
			value: input.value ?? null,
			description: input.description ?? null,
			valueType: input.valueType ?? "text",
			category: input.category ?? "custom",
			sortOrder: input.sortOrder ?? (Number(maxOrder?.maxOrder ?? 0) + 1),
			isActive: true,
		})
		.returning();

	return transformVariable(row);
}

/**
 * Update a company variable.
 */
export async function updateCompanyVariable(
	id: string,
	input: UpdateVariableInput
): Promise<CompanyVariable> {
	await requireCurrentUserId();

	// If updating name, validate format and check for duplicates
	if (input.name !== undefined) {
		const nameRegex = /^[a-z][a-z0-9_]*$/i;
		if (!nameRegex.test(input.name)) {
			throw new Error(
				"Variable name must start with a letter and contain only letters, numbers, and underscores"
			);
		}

		const existing = await getCompanyVariableByName(input.name);
		if (existing && existing.id !== id) {
			throw new Error(`A variable with the name "${input.name}" already exists`);
		}
	}

	const updateData: Partial<CompanyVariableRow> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.label !== undefined) updateData.label = input.label;
	if (input.value !== undefined) updateData.value = input.value;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.valueType !== undefined) updateData.valueType = input.valueType;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
	if (input.isActive !== undefined) updateData.isActive = input.isActive;

	const [row] = await db
		.update(companyVariables)
		.set(updateData)
		.where(and(eq(companyVariables.id, id), eq(companyVariables.organizationId, ORGANIZATION_ID)))
		.returning();

	if (!row) {
		throw new Error(`Variable ${id} not found`);
	}

	return transformVariable(row);
}

/**
 * Delete a company variable.
 */
export async function deleteCompanyVariable(id: string): Promise<void> {
	await requireCurrentUserId();

	await db
		.delete(companyVariables)
		.where(and(eq(companyVariables.id, id), eq(companyVariables.organizationId, ORGANIZATION_ID)));
}

/**
 * Update sort order for multiple variables (for drag-and-drop reordering).
 */
export async function updateVariableSortOrder(
	updates: { id: string; sortOrder: number }[]
): Promise<void> {
	await requireCurrentUserId();

	for (const update of updates) {
		await db
			.update(companyVariables)
			.set({ sortOrder: update.sortOrder, updatedAt: new Date() })
			.where(and(
				eq(companyVariables.id, update.id),
				eq(companyVariables.organizationId, ORGANIZATION_ID)
			));
	}
}

/**
 * Get unique variable categories.
 */
export async function getVariableCategories(): Promise<string[]> {
	await requireCurrentUserId();

	const rows = await db
		.select({ category: companyVariables.category })
		.from(companyVariables)
		.where(eq(companyVariables.organizationId, ORGANIZATION_ID))
		.groupBy(companyVariables.category)
		.orderBy(companyVariables.category);

	return rows.map((r) => r.category).filter(Boolean) as string[];
}

// ============================================================================
// Template Variable Resolution
// ============================================================================

/**
 * Get all template variables for document generation.
 * Returns a flat object with all company, product, and custom variables.
 *
 * Variable naming convention:
 * - company.name - Formal company name
 * - company.shortName - Short/abbreviated name
 * - company.colloquialName - Informal name
 * - company.address.city - City
 * - company.primaryContact.name - Primary contact name
 * - company.legal.taxId - Tax ID
 * - product.ProductName.shortDescription - Product short description
 * - custom.variableName - Custom variable
 */
export async function getAllTemplateVariables(): Promise<Record<string, string | null>> {
	await requireCurrentUserId();

	const variables: Record<string, string | null> = {};

	// Get company settings
	const [settings] = await db
		.select()
		.from(companySettings)
		.limit(1);

	if (settings) {
		// Company identity
		variables["company.name"] = settings.companyName;
		variables["company.shortName"] = settings.shortName;
		variables["company.colloquialName"] = settings.colloquialName;
		variables["company.legalName"] = settings.legalName;
		variables["company.website"] = settings.website;
		variables["company.areaOfBusiness"] = settings.areaOfBusiness;
		variables["company.logoUrl"] = settings.logoImageUrl || settings.logoUrl;
		variables["company.logoIconUrl"] = settings.logoIconUrl;

		// Company address
		variables["company.address.line1"] = settings.addressLine1;
		variables["company.address.line2"] = settings.addressLine2;
		variables["company.address.suite"] = settings.addressSuite;
		variables["company.address.city"] = settings.city;
		variables["company.address.stateProvince"] = settings.stateProvince;
		variables["company.address.postalCode"] = settings.postalCode;
		variables["company.address.country"] = settings.country;

		// Full formatted address
		const addressParts = [
			settings.addressLine1,
			settings.addressLine2,
			settings.addressSuite,
			[settings.city, settings.stateProvince, settings.postalCode].filter(Boolean).join(", "),
			settings.country,
		].filter(Boolean);
		variables["company.address.full"] = addressParts.join("\n") || null;

		// Company contacts
		variables["company.generalEmail"] = settings.generalEmail;
		variables["company.generalPhone"] = settings.generalPhone;
		variables["company.primaryContact.name"] = settings.primaryContactName;
		variables["company.primaryContact.title"] = settings.primaryContactTitle;
		variables["company.primaryContact.email"] = settings.primaryContactEmail;
		variables["company.primaryContact.phone"] = settings.primaryContactPhone;
		variables["company.contractsContact.name"] = settings.contractsContactName;
		variables["company.contractsContact.title"] = settings.contractsContactTitle;
		variables["company.contractsContact.email"] = settings.contractsContactEmail;
		variables["company.contractsContact.phone"] = settings.contractsContactPhone;

		// Company legal/tax info
		variables["company.legal.registrationNumber"] = settings.registrationNumber;
		variables["company.legal.registrationCountry"] = settings.registrationCountry;
		variables["company.legal.taxId"] = settings.taxId;
		variables["company.legal.vatNumber"] = settings.vatNumber;
		variables["company.legal.dunsNumber"] = settings.dunsNumber;
		variables["company.legal.cageCode"] = settings.cageCode;
		variables["company.legal.samUei"] = settings.samUei;

		// NAICS codes as comma-separated
		const naicsCodes = settings.naicsCodes as string[] | null;
		variables["company.legal.naicsCodes"] = naicsCodes?.join(", ") || null;

		// Company metadata
		variables["company.yearFounded"] = settings.yearFounded?.toString() ?? null;
		variables["company.employeeCount"] = settings.employeeCount?.toString() ?? null;
		variables["company.annualRevenue"] = settings.annualRevenue;
		variables["company.industryDescription"] = settings.industryDescription;

		// Branding
		variables["company.branding.primaryColor"] = settings.primaryColor;
		variables["company.branding.secondaryColor"] = settings.secondaryColor;

		// Content
		variables["company.pastPerformanceSummary"] = settings.pastPerformanceSummary;
		variables["company.boilerplate"] = settings.companyBoilerplate;

		// Core capabilities as bullet list
		const capabilities = settings.coreCapabilities as string[] | null;
		variables["company.coreCapabilities"] = capabilities?.join("\n• ")
			? "• " + capabilities?.join("\n• ")
			: null;

		// Differentiators as bullet list
		const differentiators = settings.differentiators as string[] | null;
		variables["company.differentiators"] = differentiators?.join("\n• ")
			? "• " + differentiators?.join("\n• ")
			: null;
	}

	// Get products
	const productRows = await db
		.select()
		.from(products)
		.where(eq(products.organizationId, ORGANIZATION_ID));

	for (const product of productRows) {
		const safeName = product.name.replace(/[^a-zA-Z0-9]/g, "_");
		variables[`product.${safeName}.name`] = product.name;
		variables[`product.${safeName}.category`] = product.category;
		variables[`product.${safeName}.description`] = product.description;
		variables[`product.${safeName}.shortDescription`] = product.shortDescription;
		variables[`product.${safeName}.longDescription`] = product.longDescription;
		variables[`product.${safeName}.websiteUrl`] = product.websiteUrl;
		variables[`product.${safeName}.logoUrl`] = product.logoUrl;
		variables[`product.${safeName}.pricing`] = product.pricing;
		variables[`product.${safeName}.availability`] = product.availability;
		variables[`product.${safeName}.documentation`] = product.documentation;

		// Features as comma-separated list
		const features = product.features as { name: string }[] | null;
		variables[`product.${safeName}.features`] = features?.map(f => f.name).join(", ") || null;
	}

	// Get custom variables
	const customVars = await db
		.select()
		.from(companyVariables)
		.where(and(
			eq(companyVariables.organizationId, ORGANIZATION_ID),
			eq(companyVariables.isActive, true)
		));

	for (const v of customVars) {
		variables[`custom.${v.name}`] = v.value;
	}

	return variables;
}

/**
 * Get a preview of a template variable's resolved value.
 * Useful for UI to show what a variable will resolve to.
 */
export async function previewTemplateVariable(
	variablePath: string
): Promise<string | null> {
	await requireCurrentUserId();

	const allVars = await getAllTemplateVariables();
	return allVars[variablePath] ?? null;
}

/**
 * Validate a variable name for template use.
 */
export async function validateVariableName(name: string): Promise<{
	valid: boolean;
	error?: string;
}> {
	await requireCurrentUserId();

	if (!name) {
		return { valid: false, error: "Variable name is required" };
	}

	if (name.length < 2) {
		return { valid: false, error: "Variable name must be at least 2 characters" };
	}

	if (name.length > 50) {
		return { valid: false, error: "Variable name must be 50 characters or less" };
	}

	const nameRegex = /^[a-z][a-z0-9_]*$/i;
	if (!nameRegex.test(name)) {
		return {
			valid: false,
			error: "Variable name must start with a letter and contain only letters, numbers, and underscores",
		};
	}

	// Reserved prefixes that would conflict with system variables
	const reservedPrefixes = ["company", "product", "document", "user", "date", "time"];
	if (reservedPrefixes.includes(name.toLowerCase())) {
		return {
			valid: false,
			error: `"${name}" is a reserved variable name`,
		};
	}

	return { valid: true };
}

// ============================================================================
// Transformers
// ============================================================================

function transformVariable(row: CompanyVariableRow): CompanyVariable {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		label: row.label,
		value: row.value,
		description: row.description,
		valueType: row.valueType as VariableValueType,
		category: row.category as VariableCategory | null,
		sortOrder: row.sortOrder,
		isActive: row.isActive,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
