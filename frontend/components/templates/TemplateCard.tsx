/**
 * Template preview card component for DocFusion.
 *
 * Displays a template summary with thumbnail, metadata,
 * and quick actions. Used in template gallery and search results.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { TemplateSummary, TemplateCategory } from "@/lib/types/template";
import { usePrefetchTemplate } from "@/lib/query/hooks/useTemplates";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Star,
	Users,
	Clock,
	FileText,
	ChevronRight,
	LayoutTemplate,
	Sparkles,
	Lock,
	Globe,
	Building2,
	User,
} from "lucide-react";

/**
 * Props for TemplateCard component.
 */
export interface TemplateCardProps {
	/** Template data to display */
	template: TemplateSummary;
	/** Resolved categories for display */
	categories?: TemplateCategory[];
	/** Whether to show the full card or compact version */
	variant?: "default" | "compact" | "horizontal";
	/** Additional CSS classes */
	className?: string;
	/** Callback when "Use" button is clicked */
	onUse?: (template: TemplateSummary) => void;
	/** Whether to show hover preview */
	showHoverPreview?: boolean;
}

/**
 * Visibility icon mapping.
 */
const visibilityIcons = {
	private: User,
	team: Users,
	organization: Building2,
	public: Globe,
} as const;

/**
 * Visibility label mapping.
 */
const visibilityLabels = {
	private: "Private",
	team: "Team",
	organization: "Organization",
	public: "Public",
} as const;

/**
 * Difficulty color mapping.
 */
const difficultyColors = {
	beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
} as const;

/**
 * Format estimated time for display.
 */
function formatEstimatedTime(minutes?: number): string {
	if (!minutes) return "";
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Template card component.
 */
export function TemplateCard({
	template,
	categories,
	variant = "default",
	className,
	onUse,
	showHoverPreview = true,
}: TemplateCardProps) {
	const prefetchTemplate = usePrefetchTemplate();
	const VisibilityIcon = visibilityIcons[template.visibility];

	// Prefetch template data on hover for faster navigation
	const handleMouseEnter = () => {
		if (showHoverPreview) {
			prefetchTemplate(template.id);
		}
	};

	// Handle use button click
	const handleUse = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onUse?.(template);
	};

	if (variant === "compact") {
		return (
			<CompactTemplateCard
				template={template}
				className={className}
				onUse={onUse}
				onMouseEnter={handleMouseEnter}
			/>
		);
	}

	if (variant === "horizontal") {
		return (
			<HorizontalTemplateCard
				template={template}
				categories={categories}
				className={className}
				onUse={onUse}
				onMouseEnter={handleMouseEnter}
			/>
		);
	}

	return (
		<Link href={`/templates/${template.id}`}>
			<Card
				className={cn(
					"group relative overflow-hidden transition-all duration-200",
					"hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800",
					"cursor-pointer",
					className
				)}
				onMouseEnter={handleMouseEnter}
			>
				{/* Preview Image */}
				<div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
					{template.previewImageUrl ? (
						<Image
							src={template.previewImageUrl}
							alt={template.name}
							fill
							className="object-cover transition-transform group-hover:scale-105"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<LayoutTemplate className="h-12 w-12 text-gray-300 dark:text-gray-600" />
						</div>
					)}

					{/* Visibility badge */}
					<div className="absolute top-2 left-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={cn(
										"flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
										"bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm",
										template.visibility === "private" && "text-gray-600 dark:text-gray-400"
									)}
								>
									<VisibilityIcon className="h-3 w-3" />
									<span className="sr-only md:not-sr-only">
										{visibilityLabels[template.visibility]}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent>
								{visibilityLabels[template.visibility]} template
							</TooltipContent>
						</Tooltip>
					</div>

					{/* Difficulty badge */}
					{template.difficulty && (
						<div className="absolute top-2 right-2">
							<span
								className={cn(
									"px-2 py-1 rounded-full text-xs font-medium capitalize",
									difficultyColors[template.difficulty]
								)}
							>
								{template.difficulty}
							</span>
						</div>
					)}

					{/* Quick use button on hover */}
					{onUse && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
							<Button
								size="sm"
								className="opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={handleUse}
							>
								<Sparkles className="h-4 w-4 mr-1" />
								Use Template
							</Button>
						</div>
					)}
				</div>

				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
							{template.name}
						</h3>
						<ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
					</div>
				</CardHeader>

				<CardContent className="pb-2">
					<p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
						{template.description}
					</p>

					{/* Tags */}
					{template.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-3">
							{template.tags.slice(0, 3).map((tag) => (
								<span
									key={tag}
									className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
								>
									{tag}
								</span>
							))}
							{template.tags.length > 3 && (
								<span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
									+{template.tags.length - 3}
								</span>
							)}
						</div>
					)}
				</CardContent>

				<CardFooter className="pt-2 border-t border-gray-100 dark:border-gray-800">
					<div className="flex items-center justify-between w-full text-xs text-gray-500 dark:text-gray-400">
						{/* Stats */}
						<div className="flex items-center gap-3">
							{/* Rating */}
							{template.rating !== undefined && template.ratingCount !== undefined && (
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1">
											<Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
											<span>{template.rating.toFixed(1)}</span>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										{template.rating.toFixed(1)} stars from {template.ratingCount} ratings
									</TooltipContent>
								</Tooltip>
							)}

							{/* Use count */}
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex items-center gap-1">
										<FileText className="h-3.5 w-3.5" />
										<span>{template.useCount}</span>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									Used {template.useCount} times
								</TooltipContent>
							</Tooltip>
						</div>

						{/* Estimated time */}
						{template.estimatedTime && (
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex items-center gap-1">
										<Clock className="h-3.5 w-3.5" />
										<span>{formatEstimatedTime(template.estimatedTime)}</span>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									Estimated completion time
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				</CardFooter>
			</Card>
		</Link>
	);
}

/**
 * Compact template card for sidebars and lists.
 */
function CompactTemplateCard({
	template,
	className,
	onUse,
	onMouseEnter,
}: {
	template: TemplateSummary;
	className?: string;
	onUse?: (template: TemplateSummary) => void;
	onMouseEnter: () => void;
}) {
	return (
		<Link href={`/templates/${template.id}`}>
			<div
				className={cn(
					"flex items-center gap-3 p-3 rounded-lg",
					"hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
					"cursor-pointer group",
					className
				)}
				onMouseEnter={onMouseEnter}
			>
				{/* Thumbnail */}
				<div className="relative h-12 w-16 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
					{template.previewImageUrl ? (
						<Image
							src={template.previewImageUrl}
							alt={template.name}
							fill
							className="object-cover"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<LayoutTemplate className="h-5 w-5 text-gray-300 dark:text-gray-600" />
						</div>
					)}
				</div>

				{/* Info */}
				<div className="flex-1 min-w-0">
					<h4 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
						{template.name}
					</h4>
					<div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						{template.rating !== undefined && (
							<span className="flex items-center gap-0.5">
								<Star className="h-3 w-3 text-amber-500 fill-amber-500" />
								{template.rating.toFixed(1)}
							</span>
						)}
						<span>{template.useCount} uses</span>
					</div>
				</div>

				{/* Use button */}
				{onUse && (
					<Button
						variant="ghost"
						size="sm"
						className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onUse(template);
						}}
					>
						Use
					</Button>
				)}
			</div>
		</Link>
	);
}

/**
 * Horizontal template card for list views.
 */
function HorizontalTemplateCard({
	template,
	categories,
	className,
	onUse,
	onMouseEnter,
}: {
	template: TemplateSummary;
	categories?: TemplateCategory[];
	className?: string;
	onUse?: (template: TemplateSummary) => void;
	onMouseEnter: () => void;
}) {
	const VisibilityIcon = visibilityIcons[template.visibility];

	return (
		<Link href={`/templates/${template.id}`}>
			<div
				className={cn(
					"flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800",
					"hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all",
					"cursor-pointer group",
					className
				)}
				onMouseEnter={onMouseEnter}
			>
				{/* Thumbnail */}
				<div className="relative h-24 w-32 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
					{template.previewImageUrl ? (
						<Image
							src={template.previewImageUrl}
							alt={template.name}
							fill
							className="object-cover"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<LayoutTemplate className="h-8 w-8 text-gray-300 dark:text-gray-600" />
						</div>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
								{template.name}
							</h3>
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
								{template.description}
							</p>
						</div>

						{/* Actions */}
						{onUse && (
							<Button
								size="sm"
								className="flex-shrink-0"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onUse(template);
								}}
							>
								<Sparkles className="h-4 w-4 mr-1" />
								Use
							</Button>
						)}
					</div>

					{/* Metadata row */}
					<div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
						<div className="flex items-center gap-1">
							<VisibilityIcon className="h-3.5 w-3.5" />
							<span>{visibilityLabels[template.visibility]}</span>
						</div>

						{template.rating !== undefined && (
							<div className="flex items-center gap-1">
								<Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
								<span>{template.rating.toFixed(1)}</span>
							</div>
						)}

						<div className="flex items-center gap-1">
							<FileText className="h-3.5 w-3.5" />
							<span>{template.useCount} uses</span>
						</div>

						{template.estimatedTime && (
							<div className="flex items-center gap-1">
								<Clock className="h-3.5 w-3.5" />
								<span>{formatEstimatedTime(template.estimatedTime)}</span>
							</div>
						)}

						{template.difficulty && (
							<span
								className={cn(
									"px-2 py-0.5 rounded-full font-medium capitalize",
									difficultyColors[template.difficulty]
								)}
							>
								{template.difficulty}
							</span>
						)}
					</div>

					{/* Tags */}
					{template.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							{template.tags.slice(0, 5).map((tag) => (
								<span
									key={tag}
									className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
								>
									{tag}
								</span>
							))}
							{template.tags.length > 5 && (
								<span className="px-2 py-0.5 text-xs text-gray-500">
									+{template.tags.length - 5} more
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}

/**
 * Loading skeleton for template cards.
 */
export function TemplateCardSkeleton({
	variant = "default",
	className,
}: {
	variant?: "default" | "compact" | "horizontal";
	className?: string;
}) {
	if (variant === "compact") {
		return (
			<div className={cn("flex items-center gap-3 p-3", className)}>
				<div className="h-12 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
				<div className="flex-1 space-y-2">
					<div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		);
	}

	if (variant === "horizontal") {
		return (
			<div
				className={cn(
					"flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800",
					className
				)}
			>
				<div className="h-24 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
				<div className="flex-1 space-y-3">
					<div className="h-5 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div className="flex gap-2">
						<div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
						<div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<Card className={cn("overflow-hidden", className)}>
			<div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700 animate-pulse" />
			<CardHeader className="pb-2">
				<div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
			</CardHeader>
			<CardContent className="pb-2 space-y-2">
				<div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				<div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				<div className="flex gap-1 mt-3">
					<div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
					<div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
				</div>
			</CardContent>
			<CardFooter className="pt-2 border-t border-gray-100 dark:border-gray-800">
				<div className="flex justify-between w-full">
					<div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</CardFooter>
		</Card>
	);
}
