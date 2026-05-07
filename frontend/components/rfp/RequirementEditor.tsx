/**
 * RequirementEditor Component
 *
 * Provides full editing capabilities for RFP requirements including
 * text, categorization, priority, and compliance mapping.
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Save,
	X,
	AlertTriangle,
	Tag,
	ChevronDown,
	Link,
	HelpCircle,
	Sparkles,
	History,
	FileText,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Requirement {
	id: string;
	requirementNumber: string;
	title: string | null;
	requirementText: string;
	category: string;
	subcategory: string | null;
	priority: string;
	sourceSection: string | null;
	complianceStatus: string;
	pageNumber: number | null;
	suggestedApproach: string | null;
	evaluationWeight: number | null;
	ambiguityFlag: boolean;
	ambiguityReason: string | null;
	relatedRequirements: string[];
	manuallyEdited: boolean;
}

interface RequirementEditorProps {
	requirement: Requirement;
	onSave: (requirement: Requirement) => Promise<void>;
	onCancel: () => void;
	onGenerateSuggestion?: (requirementId: string) => Promise<string>;
	categories?: { value: string; label: string }[];
	priorities?: { value: string; label: string }[];
	complianceStatuses?: { value: string; label: string }[];
	availableRequirements?: { id: string; number: string }[];
	isLoading?: boolean;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CATEGORIES = [
	{ value: "technical", label: "Technical" },
	{ value: "management", label: "Management" },
	{ value: "past_performance", label: "Past Performance" },
	{ value: "cost", label: "Cost/Pricing" },
	{ value: "staffing", label: "Staffing" },
	{ value: "compliance", label: "Compliance" },
	{ value: "administrative", label: "Administrative" },
	{ value: "other", label: "Other" },
];

const DEFAULT_PRIORITIES = [
	{ value: "mandatory", label: "Mandatory" },
	{ value: "important", label: "Important" },
	{ value: "desirable", label: "Desirable" },
	{ value: "informational", label: "Informational" },
];

const DEFAULT_COMPLIANCE_STATUSES = [
	{ value: "not_addressed", label: "Not Addressed" },
	{ value: "pending", label: "Pending" },
	{ value: "partial", label: "Partial" },
	{ value: "addressed", label: "Addressed" },
	{ value: "compliant", label: "Compliant" },
	{ value: "non_compliant", label: "Non-Compliant" },
	{ value: "not_applicable", label: "N/A" },
];

// ============================================================================
// Component
// ============================================================================

export function RequirementEditor({
	requirement,
	onSave,
	onCancel,
	onGenerateSuggestion,
	categories = DEFAULT_CATEGORIES,
	priorities = DEFAULT_PRIORITIES,
	complianceStatuses = DEFAULT_COMPLIANCE_STATUSES,
	availableRequirements = [],
	isLoading = false,
	className,
}: RequirementEditorProps) {
	const [formData, setFormData] = useState<Requirement>(requirement);
	const [saving, setSaving] = useState(false);
	const [generatingSuggestion, setGeneratingSuggestion] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [showRelatedPicker, setShowRelatedPicker] = useState(false);
	const [activeTab, setActiveTab] = useState<"details" | "analysis" | "history">("details");

	// Track changes
	useEffect(() => {
		const hasChanges = JSON.stringify(formData) !== JSON.stringify(requirement);
		setHasChanges(hasChanges);
	}, [formData, requirement]);

	const updateField = useCallback(<K extends keyof Requirement>(field: K, value: Requirement[K]) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
			manuallyEdited: true,
		}));
	}, []);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave(formData);
		} finally {
			setSaving(false);
		}
	};

	const handleGenerateSuggestion = async () => {
		if (!onGenerateSuggestion) return;
		setGeneratingSuggestion(true);
		try {
			const suggestion = await onGenerateSuggestion(requirement.id);
			updateField("suggestedApproach", suggestion);
		} finally {
			setGeneratingSuggestion(false);
		}
	};

	const addRelatedRequirement = (id: string) => {
		if (!formData.relatedRequirements.includes(id)) {
			updateField("relatedRequirements", [...formData.relatedRequirements, id]);
		}
		setShowRelatedPicker(false);
	};

	const removeRelatedRequirement = (id: string) => {
		updateField(
			"relatedRequirements",
			formData.relatedRequirements.filter((r) => r !== id)
		);
	};

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-3">
					<FileText className="w-5 h-5 text-blue-600" />
					<div>
						<h2 className="font-semibold">Edit Requirement</h2>
						<p className="text-sm text-gray-500">
							{requirement.requirementNumber}
							{requirement.manuallyEdited && (
								<span className="ml-2 text-xs text-orange-600">(manually edited)</span>
							)}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex border-b">
				{[
					{ id: "details", label: "Details" },
					{ id: "analysis", label: "AI Analysis" },
					{ id: "history", label: "History" },
				].map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id as typeof activeTab)}
						className={cn(
							"px-4 py-2 text-sm font-medium transition-colors",
							activeTab === tab.id
								? "border-b-2 border-blue-600 text-blue-600"
								: "text-gray-500 hover:text-gray-700"
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Content */}
			<div className="p-4 space-y-4">
				{activeTab === "details" && (
					<>
						{/* Requirement Number and Title */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="block text-sm font-medium mb-1">
									Requirement Number
								</span>
								<Input
									value={formData.requirementNumber}
									onChange={(e) => updateField("requirementNumber", e.target.value)}
								 aria-label="Requirement Number"/>
							</div>
							<div>
								<span className="block text-sm font-medium mb-1">Title</span>
								<Input
									value={formData.title ?? ""}
									onChange={(e) => updateField("title", e.target.value || null)}
									placeholder="Optional title..."
								 aria-label="Title"/>
							</div>
						</div>

						{/* Requirement Text */}
						<div>
							<span className="block text-sm font-medium mb-1">
								Requirement Text
							</span>
							<textarea
								value={formData.requirementText}
								onChange={(e) => updateField("requirementText", e.target.value)}
								rows={5}
								className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							 aria-label="Requirement Text"/>
						</div>

						{/* Category and Subcategory */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="block text-sm font-medium mb-1">Category</span>
								<select
									value={formData.category}
									onChange={(e) => updateField("category", e.target.value)}
									className="w-full px-3 py-2 border rounded-md"
								 aria-label="Category">
									{categories.map((cat) => (
										<option key={cat.value} value={cat.value}>
											{cat.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<span className="block text-sm font-medium mb-1">
									Subcategory
								</span>
								<Input
									value={formData.subcategory ?? ""}
									onChange={(e) =>
										updateField("subcategory", e.target.value || null)
									}
									placeholder="Optional subcategory..."
								 aria-label="Subcategory"/>
							</div>
						</div>

						{/* Priority and Compliance Status */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="block text-sm font-medium mb-1">Priority</span>
								<select
									value={formData.priority}
									onChange={(e) => updateField("priority", e.target.value)}
									className="w-full px-3 py-2 border rounded-md"
								 aria-label="Priority">
									{priorities.map((p) => (
										<option key={p.value} value={p.value}>
											{p.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<span className="block text-sm font-medium mb-1">
									Compliance Status
								</span>
								<select
									value={formData.complianceStatus}
									onChange={(e) => updateField("complianceStatus", e.target.value)}
									className="w-full px-3 py-2 border rounded-md"
								 aria-label="Compliance Status">
									{complianceStatuses.map((s) => (
										<option key={s.value} value={s.value}>
											{s.label}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* Source Section and Page Number */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="block text-sm font-medium mb-1">
									Source Section
								</span>
								<Input
									value={formData.sourceSection ?? ""}
									onChange={(e) =>
										updateField("sourceSection", e.target.value || null)
									}
									placeholder="e.g., Section L.5.2.1"
								 aria-label="Source Section"/>
							</div>
							<div>
								<span className="block text-sm font-medium mb-1">
									Page Number
								</span>
								<Input
									type="number"
									value={formData.pageNumber ?? ""}
									onChange={(e) =>
										updateField(
											"pageNumber",
											e.target.value ? parseInt(e.target.value) : null
										)
									}
									placeholder="Page #"
								 aria-label="Page Number"/>
							</div>
						</div>

						{/* Evaluation Weight */}
						<div>
							<span className="block text-sm font-medium mb-1">
								Evaluation Weight (%)
							</span>
							<Input
								type="number"
								min="0"
								max="100"
								value={formData.evaluationWeight ?? ""}
								onChange={(e) =>
									updateField(
										"evaluationWeight",
										e.target.value ? parseFloat(e.target.value) : null
									)
								}
								placeholder="Weight if known..."
							 aria-label="Evaluation Weight (%)"/>
						</div>

						{/* Related Requirements */}
						<div>
							<span className="block text-sm font-medium mb-1 flex items-center gap-2">
								<Link className="w-4 h-4" />
								Related Requirements
							</span>
							<div className="flex flex-wrap gap-2 mb-2">
								{formData.relatedRequirements.map((relId) => {
									const rel = availableRequirements.find((r) => r.id === relId);
									return (
										<span
											key={relId}
											className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
										>
											{rel?.number ?? relId}
											<button
												onClick={() => removeRelatedRequirement(relId)}
												className="hover:text-blue-900"
											>
												<X className="w-3 h-3" />
											</button>
										</span>
									);
								})}
							</div>
							<div className="relative">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowRelatedPicker(!showRelatedPicker)}
								>
									<Tag className="w-4 h-4 mr-1" />
									Add Related
									<ChevronDown className="w-4 h-4 ml-1" />
								</Button>
								{showRelatedPicker && (
									<div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
										{availableRequirements
											.filter(
												(r) =>
													r.id !== requirement.id &&
													!formData.relatedRequirements.includes(r.id)
											)
											.map((r) => (
												<button
													key={r.id}
													onClick={() => addRelatedRequirement(r.id)}
													className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
												>
													{r.number}
												</button>
											))}
									</div>
								)}
							</div>
						</div>
					</>
				)}

				{activeTab === "analysis" && (
					<>
						{/* Ambiguity Flag */}
						<div className="p-4 border rounded-lg bg-gray-50">
							<div className="flex items-center gap-3 mb-2">
								<AlertTriangle
									className={cn(
										"w-5 h-5",
										formData.ambiguityFlag
											? "text-yellow-600"
											: "text-gray-400"
									)}
								/>
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={formData.ambiguityFlag}
										onChange={(e) =>
											updateField("ambiguityFlag", e.target.checked)
										}
										className="rounded"
									/>
									<span className="font-medium">Ambiguous Requirement</span>
								</label>
							</div>
							{formData.ambiguityFlag && (
								<div className="mt-2">
									<span className="block text-sm font-medium mb-1">
										Ambiguity Reason
									</span>
									<textarea
										value={formData.ambiguityReason ?? ""}
										onChange={(e) =>
											updateField("ambiguityReason", e.target.value || null)
										}
										rows={2}
										className="w-full px-3 py-2 border rounded-md text-sm"
										placeholder="Describe why this requirement is ambiguous..."
									 aria-label="Ambiguity Reason"/>
								</div>
							)}
						</div>

						{/* Suggested Approach */}
						<div>
							<div className="flex items-center justify-between mb-1">
								<span className="block text-sm font-medium flex items-center gap-2">
									<Sparkles className="w-4 h-4 text-purple-600" />
									Suggested Approach
								</span>
								{onGenerateSuggestion && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleGenerateSuggestion}
										disabled={generatingSuggestion}
									>
										{generatingSuggestion ? (
											<>
												<span className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
												Generating...
											</>
										) : (
											<>
												<Sparkles className="w-4 h-4 mr-1" />
												Generate with AI
											</>
										)}
									</Button>
								)}
							</div>
							<textarea
								value={formData.suggestedApproach ?? ""}
								onChange={(e) =>
									updateField("suggestedApproach", e.target.value || null)
								}
								rows={4}
								className="w-full px-3 py-2 border rounded-md"
								placeholder="AI-generated or manual suggested approach..."
							/>
						</div>
					</>
				)}

				{activeTab === "history" && (
					<div className="p-8 text-center text-gray-500">
						<History className="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p>Version history not available in this view.</p>
						<p className="text-sm">
							Check the document history for detailed change tracking.
						</p>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between p-4 border-t bg-gray-50">
				<div className="text-sm text-gray-500">
					{hasChanges && (
						<span className="flex items-center gap-1 text-orange-600">
							<HelpCircle className="w-4 h-4" />
							Unsaved changes
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={onCancel} disabled={saving}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleSave}
						disabled={saving || !hasChanges}
					>
						{saving ? (
							<>
								<span className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-1" />
								Save Changes
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
