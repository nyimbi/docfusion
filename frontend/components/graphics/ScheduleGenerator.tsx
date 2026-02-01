"use client";

/**
 * ScheduleGenerator Component - DocFusion
 *
 * Form-based generator for creating schedule/Gantt charts from phase data.
 * Supports phase definition, date ranges, and milestone markers.
 *
 * Features:
 * - Add/edit/remove phases with name, start/end dates
 * - Add milestones within phases
 * - Live preview of generated Gantt chart
 * - Date validation and overlap detection
 * - Export to proposal graphic
 *
 * @module components/graphics/ScheduleGenerator
 */

import * as React from "react";
import { useCallback, useState, useTransition, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Button,
	Input,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { generateSchedule, type ScheduleData } from "@/lib/actions/graphics";
import { GraphicPreview } from "./GraphicPreview";
import {
	Plus,
	Trash2,
	Calendar,
	Flag,
	Wand2,
	AlertCircle,
	ChevronUp,
	ChevronDown,
	CalendarDays,
	Clock,
} from "lucide-react";

interface Milestone {
	id: string;
	name: string;
	date: string;
}

interface Phase {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	milestones: Milestone[];
}

interface ScheduleGeneratorProps {
	/** Initial schedule title */
	initialTitle?: string;
	/** Initial phases to populate the form */
	initialPhases?: Phase[];
	/** Callback when a schedule is generated */
	onGenerate?: (result: {
		diagramCode: string;
		format: "mermaid" | "d2";
		suggestedCaption: string;
		suggestedActionCaption: string;
	}) => void;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
	return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format date for display
 */
function formatDateForInput(date: Date): string {
	return date.toISOString().split("T")[0];
}

/**
 * Get default dates for a new phase
 */
function getDefaultPhaseDates(existingPhases: Phase[]): { start: string; end: string } {
	if (existingPhases.length === 0) {
		const today = new Date();
		const nextMonth = new Date(today);
		nextMonth.setMonth(nextMonth.getMonth() + 1);
		return {
			start: formatDateForInput(today),
			end: formatDateForInput(nextMonth),
		};
	}

	// Start after the last phase ends
	const lastPhase = existingPhases[existingPhases.length - 1];
	const start = new Date(lastPhase.endDate);
	start.setDate(start.getDate() + 1);
	const end = new Date(start);
	end.setMonth(end.getMonth() + 1);

	return {
		start: formatDateForInput(start),
		end: formatDateForInput(end),
	};
}

/**
 * Individual milestone row
 */
function MilestoneRow({
	milestone,
	phaseStartDate,
	phaseEndDate,
	onUpdate,
	onDelete,
}: {
	milestone: Milestone;
	phaseStartDate: string;
	phaseEndDate: string;
	onUpdate: (updates: Partial<Milestone>) => void;
	onDelete: () => void;
}) {
	const isOutOfRange =
		milestone.date &&
		(milestone.date < phaseStartDate || milestone.date > phaseEndDate);

	return (
		<div className="flex items-center gap-2 pl-6 py-1">
			<Flag className="h-3 w-3 text-orange-500" />
			<Input
				value={milestone.name}
				onChange={(e) => onUpdate({ name: e.target.value })}
				placeholder="Milestone name"
				className="h-7 text-xs flex-1"
			/>
			<Input
				type="date"
				value={milestone.date}
				onChange={(e) => onUpdate({ date: e.target.value })}
				className={cn(
					"h-7 text-xs w-[140px]",
					isOutOfRange && "border-destructive"
				)}
			/>
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6 text-destructive"
				onClick={onDelete}
			>
				<Trash2 className="h-3 w-3" />
			</Button>
		</div>
	);
}

/**
 * Individual phase editor row
 */
function PhaseRow({
	phase,
	onUpdate,
	onDelete,
	onMoveUp,
	onMoveDown,
	onAddMilestone,
	onUpdateMilestone,
	onDeleteMilestone,
	isFirst,
	isLast,
}: {
	phase: Phase;
	onUpdate: (updates: Partial<Phase>) => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onAddMilestone: () => void;
	onUpdateMilestone: (milestoneId: string, updates: Partial<Milestone>) => void;
	onDeleteMilestone: (milestoneId: string) => void;
	isFirst: boolean;
	isLast: boolean;
}) {
	const [isExpanded, setIsExpanded] = useState(true);

	// Calculate duration
	const duration = useMemo(() => {
		if (!phase.startDate || !phase.endDate) return null;
		const start = new Date(phase.startDate);
		const end = new Date(phase.endDate);
		const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
		return days;
	}, [phase.startDate, phase.endDate]);

	// Validate dates
	const hasDateError = phase.startDate && phase.endDate && phase.startDate > phase.endDate;

	return (
		<div className="border rounded-lg overflow-hidden bg-card">
			{/* Phase header */}
			<div className="flex items-center gap-2 p-3 bg-muted/30">
				{/* Move buttons */}
				<div className="flex flex-col gap-0.5">
					<Button
						variant="ghost"
						size="icon"
						className="h-5 w-5"
						onClick={onMoveUp}
						disabled={isFirst}
					>
						<ChevronUp className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-5 w-5"
						onClick={onMoveDown}
						disabled={isLast}
					>
						<ChevronDown className="h-3 w-3" />
					</Button>
				</div>

				{/* Phase fields */}
				<div className="flex-1 grid grid-cols-4 gap-2">
					<Input
						value={phase.name}
						onChange={(e) => onUpdate({ name: e.target.value })}
						placeholder="Phase name *"
						className="text-sm"
					/>
					<div className="flex items-center gap-1">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<Input
							type="date"
							value={phase.startDate}
							onChange={(e) => onUpdate({ startDate: e.target.value })}
							className={cn("text-sm", hasDateError && "border-destructive")}
						/>
					</div>
					<div className="flex items-center gap-1">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<Input
							type="date"
							value={phase.endDate}
							onChange={(e) => onUpdate({ endDate: e.target.value })}
							className={cn("text-sm", hasDateError && "border-destructive")}
						/>
					</div>
					<div className="flex items-center gap-2">
						{duration !== null && (
							<span className="text-xs text-muted-foreground whitespace-nowrap">
								<Clock className="h-3 w-3 inline mr-1" />
								{duration} days
							</span>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsExpanded(!isExpanded)}
							className="ml-auto h-7 px-2"
						>
							<Flag className="h-3 w-3 mr-1" />
							{phase.milestones.length}
						</Button>
					</div>
				</div>

				{/* Delete button */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive"
					onClick={onDelete}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>

			{/* Date error */}
			{hasDateError && (
				<div className="px-3 py-1 bg-destructive/10 text-destructive text-xs flex items-center gap-1">
					<AlertCircle className="h-3 w-3" />
					End date must be after start date
				</div>
			)}

			{/* Milestones */}
			{isExpanded && (
				<div className="border-t p-2 bg-background">
					{phase.milestones.length > 0 ? (
						<div className="space-y-1">
							{phase.milestones.map((milestone) => (
								<MilestoneRow
									key={milestone.id}
									milestone={milestone}
									phaseStartDate={phase.startDate}
									phaseEndDate={phase.endDate}
									onUpdate={(updates) => onUpdateMilestone(milestone.id, updates)}
									onDelete={() => onDeleteMilestone(milestone.id)}
								/>
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground text-center py-2">
							No milestones
						</p>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={onAddMilestone}
						className="w-full h-7 mt-2 text-xs"
					>
						<Plus className="h-3 w-3 mr-1" />
						Add Milestone
					</Button>
				</div>
			)}
		</div>
	);
}

/**
 * ScheduleGenerator - Form for creating Gantt charts from schedule data.
 *
 * @example
 * ```tsx
 * <ScheduleGenerator
 *   initialTitle="Project Implementation Schedule"
 *   onGenerate={(result) => {
 *     console.log("Generated diagram:", result.diagramCode);
 *   }}
 * />
 * ```
 */
export function ScheduleGenerator({
	initialTitle = "Project Schedule",
	initialPhases = [],
	onGenerate,
}: ScheduleGeneratorProps) {
	// State
	const [title, setTitle] = useState(initialTitle);
	const defaultPhaseDates = getDefaultPhaseDates([]);
	const [phases, setPhases] = useState<Phase[]>(
		initialPhases.length > 0
			? initialPhases
			: [
					{
						id: generateId(),
						name: "Phase 1: Planning",
						startDate: defaultPhaseDates.start,
						endDate: defaultPhaseDates.end,
						milestones: [],
					},
			  ]
	);
	const [generatedCode, setGeneratedCode] = useState<string | null>(null);
	const [generatedCaption, setGeneratedCaption] = useState<string>("");
	const [generatedActionCaption, setGeneratedActionCaption] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Validation
	const validation = useMemo(() => {
		const issues: string[] = [];

		if (!title.trim()) {
			issues.push("Schedule title is required");
		}

		if (phases.length === 0) {
			issues.push("At least one phase is required");
		}

		for (const phase of phases) {
			if (!phase.name.trim()) {
				issues.push("All phases must have a name");
				break;
			}
			if (!phase.startDate || !phase.endDate) {
				issues.push("All phases must have start and end dates");
				break;
			}
			if (phase.startDate > phase.endDate) {
				issues.push("End dates must be after start dates");
				break;
			}

			for (const milestone of phase.milestones) {
				if (!milestone.name.trim()) {
					issues.push("All milestones must have a name");
					break;
				}
				if (
					milestone.date &&
					(milestone.date < phase.startDate || milestone.date > phase.endDate)
				) {
					issues.push("Milestone dates must be within their phase dates");
					break;
				}
			}
		}

		return {
			isValid: issues.length === 0,
			issues,
		};
	}, [title, phases]);

	// Phase management
	const addPhase = useCallback(() => {
		const defaults = getDefaultPhaseDates(phases);
		const newPhase: Phase = {
			id: generateId(),
			name: `Phase ${phases.length + 1}`,
			startDate: defaults.start,
			endDate: defaults.end,
			milestones: [],
		};
		setPhases((prev) => [...prev, newPhase]);
	}, [phases]);

	const updatePhase = useCallback((id: string, updates: Partial<Phase>) => {
		setPhases((prev) =>
			prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
		);
	}, []);

	const deletePhase = useCallback((id: string) => {
		setPhases((prev) => prev.filter((p) => p.id !== id));
	}, []);

	const movePhase = useCallback((id: string, direction: "up" | "down") => {
		setPhases((prev) => {
			const index = prev.findIndex((p) => p.id === id);
			if (index === -1) return prev;

			const newIndex = direction === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= prev.length) return prev;

			const newPhases = [...prev];
			[newPhases[index], newPhases[newIndex]] = [newPhases[newIndex], newPhases[index]];
			return newPhases;
		});
	}, []);

	// Milestone management
	const addMilestone = useCallback((phaseId: string) => {
		setPhases((prev) =>
			prev.map((p) => {
				if (p.id !== phaseId) return p;

				// Default milestone date to middle of phase
				const start = new Date(p.startDate);
				const end = new Date(p.endDate);
				const middle = new Date((start.getTime() + end.getTime()) / 2);

				return {
					...p,
					milestones: [
						...p.milestones,
						{
							id: generateId(),
							name: "",
							date: formatDateForInput(middle),
						},
					],
				};
			})
		);
	}, []);

	const updateMilestone = useCallback(
		(phaseId: string, milestoneId: string, updates: Partial<Milestone>) => {
			setPhases((prev) =>
				prev.map((p) => {
					if (p.id !== phaseId) return p;
					return {
						...p,
						milestones: p.milestones.map((m) =>
							m.id === milestoneId ? { ...m, ...updates } : m
						),
					};
				})
			);
		},
		[]
	);

	const deleteMilestone = useCallback((phaseId: string, milestoneId: string) => {
		setPhases((prev) =>
			prev.map((p) => {
				if (p.id !== phaseId) return p;
				return {
					...p,
					milestones: p.milestones.filter((m) => m.id !== milestoneId),
				};
			})
		);
	}, []);

	// Generate schedule
	const handleGenerate = useCallback(() => {
		if (!validation.isValid) return;

		setError(null);

		startTransition(async () => {
			const scheduleData: ScheduleData = {
				title,
				phases: phases.map((p) => ({
					name: p.name,
					startDate: p.startDate,
					endDate: p.endDate,
					milestones: p.milestones
						.filter((m) => m.name.trim() && m.date)
						.map((m) => ({
							name: m.name,
							date: m.date,
						})),
				})),
			};

			const result = await generateSchedule(scheduleData);

			if (result.success) {
				setGeneratedCode(result.data.diagramCode);
				setGeneratedCaption(result.data.suggestedCaption);
				setGeneratedActionCaption(result.data.suggestedActionCaption);
				onGenerate?.(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [title, phases, validation.isValid, onGenerate]);

	// Clear all
	const handleClear = useCallback(() => {
		setTitle("Project Schedule");
		const resetDates = getDefaultPhaseDates([]);
		setPhases([
			{
				id: generateId(),
				name: "Phase 1",
				startDate: resetDates.start,
				endDate: resetDates.end,
				milestones: [],
			},
		]);
		setGeneratedCode(null);
		setGeneratedCaption("");
		setGeneratedActionCaption("");
		setError(null);
	}, []);

	return (
		<div className="flex flex-col lg:flex-row gap-4 h-full">
			{/* Form panel */}
			<Card className="flex-1 flex flex-col">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<CalendarDays className="h-5 w-5 text-primary" />
							<CardTitle>Schedule Generator</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleClear}
								disabled={isPending}
							>
								Clear All
							</Button>
						</div>
					</div>
					<CardDescription>
						Define project phases and milestones to generate a Gantt chart.
					</CardDescription>
				</CardHeader>

				<CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
					{/* Title input */}
					<div className="space-y-2">
						<Label htmlFor="scheduleTitle">Schedule Title</Label>
						<Input
							id="scheduleTitle"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Project Implementation Schedule"
						/>
					</div>

					{/* Phases list */}
					<div className="flex-1 overflow-hidden">
						<div className="flex items-center justify-between mb-2">
							<Label className="text-sm font-medium">
								Phases ({phases.length})
							</Label>
							<Button
								variant="ghost"
								size="sm"
								onClick={addPhase}
								className="h-7"
							>
								<Plus className="h-4 w-4 mr-1" />
								Add Phase
							</Button>
						</div>

						<ScrollArea className="h-[350px] pr-4">
							<div className="space-y-3">
								{phases.map((phase, index) => (
									<PhaseRow
										key={phase.id}
										phase={phase}
										onUpdate={(updates) => updatePhase(phase.id, updates)}
										onDelete={() => deletePhase(phase.id)}
										onMoveUp={() => movePhase(phase.id, "up")}
										onMoveDown={() => movePhase(phase.id, "down")}
										onAddMilestone={() => addMilestone(phase.id)}
										onUpdateMilestone={(milestoneId, updates) =>
											updateMilestone(phase.id, milestoneId, updates)
										}
										onDeleteMilestone={(milestoneId) =>
											deleteMilestone(phase.id, milestoneId)
										}
										isFirst={index === 0}
										isLast={index === phases.length - 1}
									/>
								))}
							</div>
						</ScrollArea>
					</div>

					{/* Validation issues */}
					{validation.issues.length > 0 && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
							<div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
								<AlertCircle className="h-4 w-4" />
								Validation Issues
							</div>
							<ul className="text-xs text-destructive/80 space-y-1 ml-6 list-disc">
								{validation.issues.map((issue, i) => (
									<li key={i}>{issue}</li>
								))}
							</ul>
						</div>
					)}

					{/* Error message */}
					{error && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
							<AlertCircle className="h-4 w-4" />
							{error}
						</div>
					)}
				</CardContent>

				<CardFooter className="border-t pt-4">
					<Button
						onClick={handleGenerate}
						disabled={!validation.isValid || isPending}
						isLoading={isPending}
						className="w-full"
					>
						<Wand2 className="h-4 w-4 mr-2" />
						Generate Schedule
					</Button>
				</CardFooter>
			</Card>

			{/* Preview panel */}
			<Card className="flex-1 flex flex-col">
				<CardHeader>
					<CardTitle className="text-sm">Preview</CardTitle>
				</CardHeader>
				<CardContent className="flex-1 overflow-hidden">
					{generatedCode ? (
						<div className="h-full flex flex-col gap-3">
							<div className="flex-1 border rounded-lg overflow-hidden">
								<GraphicPreview
									code={generatedCode}
									format="mermaid"
									className="h-full"
								/>
							</div>

							{/* Captions */}
							<div className="space-y-2 text-sm">
								<div>
									<Label className="text-xs text-muted-foreground">Caption</Label>
									<p className="text-sm">{generatedCaption}</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Action Caption
									</Label>
									<p className="text-sm italic">{generatedActionCaption}</p>
								</div>
							</div>
						</div>
					) : (
						<div className="h-full flex items-center justify-center text-muted-foreground">
							<div className="text-center">
								<CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
								<p className="text-sm">
									Add phases and click "Generate Schedule" to see preview
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
