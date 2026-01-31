/**
 * CRM Dashboard Page
 *
 * Main CRM dashboard displaying key metrics, pipeline overview,
 * recent activities, and forecasting data.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import CRMDashboard from "./dashboard-content";

export const metadata: Metadata = {
	title: "Dashboard",
	description: "CRM Dashboard - Overview of accounts, deals, and activities",
};

export default function CRMPage() {
	return (
		<Suspense fallback={<DashboardSkeleton />}>
			<CRMDashboard />
		</Suspense>
	);
}

function DashboardSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="h-8 w-48 bg-muted animate-pulse rounded" />
				<div className="h-10 w-32 bg-muted animate-pulse rounded" />
			</div>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
				))}
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="h-80 bg-muted animate-pulse rounded-lg" />
				<div className="h-80 bg-muted animate-pulse rounded-lg" />
			</div>
		</div>
	);
}
