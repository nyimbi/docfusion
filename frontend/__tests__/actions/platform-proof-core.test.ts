import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	ProofCleanupRegistry,
	appendEvidenceRecords,
	createProofLogDir,
	createProofObjectKey,
	createProofRunId,
	formatEvidenceRecord,
	summarizeCleanup,
	writeProofJson,
	type EvidenceRecord,
} from "@/scripts/platform-proof/core";

const evidenceRecord: EvidenceRecord = {
	facility: "F-000",
	journey: "J0",
	run_id: "wave0_20260506T000000Z",
	artifact_ids: ["object:proof|unsafe", "log:proof.json"],
	topology_tier: "local",
	verification_bucket: "unit",
	timestamp: "2026-05-06T00:00:00.000Z",
	operator: "Ralph",
	cleanup_status: "restored",
	disposition: "pass",
	notes: "Line one\nline two with | pipe",
};

describe("platform proof core", () => {
	it("creates stable proof run ids and storage keys with safe namespaces", () => {
		const runId = createProofRunId("wave 0 proof", new Date("2026-05-06T00:01:02.345Z"));
		expect(runId).toBe("wave_0_proof_20260506T000102Z");

		expect(createProofObjectKey(runId, "Linode E3 readback", "../rfp file?.pdf")).toBe(
			"proof-runs/wave_0_proof_20260506T000102Z/Linode_E3_readback/..-rfp-file-.pdf",
		);

		expect(createProofLogDir({
			workspaceRoot: "/repo",
			runId,
			wave: "wave 0",
		})).toBe(path.resolve("/repo/.omx/logs/platform-completion/wave_0-wave_0_proof_20260506T000102Z"));
	});

	it("formats and appends evidence rows with markdown-safe cells", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "docfusion-proof-"));
		const evidencePath = path.join(tmp, "evidence.md");

		expect(formatEvidenceRecord(evidenceRecord)).toContain("Line one line two with / pipe");
		expect(formatEvidenceRecord(evidenceRecord)).toContain("object:proof/unsafe");

		await appendEvidenceRecords(evidencePath, [evidenceRecord], { title: "Proof Evidence" });
		const content = await fs.readFile(evidencePath, "utf8");
		expect(content).toContain("# Proof Evidence");
		expect(content).toContain("| facility | journey | run_id | artifact_ids |");
		expect(content).toContain("| F-000 | J0 | `wave0_20260506T000000Z` |");
	});

	it("writes proof JSON and summarizes cleanup outcomes", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "docfusion-proof-"));
		const filePath = await writeProofJson(tmp, "proof/result.json", { ok: true });
		expect(filePath).toBe(path.join(tmp, "proof-result.json"));
		await expect(fs.readFile(filePath, "utf8")).resolves.toContain('"ok": true');

		const registry = new ProofCleanupRegistry();
		const cleaned: string[] = [];
		registry.register({
			id: "first",
			kind: "row",
			cleanup: async () => {
				cleaned.push("first");
			},
		});
		registry.register({
			id: "second",
			kind: "object",
			cleanup: async () => {
				cleaned.push("second");
			},
		});

		const results = await registry.cleanupAll();
		expect(cleaned).toEqual(["second", "first"]);
		expect(summarizeCleanup(results)).toBe("restored");
		expect(summarizeCleanup([])).toBe("idempotent-noop");
	});
});

