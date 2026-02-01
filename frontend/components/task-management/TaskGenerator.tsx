"use client";

/**
 * TaskGenerator - AI-powered task generation from multiple sources.
 *
 * Features:
 * - Generate tasks from compliance matrix requirements
 * - Generate tasks from RFP sections
 * - Generate tasks from proposal outlines
 * - Generate tasks from templates
 * - AI enhancement of generated tasks (estimates, dependencies, assignments)
 * - Bulk task creation with preview
 * - Duplicate detection
 * - Task dependency inference
 */

import React, { useState, useCallback, useMemo } from "react";
import {
	Sparkles,
	FileText,
	ListChecks,
	CheckCircle2,
	AlertTriangle,
	ChevronRight,
	ChevronDown,
	Plus,
	Trash2,
	Edit2,
	Clock,
	Calendar,
	User,
	Tag,
	Link2,
	Loader2,
	RefreshCw,
	Wand2,
	Settings,
	Download,
	Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProposalTask, NewProposalTask } from "@/lib/db/schema-tasks";

// ============================================================================
// Types
// ============================================================================

type GenerationSource =
	| "compliance"
	| "rfp_sections"
	| "outline"
	| "template"
	| "custom"
	| "ai_analysis";

interface ComplianceRequirement {
	id: string;
	section: string;
	requirement: string;
	mandatory: boolean;
	evaluationCriteria?: string;
}

interface RFPSection {
	id: string;
	title: string;
	pageLimit?: number;
	content: string;
	instructions?: string;
}

interface OutlineItem {
	id: string;
	level: number;
	title: string;
	description?: string;
	wordCount?: number;
}

interface GeneratedTask {
	id: string;
	selected: boolean;
	isDuplicate: boolean;
	duplicateOf?: string;
	task: Omit<NewProposalTask, "opportunityId">;
	suggestions?: {
		estimatedHours?: number;
		suggestedAssignee?: string;
		dependencies?: string[];
		tags?: string[];
	};
	aiEnhanced: boolean;
	source: GenerationSource;
	sourceId?: string;
}

interface GenerationSettings {
	taskTypes: string[];
	includeReviewTasks: boolean;
	includeGraphicsTasks: boolean;
	includeResearchTasks: boolean;
	autoEstimate: boolean;
	autoSuggestAssignments: boolean;
	autoInferDependencies: boolean;
	defaultPriority: string;
	deadlineBuffer: number; // Days before proposal deadline
}

export interface TaskGeneratorProps {
	opportunityId: string;
	existingTasks: ProposalTask[];
	complianceRequirements?: ComplianceRequirement[];
	rfpSections?: RFPSection[];
	outline?: OutlineItem[];
	proposalDeadline?: Date;
	onGenerateTasks: (tasks: NewProposalTask[]) => Promise<void>;
	onClose: () => void;
	isOpen: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TASK_TYPE_OPTIONS = [
	{ value: "writing", label: "Writing", description: "Draft content" },
	{ value: "review", label: "Review", description: "Review and approve" },
	{
		value: "graphics",
		label: "Graphics",
		description: "Create visuals/diagrams",
	},
	{
		value: "research",
		label: "Research",
		description: "Research and gather data",
	},
	{ value: "editing", label: "Editing", description: "Edit and polish" },
	{
		value: "formatting",
		label: "Formatting",
		description: "Format and layout",
	},
	{ value: "approval", label: "Approval", description: "Final approval" },
];

const CATEGORY_OPTIONS = [
	{ value: "technical", label: "Technical" },
	{ value: "management", label: "Management" },
	{ value: "past_performance", label: "Past Performance" },
	{ value: "cost", label: "Cost/Price" },
	{ value: "executive_summary", label: "Executive Summary" },
];

const PRIORITY_OPTIONS = [
	{ value: "critical", label: "Critical" },
	{ value: "high", label: "High" },
	{ value: "medium", label: "Medium" },
	{ value: "low", label: "Low" },
];

const DEFAULT_SETTINGS: GenerationSettings = {
	taskTypes: ["writing", "review"],
	includeReviewTasks: true,
	includeGraphicsTasks: false,
	includeResearchTasks: false,
	autoEstimate: true,
	autoSuggestAssignments: true,
	autoInferDependencies: true,
	defaultPriority: "medium",
	deadlineBuffer: 3,
};

// ============================================================================
// AI Task Generation Functions
// ============================================================================

/**
 * Generate tasks from compliance requirements using AI analysis
 */
function generateTasksFromCompliance(
	requirements: ComplianceRequirement[],
	settings: GenerationSettings,
	deadline?: Date
): GeneratedTask[] {
	const tasks: GeneratedTask[] = [];
	let taskNumber = 1;

	requirements.forEach((req) => {
		// Main writing task
		const writeTask: GeneratedTask = {
			id: `gen-${taskNumber++}`,
			selected: true,
			isDuplicate: false,
			aiEnhanced: false,
			source: "compliance",
			sourceId: req.id,
			task: {
				taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
				title: `Draft response for: ${req.requirement.slice(0, 80)}${req.requirement.length > 80 ? "..." : ""}`,
				description: `Address compliance requirement from section ${req.section}:\n\n"${req.requirement}"`,
				taskType: "writing",
				taskCategory: inferCategoryFromSection(req.section),
				priority: req.mandatory ? "high" : settings.defaultPriority,
				estimatedHours: estimateHoursFromContent(req.requirement),
				dueDate: deadline
					? new Date(deadline.getTime() - settings.deadlineBuffer * 86400000)
					: null,
				complianceRequirements: [req.id],
				tags: req.mandatory ? ["mandatory", "compliance"] : ["compliance"],
				dependsOn: [],
				blockedBy: [],
				blocks: [],
			},
			suggestions: {
				estimatedHours: estimateHoursFromContent(req.requirement),
				tags: ["compliance", req.section.toLowerCase()],
			},
		};
		tasks.push(writeTask);

		// Review task if enabled
		if (settings.includeReviewTasks) {
			const reviewTask: GeneratedTask = {
				id: `gen-${taskNumber++}`,
				selected: true,
				isDuplicate: false,
				aiEnhanced: false,
				source: "compliance",
				sourceId: req.id,
				task: {
					taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
					title: `Review: ${req.requirement.slice(0, 60)}...`,
					description: `Review and approve compliance response for ${req.section}`,
					taskType: "review",
					taskCategory: inferCategoryFromSection(req.section),
					priority: req.mandatory ? "high" : "medium",
					estimatedHours: Math.ceil(estimateHoursFromContent(req.requirement) * 0.3),
					dueDate: deadline
						? new Date(deadline.getTime() - (settings.deadlineBuffer - 1) * 86400000)
						: null,
					dependsOn: [writeTask.id],
					blockedBy: [],
					blocks: [],
					tags: ["review", "compliance"],
				},
				suggestions: {
					dependencies: [writeTask.id],
				},
			};
			tasks.push(reviewTask);
		}

		// Graphics task if content suggests visuals needed
		if (settings.includeGraphicsTasks && requiresGraphics(req.requirement)) {
			const graphicsTask: GeneratedTask = {
				id: `gen-${taskNumber++}`,
				selected: true,
				isDuplicate: false,
				aiEnhanced: false,
				source: "compliance",
				sourceId: req.id,
				task: {
					taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
					title: `Create graphics for: ${req.section}`,
					description: `Create supporting visuals/diagrams for ${req.section}`,
					taskType: "graphics",
					taskCategory: inferCategoryFromSection(req.section),
					priority: "medium",
					estimatedHours: 4,
					dueDate: deadline
						? new Date(deadline.getTime() - settings.deadlineBuffer * 86400000)
						: null,
					dependsOn: [],
					blockedBy: [],
					blocks: [writeTask.id],
					tags: ["graphics"],
				},
			};
			tasks.push(graphicsTask);
		}
	});

	return tasks;
}

/**
 * Generate tasks from RFP sections
 */
function generateTasksFromRFPSections(
	sections: RFPSection[],
	settings: GenerationSettings,
	deadline?: Date
): GeneratedTask[] {
	const tasks: GeneratedTask[] = [];
	let taskNumber = 1;

	sections.forEach((section) => {
		// Research task
		if (settings.includeResearchTasks) {
			tasks.push({
				id: `gen-${taskNumber++}`,
				selected: true,
				isDuplicate: false,
				aiEnhanced: false,
				source: "rfp_sections",
				sourceId: section.id,
				task: {
					taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
					title: `Research for: ${section.title}`,
					description: `Gather data and research materials for ${section.title}`,
					taskType: "research",
					taskCategory: inferCategoryFromTitle(section.title),
					priority: "medium",
					estimatedHours: 4,
					tags: ["research"],
					dependsOn: [],
					blockedBy: [],
					blocks: [],
				},
			});
		}

		// Main writing task
		const wordEstimate = section.pageLimit ? section.pageLimit * 400 : 1000;
		const writeTask: GeneratedTask = {
			id: `gen-${taskNumber++}`,
			selected: true,
			isDuplicate: false,
			aiEnhanced: false,
			source: "rfp_sections",
			sourceId: section.id,
			task: {
				taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
				title: `Write: ${section.title}`,
				description: section.instructions
					? `Write section following instructions:\n\n${section.instructions}`
					: `Write content for ${section.title}`,
				taskType: "writing",
				taskCategory: inferCategoryFromTitle(section.title),
				priority: settings.defaultPriority,
				estimatedHours: Math.ceil(wordEstimate / 250), // ~250 words/hour
				wordCountTarget: wordEstimate,
				pageTarget: section.pageLimit,
				dueDate: deadline
					? new Date(deadline.getTime() - settings.deadlineBuffer * 86400000)
					: null,
				tags: ["content"],
				dependsOn: [],
				blockedBy: [],
				blocks: [],
			},
		};
		tasks.push(writeTask);

		// Review task
		if (settings.includeReviewTasks) {
			tasks.push({
				id: `gen-${taskNumber++}`,
				selected: true,
				isDuplicate: false,
				aiEnhanced: false,
				source: "rfp_sections",
				sourceId: section.id,
				task: {
					taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
					title: `Review: ${section.title}`,
					description: `Review and approve ${section.title}`,
					taskType: "review",
					taskCategory: inferCategoryFromTitle(section.title),
					priority: "medium",
					estimatedHours: Math.ceil((wordEstimate / 250) * 0.3),
					dependsOn: [writeTask.id],
					blockedBy: [],
					blocks: [],
					tags: ["review"],
				},
			});
		}
	});

	return tasks;
}

/**
 * Generate tasks from proposal outline
 */
function generateTasksFromOutline(
	outline: OutlineItem[],
	settings: GenerationSettings,
	deadline?: Date
): GeneratedTask[] {
	const tasks: GeneratedTask[] = [];
	let taskNumber = 1;

	// Group by top-level items
	const topLevelItems = outline.filter((item) => item.level === 1);

	topLevelItems.forEach((item) => {
		const children = outline.filter(
			(o) => o.id.startsWith(item.id) && o.level > 1
		);

		// Main section task
		const writeTask: GeneratedTask = {
			id: `gen-${taskNumber++}`,
			selected: true,
			isDuplicate: false,
			aiEnhanced: false,
			source: "outline",
			sourceId: item.id,
			task: {
				taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
				title: `Write: ${item.title}`,
				description: item.description
					? `${item.description}\n\nSubsections: ${children.map((c) => c.title).join(", ")}`
					: `Write content for ${item.title}`,
				taskType: "writing",
				taskCategory: inferCategoryFromTitle(item.title),
				priority: settings.defaultPriority,
				estimatedHours: item.wordCount
					? Math.ceil(item.wordCount / 250)
					: 4,
				wordCountTarget: item.wordCount,
				dueDate: deadline
					? new Date(deadline.getTime() - settings.deadlineBuffer * 86400000)
					: null,
				dependsOn: [],
				blockedBy: [],
				blocks: [],
				tags: ["content", "outline"],
			},
		};
		tasks.push(writeTask);

		// Review task
		if (settings.includeReviewTasks) {
			tasks.push({
				id: `gen-${taskNumber++}`,
				selected: true,
				isDuplicate: false,
				aiEnhanced: false,
				source: "outline",
				sourceId: item.id,
				task: {
					taskNumber: `TASK-${String(taskNumber).padStart(3, "0")}`,
					title: `Review: ${item.title}`,
					description: `Review and approve ${item.title}`,
					taskType: "review",
					taskCategory: inferCategoryFromTitle(item.title),
					priority: "medium",
					estimatedHours: 2,
					dependsOn: [writeTask.id],
					blockedBy: [],
					blocks: [],
					tags: ["review", "outline"],
				},
			});
		}
	});

	return tasks;
}

/**
 * AI-enhanced task generation using structured analysis
 */
async function enhanceTasksWithAI(
	tasks: GeneratedTask[],
	existingTasks: ProposalTask[]
): Promise<GeneratedTask[]> {
	// This would call the AI service in a real implementation
	// For now, we'll simulate AI enhancement

	const enhanced = tasks.map((task) => {
		// Check for duplicates
		const duplicate = existingTasks.find(
			(existing) =>
				existing.title.toLowerCase() === task.task.title?.toLowerCase() ||
				(existing.description &&
					task.task.description &&
					existing.description.toLowerCase() ===
						task.task.description.toLowerCase())
		);

		if (duplicate) {
			return {
				...task,
				isDuplicate: true,
				duplicateOf: duplicate.id,
				selected: false,
			};
		}

		// Enhance estimates based on content
		const enhancedHours = task.task.description
			? estimateHoursFromContent(task.task.description)
			: task.task.estimatedHours;

		return {
			...task,
			aiEnhanced: true,
			suggestions: {
				...task.suggestions,
				estimatedHours: enhancedHours ?? undefined,
			},
		};
	});

	return enhanced;
}

// ============================================================================
// Helper Functions
// ============================================================================

function inferCategoryFromSection(section: string): string {
	const lower = section.toLowerCase();
	if (
		lower.includes("technical") ||
		lower.includes("approach") ||
		lower.includes("solution")
	)
		return "technical";
	if (
		lower.includes("management") ||
		lower.includes("staffing") ||
		lower.includes("organization")
	)
		return "management";
	if (
		lower.includes("past performance") ||
		lower.includes("experience") ||
		lower.includes("reference")
	)
		return "past_performance";
	if (lower.includes("cost") || lower.includes("price") || lower.includes("budget"))
		return "cost";
	if (lower.includes("executive") || lower.includes("summary"))
		return "executive_summary";
	return "technical";
}

function inferCategoryFromTitle(title: string): string {
	return inferCategoryFromSection(title);
}

function estimateHoursFromContent(content: string): number {
	const words = content.split(/\s+/).length;
	// Rough estimate: 250 words/hour for writing, +50% for complex content
	const baseHours = words / 250;
	const complexityMultiplier = content.includes("diagram")
		? 1.5
		: content.includes("analysis")
			? 1.3
			: 1;
	return Math.ceil(baseHours * complexityMultiplier);
}

function requiresGraphics(content: string): boolean {
	const graphicsKeywords = [
		"diagram",
		"chart",
		"figure",
		"illustration",
		"flowchart",
		"architecture",
		"organization chart",
		"timeline",
		"gantt",
		"visual",
	];
	const lower = content.toLowerCase();
	return graphicsKeywords.some((keyword) => lower.includes(keyword));
}

// ============================================================================
// Generated Task Item Component
// ============================================================================

interface TaskItemProps {
	task: GeneratedTask;
	onToggleSelect: () => void;
	onEdit: () => void;
	onRemove: () => void;
}

function TaskItem({ task, onToggleSelect, onEdit, onRemove }: TaskItemProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div
			className={cn(
				"border rounded-lg p-3 transition-all",
				task.selected && !task.isDuplicate
					? "border-blue-300 bg-blue-50"
					: "border-gray-200",
				task.isDuplicate && "border-amber-300 bg-amber-50"
			)}
		>
			<div className="flex items-start gap-3">
				<Checkbox
					checked={task.selected && !task.isDuplicate}
					onCheckedChange={onToggleSelect}
					disabled={task.isDuplicate}
					className="mt-1"
				/>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<Badge variant="outline" className="text-xs">
							{task.task.taskType}
						</Badge>
						{task.task.priority === "critical" && (
							<Badge variant="destructive" className="text-xs">
								Critical
							</Badge>
						)}
						{task.task.priority === "high" && (
							<Badge variant="outline" className="text-xs text-orange-600">
								High
							</Badge>
						)}
						{task.aiEnhanced && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger>
										<Sparkles className="w-3.5 h-3.5 text-purple-500" />
									</TooltipTrigger>
									<TooltipContent>AI enhanced</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
						{task.isDuplicate && (
							<Badge variant="outline" className="text-xs text-amber-600">
								Duplicate
							</Badge>
						)}
					</div>

					<h4 className="font-medium text-sm line-clamp-2">{task.task.title}</h4>

					{/* Quick stats */}
					<div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
						{task.task.estimatedHours && (
							<span className="flex items-center gap-1">
								<Clock className="w-3 h-3" />
								{task.task.estimatedHours}h
							</span>
						)}
						{task.task.wordCountTarget && (
							<span className="flex items-center gap-1">
								<FileText className="w-3 h-3" />
								{task.task.wordCountTarget} words
							</span>
						)}
						{task.task.taskCategory && (
							<span className="capitalize">{task.task.taskCategory}</span>
						)}
					</div>

					{/* Expanded details */}
					<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="mt-2 h-6 text-xs">
								{isExpanded ? "Show less" : "Show details"}
								<ChevronDown
									className={cn(
										"w-3 h-3 ml-1 transition-transform",
										isExpanded && "rotate-180"
									)}
								/>
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2">
							{task.task.description && (
								<p className="text-xs text-gray-600 mb-2 whitespace-pre-line">
									{task.task.description}
								</p>
							)}
							{task.task.tags && task.task.tags.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{task.task.tags.map((tag) => (
										<Badge key={tag} variant="secondary" className="text-xs">
											{tag}
										</Badge>
									))}
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
						<Edit2 className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="h-8 w-8 p-0 text-red-500"
					>
						<Trash2 className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskGenerator({
	opportunityId,
	existingTasks,
	complianceRequirements = [],
	rfpSections = [],
	outline = [],
	proposalDeadline,
	onGenerateTasks,
	onClose,
	isOpen,
}: TaskGeneratorProps) {
	// State
	const [activeTab, setActiveTab] = useState<GenerationSource>("compliance");
	const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
	const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
	const [generating, setGenerating] = useState(false);
	const [creating, setCreating] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [customText, setCustomText] = useState("");

	// Selected tasks count
	const selectedCount = useMemo(
		() => generatedTasks.filter((t) => t.selected && !t.isDuplicate).length,
		[generatedTasks]
	);

	const duplicateCount = useMemo(
		() => generatedTasks.filter((t) => t.isDuplicate).length,
		[generatedTasks]
	);

	// Handlers
	const handleGenerate = useCallback(async () => {
		setGenerating(true);

		try {
			let tasks: GeneratedTask[] = [];

			switch (activeTab) {
				case "compliance":
					tasks = generateTasksFromCompliance(
						complianceRequirements,
						settings,
						proposalDeadline
					);
					break;
				case "rfp_sections":
					tasks = generateTasksFromRFPSections(
						rfpSections,
						settings,
						proposalDeadline
					);
					break;
				case "outline":
					tasks = generateTasksFromOutline(outline, settings, proposalDeadline);
					break;
				case "ai_analysis":
					// AI would analyze the opportunity and generate comprehensive tasks
					tasks = [
						...generateTasksFromCompliance(
							complianceRequirements,
							settings,
							proposalDeadline
						),
						...generateTasksFromRFPSections(
							rfpSections,
							settings,
							proposalDeadline
						),
						...generateTasksFromOutline(outline, settings, proposalDeadline),
					];
					break;
				case "custom":
					// Parse custom text and generate tasks
					const lines = customText
						.split("\n")
						.filter((line) => line.trim());
					tasks = lines.map((line, i) => ({
						id: `gen-custom-${i}`,
						selected: true,
						isDuplicate: false,
						aiEnhanced: false,
						source: "custom" as GenerationSource,
						task: {
							taskNumber: `TASK-${String(i + 1).padStart(3, "0")}`,
							title: line.trim(),
							taskType: "writing",
							priority: settings.defaultPriority,
							estimatedHours: 4,
							dependsOn: [],
							blockedBy: [],
							blocks: [],
							tags: [],
						},
					}));
					break;
			}

			// Enhance with AI (check duplicates, improve estimates)
			const enhanced = await enhanceTasksWithAI(tasks, existingTasks);
			setGeneratedTasks(enhanced);
		} catch (error) {
			console.error("Generation failed:", error);
		} finally {
			setGenerating(false);
		}
	}, [
		activeTab,
		complianceRequirements,
		rfpSections,
		outline,
		settings,
		proposalDeadline,
		existingTasks,
		customText,
	]);

	const handleToggleSelect = useCallback((taskId: string) => {
		setGeneratedTasks((prev) =>
			prev.map((t) =>
				t.id === taskId ? { ...t, selected: !t.selected } : t
			)
		);
	}, []);

	const handleSelectAll = useCallback(() => {
		setGeneratedTasks((prev) =>
			prev.map((t) => ({ ...t, selected: !t.isDuplicate }))
		);
	}, []);

	const handleDeselectAll = useCallback(() => {
		setGeneratedTasks((prev) => prev.map((t) => ({ ...t, selected: false })));
	}, []);

	const handleRemoveTask = useCallback((taskId: string) => {
		setGeneratedTasks((prev) => prev.filter((t) => t.id !== taskId));
	}, []);

	const handleCreate = useCallback(async () => {
		setCreating(true);

		try {
			const tasksToCreate = generatedTasks
				.filter((t) => t.selected && !t.isDuplicate)
				.map((t) => ({
					...t.task,
					opportunityId,
				}));

			await onGenerateTasks(tasksToCreate);
			setGeneratedTasks([]);
			onClose();
		} catch (error) {
			console.error("Failed to create tasks:", error);
		} finally {
			setCreating(false);
		}
	}, [generatedTasks, opportunityId, onGenerateTasks, onClose]);

	// Source tabs configuration
	const sourceTabs = [
		{
			id: "compliance",
			label: "Compliance Matrix",
			count: complianceRequirements.length,
			icon: ListChecks,
			disabled: complianceRequirements.length === 0,
		},
		{
			id: "rfp_sections",
			label: "RFP Sections",
			count: rfpSections.length,
			icon: FileText,
			disabled: rfpSections.length === 0,
		},
		{
			id: "outline",
			label: "Outline",
			count: outline.length,
			icon: FileText,
			disabled: outline.length === 0,
		},
		{
			id: "ai_analysis",
			label: "AI Analysis",
			count: null,
			icon: Sparkles,
			disabled: false,
		},
		{
			id: "custom",
			label: "Custom",
			count: null,
			icon: Edit2,
			disabled: false,
		},
	];

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Wand2 className="w-5 h-5 text-purple-500" />
						AI Task Generator
					</DialogTitle>
					<DialogDescription>
						Generate tasks from compliance requirements, RFP sections, or let AI
						analyze your opportunity
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex flex-col">
					{/* Source selection */}
					<Tabs
						value={activeTab}
						onValueChange={(v) => setActiveTab(v as GenerationSource)}
						className="flex-1 flex flex-col overflow-hidden"
					>
						<TabsList className="grid grid-cols-5">
							{sourceTabs.map((tab) => (
								<TabsTrigger
									key={tab.id}
									value={tab.id}
									disabled={tab.disabled}
									className="text-xs"
								>
									<tab.icon className="w-3.5 h-3.5 mr-1" />
									{tab.label}
									{tab.count !== null && (
										<Badge variant="secondary" className="ml-1 px-1">
											{tab.count}
										</Badge>
									)}
								</TabsTrigger>
							))}
						</TabsList>

						<div className="flex-1 overflow-hidden mt-4">
							{/* AI Analysis tab */}
							<TabsContent
								value="ai_analysis"
								className="h-full flex flex-col mt-0"
							>
								<Alert className="mb-4">
									<Sparkles className="w-4 h-4" />
									<AlertDescription>
										AI will analyze all available sources (compliance matrix, RFP
										sections, outline) to generate a comprehensive task list with
										estimates, priorities, and dependencies.
									</AlertDescription>
								</Alert>
							</TabsContent>

							{/* Custom tab */}
							<TabsContent
								value="custom"
								className="h-full flex flex-col mt-0"
							>
								<Label htmlFor="customTasks" className="mb-2">
									Enter tasks (one per line)
								</Label>
								<Textarea
									id="customTasks"
									value={customText}
									onChange={(e) => setCustomText(e.target.value)}
									placeholder="Draft Executive Summary
Write Technical Approach section
Create org chart diagram
Research past performance examples
..."
									className="flex-1 min-h-[200px] font-mono text-sm"
								/>
							</TabsContent>

							{/* Other tabs show info about available sources */}
							{["compliance", "rfp_sections", "outline"].map((tabId) => (
								<TabsContent
									key={tabId}
									value={tabId}
									className="h-full mt-0"
								>
									<div className="text-sm text-gray-500">
										{tabId === "compliance" && (
											<p>
												{complianceRequirements.length} compliance requirements
												available. Tasks will be generated for each requirement
												with optional review and graphics tasks.
											</p>
										)}
										{tabId === "rfp_sections" && (
											<p>
												{rfpSections.length} RFP sections available. Tasks will
												be generated for writing, review, and optionally research
												for each section.
											</p>
										)}
										{tabId === "outline" && (
											<p>
												{outline.length} outline items available. Tasks will be
												generated for top-level sections with their subsections.
											</p>
										)}
									</div>
								</TabsContent>
							))}
						</div>
					</Tabs>

					{/* Settings */}
					<Collapsible open={showSettings} onOpenChange={setShowSettings}>
						<CollapsibleTrigger asChild>
							<Button variant="outline" size="sm" className="w-full mt-4">
								<Settings className="w-4 h-4 mr-1" />
								Generation Settings
								<ChevronDown
									className={cn(
										"w-4 h-4 ml-auto transition-transform",
										showSettings && "rotate-180"
									)}
								/>
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-4">
							<div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<Checkbox
											id="includeReview"
											checked={settings.includeReviewTasks}
											onCheckedChange={(checked) =>
												setSettings((s) => ({
													...s,
													includeReviewTasks: !!checked,
												}))
											}
										/>
										<Label htmlFor="includeReview">
											Include review tasks
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id="includeGraphics"
											checked={settings.includeGraphicsTasks}
											onCheckedChange={(checked) =>
												setSettings((s) => ({
													...s,
													includeGraphicsTasks: !!checked,
												}))
											}
										/>
										<Label htmlFor="includeGraphics">
											Include graphics tasks
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id="includeResearch"
											checked={settings.includeResearchTasks}
											onCheckedChange={(checked) =>
												setSettings((s) => ({
													...s,
													includeResearchTasks: !!checked,
												}))
											}
										/>
										<Label htmlFor="includeResearch">
											Include research tasks
										</Label>
									</div>
								</div>
								<div className="space-y-3">
									<div>
										<Label>Default Priority</Label>
										<Select
											value={settings.defaultPriority}
											onValueChange={(v) =>
												setSettings((s) => ({ ...s, defaultPriority: v }))
											}
										>
											<SelectTrigger className="mt-1">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PRIORITY_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label>Deadline Buffer (days)</Label>
										<Input
											type="number"
											min={0}
											max={30}
											value={settings.deadlineBuffer}
											onChange={(e) =>
												setSettings((s) => ({
													...s,
													deadlineBuffer: parseInt(e.target.value) || 0,
												}))
											}
											className="mt-1"
										/>
									</div>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>

					{/* Generate button */}
					<Button
						onClick={handleGenerate}
						disabled={
							generating ||
							(activeTab === "custom" && !customText.trim())
						}
						className="mt-4"
					>
						{generating ? (
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						) : (
							<Sparkles className="w-4 h-4 mr-2" />
						)}
						Generate Tasks
					</Button>

					{/* Generated tasks */}
					{generatedTasks.length > 0 && (
						<div className="mt-4 flex-1 overflow-hidden flex flex-col">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-3">
									<span className="text-sm font-medium">
										Generated Tasks ({generatedTasks.length})
									</span>
									{duplicateCount > 0 && (
										<Badge variant="outline" className="text-amber-600">
											{duplicateCount} duplicates
										</Badge>
									)}
								</div>
								<div className="flex gap-2">
									<Button variant="outline" size="sm" onClick={handleSelectAll}>
										Select All
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={handleDeselectAll}
									>
										Deselect All
									</Button>
								</div>
							</div>

							<ScrollArea className="flex-1 border rounded-lg p-2">
								<div className="space-y-2">
									{generatedTasks.map((task) => (
										<TaskItem
											key={task.id}
											task={task}
											onToggleSelect={() => handleToggleSelect(task.id)}
											onEdit={() => {}}
											onRemove={() => handleRemoveTask(task.id)}
										/>
									))}
								</div>
							</ScrollArea>
						</div>
					)}
				</div>

				<DialogFooter className="mt-4 pt-4 border-t flex-row justify-between">
					<div className="text-sm text-gray-500">
						{selectedCount > 0 && (
							<span>{selectedCount} tasks selected for creation</span>
						)}
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button
							onClick={handleCreate}
							disabled={selectedCount === 0 || creating}
						>
							{creating ? (
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<Plus className="w-4 h-4 mr-2" />
							)}
							Create {selectedCount} Tasks
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default TaskGenerator;
