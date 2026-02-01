/**
 * CostTechnicalAlignment - Cost-Technical Alignment Validation
 *
 * Side-by-side view of technical sections and cost elements with
 * alignment score, issues list, and linking capabilities.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Link,
	Unlink,
	AlertTriangle,
	CheckCircle2,
	AlertCircle,
	Loader2,
	RefreshCw,
	FileText,
	DollarSign,
	ChevronRight,
	Info,
	Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

import type {
	CostTechnicalAlignment as AlignmentData,
	UIAlignmentIssue as AlignmentIssue,
	AlignmentStatus,
	AlignmentReport,
} from "@/lib/types/pricing";
import { validateCostTechnicalAlignment, linkCostToTechnical } from "@/lib/actions/pricing";

// Transform AlignmentReport from server action to AlignmentData for UI
function transformToUIAlignment(
	opportunityId: string,
	report: AlignmentReport
): AlignmentData {
	// Create technical sections from issues (server doesn't return full section list)
	const sectionMap = new Map<string, AlignmentData["technicalSections"][0]>();

	for (const issue of report.issues) {
		if (!sectionMap.has(issue.sectionId)) {
			sectionMap.set(issue.sectionId, {
				sectionId: issue.sectionId,
				sectionName: issue.sectionName,
				linkedWbsNodes: [],
				alignmentStatus: "mismatch" as AlignmentStatus,
				costAmount: null,
				issues: [],
			});
		}
		const section = sectionMap.get(issue.sectionId)!;
		section.issues.push(issue.issue);
	}

	const technicalSections = Array.from(sectionMap.values());

	// Transform issues to UI format
	const issues: AlignmentIssue[] = report.issues.map((issue, idx) => ({
		id: `issue-${idx}`,
		type: issue.issue.includes("no linked cost") ? "missing_cost"
			: issue.issue.includes("not linked") ? "missing_technical"
			: "scope_mismatch",
		severity: issue.severity === "critical" ? "error"
			: issue.severity === "major" ? "warning"
			: "info",
		message: issue.issue,
		recommendation: issue.suggestion,
		technicalSectionName: issue.sectionName,
		wbsCode: undefined,
	}));

	return {
		opportunityId,
		overallScore: report.overallScore,
		technicalSections,
		wbsNodes: [], // Server doesn't return WBS node details
		issues,
		recommendations: report.recommendations,
		analyzedAt: new Date(),
	};
}

// =============================================================================
// Types
// =============================================================================

export interface CostTechnicalAlignmentProps {
	/** Opportunity ID to analyze */
	opportunityId: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<
	AlignmentStatus,
	{ label: string; icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
	aligned: {
		label: "Aligned",
		icon: CheckCircle2,
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	partial: {
		label: "Partial",
		icon: AlertTriangle,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	unlinked: {
		label: "Unlinked",
		icon: Unlink,
		color: "text-gray-600 dark:text-gray-400",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
	mismatch: {
		label: "Mismatch",
		icon: AlertCircle,
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
};

const SEVERITY_CONFIG: Record<
	"info" | "warning" | "error",
	{ label: string; icon: typeof Info; color: string }
> = {
	info: {
		label: "Info",
		icon: Info,
		color: "text-blue-600 dark:text-blue-400",
	},
	warning: {
		label: "Warning",
		icon: AlertTriangle,
		color: "text-amber-600 dark:text-amber-400",
	},
	error: {
		label: "Error",
		icon: AlertCircle,
		color: "text-red-600 dark:text-red-400",
	},
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(value: number | null): string {
	if (value === null) return "-";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function AlignmentSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-64 w-full" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Score Gauge
// =============================================================================

interface ScoreGaugeProps {
	score: number;
}

function ScoreGauge({ score }: ScoreGaugeProps) {
	const getColor = () => {
		if (score >= 80) return "text-green-600";
		if (score >= 60) return "text-amber-600";
		return "text-red-600";
	};

	const getLabel = () => {
		if (score >= 80) return "Good Alignment";
		if (score >= 60) return "Partial Alignment";
		return "Poor Alignment";
	};

	return (
		<div className="flex items-center gap-4">
			<div className="relative w-24 h-24">
				<svg viewBox="0 0 100 100" className="transform -rotate-90">
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
						strokeDasharray={`${(score / 100) * 251.3} 251.3`}
						className={getColor()}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className={cn("text-2xl font-bold", getColor())}>{score}</span>
				</div>
			</div>
			<div>
				<div className={cn("text-lg font-semibold", getColor())}>{getLabel()}</div>
				<div className="text-sm text-muted-foreground">Alignment Score</div>
			</div>
		</div>
	);
}

// =============================================================================
// Technical Section List
// =============================================================================

interface TechnicalSectionListProps {
	sections: AlignmentData["technicalSections"];
	onLinkClick: (sectionId: string) => void;
}

function TechnicalSectionList({ sections, onLinkClick }: TechnicalSectionListProps) {
	if (sections.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				No technical sections found
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{sections.map((section) => {
				const statusConfig = STATUS_CONFIG[section.alignmentStatus];
				const StatusIcon = statusConfig.icon;

				return (
					<div
						key={section.sectionId}
						className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
					>
						<div className="flex items-start justify-between gap-2">
							<div className="flex items-start gap-2">
								<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
								<div>
									<div className="font-medium">{section.sectionName}</div>
									{section.linkedWbsNodes.length > 0 && (
										<div className="text-xs text-muted-foreground mt-0.5">
											Linked to {section.linkedWbsNodes.length} WBS node(s)
										</div>
									)}
									{section.issues.length > 0 && (
										<div className="text-xs text-amber-600 mt-0.5">
											{section.issues.length} issue(s)
										</div>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								{section.costAmount !== null && (
									<span className="text-sm font-mono">
										{formatCurrency(section.costAmount)}
									</span>
								)}
								<Badge
									variant="secondary"
									className={cn("gap-1", statusConfig.bgColor, statusConfig.color)}
								>
									<StatusIcon className="h-3 w-3" />
									{statusConfig.label}
								</Badge>
								{section.alignmentStatus === "unlinked" && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7"
													onClick={() => onLinkClick(section.sectionId)}
												>
													<Link className="h-3 w-3" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Link to cost element</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// =============================================================================
// WBS Node List
// =============================================================================

interface WBSNodeListProps {
	nodes: AlignmentData["wbsNodes"];
}

function WBSNodeList({ nodes }: WBSNodeListProps) {
	if (nodes.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				No WBS nodes found
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{nodes.map((node) => {
				const statusConfig = STATUS_CONFIG[node.alignmentStatus];
				const StatusIcon = statusConfig.icon;

				return (
					<div
						key={node.nodeId}
						className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
					>
						<div className="flex items-start justify-between gap-2">
							<div className="flex items-start gap-2">
								<DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
								<div>
									<div className="font-medium">
										<span className="font-mono text-xs text-muted-foreground mr-2">
											{node.wbsCode}
										</span>
										{node.title}
									</div>
									{node.linkedSections.length > 0 && (
										<div className="text-xs text-muted-foreground mt-0.5">
											Linked to {node.linkedSections.length} section(s)
										</div>
									)}
								</div>
							</div>
							<Badge
								variant="secondary"
								className={cn("gap-1", statusConfig.bgColor, statusConfig.color)}
							>
								<StatusIcon className="h-3 w-3" />
								{statusConfig.label}
							</Badge>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// =============================================================================
// Issues List
// =============================================================================

interface IssuesListProps {
	issues: AlignmentIssue[];
}

function IssuesList({ issues }: IssuesListProps) {
	if (issues.length === 0) {
		return (
			<div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
				<CheckCircle2 className="h-5 w-5 text-green-600" />
				<span className="text-green-800 dark:text-green-300">
					No alignment issues found
				</span>
			</div>
		);
	}

	const groupedByType = issues.reduce((acc, issue) => {
		if (!acc[issue.type]) acc[issue.type] = [];
		acc[issue.type].push(issue);
		return acc;
	}, {} as Record<string, AlignmentIssue[]>);

	const typeLabels: Record<string, string> = {
		missing_cost: "Missing Cost Elements",
		missing_technical: "Missing Technical Sections",
		scope_mismatch: "Scope Mismatches",
		hours_mismatch: "Hours Discrepancies",
	};

	return (
		<div className="space-y-4">
			{Object.entries(groupedByType).map(([type, typeIssues]) => (
				<div key={type}>
					<h4 className="text-sm font-medium mb-2">{typeLabels[type] || type}</h4>
					<div className="space-y-2">
						{typeIssues.map((issue) => {
							const severityConfig = SEVERITY_CONFIG[issue.severity];
							const SeverityIcon = severityConfig.icon;

							return (
								<div
									key={issue.id}
									className="p-3 border rounded-lg"
								>
									<div className="flex items-start gap-2">
										<SeverityIcon
											className={cn("h-4 w-4 mt-0.5", severityConfig.color)}
										/>
										<div className="flex-1">
											<div className="text-sm">{issue.message}</div>
											{issue.recommendation && (
												<div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
													<Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
													{issue.recommendation}
												</div>
											)}
											<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
												{issue.technicalSectionName && (
													<span className="flex items-center gap-1">
														<FileText className="h-3 w-3" />
														{issue.technicalSectionName}
													</span>
												)}
												{issue.wbsCode && (
													<span className="flex items-center gap-1">
														<DollarSign className="h-3 w-3" />
														{issue.wbsCode}
													</span>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// Recommendations Panel
// =============================================================================

interface RecommendationsPanelProps {
	recommendations: string[];
}

function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
	if (recommendations.length === 0) return null;

	return (
		<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
			<div className="flex items-center gap-2 mb-2">
				<Lightbulb className="h-4 w-4 text-blue-600" />
				<span className="font-medium text-blue-800 dark:text-blue-300">
					Recommendations
				</span>
			</div>
			<ul className="space-y-1">
				{recommendations.map((rec, index) => (
					<li key={index} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
						<ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
						{rec}
					</li>
				))}
			</ul>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CostTechnicalAlignment({
	opportunityId,
	className,
}: CostTechnicalAlignmentProps) {
	// State
	const [alignment, setAlignment] = useState<AlignmentData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	// Load alignment data
	useEffect(() => {
		async function loadAlignment() {
			setIsLoading(true);
			setError(null);

			const result = await validateCostTechnicalAlignment(opportunityId);
			if (result.success && result.data) {
				const uiAlignment = transformToUIAlignment(opportunityId, result.data);
				setAlignment(uiAlignment);
			} else if (!result.success) {
				setError(result.error || "Failed to analyze alignment");
			}
			setIsLoading(false);
		}
		loadAlignment();
	}, [opportunityId]);

	// Handle re-analyze
	const handleReanalyze = useCallback(async () => {
		setIsAnalyzing(true);
		const result = await validateCostTechnicalAlignment(opportunityId);
		if (result.success && result.data) {
			const uiAlignment = transformToUIAlignment(opportunityId, result.data);
			setAlignment(uiAlignment);
		}
		setIsAnalyzing(false);
	}, [opportunityId]);

	// Handle link section
	const handleLinkClick = useCallback((sectionId: string) => {
		// Would open a dialog to select cost element to link
		console.log("Link section:", sectionId);
	}, []);

	// Loading state
	if (isLoading) {
		return <AlignmentSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Link className="h-5 w-5" />
						Cost-Technical Alignment
					</CardTitle>

					<Button
						variant="outline"
						onClick={handleReanalyze}
						disabled={isAnalyzing}
					>
						{isAnalyzing ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Re-analyze
							</>
						)}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* No Data State */}
				{!alignment && !error && (
					<div className="text-center py-12">
						<Link className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No alignment data</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Add technical sections and cost elements to analyze alignment
						</p>
					</div>
				)}

				{/* Alignment Content */}
				{alignment && (
					<>
						{/* Score Gauge */}
						<div className="flex items-center justify-between">
							<ScoreGauge score={alignment.overallScore} />
							<div className="text-right text-sm text-muted-foreground">
								<div>
									{alignment.technicalSections.filter((s) => s.alignmentStatus === "aligned").length} of{" "}
									{alignment.technicalSections.length} sections aligned
								</div>
								<div>
									{alignment.wbsNodes.filter((n) => n.alignmentStatus === "aligned").length} of{" "}
									{alignment.wbsNodes.length} WBS nodes linked
								</div>
								<div className="mt-1 text-xs">
									Last analyzed: {new Date(alignment.analyzedAt).toLocaleString()}
								</div>
							</div>
						</div>

						<Separator />

						{/* Side-by-side view */}
						<ResizablePanelGroup orientation="horizontal" className="min-h-[400px]">
							{/* Technical Sections */}
							<ResizablePanel defaultSize={50}>
								<div className="h-full pr-2">
									<h3 className="flex items-center gap-2 font-medium mb-3">
										<FileText className="h-4 w-4" />
										Technical Sections
										<Badge variant="secondary">
											{alignment.technicalSections.length}
										</Badge>
									</h3>
									<ScrollArea className="h-[350px]">
										<TechnicalSectionList
											sections={alignment.technicalSections}
											onLinkClick={handleLinkClick}
										/>
									</ScrollArea>
								</div>
							</ResizablePanel>

							<ResizableHandle />

							{/* WBS Nodes */}
							<ResizablePanel defaultSize={50}>
								<div className="h-full pl-2">
									<h3 className="flex items-center gap-2 font-medium mb-3">
										<DollarSign className="h-4 w-4" />
										WBS Elements
										<Badge variant="secondary">{alignment.wbsNodes.length}</Badge>
									</h3>
									<ScrollArea className="h-[350px]">
										<WBSNodeList nodes={alignment.wbsNodes} />
									</ScrollArea>
								</div>
							</ResizablePanel>
						</ResizablePanelGroup>

						<Separator />

						{/* Issues */}
						<div>
							<h3 className="flex items-center gap-2 font-medium mb-3">
								<AlertTriangle className="h-4 w-4" />
								Alignment Issues
								{alignment.issues.length > 0 && (
									<Badge variant="destructive">{alignment.issues.length}</Badge>
								)}
							</h3>
							<IssuesList issues={alignment.issues} />
						</div>

						{/* Recommendations */}
						<RecommendationsPanel recommendations={alignment.recommendations} />
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default CostTechnicalAlignment;
