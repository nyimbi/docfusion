/**
 * FormatValidator Component
 *
 * Displays format validation results with score indicator,
 * issue list grouped by severity, and re-validation capability.
 */

"use client";

import * as React from "react";
import {
	AlertCircle,
	AlertTriangle,
	Info,
	RefreshCw,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FileCheck,
	Wrench,
	ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type {
	FormatValidationResult,
	FormatIssue,
	FormatFormatIssueSeverity,
	IssueCategory,
} from "@/lib/types/formatting";
import { useFormatValidation } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface FormatValidatorProps {
	/** Document ID to validate */
	documentId: string;
	/** Template ID to validate against (optional) */
	templateId?: string;
	/** Show detailed issue information */
	showDetails?: boolean;
	/** Callback when an issue is clicked */
	onIssueClick?: (issue: FormatIssue) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_CONFIG: Record<
	FormatIssueSeverity,
	{ label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
	critical: {
		label: "Critical",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		icon: AlertCircle,
	},
	major: {
		label: "Major",
		color: "text-yellow-600 dark:text-yellow-400",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
		icon: AlertTriangle,
	},
	minor: {
		label: "Minor",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		icon: Info,
	},
};

const CATEGORY_LABELS: Record<IssueCategory, string> = {
	"page-limit": "Page Limits",
	margins: "Margins",
	font: "Typography",
	spacing: "Line Spacing",
	headers: "Headers",
	"page-numbers": "Page Numbers",
	accessibility: "Accessibility",
	structure: "Document Structure",
	figures: "Figures",
	tables: "Tables",
	"cross-references": "Cross-References",
	consistency: "Consistency",
	compliance: "Compliance",
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Score gauge visualization.
 */
interface ScoreGaugeProps {
	score: number;
	size?: "sm" | "md" | "lg";
}

function ScoreGauge({ score, size = "md" }: ScoreGaugeProps) {
	const getScoreColor = (s: number) => {
		if (s >= 90) return "text-green-600 dark:text-green-400";
		if (s >= 70) return "text-yellow-600 dark:text-yellow-400";
		if (s >= 50) return "text-orange-600 dark:text-orange-400";
		return "text-red-600 dark:text-red-400";
	};

	const getProgressColor = (s: number) => {
		if (s >= 90) return "bg-green-500";
		if (s >= 70) return "bg-yellow-500";
		if (s >= 50) return "bg-orange-500";
		return "bg-red-500";
	};

	const sizeClasses = {
		sm: "h-16 w-16 text-lg",
		md: "h-24 w-24 text-2xl",
		lg: "h-32 w-32 text-3xl",
	};

	return (
		<div className="flex flex-col items-center gap-2">
			<div
				className={cn(
					"relative rounded-full border-4 flex items-center justify-center",
					sizeClasses[size],
					score >= 90
						? "border-green-500"
						: score >= 70
						? "border-yellow-500"
						: score >= 50
						? "border-orange-500"
						: "border-red-500"
				)}
			>
				<span className={cn("font-bold", getScoreColor(score))}>{score}</span>
			</div>
			<div className="w-full max-w-[120px]">
				<Progress
					value={score}
					className={cn("h-2", `[&>div]:${getProgressColor(score)}`)}
				/>
			</div>
			<span className="text-xs text-muted-foreground">
				{score >= 90
					? "Excellent"
					: score >= 70
					? "Good"
					: score >= 50
					? "Needs Work"
					: "Critical Issues"}
			</span>
		</div>
	);
}

/**
 * Issue severity badge.
 */
function SeverityBadge({ severity }: { severity: FormatIssueSeverity }) {
	const config = SEVERITY_CONFIG[severity];
	const Icon = config.icon;

	return (
		<Badge
			variant="outline"
			className={cn("gap-1", config.color, config.bgColor, "border-current")}
		>
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	);
}

/**
 * Single issue item display.
 */
interface IssueItemProps {
	issue: FormatIssue;
	showDetails: boolean;
	onClick?: () => void;
	onAutoFix?: () => void;
	isFixing?: boolean;
}

function IssueItem({ issue, showDetails, onClick, onAutoFix, isFixing }: IssueItemProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);
	const config = SEVERITY_CONFIG[issue.severity];
	const Icon = config.icon;

	return (
		<div
			className={cn(
				"border rounded-lg p-3 transition-colors",
				onClick && "cursor-pointer hover:bg-accent/50"
			)}
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className={cn("mt-0.5", config.color)}>
					<Icon className="h-5 w-5" />
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-medium">{issue.title}</span>
						<SeverityBadge severity={issue.severity} />
						{issue.category && (
							<Badge variant="secondary" className="text-xs">
								{CATEGORY_LABELS[issue.category]}
							</Badge>
						)}
					</div>

					<p className="text-sm text-muted-foreground mt-1">{issue.description}</p>

					{issue.location && (
						<p className="text-xs text-muted-foreground mt-1">
							{issue.location.page && `Page ${issue.location.page}`}
							{issue.location.section && `, Section ${issue.location.section}`}
						</p>
					)}

					{showDetails && (
						<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="mt-2 h-7 text-xs"
									onClick={(e) => e.stopPropagation()}
								>
									{isExpanded ? (
										<ChevronDown className="h-3 w-3 mr-1" />
									) : (
										<ChevronRight className="h-3 w-3 mr-1" />
									)}
									{isExpanded ? "Hide Details" : "Show Details"}
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-2 space-y-2">
								{issue.suggestion && (
									<div className="p-2 bg-muted/50 rounded text-sm">
										<span className="font-medium">Suggestion: </span>
										{issue.suggestion}
									</div>
								)}
								{issue.regulatoryReference && (
									<div className="flex items-center gap-1 text-xs text-muted-foreground">
										<ExternalLink className="h-3 w-3" />
										Reference: {issue.regulatoryReference}
									</div>
								)}
								{issue.autoFixable && onAutoFix && (
									<Button
										variant="outline"
										size="sm"
										onClick={(e) => {
											e.stopPropagation();
											onAutoFix();
										}}
										disabled={isFixing}
										className="h-7 text-xs"
									>
										<Wrench className="h-3 w-3 mr-1" />
										{isFixing ? "Fixing..." : "Auto-Fix"}
									</Button>
								)}
							</CollapsibleContent>
						</Collapsible>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * Loading skeleton for validator.
 */
function ValidatorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-64 mt-1" />
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex justify-center">
					<Skeleton className="h-24 w-24 rounded-full" />
				</div>
				<div className="flex justify-center gap-4">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-24" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function FormatValidator({
	documentId,
	templateId,
	showDetails = true,
	onIssueClick,
	className,
}: FormatValidatorProps) {
	// Use hook for validation
	const { result, isValidating, error, revalidate: validate } = useFormatValidation(documentId);
	const [fixingIssues, setFixingIssues] = React.useState<Set<string>>(new Set());

	// Group issues by severity
	const issuesBySeverity = React.useMemo(() => {
		if (!result) return { critical: [], major: [], minor: [] };

		return {
			critical: result.issues.filter((i) => i.severity === "critical"),
			major: result.issues.filter((i) => i.severity === "major"),
			minor: result.issues.filter((i) => i.severity === "minor"),
		};
	}, [result]);

	// Auto-fix a single issue (placeholder - would need actual implementation)
	const handleAutoFix = React.useCallback(
		async (issueId: string) => {
			setFixingIssues((prev) => new Set(prev).add(issueId));

			// Simulate auto-fix
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await validate();

			setFixingIssues((prev) => {
				const next = new Set(prev);
				next.delete(issueId);
				return next;
			});
		},
		[validate]
	);

	// Loading state
	if (isValidating && !result) {
		return <ValidatorSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<FileCheck className="h-5 w-5" />
						Format Validation
					</CardTitle>
					<CardDescription>
						Check document formatting compliance
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={validate}
					disabled={isValidating}
				>
					<RefreshCw
						className={cn("h-4 w-4 mr-2", isValidating && "animate-spin")}
					/>
					Re-validate
				</Button>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Validation Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{result && (
					<>
						{/* Score Display */}
						<div className="flex justify-center py-4">
							<ScoreGauge score={result.score} />
						</div>

						{/* Issue Count Summary */}
						<div className="flex justify-center gap-4 flex-wrap">
							{(["critical", "major", "minor"] as FormatIssueSeverity[]).map((severity) => {
								const count = result.issueCounts[severity];
								const config = SEVERITY_CONFIG[severity];
								const Icon = config.icon;

								return (
									<div
										key={severity}
										className={cn(
											"flex items-center gap-2 px-3 py-2 rounded-lg",
											config.bgColor
										)}
									>
										<Icon className={cn("h-4 w-4", config.color)} />
										<span className={cn("font-medium", config.color)}>
											{count} {config.label}
										</span>
									</div>
								);
							})}
						</div>

						{/* No Issues */}
						{result.issues.length === 0 && (
							<div className="flex flex-col items-center py-8 text-center">
								<CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
								<h3 className="font-medium text-lg">All Checks Passed</h3>
								<p className="text-sm text-muted-foreground">
									Your document meets all formatting requirements.
								</p>
							</div>
						)}

						{/* Issues by Severity */}
						{result.issues.length > 0 && (
							<Accordion
								type="multiple"
								defaultValue={["critical", "major"]}
								className="space-y-2"
							>
								{(["critical", "major", "minor"] as FormatIssueSeverity[]).map((severity) => {
									const issues = issuesBySeverity[severity];
									if (issues.length === 0) return null;

									const config = SEVERITY_CONFIG[severity];

									return (
										<AccordionItem
											key={severity}
											value={severity}
											className="border rounded-lg px-4"
										>
											<AccordionTrigger className="hover:no-underline">
												<div className="flex items-center gap-2">
													<SeverityBadge severity={severity} />
													<span className="text-sm text-muted-foreground">
														({issues.length} issue{issues.length !== 1 ? "s" : ""})
													</span>
												</div>
											</AccordionTrigger>
											<AccordionContent>
												<div className="space-y-2 pt-2">
													{issues.map((issue) => (
														<IssueItem
															key={issue.id}
															issue={issue}
															showDetails={showDetails}
															onClick={
																onIssueClick
																	? () => onIssueClick(issue)
																	: undefined
															}
															onAutoFix={
																issue.autoFixable
																	? () => handleAutoFix(issue.id)
																	: undefined
															}
															isFixing={fixingIssues.has(issue.id)}
														/>
													))}
												</div>
											</AccordionContent>
										</AccordionItem>
									);
								})}
							</Accordion>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default FormatValidator;
