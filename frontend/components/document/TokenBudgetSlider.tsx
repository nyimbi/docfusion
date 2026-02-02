"use client";

/**
 * TokenBudgetSlider - Dual-Thumb Token Budget Control
 *
 * Features per HDSI specification:
 * - Dual-thumb slider for min/max range selection
 * - Reading time estimation: tokens / (225 * 1.3) minutes
 * - Visual budget meter with utilization indicator
 * - 3,800 token absolute cap enforcement
 * - Accessibility: full keyboard support, ARIA labels
 */

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { Clock, BookOpen, AlertTriangle } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	calculateReadingTime,
	createTokenBudgetConfig,
	type TokenBudgetConfig,
} from "@/lib/hdsi/types";

// ============================================================================
// Types
// ============================================================================

export interface TokenBudgetSliderProps {
	/** Current budget configuration */
	value: TokenBudgetConfig;
	/** Callback when budget changes */
	onChange: (config: TokenBudgetConfig) => void;
	/** Minimum selectable value */
	min?: number;
	/** Maximum selectable value (capped at absoluteCap) */
	max?: number;
	/** Step increment */
	step?: number;
	/** Whether to show the reading time estimate */
	showReadingTime?: boolean;
	/** Whether to show the budget meter visualization */
	showMeter?: boolean;
	/** Whether the control is disabled */
	disabled?: boolean;
	/** Additional className */
	className?: string;
	/** Size variant */
	size?: "sm" | "md" | "lg";
}

// ============================================================================
// Constants
// ============================================================================

/** Absolute maximum tokens per HDSI spec */
const ABSOLUTE_CAP = 3800;

/** Default range limits */
const DEFAULT_MIN = 100;
const DEFAULT_MAX = 2000;
const DEFAULT_STEP = 50;

/** Reading speed constants (words per minute, technical factor) */
const READING_SPEED_WPM = 225;
const TECHNICAL_FACTOR = 1.3;
const WORDS_PER_TOKEN = 0.75;

/** Size configurations */
const SIZE_CONFIG = {
	sm: {
		trackHeight: "h-1.5",
		thumbSize: "h-3 w-3",
		fontSize: "text-xs",
	},
	md: {
		trackHeight: "h-2",
		thumbSize: "h-4 w-4",
		fontSize: "text-sm",
	},
	lg: {
		trackHeight: "h-2.5",
		thumbSize: "h-5 w-5",
		fontSize: "text-base",
	},
} as const;

// ============================================================================
// Main Component
// ============================================================================

export function TokenBudgetSlider({
	value,
	onChange,
	min = DEFAULT_MIN,
	max = DEFAULT_MAX,
	step = DEFAULT_STEP,
	showReadingTime = true,
	showMeter = true,
	disabled = false,
	className,
	size = "md",
}: TokenBudgetSliderProps) {
	const sizeConfig = SIZE_CONFIG[size];

	// Ensure max doesn't exceed absolute cap
	const effectiveMax = Math.min(max, ABSOLUTE_CAP);

	// Handle slider value change (dual-thumb returns array [min, max])
	const handleValueChange = React.useCallback(
		(newValues: number[]) => {
			const [newMin, newMax] = newValues;
			const newCurrent = Math.round((newMin + newMax) / 2);
			const config = createTokenBudgetConfig(newMin, newMax, newCurrent);
			onChange(config);
		},
		[onChange]
	);

	// Handle single value change (click on track)
	const handleCurrentChange = React.useCallback(
		(newCurrent: number) => {
			// Adjust min/max to keep current within range
			const newConfig = {
				...value,
				current: Math.max(value.minimum, Math.min(value.maximum, newCurrent)),
				readingTimeMinutes: calculateReadingTime(newCurrent),
			};
			onChange(newConfig);
		},
		[value, onChange]
	);

	// Calculate reading time display
	const readingTimeDisplay = formatReadingTime(value.readingTimeMinutes);
	const minReadingTime = formatReadingTime(calculateReadingTime(value.minimum));
	const maxReadingTime = formatReadingTime(calculateReadingTime(value.maximum));

	// Check if near capacity
	const isNearCapacity = value.maximum > ABSOLUTE_CAP * 0.9;
	const utilizationPercent = Math.round((value.current / ABSOLUTE_CAP) * 100);

	return (
		<div className={cn("space-y-3", className)}>
			{/* Labels and values */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<BookOpen className="h-4 w-4 text-muted-foreground" />
					<span className={cn("font-medium", sizeConfig.fontSize)}>
						Token Budget
					</span>
				</div>
				<div className={cn("text-muted-foreground", sizeConfig.fontSize)}>
					<span className="font-medium text-foreground">
						{value.minimum.toLocaleString()}
					</span>
					<span className="mx-1">–</span>
					<span className="font-medium text-foreground">
						{value.maximum.toLocaleString()}
					</span>
					<span className="ml-1">tokens</span>
				</div>
			</div>

			{/* Dual-thumb slider */}
			<SliderPrimitive.Root
				className={cn(
					"relative flex w-full touch-none select-none items-center",
					disabled && "opacity-50 cursor-not-allowed"
				)}
				value={[value.minimum, value.maximum]}
				onValueChange={handleValueChange}
				min={min}
				max={effectiveMax}
				step={step}
				disabled={disabled}
				aria-label="Token budget range"
			>
				<SliderPrimitive.Track
					className={cn(
						"relative w-full grow overflow-hidden rounded-full bg-secondary",
						sizeConfig.trackHeight
					)}
				>
					<SliderPrimitive.Range
						className={cn(
							"absolute h-full bg-primary",
							isNearCapacity && "bg-amber-500"
						)}
					/>
				</SliderPrimitive.Track>

				{/* Min thumb */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<SliderPrimitive.Thumb
								className={cn(
									"block rounded-full border-2 border-primary bg-background",
									"ring-offset-background transition-colors",
									"focus-visible:outline-none focus-visible:ring-2",
									"focus-visible:ring-ring focus-visible:ring-offset-2",
									"disabled:pointer-events-none disabled:opacity-50",
									"cursor-grab active:cursor-grabbing",
									sizeConfig.thumbSize
								)}
								aria-label={`Minimum tokens: ${value.minimum}`}
							/>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-xs">
							Min: {value.minimum} tokens ({minReadingTime})
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Max thumb */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<SliderPrimitive.Thumb
								className={cn(
									"block rounded-full border-2 border-primary bg-background",
									"ring-offset-background transition-colors",
									"focus-visible:outline-none focus-visible:ring-2",
									"focus-visible:ring-ring focus-visible:ring-offset-2",
									"disabled:pointer-events-none disabled:opacity-50",
									"cursor-grab active:cursor-grabbing",
									isNearCapacity && "border-amber-500",
									sizeConfig.thumbSize
								)}
								aria-label={`Maximum tokens: ${value.maximum}`}
							/>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-xs">
							Max: {value.maximum} tokens ({maxReadingTime})
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</SliderPrimitive.Root>

			{/* Scale markers */}
			<div className="flex justify-between text-[10px] text-muted-foreground px-1">
				<span>{min}</span>
				<span>{Math.round((min + effectiveMax) / 2)}</span>
				<span>{effectiveMax}</span>
			</div>

			{/* Reading time and meter */}
			<div className="flex items-center justify-between">
				{showReadingTime && (
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Clock className="h-3.5 w-3.5" />
						<span>~{readingTimeDisplay} read time</span>
					</div>
				)}

				{showMeter && (
					<div className="flex items-center gap-2">
						{isNearCapacity && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1 text-amber-500">
											<AlertTriangle className="h-3.5 w-3.5" />
											<span className="text-xs">{utilizationPercent}%</span>
										</div>
									</TooltipTrigger>
									<TooltipContent side="left" className="text-xs">
										Near context buffer capacity ({ABSOLUTE_CAP} tokens max)
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
						<BudgetMeter
							current={value.current}
							min={value.minimum}
							max={value.maximum}
							cap={ABSOLUTE_CAP}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Budget Meter Component
// ============================================================================

interface BudgetMeterProps {
	current: number;
	min: number;
	max: number;
	cap: number;
}

function BudgetMeter({ current, min, max, cap }: BudgetMeterProps) {
	const rangeWidth = ((max - min) / cap) * 100;
	const rangeStart = (min / cap) * 100;
	const currentPos = ((current - min) / (max - min)) * rangeWidth + rangeStart;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="relative w-16 h-2 bg-muted rounded-full overflow-hidden cursor-help">
						{/* Range indicator */}
						<div
							className="absolute h-full bg-primary/30"
							style={{
								left: `${rangeStart}%`,
								width: `${rangeWidth}%`,
							}}
						/>
						{/* Current position marker */}
						<div
							className="absolute h-full w-0.5 bg-primary"
							style={{ left: `${currentPos}%` }}
						/>
						{/* Cap warning zone */}
						<div
							className="absolute h-full bg-amber-500/20"
							style={{
								right: 0,
								width: "10%",
							}}
						/>
					</div>
				</TooltipTrigger>
				<TooltipContent side="top" className="text-xs">
					<p>Current: {current} tokens</p>
					<p>Range: {min} – {max}</p>
					<p>Cap: {cap}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Single Value Slider (for current token target)
// ============================================================================

export interface SingleTokenSliderProps {
	/** Current token value */
	value: number;
	/** Callback when value changes */
	onChange: (value: number) => void;
	/** Minimum value */
	min?: number;
	/** Maximum value */
	max?: number;
	/** Step increment */
	step?: number;
	/** Whether to show reading time */
	showReadingTime?: boolean;
	/** Whether disabled */
	disabled?: boolean;
	/** Additional className */
	className?: string;
}

export function SingleTokenSlider({
	value,
	onChange,
	min = DEFAULT_MIN,
	max = DEFAULT_MAX,
	step = DEFAULT_STEP,
	showReadingTime = true,
	disabled = false,
	className,
}: SingleTokenSliderProps) {
	const effectiveMax = Math.min(max, ABSOLUTE_CAP);
	const readingTime = formatReadingTime(calculateReadingTime(value));

	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">Token Budget</span>
				<span className="font-medium">{value.toLocaleString()} tokens</span>
			</div>

			<SliderPrimitive.Root
				className={cn(
					"relative flex w-full touch-none select-none items-center",
					disabled && "opacity-50 cursor-not-allowed"
				)}
				value={[value]}
				onValueChange={(v) => onChange(v[0])}
				min={min}
				max={effectiveMax}
				step={step}
				disabled={disabled}
				aria-label="Token budget"
			>
				<SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
					<SliderPrimitive.Range className="absolute h-full bg-primary" />
				</SliderPrimitive.Track>
				<SliderPrimitive.Thumb
					className={cn(
						"block h-4 w-4 rounded-full border-2 border-primary bg-background",
						"ring-offset-background transition-colors",
						"focus-visible:outline-none focus-visible:ring-2",
						"focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:pointer-events-none disabled:opacity-50",
						"cursor-grab active:cursor-grabbing"
					)}
				/>
			</SliderPrimitive.Root>

			{showReadingTime && (
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Clock className="h-3.5 w-3.5" />
					<span>~{readingTime} read time</span>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Preset Buttons
// ============================================================================

export interface TokenPresetButtonsProps {
	/** Callback when preset is selected */
	onSelect: (config: TokenBudgetConfig) => void;
	/** Currently selected preset (for highlighting) */
	currentMax?: number;
	/** Whether disabled */
	disabled?: boolean;
	/** Additional className */
	className?: string;
}

const PRESETS = [
	{ label: "Brief", min: 100, max: 300, description: "~1 min read" },
	{ label: "Standard", min: 300, max: 800, description: "~2-3 min read" },
	{ label: "Detailed", min: 800, max: 1500, description: "~5 min read" },
	{ label: "Comprehensive", min: 1500, max: 2500, description: "~8 min read" },
] as const;

export function TokenPresetButtons({
	onSelect,
	currentMax,
	disabled = false,
	className,
}: TokenPresetButtonsProps) {
	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{PRESETS.map((preset) => {
				const isSelected = currentMax === preset.max;
				return (
					<TooltipProvider key={preset.label}>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									disabled={disabled}
									onClick={() =>
										onSelect(createTokenBudgetConfig(preset.min, preset.max))
									}
									className={cn(
										"px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
										"border hover:bg-accent",
										isSelected
											? "border-primary bg-primary/10 text-primary"
											: "border-border text-muted-foreground",
										disabled && "opacity-50 cursor-not-allowed"
									)}
								>
									{preset.label}
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								{preset.min}–{preset.max} tokens ({preset.description})
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				);
			})}
		</div>
	);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format reading time as human-readable string.
 */
function formatReadingTime(minutes: number): string {
	if (minutes < 1) {
		const seconds = Math.round(minutes * 60);
		return `${seconds} sec`;
	}
	if (minutes < 60) {
		return `${Math.round(minutes)} min`;
	}
	const hours = Math.floor(minutes / 60);
	const mins = Math.round(minutes % 60);
	return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/**
 * Create default token budget config.
 */
export function createDefaultTokenBudget(): TokenBudgetConfig {
	return createTokenBudgetConfig(300, 800, 500);
}

// ============================================================================
// Exports
// ============================================================================

export default TokenBudgetSlider;
export { ABSOLUTE_CAP, DEFAULT_MIN, DEFAULT_MAX, DEFAULT_STEP, PRESETS };
