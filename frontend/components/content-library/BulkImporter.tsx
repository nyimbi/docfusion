/**
 * BulkImporter Component
 *
 * Import content blocks from proposals, documents, or external sources
 * with preview and categorization.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Upload,
	FileText,
	Folder,
	Check,
	X,
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	Sparkles,
	RefreshCw,
	CheckCircle,
	Tag,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ImportableContent {
	id: string;
	title: string;
	content: string;
	sourceType: "proposal" | "document" | "template";
	sourceName: string;
	section?: string;
	suggestedCategory?: string;
	suggestedTags?: string[];
	wordCount: number;
	selected: boolean;
	status: "pending" | "importing" | "imported" | "error";
	error?: string;
}

interface ImportSource {
	id: string;
	name: string;
	type: "proposal" | "document" | "template";
	itemCount: number;
	lastModified: string;
}

interface BulkImporterProps {
	sources: ImportSource[];
	onLoadSource: (sourceId: string) => Promise<ImportableContent[]>;
	onImport: (items: ImportableContent[]) => Promise<{ success: number; failed: number }>;
	onAutoCategorize?: (items: ImportableContent[]) => Promise<ImportableContent[]>;
	categories: { value: string; label: string }[];
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BulkImporter({
	sources,
	onLoadSource,
	onImport,
	onAutoCategorize,
	categories,
	className,
}: BulkImporterProps) {
	const [step, setStep] = useState<"source" | "preview" | "importing" | "complete">("source");
	const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
	const [items, setItems] = useState<ImportableContent[]>([]);
	const [loading, setLoading] = useState(false);
	const [autoCategorizing, setAutoCategorizing] = useState(false);
	const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

	const handleSelectSource = async (source: ImportSource) => {
		setSelectedSource(source);
		setLoading(true);
		try {
			const loadedItems = await onLoadSource(source.id);
			setItems(loadedItems.map((item) => ({ ...item, selected: true, status: "pending" as const })));
			setStep("preview");
		} finally {
			setLoading(false);
		}
	};

	const handleAutoCategorize = async () => {
		if (!onAutoCategorize) return;
		setAutoCategorizing(true);
		try {
			const categorizedItems = await onAutoCategorize(items);
			setItems(categorizedItems);
		} finally {
			setAutoCategorizing(false);
		}
	};

	const handleImport = async () => {
		const selectedItems = items.filter((item) => item.selected);
		if (selectedItems.length === 0) return;

		setStep("importing");

		// Mark all as importing
		setItems((prev) =>
			prev.map((item) =>
				item.selected ? { ...item, status: "importing" as const } : item
			)
		);

		try {
			const result = await onImport(selectedItems);
			setImportResult(result);

			// Mark items based on result (simplified - in reality would need per-item status)
			setItems((prev) =>
				prev.map((item) =>
					item.selected ? { ...item, status: "imported" as const } : item
				)
			);

			setStep("complete");
		} catch (error) {
			// Mark as error
			setItems((prev) =>
				prev.map((item) =>
					item.selected && item.status === "importing"
						? { ...item, status: "error" as const, error: "Import failed" }
						: item
				)
			);
		}
	};

	const toggleSelectAll = () => {
		const allSelected = items.every((item) => item.selected);
		setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
	};

	const toggleSelect = (id: string) => {
		setItems((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, selected: !item.selected } : item
			)
		);
	};

	const toggleExpand = (id: string) => {
		setExpandedItems((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const updateItem = (id: string, updates: Partial<ImportableContent>) => {
		setItems((prev) =>
			prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
		);
	};

	const selectedCount = items.filter((item) => item.selected).length;
	const totalWordCount = items
		.filter((item) => item.selected)
		.reduce((sum, item) => sum + item.wordCount, 0);

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="p-4 border-b">
				<div className="flex items-center gap-3">
					<Upload className="w-6 h-6 text-blue-600" />
					<div>
						<h2 className="text-lg font-semibold">Bulk Import</h2>
						<p className="text-sm text-gray-500">
							{step === "source" && "Select a source to import content from"}
							{step === "preview" && `${selectedCount} items selected from ${selectedSource?.name}`}
							{step === "importing" && "Importing content..."}
							{step === "complete" && "Import complete"}
						</p>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Step: Select Source */}
				{step === "source" && (
					<div className="space-y-3">
						{sources.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								<Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
								<p>No sources available for import</p>
							</div>
						) : (
							sources.map((source) => (
								<button
									key={source.id}
									onClick={() => handleSelectSource(source)}
									disabled={loading}
									className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left flex items-center gap-4 transition-colors"
								>
									<div className="p-2 bg-gray-100 rounded-lg">
										{source.type === "proposal" && <FileText className="w-6 h-6 text-blue-600" />}
										{source.type === "document" && <FileText className="w-6 h-6 text-green-600" />}
										{source.type === "template" && <FileText className="w-6 h-6 text-purple-600" />}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium">{source.name}</div>
										<div className="text-sm text-gray-500">
											{source.itemCount} items • Last modified{" "}
											{new Date(source.lastModified).toLocaleDateString()}
										</div>
									</div>
									<ChevronRight className="w-5 h-5 text-gray-400" />
								</button>
							))
						)}
						{loading && (
							<div className="p-8 text-center">
								<RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-600" />
								<p className="text-gray-500">Loading content...</p>
							</div>
						)}
					</div>
				)}

				{/* Step: Preview */}
				{step === "preview" && (
					<div className="space-y-4">
						{/* Actions */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={items.every((item) => item.selected)}
									onChange={toggleSelectAll}
									className="rounded"
								/>
								<span className="text-sm">
									{selectedCount} of {items.length} selected
								</span>
								<span className="text-xs text-gray-500">
									({totalWordCount.toLocaleString()} words)
								</span>
							</div>
							{onAutoCategorize && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleAutoCategorize}
									disabled={autoCategorizing}
								>
									{autoCategorizing ? (
										<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
									) : (
										<Sparkles className="w-4 h-4 mr-1" />
									)}
									Auto-Categorize
								</Button>
							)}
						</div>

						{/* Items List */}
						<div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
							{items.map((item) => {
								const isExpanded = expandedItems.has(item.id);

								return (
									<div key={item.id}>
										<div className="p-3 flex items-start gap-3">
											<input
												type="checkbox"
												checked={item.selected}
												onChange={() => toggleSelect(item.id)}
												className="mt-1 rounded"
											/>
											<button
												onClick={() => toggleExpand(item.id)}
												className="mt-1"
											>
												{isExpanded ? (
													<ChevronDown className="w-4 h-4 text-gray-400" />
												) : (
													<ChevronRight className="w-4 h-4 text-gray-400" />
												)}
											</button>
											<div className="flex-1 min-w-0">
												<div className="font-medium text-sm">{item.title}</div>
												<div className="text-xs text-gray-500">
													{item.section && `${item.section} • `}
													{item.wordCount} words
												</div>
												{!isExpanded && (
													<p className="text-xs text-gray-600 line-clamp-1 mt-1">
														{item.content}
													</p>
												)}
											</div>
											<select
												value={item.suggestedCategory ?? ""}
												onChange={(e) =>
													updateItem(item.id, { suggestedCategory: e.target.value })
												}
												className="px-2 py-1 border rounded text-xs"
											>
												<option value="">Select category</option>
												{categories.map((cat) => (
													<option key={cat.value} value={cat.value}>
														{cat.label}
													</option>
												))}
											</select>
										</div>

										{isExpanded && (
											<div className="px-10 pb-3 space-y-2">
												<div className="p-2 bg-gray-50 rounded text-sm max-h-32 overflow-y-auto">
													{item.content}
												</div>
												{item.suggestedTags && item.suggestedTags.length > 0 && (
													<div className="flex items-center gap-2">
														<Tag className="w-4 h-4 text-gray-400" />
														<div className="flex flex-wrap gap-1">
															{item.suggestedTags.map((tag) => (
																<span
																	key={tag}
																	className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
																>
																	{tag}
																</span>
															))}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Step: Importing */}
				{step === "importing" && (
					<div className="p-8 text-center">
						<RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-600" />
						<h3 className="font-medium mb-2">Importing Content</h3>
						<p className="text-sm text-gray-500">
							Please wait while we import your content...
						</p>
						<div className="mt-4 max-h-48 overflow-y-auto text-left">
							{items
								.filter((item) => item.selected)
								.map((item) => (
									<div
										key={item.id}
										className="flex items-center gap-2 py-1 text-sm"
									>
										{item.status === "importing" && (
											<RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
										)}
										{item.status === "imported" && (
											<CheckCircle className="w-4 h-4 text-green-600" />
										)}
										{item.status === "error" && (
											<AlertTriangle className="w-4 h-4 text-red-600" />
										)}
										<span className="truncate">{item.title}</span>
									</div>
								))}
						</div>
					</div>
				)}

				{/* Step: Complete */}
				{step === "complete" && importResult && (
					<div className="p-8 text-center">
						<CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
						<h3 className="font-medium mb-2">Import Complete</h3>
						<div className="flex items-center justify-center gap-6 text-sm">
							<span className="text-green-600">
								<Check className="w-4 h-4 inline mr-1" />
								{importResult.success} imported
							</span>
							{importResult.failed > 0 && (
								<span className="text-red-600">
									<X className="w-4 h-4 inline mr-1" />
									{importResult.failed} failed
								</span>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between p-4 border-t bg-gray-50">
				{step !== "source" && step !== "complete" && (
					<Button
						variant="outline"
						onClick={() => {
							setStep("source");
							setSelectedSource(null);
							setItems([]);
						}}
					>
						Back
					</Button>
				)}
				{step === "source" && <div />}
				{step === "preview" && (
					<Button
						variant="primary"
						onClick={handleImport}
						disabled={selectedCount === 0}
					>
						Import {selectedCount} Items
					</Button>
				)}
				{step === "complete" && (
					<Button
						variant="primary"
						onClick={() => {
							setStep("source");
							setSelectedSource(null);
							setItems([]);
							setImportResult(null);
						}}
					>
						Import More
					</Button>
				)}
			</div>
		</div>
	);
}
