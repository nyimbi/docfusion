/**
 * Relevance Matrix Component
 *
 * Visual matrix comparing multiple past performance projects
 * against opportunity requirements with side-by-side scoring.
 */

"use client";

import { useState, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	LayoutGrid,
	List,
	ArrowUpDown,
	CheckCircle,
	XCircle,
	Minus,
	Star,
	Download,
	RefreshCw,
	Info,
	Target,
	TrendingUp,
} from "lucide-react";
import type { Project, ProjectRelevanceScore } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface ProjectWithScore {
	project: Project;
	score: ProjectRelevanceScore;
}

interface Requirement {
	id: string;
	text: string;
	category?: string;
	weight?: number;
}

interface RelevanceMatrixProps {
	projectsWithScores: ProjectWithScore[];
	requirements?: Requirement[];
	maxSelections?: number;
	onSelectProjects: (projectIds: string[]) => void;
	onRefreshScores?: () => Promise<void>;
	onExport?: (projectIds: string[]) => void;
	isLoading?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Score cell with color coding
 */
function ScoreCell({
	score,
	showLabel = false,
}: {
	score: number | null | undefined;
	showLabel?: boolean;
}) {
	if (score === null || score === undefined) {
		return (
			<span className="text-muted-foreground text-sm">—</span>
		);
	}

	const getColor = (s: number) => {
		if (s >= 80) return "bg-emerald-500 text-white";
		if (s >= 60) return "bg-green-500 text-white";
		if (s >= 40) return "bg-yellow-500 text-black";
		if (s >= 20) return "bg-orange-500 text-white";
		return "bg-red-500 text-white";
	};

	const getLabel = (s: number) => {
		if (s >= 80) return "Excellent";
		if (s >= 60) return "Good";
		if (s >= 40) return "Fair";
		if (s >= 20) return "Weak";
		return "Poor";
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger>
					<div
						className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold ${getColor(score)}`}
					>
						{score.toFixed(0)}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>{getLabel(score)} match ({score.toFixed(1)}%)</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Requirement match indicator
 */
function RequirementMatch({
	strength,
	reason,
}: {
	strength: number;
	reason?: string;
}) {
	const Icon = strength >= 70 ? CheckCircle : strength >= 40 ? Minus : XCircle;
	const color =
		strength >= 70
			? "text-green-600"
			: strength >= 40
				? "text-yellow-600"
				: "text-red-600";

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger>
					<Icon className={`h-5 w-5 ${color}`} />
				</TooltipTrigger>
				<TooltipContent>
					<p>Match strength: {strength}%</p>
					{reason && <p className="text-xs mt-1">{reason}</p>}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * CPAR mini display
 */
function CPARMini({ ratings }: { ratings: { overall: number } | null }) {
	if (!ratings) return <span className="text-muted-foreground text-sm">—</span>;

	return (
		<div className="flex items-center gap-1">
			<Star className="h-4 w-4 text-yellow-500" />
			<span className="font-medium">{ratings.overall.toFixed(1)}</span>
		</div>
	);
}

/**
 * Rank badge
 */
function RankBadge({ rank }: { rank: number }) {
	const getStyle = (r: number) => {
		if (r === 1) return "bg-yellow-500 text-white";
		if (r === 2) return "bg-gray-400 text-white";
		if (r === 3) return "bg-orange-600 text-white";
		return "bg-muted text-muted-foreground";
	};

	return (
		<div
			className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getStyle(rank)}`}
		>
			{rank}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function RelevanceMatrix({
	projectsWithScores,
	requirements = [],
	maxSelections = 3,
	onSelectProjects,
	onRefreshScores,
	onExport,
	isLoading = false,
}: RelevanceMatrixProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [sortBy, setSortBy] = useState<"score" | "name" | "cpar">("score");
	const [viewMode, setViewMode] = useState<"matrix" | "table">("matrix");

	// Sort projects
	const sortedProjects = useMemo(() => {
		return [...projectsWithScores].sort((a, b) => {
			switch (sortBy) {
				case "score":
					return b.score.overallScore - a.score.overallScore;
				case "name":
					return a.project.name.localeCompare(b.project.name);
				case "cpar":
					const aRating = (a.project.cparRatings as { overall: number } | null)
						?.overall || 0;
					const bRating = (b.project.cparRatings as { overall: number } | null)
						?.overall || 0;
					return bRating - aRating;
				default:
					return 0;
			}
		});
	}, [projectsWithScores, sortBy]);

	// Handle selection
	const toggleSelection = (projectId: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(projectId)) {
				next.delete(projectId);
			} else if (next.size < maxSelections) {
				next.add(projectId);
			}
			return next;
		});
	};

	// Handle save selection
	const handleSaveSelection = () => {
		onSelectProjects(Array.from(selectedIds));
	};

	// Get rank for project
	const getRank = (projectId: string) => {
		const index = sortedProjects.findIndex((p) => p.project.id === projectId);
		return index + 1;
	};

	if (projectsWithScores.length === 0) {
		return (
			<Card>
				<CardContent className="p-12 text-center">
					<Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
					<p className="text-lg font-medium mb-2">No projects to compare</p>
					<p className="text-muted-foreground">
						Calculate relevance scores for projects to see the matrix
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<LayoutGrid className="h-5 w-5" />
							Relevance Matrix
						</CardTitle>
						<CardDescription>
							Compare {projectsWithScores.length} projects | Select up to{" "}
							{maxSelections} for proposal
						</CardDescription>
					</div>

					<div className="flex items-center gap-2">
						<Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
							<SelectTrigger className="w-32">
								<ArrowUpDown className="h-4 w-4 mr-2" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="score">By Score</SelectItem>
								<SelectItem value="name">By Name</SelectItem>
								<SelectItem value="cpar">By CPAR</SelectItem>
							</SelectContent>
						</Select>

						{onRefreshScores && (
							<Button
								variant="outline"
								size="icon"
								onClick={onRefreshScores}
								disabled={isLoading}
							>
								<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
							</Button>
						)}

						{onExport && (
							<Button
								variant="outline"
								onClick={() => onExport(Array.from(selectedIds))}
								disabled={selectedIds.size === 0}
							>
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent>
				{/* Selection Summary */}
				<div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
					<div className="flex items-center gap-2">
						<CheckCircle
							className={`h-5 w-5 ${
								selectedIds.size > 0 ? "text-primary" : "text-muted-foreground"
							}`}
						/>
						<span className="font-medium">
							{selectedIds.size} of {maxSelections} selected
						</span>
					</div>
					{selectedIds.size > 0 && (
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedIds(new Set())}
							>
								Clear
							</Button>
							<Button size="sm" onClick={handleSaveSelection}>
								Confirm Selection
							</Button>
						</div>
					)}
				</div>

				{/* Matrix Table */}
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">Select</TableHead>
								<TableHead className="w-12">Rank</TableHead>
								<TableHead className="min-w-[200px]">Project</TableHead>
								<TableHead className="w-24 text-center">Score</TableHead>
								<TableHead className="w-20 text-center">CPAR</TableHead>
								<TableHead className="w-24 text-center">Recency</TableHead>
								<TableHead className="w-24 text-center">Size</TableHead>
								<TableHead className="w-24 text-center">Scope</TableHead>
								<TableHead className="w-24 text-center">Customer</TableHead>
								{requirements.length > 0 && (
									<TableHead className="text-center">
										Requirements ({requirements.length})
									</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{sortedProjects.map(({ project, score }) => {
								const isSelected = selectedIds.has(project.id);
								const canSelect = isSelected || selectedIds.size < maxSelections;
								const rank = getRank(project.id);
								const cparRatings = project.cparRatings as { overall: number } | null;
								const matchingReqs = score.matchingRequirements as Array<{
									requirementId: string;
									matchStrength: number;
									matchReason?: string;
								}> | null;

								return (
									<TableRow
										key={project.id}
										className={isSelected ? "bg-primary/5" : ""}
									>
										<TableCell>
											<Checkbox
												checked={isSelected}
												onCheckedChange={() => toggleSelection(project.id)}
												disabled={!canSelect}
											/>
										</TableCell>
										<TableCell>
											<RankBadge rank={rank} />
										</TableCell>
										<TableCell>
											<div>
												<p className="font-medium">{project.name}</p>
												<p className="text-xs text-muted-foreground">
													{project.customerName}
												</p>
											</div>
										</TableCell>
										<TableCell className="text-center">
											<ScoreCell score={score.overallScore} />
										</TableCell>
										<TableCell className="text-center">
											<CPARMini ratings={cparRatings} />
										</TableCell>
										<TableCell className="text-center">
											<ScoreCell score={score.recencyScore} />
										</TableCell>
										<TableCell className="text-center">
											<ScoreCell score={score.sizeScore} />
										</TableCell>
										<TableCell className="text-center">
											<ScoreCell score={score.scopeScore} />
										</TableCell>
										<TableCell className="text-center">
											<ScoreCell score={score.customerScore} />
										</TableCell>
										{requirements.length > 0 && (
											<TableCell>
												<div className="flex items-center justify-center gap-1">
													{requirements.slice(0, 5).map((req) => {
														const match = matchingReqs?.find(
															(m) => m.requirementId === req.id
														);
														return (
															<RequirementMatch
																key={req.id}
																strength={match?.matchStrength || 0}
																reason={match?.matchReason}
															/>
														);
													})}
													{requirements.length > 5 && (
														<Badge variant="outline" className="text-xs">
															+{requirements.length - 5}
														</Badge>
													)}
												</div>
											</TableCell>
										)}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>

				{/* Legend */}
				<div className="mt-4 pt-4 border-t">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<div className="flex items-center gap-4">
							<span className="font-medium">Score Legend:</span>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-emerald-500" />
								<span>80-100</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-green-500" />
								<span>60-79</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-yellow-500" />
								<span>40-59</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-orange-500" />
								<span>20-39</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-red-500" />
								<span>0-19</span>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<Info className="h-3 w-3" />
							Hover over scores for details
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default RelevanceMatrix;
