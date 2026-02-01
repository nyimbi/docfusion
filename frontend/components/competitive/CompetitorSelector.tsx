"use client";

/**
 * Competitor Selector Component
 *
 * Select competitors for an opportunity with AI-suggested matches,
 * manual add option, role assignment, and bid likelihood.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
	Search,
	Building2,
	Sparkles,
	Plus,
	X,
	Check,
	Loader2,
	Target,
	Shield,
	Crown,
	Users,
	TrendingUp,
	Info,
	RefreshCw,
} from "lucide-react";
import {
	identifyLikelyCompetitors,
	listCompetitors,
	addCompetitorToOpportunity,
	listCompetitorsForOpportunity,
} from "@/lib/actions/competitive";
import type {
	Competitor,
	CompetitorMatch,
	CompetitorSelectorProps,
	CompetitorRole,
	BidLikelihood,
} from "@/lib/types/competitive";

interface ExtendedCompetitorSelectorProps extends CompetitorSelectorProps {
	className?: string;
}

/**
 * Role configuration
 */
const roleConfig: Record<CompetitorRole, { label: string; icon: React.ReactNode; color: string }> = {
	prime: { label: "Prime", icon: <Crown className="h-4 w-4" />, color: "text-purple-600" },
	sub: { label: "Sub", icon: <Users className="h-4 w-4" />, color: "text-blue-600" },
	incumbent: { label: "Incumbent", icon: <Shield className="h-4 w-4" />, color: "text-amber-600" },
};

/**
 * Likelihood configuration
 */
const likelihoodConfig: Record<BidLikelihood, { label: string; color: string }> = {
	certain: { label: "Certain", color: "bg-red-100 text-red-800" },
	likely: { label: "Likely", color: "bg-orange-100 text-orange-800" },
	possible: { label: "Possible", color: "bg-yellow-100 text-yellow-800" },
	unlikely: { label: "Unlikely", color: "bg-green-100 text-green-800" },
};

export function CompetitorSelector({
	opportunityId,
	selectedIds: initialSelectedIds,
	onSelect,
	showSuggestions = true,
	className,
}: ExtendedCompetitorSelectorProps) {
	// State
	const [allCompetitors, setAllCompetitors] = useState<Competitor[]>([]);
	const [suggestedMatches, setSuggestedMatches] = useState<CompetitorMatch[]>([]);
	const [selectedCompetitors, setSelectedCompetitors] = useState<Map<string, {
		competitor: Competitor;
		role: CompetitorRole;
		likelihood: BidLikelihood;
	}>>(new Map());
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

	// New competitor state for dialog
	const [newCompetitorId, setNewCompetitorId] = useState("");
	const [newRole, setNewRole] = useState<CompetitorRole>("prime");
	const [newLikelihood, setNewLikelihood] = useState<BidLikelihood>("likely");

	// Load initial data
	useEffect(() => {
		async function loadData() {
			const [competitorsResult, existingResult] = await Promise.all([
				listCompetitors(),
				listCompetitorsForOpportunity(opportunityId),
			]);

			if (competitorsResult.success) {
				setAllCompetitors(competitorsResult.data);
			}

			if (existingResult.success) {
				const selected = new Map<string, any>();
				for (const link of existingResult.data) {
					const competitor = competitorsResult.success
						? competitorsResult.data.find((c) => c.id === link.competitorId)
						: null;
					if (competitor) {
						selected.set(competitor.id, {
							competitor,
							role: link.role ?? "prime",
							likelihood: link.likelihoodToBid ?? "likely",
						});
					}
				}
				setSelectedCompetitors(selected);
			}

			setIsLoading(false);
		}
		loadData();
	}, [opportunityId]);

	// Load AI suggestions
	useEffect(() => {
		if (!showSuggestions || isLoading) return;

		async function loadSuggestions() {
			setIsLoadingSuggestions(true);
			const result = await identifyLikelyCompetitors(opportunityId);
			if (result.success) {
				setSuggestedMatches(result.data);
			}
			setIsLoadingSuggestions(false);
		}
		loadSuggestions();
	}, [opportunityId, showSuggestions, isLoading]);

	/**
	 * Refresh AI suggestions
	 */
	const handleRefreshSuggestions = useCallback(async () => {
		setIsLoadingSuggestions(true);
		setError(null);

		const result = await identifyLikelyCompetitors(opportunityId);
		if (result.success) {
			setSuggestedMatches(result.data);
		} else {
			setError(result.error);
		}
		setIsLoadingSuggestions(false);
	}, [opportunityId]);

	/**
	 * Add competitor from suggestions
	 */
	const handleAddFromSuggestion = useCallback(
		async (match: CompetitorMatch) => {
			if (selectedCompetitors.has(match.competitor.id)) return;

			startTransition(async () => {
				const result = await addCompetitorToOpportunity({
					competitorId: match.competitor.id,
					opportunityId,
					role: match.role,
					likelihoodToBid: match.likelihoodScore >= 75 ? "certain"
						: match.likelihoodScore >= 50 ? "likely"
						: match.likelihoodScore >= 25 ? "possible"
						: "unlikely",
				});

				if (result.success) {
					const updated = new Map(selectedCompetitors);
					updated.set(match.competitor.id, {
						competitor: match.competitor,
						role: match.role,
						likelihood: match.likelihoodScore >= 75 ? "certain"
							: match.likelihoodScore >= 50 ? "likely"
							: match.likelihoodScore >= 25 ? "possible"
							: "unlikely",
					});
					setSelectedCompetitors(updated);
					onSelect?.(Array.from(updated.values()).map((v) => v.competitor));
				} else {
					setError(result.error);
				}
			});
		},
		[opportunityId, selectedCompetitors, onSelect]
	);

	/**
	 * Add competitor manually
	 */
	const handleAddManual = useCallback(async () => {
		if (!newCompetitorId) return;

		const competitor = allCompetitors.find((c) => c.id === newCompetitorId);
		if (!competitor || selectedCompetitors.has(newCompetitorId)) return;

		startTransition(async () => {
			const result = await addCompetitorToOpportunity({
				competitorId: newCompetitorId,
				opportunityId,
				role: newRole,
				likelihoodToBid: newLikelihood,
			});

			if (result.success) {
				const updated = new Map(selectedCompetitors);
				updated.set(newCompetitorId, {
					competitor,
					role: newRole,
					likelihood: newLikelihood,
				});
				setSelectedCompetitors(updated);
				onSelect?.(Array.from(updated.values()).map((v) => v.competitor));
				setIsAddDialogOpen(false);
				setNewCompetitorId("");
				setNewRole("prime");
				setNewLikelihood("likely");
			} else {
				setError(result.error);
			}
		});
	}, [newCompetitorId, newRole, newLikelihood, opportunityId, allCompetitors, selectedCompetitors, onSelect]);

	/**
	 * Remove competitor
	 */
	const handleRemove = useCallback(
		(competitorId: string) => {
			const updated = new Map(selectedCompetitors);
			updated.delete(competitorId);
			setSelectedCompetitors(updated);
			onSelect?.(Array.from(updated.values()).map((v) => v.competitor));
		},
		[selectedCompetitors, onSelect]
	);

	/**
	 * Filter competitors for search
	 */
	const filteredCompetitors = allCompetitors.filter((c) => {
		if (!searchQuery.trim()) return true;
		const query = searchQuery.toLowerCase();
		return (
			c.name.toLowerCase().includes(query) ||
			(c.description?.toLowerCase().includes(query) ?? false)
		);
	});

	/**
	 * Available competitors (not already selected)
	 */
	const availableCompetitors = filteredCompetitors.filter(
		(c) => !selectedCompetitors.has(c.id)
	);

	if (isLoading) {
		return (
			<div className={cn("space-y-4", className)}>
				<Skeleton className="h-32" />
				<Skeleton className="h-48" />
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Selected Competitors */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Selected Competitors
						</span>
						<Badge variant="secondary">{selectedCompetitors.size}</Badge>
					</CardTitle>
					<CardDescription>
						Competitors identified for this opportunity
					</CardDescription>
				</CardHeader>
				<CardContent>
					{selectedCompetitors.size === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4">
							No competitors selected yet. Add from AI suggestions below or manually.
						</p>
					) : (
						<div className="space-y-2">
							{Array.from(selectedCompetitors.values()).map(({ competitor, role, likelihood }) => {
								const roleConf = roleConfig[role];
								const likeConf = likelihoodConfig[likelihood];

								return (
									<div
										key={competitor.id}
										className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
									>
										<div className="flex items-center gap-3">
											<div className="w-8 h-8 rounded bg-background flex items-center justify-center">
												<Building2 className="h-4 w-4 text-muted-foreground" />
											</div>
											<div>
												<p className="font-medium">{competitor.name}</p>
												<div className="flex items-center gap-2 mt-0.5">
													<span className={cn("flex items-center gap-1 text-xs", roleConf.color)}>
														{roleConf.icon}
														{roleConf.label}
													</span>
													<Badge variant="secondary" className={cn("text-xs", likeConf.color)}>
														{likeConf.label}
													</Badge>
												</div>
											</div>
										</div>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleRemove(competitor.id)}
											className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								);
							})}
						</div>
					)}

					{/* Manual Add Button */}
					<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
						<DialogTrigger asChild>
							<Button variant="outline" className="w-full mt-4">
								<Plus className="h-4 w-4 mr-2" />
								Add Competitor Manually
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add Competitor</DialogTitle>
								<DialogDescription>
									Select a competitor and specify their role
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<Label>Competitor</Label>
									<Select value={newCompetitorId} onValueChange={setNewCompetitorId}>
										<SelectTrigger>
											<SelectValue placeholder="Select competitor" />
										</SelectTrigger>
										<SelectContent>
											{availableCompetitors.map((competitor) => (
												<SelectItem key={competitor.id} value={competitor.id}>
													{competitor.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Role</Label>
										<Select value={newRole} onValueChange={(v) => setNewRole(v as CompetitorRole)}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(roleConfig).map(([value, config]) => (
													<SelectItem key={value} value={value}>
														<div className="flex items-center gap-2">
															{config.icon}
															{config.label}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Likelihood to Bid</Label>
										<Select
											value={newLikelihood}
											onValueChange={(v) => setNewLikelihood(v as BidLikelihood)}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(likelihoodConfig).map(([value, config]) => (
													<SelectItem key={value} value={value}>
														{config.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>

							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
									Cancel
								</Button>
								<Button
									onClick={handleAddManual}
									disabled={!newCompetitorId || isPending}
								>
									{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
									Add Competitor
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</CardContent>
			</Card>

			{/* AI Suggestions */}
			{showSuggestions && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span className="flex items-center gap-2">
								<Sparkles className="h-5 w-5 text-purple-500" />
								AI-Suggested Competitors
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRefreshSuggestions}
								disabled={isLoadingSuggestions}
							>
								{isLoadingSuggestions ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="h-4 w-4" />
								)}
							</Button>
						</CardTitle>
						<CardDescription>
							AI-identified likely competitors based on opportunity requirements
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoadingSuggestions ? (
							<div className="space-y-3">
								{[...Array(3)].map((_, i) => (
									<Skeleton key={i} className="h-20" />
								))}
							</div>
						) : suggestedMatches.length === 0 ? (
							<div className="text-center py-6">
								<Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">
									No suggestions available. Try refreshing or add competitors manually.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{suggestedMatches.map((match) => {
									const isSelected = selectedCompetitors.has(match.competitor.id);
									const roleConf = roleConfig[match.role];

									return (
										<div
											key={match.competitor.id}
											className={cn(
												"flex items-center justify-between p-3 border rounded-lg transition-colors",
												isSelected
													? "bg-muted/50 border-primary/50"
													: "hover:bg-muted/30"
											)}
										>
											<div className="flex items-center gap-3 flex-1">
												<div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
													<Building2 className="h-5 w-5 text-muted-foreground" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<p className="font-medium truncate">
															{match.competitor.name}
														</p>
														<Badge
															variant="secondary"
															className={cn("text-xs shrink-0", roleConf.color)}
														>
															{roleConf.label}
														</Badge>
													</div>
													<div className="flex items-center gap-2 mt-1">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<div className="flex items-center gap-2">
																		<Progress
																			value={match.likelihoodScore}
																			className="w-16 h-1.5"
																		/>
																		<span className="text-xs text-muted-foreground">
																			{match.likelihoodScore}% match
																		</span>
																	</div>
																</TooltipTrigger>
																<TooltipContent className="max-w-xs">
																	<p className="font-medium mb-1">Match Reasons:</p>
																	<ul className="text-xs space-y-0.5">
																		{match.matchReasons.map((reason, idx) => (
																			<li key={idx}>- {reason}</li>
																		))}
																	</ul>
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												</div>
											</div>

											{isSelected ? (
												<Badge variant="secondary" className="gap-1">
													<Check className="h-3 w-3" />
													Added
												</Badge>
											) : (
												<Button
													size="sm"
													onClick={() => handleAddFromSuggestion(match)}
													disabled={isPending}
												>
													{isPending ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Plus className="h-4 w-4" />
													)}
												</Button>
											)}
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Info Alert */}
			<Alert>
				<Info className="h-4 w-4" />
				<AlertTitle>Competitor Intelligence</AlertTitle>
				<AlertDescription>
					Identifying competitors helps tailor your proposal strategy. Use this information
					to develop discriminators and ghost themes that position your offering favorably.
				</AlertDescription>
			</Alert>
		</div>
	);
}

export default CompetitorSelector;
