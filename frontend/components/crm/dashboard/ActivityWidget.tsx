"use client";

/**
 * Activity Widget Component
 *
 * Shows recent activities and upcoming tasks for CRM dashboard.
 * Provides quick overview of team/user activity.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Mail,
	Phone,
	Calendar,
	FileText,
	CheckSquare,
	MessageSquare,
	Linkedin,
	Video,
	Presentation,
	ArrowRight,
	Clock,
	AlertCircle,
} from "lucide-react";
import type { ActivityRow } from "@/lib/db/schema-crm";

interface ActivityWidgetProps {
	activities: ActivityRow[];
	maxItems?: number;
	showOverdue?: boolean;
	onViewAll?: () => void;
	onActivityClick?: (activity: ActivityRow) => void;
	className?: string;
}

// Activity type icons and colors
const ACTIVITY_CONFIG: Record<
	string,
	{ icon: React.ElementType; color: string; bgColor: string }
> = {
	email: { icon: Mail, color: "text-blue-600", bgColor: "bg-blue-100" },
	call: { icon: Phone, color: "text-green-600", bgColor: "bg-green-100" },
	meeting: { icon: Calendar, color: "text-purple-600", bgColor: "bg-purple-100" },
	task: { icon: CheckSquare, color: "text-orange-600", bgColor: "bg-orange-100" },
	note: { icon: FileText, color: "text-gray-600", bgColor: "bg-gray-100" },
	linkedin: { icon: Linkedin, color: "text-sky-600", bgColor: "bg-sky-100" },
	demo: { icon: Video, color: "text-pink-600", bgColor: "bg-pink-100" },
	proposal: { icon: Presentation, color: "text-indigo-600", bgColor: "bg-indigo-100" },
	whatsapp: { icon: MessageSquare, color: "text-emerald-600", bgColor: "bg-emerald-100" },
};

// Format relative time
const formatRelativeTime = (date: Date | string) => {
	const now = new Date();
	const activityDate = new Date(date);
	const diffMs = now.getTime() - activityDate.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 0) {
		// Future
		const futureMins = Math.abs(diffMins);
		if (futureMins < 60) return `In ${futureMins}m`;
		if (futureMins < 1440) return `In ${Math.floor(futureMins / 60)}h`;
		return `In ${Math.floor(futureMins / 1440)}d`;
	}

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return activityDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Check if activity is overdue
const isOverdue = (activity: ActivityRow) => {
	if (activity.status === "completed") return false;
	if (!activity.scheduledAt) return false;
	return new Date(activity.scheduledAt) < new Date();
};

export function ActivityWidget({
	activities,
	maxItems = 5,
	showOverdue = true,
	onViewAll,
	onActivityClick,
	className,
}: ActivityWidgetProps) {
	// Sort and filter activities
	const { recentActivities, overdueCount, upcomingCount } = useMemo(() => {
		const now = new Date();

		// Split activities
		const completed = activities
			.filter((a) => a.status === "completed" && a.completedAt)
			.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

		const upcoming = activities
			.filter((a) => a.status === "scheduled" && a.scheduledAt && new Date(a.scheduledAt) >= now)
			.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

		const overdue = activities
			.filter((a) => a.status === "scheduled" && a.scheduledAt && new Date(a.scheduledAt) < now)
			.sort((a, b) => new Date(b.scheduledAt!).getTime() - new Date(a.scheduledAt!).getTime());

		// Combine for display, prioritizing overdue and upcoming
		const combined = [
			...overdue.slice(0, 2),
			...upcoming.slice(0, 3),
			...completed.slice(0, maxItems),
		].slice(0, maxItems);

		return {
			recentActivities: combined,
			overdueCount: overdue.length,
			upcomingCount: upcoming.length,
		};
	}, [activities, maxItems]);

	return (
		<Card className={className}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-medium">Recent Activity</CardTitle>
					<div className="flex items-center gap-2">
						{showOverdue && overdueCount > 0 && (
							<Badge variant="destructive" className="text-xs">
								{overdueCount} overdue
							</Badge>
						)}
						{upcomingCount > 0 && (
							<Badge variant="secondary" className="text-xs">
								{upcomingCount} upcoming
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{recentActivities.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
						<Calendar className="h-8 w-8 mb-2" />
						<p className="text-sm">No recent activities</p>
					</div>
				) : (
					<ScrollArea className="h-[280px] pr-4">
						<div className="space-y-3">
							{recentActivities.map((activity) => {
								const config = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.note;
								const Icon = config.icon;
								const overdue = isOverdue(activity);
								const timeDate = activity.completedAt ?? activity.scheduledAt;

								return (
									<div
										key={activity.id}
										className={cn(
											"flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
											overdue && "bg-red-50"
										)}
										onClick={() => onActivityClick?.(activity)}

				role="button"
				tabIndex={0}
				onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
										<div
											className={cn(
												"h-8 w-8 rounded-full flex items-center justify-center shrink-0",
												config.bgColor
											)}
										>
											<Icon className={cn("h-4 w-4", config.color)} />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between gap-2">
												<p className="text-sm font-medium truncate">
													{activity.subject ?? `${activity.type} activity`}
												</p>
												{overdue && (
													<AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
												)}
											</div>
											{activity.description && (
												<p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
													{activity.description}
												</p>
											)}
											<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
												<Clock className="h-3 w-3" />
												<span className={cn(overdue && "text-red-600 font-medium")}>
													{timeDate ? formatRelativeTime(timeDate) : "No time set"}
												</span>
												{activity.status === "completed" && (
													<Badge variant="outline" className="text-xs py-0 h-4">
														Done
													</Badge>
												)}
												{activity.status === "scheduled" && !overdue && (
													<Badge
														variant="outline"
														className="text-xs py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
													>
														Scheduled
													</Badge>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</ScrollArea>
				)}

				{onViewAll && (
					<Button
						variant="ghost"
						size="sm"
						className="w-full mt-3"
						onClick={onViewAll}
					>
						View All Activities
						<ArrowRight className="h-4 w-4 ml-2" />
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

export default ActivityWidget;
