/**
 * Template preview component for DocFusion.
 *
 * Displays a read-only preview of template content with
 * placeholder highlighting and structure visualization.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
	Template,
	TemplatePlaceholder,
	TemplateAIInstruction,
	TemplateComplianceRequirement,
	TemplateCategory,
} from "@/lib/types/template";
import type { DocumentBlock } from "@/lib/types/document";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	FileText,
	Variable,
	Sparkles,
	Shield,
	Clock,
	Star,
	Users,
	Tag,
	ChevronRight,
	AlertCircle,
	CheckCircle2,
	Info,
	type LucideIcon,
} from "lucide-react";

/**
 * Props for TemplatePreview component.
 */
export interface TemplatePreviewProps {
	/** Template to preview */
	template: Template;
	/** Resolved categories */
	categories?: TemplateCategory[];
	/** Whether to show the full structure or compact version */
	variant?: "full" | "compact" | "content-only";
	/** Whether to highlight placeholders */
	highlightPlaceholders?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Template preview component.
 */
export function TemplatePreview({
	template,
	categories,
	variant = "full",
	highlightPlaceholders = true,
	className,
}: TemplatePreviewProps) {
	if (variant === "content-only") {
		return (
			<ContentPreview
				content={template.content}
				placeholders={template.placeholders}
				highlightPlaceholders={highlightPlaceholders}
				className={className}
			/>
		);
	}

	if (variant === "compact") {
		return (
			<CompactPreview
				template={template}
				className={className}
			/>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header info */}
			<TemplateHeader template={template} categories={categories} />

			{/* Main content preview */}
			<Card>
				<CardHeader className="border-b border-gray-100 dark:border-gray-800">
					<div className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-gray-500" />
						<h3 className="font-semibold text-gray-900 dark:text-white">
							Content Preview
						</h3>
					</div>
				</CardHeader>
				<CardContent className="p-6">
					<ContentPreview
						content={template.content}
						placeholders={template.placeholders}
						highlightPlaceholders={highlightPlaceholders}
					/>
				</CardContent>
			</Card>

			{/* Placeholders section */}
			{template.placeholders.length > 0 && (
				<PlaceholdersSection placeholders={template.placeholders} />
			)}

			{/* AI Instructions section */}
			{template.aiInstructions.length > 0 && (
				<AIInstructionsSection instructions={template.aiInstructions} />
			)}

			{/* Compliance Requirements section */}
			{template.complianceRequirements.length > 0 && (
				<ComplianceSection requirements={template.complianceRequirements} />
			)}
		</div>
	);
}

/**
 * Template header with metadata.
 */
function TemplateHeader({
	template,
	categories,
}: {
	template: Template;
	categories?: TemplateCategory[];
}) {
	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
					{template.name}
				</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">
					{template.description}
				</p>
			</div>

			{/* Metadata row */}
			<div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
				{/* Rating */}
				{template.rating !== undefined && (
					<div className="flex items-center gap-1">
						<Star className="h-4 w-4 text-amber-500 fill-amber-500" />
						<span>{template.rating.toFixed(1)}</span>
						{template.ratingCount && (
							<span className="text-gray-400">({template.ratingCount})</span>
						)}
					</div>
				)}

				{/* Use count */}
				<div className="flex items-center gap-1">
					<Users className="h-4 w-4" />
					<span>{template.useCount} uses</span>
				</div>

				{/* Estimated time */}
				{template.estimatedTime && (
					<div className="flex items-center gap-1">
						<Clock className="h-4 w-4" />
						<span>{formatTime(template.estimatedTime)}</span>
					</div>
				)}

				{/* Difficulty */}
				{template.difficulty && (
					<DifficultyBadge difficulty={template.difficulty} />
				)}
			</div>

			{/* Categories */}
			{categories && categories.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					{categories.map((category) => (
						<span
							key={category.id}
							className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
						>
							{category.name}
						</span>
					))}
				</div>
			)}

			{/* Tags */}
			{template.tags.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					<Tag className="h-4 w-4 text-gray-400" />
					{template.tags.map((tag) => (
						<span
							key={tag}
							className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Content preview with block rendering.
 */
function ContentPreview({
	content,
	placeholders,
	highlightPlaceholders,
	className,
}: {
	content: Template["content"];
	placeholders: TemplatePlaceholder[];
	highlightPlaceholders: boolean;
	className?: string;
}) {
	// Get content blocks from JSONContent structure
	const blocks = (content?.content ?? []) as DocumentBlock[];
	// Create a map of placeholder variable names to placeholders
	const placeholderMap = React.useMemo(() => {
		const map = new Map<string, TemplatePlaceholder>();
		for (const p of placeholders) {
			map.set(p.variableName, p);
		}
		return map;
	}, [placeholders]);

	// Render text with placeholder highlighting
	const renderTextWithPlaceholders = (text: string): React.ReactNode => {
		if (!highlightPlaceholders) return text;

		// Match {{placeholder_name}} patterns
		const parts = text.split(/(\{\{[^}]+\}\})/g);

		return parts.map((part, index) => {
			const match = part.match(/\{\{([^}]+)\}\}/);
			if (match) {
				const varName = match[1];
				const placeholder = placeholderMap.get(varName);

				return (
					<Tooltip key={index}>
						<TooltipTrigger asChild>
							<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-mono cursor-help">
								<Variable className="h-3 w-3" />
								{placeholder?.name ?? varName}
							</span>
						</TooltipTrigger>
						<TooltipContent className="max-w-xs">
							<div className="space-y-1">
								<p className="font-medium">{placeholder?.name ?? varName}</p>
								{placeholder?.description && (
									<p className="text-xs text-gray-400">
										{placeholder.description}
									</p>
								)}
								<p className="text-xs">
									Type: {placeholder?.type ?? "text"}
									{placeholder?.required && " (required)"}
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				);
			}
			return <span key={index}>{part}</span>;
		});
	};

	return (
		<div className={cn("prose prose-gray dark:prose-invert max-w-none", className)}>
			{blocks.map((block, index) => (
				<BlockPreview
					key={block.id ?? `block-${index}`}
					block={block}
					renderText={renderTextWithPlaceholders}
				/>
			))}
		</div>
	);
}

/**
 * Get text content from a block, handling nested structures.
 */
function getBlockText(block: DocumentBlock): string {
	if (block.text) return block.text;
	if (typeof block.content === "string") return block.content;
	if (Array.isArray(block.content)) {
		return block.content.map(getBlockText).join("");
	}
	return "";
}

/**
 * Block preview component.
 */
function BlockPreview({
	block,
	renderText,
}: {
	block: DocumentBlock;
	renderText: (text: string) => React.ReactNode;
}) {
	const textContent = getBlockText(block);

	switch (block.type) {
		case "paragraph":
			return (
				<p className="mb-4">
					{renderText(textContent)}
				</p>
			);

		case "heading": {
			const level = (block.attrs?.level as number) ?? 1;
			const headingClasses = "font-bold text-gray-900 dark:text-white mb-3";
			// Use explicit heading elements to avoid JSX type issues
			if (level === 1) return <h1 className={headingClasses}>{renderText(textContent)}</h1>;
			if (level === 2) return <h2 className={headingClasses}>{renderText(textContent)}</h2>;
			if (level === 3) return <h3 className={headingClasses}>{renderText(textContent)}</h3>;
			if (level === 4) return <h4 className={headingClasses}>{renderText(textContent)}</h4>;
			if (level === 5) return <h5 className={headingClasses}>{renderText(textContent)}</h5>;
			return <h6 className={headingClasses}>{renderText(textContent)}</h6>;
		}

		case "bulletList":
		case "orderedList": {
			const listClasses = cn("mb-4 pl-5", block.type === "bulletList" ? "list-disc" : "list-decimal");
			const items = (block.content as DocumentBlock[]) ?? [];
			const ListContent = items.map((item, idx) => (
				<li key={item.id ?? `item-${idx}`} className="mb-1">
					{getBlockText(item) ? renderText(getBlockText(item)) : (
						(item.content as DocumentBlock[])?.map((child, cidx) => (
							<BlockPreview
								key={child.id ?? `child-${cidx}`}
								block={child}
								renderText={renderText}
							/>
						))
					)}
				</li>
			));

			return block.type === "bulletList" ? (
				<ul className={listClasses}>{ListContent}</ul>
			) : (
				<ol className={listClasses}>{ListContent}</ol>
			);
		}

		case "blockquote": {
			const quoteContent = textContent || (block.content as DocumentBlock[])?.map((child, idx) => (
				<BlockPreview
					key={child.id ?? `quote-${idx}`}
					block={child}
					renderText={renderText}
				/>
			));
			return (
				<blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4">
					{typeof quoteContent === "string" ? renderText(quoteContent) : quoteContent}
				</blockquote>
			);
		}

		case "codeBlock":
			return (
				<pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4">
					<code className="text-sm font-mono">
						{textContent}
					</code>
				</pre>
			);

		case "horizontalRule":
			return <hr className="my-6 border-gray-200 dark:border-gray-700" />;

		case "table":
			return (
				<div className="overflow-x-auto mb-4">
					<table className="min-w-full border border-gray-200 dark:border-gray-700">
						{/* Table rendering would need more block structure info */}
						<tbody>
							<tr>
								<td className="p-2 border border-gray-200 dark:border-gray-700">
									{textContent ? renderText(textContent) : "[Table content]"}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			);

		default:
			if (textContent) {
				return <p className="mb-4">{renderText(textContent)}</p>;
			}
			return null;
	}
}

/**
 * Placeholders section.
 */
function PlaceholdersSection({
	placeholders,
}: {
	placeholders: TemplatePlaceholder[];
}) {
	return (
		<Card>
			<CardHeader className="border-b border-gray-100 dark:border-gray-800">
				<div className="flex items-center gap-2">
					<Variable className="h-5 w-5 text-purple-500" />
					<h3 className="font-semibold text-gray-900 dark:text-white">
						Placeholders
					</h3>
					<span className="text-sm text-gray-500">
						({placeholders.length})
					</span>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<div className="divide-y divide-gray-100 dark:divide-gray-800">
					{placeholders.map((placeholder) => (
						<div
							key={placeholder.id}
							className="p-4 flex items-start gap-4"
						>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-900 dark:text-white">
										{placeholder.name}
									</span>
									{placeholder.required && (
										<span className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
											Required
										</span>
									)}
									{placeholder.aiPrompt && (
										<Tooltip>
											<TooltipTrigger>
												<Sparkles className="h-4 w-4 text-blue-500" />
											</TooltipTrigger>
											<TooltipContent>
												AI-assisted: {placeholder.aiPrompt}
											</TooltipContent>
										</Tooltip>
									)}
								</div>
								{placeholder.description && (
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
										{placeholder.description}
									</p>
								)}
								<div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
									<span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
										{`{{${placeholder.variableName}}}`}
									</span>
									<span>Type: {placeholder.type}</span>
									{placeholder.defaultValue && (
										<span>Default: {placeholder.defaultValue}</span>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * AI Instructions section.
 */
function AIInstructionsSection({
	instructions,
}: {
	instructions: TemplateAIInstruction[];
}) {
	return (
		<Card>
			<CardHeader className="border-b border-gray-100 dark:border-gray-800">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-blue-500" />
					<h3 className="font-semibold text-gray-900 dark:text-white">
						AI Instructions
					</h3>
					<span className="text-sm text-gray-500">
						({instructions.length})
					</span>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<div className="divide-y divide-gray-100 dark:divide-gray-800">
					{instructions.map((instruction, index) => (
						<div key={index} className="p-4">
							<p className="text-gray-700 dark:text-gray-300">
								{instruction.prompt}
							</p>
							<div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
								{instruction.tone && (
									<span className="capitalize">Tone: {instruction.tone}</span>
								)}
								{instruction.maxLength && (
									<span>Max length: {instruction.maxLength} chars</span>
								)}
								{instruction.targetId && (
									<span>Target: {instruction.targetId}</span>
								)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Compliance requirements section.
 */
function ComplianceSection({
	requirements,
}: {
	requirements: TemplateComplianceRequirement[];
}) {
	return (
		<Card>
			<CardHeader className="border-b border-gray-100 dark:border-gray-800">
				<div className="flex items-center gap-2">
					<Shield className="h-5 w-5 text-green-500" />
					<h3 className="font-semibold text-gray-900 dark:text-white">
						Compliance Requirements
					</h3>
					<span className="text-sm text-gray-500">
						({requirements.length})
					</span>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<div className="divide-y divide-gray-100 dark:divide-gray-800">
					{requirements.map((req) => (
						<div key={req.id} className="p-4 flex items-start gap-3">
							<div
								className={cn(
									"flex-shrink-0 mt-0.5",
									req.mandatory ? "text-red-500" : "text-amber-500"
								)}
							>
								{req.mandatory ? (
									<AlertCircle className="h-5 w-5" />
								) : (
									<Info className="h-5 w-5" />
								)}
							</div>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-900 dark:text-white">
										{req.framework}
									</span>
									<span className="text-gray-500">·</span>
									<span className="text-gray-600 dark:text-gray-400">
										{req.clause}
									</span>
									{req.mandatory && (
										<span className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
											Mandatory
										</span>
									)}
								</div>
								<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
									{req.description}
								</p>
								{req.criteria && (
									<p className="text-xs text-gray-400 mt-2">
										Criteria: {req.criteria}
									</p>
								)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Compact preview component.
 */
function CompactPreview({
	template,
	className,
}: {
	template: Template;
	className?: string;
}) {
	// Get content blocks from JSONContent structure
	const blocks = (template.content?.content ?? []) as DocumentBlock[];

	return (
		<div className={cn("space-y-4", className)}>
			{/* Quick stats */}
			<div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
				<div className="flex items-center gap-1">
					<Variable className="h-4 w-4 text-purple-500" />
					<span>{template.placeholders.length} placeholders</span>
				</div>
				{template.aiInstructions.length > 0 && (
					<div className="flex items-center gap-1">
						<Sparkles className="h-4 w-4 text-blue-500" />
						<span>{template.aiInstructions.length} AI prompts</span>
					</div>
				)}
				{template.complianceRequirements.length > 0 && (
					<div className="flex items-center gap-1">
						<Shield className="h-4 w-4 text-green-500" />
						<span>{template.complianceRequirements.length} compliance</span>
					</div>
				)}
			</div>

			{/* Structure preview */}
			<div className="space-y-2">
				{blocks.slice(0, 5).map((block, index) => (
					<BlockStructurePreview key={block.id ?? `block-${index}`} block={block} />
				))}
				{blocks.length > 5 && (
					<p className="text-sm text-gray-400 italic">
						+{blocks.length - 5} more blocks
					</p>
				)}
			</div>
		</div>
	);
}

/**
 * Block structure preview (outline view).
 */
function BlockStructurePreview({ block }: { block: DocumentBlock }) {
	const blockIcons: Record<string, LucideIcon> = {
		heading: FileText,
		paragraph: FileText,
		bulletList: FileText,
		orderedList: FileText,
		blockquote: FileText,
		codeBlock: FileText,
		table: FileText,
	};

	const Icon = blockIcons[block.type] ?? FileText;
	const label =
		block.type === "heading"
			? `H${block.attrs?.level ?? 1}`
			: block.type.replace(/([A-Z])/g, " $1").trim();

	// Extract preview text from block
	const getPreviewText = (): string => {
		// Text nodes have the `text` property
		if (block.text) {
			return block.text.slice(0, 50) + (block.text.length > 50 ? "..." : "");
		}
		// Container nodes have `content` array
		if (block.content && block.content.length > 0) {
			return `${block.content.length} items`;
		}
		return "";
	};

	return (
		<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
			<Icon className="h-4 w-4 flex-shrink-0" />
			<span className="capitalize">{label}</span>
			<ChevronRight className="h-3 w-3 text-gray-400" />
			<span className="truncate text-gray-400">{getPreviewText()}</span>
		</div>
	);
}

/**
 * Difficulty badge component.
 */
function DifficultyBadge({
	difficulty,
}: {
	difficulty: "beginner" | "intermediate" | "advanced";
}) {
	const colors = {
		beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
		advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	};

	return (
		<span
			className={cn(
				"px-2 py-0.5 rounded-full text-xs font-medium capitalize",
				colors[difficulty]
			)}
		>
			{difficulty}
		</span>
	);
}

/**
 * Format time in minutes to human-readable string.
 */
function formatTime(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
