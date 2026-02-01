"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton component for loading states.
 * Creates a pulsing animation placeholder that matches content dimensions.
 *
 * @example
 * // Text placeholder
 * <Skeleton className="h-4 w-[250px]" />
 *
 * @example
 * // Avatar placeholder
 * <Skeleton className="h-12 w-12 rounded-full" />
 *
 * @example
 * // Card loading state
 * <div className="space-y-2">
 *   <Skeleton className="h-4 w-full" />
 *   <Skeleton className="h-4 w-[80%]" />
 *   <Skeleton className="h-4 w-[60%]" />
 * </div>
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	function Skeleton({ className, ...props }, ref) {
	return (
		<div
			ref={ref}
			className={cn(
				"animate-pulse rounded-md",
				"bg-muted",
				className
			)}
			{...props}
		/>
	);
}
);
Skeleton.displayName = "Skeleton";

/**
 * Shimmer skeleton with animated gradient effect.
 * Use for more engaging loading states.
 */
const ShimmerSkeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	function ShimmerSkeleton({ className, ...props }, ref) {
	return (
		<div
			ref={ref}
			className={cn(
				"animate-shimmer rounded-md",
				className
			)}
			{...props}
		/>
	);
}
);
ShimmerSkeleton.displayName = "ShimmerSkeleton";

/**
 * Document card skeleton for loading states in document lists.
 */
function DocumentCardSkeleton() {
	return (
		<div className="rounded-xl border border-border bg-card p-6 shadow-sm">
			<div className="space-y-3">
				<Skeleton className="h-5 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
				<div className="pt-4">
					<Skeleton className="h-20 w-full" />
				</div>
				<div className="flex items-center justify-between pt-4 border-t border-border">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-16 rounded-lg" />
				</div>
			</div>
		</div>
	);
}

/**
 * Template card skeleton for loading states in template gallery.
 */
function TemplateCardSkeleton() {
	return (
		<div className="rounded-xl border border-border bg-card p-4 shadow-sm">
			<Skeleton className="mb-4 h-32 w-full rounded-lg" />
			<div className="space-y-2">
				<Skeleton className="h-5 w-3/4" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
			<div className="mt-4 flex gap-2">
				<Skeleton className="h-6 w-16 rounded-full" />
				<Skeleton className="h-6 w-16 rounded-full" />
			</div>
		</div>
	);
}

/**
 * Editor toolbar skeleton for loading states.
 */
function EditorToolbarSkeleton() {
	return (
		<div className="flex items-center gap-2 border-b border-border p-2 bg-card">
			<Skeleton className="h-8 w-8 rounded" />
			<Skeleton className="h-8 w-8 rounded" />
			<Skeleton className="h-8 w-8 rounded" />
			<div className="mx-2 h-6 w-px bg-border" />
			<Skeleton className="h-8 w-8 rounded" />
			<Skeleton className="h-8 w-8 rounded" />
			<Skeleton className="h-8 w-8 rounded" />
			<div className="mx-2 h-6 w-px bg-border" />
			<Skeleton className="h-8 w-8 rounded" />
			<Skeleton className="h-8 w-8 rounded" />
		</div>
	);
}

/**
 * Editor content skeleton with lines of varying widths.
 */
function EditorContentSkeleton() {
	return (
		<div className="space-y-3 p-6">
			<Skeleton className="h-6 w-1/3" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-4/5" />
			</div>
			<div className="pt-4 space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
			</div>
			<div className="pt-4 space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}

/**
 * Avatar skeleton for collaborator lists.
 */
function AvatarSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
	const sizeClasses = {
		sm: "h-6 w-6",
		md: "h-8 w-8",
		lg: "h-10 w-10",
	};

	return <Skeleton className={cn("rounded-full", sizeClasses[size])} />;
}

/**
 * Table row skeleton for data tables.
 */
function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
	return (
		<div className="flex items-center gap-4 border-b border-border py-3">
			{Array.from({ length: columns }).map((_, i) => (
				<Skeleton
					key={i}
					className="h-4"
					style={{ width: `${Math.random() * 40 + 20}%` }}
				/>
			))}
		</div>
	);
}

/**
 * Stat skeleton for statistics loading states.
 */
function StatSkeleton() {
	return (
		<div className="flex items-center gap-3">
			<Skeleton className="h-10 w-10 rounded-lg" />
			<div className="space-y-1">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-3 w-8" />
			</div>
		</div>
	);
}

/**
 * Full editor skeleton for document editor page loading state.
 */
function EditorSkeleton() {
	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Header skeleton */}
			<div className="flex items-center justify-between px-4 h-14 border-b border-border bg-card">
				<div className="flex items-center gap-3">
					<Skeleton className="h-8 w-8 rounded" />
					<Skeleton className="h-6 w-48" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-8 rounded" />
					<Skeleton className="h-8 w-8 rounded" />
					<Skeleton className="h-8 w-8 rounded" />
				</div>
			</div>

			{/* Toolbar skeleton */}
			<EditorToolbarSkeleton />

			{/* Content skeleton */}
			<div className="flex-1 flex">
				<div className="flex-1 border-r border-border">
					<EditorContentSkeleton />
				</div>
				<div className="flex-1">
					<EditorContentSkeleton />
				</div>
			</div>

			{/* Status bar skeleton */}
			<div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-32" />
			</div>
		</div>
	);
}

/**
 * Document list skeleton for documents page loading state.
 */
function DocumentListSkeleton({ count = 8 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{Array.from({ length: count }).map((_, i) => (
				<DocumentCardSkeleton key={i} />
			))}
		</div>
	);
}

/**
 * Page loading skeleton with header and content.
 */
function PageSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-10 w-24 rounded-lg" />
			</div>
			{/* Content */}
			<DocumentListSkeleton count={8} />
		</div>
	);
}

/**
 * Simple template skeleton (alias for TemplateCardSkeleton).
 */
const TemplateSkeleton = TemplateCardSkeleton;

export {
	Skeleton,
	ShimmerSkeleton,
	DocumentCardSkeleton,
	TemplateCardSkeleton,
	EditorToolbarSkeleton,
	EditorContentSkeleton,
	AvatarSkeleton,
	TableRowSkeleton,
	StatSkeleton,
	EditorSkeleton,
	DocumentListSkeleton,
	PageSkeleton,
	TemplateSkeleton,
};
