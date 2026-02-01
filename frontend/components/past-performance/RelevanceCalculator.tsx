/**
 * Relevance Calculator Component
 *
 * Calculates and displays relevance scores between past performance projects
 * and opportunity requirements with detailed scoring breakdown.
 */

"use client";

import { useState, useCallback } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Calculator,
	Target,
	Calendar,
	DollarSign,
	Building2,
	Wrench,
	Star,
	AlertTriangle,
	CheckCircle,
	TrendingUp,
	Settings,
	RefreshCw,
	Info,
	Loader2,
	ChevronRight,
	Lightbulb,
} from "lucide-react";
import type { Project, ProjectRelevanceScore } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface RelevanceWeights {
	recency: number;
	size: number;
	scope: number;
	customer: number;
	complexity: number;
	performance: number;
}

interface OpportunityContext {
	id: string;
	title: string;
	customer?: string;
	estimatedValue?: number;
	technicalAreas?: string[];
	requirements?: string[];
	naicsCode?: string;
}

interface Gap {
	area: string;
	severity: "critical" | "moderate" | "minor";
	mitigation?: string;
}

interface RelevanceCalculatorProps {
	project: Project;
	opportunity?: OpportunityContext;
	existingScore?: ProjectRelevanceScore;
	onCalculate: (weights: RelevanceWeights) => Promise<ProjectRelevanceScore>;
	onSaveScore?: (score: ProjectRelevanceScore) => Promise<void>;
	isCalculating?: boolean;
}

// ============================================================================
// Default Weights
// ============================================================================

const DEFAULT_WEIGHTS: RelevanceWeights = {
	recency: 20,
	size: 15,
	scope: 25,
	customer: 15,
	complexity: 10,
	performance: 15,
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Score gauge visualization
 */
function ScoreGauge({ score, label }: { score: number; label: string }) {
	const getColor = (s: number) => {
		if (s >= 80) return "text-emerald-600";
		if (s >= 60) return "text-green-600";
		if (s >= 40) return "text-yellow-600";
		if (s >= 20) return "text-orange-600";
		return "text-red-600";
	};

	const getBgColor = (s: number) => {
		if (s >= 80) return "bg-emerald-500";
		if (s >= 60) return "bg-green-500";
		if (s >= 40) return "bg-yellow-500";
		if (s >= 20) return "bg-orange-500";
		return "bg-red-500";
	};

	return (
		<div className="text-center">
			<div className="relative w-24 h-24 mx-auto">
				<svg className="w-24 h-24 transform -rotate-90">
					<circle
						cx="48"
						cy="48"
						r="40"
						stroke="currentColor"
						strokeWidth="8"
						fill="none"
						className="text-muted"
					/>
					<circle
						cx="48"
						cy="48"
						r="40"
						stroke="currentColor"
						strokeWidth="8"
						fill="none"
						strokeDasharray={`${(score / 100) * 251.2} 251.2`}
						strokeLinecap="round"
						className={getColor(score)}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className={`text-2xl font-bold ${getColor(score)}`}>
						{score.toFixed(0)}
					</span>
				</div>
			</div>
			<p className="text-sm text-muted-foreground mt-2">{label}</p>
		</div>
	);
}

/**
 * Component score breakdown bar
 */
function ScoreBreakdownBar({
	label,
	score,
	weight,
	description,
	icon: Icon,
}: {
	label: string;
	score: number;
	weight: number;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
}) {
	const weightedScore = (score * weight) / 100;

	const getColor = (s: number) => {
		if (s >= 80) return "bg-emerald-500";
		if (s >= 60) return "bg-green-500";
		if (s >= 40) return "bg-yellow-500";
		if (s >= 20) return "bg-orange-500";
		return "bg-red-500";
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="space-y-1">
						<div className="flex items-center justify-between text-sm">
							<div className="flex items-center gap-2">
								<Icon className="h-4 w-4 text-muted-foreground" />
								<span>{label}</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground text-xs">
									({weight}% weight)
								</span>
								<span className="font-medium">{score.toFixed(0)}</span>
							</div>
						</div>
						<div className="relative h-2 bg-muted rounded-full overflow-hidden">
							<div
								className={`absolute inset-y-0 left-0 ${getColor(score)} transition-all duration-300`}
								style={{ width: `${score}%` }}
							/>
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent side="right">
					<p className="font-medium">{label}</p>
					<p className="text-xs">{description}</p>
					<p className="text-xs mt-1">
						Contributes {weightedScore.toFixed(1)} points to overall score
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Weight adjustment slider
 */
function WeightSlider({
	label,
	value,
	onChange,
	description,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	description: string;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="text-sm">{label}</Label>
				<span className="text-sm font-medium">{value}%</span>
			</div>
			<Slider
				value={[value]}
				min={0}
				max={50}
				step={5}
				onValueChange={([v]) => onChange(v)}
			/>
			<p className="text-xs text-muted-foreground">{description}</p>
		</div>
	);
}

/**
 * Gap indicator
 */
function GapIndicator({ gap }: { gap: Gap }) {
	const config = {
		critical: {
			icon: AlertTriangle,
			color: "text-red-600 bg-red-50 border-red-200",
		},
		moderate: {
			icon: Info,
			color: "text-yellow-600 bg-yellow-50 border-yellow-200",
		},
		minor: {
			icon: Lightbulb,
			color: "text-blue-600 bg-blue-50 border-blue-200",
		},
	};

	const { icon: Icon, color } = config[gap.severity];

	return (
		<div className={`p-3 border rounded-lg ${color}`}>
			<div className="flex items-start gap-2">
				<Icon className="h-4 w-4 mt-0.5" />
				<div className="flex-1">
					<p className="font-medium text-sm">{gap.area}</p>
					{gap.mitigation && (
						<p className="text-xs mt-1 opacity-80">{gap.mitigation}</p>
					)}
				</div>
				<Badge
					variant="outline"
					className={`text-xs ${
						gap.severity === "critical"
							? "border-red-300"
							: gap.severity === "moderate"
								? "border-yellow-300"
								: "border-blue-300"
					}`}
				>
					{gap.severity}
				</Badge>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function RelevanceCalculator({
	project,
	opportunity,
	existingScore,
	onCalculate,
	onSaveScore,
	isCalculating = false,
}: RelevanceCalculatorProps) {
	const [weights, setWeights] = useState<RelevanceWeights>(DEFAULT_WEIGHTS);
	const [showWeights, setShowWeights] = useState(false);
	const [score, setScore] = useState<ProjectRelevanceScore | null>(
		existingScore || null
	);

	// Update weight
	const updateWeight = useCallback((field: keyof RelevanceWeights, value: number) => {
		setWeights((prev) => {
			// Normalize other weights to maintain 100% total
			const oldValue = prev[field];
			const diff = value - oldValue;
			const otherFields = Object.keys(prev).filter(
				(k) => k !== field
			) as (keyof RelevanceWeights)[];
			const otherTotal = otherFields.reduce((sum, k) => sum + prev[k], 0);

			const newWeights = { ...prev, [field]: value };

			if (otherTotal > 0) {
				const scaleFactor = (otherTotal - diff) / otherTotal;
				otherFields.forEach((k) => {
					newWeights[k] = Math.max(0, Math.round(prev[k] * scaleFactor));
				});
			}

			return newWeights;
		});
	}, []);

	// Reset weights
	const resetWeights = useCallback(() => {
		setWeights(DEFAULT_WEIGHTS);
	}, []);

	// Calculate score
	const handleCalculate = useCallback(async () => {
		const result = await onCalculate(weights);
		setScore(result);
	}, [weights, onCalculate]);

	// Get scores from result
	const scores = score
		? {
				overall: score.overallScore,
				recency: score.recencyScore || 0,
				size: score.sizeScore || 0,
				scope: score.scopeScore || 0,
				customer: score.customerScore || 0,
				complexity: score.complexityScore || 0,
				performance: score.performanceScore || 0,
			}
		: null;

	const gaps = (score?.gaps || []) as Gap[];
	const matchingAreas = (score?.matchingTechnicalAreas || []) as string[];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Calculator className="h-5 w-5" />
							Relevance Calculator
						</CardTitle>
						<CardDescription>
							Calculate how well this project matches{" "}
							{opportunity ? `"${opportunity.title}"` : "opportunity requirements"}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowWeights(!showWeights)}
						>
							<Settings className="h-4 w-4 mr-1" />
							Weights
						</Button>
						<Button
							onClick={handleCalculate}
							disabled={isCalculating}
						>
							{isCalculating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Calculating...
								</>
							) : (
								<>
									<Calculator className="h-4 w-4 mr-2" />
									Calculate
								</>
							)}
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Weight Configuration (Collapsible) */}
				{showWeights && (
					<Card>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Scoring Weights</CardTitle>
								<Button variant="ghost" size="sm" onClick={resetWeights}>
									<RefreshCw className="h-4 w-4 mr-1" />
									Reset
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<WeightSlider
								label="Recency"
								value={weights.recency}
								onChange={(v) => updateWeight("recency", v)}
								description="How recently the project was completed"
							/>
							<WeightSlider
								label="Size/Value"
								value={weights.size}
								onChange={(v) => updateWeight("size", v)}
								description="Contract value relative to opportunity"
							/>
							<WeightSlider
								label="Scope Match"
								value={weights.scope}
								onChange={(v) => updateWeight("scope", v)}
								description="Technical scope and requirements alignment"
							/>
							<WeightSlider
								label="Customer Similarity"
								value={weights.customer}
								onChange={(v) => updateWeight("customer", v)}
								description="Same or similar customer/agency"
							/>
							<WeightSlider
								label="Complexity"
								value={weights.complexity}
								onChange={(v) => updateWeight("complexity", v)}
								description="Project complexity alignment"
							/>
							<WeightSlider
								label="Performance"
								value={weights.performance}
								onChange={(v) => updateWeight("performance", v)}
								description="CPAR ratings and outcomes"
							/>

							<div className="pt-2 border-t">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium">Total Weight</span>
									<span
										className={
											Object.values(weights).reduce((a, b) => a + b, 0) === 100
												? "text-green-600"
												: "text-yellow-600"
										}
									>
										{Object.values(weights).reduce((a, b) => a + b, 0)}%
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Score Results */}
				{scores ? (
					<div className="space-y-6">
						{/* Overall Score */}
						<div className="flex items-center justify-center py-6 bg-muted/50 rounded-lg">
							<ScoreGauge score={scores.overall} label="Overall Relevance" />
						</div>

						{/* Component Scores */}
						<div className="space-y-3">
							<h4 className="font-medium text-sm">Score Breakdown</h4>
							<ScoreBreakdownBar
								label="Recency"
								score={scores.recency}
								weight={weights.recency}
								description="Based on project end date"
								icon={Calendar}
							/>
							<ScoreBreakdownBar
								label="Size/Value"
								score={scores.size}
								weight={weights.size}
								description="Contract value comparison"
								icon={DollarSign}
							/>
							<ScoreBreakdownBar
								label="Scope Match"
								score={scores.scope}
								weight={weights.scope}
								description="Technical areas and requirements"
								icon={Target}
							/>
							<ScoreBreakdownBar
								label="Customer Similarity"
								score={scores.customer}
								weight={weights.customer}
								description="Customer/agency alignment"
								icon={Building2}
							/>
							<ScoreBreakdownBar
								label="Complexity"
								score={scores.complexity}
								weight={weights.complexity}
								description="Project complexity match"
								icon={Wrench}
							/>
							<ScoreBreakdownBar
								label="Performance"
								score={scores.performance}
								weight={weights.performance}
								description="CPAR and outcomes"
								icon={Star}
							/>
						</div>

						{/* Matching Areas */}
						{matchingAreas.length > 0 && (
							<div className="space-y-2">
								<h4 className="font-medium text-sm flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-600" />
									Matching Technical Areas
								</h4>
								<div className="flex flex-wrap gap-2">
									{matchingAreas.map((area) => (
										<Badge key={area} variant="secondary">
											{area}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Gaps */}
						{gaps.length > 0 && (
							<div className="space-y-3">
								<h4 className="font-medium text-sm flex items-center gap-2">
									<AlertTriangle className="h-4 w-4 text-yellow-600" />
									Identified Gaps ({gaps.length})
								</h4>
								<div className="space-y-2">
									{gaps.map((gap, index) => (
										<GapIndicator key={index} gap={gap} />
									))}
								</div>
							</div>
						)}

						{/* Generated Narrative Preview */}
						{score?.relevanceNarrative && (
							<Accordion type="single" collapsible>
								<AccordionItem value="narrative">
									<AccordionTrigger className="text-sm">
										<div className="flex items-center gap-2">
											<TrendingUp className="h-4 w-4" />
											Generated Relevance Narrative
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap">
											{score.relevanceNarrative}
										</p>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						)}

						{/* Save Action */}
						{onSaveScore && score && (
							<div className="flex justify-end pt-4 border-t">
								<Button onClick={() => onSaveScore(score)}>
									Save Relevance Score
								</Button>
							</div>
						)}
					</div>
				) : (
					<div className="text-center py-12 text-muted-foreground">
						<Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
						<p className="text-lg font-medium mb-2">No score calculated yet</p>
						<p className="text-sm">
							Click "Calculate" to analyze relevance to{" "}
							{opportunity ? "this opportunity" : "requirements"}
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default RelevanceCalculator;
