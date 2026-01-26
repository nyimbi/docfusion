/**
 * Document list item component for DocFusion.
 *
 * Displays a document in a compact row format for list views,
 * optimized for quick scanning and bulk actions.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { DocumentSummary, DocumentStatus } from "@/lib/types/document";
import { StatusBadge } from "./StatusBadge";
import { DocumentActions } from "./DocumentActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
	FileText,
	Clock,
	Tag,
	Users,
} from "lucide-react";

/**
 * Props for DocumentListItem component.
 */
export interface DocumentListItemProps {
	/** Document data to display */
	document: DocumentSummary;
	/** Whether the item is selected */
	selected?: boolean;
	/** Whether to show selection checkbox */
	selectable?: boolean;
	/** Callback when selection changes */
	onSelectionChange?: (selected: boolean) => void;
	/** Callback when document is clicked */
	onClick?: (document: DocumentSummary) => void;
	/** Callback when favorite action is triggered */
	onFavorite?: (document: DocumentSummary) => void;
	/** Callback when duplicate action is triggered */
	onDuplicate?: (document: DocumentSummary) => void;
	/** Callback when archive action is triggered */
	onArchive?: (document: DocumentSummary) => void;
	/** Callback when delete action is triggered */
	onDelete?: (document: DocumentSummary) => void;
	/** Optional className for styling */
	className?: string;
}

/**
 * Document list item component.
 *
 * @example
 * ```tsx
 * <DocumentListItem
 *   document={doc}
 *   selectable
 *   selected={selectedIds.includes(doc.id)}
 *   onSelectionChange={(selected) => toggleSelection(doc.id, selected)}
 * />
 * ```
 */
export const DocumentListItem = React.memo(function DocumentListItem({
	document,
	selected = false,
	selectable = false,
	onSelectionChange,
	onClick,
	onFavorite,
	onDuplicate,
	onArchive,
	onDelete,
	className,
}: DocumentListItemProps) {
	const handleCheckboxClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	return (
		<div
			className={cn(
				"flex items-center gap-4 p-4 rounded-lg border bg-white dark:bg-gray-950",
				"hover:shadow-sm transition-shadow group",
				selected && "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10",
				className
			)}
		>
			{/* Selection checkbox */}
			{selectable && (
				<div onClick={handleCheckboxClick}>
					<Checkbox
						checked={selected}
						onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
						aria-label={`Select ${document.title}`}
					/>
				</div>
			)}

			{/* Document icon */}
			<FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />

			{/* Document info */}
			<Link
				href={`/documents/${document.id}`}
				className="flex-1 min-w-0"
				onClick={() => onClick?.(document)}
			>
				<h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
					{document.title}
				</h3>
				<div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
					<StatusBadge status={document.status} />
					<span>{document.wordCount} words</span>
					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{formatRelativeTime(document.updatedAt)}
					</span>
					{document.activeCollaborators && document.activeCollaborators > 0 && (
						<span className="flex items-center gap-1 text-blue-500">
							<Users className="h-3 w-3" />
							{document.activeCollaborators} editing
						</span>
					)}
				</div>
			</Link>

			{/* Tags */}
			{document.tags.length > 0 && (
				<div className="hidden md:flex items-center gap-1">
					{document.tags.slice(0, 2).map((tag) => (
						<span
							key={tag}
							className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded"
						>
							<Tag className="h-3 w-3" />
							{tag}
						</span>
					))}
					{document.tags.length > 2 && (
						<span className="text-xs text-gray-400">
							+{document.tags.length - 2}
						</span>
					)}
				</div>
			)}

			{/* Actions */}
			<DocumentActions
				document={document}
				onFavorite={onFavorite}
				onDuplicate={onDuplicate}
				onArchive={onArchive}
				onDelete={onDelete}
			/>
		</div>
	);
});

DocumentListItem.displayName = "DocumentListItem";

/**
 * Skeleton for DocumentListItem loading state.
 */
export function DocumentListItemSkeleton({
	selectable = false,
	className,
}: {
	selectable?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-4 p-4 rounded-lg border bg-white dark:bg-gray-950",
				className
			)}
		>
			{selectable && <Skeleton className="h-4 w-4 rounded" />}
			<Skeleton className="h-8 w-8 rounded" />
			<div className="flex-1 space-y-2">
				<Skeleton className="h-5 w-1/3" />
				<div className="flex gap-3">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-24" />
				</div>
			</div>
			<Skeleton className="h-4 w-4 rounded" />
		</div>
	);
}
