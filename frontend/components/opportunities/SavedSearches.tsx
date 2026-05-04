"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Bookmark,
	BookmarkCheck,
	ChevronDown,
	Plus,
	Trash2,
	Star,
	X,
} from "lucide-react";
import {
	createSavedSearch,
	listSavedSearches,
	deleteSavedSearch,
	setDefaultSavedSearch,
	type SavedSearch,
} from "@/lib/actions/saved-searches";
import type { OpportunityFilters, OpportunitySort } from "@/lib/types/opportunity";

// ============================================================================
// Props
// ============================================================================

interface SavedSearchesProps {
	userId: string;
	currentFilters: OpportunityFilters;
	currentSort: OpportunitySort;
	onLoadSearch: (filters: OpportunityFilters, sort?: OpportunitySort) => void;
}

// ============================================================================
// SavedSearches Component
// ============================================================================

export function SavedSearches({ userId, currentFilters, currentSort, onLoadSearch }: SavedSearchesProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [searches, setSearches] = React.useState<SavedSearch[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);
	const [showSaveForm, setShowSaveForm] = React.useState(false);
	const [saveName, setSaveName] = React.useState("");
	const dropdownRef = React.useRef<HTMLDivElement>(null);

	// Close dropdown on click outside
	React.useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setShowSaveForm(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const loadSearches = React.useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await listSavedSearches(userId);
			setSearches(data);
		} catch (err) {
			console.error("Failed to load saved searches:", err);
		} finally {
			setIsLoading(false);
		}
	}, [userId]);

	// Load saved searches on mount and when dropdown opens
	React.useEffect(() => {
		if (isOpen) {
			loadSearches();
		}
	}, [isOpen, loadSearches]);

	const handleSave = async () => {
		if (!saveName.trim()) return;
		setIsSaving(true);
		try {
			await createSavedSearch(userId, {
				name: saveName.trim(),
				filters: currentFilters,
				sort: currentSort,
			});
			setSaveName("");
			setShowSaveForm(false);
			await loadSearches();
		} catch (err) {
			console.error("Failed to save search:", err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteSavedSearch(id, userId);
			setSearches((prev) => prev.filter((s) => s.id !== id));
		} catch (err) {
			console.error("Failed to delete saved search:", err);
		}
	};

	const handleSetDefault = async (id: string) => {
		try {
			await setDefaultSavedSearch(id, userId);
			await loadSearches();
		} catch (err) {
			console.error("Failed to set default search:", err);
		}
	};

	const handleLoad = (search: SavedSearch) => {
		onLoadSearch(search.filters, search.sort);
		setIsOpen(false);
	};

	const hasActiveFilters = Object.keys(currentFilters).length > 0;

	return (
		<div className="relative" ref={dropdownRef}>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					"gap-1.5 text-sm",
					hasActiveFilters && "text-primary"
				)}
			>
				{hasActiveFilters ? (
					<BookmarkCheck className="w-4 h-4" />
				) : (
					<Bookmark className="w-4 h-4" />
				)}
				Saved
				<ChevronDown
					className={cn(
						"w-3 h-3 transition-transform duration-200",
						isOpen && "rotate-180"
					)}
				/>
			</Button>

			{isOpen && (
				<div className="absolute right-0 top-full mt-1 w-80 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-up">
					{/* Header */}
					<div className="px-4 py-3 border-b border-border bg-muted/30">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold text-foreground">Saved Searches</h3>
							<button
								onClick={() => setShowSaveForm(!showSaveForm)}
								className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
							>
								<Plus className="w-3 h-3" />
								Save current
							</button>
						</div>
					</div>

					{/* Save Form */}
					{showSaveForm && (
						<div className="px-4 py-3 border-b border-border bg-muted/20">
							<div className="flex items-center gap-2">
								<input
									type="text"
									placeholder="Search name..."
									value={saveName}
									onChange={(e) => setSaveName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleSave();
										if (e.key === "Escape") setShowSaveForm(false);
									}}
									className={cn(
										"flex-1 h-8 px-2.5 rounded-lg text-sm",
										"bg-background border border-input",
										"text-foreground placeholder:text-muted-foreground",
										"focus:outline-none focus:ring-1 focus:ring-ring"
									)}
								/>
								<Button
									size="sm"
									onClick={handleSave}
									disabled={!saveName.trim() || isSaving}
									className="h-8 px-3"
								>
									{isSaving ? "Saving..." : "Save"}
								</Button>
								<button
									onClick={() => setShowSaveForm(false)}
									className="p-1 text-muted-foreground hover:text-foreground transition-colors"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						</div>
					)}

					{/* List */}
					<div className="max-h-64 overflow-y-auto">
						{isLoading ? (
							<div className="px-4 py-6 text-center text-sm text-muted-foreground">
								Loading...
							</div>
						) : searches.length === 0 ? (
							<div className="px-4 py-6 text-center">
								<Bookmark className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">No saved searches yet</p>
								<p className="text-xs text-muted-foreground/60 mt-1">
									Save your current filters for quick access
								</p>
							</div>
						) : (
							searches.map((search) => (
								<div
									key={search.id}
									className={cn(
										"group flex items-center gap-2 px-4 py-2.5",
										"hover:bg-accent cursor-pointer transition-colors",
										search.isDefault && "bg-primary/5"
									)}
								>
									<button
										onClick={() => handleLoad(search)}
										className="flex-1 text-left min-w-0"
									>
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-foreground truncate">
												{search.name}
											</span>
											{search.isDefault && (
												<Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
											)}
										</div>
										{search.description && (
											<p className="text-xs text-muted-foreground truncate">
												{search.description}
											</p>
										)}
									</button>

									{/* Actions */}
									<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
										{!search.isDefault && (
											<button
												onClick={() => handleSetDefault(search.id)}
												className="p-1 text-muted-foreground hover:text-amber-500 transition-colors"
												title="Set as default"
											>
												<Star className="w-3.5 h-3.5" />
											</button>
										)}
										<button
											onClick={() => handleDelete(search.id)}
											className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
											title="Delete"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
