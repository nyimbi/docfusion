/**
 * ActivityTimeline Component - DocFusion Capture Pipeline
 *
 * Timeline of capture activities with icons, filtering, and the
 * ability to record new activities. Supports various activity types
 * including meetings, calls, emails, and milestones.
 *
 * Accessibility: Proper list semantics, time elements, descriptive labels.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition, useMemo } from "react";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Calendar,
	Phone,
	Mail,
	Users,
	MessageSquare,
	FileText,
	MapPin,
	Building2,
	Briefcase,
	Handshake,
	Lightbulb,
	Plus,
	Filter,
	Clock,
	CheckCircle,
	XCircle,
	ChevronRight,
	Star,
	MoreVertical,
	Edit,
	Trash2,
	Loader2,
} from "lucide-react";
import { recordActivity, completeActivity } from "@/lib/actions/pipeline";
import type { CaptureActivity, ActivityType, ActivityStatus, CreateActivityInput } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface ActivityTimelineProps {
	/** List of activities */
	activities: CaptureActivity[];
	/** Pipeline ID for creating new activities */
	pipelineId: string;
	/** Callback when an activity is added */
	onActivityAdded?: (activity: CaptureActivity) => void;
	/** Callback when an activity is updated */
	onActivityUpdated?: (activity: CaptureActivity) => void;
	/** Callback when an activity is clicked */
	onActivityClick?: (activity: CaptureActivity) => void;
	/** Show add button */
	showAddButton?: boolean;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Activity Type Configuration
// ============================================================================

const ACTIVITY_TYPES: {
	value: ActivityType;
	label: string;
	icon: React.ReactNode;
	color: string;
}[] = [
	{
		value: "customer_meeting",
		label: "Customer Meeting",
		icon: <Users className="h-4 w-4" />,
		color: "bg-blue-500",
	},
	{
		value: "site_visit",
		label: "Site Visit",
		icon: <MapPin className="h-4 w-4" />,
		color: "bg-purple-500",
	},
	{
		value: "call",
		label: "Phone Call",
		icon: <Phone className="h-4 w-4" />,
		color: "bg-green-500",
	},
	{
		value: "email",
		label: "Email",
		icon: <Mail className="h-4 w-4" />,
		color: "bg-cyan-500",
	},
	{
		value: "rfi_response",
		label: "RFI Response",
		icon: <FileText className="h-4 w-4" />,
		color: "bg-orange-500",
	},
	{
		value: "draft_review",
		label: "Draft Review",
		icon: <FileText className="h-4 w-4" />,
		color: "bg-amber-500",
	},
	{
		value: "internal_meeting",
		label: "Internal Meeting",
		icon: <Building2 className="h-4 w-4" />,
		color: "bg-slate-500",
	},
	{
		value: "industry_day",
		label: "Industry Day",
		icon: <Briefcase className="h-4 w-4" />,
		color: "bg-indigo-500",
	},
	{
		value: "teaming_discussion",
		label: "Teaming Discussion",
		icon: <Handshake className="h-4 w-4" />,
		color: "bg-pink-500",
	},
	{
		value: "solution_session",
		label: "Solution Session",
		icon: <Lightbulb className="h-4 w-4" />,
		color: "bg-yellow-500",
	},
];

const STATUS_CONFIG: Record<ActivityStatus, { label: string; icon: React.ReactNode; color: string }> = {
	scheduled: {
		label: "Scheduled",
		icon: <Clock className="h-3.5 w-3.5" />,
		color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
	},
	completed: {
		label: "Completed",
		icon: <CheckCircle className="h-3.5 w-3.5" />,
		color: "text-green-600 bg-green-100 dark:bg-green-900/30",
	},
	cancelled: {
		label: "Cancelled",
		icon: <XCircle className="h-3.5 w-3.5" />,
		color: "text-red-600 bg-red-100 dark:bg-red-900/30",
	},
	rescheduled: {
		label: "Rescheduled",
		icon: <Calendar className="h-3.5 w-3.5" />,
		color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
	},
};

// ============================================================================
// Helper Functions
// ============================================================================

function getActivityConfig(type: string) {
	return ACTIVITY_TYPES.find((t) => t.value === type) || {
		value: type,
		label: type.replace(/_/g, " "),
		icon: <MessageSquare className="h-4 w-4" />,
		color: "bg-gray-500",
	};
}

function groupActivitiesByDate(activities: CaptureActivity[]): Map<string, CaptureActivity[]> {
	const groups = new Map<string, CaptureActivity[]>();

	activities.forEach((activity) => {
		const date = activity.scheduledDate || activity.completedDate || activity.createdAt;
		if (!date) return;

		const dateKey = formatDate(date);
		const existing = groups.get(dateKey) || [];
		groups.set(dateKey, [...existing, activity]);
	});

	return groups;
}

// ============================================================================
// Activity Item Component
// ============================================================================

interface ActivityItemProps {
	activity: CaptureActivity;
	onComplete?: (activity: CaptureActivity) => void;
	onClick?: () => void;
	isPending?: boolean;
}

function ActivityItem({ activity, onComplete, onClick, isPending }: ActivityItemProps) {
	const config = getActivityConfig(activity.activityType);
	const statusConfig = STATUS_CONFIG[activity.status as ActivityStatus] || STATUS_CONFIG.scheduled;
	const isScheduled = activity.status === "scheduled";
	const date = activity.scheduledDate || activity.completedDate || activity.createdAt;

	return (
		<div
			className={cn(
				"relative flex gap-4 pb-4",
				onClick && "cursor-pointer"
			)}
			onClick={onClick}
		>
			{/* Timeline dot and line */}
			<div className="flex flex-col items-center">
				<div
					className={cn(
						"flex items-center justify-center w-8 h-8 rounded-full text-white",
						config.color
					)}
				>
					{config.icon}
				</div>
				<div className="flex-1 w-px bg-border mt-2" />
			</div>

			{/* Content */}
			<div className="flex-1 pb-4">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-1">
							<h4 className="font-medium text-sm">{activity.title}</h4>
							<Badge className={cn("text-xs", statusConfig.color)}>
								{statusConfig.icon}
								<span className="ml-1">{statusConfig.label}</span>
							</Badge>
						</div>
						<div className="text-xs text-muted-foreground flex items-center gap-2">
							<span>{config.label}</span>
							{date && (
								<>
									<span>-</span>
									<time dateTime={date.toISOString()}>
										{formatRelativeTime(date)}
									</time>
								</>
							)}
						</div>
					</div>

					{/* Actions */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{isScheduled && onComplete && (
								<DropdownMenuItem onClick={() => onComplete(activity)}>
									<CheckCircle className="h-4 w-4 mr-2" />
									Mark Complete
								</DropdownMenuItem>
							)}
							<DropdownMenuItem>
								<Edit className="h-4 w-4 mr-2" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem className="text-destructive">
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Description */}
				{activity.description && (
					<p className="text-sm text-muted-foreground mt-2 line-clamp-2">
						{activity.description}
					</p>
				)}

				{/* Outcome (if completed) */}
				{activity.outcome && (
					<div className="mt-2 p-2 bg-muted/50 rounded-lg">
						<p className="text-sm">
							<span className="font-medium">Outcome:</span> {activity.outcome}
						</p>
						{activity.successRating && (
							<div className="flex items-center gap-1 mt-1">
								{Array.from({ length: 5 }).map((_, i) => (
									<Star
										key={i}
										className={cn(
											"h-3 w-3",
											i < (activity.successRating ?? 0)
												? "text-yellow-500 fill-yellow-500"
												: "text-muted-foreground"
										)}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* Participants */}
				{activity.participants && activity.participants.length > 0 && (
					<div className="flex items-center gap-2 mt-2">
						<Users className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="text-xs text-muted-foreground">
							{activity.participants.map((p) => p.name).join(", ")}
						</span>
					</div>
				)}

				{/* Next Steps */}
				{activity.nextSteps && activity.nextSteps.length > 0 && (
					<div className="mt-2 space-y-1">
						<span className="text-xs font-medium">Next Steps:</span>
						<ul className="text-xs text-muted-foreground list-disc list-inside">
							{activity.nextSteps.slice(0, 3).map((step, idx) => (
								<li key={idx}>{step}</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ActivityTimeline({
	activities,
	pipelineId,
	onActivityAdded,
	onActivityUpdated,
	onActivityClick,
	showAddButton = true,
	className,
}: ActivityTimelineProps) {
	const [isPending, startTransition] = useTransition();
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
	const [selectedActivity, setSelectedActivity] = useState<CaptureActivity | null>(null);
	const [filterType, setFilterType] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("all");

	// New activity form state
	const [newActivity, setNewActivity] = useState<Partial<CreateActivityInput>>({
		activityType: "customer_meeting",
		title: "",
		description: "",
		scheduledDate: undefined,
	});

	// Complete activity form state
	const [completeForm, setCompleteForm] = useState({
		outcome: "",
		successRating: 3,
		nextSteps: "",
	});

	// Filter activities
	const filteredActivities = useMemo(() => {
		return activities.filter((activity) => {
			if (filterType !== "all" && activity.activityType !== filterType) {
				return false;
			}
			if (filterStatus !== "all" && activity.status !== filterStatus) {
				return false;
			}
			return true;
		});
	}, [activities, filterType, filterStatus]);

	// Sort by date (most recent first)
	const sortedActivities = useMemo(() => {
		return [...filteredActivities].sort((a, b) => {
			const dateA = a.scheduledDate || a.completedDate || a.createdAt;
			const dateB = b.scheduledDate || b.completedDate || b.createdAt;
			if (!dateA || !dateB) return 0;
			return new Date(dateB).getTime() - new Date(dateA).getTime();
		});
	}, [filteredActivities]);

	// Handle add activity
	const handleAddActivity = useCallback(async () => {
		if (!newActivity.title || !newActivity.activityType) return;

		startTransition(async () => {
			const result = await recordActivity(pipelineId, {
				activityType: newActivity.activityType as ActivityType,
				title: newActivity.title!,
				description: newActivity.description,
				scheduledDate: newActivity.scheduledDate,
			});

			if (result.success) {
				onActivityAdded?.(result.data);
				setAddDialogOpen(false);
				setNewActivity({
					activityType: "customer_meeting",
					title: "",
					description: "",
					scheduledDate: undefined,
				});
			}
		});
	}, [pipelineId, newActivity, onActivityAdded]);

	// Handle complete activity
	const handleCompleteActivity = useCallback(async () => {
		if (!selectedActivity || !completeForm.outcome) return;

		startTransition(async () => {
			const nextSteps = completeForm.nextSteps
				? completeForm.nextSteps.split("\n").filter(Boolean)
				: undefined;

			const result = await completeActivity(
				selectedActivity.id,
				completeForm.outcome,
				completeForm.successRating,
				nextSteps
			);

			if (result.success) {
				onActivityUpdated?.(result.data);
				setCompleteDialogOpen(false);
				setSelectedActivity(null);
				setCompleteForm({ outcome: "", successRating: 3, nextSteps: "" });
			}
		});
	}, [selectedActivity, completeForm, onActivityUpdated]);

	// Open complete dialog
	const openCompleteDialog = useCallback((activity: CaptureActivity) => {
		setSelectedActivity(activity);
		setCompleteDialogOpen(true);
	}, []);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Activity Timeline
					</h3>
					<p className="text-sm text-muted-foreground">
						{activities.length} activities recorded
					</p>
				</div>
				<div className="flex items-center gap-2">
					{/* Filters */}
					<Select value={filterType} onValueChange={setFilterType}>
						<SelectTrigger className="w-[140px]">
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="All Types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{ACTIVITY_TYPES.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={filterStatus} onValueChange={setFilterStatus}>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="scheduled">Scheduled</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>

					{/* Add Button */}
					{showAddButton && (
						<Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="primary" size="sm">
									<Plus className="h-4 w-4 mr-2" />
									Add Activity
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Record Activity</DialogTitle>
									<DialogDescription>
										Add a new capture activity to the timeline
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<Label htmlFor="activityType">Activity Type</Label>
										<Select
											value={newActivity.activityType}
											onValueChange={(value) =>
												setNewActivity({ ...newActivity, activityType: value as ActivityType })
											}
										>
											<SelectTrigger id="activityType">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{ACTIVITY_TYPES.map((type) => (
													<SelectItem key={type.value} value={type.value}>
														<div className="flex items-center gap-2">
															{type.icon}
															{type.label}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="title">Title</Label>
										<Input
											id="title"
											value={newActivity.title || ""}
											onChange={(e) =>
												setNewActivity({ ...newActivity, title: e.target.value })
											}
											placeholder="e.g., Initial customer meeting"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="description">Description</Label>
										<Textarea
											id="description"
											value={newActivity.description || ""}
											onChange={(e) =>
												setNewActivity({ ...newActivity, description: e.target.value })
											}
											placeholder="Brief description of the activity..."
											rows={3}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="scheduledDate">Scheduled Date (optional)</Label>
										<Input
											id="scheduledDate"
											type="datetime-local"
											onChange={(e) =>
												setNewActivity({
													...newActivity,
													scheduledDate: e.target.value ? new Date(e.target.value) : undefined,
												})
											}
										/>
									</div>
								</div>
								<DialogFooter>
									<Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
										Cancel
									</Button>
									<Button
										variant="primary"
										onClick={handleAddActivity}
										disabled={!newActivity.title || isPending}
										isLoading={isPending}
									>
										Add Activity
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					)}
				</div>
			</div>

			{/* Timeline */}
			{sortedActivities.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h4 className="font-semibold mb-2">No Activities</h4>
						<p className="text-sm text-muted-foreground mb-4">
							Record capture activities to track progress and engagement
						</p>
						{showAddButton && (
							<Button variant="outline" onClick={() => setAddDialogOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Record First Activity
							</Button>
						)}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="pt-6">
						<div role="list" aria-label="Activity timeline">
							{sortedActivities.map((activity) => (
								<ActivityItem
									key={activity.id}
									activity={activity}
									onComplete={openCompleteDialog}
									onClick={onActivityClick ? () => onActivityClick(activity) : undefined}
									isPending={isPending}
								/>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Complete Activity Dialog */}
			<Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Complete Activity</DialogTitle>
						<DialogDescription>
							Record the outcome of: {selectedActivity?.title}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="outcome">Outcome</Label>
							<Textarea
								id="outcome"
								value={completeForm.outcome}
								onChange={(e) =>
									setCompleteForm({ ...completeForm, outcome: e.target.value })
								}
								placeholder="Describe what happened and key takeaways..."
								rows={3}
							/>
						</div>
						<div className="space-y-2">
							<Label>Success Rating</Label>
							<div className="flex items-center gap-1">
								{Array.from({ length: 5 }).map((_, i) => (
									<button
										key={i}
										type="button"
										onClick={() =>
											setCompleteForm({ ...completeForm, successRating: i + 1 })
										}
										className="p-1 hover:scale-110 transition-transform"
									>
										<Star
											className={cn(
												"h-6 w-6",
												i < completeForm.successRating
													? "text-yellow-500 fill-yellow-500"
													: "text-muted-foreground"
											)}
										/>
									</button>
								))}
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="nextSteps">Next Steps (one per line)</Label>
							<Textarea
								id="nextSteps"
								value={completeForm.nextSteps}
								onChange={(e) =>
									setCompleteForm({ ...completeForm, nextSteps: e.target.value })
								}
								placeholder="Follow up with procurement&#10;Send solution overview&#10;Schedule technical demo"
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setCompleteDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={handleCompleteActivity}
							disabled={!completeForm.outcome || isPending}
							isLoading={isPending}
						>
							Complete Activity
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default ActivityTimeline;
