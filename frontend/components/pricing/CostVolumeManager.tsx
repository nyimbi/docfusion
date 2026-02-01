/**
 * CostVolumeManager - Main Cost Volume Interface
 *
 * Central hub for managing cost volumes with WBS tree, cost elements,
 * period tabs, and real-time summary calculations.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Plus,
	DollarSign,
	Clock,
	FileText,
	MoreHorizontal,
	Edit2,
	Trash2,
	Copy,
	AlertCircle,
	Loader2,
	ChevronRight,
	Calculator,
	Users,
	Plane,
	Package,
	Building2,
	RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

import type {
	CostElement,
	CostElementType,
	WBSNode,
} from "@/lib/types/pricing";
import type { ContractPeriodData, WBSTreeData, PricingSummaryUIData } from "@/lib/actions/pricing";
import {
	listCostElements,
	listContractPeriods,
	getWBSTree,
	deleteCostElement,
	duplicateCostElement,
	getPricingSummary,
	recalculatePricing,
} from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface CostVolumeManagerProps {
	/** Opportunity ID to manage cost volume for */
	opportunityId: string;
	/** Callback when a cost element is selected for editing */
	onEditElement?: (element: CostElement) => void;
	/** Callback to create new cost element */
	onCreateElement?: (type?: CostElementType) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const COST_TYPE_CONFIG: Record<
	CostElementType,
	{ label: string; icon: typeof Users; color: string; bgColor: string }
> = {
	labor: {
		label: "Labor",
		icon: Users,
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	odc: {
		label: "ODC",
		icon: Package,
		color: "text-purple-600 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
	subcontract: {
		label: "Subcontract",
		icon: Building2,
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	travel: {
		label: "Travel",
		icon: Plane,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	material: {
		label: "Material",
		icon: Package,
		color: "text-cyan-600 dark:text-cyan-400",
		bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
	},
	other: {
		label: "Other",
		icon: FileText,
		color: "text-gray-600 dark:text-gray-400",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format currency value.
 */
function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

/**
 * Format number with commas.
 */
function formatNumber(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function CostVolumeManagerSkeleton() {
	return (
		<Card className="h-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-24" />
						<Skeleton className="h-9 w-32" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Skeleton className="h-10 w-full mb-4" />
				<div className="grid grid-cols-3 gap-4">
					<div className="space-y-3">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
					<div className="col-span-2 space-y-3">
						{[1, 2, 3, 4, 5].map((i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// WBS Tree Panel Component
// =============================================================================

interface WBSTreePanelProps {
	nodes: WBSNode[];
	selectedNodeId: string | null;
	onSelectNode: (nodeId: string | null) => void;
}

function WBSTreePanel({ nodes, selectedNodeId, onSelectNode }: WBSTreePanelProps) {
	const renderNode = (node: WBSNode, depth: number = 0) => (
		<div key={node.id}>
			<button
				onClick={() => onSelectNode(node.id === selectedNodeId ? null : node.id)}
				className={cn(
					"w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors",
					selectedNodeId === node.id && "bg-muted"
				)}
				style={{ paddingLeft: `${depth * 16 + 8}px` }}
			>
				{node.children && node.children.length > 0 && (
					<ChevronRight className="h-3 w-3 text-muted-foreground" />
				)}
				<span className="font-mono text-xs text-muted-foreground">{node.wbsCode}</span>
				<span className="truncate flex-1 text-left">{node.title}</span>
				{node.totalCost !== null && (
					<span className="text-xs text-muted-foreground">
						{formatCurrency(node.totalCost)}
					</span>
				)}
			</button>
			{node.children?.map((child) => renderNode(child, depth + 1))}
		</div>
	);

	if (nodes.length === 0) {
		return (
			<div className="p-4 text-center text-sm text-muted-foreground">
				No WBS structure defined
			</div>
		);
	}

	return (
		<div className="space-y-0.5">
			<button
				onClick={() => onSelectNode(null)}
				className={cn(
					"w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors",
					selectedNodeId === null && "bg-muted"
				)}
			>
				<DollarSign className="h-3 w-3" />
				<span className="font-medium">All Cost Elements</span>
			</button>
			{nodes.map((node) => renderNode(node))}
		</div>
	);
}

// =============================================================================
// Cost Element Row Component
// =============================================================================

interface CostElementRowProps {
	element: CostElement;
	onEdit: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}

function CostElementRow({ element, onEdit, onDuplicate, onDelete }: CostElementRowProps) {
	const elementType = element.elementType || "other";
	const typeConfig = COST_TYPE_CONFIG[elementType];
	const TypeIcon = typeConfig?.icon || FileText;

	return (
		<div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
			{/* Type Icon */}
			<div className={cn("p-2 rounded", typeConfig?.bgColor || "bg-gray-100")}>
				<TypeIcon className={cn("h-4 w-4", typeConfig?.color || "text-gray-600")} />
			</div>

			{/* Element Details */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium truncate">{element.wbsTitle || element.wbsCode || "Unnamed"}</span>
					<Badge variant="secondary" className="text-xs">
						{typeConfig?.label || "Other"}
					</Badge>
				</div>
				{element.boeNarrative && (
					<p className="text-sm text-muted-foreground truncate mt-0.5">
						{element.boeNarrative}
					</p>
				)}
				{element.elementType === "labor" && element.laborCategoryName && (
					<p className="text-xs text-muted-foreground mt-0.5">
						{element.laborCategoryName} - {formatNumber(element.hours || 0)} hrs
					</p>
				)}
			</div>

			{/* Cost Summary */}
			<div className="text-right">
				<div className="font-medium">{formatCurrency(element.totalCost || 0)}</div>
			</div>

			{/* Actions */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 opacity-0 group-hover:opacity-100"
					>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={onEdit}>
						<Edit2 className="h-4 w-4 mr-2" />
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onDuplicate}>
						<Copy className="h-4 w-4 mr-2" />
						Duplicate
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={onDelete} className="text-destructive">
						<Trash2 className="h-4 w-4 mr-2" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

// =============================================================================
// Summary Panel Component
// =============================================================================

interface SummaryPanelProps {
	summary: PricingSummaryUIData | null;
	isLoading: boolean;
}

function SummaryPanel({ summary, isLoading }: SummaryPanelProps) {
	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	if (!summary) {
		return (
			<div className="p-4 text-center text-sm text-muted-foreground">
				No pricing data available
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Grand Total */}
			<div className="p-4 bg-primary/10 rounded-lg">
				<div className="text-sm text-muted-foreground">Total Proposed Cost</div>
				<div className="text-2xl font-bold">
					{formatCurrency(summary.grandTotal.totalCost)}
				</div>
				<div className="text-xs text-muted-foreground mt-1">
					{formatNumber(summary.grandTotal.laborHours)} labor hours
				</div>
			</div>

			{/* Cost Breakdown */}
			<div className="space-y-2">
				<div className="text-sm font-medium">Cost Breakdown</div>
				<div className="space-y-1">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Labor</span>
						<span>{formatCurrency(summary.grandTotal.laborCost)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">ODC</span>
						<span>{formatCurrency(summary.grandTotal.odcCost)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Subcontracts</span>
						<span>{formatCurrency(summary.grandTotal.subcontractCost)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Travel</span>
						<span>{formatCurrency(summary.grandTotal.travelCost)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Materials</span>
						<span>{formatCurrency(summary.grandTotal.materialCost)}</span>
					</div>
					<Separator className="my-2" />
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Direct Cost</span>
						<span>{formatCurrency(summary.grandTotal.directCost)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Indirect Cost</span>
						<span>{formatCurrency(summary.grandTotal.indirectCost)}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Fee</span>
						<span>{formatCurrency(summary.grandTotal.fee)}</span>
					</div>
				</div>
			</div>

			{/* Indirect Rates */}
			{summary.indirectRates.length > 0 && (
				<div className="space-y-2">
					<div className="text-sm font-medium">Applied Rates</div>
					<div className="space-y-1">
						{summary.indirectRates.map((rate) => (
							<div key={rate.rateType} className="flex justify-between text-sm">
								<span className="text-muted-foreground">{rate.name}</span>
								<span>{(rate.rate * 100).toFixed(1)}%</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CostVolumeManager({
	opportunityId,
	onEditElement,
	onCreateElement,
	className,
}: CostVolumeManagerProps) {
	// State
	const [costElements, setCostElements] = useState<CostElement[]>([]);
	const [periods, setPeriods] = useState<ContractPeriodData[]>([]);
	const [wbsNodes, setWbsNodes] = useState<WBSNode[]>([]);
	const [summary, setSummary] = useState<PricingSummaryUIData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSummaryLoading, setIsSummaryLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
	const [selectedWbsNodeId, setSelectedWbsNodeId] = useState<string | null>(null);
	const [deleteDialogElement, setDeleteDialogElement] = useState<CostElement | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isRecalculating, setIsRecalculating] = useState(false);

	// Load initial data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			try {
				const [elementsResult, periodsResult, wbsResult, summaryResult] = await Promise.all([
					listCostElements(opportunityId),
					listContractPeriods(opportunityId),
					getWBSTree(opportunityId),
					getPricingSummary(opportunityId),
				]);

				if (elementsResult.success && elementsResult.data) {
					setCostElements(elementsResult.data);
				}
				if (periodsResult.success && periodsResult.data) {
					setPeriods(periodsResult.data);
				}
				if (wbsResult.success && wbsResult.data) {
					setWbsNodes(wbsResult.data.nodes);
				}
				if (summaryResult.success && summaryResult.data) {
					setSummary(summaryResult.data);
				}
			} catch (err) {
				setError("Failed to load cost volume data");
			}

			setIsLoading(false);
		}
		loadData();
	}, [opportunityId]);

	// Filter cost elements
	const filteredElements = useMemo(() => {
		let filtered = costElements;

		if (selectedPeriodId !== "all") {
			// Parse period number from period ID (format: "period-N")
			const periodNum = parseInt(selectedPeriodId.replace("period-", ""), 10);
			if (!isNaN(periodNum)) {
				filtered = filtered.filter((el) => el.periodNumber === periodNum);
			}
		}

		if (selectedWbsNodeId) {
			// Filter by WBS code (node ID format: "wbs-CODE")
			const wbsCode = selectedWbsNodeId.replace("wbs-", "");
			filtered = filtered.filter((el) => el.wbsCode === wbsCode || el.wbsCode?.startsWith(`${wbsCode}.`));
		}

		return filtered;
	}, [costElements, selectedPeriodId, selectedWbsNodeId]);

	// Group by type for quick stats
	const elementStats = useMemo(() => {
		const stats = {
			total: filteredElements.length,
			totalCost: filteredElements.reduce((sum, el) => sum + (el.totalCost || 0), 0),
			byType: {} as Record<CostElementType, { count: number; cost: number }>,
		};

		filteredElements.forEach((el) => {
			const elType = el.elementType || "other";
			if (!stats.byType[elType]) {
				stats.byType[elType] = { count: 0, cost: 0 };
			}
			stats.byType[elType].count++;
			stats.byType[elType].cost += el.totalCost || 0;
		});

		return stats;
	}, [filteredElements]);

	// Handlers
	const handleEdit = useCallback(
		(element: CostElement) => {
			onEditElement?.(element);
		},
		[onEditElement]
	);

	const handleDuplicate = useCallback(
		async (element: CostElement) => {
			const result = await duplicateCostElement(element.id);
			if (result.success && result.data) {
				setCostElements((prev) => [...prev, result.data!]);
			}
		},
		[]
	);

	const handleDelete = useCallback(async () => {
		if (!deleteDialogElement) return;

		setIsDeleting(true);
		const result = await deleteCostElement(deleteDialogElement.id);
		if (result.success) {
			setCostElements((prev) => prev.filter((el) => el.id !== deleteDialogElement.id));
			setDeleteDialogElement(null);
		}
		setIsDeleting(false);
	}, [deleteDialogElement]);

	const handleRecalculate = useCallback(async () => {
		setIsRecalculating(true);
		const result = await recalculatePricing(opportunityId);
		if (result.success) {
			// Reload summary
			setIsSummaryLoading(true);
			const summaryResult = await getPricingSummary(opportunityId);
			if (summaryResult.success && summaryResult.data) {
				setSummary(summaryResult.data);
			}
			setIsSummaryLoading(false);
		}
		setIsRecalculating(false);
	}, [opportunityId]);

	// Loading state
	if (isLoading) {
		return <CostVolumeManagerSkeleton />;
	}

	return (
		<Card className={cn("h-full flex flex-col", className)}>
			<CardHeader className="flex-shrink-0">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<CardTitle className="flex items-center gap-2">
						<DollarSign className="h-5 w-5" />
						Cost Volume Manager
						{elementStats.total > 0 && (
							<Badge variant="secondary">{elementStats.total} elements</Badge>
						)}
					</CardTitle>

					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										onClick={handleRecalculate}
										disabled={isRecalculating}
									>
										{isRecalculating ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="h-4 w-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Recalculate all costs</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button>
									<Plus className="h-4 w-4 mr-2" />
									Add Cost Element
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{Object.entries(COST_TYPE_CONFIG).map(([type, config]) => {
									const Icon = config.icon;
									return (
										<DropdownMenuItem
											key={type}
											onClick={() => onCreateElement?.(type as CostElementType)}
										>
											<Icon className={cn("h-4 w-4 mr-2", config.color)} />
											{config.label}
										</DropdownMenuItem>
									);
								})}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden p-0">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive" className="m-4">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Period Tabs */}
				<div className="px-4 pb-2">
					<Tabs value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
						<TabsList className="w-full justify-start">
							<TabsTrigger value="all">All Periods</TabsTrigger>
							{periods.map((period) => (
								<TabsTrigger key={period.id} value={period.id}>
									{period.name}
									<Badge variant="secondary" className="ml-2 text-xs">
										{period.periodType === "base" ? "Base" : "Option"}
									</Badge>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{/* Main Content */}
				<ResizablePanelGroup orientation="horizontal" className="flex-1">
					{/* WBS Tree Panel */}
					<ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
						<div className="h-full border-r">
							<div className="p-2 border-b">
								<span className="text-sm font-medium">WBS Structure</span>
							</div>
							<ScrollArea className="h-[calc(100%-40px)]">
								<div className="p-2">
									<WBSTreePanel
										nodes={wbsNodes}
										selectedNodeId={selectedWbsNodeId}
										onSelectNode={setSelectedWbsNodeId}
									/>
								</div>
							</ScrollArea>
						</div>
					</ResizablePanel>

					<ResizableHandle />

					{/* Cost Elements List */}
					<ResizablePanel defaultSize={55}>
						<div className="h-full flex flex-col">
							{/* Quick Stats */}
							<div className="p-4 border-b flex items-center gap-4 flex-wrap">
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm text-muted-foreground">
										{filteredElements.filter((e) => e.elementType === "labor").reduce(
											(sum, e) => sum + (e.hours || 0),
											0
										).toLocaleString()}{" "}
										hours
									</span>
								</div>
								<Separator orientation="vertical" className="h-4" />
								<div className="flex items-center gap-2">
									<DollarSign className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm text-muted-foreground">
										{formatCurrency(elementStats.totalCost)} total
									</span>
								</div>
								<Separator orientation="vertical" className="h-4" />
								<div className="flex items-center gap-2 flex-wrap">
									{Object.entries(elementStats.byType).map(([type, stats]) => {
										const config = COST_TYPE_CONFIG[type as CostElementType];
										if (!config) return null;
										return (
											<Badge
												key={type}
												variant="secondary"
												className={cn("gap-1 text-xs", config.bgColor, config.color)}
											>
												{stats.count} {config.label}
											</Badge>
										);
									})}
								</div>
							</div>

							{/* Elements List */}
							<ScrollArea className="flex-1">
								<div className="p-4 space-y-2">
									{filteredElements.length === 0 ? (
										<div className="text-center py-12">
											<DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50" />
											<h3 className="mt-4 font-medium">No cost elements</h3>
											<p className="text-sm text-muted-foreground mt-1">
												Add cost elements to build your pricing
											</p>
											<Button onClick={() => onCreateElement?.()} className="mt-4">
												<Plus className="h-4 w-4 mr-2" />
												Add First Element
											</Button>
										</div>
									) : (
										filteredElements.map((element) => (
											<CostElementRow
												key={element.id}
												element={element}
												onEdit={() => handleEdit(element)}
												onDuplicate={() => handleDuplicate(element)}
												onDelete={() => setDeleteDialogElement(element)}
											/>
										))
									)}
								</div>
							</ScrollArea>
						</div>
					</ResizablePanel>

					<ResizableHandle />

					{/* Summary Panel */}
					<ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
						<div className="h-full border-l">
							<div className="p-2 border-b">
								<span className="text-sm font-medium">Pricing Summary</span>
							</div>
							<ScrollArea className="h-[calc(100%-40px)]">
								<div className="p-4">
									<SummaryPanel summary={summary} isLoading={isSummaryLoading} />
								</div>
							</ScrollArea>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</CardContent>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteDialogElement} onOpenChange={() => setDeleteDialogElement(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Cost Element</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteDialogElement?.wbsTitle || deleteDialogElement?.wbsCode || "this element"}"?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogElement(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export default CostVolumeManager;
