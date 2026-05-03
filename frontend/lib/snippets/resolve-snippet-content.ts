"use server";

import { db, templateSnippets } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { DocumentContent } from "@/lib/types/document";
import type {
	AdaptResolvedSnippetRequest,
	AdaptResolvedSnippetResult,
	ResolveSnippetContentRequest,
	ResolveSnippetContentResult,
	SnippetPlaceholder,
} from "@/lib/types/snippets";
import { getAllTemplateVariables } from "@/lib/actions/company-variables";
import {
	normalizePlaceholderDefinitions,
	normalizePlaceholderKey,
	substitutePlaceholders,
	type PlaceholderValue,
} from "@/lib/placeholders/substitution";
import { loadSnippetPlaceholderContext } from "@/lib/placeholders/context-resolution";
import {
	extractPlainTextFromContent,
	normalizeSnippetContent,
	normalizeSnippetPayload,
} from "@/lib/snippets/content-normalization";
import { chat } from "@/lib/ai/client";

function formatShortcut(shortcut: string): string {
	return shortcut.startsWith("/") ? shortcut : `/${shortcut}`;
}

function isResolvedValue(value: PlaceholderValue): value is string | number | boolean | string[] {
	return value !== undefined && value !== null;
}

function setIfAvailable(
	values: Record<string, string | number | boolean | string[]>,
	sources: Record<string, string>,
	key: string,
	value: PlaceholderValue,
	source: string
) {
	const normalizedKey = normalizePlaceholderKey(key);
	if (values[normalizedKey] !== undefined || !isResolvedValue(value)) return;
	values[normalizedKey] = value;
	sources[normalizedKey] = source;
}

async function loadSnippetFromRequest(request: ResolveSnippetContentRequest): Promise<{
	id?: string;
	shortcut?: string;
	content: DocumentContent;
	placeholders: SnippetPlaceholder[];
} | null> {
	if (request.content) {
		return {
			id: request.snippetId,
			shortcut: request.shortcut,
			content: normalizeSnippetContent(request.content),
			placeholders: normalizePlaceholderDefinitions(request.placeholders ?? []),
		};
	}

	const where = request.snippetId
		? eq(templateSnippets.id, request.snippetId)
		: request.shortcut
			? eq(templateSnippets.shortcut, formatShortcut(request.shortcut))
			: undefined;

	if (!where) return null;

	const [snippet] = await db.select().from(templateSnippets).where(where).limit(1);
	if (!snippet) return null;

	return {
		id: snippet.id,
		shortcut: snippet.shortcut,
		content: normalizeSnippetContent(snippet.content),
		placeholders: normalizePlaceholderDefinitions((snippet.placeholders ?? []) as SnippetPlaceholder[]),
	};
}

export async function resolveSnippetContent(
	request: ResolveSnippetContentRequest
): Promise<ResolveSnippetContentResult> {
	const snippet = await loadSnippetFromRequest(request);
	if (!snippet) {
		throw new Error("Snippet content was not provided and no snippet matched the request");
	}

	const placeholderMetadata = normalizePlaceholderDefinitions([
		...snippet.placeholders,
		...(request.placeholders ?? []),
	]);
	const originalContent = normalizeSnippetContent(snippet.content);

	const resolvedValues: Record<string, string | number | boolean | string[]> = {};
	const valueSources: Record<string, string> = {};

	for (const [key, value] of Object.entries(request.placeholderValues ?? {})) {
		setIfAvailable(resolvedValues, valueSources, key, value, "request.placeholderValues");
	}

	if (request.requirementText) {
		setIfAvailable(resolvedValues, valueSources, "requirement_text", request.requirementText, "request.requirementText");
	}

	const context = await loadSnippetPlaceholderContext({
		documentId: request.documentId,
		opportunityId: request.opportunityId,
		requirementId: request.requirementId,
		requirementText: request.requirementText,
	});

	for (const [key, value] of Object.entries(context.values)) {
		setIfAvailable(resolvedValues, valueSources, key, value, context.valueSources[key] ?? "context");
	}

	const companyVariables = await getAllTemplateVariables();
	for (const [key, value] of Object.entries(companyVariables)) {
		setIfAvailable(resolvedValues, valueSources, key, value, "company.variables");
	}

	for (const placeholder of placeholderMetadata) {
		const key = normalizePlaceholderKey(placeholder.key ?? placeholder.variableName ?? placeholder.id);
		setIfAvailable(
			resolvedValues,
			valueSources,
			key,
			placeholder.defaultValue,
			"placeholder.defaultValue"
		);
	}

	const substituted = substitutePlaceholders(originalContent, resolvedValues);
	const payload = normalizeSnippetPayload(substituted.content);

	return {
		snippetId: snippet.id ?? request.snippetId,
		shortcut: snippet.shortcut ?? request.shortcut,
		originalContent,
		resolvedContent: payload.content,
		plainTextPreview: payload.plainTextPreview,
		unresolvedPlaceholders: substituted.unresolved,
		resolvedValues,
		valueSources,
		placeholderMetadata,
		diagnostics: context.diagnostics,
	};
}

function documentFromText(text: string): DocumentContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: text ? [{ type: "text", text }] : [],
			},
		],
	};
}

export async function adaptResolvedSnippet(
	request: AdaptResolvedSnippetRequest
): Promise<AdaptResolvedSnippetResult> {
	const { resolved, richContext, useAI = true } = request;
	const sourceText = extractPlainTextFromContent(resolved.resolvedContent).trim();
	const contextParts = [
		richContext.sectionTitle ? `Section: ${richContext.sectionTitle}` : "",
		richContext.requirementText ? `Requirement: ${richContext.requirementText}` : "",
		richContext.surroundingText ? `Surrounding text: ${richContext.surroundingText}` : "",
		richContext.proposalTone ? `Tone: ${richContext.proposalTone}` : "",
	].filter(Boolean);

	if (!useAI || contextParts.length === 0 || !sourceText) {
		return {
			adaptedContent: resolved.resolvedContent,
			plainTextPreview: resolved.plainTextPreview,
			unresolvedPlaceholders: resolved.unresolvedPlaceholders,
			adaptationNotes: ["No rich adaptation context supplied; deterministic resolved content preserved."],
			diagnostics: resolved.diagnostics,
		};
	}

	const prompt = [
		"You are adapting a reusable RFP response snippet after deterministic placeholder substitution.",
		"Improve narrative flow, requirement relevance, context awareness, and continuity with surrounding section text.",
		"Preserve all resolved client, opportunity, RFP, date, URL, and project-value facts exactly.",
		"Do not invent values for unresolved {{placeholder}} tokens; keep them unchanged.",
		"Return only the adapted prose, with no headings unless they already belong naturally.",
		"",
		"Context:",
		...contextParts,
		"",
		"Resolved snippet:",
		sourceText,
	].join("\n");

	try {
		const response = await chat(
			[
				{
					role: "system",
					content:
						"You are a proposal-writing assistant. Produce polished, context-aware prose while preserving deterministic facts and unresolved placeholder tokens.",
				},
				{ role: "user", content: prompt },
			],
			{ temperature: 0.35, maxTokens: 1600 }
		);

		const adaptedText = response.content.trim();
		if (!adaptedText) {
			throw new Error("AI returned empty adaptation");
		}

		const adaptedContent = documentFromText(adaptedText);
		return {
			adaptedContent,
			plainTextPreview: adaptedText,
			unresolvedPlaceholders: resolved.unresolvedPlaceholders,
			adaptationNotes: [
				"Adapted after deterministic placeholder resolution.",
				richContext.requirementText ? "Used selected requirement text." : "No requirement text supplied.",
				richContext.surroundingText ? "Used surrounding text for continuity." : "No surrounding text supplied.",
			],
			diagnostics: resolved.diagnostics,
		};
	} catch (error) {
		return {
			adaptedContent: resolved.resolvedContent,
			plainTextPreview: resolved.plainTextPreview,
			unresolvedPlaceholders: resolved.unresolvedPlaceholders,
			adaptationNotes: [
				"AI adaptation was unavailable; deterministic resolved content preserved.",
			],
			diagnostics: [
				...resolved.diagnostics,
				{
					code: "aiAdaptationUnavailable",
					message: error instanceof Error ? error.message : "AI adaptation failed",
				},
			],
		};
	}
}
