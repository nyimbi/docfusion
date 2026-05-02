import fs from "node:fs";
import path from "node:path";

const loadedKeys = new Set<string>();

for (const filename of [".env", ".env.local"]) {
	const filePath = path.resolve(process.cwd(), filename);
	if (!fs.existsSync(filePath)) continue;

	const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const equalsAt = trimmed.indexOf("=");
		if (equalsAt <= 0) continue;

		const key = trimmed.slice(0, equalsAt).trim();
		const value = unquote(trimmed.slice(equalsAt + 1).trim());
		if (process.env[key] === undefined || loadedKeys.has(key)) {
			process.env[key] = value;
			loadedKeys.add(key);
		}
	}
}

function unquote(value: string) {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	return value;
}
