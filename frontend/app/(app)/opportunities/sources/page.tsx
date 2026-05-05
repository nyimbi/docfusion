/**
 * Scraper Sources Management Page
 *
 * Displays all TenderSourceMax scraper sources from the database.
 * Shows health metrics, run history, and allows enable/disable.
 * Supports pagination, bulk operations, and real-time progress tracking.
 *
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
	getSourcesStats,
	getScheduleTiers,
	getPaginatedScraperSources,
	type ScraperSource,
	type ScraperSchedule,
	type SourceStats,
} from "@/lib/actions/scraper-sources";
import {
	startScraperSourceRunWorkflow,
	startSelectedScraperSourceRunsWorkflow,
	transitionScraperSourceEnabledWorkflow,
} from "@/lib/actions/scraper-workflows";
import { Button } from "@/components/ui/Button";
import {
	ArrowLeft,
	Globe,
	Building2,
	Landmark,
	Users,
	Handshake,
	Check,
	Clock,
	ExternalLink,
	RefreshCw,
	Search,
	Play,
	Pause,
	AlertCircle,
	Loader2,
	Database,
	Zap,
	Activity,
	TrendingUp,
	AlertTriangle,
	CheckCircle,
	XCircle,
	BarChart3,
	Calendar,
	Timer,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Square,
	CheckSquare,
	Trash2,
	PlayCircle,
	MoreVertical,
	X,
	Eye,
} from "lucide-react";
import { SourceDetailModal } from "@/components/scrapers/SourceDetailModal";
import { ScraperRunProgress } from "@/components/scrapers/ScraperRunProgress";

// ============================================================================
// Type Icons & Labels
// ============================================================================

const TypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
	mdb: Landmark,
	un_agency: Globe,
	aggregator: Database,
	government: Building2,
	regional: Users,
	bilateral: Handshake,
	ngo: Users,
	commercial: Landmark,
};

const TypeLabels: Record<string, string> = {
	mdb: "Multilateral Bank",
	un_agency: "UN Agency",
	aggregator: "Aggregator",
	government: "Government Portal",
	regional: "Regional Org",
	bilateral: "Bilateral Donor",
	ngo: "NGO/Foundation",
	commercial: "Commercial",
};

const TierConfig: Record<number, { label: string; color: string; schedule: string }> = {
	1: { label: "Tier 1", color: "text-green-500 bg-green-500/10", schedule: "Every 6 hours" },
	2: { label: "Tier 2", color: "text-blue-500 bg-blue-500/10", schedule: "Every 12 hours" },
	3: { label: "Tier 3", color: "text-amber-500 bg-amber-500/10", schedule: "Daily" },
};

const PriorityConfig: Record<number, { label: string; color: string }> = {
	1: { label: "Critical", color: "text-red-500" },
	2: { label: "Important", color: "text-amber-500" },
	3: { label: "Standard", color: "text-muted-foreground" },
};

const HealthConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
	healthy: { label: "Healthy", icon: CheckCircle, color: "text-green-500" },
	degraded: { label: "Degraded", icon: AlertTriangle, color: "text-amber-500" },
	failing: { label: "Failing", icon: XCircle, color: "text-red-500" },
	unknown: { label: "Unknown", icon: AlertCircle, color: "text-muted-foreground" },
	disabled: { label: "Disabled", icon: Pause, color: "text-muted-foreground" },
};

// ============================================================================
// Page Component
// ============================================================================

const PAGE_SIZE = 25;

export default function ScraperSourcesPage() {
	const [sources, setSources] = React.useState<ScraperSource[]>([]);
	const [schedules, setSchedules] = React.useState<ScraperSchedule[]>([]);
	const [stats, setStats] = React.useState<SourceStats | null>(null);
	const [pagination, setPagination] = React.useState({
		page: 1,
		pageSize: PAGE_SIZE,
		total: 0,
		totalPages: 0,
		hasMore: false,
	});

	const [isLoading, setIsLoading] = React.useState(true);
	const [searchTerm, setSearchTerm] = React.useState("");
	const [filterType, setFilterType] = React.useState<string | null>(null);
	const [filterTier, setFilterTier] = React.useState<number | null>(null);
	const [filterHealth, setFilterHealth] = React.useState<string | null>(null);
	const [togglingId, setTogglingId] = React.useState<string | null>(null);

	// Selection state for bulk operations
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [isBulkOperating, setIsBulkOperating] = React.useState(false);

	// Modal state
	const [detailModalSource, setDetailModalSource] = React.useState<ScraperSource | null>(null);

	// Running jobs state
	const [runningJobs, setRunningJobs] = React.useState<Map<string, string>>(new Map()); // sourceId -> jobId
	const [showProgress, setShowProgress] = React.useState(false);

	// Load data with pagination
	const loadData = React.useCallback(async (page: number = 1) => {
		setIsLoading(true);
		try {
			const [paginatedData, schedulesData, statsData] = await Promise.all([
				getPaginatedScraperSources({
					page,
					pageSize: PAGE_SIZE,
					sourceType: filterType || undefined,
					tier: filterTier || undefined,
					healthStatus: filterHealth || undefined,
					search: searchTerm || undefined,
				}),
				getScheduleTiers(),
				getSourcesStats(),
			]);
			setSources(paginatedData.sources);
			setPagination(paginatedData.pagination);
			setSchedules(schedulesData);
			setStats(statsData);
			// Clear selections when page changes
			setSelectedIds(new Set());
		} catch (error) {
			console.error("Failed to load sources:", error);
		} finally {
			setIsLoading(false);
		}
	}, [filterType, filterTier, filterHealth, searchTerm]);

	// Initial load
	React.useEffect(() => {
		loadData(1);
	}, [loadData]);

	// Debounced search
	React.useEffect(() => {
		const timer = setTimeout(() => {
			loadData(1);
		}, 300);
		return () => clearTimeout(timer);
	}, [loadData, searchTerm]);

	// Handle toggle enabled
	const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
		setTogglingId(id);
		try {
			const result = await transitionScraperSourceEnabledWorkflow(
				id,
				!currentEnabled,
				currentEnabled
					? "Operator disabled source from the source management table."
					: "Operator enabled source from the source management table."
			);
			if (result.success && result.source) {
				setSources((prev) =>
					prev.map((s) => (s.id === id ? result.source! : s))
				);
			}
		} catch (error) {
			console.error("Failed to toggle source:", error);
		} finally {
			setTogglingId(null);
		}
	};

	// Handle run single source
	const handleRunSource = async (source: ScraperSource) => {
		try {
			const result = await startScraperSourceRunWorkflow(source.id, {
				reason: "Operator queued source from the source management table.",
			});

			if (result.success && result.jobId) {
				setRunningJobs((prev) => new Map(prev).set(source.id, result.jobId!));
				setShowProgress(true);
			}
		} catch (error) {
			console.error("Failed to run source:", error);
		}
	};

	// Selection handlers
	const toggleSelectAll = () => {
		if (selectedIds.size === sources.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(sources.map(s => s.id)));
		}
	};

	const toggleSelect = (id: string) => {
		const newSelected = new Set(selectedIds);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedIds(newSelected);
	};

	// Bulk operations
	const handleBulkOperation = async (operation: "run" | "enable" | "disable" | "delete") => {
		if (selectedIds.size === 0) return;

		if (operation === "delete" && !confirm(`Delete ${selectedIds.size} sources? This cannot be undone.`)) {
			return;
		}

		setIsBulkOperating(true);
		try {
			let data: {
				success: boolean;
				results?: Array<{ sourceId: string; success: boolean; jobId?: string; error?: string }>;
				summary?: { succeeded: number; failed: number };
			};
			const selectedSourceIds = Array.from(selectedIds);

			if (operation === "run") {
				data = await startSelectedScraperSourceRunsWorkflow(selectedSourceIds, {
					reason: "Operator queued selected sources from the source management table.",
				});
			} else if (operation === "enable" || operation === "disable") {
				const enabled = operation === "enable";
				const results = [];
				for (const sourceId of selectedSourceIds) {
					const result = await transitionScraperSourceEnabledWorkflow(
						sourceId,
						enabled,
						enabled
							? "Bulk enable requested from the source management table."
							: "Bulk disable requested from the source management table."
					);
					results.push({ sourceId, success: result.success, error: result.error });
				}
				const succeeded = results.filter((result) => result.success).length;
				data = {
					success: succeeded === results.length,
					results,
					summary: {
						succeeded,
						failed: results.length - succeeded,
					},
				};
			} else {
				const response = await fetch("/api/scrapers/batch", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						operation,
						sourceIds: selectedSourceIds,
					}),
				});
				data = await response.json();
			}

			if (data.success || (data.summary?.succeeded ?? 0) > 0) {
				// Reload data
				await loadData(pagination.page);
				setSelectedIds(new Set());

				// If running, track job IDs
				if (operation === "run" && data.results) {
					const newRunning = new Map(runningJobs);
					for (const result of data.results) {
						if (result.success && result.jobId) {
							newRunning.set(result.sourceId, result.jobId);
						}
					}
					setRunningJobs(newRunning);
					setShowProgress(true);
				}
			}
		} catch (error) {
			console.error("Bulk operation failed:", error);
		} finally {
			setIsBulkOperating(false);
		}
	};

	// Pagination handlers
	const goToPage = (page: number) => {
		if (page >= 1 && page <= pagination.totalPages) {
			loadData(page);
		}
	};

	// Client-side filter (for search within loaded page)
	const filteredSources = React.useMemo(() => {
		if (!searchTerm) return sources;

		const term = searchTerm.toLowerCase();
		return sources.filter((s) => {
			const coverage = s.coverage as string[] || [];
			return (
				s.name.toLowerCase().includes(term) ||
				s.sourceId.toLowerCase().includes(term) ||
				s.url.toLowerCase().includes(term) ||
				coverage.some((c: string) => c.toLowerCase().includes(term))
			);
		});
	}, [sources, searchTerm]);

	if (isLoading && sources.length === 0) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
					<p className="text-muted-foreground">Loading scraper sources...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link
						href="/opportunities"
						className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
					>
						<ArrowLeft className="h-5 w-5" />
					</Link>
					<div>
						<h1 className="text-2xl font-bold text-foreground">
							Scraper Sources
						</h1>
						<p className="text-sm text-muted-foreground">
							Manage TenderSourceMax data sources for automated tender discovery
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="ghost" onClick={() => loadData(pagination.page)} className="gap-2">
						<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
						Refresh
					</Button>
					{runningJobs.size > 0 && (
						<Button variant="outline" onClick={() => setShowProgress(true)} className="gap-2">
							<Activity className="h-4 w-4" />
							{runningJobs.size} Running
						</Button>
					)}
				</div>
			</div>

			{/* Stats Cards */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<StatsCard
						label="Total Sources"
						value={stats.total}
						icon={Database}
						color="text-primary"
					/>
					<StatsCard
						label="Enabled"
						value={stats.enabled}
						icon={Zap}
						color="text-green-500"
					/>
					<StatsCard
						label="Healthy"
						value={stats.healthy}
						icon={CheckCircle}
						color="text-green-500"
					/>
					<StatsCard
						label="Failing"
						value={stats.failing}
						icon={XCircle}
						color="text-red-500"
					/>
					<StatsCard
						label="Total RFPs"
						value={stats.totalOpportunities}
						icon={TrendingUp}
						color="text-blue-500"
					/>
				</div>
			)}

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-4">
				{/* Search */}
				<div className="relative flex-1 min-w-[200px] max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search sources..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
					/>
				</div>

				{/* Type Filter */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Type:</span>
					<div className="flex items-center gap-1">
						<FilterButton active={filterType === null} onClick={() => setFilterType(null)}>
							All
						</FilterButton>
						{Object.entries(TypeLabels).slice(0, 4).map(([type, label]) => (
							<FilterButton
								key={type}
								active={filterType === type}
								onClick={() => setFilterType(filterType === type ? null : type)}
							>
								{label.split(" ")[0]}
							</FilterButton>
						))}
					</div>
				</div>

				{/* Tier Filter */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Tier:</span>
					<div className="flex items-center gap-1">
						<FilterButton active={filterTier === null} onClick={() => setFilterTier(null)}>
							All
						</FilterButton>
						{[1, 2, 3].map((tier) => (
							<FilterButton
								key={tier}
								active={filterTier === tier}
								onClick={() => setFilterTier(filterTier === tier ? null : tier)}
							>
								T{tier}
							</FilterButton>
						))}
					</div>
				</div>

				{/* Health Filter */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Health:</span>
					<div className="flex items-center gap-1">
						<FilterButton active={filterHealth === null} onClick={() => setFilterHealth(null)}>
							All
						</FilterButton>
						<FilterButton active={filterHealth === "healthy"} onClick={() => setFilterHealth(filterHealth === "healthy" ? null : "healthy")}>
							Healthy
						</FilterButton>
						<FilterButton active={filterHealth === "failing"} onClick={() => setFilterHealth(filterHealth === "failing" ? null : "failing")}>
							Failing
						</FilterButton>
					</div>
				</div>
			</div>

			{/* Bulk Action Bar */}
			{selectedIds.size > 0 && (
				<div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium text-foreground">
							{selectedIds.size} selected
						</span>
						<button
							onClick={() => setSelectedIds(new Set())}
							className="text-sm text-muted-foreground hover:text-foreground"
						>
							Clear
						</button>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleBulkOperation("run")}
							disabled={isBulkOperating}
							className="gap-2"
						>
							<PlayCircle className="h-4 w-4" />
							Run Selected
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleBulkOperation("enable")}
							disabled={isBulkOperating}
							className="gap-2"
						>
							<Play className="h-4 w-4" />
							Enable
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleBulkOperation("disable")}
							disabled={isBulkOperating}
							className="gap-2"
						>
							<Pause className="h-4 w-4" />
							Disable
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleBulkOperation("delete")}
							disabled={isBulkOperating}
							className="gap-2 text-red-500 hover:text-red-600"
						>
							<Trash2 className="h-4 w-4" />
							Delete
						</Button>
					</div>
				</div>
			)}

			{/* Sources Table */}
			<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
				<table className="w-full">
					<thead className="bg-muted/50 border-b">
						<tr>
							<th className="px-4 py-3 text-left">
								<button
									onClick={toggleSelectAll}
									className="p-1 rounded hover:bg-muted transition-colors"
								>
									{selectedIds.size === sources.length && sources.length > 0 ? (
										<CheckSquare className="h-4 w-4 text-primary" />
									) : (
										<Square className="h-4 w-4 text-muted-foreground" />
									)}
								</button>
							</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Source
							</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Type
							</th>
							<th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Tier
							</th>
							<th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Health
							</th>
							<th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								RFPs
							</th>
							<th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Last Run
							</th>
							<th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{filteredSources.map((source) => (
							<SourceRow
								key={source.id}
								source={source}
								isToggling={togglingId === source.id}
								isSelected={selectedIds.has(source.id)}
								isRunning={runningJobs.has(source.id)}
								onToggle={() => handleToggleEnabled(source.id, source.enabled)}
								onSelect={() => toggleSelect(source.id)}
								onRun={() => handleRunSource(source)}
								onViewDetails={() => setDetailModalSource(source)}
							/>
						))}
					</tbody>
				</table>

				{filteredSources.length === 0 && (
					<div className="text-center py-12 text-muted-foreground">
						<AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>No sources match your filters</p>
					</div>
				)}
			</div>

			{/* Pagination */}
			{pagination.totalPages > 1 && (
				<div className="flex items-center justify-between px-2">
					<p className="text-sm text-muted-foreground">
						Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{" "}
						{Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
						{pagination.total} sources
					</p>
					<div className="flex items-center gap-1">
						<button
							onClick={() => goToPage(1)}
							disabled={pagination.page === 1}
							className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronsLeft className="h-4 w-4" />
						</button>
						<button
							onClick={() => goToPage(pagination.page - 1)}
							disabled={pagination.page === 1}
							className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>

						{/* Page numbers */}
						<div className="flex items-center gap-1 mx-2">
							{Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
								let pageNum: number;
								if (pagination.totalPages <= 5) {
									pageNum = i + 1;
								} else if (pagination.page <= 3) {
									pageNum = i + 1;
								} else if (pagination.page >= pagination.totalPages - 2) {
									pageNum = pagination.totalPages - 4 + i;
								} else {
									pageNum = pagination.page - 2 + i;
								}
								return (
									<button
										key={pageNum}
										onClick={() => goToPage(pageNum)}
										className={cn(
											"px-3 py-1 rounded-lg text-sm font-medium transition-colors",
											pagination.page === pageNum
												? "bg-primary text-primary-foreground"
												: "hover:bg-muted text-muted-foreground"
										)}
									>
										{pageNum}
									</button>
								);
							})}
						</div>

						<button
							onClick={() => goToPage(pagination.page + 1)}
							disabled={!pagination.hasMore}
							className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
						<button
							onClick={() => goToPage(pagination.totalPages)}
							disabled={!pagination.hasMore}
							className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<ChevronsRight className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}

			{/* Schedule Reference */}
			{schedules.length > 0 && (
				<div className="rounded-xl border bg-card p-6 shadow-sm">
					<h3 className="text-sm font-semibold text-foreground mb-4">
						Schedule Configuration
					</h3>
					<div className="grid md:grid-cols-3 gap-4">
						{schedules.map((schedule) => (
							<div key={schedule.id} className="p-4 rounded-lg bg-muted/50">
								<div className="flex items-center gap-2 mb-2">
									<Clock className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium text-foreground">
										{schedule.label}
									</span>
								</div>
								<p className="text-xs text-muted-foreground mb-2">
									Cron: <code className="bg-muted px-1 rounded">{schedule.cronExpression}</code>
								</p>
								<p className="text-xs text-muted-foreground">
									Max concurrent: {schedule.maxConcurrent}
								</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Source Detail Modal */}
			{detailModalSource && (
				<SourceDetailModal
					source={detailModalSource}
					onClose={() => setDetailModalSource(null)}
					onUpdate={() => loadData(pagination.page)}
				/>
			)}

			{/* Progress Panel */}
			{showProgress && runningJobs.size > 0 && (
				<ScraperRunProgress
					jobIds={Array.from(runningJobs.values())}
					onClose={() => setShowProgress(false)}
					onComplete={() => {
						loadData(pagination.page);
						setRunningJobs(new Map());
					}}
				/>
			)}
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

function StatsCard({
	label,
	value,
	icon: Icon,
	color,
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
	color: string;
}) {
	return (
		<div className="rounded-xl border bg-card p-4 shadow-sm">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-2xl font-bold tabular-nums text-foreground">
						{value.toLocaleString()}
					</p>
					<p className="text-xs text-muted-foreground">{label}</p>
				</div>
				<div className={cn("p-2 rounded-lg bg-muted", color)}>
					<Icon className="h-5 w-5" />
				</div>
			</div>
		</div>
	);
}

function FilterButton({
	children,
	active,
	onClick,
}: {
	children: React.ReactNode;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
				active
					? "bg-primary text-primary-foreground"
					: "bg-muted text-muted-foreground hover:bg-muted/80"
			)}
		>
			{children}
		</button>
	);
}

function SourceRow({
	source,
	isToggling,
	isSelected,
	isRunning,
	onToggle,
	onSelect,
	onRun,
	onViewDetails,
}: {
	source: ScraperSource;
	isToggling: boolean;
	isSelected: boolean;
	isRunning: boolean;
	onToggle: () => void;
	onSelect: () => void;
	onRun: () => void;
	onViewDetails: () => void;
}) {
	const TypeIcon = TypeIcons[source.sourceType] || Globe;
	const tierInfo = TierConfig[source.scheduleTier] || TierConfig[3];
	const healthInfo = HealthConfig[source.healthStatus] || HealthConfig.unknown;
	const HealthIcon = healthInfo.icon;

	const coverage = source.coverage as string[] || [];

	// Format last run time
	const lastRunDisplay = source.lastRunAt
		? formatRelativeTime(new Date(source.lastRunAt))
		: "Never";

	return (
		<tr className={cn(
			"hover:bg-muted/30 transition-colors",
			isSelected && "bg-primary/5"
		)}>
			{/* Checkbox */}
			<td className="px-4 py-3">
				<button
					onClick={onSelect}
					className="p-1 rounded hover:bg-muted transition-colors"
				>
					{isSelected ? (
						<CheckSquare className="h-4 w-4 text-primary" />
					) : (
						<Square className="h-4 w-4 text-muted-foreground" />
					)}
				</button>
			</td>

			{/* Source */}
			<td className="px-4 py-3">
				<div className="flex items-center gap-3">
					<div
						className={cn(
							"p-2 rounded-lg",
							source.enabled ? "bg-primary/10" : "bg-muted"
						)}
					>
						<TypeIcon
							className={cn(
								"h-4 w-4",
								source.enabled ? "text-primary" : "text-muted-foreground"
							)}
						/>
					</div>
					<div>
						<button
							onClick={onViewDetails}
							className="font-medium text-foreground hover:text-primary transition-colors text-left"
						>
							{source.name}
						</button>
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
						>
							{source.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
							<ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</div>
			</td>

			{/* Type */}
			<td className="px-4 py-3">
				<span className="text-sm text-muted-foreground">
					{TypeLabels[source.sourceType] || source.sourceType}
				</span>
			</td>

			{/* Tier */}
			<td className="px-4 py-3 text-center">
				<span
					className={cn(
						"px-2 py-0.5 text-xs font-medium rounded-full",
						tierInfo.color
					)}
					title={tierInfo.schedule}
				>
					{tierInfo.label}
				</span>
			</td>

			{/* Health */}
			<td className="px-4 py-3 text-center">
				<span
					className={cn(
						"inline-flex items-center gap-1 text-xs font-medium",
						healthInfo.color
					)}
					title={source.lastError || undefined}
				>
					<HealthIcon className="h-3.5 w-3.5" />
					{healthInfo.label}
				</span>
			</td>

			{/* RFPs */}
			<td className="px-4 py-3 text-right">
				<div className="text-sm">
					<span className="font-medium text-foreground tabular-nums">
						{(source.totalOpportunitiesScraped || 0).toLocaleString()}
					</span>
					{source.lastOpportunitiesCount !== null && source.lastOpportunitiesCount !== undefined && (
						<span className="text-xs text-muted-foreground ml-1">
							(+{source.lastOpportunitiesCount})
						</span>
					)}
				</div>
				{source.successRate !== null && source.successRate !== undefined && (
					<div className="text-xs text-muted-foreground">
						{source.successRate.toFixed(0)}% success
					</div>
				)}
			</td>

			{/* Last Run */}
			<td className="px-4 py-3 text-right">
				<span className="text-sm text-muted-foreground">{lastRunDisplay}</span>
			</td>

			{/* Actions */}
			<td className="px-4 py-3 text-right">
				<div className="flex items-center justify-end gap-1">
					<button
						onClick={onViewDetails}
						className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
						title="View details"
					>
						<Eye className="h-4 w-4" />
					</button>
					<button
						onClick={onToggle}
						disabled={isToggling}
						className={cn(
							"p-1.5 rounded-lg transition-colors",
							source.enabled
								? "hover:bg-amber-500/10 text-amber-500"
								: "hover:bg-green-500/10 text-green-500"
						)}
						title={source.enabled ? "Disable scraper" : "Enable scraper"}
					>
						{isToggling ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : source.enabled ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="h-4 w-4" />
						)}
					</button>
					<button
						onClick={onRun}
						disabled={!source.enabled || isRunning}
						className={cn(
							"p-1.5 rounded-lg transition-colors",
							isRunning
								? "text-primary"
								: "hover:bg-primary/10 text-primary"
						)}
						title={isRunning ? "Running..." : "Run scraper now"}
					>
						{isRunning ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
					</button>
				</div>
			</td>
		</tr>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString();
}
