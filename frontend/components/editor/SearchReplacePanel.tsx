/**
 * Search & Replace Panel - DocFusion
 *
 * A find-and-replace panel with regex support for the document editor.
 *
 * Features:
 * - Search with next/previous navigation
 * - Replace single or all
 * - Regex support with case sensitive option
 * - Counter showing current match position
 * - Keyboard shortcuts (Ctrl+F to open, Escape to close)
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	Search,
	X,
	ChevronUp,
	ChevronDown,
	Replace,
	ReplaceAll,
	CaseSensitive,
	Regex,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useToast } from "@/lib/hooks/use-toast";

// ============================================================================
// Types
// ============================================================================

interface SearchReplacePanelProps {
	editor: Editor;
	isOpen: boolean;
	onClose: () => void;
}

interface SearchMatch {
	from: number;
	to: number;
	text: string;
}

// ============================================================================
// Component
// ============================================================================

export function SearchReplacePanel({
	editor,
	isOpen,
	onClose,
}: SearchReplacePanelProps) {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = React.useState("");
	const [replaceQuery, setReplaceQuery] = React.useState("");
	const [caseSensitive, setCaseSensitive] = React.useState(false);
	const [useRegex, setUseRegex] = React.useState(false);
	const [currentMatchIndex, setCurrentMatchIndex] = React.useState(-1);
	const [matchCount, setMatchCount] = React.useState(0);
	const [error, setError] = React.useState("");
	const searchInputRef = React.useRef<HTMLInputElement>(null);

	// Focus input when panel opens
	React.useEffect(() => {
		if (isOpen) {
			setTimeout(() => searchInputRef.current?.focus(), 50);
		}
	}, [isOpen]);

	// Handle keyboard shortcuts
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "f") {
				e.preventDefault();
				// Parent should handle opening
			}
			if (e.key === "Escape" && isOpen) {
				onClose();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	// Search for matches
	const findMatches = React.useCallback((): SearchMatch[] => {
		if (!searchQuery.trim()) {
			setMatchCount(0);
			setCurrentMatchIndex(-1);
			return [];
		}

		const content = editor.getText();
		const matches: SearchMatch[] = [];

		try {
			let pattern: RegExp;
			
			if (useRegex) {
				pattern = new RegExp(searchQuery, caseSensitive ? "g" : "gi");
			} else {
				// Escape special regex characters for literal search
				const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				pattern = new RegExp(escaped, caseSensitive ? "g" : "gi");
			}

			let match;
			while ((match = pattern.exec(content)) !== null) {
				matches.push({
					from: match.index,
					to: match.index + match[0].length,
					text: match[0],
				});
			}

			setError("");
			return matches;
		} catch (err) {
			setError(useRegex ? "Invalid regex pattern" : "");
			return [];
		}
	}, [editor, searchQuery, caseSensitive, useRegex]);

	// Update match count when search changes
	React.useEffect(() => {
		const matches = findMatches();
		setMatchCount(matches.length);
		if (matches.length > 0 && currentMatchIndex < 0) {
			setCurrentMatchIndex(0);
		}
	}, [searchQuery, caseSensitive, useRegex, findMatches, currentMatchIndex]);

	const navigateMatch = (direction: "next" | "prev") => {
		if (matchCount === 0) return;

		let newIndex = currentMatchIndex;
		if (direction === "next") {
			newIndex = (currentMatchIndex + 1) % matchCount;
		} else {
			newIndex = currentMatchIndex - 1;
			if (newIndex < 0) newIndex = matchCount - 1;
		}

		setCurrentMatchIndex(newIndex);

		// Scroll to match
		const matches = findMatches();
		const match = matches[newIndex];
		if (match) {
			editor.chain().scrollIntoView().focus().run();
		}
	};

	const handleReplace = () => {
		if (!searchQuery.trim()) return;

		const { from, to } = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(from, to);

		// Only replace if current selection matches search query
		let shouldReplace = false;
		if (useRegex) {
			const pattern = new RegExp(searchQuery, caseSensitive ? "" : "i");
			shouldReplace = pattern.test(selectedText);
		} else {
			shouldReplace = caseSensitive
				? selectedText === searchQuery
				: selectedText.toLowerCase() === searchQuery.toLowerCase();
		}

		if (shouldReplace) {
			editor.chain().insertContent(replaceQuery).focus().run();
			// Find next
			setTimeout(() => navigateMatch("next"), 50);
		} else {
			navigateMatch("next");
		}
	};

	const handleReplaceAll = () => {
		if (!searchQuery.trim()) return;

		try {
			let pattern: RegExp;
			
			if (useRegex) {
				pattern = new RegExp(searchQuery, `g${caseSensitive ? "" : "i"}`);
			} else {
				const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				pattern = new RegExp(escaped, `g${caseSensitive ? "" : "i"}`);
			}

			const content = editor.getHTML();
			const newContent = content.replace(pattern, replaceQuery);

			editor.chain().setContent(newContent).focus().run();
			
			const replacedCount = matchCount;
			setMatchCount(0);
			setCurrentMatchIndex(-1);

			// Show success toast
			toast(`Replaced ${replacedCount} occurrence${replacedCount !== 1 ? "s" : ""}`, { variant: "success" });
		} catch (err) {
			setError("Replace failed");
		}
	};

	if (!isOpen) return null;

	return (
		<div className={cn(
			"fixed top-14 right-4 z-50 w-96 bg-card border border-border rounded-lg shadow-lg p-4",
			"animate-in slide-in-from-top-2 fade-in duration-200"
		)}>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Search className="h-4 w-4" />
					<span className="text-sm font-medium">Find & Replace</span>
				</div>
				<Button
					variant="ghost"
					onClick={onClose}
					className="h-8 w-8 p-0"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Search Input */}
			<div className="space-y-2">
				<div className="relative">
					<Input
						ref={searchInputRef}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Find..."
						className="pr-20"
						onKeyDown={(e) => {
							if (e.key === "Enter") navigateMatch("next");
						}}
					/>
					{matchCount > 0 && (
						<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							{currentMatchIndex + 1}/{matchCount}
						</span>
					)}
				</div>

				{/* Replace Input */}
				<Input
					value={replaceQuery}
					onChange={(e) => setReplaceQuery(e.target.value)}
					placeholder="Replace with..."
					onKeyDown={(e) => {
						if (e.key === "Enter") handleReplace();
					}}
				/>
			</div>

			{/* Options */}
			<div className="flex items-center gap-4 mt-4">
				<div className="flex items-center gap-2">
					<Switch
						id="case-sensitive"
						checked={caseSensitive}
						onCheckedChange={setCaseSensitive}
					/>
					<Label htmlFor="case-sensitive" className="text-xs flex items-center gap-1">
						<CaseSensitive className="h-3 w-3" />
						Match case
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Switch
						id="regex"
						checked={useRegex}
						onCheckedChange={setUseRegex}
					/>
					<Label htmlFor="regex" className="text-xs flex items-center gap-1">
						<Regex className="h-3 w-3" />
						Regex
					</Label>
				</div>
			</div>

			{/* Error */}
			{error && (
				<p className="text-xs text-destructive mt-2">{error}</p>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between mt-4 pt-4 border-t">
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						onClick={() => navigateMatch("prev")}
						disabled={matchCount === 0}
						className="h-8 w-8 p-0"
						title="Previous match (Shift+Enter)"
					>
						<ChevronUp className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						onClick={() => navigateMatch("next")}
						disabled={matchCount === 0}
						className="h-8 w-8 p-0"
						title="Next match (Enter)"
					>
						<ChevronDown className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={handleReplace}
						disabled={!searchQuery.trim()}
						className="h-8 text-xs"
					>
						<Replace className="h-3 w-3 mr-1" />
						Replace
					</Button>
					<Button
						variant="outline"
						onClick={handleReplaceAll}
						disabled={!searchQuery.trim()}
						className="h-8 text-xs"
					>
						<ReplaceAll className="h-3 w-3 mr-1" />
						Replace All
					</Button>
				</div>
			</div>

			{/* Shortcuts hint */}
			<div className="mt-3 text-xs text-muted-foreground">
				↑ ↓ Navigate • Enter Replace • Esc Close
			</div>
		</div>
	);
}
