/**
 * GoNoGoPanel Component - DocFusion
 *
 * Interactive voting panel for team Go/No-Go decisions on opportunities.
 * Features voting buttons, confidence slider, team vote visualization,
 * and automatic status updates based on consensus.
 */

"use client";

import { useState, useTransition } from "react";
import type {
	OpportunityVote,
	VoteSummary,
	VoteDecision,
	ConfidenceLevel,
} from "@/lib/types/opportunity";
import { castVoteAndUpdateStatus } from "@/lib/actions/opportunity-votes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface GoNoGoPanelProps {
	opportunityId: string;
	initialSummary: VoteSummary;
	initialVotes: OpportunityVote[];
	/** Current user ID - in production, get from auth context */
	currentUserId?: string;
	currentUserName?: string;
}

export function GoNoGoPanel({
	opportunityId,
	initialSummary,
	initialVotes,
	currentUserId = "current-user", // TODO: Get from auth
	currentUserName = "You",
}: GoNoGoPanelProps) {
	const [summary, setSummary] = useState(initialSummary);
	const [votes, setVotes] = useState(initialVotes);
	const [selectedVote, setSelectedVote] = useState<VoteDecision | null>(() => {
		const existingVote = initialVotes.find((v) => v.userId === currentUserId);
		return existingVote?.vote ?? null;
	});
	const [confidence, setConfidence] = useState<ConfidenceLevel>(3);
	const [justification, setJustification] = useState("");
	const [showJustification, setShowJustification] = useState(false);
	const [isPending, startTransition] = useTransition();

	const handleVote = (vote: VoteDecision) => {
		if (selectedVote === vote) {
			// Clicking same vote clears it
			setSelectedVote(null);
			setShowJustification(false);
		} else {
			setSelectedVote(vote);
			setShowJustification(true);
		}
	};

	const submitVote = () => {
		if (!selectedVote) return;

		startTransition(async () => {
			try {
				const result = await castVoteAndUpdateStatus({
					opportunityId,
					userId: currentUserId,
					userName: currentUserName,
					vote: selectedVote,
					confidence,
					justification: justification.trim() || undefined,
				});

				setSummary(result.summary);

				// Update votes list
				const existingIndex = votes.findIndex((v) => v.userId === currentUserId);
				if (existingIndex >= 0) {
					const newVotes = [...votes];
					newVotes[existingIndex] = result.vote;
					setVotes(newVotes);
				} else {
					setVotes([...votes, result.vote]);
				}

				setShowJustification(false);
				setJustification("");
			} catch (error) {
				console.error("Failed to cast vote:", error);
			}
		});
	};

	const existingVote = votes.find((v) => v.userId === currentUserId);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center justify-between">
					Go/No-Go Decision
					{summary.hasConsensus && (
						<span
							className={cn(
								"text-xs font-medium px-2 py-0.5 rounded-full",
								summary.recommendedDecision === "go"
									? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
									: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
							)}
						>
							Consensus: {summary.recommendedDecision === "go" ? "GO" : "NO-GO"}
						</span>
					)}
				</CardTitle>
				<CardDescription>
					{summary.totalVotes === 0
						? "Be the first to vote on this opportunity"
						: `${summary.totalVotes} team member${summary.totalVotes === 1 ? "" : "s"} voted`}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Vote Buttons */}
				<div className="grid grid-cols-3 gap-2">
					<VoteButton
						vote="go"
						label="Go"
						icon="checkmark"
						selected={selectedVote === "go"}
						onClick={() => handleVote("go")}
						disabled={isPending}
					/>
					<VoteButton
						vote="no_go"
						label="No-Go"
						icon="x"
						selected={selectedVote === "no_go"}
						onClick={() => handleVote("no_go")}
						disabled={isPending}
					/>
					<VoteButton
						vote="abstain"
						label="Abstain"
						icon="minus"
						selected={selectedVote === "abstain"}
						onClick={() => handleVote("abstain")}
						disabled={isPending}
					/>
				</div>

				{/* Confidence & Justification */}
				{showJustification && selectedVote && (
					<div className="space-y-3 pt-2 border-t border-border">
						{/* Confidence Slider */}
						<div>
							<label className="text-xs font-medium text-muted-foreground block mb-2">
								Confidence Level: {confidence}/5
							</label>
							<input
								type="range"
								min={1}
								max={5}
								value={confidence}
								onChange={(e) =>
									setConfidence(Number(e.target.value) as ConfidenceLevel)
								}
								className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
							/>
							<div className="flex justify-between text-[10px] text-[var(--foreground-muted)] mt-1">
								<span>Low</span>
								<span>High</span>
							</div>
						</div>

						{/* Justification */}
						<div>
							<label className="text-xs font-medium text-muted-foreground block mb-2">
								Justification (optional)
							</label>
							<textarea
								value={justification}
								onChange={(e) => setJustification(e.target.value)}
								placeholder={
									selectedVote === "go"
										? "Why should we pursue this?"
										: selectedVote === "no_go"
											? "Why should we pass?"
											: "Any comments?"
								}
								rows={2}
								className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						{/* Submit Button */}
						<Button
							onClick={submitVote}
							isLoading={isPending}
							variant="primary"
							size="sm"
							className="w-full"
						>
							{existingVote ? "Update Vote" : "Submit Vote"}
						</Button>
					</div>
				)}

				{/* Vote Summary Visualization */}
				{summary.totalVotes > 0 && (
					<div className="pt-3 border-t border-border">
						{/* Progress Bar */}
						<div className="mb-3">
							<div className="flex justify-between text-xs text-muted-foreground mb-1">
								<span>Go ({summary.goCount})</span>
								<span>No-Go ({summary.noGoCount})</span>
							</div>
							<VoteProgressBar summary={summary} />
						</div>

						{/* Stats */}
						<div className="grid grid-cols-3 gap-2 text-center">
							<StatItem label="Go" value={summary.goCount} color="green" />
							<StatItem label="No-Go" value={summary.noGoCount} color="red" />
							<StatItem label="Abstain" value={summary.abstainCount} color="gray" />
						</div>

						{summary.averageConfidence !== null && (
							<p className="text-xs text-muted-foreground text-center mt-2">
								Avg. Confidence: {summary.averageConfidence.toFixed(1)}/5
							</p>
						)}
					</div>
				)}

				{/* Team Votes List */}
				{votes.length > 0 && (
					<div className="pt-3 border-t border-border">
						<p className="text-xs font-medium text-muted-foreground mb-2">
							Team Votes
						</p>
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{votes.map((vote) => (
								<VoteListItem
									key={vote.id}
									vote={vote}
									isCurrentUser={vote.userId === currentUserId}
								/>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function VoteButton({
	vote,
	label,
	icon,
	selected,
	onClick,
	disabled,
}: {
	vote: VoteDecision;
	label: string;
	icon: "checkmark" | "x" | "minus";
	selected: boolean;
	onClick: () => void;
	disabled: boolean;
}) {
	const colorClasses = {
		go: selected
			? "bg-green-500 text-white border-green-500"
			: "hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-950",
		no_go: selected
			? "bg-red-500 text-white border-red-500"
			: "hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950",
		abstain: selected
			? "bg-secondary text-secondary-foreground border-secondary"
			: "hover:bg-secondary/50 hover:border-border",
	};

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex flex-col items-center justify-center p-3 rounded-lg border border-input",
				"transition-all duration-150",
				"disabled:opacity-50 disabled:cursor-not-allowed",
				colorClasses[vote]
			)}
		>
			<span className="mb-1">
				{icon === "checkmark" && <CheckIcon className="h-5 w-5" />}
				{icon === "x" && <XIcon className="h-5 w-5" />}
				{icon === "minus" && <MinusIcon className="h-5 w-5" />}
			</span>
			<span className="text-xs font-medium">{label}</span>
		</button>
	);
}

function VoteProgressBar({ summary }: { summary: VoteSummary }) {
	const total = summary.goCount + summary.noGoCount + summary.abstainCount;
	if (total === 0) return null;

	const goPercent = (summary.goCount / total) * 100;
	const noGoPercent = (summary.noGoCount / total) * 100;
	const abstainPercent = (summary.abstainCount / total) * 100;

	return (
		<div className="h-2 bg-muted rounded-full overflow-hidden flex">
			{goPercent > 0 && (
				<div
					className="bg-green-500 transition-all duration-300"
					style={{ width: `${goPercent}%` }}
				/>
			)}
			{noGoPercent > 0 && (
				<div
					className="bg-red-500 transition-all duration-300"
					style={{ width: `${noGoPercent}%` }}
				/>
			)}
			{abstainPercent > 0 && (
				<div
					className="bg-secondary transition-all duration-300"
					style={{ width: `${abstainPercent}%` }}
				/>
			)}
		</div>
	);
}

function StatItem({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: "green" | "red" | "gray";
}) {
	const colorClasses = {
		green: "text-green-600 dark:text-green-400",
		red: "text-red-600 dark:text-red-400",
		gray: "text-muted-foreground",
	};

	return (
		<div>
			<p className={cn("text-lg font-semibold", colorClasses[color])}>{value}</p>
			<p className="text-[10px] text-muted-foreground">{label}</p>
		</div>
	);
}

function VoteListItem({
	vote,
	isCurrentUser,
}: {
	vote: OpportunityVote;
	isCurrentUser: boolean;
}) {
	const voteConfig: Record<VoteDecision, { label: string; color: string }> = {
		go: { label: "Go", color: "text-green-600 dark:text-green-400" },
		no_go: { label: "No-Go", color: "text-red-600 dark:text-red-400" },
		abstain: { label: "Abstain", color: "text-muted-foreground" },
	};

	const config = voteConfig[vote.vote];

	return (
		<div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 text-sm">
			<div className="flex items-center gap-2">
				<span className="font-medium text-foreground">
					{isCurrentUser ? "You" : vote.userName || "Team Member"}
				</span>
				{vote.confidence && (
					<span className="text-xs text-muted-foreground">
						({vote.confidence}/5)
					</span>
				)}
			</div>
			<span className={cn("font-medium text-xs", config.color)}>{config.label}</span>
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M5 13l4 4L19 7"
			/>
		</svg>
	);
}

function XIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M6 18L18 6M6 6l12 12"
			/>
		</svg>
	);
}

function MinusIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M20 12H4"
			/>
		</svg>
	);
}
