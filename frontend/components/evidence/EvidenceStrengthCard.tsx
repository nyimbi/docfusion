/**
 * EvidenceStrengthCard - Strength Analysis Display
 *
 * Displays evidence strength score with gauge, tier badge,
 * dimension breakdown, and improvement suggestions.
 */

"use client";

import { useState, useEffect } from "react";
import {
	Award,
	Target,
	Clock,
	CheckCircle2,
	TrendingUp,
	Shield,
	Loader2,
	AlertCircle,
	Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type {
	Evidence,
	StrengthDimensions,
	EvidenceStrengthTier,
} from "@/lib/types/evidence";
import { getEvidenceById, getStrengthAnalysis } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceStrengthCardProps {
	/** Evidence ID to analyze */
	evidenceId: string;
	/** Compact mode for smaller displays */
	compact?: boolean;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TIER_CONFIG: Record<EvidenceStrengthTier, { color: string; bgColor: string; label: string }> = {
	gold: {
		color: "text-yellow-700",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400",
		label: "Gold Tier",
	},
	silver: {
		color: "text-gray-600",
		bgColor: "bg-gray-100 dark:bg-gray-700/30 border-gray-400",
		label: "Silver Tier",
	},
	bronze: {
		color: "text-orange-700",
		bgColor: "bg-orange-100 dark:bg-orange-900/30 border-orange-400",
		label: "Bronze Tier",
	},
};

const DIMENSION_CONFIG = {
	specificity: {
		label: "Specificity",
		icon: Target,
		description: "How specific and detailed the evidence is",
	},
	recency: {
		label: "Recency",
		icon: Clock,
		description: "How recent and current the evidence is",
	},
	relevance: {
		label: "Relevance",
		icon: CheckCircle2,
		description: "How relevant to typical requirements",
	},
	verifiability: {
		label: "Verifiability",
		icon: Shield,
		description: "How easy to verify the evidence",
	},
	quantifiability: {
		label: "Quantifiability",
		icon: TrendingUp,
		description: "How well quantified with metrics",
	},
	credibility: {
		label: "Credibility",
		icon: Award,
		description: "Source credibility level",
	},
};

// =============================================================================
// Score Gauge Component
// =============================================================================

interface ScoreGaugeProps {
	score: number;
	tier: EvidenceStrengthTier;
	size?: "sm" | "md" | "lg";
}

function ScoreGauge({ score, tier, size = "md" }: ScoreGaugeProps) {
	const tierConfig = TIER_CONFIG[tier];
	const sizeClasses = {
		sm: "h-16 w-16 text-lg",
		md: "h-24 w-24 text-2xl",
		lg: "h-32 w-32 text-3xl",
	};

	// Calculate stroke dasharray for circular progress
	const circumference = 2 * Math.PI * 40;
	const strokeDashoffset = circumference - (score / 100) * circumference;

	return (
		<div className="relative inline-flex items-center justify-center">
			<svg
				className={cn("transform -rotate-90", sizeClasses[size])}
				viewBox="0 0 100 100"
			>
				{/* Background circle */}
				<circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="currentColor"
					strokeWidth="8"
					className="text-muted"
				/>
				{/* Progress circle */}
				<circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="currentColor"
					strokeWidth="8"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					className={cn(
						tier === "gold" && "text-yellow-500",
						tier === "silver" && "text-gray-400",
						tier === "bronze" && "text-orange-500"
					)}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className={cn("font-bold", tierConfig.color)}>{score}</span>
			</div>
		</div>
	);
}

// =============================================================================
// Dimension Bar Component
// =============================================================================

interface DimensionBarProps {
	dimension: keyof StrengthDimensions;
	value: number;
	compact?: boolean;
}

function DimensionBar({ dimension, value, compact }: DimensionBarProps) {
	const config = DIMENSION_CONFIG[dimension];
	const Icon = config.icon;

	if (compact) {
		return (
			<div className="flex items-center gap-2">
				<Icon className="h-3 w-3 text-muted-foreground" />
				<div className="flex-1">
					<Progress value={value} className="h-1.5" />
				</div>
				<span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm">{config.label}</span>
				</div>
				<span className="text-sm font-medium">{value}</span>
			</div>
			<Progress
				value={value}
				className={cn(
					"h-2",
					value >= 80 && "[&>div]:bg-green-500",
					value >= 60 && value < 80 && "[&>div]:bg-yellow-500",
					value < 60 && "[&>div]:bg-red-500"
				)}
			/>
		</div>
	);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function StrengthCardSkeleton({ compact }: { compact?: boolean }) {
	if (compact) {
		return (
			<div className="flex items-center gap-3 p-3 border rounded-lg">
				<Skeleton className="h-12 w-12 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-2 w-full" />
				</div>
			</div>
		);
	}

	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-40" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex justify-center">
					<Skeleton className="h-24 w-24 rounded-full" />
				</div>
				<div className="space-y-3">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} className="h-6 w-full" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceStrengthCard({
	evidenceId,
	compact = false,
	className,
}: EvidenceStrengthCardProps) {
	// State
	const [evidence, setEvidence] = useState<Evidence | null>(null);
	const [dimensions, setDimensions] = useState<StrengthDimensions | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			const [evidenceResult, dimensionsResult] = await Promise.all([
				getEvidenceById(evidenceId),
				getStrengthAnalysis(evidenceId),
			]);

			if (evidenceResult.success && evidenceResult.data) {
				setEvidence(evidenceResult.data);
			} else if (!evidenceResult.success) {
				setError(evidenceResult.error);
			}

			if (dimensionsResult.success && dimensionsResult.data) {
				// Map StrengthRating to StrengthDimensions if needed
				const data = dimensionsResult.data;
				if ("dimensions" in data && data.dimensions) {
					const dims: StrengthDimensions = {
						recency: data.dimensions.recency?.score ?? 0,
						specificity: data.dimensions.specificity?.score ?? 0,
						quantifiability: data.dimensions.quantification?.score ?? 0,
						verifiability: data.dimensions.verifiability?.score ?? 0,
						credibility: data.dimensions.relevance?.score ?? 0,
						relevance: data.dimensions.relevance?.score ?? 0,
					};
					setDimensions(dims);
				} else {
					setDimensions(data as unknown as StrengthDimensions);
				}
			}

			setIsLoading(false);
		}

		loadData();
	}, [evidenceId]);

	// Generate improvement suggestions
	const getImprovementSuggestions = (): string[] => {
		if (!dimensions) return [];

		const suggestions: string[] = [];
		if (dimensions.quantifiability < 60) {
			suggestions.push("Add specific metrics and measurements");
		}
		if (dimensions.verifiability < 60) {
			suggestions.push("Include verifiable source information");
		}
		if (dimensions.specificity < 60) {
			suggestions.push("Add more specific details and context");
		}
		if (dimensions.recency < 60) {
			suggestions.push("Update with more recent data if available");
		}
		if (dimensions.credibility < 60) {
			suggestions.push("Reference third-party or customer sources");
		}

		return suggestions.slice(0, 3);
	};

	if (isLoading) {
		return <StrengthCardSkeleton compact={compact} />;
	}

	if (error || !evidence) {
		return (
			<Alert variant="destructive" className={className}>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>{error || "Evidence not found"}</AlertDescription>
			</Alert>
		);
	}

	// Get strengthTier with fallback
	const strengthTier = evidence.strengthTier ?? "bronze";
	const strengthScore = evidence.strengthScore ?? 0;
	const tierConfig = TIER_CONFIG[strengthTier] ?? TIER_CONFIG.bronze;
	const suggestions = getImprovementSuggestions();

	// Compact version
	if (compact) {
		return (
			<div className={cn("flex items-center gap-3 p-3 border rounded-lg", className)}>
				<ScoreGauge score={strengthScore} tier={strengthTier} size="sm" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<Badge
							variant="outline"
							className={cn("text-xs border", tierConfig.bgColor, tierConfig.color)}
						>
							{tierConfig.label}
						</Badge>
					</div>
					{dimensions && (
						<div className="space-y-1">
							{(Object.keys(dimensions) as (keyof StrengthDimensions)[]).slice(0, 3).map((key) => (
								<DimensionBar key={key} dimension={key} value={dimensions[key]} compact />
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Full version
	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Award className="h-5 w-5" />
					Strength Analysis
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Score Gauge */}
				<div className="flex flex-col items-center gap-3">
					<ScoreGauge score={strengthScore} tier={strengthTier} />
					<Badge
						variant="outline"
						className={cn("text-sm border", tierConfig.bgColor, tierConfig.color)}
					>
						{tierConfig.label}
					</Badge>
				</div>

				{/* Dimension Breakdown */}
				{dimensions && (
					<div className="space-y-4">
						<h4 className="text-sm font-medium">Dimension Breakdown</h4>
						<div className="space-y-3">
							{(Object.keys(dimensions) as (keyof StrengthDimensions)[]).map((key) => (
								<DimensionBar key={key} dimension={key} value={dimensions[key]} />
							))}
						</div>
					</div>
				)}

				{/* Improvement Suggestions */}
				{suggestions.length > 0 && (
					<div className="space-y-3">
						<h4 className="text-sm font-medium flex items-center gap-2">
							<Lightbulb className="h-4 w-4" />
							Improvement Suggestions
						</h4>
						<ul className="space-y-2">
							{suggestions.map((suggestion, idx) => (
								<li
									key={idx}
									className="text-sm text-muted-foreground flex items-start gap-2 p-2 bg-muted/50 rounded"
								>
									<span className="text-primary font-medium">{idx + 1}.</span>
									{suggestion}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Tier Thresholds */}
				<div className="pt-4 border-t text-xs text-muted-foreground">
					<div className="flex justify-between">
						<span>Bronze: 0-59</span>
						<span>Silver: 60-79</span>
						<span>Gold: 80-100</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default EvidenceStrengthCard;
