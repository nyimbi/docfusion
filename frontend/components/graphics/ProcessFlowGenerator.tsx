"use client";

/**
 * ProcessFlowGenerator Component - DocFusion
 *
 * AI-powered process flow diagram generator. Takes a natural language
 * description of a process and generates a Mermaid flowchart.
 *
 * Features:
 * - Text area for process description
 * - AI-powered diagram generation
 * - Live preview of generated diagram
 * - Editable output for refinement
 * - Example prompts for quick starts
 *
 * @module components/graphics/ProcessFlowGenerator
 */

import * as React from "react";
import { useCallback, useState, useTransition } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Button,
} from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { generateProcessFlow } from "@/lib/actions/graphics";
import { GraphicPreview } from "./GraphicPreview";
import {
	Wand2,
	Sparkles,
	AlertCircle,
	RefreshCw,
	Copy,
	FileCode,
	Lightbulb,
	GitBranch,
} from "lucide-react";

interface ProcessFlowGeneratorProps {
	/** Opportunity ID to associate the graphic with */
	opportunityId?: string;
	/** Initial process description */
	initialDescription?: string;
	/** Callback when a diagram is generated */
	onGenerate?: (result: {
		diagramCode: string;
		format: "mermaid" | "d2";
		suggestedCaption: string;
		suggestedActionCaption: string;
	}) => void;
}

// Example process descriptions for quick starts
const EXAMPLE_PROMPTS = [
	{
		title: "Software Development Process",
		description:
			"A software development lifecycle process that starts with requirements gathering, moves to design phase, then implementation, followed by testing including unit tests and integration tests. If tests pass, proceed to deployment. If tests fail, return to implementation for fixes.",
	},
	{
		title: "Document Review Workflow",
		description:
			"A document review process where documents are submitted for review, assigned to a reviewer, reviewed for quality and compliance. If approved, the document is published. If rejected, it returns to the author for revision. Include an optional expedited path for urgent documents.",
	},
	{
		title: "Incident Response",
		description:
			"An incident response process starting with incident detection, initial triage to determine severity, investigation phase, containment actions, resolution steps, and post-incident review. High severity incidents should trigger immediate escalation.",
	},
	{
		title: "Procurement Process",
		description:
			"A procurement process beginning with requirement identification, vendor selection from approved vendor list, quote request, evaluation, approval workflow based on purchase amount (under $10K manager approval, over $10K director approval), purchase order creation, and order tracking.",
	},
];

/**
 * ProcessFlowGenerator - AI-powered form for generating process flow diagrams.
 *
 * @example
 * ```tsx
 * <ProcessFlowGenerator
 *   opportunityId={opportunityId}
 *   onGenerate={(result) => {
 *     console.log("Generated diagram:", result.diagramCode);
 *   }}
 * />
 * ```
 */
export function ProcessFlowGenerator({
	opportunityId,
	initialDescription = "",
	onGenerate,
}: ProcessFlowGeneratorProps) {
	// State
	const [description, setDescription] = useState(initialDescription);
	const [generatedCode, setGeneratedCode] = useState<string | null>(null);
	const [generatedCaption, setGeneratedCaption] = useState<string>("");
	const [generatedActionCaption, setGeneratedActionCaption] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [showExamples, setShowExamples] = useState(false);

	// Validation
	const isValid = description.trim().length >= 20;

	// Generate diagram
	const handleGenerate = useCallback(() => {
		if (!isValid) return;

		setError(null);

		startTransition(async () => {
			const result = await generateProcessFlow(description, opportunityId);

			if (result.success) {
				setGeneratedCode(result.data.diagramCode);
				setGeneratedCaption(result.data.suggestedCaption);
				setGeneratedActionCaption(result.data.suggestedActionCaption);
				onGenerate?.(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [description, opportunityId, isValid, onGenerate]);

	// Use example
	const handleUseExample = useCallback((example: typeof EXAMPLE_PROMPTS[0]) => {
		setDescription(example.description);
		setShowExamples(false);
	}, []);

	// Copy code to clipboard
	const handleCopyCode = useCallback(async () => {
		if (generatedCode) {
			await navigator.clipboard.writeText(generatedCode);
		}
	}, [generatedCode]);

	// Regenerate with the same description
	const handleRegenerate = useCallback(() => {
		handleGenerate();
	}, [handleGenerate]);

	// Clear all
	const handleClear = useCallback(() => {
		setDescription("");
		setGeneratedCode(null);
		setGeneratedCaption("");
		setGeneratedActionCaption("");
		setError(null);
	}, []);

	return (
		<div className="flex flex-col lg:flex-row gap-4 h-full">
			{/* Form panel */}
			<Card className="flex-1 flex flex-col">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<GitBranch className="h-5 w-5 text-primary" />
							<CardTitle>Process Flow Generator</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowExamples(!showExamples)}
							>
								<Lightbulb className="h-4 w-4 mr-1" />
								Examples
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleClear}
								disabled={isPending}
							>
								Clear
							</Button>
						</div>
					</div>
					<CardDescription>
						Describe your process in natural language and let AI generate a flowchart.
					</CardDescription>
				</CardHeader>

				<CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
					{/* Example prompts */}
					{showExamples && (
						<div className="p-3 bg-muted/50 rounded-lg">
							<p className="text-xs font-medium text-muted-foreground mb-2">
								Click an example to use it:
							</p>
							<div className="space-y-2">
								{EXAMPLE_PROMPTS.map((example, i) => (
									<button
										key={i}
										onClick={() => handleUseExample(example)}
										className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
									>
										<div className="text-sm font-medium">{example.title}</div>
										<div className="text-xs text-muted-foreground line-clamp-2">
											{example.description}
										</div>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Process description input */}
					<div className="flex-1 flex flex-col space-y-2">
						<Label htmlFor="processDescription">
							Process Description
							<span className="text-muted-foreground font-normal ml-2">
								(minimum 20 characters)
							</span>
						</Label>
						<Textarea
							id="processDescription"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Describe your process in detail. Include steps, decision points, parallel processes, and any conditions or branches.

For example:
'A customer onboarding process that starts with account creation, followed by identity verification. If verification passes, proceed to account activation and welcome email. If verification fails, request additional documents and retry verification up to 3 times before manual review.'"
							className="flex-1 min-h-[200px] resize-none"
						/>
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>{description.length} characters</span>
							{description.length < 20 && description.length > 0 && (
								<span className="text-orange-500">
									{20 - description.length} more characters needed
								</span>
							)}
						</div>
					</div>

					{/* Tips */}
					<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
						<div className="flex items-start gap-2">
							<Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
							<div className="text-xs text-blue-700 dark:text-blue-300">
								<p className="font-medium mb-1">Tips for better results:</p>
								<ul className="list-disc ml-4 space-y-0.5">
									<li>Include clear step names and sequences</li>
									<li>Mention decision points with conditions</li>
									<li>Describe what happens on success/failure</li>
									<li>Note any parallel or concurrent processes</li>
								</ul>
							</div>
						</div>
					</div>

					{/* Error message */}
					{error && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
							<AlertCircle className="h-4 w-4" />
							{error}
						</div>
					)}
				</CardContent>

				<CardFooter className="border-t pt-4">
					<Button
						onClick={handleGenerate}
						disabled={!isValid || isPending}
						isLoading={isPending}
						className="w-full"
					>
						<Wand2 className="h-4 w-4 mr-2" />
						Generate Process Flow
					</Button>
				</CardFooter>
			</Card>

			{/* Preview panel */}
			<Card className="flex-1 flex flex-col">
				<CardHeader className="flex-row items-center justify-between space-y-0">
					<CardTitle className="text-sm">Preview</CardTitle>
					{generatedCode && (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRegenerate}
								disabled={isPending}
								className="h-7"
							>
								<RefreshCw className={cn("h-4 w-4 mr-1", isPending && "animate-spin")} />
								Regenerate
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleCopyCode}
								className="h-7"
							>
								<Copy className="h-4 w-4 mr-1" />
								Copy Code
							</Button>
						</div>
					)}
				</CardHeader>
				<CardContent className="flex-1 overflow-hidden">
					{generatedCode ? (
						<div className="h-full flex flex-col gap-3">
							<div className="flex-1 border rounded-lg overflow-hidden">
								<GraphicPreview
									code={generatedCode}
									format="mermaid"
									className="h-full"
								/>
							</div>

							{/* Captions */}
							<div className="space-y-2 text-sm">
								<div>
									<Label className="text-xs text-muted-foreground">Caption</Label>
									<p className="text-sm">{generatedCaption}</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Action Caption
									</Label>
									<p className="text-sm italic">{generatedActionCaption}</p>
								</div>
							</div>

							{/* Generated code preview */}
							<details className="text-sm">
								<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
									<FileCode className="h-3 w-3" />
									View Mermaid Code
								</summary>
								<pre className="mt-2 p-3 bg-muted/50 rounded-md text-xs overflow-x-auto">
									{generatedCode}
								</pre>
							</details>
						</div>
					) : (
						<div className="h-full flex items-center justify-center text-muted-foreground">
							<div className="text-center max-w-xs">
								<Sparkles className="h-12 w-12 mx-auto mb-3 opacity-40" />
								<p className="text-sm mb-2">
									Describe your process and let AI create a diagram
								</p>
								<p className="text-xs text-muted-foreground">
									The more detail you provide, the better the generated flowchart
									will be.
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
