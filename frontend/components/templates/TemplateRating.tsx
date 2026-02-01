/**
 * Template Rating Component - DocFusion
 *
 * Interactive star rating component that allows users to rate templates.
 * Displays current rating and updates via API call.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Star, Loader2 } from "lucide-react";

export interface TemplateRatingProps {
	/** Template ID to rate */
	templateId: string;
	/** Current average rating (0-5) */
	rating?: number;
	/** Number of ratings */
	ratingCount?: number;
	/** Size variant */
	size?: "sm" | "md" | "lg";
	/** Whether to show the rating count */
	showCount?: boolean;
	/** Whether rating is interactive */
	interactive?: boolean;
	/** Callback when rating changes */
	onRatingChange?: (newRating: number, newCount: number) => void;
	/** Additional CSS classes */
	className?: string;
}

export function TemplateRating({
	templateId,
	rating = 0,
	ratingCount = 0,
	size = "md",
	showCount = true,
	interactive = true,
	onRatingChange,
	className,
}: TemplateRatingProps) {
	const [hoverRating, setHoverRating] = React.useState(0);
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [hasRated, setHasRated] = React.useState(false);
	const [localRating, setLocalRating] = React.useState(rating);
	const [localCount, setLocalCount] = React.useState(ratingCount);

	// Sync local state with props
	React.useEffect(() => {
		setLocalRating(rating);
		setLocalCount(ratingCount);
	}, [rating, ratingCount]);

	const sizes = {
		sm: { star: "h-3.5 w-3.5", text: "text-xs", gap: "gap-0.5" },
		md: { star: "h-4 w-4", text: "text-sm", gap: "gap-1" },
		lg: { star: "h-5 w-5", text: "text-base", gap: "gap-1.5" },
	};

	const currentSize = sizes[size];

	const handleClick = async (starIndex: number) => {
		if (!interactive || isSubmitting || hasRated) return;

		const newRating = starIndex + 1;
		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/v1/templates/${templateId}/rate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rating: newRating }),
			});

			if (response.ok) {
				const data = await response.json();
				setLocalRating(data.rating);
				setLocalCount(data.ratingCount);
				setHasRated(true);
				onRatingChange?.(data.rating, data.ratingCount);
			} else {
				console.error("Failed to submit rating");
			}
		} catch (error) {
			console.error("Error submitting rating:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const displayRating = hoverRating || localRating;

	return (
		<div className={cn("flex items-center", currentSize.gap, className)}>
			{/* Stars */}
			<div
				className={cn(
					"flex items-center",
					currentSize.gap,
					interactive && !hasRated && "cursor-pointer"
				)}
				onMouseLeave={() => setHoverRating(0)}
			>
				{[0, 1, 2, 3, 4].map((index) => {
					const fillPercent = Math.min(1, Math.max(0, displayRating - index));
					const isFilled = fillPercent >= 0.5;

					return (
						<button
							key={index}
							type="button"
							disabled={!interactive || isSubmitting || hasRated}
							onClick={() => handleClick(index)}
							onMouseEnter={() => interactive && !hasRated && setHoverRating(index + 1)}
							className={cn(
								"relative transition-transform",
								interactive && !hasRated && "hover:scale-110",
								(isSubmitting || hasRated) && "cursor-default"
							)}
							title={interactive && !hasRated ? `Rate ${index + 1} star${index > 0 ? "s" : ""}` : undefined}
						>
							{/* Background (empty) star */}
							<Star
								className={cn(
									currentSize.star,
									"text-gray-300 dark:text-gray-600"
								)}
							/>
							{/* Filled star overlay */}
							{isFilled && (
								<Star
									className={cn(
										currentSize.star,
										"absolute inset-0 text-amber-400 fill-amber-400",
										hoverRating > 0 && "text-amber-500 fill-amber-500"
									)}
								/>
							)}
						</button>
					);
				})}
			</div>

			{/* Rating text */}
			{isSubmitting ? (
				<Loader2 className={cn(currentSize.star, "animate-spin text-muted-foreground")} />
			) : (
				<>
					{localRating > 0 && (
						<span className={cn(currentSize.text, "font-medium text-foreground")}>
							{localRating.toFixed(1)}
						</span>
					)}
					{showCount && localCount > 0 && (
						<span className={cn(currentSize.text, "text-muted-foreground")}>
							({localCount})
						</span>
					)}
					{localRating === 0 && localCount === 0 && (
						<span className={cn(currentSize.text, "text-muted-foreground")}>
							{interactive ? "Be the first to rate" : "No ratings yet"}
						</span>
					)}
				</>
			)}

			{/* Rated confirmation */}
			{hasRated && (
				<span className={cn(currentSize.text, "text-success ml-1")}>
					Thanks!
				</span>
			)}
		</div>
	);
}

/**
 * Compact star display (non-interactive) for lists and cards.
 */
export function StarRatingDisplay({
	rating = 0,
	ratingCount = 0,
	size = "sm",
	showCount = true,
	className,
}: Omit<TemplateRatingProps, "templateId" | "interactive" | "onRatingChange">) {
	const sizes = {
		sm: { star: "h-3.5 w-3.5", text: "text-xs", gap: "gap-0.5" },
		md: { star: "h-4 w-4", text: "text-sm", gap: "gap-1" },
		lg: { star: "h-5 w-5", text: "text-base", gap: "gap-1.5" },
	};

	const currentSize = sizes[size];

	if (!rating && !ratingCount) {
		return (
			<span className={cn(currentSize.text, "text-muted-foreground", className)}>
				No ratings
			</span>
		);
	}

	return (
		<div className={cn("flex items-center", currentSize.gap, className)}>
			<Star className={cn(currentSize.star, "text-amber-400 fill-amber-400")} />
			<span className={cn(currentSize.text, "font-medium text-foreground")}>
				{rating ? rating.toFixed(1) : "0"}
			</span>
			{showCount && ratingCount > 0 && (
				<span className={cn(currentSize.text, "text-muted-foreground")}>
					({ratingCount})
				</span>
			)}
		</div>
	);
}
