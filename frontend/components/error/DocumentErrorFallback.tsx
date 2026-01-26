/**
 * Document error fallback component for DocFusion.
 *
 * Provides specialized error handling for document-related
 * operations including loading, saving, and collaboration errors.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	AlertTriangle,
	RefreshCw,
	FileText,
	Wifi,
	WifiOff,
	Save,
	Lock,
	Eye,
	ArrowLeft,
	HelpCircle,
	RotateCcw,
	ExternalLink,
} from "lucide-react";

/**
 * Document error types.
 */
export type DocumentErrorType =
	| "not_found"
	| "access_denied"
	| "network"
	| "save_failed"
	| "conflict"
	| "corrupt"
	| "version_mismatch"
	| "unknown";

/**
 * Props for DocumentErrorFallback.
 */
export interface DocumentErrorFallbackProps {
	/** Type of document error */
	errorType?: DocumentErrorType;
	/** Error message to display */
	message?: string;
	/** Document ID if available */
	documentId?: string;
	/** Document title if available */
	documentTitle?: string;
	/** Callback to retry the failed operation */
	onRetry?: () => void;
	/** Callback to go back */
	onGoBack?: () => void;
	/** Whether a retry is in progress */
	isRetrying?: boolean;
	/** Optional className for styling */
	className?: string;
}

/**
 * Error configuration for different error types.
 */
const errorConfigs: Record<
	DocumentErrorType,
	{
		icon: React.ElementType;
		iconBg: string;
		iconColor: string;
		title: string;
		description: string;
		actions: Array<"retry" | "home" | "back" | "help" | "view_only">;
	}
> = {
	not_found: {
		icon: FileText,
		iconBg: "bg-gray-100 dark:bg-gray-800",
		iconColor: "text-gray-500",
		title: "Document Not Found",
		description:
			"This document may have been deleted or moved. Check the URL or return to your documents.",
		actions: ["back", "home"],
	},
	access_denied: {
		icon: Lock,
		iconBg: "bg-amber-100 dark:bg-amber-900/30",
		iconColor: "text-amber-500",
		title: "Access Denied",
		description:
			"You don't have permission to view or edit this document. Contact the owner to request access.",
		actions: ["back", "home", "help"],
	},
	network: {
		icon: WifiOff,
		iconBg: "bg-red-100 dark:bg-red-900/30",
		iconColor: "text-red-500",
		title: "Connection Lost",
		description:
			"Unable to connect to the server. Check your internet connection and try again.",
		actions: ["retry"],
	},
	save_failed: {
		icon: Save,
		iconBg: "bg-red-100 dark:bg-red-900/30",
		iconColor: "text-red-500",
		title: "Save Failed",
		description:
			"Your changes couldn't be saved. Don't close this page - we'll keep trying to save your work.",
		actions: ["retry"],
	},
	conflict: {
		icon: AlertTriangle,
		iconBg: "bg-amber-100 dark:bg-amber-900/30",
		iconColor: "text-amber-500",
		title: "Editing Conflict",
		description:
			"This document was modified by someone else. Refresh to see the latest version (your unsaved changes will be preserved).",
		actions: ["retry", "view_only"],
	},
	corrupt: {
		icon: AlertTriangle,
		iconBg: "bg-red-100 dark:bg-red-900/30",
		iconColor: "text-red-500",
		title: "Document Error",
		description:
			"This document appears to be corrupted and cannot be loaded properly.",
		actions: ["back", "help"],
	},
	version_mismatch: {
		icon: RotateCcw,
		iconBg: "bg-blue-100 dark:bg-blue-900/30",
		iconColor: "text-blue-500",
		title: "Version Mismatch",
		description:
			"The document version has changed. Refresh to load the latest version.",
		actions: ["retry"],
	},
	unknown: {
		icon: AlertTriangle,
		iconBg: "bg-red-100 dark:bg-red-900/30",
		iconColor: "text-red-500",
		title: "Something Went Wrong",
		description:
			"An unexpected error occurred. Please try again or contact support if the problem persists.",
		actions: ["retry", "home", "help"],
	},
};

/**
 * Document error fallback component.
 *
 * @example
 * ```tsx
 * // Network error
 * <DocumentErrorFallback
 *   errorType="network"
 *   onRetry={() => refetch()}
 *   isRetrying={isRefetching}
 * />
 *
 * // Access denied
 * <DocumentErrorFallback
 *   errorType="access_denied"
 *   documentTitle="Q4 Proposal"
 *   onGoBack={() => router.back()}
 * />
 * ```
 */
export function DocumentErrorFallback({
	errorType = "unknown",
	message,
	documentId,
	documentTitle,
	onRetry,
	onGoBack,
	isRetrying = false,
	className,
}: DocumentErrorFallbackProps) {
	const config = errorConfigs[errorType];
	const Icon = config.icon;

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center min-h-[400px] p-8 text-center",
				className
			)}
		>
			{/* Error icon */}
			<div
				className={cn(
					"h-20 w-20 rounded-full flex items-center justify-center mb-6",
					config.iconBg
				)}
			>
				<Icon className={cn("h-10 w-10", config.iconColor)} />
			</div>

			{/* Error title and message */}
			<h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
				{config.title}
			</h2>

			{documentTitle && (
				<p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
					"{documentTitle}"
				</p>
			)}

			<p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
				{message || config.description}
			</p>

			{/* Action buttons */}
			<div className="flex flex-wrap items-center justify-center gap-3">
				{config.actions.map((action) => (
					<ActionButton
						key={action}
						action={action}
						onRetry={onRetry}
						onGoBack={onGoBack}
						isRetrying={isRetrying}
					/>
				))}
			</div>

			{/* Document ID for support */}
			{documentId && (
				<p className="text-xs text-gray-400 mt-8">
					Document ID: <code className="font-mono">{documentId}</code>
				</p>
			)}
		</div>
	);
}

/**
 * Action button component.
 */
function ActionButton({
	action,
	onRetry,
	onGoBack,
	isRetrying,
}: {
	action: "retry" | "home" | "back" | "help" | "view_only";
	onRetry?: () => void;
	onGoBack?: () => void;
	isRetrying: boolean;
}) {
	switch (action) {
		case "retry":
			return (
				<Button onClick={onRetry} disabled={isRetrying}>
					{isRetrying ? (
						<>
							<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
							Retrying...
						</>
					) : (
						<>
							<RefreshCw className="h-4 w-4 mr-2" />
							Try Again
						</>
					)}
				</Button>
			);

		case "home":
			return (
				<Button variant="outline" asChild>
					<Link href="/documents">
						<FileText className="h-4 w-4 mr-2" />
						Go to Documents
					</Link>
				</Button>
			);

		case "back":
			return onGoBack ? (
				<Button variant="outline" onClick={onGoBack}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Go Back
				</Button>
			) : (
				<Button variant="outline" asChild>
					<Link href="/documents">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Go Back
					</Link>
				</Button>
			);

		case "help":
			return (
				<Button variant="ghost" asChild>
					<a
						href="https://help.docfusion.app"
						target="_blank"
						rel="noopener noreferrer"
					>
						<HelpCircle className="h-4 w-4 mr-2" />
						Get Help
						<ExternalLink className="h-3 w-3 ml-1" />
					</a>
				</Button>
			);

		case "view_only":
			return (
				<Button variant="outline">
					<Eye className="h-4 w-4 mr-2" />
					View Only
				</Button>
			);

		default:
			return null;
	}
}

/**
 * Loading error state for documents.
 */
export function DocumentLoadingError({
	onRetry,
	isRetrying = false,
	className,
}: {
	onRetry?: () => void;
	isRetrying?: boolean;
	className?: string;
}) {
	return (
		<DocumentErrorFallback
			errorType="network"
			onRetry={onRetry}
			isRetrying={isRetrying}
			className={className}
		/>
	);
}

/**
 * Inline document error banner.
 */
export function DocumentErrorBanner({
	errorType,
	message,
	onRetry,
	onDismiss,
	className,
}: {
	errorType: DocumentErrorType;
	message?: string;
	onRetry?: () => void;
	onDismiss?: () => void;
	className?: string;
}) {
	const config = errorConfigs[errorType];
	const Icon = config.icon;

	return (
		<div
			className={cn(
				"flex items-center gap-4 p-4 rounded-lg border",
				"bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
				className
			)}
			role="alert"
		>
			<div
				className={cn(
					"flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center",
					config.iconBg
				)}
			>
				<Icon className={cn("h-5 w-5", config.iconColor)} />
			</div>

			<div className="flex-1 min-w-0">
				<p className="font-medium text-gray-900 dark:text-white">
					{config.title}
				</p>
				<p className="text-sm text-gray-600 dark:text-gray-400">
					{message || config.description}
				</p>
			</div>

			<div className="flex items-center gap-2 flex-shrink-0">
				{onRetry && (
					<Button size="sm" onClick={onRetry}>
						<RefreshCw className="h-4 w-4 mr-1" />
						Retry
					</Button>
				)}
				{onDismiss && (
					<Button variant="ghost" size="sm" onClick={onDismiss}>
						Dismiss
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * Autosave error indicator.
 */
export function AutosaveError({
	lastSaved,
	onRetry,
	isRetrying = false,
}: {
	lastSaved?: Date;
	onRetry?: () => void;
	isRetrying?: boolean;
}) {
	return (
		<div className="flex items-center gap-2 text-sm text-red-500">
			<AlertTriangle className="h-4 w-4" />
			<span>
				{isRetrying ? "Saving..." : "Save failed"}
				{lastSaved && ` (Last saved: ${formatTime(lastSaved)})`}
			</span>
			{onRetry && !isRetrying && (
				<button
					type="button"
					onClick={onRetry}
					className="underline hover:no-underline"
				>
					Retry
				</button>
			)}
		</div>
	);
}

/**
 * Format time helper.
 */
function formatTime(date: Date): string {
	return date.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	});
}
