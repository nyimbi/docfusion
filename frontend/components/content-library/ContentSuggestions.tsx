/**
 * ContentSuggestions Component
 *
 * Displays contextual content suggestions based on document context,
 * requirements, or user input with relevance scoring.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Sparkles,
	FileText,
	Plus,
	Eye,
	Copy,
	Check,
	RefreshCw,
	ChevronDown,
	ChevronRight,
	TrendingUp,
	Star,
	Clock,
	Folder,
	Tag,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ContentSuggestion {
	id: string;
	title: string;
	content: string;
	category: string;
	tags: string[];
	relevanceScore: number;
	winRate?: number;
	usageCount?: number;
	lastUsedAt?: string;
	matchReason: string;
}

interface ContentSuggestionsProps {
	suggestions: ContentSuggestion[];
	onInsert: (suggestion: ContentSuggestion) => void;
	onPreview?: (suggestion: ContentSuggestion) => void;
	onRefresh?: () => Promise<void>;
	context?: {
		type: "requirement" | "section" | "general";
		text?: string;
		requirementNumber?: string;
	};
	isLoading?: boolean;
	maxSuggestions?: number;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ContentSuggestions({
	suggestions,
	onInsert,
	onPreview,
	onRefresh,
	context,
	isLoading = false,
	maxSuggestions = 5,
	className,
}: ContentSuggestionsProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	const handleRefresh = async () => {
		if (!onRefresh) return;
		setRefreshing(true);
		try {
			await onRefresh();
		} finally {
			setRefreshing(false);
		}
	};

	const handleCopy = async (suggestion: ContentSuggestion) => {
		await navigator.clipboard.writeText(suggestion.content);
		setCopiedId(suggestion.id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const toggleExpand = (id: string) => {
		setExpandedId(expandedId === id ? null : id);
	};

	const getRelevanceColor = (score: number) => {
		if (score >= 0.8) return "text-green-600 bg-green-100";
		if (score >= 0.6) return "text-yellow-600 bg-yellow-100";
		return "text-orange-600 bg-orange-100";
	};

	const displayedSuggestions = suggestions.slice(0, maxSuggestions);

	return (
		<div className={cn("space-y-3", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Sparkles className="w-5 h-5 text-purple-600" />
					<h3 className="font-medium">Content Suggestions</h3>
					{context && (
						<span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
							{context.type === "requirement"
								? `For ${context.requirementNumber ?? "requirement"}`
								: context.type === "section"
								? "For this section"
								: "General"}
						</span>
					)}
				</div>
				{onRefresh && (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleRefresh}
						disabled={refreshing || isLoading}
					>
						<RefreshCw
							className={cn("w-4 h-4", (refreshing || isLoading) && "animate-spin")}
						/>
					</Button>
				)}
			</div>

			{/* Context Info */}
			{context?.text && (
				<div className="p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700 line-clamp-2">
					<span className="font-medium">Context:</span> {context.text}
				</div>
			)}

			{/* Loading State */}
			{isLoading && displayedSuggestions.length === 0 && (
				<div className="p-8 text-center">
					<Sparkles className="w-8 h-8 mx-auto text-purple-400 animate-pulse mb-3" />
					<p className="text-sm text-gray-500">Finding relevant content...</p>
				</div>
			)}

			{/* Empty State */}
			{!isLoading && displayedSuggestions.length === 0 && (
				<div className="p-8 text-center text-gray-500">
					<FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
					<p className="text-sm">No suggestions available</p>
					{onRefresh && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleRefresh}
							className="mt-3"
						>
							<RefreshCw className="w-4 h-4 mr-1" />
							Generate Suggestions
						</Button>
					)}
				</div>
			)}

			{/* Suggestions List */}
			{displayedSuggestions.length > 0 && (
				<div className="space-y-2">
					{displayedSuggestions.map((suggestion) => {
						const isExpanded = expandedId === suggestion.id;

						return (
							<div
								key={suggestion.id}
								className="border rounded-lg overflow-hidden bg-white"
							>
								{/* Header */}
								<div
									className="p-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50"
									onClick={() => toggleExpand(suggestion.id)}
								>
									<div className="mt-0.5">
										{isExpanded ? (
											<ChevronDown className="w-4 h-4 text-gray-400" />
										) : (
											<ChevronRight className="w-4 h-4 text-gray-400" />
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium text-sm truncate">
												{suggestion.title}
											</span>
											<span
												className={cn(
													"px-1.5 py-0.5 text-xs rounded-full",
													getRelevanceColor(suggestion.relevanceScore)
												)}
											>
												{Math.round(suggestion.relevanceScore * 100)}% match
											</span>
										</div>
										<p className="text-xs text-gray-600 line-clamp-2">
											{suggestion.content}
										</p>
									</div>
								</div>

								{/* Expanded Content */}
								{isExpanded && (
									<div className="border-t">
										{/* Metadata */}
										<div className="px-3 py-2 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
											<span className="flex items-center gap-1">
												<Folder className="w-3 h-3" />
												{suggestion.category}
											</span>
											{suggestion.winRate !== undefined && (
												<span className="flex items-center gap-1">
													<TrendingUp className="w-3 h-3" />
													{Math.round(suggestion.winRate * 100)}% win rate
												</span>
											)}
											{suggestion.usageCount !== undefined && (
												<span className="flex items-center gap-1">
													<Star className="w-3 h-3" />
													{suggestion.usageCount} uses
												</span>
											)}
											{suggestion.lastUsedAt && (
												<span className="flex items-center gap-1">
													<Clock className="w-3 h-3" />
													{new Date(suggestion.lastUsedAt).toLocaleDateString()}
												</span>
											)}
										</div>

										{/* Full Content */}
										<div className="p-3">
											<div className="prose prose-sm max-w-none mb-3">
												<div className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
													{suggestion.content}
												</div>
											</div>

											{/* Tags */}
											{suggestion.tags.length > 0 && (
												<div className="flex flex-wrap gap-1 mb-3">
													{suggestion.tags.map((tag) => (
														<span
															key={tag}
															className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
														>
															<Tag className="w-3 h-3" />
															{tag}
														</span>
													))}
												</div>
											)}

											{/* Match Reason */}
											<div className="p-2 bg-purple-50 rounded text-xs text-purple-700 mb-3">
												<span className="font-medium">Why suggested:</span>{" "}
												{suggestion.matchReason}
											</div>

											{/* Actions */}
											<div className="flex items-center gap-2">
												<Button
													variant="primary"
													size="sm"
													onClick={() => onInsert(suggestion)}
												>
													<Plus className="w-4 h-4 mr-1" />
													Insert
												</Button>
												{onPreview && (
													<Button
														variant="outline"
														size="sm"
														onClick={() => onPreview(suggestion)}
													>
														<Eye className="w-4 h-4 mr-1" />
														Preview
													</Button>
												)}
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleCopy(suggestion)}
												>
													{copiedId === suggestion.id ? (
														<Check className="w-4 h-4 text-green-600" />
													) : (
														<Copy className="w-4 h-4" />
													)}
												</Button>
											</div>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Show More */}
			{suggestions.length > maxSuggestions && (
				<div className="text-center">
					<Button variant="ghost" size="sm">
						Show {suggestions.length - maxSuggestions} more suggestions
					</Button>
				</div>
			)}
		</div>
	);
}
