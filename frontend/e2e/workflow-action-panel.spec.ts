import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Workflow action panel", () => {
	test("starts and resolves workflows through browser interactions", async ({ page }) => {
		const script = await bundleActionPanelHarness();
		let startPayload: unknown;
		let transitionPayload: unknown;

		await page.route("http://workflow-panel.test/harness", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><div id="root"></div><script>${escapeScript(script)}</script></body></html>`,
			});
		});
		await page.route("http://workflow-panel.test/api/v1/workflows/start", async (route) => {
			startPayload = JSON.parse(route.request().postData() ?? "{}");
			await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});
		await page.route("http://workflow-panel.test/api/v1/workflows/workflow-1/transition", async (route) => {
			transitionPayload = JSON.parse(route.request().postData() ?? "{}");
			await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});

		await page.goto("http://workflow-panel.test/harness");

		await page.locator("#workflow-subject").fill("rfp-123");
		await page.getByRole("button", { name: "Start" }).click();
		await expect(page.getByText("Workflow started")).toBeVisible();
		expect(startPayload).toEqual({
			templateKey: "rfp_intake_parse",
			subjectId: "rfp-123",
			subjectType: "rfp_parse",
		});

		await page.locator("#workflow-reason").fill("Manual extraction completed");
		await page.getByRole("button", { name: "Apply" }).click();
		await expect(page.getByText("Workflow updated")).toBeVisible();
		expect(transitionPayload).toEqual({
			action: "resolve",
			reason: "Manual extraction completed",
		});
	});
});

async function bundleActionPanelHarness() {
	const result = await build({
		stdin: {
			contents: `
				import React from "react";
				import { createRoot } from "react-dom/client";
				import { WorkflowActionPanel } from "@/components/workflows/WorkflowActionPanel";

				const templates = [{
					id: "template-1",
					templateKey: "rfp_intake_parse",
					name: "RFP Intake Parse",
					subjectType: "rfp_parse",
					status: "active",
				}];
				const instances = [{
					id: "workflow-1",
					workflowKey: "rfp_intake_parse",
					subjectType: "rfp_parse",
					subjectId: "rfp-1",
					state: "manual_extraction",
					status: "active",
				}];

				createRoot(document.getElementById("root")).render(
					React.createElement(WorkflowActionPanel, { templates, instances })
				);
			`,
			resolveDir: FRONTEND_ROOT,
			loader: "tsx",
		},
		bundle: true,
		write: false,
		format: "iife",
		platform: "browser",
		target: "es2020",
		plugins: [{
			name: "frontend-alias",
			setup(esbuild) {
				esbuild.onResolve({ filter: /^@\// }, (args) => ({
					path: resolveFrontendAlias(args.path),
				}));
			},
		}],
	});

	return result.outputFiles[0].text;
}

function escapeScript(script: string) {
	return script.replace(/<\/script/gi, "<\\/script");
}

function resolveFrontendAlias(specifier: string) {
	const basePath = path.join(FRONTEND_ROOT, specifier.slice(2));
	for (const extension of ["", ".ts", ".tsx", ".js", ".jsx"]) {
		const candidate = `${basePath}${extension}`;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return basePath;
}
