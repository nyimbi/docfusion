"use client";

/**
 * Import Content Component
 *
 * Client-side content for the universal data import page.
 * Renders the import wizard with full-page layout.
 *
 * Aesthetic: "Data Flow Elegance"
 * - Clean, spacious layout with subtle depth
 * - Soft gradients and modern card styling
 * - Clear visual hierarchy for multi-step flow
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ImportWizard } from "@/components/import";
import { useImportStore } from "@/lib/stores/import-store";
import { cn } from "@/lib/utils";

/**
 * Import Content Component
 */
export default function ImportContent() {
	const router = useRouter();
	const { reset } = useImportStore();

	/**
	 * Handle import completion
	 */
	const handleComplete = useCallback(() => {
		// Reset store state
		reset();
		// Could navigate to the imported records or stay on page
	}, [reset]);

	/**
	 * Handle wizard cancellation
	 */
	const handleCancel = useCallback(() => {
		reset();
		router.back();
	}, [reset, router]);

	return (
		<div className="h-full overflow-auto">
			{/* Background Pattern */}
			<div className="absolute inset-0 -z-10">
				{/* Subtle gradient background */}
				<div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />

				{/* Grid pattern overlay */}
				<div
					className="absolute inset-0 opacity-[0.02]"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
					}}
				/>
			</div>

			{/* Page Container */}
			<div className="relative max-w-6xl mx-auto p-6 lg:p-8">
				{/* Page Header */}
				<header className="mb-8">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
							<svg
								className="w-5 h-5 text-primary"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
								/>
							</svg>
						</div>
						<div>
							<h1 className="text-2xl font-bold tracking-tight">
								Import Data
							</h1>
							<p className="text-muted-foreground">
								Import records from Excel or CSV files
							</p>
						</div>
					</div>
				</header>

				{/* Wizard Card */}
				<div className={cn(
					"bg-card rounded-2xl border shadow-sm overflow-hidden",
					"ring-1 ring-border/50"
				)}>
					<ImportWizard
						onComplete={handleComplete}
						onCancel={handleCancel}
					/>
				</div>

				{/* Help Section */}
				<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
					<HelpCard
						title="Supported Formats"
						description="Excel (.xlsx, .xls) and CSV/TSV files up to 50MB"
						icon={
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
							</svg>
						}
					/>
					<HelpCard
						title="Column Mapping"
						description="Map source columns to target fields, combine multiple columns"
						icon={
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
							</svg>
						}
					/>
					<HelpCard
						title="Save Templates"
						description="Save your mappings to reuse with similar files"
						icon={
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
							</svg>
						}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * Help Card Component
 */
interface HelpCardProps {
	title: string;
	description: string;
	icon: React.ReactNode;
}

function HelpCard({ title, description, icon }: HelpCardProps) {
	return (
		<div className="p-4 bg-muted/30 rounded-xl border border-transparent hover:border-border hover:bg-muted/50 transition-all">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0 w-9 h-9 rounded-lg bg-background flex items-center justify-center text-muted-foreground">
					{icon}
				</div>
				<div>
					<h3 className="font-medium text-sm">{title}</h3>
					<p className="text-xs text-muted-foreground mt-0.5">{description}</p>
				</div>
			</div>
		</div>
	);
}
