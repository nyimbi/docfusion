/**
 * Project Card Component
 *
 * Compact display of past performance project with key metrics,
 * CPAR ratings visualization, and quick actions.
 */

"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Building2,
	Calendar,
	DollarSign,
	Users,
	Star,
	MoreVertical,
	ExternalLink,
	Edit,
	Copy,
	Trash2,
	FileText,
	CheckCircle,
	AlertCircle,
	Clock,
	TrendingUp,
	Award,
	Shield,
} from "lucide-react";
import type { Project } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface ProjectCardProps {
	project: Project;
	onEdit?: (projectId: string) => void;
	onDelete?: (projectId: string) => void;
	onDuplicate?: (projectId: string) => void;
	onViewDetails?: (projectId: string) => void;
	onSelect?: (projectId: string, selected: boolean) => void;
	isSelected?: boolean;
	showRelevance?: boolean;
	relevanceScore?: number;
	compact?: boolean;
}

interface CPARRatings {
	quality: number;
	schedule: number;
	cost: number;
	management: number;
	smallBusiness?: number;
	overall: number;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Visual CPAR rating indicator with color coding
 */
function CPARRatingBar({
	label,
	rating,
	showLabel = true,
}: {
	label: string;
	rating: number;
	showLabel?: boolean;
}) {
	const getColor = (r: number) => {
		if (r >= 4.5) return "bg-emerald-500";
		if (r >= 3.5) return "bg-green-500";
		if (r >= 2.5) return "bg-yellow-500";
		if (r >= 1.5) return "bg-orange-500";
		return "bg-red-500";
	};

	const getRatingText = (r: number) => {
		if (r >= 4.5) return "Exceptional";
		if (r >= 3.5) return "Very Good";
		if (r >= 2.5) return "Satisfactory";
		if (r >= 1.5) return "Marginal";
		return "Unsatisfactory";
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-2">
						{showLabel && (
							<span className="text-xs text-muted-foreground w-8 truncate">
								{label}
							</span>
						)}
						<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
							<div
								className={`h-full ${getColor(rating)} transition-all duration-300`}
								style={{ width: `${(rating / 5) * 100}%` }}
							/>
						</div>
						<span className="text-xs font-medium w-6 text-right">
							{rating.toFixed(1)}
						</span>
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{label}: {getRatingText(rating)} ({rating.toFixed(1)}/5.0)
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Compact CPAR ratings display
 */
function CPARRatingsCompact({ ratings }: { ratings: CPARRatings }) {
	return (
		<div className="space-y-1">
			<CPARRatingBar label="Q" rating={ratings.quality} />
			<CPARRatingBar label="S" rating={ratings.schedule} />
			<CPARRatingBar label="C" rating={ratings.cost} />
			<CPARRatingBar label="M" rating={ratings.management} />
		</div>
	);
}

/**
 * Overall CPAR score badge
 */
function CPAROverallBadge({ rating }: { rating: number }) {
	const getVariant = (r: number) => {
		if (r >= 4.5) return "default";
		if (r >= 3.5) return "secondary";
		if (r >= 2.5) return "outline";
		return "destructive";
	};

	return (
		<Badge variant={getVariant(rating)} className="gap-1">
			<Star className="h-3 w-3" />
			{rating.toFixed(1)}
		</Badge>
	);
}

/**
 * Reference status indicator
 */
function ReferenceStatusBadge({
	status,
}: {
	status: string | null | undefined;
}) {
	const config = {
		available: {
			icon: CheckCircle,
			label: "Available",
			variant: "default" as const,
		},
		limited: {
			icon: Clock,
			label: "Limited",
			variant: "secondary" as const,
		},
		unavailable: {
			icon: AlertCircle,
			label: "Unavailable",
			variant: "destructive" as const,
		},
	};

	const current = config[status as keyof typeof config] || config.available;
	const Icon = current.icon;

	return (
		<Badge variant={current.variant} className="gap-1 text-xs">
			<Icon className="h-3 w-3" />
			{current.label}
		</Badge>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectCard({
	project,
	onEdit,
	onDelete,
	onDuplicate,
	onViewDetails,
	onSelect,
	isSelected = false,
	showRelevance = false,
	relevanceScore,
	compact = false,
}: ProjectCardProps) {
	const [isHovered, setIsHovered] = useState(false);

	// Format currency
	const formatCurrency = (value: number | null | undefined) => {
		if (!value) return null;
		if (value >= 1_000_000_000) {
			return `$${(value / 1_000_000_000).toFixed(1)}B`;
		}
		if (value >= 1_000_000) {
			return `$${(value / 1_000_000).toFixed(1)}M`;
		}
		if (value >= 1_000) {
			return `$${(value / 1_000).toFixed(0)}K`;
		}
		return `$${value.toFixed(0)}`;
	};

	// Parse period of performance
	const getPeriodDisplay = () => {
		const period = project.periodOfPerformance as {
			start: string;
			end: string;
		} | null;
		if (!period) return null;

		const start = new Date(period.start);
		const end = new Date(period.end);
		const startYear = start.getFullYear();
		const endYear = end.getFullYear();

		if (startYear === endYear) {
			return startYear.toString();
		}
		return `${startYear}-${endYear}`;
	};

	// Get CPAR ratings
	const cparRatings = project.cparRatings as CPARRatings | null;

	// Get accomplishments count
	const accomplishments = project.keyAccomplishments as string[] | null;
	const accomplishmentCount = accomplishments?.length || 0;

	// Get awards count
	const awards = project.awards as { name: string }[] | null;
	const awardCount = awards?.length || 0;

	if (compact) {
		return (
			<Card
				className={`cursor-pointer transition-all duration-200 ${
					isSelected
						? "ring-2 ring-primary"
						: "hover:shadow-md hover:border-primary/50"
				}`}
				onClick={() => onSelect?.(project.id, !isSelected)}
			>
				<CardContent className="p-3">
					<div className="flex items-start justify-between gap-2">
						<div className="flex-1 min-w-0">
							<h4 className="font-medium text-sm truncate">{project.name}</h4>
							<p className="text-xs text-muted-foreground truncate">
								{project.customerName}
							</p>
						</div>
						{cparRatings && <CPAROverallBadge rating={cparRatings.overall} />}
					</div>
					<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
						{formatCurrency(project.contractValue) && (
							<span className="flex items-center gap-1">
								<DollarSign className="h-3 w-3" />
								{formatCurrency(project.contractValue)}
							</span>
						)}
						{getPeriodDisplay() && (
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								{getPeriodDisplay()}
							</span>
						)}
					</div>
					{showRelevance && relevanceScore !== undefined && (
						<div className="mt-2">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Relevance</span>
								<span className="font-medium">{relevanceScore.toFixed(0)}%</span>
							</div>
							<div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
								<div
									className={`h-full transition-all duration-300 ${
										relevanceScore >= 80
											? "bg-emerald-500"
											: relevanceScore >= 60
												? "bg-green-500"
												: relevanceScore >= 40
													? "bg-yellow-500"
													: "bg-orange-500"
									}`}
									style={{ width: `${relevanceScore}%` }}
								/>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card
			className={`transition-all duration-200 ${
				isSelected
					? "ring-2 ring-primary"
					: "hover:shadow-lg hover:border-primary/50"
			}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<CardTitle className="text-base truncate">
								{project.name}
							</CardTitle>
							{project.primeOrSub === "subcontractor" && (
								<Badge variant="outline" className="text-xs">
									Sub
								</Badge>
							)}
						</div>
						<CardDescription className="flex items-center gap-1 mt-1">
							<Building2 className="h-3 w-3" />
							{project.customerName}
							{project.customerAgency && (
								<span className="text-muted-foreground">
									• {project.customerAgency}
								</span>
							)}
						</CardDescription>
					</div>

					<div className="flex items-center gap-2">
						{cparRatings && <CPAROverallBadge rating={cparRatings.overall} />}
						<ReferenceStatusBadge status={project.referenceStatus} />

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onViewDetails?.(project.id)}>
									<ExternalLink className="h-4 w-4 mr-2" />
									View Details
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onEdit?.(project.id)}>
									<Edit className="h-4 w-4 mr-2" />
									Edit Project
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onDuplicate?.(project.id)}>
									<Copy className="h-4 w-4 mr-2" />
									Duplicate
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onDelete?.(project.id)}
									className="text-destructive"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Contract Info Row */}
				<div className="grid grid-cols-4 gap-3 text-sm">
					{project.contractValue && (
						<div className="flex items-center gap-2">
							<DollarSign className="h-4 w-4 text-muted-foreground" />
							<div>
								<p className="font-medium">
									{formatCurrency(project.contractValue)}
								</p>
								<p className="text-xs text-muted-foreground">Value</p>
							</div>
						</div>
					)}

					{getPeriodDisplay() && (
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4 text-muted-foreground" />
							<div>
								<p className="font-medium">{getPeriodDisplay()}</p>
								<p className="text-xs text-muted-foreground">Period</p>
							</div>
						</div>
					)}

					{project.peakStaffing && (
						<div className="flex items-center gap-2">
							<Users className="h-4 w-4 text-muted-foreground" />
							<div>
								<p className="font-medium">{project.peakStaffing}</p>
								<p className="text-xs text-muted-foreground">Staff</p>
							</div>
						</div>
					)}

					{project.contractType && (
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-muted-foreground" />
							<div>
								<p className="font-medium">{project.contractType}</p>
								<p className="text-xs text-muted-foreground">Type</p>
							</div>
						</div>
					)}
				</div>

				{/* CPAR Ratings */}
				{cparRatings && (
					<div className="p-3 bg-muted/50 rounded-lg">
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-medium">CPAR Ratings</span>
							<span className="text-xs text-muted-foreground">
								Overall: {cparRatings.overall.toFixed(1)}/5.0
							</span>
						</div>
						<CPARRatingsCompact ratings={cparRatings} />
					</div>
				)}

				{/* Brief Description */}
				{project.briefDescription && (
					<p className="text-sm text-muted-foreground line-clamp-2">
						{project.briefDescription}
					</p>
				)}

				{/* Technical Areas */}
				{project.technicalAreas &&
					(project.technicalAreas as string[]).length > 0 && (
						<div className="flex flex-wrap gap-1">
							{(project.technicalAreas as string[]).slice(0, 4).map((area) => (
								<Badge key={area} variant="secondary" className="text-xs">
									{area}
								</Badge>
							))}
							{(project.technicalAreas as string[]).length > 4 && (
								<Badge variant="outline" className="text-xs">
									+{(project.technicalAreas as string[]).length - 4} more
								</Badge>
							)}
						</div>
					)}

				{/* Bottom Stats Row */}
				<div className="flex items-center justify-between pt-2 border-t">
					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						{accomplishmentCount > 0 && (
							<span className="flex items-center gap-1">
								<TrendingUp className="h-3 w-3" />
								{accomplishmentCount} accomplishments
							</span>
						)}
						{awardCount > 0 && (
							<span className="flex items-center gap-1">
								<Award className="h-3 w-3" />
								{awardCount} awards
							</span>
						)}
						{project.securityLevel && (
							<span className="flex items-center gap-1">
								<Shield className="h-3 w-3" />
								{project.securityLevel}
							</span>
						)}
					</div>

					{/* Relevance Score */}
					{showRelevance && relevanceScore !== undefined && (
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">Relevance:</span>
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
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default ProjectCard;
