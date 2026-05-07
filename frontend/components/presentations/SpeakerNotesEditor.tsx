"use client";

/**
 * SpeakerNotesEditor Component - DocFusion
 *
 * Speaker notes editor with AI-powered generation, word count tracking,
 * and suggested talking points.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	MessageSquare,
	Wand2,
	RefreshCw,
	Clock,
	FileText,
	CheckCircle,
	AlertTriangle,
	Sparkles,
	Copy,
	Trash2,
	List,
	Plus,
} from "lucide-react";
import { generateSpeakerNotes } from "@/lib/actions/presentations";
import type { PresentationSlide } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface SpeakerNotesEditorProps {
	/** The slide being edited */
	slide: PresentationSlide | null;
	/** Callback when notes are updated */
	onUpdate: (notes: string) => void;
	/** Presentation ID for context */
	presentationId: string;
	/** Additional class names */
	className?: string;
}

interface SuggestedPoint {
	id: string;
	text: string;
	included: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TARGET_WPM = 150; // Average speaking rate
const WORDS_PER_MINUTE_RANGE = { min: 120, max: 180 };

// ============================================================================
// Component
// ============================================================================

export function SpeakerNotesEditor({
	slide,
	onUpdate,
	presentationId,
	className,
}: SpeakerNotesEditorProps) {
	// State
	const [notes, setNotes] = useState(slide?.speakerNotes ?? "");
	const [isGenerating, setIsGenerating] = useState(false);
	const [suggestedPoints, setSuggestedPoints] = useState<SuggestedPoint[]>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);

	// Update local notes when slide changes
	useMemo(() => {
		setNotes(slide?.speakerNotes ?? "");
	}, [slide?.speakerNotes]);

	// Calculations
	const wordCount = useMemo(() => {
		return notes.trim().split(/\s+/).filter(Boolean).length;
	}, [notes]);

	const targetDuration = slide?.estimatedDuration ?? 60;
	const targetWords = Math.round((targetDuration / 60) * TARGET_WPM);
	const estimatedDuration = Math.round((wordCount / TARGET_WPM) * 60);

	const wordProgress = Math.min((wordCount / targetWords) * 100, 150);
	const isUnderTarget = wordCount < targetWords * 0.8;
	const isOverTarget = wordCount > targetWords * 1.2;

	const durationStatus = useMemo(() => {
		if (isUnderTarget) {
			return {
				status: "under" as const,
				message: `${targetWords - wordCount} more words needed for target duration`,
				color: "text-yellow-600",
			};
		}
		if (isOverTarget) {
			return {
				status: "over" as const,
				message: `${wordCount - targetWords} words over target`,
				color: "text-destructive",
			};
		}
		return {
			status: "good" as const,
			message: "Notes match target duration",
			color: "text-green-600",
		};
	}, [wordCount, targetWords, isUnderTarget, isOverTarget]);

	// Handlers
	const handleNotesChange = useCallback((value: string) => {
		setNotes(value);
		onUpdate(value);
	}, [onUpdate]);

	const handleGenerateNotes = useCallback(async () => {
		if (!slide) return;

		setIsGenerating(true);
		try {
			const result = await generateSpeakerNotes(slide.id);
			if (result.success && result.data) {
				setNotes(result.data);
				onUpdate(result.data);

				// Extract bullet points from generated notes for suggestions
				const bulletPoints = result.data
					.split("\n")
					.filter((line: string) => line.trim().startsWith("-") || line.trim().startsWith("•"))
					.map((line: string) => line.replace(/^[-•]\s*/, "").trim())
					.filter((text: string) => text.length > 0);

				if (bulletPoints.length > 0) {
					setSuggestedPoints(
						bulletPoints.map((point: string, i: number) => ({
							id: `point-${i}`,
							text: point,
							included: true,
						}))
					);
				}
			}
		} finally {
			setIsGenerating(false);
		}
	}, [slide, onUpdate]);

	const handleAddSuggestedPoint = useCallback((point: SuggestedPoint) => {
		const updatedNotes = notes
			? `${notes}\n\n- ${point.text}`
			: `- ${point.text}`;
		setNotes(updatedNotes);
		onUpdate(updatedNotes);

		// Mark as included
		setSuggestedPoints((prev) =>
			prev.map((p) => (p.id === point.id ? { ...p, included: true } : p))
		);
	}, [notes, onUpdate]);

	const handleClearNotes = useCallback(() => {
		setNotes("");
		onUpdate("");
	}, [onUpdate]);

	const handleCopyNotes = useCallback(() => {
		navigator.clipboard.writeText(notes);
	}, [notes]);

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (!slide) {
		return (
			<div className={cn("flex items-center justify-center h-full p-4", className)}>
				<div className="text-center text-muted-foreground">
					<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
					<p className="text-sm">Select a slide to edit notes</p>
				</div>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<ScrollArea className={cn("h-full", className)}>
				<div className="p-3 space-y-4">
					{/* Header */}
					<div className="flex items-center justify-between">
						<h3 className="font-medium flex items-center gap-2">
							<MessageSquare className="h-4 w-4" />
							Speaker Notes
						</h3>

						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={handleCopyNotes}
										disabled={!notes}
									>
										<Copy className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Copy Notes</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={handleClearNotes}
										disabled={!notes}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Clear Notes</TooltipContent>
							</Tooltip>
						</div>
					</div>

					{/* Slide Context */}
					<Card className="bg-muted/50">
						<CardContent className="p-3">
							<div className="text-sm">
								<p className="font-medium truncate">
									{slide.title ?? `Slide ${slide.slideNumber}`}
								</p>
								<div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										{formatDuration(targetDuration)} target
									</span>
									<span className="flex items-center gap-1">
										<FileText className="h-3 w-3" />
										~{targetWords} words
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Notes Editor */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Notes</span>
							<Button
								variant="outline"
								size="sm"
								onClick={handleGenerateNotes}
								disabled={isGenerating}
								className="h-7"
							>
								{isGenerating ? (
									<RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
								) : (
									<Wand2 className="h-3.5 w-3.5 mr-1" />
								)}
								{isGenerating ? "Generating..." : "Generate with AI"}
							</Button>
						</div>

						<Textarea
							value={notes}
							onChange={(e) => handleNotesChange(e.target.value)}
							placeholder="Enter speaker notes for this slide...

Tips:
- Include key points to cover
- Add transition phrases
- Note any demos or visuals to reference
- Include backup talking points"
							className="min-h-[200px] text-sm resize-none"
						/>
					</div>

					{/* Word Count & Duration Stats */}
					<Card>
						<CardContent className="p-3 space-y-3">
							{/* Word Count Progress */}
							<div>
								<div className="flex items-center justify-between text-xs mb-1">
									<span className="text-muted-foreground">Word Count</span>
									<span className={cn("font-medium", durationStatus.color)}>
										{wordCount} / {targetWords} words
									</span>
								</div>
								<Progress
									value={Math.min(wordProgress, 100)}
									className={cn(
										"h-1.5",
										isOverTarget && "[&>div]:bg-destructive",
										isUnderTarget && "[&>div]:bg-yellow-500"
									)}
								/>
							</div>

							{/* Estimated Duration */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">Est. Speaking Time</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">
										{formatDuration(estimatedDuration)}
									</span>
									{durationStatus.status === "good" && (
										<CheckCircle className="h-4 w-4 text-green-600" />
									)}
									{durationStatus.status === "over" && (
										<AlertTriangle className="h-4 w-4 text-destructive" />
									)}
									{durationStatus.status === "under" && (
										<AlertTriangle className="h-4 w-4 text-yellow-600" />
									)}
								</div>
							</div>

							{/* Status Message */}
							<p className={cn("text-xs", durationStatus.color)}>
								{durationStatus.message}
							</p>
						</CardContent>
					</Card>

					{/* Suggested Talking Points */}
					{suggestedPoints.length > 0 && (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm flex items-center gap-2">
									<Sparkles className="h-4 w-4 text-primary" />
									Suggested Talking Points
								</CardTitle>
							</CardHeader>
							<CardContent className="p-3 pt-0">
								<div className="space-y-2">
									{suggestedPoints.map((point) => (
										<div
											key={point.id}
											className={cn(
												"flex items-start gap-2 p-2 rounded border text-sm",
												point.included
													? "bg-muted/50 border-muted"
													: "bg-background hover:bg-muted/50"
											)}
										>
											<List className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
											<p className="flex-1">{point.text}</p>
											{!point.included && (
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 shrink-0"
													onClick={() => handleAddSuggestedPoint(point)}
												>
													<Plus className="h-3 w-3" />
												</Button>
											)}
											{point.included && (
												<Badge variant="secondary" className="shrink-0">
													<CheckCircle className="h-3 w-3 mr-1" />
													Added
												</Badge>
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Tips */}
					<Card className="bg-primary/5 border-primary/20">
						<CardContent className="p-3">
							<h4 className="text-sm font-medium flex items-center gap-2 mb-2">
								<Sparkles className="h-4 w-4 text-primary" />
								Tips for Effective Speaker Notes
							</h4>
							<ul className="text-xs text-muted-foreground space-y-1">
								<li>Keep notes concise - bullet points work best</li>
								<li>Include transitions between key points</li>
								<li>Note when to pause for emphasis</li>
								<li>
									Target {WORDS_PER_MINUTE_RANGE.min}-{WORDS_PER_MINUTE_RANGE.max} words per minute
								</li>
								<li>Practice reading aloud to verify timing</li>
							</ul>
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</TooltipProvider>
	);
}
