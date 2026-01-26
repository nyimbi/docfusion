/**
 * Global error page for DocFusion.
 *
 * This page is displayed when an unhandled error occurs
 * in any part of the application. It provides user-friendly
 * error messages and recovery options.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	AlertTriangle,
	RefreshCw,
	Home,
	MessageSquare,
	ChevronDown,
	ChevronUp,
	Copy,
	Check,
	ExternalLink,
} from "lucide-react";

/**
 * Props for the error page.
 */
interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

/**
 * Global error page component.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
	const [showDetails, setShowDetails] = React.useState(false);
	const [copied, setCopied] = React.useState(false);

	// Log error in development
	React.useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			console.error("Global error:", error);
		}
	}, [error]);

	const handleCopyError = async () => {
		try {
			const details = [
				`Error: ${error.name || "Unknown"}`,
				`Message: ${error.message}`,
				error.digest && `Digest: ${error.digest}`,
				error.stack && `\nStack:\n${error.stack}`,
			]
				.filter(Boolean)
				.join("\n");

			await navigator.clipboard.writeText(details);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			console.error("Failed to copy error details");
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
			{/* Header */}
			<header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<Link
							href="/"
							className="text-xl font-bold text-gray-900 dark:text-white"
						>
							DocFusion
						</Link>
						<Button variant="ghost" asChild>
							<Link href="/documents">
								<Home className="h-4 w-4 mr-2" />
								Go to Documents
							</Link>
						</Button>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 flex items-center justify-center p-8">
				<div className="max-w-xl w-full text-center">
					{/* Error illustration */}
					<div className="mb-8">
						<div className="h-24 w-24 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
							<AlertTriangle className="h-12 w-12 text-red-500" />
						</div>
					</div>

					{/* Error message */}
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
						Something went wrong
					</h1>
					<p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
						{error.message ||
							"An unexpected error occurred. Please try again or contact support if the problem persists."}
					</p>

					{/* Primary actions */}
					<div className="flex flex-wrap items-center justify-center gap-4 mb-8">
						<Button onClick={reset} size="lg">
							<RefreshCw className="h-5 w-5 mr-2" />
							Try Again
						</Button>
						<Button variant="outline" size="lg" asChild>
							<Link href="/">
								<Home className="h-5 w-5 mr-2" />
								Go Home
							</Link>
						</Button>
					</div>

					{/* Secondary actions */}
					<div className="flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
						<a
							href="https://status.docfusion.app"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
						>
							Check System Status
							<ExternalLink className="h-3 w-3" />
						</a>
						<a
							href="mailto:support@docfusion.app"
							className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
						>
							<MessageSquare className="h-4 w-4" />
							Contact Support
						</a>
					</div>

					{/* Error details (development only) */}
					{process.env.NODE_ENV === "development" && (
						<div className="mt-12">
							<button
								type="button"
								onClick={() => setShowDetails(!showDetails)}
								className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							>
								{showDetails ? "Hide" : "Show"} Technical Details
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
										{`Error: ${error.name || "Unknown"}\nMessage: ${error.message}${error.digest ? `\nDigest: ${error.digest}` : ""}${error.stack ? `\n\nStack Trace:\n${error.stack}` : ""}`}
									</pre>
								</div>
							)}
						</div>
					)}

					{/* Error ID */}
					{error.digest && (
						<p className="text-xs text-gray-400 mt-8">
							Error ID: <code className="font-mono">{error.digest}</code>
						</p>
					)}
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-4">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
					Need help?{" "}
					<a
						href="mailto:support@docfusion.app"
						className="text-blue-600 dark:text-blue-400 hover:underline"
					>
						Contact support
					</a>
				</div>
			</footer>
		</div>
	);
}
