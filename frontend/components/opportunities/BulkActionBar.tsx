"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
	CheckSquare,
	Star,
	Target,
	X,
	BookmarkPlus,
	ArrowUp,
	ArrowDown,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

export interface BulkActionBarProps {
	count: number;
	onAction: (action: string) => void;
	onClear: () => void;
}

interface ActionButtonProps {
	onClick: () => void;
	icon: React.ReactNode;
	children: React.ReactNode;
}

// ============================================================================
// ActionButton
// ============================================================================

function ActionButton({ onClick, icon, children }: ActionButtonProps) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm",
				"text-muted-foreground hover:text-foreground hover:bg-accent",
				"transition-all duration-150"
			)}
		>
			{icon}
			{children}
		</button>
	);
}

// ============================================================================
// BulkActionBar
// ============================================================================

export const BulkActionBar = React.memo(function BulkActionBar({
	count,
	onAction,
	onClear,
}: BulkActionBarProps) {
	return (
		<div className="flex items-center gap-3 mt-3 pt-3 border-t border-border animate-fade-up">
			<span className="text-sm text-primary font-medium">{count} selected</span>

			<div className="flex items-center gap-1">
				<ActionButton
					onClick={() => onAction("mark-reviewed")}
					icon={<CheckSquare className="w-4 h-4" />}
				>
					Reviewed
				</ActionButton>
				<ActionButton onClick={() => onAction("add-shortlist")} icon={<BookmarkPlus className="w-4 h-4" />}>
					Shortlist
				</ActionButton>
				<ActionButton onClick={() => onAction("mark-interested")} icon={<Star className="w-4 h-4" />}>
					Interested
				</ActionButton>
				<ActionButton onClick={() => onAction("mark-pursuing")} icon={<Target className="w-4 h-4" />}>
					Pursuing
				</ActionButton>
				<ActionButton onClick={() => onAction("mark-declined")} icon={<X className="w-4 h-4" />}>
					Decline
				</ActionButton>
				<div className="w-px h-5 bg-border mx-1" />
				<ActionButton onClick={() => onAction("priority-high")} icon={<ArrowUp className="w-4 h-4" />}>
					High
				</ActionButton>
				<ActionButton onClick={() => onAction("priority-low")} icon={<ArrowDown className="w-4 h-4" />}>
					Low
				</ActionButton>
			</div>

			<div className="flex-1" />

			<button
				onClick={onClear}
				className="text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				Clear selection
			</button>
		</div>
	);
});
