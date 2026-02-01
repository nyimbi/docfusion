/**
 * Past Performance Volume Component
 *
 * Assembles selected projects into a cohesive past performance volume
 * with AI-generated narratives, formatting, and export options.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	FileText,
	BookOpen,
	Download,
	Eye,
	Settings,
	GripVertical,
	Plus,
	Trash2,
	Wand2,
	CheckCircle,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronUp,
	Star,
	Building2,
	DollarSign,
	Calendar,
	FileDown,
} from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import type { Project, PastPerfVolume as VolumeType } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface ProjectWithNarrative {
	project: Project;
	narrative?: string;
	relevanceScore?: number;
	isGenerating?: boolean;
}

interface VolumeSettings {
	maxProjects: number;
	maxPages: number;
	format: "standard" | "matrix" | "narrative";
	includeReferences: boolean;
	includeMetrics: boolean;
	includeChallenges: boolean;
}

interface PastPerfVolumeProps {
	opportunityId?: string;
	opportunityTitle?: string;
	availableProjects: Project[];
	selectedProjectIds?: string[];
	volume?: VolumeType;
	onSave: (volume: Partial<VolumeType>) => Promise<void>;
	onExport: (format: "pdf" | "docx" | "html") => Promise<void>;
	onGenerateNarrative: (projectId: string) => Promise<string>;
	onGenerateIntro: () => Promise<string>;
	onGenerateConclusion: () => Promise<string>;
	isLoading?: boolean;
}

// ============================================================================
// Sortable Project Item
// ============================================================================

function SortableProjectItem({
	project,
	narrative,
	relevanceScore,
	isGenerating,
	rank,
	onRemove,
	onGenerateNarrative,
	onEditNarrative,
}: {
	project: Project;
	narrative?: string;
	relevanceScore?: number;
	isGenerating?: boolean;
	rank: number;
	onRemove: () => void;
	onGenerateNarrative: () => void;
	onEditNarrative: (text: string) => void;
}) {
	const [showNarrative, setShowNarrative] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editedNarrative, setEditedNarrative] = useState(narrative || "");

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: project.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const cparRatings = project.cparRatings as { overall: number } | null;

	const handleSaveNarrative = () => {
		onEditNarrative(editedNarrative);
		setIsEditing(false);
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`border rounded-lg ${isDragging ? "opacity-50 bg-muted" : "bg-card"}`}
		>
			<div className="flex items-center gap-3 p-4">
				{/* Drag Handle */}
				<button
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
				>
					<GripVertical className="h-5 w-5" />
				</button>

				{/* Rank */}
				<div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
					{rank}
				</div>

				{/* Project Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<h4 className="font-medium truncate">{project.name}</h4>
						{relevanceScore !== undefined && (
							<Badge
								variant={
									relevanceScore >= 80
										? "default"
										: relevanceScore >= 60
											? "secondary"
											: "outline"
								}
							>
								{relevanceScore.toFixed(0)}%
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
						<span className="flex items-center gap-1">
							<Building2 className="h-3 w-3" />
							{project.customerName}
						</span>
						{cparRatings && (
							<span className="flex items-center gap-1">
								<Star className="h-3 w-3" />
								{cparRatings.overall.toFixed(1)}
							</span>
						)}
						{project.contractValue && (
							<span className="flex items-center gap-1">
								<DollarSign className="h-3 w-3" />$
								{(project.contractValue / 1000000).toFixed(1)}M
							</span>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowNarrative(!showNarrative)}
					>
						{showNarrative ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="text-destructive hover:text-destructive"
						onClick={onRemove}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Narrative Section */}
			{showNarrative && (
				<div className="px-4 pb-4 pt-0">
					<Separator className="mb-4" />
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label>Project Narrative</Label>
							<div className="flex items-center gap-2">
								{!isEditing && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setEditedNarrative(narrative || "");
											setIsEditing(true);
										}}
									>
										Edit
									</Button>
								)}
								<Button
									variant="outline"
									size="sm"
									onClick={onGenerateNarrative}
									disabled={isGenerating}
								>
									{isGenerating ? (
										<Loader2 className="h-4 w-4 mr-1 animate-spin" />
									) : (
										<Wand2 className="h-4 w-4 mr-1" />
									)}
									{narrative ? "Regenerate" : "Generate"}
								</Button>
							</div>
						</div>

						{isEditing ? (
							<div className="space-y-2">
								<Textarea
									value={editedNarrative}
									onChange={(e) => setEditedNarrative(e.target.value)}
									rows={6}
								/>
								<div className="flex justify-end gap-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setIsEditing(false)}
									>
										Cancel
									</Button>
									<Button size="sm" onClick={handleSaveNarrative}>
										Save
									</Button>
								</div>
							</div>
						) : narrative ? (
							<p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
								{narrative}
							</p>
						) : (
							<div className="text-center py-6 text-muted-foreground">
								<FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No narrative generated yet</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function PastPerfVolume({
	opportunityId,
	opportunityTitle,
	availableProjects,
	selectedProjectIds = [],
	volume,
	onSave,
	onExport,
	onGenerateNarrative,
	onGenerateIntro,
	onGenerateConclusion,
	isLoading = false,
}: PastPerfVolumeProps) {
	// State
	const [title, setTitle] = useState(volume?.title || `Past Performance Volume - ${opportunityTitle || "Proposal"}`);
	const [selectedIds, setSelectedIds] = useState<string[]>(
		volume?.selectedProjectIds as string[] || selectedProjectIds
	);
	const [projectNarratives, setProjectNarratives] = useState<Record<string, string>>({});
	const [generatingNarratives, setGeneratingNarratives] = useState<Set<string>>(new Set());
	const [introNarrative, setIntroNarrative] = useState(volume?.introductionNarrative || "");
	const [conclusionNarrative, setConclusionNarrative] = useState(volume?.conclusionNarrative || "");
	const [settings, setSettings] = useState<VolumeSettings>({
		maxProjects: 3,
		maxPages: 10,
		format: "standard",
		includeReferences: true,
		includeMetrics: true,
		includeChallenges: true,
	});
	const [activeTab, setActiveTab] = useState("projects");
	const [isSaving, setIsSaving] = useState(false);
	const [isGeneratingIntro, setIsGeneratingIntro] = useState(false);
	const [isGeneratingConclusion, setIsGeneratingConclusion] = useState(false);

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Selected projects in order
	const selectedProjects = useMemo(() => {
		return selectedIds
			.map((id) => availableProjects.find((p) => p.id === id))
			.filter(Boolean) as Project[];
	}, [selectedIds, availableProjects]);

	// Available (not selected) projects
	const unselectedProjects = useMemo(() => {
		return availableProjects.filter((p) => !selectedIds.includes(p.id));
	}, [availableProjects, selectedIds]);

	// Handle drag end
	const handleDragEnd = useCallback((event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			setSelectedIds((items) => {
				const oldIndex = items.indexOf(active.id as string);
				const newIndex = items.indexOf(over.id as string);
				return arrayMove(items, oldIndex, newIndex);
			});
		}
	}, []);

	// Add project
	const handleAddProject = useCallback((projectId: string) => {
		if (selectedIds.length < settings.maxProjects) {
			setSelectedIds((prev) => [...prev, projectId]);
		}
	}, [selectedIds.length, settings.maxProjects]);

	// Remove project
	const handleRemoveProject = useCallback((projectId: string) => {
		setSelectedIds((prev) => prev.filter((id) => id !== projectId));
	}, []);

	// Generate project narrative
	const handleGenerateNarrative = useCallback(async (projectId: string) => {
		setGeneratingNarratives((prev) => new Set([...prev, projectId]));
		try {
			const narrative = await onGenerateNarrative(projectId);
			setProjectNarratives((prev) => ({ ...prev, [projectId]: narrative }));
		} finally {
			setGeneratingNarratives((prev) => {
				const next = new Set(prev);
				next.delete(projectId);
				return next;
			});
		}
	}, [onGenerateNarrative]);

	// Update narrative
	const handleUpdateNarrative = useCallback((projectId: string, text: string) => {
		setProjectNarratives((prev) => ({ ...prev, [projectId]: text }));
	}, []);

	// Generate intro
	const handleGenerateIntro = useCallback(async () => {
		setIsGeneratingIntro(true);
		try {
			const intro = await onGenerateIntro();
			setIntroNarrative(intro);
		} finally {
			setIsGeneratingIntro(false);
		}
	}, [onGenerateIntro]);

	// Generate conclusion
	const handleGenerateConclusion = useCallback(async () => {
		setIsGeneratingConclusion(true);
		try {
			const conclusion = await onGenerateConclusion();
			setConclusionNarrative(conclusion);
		} finally {
			setIsGeneratingConclusion(false);
		}
	}, [onGenerateConclusion]);

	// Save volume
	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			await onSave({
				title,
				selectedProjectIds: selectedIds,
				introductionNarrative: introNarrative,
				conclusionNarrative: conclusionNarrative,
				opportunityId,
			});
		} finally {
			setIsSaving(false);
		}
	}, [title, selectedIds, introNarrative, conclusionNarrative, opportunityId, onSave]);

	// Progress calculation
	const progress = useMemo(() => {
		let completed = 0;
		let total = 4; // title, projects, intro, conclusion

		if (title) completed++;
		if (selectedIds.length > 0) completed++;
		if (introNarrative) completed++;
		if (conclusionNarrative) completed++;

		return (completed / total) * 100;
	}, [title, selectedIds.length, introNarrative, conclusionNarrative]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<BookOpen className="h-5 w-5" />
								Past Performance Volume
							</CardTitle>
							<CardDescription>
								Assemble your past performance volume for{" "}
								{opportunityTitle || "the proposal"}
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => onExport("pdf")}>
								<FileDown className="h-4 w-4 mr-2" />
								Export PDF
							</Button>
							<Button onClick={handleSave} disabled={isSaving}>
								{isSaving ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<CheckCircle className="h-4 w-4 mr-2" />
								)}
								Save Volume
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="title">Volume Title</Label>
							<Input
								id="title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter volume title..."
							/>
						</div>

						<div>
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm text-muted-foreground">
									Volume Completion
								</span>
								<span className="text-sm font-medium">{progress.toFixed(0)}%</span>
							</div>
							<Progress value={progress} />
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Main Content */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="projects" className="gap-1">
						<FileText className="h-4 w-4" />
						Projects ({selectedIds.length}/{settings.maxProjects})
					</TabsTrigger>
					<TabsTrigger value="narratives" className="gap-1">
						<BookOpen className="h-4 w-4" />
						Narratives
					</TabsTrigger>
					<TabsTrigger value="settings" className="gap-1">
						<Settings className="h-4 w-4" />
						Settings
					</TabsTrigger>
					<TabsTrigger value="preview" className="gap-1">
						<Eye className="h-4 w-4" />
						Preview
					</TabsTrigger>
				</TabsList>

				{/* Projects Tab */}
				<TabsContent value="projects" className="mt-4 space-y-6">
					{/* Selected Projects */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Selected Projects</CardTitle>
							<CardDescription>
								Drag to reorder. Maximum {settings.maxProjects} projects.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{selectedProjects.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>No projects selected</p>
									<p className="text-sm">Add projects from the list below</p>
								</div>
							) : (
								<DndContext
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={handleDragEnd}
								>
									<SortableContext
										items={selectedIds}
										strategy={verticalListSortingStrategy}
									>
										<div className="space-y-3">
											{selectedProjects.map((project, index) => (
												<SortableProjectItem
													key={project.id}
													project={project}
													narrative={projectNarratives[project.id]}
													isGenerating={generatingNarratives.has(project.id)}
													rank={index + 1}
													onRemove={() => handleRemoveProject(project.id)}
													onGenerateNarrative={() =>
														handleGenerateNarrative(project.id)
													}
													onEditNarrative={(text) =>
														handleUpdateNarrative(project.id, text)
													}
												/>
											))}
										</div>
									</SortableContext>
								</DndContext>
							)}
						</CardContent>
					</Card>

					{/* Available Projects */}
					{selectedIds.length < settings.maxProjects && unselectedProjects.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Available Projects</CardTitle>
								<CardDescription>
									Click to add to your volume
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3 md:grid-cols-2">
									{unselectedProjects.slice(0, 6).map((project) => (
										<div
											key={project.id}
											className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
											onClick={() => handleAddProject(project.id)}
										>
											<div className="flex items-start justify-between">
												<div>
													<p className="font-medium text-sm">{project.name}</p>
													<p className="text-xs text-muted-foreground">
														{project.customerName}
													</p>
												</div>
												<Plus className="h-4 w-4 text-muted-foreground" />
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Narratives Tab */}
				<TabsContent value="narratives" className="mt-4 space-y-6">
					{/* Introduction */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Introduction</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={handleGenerateIntro}
									disabled={isGeneratingIntro}
								>
									{isGeneratingIntro ? (
										<Loader2 className="h-4 w-4 mr-1 animate-spin" />
									) : (
										<Wand2 className="h-4 w-4 mr-1" />
									)}
									Generate
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<Textarea
								value={introNarrative}
								onChange={(e) => setIntroNarrative(e.target.value)}
								placeholder="Write or generate an introduction for your past performance volume..."
								rows={6}
							/>
						</CardContent>
					</Card>

					{/* Conclusion */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Conclusion</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={handleGenerateConclusion}
									disabled={isGeneratingConclusion}
								>
									{isGeneratingConclusion ? (
										<Loader2 className="h-4 w-4 mr-1 animate-spin" />
									) : (
										<Wand2 className="h-4 w-4 mr-1" />
									)}
									Generate
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<Textarea
								value={conclusionNarrative}
								onChange={(e) => setConclusionNarrative(e.target.value)}
								placeholder="Write or generate a conclusion for your past performance volume..."
								rows={6}
							/>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Settings Tab */}
				<TabsContent value="settings" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Volume Settings</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Maximum Projects</Label>
									<Select
										value={settings.maxProjects.toString()}
										onValueChange={(v) =>
											setSettings((s) => ({ ...s, maxProjects: parseInt(v) }))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="3">3 Projects</SelectItem>
											<SelectItem value="5">5 Projects</SelectItem>
											<SelectItem value="10">10 Projects</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label>Output Format</Label>
									<Select
										value={settings.format}
										onValueChange={(v) =>
											setSettings((s) => ({
												...s,
												format: v as VolumeSettings["format"],
											}))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="standard">Standard Narrative</SelectItem>
											<SelectItem value="matrix">Matrix Format</SelectItem>
											<SelectItem value="narrative">Extended Narrative</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Preview Tab */}
				<TabsContent value="preview" className="mt-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Volume Preview</CardTitle>
								<div className="flex items-center gap-2">
									<Button variant="outline" size="sm" onClick={() => onExport("docx")}>
										<Download className="h-4 w-4 mr-1" />
										Word
									</Button>
									<Button variant="outline" size="sm" onClick={() => onExport("pdf")}>
										<Download className="h-4 w-4 mr-1" />
										PDF
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="prose max-w-none">
								<h1 className="text-2xl font-bold mb-4">{title}</h1>

								{introNarrative && (
									<div className="mb-6">
										<h2 className="text-lg font-semibold mb-2">Introduction</h2>
										<p className="whitespace-pre-wrap">{introNarrative}</p>
									</div>
								)}

								{selectedProjects.map((project, index) => (
									<div key={project.id} className="mb-6 pb-6 border-b last:border-0">
										<h2 className="text-lg font-semibold mb-2">
											Project {index + 1}: {project.name}
										</h2>
										{projectNarratives[project.id] ? (
											<p className="whitespace-pre-wrap">
												{projectNarratives[project.id]}
											</p>
										) : (
											<p className="text-muted-foreground italic">
												Narrative not generated
											</p>
										)}
									</div>
								))}

								{conclusionNarrative && (
									<div>
										<h2 className="text-lg font-semibold mb-2">Conclusion</h2>
										<p className="whitespace-pre-wrap">{conclusionNarrative}</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default PastPerfVolume;
