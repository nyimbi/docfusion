/**
 * Partners Page - CRM Module
 *
 * Database-driven partners organized by region and country.
 * Now integrated as part of the CRM module for unified relationship management.
 */

import { Suspense } from "react";
import { getPartnersGroupedByRegion, getPartnerStats } from "@/lib/actions/partners";
import { PartnersContent } from "./partners-content";
import { Skeleton } from "@/components/ui/skeleton";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Partners",
	description: "Manage partner organizations and relationships",
};

// Force dynamic rendering - this page fetches data that changes frequently
export const dynamic = "force-dynamic";

export default async function PartnersPage() {
	return (
		<div className="h-full flex flex-col overflow-hidden">
			<Suspense fallback={<PartnersLoadingSkeleton />}>
				<PartnersDataLoader />
			</Suspense>
		</div>
	);
}

async function PartnersDataLoader() {
	const [groupedPartners, stats] = await Promise.all([
		getPartnersGroupedByRegion(),
		getPartnerStats(),
	]);

	return <PartnersContent groupedPartners={groupedPartners} stats={stats} />;
}

function PartnersLoadingSkeleton() {
	return (
		<div className="flex-1 p-6 space-y-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-8 w-32 mb-2" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-10 w-32" />
			</div>

			{/* Stats skeleton */}
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={i} className="h-20 rounded-xl" />
				))}
			</div>

			{/* Search skeleton */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-10 w-80" />
				<Skeleton className="h-10 w-32" />
			</div>

			{/* Content skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={i} className="h-48 rounded-2xl" />
				))}
			</div>
		</div>
	);
}
