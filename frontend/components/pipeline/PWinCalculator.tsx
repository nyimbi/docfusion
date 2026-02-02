/**
 * PWinCalculator Component - DocFusion Capture Pipeline
 *
 * Interactive probability of win (PWin) calculator with factor sliders,
 * AI-powered suggestions, and historical tracking. Provides visual
 * feedback on how each factor contributes to the overall score.
 *
 * Accessibility: All sliders have proper labels, live regions for updates.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition, useMemo, useEffect } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Target,
	TrendingUp,
	TrendingDown,
	Minus,
	Sparkles,
	RefreshCw,
	Save,
	History,
	Info,
	ChevronDown,
	ChevronUp,
	AlertTriangle,
	CheckCircle,
	Loader2,
} from "lucide-react";
import { calculateSuggestedPwin, updatePwin } from "@/lib/actions/pipeline";
import type { PwinCalculation } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface PWinCalculatorProps {
	/** Pipeline ID */
	pipelineId: string;
	/** Related opportunity ID */
	opportunityId?: string;
	/** Current PWin value */
	currentPwin: number;
	/** PWin history */
	pwinHistory?: Array<{ date: string; value: number; reason?: string }>;
	/** Callback when PWin is updated */
	onPwinUpdated?: (newPwin: number) => void;
	/** Custom class name */
	className?: string;
}

interface FactorSlider {
	id: string;
	label: string;
	description: string;
	weight: number;
	value: number;
	impact: "positive" | "neutral" | "negative";
}

// ============================================================================
// Default Factors Configuration
// ============================================================================

const DEFAULT_FACTORS: Omit<FactorSlider, "value" | "impact">[] = [
	{
		id: "customer_relationship",
		label: "Customer Relationship",
		description: "Strength of existing relationship with the customer",
		weight: 0.20,
	},
	{
		id: "solution_fit",
		label: "Solution Fit",
		description: "How well our solution meets the requirements",
		weight: 0.20,
	},
	{
		id: "incumbent_status",
		label: "Incumbent Advantage",
		description: "Whether we are incumbent or challenger",
		weight: 0.15,
	},
	{
		id: "past_performance",
		label: "Past Performance",
		description: "Relevant past performance and references",
		weight: 0.15,
	},
	{
		id: "competitive_position",
		label: "Competitive Position",
		description: "Our position relative to known competitors",
		weight: 0.10,
	},
	{
		id: "price_competitiveness",
		label: "Price Competitiveness",
		description: "Ability to offer competitive pricing",
		weight: 0.10,
	},
	{
		id: "team_quality",
		label: "Team Quality",
		description: "Quality and availability of proposed team",
		weight: 0.10,
	},
];

// ============================================================================
// Helper Functions
// ============================================================================

function getImpact(value: number): "positive" | "neutral" | "negative" {
	if (value >= 70) return "positive";
	if (value >= 40) return "neutral";
	return "negative";
}

function getImpactColor(impact: "positive" | "neutral" | "negative"): string {
	switch (impact) {
		case "positive":
			return "text-green-600 dark:text-green-400";
		case "negative":
			return "text-red-600 dark:text-red-400";
		default:
			return "text-yellow-600 dark:text-yellow-400";
	}
}

function getImpactIcon(impact: "positive" | "neutral" | "negative"): React.ReactNode {
	switch (impact) {
		case "positive":
			return <TrendingUp className="h-4 w-4 text-green-500" />;
		case "negative":
			return <TrendingDown className="h-4 w-4 text-red-500" />;
		default:
			return <Minus className="h-4 w-4 text-yellow-500" />;
	}
}

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "text-green-600 dark:text-green-400";
	if (pwin >= 50) return "text-yellow-600 dark:text-yellow-400";
	if (pwin >= 30) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

function getPwinBgColor(pwin: number): string {
	if (pwin >= 70) return "bg-green-500";
	if (pwin >= 50) return "bg-yellow-500";
	if (pwin >= 30) return "bg-orange-500";
	return "bg-red-500";
}

function getPwinLabel(pwin: number): string {
	if (pwin >= 80) return "Very High";
	if (pwin >= 60) return "High";
	if (pwin >= 40) return "Moderate";
	if (pwin >= 20) return "Low";
	return "Very Low";
}

// ============================================================================
// Component
// ============================================================================

export function PWinCalculator({
	pipelineId,
	opportunityId,
	currentPwin,
	pwinHistory,
	onPwinUpdated,
	className,
}: PWinCalculatorProps) {
	const [isPending, startTransition] = useTransition();
	const [isCalculating, setIsCalculating] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [saveReason, setSaveReason] = useState("");

	// Factor states
	const [factors, setFactors] = useState<FactorSlider[]>(() =>
		DEFAULT_FACTORS.map((f) => ({
			...f,
			value: 50,
			impact: "neutral" as const,
		}))
	);

	// AI suggestions
	const [aiSuggestion, setAiSuggestion] = useState<PwinCalculation | null>(null);
	const [showAiFactors, setShowAiFactors] = useState(false);

	// Calculate overall PWin from factors
	const calculatedPwin = useMemo(() => {
		const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
		const weightedSum = factors.reduce((sum, f) => sum + f.value * f.weight, 0);
		return Math.round(weightedSum / totalWeight);
	}, [factors]);

	// Update factor value
	const updateFactor = useCallback((id: string, value: number) => {
		setFactors((prev) =>
			prev.map((f) =>
				f.id === id
					? { ...f, value, impact: getImpact(value) }
					: f
			)
		);
	}, []);

	// Get AI-suggested PWin
	const handleCalculateAI = useCallback(async () => {
		if (!opportunityId) return;

		setIsCalculating(true);
		try {
			const result = await calculateSuggestedPwin(opportunityId);
			if (result.success) {
				setAiSuggestion(result.data);
				setShowAiFactors(true);
			}
		} catch (error) {
			console.error("Failed to calculate AI suggestion:", error);
		} finally {
			setIsCalculating(false);
		}
	}, [opportunityId]);

	// Apply AI suggestions to factors
	const applyAiSuggestions = useCallback(() => {
		if (!aiSuggestion) return;

		// Map AI factors to our factor sliders
		const updatedFactors = factors.map((factor) => {
			const aiFactor = aiSuggestion.factors.find(
				(f) => f.factor.toLowerCase().replace(/\s+/g, "_") === factor.id ||
					f.factor.toLowerCase().includes(factor.id.replace("_", " "))
			);

			if (aiFactor) {
				return {
					...factor,
					value: Math.round(aiFactor.score),
					impact: aiFactor.impact,
				};
			}
			return factor;
		});

		setFactors(updatedFactors);
	}, [aiSuggestion, factors]);

	// Save PWin with reason
	const handleSavePwin = useCallback(async () => {
		if (!saveReason.trim()) return;

		startTransition(async () => {
			const result = await updatePwin(pipelineId, calculatedPwin, saveReason);
			if (result.success) {
				onPwinUpdated?.(calculatedPwin);
				setSaveDialogOpen(false);
				setSaveReason("");
			}
		});
	}, [pipelineId, calculatedPwin, saveReason, onPwinUpdated]);

	// PWin change from current
	const pwinChange = calculatedPwin - currentPwin;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Main PWin Display */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								Probability of Win (PWin)
							</CardTitle>
							<CardDescription>
								Assess and track your win probability based on key factors
							</CardDescription>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowHistory(!showHistory)}
						>
							<History className="h-4 w-4 mr-2" />
							History
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* PWin Gauge */}
					<div className="flex items-center gap-8">
						<div className="flex-1">
							<div className="flex items-baseline gap-2 mb-2">
								<span className={cn("text-5xl font-bold", getPwinColor(calculatedPwin))}>
									{calculatedPwin}%
								</span>
								<span className="text-lg text-muted-foreground">
									{getPwinLabel(calculatedPwin)}
								</span>
							</div>
							<Progress
								value={calculatedPwin}
								className="h-3"
								aria-label={`Win probability: ${calculatedPwin}%`}
							/>
						</div>

						{/* Change indicator */}
						{pwinChange !== 0 && (
							<div
								className={cn(
									"flex items-center gap-1 px-3 py-2 rounded-lg",
									pwinChange > 0
										? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
										: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
								)}
							>
								{pwinChange > 0 ? (
									<TrendingUp className="h-4 w-4" />
								) : (
									<TrendingDown className="h-4 w-4" />
								)}
								<span className="font-semibold">
									{pwinChange > 0 ? "+" : ""}{pwinChange}%
								</span>
								<span className="text-sm">from current</span>
							</div>
						)}
					</div>

					{/* Current vs Calculated */}
					<div className="flex items-center gap-4 text-sm">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-muted" />
							<span className="text-muted-foreground">Current: {currentPwin}%</span>
						</div>
						<div className="flex items-center gap-2">
							<div className={cn("w-3 h-3 rounded-full", getPwinBgColor(calculatedPwin))} />
							<span className="text-muted-foreground">Calculated: {calculatedPwin}%</span>
						</div>
					</div>
				</CardContent>
				<CardFooter className="flex justify-between">
					<Button
						variant="outline"
						onClick={handleCalculateAI}
						disabled={isCalculating || !opportunityId}
					>
						{isCalculating ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Sparkles className="h-4 w-4 mr-2" />
						)}
						AI Suggestion
					</Button>
					<Button
						variant="primary"
						onClick={() => setSaveDialogOpen(true)}
						disabled={calculatedPwin === currentPwin}
					>
						<Save className="h-4 w-4 mr-2" />
						Save PWin
					</Button>
				</CardFooter>
			</Card>

			{/* AI Suggestions */}
			{aiSuggestion && showAiFactors && (
				<Card className="border-primary/30 bg-primary/5">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2 text-base">
								<Sparkles className="h-4 w-4 text-primary" />
								AI-Suggested PWin: {aiSuggestion.suggestedPwin}%
							</CardTitle>
							<Badge variant="secondary">
								{Math.round(aiSuggestion.confidence * 100)}% confidence
							</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							{aiSuggestion.factors.map((factor, idx) => (
								<div
									key={idx}
									className="flex items-center justify-between p-2 bg-background/50 rounded-lg"
								>
									<div className="flex items-center gap-2">
										{getImpactIcon(factor.impact)}
										<span className="text-sm font-medium">{factor.factor}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className={cn("text-sm font-semibold", getImpactColor(factor.impact))}>
											{factor.score}
										</span>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger>
													<Info className="h-3.5 w-3.5 text-muted-foreground" />
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>{factor.rationale}</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
								</div>
							))}
						</div>
					</CardContent>
					<CardFooter>
						<Button variant="outline" onClick={applyAiSuggestions} className="w-full">
							Apply AI Suggestions to Factors
						</Button>
					</CardFooter>
				</Card>
			)}

			{/* Factor Sliders */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Factor Assessment</CardTitle>
					<CardDescription>
						Adjust each factor to calculate your probability of win
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{factors.map((factor) => (
						<div key={factor.id} className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{getImpactIcon(factor.impact)}
									<Label htmlFor={factor.id} className="font-medium">
										{factor.label}
									</Label>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<Info className="h-3.5 w-3.5 text-muted-foreground" />
											</TooltipTrigger>
											<TooltipContent>
												<p>{factor.description}</p>
												<p className="text-xs text-muted-foreground mt-1">
													Weight: {Math.round(factor.weight * 100)}%
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
								<span className={cn("text-sm font-semibold", getImpactColor(factor.impact))}>
									{factor.value}
								</span>
							</div>
							<div className="flex items-center gap-4">
								<Slider
									id={factor.id}
									value={[factor.value]}
									onValueChange={([value]) => updateFactor(factor.id, value)}
									max={100}
									step={5}
									className="flex-1"
									aria-label={`${factor.label}: ${factor.value}%`}
								/>
								<div className="text-xs text-muted-foreground w-16 text-right">
									{Math.round(factor.weight * 100)}% weight
								</div>
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			{/* History */}
			{showHistory && pwinHistory && pwinHistory.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<History className="h-4 w-4" />
							PWin History
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{pwinHistory.slice().reverse().slice(0, 10).map((entry, idx) => {
								const prevValue = idx < pwinHistory.length - 1
									? pwinHistory[pwinHistory.length - 1 - idx - 1].value
									: entry.value;
								const change = entry.value - prevValue;

								return (
									<div
										key={idx}
										className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
									>
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="font-semibold">{entry.value}%</span>
												{change !== 0 && idx > 0 && (
													<Badge
														variant={change > 0 ? "secondary" : "destructive"}
														className="text-xs"
													>
														{change > 0 ? "+" : ""}{change}%
													</Badge>
												)}
											</div>
											{entry.reason && (
												<p className="text-sm text-muted-foreground mt-0.5">
													{entry.reason}
												</p>
											)}
										</div>
										<span className="text-xs text-muted-foreground">
											{formatDate(new Date(entry.date))}
										</span>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Save Dialog */}
			<Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save PWin Update</DialogTitle>
						<DialogDescription>
							Provide a reason for this PWin change to help track decision history.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="flex items-center justify-between p-3 bg-muted rounded-lg">
							<div>
								<span className="text-sm text-muted-foreground">Current</span>
								<div className="text-xl font-bold">{currentPwin}%</div>
							</div>
							<ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
							<div>
								<span className="text-sm text-muted-foreground">New</span>
								<div className={cn("text-xl font-bold", getPwinColor(calculatedPwin))}>
									{calculatedPwin}%
								</div>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="reason">Reason for Change</Label>
							<Textarea
								id="reason"
								value={saveReason}
								onChange={(e) => setSaveReason(e.target.value)}
								placeholder="e.g., Improved customer relationship after site visit..."
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={handleSavePwin}
							disabled={!saveReason.trim() || isPending}
							isLoading={isPending}
						>
							Save PWin
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default PWinCalculator;
