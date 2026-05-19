import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const internalWorkflowModules = [
	"lib/actions/workflow-runtime.ts",
	"lib/actions/workflow-audit.ts",
];

describe("server action boundaries", () => {
	it("keeps internal workflow helpers out of the public server action surface", () => {
		for (const relativePath of internalWorkflowModules) {
			const source = readFileSync(relativePath, "utf8");

			expect(source).not.toMatch(/^\s*["']use server["'];?/m);
		}
	});
});
