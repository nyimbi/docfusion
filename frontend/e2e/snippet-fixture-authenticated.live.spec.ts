import { expect, test, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:32133";

const FIXTURE_KEYS = {
	canonical: "snippet-context-single-link",
	metadataFallback: "snippet-context-metadata-fallback",
	ambiguous: "snippet-context-ambiguous",
};

function loadEnvFile(filePath: string) {
	if (!fs.existsSync(filePath)) return;
	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
		const index = trimmed.indexOf("=");
		const key = trimmed.slice(0, index).trim();
		let value = trimmed.slice(index + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadEnvFile(path.join(FRONTEND_ROOT, ".env"));
loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));

async function loadFixtureDocuments() {
	if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for live snippet fixture E2E");
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: { rejectUnauthorized: false },
	});
	try {
		const result = await pool.query<{
			id: string;
			fixtureKey: string;
			linkCount: number;
			distinctOpportunityCount: number;
		}>(`
			SELECT
				d.id::text AS id,
				d.metadata->>'fixtureKey' AS "fixtureKey",
				count(pd.id)::int AS "linkCount",
				count(DISTINCT pd.opportunity_id)::int AS "distinctOpportunityCount"
			FROM documents d
			LEFT JOIN proposal_documents pd ON pd.document_id = d.id
			WHERE d.metadata->>'fixtureKey' = ANY($1::text[])
			GROUP BY d.id, d.metadata
		`, [Object.values(FIXTURE_KEYS)]);
		return new Map(result.rows.map((row) => [row.fixtureKey, row]));
	} finally {
		await pool.end();
	}
}

async function addSessionCookie(context: BrowserContext) {
	const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
	if (!secret) throw new Error("NEXTAUTH_SECRET/AUTH_SECRET is required");
	const sessionCookie = await encode({
		secret,
		salt: "authjs.session-token",
		maxAge: 60 * 60,
		token: {
			name: "Fixture E2E User",
			email: "fixture-e2e@datacraft.local",
			sub: "fixture-e2e-keycloak-sub",
			keycloakSub: "fixture-e2e-keycloak-sub",
			localUserId: "fixture-e2e-user",
			organizationId: "fixture-e2e-org",
			role: "admin",
			roles: ["admin"],
			accessToken: "fixture-e2e-access-token",
			refreshToken: "fixture-e2e-refresh-token",
			idToken: "fixture-e2e-id-token",
			accessTokenExpires: Date.now() + 60 * 60 * 1000,
		},
	});
	await context.addCookies([
		{
			url: BASE_URL,
			name: "authjs.session-token",
			value: sessionCookie,
			httpOnly: true,
			sameSite: "Lax",
			expires: Math.floor(Date.now() / 1000) + 60 * 60,
		},
	]);
}

test("authenticated fixture documents expand Datacraft shortcut end to end", async ({ page, context }) => {
	test.skip(process.env.RUN_LIVE_SNIPPET_FIXTURE_E2E !== "1", "Set RUN_LIVE_SNIPPET_FIXTURE_E2E=1 for live fixture proof");
	test.setTimeout(180_000);
	await addSessionCookie(context);

	await page.goto(`${BASE_URL}/api/auth/session`);
	await expect(page.locator("body")).toContainText("fixture-e2e@datacraft.local");

	const fixtures = await loadFixtureDocuments();
	const canonical = fixtures.get(FIXTURE_KEYS.canonical);
	const metadataFallback = fixtures.get(FIXTURE_KEYS.metadataFallback);
	const ambiguous = fixtures.get(FIXTURE_KEYS.ambiguous);

	expect(canonical).toMatchObject({ linkCount: 1, distinctOpportunityCount: 1 });
	expect(metadataFallback).toMatchObject({ linkCount: 0, distinctOpportunityCount: 0 });
	expect(ambiguous).toMatchObject({ linkCount: 2, distinctOpportunityCount: 2 });

	const documents = [
		{
			key: "canonical",
			id: canonical!.id,
			expected: ["Single Link Fixture Ministry", "Datacraft Sovereign Intelligence Platform Response"],
			unresolved: false,
		},
		{
			key: "metadata-fallback",
			id: metadataFallback!.id,
			expected: ["Metadata Fallback Fixture Authority", "Datacraft Metadata Fallback Verification Response"],
			unresolved: false,
		},
		{
			key: "ambiguous",
			id: ambiguous!.id,
			expected: ["Ambiguous Fixture Client", "{{opportunity_name}}"],
			unresolved: true,
		},
	];

	const proof: Array<{ key: string; id: string; unresolvedHighlighted: number; text: string }> = [];
	for (const doc of documents) {
		await page.goto(`${BASE_URL}/documents/${doc.id}`, { waitUntil: "domcontentloaded" });
		expect(page.url(), `${doc.key} must not redirect to sign-in`).not.toContain("/auth/sign-in");

		const editor = page.locator(".ProseMirror").first();
		await expect(editor).toBeVisible({ timeout: 30_000 });
		await editor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type("/dc-exec-summary");
		await page.keyboard.press("Space");

		for (const text of doc.expected) {
			await expect(editor).toContainText(text, { timeout: 30_000 });
		}

		if (doc.unresolved) {
			await expect(page.locator('.unresolved-placeholder[data-placeholder="{{opportunity_name}}"]')).toHaveCount(1, {
				timeout: 10_000,
			});
		} else {
			await expect(editor).not.toContainText("{{opportunity_name}}");
		}

		proof.push({
			key: doc.key,
			id: doc.id,
			unresolvedHighlighted: doc.unresolved
				? await page.locator('.unresolved-placeholder[data-placeholder="{{opportunity_name}}"]').count()
				: 0,
			text: (await editor.innerText()).slice(0, 300),
		});
	}

	console.log(`AUTHENTICATED_FIXTURE_PROOF ${JSON.stringify(proof)}`);
});
