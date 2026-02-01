/**
 * StatusBadge Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * Displays status indicators with consistent styling and
 * accessible color combinations following the design system.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ===================
// Types
// ===================

/** Document status values */
export type DocumentStatus = "draft" | "in_review" | "approved" | "archived";

/** Proposal status values */
export type ProposalStatus = "draft" | "in_review" | "approved" | "submitted" | "won" | "lost" | "cancelled";

/** Client status values */
export type ClientStatus = "active" | "former" | "prospect";

/** Product status values */
export type ProductStatus = "active" | "discontinued" | "development";

/** Service status values */
export type ServiceStatus = "active" | "discontinued" | "limited";

/** Status badge props */
export interface StatusBadgeProps {
	/** Status value to display */
	status: DocumentStatus | ProposalStatus | string;
	/** Additional CSS classes */
	className?: string;
	/** Size variant */
	size?: "sm" | "md" | "lg";
	/** Show icon indicator */
	withDot?: boolean;
	/** Whether the badge is interactive */
	interactive?: boolean;
	/** Callback when badge is clicked (if interactive) */
	onClick?: () => void;
}

// ===================
// Status Configuration
// ===================

const DOCUMENT_STATUS_CONFIG: Record<
	DocumentStatus,
	{ bg: string; text: string; border: string; label: string; dotColor: string }
> = {
	draft: {
		bg: "bg-warning/10",
		text: "text-warning-foreground",
		border: "border-warning/20",
		label: "Draft",
		dotColor: "bg-warning",
	},
	in_review: {
		bg: "bg-info/10",
		text: "text-info-foreground",
		border: "border-info/20",
		label: "In Review",
		dotColor: "bg-info",
	},
	approved: {
		bg: "bg-success/10",
		text: "text-success-foreground",
		border: "border-success/20",
		label: "Approved",
		dotColor: "bg-success",
	},
	archived: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
		label: "Archived",
		dotColor: "bg-muted-foreground",
	},
};

const PROPOSAL_STATUS_CONFIG: Record<
	ProposalStatus,
	{ bg: string; text: string; border: string; label: string; dotColor: string }
> = {
	draft: {
		bg: "bg-warning/10",
		text: "text-warning-foreground",
		border: "border-warning/20",
		label: "Draft",
		dotColor: "bg-warning",
	},
	in_review: {
		bg: "bg-info/10",
		text: "text-info-foreground",
		border: "border-info/20",
		label: "In Review",
		dotColor: "bg-info",
	},
	approved: {
		bg: "bg-success/10",
		text: "text-success-foreground",
		border: "border-success/20",
		label: "Approved",
		dotColor: "bg-success",
	},
	submitted: {
		bg: "bg-primary/10",
		text: "text-primary-foreground",
		border: "border-primary/20",
		label: "Submitted",
		dotColor: "bg-primary",
	},
	won: {
		bg: "bg-success/10",
		text: "text-success-foreground",
		border: "border-success/20",
		label: "Won",
		dotColor: "bg-success",
	},
	lost: {
		bg: "bg-destructive/10",
		text: "text-destructive-foreground",
		border: "border-destructive/20",
		label: "Lost",
		dotColor: "bg-destructive",
	},
	cancelled: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
		label: "Cancelled",
		dotColor: "bg-muted-foreground",
	},
};

const CLIENT_STATUS_CONFIG: Record<
	ClientStatus,
	{ bg: string; text: string; border: string; label: string; dotColor: string }
> = {
	active: {
		bg: "bg-success/10",
		text: "text-success-foreground",
		border: "border-success/20",
		label: "Active",
		dotColor: "bg-success",
	},
	prospect: {
		bg: "bg-info/10",
		text: "text-info-foreground",
		border: "border-info/20",
		label: "Prospect",
		dotColor: "bg-info",
	},
	former: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
		label: "Former",
		dotColor: "bg-muted-foreground",
	},
};

const PRODUCT_STATUS_CONFIG: Record<
	ProductStatus,
	{ bg: string; text: string; border: string; label: string; dotColor: string }
> = {
	active: {
		bg: "bg-success/10",
		text: "text-success-foreground",
		border: "border-success/20",
		label: "Active",
		dotColor: "bg-success",
	},
	development: {
		bg: "bg-info/10",
		text: "text-info-foreground",
		border: "border-info/20",
		label: "Development",
		dotColor: "bg-info",
	},
	discontinued: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
		label: "Discontinued",
		dotColor: "bg-muted-foreground",
	},
};

const SERVICE_STATUS_CONFIG: Record<
	ServiceStatus,
	{ bg: string; text: string; border: string; label: string; dotColor: string }
> = {
	active: {
		bg: "bg-success/10",
		text: "text-success-foreground",
		border: "border-success/20",
		label: "Active",
		dotColor: "bg-success",
	},
	limited: {
		bg: "bg-warning/10",
		text: "text-warning-foreground",
		border: "border-warning/20",
		label: "Limited",
		dotColor: "bg-warning",
	},
	discontinued: {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-border",
		label: "Discontinued",
		dotColor: "bg-muted-foreground",
	},
};

// ===================
// Status Badge Component
// ===================

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
	({ status, className, size = "md", withDot = true, interactive, onClick, ...props }, ref) => {
	// Get configuration for the status
	const config = React.useMemo(() => {
		if (status in DOCUMENT_STATUS_CONFIG) {
			return DOCUMENT_STATUS_CONFIG[status as DocumentStatus];
		}
		if (status in PROPOSAL_STATUS_CONFIG) {
			return PROPOSAL_STATUS_CONFIG[status as ProposalStatus];
		}
		if (status in CLIENT_STATUS_CONFIG) {
			return CLIENT_STATUS_CONFIG[status as ClientStatus];
		}
		if (status in PRODUCT_STATUS_CONFIG) {
			return PRODUCT_STATUS_CONFIG[status as ProductStatus];
		}
		if (status in SERVICE_STATUS_CONFIG) {
			return SERVICE_STATUS_CONFIG[status as ServiceStatus];
		}
		// Fallback for unknown statuses
		return {
			bg: "bg-muted",
			text: "text-muted-foreground",
			border: "border-border",
			label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
			dotColor: "bg-muted-foreground",
		};
	}, [status]);

	// Size classes
	const sizeClasses = React.useMemo(() => {
		switch (size) {
			case "sm":
				return "px-2 py-0.5 text-xs gap-1";
			case "lg":
				return "px-3 py-1.5 text-sm gap-2";
			case "md":
			default:
				return "px-2.5 py-1 text-xs gap-1.5";
		}
	}, [size]);

	// Dot size
	const dotSize = React.useMemo(() => {
		switch (size) {
			case "sm":
				return "h-1.5 w-1.5";
			case "lg":
				return "h-2.5 w-2.5";
			case "md":
			default:
				return "h-2 w-2";
		}
	}, [size]);

	// Base classes
	const baseClasses = React.useMemo(
		() =>
			cn(
				"inline-flex items-center rounded-full font-medium",
				"border",
				sizeClasses,
				config.bg,
				config.text,
				config.border,
				interactive && [
					"cursor-pointer",
					"hover:shadow-sm",
					"active:scale-95",
					"transition-all duration-150 ease-out",
				],
				className
			),
		[config, sizeClasses, interactive, className]
	);

	return (
		<span
			ref={ref}
			className={baseClasses}
			onClick={onClick}
			role={interactive ? "button" : "status"}
			tabIndex={interactive ? 0 : undefined}
			{...props}
		>
			{withDot && (
				<span
					className={cn("rounded-full", dotSize, config.dotColor)}
					aria-hidden="true"
				/>
			)}
			{config.label}
		</span>
	);
	}
);

StatusBadge.displayName = "StatusBadge";

// ===================
// Utility Functions
// ===================

export function getStatusLabel(status: DocumentStatus | ProposalStatus | ClientStatus | ProductStatus | ServiceStatus | string): string {
	if (status in DOCUMENT_STATUS_CONFIG) {
		return DOCUMENT_STATUS_CONFIG[status as DocumentStatus].label;
	}
	if (status in PROPOSAL_STATUS_CONFIG) {
		return PROPOSAL_STATUS_CONFIG[status as ProposalStatus].label;
	}
	if (status in CLIENT_STATUS_CONFIG) {
		return CLIENT_STATUS_CONFIG[status as ClientStatus].label;
	}
	if (status in PRODUCT_STATUS_CONFIG) {
		return PRODUCT_STATUS_CONFIG[status as ProductStatus].label;
	}
	if (status in SERVICE_STATUS_CONFIG) {
		return SERVICE_STATUS_CONFIG[status as ServiceStatus].label;
	}
	return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

// ===================
// Constants
// ===================

export const documentStatuses: DocumentStatus[] = ["draft", "in_review", "approved", "archived"];

export const proposalStatuses: ProposalStatus[] = [
	"draft",
	"in_review",
	"approved",
	"submitted",
	"won",
	"lost",
	"cancelled",
];

export const clientStatuses: ClientStatus[] = ["active", "prospect", "former"];

export const productStatuses: ProductStatus[] = ["active", "development", "discontinued"];

export const serviceStatuses: ServiceStatus[] = ["active", "limited", "discontinued"];

// ===================
// Exports
// ===================

export { StatusBadge as Badge };
