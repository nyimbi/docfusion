"use client";

/**
 * ActionCaptionEditor Component - DocFusion
 *
 * Generate and edit action captions for graphics following government
 * proposal best practices. Action captions start with action verbs
 * and explain what the graphic demonstrates.
 *
 * Features:
 * - Shows current caption with edit capability
 * - AI generate button for automatic caption creation
 * - Validates caption starts with action verb
 * - List of government-approved action verbs
 * - Character count and limits
 *
 * @module components/graphics/ActionCaptionEditor
 */

import * as React from "react";
import { useCallback, useState, useTransition, useMemo } from "react";
import {
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
} from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generateActionCaption } from "@/lib/actions/graphics";
import {
	Wand2,
	AlertCircle,
	CheckCircle2,
	Info,
	ChevronDown,
	ChevronUp,
} from "lucide-react";

// Government-approved action verbs for captions
const ACTION_VERBS = [
	{ verb: "Illustrates", description: "Shows a concept or relationship" },
	{ verb: "Demonstrates", description: "Shows capability or process" },
	{ verb: "Depicts", description: "Represents visually" },
	{ verb: "Shows", description: "Displays information" },
	{ verb: "Presents", description: "Offers for consideration" },
	{ verb: "Highlights", description: "Emphasizes key points" },
	{ verb: "Outlines", description: "Describes structure or overview" },
	{ verb: "Summarizes", description: "Provides condensed overview" },
	{ verb: "Visualizes", description: "Makes data visible" },
	{ verb: "Maps", description: "Shows relationships or flow" },
	{ verb: "Details", description: "Provides specific information" },
	{ verb: "Conveys", description: "Communicates information" },
];

// Extract just the verb strings for validation
const ACTION_VERB_LIST = ACTION_VERBS.map((v) => v.verb.toLowerCase());

interface ActionCaptionEditorProps {
	/** Current caption value */
	value: string;
	/** Callback when caption changes */
	onChange: (value: string) => void;
	/** Graphic ID for AI generation (optional) */
	graphicId?: string;
	/** Graphic title for context */
	title?: string;
	/** Graphic type for context */
	graphicType?: string;
	/** Maximum character limit */
	maxLength?: number;
	/** Additional CSS class names */
	className?: string;
}

/**
 * Validate if caption starts with an action verb
 */
function validateActionCaption(caption: string): {
	isValid: boolean;
	verb: string | null;
	suggestion: string | null;
} {
	if (!caption.trim()) {
		return { isValid: false, verb: null, suggestion: null };
	}

	const firstWord = caption.trim().split(/\s+/)[0].toLowerCase();

	// Check if starts with an approved verb
	const matchedVerb = ACTION_VERB_LIST.find(
		(v) => firstWord === v || firstWord.startsWith(v.slice(0, -1))
	);

	if (matchedVerb) {
		return { isValid: true, verb: firstWord, suggestion: null };
	}

	// Suggest a replacement
	return {
		isValid: false,
		verb: firstWord,
		suggestion: `Consider starting with "${ACTION_VERBS[0].verb}" or another action verb.`,
	};
}

/**
 * ActionCaptionEditor - Edit and generate action captions.
 *
 * @example
 * ```tsx
 * <ActionCaptionEditor
 *   value={actionCaption}
 *   onChange={setActionCaption}
 *   graphicId={graphic.id}
 *   title={graphic.title}
 *   graphicType={graphic.graphicType}
 * />
 * ```
 */
export function ActionCaptionEditor({
	value,
	onChange,
	graphicId,
	title,
	graphicType,
	maxLength = 500,
	className,
}: ActionCaptionEditorProps) {
	// State
	const [isPending, startTransition] = useTransition();
	const [showVerbList, setShowVerbList] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Validation
	const validation = useMemo(() => validateActionCaption(value), [value]);

	// Character count
	const charCount = value.length;
	const isOverLimit = charCount > maxLength;

	// Generate caption with AI
	const handleGenerate = useCallback(() => {
		if (!graphicId) {
			// Generate a placeholder if no graphic ID
			const defaultVerb = ACTION_VERBS[Math.floor(Math.random() * 4)].verb;
			const graphicLabel = graphicType?.replace("_", " ") || "graphic";
			const placeholder = `${defaultVerb} the ${title || graphicLabel} showing key information and relationships.`;
			onChange(placeholder);
			return;
		}

		setError(null);

		startTransition(async () => {
			const result = await generateActionCaption(graphicId);

			if (result.success) {
				onChange(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [graphicId, title, graphicType, onChange]);

	// Insert verb at start
	const handleInsertVerb = useCallback(
		(verb: string) => {
			const currentText = value.trim();
			if (currentText) {
				// Replace first word with the verb
				const words = currentText.split(/\s+/);
				words[0] = verb;
				onChange(words.join(" "));
			} else {
				onChange(`${verb} `);
			}
			setShowVerbList(false);
		},
		[value, onChange]
	);

	return (
		<div className={cn("space-y-2", className)}>
			{/* Label with validation status */}
			<div className="flex items-center justify-between">
				<Label htmlFor="actionCaption" className="flex items-center gap-2">
					Action Caption
					{value && (
						validation.isValid ? (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<CheckCircle2 className="h-4 w-4 text-green-600" />
									</TooltipTrigger>
									<TooltipContent>
										Starts with action verb: "{validation.verb}"
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<AlertCircle className="h-4 w-4 text-yellow-600" />
									</TooltipTrigger>
									<TooltipContent>
										{validation.suggestion}
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)
					)}
				</Label>

				<div className="flex items-center gap-1">
					{/* Verb list toggle */}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowVerbList(!showVerbList)}
						className="h-7 text-xs"
					>
						<Info className="h-3 w-3 mr-1" />
						Verbs
						{showVerbList ? (
							<ChevronUp className="h-3 w-3 ml-1" />
						) : (
							<ChevronDown className="h-3 w-3 ml-1" />
						)}
					</Button>

					{/* Generate button */}
					<Button
						variant="ghost"
						size="sm"
						onClick={handleGenerate}
						disabled={isPending}
						className="h-7 text-xs"
					>
						{isPending ? (
							<Wand2 className="h-3 w-3 animate-spin mr-1" />
						) : (
							<Wand2 className="h-3 w-3 mr-1" />
						)}
						Generate
					</Button>
				</div>
			</div>

			{/* Verb list */}
			{showVerbList && (
				<div className="p-3 bg-muted/50 rounded-lg space-y-2">
					<p className="text-xs text-muted-foreground">
						Government proposal best practice: Start action captions with these verbs:
					</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
						{ACTION_VERBS.map(({ verb, description }) => (
							<button
								key={verb}
								onClick={() => handleInsertVerb(verb)}
								className="flex items-start gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors"
							>
								<Badge variant="outline" className="text-xs shrink-0">
									{verb}
								</Badge>
								<span className="text-xs text-muted-foreground hidden sm:inline">
									{description}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Textarea */}
			<Textarea
				id="actionCaption"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Illustrates the proposed organizational structure showing clear lines of authority and communication..."
				rows={3}
				className={cn(
					!validation.isValid && value && "border-yellow-500",
					isOverLimit && "border-destructive"
				)}
			/>

			{/* Footer */}
			<div className="flex items-center justify-between text-xs">
				{/* Validation message */}
				{!validation.isValid && value && (
					<span className="text-yellow-600 flex items-center gap-1">
						<AlertCircle className="h-3 w-3" />
						{validation.suggestion}
					</span>
				)}

				{error && (
					<span className="text-destructive flex items-center gap-1">
						<AlertCircle className="h-3 w-3" />
						{error}
					</span>
				)}

				{validation.isValid && value && (
					<span className="text-green-600 flex items-center gap-1">
						<CheckCircle2 className="h-3 w-3" />
						Valid action caption
					</span>
				)}

				{!value && !error && (
					<span className="text-muted-foreground">
						Action captions explain what the graphic demonstrates
					</span>
				)}

				{/* Character count */}
				<span
					className={cn(
						"text-muted-foreground ml-auto",
						isOverLimit && "text-destructive"
					)}
				>
					{charCount}/{maxLength}
				</span>
			</div>
		</div>
	);
}
