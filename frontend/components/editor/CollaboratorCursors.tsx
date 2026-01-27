/**
 * Collaborator cursors component for DocFusion.
 *
 * Renders remote collaborator cursors and selections in the editor.
 * Uses CSS positioning relative to the editor container.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CollaboratorPresence, CursorPosition } from "@/lib/types/collaboration";
import { useCollaboratorPresence, getActivityText } from "@/lib/collaboration/presence";

/**
 * Props for CollaboratorCursors component.
 */
export interface CollaboratorCursorsProps {
	/** Reference to the editor container for positioning */
	editorRef: React.RefObject<HTMLElement>;
	/** Function to convert document position to DOM coordinates */
	positionToCoords?: (pos: number) => { top: number; left: number } | null;
	/** Whether to show cursor labels */
	showLabels?: boolean;
	/** Whether to show activity indicators */
	showActivity?: boolean;
	/** Additional CSS class */
	className?: string;
}

/**
 * Collaborator cursors overlay.
 * Renders cursors and selections for all remote collaborators.
 */
export const CollaboratorCursors = React.memo(function CollaboratorCursors({
	editorRef,
	positionToCoords,
	showLabels = true,
	showActivity = false,
	className,
}: CollaboratorCursorsProps) {
	const { collaborators } = useCollaboratorPresence();

	// Don't render if there are no collaborators or no editor
	if (collaborators.length === 0 || !editorRef.current) {
		return null;
	}

	return (
		<div
			className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
			aria-hidden="true"
		>
			{collaborators.map((collaborator) => (
				<CollaboratorCursor
					key={collaborator.clientId}
					collaborator={collaborator}
					positionToCoords={positionToCoords}
					showLabel={showLabels}
					showActivity={showActivity}
				/>
			))}
		</div>
	);
});

CollaboratorCursors.displayName = "CollaboratorCursors";

/**
 * Props for individual cursor.
 */
interface CollaboratorCursorProps {
	collaborator: CollaboratorPresence;
	positionToCoords?: (pos: number) => { top: number; left: number } | null;
	showLabel?: boolean;
	showActivity?: boolean;
}

/**
 * Individual collaborator cursor.
 */
function CollaboratorCursor({
	collaborator,
	positionToCoords,
	showLabel = true,
	showActivity = false,
}: CollaboratorCursorProps) {
	const { user, cursor, selection, activity } = collaborator;

	// If no cursor position or can't convert to coords, don't render
	if (!cursor || !positionToCoords) {
		return null;
	}

	const coords = positionToCoords(cursor.pos);
	if (!coords) {
		return null;
	}

	// Render selection if present
	const selectionElement = selection && (
		<SelectionHighlight
			selection={selection}
			color={user.color}
			positionToCoords={positionToCoords}
		/>
	);

	return (
		<>
			{selectionElement}
			<div
				className="absolute transition-all duration-75 ease-out"
				style={{
					top: coords.top,
					left: coords.left,
					transform: "translateX(-1px)",
				}}
			>
				{/* Cursor line */}
				<div
					className="w-0.5 h-5 rounded-full animate-cursor-blink"
					style={{ backgroundColor: user.color }}
				/>

				{/* Label with name */}
				{showLabel && (
					<div
						className="absolute left-0 -top-6 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white shadow-sm"
						style={{ backgroundColor: user.color }}
					>
						{user.name}
						{showActivity && activity !== "viewing" && (
							<span className="ml-1 opacity-75">
								{getActivityText(activity)}
							</span>
						)}
					</div>
				)}
			</div>
		</>
	);
}

/**
 * Props for selection highlight.
 */
interface SelectionHighlightProps {
	selection: { from: number; to: number };
	color: string;
	positionToCoords: (pos: number) => { top: number; left: number } | null;
}

/**
 * Selection highlight overlay.
 * Note: This is a simplified version - full implementation would need
 * to handle multi-line selections by rendering multiple rects.
 */
function SelectionHighlight({
	selection,
	color,
	positionToCoords,
}: SelectionHighlightProps) {
	const fromCoords = positionToCoords(selection.from);
	const toCoords = positionToCoords(selection.to);

	if (!fromCoords || !toCoords) {
		return null;
	}

	// For same-line selections
	if (Math.abs(fromCoords.top - toCoords.top) < 5) {
		return (
			<div
				className="absolute opacity-30"
				style={{
					top: fromCoords.top,
					left: Math.min(fromCoords.left, toCoords.left),
					width: Math.abs(toCoords.left - fromCoords.left),
					height: 20,
					backgroundColor: color,
				}}
			/>
		);
	}

	// For multi-line selections, render a simplified highlight
	// A full implementation would calculate the actual selection rectangles
	return (
		<div
			className="absolute opacity-20 rounded"
			style={{
				top: Math.min(fromCoords.top, toCoords.top),
				left: 0,
				right: 0,
				height: Math.abs(toCoords.top - fromCoords.top) + 20,
				backgroundColor: color,
			}}
		/>
	);
}

/**
 * Hook to get cursor position converter from Tiptap editor.
 * This integrates with Tiptap's coordsAtPos function.
 */
export function useEditorCoords(
	editor: { view: { coordsAtPos: (pos: number) => { top: number; left: number } } } | null,
	containerRef: React.RefObject<HTMLElement>
): ((pos: number) => { top: number; left: number } | null) | undefined {
	return React.useCallback(
		(pos: number) => {
			if (!editor || !containerRef.current) {
				return null;
			}

			try {
				const coords = editor.view.coordsAtPos(pos);
				const containerRect = containerRef.current.getBoundingClientRect();

				return {
					top: coords.top - containerRect.top,
					left: coords.left - containerRect.left,
				};
			} catch {
				return null;
			}
		},
		[editor, containerRef]
	);
}

/**
 * Typing indicator component.
 * Shows an animated indicator when a collaborator is typing.
 */
export function TypingIndicator({
	collaborators,
	className,
}: {
	collaborators: CollaboratorPresence[];
	className?: string;
}) {
	const typingUsers = collaborators.filter((c) => c.activity === "typing");

	if (typingUsers.length === 0) {
		return null;
	}

	const text =
		typingUsers.length === 1
			? `${typingUsers[0].user.name} is typing...`
			: typingUsers.length === 2
				? `${typingUsers[0].user.name} and ${typingUsers[1].user.name} are typing...`
				: `${typingUsers.length} people are typing...`;

	return (
		<div
			className={cn(
				"flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400",
				className
			)}
		>
			<div className="flex gap-0.5">
				<span
					className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
					style={{ animationDelay: "0ms" }}
				/>
				<span
					className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
					style={{ animationDelay: "150ms" }}
				/>
				<span
					className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
					style={{ animationDelay: "300ms" }}
				/>
			</div>
			<span>{text}</span>
		</div>
	);
}

// Add custom animation for cursor blinking
if (typeof document !== "undefined") {
	const style = document.createElement("style");
	style.textContent = `
		@keyframes cursor-blink {
			0%, 50% { opacity: 1; }
			51%, 100% { opacity: 0; }
		}
		.animate-cursor-blink {
			animation: cursor-blink 1s ease-in-out infinite;
		}
	`;
	document.head.appendChild(style);
}
