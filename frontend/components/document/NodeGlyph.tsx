"use client";

/**
 * NodeGlyph - Unicode Status Indicators per HDSI Specification
 *
 * Glyphs:
 * - ◻ (U+25FB) - Unexpanded/outline status
 * - ■ (U+25A0) - Generated content
 * - ⬤ (U+2B24) - Active generation (with pulse animation)
 * - ⚠ (U+26A0) - Coherence debt (with variable pulse frequency)
 *
 * Benefits over icon components:
 * - Native text rendering (no SVG overhead)
 * - Perfect scaling with font size
 * - Theme-aware coloring via CSS
 * - Reduced bundle size
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { HDSINode } from "@/lib/hdsi/types";

// ============================================================================
// Types
// ============================================================================

export type NodeStatus = HDSINode["status"];

export interface NodeGlyphProps {
	/** Node status determines which glyph to display */
	status: NodeStatus;
	/** Whether the node is currently being generated */
	isGenerating?: boolean;
	/** Coherence score (0-1) - triggers debt glyph when < 0.6 */
	coherenceScore?: number;
	/** Size variant */
	size?: "sm" | "md" | "lg";
	/** Additional className */
	className?: string;
	/** Whether to show tooltip on hover */
	showTooltip?: boolean;
}

// ============================================================================
// Glyph Constants
// ============================================================================

/**
 * Unicode glyphs per HDSI specification.
 * Using characters that render consistently across platforms.
 */
const GLYPHS = {
	/** Unexpanded/outline - white medium square */
	outline: "◻",
	/** Generated content - black square */
	generated: "■",
	/** Active generation - black circle */
	generating: "⬤",
	/** Coherence debt - warning sign */
	debt: "⚠",
	/** Error state - cross mark */
	error: "✕",
	/** Deleted state - strikethrough circle */
	deleted: "⊘",
} as const;

/**
 * Status to glyph mapping.
 */
const STATUS_GLYPH_MAP: Record<NodeStatus, string> = {
	outline: GLYPHS.outline,
	generating: GLYPHS.generating,
	generated: GLYPHS.generated,
	debt: GLYPHS.debt,
	error: GLYPHS.error,
	deleted: GLYPHS.deleted,
};

/**
 * Status descriptions for tooltips.
 */
const STATUS_DESCRIPTIONS: Record<NodeStatus, string> = {
	outline: "Not yet generated",
	generating: "Generating content...",
	generated: "Content generated",
	debt: "Coherence issues detected",
	error: "Generation failed",
	deleted: "Marked for deletion",
};

/**
 * Size classes for the glyph.
 */
const SIZE_CLASSES = {
	sm: "text-xs leading-none",
	md: "text-sm leading-none",
	lg: "text-base leading-none",
} as const;

// ============================================================================
// Pulse Frequency Calculator
// ============================================================================

/**
 * Calculate pulse animation duration based on coherence score.
 * Lower scores = faster pulsing (more urgent).
 *
 * Score 0.5 → 3 Hz (333ms)
 * Score 0.6 → 0.5 Hz (2000ms)
 *
 * Linear interpolation between these bounds.
 */
export function calculatePulseDuration(coherenceScore: number): number {
	const MIN_SCORE = 0.5;
	const MAX_SCORE = 0.6;
	const MIN_HZ = 0.5; // Slowest pulse
	const MAX_HZ = 3.0; // Fastest pulse

	// Clamp score to valid range
	const clampedScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, coherenceScore));

	// Linear interpolation: lower score = higher frequency
	const t = (clampedScore - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
	const hz = MAX_HZ - t * (MAX_HZ - MIN_HZ);

	// Convert Hz to milliseconds (period = 1/frequency * 1000)
	return Math.round(1000 / hz);
}

// ============================================================================
// Main Component
// ============================================================================

export function NodeGlyph({
	status,
	isGenerating = false,
	coherenceScore = 1.0,
	size = "md",
	className,
	showTooltip = false,
}: NodeGlyphProps) {
	// Determine effective status (generating overrides other statuses)
	const effectiveStatus = isGenerating ? "generating" : status;

	// Check if coherence debt should be shown
	const showDebt = coherenceScore < 0.6 && effectiveStatus === "generated";
	const finalStatus = showDebt ? "debt" : effectiveStatus;

	// Get glyph and styling
	const glyph = STATUS_GLYPH_MAP[finalStatus];
	const description = STATUS_DESCRIPTIONS[finalStatus];

	// Calculate pulse duration for debt/generating states
	const pulseDuration =
		finalStatus === "debt" ? calculatePulseDuration(coherenceScore) : 1000;

	const glyphElement = (
		<span
			className={cn(
				"inline-flex items-center justify-center select-none font-mono",
				SIZE_CLASSES[size],
				// Status-specific colors
				finalStatus === "outline" && "text-muted-foreground",
				finalStatus === "generated" && "text-green-600 dark:text-green-400",
				finalStatus === "generating" && "text-primary animate-glyph-pulse",
				finalStatus === "debt" &&
					"text-amber-500 dark:text-amber-400 animate-coherence-pulse",
				finalStatus === "error" && "text-destructive",
				finalStatus === "deleted" && "text-muted-foreground/50 line-through",
				className
			)}
			style={
				(finalStatus === "debt" || finalStatus === "generating") &&
				pulseDuration !== 1000
					? ({ "--pulse-duration": `${pulseDuration}ms` } as React.CSSProperties)
					: undefined
			}
			aria-label={description}
			role="img"
		>
			{glyph}
		</span>
	);

	// Wrap with tooltip if requested
	if (showTooltip) {
		return (
			<span title={description} className="cursor-help">
				{glyphElement}
			</span>
		);
	}

	return glyphElement;
}

// ============================================================================
// Compound Components for Specific States
// ============================================================================

/**
 * Outline glyph - node has no content yet.
 */
export function OutlineGlyph({
	size = "md",
	className,
}: Pick<NodeGlyphProps, "size" | "className">) {
	return <NodeGlyph status="outline" size={size} className={className} />;
}

/**
 * Generated glyph - node has generated content.
 */
export function GeneratedGlyph({
	size = "md",
	className,
	coherenceScore = 1.0,
}: Pick<NodeGlyphProps, "size" | "className" | "coherenceScore">) {
	return (
		<NodeGlyph
			status="generated"
			coherenceScore={coherenceScore}
			size={size}
			className={className}
		/>
	);
}

/**
 * Generating glyph - content is being generated.
 */
export function GeneratingGlyph({
	size = "md",
	className,
}: Pick<NodeGlyphProps, "size" | "className">) {
	return (
		<NodeGlyph
			status="generating"
			isGenerating={true}
			size={size}
			className={className}
		/>
	);
}

/**
 * Debt glyph - coherence issues detected.
 */
export function DebtGlyph({
	size = "md",
	className,
	coherenceScore = 0.5,
}: Pick<NodeGlyphProps, "size" | "className" | "coherenceScore">) {
	return (
		<NodeGlyph
			status="debt"
			coherenceScore={coherenceScore}
			size={size}
			className={className}
		/>
	);
}

// ============================================================================
// Status Badge Component (glyph + text)
// ============================================================================

export interface StatusBadgeProps extends NodeGlyphProps {
	/** Show status text alongside glyph */
	showText?: boolean;
}

export function StatusBadge({
	status,
	isGenerating = false,
	coherenceScore = 1.0,
	size = "md",
	showText = true,
	className,
}: StatusBadgeProps) {
	const effectiveStatus = isGenerating ? "generating" : status;
	const showDebt = coherenceScore < 0.6 && effectiveStatus === "generated";
	const finalStatus = showDebt ? "debt" : effectiveStatus;
	const description = STATUS_DESCRIPTIONS[finalStatus];

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5",
				SIZE_CLASSES[size],
				className
			)}
		>
			<NodeGlyph
				status={status}
				isGenerating={isGenerating}
				coherenceScore={coherenceScore}
				size={size}
			/>
			{showText && (
				<span className="text-muted-foreground capitalize">{description}</span>
			)}
		</span>
	);
}

// ============================================================================
// Exports
// ============================================================================

export default NodeGlyph;
export { GLYPHS, STATUS_GLYPH_MAP, STATUS_DESCRIPTIONS };
