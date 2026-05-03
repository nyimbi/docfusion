import "./load-env";
import {
	deliverWorkflowNotifications,
	evaluateWorkflowSla,
} from "../lib/actions/workflow-runtime";
import { syncOperationalExceptionWorkflows } from "../lib/actions/operational-exceptions";

async function runOnce() {
	const slaLimit = Number(process.env.WORKFLOW_SLA_LIMIT ?? 100);
	const exceptionLimit = Number(process.env.WORKFLOW_EXCEPTION_LIMIT ?? 100);
	const notificationLimit = Number(process.env.WORKFLOW_NOTIFICATION_LIMIT ?? 100);

	const [sla, exceptions, notifications] = await Promise.all([
		runJob("sla", () => evaluateWorkflowSla({ limit: slaLimit })),
		runJob("exceptions", () => exceptionLimit <= 0
			? Promise.resolve({ synced: 0, skipped: true })
			: syncOperationalExceptionWorkflows({ limit: exceptionLimit })),
		runJob("notifications", () => deliverWorkflowNotifications({ limit: notificationLimit })),
	]);

	console.log(JSON.stringify({
		at: new Date().toISOString(),
		sla,
		exceptions,
		notifications,
	}));

	if (process.env.WORKFLOW_WORKER_STRICT === "true" && [sla, exceptions, notifications].some((job) => !job.ok)) {
		throw new Error("One or more workflow worker jobs failed");
	}
}

async function runJob<T>(name: string, execute: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
	try {
		return { ok: true, result: await execute() };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function main() {
	const intervalSeconds = Number(process.env.WORKFLOW_WORKER_INTERVAL_SECONDS ?? 0);
	await runOnce();
	if (intervalSeconds <= 0) return;

	setInterval(() => {
		runOnce().catch((error) => {
			console.error("[workflow-runtime-worker] iteration failed", error);
		});
	}, intervalSeconds * 1000);
}

main().catch((error) => {
	console.error("[workflow-runtime-worker] failed", error);
	process.exit(1);
});
