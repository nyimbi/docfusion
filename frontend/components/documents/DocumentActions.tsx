/**
 * Document actions dropdown component for DocFusion.
 *
 * Provides a consistent actions menu for documents across
 * grid views, list views, and other document displays.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import type { DocumentSummary } from "@/lib/types/document";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	MoreVertical,
	Trash2,
	Copy,
	Archive,
	Star,
	Edit3,
	Eye,
} from "lucide-react";

/**
 * Props for DocumentActions component.
 */
export interface DocumentActionsProps {
	/** Document to perform actions on */
	document: DocumentSummary;
	/** Callback when favorite action is triggered */
	onFavorite?: (document: DocumentSummary) => void;
	/** Callback when duplicate action is triggered */
	onDuplicate?: (document: DocumentSummary) => void;
	/** Callback when archive action is triggered */
	onArchive?: (document: DocumentSummary) => void;
	/** Callback when delete action is triggered */
	onDelete?: (document: DocumentSummary) => void;
	/** Whether to show Edit/View navigation links (default: true) */
	showNavigationLinks?: boolean;
	/** Custom trigger button className */
	triggerClassName?: string;
}

/**
 * Document actions dropdown.
 *
 * Renders a dropdown menu with common document actions like
 * edit, view, favorite, duplicate, archive, and delete.
 *
 * @example
 * ```tsx
 * // Full featured with callbacks
 * <DocumentActions
 *   document={doc}
 *   onFavorite={(d) => handleFavorite(d)}
 *   onDelete={(d) => handleDelete(d)}
 * />
 *
 * // Simple version without callbacks
 * <DocumentActions document={doc} />
 *
 * // Without navigation links
 * <DocumentActions document={doc} showNavigationLinks={false} />
 * ```
 */
export function DocumentActions({
	document,
	onFavorite,
	onDuplicate,
	onArchive,
	onDelete,
	showNavigationLinks = true,
	triggerClassName,
}: DocumentActionsProps) {
	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild onClick={handleClick}>
				<button
					type="button"
					className={
						triggerClassName ??
						"p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
					}
					aria-label="Document actions"
				>
					<MoreVertical className="h-4 w-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onClick={handleClick}>
				{showNavigationLinks && (
					<>
						<DropdownMenuItem asChild>
							<Link href={`/documents/${document.id}`}>
								<Edit3 className="h-4 w-4 mr-2" />
								Edit
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link href={`/documents/${document.id}?mode=view`}>
								<Eye className="h-4 w-4 mr-2" />
								View
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem onClick={() => onFavorite?.(document)}>
					<Star className="h-4 w-4 mr-2" />
					Add to favorites
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onDuplicate?.(document)}>
					<Copy className="h-4 w-4 mr-2" />
					Duplicate
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => onArchive?.(document)}>
					<Archive className="h-4 w-4 mr-2" />
					Archive
				</DropdownMenuItem>
				<DropdownMenuItem
					className="text-red-600 dark:text-red-400"
					onClick={() => onDelete?.(document)}
				>
					<Trash2 className="h-4 w-4 mr-2" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
