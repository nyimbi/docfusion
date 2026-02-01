/**
 * TagManager Component
 *
 * Tag editing interface for content blocks with auto-suggestions,
 * AI tagging, and tag hierarchy management.
 */

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Tag,
	Plus,
	X,
	Sparkles,
	Search,
	ChevronDown,
	Check,
	Folder,
	RefreshCw,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TagWithMetadata {
	name: string;
	count?: number;
	category?: string;
	isAiGenerated?: boolean;
}

interface TagManagerProps {
	tags: string[];
	onChange: (tags: string[]) => void;
	availableTags?: TagWithMetadata[];
	suggestedTags?: string[];
	onAutoTag?: () => Promise<string[]>;
	onCreateTag?: (tag: string, category?: string) => Promise<void>;
	maxTags?: number;
	placeholder?: string;
	showCategories?: boolean;
	readOnly?: boolean;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TagManager({
	tags,
	onChange,
	availableTags = [],
	suggestedTags = [],
	onAutoTag,
	onCreateTag,
	maxTags = 20,
	placeholder = "Add a tag...",
	showCategories = false,
	readOnly = false,
	className,
}: TagManagerProps) {
	const [inputValue, setInputValue] = useState("");
	const [showDropdown, setShowDropdown] = useState(false);
	const [autoTagging, setAutoTagging] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Filter available tags based on input
	const filteredTags = useMemo(() => {
		if (!inputValue.trim()) {
			return availableTags.filter((t) => !tags.includes(t.name)).slice(0, 10);
		}

		const query = inputValue.toLowerCase();
		return availableTags
			.filter(
				(t) =>
					t.name.toLowerCase().includes(query) && !tags.includes(t.name)
			)
			.slice(0, 10);
	}, [availableTags, inputValue, tags]);

	// Get suggestions not already applied
	const unappliedSuggestions = suggestedTags.filter((t) => !tags.includes(t));

	// Handle click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setShowDropdown(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const addTag = useCallback(
		(tag: string) => {
			const trimmed = tag.trim().toLowerCase();
			if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
				onChange([...tags, trimmed]);
			}
			setInputValue("");
			setSelectedIndex(-1);
		},
		[tags, onChange, maxTags]
	);

	const removeTag = useCallback(
		(tag: string) => {
			onChange(tags.filter((t) => t !== tag));
		},
		[tags, onChange]
	);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "Enter":
				e.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < filteredTags.length) {
					addTag(filteredTags[selectedIndex].name);
				} else if (inputValue.trim()) {
					addTag(inputValue);
				}
				break;
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) =>
					Math.min(prev + 1, filteredTags.length - 1)
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, -1));
				break;
			case "Escape":
				setShowDropdown(false);
				setSelectedIndex(-1);
				break;
			case "Backspace":
				if (!inputValue && tags.length > 0) {
					removeTag(tags[tags.length - 1]);
				}
				break;
		}
	};

	const handleAutoTag = async () => {
		if (!onAutoTag) return;
		setAutoTagging(true);
		try {
			const newTags = await onAutoTag();
			const uniqueNewTags = newTags.filter((t) => !tags.includes(t));
			if (uniqueNewTags.length > 0) {
				onChange([...tags, ...uniqueNewTags].slice(0, maxTags));
			}
		} finally {
			setAutoTagging(false);
		}
	};

	const handleCreateTag = async (tagName: string) => {
		if (onCreateTag) {
			await onCreateTag(tagName);
		}
		addTag(tagName);
	};

	// Group available tags by category if showing categories
	const groupedTags = useMemo(() => {
		if (!showCategories) return { "": filteredTags };

		const groups: Record<string, TagWithMetadata[]> = {};
		for (const tag of filteredTags) {
			const category = tag.category ?? "";
			if (!groups[category]) {
				groups[category] = [];
			}
			groups[category].push(tag);
		}
		return groups;
	}, [filteredTags, showCategories]);

	return (
		<div ref={containerRef} className={cn("space-y-2", className)}>
			{/* Current Tags */}
			<div className="flex flex-wrap gap-2">
				{tags.map((tag) => (
					<span
						key={tag}
						className={cn(
							"inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm",
							"bg-blue-100 text-blue-700"
						)}
					>
						<Tag className="w-3 h-3" />
						{tag}
						{!readOnly && (
							<button
								onClick={() => removeTag(tag)}
								className="hover:text-blue-900"
							>
								<X className="w-3 h-3" />
							</button>
						)}
					</span>
				))}
				{tags.length === 0 && readOnly && (
					<span className="text-sm text-gray-500 italic">No tags</span>
				)}
			</div>

			{/* Input and Actions */}
			{!readOnly && (
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Input
							ref={inputRef}
							value={inputValue}
							onChange={(e) => {
								setInputValue(e.target.value);
								setShowDropdown(true);
								setSelectedIndex(-1);
							}}
							onFocus={() => setShowDropdown(true)}
							onKeyDown={handleKeyDown}
							placeholder={
								tags.length >= maxTags
									? `Max ${maxTags} tags reached`
									: placeholder
							}
							disabled={tags.length >= maxTags}
							className="pr-8"
						/>
						<Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

						{/* Dropdown */}
						{showDropdown && (inputValue || filteredTags.length > 0) && (
							<div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
								{/* Filtered Available Tags */}
								{Object.entries(groupedTags).map(([category, categoryTags]) => (
									<div key={category}>
										{category && (
											<div className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50 flex items-center gap-1">
												<Folder className="w-3 h-3" />
												{category}
											</div>
										)}
										{categoryTags.map((tag, index) => {
											const globalIndex = filteredTags.indexOf(tag);
											return (
												<button
													key={tag.name}
													onClick={() => addTag(tag.name)}
													className={cn(
														"w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50",
														globalIndex === selectedIndex && "bg-blue-50"
													)}
												>
													<span className="flex items-center gap-2">
														<Tag className="w-4 h-4 text-gray-400" />
														<span className="text-sm">{tag.name}</span>
														{tag.isAiGenerated && (
															<Sparkles className="w-3 h-3 text-purple-500" />
														)}
													</span>
													{tag.count !== undefined && (
														<span className="text-xs text-gray-500">
															{tag.count} uses
														</span>
													)}
												</button>
											);
										})}
									</div>
								))}

								{/* Create New Tag Option */}
								{inputValue &&
									!filteredTags.some(
										(t) => t.name.toLowerCase() === inputValue.toLowerCase()
									) && (
										<button
											onClick={() => handleCreateTag(inputValue)}
											className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 border-t"
										>
											<Plus className="w-4 h-4 text-green-600" />
											<span className="text-sm">
												Create &quot;{inputValue}&quot;
											</span>
										</button>
									)}

								{/* No Results */}
								{filteredTags.length === 0 && !inputValue && (
									<div className="px-3 py-4 text-center text-sm text-gray-500">
										No tags available. Start typing to create one.
									</div>
								)}
							</div>
						)}
					</div>

					{/* Auto-Tag Button */}
					{onAutoTag && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleAutoTag}
							disabled={autoTagging}
						>
							{autoTagging ? (
								<RefreshCw className="w-4 h-4 animate-spin" />
							) : (
								<Sparkles className="w-4 h-4" />
							)}
						</Button>
					)}
				</div>
			)}

			{/* AI Suggested Tags */}
			{!readOnly && unappliedSuggestions.length > 0 && (
				<div className="mt-2">
					<div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
						<Sparkles className="w-3 h-3 text-purple-500" />
						AI Suggestions:
					</div>
					<div className="flex flex-wrap gap-1">
						{unappliedSuggestions.map((tag) => (
							<button
								key={tag}
								onClick={() => addTag(tag)}
								className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100 transition-colors"
							>
								<Plus className="w-3 h-3" />
								{tag}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Tag Count */}
			{!readOnly && (
				<div className="text-xs text-gray-500">
					{tags.length} / {maxTags} tags
				</div>
			)}
		</div>
	);
}
