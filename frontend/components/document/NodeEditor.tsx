/**
 * NodeEditor Component - DocFusion
 *
 * Per-node configuration panel with fine-grained controls for document synthesis.
 * Features custom prompt textarea, token budget slider with word count preview,
 * length factor slider, density target slider, and reading time estimate.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Clock,
	AlignLeft,
	Target,
	Maximize2,
	Type,
	Info,
	RotateCcw,
	Save,
} from "lucide-react";
import type { StructuralNode, NodeMetadata } from "@/lib/types/document-synthesis";
import {
	getNodeTypeLabel,
	getNodeTypeIcon,
	estimateWordCount,
	estimateReadingTime,
	canContainChildren,
} from "@/lib/types/document-synthesis";

// ============================================================================
// Types
// ============================================================================

export interface NodeEditorProps {
	/** Node to edit */
	node: StructuralNode;
	/** Called when metadata changes */
	onUpdate: (updates: Partial<NodeMetadata>) => void;
	/** Called when regeneration is requested */
	onRegenerate?: () => void;
	/** Whether generation is in progress */
	isGenerating?: boolean;
	/** Additional CSS class */
	className?: string;
}

interface StatBadgeProps {
	/** Icon to display */
	icon: React.ReactNode;
	/** Label text */
	label: string;
	/** Value display */
	value: string;
	/** Unit display (optional) */
	unit?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function NodeEditor({
	node,
	onUpdate,
	onRegenerate,
	isGenerating = false,
	className,
}: NodeEditorProps) {
	const [localPrompt, setLocalPrompt] = React.useState(node.metadata.customPrompt);
	const [hasChanges, setHasChanges] = React.useState(false);

	// Update local state when node changes
	React.useEffect(() => {
		setLocalPrompt(node.metadata.customPrompt);
		setHasChanges(false);
	}, [node.uuid]);

	// Derived values
	const wordCount = estimateWordCount(node.metadata.tokenBudget);
	const readingTime = estimateReadingTime(wordCount);
	const canHaveChildren = canContainChildren(node.type);

	// Status display
	const statusDisplay = getStatusDisplay(node.status);

	// Handlers
	const handlePromptChange = (value: string) => {
		setLocalPrompt(value);
		setHasChanges(value !== node.metadata.customPrompt);
	};

	const handleSave = () => {
		if (localPrompt !== node.metadata.customPrompt) {
			onUpdate({ customPrompt: localPrompt });
		}
		setHasChanges(false);
	};

	const handleTokenBudgetChange = (value: number[]) => {
		const tokenBudget = value[0];
		const estimatedWordCount = estimateWordCount(tokenBudget);
		onUpdate({
			tokenBudget,
			estimatedWordCount,
			estimatedReadingTime: estimateReadingTime(estimatedWordCount),
		});
	};

	const handleLengthFactorChange = (value: number[]) => {
		onUpdate({ lengthFactor: value[0] });
	};

	const handleDensityChange = (value: number[]) => {
		onUpdate({ densityTarget: value[0] });
	};

	// Render
	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
				<div className="flex items-center gap-2">
					<StatusIcon status={node.status} />
					<div>
						<h3 className="font-semibold text-sm">
							{getNodeTypeLabel(node.type)}
						</h3>
						<span className="text-xs text-muted-foreground font-mono">
							{node.path}
						</span>
					</div>
				</div>
				<div className={cn(
					"px-2 py-0.5 rounded-full text-xs font-medium",
					statusDisplay.bgClass,
					statusDisplay.textClass
				)}>
					{statusDisplay.label}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* Custom Prompt */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="custom-prompt">Custom Prompt</Label>
						{hasChanges && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={handleSave}
							>
								<Save className="h-3 w-3 mr-1" />
								Save
							</Button>
						)}
					</div>
					<Textarea
						id="custom-prompt"
						value={localPrompt}
						onChange={(e) => handlePromptChange(e.target.value)}
						placeholder="Enter custom prompt for this section..."
						className="min-h-[100px] resize-none text-sm"
					/>
					<p className="text-xs text-muted-foreground">
						This prompt guides the AI when generating content for this section.
					</p>
				</div>

				{/* Token Budget Slider */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label className="flex items-center gap-2">
							<Type className="h-4 w-4" />
							Token Budget
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="h-3 w-3 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent>
									Approximate number of tokens for generation
								</TooltipContent>
							</Tooltip>
						</Label>
						<span className="text-sm font-mono">
							{node.metadata.tokenBudget.toLocaleString()}
						</span>
					</div>
					<Slider
						value={[node.metadata.tokenBudget]}
						onValueChange={handleTokenBudgetChange}
						min={100}
						max={4000}
						step={100}
					/>
					<div className="flex items-center gap-4 text-sm">
						<span className="text-muted-foreground">
							~{wordCount} words
						</span>
						<span className="text-muted-foreground flex items-center gap-1">
							<Clock className="h-3 w-3" />
							~{readingTime} min read
						</span>
					</div>
				</div>

				{/* Length Factor Slider */}
				{canHaveChildren && (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="flex items-center gap-2">
								<Maximize2 className="h-4 w-4" />
								Length Factor
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="h-3 w-3 text-muted-foreground cursor-help" />
									</TooltipTrigger>
									<TooltipContent>
										Relative length compared to parent section
									</TooltipContent>
								</Tooltip>
							</Label>
							<span className="text-sm font-mono">
								{node.metadata.lengthFactor?.toFixed(1) ?? "1.0"}x
							</span>
						</div>
						<Slider
							value={[node.metadata.lengthFactor ?? 1.0]}
							onValueChange={handleLengthFactorChange}
							min={0.5}
							max={3.0}
							step={0.1}
						/>
						<p className="text-xs text-muted-foreground">
							Default is 1.8x for subsections. Adjust based on importance.
						</p>
					</div>
				)}

				{/* Density Target Slider */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label className="flex items-center gap-2">
							<Target className="h-4 w-4" />
							Density Target
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="h-3 w-3 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent>
									Key points per 100 tokens (information density)
								</TooltipContent>
							</Tooltip>
						</Label>
						<span className="text-sm font-mono">
							{node.metadata.densityTarget.toFixed(1)}
						</span>
					</div>
					<Slider
						value={[node.metadata.densityTarget]}
						onValueChange={handleDensityChange}
						min={1.0}
						max={5.0}
						step={0.1}
					/>
					<p className="text-xs text-muted-foreground">
						Higher = more information per section. Default: 2.5 key points.
					</p>
				</div>

				{/* Generated Content Preview */}
				{node.content && (
					<Accordion type="single" collapsible>
						<AccordionItem value="content">
							<AccordionTrigger className="text-sm">
								<div className="flex items-center gap-2">
									<AlignLeft className="h-4 w-4" />
									Generated Content
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<div className="p-3 bg-muted/50 rounded-md text-sm space-y-2">
									<p className="whitespace-pre-wrap">{node.content}</p>
									{node.generatedAt && (
										<p className="text-xs text-muted-foreground">
											Generated:{" "}
											{new Date(node.generatedAt).toLocaleString()}
										</p>
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				)}

				{/* Error Display */}
				{node.error && (
					<div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
						<p className="text-sm text-destructive">{node.error}</p>
					</div>
				)}

				{/* Stats Grid */}
				<div className="grid grid-cols-2 gap-3 pt-2">
					<StatBadge
						icon={<Type className="h-3 w-3" />}
						label="Words"
						value={wordCount.toLocaleString()}
					/>
					<StatBadge
						icon={<Clock className="h-3 w-3" />}
						label="Reading Time"
						value={readingTime.toString()}
						unit="min"
					/>
				</div>
			</div>

			{/* Footer Actions */}
			<div className="p-4 border-t bg-muted/30">
				<Button
					variant="secondary"
					className="w-full"
					onClick={onRegenerate}
					disabled={isGenerating}
				>
					{isGenerating ? (
						<>
							<RotateCcw className="h-4 w-4 mr-2 animate-spin" />
							Generating...
						</>
					) : (
						<>
							<RotateCcw className="h-4 w-4 mr-2" />
							Regenerate Content
						</>
					)}
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

function StatBadge({ icon, label, value, unit }: StatBadgeProps) {
	return (
		<div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
			<span className="text-muted-foreground">{icon}</span>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-sm font-medium">
					{value}
					{unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
				</p>
			</div>
		</div>
	);
}

// ============================================================================
// Helper Functions
// ============================================================================

interface StatusDisplay {
	label: string;
	bgClass: string;
	textClass: string;
}

function getStatusDisplay(status: StructuralNode["status"]): StatusDisplay {
	switch (status) {
		case "completed":
			return {
				label: "Completed",
				bgClass: "bg-green-100",
				textClass: "text-green-700",
			};
		case "generating":
			return {
				label: "Generating",
				bgClass: "bg-blue-100",
				textClass: "text-blue-700",
			};
		case "regenerating":
			return {
				label: "Regenerating",
				bgClass: "bg-amber-100",
				textClass: "text-amber-700",
			};
		case "failed":
			return {
				label: "Failed",
				bgClass: "bg-red-100",
				textClass: "text-red-700",
			};
		default:
			return {
				label: "Pending",
				bgClass: "bg-gray-100",
				textClass: "text-gray-700",
			};
	}
}

function StatusIcon({ status }: { status: StructuralNode["status"] }) {
	switch (status) {
		case "completed":
			return (
				<div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
					<div className="w-3 h-3 rounded-full bg-green-500" />
				</div>
			);
		case "generating":
		case "regenerating":
			return (
				<div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
					<div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
				</div>
			);
		case "failed":
			return (
				<div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
					<div className="w-3 h-3 rounded-full bg-red-500" />
				</div>
			);
		default:
			return (
				<div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
					<div className="w-3 h-3 rounded-full bg-gray-400" />
				</div>
			);
	}
}

export default NodeEditor;
