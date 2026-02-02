"use client";

/**
 * PresentationEditor Component - DocFusion
 *
 * Main presentation editor with slide list, editing panels, and toolbar.
 * Provides comprehensive interface for creating and managing oral presentations
 * for government RFP responses.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Presentation,
	Play,
	Clock,
	Users,
	FileText,
	Download,
	Plus,
	Settings,
	Eye,
	ChevronLeft,
	ChevronRight,
	Maximize2,
	Save,
	MoreHorizontal,
	Trash2,
	Copy,
	MessageSquare,
	CheckCircle,
	AlertTriangle,
	HelpCircle,
	Grid,
	List,
	Wand2,
} from "lucide-react";
import { SlideEditor } from "./SlideEditor";
import { SlidePreview } from "./SlidePreview";
import { SlideSorter } from "./SlideSorter";
import { SpeakerNotesEditor } from "./SpeakerNotesEditor";
import { QAPreparer } from "./QAPreparer";
import { TimingValidator } from "./TimingValidator";
import { TeamAssignment } from "./TeamAssignment";
import { PresentationExporter } from "./PresentationExporter";
import type {
	OralPresentation,
	PresentationSlide,
	PresentationQA,
	PracticeRecording,
	PresentationTeamMember,
	PresentationStatus,
	TimingAnalysis,
	PRESENTATION_STATUS_CONFIG,
	SLIDE_TYPE_CONFIG,
} from "@/lib/types/presentations";
import {
	updatePresentation,
	updateSlide,
	createSlide,
	deleteSlide,
	reorderSlides,
	validateTimelimits,
	generateSlidesFromProposal,
} from "@/lib/actions/presentations";

// ============================================================================
// Types
// ============================================================================

interface PresentationEditorProps {
	/** The presentation to edit */
	presentation: OralPresentation;
	/** Slides for the presentation */
	slides: PresentationSlide[];
	/** Q&A items */
	qaItems?: PresentationQA[];
	/** Team members */
	team?: PresentationTeamMember[];
	/** Practice recordings */
	recordings?: PracticeRecording[];
	/** Callback when presentation is saved */
	onSave?: (presentation: OralPresentation) => void;
	/** Callback when slides change */
	onSlidesChange?: (slides: PresentationSlide[]) => void;
	/** Callback to close editor */
	onClose?: () => void;
	/** Additional class names */
	className?: string;
}

type ViewMode = "edit" | "preview" | "sorter";
type PanelTab = "slides" | "notes" | "qa" | "team" | "timing";

// ============================================================================
// Status Configuration
// ============================================================================

const STATUS_CONFIG: Record<PresentationStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
	draft: { label: "Draft", color: "gray", icon: FileText },
	in_review: { label: "In Review", color: "yellow", icon: Eye },
	approved: { label: "Approved", color: "green", icon: CheckCircle },
	delivered: { label: "Delivered", color: "blue", icon: Presentation },
};

// ============================================================================
// Component
// ============================================================================

export function PresentationEditor({
	presentation,
	slides: initialSlides,
	qaItems = [],
	team = [],
	recordings = [],
	onSave,
	onSlidesChange,
	onClose,
	className,
}: PresentationEditorProps) {
	// State
	const [slides, setSlides] = useState<PresentationSlide[]>(initialSlides);
	const [selectedSlideId, setSelectedSlideId] = useState<string | null>(
		initialSlides[0]?.id ?? null
	);
	const [viewMode, setViewMode] = useState<ViewMode>("edit");
	const [panelTab, setPanelTab] = useState<PanelTab>("slides");
	const [isSaving, setIsSaving] = useState(false);
	const [showExporter, setShowExporter] = useState(false);
	const [timingAnalysis, setTimingAnalysis] = useState<TimingAnalysis | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);

	// Derived state
	const selectedSlide = useMemo(
		() => slides.find((s) => s.id === selectedSlideId) ?? null,
		[slides, selectedSlideId]
	);

	const selectedSlideIndex = useMemo(
		() => slides.findIndex((s) => s.id === selectedSlideId),
		[slides, selectedSlideId]
	);

	const totalDuration = useMemo(
		() => slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0),
		[slides]
	);

	const timeLimitSeconds = (presentation.timeLimit ?? 60) * 60;
	const isOverTime = totalDuration > timeLimitSeconds;

	const statusConfig = STATUS_CONFIG[presentation.status as PresentationStatus] ?? STATUS_CONFIG.draft;

	// Handlers
	const handleSlideSelect = useCallback((slideId: string) => {
		setSelectedSlideId(slideId);
	}, []);

	const handleSlideUpdate = useCallback(async (slideId: string, updates: Partial<PresentationSlide>) => {
		// Optimistic update
		setSlides((prev) =>
			prev.map((s) => (s.id === slideId ? { ...s, ...updates } : s))
		);

		// Filter out null values and prepare for server update
		const serverUpdates: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value !== null && value !== undefined && key !== "id") {
				serverUpdates[key] = value;
			}
		}

		// Persist to server
		const result = await updateSlide(slideId, serverUpdates);
		if (!result.success) {
			// Revert on failure
			setSlides(initialSlides);
		} else {
			onSlidesChange?.(slides);
		}
	}, [initialSlides, slides, onSlidesChange]);

	const handleAddSlide = useCallback(async () => {
		const newSlideNumber = slides.length + 1;
		const result = await createSlide(presentation.id, {
			slideNumber: newSlideNumber,
			slideType: "content",
			title: `Slide ${newSlideNumber}`,
		});

		if (result.success && result.data) {
			setSlides((prev) => [...prev, result.data as PresentationSlide]);
			setSelectedSlideId(result.data.id);
		}
	}, [presentation.id, slides.length]);

	const handleDeleteSlide = useCallback(async (slideId: string) => {
		const result = await deleteSlide(slideId);
		if (result.success) {
			setSlides((prev) => prev.filter((s) => s.id !== slideId));
			if (selectedSlideId === slideId) {
				setSelectedSlideId(slides[0]?.id ?? null);
			}
		}
	}, [selectedSlideId, slides]);

	const handleDuplicateSlide = useCallback(async (slideId: string) => {
		const slide = slides.find((s) => s.id === slideId);
		if (!slide) return;

		const result = await createSlide(presentation.id, {
			slideNumber: slides.length + 1,
			slideType: slide.slideType as "title" | "content" | "image" | "chart" | "table" | "section_divider" | "qa",
			title: `${slide.title} (Copy)`,
			content: slide.content as unknown as Array<{
				type: "text" | "bullet" | "image" | "chart" | "table" | "video" | "code" | "quote";
				data: unknown;
				position?: { x: number; y: number; width: number; height: number };
			}>,
			speakerNotes: slide.speakerNotes ?? undefined,
		});

		if (result.success && result.data) {
			setSlides((prev) => [...prev, result.data as PresentationSlide]);
			setSelectedSlideId(result.data.id);
		}
	}, [presentation.id, slides]);

	const handleReorderSlides = useCallback(async (newOrder: string[]) => {
		// Optimistic update
		const reordered = newOrder.map((id, idx) => {
			const slide = slides.find((s) => s.id === id);
			return slide ? { ...slide, slideNumber: idx + 1 } : null;
		}).filter(Boolean) as PresentationSlide[];

		setSlides(reordered);

		// Persist to server
		const result = await reorderSlides(presentation.id, newOrder);
		if (!result.success) {
			setSlides(initialSlides);
		}
	}, [presentation.id, slides, initialSlides]);

	const handleNavigateSlide = useCallback((direction: "prev" | "next") => {
		const newIndex = direction === "prev"
			? Math.max(0, selectedSlideIndex - 1)
			: Math.min(slides.length - 1, selectedSlideIndex + 1);
		setSelectedSlideId(slides[newIndex]?.id ?? null);
	}, [selectedSlideIndex, slides]);

	const handleValidateTiming = useCallback(async () => {
		const result = await validateTimelimits(presentation.id);
		if (result.success && result.data) {
			// Map function response to TimingAnalysis type
			const timingData: TimingAnalysis = {
				totalDuration: result.data.totalEstimatedSeconds,
				timeLimit: result.data.timeLimitSeconds,
				isWithinLimit: result.data.isWithinLimit,
				overUnderMinutes: Math.round(result.data.overageSeconds / 60),
				slideTiming: result.data.slideBreakdown.map((s) => ({
					slideId: s.slideId,
					slideNumber: s.slideNumber,
					title: s.title,
					estimatedDuration: s.estimatedSeconds,
					recommendedDuration: Math.round(result.data.timeLimitSeconds / result.data.slideBreakdown.length),
					status: s.estimatedSeconds > Math.round(result.data.timeLimitSeconds / result.data.slideBreakdown.length) * 1.2
						? "too_long" as const
						: s.estimatedSeconds < Math.round(result.data.timeLimitSeconds / result.data.slideBreakdown.length) * 0.5
							? "too_short" as const
							: "ok" as const,
				})),
				recommendations: result.data.recommendations,
			};
			setTimingAnalysis(timingData);
		}
	}, [presentation.id]);

	const handleGenerateSlides = useCallback(async () => {
		if (!presentation.sourceProposalId) return;
		setIsGenerating(true);
		try {
			const result = await generateSlidesFromProposal(
				presentation.id,
				presentation.sourceProposalId
			);
			if (result.success && result.data) {
				setSlides(result.data);
				setSelectedSlideId(result.data[0]?.id ?? null);
			}
		} finally {
			setIsGenerating(false);
		}
	}, [presentation.id, presentation.sourceProposalId]);

	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			const result = await updatePresentation(presentation.id, {});
			if (result.success && result.data) {
				onSave?.(result.data);
			}
		} finally {
			setIsSaving(false);
		}
	}, [presentation.id, onSave]);

	// Format duration
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Render slide thumbnail
	const renderSlideThumbnail = (slide: PresentationSlide, index: number) => {
		const isSelected = slide.id === selectedSlideId;
		return (
			<div
				key={slide.id}
				onClick={() => handleSlideSelect(slide.id)}
				className={cn(
					"group relative cursor-pointer rounded-lg border-2 p-2 transition-all",
					isSelected
						? "border-primary bg-primary/5"
						: "border-transparent hover:border-border hover:bg-muted/50"
				)}
			>
				<div className="flex items-start gap-2">
					<span className="text-xs font-medium text-muted-foreground w-4">
						{index + 1}
					</span>
					<div className="flex-1 min-w-0">
						<div className="aspect-[16/9] bg-muted rounded border overflow-hidden mb-1">
							<div className="p-1 text-[6px] leading-tight text-muted-foreground truncate">
								{slide.title ?? `Slide ${index + 1}`}
							</div>
						</div>
						<p className="text-xs font-medium truncate">
							{slide.title ?? `Slide ${index + 1}`}
						</p>
						<div className="flex items-center gap-1 mt-0.5">
							<Clock className="h-2.5 w-2.5 text-muted-foreground" />
							<span className="text-[10px] text-muted-foreground">
								{formatDuration(slide.estimatedDuration ?? 60)}
							</span>
						</div>
					</div>
				</div>

				{/* Slide actions (on hover) */}
				<div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-6 w-6">
								<MoreHorizontal className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => handleDuplicateSlide(slide.id)}>
								<Copy className="h-4 w-4 mr-2" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => handleDeleteSlide(slide.id)}
								className="text-destructive"
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		);
	};

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full bg-background", className)}>
				{/* Header Toolbar */}
				<header className="flex items-center justify-between px-4 py-2 border-b bg-card">
					<div className="flex items-center gap-4">
						{onClose && (
							<Button variant="ghost" size="sm" onClick={onClose}>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Back
							</Button>
						)}

						<div className="flex items-center gap-2">
							<Presentation className="h-5 w-5 text-primary" />
							<div>
								<h1 className="font-semibold text-sm">
									{presentation.title}
								</h1>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Badge variant="outline" className="h-5">
										<statusConfig.icon className="h-3 w-3 mr-1" />
										{statusConfig.label}
									</Badge>
									<span>{slides.length} slides</span>
									<span className={cn(
										"flex items-center gap-1",
										isOverTime && "text-destructive"
									)}>
										<Clock className="h-3 w-3" />
										{formatDuration(totalDuration)} / {presentation.timeLimit ?? 60}m
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* View Mode Toggle */}
						<div className="flex items-center border rounded-lg p-0.5">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={viewMode === "edit" ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setViewMode("edit")}
									>
										<FileText className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Edit Mode</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={viewMode === "preview" ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setViewMode("preview")}
									>
										<Eye className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Preview Mode</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={viewMode === "sorter" ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setViewMode("sorter")}
									>
										<Grid className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Slide Sorter</TooltipContent>
							</Tooltip>
						</div>

						<div className="h-6 w-px bg-border" />

						{/* AI Generate */}
						<Button
							variant="outline"
							size="sm"
							onClick={handleGenerateSlides}
							disabled={isGenerating}
						>
							<Wand2 className="h-4 w-4 mr-1" />
							{isGenerating ? "Generating..." : "Generate"}
						</Button>

						{/* Validate Timing */}
						<Button
							variant="outline"
							size="sm"
							onClick={handleValidateTiming}
						>
							<Clock className="h-4 w-4 mr-1" />
							Validate Timing
						</Button>

						{/* Export */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowExporter(true)}
						>
							<Download className="h-4 w-4 mr-1" />
							Export
						</Button>

						{/* Save */}
						<Button
							variant="primary"
							size="sm"
							onClick={handleSave}
							disabled={isSaving}
						>
							<Save className="h-4 w-4 mr-1" />
							{isSaving ? "Saving..." : "Save"}
						</Button>

						{/* Fullscreen */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setIsFullscreen(!isFullscreen)}
								>
									<Maximize2 className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Toggle Fullscreen</TooltipContent>
						</Tooltip>
					</div>
				</header>

				{/* Main Content */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left Sidebar - Slide List */}
					<aside className="w-60 border-r bg-muted/30 flex flex-col">
						<div className="flex items-center justify-between p-2 border-b">
							<span className="text-sm font-medium">Slides</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={handleAddSlide}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>

						<ScrollArea className="flex-1">
							<div className="p-2 space-y-1">
								{slides.map((slide, index) => renderSlideThumbnail(slide, index))}
							</div>
						</ScrollArea>

						<div className="p-2 border-t bg-card">
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={handleAddSlide}
							>
								<Plus className="h-4 w-4 mr-1" />
								Add Slide
							</Button>
						</div>
					</aside>

					{/* Main Editor Area */}
					<main className="flex-1 flex flex-col overflow-hidden">
						{viewMode === "sorter" ? (
							<SlideSorter
								slides={slides}
								onReorder={handleReorderSlides}
								onSlideSelect={handleSlideSelect}
								selectedSlideId={selectedSlideId}
							/>
						) : viewMode === "preview" ? (
							<SlidePreview
								slide={selectedSlide}
								slideIndex={selectedSlideIndex}
								totalSlides={slides.length}
								onNavigate={handleNavigateSlide}
								presentation={presentation}
							/>
						) : (
							<SlideEditor
								slide={selectedSlide}
								slideIndex={selectedSlideIndex}
								totalSlides={slides.length}
								onUpdate={handleSlideUpdate}
								onNavigate={handleNavigateSlide}
								presentation={presentation}
							/>
						)}
					</main>

					{/* Right Sidebar - Panels */}
					<aside className="w-80 border-l bg-muted/30 flex flex-col">
						<Tabs
							value={panelTab}
							onValueChange={(v) => setPanelTab(v as PanelTab)}
							className="flex flex-col h-full"
						>
							<TabsList className="mx-2 mt-2 grid grid-cols-5">
								<TabsTrigger value="slides" className="text-xs">
									<List className="h-3.5 w-3.5" />
								</TabsTrigger>
								<TabsTrigger value="notes" className="text-xs">
									<MessageSquare className="h-3.5 w-3.5" />
								</TabsTrigger>
								<TabsTrigger value="qa" className="text-xs">
									<HelpCircle className="h-3.5 w-3.5" />
								</TabsTrigger>
								<TabsTrigger value="team" className="text-xs">
									<Users className="h-3.5 w-3.5" />
								</TabsTrigger>
								<TabsTrigger value="timing" className="text-xs">
									<Clock className="h-3.5 w-3.5" />
								</TabsTrigger>
							</TabsList>

							<TabsContent value="slides" className="flex-1 overflow-hidden m-0">
								<ScrollArea className="h-full p-3">
									{selectedSlide ? (
										<Card>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">Slide Properties</CardTitle>
											</CardHeader>
											<CardContent className="space-y-3">
												<div>
													<label className="text-xs font-medium text-muted-foreground">
														Title
													</label>
													<Input
														value={selectedSlide.title ?? ""}
														onChange={(e) =>
															handleSlideUpdate(selectedSlide.id, {
																title: e.target.value,
															})
														}
														className="mt-1"
													/>
												</div>
												<div>
													<label className="text-xs font-medium text-muted-foreground">
														Duration (seconds)
													</label>
													<Input
														type="number"
														value={selectedSlide.estimatedDuration ?? 60}
														onChange={(e) =>
															handleSlideUpdate(selectedSlide.id, {
																estimatedDuration: parseInt(e.target.value) || 60,
															})
														}
														className="mt-1"
													/>
												</div>
												<div>
													<label className="text-xs font-medium text-muted-foreground">
														Type
													</label>
													<div className="mt-1">
														<Badge variant="outline">
															{selectedSlide.slideType ?? "content"}
														</Badge>
													</div>
												</div>
											</CardContent>
										</Card>
									) : (
										<div className="flex items-center justify-center h-full text-muted-foreground">
											Select a slide to edit
										</div>
									)}
								</ScrollArea>
							</TabsContent>

							<TabsContent value="notes" className="flex-1 overflow-hidden m-0">
								<SpeakerNotesEditor
									slide={selectedSlide}
									onUpdate={(notes) =>
										selectedSlide &&
										handleSlideUpdate(selectedSlide.id, { speakerNotes: notes })
									}
									presentationId={presentation.id}
								/>
							</TabsContent>

							<TabsContent value="qa" className="flex-1 overflow-hidden m-0">
								<QAPreparer
									presentationId={presentation.id}
									qaItems={qaItems}
									slides={slides}
								/>
							</TabsContent>

							<TabsContent value="team" className="flex-1 overflow-hidden m-0">
								<TeamAssignment
									presentationId={presentation.id}
									team={team}
									slides={slides}
								/>
							</TabsContent>

							<TabsContent value="timing" className="flex-1 overflow-hidden m-0">
								<TimingValidator
									presentationId={presentation.id}
									slides={slides}
									timeLimit={presentation.timeLimit ?? 60}
									analysis={timingAnalysis}
									onValidate={handleValidateTiming}
								/>
							</TabsContent>
						</Tabs>
					</aside>
				</div>

				{/* Export Dialog */}
				{showExporter && (
					<PresentationExporter
						presentation={presentation}
						slides={slides}
						onClose={() => setShowExporter(false)}
					/>
				)}
			</div>
		</TooltipProvider>
	);
}
