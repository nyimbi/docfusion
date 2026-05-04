"use client";

/**
 * SlideSorter Component - DocFusion
 *
 * Drag-and-drop slide reordering with grid view for quick organization.
 * Supports bulk selection, section grouping, and visual thumbnails.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	GripVertical,
	Clock,
	MoreHorizontal,
	Trash2,
	Copy,
	Eye,
	EyeOff,
	CheckSquare,
	Square,
	ArrowUp,
	ArrowDown,
	Layers,
	Grid3X3,
	Grid2X2,
	User,
} from "lucide-react";
import type { PresentationSlide, SlideContentElement } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface SlideSorterProps {
	/** All slides to display */
	slides: PresentationSlide[];
	/** Callback when slides are reordered */
	onReorder: (newOrder: string[]) => void;
	/** Callback when a slide is selected */
	onSlideSelect: (slideId: string) => void;
	/** Currently selected slide ID */
	selectedSlideId: string | null;
	/** Callback when slides are deleted */
	onDeleteSlides?: (slideIds: string[]) => void;
	/** Callback when slides are duplicated */
	onDuplicateSlides?: (slideIds: string[]) => void;
	/** Additional class names */
	className?: string;
}

type GridSize = "small" | "medium" | "large";

// ============================================================================
// Component
// ============================================================================

export function SlideSorter({
	slides,
	onReorder,
	onSlideSelect,
	selectedSlideId,
	onDeleteSlides,
	onDuplicateSlides,
	className,
}: SlideSorterProps) {
	// State
	const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
	const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [gridSize, setGridSize] = useState<GridSize>("medium");
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

	// Derived state
	const selectedCount = selectedSlideIds.size;
	const allSelected = selectedCount === slides.length && slides.length > 0;

	const totalDuration = useMemo(
		() => slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0),
		[slides]
	);

	// Grid size classes
	const gridClasses: Record<GridSize, string> = {
		small: "grid-cols-6 gap-2",
		medium: "grid-cols-4 gap-4",
		large: "grid-cols-3 gap-6",
	};

	const cardClasses: Record<GridSize, string> = {
		small: "p-1",
		medium: "p-2",
		large: "p-3",
	};

	// Handlers
	const handleSlideClick = useCallback((slideId: string, event: React.MouseEvent) => {
		if (isMultiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey) {
			setSelectedSlideIds((prev) => {
				const newSet = new Set(prev);
				if (newSet.has(slideId)) {
					newSet.delete(slideId);
				} else {
					newSet.add(slideId);
				}
				return newSet;
			});
		} else {
			onSlideSelect(slideId);
		}
	}, [isMultiSelectMode, onSlideSelect]);

	const handleSelectAll = useCallback(() => {
		if (allSelected) {
			setSelectedSlideIds(new Set());
		} else {
			setSelectedSlideIds(new Set(slides.map((s) => s.id)));
		}
	}, [allSelected, slides]);

	const handleDragStart = useCallback((e: React.DragEvent, slideId: string) => {
		setDraggedSlideId(slideId);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", slideId);

		// If dragging a selected slide, drag all selected
		if (!selectedSlideIds.has(slideId)) {
			setSelectedSlideIds(new Set([slideId]));
		}
	}, [selectedSlideIds]);

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverIndex(index);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDragOverIndex(null);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
		e.preventDefault();
		setDragOverIndex(null);
		setDraggedSlideId(null);

		const draggedId = e.dataTransfer.getData("text/plain");
		if (!draggedId) return;

		// Get slides to move
		const slideIdsToMove = selectedSlideIds.has(draggedId)
			? Array.from(selectedSlideIds)
			: [draggedId];

		// Calculate new order
		const remainingSlides = slides.filter((s) => !slideIdsToMove.includes(s.id));
		const slidesToMove = slides.filter((s) => slideIdsToMove.includes(s.id));

		// Insert at target position
		const newSlides = [
			...remainingSlides.slice(0, targetIndex),
			...slidesToMove,
			...remainingSlides.slice(targetIndex),
		];

		onReorder(newSlides.map((s) => s.id));
	}, [slides, selectedSlideIds, onReorder]);

	const handleDragEnd = useCallback(() => {
		setDraggedSlideId(null);
		setDragOverIndex(null);
	}, []);

	const handleDeleteSelected = useCallback(() => {
		if (onDeleteSlides && selectedSlideIds.size > 0) {
			onDeleteSlides(Array.from(selectedSlideIds));
			setSelectedSlideIds(new Set());
		}
	}, [selectedSlideIds, onDeleteSlides]);

	const handleDuplicateSelected = useCallback(() => {
		if (onDuplicateSlides && selectedSlideIds.size > 0) {
			onDuplicateSlides(Array.from(selectedSlideIds));
		}
	}, [selectedSlideIds, onDuplicateSlides]);

	// Format duration
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Render slide thumbnail
	const renderSlideThumbnail = (slide: PresentationSlide, index: number) => {
		const isSelected = selectedSlideId === slide.id;
		const isMultiSelected = selectedSlideIds.has(slide.id);
		const isDragging = draggedSlideId === slide.id;
		const isDragOver = dragOverIndex === index;

		const contentElements = slide.content
			? (Array.isArray(slide.content) ? slide.content : []) as SlideContentElement[]
			: [];

		return (
			<div
				key={slide.id}
				draggable
				onDragStart={(e) => handleDragStart(e, slide.id)}
				onDragOver={(e) => handleDragOver(e, index)}
				onDragLeave={handleDragLeave}
				onDrop={(e) => handleDrop(e, index)}
				onDragEnd={handleDragEnd}
				onClick={(e) => handleSlideClick(slide.id, e)}
				className={cn(
					"group relative cursor-pointer transition-all",
					isDragging && "opacity-50 scale-95",
					isDragOver && "ring-2 ring-primary ring-offset-2"
				)}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
				<Card
					className={cn(
						"overflow-hidden transition-all",
						cardClasses[gridSize],
						isSelected && "ring-2 ring-primary",
						isMultiSelected && "ring-2 ring-primary/50 bg-primary/5",
						!isSelected && !isMultiSelected && "hover:border-primary/50"
					)}
				>
					{/* Drag Handle & Selection */}
					<div className="flex items-center gap-1 mb-1">
						<div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
							<GripVertical className="h-3 w-3 text-muted-foreground" />
						</div>

						{isMultiSelectMode && (
							<Checkbox
								checked={isMultiSelected}
								onCheckedChange={() => {
									setSelectedSlideIds((prev) => {
										const newSet = new Set(prev);
										if (newSet.has(slide.id)) {
											newSet.delete(slide.id);
										} else {
											newSet.add(slide.id);
										}
										return newSet;
									});
								}}
								onClick={(e) => e.stopPropagation()}
								className="h-3 w-3"
							/>
						)}

						<Badge variant="outline" className="h-4 text-[10px]">
							{index + 1}
						</Badge>

						<div className="flex-1" />

						{/* Actions Menu */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-5 w-5 opacity-0 group-hover:opacity-100"
									onClick={(e) => e.stopPropagation()}
								>
									<MoreHorizontal className="h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onSlideSelect(slide.id)}>
									<Eye className="h-4 w-4 mr-2" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => onDuplicateSlides?.([slide.id])}
								>
									<Copy className="h-4 w-4 mr-2" />
									Duplicate
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onDeleteSlides?.([slide.id])}
									className="text-destructive"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Slide Preview */}
					<div
						className={cn(
							"aspect-[16/9] rounded border overflow-hidden mb-1",
							slide.backgroundColor
								? `bg-[${slide.backgroundColor}]`
								: "bg-gradient-to-br from-slate-900 to-slate-800"
						)}
						style={slide.backgroundImage ? {
							backgroundImage: `url(${slide.backgroundImage})`,
							backgroundSize: "cover",
						} : undefined}
					>
						<div className="p-1.5 h-full flex flex-col">
							{slide.title && (
								<div className="text-white text-[8px] font-medium truncate mb-0.5">
									{slide.title}
								</div>
							)}
							<div className="flex-1 space-y-0.5 overflow-hidden">
								{contentElements.slice(0, 3).map((el, i) => (
									<div
										key={i}
										className="h-1 bg-white/30 rounded-full"
										style={{ width: `${60 + Math.random() * 30}%` }}
									/>
								))}
							</div>
						</div>
					</div>

					{/* Slide Info */}
					<div className="flex items-center justify-between text-[10px] text-muted-foreground">
						<span className="truncate max-w-[80%]">
							{slide.title ?? `Slide ${index + 1}`}
						</span>
						<span className="flex items-center gap-0.5">
							<Clock className="h-2.5 w-2.5" />
							{formatDuration(slide.estimatedDuration ?? 60)}
						</span>
					</div>

					{/* Hidden Badge */}
					{slide.isHidden && (
						<div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground">
							<EyeOff className="h-2.5 w-2.5" />
							<span className="truncate">Hidden</span>
						</div>
					)}
				</Card>

				{/* Drop Indicator */}
				{isDragOver && (
					<div className="absolute inset-y-0 -left-1 w-0.5 bg-primary rounded-full" />
				)}
			</div>
		);
	};

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full", className)}>
				{/* Toolbar */}
				<div className="flex items-center justify-between px-4 py-2 border-b bg-card">
					<div className="flex items-center gap-2">
						{/* Select Mode */}
						<Button
							variant={isMultiSelectMode ? "secondary" : "ghost"}
							size="sm"
							onClick={() => {
								setIsMultiSelectMode(!isMultiSelectMode);
								if (isMultiSelectMode) {
									setSelectedSlideIds(new Set());
								}
							}}
						>
							{isMultiSelectMode ? (
								<CheckSquare className="h-4 w-4 mr-1" />
							) : (
								<Square className="h-4 w-4 mr-1" />
							)}
							Select
						</Button>

						{isMultiSelectMode && (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleSelectAll}
								>
									{allSelected ? "Deselect All" : "Select All"}
								</Button>

								{selectedCount > 0 && (
									<Badge variant="secondary">
										{selectedCount} selected
									</Badge>
								)}
							</>
						)}
					</div>

					<div className="flex items-center gap-2">
						{/* Bulk Actions */}
						{selectedCount > 0 && (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDuplicateSelected}
								>
									<Copy className="h-4 w-4 mr-1" />
									Duplicate
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDeleteSelected}
									className="text-destructive"
								>
									<Trash2 className="h-4 w-4 mr-1" />
									Delete
								</Button>

								<div className="h-6 w-px bg-border" />
							</>
						)}

						{/* Summary */}
						<div className="text-sm text-muted-foreground flex items-center gap-3">
							<span className="flex items-center gap-1">
								<Layers className="h-4 w-4" />
								{slides.length} slides
							</span>
							<span className="flex items-center gap-1">
								<Clock className="h-4 w-4" />
								{formatDuration(totalDuration)}
							</span>
						</div>

						<div className="h-6 w-px bg-border" />

						{/* Grid Size */}
						<div className="flex items-center border rounded-lg p-0.5">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={gridSize === "small" ? "secondary" : "ghost"}
										size="icon"
										className="h-7 w-7"
										onClick={() => setGridSize("small")}
									>
										<Grid3X3 className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Small</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={gridSize === "medium" ? "secondary" : "ghost"}
										size="icon"
										className="h-7 w-7"
										onClick={() => setGridSize("medium")}
									>
										<Grid2X2 className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Medium</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={gridSize === "large" ? "secondary" : "ghost"}
										size="icon"
										className="h-7 w-7"
										onClick={() => setGridSize("large")}
									>
										<Layers className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Large</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</div>

				{/* Grid */}
				<ScrollArea className="flex-1">
					<div className={cn("p-4 grid", gridClasses[gridSize])}>
						{slides.map((slide, index) => renderSlideThumbnail(slide, index))}
					</div>
				</ScrollArea>

				{/* Keyboard Shortcuts Help */}
				<div className="px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
					<span className="font-medium">Tips:</span>
					{" "}Drag slides to reorder. Hold Shift or Ctrl to select multiple. Press Delete to remove selected.
				</div>
			</div>
		</TooltipProvider>
	);
}
