/**
 * Opportunities Page - DocFusion
 *
 * A sophisticated opportunity management interface for tracking
 * RFPs, EOIs, and tenders with filtering, sorting, and ranking.
 */

"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	getOpportunities,
	getOpportunityStats,
	getFilterOptions,
	bulkUpdateStatus,
	bulkUpdatePriority,
	markAsReviewed,
	deleteOpportunity,
} from "@/lib/actions/opportunities";
import type {
	OpportunityListItem,
	OpportunityFilters,
	OpportunitySort,
	OpportunityStats,
	DecisionStatus,
	PriorityRank,
} from "@/lib/types/opportunity";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Search,
	Filter,
	ArrowUpDown,
	MoreHorizontal,
	Upload,
	RefreshCw,
	ChevronLeft,
	ChevronRight,
	Calendar,
	Building2,
	MapPin,
	DollarSign,
	Star,
	StarOff,
	Check,
	X,
	Clock,
	AlertCircle,
	TrendingUp,
	Target,
	Briefcase,
	FileText,
	ExternalLink,
	Eye,
	Trash2,
	CheckSquare,
	BarChart3,
	Grid3X3,
	List,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type ViewMode = "grid" | "list";

// ============================================================================
// Page Component (with Suspense wrapper for useSearchParams)
// ============================================================================

/**
 * Main page export with Suspense boundary for useSearchParams
 */
export default function OpportunitiesPage() {
	return (
		<Suspense fallback={<OpportunitiesPageSkeleton />}>
			<OpportunitiesContent />
		</Suspense>
	);
}

/**
 * Loading skeleton for opportunities page
 */
function OpportunitiesPageSkeleton() {
	return (
		<div className="min-h-screen bg-[var(--background)]">
			{/* Header skeleton */}
			<div className="border-b border-[var(--border)] bg-[var(--background)]">
				<div className="max-w-[1800px] mx-auto px-6 py-6">
					<div className="h-8 w-48 bg-[var(--background-muted)] rounded animate-pulse mb-2" />
					<div className="h-4 w-96 bg-[var(--background-muted)] rounded animate-pulse" />
				</div>
			</div>
			{/* Stats skeleton */}
			<div className="max-w-[1800px] mx-auto px-6 py-6">
				<div className="grid grid-cols-4 gap-4 mb-8">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="h-24 bg-[var(--background-muted)] rounded-xl animate-pulse" />
					))}
				</div>
				{/* Table skeleton */}
				<div className="space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-16 bg-[var(--background-muted)] rounded-lg animate-pulse" />
					))}
				</div>
			</div>
		</div>
	);
}

/**
 * Main opportunities content - uses useSearchParams
 */
function OpportunitiesContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// State
	const [opportunities, setOpportunities] = React.useState<OpportunityListItem[]>([]);
	const [stats, setStats] = React.useState<OpportunityStats | null>(null);
	const [filterOptions, setFilterOptions] = React.useState<{
		categories: string[];
		sectors: string[];
		countries: string[];
		organizations: string[];
		sourceFiles: string[];
	}>({ categories: [], sectors: [], countries: [], organizations: [], sourceFiles: [] });

	const [isLoading, setIsLoading] = React.useState(true);
	const [viewMode, setViewMode] = React.useState<ViewMode>("list");
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

	// Filters
	const [searchQuery, setSearchQuery] = React.useState("");
	const [filters, setFilters] = React.useState<OpportunityFilters>({});
	const [sort, setSort] = React.useState<OpportunitySort>({
		field: "deadline",
		direction: "asc",
	});
	const [page, setPage] = React.useState(1);
	const [totalPages, setTotalPages] = React.useState(1);
	const [total, setTotal] = React.useState(0);

	// Load data
	const loadData = React.useCallback(async () => {
		setIsLoading(true);
		try {
			const [oppsResult, statsResult, optionsResult] = await Promise.all([
				getOpportunities(
					{ ...filters, search: searchQuery || undefined },
					sort,
					{ page, pageSize: 25 }
				),
				getOpportunityStats(filters),
				getFilterOptions(),
			]);

			setOpportunities(oppsResult.data);
			setTotalPages(oppsResult.totalPages);
			setTotal(oppsResult.total);
			setStats(statsResult);
			setFilterOptions(optionsResult);
		} catch (err) {
			console.error("Failed to load opportunities:", err);
		} finally {
			setIsLoading(false);
		}
	}, [filters, searchQuery, sort, page]);

	React.useEffect(() => {
		loadData();
	}, [loadData]);

	// Handlers
	const handleSearch = React.useCallback((e: React.FormEvent) => {
		e.preventDefault();
		setPage(1);
	}, []);

	const handleSort = (field: OpportunitySort["field"]) => {
		setSort((prev) => ({
			field,
			direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
		}));
		setPage(1);
	};

	const handleFilterChange = (key: keyof OpportunityFilters, value: unknown) => {
		setFilters((prev) => ({ ...prev, [key]: value }));
		setPage(1);
	};

	const handleSelectAll = () => {
		if (selectedIds.size === opportunities.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(opportunities.map((o) => o.id)));
		}
	};

	const handleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleBulkAction = async (action: string) => {
		const ids = Array.from(selectedIds);
		if (ids.length === 0) return;

		try {
			switch (action) {
				case "mark-reviewed":
					await markAsReviewed(ids, true);
					break;
				case "mark-interested":
					await bulkUpdateStatus(ids, "interested");
					break;
				case "mark-pursuing":
					await bulkUpdateStatus(ids, "pursuing");
					break;
				case "mark-declined":
					await bulkUpdateStatus(ids, "declined");
					break;
				case "priority-high":
					await bulkUpdatePriority(ids, 5);
					break;
				case "priority-medium":
					await bulkUpdatePriority(ids, 3);
					break;
				case "priority-low":
					await bulkUpdatePriority(ids, 1);
					break;
			}
			setSelectedIds(new Set());
			await loadData();
		} catch (err) {
			console.error("Bulk action failed:", err);
		}
	};

	return (
		<div className="min-h-screen bg-[var(--background)]">
			{/* Header */}
			<header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
				<div className="max-w-[1600px] mx-auto px-6 py-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<h1 className="heading-display text-2xl text-[var(--foreground)]">
								Opportunities
							</h1>
							<p className="text-sm text-[var(--foreground-muted)] mt-0.5">
								{total.toLocaleString()} opportunities tracked
							</p>
						</div>

						<div className="flex items-center gap-3">
							<Link href="/opportunities/import">
								<Button variant="secondary">
									<Upload className="h-4 w-4" />
									Import
								</Button>
							</Link>
							<Button variant="ghost" onClick={() => loadData()}>
								<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Stats Banner */}
			{stats && <StatsBanner stats={stats} />}

			{/* Toolbar */}
			<div className="sticky top-[73px] z-30 border-b border-[var(--border)] bg-[var(--background)]">
				<div className="max-w-[1600px] mx-auto px-6 py-3">
					<div className="flex items-center gap-4">
						{/* Search */}
						<form onSubmit={handleSearch} className="flex-1 max-w-md">
							<Input
								placeholder="Search opportunities..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								startIcon={<Search className="h-4 w-4" />}
								inputSize="sm"
							/>
						</form>

						{/* Filters */}
						<FilterDropdown
							label="Status"
							options={[
								{ value: "pending", label: "Pending" },
								{ value: "interested", label: "Interested" },
								{ value: "pursuing", label: "Pursuing" },
								{ value: "submitted", label: "Submitted" },
								{ value: "won", label: "Won" },
								{ value: "lost", label: "Lost" },
								{ value: "declined", label: "Declined" },
							]}
							selected={filters.statuses || []}
							onChange={(values) =>
								handleFilterChange("statuses", values as DecisionStatus[])
							}
						/>

						<FilterDropdown
							label="Category"
							options={filterOptions.categories.map((c) => ({ value: c, label: c }))}
							selected={filters.categories || []}
							onChange={(values) => handleFilterChange("categories", values)}
						/>

						<FilterDropdown
							label="Country"
							options={filterOptions.countries.map((c) => ({ value: c, label: c }))}
							selected={filters.countries || []}
							onChange={(values) => handleFilterChange("countries", values)}
						/>

						<div className="flex items-center gap-1 border-l border-[var(--border)] pl-4">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={filters.isExpired === false ? "secondary" : "ghost"}
										size="sm"
										onClick={() =>
											handleFilterChange(
												"isExpired",
												filters.isExpired === false ? undefined : false
											)
										}
									>
										<Clock className="h-4 w-4" />
										Active
									</Button>
								</TooltipTrigger>
								<TooltipContent>Show only active opportunities</TooltipContent>
							</Tooltip>
						</div>

						<div className="flex-1" />

						{/* View Toggle */}
						<div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] p-1">
							<IconButton
								aria-label="Grid view"
								className={cn(
									viewMode === "grid" && "bg-[var(--background-muted)]"
								)}
								onClick={() => setViewMode("grid")}
							>
								<Grid3X3 className="h-4 w-4" />
							</IconButton>
							<IconButton
								aria-label="List view"
								className={cn(
									viewMode === "list" && "bg-[var(--background-muted)]"
								)}
								onClick={() => setViewMode("list")}
							>
								<List className="h-4 w-4" />
							</IconButton>
						</div>

						{/* Sort */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm">
									<ArrowUpDown className="h-4 w-4" />
									Sort
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Sort by</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{[
									{ field: "deadline", label: "Deadline" },
									{ field: "priorityRank", label: "Priority" },
									{ field: "fitScore", label: "Fit Score" },
									{ field: "budgetNumeric", label: "Budget" },
									{ field: "title", label: "Title" },
									{ field: "organization", label: "Organization" },
								].map(({ field, label }) => (
									<DropdownMenuItem
										key={field}
										onClick={() => handleSort(field as OpportunitySort["field"])}
									>
										{label}
										{sort.field === field && (
											<span className="ml-auto text-[var(--foreground-muted)]">
												{sort.direction === "asc" ? "↑" : "↓"}
											</span>
										)}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Bulk Actions */}
					{selectedIds.size > 0 && (
						<div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border)]">
							<span className="text-sm text-[var(--foreground-muted)]">
								{selectedIds.size} selected
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleBulkAction("mark-reviewed")}
							>
								<CheckSquare className="h-4 w-4" />
								Mark Reviewed
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleBulkAction("mark-interested")}
							>
								<Star className="h-4 w-4" />
								Interested
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleBulkAction("mark-pursuing")}
							>
								<Target className="h-4 w-4" />
								Pursuing
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleBulkAction("mark-declined")}
							>
								<X className="h-4 w-4" />
								Decline
							</Button>
							<div className="flex-1" />
							<Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
								Clear selection
							</Button>
						</div>
					)}
				</div>
			</div>

			{/* Content */}
			<main className="max-w-[1600px] mx-auto px-6 py-6">
				{isLoading ? (
					<LoadingSkeleton viewMode={viewMode} />
				) : opportunities.length === 0 ? (
					<EmptyState hasFilters={Object.keys(filters).length > 0 || !!searchQuery} />
				) : viewMode === "grid" ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{opportunities.map((opp) => (
							<OpportunityCard
								key={opp.id}
								opportunity={opp}
								isSelected={selectedIds.has(opp.id)}
								onSelect={() => handleSelect(opp.id)}
							/>
						))}
					</div>
				) : (
					<OpportunityTable
						opportunities={opportunities}
						selectedIds={selectedIds}
						onSelectAll={handleSelectAll}
						onSelect={handleSelect}
						sort={sort}
						onSort={handleSort}
					/>
				)}

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--border)]">
						<span className="text-sm text-[var(--foreground-muted)]">
							Page {page} of {totalPages}
						</span>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={page === 1}
								onClick={() => setPage((p) => p - 1)}
							>
								<ChevronLeft className="h-4 w-4" />
								Previous
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={page === totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								Next
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}

// ============================================================================
// Stats Banner
// ============================================================================

function StatsBanner({ stats }: { stats: OpportunityStats }) {
	return (
		<div className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
			<div className="max-w-[1600px] mx-auto px-6 py-4">
				<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
					<StatCard
						label="Total"
						value={stats.total}
						icon={<Briefcase className="h-4 w-4" />}
					/>
					<StatCard
						label="Active"
						value={stats.activeCount}
						icon={<Clock className="h-4 w-4" />}
						color="success"
					/>
					<StatCard
						label="Expired"
						value={stats.expiredCount}
						icon={<AlertCircle className="h-4 w-4" />}
						color="error"
					/>
					<StatCard
						label="Pursuing"
						value={stats.byStatus.pursuing || 0}
						icon={<Target className="h-4 w-4" />}
						color="accent"
					/>
					<StatCard
						label="Won"
						value={stats.byStatus.won || 0}
						icon={<TrendingUp className="h-4 w-4" />}
						color="success"
					/>
					<StatCard
						label="Avg Fit Score"
						value={stats.averageFitScore ? `${Math.round(stats.averageFitScore)}%` : "—"}
						icon={<BarChart3 className="h-4 w-4" />}
					/>
				</div>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	icon,
	color,
}: {
	label: string;
	value: number | string;
	icon: React.ReactNode;
	color?: "success" | "error" | "accent";
}) {
	const colorClasses = {
		success: "text-[var(--success-500)]",
		error: "text-[var(--error-500)]",
		accent: "text-[var(--accent-500)]",
	};

	return (
		<div className="flex items-center gap-3">
			<div
				className={cn(
					"p-2 rounded-[var(--radius-md)] bg-[var(--background)]",
					color ? colorClasses[color] : "text-[var(--foreground-muted)]"
				)}
			>
				{icon}
			</div>
			<div>
				<div className={cn("text-lg font-semibold", color && colorClasses[color])}>
					{typeof value === "number" ? value.toLocaleString() : value}
				</div>
				<div className="text-xs text-[var(--foreground-muted)]">{label}</div>
			</div>
		</div>
	);
}

// ============================================================================
// Filter Dropdown
// ============================================================================

function FilterDropdown({
	label,
	options,
	selected,
	onChange,
}: {
	label: string;
	options: { value: string; label: string }[];
	selected: string[];
	onChange: (values: string[]) => void;
}) {
	const handleToggle = (value: string) => {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant={selected.length > 0 ? "secondary" : "ghost"}
					size="sm"
				>
					<Filter className="h-4 w-4" />
					{label}
					{selected.length > 0 && (
						<span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[var(--accent-500)] text-white">
							{selected.length}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
				{options.length === 0 ? (
					<div className="px-2 py-1.5 text-sm text-[var(--foreground-muted)]">
						No options available
					</div>
				) : (
					options.map((option) => (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={selected.includes(option.value)}
							onCheckedChange={() => handleToggle(option.value)}
						>
							{option.label}
						</DropdownMenuCheckboxItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// Opportunity Card
// ============================================================================

function OpportunityCard({
	opportunity,
	isSelected,
	onSelect,
}: {
	opportunity: OpportunityListItem;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const statusColors: Record<DecisionStatus, string> = {
		pending: "bg-[var(--ink-300)]",
		interested: "bg-[var(--accent-400)]",
		pursuing: "bg-[var(--accent-500)]",
		submitted: "bg-[var(--info-500)]",
		won: "bg-[var(--success-500)]",
		lost: "bg-[var(--error-400)]",
		declined: "bg-[var(--ink-400)]",
		expired: "bg-[var(--error-300)]",
	};

	const priorityStars = Array.from({ length: 5 }, (_, i) => (
		<Star
			key={i}
			className={cn(
				"h-3 w-3",
				i < opportunity.priorityRank
					? "fill-[var(--accent-400)] text-[var(--accent-400)]"
					: "text-[var(--ink-200)]"
			)}
		/>
	));

	return (
		<Card
			interactive
			className={cn(
				"relative",
				isSelected && "ring-2 ring-[var(--accent-500)]"
			)}
		>
			{/* Selection checkbox */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onSelect();
				}}
				className={cn(
					"absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center",
					"transition-all duration-[var(--transition-fast)]",
					isSelected
						? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
						: "border-[var(--border-strong)] hover:border-[var(--accent-400)]"
				)}
			>
				{isSelected && <Check className="h-3 w-3" />}
			</button>

			<CardHeader className="pt-10">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<CardTitle className="text-base line-clamp-2">{opportunity.title}</CardTitle>
						<CardDescription className="mt-1">
							{opportunity.organization || "Unknown Organization"}
						</CardDescription>
					</div>
					<div
						className={cn(
							"flex-shrink-0 w-2 h-2 rounded-full",
							statusColors[opportunity.decisionStatus]
						)}
					/>
				</div>
			</CardHeader>

			<CardContent>
				<div className="space-y-2 text-sm">
					{opportunity.countryRegion && (
						<div className="flex items-center gap-2 text-[var(--foreground-muted)]">
							<MapPin className="h-3.5 w-3.5" />
							<span className="truncate">{opportunity.countryRegion}</span>
						</div>
					)}
					{opportunity.deadline && (
						<div
							className={cn(
								"flex items-center gap-2",
								opportunity.isExpired
									? "text-[var(--error-500)]"
									: "text-[var(--foreground-muted)]"
							)}
						>
							<Calendar className="h-3.5 w-3.5" />
							<span>
								{new Date(opportunity.deadline).toLocaleDateString()}
								{opportunity.daysLeft !== null && (
									<span className="ml-1">
										({opportunity.daysLeft > 0 ? `${opportunity.daysLeft}d left` : "Expired"})
									</span>
								)}
							</span>
						</div>
					)}
					{opportunity.budgetValue && (
						<div className="flex items-center gap-2 text-[var(--foreground-muted)]">
							<DollarSign className="h-3.5 w-3.5" />
							<span className="truncate">{opportunity.budgetValue}</span>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
					<div className="flex items-center gap-0.5">{priorityStars}</div>
					{opportunity.fitScore !== null && (
						<div className="text-xs font-medium text-[var(--accent-500)]">
							{Math.round(opportunity.fitScore)}% fit
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Opportunity Table
// ============================================================================

function OpportunityTable({
	opportunities,
	selectedIds,
	onSelectAll,
	onSelect,
	sort,
	onSort,
}: {
	opportunities: OpportunityListItem[];
	selectedIds: Set<string>;
	onSelectAll: () => void;
	onSelect: (id: string) => void;
	sort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
}) {
	const allSelected = selectedIds.size === opportunities.length && opportunities.length > 0;

	const statusColors: Record<DecisionStatus, { bg: string; text: string }> = {
		pending: { bg: "bg-[var(--ink-100)]", text: "text-[var(--ink-600)]" },
		interested: { bg: "bg-[var(--accent-100)]", text: "text-[var(--accent-700)]" },
		pursuing: { bg: "bg-[var(--accent-200)]", text: "text-[var(--accent-800)]" },
		submitted: { bg: "bg-[var(--info-100)]", text: "text-[var(--info-700)]" },
		won: { bg: "bg-[var(--success-100)]", text: "text-[var(--success-700)]" },
		lost: { bg: "bg-[var(--error-100)]", text: "text-[var(--error-700)]" },
		declined: { bg: "bg-[var(--ink-200)]", text: "text-[var(--ink-700)]" },
		expired: { bg: "bg-[var(--error-50)]", text: "text-[var(--error-600)]" },
	};

	return (
		<div className="border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
			<table className="w-full">
				<thead>
					<tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
						<th className="w-10 px-4 py-3">
							<button
								type="button"
								onClick={onSelectAll}
								className={cn(
									"w-5 h-5 rounded border-2 flex items-center justify-center",
									"transition-all duration-[var(--transition-fast)]",
									allSelected
										? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
										: "border-[var(--border-strong)] hover:border-[var(--accent-400)]"
								)}
							>
								{allSelected && <Check className="h-3 w-3" />}
							</button>
						</th>
						<SortableHeader
							label="Title"
							field="title"
							currentSort={sort}
							onSort={onSort}
						/>
						<SortableHeader
							label="Organization"
							field="organization"
							currentSort={sort}
							onSort={onSort}
						/>
						<SortableHeader
							label="Country"
							field="countryRegion"
							currentSort={sort}
							onSort={onSort}
						/>
						<SortableHeader
							label="Deadline"
							field="deadline"
							currentSort={sort}
							onSort={onSort}
						/>
						<SortableHeader
							label="Budget"
							field="budgetNumeric"
							currentSort={sort}
							onSort={onSort}
						/>
						<SortableHeader
							label="Priority"
							field="priorityRank"
							currentSort={sort}
							onSort={onSort}
						/>
						<th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
							Status
						</th>
						<th className="w-10 px-4 py-3" />
					</tr>
				</thead>
				<tbody>
					{opportunities.map((opp) => (
						<tr
							key={opp.id}
							className={cn(
								"border-b border-[var(--border)] hover:bg-[var(--background-muted)]/50",
								"transition-colors duration-[var(--transition-fast)]",
								selectedIds.has(opp.id) && "bg-[var(--accent-50)]"
							)}
						>
							<td className="px-4 py-3">
								<button
									type="button"
									onClick={() => onSelect(opp.id)}
									className={cn(
										"w-5 h-5 rounded border-2 flex items-center justify-center",
										"transition-all duration-[var(--transition-fast)]",
										selectedIds.has(opp.id)
											? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
											: "border-[var(--border-strong)] hover:border-[var(--accent-400)]"
									)}
								>
									{selectedIds.has(opp.id) && <Check className="h-3 w-3" />}
								</button>
							</td>
							<td className="px-4 py-3">
								<Link
									href={`/opportunities/${opp.id}`}
									className="font-medium text-[var(--foreground)] hover:text-[var(--accent-600)] line-clamp-1"
								>
									{opp.title}
								</Link>
								{opp.category && (
									<div className="text-xs text-[var(--foreground-muted)] mt-0.5">
										{opp.category}
									</div>
								)}
							</td>
							<td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">
								{opp.organization || "—"}
							</td>
							<td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">
								{opp.countryRegion || "—"}
							</td>
							<td className="px-4 py-3 text-sm">
								{opp.deadline ? (
									<div
										className={cn(
											opp.isExpired && "text-[var(--error-500)]"
										)}
									>
										{new Date(opp.deadline).toLocaleDateString()}
										{opp.daysLeft !== null && opp.daysLeft > 0 && (
											<div className="text-xs text-[var(--foreground-muted)]">
												{opp.daysLeft}d left
											</div>
										)}
									</div>
								) : (
									"—"
								)}
							</td>
							<td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">
								{opp.budgetValue || "—"}
							</td>
							<td className="px-4 py-3">
								<div className="flex items-center gap-0.5">
									{Array.from({ length: 5 }, (_, i) => (
										<Star
											key={i}
											className={cn(
												"h-3 w-3",
												i < opp.priorityRank
													? "fill-[var(--accent-400)] text-[var(--accent-400)]"
													: "text-[var(--ink-200)]"
											)}
										/>
									))}
								</div>
							</td>
							<td className="px-4 py-3">
								<span
									className={cn(
										"inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
										statusColors[opp.decisionStatus].bg,
										statusColors[opp.decisionStatus].text
									)}
								>
									{opp.decisionStatus}
								</span>
							</td>
							<td className="px-4 py-3">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<IconButton aria-label="Actions">
											<MoreHorizontal className="h-4 w-4" />
										</IconButton>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											<Link href={`/opportunities/${opp.id}`}>
												<Eye className="h-4 w-4 mr-2" />
												View Details
											</Link>
										</DropdownMenuItem>
										{opp.tags.length > 0 && (
											<DropdownMenuItem asChild>
												<a
													href={opp.tags[0]}
													target="_blank"
													rel="noopener noreferrer"
												>
													<ExternalLink className="h-4 w-4 mr-2" />
													Open Link
												</a>
											</DropdownMenuItem>
										)}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-[var(--error-500)]"
											onClick={() => {
												// Add delete confirmation
											}}
										>
											<Trash2 className="h-4 w-4 mr-2" />
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function SortableHeader({
	label,
	field,
	currentSort,
	onSort,
}: {
	label: string;
	field: OpportunitySort["field"];
	currentSort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
}) {
	const isActive = currentSort.field === field;

	return (
		<th className="px-4 py-3 text-left">
			<button
				type="button"
				onClick={() => onSort(field)}
				className={cn(
					"flex items-center gap-1 text-xs font-medium uppercase tracking-wider",
					"transition-colors duration-[var(--transition-fast)]",
					isActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]",
					"hover:text-[var(--foreground)]"
				)}
			>
				{label}
				{isActive && (
					<span>{currentSort.direction === "asc" ? "↑" : "↓"}</span>
				)}
			</button>
		</th>
	);
}

// ============================================================================
// Loading & Empty States
// ============================================================================

function LoadingSkeleton({ viewMode }: { viewMode: ViewMode }) {
	if (viewMode === "grid") {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="border border-[var(--border)] rounded-[var(--radius-lg)] p-5 animate-pulse"
					>
						<div className="h-5 w-3/4 bg-[var(--background-muted)] rounded mb-2" />
						<div className="h-4 w-1/2 bg-[var(--background-muted)] rounded mb-4" />
						<div className="space-y-2">
							<div className="h-3 w-full bg-[var(--background-muted)] rounded" />
							<div className="h-3 w-2/3 bg-[var(--background-muted)] rounded" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
			{Array.from({ length: 10 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] animate-pulse"
				>
					<div className="w-5 h-5 bg-[var(--background-muted)] rounded" />
					<div className="flex-1">
						<div className="h-4 w-1/3 bg-[var(--background-muted)] rounded mb-1" />
						<div className="h-3 w-1/4 bg-[var(--background-muted)] rounded" />
					</div>
					<div className="h-4 w-24 bg-[var(--background-muted)] rounded" />
					<div className="h-4 w-20 bg-[var(--background-muted)] rounded" />
				</div>
			))}
		</div>
	);
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<div className="text-center py-16">
			<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--background-muted)] flex items-center justify-center">
				<Briefcase className="h-10 w-10 text-[var(--foreground-subtle)]" />
			</div>
			<h2 className="heading-display text-xl text-[var(--foreground)] mb-2">
				{hasFilters ? "No matching opportunities" : "No opportunities yet"}
			</h2>
			<p className="text-[var(--foreground-muted)] max-w-sm mx-auto mb-6">
				{hasFilters
					? "Try adjusting your filters or search query to find opportunities."
					: "Import your first batch of RFPs, EOIs, or tenders to get started."}
			</p>
			{!hasFilters && (
				<Link href="/opportunities/import">
					<Button variant="primary">
						<Upload className="h-4 w-4" />
						Import Opportunities
					</Button>
				</Link>
			)}
		</div>
	);
}
