/**
 * Narrative Generator Component
 *
 * AI-powered generation of past performance narratives including
 * CPAR summaries, relevance statements, and proposal-ready content.
 */

"use client";

import { useState, useCallback } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Wand2,
	FileText,
	Copy,
	Download,
	RefreshCw,
	Settings,
	Sparkles,
	Check,
	Loader2,
	Star,
	Target,
	TrendingUp,
	Award,
	MessageSquare,
	Lightbulb,
	Edit,
	History,
	AlertCircle,
	ChevronRight,
} from "lucide-react";
import type { Project, ProjectRelevanceScore } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface NarrativeType {
	id: string;
	label: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
	template: string;
}

interface GenerationOptions {
	tone: "formal" | "confident" | "balanced";
	length: "brief" | "standard" | "detailed";
	includeMetrics: boolean;
	includeChallenges: boolean;
	includeAwards: boolean;
	highlightStrengths: boolean;
	targetRequirements?: string[];
}

interface GeneratedNarrative {
	type: string;
	content: string;
	generatedAt: Date;
	options: GenerationOptions;
	wordCount: number;
}

interface NarrativeGeneratorProps {
	project: Project;
	relevanceScore?: ProjectRelevanceScore;
	opportunityTitle?: string;
	onGenerate: (type: string, options: GenerationOptions) => Promise<string>;
	onSave?: (type: string, content: string) => Promise<void>;
	isGenerating?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const NARRATIVE_TYPES: NarrativeType[] = [
	{
		id: "cpar",
		label: "CPAR Narrative",
		description: "Performance narrative based on CPAR ratings",
		icon: Star,
		template: "Summarize performance across quality, schedule, cost, and management",
	},
	{
		id: "relevance",
		label: "Relevance Statement",
		description: "How this project relates to the opportunity",
		icon: Target,
		template: "Explain scope alignment, technical capabilities demonstrated",
	},
	{
		id: "executive",
		label: "Executive Summary",
		description: "High-level project overview for leadership",
		icon: TrendingUp,
		template: "Brief overview with key outcomes and strategic value",
	},
	{
		id: "technical",
		label: "Technical Narrative",
		description: "Detailed technical approach and capabilities",
		icon: Lightbulb,
		template: "Technical methods, tools, innovations, and solutions",
	},
	{
		id: "accomplishments",
		label: "Key Accomplishments",
		description: "Highlight major achievements and outcomes",
		icon: Award,
		template: "Quantified results, awards, and recognition",
	},
];

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Word count indicator
 */
function WordCount({ count }: { count: number }) {
	const getStatus = (c: number) => {
		if (c < 100) return { label: "Brief", color: "text-blue-600" };
		if (c < 250) return { label: "Standard", color: "text-green-600" };
		if (c < 500) return { label: "Detailed", color: "text-yellow-600" };
		return { label: "Extended", color: "text-orange-600" };
	};

	const status = getStatus(count);

	return (
		<div className="flex items-center gap-2 text-sm">
			<span className="text-muted-foreground">{count} words</span>
			<Badge variant="outline" className={status.color}>
				{status.label}
			</Badge>
		</div>
	);
}

/**
 * Generation options panel
 */
function GenerationOptionsPanel({
	options,
	onChange,
}: {
	options: GenerationOptions;
	onChange: (options: GenerationOptions) => void;
}) {
	return (
		<div className="space-y-4 p-4 bg-muted/50 rounded-lg">
			<div className="grid gap-4 md:grid-cols-2">
				{/* Tone */}
				<div className="space-y-2">
					<Label>Tone</Label>
					<Select
						value={options.tone}
						onValueChange={(v) =>
							onChange({ ...options, tone: v as GenerationOptions["tone"] })
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="formal">Formal</SelectItem>
							<SelectItem value="confident">Confident</SelectItem>
							<SelectItem value="balanced">Balanced</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Length */}
				<div className="space-y-2">
					<Label>Length</Label>
					<Select
						value={options.length}
						onValueChange={(v) =>
							onChange({ ...options, length: v as GenerationOptions["length"] })
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="brief">Brief (~100 words)</SelectItem>
							<SelectItem value="standard">Standard (~250 words)</SelectItem>
							<SelectItem value="detailed">Detailed (~500 words)</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Toggle options */}
			<div className="grid gap-4 md:grid-cols-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="includeMetrics" className="cursor-pointer">
						Include quantified metrics
					</Label>
					<Switch
						id="includeMetrics"
						checked={options.includeMetrics}
						onCheckedChange={(checked) =>
							onChange({ ...options, includeMetrics: checked })
						}
					/>
				</div>

				<div className="flex items-center justify-between">
					<Label htmlFor="includeChallenges" className="cursor-pointer">
						Include challenges overcome
					</Label>
					<Switch
						id="includeChallenges"
						checked={options.includeChallenges}
						onCheckedChange={(checked) =>
							onChange({ ...options, includeChallenges: checked })
						}
					/>
				</div>

				<div className="flex items-center justify-between">
					<Label htmlFor="includeAwards" className="cursor-pointer">
						Include awards/recognition
					</Label>
					<Switch
						id="includeAwards"
						checked={options.includeAwards}
						onCheckedChange={(checked) =>
							onChange({ ...options, includeAwards: checked })
						}
					/>
				</div>

				<div className="flex items-center justify-between">
					<Label htmlFor="highlightStrengths" className="cursor-pointer">
						Highlight key strengths
					</Label>
					<Switch
						id="highlightStrengths"
						checked={options.highlightStrengths}
						onCheckedChange={(checked) =>
							onChange({ ...options, highlightStrengths: checked })
						}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * Narrative history item
 */
function NarrativeHistoryItem({
	narrative,
	onRestore,
}: {
	narrative: GeneratedNarrative;
	onRestore: () => void;
}) {
	const type = NARRATIVE_TYPES.find((t) => t.id === narrative.type);
	const Icon = type?.icon || FileText;

	return (
		<div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
			<Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm">{type?.label || narrative.type}</span>
					<Badge variant="outline" className="text-xs">
						{narrative.wordCount} words
					</Badge>
				</div>
				<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
					{narrative.content.substring(0, 150)}...
				</p>
				<p className="text-xs text-muted-foreground mt-1">
					{new Date(narrative.generatedAt).toLocaleString()}
				</p>
			</div>
			<Button variant="ghost" size="sm" onClick={onRestore}>
				<History className="h-4 w-4" />
			</Button>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function NarrativeGenerator({
	project,
	relevanceScore,
	opportunityTitle,
	onGenerate,
	onSave,
	isGenerating = false,
}: NarrativeGeneratorProps) {
	const [activeType, setActiveType] = useState<string>("cpar");
	const [showOptions, setShowOptions] = useState(false);
	const [options, setOptions] = useState<GenerationOptions>({
		tone: "balanced",
		length: "standard",
		includeMetrics: true,
		includeChallenges: true,
		includeAwards: true,
		highlightStrengths: true,
	});

	const [generatedContent, setGeneratedContent] = useState<string>("");
	const [editedContent, setEditedContent] = useState<string>("");
	const [isEditing, setIsEditing] = useState(false);
	const [history, setHistory] = useState<GeneratedNarrative[]>([]);
	const [copied, setCopied] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	// Get current content (edited or generated)
	const currentContent = isEditing ? editedContent : generatedContent;
	const wordCount = currentContent.trim().split(/\s+/).filter(Boolean).length;

	// Generate narrative
	const handleGenerate = useCallback(async () => {
		try {
			const content = await onGenerate(activeType, options);
			setGeneratedContent(content);
			setEditedContent(content);
			setIsEditing(false);

			// Add to history
			setHistory((prev) => [
				{
					type: activeType,
					content,
					generatedAt: new Date(),
					options: { ...options },
					wordCount: content.trim().split(/\s+/).filter(Boolean).length,
				},
				...prev.slice(0, 9), // Keep last 10
			]);
		} catch (error) {
			console.error("Generation failed:", error);
		}
	}, [activeType, options, onGenerate]);

	// Copy to clipboard
	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(currentContent);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [currentContent]);

	// Save narrative
	const handleSave = useCallback(async () => {
		if (!onSave) return;
		setIsSaving(true);
		try {
			await onSave(activeType, currentContent);
		} finally {
			setIsSaving(false);
		}
	}, [activeType, currentContent, onSave]);

	// Restore from history
	const handleRestore = useCallback((narrative: GeneratedNarrative) => {
		setGeneratedContent(narrative.content);
		setEditedContent(narrative.content);
		setActiveType(narrative.type);
		setIsEditing(false);
	}, []);

	// Regenerate
	const handleRegenerate = useCallback(() => {
		handleGenerate();
	}, [handleGenerate]);

	const activeNarrativeType = NARRATIVE_TYPES.find((t) => t.id === activeType);
	const Icon = activeNarrativeType?.icon || FileText;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Wand2 className="h-5 w-5" />
								AI Narrative Generator
							</CardTitle>
							<CardDescription>
								Generate proposal-ready narratives for "{project.name}"
								{opportunityTitle && ` targeting "${opportunityTitle}"`}
							</CardDescription>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowOptions(!showOptions)}
						>
							<Settings className="h-4 w-4 mr-1" />
							Options
						</Button>
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Narrative Type Selection */}
					<Tabs value={activeType} onValueChange={setActiveType}>
						<TabsList className="grid w-full grid-cols-5">
							{NARRATIVE_TYPES.map((type) => {
								const TypeIcon = type.icon;
								return (
									<TabsTrigger
										key={type.id}
										value={type.id}
										className="gap-1 text-xs"
									>
										<TypeIcon className="h-4 w-4" />
										<span className="hidden md:inline">{type.label}</span>
									</TabsTrigger>
								);
							})}
						</TabsList>

						{NARRATIVE_TYPES.map((type) => (
							<TabsContent key={type.id} value={type.id} className="mt-4">
								<div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
									<MessageSquare className="h-4 w-4" />
									{type.description}
								</div>
							</TabsContent>
						))}
					</Tabs>

					{/* Generation Options */}
					{showOptions && (
						<GenerationOptionsPanel
							options={options}
							onChange={setOptions}
						/>
					)}

					{/* Generate Button */}
					<div className="flex items-center gap-2">
						<Button
							onClick={handleGenerate}
							disabled={isGenerating}
							className="flex-1"
						>
							{isGenerating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<Sparkles className="h-4 w-4 mr-2" />
									Generate {activeNarrativeType?.label}
								</>
							)}
						</Button>
						{generatedContent && (
							<Button variant="outline" onClick={handleRegenerate} disabled={isGenerating}>
								<RefreshCw className="h-4 w-4" />
							</Button>
						)}
					</div>

					{/* Generated Content */}
					{currentContent && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Icon className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm font-medium">
										{activeNarrativeType?.label}
									</span>
									{isEditing && (
										<Badge variant="secondary" className="text-xs">
											Editing
										</Badge>
									)}
								</div>
								<div className="flex items-center gap-2">
									<WordCount count={wordCount} />
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											if (isEditing) {
												setIsEditing(false);
											} else {
												setEditedContent(generatedContent);
												setIsEditing(true);
											}
										}}
									>
										<Edit className="h-4 w-4" />
									</Button>
								</div>
							</div>

							<Textarea
								value={currentContent}
								onChange={(e) => setEditedContent(e.target.value)}
								readOnly={!isEditing}
								rows={12}
								className={!isEditing ? "bg-muted/50" : ""}
							/>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Button variant="outline" size="sm" onClick={handleCopy}>
										{copied ? (
											<>
												<Check className="h-4 w-4 mr-1" />
												Copied
											</>
										) : (
											<>
												<Copy className="h-4 w-4 mr-1" />
												Copy
											</>
										)}
									</Button>
									<Button variant="outline" size="sm">
										<Download className="h-4 w-4 mr-1" />
										Export
									</Button>
								</div>
								{onSave && (
									<Button onClick={handleSave} disabled={isSaving}>
										{isSaving ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Saving...
											</>
										) : (
											<>
												<Check className="h-4 w-4 mr-2" />
												Save to Project
											</>
										)}
									</Button>
								)}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* History */}
			{history.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<History className="h-4 w-4" />
							Generation History
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{history.slice(0, 5).map((narrative, index) => (
								<NarrativeHistoryItem
									key={index}
									narrative={narrative}
									onRestore={() => handleRestore(narrative)}
								/>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Tips */}
			<Card>
				<CardContent className="p-4">
					<div className="flex items-start gap-3">
						<Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
						<div className="text-sm">
							<p className="font-medium mb-1">Tips for Better Narratives</p>
							<ul className="text-muted-foreground space-y-1">
								<li>• Ensure project has detailed CPAR ratings and quantified results</li>
								<li>• Add key accomplishments and challenges overcome</li>
								<li>• Link to specific opportunity requirements for relevance statements</li>
								<li>• Review and edit generated content to match your voice</li>
							</ul>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default NarrativeGenerator;
