import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
	getLinodeE3ConfigFromEnv: vi.fn(),
	downloadFromLinodeE3: vi.fn(),
}));

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: { select: ReturnType<typeof vi.fn> };

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/storage/linode-e3", () => storageMock);
vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
	},
}));

import { GET } from "@/app/api/v1/documents/[documentId]/final-artifact/route";

const artifactBytes = Buffer.from("approved final proposal");
const artifactHash = createHash("sha256").update(artifactBytes).digest("hex");
const documentSource = {
	title: "Technical Approach",
	content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Final content" }] }] },
	plainText: "Final content",
	currentVersion: 4,
};
const sourceContentHash = createHash("sha256")
	.update(JSON.stringify({
		title: documentSource.title,
		content: documentSource.content,
		plainText: documentSource.plainText,
	}))
	.digest("hex");

function finalArtifact(overrides: Record<string, unknown> = {}) {
	return {
		artifactHash,
		filename: "technical-approach.docx",
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		storagePath: "s3://mansa/proposal/final-artifacts/opp-1/pd-1/technical-approach.docx",
		approvedBy: "proposal-manager-1",
		approvedAt: "2026-05-05T01:00:00.000Z",
		sourceDocumentVersion: documentSource.currentVersion,
		sourceContentHash,
		...overrides,
	};
}

function documentRow(metadata: unknown) {
	return {
		...documentSource,
		metadata,
	};
}

function request(hash: string = artifactHash) {
	return new NextRequest(`https://app.test/api/v1/documents/doc-1/final-artifact?artifactHash=${hash}`);
}

function params() {
	return { params: Promise.resolve({ documentId: "doc-1" }) };
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({ user: { id: "user-1" } });
	storageMock.getLinodeE3ConfigFromEnv.mockReturnValue({
		endpoint: "https://objects.example.com",
		region: "gb-lon-1",
		bucket: "mansa",
		accessKeyId: "access-key",
		secretAccessKey: "secret-key",
	});
	storageMock.downloadFromLinodeE3.mockResolvedValue({
		body: artifactBytes,
		contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		etag: "\"artifact-etag\"",
	});
});

describe("final artifact download route", () => {
	it("streams an approved artifact when the source receipt matches the current document", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [documentRow({ finalArtifact: finalArtifact() })],
		}));

		const response = await GET(request(), params());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		);
		expect(response.headers.get("etag")).toBe("\"artifact-etag\"");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(artifactBytes);
		expect(storageMock.downloadFromLinodeE3).toHaveBeenCalledWith(
			expect.any(Object),
			"s3://mansa/proposal/final-artifacts/opp-1/pd-1/technical-approach.docx"
		);
	});

	it("rejects a stale artifact before object storage download", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [documentRow({
				finalArtifact: finalArtifact({
					sourceDocumentVersion: documentSource.currentVersion - 1,
				}),
			})],
		}));

		const response = await GET(request(), params());

		expect(response.status).toBe(409);
		expect(await response.text()).toContain("requires re-rendering");
		expect(storageMock.downloadFromLinodeE3).not.toHaveBeenCalled();
	});

	it("rejects final artifacts missing approval receipts before object storage download", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [documentRow({
				finalArtifact: finalArtifact({
					approvedBy: undefined,
				}),
			})],
		}));

		const response = await GET(request(), params());

		expect(response.status).toBe(409);
		expect(storageMock.downloadFromLinodeE3).not.toHaveBeenCalled();
	});
});
