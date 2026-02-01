/**
 * AccessibilityChecker Component
 *
 * Section 508 and WCAG compliance checker with score display,
 * issue categorization, and remediation guidance.
 */

"use client";

import * as React from "react";
import {
	Accessibility,
	AlertCircle,
	AlertTriangle,
	Info,
	CheckCircle2,
	RefreshCw,
	ChevronDown,
	ChevronRight,
	Image,
	Palette,
	Navigation,
	Table2,
	FormInput,
	Video,
	FileText,
	Keyboard,
	Clock,
	Shield,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type {
	AccessibilityResult,
	AccessibilityIssue,
	AccessibilityCategory,
	WCAGLevel,
} from "@/lib/types/formatting";
import { useAccessibilityCheck } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface AccessibilityCheckerProps {
	/** Document ID to check */
	documentId: string;
	/** Target WCAG level */
	targetLevel?: WCAGLevel;
	/** Callback when an issue is clicked */
	onIssueClick?: (issue: AccessibilityIssue) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_CONFIG: Record<
	AccessibilityCategory,
	{ label: string; icon: React.ElementType; description: string }
> = {
	images: {
		label: "Images",
		icon: Image,
		description: "Alternative text and decorative images",
	},
	color: {
		label: "Color",
		icon: Palette,
		description: "Color contrast and color-only information",
	},
	navigation: {
		label: "Navigation",
		icon: Navigation,
		description: "Heading structure and link text",
	},
	tables: {
		label: "Tables",
		icon: Table2,
		description: "Table headers and complex tables",
	},
	forms: {
		label: "Forms",
		icon: FormInput,
		description: "Form labels and error messages",
	},
	multimedia: {
		label: "Multimedia",
		icon: Video,
		description: "Captions and transcripts",
	},
	documents: {
		label: "Documents",
		icon: FileText,
		description: "Reading order and language",
	},
	keyboard: {
		label: "Keyboard",
		icon: Keyboard,
		description: "Keyboard navigation and focus",
	},
	timing: {
		label: "Timing",
		icon: Clock,
		description: "Auto-refresh and time limits",
	},
};

const IMPACT_CONFIG: Record<
	AccessibilityIssue["impact"],
	{ label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
	critical: {
		label: "Critical",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		icon: AlertCircle,
	},
	serious: {
		label: "Serious",
		color: "text-orange-600 dark:text-orange-400",
		bgColor: "bg-orange-100 dark:bg-orange-900/30",
		icon: AlertTriangle,
	},
	moderate: {
		label: "Moderate",
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

const WCAG_LEVEL_COLORS: Record<WCAGLevel, string> = {
	A: "bg-yellow-500",
	AA: "bg-green-500",
	AAA: "bg-blue-500",
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * WCAG level indicator badge.
 */
interface WCAGLevelBadgeProps {
	level: WCAGLevel | null;
	targetLevel: WCAGLevel;
	achieved?: boolean;
}

function WCAGLevelBadge({ level, targetLevel, achieved }: WCAGLevelBadgeProps) {
	if (!level) {
		return (
			<Badge variant="destructive" className="gap-1">
				<AlertCircle className="h-3 w-3" />
				Not Compliant
			</Badge>
		);
	}

	const isTarget = level === targetLevel;
	const exceeds =
		(targetLevel === "A" && (level === "AA" || level === "AAA")) ||
		(targetLevel === "AA" && level === "AAA");

	return (
		<Badge
			className={cn(
				"gap-1",
				achieved || isTarget || exceeds
					? "bg-green-600 hover:bg-green-700"
					: "bg-yellow-600 hover:bg-yellow-700"
			)}
		>
			<Shield className="h-3 w-3" />
			WCAG {level}
			{isTarget && " (Target)"}
			{exceeds && " (Exceeds)"}
		</Badge>
	);
}

/**
 * Section 508 compliance badge.
 */
function Section508Badge({ compliant }: { compliant: boolean }) {
	return (
		<Badge
			className={cn(
				"gap-1",
				compliant
					? "bg-green-600 hover:bg-green-700"
					: "bg-red-600 hover:bg-red-700"
			)}
		>
			{compliant ? (
				<CheckCircle2 className="h-3 w-3" />
			) : (
				<AlertCircle className="h-3 w-3" />
			)}
			Section 508 {compliant ? "Compliant" : "Non-Compliant"}
		</Badge>
	);
}

/**
 * Score display with progress ring.
 */
interface ScoreDisplayProps {
	score: number;
}

function ScoreDisplay({ score }: ScoreDisplayProps) {
	const getScoreColor = (s: number) => {
		if (s >= 90) return "text-green-600 dark:text-green-400";
		if (s >= 70) return "text-yellow-600 dark:text-yellow-400";
		if (s >= 50) return "text-orange-600 dark:text-orange-400";
		return "text-red-600 dark:text-red-400";
	};

	const getScoreLabel = (s: number) => {
		if (s >= 90) return "Excellent";
		if (s >= 70) return "Good";
		if (s >= 50) return "Needs Work";
		return "Poor";
	};

	return (
		<div className="flex flex-col items-center">
			<div
				className={cn(
					"relative h-28 w-28 rounded-full border-8 flex items-center justify-center",
					score >= 90
						? "border-green-500"
						: score >= 70
						? "border-yellow-500"
						: score >= 50
						? "border-orange-500"
						: "border-red-500"
				)}
			>
				<div className="text-center">
					<span className={cn("text-3xl font-bold", getScoreColor(score))}>
						{score}
					</span>
					<span className="text-sm text-muted-foreground">/100</span>
				</div>
			</div>
			<span className="mt-2 text-sm text-muted-foreground">
				{getScoreLabel(score)}
			</span>
		</div>
	);
}

/**
 * Category score card.
 */
interface CategoryScoreCardProps {
	category: AccessibilityCategory;
	score: number;
	issueCount: number;
	onClick?: () => void;
}

function CategoryScoreCard({
	category,
	score,
	issueCount,
	onClick,
}: CategoryScoreCardProps) {
	const config = CATEGORY_CONFIG[category];
	const Icon = config.icon;

	const getScoreColor = (s: number) => {
		if (s >= 90) return "text-green-600";
		if (s >= 70) return "text-yellow-600";
		return "text-red-600";
	};

	return (
		<div
			className={cn(
				"p-3 border rounded-lg transition-colors",
				onClick && "cursor-pointer hover:bg-accent/50"
			)}
			onClick={onClick}
		>
			<div className="flex items-center gap-2 mb-2">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium">{config.label}</span>
			</div>
			<div className="flex items-center justify-between">
				<span className={cn("text-xl font-bold", getScoreColor(score))}>
					{score}
				</span>
				{issueCount > 0 && (
					<Badge variant="secondary" className="text-xs">
						{issueCount} issues
					</Badge>
				)}
			</div>
		</div>
	);
}

/**
 * Single accessibility issue item.
 */
interface IssueItemProps {
	issue: AccessibilityIssue;
	onClick?: () => void;
}

function IssueItem({ issue, onClick }: IssueItemProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);
	const impactConfig = IMPACT_CONFIG[issue.impact];
	const ImpactIcon = impactConfig.icon;

	return (
		<div
			className={cn(
				"border rounded-lg p-3 transition-colors",
				onClick && "cursor-pointer hover:bg-accent/50"
			)}
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className={cn("mt-0.5", impactConfig.color)}>
					<ImpactIcon className="h-5 w-5" />
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-medium">{issue.title}</span>
						<Badge
							variant="outline"
							className={cn(impactConfig.color, impactConfig.bgColor)}
						>
							{impactConfig.label}
						</Badge>
						<Badge variant="secondary" className="text-xs">
							WCAG {issue.wcagCriterion}
						</Badge>
						<Badge
							variant="outline"
							className={cn("text-xs", WCAG_LEVEL_COLORS[issue.wcagLevel])}
						>
							Level {issue.wcagLevel}
						</Badge>
					</div>

					<p className="text-sm text-muted-foreground mt-1">
						{issue.description}
					</p>

					{issue.location && (
						<p className="text-xs text-muted-foreground mt-1">
							{issue.location.page && `Page ${issue.location.page}`}
							{issue.location.section && `, Section ${issue.location.section}`}
						</p>
					)}

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
								Remediation Guidance
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2">
							<div className="p-3 bg-muted/50 rounded text-sm">
								<div className="font-medium mb-1">How to Fix:</div>
								<p>{issue.remediation}</p>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</div>
			</div>
		</div>
	);
}

/**
 * Loading skeleton.
 */
function CheckerSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-4 w-64 mt-1" />
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex justify-center">
					<Skeleton className="h-28 w-28 rounded-full" />
				</div>
				<div className="flex justify-center gap-4">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-8 w-40" />
				</div>
				<div className="grid grid-cols-3 gap-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-20" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function AccessibilityChecker({
	documentId,
	targetLevel = "AA",
	onIssueClick,
	className,
}: AccessibilityCheckerProps) {
	// Use hook
	const { result, isChecking, error, recheck: checkAccessibility } = useAccessibilityCheck(documentId, targetLevel);
	const [activeCategory, setActiveCategory] =
		React.useState<AccessibilityCategory | null>(null);

	// Get all issues for display
	const allIssues = React.useMemo(() => {
		if (!result) return [];
		return Object.values(result.issuesByCategory).flat();
	}, [result]);

	// Get issues for active category
	const categoryIssues = React.useMemo(() => {
		if (!result || !activeCategory) return allIssues;
		return result.issuesByCategory[activeCategory] || [];
	}, [result, activeCategory, allIssues]);

	// Get categories with issues
	const categoriesWithIssues = React.useMemo(() => {
		if (!result) return [];
		return (Object.keys(result.issuesByCategory) as AccessibilityCategory[]).filter(
			(cat) => result.issuesByCategory[cat].length > 0
		);
	}, [result]);

	// Loading state
	if (isChecking && !result) {
		return <CheckerSkeleton />;
	}

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<Accessibility className="h-5 w-5" />
						Accessibility Check
					</CardTitle>
					<CardDescription>
						Section 508 and WCAG {targetLevel} compliance
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={checkAccessibility}
					disabled={isChecking}
				>
					<RefreshCw
						className={cn("h-4 w-4 mr-2", isChecking && "animate-spin")}
					/>
					Re-check
				</Button>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Check Failed</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{result && (
					<>
						{/* Score Display */}
						<div className="flex justify-center py-4">
							<ScoreDisplay score={result.score} />
						</div>

						{/* Compliance Badges */}
						<div className="flex justify-center gap-4 flex-wrap">
							<WCAGLevelBadge
								level={result.achievedLevel}
								targetLevel={result.targetLevel}
							/>
							<Section508Badge compliant={result.section508Compliant} />
						</div>

						{/* Issue Count Summary */}
						<div className="flex justify-center gap-3 flex-wrap">
							{(
								["critical", "serious", "moderate", "minor"] as const
							).map((impact) => {
								const count = result.issueCounts[impact];
								if (count === 0) return null;
								const config = IMPACT_CONFIG[impact];
								const Icon = config.icon;

								return (
									<div
										key={impact}
										className={cn(
											"flex items-center gap-2 px-3 py-1.5 rounded-lg",
											config.bgColor
										)}
									>
										<Icon className={cn("h-4 w-4", config.color)} />
										<span className={cn("text-sm font-medium", config.color)}>
											{count} {config.label}
										</span>
									</div>
								);
							})}
						</div>

						{/* Category Scores */}
						<div className="space-y-3">
							<h4 className="font-medium text-sm text-muted-foreground">
								Category Breakdown
							</h4>
							<div className="grid grid-cols-3 gap-3">
								{(
									Object.keys(CATEGORY_CONFIG) as AccessibilityCategory[]
								).map((category) => (
									<CategoryScoreCard
										key={category}
										category={category}
										score={result.categoryScores[category]}
										issueCount={result.issuesByCategory[category]?.length || 0}
										onClick={() =>
											setActiveCategory(
												activeCategory === category ? null : category
											)
										}
									/>
								))}
							</div>
						</div>

						{/* Issues List */}
						{allIssues.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h4 className="font-medium text-sm text-muted-foreground">
										{activeCategory
											? `${CATEGORY_CONFIG[activeCategory].label} Issues`
											: "All Issues"}
									</h4>
									{activeCategory && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setActiveCategory(null)}
										>
											Show All
										</Button>
									)}
								</div>
								<div className="space-y-2 max-h-[400px] overflow-y-auto">
									{categoryIssues.map((issue) => (
										<IssueItem
											key={issue.id}
											issue={issue}
											onClick={
												onIssueClick ? () => onIssueClick(issue) : undefined
											}
										/>
									))}
								</div>
							</div>
						)}

						{/* No Issues */}
						{allIssues.length === 0 && (
							<div className="flex flex-col items-center py-8 text-center">
								<CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
								<h3 className="font-medium text-lg">Fully Accessible</h3>
								<p className="text-sm text-muted-foreground">
									Your document meets all accessibility requirements.
								</p>
							</div>
						)}

						{/* Last Checked */}
						<p className="text-xs text-muted-foreground text-center">
							Last checked: {new Date(result.checkedAt).toLocaleString()}
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default AccessibilityChecker;
