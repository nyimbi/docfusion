/**
 * Document card component for DocFusion.
 *
 * Displays a document in a card format for grid views,
 * showing title, status, excerpt, and metadata.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { DocumentSummary, DocumentStatus } from "@/lib/types/document";
import { StatusBadge } from "./StatusBadge";
import { DocumentActions } from "./DocumentActions";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import {
	FileText,
	Clock,
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
export const DocumentCard = React.memo(function DocumentCard({
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
});

DocumentCard.displayName = "DocumentCard";

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
