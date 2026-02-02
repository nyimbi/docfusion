"use client";

/**
 * SlidePreview Component - DocFusion
 *
 * Preview slide with transitions, speaker notes, and presentation mode.
 * Supports fullscreen preview and slide navigation.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ChevronLeft,
	ChevronRight,
	Play,
	Pause,
	SkipForward,
	SkipBack,
	Maximize2,
	Minimize2,
	Clock,
	MessageSquare,
	Eye,
	EyeOff,
	Timer,
	RotateCcw,
} from "lucide-react";
import type { OralPresentation, PresentationSlide, SlideContentElement } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface SlidePreviewProps {
	/** The slide to preview */
	slide: PresentationSlide | null;
	/** Current slide index (0-based) */
	slideIndex: number;
	/** Total number of slides */
	totalSlides: number;
	/** Callback to navigate slides */
	onNavigate: (direction: "prev" | "next") => void;
	/** Parent presentation for context */
	presentation: OralPresentation;
	/** Additional class names */
	className?: string;
}

type TransitionType = "none" | "fade" | "slide-left" | "slide-right" | "zoom";

// ============================================================================
// Transition Styles
// ============================================================================

const transitionStyles: Record<TransitionType, string> = {
	none: "",
	fade: "animate-in fade-in duration-500",
	"slide-left": "animate-in slide-in-from-right duration-500",
	"slide-right": "animate-in slide-in-from-left duration-500",
	zoom: "animate-in zoom-in-95 duration-500",
};

// ============================================================================
// Component
// ============================================================================

export function SlidePreview({
	slide,
	slideIndex,
	totalSlides,
	onNavigate,
	presentation,
	className,
}: SlidePreviewProps) {
	// State
	const [showNotes, setShowNotes] = useState(true);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isAutoPlay, setIsAutoPlay] = useState(false);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [slideStartTime, setSlideStartTime] = useState<number | null>(null);
	const [transition, setTransition] = useState<TransitionType>("fade");
	const [slideKey, setSlideKey] = useState(0);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

	// Parse content elements
	const contentElements = slide?.content
		? (Array.isArray(slide.content) ? slide.content : []) as SlideContentElement[]
		: [];

	// Timer
	useEffect(() => {
		if (slideStartTime) {
			timerRef.current = setInterval(() => {
				setElapsedTime(Math.floor((Date.now() - slideStartTime) / 1000));
			}, 1000);
		}

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [slideStartTime]);

	// Auto-play
	useEffect(() => {
		if (isAutoPlay && slide) {
			const duration = (slide.estimatedDuration ?? 60) * 1000;
			autoPlayRef.current = setTimeout(() => {
				if (slideIndex < totalSlides - 1) {
					handleNext();
				} else {
					setIsAutoPlay(false);
				}
			}, duration);
		}

		return () => {
			if (autoPlayRef.current) {
				clearTimeout(autoPlayRef.current);
			}
		};
	}, [isAutoPlay, slide, slideIndex, totalSlides]);

	// Reset timer on slide change
	useEffect(() => {
		setElapsedTime(0);
		setSlideStartTime(slideStartTime ? Date.now() : null);
		setSlideKey((k) => k + 1); // Trigger transition
	}, [slideIndex]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight" || e.key === " ") {
				e.preventDefault();
				handleNext();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				handlePrev();
			} else if (e.key === "Escape" && isFullscreen) {
				setIsFullscreen(false);
			} else if (e.key === "f" || e.key === "F") {
				setIsFullscreen(!isFullscreen);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isFullscreen, slideIndex, totalSlides]);

	// Handlers
	const handlePrev = useCallback(() => {
		if (slideIndex > 0) {
			setTransition("slide-right");
			onNavigate("prev");
		}
	}, [slideIndex, onNavigate]);

	const handleNext = useCallback(() => {
		if (slideIndex < totalSlides - 1) {
			setTransition("slide-left");
			onNavigate("next");
		}
	}, [slideIndex, totalSlides, onNavigate]);

	const handleToggleTimer = useCallback(() => {
		if (slideStartTime) {
			setSlideStartTime(null);
			setElapsedTime(0);
		} else {
			setSlideStartTime(Date.now());
		}
	}, [slideStartTime]);

	const handleResetTimer = useCallback(() => {
		setSlideStartTime(Date.now());
		setElapsedTime(0);
	}, []);

	const handleToggleAutoPlay = useCallback(() => {
		setIsAutoPlay(!isAutoPlay);
		if (!isAutoPlay && !slideStartTime) {
			setSlideStartTime(Date.now());
		}
	}, [isAutoPlay, slideStartTime]);

	const handleFullscreen = useCallback(async () => {
		if (!containerRef.current) return;

		if (!isFullscreen) {
			try {
				await containerRef.current.requestFullscreen();
				setIsFullscreen(true);
			} catch {
				// Fallback for browsers that don't support fullscreen
				setIsFullscreen(true);
			}
		} else {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			}
			setIsFullscreen(false);
		}
	}, [isFullscreen]);

	// Format time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Progress calculation
	const targetDuration = slide?.estimatedDuration ?? 60;
	const progress = Math.min((elapsedTime / targetDuration) * 100, 100);
	const isOverTime = elapsedTime > targetDuration;

	if (!slide) {
		return (
			<div className={cn("flex items-center justify-center h-full bg-muted/30", className)}>
				<div className="text-center text-muted-foreground">
					<Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p className="text-lg font-medium">No Slide Selected</p>
					<p className="text-sm mt-1">Select a slide to preview</p>
				</div>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<div
				ref={containerRef}
				className={cn(
					"flex flex-col h-full",
					isFullscreen && "fixed inset-0 z-50 bg-background",
					className
				)}
			>
				{/* Controls Bar */}
				<div className={cn(
					"flex items-center justify-between px-4 py-2 border-b bg-card",
					isFullscreen && "absolute top-0 left-0 right-0 z-10 bg-background/90 backdrop-blur"
				)}>
					<div className="flex items-center gap-2">
						{/* Navigation */}
						<Button
							variant="ghost"
							size="icon"
							onClick={handlePrev}
							disabled={slideIndex <= 0}
						>
							<SkipBack className="h-4 w-4" />
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onClick={handlePrev}
							disabled={slideIndex <= 0}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						<span className="text-sm font-medium min-w-[80px] text-center">
							{slideIndex + 1} / {totalSlides}
						</span>

						<Button
							variant="ghost"
							size="icon"
							onClick={handleNext}
							disabled={slideIndex >= totalSlides - 1}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onClick={handleNext}
							disabled={slideIndex >= totalSlides - 1}
						>
							<SkipForward className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex items-center gap-2">
						{/* Timer */}
						<div className={cn(
							"flex items-center gap-2 px-3 py-1 rounded-lg",
							isOverTime ? "bg-destructive/10 text-destructive" : "bg-muted"
						)}>
							<Timer className="h-4 w-4" />
							<span className="font-mono text-sm">
								{formatTime(elapsedTime)} / {formatTime(targetDuration)}
							</span>
						</div>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleToggleTimer}
								>
									{slideStartTime ? (
										<Pause className="h-4 w-4" />
									) : (
										<Play className="h-4 w-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{slideStartTime ? "Pause Timer" : "Start Timer"}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleResetTimer}
								>
									<RotateCcw className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Reset Timer</TooltipContent>
						</Tooltip>

						<div className="h-6 w-px bg-border" />

						{/* Auto-play */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={isAutoPlay ? "secondary" : "ghost"}
									size="icon"
									onClick={handleToggleAutoPlay}
								>
									{isAutoPlay ? (
										<Pause className="h-4 w-4" />
									) : (
										<Play className="h-4 w-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{isAutoPlay ? "Stop Auto-play" : "Start Auto-play"}
							</TooltipContent>
						</Tooltip>

						{/* Notes Toggle */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={showNotes ? "secondary" : "ghost"}
									size="icon"
									onClick={() => setShowNotes(!showNotes)}
								>
									{showNotes ? (
										<MessageSquare className="h-4 w-4" />
									) : (
										<EyeOff className="h-4 w-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{showNotes ? "Hide Notes" : "Show Notes"}
							</TooltipContent>
						</Tooltip>

						{/* Fullscreen */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleFullscreen}
								>
									{isFullscreen ? (
										<Minimize2 className="h-4 w-4" />
									) : (
										<Maximize2 className="h-4 w-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

				{/* Main Preview Area */}
				<div className={cn(
					"flex-1 flex",
					showNotes ? "gap-4" : "",
					isFullscreen ? "p-8" : "p-4"
				)}>
					{/* Slide Preview */}
					<div className={cn(
						"flex-1 flex items-center justify-center",
						showNotes && !isFullscreen ? "w-2/3" : "w-full"
					)}>
						<Card
							key={slideKey}
							className={cn(
								"w-full max-w-4xl aspect-[16/9] overflow-hidden shadow-2xl",
								transitionStyles[transition]
							)}
						>
							<div
								className={cn(
									"h-full p-8 flex flex-col",
									slide.backgroundColor
										? `bg-[${slide.backgroundColor}]`
										: "bg-gradient-to-br from-slate-900 to-slate-800"
								)}
								style={slide.backgroundImage ? {
									backgroundImage: `url(${slide.backgroundImage})`,
									backgroundSize: "cover",
									backgroundPosition: "center",
								} : undefined}
							>
								{/* Slide Title */}
								{slide.title && (
									<h1 className="text-3xl md:text-4xl font-bold text-white mb-6">
										{slide.title}
									</h1>
								)}

								{/* Content */}
								<div className="flex-1 space-y-4">
									{contentElements.map((element, index) => (
										<div key={index} className="text-white/90">
											{element.type === "text" && (
												<p className="text-lg whitespace-pre-wrap">
													{element.data as string}
												</p>
											)}
											{element.type === "bullet" && (
												<ul className="text-lg space-y-2 list-disc list-inside">
													{((element.data as string) ?? "").split("\n").map((item, i) => (
														<li key={i}>{item}</li>
													))}
												</ul>
											)}
											{element.type === "quote" && (
												<blockquote className="text-xl italic border-l-4 border-white/50 pl-4">
													{element.data as string}
												</blockquote>
											)}
											{element.type === "code" && (
												<pre className="bg-black/30 p-4 rounded-lg text-sm font-mono overflow-x-auto">
													{element.data as string}
												</pre>
											)}
											{(element.type === "image" || element.type === "chart" || element.type === "table") && (
												<div className="flex items-center justify-center h-48 bg-white/10 rounded-lg">
													<span className="text-white/50 text-sm">
														[{element.type} placeholder]
													</span>
												</div>
											)}
										</div>
									))}
								</div>

								{/* Slide Number */}
								<div className="text-white/50 text-sm text-right mt-4">
									{slideIndex + 1}
								</div>
							</div>
						</Card>
					</div>

					{/* Speaker Notes */}
					{showNotes && !isFullscreen && (
						<div className="w-1/3 min-w-[280px]">
							<Card className="h-full">
								<CardContent className="p-4 h-full flex flex-col">
									<div className="flex items-center justify-between mb-3">
										<h3 className="font-medium flex items-center gap-2">
											<MessageSquare className="h-4 w-4" />
											Speaker Notes
										</h3>
										<Badge variant="outline">
											<Clock className="h-3 w-3 mr-1" />
											{formatTime(slide.estimatedDuration ?? 60)}
										</Badge>
									</div>

									<div className="flex-1 overflow-auto">
										{slide.speakerNotes ? (
											<p className="text-sm whitespace-pre-wrap">
												{slide.speakerNotes}
											</p>
										) : (
											<p className="text-sm text-muted-foreground italic">
												No speaker notes for this slide.
											</p>
										)}
									</div>

									{/* Progress */}
									<div className="mt-4 pt-4 border-t">
										<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
											<span>Slide Progress</span>
											<span className={isOverTime ? "text-destructive" : ""}>
												{Math.round(progress)}%
											</span>
										</div>
										<Progress
											value={Math.min(progress, 100)}
											className={cn(
												"h-1.5",
												isOverTime && "[&>div]:bg-destructive"
											)}
										/>
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</div>

				{/* Progress Bar at Bottom */}
				<div className="h-1 bg-muted">
					<div
						className={cn(
							"h-full transition-all duration-300",
							isOverTime ? "bg-destructive" : "bg-primary"
						)}
						style={{ width: `${Math.min(progress, 100)}%` }}
					/>
				</div>
			</div>
		</TooltipProvider>
	);
}
