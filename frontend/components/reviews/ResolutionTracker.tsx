/**
 * ResolutionTracker - Track Issue Resolution Progress
 *
 * Displays resolution progress for review comments with
 * filtering, prioritization, and assignment tracking.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
	CheckCircle2,
	Clock,
	AlertTriangle,
	User,
	Filter,
	ArrowUpDown,
	ChevronRight,
	Calendar,
	BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ResolutionItem {
	id: string;
	commentId: string;
	title: string;
	description: string;
	severity: "critical" | "major" | "minor" | "editorial";
	category: string;
	sectionName?: string;
	status: "open" | "in_progress" | "resolved" | "wont_fix" | "deferred";
	assignedTo?: string;
	assignedToName?: string;
	resolutionNotes?: string;
	createdAt: string;
	resolvedAt?: string;
	dueDate?: string;
	priorityRank?: number;
}

export interface ResolutionStats {
	total: number;
	open: number;
	inProgress: number;
	resolved: number;
	wontFix: number;
	deferred: number;
	bySeverity: Record<string, number>;
	byCategory: Record<string, { total: number; resolved: number }>;
	byAssignee: Record<string, { total: number; resolved: number; name: string }>;
}

export interface ResolutionTrackerProps {
	items: ResolutionItem[];
	onUpdateStatus?: (
		itemId: string,
		status: ResolutionItem["status"],
		notes?: string
	) => void;
	onAssign?: (itemId: string, userId: string) => void;
	onSetPriority?: (itemId: string, priority: number) => void;
	onViewComment?: (commentId: string) => void;
	assignees?: { id: string; name: string }[];
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG: Record<
	ResolutionItem["status"],
	{ label: string; icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
	open: {
		label: "Open",
		icon: AlertTriangle,
		color: "text-amber-600",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	in_progress: {
		label: "In Progress",
		icon: Clock,
		color: "text-blue-600",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	resolved: {
		label: "Resolved",
		icon: CheckCircle2,
		color: "text-green-600",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	wont_fix: {
		label: "Won't Fix",
		icon: CheckCircle2,
		color: "text-gray-600",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
	deferred: {
		label: "Deferred",
		icon: Clock,
		color: "text-purple-600",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
};

const SEVERITY_CONFIG: Record<
	ResolutionItem["severity"],
	{ label: string; color: string; priority: number }
> = {
	critical: { label: "Critical", color: "text-red-600 bg-red-100", priority: 0 },
	major: { label: "Major", color: "text-orange-600 bg-orange-100", priority: 1 },
	minor: { label: "Minor", color: "text-yellow-600 bg-yellow-100", priority: 2 },
	editorial: { label: "Editorial", color: "text-blue-600 bg-blue-100", priority: 3 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ResolutionTracker({
	items,
	onUpdateStatus,
	onAssign,
	onSetPriority,
	onViewComment,
	assignees = [],
	className,
}: ResolutionTrackerProps) {
	// State
	const [activeTab, setActiveTab] = useState<"all" | "open" | "resolved">("open");
	const [severityFilter, setSeverityFilter] = useState<string>("all");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
	const [sortBy, setSortBy] = useState<"priority" | "severity" | "date">("severity");

	// Calculate statistics
	const stats: ResolutionStats = useMemo(() => {
		const bySeverity: Record<string, number> = {};
		const byCategory: Record<string, { total: number; resolved: number }> = {};
		const byAssignee: Record<string, { total: number; resolved: number; name: string }> = {};

		items.forEach((item) => {
			// By severity
			bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;

			// By category
			if (!byCategory[item.category]) {
				byCategory[item.category] = { total: 0, resolved: 0 };
			}
			byCategory[item.category].total++;
			if (item.status === "resolved" || item.status === "wont_fix") {
				byCategory[item.category].resolved++;
			}

			// By assignee
			if (item.assignedTo) {
				if (!byAssignee[item.assignedTo]) {
					byAssignee[item.assignedTo] = {
						total: 0,
						resolved: 0,
						name: item.assignedToName || item.assignedTo,
					};
				}
				byAssignee[item.assignedTo].total++;
				if (item.status === "resolved" || item.status === "wont_fix") {
					byAssignee[item.assignedTo].resolved++;
				}
			}
		});

		return {
			total: items.length,
			open: items.filter((i) => i.status === "open").length,
			inProgress: items.filter((i) => i.status === "in_progress").length,
			resolved: items.filter((i) => i.status === "resolved").length,
			wontFix: items.filter((i) => i.status === "wont_fix").length,
			deferred: items.filter((i) => i.status === "deferred").length,
			bySeverity,
			byCategory,
			byAssignee,
		};
	}, [items]);

	// Filter and sort items
	const filteredItems = useMemo(() => {
		let filtered = [...items];

		// Tab filter
		if (activeTab === "open") {
			filtered = filtered.filter(
				(i) => i.status === "open" || i.status === "in_progress"
			);
		} else if (activeTab === "resolved") {
			filtered = filtered.filter(
				(i) =>
					i.status === "resolved" ||
					i.status === "wont_fix" ||
					i.status === "deferred"
			);
		}

		// Severity filter
		if (severityFilter !== "all") {
			filtered = filtered.filter((i) => i.severity === severityFilter);
		}

		// Category filter
		if (categoryFilter !== "all") {
			filtered = filtered.filter((i) => i.category === categoryFilter);
		}

		// Assignee filter
		if (assigneeFilter !== "all") {
			filtered = filtered.filter((i) => i.assignedTo === assigneeFilter);
		}

		// Sort
		filtered.sort((a, b) => {
			switch (sortBy) {
				case "priority":
					return (a.priorityRank ?? 999) - (b.priorityRank ?? 999);
				case "severity":
					return (
						SEVERITY_CONFIG[a.severity].priority -
						SEVERITY_CONFIG[b.severity].priority
					);
				case "date":
					return (
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
					);
				default:
					return 0;
			}
		});

		return filtered;
	}, [items, activeTab, severityFilter, categoryFilter, assigneeFilter, sortBy]);

	// Get unique categories
	const categories = useMemo(() => {
		return [...new Set(items.map((i) => i.category))];
	}, [items]);

	// Get initials
	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	// Resolution rate
	const resolutionRate = useMemo(() => {
		if (stats.total === 0) return 0;
		return ((stats.resolved + stats.wontFix) / stats.total) * 100;
	}, [stats]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5" />
						Resolution Tracker
					</h3>
					<p className="text-sm text-muted-foreground">
						{stats.open + stats.inProgress} items remaining · {resolutionRate.toFixed(0)}% resolved
					</p>
				</div>
			</div>

			{/* Overall Progress */}
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">Resolution Progress</span>
						<span className="text-sm text-muted-foreground">
							{stats.resolved + stats.wontFix} / {stats.total} resolved
						</span>
					</div>
					<Progress value={resolutionRate} className="h-3" />

					{/* Status breakdown */}
					<div className="grid grid-cols-5 gap-2 mt-4">
						{(
							["open", "in_progress", "resolved", "wont_fix", "deferred"] as const
						).map((status) => {
							const config = STATUS_CONFIG[status];
							const count =
								status === "open"
									? stats.open
									: status === "in_progress"
										? stats.inProgress
										: status === "resolved"
											? stats.resolved
											: status === "wont_fix"
												? stats.wontFix
												: stats.deferred;
							const Icon = config.icon;

							return (
								<div
									key={status}
									className={cn(
										"p-2 rounded text-center",
										config.bgColor
									)}
								>
									<Icon className={cn("h-4 w-4 mx-auto mb-1", config.color)} />
									<p className="text-lg font-bold">{count}</p>
									<p className="text-xs text-muted-foreground">
										{config.label}
									</p>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* By Severity */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">By Severity</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="space-y-2">
						{(["critical", "major", "minor", "editorial"] as const).map(
							(severity) => {
								const config = SEVERITY_CONFIG[severity];
								const count = stats.bySeverity[severity] || 0;
								const percentage =
									stats.total > 0 ? (count / stats.total) * 100 : 0;

								return (
									<div key={severity} className="flex items-center gap-3">
										<Badge className={cn("w-20 justify-center", config.color)}>
											{config.label}
										</Badge>
										<div className="flex-1">
											<Progress value={percentage} className="h-2" />
										</div>
										<span className="text-sm w-8 text-right">{count}</span>
									</div>
								);
							}
						)}
					</div>
				</CardContent>
			</Card>

			{/* Tabs and Filters */}
			<div className="space-y-4">
				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as typeof activeTab)}
				>
					<div className="flex items-center justify-between">
						<TabsList>
							<TabsTrigger value="all">
								All ({stats.total})
							</TabsTrigger>
							<TabsTrigger value="open">
								Open ({stats.open + stats.inProgress})
							</TabsTrigger>
							<TabsTrigger value="resolved">
								Resolved ({stats.resolved + stats.wontFix + stats.deferred})
							</TabsTrigger>
						</TabsList>

						<div className="flex items-center gap-2">
							<Select value={severityFilter} onValueChange={setSeverityFilter}>
								<SelectTrigger className="w-[120px]">
									<SelectValue placeholder="Severity" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Severity</SelectItem>
									{Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
										<SelectItem key={key} value={key}>
											{config.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={categoryFilter} onValueChange={setCategoryFilter}>
								<SelectTrigger className="w-[120px]">
									<SelectValue placeholder="Category" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Categories</SelectItem>
									{categories.map((cat) => (
										<SelectItem key={cat} value={cat}>
											{cat}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
								<SelectTrigger className="w-[120px]">
									<ArrowUpDown className="h-4 w-4 mr-2" />
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="severity">By Severity</SelectItem>
									<SelectItem value="priority">By Priority</SelectItem>
									<SelectItem value="date">By Date</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Items List */}
					<TabsContent value={activeTab} className="mt-4">
						<ScrollArea className="h-[400px]">
							<div className="space-y-2">
								{filteredItems.length > 0 ? (
									filteredItems.map((item) => {
										const statusConfig = STATUS_CONFIG[item.status];
										const severityConfig = SEVERITY_CONFIG[item.severity];
										const StatusIcon = statusConfig.icon;

										return (
											<Card
												key={item.id}
												className={cn(
													"cursor-pointer hover:bg-muted/50 transition-colors",
													item.severity === "critical" &&
														item.status === "open" &&
														"border-red-500/50"
												)}
												onClick={() => onViewComment?.(item.commentId)}
											>
												<CardContent className="p-4">
													<div className="flex items-start gap-4">
														{/* Priority/Status Icon */}
														<div
															className={cn(
																"p-2 rounded-lg",
																statusConfig.bgColor
															)}
														>
															<StatusIcon
																className={cn("h-4 w-4", statusConfig.color)}
															/>
														</div>

														{/* Content */}
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 mb-1">
																<Badge
																	variant="secondary"
																	className={cn(severityConfig.color)}
																>
																	{severityConfig.label}
																</Badge>
																{item.category && (
																	<Badge variant="outline">{item.category}</Badge>
																)}
																{item.sectionName && (
																	<span className="text-xs text-muted-foreground">
																		{item.sectionName}
																	</span>
																)}
															</div>

															<h4 className="font-medium line-clamp-1">
																{item.title}
															</h4>
															<p className="text-sm text-muted-foreground line-clamp-1">
																{item.description}
															</p>

															{/* Resolution notes */}
															{item.resolutionNotes && (
																<p className="text-xs text-green-600 mt-1">
																	Resolution: {item.resolutionNotes}
																</p>
															)}
														</div>

														{/* Assignment & Actions */}
														<div className="flex items-center gap-3">
															{item.assignedTo ? (
																<Avatar className="h-8 w-8">
																	<AvatarFallback className="text-xs">
																		{getInitials(item.assignedToName || item.assignedTo)}
																	</AvatarFallback>
																</Avatar>
															) : (
																<Select
																	value=""
																	onValueChange={(v) => onAssign?.(item.id, v)}
																>
																	<SelectTrigger className="w-[100px] h-8">
																		<User className="h-3 w-3 mr-1" />
																		Assign
																	</SelectTrigger>
																	<SelectContent>
																		{assignees.map((a) => (
																			<SelectItem key={a.id} value={a.id}>
																				{a.name}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
															)}

															{item.status !== "resolved" &&
																item.status !== "wont_fix" && (
																	<Select
																		value={item.status}
																		onValueChange={(v) =>
																			onUpdateStatus?.(
																				item.id,
																				v as ResolutionItem["status"]
																			)
																		}
																	>
																		<SelectTrigger className="w-[120px] h-8">
																			<SelectValue />
																		</SelectTrigger>
																		<SelectContent>
																			{Object.entries(STATUS_CONFIG).map(
																				([key, config]) => (
																					<SelectItem key={key} value={key}>
																						{config.label}
																					</SelectItem>
																				)
																			)}
																		</SelectContent>
																	</Select>
																)}

															<ChevronRight className="h-4 w-4 text-muted-foreground" />
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})
								) : (
									<div className="text-center py-12">
										<CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
										<h3 className="font-medium mb-1">
											{activeTab === "open"
												? "All items resolved!"
												: "No items found"}
										</h3>
										<p className="text-sm text-muted-foreground">
											{activeTab === "open"
												? "Great job resolving all the issues."
												: "Try adjusting your filters."}
										</p>
									</div>
								)}
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</div>

			{/* By Assignee (if any) */}
			{Object.keys(stats.byAssignee).length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">By Assignee</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<div className="space-y-3">
							{Object.entries(stats.byAssignee).map(([id, data]) => {
								const progress = data.total > 0 ? (data.resolved / data.total) * 100 : 0;

								return (
									<div key={id} className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarFallback className="text-xs">
												{getInitials(data.name)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">{data.name}</p>
											<Progress value={progress} className="h-1.5 mt-1" />
										</div>
										<span className="text-sm text-muted-foreground">
											{data.resolved}/{data.total}
										</span>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default ResolutionTracker;
