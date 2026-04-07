import { Skeleton, DocumentListSkeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-72" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-10 w-28" />
					<Skeleton className="h-10 w-36" />
				</div>
			</div>

			{/* Search and filters */}
			<div className="flex gap-3">
				<Skeleton className="h-10 flex-1 max-w-sm" />
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-10 w-24" />
				))}
			</div>

			{/* Card grid */}
			<DocumentListSkeleton count={8} />
		</div>
	);
}
