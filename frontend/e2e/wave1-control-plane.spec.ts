import { expect, test } from "@playwright/test";
import { build, type Plugin } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Wave 1 control-plane interactions", () => {
	test("acknowledges and retries notification work items from the operational inbox", async ({ page }) => {
		const script = await bundleHarness("inbox");

		await page.route("http://wave1-control.test/inbox", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: harnessHtml(script),
			});
		});

		await page.goto("http://wave1-control.test/inbox");
		await expect(page.getByText("Operational Inbox")).toBeVisible();
		await page.getByRole("button", { name: "notification" }).click();
		await page.getByRole("button", { name: "Ack" }).click();
		await expect(page.getByText("ack:notification-1")).toBeVisible();
		await page.getByRole("button", { name: "Retry" }).click();
		await expect(page.getByText("retry:notification-1")).toBeVisible();
		await page.getByRole("checkbox", { name: "Quiet hours" }).check();
		await page.getByRole("button", { name: "Save" }).click();
		await expect(page.getByText("Notification preferences saved")).toBeVisible();
	});

	test("submits workflow remediation actions with reason capture", async ({ page }) => {
		const script = await bundleHarness("operations");
		let transitionPayload: unknown;

		await page.route("http://wave1-control.test/operations", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: harnessHtml(script),
			});
		});
		await page.route("http://wave1-control.test/api/v1/workflows/workflow-1/transition", async (route) => {
			transitionPayload = JSON.parse(route.request().postData() ?? "{}");
			await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});

		await page.goto("http://wave1-control.test/operations");
		await page.getByLabel("Workflow remediation reason").fill("Operator cleared failed parse");
		await page.getByRole("button", { name: "Resolve" }).click();
		await expect(page.getByText("resolve recorded")).toBeVisible();
		expect(transitionPayload).toEqual({
			action: "resolve",
			reason: "Operator cleared failed parse",
		});
	});

	test("surfaces command-center workflow links for an opportunity", async ({ page }) => {
		const script = await bundleHarness("command-center");
		const runtimeErrors: string[] = [];
		page.on("pageerror", (error) => runtimeErrors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") runtimeErrors.push(message.text());
		});

		await page.route("http://wave1-control.test/command-center", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: harnessHtml(script),
			});
		});

		await page.goto("http://wave1-control.test/command-center");
		expect(runtimeErrors).toEqual([]);
		await expect(page.getByText("Workflow Surfaces")).toBeVisible();
		await expect(page.getByText("Response Readiness")).toBeVisible();
		await expect(page.getByText("Response quality")).toBeVisible();
		await expect(page.getByText("Response package readiness blocked: Missing review gate coverage")).toBeVisible();
		await expect(page.getByText("Evidence and claims")).toBeVisible();
		await expect(page.getByText("Compliance matrix")).toBeVisible();
		await expect(page.getByRole("link", { name: "Requirements" })).toHaveAttribute(
			"href",
			"/opportunities/opp-1/requirements",
		);
		await expect(page.getByRole("link", { name: "Documents" })).toHaveAttribute(
			"href",
			"/opportunities/opp-1/documents",
		);
		await expect(page.getByRole("link", { name: "Open item" }).first()).toHaveAttribute(
			"href",
			"/opportunities/opp-1/documents",
		);
		await expect(page.getByRole("link", { name: "Inbox" })).toHaveAttribute(
			"href",
			"/tasks?opportunityId=opp-1",
		);
	});
});

async function bundleHarness(kind: "inbox" | "operations" | "command-center") {
	const result = await build({
		stdin: {
			contents: kind === "inbox"
				? inboxHarness()
				: kind === "operations"
					? operationsHarness()
					: commandCenterHarness(),
			resolveDir: FRONTEND_ROOT,
			loader: "tsx",
		},
		bundle: true,
		write: false,
		format: "iife",
		platform: "browser",
		target: "es2020",
		jsx: "automatic",
		jsxImportSource: "react",
		plugins: [frontendAliasPlugin()],
	});

	return result.outputFiles[0].text;
}

function inboxHarness() {
	return `
		import React from "react";
		import { createRoot } from "react-dom/client";
		import { OperationalInbox } from "@/components/tasks/OperationalInbox";

		const projection = {
			generatedAt: new Date().toISOString(),
			notificationPreferences: {
				email: { deadlines: true, mentions: true, updates: false, marketing: false },
				push: { deadlines: true, mentions: true, updates: true },
				quietHours: { enabled: false, start: "22:00", end: "08:00" },
			},
			summary: {
				total: 2,
				open: 2,
				blocked: 1,
				overdue: 0,
				dueSoon: 1,
				critical: 0,
				byKind: { notification: 1, task: 1 },
			},
			items: [
				{
					id: "notification:notification-1",
					kind: "notification",
					title: "Failed notification",
					status: "failed",
					priority: "high",
					subjectType: "workflow_notification",
					subjectId: "notification-1",
					source: "workflow_notification",
					blocker: "Failed delivery or job",
				},
				{
					id: "task:task-1",
					kind: "task",
					title: "Draft response",
					status: "open",
					priority: "medium",
					source: "proposal_task",
				},
			],
		};

		function App() {
			const [message, setMessage] = React.useState("");
			window.__wave1ActionLog = (value) => setMessage(value);
			return React.createElement(
				React.Fragment,
				null,
				React.createElement(OperationalInbox, { initialProjection: projection }),
				React.createElement("div", { id: "action-log" }, message)
			);
		}

		createRoot(document.getElementById("root")).render(React.createElement(App));
	`;
}

function commandCenterHarness() {
	return `
		import React from "react";
		import { createRoot } from "react-dom/client";
		import { OpportunityCommandCenter } from "@/components/opportunities/OpportunityCommandCenter";

		const projection = {
			opportunityId: "opp-1",
			readiness: {
				score: 62,
				label: "watch",
				reasons: ["1 blocker"],
			},
			readinessDimensions: [
				{
					key: "evidence",
					label: "Evidence and claims",
					status: "block",
					scoreImpact: 18,
					blockerCount: 1,
					warningCount: 0,
					owner: "Proposal manager",
					actionUrl: "/tasks?opportunityId=opp-1",
				},
				{
					key: "compliance",
					label: "Compliance matrix",
					status: "warn",
					scoreImpact: 4,
					blockerCount: 0,
					warningCount: 1,
					owner: "Compliance officer",
					actionUrl: "/workflows",
				},
				{
					key: "response_quality",
					label: "Response quality",
					status: "block",
					scoreImpact: 18,
					blockerCount: 1,
					warningCount: 0,
					owner: "Proposal manager",
					actionUrl: "/opportunities/opp-1/documents",
				},
				{
					key: "dispatch",
					label: "Dispatch and receipt",
					status: "pass",
					scoreImpact: 0,
					blockerCount: 0,
					warningCount: 0,
					owner: null,
					actionUrl: null,
				},
			],
			nextActions: [
				{
					id: "task:evidence",
					label: "Add evidence",
					priority: "high",
					actionUrl: "/tasks?opportunityId=opp-1",
					source: "proposal_task",
				},
			],
			blockers: [
				{
					id: "workflow:response-workflow-1",
					label: "Response package readiness blocked: Missing review gate coverage",
					severity: "critical",
					owner: "Proposal manager",
					dueAt: "2026-05-07T00:00:00.000Z",
					actionUrl: "/opportunities/opp-1/documents",
				},
			],
			workSummary: {
				total: 2,
				open: 2,
				blocked: 1,
				overdue: 0,
				dueSoon: 1,
				critical: 0,
				byKind: { task: 2 },
			},
			documentSummary: {
				total: 1,
				downloaded: 1,
				failed: 0,
			},
			workflowSummary: {
				total: 2,
				active: 1,
				breached: 0,
				escalated: 0,
				completed: 1,
			},
			auditEvents: [
				{
					id: "audit-1",
					eventType: "requirement.accepted",
					actorName: "Proposal Manager",
					reason: "Ready for writing",
					createdAt: "2026-05-06T00:00:00.000Z",
				},
			],
			generatedAt: "2026-05-06T00:00:00.000Z",
		};

		createRoot(document.getElementById("root")).render(
			React.createElement(OpportunityCommandCenter, { projection })
		);
	`;
}

function operationsHarness() {
	return `
		import React from "react";
		import { createRoot } from "react-dom/client";
		import { WorkflowInstanceRemediationActions } from "@/components/workflows/WorkflowOperationsActions";

		createRoot(document.getElementById("root")).render(
			React.createElement(WorkflowInstanceRemediationActions, { workflowId: "workflow-1" })
		);
	`;
}

function frontendAliasPlugin(): Plugin {
	return {
		name: "frontend-alias",
		setup(esbuild) {
			esbuild.onResolve({ filter: /^@\/lib\/actions\/work-items$/ }, () => ({
				path: "work-items-action-stub",
				namespace: "wave1-stubs",
			}));
			esbuild.onLoad({ filter: /.*/, namespace: "wave1-stubs" }, () => ({
				loader: "js",
				contents: `
					export async function acknowledgeWorkflowNotification(id) {
						window.__wave1ActionLog?.("ack:" + id);
						return { success: true };
					}
					export async function retryWorkflowNotificationDelivery(id) {
						window.__wave1ActionLog?.("retry:" + id);
						return { success: true };
					}
					export async function updateWorkflowNotificationQuietHours() {
						return { success: true };
					}
				`,
			}));
			esbuild.onResolve({ filter: /^@\// }, (args) => ({
				path: resolveFrontendAlias(args.path),
			}));
		},
	};
}

function escapeScript(script: string) {
	return script.replace(/<\/script/gi, "<\\/script");
}

function harnessHtml(script: string) {
	return `<!doctype html><html><body><div id="root"></div><script>window.process={env:{}};</script><script>${escapeScript(script)}</script></body></html>`;
}

function resolveFrontendAlias(specifier: string) {
	const basePath = path.join(FRONTEND_ROOT, specifier.slice(2));
	for (const extension of ["", ".ts", ".tsx", ".js", ".jsx"]) {
		const candidate = `${basePath}${extension}`;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return basePath;
}
