/**
 * ClaimAnalyzer - Document Claim Analysis
 *
 * Analyzes document for claims that need evidence support, showing risk
 * indicators, evidence strength badges, and suggestion actions.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	FileSearch,
	AlertTriangle,
	AlertCircle,
	CheckCircle2,
	Info,
	ChevronDown,
	ChevronRight,
	Loader2,
	Lightbulb,
	Award,
	Link as LinkIcon,
	RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ClaimAnalysis, ClaimRiskLevel, EvidenceStrengthTier } from "@/lib/types/evidence";
import { analyzeClaimsInDocument, getClaimsSummary } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface ClaimAnalyzerProps {
	/** Document ID to analyze */
	documentId: string;
	/** Callback when a claim is clicked */
	onClaimClick?: (claim: ClaimAnalysis) => void;
	/** Callback to suggest evidence for a claim */
	onSuggestEvidence?: (claim: ClaimAnalysis) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RISK_CONFIG: Record<
	string,
	{ label: string; icon: typeof AlertTriangle; color: string; bgColor: string }
> = {
	high: {
		label: "High Risk",
		icon: AlertTriangle,
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
	medium: {
		label: "Medium Risk",
		icon: AlertCircle,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	low: {
		label: "Low Risk",
		icon: Info,
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
};

/**
 * Strength configuration for all evidence strength values.
 * Includes both tier-based (gold/silver/bronze) and level-based (weak/moderate/strong) values.
 */
const STRENGTH_CONFIG: Record<
	string,
	{ label: string; color: string; bgColor: string }
> = {
	gold: {
		label: "Gold",
		color: "text-yellow-700",
		bgColor: "bg-yellow-100 border-yellow-300",
	},
	silver: {
		label: "Silver",
		color: "text-gray-600",
		bgColor: "bg-gray-100 border-gray-300",
	},
	bronze: {
		label: "Bronze",
		color: "text-orange-700",
		bgColor: "bg-orange-100 border-orange-300",
	},
	strong: {
		label: "Strong",
		color: "text-green-700",
		bgColor: "bg-green-100 border-green-300",
	},
	moderate: {
		label: "Moderate",
		color: "text-blue-600",
		bgColor: "bg-blue-100 border-blue-300",
	},
	weak: {
		label: "Weak",
		color: "text-amber-600",
		bgColor: "bg-amber-100 border-amber-300",
	},
	none: {
		label: "No Evidence",
		color: "text-red-600",
		bgColor: "bg-red-50 border-red-200",
	},
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
	capability: "Capability Claim",
	performance: "Performance Claim",
	experience: "Experience Claim",
	methodology: "Methodology Claim",
	qualification: "Qualification Claim",
	commitment: "Commitment",
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function ClaimAnalyzerSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-16 w-full" />
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 w-full" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Claim Item Component
// =============================================================================

interface ClaimItemProps {
	claim: ClaimAnalysis;
	isExpanded: boolean;
	onToggle: () => void;
	onClick: () => void;
	onSuggestEvidence: () => void;
}

function ClaimItem({
	claim,
	isExpanded,
	onToggle,
	onClick,
	onSuggestEvidence,
}: ClaimItemProps) {
	const riskConfig = RISK_CONFIG[claim.riskLevel ?? "low"] ?? RISK_CONFIG.low;
	const strengthConfig = STRENGTH_CONFIG[claim.evidenceStrength] ?? STRENGTH_CONFIG.none;
	const RiskIcon = riskConfig.icon;

	return (
		<div
			className={cn(
				"border rounded-lg transition-all",
				claim.status === "resolved" && "opacity-60 bg-muted/30"
			)}
		>
			<Collapsible open={isExpanded} onOpenChange={onToggle}>
				<div className="flex items-start gap-3 p-3">
					{/* Risk Indicator */}
					<div className={cn("p-1.5 rounded shrink-0 mt-0.5", riskConfig.bgColor)}>
						<RiskIcon className={cn("h-4 w-4", riskConfig.color)} />
					</div>

					{/* Main Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<Badge variant="outline" className="text-xs">
								{claim.claimType ? (CLAIM_TYPE_LABELS[claim.claimType] || claim.claimType) : "Claim"}
							</Badge>
							{claim.sectionName && (
								<span className="text-xs text-muted-foreground">
									{claim.sectionName}
									{claim.page && ` (p. ${claim.page})`}
								</span>
							)}
							{claim.status === "resolved" && (
								<Badge variant="secondary" className="text-xs gap-1">
									<CheckCircle2 className="h-3 w-3" />
									Resolved
								</Badge>
							)}
						</div>
						<button
							type="button"
							className="text-left text-sm cursor-pointer hover:text-primary transition-colors line-clamp-2"
							onClick={onClick}
						>
							"{claim.claimText}"
						</button>
					</div>

					{/* Evidence Strength */}
					<Badge
						variant="outline"
						className={cn("text-xs border shrink-0", strengthConfig.bgColor, strengthConfig.color)}
					>
						{claim.linkedEvidenceIds.length > 0 ? (
							<>
								<LinkIcon className="h-3 w-3 mr-1" />
								{claim.linkedEvidenceIds.length}
							</>
						) : (
							strengthConfig.label
						)}
					</Badge>

					{/* Expand Toggle */}
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
					</CollapsibleTrigger>
				</div>

				{/* Expanded Content */}
				<CollapsibleContent>
					<div className="px-3 pb-3 pt-0 space-y-3 border-t ml-11">
						<div className="mt-3">
							{/* Full claim text */}
							<p className="text-sm mb-3">"{claim.claimText}"</p>

							{/* Quantification suggestion if available */}
							{claim.quantificationSuggestion && (
								<Alert className="mb-3">
									<Lightbulb className="h-4 w-4" />
									<AlertTitle className="text-sm">Quantification Suggestion</AlertTitle>
									<AlertDescription className="text-xs">
										{claim.quantificationSuggestion}
									</AlertDescription>
								</Alert>
							)}

							{/* Linked Evidence */}
							{claim.linkedEvidenceIds.length > 0 && (
								<div className="mb-3">
									<span className="text-xs font-medium text-muted-foreground">
										Linked Evidence ({claim.linkedEvidenceIds.length})
									</span>
									<div className="flex flex-wrap gap-1 mt-1">
										{claim.linkedEvidenceIds.map((id) => (
											<Badge key={id} variant="secondary" className="text-xs">
												{id.substring(0, 8)}...
											</Badge>
										))}
									</div>
								</div>
							)}

							{/* Actions */}
							<div className="flex gap-2">
								<Button size="sm" variant="outline" onClick={onClick}>
									View Details
								</Button>
								{claim.status !== "resolved" && (
									<Button size="sm" onClick={onSuggestEvidence}>
										<Award className="h-3 w-3 mr-1" />
										Suggest Evidence
									</Button>
								)}
							</div>
						</div>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ClaimAnalyzer({
	documentId,
	onClaimClick,
	onSuggestEvidence,
	className,
}: ClaimAnalyzerProps) {
	// State
	const [claims, setClaims] = useState<ClaimAnalysis[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());
	const [hasAnalyzed, setHasAnalyzed] = useState(false);

	// Calculate summary stats
	const summary = {
		total: claims.length,
		highRisk: claims.filter((c) => c.riskLevel === "high" && c.status !== "resolved").length,
		mediumRisk: claims.filter((c) => c.riskLevel === "medium" && c.status !== "resolved").length,
		lowRisk: claims.filter((c) => c.riskLevel === "low" && c.status !== "resolved").length,
		resolved: claims.filter((c) => c.status === "resolved").length,
		noEvidence: claims.filter((c) => c.evidenceStrength === "none" && c.status !== "resolved").length,
	};

	const healthScore = summary.total > 0
		? Math.round(((summary.total - summary.noEvidence) / summary.total) * 100)
		: 100;

	// Map DB evidence strength to UI evidence strength type
	const mapEvidenceStrength = (dbStrength: string | null): EvidenceStrengthTier | "none" => {
		if (!dbStrength || dbStrength === "none") return "none";
		if (dbStrength === "strong") return "gold";
		if (dbStrength === "moderate") return "silver";
		return "bronze"; // weak maps to bronze
	};

	// Analyze document
	const handleAnalyze = useCallback(async () => {
		setIsAnalyzing(true);
		setError(null);

		const result = await analyzeClaimsInDocument(documentId);
		if (result.success && result.data) {
			// Map ClaimAnalysisResult to ClaimAnalysis type
			const mappedClaims: ClaimAnalysis[] = result.data.map((r) => ({
				id: r.id,
				documentId: documentId,
				claimText: r.claimText,
				claimType: (r.claimType || "capability") as ClaimAnalysis["claimType"],
				sectionId: r.location?.sectionId || undefined,
				sectionName: r.location?.sectionName || undefined,
				page: r.location?.pageNumber || undefined,
				pageNumber: r.location?.pageNumber || undefined,
				paragraphIndex: undefined,
				hasEvidence: r.hasEvidence,
				riskLevel: (r.riskLevel || "medium") as ClaimRiskLevel,
				evidenceStrength: mapEvidenceStrength(r.evidenceStrength),
				linkedEvidenceIds: r.linkedEvidence?.map((e: { id: string }) => e.id) || [],
				suggestedEvidenceIds: r.suggestedEvidence?.map((e: { id: string }) => e.id) || [],
				suggestedEvidence: r.suggestedEvidence?.map((e: { id: string; relevance: number; reason: string }) => ({
					evidenceId: e.id,
					relevance: e.relevance,
					reason: e.reason,
				})) || [],
				quantifiedVersion: undefined,
				quantificationSuggestion: r.quantificationSuggestion || undefined,
				status: "unresolved" as ClaimAnalysis["status"],
				resolutionNotes: undefined,
				analyzedAt: new Date(),
			}));
			setClaims(mappedClaims);
			setHasAnalyzed(true);
		} else if (!result.success) {
			setError(result.error || "Failed to analyze document");
		}

		setIsAnalyzing(false);
	}, [documentId]);

	// Toggle claim expansion
	const toggleExpanded = useCallback((claimId: string) => {
		setExpandedClaims((prev) => {
			const next = new Set(prev);
			if (next.has(claimId)) {
				next.delete(claimId);
			} else {
				next.add(claimId);
			}
			return next;
		});
	}, []);

	// Handle claim click
	const handleClaimClick = useCallback(
		(claim: ClaimAnalysis) => {
			onClaimClick?.(claim);
		},
		[onClaimClick]
	);

	// Handle suggest evidence
	const handleSuggestEvidence = useCallback(
		(claim: ClaimAnalysis) => {
			onSuggestEvidence?.(claim);
		},
		[onSuggestEvidence]
	);

	// Group claims by risk level
	const groupedClaims = {
		high: claims.filter((c) => c.riskLevel === "high" && c.status !== "resolved"),
		medium: claims.filter((c) => c.riskLevel === "medium" && c.status !== "resolved"),
		low: claims.filter((c) => c.riskLevel === "low" && c.status !== "resolved"),
		resolved: claims.filter((c) => c.status === "resolved"),
	};

	if (isLoading) {
		return <ClaimAnalyzerSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<FileSearch className="h-5 w-5" />
						Claim Analyzer
						{hasAnalyzed && claims.length > 0 && (
							<Badge variant="secondary">{claims.length} claims</Badge>
						)}
					</CardTitle>
					<Button
						onClick={handleAnalyze}
						disabled={isAnalyzing}
						variant={hasAnalyzed ? "outline" : "primary"}
					>
						{isAnalyzing ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : hasAnalyzed ? (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Re-analyze
							</>
						) : (
							<>
								<FileSearch className="h-4 w-4 mr-2" />
								Analyze
							</>
						)}
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

				{/* Pre-analysis state */}
				{!hasAnalyzed && !isAnalyzing && !error && (
					<div className="text-center py-8">
						<FileSearch className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">Analyze Document Claims</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Scan this document to identify claims that need evidence support
						</p>
						<Button onClick={handleAnalyze} className="mt-4">
							<FileSearch className="h-4 w-4 mr-2" />
							Start Analysis
						</Button>
					</div>
				)}

				{/* Summary */}
				{hasAnalyzed && claims.length > 0 && (
					<div className="p-4 bg-muted/50 rounded-lg space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Evidence Health Score</span>
							<Badge
								variant="outline"
								className={cn(
									healthScore >= 70
										? "bg-green-100 text-green-700 border-green-300"
										: healthScore >= 40
											? "bg-amber-100 text-amber-700 border-amber-300"
											: "bg-red-100 text-red-700 border-red-300"
								)}
							>
								{healthScore}%
							</Badge>
						</div>
						<Progress value={healthScore} className="h-2" />
						<div className="grid grid-cols-4 gap-2 text-center">
							<div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
								<div className="text-lg font-bold text-red-600">{summary.highRisk}</div>
								<div className="text-xs text-muted-foreground">High Risk</div>
							</div>
							<div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
								<div className="text-lg font-bold text-amber-600">{summary.mediumRisk}</div>
								<div className="text-xs text-muted-foreground">Medium</div>
							</div>
							<div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
								<div className="text-lg font-bold text-blue-600">{summary.lowRisk}</div>
								<div className="text-xs text-muted-foreground">Low Risk</div>
							</div>
							<div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
								<div className="text-lg font-bold text-green-600">{summary.resolved}</div>
								<div className="text-xs text-muted-foreground">Resolved</div>
							</div>
						</div>
					</div>
				)}

				{/* Claims List */}
				{hasAnalyzed && claims.length > 0 && (
					<div className="space-y-4">
						{/* High Risk Claims */}
						{groupedClaims.high.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium flex items-center gap-2 text-red-600">
									<AlertTriangle className="h-4 w-4" />
									High Risk Claims ({groupedClaims.high.length})
								</h4>
								{groupedClaims.high.map((claim) => (
									<ClaimItem
										key={claim.id}
										claim={claim}
										isExpanded={expandedClaims.has(claim.id)}
										onToggle={() => toggleExpanded(claim.id)}
										onClick={() => handleClaimClick(claim)}
										onSuggestEvidence={() => handleSuggestEvidence(claim)}
									/>
								))}
							</div>
						)}

						{/* Medium Risk Claims */}
						{groupedClaims.medium.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
									<AlertCircle className="h-4 w-4" />
									Medium Risk Claims ({groupedClaims.medium.length})
								</h4>
								{groupedClaims.medium.map((claim) => (
									<ClaimItem
										key={claim.id}
										claim={claim}
										isExpanded={expandedClaims.has(claim.id)}
										onToggle={() => toggleExpanded(claim.id)}
										onClick={() => handleClaimClick(claim)}
										onSuggestEvidence={() => handleSuggestEvidence(claim)}
									/>
								))}
							</div>
						)}

						{/* Low Risk Claims */}
						{groupedClaims.low.length > 0 && (
							<Collapsible>
								<CollapsibleTrigger asChild>
									<Button variant="ghost" className="w-full justify-start gap-2 text-blue-600">
										<ChevronRight className="h-4 w-4" />
										<Info className="h-4 w-4" />
										Low Risk Claims ({groupedClaims.low.length})
									</Button>
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-2 mt-2">
									{groupedClaims.low.map((claim) => (
										<ClaimItem
											key={claim.id}
											claim={claim}
											isExpanded={expandedClaims.has(claim.id)}
											onToggle={() => toggleExpanded(claim.id)}
											onClick={() => handleClaimClick(claim)}
											onSuggestEvidence={() => handleSuggestEvidence(claim)}
										/>
									))}
								</CollapsibleContent>
							</Collapsible>
						)}

						{/* Resolved Claims */}
						{groupedClaims.resolved.length > 0 && (
							<Collapsible>
								<CollapsibleTrigger asChild>
									<Button variant="ghost" className="w-full justify-start gap-2 text-green-600">
										<ChevronRight className="h-4 w-4" />
										<CheckCircle2 className="h-4 w-4" />
										Resolved Claims ({groupedClaims.resolved.length})
									</Button>
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-2 mt-2">
									{groupedClaims.resolved.map((claim) => (
										<ClaimItem
											key={claim.id}
											claim={claim}
											isExpanded={expandedClaims.has(claim.id)}
											onToggle={() => toggleExpanded(claim.id)}
											onClick={() => handleClaimClick(claim)}
											onSuggestEvidence={() => handleSuggestEvidence(claim)}
										/>
									))}
								</CollapsibleContent>
							</Collapsible>
						)}
					</div>
				)}

				{/* No Claims Found */}
				{hasAnalyzed && claims.length === 0 && (
					<div className="text-center py-8">
						<CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
						<h3 className="mt-4 font-medium">No Claims Found</h3>
						<p className="text-sm text-muted-foreground mt-1">
							This document does not appear to contain claims that need evidence support
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default ClaimAnalyzer;
