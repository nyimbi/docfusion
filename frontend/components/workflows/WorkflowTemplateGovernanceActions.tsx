"use client";

import * as React from "react";
import { Archive, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	deprecateWorkflowTemplateFromStudio,
	publishWorkflowTemplateFromStudio,
	rollbackWorkflowTemplateFromStudio,
} from "@/lib/actions/workflow-template-governance";

export function WorkflowTemplateGovernanceActions({
	templateId,
	templateKey,
	version,
	status,
}: {
	templateId: string;
	templateKey: string;
	version: number;
	status: string;
}) {
	const [message, setMessage] = React.useState<string | null>(null);
	const [pendingAction, setPendingAction] = React.useState<string | null>(null);

	function run(action: "publish" | "deprecate" | "rollback") {
		setMessage(null);
		setPendingAction(action);
		React.startTransition(async () => {
			const result = action === "publish"
				? await publishWorkflowTemplateFromStudio(templateId)
				: action === "deprecate"
					? await deprecateWorkflowTemplateFromStudio(templateId)
					: await rollbackWorkflowTemplateFromStudio(templateKey, version);
			setPendingAction(null);
			setMessage(result.success ? `${action} recorded` : result.error ?? `${action} failed`);
		});
	}

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={status === "active" || Boolean(pendingAction)}
					isLoading={pendingAction === "publish"}
					onClick={() => run("publish")}
				>
					<ShieldCheck className="h-4 w-4" />
					Publish
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={status === "deprecated" || Boolean(pendingAction)}
					isLoading={pendingAction === "deprecate"}
					onClick={() => run("deprecate")}
				>
					<Archive className="h-4 w-4" />
					Deprecate
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={status === "active" || Boolean(pendingAction)}
					isLoading={pendingAction === "rollback"}
					onClick={() => run("rollback")}
				>
					<RotateCcw className="h-4 w-4" />
					Roll back
				</Button>
			</div>
			{message && <p className="text-xs text-muted-foreground">{message}</p>}
		</div>
	);
}
