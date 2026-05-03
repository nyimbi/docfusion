"use client";

import * as React from "react";
import { Play, RotateCcw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface WorkflowActionTemplateOption {
	id: string;
	templateKey: string;
	name: string;
	subjectType: string;
	status: string;
}

export interface WorkflowActionInstanceOption {
	id: string;
	workflowKey: string;
	subjectType: string;
	subjectId: string;
	state: string;
	status: string;
}

export function WorkflowActionPanel({
	templates,
	instances,
}: {
	templates: WorkflowActionTemplateOption[];
	instances: WorkflowActionInstanceOption[];
}) {
	const [templateKey, setTemplateKey] = React.useState(templates[0]?.templateKey ?? "");
	const [subjectId, setSubjectId] = React.useState("");
	const [workflowId, setWorkflowId] = React.useState(instances[0]?.id ?? "");
	const [action, setAction] = React.useState("resolve");
	const [reason, setReason] = React.useState("");
	const [message, setMessage] = React.useState<string | null>(null);
	const [isPending, startTransition] = React.useTransition();

	const selectedTemplate = templates.find((template) => template.templateKey === templateKey);

	function submitStart(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage(null);
		startTransition(async () => {
			const response = await fetch("/api/v1/workflows/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					templateKey,
					subjectId,
					subjectType: selectedTemplate?.subjectType,
					reason: reason || undefined,
				}),
			});
			const body = await response.json().catch(() => ({}));
			setMessage(response.ok ? "Workflow started" : body.error ?? "Workflow start failed");
			if (response.ok) {
				setSubjectId("");
			}
		});
	}

	function submitTransition(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage(null);
		startTransition(async () => {
			const response = await fetch(`/api/v1/workflows/${workflowId}/transition`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action, reason }),
			});
			const body = await response.json().catch(() => ({}));
			setMessage(response.ok ? "Workflow updated" : body.error ?? "Workflow update failed");
			if (response.ok) {
				setReason("");
			}
		});
	}

	return (
		<section className="rounded-lg border bg-card">
			<div className="border-b px-5 py-4">
				<h2 className="text-base font-semibold">Workflow Actions</h2>
			</div>
			<div className="grid gap-6 p-5 xl:grid-cols-2">
				<form onSubmit={submitStart} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="workflow-template">Template</Label>
						<Select value={templateKey} onValueChange={setTemplateKey}>
							<SelectTrigger id="workflow-template">
								<SelectValue placeholder="Select template" />
							</SelectTrigger>
							<SelectContent>
								{templates.map((template) => (
									<SelectItem key={template.id} value={template.templateKey}>
										{template.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="workflow-subject">Subject ID</Label>
						<Input
							id="workflow-subject"
							value={subjectId}
							onChange={(event) => setSubjectId(event.target.value)}
							placeholder="Domain record ID"
						/>
					</div>
					<Button type="submit" size="sm" disabled={!templateKey || !subjectId || isPending}>
						<Play className="h-4 w-4" />
						Start
					</Button>
				</form>

				<form onSubmit={submitTransition} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="workflow-instance">Instance</Label>
						<Select value={workflowId} onValueChange={setWorkflowId}>
							<SelectTrigger id="workflow-instance">
								<SelectValue placeholder="Select workflow" />
							</SelectTrigger>
							<SelectContent>
								{instances.map((instance) => (
									<SelectItem key={instance.id} value={instance.id}>
										{instance.workflowKey} / {instance.subjectId}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2 md:grid-cols-[160px_1fr]">
						<div className="grid gap-2">
							<Label htmlFor="workflow-action">Action</Label>
							<Select value={action} onValueChange={setAction}>
								<SelectTrigger id="workflow-action">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="resolve">Resolve</SelectItem>
									<SelectItem value="reopen">Reopen</SelectItem>
									<SelectItem value="cancel">Cancel</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="workflow-reason">Reason</Label>
							<Input
								id="workflow-reason"
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Required for reversal"
							/>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button type="submit" size="sm" disabled={!workflowId || !reason || isPending}>
							{action === "cancel" ? <XCircle className="h-4 w-4" /> : action === "reopen" ? <RotateCcw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
							Apply
						</Button>
						{message && <span className="text-sm text-muted-foreground">{message}</span>}
					</div>
				</form>
			</div>
		</section>
	);
}
