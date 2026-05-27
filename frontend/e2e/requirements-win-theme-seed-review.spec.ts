import { expect, test } from "@playwright/test";
import { build, type Plugin } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Requirements win-theme seed review", () => {
	test("approves, rejects, and persists generated seeds in the browser", async ({ page }) => {
		const script = await bundleSeedReviewHarness();
		const runtimeErrors: string[] = [];
		page.on("pageerror", (error) => runtimeErrors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") runtimeErrors.push(message.text());
		});

		await page.route("http://requirements-win-theme-review.test/harness", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><div id="root"></div><script>${escapeScript(script)}</script></body></html>`,
			});
		});

		await page.goto("http://requirements-win-theme-review.test/harness");

		expect(runtimeErrors).toEqual([]);
		await expect(page.getByText("Response win-theme seed review")).toBeVisible();
		await expect(page.getByText("African-first platform fit")).toBeVisible();
		await expect(page.getByText("Migration delivery control")).toBeVisible();
		await expect(page.getByText("EVAL-TECH-1")).toBeVisible();
		await expect(page.getByText("EVAL-TECH-2")).toBeVisible();
		await expect(page.getByText("0 approved")).toBeVisible();
		await expect(page.getByText("2 pending")).toBeVisible();
		await expect(page.getByRole("button", { name: "Persist approved" })).toBeDisabled();

		await page.getByRole("button", { name: /^Approve$/ }).first().click();
		await page.getByPlaceholder("Reviewer note").first().fill("Strong strategy; keep this one.");
		await page.getByRole("button", { name: /^Reject$/ }).nth(1).click();

		await expect(page.getByText("1 approved")).toBeVisible();
		await expect(page.getByText("1 rejected")).toBeVisible();
		await expect(page.getByText("0 pending")).toBeVisible();
		await expect(page.getByRole("button", { name: "Persist approved" })).toBeEnabled();

		await page.getByRole("button", { name: "Persist approved" }).click();

		await expect(page.getByText("1 persisted, 0 skipped, 0 pending review.")).toBeVisible();
		await expect(page.getByText("created:1")).toBeVisible();
		const payload = await page.evaluate(() => window.__seedReviewPayload);
		expect(payload).toMatchObject({
			opportunityId: "opp-browser-seed-review",
			reviewRequired: true,
			seeds: [
				{
					id: "seed-platform-fit",
					reviewDecision: "approve",
					reviewNote: "Strong strategy; keep this one.",
				},
				{
					id: "seed-delivery-risk",
					reviewDecision: "reject",
				},
			],
		});
	});
});

async function bundleSeedReviewHarness() {
	const result = await build({
		stdin: {
			contents: `
				import React from "react";
				import { createRoot } from "react-dom/client";
				import { ResponseWinThemeSeedReview } from "@/components/win-themes/ResponseWinThemeSeedReview";

				const seeds = [
					{
						id: "seed-platform-fit",
						shortVersion: "African-first platform fit",
						statement: "Datacraft reduces delivery risk with proven African institutional platform experience.",
						type: "value_prop",
						priority: 5,
						evaluationCriteriaIds: ["EVAL-TECH-1"],
						requirementIds: ["req-technical-cloud"],
						targetDocumentTypes: ["technical"],
						supportingEvidence: ["Lindela and MeGuard production evidence"],
						rationale: "Maps the accepted technical requirement to a differentiated response strategy.",
					},
					{
						id: "seed-delivery-risk",
						shortVersion: "Migration delivery control",
						statement: "Datacraft controls migration risk through staged governance and audit-ready workflows.",
						type: "risk_mitigation",
						priority: 4,
						evaluationCriteriaIds: ["EVAL-TECH-2"],
						requirementIds: ["req-technical-cloud"],
					},
				];

				function App() {
					const [created, setCreated] = React.useState([]);
					return React.createElement(
						React.Fragment,
						null,
						React.createElement(ResponseWinThemeSeedReview, {
							opportunityId: "opp-browser-seed-review",
							seeds,
							onCreated: (themes) => setCreated(themes),
						}),
						React.createElement("div", { id: "created-count" }, "created:" + created.length)
					);
				}

				createRoot(document.getElementById("root")).render(React.createElement(App));
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
		plugins: [winThemeActionStubPlugin(), frontendAliasPlugin()],
	});
	return result.outputFiles[0].text;
}

function winThemeActionStubPlugin(): Plugin {
	return {
		name: "win-theme-action-stub",
		setup(esbuild) {
			esbuild.onResolve({ filter: /^@\/lib\/actions\/win-themes$/ }, () => ({
				path: "win-theme-action-stub",
				namespace: "win-theme-action-stub",
			}));
			esbuild.onLoad({ filter: /.*/, namespace: "win-theme-action-stub" }, () => ({
				loader: "js",
				contents: `
					export async function createThemesFromResponseSeeds(input) {
						window.__seedReviewPayload = input;
						const created = input.seeds
							.filter((seed) => seed.reviewDecision === "approve")
							.map((seed, index) => ({
								id: "theme-" + (index + 1),
								opportunityId: input.opportunityId,
								statement: seed.statement,
								shortVersion: seed.shortVersion,
								type: seed.type,
								priority: seed.priority ?? 3,
								status: "draft",
								displayOrder: index,
								supportingEvidence: seed.supportingEvidence ?? [],
								relatedProjectIds: [],
								evaluationCriteriaIds: seed.evaluationCriteriaIds ?? [],
								keywords: seed.keywords ?? [],
								createdBy: "browser-proof",
								createdAt: new Date(),
								updatedAt: new Date(),
							}));
						return {
							success: true,
							data: {
								created,
								skipped: 0,
								rejected: input.seeds.filter((seed) => seed.reviewDecision === "reject").length,
								pendingReview: input.seeds.filter((seed) => !seed.reviewDecision).length,
							},
						};
					}
				`,
			}));
		},
	};
}

function frontendAliasPlugin(): Plugin {
	return {
		name: "frontend-alias",
		setup(esbuild) {
			esbuild.onResolve({ filter: /^@\// }, (args) => ({
				path: resolveFrontendAlias(args.path),
			}));
		},
	};
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

declare global {
	interface Window {
		__seedReviewPayload?: unknown;
	}
}
