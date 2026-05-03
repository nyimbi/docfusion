import "./load-env";
import {
	createWorkflowTemplateDraft,
	listWorkflowTemplates,
	publishWorkflowTemplate,
} from "../lib/actions/workflow-runtime";
import { WORKFLOW_TEMPLATE_CATALOG } from "../lib/workflows/default-templates";

async function main() {
	const actorId = process.env.WORKFLOW_TEMPLATE_SEED_ACTOR ?? "system";
	const force = process.env.WORKFLOW_TEMPLATE_REPUBLISH === "true";
	const existing = await listWorkflowTemplates({ limit: 500 });
	const activeKeys = new Set(existing.filter((template) => template.status === "active").map((template) => template.templateKey));
	const results: Array<{ templateKey: string; status: "skipped" | "published"; id?: string; version?: number }> = [];

	for (const template of WORKFLOW_TEMPLATE_CATALOG) {
		if (activeKeys.has(template.templateKey) && !force) {
			results.push({ templateKey: template.templateKey, status: "skipped" });
			continue;
		}
		const draft = await createWorkflowTemplateDraft(template, actorId);
		const published = await publishWorkflowTemplate(draft.id, actorId);
		results.push({
			templateKey: published.templateKey,
			status: "published",
			id: published.id,
			version: published.version,
		});
	}

	console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
