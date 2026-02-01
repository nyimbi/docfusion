"use client";

/**
 * AssignmentSuggester - AI-powered task assignment suggestions.
 *
 * Features:
 * - Skill-based matching with expertise profiles
 * - Workload-aware recommendations
 * - Historical performance data
 * - Availability checking
 * - Multi-task bulk assignment
 */

import React, { useState, useMemo, useCallback } from "react";
import {
	User,
	Users,
	Zap,
	CheckCircle2,
	AlertTriangle,
	Clock,
	Star,
	TrendingUp,
	Calendar,
	Briefcase,
	ChevronRight,
	Loader2,
	RefreshCw,
	Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ProposalTask, AuthorExpertise } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

export interface AssignmentSuggestion {
	userId: string;
	userName: string;
	userEmail?: string;
	matchScore: number; // 0-100
	reasons: string[];
	warnings: string[];
	metrics: {
		expertiseMatch: number;
		availableCapacity: number;
		onTimeRate: number;
		qualityScore: number;
		currentWorkload: number;
	};
}

export interface AssignmentSuggesterProps {
	task: ProposalTask | null;
	suggestions: AssignmentSuggestion[];
	teamMembers: AuthorExpertise[];
	loading?: boolean;
	onAssign: (taskId: string, userId: string, userName: string) => Promise<void>;
	onRefreshSuggestions?: (taskId: string) => Promise<void>;
	isOpen: boolean;
	onClose: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getMatchColor(score: number): string {
	if (score >= 80) return "text-green-600";
	if (score >= 60) return "text-yellow-600";
	if (score >= 40) return "text-orange-600";
	return "text-red-600";
}

function getMatchBgColor(score: number): string {
	if (score >= 80) return "bg-green-50 border-green-200";
	if (score >= 60) return "bg-yellow-50 border-yellow-200";
	if (score >= 40) return "bg-orange-50 border-orange-200";
	return "bg-red-50 border-red-200";
}

function getWorkloadStatus(
	utilization: number
): { label: string; color: string } {
	if (utilization >= 100) return { label: "Overloaded", color: "text-red-600" };
	if (utilization >= 80) return { label: "Heavy", color: "text-orange-600" };
	if (utilization >= 50) return { label: "Moderate", color: "text-yellow-600" };
	return { label: "Light", color: "text-green-600" };
}

// ============================================================================
// Suggestion Card Component
// ============================================================================

interface SuggestionCardProps {
	suggestion: AssignmentSuggestion;
	isSelected: boolean;
	onSelect: () => void;
	onAssign: () => void;
	assigning: boolean;
}

function SuggestionCard({
	suggestion,
	isSelected,
	onSelect,
	onAssign,
	assigning,
}: SuggestionCardProps) {
	const workloadStatus = getWorkloadStatus(suggestion.metrics.currentWorkload);

	return (
		<Card
			className={cn(
				"border-2 transition-all cursor-pointer",
				isSelected
					? "border-blue-500 bg-blue-50"
					: getMatchBgColor(suggestion.matchScore)
			)}
			onClick={onSelect}
		>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{/* Avatar and basic info */}
					<Avatar className="w-12 h-12">
						<AvatarFallback className="text-lg">
							{getInitials(suggestion.userName)}
						</AvatarFallback>
					</Avatar>

					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between mb-1">
							<h4 className="font-medium">{suggestion.userName}</h4>
							<div className="flex items-center gap-1">
								<Zap
									className={cn(
										"w-4 h-4",
										getMatchColor(suggestion.matchScore)
									)}
								/>
								<span
									className={cn(
										"font-bold",
										getMatchColor(suggestion.matchScore)
									)}
								>
									{suggestion.matchScore}%
								</span>
							</div>
						</div>

						{suggestion.userEmail && (
							<p className="text-xs text-gray-500 mb-2">
								{suggestion.userEmail}
							</p>
						)}

						{/* Match reasons */}
						<div className="space-y-1 mb-3">
							{suggestion.reasons.slice(0, 3).map((reason, i) => (
								<div key={i} className="flex items-center gap-1.5 text-xs">
									<CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
									<span className="text-gray-600">{reason}</span>
								</div>
							))}
							{suggestion.warnings.map((warning, i) => (
								<div key={i} className="flex items-center gap-1.5 text-xs">
									<AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
									<span className="text-amber-700">{warning}</span>
								</div>
							))}
						</div>

						{/* Metrics */}
						<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1.5">
											<Briefcase className="w-3.5 h-3.5 text-gray-400" />
											<span className="text-gray-600">Expertise:</span>
											<span className="font-medium">
												{suggestion.metrics.expertiseMatch}%
											</span>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										Match based on required skills
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>

							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1.5">
											<Star className="w-3.5 h-3.5 text-gray-400" />
											<span className="text-gray-600">Quality:</span>
											<span className="font-medium">
												{suggestion.metrics.qualityScore}%
											</span>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										Average quality score from past tasks
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>

							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1.5">
											<Clock className="w-3.5 h-3.5 text-gray-400" />
											<span className="text-gray-600">On-time:</span>
											<span className="font-medium">
												{suggestion.metrics.onTimeRate}%
											</span>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										Percentage of tasks delivered on time
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>

							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1.5">
											<TrendingUp className="w-3.5 h-3.5 text-gray-400" />
											<span className="text-gray-600">Load:</span>
											<span className={cn("font-medium", workloadStatus.color)}>
												{workloadStatus.label}
											</span>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										Current workload: {suggestion.metrics.currentWorkload}%
										capacity
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>

						{/* Capacity bar */}
						<div className="mt-3">
							<div className="flex justify-between text-xs text-gray-500 mb-1">
								<span>Available Capacity</span>
								<span>{suggestion.metrics.availableCapacity}h/week</span>
							</div>
							<Progress
								value={100 - suggestion.metrics.currentWorkload}
								className="h-1.5"
							/>
						</div>
					</div>
				</div>

				{/* Assign button */}
				<div className="mt-4 pt-3 border-t">
					<Button
						onClick={(e) => {
							e.stopPropagation();
							onAssign();
						}}
						disabled={assigning}
						className="w-full"
					>
						{assigning ? (
							<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
						) : (
							<User className="w-4 h-4 mr-1.5" />
						)}
						Assign to {suggestion.userName.split(" ")[0]}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function AssignmentSuggester({
	task,
	suggestions,
	teamMembers,
	loading = false,
	onAssign,
	onRefreshSuggestions,
	isOpen,
	onClose,
}: AssignmentSuggesterProps) {
	const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
		null
	);
	const [assigning, setAssigning] = useState(false);
	const [showAllTeam, setShowAllTeam] = useState(false);

	// Sort suggestions by match score
	const sortedSuggestions = useMemo(() => {
		return [...suggestions].sort((a, b) => b.matchScore - a.matchScore);
	}, [suggestions]);

	// Team members not in suggestions
	const otherTeamMembers = useMemo(() => {
		const suggestionIds = new Set(suggestions.map((s) => s.userId));
		return teamMembers.filter((m) => !suggestionIds.has(m.userId));
	}, [suggestions, teamMembers]);

	const handleAssign = useCallback(
		async (userId: string, userName: string) => {
			if (!task) return;

			setAssigning(true);
			try {
				await onAssign(task.id, userId, userName);
				onClose();
			} catch (error) {
				console.error("Failed to assign task:", error);
			} finally {
				setAssigning(false);
			}
		},
		[task, onAssign, onClose]
	);

	const handleRefresh = useCallback(() => {
		if (task && onRefreshSuggestions) {
			onRefreshSuggestions(task.id);
		}
	}, [task, onRefreshSuggestions]);

	if (!task) return null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Zap className="w-5 h-5 text-yellow-500" />
						Smart Assignment
					</DialogTitle>
					<DialogDescription>
						AI-suggested assignments for "{task.title}"
					</DialogDescription>
				</DialogHeader>

				{/* Task summary */}
				<div className="flex flex-wrap gap-2 py-2 px-1">
					<Badge variant="outline">{task.taskType}</Badge>
					<Badge variant="outline">{task.priority} priority</Badge>
					{task.estimatedHours && (
						<Badge variant="outline">{task.estimatedHours}h estimated</Badge>
					)}
					{task.dueDate && (
						<Badge variant="outline">
							Due {new Date(task.dueDate).toLocaleDateString()}
						</Badge>
					)}
				</div>

				<ScrollArea className="flex-1">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
						</div>
					) : sortedSuggestions.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-gray-500">
							<Users className="w-12 h-12 mb-4 text-gray-300" />
							<p className="text-lg font-medium mb-2">No suggestions available</p>
							<p className="text-sm text-center max-w-md">
								There are no team members with matching expertise for this task,
								or everyone is at capacity.
							</p>
							{onRefreshSuggestions && (
								<Button
									variant="outline"
									onClick={handleRefresh}
									className="mt-4"
								>
									<RefreshCw className="w-4 h-4 mr-1.5" />
									Refresh Suggestions
								</Button>
							)}
						</div>
					) : (
						<div className="space-y-4 px-1">
							{/* Best match highlight */}
							{sortedSuggestions.length > 0 && (
								<div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
									<Star className="w-4 h-4" />
									<span>
										<strong>{sortedSuggestions[0].userName}</strong> is the best
										match with a {sortedSuggestions[0].matchScore}% score
									</span>
								</div>
							)}

							{/* Suggestions */}
							<div className="space-y-3">
								{sortedSuggestions.map((suggestion) => (
									<SuggestionCard
										key={suggestion.userId}
										suggestion={suggestion}
										isSelected={selectedSuggestion === suggestion.userId}
										onSelect={() =>
											setSelectedSuggestion(
												selectedSuggestion === suggestion.userId
													? null
													: suggestion.userId
											)
										}
										onAssign={() =>
											handleAssign(suggestion.userId, suggestion.userName)
										}
										assigning={assigning}
									/>
								))}
							</div>

							{/* Other team members */}
							{otherTeamMembers.length > 0 && (
								<div className="mt-6">
									<button
										onClick={() => setShowAllTeam(!showAllTeam)}
										className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
									>
										<ChevronRight
											className={cn(
												"w-4 h-4 transition-transform",
												showAllTeam && "rotate-90"
											)}
										/>
										{showAllTeam ? "Hide" : "Show"} other team members (
										{otherTeamMembers.length})
									</button>

									{showAllTeam && (
										<div className="mt-3 grid grid-cols-2 gap-2">
											{otherTeamMembers.map((member) => (
												<button
													key={member.userId}
													onClick={() =>
														handleAssign(member.userId, member.userName)
													}
													disabled={assigning}
													className="flex items-center gap-2 p-2 text-left rounded border hover:bg-gray-50 transition-colors"
												>
													<Avatar className="w-8 h-8">
														<AvatarFallback className="text-xs">
															{getInitials(member.userName)}
														</AvatarFallback>
													</Avatar>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium truncate">
															{member.userName}
														</p>
														<p className="text-xs text-gray-500">
															{member.availability === "unavailable"
																? "Unavailable"
																: `${member.availableHoursPerWeek ?? 40}h/week`}
														</p>
													</div>
												</button>
											))}
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</ScrollArea>

				<DialogFooter className="flex-row justify-between pt-4 border-t">
					<div className="flex items-center gap-1 text-xs text-gray-400">
						<Info className="w-3.5 h-3.5" />
						Suggestions based on expertise, workload, and history
					</div>
					<div className="flex gap-2">
						{onRefreshSuggestions && (
							<Button variant="outline" onClick={handleRefresh} disabled={loading}>
								<RefreshCw
									className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")}
								/>
								Refresh
							</Button>
						)}
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default AssignmentSuggester;
