"use client";

/**
 * DocumentSection - Section-based AI editing component
 *
 * Wraps each H1-H6 heading section in its own container with AI action buttons:
 * - ✨ Improve (enhance writing quality)
 * - 📚 Expand (add more detail)
 * - 📝 Condense (make concise)
 * - 📊 Evaluate (quality score)
 *
 * Features:
 * - Hover to reveal AI action buttons
 * - Click to select section content
 * - Integration with AI command palette
 * - Seamless Tiptap editor integration
 */

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sparkles, Maximize2, Minimize2, BarChart3 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { OutlineItem } from "@/lib/editor/extensions/outline";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAIStore } from "@/lib/stores/ai-store";

/**
 * Props for DocumentSection component
 */
export interface DocumentSectionProps {
	/** Tiptap editor instance */
	editor: Editor | null;
	/** Outline item representing this section */
	item: OutlineItem;
	/** Child content/nodes */
	children: React.ReactNode;
	/** Current quality score (0-100) if available */
	qualityScore?: number | null;
	/** Whether this section is currently selected/active */
	isActive?: boolean;
	/** Additional className */
	className?: string;
	/** Called when section is clicked */
	onClick?: (item: OutlineItem) => void;
	/** Whether AI actions are enabled */
	enableAIActions?: boolean;
}

/**
 * AI action button configuration
 */
interface AIAction {
	id: string;
	name: string;
	icon: React.ReactNode;
	tooltip: string;
	command: string;
}

/**
 * DocumentSection wraps a document section with AI editing capabilities.
 *
 * Displays:
 * - Section content in a bordered container
 * - AI action buttons on hover (Improve, Expand, Condense, Evaluate)
 * - Quality score indicator
 * - Integration with Tiptap for content selection
 *
 * @example
 * <DocumentSection
 *   editor={editor}
 *   item={sectionItem}
 *   qualityScore={85}
 *   onClick={handleSectionClick}
 * >
 *   <SectionContent />
 * </DocumentSection>
 */
export const DocumentSection = React.memo(function DocumentSection({
	editor,
	item,
	children,
	qualityScore,
	isActive = false,
	className,
	onClick,
	enableAIActions = true,
}: DocumentSectionProps): React.ReactElement {
	const [isHovered, setIsHovered] = React.useState(false);
	const openCommandPalette = useAIStore((s) => s.openCommandPalette);

	// AI action definitions
	const aiActions: AIAction[] = React.useMemo(
		() => [
			{
				id: "improve",
				name: "Improve",
				icon: <Sparkles className="h-3.5 w-3.5" />,
				tooltip: "Improve writing quality",
				command: "improve",
			},
			{
				id: "expand",
				name: "Expand",
				icon: <Maximize2 className="h-3.5 w-3.5" />,
				tooltip: "Expand with more detail",
				command: "expand",
			},
			{
				id: "condense",
				name: "Condense",
				icon: <Minimize2 className="h-3.5 w-3.5" />,
				tooltip: "Make more concise",
				command: "condense",
			},
		],
		[]
	);

	/**
	 * Get section content range from the editor.
	 * Returns the position range from heading start to next heading or document end.
	 */
	const getSectionRange = React.useCallback((): { from: number; to: number } | null => {
		if (!editor) return null;

		const { state } = editor;
		const { doc } = state;

		// Start from the heading position
		const from = item.pos;
		let to = from + item.size;

		// Find the next heading at same or higher level to determine section end
		doc.nodesBetween(to, doc.content.size, (node, pos) => {
			if (node.type.name === "heading" && pos > from) {
				const level = node.attrs.level as number;
				if (level <= item.level) {
					// Found next heading at same or higher level
					return false; // Stop traversal
				}
			}
			// Update 'to' to include this node's content
			to = Math.max(to, pos + node.nodeSize);
			return true;
		});

		return { from, to };
	}, [editor, item.pos, item.size, item.level]);

	/**
	 * Handle section click - select the section content.
	 */
	const handleClick = React.useCallback(
		(e: React.MouseEvent) => {
			// Don't trigger if clicking on AI action buttons
			if ((e.target as HTMLElement).closest("[data-ai-action]")) {
				return;
			}

			onClick?.(item);

			// Focus and set cursor at section heading
			if (editor) {
				editor.commands.focus(item.pos + 1);
			}
		},
		[editor, item, onClick]
	);

	/**
	 * Handle AI action button click.
	 */
	const handleAIAction = React.useCallback(
		(e: React.MouseEvent, action: AIAction) => {
			e.stopPropagation();
			e.preventDefault();

			if (!editor) return;

			const range = getSectionRange();
			if (!range) return;

			// Select the section content in the editor
			editor.chain().focus().setTextSelection(range).run();

			// Open command palette with the AI command
			openCommandPalette(action.command);
		},
		[editor, getSectionRange, openCommandPalette]
	);

	/**
	 * Handle evaluate action - opens quality assessment.
	 */
	const handleEvaluate = React.useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();

			if (!editor) return;

			const range = getSectionRange();
			if (!range) return;

			// Select section for evaluation
			editor.chain().focus().setTextSelection(range).run();

			// Open AI command palette with compliance check command to evaluate section
			openCommandPalette("compliance");
			toast.info(`Evaluating section: ${item.text}`);
		},
		[editor, getSectionRange, item.id, item.text, openCommandPalette]
	);

	/**
	 * Get quality score color.
	 */
	const getScoreColor = React.useCallback((score: number): string => {
		if (score >= 80) return "text-green-500";
		if (score >= 60) return "text-yellow-500";
		return "text-red-500";
	}, []);

	/**
	 * Get quality score background color.
	 */
	const getScoreBgColor = React.useCallback((score: number): string => {
		if (score >= 80) return "bg-green-500/10";
		if (score >= 60) return "bg-yellow-500/10";
		return "bg-red-500/10";
	}, []);

	const showActions = isHovered && enableAIActions;

	return (
		<div
			className={cn(
				"group relative border rounded-lg transition-all duration-200",
				"hover:border-primary/30 hover:shadow-sm",
				isActive && "border-primary/50 ring-1 ring-primary/20",
				className
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={handleClick}
			data-section-id={item.id}
			data-section-level={item.level}
		>
			{/* Section header with AI actions */}
			<div
				className={cn(
					"flex items-center justify-between px-3 py-2 border-b",
					"bg-muted/30 rounded-t-lg transition-colors",
					showActions && "bg-muted/50",
					isActive && "bg-primary/5"
				)}
			>
				{/* Section title/level indicator */}
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"text-xs font-medium text-muted-foreground",
							item.level === 1 && "text-foreground font-semibold"
						)}
					>
						H{item.level}
					</span>
					<span className="text-sm text-muted-foreground truncate max-w-[200px]">
						{item.text.slice(0, 50)}
						{item.text.length > 50 && "..."}
					</span>
				</div>

				{/* AI action buttons */}
				<div
					className={cn(
						"flex items-center gap-1 transition-opacity duration-200",
						showActions ? "opacity-100" : "opacity-0"
					)}
				>
					{aiActions.map((action) => (
						<Tooltip key={action.id}>
							<TooltipTrigger asChild>
								<button
									type="button"
									data-ai-action
									onClick={(e) => handleAIAction(e, action)}
									className={cn(
										"p-1.5 rounded-md transition-all duration-150",
										"text-muted-foreground hover:text-foreground",
										"hover:bg-background hover:shadow-sm",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									)}
									aria-label={action.tooltip}
								>
									{action.icon}
								</button>
							</TooltipTrigger>
							<TooltipContent side="top">{action.tooltip}</TooltipContent>
						</Tooltip>
					))}

					{/* Evaluate button */}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								data-ai-action
								onClick={handleEvaluate}
								className={cn(
									"p-1.5 rounded-md transition-all duration-150",
									"text-muted-foreground hover:text-foreground",
									"hover:bg-background hover:shadow-sm",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								)}
								aria-label="Evaluate quality"
							>
								<BarChart3 className="h-3.5 w-3.5" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">Evaluate quality</TooltipContent>
					</Tooltip>
				</div>

				{/* Quality score indicator */}
				{qualityScore !== undefined && qualityScore !== null && (
					<div
						className={cn(
							"ml-2 px-2 py-0.5 rounded text-xs font-medium",
							getScoreColor(qualityScore),
							getScoreBgColor(qualityScore)
						)}
						title={`Quality score: ${qualityScore}/100`}
					>
						{qualityScore}
					</div>
				)}
			</div>

			{/* Section content */}
			<div className="p-3">{children}</div>
		</div>
	);
});

DocumentSection.displayName = "DocumentSection";

export default DocumentSection;
