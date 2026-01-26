"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCreateDocument } from "@/lib/query/mutations/useDocumentMutation";
import { useTemplates } from "@/lib/query/hooks/useTemplates";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { TemplateSkeleton } from "@/components/ui/skeleton";
import {
	ArrowLeft,
	FileText,
	LayoutTemplate,
	Sparkles,
	Clock,
	ChevronRight,
	Loader2,
} from "lucide-react";

/**
 * Create new document page.
 *
 * Features:
 * - Create blank document
 * - Create from template
 * - AI-assisted document creation
 */
export default function NewDocumentPage() {
	const router = useRouter();
	const [title, setTitle] = React.useState("");
	const [description, setDescription] = React.useState("");
	const [selectedTemplateId, setSelectedTemplateId] = React.useState<
		string | null
	>(null);
	const [creationMode, setCreationMode] = React.useState<
		"blank" | "template" | "ai"
	>("blank");

	const createMutation = useCreateDocument();
	const { data: templatesData, isLoading: templatesLoading } = useTemplates({
		limit: 6,
		sortBy: "useCount",
		sortOrder: "desc",
	});

	const handleCreate = async () => {
		try {
			const newDoc = await createMutation.mutateAsync({
				title: title || "Untitled Document",
				templateId: selectedTemplateId ?? undefined,
			});
			router.push(`/documents/${newDoc.id}`);
		} catch (err) {
			console.error("Failed to create document:", err);
		}
	};

	const handleQuickCreate = async () => {
		try {
			const newDoc = await createMutation.mutateAsync({
				title: "Untitled Document",
			});
			router.push(`/documents/${newDoc.id}`);
		} catch (err) {
			console.error("Failed to create document:", err);
		}
	};

	const templates = templatesData?.templates ?? [];

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center h-16 gap-4">
						<Link
							href="/documents"
							className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
						<h1 className="text-xl font-semibold text-gray-900 dark:text-white">
							Create New Document
						</h1>
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Quick start options */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					<QuickStartCard
						icon={FileText}
						title="Blank Document"
						description="Start with an empty document"
						selected={creationMode === "blank"}
						onClick={() => setCreationMode("blank")}
					/>
					<QuickStartCard
						icon={LayoutTemplate}
						title="From Template"
						description="Use a pre-built template"
						selected={creationMode === "template"}
						onClick={() => setCreationMode("template")}
					/>
					<QuickStartCard
						icon={Sparkles}
						title="AI Assisted"
						description="Generate content with AI"
						selected={creationMode === "ai"}
						onClick={() => setCreationMode("ai")}
						badge="Coming Soon"
						disabled
					/>
				</div>

				{/* Creation form */}
				<Card>
					<CardHeader>
						<CardTitle>Document Details</CardTitle>
						<CardDescription>
							Give your document a name and optional description
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="title">Title</Label>
							<Input
								id="title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter document title..."
								autoFocus
							/>
						</div>

						{creationMode === "template" && (
							<div className="space-y-2">
								<Label>Select Template</Label>
								{templatesLoading ? (
									<div className="grid grid-cols-2 gap-3">
										<TemplateSkeleton />
										<TemplateSkeleton />
									</div>
								) : templates.length === 0 ? (
									<p className="text-sm text-gray-500 dark:text-gray-400">
										No templates available.{" "}
										<Link
											href="/templates"
											className="text-blue-600 hover:underline"
										>
											Browse all templates
										</Link>
									</p>
								) : (
									<div className="grid grid-cols-2 gap-3">
										{templates.map((template) => (
											<TemplateOption
												key={template.id}
												title={template.name}
												description={template.description ?? ""}
												selected={selectedTemplateId === template.id}
												onClick={() =>
													setSelectedTemplateId(
														selectedTemplateId === template.id
															? null
															: template.id
													)
												}
											/>
										))}
									</div>
								)}
								<Link
									href="/templates"
									className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
								>
									Browse all templates
									<ChevronRight className="h-4 w-4" />
								</Link>
							</div>
						)}

						{creationMode === "ai" && (
							<div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
								<Sparkles className="h-8 w-8 mx-auto text-gray-400 mb-2" />
								<p className="text-sm text-gray-500 dark:text-gray-400">
									AI-assisted document creation is coming soon. This feature
									will allow you to describe what you want to create and have
									AI generate a starting point for your document.
								</p>
							</div>
						)}
					</CardContent>
					<CardFooter className="flex justify-between">
						<Button variant="ghost" onClick={() => router.back()}>
							Cancel
						</Button>
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={handleQuickCreate}
								disabled={createMutation.isPending}
							>
								<Clock className="h-4 w-4 mr-2" />
								Quick Start
							</Button>
							<Button
								onClick={handleCreate}
								disabled={
									createMutation.isPending || creationMode === "ai"
								}
							>
								{createMutation.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Create Document
							</Button>
						</div>
					</CardFooter>
				</Card>

				{/* Recent documents */}
				<div className="mt-8">
					<h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
						Recent Documents
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Continue working on a recent document instead.{" "}
						<Link
							href="/documents"
							className="text-blue-600 hover:underline dark:text-blue-400"
						>
							View all documents
						</Link>
					</p>
				</div>
			</main>
		</div>
	);
}

/**
 * Quick start option card.
 */
function QuickStartCard({
	icon: Icon,
	title,
	description,
	selected,
	onClick,
	badge,
	disabled = false,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	selected: boolean;
	onClick: () => void;
	badge?: string;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"relative p-4 rounded-lg border text-left transition-all",
				"hover:border-blue-500 hover:shadow-sm",
				selected
					? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
					: "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950",
				disabled && "opacity-50 cursor-not-allowed hover:border-gray-200"
			)}
		>
			{badge && (
				<span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
					{badge}
				</span>
			)}
			<Icon
				className={cn(
					"h-8 w-8 mb-3",
					selected
						? "text-blue-600 dark:text-blue-400"
						: "text-gray-400"
				)}
			/>
			<h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
			<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
				{description}
			</p>
		</button>
	);
}

/**
 * Template selection option.
 */
function TemplateOption({
	title,
	description,
	selected,
	onClick,
}: {
	title: string;
	description: string;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"p-3 rounded-lg border text-left transition-all",
				"hover:border-blue-500",
				selected
					? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
					: "border-gray-200 dark:border-gray-700"
			)}
		>
			<h4 className="font-medium text-gray-900 dark:text-white text-sm">
				{title}
			</h4>
			{description && (
				<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
					{description}
				</p>
			)}
		</button>
	);
}
