/**
 * Search results display component for DocFusion.
 *
 * Renders a list of search results with type indicators,
 * excerpts, and navigation links.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { DocumentSummary } from "@/lib/types/document";
import type { TemplateSummary } from "@/lib/types/template";
import {
	FileText,
	LayoutTemplate,
	Clock,
	User,
	Tag,
	Loader2,
	Search,
	ArrowRight,
} from "lucide-react";

/**
 * Combined search result type.
 */
export interface SearchResultItem {
	id: string;
	title: string;
	type: "document" | "template";
	excerpt?: string;
	updatedAt: string;
	tags?: string[];
	author?: string;
}

/**
 * Props for SearchResults component.
 */
export interface SearchResultsProps {
	/** Search query string */
	query: string;
	/** Document search results */
	documents?: DocumentSummary[];
	/** Template search results */
	templates?: TemplateSummary[];
	/** Whether results are loading */
	isLoading?: boolean;
	/** Error message if search failed */
	error?: string;
	/** Callback when result is clicked */
	onResultClick?: (result: SearchResultItem) => void;
	/** Maximum results to show per type */
	maxResultsPerType?: number;
	/** Optional className for styling */
	className?: string;
}

/**
 * Search results display component.
 *
 * @example
 * ```tsx
 * <SearchResults
 *   query={searchQuery}
 *   documents={documentResults?.documents}
 *   templates={templateResults?.templates}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function SearchResults({
	query,
	documents = [],
	templates = [],
	isLoading = false,
	error,
	onResultClick,
	maxResultsPerType = 5,
	className,
}: SearchResultsProps) {
	const hasQuery = query.length >= 2;
	const hasDocuments = documents.length > 0;
	const hasTemplates = templates.length > 0;
	const hasResults = hasDocuments || hasTemplates;
	const totalResults = documents.length + templates.length;

	// Error state
	if (error) {
		return (
			<div className={cn("text-center py-8", className)}>
				<p className="text-red-500 dark:text-red-400">{error}</p>
			</div>
		);
	}

	// Loading state
	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center py-8", className)}>
				<Loader2 className="h-6 w-6 animate-spin text-blue-500" />
				<span className="ml-2 text-gray-500">Searching...</span>
			</div>
		);
	}

	// No query state
	if (!hasQuery) {
		return (
			<div className={cn("text-center py-8 text-gray-500", className)}>
				<Search className="h-8 w-8 mx-auto mb-3 text-gray-400" />
				<p>Enter at least 2 characters to search</p>
			</div>
		);
	}

	// No results state
	if (!hasResults) {
		return (
			<div className={cn("text-center py-8 text-gray-500", className)}>
				<Search className="h-8 w-8 mx-auto mb-3 text-gray-400" />
				<p>No results found for "{query}"</p>
				<p className="text-sm mt-1">Try different keywords</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Results summary */}
			<div className="flex items-center justify-between text-sm text-gray-500">
				<span>
					Found {totalResults} result{totalResults !== 1 ? "s" : ""} for "{query}"
				</span>
			</div>

			{/* Document results */}
			{hasDocuments && (
				<ResultSection
					title="Documents"
					icon={FileText}
					iconColor="text-blue-600 dark:text-blue-400"
					bgColor="bg-blue-100 dark:bg-blue-900/30"
				>
					{documents.slice(0, maxResultsPerType).map((doc) => (
						<DocumentResultItem
							key={doc.id}
							document={doc}
							onClick={() =>
								onResultClick?.({
									id: doc.id,
									title: doc.title,
									type: "document",
									excerpt: doc.excerpt,
									updatedAt: doc.updatedAt,
									tags: doc.tags,
								})
							}
						/>
					))}
					{documents.length > maxResultsPerType && (
						<ShowMoreLink
							href={`/documents?search=${encodeURIComponent(query)}`}
							count={documents.length - maxResultsPerType}
						/>
					)}
				</ResultSection>
			)}

			{/* Template results */}
			{hasTemplates && (
				<ResultSection
					title="Templates"
					icon={LayoutTemplate}
					iconColor="text-purple-600 dark:text-purple-400"
					bgColor="bg-purple-100 dark:bg-purple-900/30"
				>
					{templates.slice(0, maxResultsPerType).map((template) => (
						<TemplateResultItem
							key={template.id}
							template={template}
							onClick={() =>
								onResultClick?.({
									id: template.id,
									title: template.name,
									type: "template",
									excerpt: template.description,
									updatedAt: template.updatedAt,
									tags: template.tags,
								})
							}
						/>
					))}
					{templates.length > maxResultsPerType && (
						<ShowMoreLink
							href={`/templates?search=${encodeURIComponent(query)}`}
							count={templates.length - maxResultsPerType}
						/>
					)}
				</ResultSection>
			)}
		</div>
	);
}

/**
 * Result section wrapper.
 */
function ResultSection({
	title,
	icon: Icon,
	iconColor,
	bgColor,
	children,
}: {
	title: string;
	icon: React.ElementType;
	iconColor: string;
	bgColor: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-center gap-2 mb-3">
				<div className={cn("p-1.5 rounded-lg", bgColor)}>
					<Icon className={cn("h-4 w-4", iconColor)} />
				</div>
				<h3 className="font-medium text-gray-900 dark:text-white">
					{title}
				</h3>
			</div>
			<div className="space-y-2">{children}</div>
		</div>
	);
}

/**
 * Document search result item.
 */
function DocumentResultItem({
	document,
	onClick,
}: {
	document: DocumentSummary;
	onClick?: () => void;
}) {
	return (
		<Link
			href={`/documents/${document.id}`}
			className={cn(
				"block p-3 rounded-lg border bg-white dark:bg-gray-900",
				"hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm",
				"transition-all group"
			)}
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<FileText className="h-5 w-5 mt-0.5 text-gray-400 flex-shrink-0" />
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
						{document.title}
					</h4>
					{document.excerpt && (
						<p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
							{document.excerpt}
						</p>
					)}
					<div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatRelativeTime(document.updatedAt)}
						</span>
						{document.ownerName && (
							<span className="flex items-center gap-1">
								<User className="h-3 w-3" />
								{document.ownerName}
							</span>
						)}
						{document.tags.length > 0 && (
							<span className="flex items-center gap-1">
								<Tag className="h-3 w-3" />
								{document.tags.slice(0, 2).join(", ")}
								{document.tags.length > 2 && ` +${document.tags.length - 2}`}
							</span>
						)}
					</div>
				</div>
				<ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
			</div>
		</Link>
	);
}

/**
 * Template search result item.
 */
function TemplateResultItem({
	template,
	onClick,
}: {
	template: TemplateSummary;
	onClick?: () => void;
}) {
	return (
		<Link
			href={`/templates/${template.id}`}
			className={cn(
				"block p-3 rounded-lg border bg-white dark:bg-gray-900",
				"hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-sm",
				"transition-all group"
			)}
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<LayoutTemplate className="h-5 w-5 mt-0.5 text-gray-400 flex-shrink-0" />
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">
						{template.name}
					</h4>
					{template.description && (
						<p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
							{template.description}
						</p>
					)}
					<div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatRelativeTime(template.updatedAt)}
						</span>
						{template.useCount !== undefined && (
							<span>Used {template.useCount} times</span>
						)}
						{template.tags.length > 0 && (
							<span className="flex items-center gap-1">
								<Tag className="h-3 w-3" />
								{template.tags.slice(0, 2).join(", ")}
								{template.tags.length > 2 && ` +${template.tags.length - 2}`}
							</span>
						)}
					</div>
				</div>
				<ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
			</div>
		</Link>
	);
}

/**
 * Show more link.
 */
function ShowMoreLink({ href, count }: { href: string; count: number }) {
	return (
		<Link
			href={href}
			className="flex items-center justify-center gap-2 p-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
		>
			<span>Show {count} more</span>
			<ArrowRight className="h-4 w-4" />
		</Link>
	);
}

