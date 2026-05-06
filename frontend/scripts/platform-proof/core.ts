import fs from "node:fs/promises";
import path from "node:path";

export type CleanupStatus =
	| "not-applicable"
	| "idempotent-noop"
	| "restored"
	| "cleanup-pending"
	| "cleanup-failed";

export type ProofDisposition = "pass" | "partial" | "blocked" | "fail";

export interface EvidenceRecord {
	facility: string;
	journey: string;
	run_id: string;
	artifact_ids: string[];
	topology_tier: string;
	verification_bucket: string;
	timestamp: string;
	operator: string;
	cleanup_status: CleanupStatus;
	disposition: ProofDisposition;
	notes: string;
}

export interface CleanupResult {
	id: string;
	kind: string;
	status: CleanupStatus;
	error?: string;
}

export interface CleanupRegistration {
	id: string;
	kind: string;
	cleanup: () => Promise<void>;
}

export class ProofCleanupRegistry {
	private readonly registrations: CleanupRegistration[] = [];

	register(registration: CleanupRegistration): void {
		this.registrations.push(registration);
	}

	async cleanupAll(): Promise<CleanupResult[]> {
		const results: CleanupResult[] = [];
		for (const registration of [...this.registrations].reverse()) {
			try {
				await registration.cleanup();
				results.push({
					id: registration.id,
					kind: registration.kind,
					status: "restored",
				});
			} catch (error) {
				results.push({
					id: registration.id,
					kind: registration.kind,
					status: "cleanup-failed",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return results;
	}
}

export function createProofRunId(prefix: string, now = new Date()): string {
	const stamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 15);
	return `${sanitizeRunPart(prefix)}_${stamp}Z`;
}

export function createProofLogDir(options: {
	workspaceRoot: string;
	runId: string;
	wave?: string;
}): string {
	const wavePrefix = options.wave ? `${sanitizeRunPart(options.wave)}-` : "";
	return path.resolve(
		options.workspaceRoot,
		".omx",
		"logs",
		"platform-completion",
		`${wavePrefix}${sanitizeRunPart(options.runId)}`,
	);
}

export function createProofObjectKey(runId: string, purpose: string, filename: string): string {
	return [
		"proof-runs",
		sanitizePathPart(runId),
		sanitizePathPart(purpose),
		sanitizeFilename(filename),
	].join("/");
}

export async function writeProofJson(logDir: string, filename: string, data: unknown): Promise<string> {
	await fs.mkdir(logDir, { recursive: true });
	const safeFilename = sanitizeFilename(filename);
	const filePath = path.join(logDir, safeFilename);
	await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
	return filePath;
}

export async function appendEvidenceRecords(
	evidencePath: string,
	records: EvidenceRecord[],
	options: {
		title?: string;
	} = {},
): Promise<void> {
	if (!records.length) return;
	await fs.mkdir(path.dirname(evidencePath), { recursive: true });
	const existing = await fs.readFile(evidencePath, "utf8").catch(() => "");
	const header = existing.trim()
		? ""
		: [
			`# ${options.title ?? "Platform Completion Evidence"}`,
			"",
			"| facility | journey | run_id | artifact_ids | topology_tier | verification_bucket | timestamp | operator | cleanup_status | disposition | notes |",
			"|---|---|---|---|---|---|---|---|---|---|---|",
			"",
		].join("\n");
	const rows = records.map(formatEvidenceRecord).join("\n");
	await fs.appendFile(evidencePath, `${header}${rows}\n`, "utf8");
}

export function formatEvidenceRecord(record: EvidenceRecord): string {
	const values = [
		record.facility,
		record.journey,
		`\`${record.run_id}\``,
		record.artifact_ids.map((id) => `\`${sanitizeTableCell(id)}\``).join(", "),
		record.topology_tier,
		record.verification_bucket,
		record.timestamp,
		record.operator,
		record.cleanup_status,
		record.disposition,
		record.notes,
	].map(sanitizeTableCell);
	return `| ${values.join(" | ")} |`;
}

export function summarizeCleanup(results: CleanupResult[]): CleanupStatus {
	if (!results.length) return "idempotent-noop";
	return results.some((result) => result.status === "cleanup-failed")
		? "cleanup-failed"
		: "restored";
}

function sanitizeRunPart(value: string): string {
	return value.trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "proof";
}

function sanitizePathPart(value: string): string {
	return sanitizeRunPart(value).slice(0, 160);
}

function sanitizeFilename(value: string): string {
	const sanitized = value.trim().replace(/[/\\?%*:|"<>]+/g, "-").replace(/\s+/g, "-");
	return sanitized || "proof.json";
}

function sanitizeTableCell(value: string): string {
	return value.replace(/\r?\n/g, " ").replace(/\|/g, "/");
}

