/**
 * Global search dialog component for DocFusion.
 *
 * Provides a Cmd+K (Mac) / Ctrl+K (Windows) keyboard shortcut
 * to open a global search dialog for quickly finding documents,
 * templates, and other content.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDocumentSearch } from "@/lib/query/hooks/useDocuments";
import { useTemplateSearch } from "@/lib/query/hooks/useTemplates";
import type { DocumentSummary } from "@/lib/types/document";
import type { TemplateSummary } from "@/lib/types/template";
import {
	Dialog,
	DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Search,
	FileText,
	LayoutTemplate,
	Clock,
	ArrowRight,
	Command,
	Loader2,
	FolderOpen,
} from "lucide-react";

/**
 * Search result type - documents or templates.
 */
type SearchResultType = "document" | "template";

/**
 * Unified search result item.
 */
interface SearchResult {
	id: string;
	title: string;
	type: SearchResultType;
	excerpt?: string;
	updatedAt: string;
	href: string;
}

/**
 * Props for GlobalSearch component.
 */
export interface GlobalSearchProps {
	/** Whether the dialog is open */
	open?: boolean;
	/** Callback when open state changes */
	onOpenChange?: (open: boolean) => void;
}

/**
 * Global search dialog component.
 *
 * @example
 * ```tsx
 * // Use with GlobalSearchProvider for keyboard shortcut
 * <GlobalSearchProvider>
 *   <App />
 * </GlobalSearchProvider>
 *
 * // Or control manually
 * const [open, setOpen] = React.useState(false);
 * <GlobalSearch open={open} onOpenChange={setOpen} />
 * ```
 */
export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
	const router = useRouter();
	const [query, setQuery] = React.useState("");
	const [debouncedQuery, setDebouncedQuery] = React.useState("");
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const listRef = React.useRef<HTMLDivElement>(null);

	// Debounce search query
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, 200);
		return () => clearTimeout(timer);
	}, [query]);

	// Reset state when dialog opens/closes
	React.useEffect(() => {
		if (open) {
			setQuery("");
			setDebouncedQuery("");
			setSelectedIndex(0);
			// Focus input after dialog animation
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [open]);

	// Search documents and templates
	const {
		data: documentResults,
		isLoading: isLoadingDocuments,
	} = useDocumentSearch(debouncedQuery);

	const {
		data: templateResults,
		isLoading: isLoadingTemplates,
	} = useTemplateSearch(debouncedQuery);

	// Combine results
	const results = React.useMemo((): SearchResult[] => {
		const items: SearchResult[] = [];

		// Add documents (documentResults is an array of DocumentSummary)
		if (documentResults) {
			for (const doc of documentResults.slice(0, 5)) {
				items.push({
					id: doc.id,
					title: doc.title,
					type: "document",
					excerpt: doc.excerpt,
					updatedAt: doc.updatedAt,
					href: `/documents/${doc.id}`,
				});
			}
		}

		// Add templates (templateResults is an array of TemplateSummary)
		if (templateResults) {
			for (const template of templateResults.slice(0, 5)) {
				items.push({
					id: template.id,
					title: template.name,
					type: "template",
					excerpt: template.description,
					updatedAt: template.updatedAt,
					href: `/templates/${template.id}`,
				});
			}
		}

		return items;
	}, [documentResults, templateResults]);

	const isLoading = isLoadingDocuments || isLoadingTemplates;
	const hasQuery = debouncedQuery.length >= 2;
	const hasResults = results.length > 0;

	// Keep selected index in bounds
	React.useEffect(() => {
		if (selectedIndex >= results.length) {
			setSelectedIndex(Math.max(0, results.length - 1));
		}
	}, [results.length, selectedIndex]);

	// Scroll selected item into view
	React.useEffect(() => {
		if (listRef.current && hasResults) {
			const selectedElement = listRef.current.children[selectedIndex] as HTMLElement | undefined;
			selectedElement?.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIndex, hasResults]);

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
				break;
			case "Enter":
				e.preventDefault();
				if (results[selectedIndex]) {
					navigateToResult(results[selectedIndex]);
				}
				break;
			case "Escape":
				e.preventDefault();
				onOpenChange?.(false);
				break;
		}
	};

	// Navigate to selected result
	const navigateToResult = (result: SearchResult) => {
		onOpenChange?.(false);
		router.push(result.href);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" aria-label="Search documents and templates">
				{/* Search input */}
				<div className="flex items-center border-b px-4">
					<Search className="h-5 w-5 text-gray-400 mr-3" aria-hidden="true" />
					<Input
						ref={inputRef}
						type="search"
						role="combobox"
						aria-expanded={hasResults}
						aria-controls="search-results-list"
						aria-activedescendant={results[selectedIndex] ? `search-result-${results[selectedIndex].id}` : undefined}
						aria-label="Search documents and templates"
						placeholder="Search documents and templates..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						className="border-0 focus-visible:ring-0 py-4 text-base"
					/>
					{isLoading && (
						<Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
					)}
				</div>

				{/* Results */}
				<div aria-live="polite" aria-atomic="true" className="sr-only">
					{hasQuery && !isLoading && hasResults && `${results.length} results found`}
					{hasQuery && !isLoading && !hasResults && "No results found"}
				</div>
				<div
					ref={listRef}
					id="search-results-list"
					role="listbox"
					aria-label="Search results"
					className="max-h-[400px] overflow-y-auto"
				>
					{!hasQuery ? (
						<SearchPlaceholder />
					) : isLoading && !hasResults ? (
						<div className="flex items-center justify-center py-12 text-gray-500" role="status" aria-live="polite">
							<Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
							Searching...
						</div>
					) : hasResults ? (
						<div className="py-2">
							{results.map((result, index) => (
								<SearchResultItem
									key={`${result.type}-${result.id}`}
									result={result}
									isSelected={index === selectedIndex}
									onClick={() => navigateToResult(result)}
									onMouseEnter={() => setSelectedIndex(index)}
								/>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-12 text-gray-500" role="status" aria-live="polite">
							<Search className="h-8 w-8 mb-3 text-gray-400" aria-hidden="true" />
							<p>No results found for "{debouncedQuery}"</p>
							<p className="text-sm mt-1">
								Try a different search term
							</p>
						</div>
					)}
				</div>

				{/* Footer with shortcuts */}
				<SearchFooter />
			</DialogContent>
		</Dialog>
	);
}

/**
 * Search result item component.
 */
function SearchResultItem({
	result,
	isSelected,
	onClick,
	onMouseEnter,
}: {
	result: SearchResult;
	isSelected: boolean;
	onClick: () => void;
	onMouseEnter: () => void;
}) {
	const Icon = result.type === "document" ? FileText : LayoutTemplate;

	return (
		<button
			type="button"
			id={`search-result-${result.id}`}
			role="option"
			aria-selected={isSelected}
			className={cn(
				"w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
				isSelected
					? "bg-blue-50 dark:bg-blue-900/20"
					: "hover:bg-gray-50 dark:hover:bg-gray-800/50"
			)}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
		>
			<div
				className={cn(
					"flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
					result.type === "document"
						? "bg-blue-100 dark:bg-blue-900/30"
						: "bg-purple-100 dark:bg-purple-900/30"
				)}
				aria-hidden="true"
			>
				<Icon
					className={cn(
						"h-5 w-5",
						result.type === "document"
							? "text-blue-600 dark:text-blue-400"
							: "text-purple-600 dark:text-purple-400"
					)}
				/>
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-gray-900 dark:text-white truncate">
						{result.title}
					</span>
					<span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
						{result.type === "document" ? "Document" : "Template"}
					</span>
				</div>
				{result.excerpt && (
					<p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
						{result.excerpt}
					</p>
				)}
			</div>

			{isSelected && (
				<ArrowRight className="flex-shrink-0 h-4 w-4 text-gray-400" />
			)}
		</button>
	);
}

/**
 * Placeholder content when no query entered.
 */
function SearchPlaceholder() {
	return (
		<div className="py-6 px-4">
			<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
				Quick actions
			</p>
			<div className="space-y-2">
				<QuickAction
					icon={FileText}
					label="Go to Documents"
					href="/documents"
					shortcut="G D"
				/>
				<QuickAction
					icon={LayoutTemplate}
					label="Go to Templates"
					href="/templates"
					shortcut="G T"
				/>
				<QuickAction
					icon={FolderOpen}
					label="Create New Document"
					href="/documents/new"
					shortcut="C D"
				/>
			</div>
		</div>
	);
}

/**
 * Quick action item.
 */
function QuickAction({
	icon: Icon,
	label,
	href,
	shortcut,
}: {
	icon: React.ElementType;
	label: string;
	href: string;
	shortcut: string;
}) {
	const router = useRouter();

	return (
		<button
			type="button"
			className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
			onClick={() => router.push(href)}
		>
			<Icon className="h-4 w-4 text-gray-400" />
			<span className="flex-1 text-sm text-gray-700 dark:text-gray-300 text-left">
				{label}
			</span>
			<span className="text-xs text-gray-400 font-mono">{shortcut}</span>
		</button>
	);
}

/**
 * Footer with keyboard shortcuts.
 */
function SearchFooter() {
	return (
		<div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50 dark:bg-gray-900 text-xs text-gray-500">
			<div className="flex items-center gap-4">
				<span className="flex items-center gap-1">
					<kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border text-gray-600 dark:text-gray-400">
						↑
					</kbd>
					<kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border text-gray-600 dark:text-gray-400">
						↓
					</kbd>
					<span className="ml-1">Navigate</span>
				</span>
				<span className="flex items-center gap-1">
					<kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border text-gray-600 dark:text-gray-400">
						↵
					</kbd>
					<span className="ml-1">Open</span>
				</span>
				<span className="flex items-center gap-1">
					<kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border text-gray-600 dark:text-gray-400">
						Esc
					</kbd>
					<span className="ml-1">Close</span>
				</span>
			</div>
		</div>
	);
}

/**
 * Global search context for keyboard shortcut.
 */
interface GlobalSearchContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const GlobalSearchContext = React.createContext<GlobalSearchContextValue | null>(null);

/**
 * Hook to access global search state.
 *
 * @example
 * ```tsx
 * const { open, setOpen } = useGlobalSearch();
 * <Button onClick={() => setOpen(true)}>Search</Button>
 * ```
 */
export function useGlobalSearch() {
	const context = React.useContext(GlobalSearchContext);
	if (!context) {
		throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
	}
	return context;
}

/**
 * Provider for global search functionality.
 * Handles Cmd+K / Ctrl+K keyboard shortcut.
 *
 * @example
 * ```tsx
 * // In your root layout
 * <GlobalSearchProvider>
 *   {children}
 * </GlobalSearchProvider>
 * ```
 */
export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = React.useState(false);

	// Handle keyboard shortcut
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd+K (Mac) or Ctrl+K (Windows/Linux)
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<GlobalSearchContext.Provider value={{ open, setOpen }}>
			{children}
			<GlobalSearch open={open} onOpenChange={setOpen} />
		</GlobalSearchContext.Provider>
	);
}

/**
 * Search trigger button component.
 * Shows keyboard shortcut hint.
 *
 * @example
 * ```tsx
 * <GlobalSearchTrigger className="w-full" />
 * ```
 */
export function GlobalSearchTrigger({
	className,
}: {
	className?: string;
}) {
	const { setOpen } = useGlobalSearch();
	const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

	return (
		<button
			type="button"
			onClick={() => setOpen(true)}
			aria-label={`Search. Press ${isMac ? "Command" : "Control"} K to open search`}
			className={cn(
				"flex items-center gap-3 px-3 py-2 rounded-lg border bg-white dark:bg-gray-950 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 transition-colors",
				className
			)}
		>
			<Search className="h-4 w-4" aria-hidden="true" />
			<span className="text-sm">Search...</span>
			<div className="flex-1" />
			<kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border text-xs text-gray-600 dark:text-gray-400">
				{isMac ? (
					<>
						<Command className="h-3 w-3" />
						<span>K</span>
					</>
				) : (
					<span>Ctrl K</span>
				)}
			</kbd>
		</button>
	);
}
