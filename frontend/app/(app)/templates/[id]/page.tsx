/**
 * Template Detail Page - DocFusion
 *
 * Full template preview and information with use capabilities,
 * placeholder preview, and AI instruction display.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import type {
	Template,
	TemplateCategory,
	TemplatePlaceholder,
	TemplateAIInstruction,
	TemplateComplianceRequirement,
} from "@/lib/types/template";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	ArrowLeft,
	Sparkles,
	Clock,
	Award,
	FileText,
	Star,
	Edit3,
	Trash2,
	Copy,
	Globe,
	Users,
	Building2,
	Lock,
	LayoutTemplate,
	ChevronRight,
	BookOpen,
	Shield,
	Bot,
	Info,
	Check,
	Loader2,
	Code,
	AlertTriangle,
	Eye,
} from "lucide-react";
import {
	UseTemplateWizard,
} from "@/components/templates/UseTemplateWizard";
import { TemplateRating } from "@/components/templates/TemplateRating";
import { getTemplate, getTemplateCategories, duplicateTemplate } from "@/lib/actions/templates";
import { toast } from "sonner";

export default function TemplateDetailPage() {
	const params = useParams();
	const router = useRouter();
	const templateId = params.id as string;

	const [isLoading, setIsLoading] = React.useState(true);
	const [template, setTemplate] = React.useState<Template | null>(null);
	const [categories, setCategories] = React.useState<TemplateCategory[]>([]);
	const [showWizard, setShowWizard] = React.useState(false);
	const [activeTab, setActiveTab] = React.useState<
		"preview" | "overview" | "placeholders" | "ai" | "compliance"
	>("preview");

	React.useEffect(() => {
		// Handle special route segments that aren't template IDs
		if (templateId === "new") {
			// Redirect to templates page or show create UI
			router.replace("/templates?action=create");
			return;
		}

		// Validate that templateId looks like a UUID before querying
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(templateId)) {
			// Not a valid UUID - show not found
			setIsLoading(false);
			setTemplate(null);
			return;
		}

		// Fetch real template data from database
		async function fetchTemplate() {
			try {
				const [templateData, categoryData] = await Promise.all([
					getTemplate(templateId),
					getTemplateCategories(),
				]);

				if (templateData) {
					setTemplate(templateData);
					// Filter categories to only those used by this template
					const templateCategories = categoryData.filter(
						(cat) => templateData.categoryIds.includes(cat.id)
					);
					setCategories(templateCategories.length > 0 ? templateCategories : categoryData.slice(0, 3));
				} else {
					// Template not found - show not found UI
					setTemplate(null);
					setCategories([]);
				}
			} catch (error) {
				console.error("Error fetching template:", error);
				// Show not found UI on error
				setTemplate(null);
				setCategories([]);
			} finally {
				setIsLoading(false);
			}
		}

		fetchTemplate();
	}, [templateId, router]);

	const handleUse = () => {
		setShowWizard(true);
	};

	const handleEdit = () => {
		router.push(`/templates/${templateId}/edit`);
	};

	const handleDuplicate = async () => {
		if (!template) return;

		toast.loading("Duplicating template...");
		try {
			const duplicated = await duplicateTemplate(templateId);
			toast.dismiss();
			if (duplicated) {
				toast.success("Template duplicated successfully", {
					description: `Created "${duplicated.name}"`,
					action: {
						label: "View",
						onClick: () => router.push(`/templates/${duplicated.id}`),
					},
				});
			} else {
				toast.error("Failed to duplicate template");
			}
		} catch (error) {
			toast.dismiss();
			toast.error("Failed to duplicate template", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	const handleDelete = () => {
		// Delete logic
		if (confirm("Are you sure you want to delete this template?")) {
			router.push("/templates");
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!template) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<LayoutTemplate className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
					<h2 className="text-xl font-semibold text-foreground mb-2">
						Template not found
					</h2>
					<p className="text-muted-foreground mb-6">
						The template you're looking for doesn't exist or has been removed.
					</p>
					<Link href="/templates">
						<Button variant="outline">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Templates
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	const visibilityIcons = {
		private: Lock,
		team: Users,
		organization: Building2,
		public: Globe,
	};

	const visibilityLabels = {
		private: "Private",
		team: "Team",
		organization: "Organization",
		public: "Public",
	};

	const difficultyColors = {
		beginner: "bg-success/10 text-success",
		intermediate: "bg-warning/10 text-warning",
		advanced: "bg-destructive/10 text-destructive",
	};

	const VisibilityIcon = visibilityIcons[template.visibility];

	return (
		<div className="relative min-h-screen h-full overflow-y-auto">
			{/* Header */}
			<div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-6">
					{/* Breadcrumb */}
					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
						<Link href="/templates" className="hover:text-foreground transition-colors">
							Templates
						</Link>
						<ChevronRight className="h-4 w-4" />
						<span className="text-foreground">{template.name}</span>
					</div>

					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
						<div>
							<div className="flex items-center gap-3 mb-2">
								<h1 className="text-2xl font-display font-semibold text-foreground">
									{template.name}
								</h1>
								{template.difficulty && (
									<span
										className={cn(
											"px-2 py-0.5 rounded-full text-xs font-medium capitalize",
											difficultyColors[template.difficulty]
										)}
									>
										{template.difficulty}
									</span>
									)}
							</div>
							<p className="text-muted-foreground max-w-2xl">
								{template.description}
							</p>
						</div>

						<div className="flex items-center gap-3">
							<button
								onClick={handleDuplicate}
								className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
								title="Duplicate template"
							>
								<Copy className="h-5 w-5" />
							</button>
							<button
								onClick={handleEdit}
								className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
								title="Edit template"
							>
								<Edit3 className="h-5 w-5" />
							</button>
							<button
								onClick={handleDelete}
								className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
								title="Delete template"
							>
								<Trash2 className="h-5 w-5" />
							</button>
							<Button onClick={handleUse}>
								<Sparkles className="h-4 w-4 mr-2" />
								Use Template
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Main Content */}
					<div className="lg:col-span-2 space-y-6">
						{/* Preview Card */}
						<div className="rounded-xl border border-border bg-card overflow-hidden">
							<div className="aspect-[16/9] bg-muted relative">
								{template.previewImageUrl ? (
									<img
										src={template.previewImageUrl}
										alt={template.name}
										className="absolute inset-0 w-full h-full object-cover"
									/>
								) : (
									<div className="absolute inset-0 flex items-center justify-center">
										<LayoutTemplate className="h-24 w-24 text-muted-foreground/30" />
									</div>
								)}

								{/* Overlay */}
								<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
									<div className="flex items-center gap-4 text-white">
										<div className="flex items-center gap-1">
											<Star className="h-4 w-4 text-amber-400 fill-amber-400" />
											<span className="font-medium">
												{template.rating ? template.rating.toFixed(1) : "0"}
											</span>
											{template.ratingCount !== undefined && template.ratingCount > 0 && (
												<span className="text-white/70">({template.ratingCount})</span>
											)}
										</div>
										<div className="flex items-center gap-1">
											<FileText className="h-4 w-4" />
											<span>{template.useCount} uses</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Tabs */}
						<div className="border-b border-border">
							<div className="flex items-center gap-1">
								{(
									[
										{ id: "preview", label: "Preview", icon: Eye },
										{ id: "overview", label: "Overview", icon: Info },
										{
											id: "placeholders",
											label: "Fields",
											icon: Code,
										},
										{ id: "ai", label: "AI Instructions", icon: Bot },
										{
											id: "compliance",
											label: "Compliance",
											icon: Shield,
										},
									] as const
								).map((tab) => (
									<button
										key={tab.id}
										onClick={() => setActiveTab(tab.id)}
										className={cn(
											"flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
											activeTab === tab.id
												? "text-primary border-primary"
												: "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
										)}
									>
										<tab.icon className="h-4 w-4" />
										{tab.label}
									</button>
									))}
							</div>
						</div>

						{/* Tab Content */}
						<div className="py-6">
							{activeTab === "preview" && (
								<PreviewTab template={template} />
							)}
							{activeTab === "overview" && (
								<OverviewTab template={template} categories={categories} />
							)}
							{activeTab === "placeholders" && (
								<PlaceholdersTab template={template} />
							)}
							{activeTab === "ai" && <AITab template={template} />}
							{activeTab === "compliance" && (
								<ComplianceTab template={template} />
							)}
						</div>
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Use Template Card */}
						<div className="rounded-xl border border-border bg-card p-6">
							<h3 className="font-semibold text-foreground mb-4">
								Use This Template
							</h3>
							<p className="text-sm text-muted-foreground mb-4">
								Create a new document based on this template with AI-powered content
								generation.
							</p>
							<div className="space-y-3">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Clock className="h-4 w-4" />
									<span>{template.estimatedTime} minutes estimated</span>
								</div>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Code className="h-4 w-4" />
									<span>{template.placeholders.length} fields to fill</span>
								</div>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Bot className="h-4 w-4" />
									<span>AI instructions included</span>
								</div>
							</div>
							<Button className="w-full mt-6" onClick={handleUse}>
								<Sparkles className="h-4 w-4 mr-2" />
								Start Creating
							</Button>
						</div>

						{/* Template Details */}
						<div className="rounded-xl border border-border bg-card p-6">
							<h3 className="font-semibold text-foreground mb-4">
								Template Details
							</h3>
							<div className="space-y-4">
								<div>
									<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
										Visibility
									</div>
									<div className="flex items-center gap-2 text-sm">
										<VisibilityIcon className="h-4 w-4 text-muted-foreground" />
										<span>{visibilityLabels[template.visibility]}</span>
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
										Created
									</div>
									<div className="text-sm text-foreground">
										{formatDate(template.createdAt)}
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
										Updated
									</div>
									<div className="text-sm text-foreground">
										{formatDate(template.updatedAt)}
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
										Total Uses
									</div>
									<div className="text-sm text-foreground">
										{template.useCount} documents
									</div>
								</div>
							</div>
						</div>

						{/* Rate This Template */}
						<div className="rounded-xl border border-border bg-card p-6">
							<h3 className="font-semibold text-foreground mb-4">
								Rate This Template
							</h3>
							<p className="text-sm text-muted-foreground mb-4">
								Help others by sharing your experience with this template.
							</p>
							<TemplateRating
								templateId={template.id}
								rating={template.rating}
								ratingCount={template.ratingCount}
								size="lg"
								showCount={true}
								interactive={true}
								onRatingChange={(newRating, newCount) => {
									setTemplate({
										...template,
										rating: newRating,
										ratingCount: newCount,
									});
								}}
							/>
						</div>

						{/* Categories */}
						{categories.length > 0 && (
							<div className="rounded-xl border border-border bg-card p-6">
								<h3 className="font-semibold text-foreground mb-4">Categories</h3>
								<div className="flex flex-wrap gap-2">
									{categories.map((cat) => (
										<span
											key={cat.id}
											className="px-3 py-1 rounded-full text-sm bg-muted text-muted-foreground"
										>
											{cat.name}
										</span>
										))}
								</div>
							</div>
						)}

						{/* Tags */}
						{template.tags.length > 0 && (
							<div className="rounded-xl border border-border bg-card p-6">
								<h3 className="font-semibold text-foreground mb-4">Tags</h3>
								<div className="flex flex-wrap gap-2">
									{template.tags.map((tag) => (
										<span
											key={tag}
											className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground"
										>
											{tag}
										</span>
										))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Wizard Dialog */}
			<Dialog open={showWizard} onOpenChange={setShowWizard}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Use Template</DialogTitle>
					</DialogHeader>
					<UseTemplateWizard
						templateId={templateId}
						onComplete={() => setShowWizard(false)}
						onCancel={() => setShowWizard(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ============================================================================
// Tab Components
// ============================================================================

function PreviewTab({ template }: { template: Template }) {
	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="bg-muted/50 border-b border-border px-6 py-4">
					<div className="flex items-center gap-2 text-muted-foreground">
						<FileText className="h-4 w-4" />
						<span className="text-sm font-medium">Document Preview</span>
					</div>
				</div>
				<div className="p-8 bg-white dark:bg-slate-950">
					<div className="max-w-2xl mx-auto space-y-8">
						{/* Title */}
						<div className="text-center pb-6 border-b border-border">
							<h2 className="text-2xl font-semibold text-foreground mb-2">
								{template.name}
							</h2>
							<p className="text-muted-foreground text-sm">
								Sample Document Preview
							</p>
						</div>

						{/* Section 1: Executive Summary */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-foreground pb-2 border-b border-border">
								1. Executive Summary
							</h3>
							<div className="space-y-3 text-muted-foreground leading-relaxed">
								<p>
									Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
									eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
									ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
									aliquip ex ea commodo consequat.
								</p>
								<p>
									Duis aute irure dolor in reprehenderit in voluptate velit esse
									cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
									cupidatat non proident, sunt in culpa qui officia deserunt mollit
									anim id est laborum.
								</p>
							</div>
						</div>

						{/* Section 2: Value Proposition */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-foreground pb-2 border-b border-border">
								2. Value Proposition
							</h3>
							<div className="space-y-3 text-muted-foreground leading-relaxed">
								<p>
									Sed ut perspiciatis unde omnis iste natus error sit voluptatem
									accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
									quae ab illo inventore veritatis et quasi architecto beatae vitae
									dicta sunt explicabo.
								</p>
								<p>
									Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit
									aut fugit, sed quia consequuntur magni dolores eos qui ratione
									voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem
									ipsum quia dolor sit amet.
								</p>
							</div>
						</div>

						{/* Section 3: Key Differentiators */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-foreground pb-2 border-b border-border">
								3. Key Differentiators
							</h3>
							<div className="space-y-3 text-muted-foreground leading-relaxed">
								<p>
									At vero eos et accusamus et iusto odio dignissimos ducimus qui
									blanditiis praesentium voluptatum deleniti atque corrupti quos
									dolores et quas molestias excepturi sint occaecati cupiditate non
									provident.
								</p>
								<ul className="list-disc list-inside space-y-2 pl-4">
									<li>Similique sunt in culpa qui officia deserunt mollitia animi</li>
									<li>Id est laborum et dolorum fuga harum quidem rerum facilis</li>
									<li>Expedita distinctio nam libero tempore cum soluta nobis est</li>
									<li>Eligendi optio cumque nihil impedit quo minus id quod maxime</li>
								</ul>
								<p>
									Et harum quidem rerum facilis est et expedita distinctio. Nam libero
									tempore, cum soluta nobis est eligendi optio cumque nihil impedit
									quo minus id quod maxime placeat facere possimus.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function OverviewTab({
	template,
	categories,
}: {
	template: Template;
	categories: TemplateCategory[];
}) {
	return (
		<div className="space-y-6">
			<div className="p-6 rounded-xl bg-muted/50 border border-border">
				<h3 className="font-semibold text-foreground mb-2">About This Template</h3>
				<p className="text-muted-foreground leading-relaxed">
					{template.description}
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 rounded-xl bg-card border border-border">
					<div className="flex items-center gap-2 text-muted-foreground mb-2">
						<Clock className="h-4 w-4" />
						<span className="text-sm">Estimated Time</span>
					</div>
					<div className="text-2xl font-semibold text-foreground">
						{template.estimatedTime} min
					</div>
				</div>
				<div className="p-4 rounded-xl bg-card border border-border">
					<div className="flex items-center gap-2 text-muted-foreground mb-2">
						<Code className="h-4 w-4" />
						<span className="text-sm">Fields</span>
					</div>
					<div className="text-2xl font-semibold text-foreground">
						{template.placeholders.length}
					</div>
				</div>
				<div className="p-4 rounded-xl bg-card border border-border">
					<div className="flex items-center gap-2 text-muted-foreground mb-2">
						<Bot className="h-4 w-4" />
						<span className="text-sm">AI Instructions</span>
					</div>
					<div className="text-2xl font-semibold text-foreground">
						{template.aiInstructions.length}
					</div>
				</div>
				<div className="p-4 rounded-xl bg-card border border-border">
					<div className="flex items-center gap-2 text-muted-foreground mb-2">
						<Shield className="h-4 w-4" />
						<span className="text-sm">Compliance</span>
					</div>
					<div className="text-2xl font-semibold text-foreground">
						{template.complianceRequirements.length}
					</div>
				</div>
			</div>
		</div>
	);
}

function PlaceholdersTab({ template }: { template: Template }) {
	return (
		<div className="space-y-4">
			<h3 className="font-semibold text-foreground flex items-center gap-2">
				<Code className="h-5 w-5" />
				Template Fields
			</h3>
			<p className="text-muted-foreground">
				These fields will be replaced when you use this template.
			</p>
			<div className="space-y-3">
				{template.placeholders.map((placeholder) => (
					<div
						key={placeholder.id}
						className="p-4 rounded-xl bg-card border border-border"
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<code className="px-2 py-0.5 bg-muted rounded text-sm font-mono text-primary">
										{placeholder.variableName}
									</code>
									{placeholder.required && (
										<span className="text-xs text-destructive font-medium">
											Required
										</span>
									)}
								</div>
								<h4 className="font-medium text-foreground">
									{placeholder.name}
								</h4>
								{placeholder.description && (
									<p className="text-sm text-muted-foreground mt-1">
										{placeholder.description}
									</p>
									)}
								<div className="flex items-center gap-2 mt-2">
									<span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
										{placeholder.type}
									</span>
									{placeholder.defaultValue && (
										<span className="text-xs text-muted-foreground">
											Default: {placeholder.defaultValue}
										</span>
										)}
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function AITab({ template }: { template: Template }) {
	return (
		<div className="space-y-4">
			<h3 className="font-semibold text-foreground flex items-center gap-2">
				<Bot className="h-5 w-5" />
				AI Content Instructions
			</h3>
			<p className="text-muted-foreground">
				These prompts guide the AI when generating or improving content in your
				document.
			</p>
			<div className="space-y-4">
				{template.aiInstructions.map((instruction, index) => (
					<AIInstructionCard
						key={index}
						instruction={instruction}
						index={index}
					/>
				))}
			</div>
		</div>
	);
}

interface AIInstructionCardProps {
	instruction: TemplateAIInstruction;
	index: number;
}

function AIInstructionCard({ instruction, index }: AIInstructionCardProps) {
	const toneLabels = {
		formal: "Formal",
		professional: "Professional",
		friendly: "Friendly",
		technical: "Technical",
	};

	return (
		<div className="p-6 rounded-xl bg-card border border-border">
			<div className="flex items-center gap-2 mb-3">
				<div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
					{index + 1}
				</div>
				{instruction.targetId && (
					<code className="text-xs px-2 py-0.5 bg-muted rounded font-mono">
						{instruction.targetId}
					</code>
				)}
			</div>
			<p className="text-foreground leading-relaxed mb-4">
				{instruction.prompt}
			</p>
			<div className="flex items-center gap-4 text-sm text-muted-foreground">
				{instruction.tone && (
					<span className="flex items-center gap-1">
						<BookOpen className="h-3.5 w-3.5" />
						Tone: {toneLabels[instruction.tone]}
					</span>
				)}
				{instruction.maxLength && (
					<span className="flex items-center gap-1">
						<FileText className="h-3.5 w-3.5" />
						Max: {instruction.maxLength} words
					</span>
				)}
			</div>
		</div>
	);
}

function ComplianceTab({ template }: { template: Template }) {
	return (
		<div className="space-y-4">
			<h3 className="font-semibold text-foreground flex items-center gap-2">
				<Shield className="h-5 w-5" />
				Compliance Requirements
			</h3>
			<p className="text-muted-foreground">
				This template includes built-in compliance checks for regulatory
				frameworks.
			</p>
			<div className="space-y-3">
				{template.complianceRequirements.map((req) => (
					<ComplianceRequirementCard key={req.id} requirement={req} />
				))}
			</div>
		</div>
	);
}

interface ComplianceRequirementCardProps {
	requirement: TemplateComplianceRequirement;
}

function ComplianceRequirementCard({
	requirement,
}: ComplianceRequirementCardProps) {
	return (
		<div className="p-4 rounded-xl bg-card border border-border">
			<div className="flex items-start gap-4">
				<div className="mt-0.5">
					{requirement.mandatory ? (
						<AlertTriangle className="h-5 w-5 text-destructive" />
					) : (
						<Info className="h-5 w-5 text-muted-foreground" />
					)}
				</div>
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-1">
						<span className="font-medium text-foreground">
							{requirement.framework}
						</span>
						<code className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono">
							{requirement.clause}
						</code>
						{requirement.mandatory && (
							<span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
								Mandatory
							</span>
							)}
					</div>
					<p className="text-sm text-muted-foreground mb-2">
						{requirement.description}
					</p>
					{requirement.criteria && (
						<p className="text-xs text-muted-foreground bg-muted p-2 rounded">
							<strong>Criteria:</strong> {requirement.criteria}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
