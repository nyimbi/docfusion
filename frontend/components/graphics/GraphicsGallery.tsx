"use client";

/**
 * GraphicsGallery Component - DocFusion
 *
 * Gallery view of all graphics for an opportunity. Displays graphics with
 * thumbnails, supports filtering by type and status, and provides edit/delete/approve actions.
 *
 * Features:
 * - Grid layout with responsive columns
 * - Filter by graphic type (org_chart, process_flow, schedule, etc.)
 * - Status badges (draft, approved)
 * - Edit/delete/approve actions
 * - Optimistic UI updates
 * - Keyboard navigation
 *
 * @module components/graphics/GraphicsGallery
 */

import * as React from "react";
import { useCallback, useEffect, useState, useTransition, useOptimistic } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Skeleton,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import {
	listGraphics,
	deleteGraphic,
	approveGraphic,
} from "@/lib/actions/graphics";
import type {
	ProposalGraphic,
	GraphicType,
	GraphicGalleryProps,
} from "@/lib/types/graphics";
import { GraphicPreview } from "./GraphicPreview";
import {
	Search,
	Filter,
	MoreVertical,
	Edit,
	Trash2,
	Check,
	Copy,
	ExternalLink,
	BarChart3,
	GitBranch,
	Calendar,
	PieChart,
	Box,
	Layers,
	Image as ImageIcon,
	AlertTriangle,
} from "lucide-react";

// Graphic type configuration for icons and labels
const GRAPHIC_TYPE_CONFIG: Record<
	GraphicType,
	{ icon: React.ElementType; label: string; color: string }
> = {
	org_chart: { icon: GitBranch, label: "Org Chart", color: "text-blue-600" },
	process_flow: { icon: BarChart3, label: "Process Flow", color: "text-green-600" },
	schedule: { icon: Calendar, label: "Schedule", color: "text-orange-600" },
	infographic: { icon: PieChart, label: "Infographic", color: "text-purple-600" },
	diagram: { icon: Box, label: "Diagram", color: "text-cyan-600" },
	chart: { icon: Layers, label: "Chart", color: "text-rose-600" },
};

// Status badge variants
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
	draft: "secondary",
	review: "outline",
	approved: "default",
	rejected: "destructive",
};

interface GraphicCardProps {
	graphic: ProposalGraphic;
	isSelected: boolean;
	onSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onApprove: () => void;
	isDeleting: boolean;
}

/**
 * Individual graphic card in the gallery grid.
 */
function GraphicCard({
	graphic,
	isSelected,
	onSelect,
	onEdit,
	onDelete,
	onApprove,
	isDeleting,
}: GraphicCardProps) {
	const typeConfig = GRAPHIC_TYPE_CONFIG[graphic.graphicType as GraphicType] || {
		icon: ImageIcon,
		label: "Graphic",
		color: "text-gray-600",
	};
	const TypeIcon = typeConfig.icon;

	return (
		<Card
			interactive
			className={cn(
				"group relative overflow-hidden",
				isSelected && "ring-2 ring-primary",
				isDeleting && "opacity-50 pointer-events-none"
			)}
			onClick={onSelect}
		>
			{/* Thumbnail/Preview area */}
			<div className="relative aspect-video bg-muted/50 overflow-hidden">
				{graphic.diagramCode ? (
					<div className="absolute inset-0 flex items-center justify-center p-2">
						<GraphicPreview
							code={graphic.diagramCode}
							format={(graphic.format as "mermaid" | "d2") || "mermaid"}
							width={200}
							height={120}
						/>
					</div>
				) : graphic.imageUrl ? (
					<img
						src={graphic.imageUrl}
						alt={graphic.title}
						className="absolute inset-0 w-full h-full object-contain"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<TypeIcon className={cn("h-12 w-12", typeConfig.color, "opacity-40")} />
					</div>
				)}

				{/* Status badge overlay */}
				<Badge
					variant={STATUS_VARIANTS[graphic.status || "draft"]}
					className="absolute top-2 right-2 capitalize"
				>
					{graphic.status || "draft"}
				</Badge>

				{/* Figure number overlay */}
				{graphic.figureNumber && (
					<div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded px-2 py-0.5 text-xs font-medium">
						{graphic.figureNumber}
					</div>
				)}
			</div>

			<CardHeader className="p-3 pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<CardTitle className="text-sm truncate">{graphic.title}</CardTitle>
						<CardDescription className="text-xs flex items-center gap-1 mt-1">
							<TypeIcon className={cn("h-3 w-3", typeConfig.color)} />
							{typeConfig.label}
						</CardDescription>
					</div>

					{/* Actions dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => e.stopPropagation()}
							>
								<MoreVertical className="h-4 w-4" />
								<span className="sr-only">Actions</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onEdit}>
								<Edit className="h-4 w-4 mr-2" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onApprove} disabled={graphic.status === "approved"}>
								<Check className="h-4 w-4 mr-2" />
								Approve
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Copy className="h-4 w-4 mr-2" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuItem>
								<ExternalLink className="h-4 w-4 mr-2" />
								Export
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>

			{graphic.caption && (
				<CardContent className="p-3 pt-0">
					<p className="text-xs text-muted-foreground line-clamp-2">{graphic.caption}</p>
				</CardContent>
			)}
		</Card>
	);
}

/**
 * Loading skeleton for the gallery grid.
 */
function GallerySkeleton() {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{Array.from({ length: 8 }).map((_, i) => (
				<Card key={i} className="overflow-hidden">
					<Skeleton className="aspect-video" />
					<CardHeader className="p-3 pb-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2 mt-1" />
					</CardHeader>
				</Card>
			))}
		</div>
	);
}

/**
 * Empty state when no graphics exist.
 */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<ImageIcon className="h-16 w-16 text-muted-foreground/40 mb-4" />
			<h3 className="text-lg font-semibold mb-1">
				{hasFilters ? "No matching graphics" : "No graphics yet"}
			</h3>
			<p className="text-sm text-muted-foreground max-w-md">
				{hasFilters
					? "Try adjusting your filters or search query to find what you're looking for."
					: "Create your first graphic by clicking the 'New Graphic' button or use AI suggestions to get started."}
			</p>
		</div>
	);
}

/**
 * GraphicsGallery - Main gallery component for browsing proposal graphics.
 *
 * @example
 * ```tsx
 * <GraphicsGallery
 *   opportunityId={opportunityId}
 *   onSelect={(graphic) => setSelectedGraphic(graphic)}
 *   onEdit={(graphic) => openEditor(graphic)}
 * />
 * ```
 */
export function GraphicsGallery({
	opportunityId,
	selectedId,
	onSelect,
	onEdit,
	onDelete,
	showOrphaned = false,
}: GraphicGalleryProps) {
	// Auth
	const { data: session } = useSession();
	const userId = session?.user?.id ?? "system";

	// State
	const [graphics, setGraphics] = useState<ProposalGraphic[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [isPending, startTransition] = useTransition();

	// Optimistic state for deletions
	const [optimisticGraphics, setOptimisticGraphics] = useOptimistic(
		graphics,
		(state, deletedId: string) => state.filter((g) => g.id !== deletedId)
	);

	// Delete confirmation dialog
	const [deleteTarget, setDeleteTarget] = useState<ProposalGraphic | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Load graphics
	const loadGraphics = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await listGraphics(opportunityId);

		if (result.success) {
			setGraphics(result.data);
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityId]);

	// Initial load
	useEffect(() => {
		loadGraphics();
	}, [loadGraphics]);

	// Filter graphics
	const filteredGraphics = React.useMemo(() => {
		return optimisticGraphics.filter((graphic) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesSearch =
					graphic.title.toLowerCase().includes(query) ||
					graphic.caption?.toLowerCase().includes(query) ||
					graphic.figureNumber?.toLowerCase().includes(query);
				if (!matchesSearch) return false;
			}

			// Type filter
			if (typeFilter !== "all" && graphic.graphicType !== typeFilter) {
				return false;
			}

			// Status filter
			if (statusFilter !== "all" && graphic.status !== statusFilter) {
				return false;
			}

			return true;
		});
	}, [optimisticGraphics, searchQuery, typeFilter, statusFilter]);

	// Handle delete
	const handleDelete = async () => {
		if (!deleteTarget) return;

		setIsDeleting(true);

		startTransition(async () => {
			// Optimistically remove from UI
			setOptimisticGraphics(deleteTarget.id);

			const result = await deleteGraphic(deleteTarget.id);

			if (result.success) {
				// Permanently remove from state
				setGraphics((prev) => prev.filter((g) => g.id !== deleteTarget.id));
				onDelete?.(deleteTarget.id);
			} else {
				// Revert on error - reload the list
				await loadGraphics();
				setError(result.error);
			}
		});

		setDeleteTarget(null);
		setIsDeleting(false);
	};

	// Handle approve
	const handleApprove = async (graphic: ProposalGraphic) => {
		startTransition(async () => {
			const result = await approveGraphic(graphic.id, userId);

			if (result.success) {
				setGraphics((prev) =>
					prev.map((g) => (g.id === graphic.id ? result.data : g))
				);
			} else {
				setError(result.error);
			}
		});
	};

	const hasFilters = !!(searchQuery || typeFilter !== "all" || statusFilter !== "all");

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				{/* Search */}
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search graphics..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Type filter */}
				<Select value={typeFilter} onValueChange={setTypeFilter}>
					<SelectTrigger className="w-[140px]">
						<Filter className="h-4 w-4 mr-2" />
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						{Object.entries(GRAPHIC_TYPE_CONFIG).map(([type, config]) => (
							<SelectItem key={type} value={type}>
								{config.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Status filter */}
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[130px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="review">Review</SelectItem>
						<SelectItem value="approved">Approved</SelectItem>
						<SelectItem value="rejected">Rejected</SelectItem>
					</SelectContent>
				</Select>

				{/* Count indicator */}
				<div className="text-sm text-muted-foreground">
					{filteredGraphics.length} graphic{filteredGraphics.length !== 1 ? "s" : ""}
				</div>
			</div>

			{/* Error banner */}
			{error && (
				<div className="m-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
					<AlertTriangle className="h-4 w-4 text-destructive" />
					<span className="text-sm text-destructive">{error}</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={loadGraphics}
						className="ml-auto"
					>
						Retry
					</Button>
				</div>
			)}

			{/* Gallery grid */}
			<ScrollArea className="flex-1 p-4">
				{isLoading ? (
					<GallerySkeleton />
				) : filteredGraphics.length === 0 ? (
					<EmptyState hasFilters={hasFilters} />
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{filteredGraphics.map((graphic) => (
							<GraphicCard
								key={graphic.id}
								graphic={graphic}
								isSelected={graphic.id === selectedId}
								onSelect={() => onSelect?.(graphic)}
								onEdit={() => onEdit?.(graphic)}
								onDelete={() => setDeleteTarget(graphic)}
								onApprove={() => handleApprove(graphic)}
								isDeleting={isPending}
							/>
						))}
					</div>
				)}
			</ScrollArea>

			{/* Delete confirmation dialog */}
			<Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Graphic</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteTarget?.title}"? This action
							cannot be undone and will remove all references to this graphic.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleDelete}
							isLoading={isDeleting}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
