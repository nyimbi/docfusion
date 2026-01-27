/**
 * Partners Page - DocFusion
 *
 * Partner directory and management.
 */

import { Suspense } from "react";
import { db } from "@/lib/db";
import { partners, opportunityPartners } from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { PartnersClientPage } from "./PartnersClientPage";
import type { PartnerListItem, PartnerType, PartnerStatus } from "@/lib/types/opportunity";

// ============================================================================
// Page Component
// ============================================================================

export default async function PartnersPage() {
	// Get all partners
	const partnerRows = await db.select().from(partners).orderBy(partners.name);

	// Get active opportunity counts
	const activeOpportunityCounts = await db
		.select({
			partnerId: opportunityPartners.partnerId,
			count: sql<number>`count(*)::int`,
		})
		.from(opportunityPartners)
		.where(
			inArray(opportunityPartners.status, ["invited", "accepted", "active"])
		)
		.groupBy(opportunityPartners.partnerId);

	const countMap = new Map(
		activeOpportunityCounts.map((c) => [c.partnerId, c.count])
	);

	// Transform to PartnerListItem
	const partnerList: PartnerListItem[] = partnerRows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.type as PartnerType | null,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		capabilities: (row.capabilities || []) as string[],
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
		status: row.status as PartnerStatus,
		activeOpportunities: countMap.get(row.id) || 0,
	}));

	// Get unique capabilities for filter
	const allCapabilities = new Set<string>();
	for (const partner of partnerList) {
		for (const cap of partner.capabilities) {
			allCapabilities.add(cap);
		}
	}

	return (
		<div className="min-h-screen bg-[var(--background-muted)]">
			{/* Header */}
			<header className="bg-[var(--background)] border-b border-[var(--border)]">
				<div className="max-w-7xl mx-auto px-6 py-6">
					<h1 className="text-2xl font-bold text-[var(--foreground)]">
						Partner Directory
					</h1>
					<p className="text-[var(--foreground-muted)] mt-1">
						Manage partner organizations and collaborations
					</p>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto px-6 py-8">
				<Suspense
					fallback={
						<div className="flex items-center justify-center h-64">
							<div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
						</div>
					}
				>
					<PartnersClientPage
						initialPartners={partnerList}
						capabilities={Array.from(allCapabilities).sort()}
					/>
				</Suspense>
			</main>
		</div>
	);
}
