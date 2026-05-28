import fs from "node:fs/promises";
import path from "node:path";
import type {
	LatestLivePursuitHandoffArtifactContent,
	LatestLivePursuitHandoffArtifactKind,
	LatestLivePursuitHandoffArtifactLink,
	LatestLivePursuitHandoffIndex,
	LatestLivePursuitHandoffPayload,
} from "@/lib/types/latest-live-pursuit-handoff";

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
		const artifactLinks = await readLatestHandoffArtifactLinks(workspaceRoot, index);

		return {
			index,
			operatorBriefMarkdown,
			artifactLinks,
			actionStates: {},
			actionEvents: [],
			actionReadiness: {
				status: "blocked",
				taskCount: index.executionPlan.taskCount,
				completedTaskCount: 0,
				blockedTaskIds: [],
				pendingTaskIds: index.executionPlan.tasks.map((task) => task.id),
				criticalIncompleteTaskIds: index.executionPlan.tasks
					.filter((task) => task.priority === "critical")
					.map((task) => task.id),
				missingEvidenceTaskIds: [],
				reasons: [
					`${index.executionPlan.taskCount} handoff tasks still require operator action`,
					`${index.executionPlan.criticalTaskCount} critical tasks must be completed before submission`,
				],
			},
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

export async function readLatestLivePursuitHandoffArtifactContent(input: {
	artifactPath: string;
	workspaceRoot?: string;
}): Promise<LatestLivePursuitHandoffArtifactContent> {
	const requestedPath = input.artifactPath.trim();
	if (!requestedPath) throw new Error("artifact path is required");

	const workspaceRoot = input.workspaceRoot ?? resolveLatestHandoffWorkspaceRoot();
	const handoff = await readLatestLivePursuitHandoff({ workspaceRoot });
	const artifact = handoff.artifactLinks.find((candidate) => candidate.path === requestedPath);
	if (!artifact) throw new Error("Requested artifact is not part of the latest live handoff");

	const resolvedPath = path.resolve(workspaceRoot, artifact.path);
	const resolvedRoot = path.resolve(workspaceRoot);
	if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
		throw new Error("Requested artifact path escapes the workspace");
	}

	return {
		artifact,
		content: await fs.readFile(resolvedPath, "utf8"),
		contentType: contentTypeForArtifactPath(artifact.path),
		filename: path.basename(artifact.path),
	};
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

async function readLatestHandoffArtifactLinks(
	workspaceRoot: string,
	index: LatestLivePursuitHandoffIndex,
): Promise<LatestLivePursuitHandoffArtifactLink[]> {
	const handoffLinks = index.handoffArtifactPaths.map((artifactPath) => artifactLink({
		path: artifactPath,
		kind: "handoff",
		label: labelForArtifactPath(artifactPath),
		title: index.primaryPursuit.title,
		sourceRunId: index.runId,
		sourceKind: "handoff",
	}));
	const handoffJsonPath = index.handoffArtifactPaths.find((artifactPath) => artifactPath.endsWith(".json"));
	if (!handoffJsonPath) return handoffLinks;

	try {
		const rawHandoff = await fs.readFile(path.resolve(workspaceRoot, handoffJsonPath), "utf8");
		const handoff = JSON.parse(rawHandoff) as LatestHandoffArtifactSource;
		return [
			...handoffLinks,
			...artifactLinksForOpportunity(handoff.primaryPursuit, "primary_response"),
			...(handoff.reviewQueue ?? []).flatMap((opportunity) => [
				...artifactLinksForOpportunity(opportunity, "review_response"),
				...artifactLinksForQualification(opportunity),
			]),
		];
	} catch (error) {
		if (isMissingPathError(error)) return handoffLinks;
		throw error;
	}
}

function artifactLinksForOpportunity(
	opportunity: LatestHandoffArtifactOpportunity | undefined,
	kind: Extract<LatestLivePursuitHandoffArtifactKind, "primary_response" | "review_response">,
): LatestLivePursuitHandoffArtifactLink[] {
	if (!opportunity) return [];
	return (opportunity.responseArtifactPaths ?? []).map((artifactPath) => artifactLink({
		path: artifactPath,
		kind,
		label: labelForArtifactPath(artifactPath),
		title: opportunity.title,
		sourceRunId: opportunity.runId,
		sourceKind: opportunity.sourceKind,
	}));
}

function artifactLinksForQualification(
	opportunity: LatestHandoffArtifactOpportunity,
): LatestLivePursuitHandoffArtifactLink[] {
	return [
		...(opportunity.qualificationArtifactPaths ?? []).map((artifactPath) => artifactLink({
			path: artifactPath,
			kind: "qualification_package" as const,
			label: labelForArtifactPath(artifactPath),
			title: opportunity.title,
			sourceRunId: opportunity.runId,
			sourceKind: opportunity.sourceKind,
		})),
		...(opportunity.qualificationWorkflow?.artifactPaths ?? []).map((artifactPath) => artifactLink({
			path: artifactPath,
			kind: "qualification_workflow" as const,
			label: labelForArtifactPath(artifactPath),
			title: opportunity.title,
			sourceRunId: opportunity.runId,
			sourceKind: opportunity.sourceKind,
		})),
	];
}

function artifactLink(input: LatestLivePursuitHandoffArtifactLink): LatestLivePursuitHandoffArtifactLink {
	return input;
}

function labelForArtifactPath(artifactPath: string): string {
	const basename = path.basename(artifactPath);
	return basename
		.replace(/\.(json|md)$/u, "")
		.replace(/[-_]+/gu, " ")
		.replace(/\b\w/gu, (match) => match.toUpperCase());
}

function contentTypeForArtifactPath(artifactPath: string): string {
	if (artifactPath.endsWith(".json")) return "application/json; charset=utf-8";
	if (artifactPath.endsWith(".md")) return "text/markdown; charset=utf-8";
	return "text/plain; charset=utf-8";
}

interface LatestHandoffArtifactSource {
	primaryPursuit?: LatestHandoffArtifactOpportunity;
	reviewQueue?: LatestHandoffArtifactOpportunity[];
}

interface LatestHandoffArtifactOpportunity {
	runId: string;
	sourceKind: string;
	title: string;
	responseArtifactPaths?: string[];
	qualificationArtifactPaths?: string[];
	qualificationWorkflow?: {
		artifactPaths?: string[];
	};
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
