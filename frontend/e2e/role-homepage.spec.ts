import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Role homepage", () => {
	test("renders persona-specific focus items and quick links", async ({ page }) => {
		const script = await bundleRoleHomepageHarness();
		const runtimeErrors: string[] = [];
		page.on("pageerror", (error) => runtimeErrors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") runtimeErrors.push(message.text());
		});

		await page.route("http://role-homepage.test/harness", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><div id="root"></div><script>${escapeScript(script)}</script></body></html>`,
			});
		});

		await page.goto("http://role-homepage.test/harness");
		expect(runtimeErrors).toEqual([]);

		await expect(page.getByRole("heading", { name: "Operations Home" })).toBeVisible();
		await expect(page.getByText("RFP parse remediation breached")).toBeVisible();
		await expect(page.getByRole("link", { name: "Open Operations" })).toHaveAttribute("href", "/workflows/operations");
		await expect(page.getByRole("link", { name: "Operations", exact: true })).toHaveAttribute("href", "/workflows/operations");
		await expect(page.getByText("Pricing approval decision")).not.toBeVisible();
	});
});

async function bundleRoleHomepageHarness() {
	const result = await build({
		stdin: {
			contents: `
				import React from "react";
				import { createRoot } from "react-dom/client";
				import { RoleHomepage } from "@/components/work-items/RoleHomepage";
				import { buildRoleHomepageProjection } from "@/lib/work-items/role-homepage";

				const projection = buildRoleHomepageProjection(["operations"], [
					{
						id: "workflow:breached-parse",
						kind: "exception",
						title: "RFP parse remediation breached",
						status: "breached",
						priority: "critical",
						dueAt: "2026-05-05T09:00:00.000Z",
						subjectType: "rfp_parse",
						actionUrl: "/workflows/operations",
						source: "workflow_runtime",
					},
					{
						id: "approval:pricing",
						kind: "approval",
						title: "Pricing approval decision",
						status: "waiting",
						priority: "high",
						subjectType: "pricing_package",
						actionUrl: "/workflows",
						source: "workflow_runtime",
					},
				], new Date("2026-05-06T09:00:00.000Z"));

				createRoot(document.getElementById("root")).render(
					React.createElement(RoleHomepage, { projection })
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
