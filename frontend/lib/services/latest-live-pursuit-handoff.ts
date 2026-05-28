import fs from "node:fs/promises";
import path from "node:path";
import type { LatestLivePursuitHandoffIndex, LatestLivePursuitHandoffPayload } from "@/lib/types/latest-live-pursuit-handoff";

export class LatestLivePursuitHandoffNotFoundError extends Error {
	constructor(message = "Latest live pursuit handoff has not been generated") {
		super(message);
		this.name = "LatestLivePursuitHandoffNotFoundError";
	}
}

const LATEST_HANDOFF_JSON_RELATIVE_PATH = path.join(".omx", "state", "latest-live-pursuit-handoff.json");
const LATEST_HANDOFF_BRIEF_RELATIVE_PATH = path.join(".omx", "state", "latest-live-pursuit-handoff.md");

export async function readLatestLivePursuitHandoff(options: {
	workspaceRoot?: string;
} = {}): Promise<LatestLivePursuitHandoffPayload> {
	const workspaceRoot = options.workspaceRoot ?? resolveLatestHandoffWorkspaceRoot();
	const indexPath = path.resolve(workspaceRoot, LATEST_HANDOFF_JSON_RELATIVE_PATH);
	const briefPath = path.resolve(workspaceRoot, LATEST_HANDOFF_BRIEF_RELATIVE_PATH);

	try {
		const [rawIndex, operatorBriefMarkdown] = await Promise.all([
			fs.readFile(indexPath, "utf8"),
			fs.readFile(briefPath, "utf8"),
		]);
		const index = parseLatestHandoffIndex(rawIndex);
		if (!operatorBriefMarkdown.includes(index.runId) || !operatorBriefMarkdown.includes("## Execution Checklist")) {
			throw new Error("Latest live pursuit handoff brief does not match the indexed handoff");
		}

		return {
			index,
			operatorBriefMarkdown,
			actionStates: {},
			actionEvents: [],
			paths: {
				indexPath: path.relative(workspaceRoot, indexPath),
				briefPath: path.relative(workspaceRoot, briefPath),
			},
		};
	} catch (error) {
		if (isMissingPathError(error)) {
			throw new LatestLivePursuitHandoffNotFoundError();
		}
		throw error;
	}
}

export function resolveLatestHandoffWorkspaceRoot(): string {
	return path.basename(process.cwd()) === "frontend"
		? path.resolve(process.cwd(), "..")
		: process.cwd();
}

function parseLatestHandoffIndex(rawIndex: string): LatestLivePursuitHandoffIndex {
	const parsed = JSON.parse(rawIndex) as LatestLivePursuitHandoffIndex;
	if (!parsed.runId?.trim()) throw new Error("Latest live pursuit handoff index is missing runId");
	if (!parsed.primaryPursuit?.title?.trim()) throw new Error("Latest live pursuit handoff index is missing primary pursuit");
	if (!parsed.executionPlan?.tasks?.length) throw new Error("Latest live pursuit handoff index has no execution tasks");
	if (parsed.executionPlan.taskCount !== parsed.executionPlan.tasks.length) {
		throw new Error("Latest live pursuit handoff task count does not match task list");
	}
	return parsed;
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
