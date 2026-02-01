/**
 * HoursEstimator - AI-Powered Hours Estimation
 *
 * Generates labor hour estimates using AI based on section content,
 * complexity level, and available labor categories.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Clock,
	Sparkles,
	AlertCircle,
	Loader2,
	Check,
	ChevronDown,
	Info,
	Gauge,
	Users,
	FileText,
	Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { HoursEstimate, ComplexityLevel } from "@/lib/types/pricing";
import { estimateHoursFromTechnical } from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface HoursEstimatorProps {
	/** Section ID to estimate for (optional) */
	sectionId?: string;
	/** Section text to analyze (if sectionId not provided) */
	sectionText?: string;
	/** Section name for display */
	sectionName?: string;
	/** Opportunity ID for context */
	opportunityId?: string;
	/** Callback when estimates are applied */
	onApply?: (estimates: HoursEstimate) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const COMPLEXITY_CONFIG: Record<
	ComplexityLevel,
	{ label: string; description: string; color: string }
> = {
	simple: {
		label: "Simple",
		description: "Straightforward tasks with clear requirements",
		color: "text-green-600",
	},
	moderate: {
		label: "Moderate",
		description: "Some complexity, standard methodologies",
		color: "text-blue-600",
	},
	complex: {
		label: "Complex",
		description: "Significant complexity, custom solutions",
		color: "text-amber-600",
	},
	highly_complex: {
		label: "Highly Complex",
		description: "Cutting-edge, novel approaches required",
		color: "text-red-600",
	},
};

const LABOR_LEVEL_COLORS: Record<string, string> = {
	junior: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	mid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	senior: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
	principal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	executive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatNumber(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

function formatConfidence(value: number): string {
	if (value >= 0.8) return "High";
	if (value >= 0.6) return "Medium";
	return "Low";
}

function getConfidenceColor(value: number): string {
	if (value >= 0.8) return "text-green-600";
	if (value >= 0.6) return "text-amber-600";
	return "text-red-600";
}

// =============================================================================
// Confidence Indicator
// =============================================================================

interface ConfidenceIndicatorProps {
	confidence: number;
}

function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
	const percentage = Math.round(confidence * 100);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-2">
						<Gauge className={cn("h-4 w-4", getConfidenceColor(confidence))} />
						<span className={cn("text-sm font-medium", getConfidenceColor(confidence))}>
							{formatConfidence(confidence)}
						</span>
						<Progress value={percentage} className="w-16 h-2" />
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>Confidence: {percentage}%</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =============================================================================
// Labor Category Estimate Row
// =============================================================================

/** Category estimate matching actual HoursEstimate.byCategory shape */
interface CategoryEstimate {
	categoryId: string;
	categoryName: string;
	hours: number;
	confidence: number;
	rationale: string;
}

interface SimplifiedEstimateRowProps {
	estimate: CategoryEstimate;
	isExpanded: boolean;
	onToggle: () => void;
}

function EstimateRow({ estimate, isExpanded, onToggle }: SimplifiedEstimateRowProps) {
	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<div className="border rounded-lg">
				<CollapsibleTrigger asChild>
					<button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
						<div className="flex items-center gap-3">
							<Users className="h-4 w-4 text-muted-foreground" />
							<div className="text-left">
								<div className="font-medium">{estimate.categoryName}</div>
							</div>
						</div>
						<div className="flex items-center gap-4">
							<div className="text-right">
								<div className="text-lg font-semibold">
									{formatNumber(estimate.hours)} hrs
								</div>
								<ConfidenceIndicator confidence={estimate.confidence} />
							</div>
							<ChevronDown
								className={cn(
									"h-4 w-4 transition-transform",
									isExpanded && "transform rotate-180"
								)}
							/>
						</div>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="px-3 pb-3 pt-0 border-t">
						<div className="mt-3 p-3 bg-muted/50 rounded-lg">
							<div className="flex items-start gap-2">
								<Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
								<div className="text-sm text-muted-foreground">
									{estimate.rationale || "No rationale provided"}
								</div>
							</div>
						</div>
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function HoursEstimator({
	sectionId,
	sectionText,
	sectionName,
	opportunityId,
	onApply,
	className,
}: HoursEstimatorProps) {
	// State
	const [complexity, setComplexity] = useState<ComplexityLevel>("moderate");
	const [estimate, setEstimate] = useState<HoursEstimate | null>(null);
	const [isEstimating, setIsEstimating] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

	// Toggle row expansion
	const toggleRow = useCallback((categoryId: string) => {
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(categoryId)) {
				next.delete(categoryId);
			} else {
				next.add(categoryId);
			}
			return next;
		});
	}, []);

	// Handle estimate
	const handleEstimate = useCallback(async () => {
		if (!sectionId) {
			setError("No technical section specified");
			return;
		}

		setIsEstimating(true);
		setError(null);

		const result = await estimateHoursFromTechnical(sectionId);

		if (result.success) {
			setEstimate(result.data);
		} else {
			setError(result.error);
		}

		setIsEstimating(false);
	}, [sectionId]);

	// Handle apply - just calls the onApply callback (cost element creation handled by parent)
	const handleApply = useCallback(async () => {
		if (!estimate) return;

		setIsApplying(true);
		// The parent component handles creating cost elements from the estimate
		onApply?.(estimate);
		setIsApplying(false);
	}, [estimate, onApply]);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Clock className="h-5 w-5" />
					Hours Estimator
					<Badge variant="secondary" className="gap-1">
						<Sparkles className="h-3 w-3" />
						AI-Powered
					</Badge>
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Section Info */}
				{sectionName && (
					<div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
						<FileText className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm">
							Estimating for: <span className="font-medium">{sectionName}</span>
						</span>
					</div>
				)}

				{/* Complexity Selector */}
				<div className="space-y-2">
					<Label>Complexity Level</Label>
					<Select
						value={complexity}
						onValueChange={(v) => setComplexity(v as ComplexityLevel)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(COMPLEXITY_CONFIG).map(([value, config]) => (
								<SelectItem key={value} value={value}>
									<div className="flex items-center gap-2">
										<span className={config.color}>{config.label}</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						{COMPLEXITY_CONFIG[complexity].description}
					</p>
				</div>

				{/* Estimate Button */}
				<Button
					onClick={handleEstimate}
					disabled={isEstimating}
					className="w-full"
				>
					{isEstimating ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Generating Estimate...
						</>
					) : (
						<>
							<Sparkles className="h-4 w-4 mr-2" />
							Generate Estimate
						</>
					)}
				</Button>

				{/* Error */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Results */}
				{estimate && (
					<div className="space-y-4">
						<Separator />

						{/* Summary */}
						<div className="p-4 bg-primary/10 rounded-lg">
							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm text-muted-foreground">Total Estimated Hours</div>
									<div className="text-3xl font-bold">
										{formatNumber(estimate.totalHours)} hrs
									</div>
								</div>
							</div>
						</div>

						{/* Estimates by Category */}
						<div className="space-y-2">
							<h4 className="font-medium flex items-center gap-2">
								<Calculator className="h-4 w-4" />
								Breakdown by Labor Category
							</h4>
							{estimate.byCategory.map((cat) => (
								<EstimateRow
									key={cat.categoryId}
									estimate={cat}
									isExpanded={expandedRows.has(cat.categoryId)}
									onToggle={() => toggleRow(cat.categoryId)}
								/>
							))}
						</div>

						{/* Assumptions */}
						{estimate.assumptions && estimate.assumptions.length > 0 && (
							<div className="space-y-2">
								<h4 className="font-medium flex items-center gap-2">
									<Info className="h-4 w-4" />
									Assumptions
								</h4>
								<ul className="space-y-1 text-sm text-muted-foreground">
									{estimate.assumptions.map((assumption, idx) => (
										<li key={idx} className="flex items-start gap-2">
											<Check className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
											{assumption}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Methodology */}
						{estimate.methodology && (
							<div className="space-y-2">
								<h4 className="font-medium flex items-center gap-2">
									<Info className="h-4 w-4" />
									Methodology
								</h4>
								<p className="text-sm text-muted-foreground">
									{estimate.methodology}
								</p>
							</div>
						)}

						{/* Apply Button */}
						<Button
							onClick={handleApply}
							disabled={isApplying}
							variant="outline"
							className="w-full"
						>
							{isApplying ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Applying...
								</>
							) : (
								<>
									<Check className="h-4 w-4 mr-2" />
									Apply to Cost Elements
								</>
							)}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default HoursEstimator;
