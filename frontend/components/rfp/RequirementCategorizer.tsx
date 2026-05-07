/**
 * RequirementCategorizer Component
 *
 * Batch categorization tool for RFP requirements with AI assistance.
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Tag,
	Sparkles,
	Check,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Filter,
	Search,
	RefreshCw,
	Save,
	AlertCircle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Requirement {
	id: string;
	requirementNumber: string;
	requirementText: string;
	category: string;
	subcategory: string | null;
	priority: string;
}

interface CategoryOption {
	value: string;
	label: string;
	subcategories?: { value: string; label: string }[];
}

interface RequirementCategorizerProps {
	requirements: Requirement[];
	categories: CategoryOption[];
	priorities: { value: string; label: string }[];
	onCategorizeBatch: (updates: { id: string; category: string; subcategory?: string; priority?: string }[]) => Promise<void>;
	onAutoCategorizeBatch: (requirementIds: string[]) => Promise<{ id: string; category: string; subcategory?: string; confidence: number }[]>;
	isLoading?: boolean;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function RequirementCategorizer({
	requirements,
	categories,
	priorities,
	onCategorizeBatch,
	onAutoCategorizeBatch,
	isLoading = false,
	className,
}: RequirementCategorizerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterCategory, setFilterCategory] = useState<string>("all");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [pendingChanges, setPendingChanges] = useState<Map<string, { category?: string; subcategory?: string; priority?: string }>>(new Map());
	const [autoCategorizing, setAutoCategorizing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [suggestions, setSuggestions] = useState<Map<string, { category: string; subcategory?: string; confidence: number }>>(new Map());
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(categories.map((c) => c.value)));

	// Filter requirements
	const filteredRequirements = useMemo(() => {
		return requirements.filter((req) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				if (
					!req.requirementNumber.toLowerCase().includes(query) &&
					!req.requirementText.toLowerCase().includes(query)
				) {
					return false;
				}
			}

			// Category filter
			if (filterCategory !== "all" && req.category !== filterCategory) {
				return false;
			}

			return true;
		});
	}, [requirements, searchQuery, filterCategory]);

	// Group requirements by category
	const groupedRequirements = useMemo(() => {
		const groups = new Map<string, Requirement[]>();
		for (const req of filteredRequirements) {
			const effectiveCategory = pendingChanges.get(req.id)?.category ?? req.category;
			if (!groups.has(effectiveCategory)) {
				groups.set(effectiveCategory, []);
			}
			groups.get(effectiveCategory)!.push(req);
		}
		return groups;
	}, [filteredRequirements, pendingChanges]);

	const toggleSelectAll = () => {
		if (selectedIds.size === filteredRequirements.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredRequirements.map((r) => r.id)));
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleGroup = (category: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	};

	const updatePendingChange = (id: string, field: "category" | "subcategory" | "priority", value: string) => {
		setPendingChanges((prev) => {
			const next = new Map(prev);
			const current = next.get(id) ?? {};
			next.set(id, { ...current, [field]: value });
			return next;
		});
	};

	const applyToSelected = (field: "category" | "subcategory" | "priority", value: string) => {
		setPendingChanges((prev) => {
			const next = new Map(prev);
			for (const id of selectedIds) {
				const current = next.get(id) ?? {};
				next.set(id, { ...current, [field]: value });
			}
			return next;
		});
	};

	const handleAutoCategorize = useCallback(async () => {
		const idsToProcess = selectedIds.size > 0
			? Array.from(selectedIds)
			: filteredRequirements.map((r) => r.id);

		if (idsToProcess.length === 0) return;

		setAutoCategorizing(true);
		try {
			const results = await onAutoCategorizeBatch(idsToProcess);

			// Update suggestions
			const newSuggestions = new Map(suggestions);
			for (const result of results) {
				newSuggestions.set(result.id, {
					category: result.category,
					subcategory: result.subcategory,
					confidence: result.confidence,
				});
			}
			setSuggestions(newSuggestions);

			// Auto-apply high-confidence suggestions
			const newChanges = new Map(pendingChanges);
			for (const result of results) {
				if (result.confidence >= 0.8) {
					newChanges.set(result.id, {
						category: result.category,
						subcategory: result.subcategory,
					});
				}
			}
			setPendingChanges(newChanges);
		} finally {
			setAutoCategorizing(false);
		}
	}, [selectedIds, filteredRequirements, onAutoCategorizeBatch, suggestions, pendingChanges]);

	const handleSave = async () => {
		if (pendingChanges.size === 0) return;

		setSaving(true);
		try {
			const updates = Array.from(pendingChanges.entries()).map(([id, changes]) => ({
				id,
				category: changes.category ?? requirements.find((r) => r.id === id)!.category,
				subcategory: changes.subcategory,
				priority: changes.priority,
			}));

			await onCategorizeBatch(updates);
			setPendingChanges(new Map());
			setSuggestions(new Map());
		} finally {
			setSaving(false);
		}
	};

	const applySuggestion = (id: string) => {
		const suggestion = suggestions.get(id);
		if (!suggestion) return;

		setPendingChanges((prev) => {
			const next = new Map(prev);
			next.set(id, {
				category: suggestion.category,
				subcategory: suggestion.subcategory,
			});
			return next;
		});
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<Tag className="w-6 h-6 text-blue-600" />
						<div>
							<h2 className="text-lg font-semibold">Requirement Categorizer</h2>
							<p className="text-sm text-gray-500">
								{filteredRequirements.length} requirements •{" "}
								{pendingChanges.size} pending changes
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={handleAutoCategorize}
							disabled={autoCategorizing || isLoading}
						>
							{autoCategorizing ? (
								<RefreshCw className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<Sparkles className="w-4 h-4 mr-2" />
							)}
							Auto-Categorize{" "}
							{selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
						</Button>
						<Button
							variant="primary"
							onClick={handleSave}
							disabled={saving || pendingChanges.size === 0}
						>
							{saving ? (
								<RefreshCw className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<Save className="w-4 h-4 mr-2" />
							)}
							Save Changes ({pendingChanges.size})
						</Button>
					</div>
				</div>

				{/* Filters */}
				<div className="flex items-center gap-4">
					<div className="flex-1 relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search requirements..."
							className="pl-9"
						/>
					</div>
					<div className="flex items-center gap-2">
						<Filter className="w-4 h-4 text-gray-400" />
						<select
							value={filterCategory}
							onChange={(e) => setFilterCategory(e.target.value)}
							className="px-3 py-2 border rounded-md text-sm"
						>
							<option value="all">All Categories</option>
							{categories.map((cat) => (
								<option key={cat.value} value={cat.value}>
									{cat.label}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* Bulk Actions */}
			{selectedIds.size > 0 && (
				<div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<CheckCircle className="w-5 h-5 text-blue-600" />
							<span className="font-medium">{selectedIds.size} selected</span>
						</div>
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<span className="text-sm">Category:</span>
								<select
									onChange={(e) => applyToSelected("category", e.target.value)}
									className="px-2 py-1 border rounded text-sm"
									defaultValue=""
								 aria-label="Category:">
									<option value="" disabled>
										Apply to selected
									</option>
									{categories.map((cat) => (
										<option key={cat.value} value={cat.value}>
											{cat.label}
										</option>
									))}
								</select>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-sm">Priority:</span>
								<select
									onChange={(e) => applyToSelected("priority", e.target.value)}
									className="px-2 py-1 border rounded text-sm"
									defaultValue=""
								 aria-label="Priority:">
									<option value="" disabled>
										Apply to selected
									</option>
									{priorities.map((p) => (
										<option key={p.value} value={p.value}>
											{p.label}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Requirements by Category */}
			<div className="bg-white rounded-lg border">
				{/* Select All Header */}
				<div className="p-3 border-b bg-gray-50 flex items-center gap-3">
					<input
						type="checkbox"
						checked={selectedIds.size === filteredRequirements.length && filteredRequirements.length > 0}
						onChange={toggleSelectAll}
						className="rounded"
					/>
					<span className="text-sm font-medium">
						{selectedIds.size === filteredRequirements.length
							? "Deselect All"
							: "Select All"}
					</span>
				</div>

				{/* Category Groups */}
				{categories.map((category) => {
					const groupReqs = groupedRequirements.get(category.value) ?? [];
					if (groupReqs.length === 0 && filterCategory !== "all") return null;

					const isExpanded = expandedGroups.has(category.value);

					return (
						<div key={category.value} className="border-b last:border-b-0">
							<button
								onClick={() => toggleGroup(category.value)}
								className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
							>
								<div className="flex items-center gap-2">
									{isExpanded ? (
										<ChevronDown className="w-4 h-4" />
									) : (
										<ChevronRight className="w-4 h-4" />
									)}
									<Tag className="w-4 h-4 text-gray-400" />
									<span className="font-medium">{category.label}</span>
									<span className="text-sm text-gray-500">
										({groupReqs.length})
									</span>
								</div>
							</button>

							{isExpanded && groupReqs.length > 0 && (
								<div className="divide-y bg-gray-50">
									{groupReqs.map((req) => {
										const changes = pendingChanges.get(req.id);
										const suggestion = suggestions.get(req.id);
										const hasChanges = !!changes;

										return (
											<div
												key={req.id}
												className={cn(
													"px-4 py-3 flex items-start gap-3",
													selectedIds.has(req.id) && "bg-blue-50",
													hasChanges && "bg-yellow-50"
												)}
											>
												<input
													type="checkbox"
													checked={selectedIds.has(req.id)}
													onChange={() => toggleSelect(req.id)}
													className="mt-1 rounded"
												/>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<span className="font-mono text-sm font-medium">
															{req.requirementNumber}
														</span>
														{hasChanges && (
															<span className="text-xs text-yellow-600 flex items-center gap-1">
																<AlertCircle className="w-3 h-3" />
																Modified
															</span>
														)}
													</div>
													<p className="text-sm text-gray-700 line-clamp-2 mb-2">
														{req.requirementText}
													</p>

													{/* Category/Priority Selectors */}
													<div className="flex items-center gap-4">
														<select
															value={changes?.category ?? req.category}
															onChange={(e) =>
																updatePendingChange(req.id, "category", e.target.value)
															}
															className="px-2 py-1 border rounded text-sm"
														>
															{categories.map((cat) => (
																<option key={cat.value} value={cat.value}>
																	{cat.label}
																</option>
															))}
														</select>
														<select
															value={changes?.priority ?? req.priority}
															onChange={(e) =>
																updatePendingChange(req.id, "priority", e.target.value)
															}
															className="px-2 py-1 border rounded text-sm"
														>
															{priorities.map((p) => (
																<option key={p.value} value={p.value}>
																	{p.label}
																</option>
															))}
														</select>
													</div>

													{/* AI Suggestion */}
													{suggestion && !changes && (
														<div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
															<div className="flex items-center gap-2">
																<Sparkles className="w-4 h-4 text-purple-600" />
																<span className="text-sm">
																	Suggested:{" "}
																	<strong>
																		{categories.find((c) => c.value === suggestion.category)?.label}
																	</strong>
																</span>
																<span
																	className={cn(
																		"text-xs px-1.5 py-0.5 rounded",
																		suggestion.confidence >= 0.8
																			? "bg-green-100 text-green-700"
																			: "bg-yellow-100 text-yellow-700"
																	)}
																>
																	{Math.round(suggestion.confidence * 100)}%
																</span>
															</div>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => applySuggestion(req.id)}
															>
																<Check className="w-4 h-4 mr-1" />
																Apply
															</Button>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}

							{isExpanded && groupReqs.length === 0 && (
								<div className="p-4 text-center text-gray-500 text-sm bg-gray-50">
									No requirements in this category
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
