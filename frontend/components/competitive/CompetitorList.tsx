"use client";

/**
 * Competitor List Component
 *
 * Displays a list of competitors with grid/table view toggle,
 * filtering, search, and CRUD actions.
 */

import * as React from "react";
import Image from "next/image";
import { useState, useTransition, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Grid3X3,
	List,
	Search,
	Plus,
	Building2,
	TrendingUp,
	TrendingDown,
	Loader2,
	Filter,
	X,
} from "lucide-react";
import { CompetitorCard } from "./CompetitorCard";
import { CompetitorForm } from "./CompetitorForm";
import {
	listCompetitors,
	searchCompetitors,
	deleteCompetitor,
} from "@/lib/actions/competitive";
import type { Competitor, CompetitorFilters, CreateCompetitorInput } from "@/lib/types/competitive";

interface CompetitorListProps {
	/** Initial competitors data (from server) */
	initialCompetitors?: Competitor[];
	/** Organization ID filter */
	organizationId?: string;
	/** Callback when competitor is selected */
	onSelect?: (competitor: Competitor) => void;
	/** Whether to show add button */
	showAddButton?: boolean;
	/** Callback after competitor is created */
	onCompetitorCreated?: (competitor: Competitor) => void;
	/** Additional CSS classes */
	className?: string;
}

type ViewMode = "grid" | "table";

/**
 * Size standard options for filter
 */
const SIZE_STANDARDS = [
	{ value: "all", label: "All Sizes" },
	{ value: "small", label: "Small Business" },
	{ value: "large", label: "Large Business" },
	{ value: "8a", label: "8(a)" },
	{ value: "hubzone", label: "HUBZone" },
	{ value: "sdvosb", label: "SDVOSB" },
	{ value: "wosb", label: "WOSB" },
];

/**
 * Competitor type options for filter
 */
const COMPETITOR_TYPES = [
	{ value: "all", label: "All Types" },
	{ value: "prime", label: "Prime" },
	{ value: "sub", label: "Subcontractor" },
	{ value: "both", label: "Prime/Sub" },
];

/**
 * Calculate win rate for display
 */
function getWinRate(competitor: Competitor): { rate: number; total: number } {
	const wins = competitor.lossesToUs ?? 0;
	const losses = competitor.winsAgainstUs ?? 0;
	const total = wins + losses;
	return {
		rate: total > 0 ? Math.round((wins / total) * 100) : 0,
		total,
	};
}

export function CompetitorList({
	initialCompetitors = [],
	organizationId,
	onSelect,
	showAddButton = true,
	onCompetitorCreated,
	className,
}: CompetitorListProps) {
	// State
	const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors);
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [searchQuery, setSearchQuery] = useState("");
	const [filters, setFilters] = useState<CompetitorFilters>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isPending, startTransition] = useTransition();

	// Dialog states
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	/**
	 * Load competitors from server
	 */
	const loadCompetitors = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await listCompetitors(organizationId);
			if (result.success) {
				setCompetitors(result.data);
			}
		} finally {
			setIsLoading(false);
		}
	}, [organizationId]);

	// Load competitors on mount if not provided
	React.useEffect(() => {
		if (initialCompetitors.length === 0) {
			loadCompetitors();
		}
	}, [initialCompetitors.length, loadCompetitors]);

	/**
	 * Search competitors with debounce
	 */
	const handleSearch = useCallback(
		async (query: string) => {
			setSearchQuery(query);

			if (query.trim() === "" && Object.keys(filters).length === 0) {
				await loadCompetitors();
				return;
			}

			startTransition(async () => {
				const result = await searchCompetitors(query, filters);
				if (result.success) {
					setCompetitors(result.data);
				}
			});
		},
		[filters, loadCompetitors]
	);

	/**
	 * Apply filters
	 */
	const handleFilterChange = useCallback(
		(key: keyof CompetitorFilters, value: string) => {
			const newFilters = { ...filters };

			if (value === "all" || value === "") {
				delete newFilters[key];
			} else {
				newFilters[key] = value;
			}

			setFilters(newFilters);

			startTransition(async () => {
				const result = await searchCompetitors(searchQuery, newFilters);
				if (result.success) {
					setCompetitors(result.data);
				}
			});
		},
		[filters, searchQuery]
	);

	/**
	 * Clear all filters
	 */
	const clearFilters = useCallback(() => {
		setFilters({});
		setSearchQuery("");
		loadCompetitors();
	}, [loadCompetitors]);

	/**
	 * Handle competitor deletion
	 */
	const handleDelete = useCallback(async () => {
		if (!deletingId) return;

		startTransition(async () => {
			const result = await deleteCompetitor(deletingId);
			if (result.success) {
				setCompetitors((prev) => prev.filter((c) => c.id !== deletingId));
			}
			setDeletingId(null);
		});
	}, [deletingId]);

	/**
	 * Handle form submission (create/edit)
	 */
	const handleFormSubmit = useCallback(
		async (data: CreateCompetitorInput) => {
			// Form component handles the actual API call
			setIsAddDialogOpen(false);
			setEditingCompetitor(null);
			await loadCompetitors();
		},
		[loadCompetitors]
	);

	// Memoized filtered competitors for display
	const displayedCompetitors = useMemo(() => {
		return competitors;
	}, [competitors]);

	// Check if any filters are active
	const hasActiveFilters = searchQuery.trim() !== "" || Object.keys(filters).length > 0;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header Row */}
			<div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
				{/* Search */}
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search competitors..."
						value={searchQuery}
						onChange={(e) => handleSearch(e.target.value)}
						className="pl-9"
					/>
					{isPending && (
						<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					{/* View Toggle */}
					<div className="flex items-center border rounded-md">
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="sm"
							className="rounded-r-none"
							onClick={() => setViewMode("grid")}
						>
							<Grid3X3 className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "table" ? "secondary" : "ghost"}
							size="sm"
							className="rounded-l-none"
							onClick={() => setViewMode("table")}
						>
							<List className="h-4 w-4" />
						</Button>
					</div>

					{showAddButton && (
						<Button onClick={() => setIsAddDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Competitor
						</Button>
					)}
				</div>
			</div>

			{/* Filters Row */}
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-1 text-sm text-muted-foreground">
					<Filter className="h-4 w-4" />
					Filters:
				</div>

				<Select
					value={filters.competitorType ?? "all"}
					onValueChange={(value) => handleFilterChange("competitorType", value)}
				>
					<SelectTrigger className="w-[140px] h-8">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						{COMPETITOR_TYPES.map((type) => (
							<SelectItem key={type.value} value={type.value}>
								{type.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={filters.sizeStandard ?? "all"}
					onValueChange={(value) => handleFilterChange("sizeStandard", value)}
				>
					<SelectTrigger className="w-[150px] h-8">
						<SelectValue placeholder="Size" />
					</SelectTrigger>
					<SelectContent>
						{SIZE_STANDARDS.map((size) => (
							<SelectItem key={size.value} value={size.value}>
								{size.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						onClick={clearFilters}
						className="h-8 px-2"
					>
						<X className="h-4 w-4 mr-1" />
						Clear
					</Button>
				)}

				{/* Results count */}
				<span className="text-sm text-muted-foreground ml-auto">
					{displayedCompetitors.length} competitor{displayedCompetitors.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Loading State */}
			{isLoading && (
				<div className={cn(
					viewMode === "grid"
						? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
						: "space-y-2"
				)}>
					{[...Array(6)].map((_, i) => (
						<Skeleton key={i} className={viewMode === "grid" ? "h-64" : "h-16"} />
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && displayedCompetitors.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Building2 className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-semibold mb-2">No competitors found</h3>
					<p className="text-muted-foreground mb-4">
						{hasActiveFilters
							? "Try adjusting your filters or search query."
							: "Start by adding your first competitor."}
					</p>
					{showAddButton && !hasActiveFilters && (
						<Button onClick={() => setIsAddDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Competitor
						</Button>
					)}
				</div>
			)}

			{/* Grid View */}
			{!isLoading && viewMode === "grid" && displayedCompetitors.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{displayedCompetitors.map((competitor) => (
						<CompetitorCard
							key={competitor.id}
							competitor={competitor}
							onEdit={(c) => setEditingCompetitor(c)}
							onDelete={(id) => setDeletingId(id)}
							onViewDetails={onSelect}
							showWinLoss
						/>
					))}
				</div>
			)}

			{/* Table View */}
			{!isLoading && viewMode === "table" && displayedCompetitors.length > 0 && (
				<div className="border rounded-lg">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Size</TableHead>
								<TableHead>Capabilities</TableHead>
								<TableHead>Win Rate</TableHead>
								<TableHead>Pricing</TableHead>
								<TableHead className="w-[100px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{displayedCompetitors.map((competitor) => {
								const { rate, total } = getWinRate(competitor);

								return (
									<TableRow
										key={competitor.id}
										className="cursor-pointer"
										onClick={() => onSelect?.(competitor)}
									>
										<TableCell>
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
													{competitor.logoUrl ? (
														<Image
															src={competitor.logoUrl}
															alt=""
															className="w-6 h-6 object-contain rounded"
															width={24}
															height={24}
															unoptimized
														/>
													) : (
														<Building2 className="h-4 w-4 text-muted-foreground" />
													)}
												</div>
												<div>
													<p className="font-medium">{competitor.name}</p>
													{competitor.website && (
														<a
															href={competitor.website}
															target="_blank"
															rel="noopener noreferrer"
															className="text-xs text-muted-foreground hover:underline"
															onClick={(e) => e.stopPropagation()}
														>
															{new URL(competitor.website).hostname}
														</a>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell>
											{competitor.competitorType && (
												<Badge variant="outline" className="capitalize">
													{competitor.competitorType}
												</Badge>
											)}
										</TableCell>
										<TableCell>
											{competitor.sizeStandard && (
												<Badge variant="secondary" className="text-xs">
													{competitor.sizeStandard.toUpperCase()}
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1 max-w-[200px]">
												{(competitor.capabilities ?? []).slice(0, 2).map((cap, idx) => (
													<Badge
														key={idx}
														variant="outline"
														className="text-xs"
													>
														{cap.area}
													</Badge>
												))}
												{(competitor.capabilities ?? []).length > 2 && (
													<Badge variant="outline" className="text-xs">
														+{(competitor.capabilities ?? []).length - 2}
													</Badge>
												)}
											</div>
										</TableCell>
										<TableCell>
											{total > 0 ? (
												<div className="flex items-center gap-1.5">
													{rate >= 50 ? (
														<TrendingUp className="h-4 w-4 text-green-500" />
													) : (
														<TrendingDown className="h-4 w-4 text-red-500" />
													)}
													<span className="font-medium">{rate}%</span>
													<span className="text-xs text-muted-foreground">
														({total})
													</span>
												</div>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell>
											{competitor.pricingTendency && (
												<span className={cn(
													"capitalize",
													competitor.pricingTendency === "aggressive" && "text-green-600",
													competitor.pricingTendency === "moderate" && "text-yellow-600",
													competitor.pricingTendency === "premium" && "text-red-600"
												)}>
													{competitor.pricingTendency}
												</span>
											)}
										</TableCell>
										<TableCell onClick={(e) => e.stopPropagation()}>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setEditingCompetitor(competitor)}
												>
													Edit
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="text-destructive hover:text-destructive"
													onClick={() => setDeletingId(competitor.id)}
												>
													Delete
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			{/* Add/Edit Dialog */}
			<Dialog
				open={isAddDialogOpen || !!editingCompetitor}
				onOpenChange={(open) => {
					if (!open) {
						setIsAddDialogOpen(false);
						setEditingCompetitor(null);
					}
				}}
			>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingCompetitor ? "Edit Competitor" : "Add Competitor"}
						</DialogTitle>
						<DialogDescription>
							{editingCompetitor
								? "Update competitor information and intelligence."
								: "Add a new competitor to track in your competitive landscape."}
						</DialogDescription>
					</DialogHeader>
					<CompetitorForm
						competitor={editingCompetitor ?? undefined}
						onSubmit={handleFormSubmit}
						onCancel={() => {
							setIsAddDialogOpen(false);
							setEditingCompetitor(null);
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Competitor?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this competitor and all associated intelligence.
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : null}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export default CompetitorList;
