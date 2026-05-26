"use client";

/**
 * RFP Parse Progress Component
 *
 * Displays real-time parsing progress for RFP documents with
 * step-by-step status updates and error handling.
 */

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import {
	CheckCircle2,
	Circle,
	Loader2,
	AlertCircle,
	FileText,
	Search,
	ListTree,
	Tags,
	Brain,
	RefreshCw,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ParsingStep {
	id: string;
	name: string;
	description: string;
	icon: React.ReactNode;
	status: "pending" | "processing" | "completed" | "error";
}

interface ParsingJobStatus {
	status: "queued" | "processing" | "completed" | "failed" | "cancelled";
	currentStep: string | null;
	progress: number;
	pagesProcessed: number | null;
	requirementsExtracted: number | null;
	processingTimeMs: number | null;
	errorMessage: string | null;
}

interface RFPParseProgressProps {
	/** RFP Document ID to track */
	rfpDocumentId: string;
	/** Optional destination once parsing has completed */
	completionHref?: string;
	/** Label for the completion destination */
	completionLabel?: string;
	/** Callback when parsing completes */
	onComplete?: (requirementsCount: number) => void;
	/** Callback on parsing error */
	onError?: (error: string) => void;
	/** Polling interval in ms (default: 2000) */
	pollInterval?: number;
	/** Custom class name */
	className?: string;
}

// Parsing steps configuration
const PARSING_STEPS: Omit<ParsingStep, "status">[] = [
	{
		id: "upload",
		name: "Upload",
		description: "Document uploaded and queued",
		icon: <FileText className="h-4 w-4" />,
	},
	{
		id: "text_extraction",
		name: "Text Extraction",
		description: "Extracting text from document",
		icon: <FileText className="h-4 w-4" />,
	},
	{
		id: "section_detection",
		name: "Section Detection",
		description: "Identifying document sections",
		icon: <ListTree className="h-4 w-4" />,
	},
	{
		id: "requirement_extraction",
		name: "Requirements",
		description: "Extracting requirements",
		icon: <Search className="h-4 w-4" />,
	},
	{
		id: "classification",
		name: "Classification",
		description: "Categorizing requirements",
		icon: <Tags className="h-4 w-4" />,
	},
	{
		id: "embedding",
		name: "AI Analysis",
		description: "Generating semantic embeddings",
		icon: <Brain className="h-4 w-4" />,
	},
];

function resolveCurrentStepIndex(status: ParsingJobStatus["status"], currentStep: string | null, progress: number): number {
	const normalized = (currentStep ?? "").toLowerCase();

	if (status === "queued") return 0;
	if (normalized.includes("text")) return 1;
	if (normalized.includes("structure") || normalized.includes("section")) return 2;
	if (normalized.includes("requirement")) return 3;
	if (normalized.includes("classif") || normalized.includes("stor")) return 4;
	if (normalized.includes("embedding") || normalized.includes("analysis") || normalized.includes("final")) return 5;
	if (normalized.includes("complete")) return PARSING_STEPS.length - 1;

	if (progress >= 90) return 5;
	if (progress >= 70) return 4;
	if (progress >= 50) return 3;
	if (progress >= 30) return 2;
	if (progress >= 10) return 1;
	return 0;
}

// ============================================================================
// Component
// ============================================================================

export function RFPParseProgress({
	rfpDocumentId,
	completionHref,
	completionLabel = "Review Requirements",
	onComplete,
	onError,
	pollInterval = 2000,
	className,
}: RFPParseProgressProps) {
	const [jobStatus, setJobStatus] = useState<ParsingJobStatus | null>(null);
	const [steps, setSteps] = useState<ParsingStep[]>(
		PARSING_STEPS.map((s) => ({ ...s, status: "pending" as const }))
	);
	const [isPolling, setIsPolling] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch current parsing status
	const fetchStatus = useCallback(async () => {
		try {
			const response = await fetch(`/api/v1/rfp/${rfpDocumentId}/status`);
			if (!response.ok) {
				throw new Error("Failed to fetch parsing status");
			}
			const data: ParsingJobStatus = await response.json();
			setJobStatus(data);

			// Update step statuses based on current step
			const currentStepIndex = resolveCurrentStepIndex(data.status, data.currentStep, data.progress);
			setSteps((prev) =>
				prev.map((step, index) => {
					if (index < currentStepIndex) {
						return { ...step, status: "completed" };
					}
					if (index === currentStepIndex) {
						return { ...step, status: data.status === "failed" ? "error" : "processing" };
					}
					return { ...step, status: "pending" };
				})
			);

			// Handle completion
			if (data.status === "completed") {
				setIsPolling(false);
				setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" })));
				onComplete?.(data.requirementsExtracted ?? 0);
			}

			// Handle failure
			if (data.status === "failed") {
				setIsPolling(false);
				setError(data.errorMessage ?? "Parsing failed");
				onError?.(data.errorMessage ?? "Parsing failed");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch status");
			setIsPolling(false);
		}
	}, [rfpDocumentId, onComplete, onError]);

	// Poll for status updates
	useEffect(() => {
		if (!isPolling) return;

		fetchStatus();
		const interval = setInterval(fetchStatus, pollInterval);

		return () => clearInterval(interval);
	}, [isPolling, pollInterval, fetchStatus]);

	// Retry parsing
	const handleRetry = async () => {
		setError(null);
		setSteps(PARSING_STEPS.map((s) => ({ ...s, status: "pending" })));
		setIsPolling(true);

		try {
			await fetch(`/api/v1/rfp/${rfpDocumentId}/parse`, { method: "POST" });
		} catch (err) {
			setError("Failed to restart parsing");
		}
	};

	// Get step status icon
	const getStepIcon = (step: ParsingStep) => {
		switch (step.status) {
			case "completed":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "processing":
				return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
			case "error":
				return <AlertCircle className="h-5 w-5 text-destructive" />;
			default:
				return <Circle className="h-5 w-5 text-muted-foreground" />;
		}
	};

	// Calculate overall progress
	const overallProgress = jobStatus?.progress ?? 0;

	// Format processing time
	const formatTime = (ms: number): string => {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
	};

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							{jobStatus?.status === "completed" ? (
								<CheckCircle2 className="h-5 w-5 text-green-500" />
							) : jobStatus?.status === "failed" ? (
								<AlertCircle className="h-5 w-5 text-destructive" />
							) : (
								<Loader2 className="h-5 w-5 animate-spin text-primary" />
							)}
							RFP Parsing
						</CardTitle>
						<CardDescription>
							{jobStatus?.status === "completed"
								? "Parsing completed successfully"
								: jobStatus?.status === "failed"
								? "Parsing failed"
								: "Analyzing your RFP document..."}
						</CardDescription>
					</div>
					<Badge
						variant={
							jobStatus?.status === "completed"
								? "default"
								: jobStatus?.status === "failed"
								? "destructive"
								: "secondary"
						}
					>
						{jobStatus?.status ?? "Loading..."}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Overall Progress */}
				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span>Overall Progress</span>
						<span className="font-medium">{overallProgress}%</span>
					</div>
					<Progress value={overallProgress} className="h-2" />
				</div>

				{/* Step Progress */}
				<div className="space-y-3">
					{steps.map((step, index) => (
						<div
							key={step.id}
							className={cn(
								"flex items-center gap-3 p-3 rounded-lg border transition-colors",
								step.status === "processing" && "bg-primary/5 border-primary/20",
								step.status === "completed" && "bg-green-50/50 border-green-200/50 dark:bg-green-950/20",
								step.status === "error" && "bg-destructive/5 border-destructive/20"
							)}
						>
							{getStepIcon(step)}
							<div className="flex-1">
								<p
									className={cn(
										"text-sm font-medium",
										step.status === "pending" && "text-muted-foreground"
									)}
								>
									{step.name}
								</p>
								<p className="text-xs text-muted-foreground">{step.description}</p>
							</div>
							{step.status === "completed" && index < steps.length - 1 && (
								<div className="h-8 w-px bg-green-200 dark:bg-green-800 -mb-11 ml-2.5 -z-10" />
							)}
						</div>
					))}
				</div>

				{/* Statistics */}
				{jobStatus && (jobStatus.pagesProcessed || jobStatus.requirementsExtracted) && (
					<div className="grid grid-cols-3 gap-4 pt-4 border-t">
						{jobStatus.pagesProcessed && (
							<div className="text-center">
								<p className="text-2xl font-bold">{jobStatus.pagesProcessed}</p>
								<p className="text-xs text-muted-foreground">Pages Processed</p>
							</div>
						)}
						{jobStatus.requirementsExtracted && (
							<div className="text-center">
								<p className="text-2xl font-bold">{jobStatus.requirementsExtracted}</p>
								<p className="text-xs text-muted-foreground">Requirements Found</p>
							</div>
						)}
						{jobStatus.processingTimeMs && (
							<div className="text-center">
								<p className="text-2xl font-bold">
									{formatTime(jobStatus.processingTimeMs)}
								</p>
								<p className="text-xs text-muted-foreground">Processing Time</p>
							</div>
						)}
					</div>
				)}

				{jobStatus?.status === "completed" && completionHref && (
					<div className="flex justify-end border-t pt-4">
						<Button asChild size="sm">
							<a href={completionHref}>{completionLabel}</a>
						</Button>
					</div>
				)}

				{/* Error State */}
				{error && (
					<div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
						<div className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-destructive" />
							<p className="text-sm text-destructive">{error}</p>
						</div>
						<Button variant="outline" size="sm" onClick={handleRetry}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default RFPParseProgress;
