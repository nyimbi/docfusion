/**
 * Documents Page - DocFusion
 *
 * A beautiful, editorial-inspired document gallery with
 * sophisticated filtering and view modes.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
	useDocuments,
	useDocumentSearch,
} from "@/lib/query/hooks/useDocuments";
import { useCreateDocument } from "@/lib/query/mutations/useDocumentMutation";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentSummary, DocumentStatus } from "@/lib/types/document";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { DocumentActions } from "@/components/documents/DocumentActions";
import {
	Plus,
	Search,
	FileText,
	Clock,
	LayoutGrid,
	List,
	Filter,
	Sparkles,
	SortAsc,
	ChevronDown,
	FolderOpen,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Documents list page with sophisticated UI.
 */
export default function DocumentsPage() {
	const router = useRouter();
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedQuery, setDebouncedQuery] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<
		DocumentStatus | "all"
	>("all");

	// Debounce search input
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Fetch documents - using conditional hooks properly
	const searchEnabled = debouncedQuery.length >= 2;
	const listQuery = useDocuments({
		status: statusFilter === "all" ? undefined : statusFilter,
		sortBy: "updatedAt",
		sortOrder: "desc",
		limit: 50,
	});
	const searchQueryResult = useDocumentSearch(debouncedQuery);

	// Get data from the appropriate query based on search mode
	const isLoading = searchEnabled ? searchQueryResult.isLoading : listQuery.isLoading;
	const error = searchEnabled ? searchQueryResult.error : listQuery.error;

	// Normalize the data - search returns DocumentSummary[], list returns DocumentListResponse
	const documents = searchEnabled
		? searchQueryResult.data ?? []
		: listQuery.data?.documents ?? [];

	// Create document mutation
	const createMutation = useCreateDocument();

	const handleCreateDocument = async () => {
		try {
			const newDoc = await createMutation.mutateAsync({
				title: "Untitled Document",
			});
			router.push(`/documents/${newDoc.id}`);
		} catch (err) {
			console.error("Failed to create document:", err);
		}
	};

	return (
		<div className="min-h-screen bg-[var(--background)]">
			{/* Hero Header */}
			<header className="relative overflow-hidden border-b border-[var(--border)]">
				{/* Subtle background pattern */}
				<div className="absolute inset-0 bg-dots opacity-50" />

				<div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
						<div className="animate-fade-up">
							<p className="text-overline text-[var(--accent-600)] mb-2">
								Your Workspace
							</p>
							<h1 className="heading-display heading-display-lg text-[var(--foreground)]">
								Documents
							</h1>
							<p className="mt-2 text-[var(--foreground-muted)] max-w-lg">
								Create, collaborate, and craft documents with AI-powered
								intelligence.
							</p>
						</div>

						<Button
							onClick={handleCreateDocument}
							isLoading={createMutation.isPending}
							variant="accent"
							size="lg"
							className="animate-fade-up stagger-2 self-start sm:self-auto"
						>
							<Plus className="h-5 w-5" />
							New Document
						</Button>
					</div>
				</div>
			</header>

			{/* Toolbar */}
			<div className="sticky top-0 z-20 bg-[var(--background)]/95 backdrop-blur-sm border-b border-[var(--border)]">
				<div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-4">
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						{/* Search */}
						<div className="relative flex-1 max-w-md animate-fade-up stagger-1">
							<Input
								type="search"
								placeholder="Search documents..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								startIcon={
									<Search className="h-4 w-4 text-[var(--foreground-subtle)]" />
								}
								className="w-full"
							/>
						</div>

						{/* Filters and view toggle */}
						<div className="flex items-center gap-3 animate-fade-up stagger-2">
							{/* Status filter */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										<Filter className="h-4 w-4" />
										<span className="hidden sm:inline">
											{statusFilter === "all"
												? "All Status"
												: statusFilter.replace("_", " ")}
										</span>
										<ChevronDown className="h-3 w-3 opacity-50" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-40">
									<DropdownMenuItem onClick={() => setStatusFilter("all")}>
										All Status
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => setStatusFilter("draft")}>
										<StatusIndicator status="draft" />
										Draft
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setStatusFilter("in_review")}
									>
										<StatusIndicator status="in_review" />
										In Review
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setStatusFilter("approved")}
									>
										<StatusIndicator status="approved" />
										Approved
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setStatusFilter("archived")}
									>
										<StatusIndicator status="archived" />
										Archived
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							{/* View toggle */}
							<div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border)] p-0.5 bg-[var(--background-subtle)]">
								<button
									type="button"
									onClick={() => setViewMode("grid")}
									className={cn(
										"p-2 rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)]",
										viewMode === "grid"
											? "bg-[var(--background)] shadow-[var(--shadow-xs)] text-[var(--foreground)]"
											: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
									)}
									aria-label="Grid view"
									aria-pressed={viewMode === "grid"}
								>
									<LayoutGrid className="h-4 w-4" />
								</button>
								<button
									type="button"
									onClick={() => setViewMode("list")}
									className={cn(
										"p-2 rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)]",
										viewMode === "list"
											? "bg-[var(--background)] shadow-[var(--shadow-xs)] text-[var(--foreground)]"
											: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
									)}
									aria-label="List view"
									aria-pressed={viewMode === "list"}
								>
									<List className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8">
				{isLoading ? (
					<DocumentGridSkeleton count={8} />
				) : error ? (
					<ErrorState onRetry={() => window.location.reload()} />
				) : documents.length === 0 ? (
					<EmptyState
						searchQuery={debouncedQuery}
						onCreateDocument={handleCreateDocument}
					/>
				) : viewMode === "grid" ? (
					<DocumentGrid documents={documents} />
				) : (
					<DocumentList documents={documents} />
				)}
			</main>
		</div>
	);
}

/**
 * Status indicator dot.
 */
function StatusIndicator({ status }: { status: DocumentStatus }) {
	const colors: Record<DocumentStatus, string> = {
		draft: "bg-[var(--ink-400)]",
		in_review: "bg-[var(--warning-500)]",
		approved: "bg-[var(--success-500)]",
		archived: "bg-[var(--ink-300)]",
	};

	return (
		<span
			className={cn("w-2 h-2 rounded-full mr-2", colors[status])}
			aria-hidden="true"
		/>
	);
}

/**
 * Empty state component.
 */
function EmptyState({
	searchQuery,
	onCreateDocument,
}: {
	searchQuery: string;
	onCreateDocument: () => void;
}) {
	if (searchQuery) {
		return (
			<div className="text-center py-20 animate-fade-up">
				<div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--background-muted)] flex items-center justify-center">
					<Search className="h-8 w-8 text-[var(--foreground-subtle)]" />
				</div>
				<h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
					No results found
				</h3>
				<p className="text-[var(--foreground-muted)] max-w-sm mx-auto">
					No documents match "{searchQuery}". Try adjusting your search or
					create a new document.
				</p>
			</div>
		);
	}

	return (
		<div className="text-center py-20 animate-fade-up">
			<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent-100)] to-[var(--accent-200)] flex items-center justify-center">
				<FolderOpen className="h-10 w-10 text-[var(--accent-600)]" />
			</div>
			<h3 className="heading-display text-2xl text-[var(--foreground)] mb-3">
				Start your first document
			</h3>
			<p className="text-[var(--foreground-muted)] max-w-md mx-auto mb-8">
				Create beautifully crafted documents with AI-powered writing assistance,
				real-time collaboration, and intelligent compliance checking.
			</p>
			<div className="flex items-center justify-center gap-4">
				<Button onClick={onCreateDocument} variant="accent" size="lg">
					<Plus className="h-5 w-5" />
					Create Document
				</Button>
				<Button variant="outline" size="lg" asChild>
					<Link href="/templates">
						<Sparkles className="h-5 w-5" />
						Browse Templates
					</Link>
				</Button>
			</div>
		</div>
	);
}

/**
 * Error state component.
 */
function ErrorState({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="text-center py-20 animate-fade-up">
			<div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--error-100)] flex items-center justify-center">
				<FileText className="h-8 w-8 text-[var(--error-500)]" />
			</div>
			<h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
				Unable to load documents
			</h3>
			<p className="text-[var(--foreground-muted)] max-w-sm mx-auto mb-6">
				Something went wrong while fetching your documents. Please try again.
			</p>
			<Button variant="outline" onClick={onRetry}>
				Try Again
			</Button>
		</div>
	);
}

/**
 * Document grid view.
 */
function DocumentGrid({ documents }: { documents: DocumentSummary[] }) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
			{documents.map((doc, index) => (
				<div
					key={doc.id}
					className="animate-fade-up opacity-0"
					style={{ animationDelay: `${Math.min(index * 50, 300)}ms`, animationFillMode: 'forwards' }}
				>
					<DocumentCard document={doc} />
				</div>
			))}
		</div>
	);
}

/**
 * Document list view.
 */
function DocumentList({ documents }: { documents: DocumentSummary[] }) {
	return (
		<div className="space-y-2">
			{documents.map((doc, index) => (
				<div
					key={doc.id}
					className="animate-fade-up opacity-0"
					style={{ animationDelay: `${Math.min(index * 30, 200)}ms`, animationFillMode: 'forwards' }}
				>
					<DocumentListItem document={doc} />
				</div>
			))}
		</div>
	);
}

/**
 * Document card component for grid view.
 */
function DocumentCard({ document }: { document: DocumentSummary }) {
	return (
		<Card interactive className="h-full flex flex-col group">
			<Link href={`/documents/${document.id}`} className="flex-1 flex flex-col">
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<CardTitle className="text-base line-clamp-2 group-hover:text-[var(--accent-600)] transition-colors">
							{document.title}
						</CardTitle>
					</div>
					<div className="mt-2">
						<StatusBadge status={document.status} />
					</div>
				</CardHeader>
				<CardContent className="flex-1 pb-3">
					{document.excerpt ? (
						<p className="text-sm text-[var(--foreground-muted)] line-clamp-3">
							{document.excerpt}
						</p>
					) : (
						<p className="text-sm text-[var(--foreground-subtle)] italic">
							No content yet
						</p>
					)}
				</CardContent>
			</Link>
			<CardFooter className="pt-3 border-t border-[var(--border)]">
				<div className="flex items-center justify-between w-full text-xs text-[var(--foreground-muted)]">
					<div className="flex items-center gap-3">
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatRelativeTime(document.updatedAt)}
						</span>
						<span className="flex items-center gap-1">
							<FileText className="h-3 w-3" />
							{document.wordCount.toLocaleString()} words
						</span>
					</div>
					<DocumentActions document={document} showNavigationLinks={false} />
				</div>
			</CardFooter>
		</Card>
	);
}

/**
 * Document list item component for list view.
 */
function DocumentListItem({ document }: { document: DocumentSummary }) {
	return (
		<div
			className={cn(
				"flex items-center gap-4 p-4 rounded-[var(--radius-lg)]",
				"border border-[var(--border)] bg-[var(--background)]",
				"hover:shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)]",
				"transition-all duration-[var(--transition-base)] group"
			)}
		>
			<div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--background-muted)] flex items-center justify-center flex-shrink-0">
				<FileText className="h-5 w-5 text-[var(--foreground-muted)]" />
			</div>

			<Link href={`/documents/${document.id}`} className="flex-1 min-w-0">
				<h3 className="font-medium text-[var(--foreground)] truncate group-hover:text-[var(--accent-600)] transition-colors">
					{document.title}
				</h3>
				<div className="flex items-center gap-3 mt-1 text-sm text-[var(--foreground-muted)]">
					<StatusBadge status={document.status} />
					<span>{document.wordCount.toLocaleString()} words</span>
					<span>{formatRelativeTime(document.updatedAt)}</span>
				</div>
			</Link>

			{document.tags.length > 0 && (
				<div className="hidden md:flex items-center gap-1.5">
					{document.tags.slice(0, 2).map((tag) => (
						<span
							key={tag}
							className="px-2 py-0.5 text-xs bg-[var(--background-muted)] text-[var(--foreground-muted)] rounded-full"
						>
							{tag}
						</span>
					))}
					{document.tags.length > 2 && (
						<span className="text-xs text-[var(--foreground-subtle)]">
							+{document.tags.length - 2}
						</span>
					)}
				</div>
			)}

			<DocumentActions document={document} showNavigationLinks={false} />
		</div>
	);
}

/**
 * Grid skeleton for loading state.
 */
function DocumentGridSkeleton({ count = 8 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
			{Array.from({ length: count }).map((_, i) => (
				<Card key={i} className="overflow-hidden">
					<CardHeader className="pb-2">
						<Skeleton className="h-5 w-3/4" />
						<Skeleton className="h-5 w-16 mt-2" />
					</CardHeader>
					<CardContent className="pb-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3 mt-2" />
					</CardContent>
					<CardFooter className="pt-3 border-t border-[var(--border)]">
						<div className="flex gap-3">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-16" />
						</div>
					</CardFooter>
				</Card>
			))}
		</div>
	);
}
