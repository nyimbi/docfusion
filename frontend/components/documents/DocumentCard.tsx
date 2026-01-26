/**
 * Document card component for DocFusion.
 *
 * Displays a document in a card format for grid views,
 * showing title, status, excerpt, and metadata.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DocumentSummary, DocumentStatus } from "@/lib/types/document";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	FileText,
	Clock,
	MoreVertical,
	Trash2,
	Copy,
	Archive,
	Star,
	Edit3,
	Eye,
	Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Props for DocumentCard component.
 */
export interface DocumentCardProps {
	/** Document data to display */
	document: DocumentSummary;
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
 * Document card component.
 *
 * @example
 * ```tsx
 * <DocumentCard
 *   document={doc}
 *   onFavorite={(d) => console.log('Favorite', d.id)}
 *   onDelete={(d) => console.log('Delete', d.id)}
 * />
 * ```
 */
export function DocumentCard({
	document,
	onClick,
	onFavorite,
	onDuplicate,
	onArchive,
	onDelete,
	className,
}: DocumentCardProps) {
	return (
		<Card
			className={cn(
				"hover:shadow-md transition-shadow group cursor-pointer",
				className
			)}
		>
			<Link
				href={`/documents/${document.id}`}
				onClick={() => onClick?.(document)}
			>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<CardTitle className="text-base line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
							{document.title}
						</CardTitle>
						<DocumentActions
							document={document}
							onFavorite={onFavorite}
							onDuplicate={onDuplicate}
							onArchive={onArchive}
							onDelete={onDelete}
						/>
					</div>
					<CardDescription className="text-xs">
						<StatusBadge status={document.status} />
					</CardDescription>
				</CardHeader>
				<CardContent className="pb-2">
					{document.excerpt && (
						<p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
							{document.excerpt}
						</p>
					)}
				</CardContent>
				<CardFooter className="text-xs text-gray-400 flex items-center gap-3">
					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{formatRelativeTime(document.updatedAt)}
					</span>
					<span className="flex items-center gap-1">
						<FileText className="h-3 w-3" />
						{document.wordCount} words
					</span>
					{document.activeCollaborators && document.activeCollaborators > 0 && (
						<span className="flex items-center gap-1">
							<Users className="h-3 w-3" />
							{document.activeCollaborators}
						</span>
					)}
				</CardFooter>
			</Link>
		</Card>
	);
}

/**
 * Document actions dropdown.
 */
function DocumentActions({
	document,
	onFavorite,
	onDuplicate,
	onArchive,
	onDelete,
}: {
	document: DocumentSummary;
	onFavorite?: (document: DocumentSummary) => void;
	onDuplicate?: (document: DocumentSummary) => void;
	onArchive?: (document: DocumentSummary) => void;
	onDelete?: (document: DocumentSummary) => void;
}) {
	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild onClick={handleClick}>
				<button
					type="button"
					className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
					aria-label="Document actions"
				>
					<MoreVertical className="h-4 w-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onClick={handleClick}>
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

/**
 * Status badge component.
 */
function StatusBadge({ status }: { status: DocumentStatus }) {
	const config: Record<DocumentStatus, { bg: string; text: string; label: string }> = {
		draft: {
			bg: "bg-gray-100 dark:bg-gray-800",
			text: "text-gray-600 dark:text-gray-400",
			label: "Draft",
		},
		in_review: {
			bg: "bg-amber-100 dark:bg-amber-900/30",
			text: "text-amber-700 dark:text-amber-400",
			label: "In Review",
		},
		approved: {
			bg: "bg-green-100 dark:bg-green-900/30",
			text: "text-green-700 dark:text-green-400",
			label: "Approved",
		},
		archived: {
			bg: "bg-gray-100 dark:bg-gray-800",
			text: "text-gray-500 dark:text-gray-500",
			label: "Archived",
		},
	};

	const statusConfig = config[status];

	return (
		<span
			className={cn(
				"inline-flex px-2 py-0.5 text-xs font-medium rounded",
				statusConfig.bg,
				statusConfig.text
			)}
		>
			{statusConfig.label}
		</span>
	);
}

/**
 * Format relative time helper.
 */
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString();
}

/**
 * Skeleton for DocumentCard loading state.
 */
export function DocumentCardSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn("overflow-hidden", className)}>
			<CardHeader className="pb-2">
				<Skeleton className="h-5 w-3/4" />
				<Skeleton className="h-4 w-16 mt-2" />
			</CardHeader>
			<CardContent className="pb-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3 mt-2" />
			</CardContent>
			<CardFooter>
				<div className="flex gap-3">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-3 w-20" />
				</div>
			</CardFooter>
		</Card>
	);
}
