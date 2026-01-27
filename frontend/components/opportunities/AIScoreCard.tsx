/**
 * AIScoreCard Component - DocFusion
 *
 * Displays AI-generated scores (fit, win probability, risk) with
 * visual gauges, factor breakdowns, and recalculation capability.
 */

"use client";

import { useState, useTransition } from "react";
import type {
	OpportunityAIScoreSummary,
	AIScoreType,
	OpportunityAIScore,
} from "@/lib/types/opportunity";
import {
	calculateAllScores,
	getAIScoreHistory,
} from "@/lib/actions/opportunity-ai";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface AIScoreCardProps {
	opportunityId: string;
	initialScores: OpportunityAIScoreSummary;
}

export function AIScoreCard({ opportunityId, initialScores }: AIScoreCardProps) {
	const [scores, setScores] = useState(initialScores);
	const [expandedScore, setExpandedScore] = useState<AIScoreType | null>(null);
	const [scoreDetails, setScoreDetails] = useState<OpportunityAIScore | null>(null);
	const [isPending, startTransition] = useTransition();

	const handleRecalculate = () => {
		startTransition(async () => {
			try {
				const newScores = await calculateAllScores(opportunityId);

				setScores({
					opportunityId,
					fitScore: newScores.fit.score,
					winProbability: newScores.winProbability.score,
					riskScore: newScores.risk.score,
					effortScore: null,
					lastUpdated: new Date(),
				});

				// If a score was expanded, update its details
				if (expandedScore === "fit") setScoreDetails(newScores.fit);
				else if (expandedScore === "win_probability")
					setScoreDetails(newScores.winProbability);
				else if (expandedScore === "risk") setScoreDetails(newScores.risk);
			} catch (error) {
				console.error("Failed to calculate scores:", error);
			}
		});
	};

	const handleScoreClick = async (type: AIScoreType) => {
		if (expandedScore === type) {
			setExpandedScore(null);
			setScoreDetails(null);
			return;
		}

		setExpandedScore(type);

		// Fetch score history/details
		try {
			const history = await getAIScoreHistory(opportunityId, type, 1);
			if (history.length > 0) {
				setScoreDetails(history[0]);
			}
		} catch (error) {
			console.error("Failed to fetch score details:", error);
		}
	};

	const hasScores = scores.fitScore !== null || scores.winProbability !== null;

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">AI Analysis</CardTitle>
						<CardDescription>
							{hasScores
								? `Last updated ${formatRelativeTime(scores.lastUpdated)}`
								: "No analysis yet"}
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRecalculate}
						isLoading={isPending}
					>
						{hasScores ? "Recalculate" : "Analyze"}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{hasScores ? (
					<>
						{/* Score Gauges */}
						<div className="grid grid-cols-3 gap-3">
							<ScoreGauge
								label="Fit Score"
								score={scores.fitScore}
								type="fit"
								isExpanded={expandedScore === "fit"}
								onClick={() => handleScoreClick("fit")}
							/>
							<ScoreGauge
								label="Win Prob."
								score={scores.winProbability}
								type="win_probability"
								isExpanded={expandedScore === "win_probability"}
								onClick={() => handleScoreClick("win_probability")}
							/>
							<ScoreGauge
								label="Risk"
								score={scores.riskScore}
								type="risk"
								inverted
								isExpanded={expandedScore === "risk"}
								onClick={() => handleScoreClick("risk")}
							/>
						</div>

						{/* Expanded Score Details */}
						{expandedScore && scoreDetails && (
							<ScoreDetails score={scoreDetails} type={expandedScore} />
						)}
					</>
				) : (
					<EmptyState onAnalyze={handleRecalculate} isLoading={isPending} />
				)}
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ScoreGauge({
	label,
	score,
	type,
	inverted = false,
	isExpanded,
	onClick,
}: {
	label: string;
	score: number | null;
	type: AIScoreType;
	inverted?: boolean;
	isExpanded: boolean;
	onClick: () => void;
}) {
	if (score === null) {
		return (
			<div className="text-center opacity-50">
				<div className="relative w-16 h-16 mx-auto">
					<svg className="w-full h-full" viewBox="0 0 36 36">
						<circle
							cx="18"
							cy="18"
							r="15"
							fill="none"
							className="stroke-border"
							strokeWidth="3"
						/>
					</svg>
					<span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
						--
					</span>
				</div>
				<p className="text-xs text-muted-foreground mt-1">{label}</p>
			</div>
		);
	}

	// For risk, we want to invert the color scale (high risk = red)
	const displayScore = score;
	const colorValue = inverted ? 100 - score : score;

	const getColor = (value: number) => {
		if (value >= 70) return "text-green-500";
		if (value >= 40) return "text-yellow-500";
		return "text-red-500";
	};

	const getStrokeColor = (value: number) => {
		if (value >= 70) return "#22c55e";
		if (value >= 40) return "#eab308";
		return "#ef4444";
	};

	const strokeDasharray = `${(score / 100) * 94.2} 94.2`;

	return (
		<button
			onClick={onClick}
			className={cn(
				"text-center p-2 rounded-lg transition-all",
				"hover:bg-[var(--background-muted)]",
				isExpanded && "bg-[var(--background-muted)] ring-1 ring-[var(--border)]"
			)}
		>
			<div className="relative w-16 h-16 mx-auto">
				<svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
					{/* Background circle */}
					<circle
						cx="18"
						cy="18"
						r="15"
						fill="none"
						className="stroke-border"
						strokeWidth="3"
					/>
					{/* Progress circle */}
					<circle
						cx="18"
						cy="18"
						r="15"
						fill="none"
						stroke={getStrokeColor(colorValue)}
						strokeWidth="3"
						strokeLinecap="round"
						strokeDasharray={strokeDasharray}
						className="transition-all duration-500"
					/>
				</svg>
				<span
					className={cn(
						"absolute inset-0 flex items-center justify-center text-sm font-semibold",
						getColor(colorValue)
					)}
				>
					{Math.round(displayScore)}
				</span>
			</div>
			<p className="text-xs text-muted-foreground mt-1">{label}</p>
		</button>
	);
}

function ScoreDetails({
	score,
	type,
}: {
	score: OpportunityAIScore;
	type: AIScoreType;
}) {
	const title = {
		fit: "Fit Score Analysis",
		win_probability: "Win Probability Analysis",
		risk: "Risk Assessment",
		effort: "Effort Estimate",
	}[type];

	return (
		<div className="pt-3 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
			<h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>

			{/* Reasoning */}
			{score.reasoning && (
				<p className="text-xs text-muted-foreground mb-3">{score.reasoning}</p>
			)}

			{/* Factor Breakdown */}
			{score.factors && score.factors.length > 0 && (
				<div className="space-y-2">
					{score.factors.map((factor, index) => (
						<FactorRow key={index} factor={factor} type={type} />
					))}
				</div>
			)}

			{/* Timestamp */}
			<p className="text-[10px] text-muted-foreground mt-3">
				Calculated {formatDateTime(score.createdAt)}
				{score.modelVersion && ` • Model: ${score.modelVersion}`}
			</p>
		</div>
	);
}

function FactorRow({
	factor,
	type,
}: {
	factor: {
		factor: string;
		weight: number;
		score: number;
		reasoning: string;
	};
	type: AIScoreType;
}) {
	// For risk, invert the color scale
	const colorValue = type === "risk" ? 100 - factor.score : factor.score;

	const getBarColor = (value: number) => {
		if (value >= 70) return "bg-green-500";
		if (value >= 40) return "bg-yellow-500";
		return "bg-red-500";
	};

	return (
		<div className="group">
			<div className="flex items-center justify-between text-xs mb-1">
				<span className="text-foreground">{factor.factor}</span>
				<span className="text-muted-foreground font-medium">
					{Math.round(factor.score)}
				</span>
			</div>
			<div className="h-1.5 bg-muted rounded-full overflow-hidden">
				<div
					className={cn(
						"h-full rounded-full transition-all duration-300",
						getBarColor(colorValue)
					)}
					style={{ width: `${factor.score}%` }}
				/>
			</div>
			{/* Tooltip-style reasoning on hover */}
			<p className="text-[10px] text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2">
				{factor.reasoning}
			</p>
		</div>
	);
}

function EmptyState({
	onAnalyze,
	isLoading,
}: {
	onAnalyze: () => void;
	isLoading: boolean;
}) {
	return (
		<div className="text-center py-6">
			<div className="rounded-full bg-muted p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
				<SparklesIcon className="h-5 w-5 text-muted-foreground" />
			</div>
			<h4 className="text-sm font-medium text-foreground mb-1">
				No Analysis Yet
			</h4>
			<p className="text-xs text-muted-foreground mb-3">
				Run AI analysis to get fit scores, win probability, and risk assessment.
			</p>
			<Button variant="primary" size="sm" onClick={onAnalyze} isLoading={isLoading}>
				Analyze Opportunity
			</Button>
		</div>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(date: Date | null): string {
	if (!date) return "never";

	const now = new Date();
	const diff = now.getTime() - new Date(date).getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return formatDateTime(date);
}

function formatDateTime(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(date));
}

// ============================================================================
// Icons
// ============================================================================

function SparklesIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
			/>
		</svg>
	);
}
