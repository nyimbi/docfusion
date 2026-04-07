/**
 * Pricing Repository - DocFusion
 *
 * Data access layer for the cost volume tables: labor categories,
 * cost elements, indirect rates, cost-technical tracking, BOE templates,
 * and pricing summaries.
 *
 * Query patterns mirrored from `actions/pricing.ts`:
 * - Labor category CRUD with organization scoping and bulk import
 * - Cost element CRUD with type/period/WBS/status filtering
 * - Indirect rate management
 * - Cost-technical alignment tracking
 * - BOE template management
 * - Pricing summary persistence
 * - Total cost calculations with indirect rate application
 */

import {
	SQL,
	and,
	eq,
	desc,
	asc,
	inArray,
	like,
	sql,
	count,
} from "drizzle-orm";
import {
	laborCategories,
	costElements,
	indirectRates,
	costTechnicalTracking,
	boeTemplates,
	pricingSummaries,
	type LaborCategory,
	type NewLaborCategory,
	type CostElement,
	type NewCostElement,
	type IndirectRate,
	type NewIndirectRate,
	type CostTechnicalTracking,
	type NewCostTechnicalTracking,
	type BoeTemplate,
	type NewBoeTemplate,
	type PricingSummary,
	type NewPricingSummary,
	type CostElementType,
	type CostElementStatus,
} from "@/lib/db/schema-pricing";
import { BaseRepository } from "./base-repository";

// ============================================================================
// Filter types
// ============================================================================

export interface CostElementFilters {
	elementType?: CostElementType | CostElementType[];
	periodNumber?: number;
	wbsCode?: string;
	technicalSectionId?: string;
	status?: CostElementStatus;
	limit?: number;
	offset?: number;
}

// ============================================================================
// Repository
// ============================================================================

export class PricingRepository extends BaseRepository<
	typeof costElements,
	CostElement,
	NewCostElement
> {
	constructor() {
		super(costElements);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Labor Categories
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List labor categories for an organization, sorted by name.
	 * Mirrors `listLaborCategories`.
	 */
	async getLaborCategories(organizationId: string): Promise<LaborCategory[]> {
		return this.db
			.select()
			.from(laborCategories)
			.where(eq(laborCategories.organizationId, organizationId))
			.orderBy(asc(laborCategories.name));
	}

	/**
	 * Get a single labor category by ID.
	 */
	async getLaborCategoryById(id: string): Promise<LaborCategory | null> {
		const [row] = await this.db
			.select()
			.from(laborCategories)
			.where(eq(laborCategories.id, id));
		return row ?? null;
	}

	/**
	 * Create a labor category.
	 */
	async createLaborCategory(data: NewLaborCategory): Promise<LaborCategory> {
		const [row] = await this.db
			.insert(laborCategories)
			.values(data)
			.returning();
		return row;
	}

	/**
	 * Update a labor category.
	 */
	async updateLaborCategory(id: string, data: Partial<LaborCategory>): Promise<LaborCategory | null> {
		const [row] = await this.db
			.update(laborCategories)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(laborCategories.id, id))
			.returning();
		return row ?? null;
	}

	/**
	 * Delete a labor category if not in use by any cost elements.
	 * Returns `false` if the category is referenced.
	 */
	async deleteLaborCategory(id: string): Promise<{ deleted: boolean; reason?: string }> {
		const [usage] = await this.db
			.select({ count: sql<number>`COUNT(*)` })
			.from(costElements)
			.where(eq(costElements.laborCategoryId, id));

		if ((usage?.count || 0) > 0) {
			return {
				deleted: false,
				reason: "Cannot delete labor category that is in use by cost elements. Deactivate it instead.",
			};
		}

		await this.db.delete(laborCategories).where(eq(laborCategories.id, id));
		return { deleted: true };
	}

	/**
	 * Bulk import labor categories.
	 */
	async bulkCreateLaborCategories(items: NewLaborCategory[]): Promise<number> {
		if (!items.length) return 0;
		const rows = await this.db.insert(laborCategories).values(items).returning();
		return rows.length;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Cost Elements
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List cost elements for an opportunity with optional filters.
	 * Mirrors `listCostElements`.
	 */
	async getCostElements(
		opportunityId: string,
		filters?: CostElementFilters,
	): Promise<CostElement[]> {
		const conditions: SQL[] = [eq(costElements.opportunityId, opportunityId)];

		if (filters?.elementType) {
			const types = Array.isArray(filters.elementType) ? filters.elementType : [filters.elementType];
			conditions.push(inArray(costElements.elementType, types));
		}
		if (filters?.periodNumber !== undefined) {
			conditions.push(eq(costElements.periodNumber, filters.periodNumber));
		}
		if (filters?.wbsCode) {
			conditions.push(like(costElements.wbsCode, `${filters.wbsCode}%`));
		}
		if (filters?.technicalSectionId) {
			conditions.push(eq(costElements.technicalSectionId, filters.technicalSectionId));
		}
		if (filters?.status) {
			conditions.push(eq(costElements.status, filters.status));
		}

		let query = this.db
			.select()
			.from(costElements)
			.where(and(...conditions))
			.orderBy(asc(costElements.wbsCode), asc(costElements.periodNumber));

		if (filters?.limit) {
			query = query.limit(filters.limit) as typeof query;
		}
		if (filters?.offset) {
			query = query.offset(filters.offset) as typeof query;
		}

		return query;
	}

	/**
	 * Get a single cost element by ID.
	 */
	async getCostElementById(id: string): Promise<CostElement | null> {
		const [row] = await this.db
			.select()
			.from(costElements)
			.where(eq(costElements.id, id));
		return row ?? null;
	}

	/**
	 * Create a cost element.
	 */
	async createCostElement(data: NewCostElement): Promise<CostElement> {
		const [row] = await this.db
			.insert(costElements)
			.values(data)
			.returning();
		return row;
	}

	/**
	 * Update a cost element.
	 */
	async updateCostElement(id: string, data: Partial<CostElement>): Promise<CostElement | null> {
		const [row] = await this.db
			.update(costElements)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(costElements.id, id))
			.returning();
		return row ?? null;
	}

	/**
	 * Delete a cost element.
	 */
	async deleteCostElement(id: string): Promise<boolean> {
		const result = await this.db
			.delete(costElements)
			.where(eq(costElements.id, id));
		return (result as any).rowCount > 0;
	}

	/**
	 * Duplicate a cost element, optionally for a different period.
	 * Mirrors `duplicateCostElement`.
	 */
	async duplicateCostElement(id: string, newPeriod?: number): Promise<CostElement | null> {
		const [original] = await this.db.select().from(costElements).where(eq(costElements.id, id));
		if (!original) return null;

		const { id: _id, createdAt, updatedAt, approvedBy, approvedAt, ...rest } = original;

		const [row] = await this.db
			.insert(costElements)
			.values({
				...rest,
				periodNumber: newPeriod ?? (original.periodNumber || 1),
				status: "draft",
			})
			.returning();

		return row ?? null;
	}

	/**
	 * Bulk update cost elements within a transaction.
	 * Mirrors `bulkUpdateCostElements`.
	 */
	async bulkUpdateCostElements(
		updates: { id: string; data: Partial<CostElement> }[],
	): Promise<void> {
		await this.db.transaction(async (tx) => {
			for (const update of updates) {
				await tx
					.update(costElements)
					.set({ ...update.data, updatedAt: new Date() })
					.where(eq(costElements.id, update.id));
			}
		});
	}

	/**
	 * Link/unlink a cost element to a technical section.
	 */
	async linkCostToTechnical(costElementId: string, technicalSectionId: string | null): Promise<void> {
		await this.db
			.update(costElements)
			.set({ technicalSectionId, updatedAt: new Date() })
			.where(eq(costElements.id, costElementId));
	}

	// ──────────────────────────────────────────────────────────────────────
	// Indirect Rates
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List indirect rates for an organization.
	 */
	async getIndirectRates(organizationId: string): Promise<IndirectRate[]> {
		return this.db
			.select()
			.from(indirectRates)
			.where(eq(indirectRates.organizationId, organizationId))
			.orderBy(asc(indirectRates.rateType), desc(indirectRates.effectiveStartDate));
	}

	/**
	 * Create an indirect rate.
	 */
	async createIndirectRate(data: NewIndirectRate): Promise<IndirectRate> {
		const [row] = await this.db
			.insert(indirectRates)
			.values(data)
			.returning();
		return row;
	}

	/**
	 * Update an indirect rate.
	 */
	async updateIndirectRate(id: string, data: Partial<IndirectRate>): Promise<IndirectRate | null> {
		const [row] = await this.db
			.update(indirectRates)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(indirectRates.id, id))
			.returning();
		return row ?? null;
	}

	/**
	 * Delete an indirect rate.
	 */
	async deleteIndirectRate(id: string): Promise<boolean> {
		const result = await this.db
			.delete(indirectRates)
			.where(eq(indirectRates.id, id));
		return (result as any).rowCount > 0;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Pricing Calculations
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Calculate total costs for an opportunity across all periods.
	 * Returns aggregate sums by element type with grand totals.
	 *
	 * Mirrors the calculation logic in `calculatePricingSummary`.
	 */
	async calculateTotals(opportunityId: string): Promise<{
		laborCost: number;
		odcCost: number;
		subcontractCost: number;
		travelCost: number;
		materialCost: number;
		totalDirectCost: number;
		elementCount: number;
	}> {
		const [result] = await this.db
			.select({
				laborCost: sql<number>`COALESCE(SUM(CASE WHEN ${costElements.elementType} = 'labor' THEN ${costElements.totalCost} ELSE 0 END), 0)`,
				odcCost: sql<number>`COALESCE(SUM(CASE WHEN ${costElements.elementType} = 'odc' THEN ${costElements.totalCost} ELSE 0 END), 0)`,
				subcontractCost: sql<number>`COALESCE(SUM(CASE WHEN ${costElements.elementType} = 'subcontract' THEN ${costElements.totalCost} ELSE 0 END), 0)`,
				travelCost: sql<number>`COALESCE(SUM(CASE WHEN ${costElements.elementType} = 'travel' THEN ${costElements.totalCost} ELSE 0 END), 0)`,
				materialCost: sql<number>`COALESCE(SUM(CASE WHEN ${costElements.elementType} = 'material' THEN ${costElements.totalCost} ELSE 0 END), 0)`,
				totalDirectCost: sql<number>`COALESCE(SUM(${costElements.totalCost}), 0)`,
				elementCount: count(),
			})
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		return {
			laborCost: result?.laborCost ?? 0,
			odcCost: result?.odcCost ?? 0,
			subcontractCost: result?.subcontractCost ?? 0,
			travelCost: result?.travelCost ?? 0,
			materialCost: result?.materialCost ?? 0,
			totalDirectCost: result?.totalDirectCost ?? 0,
			elementCount: result?.elementCount ?? 0,
		};
	}

	// ──────────────────────────────────────────────────────────────────────
	// Cost-Technical Tracking
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get all tracking records for an opportunity.
	 */
	async getCostTechnicalTracking(opportunityId: string): Promise<CostTechnicalTracking[]> {
		return this.db
			.select()
			.from(costTechnicalTracking)
			.where(eq(costTechnicalTracking.opportunityId, opportunityId));
	}

	/**
	 * Create or update a cost-technical tracking record.
	 */
	async upsertCostTechnicalTracking(data: NewCostTechnicalTracking): Promise<CostTechnicalTracking> {
		// Check for existing record by opportunity + section
		if (data.opportunityId && data.technicalSectionId) {
			const [existing] = await this.db
				.select()
				.from(costTechnicalTracking)
				.where(
					and(
						eq(costTechnicalTracking.opportunityId, data.opportunityId),
						eq(costTechnicalTracking.technicalSectionId, data.technicalSectionId!),
					),
				)
				.limit(1);

			if (existing) {
				const [row] = await this.db
					.update(costTechnicalTracking)
					.set({ ...data, updatedAt: new Date() })
					.where(eq(costTechnicalTracking.id, existing.id))
					.returning();
				return row;
			}
		}

		const [row] = await this.db
			.insert(costTechnicalTracking)
			.values(data)
			.returning();
		return row;
	}

	// ──────────────────────────────────────────────────────────────────────
	// BOE Templates
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * List BOE templates, optionally filtered by cost element type.
	 */
	async getBoeTemplates(costElementType?: CostElementType): Promise<BoeTemplate[]> {
		if (costElementType) {
			return this.db
				.select()
				.from(boeTemplates)
				.where(eq(boeTemplates.costElementType, costElementType))
				.orderBy(asc(boeTemplates.name));
		}
		return this.db
			.select()
			.from(boeTemplates)
			.orderBy(asc(boeTemplates.name));
	}

	/**
	 * Create a BOE template.
	 */
	async createBoeTemplate(data: NewBoeTemplate): Promise<BoeTemplate> {
		const [row] = await this.db
			.insert(boeTemplates)
			.values(data)
			.returning();
		return row;
	}

	/**
	 * Update a BOE template.
	 */
	async updateBoeTemplate(id: string, data: Partial<BoeTemplate>): Promise<BoeTemplate | null> {
		const [row] = await this.db
			.update(boeTemplates)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(boeTemplates.id, id))
			.returning();
		return row ?? null;
	}

	/**
	 * Delete a BOE template.
	 */
	async deleteBoeTemplate(id: string): Promise<boolean> {
		const result = await this.db
			.delete(boeTemplates)
			.where(eq(boeTemplates.id, id));
		return (result as any).rowCount > 0;
	}

	// ──────────────────────────────────────────────────────────────────────
	// Pricing Summaries
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Get the pricing summary for an opportunity.
	 */
	async getPricingSummary(opportunityId: string): Promise<PricingSummary | null> {
		const [row] = await this.db
			.select()
			.from(pricingSummaries)
			.where(eq(pricingSummaries.opportunityId, opportunityId))
			.orderBy(desc(pricingSummaries.updatedAt))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Create or update a pricing summary.
	 */
	async upsertPricingSummary(data: NewPricingSummary): Promise<PricingSummary> {
		if (data.opportunityId) {
			const existing = await this.getPricingSummary(data.opportunityId);
			if (existing) {
				const [row] = await this.db
					.update(pricingSummaries)
					.set({ ...data, updatedAt: new Date() })
					.where(eq(pricingSummaries.id, existing.id))
					.returning();
				return row;
			}
		}

		const [row] = await this.db
			.insert(pricingSummaries)
			.values(data)
			.returning();
		return row;
	}
}
