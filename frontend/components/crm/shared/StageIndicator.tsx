"use client";

/**
 * Stage Indicator Component
 *
 * Visual indicator for account/deal pipeline stages with color coding
 * and optional progress bar visualization.
 */

import { cn } from "@/lib/utils";
import { ACCOUNT_STAGES, DEAL_STAGES, type AccountType, type DealStage } from "@/lib/types/crm";

// Color mapping for stage colors
const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
	gray: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
	blue: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
	indigo: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300" },
	purple: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
	yellow: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
	orange: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
	green: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
	red: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
	teal: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300" },
	pink: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300" },
};

interface StageIndicatorProps {
	stage: string;
	type?: AccountType;
	variant?: "badge" | "pill" | "dot";
	size?: "sm" | "md" | "lg";
	showLabel?: boolean;
	className?: string;
}

export function StageIndicator({
	stage,
	type,
	variant = "badge",
	size = "md",
	showLabel = true,
	className,
}: StageIndicatorProps) {
	// Find stage config - use Pick to extract only the common properties we need
	let stageConfig: { id: string; label: string; color: string } | undefined = DEAL_STAGES.find((s) => s.id === stage);

	if (!stageConfig && type) {
		const accountStages = ACCOUNT_STAGES[type];
		stageConfig = accountStages?.find((s) => s.id === stage);
	}

	const color = stageConfig?.color ?? "gray";
	const label = stageConfig?.label ?? stage;
	const colors = colorClasses[color] ?? colorClasses.gray;

	const sizeClasses = {
		sm: "text-xs px-1.5 py-0.5",
		md: "text-sm px-2 py-1",
		lg: "text-base px-3 py-1.5",
	};

	if (variant === "dot") {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				<span
					className={cn(
						"inline-block rounded-full",
						size === "sm" ? "h-2 w-2" : size === "md" ? "h-2.5 w-2.5" : "h-3 w-3",
						colors.bg.replace("100", "500")
					)}
				/>
				{showLabel && <span className="text-sm text-muted-foreground">{label}</span>}
			</div>
		);
	}

	if (variant === "pill") {
		return (
			<span
				className={cn(
					"inline-flex items-center rounded-full border",
					colors.bg,
					colors.text,
					colors.border,
					sizeClasses[size],
					className
				)}
			>
				{label}
			</span>
		);
	}

	// Default badge variant
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md font-medium",
				colors.bg,
				colors.text,
				sizeClasses[size],
				className
			)}
		>
			{label}
		</span>
	);
}

// Pipeline progress bar showing all stages
interface StagePipelineProps {
	currentStage: string;
	type?: AccountType;
	isDeal?: boolean;
	size?: "sm" | "md";
	className?: string;
	/** Callback when a stage is clicked (for stage transitions) */
	onStageClick?: (stage: string) => void;
}

export function StagePipeline({
	currentStage,
	type,
	isDeal = false,
	size = "md",
	className,
	onStageClick,
}: StagePipelineProps) {
	const stages = isDeal
		? DEAL_STAGES.filter((s) => !["closed_won", "closed_lost"].includes(s.id))
		: type
			? ACCOUNT_STAGES[type]?.filter(
					(s) => !["churned", "closed_won", "closed_lost", "dormant"].includes(s.id)
				) ?? []
			: [];

	const currentIndex = stages.findIndex((s) => s.id === currentStage);

	return (
		<div className={cn("flex items-center gap-1", className)}>
			{stages.map((stage, index) => {
				const isActive = index <= currentIndex;
				const isCurrent = index === currentIndex;
				const colors = colorClasses[stage.color] ?? colorClasses.gray;

				return (
					<div key={stage.id} className="flex items-center">
						<button
							type="button"
							onClick={() => onStageClick?.(stage.id)}
							disabled={!onStageClick}
							className={cn(
								"rounded-full transition-colors",
								size === "sm" ? "h-2 w-2" : "h-3 w-3",
								isActive ? colors.bg.replace("100", "500") : "bg-gray-200",
								isCurrent && "ring-2 ring-offset-1",
								isCurrent && colors.border.replace("300", "400"),
								onStageClick && "cursor-pointer hover:scale-125"
							)}
							title={stage.label}
							aria-label={`Stage: ${stage.label}`}
						/>
						{index < stages.length - 1 && (
							<div
								className={cn(
									"h-0.5 transition-colors",
									size === "sm" ? "w-4" : "w-6",
									isActive ? "bg-gray-400" : "bg-gray-200"
								)}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

export default StageIndicator;
