import { db, documents, opportunities, proposalDocuments, rfpRequirements } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SnippetResolutionDiagnostic } from "@/lib/types/snippets";

export interface SnippetPlaceholderContextInput {
	documentId?: string;
	opportunityId?: string;
	requirementId?: string;
	requirementText?: string;
}

export interface SnippetPlaceholderContext {
	values: Record<string, string | number | boolean | string[]>;
	valueSources: Record<string, string>;
	diagnostics: SnippetResolutionDiagnostic[];
	resolvedOpportunityId?: string;
	documentMetadata?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function stringValue(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

function setValue(
	values: Record<string, string | number | boolean | string[]>,
	sources: Record<string, string>,
	key: string,
	value: unknown,
	source: string
) {
	const normalized = stringValue(value);
	if (normalized === undefined || values[key] !== undefined) return;
	values[key] = normalized;
	sources[key] = source;
}

function formatDate(value: unknown): string | undefined {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	return stringValue(value);
}

export async function loadSnippetPlaceholderContext(
	input: SnippetPlaceholderContextInput
): Promise<SnippetPlaceholderContext> {
	const values: Record<string, string | number | boolean | string[]> = {};
	const valueSources: Record<string, string> = {};
	const diagnostics: SnippetResolutionDiagnostic[] = [];

	let documentRow: Pick<typeof documents.$inferSelect, "id" | "title" | "metadata"> | null = null;
	let documentMetadata: Record<string, unknown> = {};
	let resolvedOpportunityId = input.opportunityId;
	let hasAmbiguousOpportunityLinks = false;

	if (input.documentId) {
		const [row] = await db
			.select({
				id: documents.id,
				title: documents.title,
				metadata: documents.metadata,
			})
			.from(documents)
			.where(eq(documents.id, input.documentId))
			.limit(1);

		documentRow = row ?? null;
		documentMetadata = asRecord(row?.metadata);

		const links = await db
			.select({
				id: proposalDocuments.id,
				opportunityId: proposalDocuments.opportunityId,
			})
			.from(proposalDocuments)
			.where(eq(proposalDocuments.documentId, input.documentId));

		const linkedOpportunityIds = [...new Set(links.map((link) => link.opportunityId))];

		if (input.opportunityId) {
			if (links.length > 0 && !linkedOpportunityIds.includes(input.opportunityId)) {
				diagnostics.push({
					code: "explicitOpportunityLinkMismatch",
					message: "Explicit opportunity context does not match this document's proposal links.",
					details: {
						explicitOpportunityId: input.opportunityId,
						candidateOpportunityIds: linkedOpportunityIds,
					},
				});
			}
		} else if (linkedOpportunityIds.length === 1) {
			resolvedOpportunityId = linkedOpportunityIds[0];
		} else if (linkedOpportunityIds.length > 1) {
			hasAmbiguousOpportunityLinks = true;
			diagnostics.push({
				code: "ambiguousOpportunityLink",
				message: "Document is linked to multiple opportunities; opportunity-scoped placeholders require explicit opportunity context.",
				details: {
					candidates: links.map((link) => ({
						proposalDocumentId: link.id,
						opportunityId: link.opportunityId,
					})),
				},
			});
		} else {
			resolvedOpportunityId = stringValue(documentMetadata.opportunityId);
		}
	}

	let requirementOpportunityId: string | undefined;
	if (input.requirementId) {
		const [requirement] = await db
			.select({
				opportunityId: rfpRequirements.opportunityId,
				requirementNumber: rfpRequirements.requirementNumber,
				requirementText: rfpRequirements.requirementText,
			})
			.from(rfpRequirements)
			.where(eq(rfpRequirements.id, input.requirementId))
			.limit(1);

		if (requirement) {
			requirementOpportunityId = requirement.opportunityId ?? undefined;
			setValue(values, valueSources, "requirement_number", requirement.requirementNumber, "requirement.requirementNumber");
			setValue(values, valueSources, "requirement_text", input.requirementText ?? requirement.requirementText, input.requirementText ? "request.requirementText" : "requirement.requirementText");
		}
	} else {
		setValue(values, valueSources, "requirement_text", input.requirementText, "request.requirementText");
	}

	if (!resolvedOpportunityId && requirementOpportunityId) {
		resolvedOpportunityId = requirementOpportunityId;
	}

	let opportunityRow: typeof opportunities.$inferSelect | null = null;
	if (resolvedOpportunityId) {
		const [row] = await db
			.select()
			.from(opportunities)
			.where(eq(opportunities.id, resolvedOpportunityId))
			.limit(1);
		opportunityRow = row ?? null;
	}

	if (opportunityRow) {
		setValue(values, valueSources, "client_name", opportunityRow.organization, "opportunity.organization");
		setValue(values, valueSources, "opportunity_name", opportunityRow.title, "opportunity.title");
		setValue(values, valueSources, "submission_date", formatDate(opportunityRow.deadline), "opportunity.deadline");
		setValue(values, valueSources, "rfp_url", opportunityRow.rfpLink, "opportunity.rfpLink");
		setValue(values, valueSources, "project_value", opportunityRow.budgetValue, "opportunity.budgetValue");

		const opportunityMetadata = asRecord(opportunityRow.metadata);
		setValue(
			values,
			valueSources,
			"solicitation_number",
			opportunityMetadata.solicitationNumber ??
				opportunityMetadata.solicitation_number ??
				opportunityMetadata.rfpNumber ??
				opportunityMetadata.rfp_number,
			"opportunity.metadata"
		);
	}

	if (documentRow) {
		setValue(values, valueSources, "client_name", documentMetadata.clientName, "document.metadata.clientName");
		setValue(values, valueSources, "solicitation_number", documentMetadata.rfpNumber, "document.metadata.rfpNumber");
		setValue(values, valueSources, "submission_date", documentMetadata.dueDate, "document.metadata.dueDate");
		setValue(values, valueSources, "project_value", documentMetadata.projectValue, "document.metadata.projectValue");
		if (!hasAmbiguousOpportunityLinks) {
			setValue(values, valueSources, "opportunity_name", documentRow.title, "document.title");
		}
	}

	return {
		values,
		valueSources,
		diagnostics,
		resolvedOpportunityId: opportunityRow?.id ?? resolvedOpportunityId,
		documentMetadata,
	};
}
