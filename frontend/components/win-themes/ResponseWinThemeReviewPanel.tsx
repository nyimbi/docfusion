/**
 * ResponseWinThemeReviewPanel - Operator surface for generated response win-theme seeds.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResponseWinThemeSeedReviewData } from "@/lib/types/win-themes";
import { ResponseWinThemeSeedReview } from "./ResponseWinThemeSeedReview";

export interface ResponseWinThemeReviewPanelProps {
	opportunityId: string;
	review: ResponseWinThemeSeedReviewData;
	onCreated: () => void;
}

export function ResponseWinThemeReviewPanel({
	opportunityId,
	review,
	onCreated,
}: ResponseWinThemeReviewPanelProps) {
	if (review.acceptedRequirementCount === 0) return null;

	if (review.seeds.length === 0) {
		return (
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Response Win Themes</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-[var(--foreground-muted)]">
						{review.acceptedRequirementCount} accepted requirement{review.acceptedRequirementCount === 1 ? "" : "s"} reviewed; no new generated win-theme seed is pending approval.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<ResponseWinThemeSeedReview
			opportunityId={opportunityId}
			seeds={review.seeds}
			onCreated={onCreated}
		/>
	);
}
