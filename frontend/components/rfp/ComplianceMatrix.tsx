"use client";

/**
 * Compliance Matrix Component
 *
 * Interactive compliance matrix displaying requirements mapped to
 * response sections with status tracking, filtering, and export.
 */

import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Search,
	Download,
	Upload,
	RefreshCw,
	MoreHorizontal,
	CheckCircle2,
	Circle,
	AlertTriangle,
	Clock,
	FileText,
	User,
	Edit2,
	ExternalLink,
	Filter,
	ChevronDown,
	ChevronRight,
	Columns,
} from "lucide-react";
import type {
	RequirementCategory,
	RequirementPriority,
	ComplianceStatus,
	RiskLevel,
	MatrixStatus,
} from "@/lib/db/schema-rfp";

// ============================================================================
// Types
// ============================================================================

export interface ComplianceEntry {
	id: string;
	requirementId: string;
	requirementNumber: string;
	requirementTitle: string | null;
	requirementText: string;
	category: RequirementCategory;
	priority: RequirementPriority;
	sourceSection: string | null;
	complianceStatus: ComplianceStatus;
	complianceJustification: string | null;
	responseReference: string | null;
	responseSummary: string | null;
	strengthAssessment: "strong" | "adequate" | "weak" | "gap" | null;
	riskLevel: RiskLevel | null;
	mitigationStrategy: string | null;
	assignedTo: string | null;
	dueDate: string | null;
	completionPercent: number;
	status: "draft" | "review" | "approved" | "rejected";
}

export interface ComplianceMatrixData {
	id: string;
	name: string;
	description: string | null;
	version: number;
	status: MatrixStatus;
	opportunityId: string;
	rfpDocumentId: string | null;
	totalRequirements: number;
	mandatoryCount: number;
	compliantCount: number;
	partialCount: number;
	nonCompliantCount: number;
	notAddressedCount: number;
	complianceScore: number | null;
	mandatoryComplianceScore: number | null;
	entries: ComplianceEntry[];
}

interface ComplianceMatrixProps {
	/** Matrix ID to load */
	matrixId: string;
	/** Initial matrix data (if already loaded) */
	initialData?: ComplianceMatrixData;
	/** Callback when entry status changes */
	onEntryStatusChange?: (entryId: string, status: ComplianceStatus) => void;
	/** Callback when entry is edited */
	onEntryEdit?: (entryId: string) => void;
	/** Callback to view requirement */
	onViewRequirement?: (requirementId: string) => void;
	/** Callback to view response */
	onViewResponse?: (entryId: string) => void;
	/** Callback for export */
	onExport?: (format: "csv" | "excel" | "pdf" | "word") => void;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const COMPLIANCE_STATUS_CONFIG: Record<
	ComplianceStatus,
	{ label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
	not_addressed: {
		label: "Not Addressed",
		color: "text-gray-600",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		icon: <Circle className="h-3 w-3" />,
	},
	in_progress: {
		label: "In Progress",
		color: "text-blue-600",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		icon: <Clock className="h-3 w-3" />,
	},
	addressed: {
		label: "Addressed",
		color: "text-cyan-600",
		bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
		icon: <FileText className="h-3 w-3" />,
	},
	compliant: {
		label: "Compliant",
		color: "text-green-600",
		bgColor: "bg-green-100 dark:bg-green-900/30",
		icon: <CheckCircle2 className="h-3 w-3" />,
	},
	partial: {
		label: "Partial",
		color: "text-yellow-600",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	non_compliant: {
		label: "Non-Compliant",
		color: "text-red-600",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	not_applicable: {
		label: "N/A",
		color: "text-slate-500",
		bgColor: "bg-slate-100 dark:bg-slate-800",
		icon: <Circle className="h-3 w-3" />,
	},
	pending: {
		label: "Pending",
		color: "text-orange-600",
		bgColor: "bg-orange-100 dark:bg-orange-900/30",
		icon: <Clock className="h-3 w-3" />,
	},
};

const PRIORITY_COLORS: Record<RequirementPriority, string> = {
	mandatory: "text-red-600 bg-red-100 dark:bg-red-900/30",
	preferred: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
	optional: "text-green-600 bg-green-100 dark:bg-green-900/30",
};

const STRENGTH_COLORS: Record<string, string> = {
	strong: "bg-green-500",
	adequate: "bg-yellow-500",
	weak: "bg-orange-500",
	gap: "bg-red-500",
};

type ColumnKey =
	| "requirementNumber"
	| "title"
	| "category"
	| "priority"
	| "sourceSection"
	| "complianceStatus"
	| "responseReference"
	| "assignedTo"
	| "dueDate"
	| "completionPercent"
	| "strength";

const DEFAULT_COLUMNS: ColumnKey[] = [
	"requirementNumber",
	"title",
	"category",
	"priority",
	"complianceStatus",
	"responseReference",
	"assignedTo",
	"completionPercent",
];

// ============================================================================
// Component
// ============================================================================

export function ComplianceMatrix({
	matrixId,
	initialData,
	onEntryStatusChange,
	onEntryEdit,
	onViewRequirement,
	onViewResponse,
	onExport,
	className,
}: ComplianceMatrixProps) {
	const [matrix, setMatrix] = useState<ComplianceMatrixData | null>(initialData ?? null);
	const [isLoading, setIsLoading] = useState(!initialData);
	const [error, setError] = useState<string | null>(null);

	// View state
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<RequirementCategory | "">("");
	const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "">("");
	const [priorityFilter, setPriorityFilter] = useState<RequirementPriority | "">("");
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
	const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS));
	const [groupByCategory, setGroupByCategory] = useState(false);

	// Fetch matrix data
	const fetchMatrix = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/v1/compliance-matrix/${matrixId}`);
			if (!response.ok) {
				throw new Error("Failed to fetch compliance matrix");
			}
			const data = await response.json();
			setMatrix(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load matrix");
		} finally {
			setIsLoading(false);
		}
	}, [matrixId]);

	// Load on mount
	React.useEffect(() => {
		if (!initialData) {
			fetchMatrix();
		}
	}, [initialData, fetchMatrix]);

	// Filter entries
	const filteredEntries = useMemo(() => {
		if (!matrix) return [];

		return matrix.entries.filter((entry) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesSearch =
					entry.requirementNumber.toLowerCase().includes(query) ||
					entry.requirementTitle?.toLowerCase().includes(query) ||
					entry.requirementText.toLowerCase().includes(query) ||
					entry.responseReference?.toLowerCase().includes(query);
				if (!matchesSearch) return false;
			}

			// Category filter
			if (categoryFilter && entry.category !== categoryFilter) {
				return false;
			}

			// Status filter
			if (statusFilter && entry.complianceStatus !== statusFilter) {
				return false;
			}

			// Priority filter
			if (priorityFilter && entry.priority !== priorityFilter) {
				return false;
			}

			return true;
		});
	}, [matrix, searchQuery, categoryFilter, statusFilter, priorityFilter]);

	// Group entries by category
	const groupedEntries = useMemo(() => {
		if (!groupByCategory) return { "": filteredEntries };

		const groups: Record<string, ComplianceEntry[]> = {};
		filteredEntries.forEach((entry) => {
			if (!groups[entry.category]) {
				groups[entry.category] = [];
			}
			groups[entry.category].push(entry);
		});
		return groups;
	}, [filteredEntries, groupByCategory]);

	// Toggle category expansion
	const toggleCategory = useCallback((category: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	}, []);

	// Toggle column visibility
	const toggleColumn = useCallback((column: ColumnKey) => {
		setVisibleColumns((prev) => {
			const next = new Set(prev);
			if (next.has(column)) {
				next.delete(column);
			} else {
				next.add(column);
			}
			return next;
		});
	}, []);

	// Calculate overall progress
	const overallProgress = matrix
		? Math.round(
				(matrix.entries.filter(
					(e) =>
						e.complianceStatus === "compliant" ||
						e.complianceStatus === "partial" ||
						e.complianceStatus === "not_applicable"
				).length /
					Math.max(matrix.totalRequirements, 1)) *
					100
		  )
		: 0;

	// Render status cell
	const renderStatusCell = (entry: ComplianceEntry) => {
		const config = COMPLIANCE_STATUS_CONFIG[entry.complianceStatus];
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"h-7 px-2 gap-1 font-normal",
							config.bgColor,
							config.color
						)}
					>
						{config.icon}
						{config.label}
						<ChevronDown className="h-3 w-3 ml-1" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{Object.entries(COMPLIANCE_STATUS_CONFIG).map(([status, cfg]) => (
						<DropdownMenuItem
							key={status}
							onClick={() => onEntryStatusChange?.(entry.id, status as ComplianceStatus)}
							className={cn("gap-2", cfg.color)}
						>
							{cfg.icon}
							{cfg.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	// Render table row
	const renderRow = (entry: ComplianceEntry) => (
		<TableRow key={entry.id} className="group">
			{visibleColumns.has("requirementNumber") && (
				<TableCell className="font-mono text-xs">
					<Button
						variant="link"
						size="sm"
						className="p-0 h-auto font-mono"
						onClick={() => onViewRequirement?.(entry.requirementId)}
					>
						{entry.requirementNumber}
					</Button>
				</TableCell>
			)}
			{visibleColumns.has("title") && (
				<TableCell className="max-w-[200px]">
					<p className="text-sm truncate" title={entry.requirementTitle ?? entry.requirementText}>
						{entry.requirementTitle ?? entry.requirementText.slice(0, 100)}
					</p>
				</TableCell>
			)}
			{visibleColumns.has("category") && (
				<TableCell>
					<Badge variant="outline" className="text-xs capitalize">
						{entry.category.replace("_", " ")}
					</Badge>
				</TableCell>
			)}
			{visibleColumns.has("priority") && (
				<TableCell>
					<Badge className={cn("text-xs", PRIORITY_COLORS[entry.priority])}>
						{entry.priority}
					</Badge>
				</TableCell>
			)}
			{visibleColumns.has("sourceSection") && (
				<TableCell className="text-xs text-muted-foreground">
					{entry.sourceSection}
				</TableCell>
			)}
			{visibleColumns.has("complianceStatus") && (
				<TableCell>{renderStatusCell(entry)}</TableCell>
			)}
			{visibleColumns.has("responseReference") && (
				<TableCell>
					{entry.responseReference ? (
						<Button
							variant="link"
							size="sm"
							className="p-0 h-auto text-xs"
							onClick={() => onViewResponse?.(entry.id)}
						>
							{entry.responseReference}
						</Button>
					) : (
						<span className="text-xs text-muted-foreground">-</span>
					)}
				</TableCell>
			)}
			{visibleColumns.has("assignedTo") && (
				<TableCell>
					{entry.assignedTo ? (
						<div className="flex items-center gap-1 text-xs">
							<User className="h-3 w-3" />
							{entry.assignedTo}
						</div>
					) : (
						<span className="text-xs text-muted-foreground">-</span>
					)}
				</TableCell>
			)}
			{visibleColumns.has("dueDate") && (
				<TableCell className="text-xs">
					{entry.dueDate
						? new Date(entry.dueDate).toLocaleDateString()
						: "-"}
				</TableCell>
			)}
			{visibleColumns.has("completionPercent") && (
				<TableCell>
					<div className="flex items-center gap-2">
						<Progress value={entry.completionPercent} className="h-1.5 w-16" />
						<span className="text-xs text-muted-foreground">
							{entry.completionPercent}%
						</span>
					</div>
				</TableCell>
			)}
			{visibleColumns.has("strength") && (
				<TableCell>
					{entry.strengthAssessment && (
						<div
							className={cn(
								"h-2 w-2 rounded-full",
								STRENGTH_COLORS[entry.strengthAssessment]
							)}
							title={entry.strengthAssessment}
						/>
					)}
				</TableCell>
			)}
			<TableCell>
				<div className="opacity-0 group-hover:opacity-100 transition-opacity">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-7 w-7">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onEntryEdit?.(entry.id)}>
								<Edit2 className="h-4 w-4 mr-2" />
								Edit Entry
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onViewRequirement?.(entry.requirementId)}>
								<FileText className="h-4 w-4 mr-2" />
								View Requirement
							</DropdownMenuItem>
							{entry.responseReference && (
								<DropdownMenuItem onClick={() => onViewResponse?.(entry.id)}>
									<ExternalLink className="h-4 w-4 mr-2" />
									View Response
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</TableCell>
		</TableRow>
	);

	if (isLoading) {
		return (
			<Card className={className}>
				<CardContent className="p-8">
					<div className="flex items-center justify-center">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error || !matrix) {
		return (
			<Card className={className}>
				<CardContent className="p-8">
					<div className="text-center text-destructive">
						{error ?? "Failed to load compliance matrix"}
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							{matrix.name}
							<Badge variant="outline">v{matrix.version}</Badge>
							<Badge
								variant={matrix.status === "final" ? "default" : "secondary"}
							>
								{matrix.status}
							</Badge>
						</CardTitle>
						<CardDescription>{matrix.description}</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={fetchMatrix}
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
									<DropdownMenuItem onClick={() => onExport("pdf")}>
										Export as PDF
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onExport("word")}>
										Export as Word
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>

				{/* Statistics */}
				<div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
					<div className="text-center p-3 rounded-lg bg-muted/50">
						<p className="text-2xl font-bold">{matrix.totalRequirements}</p>
						<p className="text-xs text-muted-foreground">Total</p>
					</div>
					<div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
						<p className="text-2xl font-bold text-red-600">{matrix.mandatoryCount}</p>
						<p className="text-xs text-muted-foreground">Mandatory</p>
					</div>
					<div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
						<p className="text-2xl font-bold text-green-600">{matrix.compliantCount}</p>
						<p className="text-xs text-muted-foreground">Compliant</p>
					</div>
					<div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
						<p className="text-2xl font-bold text-yellow-600">{matrix.partialCount}</p>
						<p className="text-xs text-muted-foreground">Partial</p>
					</div>
					<div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
						<p className="text-2xl font-bold text-red-600">{matrix.nonCompliantCount}</p>
						<p className="text-xs text-muted-foreground">Non-Compliant</p>
					</div>
					<div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20">
						<p className="text-2xl font-bold text-gray-600">{matrix.notAddressedCount}</p>
						<p className="text-xs text-muted-foreground">Not Addressed</p>
					</div>
				</div>

				{/* Progress bar */}
				<div className="mt-4 space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span>Overall Compliance</span>
						<span className="font-medium">
							{matrix.complianceScore?.toFixed(1) ?? overallProgress}%
						</span>
					</div>
					<Progress value={matrix.complianceScore ?? overallProgress} className="h-2" />
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Toolbar */}
				<div className="flex items-center gap-2 flex-wrap">
					{/* Search */}
					<div className="relative flex-1 min-w-[200px] max-w-md">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search requirements..."
							className="pl-9"
						/>
					</div>

					{/* Category filter */}
					<Select
						value={categoryFilter}
						onValueChange={(v) => setCategoryFilter(v as RequirementCategory | "")}
					>
						<SelectTrigger className="w-[150px]">
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All categories</SelectItem>
							<SelectItem value="technical">Technical</SelectItem>
							<SelectItem value="management">Management</SelectItem>
							<SelectItem value="past_performance">Past Performance</SelectItem>
							<SelectItem value="cost">Cost</SelectItem>
							<SelectItem value="administrative">Administrative</SelectItem>
							<SelectItem value="personnel">Personnel</SelectItem>
							<SelectItem value="security">Security</SelectItem>
							<SelectItem value="compliance">Compliance</SelectItem>
						</SelectContent>
					</Select>

					{/* Status filter */}
					<Select
						value={statusFilter}
						onValueChange={(v) => setStatusFilter(v as ComplianceStatus | "")}
					>
						<SelectTrigger className="w-[150px]">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All statuses</SelectItem>
							{Object.entries(COMPLIANCE_STATUS_CONFIG).map(([status, config]) => (
								<SelectItem key={status} value={status}>
									{config.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Priority filter */}
					<Select
						value={priorityFilter}
						onValueChange={(v) => setPriorityFilter(v as RequirementPriority | "")}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Priority" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All priorities</SelectItem>
							<SelectItem value="mandatory">Mandatory</SelectItem>
							<SelectItem value="preferred">Preferred</SelectItem>
							<SelectItem value="optional">Optional</SelectItem>
						</SelectContent>
					</Select>

					{/* Group by category toggle */}
					<Button
						variant={groupByCategory ? "secondary" : "outline"}
						size="sm"
						onClick={() => setGroupByCategory(!groupByCategory)}
					>
						<Filter className="h-4 w-4 mr-2" />
						Group
					</Button>

					{/* Column visibility */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Columns className="h-4 w-4 mr-2" />
								Columns
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{(
								[
									["requirementNumber", "Req #"],
									["title", "Title"],
									["category", "Category"],
									["priority", "Priority"],
									["sourceSection", "Source Section"],
									["complianceStatus", "Status"],
									["responseReference", "Response Ref"],
									["assignedTo", "Assigned To"],
									["dueDate", "Due Date"],
									["completionPercent", "Progress"],
									["strength", "Strength"],
								] as [ColumnKey, string][]
							).map(([key, label]) => (
								<DropdownMenuItem
									key={key}
									onClick={() => toggleColumn(key)}
									className="gap-2"
								>
									<div
										className={cn(
											"h-4 w-4 border rounded flex items-center justify-center",
											visibleColumns.has(key) && "bg-primary border-primary"
										)}
									>
										{visibleColumns.has(key) && (
											<CheckCircle2 className="h-3 w-3 text-primary-foreground" />
										)}
									</div>
									{label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Table */}
				<div className="border rounded-lg overflow-auto">
					<Table>
						<TableHeader>
							<TableRow>
								{visibleColumns.has("requirementNumber") && (
									<TableHead className="w-[100px]">Req #</TableHead>
								)}
								{visibleColumns.has("title") && (
									<TableHead className="min-w-[200px]">Title/Text</TableHead>
								)}
								{visibleColumns.has("category") && (
									<TableHead className="w-[120px]">Category</TableHead>
								)}
								{visibleColumns.has("priority") && (
									<TableHead className="w-[100px]">Priority</TableHead>
								)}
								{visibleColumns.has("sourceSection") && (
									<TableHead className="w-[100px]">Source</TableHead>
								)}
								{visibleColumns.has("complianceStatus") && (
									<TableHead className="w-[140px]">Status</TableHead>
								)}
								{visibleColumns.has("responseReference") && (
									<TableHead className="w-[120px]">Response</TableHead>
								)}
								{visibleColumns.has("assignedTo") && (
									<TableHead className="w-[120px]">Assigned</TableHead>
								)}
								{visibleColumns.has("dueDate") && (
									<TableHead className="w-[100px]">Due</TableHead>
								)}
								{visibleColumns.has("completionPercent") && (
									<TableHead className="w-[120px]">Progress</TableHead>
								)}
								{visibleColumns.has("strength") && (
									<TableHead className="w-[50px]">Str</TableHead>
								)}
								<TableHead className="w-[50px]" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{groupByCategory
								? Object.entries(groupedEntries).map(([category, entries]) => (
										<React.Fragment key={category}>
											{category && (
												<TableRow
													className="bg-muted/50 cursor-pointer hover:bg-muted"
													onClick={() => toggleCategory(category)}
												>
													<TableCell
														colSpan={visibleColumns.size + 1}
														className="font-medium"
													>
														<div className="flex items-center gap-2">
															{expandedCategories.has(category) ? (
																<ChevronDown className="h-4 w-4" />
															) : (
																<ChevronRight className="h-4 w-4" />
															)}
															<span className="capitalize">
																{category.replace("_", " ")}
															</span>
															<Badge variant="secondary" className="ml-2">
																{entries.length}
															</Badge>
														</div>
													</TableCell>
												</TableRow>
											)}
											{(category === "" || expandedCategories.has(category)) &&
												entries.map(renderRow)}
										</React.Fragment>
								  ))
								: filteredEntries.map(renderRow)}
						</TableBody>
					</Table>
				</div>

				{/* Empty state */}
				{filteredEntries.length === 0 && (
					<div className="text-center py-8 text-muted-foreground">
						No entries match the current filters
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default ComplianceMatrix;
