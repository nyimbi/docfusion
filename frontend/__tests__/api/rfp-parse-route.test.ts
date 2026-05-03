import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

interface ChainConfig {
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["where"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	return chain;
}

const dbMock = vi.hoisted(() => ({
	query: {
		rfpDocuments: {
			findFirst: vi.fn(),
		},
	},
	update: vi.fn(),
	insert: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({
	getLinodeE3ConfigFromEnv: vi.fn(),
}));

const parserMock = vi.hoisted(() => ({
	processRfpParsingJob: vi.fn(),
	transitionRfpParseWorkflow: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: vi.fn(async () => ({
		user: { id: "capture-user", email: "capture@example.test" },
	})),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/storage/linode-e3", () => storageMock);
vi.mock("@/lib/actions/rfp-parser", () => parserMock);

import { POST } from "@/app/api/v1/rfp/[rfpId]/parse/route";

function parseRequest(rfpId = "00000000-0000-4000-8000-000000000601") {
	return new NextRequest(`http://localhost/api/v1/rfp/${rfpId}/parse`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ options: { classifyRequirements: false } }),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	storageMock.getLinodeE3ConfigFromEnv.mockReturnValue({
		endpoint: "https://gb-lon-1.linodeobjects.com",
		region: "gb-lon-1",
		bucket: "mansa",
		accessKeyId: "access-key",
		secretAccessKey: "secret-key",
	});
	dbMock.update.mockImplementation(() => createChain());
	dbMock.insert.mockImplementation(() =>
		createChain({ result: [{ id: "00000000-0000-4000-8000-000000000701" }] })
	);
	parserMock.processRfpParsingJob.mockResolvedValue(undefined);
	parserMock.transitionRfpParseWorkflow.mockResolvedValue({
		rfpDocumentId: "00000000-0000-4000-8000-000000000601",
		jobId: "00000000-0000-4000-8000-000000000702",
		state: "queued",
		progress: 0,
	});
});

describe("RFP parse route", () => {
	it("parses frontend/E3-backed RFP documents locally instead of proxying to Python", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000601",
			parsingStatus: "pending",
		});

		const response = await POST(parseRequest(), {
			params: Promise.resolve({ rfpId: "00000000-0000-4000-8000-000000000601" }),
		});

		expect(response.status).toBe(202);
		expect(await response.json()).toMatchObject({
			parsingJobId: "00000000-0000-4000-8000-000000000701",
			status: "queued",
		});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(parserMock.processRfpParsingJob).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000701",
			"00000000-0000-4000-8000-000000000601"
		);
	});

	it("keeps the legacy Python proxy only for unknown documents without E3 config", async () => {
		storageMock.getLinodeE3ConfigFromEnv.mockReturnValue(null);
		dbMock.query.rfpDocuments.findFirst.mockResolvedValue(null);
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			parsingJobId: "python-job",
			status: "queued",
		}), {
			status: 202,
			headers: { "content-type": "application/json" },
		}));
		vi.stubGlobal("fetch", fetchMock);

		const response = await POST(parseRequest("external-rfp"), {
			params: Promise.resolve({ rfpId: "external-rfp" }),
		});

		expect(response.status).toBe(202);
		expect(await response.json()).toMatchObject({ parsingJobId: "python-job" });
		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:8000/api/v1/rfp/external-rfp/parse",
			expect.objectContaining({ method: "POST" })
		);
		expect(parserMock.processRfpParsingJob).not.toHaveBeenCalled();
	});
});
