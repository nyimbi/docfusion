/**
 * 404 Not Found page for DocFusion.
 *
 * Displayed when a user navigates to a page that doesn't exist.
 * Provides helpful navigation options to get back on track.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
	FileQuestion,
	Home,
	FileText,
	LayoutTemplate,
	Search,
	ArrowLeft,
} from "lucide-react";

/**
 * Not Found page component.
 */
export default function NotFound() {
	const router = useRouter();

	// Set document title for client-side rendering
	React.useEffect(() => {
		document.title = "Page Not Found | DocFusion";
	}, []);

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
						<nav className="flex items-center gap-4">
							<Link
								href="/documents"
								className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
							>
								Documents
							</Link>
							<Link
								href="/templates"
								className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
							>
								Templates
							</Link>
						</nav>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 flex items-center justify-center p-8">
				<div className="max-w-xl w-full text-center">
					{/* 404 illustration */}
					<div className="mb-8">
						<div className="h-32 w-32 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
							<FileQuestion className="h-16 w-16 text-gray-400" />
						</div>
					</div>

					{/* Error code */}
					<div className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-4">
						404
					</div>

					{/* Error message */}
					<h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
						Page not found
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
						Sorry, we couldn't find the page you're looking for. It might have been
						moved, deleted, or never existed in the first place.
					</p>

					{/* Primary actions */}
					<div className="flex flex-wrap items-center justify-center gap-4 mb-12">
						<Button asChild>
							<Link href="/">
								<Home className="h-4 w-4 mr-2" />
								Go Home
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link href="/documents">
								<FileText className="h-4 w-4 mr-2" />
								My Documents
							</Link>
						</Button>
					</div>

					{/* Quick links */}
					<div className="grid sm:grid-cols-3 gap-4">
						<QuickLink
							href="/documents"
							icon={FileText}
							title="Documents"
							description="View and manage your documents"
						/>
						<QuickLink
							href="/templates"
							icon={LayoutTemplate}
							title="Templates"
							description="Browse document templates"
						/>
						<QuickLink
							href="/documents/new"
							icon={Search}
							title="New Document"
							description="Start a new document"
						/>
					</div>

					{/* Help text */}
					<p className="text-sm text-gray-400 mt-12">
						If you believe this is a mistake, please{" "}
						<a
							href="mailto:support@docfusion.app"
							className="text-blue-600 dark:text-blue-400 hover:underline"
						>
							contact support
						</a>
					</p>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-4">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm text-gray-500">
					<button
						type="button"
						onClick={() => router.back()}
						className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
					>
						<ArrowLeft className="h-4 w-4" />
						Go back
					</button>
					<span>&copy; {new Date().getFullYear()} DocFusion</span>
				</div>
			</footer>
		</div>
	);
}

/**
 * Quick link card component.
 */
function QuickLink({
	href,
	icon: Icon,
	title,
	description,
}: {
	href: string;
	icon: React.ElementType;
	title: string;
	description: string;
}) {
	return (
		<Link
			href={href}
			className="flex flex-col items-center p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
		>
			<div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
				<Icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
			</div>
			<h3 className="font-medium text-gray-900 dark:text-white mb-1">
				{title}
			</h3>
			<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
				{description}
			</p>
		</Link>
	);
}
