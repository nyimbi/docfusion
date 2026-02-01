/**
 * Opportunities Page - DocFusion
 *
 * A sophisticated command-center for RFP/tender opportunity tracking.
 * Dense information display with scannable hierarchy and fluid interactions.
 *
 * Design: "Command Center Elegance" - Data-rich, professional, actionable
 *
 * Note: This page uses the shared (app) layout for navigation and ambient background.
 */

"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	useQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	getOpportunities,
	getOpportunityStats,
	getFilterOptions,
	bulkUpdateStatus,
	bulkUpdatePriority,
	markAsReviewed,
} from "@/lib/actions/opportunities";
import { getVoteSummariesBulk } from "@/lib/actions/opportunity-votes";
import type { VoteSummary } from "@/lib/types/opportunity";
import type {
	OpportunityListItem,
	OpportunityFilters,
	OpportunitySort,
	OpportunityStats,
	DecisionStatus,
	PriorityRank,
	PaginatedResponse,
} from "@/lib/types/opportunity";
import { CONTINENT_FILTERS } from "@/lib/constants/continents";
import { Button, IconButton } from "@/components/ui/Button";
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
	MapPin,
	Globe,
	DollarSign,
	Star,
	Check,
	X,
	Clock,
	AlertCircle,
	TrendingUp,
	Target,
	Briefcase,
	ExternalLink,
	Eye,
	Trash2,
	CheckSquare,
	BarChart3,
	Grid3X3,
	List,
	Layers,
	Command,
	Building2,
	Zap,
	ChevronDown,
	ArrowRight,
	Activity,
	Award,
	XCircle,
	CheckCircle,
	AlertTriangle,
	FileText,
	File,
	Search as SearchIcon,
	EyeOff,
} from "lucide-react";

// ============================================================================
// Query Keys
// ============================================================================

const opportunitiesKeys = {
	all: ["opportunities"] as const,
	lists: () => [...opportunitiesKeys.all, "list"] as const,
	list: (filters: OpportunityFilters, sort: OpportunitySort, page: number) =>
		[...opportunitiesKeys.lists(), { filters, sort, page }] as const,
	stats: (filters?: OpportunityFilters) =>
		[...opportunitiesKeys.all, "stats", filters] as const,
	filterOptions: () => [...opportunitiesKeys.all, "filterOptions"] as const,
	voteSummaries: (opportunityIds: string[]) =>
		[...opportunitiesKeys.all, "voteSummaries", opportunityIds] as const,
};

// ============================================================================
// Query Options
// ============================================================================

const OPPORTUNITIES_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const OPPORTUNITIES_GC_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Page Wrapper with Suspense
// ============================================================================

export default function OpportunitiesPage() {
	return (
		<Suspense fallback={<PageSkeleton />}>
			<OpportunitiesContent />
		</Suspense>
	);
}

// ============================================================================
// Main Content
// ============================================================================

function OpportunitiesContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();

	// State
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

	// Filters
	const [searchQuery, setSearchQuery] = React.useState("");
	const [filters, setFilters] = React.useState<OpportunityFilters>({});
	const [sort, setSort] = React.useState<OpportunitySort>({
		field: "deadline",
		direction: "asc",
	});
	const [page, setPage] = React.useState(1);
	const pageSize = 25;

	// Show expired toggle (default: false - hide expired)
	const [showExpired, setShowExpired] = React.useState(false);

	// Vote status filter (client-side - Go, No Go, Pending, No Votes)
	const [voteStatusFilter, setVoteStatusFilter] = React.useState<string[]>([]);

	// Build query filters
	const queryFilters: OpportunityFilters = React.useMemo(() => {
		const result: OpportunityFilters = {
			...filters,
			search: searchQuery || undefined,
		};
		if (!showExpired) {
			result.isExpired = false;
		}
		return result;
	}, [filters, searchQuery, showExpired]);

	// Query: Opportunities list
	const {
		data: opportunitiesData,
		isLoading: isOpportunitiesLoading,
		isFetching: isOpportunitiesFetching,
	} = useQuery<PaginatedResponse<OpportunityListItem>, Error>({
		queryKey: opportunitiesKeys.list(queryFilters, sort, page),
		queryFn: () => getOpportunities(queryFilters, sort, { page, pageSize }),
		staleTime: OPPORTUNITIES_STALE_TIME,
		gcTime: OPPORTUNITIES_GC_TIME,
	});

	// Query: Stats
	const { data: stats } = useQuery<OpportunityStats, Error>({
		queryKey: opportunitiesKeys.stats(queryFilters),
		queryFn: () => getOpportunityStats(queryFilters),
		staleTime: OPPORTUNITIES_STALE_TIME,
	});

	// Query: Filter options
	const { data: filterOptions = { categories: [], sectors: [], countries: [], organizations: [], sourceFiles: [] } } = useQuery<{
		categories: string[];
		sectors: string[];
		countries: string[];
		organizations: string[];
		sourceFiles: string[];
	}, Error>({
		queryKey: opportunitiesKeys.filterOptions(),
		queryFn: getFilterOptions,
		staleTime: 30 * 60 * 1000, // 30 minutes - filter options change rarely
	});

	// Get opportunity IDs for vote summaries query
	const opportunityIds = React.useMemo(() => {
		return opportunitiesData?.data.map((o) => o.id) ?? [];
	}, [opportunitiesData]);

	// Query: Vote summaries
	const { data: voteSummaries = new Map<string, VoteSummary>() } = useQuery<
		Map<string, VoteSummary>,
		Error
	>({
		queryKey: opportunitiesKeys.voteSummaries(opportunityIds),
		queryFn: () => getVoteSummariesBulk(opportunityIds),
		enabled: opportunityIds.length > 0,
		staleTime: OPPORTUNITIES_STALE_TIME,
	});

	// Mutation: Bulk update status
	const updateStatusMutation = useMutation<
		number,
		Error,
		{ ids: string[]; status: DecisionStatus },
		{ previousData: PaginatedResponse<OpportunityListItem> | undefined }
	>({
		mutationFn: ({ ids, status }) => bulkUpdateStatus(ids, status),
		onMutate: async ({ ids, status }) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({
				queryKey: opportunitiesKeys.lists(),
			});

			// Snapshot current data
			const previousData = queryClient.getQueryData<
				PaginatedResponse<OpportunityListItem>
			>(opportunitiesKeys.list(queryFilters, sort, page));

			// Optimistically update
			if (previousData) {
				queryClient.setQueryData<
					PaginatedResponse<OpportunityListItem>
				>(opportunitiesKeys.list(queryFilters, sort, page), {
					...previousData,
					data: previousData.data.map((opp) =>
						ids.includes(opp.id) ? { ...opp, decisionStatus: status } : opp
					),
				});
			}

			return { previousData };
		},
		onError: (_err, _variables, context) => {
			// Rollback on error
			if (context?.previousData) {
				queryClient.setQueryData(
					opportunitiesKeys.list(queryFilters, sort, page),
					context.previousData
				);
			}
		},
		onSettled: () => {
			// Invalidate related queries
			queryClient.invalidateQueries({ queryKey: opportunitiesKeys.lists() });
			queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
		},
	});

	// Mutation: Bulk update priority
	const updatePriorityMutation = useMutation<
		number,
		Error,
		{ ids: string[]; priority: PriorityRank },
		{ previousData: PaginatedResponse<OpportunityListItem> | undefined }
	>({
		mutationFn: ({ ids, priority }) => bulkUpdatePriority(ids, priority),
		onMutate: async ({ ids, priority }) => {
			await queryClient.cancelQueries({
				queryKey: opportunitiesKeys.lists(),
			});

			const previousData = queryClient.getQueryData<
				PaginatedResponse<OpportunityListItem>
			>(opportunitiesKeys.list(queryFilters, sort, page));

			if (previousData) {
				queryClient.setQueryData<
					PaginatedResponse<OpportunityListItem>
				>(opportunitiesKeys.list(queryFilters, sort, page), {
					...previousData,
					data: previousData.data.map((opp) =>
						ids.includes(opp.id) ? { ...opp, priorityRank: priority } : opp
					),
				});
			}

			return { previousData };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(
					opportunitiesKeys.list(queryFilters, sort, page),
					context.previousData
				);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: opportunitiesKeys.lists() });
			queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
		},
	});

	// Mutation: Mark as reviewed
	const markAsReviewedMutation = useMutation<
		number,
		Error,
		{ ids: string[]; reviewed: boolean }
	>({
		mutationFn: ({ ids, reviewed }) => markAsReviewed(ids, reviewed),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: opportunitiesKeys.lists() });
			queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
		},
	});

	// Derived state
	const rawOpportunities = opportunitiesData?.data ?? [];
	const totalPages = opportunitiesData?.totalPages ?? 1;
	const total = opportunitiesData?.total ?? 0;
	const isLoading = isOpportunitiesLoading;

	// Apply client-side vote status filter
	// Uses majority-based logic: Go = more go than no-go votes, No Go = more no-go than go votes
	const opportunities = React.useMemo(() => {
		if (voteStatusFilter.length === 0) return rawOpportunities;

		return rawOpportunities.filter((opp) => {
			const voteSummary = voteSummaries.get(opp.id);

			// Determine vote status based on vote majority (not strict consensus)
			let status: string;
			if (!voteSummary || voteSummary.totalVotes === 0) {
				status = "no_votes";
			} else if (voteSummary.goCount > voteSummary.noGoCount) {
				// More Go votes than No-Go votes
				status = "go";
			} else if (voteSummary.noGoCount > voteSummary.goCount) {
				// More No-Go votes than Go votes
				status = "no_go";
			} else {
				// Equal votes or only abstains - undecided
				status = "pending";
			}

			return voteStatusFilter.includes(status);
		});
	}, [rawOpportunities, voteSummaries, voteStatusFilter]);

	// Prefetch next page
	React.useEffect(() => {
		if (page < totalPages) {
			const nextPage = page + 1;
			queryClient.prefetchQuery({
				queryKey: opportunitiesKeys.list(queryFilters, sort, nextPage),
				queryFn: () =>
					getOpportunities(queryFilters, sort, { page: nextPage, pageSize }),
				staleTime: OPPORTUNITIES_STALE_TIME,
			});
		}
	}, [page, totalPages, queryFilters, sort, queryClient]);

	// Handlers
	const handleSearch = React.useCallback((e: React.FormEvent) => {
		e.preventDefault();
		setPage(1);
	}, []);

	const handleSort = (field: OpportunitySort["field"]) => {
		setSort((prev) => ({
			field,
			direction:
				prev.field === field && prev.direction === "asc" ? "desc" : "asc",
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
					await markAsReviewedMutation.mutateAsync({ ids, reviewed: true });
					break;
				case "mark-interested":
					await updateStatusMutation.mutateAsync({ ids, status: "interested" });
					break;
				case "mark-pursuing":
					await updateStatusMutation.mutateAsync({ ids, status: "pursuing" });
					break;
				case "mark-declined":
					await updateStatusMutation.mutateAsync({ ids, status: "declined" });
					break;
				case "priority-high":
					await updatePriorityMutation.mutateAsync({ ids, priority: 5 });
					break;
				case "priority-medium":
					await updatePriorityMutation.mutateAsync({ ids, priority: 3 });
					break;
				case "priority-low":
					await updatePriorityMutation.mutateAsync({ ids, priority: 1 });
					break;
			}
			setSelectedIds(new Set());
		} catch (err) {
			console.error("Bulk action failed:", err);
		}
	};

	// Toggle show expired with explicit handling
	const handleToggleExpired = () => {
		setShowExpired((prev) => {
			const newValue = !prev;
			// Update filters based on the new state
			if (newValue) {
				// Showing expired - remove the isExpired filter
				setFilters((prev) => {
					const { isExpired, ...rest } = prev;
					return rest;
				});
			} else {
				// Hiding expired - add isExpired filter
				setFilters((prev) => ({ ...prev, isExpired: false }));
			}
			return newValue;
		});
		setPage(1);
	};

	// Refresh handler
	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
	};

	return (
		<div className="h-full overflow-y-auto p-6 relative">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-foreground mb-1">
						Opportunities
					</h1>
					<p className="text-sm text-muted-foreground">
						Track and manage RFPs, tenders, and procurement opportunities
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						onClick={handleRefresh}
						className="text-muted-foreground hover:text-foreground"
					>
						<RefreshCw
							className={cn(
								"h-4 w-4",
								isOpportunitiesFetching && "animate-spin"
							)}
						/>
					</Button>
					<Link href="/opportunities/import">
						<Button>
							<Upload className="h-4 w-4" />
							<span className="hidden sm:inline">Import</span>
						</Button>
					</Link>
				</div>
			</div>

			{/* Stats Banner */}
			{stats && <StatsBanner stats={stats} />}

			{/* Toolbar */}
			<div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6">
				<div className="flex items-center gap-4 flex-wrap">
					{/* Search */}
					<form onSubmit={handleSearch} className="relative group flex-1 max-w-md">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<Search className="h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
						</div>
						<input
							type="search"
							placeholder="Search opportunities..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className={cn(
								"w-full h-10 pl-10 pr-4 rounded-xl",
								"bg-background border border-input",
								"text-foreground placeholder:text-muted-foreground",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:border-input",
								"transition-all duration-200"
							)}
						/>
					</form>

					{/* Filters */}
					<FilterDropdown
						label="Status"
						icon={<Activity className="w-4 h-4" />}
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
						icon={<Briefcase className="w-4 h-4" />}
						options={filterOptions.categories.map((c) => ({ value: c, label: c }))}
						selected={filters.categories || []}
						onChange={(values) => handleFilterChange("categories", values)}
					/>

					<FilterDropdown
						label="Country"
						icon={<MapPin className="w-4 h-4" />}
						options={filterOptions.countries.map((c) => ({ value: c, label: c }))}
						selected={filters.countries || []}
						onChange={(values) => handleFilterChange("countries", values)}
					/>

					{/* Vote Status Filter (Go/No-Go) */}
					<FilterDropdown
						label="Go/No-Go"
						icon={<CheckCircle className="w-4 h-4" />}
						options={[
							{ value: "go", label: "Go (Majority)" },
							{ value: "no_go", label: "No Go (Majority)" },
							{ value: "pending", label: "Tied / Undecided" },
							{ value: "no_votes", label: "No Votes" },
						]}
						selected={voteStatusFilter}
						onChange={(values) => setVoteStatusFilter(values)}
					/>

					{/* Show Expired Toggle */}
					<button
						onClick={handleToggleExpired}
						className={cn(
							"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
							showExpired
								? "bg-red-500/10 text-red-500 border border-red-500/20"
								: "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
						)}
						title={
							showExpired ? "Hide expired opportunities" : "Show expired opportunities"
						}
					>
						{showExpired ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
						Show Expired
					</button>

					{/* Quick filter: Active only */}
					<button
						onClick={() =>
							handleFilterChange(
								"isExpired",
								filters.isExpired === false ? undefined : false
							)
						}
						className={cn(
							"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
							filters.isExpired === false && !showExpired
								? "bg-green-500/10 text-green-600 border border-green-500/20"
								: "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
						)}
					>
						<Clock className="w-4 h-4" />
						Active Only
					</button>

					{/* Quick filter: Africa */}
					<button
						onClick={() =>
							handleFilterChange(
								"continent",
								filters.continent === "africa" ? undefined : "africa"
							)
						}
						className={cn(
							"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
							filters.continent === "africa"
								? "bg-primary/10 text-primary border border-primary/20"
								: "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
						)}
					>
						<Globe className="w-4 h-4" />
						Africa
					</button>

					<div className="flex-1" />

					{/* View Toggle */}
					<ViewToggle mode={viewMode} onChange={setViewMode} />

					{/* Sort */}
					<SortDropdown sort={sort} onSort={handleSort} />
				</div>

				{/* Bulk Actions */}
				{selectedIds.size > 0 && (
					<BulkActionBar
						count={selectedIds.size}
						onAction={handleBulkAction}
						onClear={() => setSelectedIds(new Set())}
					/>
				)}
			</div>

			{/* Main Content */}
			<div className="relative">
				{isLoading ? (
					<LoadingSkeleton viewMode={viewMode} />
				) : opportunities.length === 0 ? (
					<EmptyState
						hasFilters={
							Object.keys(filters).length > 0 || !!searchQuery || !showExpired
						}
					/>
				) : viewMode === "grid" ? (
					<OpportunityGrid
						opportunities={opportunities}
						selectedIds={selectedIds}
						onSelect={handleSelect}
						voteSummaries={voteSummaries}
					/>
				) : (
					<OpportunityTable
						opportunities={opportunities}
						selectedIds={selectedIds}
						onSelectAll={handleSelectAll}
						onSelect={handleSelect}
						sort={sort}
						onSort={handleSort}
						voteSummaries={voteSummaries}
					/>
				)}

				{/* Pagination */}
				{totalPages > 1 && (
					<Pagination
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
					/>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Stats Banner
// ============================================================================

function StatsBanner({ stats }: { stats: OpportunityStats }) {
	return (
		<div className="rounded-xl border bg-muted/20 p-4 mb-6">
			<div className="flex items-center gap-8 overflow-x-auto scrollbar-none">
				<StatPill
					icon={<Briefcase className="w-4 h-4" />}
					label="Total"
					value={stats.total}
					color="default"
				/>
				<StatPill
					icon={<Clock className="w-4 h-4" />}
					label="Active"
					value={stats.activeCount}
					color="green"
				/>
				<StatPill
					icon={<AlertCircle className="w-4 h-4" />}
					label="Expired"
					value={stats.expiredCount}
					color="red"
				/>
				<StatPill
					icon={<Target className="w-4 h-4" />}
					label="Pursuing"
					value={stats.byStatus.pursuing || 0}
					color="amber"
				/>
				<StatPill
					icon={<Award className="w-4 h-4" />}
					label="Won"
					value={stats.byStatus.won || 0}
					color="green"
				/>
				<div className="h-6 w-px bg-border" />
				<StatPill
					icon={<BarChart3 className="w-4 h-4" />}
					label="Avg Fit"
					value={stats.averageFitScore ? `${Math.round(stats.averageFitScore)}%` : "—"}
					color="blue"
				/>
			</div>
		</div>
	);
}

function StatPill({
	icon,
	label,
	value,
	color,
}: {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	color: "default" | "amber" | "blue" | "green" | "red";
}) {
	const colorClasses = {
		default: "text-muted-foreground",
		amber: "text-amber-500",
		blue: "text-blue-500",
		green: "text-green-500",
		red: "text-destructive",
	};

	return (
		<div className="flex items-center gap-3 shrink-0">
			<div className="p-2 rounded-lg bg-muted text-foreground">{icon}</div>
			<div>
				<div className={cn("text-lg font-semibold tabular-nums", colorClasses[color])}>
					{value}
				</div>
				<div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
			</div>
		</div>
	);
}

// ============================================================================
// Filter Dropdown
// ============================================================================

function FilterDropdown({
	label,
	icon,
	options,
	selected,
	onChange,
}: {
	label: string;
	icon: React.ReactNode;
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
				<button
					className={cn(
						"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
						selected.length > 0
							? "bg-primary/10 text-primary border border-primary/20"
							: "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
					)}
				>
					{icon}
					{label}
					{selected.length > 0 && (
						<span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--accent-500)] text-white">
							{selected.length}
						</span>
						)}
					<ChevronDown className="w-3 h-3 opacity-50" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
				{options.length === 0 ? (
					<div className="px-3 py-2 text-sm text-[var(--ink-500)]">No options available</div>
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
// View Toggle
// ============================================================================

function ViewToggle({
	mode,
	onChange,
}: {
	mode: "grid" | "list";
	onChange: (mode: "grid" | "list") => void;
}) {
	return (
		<div className="flex items-center p-1 rounded-lg bg-muted border border-border">
			<button
				type="button"
				onClick={() => onChange("grid")}
				className={cn(
					"p-2 rounded-md transition-all duration-150",
					mode === "grid"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				aria-label="Grid view"
			>
				<Grid3X3 className="w-4 h-4" />
			</button>
			<button
				type="button"
				onClick={() => onChange("list")}
				className={cn(
					"p-2 rounded-md transition-all duration-150",
					mode === "list"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				aria-label="List view"
			>
				<List className="w-4 h-4" />
			</button>
		</div>
	);
}

// ============================================================================
// Sort Dropdown
// ============================================================================

function SortDropdown({
	sort,
	onSort,
}: {
	sort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
}) {
	const sortOptions: { field: OpportunitySort["field"]; label: string }[] = [
		{ field: "deadline", label: "Deadline" },
		{ field: "priorityRank", label: "Priority" },
		{ field: "fitScore", label: "Fit Score" },
		{ field: "budgetNumeric", label: "Budget" },
		{ field: "title", label: "Title" },
		{ field: "organization", label: "Organization" },
	];

	const currentLabel = sortOptions.find((o) => o.field === sort.field)?.label || "Sort";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					className={cn(
						"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
						"bg-background border border-input",
						"hover:bg-accent hover:text-accent-foreground transition-all duration-150"
					)}
				>
					<ArrowUpDown className="w-4 h-4" />
					{currentLabel}
					<span className="text-muted-foreground">
						{sort.direction === "asc" ? "↑" : "↓"}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{sortOptions.map(({ field, label }) => (
					<DropdownMenuItem
						key={field}
						onClick={() => onSort(field)}
						className={cn(sort.field === field && "text-primary")}
					>
						{label}
						{sort.field === field && (
							<span className="ml-auto">{sort.direction === "asc" ? "↑" : "↓"}</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// Bulk Action Bar
// ============================================================================

function BulkActionBar({
	count,
	onAction,
	onClear,
}: {
	count: number;
	onAction: (action: string) => void;
	onClear: () => void;
}) {
	return (
		<div className="flex items-center gap-3 mt-3 pt-3 border-t border-border animate-fade-up">
			<span className="text-sm text-primary font-medium">{count} selected</span>

			<div className="flex items-center gap-1">
				<ActionButton
					onClick={() => onAction("mark-reviewed")}
					icon={<CheckSquare className="w-4 h-4" />}
				>
					Reviewed
				</ActionButton>
				<ActionButton onClick={() => onAction("mark-interested")} icon={<Star className="w-4 h-4" />}>
					Interested
				</ActionButton>
				<ActionButton onClick={() => onAction("mark-pursuing")} icon={<Target className="w-4 h-4" />}>
					Pursuing
				</ActionButton>
				<ActionButton onClick={() => onAction("mark-declined")} icon={<X className="w-4 h-4" />}>
					Decline
				</ActionButton>
			</div>

			<div className="flex-1" />

			<button
				onClick={onClear}
				className="text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				Clear selection
			</button>
		</div>
	);
}

function ActionButton({
	onClick,
	icon,
	children,
}: {
	onClick: () => void;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm",
				"text-muted-foreground hover:text-foreground hover:bg-accent",
				"transition-all duration-150"
			)}
		>
			{icon}
			{children}
		</button>
	);
}

// ============================================================================
// Go/No-Go Vote Status Badge
// ============================================================================

function VoteStatusBadge({ voteSummary }: { voteSummary?: VoteSummary }) {
	if (!voteSummary || voteSummary.totalVotes === 0) {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground bg-muted">
				<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
				No votes
			</span>
		);
	}

	const { goCount, noGoCount, totalVotes, hasConsensus, recommendedDecision } = voteSummary;

	if (hasConsensus && recommendedDecision === "go") {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-green-500 bg-green-500/10 border border-green-500/20">
				<CheckCircle className="w-3 h-3" />
				Go ({goCount})
			</span>
		);
	}

	if (hasConsensus && recommendedDecision === "no_go") {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/20">
				<XCircle className="w-3 h-3" />
				No Go ({noGoCount})
			</span>
		);
	}

	return (
		<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20">
			<AlertTriangle className="w-3 h-3" />
			Pending ({goCount}Go/{noGoCount}No)
		</span>
	);
}

// ============================================================================
// RFP Documents Section
// ============================================================================

function RFPDocumentsSection({
	rfpLink,
	title,
	organization,
}: {
	rfpLink?: string | null;
	title: string;
	organization?: string | null;
}) {
	// Extract potential document links from rfpLink
	const hasRfpLink = !!rfpLink && rfpLink.trim().length > 0;

	// Build Google search query
	const searchQuery = encodeURIComponent(`${title} ${organization || ""} RFP tender`);
	const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;

	return (
		<div className="flex items-center gap-2 mt-3">
			{hasRfpLink ? (
				<>
					<a
						href={rfpLink!}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--accent-400)] bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20 hover:bg-[var(--accent-500)]/20 transition-colors"
					>
						<FileText className="w-3 h-3" />
						<span className="truncate max-w-20">RFP Doc</span>
						<ExternalLink className="w-2.5 h-2.5" />
					</a>
					<a
						href={googleSearchUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--ink-400)] bg-[var(--ink-800)]/50 border border-[var(--ink-700)]/50 hover:text-[var(--ink-200)] hover:bg-[var(--ink-800)] transition-colors"
						title="Search on Google"
					>
						<SearchIcon className="w-3 h-3" />
					</a>
				</>
			) : (
				<a
					href={googleSearchUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--ink-400)] bg-[var(--ink-800)]/50 border border-[var(--ink-700)]/50 hover:text-[var(--ink-200)] hover:bg-[var(--ink-800)] transition-colors"
				>
					<SearchIcon className="w-3 h-3" />
					Find Documents
				</a>
			)}
		</div>
	);
}

// ============================================================================
// Opportunity Grid
// ============================================================================

function OpportunityGrid({
	opportunities,
	selectedIds,
	onSelect,
	voteSummaries,
}: {
	opportunities: OpportunityListItem[];
	selectedIds: Set<string>;
	onSelect: (id: string) => void;
	voteSummaries: Map<string, VoteSummary>;
}) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{opportunities.map((opp, index) => (
				<OpportunityCard
					key={opp.id}
					opportunity={opp}
					isSelected={selectedIds.has(opp.id)}
					onSelect={() => onSelect(opp.id)}
					index={index}
					voteSummary={voteSummaries.get(opp.id)}
				/>
			))}
		</div>
	);
}

// ============================================================================
// Opportunity Card
// ============================================================================

const statusColors: Record<
	DecisionStatus,
	{ bg: string; text: string; dot: string }
> = {
	pending: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
	interested: { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-500" },
	pursuing: { bg: "bg-purple-500/10", text: "text-purple-500", dot: "bg-purple-500" },
	submitted: { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500" },
	won: { bg: "bg-green-500/10", text: "text-green-500", dot: "bg-green-500" },
	lost: { bg: "bg-red-500/10", text: "text-red-500", dot: "bg-red-500" },
	declined: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
	expired: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
};

function OpportunityCard({
	opportunity,
	isSelected,
	onSelect,
	index,
	voteSummary,
}: {
	opportunity: OpportunityListItem;
	isSelected: boolean;
	onSelect: () => void;
	index: number;
	voteSummary?: VoteSummary;
}) {
	const status = statusColors[opportunity.decisionStatus];

	return (
		<Link
			href={`/opportunities/${opportunity.id}`}
			className={cn(
				"group relative flex flex-col p-5 rounded-2xl",
				"bg-gradient-to-br from-[var(--ink-900)]/80 to-[var(--ink-900)]/40",
				"border transition-all duration-300 ease-out",
				"hover:border-[var(--accent-500)]/50 hover:shadow-lg hover:shadow-[var(--accent-500)]/5",
				isSelected
					? "border-[var(--accent-500)] ring-1 ring-[var(--accent-500)]/20"
					: "border-[var(--ink-800)]/50",
				"opacity-0 animate-fade-up"
			)}
			style={{
				animationDelay: `${Math.min(index * 50, 400)}ms`,
				animationFillMode: "forwards",
			}}
		>
			{/* Selection checkbox - stop propagation to allow selection when clicking checkbox */}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onSelect();
				}}
				className={cn(
					"absolute top-4 left-4 w-5 h-5 rounded-md flex items-center justify-center z-10",
					"border-2 transition-all duration-150",
					isSelected
						? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
						: "border-[var(--ink-600)] hover:border-[var(--accent-500)]"
				)}
			>
				{isSelected && <Check className="w-3 h-3" />}
			</button>

			{/* Header */}
			<div className="flex items-start justify-between gap-2 ml-8 mb-3">
				<div className="flex items-center gap-1.5 flex-wrap">
					<span
						className={cn(
							"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
							status.bg,
							status.text
						)}
					>
						<span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
						{opportunity.decisionStatus}
					</span>
					<VoteStatusBadge voteSummary={voteSummary} />
					{/* Category badge */}
					{opportunity.category && (
						<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-[var(--ink-400)] bg-[var(--ink-800)]/50">
							{opportunity.category}
						</span>
					)}
				</div>
				{opportunity.daysLeft !== null && opportunity.daysLeft > 0 && (
					<span
						className={cn(
							"text-xs font-medium",
							opportunity.daysLeft <= 7 ? "text-[var(--error-400)]" : "text-[var(--ink-500)]"
						)}
					>
						{opportunity.daysLeft}d left
					</span>
				)}
				{opportunity.isExpired && <span className="text-xs font-medium text-red-500">Expired</span>}
			</div>

			{/* Content */}
			<div className="flex-1 ml-8">
				<h3 className="text-[var(--ink-100)] font-semibold text-base mb-2 line-clamp-2 group-hover:text-[var(--accent-300)] transition-colors">
					{opportunity.title}
				</h3>
				{opportunity.organization && (
					<p className="text-sm text-[var(--ink-500)] flex items-center gap-1.5 mb-2">
						<Building2 className="w-3.5 h-3.5" />
						{opportunity.organization}
					</p>
				)}
			</div>

			{/* RFP Documents */}
			<div className="ml-8">
				<RFPDocumentsSection
					rfpLink={(opportunity as { rfpLink?: string }).rfpLink}
					title={opportunity.title}
					organization={opportunity.organization}
				/>
			</div>

			{/* Meta */}
			<div className="flex flex-wrap items-center gap-3 mt-3 pt-3 ml-8 border-t border-[var(--ink-800)]/50 text-xs text-[var(--ink-500)]">
				{opportunity.countryRegion && (
					<span className="flex items-center gap-1">
						<MapPin className="w-3 h-3" />
						{opportunity.countryRegion}
					</span>
				)}
				{opportunity.budgetValue && (
					<span className="flex items-center gap-1">
						<DollarSign className="w-3 h-3" />
						{opportunity.budgetValue}
					</span>
				)}
			</div>

			{/* Priority Stars */}
			<div className="flex items-center justify-between mt-3 ml-8">
				<div className="flex items-center gap-0.5">
					{Array.from({ length: 5 }, (_, i) => (
						<Star
							key={i}
							className={cn(
								"w-3.5 h-3.5",
								i < opportunity.priorityRank
									? "fill-[var(--accent-400)] text-[var(--accent-400)]"
									: "text-[var(--ink-700)]"
							)}
						/>
					))}
				</div>
				{opportunity.fitScore !== null && (
					<span className="text-xs font-medium text-[var(--accent-400)]">
						{Math.round(opportunity.fitScore)}% fit
					</span>
				)}
			</div>
		</Link>
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
	voteSummaries,
}: {
	opportunities: OpportunityListItem[];
	selectedIds: Set<string>;
	onSelectAll: () => void;
	onSelect: (id: string) => void;
	sort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
	voteSummaries: Map<string, VoteSummary>;
}) {
	const allSelected = selectedIds.size === opportunities.length && opportunities.length > 0;

	return (
		<div className="border border-[var(--ink-800)]/50 rounded-xl overflow-hidden bg-[var(--ink-900)]/20">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b border-[var(--ink-800)]/50 bg-[var(--ink-900)]/50">
							<th className="w-12 px-4 py-3">
								<button
									type="button"
									onClick={onSelectAll}
									className={cn(
										"w-5 h-5 rounded-md flex items-center justify-center",
										"border-2 transition-all duration-150",
										allSelected
											? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
											: "border-[var(--ink-600)] hover:border-[var(--accent-500)]"
									)}
								>
									{allSelected && <Check className="w-3 h-3" />}
								</button>
							</th>
							<SortableHeader
								field="title"
								label="Opportunity"
								currentSort={sort}
								onSort={onSort}
							/>
							<SortableHeader
								field="organization"
								label="Organization"
								currentSort={sort}
								onSort={onSort}
							/>
							<SortableHeader
								field="countryRegion"
								label="Location"
								currentSort={sort}
								onSort={onSort}
							/>
							<SortableHeader
								field="deadline"
								label="Deadline"
								currentSort={sort}
								onSort={onSort}
							/>
							<SortableHeader
								field="budgetNumeric"
								label="Budget"
								currentSort={sort}
								onSort={onSort}
							/>
							<SortableHeader
								field="priorityRank"
								label="Priority"
								currentSort={sort}
								onSort={onSort}
							/>
							<th className="px-4 py-3 text-left text-xs font-medium text-[var(--ink-500)] uppercase tracking-wider">
								Status
							</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-[var(--ink-500)] uppercase tracking-wider">
								Vote Status
							</th>
							<th className="w-12 px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{opportunities.map((opp, index) => (
							<OpportunityRow
								key={opp.id}
								opportunity={opp}
								isSelected={selectedIds.has(opp.id)}
								onSelect={() => onSelect(opp.id)}
								index={index}
								voteSummary={voteSummaries.get(opp.id)}
							/>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function SortableHeader({
	field,
	label,
	currentSort,
	onSort,
}: {
	field: OpportunitySort["field"];
	label: string;
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
					"flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors",
					isActive ? "text-[var(--accent-400)]" : "text-[var(--ink-500)] hover:text-[var(--ink-300)]"
				)}
			>
				{label}
				{isActive && <span>{currentSort.direction === "asc" ? "↑" : "↓"}</span>}
			</button>
		</th>
	);
}

function OpportunityRow({
	opportunity,
	isSelected,
	onSelect,
	index,
	voteSummary,
}: {
	opportunity: OpportunityListItem;
	isSelected: boolean;
	onSelect: () => void;
	index: number;
	voteSummary?: VoteSummary;
}) {
	const status = statusColors[opportunity.decisionStatus];

	return (
		<tr
			className={cn(
				"border-b border-[var(--ink-800)]/30 transition-colors",
				isSelected ? "bg-[var(--accent-500)]/5" : "hover:bg-[var(--ink-800)]/30",
				"opacity-0 animate-fade-up"
			)}
			style={{
				animationDelay: `${Math.min(index * 30, 300)}ms`,
				animationFillMode: "forwards",
			}}
		>
			<td className="px-4 py-3">
				<button
					type="button"
					onClick={onSelect}
					className={cn(
						"w-5 h-5 rounded-md flex items-center justify-center",
						"border-2 transition-all duration-150",
						isSelected
							? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
							: "border-[var(--ink-600)] hover:border-[var(--accent-500)]"
					)}
				>
					{isSelected && <Check className="w-3 h-3" />}
				</button>
			</td>
			<td className="px-4 py-3">
				<Link
					href={`/opportunities/${opportunity.id}`}
					className="text-[var(--ink-200)] font-medium hover:text-[var(--accent-400)] transition-colors line-clamp-1"
				>
					{opportunity.title}
				</Link>
				{opportunity.category && (
					<div className="text-xs text-[var(--ink-500)] mt-0.5">{opportunity.category}</div>
				)}
			</td>
			<td className="px-4 py-3 text-sm text-[var(--ink-400)]">
				{opportunity.organization || "—"}
			</td>
			<td className="px-4 py-3 text-sm text-[var(--ink-400)]">
				{opportunity.countryRegion || "—"}
			</td>
			<td className="px-4 py-3 text-sm">
				{opportunity.deadline ? (
					<div className={cn(opportunity.isExpired && "text-[var(--error-400)]")}>
						{new Date(opportunity.deadline).toLocaleDateString()}
						{opportunity.daysLeft !== null && opportunity.daysLeft > 0 && (
							<div className="text-xs text-[var(--ink-500)]">{opportunity.daysLeft}d</div>
						)}
						{opportunity.isExpired && <div className="text-xs text-red-500">Expired</div>}
					</div>
				) : (
					<span className="text-[var(--ink-500)]">—</span>
				)}
			</td>
			<td className="px-4 py-3 text-sm text-[var(--ink-400)]">
				{opportunity.budgetValue || "—"}
			</td>
			<td className="px-4 py-3">
				<div className="flex items-center gap-0.5">
					{Array.from({ length: 5 }, (_, i) => (
						<Star
							key={i}
							className={cn(
								"w-3 h-3",
								i < opportunity.priorityRank
									? "fill-[var(--accent-400)] text-[var(--accent-400)]"
									: "text-[var(--ink-700)]"
							)}
						/>
					))}
				</div>
			</td>
			<td className="px-4 py-3">
				<span
					className={cn(
						"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
						status.bg,
						status.text
					)}
				>
					<span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
					{opportunity.decisionStatus}
				</span>
			</td>
			<td className="px-4 py-3">
				<VoteStatusBadge voteSummary={voteSummary} />
			</td>
			<td className="px-4 py-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="p-1.5 rounded-lg text-[var(--ink-500)] hover:text-[var(--ink-300)] hover:bg-[var(--ink-800)]/50 transition-all">
							<MoreHorizontal className="w-4 h-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="bg-[var(--ink-900)] border-[var(--ink-700)]">
						<DropdownMenuItem asChild className="text-[var(--ink-300)]">
							<Link href={`/opportunities/${opportunity.id}`}>
								<Eye className="w-4 h-4 mr-2" />
								View Details
							</Link>
						</DropdownMenuItem>
						{/* Show RFP link if available */}
						{(opportunity as { rfpLink?: string }).rfpLink && (
							<DropdownMenuItem asChild className="text-[var(--ink-300)]">
								<a
									href={(opportunity as { rfpLink?: string }).rfpLink!}
									target="_blank"
									rel="noopener noreferrer"
								>
									<FileText className="w-4 h-4 mr-2" />
									Open RFP Document
								</a>
							</DropdownMenuItem>
						)}
						{/* Google Search Option */}
						<DropdownMenuItem asChild className="text-[var(--ink-300)]">
							<a
								href={`https://www.google.com/search?q=${encodeURIComponent(
									`${opportunity.title} ${opportunity.organization || ""} RFP`
								)}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<SearchIcon className="w-4 h-4 mr-2" />
								Search on Google
							</a>
						</DropdownMenuItem>
						{opportunity.tags.length > 0 && (
							<DropdownMenuItem asChild className="text-[var(--ink-300)]">
								<a href={opportunity.tags[0]} target="_blank" rel="noopener noreferrer">
									<ExternalLink className="w-4 h-4 mr-2" />
									Open Link
								</a>
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator className="bg-[var(--ink-800)]" />
						<DropdownMenuItem className="text-[var(--error-400)]">
							<Trash2 className="w-4 h-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</td>
		</tr>
	);
}

// ============================================================================
// Pagination
// ============================================================================

function Pagination({
	page,
	totalPages,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	return (
		<div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--ink-800)]/50">
			<span className="text-sm text-[var(--ink-500)]">
				Page {page} of {totalPages}
			</span>
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={page === 1}
					onClick={() => onPageChange(page - 1)}
					className="text-[var(--ink-400)] disabled:opacity-50"
				>
					<ChevronLeft className="w-4 h-4" />
					Previous
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={page === totalPages}
					onClick={() => onPageChange(page + 1)}
					className="text-[var(--ink-400)] disabled:opacity-50"
				>
					Next
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-[var(--accent-500)]/20 rounded-3xl blur-2xl" />
				<div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center">
					<Briefcase className="w-12 h-12 text-white" />
				</div>
			</div>

			<h3 className="heading-display text-2xl text-[var(--ink-100)] mb-3">
				{hasFilters ? "No matching opportunities" : "No opportunities yet"}
			</h3>
			<p className="text-[var(--ink-500)] text-center max-w-md mb-8 leading-relaxed">
				{hasFilters
					? "Try adjusting your filters or search query to find opportunities. Expired opportunities are hidden by default."
					: "Import your first batch of RFPs, EOIs, or tenders to get started."}
			</p>

			{!hasFilters && (
				<Link href="/opportunities/import">
					<Button
						className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)] font-semibold px-6"
						size="lg"
					>
						<Upload className="w-5 h-5" />
						Import Opportunities
					</Button>
				</Link>
			)}
		</div>
	);
}

// ============================================================================
// Loading Skeletons
// ============================================================================

function PageSkeleton() {
	return (
		<div className="relative">
			<div className="h-8 w-48 bg-[var(--ink-800)] rounded animate-pulse mb-6" />
			<div className="grid grid-cols-6 gap-4 mb-8">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="h-16 bg-[var(--ink-800)]/50 rounded-xl animate-pulse" />
				))}
			</div>
			<div className="space-y-3">
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="h-16 bg-[var(--ink-800)]/50 rounded-xl animate-pulse" />
				))}
			</div>
		</div>
	);
}

function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
	if (viewMode === "grid") {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="p-5 rounded-2xl bg-[var(--ink-900)]/40 border border-[var(--ink-800)]/30"
					>
						<div className="h-5 w-20 bg-[var(--ink-800)] rounded mb-3 animate-pulse" />
						<div className="h-5 w-3/4 bg-[var(--ink-800)] rounded mb-2 animate-pulse" />
						<div className="h-4 w-1/2 bg-[var(--ink-800)] rounded mb-4 animate-pulse" />
						<div className="flex gap-2 pt-3 border-t border-[var(--ink-800)]/30">
							<div className="h-3 w-16 bg-[var(--ink-800)] rounded animate-pulse" />
							<div className="h-3 w-20 bg-[var(--ink-800)] rounded animate-pulse" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="border border-[var(--ink-800)]/50 rounded-xl overflow-hidden bg-[var(--ink-900)]/20">
			{Array.from({ length: 10 }).map((_, i) => (
				<div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--ink-800)]/30">
					<div className="w-5 h-5 bg-[var(--ink-800)] rounded animate-pulse" />
					<div className="flex-1">
						<div className="h-4 w-1/3 bg-[var(--ink-800)] rounded mb-1 animate-pulse" />
						<div className="h-3 w-1/4 bg-[var(--ink-800)] rounded animate-pulse" />
					</div>
					<div className="h-4 w-24 bg-[var(--ink-800)] rounded animate-pulse" />
					<div className="h-4 w-20 bg-[var(--ink-800)] rounded animate-pulse" />
				</div>
			))}
		</div>
	);
}
