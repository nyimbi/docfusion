"use client";

/**
 * Activity Timeline Component
 *
 * Displays activities in a chronological timeline view.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ActivityTypeBadge } from "../shared";
import {
	Phone,
	Mail,
	Calendar,
	FileText,
	MessageSquare,
	Linkedin,
	MessageCircle,
	Bell,
	Presentation,
	CheckSquare,
	ChevronDown,
	ChevronRight,
	Clock,
	User,
	Building2,
	ExternalLink,
	MoreHorizontal,
} from "lucide-react";
import type { ActivityRow } from "@/lib/db/schema-crm";
import type { ActivityType } from "@/lib/types/crm";

interface ActivityTimelineProps {
	activities: ActivityRow[];
	onActivityClick?: (activity: ActivityRow) => void;
	onEditActivity?: (activity: ActivityRow) => void;
	showFilters?: boolean;
	groupByDate?: boolean;
	className?: string;
}

// Activity type icons mapping
const activityIcons: Record<ActivityType, React.ElementType> = {
	email: Mail,
	call: Phone,
	meeting: Calendar,
	task: CheckSquare,
	note: FileText,
	linkedin: Linkedin,
	whatsapp: MessageCircle,
	sms: MessageSquare,
	event: Bell,
	demo: Presentation,
	proposal: FileText,
};

export function ActivityTimeline({
	activities,
	onActivityClick,
	onEditActivity,
	showFilters = true,
	groupByDate = true,
	className,
}: ActivityTimelineProps) {
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	// Filter activities
	const filteredActivities = useMemo(() => {
		if (typeFilter === "all") return activities;
		return activities.filter((a) => a.type === typeFilter);
	}, [activities, typeFilter]);

	// Group activities by date
	const groupedActivities = useMemo(() => {
		if (!groupByDate) return { "All Activities": filteredActivities };

		const groups: Record<string, ActivityRow[]> = {};
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		const lastWeek = new Date(today);
		lastWeek.setDate(lastWeek.getDate() - 7);
		const lastMonth = new Date(today);
		lastMonth.setMonth(lastMonth.getMonth() - 1);

		filteredActivities.forEach((activity) => {
			const date = new Date(activity.completedAt ?? activity.scheduledAt ?? activity.createdAt);
			date.setHours(0, 0, 0, 0);

			let groupKey: string;
			if (date.getTime() === today.getTime()) {
				groupKey = "Today";
			} else if (date.getTime() === yesterday.getTime()) {
				groupKey = "Yesterday";
			} else if (date >= lastWeek) {
				groupKey = "Last 7 Days";
			} else if (date >= lastMonth) {
				groupKey = "Last 30 Days";
			} else {
				groupKey = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
			}

			if (!groups[groupKey]) {
				groups[groupKey] = [];
			}
			groups[groupKey].push(activity);
		});

		return groups;
	}, [filteredActivities, groupByDate]);

	// Toggle expanded state
	const toggleExpanded = (id: string) => {
		const newExpanded = new Set(expandedIds);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		setExpandedIds(newExpanded);
	};

	// Format time
	const formatTime = (date: Date | string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		});
	};

	// Format duration
	const formatDuration = (minutes: number | null) => {
		if (!minutes) return "";
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	};

	// Get status badge
	const getStatusBadge = (status: string | null) => {
		switch (status) {
			case "completed":
				return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
			case "scheduled":
				return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
			case "cancelled":
				return <Badge className="bg-gray-100 text-gray-700">Cancelled</Badge>;
			case "no_show":
				return <Badge className="bg-red-100 text-red-700">No Show</Badge>;
			default:
				return null;
		}
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Filters */}
			{showFilters && (
				<div className="flex items-center gap-4">
					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Filter by type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Activities</SelectItem>
							<SelectItem value="email">Emails</SelectItem>
							<SelectItem value="call">Calls</SelectItem>
							<SelectItem value="meeting">Meetings</SelectItem>
							<SelectItem value="task">Tasks</SelectItem>
							<SelectItem value="note">Notes</SelectItem>
						</SelectContent>
					</Select>

					<div className="text-sm text-muted-foreground">
						{filteredActivities.length} activities
					</div>
				</div>
			)}

			{/* Timeline */}
			{Object.entries(groupedActivities).map(([group, items]) => (
				<div key={group} className="space-y-3">
					{groupByDate && (
						<h3 className="text-sm font-semibold text-muted-foreground sticky top-0 bg-background py-2">
							{group}
						</h3>
					)}

					<div className="relative">
						{/* Timeline line */}
						<div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

						{/* Activities */}
						<div className="space-y-3">
							{items.map((activity) => {
								const Icon = activityIcons[activity.type as ActivityType] ?? FileText;
								const isExpanded = expandedIds.has(activity.id);

								return (
									<div key={activity.id} className="relative pl-10">
										{/* Timeline dot */}
										<div
											className={cn(
												"absolute left-2 top-3 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-background",
												activity.status === "completed"
													? "border-green-500"
													: activity.status === "scheduled"
													? "border-blue-500"
													: "border-gray-300"
											)}
										>
											<Icon className="h-3 w-3" />
										</div>

										<Card
											className={cn(
												"cursor-pointer hover:shadow-md transition-shadow",
												isExpanded && "ring-1 ring-primary"
											)}
										>
											<Collapsible
												open={isExpanded}
												onOpenChange={() => toggleExpanded(activity.id)}
											>
												<CollapsibleTrigger asChild>
													<CardContent className="p-4">
														<div className="flex items-start justify-between gap-4">
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2">
																	<ActivityTypeBadge
																		type={activity.type as ActivityType}
																		size="sm"
																	/>
																	{getStatusBadge(activity.status)}
																	{activity.priority === "high" && (
																		<Badge variant="destructive" className="text-xs">
																			High Priority
																		</Badge>
																	)}
																</div>

																<h4 className="font-medium mt-2 truncate">
																	{activity.subject ?? `${activity.type} activity`}
																</h4>

																{activity.description && !isExpanded && (
																	<p className="text-sm text-muted-foreground mt-1 line-clamp-1">
																		{activity.description}
																	</p>
																)}

																<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
																	<span className="flex items-center gap-1">
																		<Clock className="h-3 w-3" />
																		{formatTime(activity.completedAt ?? activity.scheduledAt)}
																	</span>
																	{activity.durationMinutes && (
																		<span>{formatDuration(activity.durationMinutes)}</span>
																	)}
																	{activity.direction && (
																		<Badge variant="outline" className="text-xs">
																			{activity.direction}
																		</Badge>
																	)}
																</div>
															</div>

															<div className="flex items-center gap-2">
																{isExpanded ? (
																	<ChevronDown className="h-4 w-4 text-muted-foreground" />
																) : (
																	<ChevronRight className="h-4 w-4 text-muted-foreground" />
																)}
															</div>
														</div>
													</CardContent>
												</CollapsibleTrigger>

												<CollapsibleContent>
													<div className="px-4 pb-4 pt-0 border-t">
														{activity.description && (
															<div className="mt-4">
																<h5 className="text-sm font-medium mb-1">Description</h5>
																<p className="text-sm text-muted-foreground whitespace-pre-wrap">
																	{activity.description}
																</p>
															</div>
														)}

														{activity.outcome && (
															<div className="mt-4">
																<h5 className="text-sm font-medium mb-1">Outcome</h5>
																<p className="text-sm text-muted-foreground whitespace-pre-wrap">
																	{activity.outcome}
																</p>
															</div>
														)}

														{activity.followUpRequired && (
															<div className="mt-4 p-3 bg-yellow-50 rounded-md">
																<h5 className="text-sm font-medium text-yellow-800">
																	Follow-up Required
																</h5>
																{activity.followUpDate && (
																	<p className="text-sm text-yellow-700">
																		Date: {new Date(activity.followUpDate).toLocaleDateString()}
																	</p>
																)}
																{activity.followUpNotes && (
																	<p className="text-sm text-yellow-700 mt-1">
																		{activity.followUpNotes}
																	</p>
																)}
															</div>
														)}

														{/* Related entities */}
														<div className="mt-4 flex flex-wrap gap-2">
															{activity.accountId && (
																<Button
																	variant="outline"
																	size="sm"
																	asChild
																>
																	<a href={`/crm/accounts/${activity.accountId}`}>
																		<Building2 className="h-3 w-3 mr-1" />
																		View Account
																	</a>
																</Button>
															)}
															{activity.contactId && (
																<Button
																	variant="outline"
																	size="sm"
																	asChild
																>
																	<a href={`/crm/contacts/${activity.contactId}`}>
																		<User className="h-3 w-3 mr-1" />
																		View Contact
																	</a>
																</Button>
															)}
															{activity.dealId && (
																<Button
																	variant="outline"
																	size="sm"
																	asChild
																>
																	<a href={`/crm/deals/${activity.dealId}`}>
																		<FileText className="h-3 w-3 mr-1" />
																		View Deal
																	</a>
																</Button>
															)}
														</div>

														{/* Actions */}
														<div className="mt-4 flex items-center gap-2 border-t pt-4">
															<Button
																variant="outline"
																size="sm"
																onClick={() => onEditActivity?.(activity)}
															>
																Edit
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() => onActivityClick?.(activity)}
															>
																View Details
															</Button>
														</div>
													</div>
												</CollapsibleContent>
											</Collapsible>
										</Card>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			))}

			{filteredActivities.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<Calendar className="h-12 w-12 mb-4" />
					<p>No activities found</p>
				</div>
			)}
		</div>
	);
}

export default ActivityTimeline;
