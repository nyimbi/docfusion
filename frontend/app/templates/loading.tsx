/**
 * Loading skeleton for templates gallery page.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Header skeleton */}
			<header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-lg" />
							<div className="space-y-2">
								<Skeleton className="h-6 w-40" />
								<Skeleton className="h-4 w-32" />
							</div>
						</div>
						<Skeleton className="h-9 w-32" />
					</div>
				</div>
			</header>

			{/* Main content skeleton */}
			<div className="container mx-auto px-4 py-6">
				<div className="flex gap-6">
					{/* Sidebar skeleton */}
					<aside className="hidden lg:block w-64 flex-shrink-0">
						<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
							<Skeleton className="h-5 w-16 mb-4" />
							<div className="space-y-3">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-5/6" />
								<Skeleton className="h-4 w-2/3" />
							</div>
							<Skeleton className="h-5 w-20 mt-6 mb-4" />
							<div className="space-y-3">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-5/6" />
							</div>
						</div>
					</aside>

					{/* Main content skeleton */}
					<main className="flex-1">
						{/* Filter bar skeleton */}
						<div className="flex items-center gap-3 mb-6">
							<Skeleton className="h-10 flex-1 max-w-md" />
							<Skeleton className="h-10 w-36" />
							<Skeleton className="h-10 w-24" />
							<Skeleton className="h-10 w-24" />
							<Skeleton className="h-10 w-20" />
						</div>

						{/* Template grid skeleton */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{Array.from({ length: 12 }).map((_, i) => (
								<TemplateCardSkeleton key={i} />
							))}
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}

/**
 * Template card skeleton component.
 */
function TemplateCardSkeleton() {
	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
			{/* Image skeleton */}
			<Skeleton className="aspect-[4/3] w-full" />

			{/* Header skeleton */}
			<div className="p-4 pb-2">
				<Skeleton className="h-5 w-3/4" />
			</div>

			{/* Content skeleton */}
			<div className="px-4 pb-2 space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
				<div className="flex gap-1 mt-3">
					<Skeleton className="h-5 w-12 rounded-full" />
					<Skeleton className="h-5 w-12 rounded-full" />
				</div>
			</div>

			{/* Footer skeleton */}
			<div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
				<div className="flex justify-between">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-12" />
				</div>
			</div>
		</div>
	);
}
