"use client";

/**
 * Discriminator Library Component
 *
 * Library view of all discriminator statements with filtering,
 * effectiveness tracking, and usage statistics.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Search,
	Plus,
	Filter,
	Copy,
	Pencil,
	Trash2,
	MoreVertical,
	TrendingUp,
	Target,
	Award,
	Check,
	Loader2,
	Sparkles,
	FileText,
	X,
} from "lucide-react";
import { DiscriminatorEditor } from "./DiscriminatorEditor";
import {
	listDiscriminators,
	deleteDiscriminator,
} from "@/lib/actions/competitive";
import type { Discriminator, DiscriminatorFilters, DiscriminatorType } from "@/lib/types/competitive";

interface DiscriminatorLibraryProps {
	/** Initial discriminators from server */
	initialDiscriminators?: Discriminator[];
	/** Callback when discriminator is selected */
	onSelect?: (discriminator: Discriminator) => void;
	/** Show add button */
	showAddButton?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Discriminator type configuration
 */
const DISCRIMINATOR_TYPES: Array<{ value: DiscriminatorType | "all"; label: string; icon: React.ReactNode }> = [
	{ value: "all", label: "All Types", icon: <FileText className="h-4 w-4" /> },
	{ value: "capability", label: "Capability", icon: <Target className="h-4 w-4" /> },
	{ value: "experience", label: "Experience", icon: <Award className="h-4 w-4" /> },
	{ value: "approach", label: "Approach", icon: <Sparkles className="h-4 w-4" /> },
	{ value: "team", label: "Team", icon: <Target className="h-4 w-4" /> },
	{ value: "cost", label: "Cost", icon: <TrendingUp className="h-4 w-4" /> },
	{ value: "schedule", label: "Schedule", icon: <FileText className="h-4 w-4" /> },
	{ value: "innovation", label: "Innovation", icon: <Sparkles className="h-4 w-4" /> },
	{ value: "past_performance", label: "Past Performance", icon: <Award className="h-4 w-4" /> },
];

/**
 * Effectiveness tier configuration
 */
const EFFECTIVENESS_TIERS = [
	{ min: 75, label: "High", color: "text-green-600 bg-green-100 dark:bg-green-900" },
	{ min: 50, label: "Medium", color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900" },
	{ min: 0, label: "Low", color: "text-red-600 bg-red-100 dark:bg-red-900" },
];

/**
 * Get effectiveness tier from score
 */
function getEffectivenessTier(score: number | null | undefined) {
	if (score == null) return null;
	return EFFECTIVENESS_TIERS.find((t) => score >= t.min) ?? EFFECTIVENESS_TIERS[2];
}

/**
 * Type badge color mapping
 */
const typeColors: Record<string, string> = {
	capability: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	experience: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	approach: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	team: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	cost: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
	schedule: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
	innovation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
	past_performance: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function DiscriminatorLibrary({
	initialDiscriminators = [],
	onSelect,
	showAddButton = true,
	className,
}: DiscriminatorLibraryProps) {
	// State
	const [discriminators, setDiscriminators] = useState<Discriminator[]>(initialDiscriminators);
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<DiscriminatorType | "all">("all");
	const [effectivenessFilter, setEffectivenessFilter] = useState<"all" | "high" | "medium" | "low">("all");
	const [isLoading, setIsLoading] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [copiedId, setCopiedId] = useState<string | null>(null);

	// Dialog states
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [editingDiscriminator, setEditingDiscriminator] = useState<Discriminator | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	/**
	 * Load discriminators from server
	 */
	const loadDiscriminators = useCallback(async () => {
		setIsLoading(true);
		try {
			const filters: DiscriminatorFilters = {};
			if (typeFilter !== "all") {
				filters.type = typeFilter;
			}

			const result = await listDiscriminators(filters);
			if (result.success) {
				setDiscriminators(result.data);
			}
		} finally {
			setIsLoading(false);
		}
	}, [typeFilter]);

	// Load discriminators on mount
	useEffect(() => {
		if (initialDiscriminators.length === 0) {
			loadDiscriminators();
		}
	}, [initialDiscriminators.length, loadDiscriminators]);

	/**
	 * Filter discriminators client-side
	 */
	const filteredDiscriminators = useMemo(() => {
		return discriminators.filter((d) => {
			// Text search
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				const matchesSearch =
					d.statement.toLowerCase().includes(query) ||
					(d.shortVersion?.toLowerCase().includes(query) ?? false) ||
					(d.category?.toLowerCase().includes(query) ?? false);
				if (!matchesSearch) return false;
			}

			// Type filter
			if (typeFilter !== "all" && d.discriminatorType !== typeFilter) {
				return false;
			}

			// Effectiveness filter
			if (effectivenessFilter !== "all") {
				const tier = getEffectivenessTier(d.effectivenessScore);
				if (!tier) return effectivenessFilter === "low";
				if (tier.label.toLowerCase() !== effectivenessFilter) return false;
			}

			return true;
		});
	}, [discriminators, searchQuery, typeFilter, effectivenessFilter]);

	/**
	 * Copy discriminator text to clipboard
	 */
	const handleCopy = useCallback(async (discriminator: Discriminator) => {
		const text = discriminator.shortVersion || discriminator.statement;
		await navigator.clipboard.writeText(text);
		setCopiedId(discriminator.id);
		setTimeout(() => setCopiedId(null), 2000);
	}, []);

	/**
	 * Handle discriminator deletion
	 */
	const handleDelete = useCallback(async () => {
		if (!deletingId) return;

		startTransition(async () => {
			const result = await deleteDiscriminator(deletingId);
			if (result.success) {
				setDiscriminators((prev) => prev.filter((d) => d.id !== deletingId));
			}
			setDeletingId(null);
		});
	}, [deletingId]);

	/**
	 * Handle form submission
	 */
	const handleFormSubmit = useCallback(async () => {
		setIsAddDialogOpen(false);
		setEditingDiscriminator(null);
		await loadDiscriminators();
	}, [loadDiscriminators]);

	/**
	 * Clear all filters
	 */
	const clearFilters = useCallback(() => {
		setSearchQuery("");
		setTypeFilter("all");
		setEffectivenessFilter("all");
	}, []);

	const hasActiveFilters = searchQuery.trim() !== "" || typeFilter !== "all" || effectivenessFilter !== "all";

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
				{/* Search */}
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search discriminators..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				{showAddButton && (
					<Button onClick={() => setIsAddDialogOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Add Discriminator
					</Button>
				)}
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-1 text-sm text-muted-foreground">
					<Filter className="h-4 w-4" />
					Filters:
				</div>

				<Select
					value={typeFilter}
					onValueChange={(v) => setTypeFilter(v as DiscriminatorType | "all")}
				>
					<SelectTrigger className="w-[160px] h-8">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						{DISCRIMINATOR_TYPES.map((type) => (
							<SelectItem key={type.value} value={type.value}>
								<div className="flex items-center gap-2">
									{type.icon}
									{type.label}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={effectivenessFilter}
					onValueChange={(v) => setEffectivenessFilter(v as "all" | "high" | "medium" | "low")}
				>
					<SelectTrigger className="w-[150px] h-8">
						<SelectValue placeholder="Effectiveness" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Effectiveness</SelectItem>
						<SelectItem value="high">High (&ge;75%)</SelectItem>
						<SelectItem value="medium">Medium (50-74%)</SelectItem>
						<SelectItem value="low">Low (&lt;50%)</SelectItem>
					</SelectContent>
				</Select>

				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
						<X className="h-4 w-4 mr-1" />
						Clear
					</Button>
				)}

				<span className="text-sm text-muted-foreground ml-auto">
					{filteredDiscriminators.length} discriminator{filteredDiscriminators.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Loading State */}
			{isLoading && (
				<div className="space-y-3">
					{[...Array(5)].map((_, i) => (
						<Skeleton key={i} className="h-32" />
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && filteredDiscriminators.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Target className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-semibold mb-2">No discriminators found</h3>
					<p className="text-muted-foreground mb-4">
						{hasActiveFilters
							? "Try adjusting your filters or search query."
							: "Start building your discriminator library."}
					</p>
					{showAddButton && !hasActiveFilters && (
						<Button onClick={() => setIsAddDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Discriminator
						</Button>
					)}
				</div>
			)}

			{/* Discriminator List */}
			{!isLoading && filteredDiscriminators.length > 0 && (
				<div className="space-y-3">
					{filteredDiscriminators.map((discriminator) => {
						const effectivenessTier = getEffectivenessTier(discriminator.effectivenessScore);
						const isCopied = copiedId === discriminator.id;

						return (
							<Card
								key={discriminator.id}
								className={cn(
									"group hover:shadow-md transition-shadow cursor-pointer",
									!discriminator.isActive && "opacity-60"
								)}
								onClick={() => onSelect?.(discriminator)}
							>
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 space-y-1">
											<div className="flex items-center gap-2 flex-wrap">
												{discriminator.discriminatorType && (
													<Badge
														variant="secondary"
														className={cn("text-xs", typeColors[discriminator.discriminatorType])}
													>
														{discriminator.discriminatorType.replace("_", " ")}
													</Badge>
												)}
												{discriminator.category && (
													<Badge variant="outline" className="text-xs">
														{discriminator.category}
													</Badge>
												)}
												{!discriminator.isActive && (
													<Badge variant="destructive" className="text-xs">
														Inactive
													</Badge>
												)}
											</div>
											<CardTitle className="text-base font-medium leading-snug">
												{discriminator.shortVersion || discriminator.statement.slice(0, 100)}
												{!discriminator.shortVersion && discriminator.statement.length > 100 && "..."}
											</CardTitle>
										</div>

										{/* Quick Actions */}
										<div
											className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={(e) => e.stopPropagation()}

					role="button"
					tabIndex={0}
					onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0"
															onClick={() => handleCopy(discriminator)}
														>
															{isCopied ? (
																<Check className="h-4 w-4 text-green-600" />
															) : (
																<Copy className="h-4 w-4" />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														{isCopied ? "Copied!" : "Copy to clipboard"}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>

											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
														<MoreVertical className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => setEditingDiscriminator(discriminator)}
													>
														<Pencil className="h-4 w-4 mr-2" />
														Edit
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={() => setDeletingId(discriminator.id)}
														className="text-destructive focus:text-destructive"
													>
														<Trash2 className="h-4 w-4 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</div>
								</CardHeader>

								<CardContent className="space-y-3">
									{/* Full Statement */}
									{discriminator.shortVersion && (
										<p className="text-sm text-muted-foreground line-clamp-2">
											{discriminator.statement}
										</p>
									)}

									{/* Proof Points */}
									{discriminator.proofPoints && discriminator.proofPoints.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{discriminator.proofPoints.slice(0, 3).map((point, idx) => (
												<Badge key={idx} variant="outline" className="text-xs font-normal">
													{point.length > 40 ? point.slice(0, 40) + "..." : point}
												</Badge>
											))}
											{discriminator.proofPoints.length > 3 && (
												<Badge variant="outline" className="text-xs">
													+{discriminator.proofPoints.length - 3} more
												</Badge>
											)}
										</div>
									)}

									{/* Stats Row */}
									<div className="flex items-center justify-between pt-2 border-t text-sm">
										{/* Usage Stats */}
										<div className="flex items-center gap-4 text-muted-foreground">
											<span className="flex items-center gap-1">
												<FileText className="h-3.5 w-3.5" />
												{discriminator.useCount ?? 0} uses
											</span>
											<span className="flex items-center gap-1">
												<Award className="h-3.5 w-3.5" />
												{discriminator.winCount ?? 0} wins
											</span>
										</div>

										{/* Effectiveness */}
										{effectivenessTier && (
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground">Effectiveness:</span>
												<Badge
													variant="secondary"
													className={cn("text-xs", effectivenessTier.color)}
												>
													{Math.round(discriminator.effectivenessScore ?? 0)}%
												</Badge>
												<Progress
													value={discriminator.effectivenessScore ?? 0}
													className="w-20 h-2"
												/>
											</div>
										)}
									</div>

									{/* Effective Against */}
									{discriminator.effectiveAgainst && discriminator.effectiveAgainst.length > 0 && (
										<div className="text-xs text-muted-foreground">
											<span className="font-medium">Effective against:</span>{" "}
											{discriminator.effectiveAgainst.slice(0, 3).join(", ")}
											{discriminator.effectiveAgainst.length > 3 &&
												` +${discriminator.effectiveAgainst.length - 3} more`}
										</div>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Add/Edit Dialog */}
			<Dialog
				open={isAddDialogOpen || !!editingDiscriminator}
				onOpenChange={(open) => {
					if (!open) {
						setIsAddDialogOpen(false);
						setEditingDiscriminator(null);
					}
				}}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingDiscriminator ? "Edit Discriminator" : "Add Discriminator"}
						</DialogTitle>
						<DialogDescription>
							{editingDiscriminator
								? "Update the discriminator statement and details."
								: "Create a new discriminator for your library."}
						</DialogDescription>
					</DialogHeader>
					<DiscriminatorEditor
						discriminator={editingDiscriminator ?? undefined}
						onSubmit={handleFormSubmit}
						onCancel={() => {
							setIsAddDialogOpen(false);
							setEditingDiscriminator(null);
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Discriminator?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this discriminator. Usage history will be lost.
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export default DiscriminatorLibrary;
