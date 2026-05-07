/**
 * ValidationResults Component
 *
 * Displays comprehensive validation results with filtering, grouping,
 * and actionable insights for compliance issues.
 */

"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	CheckCircle,
	XCircle,
	AlertTriangle,
	AlertCircle,
	Search,
	Filter,
	ChevronDown,
	ChevronRight,
	Download,
	RefreshCw,
	ExternalLink,
	Clock,
} from "lucide-react";
import type {
	ValidationResult,
	ComplianceIssue,
	ComplianceSuggestion,
} from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface ValidationResultsProps {
	results: ValidationResult;
	onRefresh?: () => void;
	onExport?: (format: "pdf" | "xlsx") => void;
	onIssueClick?: (issue: ComplianceIssue) => void;
	onSuggestionApply?: (suggestion: ComplianceSuggestion) => void;
	isLoading?: boolean;
	className?: string;
}

type GroupBy = "severity" | "type" | "none";
type SortBy = "severity" | "requirement" | "type";

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG = {
	critical: {
		icon: XCircle,
		color: "text-red-600",
		bg: "bg-red-50",
		border: "border-red-200",
		label: "Critical",
	},
	high: {
		icon: AlertTriangle,
		color: "text-orange-600",
		bg: "bg-orange-50",
		border: "border-orange-200",
		label: "High",
	},
	medium: {
		icon: AlertCircle,
		color: "text-yellow-600",
		bg: "bg-yellow-50",
		border: "border-yellow-200",
		label: "Medium",
	},
	low: {
		icon: CheckCircle,
		color: "text-blue-600",
		bg: "bg-blue-50",
		border: "border-blue-200",
		label: "Low",
	},
};

const TYPE_LABELS: Record<ComplianceIssue["type"], string> = {
	missing: "Missing Response",
	partial: "Partial Coverage",
	over_referenced: "Over-Referenced",
	weak: "Weak Response",
	mismatch: "Non-Compliant",
};

// ============================================================================
// Component
// ============================================================================

export function ValidationResults({
	results,
	onRefresh,
	onExport,
	onIssueClick,
	onSuggestionApply,
	isLoading = false,
	className,
}: ValidationResultsProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [groupBy, setGroupBy] = useState<GroupBy>("severity");
	const [sortBy, setSortBy] = useState<SortBy>("severity");
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
		new Set(["critical", "high"])
	);
	const [selectedSeverities, setSelectedSeverities] = useState<Set<string>>(
		new Set(["critical", "high", "medium", "low"])
	);
	const [showFilters, setShowFilters] = useState(false);

	// Filter and sort issues
	const filteredIssues = useMemo(() => {
		let issues = results.issues.filter((issue) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				if (
					!issue.requirementNumber.toLowerCase().includes(query) &&
					!issue.description.toLowerCase().includes(query) &&
					!(issue.location?.toLowerCase().includes(query) ?? false)
				) {
					return false;
				}
			}

			// Severity filter
			if (!selectedSeverities.has(issue.severity)) {
				return false;
			}

			return true;
		});

		// Sort
		issues = [...issues].sort((a, b) => {
			switch (sortBy) {
				case "severity": {
					const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
					return severityOrder[a.severity] - severityOrder[b.severity];
				}
				case "requirement":
					return a.requirementNumber.localeCompare(b.requirementNumber);
				case "type":
					return a.type.localeCompare(b.type);
				default:
					return 0;
			}
		});

		return issues;
	}, [results.issues, searchQuery, selectedSeverities, sortBy]);

	// Group issues
	const groupedIssues = useMemo(() => {
		if (groupBy === "none") {
			return { "All Issues": filteredIssues };
		}

		const groups: Record<string, ComplianceIssue[]> = {};
		for (const issue of filteredIssues) {
			const key = groupBy === "severity" ? issue.severity : issue.type;
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(issue);
		}

		return groups;
	}, [filteredIssues, groupBy]);

	const toggleGroup = (group: string) => {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(group)) {
			newExpanded.delete(group);
		} else {
			newExpanded.add(group);
		}
		setExpandedGroups(newExpanded);
	};

	const toggleSeverity = (severity: string) => {
		const newSelected = new Set(selectedSeverities);
		if (newSelected.has(severity)) {
			newSelected.delete(severity);
		} else {
			newSelected.add(severity);
		}
		setSelectedSeverities(newSelected);
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Summary Header */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="text-lg font-semibold">Validation Results</h3>
						<p className="text-sm text-gray-500">
							Last validated: {new Date(results.timestamp).toLocaleString()}
						</p>
					</div>
					<div className="flex items-center gap-2">
						{onRefresh && (
							<Button
								variant="outline"
								size="sm"
								onClick={onRefresh}
								disabled={isLoading}
							>
								<RefreshCw
									className={cn("w-4 h-4 mr-1", isLoading && "animate-spin")}
								/>
								Refresh
							</Button>
						)}
						{onExport && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => onExport("pdf")}
							>
								<Download className="w-4 h-4 mr-1" />
								Export
							</Button>
						)}
					</div>
				</div>

				{/* Score Summary */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div
						className={cn(
							"p-3 rounded-lg",
							results.isValid ? "bg-green-50" : "bg-red-50"
						)}
					>
						<div className="text-sm text-gray-600">Status</div>
						<div
							className={cn(
								"text-lg font-semibold",
								results.isValid ? "text-green-700" : "text-red-700"
							)}
						>
							{results.isValid ? "Valid" : "Invalid"}
						</div>
					</div>
					<div className="p-3 rounded-lg bg-gray-50">
						<div className="text-sm text-gray-600">Coverage</div>
						<div className="text-lg font-semibold">{results.coverageScore}%</div>
					</div>
					<div className="p-3 rounded-lg bg-gray-50">
						<div className="text-sm text-gray-600">Mandatory Coverage</div>
						<div className="text-lg font-semibold">
							{results.mandatoryCoverageScore}%
						</div>
					</div>
					<div className="p-3 rounded-lg bg-gray-50">
						<div className="text-sm text-gray-600">Issues Found</div>
						<div className="text-lg font-semibold">{results.issues.length}</div>
					</div>
				</div>
			</div>

			{/* Filters and Controls */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex flex-col md:flex-row md:items-center gap-4">
					{/* Search */}
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search issues..."
							className="pl-9"
						/>
					</div>

					{/* Controls */}
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowFilters(!showFilters)}
						>
							<Filter className="w-4 h-4 mr-1" />
							Filters
							{selectedSeverities.size < 4 && (
								<span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
									{selectedSeverities.size}
								</span>
							)}
						</Button>

						<select
							value={groupBy}
							onChange={(e) => setGroupBy(e.target.value as GroupBy)}
							className="px-3 py-1.5 border rounded-md text-sm"
						>
							<option value="severity">Group by Severity</option>
							<option value="type">Group by Type</option>
							<option value="none">No Grouping</option>
						</select>

						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as SortBy)}
							className="px-3 py-1.5 border rounded-md text-sm"
						>
							<option value="severity">Sort by Severity</option>
							<option value="requirement">Sort by Requirement</option>
							<option value="type">Sort by Type</option>
						</select>
					</div>
				</div>

				{/* Filter Panel */}
				{showFilters && (
					<div className="mt-4 pt-4 border-t">
						<div className="text-sm font-medium mb-2">Severity Filter</div>
						<div className="flex flex-wrap gap-2">
							{Object.entries(SEVERITY_CONFIG).map(([severity, config]) => (
								<button
									key={severity}
									onClick={() => toggleSeverity(severity)}
									className={cn(
										"px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
										selectedSeverities.has(severity)
											? cn(config.bg, config.color, config.border, "border")
											: "bg-gray-100 text-gray-500"
									)}
								>
									{config.label}
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Issue Groups */}
			<div className="space-y-3">
				{Object.entries(groupedIssues).map(([group, issues]) => {
					const isExpanded = expandedGroups.has(group);
					const config =
						groupBy === "severity"
							? SEVERITY_CONFIG[group as keyof typeof SEVERITY_CONFIG]
							: null;
					const Icon = config?.icon ?? AlertCircle;

					return (
						<div key={group} className="bg-white rounded-lg border">
							{/* Group Header */}
							<button
								onClick={() => toggleGroup(group)}
								className={cn(
									"w-full flex items-center justify-between p-4",
									config?.bg ?? "bg-gray-50"
								)}
							>
								<div className="flex items-center gap-2">
									{isExpanded ? (
										<ChevronDown className="w-4 h-4" />
									) : (
										<ChevronRight className="w-4 h-4" />
									)}
									<Icon className={cn("w-5 h-5", config?.color ?? "text-gray-600")} />
									<span className="font-medium capitalize">
										{groupBy === "type" ? TYPE_LABELS[group as ComplianceIssue["type"]] : config?.label ?? group}
									</span>
									<span className="text-sm text-gray-500">
										({issues.length} {issues.length === 1 ? "issue" : "issues"})
									</span>
								</div>
							</button>

							{/* Issue List */}
							{isExpanded && (
								<div className="divide-y">
									{issues.map((issue, index) => {
										const issueConfig = SEVERITY_CONFIG[issue.severity];
										const IssueIcon = issueConfig.icon;

										return (
											<div
												key={`${issue.requirementId}-${index}`}
												className={cn(
													"p-4 hover:bg-gray-50 cursor-pointer transition-colors",
													onIssueClick && "cursor-pointer"
												)}
												onClick={() => onIssueClick?.(issue)}

					role="button"
					tabIndex={0}
					onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
												<div className="flex items-start gap-3">
													<IssueIcon
														className={cn("w-5 h-5 mt-0.5", issueConfig.color)}
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-1">
															<span className="font-medium">
																{issue.requirementNumber}
															</span>
															<span
																className={cn(
																	"px-2 py-0.5 text-xs rounded-full",
																	issueConfig.bg,
																	issueConfig.color
																)}
															>
																{issueConfig.label}
															</span>
															<span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
																{TYPE_LABELS[issue.type]}
															</span>
														</div>
														<p className="text-sm text-gray-700">
															{issue.description}
														</p>
														{issue.location && (
															<p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
																<ExternalLink className="w-3 h-3" />
																{issue.location}
															</p>
														)}
														{issue.suggestion && (
															<p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
																<Clock className="w-3 h-3" />
																Suggestion: {issue.suggestion}
															</p>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}

				{filteredIssues.length === 0 && (
					<div className="bg-white rounded-lg border p-8 text-center">
						{results.issues.length === 0 ? (
							<>
								<CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
								<h3 className="text-lg font-medium">No Issues Found</h3>
								<p className="text-sm text-gray-500">
									All requirements are properly addressed.
								</p>
							</>
						) : (
							<>
								<Search className="w-12 h-12 mx-auto text-gray-400 mb-3" />
								<h3 className="text-lg font-medium">No Matching Issues</h3>
								<p className="text-sm text-gray-500">
									Try adjusting your search or filter criteria.
								</p>
							</>
						)}
					</div>
				)}
			</div>

			{/* Suggestions Section */}
			{results.suggestions.length > 0 && (
				<div className="bg-white rounded-lg border">
					<div className="p-4 border-b bg-blue-50">
						<h3 className="font-medium text-blue-900">
							Improvement Suggestions ({results.suggestions.length})
						</h3>
					</div>
					<div className="divide-y">
						{results.suggestions.slice(0, 5).map((suggestion, index) => (
							<div
								key={`${suggestion.requirementId}-${index}`}
								className="p-4 flex items-start justify-between gap-4"
							>
								<div>
									<div className="flex items-center gap-2 mb-1">
										<span
											className={cn(
												"px-2 py-0.5 text-xs rounded-full",
												suggestion.priority === "high"
													? "bg-red-100 text-red-700"
													: suggestion.priority === "medium"
													? "bg-yellow-100 text-yellow-700"
													: "bg-blue-100 text-blue-700"
											)}
										>
											{suggestion.priority} priority
										</span>
										<span className="text-xs text-gray-500 capitalize">
											{suggestion.type.replace("_", " ")}
										</span>
									</div>
									<p className="text-sm">{suggestion.description}</p>
								</div>
								{onSuggestionApply && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => onSuggestionApply(suggestion)}
									>
										Apply
									</Button>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
