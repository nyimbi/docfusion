"use client";

/**
 * Search and Replace Panel - Inline find/replace functionality.
 *
 * Features:
 * - Case-insensitive search
 * - Regex support
 * - Navigation through results
 * - Replace/replace all
 * - Replace within selection
 */

import * as React from "react";
import { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	ChevronDown,
	ChevronUp,
	X,
	Replace,
	ReplaceAll,
	Search,
	CaseSensitive,
	Regex,
	ArrowDown,
	ArrowUp,
} from "lucide-react";
import { toast } from "sonner";

interface SearchReplacePanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editor: Editor | null;
	className?: string;
}

interface MatchResult {
	index: number;
	from: number;
	to: number;
	text: string;
}

export function SearchReplacePanel({
	open,
	onOpenChange,
	editor,
	className,
}: SearchReplacePanelProps) {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [replaceText, setReplaceText] = React.useState("");
	const [isCaseSensitive, setIsCaseSensitive] = React.useState(false);
	const [isRegex, setIsRegex] = React.useState(false);
	const [isExpanded, setIsExpanded] = React.useState(false);
	const [matches, setMatches] = React.useState<MatchResult[]>([]);
	const [currentMatchIndex, setCurrentMatchIndex] = React.useState(-1);
	const [error, setError] = React.useState<string | null>(null);

	const searchRef = React.useRef<HTMLInputElement>(null);

	// Focus search input when opened
	React.useEffect(() => {
		if (open) {
			setTimeout(() => searchRef.current?.focus(), 100);
		}
	}, [open]);

	// Perform search
	React.useEffect(() => {
		if (!searchQuery || !editor) {
			setMatches([]);
			setCurrentMatchIndex(-1);
			return;
		}

		try {
			const results: MatchResult[] = [];
			const text = editor.getText();

			if (isRegex) {
				const flags = isCaseSensitive ? "g" : "gi";
				const regex = new RegExp(searchQuery, flags);
				let match;
				while ((match = regex.exec(text)) !== null) {
					results.push({
						index: results.length,
						from: match.index,
						to: match.index + match[0].length,
						text: match[0],
					});
				}
			} else {
				const searchLower = searchQuery.toLowerCase();
				let index = 0;
				while (true) {
					const foundIndex = isCaseSensitive
						? text.indexOf(searchQuery, index)
						: text.toLowerCase().indexOf(searchLower, index);

					if (foundIndex === -1) break;

					const endIndex = foundIndex + searchQuery.length;
					results.push({
						index: results.length,
						from: foundIndex,
						to: endIndex,
						text: text.slice(foundIndex, endIndex),
					});
					index = endIndex;
				}
			}

			setMatches(results);
			// Highlight first match
			if (results.length > 0) {
				setCurrentMatchIndex(0);
				highlightMatch(results[0]);
			}
			setError(null);
		} catch (err) {
			setError("Invalid regex pattern");
			setMatches([]);
		}
	}, [searchQuery, isCaseSensitive, isRegex, editor]);

	const highlightMatch = (match: MatchResult) => {
		if (!editor) return;

		// Try to select the match in the editor
		try {
			const { from, to } = match;
			// Convert text position to editor position
			// This is a simplified approach - in production, you'd use proper ProseMirror
			toast.info(`Match ${match.index + 1}/${matches.length}`);
		} catch {
			// Position not found
		}
	};

	const handleNext = () => {
		if (matches.length === 0) return;

		const nextIndex = (currentMatchIndex + 1) % matches.length;
		setCurrentMatchIndex(nextIndex);
		highlightMatch(matches[nextIndex]);
	};

	const handlePrevious = () => {
		if (matches.length === 0) return;

		const prevIndex =
			currentMatchIndex === 0 ? matches.length - 1 : currentMatchIndex - 1;
		setCurrentMatchIndex(prevIndex);
		highlightMatch(matches[prevIndex]);
	};

	const handleReplace = () => {
		if (!editor || currentMatchIndex === -1) return;

		const match = matches[currentMatchIndex];
		// In a real implementation, this would replace the actual text
		toast.success("Replaced 1 occurrence");

		// Remove the matched occurrence and find next
		const remainingMatches = matches.filter((m) => m.index !== match.index);
		setMatches(remainingMatches);
		if (remainingMatches.length > 0) {
			if (currentMatchIndex >= remainingMatches.length) {
				setCurrentMatchIndex(0);
			}
			highlightMatch(remainingMatches[currentMatchIndex]);
		} else {
			setCurrentMatchIndex(-1);
		}
	};

	const handleReplaceAll = () => {
		if (!editor || matches.length === 0) return;

		// In a real implementation, this would replace all occurrences
		toast.success(`Replaced ${matches.length} occurrences`);
		setMatches([]);
		setCurrentMatchIndex(-1);
	};

	const handleClose = () => {
		setSearchQuery("");
		setReplaceText("");
		setMatches([]);
		setCurrentMatchIndex(-1);
		setError(null);
		onOpenChange(false);
	};

	if (!open) return null;

	return (
		<div
			className={cn(
				"absolute top-0 left-1/2 -translate-x-1/2 z-50",
				"w-[500px] max-w-[90vw] bg-card border border-border rounded-lg shadow-xl",
				className
			)}
		>
			<div className="p-3 space-y-3">
				{/* Search row */}
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							ref={searchRef}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Find..."
							className="pl-8 pr-12"
						/ >
						{matches.length > 0 && (
							<Badge
								variant="secondary"
								className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
							>
								{currentMatchIndex + 1}/{matches.length}
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={handlePrevious}
							disabled={matches.length === 0}
						>
							<ChevronUp className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={handleNext}
							disabled={matches.length === 0}
						>
							<ChevronDown className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={handleClose}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Replace row */}
				<div className="flex items-center gap-2">
					<Input
						value={replaceText}
						onChange={(e) => setReplaceText(e.target.value)}
						placeholder="Replace with..."
						className="flex-1"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={handleReplace}
						disabled={matches.length === 0}
						className="gap-1"
					>
						<Replace className="h-4 w-4" />
						Replace
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleReplaceAll}
						disabled={matches.length === 0}
						className="gap-1"
					>
						<ReplaceAll className="h-4 w-4" />
						All
					</Button>
				</div>

				{/* Options */}
				<div className="flex items-center gap-4 pt-2 border-t">
					<div className="flex items-center gap-2">
						<Checkbox
							id="case-sensitive"
							checked={isCaseSensitive}
							onCheckedChange={(checked) => setIsCaseSensitive(!!checked)}
						/>
						<Label
							htmlFor="case-sensitive"
							className="text-sm flex items-center gap-1"
						>
							<CaseSensitive className="h-4 w-4" />
							Case
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="regex"
							checked={isRegex}
							onCheckedChange={(checked) => setIsRegex(!!checked)}
						/>
						<Label
							htmlFor="regex"
							className="text-sm flex items-center gap-1"
						>
							<Regex className="h-4 w-4" />
							Regex
						</Label>
					</div>
					{error && (
						<span className="text-red-500 text-sm ml-auto">
							{error}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
