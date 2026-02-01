/**
 * TOCGenerator Component
 *
 * Generates table of contents with configurable depth,
 * preview, and insertion capability.
 */

"use client";

import * as React from "react";
import {
	List,
	ListTree,
	ChevronRight,
	ChevronDown,
	RefreshCw,
	Plus,
	Settings2,
	Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type {
	TOCEntry,
	TOCConfig,
	HeadingLevel,
} from "@/lib/types/formatting";
import { useTOCGenerator } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface TOCGeneratorProps {
	/** Document ID to generate TOC for */
	documentId: string;
	/** Callback when TOC is inserted */
	onInsert?: (entries: TOCEntry[]) => void;
	/** Initial configuration */
	initialConfig?: Partial<TOCConfig>;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: TOCConfig = {
	includeLevels: [1, 2, 3],
	includeFigures: false,
	includeTables: false,
	includeAcronyms: false,
	showSectionNumbers: true,
	leaderStyle: "dots",
	title: "Table of Contents",
};

const LEADER_STYLES: { value: TOCConfig["leaderStyle"]; label: string }[] = [
	{ value: "dots", label: "Dots (...)" },
	{ value: "dashes", label: "Dashes (---)" },
	{ value: "underline", label: "Underline (___)" },
	{ value: "none", label: "None" },
];

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Single TOC entry with hierarchy.
 */
interface TOCEntryItemProps {
	entry: TOCEntry;
	leaderStyle: TOCConfig["leaderStyle"];
	depth?: number;
}

function TOCEntryItem({ entry, leaderStyle, depth = 0 }: TOCEntryItemProps) {
	const [isExpanded, setIsExpanded] = React.useState(true);
	const hasChildren = entry.children && entry.children.length > 0;
	const indent = depth * 16;

	const getLeaderClass = () => {
		switch (leaderStyle) {
			case "dots":
				return "border-b border-dotted border-muted-foreground/50";
			case "dashes":
				return "border-b border-dashed border-muted-foreground/50";
			case "underline":
				return "border-b border-muted-foreground/30";
			default:
				return "";
		}
	};

	return (
		<div>
			<div
				className="flex items-center gap-2 py-1.5 group hover:bg-accent/30 rounded px-2 -mx-2"
				style={{ paddingLeft: `${indent + 8}px` }}
			>
				{hasChildren && (
					<button
						onClick={() => setIsExpanded(!isExpanded)}
						className="p-0.5 hover:bg-accent rounded"
					>
						{isExpanded ? (
							<ChevronDown className="h-3 w-3 text-muted-foreground" />
						) : (
							<ChevronRight className="h-3 w-3 text-muted-foreground" />
						)}
					</button>
				)}
				{!hasChildren && <span className="w-4" />}

				{entry.sectionNumber && (
					<span className="text-sm font-mono text-muted-foreground min-w-[3rem]">
						{entry.sectionNumber}
					</span>
				)}

				<span className="flex-1 text-sm truncate" title={entry.text}>
					{entry.text}
				</span>

				<div className={cn("flex-1 mx-2 h-4", getLeaderClass())} />

				<span className="text-sm text-muted-foreground tabular-nums">
					{entry.page}
				</span>
			</div>

			{hasChildren && isExpanded && (
				<div>
					{entry.children!.map((child) => (
						<TOCEntryItem
							key={child.id}
							entry={child}
							leaderStyle={leaderStyle}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Heading level selector.
 */
interface HeadingLevelSelectorProps {
	value: HeadingLevel[];
	onChange: (levels: HeadingLevel[]) => void;
}

function HeadingLevelSelector({ value, onChange }: HeadingLevelSelectorProps) {
	const toggleLevel = (level: HeadingLevel) => {
		if (value.includes(level)) {
			onChange(value.filter((l) => l !== level));
		} else {
			onChange([...value, level].sort());
		}
	};

	return (
		<div className="flex gap-2">
			{([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((level) => (
				<button
					key={level}
					onClick={() => toggleLevel(level)}
					className={cn(
						"h-8 w-8 rounded border text-sm font-medium transition-colors",
						value.includes(level)
							? "bg-primary text-primary-foreground border-primary"
							: "bg-background text-muted-foreground border-border hover:border-primary"
					)}
				>
					H{level}
				</button>
			))}
		</div>
	);
}

/**
 * Loading skeleton.
 */
function GeneratorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-56 mt-1" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-8 w-full" />
				</div>
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-8" />
					))}
				</div>
				<Skeleton className="h-10 w-24" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function TOCGenerator({
	documentId,
	onInsert,
	initialConfig,
	className,
}: TOCGeneratorProps) {
	// Use hook for TOC generation
	const { entries, isGenerating, error, generate } = useTOCGenerator(documentId);

	// Local state
	const [config, setConfig] = React.useState<TOCConfig>({
		...DEFAULT_CONFIG,
		...initialConfig,
	});
	const [isInserting, setIsInserting] = React.useState(false);
	const [showSettings, setShowSettings] = React.useState(false);
	const [hasGenerated, setHasGenerated] = React.useState(false);

	// Generate TOC with config
	const handleGenerate = React.useCallback(async () => {
		await generate(config);
		setHasGenerated(true);
	}, [generate, config]);

	// Handle insert
	const handleInsert = React.useCallback(async () => {
		if (entries.length === 0) return;

		setIsInserting(true);
		// In a real implementation, this would insert the TOC into the document
		await new Promise((resolve) => setTimeout(resolve, 500));
		onInsert?.(entries);
		setIsInserting(false);
	}, [entries, onInsert]);

	// Update config helper
	const updateConfig = <K extends keyof TOCConfig>(
		key: K,
		value: TOCConfig[K]
	) => {
		setConfig((prev) => ({ ...prev, [key]: value }));
	};

	// Count total entries
	const countEntries = (items: TOCEntry[]): number => {
		return items.reduce((sum, item) => {
			return sum + 1 + (item.children ? countEntries(item.children) : 0);
		}, 0);
	};

	const totalEntries = countEntries(entries);

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<ListTree className="h-5 w-5" />
						Table of Contents
					</CardTitle>
					<CardDescription>
						Generate and insert table of contents
					</CardDescription>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setShowSettings(!showSettings)}
				>
					<Settings2
						className={cn(
							"h-4 w-4 transition-transform",
							showSettings && "rotate-90"
						)}
					/>
				</Button>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Settings Panel */}
				<Collapsible open={showSettings} onOpenChange={setShowSettings}>
					<CollapsibleContent>
						<div className="space-y-4 pb-4 border-b">
							{/* Heading Levels */}
							<div className="space-y-2">
								<Label className="text-sm font-medium">
									Include Heading Levels
								</Label>
								<HeadingLevelSelector
									value={config.includeLevels}
									onChange={(levels) => updateConfig("includeLevels", levels)}
								/>
							</div>

							{/* Additional Elements */}
							<div className="space-y-3">
								<Label className="text-sm font-medium">
									Include Additional Elements
								</Label>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label
											htmlFor="include-figures"
											className="text-sm text-muted-foreground"
										>
											Figures
										</Label>
										<Switch
											id="include-figures"
											checked={config.includeFigures}
											onCheckedChange={(v) => updateConfig("includeFigures", v)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label
											htmlFor="include-tables"
											className="text-sm text-muted-foreground"
										>
											Tables
										</Label>
										<Switch
											id="include-tables"
											checked={config.includeTables}
											onCheckedChange={(v) => updateConfig("includeTables", v)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label
											htmlFor="include-acronyms"
											className="text-sm text-muted-foreground"
										>
											Acronyms
										</Label>
										<Switch
											id="include-acronyms"
											checked={config.includeAcronyms}
											onCheckedChange={(v) => updateConfig("includeAcronyms", v)}
										/>
									</div>
								</div>
							</div>

							{/* Section Numbers */}
							<div className="flex items-center justify-between">
								<Label
									htmlFor="show-numbers"
									className="text-sm font-medium"
								>
									Show Section Numbers
								</Label>
								<Switch
									id="show-numbers"
									checked={config.showSectionNumbers}
									onCheckedChange={(v) =>
										updateConfig("showSectionNumbers", v)
									}
								/>
							</div>

							{/* Leader Style */}
							<div className="space-y-2">
								<Label className="text-sm font-medium">Leader Style</Label>
								<Select
									value={config.leaderStyle}
									onValueChange={(v) =>
										updateConfig(
											"leaderStyle",
											v as TOCConfig["leaderStyle"]
										)
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{LEADER_STYLES.map((style) => (
											<SelectItem key={style.value} value={style.value}>
												{style.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>

				{/* Generate Button */}
				<Button
					onClick={handleGenerate}
					disabled={isGenerating || config.includeLevels.length === 0}
					className="w-full"
					variant={hasGenerated ? "outline" : "secondary"}
				>
					{isGenerating ? (
						<>
							<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
							Generating...
						</>
					) : hasGenerated ? (
						<>
							<RefreshCw className="h-4 w-4 mr-2" />
							Regenerate
						</>
					) : (
						<>
							<Eye className="h-4 w-4 mr-2" />
							Generate Preview
						</>
					)}
				</Button>

				{/* Preview */}
				{entries.length > 0 && (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Preview</span>
							<Badge variant="secondary">
								{totalEntries} entries
							</Badge>
						</div>

						<div className="border rounded-lg p-4 bg-muted/30 max-h-[400px] overflow-y-auto">
							{/* TOC Title */}
							{config.title && (
								<h3 className="font-bold text-lg mb-4 text-center">
									{config.title}
								</h3>
							)}

							{/* Entries */}
							<div className="space-y-0.5">
								{entries.map((entry) => (
									<TOCEntryItem
										key={entry.id}
										entry={entry}
										leaderStyle={config.leaderStyle}
									/>
								))}
							</div>
						</div>

						{/* Insert Button */}
						<Button
							onClick={handleInsert}
							disabled={isInserting}
							className="w-full"
						>
							{isInserting ? (
								<>
									<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									Inserting...
								</>
							) : (
								<>
									<Plus className="h-4 w-4 mr-2" />
									Insert into Document
								</>
							)}
						</Button>
					</div>
				)}

				{/* Empty State */}
				{hasGenerated && entries.length === 0 && (
					<div className="text-center py-8 text-muted-foreground">
						<List className="h-10 w-10 mx-auto mb-3 opacity-50" />
						<p className="text-sm">
							No headings found matching the selected levels.
						</p>
						<p className="text-xs mt-1">
							Try including more heading levels.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default TOCGenerator;
