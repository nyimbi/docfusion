import { expect, test } from "@playwright/test";
import { build, type Plugin } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Proposal finalization authority", () => {
	test("shows authority denial inline when final package approval is blocked", async ({ page }) => {
		const script = await bundleFinalizationHarness();
		const runtimeErrors: string[] = [];
		page.on("pageerror", (error) => runtimeErrors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") runtimeErrors.push(message.text());
		});

		await page.route("http://proposal-finalization-authority.test/harness", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><div id="root"></div><script>${escapeScript(script)}</script></body></html>`,
			});
		});

		await page.goto("http://proposal-finalization-authority.test/harness");

		expect(runtimeErrors).toEqual([]);
		await expect(page.getByText("Final package")).toBeVisible();
		await expect(page.getByText("ffffffff...ffffff")).toBeVisible();
		await page.getByRole("button", { name: /^Approve$/ }).click();
		await expect(page.getByRole("alert")).toContainText(
			"Final package action blocked: Approving a final artifact requires production approval authority"
		);
		const attempts = await page.evaluate(() => window.__finalizationAttempts);
		expect(attempts).toEqual([
			{
				id: "proposal-doc-1",
				input: {
					action: "approve",
					format: "docx",
					approvalRole: "proposal_manager",
					reason: "Approve the rendered final package for submission",
				},
			},
		]);
		await expect(page.getByText("updated:0")).toBeVisible();
	});
});

async function bundleFinalizationHarness() {
	const result = await build({
		stdin: {
			contents: `
				import React from "react";
				import { createRoot } from "react-dom/client";
				import { ProposalDocumentList } from "@/components/proposals/ProposalDocumentList";

				const renderedArtifact = {
					format: "docx",
					filename: "technical-approach.docx",
					mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					size: 4096,
					artifactHash: "${"f".repeat(64)}",
					downloadUrl: "/api/v1/documents/doc-1/final-artifact?artifactHash=${"f".repeat(64)}",
					storagePath: "s3://mansa/proposal/final-artifacts/opp-1/proposal-doc-1/technical-approach.docx",
					storageBucket: "mansa",
					storageKey: "proposal/final-artifacts/opp-1/proposal-doc-1/technical-approach.docx",
					storageEtag: "\\"artifact-etag\\"",
					storageEndpoint: "https://objects.example.com",
					createdAt: new Date("2026-05-27T04:00:00.000Z"),
					createdBy: "proposal-manager-1",
					sourceDocumentVersion: 3,
					sourceContentHash: "${"c".repeat(64)}",
					responsePackageReadiness: {
						status: "ready_for_review",
						workflowId: "workflow-response-1",
						metrics: {
							acceptedRequirementCount: 2,
							draftedRequirementCount: 2,
							requirementCoverage: 1,
							reviewGateCoverage: 1,
							winThemeCoverage: 1,
							evidenceChecklistCoverage: 1,
							unresolvedPlaceholderCount: 0,
							documentsDrafted: 1,
							sectionsDrafted: 4,
							complianceEntriesCreated: 2,
						},
						blockers: [],
						warnings: [],
					},
				};

				const proposalDocument = {
					id: "proposal-doc-1",
					opportunityId: "opp-1",
					documentId: "doc-1",
					documentType: "technical_approach",
					sectionOrder: 1,
					status: "approved",
					assignedTo: "writer-1",
					dueDate: null,
					reviewerId: "reviewer-1",
					approvedBy: "proposal-manager-1",
					approvedAt: new Date("2026-05-27T03:00:00.000Z"),
					aiAnalysisScore: null,
					aiAnalysisAt: null,
					notes: null,
					renderedArtifact,
					finalArtifact: null,
					finalSubmissionSignoff: null,
					createdAt: new Date("2026-05-26T00:00:00.000Z"),
					updatedAt: new Date("2026-05-27T03:00:00.000Z"),
					document: {
						id: "doc-1",
						title: "Technical Approach",
						wordCount: 1200,
						status: "approved",
						updatedAt: new Date("2026-05-27T03:00:00.000Z"),
					},
				};

				const progress = {
					opportunityId: "opp-1",
					totalDocuments: 1,
					byStatus: {
						not_started: 0,
						drafting: 0,
						in_review: 0,
						revising: 0,
						approved: 1,
						final: 0,
					},
					completionPercentage: 80,
					documentsOnTrack: 1,
					documentsOverdue: 0,
					documentsAtRisk: 0,
					nextDeadline: null,
					averageAiScore: null,
				};

				function App() {
					const [updatedCount, setUpdatedCount] = React.useState(0);
					return React.createElement(
						React.Fragment,
						null,
						React.createElement(ProposalDocumentList, {
							documents: [proposalDocument],
							progress,
							responsePackageReadiness: renderedArtifact.responsePackageReadiness,
							onDocumentUpdate: () => setUpdatedCount((count) => count + 1),
						}),
						React.createElement("div", { id: "updated-count" }, "updated:" + updatedCount)
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
		plugins: [proposalDocumentActionStubPlugin(), nextLinkStubPlugin(), frontendAliasPlugin()],
	});
	return result.outputFiles[0].text;
}

function proposalDocumentActionStubPlugin(): Plugin {
	return {
		name: "proposal-document-action-stub",
		setup(esbuild) {
			esbuild.onResolve({ filter: /^@\/lib\/actions\/proposal-documents$/ }, () => ({
				path: "proposal-document-action-stub",
				namespace: "proposal-document-action-stub",
			}));
			esbuild.onLoad({ filter: /.*/, namespace: "proposal-document-action-stub" }, () => ({
				loader: "js",
				contents: `
					window.__finalizationAttempts = [];
					export async function transitionProposalDocumentFinalization(id, input) {
						window.__finalizationAttempts.push({ id, input });
						throw new Error("Approving a final artifact requires production approval authority");
					}
					export async function generateRequirementAwareProposalDraft() {
						return { sectionsDrafted: 0 };
					}
					export async function updateProposalDocumentStatus() {
						return null;
					}
					export async function unlinkProposalDocument() {
						return null;
					}
				`,
			}));
		},
	};
}

function nextLinkStubPlugin(): Plugin {
	return {
		name: "next-link-stub",
		setup(esbuild) {
			esbuild.onResolve({ filter: /^next\/link$/ }, () => ({
				path: "next-link-stub",
				namespace: "next-link-stub",
			}));
			esbuild.onLoad({ filter: /.*/, namespace: "next-link-stub" }, () => ({
				loader: "js",
				resolveDir: FRONTEND_ROOT,
				contents: `
					import React from "react";
					export default function Link({ href, children, ...props }) {
						return React.createElement("a", { href: typeof href === "string" ? href : "#", ...props }, children);
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
		__finalizationAttempts?: unknown[];
	}
}
