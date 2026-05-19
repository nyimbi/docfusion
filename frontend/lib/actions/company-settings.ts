/**
 * Company Settings Server Actions - DocFusion
 *
 * Server actions for managing company/organization profile and settings.
 * Provides persistent storage for company information used across proposals.
 */

"use server";

import { db } from "@/lib/db";
import { requireUserContext } from "@/lib/auth-utils";
import { companySettings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type {
	CompanySettings,
	CompanySettingsInput,
	BrandingConfig,
	SmallBusinessCertification,
} from "@/lib/types/opportunity";

// ============================================================================
// Company Settings Operations
// ============================================================================

interface CompanySettingsContext {
	userId: string;
	organizationId: string;
}

async function requireCompanySettingsContext(): Promise<CompanySettingsContext> {
	const context = await requireUserContext();
	if (!context.organizationId) {
		throw new Error("Organization context required");
	}
	return {
		userId: context.userId,
		organizationId: context.organizationId,
	};
}

async function getCompanySettingsForOrganization(
	organizationId: string
): Promise<CompanySettings | null> {
	const [row] = await db
		.select()
		.from(companySettings)
		.where(eq(companySettings.organizationId, organizationId))
		.limit(1);

	return row ? mapToCompanySettings(row) : null;
}

/**
 * Get the company settings.
 * Returns null if no settings exist yet.
 */
export async function getCompanySettings(): Promise<CompanySettings | null> {
	const context = await requireCompanySettingsContext();
	return getCompanySettingsForOrganization(context.organizationId);
}

/**
 * Create or update company settings.
 * Since there's only one company settings record, this upserts.
 */
export async function saveCompanySettings(
	input: CompanySettingsInput
): Promise<CompanySettings> {
	const context = await requireCompanySettingsContext();
	const existing = await getCompanySettingsForOrganization(context.organizationId);

	if (existing) {
		// Update existing
		const [updated] = await db
			.update(companySettings)
			.set({
				companyName: input.companyName,
				legalName: input.legalName ?? null,
				registrationNumber: input.registrationNumber ?? null,
				taxId: input.taxId ?? null,
				dunsNumber: input.dunsNumber ?? null,
				cageCode: input.cageCode ?? null,
				samUei: input.samUei ?? null,
				naicsCodes: input.naicsCodes ?? [],
				industryDescription: input.industryDescription ?? null,
				yearFounded: input.yearFounded ?? null,
				employeeCount: input.employeeCount ?? null,
				annualRevenue: input.annualRevenue ?? null,
				certifications: input.certifications ?? [],
				website: input.website ?? null,
				addressLine1: input.addressLine1 ?? null,
				addressLine2: input.addressLine2 ?? null,
				city: input.city ?? null,
				stateProvince: input.stateProvince ?? null,
				postalCode: input.postalCode ?? null,
				country: input.country ?? null,
				primaryContactName: input.primaryContactName ?? null,
				primaryContactTitle: input.primaryContactTitle ?? null,
				primaryContactEmail: input.primaryContactEmail ?? null,
				primaryContactPhone: input.primaryContactPhone ?? null,
				contractsContactName: input.contractsContactName ?? null,
				contractsContactEmail: input.contractsContactEmail ?? null,
				contractsContactPhone: input.contractsContactPhone ?? null,
				coreCapabilities: input.coreCapabilities ?? [],
				differentiators: input.differentiators ?? [],
				pastPerformanceSummary: input.pastPerformanceSummary ?? null,
				companyBoilerplate: input.companyBoilerplate ?? null,
				logoUrl: input.logoUrl ?? null,
				primaryColor: input.primaryColor ?? null,
				secondaryColor: input.secondaryColor ?? null,
				defaultBranding: input.defaultBranding ?? null,
				customFields: input.customFields ?? {},
				updatedAt: new Date(),
			})
			.where(and(
				eq(companySettings.id, existing.id),
				eq(companySettings.organizationId, context.organizationId)
			))
			.returning();

		return mapToCompanySettings(updated);
	} else {
		// Create new
		const [created] = await db
			.insert(companySettings)
			.values({
				organizationId: context.organizationId,
				companyName: input.companyName,
				legalName: input.legalName ?? null,
				registrationNumber: input.registrationNumber ?? null,
				taxId: input.taxId ?? null,
				dunsNumber: input.dunsNumber ?? null,
				cageCode: input.cageCode ?? null,
				samUei: input.samUei ?? null,
				naicsCodes: input.naicsCodes ?? [],
				industryDescription: input.industryDescription ?? null,
				yearFounded: input.yearFounded ?? null,
				employeeCount: input.employeeCount ?? null,
				annualRevenue: input.annualRevenue ?? null,
				certifications: input.certifications ?? [],
				website: input.website ?? null,
				addressLine1: input.addressLine1 ?? null,
				addressLine2: input.addressLine2 ?? null,
				city: input.city ?? null,
				stateProvince: input.stateProvince ?? null,
				postalCode: input.postalCode ?? null,
				country: input.country ?? null,
				primaryContactName: input.primaryContactName ?? null,
				primaryContactTitle: input.primaryContactTitle ?? null,
				primaryContactEmail: input.primaryContactEmail ?? null,
				primaryContactPhone: input.primaryContactPhone ?? null,
				contractsContactName: input.contractsContactName ?? null,
				contractsContactEmail: input.contractsContactEmail ?? null,
				contractsContactPhone: input.contractsContactPhone ?? null,
				coreCapabilities: input.coreCapabilities ?? [],
				differentiators: input.differentiators ?? [],
				pastPerformanceSummary: input.pastPerformanceSummary ?? null,
				companyBoilerplate: input.companyBoilerplate ?? null,
				logoUrl: input.logoUrl ?? null,
				primaryColor: input.primaryColor ?? null,
				secondaryColor: input.secondaryColor ?? null,
				defaultBranding: input.defaultBranding ?? null,
				customFields: input.customFields ?? {},
			})
			.returning();

		return mapToCompanySettings(created);
	}
}

/**
 * Update specific fields of company settings.
 */
export async function updateCompanySettings(
	updates: Partial<CompanySettingsInput>
): Promise<CompanySettings> {
	const context = await requireCompanySettingsContext();
	const existing = await getCompanySettingsForOrganization(context.organizationId);

	if (!existing) {
		throw new Error("Company settings not found. Create settings first.");
	}

	// Build update object with only provided fields
	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	if (updates.companyName !== undefined) updateData.companyName = updates.companyName;
	if (updates.legalName !== undefined) updateData.legalName = updates.legalName;
	if (updates.registrationNumber !== undefined) updateData.registrationNumber = updates.registrationNumber;
	if (updates.taxId !== undefined) updateData.taxId = updates.taxId;
	if (updates.dunsNumber !== undefined) updateData.dunsNumber = updates.dunsNumber;
	if (updates.cageCode !== undefined) updateData.cageCode = updates.cageCode;
	if (updates.samUei !== undefined) updateData.samUei = updates.samUei;
	if (updates.naicsCodes !== undefined) updateData.naicsCodes = updates.naicsCodes;
	if (updates.industryDescription !== undefined) updateData.industryDescription = updates.industryDescription;
	if (updates.yearFounded !== undefined) updateData.yearFounded = updates.yearFounded;
	if (updates.employeeCount !== undefined) updateData.employeeCount = updates.employeeCount;
	if (updates.annualRevenue !== undefined) updateData.annualRevenue = updates.annualRevenue;
	if (updates.certifications !== undefined) updateData.certifications = updates.certifications;
	if (updates.website !== undefined) updateData.website = updates.website;
	if (updates.addressLine1 !== undefined) updateData.addressLine1 = updates.addressLine1;
	if (updates.addressLine2 !== undefined) updateData.addressLine2 = updates.addressLine2;
	if (updates.city !== undefined) updateData.city = updates.city;
	if (updates.stateProvince !== undefined) updateData.stateProvince = updates.stateProvince;
	if (updates.postalCode !== undefined) updateData.postalCode = updates.postalCode;
	if (updates.country !== undefined) updateData.country = updates.country;
	if (updates.primaryContactName !== undefined) updateData.primaryContactName = updates.primaryContactName;
	if (updates.primaryContactTitle !== undefined) updateData.primaryContactTitle = updates.primaryContactTitle;
	if (updates.primaryContactEmail !== undefined) updateData.primaryContactEmail = updates.primaryContactEmail;
	if (updates.primaryContactPhone !== undefined) updateData.primaryContactPhone = updates.primaryContactPhone;
	if (updates.contractsContactName !== undefined) updateData.contractsContactName = updates.contractsContactName;
	if (updates.contractsContactEmail !== undefined) updateData.contractsContactEmail = updates.contractsContactEmail;
	if (updates.contractsContactPhone !== undefined) updateData.contractsContactPhone = updates.contractsContactPhone;
	if (updates.coreCapabilities !== undefined) updateData.coreCapabilities = updates.coreCapabilities;
	if (updates.differentiators !== undefined) updateData.differentiators = updates.differentiators;
	if (updates.pastPerformanceSummary !== undefined) updateData.pastPerformanceSummary = updates.pastPerformanceSummary;
	if (updates.companyBoilerplate !== undefined) updateData.companyBoilerplate = updates.companyBoilerplate;
	if (updates.logoUrl !== undefined) updateData.logoUrl = updates.logoUrl;
	if (updates.primaryColor !== undefined) updateData.primaryColor = updates.primaryColor;
	if (updates.secondaryColor !== undefined) updateData.secondaryColor = updates.secondaryColor;
	if (updates.defaultBranding !== undefined) updateData.defaultBranding = updates.defaultBranding;
	if (updates.customFields !== undefined) updateData.customFields = updates.customFields;

	const [updated] = await db
		.update(companySettings)
		.set(updateData)
		.where(and(
			eq(companySettings.id, existing.id),
			eq(companySettings.organizationId, context.organizationId)
		))
		.returning();

	return mapToCompanySettings(updated);
}

/**
 * Get branding config from company settings.
 */
export async function getDefaultBranding(): Promise<BrandingConfig | null> {
	const settings = await getCompanySettings();

	if (!settings) {
		return null;
	}

	// Return custom branding if set, otherwise build from company info
	if (settings.defaultBranding) {
		return settings.defaultBranding;
	}

	// Build branding from company settings
	return {
		id: "default",
		name: "Default",
		companyName: settings.companyName,
		logoUrl: settings.logoUrl ?? undefined,
		primaryColor: settings.primaryColor ?? "#2563eb",
		secondaryColor: settings.secondaryColor ?? "#64748b",
		contactInfo: {
			address: [
				settings.addressLine1,
				settings.addressLine2,
				[settings.city, settings.stateProvince, settings.postalCode]
					.filter(Boolean)
					.join(", "),
				settings.country,
			]
				.filter(Boolean)
				.join("\n") || undefined,
			phone: settings.primaryContactPhone ?? undefined,
			email: settings.primaryContactEmail ?? undefined,
			website: settings.website ?? undefined,
		},
	};
}

/**
 * Check if company settings are configured.
 */
export async function isCompanyConfigured(): Promise<boolean> {
	const settings = await getCompanySettings();
	return settings !== null && settings.companyName.length > 0;
}

/**
 * Get company boilerplate text for use in proposals.
 */
export async function getCompanyBoilerplate(): Promise<string | null> {
	const settings = await getCompanySettings();
	return settings?.companyBoilerplate ?? null;
}

/**
 * Get company capabilities for proposal generation.
 */
export async function getCompanyCapabilities(): Promise<{
	capabilities: string[];
	differentiators: string[];
	certifications: SmallBusinessCertification[];
}> {
	const settings = await getCompanySettings();

	return {
		capabilities: settings?.coreCapabilities ?? [],
		differentiators: settings?.differentiators ?? [],
		certifications: settings?.certifications ?? [],
	};
}

// ============================================================================
// Helpers
// ============================================================================

function mapToCompanySettings(
	row: typeof companySettings.$inferSelect
): CompanySettings {
	return {
		id: row.id,
		companyName: row.companyName,
		legalName: row.legalName,
		registrationNumber: row.registrationNumber,
		taxId: row.taxId,
		dunsNumber: row.dunsNumber,
		cageCode: row.cageCode,
		samUei: row.samUei,
		naicsCodes: (row.naicsCodes as string[]) ?? [],
		industryDescription: row.industryDescription,
		yearFounded: row.yearFounded,
		employeeCount: row.employeeCount,
		annualRevenue: row.annualRevenue,
		certifications: (row.certifications as SmallBusinessCertification[]) ?? [],
		website: row.website,
		addressLine1: row.addressLine1,
		addressLine2: row.addressLine2,
		city: row.city,
		stateProvince: row.stateProvince,
		postalCode: row.postalCode,
		country: row.country,
		primaryContactName: row.primaryContactName,
		primaryContactTitle: row.primaryContactTitle,
		primaryContactEmail: row.primaryContactEmail,
		primaryContactPhone: row.primaryContactPhone,
		contractsContactName: row.contractsContactName,
		contractsContactEmail: row.contractsContactEmail,
		contractsContactPhone: row.contractsContactPhone,
		coreCapabilities: (row.coreCapabilities as string[]) ?? [],
		differentiators: (row.differentiators as string[]) ?? [],
		pastPerformanceSummary: row.pastPerformanceSummary,
		companyBoilerplate: row.companyBoilerplate,
		logoUrl: row.logoUrl,
		primaryColor: row.primaryColor,
		secondaryColor: row.secondaryColor,
		defaultBranding: row.defaultBranding as BrandingConfig | null,
		customFields: (row.customFields as Record<string, unknown>) ?? {},
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
