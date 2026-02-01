/**
 * ComplianceHeatMap Component (RFP Module)
 *
 * Visual indicator showing compliance coverage for RFP requirements
 * with interactive drill-down by category and section.
 */

"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	ChevronDown,
	ChevronRight,
	Target,
	AlertTriangle,
	CheckCircle,
	XCircle,
	Info,
	ZoomIn,
	ZoomOut,
	Download,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface RequirementSummary {
	id: string;
	requirementNumber: string;
	category: string;
	subcategory: string | null;
	priority: string;
	complianceStatus: string;
	strengthAssessment: string | null;
}

interface ComplianceHeatMapProps {
	requirements: RequirementSummary[];
	onCellClick?: (requirements: RequirementSummary[]) => void;
	onExport?: () => void;
	showLegend?: boolean;
	compact?: boolean;
	className?: string;
}

interface CategoryData {
	name: string;
	total: number;
	compliant: number;
	partial: number;
	notAddressed: number;
	mandatory: number;
	mandatoryCompliant: number;
	complianceRate: number;
	subcategories: SubcategoryData[];
	requirements: RequirementSummary[];
}

interface SubcategoryData {
	name: string;
	total: number;
	compliant: number;
	partial: number;
	notAddressed: number;
	complianceRate: number;
	requirements: RequirementSummary[];
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
	if (rate >= 90) return "bg-green-100";
	if (rate >= 75) return "bg-green-50";
	if (rate >= 60) return "bg-yellow-50";
	if (rate >= 40) return "bg-orange-50";
	if (rate >= 20) return "bg-orange-100";
	return "bg-red-100";
}

function isCompliant(status: string): boolean {
	return ["compliant", "addressed", "not_applicable"].includes(status);
}

function isPartial(status: string): boolean {
	return status === "partial";
}

// ============================================================================
// Component
// ============================================================================

export function ComplianceHeatMap({
	requirements,
	onCellClick,
	onExport,
	showLegend = true,
	compact = false,
	className,
}: ComplianceHeatMapProps) {
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
	const [zoomLevel, setZoomLevel] = useState<"overview" | "detailed">("overview");
	const [hoveredCell, setHoveredCell] = useState<string | null>(null);

	// Process requirements into category data
	const categoryData = useMemo(() => {
		const categoryMap = new Map<string, CategoryData>();

		for (const req of requirements) {
			if (!categoryMap.has(req.category)) {
				categoryMap.set(req.category, {
					name: req.category,
					total: 0,
					compliant: 0,
					partial: 0,
					notAddressed: 0,
					mandatory: 0,
					mandatoryCompliant: 0,
					complianceRate: 0,
					subcategories: [],
					requirements: [],
				});
			}

			const catData = categoryMap.get(req.category)!;
			catData.total++;
			catData.requirements.push(req);

			if (isCompliant(req.complianceStatus)) catData.compliant++;
			else if (isPartial(req.complianceStatus)) catData.partial++;
			else catData.notAddressed++;

			if (req.priority === "mandatory") {
				catData.mandatory++;
				if (isCompliant(req.complianceStatus)) catData.mandatoryCompliant++;
			}
		}

		// Calculate compliance rates and subcategories
		for (const [, catData] of categoryMap) {
			catData.complianceRate =
				catData.total > 0
					? Math.round(((catData.compliant + catData.partial * 0.5) / catData.total) * 100)
					: 0;

			// Group by subcategory
			const subcatMap = new Map<string, SubcategoryData>();
			for (const req of catData.requirements) {
				const subcatName = req.subcategory ?? "General";
				if (!subcatMap.has(subcatName)) {
					subcatMap.set(subcatName, {
						name: subcatName,
						total: 0,
						compliant: 0,
						partial: 0,
						notAddressed: 0,
						complianceRate: 0,
						requirements: [],
					});
				}

				const subcatData = subcatMap.get(subcatName)!;
				subcatData.total++;
				subcatData.requirements.push(req);

				if (isCompliant(req.complianceStatus)) subcatData.compliant++;
				else if (isPartial(req.complianceStatus)) subcatData.partial++;
				else subcatData.notAddressed++;
			}

			for (const [, subcatData] of subcatMap) {
				subcatData.complianceRate =
					subcatData.total > 0
						? Math.round(((subcatData.compliant + subcatData.partial * 0.5) / subcatData.total) * 100)
						: 0;
			}

			catData.subcategories = Array.from(subcatMap.values()).sort(
				(a, b) => a.complianceRate - b.complianceRate
			);
		}

		return Array.from(categoryMap.values()).sort(
			(a, b) => a.complianceRate - b.complianceRate
		);
	}, [requirements]);

	// Overall stats
	const overallStats = useMemo(() => {
		const total = requirements.length;
		const compliant = requirements.filter((r) => isCompliant(r.complianceStatus)).length;
		const partial = requirements.filter((r) => isPartial(r.complianceStatus)).length;
		const mandatory = requirements.filter((r) => r.priority === "mandatory");
		const mandatoryCompliant = mandatory.filter((r) => isCompliant(r.complianceStatus)).length;

		return {
			total,
			compliant,
			partial,
			notAddressed: total - compliant - partial,
			overallRate: total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0,
			mandatoryRate: mandatory.length > 0 ? Math.round((mandatoryCompliant / mandatory.length) * 100) : 100,
		};
	}, [requirements]);

	const toggleCategory = (category: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	};

	const handleCellClick = (reqs: RequirementSummary[]) => {
		onCellClick?.(reqs);
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Target className="w-5 h-5 text-blue-600" />
					<h3 className="font-semibold">Compliance Heat Map</h3>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setZoomLevel(zoomLevel === "overview" ? "detailed" : "overview")}
					>
						{zoomLevel === "overview" ? (
							<ZoomIn className="w-4 h-4" />
						) : (
							<ZoomOut className="w-4 h-4" />
						)}
					</Button>
					{onExport && (
						<Button variant="outline" size="sm" onClick={onExport}>
							<Download className="w-4 h-4 mr-1" />
							Export
						</Button>
					)}
				</div>
			</div>

			{/* Overall Summary */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<div className={cn("p-3 rounded-lg text-center", getComplianceBgColor(overallStats.overallRate))}>
					<div className="text-2xl font-bold">{overallStats.overallRate}%</div>
					<div className="text-xs text-gray-600">Overall Coverage</div>
				</div>
				<div className={cn("p-3 rounded-lg text-center", getComplianceBgColor(overallStats.mandatoryRate))}>
					<div className="text-2xl font-bold">{overallStats.mandatoryRate}%</div>
					<div className="text-xs text-gray-600">Mandatory Coverage</div>
				</div>
				<div className="p-3 rounded-lg text-center bg-gray-50">
					<div className="text-2xl font-bold text-green-600">{overallStats.compliant}</div>
					<div className="text-xs text-gray-600">Compliant</div>
				</div>
				<div className="p-3 rounded-lg text-center bg-gray-50">
					<div className="text-2xl font-bold text-red-600">{overallStats.notAddressed}</div>
					<div className="text-xs text-gray-600">Not Addressed</div>
				</div>
			</div>

			{/* Legend */}
			{showLegend && (
				<div className="flex items-center gap-4 text-xs">
					<div className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-green-500" />
						<span>90-100%</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-green-400" />
						<span>75-89%</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-yellow-400" />
						<span>60-74%</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-orange-400" />
						<span>40-59%</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-red-500" />
						<span>&lt;40%</span>
					</div>
				</div>
			)}

			{/* Heat Map Grid */}
			{zoomLevel === "overview" ? (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
					{categoryData.map((cat) => (
						<button
							key={cat.name}
							onClick={() => handleCellClick(cat.requirements)}
							onMouseEnter={() => setHoveredCell(cat.name)}
							onMouseLeave={() => setHoveredCell(null)}
							className={cn(
								"p-4 rounded-lg text-left transition-all hover:shadow-md",
								getComplianceBgColor(cat.complianceRate),
								hoveredCell === cat.name && "ring-2 ring-blue-400"
							)}
						>
							<div className="font-medium capitalize truncate">{cat.name.replace(/_/g, " ")}</div>
							<div className="text-2xl font-bold">{cat.complianceRate}%</div>
							<div className="text-xs text-gray-600">
								{cat.compliant}/{cat.total} compliant
							</div>
							{cat.mandatory > 0 && (
								<div className="text-xs text-gray-500 mt-1">
									{cat.mandatoryCompliant}/{cat.mandatory} mandatory
								</div>
							)}
						</button>
					))}
				</div>
			) : (
				<div className="space-y-2">
					{categoryData.map((cat) => {
						const isExpanded = expandedCategories.has(cat.name);

						return (
							<div key={cat.name} className="border rounded-lg overflow-hidden">
								<button
									onClick={() => toggleCategory(cat.name)}
									className={cn(
										"w-full p-3 flex items-center justify-between",
										getComplianceBgColor(cat.complianceRate)
									)}
								>
									<div className="flex items-center gap-2">
										{isExpanded ? (
											<ChevronDown className="w-4 h-4" />
										) : (
											<ChevronRight className="w-4 h-4" />
										)}
										<span className="font-medium capitalize">
											{cat.name.replace(/_/g, " ")}
										</span>
										<span className="text-sm text-gray-600">
											({cat.total} requirements)
										</span>
									</div>
									<div className="flex items-center gap-4">
										<div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
											<div
												className={cn("h-full", getComplianceColor(cat.complianceRate))}
												style={{ width: `${cat.complianceRate}%` }}
											/>
										</div>
										<span className="font-semibold w-12 text-right">
											{cat.complianceRate}%
										</span>
									</div>
								</button>

								{isExpanded && (
									<div className="p-2 bg-gray-50 space-y-1">
										{cat.subcategories.map((subcat) => (
											<button
												key={subcat.name}
												onClick={() => handleCellClick(subcat.requirements)}
												className={cn(
													"w-full p-2 rounded flex items-center justify-between hover:bg-gray-100",
													hoveredCell === `${cat.name}-${subcat.name}` &&
														"ring-2 ring-blue-400"
												)}
												onMouseEnter={() => setHoveredCell(`${cat.name}-${subcat.name}`)}
												onMouseLeave={() => setHoveredCell(null)}
											>
												<div className="flex items-center gap-2">
													<div
														className={cn(
															"w-3 h-3 rounded",
															getComplianceColor(subcat.complianceRate)
														)}
													/>
													<span className="text-sm">{subcat.name}</span>
													<span className="text-xs text-gray-500">
														({subcat.total})
													</span>
												</div>
												<span className="text-sm font-medium">
													{subcat.complianceRate}%
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Status Summary */}
			<div className="flex items-center justify-center gap-6 py-3 border-t text-sm">
				<div className="flex items-center gap-1">
					<CheckCircle className="w-4 h-4 text-green-600" />
					<span>{overallStats.compliant} Compliant</span>
				</div>
				<div className="flex items-center gap-1">
					<AlertTriangle className="w-4 h-4 text-yellow-600" />
					<span>{overallStats.partial} Partial</span>
				</div>
				<div className="flex items-center gap-1">
					<XCircle className="w-4 h-4 text-red-600" />
					<span>{overallStats.notAddressed} Not Addressed</span>
				</div>
			</div>
		</div>
	);
}
