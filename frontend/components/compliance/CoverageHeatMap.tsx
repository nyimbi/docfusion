/**
 * CoverageHeatMap Component
 *
 * Visualizes compliance coverage across categories using a heat map.
 * Shows compliance rates with color coding and drill-down capability.
 */

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	ChevronDown,
	ChevronRight,
	Info,
	AlertTriangle,
	CheckCircle,
	XCircle,
} from "lucide-react";
import type { HeatMapData } from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface CoverageHeatMapProps {
	data: HeatMapData;
	onCategoryClick?: (category: string) => void;
	onSubcategoryClick?: (category: string, subcategory: string) => void;
	showMandatoryOnly?: boolean;
	className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getComplianceColor(rate: number): string {
	if (rate >= 90) return "bg-green-500";
	if (rate >= 75) return "bg-green-400";
	if (rate >= 60) return "bg-yellow-400";
	if (rate >= 40) return "bg-orange-400";
	if (rate >= 20) return "bg-orange-500";
	return "bg-red-500";
}

function getComplianceBgColor(rate: number): string {
	if (rate >= 90) return "bg-green-50";
	if (rate >= 75) return "bg-green-50";
	if (rate >= 60) return "bg-yellow-50";
	if (rate >= 40) return "bg-orange-50";
	if (rate >= 20) return "bg-orange-50";
	return "bg-red-50";
}

function getComplianceTextColor(rate: number): string {
	if (rate >= 90) return "text-green-700";
	if (rate >= 75) return "text-green-600";
	if (rate >= 60) return "text-yellow-700";
	if (rate >= 40) return "text-orange-700";
	if (rate >= 20) return "text-orange-700";
	return "text-red-700";
}

function getStatusIcon(rate: number) {
	if (rate >= 90) return CheckCircle;
	if (rate >= 60) return AlertTriangle;
	return XCircle;
}

// ============================================================================
// Component
// ============================================================================

export function CoverageHeatMap({
	data,
	onCategoryClick,
	onSubcategoryClick,
	showMandatoryOnly = false,
	className,
}: CoverageHeatMapProps) {
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
		new Set()
	);
	const [tooltipCategory, setTooltipCategory] = useState<string | null>(null);

	const toggleCategory = (category: string) => {
		const newExpanded = new Set(expandedCategories);
		if (newExpanded.has(category)) {
			newExpanded.delete(category);
		} else {
			newExpanded.add(category);
		}
		setExpandedCategories(newExpanded);
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Overall Scores */}
			<div className="bg-white rounded-lg border p-4">
				<h3 className="text-lg font-semibold mb-4">Compliance Overview</h3>
				<div className="grid grid-cols-2 gap-4">
					<div
						className={cn(
							"p-4 rounded-lg text-center",
							getComplianceBgColor(data.overallScore)
						)}
					>
						<div className="text-sm text-gray-600 mb-1">Overall Coverage</div>
						<div
							className={cn(
								"text-3xl font-bold",
								getComplianceTextColor(data.overallScore)
							)}
						>
							{data.overallScore}%
						</div>
						<div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
							<div
								className={cn("h-full", getComplianceColor(data.overallScore))}
								style={{ width: `${data.overallScore}%` }}
							/>
						</div>
					</div>
					<div
						className={cn(
							"p-4 rounded-lg text-center",
							getComplianceBgColor(data.mandatoryScore)
						)}
					>
						<div className="text-sm text-gray-600 mb-1">Mandatory Coverage</div>
						<div
							className={cn(
								"text-3xl font-bold",
								getComplianceTextColor(data.mandatoryScore)
							)}
						>
							{data.mandatoryScore}%
						</div>
						<div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
							<div
								className={cn("h-full", getComplianceColor(data.mandatoryScore))}
								style={{ width: `${data.mandatoryScore}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Heat Map Legend */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-center justify-between mb-3">
					<h4 className="font-medium">Coverage Scale</h4>
					<div className="flex items-center gap-1">
						<Info className="w-4 h-4 text-gray-400" />
						<span className="text-xs text-gray-500">
							Click a category to view details
						</span>
					</div>
				</div>
				<div className="flex items-center gap-1">
					<span className="text-xs text-gray-500 w-8">0%</span>
					<div className="flex-1 h-4 rounded-full overflow-hidden flex">
						<div className="flex-1 bg-red-500" />
						<div className="flex-1 bg-orange-500" />
						<div className="flex-1 bg-orange-400" />
						<div className="flex-1 bg-yellow-400" />
						<div className="flex-1 bg-green-400" />
						<div className="flex-1 bg-green-500" />
					</div>
					<span className="text-xs text-gray-500 w-8 text-right">100%</span>
				</div>
				<div className="flex justify-between text-xs text-gray-500 mt-1 px-8">
					<span>Critical</span>
					<span>Low</span>
					<span>Medium</span>
					<span>Good</span>
					<span>Excellent</span>
				</div>
			</div>

			{/* Category Heat Map */}
			<div className="bg-white rounded-lg border overflow-hidden">
				<div className="p-4 border-b bg-gray-50">
					<h4 className="font-medium">Coverage by Category</h4>
				</div>

				{data.categories.length === 0 ? (
					<div className="p-8 text-center text-gray-500">
						No compliance data available
					</div>
				) : (
					<div className="divide-y">
						{data.categories.map((category) => {
							const isExpanded = expandedCategories.has(category.name);
							const StatusIcon = getStatusIcon(category.complianceRate);
							const mandatoryRate =
								category.mandatoryCount > 0
									? Math.round(
											(category.mandatoryAddressed / category.mandatoryCount) * 100
									  )
									: 100;

							return (
								<div key={category.name}>
									{/* Category Row */}
									<div
										className={cn(
											"p-4 hover:bg-gray-50 cursor-pointer transition-colors",
											isExpanded && "bg-gray-50"
										)}
										onClick={() => toggleCategory(category.name)}
										onMouseEnter={() => setTooltipCategory(category.name)}
										onMouseLeave={() => setTooltipCategory(null)}
									>
										<div className="flex items-center gap-3">
											{/* Expand/Collapse */}
											<div className="w-5">
												{category.subcategories.length > 0 &&
													(isExpanded ? (
														<ChevronDown className="w-5 h-5 text-gray-400" />
													) : (
														<ChevronRight className="w-5 h-5 text-gray-400" />
													))}
											</div>

											{/* Status Icon */}
											<StatusIcon
												className={cn(
													"w-5 h-5",
													getComplianceTextColor(category.complianceRate)
												)}
											/>

											{/* Category Name */}
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<span className="font-medium truncate">
														{category.name}
													</span>
													<div className="flex items-center gap-4 text-sm">
														<span className="text-gray-500">
															{category.addressedRequirements}/{category.totalRequirements}
														</span>
														<span
															className={cn(
																"font-semibold w-12 text-right",
																getComplianceTextColor(category.complianceRate)
															)}
														>
															{category.complianceRate}%
														</span>
													</div>
												</div>

												{/* Progress Bar */}
												<div className="mt-2 flex items-center gap-2">
													<div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
														<div
															className={cn(
																"h-full transition-all",
																getComplianceColor(category.complianceRate)
															)}
															style={{ width: `${category.complianceRate}%` }}
														/>
													</div>
													{category.mandatoryCount > 0 && (
														<span
															className={cn(
																"text-xs px-1.5 py-0.5 rounded",
																getComplianceBgColor(mandatoryRate),
																getComplianceTextColor(mandatoryRate)
															)}
														>
															{mandatoryRate}% mandatory
														</span>
													)}
												</div>
											</div>
										</div>

										{/* Tooltip */}
										{tooltipCategory === category.name && (
											<div className="mt-3 p-3 bg-gray-100 rounded-lg text-sm">
												<div className="grid grid-cols-2 gap-2">
													<div>
														<span className="text-gray-500">Total:</span>{" "}
														{category.totalRequirements}
													</div>
													<div>
														<span className="text-gray-500">Addressed:</span>{" "}
														{category.addressedRequirements}
													</div>
													<div>
														<span className="text-gray-500">Mandatory:</span>{" "}
														{category.mandatoryCount}
													</div>
													<div>
														<span className="text-gray-500">
															Mandatory Addressed:
														</span>{" "}
														{category.mandatoryAddressed}
													</div>
												</div>
											</div>
										)}
									</div>

									{/* Subcategories */}
									{isExpanded && category.subcategories.length > 0 && (
										<div className="bg-gray-50 border-t">
											{category.subcategories.map((sub) => {
												const SubIcon = getStatusIcon(sub.complianceRate);

												return (
													<div
														key={sub.name}
														className="px-4 py-3 pl-14 hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-3"
														onClick={(e) => {
															e.stopPropagation();
															onSubcategoryClick?.(category.name, sub.name);
														}}
													>
														<SubIcon
															className={cn(
																"w-4 h-4",
																getComplianceTextColor(sub.complianceRate)
															)}
														/>
														<div className="flex-1 min-w-0">
															<div className="flex items-center justify-between">
																<span className="text-sm truncate">
																	{sub.name}
																</span>
																<div className="flex items-center gap-4 text-sm">
																	<span className="text-gray-500">
																		{sub.addressedRequirements}/{sub.totalRequirements}
																	</span>
																	<span
																		className={cn(
																			"font-medium w-12 text-right",
																			getComplianceTextColor(sub.complianceRate)
																		)}
																	>
																		{sub.complianceRate}%
																	</span>
																</div>
															</div>
															<div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
																<div
																	className={cn(
																		"h-full",
																		getComplianceColor(sub.complianceRate)
																	)}
																	style={{ width: `${sub.complianceRate}%` }}
																/>
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
					</div>
				)}
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-3 gap-4">
				<div className="bg-green-50 rounded-lg p-4 text-center">
					<CheckCircle className="w-6 h-6 mx-auto text-green-600 mb-2" />
					<div className="text-2xl font-bold text-green-700">
						{data.categories.filter((c) => c.complianceRate >= 75).length}
					</div>
					<div className="text-sm text-green-600">
						Categories on Track
					</div>
				</div>
				<div className="bg-yellow-50 rounded-lg p-4 text-center">
					<AlertTriangle className="w-6 h-6 mx-auto text-yellow-600 mb-2" />
					<div className="text-2xl font-bold text-yellow-700">
						{
							data.categories.filter(
								(c) => c.complianceRate >= 40 && c.complianceRate < 75
							).length
						}
					</div>
					<div className="text-sm text-yellow-600">
						Need Attention
					</div>
				</div>
				<div className="bg-red-50 rounded-lg p-4 text-center">
					<XCircle className="w-6 h-6 mx-auto text-red-600 mb-2" />
					<div className="text-2xl font-bold text-red-700">
						{data.categories.filter((c) => c.complianceRate < 40).length}
					</div>
					<div className="text-sm text-red-600">
						Critical Gaps
					</div>
				</div>
			</div>
		</div>
	);
}
