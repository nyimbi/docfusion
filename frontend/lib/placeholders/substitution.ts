import type { SnippetPlaceholder, SnippetUnresolvedPlaceholder } from "@/lib/types/snippets";

export type PlaceholderValue = string | number | boolean | string[] | null | undefined;
export type PlaceholderValues = Record<string, PlaceholderValue>;

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g;

function stringifyPlaceholderValue(value: Exclude<PlaceholderValue, null | undefined>): string {
	return Array.isArray(value) ? value.join(", ") : String(value);
}

export function normalizePlaceholderKey(value: string): string {
	return value.replace(/^\s*\{\{\s*/, "").replace(/\s*\}\}\s*$/, "").trim();
}

export function toPlaceholderToken(key: string): string {
	return `{{${normalizePlaceholderKey(key)}}}`;
}

export function normalizePlaceholderDefinitions(placeholders: SnippetPlaceholder[] = []): SnippetPlaceholder[] {
	return placeholders.map((placeholder) => {
		const key = normalizePlaceholderKey(
			placeholder.key ?? placeholder.variableName ?? placeholder.id
		);
		return {
			...placeholder,
			id: placeholder.id || key,
			key,
			variableName: key,
		};
	});
}

export function substitutePlaceholdersInString(
	text: string,
	values: PlaceholderValues
): { text: string; unresolved: SnippetUnresolvedPlaceholder[] } {
	const unresolved: SnippetUnresolvedPlaceholder[] = [];
	const replaced = text.replace(PLACEHOLDER_PATTERN, (token, rawKey) => {
		const key = normalizePlaceholderKey(rawKey);
		const value = values[key] ?? values[rawKey];
		if (value === undefined || value === null) {
			unresolved.push({ token, key, path: "" });
			return token;
		}
		return stringifyPlaceholderValue(value);
	});

	return { text: replaced, unresolved };
}

export function substitutePlaceholders<T>(
	content: T,
	values: PlaceholderValues
): { content: T; unresolved: SnippetUnresolvedPlaceholder[] } {
	const unresolved: SnippetUnresolvedPlaceholder[] = [];

	const visit = (node: unknown, path: string): unknown => {
		if (typeof node === "string") {
			const result = substitutePlaceholdersInString(node, values);
			unresolved.push(
				...result.unresolved.map((item) => ({
					...item,
					path,
				}))
			);
			return result.text;
		}
		if (Array.isArray(node)) {
			return node.map((item, index) => visit(item, `${path}[${index}]`));
		}
		if (node && typeof node === "object") {
			const record = node as Record<string, unknown>;
			return Object.fromEntries(
				Object.entries(record).map(([key, value]) => [
					key,
					visit(value, path ? `${path}.${key}` : key),
				])
			);
		}
		return node;
	};

	return {
		content: visit(content, "") as T,
		unresolved,
	};
}

export function findUnresolvedPlaceholders(content: unknown): SnippetUnresolvedPlaceholder[] {
	return substitutePlaceholders(content, {}).unresolved;
}
