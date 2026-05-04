export class WorkflowAuthorityDeniedError extends Error {
	readonly kind = "workflow_authority_denied";
	readonly action?: string;
	readonly requiredRoles: string[];

	constructor(input: { action?: string; requiredRoles?: string[] }) {
		const requiredRoles = input.requiredRoles ?? [];
		super(`Workflow authority denied${input.action ? ` for ${input.action}` : ""}: requires ${requiredRoles.join(" or ")}`);
		this.name = "WorkflowAuthorityDeniedError";
		this.action = input.action;
		this.requiredRoles = requiredRoles;
	}
}
