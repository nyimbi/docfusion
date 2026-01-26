/**
 * Recent documents component for DocFusion.
 *
 * Displays a list of recently accessed documents
 * for quick navigation from the dashboard.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useDocuments } from "@/lib/query/hooks/useDocuments";
import type { DocumentSummary, DocumentStatus } from "@/lib/types/document";
import { StatusBadge } from "./StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
} from "@/components/ui/card";
import {
	FileText,
	Clock,
	ArrowRight,
	Eye,
	Edit3,
	Users,
	MoreVertical,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Props for RecentDocuments component.
 */
export interface RecentDocumentsProps {
	/** Maximum number of documents to show */
	limit?: number;
	/** Title for the section */
	title?: string;
	/** Whether to show the "View All" link */
	showViewAll?: boolean;
	/** View mode: compact shows less info, full shows more */
	variant?: "compact" | "full";
	/** Optional className for styling */
	className?: string;
}

/**
 * Recent documents component.
 *
 * @example
 * ```tsx
 * // Dashboard usage
 * <RecentDocuments limit={5} title="Recent Documents" showViewAll />
 *
 * // Sidebar usage
 * <RecentDocuments limit={3} variant="compact" />
 * ```
 */
export function RecentDocuments({
	limit = 5,
	title = "Recent Documents",
	showViewAll = true,
	variant = "full",
	className,
}: RecentDocumentsProps) {
	const { data, isLoading, error } = useDocuments({
		sortBy: "lastAccessedAt",
		sortOrder: "desc",
		limit,
	});

	const documents = data?.documents ?? [];

	// Loading state
	if (isLoading) {
		return (
			<RecentDocumentsContainer
				title={title}
				showViewAll={showViewAll}
				className={className}
			>
				{Array.from({ length: limit }).map((_, i) => (
					<RecentDocumentSkeleton key={i} variant={variant} />
				))}
			</RecentDocumentsContainer>
		);
	}

	// Error state
	if (error) {
		return (
			<RecentDocumentsContainer
				title={title}
				showViewAll={showViewAll}
				className={className}
			>
				<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
					Failed to load recent documents
				</p>
			</RecentDocumentsContainer>
		);
	}

	// Empty state
	if (documents.length === 0) {
		return (
			<RecentDocumentsContainer
				title={title}
				showViewAll={showViewAll}
				className={className}
			>
				<EmptyRecentDocuments />
			</RecentDocumentsContainer>
		);
	}

	return (
		<RecentDocumentsContainer
			title={title}
			showViewAll={showViewAll}
			className={className}
		>
			<div className={cn(variant === "compact" ? "space-y-1" : "space-y-2")}>
				{documents.map((doc) => (
					<RecentDocumentItem
						key={doc.id}
						document={doc}
						variant={variant}
					/>
				))}
			</div>
		</RecentDocumentsContainer>
	);
}

/**
 * Container for recent documents section.
 */
function RecentDocumentsContainer({
	title,
	showViewAll,
	className,
	children,
}: {
	title: string;
	showViewAll: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<Card className={cn("overflow-hidden", className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold">
						{title}
					</CardTitle>
					{showViewAll && (
						<Link
							href="/documents"
							className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
						>
							View all
							<ArrowRight className="h-4 w-4" />
						</Link>
					)}
				</div>
			</CardHeader>
			<CardContent className="pt-0">{children}</CardContent>
		</Card>
	);
}

/**
 * Single recent document item.
 */
function RecentDocumentItem({
	document,
	variant,
}: {
	document: DocumentSummary;
	variant: "compact" | "full";
}) {
	const isCompact = variant === "compact";

	return (
		<Link
			href={`/documents/${document.id}`}
			className={cn(
				"group flex items-start gap-3 rounded-lg transition-colors",
				isCompact
					? "p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
					: "p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 border dark:border-gray-800"
			)}
		>
			{/* Document icon */}
			<div
				className={cn(
					"flex-shrink-0 rounded-lg flex items-center justify-center",
					isCompact
						? "h-8 w-8 bg-gray-100 dark:bg-gray-800"
						: "h-10 w-10 bg-blue-50 dark:bg-blue-900/20"
				)}
			>
				<FileText
					className={cn(
						isCompact
							? "h-4 w-4 text-gray-500"
							: "h-5 w-5 text-blue-600 dark:text-blue-400"
					)}
				/>
			</div>

			{/* Document info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<h4
						className={cn(
							"font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400",
							isCompact
								? "text-sm text-gray-800 dark:text-gray-200"
								: "text-gray-900 dark:text-white"
						)}
					>
						{document.title}
					</h4>
					{!isCompact && <StatusBadge status={document.status} />}
				</div>

				<div
					className={cn(
						"flex items-center gap-3 text-gray-500 dark:text-gray-400",
						isCompact ? "text-xs mt-0.5" : "text-sm mt-1"
					)}
				>
					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{formatRelativeTime(document.lastAccessedAt ?? document.updatedAt)}
					</span>

					{!isCompact && (
						<>
							{document.activeCollaborators && document.activeCollaborators > 0 && (
								<span className="flex items-center gap-1">
									<Users className="h-3 w-3" />
									{document.activeCollaborators} editing
								</span>
							)}
							<span>{document.wordCount} words</span>
						</>
					)}
				</div>
			</div>

			{/* Actions */}
			{!isCompact && (
				<div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
					<DocumentQuickActions document={document} />
				</div>
			)}
		</Link>
	);
}

/**
 * Quick actions dropdown for document.
 */
function DocumentQuickActions({ document }: { document: DocumentSummary }) {
	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild onClick={handleClick}>
				<button
					type="button"
					className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
					aria-label="Document actions"
				>
					<MoreVertical className="h-4 w-4 text-gray-400" />
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
			</DropdownMenuContent>
		</DropdownMenu>
	);
}


/**
 * Skeleton for loading state.
 */
function RecentDocumentSkeleton({ variant }: { variant: "compact" | "full" }) {
	const isCompact = variant === "compact";

	return (
		<div
			className={cn(
				"flex items-start gap-3",
				isCompact ? "p-2" : "p-3 border rounded-lg dark:border-gray-800"
			)}
		>
			<Skeleton className={cn(isCompact ? "h-8 w-8" : "h-10 w-10", "rounded-lg")} />
			<div className="flex-1 space-y-2">
				<Skeleton className={cn(isCompact ? "h-4 w-3/4" : "h-5 w-2/3")} />
				<Skeleton className={cn(isCompact ? "h-3 w-1/2" : "h-4 w-1/3")} />
			</div>
		</div>
	);
}

/**
 * Empty state component.
 */
function EmptyRecentDocuments() {
	return (
		<div className="text-center py-6">
			<FileText className="h-10 w-10 mx-auto text-gray-400 mb-3" />
			<p className="text-sm text-gray-500 dark:text-gray-400">
				No recent documents
			</p>
			<Link
				href="/documents/new"
				className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
			>
				Create your first document
				<ArrowRight className="h-4 w-4" />
			</Link>
		</div>
	);
}

