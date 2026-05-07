/**
 * ThemeReinforcementGenerator - Generate Reinforcement Text
 *
 * Generates contextually appropriate text to reinforce themes in
 * specific sections with multiple phrasing options.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Wand2,
	RefreshCw,
	Copy,
	Check,
	ChevronDown,
	AlertCircle,
	Loader2,
	Target,
	FileText,
	Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type {
	ReinforcementText,
	WinTheme,
	GenerateReinforcementInput,
} from "@/lib/types/win-themes";
import {
	generateReinforcementText,
	getThemes,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeReinforcementGeneratorProps {
	/** Pre-selected section ID */
	sectionId?: string;
	/** Pre-selected theme ID */
	themeId?: string;
	/** Opportunity ID for loading themes */
	opportunityId: string;
	/** Available sections */
	sections?: { id: string; name: string }[];
	/** Callback when text is inserted */
	onInsert?: (text: string) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TONE_OPTIONS: {
	value: ReinforcementText["options"][0]["tone"];
	label: string;
	description: string;
}[] = [
	{
		value: "assertive",
		label: "Assertive",
		description: "Confident and direct language",
	},
	{
		value: "professional",
		label: "Professional",
		description: "Formal and business-appropriate",
	},
	{
		value: "technical",
		label: "Technical",
		description: "Detailed and specification-focused",
	},
	{
		value: "persuasive",
		label: "Persuasive",
		description: "Compelling and benefit-focused",
	},
];

// =============================================================================
// Loading Skeleton
// =============================================================================

function GeneratorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<Skeleton className="h-10" />
					<Skeleton className="h-10" />
				</div>
				<div className="grid grid-cols-2 gap-4">
					<Skeleton className="h-10" />
					<Skeleton className="h-10" />
				</div>
				<Skeleton className="h-10" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Reinforcement Option Card
// =============================================================================

interface OptionCardProps {
	option: ReinforcementText["options"][0];
	index: number;
	isSelected: boolean;
	onSelect: () => void;
	onCopy: () => void;
	isCopied: boolean;
}

function OptionCard({
	option,
	index,
	isSelected,
	onSelect,
	onCopy,
	isCopied,
}: OptionCardProps) {
	const toneConfig = TONE_OPTIONS.find((t) => t.value === option.tone);

	return (
		<div
			className={cn(
				"p-4 border rounded-lg cursor-pointer transition-all",
				isSelected
					? "border-primary bg-primary/5 ring-2 ring-primary/20"
					: "hover:border-muted-foreground/50"
			)}
			onClick={onSelect}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
			<div className="flex items-start justify-between mb-2">
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="text-xs">
						Option {index + 1}
					</Badge>
					<Badge variant="secondary" className="text-xs">
						{toneConfig?.label || option.tone}
					</Badge>
					<span className="text-xs text-muted-foreground">
						{option.wordCount} words
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={(e) => {
						e.stopPropagation();
						onCopy();
					}}
				>
					{isCopied ? (
						<Check className="h-4 w-4 text-green-600" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</Button>
			</div>
			<p className="text-sm">{option.text}</p>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeReinforcementGenerator({
	sectionId: initialSectionId,
	themeId: initialThemeId,
	opportunityId,
	sections = [],
	onInsert,
	className,
}: ThemeReinforcementGeneratorProps) {
	// State
	const [themes, setThemes] = useState<WinTheme[]>([]);
	const [selectedThemeId, setSelectedThemeId] = useState(initialThemeId || "");
	const [selectedSectionId, setSelectedSectionId] = useState(initialSectionId || "");
	const [tone, setTone] = useState<ReinforcementText["options"][0]["tone"]>("professional");
	const [wordCount, setWordCount] = useState(50);
	const [optionCount, setOptionCount] = useState(3);

	const [isLoadingThemes, setIsLoadingThemes] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [result, setResult] = useState<ReinforcementText | null>(null);
	const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

	// Load themes
	useEffect(() => {
		async function loadThemes() {
			setIsLoadingThemes(true);
			const themesResult = await getThemes(opportunityId);
			if (themesResult.success && themesResult.data) {
				setThemes(themesResult.data.filter((t) => t.status === "active"));
			}
			setIsLoadingThemes(false);
		}
		loadThemes();
	}, [opportunityId]);

	// Update selected theme when initial prop changes
	useEffect(() => {
		if (initialThemeId) setSelectedThemeId(initialThemeId);
	}, [initialThemeId]);

	// Update selected section when initial prop changes
	useEffect(() => {
		if (initialSectionId) setSelectedSectionId(initialSectionId);
	}, [initialSectionId]);

	// Generate reinforcement
	const handleGenerate = useCallback(async () => {
		if (!selectedThemeId || !selectedSectionId) {
			setError("Please select a theme and section");
			return;
		}

		setIsGenerating(true);
		setError(null);
		setResult(null);

		try {
			const input: GenerateReinforcementInput = {
				themeId: selectedThemeId,
				sectionId: selectedSectionId,
				tone,
				targetWordCount: wordCount,
				optionCount,
			};

			const response = await generateReinforcementText(input);
			if (response.success && response.data) {
				setResult(response.data);
				setSelectedOptionIndex(0);
			} else {
				setError(response.error || "Failed to generate text");
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setIsGenerating(false);
		}
	}, [selectedThemeId, selectedSectionId, tone, wordCount, optionCount]);

	// Copy to clipboard
	const handleCopy = useCallback(async (text: string, index: number) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedIndex(index);
			setTimeout(() => setCopiedIndex(null), 2000);
		} catch {
			// Clipboard API failed
		}
	}, []);

	// Insert text
	const handleInsert = useCallback(() => {
		if (result && result.options[selectedOptionIndex]) {
			onInsert?.(result.options[selectedOptionIndex].text);
		}
	}, [result, selectedOptionIndex, onInsert]);

	// Get selected theme
	const selectedTheme = themes.find((t) => t.id === selectedThemeId);

	if (isLoadingThemes) {
		return <GeneratorSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-amber-500" />
					Generate Reinforcement Text
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Selection */}
				<div className="grid grid-cols-2 gap-4">
					{/* Theme Selector */}
					<div className="space-y-2">
						<Label className="flex items-center gap-1">
							<Target className="h-3 w-3" />
							Theme
						</Label>
						<Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
							<SelectTrigger>
								<SelectValue placeholder="Select theme..." />
							</SelectTrigger>
							<SelectContent>
								{themes.map((theme) => (
									<SelectItem key={theme.id} value={theme.id}>
										<span className="truncate">{theme.shortVersion}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedTheme && (
							<p className="text-xs text-muted-foreground line-clamp-2">
								{selectedTheme.statement}
							</p>
						)}
					</div>

					{/* Section Selector */}
					<div className="space-y-2">
						<Label className="flex items-center gap-1">
							<FileText className="h-3 w-3" />
							Target Section
						</Label>
						{sections.length > 0 ? (
							<Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
								<SelectTrigger>
									<SelectValue placeholder="Select section..." />
								</SelectTrigger>
								<SelectContent>
									{sections.map((section) => (
										<SelectItem key={section.id} value={section.id}>
											{section.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<input
								type="text"
								value={selectedSectionId}
								onChange={(e) => setSelectedSectionId(e.target.value)}
								placeholder="Enter section name..."
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							/>
						)}
					</div>
				</div>

				{/* Options */}
				<div className="grid grid-cols-2 gap-4">
					{/* Tone */}
					<div className="space-y-2">
						<Label>Tone</Label>
						<Select
							value={tone}
							onValueChange={(v) =>
								setTone(v as ReinforcementText["options"][0]["tone"])
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TONE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<div>
											<span>{option.label}</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							{TONE_OPTIONS.find((t) => t.value === tone)?.description}
						</p>
					</div>

					{/* Word Count */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label>Target Length</Label>
							<Badge variant="outline">{wordCount} words</Badge>
						</div>
						<Slider
							value={[wordCount]}
							min={25}
							max={150}
							step={25}
							onValueChange={([v]) => setWordCount(v)}
						/>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>Brief</span>
							<span>Detailed</span>
						</div>
					</div>
				</div>

				{/* Generate Button */}
				<Button
					onClick={handleGenerate}
					disabled={!selectedThemeId || !selectedSectionId || isGenerating}
					className="w-full"
				>
					{isGenerating ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Generating...
						</>
					) : (
						<>
							<Wand2 className="h-4 w-4 mr-2" />
							Generate Text
						</>
					)}
				</Button>

				{/* Results */}
				{result && (
					<>
						<Separator />

						{/* Placement Suggestion */}
						{result.placementSuggestion && (
							<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
								<span className="font-medium">Suggested Placement: </span>
								{result.placementSuggestion}
							</div>
						)}

						{/* Options */}
						<div className="space-y-3">
							<Label>Generated Options</Label>
							{result.options.map((option, index) => (
								<OptionCard
									key={index}
									option={option}
									index={index}
									isSelected={selectedOptionIndex === index}
									onSelect={() => setSelectedOptionIndex(index)}
									onCopy={() => handleCopy(option.text, index)}
									isCopied={copiedIndex === index}
								/>
							))}
						</div>

						{/* Actions */}
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
								<RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
								Regenerate
							</Button>
							{onInsert && (
								<Button onClick={handleInsert}>
									<Check className="h-4 w-4 mr-2" />
									Insert Selected
								</Button>
							)}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default ThemeReinforcementGenerator;
