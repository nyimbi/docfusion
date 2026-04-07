"use client";

/**
 * Model Performance Component
 *
 * Displays PWin model accuracy, calibration metrics, and feature importance.
 * Helps users understand how reliable the PWin predictions are and which
 * factors have the most predictive power.
 *
 * Features:
 * - Overall accuracy and performance metrics
 * - Calibration chart showing predicted vs actual win rates
 * - Feature importance rankings
 * - Model version tracking
 * - Confidence indicators
 *
 * @example
 * ```tsx
 * <ModelPerformance
 *   organizationId="org-123"
 *   onRetrainRequest={() => openRetrainDialog()}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
	Brain,
	BarChart3,
	Target,
	TrendingUp,
	Loader2,
	AlertCircle,
	RefreshCw,
	CheckCircle2,
	Info,
	Zap,
	Activity,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { evaluateModelPerformance, getCalibrationData, getModelHistory, type ModelEvaluation } from "@/lib/actions/pwin";
import type { CalibrationData } from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface ModelPerformanceProps {
	organizationId?: string;
	onRetrainRequest?: () => void;
	className?: string;
}

interface FeatureImportance {
	factorId: string;
	factorName: string;
	importance: number;
	rank: number;
}

// ============================================================================
// Constants
// ============================================================================

const METRIC_THRESHOLDS = {
	accuracy: { good: 0.75, fair: 0.6 },
	precision: { good: 0.7, fair: 0.5 },
	recall: { good: 0.7, fair: 0.5 },
	f1Score: { good: 0.7, fair: 0.5 },
	auc: { good: 0.8, fair: 0.65 },
	brierScore: { good: 0.15, fair: 0.25 }, // Lower is better
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatPercentage(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

function getMetricColor(
	value: number,
	metric: keyof typeof METRIC_THRESHOLDS
): string {
	const thresholds = METRIC_THRESHOLDS[metric];

	// Brier score is inverted (lower is better)
	if (metric === "brierScore") {
		if (value <= thresholds.good) return "text-green-600";
		if (value <= thresholds.fair) return "text-amber-600";
		return "text-red-600";
	}

	if (value >= thresholds.good) return "text-green-600";
	if (value >= thresholds.fair) return "text-amber-600";
	return "text-red-600";
}

function getMetricBgColor(
	value: number,
	metric: keyof typeof METRIC_THRESHOLDS
): string {
	const thresholds = METRIC_THRESHOLDS[metric];

	if (metric === "brierScore") {
		if (value <= thresholds.good) return "bg-green-500";
		if (value <= thresholds.fair) return "bg-amber-500";
		return "bg-red-500";
	}

	if (value >= thresholds.good) return "bg-green-500";
	if (value >= thresholds.fair) return "bg-amber-500";
	return "bg-red-500";
}

function getOverallHealth(metrics: {
	accuracy?: number;
	precision?: number;
	recall?: number;
	auc?: number;
}): "excellent" | "good" | "fair" | "poor" {
	const accuracy = metrics.accuracy ?? 0;
	const auc = metrics.auc ?? 0;

	if (accuracy >= 0.8 && auc >= 0.85) return "excellent";
	if (accuracy >= 0.7 && auc >= 0.75) return "good";
	if (accuracy >= 0.6 && auc >= 0.65) return "fair";
	return "poor";
}

// ============================================================================
// Component
// ============================================================================

export function ModelPerformance({
	organizationId,
	onRetrainRequest,
	className,
}: ModelPerformanceProps) {
	// State
	const [performance, setPerformance] = useState<ModelEvaluation | null>(null);
	const [calibration, setCalibration] = useState<CalibrationData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load data
	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [perfResult, calibResult] = await Promise.all([
				evaluateModelPerformance(),
				getCalibrationData(),
			]);

			if (perfResult.success) {
				setPerformance(perfResult.data);
			} else {
				setError(perfResult.error);
			}

			if (calibResult.success) {
				setCalibration(calibResult.data);
			}
		} catch (err) {
			setError("Failed to load model performance data");
		}

		setIsLoading(false);
	}, [organizationId]);

	// Load on mount
	useEffect(() => {
		loadData();
	}, [loadData]);

	// Compute model health
	const modelHealth = useMemo(() => {
		if (!performance) return null;
		return getOverallHealth({
			accuracy: performance.accuracy ?? undefined,
			precision: performance.precision ?? undefined,
			recall: performance.recall ?? undefined,
			auc: performance.auc ?? undefined,
		});
	}, [performance]);

	// Extract feature importance data from model performance
	const featureImportance = useMemo((): FeatureImportance[] => {
		return (performance?.featureImportance as FeatureImportance[]) ?? [];
	}, [performance]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Brain className="h-5 w-5 text-primary" />
						Model Performance
					</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Brain className="h-5 w-5 text-primary" />
						Model Performance
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertCircle className="h-10 w-10 text-destructive mb-3" />
					<p className="text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={loadData}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	// No data state
	if (!performance) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Brain className="h-5 w-5 text-primary" />
						Model Performance
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<Brain className="h-10 w-10 text-muted-foreground mb-3" />
					<p className="text-muted-foreground text-center">
						No trained model available. Complete more assessments to train the model.
					</p>
					{onRetrainRequest && (
						<Button variant="outline" size="sm" className="mt-4" onClick={onRetrainRequest}>
							Request Training
						</Button>
					)}
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
								<Brain className="h-5 w-5 text-primary" />
								Model Performance
							</CardTitle>
							<CardDescription className="mt-1">
								Version {performance.modelVersion} - Trained on{" "}
								{performance.trainingSetSize ?? 0} samples
							</CardDescription>
						</div>

						<div className="flex items-center gap-2">
							{/* Health Badge */}
							<Badge
								variant={modelHealth === "excellent" || modelHealth === "good" ? "default" : "secondary"}
								className={cn(
									modelHealth === "excellent" && "bg-green-600",
									modelHealth === "good" && "bg-blue-600",
									modelHealth === "fair" && "bg-amber-600",
									modelHealth === "poor" && "bg-red-600"
								)}
							>
								{modelHealth?.charAt(0).toUpperCase()}{modelHealth?.slice(1)} Health
							</Badge>

							<Button variant="outline" size="icon" onClick={loadData} aria-label="Refresh model data">
								<RefreshCw className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Primary Metrics */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<MetricCard
							label="Accuracy"
							value={performance.accuracy ?? 0}
							description="Overall prediction accuracy"
							metric="accuracy"
						/>
						<MetricCard
							label="Precision"
							value={performance.precision ?? 0}
							description="Win predictions that were correct"
							metric="precision"
						/>
						<MetricCard
							label="Recall"
							value={performance.recall ?? 0}
							description="Actual wins that were predicted"
							metric="recall"
						/>
						<MetricCard
							label="AUC"
							value={performance.auc ?? 0}
							description="Area under ROC curve"
							metric="auc"
						/>
					</div>

					<Separator />

					{/* Secondary Metrics */}
					<div className="grid grid-cols-2 gap-4">
						<div className="p-4 bg-muted/30 rounded-lg">
							<div className="flex items-center gap-2 mb-2">
								<Activity className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">F1 Score</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="h-3.5 w-3.5 text-muted-foreground" />
									</TooltipTrigger>
									<TooltipContent>
										Harmonic mean of precision and recall
									</TooltipContent>
								</Tooltip>
							</div>
							<div className={cn(
								"text-2xl font-bold",
								getMetricColor(performance.f1Score ?? 0, "f1Score")
							)}>
								{formatPercentage(performance.f1Score ?? 0)}
							</div>
						</div>

						<div className="p-4 bg-muted/30 rounded-lg">
							<div className="flex items-center gap-2 mb-2">
								<Target className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">Brier Score</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="h-3.5 w-3.5 text-muted-foreground" />
									</TooltipTrigger>
									<TooltipContent>
										Calibration error (lower is better)
									</TooltipContent>
								</Tooltip>
							</div>
							<div className={cn(
								"text-2xl font-bold",
								getMetricColor(performance.brierScore ?? 0, "brierScore")
							)}>
								{(performance.brierScore ?? 0).toFixed(3)}
							</div>
						</div>
					</div>

					{/* Calibration Chart */}
					{calibration && calibration.buckets && calibration.buckets.length > 0 && (
						<>
							<Separator />
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h4 className="font-medium flex items-center gap-2">
										<BarChart3 className="h-4 w-4" />
										Calibration
									</h4>
									<span className="text-sm text-muted-foreground">
										Error: {(calibration.overallCalibrationError * 100).toFixed(1)}%
									</span>
								</div>

								<div className="space-y-3">
									{calibration.buckets.map((bucket, idx) => (
										<CalibrationBucket key={idx} bucket={bucket} />
									))}
								</div>

								<p className="text-xs text-muted-foreground">
									Calibration shows how well predicted probabilities match actual win rates.
									Perfect calibration means a 70% prediction wins 70% of the time.
								</p>
							</div>
						</>
					)}

					{/* Feature Importance */}
					{featureImportance.length > 0 && (
						<>
							<Separator />
							<div className="space-y-4">
								<h4 className="font-medium flex items-center gap-2">
									<Zap className="h-4 w-4" />
									Feature Importance
								</h4>

								<div className="space-y-2">
									{featureImportance.slice(0, 7).map((feature) => (
										<div key={feature.factorId} className="flex items-center gap-3">
											<div className="w-6 text-center">
												<Badge variant="outline" className="text-xs">
													{feature.rank}
												</Badge>
											</div>
											<div className="flex-1">
												<div className="flex justify-between mb-1">
													<span className="text-sm truncate">
														{feature.factorName}
													</span>
													<span className="text-sm font-medium">
														{(feature.importance * 100).toFixed(0)}%
													</span>
												</div>
												<Progress
													value={feature.importance * 100}
													className="h-1.5"
												/>
											</div>
										</div>
									))}
								</div>
							</div>
						</>
					)}

					{/* Model Info Footer */}
					<div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
						<div>
							Training Set: {performance.trainingSetSize ?? 0} |
							Test Set: {performance.testSetSize ?? 0}
						</div>
						{performance.trainedAt && (
							<div>
								Last trained:{" "}
								{new Date(performance.trainedAt).toLocaleDateString()}
							</div>
						)}
					</div>

					{/* Retrain Button */}
					{onRetrainRequest && (
						<Button
							variant="outline"
							className="w-full"
							onClick={onRetrainRequest}
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Request Model Retraining
						</Button>
					)}
				</CardContent>
			</Card>
		</TooltipProvider>
	);
}

// ============================================================================
// Metric Card Sub-Component
// ============================================================================

interface MetricCardProps {
	label: string;
	value: number;
	description: string;
	metric: keyof typeof METRIC_THRESHOLDS;
}

function MetricCard({ label, value, description, metric }: MetricCardProps) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="p-4 bg-muted/30 rounded-lg text-center">
						<div className="text-sm text-muted-foreground mb-1">{label}</div>
						<div className={cn("text-2xl font-bold", getMetricColor(value, metric))}>
							{formatPercentage(value)}
						</div>
						<div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
							<div
								className={cn("h-full transition-all", getMetricBgColor(value, metric))}
								style={{ width: `${Math.min(100, value * 100)}%` }}
							/>
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>{description}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Calibration Bucket Sub-Component
// ============================================================================

interface CalibrationBucketProps {
	bucket: {
		predictedRange: { min: number; max: number };
		count: number;
		actualWins: number;
		actualWinRate: number;
		expectedWinRate: number;
		calibrationError: number;
	};
}

function CalibrationBucket({ bucket }: CalibrationBucketProps) {
	const midpoint = (bucket.predictedRange.min + bucket.predictedRange.max) / 2;
	const isWellCalibrated = Math.abs(bucket.calibrationError) < 0.1;

	return (
		<div className="flex items-center gap-3">
			<div className="w-20 text-sm text-muted-foreground">
				{(bucket.predictedRange.min * 100).toFixed(0)}-{(bucket.predictedRange.max * 100).toFixed(0)}%
			</div>
			<div className="flex-1 relative h-6">
				{/* Expected line */}
				<div
					className="absolute top-0 h-full w-1 bg-blue-500/50"
					style={{ left: `${bucket.expectedWinRate * 100}%` }}
				/>
				{/* Actual bar */}
				<div
					className={cn(
						"absolute top-1 h-4 rounded transition-all",
						isWellCalibrated ? "bg-green-500" : "bg-amber-500"
					)}
					style={{ width: `${bucket.actualWinRate * 100}%` }}
				/>
			</div>
			<div className="w-20 text-right">
				<span className="text-sm font-medium">
					{(bucket.actualWinRate * 100).toFixed(0)}%
				</span>
				<span className="text-xs text-muted-foreground ml-1">
					({bucket.count})
				</span>
			</div>
		</div>
	);
}

export default ModelPerformance;
