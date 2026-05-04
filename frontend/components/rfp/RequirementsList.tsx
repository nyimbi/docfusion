"use client";

/**
 * Requirements List Component
 *
 * Displays a filterable, sortable list of RFP requirements with
 * bulk actions and export capabilities.
 */

import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Search,
	Filter,
	SortAsc,
	SortDesc,
	Download,
	Upload,
	CheckSquare,
	Square,
	MoreHorizontal,
	ListFilter,
	LayoutGrid,
	List,
	RefreshCw,
} from "lucide-react";
import { RequirementCard, type Requirement } from "./RequirementCard";
import type {
	RequirementCategory,
	RequirementPriority,
	ComplianceStatus,
	RiskLevel,
} from "@/lib/db/schema-rfp";

// ============================================================================
// Types
// ============================================================================

interface RequirementsListProps {
	/** RFP Document ID */
	rfpDocumentId: string;
	/** Initial requirements (if already loaded) */
	initialRequirements?: Requirement[];
	/** Callback when requirement is edited */
	onEdit?: (id: string) => void;
	/** Callback when status changes */
	onStatusChange?: (id: string, status: ComplianceStatus) => void;
	/** Callback for bulk status change */
	onBulkStatusChange?: (ids: string[], status: ComplianceStatus) => void;
	/** Callback for requirement assignment */
	onAssign?: (id: string) => void;
	/** Callback for bulk assignment */
	onBulkAssign?: (ids: string[]) => void;
	/** Callback to view response document */
	onViewResponse?: (id: string) => void;
	/** Callback to add clarification */
	onAddClarification?: (id: string) => void;
	/** Callback for export */
	onExport?: (format: "csv" | "excel" | "json") => void;
	/** Custom class name */
	className?: string;
}

type SortField = "requirementNumber" | "category" | "priority" | "complianceStatus" | "dueDate" | "riskLevel";
type SortOrder = "asc" | "desc";
type ViewMode = "list" | "compact" | "grid";

interface FilterState {
	search: string;
	categories: RequirementCategory[];
	priorities: RequirementPriority[];
	statuses: ComplianceStatus[];
	riskLevels: RiskLevel[];
	assignedTo: string | null;
	hasResponse: boolean | null;
	isImplicit: boolean | null;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES: RequirementCategory[] = [
	"technical",
	"management",
	"past_performance",
	"cost",
	"administrative",
	"personnel",
	"security",
	"compliance",
	"other",
];

const PRIORITIES: RequirementPriority[] = ["mandatory", "preferred", "optional"];

const STATUSES: ComplianceStatus[] = [
	"not_addressed",
	"in_progress",
	"addressed",
	"compliant",
	"partial",
	"non_compliant",
	"not_applicable",
	"pending",
];

const RISK_LEVELS: RiskLevel[] = ["critical", "high", "medium", "low"];

// ============================================================================
// Component
// ============================================================================

export function RequirementsList({
	rfpDocumentId,
	initialRequirements = [],
	onEdit,
	onStatusChange,
	onBulkStatusChange,
	onAssign,
	onBulkAssign,
	onViewResponse,
	onAddClarification,
	onExport,
	className,
}: RequirementsListProps) {
	const [requirements, setRequirements] = useState<Requirement[]>(initialRequirements);
	const [isLoading, setIsLoading] = useState(!initialRequirements.length);
	const [error, setError] = useState<string | null>(null);

	// Selection state
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// View state
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [sortField, setSortField] = useState<SortField>("requirementNumber");
	const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

	// Filter state
	const [filters, setFilters] = useState<FilterState>({
		search: "",
		categories: [],
		priorities: [],
		statuses: [],
		riskLevels: [],
		assignedTo: null,
		hasResponse: null,
		isImplicit: null,
	});
	const [showFilters, setShowFilters] = useState(false);

	// Fetch requirements
	const fetchRequirements = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/v1/rfp/${rfpDocumentId}/requirements`);
			if (!response.ok) {
				throw new Error("Failed to fetch requirements");
			}
			const data = await response.json();
			setRequirements(data.requirements);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load requirements");
		} finally {
			setIsLoading(false);
		}
	}, [rfpDocumentId]);

	// Load requirements on mount if not provided
	React.useEffect(() => {
		if (!initialRequirements.length) {
			fetchRequirements();
		}
	}, [initialRequirements.length, fetchRequirements]);

	// Filter requirements
	const filteredRequirements = useMemo(() => {
		return requirements.filter((req) => {
			// Search filter
			if (filters.search) {
				const searchLower = filters.search.toLowerCase();
				const matchesSearch =
					req.requirementNumber.toLowerCase().includes(searchLower) ||
					req.requirementText.toLowerCase().includes(searchLower) ||
					req.title?.toLowerCase().includes(searchLower) ||
					req.sourceSection?.toLowerCase().includes(searchLower);
				if (!matchesSearch) return false;
			}

			// Category filter
			if (filters.categories.length && !filters.categories.includes(req.category)) {
				return false;
			}

			// Priority filter
			if (filters.priorities.length && !filters.priorities.includes(req.priority)) {
				return false;
			}

			// Status filter
			if (filters.statuses.length && !filters.statuses.includes(req.complianceStatus)) {
				return false;
			}

			// Risk level filter
			if (filters.riskLevels.length && !filters.riskLevels.includes(req.riskLevel)) {
				return false;
			}

			// Assigned to filter
			if (filters.assignedTo !== null) {
				if (filters.assignedTo === "" && req.assignedTo) return false;
				if (filters.assignedTo !== "" && req.assignedTo !== filters.assignedTo) return false;
			}

			// Has response filter
			if (filters.hasResponse !== null) {
				if (filters.hasResponse && !req.responseDocumentId) return false;
				if (!filters.hasResponse && req.responseDocumentId) return false;
			}

			// Implicit filter
			if (filters.isImplicit !== null && req.isImplicit !== filters.isImplicit) {
				return false;
			}

			return true;
		});
	}, [requirements, filters]);

	// Sort requirements
	const sortedRequirements = useMemo(() => {
		return [...filteredRequirements].sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "requirementNumber":
					comparison = a.requirementNumber.localeCompare(b.requirementNumber, undefined, {
						numeric: true,
					});
					break;
				case "category":
					comparison = a.category.localeCompare(b.category);
					break;
				case "priority": {
					const priorityOrder = { mandatory: 0, preferred: 1, optional: 2 };
					comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
					break;
				}
				case "complianceStatus":
					comparison = a.complianceStatus.localeCompare(b.complianceStatus);
					break;
				case "dueDate": {
					const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
					const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
					comparison = dateA - dateB;
					break;
				}
				case "riskLevel": {
					const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
					comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
					break;
				}
			}

			return sortOrder === "asc" ? comparison : -comparison;
		});
	}, [filteredRequirements, sortField, sortOrder]);

	// Selection handlers
	const handleSelectAll = useCallback(() => {
		if (selectedIds.size === sortedRequirements.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(sortedRequirements.map((r) => r.id)));
		}
	}, [sortedRequirements, selectedIds.size]);

	const handleSelect = useCallback((id: string, selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}, []);

	const handleExpand = useCallback((id: string) => {
		setExpandedId((prev) => (prev === id ? null : id));
	}, []);

	// Clear filters
	const clearFilters = useCallback(() => {
		setFilters({
			search: "",
			categories: [],
			priorities: [],
			statuses: [],
			riskLevels: [],
			assignedTo: null,
			hasResponse: null,
			isImplicit: null,
		});
	}, []);

	// Count active filters
	const activeFilterCount = useMemo(() => {
		let count = 0;
		if (filters.search) count++;
		if (filters.categories.length) count++;
		if (filters.priorities.length) count++;
		if (filters.statuses.length) count++;
		if (filters.riskLevels.length) count++;
		if (filters.assignedTo !== null) count++;
		if (filters.hasResponse !== null) count++;
		if (filters.isImplicit !== null) count++;
		return count;
	}, [filters]);

	// Calculate statistics
	const stats = useMemo(() => {
		const total = requirements.length;
		const mandatory = requirements.filter((r) => r.priority === "mandatory").length;
		const compliant = requirements.filter((r) => r.complianceStatus === "compliant").length;
		const partial = requirements.filter((r) => r.complianceStatus === "partial").length;
		const nonCompliant = requirements.filter((r) => r.complianceStatus === "non_compliant").length;
		const notAddressed = requirements.filter((r) => r.complianceStatus === "not_addressed").length;

		return { total, mandatory, compliant, partial, nonCompliant, notAddressed };
	}, [requirements]);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Requirements ({stats.total})</CardTitle>
						<CardDescription className="flex items-center gap-4 mt-1">
							<span>{stats.mandatory} mandatory</span>
							<span className="text-green-600">{stats.compliant} compliant</span>
							<span className="text-yellow-600">{stats.partial} partial</span>
							<span className="text-red-600">{stats.nonCompliant} non-compliant</span>
							<span className="text-gray-500">{stats.notAddressed} not addressed</span>
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={fetchRequirements}
							disabled={isLoading}
						>
							<RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
							Refresh
						</Button>
						{onExport && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										<Download className="h-4 w-4 mr-2" />
										Export
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem onClick={() => onExport("csv")}>
										Export as CSV
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onExport("excel")}>
										Export as Excel
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onExport("json")}>
										Export as JSON
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Toolbar */}
				<div className="flex items-center gap-2 flex-wrap">
					{/* Search */}
					<div className="relative flex-1 min-w-[200px] max-w-md">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={filters.search}
							onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
							placeholder="Search requirements..."
							className="pl-9"
						/>
					</div>

					{/* Filter toggle */}
					<Button
						variant={showFilters ? "secondary" : "outline"}
						size="sm"
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className="h-4 w-4 mr-2" />
						Filters
						{activeFilterCount > 0 && (
							<Badge variant="secondary" className="ml-2">
								{activeFilterCount}
							</Badge>
						)}
					</Button>

					{/* Sort */}
					<Select
						value={sortField}
						onValueChange={(value) => setSortField(value as SortField)}
					>
						<SelectTrigger className="w-[150px]">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="requirementNumber">Requirement #</SelectItem>
							<SelectItem value="category">Category</SelectItem>
							<SelectItem value="priority">Priority</SelectItem>
							<SelectItem value="complianceStatus">Status</SelectItem>
							<SelectItem value="dueDate">Due Date</SelectItem>
							<SelectItem value="riskLevel">Risk Level</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
					>
						{sortOrder === "asc" ? (
							<SortAsc className="h-4 w-4" />
						) : (
							<SortDesc className="h-4 w-4" />
						)}
					</Button>

					{/* View mode */}
					<div className="flex items-center border rounded-md">
						<Button
							variant={viewMode === "list" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-r-none"
							onClick={() => setViewMode("list")}
						>
							<List className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "compact" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-none border-x"
							onClick={() => setViewMode("compact")}
						>
							<ListFilter className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-l-none"
							onClick={() => setViewMode("grid")}
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Filter panel */}
				{showFilters && (
					<div className="p-4 border rounded-lg bg-muted/30 space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-medium">Filters</h4>
							<Button variant="ghost" size="sm" onClick={clearFilters}>
								Clear all
							</Button>
						</div>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{/* Category filter */}
							<div className="space-y-2">
								<span className="text-xs font-medium text-muted-foreground">Category</span>
								<Select
									value={filters.categories[0] ?? ""}
									onValueChange={(value) =>
										setFilters((prev) => ({
											...prev,
											categories: value ? [value as RequirementCategory] : [],
										}))
									}
								>
									<SelectTrigger aria-label="Category">
										<SelectValue placeholder="All categories" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All categories</SelectItem>
										{CATEGORIES.map((cat) => (
											<SelectItem key={cat} value={cat}>
												{cat.replace("_", " ")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Priority filter */}
							<div className="space-y-2">
								<span className="text-xs font-medium text-muted-foreground">Priority</span>
								<Select
									value={filters.priorities[0] ?? ""}
									onValueChange={(value) =>
										setFilters((prev) => ({
											...prev,
											priorities: value ? [value as RequirementPriority] : [],
										}))
									}
								>
									<SelectTrigger aria-label="Priority">
										<SelectValue placeholder="All priorities" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All priorities</SelectItem>
										{PRIORITIES.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Status filter */}
							<div className="space-y-2">
								<span className="text-xs font-medium text-muted-foreground">Status</span>
								<Select
									value={filters.statuses[0] ?? ""}
									onValueChange={(value) =>
										setFilters((prev) => ({
											...prev,
											statuses: value ? [value as ComplianceStatus] : [],
										}))
									}
								>
									<SelectTrigger aria-label="Status">
										<SelectValue placeholder="All statuses" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All statuses</SelectItem>
										{STATUSES.map((s) => (
											<SelectItem key={s} value={s}>
												{s.replace("_", " ")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Risk level filter */}
							<div className="space-y-2">
								<span className="text-xs font-medium text-muted-foreground">Risk Level</span>
								<Select
									value={filters.riskLevels[0] ?? ""}
									onValueChange={(value) =>
										setFilters((prev) => ({
											...prev,
											riskLevels: value ? [value as RiskLevel] : [],
										}))
									}
								>
									<SelectTrigger aria-label="Risk Level">
										<SelectValue placeholder="All risk levels" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All risk levels</SelectItem>
										{RISK_LEVELS.map((r) => (
											<SelectItem key={r} value={r}>
												{r}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Additional filters */}
						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={filters.hasResponse === true}
									onCheckedChange={(checked) =>
										setFilters((prev) => ({
											...prev,
											hasResponse: checked ? true : null,
										}))
									}
								/>
								Has response
							</label>
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={filters.hasResponse === false}
									onCheckedChange={(checked) =>
										setFilters((prev) => ({
											...prev,
											hasResponse: checked ? false : null,
										}))
									}
								/>
								No response
							</label>
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={filters.isImplicit === true}
									onCheckedChange={(checked) =>
										setFilters((prev) => ({
											...prev,
											isImplicit: checked ? true : null,
										}))
									}
								/>
								Implicit only
							</label>
						</div>
					</div>
				)}

				{/* Bulk actions bar */}
				{selectedIds.size > 0 && (
					<div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
						<Checkbox
							checked={selectedIds.size === sortedRequirements.length}
							onCheckedChange={handleSelectAll}
						/>
						<span className="text-sm font-medium">{selectedIds.size} selected</span>
						<div className="flex-1" />
						{onBulkStatusChange && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										Update Status
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									{STATUSES.map((status) => (
										<DropdownMenuItem
											key={status}
											onClick={() =>
												onBulkStatusChange(Array.from(selectedIds), status)
											}
										>
											{status.replace("_", " ")}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
						{onBulkAssign && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => onBulkAssign(Array.from(selectedIds))}
							>
								Assign
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSelectedIds(new Set())}
						>
							Clear
						</Button>
					</div>
				)}

				{/* Error state */}
				{error && (
					<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
						{error}
					</div>
				)}

				{/* Loading state */}
				{isLoading && (
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
						))}
					</div>
				)}

				{/* Empty state */}
				{!isLoading && sortedRequirements.length === 0 && (
					<div className="text-center py-12">
						<p className="text-muted-foreground">
							{requirements.length === 0
								? "No requirements extracted yet"
								: "No requirements match the current filters"}
						</p>
						{activeFilterCount > 0 && (
							<Button variant="link" onClick={clearFilters} className="mt-2">
								Clear filters
							</Button>
						)}
					</div>
				)}

				{/* Requirements list */}
				{!isLoading && sortedRequirements.length > 0 && (
					<div
						className={cn(
							viewMode === "grid"
								? "grid grid-cols-1 md:grid-cols-2 gap-4"
								: "space-y-3"
						)}
					>
						{sortedRequirements.map((requirement) => (
							<RequirementCard
								key={requirement.id}
								requirement={requirement}
								isSelected={selectedIds.has(requirement.id)}
								isExpanded={expandedId === requirement.id}
								onSelect={handleSelect}
								onExpand={handleExpand}
								onEdit={onEdit}
								onStatusChange={onStatusChange}
								onAssign={onAssign}
								onViewResponse={onViewResponse}
								onAddClarification={onAddClarification}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default RequirementsList;
