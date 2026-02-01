"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
	ArrowDown,
	ArrowUp,
	ArrowLeft,
	ArrowRight,
	GripVertical,
	ChevronsUpDown,
	MoveHorizontal,
	Indent,
	Outdent,
	X,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { OutlineItem, DocumentOutline } from "@/lib/editor/extensions/outline";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Props for SectionReordering component
 */
export interface SectionReorderingProps {
	/** Tiptap editor instance */
	editor: Editor | null;
	/** Document outline */
	outline: DocumentOutline | null;
	/** Currently selected section */
	selectedSectionId?: string | null;
	/** Called when section is moved */
	onSectionMove?: (sectionId: string, direction: "up" | "down" | "promote" | "demote") => void;
	/** Custom className */
	className?: string;
	/** Whether the component is expanded */
	isExpanded?: boolean;
	/** Called when expand state changes */
	onExpandChange?: (expanded: boolean) => void;
}

/**
 * Section reordering UI with buttons and drag support.
 *
 * Provides controls for:
 * - Move up/down within siblings
 * - Promote/demote nesting level
 * - Jump to top/bottom
 * - Visual drag handles
 *
 * @example
 * <SectionReordering
 *   editor={editor}
 *   outline={outline}
 *   selectedSectionId={currentSectionId}
 *   onSectionMove={handleMove}
 * />
 */
export const SectionReordering = React.memo(function SectionReordering({
	editor,
	outline,
	selectedSectionId,
	onSectionMove,
	className,
	isExpanded: externalExpanded,
	onExpandChange,
}: SectionReorderingProps): React.ReactElement {
	const [internalExpanded, setInternalExpanded] = React.useState(true);
	const isExpanded = externalExpanded ?? internalExpanded;
	const setExpanded = onExpandChange ?? setInternalExpanded;

	// Get selected item
	const selectedItem = React.useMemo<OutlineItem | null>(() => {
		if (!outline || !selectedSectionId) return null;
		return outline.items.get(selectedSectionId) ?? null;
	}, [outline, selectedSectionId]);

	// Check if operations are available
	const canMove = React.useMemo(
		() => ({
			up: !!selectedItem && canMoveUp(selectedItem, outline),
			down: !!selectedItem && canMoveDown(selectedItem, outline),
			promote: !!selectedItem && canPromote(selectedItem, outline),
			demote: !!selectedItem && canDemote(selectedItem, outline),
		}),
		[selectedItem, outline]
	);

	// Move operations
	const handleMoveUp = React.useCallback(() => {
		if (!selectedItem || !canMove.up) return;
		performMove(editor, selectedItem, "up", onSectionMove);
	}, [selectedItem, editor, canMove.up, onSectionMove]);

	const handleMoveDown = React.useCallback(() => {
		if (!selectedItem || !canMove.down) return;
		performMove(editor, selectedItem, "down", onSectionMove);
	}, [selectedItem, editor, canMove.down, onSectionMove]);

	const handlePromote = React.useCallback(() => {
		if (!selectedItem || !canMove.promote) return;
		performMove(editor, selectedItem, "promote", onSectionMove);
	}, [selectedItem, editor, canMove.promote, onSectionMove]);

	const handleDemote = React.useCallback(() => {
		if (!selectedItem || !canMove.demote) return;
		performMove(editor, selectedItem, "demote", onSectionMove);
	}, [selectedItem, editor, canMove.demote, onSectionMove]);

	// Handle keyboard shortcuts
	React.useEffect(() => {
		if (!selectedItem) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle when editor is focused
			if (!editor?.isFocused) return;

			if (e.altKey) {
				switch (e.key) {
					case "ArrowUp":
						e.preventDefault();
						handleMoveUp();
						break;
					case "ArrowDown":
						e.preventDefault();
						handleMoveDown();
						break;
					case "ArrowLeft":
						e.preventDefault();
						handlePromote();
						break;
					case "ArrowRight":
						e.preventDefault();
						handleDemote();
						break;
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selectedItem, editor, handleMoveUp, handleMoveDown, handlePromote, handleDemote]);

	// No selection state
	if (!selectedItem) {
		return (
			<div
				className={cn(
					"border rounded-lg bg-card text-card-foreground p-4 text-center",
					className
				)}
			>
				<p className="text-sm text-muted-foreground">
					Select a section to reorder
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"border rounded-lg bg-card text-card-foreground",
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b bg-muted/50">
				<h3 className="font-semibold text-sm">Section Reordering</h3>
				<button
					type="button"
					onClick={() => setExpanded(!isExpanded)}
					className="p-1 rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					aria-label={isExpanded ? "Collapse" : "Expand"}
				>
					<ChevronsUpDown className="h-4 w-4" />
				</button>
			</div>

			{/* Content */}
			{isExpanded && (
				<div className="p-3 space-y-4">
					{/* Selected section info */}
					<div className="flex items-start gap-2 text-sm">
						<GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
						<div className="min-w-0">
							<p className="font-medium truncate" title={selectedItem.text}>
								{selectedItem.text}
							</p>
							<p className="text-xs text-muted-foreground">
								Level {selectedItem.level} 
								{selectedItem.parentId && " • Nested"}
							</p>
						</div>
					</div>

					{/* Quick move buttons */}
					<div className="grid grid-cols-2 gap-2">
						<MoveButton
							icon={<ArrowUp className="h-4 w-4" />}
							label="Move Up"
							shortcut="Alt+↑"
							onClick={handleMoveUp}
							disabled={!canMove.up}
						/>
						<MoveButton
							icon={<ArrowDown className="h-4 w-4" />}
							label="Move Down"
							shortcut="Alt+↓"
							onClick={handleMoveDown}
							disabled={!canMove.down}
						/>
						<MoveButton
							icon={<ArrowLeft className="h-4 w-4" />}
							label="Outdent"
							shortcut="Alt+←"
							onClick={handlePromote}
							disabled={!canMove.promote}
						/>
						<MoveButton
							icon={<ArrowRight className="h-4 w-4" />}
							label="Indent"
							shortcut="Alt+→"
							onClick={handleDemote}
							disabled={!canMove.demote}
						/>
					</div>

					{/* Advanced moves dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors"
							>
								<MoveHorizontal className="h-4 w-4" />
								Advanced Moves
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="center" className="w-48">
							<DropdownMenuItem onClick={handleMoveUp} disabled={!canMove.up}>
								<ArrowUp className="h-4 w-4 mr-2" />
								Move Up
								<span className="ml-auto text-xs text-muted-foreground">Alt+↑</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleMoveDown} disabled={!canMove.down}>
								<ArrowDown className="h-4 w-4 mr-2" />
								Move Down
								<span className="ml-auto text-xs text-muted-foreground">Alt+↓</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handlePromote} disabled={!canMove.promote}>
								<Outdent className="h-4 w-4 mr-2" />
								Outdent (Promote)
								<span className="ml-auto text-xs text-muted-foreground">Alt+←</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleDemote} disabled={!canMove.demote}>
								<Indent className="h-4 w-4 mr-2" />
								Indent (Demote)
								<span className="ml-auto text-xs text-muted-foreground">Alt+→</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Keyboard hints */}
					<div className="text-xs text-muted-foreground pt-2 border-t">
						<p>Keyboard shortcuts:</p>
						<div className="grid grid-cols-2 gap-x-2 mt-1 text-muted-foreground/80">
							<span>Alt + ↑ Move up</span>
							<span>Alt + ↓ Move down</span>
							<span>Alt + ← Outdent</span>
							<span>Alt + → Indent</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
});

SectionReordering.displayName = "SectionReordering";

/**
 * Individual move button component
 */
interface MoveButtonProps {
	icon: React.ReactNode;
	label: string;
	shortcut?: string;
	onClick: () => void;
	disabled?: boolean;
}

function MoveButton({
	icon,
	label,
	shortcut,
	onClick,
	disabled,
}: MoveButtonProps): React.ReactElement {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex flex-col items-center gap-1 p-2 rounded-md border transition-all",
				"hover:bg-accent hover:text-accent-foreground hover:border-accent",
				"active:scale-95",
				disabled
					? "opacity-50 cursor-not-allowed pointer-events-none"
					: "bg-background"
			)}
		>
			{icon}
			<span className="text-xs font-medium">{label}</span>
			{shortcut && (
				<span className="text-[10px] text-muted-foreground">{shortcut}</span>
			)}
		</button>
	);
}

// Validation helpers

function canMoveUp(item: OutlineItem, outline: DocumentOutline | null): boolean {
	if (!outline) return false;

	// Check if there's a sibling before
	const siblings = item.parentId
		? (outline.items.get(item.parentId)?.children ?? [])
		: outline.roots;

	const index = siblings.indexOf(item.id);
	return index > 0;
}

function canMoveDown(item: OutlineItem, outline: DocumentOutline | null): boolean {
	if (!outline) return false;

	// Check if there's a sibling after
	const siblings = item.parentId
		? (outline.items.get(item.parentId)?.children ?? [])
		: outline.roots;

	const index = siblings.indexOf(item.id);
	return index < siblings.length - 1;
}

function canPromote(item: OutlineItem, outline: DocumentOutline | null): boolean {
	if (!outline) return false;
	// Can promote if has parent (can't go beyond root)
	return item.parentId !== null;
}

function canDemote(item: OutlineItem, outline: DocumentOutline | null): boolean {
	if (!outline) return false;

	// Check if there's a previous sibling to become an indent
	const siblings = item.parentId
		? (outline.items.get(item.parentId)?.children ?? [])
		: outline.roots;

	const index = siblings.indexOf(item.id);
	if (index > 0) {
		// Can demote under previous sibling
		return true;
	}
	return false;
}

// Perform move using editor commands
function performMove(
	editor: Editor | null,
	item: OutlineItem,
	direction: "up" | "down" | "promote" | "demote",
	callback?: (sectionId: string, direction: "up" | "down" | "promote" | "demote") => void
): void {
	if (!editor) return;

	// Find the position to move to
	type PosInfo = { pos: number | null; mode: "before" | "after" };
	let target: PosInfo = { pos: null, mode: "after" };

	// Find target position based on direction
	switch (direction) {
		case "up":
			// Find previous sibling
			{
				const { state } = editor;
				// Scan backwards from item position to find previous heading of same level
				let lastPos: number | null = null;
				state.doc.nodesBetween(0, item.pos, (node, pos) => {
					if (
						node.type.name === "heading" &&
						node.attrs.level <= item.level &&
						pos < item.pos
					) {
						lastPos = pos;
					}
				});
				target = { pos: lastPos, mode: "before" };
			}
			break;
		case "down":
			// Find next sibling
			{
				const { state } = editor;
				// Find end of current section
				let sectionEnd = item.pos + item.size;
				let foundNext = false;
				state.doc.nodesBetween(item.pos + item.size, state.doc.content.size, (node, pos) => {
					if (foundNext) return false;
					if (node.type.name === "heading") {
						if (node.attrs.level <= item.level) {
							target = { pos, mode: "after" };
							foundNext = true;
							return false;
						}
					}
					sectionEnd = pos + node.nodeSize;
					return true;
				});
				if (!foundNext) {
					// Move to end
					target = { pos: state.doc.content.size, mode: "before" };
				}
			}
			break;
		case "promote":
			// Move to same level as parent
			// Currently, we just change the heading level
			if (item.level > 1) {
				const tr = editor.state.tr;
				const node = editor.state.doc.nodeAt(item.pos);
				if (node) {
					tr.setNodeMarkup(item.pos, undefined, {
						...node.attrs,
						level: item.level - 1,
					});
					editor.view.dispatch(tr);
				}
			}
			break;
		case "demote":
			// Move to be child of previous sibling
			if (item.level < 6) {
				const tr = editor.state.tr;
				const node = editor.state.doc.nodeAt(item.pos);
				if (node) {
					tr.setNodeMarkup(item.pos, undefined, {
						...node.attrs,
						level: item.level + 1,
					});
					editor.view.dispatch(tr);
				}
			}
			break;
	}

	// Execute the move
	if (target.pos !== null && direction !== "promote" && direction !== "demote") {
		// Move section using Tiptap transaction
		moveSection(editor, item.pos, target.pos, target.mode);
	}

	// Notify callback
	callback?.(item.id, direction);
}

/**
 * Move a section in the document using Tiptap
 */
function moveSection(
	editor: Editor,
	from: number,
	to: number,
	mode: "before" | "after"
): void {
	const state = editor.state;
	const dispatch = editor.view.dispatch;
	const { tr } = state;

	// Find the section range (heading + its content)
	const fromNode = state.doc.nodeAt(from);
	if (!fromNode || fromNode.type.name !== "heading") return;

	let sectionEnd = from + fromNode.nodeSize;
	state.doc.nodesBetween(from + fromNode.nodeSize, state.doc.content.size, (node) => {
		if (node.type.name === "heading") {
			// Stop at any heading (we'll include descendants for hierarchical move)
			return false;
		}
		sectionEnd += node.nodeSize;
		return true;
	});

	// Extract the section
	const slice = state.doc.slice(from, sectionEnd);

	// Calculate insert position
	let insertPos = to;
	if (mode === "after") {
		const targetNode = state.doc.nodeAt(to);
		if (targetNode) {
			insertPos = to + targetNode.nodeSize;
		}
	}

	// Adjust insert position if we're moving content before the insert point
	const deleteOffset = insertPos > from ? -(sectionEnd - from) : 0;

	// Delete and insert in a single transaction
	tr.delete(from, sectionEnd);
	tr.insert(insertPos + deleteOffset, slice.content);

	dispatch(tr);
}

export default SectionReordering;
