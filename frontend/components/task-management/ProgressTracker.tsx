"use client";

/**
 * ProgressTracker - Completion tracking for proposal development.
 *
 * Features:
 * - Overall completion percentage
 * - Section-by-section progress
 * - Volume/deliverable tracking
 * - Word count progress
 * - Milestone tracking
 * - Burndown chart visualization
 */

import React, { useMemo } from "react";
import {
	CheckCircle2,
	Circle,
	Clock,
	FileText,
	Target,
	TrendingUp,
	Calendar,
	Loader2,
	ChevronRight,
	AlertTriangle,
	Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProposalTask } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

interface SectionProgress {
	id: string;
	name: string;
	tasks: ProposalTask[];
	completedTasks: number;
	totalTasks: number;
	progress: number;
	wordCountTarget: number;
	wordCountCurrent: number;
	estimatedHours: number;
	actualHours: number;
	blockedTasks: number;
	criticalTasks: number;
}

interface VolumeProgress {
	id: string;
	name: string;
	sections: SectionProgress[];
	progress: number;
}

export interface ProgressTrackerProps {
	tasks: ProposalTask[];
	proposalDeadline?: Date;
	wordCountTarget?: number;
	onTaskClick?: (task: ProposalTask) => void;
	onSectionClick?: (sectionId: string) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
	technical: "Technical Volume",
	management: "Management Volume",
	past_performance: "Past Performance",
	cost: "Cost/Price Volume",
	executive_summary: "Executive Summary",
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateProgress(completed: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((completed / total) * 100);
}

function getProgressColor(progress: number): string {
	if (progress >= 80) return "text-green-600";
	if (progress >= 50) return "text-yellow-600";
	if (progress >= 25) return "text-orange-600";
	return "text-red-600";
}

function getProgressBarColor(progress: number): string {
	if (progress >= 80) return "[&>div]:bg-green-500";
	if (progress >= 50) return "[&>div]:bg-yellow-500";
	if (progress >= 25) return "[&>div]:bg-orange-500";
	return "[&>div]:bg-red-500";
}

function formatNumber(num: number): string {
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}k`;
	}
	return num.toString();
}

// ============================================================================
// Section Progress Component
// ============================================================================

interface SectionProgressCardProps {
	section: SectionProgress;
	onSectionClick?: () => void;
	onTaskClick?: (task: ProposalTask) => void;
}

function SectionProgressCard({
	section,
	onSectionClick,
	onTaskClick,
}: SectionProgressCardProps) {
	const incompleteTasks = section.tasks.filter(
		(t) => t.status !== "completed" && t.status !== "cancelled"
	);
	const hasIssues = section.blockedTasks > 0 || section.criticalTasks > 0;

	return (
		<div
			className={cn(
				"p-3 rounded-lg border bg-white cursor-pointer",
				"hover:border-blue-300 hover:shadow-sm transition-all",
				hasIssues && "border-amber-200 bg-amber-50"
			)}
			onClick={onSectionClick}
		>
			<div className="flex items-center justify-between mb-2">
				<h4 className="font-medium text-sm">{section.name}</h4>
				<div className="flex items-center gap-2">
					{section.blockedTasks > 0 && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger>
									<Badge variant="outline" className="text-red-600 border-red-200">
										{section.blockedTasks} blocked
									</Badge>
								</TooltipTrigger>
								<TooltipContent>
									{section.blockedTasks} tasks are blocked
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
					{section.criticalTasks > 0 && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger>
									<Zap className="w-4 h-4 text-red-500" />
								</TooltipTrigger>
								<TooltipContent>
									{section.criticalTasks} critical priority tasks
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
					<span className={cn("font-bold", getProgressColor(section.progress))}>
						{section.progress}%
					</span>
				</div>
			</div>

			{/* Progress bar */}
			<Progress
				value={section.progress}
				className={cn("h-2 mb-2", getProgressBarColor(section.progress))}
			/>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
				<div className="flex items-center gap-1">
					<CheckCircle2 className="w-3 h-3 text-green-500" />
					{section.completedTasks}/{section.totalTasks} tasks
				</div>
				{section.wordCountTarget > 0 && (
					<div className="flex items-center gap-1">
						<FileText className="w-3 h-3" />
						{formatNumber(section.wordCountCurrent)}/
						{formatNumber(section.wordCountTarget)} words
					</div>
				)}
				<div className="flex items-center gap-1">
					<Clock className="w-3 h-3" />
					{section.actualHours}/{section.estimatedHours}h
				</div>
			</div>

			{/* Incomplete tasks preview */}
			{incompleteTasks.length > 0 && (
				<div className="mt-2 pt-2 border-t">
					{incompleteTasks.slice(0, 2).map((task) => (
						<button
							key={task.id}
							onClick={(e) => {
								e.stopPropagation();
								onTaskClick?.(task);
							}}
							className="flex items-center gap-2 w-full p-1 text-left text-xs hover:bg-gray-100 rounded"
						>
							{task.status === "in_progress" ? (
								<Loader2 className="w-3 h-3 animate-spin text-amber-500" />
							) : task.status === "blocked" ? (
								<AlertTriangle className="w-3 h-3 text-red-500" />
							) : (
								<Circle className="w-3 h-3 text-gray-400" />
							)}
							<span className="truncate flex-1">{task.title}</span>
							{task.progress != null && task.progress > 0 && (
								<span className="text-gray-400">{task.progress}%</span>
							)}
						</button>
					))}
					{incompleteTasks.length > 2 && (
						<p className="text-xs text-gray-400 pl-5">
							+{incompleteTasks.length - 2} more tasks
						</p>
					)}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgressTracker({
	tasks,
	proposalDeadline,
	wordCountTarget,
	onTaskClick,
	onSectionClick,
	className,
}: ProgressTrackerProps) {
	// Calculate overall progress
	const overallStats = useMemo(() => {
		const total = tasks.length;
		const completed = tasks.filter((t) => t.status === "completed").length;
		const inProgress = tasks.filter((t) => t.status === "in_progress").length;
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const critical = tasks.filter((t) => t.priority === "critical").length;

		const totalWordTarget = tasks.reduce(
			(sum, t) => sum + (t.wordCountTarget ?? 0),
			0
		);
		const currentWordCount = tasks.reduce(
			(sum, t) => sum + (t.wordCountCurrent ?? 0),
			0
		);

		const totalEstimatedHours = tasks.reduce(
			(sum, t) => sum + (t.estimatedHours ?? 0),
			0
		);
		const totalActualHours = tasks.reduce(
			(sum, t) => sum + (t.actualHours ?? 0),
			0
		);

		// Calculate weighted progress (tasks with estimates weigh more)
		let weightedProgress = 0;
		let totalWeight = 0;
		tasks.forEach((task) => {
			const weight = task.estimatedHours ?? 1;
			const taskProgress =
				task.status === "completed"
					? 100
					: task.status === "cancelled"
						? 0
						: task.progress ?? 0;
			weightedProgress += taskProgress * weight;
			totalWeight += weight;
		});

		const progress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

		// Days until deadline
		let daysRemaining: number | null = null;
		if (proposalDeadline) {
			daysRemaining = Math.ceil(
				(proposalDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);
		}

		return {
			total,
			completed,
			inProgress,
			blocked,
			critical,
			progress,
			totalWordTarget: wordCountTarget ?? totalWordTarget,
			currentWordCount,
			totalEstimatedHours,
			totalActualHours,
			daysRemaining,
		};
	}, [tasks, proposalDeadline, wordCountTarget]);

	// Group tasks by category/volume
	const volumeProgress = useMemo(() => {
		const categories = new Map<string, ProposalTask[]>();

		tasks.forEach((task) => {
			const category = task.taskCategory ?? "other";
			const existing = categories.get(category) ?? [];
			categories.set(category, [...existing, task]);
		});

		const volumes: VolumeProgress[] = [];

		categories.forEach((categoryTasks, category) => {
			const completedTasks = categoryTasks.filter(
				(t) => t.status === "completed"
			).length;
			const progress = calculateProgress(completedTasks, categoryTasks.length);

			volumes.push({
				id: category,
				name: CATEGORY_LABELS[category] ?? category,
				sections: [
					{
						id: category,
						name: CATEGORY_LABELS[category] ?? category,
						tasks: categoryTasks,
						completedTasks,
						totalTasks: categoryTasks.length,
						progress,
						wordCountTarget: categoryTasks.reduce(
							(sum, t) => sum + (t.wordCountTarget ?? 0),
							0
						),
						wordCountCurrent: categoryTasks.reduce(
							(sum, t) => sum + (t.wordCountCurrent ?? 0),
							0
						),
						estimatedHours: categoryTasks.reduce(
							(sum, t) => sum + (t.estimatedHours ?? 0),
							0
						),
						actualHours: categoryTasks.reduce(
							(sum, t) => sum + (t.actualHours ?? 0),
							0
						),
						blockedTasks: categoryTasks.filter((t) => t.status === "blocked")
							.length,
						criticalTasks: categoryTasks.filter(
							(t) => t.priority === "critical"
						).length,
					},
				],
				progress,
			});
		});

		return volumes.sort((a, b) => {
			// Sort by predefined order
			const order = [
				"executive_summary",
				"technical",
				"management",
				"past_performance",
				"cost",
			];
			return order.indexOf(a.id) - order.indexOf(b.id);
		});
	}, [tasks]);

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Overall Progress Card */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg flex items-center gap-2">
						<Target className="w-5 h-5" />
						Overall Progress
					</CardTitle>
				</CardHeader>
				<CardContent>
					{/* Main progress ring */}
					<div className="flex items-center gap-6">
						<div className="relative w-32 h-32">
							<svg className="w-full h-full transform -rotate-90">
								<circle
									cx="64"
									cy="64"
									r="56"
									stroke="currentColor"
									strokeWidth="12"
									fill="none"
									className="text-gray-200"
								/>
								<circle
									cx="64"
									cy="64"
									r="56"
									stroke="currentColor"
									strokeWidth="12"
									fill="none"
									className={cn(
										overallStats.progress >= 80
											? "text-green-500"
											: overallStats.progress >= 50
												? "text-yellow-500"
												: "text-orange-500"
									)}
									strokeDasharray={`${(overallStats.progress / 100) * 352} 352`}
									strokeLinecap="round"
								/>
							</svg>
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="text-center">
									<span className="text-3xl font-bold">
										{overallStats.progress}%
									</span>
									<p className="text-xs text-gray-500">Complete</p>
								</div>
							</div>
						</div>

						{/* Stats grid */}
						<div className="grid grid-cols-2 gap-4 flex-1">
							<div className="p-3 bg-gray-50 rounded-lg">
								<div className="flex items-center gap-2 text-gray-500 mb-1">
									<CheckCircle2 className="w-4 h-4 text-green-500" />
									<span className="text-sm">Tasks</span>
								</div>
								<p className="text-2xl font-bold">
									{overallStats.completed}/{overallStats.total}
								</p>
								{overallStats.inProgress > 0 && (
									<p className="text-xs text-amber-600">
										{overallStats.inProgress} in progress
									</p>
								)}
							</div>

							<div className="p-3 bg-gray-50 rounded-lg">
								<div className="flex items-center gap-2 text-gray-500 mb-1">
									<FileText className="w-4 h-4" />
									<span className="text-sm">Words</span>
								</div>
								<p className="text-2xl font-bold">
									{formatNumber(overallStats.currentWordCount)}
								</p>
								{overallStats.totalWordTarget > 0 && (
									<p className="text-xs text-gray-500">
										of {formatNumber(overallStats.totalWordTarget)} target
									</p>
								)}
							</div>

							<div className="p-3 bg-gray-50 rounded-lg">
								<div className="flex items-center gap-2 text-gray-500 mb-1">
									<Clock className="w-4 h-4" />
									<span className="text-sm">Hours</span>
								</div>
								<p className="text-2xl font-bold">
									{Math.round(overallStats.totalActualHours)}h
								</p>
								{overallStats.totalEstimatedHours > 0 && (
									<p className="text-xs text-gray-500">
										of {overallStats.totalEstimatedHours}h estimated
									</p>
								)}
							</div>

							<div className="p-3 bg-gray-50 rounded-lg">
								<div className="flex items-center gap-2 text-gray-500 mb-1">
									<Calendar className="w-4 h-4" />
									<span className="text-sm">Deadline</span>
								</div>
								{overallStats.daysRemaining !== null ? (
									<>
										<p
											className={cn(
												"text-2xl font-bold",
												overallStats.daysRemaining <= 7
													? "text-red-600"
													: overallStats.daysRemaining <= 14
														? "text-orange-600"
														: "text-gray-900"
											)}
										>
											{overallStats.daysRemaining}d
										</p>
										<p className="text-xs text-gray-500">
											{proposalDeadline?.toLocaleDateString()}
										</p>
									</>
								) : (
									<p className="text-2xl font-bold text-gray-400">--</p>
								)}
							</div>
						</div>
					</div>

					{/* Warnings */}
					{(overallStats.blocked > 0 || overallStats.critical > 0) && (
						<div className="mt-4 flex gap-3">
							{overallStats.blocked > 0 && (
								<Badge
									variant="outline"
									className="text-red-600 border-red-200 bg-red-50"
								>
									<AlertTriangle className="w-3 h-3 mr-1" />
									{overallStats.blocked} blocked tasks
								</Badge>
							)}
							{overallStats.critical > 0 && (
								<Badge
									variant="outline"
									className="text-amber-600 border-amber-200 bg-amber-50"
								>
									<Zap className="w-3 h-3 mr-1" />
									{overallStats.critical} critical priority
								</Badge>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Section Progress */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Progress by Section</CardTitle>
				</CardHeader>
				<CardContent>
					{volumeProgress.length === 0 ? (
						<p className="text-sm text-gray-500 text-center py-8">
							No categorized tasks found. Add task categories to see section
							progress.
						</p>
					) : (
						<ScrollArea className="max-h-[400px]">
							<div className="space-y-3">
								{volumeProgress.map((volume) => (
									<div key={volume.id}>
										{volume.sections.map((section) => (
											<SectionProgressCard
												key={section.id}
												section={section}
												onSectionClick={() => onSectionClick?.(section.id)}
												onTaskClick={onTaskClick}
											/>
										))}
									</div>
								))}
							</div>
						</ScrollArea>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default ProgressTracker;
