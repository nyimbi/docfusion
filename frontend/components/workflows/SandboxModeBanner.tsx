import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSandboxRuntimeContext } from "@/lib/sandbox/runtime";

export function SandboxModeBanner() {
	const context = getSandboxRuntimeContext();
	return (
		<div className="rounded-lg border bg-card p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<ShieldAlert className="h-4 w-4 text-primary" />
					<div>
						<div className="text-sm font-medium">{context.label}</div>
						<div className="text-xs text-muted-foreground">Run scope: {context.runIdPrefix}</div>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge variant={context.mutatingProofAllowed ? "secondary" : "outline"}>
						{context.mutatingProofAllowed ? "mutating proof allowed" : "read-only proof"}
					</Badge>
					<Badge variant={context.fakeDispatch ? "outline" : "secondary"}>
						{context.fakeDispatch ? "fake dispatch" : "real dispatch"}
					</Badge>
					<Badge variant="outline">cleanup required</Badge>
				</div>
			</div>
		</div>
	);
}
