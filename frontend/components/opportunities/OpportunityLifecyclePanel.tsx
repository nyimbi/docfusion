"use client";

import * as React from "react";
import { CalendarCheck, CheckCircle2, RotateCcw, ThumbsDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	recordOpportunityAnalysisAcceptance,
	transitionOpportunityDeadline,
	transitionOpportunityTriage,
	type OpportunityTriageAction,
} from "@/lib/actions/opportunity-lifecycle";

export interface OpportunityLifecyclePanelProps {
	opportunity: {
		id: string;
		title: string;
		decisionStatus: string;
		assignedTo?: string | null;
		deadline?: Date | string | null;
		fitScore?: number | null;
		winProbability?: number | null;
	};
}

export function OpportunityLifecyclePanel({ opportunity }: OpportunityLifecyclePanelProps) {
	const [reason, setReason] = React.useState(defaultReason(opportunity));
	const [deadline, setDeadline] = React.useState(formatDateInput(opportunity.deadline));
	const [confidence, setConfidence] = React.useState(String(Math.round(opportunity.winProbability ?? opportunity.fitScore ?? 70)));
	const [message, setMessage] = React.useState<string | null>(null);
	const [pendingAction, setPendingAction] = React.useState<string | null>(null);

	function runTriage(action: OpportunityTriageAction) {
		setPendingAction(action);
		setMessage(null);
		React.startTransition(async () => {
			const result = await transitionOpportunityTriage({
				opportunityId: opportunity.id,
				action,
				reason,
				assignedTo: opportunity.assignedTo,
			});
			setPendingAction(null);
			setMessage(result.success ? `Triage moved to ${result.state}` : result.error ?? "Triage update failed");
		});
	}

	function acceptAnalysis(recommendation: "accept" | "override" | "reject") {
		setPendingAction(`analysis:${recommendation}`);
		setMessage(null);
		React.startTransition(async () => {
			const result = await recordOpportunityAnalysisAcceptance({
				opportunityId: opportunity.id,
				recommendation,
				confidence: Number(confidence),
				reason,
				fitScore: opportunity.fitScore,
				winProbability: opportunity.winProbability,
			});
			setPendingAction(null);
			setMessage(result.success ? `Analysis ${recommendation} recorded` : result.error ?? "Analysis update failed");
		});
	}

	function acceptDeadline(action: "accept" | "change" | "reject") {
		setPendingAction(`deadline:${action}`);
		setMessage(null);
		React.startTransition(async () => {
			const result = await transitionOpportunityDeadline({
				opportunityId: opportunity.id,
				action,
				reason,
				acceptedDeadline: deadline ? new Date(deadline).toISOString() : undefined,
			});
			setPendingAction(null);
			setMessage(result.success ? `Deadline ${action} recorded` : result.error ?? "Deadline update failed");
		});
	}

	return (
		<section className="rounded-lg border bg-card" aria-label="Opportunity lifecycle controls">
			<div className="border-b px-5 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-base font-semibold">Lifecycle Controls</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Workflow-backed triage, analysis acceptance, and deadline protection.
						</p>
					</div>
					<Badge variant="outline">{opportunity.decisionStatus}</Badge>
				</div>
			</div>
			<div className="grid gap-5 p-5 xl:grid-cols-[1fr_1fr_1fr]">
				<div className="space-y-3">
					<h3 className="text-sm font-medium">Triage</h3>
					<div className="flex flex-wrap gap-2">
						<ActionButton label="Shortlist" icon={CheckCircle2} pending={pendingAction === "shortlist"} disabled={!reason} onClick={() => runTriage("shortlist")} />
						<ActionButton label="Qualify" icon={TrendingUp} pending={pendingAction === "qualify"} disabled={!reason} onClick={() => runTriage("qualify")} />
						<ActionButton label="Reject" icon={ThumbsDown} pending={pendingAction === "reject"} disabled={!reason} onClick={() => runTriage("reject")} />
						<ActionButton label="Reopen" icon={RotateCcw} pending={pendingAction === "reopen"} disabled={!reason} onClick={() => runTriage("reopen")} />
					</div>
				</div>

				<div className="space-y-3">
					<h3 className="text-sm font-medium">Analysis</h3>
					<label className="grid gap-1 text-sm">
						<span className="text-xs text-muted-foreground">Confidence</span>
						<Input value={confidence} onChange={(event) => setConfidence(event.target.value)} inputMode="numeric" />
					</label>
					<div className="flex flex-wrap gap-2">
						<ActionButton label="Accept" icon={CheckCircle2} pending={pendingAction === "analysis:accept"} disabled={!reason} onClick={() => acceptAnalysis("accept")} />
						<ActionButton label="Override" icon={RotateCcw} pending={pendingAction === "analysis:override"} disabled={!reason} onClick={() => acceptAnalysis("override")} />
					</div>
				</div>

				<div className="space-y-3">
					<h3 className="text-sm font-medium">Deadline</h3>
					<label className="grid gap-1 text-sm">
						<span className="text-xs text-muted-foreground">Accepted deadline</span>
						<Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
					</label>
					<div className="flex flex-wrap gap-2">
						<ActionButton label="Accept" icon={CalendarCheck} pending={pendingAction === "deadline:accept"} disabled={!reason} onClick={() => acceptDeadline("accept")} />
						<ActionButton label="Change" icon={RotateCcw} pending={pendingAction === "deadline:change"} disabled={!reason || !deadline} onClick={() => acceptDeadline("change")} />
					</div>
				</div>
			</div>
			<div className="border-t px-5 py-4">
				<label className="grid gap-2 text-sm">
					<span className="text-xs font-medium text-muted-foreground">Decision rationale</span>
					<Input value={reason} onChange={(event) => setReason(event.target.value)} />
				</label>
				{message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
			</div>
		</section>
	);
}

function ActionButton({
	label,
	icon: Icon,
	pending,
	disabled,
	onClick,
}: {
	label: string;
	icon: typeof CheckCircle2;
	pending: boolean;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<Button variant="outline" size="sm" isLoading={pending} disabled={disabled || pending} onClick={onClick}>
			<Icon className="h-4 w-4" />
			{label}
		</Button>
	);
}

function defaultReason(opportunity: OpportunityLifecyclePanelProps["opportunity"]) {
	return `Lifecycle review for ${opportunity.title}`;
}

function formatDateInput(value?: Date | string | null) {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const offsetMs = date.getTimezoneOffset() * 60 * 1000;
	return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
