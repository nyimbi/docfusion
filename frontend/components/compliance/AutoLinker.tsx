/**
 * AutoLinker Component
 *
 * Provides AI-powered automatic linking of requirements to response sections
 * with confidence scoring and batch operations.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Wand2,
	Link,
	CheckCircle,
	XCircle,
	AlertTriangle,
	RefreshCw,
	ChevronDown,
	ChevronRight,
	Play,
	Pause,
	Settings,
	Info,
} from "lucide-react";
import type { AutoLinkResult } from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface AutoLinkerProps {
	documentId: string;
	onAutoLink: (documentId: string, options: AutoLinkOptions) => Promise<AutoLinkResult>;
	onApproveLink?: (requirementId: string, linkTo: string) => Promise<void>;
	onRejectLink?: (requirementId: string) => Promise<void>;
	className?: string;
}

interface AutoLinkOptions {
	minConfidence: number;
	includePartialMatches: boolean;
	limitToMandatory: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AutoLinker({
	documentId,
	onAutoLink,
	onApproveLink,
	onRejectLink,
	className,
}: AutoLinkerProps) {
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<AutoLinkResult | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["linked", "unlinked"])
	);
	const [approving, setApproving] = useState<string | null>(null);
	const [rejecting, setRejecting] = useState<string | null>(null);

	// Options state
	const [options, setOptions] = useState<AutoLinkOptions>({
		minConfidence: 0.7,
		includePartialMatches: true,
		limitToMandatory: false,
	});

	const handleAutoLink = useCallback(async () => {
		setIsRunning(true);
		try {
			const result = await onAutoLink(documentId, options);
			setResults(result);
		} catch (error) {
			console.error("Auto-link failed:", error);
		} finally {
			setIsRunning(false);
		}
	}, [documentId, onAutoLink, options]);

	const handleApprove = useCallback(
		async (requirementId: string, linkTo: string) => {
			if (!onApproveLink) return;
			setApproving(requirementId);
			try {
				await onApproveLink(requirementId, linkTo);
				// Update results to reflect approval
				if (results) {
					setResults({
						...results,
						successfulLinks: results.successfulLinks + 1,
						linkedRequirements: results.linkedRequirements.map((lr) =>
							lr.requirementId === requirementId
								? { ...lr, confidence: 1.0 }
								: lr
						),
					});
				}
			} finally {
				setApproving(null);
			}
		},
		[onApproveLink, results]
	);

	const handleReject = useCallback(
		async (requirementId: string) => {
			if (!onRejectLink) return;
			setRejecting(requirementId);
			try {
				await onRejectLink(requirementId);
				// Update results to reflect rejection
				if (results) {
					const rejected = results.linkedRequirements.find(
						(lr) => lr.requirementId === requirementId
					);
					setResults({
						...results,
						successfulLinks: results.successfulLinks - 1,
						linkedRequirements: results.linkedRequirements.filter(
							(lr) => lr.requirementId !== requirementId
						),
						unlinkedRequirements: rejected
							? [
									...results.unlinkedRequirements,
									{
										requirementId: rejected.requirementId,
										requirementNumber: rejected.requirementNumber,
										reason: "Rejected by user",
									},
							  ]
							: results.unlinkedRequirements,
					});
				}
			} finally {
				setRejecting(null);
			}
		},
		[onRejectLink, results]
	);

	const toggleSection = (section: string) => {
		const newExpanded = new Set(expandedSections);
		if (newExpanded.has(section)) {
			newExpanded.delete(section);
		} else {
			newExpanded.add(section);
		}
		setExpandedSections(newExpanded);
	};

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 0.9) return "text-green-600 bg-green-100";
		if (confidence >= 0.7) return "text-yellow-600 bg-yellow-100";
		return "text-orange-600 bg-orange-100";
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-purple-100 rounded-lg">
							<Wand2 className="w-6 h-6 text-purple-600" />
						</div>
						<div>
							<h3 className="font-semibold">Auto-Link Requirements</h3>
							<p className="text-sm text-gray-500">
								AI-powered matching of requirements to response sections
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowSettings(!showSettings)}
						>
							<Settings className="w-4 h-4 mr-1" />
							Settings
						</Button>
						<Button
							variant="primary"
							onClick={handleAutoLink}
							disabled={isRunning}
						>
							{isRunning ? (
								<>
									<RefreshCw className="w-4 h-4 mr-2 animate-spin" />
									Analyzing...
								</>
							) : (
								<>
									<Play className="w-4 h-4 mr-2" />
									Run Auto-Link
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Settings Panel */}
				{showSettings && (
					<div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
						<h4 className="font-medium">Auto-Link Settings</h4>

						{/* Confidence Threshold */}
						<div>
							<label className="block text-sm font-medium mb-2">
								Minimum Confidence: {Math.round(options.minConfidence * 100)}%
							</label>
							<input
								type="range"
								min="0.5"
								max="0.95"
								step="0.05"
								value={options.minConfidence}
								onChange={(e) =>
									setOptions({
										...options,
										minConfidence: parseFloat(e.target.value),
									})
								}
								className="w-full"
							/>
							<div className="flex justify-between text-xs text-gray-500 mt-1">
								<span>50% (More matches)</span>
								<span>95% (Higher quality)</span>
							</div>
						</div>

						{/* Checkboxes */}
						<div className="flex flex-col gap-2">
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={options.includePartialMatches}
									onChange={(e) =>
										setOptions({
											...options,
											includePartialMatches: e.target.checked,
										})
									}
									className="rounded"
								/>
								<span className="text-sm">Include partial matches</span>
							</label>
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={options.limitToMandatory}
									onChange={(e) =>
										setOptions({
											...options,
											limitToMandatory: e.target.checked,
										})
									}
									className="rounded"
								/>
								<span className="text-sm">Limit to mandatory requirements only</span>
							</label>
						</div>
					</div>
				)}

				{/* Info Box */}
				<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
					<Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
					<p className="text-sm text-blue-700">
						Auto-linking uses semantic analysis to match requirement keywords
						and concepts with response content. Review suggested links before
						finalizing.
					</p>
				</div>
			</div>

			{/* Results */}
			{results && (
				<>
					{/* Summary */}
					<div className="grid grid-cols-3 gap-4">
						<div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
							<CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
							<div className="text-2xl font-bold text-green-700">
								{results.successfulLinks}
							</div>
							<div className="text-sm text-green-600">Successfully Linked</div>
						</div>
						<div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
							<AlertTriangle className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
							<div className="text-2xl font-bold text-yellow-700">
								{results.linkedRequirements.filter((l) => l.confidence < 0.8).length}
							</div>
							<div className="text-sm text-yellow-600">Need Review</div>
						</div>
						<div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
							<XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
							<div className="text-2xl font-bold text-red-700">
								{results.unlinkedRequirements.length}
							</div>
							<div className="text-sm text-red-600">No Match Found</div>
						</div>
					</div>

					{/* Linked Requirements */}
					{results.linkedRequirements.length > 0 && (
						<div className="bg-white rounded-lg border overflow-hidden">
							<button
								onClick={() => toggleSection("linked")}
								className="w-full p-4 flex items-center justify-between bg-green-50 hover:bg-green-100 transition-colors"
							>
								<div className="flex items-center gap-2">
									{expandedSections.has("linked") ? (
										<ChevronDown className="w-5 h-5" />
									) : (
										<ChevronRight className="w-5 h-5" />
									)}
									<Link className="w-5 h-5 text-green-600" />
									<span className="font-medium">
										Linked Requirements ({results.linkedRequirements.length})
									</span>
								</div>
							</button>

							{expandedSections.has("linked") && (
								<div className="divide-y">
									{results.linkedRequirements.map((link) => (
										<div
											key={link.requirementId}
											className="p-4 flex items-center justify-between"
										>
											<div className="flex items-center gap-3">
												<CheckCircle className="w-5 h-5 text-green-500" />
												<div>
													<div className="flex items-center gap-2">
														<span className="font-medium">
															{link.requirementNumber}
														</span>
														<span
															className={cn(
																"px-2 py-0.5 text-xs rounded-full",
																getConfidenceColor(link.confidence)
															)}
														>
															{Math.round(link.confidence * 100)}% confidence
														</span>
													</div>
													<p className="text-sm text-gray-500">
														Linked to: {link.linkedTo}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{onApproveLink && link.confidence < 1.0 && (
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															handleApprove(link.requirementId, link.linkedTo)
														}
														disabled={approving === link.requirementId}
													>
														{approving === link.requirementId ? (
															<RefreshCw className="w-4 h-4 animate-spin" />
														) : (
															<>
																<CheckCircle className="w-4 h-4 mr-1" />
																Approve
															</>
														)}
													</Button>
												)}
												{onRejectLink && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleReject(link.requirementId)}
														disabled={rejecting === link.requirementId}
														className="text-red-600 hover:text-red-700"
													>
														{rejecting === link.requirementId ? (
															<RefreshCw className="w-4 h-4 animate-spin" />
														) : (
															<XCircle className="w-4 h-4" />
														)}
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Unlinked Requirements */}
					{results.unlinkedRequirements.length > 0 && (
						<div className="bg-white rounded-lg border overflow-hidden">
							<button
								onClick={() => toggleSection("unlinked")}
								className="w-full p-4 flex items-center justify-between bg-red-50 hover:bg-red-100 transition-colors"
							>
								<div className="flex items-center gap-2">
									{expandedSections.has("unlinked") ? (
										<ChevronDown className="w-5 h-5" />
									) : (
										<ChevronRight className="w-5 h-5" />
									)}
									<XCircle className="w-5 h-5 text-red-600" />
									<span className="font-medium">
										Unlinked Requirements ({results.unlinkedRequirements.length})
									</span>
								</div>
							</button>

							{expandedSections.has("unlinked") && (
								<div className="divide-y">
									{results.unlinkedRequirements.map((unlinked) => (
										<div
											key={unlinked.requirementId}
											className="p-4 flex items-center justify-between"
										>
											<div className="flex items-center gap-3">
												<AlertTriangle className="w-5 h-5 text-yellow-500" />
												<div>
													<span className="font-medium">
														{unlinked.requirementNumber}
													</span>
													<p className="text-sm text-gray-500">
														{unlinked.reason}
													</p>
												</div>
											</div>
											<Button variant="outline" size="sm">
												Manual Link
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</>
			)}

			{/* Empty State */}
			{!results && !isRunning && (
				<div className="bg-white rounded-lg border p-8 text-center">
					<Wand2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
					<h4 className="font-medium mb-2">Ready to Auto-Link</h4>
					<p className="text-sm text-gray-500 mb-4">
						Click "Run Auto-Link" to analyze your response document and
						automatically match requirements to relevant sections.
					</p>
					<Button onClick={handleAutoLink}>
						<Play className="w-4 h-4 mr-2" />
						Start Analysis
					</Button>
				</div>
			)}
		</div>
	);
}
