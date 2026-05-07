/**
 * ContentBlockEditor Component
 *
 * Rich text editor for creating and editing content blocks
 * with tagging, categorization, and metadata management.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Save,
	X,
	Tag,
	Folder,
	Plus,
	Sparkles,
	Eye,
	Edit2,
	Clock,
	CheckCircle,
	AlertTriangle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ContentBlock {
	id?: string;
	title: string;
	content: string;
	category: string;
	subcategory?: string;
	contentType: string;
	tags: string[];
	status: "draft" | "pending_approval" | "approved" | "archived";
	description?: string;
	sourceType?: string;
	qualityScore?: number;
}

interface ContentBlockEditorProps {
	block?: Partial<ContentBlock>;
	onSave: (block: ContentBlock) => Promise<void>;
	onCancel: () => void;
	onAutoTag?: (content: string) => Promise<string[]>;
	categories: { value: string; label: string; subcategories?: { value: string; label: string }[] }[];
	contentTypes: { value: string; label: string }[];
	availableTags?: string[];
	isLoading?: boolean;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ContentBlockEditor({
	block,
	onSave,
	onCancel,
	onAutoTag,
	categories,
	contentTypes,
	availableTags = [],
	isLoading = false,
	className,
}: ContentBlockEditorProps) {
	const [formData, setFormData] = useState<ContentBlock>({
		title: block?.title ?? "",
		content: block?.content ?? "",
		category: block?.category ?? categories[0]?.value ?? "",
		subcategory: block?.subcategory,
		contentType: block?.contentType ?? contentTypes[0]?.value ?? "",
		tags: block?.tags ?? [],
		status: block?.status ?? "draft",
		description: block?.description,
		sourceType: block?.sourceType,
		qualityScore: block?.qualityScore,
	});
	const [saving, setSaving] = useState(false);
	const [autoTagging, setAutoTagging] = useState(false);
	const [newTag, setNewTag] = useState("");
	const [mode, setMode] = useState<"edit" | "preview">("edit");
	const [errors, setErrors] = useState<Record<string, string>>({});

	const isNewBlock = !block?.id;

	const updateField = useCallback(<K extends keyof ContentBlock>(field: K, value: ContentBlock[K]) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear error when field is updated
		if (errors[field]) {
			setErrors((prev) => {
				const next = { ...prev };
				delete next[field];
				return next;
			});
		}
	}, [errors]);

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		if (!formData.title.trim()) {
			newErrors.title = "Title is required";
		}
		if (!formData.content.trim()) {
			newErrors.content = "Content is required";
		}
		if (!formData.category) {
			newErrors.category = "Category is required";
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSave = async () => {
		if (!validate()) return;
		setSaving(true);
		try {
			await onSave(formData);
		} finally {
			setSaving(false);
		}
	};

	const handleAutoTag = async () => {
		if (!onAutoTag || !formData.content.trim()) return;
		setAutoTagging(true);
		try {
			const suggestedTags = await onAutoTag(formData.content);
			updateField("tags", [...new Set([...formData.tags, ...suggestedTags])]);
		} finally {
			setAutoTagging(false);
		}
	};

	const addTag = () => {
		if (!newTag.trim()) return;
		if (!formData.tags.includes(newTag.trim())) {
			updateField("tags", [...formData.tags, newTag.trim()]);
		}
		setNewTag("");
	};

	const removeTag = (tag: string) => {
		updateField("tags", formData.tags.filter((t) => t !== tag));
	};

	const selectedCategory = categories.find((c) => c.value === formData.category);

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-3">
					<Edit2 className="w-5 h-5 text-blue-600" />
					<h2 className="font-semibold">
						{isNewBlock ? "Create Content Block" : "Edit Content Block"}
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex rounded-md border overflow-hidden">
						<button
							onClick={() => setMode("edit")}
							className={cn(
								"px-3 py-1 text-sm",
								mode === "edit" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-50"
							)}
						>
							<Edit2 className="w-4 h-4" />
						</button>
						<button
							onClick={() => setMode("preview")}
							className={cn(
								"px-3 py-1 text-sm",
								mode === "preview" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-50"
							)}
						>
							<Eye className="w-4 h-4" />
						</button>
					</div>
					<Button variant="ghost" size="sm" onClick={onCancel}>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="p-4 space-y-4">
				{mode === "edit" ? (
					<>
						{/* Title */}
						<div>
							<span className="block text-sm font-medium mb-1">
								Title <span className="text-red-500">*</span>
							</span>
							<Input
								value={formData.title}
								onChange={(e) => updateField("title", e.target.value)}
								placeholder="Enter content block title..."
								className={cn(errors.title && "border-red-500")}
							 aria-label="Title"/>
							{errors.title && (
								<p className="text-xs text-red-500 mt-1">{errors.title}</p>
							)}
						</div>

						{/* Description */}
						<div>
							<span className="block text-sm font-medium mb-1">Description</span>
							<Input
								value={formData.description ?? ""}
								onChange={(e) => updateField("description", e.target.value || undefined)}
								placeholder="Brief description of this content..."
							 aria-label="Description"/>
						</div>

						{/* Content */}
						<div>
							<span className="block text-sm font-medium mb-1">
								Content <span className="text-red-500">*</span>
							</span>
							<textarea
								value={formData.content}
								onChange={(e) => updateField("content", e.target.value)}
								rows={10}
								placeholder="Enter your content here..."
								className={cn(
									"w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm",
									errors.content && "border-red-500"
								)}
							 aria-label="Content"/>
							{errors.content && (
								<p className="text-xs text-red-500 mt-1">{errors.content}</p>
							)}
							<div className="flex items-center justify-between mt-1">
								<span className="text-xs text-gray-500">
									{formData.content.split(/\s+/).filter(Boolean).length} words
								</span>
							</div>
						</div>

						{/* Category and Type */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="block text-sm font-medium mb-1">
									<Folder className="w-4 h-4 inline mr-1" />
									Category <span className="text-red-500">*</span>
								</span>
								<select
									value={formData.category}
									onChange={(e) => {
										updateField("category", e.target.value);
										updateField("subcategory", undefined);
									}}
									className={cn(
										"w-full px-3 py-2 border rounded-md",
										errors.category && "border-red-500"
									)}
								 aria-label="Category">
									{categories.map((cat) => (
										<option key={cat.value} value={cat.value}>
											{cat.label}
										</option>
									))}
								</select>
							</div>
							{selectedCategory?.subcategories && (
								<div>
									<span className="block text-sm font-medium mb-1">
										Subcategory
									</span>
									<select
										value={formData.subcategory ?? ""}
										onChange={(e) => updateField("subcategory", e.target.value || undefined)}
										className="w-full px-3 py-2 border rounded-md"
									 aria-label="Subcategory">
										<option value="">None</option>
										{selectedCategory.subcategories.map((sub) => (
											<option key={sub.value} value={sub.value}>
												{sub.label}
											</option>
										))}
									</select>
								</div>
							)}
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="block text-sm font-medium mb-1">
									Content Type
								</span>
								<select
									value={formData.contentType}
									onChange={(e) => updateField("contentType", e.target.value)}
									className="w-full px-3 py-2 border rounded-md"
								 aria-label="Content Type">
									{contentTypes.map((type) => (
										<option key={type.value} value={type.value}>
											{type.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<span className="block text-sm font-medium mb-1">Status</span>
								<select
									value={formData.status}
									onChange={(e) => updateField("status", e.target.value as ContentBlock["status"])}
									className="w-full px-3 py-2 border rounded-md"
								 aria-label="Status">
									<option value="draft">Draft</option>
									<option value="pending_approval">Pending Approval</option>
									<option value="approved">Approved</option>
									<option value="archived">Archived</option>
								</select>
							</div>
						</div>

						{/* Tags */}
						<div>
							<div className="flex items-center justify-between mb-1">
								<span className="block text-sm font-medium">
									<Tag className="w-4 h-4 inline mr-1" />
									Tags
								</span>
								{onAutoTag && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleAutoTag}
										disabled={autoTagging || !formData.content.trim()}
									>
										{autoTagging ? (
											<>
												<span className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
												Analyzing...
											</>
										) : (
											<>
												<Sparkles className="w-4 h-4 mr-1" />
												Auto-Tag
											</>
										)}
									</Button>
								)}
							</div>
							<div className="flex flex-wrap gap-2 mb-2">
								{formData.tags.map((tag) => (
									<span
										key={tag}
										className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
									>
										{tag}
										<button
											onClick={() => removeTag(tag)}
											className="hover:text-blue-900"
										>
											<X className="w-3 h-3" />
										</button>
									</span>
								))}
							</div>
							<div className="flex items-center gap-2">
								<Input
									value={newTag}
									onChange={(e) => setNewTag(e.target.value)}
									placeholder="Add a tag..."
									onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
									list="available-tags"
									className="flex-1"
								/>
								<datalist id="available-tags">
									{availableTags
										.filter((t) => !formData.tags.includes(t))
										.map((tag) => (
											<option key={tag} value={tag} />
										))}
								</datalist>
								<Button variant="outline" size="sm" onClick={addTag}>
									<Plus className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</>
				) : (
					/* Preview Mode */
					<div className="space-y-4">
						<div>
							<h3 className="text-xl font-semibold">{formData.title || "Untitled"}</h3>
							{formData.description && (
								<p className="text-sm text-gray-600 mt-1">{formData.description}</p>
							)}
						</div>
						<div className="flex items-center gap-4 text-sm text-gray-500">
							<span className="flex items-center gap-1">
								<Folder className="w-4 h-4" />
								{categories.find((c) => c.value === formData.category)?.label ?? formData.category}
							</span>
							<span className="flex items-center gap-1">
								{contentTypes.find((t) => t.value === formData.contentType)?.label ?? formData.contentType}
							</span>
							<span
								className={cn(
									"flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
									formData.status === "approved"
										? "bg-green-100 text-green-700"
										: formData.status === "pending_approval"
										? "bg-yellow-100 text-yellow-700"
										: formData.status === "archived"
										? "bg-gray-100 text-gray-700"
										: "bg-blue-100 text-blue-700"
								)}
							>
								{formData.status === "approved" && <CheckCircle className="w-3 h-3" />}
								{formData.status === "pending_approval" && <Clock className="w-3 h-3" />}
								{formData.status === "archived" && <AlertTriangle className="w-3 h-3" />}
								{formData.status.replace(/_/g, " ")}
							</span>
						</div>
						{formData.tags.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{formData.tags.map((tag) => (
									<span
										key={tag}
										className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
									>
										{tag}
									</span>
								))}
							</div>
						)}
						<div className="prose max-w-none">
							<div className="whitespace-pre-wrap p-4 bg-gray-50 rounded-lg">
								{formData.content || "No content"}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
				<Button variant="outline" onClick={onCancel} disabled={saving}>
					Cancel
				</Button>
				<Button
					variant="primary"
					onClick={handleSave}
					disabled={saving || isLoading}
				>
					{saving ? (
						<>
							<span className="w-4 h-4 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full" />
							Saving...
						</>
					) : (
						<>
							<Save className="w-4 h-4 mr-1" />
							{isNewBlock ? "Create Block" : "Save Changes"}
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
