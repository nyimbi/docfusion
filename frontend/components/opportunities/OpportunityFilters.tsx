"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { OpportunitySort } from "@/lib/types/opportunity";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
	ArrowUpDown,
	ChevronDown,
	Grid3X3,
	List,
} from "lucide-react";

// ============================================================================
// FilterDropdown
// ============================================================================

export interface FilterDropdownProps {
	label: string;
	icon: React.ReactNode;
	options: { value: string; label: string }[];
	selected: string[];
	onChange: (values: string[]) => void;
}

export const FilterDropdown = React.memo(function FilterDropdown({
	label,
	icon,
	options,
	selected,
	onChange,
}: FilterDropdownProps) {
	const handleToggle = (value: string) => {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					className={cn(
						"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
						selected.length > 0
							? "bg-primary/10 text-primary border border-primary/20"
							: "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
					)}
				>
					{icon}
					{label}
					{selected.length > 0 && (
						<span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--accent-500)] text-white">
							{selected.length}
						</span>
						)}
					<ChevronDown className="w-3 h-3 opacity-50" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
				{options.length === 0 ? (
					<div className="px-3 py-2 text-sm text-[var(--ink-500)]">No options available</div>
				) : (
					options.map((option) => (
						<DropdownMenuCheckboxItem
							key={option.value}
							checked={selected.includes(option.value)}
							onCheckedChange={() => handleToggle(option.value)}
						>
							{option.label}
						</DropdownMenuCheckboxItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

// ============================================================================
// ViewToggle
// ============================================================================

export interface ViewToggleProps {
	mode: "grid" | "list";
	onChange: (mode: "grid" | "list") => void;
}

export const ViewToggle = React.memo(function ViewToggle({ mode, onChange }: ViewToggleProps) {
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
			>
				<Grid3X3 className="w-4 h-4" />
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
			>
				<List className="w-4 h-4" />
			</button>
		</div>
	);
});

// ============================================================================
// SortDropdown
// ============================================================================

export interface SortDropdownProps {
	sort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
}

export const SortDropdown = React.memo(function SortDropdown({ sort, onSort }: SortDropdownProps) {
	const sortOptions: { field: OpportunitySort["field"]; label: string }[] = [
		{ field: "deadline", label: "Deadline" },
		{ field: "priorityRank", label: "Priority" },
		{ field: "fitScore", label: "Fit Score" },
		{ field: "budgetNumeric", label: "Budget" },
		{ field: "title", label: "Title" },
		{ field: "organization", label: "Organization" },
	];

	const currentLabel = sortOptions.find((o) => o.field === sort.field)?.label || "Sort";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					className={cn(
						"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
						"bg-background border border-input",
						"hover:bg-accent hover:text-accent-foreground transition-all duration-150"
					)}
				>
					<ArrowUpDown className="w-4 h-4" />
					{currentLabel}
					<span className="text-muted-foreground">
						{sort.direction === "asc" ? "\u2191" : "\u2193"}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{sortOptions.map(({ field, label }) => (
					<DropdownMenuItem
						key={field}
						onClick={() => onSort(field)}
						className={cn(sort.field === field && "text-primary")}
					>
						{label}
						{sort.field === field && (
							<span className="ml-auto">{sort.direction === "asc" ? "\u2191" : "\u2193"}</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
