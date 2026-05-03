import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Snippet expansion editor interactions", () => {
	test("expands known shortcuts and preserves unknown shortcuts", async ({ page }) => {
		await loadSnippetHarness(page);
		const editor = page.locator(".ProseMirror");

		await page.evaluate(() => window.__snippetHarness.setText("/dc-exec-summary"));
		expect(await page.evaluate(() => window.__snippetHarness.triggerTextInput(" "))).toBe(true);
		await expect(editor).toContainText("Expanded Datacraft narrative.");
		expect(await page.evaluate(() => window.__snippetHarness.editor.getText())).toBe(
			"Expanded Datacraft narrative."
		);

		await page.evaluate(() => window.__snippetHarness.reset());
		await page.evaluate(() => window.__snippetHarness.setText("/unknown"));
		expect(await page.evaluate(() => window.__snippetHarness.triggerTextInput(" "))).toBe(true);
		expect(await page.evaluate(() => window.__snippetHarness.editor.getText())).toBe("/unknown ");

		await page.evaluate(() => window.__snippetHarness.reset());
		const slashResult = await page.evaluate(() => window.__snippetHarness.triggerKeyDown("/"));
		await page.evaluate(() => window.__snippetHarness.setText("/"));
		expect(slashResult.handled).toBe(false);
		expect(await page.evaluate(() => window.__snippetHarness.slashCount)).toBe(1);
		expect(await page.evaluate(() => window.__snippetHarness.editor.getText())).toBe("/");
	});

	test("expands known Enter shortcuts and preserves unknown Enter shortcuts", async ({ page }) => {
		await loadSnippetHarness(page);
		const editor = page.locator(".ProseMirror");

		await page.evaluate(() => window.__snippetHarness.setText("/dc-exec-summary"));
		const enterResult = await page.evaluate(() => window.__snippetHarness.triggerKeyDown("Enter"));
		expect(enterResult.handled).toBe(true);
		expect(enterResult.defaultPrevented).toBe(true);
		await expect(editor).toContainText("Expanded Datacraft narrative.");
		const expandedShape = await page.evaluate(() => ({
			json: window.__snippetHarness.editor.getJSON(),
			selectionParent: window.__snippetHarness.editor.state.selection.$from.parent.type.name,
			selectionOffset: window.__snippetHarness.editor.state.selection.$from.parentOffset,
		}));
		const expandedContent = expandedShape.json.content ?? [];
		expect(expandedContent).toHaveLength(2);
		expect(expandedContent[0]).toMatchObject({
			type: "paragraph",
			content: [{ type: "text", text: "Expanded Datacraft narrative." }],
		});
		expect(expandedContent[1]).toMatchObject({ type: "paragraph" });
		expect(expandedShape.selectionParent).toBe("paragraph");
		expect(expandedShape.selectionOffset).toBe(0);

		await page.evaluate(() => window.__snippetHarness.reset());
		await page.evaluate(() => window.__snippetHarness.setText("/unknown"));
		const beforeUnknownEnter = await page.evaluate(() => window.__snippetHarness.editor.getJSON());
		const unknownEnterResult = await page.evaluate(() => window.__snippetHarness.triggerKeyDown("Enter"));
		expect(unknownEnterResult.handled).toBe(true);
		expect(unknownEnterResult.defaultPrevented).toBe(true);
		const unknownShape = await page.evaluate(() => ({
			text: window.__snippetHarness.editor.getText(),
			json: window.__snippetHarness.editor.getJSON(),
		}));
		expect(unknownShape.text).toContain("/unknown");
		expect(unknownShape.json).not.toEqual(beforeUnknownEnter);
		expect(unknownShape.json.content ?? []).toHaveLength(1);
		expect(unknownShape.json.content?.[0]).toMatchObject({
			type: "paragraph",
			content: [{ type: "text", text: "/unknown\n" }],
		});
	});
});

async function loadSnippetHarness(page: Page) {
	const script = await bundleSnippetHarness();
	await page.route("http://snippet-expansion.test/harness", async (route) => {
		await route.fulfill({
			contentType: "text/html",
			body: `<!doctype html><html><body><div id="editor"></div><script>${escapeScript(script)}</script></body></html>`,
		});
	});
	await page.goto("http://snippet-expansion.test/harness");
}

async function bundleSnippetHarness() {
	const result = await build({
		stdin: {
			contents: `
				import { Editor } from "@tiptap/core";
				import StarterKit from "@tiptap/starter-kit";
				import { TextSelection } from "@tiptap/pm/state";
				import { SnippetExpansion } from "@/components/editor/extensions/snippet-expansion";
				import { SlashCommandTrigger } from "@/components/editor/extensions/index";

				const snippet = {
					snippet: {
						id: "snippet-1",
						name: "Datacraft Executive Summary",
						shortcut: "/dc-exec-summary",
						tags: ["datacraft"],
						placeholders: [],
						useCount: 0,
						isPublic: true,
						createdBy: "system",
						createdAt: "2026-05-01T00:00:00.000Z",
						updatedAt: "2026-05-01T00:00:00.000Z",
					},
					content: {
						type: "doc",
						content: [{
							type: "paragraph",
							content: [{ type: "text", text: "Expanded Datacraft narrative." }],
						}],
					},
					plainTextPreview: "Expanded Datacraft narrative.",
				};

				const editor = new Editor({
					element: document.getElementById("editor"),
					extensions: [
						StarterKit,
						SlashCommandTrigger.configure({
							onSlashCommand: () => {
								window.__snippetHarness.slashCount += 1;
							},
						}),
						SnippetExpansion.configure({
							onShortcutExpand: async (shortcut) =>
								shortcut === "dc-exec-summary" ? snippet : null,
						}),
					],
					content: { type: "doc", content: [{ type: "paragraph" }] },
				});

				window.__snippetHarness = {
					editor,
					slashCount: 0,
					reset() {
						this.slashCount = 0;
						editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
						editor.commands.focus("end");
					},
					setText(text) {
						editor.commands.setContent({
							type: "doc",
							content: [{
								type: "paragraph",
								content: text ? [{ type: "text", text }] : [],
							}],
						});
						editor.view.dispatch(
							editor.state.tr.setSelection(TextSelection.atEnd(editor.state.doc))
						);
					},
					triggerTextInput(text) {
						const { from, to } = editor.state.selection;
						let handled = false;
						editor.view.someProp("handleTextInput", (handler) => {
							if (handler(editor.view, from, to, text)) {
								handled = true;
								return true;
							}
							return undefined;
						});
						return handled;
					},
					triggerKeyDown(key) {
						const event = new KeyboardEvent("keydown", {
							key,
							bubbles: true,
							cancelable: true,
						});
						let handled = false;
						editor.view.someProp("handleKeyDown", (handler) => {
							if (handler(editor.view, event)) {
								handled = true;
								return true;
							}
							return undefined;
						});
						return { handled, defaultPrevented: event.defaultPrevented };
					},
				};
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

declare global {
	interface Window {
		__snippetHarness: {
			editor: import("@tiptap/core").Editor;
			slashCount: number;
			reset: () => void;
			setText: (text: string) => void;
			triggerTextInput: (text: string) => boolean;
			triggerKeyDown: (key: string) => { handled: boolean; defaultPrevented: boolean };
		};
	}
}
