/**
 * ThemeManager - Main Win Theme Management Interface
 *
 * Central hub for managing win themes with drag-to-reorder, CRUD operations,
 * priority badges, type indicators, and expandable details.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Plus,
	GripVertical,
	ChevronDown,
	ChevronRight,
	Edit2,
	Trash2,
	MoreHorizontal,
	Target,
	Shield,
	Award,
	Zap,
	AlertCircle,
	CheckCircle2,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type {
	WinTheme,
	WinThemeType,
	ThemePriority,
	ThemeStatus,
} from "@/lib/types/win-themes";
import {
	getThemes,
	deleteTheme,
	reorderThemes,
	updateTheme,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeManagerProps {
	/** Opportunity ID to manage themes for */
	opportunityId: string;
	/** Callback when a theme is selected */
	onThemeSelect?: (theme: WinTheme) => void;
	/** Callback to open theme editor */
	onEditTheme?: (theme: WinTheme) => void;
	/** Callback to open theme creator */
	onCreateTheme?: () => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const THEME_TYPE_CONFIG: Record<
	WinThemeType,
	{ label: string; icon: typeof Target; color: string; bgColor: string }
> = {
	value_prop: {
		label: "Value Proposition",
		icon: Target,
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	differentiator: {
		label: "Differentiator",
		icon: Zap,
		color: "text-purple-600 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
	proof_point: {
		label: "Proof Point",
		icon: Award,
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	risk_mitigation: {
		label: "Risk Mitigation",
		icon: Shield,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
};

const PRIORITY_CONFIG: Record<ThemePriority, { label: string; color: string }> = {
	5: { label: "Critical", color: "bg-red-500 text-white" },
	4: { label: "High", color: "bg-orange-500 text-white" },
	3: { label: "Medium", color: "bg-yellow-500 text-black" },
	2: { label: "Low", color: "bg-blue-500 text-white" },
	1: { label: "Minimal", color: "bg-gray-400 text-white" },
};

const STATUS_CONFIG: Record<ThemeStatus, { label: string; color: string }> = {
	draft: { label: "Draft", color: "text-muted-foreground" },
	active: { label: "Active", color: "text-green-600" },
	approved: { label: "Approved", color: "text-blue-600" },
	archived: { label: "Archived", color: "text-gray-400" },
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function ThemeManagerSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-9 w-28" />
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-5 w-20" />
						<Skeleton className="flex-1 h-5" />
						<Skeleton className="h-5 w-16" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Theme Card Component
// =============================================================================

interface ThemeCardProps {
	theme: WinTheme;
	isExpanded: boolean;
	isDragging: boolean;
	onToggleExpand: () => void;
	onSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onStatusChange: (status: ThemeStatus) => void;
	dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function ThemeCard({
	theme,
	isExpanded,
	isDragging,
	onToggleExpand,
	onSelect,
	onEdit,
	onDelete,
	onStatusChange,
	dragHandleProps,
}: ThemeCardProps) {
	const typeConfig = THEME_TYPE_CONFIG[theme.type];
	const priorityConfig = PRIORITY_CONFIG[theme.priority];
	const statusConfig = STATUS_CONFIG[theme.status];
	const TypeIcon = typeConfig.icon;

	return (
		<div
			className={cn(
				"group border rounded-lg transition-all",
				isDragging && "shadow-lg opacity-75",
				theme.status === "archived" && "opacity-60"
			)}
		>
			<Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
				<div className="flex items-center gap-2 p-3">
					{/* Drag Handle */}
					<div
						{...dragHandleProps}
						className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
					>
						<GripVertical className="h-4 w-4 text-muted-foreground" />
					</div>

					{/* Expand Toggle */}
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="icon" className="h-6 w-6">
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
					</CollapsibleTrigger>

					{/* Type Badge */}
					<Badge
						variant="secondary"
						className={cn("gap-1", typeConfig.bgColor, typeConfig.color)}
					>
						<TypeIcon className="h-3 w-3" />
						<span className="hidden sm:inline">{typeConfig.label}</span>
					</Badge>

					{/* Theme Short Version */}
					<button
						onClick={onSelect}
						className="flex-1 text-left font-medium truncate hover:text-primary transition-colors"
					>
						{theme.shortVersion}
					</button>

					{/* Priority Badge */}
					<Badge className={cn("text-xs", priorityConfig.color)}>
						P{theme.priority}
					</Badge>

					{/* Status */}
					<span className={cn("text-xs hidden md:inline", statusConfig.color)}>
						{statusConfig.label}
					</span>

					{/* Coverage indicator */}
					{theme.coverageMetrics && (
						<div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground">
							<div
								className={cn(
									"h-2 w-2 rounded-full",
									theme.coverageMetrics.coveragePercentage >= 70
										? "bg-green-500"
										: theme.coverageMetrics.coveragePercentage >= 40
											? "bg-yellow-500"
											: "bg-red-500"
								)}
							/>
							{theme.coverageMetrics.coveragePercentage.toFixed(0)}%
						</div>
					)}

					{/* Actions */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onEdit}>
								<Edit2 className="h-4 w-4 mr-2" />
								Edit Theme
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{theme.status !== "active" && (
								<DropdownMenuItem onClick={() => onStatusChange("active")}>
									<CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
									Set Active
								</DropdownMenuItem>
							)}
							{theme.status !== "archived" && (
								<DropdownMenuItem onClick={() => onStatusChange("archived")}>
									Archive
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={onDelete} className="text-destructive">
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Expanded Content */}
				<CollapsibleContent>
					<div className="px-3 pb-3 pt-0 space-y-3 border-t">
						{/* Full Statement */}
						<div className="mt-3">
							<span className="text-xs font-medium text-muted-foreground">
								Full Statement
							</span>
							<p className="text-sm mt-1">{theme.statement}</p>
						</div>

						{/* Supporting Evidence */}
						{theme.supportingEvidence.length > 0 && (
							<div>
								<span className="text-xs font-medium text-muted-foreground">
									Supporting Evidence
								</span>
								<ul className="mt-1 space-y-1">
									{theme.supportingEvidence.map((evidence, idx) => (
										<li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
											<CheckCircle2 className="h-3 w-3 mt-1 text-green-500 shrink-0" />
											{evidence}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Keywords */}
						{theme.keywords.length > 0 && (
							<div>
								<span className="text-xs font-medium text-muted-foreground">
									Keywords
								</span>
								<div className="flex flex-wrap gap-1 mt-1">
									{theme.keywords.map((keyword, idx) => (
										<Badge key={idx} variant="outline" className="text-xs">
											{keyword}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Ghost Theme */}
						{theme.ghostTheme && (
							<div className="p-2 bg-muted/50 rounded-lg">
								<label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
									<Shield className="h-3 w-3" />
									Ghost Theme (vs {theme.ghostTheme.competitorName || "Competitor"})
								</label>
								<p className="text-sm mt-1 italic">
									"{theme.ghostTheme.counterPositioning}"
								</p>
								<div className="text-xs text-muted-foreground mt-1">
									Subtlety: {theme.ghostTheme.subtletyLevel}/5
								</div>
							</div>
						)}

						{/* Coverage Metrics */}
						{theme.coverageMetrics && (
							<div className="grid grid-cols-3 gap-2 text-center">
								<div className="p-2 bg-muted/50 rounded">
									<div className="text-lg font-bold">
										{theme.coverageMetrics.totalOccurrences}
									</div>
									<div className="text-xs text-muted-foreground">Occurrences</div>
								</div>
								<div className="p-2 bg-muted/50 rounded">
									<div className="text-lg font-bold">
										{theme.coverageMetrics.sectionsCovered}/{theme.coverageMetrics.totalSections}
									</div>
									<div className="text-xs text-muted-foreground">Sections</div>
								</div>
								<div className="p-2 bg-muted/50 rounded">
									<div className="text-lg font-bold">
										{theme.coverageMetrics.coveragePercentage.toFixed(0)}%
									</div>
									<div className="text-xs text-muted-foreground">Coverage</div>
								</div>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeManager({
	opportunityId,
	onThemeSelect,
	onEditTheme,
	onCreateTheme,
	className,
}: ThemeManagerProps) {
	// State
	const [themes, setThemes] = useState<WinTheme[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
	const [deleteDialogTheme, setDeleteDialogTheme] = useState<WinTheme | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [draggedTheme, setDraggedTheme] = useState<string | null>(null);

	// Load themes
	useEffect(() => {
		async function loadThemes() {
			setIsLoading(true);
			setError(null);
			const result = await getThemes(opportunityId);
			if (result.success && result.data) {
				setThemes(result.data);
			} else {
				setError(result.error || "Failed to load themes");
			}
			setIsLoading(false);
		}
		loadThemes();
	}, [opportunityId]);

	// Group themes by status
	const groupedThemes = useMemo(() => {
		const active = themes.filter((t) => t.status !== "archived");
		const archived = themes.filter((t) => t.status === "archived");
		return { active, archived };
	}, [themes]);

	// Toggle theme expansion
	const toggleExpanded = useCallback((themeId: string) => {
		setExpandedThemes((prev) => {
			const next = new Set(prev);
			if (next.has(themeId)) {
				next.delete(themeId);
			} else {
				next.add(themeId);
			}
			return next;
		});
	}, []);

	// Handle theme selection
	const handleSelect = useCallback(
		(theme: WinTheme) => {
			onThemeSelect?.(theme);
		},
		[onThemeSelect]
	);

	// Handle theme edit
	const handleEdit = useCallback(
		(theme: WinTheme) => {
			onEditTheme?.(theme);
		},
		[onEditTheme]
	);

	// Handle status change
	const handleStatusChange = useCallback(
		async (themeId: string, status: ThemeStatus) => {
			const result = await updateTheme(themeId, { status });
			if (result.success && result.data) {
				setThemes((prev) =>
					prev.map((t) => (t.id === themeId ? { ...t, status } : t))
				);
			}
		},
		[]
	);

	// Handle delete
	const handleDelete = useCallback(async () => {
		if (!deleteDialogTheme) return;

		setIsDeleting(true);
		const result = await deleteTheme(deleteDialogTheme.id);
		if (result.success) {
			setThemes((prev) => prev.filter((t) => t.id !== deleteDialogTheme.id));
			setDeleteDialogTheme(null);
		}
		setIsDeleting(false);
	}, [deleteDialogTheme]);

	// Handle drag and drop reorder
	const handleDragStart = useCallback((themeId: string) => {
		setDraggedTheme(themeId);
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, targetThemeId: string) => {
			e.preventDefault();
			if (!draggedTheme || draggedTheme === targetThemeId) return;

			setThemes((prev) => {
				const draggedIndex = prev.findIndex((t) => t.id === draggedTheme);
				const targetIndex = prev.findIndex((t) => t.id === targetThemeId);
				if (draggedIndex === -1 || targetIndex === -1) return prev;

				const newThemes = [...prev];
				const [removed] = newThemes.splice(draggedIndex, 1);
				newThemes.splice(targetIndex, 0, removed);
				return newThemes;
			});
		},
		[draggedTheme]
	);

	const handleDragEnd = useCallback(async () => {
		if (draggedTheme) {
			const activeThemeIds = groupedThemes.active.map((t) => t.id);
			await reorderThemes(opportunityId, activeThemeIds);
		}
		setDraggedTheme(null);
	}, [draggedTheme, groupedThemes.active, opportunityId]);

	// Loading state
	if (isLoading) {
		return <ThemeManagerSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Target className="h-5 w-5" />
						Win Themes
						{themes.length > 0 && (
							<Badge variant="secondary">{groupedThemes.active.length}</Badge>
						)}
					</CardTitle>
					<Button onClick={onCreateTheme} size="sm">
						<Plus className="h-4 w-4 mr-2" />
						Add Theme
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Empty State */}
				{themes.length === 0 && !error && (
					<div className="text-center py-8">
						<Target className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No win themes yet</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Create win themes to strengthen your proposal narrative
						</p>
						<Button onClick={onCreateTheme} className="mt-4">
							<Plus className="h-4 w-4 mr-2" />
							Create Your First Theme
						</Button>
					</div>
				)}

				{/* Active Themes */}
				{groupedThemes.active.length > 0 && (
					<div className="space-y-2">
						{groupedThemes.active.map((theme) => (
							<div
								key={theme.id}
								draggable
								onDragStart={() => handleDragStart(theme.id)}
								onDragOver={(e) => handleDragOver(e, theme.id)}
								onDragEnd={handleDragEnd}
							>
								<ThemeCard
									theme={theme}
									isExpanded={expandedThemes.has(theme.id)}
									isDragging={draggedTheme === theme.id}
									onToggleExpand={() => toggleExpanded(theme.id)}
									onSelect={() => handleSelect(theme)}
									onEdit={() => handleEdit(theme)}
									onDelete={() => setDeleteDialogTheme(theme)}
									onStatusChange={(status) => handleStatusChange(theme.id, status)}
								/>
							</div>
						))}
					</div>
				)}

				{/* Archived Themes */}
				{groupedThemes.archived.length > 0 && (
					<Collapsible>
						<CollapsibleTrigger asChild>
							<Button variant="ghost" className="w-full justify-start text-muted-foreground">
								<ChevronRight className="h-4 w-4 mr-2" />
								Archived Themes ({groupedThemes.archived.length})
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="space-y-2 mt-2">
							{groupedThemes.archived.map((theme) => (
								<ThemeCard
									key={theme.id}
									theme={theme}
									isExpanded={expandedThemes.has(theme.id)}
									isDragging={false}
									onToggleExpand={() => toggleExpanded(theme.id)}
									onSelect={() => handleSelect(theme)}
									onEdit={() => handleEdit(theme)}
									onDelete={() => setDeleteDialogTheme(theme)}
									onStatusChange={(status) => handleStatusChange(theme.id, status)}
								/>
							))}
						</CollapsibleContent>
					</Collapsible>
				)}
			</CardContent>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteDialogTheme} onOpenChange={() => setDeleteDialogTheme(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Win Theme</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteDialogTheme?.shortVersion}"?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogTheme(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export default ThemeManager;
