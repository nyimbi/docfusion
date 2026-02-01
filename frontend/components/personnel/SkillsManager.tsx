"use client";

/**
 * SkillsManager Component
 *
 * Comprehensive skills taxonomy management with hierarchical organization,
 * proficiency tracking, and visual skill mapping. Supports bulk operations
 * and synonym management for better resume matching.
 */

import { useState, useMemo } from "react";
import {
	Award,
	Plus,
	Search,
	Edit,
	Trash2,
	Save,
	X,
	ChevronRight,
	ChevronDown,
	Tag,
	Link2,
	TrendingUp,
	BarChart3,
	Filter,
	Download,
	Upload,
	RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SkillTaxonomy } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface SkillsManagerProps {
	skills: SkillTaxonomy[];
	onCreateSkill: (skill: Omit<SkillTaxonomy, "id" | "createdAt" | "updatedAt">) => Promise<void>;
	onUpdateSkill: (id: string, skill: Partial<SkillTaxonomy>) => Promise<void>;
	onDeleteSkill: (id: string) => Promise<void>;
	onBulkImport?: (skills: Partial<SkillTaxonomy>[]) => Promise<void>;
	className?: string;
}

interface SkillFormData {
	name: string;
	category: string;
	subcategory: string;
	description: string;
	synonyms: string[];
	relatedSkills: string[];
	parentId: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const SKILL_CATEGORIES = [
	{ value: "technical", label: "Technical", color: "bg-blue-100 text-blue-800" },
	{ value: "management", label: "Management", color: "bg-purple-100 text-purple-800" },
	{ value: "domain", label: "Domain Knowledge", color: "bg-green-100 text-green-800" },
	{ value: "soft_skill", label: "Soft Skills", color: "bg-orange-100 text-orange-800" },
	{ value: "tools", label: "Tools & Software", color: "bg-cyan-100 text-cyan-800" },
	{ value: "methodology", label: "Methodologies", color: "bg-pink-100 text-pink-800" },
];

const SUBCATEGORIES: Record<string, string[]> = {
	technical: ["Programming Languages", "Frameworks", "Databases", "Cloud Platforms", "DevOps", "Security", "Data Science", "AI/ML"],
	management: ["Project Management", "Program Management", "Portfolio Management", "Team Leadership", "Strategic Planning"],
	domain: ["Healthcare", "Finance", "Government", "Defense", "Energy", "Retail", "Manufacturing"],
	soft_skill: ["Communication", "Problem Solving", "Leadership", "Teamwork", "Time Management"],
	tools: ["IDEs", "Version Control", "CI/CD", "Monitoring", "Collaboration"],
	methodology: ["Agile", "Waterfall", "DevSecOps", "ITIL", "Six Sigma"],
};

// ============================================================================
// Helper Functions
// ============================================================================

function buildSkillTree(skills: SkillTaxonomy[]): Map<string | null, SkillTaxonomy[]> {
	const tree = new Map<string | null, SkillTaxonomy[]>();

	skills.forEach(skill => {
		const parentId = skill.parentId || null;
		if (!tree.has(parentId)) {
			tree.set(parentId, []);
		}
		tree.get(parentId)!.push(skill);
	});

	return tree;
}

function getCategoryColor(category: string): string {
	return SKILL_CATEGORIES.find(c => c.value === category)?.color || "bg-gray-100 text-gray-800";
}

// ============================================================================
// Sub-Components
// ============================================================================

function SkillTreeNode({
	skill,
	tree,
	level = 0,
	onEdit,
	onDelete,
}: {
	skill: SkillTaxonomy;
	tree: Map<string | null, SkillTaxonomy[]>;
	level?: number;
	onEdit: (skill: SkillTaxonomy) => void;
	onDelete: (id: string) => void;
}) {
	const [expanded, setExpanded] = useState(level < 2);
	const children = tree.get(skill.id) || [];
	const hasChildren = children.length > 0;

	return (
		<div className={cn("", level > 0 && "ml-6 border-l pl-4")}>
			<div className="flex items-center gap-2 py-2 hover:bg-muted/50 rounded px-2 group">
				{hasChildren ? (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => setExpanded(!expanded)}
					>
						{expanded ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</Button>
				) : (
					<div className="w-6" />
				)}

				<Badge variant="outline" className={cn("text-xs", getCategoryColor(skill.category))}>
					{skill.category}
				</Badge>

				<span className="flex-1 font-medium">{skill.name}</span>

				{skill.usageCount !== null && skill.usageCount > 0 && (
					<Badge variant="secondary" className="text-xs">
						{skill.usageCount} uses
					</Badge>
				)}

				<div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => onEdit(skill)}
					>
						<Edit className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0 text-red-500"
						onClick={() => onDelete(skill.id)}
					>
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{expanded && hasChildren && (
				<div className="mt-1">
					{children.map(child => (
						<SkillTreeNode
							key={child.id}
							skill={child}
							tree={tree}
							level={level + 1}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function SkillForm({
	skill,
	allSkills,
	onSave,
	onCancel,
}: {
	skill?: SkillTaxonomy;
	allSkills: SkillTaxonomy[];
	onSave: (data: SkillFormData) => void;
	onCancel: () => void;
}) {
	const [formData, setFormData] = useState<SkillFormData>({
		name: skill?.name || "",
		category: skill?.category || "technical",
		subcategory: skill?.subcategory || "",
		description: skill?.description || "",
		synonyms: skill?.synonyms || [],
		relatedSkills: skill?.relatedSkills || [],
		parentId: skill?.parentId || null,
	});

	const [synonymInput, setSynonymInput] = useState("");
	const [relatedInput, setRelatedInput] = useState("");

	const subcategories = SUBCATEGORIES[formData.category] || [];

	const addSynonym = () => {
		if (synonymInput.trim() && !formData.synonyms.includes(synonymInput.trim())) {
			setFormData(prev => ({
				...prev,
				synonyms: [...prev.synonyms, synonymInput.trim()]
			}));
			setSynonymInput("");
		}
	};

	const removeSynonym = (syn: string) => {
		setFormData(prev => ({
			...prev,
			synonyms: prev.synonyms.filter(s => s !== syn)
		}));
	};

	const addRelatedSkill = () => {
		if (relatedInput.trim() && !formData.relatedSkills.includes(relatedInput.trim())) {
			setFormData(prev => ({
				...prev,
				relatedSkills: [...prev.relatedSkills, relatedInput.trim()]
			}));
			setRelatedInput("");
		}
	};

	const removeRelatedSkill = (skill: string) => {
		setFormData(prev => ({
			...prev,
			relatedSkills: prev.relatedSkills.filter(s => s !== skill)
		}));
	};

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label>Skill Name *</Label>
					<Input
						value={formData.name}
						onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
						placeholder="e.g., Python"
					/>
				</div>
				<div className="space-y-2">
					<Label>Category *</Label>
					<Select
						value={formData.category}
						onValueChange={(v) => setFormData(prev => ({ ...prev, category: v, subcategory: "" }))}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SKILL_CATEGORIES.map(cat => (
								<SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label>Subcategory</Label>
					<Select
						value={formData.subcategory}
						onValueChange={(v) => setFormData(prev => ({ ...prev, subcategory: v }))}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select subcategory" />
						</SelectTrigger>
						<SelectContent>
							{subcategories.map(sub => (
								<SelectItem key={sub} value={sub}>{sub}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Parent Skill</Label>
					<Select
						value={formData.parentId || ""}
						onValueChange={(v) => setFormData(prev => ({ ...prev, parentId: v || null }))}
					>
						<SelectTrigger>
							<SelectValue placeholder="None (top-level)" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">None (top-level)</SelectItem>
							{allSkills
								.filter(s => s.id !== skill?.id)
								.map(s => (
									<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-2">
				<Label>Description</Label>
				<Textarea
					value={formData.description}
					onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
					placeholder="Brief description of the skill..."
					rows={2}
				/>
			</div>

			<div className="space-y-2">
				<Label className="flex items-center gap-1">
					<Tag className="h-3 w-3" />
					Synonyms
				</Label>
				<div className="flex gap-2">
					<Input
						value={synonymInput}
						onChange={(e) => setSynonymInput(e.target.value)}
						placeholder="Add a synonym..."
						onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSynonym())}
					/>
					<Button type="button" variant="outline" onClick={addSynonym}>
						<Plus className="h-4 w-4" />
					</Button>
				</div>
				{formData.synonyms.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{formData.synonyms.map(syn => (
							<Badge key={syn} variant="secondary" className="text-xs">
								{syn}
								<button
									onClick={() => removeSynonym(syn)}
									className="ml-1 hover:text-red-500"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label className="flex items-center gap-1">
					<Link2 className="h-3 w-3" />
					Related Skills
				</Label>
				<div className="flex gap-2">
					<Input
						value={relatedInput}
						onChange={(e) => setRelatedInput(e.target.value)}
						placeholder="Add a related skill..."
						onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRelatedSkill())}
					/>
					<Button type="button" variant="outline" onClick={addRelatedSkill}>
						<Plus className="h-4 w-4" />
					</Button>
				</div>
				{formData.relatedSkills.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{formData.relatedSkills.map(skill => (
							<Badge key={skill} variant="outline" className="text-xs">
								{skill}
								<button
									onClick={() => removeRelatedSkill(skill)}
									className="ml-1 hover:text-red-500"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
					</div>
				)}
			</div>

			<div className="flex justify-end gap-2 pt-4">
				<Button variant="outline" onClick={onCancel}>Cancel</Button>
				<Button onClick={() => onSave(formData)}>
					<Save className="h-4 w-4 mr-2" />
					{skill ? "Update" : "Create"}
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function SkillsManager({
	skills,
	onCreateSkill,
	onUpdateSkill,
	onDeleteSkill,
	onBulkImport,
	className,
}: SkillsManagerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [editingSkill, setEditingSkill] = useState<SkillTaxonomy | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"tree" | "list" | "grid">("tree");

	// Build skill tree
	const skillTree = useMemo(() => buildSkillTree(skills), [skills]);

	// Filter skills
	const filteredSkills = useMemo(() => {
		return skills.filter(skill => {
			if (selectedCategory !== "all" && skill.category !== selectedCategory) return false;
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					skill.name.toLowerCase().includes(query) ||
					skill.description?.toLowerCase().includes(query) ||
					skill.synonyms?.some(s => s.toLowerCase().includes(query))
				);
			}
			return true;
		});
	}, [skills, searchQuery, selectedCategory]);

	// Root skills for tree view
	const rootSkills = useMemo(() => {
		return filteredSkills.filter(s => !s.parentId);
	}, [filteredSkills]);

	// Stats
	const stats = useMemo(() => {
		const categoryCount = new Map<string, number>();
		skills.forEach(s => {
			categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1);
		});
		return {
			total: skills.length,
			byCategory: Object.fromEntries(categoryCount),
			mostUsed: [...skills].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5),
		};
	}, [skills]);

	const handleSave = async (data: SkillFormData) => {
		if (editingSkill) {
			await onUpdateSkill(editingSkill.id, data);
		} else {
			await onCreateSkill({
				...data,
				isActive: true,
				level: data.parentId ? 1 : 0,
				usageCount: 0,
			} as Omit<SkillTaxonomy, "id" | "createdAt" | "updatedAt">);
		}
		setIsDialogOpen(false);
		setEditingSkill(null);
	};

	const handleDelete = async (id: string) => {
		if (confirm("Are you sure you want to delete this skill?")) {
			await onDeleteSkill(id);
		}
	};

	const handleEdit = (skill: SkillTaxonomy) => {
		setEditingSkill(skill);
		setIsDialogOpen(true);
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<Award className="h-6 w-6" />
						Skills Taxonomy
					</h2>
					<p className="text-muted-foreground">
						Manage skill categories, synonyms, and relationships
					</p>
				</div>
				<div className="flex items-center gap-2">
					{onBulkImport && (
						<Button variant="outline">
							<Upload className="h-4 w-4 mr-2" />
							Import
						</Button>
					)}
					<Button onClick={() => { setEditingSkill(null); setIsDialogOpen(true); }}>
						<Plus className="h-4 w-4 mr-2" />
						Add Skill
					</Button>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-5 gap-4">
				<Card>
					<CardContent className="py-4">
						<p className="text-2xl font-bold">{stats.total}</p>
						<p className="text-xs text-muted-foreground">Total Skills</p>
					</CardContent>
				</Card>
				{SKILL_CATEGORIES.slice(0, 4).map(cat => (
					<Card key={cat.value}>
						<CardContent className="py-4">
							<p className="text-2xl font-bold">{stats.byCategory[cat.value] || 0}</p>
							<p className="text-xs text-muted-foreground">{cat.label}</p>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Filters & View Toggle */}
			<div className="flex items-center gap-4">
				<div className="flex-1">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search skills, synonyms..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>

				<Select value={selectedCategory} onValueChange={setSelectedCategory}>
					<SelectTrigger className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Categories</SelectItem>
						{SKILL_CATEGORIES.map(cat => (
							<SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="border rounded-md p-1 flex">
					{(["tree", "list", "grid"] as const).map(mode => (
						<Button
							key={mode}
							variant={viewMode === mode ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode(mode)}
							className="capitalize"
						>
							{mode}
						</Button>
					))}
				</div>
			</div>

			{/* Content */}
			<Card>
				<CardContent className="p-4">
					{filteredSkills.length === 0 ? (
						<div className="text-center py-12">
							<Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium">No skills found</h3>
							<p className="text-sm text-muted-foreground">
								{searchQuery ? "Try a different search term" : "Add some skills to get started"}
							</p>
						</div>
					) : viewMode === "tree" ? (
						<ScrollArea className="h-[500px]">
							{rootSkills.map(skill => (
								<SkillTreeNode
									key={skill.id}
									skill={skill}
									tree={skillTree}
									onEdit={handleEdit}
									onDelete={handleDelete}
								/>
							))}
						</ScrollArea>
					) : viewMode === "list" ? (
						<ScrollArea className="h-[500px]">
							<div className="space-y-2">
								{filteredSkills.map(skill => (
									<div
										key={skill.id}
										className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
									>
										<Badge variant="outline" className={getCategoryColor(skill.category)}>
											{skill.category}
										</Badge>
										<span className="flex-1 font-medium">{skill.name}</span>
										{skill.subcategory && (
											<Badge variant="secondary" className="text-xs">
												{skill.subcategory}
											</Badge>
										)}
										{skill.synonyms && skill.synonyms.length > 0 && (
											<span className="text-xs text-muted-foreground">
												{skill.synonyms.length} synonyms
											</span>
										)}
										<div className="flex items-center gap-1">
											<Button variant="ghost" size="sm" onClick={() => handleEdit(skill)}>
												<Edit className="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(skill.id)}>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					) : (
						<div className="grid grid-cols-3 gap-4">
							{filteredSkills.map(skill => (
								<Card key={skill.id} className="hover:shadow-md transition-shadow">
									<CardContent className="p-4">
										<div className="flex items-start justify-between mb-2">
											<Badge variant="outline" className={getCategoryColor(skill.category)}>
												{skill.category}
											</Badge>
											<div className="flex items-center gap-1">
												<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEdit(skill)}>
													<Edit className="h-3 w-3" />
												</Button>
												<Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDelete(skill.id)}>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>
										<h4 className="font-medium">{skill.name}</h4>
										{skill.description && (
											<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
												{skill.description}
											</p>
										)}
										{skill.synonyms && skill.synonyms.length > 0 && (
											<div className="flex flex-wrap gap-1 mt-2">
												{skill.synonyms.slice(0, 3).map(syn => (
													<Badge key={syn} variant="secondary" className="text-xs">
														{syn}
													</Badge>
												))}
												{skill.synonyms.length > 3 && (
													<Badge variant="outline" className="text-xs">
														+{skill.synonyms.length - 3}
													</Badge>
												)}
											</div>
										)}
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Skill Dialog */}
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingSkill ? "Edit Skill" : "Add New Skill"}
						</DialogTitle>
						<DialogDescription>
							{editingSkill
								? "Update the skill details below"
								: "Define a new skill for the taxonomy"
							}
						</DialogDescription>
					</DialogHeader>
					<SkillForm
						skill={editingSkill || undefined}
						allSkills={skills}
						onSave={handleSave}
						onCancel={() => setIsDialogOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default SkillsManager;
