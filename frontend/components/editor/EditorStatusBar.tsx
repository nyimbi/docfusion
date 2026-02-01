"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useCollaborationStore } from "@/lib/stores/collaboration-store";
import type { AutosaveStatus, AutosaveError } from "@/lib/editor/autosave";
import {
	Cloud,
	CloudOff,
	AlertCircle,
	Check,
	Loader2,
	Users,
	Wifi,
	WifiOff,
	Eye,
	Edit3,
	FileText,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for the EditorStatusBar component.
 */
interface EditorStatusBarProps {
	/** Word count */
	wordCount?: number;
	/** Character count */
	characterCount?: number;
	/** Autosave status */
	saveStatus?: AutosaveStatus;
	/** Autosave error details */
	saveError?: AutosaveError | null;
	/** Whether the editor is read-only */
	readOnly?: boolean;
	/** Current cursor position (line:column) */
	cursorPosition?: { line: number; column: number };
	/** Custom class for the container */
	className?: string;
	/** Callback when save status is clicked */
	onSaveStatusClick?: () => void;
	/** Callback when collaborators indicator is clicked */
	onCollaboratorsClick?: () => void;
}

/**
 * EditorStatusBar component - displays editor state and statistics.
 *
 * Shows:
 * - Save status (saving, saved, error, offline)
 * - Word and character count
 * - Active collaborators
 * - Connection status
 * - Read-only indicator
 * - Cursor position
 *
 * @example
 * <EditorStatusBar
 *   wordCount={1234}
 *   characterCount={5678}
 *   saveStatus="saved"
 * />
 */
export function EditorStatusBar({
	wordCount = 0,
	characterCount = 0,
	saveStatus = "idle",
	saveError = null,
	readOnly = false,
	cursorPosition,
	className,
	onSaveStatusClick,
	onCollaboratorsClick,
}: EditorStatusBarProps) {
	const isVisible = useEditorStore((s) => s.statusBar.isVisible);
	const preferences = useEditorStore((s) => s.preferences);
	const collaborators = useCollaborationStore((s) => s.collaborators);
	const connectionStatusRaw = useCollaborationStore((s) => s.status);

	// Filter active users
	const activeUsers = collaborators.filter(
		(c) => c.status === "active"
	);

	// Map status to connection indicator types
	const connectionStatus: "connected" | "connecting" | "disconnected" | "error" =
		connectionStatusRaw === "connecting" ? "connecting" :
		connectionStatusRaw === "disconnected" ? "disconnected" : "connected";

	if (!isVisible) return null;

	return (
		<div
			className={cn(
				"flex items-center justify-between px-3 py-1.5",
				"border-t border-gray-200 dark:border-gray-800",
				"bg-gray-50 dark:bg-gray-900",
				"text-xs text-gray-600 dark:text-gray-400",
				className
			)}
			role="status"
			aria-label="Editor status"
		>
			{/* Left section: Save status and word count */}
			<div className="flex items-center gap-4">
				{/* Save status */}
				<SaveStatusIndicator
					status={saveStatus}
					error={saveError}
					onClick={onSaveStatusClick}
				/>

				{/* Word count */}
				{preferences.showWordCount && (
					<div className="flex items-center gap-2">
						<span>
							{wordCount.toLocaleString()} word{wordCount !== 1 ? "s" : ""}
						</span>
						<span className="text-gray-400 dark:text-gray-600">|</span>
						<span>
							{characterCount.toLocaleString()} character
							{characterCount !== 1 ? "s" : ""}
						</span>
					</div>
				)}

				{/* Reading time estimate */}
				<ReadingTimeEstimate wordCount={wordCount} />
			</div>

			{/* Right section: Collaborators, connection, mode */}
			<div className="flex items-center gap-4">
				{/* Cursor position */}
				{cursorPosition && (
					<span className="tabular-nums">
						Ln {cursorPosition.line}, Col {cursorPosition.column}
					</span>
				)}

				{/* Active collaborators */}
				{activeUsers.length > 0 && (
					<CollaboratorsIndicator
						count={activeUsers.length}
						users={activeUsers.map((c) => c.name)}
						onClick={onCollaboratorsClick}
					/>
				)}

				{/* Connection status */}
				<ConnectionIndicator status={connectionStatus} />

				{/* Read-only indicator */}
				{readOnly && (
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
								<Eye className="h-3.5 w-3.5" />
								<span>Read-only</span>
							</div>
						</TooltipTrigger>
						<TooltipContent side="top">
							This document is read-only
						</TooltipContent>
					</Tooltip>
				)}

				{/* Document type indicator */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
							<FileText className="h-3.5 w-3.5" />
							<span>Rich Text</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="top">Document format</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}

/**
 * Save status indicator component.
 */
interface SaveStatusIndicatorProps {
	status: AutosaveStatus;
	error?: AutosaveError | null;
	onClick?: () => void;
}

function SaveStatusIndicator({
	status,
	error,
	onClick,
}: SaveStatusIndicatorProps) {
	const { icon: Icon, text, color, tooltip } = getSaveStatusDisplay(
		status,
		error
	);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					disabled={!onClick}
					className={cn(
						"flex items-center gap-1.5 transition-colors",
						color,
						onClick && "hover:opacity-80 cursor-pointer",
						!onClick && "cursor-default"
					)}
				>
					<Icon
						className={cn(
							"h-3.5 w-3.5",
							status === "saving" && "animate-spin"
						)}
					/>
					<span>{text}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-xs">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

function getSaveStatusDisplay(
	status: AutosaveStatus,
	error?: AutosaveError | null
): {
	icon: React.ComponentType<{ className?: string }>;
	text: string;
	color: string;
	tooltip: string;
} {
	switch (status) {
		case "saving":
			return {
				icon: Loader2,
				text: "Saving...",
				color: "text-blue-600 dark:text-blue-400",
				tooltip: "Saving changes to the server",
			};
		case "saved":
			return {
				icon: Check,
				text: "Saved",
				color: "text-green-600 dark:text-green-400",
				tooltip: "All changes saved",
			};
		case "pending":
			return {
				icon: Cloud,
				text: "Unsaved",
				color: "text-amber-600 dark:text-amber-400",
				tooltip: "Changes pending, will save shortly",
			};
		case "error":
			return {
				icon: AlertCircle,
				text: "Error",
				color: "text-red-600 dark:text-red-400",
				tooltip: error?.message ?? "Failed to save changes",
			};
		case "offline":
			return {
				icon: CloudOff,
				text: "Offline",
				color: "text-gray-500 dark:text-gray-400",
				tooltip: "Changes saved locally, will sync when online",
			};
		case "conflict":
			return {
				icon: AlertCircle,
				text: "Conflict",
				color: "text-red-600 dark:text-red-400",
				tooltip:
					"Document was modified elsewhere. Refresh to see the latest version.",
			};
		case "idle":
		default:
			return {
				icon: Cloud,
				text: "Ready",
				color: "text-gray-400 dark:text-gray-500",
				tooltip: "No unsaved changes",
			};
	}
}

/**
 * Collaborators indicator component.
 */
interface CollaboratorsIndicatorProps {
	count: number;
	users: string[];
	onClick?: () => void;
}

function CollaboratorsIndicator({
	count,
	users,
	onClick,
}: CollaboratorsIndicatorProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					disabled={!onClick}
					className={cn(
						"flex items-center gap-1.5 text-green-600 dark:text-green-400",
						onClick && "hover:opacity-80 cursor-pointer",
						!onClick && "cursor-default"
					)}
				>
					<Users className="h-3.5 w-3.5" />
					<span>
						{count} collaborator{count !== 1 ? "s" : ""}
					</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">
				<div className="space-y-1">
					<div className="font-medium">Active collaborators:</div>
					<ul className="list-disc list-inside text-xs">
						{users.slice(0, 5).map((name, i) => (
							<li key={i}>{name}</li>
						))}
						{users.length > 5 && (
							<li className="text-gray-400">
								+{users.length - 5} more
							</li>
						)}
					</ul>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Connection status indicator component.
 */
interface ConnectionIndicatorProps {
	status: "connected" | "connecting" | "disconnected" | "error";
}

function ConnectionIndicator({ status }: ConnectionIndicatorProps) {
	const config = getConnectionDisplay(status);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className={cn("flex items-center gap-1.5", config.color)}>
					<config.icon
						className={cn(
							"h-3.5 w-3.5",
							status === "connecting" && "animate-pulse"
						)}
					/>
					{status !== "connected" && <span>{config.text}</span>}
				</div>
			</TooltipTrigger>
			<TooltipContent side="top">{config.tooltip}</TooltipContent>
		</Tooltip>
	);
}

function getConnectionDisplay(
	status: "connected" | "connecting" | "disconnected" | "error"
): {
	icon: React.ComponentType<{ className?: string }>;
	text: string;
	color: string;
	tooltip: string;
} {
	switch (status) {
		case "connected":
			return {
				icon: Wifi,
				text: "",
				color: "text-green-500",
				tooltip: "Connected to server",
			};
		case "connecting":
			return {
				icon: Wifi,
				text: "Connecting...",
				color: "text-amber-500",
				tooltip: "Establishing connection...",
			};
		case "disconnected":
			return {
				icon: WifiOff,
				text: "Offline",
				color: "text-gray-400",
				tooltip: "Not connected. Working offline.",
			};
		case "error":
			return {
				icon: WifiOff,
				text: "Error",
				color: "text-red-500",
				tooltip: "Connection error. Attempting to reconnect...",
			};
	}
}

/**
 * Reading time estimate component.
 */
function ReadingTimeEstimate({ wordCount }: { wordCount: number }) {
	// Average reading speed: 200-250 words per minute
	const readingSpeed = 225;
	const minutes = Math.max(1, Math.ceil(wordCount / readingSpeed));

	if (wordCount < 50) return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="text-gray-400 dark:text-gray-500">
					~{minutes} min read
				</span>
			</TooltipTrigger>
			<TooltipContent side="top">
				Estimated reading time at {readingSpeed} words/minute
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Compact status bar for mobile or minimal mode.
 */
export function CompactStatusBar({
	saveStatus,
	wordCount,
	className,
}: {
	saveStatus: AutosaveStatus;
	wordCount: number;
	className?: string;
}) {
	const { icon: Icon, color } = getSaveStatusDisplay(saveStatus, null);

	return (
		<div
			className={cn(
				"flex items-center gap-2 px-2 py-1 text-xs",
				"text-gray-500 dark:text-gray-400",
				className
			)}
		>
			<Icon
				className={cn(
					"h-3 w-3",
					color,
					saveStatus === "saving" && "animate-spin"
				)}
			/>
			<span>{wordCount.toLocaleString()} words</span>
		</div>
	);
}

/**
 * Hook to calculate word and character count from text.
 */
export function useDocumentStats(text: string) {
	return React.useMemo(() => {
		const trimmed = text.trim();
		const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
		const characterCount = trimmed.length;
		const characterCountWithSpaces = text.length;

		return {
			wordCount,
			characterCount,
			characterCountWithSpaces,
		};
	}, [text]);
}

/**
 * Hook to track cursor position in editor.
 */
export function useCursorPosition(
	selection: { from: number; to: number } | null,
	text: string
): { line: number; column: number } | undefined {
	return React.useMemo(() => {
		if (!selection) return undefined;

		const textBefore = text.slice(0, selection.from);
		const lines = textBefore.split("\n");
		const line = lines.length;
		const column = (lines[lines.length - 1]?.length ?? 0) + 1;

		return { line, column };
	}, [selection, text]);
}
