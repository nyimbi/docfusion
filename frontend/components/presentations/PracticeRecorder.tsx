"use client";

/**
 * PracticeRecorder Component - DocFusion
 *
 * Practice recording interface for oral presentations with real-time
 * timing feedback, slide tracking, and audio/video capture.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Mic,
	MicOff,
	Video,
	VideoOff,
	Play,
	Pause,
	Square,
	SkipForward,
	Clock,
	Timer,
	AlertTriangle,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Save,
	X,
	Wand2,
	RotateCcw,
	Settings,
	Volume2,
} from "lucide-react";
import { recordPractice } from "@/lib/actions/presentations";
import type { OralPresentation, PresentationSlide, PracticeRecording } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface PracticeRecorderProps {
	/** Presentation being practiced */
	presentation: OralPresentation;
	/** All slides */
	slides: PresentationSlide[];
	/** Callback when recording is saved */
	onRecordingSaved?: (recording: PracticeRecording) => void;
	/** Callback to close recorder */
	onClose?: () => void;
	/** Additional class names */
	className?: string;
}

type RecordingState = "idle" | "countdown" | "recording" | "paused" | "finished";

interface SlideTimingRecord {
	slideId: string;
	slideNumber: number;
	startTime: number;
	endTime?: number;
	duration?: number;
}

// ============================================================================
// Component
// ============================================================================

export function PracticeRecorder({
	presentation,
	slides,
	onRecordingSaved,
	onClose,
	className,
}: PracticeRecorderProps) {
	// State
	const [recordingState, setRecordingState] = useState<RecordingState>("idle");
	const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [slideTimings, setSlideTimings] = useState<SlideTimingRecord[]>([]);
	const [countdown, setCountdown] = useState(3);
	const [isAudioEnabled, setIsAudioEnabled] = useState(true);
	const [isVideoEnabled, setIsVideoEnabled] = useState(false);
	const [audioLevel, setAudioLevel] = useState(0);
	const [recordingName, setRecordingName] = useState(
		`Practice ${new Date().toLocaleDateString()}`
	);
	const [isSaving, setIsSaving] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showSaveDialog, setShowSaveDialog] = useState(false);

	// Refs
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const countdownRef = useRef<NodeJS.Timeout | null>(null);
	const startTimeRef = useRef<number>(0);
	const slideStartTimeRef = useRef<number>(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const recordedChunksRef = useRef<Blob[]>([]);

	// Derived state
	const currentSlide = slides[currentSlideIndex];
	const targetDuration = currentSlide?.estimatedDuration ?? 60;
	const slideElapsedTime = useMemo(() => {
		const currentRecord = slideTimings.find((t) => t.slideId === currentSlide?.id && !t.endTime);
		return currentRecord ? elapsedTime - currentRecord.startTime : 0;
	}, [slideTimings, currentSlide, elapsedTime]);

	const totalTargetTime = useMemo(
		() => slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0),
		[slides]
	);

	const isOverSlideTime = slideElapsedTime > targetDuration;
	const isOverTotalTime = elapsedTime > totalTargetTime;

	// Timer effect
	useEffect(() => {
		if (recordingState === "recording") {
			timerRef.current = setInterval(() => {
				setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
			}, 100);
		} else {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		}

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [recordingState]);

	// Countdown effect
	useEffect(() => {
		if (recordingState === "countdown") {
			if (countdown > 0) {
				countdownRef.current = setTimeout(() => {
					setCountdown((c) => c - 1);
				}, 1000);
			} else {
				// Start recording
				startTimeRef.current = Date.now();
				slideStartTimeRef.current = 0;
				setElapsedTime(0);
				setSlideTimings([{
					slideId: slides[0]?.id ?? "",
					slideNumber: 1,
					startTime: 0,
				}]);
				setRecordingState("recording");
				startMediaRecording();
			}
		}

		return () => {
			if (countdownRef.current) {
				clearTimeout(countdownRef.current);
			}
		};
	}, [recordingState, countdown, slides]);

	// Audio level monitoring
	useEffect(() => {
		if (recordingState === "recording" && isAudioEnabled && analyserRef.current) {
			const checkAudioLevel = () => {
				if (analyserRef.current) {
					const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
					analyserRef.current.getByteFrequencyData(dataArray);
					const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
					setAudioLevel(average / 255);
				}
			};

			const interval = setInterval(checkAudioLevel, 100);
			return () => clearInterval(interval);
		}
	}, [recordingState, isAudioEnabled]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopMediaRecording();
		};
	}, []);

	// Media recording functions
	const startMediaRecording = async () => {
		try {
			const constraints: MediaStreamConstraints = {
				audio: isAudioEnabled,
				video: isVideoEnabled,
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			mediaStreamRef.current = stream;

			// Set up audio analysis
			if (isAudioEnabled) {
				audioContextRef.current = new AudioContext();
				analyserRef.current = audioContextRef.current.createAnalyser();
				const source = audioContextRef.current.createMediaStreamSource(stream);
				source.connect(analyserRef.current);
			}

			// Set up media recorder
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			recordedChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					recordedChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.start(1000); // Collect data every second
		} catch (error) {
			console.error("Failed to start media recording:", error);
		}
	};

	const stopMediaRecording = () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop();
		}

		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}

		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}
	};

	// Handlers
	const handleStartRecording = useCallback(() => {
		setCountdown(3);
		setRecordingState("countdown");
	}, []);

	const handlePauseRecording = useCallback(() => {
		if (recordingState === "recording") {
			setRecordingState("paused");
			if (mediaRecorderRef.current) {
				mediaRecorderRef.current.pause();
			}
		} else if (recordingState === "paused") {
			setRecordingState("recording");
			if (mediaRecorderRef.current) {
				mediaRecorderRef.current.resume();
			}
		}
	}, [recordingState]);

	const handleStopRecording = useCallback(() => {
		// Finalize current slide timing
		setSlideTimings((prev) => {
			const updated = [...prev];
			const lastIndex = updated.findIndex((t) => !t.endTime);
			if (lastIndex !== -1) {
				updated[lastIndex] = {
					...updated[lastIndex],
					endTime: elapsedTime,
					duration: elapsedTime - updated[lastIndex].startTime,
				};
			}
			return updated;
		});

		setRecordingState("finished");
		stopMediaRecording();
		setShowSaveDialog(true);
	}, [elapsedTime]);

	const handleNextSlide = useCallback(() => {
		if (currentSlideIndex < slides.length - 1) {
			// End current slide timing
			setSlideTimings((prev) => {
				const updated = [...prev];
				const lastIndex = updated.findIndex((t) => !t.endTime);
				if (lastIndex !== -1) {
					updated[lastIndex] = {
						...updated[lastIndex],
						endTime: elapsedTime,
						duration: elapsedTime - updated[lastIndex].startTime,
					};
				}
				return updated;
			});

			// Start new slide timing
			const newIndex = currentSlideIndex + 1;
			setCurrentSlideIndex(newIndex);
			setSlideTimings((prev) => [
				...prev,
				{
					slideId: slides[newIndex]?.id ?? "",
					slideNumber: newIndex + 1,
					startTime: elapsedTime,
				},
			]);
		}
	}, [currentSlideIndex, slides, elapsedTime]);

	const handlePrevSlide = useCallback(() => {
		if (currentSlideIndex > 0) {
			setCurrentSlideIndex((prev) => prev - 1);
		}
	}, [currentSlideIndex]);

	const handleSaveRecording = useCallback(async () => {
		setIsSaving(true);
		try {
			// Generate unique recording reference ID for database tracking
			// Actual media upload to storage (S3/blob) would be handled by a separate upload service
			const recordingRef = `practice-${presentation.id}-${Date.now()}`;
			const result = await recordPractice(
				presentation.id,
				recordingRef,
				elapsedTime,
				{ recordingType: "full" }
			);

			if (result.success && result.data) {
				onRecordingSaved?.(result.data);
				setShowSaveDialog(false);
				onClose?.();
			}
		} finally {
			setIsSaving(false);
		}
	}, [presentation.id, elapsedTime, onRecordingSaved, onClose]);

	const handleReset = useCallback(() => {
		setRecordingState("idle");
		setCurrentSlideIndex(0);
		setElapsedTime(0);
		setSlideTimings([]);
		stopMediaRecording();
	}, []);

	// Format time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(Math.abs(seconds) / 60);
		const secs = Math.abs(seconds) % 60;
		const sign = seconds < 0 ? "-" : "";
		return `${sign}${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full bg-background", className)}>
				{/* Header */}
				<header className="flex items-center justify-between px-4 py-3 border-b bg-card">
					<div className="flex items-center gap-3">
						<Mic className="h-5 w-5 text-primary" />
						<div>
							<h1 className="font-semibold">Practice Recording</h1>
							<p className="text-sm text-muted-foreground">{presentation.title}</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{recordingState === "idle" && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowSettings(true)}
							>
								<Settings className="h-4 w-4" />
							</Button>
						)}

						{onClose && (
							<Button variant="ghost" size="icon" onClick={onClose}>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</header>

				{/* Main Content */}
				<div className="flex-1 flex overflow-hidden">
					{/* Slide Preview */}
					<div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/30">
						{recordingState === "countdown" ? (
							<div className="text-center">
								<div className="text-8xl font-bold text-primary animate-pulse">
									{countdown}
								</div>
								<p className="text-lg text-muted-foreground mt-4">
									Get ready to present...
								</p>
							</div>
						) : (
							<Card className="w-full max-w-4xl aspect-[16/9] overflow-hidden shadow-2xl">
								<div
									className={cn(
										"h-full p-8 flex flex-col",
										currentSlide?.backgroundColor
											? `bg-[${currentSlide.backgroundColor}]`
											: "bg-gradient-to-br from-slate-900 to-slate-800"
									)}
								>
									{currentSlide?.title && (
										<h1 className="text-3xl font-bold text-white mb-4">
											{currentSlide.title}
										</h1>
									)}

									<div className="flex-1 flex items-center justify-center">
										<p className="text-white/70 text-lg">
											Slide {currentSlideIndex + 1} of {slides.length}
										</p>
									</div>

									<div className="text-white/50 text-sm text-right">
										{currentSlideIndex + 1}
									</div>
								</div>
							</Card>
						)}
					</div>

					{/* Right Panel - Timer & Controls */}
					<aside className="w-80 border-l bg-card flex flex-col">
						{/* Timer Display */}
						<div className="p-4 border-b">
							{/* Total Time */}
							<div className={cn(
								"text-center p-4 rounded-lg mb-4",
								isOverTotalTime ? "bg-destructive/10" : "bg-muted"
							)}>
								<p className="text-sm text-muted-foreground mb-1">Total Time</p>
								<p className={cn(
									"text-4xl font-mono font-bold",
									isOverTotalTime && "text-destructive"
								)}>
									{formatTime(elapsedTime)}
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Target: {formatTime(totalTargetTime)}
								</p>
							</div>

							{/* Slide Time */}
							<div className={cn(
								"text-center p-3 rounded-lg",
								isOverSlideTime ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-muted/50"
							)}>
								<p className="text-xs text-muted-foreground mb-1">
									Slide {currentSlideIndex + 1} Time
								</p>
								<div className="flex items-center justify-center gap-2">
									<Timer className={cn(
										"h-4 w-4",
										isOverSlideTime && "text-yellow-600"
									)} />
									<span className={cn(
										"text-xl font-mono font-medium",
										isOverSlideTime && "text-yellow-600"
									)}>
										{formatTime(slideElapsedTime)} / {formatTime(targetDuration)}
									</span>
								</div>

								<Progress
									value={Math.min((slideElapsedTime / targetDuration) * 100, 100)}
									className={cn(
										"h-1.5 mt-2",
										isOverSlideTime && "[&>div]:bg-yellow-500"
									)}
								/>
							</div>
						</div>

						{/* Audio Level */}
						{isAudioEnabled && recordingState === "recording" && (
							<div className="px-4 py-2 border-b">
								<div className="flex items-center gap-2">
									<Volume2 className="h-4 w-4 text-muted-foreground" />
									<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
										<div
											className="h-full bg-primary transition-all"
											style={{ width: `${audioLevel * 100}%` }}
										/>
									</div>
								</div>
							</div>
						)}

						{/* Slide Navigation */}
						<div className="p-4 border-b">
							<div className="flex items-center justify-between">
								<Button
									variant="outline"
									size="icon"
									onClick={handlePrevSlide}
									disabled={currentSlideIndex === 0}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>

								<span className="text-sm font-medium">
									{currentSlideIndex + 1} / {slides.length}
								</span>

								<Button
									variant="outline"
									size="icon"
									onClick={handleNextSlide}
									disabled={currentSlideIndex >= slides.length - 1}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>

							<p className="text-center text-sm text-muted-foreground mt-2 truncate">
								{currentSlide?.title ?? `Slide ${currentSlideIndex + 1}`}
							</p>
						</div>

						{/* Speaker Notes Preview */}
						{currentSlide?.speakerNotes && (
							<div className="flex-1 overflow-auto p-4 border-b">
								<h4 className="text-xs font-medium text-muted-foreground mb-2">
									Speaker Notes
								</h4>
								<p className="text-sm whitespace-pre-wrap">
									{currentSlide.speakerNotes}
								</p>
							</div>
						)}

						{/* Recording Controls */}
						<div className="p-4 mt-auto">
							{recordingState === "idle" && (
								<Button
									className="w-full"
									size="lg"
									onClick={handleStartRecording}
								>
									<Play className="h-5 w-5 mr-2" />
									Start Recording
								</Button>
							)}

							{recordingState === "countdown" && (
								<Button
									className="w-full"
									size="lg"
									variant="outline"
									onClick={handleReset}
								>
									<X className="h-5 w-5 mr-2" />
									Cancel
								</Button>
							)}

							{(recordingState === "recording" || recordingState === "paused") && (
								<div className="space-y-2">
									<div className="flex gap-2">
										<Button
											variant="outline"
											className="flex-1"
											onClick={handlePauseRecording}
										>
											{recordingState === "paused" ? (
												<>
													<Play className="h-4 w-4 mr-1" />
													Resume
												</>
											) : (
												<>
													<Pause className="h-4 w-4 mr-1" />
													Pause
												</>
											)}
										</Button>

										<Button
											variant="danger"
											className="flex-1"
											onClick={handleStopRecording}
										>
											<Square className="h-4 w-4 mr-1" />
											Stop
										</Button>
									</div>

									<Button
										variant="ghost"
										size="sm"
										className="w-full"
										onClick={handleNextSlide}
										disabled={currentSlideIndex >= slides.length - 1}
									>
										<SkipForward className="h-4 w-4 mr-1" />
										Next Slide
									</Button>
								</div>
							)}

							{recordingState === "finished" && (
								<div className="space-y-2">
									<Button
										className="w-full"
										onClick={() => setShowSaveDialog(true)}
									>
										<Save className="h-4 w-4 mr-1" />
										Save Recording
									</Button>

									<Button
										variant="outline"
										className="w-full"
										onClick={handleReset}
									>
										<RotateCcw className="h-4 w-4 mr-1" />
										Start Over
									</Button>
								</div>
							)}
						</div>
					</aside>
				</div>

				{/* Status Bar */}
				{recordingState === "recording" && (
					<div className="flex items-center justify-center gap-4 px-4 py-2 border-t bg-destructive/10">
						<div className="flex items-center gap-2 text-destructive">
							<div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
							<span className="text-sm font-medium">Recording</span>
						</div>

						{isAudioEnabled && (
							<Badge variant="outline">
								<Mic className="h-3 w-3 mr-1" />
								Audio
							</Badge>
						)}

						{isVideoEnabled && (
							<Badge variant="outline">
								<Video className="h-3 w-3 mr-1" />
								Video
							</Badge>
						)}
					</div>
				)}

				{/* Save Dialog */}
				<Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Save Recording</DialogTitle>
							<DialogDescription>
								Save this practice recording for analysis and comparison.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div>
								<label className="text-sm font-medium">Recording Name</label>
								<Input
									value={recordingName}
									onChange={(e) => setRecordingName(e.target.value)}
									className="mt-1"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4 text-sm">
								<div className="p-3 bg-muted rounded-lg">
									<p className="text-muted-foreground">Total Duration</p>
									<p className="text-lg font-medium">{formatTime(elapsedTime)}</p>
								</div>
								<div className="p-3 bg-muted rounded-lg">
									<p className="text-muted-foreground">Slides Covered</p>
									<p className="text-lg font-medium">{slideTimings.length} / {slides.length}</p>
								</div>
							</div>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setShowSaveDialog(false)}>
								Cancel
							</Button>
							<Button onClick={handleSaveRecording} disabled={isSaving}>
								{isSaving ? "Saving..." : "Save Recording"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Settings Dialog */}
				<Dialog open={showSettings} onOpenChange={setShowSettings}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Recording Settings</DialogTitle>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{isAudioEnabled ? (
										<Mic className="h-4 w-4" />
									) : (
										<MicOff className="h-4 w-4 text-muted-foreground" />
									)}
									<span>Record Audio</span>
								</div>
								<Button
									variant={isAudioEnabled ? "secondary" : "outline"}
									size="sm"
									onClick={() => setIsAudioEnabled(!isAudioEnabled)}
								>
									{isAudioEnabled ? "Enabled" : "Disabled"}
								</Button>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{isVideoEnabled ? (
										<Video className="h-4 w-4" />
									) : (
										<VideoOff className="h-4 w-4 text-muted-foreground" />
									)}
									<span>Record Video</span>
								</div>
								<Button
									variant={isVideoEnabled ? "secondary" : "outline"}
									size="sm"
									onClick={() => setIsVideoEnabled(!isVideoEnabled)}
								>
									{isVideoEnabled ? "Enabled" : "Disabled"}
								</Button>
							</div>
						</div>

						<DialogFooter>
							<Button onClick={() => setShowSettings(false)}>Done</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	);
}
