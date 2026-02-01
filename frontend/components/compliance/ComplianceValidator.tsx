"use client";

/**
 * Compliance Validator Component
 *
 * Main interface for validating RFP compliance, displaying results,
 * and providing actionable recommendations.
 */

import * as React from "react";
import { useCallback, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	CheckCircle2,
	AlertTriangle,
	AlertCircle,
	XCircle,
	RefreshCw,
	Download,
	BarChart3,
	ListChecks,
	Lightbulb,
	FileText,
	ChevronRight,
	Clock,
	Shield,
	Target,
} from "lucide-react";
import {
	validateCompliance,
	generateComplianceHeatMap,
	type ValidationResult,
	type HeatMapData,
	type ComplianceIssue,
	type ComplianceSuggestion,
} from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface ComplianceValidatorProps {
	/** Opportunity ID to validate */
	opportunityId: string;
	/** Compliance matrix ID (optional, uses latest if not provided) */
	matrixId?: string;
	/** Callback when validation completes */
	onValidationComplete?: (result: ValidationResult) => void;
	/** Callback to navigate to a requirement */
	onNavigateToRequirement?: (requirementId: string) => void;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG = {
	critical: {
		label: "Critical",
		color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
		icon: <XCircle className="h-4 w-4" />,
	},
	high: {
		label: "High",
		color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
		icon: <AlertCircle className="h-4 w-4" />,
	},
	medium: {
		label: "Medium",
		color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
		icon: <AlertTriangle className="h-4 w-4" />,
	},
	low: {
		label: "Low",
		color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
		icon: <AlertTriangle className="h-4 w-4" />,
	},
};

const ISSUE_TYPE_LABELS = {
	missing: "Not Addressed",
	partial: "Partially Addressed",
	over_referenced: "Over Referenced",
	weak: "Weak Response",
	mismatch: "Non-Compliant",
};

// ============================================================================
// Component
// ============================================================================

export function ComplianceValidator({
	opportunityId,
	matrixId,
	onValidationComplete,
	onNavigateToRequirement,
	className,
}: ComplianceValidatorProps) {
	const [isPending, startTransition] = useTransition();
	const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
	const [heatMapData, setHeatMapData] = useState<HeatMapData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("overview");

	// Run validation
	const runValidation = useCallback(() => {
		startTransition(async () => {
			try {
				setError(null);
				const result = await validateCompliance(opportunityId);
				setValidationResult(result);
				onValidationComplete?.(result);

				// Also load heat map data if we have a matrix ID
				if (matrixId) {
					const heatMap = await generateComplianceHeatMap(matrixId);
					setHeatMapData(heatMap);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Validation failed");
			}
		});
	}, [opportunityId, matrixId, onValidationComplete]);

	// Run on mount
	React.useEffect(() => {
		runValidation();
	}, [runValidation]);

	// Group issues by severity
	const issuesBySeverity = React.useMemo(() => {
		if (!validationResult) return { critical: [], high: [], medium: [], low: [] };

		return {
			critical: validationResult.issues.filter((i) => i.severity === "critical"),
			high: validationResult.issues.filter((i) => i.severity === "high"),
			medium: validationResult.issues.filter((i) => i.severity === "medium"),
			low: validationResult.issues.filter((i) => i.severity === "low"),
		};
	}, [validationResult]);

	// Render score indicator
	const renderScoreIndicator = (score: number, label: string, sublabel?: string) => {
		let color = "text-green-600";
		let bgColor = "bg-green-100 dark:bg-green-900/30";
		let statusIcon = <CheckCircle2 className="h-8 w-8" />;

		if (score < 50) {
			color = "text-red-600";
			bgColor = "bg-red-100 dark:bg-red-900/30";
			statusIcon = <XCircle className="h-8 w-8" />;
		} else if (score < 80) {
			color = "text-yellow-600";
			bgColor = "bg-yellow-100 dark:bg-yellow-900/30";
			statusIcon = <AlertTriangle className="h-8 w-8" />;
		}

		return (
			<div className={cn("p-4 rounded-lg", bgColor)}>
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm text-muted-foreground">{label}</p>
						{sublabel && (
							<p className="text-xs text-muted-foreground">{sublabel}</p>
						)}
					</div>
					<div className={cn("flex items-center gap-2", color)}>
						{statusIcon}
						<span className="text-3xl font-bold">{score}%</span>
					</div>
				</div>
				<Progress value={score} className="h-2 mt-2" />
			</div>
		);
	};

	// Render issue card
	const renderIssueCard = (issue: ComplianceIssue) => {
		const config = SEVERITY_CONFIG[issue.severity];

		return (
			<div
				key={`${issue.requirementId}-${issue.type}`}
				className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
				onClick={() => onNavigateToRequirement?.(issue.requirementId)}
			>
				<div className="flex items-start gap-3">
					<Badge className={cn("shrink-0", config.color)}>
						{config.icon}
						<span className="ml-1">{config.label}</span>
					</Badge>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-mono text-sm font-medium">
								{issue.requirementNumber}
							</span>
							<Badge variant="outline" className="text-xs">
								{ISSUE_TYPE_LABELS[issue.type]}
							</Badge>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							{issue.description}
						</p>
						{issue.location && (
							<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
								<FileText className="h-3 w-3" />
								{issue.location}
							</p>
						)}
						{issue.suggestion && (
							<p className="text-xs text-primary mt-1 flex items-start gap-1">
								<Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
								{issue.suggestion}
							</p>
						)}
					</div>
					<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
				</div>
			</div>
		);
	};

	// Render suggestion card
	const renderSuggestionCard = (suggestion: ComplianceSuggestion, index: number) => {
		const priorityColors = {
			high: "border-l-red-500",
			medium: "border-l-yellow-500",
			low: "border-l-blue-500",
		};

		return (
			<div
				key={index}
				className={cn(
					"p-3 border rounded-lg border-l-4",
					priorityColors[suggestion.priority]
				)}
			>
				<div className="flex items-start gap-3">
					<Target className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
					<div className="flex-1">
						<p className="text-sm">{suggestion.description}</p>
						{suggestion.requirementId && (
							<Button
								variant="link"
								size="sm"
								className="h-auto p-0 text-xs"
								onClick={() => onNavigateToRequirement?.(suggestion.requirementId)}
							>
								View requirement →
							</Button>
						)}
						{suggestion.suggestedAction && (
							<p className="text-xs text-muted-foreground mt-1">
								{suggestion.suggestedAction}
							</p>
						)}
					</div>
					<Badge
						variant="outline"
						className={cn(
							"shrink-0 text-xs",
							suggestion.priority === "high" && "border-red-300 text-red-700",
							suggestion.priority === "medium" && "border-yellow-300 text-yellow-700",
							suggestion.priority === "low" && "border-blue-300 text-blue-700"
						)}
					>
						{suggestion.priority}
					</Badge>
				</div>
			</div>
		);
	};

	// Render heat map
	const renderHeatMap = () => {
		if (!heatMapData || heatMapData.categories.length === 0) {
			return (
				<div className="text-center py-8 text-muted-foreground">
					No heat map data available
				</div>
			);
		}

		return (
			<div className="space-y-4">
				{heatMapData.categories.map((category) => {
					const rate = category.complianceRate;
					const color = rate >= 80
						? "bg-green-500"
						: rate >= 50
						? "bg-yellow-500"
						: "bg-red-500";

					return (
						<div key={category.name} className="space-y-2">
							<div className="flex items-center justify-between">
								<div>
									<span className="font-medium capitalize">
										{category.name.replace("_", " ")}
									</span>
									<span className="text-sm text-muted-foreground ml-2">
										({category.addressedRequirements}/{category.totalRequirements})
									</span>
								</div>
								<div className="flex items-center gap-2">
									{category.mandatoryCount > 0 && (
										<Badge variant="outline" className="text-xs">
											{category.mandatoryAddressed}/{category.mandatoryCount} mandatory
										</Badge>
									)}
									<span className={cn("font-medium", rate >= 80 ? "text-green-600" : rate >= 50 ? "text-yellow-600" : "text-red-600")}>
										{rate}%
									</span>
								</div>
							</div>
							<div className="h-3 bg-muted rounded-full overflow-hidden">
								<div
									className={cn("h-full transition-all", color)}
									style={{ width: `${rate}%` }}
								/>
							</div>
							{/* Subcategories */}
							{category.subcategories.length > 1 && (
								<div className="pl-4 space-y-1">
									{category.subcategories.map((sub) => (
										<div key={sub.name} className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">{sub.name}</span>
											<div className="flex items-center gap-2">
												<div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
													<div
														className={cn(
															"h-full",
															sub.complianceRate >= 80
																? "bg-green-400"
																: sub.complianceRate >= 50
																? "bg-yellow-400"
																: "bg-red-400"
														)}
														style={{ width: `${sub.complianceRate}%` }}
													/>
												</div>
												<span className="text-xs w-10 text-right">{sub.complianceRate}%</span>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-5 w-5" />
							Compliance Validation
						</CardTitle>
						<CardDescription>
							{validationResult ? (
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									Last validated: {new Date(validationResult.timestamp).toLocaleString()}
								</span>
							) : (
								"Validate your proposal against RFP requirements"
							)}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={runValidation}
							disabled={isPending}
						>
							<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
							{isPending ? "Validating..." : "Re-validate"}
						</Button>
						{validationResult && (
							<Button variant="outline" size="sm" disabled>
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error state */}
				{error && (
					<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
						{error}
					</div>
				)}

				{/* Loading state */}
				{isPending && !validationResult && (
					<div className="flex items-center justify-center py-12">
						<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				)}

				{/* Results */}
				{validationResult && (
					<>
						{/* Overall status banner */}
						<div
							className={cn(
								"p-4 rounded-lg flex items-center gap-4",
								validationResult.isValid
									? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
									: "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
							)}
						>
							{validationResult.isValid ? (
								<CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
							) : (
								<AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
							)}
							<div>
								<p className={cn("font-medium", validationResult.isValid ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
									{validationResult.isValid
										? "Proposal is compliant with all mandatory requirements"
										: `${issuesBySeverity.critical.length} critical issues require attention`}
								</p>
								<p className="text-sm text-muted-foreground">
									{validationResult.addressedRequirements} of {validationResult.totalRequirements} requirements addressed
									{validationResult.issues.length > 0 && ` • ${validationResult.issues.length} issues found`}
								</p>
							</div>
						</div>

						{/* Score cards */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{renderScoreIndicator(
								validationResult.coverageScore,
								"Overall Coverage",
								`${validationResult.addressedRequirements}/${validationResult.totalRequirements} requirements`
							)}
							{renderScoreIndicator(
								validationResult.mandatoryCoverageScore,
								"Mandatory Coverage",
								`${validationResult.mandatoryRequirements} mandatory requirements`
							)}
						</div>

						{/* Tabs for detailed view */}
						<Tabs value={activeTab} onValueChange={setActiveTab}>
							<TabsList>
								<TabsTrigger value="overview" className="gap-1">
									<ListChecks className="h-4 w-4" />
									Issues ({validationResult.issues.length})
								</TabsTrigger>
								<TabsTrigger value="suggestions" className="gap-1">
									<Lightbulb className="h-4 w-4" />
									Suggestions ({validationResult.suggestions.length})
								</TabsTrigger>
								<TabsTrigger value="heatmap" className="gap-1">
									<BarChart3 className="h-4 w-4" />
									Coverage Map
								</TabsTrigger>
							</TabsList>

							<TabsContent value="overview" className="mt-4">
								{validationResult.issues.length === 0 ? (
									<div className="text-center py-8">
										<CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
										<p className="text-muted-foreground">
											No compliance issues found
										</p>
									</div>
								) : (
									<div className="space-y-6">
										{/* Critical issues */}
										{issuesBySeverity.critical.length > 0 && (
											<div className="space-y-2">
												<h4 className="text-sm font-medium flex items-center gap-2 text-red-600">
													<XCircle className="h-4 w-4" />
													Critical Issues ({issuesBySeverity.critical.length})
												</h4>
												<div className="space-y-2">
													{issuesBySeverity.critical.map(renderIssueCard)}
												</div>
											</div>
										)}

										{/* High priority issues */}
										{issuesBySeverity.high.length > 0 && (
											<div className="space-y-2">
												<h4 className="text-sm font-medium flex items-center gap-2 text-orange-600">
													<AlertCircle className="h-4 w-4" />
													High Priority ({issuesBySeverity.high.length})
												</h4>
												<div className="space-y-2">
													{issuesBySeverity.high.map(renderIssueCard)}
												</div>
											</div>
										)}

										{/* Medium priority issues */}
										{issuesBySeverity.medium.length > 0 && (
											<div className="space-y-2">
												<h4 className="text-sm font-medium flex items-center gap-2 text-yellow-600">
													<AlertTriangle className="h-4 w-4" />
													Medium Priority ({issuesBySeverity.medium.length})
												</h4>
												<div className="space-y-2">
													{issuesBySeverity.medium.map(renderIssueCard)}
												</div>
											</div>
										)}

										{/* Low priority issues */}
										{issuesBySeverity.low.length > 0 && (
											<div className="space-y-2">
												<h4 className="text-sm font-medium flex items-center gap-2 text-blue-600">
													<AlertTriangle className="h-4 w-4" />
													Low Priority ({issuesBySeverity.low.length})
												</h4>
												<div className="space-y-2">
													{issuesBySeverity.low.map(renderIssueCard)}
												</div>
											</div>
										)}
									</div>
								)}
							</TabsContent>

							<TabsContent value="suggestions" className="mt-4">
								{validationResult.suggestions.length === 0 ? (
									<div className="text-center py-8">
										<Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
										<p className="text-muted-foreground">
											No suggestions at this time
										</p>
									</div>
								) : (
									<div className="space-y-3">
										{validationResult.suggestions.map(renderSuggestionCard)}
									</div>
								)}
							</TabsContent>

							<TabsContent value="heatmap" className="mt-4">
								{renderHeatMap()}
							</TabsContent>
						</Tabs>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default ComplianceValidator;
