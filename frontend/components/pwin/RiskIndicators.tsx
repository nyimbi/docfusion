"use client";

/**
 * Risk Indicators Component
 *
 * Displays PWin-related risks and their mitigation actions. Highlights
 * score gaps, declining trends, competitive threats, timeline risks,
 * and resource constraints that may impact win probability.
 *
 * Features:
 * - Risk severity categorization (high, medium, low)
 * - Risk type indicators
 * - Mitigation action lists
 * - Related factor linking
 * - Risk trend tracking
 *
 * @example
 * ```tsx
 * <RiskIndicators
 *   opportunityId="opp-123"
 *   onRiskAction={(risk) => openRiskMitigationDialog(risk)}
 *   onFactorSelect={(factorId) => scrollToFactor(factorId)}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
	AlertTriangle,
	TrendingDown,
	Shield,
	Clock,
	Users,
	Swords,
	Loader2,
	AlertCircle,
	RefreshCw,
	ChevronDown,
	ChevronRight,
	Target,
	CheckCircle2,
	XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { identifyPwinRisks } from "@/lib/actions/pwin";
import type { PwinRisk, Priority } from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface RiskIndicatorsProps {
	opportunityId: string;
	initialData?: PwinRisk[];
	onRiskAction?: (risk: PwinRisk) => void;
	onFactorSelect?: (factorId: string) => void;
	className?: string;
}

type RiskType = "score_gap" | "declining_trend" | "competitive_threat" | "timeline" | "resource";

interface RiskWithMitigation extends PwinRisk {
	mitigationsCompleted?: Set<number>;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG: Record<Priority, {
	label: string;
	color: string;
	bgColor: string;
	borderColor: string;
}> = {
	high: {
		label: "High",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		borderColor: "border-red-500/50",
	},
	medium: {
		label: "Medium",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
		borderColor: "border-amber-500/50",
	},
	low: {
		label: "Low",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		borderColor: "border-blue-500/50",
	},
};

const RISK_TYPE_CONFIG: Record<RiskType, {
	label: string;
	icon: React.ElementType;
	description: string;
}> = {
	score_gap: {
		label: "Score Gap",
		icon: Target,
		description: "Factor scores significantly below target",
	},
	declining_trend: {
		label: "Declining Trend",
		icon: TrendingDown,
		description: "PWin score decreasing over time",
	},
	competitive_threat: {
		label: "Competitive Threat",
		icon: Swords,
		description: "Strong competitor positioning",
	},
	timeline: {
		label: "Timeline Risk",
		icon: Clock,
		description: "Deadline approaching with low PWin",
	},
	resource: {
		label: "Resource Risk",
		icon: Users,
		description: "Resource constraints affecting pursuit",
	},
};

// ============================================================================
// Component
// ============================================================================

export function RiskIndicators({
	opportunityId,
	initialData,
	onRiskAction,
	onFactorSelect,
	className,
}: RiskIndicatorsProps) {
	// State
	const [risks, setRisks] = useState<RiskWithMitigation[]>(
		(initialData ?? []).map(r => ({ ...r, mitigationsCompleted: new Set() }))
	);
	const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
	const [isLoading, setIsLoading] = useState(!initialData);
	const [error, setError] = useState<string | null>(null);

	// Load risks
	const loadRisks = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await identifyPwinRisks(opportunityId);

		if (result.success) {
			setRisks(result.data.map(r => ({ ...r, mitigationsCompleted: new Set() })));
			// Auto-expand high severity risks
			const highRisks = result.data
				.filter(r => r.severity === "high")
				.map(r => r.riskId);
			setExpandedRisks(new Set(highRisks));
		} else {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityId]);

	// Load on mount if no initial data
	useEffect(() => {
		if (!initialData) {
			loadRisks();
		}
	}, [initialData, loadRisks]);

	// Toggle risk expansion
	const toggleRiskExpansion = useCallback((riskId: string) => {
		setExpandedRisks(prev => {
			const newSet = new Set(prev);
			if (newSet.has(riskId)) {
				newSet.delete(riskId);
			} else {
				newSet.add(riskId);
			}
			return newSet;
		});
	}, []);

	// Toggle mitigation completion
	const toggleMitigation = useCallback((riskId: string, mitigationIndex: number) => {
		setRisks(prev =>
			prev.map(risk => {
				if (risk.riskId !== riskId) return risk;
				const completed = new Set(risk.mitigationsCompleted);
				if (completed.has(mitigationIndex)) {
					completed.delete(mitigationIndex);
				} else {
					completed.add(mitigationIndex);
				}
				return { ...risk, mitigationsCompleted: completed };
			})
		);
	}, []);

	// Summary stats
	const stats = useMemo(() => {
		const total = risks.length;
		const high = risks.filter(r => r.severity === "high").length;
		const medium = risks.filter(r => r.severity === "medium").length;
		const low = risks.filter(r => r.severity === "low").length;
		return { total, high, medium, low };
	}, [risks]);

	// Group risks by type
	const risksByType = useMemo(() => {
		const grouped = new Map<RiskType, RiskWithMitigation[]>();

		for (const risk of risks) {
			const existing = grouped.get(risk.riskType) ?? [];
			existing.push(risk);
			grouped.set(risk.riskType, existing);
		}

		return grouped;
	}, [risks]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-primary" />
						Risk Indicators
					</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-primary" />
						Risk Indicators
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<AlertCircle className="h-10 w-10 text-destructive mb-3" />
					<p className="text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" size="sm" onClick={loadRisks}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	// No risks state
	if (risks.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5 text-green-600" />
						Risk Indicators
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<CheckCircle2 className="h-10 w-10 text-green-600 mb-3" />
					<p className="text-lg font-medium text-green-600 mb-1">No Risks Identified</p>
					<p className="text-sm text-muted-foreground text-center">
						All factor scores are within acceptable ranges and no concerning trends detected.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<AlertTriangle className={cn(
								"h-5 w-5",
								stats.high > 0 ? "text-red-600" : "text-amber-600"
							)} />
							Risk Indicators
							<Badge
								variant={stats.high > 0 ? "destructive" : "secondary"}
								className="ml-2"
							>
								{stats.total}
							</Badge>
						</CardTitle>
						<CardDescription className="mt-1">
							Factors that may negatively impact PWin
						</CardDescription>
					</div>

					<Button variant="outline" size="icon" onClick={loadRisks}>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Summary by Severity */}
				<div className="grid grid-cols-3 gap-4 pb-4 border-b">
					<div className="text-center">
						<div className="text-2xl font-bold text-red-600">{stats.high}</div>
						<div className="text-xs text-muted-foreground">High Severity</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-amber-600">{stats.medium}</div>
						<div className="text-xs text-muted-foreground">Medium Severity</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-blue-600">{stats.low}</div>
						<div className="text-xs text-muted-foreground">Low Severity</div>
					</div>
				</div>

				{/* Risks List */}
				<div className="space-y-4">
					{Array.from(risksByType.entries()).map(([type, typeRisks]) => {
						const typeConfig = RISK_TYPE_CONFIG[type];
						const TypeIcon = typeConfig.icon;

						return (
							<div key={type} className="space-y-2">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<TypeIcon className="h-4 w-4" />
									<span>{typeConfig.label}</span>
									<Badge variant="outline" className="text-xs">
										{typeRisks.length}
									</Badge>
								</div>

								{typeRisks.map((risk) => (
									<RiskCard
										key={risk.riskId}
										risk={risk}
										isExpanded={expandedRisks.has(risk.riskId)}
										onToggleExpansion={() => toggleRiskExpansion(risk.riskId)}
										onToggleMitigation={(idx) => toggleMitigation(risk.riskId, idx)}
										onAction={onRiskAction}
										onFactorSelect={onFactorSelect}
									/>
								))}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Risk Card Sub-Component
// ============================================================================

interface RiskCardProps {
	risk: RiskWithMitigation;
	isExpanded: boolean;
	onToggleExpansion: () => void;
	onToggleMitigation: (index: number) => void;
	onAction?: (risk: PwinRisk) => void;
	onFactorSelect?: (factorId: string) => void;
}

function RiskCard({
	risk,
	isExpanded,
	onToggleExpansion,
	onToggleMitigation,
	onAction,
	onFactorSelect,
}: RiskCardProps) {
	const severityConfig = SEVERITY_CONFIG[risk.severity];
	const typeConfig = RISK_TYPE_CONFIG[risk.riskType];
	const TypeIcon = typeConfig.icon;

	const completedCount = risk.mitigationsCompleted?.size ?? 0;
	const totalMitigations = risk.mitigationActions.length;
	const allCompleted = completedCount === totalMitigations && totalMitigations > 0;

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggleExpansion}>
			<div
				className={cn(
					"rounded-lg border transition-colors",
					severityConfig.borderColor,
					severityConfig.bgColor,
					allCompleted && "opacity-60"
				)}
			>
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="w-full flex items-center gap-3 p-4 text-left"
					>
						{/* Severity Indicator */}
						<div className={cn(
							"w-2 h-2 rounded-full flex-shrink-0",
							risk.severity === "high" && "bg-red-500",
							risk.severity === "medium" && "bg-amber-500",
							risk.severity === "low" && "bg-blue-500"
						)} />

						{/* Risk Icon */}
						<TypeIcon className={cn("h-5 w-5 flex-shrink-0", severityConfig.color)} />

						{/* Description */}
						<div className="flex-1 min-w-0">
							<p className={cn(
								"font-medium",
								allCompleted && "line-through text-muted-foreground"
							)}>
								{risk.description}
							</p>
							{risk.relatedFactorId && (
								<Button
									variant="link"
									size="sm"
									className="h-auto p-0 text-xs"
									onClick={(e) => {
										e.stopPropagation();
										onFactorSelect?.(risk.relatedFactorId!);
									}}
								>
									<Target className="h-3 w-3 mr-1" />
									View Related Factor
								</Button>
							)}
						</div>

						{/* Mitigation Progress */}
						{totalMitigations > 0 && (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{completedCount}/{totalMitigations}</span>
								{allCompleted ? (
									<CheckCircle2 className="h-4 w-4 text-green-600" />
								) : (
									isExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)
								)}
							</div>
						)}
					</button>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Mitigation Actions</span>
							<Badge variant="outline" className={severityConfig.color}>
								{severityConfig.label} Severity
							</Badge>
						</div>

						{risk.mitigationActions.length > 0 ? (
							<ul className="space-y-2">
								{risk.mitigationActions.map((action, idx) => {
									const isCompleted = risk.mitigationsCompleted?.has(idx);
									return (
										<li key={idx} className="flex items-start gap-2">
											<Checkbox
												checked={isCompleted}
												onCheckedChange={() => onToggleMitigation(idx)}
												className="mt-0.5"
											/>
											<span className={cn(
												"text-sm",
												isCompleted && "line-through text-muted-foreground"
											)}>
												{action}
											</span>
										</li>
									);
								})}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground italic">
								No specific mitigation actions defined
							</p>
						)}

						{onAction && (
							<Button
								variant="outline"
								size="sm"
								className="w-full mt-2"
								onClick={() => onAction(risk)}
							>
								Create Action Plan
							</Button>
						)}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

export default RiskIndicators;
