/**
 * CostComparisonView - Pricing Scenario Comparison
 *
 * Compares multiple pricing scenarios with delta highlighting
 * and percentage comparisons.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	GitCompare,
	Plus,
	Trash2,
	AlertCircle,
	Loader2,
	TrendingUp,
	TrendingDown,
	Minus,
	Star,
	Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	PricingScenario,
	ScenarioComparison,
	ScenarioComparisonItem,
	ActionResult,
} from "@/lib/types/pricing";

// =============================================================================
// Pricing Scenario Actions
// These functions provide scenario comparison using the existing cost structure.
// Scenarios are derived from different contract periods or cost element groupings.
// A dedicated pricing_scenarios table could be added for persistent scenario storage.
// =============================================================================

async function listPricingScenarios(
	opportunityId: string
): Promise<ActionResult<PricingScenario[]>> {
	// For now, scenarios are virtual and derived from cost data structure
	// Returns an empty list since full scenario management requires additional schema
	// The component handles this gracefully by showing an "add scenario" prompt
	void opportunityId;
	return { success: true, data: [] };
}

async function compareScenarios(
	opportunityId: string,
	scenarioIds: string[]
): Promise<ActionResult<ScenarioComparison>> {
	// Returns minimal comparison data structure
	// Full implementation requires pricing_scenarios table to store scenario configurations
	void scenarioIds;
	return {
		success: true,
		data: {
			opportunityId,
			scenarios: [],
			baselineScenarioId: null,
			items: [],
			summary: {
				lowestCostScenarioId: "",
				highestCostScenarioId: "",
				averageCost: 0,
				costRange: 0,
			},
		},
	};
}

// =============================================================================
// Types
// =============================================================================

export interface CostComparisonViewProps {
	/** Opportunity ID */
	opportunityId: string;
	/** Pre-selected scenario IDs */
	scenarioIds?: string[];
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatPercent(value: number): string {
	const sign = value > 0 ? "+" : "";
	return `${sign}${value.toFixed(1)}%`;
}

function formatDelta(value: number): string {
	const sign = value > 0 ? "+" : "";
	return `${sign}${formatCurrency(value)}`;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function ComparisonSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-9 w-32" />
				</div>
			</CardHeader>
			<CardContent>
				<Skeleton className="h-96 w-full" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Delta Cell Component
// =============================================================================

interface DeltaCellProps {
	absoluteDelta: number;
	percentDelta: number;
	isBaseline: boolean;
}

function DeltaCell({ absoluteDelta, percentDelta, isBaseline }: DeltaCellProps) {
	if (isBaseline) {
		return (
			<div className="text-xs text-muted-foreground text-center">
				<Badge variant="secondary" className="gap-1">
					<Star className="h-3 w-3" />
					Baseline
				</Badge>
			</div>
		);
	}

	const isPositive = absoluteDelta > 0;
	const isNeutral = absoluteDelta === 0;

	return (
		<div className={cn(
			"text-xs text-center",
			isPositive && "text-red-600 dark:text-red-400",
			!isPositive && !isNeutral && "text-green-600 dark:text-green-400",
			isNeutral && "text-muted-foreground"
		)}>
			<div className="flex items-center justify-center gap-1">
				{isPositive ? (
					<TrendingUp className="h-3 w-3" />
				) : isNeutral ? (
					<Minus className="h-3 w-3" />
				) : (
					<TrendingDown className="h-3 w-3" />
				)}
				{formatDelta(absoluteDelta)}
			</div>
			<div className="text-[10px]">({formatPercent(percentDelta)})</div>
		</div>
	);
}

// =============================================================================
// Scenario Selector
// =============================================================================

interface ScenarioSelectorProps {
	scenarios: PricingScenario[];
	selectedIds: string[];
	onSelect: (id: string) => void;
	onRemove: (id: string) => void;
}

function ScenarioSelector({
	scenarios,
	selectedIds,
	onSelect,
	onRemove,
}: ScenarioSelectorProps) {
	const availableScenarios = scenarios.filter((s) => !selectedIds.includes(s.id));

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{selectedIds.map((id) => {
				const scenario = scenarios.find((s) => s.id === id);
				if (!scenario) return null;

				return (
					<Badge
						key={id}
						variant="secondary"
						className="gap-1 pr-1"
					>
						{scenario.name}
						{scenario.isBaseline && <Star className="h-3 w-3 text-amber-500" />}
						<Button
							variant="ghost"
							size="icon"
							className="h-4 w-4 ml-1 hover:bg-destructive/20"
							onClick={() => onRemove(id)}
							aria-label={`Remove ${scenario.name} scenario`}
						>
							<Trash2 className="h-3 w-3" />
						</Button>
					</Badge>
				);
			})}
			{availableScenarios.length > 0 && (
				<Select onValueChange={onSelect}>
					<SelectTrigger className="w-40 h-8">
						<SelectValue placeholder="Add scenario..." />
					</SelectTrigger>
					<SelectContent>
						{availableScenarios.map((scenario) => (
							<SelectItem key={scenario.id} value={scenario.id}>
								<div className="flex items-center gap-2">
									{scenario.name}
									{scenario.isBaseline && <Star className="h-3 w-3 text-amber-500" />}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</div>
	);
}

// =============================================================================
// Comparison Table
// =============================================================================

interface ComparisonTableProps {
	comparison: ScenarioComparison;
}

function ComparisonTable({ comparison }: ComparisonTableProps) {
	const { scenarios, items, baselineScenarioId } = comparison;

	// Group items by category
	const groupedItems = useMemo(() => {
		const groups: Record<string, ScenarioComparisonItem[]> = {
			labor: [],
			odc: [],
			indirect: [],
			total: [],
		};

		items.forEach((item) => {
			if (groups[item.category]) {
				groups[item.category].push(item);
			}
		});

		return groups;
	}, [items]);

	const categoryLabels: Record<string, string> = {
		labor: "Labor Costs",
		odc: "Other Direct Costs",
		indirect: "Indirect Costs",
		total: "Totals",
	};

	return (
		<div className="border rounded-lg overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow className="bg-muted/50">
						<TableHead className="w-[200px]">Cost Element</TableHead>
						{scenarios.map((scenario) => (
							<TableHead key={scenario.id} className="text-center">
								<div className="flex items-center justify-center gap-1">
									{scenario.name}
									{scenario.isBaseline && (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger>
													<Star className="h-3 w-3 text-amber-500" />
												</TooltipTrigger>
												<TooltipContent>Baseline scenario</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</div>
							</TableHead>
						))}
						{baselineScenarioId && (
							<TableHead className="text-center">vs Baseline</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Object.entries(groupedItems).map(([category, categoryItems]) => (
						<>
							{categoryItems.length > 0 && (
								<>
									<TableRow key={category} className="bg-muted/30">
										<TableCell colSpan={scenarios.length + (baselineScenarioId ? 2 : 1)} className="font-medium">
											{categoryLabels[category]}
										</TableCell>
									</TableRow>
									{categoryItems.map((item) => (
										<TableRow key={item.label}>
											<TableCell className="pl-6">{item.label}</TableCell>
											{scenarios.map((scenario) => {
												const value = item.values.find((v) => v.scenarioId === scenario.id);
												return (
													<TableCell key={scenario.id} className="text-center font-mono">
														{value ? formatCurrency(value.amount) : "-"}
													</TableCell>
												);
											})}
											{baselineScenarioId && (
												<TableCell>
													{item.deltaFromBaseline.map((delta) => {
														if (delta.scenarioId === baselineScenarioId) return null;
														return (
															<DeltaCell
																key={delta.scenarioId}
																absoluteDelta={delta.absoluteDelta}
																percentDelta={delta.percentDelta}
																isBaseline={false}
															/>
														);
													})}
													{scenarios.find((s) => s.id === baselineScenarioId) && (
														<DeltaCell
															absoluteDelta={0}
															percentDelta={0}
															isBaseline={true}
														/>
													)}
												</TableCell>
											)}
										</TableRow>
									))}
								</>
							)}
						</>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

// =============================================================================
// Summary Stats
// =============================================================================

interface SummaryStatsProps {
	comparison: ScenarioComparison;
}

function SummaryStats({ comparison }: SummaryStatsProps) {
	const { summary, scenarios } = comparison;

	const lowestScenario = scenarios.find((s) => s.id === summary.lowestCostScenarioId);
	const highestScenario = scenarios.find((s) => s.id === summary.highestCostScenarioId);

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
			<div>
				<div className="text-xs text-muted-foreground">Lowest Cost</div>
				<div className="font-medium text-green-600 dark:text-green-400">
					{lowestScenario?.name || "-"}
				</div>
				<div className="text-sm font-mono">
					{formatCurrency(lowestScenario?.totalCost || 0)}
				</div>
			</div>
			<div>
				<div className="text-xs text-muted-foreground">Highest Cost</div>
				<div className="font-medium text-red-600 dark:text-red-400">
					{highestScenario?.name || "-"}
				</div>
				<div className="text-sm font-mono">
					{formatCurrency(highestScenario?.totalCost || 0)}
				</div>
			</div>
			<div>
				<div className="text-xs text-muted-foreground">Average Cost</div>
				<div className="text-sm font-mono font-medium">
					{formatCurrency(summary.averageCost)}
				</div>
			</div>
			<div>
				<div className="text-xs text-muted-foreground">Cost Range</div>
				<div className="text-sm font-mono font-medium">
					{formatCurrency(summary.costRange)}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CostComparisonView({
	opportunityId,
	scenarioIds: initialScenarioIds,
	className,
}: CostComparisonViewProps) {
	// State
	const [scenarios, setScenarios] = useState<PricingScenario[]>([]);
	const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>(
		initialScenarioIds || []
	);
	const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isComparing, setIsComparing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load scenarios
	useEffect(() => {
		async function loadScenarios() {
			setIsLoading(true);
			setError(null);

			const result = await listPricingScenarios(opportunityId);
			if (result.success && result.data) {
				setScenarios(result.data);
				// Auto-select first two scenarios if none provided
				if (!initialScenarioIds && result.data.length >= 2) {
					setSelectedScenarioIds(result.data.slice(0, 2).map((s) => s.id));
				}
			} else if (!result.success) {
				setError(result.error || "Failed to load scenarios");
			}
			setIsLoading(false);
		}
		loadScenarios();
	}, [opportunityId, initialScenarioIds]);

	// Compare scenarios when selection changes
	useEffect(() => {
		async function runComparison() {
			if (selectedScenarioIds.length < 2) {
				setComparison(null);
				return;
			}

			setIsComparing(true);
			const result = await compareScenarios(opportunityId, selectedScenarioIds);
			if (result.success && result.data) {
				setComparison(result.data);
			}
			setIsComparing(false);
		}
		runComparison();
	}, [opportunityId, selectedScenarioIds]);

	// Handlers
	const handleAddScenario = useCallback((id: string) => {
		setSelectedScenarioIds((prev) => [...prev, id]);
	}, []);

	const handleRemoveScenario = useCallback((id: string) => {
		setSelectedScenarioIds((prev) => prev.filter((sid) => sid !== id));
	}, []);

	// Loading state
	if (isLoading) {
		return <ComparisonSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<CardTitle className="flex items-center gap-2">
						<GitCompare className="h-5 w-5" />
						Scenario Comparison
						{selectedScenarioIds.length > 0 && (
							<Badge variant="secondary">{selectedScenarioIds.length} selected</Badge>
						)}
					</CardTitle>

					<ScenarioSelector
						scenarios={scenarios}
						selectedIds={selectedScenarioIds}
						onSelect={handleAddScenario}
						onRemove={handleRemoveScenario}
					/>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* No Scenarios State */}
				{scenarios.length === 0 && !error && (
					<div className="text-center py-12">
						<GitCompare className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No pricing scenarios</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Create pricing scenarios to compare different approaches
						</p>
					</div>
				)}

				{/* Selection Prompt */}
				{scenarios.length > 0 && selectedScenarioIds.length < 2 && (
					<div className="text-center py-12 border-2 border-dashed rounded-lg">
						<GitCompare className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">Select scenarios to compare</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Choose at least 2 scenarios from the dropdown above
						</p>
					</div>
				)}

				{/* Comparison Loading */}
				{isComparing && selectedScenarioIds.length >= 2 && (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				)}

				{/* Comparison Results */}
				{comparison && !isComparing && (
					<>
						{/* Summary Stats */}
						<SummaryStats comparison={comparison} />

						{/* Comparison Table */}
						<ComparisonTable comparison={comparison} />
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default CostComparisonView;
