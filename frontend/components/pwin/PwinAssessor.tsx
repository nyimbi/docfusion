"use client";

/**
 * PWin Assessor Component
 *
 * Main assessment form for scoring PWin factors with interactive sliders
 * and detailed scoring guidelines. Supports initial assessments, mid-capture
 * reviews, final assessments, and gate reviews.
 *
 * Features:
 * - Interactive factor score sliders with real-time PWin calculation
 * - Scoring guidelines tooltip for each factor
 * - Category-based factor grouping
 * - Notes support per factor
 * - Assessment type selection
 * - Confidence interval display
 *
 * @example
 * ```tsx
 * <PwinAssessor
 *   opportunityId="opp-123"
 *   opportunityName="DOD Contract"
 *   initialScores={existingScores}
 *   onAssessmentComplete={(assessment) => console.log(assessment)}
 * />
 * ```
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Target,
	Info,
	Save,
	Loader2,
	ChevronDown,
	ChevronUp,
	AlertCircle,
	CheckCircle2,
	HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
import {
	assessPwin,
	listPwinFactors,
} from "@/lib/actions/pwin";
import type {
	PwinFactor,
	PwinAssessment,
	FactorScore,
	AssessmentType,
	FactorCategory,
} from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface PwinAssessorProps {
	opportunityId: string;
	opportunityName: string;
	organizationId?: string;
	initialScores?: FactorScore[];
	assessedBy?: string;
	onAssessmentComplete?: (assessment: PwinAssessment) => void;
	onCancel?: () => void;
	className?: string;
}

interface FactorScoreState {
	factorId: string;
	factorName: string;
	score: number;
	weight: number;
	notes: string;
	category: FactorCategory;
	guidelines?: Array<{ score: number; description: string }>;
	maxScore: number;
	minScore: number;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<FactorCategory, string> = {
	customer: "Customer Factors",
	solution: "Solution Factors",
	competition: "Competitive Factors",
	team: "Team Factors",
	price: "Price Factors",
	contract: "Contract Factors",
};

const CATEGORY_ORDER: FactorCategory[] = [
	"customer",
	"solution",
	"competition",
	"team",
	"price",
	"contract",
];

const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
	initial: "Initial Assessment",
	mid_capture: "Mid-Capture Review",
	final: "Final Assessment",
	gate_review: "Gate Review",
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculatePwinFromScores(scores: FactorScoreState[]): {
	pwin: number;
	weightedScore: number;
	maxPossibleScore: number;
} {
	if (scores.length === 0) {
		return { pwin: 0, weightedScore: 0, maxPossibleScore: 0 };
	}

	let weightedScore = 0;
	let maxPossibleScore = 0;

	for (const score of scores) {
		weightedScore += score.score * score.weight;
		maxPossibleScore += score.maxScore * score.weight;
	}

	const pwin = maxPossibleScore > 0 ? Math.round((weightedScore / maxPossibleScore) * 100) : 0;

	return { pwin, weightedScore, maxPossibleScore };
}

function getPwinColorClass(pwin: number): string {
	if (pwin >= 70) return "text-green-600 dark:text-green-400";
	if (pwin >= 50) return "text-amber-600 dark:text-amber-400";
	if (pwin >= 30) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

function getScoreColorClass(score: number, maxScore: number): string {
	const percentage = (score / maxScore) * 100;
	if (percentage >= 70) return "bg-green-500";
	if (percentage >= 50) return "bg-amber-500";
	if (percentage >= 30) return "bg-orange-500";
	return "bg-red-500";
}

function getGuidelineForScore(
	score: number,
	guidelines?: Array<{ score: number; description: string }>
): string | null {
	if (!guidelines || guidelines.length === 0) return null;

	// Find closest guideline at or below current score
	const sorted = [...guidelines].sort((a, b) => b.score - a.score);
	for (const guideline of sorted) {
		if (score >= guideline.score) {
			return guideline.description;
		}
	}
	return guidelines[0]?.description || null;
}

// ============================================================================
// Component
// ============================================================================

export function PwinAssessor({
	opportunityId,
	opportunityName,
	organizationId,
	initialScores,
	assessedBy,
	onAssessmentComplete,
	onCancel,
	className,
}: PwinAssessorProps) {
	// State
	const [factors, setFactors] = useState<PwinFactor[]>([]);
	const [scores, setScores] = useState<FactorScoreState[]>([]);
	const [assessmentType, setAssessmentType] = useState<AssessmentType>("initial");
	const [overallNotes, setOverallNotes] = useState("");
	const [expandedCategories, setExpandedCategories] = useState<Set<FactorCategory>>(
		new Set(CATEGORY_ORDER)
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load factors on mount
	useEffect(() => {
		async function loadFactors() {
			setIsLoading(true);
			setError(null);

			const result = await listPwinFactors(organizationId);

			if (result.success) {
				setFactors(result.data);

				// Initialize scores from factors
				const initialScoreMap = new Map(
					initialScores?.map(s => [s.factorId, s]) ?? []
				);

				const newScores: FactorScoreState[] = result.data.map(factor => {
					const existing = initialScoreMap.get(factor.id);
					return {
						factorId: factor.id,
						factorName: factor.factorName,
						score: existing?.score ?? 5,
						weight: factor.weight ?? 1,
						notes: existing?.notes ?? "",
						category: factor.factorCategory as FactorCategory,
						guidelines: factor.scoringGuidelines as Array<{ score: number; description: string }> | undefined,
						maxScore: factor.maxScore ?? 10,
						minScore: factor.minScore ?? 0,
					};
				});

				setScores(newScores);
			} else {
				setError(result.error);
			}

			setIsLoading(false);
		}

		loadFactors();
	}, [organizationId, initialScores]);

	// Calculate current PWin
	const { pwin, weightedScore, maxPossibleScore } = useMemo(
		() => calculatePwinFromScores(scores),
		[scores]
	);

	// Group scores by category
	const scoresByCategory = useMemo(() => {
		const grouped = new Map<FactorCategory, FactorScoreState[]>();

		for (const category of CATEGORY_ORDER) {
			grouped.set(category, []);
		}

		for (const score of scores) {
			const existing = grouped.get(score.category) ?? [];
			existing.push(score);
			grouped.set(score.category, existing);
		}

		// Remove empty categories
		for (const [category, categoryScores] of grouped) {
			if (categoryScores.length === 0) {
				grouped.delete(category);
			}
		}

		return grouped;
	}, [scores]);

	// Update score handler
	const updateScore = useCallback((factorId: string, newScore: number) => {
		setScores(prev =>
			prev.map(s =>
				s.factorId === factorId ? { ...s, score: newScore } : s
			)
		);
	}, []);

	// Update notes handler
	const updateNotes = useCallback((factorId: string, notes: string) => {
		setScores(prev =>
			prev.map(s =>
				s.factorId === factorId ? { ...s, notes } : s
			)
		);
	}, []);

	// Toggle category expansion
	const toggleCategory = useCallback((category: FactorCategory) => {
		setExpandedCategories(prev => {
			const newSet = new Set(prev);
			if (newSet.has(category)) {
				newSet.delete(category);
			} else {
				newSet.add(category);
			}
			return newSet;
		});
	}, []);

	// Submit assessment
	const handleSubmit = useCallback(async () => {
		setIsSaving(true);
		setError(null);

		const factorScores: FactorScore[] = scores.map(s => ({
			factorId: s.factorId,
			factorName: s.factorName,
			score: s.score,
			weight: s.weight,
			notes: s.notes || undefined,
		}));

		const result = await assessPwin(opportunityId, factorScores, {
			assessmentType,
			assessedBy,
			notes: overallNotes || undefined,
			organizationId,
		});

		if (result.success) {
			onAssessmentComplete?.(result.data);
		} else {
			setError(result.error);
		}

		setIsSaving(false);
	}, [scores, opportunityId, assessmentType, assessedBy, overallNotes, organizationId, onAssessmentComplete]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={cn("animate-pulse", className)}>
				<CardHeader>
					<div className="h-6 w-48 bg-muted rounded" />
					<div className="h-4 w-32 bg-muted rounded" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="h-20 bg-muted rounded" />
					<div className="h-20 bg-muted rounded" />
					<div className="h-20 bg-muted rounded" />
				</CardContent>
			</Card>
		);
	}

	return (
		<TooltipProvider>
			<Card className={className}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5 text-primary" />
								PWin Assessment
							</CardTitle>
							<CardDescription className="mt-1">
								{opportunityName}
							</CardDescription>
						</div>

						{/* Current PWin Display */}
						<div className="text-right">
							<div className="text-sm text-muted-foreground">Current PWin</div>
							<div className={cn("text-3xl font-bold", getPwinColorClass(pwin))}>
								{pwin}%
							</div>
							<div className="text-xs text-muted-foreground">
								{weightedScore.toFixed(1)} / {maxPossibleScore.toFixed(1)}
							</div>
						</div>
					</div>

					{/* Assessment Type Selector */}
					<div className="flex items-center gap-4 pt-4">
						<Label htmlFor="assessment-type" className="whitespace-nowrap">
							Assessment Type
						</Label>
						<Select
							value={assessmentType}
							onValueChange={(value) => setAssessmentType(value as AssessmentType)}
						>
							<SelectTrigger id="assessment-type" className="w-48">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(ASSESSMENT_TYPE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Error Display */}
					{error && (
						<div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
							<AlertCircle className="h-4 w-4" />
							<span className="text-sm">{error}</span>
						</div>
					)}

					{/* PWin Progress Bar */}
					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">PWin Score</span>
							<span className="font-medium">{pwin}%</span>
						</div>
						<Progress value={pwin} className="h-3" />
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>Low (0-30%)</span>
							<span>Moderate (30-50%)</span>
							<span>Good (50-70%)</span>
							<span>High (70%+)</span>
						</div>
					</div>

					{/* Factor Scoring by Category */}
					<div className="space-y-4">
						{Array.from(scoresByCategory.entries()).map(([category, categoryScores]) => (
							<Collapsible
								key={category}
								open={expandedCategories.has(category)}
								onOpenChange={() => toggleCategory(category)}
							>
								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										className="w-full justify-between p-3 h-auto"
									>
										<div className="flex items-center gap-2">
											<span className="font-semibold">
												{CATEGORY_LABELS[category]}
											</span>
											<Badge variant="secondary" className="text-xs">
												{categoryScores.length} factors
											</Badge>
										</div>
										{expandedCategories.has(category) ? (
											<ChevronUp className="h-4 w-4" />
										) : (
											<ChevronDown className="h-4 w-4" />
										)}
									</Button>
								</CollapsibleTrigger>

								<CollapsibleContent className="space-y-4 pt-2">
									{categoryScores.map((score) => (
										<FactorScoreInput
											key={score.factorId}
											score={score}
											onScoreChange={updateScore}
											onNotesChange={updateNotes}
										/>
									))}
								</CollapsibleContent>
							</Collapsible>
						))}
					</div>

					{/* Overall Notes */}
					<div className="space-y-2 pt-4 border-t">
						<Label htmlFor="overall-notes">Assessment Notes</Label>
						<Textarea
							id="overall-notes"
							placeholder="Add any overall notes about this assessment..."
							value={overallNotes}
							onChange={(e) => setOverallNotes(e.target.value)}
							rows={3}
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex justify-end gap-3 pt-4">
						{onCancel && (
							<Button variant="outline" onClick={onCancel} disabled={isSaving}>
								Cancel
							</Button>
						)}
						<Button onClick={handleSubmit} disabled={isSaving || scores.length === 0}>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Save className="h-4 w-4 mr-2" />
									Save Assessment
								</>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>
		</TooltipProvider>
	);
}

// ============================================================================
// Factor Score Input Sub-Component
// ============================================================================

interface FactorScoreInputProps {
	score: FactorScoreState;
	onScoreChange: (factorId: string, score: number) => void;
	onNotesChange: (factorId: string, notes: string) => void;
}

function FactorScoreInput({
	score,
	onScoreChange,
	onNotesChange,
}: FactorScoreInputProps) {
	const [showNotes, setShowNotes] = useState(!!score.notes);
	const guideline = getGuidelineForScore(score.score, score.guidelines);

	return (
		<div className="p-4 bg-muted/30 rounded-lg space-y-3">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<Label className="font-medium">{score.factorName}</Label>
						<Badge variant="outline" className="text-xs">
							Weight: {score.weight}
						</Badge>
						{score.guidelines && score.guidelines.length > 0 && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Scoring guidelines">
										<HelpCircle className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right" className="max-w-xs">
									<div className="space-y-2">
										<div className="font-medium">Scoring Guidelines</div>
										{score.guidelines.map((g, idx) => (
											<div key={idx} className="text-xs">
												<span className="font-medium">{g.score}:</span> {g.description}
											</div>
										))}
									</div>
								</TooltipContent>
							</Tooltip>
						)}
					</div>
					{guideline && (
						<p className="text-xs text-muted-foreground mt-1">{guideline}</p>
					)}
				</div>

				<div className="text-right">
					<div
						className={cn(
							"text-2xl font-bold",
							getScoreColorClass(score.score, score.maxScore).replace("bg-", "text-")
						)}
					>
						{score.score}
					</div>
					<div className="text-xs text-muted-foreground">
						/ {score.maxScore}
					</div>
				</div>
			</div>

			{/* Slider */}
			<div className="flex items-center gap-4">
				<span className="text-xs text-muted-foreground w-4">{score.minScore}</span>
				<Slider
					value={[score.score]}
					onValueChange={([value]) => onScoreChange(score.factorId, value)}
					min={score.minScore}
					max={score.maxScore}
					step={1}
					className="flex-1"
				/>
				<span className="text-xs text-muted-foreground w-4">{score.maxScore}</span>
			</div>

			{/* Score indicator bar */}
			<div className="h-1.5 bg-muted rounded-full overflow-hidden">
				<div
					className={cn(
						"h-full transition-all",
						getScoreColorClass(score.score, score.maxScore)
					)}
					style={{ width: `${(score.score / score.maxScore) * 100}%` }}
				/>
			</div>

			{/* Notes toggle and input */}
			<div>
				{!showNotes ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowNotes(true)}
						className="text-xs"
					>
						<Info className="h-3 w-3 mr-1" />
						Add notes
					</Button>
				) : (
					<div className="space-y-2">
						<Label className="text-xs">Notes</Label>
						<Textarea
							value={score.notes}
							onChange={(e) => onNotesChange(score.factorId, e.target.value)}
							placeholder={`Notes for ${score.factorName}...`}
							rows={2}
							className="text-sm"
						/>
					</div>
				)}
			</div>
		</div>
	);
}

export default PwinAssessor;
