"use client";

/**
 * Deal Card Component
 *
 * Card view for displaying deal information.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QuickActions } from "../shared";
import {
	DollarSign,
	Calendar,
	Building2,
	User,
	TrendingUp,
	Clock,
	AlertCircle,
} from "lucide-react";
import type { DealRow } from "@/lib/db/schema-crm";
import { DEAL_STAGES } from "@/lib/types/crm";

interface DealCardProps {
	deal: DealRow;
	variant?: "default" | "compact" | "detailed";
	accountName?: string;
	contactName?: string;
	onClick?: () => void;
	onLogCall?: () => void;
	onSendEmail?: () => void;
	onScheduleMeeting?: () => void;
	onAddNote?: () => void;
	className?: string;
}

export function DealCard({
	deal,
	variant = "default",
	accountName,
	contactName,
	onClick,
	onLogCall,
	onSendEmail,
	onScheduleMeeting,
	onAddNote,
	className,
}: DealCardProps) {
	// Format currency
	const formatCurrency = (value: number | null, currency = "USD") => {
		if (!value) return "$0";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	// Format date
	const formatDate = (date: Date | string | null) => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	// Check if overdue
	const isOverdue =
		deal.expectedCloseDate &&
		new Date(deal.expectedCloseDate) < new Date() &&
		deal.status === "open";

	// Get days until close
	const getDaysUntilClose = () => {
		if (!deal.expectedCloseDate) return null;
		const diff = new Date(deal.expectedCloseDate).getTime() - new Date().getTime();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	};

	// Get stage config
	const getStageConfig = () => {
		return DEAL_STAGES.find((s) => s.id === deal.stage) ?? { label: deal.stage, color: "gray" };
	};

	// Get status badge
	const getStatusBadge = () => {
		switch (deal.status) {
			case "won":
				return <Badge className="bg-green-100 text-green-700">Won</Badge>;
			case "lost":
				return <Badge className="bg-red-100 text-red-700">Lost</Badge>;
			case "on_hold":
				return <Badge className="bg-yellow-100 text-yellow-700">On Hold</Badge>;
			case "abandoned":
				return <Badge className="bg-gray-100 text-gray-700">Abandoned</Badge>;
			default:
				return null;
		}
	};

	const stageConfig = getStageConfig();
	const daysUntilClose = getDaysUntilClose();

	if (variant === "compact") {
		return (
			<Card className={cn("hover:shadow-md transition-shadow", className)}>
				<CardContent className="p-4">
					<Link href={`/crm/deals/${deal.id}`} className="block">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<h3 className="font-medium truncate">{deal.name}</h3>
								<div className="flex items-center gap-2 mt-1">
									<Badge
										variant="outline"
										className={cn(
											"text-xs",
											stageConfig.color === "green" && "bg-green-100 text-green-700",
											stageConfig.color === "blue" && "bg-blue-100 text-blue-700",
											stageConfig.color === "yellow" && "bg-yellow-100 text-yellow-700",
											stageConfig.color === "red" && "bg-red-100 text-red-700"
										)}
									>
										{stageConfig.label}
									</Badge>
									{getStatusBadge()}
								</div>
							</div>
							<span className="font-semibold text-green-600 whitespace-nowrap">
								{formatCurrency(deal.value, deal.currency ?? "USD")}
							</span>
						</div>
					</Link>
				</CardContent>
			</Card>
		);
	}

	if (variant === "detailed") {
		return (
			<Card className={cn("hover:shadow-md transition-shadow", className)}>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-4">
						<Link
							href={`/crm/deals/${deal.id}`}
							className="min-w-0 flex-1"
						>
							<h3 className="font-semibold text-lg truncate">{deal.name}</h3>
							<div className="flex items-center gap-2 mt-1">
								<Badge
									variant="outline"
									className={cn(
										stageConfig.color === "green" && "bg-green-100 text-green-700",
										stageConfig.color === "blue" && "bg-blue-100 text-blue-700",
										stageConfig.color === "yellow" && "bg-yellow-100 text-yellow-700",
										stageConfig.color === "red" && "bg-red-100 text-red-700"
									)}
								>
									{stageConfig.label}
								</Badge>
								{getStatusBadge()}
								{isOverdue && (
									<Badge variant="destructive" className="text-xs">
										<AlertCircle className="h-3 w-3 mr-1" />
										Overdue
									</Badge>
								)}
							</div>
						</Link>
						<QuickActions
							entityType="deal"
							entityId={deal.id}
							onLogCall={onLogCall}
							onSendEmail={onSendEmail}
							onScheduleMeeting={onScheduleMeeting}
							onAddNote={onAddNote}
							size="sm"
						/>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Value and Probability */}
					<div className="flex items-center justify-between">
						<div>
							<span className="text-2xl font-bold text-green-600">
								{formatCurrency(deal.value, deal.currency ?? "USD")}
							</span>
							{deal.recurringValue && (
								<span className="text-sm text-muted-foreground ml-2">
									+ {formatCurrency(deal.recurringValue, deal.currency ?? "USD")}/{deal.recurringPeriod}
								</span>
							)}
						</div>
						{deal.stageProbability !== null && (
							<div className="text-right">
								<span className="text-sm text-muted-foreground">Probability</span>
								<p className="font-semibold">{deal.stageProbability}%</p>
							</div>
						)}
					</div>

					{/* Progress bar */}
					{deal.stageProbability !== null && (
						<Progress value={deal.stageProbability} className="h-2" />
					)}

					{deal.description && (
						<p className="text-sm text-muted-foreground line-clamp-2">
							{deal.description}
						</p>
					)}

					<div className="grid grid-cols-2 gap-3 text-sm">
						{accountName && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Building2 className="h-4 w-4" />
								<span className="truncate">{accountName}</span>
							</div>
						)}
						{contactName && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<User className="h-4 w-4" />
								<span className="truncate">{contactName}</span>
							</div>
						)}
						{deal.expectedCloseDate && (
							<div
								className={cn(
									"flex items-center gap-2",
									isOverdue ? "text-red-600" : "text-muted-foreground"
								)}
							>
								<Calendar className="h-4 w-4" />
								<span>Close: {formatDate(deal.expectedCloseDate)}</span>
							</div>
						)}
						{daysUntilClose !== null && deal.status === "open" && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Clock className="h-4 w-4" />
								<span>
									{daysUntilClose > 0
										? `${daysUntilClose} days left`
										: `${Math.abs(daysUntilClose)} days overdue`}
								</span>
							</div>
						)}
					</div>

					{/* Tags */}
					{(deal.tags as string[])?.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{(deal.tags as string[]).slice(0, 3).map((tag) => (
								<Badge key={tag} variant="secondary" className="text-xs">
									{tag}
								</Badge>
							))}
							{(deal.tags as string[]).length > 3 && (
								<Badge variant="outline" className="text-xs">
									+{(deal.tags as string[]).length - 3}
								</Badge>
							)}
						</div>
					)}

					{/* Win/Loss info for closed deals */}
					{deal.status === "won" && deal.winReason && (
						<div className="p-3 bg-green-50 rounded-md">
							<p className="text-sm text-green-700">
								<strong>Win reason:</strong> {deal.winReason}
							</p>
						</div>
					)}
					{deal.status === "lost" && deal.lossReason && (
						<div className="p-3 bg-red-50 rounded-md">
							<p className="text-sm text-red-700">
								<strong>Loss reason:</strong> {deal.lossReason}
							</p>
							{deal.competitorLostTo && (
								<p className="text-sm text-red-600 mt-1">
									Lost to: {deal.competitorLostTo}
								</p>
							)}
						</div>
					)}

					{/* Footer */}
					<div className="flex items-center justify-between pt-2 border-t">
						<span className="text-xs text-muted-foreground">
							Owner: {deal.ownerName ?? "Unassigned"}
						</span>
						<Link
							href={`/crm/deals/${deal.id}`}
							className="text-sm text-primary hover:underline"
						>
							View details
						</Link>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Default variant
	return (
		<Card className={cn("hover:shadow-md transition-shadow", className)}>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-3 mb-3">
					<Link
						href={`/crm/deals/${deal.id}`}
						className="min-w-0 flex-1"
					>
						<h3 className="font-medium truncate">{deal.name}</h3>
						<div className="flex items-center gap-2 mt-1">
							<Badge
								variant="outline"
								className={cn(
									"text-xs",
									stageConfig.color === "green" && "bg-green-100 text-green-700",
									stageConfig.color === "blue" && "bg-blue-100 text-blue-700",
									stageConfig.color === "yellow" && "bg-yellow-100 text-yellow-700",
									stageConfig.color === "red" && "bg-red-100 text-red-700"
								)}
							>
								{stageConfig.label}
							</Badge>
							{getStatusBadge()}
						</div>
					</Link>
					<QuickActions
						entityType="deal"
						entityId={deal.id}
						onLogCall={onLogCall}
						onSendEmail={onSendEmail}
						onScheduleMeeting={onScheduleMeeting}
						onAddNote={onAddNote}
						size="sm"
					/>
				</div>

				<div className="space-y-2 text-sm">
					<div className="flex items-center justify-between">
						<span className="text-lg font-semibold text-green-600">
							{formatCurrency(deal.value, deal.currency ?? "USD")}
						</span>
						{deal.stageProbability !== null && (
							<Badge variant="secondary">{deal.stageProbability}%</Badge>
						)}
					</div>

					{deal.expectedCloseDate && (
						<div
							className={cn(
								"flex items-center gap-2",
								isOverdue ? "text-red-600" : "text-muted-foreground"
							)}
						>
							<Calendar className="h-3.5 w-3.5" />
							<span>Close: {formatDate(deal.expectedCloseDate)}</span>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
					<span>{deal.ownerName ?? "Unassigned"}</span>
					{accountName && (
						<span className="flex items-center gap-1">
							<Building2 className="h-3 w-3" />
							{accountName}
						</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default DealCard;
