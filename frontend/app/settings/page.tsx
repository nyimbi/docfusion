/**
 * Settings Page - DocFusion
 *
 * Company profile and application settings.
 */

import { Suspense } from "react";
import { getCompanySettings } from "@/lib/actions/company-settings";
import { SettingsClientPage } from "./SettingsClientPage";

// ============================================================================
// Page Component
// ============================================================================

export default async function SettingsPage() {
	const companySettings = await getCompanySettings();

	return (
		<div className="min-h-screen bg-[var(--background-muted)]">
			{/* Header */}
			<header className="bg-[var(--background)] border-b border-[var(--border)]">
				<div className="max-w-5xl mx-auto px-6 py-6">
					<h1 className="text-2xl font-bold text-[var(--foreground)]">
						Settings
					</h1>
					<p className="text-[var(--foreground-muted)] mt-1">
						Manage your company profile and application preferences
					</p>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-5xl mx-auto px-6 py-8">
				<Suspense
					fallback={
						<div className="flex items-center justify-center h-64">
							<div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
						</div>
					}
				>
					<SettingsClientPage initialSettings={companySettings} />
				</Suspense>
			</main>
		</div>
	);
}
