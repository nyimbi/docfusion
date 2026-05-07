/**
 * Error boundary component for DocFusion.
 *
 * Catches JavaScript errors in child components, logs them,
 * and displays a fallback UI instead of crashing the app.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { captureClientException } from "@/lib/monitoring/sentry-client";
import {
	AlertTriangle,
	RefreshCw,
	Home,
	Bug,
	ChevronDown,
	ChevronUp,
	Copy,
	Check,
} from "lucide-react";

/**
 * Error information structure.
 */
export interface ErrorInfo {
	/** Error message */
	message: string;
	/** Error name/type */
	name: string;
	/** Stack trace */
	stack?: string;
	/** Component stack from React */
	componentStack?: string;
	/** Digest (Next.js error ID) */
	digest?: string;
}

/**
 * Props for error fallback components.
 */
export interface ErrorFallbackProps {
	/** The error that was caught */
	error: Error & { digest?: string };
	/** Function to reset the error boundary */
	reset: () => void;
	/** Optional className for styling */
	className?: string;
}

/**
 * Props for ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
	/** Child components to wrap */
	children: React.ReactNode;
	/** Custom fallback component */
	fallback?: React.ComponentType<ErrorFallbackProps>;
	/** Callback when error is caught */
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	/** Optional className for the wrapper */
	className?: string;
}

/**
 * State for ErrorBoundary.
 */
interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error boundary component.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={MyErrorFallback}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With error callback
 * <ErrorBoundary onError={(error) => reportToService(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		// Log error to console in development
		if (process.env.NODE_ENV === "development") {
			console.error("ErrorBoundary caught an error:", error, errorInfo);
		}

		// Report to Sentry with the React component stack for debuggability
		captureClientException(error, {
			componentStack: errorInfo.componentStack ?? undefined,
		});

		// Call optional error callback
		this.props.onError?.(error, errorInfo);
	}

	handleReset = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): React.ReactNode {
		const { hasError, error } = this.state;
		const { children, fallback: FallbackComponent, className } = this.props;

		if (hasError && error) {
			const fallbackProps: ErrorFallbackProps = {
				error: error as Error & { digest?: string },
				reset: this.handleReset,
				className,
			};

			if (FallbackComponent) {
				return <FallbackComponent {...fallbackProps} />;
			}

			return <DefaultErrorFallback {...fallbackProps} />;
		}

		return children;
	}
}

/**
 * Default error fallback UI.
 */
export function DefaultErrorFallback({
	error,
	reset,
	className,
}: ErrorFallbackProps) {
	const [showDetails, setShowDetails] = React.useState(false);
	const [copied, setCopied] = React.useState(false);

	const errorDetails = React.useMemo(() => {
		const details = [
			`Error: ${error.name || "Unknown"}`,
			`Message: ${error.message}`,
			error.digest && `Digest: ${error.digest}`,
			error.stack && `\nStack Trace:\n${error.stack}`,
		]
			.filter(Boolean)
			.join("\n");
		return details;
	}, [error]);

	const handleCopyError = async () => {
		try {
			await navigator.clipboard.writeText(errorDetails);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may not be available
			console.error("Failed to copy error details");
		}
	};

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center min-h-[300px] p-6 text-center",
				className
			)}
		>
			{/* Error icon */}
			<div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
				<AlertTriangle className="h-8 w-8 text-red-500" />
			</div>

			{/* Error message */}
			<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
				Something went wrong
			</h2>
			<p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
				{error.message || "An unexpected error occurred. Please try again."}
			</p>

			{/* Action buttons */}
			<div className="flex flex-wrap items-center justify-center gap-3 mb-6">
				<Button onClick={reset}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Try Again
				</Button>
				<Button variant="outline" asChild>
					<Link href="/">
						<Home className="h-4 w-4 mr-2" />
						Go Home
					</Link>
				</Button>
			</div>

			{/* Error details toggle */}
			{process.env.NODE_ENV === "development" && (
				<div className="w-full max-w-2xl">
					<button
						type="button"
						onClick={() => setShowDetails(!showDetails)}
						className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
					>
						<Bug className="h-4 w-4" />
						{showDetails ? "Hide" : "Show"} Error Details
						{showDetails ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</button>

					{showDetails && (
						<div className="mt-4 relative">
							<button
								type="button"
								onClick={handleCopyError}
								className="absolute top-2 right-2 p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
								title="Copy error details"
							>
								{copied ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</button>
							<pre className="text-left p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
								{errorDetails}
							</pre>
						</div>
					)}
				</div>
			)}

			{/* Error ID for support */}
			{error.digest && (
				<p className="text-xs text-gray-400 mt-4">
					Error ID: <code className="font-mono">{error.digest}</code>
				</p>
			)}
		</div>
	);
}

/**
 * Compact error fallback for smaller sections.
 */
export function CompactErrorFallback({
	error,
	reset,
	className,
}: ErrorFallbackProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg",
				className
			)}
		>
			<div className="flex items-center gap-3">
				<AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
				<div>
					<p className="font-medium text-red-700 dark:text-red-400">
						Failed to load
					</p>
					<p className="text-sm text-red-600 dark:text-red-500">
						{error.message || "An error occurred"}
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" onClick={reset}>
				<RefreshCw className="h-4 w-4 mr-1" />
				Retry
			</Button>
		</div>
	);
}

/**
 * Inline error display for form fields and small components.
 */
export function InlineError({
	message,
	className,
}: {
	message: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 text-sm text-red-500 dark:text-red-400",
				className
			)}
			role="alert"
		>
			<AlertTriangle className="h-4 w-4 flex-shrink-0" />
			<span>{message}</span>
		</div>
	);
}
