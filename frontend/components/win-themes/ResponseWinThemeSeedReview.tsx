/**
 * ResponseWinThemeSeedReview - Review generated response package win-theme seeds.
 */

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ClipboardCheck, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createThemesFromResponseSeeds } from "@/lib/actions/win-themes";
import { cn } from "@/lib/utils";
import type {
	CreateThemesFromResponseSeedsResult,
	ResponseWinThemeSeedInput,
	ResponseWinThemeSeedReviewDecision,
	WinTheme,
} from "@/lib/types/win-themes";

export interface ResponseWinThemeSeedReviewProps {
	opportunityId: string;
	seeds: ResponseWinThemeSeedInput[];
	onCreated?: (themes: WinTheme[]) => void;
	className?: string;
}

type SeedReviewState = {
	decision?: ResponseWinThemeSeedReviewDecision;
	note: string;
};

const TYPE_LABELS: Record<ResponseWinThemeSeedInput["type"], string> = {
	value_prop: "Value Proposition",
	differentiator: "Differentiator",
	proof_point: "Proof Point",
	risk_mitigation: "Risk Mitigation",
};

function seedKey(seed: ResponseWinThemeSeedInput, index: number) {
	return seed.id ?? `${seed.shortVersion}-${index}`;
}

export function ResponseWinThemeSeedReview({
	opportunityId,
	seeds,
	onCreated,
	className,
}: ResponseWinThemeSeedReviewProps) {
	const [reviews, setReviews] = useState<Record<string, SeedReviewState>>(() =>
		Object.fromEntries(
			seeds.map((seed, index) => [
				seedKey(seed, index),
				{
					decision: seed.reviewDecision,
					note: seed.reviewNote ?? "",
				},
			])
		)
	);
	const [result, setResult] = useState<CreateThemesFromResponseSeedsResult | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		setReviews((current) =>
			Object.fromEntries(
				seeds.map((seed, index) => {
					const key = seedKey(seed, index);
					return [
						key,
						current[key] ?? {
							decision: seed.reviewDecision,
							note: seed.reviewNote ?? "",
						},
					];
				})
			)
		);
	}, [seeds]);

	const counts = useMemo(() => {
		let approved = 0;
		let rejected = 0;
		let pendingReview = 0;

		for (const [index, seed] of seeds.entries()) {
			const review = reviews[seedKey(seed, index)];
			if (review?.decision === "approve") approved += 1;
			else if (review?.decision === "reject") rejected += 1;
			else pendingReview += 1;
		}

		return { approved, rejected, pendingReview };
	}, [reviews, seeds]);

	function updateDecision(key: string, decision: ResponseWinThemeSeedReviewDecision) {
		setReviews((current) => ({
			...current,
			[key]: {
				...current[key],
				decision,
				note: current[key]?.note ?? "",
			},
		}));
		setResult(null);
	}

	function updateNote(key: string, note: string) {
		setReviews((current) => ({
			...current,
			[key]: {
				...current[key],
				note,
			},
		}));
		setResult(null);
	}

	function persistApprovedSeeds() {
		startTransition(async () => {
			const reviewedSeeds = seeds.map((seed, index) => {
				const review = reviews[seedKey(seed, index)];
				return {
					...seed,
					reviewDecision: review?.decision,
					reviewNote: review?.note.trim() || undefined,
				};
			});
			const nextResult = await createThemesFromResponseSeeds({
				opportunityId,
				seeds: reviewedSeeds,
				reviewRequired: true,
			});

			setResult(nextResult);
			if (nextResult.success && nextResult.data?.created.length) {
				onCreated?.(nextResult.data.created);
			}
		});
	}

	return (
		<Card className={className} noHover>
			<CardHeader className="gap-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle className="flex items-center gap-2 text-base">
							<ClipboardCheck className="h-4 w-4" />
							Response win-theme seed review
						</CardTitle>
						<div className="mt-2 flex flex-wrap gap-2">
							<Badge variant="secondary">{counts.approved} approved</Badge>
							<Badge variant="outline">{counts.rejected} rejected</Badge>
							<Badge variant="outline">{counts.pendingReview} pending</Badge>
						</div>
					</div>
					<Button
						type="button"
						onClick={persistApprovedSeeds}
						disabled={counts.approved === 0 || isPending}
						isLoading={isPending}
						loadingText="Persisting approved seeds"
					>
						<Save className="h-4 w-4" />
						Persist approved
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{seeds.map((seed, index) => {
					const key = seedKey(seed, index);
					const review = reviews[key] ?? { note: "" };
					const approved = review.decision === "approve";
					const rejected = review.decision === "reject";

					return (
						<div key={key} className="rounded-lg border border-border p-4">
							<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
								<div className="min-w-0 space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="secondary">{TYPE_LABELS[seed.type]}</Badge>
										<Badge variant="outline">P{seed.priority ?? 3}</Badge>
										{seed.evaluationCriteriaIds?.map((criteriaId) => (
											<Badge key={criteriaId} variant="outline">{criteriaId}</Badge>
										))}
									</div>
									<h4 className="text-sm font-semibold text-foreground">{seed.shortVersion}</h4>
									<p className="text-sm leading-6 text-muted-foreground">{seed.statement}</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<Button
										type="button"
										size="sm"
										variant={approved ? "primary" : "outline"}
										onClick={() => updateDecision(key, "approve")}
										aria-pressed={approved}
									>
										<Check className="h-4 w-4" />
										Approve
									</Button>
									<Button
										type="button"
										size="sm"
										variant={rejected ? "danger" : "outline"}
										onClick={() => updateDecision(key, "reject")}
										aria-pressed={rejected}
									>
										<X className="h-4 w-4" />
										Reject
									</Button>
								</div>
							</div>
							<div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
								<div className="space-y-2 text-xs text-muted-foreground">
									{seed.targetDocumentTypes?.length ? (
										<p>Targets: {seed.targetDocumentTypes.join(", ")}</p>
									) : null}
									{seed.requirementIds?.length ? (
										<p>Requirements: {seed.requirementIds.join(", ")}</p>
									) : null}
									{seed.supportingEvidence?.length ? (
										<p>Evidence: {seed.supportingEvidence.join("; ")}</p>
									) : null}
									{seed.rationale ? (
										<p className="text-foreground/80">{seed.rationale}</p>
									) : null}
								</div>
								<Textarea
									value={review.note}
									onChange={(event) => updateNote(key, event.target.value)}
									placeholder="Reviewer note"
									maxLength={1000}
									className={cn(
										"min-h-[92px] resize-y",
										rejected && "border-destructive/60 focus-visible:ring-destructive/30"
									)}
								/>
							</div>
						</div>
					);
				})}
				{result ? (
					<div
						className={cn(
							"rounded-lg border px-4 py-3 text-sm",
							result.success
								? "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200"
								: "border-destructive/30 bg-destructive/10 text-destructive"
						)}
					>
						{result.success
							? `${result.data?.created.length ?? 0} persisted, ${result.data?.skipped ?? 0} skipped, ${result.data?.pendingReview ?? 0} pending review.`
							: result.error}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
