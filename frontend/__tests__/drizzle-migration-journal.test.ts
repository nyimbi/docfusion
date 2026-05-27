import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

describe("Drizzle migration journal", () => {
	it("lists every SQL migration in order with increasing timestamps", () => {
		const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
			entries: Array<{ idx: number; tag: string; when: number }>;
		};
		const migrationTags = fs.readdirSync(DRIZZLE_DIR)
			.filter((file) => file.endsWith(".sql"))
			.map((file) => path.basename(file, ".sql"))
			.sort();

		expect(journal.entries.map((entry) => entry.tag)).toEqual(migrationTags);
		expect(journal.entries.map((entry) => entry.idx)).toEqual(migrationTags.map((_, index) => index));

		for (let index = 1; index < journal.entries.length; index += 1) {
			expect(journal.entries[index].when).toBeGreaterThan(journal.entries[index - 1].when);
		}
	});
});
