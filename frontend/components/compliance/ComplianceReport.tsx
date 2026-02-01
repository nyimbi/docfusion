/**
 * ComplianceReport Component
 *
 * Generates and displays a comprehensive compliance report with
 * export capabilities for stakeholder review.
 */

"use client";

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	FileText,
	Download,
	Printer,
	Mail,
	CheckCircle,
	XCircle,
	AlertTriangle,
	BarChart3,
	Calendar,
	User,
	Building,
	Clock,
	TrendingUp,
	TrendingDown,
} from "lucide-react";
import type {
	ValidationResult,
	HeatMapData,
	BidirectionalValidation,
} from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface ComplianceReportProps {
	opportunityId: string;
	opportunityName: string;
	clientName?: string;
	dueDate?: string;
	validationResult: ValidationResult;
	heatMapData?: HeatMapData;
	bidirectionalValidation?: BidirectionalValidation;
	previousScore?: number;
	onExport?: (format: "pdf" | "xlsx" | "docx") => Promise<void>;
	onShare?: (email: string) => Promise<void>;
	className?: string;
}

interface ReportSection {
	id: string;
	title: string;
	content: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function ComplianceReport({
	opportunityId,
	opportunityName,
	clientName,
	dueDate,
	validationResult,
	heatMapData,
	bidirectionalValidation,
	previousScore,
	onExport,
	onShare,
	className,
}: ComplianceReportProps) {
	const [exporting, setExporting] = useState<string | null>(null);
	const [shareEmail, setShareEmail] = useState("");
	const [showShareDialog, setShowShareDialog] = useState(false);
	const reportRef = useRef<HTMLDivElement>(null);

	const handleExport = async (format: "pdf" | "xlsx" | "docx") => {
		if (!onExport) return;
		setExporting(format);
		try {
			await onExport(format);
		} finally {
			setExporting(null);
		}
	};

	const handlePrint = () => {
		window.print();
	};

	const handleShare = async () => {
		if (!onShare || !shareEmail) return;
		try {
			await onShare(shareEmail);
			setShowShareDialog(false);
			setShareEmail("");
		} catch (error) {
			console.error("Share failed:", error);
		}
	};

	const scoreTrend =
		previousScore !== undefined
			? validationResult.coverageScore - previousScore
			: null;

	// Calculate issue breakdown
	const criticalIssues = validationResult.issues.filter(
		(i) => i.severity === "critical"
	).length;
	const highIssues = validationResult.issues.filter(
		(i) => i.severity === "high"
	).length;
	const mediumIssues = validationResult.issues.filter(
		(i) => i.severity === "medium"
	).length;
	const lowIssues = validationResult.issues.filter(
		(i) => i.severity === "low"
	).length;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Report Header */}
			<div className="bg-white rounded-lg border p-6 print:shadow-none">
				<div className="flex items-start justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold mb-2">Compliance Report</h1>
						<h2 className="text-lg text-gray-700">{opportunityName}</h2>
					</div>
					<div className="flex items-center gap-2 print:hidden">
						<Button variant="outline" size="sm" onClick={handlePrint}>
							<Printer className="w-4 h-4 mr-1" />
							Print
						</Button>
						{onShare && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowShareDialog(true)}
							>
								<Mail className="w-4 h-4 mr-1" />
								Share
							</Button>
						)}
						{onExport && (
							<div className="relative">
								<Button
									variant="primary"
									size="sm"
									onClick={() => handleExport("pdf")}
									disabled={!!exporting}
								>
									{exporting ? (
										<span className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
									) : (
										<Download className="w-4 h-4 mr-1" />
									)}
									Export PDF
								</Button>
							</div>
						)}
					</div>
				</div>

				{/* Metadata Grid */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
					{clientName && (
						<div className="flex items-center gap-2">
							<Building className="w-4 h-4 text-gray-400" />
							<div>
								<div className="text-gray-500">Client</div>
								<div className="font-medium">{clientName}</div>
							</div>
						</div>
					)}
					{dueDate && (
						<div className="flex items-center gap-2">
							<Calendar className="w-4 h-4 text-gray-400" />
							<div>
								<div className="text-gray-500">Due Date</div>
								<div className="font-medium">
									{new Date(dueDate).toLocaleDateString()}
								</div>
							</div>
						</div>
					)}
					<div className="flex items-center gap-2">
						<Clock className="w-4 h-4 text-gray-400" />
						<div>
							<div className="text-gray-500">Generated</div>
							<div className="font-medium">
								{new Date(validationResult.timestamp).toLocaleDateString()}
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<FileText className="w-4 h-4 text-gray-400" />
						<div>
							<div className="text-gray-500">Total Requirements</div>
							<div className="font-medium">
								{validationResult.totalRequirements}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Executive Summary */}
			<div
				ref={reportRef}
				className="bg-white rounded-lg border p-6 print:shadow-none"
			>
				<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
					<BarChart3 className="w-5 h-5" />
					Executive Summary
				</h3>

				{/* Status Banner */}
				<div
					className={cn(
						"p-4 rounded-lg mb-6",
						validationResult.isValid
							? "bg-green-50 border border-green-200"
							: "bg-red-50 border border-red-200"
					)}
				>
					<div className="flex items-center gap-3">
						{validationResult.isValid ? (
							<CheckCircle className="w-8 h-8 text-green-600" />
						) : (
							<XCircle className="w-8 h-8 text-red-600" />
						)}
						<div>
							<div
								className={cn(
									"text-lg font-semibold",
									validationResult.isValid ? "text-green-800" : "text-red-800"
								)}
							>
								{validationResult.isValid
									? "Compliant - Ready for Submission"
									: "Non-Compliant - Action Required"}
							</div>
							<p
								className={cn(
									"text-sm",
									validationResult.isValid ? "text-green-600" : "text-red-600"
								)}
							>
								{validationResult.isValid
									? "All mandatory requirements have been addressed."
									: `${
											validationResult.mandatoryRequirements -
											validationResult.addressedRequirements
									  } mandatory requirements need attention.`}
							</p>
						</div>
					</div>
				</div>

				{/* Score Cards */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold text-gray-900">
							{validationResult.coverageScore}%
						</div>
						<div className="text-sm text-gray-600">Overall Coverage</div>
						{scoreTrend !== null && (
							<div
								className={cn(
									"flex items-center justify-center gap-1 text-xs mt-1",
									scoreTrend >= 0 ? "text-green-600" : "text-red-600"
								)}
							>
								{scoreTrend >= 0 ? (
									<TrendingUp className="w-3 h-3" />
								) : (
									<TrendingDown className="w-3 h-3" />
								)}
								{scoreTrend >= 0 ? "+" : ""}
								{scoreTrend}% from previous
							</div>
						)}
					</div>
					<div className="bg-gray-50 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold text-gray-900">
							{validationResult.mandatoryCoverageScore}%
						</div>
						<div className="text-sm text-gray-600">Mandatory Coverage</div>
					</div>
					<div className="bg-gray-50 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold text-gray-900">
							{validationResult.addressedRequirements}
						</div>
						<div className="text-sm text-gray-600">
							of {validationResult.totalRequirements} Addressed
						</div>
					</div>
					<div className="bg-gray-50 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold text-gray-900">
							{validationResult.issues.length}
						</div>
						<div className="text-sm text-gray-600">Open Issues</div>
					</div>
				</div>

				{/* Issue Breakdown */}
				<div className="mb-6">
					<h4 className="font-medium mb-3">Issue Breakdown</h4>
					<div className="flex items-center gap-2">
						<div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden flex">
							{criticalIssues > 0 && (
								<div
									className="h-full bg-red-500"
									style={{
										width: `${
											(criticalIssues / validationResult.issues.length) * 100
										}%`,
									}}
								/>
							)}
							{highIssues > 0 && (
								<div
									className="h-full bg-orange-500"
									style={{
										width: `${
											(highIssues / validationResult.issues.length) * 100
										}%`,
									}}
								/>
							)}
							{mediumIssues > 0 && (
								<div
									className="h-full bg-yellow-500"
									style={{
										width: `${
											(mediumIssues / validationResult.issues.length) * 100
										}%`,
									}}
								/>
							)}
							{lowIssues > 0 && (
								<div
									className="h-full bg-blue-500"
									style={{
										width: `${
											(lowIssues / validationResult.issues.length) * 100
										}%`,
									}}
								/>
							)}
						</div>
					</div>
					<div className="flex items-center justify-between text-xs mt-2">
						<div className="flex items-center gap-4">
							<span className="flex items-center gap-1">
								<span className="w-3 h-3 bg-red-500 rounded" />
								Critical ({criticalIssues})
							</span>
							<span className="flex items-center gap-1">
								<span className="w-3 h-3 bg-orange-500 rounded" />
								High ({highIssues})
							</span>
							<span className="flex items-center gap-1">
								<span className="w-3 h-3 bg-yellow-500 rounded" />
								Medium ({mediumIssues})
							</span>
							<span className="flex items-center gap-1">
								<span className="w-3 h-3 bg-blue-500 rounded" />
								Low ({lowIssues})
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Critical Issues */}
			{criticalIssues > 0 && (
				<div className="bg-white rounded-lg border p-6 print:shadow-none">
					<h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-700">
						<XCircle className="w-5 h-5" />
						Critical Issues ({criticalIssues})
					</h3>
					<div className="space-y-3">
						{validationResult.issues
							.filter((i) => i.severity === "critical")
							.map((issue, index) => (
								<div
									key={`${issue.requirementId}-${index}`}
									className="p-4 bg-red-50 border border-red-200 rounded-lg"
								>
									<div className="flex items-start gap-3">
										<AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
										<div>
											<div className="font-medium">
												{issue.requirementNumber}
											</div>
											<p className="text-sm text-gray-700 mt-1">
												{issue.description}
											</p>
											{issue.suggestion && (
												<p className="text-sm text-blue-700 mt-2">
													<strong>Suggested action:</strong> {issue.suggestion}
												</p>
											)}
										</div>
									</div>
								</div>
							))}
					</div>
				</div>
			)}

			{/* Category Coverage */}
			{heatMapData && heatMapData.categories.length > 0 && (
				<div className="bg-white rounded-lg border p-6 print:shadow-none">
					<h3 className="text-lg font-semibold mb-4">Coverage by Category</h3>
					<div className="space-y-3">
						{heatMapData.categories.map((category) => (
							<div key={category.name} className="flex items-center gap-4">
								<div className="w-32 text-sm font-medium truncate">
									{category.name}
								</div>
								<div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
									<div
										className={cn(
											"h-full transition-all",
											category.complianceRate >= 90
												? "bg-green-500"
												: category.complianceRate >= 75
												? "bg-green-400"
												: category.complianceRate >= 60
												? "bg-yellow-400"
												: category.complianceRate >= 40
												? "bg-orange-400"
												: "bg-red-500"
										)}
										style={{ width: `${category.complianceRate}%` }}
									/>
								</div>
								<div className="w-16 text-sm text-right">
									{category.complianceRate}%
								</div>
								<div className="w-20 text-xs text-gray-500 text-right">
									{category.addressedRequirements}/{category.totalRequirements}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Bidirectional Validation Summary */}
			{bidirectionalValidation && (
				<div className="bg-white rounded-lg border p-6 print:shadow-none">
					<h3 className="text-lg font-semibold mb-4">
						Cross-Reference Validation
					</h3>
					<div className="grid grid-cols-3 gap-4">
						<div
							className={cn(
								"p-4 rounded-lg text-center",
								bidirectionalValidation.requirementsWithoutResponse.length > 0
									? "bg-red-50"
									: "bg-green-50"
							)}
						>
							<div
								className={cn(
									"text-2xl font-bold",
									bidirectionalValidation.requirementsWithoutResponse.length >
										0
										? "text-red-700"
										: "text-green-700"
								)}
							>
								{bidirectionalValidation.requirementsWithoutResponse.length}
							</div>
							<div className="text-sm text-gray-600">
								Unaddressed Requirements
							</div>
						</div>
						<div
							className={cn(
								"p-4 rounded-lg text-center",
								bidirectionalValidation.responsesWithoutRequirement.length > 0
									? "bg-yellow-50"
									: "bg-green-50"
							)}
						>
							<div
								className={cn(
									"text-2xl font-bold",
									bidirectionalValidation.responsesWithoutRequirement.length >
										0
										? "text-yellow-700"
										: "text-green-700"
								)}
							>
								{bidirectionalValidation.responsesWithoutRequirement.length}
							</div>
							<div className="text-sm text-gray-600">
								Orphan Response Sections
							</div>
						</div>
						<div
							className={cn(
								"p-4 rounded-lg text-center",
								bidirectionalValidation.orphanedCrossReferences.length > 0
									? "bg-orange-50"
									: "bg-green-50"
							)}
						>
							<div
								className={cn(
									"text-2xl font-bold",
									bidirectionalValidation.orphanedCrossReferences.length > 0
										? "text-orange-700"
										: "text-green-700"
								)}
							>
								{bidirectionalValidation.orphanedCrossReferences.length}
							</div>
							<div className="text-sm text-gray-600">Broken References</div>
						</div>
					</div>
				</div>
			)}

			{/* Recommendations */}
			{validationResult.suggestions.length > 0 && (
				<div className="bg-white rounded-lg border p-6 print:shadow-none">
					<h3 className="text-lg font-semibold mb-4">Recommendations</h3>
					<div className="space-y-3">
						{validationResult.suggestions.slice(0, 10).map((suggestion, index) => (
							<div
								key={`${suggestion.requirementId}-${index}`}
								className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
							>
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
									{suggestion.priority}
								</span>
								<p className="text-sm text-gray-700">{suggestion.description}</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Footer */}
			<div className="text-center text-sm text-gray-500 py-4 print:mt-8">
				<p>
					Generated by DocuFusion Compliance Engine •{" "}
					{new Date(validationResult.timestamp).toLocaleString()}
				</p>
			</div>

			{/* Share Dialog */}
			{showShareDialog && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
					<div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
						<h3 className="text-lg font-semibold mb-4">Share Report</h3>
						<input
							type="email"
							value={shareEmail}
							onChange={(e) => setShareEmail(e.target.value)}
							placeholder="Enter email address"
							className="w-full px-3 py-2 border rounded-lg mb-4"
						/>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowShareDialog(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleShare} disabled={!shareEmail}>
								<Mail className="w-4 h-4 mr-1" />
								Send
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Print Styles */}
			<style jsx global>{`
				@media print {
					body * {
						visibility: hidden;
					}
					.print\\:shadow-none,
					.print\\:shadow-none * {
						visibility: visible;
					}
					.print\\:hidden {
						display: none !important;
					}
				}
			`}</style>
		</div>
	);
}
