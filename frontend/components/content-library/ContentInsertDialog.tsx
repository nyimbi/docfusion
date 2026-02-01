/**
 * ContentInsertDialog Component
 *
 * Dialog for selecting and inserting content blocks into documents
 * with search, preview, and customization options.
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	X,
	Search,
	FileText,
	Plus,
	Check,
	Folder,
	Tag,
	TrendingUp,
	Star,
	Clock,
	ChevronRight,
	Filter,
	Eye,
	Copy,
	Edit,
	RefreshCw,
	Sparkles,
	ArrowRight,
} from "lucide-react";
import { FreshnessBadge } from "./FreshnessIndicator";

// ============================================================================
// Types
// ============================================================================

interface ContentBlock {
	id: string;
	title: string;
	content: string;
	category: string;
	contentType: string;
	tags: string[];
	winRate?: number;
	qualityScore?: number;
	usageCount: number;
	freshnessStatus: "current" | "stale" | "needs_review" | "expired";
}

interface InsertOptions {
	insertAsReference: boolean;
	adaptToContext: boolean;
	includeMetadata: boolean;
}

interface ContentInsertDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onInsert: (block: ContentBlock, options: InsertOptions, customContent?: string) => void;
	onSearch: (query: string, filters: SearchFilters) => Promise<ContentBlock[]>;
	onAIAdapt?: (block: ContentBlock, context: string) => Promise<string>;
	suggestedBlocks?: ContentBlock[];
	documentContext?: {
		sectionTitle?: string;
		requirementText?: string;
		surroundingText?: string;
	};
	categories: { value: string; label: string }[];
	className?: string;
}

interface SearchFilters {
	categories: string[];
	contentTypes: string[];
	tags: string[];
	minWinRate?: number;
}

// ============================================================================
// Component
// ============================================================================

export function ContentInsertDialog({
	isOpen,
	onClose,
	onInsert,
	onSearch,
	onAIAdapt,
	suggestedBlocks = [],
	documentContext,
	categories,
	className,
}: ContentInsertDialogProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<ContentBlock[]>([]);
	const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null);
	const [customContent, setCustomContent] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [filters, setFilters] = useState<SearchFilters>({
		categories: [],
		contentTypes: [],
		tags: [],
	});
	const [insertOptions, setInsertOptions] = useState<InsertOptions>({
		insertAsReference: false,
		adaptToContext: false,
		includeMetadata: false,
	});
	const [isSearching, setIsSearching] = useState(false);
	const [isAdapting, setIsAdapting] = useState(false);
	const [step, setStep] = useState<"search" | "preview" | "customize">("search");

	// Reset state when dialog opens/closes
	useEffect(() => {
		if (isOpen) {
			setSearchQuery("");
			setSearchResults([]);
			setSelectedBlock(null);
			setCustomContent("");
			setStep("search");
			setInsertOptions({
				insertAsReference: false,
				adaptToContext: false,
				includeMetadata: false,
			});
		}
	}, [isOpen]);

	const handleSearch = async () => {
		if (!searchQuery.trim() && filters.categories.length === 0) return;

		setIsSearching(true);
		try {
			const results = await onSearch(searchQuery, filters);
			setSearchResults(results);
		} finally {
			setIsSearching(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const handleSelectBlock = (block: ContentBlock) => {
		setSelectedBlock(block);
		setCustomContent(block.content);
		setStep("preview");
	};

	const handleAdaptContent = async () => {
		if (!selectedBlock || !onAIAdapt || !documentContext) return;

		setIsAdapting(true);
		try {
			const contextText = [
				documentContext.sectionTitle && `Section: ${documentContext.sectionTitle}`,
				documentContext.requirementText && `Requirement: ${documentContext.requirementText}`,
				documentContext.surroundingText && `Context: ${documentContext.surroundingText}`,
			]
				.filter(Boolean)
				.join("\n");

			const adaptedContent = await onAIAdapt(selectedBlock, contextText);
			setCustomContent(adaptedContent);
			setStep("customize");
		} finally {
			setIsAdapting(false);
		}
	};

	const handleInsert = () => {
		if (!selectedBlock) return;

		onInsert(
			selectedBlock,
			insertOptions,
			customContent !== selectedBlock.content ? customContent : undefined
		);
		onClose();
	};

	const toggleFilter = (key: keyof Omit<SearchFilters, "minWinRate">, value: string) => {
		setFilters((prev) => ({
			...prev,
			[key]: prev[key].includes(value)
				? prev[key].filter((v) => v !== value)
				: [...prev[key], value],
		}));
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50" onClick={onClose} />

			{/* Dialog */}
			<div
				className={cn(
					"relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col",
					className
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b">
					<div className="flex items-center gap-3">
						<FileText className="w-6 h-6 text-blue-600" />
						<div>
							<h2 className="text-lg font-semibold">Insert Content Block</h2>
							<p className="text-sm text-gray-500">
								{step === "search" && "Search or browse content library"}
								{step === "preview" && "Preview and customize content"}
								{step === "customize" && "Edit content before inserting"}
							</p>
						</div>
					</div>
					<button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Step: Search */}
				{step === "search" && (
					<div className="flex-1 overflow-hidden flex flex-col">
						{/* Search Bar */}
						<div className="p-4 border-b">
							<div className="flex gap-2">
								<div className="flex-1 relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
									<input
										type="text"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={handleKeyDown}
										placeholder="Search content blocks..."
										className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
										autoFocus
									/>
								</div>
								<Button
									variant="outline"
									onClick={() => setShowFilters(!showFilters)}
									className={cn(showFilters && "bg-blue-50 border-blue-300")}
								>
									<Filter className="w-4 h-4 mr-1" />
									Filters
								</Button>
								<Button
									variant="primary"
									onClick={handleSearch}
									disabled={isSearching}
								>
									{isSearching ? (
										<RefreshCw className="w-4 h-4 animate-spin" />
									) : (
										"Search"
									)}
								</Button>
							</div>

							{/* Filters Panel */}
							{showFilters && (
								<div className="mt-3 p-3 bg-gray-50 rounded-lg">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-sm font-medium text-gray-700 mb-2 block">
												Categories
											</label>
											<div className="flex flex-wrap gap-2">
												{categories.slice(0, 6).map((cat) => (
													<button
														key={cat.value}
														onClick={() => toggleFilter("categories", cat.value)}
														className={cn(
															"px-2 py-1 text-xs rounded transition-colors",
															filters.categories.includes(cat.value)
																? "bg-blue-100 text-blue-700"
																: "bg-gray-100 text-gray-600 hover:bg-gray-200"
														)}
													>
														{cat.label}
													</button>
												))}
											</div>
										</div>
										<div>
											<label className="text-sm font-medium text-gray-700 mb-2 block">
												Min Win Rate
											</label>
											<input
												type="range"
												min="0"
												max="100"
												step="10"
												value={filters.minWinRate ?? 0}
												onChange={(e) =>
													setFilters((prev) => ({
														...prev,
														minWinRate: parseInt(e.target.value) || undefined,
													}))
												}
												className="w-full"
											/>
											<div className="flex justify-between text-xs text-gray-500">
												<span>Any</span>
												<span>{filters.minWinRate ?? 0}%+</span>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Results Area */}
						<div className="flex-1 overflow-y-auto p-4">
							{/* Suggested Blocks */}
							{suggestedBlocks.length > 0 && searchResults.length === 0 && (
								<div className="mb-4">
									<div className="flex items-center gap-2 mb-2">
										<Sparkles className="w-4 h-4 text-purple-600" />
										<h3 className="text-sm font-medium text-gray-700">
											Suggested for this context
										</h3>
									</div>
									<div className="space-y-2">
										{suggestedBlocks.slice(0, 3).map((block) => (
											<ContentBlockRow
												key={block.id}
												block={block}
												onSelect={() => handleSelectBlock(block)}
											/>
										))}
									</div>
								</div>
							)}

							{/* Search Results */}
							{searchResults.length > 0 && (
								<div>
									<h3 className="text-sm font-medium text-gray-700 mb-2">
										Search Results ({searchResults.length})
									</h3>
									<div className="space-y-2">
										{searchResults.map((block) => (
											<ContentBlockRow
												key={block.id}
												block={block}
												onSelect={() => handleSelectBlock(block)}
											/>
										))}
									</div>
								</div>
							)}

							{/* Empty State */}
							{!isSearching && searchResults.length === 0 && suggestedBlocks.length === 0 && (
								<div className="p-8 text-center text-gray-500">
									<Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
									<p>Search for content blocks or browse by category</p>
								</div>
							)}

							{/* Loading State */}
							{isSearching && (
								<div className="p-8 text-center">
									<RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-3" />
									<p className="text-sm text-gray-500">Searching...</p>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Step: Preview */}
				{step === "preview" && selectedBlock && (
					<div className="flex-1 overflow-hidden flex flex-col">
						<div className="flex-1 overflow-y-auto p-4">
							{/* Block Info */}
							<div className="mb-4">
								<div className="flex items-start justify-between mb-2">
									<div>
										<h3 className="font-medium">{selectedBlock.title}</h3>
										<div className="flex items-center gap-2 text-sm text-gray-500">
											<span className="flex items-center gap-1">
												<Folder className="w-4 h-4" />
												{selectedBlock.category}
											</span>
											<span>•</span>
											<FreshnessBadge status={selectedBlock.freshnessStatus} />
										</div>
									</div>
									<div className="flex items-center gap-4 text-sm">
										{selectedBlock.winRate !== undefined && (
											<span className="flex items-center gap-1 text-green-600">
												<TrendingUp className="w-4 h-4" />
												{Math.round(selectedBlock.winRate * 100)}% win
											</span>
										)}
										{selectedBlock.qualityScore !== undefined && (
											<span className="flex items-center gap-1">
												<Star className="w-4 h-4" />
												{selectedBlock.qualityScore}/100
											</span>
										)}
									</div>
								</div>

								{/* Tags */}
								{selectedBlock.tags.length > 0 && (
									<div className="flex flex-wrap gap-1 mb-3">
										{selectedBlock.tags.map((tag) => (
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
							</div>

							{/* Content Preview */}
							<div className="mb-4">
								<h4 className="text-sm font-medium text-gray-700 mb-2">Content Preview</h4>
								<div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
									<div className="whitespace-pre-wrap">{selectedBlock.content}</div>
								</div>
							</div>

							{/* Document Context */}
							{documentContext && (
								<div className="mb-4">
									<h4 className="text-sm font-medium text-gray-700 mb-2">
										Document Context
									</h4>
									<div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
										{documentContext.sectionTitle && (
											<p className="text-purple-700">
												<span className="font-medium">Section:</span>{" "}
												{documentContext.sectionTitle}
											</p>
										)}
										{documentContext.requirementText && (
											<p className="text-purple-700 mt-1">
												<span className="font-medium">Requirement:</span>{" "}
												{documentContext.requirementText}
											</p>
										)}
									</div>
								</div>
							)}

							{/* Insert Options */}
							<div className="space-y-3">
								<h4 className="text-sm font-medium text-gray-700">Insert Options</h4>
								<label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
									<input
										type="checkbox"
										checked={insertOptions.insertAsReference}
										onChange={(e) =>
											setInsertOptions((prev) => ({
												...prev,
												insertAsReference: e.target.checked,
											}))
										}
										className="mt-0.5 rounded"
									/>
									<div>
										<p className="font-medium text-sm">Insert as Reference</p>
										<p className="text-xs text-gray-500">
											Link to the original block for automatic updates
										</p>
									</div>
								</label>
								<label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
									<input
										type="checkbox"
										checked={insertOptions.includeMetadata}
										onChange={(e) =>
											setInsertOptions((prev) => ({
												...prev,
												includeMetadata: e.target.checked,
											}))
										}
										className="mt-0.5 rounded"
									/>
									<div>
										<p className="font-medium text-sm">Include Metadata</p>
										<p className="text-xs text-gray-500">
											Add source information and timestamps
										</p>
									</div>
								</label>
							</div>
						</div>

						{/* Preview Actions */}
						<div className="p-4 border-t bg-gray-50 flex items-center justify-between">
							<Button variant="ghost" onClick={() => setStep("search")}>
								Back to Search
							</Button>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									onClick={() => setStep("customize")}
								>
									<Edit className="w-4 h-4 mr-1" />
									Edit Before Insert
								</Button>
								{onAIAdapt && documentContext && (
									<Button
										variant="outline"
										onClick={handleAdaptContent}
										disabled={isAdapting}
									>
										{isAdapting ? (
											<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
										) : (
											<Sparkles className="w-4 h-4 mr-1" />
										)}
										AI Adapt
									</Button>
								)}
								<Button variant="primary" onClick={handleInsert}>
									<Plus className="w-4 h-4 mr-1" />
									Insert
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Step: Customize */}
				{step === "customize" && selectedBlock && (
					<div className="flex-1 overflow-hidden flex flex-col">
						<div className="flex-1 overflow-y-auto p-4">
							<div className="mb-3 flex items-center justify-between">
								<h4 className="text-sm font-medium text-gray-700">Edit Content</h4>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setCustomContent(selectedBlock.content)}
								>
									Reset to Original
								</Button>
							</div>
							<textarea
								value={customContent}
								onChange={(e) => setCustomContent(e.target.value)}
								className="w-full h-64 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
							/>

							{/* Character Count */}
							<div className="mt-2 text-xs text-gray-500 text-right">
								{customContent.length} characters •{" "}
								{customContent.split(/\s+/).filter(Boolean).length} words
							</div>
						</div>

						{/* Customize Actions */}
						<div className="p-4 border-t bg-gray-50 flex items-center justify-between">
							<Button variant="ghost" onClick={() => setStep("preview")}>
								Back to Preview
							</Button>
							<div className="flex items-center gap-2">
								{onAIAdapt && documentContext && (
									<Button
										variant="outline"
										onClick={handleAdaptContent}
										disabled={isAdapting}
									>
										{isAdapting ? (
											<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
										) : (
											<Sparkles className="w-4 h-4 mr-1" />
										)}
										AI Adapt
									</Button>
								)}
								<Button variant="primary" onClick={handleInsert}>
									<Plus className="w-4 h-4 mr-1" />
									Insert Content
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface ContentBlockRowProps {
	block: ContentBlock;
	onSelect: () => void;
}

function ContentBlockRow({ block, onSelect }: ContentBlockRowProps) {
	return (
		<button
			onClick={onSelect}
			className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left flex items-start gap-3 transition-colors"
		>
			<div className="p-2 bg-gray-100 rounded">
				<FileText className="w-5 h-5 text-gray-600" />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-1">
					<span className="font-medium text-sm truncate">{block.title}</span>
					<FreshnessBadge status={block.freshnessStatus} size="sm" />
				</div>
				<p className="text-xs text-gray-600 line-clamp-2 mb-1">{block.content}</p>
				<div className="flex items-center gap-3 text-xs text-gray-500">
					<span className="flex items-center gap-1">
						<Folder className="w-3 h-3" />
						{block.category}
					</span>
					{block.winRate !== undefined && (
						<span className="flex items-center gap-1">
							<TrendingUp className="w-3 h-3" />
							{Math.round(block.winRate * 100)}%
						</span>
					)}
					<span className="flex items-center gap-1">
						<Eye className="w-3 h-3" />
						{block.usageCount} uses
					</span>
				</div>
			</div>
			<ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
		</button>
	);
}
