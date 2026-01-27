/**
 * Documents Page - DocFusion
 *
 * A command-center style document gallery with sophisticated
 * information density, status visualization, and fluid interactions.
 *
 * Design: "Command Center Elegance" - Dense, scannable, professional
 * Uses the shared app layout for navigation.
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
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentSummary, DocumentStatus } from "@/lib/types/document";
import {
	Plus,
	Search,
	FileText,
	Clock,
	LayoutGrid,
	List,
	Sparkles,
	ChevronDown,
	FolderOpen,
	Zap,
	Edit3,
	CheckCircle2,
	Archive,
	AlertCircle,
	MoreVertical,
	ArrowRight,
	Layers,
	TrendingUp,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// Main Page Component
// ============================================================================

export default function DocumentsPage() {
	const router = useRouter();
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedQuery, setDebouncedQuery] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<DocumentStatus | "all">("all");

	// Debounce search
	React.useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Data fetching
	const searchEnabled = debouncedQuery.length >= 2;
	const listQuery = useDocuments({
		status: statusFilter === "all" ? undefined : statusFilter,
		sortBy: "updatedAt",
		sortOrder: "desc",
		limit: 50,
	});
	const searchQueryResult = useDocumentSearch(debouncedQuery);

	const isLoading = searchEnabled ? searchQueryResult.isLoading : listQuery.isLoading;
	const error = searchEnabled ? searchQueryResult.error : listQuery.error;
	const documents = searchEnabled
		? searchQueryResult.data ?? []
		: listQuery.data?.documents ?? [];

	// Create document
	const createMutation = useCreateDocument();
	const handleCreateDocument = async () => {
		try {
			const newDoc = await createMutation.mutateAsync({ title: "Untitled Document" });
			router.push(`/documents/${newDoc.id}`);
		} catch (err) {
			console.error("Failed to create document:", err);
		}
	};

	// Calculate stats
	const stats = React.useMemo(() => {
		const all = listQuery.data?.documents ?? [];
		return {
			total: all.length,
			drafts: all.filter((d) => d.status === "draft").length,
			inReview: all.filter((d) => d.status === "in_review").length,
			approved: all.filter((d) => d.status === "approved").length,
			totalWords: all.reduce((sum, d) => sum + d.wordCount, 0),
		};
	}, [listQuery.data]);

	return (
		<div className="relative">
			{/* Page Header */}
			<div className="border-b bg-background/50 backdrop-blur-sm">
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-6">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold text-foreground">
								Documents
							</h1>
							<p className="text-sm text-muted-foreground mt-1">
								Manage your proposals, templates, and content library
							</p>
						</div>
						<Button
							onClick={handleCreateDocument}
							isLoading={createMutation.isPending}
							className="self-start sm:self-auto"
						>
							<Plus className="h-4 w-4" />
							New Document
						</Button>
					</div>
				</div>
			</div>

			{/* Stats Strip */}
			<div className="border-b bg-muted/20">
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-4">
					<div className="flex items-center gap-8 overflow-x-auto scrollbar-none">
						<StatPill
							icon={<Layers className="w-4 h-4" />}
							label="Total"
							value={stats.total}
							color="default"
						/>
						<StatPill
							icon={<Edit3 className="w-4 h-4" />}
							label="Drafts"
							value={stats.drafts}
							color="amber"
						/>
						<StatPill
							icon={<AlertCircle className="w-4 h-4" />}
							label="In Review"
							value={stats.inReview}
							color="blue"
						/>
						<StatPill
							icon={<CheckCircle2 className="w-4 h-4" />}
							label="Approved"
							value={stats.approved}
							color="green"
						/>
						<div className="h-6 w-px bg-border" />
						<StatPill
							icon={<TrendingUp className="w-4 h-4" />}
							label="Total Words"
							value={stats.totalWords.toLocaleString()}
							color="default"
						/>
					</div>
				</div>
			</div>

			{/* Toolbar */}
			<div className="sticky top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-3">
					<div className="flex items-center justify-between gap-4">
						{/* Left: Filters */}
						<div className="flex items-center gap-3">
							<StatusFilterDropdown
								value={statusFilter}
								onChange={setStatusFilter}
							/>
							{/* Local search for this page */}
							<div className="hidden md:block relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<input
									type="search"
									placeholder="Filter documents..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-64 h-9 pl-9 pr-3 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
								/>
							</div>
						</div>

						{/* Right: View Toggle */}
						<ViewToggle
							mode={viewMode}
							onChange={setViewMode}
						/>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<main className="max-w-[1800px] mx-auto px-6 lg:px-10 py-8">
				{isLoading ? (
					<LoadingSkeleton viewMode={viewMode} />
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
					<DocumentListView documents={documents} />
				)}
			</main>
		</div>
	);
}

// ============================================================================
// Stat Pill
// ============================================================================

function StatPill({
	icon,
	label,
	value,
	color,
}: {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	color: "default" | "amber" | "blue" | "green";
}) {
	const colorClasses = {
		default: "text-muted-foreground",
		amber: "text-amber-500",
		blue: "text-blue-500",
		green: "text-green-500",
	};

	return (
		<div className="flex items-center gap-3 shrink-0">
			<div className="p-2 rounded-lg bg-muted/50 text-foreground">
				{icon}
			</div>
			<div>
				<div className={cn("text-lg font-semibold tabular-nums", colorClasses[color])}>
					{value}
				</div>
				<div className="text-xs text-muted-foreground uppercase tracking-wider">
					{label}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Status Filter Dropdown
// ============================================================================

function StatusFilterDropdown({
	value,
	onChange,
}: {
	value: DocumentStatus | "all";
	onChange: (value: DocumentStatus | "all") => void;
}) {
	const options: { value: DocumentStatus | "all"; label: string; icon: React.ReactNode }[] = [
		{ value: "all", label: "All Documents", icon: <Layers className="w-4 h-4" /> },
		{ value: "draft", label: "Drafts", icon: <Edit3 className="w-4 h-4" /> },
		{ value: "in_review", label: "In Review", icon: <AlertCircle className="w-4 h-4" /> },
		{ value: "approved", label: "Approved", icon: <CheckCircle2 className="w-4 h-4" /> },
		{ value: "archived", label: "Archived", icon: <Archive className="w-4 h-4" /> },
	];

	const current = options.find((o) => o.value === value) ?? options[0];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					className={cn(
						"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
						"bg-background border border-input",
						"text-foreground hover:bg-accent hover:text-accent-foreground",
						"transition-all duration-150"
					)}
				>
					{current.icon}
					{current.label}
					<ChevronDown className="w-4 h-4 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-48"
			>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex items-center gap-2",
							value === option.value && "bg-accent text-accent-foreground"
						)}
					>
						{option.icon}
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// View Toggle
// ============================================================================

function ViewToggle({
	mode,
	onChange,
}: {
	mode: "grid" | "list";
	onChange: (mode: "grid" | "list") => void;
}) {
	return (
		<div className="flex items-center p-1 rounded-lg bg-muted border border-border">
			<button
				type="button"
				onClick={() => onChange("grid")}
				className={cn(
					"p-2 rounded-md transition-all duration-150",
					mode === "grid"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				aria-label="Grid view"
				aria-pressed={mode === "grid"}
			>
				<LayoutGrid className="w-4 h-4" />
			</button>
			<button
				type="button"
				onClick={() => onChange("list")}
				className={cn(
					"p-2 rounded-md transition-all duration-150",
					mode === "list"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				aria-label="List view"
				aria-pressed={mode === "list"}
			>
				<List className="w-4 h-4" />
			</button>
		</div>
	);
}

// ============================================================================
// Document Grid
// ============================================================================

function DocumentGrid({ documents }: { documents: DocumentSummary[] }) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{documents.map((doc, index) => (
				<DocumentCard
					key={doc.id}
					document={doc}
					index={index}
				/>
			))}
		</div>
	);
}

// ============================================================================
// Document Card
// ============================================================================

function DocumentCard({
	document,
	index,
}: {
	document: DocumentSummary;
	index: number;
}) {
	const statusConfig: Record<DocumentStatus, { color: string; bg: string; icon: React.ReactNode }> = {
		draft: {
			color: "text-amber-500",
			bg: "bg-amber-500/10",
			icon: <Edit3 className="w-3.5 h-3.5" />,
		},
		in_review: {
			color: "text-blue-500",
			bg: "bg-blue-500/10",
			icon: <AlertCircle className="w-3.5 h-3.5" />,
		},
		approved: {
			color: "text-green-500",
			bg: "bg-green-500/10",
			icon: <CheckCircle2 className="w-3.5 h-3.5" />,
		},
		archived: {
			color: "text-muted-foreground",
			bg: "bg-muted",
			icon: <Archive className="w-3.5 h-3.5" />,
		},
	};

	const config = statusConfig[document.status];

	return (
		<Link
			href={`/documents/${document.id}`}
			className={cn(
				"group relative flex flex-col p-5 rounded-2xl",
				"bg-card border border-border shadow-sm",
				"hover:shadow-md hover:border-primary/50",
				"transition-all duration-300 ease-out",
				"animate-fade-up"
			)}
			style={{
				animationDelay: `${Math.min(index * 50, 400)}ms`,
				animationFillMode: "forwards",
			}}
		>
			{/* Status Badge */}
			<div className="flex items-center justify-between mb-4">
				<div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.bg, config.color)}>
					{config.icon}
					<span className="capitalize">{document.status.replace("_", " ")}</span>
				</div>
				<button
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all"
				>
					<MoreVertical className="w-4 h-4" />
				</button>
			</div>

			{/* Content */}
			<div className="flex-1">
				<h3 className="text-foreground font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
					{document.title}
				</h3>
				{document.excerpt ? (
					<p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
						{document.excerpt}
					</p>
				) : (
					<p className="text-sm text-muted-foreground/70 italic">
						No content yet
					</p>
				)}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
				<div className="flex items-center gap-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<Clock className="w-3 h-3" />
						{formatRelativeTime(document.updatedAt)}
					</span>
				</div>
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<FileText className="w-3 h-3" />
					{document.wordCount.toLocaleString()}
				</div>
			</div>
		</Link>
	);
}

// ============================================================================
// Document List View
// ============================================================================

function DocumentListView({ documents }: { documents: DocumentSummary[] }) {
	return (
		<div className="space-y-2">
			{/* Header */}
			<div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
				<div className="flex-1">Document</div>
				<div className="w-24 hidden md:block">Status</div>
				<div className="w-20 hidden lg:block text-right">Words</div>
				<div className="w-32 hidden sm:block text-right">Updated</div>
				<div className="w-10" />
			</div>

			{/* Rows */}
			{documents.map((doc, index) => (
				<DocumentRow key={doc.id} document={doc} index={index} />
			))}
		</div>
	);
}

function DocumentRow({
	document,
	index,
}: {
	document: DocumentSummary;
	index: number;
}) {
	const statusConfig: Record<DocumentStatus, { color: string; label: string }> = {
		draft: { color: "text-amber-500", label: "Draft" },
		in_review: { color: "text-blue-500", label: "Review" },
		approved: { color: "text-green-500", label: "Approved" },
		archived: { color: "text-muted-foreground", label: "Archived" },
	};

	const config = statusConfig[document.status];

	return (
		<Link
			href={`/documents/${document.id}`}
			className={cn(
				"group flex items-center gap-4 px-4 py-3 rounded-xl",
				"bg-card border border-transparent",
				"hover:bg-accent/50 hover:border-border",
				"transition-all duration-200",
				"animate-fade-up"
			)}
			style={{
				animationDelay: `${Math.min(index * 30, 300)}ms`,
				animationFillMode: "forwards",
			}}
		>
			{/* Document Icon */}
			<div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
				<FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
			</div>

			{/* Title */}
			<div className="flex-1 min-w-0">
				<h3 className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
					{document.title}
				</h3>
				{document.tags.length > 0 && (
					<div className="flex items-center gap-1.5 mt-0.5">
						{document.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			{/* Status */}
			<div className={cn("w-24 hidden md:block text-sm font-medium", config.color)}>
				{config.label}
			</div>

			{/* Word Count */}
			<div className="w-20 hidden lg:block text-right text-sm text-muted-foreground tabular-nums">
				{document.wordCount.toLocaleString()}
			</div>

			{/* Updated */}
			<div className="w-32 hidden sm:block text-right text-sm text-muted-foreground">
				{formatRelativeTime(document.updatedAt)}
			</div>

			{/* Arrow */}
			<div className="w-10 flex justify-end">
				<ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
			</div>
		</Link>
	);
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({
	searchQuery,
	onCreateDocument,
}: {
	searchQuery: string;
	onCreateDocument: () => void;
}) {
	if (searchQuery) {
		return (
			<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
				<div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
					<Search className="w-10 h-10 text-muted-foreground" />
				</div>
				<h3 className="text-xl font-semibold text-foreground mb-2">
					No results found
				</h3>
				<p className="text-muted-foreground text-center max-w-md">
					No documents match "{searchQuery}". Try a different search term.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
			{/* Decorative Element */}
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl" />
				<div className="relative w-24 h-24 rounded-2xl bg-primary flex items-center justify-center">
					<FolderOpen className="w-12 h-12 text-primary-foreground" />
				</div>
			</div>

			<h3 className="text-2xl font-bold text-foreground mb-3">
				Create your first document
			</h3>
			<p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
				Start crafting professional proposals with AI-powered writing assistance
				and real-time collaboration.
			</p>

			<div className="flex items-center gap-4">
				<Button
					onClick={onCreateDocument}
					className="px-6"
					size="lg"
				>
					<Zap className="w-5 h-5" />
					Create Document
				</Button>
				<Button
					variant="outline"
					size="lg"
					asChild
					className="hover:bg-accent"
				>
					<Link href="/templates">
						<Sparkles className="w-5 h-5" />
						Browse Templates
					</Link>
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
			<div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
				<AlertCircle className="w-10 h-10 text-destructive" />
			</div>
			<h3 className="text-xl font-semibold text-foreground mb-2">
				Unable to load documents
			</h3>
			<p className="text-muted-foreground text-center max-w-md mb-6">
				Something went wrong while fetching your documents. Please try again.
			</p>
			<Button
				variant="outline"
				onClick={onRetry}
			>
				Try Again
			</Button>
		</div>
	);
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
	if (viewMode === "grid") {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{Array.from({ length: 8 }).map((_, i) => (
					<div
						key={i}
						className="p-5 rounded-2xl bg-card border border-border"
					>
						<Skeleton className="h-6 w-20 mb-4" />
						<Skeleton className="h-5 w-3/4 mb-2" />
						<Skeleton className="h-4 w-full mb-1" />
						<Skeleton className="h-4 w-2/3 mb-4" />
						<div className="flex justify-between pt-4 border-t border-border">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-3 w-12" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{Array.from({ length: 10 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-4 p-4 rounded-xl bg-card"
				>
					<Skeleton className="w-10 h-10 rounded-lg" />
					<div className="flex-1">
						<Skeleton className="h-4 w-1/3 mb-1" />
						<Skeleton className="h-3 w-1/4" />
					</div>
					<Skeleton className="h-4 w-16" />
				</div>
			))}
		</div>
	);
}
