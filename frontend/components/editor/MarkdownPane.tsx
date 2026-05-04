"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
	MarkdownSync,
	createMarkdownSync,
	contentToMarkdown,
	markdownToContent,
} from "@/lib/editor/markdown-sync";
import type { DocumentContent } from "@/lib/types/document";
import {
	Copy,
	Check,
	Edit3,
	Eye,
	Download,
	FileText,
	RefreshCw,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for the MarkdownPane component.
 */
interface MarkdownPaneProps {
	/** Current document content from Tiptap */
	content: DocumentContent | null;
	/** Called when markdown is edited and should sync back to Tiptap */
	onContentChange?: (content: DocumentContent) => void;
	/** Whether the pane is read-only */
	readOnly?: boolean;
	/** Custom class for the container */
	className?: string;
}

/**
 * MarkdownPane component - displays live Markdown preview with optional editing.
 *
 * Features:
 * - Live preview of Tiptap content as Markdown
 * - Toggle between view and edit modes
 * - Syntax highlighting (basic)
 * - Copy to clipboard
 * - Export as .md file
 * - Bidirectional sync with Tiptap editor
 *
 * @example
 * <MarkdownPane
 *   content={editorContent}
 *   onContentChange={handleMarkdownChange}
 * />
 */
export const MarkdownPane = React.memo(function MarkdownPane({
	content,
	onContentChange,
	readOnly = false,
	className,
}: MarkdownPaneProps) {
	const [isEditing, setIsEditing] = React.useState(false);
	const [markdown, setMarkdown] = React.useState("");
	const [editedMarkdown, setEditedMarkdown] = React.useState("");
	const [copied, setCopied] = React.useState(false);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const syncRef = React.useRef<MarkdownSync | null>(null);

	// Initialize sync manager
	React.useEffect(() => {
		syncRef.current = createMarkdownSync();
		return () => {
			syncRef.current = null;
		};
	}, []);

	// Update markdown when content changes (from Tiptap)
	React.useEffect(() => {
		if (content && syncRef.current) {
			const newMarkdown = syncRef.current.updateFromTiptap(content);
			if (newMarkdown !== null) {
				setMarkdown(newMarkdown);
				if (!isEditing) {
					setEditedMarkdown(newMarkdown);
				}
			}
		} else if (content) {
			// Fallback without sync manager
			const newMarkdown = contentToMarkdown(content);
			setMarkdown(newMarkdown);
			if (!isEditing) {
				setEditedMarkdown(newMarkdown);
			}
		}
	}, [content, isEditing]);

	// Initialize from content on first render
	React.useEffect(() => {
		if (content && syncRef.current) {
			const initialMarkdown = syncRef.current.initialize(content);
			setMarkdown(initialMarkdown);
			setEditedMarkdown(initialMarkdown);
		}
	}, [content]);

	// Handle entering edit mode
	const handleStartEdit = React.useCallback(() => {
		if (readOnly) return;
		setEditedMarkdown(markdown);
		setIsEditing(true);
		// Focus textarea after state update
		setTimeout(() => {
			textareaRef.current?.focus();
			textareaRef.current?.setSelectionRange(0, 0);
		}, 0);
	}, [markdown, readOnly]);

	// Handle exiting edit mode and syncing changes
	const handleFinishEdit = React.useCallback(() => {
		setIsEditing(false);

		if (editedMarkdown !== markdown && syncRef.current) {
			const newContent = syncRef.current.updateFromMarkdown(editedMarkdown);
			if (newContent) {
				setMarkdown(editedMarkdown);
				onContentChange?.(newContent);
			}
		} else if (editedMarkdown !== markdown) {
			// Fallback without sync manager
			const newContent = markdownToContent(editedMarkdown);
			setMarkdown(editedMarkdown);
			onContentChange?.(newContent);
		}
	}, [editedMarkdown, markdown, onContentChange]);

	// Handle cancel edit
	const handleCancelEdit = React.useCallback(() => {
		setEditedMarkdown(markdown);
		setIsEditing(false);
	}, [markdown]);

	// Handle keyboard shortcuts in edit mode
	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent) => {
			// Escape to cancel
			if (e.key === "Escape") {
				e.preventDefault();
				handleCancelEdit();
			}
			// Cmd/Ctrl+Enter to save
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleFinishEdit();
			}
		},
		[handleCancelEdit, handleFinishEdit]
	);

	// Copy to clipboard
	const handleCopy = React.useCallback(async () => {
		try {
			await navigator.clipboard.writeText(markdown);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	}, [markdown]);

	// Export as .md file
	const handleExport = React.useCallback(() => {
		const blob = new Blob([markdown], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "document.md";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [markdown]);

	// Refresh from content
	const handleRefresh = React.useCallback(() => {
		if (content) {
			const newMarkdown = contentToMarkdown(content);
			setMarkdown(newMarkdown);
			setEditedMarkdown(newMarkdown);
			syncRef.current?.initialize(content);
		}
	}, [content]);

	return (
		<div
			className={cn(
				"flex flex-col h-full bg-gray-50 dark:bg-gray-900",
				className
			)}
		>
			{/* Toolbar */}
			<div
				className={cn(
					"flex items-center justify-between px-3 py-2 border-b",
					"border-gray-200 dark:border-gray-800",
					"bg-white dark:bg-gray-950"
				)}
			>
				<div className="flex items-center gap-2">
					<FileText className="h-4 w-4 text-gray-500" />
					<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
						Markdown
					</span>
					{isEditing && (
						<span className="text-xs text-amber-600 dark:text-amber-400">
							(Editing)
						</span>
					)}
				</div>

				<div className="flex items-center gap-1">
					{/* Refresh button */}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={handleRefresh}
								className={cn(
									"p-1.5 rounded transition-colors",
									"hover:bg-gray-100 dark:hover:bg-gray-800",
									"text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
								)}
								aria-label="Refresh"
							>
								<RefreshCw className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Refresh from editor</TooltipContent>
					</Tooltip>

					{/* Copy button */}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={handleCopy}
								className={cn(
									"p-1.5 rounded transition-colors",
									"hover:bg-gray-100 dark:hover:bg-gray-800",
									copied
										? "text-green-600"
										: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
								)}
								aria-label={copied ? "Copied!" : "Copy to clipboard"}
							>
								{copied ? (
									<Check className="h-4 w-4" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{copied ? "Copied!" : "Copy to clipboard"}
						</TooltipContent>
					</Tooltip>

					{/* Export button */}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={handleExport}
								className={cn(
									"p-1.5 rounded transition-colors",
									"hover:bg-gray-100 dark:hover:bg-gray-800",
									"text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
								)}
								aria-label="Download as .md"
							>
								<Download className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Download as .md</TooltipContent>
					</Tooltip>

					{/* Edit/View toggle */}
					{!readOnly && (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={isEditing ? handleFinishEdit : handleStartEdit}
									className={cn(
										"p-1.5 rounded transition-colors",
										"hover:bg-gray-100 dark:hover:bg-gray-800",
										isEditing
											? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
											: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
									)}
									aria-label={isEditing ? "Save changes" : "Edit markdown"}
									aria-pressed={isEditing}
								>
									{isEditing ? (
										<Eye className="h-4 w-4" />
									) : (
										<Edit3 className="h-4 w-4" />
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								{isEditing ? "Save and preview (⌘↵)" : "Edit markdown"}
							</TooltipContent>
						</Tooltip>
					)}
				</div>
			</div>

			{/* Content area */}
			<div className="flex-1 overflow-auto">
				{isEditing ? (
					<textarea
						ref={textareaRef}
						value={editedMarkdown}
						onChange={(e) => setEditedMarkdown(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={handleFinishEdit}
						className={cn(
							"w-full h-full p-4 resize-none",
							"bg-white dark:bg-gray-950",
							"font-mono text-sm",
							"text-gray-900 dark:text-gray-100",
							"focus:outline-none",
							"placeholder:text-gray-400 dark:placeholder:text-gray-600"
						)}
						placeholder="Enter markdown..."
						spellCheck={false}
					/>
				) : (
					<MarkdownPreview
						markdown={markdown}
						onDoubleClick={readOnly ? undefined : handleStartEdit}
					/>
				)}
			</div>

			{/* Status bar */}
			{isEditing && (
				<div
					className={cn(
						"flex items-center justify-between px-3 py-1.5 text-xs",
						"border-t border-gray-200 dark:border-gray-800",
						"bg-white dark:bg-gray-950 text-gray-500"
					)}
				>
					<span>Press Esc to cancel, ⌘↵ to save</span>
					<span>
						{editedMarkdown.split("\n").length} lines •{" "}
						{editedMarkdown.length} chars
					</span>
				</div>
			)}
		</div>
	);
});

MarkdownPane.displayName = "MarkdownPane";

/**
 * MarkdownPreview component - renders markdown with syntax highlighting.
 */
interface MarkdownPreviewProps {
	markdown: string;
	onDoubleClick?: () => void;
}

function MarkdownPreview({ markdown, onDoubleClick }: MarkdownPreviewProps) {
	if (!markdown.trim()) {
		return (
			<div
				className={cn(
					"h-full p-4 flex items-center justify-center",
					"text-gray-400 dark:text-gray-600 text-sm"
				)}
				onDoubleClick={onDoubleClick}
			>
				<span>No content. Start typing in the editor...</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"h-full p-4 overflow-auto",
				onDoubleClick && "cursor-text"
			)}
			onDoubleClick={onDoubleClick}
		>
			<pre
				className={cn(
					"font-mono text-sm whitespace-pre-wrap break-words",
					"text-gray-900 dark:text-gray-100"
				)}
			>
				<HighlightedMarkdown markdown={markdown} />
			</pre>
		</div>
	);
}

/**
 * HighlightedMarkdown - applies basic syntax highlighting to markdown.
 *
 * This is a simple implementation. For production, consider using
 * a library like Shiki or Prism for better highlighting.
 */
function HighlightedMarkdown({ markdown }: { markdown: string }) {
	const lines = markdown.split("\n");

	return (
		<>
			{lines.map((line, i) => (
				<React.Fragment key={i}>
					<HighlightedLine line={line} />
					{i < lines.length - 1 && "\n"}
				</React.Fragment>
			))}
		</>
	);
}

function HighlightedLine({ line }: { line: string }) {
	// Heading
	if (/^#{1,6}\s/.test(line)) {
		const match = line.match(/^(#{1,6})\s(.*)$/);
		if (match) {
			return (
				<span className="text-purple-600 dark:text-purple-400 font-semibold">
					<span className="opacity-50">{match[1]} </span>
					{match[2]}
				</span>
			);
		}
	}

	// Code block delimiter
	if (line.startsWith("```")) {
		return (
			<span className="text-green-600 dark:text-green-400">{line}</span>
		);
	}

	// Blockquote
	if (line.startsWith(">")) {
		return (
			<span className="text-gray-500 dark:text-gray-400 italic">
				<span className="text-blue-500">&gt;</span>
				{line.slice(1)}
			</span>
		);
	}

	// Horizontal rule
	if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
		return (
			<span className="text-gray-400 dark:text-gray-600">{line}</span>
		);
	}

	// List items
	if (/^\s*[-*+]\s/.test(line)) {
		const match = line.match(/^(\s*)([-*+])(\s.*)$/);
		if (match) {
			return (
				<span>
					{match[1]}
					<span className="text-blue-500">{match[2]}</span>
					<HighlightedInline text={match[3]} />
				</span>
			);
		}
	}

	// Ordered list
	if (/^\s*\d+\.\s/.test(line)) {
		const match = line.match(/^(\s*)(\d+\.)(\s.*)$/);
		if (match) {
			return (
				<span>
					{match[1]}
					<span className="text-blue-500">{match[2]}</span>
					<HighlightedInline text={match[3]} />
				</span>
			);
		}
	}

	// Task list
	if (/^\s*- \[[ xX]\]/.test(line)) {
		const match = line.match(/^(\s*- \[)([ xX])(\].*)$/);
		if (match) {
			const isChecked = match[2].toLowerCase() === "x";
			return (
				<span>
					<span className="text-blue-500">{match[1]}</span>
					<span
						className={
							isChecked
								? "text-green-500"
								: "text-gray-400"
						}
					>
						{match[2]}
					</span>
					<span className="text-blue-500">]</span>
					<HighlightedInline text={match[3].slice(1)} />
				</span>
			);
		}
	}

	// Regular line with inline highlighting
	return <HighlightedInline text={line} />;
}

function HighlightedInline({ text }: { text: string }) {
	// Simple regex-based highlighting for inline elements
	const parts: React.ReactNode[] = [];
	let remaining = text;
	let key = 0;

	const patterns: {
		regex: RegExp;
		render: (match: RegExpMatchArray) => React.ReactNode;
	}[] = [
		// Bold
		{
			regex: /\*\*(.+?)\*\*/,
			render: (m) => (
				<span className="text-orange-600 dark:text-orange-400 font-bold">
					<span className="opacity-50">**</span>
					{m[1]}
					<span className="opacity-50">**</span>
				</span>
			),
		},
		// Italic
		{
			regex: /\*(.+?)\*/,
			render: (m) => (
				<span className="text-orange-600 dark:text-orange-400 italic">
					<span className="opacity-50">*</span>
					{m[1]}
					<span className="opacity-50">*</span>
				</span>
			),
		},
		// Code
		{
			regex: /`(.+?)`/,
			render: (m) => (
				<span className="text-green-600 dark:text-green-400 bg-gray-100 dark:bg-gray-800 px-1 rounded">
					<span className="opacity-50">`</span>
					{m[1]}
					<span className="opacity-50">`</span>
				</span>
			),
		},
		// Link
		{
			regex: /\[(.+?)\]\((.+?)\)/,
			render: (m) => (
				<span className="text-blue-600 dark:text-blue-400">
					<span className="opacity-50">[</span>
					{m[1]}
					<span className="opacity-50">](</span>
					<span className="underline">{m[2]}</span>
					<span className="opacity-50">)</span>
				</span>
			),
		},
		// Image
		{
			regex: /!\[(.+?)\]\((.+?)\)/,
			render: (m) => (
				<span className="text-purple-600 dark:text-purple-400">
					<span className="opacity-50">![</span>
					{m[1]}
					<span className="opacity-50">](</span>
					{m[2]}
					<span className="opacity-50">)</span>
				</span>
			),
		},
	];

	while (remaining) {
		let earliestMatch: { index: number; match: RegExpMatchArray; pattern: (typeof patterns)[0] } | null = null;

		for (const pattern of patterns) {
			const match = remaining.match(pattern.regex);
			if (match && match.index !== undefined) {
				if (!earliestMatch || match.index < earliestMatch.index) {
					earliestMatch = { index: match.index, match, pattern };
				}
			}
		}

		if (earliestMatch) {
			// Add text before match
			if (earliestMatch.index > 0) {
				parts.push(
					<span key={key++}>{remaining.slice(0, earliestMatch.index)}</span>
				);
			}

			// Add highlighted match
			parts.push(
				<span key={key++}>
					{earliestMatch.pattern.render(earliestMatch.match)}
				</span>
			);

			remaining = remaining.slice(
				earliestMatch.index + earliestMatch.match[0].length
			);
		} else {
			// No more matches, add remaining text
			parts.push(<span key={key++}>{remaining}</span>);
			break;
		}
	}

	return <>{parts}</>;
}

/**
 * Hook to access the markdown sync manager.
 */
export function useMarkdownSync() {
	const syncRef = React.useRef<MarkdownSync | null>(null);

	React.useEffect(() => {
		syncRef.current = createMarkdownSync();
		return () => {
			syncRef.current = null;
		};
	}, []);

	return syncRef.current;
}

/**
 * Hook to get current markdown from editor content.
 */
export function useMarkdown(content: DocumentContent | null): string {
	const [markdown, setMarkdown] = React.useState("");

	React.useEffect(() => {
		if (content) {
			setMarkdown(contentToMarkdown(content));
		}
	}, [content]);

	return markdown;
}
