"use client";

/**
 * Debrief Detail Component
 *
 * Comprehensive view of a debrief record with all scores, analysis,
 * action items, and timeline. Supports editing and action item management.
 */

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	Trophy,
	XCircle,
	MinusCircle,
	Ban,
	ChevronLeft,
	Edit,
	Calendar,
	Target,
	TrendingUp,
	TrendingDown,
	DollarSign,
	Users,
	FileText,
	CheckCircle,
	Clock,
	AlertTriangle,
	Lightbulb,
	Building2,
	ExternalLink,
} from "lucide-react";
import type {
	Debrief,
	ActionItem,
	DebriefOutcome,
	ScoreBreakdown,
	OUTCOME_CONFIG,
} from "@/lib/types/winloss";

interface DebriefDetailProps {
	debrief: Debrief & { opportunityTitle?: string; opportunityOrg?: string };
	onEdit?: () => void;
	onUpdateActionItem?: (itemId: string, status: ActionItem["status"]) => void;
	onAddActionItem?: () => void;
	className?: string;
}

const OUTCOME_ICONS: Record<DebriefOutcome, React.ReactNode> = {
	win: <Trophy className="h-5 w-5 text-green-600" />,
	loss: <XCircle className="h-5 w-5 text-red-600" />,
	no_award: <MinusCircle className="h-5 w-5 text-yellow-600" />,
	cancelled: <Ban className="h-5 w-5 text-gray-600" />,
};

const OUTCOME_COLORS: Record<DebriefOutcome, string> = {
	win: "bg-green-100 text-green-800 border-green-200",
	loss: "bg-red-100 text-red-800 border-red-200",
	no_award: "bg-yellow-100 text-yellow-800 border-yellow-200",
	cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

const OUTCOME_LABELS: Record<DebriefOutcome, string> = {
	win: "Won",
	loss: "Lost",
	no_award: "No Award",
	cancelled: "Cancelled",
};

export function DebriefDetail({
	debrief,
	onEdit,
	onUpdateActionItem,
	onAddActionItem,
	className,
}: DebriefDetailProps) {
	const [activeTab, setActiveTab] = useState("overview");
	const [isPending, startTransition] = useTransition();

	const outcome = debrief.outcome as DebriefOutcome;
	const strengths = (debrief.strengthsIdentified as string[]) ?? [];
	const weaknesses = (debrief.weaknessesIdentified as string[]) ?? [];
	const lessons = (debrief.lessonsLearned as string[]) ?? [];
	const actionItems = (debrief.actionItems as ActionItem[]) ?? [];

	// Format date
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Format currency
	const formatCurrency = (value: number | null | undefined): string => {
		if (value === null || value === undefined) return "-";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 0,
		}).format(value);
	};

	// Calculate score percentage
	const calculateScorePercentage = (
		score: number | null | undefined,
		max: number | null | undefined
	): number | null => {
		if (!score || !max || max === 0) return null;
		return Math.round((score / max) * 100);
	};

	// Get ROI
	const getROI = (): number | null => {
		if (!debrief.proposalInvestment || debrief.proposalInvestment === 0) return null;
		if (outcome !== "win" || !debrief.contractValue) return null;
		return Math.round(
			((debrief.contractValue - debrief.proposalInvestment) / debrief.proposalInvestment) * 100
		);
	};

	// Get pending action items count
	const pendingCount = actionItems.filter((item) => item.status !== "completed").length;

	// Handle action item status update
	const handleStatusUpdate = useCallback(
		(itemId: string, status: ActionItem["status"]) => {
			startTransition(() => {
				onUpdateActionItem?.(itemId, status);
			});
		},
		[onUpdateActionItem]
	);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-start gap-4">
					<Link
						href="/winloss"
						className="mt-1 p-2 hover:bg-muted rounded-md"
						aria-label="Back to Win/Loss"
					>
						<ChevronLeft className="h-5 w-5" />
					</Link>

					<div>
						<div className="flex items-center gap-3">
							{OUTCOME_ICONS[outcome]}
							<h1 className="text-2xl font-bold">
								{debrief.opportunityTitle ?? "Debrief"}
							</h1>
							<Badge className={cn("border", OUTCOME_COLORS[outcome])}>
								{OUTCOME_LABELS[outcome]}
							</Badge>
						</div>

						<div className="flex items-center gap-4 mt-2 text-muted-foreground">
							{debrief.opportunityOrg && (
								<span className="flex items-center gap-1">
									<Building2 className="h-4 w-4" />
									{debrief.opportunityOrg}
								</span>
							)}
							{debrief.debriefDate && (
								<span className="flex items-center gap-1">
									<Calendar className="h-4 w-4" />
									Debrief: {formatDate(debrief.debriefDate)}
								</span>
							)}
							{debrief.debriefType && (
								<Badge variant="outline" className="capitalize">
									{debrief.debriefType} Debrief
								</Badge>
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{onEdit && (
						<Button onClick={onEdit}>
							<Edit className="h-4 w-4 mr-2" />
							Edit
						</Button>
					)}
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-4 gap-4">
				{/* Ranking */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Ranking</p>
								<p className="text-2xl font-bold mt-1">
									{debrief.overallRanking
										? `#${debrief.overallRanking}`
										: "-"}
								</p>
								{debrief.totalBidders && (
									<p className="text-xs text-muted-foreground">
										of {debrief.totalBidders} bidders
									</p>
								)}
							</div>
							<Target className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				{/* Investment */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Investment</p>
								<p className="text-2xl font-bold mt-1">
									{formatCurrency(debrief.proposalInvestment)}
								</p>
							</div>
							<DollarSign className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				{/* Contract Value / ROI */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">
									{outcome === "win" ? "Contract Value" : "Est. Value"}
								</p>
								<p className="text-2xl font-bold mt-1">
									{formatCurrency(debrief.contractValue)}
								</p>
								{getROI() !== null && (
									<p className="text-xs text-green-600">
										ROI: {getROI()}%
									</p>
								)}
							</div>
							{outcome === "win" ? (
								<TrendingUp className="h-8 w-8 text-green-600" />
							) : (
								<TrendingDown className="h-8 w-8 text-muted-foreground" />
							)}
						</div>
					</CardContent>
				</Card>

				{/* Action Items */}
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Action Items</p>
								<p className="text-2xl font-bold mt-1">
									{pendingCount}
								</p>
								<p className="text-xs text-muted-foreground">
									{actionItems.length - pendingCount} completed
								</p>
							</div>
							<CheckCircle className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="scores">Scores</TabsTrigger>
					<TabsTrigger value="feedback">Feedback</TabsTrigger>
					<TabsTrigger value="analysis">Analysis</TabsTrigger>
					<TabsTrigger value="actions">
						Action Items
						{pendingCount > 0 && (
							<Badge variant="secondary" className="ml-2">
								{pendingCount}
							</Badge>
						)}
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-4 mt-4">
					<div className="grid grid-cols-2 gap-4">
						{/* Score Summary */}
						<Card>
							<CardHeader>
								<CardTitle>Score Summary</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{[
									{
										label: "Technical",
										score: debrief.technicalScore,
										max: debrief.technicalMaxScore,
									},
									{
										label: "Management",
										score: debrief.managementScore,
										max: debrief.managementMaxScore,
									},
									{
										label: "Past Performance",
										score: debrief.pastPerfScore,
										max: debrief.pastPerfMaxScore,
									},
									{
										label: "Cost",
										score: debrief.costScore,
										max: debrief.costMaxScore,
									},
								].map((item) => {
									const percentage = calculateScorePercentage(item.score, item.max);
									return (
										<div key={item.label} className="space-y-1">
											<div className="flex justify-between text-sm">
												<span>{item.label}</span>
												<span className="text-muted-foreground">
													{item.score && item.max
														? `${item.score}/${item.max} (${percentage}%)`
														: "-"}
												</span>
											</div>
											<Progress
												value={percentage ?? 0}
												className={cn(
													"h-2",
													percentage && percentage >= 80
														? "[&>div]:bg-green-500"
														: percentage && percentage >= 60
														? "[&>div]:bg-yellow-500"
														: "[&>div]:bg-red-500"
												)}
											/>
										</div>
									);
								})}
							</CardContent>
						</Card>

						{/* Strengths & Weaknesses */}
						<Card>
							<CardHeader>
								<CardTitle>Key Findings</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="text-sm font-medium text-green-700 mb-2">
										Strengths ({strengths.length})
									</h4>
									<div className="flex flex-wrap gap-2">
										{strengths.length > 0 ? (
											strengths.map((strength, index) => (
												<Badge
													key={index}
													variant="secondary"
													className="bg-green-100 text-green-800"
												>
													{strength}
												</Badge>
											))
										) : (
											<span className="text-sm text-muted-foreground">
												No strengths recorded
											</span>
										)}
									</div>
								</div>

								<Separator />

								<div>
									<h4 className="text-sm font-medium text-red-700 mb-2">
										Weaknesses ({weaknesses.length})
									</h4>
									<div className="flex flex-wrap gap-2">
										{weaknesses.length > 0 ? (
											weaknesses.map((weakness, index) => (
												<Badge
													key={index}
													variant="secondary"
													className="bg-red-100 text-red-800"
												>
													{weakness}
												</Badge>
											))
										) : (
											<span className="text-sm text-muted-foreground">
												No weaknesses recorded
											</span>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Winner Info (for losses) */}
					{outcome !== "win" && debrief.winnerName && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Trophy className="h-5 w-5 text-yellow-600" />
									Winner Information
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-3 gap-4">
									<div>
										<p className="text-sm text-muted-foreground">Winner</p>
										<p className="font-medium">{debrief.winnerName}</p>
									</div>
									{debrief.winningPrice && (
										<div>
											<p className="text-sm text-muted-foreground">
												Winning Price
											</p>
											<p className="font-medium">
												{formatCurrency(debrief.winningPrice)}
											</p>
										</div>
									)}
									{debrief.contractValue && debrief.winningPrice && (
										<div>
											<p className="text-sm text-muted-foreground">
												Price Difference
											</p>
											<p
												className={cn(
													"font-medium",
													debrief.winningPrice < (debrief.contractValue ?? 0)
														? "text-red-600"
														: "text-green-600"
												)}
											>
												{formatCurrency(
													(debrief.contractValue ?? 0) - debrief.winningPrice
												)}
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Scores Tab */}
				<TabsContent value="scores" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Detailed Evaluation Scores</CardTitle>
							<CardDescription>
								Scores received from each evaluation factor
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-6">
								{[
									{
										label: "Technical",
										score: debrief.technicalScore,
										max: debrief.technicalMaxScore,
										icon: <FileText className="h-5 w-5" />,
									},
									{
										label: "Management",
										score: debrief.managementScore,
										max: debrief.managementMaxScore,
										icon: <Users className="h-5 w-5" />,
									},
									{
										label: "Past Performance",
										score: debrief.pastPerfScore,
										max: debrief.pastPerfMaxScore,
										icon: <Target className="h-5 w-5" />,
									},
									{
										label: "Cost",
										score: debrief.costScore,
										max: debrief.costMaxScore,
										icon: <DollarSign className="h-5 w-5" />,
									},
								].map((item) => {
									const percentage = calculateScorePercentage(item.score, item.max);
									return (
										<div
											key={item.label}
											className="p-4 border rounded-lg space-y-3"
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													{item.icon}
													<span className="font-medium">{item.label}</span>
												</div>
												{percentage !== null && (
													<Badge
														variant="secondary"
														className={cn(
															percentage >= 80
																? "bg-green-100 text-green-800"
																: percentage >= 60
																? "bg-yellow-100 text-yellow-800"
																: "bg-red-100 text-red-800"
														)}
													>
														{percentage}%
													</Badge>
												)}
											</div>
											<div className="text-3xl font-bold">
												{item.score !== null && item.max !== null
													? `${item.score} / ${item.max}`
													: "-"}
											</div>
											<Progress
												value={percentage ?? 0}
												className={cn(
													"h-3",
													percentage && percentage >= 80
														? "[&>div]:bg-green-500"
														: percentage && percentage >= 60
														? "[&>div]:bg-yellow-500"
														: "[&>div]:bg-red-500"
												)}
											/>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Feedback Tab */}
				<TabsContent value="feedback" className="space-y-4 mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Evaluator Feedback</CardTitle>
						</CardHeader>
						<CardContent>
							{debrief.evaluatorFeedback ? (
								<div className="prose prose-sm max-w-none">
									<p className="whitespace-pre-wrap">{debrief.evaluatorFeedback}</p>
								</div>
							) : (
								<p className="text-muted-foreground">No evaluator feedback recorded</p>
							)}
						</CardContent>
					</Card>

					<div className="grid grid-cols-2 gap-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-green-700">
									Strengths Identified
								</CardTitle>
							</CardHeader>
							<CardContent>
								{strengths.length > 0 ? (
									<ul className="space-y-2">
										{strengths.map((strength, index) => (
											<li
												key={index}
												className="flex items-start gap-2 text-sm"
											>
												<CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
												<span>{strength}</span>
											</li>
										))}
									</ul>
								) : (
									<p className="text-muted-foreground">None recorded</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-red-700">
									Weaknesses Identified
								</CardTitle>
							</CardHeader>
							<CardContent>
								{weaknesses.length > 0 ? (
									<ul className="space-y-2">
										{weaknesses.map((weakness, index) => (
											<li
												key={index}
												className="flex items-start gap-2 text-sm"
											>
												<AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
												<span>{weakness}</span>
											</li>
										))}
									</ul>
								) : (
									<p className="text-muted-foreground">None recorded</p>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Analysis Tab */}
				<TabsContent value="analysis" className="space-y-4 mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Internal Analysis</CardTitle>
						</CardHeader>
						<CardContent>
							{debrief.internalAnalysis ? (
								<div className="prose prose-sm max-w-none">
									<p className="whitespace-pre-wrap">{debrief.internalAnalysis}</p>
								</div>
							) : (
								<p className="text-muted-foreground">No internal analysis recorded</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Lightbulb className="h-5 w-5 text-amber-500" />
								Lessons Learned
							</CardTitle>
						</CardHeader>
						<CardContent>
							{lessons.length > 0 ? (
								<ul className="space-y-3">
									{lessons.map((lesson, index) => (
										<li
											key={index}
											className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg"
										>
											<span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex-shrink-0">
												{index + 1}
											</span>
											<span className="text-sm">{lesson}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="text-muted-foreground">No lessons recorded</p>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Action Items Tab */}
				<TabsContent value="actions" className="space-y-4 mt-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Action Items</CardTitle>
								<CardDescription>
									{actionItems.length} total, {pendingCount} pending
								</CardDescription>
							</div>
							{onAddActionItem && (
								<Button onClick={onAddActionItem} size="sm">
									Add Action Item
								</Button>
							)}
						</CardHeader>
						<CardContent>
							{actionItems.length > 0 ? (
								<div className="space-y-3">
									{actionItems.map((item) => (
										<div
											key={item.id}
											className={cn(
												"flex items-start gap-3 p-4 border rounded-lg",
												item.status === "completed" && "bg-muted"
											)}
										>
											<button
												type="button"
												onClick={() =>
													handleStatusUpdate(
														item.id,
														item.status === "completed" ? "pending" : "completed"
													)
												}
												disabled={isPending}
												className={cn(
													"mt-0.5 flex-shrink-0",
													item.status === "completed"
														? "text-green-600"
														: "text-muted-foreground hover:text-foreground"
												)}
												aria-label={
													item.status === "completed"
														? "Mark as incomplete"
														: "Mark as complete"
												}
											>
												<CheckCircle
													className={cn(
														"h-5 w-5",
														item.status === "completed" && "fill-current"
													)}
												/>
											</button>
											<div className="flex-1 min-w-0">
												<p
													className={cn(
														"font-medium",
														item.status === "completed" &&
															"line-through text-muted-foreground"
													)}
												>
													{item.item}
												</p>
												<div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
													<span className="flex items-center gap-1">
														<Users className="h-3 w-3" />
														{item.assignee}
													</span>
													<span className="flex items-center gap-1">
														<Clock className="h-3 w-3" />
														Due: {formatDate(item.dueDate)}
													</span>
													{item.completedAt && (
														<span className="flex items-center gap-1 text-green-600">
															<CheckCircle className="h-3 w-3" />
															Completed: {formatDate(item.completedAt)}
														</span>
													)}
												</div>
											</div>
											<Badge
												variant="secondary"
												className={cn(
													item.status === "completed"
														? "bg-green-100 text-green-800"
														: item.status === "in_progress"
														? "bg-blue-100 text-blue-800"
														: "bg-gray-100 text-gray-800"
												)}
											>
												{item.status === "in_progress"
													? "In Progress"
													: item.status.charAt(0).toUpperCase() + item.status.slice(1)}
											</Badge>
										</div>
									))}
								</div>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									<CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No action items recorded</p>
									{onAddActionItem && (
										<Button
											variant="link"
											onClick={onAddActionItem}
											className="mt-2"
										>
											Add your first action item
										</Button>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default DebriefDetail;
