/**
 * Template detail page for DocFusion.
 *
 * Displays a full template preview with all metadata,
 * placeholders, and the ability to create a document from it.
 */

"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTemplateWithCategories } from "@/lib/query/hooks/useTemplates";
import { TemplatePreview, UseTemplateButton } from "@/components/templates";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ArrowLeft,
	LayoutTemplate,
	Star,
	Users,
	Clock,
	Calendar,
	Share2,
	Bookmark,
	MoreHorizontal,
	Edit,
	Trash2,
	Copy,
	ExternalLink,
	AlertCircle,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Template detail page component.
 */
export default function TemplateDetailPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const router = useRouter();
	const templateId = params.id as string;

	// Check if we should open the use dialog immediately
	const shouldOpenUseDialog = searchParams.get("action") === "use";

	// Fetch template with categories
	const { data: template, isLoading, isError, error } = useTemplateWithCategories(templateId);

	// State for bookmarking
	const [isBookmarked, setIsBookmarked] = React.useState(false);

	// Format date
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	// Handle share
	const handleShare = async () => {
		try {
			if (navigator.share) {
				await navigator.share({
					title: template?.name,
					text: template?.description,
					url: window.location.href,
				});
			} else {
				await navigator.clipboard.writeText(window.location.href);
				// Would show a toast notification here
			}
		} catch (error) {
			console.error("Share error:", error);
		}
	};

	// Handle duplicate
	const handleDuplicate = async () => {
		// This would call an API to duplicate the template
		console.log("Duplicate template:", templateId);
	};

	// Loading state
	if (isLoading) {
		return <TemplateDetailSkeleton />;
	}

	// Error state
	if (isError || !template) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
				<div className="text-center px-4">
					<div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
						<AlertCircle className="h-8 w-8 text-red-500" />
					</div>
					<h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
						Template not found
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mb-6">
						{error?.message ?? "The template you're looking for doesn't exist or has been removed."}
					</p>
					<Button asChild>
						<Link href="/templates">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Templates
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Header */}
			<header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						{/* Back button and title */}
						<div className="flex items-center gap-4">
							<Button variant="ghost" size="sm" asChild>
								<Link href="/templates">
									<ArrowLeft className="h-4 w-4 mr-2" />
									Templates
								</Link>
							</Button>
							<div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
							<div className="flex items-center gap-2">
								<LayoutTemplate className="h-5 w-5 text-gray-400" />
								<span className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
									{template.name}
								</span>
							</div>
						</div>

						{/* Actions */}
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setIsBookmarked(!isBookmarked)}
									>
										<Bookmark
											className={cn(
												"h-4 w-4",
												isBookmarked && "fill-current text-amber-500"
											)}
										/>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{isBookmarked ? "Remove bookmark" : "Bookmark template"}
								</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="sm" onClick={handleShare}>
										<Share2 className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Share template</TooltipContent>
							</Tooltip>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="sm">
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={handleDuplicate}>
										<Copy className="h-4 w-4 mr-2" />
										Duplicate
									</DropdownMenuItem>
									<DropdownMenuItem>
										<ExternalLink className="h-4 w-4 mr-2" />
										Open in new tab
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<Edit className="h-4 w-4 mr-2" />
										Edit template
									</DropdownMenuItem>
									<DropdownMenuItem className="text-red-600 dark:text-red-400">
										<Trash2 className="h-4 w-4 mr-2" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							<UseTemplateButton
								template={template}
								size="sm"
								className="ml-2"
							/>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="container mx-auto px-4 py-8">
				<div className="grid lg:grid-cols-3 gap-8">
					{/* Main preview */}
					<div className="lg:col-span-2">
						<TemplatePreview
							template={template}
							categories={template.categories}
							variant="full"
							highlightPlaceholders
						/>
					</div>

					{/* Sidebar */}
					<aside className="lg:col-span-1">
						<div className="sticky top-24 space-y-6">
							{/* Quick use card */}
							<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
								<h3 className="font-semibold text-gray-900 dark:text-white mb-4">
									Use this template
								</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
									Create a new document from this template and fill in your details.
								</p>
								<UseTemplateButton
									template={template}
									className="w-full"
									label="Create Document"
								/>
							</div>

							{/* Stats card */}
							<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
								<h3 className="font-semibold text-gray-900 dark:text-white mb-4">
									Template Stats
								</h3>
								<div className="space-y-4">
									{/* Rating */}
									{template.rating !== undefined && (
										<div className="flex items-center justify-between">
											<span className="text-sm text-gray-500 dark:text-gray-400">
												Rating
											</span>
											<div className="flex items-center gap-1">
												<Star className="h-4 w-4 text-amber-500 fill-amber-500" />
												<span className="font-medium text-gray-900 dark:text-white">
													{template.rating.toFixed(1)}
												</span>
												{template.ratingCount && (
													<span className="text-sm text-gray-400">
														({template.ratingCount})
													</span>
												)}
											</div>
										</div>
									)}

									{/* Use count */}
									<div className="flex items-center justify-between">
										<span className="text-sm text-gray-500 dark:text-gray-400">
											Documents created
										</span>
										<div className="flex items-center gap-1">
											<Users className="h-4 w-4 text-gray-400" />
											<span className="font-medium text-gray-900 dark:text-white">
												{template.useCount.toLocaleString()}
											</span>
										</div>
									</div>

									{/* Estimated time */}
									{template.estimatedTime && (
										<div className="flex items-center justify-between">
											<span className="text-sm text-gray-500 dark:text-gray-400">
												Estimated time
											</span>
											<div className="flex items-center gap-1">
												<Clock className="h-4 w-4 text-gray-400" />
												<span className="font-medium text-gray-900 dark:text-white">
													{template.estimatedTime < 60
														? `${template.estimatedTime} min`
														: `${Math.floor(template.estimatedTime / 60)}h ${template.estimatedTime % 60}m`}
												</span>
											</div>
										</div>
									)}

									{/* Created date */}
									<div className="flex items-center justify-between">
										<span className="text-sm text-gray-500 dark:text-gray-400">
											Created
										</span>
										<div className="flex items-center gap-1">
											<Calendar className="h-4 w-4 text-gray-400" />
											<span className="text-sm text-gray-900 dark:text-white">
												{formatDate(template.createdAt)}
											</span>
										</div>
									</div>

									{/* Updated date */}
									{template.updatedAt !== template.createdAt && (
										<div className="flex items-center justify-between">
											<span className="text-sm text-gray-500 dark:text-gray-400">
												Last updated
											</span>
											<span className="text-sm text-gray-900 dark:text-white">
												{formatDate(template.updatedAt)}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Quick info */}
							<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
								<h3 className="font-semibold text-gray-900 dark:text-white mb-4">
									Quick Info
								</h3>
								<div className="space-y-3 text-sm">
									<div className="flex items-center justify-between">
										<span className="text-gray-500 dark:text-gray-400">
											Placeholders
										</span>
										<span className="font-medium text-gray-900 dark:text-white">
											{template.placeholders.length}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-gray-500 dark:text-gray-400">
											Required fields
										</span>
										<span className="font-medium text-gray-900 dark:text-white">
											{template.placeholders.filter((p) => p.required).length}
										</span>
									</div>
									{template.aiInstructions.length > 0 && (
										<div className="flex items-center justify-between">
											<span className="text-gray-500 dark:text-gray-400">
												AI prompts
											</span>
											<span className="font-medium text-gray-900 dark:text-white">
												{template.aiInstructions.length}
											</span>
										</div>
									)}
									{template.complianceRequirements.length > 0 && (
										<div className="flex items-center justify-between">
											<span className="text-gray-500 dark:text-gray-400">
												Compliance checks
											</span>
											<span className="font-medium text-gray-900 dark:text-white">
												{template.complianceRequirements.length}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Related templates (would need additional query) */}
							<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
								<h3 className="font-semibold text-gray-900 dark:text-white mb-4">
									Similar Templates
								</h3>
								<p className="text-sm text-gray-500 dark:text-gray-400">
									Browse more templates in{" "}
									{template.categories.map((c, i) => (
										<span key={c.id}>
											{i > 0 && ", "}
											<Link
												href={`/templates?categoryId=${c.id}`}
												className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
											>
												{c.name}
											</Link>
										</span>
									))}
								</p>
							</div>
						</div>
					</aside>
				</div>
			</main>
		</div>
	);
}

/**
 * Loading skeleton for template detail page.
 */
function TemplateDetailSkeleton() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Header skeleton */}
			<header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Skeleton className="h-8 w-24" />
							<Skeleton className="h-6 w-px" />
							<Skeleton className="h-5 w-48" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="h-8 w-8" />
							<Skeleton className="h-8 w-8" />
							<Skeleton className="h-8 w-8" />
							<Skeleton className="h-8 w-32 ml-2" />
						</div>
					</div>
				</div>
			</header>

			{/* Content skeleton */}
			<main className="container mx-auto px-4 py-8">
				<div className="grid lg:grid-cols-3 gap-8">
					{/* Main content skeleton */}
					<div className="lg:col-span-2 space-y-6">
						<div className="space-y-4">
							<Skeleton className="h-8 w-2/3" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</div>
						<div className="flex gap-4">
							<Skeleton className="h-6 w-20" />
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-6 w-16" />
						</div>
						<Skeleton className="h-64 w-full rounded-lg" />
						<Skeleton className="h-48 w-full rounded-lg" />
					</div>

					{/* Sidebar skeleton */}
					<div className="space-y-6">
						<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
							<Skeleton className="h-5 w-32 mb-4" />
							<Skeleton className="h-4 w-full mb-2" />
							<Skeleton className="h-4 w-2/3 mb-4" />
							<Skeleton className="h-10 w-full" />
						</div>
						<div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
							<Skeleton className="h-5 w-28 mb-4" />
							<div className="space-y-3">
								<div className="flex justify-between">
									<Skeleton className="h-4 w-16" />
									<Skeleton className="h-4 w-12" />
								</div>
								<div className="flex justify-between">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-16" />
								</div>
								<div className="flex justify-between">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-4 w-14" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
