import { Skeleton } from "@/components/ui/skeleton";

export default function DealsLoading() {
	return (
		<div className="p-6 space-y-4">
			<div className="flex justify-between items-center">
				<Skeleton className="h-8 w-28" />
				<Skeleton className="h-10 w-32" />
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-10 flex-1 max-w-sm" />
				<Skeleton className="h-10 w-28" />
			</div>
			{/* Table rows */}
			<div className="space-y-1">
				<div className="flex items-center gap-4 py-3 border-b">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-4 flex-1" />
					))}
				</div>
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="flex items-center gap-4 py-3 border-b">
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-6 w-20 rounded-full" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-20" />
					</div>
				))}
			</div>
		</div>
	);
}
