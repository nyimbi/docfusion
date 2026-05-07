import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Portal workflow queue", () => {
	test("shows scoped portal action links and summaries", async ({ page }) => {
		const script = await bundlePortalHarness();
		const runtimeErrors: string[] = [];
		page.on("pageerror", (error) => runtimeErrors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") runtimeErrors.push(message.text());
		});

		await page.route("http://portal-workflows.test/harness", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><div id="root"></div><script>${escapeScript(script)}</script></body></html>`,
			});
		});

		await page.goto("http://portal-workflows.test/harness");

		expect(runtimeErrors).toEqual([]);
		await expect(page.getByText("Partner evidence request for Acme")).toBeVisible();
		await expect(page.getByText("Actionable")).toBeVisible();
		await expect(page.getByRole("link", { name: "Upload evidence" })).toHaveAttribute(
			"href",
			"/partners/evidence-request-1",
		);
		await expect(page.getByText("No portal action")).toBeVisible();
	});
});

async function bundlePortalHarness() {
	const result = await build({
		stdin: {
			contents: `
				import React from "react";
				import { createRoot } from "react-dom/client";
				import { PortalWorkflowQueue } from "@/components/workflows/PortalWorkflowQueue";

				const items = [
					{
						id: "workflow-portal-1",
						workflowKey: "partner_portal_contribution",
						subjectType: "evidence_request",
						subjectId: "evidence-request-1",
						state: "assigned",
						status: "active",
						priority: "high",
						dueAt: new Date("2026-05-10T00:00:00.000Z"),
						portalVisibility: {
							visibleToPortal: true,
							portalRole: "partner",
							summary: "Partner evidence request for Acme",
							actionLabel: "Upload evidence",
							actionUrl: "/partners/evidence-request-1",
						},
					},
					{
						id: "workflow-portal-2",
						workflowKey: "clarification_review",
						subjectType: "clarification",
						subjectId: "clarification-1",
						state: "answered",
						status: "waiting",
						priority: "medium",
						dueAt: null,
						portalVisibility: {
							visibleToPortal: true,
							portalRole: "reviewer",
							summary: "Client answer ready for review",
						},
					},
				];

				createRoot(document.getElementById("root")).render(
					React.createElement(PortalWorkflowQueue, { items })
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
		jsx: "automatic",
		jsxImportSource: "react",
		define: {
			process: JSON.stringify({ env: { NODE_ENV: "test" } }),
			"process.env.NODE_ENV": '"test"',
		},
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
