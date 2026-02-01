"use client";

/**
 * ConsistencyChecker Component - DocFusion
 *
 * Validates graphic consistency across all documents in an opportunity.
 * Identifies issues and provides quick-fix actions.
 *
 * Features:
 * - Lists orphaned graphics (not referenced)
 * - Lists missing figure references
 * - Shows numbering issues (gaps, duplicates)
 * - Quick fix buttons for common issues
 * - Recommendations for improvements
 *
 * @module components/graphics/ConsistencyChecker
 */

import * as React from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Button,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	validateGraphicConsistency,
	deleteGraphic,
	reorderGraphics,
	type ConsistencyReport,
} from "@/lib/actions/graphics";
import {
	AlertTriangle,
	CheckCircle2,
	RefreshCw,
	Trash2,
	Link2,
	Hash,
	FileQuestion,
	Lightbulb,
	Shield,
	XCircle,
	AlertCircle,
	Wrench,
	ChevronRight,
} from "lucide-react";

// Issue severity styling
const SEVERITY_CONFIG = {
	error: {
		icon: XCircle,
		color: "text-destructive",
		bg: "bg-destructive/10",
		border: "border-destructive/20",
	},
	warning: {
		icon: AlertTriangle,
		color: "text-yellow-600 dark:text-yellow-500",
		bg: "bg-yellow-50 dark:bg-yellow-900/20",
		border: "border-yellow-200 dark:border-yellow-800",
	},
	info: {
		icon: AlertCircle,
		color: "text-blue-600 dark:text-blue-400",
		bg: "bg-blue-50 dark:bg-blue-900/20",
		border: "border-blue-200 dark:border-blue-800",
	},
};

interface IssueRowProps {
	type: "orphaned" | "missing_reference" | "numbering";
	severity: "error" | "warning" | "info";
	title: string;
	description: string;
	onFix?: () => void;
	isFixing?: boolean;
}

/**
 * Individual issue row with fix action
 */
function IssueRow({
	type,
	severity,
	title,
	description,
	onFix,
	isFixing,
}: IssueRowProps) {
	const config = SEVERITY_CONFIG[severity];
	const SeverityIcon = config.icon;

	const typeIcons: Record<string, React.ElementType> = {
		orphaned: FileQuestion,
		missing_reference: Link2,
		numbering: Hash,
	};
	const TypeIcon = typeIcons[type] || AlertCircle;

	return (
		<div
			className={cn(
				"flex items-start gap-3 p-3 rounded-lg border",
				config.bg,
				config.border
			)}
		>
			<div className="flex items-center gap-2">
				<SeverityIcon className={cn("h-4 w-4", config.color)} />
				<TypeIcon className="h-4 w-4 text-muted-foreground" />
			</div>

			<div className="flex-1 min-w-0">
				<h4 className="text-sm font-medium">{title}</h4>
				<p className="text-xs text-muted-foreground mt-0.5">{description}</p>
			</div>

			{onFix && (
				<Button
					variant="outline"
					size="sm"
					onClick={onFix}
					disabled={isFixing}
					className="h-7 text-xs"
				>
					{isFixing ? (
						<RefreshCw className="h-3 w-3 animate-spin" />
					) : (
						<>
							<Wrench className="h-3 w-3 mr-1" />
							Fix
						</>
					)}
				</Button>
			)}
		</div>
	);
}

/**
 * Recommendation item
 */
function RecommendationItem({ text }: { text: string }) {
	return (
		<div className="flex items-start gap-2 text-sm">
			<Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
			<span className="text-muted-foreground">{text}</span>
		</div>
	);
}

/**
 * Success state when no issues found
 */
function AllClearState({ totalGraphics }: { totalGraphics: number }) {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
				<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
			</div>
			<h3 className="text-sm font-medium mb-1">All Graphics Consistent</h3>
			<p className="text-xs text-muted-foreground max-w-xs">
				{totalGraphics === 0
					? "No graphics have been added yet."
					: `All ${totalGraphics} graphic${totalGraphics !== 1 ? "s" : ""} are properly referenced and numbered.`}
			</p>
		</div>
	);
}

/**
 * Loading skeleton
 */
function CheckerSkeleton() {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Skeleton className="h-10 w-10 rounded-full" />
				<div className="flex-1 space-y-1">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-3 w-40" />
				</div>
			</div>
			<div className="space-y-2">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-16 w-full rounded-lg" />
				))}
			</div>
		</div>
	);
}

interface ConsistencyCheckerProps {
	/** Opportunity ID to check */
	opportunityId: string;
	/** Callback when issues are fixed */
	onFixApplied?: () => void;
	/** Additional CSS class names */
	className?: string;
}

/**
 * ConsistencyChecker - Validates and fixes graphic consistency issues.
 *
 * @example
 * ```tsx
 * <ConsistencyChecker
 *   opportunityId={opportunityId}
 *   onFixApplied={() => refreshGraphics()}
 * />
 * ```
 */
export function ConsistencyChecker({
	opportunityId,
	onFixApplied,
	className,
}: ConsistencyCheckerProps) {
	// State
	const [report, setReport] = useState<ConsistencyReport | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [fixingId, setFixingId] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Load consistency report
	const loadReport = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await validateGraphicConsistency(opportunityId);

		if (result.success) {
			setReport(result.data);
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityId]);

	// Initial load
	useEffect(() => {
		loadReport();
	}, [loadReport]);

	// Fix: Delete orphaned graphic
	const handleDeleteOrphaned = useCallback(
		(graphicId: string) => {
			setFixingId(graphicId);

			startTransition(async () => {
				const result = await deleteGraphic(graphicId);

				if (result.success) {
					// Reload report
					await loadReport();
					onFixApplied?.();
				} else {
					setError(result.error);
				}

				setFixingId(null);
			});
		},
		[loadReport, onFixApplied]
	);

	// Calculate issue counts
	const issueCount = report
		? report.orphanedGraphics.length +
		  report.missingReferences.length +
		  report.numberingIssues.length
		: 0;

	const hasIssues = issueCount > 0;

	return (
		<Card className={cn("flex flex-col", className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Shield className="h-4 w-4 text-primary" />
						<CardTitle className="text-sm">Consistency Check</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						{!isLoading && report && (
							<Badge
								variant={hasIssues ? "destructive" : "secondary"}
								className="text-xs"
							>
								{hasIssues ? `${issueCount} issue${issueCount !== 1 ? "s" : ""}` : "OK"}
							</Badge>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={loadReport}
							disabled={isLoading}
							className="h-7"
						>
							<RefreshCw
								className={cn("h-4 w-4", isLoading && "animate-spin")}
							/>
						</Button>
					</div>
				</div>
				<CardDescription className="text-xs">
					Validate graphics across all documents
				</CardDescription>
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden pt-0">
				{/* Error state */}
				{error && (
					<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm mb-3">
						<AlertCircle className="h-4 w-4 flex-shrink-0" />
						<span className="text-xs">{error}</span>
					</div>
				)}

				<ScrollArea className="h-full pr-4">
					{isLoading ? (
						<CheckerSkeleton />
					) : !report ? (
						<div className="text-center py-8 text-muted-foreground">
							<p className="text-sm">Unable to load consistency report</p>
						</div>
					) : !hasIssues ? (
						<AllClearState totalGraphics={report.totalGraphics} />
					) : (
						<div className="space-y-6">
							{/* Summary */}
							<div className="flex items-center gap-4 text-sm">
								<div className="text-center">
									<div className="text-2xl font-bold">{report.totalGraphics}</div>
									<div className="text-xs text-muted-foreground">Total</div>
								</div>
								<div className="text-center">
									<div className="text-2xl font-bold text-green-600">
										{report.referencedGraphics}
									</div>
									<div className="text-xs text-muted-foreground">Referenced</div>
								</div>
								<div className="text-center">
									<div className="text-2xl font-bold text-yellow-600">
										{report.orphanedGraphics.length}
									</div>
									<div className="text-xs text-muted-foreground">Orphaned</div>
								</div>
							</div>

							{/* Orphaned graphics */}
							{report.orphanedGraphics.length > 0 && (
								<div className="space-y-2">
									<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Orphaned Graphics
									</h4>
									{report.orphanedGraphics.map((id) => (
										<IssueRow
											key={id}
											type="orphaned"
											severity="warning"
											title={`Graphic ${id.substring(0, 8)}...`}
											description="This graphic is not referenced in any document"
											onFix={() => handleDeleteOrphaned(id)}
											isFixing={fixingId === id}
										/>
									))}
								</div>
							)}

							{/* Missing references */}
							{report.missingReferences.length > 0 && (
								<div className="space-y-2">
									<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Missing References
									</h4>
									{report.missingReferences.map((ref, i) => (
										<IssueRow
											key={i}
											type="missing_reference"
											severity="error"
											title={ref.referenceText}
											description={`References a non-existent graphic in document ${ref.documentId.substring(0, 8)}...`}
										/>
									))}
								</div>
							)}

							{/* Numbering issues */}
							{report.numberingIssues.length > 0 && (
								<div className="space-y-2">
									<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Numbering Issues
									</h4>
									{report.numberingIssues.map((issue, i) => (
										<IssueRow
											key={i}
											type="numbering"
											severity="info"
											title="Figure Numbering"
											description={issue}
										/>
									))}
								</div>
							)}

							{/* Recommendations */}
							{report.recommendations.length > 0 && (
								<div className="space-y-2 pt-2 border-t">
									<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Recommendations
									</h4>
									<div className="space-y-2">
										{report.recommendations.map((rec, i) => (
											<RecommendationItem key={i} text={rec} />
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
