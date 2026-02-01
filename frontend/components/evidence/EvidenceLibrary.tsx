/**
 * EvidenceLibrary - Main Evidence Management Interface
 *
 * Central hub for managing evidence with search, filtering, grid/list views,
 * strength tier badges, usage indicators, and quick actions.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Search,
	Filter,
	Grid,
	List,
	Plus,
	MoreHorizontal,
	Edit2,
	Copy,
	Archive,
	Trash2,
	Award,
	FileText,
	MessageSquareQuote,
	Briefcase,
	ShieldCheck,
	Zap,
	Users,
	TrendingUp,
	AlertCircle,
	Loader2,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	Evidence,
	EvidenceType,
	EvidenceStrengthTier,
	EvidenceFilters,
} from "@/lib/types/evidence";
import {
	listEvidence,
	deleteEvidence,
	duplicateEvidence,
	archiveEvidence,
} from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceLibraryProps {
	/** Organization ID to filter evidence */
	organizationId?: string;
	/** Callback when evidence is selected */
	onSelect?: (evidence: Evidence) => void;
	/** Callback to open evidence editor */
	onEdit?: (evidence: Evidence) => void;
	/** Callback to create new evidence */
	onCreate?: () => void;
	/** Additional CSS classes */
	className?: string;
}

type ViewMode = "grid" | "list";

// =============================================================================
// Constants
// =============================================================================

const EVIDENCE_TYPE_CONFIG: Record<
	string,
	{ label: string; icon: typeof Award; color: string; bgColor: string }
> = {
	metric: {
		label: "Metric",
		icon: TrendingUp,
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	testimonial: {
		label: "Testimonial",
		icon: MessageSquareQuote,
		color: "text-purple-600 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
	case_study: {
		label: "Case Study",
		icon: FileText,
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	certification: {
		label: "Certification",
		icon: ShieldCheck,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	capability: {
		label: "Capability",
		icon: Zap,
		color: "text-cyan-600 dark:text-cyan-400",
		bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
	},
	past_performance: {
		label: "Past Performance",
		icon: Briefcase,
		color: "text-indigo-600 dark:text-indigo-400",
		bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
	},
	reference: {
		label: "Reference",
		icon: Users,
		color: "text-pink-600 dark:text-pink-400",
		bgColor: "bg-pink-100 dark:bg-pink-900/30",
	},
	award: {
		label: "Award",
		icon: Award,
		color: "text-yellow-600 dark:text-yellow-400",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
	},
	publication: {
		label: "Publication",
		icon: FileText,
		color: "text-teal-600 dark:text-teal-400",
		bgColor: "bg-teal-100 dark:bg-teal-900/30",
	},
};

const STRENGTH_TIER_CONFIG: Record<
	EvidenceStrengthTier,
	{ label: string; color: string; bgColor: string }
> = {
	gold: {
		label: "Gold",
		color: "text-yellow-700 dark:text-yellow-400",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300",
	},
	silver: {
		label: "Silver",
		color: "text-gray-600 dark:text-gray-300",
		bgColor: "bg-gray-100 dark:bg-gray-700/30 border-gray-300",
	},
	bronze: {
		label: "Bronze",
		color: "text-orange-700 dark:text-orange-400",
		bgColor: "bg-orange-100 dark:bg-orange-900/30 border-orange-300",
	},
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function EvidenceLibrarySkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-32" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-64" />
						<Skeleton className="h-9 w-9" />
						<Skeleton className="h-9 w-24" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Skeleton className="h-10 w-full mb-4" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="border rounded-lg p-4 space-y-3">
							<Skeleton className="h-5 w-20" />
							<Skeleton className="h-6 w-full" />
							<Skeleton className="h-16 w-full" />
							<div className="flex justify-between">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-5 w-12" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Evidence Card Component
// =============================================================================

interface EvidenceCardProps {
	evidence: Evidence;
	viewMode: ViewMode;
	onSelect: () => void;
	onEdit: () => void;
	onDuplicate: () => void;
	onArchive: () => void;
	onDelete: () => void;
}

function EvidenceCard({
	evidence,
	viewMode,
	onSelect,
	onEdit,
	onDuplicate,
	onArchive,
	onDelete,
}: EvidenceCardProps) {
	const evidenceType = evidence.type ?? evidence.evidenceType ?? "capability";
	const typeConfig = EVIDENCE_TYPE_CONFIG[evidenceType] ?? EVIDENCE_TYPE_CONFIG.capability;
	const strengthConfig = STRENGTH_TIER_CONFIG[evidence.strengthTier ?? "bronze"] ?? STRENGTH_TIER_CONFIG.bronze;
	const TypeIcon = typeConfig.icon;

	if (viewMode === "list") {
		return (
			<div
				className={cn(
					"flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group",
					evidence.status === "archived" && "opacity-60"
				)}
				onClick={onSelect}
			>
				{/* Type Icon */}
				<div className={cn("p-2 rounded", typeConfig.bgColor)}>
					<TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
				</div>

				{/* Title and Content Preview */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<h4 className="font-medium truncate">{evidence.title}</h4>
						<Badge
							variant="outline"
							className={cn("text-xs border", strengthConfig.bgColor, strengthConfig.color)}
						>
							{strengthConfig.label}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground truncate mt-0.5">
						{evidence.content.substring(0, 100)}...
					</p>
				</div>

				{/* Category */}
				<Badge variant="secondary" className="hidden md:inline-flex">
					{evidence.category}
				</Badge>

				{/* Usage Count */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="text-sm text-muted-foreground flex items-center gap-1">
								<FileText className="h-3 w-3" />
								{evidence.usageCount}
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Used {evidence.usageCount} times</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Actions */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 opacity-0 group-hover:opacity-100"
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
							<Edit2 className="h-4 w-4 mr-2" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
							<Copy className="h-4 w-4 mr-2" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
							<Archive className="h-4 w-4 mr-2" />
							Archive
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={(e) => { e.stopPropagation(); onDelete(); }}
							className="text-destructive"
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		);
	}

	// Grid view
	return (
		<div
			className={cn(
				"border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group",
				evidence.status === "archived" && "opacity-60"
			)}
			onClick={onSelect}
		>
			{/* Header */}
			<div className="flex items-start justify-between mb-3">
				<Badge
					variant="secondary"
					className={cn("gap-1", typeConfig.bgColor, typeConfig.color)}
				>
					<TypeIcon className="h-3 w-3" />
					{typeConfig.label}
				</Badge>
				<DropdownMenu>
					<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 -mr-1 -mt-1 opacity-0 group-hover:opacity-100"
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
							<Edit2 className="h-4 w-4 mr-2" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
							<Copy className="h-4 w-4 mr-2" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
							<Archive className="h-4 w-4 mr-2" />
							Archive
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={(e) => { e.stopPropagation(); onDelete(); }}
							className="text-destructive"
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Title */}
			<h4 className="font-medium line-clamp-1 mb-2">{evidence.title}</h4>

			{/* Content Preview */}
			<p className="text-sm text-muted-foreground line-clamp-3 mb-3">
				{evidence.content}
			</p>

			{/* Tags */}
			{evidence.tags.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-3">
					{evidence.tags.slice(0, 3).map((tag) => (
						<Badge key={tag} variant="outline" className="text-xs">
							{tag}
						</Badge>
					))}
					{evidence.tags.length > 3 && (
						<Badge variant="outline" className="text-xs">
							+{evidence.tags.length - 3}
						</Badge>
					)}
				</div>
			)}

			{/* Footer */}
			<div className="flex items-center justify-between pt-2 border-t">
				<Badge
					variant="outline"
					className={cn("text-xs border", strengthConfig.bgColor, strengthConfig.color)}
				>
					{strengthConfig.label} ({evidence.strengthScore})
				</Badge>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="text-xs text-muted-foreground flex items-center gap-1">
								<FileText className="h-3 w-3" />
								{evidence.usageCount} uses
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Used in {evidence.usageCount} documents</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceLibrary({
	organizationId,
	onSelect,
	onEdit,
	onCreate,
	className,
}: EvidenceLibraryProps) {
	// State
	const [evidence, setEvidence] = useState<Evidence[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [activeTab, setActiveTab] = useState<string>("all");
	const [selectedStrengthTiers, setSelectedStrengthTiers] = useState<EvidenceStrengthTier[]>([]);
	const [deleteDialogEvidence, setDeleteDialogEvidence] = useState<Evidence | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Load evidence
	useEffect(() => {
		async function loadEvidence() {
			setIsLoading(true);
			setError(null);

			const filters: EvidenceFilters = {};
			if (searchQuery) filters.query = searchQuery;
			if (activeTab !== "all") filters.types = [activeTab as EvidenceType];
			if (selectedStrengthTiers.length > 0) filters.strengthTiers = selectedStrengthTiers;

			const result = await listEvidence(filters);
			if (result.success && result.data) {
				setEvidence(result.data);
			} else if (!result.success) {
				setError(result.error);
			}
			setIsLoading(false);
		}
		loadEvidence();
	}, [organizationId, searchQuery, activeTab, selectedStrengthTiers]);

	// Filter evidence based on search
	const filteredEvidence = useMemo(() => {
		let filtered = evidence;

		if (activeTab !== "all") {
			filtered = filtered.filter((e) => (e.type ?? e.evidenceType) === activeTab);
		}

		if (selectedStrengthTiers.length > 0) {
			filtered = filtered.filter((e) => e.strengthTier && selectedStrengthTiers.includes(e.strengthTier));
		}

		return filtered;
	}, [evidence, activeTab, selectedStrengthTiers]);

	// Count by type for tabs
	const countByType = useMemo(() => {
		const counts: Record<string, number> = { all: evidence.length };
		evidence.forEach((e) => {
			const eType = e.type ?? e.evidenceType ?? "capability";
			counts[eType] = (counts[eType] || 0) + 1;
		});
		return counts;
	}, [evidence]);

	// Handlers
	const handleSelect = useCallback(
		(item: Evidence) => {
			onSelect?.(item);
		},
		[onSelect]
	);

	const handleEdit = useCallback(
		(item: Evidence) => {
			onEdit?.(item);
		},
		[onEdit]
	);

	const handleDuplicate = useCallback(async (item: Evidence) => {
		const result = await duplicateEvidence(item.id);
		if (result.success && result.data) {
			setEvidence((prev) => [result.data!, ...prev]);
		}
	}, []);

	const handleArchive = useCallback(async (item: Evidence) => {
		const result = await archiveEvidence(item.id);
		if (result.success && result.data) {
			setEvidence((prev) =>
				prev.map((e) => (e.id === item.id ? { ...e, status: "archived" } : e))
			);
		}
	}, []);

	const handleDelete = useCallback(async () => {
		if (!deleteDialogEvidence) return;

		setIsDeleting(true);
		const result = await deleteEvidence(deleteDialogEvidence.id);
		if (result.success) {
			setEvidence((prev) => prev.filter((e) => e.id !== deleteDialogEvidence.id));
			setDeleteDialogEvidence(null);
		}
		setIsDeleting(false);
	}, [deleteDialogEvidence]);

	const toggleStrengthTier = useCallback((tier: EvidenceStrengthTier) => {
		setSelectedStrengthTiers((prev) =>
			prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
		);
	}, []);

	// Loading state
	if (isLoading) {
		return <EvidenceLibrarySkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<CardTitle className="flex items-center gap-2">
						<Award className="h-5 w-5" />
						Evidence Library
						{evidence.length > 0 && (
							<Badge variant="secondary">{evidence.length}</Badge>
						)}
					</CardTitle>

					<div className="flex items-center gap-2">
						{/* Search */}
						<div className="relative flex-1 md:w-64">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search evidence..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
									onClick={() => setSearchQuery("")}
								>
									<X className="h-3 w-3" />
								</Button>
							)}
						</div>

						{/* Strength Filter */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon">
									<Filter className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<div className="p-2">
									<p className="text-sm font-medium mb-2">Strength Tier</p>
									{(["gold", "silver", "bronze"] as EvidenceStrengthTier[]).map((tier) => (
										<div
											key={tier}
											className={cn(
												"flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50",
												selectedStrengthTiers.includes(tier) && "bg-muted"
											)}
											onClick={() => toggleStrengthTier(tier)}
										>
											<div
												className={cn(
													"h-4 w-4 border rounded flex items-center justify-center",
													selectedStrengthTiers.includes(tier) &&
														"bg-primary border-primary"
												)}
											>
												{selectedStrengthTiers.includes(tier) && (
													<Award className="h-2.5 w-2.5 text-primary-foreground" />
												)}
											</div>
											<span className={cn("text-sm", STRENGTH_TIER_CONFIG[tier].color)}>
												{STRENGTH_TIER_CONFIG[tier].label}
											</span>
										</div>
									))}
								</div>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* View Toggle */}
						<div className="flex border rounded-md">
							<Button
								variant={viewMode === "grid" ? "secondary" : "ghost"}
								size="icon"
								className="rounded-r-none"
								onClick={() => setViewMode("grid")}
							>
								<Grid className="h-4 w-4" />
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

						{/* Add Button */}
						<Button onClick={onCreate}>
							<Plus className="h-4 w-4 mr-2" />
							Add Evidence
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Type Tabs */}
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
						<TabsTrigger value="all" className="data-[state=active]:bg-muted">
							All ({countByType.all || 0})
						</TabsTrigger>
						{Object.entries(EVIDENCE_TYPE_CONFIG).map(([type, config]) => (
							<TabsTrigger
								key={type}
								value={type}
								className="data-[state=active]:bg-muted gap-1"
							>
								<config.icon className="h-3 w-3" />
								{config.label} ({countByType[type] || 0})
							</TabsTrigger>
						))}
					</TabsList>

					<TabsContent value={activeTab} className="mt-4">
						{/* Empty State */}
						{filteredEvidence.length === 0 && !error && (
							<div className="text-center py-12">
								<Award className="h-12 w-12 mx-auto text-muted-foreground/50" />
								<h3 className="mt-4 font-medium">No evidence found</h3>
								<p className="text-sm text-muted-foreground mt-1">
									{searchQuery
										? "Try adjusting your search or filters"
										: "Start building your evidence library"}
								</p>
								{!searchQuery && (
									<Button onClick={onCreate} className="mt-4">
										<Plus className="h-4 w-4 mr-2" />
										Add Your First Evidence
									</Button>
								)}
							</div>
						)}

						{/* Evidence Grid/List */}
						{filteredEvidence.length > 0 && (
							<div
								className={cn(
									viewMode === "grid"
										? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
										: "space-y-2"
								)}
							>
								{filteredEvidence.map((item) => (
									<EvidenceCard
										key={item.id}
										evidence={item}
										viewMode={viewMode}
										onSelect={() => handleSelect(item)}
										onEdit={() => handleEdit(item)}
										onDuplicate={() => handleDuplicate(item)}
										onArchive={() => handleArchive(item)}
										onDelete={() => setDeleteDialogEvidence(item)}
									/>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</CardContent>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteDialogEvidence} onOpenChange={() => setDeleteDialogEvidence(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Evidence</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteDialogEvidence?.title}"?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogEvidence(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export default EvidenceLibrary;
