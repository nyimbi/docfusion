"use client";

/**
 * TaskEditor - Comprehensive task editing dialog/panel.
 *
 * Features:
 * - Full task field editing
 * - Dependency management (add/remove blockers)
 * - Time logging
 * - Comment thread
 * - Activity history
 * - File attachments
 * - AI-suggested assignment
 */

import React, { useState, useCallback, useEffect } from "react";
import {
	X,
	Save,
	Calendar,
	Clock,
	User,
	Tag,
	Link2,
	MessageSquare,
	Plus,
	Trash2,
	AlertTriangle,
	CheckCircle2,
	History,
	Paperclip,
	Send,
	Loader2,
	ChevronDown,
	Target,
	FileText,
	Zap,
} from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ProposalTask, TaskActivity } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

export interface TaskEditorProps {
	task: ProposalTask | null;
	isOpen: boolean;
	onClose: () => void;
	onSave: (task: Partial<ProposalTask>) => Promise<void>;
	onDelete?: (taskId: string) => Promise<void>;
	onAddComment?: (taskId: string, content: string) => Promise<void>;
	onLogTime?: (
		taskId: string,
		hours: number,
		notes?: string
	) => Promise<void>;
	activities?: TaskActivity[];
	availableAssignees?: { id: string; name: string; email?: string }[];
	availableTasks?: ProposalTask[]; // For dependency selection
	loading?: boolean;
}

interface EditableTask {
	title: string;
	description: string;
	taskType: string;
	taskCategory: string;
	priority: string;
	status: string;
	assignedTo: string;
	assignedToEmail: string;
	startDate: string;
	dueDate: string;
	estimatedHours: number | null;
	progress: number;
	wordCountTarget: number | null;
	tags: string[];
	dependsOn: string[];
	blockedBy: string[];
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
	{ value: "pending", label: "Pending", color: "bg-gray-500" },
	{ value: "assigned", label: "Assigned", color: "bg-blue-500" },
	{ value: "in_progress", label: "In Progress", color: "bg-amber-500" },
	{ value: "review", label: "Review", color: "bg-purple-500" },
	{ value: "blocked", label: "Blocked", color: "bg-red-500" },
	{ value: "completed", label: "Completed", color: "bg-green-500" },
	{ value: "cancelled", label: "Cancelled", color: "bg-gray-400" },
];

const PRIORITY_OPTIONS = [
	{ value: "critical", label: "Critical", color: "text-red-600" },
	{ value: "high", label: "High", color: "text-orange-600" },
	{ value: "medium", label: "Medium", color: "text-yellow-600" },
	{ value: "low", label: "Low", color: "text-gray-500" },
];

const TASK_TYPE_OPTIONS = [
	{ value: "writing", label: "Writing" },
	{ value: "review", label: "Review" },
	{ value: "graphics", label: "Graphics" },
	{ value: "research", label: "Research" },
	{ value: "editing", label: "Editing" },
	{ value: "formatting", label: "Formatting" },
	{ value: "approval", label: "Approval" },
];

const CATEGORY_OPTIONS = [
	{ value: "technical", label: "Technical" },
	{ value: "management", label: "Management" },
	{ value: "past_performance", label: "Past Performance" },
	{ value: "cost", label: "Cost/Price" },
	{ value: "executive_summary", label: "Executive Summary" },
];

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

function formatDate(date: Date | string | null): string {
	if (!date) return "";
	const d = new Date(date);
	return d.toISOString().split("T")[0];
}

function formatDateTime(date: Date | string | null): string {
	if (!date) return "";
	return new Date(date).toLocaleString();
}

// ============================================================================
// Component
// ============================================================================

export function TaskEditor({
	task,
	isOpen,
	onClose,
	onSave,
	onDelete,
	onAddComment,
	onLogTime,
	activities = [],
	availableAssignees = [],
	availableTasks = [],
	loading = false,
}: TaskEditorProps) {
	// Form state
	const [editedTask, setEditedTask] = useState<EditableTask>({
		title: "",
		description: "",
		taskType: "writing",
		taskCategory: "",
		priority: "medium",
		status: "pending",
		assignedTo: "",
		assignedToEmail: "",
		startDate: "",
		dueDate: "",
		estimatedHours: null,
		progress: 0,
		wordCountTarget: null,
		tags: [],
		dependsOn: [],
		blockedBy: [],
	});

	const [newTag, setNewTag] = useState("");
	const [newComment, setNewComment] = useState("");
	const [timeToLog, setTimeToLog] = useState<number>(0);
	const [timeNotes, setTimeNotes] = useState("");
	const [saving, setSaving] = useState(false);
	const [activeTab, setActiveTab] = useState("details");

	// Initialize form when task changes
	useEffect(() => {
		if (task) {
			setEditedTask({
				title: task.title,
				description: task.description ?? "",
				taskType: task.taskType,
				taskCategory: task.taskCategory ?? "",
				priority: task.priority ?? "medium",
				status: task.status ?? "pending",
				assignedTo: task.assignedTo ?? "",
				assignedToEmail: task.assignedToEmail ?? "",
				startDate: formatDate(task.startDate),
				dueDate: formatDate(task.dueDate),
				estimatedHours: task.estimatedHours ?? null,
				progress: task.progress ?? 0,
				wordCountTarget: task.wordCountTarget ?? null,
				tags: task.tags ?? [],
				dependsOn: task.dependsOn ?? [],
				blockedBy: task.blockedBy ?? [],
			});
		}
	}, [task]);

	// Handlers
	const handleFieldChange = useCallback(
		<K extends keyof EditableTask>(field: K, value: EditableTask[K]) => {
			setEditedTask((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	const handleAddTag = useCallback(() => {
		if (newTag.trim() && !editedTask.tags.includes(newTag.trim())) {
			setEditedTask((prev) => ({
				...prev,
				tags: [...prev.tags, newTag.trim()],
			}));
			setNewTag("");
		}
	}, [newTag, editedTask.tags]);

	const handleRemoveTag = useCallback((tag: string) => {
		setEditedTask((prev) => ({
			...prev,
			tags: prev.tags.filter((t) => t !== tag),
		}));
	}, []);

	const handleAddDependency = useCallback((taskId: string) => {
		setEditedTask((prev) => ({
			...prev,
			dependsOn: [...prev.dependsOn, taskId],
		}));
	}, []);

	const handleRemoveDependency = useCallback((taskId: string) => {
		setEditedTask((prev) => ({
			...prev,
			dependsOn: prev.dependsOn.filter((id) => id !== taskId),
		}));
	}, []);

	const handleSave = useCallback(async () => {
		if (!task) return;

		setSaving(true);
		try {
			await onSave({
				id: task.id,
				title: editedTask.title,
				description: editedTask.description || null,
				taskType: editedTask.taskType,
				taskCategory: editedTask.taskCategory || null,
				priority: editedTask.priority,
				status: editedTask.status,
				assignedTo: editedTask.assignedTo || null,
				assignedToEmail: editedTask.assignedToEmail || null,
				startDate: editedTask.startDate
					? new Date(editedTask.startDate)
					: null,
				dueDate: editedTask.dueDate ? new Date(editedTask.dueDate) : null,
				estimatedHours: editedTask.estimatedHours,
				progress: editedTask.progress,
				wordCountTarget: editedTask.wordCountTarget,
				tags: editedTask.tags,
				dependsOn: editedTask.dependsOn,
				blockedBy: editedTask.blockedBy,
			});
			onClose();
		} catch (error) {
			console.error("Failed to save task:", error);
		} finally {
			setSaving(false);
		}
	}, [task, editedTask, onSave, onClose]);

	const handleAddComment = useCallback(async () => {
		if (!task || !newComment.trim()) return;

		try {
			await onAddComment?.(task.id, newComment.trim());
			setNewComment("");
		} catch (error) {
			console.error("Failed to add comment:", error);
		}
	}, [task, newComment, onAddComment]);

	const handleLogTime = useCallback(async () => {
		if (!task || timeToLog <= 0) return;

		try {
			await onLogTime?.(task.id, timeToLog, timeNotes);
			setTimeToLog(0);
			setTimeNotes("");
		} catch (error) {
			console.error("Failed to log time:", error);
		}
	}, [task, timeToLog, timeNotes, onLogTime]);

	const handleDelete = useCallback(async () => {
		if (!task || !onDelete) return;

		if (window.confirm("Are you sure you want to delete this task?")) {
			try {
				await onDelete(task.id);
				onClose();
			} catch (error) {
				console.error("Failed to delete task:", error);
			}
		}
	}, [task, onDelete, onClose]);

	// Filter available tasks for dependencies (exclude self and already selected)
	const availableDependencies = availableTasks.filter(
		(t) =>
			t.id !== task?.id &&
			!editedTask.dependsOn.includes(t.id) &&
			t.status !== "completed" &&
			t.status !== "cancelled"
	);

	if (!task) return null;

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
				<SheetHeader className="pb-4 border-b">
					<div className="flex items-center gap-2">
						{task.taskNumber && (
							<span className="text-sm font-mono text-gray-500">
								{task.taskNumber}
							</span>
						)}
						<Badge
							variant="outline"
							className={cn(
								PRIORITY_OPTIONS.find((p) => p.value === editedTask.priority)
									?.color
							)}
						>
							{editedTask.priority}
						</Badge>
						<Badge variant="outline">
							<div
								className={cn(
									"w-2 h-2 rounded-full mr-1.5",
									STATUS_OPTIONS.find((s) => s.value === editedTask.status)
										?.color
								)}
							/>
							{STATUS_OPTIONS.find((s) => s.value === editedTask.status)
								?.label ?? editedTask.status}
						</Badge>
					</div>
					<SheetTitle className="text-left text-lg">
						{task.title}
					</SheetTitle>
				</SheetHeader>

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex-1 flex flex-col overflow-hidden"
				>
					<TabsList className="grid grid-cols-4 mx-0">
						<TabsTrigger value="details">Details</TabsTrigger>
						<TabsTrigger value="dependencies">Dependencies</TabsTrigger>
						<TabsTrigger value="comments">
							Comments
							{task.comments && task.comments.length > 0 && (
								<Badge variant="secondary" className="ml-1.5 px-1.5">
									{task.comments.length}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="activity">Activity</TabsTrigger>
					</TabsList>

					<ScrollArea className="flex-1 mt-4">
						{/* Details Tab */}
						<TabsContent value="details" className="mt-0 space-y-4">
							{/* Title */}
							<div className="space-y-1.5">
								<Label htmlFor="title">Title</Label>
								<Input
									id="title"
									value={editedTask.title}
									onChange={(e) => handleFieldChange("title", e.target.value)}
									placeholder="Task title"
								/>
							</div>

							{/* Description */}
							<div className="space-y-1.5">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									value={editedTask.description}
									onChange={(e) =>
										handleFieldChange("description", e.target.value)
									}
									placeholder="Describe the task..."
									rows={3}
								/>
							</div>

							{/* Type and Category */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label>Task Type</Label>
									<Select
										value={editedTask.taskType}
										onValueChange={(v) => handleFieldChange("taskType", v)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{TASK_TYPE_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1.5">
									<Label>Category</Label>
									<Select
										value={editedTask.taskCategory}
										onValueChange={(v) => handleFieldChange("taskCategory", v)}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent>
											{CATEGORY_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Status and Priority */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label>Status</Label>
									<Select
										value={editedTask.status}
										onValueChange={(v) => handleFieldChange("status", v)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{STATUS_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													<div className="flex items-center gap-2">
														<div
															className={cn("w-2 h-2 rounded-full", opt.color)}
														/>
														{opt.label}
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1.5">
									<Label>Priority</Label>
									<Select
										value={editedTask.priority}
										onValueChange={(v) => handleFieldChange("priority", v)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PRIORITY_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													<span className={opt.color}>{opt.label}</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Assignee */}
							<div className="space-y-1.5">
								<Label>Assigned To</Label>
								<Select
									value={editedTask.assignedTo}
									onValueChange={(v) => {
										const assignee = availableAssignees.find(
											(a) => a.name === v
										);
										handleFieldChange("assignedTo", v);
										handleFieldChange(
											"assignedToEmail",
											assignee?.email ?? ""
										);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select assignee" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Unassigned</SelectItem>
										{availableAssignees.map((assignee) => (
											<SelectItem key={assignee.id} value={assignee.name}>
												<div className="flex items-center gap-2">
													<Avatar className="w-5 h-5">
														<AvatarFallback className="text-xs">
															{getInitials(assignee.name)}
														</AvatarFallback>
													</Avatar>
													{assignee.name}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Dates */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label htmlFor="startDate">Start Date</Label>
									<Input
										id="startDate"
										type="date"
										value={editedTask.startDate}
										onChange={(e) =>
											handleFieldChange("startDate", e.target.value)
										}
									/>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="dueDate">Due Date</Label>
									<Input
										id="dueDate"
										type="date"
										value={editedTask.dueDate}
										onChange={(e) =>
											handleFieldChange("dueDate", e.target.value)
										}
									/>
								</div>
							</div>

							{/* Time Estimates */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label htmlFor="estimatedHours">Estimated Hours</Label>
									<Input
										id="estimatedHours"
										type="number"
										min={0}
										step={0.5}
										value={editedTask.estimatedHours ?? ""}
										onChange={(e) =>
											handleFieldChange(
												"estimatedHours",
												e.target.value ? parseFloat(e.target.value) : null
											)
										}
									/>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="wordCountTarget">Word Count Target</Label>
									<Input
										id="wordCountTarget"
										type="number"
										min={0}
										value={editedTask.wordCountTarget ?? ""}
										onChange={(e) =>
											handleFieldChange(
												"wordCountTarget",
												e.target.value ? parseInt(e.target.value) : null
											)
										}
									/>
								</div>
							</div>

							{/* Progress */}
							<div className="space-y-1.5">
								<div className="flex justify-between">
									<Label>Progress</Label>
									<span className="text-sm text-gray-500">
										{editedTask.progress}%
									</span>
								</div>
								<Slider
									value={[editedTask.progress]}
									onValueChange={([value]) =>
										handleFieldChange("progress", value)
									}
									max={100}
									step={5}
								/>
							</div>

							{/* Tags */}
							<div className="space-y-1.5">
								<Label>Tags</Label>
								<div className="flex flex-wrap gap-1.5 mb-2">
									{editedTask.tags.map((tag) => (
										<Badge
											key={tag}
											variant="secondary"
											className="pr-1 flex items-center gap-1"
										>
											{tag}
											<button
												onClick={() => handleRemoveTag(tag)}
												className="hover:bg-gray-200 rounded-full p-0.5"
											>
												<X className="w-3 h-3" />
											</button>
										</Badge>
									))}
								</div>
								<div className="flex gap-2">
									<Input
										value={newTag}
										onChange={(e) => setNewTag(e.target.value)}
										placeholder="Add tag..."
										onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
									/>
									<Button variant="outline" size="sm" onClick={handleAddTag}>
										<Plus className="w-4 h-4" />
									</Button>
								</div>
							</div>

							{/* Log Time */}
							{onLogTime && (
								<Collapsible>
									<CollapsibleTrigger asChild>
										<Button
											variant="outline"
											className="w-full justify-between"
										>
											<span className="flex items-center gap-2">
												<Clock className="w-4 h-4" />
												Log Time
											</span>
											<ChevronDown className="w-4 h-4" />
										</Button>
									</CollapsibleTrigger>
									<CollapsibleContent className="pt-4 space-y-3">
										<div className="flex gap-2">
											<Input
												type="number"
												min={0}
												step={0.25}
												value={timeToLog || ""}
												onChange={(e) =>
													setTimeToLog(parseFloat(e.target.value) || 0)
												}
												placeholder="Hours"
												className="w-24"
											/>
											<Input
												value={timeNotes}
												onChange={(e) => setTimeNotes(e.target.value)}
												placeholder="Notes (optional)"
												className="flex-1"
											/>
											<Button onClick={handleLogTime} disabled={timeToLog <= 0}>
												Log
											</Button>
										</div>
										{task.actualHours && (
											<p className="text-sm text-gray-500">
												Total logged: {task.actualHours}h
											</p>
										)}
									</CollapsibleContent>
								</Collapsible>
							)}
						</TabsContent>

						{/* Dependencies Tab */}
						<TabsContent value="dependencies" className="mt-0 space-y-4">
							{/* Blocked By */}
							<div>
								<h4 className="font-medium text-sm mb-2 flex items-center gap-2">
									<AlertTriangle className="w-4 h-4 text-red-500" />
									Blocked By
								</h4>
								<p className="text-xs text-gray-500 mb-2">
									Tasks that must complete before this one can start
								</p>

								{editedTask.blockedBy.length === 0 ? (
									<p className="text-sm text-gray-400 italic">
										No blocking dependencies
									</p>
								) : (
									<div className="space-y-2">
										{editedTask.blockedBy.map((taskId) => {
											const depTask = availableTasks.find(
												(t) => t.id === taskId
											);
											return (
												<div
													key={taskId}
													className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-100"
												>
													<span className="text-sm">
														{depTask?.title ?? taskId}
													</span>
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															setEditedTask((prev) => ({
																...prev,
																blockedBy: prev.blockedBy.filter(
																	(id) => id !== taskId
																),
															}))
														}
													>
														<X className="w-4 h-4" />
													</Button>
												</div>
											);
										})}
									</div>
								)}
							</div>

							<Separator />

							{/* Depends On */}
							<div>
								<h4 className="font-medium text-sm mb-2 flex items-center gap-2">
									<Link2 className="w-4 h-4 text-blue-500" />
									Depends On
								</h4>
								<p className="text-xs text-gray-500 mb-2">
									Tasks this task needs input from
								</p>

								{editedTask.dependsOn.length === 0 ? (
									<p className="text-sm text-gray-400 italic">
										No dependencies
									</p>
								) : (
									<div className="space-y-2 mb-4">
										{editedTask.dependsOn.map((taskId) => {
											const depTask = availableTasks.find(
												(t) => t.id === taskId
											);
											return (
												<div
													key={taskId}
													className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-100"
												>
													<span className="text-sm">
														{depTask?.title ?? taskId}
													</span>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleRemoveDependency(taskId)}
													>
														<X className="w-4 h-4" />
													</Button>
												</div>
											);
										})}
									</div>
								)}

								{/* Add dependency */}
								{availableDependencies.length > 0 && (
									<Select onValueChange={handleAddDependency}>
										<SelectTrigger>
											<SelectValue placeholder="Add dependency..." />
										</SelectTrigger>
										<SelectContent>
											{availableDependencies.map((t) => (
												<SelectItem key={t.id} value={t.id}>
													{t.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</div>
						</TabsContent>

						{/* Comments Tab */}
						<TabsContent value="comments" className="mt-0 space-y-4">
							{/* Comment list */}
							<div className="space-y-3">
								{task.comments && task.comments.length > 0 ? (
									task.comments.map((comment) => (
										<div
											key={comment.id}
											className="flex gap-3 p-3 bg-gray-50 rounded-lg"
										>
											<Avatar className="w-8 h-8">
												<AvatarFallback className="text-xs">
													{getInitials(comment.userName)}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-1">
													<span className="font-medium text-sm">
														{comment.userName}
													</span>
													<span className="text-xs text-gray-400">
														{formatDateTime(comment.createdAt)}
													</span>
												</div>
												<p className="text-sm text-gray-700">
													{comment.content}
												</p>
											</div>
										</div>
									))
								) : (
									<p className="text-sm text-gray-400 text-center py-8">
										No comments yet
									</p>
								)}
							</div>

							{/* Add comment */}
							{onAddComment && (
								<div className="flex gap-2">
									<Textarea
										value={newComment}
										onChange={(e) => setNewComment(e.target.value)}
										placeholder="Add a comment..."
										rows={2}
										className="flex-1"
									/>
									<Button
										onClick={handleAddComment}
										disabled={!newComment.trim()}
									>
										<Send className="w-4 h-4" />
									</Button>
								</div>
							)}
						</TabsContent>

						{/* Activity Tab */}
						<TabsContent value="activity" className="mt-0">
							<div className="space-y-3">
								{activities.length > 0 ? (
									activities.map((activity) => (
										<div
											key={activity.id}
											className="flex gap-3 text-sm border-l-2 border-gray-200 pl-3 py-1"
										>
											<div className="flex-1">
												<p className="text-gray-700">{activity.description}</p>
												<div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
													<span>{activity.userName}</span>
													<span>•</span>
													<span>{formatDateTime(activity.createdAt)}</span>
												</div>
											</div>
										</div>
									))
								) : (
									<p className="text-sm text-gray-400 text-center py-8">
										No activity recorded
									</p>
								)}
							</div>
						</TabsContent>
					</ScrollArea>
				</Tabs>

				{/* Footer */}
				<SheetFooter className="pt-4 border-t flex-row justify-between">
					<div>
						{onDelete && (
							<Button variant="ghost" onClick={handleDelete} className="text-red-600">
								<Trash2 className="w-4 h-4 mr-1.5" />
								Delete
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={saving || !editedTask.title}>
							{saving ? (
								<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
							) : (
								<Save className="w-4 h-4 mr-1.5" />
							)}
							Save Changes
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

export default TaskEditor;
