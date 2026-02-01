/**
 * CostRealismPanel - Cost Realism Analysis Display
 *
 * Displays cost realism assessment with factor breakdown,
 * risk analysis, and generated narrative.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	ShieldCheck,
	AlertTriangle,
	AlertCircle,
	CheckCircle2,
	RefreshCw,
	Loader2,
	ChevronDown,
	ChevronRight,
	FileText,
	Lightbulb,
	Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	CostRealismAnalysis as ActionCostRealismAnalysis,
	CostRealismAnalysisUI,
	CostRealismFactor,
	CostRealismRiskItem,
	CostRealismRisk,
} from "@/lib/types/pricing";
import { analyzeCostRealism } from "@/lib/actions/pricing";

// Transform server action result to UI-friendly structure
function transformToUIAnalysis(
	opportunityId: string,
	data: ActionCostRealismAnalysis
): CostRealismAnalysisUI {
	// Map overall assessment to risk level
	const assessmentToRisk: Record<ActionCostRealismAnalysis["overallAssessment"], CostRealismRisk> = {
		realistic: "low",
		potentially_understated: "high",
		potentially_overstated: "medium",
	};

	// Transform factors from object to array
	const factors: CostRealismFactor[] = [
		{
			name: "Labor Rates",
			category: "labor",
			score: 80, // Default scores since action doesn't provide them
			maxScore: 100,
			findings: [data.factors.laborRates.assessment],
			risks: data.factors.laborRates.marketComparison ? [data.factors.laborRates.marketComparison] : [],
		},
		{
			name: "Labor Hours",
			category: "labor",
			score: 75,
			maxScore: 100,
			findings: [data.factors.laborHours.assessment],
			risks: data.factors.laborHours.scopeAlignment ? [data.factors.laborHours.scopeAlignment] : [],
		},
		{
			name: "Other Direct Costs",
			category: "market",
			score: 85,
			maxScore: 100,
			findings: [data.factors.odcs.assessment],
			risks: data.factors.odcs.marketPricing ? [data.factors.odcs.marketPricing] : [],
		},
		{
			name: "Indirect Rates",
			category: "rates",
			score: 90,
			maxScore: 100,
			findings: [data.factors.indirectRates.assessment],
			risks: data.factors.indirectRates.industryComparison ? [data.factors.indirectRates.industryComparison] : [],
		},
	];

	// Transform risks
	const risks: CostRealismRiskItem[] = data.risks.map((r, idx) => ({
		id: `risk-${idx}`,
		category: "general",
		description: r.risk,
		impact: r.impact as "low" | "medium" | "high",
		likelihood: r.likelihood as "low" | "medium" | "high",
		riskLevel: r.likelihood === "high" && r.impact === "high" ? "critical"
			: r.likelihood === "high" || r.impact === "high" ? "high"
			: r.likelihood === "medium" || r.impact === "medium" ? "medium"
			: "low",
		mitigation: r.mitigation || null,
	}));

	return {
		opportunityId,
		overallAssessment: assessmentToRisk[data.overallAssessment],
		overallScore: data.score,
		factors,
		risks,
		narrative: data.narrative,
		recommendations: [], // Action doesn't return recommendations
		analyzedAt: new Date(),
	};
}

// Use the UI type for component state
type CostRealismAnalysis = CostRealismAnalysisUI;

// =============================================================================
// Types
// =============================================================================

export interface CostRealismPanelProps {
	/** Opportunity ID to analyze */
	opportunityId: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RISK_CONFIG: Record<
	CostRealismRisk,
	{ label: string; icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
	low: {
		label: "Low Risk",
		icon: CheckCircle2,
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	medium: {
		label: "Medium Risk",
		icon: AlertTriangle,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	high: {
		label: "High Risk",
		icon: AlertCircle,
		color: "text-orange-600 dark:text-orange-400",
		bgColor: "bg-orange-100 dark:bg-orange-900/30",
	},
	critical: {
		label: "Critical Risk",
		icon: AlertCircle,
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
};

const CATEGORY_LABELS: Record<string, string> = {
	labor: "Labor Rates & Mix",
	rates: "Indirect Rates",
	assumptions: "Assumptions & Methodology",
	completeness: "Estimate Completeness",
	market: "Market Alignment",
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function CostRealismSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-32 w-full" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Assessment Badge
// =============================================================================

interface AssessmentBadgeProps {
	assessment: CostRealismRisk;
	large?: boolean;
}

function AssessmentBadge({ assessment, large = false }: AssessmentBadgeProps) {
	const config = RISK_CONFIG[assessment];
	const Icon = config.icon;

	return (
		<Badge
			variant="secondary"
			className={cn(
				"gap-1",
				config.bgColor,
				config.color,
				large && "text-lg px-4 py-2"
			)}
		>
			<Icon className={cn("h-4 w-4", large && "h-5 w-5")} />
			{config.label}
		</Badge>
	);
}

// =============================================================================
// Score Gauge
// =============================================================================

interface ScoreGaugeProps {
	score: number;
	assessment: CostRealismRisk;
}

function ScoreGauge({ score, assessment }: ScoreGaugeProps) {
	const config = RISK_CONFIG[assessment];

	return (
		<div className="flex items-center gap-4">
			<div className="relative w-24 h-24">
				<svg viewBox="0 0 100 100" className="transform -rotate-90">
					<circle
						cx="50"
						cy="50"
						r="40"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						className="text-muted"
					/>
					<circle
						cx="50"
						cy="50"
						r="40"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						strokeLinecap="round"
						strokeDasharray={`${(score / 100) * 251.3} 251.3`}
						className={config.color}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className={cn("text-2xl font-bold", config.color)}>{score}</span>
				</div>
			</div>
			<div>
				<AssessmentBadge assessment={assessment} large />
				<div className="text-sm text-muted-foreground mt-1">Realism Score</div>
			</div>
		</div>
	);
}

// =============================================================================
// Factor Card
// =============================================================================

interface FactorCardProps {
	factor: CostRealismFactor;
	isExpanded: boolean;
	onToggle: () => void;
}

function FactorCard({ factor, isExpanded, onToggle }: FactorCardProps) {
	const percentage = (factor.score / factor.maxScore) * 100;
	const getRiskLevel = (): CostRealismRisk => {
		if (percentage >= 80) return "low";
		if (percentage >= 60) return "medium";
		if (percentage >= 40) return "high";
		return "critical";
	};

	const riskConfig = RISK_CONFIG[getRiskLevel()];

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<div className="border rounded-lg">
				<CollapsibleTrigger asChild>
					<button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
						<div className="flex items-center gap-3">
							<div className={cn("p-2 rounded", riskConfig.bgColor)}>
								<ShieldCheck className={cn("h-4 w-4", riskConfig.color)} />
							</div>
							<div className="text-left">
								<div className="font-medium">{factor.name}</div>
								<div className="text-xs text-muted-foreground capitalize">
									{CATEGORY_LABELS[factor.category] || factor.category}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-4">
							<div className="w-24">
								<Progress value={percentage} className="h-2" />
							</div>
							<span className={cn("font-mono", riskConfig.color)}>
								{factor.score}/{factor.maxScore}
							</span>
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</div>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="px-3 pb-3 pt-0 border-t space-y-3">
						{factor.findings.length > 0 && (
							<div className="mt-3">
								<div className="text-sm font-medium mb-2">Findings</div>
								<ul className="space-y-1">
									{factor.findings.map((finding, idx) => (
										<li key={idx} className="flex items-start gap-2 text-sm">
											<Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
											{finding}
										</li>
									))}
								</ul>
							</div>
						)}
						{factor.risks.length > 0 && (
							<div>
								<div className="text-sm font-medium mb-2">Risks</div>
								<ul className="space-y-1">
									{factor.risks.map((risk, idx) => (
										<li key={idx} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
											<AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
											{risk}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

// =============================================================================
// Risk Table
// =============================================================================

interface RiskTableProps {
	risks: CostRealismRiskItem[];
}

function RiskTable({ risks }: RiskTableProps) {
	if (risks.length === 0) {
		return (
			<div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
				<CheckCircle2 className="h-5 w-5 text-green-600" />
				<span className="text-green-800 dark:text-green-300">
					No significant risks identified
				</span>
			</div>
		);
	}

	return (
		<div className="border rounded-lg overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Risk</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Impact</TableHead>
						<TableHead>Likelihood</TableHead>
						<TableHead>Level</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{risks.map((risk) => {
						const riskConfig = RISK_CONFIG[risk.riskLevel];

						return (
							<TableRow key={risk.id}>
								<TableCell>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="cursor-help">
													{risk.description.length > 50
														? `${risk.description.substring(0, 50)}...`
														: risk.description}
												</span>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">
												<p>{risk.description}</p>
												{risk.mitigation && (
													<p className="mt-2 text-green-300">
														Mitigation: {risk.mitigation}
													</p>
												)}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</TableCell>
								<TableCell className="capitalize">{risk.category}</TableCell>
								<TableCell className="capitalize">{risk.impact}</TableCell>
								<TableCell className="capitalize">{risk.likelihood}</TableCell>
								<TableCell>
									<Badge variant="secondary" className={cn("gap-1", riskConfig.bgColor, riskConfig.color)}>
										{riskConfig.label.replace(" Risk", "")}
									</Badge>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CostRealismPanel({
	opportunityId,
	className,
}: CostRealismPanelProps) {
	// State
	const [analysis, setAnalysis] = useState<CostRealismAnalysis | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());

	// Load analysis
	useEffect(() => {
		async function loadAnalysis() {
			setIsLoading(true);
			setError(null);

			const result = await analyzeCostRealism(opportunityId);
			if (result.success && result.data) {
				// Transform server action result to UI structure
				const uiAnalysis = transformToUIAnalysis(opportunityId, result.data);
				setAnalysis(uiAnalysis);
			} else if (!result.success) {
				setError(result.error || "Failed to analyze cost realism");
			}
			setIsLoading(false);
		}
		loadAnalysis();
	}, [opportunityId]);

	// Toggle factor expansion
	const toggleFactor = useCallback((factorName: string) => {
		setExpandedFactors((prev) => {
			const next = new Set(prev);
			if (next.has(factorName)) {
				next.delete(factorName);
			} else {
				next.add(factorName);
			}
			return next;
		});
	}, []);

	// Handle re-analyze
	const handleReanalyze = useCallback(async () => {
		setIsAnalyzing(true);
		const result = await analyzeCostRealism(opportunityId);
		if (result.success && result.data) {
			const uiAnalysis = transformToUIAnalysis(opportunityId, result.data);
			setAnalysis(uiAnalysis);
		}
		setIsAnalyzing(false);
	}, [opportunityId]);

	// Loading state
	if (isLoading) {
		return <CostRealismSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<ShieldCheck className="h-5 w-5" />
						Cost Realism Analysis
					</CardTitle>

					<Button
						variant="outline"
						onClick={handleReanalyze}
						disabled={isAnalyzing}
					>
						{isAnalyzing ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Re-analyze
							</>
						)}
					</Button>
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

				{/* No Data State */}
				{!analysis && !error && (
					<div className="text-center py-12">
						<ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No analysis available</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Add cost elements to enable realism analysis
						</p>
					</div>
				)}

				{/* Analysis Content */}
				{analysis && (
					<>
						{/* Score Gauge */}
						<div className="flex items-center justify-between">
							<ScoreGauge
								score={analysis.overallScore}
								assessment={analysis.overallAssessment}
							/>
							<div className="text-right text-sm text-muted-foreground">
								<div>
									{analysis.factors.filter((f) => f.score >= f.maxScore * 0.8).length} of{" "}
									{analysis.factors.length} factors passing
								</div>
								<div>{analysis.risks.length} risk(s) identified</div>
								<div className="mt-1 text-xs">
									Analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
								</div>
							</div>
						</div>

						<Separator />

						{/* Factor Breakdown */}
						<div>
							<h3 className="font-medium mb-3">Factor Analysis</h3>
							<div className="space-y-2">
								{analysis.factors.map((factor) => (
									<FactorCard
										key={factor.name}
										factor={factor}
										isExpanded={expandedFactors.has(factor.name)}
										onToggle={() => toggleFactor(factor.name)}
									/>
								))}
							</div>
						</div>

						<Separator />

						{/* Risk Table */}
						<div>
							<h3 className="font-medium mb-3 flex items-center gap-2">
								<AlertTriangle className="h-4 w-4" />
								Risk Assessment
								{analysis.risks.length > 0 && (
									<Badge variant="secondary">{analysis.risks.length}</Badge>
								)}
							</h3>
							<RiskTable risks={analysis.risks} />
						</div>

						<Separator />

						{/* Narrative */}
						<div>
							<h3 className="font-medium mb-3 flex items-center gap-2">
								<FileText className="h-4 w-4" />
								Analysis Narrative
							</h3>
							<div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
								{analysis.narrative}
							</div>
						</div>

						{/* Recommendations */}
						{analysis.recommendations.length > 0 && (
							<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
								<div className="flex items-center gap-2 mb-2">
									<Lightbulb className="h-4 w-4 text-blue-600" />
									<span className="font-medium text-blue-800 dark:text-blue-300">
										Recommendations
									</span>
								</div>
								<ul className="space-y-1">
									{analysis.recommendations.map((rec, index) => (
										<li
											key={index}
											className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300"
										>
											<ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
											{rec}
										</li>
									))}
								</ul>
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default CostRealismPanel;
