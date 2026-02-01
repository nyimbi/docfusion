"use client";

/**
 * PersonnelDatabase Component
 *
 * Main personnel listing interface with comprehensive filtering,
 * search, bulk operations, and multiple view modes. Supports
 * skill-based filtering, clearance level filtering, and availability status.
 */

import { useState, useCallback, useMemo } from "react";
import {
	Search,
	Filter,
	Grid,
	List,
	Download,
	Upload,
	Plus,
	Trash2,
	Mail,
	Users,
	Shield,
	Award,
	Calendar,
	SortAsc,
	SortDesc,
	RefreshCw,
	X,
	CheckSquare,
	Square,
	FileText,
	MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PersonnelCard } from "./PersonnelCard";
import type { Personnel } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface PersonnelDatabaseProps {
	personnel: Personnel[];
	loading?: boolean;
	onSearch?: (query: string, filters: PersonnelFilters) => void;
	onCreateNew?: () => void;
	onEdit?: (id: string) => void;
	onDelete?: (ids: string[]) => void;
	onImport?: () => void;
	onExport?: (ids: string[], format: string) => void;
	onBulkEmail?: (ids: string[]) => void;
	onViewResume?: (id: string) => void;
	onGenerateResume?: (id: string) => void;
	className?: string;
}

interface PersonnelFilters {
	availability?: string[];
	clearanceLevel?: string[];
	department?: string[];
	skills?: string[];
	certifications?: string[];
	employmentType?: string[];
	yearsExperienceMin?: number;
	yearsExperienceMax?: number;
	hasActiveClearance?: boolean;
}

type ViewMode = "grid" | "list";
type SortField = "name" | "title" | "department" | "clearance" | "availability" | "experience" | "updated";
type SortDirection = "asc" | "desc";

// ============================================================================
// Constants
// ============================================================================

const AVAILABILITY_OPTIONS = [
	{ value: "available", label: "Available", color: "bg-green-100 text-green-800" },
	{ value: "partial", label: "Partially Available", color: "bg-yellow-100 text-yellow-800" },
	{ value: "committed", label: "Committed", color: "bg-orange-100 text-orange-800" },
	{ value: "unavailable", label: "Unavailable", color: "bg-red-100 text-red-800" },
];

const CLEARANCE_OPTIONS = [
	{ value: "none", label: "None" },
	{ value: "public_trust", label: "Public Trust" },
	{ value: "secret", label: "Secret" },
	{ value: "top_secret", label: "Top Secret" },
	{ value: "ts_sci", label: "TS/SCI" },
];

const EMPLOYMENT_TYPES = [
	{ value: "employee", label: "Employee" },
	{ value: "contractor", label: "Contractor" },
	{ value: "consultant", label: "Consultant" },
	{ value: "partner", label: "Partner" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function extractUniqueValues(personnel: Personnel[], field: keyof Personnel): string[] {
	const values = new Set<string>();
	personnel.forEach(p => {
		const value = p[field];
		if (typeof value === "string" && value) {
			values.add(value);
		}
	});
	return Array.from(values).sort();
}

function extractAllSkills(personnel: Personnel[]): string[] {
	const skills = new Set<string>();
	personnel.forEach(p => {
		(p.skills || []).forEach(s => skills.add(s.skillName));
	});
	return Array.from(skills).sort();
}

function extractAllCertifications(personnel: Personnel[]): string[] {
	const certs = new Set<string>();
	personnel.forEach(p => {
		(p.certifications || []).forEach(c => certs.add(c.name));
	});
	return Array.from(certs).sort();
}

function matchesFilters(person: Personnel, filters: PersonnelFilters): boolean {
	// Availability filter
	if (filters.availability?.length) {
		if (!person.availability || !filters.availability.includes(person.availability)) {
			return false;
		}
	}

	// Clearance filter
	if (filters.clearanceLevel?.length) {
		const clearance = person.clearanceLevel?.toLowerCase().replace(/[\s/]/g, "_") || "none";
		if (!filters.clearanceLevel.some(f => clearance.includes(f.replace(/[\s/]/g, "_")))) {
			return false;
		}
	}

	// Department filter
	if (filters.department?.length) {
		if (!person.department || !filters.department.includes(person.department)) {
			return false;
		}
	}

	// Skills filter
	if (filters.skills?.length) {
		const personSkills = (person.skills || []).map(s => s.skillName.toLowerCase());
		if (!filters.skills.some(skill => personSkills.includes(skill.toLowerCase()))) {
			return false;
		}
	}

	// Certifications filter
	if (filters.certifications?.length) {
		const personCerts = (person.certifications || []).map(c => c.name.toLowerCase());
		if (!filters.certifications.some(cert => personCerts.includes(cert.toLowerCase()))) {
			return false;
		}
	}

	// Employment type filter
	if (filters.employmentType?.length) {
		if (!person.employmentType || !filters.employmentType.includes(person.employmentType)) {
			return false;
		}
	}

	// Experience filter
	if (filters.yearsExperienceMin !== undefined) {
		if ((person.yearsOfExperience || 0) < filters.yearsExperienceMin) {
			return false;
		}
	}
	if (filters.yearsExperienceMax !== undefined) {
		if ((person.yearsOfExperience || 0) > filters.yearsExperienceMax) {
			return false;
		}
	}

	// Active clearance filter
	if (filters.hasActiveClearance) {
		if (person.clearanceStatus !== "active") {
			return false;
		}
	}

	return true;
}

function sortPersonnel(
	personnel: Personnel[],
	field: SortField,
	direction: SortDirection
): Personnel[] {
	return [...personnel].sort((a, b) => {
		let comparison = 0;

		switch (field) {
			case "name":
				comparison = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
				break;
			case "title":
				comparison = (a.currentTitle || "").localeCompare(b.currentTitle || "");
				break;
			case "department":
				comparison = (a.department || "").localeCompare(b.department || "");
				break;
			case "clearance":
				const clearanceOrder = { "ts_sci": 5, "top_secret": 4, "secret": 3, "public_trust": 2, "none": 1 };
				const aLevel = a.clearanceLevel?.toLowerCase().replace(/[\s/]/g, "_") || "none";
				const bLevel = b.clearanceLevel?.toLowerCase().replace(/[\s/]/g, "_") || "none";
				comparison = (clearanceOrder[aLevel as keyof typeof clearanceOrder] || 0) -
					(clearanceOrder[bLevel as keyof typeof clearanceOrder] || 0);
				break;
			case "availability":
				const availOrder = { available: 1, partial: 2, committed: 3, unavailable: 4 };
				comparison = (availOrder[a.availability as keyof typeof availOrder] || 5) -
					(availOrder[b.availability as keyof typeof availOrder] || 5);
				break;
			case "experience":
				comparison = (a.yearsOfExperience || 0) - (b.yearsOfExperience || 0);
				break;
			case "updated":
				comparison = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
				break;
		}

		return direction === "asc" ? comparison : -comparison;
	});
}

// ============================================================================
// Filter Panel Component
// ============================================================================

function FilterPanel({
	filters,
	onChange,
	personnel,
	onClear,
}: {
	filters: PersonnelFilters;
	onChange: (filters: PersonnelFilters) => void;
	personnel: Personnel[];
	onClear: () => void;
}) {
	const departments = useMemo(() => extractUniqueValues(personnel, "department"), [personnel]);
	const skills = useMemo(() => extractAllSkills(personnel), [personnel]);
	const certifications = useMemo(() => extractAllCertifications(personnel), [personnel]);

	const activeFilterCount = useMemo(() => {
		let count = 0;
		if (filters.availability?.length) count++;
		if (filters.clearanceLevel?.length) count++;
		if (filters.department?.length) count++;
		if (filters.skills?.length) count++;
		if (filters.certifications?.length) count++;
		if (filters.employmentType?.length) count++;
		if (filters.yearsExperienceMin !== undefined) count++;
		if (filters.yearsExperienceMax !== undefined) count++;
		if (filters.hasActiveClearance) count++;
		return count;
	}, [filters]);

	const toggleFilter = (key: keyof PersonnelFilters, value: string) => {
		const current = (filters[key] as string[]) || [];
		const updated = current.includes(value)
			? current.filter(v => v !== value)
			: [...current, value];
		onChange({ ...filters, [key]: updated.length ? updated : undefined });
	};

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base flex items-center gap-2">
						<Filter className="h-4 w-4" />
						Filters
						{activeFilterCount > 0 && (
							<Badge variant="secondary" className="text-xs">
								{activeFilterCount}
							</Badge>
						)}
					</CardTitle>
					{activeFilterCount > 0 && (
						<Button variant="ghost" size="sm" onClick={onClear}>
							Clear All
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Availability */}
				<div>
					<h4 className="text-sm font-medium mb-2">Availability</h4>
					<div className="flex flex-wrap gap-2">
						{AVAILABILITY_OPTIONS.map(opt => (
							<Badge
								key={opt.value}
								variant="outline"
								className={cn(
									"cursor-pointer transition-colors",
									filters.availability?.includes(opt.value) && opt.color
								)}
								onClick={() => toggleFilter("availability", opt.value)}
							>
								{opt.label}
							</Badge>
						))}
					</div>
				</div>

				{/* Clearance */}
				<div>
					<h4 className="text-sm font-medium mb-2">Clearance Level</h4>
					<div className="flex flex-wrap gap-2">
						{CLEARANCE_OPTIONS.map(opt => (
							<Badge
								key={opt.value}
								variant="outline"
								className={cn(
									"cursor-pointer transition-colors",
									filters.clearanceLevel?.includes(opt.value) && "bg-primary text-primary-foreground"
								)}
								onClick={() => toggleFilter("clearanceLevel", opt.value)}
							>
								{opt.label}
							</Badge>
						))}
					</div>
					<div className="flex items-center gap-2 mt-2">
						<Checkbox
							id="activeClearance"
							checked={filters.hasActiveClearance || false}
							onCheckedChange={(checked) =>
								onChange({ ...filters, hasActiveClearance: checked ? true : undefined })
							}
						/>
						<label htmlFor="activeClearance" className="text-sm">
							Active clearance only
						</label>
					</div>
				</div>

				{/* Employment Type */}
				<div>
					<h4 className="text-sm font-medium mb-2">Employment Type</h4>
					<div className="flex flex-wrap gap-2">
						{EMPLOYMENT_TYPES.map(opt => (
							<Badge
								key={opt.value}
								variant="outline"
								className={cn(
									"cursor-pointer transition-colors",
									filters.employmentType?.includes(opt.value) && "bg-primary text-primary-foreground"
								)}
								onClick={() => toggleFilter("employmentType", opt.value)}
							>
								{opt.label}
							</Badge>
						))}
					</div>
				</div>

				{/* Department */}
				{departments.length > 0 && (
					<div>
						<h4 className="text-sm font-medium mb-2">Department</h4>
						<Select
							value={filters.department?.[0] || ""}
							onValueChange={(value) => onChange({ ...filters, department: value ? [value] : undefined })}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All departments" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">All departments</SelectItem>
								{departments.map(dept => (
									<SelectItem key={dept} value={dept}>{dept}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Skills */}
				{skills.length > 0 && (
					<div>
						<h4 className="text-sm font-medium mb-2">Skills</h4>
						<ScrollArea className="h-32">
							<div className="flex flex-wrap gap-1">
								{skills.slice(0, 20).map(skill => (
									<Badge
										key={skill}
										variant="outline"
										className={cn(
											"cursor-pointer text-xs transition-colors",
											filters.skills?.includes(skill) && "bg-primary text-primary-foreground"
										)}
										onClick={() => toggleFilter("skills", skill)}
									>
										{skill}
									</Badge>
								))}
								{skills.length > 20 && (
									<span className="text-xs text-muted-foreground">
										+{skills.length - 20} more
									</span>
								)}
							</div>
						</ScrollArea>
					</div>
				)}

				{/* Experience Range */}
				<div>
					<h4 className="text-sm font-medium mb-2">Years of Experience</h4>
					<div className="flex items-center gap-2">
						<Input
							type="number"
							placeholder="Min"
							className="w-20"
							min={0}
							value={filters.yearsExperienceMin ?? ""}
							onChange={(e) => onChange({
								...filters,
								yearsExperienceMin: e.target.value ? parseInt(e.target.value) : undefined
							})}
						/>
						<span className="text-muted-foreground">to</span>
						<Input
							type="number"
							placeholder="Max"
							className="w-20"
							min={0}
							value={filters.yearsExperienceMax ?? ""}
							onChange={(e) => onChange({
								...filters,
								yearsExperienceMax: e.target.value ? parseInt(e.target.value) : undefined
							})}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function PersonnelDatabase({
	personnel,
	loading = false,
	onSearch,
	onCreateNew,
	onEdit,
	onDelete,
	onImport,
	onExport,
	onBulkEmail,
	onViewResume,
	onGenerateResume,
	className,
}: PersonnelDatabaseProps) {
	// State
	const [searchQuery, setSearchQuery] = useState("");
	const [filters, setFilters] = useState<PersonnelFilters>({});
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [sortField, setSortField] = useState<SortField>("name");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [showFilters, setShowFilters] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	// Computed data
	const filteredPersonnel = useMemo(() => {
		let result = personnel;

		// Text search
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(p =>
				`${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
				p.email?.toLowerCase().includes(query) ||
				p.currentTitle?.toLowerCase().includes(query) ||
				p.department?.toLowerCase().includes(query) ||
				(p.skills || []).some(s => s.skillName.toLowerCase().includes(query))
			);
		}

		// Apply filters
		result = result.filter(p => matchesFilters(p, filters));

		// Sort
		result = sortPersonnel(result, sortField, sortDirection);

		return result;
	}, [personnel, searchQuery, filters, sortField, sortDirection]);

	// Stats
	const stats = useMemo(() => ({
		total: personnel.length,
		available: personnel.filter(p => p.availability === "available").length,
		withClearance: personnel.filter(p => p.clearanceLevel && p.clearanceStatus === "active").length,
		filtered: filteredPersonnel.length,
	}), [personnel, filteredPersonnel]);

	// Handlers
	const handleSearch = useCallback((e: React.FormEvent) => {
		e.preventDefault();
		onSearch?.(searchQuery, filters);
	}, [searchQuery, filters, onSearch]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(d => d === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
	};

	const toggleSelection = (id: string, selected: boolean) => {
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (selected) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	};

	const selectAll = () => {
		if (selectedIds.size === filteredPersonnel.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredPersonnel.map(p => p.id)));
		}
	};

	const handleDelete = () => {
		onDelete?.(Array.from(selectedIds));
		setSelectedIds(new Set());
		setDeleteDialogOpen(false);
	};

	const clearFilters = () => {
		setFilters({});
		setSearchQuery("");
	};

	// Render
	return (
		<div className={cn("space-y-4", className)}>
			{/* Header Stats */}
			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Users className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-2xl font-bold">{stats.total}</p>
								<p className="text-xs text-muted-foreground">Total Personnel</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Calendar className="h-5 w-5 text-green-500" />
							<div>
								<p className="text-2xl font-bold">{stats.available}</p>
								<p className="text-xs text-muted-foreground">Available</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Shield className="h-5 w-5 text-blue-500" />
							<div>
								<p className="text-2xl font-bold">{stats.withClearance}</p>
								<p className="text-xs text-muted-foreground">Active Clearance</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Filter className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-2xl font-bold">{stats.filtered}</p>
								<p className="text-xs text-muted-foreground">Matching Filters</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Toolbar */}
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex items-center gap-2 flex-1">
					<form onSubmit={handleSearch} className="flex-1 max-w-md">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by name, title, skills..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
							{searchQuery && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
									onClick={() => setSearchQuery("")}
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
					</form>

					<Button
						variant={showFilters ? "primary" : "outline"}
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className="h-4 w-4 mr-2" />
						Filters
						{Object.values(filters).some(v => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)) && (
							<Badge variant="secondary" className="ml-2">
								Active
							</Badge>
						)}
					</Button>

					<Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Sort by..." />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name">Name</SelectItem>
							<SelectItem value="title">Title</SelectItem>
							<SelectItem value="department">Department</SelectItem>
							<SelectItem value="clearance">Clearance</SelectItem>
							<SelectItem value="availability">Availability</SelectItem>
							<SelectItem value="experience">Experience</SelectItem>
							<SelectItem value="updated">Last Updated</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}
					>
						{sortDirection === "asc" ? (
							<SortAsc className="h-4 w-4" />
						) : (
							<SortDesc className="h-4 w-4" />
						)}
					</Button>
				</div>

				<div className="flex items-center gap-2">
					{/* View Mode Toggle */}
					<div className="border rounded-md p-1">
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode("grid")}
						>
							<Grid className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "list" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode("list")}
						>
							<List className="h-4 w-4" />
						</Button>
					</div>

					{/* Actions */}
					<Button variant="outline" onClick={onImport}>
						<Upload className="h-4 w-4 mr-2" />
						Import
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onClick={() => onExport?.(Array.from(selectedIds), "csv")}>
								Export as CSV
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onExport?.(Array.from(selectedIds), "excel")}>
								Export as Excel
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onExport?.(Array.from(selectedIds), "json")}>
								Export as JSON
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Button onClick={onCreateNew}>
						<Plus className="h-4 w-4 mr-2" />
						Add Personnel
					</Button>
				</div>
			</div>

			{/* Bulk Actions */}
			{selectedIds.size > 0 && (
				<div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
					<Checkbox
						checked={selectedIds.size === filteredPersonnel.length}
						onCheckedChange={selectAll}
					/>
					<span className="text-sm font-medium">
						{selectedIds.size} selected
					</span>
					<div className="flex items-center gap-2 ml-auto">
						<Button variant="outline" size="sm" onClick={() => onBulkEmail?.(Array.from(selectedIds))}>
							<Mail className="h-4 w-4 mr-2" />
							Email
						</Button>
						<Button variant="outline" size="sm" onClick={() => onExport?.(Array.from(selectedIds), "csv")}>
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
						<Button variant="danger" size="sm" onClick={() => setDeleteDialogOpen(true)}>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</div>
				</div>
			)}

			{/* Main Content */}
			<div className="flex gap-4">
				{/* Filter Panel */}
				{showFilters && (
					<div className="w-72 flex-shrink-0">
						<FilterPanel
							filters={filters}
							onChange={setFilters}
							personnel={personnel}
							onClear={clearFilters}
						/>
					</div>
				)}

				{/* Personnel List/Grid */}
				<div className="flex-1">
					{loading ? (
						<div className="flex items-center justify-center h-64">
							<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : filteredPersonnel.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center h-64">
								<Users className="h-12 w-12 text-muted-foreground mb-4" />
								<h3 className="text-lg font-medium">No personnel found</h3>
								<p className="text-sm text-muted-foreground">
									{searchQuery || Object.keys(filters).length > 0
										? "Try adjusting your search or filters"
										: "Add personnel to get started"
									}
								</p>
								{(searchQuery || Object.keys(filters).length > 0) && (
									<Button variant="outline" className="mt-4" onClick={clearFilters}>
										Clear Filters
									</Button>
								)}
							</CardContent>
						</Card>
					) : viewMode === "grid" ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredPersonnel.map(person => (
								<PersonnelCard
									key={person.id}
									personnel={person}
									variant="compact"
									selected={selectedIds.has(person.id)}
									onSelect={toggleSelection}
									onEdit={onEdit}
									onViewResume={onViewResume}
									onGenerateResume={onGenerateResume}
								/>
							))}
						</div>
					) : (
						<Card>
							<div className="divide-y">
								{/* List Header */}
								<div className="flex items-center gap-4 p-4 bg-muted/50 text-sm font-medium">
									<div className="w-10">
										<Checkbox
											checked={selectedIds.size === filteredPersonnel.length && filteredPersonnel.length > 0}
											onCheckedChange={selectAll}
										/>
									</div>
									<div className="flex-1 grid grid-cols-5 gap-4">
										<button
											className="col-span-1 flex items-center gap-1 text-left hover:text-primary"
											onClick={() => toggleSort("name")}
										>
											Name
											{sortField === "name" && (
												sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
											)}
										</button>
										<button
											className="col-span-1 flex items-center gap-1 text-left hover:text-primary"
											onClick={() => toggleSort("department")}
										>
											Department
										</button>
										<button
											className="col-span-1 flex items-center gap-1 text-left hover:text-primary"
											onClick={() => toggleSort("clearance")}
										>
											Clearance
										</button>
										<button
											className="col-span-1 flex items-center gap-1 text-left hover:text-primary"
											onClick={() => toggleSort("availability")}
										>
											Status
										</button>
										<button
											className="col-span-1 flex items-center gap-1 text-left hover:text-primary"
											onClick={() => toggleSort("experience")}
										>
											Experience
										</button>
									</div>
								</div>

								{/* List Items */}
								{filteredPersonnel.map(person => (
									<PersonnelCard
										key={person.id}
										personnel={person}
										variant="list"
										selected={selectedIds.has(person.id)}
										onSelect={toggleSelection}
										onEdit={onEdit}
										onViewResume={onViewResume}
										onGenerateResume={onGenerateResume}
									/>
								))}
							</div>
						</Card>
					)}

					{/* Results Count */}
					{filteredPersonnel.length > 0 && (
						<p className="text-sm text-muted-foreground mt-4 text-center">
							Showing {filteredPersonnel.length} of {personnel.length} personnel
						</p>
					)}
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Personnel</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete {selectedIds.size} personnel record(s)?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDelete}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default PersonnelDatabase;
