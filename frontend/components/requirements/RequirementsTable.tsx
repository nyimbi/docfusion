/**
 * RequirementsTable Component - DocFusion
 *
 * Sortable, filterable table for displaying and managing RFP requirements.
 * Features inline status updates, bulk actions, and responsive design.
 */

"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import type {
	Requirement,
	RequirementFilters,
	RequirementSort,
	RequirementSortField,
	RequirementCategory,
	RequirementPriority,
	ComplianceStatus,
	RiskLevel,
	SortDirection,
} from "@/lib/types/opportunity";
import { updateRequirement, bulkUpdateRequirements, deleteRequirements } from "@/lib/actions/requirements";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface RequirementsTableProps {
	requirements: Requirement[];
	onRequirementClick?: (requirement: Requirement) => void;
	onRequirementsChange?: () => void;
}

export function RequirementsTable({
	requirements: initialRequirements,
	onRequirementClick,
	onRequirementsChange,
}: RequirementsTableProps) {
	const [requirements, setRequirements] = useState(initialRequirements);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [filters, setFilters] = useState<RequirementFilters>({});
	const [sort, setSort] = useState<RequirementSort>({ field: "requirementId", direction: "asc" });
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		setRequirements(initialRequirements);
		setSelectedIds((prev) => new Set([...prev].filter((id) =>
			initialRequirements.some((requirement) => requirement.id === id)
		)));
	}, [initialRequirements]);

	// Filter and sort requirements
	const filteredRequirements = useMemo(() => {
		let result = [...requirements];

		// Apply filters
		if (filters.search) {
			const search = filters.search.toLowerCase();
			result = result.filter(
				(r) =>
					r.text.toLowerCase().includes(search) ||
					r.requirementId?.toLowerCase().includes(search) ||
					r.notes?.toLowerCase().includes(search)
			);
		}

		if (filters.categories?.length) {
			result = result.filter((r) => r.category && filters.categories!.includes(r.category));
		}

		if (filters.priorities?.length) {
			result = result.filter((r) => r.priority && filters.priorities!.includes(r.priority));
		}

		if (filters.complianceStatuses?.length) {
			result = result.filter((r) => filters.complianceStatuses!.includes(r.complianceStatus));
		}

		if (filters.riskLevels?.length) {
			result = result.filter((r) => r.riskLevel && filters.riskLevels!.includes(r.riskLevel));
		}

		// Apply sorting
		result.sort((a, b) => {
			const aVal = getSortValue(a, sort.field);
			const bVal = getSortValue(b, sort.field);

			if (aVal === null || aVal === undefined) return 1;
			if (bVal === null || bVal === undefined) return -1;

			const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
			return sort.direction === "asc" ? comparison : -comparison;
		});

		return result;
	}, [requirements, filters, sort]);

	const handleSort = (field: RequirementSortField) => {
		setSort((prev) => ({
			field,
			direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
		}));
	};

	const handleSelectAll = () => {
		if (selectedIds.size === filteredRequirements.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredRequirements.map((r) => r.id)));
		}
	};

	const handleSelect = (id: string) => {
		const newSelected = new Set(selectedIds);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedIds(newSelected);
	};

	const handleStatusChange = async (id: string, status: ComplianceStatus) => {
		startTransition(async () => {
			try {
				const updated = await updateRequirement(id, { complianceStatus: status });
				if (updated) {
					setRequirements((prev) =>
						prev.map((r) => (r.id === id ? { ...r, complianceStatus: status } : r))
					);
					onRequirementsChange?.();
				}
			} catch (error) {
				console.error("Failed to update requirement:", error);
			}
		});
	};

	const handleBulkStatusChange = async (status: ComplianceStatus) => {
		if (selectedIds.size === 0) return;

		startTransition(async () => {
			try {
				await bulkUpdateRequirements(Array.from(selectedIds), { complianceStatus: status });
				setRequirements((prev) =>
					prev.map((r) =>
						selectedIds.has(r.id) ? { ...r, complianceStatus: status } : r
					)
				);
				setSelectedIds(new Set());
				onRequirementsChange?.();
			} catch (error) {
				console.error("Failed to bulk update:", error);
			}
		});
	};

	const handleBulkAssign = async (assignedTo: string) => {
		if (selectedIds.size === 0) return;

		startTransition(async () => {
			try {
				await bulkUpdateRequirements(Array.from(selectedIds), { assignedTo });
				setRequirements((prev) =>
					prev.map((r) =>
						selectedIds.has(r.id) ? { ...r, assignedTo } : r
					)
				);
				setSelectedIds(new Set());
				onRequirementsChange?.();
			} catch (error) {
				console.error("Failed to bulk assign:", error);
			}
		});
	};

	const handleBulkDelete = async () => {
		if (selectedIds.size === 0) return;

		if (!confirm(`Delete ${selectedIds.size} requirement(s)?`)) return;

		startTransition(async () => {
			try {
				await deleteRequirements(Array.from(selectedIds));
				setRequirements((prev) => prev.filter((r) => !selectedIds.has(r.id)));
				setSelectedIds(new Set());
				onRequirementsChange?.();
			} catch (error) {
				console.error("Failed to delete:", error);
			}
		});
	};

	const selectAllState =
		selectedIds.size === 0
			? false
			: selectedIds.size === filteredRequirements.length
			? true
			: "indeterminate";

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3">
				{/* Search */}
				<div className="flex-1 min-w-[200px]">
					<input
						type="text"
						placeholder="Search requirements..."
						value={filters.search ?? ""}
						onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
						className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
					/>
				</div>

				{/* Filter Dropdowns */}
				<FilterDropdown
					label="Category"
					value={filters.categories ?? []}
					options={CATEGORY_OPTIONS}
					onChange={(categories) => setFilters((f) => ({ ...f, categories }))}
				/>
				<FilterDropdown
					label="Priority"
					value={filters.priorities ?? []}
					options={PRIORITY_OPTIONS}
					onChange={(priorities) => setFilters((f) => ({ ...f, priorities }))}
				/>
				<FilterDropdown
					label="Status"
					value={filters.complianceStatuses ?? []}
					options={STATUS_OPTIONS}
					onChange={(complianceStatuses) => setFilters((f) => ({ ...f, complianceStatuses }))}
				/>

				{/* Clear Filters */}
				{Object.values(filters).some((v) => v && (Array.isArray(v) ? v.length > 0 : v)) && (
					<Button variant="ghost" size="sm" onClick={() => setFilters({})}>
						Clear Filters
					</Button>
				)}
			</div>

			{/* Bulk Actions */}
			{selectedIds.size > 0 && (
				<div className="flex items-center gap-3 p-3 bg-[var(--background-muted)] rounded-lg">
					<span className="text-sm text-[var(--foreground-muted)]">
						{selectedIds.size} selected
					</span>
					<div className="flex gap-2">
						<BulkActionDropdown
							label="Set Status"
							options={STATUS_OPTIONS}
							onSelect={(status) => handleBulkStatusChange(status as ComplianceStatus)}
							disabled={isPending}
						/>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => handleBulkAssign("current-user")}
							disabled={isPending}
						>
							Assign to Me
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleBulkDelete}
							disabled={isPending}
							className="text-[var(--error-500)] hover:text-[var(--error-600)]"
						>
							Delete
						</Button>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSelectedIds(new Set())}
						className="ml-auto"
					>
						Clear Selection
					</Button>
				</div>
			)}

			{/* Table */}
			<div className="border border-[var(--border)] rounded-lg overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
								<th className="w-10 px-3 py-3">
									<Checkbox
										checked={selectAllState}
										onCheckedChange={handleSelectAll}
									/>
								</th>
								<SortableHeader
									field="requirementId"
									label="ID"
									currentSort={sort}
									onSort={handleSort}
									className="w-24"
								/>
								<SortableHeader
									field="category"
									label="Category"
									currentSort={sort}
									onSort={handleSort}
									className="w-28"
								/>
								<th className="px-3 py-3 text-left font-medium text-[var(--foreground-muted)]">
									Requirement
								</th>
								<SortableHeader
									field="priority"
									label="Priority"
									currentSort={sort}
									onSort={handleSort}
									className="w-28"
								/>
								<SortableHeader
									field="complianceStatus"
									label="Status"
									currentSort={sort}
									onSort={handleSort}
									className="w-32"
								/>
								<SortableHeader
									field="riskLevel"
									label="Risk"
									currentSort={sort}
									onSort={handleSort}
									className="w-24"
								/>
								<th className="w-12 px-3 py-3" />
							</tr>
						</thead>
						<tbody>
							{filteredRequirements.length === 0 ? (
								<tr>
									<td colSpan={8} className="px-3 py-12 text-center text-[var(--foreground-muted)]">
										No requirements found
									</td>
								</tr>
							) : (
								filteredRequirements.map((req) => (
									<RequirementRow
										key={req.id}
										requirement={req}
										isSelected={selectedIds.has(req.id)}
										onSelect={() => handleSelect(req.id)}
										onClick={() => onRequirementClick?.(req)}
										onStatusChange={(status) => handleStatusChange(req.id, status)}
										isPending={isPending}
									/>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Summary */}
			<div className="flex items-center justify-between text-sm text-[var(--foreground-muted)]">
				<span>
					Showing {filteredRequirements.length} of {requirements.length} requirements
				</span>
			</div>
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function RequirementRow({
	requirement,
	isSelected,
	onSelect,
	onClick,
	onStatusChange,
	isPending,
}: {
	requirement: Requirement;
	isSelected: boolean;
	onSelect: () => void;
	onClick: () => void;
	onStatusChange: (status: ComplianceStatus) => void;
	isPending: boolean;
}) {
	return (
		<tr
			className={cn(
				"border-b border-[var(--border)] transition-colors",
				"hover:bg-[var(--background-muted)]",
				isSelected && "bg-[var(--background-muted)]"
			)}
		>
			<td className="px-3 py-3">
				<Checkbox checked={isSelected} onCheckedChange={onSelect} />
			</td>
			<td className="px-3 py-3">
				<span className="font-mono text-xs text-[var(--foreground-muted)]">
					{requirement.requirementId ?? "—"}
				</span>
			</td>
			<td className="px-3 py-3">
				<CategoryBadge category={requirement.category} />
			</td>
			<td className="px-3 py-3">
				<button
					onClick={onClick}
					className="text-left hover:text-[var(--accent-500)] transition-colors line-clamp-2"
				>
					{requirement.text}
				</button>
			</td>
			<td className="px-3 py-3">
				<PriorityBadge priority={requirement.priority} />
			</td>
			<td className="px-3 py-3">
				<StatusDropdown
					value={requirement.complianceStatus}
					onChange={onStatusChange}
					disabled={isPending}
				/>
			</td>
			<td className="px-3 py-3">
				<RiskBadge level={requirement.riskLevel} />
			</td>
			<td className="px-3 py-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="p-1 rounded hover:bg-[var(--background-muted)]">
							<MoreIcon className="h-4 w-4 text-[var(--foreground-muted)]" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onClick}>View Details</DropdownMenuItem>
						<DropdownMenuItem>Edit</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem className="text-[var(--error-500)]">
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</td>
		</tr>
	);
}

function SortableHeader({
	field,
	label,
	currentSort,
	onSort,
	className,
}: {
	field: RequirementSortField;
	label: string;
	currentSort: RequirementSort;
	onSort: (field: RequirementSortField) => void;
	className?: string;
}) {
	const isActive = currentSort.field === field;

	return (
		<th className={cn("px-3 py-3 text-left", className)}>
			<button
				onClick={() => onSort(field)}
				className={cn(
					"flex items-center gap-1 font-medium transition-colors",
					isActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]",
					"hover:text-[var(--foreground)]"
				)}
			>
				{label}
				{isActive && (
					<SortIcon direction={currentSort.direction} />
				)}
			</button>
		</th>
	);
}

function FilterDropdown<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T[];
	options: { value: T; label: string }[];
	onChange: (value: T[]) => void;
}) {
	const handleToggle = (optionValue: T) => {
		const newValue = value.includes(optionValue)
			? value.filter((v) => v !== optionValue)
			: [...value, optionValue];
		onChange(newValue);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					{label}
					{value.length > 0 && (
						<span className="ml-1.5 px-1.5 py-0.5 text-xs bg-[var(--accent-500)] text-white rounded-full">
							{value.length}
						</span>
					)}
					<ChevronIcon className="ml-1 h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{options.map((option) => (
					<DropdownMenuItem key={option.value} onClick={() => handleToggle(option.value)}>
						<Checkbox
							checked={value.includes(option.value)}
							className="mr-2"
						/>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function BulkActionDropdown({
	label,
	options,
	onSelect,
	disabled,
}: {
	label: string;
	options: { value: string; label: string }[];
	onSelect: (value: string) => void;
	disabled: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" disabled={disabled}>
					{label}
					<ChevronIcon className="ml-1 h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{options.map((option) => (
					<DropdownMenuItem key={option.value} onClick={() => onSelect(option.value)}>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function StatusDropdown({
	value,
	onChange,
	disabled,
}: {
	value: ComplianceStatus;
	onChange: (status: ComplianceStatus) => void;
	disabled: boolean;
}) {
	const config = STATUS_CONFIG[value];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					disabled={disabled}
					className={cn(
						"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors",
						config.className,
						disabled && "opacity-50 cursor-not-allowed"
					)}
				>
					{config.label}
					<ChevronIcon className="ml-1 h-3 w-3" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>Set Status</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{STATUS_OPTIONS.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => onChange(option.value as ComplianceStatus)}
					>
						<span
							className={cn(
								"mr-2 h-2 w-2 rounded-full",
								STATUS_CONFIG[option.value as ComplianceStatus].dotColor
							)}
						/>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function CategoryBadge({ category }: { category: RequirementCategory | null }) {
	if (!category) return <span className="text-[var(--foreground-muted)]">—</span>;

	const config = CATEGORY_CONFIG[category] ?? { label: category, className: "bg-gray-100 text-gray-700" };

	return (
		<span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-medium", config.className)}>
			{config.label}
		</span>
	);
}

function PriorityBadge({ priority }: { priority: RequirementPriority | null }) {
	if (!priority) return <span className="text-[var(--foreground-muted)]">—</span>;

	const config = PRIORITY_CONFIG[priority];

	return (
		<span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-medium", config.className)}>
			{config.label}
		</span>
	);
}

function RiskBadge({ level }: { level: RiskLevel | null }) {
	if (!level) return <span className="text-[var(--foreground-muted)]">—</span>;

	const config = RISK_CONFIG[level];

	return (
		<span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-medium", config.className)}>
			{config.label}
		</span>
	);
}

// ============================================================================
// Icons
// ============================================================================

function SortIcon({ direction }: { direction: SortDirection }) {
	return (
		<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			{direction === "asc" ? (
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
			) : (
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
			)}
		</svg>
	);
}

function ChevronIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}

function MoreIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
			/>
		</svg>
	);
}

// ============================================================================
// Configuration
// ============================================================================

const CATEGORY_OPTIONS: { value: RequirementCategory; label: string }[] = [
	{ value: "technical", label: "Technical" },
	{ value: "legal", label: "Legal" },
	{ value: "financial", label: "Financial" },
	{ value: "experience", label: "Experience" },
	{ value: "administrative", label: "Administrative" },
	{ value: "personnel", label: "Personnel" },
	{ value: "security", label: "Security" },
	{ value: "compliance", label: "Compliance" },
	{ value: "other", label: "Other" },
];

const CATEGORY_CONFIG: Record<RequirementCategory, { label: string; className: string }> = {
	technical: { label: "Technical", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
	legal: { label: "Legal", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
	financial: { label: "Financial", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
	experience: { label: "Experience", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
	administrative: { label: "Admin", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
	personnel: { label: "Personnel", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" },
	security: { label: "Security", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
	compliance: { label: "Compliance", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
	other: { label: "Other", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const PRIORITY_OPTIONS: { value: RequirementPriority; label: string }[] = [
	{ value: "mandatory", label: "Mandatory" },
	{ value: "preferred", label: "Preferred" },
	{ value: "optional", label: "Optional" },
];

const PRIORITY_CONFIG: Record<RequirementPriority, { label: string; className: string }> = {
	mandatory: { label: "Mandatory", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
	preferred: { label: "Preferred", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
	optional: { label: "Optional", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const STATUS_OPTIONS: { value: ComplianceStatus; label: string }[] = [
	{ value: "not_addressed", label: "Not Addressed" },
	{ value: "partial", label: "Partial" },
	{ value: "compliant", label: "Compliant" },
	{ value: "non_compliant", label: "Non-Compliant" },
	{ value: "not_applicable", label: "N/A" },
];

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; className: string; dotColor: string }> = {
	not_addressed: {
		label: "Not Addressed",
		className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
		dotColor: "bg-gray-400",
	},
	partial: {
		label: "Partial",
		className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
		dotColor: "bg-yellow-500",
	},
	compliant: {
		label: "Compliant",
		className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		dotColor: "bg-green-500",
	},
	non_compliant: {
		label: "Non-Compliant",
		className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
		dotColor: "bg-red-500",
	},
	not_applicable: {
		label: "N/A",
		className: "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-500",
		dotColor: "bg-gray-300",
	},
};

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
	low: { label: "Low", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
	medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
	high: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
	critical: { label: "Critical", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

// ============================================================================
// Helpers
// ============================================================================

function getSortValue(req: Requirement, field: RequirementSortField): string | number | Date | null {
	switch (field) {
		case "requirementId":
			return req.requirementId;
		case "category":
			return req.category;
		case "priority":
			// Sort by priority weight
			return req.priority
				? { mandatory: 0, preferred: 1, optional: 2 }[req.priority]
				: 99;
		case "complianceStatus":
			return req.complianceStatus;
		case "riskLevel":
			// Sort by risk weight
			return req.riskLevel
				? { critical: 0, high: 1, medium: 2, low: 3 }[req.riskLevel]
				: 99;
		case "dueDate":
			return req.dueDate;
		case "createdAt":
			return req.createdAt;
		case "updatedAt":
			return req.updatedAt;
		default:
			return null;
	}
}
