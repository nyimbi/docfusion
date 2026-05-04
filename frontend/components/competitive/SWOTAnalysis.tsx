"use client";

/**
 * SWOT Analysis Component
 *
 * Four-quadrant display and editor for Strengths, Weaknesses,
 * Opportunities, and Threats with AI insights and strategy recommendations.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	TrendingUp,
	TrendingDown,
	Target,
	AlertTriangle,
	Sparkles,
	RefreshCw,
	Plus,
	X,
	Loader2,
	Lightbulb,
	DollarSign,
	Trophy,
	Info,
	Check,
	Shield,
} from "lucide-react";
import {
	generateSWOT,
	getLatestCompetitiveAnalysis,
} from "@/lib/actions/competitive";
import type { SWOTAnalysis as SWOTAnalysisType, SWOTDisplayProps } from "@/lib/types/competitive";

interface SWOTAnalysisProps extends Partial<SWOTDisplayProps> {
	opportunityId: string;
	className?: string;
}

/**
 * Position badge configuration
 */
const positionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
	leader: { label: "Market Leader", color: "bg-green-100 text-green-800", icon: <Trophy className="h-4 w-4" /> },
	challenger: { label: "Challenger", color: "bg-blue-100 text-blue-800", icon: <Target className="h-4 w-4" /> },
	follower: { label: "Follower", color: "bg-yellow-100 text-yellow-800", icon: <TrendingUp className="h-4 w-4" /> },
	niche: { label: "Niche Player", color: "bg-purple-100 text-purple-800", icon: <Shield className="h-4 w-4" /> },
};

/**
 * Pricing strategy configuration
 */
const pricingConfig: Record<string, { label: string; color: string }> = {
	low_price: { label: "Low Price", color: "text-green-600" },
	best_value: { label: "Best Value", color: "text-blue-600" },
	premium: { label: "Premium", color: "text-purple-600" },
};

export function SWOTAnalysis({
	opportunityId,
	analysis: initialAnalysis,
	showInsights = true,
	editable = true,
	onUpdate,
	className,
}: SWOTAnalysisProps) {
	// State
	const [analysis, setAnalysis] = useState<SWOTAnalysisType | null>(initialAnalysis ?? null);
	const [isLoading, setIsLoading] = useState(!initialAnalysis);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Edit states for each quadrant
	const [editingQuadrant, setEditingQuadrant] = useState<string | null>(null);
	const [newItemInput, setNewItemInput] = useState("");

	// Load existing analysis
	useEffect(() => {
		if (initialAnalysis) return;

		async function loadAnalysis() {
			const result = await getLatestCompetitiveAnalysis(opportunityId);
			if (result.success && result.data) {
				setAnalysis({
					id: result.data.id,
					opportunityId: result.data.opportunityId ?? opportunityId,
					strengths: result.data.strengths ?? [],
					weaknesses: result.data.weaknesses ?? [],
					opportunities: result.data.opportunityFactors ?? [],
					threats: result.data.threats ?? [],
					ourPosition: result.data.ourPosition ?? "challenger",
					winStrategy: result.data.winStrategy ?? "",
					pricingStrategy: result.data.pricingStrategy ?? "best_value",
					aiInsights: result.data.aiInsights ?? [],
				});
			}
			setIsLoading(false);
		}
		loadAnalysis();
	}, [opportunityId, initialAnalysis]);

	/**
	 * Generate new SWOT analysis
	 */
	const handleGenerate = useCallback(async () => {
		setError(null);

		startTransition(async () => {
			const result = await generateSWOT(opportunityId);
			if (result.success) {
				setAnalysis(result.data);
				onUpdate?.(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [opportunityId, onUpdate]);

	/**
	 * Add item to quadrant
	 */
	const handleAddItem = useCallback(
		(quadrant: "strengths" | "weaknesses" | "opportunities" | "threats") => {
			if (!newItemInput.trim() || !analysis) return;

			const updated = {
				...analysis,
				[quadrant]: [...analysis[quadrant], newItemInput.trim()],
			};
			setAnalysis(updated);
			onUpdate?.(updated);
			setNewItemInput("");
			setEditingQuadrant(null);
		},
		[analysis, newItemInput, onUpdate]
	);

	/**
	 * Remove item from quadrant
	 */
	const handleRemoveItem = useCallback(
		(quadrant: "strengths" | "weaknesses" | "opportunities" | "threats", index: number) => {
			if (!analysis) return;

			const updated = {
				...analysis,
				[quadrant]: analysis[quadrant].filter((_, i) => i !== index),
			};
			setAnalysis(updated);
			onUpdate?.(updated);
		},
		[analysis, onUpdate]
	);

	/**
	 * Render a SWOT quadrant
	 */
	const renderQuadrant = (
		title: string,
		items: string[],
		quadrant: "strengths" | "weaknesses" | "opportunities" | "threats",
		icon: React.ReactNode,
		colorClasses: { bg: string; border: string; text: string; iconBg: string }
	) => {
		const isEditing = editingQuadrant === quadrant;

		return (
			<Card className={cn("border-2", colorClasses.border)}>
				<CardHeader className={cn("pb-2", colorClasses.bg)}>
					<CardTitle className="flex items-center justify-between">
						<span className={cn("flex items-center gap-2", colorClasses.text)}>
							<span className={cn("p-1.5 rounded", colorClasses.iconBg)}>
								{icon}
							</span>
							{title}
						</span>
						{editable && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setEditingQuadrant(isEditing ? null : quadrant)}
								className="h-7 w-7 p-0"
							>
								<Plus className="h-4 w-4" />
							</Button>
						)}
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-3">
					{/* Add Item Input */}
					{isEditing && (
						<div className="flex gap-2 mb-3">
							<Input
								placeholder={`Add ${title.toLowerCase().slice(0, -1)}...`}
								value={newItemInput}
								onChange={(e) => setNewItemInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddItem(quadrant);
									} else if (e.key === "Escape") {
										setEditingQuadrant(null);
										setNewItemInput("");
									}
								}}
							/>
							<Button size="sm" onClick={() => handleAddItem(quadrant)}>
								<Check className="h-4 w-4" />
							</Button>
						</div>
					)}

					{/* Items List */}
					<ul className="space-y-2">
						{items.map((item, idx) => (
							<li
								key={idx}
								className="flex items-start justify-between gap-2 text-sm group"
							>
								<span className="flex items-start gap-2">
									<span className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", colorClasses.iconBg)} />
									{item}
								</span>
								{editable && (
									<button
										onClick={() => handleRemoveItem(quadrant, idx)}
										className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</li>
						))}
						{items.length === 0 && (
							<li className="text-sm text-muted-foreground italic">
								No items yet. {editable && "Click + to add."}
							</li>
						)}
					</ul>
				</CardContent>
			</Card>
		);
	};

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("space-y-4", className)}>
				<div className="grid grid-cols-2 gap-4">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-48" />
					))}
				</div>
			</div>
		);
	}

	// Empty state - no analysis yet
	if (!analysis) {
		return (
			<Card className={className}>
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<Target className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-semibold mb-2">No SWOT Analysis</h3>
					<p className="text-muted-foreground mb-4 max-w-md">
						Generate a comprehensive SWOT analysis based on the opportunity requirements
						and identified competitors.
					</p>
					<Button onClick={handleGenerate} disabled={isPending}>
						{isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								Generate SWOT Analysis
							</>
						)}
					</Button>
				</CardContent>
			</Card>
		);
	}

	const position = positionConfig[analysis.ourPosition] ?? positionConfig.challenger;
	const pricing = pricingConfig[analysis.pricingStrategy] ?? pricingConfig.best_value;

	return (
		<div className={cn("space-y-4", className)}>
			{error && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Header with Actions */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-lg font-semibold">SWOT Analysis</h2>
					<Badge variant="secondary" className={cn("gap-1", position.color)}>
						{position.icon}
						{position.label}
					</Badge>
				</div>
				<Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
					{isPending ? (
						<Loader2 className="h-4 w-4 mr-1 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4 mr-1" />
					)}
					Refresh
				</Button>
			</div>

			{/* SWOT Grid */}
			<div className="grid grid-cols-2 gap-4">
				{renderQuadrant(
					"Strengths",
					analysis.strengths,
					"strengths",
					<TrendingUp className="h-4 w-4 text-green-600" />,
					{
						bg: "bg-green-50 dark:bg-green-950",
						border: "border-green-200 dark:border-green-800",
						text: "text-green-700 dark:text-green-300",
						iconBg: "bg-green-100 dark:bg-green-900",
					}
				)}
				{renderQuadrant(
					"Weaknesses",
					analysis.weaknesses,
					"weaknesses",
					<TrendingDown className="h-4 w-4 text-red-600" />,
					{
						bg: "bg-red-50 dark:bg-red-950",
						border: "border-red-200 dark:border-red-800",
						text: "text-red-700 dark:text-red-300",
						iconBg: "bg-red-100 dark:bg-red-900",
					}
				)}
				{renderQuadrant(
					"Opportunities",
					analysis.opportunities,
					"opportunities",
					<Target className="h-4 w-4 text-blue-600" />,
					{
						bg: "bg-blue-50 dark:bg-blue-950",
						border: "border-blue-200 dark:border-blue-800",
						text: "text-blue-700 dark:text-blue-300",
						iconBg: "bg-blue-100 dark:bg-blue-900",
					}
				)}
				{renderQuadrant(
					"Threats",
					analysis.threats,
					"threats",
					<AlertTriangle className="h-4 w-4 text-amber-600" />,
					{
						bg: "bg-amber-50 dark:bg-amber-950",
						border: "border-amber-200 dark:border-amber-800",
						text: "text-amber-700 dark:text-amber-300",
						iconBg: "bg-amber-100 dark:bg-amber-900",
					}
				)}
			</div>

			{/* Strategy Cards */}
			<div className="grid grid-cols-2 gap-4">
				{/* Win Strategy */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<Trophy className="h-4 w-4 text-primary" />
							Win Strategy
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">{analysis.winStrategy || "No strategy defined."}</p>
					</CardContent>
				</Card>

				{/* Pricing Strategy */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<DollarSign className="h-4 w-4 text-primary" />
							Pricing Strategy
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<Badge variant="outline" className={pricing.color}>
								{pricing.label}
							</Badge>
							<span className="text-sm text-muted-foreground">
								{analysis.pricingStrategy === "low_price" &&
									"Compete primarily on price"}
								{analysis.pricingStrategy === "best_value" &&
									"Balance price and technical merit"}
								{analysis.pricingStrategy === "premium" &&
									"Emphasize quality over price"}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* AI Insights */}
			{showInsights && analysis.aiInsights && analysis.aiInsights.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Lightbulb className="h-4 w-4 text-yellow-500" />
							AI Insights
						</CardTitle>
						<CardDescription>
							Automated analysis and recommendations
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{analysis.aiInsights.map((insight, idx) => (
								<div
									key={idx}
									className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
								>
									<Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
									<div className="flex-1">
										<p className="text-sm">{insight.insight}</p>
										<div className="flex items-center gap-2 mt-1">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Badge
															variant="secondary"
															className={cn(
																"text-xs",
																insight.confidence >= 0.8 && "bg-green-100 text-green-800",
																insight.confidence >= 0.5 &&
																	insight.confidence < 0.8 &&
																	"bg-yellow-100 text-yellow-800",
																insight.confidence < 0.5 && "bg-red-100 text-red-800"
															)}
														>
															{Math.round(insight.confidence * 100)}% confidence
														</Badge>
													</TooltipTrigger>
													<TooltipContent>
														<p>Confidence level of this insight</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<span className="text-xs text-muted-foreground">
												Source: {insight.source}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Help Text */}
			<Alert>
				<Info className="h-4 w-4" />
				<AlertTitle>Using SWOT Analysis</AlertTitle>
				<AlertDescription>
					Use this analysis to inform your proposal strategy. Leverage strengths, mitigate
					weaknesses, capitalize on opportunities, and address threats proactively in your
					proposal narrative.
				</AlertDescription>
			</Alert>
		</div>
	);
}

export default SWOTAnalysis;
