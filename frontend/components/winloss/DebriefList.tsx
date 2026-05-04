"use client";

/**
 * Debrief List Component
 *
 * Displays a list of debriefs with filtering, sorting, and pagination.
 * Supports outcome filtering, date range selection, and value filtering.
 */

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Trophy,
	XCircle,
	MinusCircle,
	Ban,
	Search,
	Filter,
	SlidersHorizontal,
	Calendar,
	DollarSign,
	ChevronRight,
	MoreHorizontal,
	Eye,
	Edit,
	Trash2,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	Loader2,
} from "lucide-react";
import { listDebriefs } from "@/lib/actions/winloss";
import type { Debrief, DebriefOutcome } from "@/lib/types/winloss";

interface DebriefListProps {
	initialDebriefs?: Array<Debrief & { opportunityTitle?: string }>;
	onSelect?: (debrief: Debrief) => void;
	onEdit?: (debrief: Debrief) => void;
	onDelete?: (debrief: Debrief) => void;
	className?: string;
}

type SortField = "createdAt" | "outcome" | "contractValue" | "overallRanking";
type SortOrder = "asc" | "desc";

const OUTCOME_CONFIG: Record<
	DebriefOutcome,
	{ label: string; icon: React.ReactNode; className: string }
> = {
	win: {
		label: "Won",
		icon: <Trophy className="h-4 w-4" />,
		className: "bg-green-100 text-green-800 border-green-200",
	},
	loss: {
		label: "Lost",
		icon: <XCircle className="h-4 w-4" />,
		className: "bg-red-100 text-red-800 border-red-200",
	},
	no_award: {
		label: "No Award",
		icon: <MinusCircle className="h-4 w-4" />,
		className: "bg-yellow-100 text-yellow-800 border-yellow-200",
	},
	cancelled: {
		label: "Cancelled",
		icon: <Ban className="h-4 w-4" />,
		className: "bg-gray-100 text-gray-800 border-gray-200",
	},
};

export function DebriefList({
	initialDebriefs,
	onSelect,
	onEdit,
	onDelete,
	className,
}: DebriefListProps) {
	const [isPending, startTransition] = useTransition();
	const [debriefs, setDebriefs] = useState<Array<Debrief & { opportunityTitle?: string }>>(
		initialDebriefs ?? []
	);
	const [isLoading, setIsLoading] = useState(!initialDebriefs);

	// Filters
	const [searchQuery, setSearchQuery] = useState("");
	const [outcomeFilter, setOutcomeFilter] = useState<DebriefOutcome | "all">("all");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [minValue, setMinValue] = useState("");
	const [maxValue, setMaxValue] = useState("");
	const [showFilters, setShowFilters] = useState(false);

	// Sorting
	const [sortField, setSortField] = useState<SortField>("createdAt");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

	// Fetch debriefs
	const fetchDebriefs = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const filters: Record<string, unknown> = {};

				if (outcomeFilter !== "all") {
					filters.outcome = outcomeFilter;
				}
				if (dateFrom) {
					filters.dateFrom = new Date(dateFrom);
				}
				if (dateTo) {
					filters.dateTo = new Date(dateTo);
				}
				if (minValue) {
					filters.minValue = parseFloat(minValue);
				}
				if (maxValue) {
					filters.maxValue = parseFloat(maxValue);
				}

				const result = await listDebriefs(filters as Parameters<typeof listDebriefs>[0]);

				if (result.success) {
					setDebriefs(result.data as Array<Debrief & { opportunityTitle?: string }>);
				}
			} catch (error) {
				console.error("Failed to fetch debriefs:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, [outcomeFilter, dateFrom, dateTo, minValue, maxValue]);

	// Load initial data
	useEffect(() => {
		if (!initialDebriefs) {
			fetchDebriefs();
		}
	}, [initialDebriefs, fetchDebriefs]);

	// Apply filters when they change
	useEffect(() => {
		if (initialDebriefs) {
			// Filter locally if we have initial data
			return;
		}
		fetchDebriefs();
	}, [outcomeFilter, dateFrom, dateTo, minValue, maxValue, fetchDebriefs, initialDebriefs]);

	// Filter and sort debriefs
	const filteredDebriefs = useMemo(() => {
		let result = [...debriefs];

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(d) =>
					d.opportunityTitle?.toLowerCase().includes(query) ||
					d.winnerName?.toLowerCase().includes(query)
			);
		}

		// Local outcome filter (for initial data)
		if (initialDebriefs && outcomeFilter !== "all") {
			result = result.filter((d) => d.outcome === outcomeFilter);
		}

		// Sort
		result.sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "createdAt":
					comparison =
						new Date(a.createdAt ?? 0).getTime() -
						new Date(b.createdAt ?? 0).getTime();
					break;
				case "outcome":
					comparison = (a.outcome ?? "").localeCompare(b.outcome ?? "");
					break;
				case "contractValue":
					comparison = (a.contractValue ?? 0) - (b.contractValue ?? 0);
					break;
				case "overallRanking":
					comparison = (a.overallRanking ?? 999) - (b.overallRanking ?? 999);
					break;
			}

			return sortOrder === "desc" ? -comparison : comparison;
		});

		return result;
	}, [debriefs, searchQuery, outcomeFilter, sortField, sortOrder, initialDebriefs]);

	// Format date
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Format currency
	const formatCurrency = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "-";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 0,
		}).format(value);
	};

	// Toggle sort
	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortOrder("desc");
		}
	};

	// Get sort icon
	const getSortIcon = (field: SortField) => {
		if (sortField !== field) {
			return <ArrowUpDown className="h-4 w-4" />;
		}
		return sortOrder === "asc" ? (
			<ArrowUp className="h-4 w-4" />
		) : (
			<ArrowDown className="h-4 w-4" />
		);
	};

	// Stats
	const stats = useMemo(() => {
		const wins = debriefs.filter((d) => d.outcome === "win").length;
		const losses = debriefs.filter((d) => d.outcome === "loss").length;
		const total = debriefs.length;
		const winRate = total > 0 ? Math.round((wins / (wins + losses || 1)) * 100) : 0;

		return { wins, losses, total, winRate };
	}, [debriefs]);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header with stats */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<h2 className="text-lg font-semibold">Debriefs</h2>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Badge variant="outline" className="bg-green-50">
							{stats.wins} Wins
						</Badge>
						<Badge variant="outline" className="bg-red-50">
							{stats.losses} Losses
						</Badge>
						<span>|</span>
						<span>{stats.winRate}% Win Rate</span>
					</div>
				</div>
				{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search debriefs..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<Select
					value={outcomeFilter}
					onValueChange={(value) => setOutcomeFilter(value as DebriefOutcome | "all")}
				>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="All Outcomes" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Outcomes</SelectItem>
						<SelectItem value="win">Won</SelectItem>
						<SelectItem value="loss">Lost</SelectItem>
						<SelectItem value="no_award">No Award</SelectItem>
						<SelectItem value="cancelled">Cancelled</SelectItem>
					</SelectContent>
				</Select>

				<Button
					variant="outline"
					onClick={() => setShowFilters(!showFilters)}
					className={cn(showFilters && "bg-muted")}
				>
					<SlidersHorizontal className="h-4 w-4 mr-2" />
					Filters
				</Button>
			</div>

			{/* Advanced Filters */}
			{showFilters && (
				<Card>
					<CardContent className="pt-4">
						<div className="grid grid-cols-4 gap-4">
							<div className="space-y-2">
								<span className="text-sm font-medium">From Date</span>
								<Input
									type="date"
									value={dateFrom}
									onChange={(e) => setDateFrom(e.target.value)}
								 aria-label="From Date"/>
							</div>
							<div className="space-y-2">
								<span className="text-sm font-medium">To Date</span>
								<Input
									type="date"
									value={dateTo}
									onChange={(e) => setDateTo(e.target.value)}
								 aria-label="To Date"/>
							</div>
							<div className="space-y-2">
								<span className="text-sm font-medium">Min Value</span>
								<Input
									type="number"
									placeholder="$0"
									value={minValue}
									onChange={(e) => setMinValue(e.target.value)}
								 aria-label="Min Value"/>
							</div>
							<div className="space-y-2">
								<span className="text-sm font-medium">Max Value</span>
								<Input
									type="number"
									placeholder="$10,000,000"
									value={maxValue}
									onChange={(e) => setMaxValue(e.target.value)}
								 aria-label="Max Value"/>
							</div>
						</div>
						<div className="flex justify-end mt-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setDateFrom("");
									setDateTo("");
									setMinValue("");
									setMaxValue("");
								}}
							>
								Clear Filters
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* List */}
			<Card>
				<div className="divide-y">
					{/* Header */}
					<div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 text-sm font-medium">
						<div className="col-span-4">Opportunity</div>
						<div className="col-span-2">
							<button
								type="button"
								onClick={() => toggleSort("outcome")}
								className="flex items-center gap-1 hover:text-foreground"
							>
								Outcome
								{getSortIcon("outcome")}
							</button>
						</div>
						<div className="col-span-2">
							<button
								type="button"
								onClick={() => toggleSort("overallRanking")}
								className="flex items-center gap-1 hover:text-foreground"
							>
								Ranking
								{getSortIcon("overallRanking")}
							</button>
						</div>
						<div className="col-span-2">
							<button
								type="button"
								onClick={() => toggleSort("contractValue")}
								className="flex items-center gap-1 hover:text-foreground"
							>
								Value
								{getSortIcon("contractValue")}
							</button>
						</div>
						<div className="col-span-2">
							<button
								type="button"
								onClick={() => toggleSort("createdAt")}
								className="flex items-center gap-1 hover:text-foreground"
							>
								Date
								{getSortIcon("createdAt")}
							</button>
						</div>
					</div>

					{/* Loading state */}
					{isLoading && (
						<>
							{[1, 2, 3].map((i) => (
								<div key={i} className="grid grid-cols-12 gap-4 p-4 items-center">
									<div className="col-span-4">
										<Skeleton className="h-5 w-3/4" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-6 w-20" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-5 w-12" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-5 w-24" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-5 w-20" />
									</div>
								</div>
							))}
						</>
					)}

					{/* Empty state */}
					{!isLoading && filteredDebriefs.length === 0 && (
						<div className="p-8 text-center text-muted-foreground">
							<Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No debriefs found</p>
							<p className="text-sm mt-1">
								{searchQuery || outcomeFilter !== "all"
									? "Try adjusting your filters"
									: "Create your first debrief to get started"}
							</p>
						</div>
					)}

					{/* Rows */}
					{!isLoading &&
						filteredDebriefs.map((debrief) => {
							const outcome = debrief.outcome as DebriefOutcome;
							const config = OUTCOME_CONFIG[outcome];

							return (
								<div
									key={debrief.id}
									className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors group"
								>
									<div className="col-span-4">
										<Link
											href={`/winloss/${debrief.id}`}
											className="font-medium hover:underline"
										>
											{debrief.opportunityTitle ?? "Untitled"}
										</Link>
										{debrief.winnerName && outcome !== "win" && (
											<p className="text-sm text-muted-foreground mt-0.5">
												Winner: {debrief.winnerName}
											</p>
										)}
									</div>
									<div className="col-span-2">
										<Badge
											variant="secondary"
											className={cn("border flex items-center gap-1 w-fit", config.className)}
										>
											{config.icon}
											{config.label}
										</Badge>
									</div>
									<div className="col-span-2">
										{debrief.overallRanking ? (
											<span>
												#{debrief.overallRanking}
												{debrief.totalBidders && (
													<span className="text-muted-foreground">
														/{debrief.totalBidders}
													</span>
												)}
											</span>
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</div>
									<div className="col-span-2">
										{formatCurrency(debrief.contractValue)}
									</div>
									<div className="col-span-2 flex items-center justify-between">
										<span className="text-muted-foreground">
											{formatDate(debrief.createdAt)}
										</span>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="opacity-0 group-hover:opacity-100"
												>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Actions</DropdownMenuLabel>
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={() => onSelect?.(debrief)}>
													<Eye className="h-4 w-4 mr-2" />
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => onEdit?.(debrief)}>
													<Edit className="h-4 w-4 mr-2" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => onDelete?.(debrief)}
													className="text-destructive"
												>
													<Trash2 className="h-4 w-4 mr-2" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							);
						})}
				</div>
			</Card>

			{/* Results count */}
			{!isLoading && filteredDebriefs.length > 0 && (
				<p className="text-sm text-muted-foreground text-center">
					Showing {filteredDebriefs.length} of {debriefs.length} debriefs
				</p>
			)}
		</div>
	);
}

export default DebriefList;
