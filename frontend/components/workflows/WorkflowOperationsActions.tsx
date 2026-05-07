"use client";

import * as React from "react";
import { CheckCircle2, RotateCcw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";

export function WorkflowInstanceRemediationActions({
	workflowId,
	defaultReason,
}: {
	workflowId: string;
	defaultReason?: string;
}) {
	const [reason, setReason] = React.useState(defaultReason ?? "");
	const [message, setMessage] = React.useState<string | null>(null);
	const [pendingAction, setPendingAction] = React.useState<string | null>(null);

	function run(action: "resolve" | "reopen" | "cancel") {
		setPendingAction(action);
		setMessage(null);
		React.startTransition(async () => {
			const response = await fetch(`/api/v1/workflows/${workflowId}/transition`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action, reason }),
			});
			const body = await response.json().catch(() => ({}));
			setPendingAction(null);
			setMessage(response.ok ? `${action} recorded` : body.error ?? `${action} failed`);
		});
	}

	return (
		<div className="space-y-2">
			<Input
				value={reason}
				onChange={(event) => setReason(event.target.value)}
				placeholder="Reason required"
				aria-label="Workflow remediation reason"
			/>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={!reason || Boolean(pendingAction)}
					isLoading={pendingAction === "resolve"}
					onClick={() => run("resolve")}
				>
					<CheckCircle2 className="h-4 w-4" />
					Resolve
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!reason || Boolean(pendingAction)}
					isLoading={pendingAction === "reopen"}
					onClick={() => run("reopen")}
				>
					<RotateCcw className="h-4 w-4" />
					Reopen
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!reason || Boolean(pendingAction)}
					isLoading={pendingAction === "cancel"}
					onClick={() => run("cancel")}
				>
					<XCircle className="h-4 w-4" />
					Cancel
				</Button>
			</div>
			{message && <p className="text-xs text-muted-foreground">{message}</p>}
		</div>
	);
}

export function WorkflowOperationRunButton({
	endpoint,
	label,
}: {
	endpoint: string;
	label: string;
}) {
	const [message, setMessage] = React.useState<string | null>(null);
	const [isPending, startTransition] = React.useTransition();

	function run() {
		setMessage(null);
		startTransition(async () => {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ limit: 50 }),
			});
			const body = await response.json().catch(() => ({}));
			setMessage(response.ok ? summarizeResponse(body) : body.error ?? "Operation failed");
		});
	}

	return (
		<div className="mt-4 space-y-2">
			<Button variant="outline" size="sm" isLoading={isPending} onClick={run}>
				<Send className="h-4 w-4" />
				{label}
			</Button>
			{message && <p className="text-xs text-muted-foreground">{message}</p>}
		</div>
	);
}

function summarizeResponse(body: Record<string, unknown>) {
	const parts = Object.entries(body)
		.filter(([, value]) => typeof value === "number" || typeof value === "string")
		.map(([key, value]) => `${key}: ${value}`);
	return parts.length ? parts.join(", ") : "Operation completed";
}
