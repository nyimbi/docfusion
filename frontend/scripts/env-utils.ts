import fs from "node:fs";
import path from "node:path";

export function forceLocalEnv(
	keys: string[],
	envFile = process.env.DOCFUSION_SCRIPT_ENV_FILE || ".env.local"
): void {
	const filePath = path.resolve(process.cwd(), envFile);
	if (!fs.existsSync(filePath)) return;

	const wanted = new Set(keys);
	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const equalsAt = trimmed.indexOf("=");
		if (equalsAt <= 0) continue;

		const key = trimmed.slice(0, equalsAt).trim();
		if (!wanted.has(key)) continue;
		process.env[key] = unquoteEnvValue(trimmed.slice(equalsAt + 1).trim());
	}
}

function unquoteEnvValue(value: string): string {
	if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	return value;
}
