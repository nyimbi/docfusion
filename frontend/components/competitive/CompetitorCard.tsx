"use client";

/**
 * Competitor Card Component
 *
 * Displays a competitor's information in a card format with
 * logo, capabilities, win/loss statistics, and quick actions.
 */

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Building2,
	Globe,
	MoreVertical,
	Pencil,
	Trash2,
	Eye,
	TrendingUp,
	TrendingDown,
	Award,
	Shield,
	FileText,
	Target,
} from "lucide-react";
import type { Competitor, CompetitorCardProps } from "@/lib/types/competitive";

/**
 * Map competitor type to display label and style
 */
const competitorTypeConfig = {
	prime: { label: "Prime", variant: "default" as const },
	sub: { label: "Subcontractor", variant: "secondary" as const },
	both: { label: "Prime/Sub", variant: "outline" as const },
} as const;

/**
 * Map size standard to display label
 */
const sizeStandardLabels: Record<string, string> = {
	small: "Small Business",
	large: "Large Business",
	"8a": "8(a)",
	hubzone: "HUBZone",
	sdvosb: "SDVOSB",
	wosb: "WOSB",
};

/**
 * Map pricing tendency to color class
 */
const pricingColors: Record<string, string> = {
	aggressive: "text-green-600 dark:text-green-400",
	moderate: "text-yellow-600 dark:text-yellow-400",
	premium: "text-red-600 dark:text-red-400",
};

/**
 * Calculate win rate percentage from win/loss counts
 */
function calculateWinRate(winsAgainstUs?: number | null, lossesToUs?: number | null): number {
	const wins = lossesToUs ?? 0; // Our wins = their losses to us
	const losses = winsAgainstUs ?? 0; // Our losses = their wins against us
	const total = wins + losses;
	return total > 0 ? Math.round((wins / total) * 100) : 0;
}

/**
 * Get capability badge color based on strength
 */
function getCapabilityColor(strength: string): string {
	switch (strength) {
		case "strong":
			return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
		case "moderate":
			return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
		case "weak":
			return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
		default:
			return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
	}
}

export function CompetitorCard({
	competitor,
	onEdit,
	onDelete,
	onViewDetails,
	showWinLoss = true,
	className,
}: CompetitorCardProps & { className?: string }) {
	const winRate = calculateWinRate(competitor.winsAgainstUs, competitor.lossesToUs);
	const totalEncounters = (competitor.winsAgainstUs ?? 0) + (competitor.lossesToUs ?? 0);
	const typeConfig = competitor.competitorType
		? competitorTypeConfig[competitor.competitorType as keyof typeof competitorTypeConfig]
		: null;

	// Get top 3 capabilities
	const topCapabilities = (competitor.capabilities ?? []).slice(0, 3);

	return (
		<Card
			interactive
			variant="default"
			className={cn("relative group", className)}
		>
			{/* Quick Actions Dropdown */}
			<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<MoreVertical className="h-4 w-4" />
							<span className="sr-only">Open menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{onViewDetails && (
							<DropdownMenuItem onClick={() => onViewDetails(competitor)}>
								<Eye className="h-4 w-4 mr-2" />
								View Details
							</DropdownMenuItem>
						)}
						{onEdit && (
							<DropdownMenuItem onClick={() => onEdit(competitor)}>
								<Pencil className="h-4 w-4 mr-2" />
								Edit
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						{onDelete && (
							<DropdownMenuItem
								onClick={() => onDelete(competitor.id)}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<CardHeader className="pb-2">
				<div className="flex items-start gap-4">
					{/* Logo/Icon */}
					<div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
						{competitor.logoUrl ? (
							<Image
								src={competitor.logoUrl}
								alt={`${competitor.name} logo`}
								className="w-10 h-10 object-contain rounded"
							width={40}
							height={40}
							unoptimized
							/>
						) : (
							<Building2 className="h-6 w-6 text-muted-foreground" />
						)}
					</div>

					<div className="flex-1 min-w-0">
						<CardTitle className="text-base font-semibold truncate pr-8">
							{competitor.name}
						</CardTitle>
						{competitor.legalName && competitor.legalName !== competitor.name && (
							<CardDescription className="text-xs truncate">
								{competitor.legalName}
							</CardDescription>
						)}

						{/* Type and Size Badges */}
						<div className="flex flex-wrap gap-1.5 mt-2">
							{typeConfig && (
								<Badge variant={typeConfig.variant} className="text-xs">
									{typeConfig.label}
								</Badge>
							)}
							{competitor.sizeStandard && (
								<Badge variant="outline" className="text-xs">
									{sizeStandardLabels[competitor.sizeStandard] || competitor.sizeStandard}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Capabilities */}
				{topCapabilities.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<Target className="h-3.5 w-3.5" />
							Capabilities
						</div>
						<div className="flex flex-wrap gap-1">
							{topCapabilities.map((cap, idx) => (
								<TooltipProvider key={idx}>
									<Tooltip>
										<TooltipTrigger asChild>
											<Badge
												variant="secondary"
												className={cn("text-xs cursor-default", getCapabilityColor(cap.strength))}
											>
												{cap.area}
											</Badge>
										</TooltipTrigger>
										<TooltipContent>
											<p className="font-medium">{cap.area}</p>
											<p className="text-xs text-muted-foreground capitalize">
												Strength: {cap.strength}
											</p>
											{cap.notes && (
												<p className="text-xs mt-1">{cap.notes}</p>
											)}
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							))}
							{(competitor.capabilities ?? []).length > 3 && (
								<Badge variant="outline" className="text-xs">
									+{(competitor.capabilities ?? []).length - 3} more
								</Badge>
							)}
						</div>
					</div>
				)}

				{/* Win/Loss Statistics */}
				{showWinLoss && totalEncounters > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-xs">
							<span className="flex items-center gap-1.5 font-medium text-muted-foreground">
								{winRate >= 50 ? (
									<TrendingUp className="h-3.5 w-3.5 text-green-500" />
								) : (
									<TrendingDown className="h-3.5 w-3.5 text-red-500" />
								)}
								Win Rate vs. Them
							</span>
							<span className="font-semibold">
								{winRate}%
							</span>
						</div>
						<Progress value={winRate} className="h-2" />
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>{competitor.lossesToUs ?? 0} wins</span>
							<span>{competitor.winsAgainstUs ?? 0} losses</span>
						</div>
					</div>
				)}

				{/* Quick Stats Row */}
				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					{competitor.certifications && competitor.certifications.length > 0 && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex items-center gap-1 cursor-default">
										<Award className="h-3.5 w-3.5" />
										{competitor.certifications.length} certs
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p className="font-medium mb-1">Certifications</p>
									<ul className="text-xs space-y-0.5">
										{competitor.certifications.slice(0, 5).map((cert, idx) => (
											<li key={idx}>{cert}</li>
										))}
										{competitor.certifications.length > 5 && (
											<li className="text-muted-foreground">
												+{competitor.certifications.length - 5} more
											</li>
										)}
									</ul>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}

					{competitor.contractVehicles && competitor.contractVehicles.length > 0 && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex items-center gap-1 cursor-default">
										<FileText className="h-3.5 w-3.5" />
										{competitor.contractVehicles.length} vehicles
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p className="font-medium mb-1">Contract Vehicles</p>
									<ul className="text-xs space-y-0.5">
										{competitor.contractVehicles.slice(0, 5).map((vehicle, idx) => (
											<li key={idx}>{vehicle}</li>
										))}
										{competitor.contractVehicles.length > 5 && (
											<li className="text-muted-foreground">
												+{competitor.contractVehicles.length - 5} more
											</li>
										)}
									</ul>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}

					{competitor.pricingTendency && (
						<span className={cn("flex items-center gap-1", pricingColors[competitor.pricingTendency])}>
							<Shield className="h-3.5 w-3.5" />
							{competitor.pricingTendency}
						</span>
					)}
				</div>

				{/* Strengths/Weaknesses Summary */}
				{((competitor.strengths ?? []).length > 0 || (competitor.weaknesses ?? []).length > 0) && (
					<div className="grid grid-cols-2 gap-3 pt-2 border-t">
						{(competitor.strengths ?? []).length > 0 && (
							<div>
								<p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
									Strengths
								</p>
								<ul className="text-xs text-muted-foreground space-y-0.5">
									{(competitor.strengths ?? []).slice(0, 2).map((s, idx) => (
										<li key={idx} className="truncate">{s}</li>
									))}
								</ul>
							</div>
						)}
						{(competitor.weaknesses ?? []).length > 0 && (
							<div>
								<p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
									Weaknesses
								</p>
								<ul className="text-xs text-muted-foreground space-y-0.5">
									{(competitor.weaknesses ?? []).slice(0, 2).map((w, idx) => (
										<li key={idx} className="truncate">{w}</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}
			</CardContent>

			{/* Website Link */}
			{competitor.website && (
				<CardFooter className="pt-0">
					<a
						href={competitor.website}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<Globe className="h-3.5 w-3.5" />
						{new URL(competitor.website).hostname}
					</a>
				</CardFooter>
			)}
		</Card>
	);
}

export default CompetitorCard;
