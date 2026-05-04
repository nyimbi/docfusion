"use client";

/**
 * Action Item Tracker Component
 *
 * Tracks and manages action items from debriefs with filtering,
 * status updates, and due date monitoring.
 */

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	CheckCircle,
	Circle,
	Clock,
	Calendar,
	Users,
	Search,
	Filter,
	Plus,
	AlertTriangle,
	Loader2,
	Edit,
	Trash2,
	PlayCircle,
	PauseCircle,
	RefreshCw,
} from "lucide-react";
import { listDebriefs, updateActionItemStatus, trackDebriefActionItems } from "@/lib/actions/winloss";
import type { Debrief, ActionItem, ActionItemStatus } from "@/lib/types/winloss";

interface ActionItemTrackerProps {
	debriefId?: string;
	initialItems?: ActionItem[];
	initialDebriefs?: Array<Debrief & { opportunityTitle?: string }>;
	onItemUpdate?: (debriefId: string, itemId: string, status: ActionItemStatus) => void;
	className?: string;
}

type StatusFilter = "all" | ActionItemStatus;

const STATUS_CONFIG: Record<
	ActionItemStatus,
	{ label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
	pending: {
		label: "Pending",
		color: "text-gray-600",
		bgColor: "bg-gray-100",
		icon: <Circle className="h-4 w-4" />,
	},
	in_progress: {
		label: "In Progress",
		color: "text-blue-600",
		bgColor: "bg-blue-100",
		icon: <PlayCircle className="h-4 w-4" />,
	},
	completed: {
		label: "Completed",
		color: "text-green-600",
		bgColor: "bg-green-100",
		icon: <CheckCircle className="h-4 w-4" />,
	},
};

interface ExtendedActionItem extends ActionItem {
	debriefId: string;
	opportunityTitle?: string;
}

export function ActionItemTracker({
	debriefId,
	initialItems,
	initialDebriefs,
	onItemUpdate,
	className,
}: ActionItemTrackerProps) {
	const [isPending, startTransition] = useTransition();
	const [debriefs, setDebriefs] = useState<Array<Debrief & { opportunityTitle?: string }>>(
		initialDebriefs ?? []
	);
	const [isLoading, setIsLoading] = useState(!initialDebriefs && !initialItems);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
	const [showAddDialog, setShowAddDialog] = useState(false);

	// Form state for new item
	const [newItem, setNewItem] = useState({
		item: "",
		assignee: "",
		dueDate: "",
	});

	// Fetch debriefs with action items
	const fetchDebriefs = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const result = await listDebriefs();

				if (result.success) {
					setDebriefs(result.data);
				}
			} catch (error) {
				console.error("Failed to fetch debriefs:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, []);

	useEffect(() => {
		if (!initialDebriefs && !initialItems) {
			fetchDebriefs();
		}
	}, [initialDebriefs, initialItems, fetchDebriefs]);

	// Extract all action items from debriefs
	const allItems = useMemo(() => {
		if (initialItems && debriefId) {
			return initialItems.map((item) => ({
				...item,
				debriefId,
				opportunityTitle: undefined,
			}));
		}

		const items: ExtendedActionItem[] = [];

		for (const debrief of debriefs) {
			const debriefItems = (debrief.actionItems as ActionItem[]) ?? [];
			for (const item of debriefItems) {
				items.push({
					...item,
					debriefId: debrief.id,
					opportunityTitle: debrief.opportunityTitle,
				});
			}
		}

		return items;
	}, [debriefs, initialItems, debriefId]);

	// Get unique assignees
	const assignees = useMemo(() => {
		const unique = new Set(allItems.map((item) => item.assignee).filter(Boolean));
		return Array.from(unique);
	}, [allItems]);

	// Filter items
	const filteredItems = useMemo(() => {
		let result = [...allItems];

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(item) =>
					item.item.toLowerCase().includes(query) ||
					item.assignee.toLowerCase().includes(query) ||
					item.opportunityTitle?.toLowerCase().includes(query)
			);
		}

		// Status filter
		if (statusFilter !== "all") {
			result = result.filter((item) => item.status === statusFilter);
		}

		// Assignee filter
		if (assigneeFilter !== "all") {
			result = result.filter((item) => item.assignee === assigneeFilter);
		}

		// Sort by due date (overdue first, then by date)
		result.sort((a, b) => {
			const now = new Date();
			const aDate = new Date(a.dueDate);
			const bDate = new Date(b.dueDate);
			const aOverdue = aDate < now && a.status !== "completed";
			const bOverdue = bDate < now && b.status !== "completed";

			if (aOverdue && !bOverdue) return -1;
			if (!aOverdue && bOverdue) return 1;
			return aDate.getTime() - bDate.getTime();
		});

		return result;
	}, [allItems, searchQuery, statusFilter, assigneeFilter]);

	// Calculate stats
	const stats = useMemo(() => {
		const now = new Date();
		const pending = allItems.filter((i) => i.status === "pending").length;
		const inProgress = allItems.filter((i) => i.status === "in_progress").length;
		const completed = allItems.filter((i) => i.status === "completed").length;
		const overdue = allItems.filter(
			(i) => new Date(i.dueDate) < now && i.status !== "completed"
		).length;
		const completionRate =
			allItems.length > 0 ? Math.round((completed / allItems.length) * 100) : 0;

		return { pending, inProgress, completed, overdue, total: allItems.length, completionRate };
	}, [allItems]);

	// Handle status update
	const handleStatusUpdate = useCallback(
		async (item: ExtendedActionItem, newStatus: ActionItemStatus) => {
			startTransition(async () => {
				try {
					const result = await updateActionItemStatus(item.debriefId, item.id, newStatus);

					if (result.success) {
						// Update local state
						setDebriefs((prev) =>
							prev.map((d) => {
								if (d.id === item.debriefId) {
									const items = (d.actionItems as ActionItem[]) ?? [];
									return {
										...d,
										actionItems: items.map((i) =>
											i.id === item.id
												? {
														...i,
														status: newStatus,
														completedAt:
															newStatus === "completed"
																? new Date().toISOString()
																: undefined,
												  }
												: i
										),
									};
								}
								return d;
							})
						);

						onItemUpdate?.(item.debriefId, item.id, newStatus);
					}
				} catch (error) {
					console.error("Failed to update action item:", error);
				}
			});
		},
		[onItemUpdate]
	);

	// Handle add new item
	const handleAddItem = useCallback(async () => {
		if (!debriefId || !newItem.item || !newItem.assignee || !newItem.dueDate) return;

		startTransition(async () => {
			try {
				const newActionItem: ActionItem = {
					id: crypto.randomUUID(),
					item: newItem.item,
					assignee: newItem.assignee,
					dueDate: newItem.dueDate,
					status: "pending",
				};

				const result = await trackDebriefActionItems(debriefId, newActionItem);

				if (result.success) {
					// Refresh data
					fetchDebriefs();
					setShowAddDialog(false);
					setNewItem({ item: "", assignee: "", dueDate: "" });
				}
			} catch (error) {
				console.error("Failed to add action item:", error);
			}
		});
	}, [debriefId, newItem, fetchDebriefs]);

	// Format date
	const formatDate = (dateStr: string): string => {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	// Check if overdue
	const isOverdue = (dateStr: string, status: ActionItemStatus): boolean => {
		return new Date(dateStr) < new Date() && status !== "completed";
	};

	// Days until due
	const daysUntilDue = (dateStr: string): number => {
		const now = new Date();
		const due = new Date(dateStr);
		return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
	};

	if (isLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardContent className="pt-6">
								<Skeleton className="h-4 w-20 mb-2" />
								<Skeleton className="h-8 w-16" />
							</CardContent>
						</Card>
					))}
				</div>
				<Card>
					<CardContent className="pt-6">
						<Skeleton className="h-48 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">Action Items</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
					<Badge variant="outline">{stats.total} total</Badge>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={fetchDebriefs} disabled={isPending}>
						<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
						Refresh
					</Button>
					{debriefId && (
						<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
							<DialogTrigger asChild>
								<Button>
									<Plus className="h-4 w-4 mr-2" />
									Add Item
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Add Action Item</DialogTitle>
									<DialogDescription>
										Create a new action item for this debrief
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<span className="text-sm font-medium">Description</span>
										<Input
											placeholder="What needs to be done?"
											value={newItem.item}
											onChange={(e) =>
												setNewItem({ ...newItem, item: e.target.value })
											}
										 aria-label="Description"/>
									</div>
									<div className="space-y-2">
										<span className="text-sm font-medium">Assignee</span>
										<Input
											placeholder="Who is responsible?"
											value={newItem.assignee}
											onChange={(e) =>
												setNewItem({ ...newItem, assignee: e.target.value })
											}
										 aria-label="Assignee"/>
									</div>
									<div className="space-y-2">
										<span className="text-sm font-medium">Due Date</span>
										<Input
											type="date"
											value={newItem.dueDate}
											onChange={(e) =>
												setNewItem({ ...newItem, dueDate: e.target.value })
											}
										 aria-label="Due Date"/>
									</div>
								</div>
								<DialogFooter>
									<Button variant="outline" onClick={() => setShowAddDialog(false)}>
										Cancel
									</Button>
									<Button
										onClick={handleAddItem}
										disabled={
											isPending ||
											!newItem.item ||
											!newItem.assignee ||
											!newItem.dueDate
										}
									>
										{isPending ? (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										) : (
											<Plus className="h-4 w-4 mr-2" />
										)}
										Add Item
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					)}
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-5 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Pending</p>
								<p className="text-2xl font-bold mt-1">{stats.pending}</p>
							</div>
							<Circle className="h-6 w-6 text-gray-400" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">In Progress</p>
								<p className="text-2xl font-bold mt-1 text-blue-600">
									{stats.inProgress}
								</p>
							</div>
							<PlayCircle className="h-6 w-6 text-blue-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Completed</p>
								<p className="text-2xl font-bold mt-1 text-green-600">
									{stats.completed}
								</p>
							</div>
							<CheckCircle className="h-6 w-6 text-green-600" />
						</div>
					</CardContent>
				</Card>

				<Card className={cn(stats.overdue > 0 && "border-red-200 bg-red-50")}>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Overdue</p>
								<p className="text-2xl font-bold mt-1 text-red-600">
									{stats.overdue}
								</p>
							</div>
							<AlertTriangle className="h-6 w-6 text-red-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Completion</p>
								<p className="text-2xl font-bold mt-1">{stats.completionRate}%</p>
							</div>
						</div>
						<Progress value={stats.completionRate} className="h-1.5 mt-2" />
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search action items..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<Select
					value={statusFilter}
					onValueChange={(value) => setStatusFilter(value as StatusFilter)}
				>
					<SelectTrigger className="w-[160px]">
						<Filter className="h-4 w-4 mr-2" />
						<SelectValue placeholder="All Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="in_progress">In Progress</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
					</SelectContent>
				</Select>

				{assignees.length > 0 && (
					<Select
						value={assigneeFilter}
						onValueChange={setAssigneeFilter}
					>
						<SelectTrigger className="w-[160px]">
							<Users className="h-4 w-4 mr-2" />
							<SelectValue placeholder="All Assignees" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Assignees</SelectItem>
							{assignees.map((assignee) => (
								<SelectItem key={assignee} value={assignee}>
									{assignee}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				{(searchQuery || statusFilter !== "all" || assigneeFilter !== "all") && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setSearchQuery("");
							setStatusFilter("all");
							setAssigneeFilter("all");
						}}
					>
						Clear Filters
					</Button>
				)}
			</div>

			{/* Items List */}
			<Card>
				<CardContent className="p-0">
					{filteredItems.length > 0 ? (
						<div className="divide-y">
							{filteredItems.map((item) => {
								const statusConfig = STATUS_CONFIG[item.status];
								const overdue = isOverdue(item.dueDate, item.status);
								const days = daysUntilDue(item.dueDate);

								return (
									<div
										key={`${item.debriefId}-${item.id}`}
										className={cn(
											"flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors",
											overdue && "bg-red-50"
										)}
									>
										{/* Status checkbox */}
										<button
											type="button"
											onClick={() =>
												handleStatusUpdate(
													item,
													item.status === "completed" ? "pending" : "completed"
												)
											}
											disabled={isPending}
											className="mt-0.5 flex-shrink-0"
											aria-label={
												item.status === "completed"
													? "Mark as incomplete"
													: "Mark as complete"
											}
										>
											{item.status === "completed" ? (
												<CheckCircle className="h-5 w-5 text-green-600 fill-current" />
											) : (
												<Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
											)}
										</button>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<p
												className={cn(
													"font-medium",
													item.status === "completed" &&
														"line-through text-muted-foreground"
												)}
											>
												{item.item}
											</p>
											<div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
												{item.opportunityTitle && (
													<span className="truncate max-w-[200px]">
														{item.opportunityTitle}
													</span>
												)}
												<span className="flex items-center gap-1">
													<Users className="h-3 w-3" />
													{item.assignee}
												</span>
												<span
													className={cn(
														"flex items-center gap-1",
														overdue && "text-red-600 font-medium"
													)}
												>
													{overdue ? (
														<AlertTriangle className="h-3 w-3" />
													) : (
														<Calendar className="h-3 w-3" />
													)}
													{formatDate(item.dueDate)}
													{!overdue && item.status !== "completed" && (
														<span className="text-xs">
															({days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`})
														</span>
													)}
												</span>
												{item.completedAt && (
													<span className="flex items-center gap-1 text-green-600">
														<CheckCircle className="h-3 w-3" />
														Completed {formatDate(item.completedAt)}
													</span>
												)}
											</div>
										</div>

										{/* Status badge & actions */}
										<div className="flex items-center gap-2 flex-shrink-0">
											<Select
												value={item.status}
												onValueChange={(value) =>
													handleStatusUpdate(item, value as ActionItemStatus)
												}
												disabled={isPending}
											>
												<SelectTrigger className="w-[130px]">
													<Badge
														variant="secondary"
														className={cn(statusConfig.bgColor, statusConfig.color)}
													>
														{statusConfig.icon}
														<span className="ml-1">{statusConfig.label}</span>
													</Badge>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="pending">Pending</SelectItem>
													<SelectItem value="in_progress">In Progress</SelectItem>
													<SelectItem value="completed">Completed</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="py-12 text-center">
							<CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground">
								{allItems.length === 0
									? "No action items yet"
									: "No items match your filters"}
							</p>
							{allItems.length > 0 && (
								<Button
									variant="ghost"
									onClick={() => {
										setSearchQuery("");
										setStatusFilter("all");
										setAssigneeFilter("all");
									}}
									className="mt-2"
								>
									Clear Filters
								</Button>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Results count */}
			{filteredItems.length > 0 && (
				<p className="text-sm text-muted-foreground text-center">
					Showing {filteredItems.length} of {allItems.length} action items
				</p>
			)}
		</div>
	);
}

export default ActionItemTracker;
