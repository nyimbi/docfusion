import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div className="space-y-2">
					<Skeleton className="h-8 w-44" />
					<Skeleton className="h-4 w-64" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-10 w-28" />
					<Skeleton className="h-10 w-32" />
				</div>
			</div>

			{/* Tab bar */}
			<div className="flex gap-2 border-b pb-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-9 w-28" />
				))}
			</div>

			{/* Kanban columns */}
			<div className="flex gap-4 overflow-hidden">
				{Array.from({ length: 5 }).map((_, col) => (
					<div key={col} className="flex-1 min-w-[240px] space-y-3">
						{/* Column header */}
						<div className="flex items-center justify-between">
							<Skeleton className="h-5 w-24" />
							<Skeleton className="h-5 w-8 rounded-full" />
						</div>
						{/* Cards */}
						{Array.from({ length: col === 0 ? 3 : col === 1 ? 4 : 2 }).map((_, card) => (
							<div key={card} className="rounded-lg border border-border bg-card p-4 space-y-2">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-1/2" />
								<div className="flex items-center justify-between pt-2">
									<Skeleton className="h-6 w-16 rounded-full" />
									<Skeleton className="h-6 w-6 rounded-full" />
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
