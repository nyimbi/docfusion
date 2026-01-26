"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useDocuments, useDocumentSearch } from "@/lib/query/hooks/useDocuments";
import { useCreateDocument } from "@/lib/query/mutations/useDocumentMutation";
import { DocumentListSkeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Documents list page.
 *
 * Features:
 * - Grid and list view toggle
 * - Search and filter documents
 * - Sort by various fields
 * - Quick actions (duplicate, archive, delete)
 * - Create new document
 */
export default function DocumentsPage() {
	const router = useRouter();
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedQuery, setDebouncedQuery] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<DocumentStatus | "all">(
		"all"
	);

	// Debounce search input
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Fetch documents
	const { data, isLoading, error } = debouncedQuery.length >= 2
		? useDocumentSearch(debouncedQuery, {
				status: statusFilter === "all" ? undefined : statusFilter,
		  })
		: useDocuments({
				status: statusFilter === "all" ? undefined : statusFilter,
				sortBy: "updatedAt",
				sortOrder: "desc",
				limit: 50,
		  });

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

	const documents = data?.documents ?? [];

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<h1 className="text-xl font-semibold text-gray-900 dark:text-white">
							Documents
						</h1>
						<Button onClick={handleCreateDocument} disabled={createMutation.isPending}>
							<Plus className="h-4 w-4 mr-2" />
							New Document
						</Button>
					</div>
				</div>
			</header>

			{/* Toolbar */}
			<div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						{/* Search */}
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								type="search"
								placeholder="Search documents..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>

						{/* Filters and view toggle */}
						<div className="flex items-center gap-2">
							{/* Status filter */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										<Filter className="h-4 w-4 mr-2" />
										{statusFilter === "all" ? "All Status" : statusFilter}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem onClick={() => setStatusFilter("all")}>
										All Status
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => setStatusFilter("draft")}>
										Draft
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setStatusFilter("in_review")}>
										In Review
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setStatusFilter("approved")}>
										Approved
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setStatusFilter("archived")}>
										Archived
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							{/* View toggle */}
							<div className="flex items-center border rounded-lg overflow-hidden">
								<button
									type="button"
									onClick={() => setViewMode("grid")}
									className={cn(
										"p-2 transition-colors",
										viewMode === "grid"
											? "bg-gray-100 dark:bg-gray-800"
											: "hover:bg-gray-50 dark:hover:bg-gray-800"
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
										"p-2 transition-colors",
										viewMode === "list"
											? "bg-gray-100 dark:bg-gray-800"
											: "hover:bg-gray-50 dark:hover:bg-gray-800"
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
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{isLoading ? (
					<DocumentListSkeleton count={8} />
				) : error ? (
					<div className="text-center py-12">
						<p className="text-red-600 dark:text-red-400">
							Failed to load documents. Please try again.
						</p>
						<Button
							variant="outline"
							className="mt-4"
							onClick={() => window.location.reload()}
						>
							Retry
						</Button>
					</div>
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
			<div className="text-center py-12">
				<Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
				<h3 className="text-lg font-medium text-gray-900 dark:text-white">
					No documents found
				</h3>
				<p className="text-gray-500 dark:text-gray-400 mt-2">
					No documents match your search "{searchQuery}"
				</p>
			</div>
		);
	}

	return (
		<div className="text-center py-12">
			<FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
			<h3 className="text-lg font-medium text-gray-900 dark:text-white">
				No documents yet
			</h3>
			<p className="text-gray-500 dark:text-gray-400 mt-2">
				Get started by creating your first document
			</p>
			<Button onClick={onCreateDocument} className="mt-4">
				<Plus className="h-4 w-4 mr-2" />
				Create Document
			</Button>
		</div>
	);
}

/**
 * Document grid view.
 */
function DocumentGrid({ documents }: { documents: DocumentSummary[] }) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{documents.map((doc) => (
				<DocumentCard key={doc.id} document={doc} />
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
			{documents.map((doc) => (
				<DocumentListItem key={doc.id} document={doc} />
			))}
		</div>
	);
}

/**
 * Document card component for grid view.
 */
function DocumentCard({ document }: { document: DocumentSummary }) {
	return (
		<Card className="hover:shadow-md transition-shadow group">
			<Link href={`/documents/${document.id}`}>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<CardTitle className="text-base line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
							{document.title}
						</CardTitle>
						<DocumentActions document={document} showNavigationLinks={false} />
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
				</CardFooter>
			</Link>
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
				"flex items-center gap-4 p-4 rounded-lg border bg-white dark:bg-gray-950",
				"hover:shadow-sm transition-shadow group"
			)}
		>
			<FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />

			<Link href={`/documents/${document.id}`} className="flex-1 min-w-0">
				<h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
					{document.title}
				</h3>
				<div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
					<StatusBadge status={document.status} />
					<span>{document.wordCount} words</span>
					<span>{formatRelativeTime(document.updatedAt)}</span>
				</div>
			</Link>

			{document.tags.length > 0 && (
				<div className="hidden md:flex items-center gap-1">
					{document.tags.slice(0, 2).map((tag) => (
						<span
							key={tag}
							className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded"
						>
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

			<DocumentActions document={document} showNavigationLinks={false} />
		</div>
	);
}


