/**
 * Document status badge component for DocFusion.
 *
 * Displays a colored badge indicating the document's status.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/types/document";

/**
 * Status configuration with colors and labels.
 */
const statusConfig: Record<
	DocumentStatus,
	{ bg: string; text: string; label: string }
> = {
	draft: {
		bg: "bg-gray-100 dark:bg-gray-800",
		text: "text-gray-600 dark:text-gray-400",
		label: "Draft",
	},
	in_review: {
		bg: "bg-amber-100 dark:bg-amber-900/30",
		text: "text-amber-700 dark:text-amber-400",
		label: "In Review",
	},
	approved: {
		bg: "bg-green-100 dark:bg-green-900/30",
		text: "text-green-700 dark:text-green-400",
		label: "Approved",
	},
	archived: {
		bg: "bg-gray-100 dark:bg-gray-800",
		text: "text-gray-500 dark:text-gray-500",
		label: "Archived",
	},
};

/**
 * Props for StatusBadge component.
 */
export interface StatusBadgeProps {
	/** Document status to display */
	status: DocumentStatus;
	/** Additional CSS classes */
	className?: string;
	/** Size variant */
	size?: "sm" | "md";
}

/**
 * StatusBadge component.
 *
 * @example
 * ```tsx
 * <StatusBadge status="draft" />
 * <StatusBadge status="approved" size="sm" />
 * ```
 */
export function StatusBadge({
	status,
	className,
	size = "md",
}: StatusBadgeProps) {
	const config = statusConfig[status];

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full font-medium",
				config.bg,
				config.text,
				size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs",
				className
			)}
		>
			{config.label}
		</span>
	);
}

/**
 * Get the label for a document status.
 */
export function getStatusLabel(status: DocumentStatus): string {
	return statusConfig[status].label;
}

/**
 * Get all available statuses.
 */
export const documentStatuses: DocumentStatus[] = [
	"draft",
	"in_review",
	"approved",
	"archived",
];
