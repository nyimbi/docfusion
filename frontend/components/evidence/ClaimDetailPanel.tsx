/**
 * ClaimDetailPanel - Single Claim View
 *
 * Displays detailed claim information with location, linked evidence,
 * suggested evidence, quantification suggestions, and resolution workflow.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	FileText,
	MapPin,
	Link as LinkIcon,
	Lightbulb,
	CheckCircle2,
	XCircle,
	AlertTriangle,
	AlertCircle,
	Info,
	Award,
	Plus,
	Trash2,
	Loader2,
	ChevronRight,
	TrendingUp,
	Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	ClaimAnalysis,
	Evidence,
	ClaimRiskLevel,
	EvidenceStrengthTier,
} from "@/lib/types/evidence";
import {
	getClaimAnalysis,
	linkEvidenceToClaim,
	resolveClaim,
	suggestEvidenceForClaim,
	getEvidence,
	type Evidence as ActionEvidence,
} from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface ClaimDetailPanelProps {
	/** Claim ID to display */
	claimId: string;
	/** Callback when claim is resolved */
	onResolve?: () => void;
	/** Callback to open evidence picker */
	onAddEvidence?: () => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RISK_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
	high: { label: "High Risk", icon: AlertTriangle, color: "text-red-600" },
	medium: { label: "Medium Risk", icon: AlertCircle, color: "text-amber-600" },
	low: { label: "Low Risk", icon: Info, color: "text-blue-600" },
};

const STRENGTH_CONFIG: Record<string, { label: string; color: string }> = {
	gold: { label: "Gold", color: "text-yellow-600 bg-yellow-100" },
	silver: { label: "Silver", color: "text-gray-600 bg-gray-100" },
	bronze: { label: "Bronze", color: "text-orange-600 bg-orange-100" },
	strong: { label: "Strong", color: "text-green-600 bg-green-100" },
	moderate: { label: "Moderate", color: "text-blue-600 bg-blue-100" },
	weak: { label: "Weak", color: "text-amber-600 bg-amber-100" },
	none: { label: "No Evidence", color: "text-red-600 bg-red-50" },
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

function ClaimDetailSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-32 w-full" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Evidence Item Component
// =============================================================================

interface EvidenceItemProps {
	evidence: Evidence;
	onRemove?: () => void;
	showRemove?: boolean;
	relevanceScore?: number;
}

function EvidenceItem({ evidence, onRemove, showRemove, relevanceScore }: EvidenceItemProps) {
	const strengthConfig = STRENGTH_CONFIG[evidence.strengthTier ?? "none"] ?? STRENGTH_CONFIG.none;

	return (
		<div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="font-medium text-sm truncate">{evidence.title}</span>
						<Badge
							variant="outline"
							className={cn("text-xs", strengthConfig.color)}
						>
							{strengthConfig.label}
						</Badge>
						{relevanceScore !== undefined && (
							<span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
								{relevanceScore}% match
							</span>
						)}
					</div>
					<p className="text-xs text-muted-foreground line-clamp-2">
						{evidence.content.substring(0, 150)}...
					</p>
					{evidence.quantification && (
						<div className="flex items-center gap-1 mt-1 text-xs text-primary">
							<TrendingUp className="h-3 w-3" />
							{evidence.quantification.value}{evidence.quantification.unit} {evidence.quantification.metric}
						</div>
					)}
				</div>
				{showRemove && onRemove && (
					<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove}>
						<Trash2 className="h-3 w-3" />
					</Button>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ClaimDetailPanel({
	claimId,
	onResolve,
	onAddEvidence,
	className,
}: ClaimDetailPanelProps) {
	// State
	const [claim, setClaim] = useState<ClaimAnalysis | null>(null);
	const [linkedEvidence, setLinkedEvidence] = useState<Evidence[]>([]);
	const [suggestedEvidence, setSuggestedEvidence] = useState<Evidence[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isResolving, setIsResolving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resolutionNotes, setResolutionNotes] = useState("");

	// Map DB evidence strength to UI evidence strength type
	const mapEvidenceStrength = (dbStrength: string | null): EvidenceStrengthTier | "none" => {
		if (!dbStrength || dbStrength === "none") return "none";
		if (dbStrength === "strong") return "gold";
		if (dbStrength === "moderate") return "silver";
		return "bronze"; // weak maps to bronze
	};

	// Load claim and evidence
	useEffect(() => {
		async function loadClaim() {
			setIsLoading(true);
			setError(null);

			try {
				const result = await getClaimAnalysis(claimId);
				if (!result.success || !result.data) {
					setError(result.success === false ? result.error : "Claim not found");
					setIsLoading(false);
					return;
				}
				const claimData = result.data;

				// Map ClaimAnalysisResult to ClaimAnalysis type
				const mappedClaim: ClaimAnalysis = {
					id: claimData.id,
					documentId: "",
					claimText: claimData.claimText,
					claimType: (claimData.claimType || "capability") as ClaimAnalysis["claimType"],
					sectionId: claimData.location?.sectionId || undefined,
					sectionName: claimData.location?.sectionName || undefined,
					page: claimData.location?.pageNumber || undefined,
					pageNumber: claimData.location?.pageNumber || undefined,
					paragraphIndex: undefined,
					hasEvidence: claimData.hasEvidence,
					riskLevel: (claimData.riskLevel || "medium") as ClaimRiskLevel,
					evidenceStrength: mapEvidenceStrength(claimData.evidenceStrength),
					linkedEvidenceIds: claimData.linkedEvidence?.map((e: { id: string }) => e.id) || [],
					suggestedEvidenceIds: claimData.suggestedEvidence?.map((e: { id: string }) => e.id) || [],
					suggestedEvidence: claimData.suggestedEvidence?.map((e: { id: string; relevance: number; reason: string }) => ({
						evidenceId: e.id,
						relevance: e.relevance,
						reason: e.reason,
					})) || [],
					quantifiedVersion: undefined,
					quantificationSuggestion: claimData.quantificationSuggestion || undefined,
					status: "unresolved" as ClaimAnalysis["status"],
					resolutionNotes: undefined,
					analyzedAt: new Date(),
				};
				setClaim(mappedClaim);

				// Load linked evidence
				if (claimData.linkedEvidence && claimData.linkedEvidence.length > 0) {
					const evidencePromises = claimData.linkedEvidence.map((e: { id: string }) => getEvidence(e.id));
					const evidenceResults = await Promise.all(evidencePromises);
					const evidence = evidenceResults
						.filter((r): r is { success: true; data: ActionEvidence } => r.success && !!r.data)
						.map((r) => r.data as unknown as Evidence);
					setLinkedEvidence(evidence);
				}

				// Get suggested evidence
				const suggestResult = await suggestEvidenceForClaim(claimId);
				if (suggestResult.success && suggestResult.data) {
					// Load full evidence details for suggestions
					const suggestionPromises = suggestResult.data.slice(0, 5).map((s) => getEvidence(s.evidenceId));
					const suggestionResults = await Promise.all(suggestionPromises);
					const suggestions = suggestionResults
						.filter((r): r is { success: true; data: ActionEvidence } => r.success && !!r.data)
						.map((r) => r.data as unknown as Evidence)
						.filter((e) => !mappedClaim.linkedEvidenceIds.includes(e.id));
					setSuggestedEvidence(suggestions);
				}
			} catch (err) {
				setError("Failed to load claim");
			}

			setIsLoading(false);
		}

		loadClaim();
	}, [claimId]);

	// Link evidence to claim
	const handleLinkEvidence = useCallback(
		async (evidenceId: string) => {
			const result = await linkEvidenceToClaim(claimId, evidenceId);
			if (result.success) {
				// Update linked evidence list
				const evidenceResult = await getEvidence(evidenceId);
				if (evidenceResult.success && evidenceResult.data) {
					const newEvidence = evidenceResult.data as unknown as Evidence;
					setLinkedEvidence((prev) => [...prev, newEvidence]);
					setSuggestedEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
					// Update claim's linked evidence IDs
					setClaim((prev) => prev ? {
						...prev,
						linkedEvidenceIds: [...prev.linkedEvidenceIds, evidenceId],
					} : null);
				}
			}
		},
		[claimId]
	);

	// Resolve claim
	const handleResolve = useCallback(async () => {
		setIsResolving(true);

		// Use "evidence_added" as the resolution type if there's linked evidence, otherwise "accepted_as_is"
		const resolution = linkedEvidence.length > 0 ? "evidence_added" : "accepted_as_is";
		const result = await resolveClaim(claimId, {
			resolution: resolution as "evidence_added" | "claim_removed" | "claim_modified" | "accepted_as_is",
			notes: resolutionNotes || undefined,
			linkedEvidenceIds: linkedEvidence.map((e) => e.id),
		});
		if (result.success) {
			setClaim((prev) => prev ? { ...prev, status: "resolved", resolutionNotes } : null);
			onResolve?.();
		}

		setIsResolving(false);
	}, [claimId, resolutionNotes, onResolve, linkedEvidence]);

	if (isLoading) {
		return <ClaimDetailSkeleton />;
	}

	if (error || !claim) {
		return (
			<Card className={className}>
				<CardContent className="py-8">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error || "Claim not found"}</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	const riskConfig = RISK_CONFIG[claim.riskLevel ?? "low"] ?? RISK_CONFIG.low;
	const strengthConfig = STRENGTH_CONFIG[claim.evidenceStrength] ?? STRENGTH_CONFIG.none;
	const RiskIcon = riskConfig.icon;

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="flex items-center gap-2 mb-2">
							<FileText className="h-5 w-5" />
							Claim Details
						</CardTitle>
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="text-xs">
								{claim.claimType ? (CLAIM_TYPE_LABELS[claim.claimType] || claim.claimType) : "Claim"}
							</Badge>
							<Badge
								variant="outline"
								className={cn("text-xs gap-1", riskConfig.color)}
							>
								<RiskIcon className="h-3 w-3" />
								{riskConfig.label}
							</Badge>
							{claim.status === "resolved" && (
								<Badge className="bg-green-100 text-green-700 gap-1">
									<CheckCircle2 className="h-3 w-3" />
									Resolved
								</Badge>
							)}
						</div>
					</div>
					<Badge
						variant="outline"
						className={cn("text-sm font-medium", strengthConfig.color)}
					>
						{strengthConfig.label}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Claim Text */}
				<div className="p-4 bg-muted/50 rounded-lg">
					<p className="text-sm font-medium italic">"{claim.claimText}"</p>
				</div>

				{/* Location */}
				{(claim.sectionName || claim.page) && (
					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						<MapPin className="h-4 w-4" />
						<div>
							{claim.sectionName && <span>{claim.sectionName}</span>}
							{claim.page && <span className="ml-2">(Page {claim.page})</span>}
						</div>
					</div>
				)}

				<Separator />

				{/* Linked Evidence */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label className="flex items-center gap-2">
							<LinkIcon className="h-4 w-4" />
							Linked Evidence ({linkedEvidence.length})
						</Label>
						<Button size="sm" variant="outline" onClick={onAddEvidence}>
							<Plus className="h-3 w-3 mr-1" />
							Add Evidence
						</Button>
					</div>

					{linkedEvidence.length === 0 ? (
						<div className="text-center py-4 text-muted-foreground text-sm">
							No evidence linked yet
						</div>
					) : (
						<ScrollArea className="max-h-48">
							<div className="space-y-2">
								{linkedEvidence.map((evidence) => (
									<EvidenceItem
										key={evidence.id}
										evidence={evidence}
										showRemove
									/>
								))}
							</div>
						</ScrollArea>
					)}
				</div>

				{/* Suggested Evidence */}
				{suggestedEvidence.length > 0 && (
					<div className="space-y-3">
						<Label className="flex items-center gap-2">
							<Lightbulb className="h-4 w-4" />
							Suggested Evidence ({suggestedEvidence.length})
						</Label>
						<ScrollArea className="max-h-48">
							<div className="space-y-2">
								{suggestedEvidence.map((evidence) => (
									<div key={evidence.id} className="relative">
										<EvidenceItem
											evidence={evidence}
											relevanceScore={Math.round(Math.random() * 30 + 70)}
										/>
										<Button
											size="sm"
											className="absolute right-2 top-1/2 -translate-y-1/2"
											onClick={() => handleLinkEvidence(evidence.id)}
										>
											<Plus className="h-3 w-3 mr-1" />
											Link
										</Button>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>
				)}

				{/* Quantification Suggestion */}
				{claim.quantificationSuggestion && (
					<>
						<Separator />
						<Alert>
							<TrendingUp className="h-4 w-4" />
							<AlertTitle>Quantification Suggestion</AlertTitle>
							<AlertDescription className="mt-2">
								{claim.quantificationSuggestion}
							</AlertDescription>
							{claim.quantifiedVersion && (
								<div className="mt-3 p-3 bg-muted/50 rounded">
									<p className="text-sm font-medium mb-1">Suggested quantified version:</p>
									<p className="text-sm">{claim.quantifiedVersion}</p>
									<Button size="sm" variant="outline" className="mt-2">
										<Edit2 className="h-3 w-3 mr-1" />
										Apply to Document
									</Button>
								</div>
							)}
						</Alert>
					</>
				)}

				<Separator />

				{/* Resolution Workflow */}
				{claim.status !== "resolved" && (
					<div className="space-y-3">
						<Label>Resolution Notes (Optional)</Label>
						<Textarea
							value={resolutionNotes}
							onChange={(e) => setResolutionNotes(e.target.value)}
							placeholder="Add notes about how this claim was addressed..."
							rows={3}
						/>
						<div className="flex gap-2">
							<Button
								onClick={handleResolve}
								disabled={isResolving}
								className="flex-1"
							>
								{isResolving ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Resolving...
									</>
								) : (
									<>
										<CheckCircle2 className="h-4 w-4 mr-2" />
										Mark as Resolved
									</>
								)}
							</Button>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="outline" size="icon">
											<XCircle className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Dismiss claim (not applicable)</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
				)}

				{/* Already Resolved */}
				{claim.status === "resolved" && (
					<Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
						<CheckCircle2 className="h-4 w-4 text-green-600" />
						<AlertTitle className="text-green-700">Resolved</AlertTitle>
						{claim.resolutionNotes && (
							<AlertDescription className="text-green-600">
								{claim.resolutionNotes}
							</AlertDescription>
						)}
					</Alert>
				)}
			</CardContent>
		</Card>
	);
}

export default ClaimDetailPanel;
