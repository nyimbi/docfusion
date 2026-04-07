import Image from "next/image";

/**
 * Template Gallery - "Document Atelier" Design
 *
 * A sophisticated template browsing experience inspired by luxury
 * stationery catalogs and editorial magazine layouts. Each template
 * is presented as a premium specimen with rich visual hierarchy.
 *
 * Design Signature:
 * - Asymmetric masonry layout with featured specimens
 * - Ink wash backgrounds and paper texture overlays
 * - Editorial typography with vermillion accents
 * - Refined micro-interactions and staggered reveals
 * - Specimen cards with "collector's edition" aesthetic
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TemplateSummary, TemplateCategory } from "@/lib/types/template";
import { Button } from "@/components/ui/Button";
import {
	LayoutTemplate,
	Star,
	Clock,
	FileText,
	Sparkles,
	Lock,
	Globe,
	Users,
	Building2,
	ArrowUpRight,
	Flame,
	Award,
	Zap,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface TemplateGalleryProps {
	templates: TemplateSummary[];
	categories?: TemplateCategory[];
	onUseTemplate?: (template: TemplateSummary) => void;
	isLoading?: boolean;
	viewMode?: "gallery" | "list";
}

interface SpecimenCardProps {
	template: TemplateSummary;
	variant?: "standard" | "featured" | "compact";
	index?: number;
	onUse?: (template: TemplateSummary) => void;
}

// ============================================================================
// Constants
// ============================================================================

const visibilityConfig = {
	private: { icon: Lock, label: "Private", color: "text-stone-500" },
	team: { icon: Users, label: "Team", color: "text-blue-600" },
	organization: { icon: Building2, label: "Org", color: "text-violet-600" },
	public: { icon: Globe, label: "Public", color: "text-emerald-600" },
} as const;

const difficultyConfig = {
	beginner: {
		label: "Starter",
		bg: "bg-emerald-50 dark:bg-emerald-950/40",
		text: "text-emerald-700 dark:text-emerald-400",
		border: "border-emerald-200 dark:border-emerald-800",
	},
	intermediate: {
		label: "Standard",
		bg: "bg-amber-50 dark:bg-amber-950/40",
		text: "text-amber-700 dark:text-amber-400",
		border: "border-amber-200 dark:border-amber-800",
	},
	advanced: {
		label: "Expert",
		bg: "bg-rose-50 dark:bg-rose-950/40",
		text: "text-rose-700 dark:text-rose-400",
		border: "border-rose-200 dark:border-rose-800",
	},
} as const;

// ============================================================================
// Animation Config
// ============================================================================

const springTransition = {
	type: "spring" as const,
	stiffness: 300,
	damping: 30,
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatTime(minutes?: number): string {
	if (!minutes) return "";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getPopularityTier(useCount: number): "hot" | "trending" | "new" | null {
	if (useCount >= 100) return "hot";
	if (useCount >= 25) return "trending";
	if (useCount <= 3) return "new";
	return null;
}

// ============================================================================
// Specimen Card Component
// ============================================================================

const SpecimenCard = React.memo(function SpecimenCard({
	template,
	variant = "standard",
	index = 0,
	onUse,
}: SpecimenCardProps) {
	const router = useRouter();
	const [isHovered, setIsHovered] = React.useState(false);

	const visibility = visibilityConfig[template.visibility];
	const difficulty = template.difficulty
		? difficultyConfig[template.difficulty]
		: null;
	const VisibilityIcon = visibility.icon;
	const popularityTier = getPopularityTier(template.useCount);

	const handleClick = () => {
		router.push(`/templates/${template.id}`);
	};

	const handleUse = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onUse?.(template);
	};

	// Featured variant for high-rated or popular templates
	if (variant === "featured") {
		return (
			<motion.article
				initial={{ opacity: 0, y: 24, scale: 0.96 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				whileHover={{ scale: 1.01, y: -2 }}
				transition={springTransition}
				onClick={handleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				className={cn(
					"group relative col-span-2 row-span-2",
					"rounded-2xl overflow-hidden cursor-pointer",
					"bg-gradient-to-br from-card via-card to-muted/30",
					"border border-border/60 shadow-lg",
					"transition-shadow duration-500",
					"hover:shadow-2xl hover:border-primary/30"
				)}
			>
				{/* Background Pattern */}
				<div
					className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
					}}
				/>

				{/* Hero Preview Section */}
				<div className="relative h-64 bg-muted overflow-hidden">
					{template.previewImageUrl ? (
						<motion.img
							src={template.previewImageUrl}
							alt={template.name}
							className="absolute inset-0 w-full h-full object-cover"
							variants={{
								rest: { scale: 1 },
								hover: { scale: 1.08 },
							}}
							transition={{ duration: 0.6, ease: "easeOut" }}
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
							<LayoutTemplate className="h-20 w-20 text-primary/20" />
						</div>
					)}

					{/* Gradient Overlay */}
					<div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

					{/* Top Badge Row */}
					<div className="absolute top-4 left-4 right-4 flex items-start justify-between">
						{/* Visibility Badge */}
						<motion.div
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-full",
								"bg-background/95 backdrop-blur-md shadow-sm",
								"text-xs font-medium",
								visibility.color
							)}
							variants={{
								rest: { x: 0, opacity: 1 },
								hover: { x: 0, opacity: 1 },
							}}
						>
							<VisibilityIcon className="h-3.5 w-3.5" />
							<span>{visibility.label}</span>
						</motion.div>

						{/* Popularity Indicator */}
						{popularityTier && (
							<motion.div
								className={cn(
									"flex items-center gap-1.5 px-3 py-1.5 rounded-full",
									"text-xs font-semibold shadow-sm backdrop-blur-md",
									popularityTier === "hot" &&
										"bg-gradient-to-r from-orange-500 to-red-500 text-white",
									popularityTier === "trending" &&
										"bg-gradient-to-r from-violet-500 to-purple-500 text-white",
									popularityTier === "new" &&
										"bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
								)}
								initial={{ scale: 0.8, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{ delay: 0.2, type: "spring" }}
							>
								{popularityTier === "hot" && (
									<>
										<Flame className="h-3.5 w-3.5" />
										<span>Popular</span>
									</>
								)}
								{popularityTier === "trending" && (
									<>
										<Zap className="h-3.5 w-3.5" />
										<span>Trending</span>
									</>
								)}
								{popularityTier === "new" && (
									<>
										<Sparkles className="h-3.5 w-3.5" />
										<span>New</span>
									</>
								)}
							</motion.div>
						)}
					</div>

					{/* Use CTA - appears on hover */}
					<motion.div
						className="absolute inset-0 flex items-center justify-center"
						variants={{
							rest: { opacity: 0 },
							hover: { opacity: 1 },
						}}
						transition={{ duration: 0.3 }}
					>
						<div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" />
						<Button
							size="lg"
							onClick={handleUse}
							className={cn(
								"relative z-10 gap-2 px-6 py-3 rounded-xl",
								"bg-background text-foreground",
								"shadow-2xl hover:bg-background",
								"font-semibold tracking-wide"
							)}
						>
							<Sparkles className="h-5 w-5" />
							Use This Template
						</Button>
					</motion.div>
				</div>

				{/* Content Section */}
				<div className="relative p-6 space-y-4">
					{/* Title Row */}
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<h3
								className={cn(
									"font-display text-xl font-semibold",
									"text-foreground line-clamp-1",
									"group-hover:text-primary transition-colors duration-300"
								)}
							>
								{template.name}
							</h3>
							<p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
								{template.description}
							</p>
						</div>

						{/* Rating Badge */}
						{template.rating && template.rating >= 4 && (
							<div
								className={cn(
									"flex items-center gap-1 px-2.5 py-1 rounded-lg shrink-0",
									"bg-amber-50 dark:bg-amber-950/50",
									"border border-amber-200 dark:border-amber-800"
								)}
							>
								<Star className="h-4 w-4 text-amber-500 fill-amber-500" />
								<span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
									{template.rating.toFixed(1)}
								</span>
							</div>
						)}
					</div>

					{/* Tags */}
					{template.tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{template.tags.slice(0, 4).map((tag) => (
								<span
									key={tag}
									className={cn(
										"px-2.5 py-1 rounded-md text-xs font-medium",
										"bg-muted text-muted-foreground",
										"border border-border/50"
									)}
								>
									{tag}
								</span>
							))}
							{template.tags.length > 4 && (
								<span className="px-2.5 py-1 text-xs text-muted-foreground">
									+{template.tags.length - 4} more
								</span>
							)}
						</div>
					)}

					{/* Stats Footer */}
					<div className="flex items-center justify-between pt-4 border-t border-border/50">
						<div className="flex items-center gap-4 text-xs text-muted-foreground">
							<div className="flex items-center gap-1.5">
								<FileText className="h-4 w-4" />
								<span className="font-medium">
									{template.useCount.toLocaleString()} uses
								</span>
							</div>
							{template.estimatedTime && (
								<div className="flex items-center gap-1.5">
									<Clock className="h-4 w-4" />
									<span>{formatTime(template.estimatedTime)}</span>
								</div>
							)}
						</div>

						{difficulty && (
							<span
								className={cn(
									"px-2.5 py-1 rounded-md text-xs font-semibold",
									"border",
									difficulty.bg,
									difficulty.text,
									difficulty.border
								)}
							>
								{difficulty.label}
							</span>
						)}
					</div>
				</div>

				{/* Corner Accent */}
				<div className="absolute bottom-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
					<div
						className={cn(
							"absolute -bottom-12 -right-12 w-24 h-24 rotate-45",
							"bg-gradient-to-br from-primary/10 to-primary/5",
							"group-hover:from-primary/20 group-hover:to-primary/10",
							"transition-colors duration-500"
						)}
					/>
				</div>
			</motion.article>
		);
	}

	// Compact variant for list views
	if (variant === "compact") {
		return (
			<motion.article
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: index * 0.05, duration: 0.3 }}
				onClick={handleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				className={cn(
					"group flex items-center gap-4 p-4",
					"rounded-xl cursor-pointer",
					"bg-card border border-border/60",
					"hover:border-primary/40 hover:shadow-md",
					"transition-all duration-300"
				)}
			>
				{/* Thumbnail */}
				<div className="relative h-16 w-24 rounded-lg bg-muted overflow-hidden shrink-0">
					{template.previewImageUrl ? (
						<Image
							src={template.previewImageUrl}
							alt=""
							className="object-cover group-hover:scale-105 transition-transform duration-500"
							fill
							unoptimized
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<LayoutTemplate className="h-6 w-6 text-muted-foreground/30" />
						</div>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<h4
							className={cn(
								"font-semibold text-foreground truncate",
								"group-hover:text-primary transition-colors"
							)}
						>
							{template.name}
						</h4>
						{template.rating && template.rating >= 4 && (
							<div className="flex items-center gap-0.5 text-amber-500">
								<Star className="h-3 w-3 fill-current" />
								<span className="text-xs font-medium">
									{template.rating.toFixed(1)}
								</span>
							</div>
						)}
					</div>
					<p className="text-sm text-muted-foreground truncate">
						{template.description}
					</p>
					<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
						<span className="flex items-center gap-1">
							<FileText className="h-3 w-3" />
							{template.useCount}
						</span>
						{template.estimatedTime && (
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatTime(template.estimatedTime)}
							</span>
						)}
						{difficulty && (
							<span className={cn("font-medium", difficulty.text)}>
								{difficulty.label}
							</span>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="shrink-0 flex items-center gap-2">
					<Button
						size="sm"
						variant="ghost"
						className="opacity-0 group-hover:opacity-100 transition-opacity"
						onClick={handleUse}
					>
						<Sparkles className="h-4 w-4" />
						Use
					</Button>
					<ArrowUpRight
						className={cn(
							"h-4 w-4 text-muted-foreground",
							"group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
							"transition-all duration-300"
						)}
					/>
				</div>
			</motion.article>
		);
	}

	// Standard variant - the workhorse card
	return (
		<motion.article
			initial={{ opacity: 0, y: 24, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			whileHover={{ scale: 1.02, y: -4 }}
			transition={{ delay: index * 0.05, ...springTransition }}
			onClick={handleClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			className={cn(
				"group relative rounded-xl overflow-hidden cursor-pointer",
				"bg-card border border-border/60",
				"shadow-sm hover:shadow-lg",
				"transition-shadow duration-500",
				"hover:border-primary/30"
			)}
		>
			{/* Preview Section */}
			<div className="relative aspect-[5/3] bg-muted overflow-hidden">
				{template.previewImageUrl ? (
					<motion.img
						src={template.previewImageUrl}
						alt=""
						className="absolute inset-0 w-full h-full object-cover"
						variants={{
							rest: { scale: 1 },
							hover: { scale: 1.06 },
						}}
						transition={{ duration: 0.5, ease: "easeOut" }}
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/5">
						<LayoutTemplate className="h-12 w-12 text-muted-foreground/20" />
					</div>
				)}

				{/* Gradient overlay */}
				<div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card/90 to-transparent" />

				{/* Top badges */}
				<div className="absolute top-3 left-3 right-3 flex items-start justify-between">
					<div
						className={cn(
							"flex items-center gap-1.5 px-2.5 py-1 rounded-full",
							"bg-background/90 backdrop-blur-sm",
							"text-[11px] font-medium uppercase tracking-wide",
							visibility.color
						)}
					>
						<VisibilityIcon className="h-3 w-3" />
						<span>{visibility.label}</span>
					</div>

					{difficulty && (
						<span
							className={cn(
								"px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide",
								"backdrop-blur-sm",
								difficulty.bg,
								difficulty.text
							)}
						>
							{difficulty.label}
						</span>
					)}
				</div>

				{/* Hover overlay with CTA */}
				<motion.div
					className="absolute inset-0 flex items-center justify-center"
					variants={{
						rest: { opacity: 0 },
						hover: { opacity: 1 },
					}}
					transition={{ duration: 0.25 }}
				>
					<div className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]" />
					<Button
						onClick={handleUse}
						className={cn(
							"relative z-10 gap-2",
							"bg-background text-foreground",
							"shadow-xl hover:bg-background",
							"font-medium"
						)}
					>
						<Sparkles className="h-4 w-4" />
						Use Template
					</Button>
				</motion.div>

				{/* Popularity indicator */}
				{popularityTier === "hot" && (
					<div className="absolute bottom-3 right-3">
						<motion.div
							className={cn(
								"flex items-center gap-1 px-2 py-1 rounded-full",
								"bg-gradient-to-r from-orange-500 to-red-500",
								"text-[10px] font-bold text-white uppercase tracking-wider"
							)}
							initial={{ scale: 0, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ delay: 0.3, type: "spring" }}
						>
							<Flame className="h-3 w-3" />
							Popular
						</motion.div>
					</div>
				)}
			</div>

			{/* Content Section */}
			<div className="p-5 space-y-3">
				{/* Title + Rating */}
				<div className="flex items-start justify-between gap-3">
					<h3
						className={cn(
							"font-display font-semibold text-foreground",
							"line-clamp-1 flex-1",
							"group-hover:text-primary transition-colors duration-300"
						)}
					>
						{template.name}
					</h3>
					{template.rating && (
						<div className="flex items-center gap-1 shrink-0">
							<Star className="h-4 w-4 text-amber-500 fill-amber-500" />
							<span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
								{template.rating.toFixed(1)}
							</span>
						</div>
					)}
				</div>

				{/* Description */}
				<p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
					{template.description}
				</p>

				{/* Tags */}
				{template.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5 pt-1">
						{template.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className={cn(
									"px-2 py-0.5 rounded text-[11px] font-medium",
									"bg-muted text-muted-foreground",
									"border border-transparent",
									"group-hover:border-border/50 transition-colors"
								)}
							>
								{tag}
							</span>
						))}
						{template.tags.length > 3 && (
							<span className="px-2 py-0.5 text-[11px] text-muted-foreground">
								+{template.tags.length - 3}
							</span>
						)}
					</div>
				)}

				{/* Footer Stats */}
				<div className="flex items-center justify-between pt-3 border-t border-border/40">
					<div className="flex items-center gap-3 text-xs text-muted-foreground">
						<span className="flex items-center gap-1">
							<FileText className="h-3.5 w-3.5" />
							<span className="font-medium">{template.useCount}</span>
						</span>
						{template.estimatedTime && (
							<span className="flex items-center gap-1">
								<Clock className="h-3.5 w-3.5" />
								<span>{formatTime(template.estimatedTime)}</span>
							</span>
						)}
					</div>

					<ArrowUpRight
						className={cn(
							"h-4 w-4 text-muted-foreground/50",
							"group-hover:text-primary",
							"group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
							"transition-all duration-300"
						)}
					/>
				</div>
			</div>

			{/* Subtle corner accent */}
			<div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
				<div className="absolute -top-8 -right-8 w-16 h-16 rotate-45 bg-primary/10" />
			</div>
		</motion.article>
	);
});

SpecimenCard.displayName = "SpecimenCard";

// ============================================================================
// Gallery Skeleton
// ============================================================================

function GallerySkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className={cn(
						"rounded-xl overflow-hidden bg-card border border-border/60",
						i === 0 && "md:col-span-2 md:row-span-2"
					)}
				>
					<div
						className={cn(
							"bg-muted animate-shimmer",
							i === 0 ? "h-64" : "aspect-[5/3]"
						)}
					/>
					<div className="p-5 space-y-3">
						<div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
						<div className="h-4 w-full bg-muted rounded animate-pulse" />
						<div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
						<div className="flex gap-2 pt-2">
							<div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
							<div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyGallery({
	title = "No templates found",
	description = "Try adjusting your search or filters to find what you're looking for.",
	onClear,
}: {
	title?: string;
	description?: string;
	onClear?: () => void;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex flex-col items-center justify-center py-20 px-6 text-center"
		>
			{/* Decorative illustration */}
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-primary/20 rounded-3xl blur-3xl scale-150" />
				<div className="relative w-28 h-28 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
					<LayoutTemplate className="w-14 h-14 text-primary/40" />
				</div>
			</div>

			<h3 className="font-display text-2xl font-semibold text-foreground mb-3">
				{title}
			</h3>
			<p className="text-muted-foreground max-w-md leading-relaxed mb-6">
				{description}
			</p>

			{onClear && (
				<Button variant="outline" onClick={onClear}>
					Clear Filters
				</Button>
			)}
		</motion.div>
	);
}

// ============================================================================
// Main Gallery Component
// ============================================================================

export function TemplateGallery({
	templates,
	categories,
	onUseTemplate,
	isLoading = false,
	viewMode = "gallery",
}: TemplateGalleryProps) {
	if (isLoading) {
		return <GallerySkeleton count={viewMode === "list" ? 8 : 7} />;
	}

	if (templates.length === 0) {
		return <EmptyGallery />;
	}

	// For gallery mode, feature the first high-rated or popular template
	const featuredTemplate =
		viewMode === "gallery"
			? templates.find(
					(t) => (t.rating && t.rating >= 4.5) || t.useCount >= 100
			  ) || templates[0]
			: null;

	const regularTemplates = featuredTemplate
		? templates.filter((t) => t.id !== featuredTemplate.id)
		: templates;

	if (viewMode === "list") {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.3 }}
				className="space-y-3"
			>
				{templates.map((template, index) => (
					<SpecimenCard
						key={template.id}
						template={template}
						variant="compact"
						index={index}
						onUse={onUseTemplate}
					/>
				))}
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
			className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
		>
			{/* Featured Template */}
			{featuredTemplate && (
				<SpecimenCard
					key={featuredTemplate.id}
					template={featuredTemplate}
					variant="featured"
					index={0}
					onUse={onUseTemplate}
				/>
			)}

			{/* Regular Templates */}
			{regularTemplates.map((template, index) => (
				<SpecimenCard
					key={template.id}
					template={template}
					variant="standard"
					index={index + 1}
					onUse={onUseTemplate}
				/>
			))}
		</motion.div>
	);
}

export default TemplateGallery;
