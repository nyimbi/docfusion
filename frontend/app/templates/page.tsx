/**
 * Template gallery page for DocFusion.
 *
 * Displays a browsable gallery of document templates with
 * filtering, search, and sorting capabilities.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { InfiniteData } from "@tanstack/react-query";
import type { TemplateListParams, TemplateListResponse, TemplateSummary } from "@/lib/types/template";
import {
	useInfiniteTemplates,
	flattenTemplatePages,
} from "@/lib/query/hooks/useTemplates";
import {
	TemplateCard,
	TemplateCardSkeleton,
	TemplateFilters,
	TemplateSidebarFilters,
	UseTemplateButton,
} from "@/components/templates";
import { Button } from "@/components/ui/Button";
import {
	LayoutTemplate,
	Loader2,
	LayoutGrid,
	List,
	FolderTree,
	X,
} from "lucide-react";

/**
 * Template gallery page component.
 */
export default function TemplatesPage() {
	const router = useRouter();

	// Filter and view state
	const [filters, setFilters] = React.useState<TemplateListParams>({
		sortBy: "useCount",
		sortOrder: "desc",
		limit: 12,
	});
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
	const [showSidebar, setShowSidebar] = React.useState(true);

	// Fetch templates
	const {
		data,
		isLoading,
		isError,
		error,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteTemplates(filters);

	// Flatten pages into single list
	const { templates, total } = React.useMemo(() => {
		const pages = (data as InfiniteData<TemplateListResponse> | undefined)?.pages;
		return flattenTemplatePages(pages);
	}, [data]);

	// Handle using a template
	const handleUseTemplate = (template: TemplateSummary) => {
		// Navigate to the template page with use action
		router.push(`/templates/${template.id}?action=use`);
	};

	// Load more when scrolling near bottom
	const loadMoreRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1 }
		);

		if (loadMoreRef.current) {
			observer.observe(loadMoreRef.current);
		}

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Header */}
			<header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
								<LayoutTemplate className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<h1 className="text-xl font-bold text-gray-900 dark:text-white">
									Template Gallery
								</h1>
								<p className="text-sm text-gray-500 dark:text-gray-400">
									{total > 0 ? `${total} templates available` : "Browse and use document templates"}
								</p>
							</div>
						</div>

						{/* View controls */}
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowSidebar(!showSidebar)}
								className="hidden lg:flex"
							>
								<FolderTree className="h-4 w-4 mr-2" />
								{showSidebar ? "Hide" : "Show"} Sidebar
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<div className="container mx-auto px-4 py-6">
				<div className="flex gap-6">
					{/* Sidebar filters (desktop) */}
					{showSidebar && (
						<aside className="hidden lg:block w-64 flex-shrink-0">
							<div className="sticky top-24 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
								<div className="flex items-center justify-between mb-4">
									<h2 className="font-semibold text-gray-900 dark:text-white">
										Filters
									</h2>
									{Object.keys(filters).length > 2 && (
										<button
											type="button"
											onClick={() =>
												setFilters({
													sortBy: "useCount",
													sortOrder: "desc",
													limit: 12,
												})
											}
											className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
										>
											Clear all
										</button>
									)}
								</div>
								<TemplateSidebarFilters
									filters={filters}
									onFiltersChange={setFilters}
								/>
							</div>
						</aside>
					)}

					{/* Main content area */}
					<main className="flex-1 min-w-0">
						{/* Filter bar */}
						<TemplateFilters
							filters={filters}
							onFiltersChange={setFilters}
							viewMode={viewMode}
							onViewModeChange={setViewMode}
							showViewToggle
							className="mb-6"
						/>

						{/* Loading state */}
						{isLoading && (
							<TemplateGrid viewMode={viewMode}>
								{Array.from({ length: 12 }).map((_, i) => (
									<TemplateCardSkeleton
										key={i}
										variant={viewMode === "list" ? "horizontal" : "default"}
									/>
								))}
							</TemplateGrid>
						)}

						{/* Error state */}
						{isError && (
							<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
								<div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
									<X className="h-8 w-8 text-red-500" />
								</div>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
									Failed to load templates
								</h3>
								<p className="text-gray-500 dark:text-gray-400 mb-4">
									{error?.message ?? "An error occurred while loading templates."}
								</p>
								<Button onClick={() => window.location.reload()}>
									Try Again
								</Button>
							</div>
						)}

						{/* Empty state */}
						{!isLoading && !isError && templates.length === 0 && (
							<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
								<div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
									<LayoutTemplate className="h-8 w-8 text-gray-400" />
								</div>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
									No templates found
								</h3>
								<p className="text-gray-500 dark:text-gray-400 mb-4">
									{filters.search
										? `No templates match "${filters.search}"`
										: "No templates available with the current filters."}
								</p>
								{Object.keys(filters).length > 2 && (
									<Button
										variant="outline"
										onClick={() =>
											setFilters({
												sortBy: "useCount",
												sortOrder: "desc",
												limit: 12,
											})
										}
									>
										Clear Filters
									</Button>
								)}
							</div>
						)}

						{/* Templates grid/list */}
						{!isLoading && !isError && templates.length > 0 && (
							<>
								<TemplateGrid viewMode={viewMode}>
									{templates.map((template) => (
										<TemplateCard
											key={template.id}
											template={template}
											variant={viewMode === "list" ? "horizontal" : "default"}
											onUse={handleUseTemplate}
											showHoverPreview
										/>
									))}
								</TemplateGrid>

								{/* Load more trigger */}
								<div
									ref={loadMoreRef}
									className="flex justify-center py-8"
								>
									{isFetchingNextPage ? (
										<div className="flex items-center gap-2 text-gray-500">
											<Loader2 className="h-5 w-5 animate-spin" />
											<span>Loading more...</span>
										</div>
									) : hasNextPage ? (
										<Button
											variant="outline"
											onClick={() => fetchNextPage()}
										>
											Load More
										</Button>
									) : templates.length > 0 ? (
										<p className="text-sm text-gray-400">
											Showing all {templates.length} templates
										</p>
									) : null}
								</div>
							</>
						)}
					</main>
				</div>
			</div>
		</div>
	);
}

/**
 * Template grid/list wrapper component.
 */
function TemplateGrid({
	viewMode,
	children,
}: {
	viewMode: "grid" | "list";
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				viewMode === "grid"
					? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
					: "flex flex-col gap-4"
			)}
		>
			{children}
		</div>
	);
}
