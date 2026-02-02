/**
 * BidDecisionPackage Component - DocFusion Capture Pipeline
 *
 * Bid/No-Bid decision package generator with comprehensive analysis,
 * pro/con evaluation, risk assessment, and executive summary.
 * Generates AI-powered recommendations and supports final decision recording.
 *
 * Accessibility: Proper heading hierarchy, form semantics, focus management.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition, useEffect } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import {
	Target,
	DollarSign,
	TrendingUp,
	TrendingDown,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Sparkles,
	FileText,
	ThumbsUp,
	ThumbsDown,
	Scale,
	ChevronDown,
	ChevronUp,
	Briefcase,
	Users,
	Shield,
	Loader2,
	RefreshCw,
	Download,
	Printer,
	Send,
} from "lucide-react";
import { generateBidDecisionPackage, recordBidDecision } from "@/lib/actions/pipeline";
import type { BidDecisionPackage as BidDecisionPackageType, PwinCalculation } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface BidDecisionPackageProps {
	/** Pipeline ID */
	pipelineId: string;
	/** Pre-loaded package data */
	initialPackage?: BidDecisionPackageType | null;
	/** Callback when decision is made */
	onDecisionMade?: (decision: "bid" | "no_bid") => void;
	/** Current user for recording decisions */
	currentUser?: string;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number | null): string {
	if (value === null || value === undefined) return "N/A";
	if (value >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(1)}M`;
	}
	if (value >= 1_000) {
		return `$${(value / 1_000).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

function getRecommendationColor(recommendation: string | undefined): string {
	switch (recommendation) {
		case "bid":
			return "text-green-600 bg-green-100 dark:bg-green-900/30";
		case "no_bid":
			return "text-red-600 bg-red-100 dark:bg-red-900/30";
		case "conditional":
			return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
		default:
			return "text-gray-600 bg-gray-100 dark:bg-gray-900/30";
	}
}

function getRecommendationLabel(recommendation: string | undefined): string {
	switch (recommendation) {
		case "bid":
			return "Recommend: BID";
		case "no_bid":
			return "Recommend: NO BID";
		case "conditional":
			return "Recommend: CONDITIONAL";
		default:
			return "Pending Analysis";
	}
}

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "text-green-600";
	if (pwin >= 50) return "text-yellow-600";
	if (pwin >= 30) return "text-orange-600";
	return "text-red-600";
}

// ============================================================================
// Factor Analysis Component
// ============================================================================

interface FactorAnalysisProps {
	factors: PwinCalculation["factors"];
}

function FactorAnalysis({ factors }: FactorAnalysisProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
			<CollapsibleTrigger asChild>
				<Button variant="ghost" className="w-full justify-between p-2">
					<span className="flex items-center gap-2">
						<Scale className="h-4 w-4" />
						PWin Factor Analysis ({factors.length} factors)
					</span>
					{isExpanded ? (
						<ChevronUp className="h-4 w-4" />
					) : (
						<ChevronDown className="h-4 w-4" />
					)}
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-2 pt-2">
				{factors.map((factor, idx) => (
					<div
						key={idx}
						className={cn(
							"p-3 rounded-lg border",
							factor.impact === "positive" && "bg-green-50 dark:bg-green-900/20 border-green-200",
							factor.impact === "negative" && "bg-red-50 dark:bg-red-900/20 border-red-200",
							factor.impact === "neutral" && "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
						)}
					>
						<div className="flex items-center justify-between mb-1">
							<span className="font-medium text-sm">{factor.factor}</span>
							<div className="flex items-center gap-2">
								<Badge
									variant="secondary"
									className={cn(
										"text-xs",
										factor.impact === "positive" && "bg-green-200 text-green-800",
										factor.impact === "negative" && "bg-red-200 text-red-800",
										factor.impact === "neutral" && "bg-yellow-200 text-yellow-800"
									)}
								>
									{factor.impact}
								</Badge>
								<span className="font-semibold text-sm">{factor.score}</span>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">{factor.rationale}</p>
					</div>
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function BidDecisionPackage({
	pipelineId,
	initialPackage,
	onDecisionMade,
	currentUser = "Current User",
	className,
}: BidDecisionPackageProps) {
	const [isPending, startTransition] = useTransition();
	const [isGenerating, setIsGenerating] = useState(false);
	const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
	const [selectedDecision, setSelectedDecision] = useState<"bid" | "no_bid" | null>(null);
	const [rationale, setRationale] = useState("");
	const [packageData, setPackageData] = useState<BidDecisionPackageType | null>(
		initialPackage || null
	);

	// Generate package on mount if not provided
	useEffect(() => {
		if (!initialPackage && !packageData) {
			handleGeneratePackage();
		}
	}, [initialPackage]);

	// Generate package
	const handleGeneratePackage = useCallback(async () => {
		setIsGenerating(true);
		try {
			const result = await generateBidDecisionPackage(pipelineId);
			if (result.success) {
				setPackageData(result.data);
			}
		} catch (error) {
			console.error("Failed to generate bid decision package:", error);
		} finally {
			setIsGenerating(false);
		}
	}, [pipelineId]);

	// Record decision
	const handleRecordDecision = useCallback(async () => {
		if (!selectedDecision || !rationale.trim()) return;

		startTransition(async () => {
			const result = await recordBidDecision(
				pipelineId,
				selectedDecision,
				rationale,
				currentUser
			);

			if (result.success) {
				onDecisionMade?.(selectedDecision);
				setDecisionDialogOpen(false);
				setSelectedDecision(null);
				setRationale("");
			}
		});
	}, [pipelineId, selectedDecision, rationale, currentUser, onDecisionMade]);

	// Loading state
	if (isGenerating || (!packageData && !initialPackage)) {
		return (
			<Card className={className}>
				<CardContent className="p-8 text-center">
					<Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
					<h4 className="font-semibold mb-2">Generating Bid Decision Package</h4>
					<p className="text-sm text-muted-foreground">
						Analyzing opportunity data and calculating recommendations...
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!packageData) {
		return (
			<Card className={className}>
				<CardContent className="p-8 text-center">
					<AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
					<h4 className="font-semibold mb-2">Package Generation Failed</h4>
					<p className="text-sm text-muted-foreground mb-4">
						Unable to generate the bid decision package
					</p>
					<Button variant="outline" onClick={handleGeneratePackage}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Bid Decision Package
							</CardTitle>
							<CardDescription>{packageData.opportunityName}</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Badge className={cn("text-sm px-3 py-1", getRecommendationColor(packageData.recommendation))}>
								{getRecommendationLabel(packageData.recommendation)}
							</Badge>
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Key Metrics */}
			<div className="grid md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<DollarSign className="h-4 w-4" />
							Contract Value
						</div>
						<div className="text-2xl font-bold">
							{formatCurrency(packageData.contractValue)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<Target className="h-4 w-4" />
							PWin
						</div>
						<div className={cn("text-2xl font-bold", getPwinColor(packageData.pwin))}>
							{packageData.pwin}%
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<Briefcase className="h-4 w-4" />
							Investment to Date
						</div>
						<div className="text-2xl font-bold">
							{formatCurrency(packageData.investmentToDate)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
							<FileText className="h-4 w-4" />
							Est. Proposal Cost
						</div>
						<div className="text-2xl font-bold">
							{formatCurrency(packageData.estimatedProposalCost)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Executive Summary */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						Executive Summary
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm">{packageData.executiveSummary}</p>
				</CardContent>
			</Card>

			{/* Pros and Cons */}
			<div className="grid md:grid-cols-2 gap-4">
				{/* Pros */}
				<Card className="border-green-200 dark:border-green-800">
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-green-600">
							<ThumbsUp className="h-4 w-4" />
							Strengths ({packageData.pros.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{packageData.pros.map((pro, idx) => (
								<li key={idx} className="flex items-start gap-2 text-sm">
									<CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
									<span>{pro}</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>

				{/* Cons */}
				<Card className="border-red-200 dark:border-red-800">
					<CardHeader className="pb-3">
						<CardTitle className="text-base flex items-center gap-2 text-red-600">
							<ThumbsDown className="h-4 w-4" />
							Weaknesses ({packageData.cons.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{packageData.cons.map((con, idx) => (
								<li key={idx} className="flex items-start gap-2 text-sm">
									<XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
									<span>{con}</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			</div>

			{/* Competitive Position */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Users className="h-4 w-4" />
						Competitive Position
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm">{packageData.competitivePosition}</p>
				</CardContent>
			</Card>

			{/* PWin Factor Analysis */}
			{packageData.pwinFactors && packageData.pwinFactors.length > 0 && (
				<Card>
					<CardContent className="pt-4">
						<FactorAnalysis factors={packageData.pwinFactors} />
					</CardContent>
				</Card>
			)}

			{/* Conditions (if conditional) */}
			{packageData.recommendation === "conditional" && packageData.conditions && (
				<Card className="border-yellow-200 dark:border-yellow-800">
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2 text-yellow-600">
							<AlertTriangle className="h-4 w-4" />
							Conditions for Bid
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{packageData.conditions.map((condition, idx) => (
								<li key={idx} className="flex items-start gap-2 text-sm">
									<ChevronDown className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
									<span>{condition}</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* Actions */}
			<Card>
				<CardContent className="pt-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleGeneratePackage}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Regenerate
							</Button>
							<Button variant="outline" size="sm">
								<Download className="h-4 w-4 mr-2" />
								Export PDF
							</Button>
							<Button variant="outline" size="sm">
								<Printer className="h-4 w-4 mr-2" />
								Print
							</Button>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								className="border-red-300 text-red-600 hover:bg-red-50"
								onClick={() => {
									setSelectedDecision("no_bid");
									setDecisionDialogOpen(true);
								}}
							>
								<ThumbsDown className="h-4 w-4 mr-2" />
								No Bid
							</Button>
							<Button
								variant="primary"
								className="bg-green-600 hover:bg-green-700"
								onClick={() => {
									setSelectedDecision("bid");
									setDecisionDialogOpen(true);
								}}
							>
								<ThumbsUp className="h-4 w-4 mr-2" />
								Bid
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Decision Dialog */}
			<Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{selectedDecision === "bid" ? (
								<>
									<ThumbsUp className="h-5 w-5 text-green-500" />
									Confirm Bid Decision
								</>
							) : (
								<>
									<ThumbsDown className="h-5 w-5 text-red-500" />
									Confirm No-Bid Decision
								</>
							)}
						</DialogTitle>
						<DialogDescription>
							Record the final bid decision for {packageData.opportunityName}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div
							className={cn(
								"p-4 rounded-lg text-center",
								selectedDecision === "bid"
									? "bg-green-100 dark:bg-green-900/30"
									: "bg-red-100 dark:bg-red-900/30"
							)}
						>
							<span className="text-2xl font-bold">
								{selectedDecision === "bid" ? "BID" : "NO BID"}
							</span>
						</div>
						<div className="space-y-2">
							<Label htmlFor="rationale">Decision Rationale</Label>
							<Textarea
								id="rationale"
								value={rationale}
								onChange={(e) => setRationale(e.target.value)}
								placeholder={
									selectedDecision === "bid"
										? "Explain why we should pursue this opportunity..."
										: "Explain why we should not bid on this opportunity..."
								}
								rows={4}
							/>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Shield className="h-4 w-4" />
							<span>Decision will be recorded by: {currentUser}</span>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setDecisionDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							variant={selectedDecision === "bid" ? "primary" : "danger"}
							onClick={handleRecordDecision}
							disabled={!rationale.trim() || isPending}
							isLoading={isPending}
						>
							<Send className="h-4 w-4 mr-2" />
							Record Decision
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default BidDecisionPackage;
