"use client";

/**
 * Portfolio Optimizer Component
 *
 * Strategic portfolio optimization tool that helps prioritize opportunities
 * based on PWin, value, resource constraints, and optimization strategy.
 * Provides actionable recommendations for resource allocation.
 *
 * Features:
 * - Multiple optimization strategies (maximize wins, value, balanced)
 * - Resource constraint configuration
 * - PWin threshold filtering
 * - Visual priority rankings
 * - Expected value calculations
 * - Resource allocation recommendations
 *
 * @example
 * ```tsx
 * <PortfolioOptimizer
 *   organizationId="org-123"
 *   onOptimizationComplete={(result) => console.log(result)}
 * />
 * ```
 */

import { useState, useCallback, useMemo } from "react";
import {
	PieChart,
	TrendingUp,
	DollarSign,
	Target,
	Sliders,
	Play,
	Loader2,
	AlertCircle,
	RefreshCw,
	CheckCircle,
	XCircle,
	ArrowRight,
	BarChart3,
	Award,
	Scale,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import { optimizePortfolio } from "@/lib/actions/pwin";
import type {
	PortfolioOptimization,
	OptimizationType,
} from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface PortfolioOptimizerProps {
	organizationId?: string;
	onOptimizationComplete?: (result: PortfolioOptimization) => void;
	onOpportunitySelect?: (opportunityId: string) => void;
	className?: string;
}

interface OptimizationConfig {
	optimizationType: OptimizationType;
	resourceConstraint: number | null;
	minPwin: number;
	maxOpportunities: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const OPTIMIZATION_STRATEGIES: Array<{
	value: OptimizationType;
	label: string;
	description: string;
	icon: React.ElementType;
}> = [
	{
		value: "maximize_wins",
		label: "Maximize Wins",
		description: "Prioritize opportunities with highest win probability",
		icon: Award,
	},
	{
		value: "maximize_value",
		label: "Maximize Value",
		description: "Prioritize opportunities with highest expected value (PWin x Contract Value)",
		icon: DollarSign,
	},
	{
		value: "balanced",
		label: "Balanced",
		description: "Balance win probability and contract value equally",
		icon: Scale,
	},
];

const DEFAULT_CONFIG: OptimizationConfig = {
	optimizationType: "balanced",
	resourceConstraint: null,
	minPwin: 30,
	maxOpportunities: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
	if (value >= 1e9) {
		return `$${(value / 1e9).toFixed(1)}B`;
	}
	if (value >= 1e6) {
		return `$${(value / 1e6).toFixed(1)}M`;
	}
	if (value >= 1e3) {
		return `$${(value / 1e3).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "text-green-600 dark:text-green-400";
	if (pwin >= 50) return "text-amber-600 dark:text-amber-400";
	if (pwin >= 30) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

// ============================================================================
// Component
// ============================================================================

export function PortfolioOptimizer({
	organizationId,
	onOptimizationComplete,
	onOpportunitySelect,
	className,
}: PortfolioOptimizerProps) {
	// State
	const [config, setConfig] = useState<OptimizationConfig>(DEFAULT_CONFIG);
	const [result, setResult] = useState<PortfolioOptimization | null>(null);
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [useResourceConstraint, setUseResourceConstraint] = useState(false);
	const [useMaxOpportunities, setUseMaxOpportunities] = useState(false);

	// Update config
	const updateConfig = useCallback(<K extends keyof OptimizationConfig>(
		field: K,
		value: OptimizationConfig[K]
	) => {
		setConfig(prev => ({ ...prev, [field]: value }));
	}, []);

	// Run optimization
	const runOptimization = useCallback(async () => {
		setIsOptimizing(true);
		setError(null);
		setResult(null);

		const optimizeResult = await optimizePortfolio({
			optimizationType: config.optimizationType,
			resourceConstraint: useResourceConstraint ? config.resourceConstraint ?? undefined : undefined,
			minPwin: config.minPwin,
			maxOpportunities: useMaxOpportunities ? config.maxOpportunities ?? undefined : undefined,
			organizationId,
		});

		if (optimizeResult.success) {
			setResult(optimizeResult.data);
			onOptimizationComplete?.(optimizeResult.data);
		} else {
			setError(optimizeResult.error);
		}

		setIsOptimizing(false);
	}, [config, useResourceConstraint, useMaxOpportunities, organizationId, onOptimizationComplete]);

	// Reset
	const handleReset = useCallback(() => {
		setConfig(DEFAULT_CONFIG);
		setResult(null);
		setError(null);
		setUseResourceConstraint(false);
		setUseMaxOpportunities(false);
	}, []);

	// Selected strategy info
	const selectedStrategy = OPTIMIZATION_STRATEGIES.find(
		s => s.value === config.optimizationType
	);

	return (
		<TooltipProvider>
			<div className={cn("space-y-6", className)}>
				{/* Configuration Card */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sliders className="h-5 w-5 text-primary" />
							Portfolio Optimization
						</CardTitle>
						<CardDescription>
							Configure optimization parameters to prioritize your opportunity portfolio
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-6">
						{/* Strategy Selection */}
						<div className="space-y-3">
							<Label>Optimization Strategy</Label>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								{OPTIMIZATION_STRATEGIES.map((strategy) => {
									const Icon = strategy.icon;
									const isSelected = config.optimizationType === strategy.value;

									return (
										<button
											key={strategy.value}
											type="button"
											onClick={() => updateConfig("optimizationType", strategy.value)}
											className={cn(
												"flex flex-col items-start p-4 rounded-lg border text-left transition-all",
												isSelected
													? "border-primary bg-primary/5 ring-1 ring-primary"
													: "border-border hover:border-primary/50"
											)}
										>
											<div className="flex items-center gap-2 mb-2">
												<Icon className={cn(
													"h-5 w-5",
													isSelected ? "text-primary" : "text-muted-foreground"
												)} />
												<span className="font-medium">{strategy.label}</span>
											</div>
											<p className="text-xs text-muted-foreground">
												{strategy.description}
											</p>
										</button>
									);
								})}
							</div>
						</div>

						<Separator />

						{/* Constraints */}
						<div className="space-y-4">
							<Label className="text-base">Constraints</Label>

							{/* Minimum PWin */}
							<div className="space-y-2">
								<div className="flex justify-between">
									<Label htmlFor="min-pwin">Minimum PWin Threshold</Label>
									<span className="text-sm font-medium">{config.minPwin}%</span>
								</div>
								<Slider
									id="min-pwin"
									value={[config.minPwin]}
									onValueChange={([value]) => updateConfig("minPwin", value)}
									min={0}
									max={80}
									step={5}
								/>
								<p className="text-xs text-muted-foreground">
									Only include opportunities with PWin above this threshold
								</p>
							</div>

							{/* Resource Constraint */}
							<div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
								<div className="flex-1">
									<Label htmlFor="use-resource" className="cursor-pointer">
										Resource Constraint
									</Label>
									<p className="text-xs text-muted-foreground">
										Limit total proposal investment budget
									</p>
								</div>
								<Switch
									id="use-resource"
									checked={useResourceConstraint}
									onCheckedChange={setUseResourceConstraint}
								/>
							</div>

							{useResourceConstraint && (
								<div className="ml-4 space-y-2">
									<Label htmlFor="resource-amount">Budget Amount ($)</Label>
									<Input
										id="resource-amount"
										type="number"
										value={config.resourceConstraint ?? ""}
										onChange={(e) => updateConfig("resourceConstraint", e.target.value ? parseInt(e.target.value) : null)}
										placeholder="e.g., 1000000"
									/>
								</div>
							)}

							{/* Max Opportunities */}
							<div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
								<div className="flex-1">
									<Label htmlFor="use-max-opp" className="cursor-pointer">
										Maximum Opportunities
									</Label>
									<p className="text-xs text-muted-foreground">
										Limit the number of opportunities to pursue
									</p>
								</div>
								<Switch
									id="use-max-opp"
									checked={useMaxOpportunities}
									onCheckedChange={setUseMaxOpportunities}
								/>
							</div>

							{useMaxOpportunities && (
								<div className="ml-4 space-y-2">
									<Label htmlFor="max-opp-count">Maximum Count</Label>
									<Input
										id="max-opp-count"
										type="number"
										value={config.maxOpportunities ?? ""}
										onChange={(e) => updateConfig("maxOpportunities", e.target.value ? parseInt(e.target.value) : null)}
										placeholder="e.g., 10"
										min={1}
									/>
								</div>
							)}
						</div>
					</CardContent>

					<CardFooter className="flex justify-between border-t pt-6">
						<Button variant="outline" onClick={handleReset}>
							Reset
						</Button>
						<Button onClick={runOptimization} disabled={isOptimizing}>
							{isOptimizing ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Optimizing...
								</>
							) : (
								<>
									<Play className="h-4 w-4 mr-2" />
									Run Optimization
								</>
							)}
						</Button>
					</CardFooter>
				</Card>

				{/* Error Display */}
				{error && (
					<Card className="border-destructive/50 bg-destructive/10">
						<CardContent className="flex items-center gap-3 pt-6">
							<AlertCircle className="h-5 w-5 text-destructive" />
							<span className="text-sm text-destructive">{error}</span>
						</CardContent>
					</Card>
				)}

				{/* Results */}
				{result && (
					<OptimizationResults
						result={result}
						strategy={config.optimizationType}
						onOpportunitySelect={onOpportunitySelect}
					/>
				)}
			</div>
		</TooltipProvider>
	);
}

// ============================================================================
// Results Sub-Component
// ============================================================================

interface OptimizationResultsProps {
	result: PortfolioOptimization;
	strategy: OptimizationType;
	onOpportunitySelect?: (opportunityId: string) => void;
}

function OptimizationResults({
	result,
	strategy,
	onOpportunitySelect,
}: OptimizationResultsProps) {
	// Map from database schema shape to component needs
	const opportunitiesData = result.selectedOpportunities ?? [];
	const selectedOpportunityIds = opportunitiesData.map(o => o.opportunityId);
	const rankings = opportunitiesData;
	const metrics = {
		totalValue: opportunitiesData.reduce((sum, o) => sum + (o.value ?? 0), 0),
		expectedValue: result.totalExpectedValue ?? 0,
		averagePwin: result.portfolioPwin ?? 0,
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<BarChart3 className="h-5 w-5 text-primary" />
					Optimization Results
				</CardTitle>
				<CardDescription>
					{selectedOpportunityIds.length} opportunities selected for prioritization
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Summary Metrics */}
				{metrics && (
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="p-4 bg-muted/30 rounded-lg text-center">
							<div className="text-2xl font-bold text-primary">
								{selectedOpportunityIds.length}
							</div>
							<div className="text-xs text-muted-foreground">
								Selected Opportunities
							</div>
						</div>
						<div className="p-4 bg-muted/30 rounded-lg text-center">
							<div className="text-2xl font-bold">
								{formatCurrency(metrics.totalValue ?? 0)}
							</div>
							<div className="text-xs text-muted-foreground">
								Total Pipeline Value
							</div>
						</div>
						<div className="p-4 bg-muted/30 rounded-lg text-center">
							<div className="text-2xl font-bold text-green-600">
								{formatCurrency(metrics.expectedValue ?? 0)}
							</div>
							<div className="text-xs text-muted-foreground">
								Expected Value (PWin-weighted)
							</div>
						</div>
						<div className="p-4 bg-muted/30 rounded-lg text-center">
							<div className="text-2xl font-bold">
								{(metrics.averagePwin ?? 0).toFixed(0)}%
							</div>
							<div className="text-xs text-muted-foreground">
								Average PWin
							</div>
						</div>
					</div>
				)}

				<Separator />

				{/* Rankings */}
				<div className="space-y-3">
					<h4 className="font-medium">Priority Rankings</h4>

					{rankings.length > 0 ? (
						<div className="space-y-2">
							{rankings.map((opp, idx) => {
								const isSelected = selectedOpportunityIds.includes(opp.opportunityId);

								return (
									<div
										key={opp.opportunityId}
										className={cn(
											"flex items-center gap-3 p-3 rounded-lg transition-colors",
											isSelected
												? "bg-primary/5 border border-primary/20"
												: "bg-muted/30 border border-transparent",
											onOpportunitySelect && "cursor-pointer hover:bg-muted/50"
										)}
										onClick={() => onOpportunitySelect?.(opp.opportunityId)}
									>
										{/* Rank Badge */}
										<div className={cn(
											"flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
											isSelected
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground"
										)}>
											{idx + 1}
										</div>

										{/* Opportunity Info */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="font-medium truncate">
													{opp.opportunityName}
												</span>
												{isSelected && (
													<CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
												)}
											</div>
											<div className="flex items-center gap-3 text-xs text-muted-foreground">
												<span>{formatCurrency(opp.value)}</span>
												<span>|</span>
												<span>EV: {formatCurrency(opp.expectedValue)}</span>
											</div>
										</div>

										{/* PWin */}
										<div className="text-right">
											<div className={cn("text-lg font-bold", getPwinColor(opp.pwin))}>
												{opp.pwin}%
											</div>
											<div className="text-xs text-muted-foreground">PWin</div>
										</div>

										{/* Arrow */}
										{onOpportunitySelect && (
											<ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							No opportunities match the optimization criteria
						</div>
					)}
				</div>

			</CardContent>
		</Card>
	);
}

export default PortfolioOptimizer;
