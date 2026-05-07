"use client";

/**
 * SlideEditor Component - DocFusion
 *
 * Individual slide editor with rich content editing, layout options,
 * and real-time preview capabilities.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ChevronLeft,
	ChevronRight,
	Type,
	Image as ImageIcon,
	BarChart2,
	Table,
	List,
	Quote,
	Code,
	Video,
	Plus,
	Trash2,
	GripVertical,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Bold,
	Italic,
	Underline,
	MoreHorizontal,
	Palette,
	Layout,
	Clock,
	MoveUp,
	MoveDown,
} from "lucide-react";
import type { OralPresentation, PresentationSlide, SlideContentElement, SlideType } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface SlideEditorProps {
	/** The slide to edit */
	slide: PresentationSlide | null;
	/** Current slide index (0-based) */
	slideIndex: number;
	/** Total number of slides */
	totalSlides: number;
	/** Callback when slide is updated */
	onUpdate: (slideId: string, updates: Partial<PresentationSlide>) => void;
	/** Callback to navigate slides */
	onNavigate: (direction: "prev" | "next") => void;
	/** Parent presentation for context */
	presentation: OralPresentation;
	/** Additional class names */
	className?: string;
}

interface ContentBlockProps {
	element: SlideContentElement;
	index: number;
	isSelected: boolean;
	onSelect: () => void;
	onUpdate: (updates: Partial<SlideContentElement>) => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	canMoveUp: boolean;
	canMoveDown: boolean;
}

// ============================================================================
// Content Type Configuration
// ============================================================================

const CONTENT_TYPES: Record<string, { label: string; icon: typeof Type; description: string }> = {
	text: { label: "Text", icon: Type, description: "Plain text paragraph" },
	bullet: { label: "Bullet List", icon: List, description: "Bulleted list" },
	image: { label: "Image", icon: ImageIcon, description: "Image or graphic" },
	chart: { label: "Chart", icon: BarChart2, description: "Data visualization" },
	table: { label: "Table", icon: Table, description: "Data table" },
	quote: { label: "Quote", icon: Quote, description: "Highlighted quote" },
	code: { label: "Code", icon: Code, description: "Code snippet" },
	video: { label: "Video", icon: Video, description: "Embedded video" },
};

const SLIDE_LAYOUTS = [
	{ id: "title-content", label: "Title + Content" },
	{ id: "title-two-col", label: "Title + Two Columns" },
	{ id: "title-image", label: "Title + Image" },
	{ id: "title-chart", label: "Title + Chart" },
	{ id: "full-image", label: "Full Image" },
	{ id: "comparison", label: "Comparison" },
	{ id: "blank", label: "Blank" },
];

// ============================================================================
// Content Block Component
// ============================================================================

function ContentBlock({
	element,
	index,
	isSelected,
	onSelect,
	onUpdate,
	onDelete,
	onMoveUp,
	onMoveDown,
	canMoveUp,
	canMoveDown,
}: ContentBlockProps) {
	const config = CONTENT_TYPES[element.type] ?? CONTENT_TYPES.text;
	const Icon = config.icon;

	const handleContentChange = (value: string) => {
		onUpdate({ ...element, data: value });
	};

	return (
		<div
			onClick={onSelect}
			className={cn(
				"group relative rounded-lg border p-3 cursor-pointer transition-all",
				isSelected
					? "border-primary bg-primary/5 ring-1 ring-primary"
					: "border-border hover:border-primary/50"
			)}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
			{/* Drag Handle */}
			<div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
				<GripVertical className="h-4 w-4 text-muted-foreground" />
			</div>

			{/* Content Type Badge */}
			<div className="flex items-center justify-between mb-2">
				<Badge variant="outline" className="gap-1">
					<Icon className="h-3 w-3" />
					{config.label}
				</Badge>

				{/* Actions */}
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={(e) => {
									e.stopPropagation();
									onMoveUp();
								}}
								disabled={!canMoveUp}
							>
								<MoveUp className="h-3 w-3" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Move Up</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={(e) => {
									e.stopPropagation();
									onMoveDown();
								}}
								disabled={!canMoveDown}
							>
								<MoveDown className="h-3 w-3" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Move Down</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-destructive"
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
							>
								<Trash2 className="h-3 w-3" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Delete</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Content Area */}
			<div className="pl-4">
				{element.type === "text" || element.type === "bullet" || element.type === "quote" ? (
					<Textarea
						value={(element.data as string) ?? ""}
						onChange={(e) => handleContentChange(e.target.value)}
						placeholder={`Enter ${config.label.toLowerCase()}...`}
						className="min-h-[60px] resize-none"
						onClick={(e) => e.stopPropagation()}
					/>
				) : element.type === "image" ? (
					<div className="aspect-video bg-muted rounded-lg border-2 border-dashed flex items-center justify-center">
						<div className="text-center text-muted-foreground">
							<ImageIcon className="h-8 w-8 mx-auto mb-2" />
							<p className="text-xs">Click to upload image</p>
						</div>
					</div>
				) : element.type === "chart" ? (
					<div className="aspect-video bg-muted rounded-lg border-2 border-dashed flex items-center justify-center">
						<div className="text-center text-muted-foreground">
							<BarChart2 className="h-8 w-8 mx-auto mb-2" />
							<p className="text-xs">Configure chart</p>
						</div>
					</div>
				) : element.type === "table" ? (
					<div className="aspect-video bg-muted rounded-lg border-2 border-dashed flex items-center justify-center">
						<div className="text-center text-muted-foreground">
							<Table className="h-8 w-8 mx-auto mb-2" />
							<p className="text-xs">Configure table</p>
						</div>
					</div>
				) : element.type === "code" ? (
					<Textarea
						value={(element.data as string) ?? ""}
						onChange={(e) => handleContentChange(e.target.value)}
						placeholder="Enter code..."
						className="min-h-[60px] font-mono text-sm resize-none"
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<div className="p-4 bg-muted rounded text-muted-foreground text-sm">
						{config.label} content
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function SlideEditor({
	slide,
	slideIndex,
	totalSlides,
	onUpdate,
	onNavigate,
	presentation,
	className,
}: SlideEditorProps) {
	const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);

	// Parse content elements
	const contentElements = useMemo(() => {
		if (!slide?.content) return [];
		if (Array.isArray(slide.content)) {
			return slide.content as SlideContentElement[];
		}
		return [];
	}, [slide?.content]);

	// Handlers
	const handleTitleChange = useCallback((value: string) => {
		if (!slide) return;
		onUpdate(slide.id, { title: value });
	}, [slide, onUpdate]);

	const handleLayoutChange = useCallback((layout: string) => {
		if (!slide) return;
		onUpdate(slide.id, { layout });
	}, [slide, onUpdate]);

	const handleDurationChange = useCallback((duration: number) => {
		if (!slide) return;
		onUpdate(slide.id, { estimatedDuration: duration });
	}, [slide, onUpdate]);

	const handleAddElement = useCallback((type: string) => {
		if (!slide) return;

		const newElement: SlideContentElement = {
			type: type as SlideContentElement["type"],
			data: "",
		};

		const updatedContent = [...contentElements, newElement];
		onUpdate(slide.id, { content: updatedContent as unknown as PresentationSlide["content"] });
		setSelectedElementIndex(updatedContent.length - 1);
	}, [slide, contentElements, onUpdate]);

	const handleUpdateElement = useCallback((index: number, updates: Partial<SlideContentElement>) => {
		if (!slide) return;

		const updatedContent = contentElements.map((el, i) =>
			i === index ? { ...el, ...updates } : el
		);
		onUpdate(slide.id, { content: updatedContent as unknown as PresentationSlide["content"] });
	}, [slide, contentElements, onUpdate]);

	const handleDeleteElement = useCallback((index: number) => {
		if (!slide) return;

		const updatedContent = contentElements.filter((_, i) => i !== index);
		onUpdate(slide.id, { content: updatedContent as unknown as PresentationSlide["content"] });

		if (selectedElementIndex === index) {
			setSelectedElementIndex(null);
		} else if (selectedElementIndex !== null && selectedElementIndex > index) {
			setSelectedElementIndex(selectedElementIndex - 1);
		}
	}, [slide, contentElements, selectedElementIndex, onUpdate]);

	const handleMoveElement = useCallback((index: number, direction: "up" | "down") => {
		if (!slide) return;

		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= contentElements.length) return;

		const updatedContent = [...contentElements];
		[updatedContent[index], updatedContent[newIndex]] = [updatedContent[newIndex], updatedContent[index]];
		onUpdate(slide.id, { content: updatedContent as unknown as PresentationSlide["content"] });

		setSelectedElementIndex(newIndex);
	}, [slide, contentElements, onUpdate]);

	// Format duration
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (!slide) {
		return (
			<div className={cn("flex items-center justify-center h-full bg-muted/30", className)}>
				<div className="text-center text-muted-foreground">
					<Layout className="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p className="text-lg font-medium">No Slide Selected</p>
					<p className="text-sm mt-1">Select a slide from the sidebar to begin editing</p>
				</div>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full", className)}>
				{/* Toolbar */}
				<div className="flex items-center justify-between px-4 py-2 border-b bg-card">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onNavigate("prev")}
							disabled={slideIndex <= 0}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						<span className="text-sm font-medium">
							Slide {slideIndex + 1} of {totalSlides}
						</span>

						<Button
							variant="ghost"
							size="icon"
							onClick={() => onNavigate("next")}
							disabled={slideIndex >= totalSlides - 1}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex items-center gap-2">
						{/* Layout Selector */}
						<Select
							value={slide.layout ?? "title-content"}
							onValueChange={handleLayoutChange}
						>
							<SelectTrigger className="w-[160px] h-8">
								<Layout className="h-3.5 w-3.5 mr-1" />
								<SelectValue placeholder="Layout" />
							</SelectTrigger>
							<SelectContent>
								{SLIDE_LAYOUTS.map((layout) => (
									<SelectItem key={layout.id} value={layout.id}>
										{layout.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Duration */}
						<div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
							<Clock className="h-3.5 w-3.5 text-muted-foreground" />
							<Input
								type="number"
								value={slide.estimatedDuration ?? 60}
								onChange={(e) => handleDurationChange(parseInt(e.target.value) || 60)}
								className="w-16 h-6 text-xs px-1"
								min={10}
								max={600}
							/>
							<span className="text-xs text-muted-foreground">sec</span>
						</div>

						{/* Add Content */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Plus className="h-4 w-4 mr-1" />
									Add Content
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{Object.entries(CONTENT_TYPES).map(([type, config]) => (
									<DropdownMenuItem
										key={type}
										onClick={() => handleAddElement(type)}
									>
										<config.icon className="h-4 w-4 mr-2" />
										{config.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Editor Area */}
				<ScrollArea className="flex-1 bg-muted/10">
					<div className="p-6 max-w-4xl mx-auto">
						{/* Slide Preview Card */}
						<Card className="mb-6 overflow-hidden">
							<div className="aspect-[16/9] bg-gradient-to-br from-background to-muted relative p-8">
								{/* Slide Title */}
								<div className="mb-6">
									<Input
										value={slide.title ?? ""}
										onChange={(e) => handleTitleChange(e.target.value)}
										placeholder="Slide Title"
										className="text-2xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
									/>
								</div>

								{/* Content Elements Preview */}
								<div className="space-y-3">
									{contentElements.length === 0 ? (
										<div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
											<div className="text-center text-muted-foreground">
												<Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
												<p className="text-sm">Add content using the toolbar above</p>
											</div>
										</div>
									) : (
										contentElements.map((element, index) => {
											const config = CONTENT_TYPES[element.type];
											return (
												<div
													key={index}
													className={cn(
														"p-2 rounded border transition-colors cursor-pointer",
														selectedElementIndex === index
															? "border-primary bg-primary/5"
															: "border-transparent hover:border-border"
													)}
													onClick={() => setSelectedElementIndex(index)}

						role="button"
						tabIndex={0}
						onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
													{element.type === "text" || element.type === "bullet" ? (
														<p className="text-sm whitespace-pre-wrap">
															{(element.data as string) || "(empty text)"}
														</p>
													) : element.type === "quote" ? (
														<blockquote className="text-sm italic border-l-2 pl-3">
															{(element.data as string) || "(empty quote)"}
														</blockquote>
													) : (
														<div className="flex items-center gap-2 text-sm text-muted-foreground">
															<config.icon className="h-4 w-4" />
															<span>{config.label}</span>
														</div>
													)}
												</div>
											);
										})
									)}
								</div>
							</div>
						</Card>

						{/* Content Blocks Editor */}
						<div className="space-y-3">
							<h3 className="text-sm font-medium flex items-center gap-2">
								<List className="h-4 w-4" />
								Content Blocks
							</h3>

							{contentElements.length === 0 ? (
								<Card>
									<CardContent className="py-8">
										<div className="text-center text-muted-foreground">
											<Type className="h-8 w-8 mx-auto mb-2 opacity-50" />
											<p className="font-medium">No content blocks yet</p>
											<p className="text-sm mt-1">
												Click "Add Content" to add text, images, charts, and more.
											</p>
										</div>
									</CardContent>
								</Card>
							) : (
								contentElements.map((element, index) => (
									<ContentBlock
										key={index}
										element={element}
										index={index}
										isSelected={selectedElementIndex === index}
										onSelect={() => setSelectedElementIndex(index)}
										onUpdate={(updates) => handleUpdateElement(index, updates)}
										onDelete={() => handleDeleteElement(index)}
										onMoveUp={() => handleMoveElement(index, "up")}
										onMoveDown={() => handleMoveElement(index, "down")}
										canMoveUp={index > 0}
										canMoveDown={index < contentElements.length - 1}
									/>
								))
							)}
						</div>
					</div>
				</ScrollArea>
			</div>
		</TooltipProvider>
	);
}
