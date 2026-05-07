/**
 * Project Database Component
 *
 * Main interface for browsing, searching, and managing past performance projects
 * with filtering, sorting, and bulk operations.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Search,
	Plus,
	Filter,
	SortAsc,
	SortDesc,
	Grid,
	List,
	Upload,
	Download,
	MoreHorizontal,
	Trash2,
	Star,
	Building2,
	Calendar,
	DollarSign,
	RefreshCw,
	AlertCircle,
	CheckCircle,
	Clock,
	LayoutGrid,
	FileSpreadsheet,
} from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface ProjectDatabaseProps {
	projects: Project[];
	onCreateProject: () => void;
	onEditProject: (projectId: string) => void;
	onDeleteProject: (projectId: string) => Promise<void>;
	onDuplicateProject: (projectId: string) => Promise<void>;
	onViewProject: (projectId: string) => void;
	onImport: () => void;
	onExport: (projectIds: string[]) => void;
	onRefresh: () => void;
	isLoading?: boolean;
}

interface FilterState {
	search: string;
	customer: string;
	contractType: string;
	referenceStatus: string;
	minRating: number;
	technicalArea: string;
	dateRange: "all" | "1y" | "3y" | "5y";
	primeOrSub: "all" | "prime" | "subcontractor";
	active: "all" | "active" | "inactive";
}

type SortField = "name" | "customerName" | "contractValue" | "cparOverall" | "updatedAt";
type SortDirection = "asc" | "desc";

// ============================================================================
// Helper Functions
// ============================================================================

function getDateCutoff(range: string): Date | null {
	const now = new Date();
	switch (range) {
		case "1y":
			return new Date(now.setFullYear(now.getFullYear() - 1));
		case "3y":
			return new Date(now.setFullYear(now.getFullYear() - 3));
		case "5y":
			return new Date(now.setFullYear(now.getFullYear() - 5));
		default:
			return null;
	}
}

function getCPAROverall(project: Project): number {
	const ratings = project.cparRatings as { overall: number } | null;
	return ratings?.overall || 0;
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Bulk actions bar
 */
function BulkActionsBar({
	selectedCount,
	onDelete,
	onExport,
	onClearSelection,
}: {
	selectedCount: number;
	onDelete: () => void;
	onExport: () => void;
	onClearSelection: () => void;
}) {
	if (selectedCount === 0) return null;

	return (
		<div className="flex items-center justify-between p-3 bg-primary/10 border rounded-lg">
			<div className="flex items-center gap-2">
				<CheckCircle className="h-4 w-4 text-primary" />
				<span className="text-sm font-medium">
					{selectedCount} project{selectedCount > 1 ? "s" : ""} selected
				</span>
			</div>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={onExport}>
					<Download className="h-4 w-4 mr-1" />
					Export
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onDelete}
					className="text-destructive hover:text-destructive"
				>
					<Trash2 className="h-4 w-4 mr-1" />
					Delete
				</Button>
				<Button variant="ghost" size="sm" onClick={onClearSelection}>
					Clear
				</Button>
			</div>
		</div>
	);
}

/**
 * Statistics summary
 */
function ProjectStats({ projects }: { projects: Project[] }) {
	const stats = useMemo(() => {
		const totalValue = projects.reduce(
			(sum, p) => sum + (p.contractValue || 0),
			0
		);
		const avgRating =
			projects.reduce((sum, p) => sum + getCPAROverall(p), 0) /
			(projects.length || 1);
		const availableRefs = projects.filter(
			(p) => p.referenceStatus === "available"
		).length;

		return {
			count: projects.length,
			totalValue,
			avgRating,
			availableRefs,
		};
	}, [projects]);

	const formatValue = (value: number) => {
		if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
		if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
		return `$${(value / 1_000).toFixed(0)}K`;
	};

	return (
		<div className="grid grid-cols-4 gap-4">
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-primary/10 rounded-lg">
							<FileSpreadsheet className="h-5 w-5 text-primary" />
						</div>
						<div>
							<p className="text-2xl font-bold">{stats.count}</p>
							<p className="text-xs text-muted-foreground">Total Projects</p>
						</div>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-green-500/10 rounded-lg">
							<DollarSign className="h-5 w-5 text-green-600" />
						</div>
						<div>
							<p className="text-2xl font-bold">{formatValue(stats.totalValue)}</p>
							<p className="text-xs text-muted-foreground">Total Value</p>
						</div>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-yellow-500/10 rounded-lg">
							<Star className="h-5 w-5 text-yellow-600" />
						</div>
						<div>
							<p className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</p>
							<p className="text-xs text-muted-foreground">Avg CPAR Rating</p>
						</div>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-blue-500/10 rounded-lg">
							<CheckCircle className="h-5 w-5 text-blue-600" />
						</div>
						<div>
							<p className="text-2xl font-bold">{stats.availableRefs}</p>
							<p className="text-xs text-muted-foreground">Available Refs</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectDatabase({
	projects,
	onCreateProject,
	onEditProject,
	onDeleteProject,
	onDuplicateProject,
	onViewProject,
	onImport,
	onExport,
	onRefresh,
	isLoading = false,
}: ProjectDatabaseProps) {
	// View state
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

	// Filter state
	const [filters, setFilters] = useState<FilterState>({
		search: "",
		customer: "",
		contractType: "",
		referenceStatus: "",
		minRating: 0,
		technicalArea: "",
		dateRange: "all",
		primeOrSub: "all",
		active: "all",
	});

	// Sort state
	const [sortField, setSortField] = useState<SortField>("updatedAt");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	// Update filter
	const updateFilter = useCallback(
		<K extends keyof FilterState>(field: K, value: FilterState[K]) => {
			setFilters((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	// Get unique values for filters
	const filterOptions = useMemo(() => {
		const customers = new Set<string>();
		const contractTypes = new Set<string>();
		const technicalAreas = new Set<string>();

		projects.forEach((p) => {
			if (p.customerName) customers.add(p.customerName);
			if (p.contractType) contractTypes.add(p.contractType);
			const areas = p.technicalAreas as string[] | null;
			areas?.forEach((a) => technicalAreas.add(a));
		});

		return {
			customers: Array.from(customers).sort(),
			contractTypes: Array.from(contractTypes).sort(),
			technicalAreas: Array.from(technicalAreas).sort(),
		};
	}, [projects]);

	// Filter and sort projects
	const filteredProjects = useMemo(() => {
		let result = [...projects];

		// Search filter
		if (filters.search) {
			const search = filters.search.toLowerCase();
			result = result.filter(
				(p) =>
					p.name.toLowerCase().includes(search) ||
					p.customerName.toLowerCase().includes(search) ||
					p.contractNumber?.toLowerCase().includes(search) ||
					p.description?.toLowerCase().includes(search)
			);
		}

		// Customer filter
		if (filters.customer) {
			result = result.filter((p) => p.customerName === filters.customer);
		}

		// Contract type filter
		if (filters.contractType) {
			result = result.filter((p) => p.contractType === filters.contractType);
		}

		// Reference status filter
		if (filters.referenceStatus) {
			result = result.filter((p) => p.referenceStatus === filters.referenceStatus);
		}

		// Minimum rating filter
		if (filters.minRating > 0) {
			result = result.filter((p) => getCPAROverall(p) >= filters.minRating);
		}

		// Technical area filter
		if (filters.technicalArea) {
			result = result.filter((p) => {
				const areas = p.technicalAreas as string[] | null;
				return areas?.includes(filters.technicalArea);
			});
		}

		// Date range filter
		const dateCutoff = getDateCutoff(filters.dateRange);
		if (dateCutoff) {
			result = result.filter((p) => {
				const period = p.periodOfPerformance as { end: string } | null;
				if (!period?.end) return false;
				return new Date(period.end) >= dateCutoff;
			});
		}

		// Prime/Sub filter
		if (filters.primeOrSub !== "all") {
			result = result.filter((p) => p.primeOrSub === filters.primeOrSub);
		}

		// Active filter
		if (filters.active !== "all") {
			result = result.filter((p) =>
				filters.active === "active" ? p.isActive : !p.isActive
			);
		}

		// Sort
		result.sort((a, b) => {
			let aValue: string | number;
			let bValue: string | number;

			switch (sortField) {
				case "name":
					aValue = a.name.toLowerCase();
					bValue = b.name.toLowerCase();
					break;
				case "customerName":
					aValue = a.customerName.toLowerCase();
					bValue = b.customerName.toLowerCase();
					break;
				case "contractValue":
					aValue = a.contractValue || 0;
					bValue = b.contractValue || 0;
					break;
				case "cparOverall":
					aValue = getCPAROverall(a);
					bValue = getCPAROverall(b);
					break;
				case "updatedAt":
					aValue = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
					bValue = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
					break;
				default:
					aValue = a.name;
					bValue = b.name;
			}

			if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
			if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return result;
	}, [projects, filters, sortField, sortDirection]);

	// Selection handlers
	const toggleSelection = useCallback((projectId: string, selected: boolean) => {
		setSelectedProjects((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(projectId);
			} else {
				next.delete(projectId);
			}
			return next;
		});
	}, []);

	const selectAll = useCallback(() => {
		setSelectedProjects(new Set(filteredProjects.map((p) => p.id)));
	}, [filteredProjects]);

	const clearSelection = useCallback(() => {
		setSelectedProjects(new Set());
	}, []);

	// Delete handlers
	const handleDeleteClick = useCallback((projectId: string) => {
		setProjectToDelete(projectId);
		setShowDeleteConfirm(true);
	}, []);

	const handleDeleteConfirm = useCallback(async () => {
		if (projectToDelete) {
			await onDeleteProject(projectToDelete);
			setSelectedProjects((prev) => {
				const next = new Set(prev);
				next.delete(projectToDelete);
				return next;
			});
		}
		setShowDeleteConfirm(false);
		setProjectToDelete(null);
	}, [projectToDelete, onDeleteProject]);

	const handleBulkDelete = useCallback(async () => {
		for (const id of selectedProjects) {
			await onDeleteProject(id);
		}
		clearSelection();
	}, [selectedProjects, onDeleteProject, clearSelection]);

	// Export selected
	const handleExportSelected = useCallback(() => {
		onExport(Array.from(selectedProjects));
	}, [selectedProjects, onExport]);

	// Reset filters
	const resetFilters = useCallback(() => {
		setFilters({
			search: "",
			customer: "",
			contractType: "",
			referenceStatus: "",
			minRating: 0,
			technicalArea: "",
			dateRange: "all",
			primeOrSub: "all",
			active: "all",
		});
	}, []);

	const hasActiveFilters = useMemo(() => {
		return (
			filters.search ||
			filters.customer ||
			filters.contractType ||
			filters.referenceStatus ||
			filters.minRating > 0 ||
			filters.technicalArea ||
			filters.dateRange !== "all" ||
			filters.primeOrSub !== "all" ||
			filters.active !== "all"
		);
	}, [filters]);

	return (
		<div className="space-y-6">
			{/* Statistics */}
			<ProjectStats projects={projects} />

			{/* Toolbar */}
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2 flex-1">
					{/* Search */}
					<div className="relative flex-1 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={filters.search}
							onChange={(e) => updateFilter("search", e.target.value)}
							placeholder="Search projects..."
							className="pl-9"
						/>
					</div>

					{/* Filter dropdowns */}
					<Select
						value={filters.customer || "all"}
						onValueChange={(v) => updateFilter("customer", v === "all" ? "" : v)}
					>
						<SelectTrigger className="w-48">
							<Building2 className="h-4 w-4 mr-2" />
							<SelectValue placeholder="Customer" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Customers</SelectItem>
							{filterOptions.customers.map((c) => (
								<SelectItem key={c} value={c}>
									{c}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={filters.referenceStatus || "all"}
						onValueChange={(v) =>
							updateFilter("referenceStatus", v === "all" ? "" : v)
						}
					>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Reference" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="available">Available</SelectItem>
							<SelectItem value="limited">Limited</SelectItem>
							<SelectItem value="unavailable">Unavailable</SelectItem>
						</SelectContent>
					</Select>

					{/* More filters dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="gap-1">
								<Filter className="h-4 w-4" />
								More
								{hasActiveFilters && (
									<Badge variant="secondary" className="ml-1 px-1">
										!
									</Badge>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-64">
							<DropdownMenuLabel>Filters</DropdownMenuLabel>
							<DropdownMenuSeparator />

							<div className="p-2 space-y-3">
								<div className="space-y-1">
									<span className="text-xs font-medium">Contract Type</span>
									<Select
										value={filters.contractType || "all"}
										onValueChange={(v) =>
											updateFilter("contractType", v === "all" ? "" : v)
										}
									>
										<SelectTrigger className="h-8" aria-label="Contract Type">
											<SelectValue placeholder="All types" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Types</SelectItem>
											{filterOptions.contractTypes.map((t) => (
												<SelectItem key={t} value={t}>
													{t}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="text-xs font-medium">Date Range</span>
									<Select
										value={filters.dateRange}
										onValueChange={(v: FilterState["dateRange"]) =>
											updateFilter("dateRange", v)
										}
									>
										<SelectTrigger className="h-8" aria-label="Date Range">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Time</SelectItem>
											<SelectItem value="1y">Last Year</SelectItem>
											<SelectItem value="3y">Last 3 Years</SelectItem>
											<SelectItem value="5y">Last 5 Years</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="text-xs font-medium">Role</span>
									<Select
										value={filters.primeOrSub}
										onValueChange={(v: FilterState["primeOrSub"]) =>
											updateFilter("primeOrSub", v)
										}
									>
										<SelectTrigger className="h-8" aria-label="Role">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Roles</SelectItem>
											<SelectItem value="prime">Prime</SelectItem>
											<SelectItem value="subcontractor">Subcontractor</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<span className="text-xs font-medium">Min CPAR Rating</span>
									<Select
										value={filters.minRating.toString()}
										onValueChange={(v) => updateFilter("minRating", parseFloat(v))}
									>
										<SelectTrigger className="h-8" aria-label="Min CPAR Rating">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="0">Any Rating</SelectItem>
											<SelectItem value="3">3.0+</SelectItem>
											<SelectItem value="3.5">3.5+</SelectItem>
											<SelectItem value="4">4.0+</SelectItem>
											<SelectItem value="4.5">4.5+</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={resetFilters}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Reset All Filters
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					{/* Sort */}
					<Select
						value={`${sortField}-${sortDirection}`}
						onValueChange={(v) => {
							const [field, dir] = v.split("-") as [SortField, SortDirection];
							setSortField(field);
							setSortDirection(dir);
						}}
					>
						<SelectTrigger className="w-40">
							{sortDirection === "asc" ? (
								<SortAsc className="h-4 w-4 mr-2" />
							) : (
								<SortDesc className="h-4 w-4 mr-2" />
							)}
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="updatedAt-desc">Recently Updated</SelectItem>
							<SelectItem value="updatedAt-asc">Oldest Updated</SelectItem>
							<SelectItem value="name-asc">Name A-Z</SelectItem>
							<SelectItem value="name-desc">Name Z-A</SelectItem>
							<SelectItem value="contractValue-desc">Value (High-Low)</SelectItem>
							<SelectItem value="contractValue-asc">Value (Low-High)</SelectItem>
							<SelectItem value="cparOverall-desc">Rating (High-Low)</SelectItem>
							<SelectItem value="cparOverall-asc">Rating (Low-High)</SelectItem>
						</SelectContent>
					</Select>

					{/* View toggle */}
					<div className="flex border rounded-md">
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-r-none"
							onClick={() => setViewMode("grid")}
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "list" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-l-none"
							onClick={() => setViewMode("list")}
						>
							<List className="h-4 w-4" />
						</Button>
					</div>

					{/* Import/Export */}
					<Button variant="outline" onClick={onImport}>
						<Upload className="h-4 w-4 mr-1" />
						Import
					</Button>

					{/* Create */}
					<Button onClick={onCreateProject}>
						<Plus className="h-4 w-4 mr-1" />
						Add Project
					</Button>
				</div>
			</div>

			{/* Bulk Actions */}
			<BulkActionsBar
				selectedCount={selectedProjects.size}
				onDelete={handleBulkDelete}
				onExport={handleExportSelected}
				onClearSelection={clearSelection}
			/>

			{/* Results Count */}
			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<div className="flex items-center gap-2">
					<span>
						Showing {filteredProjects.length} of {projects.length} projects
					</span>
					{hasActiveFilters && (
						<Button variant="link" size="sm" onClick={resetFilters} className="h-auto p-0">
							Clear filters
						</Button>
					)}
				</div>
				{filteredProjects.length > 0 && (
					<Button variant="ghost" size="sm" onClick={selectAll}>
						Select All
					</Button>
				)}
			</div>

			{/* Project Grid/List */}
			{filteredProjects.length === 0 ? (
				<Card>
					<CardContent className="p-12 text-center">
						{hasActiveFilters ? (
							<>
								<AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
								<p className="text-lg font-medium mb-2">No projects match your filters</p>
								<p className="text-muted-foreground mb-4">
									Try adjusting your search criteria
								</p>
								<Button variant="outline" onClick={resetFilters}>
									Reset Filters
								</Button>
							</>
						) : (
							<>
								<FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
								<p className="text-lg font-medium mb-2">No projects yet</p>
								<p className="text-muted-foreground mb-4">
									Add your first past performance project to get started
								</p>
								<div className="flex items-center justify-center gap-2">
									<Button variant="outline" onClick={onImport}>
										<Upload className="h-4 w-4 mr-1" />
										Import Projects
									</Button>
									<Button onClick={onCreateProject}>
										<Plus className="h-4 w-4 mr-1" />
										Add Project
									</Button>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			) : viewMode === "grid" ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filteredProjects.map((project) => (
						<ProjectCard
							key={project.id}
							project={project}
							isSelected={selectedProjects.has(project.id)}
							onSelect={toggleSelection}
							onEdit={onEditProject}
							onDelete={handleDeleteClick}
							onDuplicate={onDuplicateProject}
							onViewDetails={onViewProject}
						/>
					))}
				</div>
			) : (
				<div className="space-y-2">
					{filteredProjects.map((project) => (
						<ProjectCard
							key={project.id}
							project={project}
							compact
							isSelected={selectedProjects.has(project.id)}
							onSelect={toggleSelection}
							onEdit={onEditProject}
							onDelete={handleDeleteClick}
							onDuplicate={onDuplicateProject}
							onViewDetails={onViewProject}
						/>
					))}
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Project</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this project? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDeleteConfirm}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default ProjectDatabase;
