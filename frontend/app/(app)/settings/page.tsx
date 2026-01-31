/**
 * Settings Page - DocFusion
 *
 * Comprehensive settings hub combining user preferences, organization setup,
 * security, notifications, integrations, and data management.
 *
 * Merges the former /company page functionality into the Organization section.
 */

// Force dynamic rendering to avoid database queries during build
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { SettingsContent } from "./settings-content";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Loading State
// ============================================================================

function SettingsSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="mb-6">
				<Skeleton className="h-8 w-48 mb-2" />
				<Skeleton className="h-4 w-96" />
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				<div className="lg:col-span-1 space-y-2">
					{[1, 2, 3, 4, 5, 6, 7].map((i) => (
						<Skeleton key={i} className="h-14" />
					))}
				</div>
				<div className="lg:col-span-3">
					<Skeleton className="h-[600px]" />
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Page
// ============================================================================

export const metadata = {
	title: "Settings | DocFusion",
	description: "Manage your account, organization, and application settings",
};

export default function SettingsPage() {
	return (
		<Suspense fallback={<SettingsSkeleton />}>
			<SettingsContent />
		</Suspense>
	);
}
