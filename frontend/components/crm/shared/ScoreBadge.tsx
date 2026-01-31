"use client";

/**
 * Score Badge Components
 *
 * Visual badges for displaying various CRM scores:
 * - Lead Score (0-100)
 * - Health Score (0-100)
 * - Fit Score (0-100)
 * - Partner Tier (1-3)
 */

import { cn } from "@/lib/utils";
import { Star, Heart, Target, Award, TrendingUp, TrendingDown, Minus } from "lucide-react";

// Score range color mapping
function getScoreColor(score: number): { bg: string; text: string; fill: string } {
	if (score >= 80) return { bg: "bg-green-100", text: "text-green-700", fill: "fill-green-500" };
	if (score >= 60) return { bg: "bg-blue-100", text: "text-blue-700", fill: "fill-blue-500" };
	if (score >= 40) return { bg: "bg-yellow-100", text: "text-yellow-700", fill: "fill-yellow-500" };
	if (score >= 20) return { bg: "bg-orange-100", text: "text-orange-700", fill: "fill-orange-500" };
	return { bg: "bg-red-100", text: "text-red-700", fill: "fill-red-500" };
}

// Partner tier colors
function getTierColor(tier: number): { bg: string; text: string; border: string } {
	switch (tier) {
		case 1:
			return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" };
		case 2:
			return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" };
		case 3:
			return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" };
		default:
			return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" };
	}
}

interface ScoreBadgeProps {
	score: number | null | undefined;
	label?: string;
	variant?: "badge" | "circle" | "bar" | "compact";
	size?: "sm" | "md" | "lg";
	showTrend?: "up" | "down" | "neutral";
	className?: string;
}

export function LeadScoreBadge({
	score,
	label = "Lead Score",
	variant = "badge",
	size = "md",
	showTrend,
	className,
}: ScoreBadgeProps) {
	if (score === null || score === undefined) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)}>
				Not scored
			</span>
		);
	}

	const colors = getScoreColor(score);

	return (
		<ScoreDisplay
			score={score}
			label={label}
			icon={<Target className="h-3.5 w-3.5" />}
			colors={colors}
			variant={variant}
			size={size}
			showTrend={showTrend}
			className={className}
		/>
	);
}

export function HealthScoreBadge({
	score,
	label = "Health",
	variant = "badge",
	size = "md",
	showTrend,
	className,
}: ScoreBadgeProps) {
	if (score === null || score === undefined) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)}>
				Not assessed
			</span>
		);
	}

	const colors = getScoreColor(score);

	return (
		<ScoreDisplay
			score={score}
			label={label}
			icon={<Heart className="h-3.5 w-3.5" />}
			colors={colors}
			variant={variant}
			size={size}
			showTrend={showTrend}
			className={className}
		/>
	);
}

export function FitScoreBadge({
	score,
	label = "Fit Score",
	variant = "badge",
	size = "md",
	showTrend,
	className,
}: ScoreBadgeProps) {
	if (score === null || score === undefined) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)}>
				Not evaluated
			</span>
		);
	}

	const colors = getScoreColor(score);

	return (
		<ScoreDisplay
			score={score}
			label={label}
			icon={<Star className="h-3.5 w-3.5" />}
			colors={colors}
			variant={variant}
			size={size}
			showTrend={showTrend}
			className={className}
		/>
	);
}

interface PartnerTierBadgeProps {
	tier: number | null | undefined;
	size?: "sm" | "md" | "lg";
	showLabel?: boolean;
	className?: string;
}

export function PartnerTierBadge({
	tier,
	size = "md",
	showLabel = true,
	className,
}: PartnerTierBadgeProps) {
	if (tier === null || tier === undefined) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)}>
				Untiered
			</span>
		);
	}

	const colors = getTierColor(tier);
	const tierLabels: Record<number, string> = {
		1: "Strategic",
		2: "Preferred",
		3: "Approved",
	};

	const sizeClasses = {
		sm: "text-xs px-1.5 py-0.5",
		md: "text-sm px-2 py-1",
		lg: "text-base px-3 py-1.5",
	};

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-md border font-medium",
				colors.bg,
				colors.text,
				colors.border,
				sizeClasses[size],
				className
			)}
		>
			<Award className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
			{showLabel ? (
				<span>Tier {tier}: {tierLabels[tier] ?? "Partner"}</span>
			) : (
				<span>T{tier}</span>
			)}
		</span>
	);
}

// Internal score display component
interface ScoreDisplayProps {
	score: number;
	label: string;
	icon: React.ReactNode;
	colors: { bg: string; text: string; fill: string };
	variant: "badge" | "circle" | "bar" | "compact";
	size: "sm" | "md" | "lg";
	showTrend?: "up" | "down" | "neutral";
	className?: string;
}

function ScoreDisplay({
	score,
	label,
	icon,
	colors,
	variant,
	size,
	showTrend,
	className,
}: ScoreDisplayProps) {
	const sizeClasses = {
		sm: "text-xs",
		md: "text-sm",
		lg: "text-base",
	};

	// Compact badge
	if (variant === "compact") {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded font-medium",
					colors.bg,
					colors.text,
					size === "sm" ? "px-1 py-0.5 text-xs" : "px-1.5 py-0.5 text-sm",
					className
				)}
			>
				{icon}
				<span>{score}</span>
			</span>
		);
	}

	// Circle variant
	if (variant === "circle") {
		const circleSize = size === "sm" ? 36 : size === "md" ? 48 : 64;
		const strokeWidth = size === "sm" ? 3 : 4;
		const radius = (circleSize - strokeWidth) / 2;
		const circumference = 2 * Math.PI * radius;
		const offset = circumference - (score / 100) * circumference;

		return (
			<div className={cn("flex flex-col items-center gap-1", className)}>
				<div className="relative" style={{ width: circleSize, height: circleSize }}>
					<svg className="transform -rotate-90" width={circleSize} height={circleSize}>
						<circle
							cx={circleSize / 2}
							cy={circleSize / 2}
							r={radius}
							fill="none"
							stroke="currentColor"
							strokeWidth={strokeWidth}
							className="text-gray-200"
						/>
						<circle
							cx={circleSize / 2}
							cy={circleSize / 2}
							r={radius}
							fill="none"
							stroke="currentColor"
							strokeWidth={strokeWidth}
							strokeDasharray={circumference}
							strokeDashoffset={offset}
							strokeLinecap="round"
							className={colors.text}
						/>
					</svg>
					<span
						className={cn(
							"absolute inset-0 flex items-center justify-center font-semibold",
							colors.text,
							sizeClasses[size]
						)}
					>
						{score}
					</span>
				</div>
				<span className="text-xs text-muted-foreground">{label}</span>
			</div>
		);
	}

	// Bar variant
	if (variant === "bar") {
		return (
			<div className={cn("w-full", className)}>
				<div className="flex items-center justify-between mb-1">
					<span className={cn("font-medium", sizeClasses[size])}>{label}</span>
					<span className={cn("font-semibold", colors.text, sizeClasses[size])}>
						{score}%
					</span>
				</div>
				<div className="h-2 w-full rounded-full bg-gray-200">
					<div
						className={cn("h-2 rounded-full transition-all", colors.bg.replace("100", "500"))}
						style={{ width: `${score}%` }}
					/>
				</div>
			</div>
		);
	}

	// Default badge variant
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md font-medium",
				colors.bg,
				colors.text,
				size === "sm" ? "px-1.5 py-0.5 text-xs" : size === "md" ? "px-2 py-1 text-sm" : "px-3 py-1.5",
				className
			)}
		>
			{icon}
			<span>{score}</span>
			{showTrend && (
				<span className="ml-0.5">
					{showTrend === "up" && <TrendingUp className="h-3 w-3 text-green-600" />}
					{showTrend === "down" && <TrendingDown className="h-3 w-3 text-red-600" />}
					{showTrend === "neutral" && <Minus className="h-3 w-3 text-gray-400" />}
				</span>
			)}
		</span>
	);
}

export default LeadScoreBadge;
