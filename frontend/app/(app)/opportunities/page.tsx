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
import { cn } from "@/lib/utils";
import {
	useQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	getOpportunityStats,
	getFilterOptions,
	bulkUpdateStatus,
	bulkUpdatePriority,
	markAsReviewed,
} from "@/lib/actions/opportunities";
import { getOpportunities } from "@/lib/api/opportunities";
import {
	transitionOpportunityTriage,
	type OpportunityTriageAction,
} from "@/lib/actions/opportunity-lifecycle";
import { getVoteSummariesBulk } from "@/lib/actions/opportunity-votes";
import type { VoteSummary } from "@/lib/types/opportunity";
import type {
	OpportunityListItem,
	OpportunityFilters as OpportunityFiltersType,
	OpportunitySort,
	OpportunityStats,
	DecisionStatus,
	PriorityRank,
	PaginatedResponse,
} from "@/lib/types/opportunity";
import { Button } from "@/components/ui/Button";
import {
	Search,
	Upload,
	RefreshCw,
	Database,
	Activity,
	Briefcase,
	MapPin,
	CheckCircle,
	BookmarkCheck,
	ClipboardCheck,
	MoreHorizontal,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";

import { StatsBanner } from "@/components/opportunities/OpportunityStats";
import { FilterDropdown, ViewToggle, SortDropdown } from "@/components/opportunities/OpportunityFilters";
import { BulkActionBar } from "@/components/opportunities/BulkActionBar";
import { SavedSearches } from "@/components/opportunities/SavedSearches";
import { ShortlistPanel } from "@/components/opportunities/ShortlistPanel";
import { OpportunityCompare } from "@/components/opportunities/OpportunityCompare";
import { OpportunityTable } from "@/components/opportunities/OpportunityTable";
import { OpportunityGrid } from "@/components/opportunities/OpportunityGrid";
import { DiscoveryRunDialog } from "@/components/opportunities/DiscoveryRunDialog";
import {
	Pagination,
	EmptyState,
	LoadingSkeleton,
	PageSkeleton,
} from "@/components/opportunities/OpportunityListShared";

// ============================================================================
// Query Keys
// ============================================================================

const opportunitiesKeys = {
	all: ["opportunities"] as const,
	lists: () => [...opportunitiesKeys.all, "list"] as const,
	list: (filters: OpportunityFiltersType, sort: OpportunitySort, page: number) =>
		[...opportunitiesKeys.lists(), { filters, sort, page }] as const,
	stats: (filters?: OpportunityFiltersType) =>
		[...opportunitiesKeys.all, "stats", filters] as const,
	filterOptions: () => [...opportunitiesKeys.all, "filterOptions"] as const,
	voteSummaries: (opportunityIds: string[]) =>
		[...opportunitiesKeys.all, "voteSummaries", opportunityIds] as const,
};

// ============================================================================
// Constants
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
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const userId = session?.user?.id;

	// View & selection state
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

	// Filter state
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");
	const [filters, setFilters] = React.useState<OpportunityFiltersType>({});
	const [sort, setSort] = React.useState<OpportunitySort>({
		field: "deadline",
		direction: "asc",
	});
	const [page, setPage] = React.useState(1);
	const pageSize = 25;
	type ExpiryMode = "active" | "all" | "expired";
	const [expiryMode, setExpiryMode] = React.useState<ExpiryMode>("active");
	const [voteStatusFilter, setVoteStatusFilter] = React.useState<string[]>([]);
	const [showShortlistPanel, setShowShortlistPanel] = React.useState(false);
	const [compareIds, setCompareIds] = React.useState<string[]>([]);
	const [showCompare, setShowCompare] = React.useState(false);
	const [showDiscoveryRun, setShowDiscoveryRun] = React.useState(false);

	// Debounce search input (300ms)
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Build query filters
	const queryFilters: OpportunityFiltersType = React.useMemo(() => {
		const result: OpportunityFiltersType = {
			...filters,
			search: debouncedSearch || undefined,
		};
		if (expiryMode === "active") result.isExpired = false;
		else if (expiryMode === "expired") result.isExpired = true;
		return result;
	}, [filters, debouncedSearch, expiryMode]);

	// ========================================================================
	// Queries
	// ========================================================================

	const {
		data: opportunitiesData,
		isLoading: isOpportunitiesLoading,
		isFetching: isOpportunitiesFetching,
		} = useQuery<PaginatedResponse<OpportunityListItem>, Error>({
			queryKey: opportunitiesKeys.list(queryFilters, sort, page),
			queryFn: () => getOpportunities({ ...queryFilters, sort, page, pageSize }),
			staleTime: OPPORTUNITIES_STALE_TIME,
			gcTime: OPPORTUNITIES_GC_TIME,
		});

	const { data: stats } = useQuery<OpportunityStats, Error>({
		queryKey: opportunitiesKeys.stats(queryFilters),
		queryFn: () => getOpportunityStats(queryFilters),
		staleTime: OPPORTUNITIES_STALE_TIME,
	});

	const { data: filterOptions = { categories: [], sectors: [], countries: [], organizations: [], sourceFiles: [] } } = useQuery<{
		categories: string[];
		sectors: string[];
		countries: string[];
		organizations: string[];
		sourceFiles: string[];
	}, Error>({
		queryKey: opportunitiesKeys.filterOptions(),
		queryFn: getFilterOptions,
		staleTime: 30 * 60 * 1000,
	});

	const opportunityIds = React.useMemo(() => {
		return opportunitiesData?.data.map((o) => o.id) ?? [];
	}, [opportunitiesData]);

	const { data: voteSummaries = new Map<string, VoteSummary>() } = useQuery<
		Map<string, VoteSummary>,
		Error
	>({
		queryKey: opportunitiesKeys.voteSummaries(opportunityIds),
		queryFn: () => getVoteSummariesBulk(opportunityIds),
		enabled: opportunityIds.length > 0,
		staleTime: OPPORTUNITIES_STALE_TIME,
	});

	// ========================================================================
	// Mutations
	// ========================================================================

	const updateStatusMutation = useMutation<
		number,
		Error,
		{ ids: string[]; status: DecisionStatus },
		{ previousData: PaginatedResponse<OpportunityListItem> | undefined }
	>({
		mutationFn: ({ ids, status }) => bulkUpdateStatus(ids, status),
		onMutate: async ({ ids, status }) => {
			await queryClient.cancelQueries({ queryKey: opportunitiesKeys.lists() });
			const previousData = queryClient.getQueryData<PaginatedResponse<OpportunityListItem>>(
				opportunitiesKeys.list(queryFilters, sort, page)
			);
			if (previousData) {
				queryClient.setQueryData<PaginatedResponse<OpportunityListItem>>(
					opportunitiesKeys.list(queryFilters, sort, page),
					{
						...previousData,
						data: previousData.data.map((opp) =>
							ids.includes(opp.id) ? { ...opp, decisionStatus: status } : opp
						),
					}
				);
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

	const updatePriorityMutation = useMutation<
		number,
		Error,
		{ ids: string[]; priority: PriorityRank },
		{ previousData: PaginatedResponse<OpportunityListItem> | undefined }
	>({
		mutationFn: ({ ids, priority }) => bulkUpdatePriority(ids, priority),
		onMutate: async ({ ids, priority }) => {
			await queryClient.cancelQueries({ queryKey: opportunitiesKeys.lists() });
			const previousData = queryClient.getQueryData<PaginatedResponse<OpportunityListItem>>(
				opportunitiesKeys.list(queryFilters, sort, page)
			);
			if (previousData) {
				queryClient.setQueryData<PaginatedResponse<OpportunityListItem>>(
					opportunitiesKeys.list(queryFilters, sort, page),
					{
						...previousData,
						data: previousData.data.map((opp) =>
							ids.includes(opp.id) ? { ...opp, priorityRank: priority } : opp
						),
					}
				);
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

	// ========================================================================
	// Derived state
	// ========================================================================

	const rawOpportunities = React.useMemo(
		() => opportunitiesData?.data ?? [],
		[opportunitiesData?.data]
	);
	const totalPages = opportunitiesData?.totalPages ?? 1;
	const isLoading = isOpportunitiesLoading;

	// Client-side vote status filter (majority-based logic)
	const opportunities = React.useMemo(() => {
		if (voteStatusFilter.length === 0) return rawOpportunities;

		return rawOpportunities.filter((opp) => {
			const voteSummary = voteSummaries.get(opp.id);
			let status: string;
			if (!voteSummary || voteSummary.totalVotes === 0) {
				status = "no_votes";
			} else if (voteSummary.goCount > voteSummary.noGoCount) {
				status = "go";
			} else if (voteSummary.noGoCount > voteSummary.goCount) {
				status = "no_go";
			} else {
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
						getOpportunities({ ...queryFilters, sort, page: nextPage, pageSize }),
					staleTime: OPPORTUNITIES_STALE_TIME,
				});
		}
	}, [page, totalPages, queryFilters, sort, queryClient]);

	// ========================================================================
	// Handlers
	// ========================================================================

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

	const handleFilterChange = (key: keyof OpportunityFiltersType, value: unknown) => {
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
					await runBulkTriage(ids, "mark_interested", "Marked interested from the opportunities bulk action bar.");
					break;
				case "mark-pursuing":
					await runBulkTriage(ids, "qualify", "Qualified for pursuit from the opportunities bulk action bar.");
					break;
				case "mark-declined":
					await runBulkTriage(ids, "reject", "Declined from the opportunities bulk action bar.");
					break;
				case "add-shortlist":
					await runBulkTriage(ids, "shortlist", "Added to shortlist from the opportunities bulk action bar.");
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

	const runBulkTriage = async (
		ids: string[],
		triageAction: OpportunityTriageAction,
		reason: string
	) => {
		await Promise.all(ids.map(async (opportunityId) => {
			const result = await transitionOpportunityTriage({
				opportunityId,
				action: triageAction,
				reason,
			});
			if (!result.success) {
				throw new Error(result.error ?? `Failed to ${triageAction} opportunity ${opportunityId}`);
			}
		}));
		await queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
	};

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
	};

	const handleDiscoveryCompleted = () => {
		queryClient.invalidateQueries({ queryKey: opportunitiesKeys.all });
	};

	// ========================================================================
	// Render
	// ========================================================================

	return (
		<div className="h-full overflow-y-auto p-6 relative">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-foreground mb-1">
						Opportunities
					</h1>
					<p className="text-sm text-muted-foreground">
						Track and manage RFPs, tenders, and procurement opportunities
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleRefresh}
						title="Refresh"
						className="text-muted-foreground hover:text-foreground"
					>
						<RefreshCw className={cn("h-4 w-4", isOpportunitiesFetching && "animate-spin")} />
					</Button>
					<Button variant="outline" onClick={() => setShowDiscoveryRun(true)}>
						<Search className="h-4 w-4" />
						<span className="hidden sm:inline ml-2">Discover</span>
					</Button>
					<Button variant="outline" onClick={() => setShowShortlistPanel(true)}>
						<BookmarkCheck className="h-4 w-4 text-amber-500" />
						<span className="hidden sm:inline ml-2">Shortlist</span>
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" title="More actions">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild>
								<Link href="/opportunities/sources">
									<Database className="mr-2 h-4 w-4" />
									Sources
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/opportunities/live-handoff">
									<ClipboardCheck className="mr-2 h-4 w-4" />
									Handoff
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href="/opportunities/import">
									<Upload className="mr-2 h-4 w-4" />
									Import
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
							{ value: "shortlisted", label: "Shortlisted" },
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

					{/* Expiry filter — 3-state segmented control */}
					<div className="flex items-center rounded-lg border border-input overflow-hidden text-sm flex-shrink-0">
						{(["active", "all", "expired"] as ExpiryMode[]).map((mode) => (
							<button
								key={mode}
								onClick={() => { setExpiryMode(mode); setPage(1); }}
								className={cn(
									"px-3 py-2 font-medium transition-colors capitalize",
									expiryMode === mode
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground hover:bg-muted"
								)}
							>
								{mode}
							</button>
						))}
					</div>

					{userId && (
						<SavedSearches
							userId={userId}
							currentFilters={queryFilters}
							currentSort={sort}
							onLoadSearch={(loadedFilters, loadedSort) => {
								setFilters(loadedFilters);
								if (loadedSort) setSort(loadedSort);
								setPage(1);
							}}
						/>
					)}

					<div className="flex-1" />

					<ViewToggle mode={viewMode} onChange={setViewMode} />
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
							Object.keys(filters).length > 0 || !!searchQuery || expiryMode !== "all"
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

			{/* Shortlist Panel */}
			<ShortlistPanel
				isOpen={showShortlistPanel}
				onClose={() => setShowShortlistPanel(false)}
				onCompare={(ids) => {
					setCompareIds(ids);
					setShowCompare(true);
					setShowShortlistPanel(false);
				}}
			/>

			{/* Compare Modal */}
			<OpportunityCompare
				opportunityIds={compareIds}
				isOpen={showCompare}
				onClose={() => setShowCompare(false)}
			/>

			<DiscoveryRunDialog
				open={showDiscoveryRun}
				onClose={() => setShowDiscoveryRun(false)}
				onCompleted={handleDiscoveryCompleted}
			/>
		</div>
	);
}
