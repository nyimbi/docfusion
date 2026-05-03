import { DATACRAFT_RESPONSE_SNIPPETS } from "@/lib/data/datacraft-response-content";
import { db } from "@/lib/db";
import type { DocumentContent } from "@/lib/types/document";
import { sql } from "drizzle-orm";

export const SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE = "snippet-context-fixtures";
export const SNIPPET_CONTEXT_FIXTURE_LOCK_NAME = "snippet-context-fixtures";

export const SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS = {
	singleLink: "snippet-context-single-link",
	metadataFallback: "snippet-context-metadata-fallback",
	ambiguousA: "snippet-context-ambiguous-a",
	ambiguousB: "snippet-context-ambiguous-b",
} as const;

export const SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS = {
	singleLink: "snippet-context-single-link",
	metadataFallback: "snippet-context-metadata-fallback",
	ambiguous: "snippet-context-ambiguous",
} as const;

const OPPORTUNITY_FIXTURE_KEYS = Object.values(SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS);
const DOCUMENT_FIXTURE_KEYS = Object.values(SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS);

type FixtureBranch = "single-link" | "metadata-fallback" | "ambiguous";

export interface FixtureTargetInfo {
	host?: string;
	database?: string;
	productionLike: boolean;
	productionReasons: string[];
	urlPresent: boolean;
}

export interface EnsureSnippetContextFixturesOptions {
	allowProduction?: boolean;
	confirmHost?: string;
	targetInfo?: FixtureTargetInfo;
}

export interface FixtureDocumentAudit {
	id: string;
	fixtureKey: string;
	title: string;
	linkCount: number;
	distinctOpportunityCount: number;
	opportunityIds: string[];
}

export interface FixtureOpportunityAudit {
	id: string;
	fixtureKey: string;
	sourceId: string | null;
	sourceFile: string | null;
	organization: string | null;
	title: string;
}

export interface SnippetContextFixtureAudit {
	target: FixtureTargetInfo;
	totals: {
		documents: number;
		proposalDocumentLinks: number;
		singleLinkDocuments: number;
		ambiguousLinkDocuments: number;
		metadataFallbackDocuments: number;
		duplicateProposalDocumentPairs: number;
	};
	fixtures: {
		documents: FixtureDocumentAudit[];
		opportunities: FixtureOpportunityAudit[];
		duplicateDocumentKeys: Array<{ fixtureKey: string; count: number }>;
		duplicateOpportunityKeys: Array<{ fixtureKey: string; count: number }>;
		duplicateProposalDocumentPairs: Array<{ opportunityId: string; documentId: string; count: number }>;
	};
	manualVerificationUrls: Record<string, string>;
}

interface OpportunityFixtureDefinition {
	key: string;
	title: string;
	organization: string;
	deadline: string;
	rfpLink: string;
	budgetValue: string;
	metadata: Record<string, unknown>;
}

interface DocumentFixtureDefinition {
	key: string;
	branch: FixtureBranch;
	title: string;
	metadata: Record<string, unknown>;
	expectedOpportunityKeys: string[];
	content: DocumentContent;
	plainText: string;
	wordCount: number;
	characterCount: number;
}

type ExecuteQuery = Parameters<typeof db.execute>[0];

type ExecuteClient = {
	execute: (query: ExecuteQuery) => Promise<{ rows?: unknown[] } | unknown[] | unknown>;
	transaction?: <T>(callback: (tx: ExecuteClient) => Promise<T>) => Promise<T>;
};

function textNode(text: string) {
	return { type: "text", text };
}

function paragraph(text: string) {
	return { type: "paragraph", content: [textNode(text)] };
}

function heading(text: string) {
	return { type: "heading", attrs: { level: 1 }, content: [textNode(text)] };
}

function documentContent(title: string, paragraphs: string[]): DocumentContent {
	return {
		type: "doc",
		content: [heading(title), ...paragraphs.map(paragraph)],
	};
}

function extractText(value: unknown): string {
	if (!value || typeof value !== "object") return "";
	const node = value as { text?: unknown; content?: unknown };
	const ownText = typeof node.text === "string" ? node.text : "";
	const childText = Array.isArray(node.content) ? node.content.map(extractText).filter(Boolean).join(" ") : "";
	return [ownText, childText].filter(Boolean).join(" ").trim();
}

function countWords(value: string) {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

function withFixtureMetadata(key: string, metadata: Record<string, unknown>) {
	return {
		...metadata,
		fixtureKey: key,
		fixtureSource: SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE,
		fixturePurpose: "snippet-placeholder-context-verification",
	};
}

function buildDocumentFixture(input: {
	key: string;
	branch: FixtureBranch;
	title: string;
	metadata: Record<string, unknown>;
	expectedOpportunityKeys: string[];
	paragraphs: string[];
}): DocumentFixtureDefinition {
	const content = documentContent(input.title, input.paragraphs);
	const plainText = extractText(content);
	return {
		key: input.key,
		branch: input.branch,
		title: input.title,
		metadata: withFixtureMetadata(input.key, input.metadata),
		expectedOpportunityKeys: input.expectedOpportunityKeys,
		content,
		plainText,
		wordCount: countWords(plainText),
		characterCount: plainText.length,
	};
}

export function buildSnippetContextFixtureDefinitions() {
	const opportunityFixtures: OpportunityFixtureDefinition[] = [
		{
			key: SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.singleLink,
			title: "Datacraft Sovereign Intelligence Platform Response",
			organization: "Single Link Fixture Ministry",
			deadline: "2026-07-31T12:00:00.000Z",
			rfpLink: "https://example.test/rfps/single-link-fixture",
			budgetValue: "USD 2,400,000",
			metadata: withFixtureMetadata(SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.singleLink, {
				solicitationNumber: "SL-FIX-2026-001",
			}),
		},
		{
			key: SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.metadataFallback,
			title: "Datacraft Metadata Fallback Verification Response",
			organization: "Metadata Fallback Fixture Authority",
			deadline: "2026-08-14T12:00:00.000Z",
			rfpLink: "https://example.test/rfps/metadata-fallback-fixture",
			budgetValue: "USD 980,000",
			metadata: withFixtureMetadata(SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.metadataFallback, {
				solicitationNumber: "MF-FIX-2026-002",
			}),
		},
		{
			key: SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousA,
			title: "Datacraft Ambiguous Fixture Programme Alpha",
			organization: "Ambiguous Fixture Client Alpha",
			deadline: "2026-09-18T12:00:00.000Z",
			rfpLink: "https://example.test/rfps/ambiguous-fixture-alpha",
			budgetValue: "USD 1,750,000",
			metadata: withFixtureMetadata(SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousA, {
				solicitationNumber: "AMB-A-FIX-2026-003",
			}),
		},
		{
			key: SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousB,
			title: "Datacraft Ambiguous Fixture Programme Beta",
			organization: "Ambiguous Fixture Client Beta",
			deadline: "2026-10-02T12:00:00.000Z",
			rfpLink: "https://example.test/rfps/ambiguous-fixture-beta",
			budgetValue: "USD 1,950,000",
			metadata: withFixtureMetadata(SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousB, {
				solicitationNumber: "AMB-B-FIX-2026-004",
			}),
		},
	];

	const documentFixtures: DocumentFixtureDefinition[] = [
		buildDocumentFixture({
			key: SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.singleLink,
			branch: "single-link",
			title: "Snippet Fixture - Canonical Proposal Link",
			metadata: {
				clientName: "Single Link Fixture Document Client",
				rfpNumber: "DOC-SL-FIX-001",
				dueDate: "2026-07-31",
				projectValue: "USD 2,400,000",
			},
			expectedOpportunityKeys: [SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.singleLink],
			paragraphs: [
				"This reserved fixture document must resolve opportunity-scoped placeholders through exactly one proposal_documents link.",
				"Run the /dc-exec-summary shortcut here to verify canonical link precedence before relying on live proposal response flows.",
			],
		}),
		buildDocumentFixture({
			key: SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.metadataFallback,
			branch: "metadata-fallback",
			title: "Snippet Fixture - Metadata Opportunity Fallback",
			metadata: {
				clientName: "Metadata Fallback Fixture Document Client",
				rfpNumber: "DOC-MF-FIX-002",
				dueDate: "2026-08-14",
				projectValue: "USD 980,000",
			},
			expectedOpportunityKeys: [SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.metadataFallback],
			paragraphs: [
				"This reserved fixture document intentionally has no proposal_documents links.",
				"The script stamps metadata.opportunityId after the metadata fallback fixture opportunity is materialized.",
			],
		}),
		buildDocumentFixture({
			key: SNIPPET_CONTEXT_DOCUMENT_FIXTURE_KEYS.ambiguous,
			branch: "ambiguous",
			title: "Snippet Fixture - Ambiguous Proposal Links",
			metadata: {
				clientName: "Ambiguous Fixture Client",
				rfpNumber: "DOC-AMB-FIX-003",
				dueDate: "2026-10-02",
				projectValue: "USD 1,950,000",
			},
			expectedOpportunityKeys: [
				SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousA,
				SNIPPET_CONTEXT_OPPORTUNITY_FIXTURE_KEYS.ambiguousB,
			],
			paragraphs: [
				"This reserved fixture document intentionally links to two opportunities.",
				"Shortcut expansion should resolve document-scalar placeholders such as client_name and leave opportunity_name unresolved without explicit opportunity context.",
			],
		}),
	];

	return { opportunityFixtures, documentFixtures };
}

export function getSnippetFixtureTargetInfo(
	databaseUrl = process.env.DATABASE_URL,
	nodeEnv = process.env.NODE_ENV
): FixtureTargetInfo {
	const productionReasons: string[] = [];
	let host: string | undefined;
	let database: string | undefined;

	if (nodeEnv === "production") {
		productionReasons.push("NODE_ENV=production");
	}

	if (databaseUrl) {
		try {
			const url = new URL(databaseUrl);
			host = url.hostname;
			database = url.pathname.replace(/^\//, "") || undefined;
		} catch {
			productionReasons.push("DATABASE_URL could not be parsed");
		}
	}

	if (host?.includes("db.lindela.io")) {
		productionReasons.push("DATABASE_URL host contains db.lindela.io");
	}

	for (const value of [host, database]) {
		if (value && /prod|production/i.test(value)) {
			productionReasons.push("DATABASE_URL host/name contains prod or production");
			break;
		}
	}

	return {
		host,
		database,
		productionLike: productionReasons.length > 0,
		productionReasons,
		urlPresent: Boolean(databaseUrl),
	};
}

export function assertCanApplySnippetContextFixtures(options: EnsureSnippetContextFixturesOptions = {}) {
	const target = options.targetInfo ?? getSnippetFixtureTargetInfo();
	if (!target.urlPresent) {
		throw new Error("DATABASE_URL is required before snippet context fixtures can be applied.");
	}

	if (!target.productionLike) return;

	if (options.allowProduction) return;
	if (options.confirmHost && target.host && options.confirmHost === target.host) return;

	throw new Error(
		`Refusing to mutate production-like database target ${target.host ?? "unknown-host"}/${target.database ?? "unknown-db"}. ` +
			`Reasons: ${target.productionReasons.join(", ")}. Re-run with --allow-production or --confirm-host ${target.host ?? "<host>"}.`
	);
}

export function assertSingleFixtureMatch(kind: "document" | "opportunity", fixtureKey: string, matches: unknown[]) {
	if (matches.length > 1) {
		throw new Error(`Duplicate reserved ${kind} fixture key '${fixtureKey}' matched ${matches.length} rows.`);
	}
}

export function assertNoUnexpectedFixtureLinks(
	documentKey: string,
	expectedOpportunityIds: string[],
	actualOpportunityIds: string[]
) {
	const expected = new Set(expectedOpportunityIds);
	const unexpected = actualOpportunityIds.filter((opportunityId) => !expected.has(opportunityId));
	if (unexpected.length > 0) {
		throw new Error(
			`Reserved fixture document '${documentKey}' has unexpected proposal_documents links: ${unexpected.join(", ")}. ` +
				"Apply mode will not delete or normalize topology drift."
		);
	}
}

export function assertAppliedFixtureTopology(
	branch: FixtureBranch,
	documentKey: string,
	expectedOpportunityIds: string[],
	actualOpportunityIds: string[]
) {
	assertNoUnexpectedFixtureLinks(documentKey, expectedOpportunityIds, actualOpportunityIds);
	if (actualOpportunityIds.length !== new Set(actualOpportunityIds).size) {
		throw new Error(`Reserved fixture document '${documentKey}' has duplicate proposal_documents pairs.`);
	}
	const uniqueActual = [...new Set(actualOpportunityIds)];

	if (branch === "metadata-fallback" && uniqueActual.length !== 0) {
		throw new Error(`Metadata fallback fixture '${documentKey}' must have zero proposal_documents links.`);
	}

	if (branch === "single-link" && uniqueActual.length !== 1) {
		throw new Error(`Canonical fixture '${documentKey}' must have exactly one proposal_documents link.`);
	}

	if (branch === "ambiguous" && uniqueActual.length !== 2) {
		throw new Error(`Ambiguous fixture '${documentKey}' must have exactly two distinct proposal_documents links.`);
	}
}

export function getManualProofSnippetSeedContract() {
	const snippet = DATACRAFT_RESPONSE_SNIPPETS.find((candidate) => candidate.shortcut === "/dc-exec-summary");
	const content = snippet ? JSON.stringify(snippet.content) : "";
	return {
		exists: Boolean(snippet),
		containsClientName: content.includes("{{client_name}}"),
		containsOpportunityName: content.includes("{{opportunity_name}}"),
	};
}

function rowsFromResult<T>(result: unknown): T[] {
	if (Array.isArray(result)) return result as T[];
	if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) {
		return (result as { rows: T[] }).rows;
	}
	return [];
}

function fixtureKeyList(keys: string[]) {
	return sql.join(keys.map((key) => sql`${key}`), sql`, `);
}

async function selectDocumentMatches(client: ExecuteClient, key: string) {
	const result = await client.execute(sql`
		SELECT id::text AS id
		FROM documents
		WHERE metadata->>'fixtureKey' = ${key}
	`);
	return rowsFromResult<{ id: string }>(result);
}

async function selectOpportunityMatches(client: ExecuteClient, key: string) {
	const result = await client.execute(sql`
		SELECT id::text AS id
		FROM opportunities
		WHERE source_id = ${key}
			AND source_file = ${SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE}
	`);
	return rowsFromResult<{ id: string }>(result);
}

async function selectProposalLinks(client: ExecuteClient, documentId: string) {
	const result = await client.execute(sql`
		SELECT id::text AS id, opportunity_id::text AS "opportunityId"
		FROM proposal_documents
		WHERE document_id = ${documentId}
		ORDER BY opportunity_id
	`);
	return rowsFromResult<{ id: string; opportunityId: string }>(result);
}

async function selectDuplicateProposalPairs(client: ExecuteClient, documentId: string) {
	const result = await client.execute(sql`
		SELECT opportunity_id::text AS "opportunityId", document_id::text AS "documentId", count(*)::int AS count
		FROM proposal_documents
		WHERE document_id = ${documentId}
		GROUP BY opportunity_id, document_id
		HAVING count(*) > 1
	`);
	return rowsFromResult<{ opportunityId: string; documentId: string; count: number }>(result);
}

async function assertNoDuplicateProposalPairs(client: ExecuteClient, documentId: string, documentKey: string) {
	const duplicates = await selectDuplicateProposalPairs(client, documentId);
	if (duplicates.length > 0) {
		throw new Error(
			`Reserved fixture document '${documentKey}' has duplicate proposal_documents pairs: ` +
				duplicates.map((row) => `${row.opportunityId}/${row.documentId} (${row.count})`).join(", ")
		);
	}
}

async function upsertOpportunity(client: ExecuteClient, fixture: OpportunityFixtureDefinition) {
	const result = await client.execute(sql`
		INSERT INTO opportunities (
			source_id,
			source_file,
			title,
			category,
			it_category,
			sector,
			country_region,
			organization,
			deadline,
			budget_value,
			rfp_link,
			source_platform,
			opportunity_type,
			project_summary,
			key_requirements,
			submission_method,
			decision_status,
			is_reviewed,
			tags,
			metadata,
			updated_at,
			imported_at
		)
		VALUES (
			${fixture.key},
			${SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE},
			${fixture.title},
			'Snippet Context Verification',
			'Proposal Automation',
			'Verification',
			'Global',
			${fixture.organization},
			${fixture.deadline}::timestamptz,
			${fixture.budgetValue},
			${fixture.rfpLink},
			'fixture',
			'rfp',
			${`Reserved ${SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE} opportunity used to verify snippet placeholder resolution.`},
			'Exercise client_name, opportunity_name, solicitation_number, submission_date, rfp_url, and project_value placeholders.',
			'Electronic submission',
			'pipeline',
			true,
			${JSON.stringify(["fixture", "snippet-context", fixture.key])}::jsonb,
			${JSON.stringify(fixture.metadata)}::jsonb,
			now(),
			now()
		)
		ON CONFLICT (source_id, source_file)
		DO UPDATE SET
			title = EXCLUDED.title,
			category = EXCLUDED.category,
			it_category = EXCLUDED.it_category,
			sector = EXCLUDED.sector,
			country_region = EXCLUDED.country_region,
			organization = EXCLUDED.organization,
			deadline = EXCLUDED.deadline,
			budget_value = EXCLUDED.budget_value,
			rfp_link = EXCLUDED.rfp_link,
			source_platform = EXCLUDED.source_platform,
			opportunity_type = EXCLUDED.opportunity_type,
			project_summary = EXCLUDED.project_summary,
			key_requirements = EXCLUDED.key_requirements,
			submission_method = EXCLUDED.submission_method,
			decision_status = EXCLUDED.decision_status,
			is_reviewed = EXCLUDED.is_reviewed,
			tags = EXCLUDED.tags,
			metadata = EXCLUDED.metadata,
			updated_at = now()
		RETURNING id::text AS id
	`);
	const [row] = rowsFromResult<{ id: string }>(result);
	if (!row?.id) throw new Error(`Failed to upsert opportunity fixture '${fixture.key}'.`);
	return row.id;
}

async function upsertDocument(client: ExecuteClient, fixture: DocumentFixtureDefinition, metadata: Record<string, unknown>) {
	const existing = await selectDocumentMatches(client, fixture.key);
	assertSingleFixtureMatch("document", fixture.key, existing);

	if (existing[0]?.id) {
		const result = await client.execute(sql`
			UPDATE documents
			SET
				title = ${fixture.title},
				content = ${JSON.stringify(fixture.content)}::jsonb,
				plain_text = ${fixture.plainText},
				tags = ${JSON.stringify(["fixture", "snippet-context", fixture.branch])}::jsonb,
				word_count = ${fixture.wordCount},
				character_count = ${fixture.characterCount},
				metadata = ${JSON.stringify(metadata)}::jsonb,
				updated_at = now()
			WHERE id = ${existing[0].id}
			RETURNING id::text AS id
		`);
		const [row] = rowsFromResult<{ id: string }>(result);
		if (!row?.id) throw new Error(`Failed to update document fixture '${fixture.key}'.`);
		return row.id;
	}

	const result = await client.execute(sql`
		INSERT INTO documents (
			title,
			content,
			plain_text,
			status,
			visibility,
			owner_id,
			tags,
			word_count,
			character_count,
			metadata,
			updated_at
		)
		VALUES (
			${fixture.title},
			${JSON.stringify(fixture.content)}::jsonb,
			${fixture.plainText},
			'draft',
			'private',
			'system',
			${JSON.stringify(["fixture", "snippet-context", fixture.branch])}::jsonb,
			${fixture.wordCount},
			${fixture.characterCount},
			${JSON.stringify(metadata)}::jsonb,
			now()
		)
		RETURNING id::text AS id
	`);
	const [row] = rowsFromResult<{ id: string }>(result);
	if (!row?.id) throw new Error(`Failed to insert document fixture '${fixture.key}'.`);
	return row.id;
}

async function insertMissingProposalLinks(
	client: ExecuteClient,
	fixture: DocumentFixtureDefinition,
	documentId: string,
	opportunityIds: string[]
) {
	if (fixture.branch === "metadata-fallback") return;

	for (const [index, opportunityId] of opportunityIds.entries()) {
		await client.execute(sql`
			INSERT INTO proposal_documents (
				opportunity_id,
				document_id,
				document_type,
				section_order,
				status,
				due_date,
				notes,
				updated_at
			)
			VALUES (
				${opportunityId},
				${documentId},
				'technical',
				${index + 1},
				'in_progress',
				now() + interval '30 days',
				${`Reserved ${SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE} link for ${fixture.branch} branch verification.`},
				now()
			)
			ON CONFLICT (opportunity_id, document_id) DO NOTHING
		`);
	}
}

async function assertNoFixtureDuplicates(client: ExecuteClient) {
	for (const key of OPPORTUNITY_FIXTURE_KEYS) {
		const matches = await selectOpportunityMatches(client, key);
		assertSingleFixtureMatch("opportunity", key, matches);
	}
	for (const key of DOCUMENT_FIXTURE_KEYS) {
		const matches = await selectDocumentMatches(client, key);
		assertSingleFixtureMatch("document", key, matches);
	}
}

export async function withSnippetContextFixtureApplyLock<T>(
	client: ExecuteClient,
	callback: (tx: ExecuteClient) => Promise<T>
) {
	if (!client.transaction) {
		throw new Error("Snippet context fixture apply requires a transaction-capable database client.");
	}

	return client.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${SNIPPET_CONTEXT_FIXTURE_LOCK_NAME}))`);
		return callback(tx);
	});
}

export async function auditSnippetContextFixtures(client: ExecuteClient = db): Promise<SnippetContextFixtureAudit> {
	const target = getSnippetFixtureTargetInfo();
	const [totalsResult, documentResult, opportunityResult, duplicateDocumentResult, duplicateOpportunityResult, duplicatePairResult] =
		await Promise.all([
			client.execute(sql`
				WITH doc_link_counts AS (
					SELECT
						d.id,
						count(pd.id)::int AS link_count,
						count(DISTINCT pd.opportunity_id)::int AS distinct_opportunity_count,
						d.metadata->>'opportunityId' AS metadata_opportunity_id
					FROM documents d
					LEFT JOIN proposal_documents pd ON pd.document_id = d.id
					GROUP BY d.id, d.metadata
				)
				SELECT
					(SELECT count(*)::int FROM documents) AS documents,
					(SELECT count(*)::int FROM proposal_documents) AS "proposalDocumentLinks",
					count(*) FILTER (WHERE link_count = 1)::int AS "singleLinkDocuments",
					count(*) FILTER (WHERE distinct_opportunity_count > 1)::int AS "ambiguousLinkDocuments",
					count(*) FILTER (WHERE link_count = 0 AND metadata_opportunity_id IS NOT NULL)::int AS "metadataFallbackDocuments"
				FROM doc_link_counts
			`),
			client.execute(sql`
				SELECT
					d.id::text AS id,
					d.metadata->>'fixtureKey' AS "fixtureKey",
					d.title,
					count(pd.id)::int AS "linkCount",
					count(DISTINCT pd.opportunity_id)::int AS "distinctOpportunityCount",
					COALESCE(array_remove(array_agg(DISTINCT pd.opportunity_id::text), NULL), ARRAY[]::text[]) AS "opportunityIds"
				FROM documents d
				LEFT JOIN proposal_documents pd ON pd.document_id = d.id
				WHERE d.metadata->>'fixtureKey' IN (${fixtureKeyList(DOCUMENT_FIXTURE_KEYS)})
				GROUP BY d.id, d.title, d.metadata
				ORDER BY "fixtureKey"
			`),
			client.execute(sql`
				SELECT
					id::text AS id,
					metadata->>'fixtureKey' AS "fixtureKey",
					source_id AS "sourceId",
					source_file AS "sourceFile",
					organization,
					title
				FROM opportunities
				WHERE source_file = ${SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE}
					AND source_id IN (${fixtureKeyList(OPPORTUNITY_FIXTURE_KEYS)})
				ORDER BY source_id
			`),
			client.execute(sql`
				SELECT metadata->>'fixtureKey' AS "fixtureKey", count(*)::int AS count
				FROM documents
				WHERE metadata->>'fixtureKey' IN (${fixtureKeyList(DOCUMENT_FIXTURE_KEYS)})
				GROUP BY metadata->>'fixtureKey'
				HAVING count(*) > 1
			`),
			client.execute(sql`
				SELECT source_id AS "fixtureKey", count(*)::int AS count
				FROM opportunities
				WHERE source_file = ${SNIPPET_CONTEXT_FIXTURE_SOURCE_FILE}
					AND source_id IN (${fixtureKeyList(OPPORTUNITY_FIXTURE_KEYS)})
				GROUP BY source_id
				HAVING count(*) > 1
			`),
			client.execute(sql`
				SELECT opportunity_id::text AS "opportunityId", document_id::text AS "documentId", count(*)::int AS count
				FROM proposal_documents
				GROUP BY opportunity_id, document_id
				HAVING count(*) > 1
			`),
		]);

	const [totals] = rowsFromResult<SnippetContextFixtureAudit["totals"]>(totalsResult);
	const documents = rowsFromResult<FixtureDocumentAudit>(documentResult);
	const manualVerificationUrls = Object.fromEntries(
		documents.map((document) => [document.fixtureKey, `/documents/${document.id}`])
	);
	const duplicateProposalDocumentPairs = rowsFromResult<{
		opportunityId: string;
		documentId: string;
		count: number;
	}>(duplicatePairResult);

	return {
		target,
		totals: {
			documents: Number(totals?.documents ?? 0),
			proposalDocumentLinks: Number(totals?.proposalDocumentLinks ?? 0),
			singleLinkDocuments: Number(totals?.singleLinkDocuments ?? 0),
			ambiguousLinkDocuments: Number(totals?.ambiguousLinkDocuments ?? 0),
			metadataFallbackDocuments: Number(totals?.metadataFallbackDocuments ?? 0),
			duplicateProposalDocumentPairs: duplicateProposalDocumentPairs.length,
		},
		fixtures: {
			documents,
			opportunities: rowsFromResult<FixtureOpportunityAudit>(opportunityResult),
			duplicateDocumentKeys: rowsFromResult<Array<{ fixtureKey: string; count: number }>[number]>(duplicateDocumentResult),
			duplicateOpportunityKeys: rowsFromResult<Array<{ fixtureKey: string; count: number }>[number]>(duplicateOpportunityResult),
			duplicateProposalDocumentPairs,
		},
		manualVerificationUrls,
	};
}

export async function ensureSnippetContextFixtures(
	options: EnsureSnippetContextFixturesOptions = {},
	client: ExecuteClient = db
) {
	const target = options.targetInfo ?? getSnippetFixtureTargetInfo();
	assertCanApplySnippetContextFixtures({ ...options, targetInfo: target });
	const definitions = buildSnippetContextFixtureDefinitions();

	const result = await withSnippetContextFixtureApplyLock(client, async (tx) => {
		await assertNoFixtureDuplicates(tx);

		const opportunityIds = new Map<string, string>();
		for (const fixture of definitions.opportunityFixtures) {
			const opportunityId = await upsertOpportunity(tx, fixture);
			opportunityIds.set(fixture.key, opportunityId);
		}

		const documentIds = new Map<string, string>();
		for (const fixture of definitions.documentFixtures) {
			const expectedOpportunityIds = fixture.expectedOpportunityKeys.map((key) => {
				const opportunityId = opportunityIds.get(key);
				if (!opportunityId) throw new Error(`Missing opportunity fixture '${key}' while creating document '${fixture.key}'.`);
				return opportunityId;
			});
			const metadata = {
				...fixture.metadata,
				...(fixture.branch === "metadata-fallback" ? { opportunityId: expectedOpportunityIds[0] } : {}),
			};
			const documentId = await upsertDocument(tx, fixture, metadata);
			await assertNoDuplicateProposalPairs(tx, documentId, fixture.key);
			const existingLinks = await selectProposalLinks(tx, documentId);
			assertNoUnexpectedFixtureLinks(
				fixture.key,
				fixture.branch === "metadata-fallback" ? [] : expectedOpportunityIds,
				existingLinks.map((link) => link.opportunityId)
			);
			await insertMissingProposalLinks(tx, fixture, documentId, expectedOpportunityIds);
			await assertNoDuplicateProposalPairs(tx, documentId, fixture.key);
			const finalLinks = await selectProposalLinks(tx, documentId);
			assertAppliedFixtureTopology(
				fixture.branch,
				fixture.key,
				fixture.branch === "metadata-fallback" ? [] : expectedOpportunityIds,
				finalLinks.map((link) => link.opportunityId)
			);
			documentIds.set(fixture.key, documentId);
		}

		return { opportunityIds, documentIds };
	});

	const audit = await auditSnippetContextFixtures(client);
	return {
		target,
		...result,
		audit,
	};
}
