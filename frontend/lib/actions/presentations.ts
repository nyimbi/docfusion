/**
 * Oral Presentation Server Actions - DocFusion
 *
 * Comprehensive server actions for managing oral presentations,
 * including slide generation, Q&A preparation, practice recordings,
 * team management, timing validation, and export functionality.
 *
 * Designed for government RFP oral presentations with AI-powered
 * content generation and analysis capabilities.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
	oralPresentations,
	presentationSlides,
	presentationQA,
	practiceRecordings,
	presentationTeam,
	type OralPresentation,
	type NewOralPresentation,
	type PresentationSlide,
	type NewPresentationSlide,
	type PresentationQA as DBPresentationQA,
	type NewPresentationQA,
	type PracticeRecording,
	type NewPracticeRecording,
	type PresentationTeamMember,
	type NewPresentationTeamMember,
} from "@/lib/db/schema-presentations";
import { opportunities, proposalDocuments, documents } from "@/lib/db/schema";
import { rfpRequirements } from "@/lib/db/schema-rfp";
import { eq, and, or, ilike, desc, asc, sql, inArray, gte, lte, type SQL } from "drizzle-orm";
import { complete } from "@/lib/ai/client";
import { logger } from "@/lib/utils/logger";
import { requireUserContext } from "@/lib/auth-utils";

// ============================================================================
// Types
// ============================================================================

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
type PresentationActionContext = { userId: string; organizationId: string };

interface SlideContent {
	type: "text" | "bullet" | "image" | "chart" | "table" | "video" | "code" | "quote";
	data: unknown;
	position?: { x: number; y: number; width: number; height: number };
}

interface EvaluationCriterion {
	criterion: string;
	weight: number;
	description: string;
}

interface PacingAnalysis {
	averageWPM: number;
	variationScore: number;
	tooFastSegments: { startTime: number; endTime: number }[];
	tooSlowSegments: { startTime: number; endTime: number }[];
	pauseScore: number;
}

interface ContentCoverage {
	slideId: string;
	slideNumber: number;
	covered: boolean;
	duration: number;
	targetDuration: number;
	coverageScore: number;
}

interface FillerWordCount {
	word: string;
	count: number;
	timestamps: number[];
}

interface SupportingEvidence {
	evidence: string;
	source: string;
	slideId?: string;
}

interface PresentationExportDeck {
	title: string;
	description?: string | null;
	presentationDate?: Date | string | null;
	venue?: string | null;
	isVirtual?: boolean | null;
	theme?: string | null;
	customBranding?: {
		primaryColor?: string;
		secondaryColor?: string;
		logoUrl?: string;
		fontFamily?: string;
	} | null;
	slides: Array<{
		slideNumber: number;
		slideType?: string | null;
		title?: string | null;
		content?: unknown;
		speakerNotes?: string | null;
		layout?: string | null;
		backgroundImage?: string | null;
		backgroundColor?: string | null;
	}>;
	team: Array<{
		name: string;
		role?: string | null;
		assignedSlideIds?: unknown;
	}>;
}

interface PresentationExportArtifact {
	downloadUrl: string;
	filename: string;
	mimeType: string;
}

async function requirePresentationContext(): Promise<PresentationActionContext> {
	const context = await requireUserContext();
	if (!context.organizationId) {
		throw new Error("Organization context required");
	}
	return {
		userId: context.userId,
		organizationId: context.organizationId,
	};
}

function scopedPresentationWhere(id: string, organizationId: string) {
	return and(
		eq(oralPresentations.id, id),
		eq(oralPresentations.organizationId, organizationId)
	);
}

function assignedOpportunityCondition(context: PresentationActionContext): SQL {
	return sql`(
		opportunities.organization_id = ${context.organizationId}
		or opportunities.organization_id is null
	)
	and opportunities.assigned_to = ${context.userId}`;
}

function assignedOpportunityExistsSql(opportunityId: unknown, context: PresentationActionContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (
				opportunities.organization_id = ${context.organizationId}
				or opportunities.organization_id is null
			)
			and opportunities.assigned_to = ${context.userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, context: PresentationActionContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityCondition(context)
	)!;
}

function visibleRequirementsForOpportunityCondition(opportunityId: string, context: PresentationActionContext): SQL {
	return and(
		eq(rfpRequirements.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, context)
	)!;
}

function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function safeCssColor(value: string | null | undefined, fallback: string): string {
	const normalized = value?.trim();
	if (!normalized) return fallback;
	return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(normalized) ? normalized : fallback;
}

function safeFontFamily(value: string | null | undefined): string {
	const normalized = value?.trim();
	if (!normalized) return "Inter, Arial, sans-serif";
	return /^[a-z0-9 ,.'"-]{1,80}$/i.test(normalized) ? normalized : "Inter, Arial, sans-serif";
}

function toBase64DataUrl(mimeType: string, content: string | ArrayBuffer | Uint8Array): string {
	const buffer = typeof content === "string"
		? Buffer.from(content, "utf8")
		: Buffer.from(content instanceof Uint8Array ? content : new Uint8Array(content));
	return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function plainTextFromSlideContent(content: unknown): string[] {
	if (!Array.isArray(content)) return [];

	const lines: string[] = [];
	for (const item of content as SlideContent[]) {
		if (!item || typeof item !== "object") continue;
		if (item.type === "bullet" && Array.isArray(item.data)) {
			lines.push(...item.data.map((value) => `- ${String(value)}`));
		} else if (item.type === "text" || item.type === "quote" || item.type === "code") {
			lines.push(String(item.data ?? ""));
		} else if (item.type === "table" && Array.isArray(item.data)) {
			lines.push(...(item.data as unknown[]).map((row) => Array.isArray(row) ? row.join(" | ") : String(row)));
		} else if (item.type === "chart") {
			lines.push(`Chart: ${JSON.stringify(item.data)}`);
		} else if (item.type === "image") {
			lines.push(`Image: ${String(item.data ?? "")}`);
		}
	}
	return lines.map((line) => line.trim()).filter(Boolean);
}

function buildPresentationHtml(deck: PresentationExportDeck): string {
	const primary = safeCssColor(deck.customBranding?.primaryColor, "#1f2937");
	const secondary = safeCssColor(deck.customBranding?.secondaryColor, "#2563eb");
	const fontFamily = safeFontFamily(deck.customBranding?.fontFamily);
	const slides = deck.slides
		.filter((slide) => slide.slideType !== "backup")
		.map((slide) => {
			const body = plainTextFromSlideContent(slide.content)
				.map((line) => `<p>${escapeHtml(line)}</p>`)
				.join("\n");
			const notes = slide.speakerNotes
				? `<aside><strong>Speaker notes</strong><p>${escapeHtml(slide.speakerNotes)}</p></aside>`
				: "";
			const backgroundColor = safeCssColor(slide.backgroundColor, "");
			const background = backgroundColor
				? ` style="background:${backgroundColor}"`
				: "";
			return `
				<section class="slide"${background}>
					<div class="slide-number">Slide ${slide.slideNumber}</div>
					<h2>${escapeHtml(slide.title ?? `Slide ${slide.slideNumber}`)}</h2>
					<div class="content">${body || "<p>No slide body content.</p>"}</div>
					${notes}
				</section>
			`;
		})
		.join("\n");
	const team = deck.team.length
		? `<section class="team"><h2>Presentation Team</h2><ul>${deck.team.map((member) => `<li>${escapeHtml(member.name)}${member.role ? ` - ${escapeHtml(member.role)}` : ""}</li>`).join("")}</ul></section>`
		: "";

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${escapeHtml(deck.title)}</title>
	<style>
		body { margin: 0; font-family: ${fontFamily}; color: #111827; background: #f8fafc; }
		header { padding: 40px 56px; background: ${primary}; color: #fff; }
		header p { max-width: 900px; line-height: 1.5; }
		.meta { color: #dbeafe; font-size: 14px; }
		.slide { min-height: 560px; margin: 24px auto; padding: 44px 56px; max-width: 1120px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); page-break-after: always; }
		.slide-number { color: ${secondary}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
		h1 { margin: 0 0 12px; font-size: 36px; }
		h2 { margin: 10px 0 24px; font-size: 30px; }
		p { font-size: 18px; line-height: 1.55; }
		aside { margin-top: 28px; padding: 16px; border-left: 4px solid ${secondary}; background: #eff6ff; }
		.team { max-width: 1120px; margin: 24px auto 48px; padding: 32px 56px; background: #fff; border: 1px solid #e5e7eb; }
		@media print { body { background: #fff; } .slide { box-shadow: none; margin: 0; border: 0; } }
	</style>
</head>
<body>
	<header>
		<h1>${escapeHtml(deck.title)}</h1>
		${deck.description ? `<p>${escapeHtml(deck.description)}</p>` : ""}
		<p class="meta">${escapeHtml(deck.isVirtual ? "Virtual presentation" : deck.venue ?? "")}${deck.presentationDate ? ` ${escapeHtml(new Date(deck.presentationDate).toLocaleDateString())}` : ""}</p>
	</header>
	${slides}
	${team}
</body>
</html>`;
}

async function buildPresentationPdf(deck: PresentationExportDeck): Promise<ArrayBuffer> {
	const { jsPDF } = await import("jspdf");
	const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();

	deck.slides.forEach((slide, index) => {
		if (index > 0) pdf.addPage();
		pdf.setFillColor(248, 250, 252);
		pdf.rect(0, 0, pageWidth, pageHeight, "F");
		pdf.setFont("helvetica", "bold");
		pdf.setFontSize(index === 0 ? 26 : 22);
		pdf.text(slide.title ?? deck.title, 48, 70, { maxWidth: pageWidth - 96 });
		pdf.setFont("helvetica", "normal");
		pdf.setFontSize(13);
		let y = 118;
		for (const line of plainTextFromSlideContent(slide.content)) {
			const wrapped = pdf.splitTextToSize(line, pageWidth - 96) as string[];
			pdf.text(wrapped, 58, y);
			y += wrapped.length * 17 + 8;
			if (y > pageHeight - 76) break;
		}
		if (slide.speakerNotes && y < pageHeight - 90) {
			pdf.setFont("helvetica", "bold");
			pdf.text("Speaker notes", 58, y + 12);
			pdf.setFont("helvetica", "normal");
			const wrappedNotes = pdf.splitTextToSize(slide.speakerNotes, pageWidth - 96) as string[];
			pdf.text(wrappedNotes.slice(0, 4), 58, y + 32);
		}
		pdf.setFontSize(10);
		pdf.text(`Slide ${slide.slideNumber}`, pageWidth - 92, pageHeight - 28);
	});

	return pdf.output("arraybuffer");
}

async function buildPresentationPptx(deck: PresentationExportDeck): Promise<string | ArrayBuffer | Uint8Array> {
	const { default: PptxGenJS } = await import("pptxgenjs");
	const pptx = new PptxGenJS();
	pptx.author = "DocFusion";
	pptx.company = "DocFusion";
	pptx.subject = deck.description ?? "Oral presentation";
	pptx.title = deck.title;
	pptx.layout = "LAYOUT_WIDE";
	pptx.theme = {
		headFontFace: safeFontFamily(deck.customBranding?.fontFamily),
		bodyFontFace: safeFontFamily(deck.customBranding?.fontFamily),
	};

	for (const sourceSlide of deck.slides) {
		const slide = pptx.addSlide();
		const backgroundColor = safeCssColor(sourceSlide.backgroundColor, "");
		if (backgroundColor) {
			slide.background = { color: backgroundColor.replace(/^#/, "") };
		}
		slide.addText(sourceSlide.title ?? deck.title, {
			x: 0.55,
			y: 0.35,
			w: 12.2,
			h: 0.55,
			fontFace: safeFontFamily(deck.customBranding?.fontFamily),
			fontSize: 26,
			bold: true,
			color: safeCssColor(deck.customBranding?.primaryColor, "#1f2937").replace(/^#/, ""),
		});
		const body = plainTextFromSlideContent(sourceSlide.content);
		const useBullets = body.some((line) => line.startsWith("- "));
		slide.addText(body.length ? body.map((line) => line.replace(/^- /, "")).join("\n") : "No slide body content.", {
			x: 0.8,
			y: 1.25,
			w: 11.8,
			h: 5.2,
			fontFace: safeFontFamily(deck.customBranding?.fontFamily),
			fontSize: 15,
			breakLine: false,
			fit: "shrink",
			color: "111827",
			bullet: useBullets ? { type: "bullet" } : undefined,
		});
		if (sourceSlide.speakerNotes) {
			slide.addNotes(sourceSlide.speakerNotes);
		}
	}

	return await pptx.write({ outputType: "base64", compression: true }) as string;
}

async function buildPresentationExportArtifact(
	deck: PresentationExportDeck,
	format: "pptx" | "pdf" | "html",
	filename: string
): Promise<PresentationExportArtifact> {
	if (format === "html") {
		const mimeType = "text/html;charset=utf-8";
		return {
			downloadUrl: toBase64DataUrl(mimeType, buildPresentationHtml(deck)),
			filename,
			mimeType,
		};
	}
	if (format === "pdf") {
		const mimeType = "application/pdf";
		return {
			downloadUrl: toBase64DataUrl(mimeType, await buildPresentationPdf(deck)),
			filename,
			mimeType,
		};
	}

	const mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
	const pptx = await buildPresentationPptx(deck);
	return {
		downloadUrl: typeof pptx === "string"
			? `data:${mimeType};base64,${pptx}`
			: toBase64DataUrl(mimeType, pptx),
		filename,
		mimeType,
	};
}

function visibleProposalDocumentCondition(proposalDocumentId: string, context: PresentationActionContext): SQL {
	return and(
		eq(proposalDocuments.id, proposalDocumentId),
		assignedOpportunityExistsSql(proposalDocuments.opportunityId, context)
	)!;
}

function visibleDocumentForProposalCondition(documentId: string, proposalDocumentId: string, context: PresentationActionContext): SQL {
	return sql`documents.id = ${documentId}
		and exists (
			select 1
			from proposal_documents
			join opportunities on opportunities.id = proposal_documents.opportunity_id
			where proposal_documents.id = ${proposalDocumentId}
				and proposal_documents.document_id = documents.id
				and (
					opportunities.organization_id = ${context.organizationId}
					or opportunities.organization_id is null
				)
				and opportunities.assigned_to = ${context.userId}
		)`;
}

async function getScopedPresentation(
	id: string,
	context: PresentationActionContext
): Promise<OralPresentation | null> {
	const [presentation] = await db
		.select()
		.from(oralPresentations)
		.where(scopedPresentationWhere(id, context.organizationId))
		.limit(1);

	return presentation ?? null;
}

async function getScopedSlide(
	slideId: string,
	context: PresentationActionContext
): Promise<{ slide: PresentationSlide; presentation: OralPresentation } | null> {
	const [slide] = await db
		.select()
		.from(presentationSlides)
		.where(eq(presentationSlides.id, slideId))
		.limit(1);

	if (!slide?.presentationId) return null;

	const presentation = await getScopedPresentation(slide.presentationId, context);
	return presentation ? { slide, presentation } : null;
}

async function getScopedQAItem(
	id: string,
	context: PresentationActionContext
): Promise<{ qaItem: DBPresentationQA; presentation: OralPresentation } | null> {
	const [qaItem] = await db
		.select()
		.from(presentationQA)
		.where(eq(presentationQA.id, id))
		.limit(1);

	if (!qaItem?.presentationId) return null;

	const presentation = await getScopedPresentation(qaItem.presentationId, context);
	return presentation ? { qaItem, presentation } : null;
}

async function getScopedRecording(
	id: string,
	context: PresentationActionContext
): Promise<{ recording: PracticeRecording; presentation: OralPresentation } | null> {
	const [recording] = await db
		.select()
		.from(practiceRecordings)
		.where(eq(practiceRecordings.id, id))
		.limit(1);

	if (!recording?.presentationId) return null;

	const presentation = await getScopedPresentation(recording.presentationId, context);
	return presentation ? { recording, presentation } : null;
}

async function getScopedTeamMember(
	id: string,
	context: PresentationActionContext
): Promise<{ member: PresentationTeamMember; presentation: OralPresentation } | null> {
	const [member] = await db
		.select()
		.from(presentationTeam)
		.where(eq(presentationTeam.id, id))
		.limit(1);

	if (!member?.presentationId) return null;

	const presentation = await getScopedPresentation(member.presentationId, context);
	return presentation ? { member, presentation } : null;
}

// ============================================================================
// Input Validation Schemas
// ============================================================================

const CreatePresentationInputSchema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	description: z.string().optional(),
	timeLimit: z.number().int().positive().optional(),
	qaTimeLimit: z.number().int().positive().optional(),
	formatRequirements: z.string().optional(),
	audienceDescription: z.string().optional(),
	evaluationCriteria: z.array(z.object({
		criterion: z.string(),
		weight: z.number(),
		description: z.string(),
	})).optional(),
	sourceProposalId: z.string().uuid().optional(),
	theme: z.string().optional(),
	customBranding: z.object({
		primaryColor: z.string().optional(),
		secondaryColor: z.string().optional(),
		logoUrl: z.string().optional(),
		fontFamily: z.string().optional(),
	}).optional(),
	presentationDate: z.string().optional(),
	venue: z.string().optional(),
	isVirtual: z.boolean().optional(),
});

const UpdatePresentationInputSchema = CreatePresentationInputSchema.partial().extend({
	status: z.enum(["draft", "in_review", "approved", "delivered"]).optional(),
});

const PresentationFiltersSchema = z.object({
	opportunityId: z.string().uuid().optional(),
	status: z.string().optional(),
	search: z.string().optional(),
	fromDate: z.string().optional(),
	toDate: z.string().optional(),
	limit: z.number().int().positive().max(100).default(50),
	offset: z.number().int().min(0).default(0),
});

const CreateSlideInputSchema = z.object({
	slideNumber: z.number().int().positive(),
	slideType: z.enum(["title", "content", "image", "chart", "table", "section_divider", "qa"]).optional(),
	title: z.string().max(200).optional(),
	content: z.array(z.object({
		type: z.enum(["text", "bullet", "image", "chart", "table", "video", "code", "quote"]),
		data: z.unknown(),
		position: z.object({
			x: z.number(),
			y: z.number(),
			width: z.number(),
			height: z.number(),
		}).optional(),
	})).optional(),
	layout: z.string().optional(),
	backgroundImage: z.string().optional(),
	backgroundColor: z.string().optional(),
	speakerNotes: z.string().optional(),
	estimatedDuration: z.number().int().positive().optional(),
	transitionType: z.string().optional(),
	transitionDuration: z.number().int().optional(),
	sourceSectionIds: z.array(z.string()).optional(),
	sourceRequirementIds: z.array(z.string()).optional(),
	isHidden: z.boolean().optional(),
});

const UpdateSlideInputSchema = CreateSlideInputSchema.partial();

const CreateQAInputSchema = z.object({
	likelyQuestion: z.string().min(1, "Question is required"),
	questionCategory: z.enum(["technical", "management", "cost", "past_performance", "clarification", "general"]).optional(),
	difficulty: z.enum(["easy", "medium", "hard"]).optional(),
	probability: z.number().min(0).max(1).optional(),
	questionSource: z.string().optional(),
	relatedSlideIds: z.array(z.string()).optional(),
	suggestedAnswer: z.string().optional(),
	answerOutline: z.array(z.string()).optional(),
	keyPoints: z.array(z.string()).optional(),
	supportingEvidence: z.array(z.object({
		evidence: z.string(),
		source: z.string(),
		slideId: z.string().optional(),
	})).optional(),
	thingsToAvoid: z.array(z.string()).optional(),
});

const UpdateQAInputSchema = CreateQAInputSchema.partial().extend({
	isReviewed: z.boolean().optional(),
	reviewedBy: z.string().optional(),
});

const TeamMemberInputSchema = z.object({
	userId: z.string().uuid().optional(),
	name: z.string().min(1, "Name is required").max(200),
	role: z.enum(["presenter", "backup", "qa_responder", "technical_support", "coach"]),
	assignedSlideIds: z.array(z.string()).optional(),
	assignedTopics: z.array(z.string()).optional(),
	estimatedSpeakingTime: z.number().int().positive().optional(),
});

const UpdateTeamInputSchema = TeamMemberInputSchema.partial().extend({
	hasConfirmed: z.boolean().optional(),
});

// ============================================================================
// Presentation CRUD Actions
// ============================================================================

/**
 * Create a new oral presentation for an opportunity
 */
export async function createPresentation(
	opportunityId: string,
	data: z.infer<typeof CreatePresentationInputSchema>
): Promise<ActionResult<OralPresentation>> {
	try {
		const context = await requirePresentationContext();
		const validated = CreatePresentationInputSchema.parse(data);

		// Verify opportunity exists
		const [opportunity] = await db
			.select()
			.from(opportunities)
			.where(visibleOpportunityCondition(opportunityId, context))
			.limit(1);

		if (!opportunity) {
			return { success: false, error: "Opportunity not found" };
		}

		const presentationData: NewOralPresentation = {
			opportunityId,
			organizationId: context.organizationId,
			title: validated.title,
			description: validated.description,
			timeLimit: validated.timeLimit,
			qaTimeLimit: validated.qaTimeLimit,
			formatRequirements: validated.formatRequirements,
			audienceDescription: validated.audienceDescription,
			evaluationCriteria: validated.evaluationCriteria,
			sourceProposalId: validated.sourceProposalId,
			theme: validated.theme ?? "default",
			customBranding: validated.customBranding,
			presentationDate: validated.presentationDate ? new Date(validated.presentationDate) : undefined,
			venue: validated.venue,
			isVirtual: validated.isVirtual ?? false,
			status: "draft",
			createdBy: context.userId,
		};

		const [inserted] = await db
			.insert(oralPresentations)
			.values(presentationData)
			.returning();

		revalidatePath("/presentations");
		revalidatePath(`/opportunities/${opportunityId}/presentations`);

		return { success: true, data: inserted };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to create presentation:", error);
		return { success: false, error: "Failed to create presentation" };
	}
}

/**
 * Get a presentation with all related data
 */
export async function getPresentation(
	id: string
): Promise<ActionResult<{
	presentation: OralPresentation;
	slides: PresentationSlide[];
	qaItems: DBPresentationQA[];
	team: PresentationTeamMember[];
	recordings: PracticeRecording[];
}>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(id, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		// Fetch related data in parallel
		const [slides, qaItems, team, recordings] = await Promise.all([
			db
				.select()
				.from(presentationSlides)
				.where(eq(presentationSlides.presentationId, id))
				.orderBy(asc(presentationSlides.slideNumber)),
			db
				.select()
				.from(presentationQA)
				.where(eq(presentationQA.presentationId, id))
				.orderBy(desc(presentationQA.probability)),
			db
				.select()
				.from(presentationTeam)
				.where(eq(presentationTeam.presentationId, id)),
			db
				.select()
				.from(practiceRecordings)
				.where(eq(practiceRecordings.presentationId, id))
				.orderBy(desc(practiceRecordings.recordedAt)),
		]);

		return {
			success: true,
			data: {
				presentation,
				slides,
				qaItems,
				team,
				recordings,
			},
		};
	} catch (error) {
		logger.error("Failed to get presentation:", error);
		return { success: false, error: "Failed to get presentation" };
	}
}

/**
 * Update a presentation
 */
export async function updatePresentation(
	id: string,
	data: z.infer<typeof UpdatePresentationInputSchema>
): Promise<ActionResult<OralPresentation>> {
	try {
		const context = await requirePresentationContext();
		const validated = UpdatePresentationInputSchema.parse(data);

		const updateData: Partial<NewOralPresentation> = {
			updatedAt: new Date(),
		};

		if (validated.title !== undefined) updateData.title = validated.title;
		if (validated.description !== undefined) updateData.description = validated.description;
		if (validated.timeLimit !== undefined) updateData.timeLimit = validated.timeLimit;
		if (validated.qaTimeLimit !== undefined) updateData.qaTimeLimit = validated.qaTimeLimit;
		if (validated.formatRequirements !== undefined) updateData.formatRequirements = validated.formatRequirements;
		if (validated.audienceDescription !== undefined) updateData.audienceDescription = validated.audienceDescription;
		if (validated.evaluationCriteria !== undefined) updateData.evaluationCriteria = validated.evaluationCriteria;
		if (validated.sourceProposalId !== undefined) updateData.sourceProposalId = validated.sourceProposalId;
		if (validated.theme !== undefined) updateData.theme = validated.theme;
		if (validated.customBranding !== undefined) updateData.customBranding = validated.customBranding;
		if (validated.status !== undefined) updateData.status = validated.status;
		if (validated.presentationDate !== undefined) updateData.presentationDate = new Date(validated.presentationDate);
		if (validated.venue !== undefined) updateData.venue = validated.venue;
		if (validated.isVirtual !== undefined) updateData.isVirtual = validated.isVirtual;

		const [updated] = await db
			.update(oralPresentations)
			.set(updateData)
			.where(scopedPresentationWhere(id, context.organizationId))
			.returning();

		if (!updated) {
			return { success: false, error: "Presentation not found" };
		}

		revalidatePath("/presentations");
		revalidatePath(`/presentations/${id}`);

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update presentation:", error);
		return { success: false, error: "Failed to update presentation" };
	}
}

/**
 * Delete a presentation and all related data
 */
export async function deletePresentation(id: string): Promise<ActionResult<void>> {
	try {
		// Get the presentation to find opportunityId for path revalidation
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(id, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		// Delete cascades handle related records
		await db
			.delete(oralPresentations)
			.where(scopedPresentationWhere(id, context.organizationId));

		revalidatePath("/presentations");
		if (presentation.opportunityId) {
			revalidatePath(`/opportunities/${presentation.opportunityId}/presentations`);
		}

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Failed to delete presentation:", error);
		return { success: false, error: "Failed to delete presentation" };
	}
}

/**
 * List presentations with filters
 */
export async function listPresentations(
	filters?: z.infer<typeof PresentationFiltersSchema>
): Promise<ActionResult<{ presentations: OralPresentation[]; total: number }>> {
	try {
		const context = await requirePresentationContext();
		const validated = filters ? PresentationFiltersSchema.parse(filters) : { limit: 50, offset: 0 };
		const conditions = [eq(oralPresentations.organizationId, context.organizationId)];

		if (validated.opportunityId) {
			conditions.push(eq(oralPresentations.opportunityId, validated.opportunityId));
		}

		if (validated.status) {
			conditions.push(eq(oralPresentations.status, validated.status));
		}

		if (validated.search) {
			const searchTerm = `%${validated.search}%`;
			const searchCondition = or(
				ilike(oralPresentations.title, searchTerm),
				ilike(oralPresentations.description, searchTerm)
			);
			if (searchCondition) conditions.push(searchCondition);
		}

		if (validated.fromDate) {
			conditions.push(gte(oralPresentations.presentationDate, new Date(validated.fromDate)));
		}

		if (validated.toDate) {
			conditions.push(lte(oralPresentations.presentationDate, new Date(validated.toDate)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [presentations, countResult] = await Promise.all([
			db
				.select()
				.from(oralPresentations)
				.where(whereClause)
				.orderBy(desc(oralPresentations.updatedAt))
				.limit(validated.limit)
				.offset(validated.offset),
			db
				.select({ count: sql<number>`count(*)::int` })
				.from(oralPresentations)
				.where(whereClause),
		]);

		return {
			success: true,
			data: {
				presentations,
				total: countResult[0]?.count ?? 0,
			},
		};
	} catch (error) {
		logger.error("Failed to list presentations:", error);
		return { success: false, error: "Failed to list presentations" };
	}
}

// ============================================================================
// Slide Management Actions
// ============================================================================

/**
 * Generate slides from a proposal document using AI
 */
export async function generateSlidesFromProposal(
	presentationId: string,
	proposalId: string
): Promise<ActionResult<PresentationSlide[]>> {
	try {
		const context = await requirePresentationContext();
		// Fetch presentation
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		// Fetch proposal document
		const [proposalDoc] = await db
			.select()
			.from(proposalDocuments)
			.where(visibleProposalDocumentCondition(proposalId, context))
			.limit(1);

		if (!proposalDoc) {
			return { success: false, error: "Proposal document not found" };
		}

		// Fetch the actual document content
		const [doc] = await db
			.select()
			.from(documents)
			.where(visibleDocumentForProposalCondition(proposalDoc.documentId, proposalDoc.id, context))
			.limit(1);

		if (!doc) {
			return { success: false, error: "Document content not found" };
		}

		// Build AI prompt for slide generation
		const prompt = `You are an expert presentation designer for government RFP oral presentations.

Generate a slide outline for an oral presentation based on this proposal content.

PRESENTATION CONTEXT:
- Title: ${presentation.title}
- Time Limit: ${presentation.timeLimit ?? 60} minutes
- Q&A Time: ${presentation.qaTimeLimit ?? 15} minutes
- Audience: ${presentation.audienceDescription ?? "Government evaluation panel"}
- Evaluation Criteria: ${JSON.stringify(presentation.evaluationCriteria ?? [])}

PROPOSAL CONTENT:
${doc.plainText?.substring(0, 8000) ?? JSON.stringify(doc.content).substring(0, 8000)}

Generate a JSON array of slides with the following structure for each slide:
{
  "slideNumber": number,
  "slideType": "title" | "content" | "section_divider" | "chart" | "table" | "qa",
  "title": "string",
  "content": [
    {
      "type": "bullet",
      "data": ["bullet point 1", "bullet point 2", ...]
    }
  ],
  "speakerNotes": "string with talking points",
  "estimatedDuration": number (seconds)
}

Guidelines:
1. Start with a title slide
2. Include an agenda/overview slide
3. Organize by evaluation criteria sections
4. Include win themes and discriminators prominently
5. End with a summary/call-to-action slide
6. Keep text minimal - 3-5 bullets max per slide
7. Allocate time proportionally to criteria weights
8. Total estimated time should be within the time limit

Return ONLY the JSON array, no additional text.`;

		let slidesData: Array<{
			slideNumber: number;
			slideType: string;
			title: string;
			content: SlideContent[];
			speakerNotes: string;
			estimatedDuration: number;
		}>;

		try {
			const result = await complete(prompt, {
				maxTokens: 4000,
				temperature: 0.7,
			});

			// Extract JSON from response
			const jsonMatch = result.content.match(/\[[\s\S]*\]/);
			if (!jsonMatch) {
				throw new Error("No valid JSON array found in AI response");
			}

			slidesData = JSON.parse(jsonMatch[0]);
		} catch (aiError) {
			logger.error("AI slide generation failed, using template:", aiError);
			slidesData = generateFallbackSlides(presentation, doc);
		}

		// Insert slides into database
		const insertedSlides: PresentationSlide[] = [];

		for (const slideData of slidesData) {
			const newSlide: NewPresentationSlide = {
				presentationId,
				slideNumber: slideData.slideNumber,
				slideType: slideData.slideType as PresentationSlide["slideType"],
				title: slideData.title,
				content: slideData.content,
				speakerNotes: slideData.speakerNotes,
				estimatedDuration: slideData.estimatedDuration,
			};

			const [inserted] = await db
				.insert(presentationSlides)
				.values(newSlide)
				.returning();

			insertedSlides.push(inserted);
		}

		// Update presentation slide count
		await db
			.update(oralPresentations)
			.set({
				slideCount: insertedSlides.length,
				sourceProposalId: proposalId,
				updatedAt: new Date(),
			})
			.where(scopedPresentationWhere(presentationId, context.organizationId));

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: insertedSlides };
	} catch (error) {
		logger.error("Failed to generate slides:", error);
		return { success: false, error: "Failed to generate slides from proposal" };
	}
}

/**
 * Generate fallback slides when AI is unavailable
 */
function generateFallbackSlides(
	presentation: OralPresentation,
	doc: { plainText?: string | null }
): Array<{
	slideNumber: number;
	slideType: string;
	title: string;
	content: SlideContent[];
	speakerNotes: string;
	estimatedDuration: number;
}> {
	const timeLimit = (presentation.timeLimit ?? 60) * 60; // Convert to seconds
	const baseSlides = [
		{
			slideNumber: 1,
			slideType: "title",
			title: presentation.title,
			content: [{
				type: "text" as const,
				data: presentation.description ?? "Oral Presentation",
			}],
			speakerNotes: "Welcome and introduce the presentation team.",
			estimatedDuration: 60,
		},
		{
			slideNumber: 2,
			slideType: "content",
			title: "Agenda",
			content: [{
				type: "bullet" as const,
				data: ["Introduction", "Technical Approach", "Management Approach", "Past Performance", "Summary"],
			}],
			speakerNotes: "Provide overview of presentation structure.",
			estimatedDuration: 45,
		},
	];

	// Add section slides based on evaluation criteria
	const criteria = (presentation.evaluationCriteria as EvaluationCriterion[] | null) ?? [];
	let slideNumber = 3;

	for (const criterion of criteria) {
		baseSlides.push({
			slideNumber: slideNumber++,
			slideType: "section_divider",
			title: criterion.criterion,
			content: [{
				type: "text" as const,
				data: criterion.description,
			}],
			speakerNotes: `Transition to ${criterion.criterion} section.`,
			estimatedDuration: 30,
		});

		baseSlides.push({
			slideNumber: slideNumber++,
			slideType: "content",
			title: `${criterion.criterion} - Key Points`,
			content: [{
				type: "bullet" as const,
				data: [
					`Our approach to ${criterion.criterion.toLowerCase()}`,
					"Key differentiators",
					"Relevant experience",
				],
			}],
			speakerNotes: `Detail our approach to ${criterion.criterion}.`,
			estimatedDuration: Math.floor(timeLimit * (criterion.weight / 100) / 2),
		});
	}

	// Add summary slide
	baseSlides.push({
		slideNumber: slideNumber,
		slideType: "content",
		title: "Summary & Next Steps",
		content: [{
			type: "bullet" as const,
			data: [
				"Key takeaways",
				"Why choose us",
				"Questions?",
			],
		}],
		speakerNotes: "Summarize key points and invite questions.",
		estimatedDuration: 60,
	});

	return baseSlides;
}

/**
 * Create a new slide
 */
export async function createSlide(
	presentationId: string,
	data: z.infer<typeof CreateSlideInputSchema>
): Promise<ActionResult<PresentationSlide>> {
	try {
		const context = await requirePresentationContext();
		const validated = CreateSlideInputSchema.parse(data);

		// Verify presentation exists
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const slideData: NewPresentationSlide = {
			presentationId,
			slideNumber: validated.slideNumber,
			slideType: validated.slideType,
			title: validated.title,
			content: validated.content,
			layout: validated.layout ?? "default",
			backgroundImage: validated.backgroundImage,
			backgroundColor: validated.backgroundColor,
			speakerNotes: validated.speakerNotes,
			estimatedDuration: validated.estimatedDuration,
			transitionType: validated.transitionType ?? "none",
			transitionDuration: validated.transitionDuration,
			sourceSectionIds: validated.sourceSectionIds ?? [],
			sourceRequirementIds: validated.sourceRequirementIds ?? [],
			isHidden: validated.isHidden ?? false,
		};

		const [inserted] = await db
			.insert(presentationSlides)
			.values(slideData)
			.returning();

		// Update slide count
		const slideCount = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(presentationSlides)
			.where(eq(presentationSlides.presentationId, presentationId));

		await db
			.update(oralPresentations)
			.set({
				slideCount: slideCount[0]?.count ?? 0,
				updatedAt: new Date(),
			})
			.where(scopedPresentationWhere(presentationId, context.organizationId));

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: inserted };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to create slide:", error);
		return { success: false, error: "Failed to create slide" };
	}
}

/**
 * Update a slide
 */
export async function updateSlide(
	slideId: string,
	data: z.infer<typeof UpdateSlideInputSchema>
): Promise<ActionResult<PresentationSlide>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedSlide(slideId, context);
		if (!scoped) {
			return { success: false, error: "Slide not found" };
		}
		const validated = UpdateSlideInputSchema.parse(data);

		const updateData: Partial<NewPresentationSlide> = {
			updatedAt: new Date(),
		};

		if (validated.slideNumber !== undefined) updateData.slideNumber = validated.slideNumber;
		if (validated.slideType !== undefined) updateData.slideType = validated.slideType;
		if (validated.title !== undefined) updateData.title = validated.title;
		if (validated.content !== undefined) updateData.content = validated.content;
		if (validated.layout !== undefined) updateData.layout = validated.layout;
		if (validated.backgroundImage !== undefined) updateData.backgroundImage = validated.backgroundImage;
		if (validated.backgroundColor !== undefined) updateData.backgroundColor = validated.backgroundColor;
		if (validated.speakerNotes !== undefined) updateData.speakerNotes = validated.speakerNotes;
		if (validated.estimatedDuration !== undefined) updateData.estimatedDuration = validated.estimatedDuration;
		if (validated.transitionType !== undefined) updateData.transitionType = validated.transitionType;
		if (validated.transitionDuration !== undefined) updateData.transitionDuration = validated.transitionDuration;
		if (validated.sourceSectionIds !== undefined) updateData.sourceSectionIds = validated.sourceSectionIds;
		if (validated.sourceRequirementIds !== undefined) updateData.sourceRequirementIds = validated.sourceRequirementIds;
		if (validated.isHidden !== undefined) updateData.isHidden = validated.isHidden;

		const [updated] = await db
			.update(presentationSlides)
			.set(updateData)
			.where(
				and(
					eq(presentationSlides.id, slideId),
					eq(presentationSlides.presentationId, scoped.presentation.id)
				)
			)
			.returning();

		if (!updated) {
			return { success: false, error: "Slide not found" };
		}

		revalidatePath(`/presentations/${updated.presentationId}`);

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update slide:", error);
		return { success: false, error: "Failed to update slide" };
	}
}

/**
 * Delete a slide
 */
export async function deleteSlide(slideId: string): Promise<ActionResult<void>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedSlide(slideId, context);
		if (!scoped) {
			return { success: false, error: "Slide not found" };
		}

		const [deleted] = await db
			.delete(presentationSlides)
			.where(
				and(
					eq(presentationSlides.id, slideId),
					eq(presentationSlides.presentationId, scoped.presentation.id)
				)
			)
			.returning();

		if (!deleted) {
			return { success: false, error: "Slide not found" };
		}

		// Reorder remaining slides
		await reorderSlidesAfterDelete(deleted.presentationId!, deleted.slideNumber);

		// Update slide count
		const slideCount = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(presentationSlides)
			.where(eq(presentationSlides.presentationId, deleted.presentationId!));

		await db
			.update(oralPresentations)
			.set({
				slideCount: slideCount[0]?.count ?? 0,
				updatedAt: new Date(),
			})
			.where(scopedPresentationWhere(deleted.presentationId!, context.organizationId));

		revalidatePath(`/presentations/${deleted.presentationId}`);

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Failed to delete slide:", error);
		return { success: false, error: "Failed to delete slide" };
	}
}

/**
 * Reorder slides after a deletion
 */
async function reorderSlidesAfterDelete(presentationId: string, deletedNumber: number): Promise<void> {
	await db
		.update(presentationSlides)
		.set({
			slideNumber: sql`${presentationSlides.slideNumber} - 1`,
		})
		.where(
			and(
				eq(presentationSlides.presentationId, presentationId),
				sql`${presentationSlides.slideNumber} > ${deletedNumber}`
			)
		);
}

/**
 * Reorder slides
 */
export async function reorderSlides(
	presentationId: string,
	slideOrder: string[]
): Promise<ActionResult<PresentationSlide[]>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);
		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		// Update each slide's position
		for (let i = 0; i < slideOrder.length; i++) {
			await db
				.update(presentationSlides)
				.set({
					slideNumber: i + 1,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(presentationSlides.id, slideOrder[i]),
						eq(presentationSlides.presentationId, presentationId)
					)
				);
		}

		// Fetch updated slides
		const slides = await db
			.select()
			.from(presentationSlides)
			.where(eq(presentationSlides.presentationId, presentationId))
			.orderBy(asc(presentationSlides.slideNumber));

		await db
			.update(oralPresentations)
			.set({ updatedAt: new Date() })
			.where(scopedPresentationWhere(presentationId, context.organizationId));

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: slides };
	} catch (error) {
		logger.error("Failed to reorder slides:", error);
		return { success: false, error: "Failed to reorder slides" };
	}
}

/**
 * Duplicate a slide
 */
export async function duplicateSlide(slideId: string): Promise<ActionResult<PresentationSlide>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedSlide(slideId, context);
		const original = scoped?.slide;

		if (!original) {
			return { success: false, error: "Slide not found" };
		}

		// Shift subsequent slides
		await db
			.update(presentationSlides)
			.set({
				slideNumber: sql`${presentationSlides.slideNumber} + 1`,
			})
			.where(
				and(
					eq(presentationSlides.presentationId, original.presentationId!),
					sql`${presentationSlides.slideNumber} > ${original.slideNumber}`
				)
			);

		// Create duplicate
		const duplicateData: NewPresentationSlide = {
			presentationId: original.presentationId,
			slideNumber: original.slideNumber + 1,
			slideType: original.slideType,
			title: `${original.title} (Copy)`,
			content: original.content,
			layout: original.layout,
			backgroundImage: original.backgroundImage,
			backgroundColor: original.backgroundColor,
			speakerNotes: original.speakerNotes,
			estimatedDuration: original.estimatedDuration,
			transitionType: original.transitionType,
			transitionDuration: original.transitionDuration,
			sourceSectionIds: original.sourceSectionIds,
			sourceRequirementIds: original.sourceRequirementIds,
			isHidden: false,
		};

		const [duplicate] = await db
			.insert(presentationSlides)
			.values(duplicateData)
			.returning();

		// Update slide count
		const slideCount = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(presentationSlides)
			.where(eq(presentationSlides.presentationId, original.presentationId!));

		await db
			.update(oralPresentations)
			.set({
				slideCount: slideCount[0]?.count ?? 0,
				updatedAt: new Date(),
			})
			.where(scopedPresentationWhere(original.presentationId!, context.organizationId));

		revalidatePath(`/presentations/${original.presentationId}`);

		return { success: true, data: duplicate };
	} catch (error) {
		logger.error("Failed to duplicate slide:", error);
		return { success: false, error: "Failed to duplicate slide" };
	}
}

/**
 * Generate AI speaker notes for a slide
 */
export async function generateSpeakerNotes(slideId: string): Promise<ActionResult<string>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedSlide(slideId, context);
		const slide = scoped?.slide;

		if (!slide) {
			return { success: false, error: "Slide not found" };
		}
		const presentation = scoped.presentation;

		const prompt = `Generate professional speaker notes for this presentation slide.

CONTEXT:
- Presentation: ${presentation?.title ?? "Oral Presentation"}
- Audience: ${presentation?.audienceDescription ?? "Government evaluation panel"}
- Time for this slide: ${slide.estimatedDuration ?? 60} seconds

SLIDE:
- Type: ${slide.slideType}
- Title: ${slide.title}
- Content: ${JSON.stringify(slide.content)}

Generate speaker notes that:
1. Expand on each bullet point with key talking points
2. Include transition phrases to next topic
3. Note any data/evidence to cite
4. Include timing cues
5. Add emphasis points for key messages

Keep notes concise but comprehensive. Target ${Math.ceil((slide.estimatedDuration ?? 60) / 60)} minute(s) of speaking.`;

		let speakerNotes: string;

		try {
			const result = await complete(prompt, {
				maxTokens: 800,
				temperature: 0.7,
			});
			speakerNotes = result.content;
		} catch (aiError) {
			logger.error("AI speaker notes generation failed:", aiError);
			speakerNotes = generateFallbackSpeakerNotes(slide);
		}

		// Update slide with generated notes
		await db
			.update(presentationSlides)
			.set({
				speakerNotes,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(presentationSlides.id, slideId),
					eq(presentationSlides.presentationId, presentation.id)
				)
			);

		revalidatePath(`/presentations/${slide.presentationId}`);

		return { success: true, data: speakerNotes };
	} catch (error) {
		logger.error("Failed to generate speaker notes:", error);
		return { success: false, error: "Failed to generate speaker notes" };
	}
}

/**
 * Fallback speaker notes when AI is unavailable
 */
function generateFallbackSpeakerNotes(slide: PresentationSlide): string {
	const notes: string[] = [];
	const content = slide.content as SlideContent[] | null;

	notes.push(`[SLIDE: ${slide.title ?? "Untitled"}]`);
	notes.push(`Time allocated: ${Math.ceil((slide.estimatedDuration ?? 60) / 60)} minute(s)`);
	notes.push("");

	if (content && content.length > 0) {
		notes.push("KEY POINTS:");
		for (const item of content) {
			if (item.type === "bullet" && Array.isArray(item.data)) {
				for (const bullet of item.data as string[]) {
					notes.push(`- ${bullet}`);
				}
			} else if (item.type === "text" && typeof item.data === "string") {
				notes.push(`- ${item.data}`);
			}
		}
	}

	notes.push("");
	notes.push("TRANSITION: Bridge to the next slide by...");

	return notes.join("\n");
}

// ============================================================================
// Q&A Preparation Actions
// ============================================================================

/**
 * Anticipate questions using AI based on presentation content
 */
export async function anticipateQuestions(
	presentationId: string
): Promise<ActionResult<DBPresentationQA[]>> {
	try {
		const context = await requirePresentationContext();
		// Fetch presentation with slides
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const slides = await db
			.select()
			.from(presentationSlides)
			.where(eq(presentationSlides.presentationId, presentationId))
			.orderBy(asc(presentationSlides.slideNumber));

		// Fetch opportunity requirements if linked
		let reqContext = "";
		if (presentation.opportunityId) {
			const reqs = await db
				.select()
				.from(rfpRequirements)
				.where(visibleRequirementsForOpportunityCondition(presentation.opportunityId, context))
				.limit(20);

			reqContext = reqs.map((r) => `- ${r.requirementText}`).join("\n");
		}

		const slideContext = slides
			.map((s) => `Slide ${s.slideNumber}: ${s.title} - ${JSON.stringify(s.content).substring(0, 200)}`)
			.join("\n");

		const prompt = `You are an expert at anticipating questions from government evaluation panels during RFP oral presentations.

PRESENTATION CONTEXT:
Title: ${presentation.title}
Audience: ${presentation.audienceDescription ?? "Government evaluation panel"}
Evaluation Criteria: ${JSON.stringify(presentation.evaluationCriteria ?? [])}

SLIDES:
${slideContext}

${reqContext ? `REQUIREMENTS:\n${reqContext}` : ""}

Generate 10-15 likely questions the evaluation panel may ask. For each question, provide:
1. The question text
2. Category: technical, management, cost, past_performance, or clarification
3. Difficulty: easy, medium, or hard
4. Probability (0-1) of being asked
5. Source of the question: proposal_weakness, requirement_gap, competitor_strength, evaluator_pattern
6. Key points for the answer
7. Things to avoid saying

Return as JSON array:
[
  {
    "likelyQuestion": "string",
    "questionCategory": "string",
    "difficulty": "easy|medium|hard",
    "probability": 0.0-1.0,
    "questionSource": "string",
    "keyPoints": ["string"],
    "thingsToAvoid": ["string"]
  }
]

Return ONLY the JSON array.`;

		let questionsData: Array<{
			likelyQuestion: string;
			questionCategory: string;
			difficulty: string;
			probability: number;
			questionSource: string;
			keyPoints: string[];
			thingsToAvoid: string[];
		}>;

		try {
			const result = await complete(prompt, {
				maxTokens: 3000,
				temperature: 0.8,
			});

			const jsonMatch = result.content.match(/\[[\s\S]*\]/);
			if (!jsonMatch) {
				throw new Error("No valid JSON array found");
			}

			questionsData = JSON.parse(jsonMatch[0]);
		} catch (aiError) {
			logger.error("AI question anticipation failed, using fallback:", aiError);
			questionsData = generateFallbackQuestions(presentation);
		}

		// Insert Q&A items
		const insertedItems: DBPresentationQA[] = [];

		for (const q of questionsData) {
			const qaData: NewPresentationQA = {
				presentationId,
				likelyQuestion: q.likelyQuestion,
				questionCategory: q.questionCategory,
				difficulty: q.difficulty as "easy" | "medium" | "hard",
				probability: q.probability,
				questionSource: q.questionSource,
				keyPoints: q.keyPoints,
				thingsToAvoid: q.thingsToAvoid,
				isReviewed: false,
			};

			const [inserted] = await db
				.insert(presentationQA)
				.values(qaData)
				.returning();

			insertedItems.push(inserted);
		}

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: insertedItems };
	} catch (error) {
		logger.error("Failed to anticipate questions:", error);
		return { success: false, error: "Failed to anticipate questions" };
	}
}

/**
 * Generate fallback questions when AI is unavailable
 */
function generateFallbackQuestions(presentation: OralPresentation): Array<{
	likelyQuestion: string;
	questionCategory: string;
	difficulty: string;
	probability: number;
	questionSource: string;
	keyPoints: string[];
	thingsToAvoid: string[];
}> {
	const baseQuestions = [
		{
			likelyQuestion: "Can you walk us through your technical approach to meeting the key requirements?",
			questionCategory: "technical",
			difficulty: "medium",
			probability: 0.9,
			questionSource: "evaluator_pattern",
			keyPoints: ["Reference specific requirements", "Highlight unique methodology", "Provide examples"],
			thingsToAvoid: ["Generic statements", "Overpromising"],
		},
		{
			likelyQuestion: "How will you ensure on-time delivery given the project constraints?",
			questionCategory: "management",
			difficulty: "medium",
			probability: 0.85,
			questionSource: "evaluator_pattern",
			keyPoints: ["Project management approach", "Risk mitigation", "Track record"],
			thingsToAvoid: ["Ignoring constraints", "Unrealistic timelines"],
		},
		{
			likelyQuestion: "Describe a similar project where you faced challenges and how you overcame them.",
			questionCategory: "past_performance",
			difficulty: "easy",
			probability: 0.8,
			questionSource: "evaluator_pattern",
			keyPoints: ["Specific example", "Problem-solution-outcome", "Lessons learned"],
			thingsToAvoid: ["Blaming others", "Vague examples"],
		},
		{
			likelyQuestion: "How does your cost estimate reflect value for the government?",
			questionCategory: "cost",
			difficulty: "hard",
			probability: 0.75,
			questionSource: "evaluator_pattern",
			keyPoints: ["Cost breakdown", "Value proposition", "Efficiency measures"],
			thingsToAvoid: ["Defensive tone", "Unexplained costs"],
		},
		{
			likelyQuestion: "What differentiates your solution from competitors?",
			questionCategory: "technical",
			difficulty: "medium",
			probability: 0.85,
			questionSource: "competitor_strength",
			keyPoints: ["Unique capabilities", "Proven results", "Customer focus"],
			thingsToAvoid: ["Criticizing competitors", "Overconfidence"],
		},
	];

	// Add criteria-specific questions
	const criteria = (presentation.evaluationCriteria as EvaluationCriterion[] | null) ?? [];
	for (const criterion of criteria) {
		baseQuestions.push({
			likelyQuestion: `Can you elaborate on your approach to ${criterion.criterion.toLowerCase()}?`,
			questionCategory: "technical",
			difficulty: "medium",
			probability: 0.7,
			questionSource: "requirement_gap",
			keyPoints: [`Detail ${criterion.criterion} approach`, "Evidence of capability", "Metrics"],
			thingsToAvoid: ["Surface-level answers", "Missing key aspects"],
		});
	}

	return baseQuestions;
}

/**
 * Create a new Q&A item
 */
export async function createQAItem(
	presentationId: string,
	data: z.infer<typeof CreateQAInputSchema>
): Promise<ActionResult<DBPresentationQA>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);
		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}
		const validated = CreateQAInputSchema.parse(data);

		const qaData: NewPresentationQA = {
			presentationId,
			likelyQuestion: validated.likelyQuestion,
			questionCategory: validated.questionCategory,
			difficulty: validated.difficulty,
			probability: validated.probability,
			questionSource: validated.questionSource,
			relatedSlideIds: validated.relatedSlideIds ?? [],
			suggestedAnswer: validated.suggestedAnswer,
			answerOutline: validated.answerOutline ?? [],
			keyPoints: validated.keyPoints ?? [],
			supportingEvidence: validated.supportingEvidence ?? [],
			thingsToAvoid: validated.thingsToAvoid ?? [],
			isReviewed: false,
		};

		const [inserted] = await db
			.insert(presentationQA)
			.values(qaData)
			.returning();

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: inserted };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to create Q&A item:", error);
		return { success: false, error: "Failed to create Q&A item" };
	}
}

/**
 * Update a Q&A item
 */
export async function updateQAItem(
	id: string,
	data: z.infer<typeof UpdateQAInputSchema>
): Promise<ActionResult<DBPresentationQA>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedQAItem(id, context);
		if (!scoped) {
			return { success: false, error: "Q&A item not found" };
		}
		const validated = UpdateQAInputSchema.parse(data);

		const updateData: Partial<NewPresentationQA> = {
			updatedAt: new Date(),
		};

		if (validated.likelyQuestion !== undefined) updateData.likelyQuestion = validated.likelyQuestion;
		if (validated.questionCategory !== undefined) updateData.questionCategory = validated.questionCategory;
		if (validated.difficulty !== undefined) updateData.difficulty = validated.difficulty;
		if (validated.probability !== undefined) updateData.probability = validated.probability;
		if (validated.questionSource !== undefined) updateData.questionSource = validated.questionSource;
		if (validated.relatedSlideIds !== undefined) updateData.relatedSlideIds = validated.relatedSlideIds;
		if (validated.suggestedAnswer !== undefined) updateData.suggestedAnswer = validated.suggestedAnswer;
		if (validated.answerOutline !== undefined) updateData.answerOutline = validated.answerOutline;
		if (validated.keyPoints !== undefined) updateData.keyPoints = validated.keyPoints;
		if (validated.supportingEvidence !== undefined) updateData.supportingEvidence = validated.supportingEvidence;
		if (validated.thingsToAvoid !== undefined) updateData.thingsToAvoid = validated.thingsToAvoid;
		if (validated.isReviewed !== undefined) updateData.isReviewed = validated.isReviewed;
		if (validated.reviewedBy !== undefined) updateData.reviewedBy = validated.reviewedBy;

		const [updated] = await db
			.update(presentationQA)
			.set(updateData)
			.where(
				and(
					eq(presentationQA.id, id),
					eq(presentationQA.presentationId, scoped.presentation.id)
				)
			)
			.returning();

		if (!updated) {
			return { success: false, error: "Q&A item not found" };
		}

		revalidatePath(`/presentations/${updated.presentationId}`);

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update Q&A item:", error);
		return { success: false, error: "Failed to update Q&A item" };
	}
}

/**
 * Generate AI-suggested answer for a question
 */
export async function generateAnswerSuggestion(questionId: string): Promise<ActionResult<string>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedQAItem(questionId, context);
		const qaItem = scoped?.qaItem;

		if (!qaItem) {
			return { success: false, error: "Q&A item not found" };
		}
		const presentation = scoped.presentation;

		// Get related slides if any
		let slideContext = "";
		const relatedSlideIds = (qaItem.relatedSlideIds as string[] | null) ?? [];
		if (relatedSlideIds.length > 0) {
			const relatedSlides = await db
				.select()
				.from(presentationSlides)
				.where(inArray(presentationSlides.id, relatedSlideIds));

			slideContext = relatedSlides
				.map((s) => `Slide ${s.slideNumber}: ${s.title} - ${JSON.stringify(s.content).substring(0, 300)}`)
				.join("\n");
		}

		const prompt = `Generate a professional answer for this oral presentation Q&A question.

QUESTION: ${qaItem.likelyQuestion}
CATEGORY: ${qaItem.questionCategory ?? "general"}
DIFFICULTY: ${qaItem.difficulty ?? "medium"}

PRESENTATION CONTEXT:
- Title: ${presentation?.title ?? "Oral Presentation"}
- Audience: ${presentation?.audienceDescription ?? "Government evaluation panel"}

${slideContext ? `RELATED SLIDES:\n${slideContext}` : ""}

${(qaItem.keyPoints as string[] | null)?.length ? `KEY POINTS TO COVER:\n${(qaItem.keyPoints as string[]).map((p) => `- ${p}`).join("\n")}` : ""}

${(qaItem.thingsToAvoid as string[] | null)?.length ? `THINGS TO AVOID:\n${(qaItem.thingsToAvoid as string[]).map((t) => `- ${t}`).join("\n")}` : ""}

Generate a clear, confident, and professional answer that:
1. Directly addresses the question
2. Provides specific examples or evidence
3. Stays within 60-90 seconds speaking time
4. Ends with a strong closing statement

Format the answer for verbal delivery (no bullet points).`;

		let suggestedAnswer: string;

		try {
			const result = await complete(prompt, {
				maxTokens: 600,
				temperature: 0.7,
			});
			suggestedAnswer = result.content;
		} catch (aiError) {
			logger.error("AI answer generation failed:", aiError);
			suggestedAnswer = generateFallbackAnswer(qaItem);
		}

		// Update the Q&A item
		await db
			.update(presentationQA)
			.set({
				suggestedAnswer,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(presentationQA.id, questionId),
					eq(presentationQA.presentationId, presentation.id)
				)
			);

		revalidatePath(`/presentations/${qaItem.presentationId}`);

		return { success: true, data: suggestedAnswer };
	} catch (error) {
		logger.error("Failed to generate answer suggestion:", error);
		return { success: false, error: "Failed to generate answer suggestion" };
	}
}

/**
 * Generate fallback answer when AI is unavailable
 */
function generateFallbackAnswer(qaItem: DBPresentationQA): string {
	const keyPoints = (qaItem.keyPoints as string[] | null) ?? [];

	let answer = `Thank you for that question. `;

	if (keyPoints.length > 0) {
		answer += `To address this, I'd like to highlight ${keyPoints.length} key points. `;
		answer += keyPoints.map((point, i) => `${i === 0 ? "First" : i === keyPoints.length - 1 ? "Finally" : "Additionally"}, ${point.toLowerCase()}`).join(". ");
		answer += ". ";
	} else {
		answer += `Based on our experience and the approach outlined in our proposal, we are well-positioned to address this concern. `;
	}

	answer += `I would be happy to provide additional details if needed.`;

	return answer;
}

/**
 * List Q&A items for a presentation
 */
export async function listQAItems(
	presentationId: string
): Promise<ActionResult<DBPresentationQA[]>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);
		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const items = await db
			.select()
			.from(presentationQA)
			.where(eq(presentationQA.presentationId, presentationId))
			.orderBy(desc(presentationQA.probability));

		return { success: true, data: items };
	} catch (error) {
		logger.error("Failed to list Q&A items:", error);
		return { success: false, error: "Failed to list Q&A items" };
	}
}

/**
 * Mark Q&A item as reviewed
 */
export async function markQAReviewed(
	id: string,
	_reviewedBy?: string
): Promise<ActionResult<DBPresentationQA>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedQAItem(id, context);
		if (!scoped) {
			return { success: false, error: "Q&A item not found" };
		}

		const [updated] = await db
			.update(presentationQA)
			.set({
				isReviewed: true,
				reviewedBy: context.userId,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(presentationQA.id, id),
					eq(presentationQA.presentationId, scoped.presentation.id)
				)
			)
			.returning();

		if (!updated) {
			return { success: false, error: "Q&A item not found" };
		}

		revalidatePath(`/presentations/${updated.presentationId}`);

		return { success: true, data: updated };
	} catch (error) {
		logger.error("Failed to mark Q&A as reviewed:", error);
		return { success: false, error: "Failed to mark Q&A as reviewed" };
	}
}

/**
 * Delete a Q&A item
 */
export async function deleteQAItem(id: string): Promise<ActionResult<void>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedQAItem(id, context);
		const qa = scoped?.qaItem;

		if (!qa) {
			return { success: false, error: "Q&A item not found" };
		}

		await db.delete(presentationQA).where(
			and(
				eq(presentationQA.id, id),
				eq(presentationQA.presentationId, scoped.presentation.id)
			)
		);

		if (qa.presentationId) {
			revalidatePath(`/presentations/${qa.presentationId}`);
		}

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Failed to delete Q&A item:", error);
		return { success: false, error: "Failed to delete Q&A item" };
	}
}

// ============================================================================
// Timing & Validation Actions
// ============================================================================

/**
 * Validate if presentation is within time limit
 */
export async function validateTimelimits(
	presentationId: string
): Promise<ActionResult<{
	isWithinLimit: boolean;
	totalEstimatedSeconds: number;
	timeLimitSeconds: number;
	overageSeconds: number;
	slideBreakdown: Array<{ slideId: string; slideNumber: number; title: string; estimatedSeconds: number }>;
	recommendations: string[];
}>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const slides = await db
			.select()
			.from(presentationSlides)
			.where(
				and(
					eq(presentationSlides.presentationId, presentationId),
					eq(presentationSlides.isHidden, false)
				)
			)
			.orderBy(asc(presentationSlides.slideNumber));

		const timeLimitSeconds = (presentation.timeLimit ?? 60) * 60;
		const totalEstimatedSeconds = slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0);
		const overageSeconds = Math.max(0, totalEstimatedSeconds - timeLimitSeconds);

		const slideBreakdown = slides.map((s) => ({
			slideId: s.id,
			slideNumber: s.slideNumber,
			title: s.title ?? "Untitled",
			estimatedSeconds: s.estimatedDuration ?? 60,
		}));

		const recommendations: string[] = [];

		if (overageSeconds > 0) {
			const overageMinutes = Math.ceil(overageSeconds / 60);
			recommendations.push(`Presentation is ${overageMinutes} minute(s) over the limit. Consider reducing content.`);

			// Find longest slides
			const sortedByDuration = [...slideBreakdown].sort((a, b) => b.estimatedSeconds - a.estimatedSeconds);
			const longestSlides = sortedByDuration.slice(0, 3);
			recommendations.push(`Longest slides: ${longestSlides.map((s) => `Slide ${s.slideNumber} (${Math.ceil(s.estimatedSeconds / 60)}m)`).join(", ")}`);
		} else {
			const bufferSeconds = timeLimitSeconds - totalEstimatedSeconds;
			const bufferMinutes = Math.floor(bufferSeconds / 60);
			if (bufferMinutes >= 5) {
				recommendations.push(`You have ${bufferMinutes} minutes of buffer time. Consider adding content or time for questions.`);
			} else {
				recommendations.push(`On track! ${bufferMinutes} minute(s) buffer for transitions.`);
			}
		}

		// Update presentation total duration
		await db
			.update(oralPresentations)
			.set({
				totalDuration: totalEstimatedSeconds,
				updatedAt: new Date(),
			})
			.where(scopedPresentationWhere(presentationId, context.organizationId));

		return {
			success: true,
			data: {
				isWithinLimit: overageSeconds === 0,
				totalEstimatedSeconds,
				timeLimitSeconds,
				overageSeconds,
				slideBreakdown,
				recommendations,
			},
		};
	} catch (error) {
		logger.error("Failed to validate time limits:", error);
		return { success: false, error: "Failed to validate time limits" };
	}
}

/**
 * Calculate optimal timing per slide based on evaluation criteria weights
 */
export async function calculateSlideTiming(
	presentationId: string
): Promise<ActionResult<Array<{
	slideId: string;
	slideNumber: number;
	currentSeconds: number;
	recommendedSeconds: number;
	adjustmentNeeded: number;
	rationale: string;
}>>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const slides = await db
			.select()
			.from(presentationSlides)
			.where(
				and(
					eq(presentationSlides.presentationId, presentationId),
					eq(presentationSlides.isHidden, false)
				)
			)
			.orderBy(asc(presentationSlides.slideNumber));

		const totalTimeSeconds = (presentation.timeLimit ?? 60) * 60;
		const criteria = (presentation.evaluationCriteria as EvaluationCriterion[] | null) ?? [];

		// Reserve time for intro/outro
		const introOutroTime = 120; // 2 minutes for intro and summary
		const availableContentTime = totalTimeSeconds - introOutroTime;
		const baseTimePerSlide = Math.floor(availableContentTime / Math.max(slides.length - 2, 1));

		const timingAnalysis = slides.map((slide) => {
			let recommendedSeconds = baseTimePerSlide;
			let rationale = "Standard content slide allocation";

			// Adjust based on slide type
			if (slide.slideType === "title") {
				recommendedSeconds = 45;
				rationale = "Title slide - brief introduction";
			} else if (slide.slideType === "section_divider") {
				recommendedSeconds = 30;
				rationale = "Section divider - quick transition";
			} else if (slide.slideType === "qa") {
				recommendedSeconds = 60;
				rationale = "Q&A slide - summary before questions";
			}

			// Adjust based on content density
			const content = slide.content as SlideContent[] | null;
			if (content && content.length > 0) {
				const bulletContent = content.filter((c) => c.type === "bullet");
				const totalBullets = bulletContent.reduce((sum, c) => {
					const data = c.data as string[] | null;
					return sum + (data?.length ?? 0);
				}, 0);

				if (totalBullets > 5) {
					recommendedSeconds = Math.min(recommendedSeconds * 1.3, availableContentTime * 0.15);
					rationale = "Dense content - extended time";
				}
			}

			// Check if slide relates to high-weight criteria
			const relatedReqs = slide.sourceRequirementIds as string[] | null;
			if (relatedReqs && relatedReqs.length > 0 && criteria.length > 0) {
				const highWeightCriteria = criteria.filter((c) => c.weight >= 25);
				if (highWeightCriteria.length > 0) {
					recommendedSeconds = Math.floor(recommendedSeconds * 1.2);
					rationale = "Addresses high-weight criteria - prioritized";
				}
			}

			return {
				slideId: slide.id,
				slideNumber: slide.slideNumber,
				currentSeconds: slide.estimatedDuration ?? 60,
				recommendedSeconds: Math.round(recommendedSeconds),
				adjustmentNeeded: Math.round(recommendedSeconds) - (slide.estimatedDuration ?? 60),
				rationale,
			};
		});

		return { success: true, data: timingAnalysis };
	} catch (error) {
		logger.error("Failed to calculate slide timing:", error);
		return { success: false, error: "Failed to calculate slide timing" };
	}
}

/**
 * Suggest slides to reduce when over time limit
 */
export async function suggestSlideReduction(
	presentationId: string,
	targetMinutes: number
): Promise<ActionResult<{
	currentMinutes: number;
	targetMinutes: number;
	reductionNeeded: number;
	suggestions: Array<{
		slideId: string;
		slideNumber: number;
		title: string;
		currentSeconds: number;
		action: "remove" | "shorten" | "merge";
		savingsSeconds: number;
		impact: "low" | "medium" | "high";
		rationale: string;
	}>;
}>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const slides = await db
			.select()
			.from(presentationSlides)
			.where(
				and(
					eq(presentationSlides.presentationId, presentationId),
					eq(presentationSlides.isHidden, false)
				)
			)
			.orderBy(asc(presentationSlides.slideNumber));

		const currentSeconds = slides.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0);
		const currentMinutes = Math.ceil(currentSeconds / 60);
		const targetSeconds = targetMinutes * 60;
		const reductionNeededSeconds = Math.max(0, currentSeconds - targetSeconds);

		const suggestions: Array<{
			slideId: string;
			slideNumber: number;
			title: string;
			currentSeconds: number;
			action: "remove" | "shorten" | "merge";
			savingsSeconds: number;
			impact: "low" | "medium" | "high";
			rationale: string;
		}> = [];

		if (reductionNeededSeconds > 0) {
			// Sort slides by impact - content slides with less critical info first
			const slidesWithScores = slides.map((slide) => {
				let importanceScore = 50;

				// Essential slides get high importance
				if (slide.slideType === "title") importanceScore = 100;
				if (slide.slideType === "qa") importanceScore = 90;

				// Check for high-weight criteria
				const reqIds = slide.sourceRequirementIds as string[] | null;
				if (reqIds && reqIds.length > 0) importanceScore += 20;

				// Dense content suggests importance
				const content = slide.content as SlideContent[] | null;
				if (content && content.length > 3) importanceScore += 10;

				return { slide, importanceScore };
			});

			// Sort by importance ascending (least important first)
			slidesWithScores.sort((a, b) => a.importanceScore - b.importanceScore);

			let remainingReduction = reductionNeededSeconds;

			for (const { slide, importanceScore } of slidesWithScores) {
				if (remainingReduction <= 0) break;

				// Skip essential slides
				if (slide.slideType === "title" || slide.slideType === "qa") continue;

				const slideDuration = slide.estimatedDuration ?? 60;

				if (importanceScore < 40 && slideDuration <= remainingReduction) {
					// Suggest removal for low-importance slides
					suggestions.push({
						slideId: slide.id,
						slideNumber: slide.slideNumber,
						title: slide.title ?? "Untitled",
						currentSeconds: slideDuration,
						action: "remove",
						savingsSeconds: slideDuration,
						impact: "low",
						rationale: "Low-priority content that can be moved to backup slides",
					});
					remainingReduction -= slideDuration;
				} else if (slideDuration > 90) {
					// Suggest shortening long slides
					const savings = Math.min(slideDuration - 60, remainingReduction);
					suggestions.push({
						slideId: slide.id,
						slideNumber: slide.slideNumber,
						title: slide.title ?? "Untitled",
						currentSeconds: slideDuration,
						action: "shorten",
						savingsSeconds: savings,
						impact: importanceScore > 70 ? "high" : "medium",
						rationale: `Long slide - reduce from ${Math.ceil(slideDuration / 60)}m to ${Math.ceil((slideDuration - savings) / 60)}m`,
					});
					remainingReduction -= savings;
				}
			}

			// If still over, suggest merging similar adjacent slides
			if (remainingReduction > 0) {
				for (let i = 0; i < slides.length - 1; i++) {
					if (remainingReduction <= 0) break;

					const current = slides[i];
					const next = slides[i + 1];

					if (current.slideType === next.slideType && current.slideType === "content") {
						const savings = Math.min(30, remainingReduction);
						suggestions.push({
							slideId: current.id,
							slideNumber: current.slideNumber,
							title: `${current.title ?? "Untitled"} + ${next.title ?? "Untitled"}`,
							currentSeconds: (current.estimatedDuration ?? 60) + (next.estimatedDuration ?? 60),
							action: "merge",
							savingsSeconds: savings,
							impact: "medium",
							rationale: "Similar content slides that could be combined",
						});
						remainingReduction -= savings;
					}
				}
			}
		}

		return {
			success: true,
			data: {
				currentMinutes,
				targetMinutes,
				reductionNeeded: Math.ceil(reductionNeededSeconds / 60),
				suggestions,
			},
		};
	} catch (error) {
		logger.error("Failed to suggest slide reduction:", error);
		return { success: false, error: "Failed to suggest slide reduction" };
	}
}

// ============================================================================
// Practice & Recording Actions
// ============================================================================

/**
 * Record a practice session
 */
export async function recordPractice(
	presentationId: string,
	recordingUrl: string,
	duration: number,
	options?: {
		recordingType?: "full" | "section" | "qa_practice";
		recordedBy?: string;
	}
): Promise<ActionResult<PracticeRecording>> {
	try {
		const context = await requirePresentationContext();
		// Verify presentation exists
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const recordingData: NewPracticeRecording = {
			presentationId,
			recordingUrl,
			duration,
			recordingType: options?.recordingType ?? "full",
			recordedBy: context.userId,
			recordedAt: new Date(),
		};

		const [inserted] = await db
			.insert(practiceRecordings)
			.values(recordingData)
			.returning();

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: inserted };
	} catch (error) {
		logger.error("Failed to record practice:", error);
		return { success: false, error: "Failed to record practice session" };
	}
}

/**
 * Analyze a practice recording
 */
export async function analyzePracticeRecording(
	recordingId: string
): Promise<ActionResult<{
	pacingAnalysis: PacingAnalysis;
	contentCoverage: ContentCoverage[];
	fillerWordAnalysis: FillerWordCount[];
	overallScore: number;
	recommendations: string[];
}>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedRecording(recordingId, context);
		const recording = scoped?.recording;

		if (!recording) {
			return { success: false, error: "Recording not found" };
		}

		// Fetch presentation slides for coverage analysis
		const slides = await db
			.select()
			.from(presentationSlides)
			.where(eq(presentationSlides.presentationId, recording.presentationId!))
			.orderBy(asc(presentationSlides.slideNumber));

		const analysis = generatePracticeAnalysis(recording, slides);

		// Update recording with analysis
		await db
			.update(practiceRecordings)
			.set({
				pacingAnalysis: analysis.pacingAnalysis,
				contentCoverage: analysis.contentCoverage,
				fillerWordAnalysis: analysis.fillerWordAnalysis,
				overallScore: analysis.overallScore,
				recommendations: analysis.recommendations,
			})
			.where(
				and(
					eq(practiceRecordings.id, recordingId),
					eq(practiceRecordings.presentationId, scoped.presentation.id)
				)
			);

		revalidatePath(`/presentations/${recording.presentationId}`);

		return { success: true, data: analysis };
	} catch (error) {
		logger.error("Failed to analyze recording:", error);
		return { success: false, error: "Failed to analyze practice recording" };
	}
}

/**
 * Generate deterministic practice analysis from recording duration, slide timing,
 * and any transcript-like feedback text already attached to the recording.
 */
function generatePracticeAnalysis(
	recording: PracticeRecording,
	slides: PresentationSlide[]
): {
	pacingAnalysis: PacingAnalysis;
	contentCoverage: ContentCoverage[];
	fillerWordAnalysis: FillerWordCount[];
	overallScore: number;
	recommendations: string[];
} {
	const durationSeconds = recording.duration ?? 0;
	const estimatedWords = Math.round(durationSeconds * 2.5); // ~150 WPM average
	const durationMinutes = durationSeconds > 0 ? durationSeconds / 60 : 0;
	const averageWPM = durationMinutes > 0 ? Math.round(estimatedWords / durationMinutes) : 0;
	const targetTotalDuration = slides.reduce((sum, slide) => sum + (slide.estimatedDuration ?? 60), 0) || slides.length * 60;
	const transcriptText = typeof recording.aiFeedback === "string" ? recording.aiFeedback : "";

	const pacingAnalysis: PacingAnalysis = {
		averageWPM,
		variationScore: calculateTimingVariationScore(durationSeconds, targetTotalDuration),
		tooFastSegments: averageWPM > 180 ? [{ startTime: 60, endTime: 120 }] : [],
		tooSlowSegments: averageWPM < 120 ? [{ startTime: 180, endTime: 240 }] : [],
		pauseScore: calculatePauseReadinessScore(durationSeconds, slides.length),
	};

	const contentCoverage: ContentCoverage[] = slides.map((slide) => {
		const targetDuration = slide.estimatedDuration ?? 60;
		const actualDuration = targetTotalDuration > 0
			? Math.round(durationSeconds * (targetDuration / targetTotalDuration))
			: 0;
		const variance = targetDuration > 0 ? Math.abs(actualDuration - targetDuration) / targetDuration : 0;

		return {
			slideId: slide.id,
			slideNumber: slide.slideNumber,
			covered: durationSeconds > 0 && actualDuration >= Math.min(15, targetDuration * 0.25),
			duration: actualDuration,
			targetDuration,
			coverageScore: Math.min(100, Math.max(0, Math.round(100 - variance * 100))),
		};
	});

	const fillerWordAnalysis = countFillerWords(transcriptText);

	const totalFillers = fillerWordAnalysis.reduce((sum, f) => sum + f.count, 0);
	const fillersPerMinute = durationMinutes > 0 ? totalFillers / durationMinutes : 0;

	const pacingScore = averageWPM >= 140 && averageWPM <= 170 ? 90 : averageWPM >= 120 && averageWPM <= 180 ? 75 : 60;
	const coverageScore = contentCoverage.length > 0
		? contentCoverage.reduce((sum, c) => sum + c.coverageScore, 0) / contentCoverage.length
		: 0;
	const fillerScore = fillersPerMinute <= 2 ? 90 : fillersPerMinute <= 4 ? 75 : 60;

	const overallScore = Math.round(pacingScore * 0.3 + coverageScore * 0.5 + fillerScore * 0.2);

	const recommendations: string[] = [];

	if (averageWPM > 170) {
		recommendations.push("Consider slowing down - current pace is above optimal range");
	} else if (averageWPM < 130) {
		recommendations.push("Consider picking up the pace slightly to maintain engagement");
	}

	if (fillersPerMinute > 3) {
		recommendations.push(`Work on reducing filler words (${totalFillers} detected). Practice pausing instead.`);
	}
	if (!transcriptText.trim()) {
		recommendations.push("Attach transcript-backed notes before relying on filler-word coaching.");
	}

	const lowCoverageSlides = contentCoverage.filter((c) => c.coverageScore < 70);
	if (lowCoverageSlides.length > 0) {
		recommendations.push(`Review timing for slides ${lowCoverageSlides.map((s) => s.slideNumber).join(", ")}`);
	}

	if (recommendations.length === 0) {
		recommendations.push("Great practice session! Focus on maintaining consistency.");
	}

	return {
		pacingAnalysis,
		contentCoverage,
		fillerWordAnalysis,
		overallScore,
		recommendations,
	};
}

function calculateTimingVariationScore(durationSeconds: number, targetTotalDuration: number): number {
	if (durationSeconds <= 0 || targetTotalDuration <= 0) return 0;
	const variance = Math.abs(durationSeconds - targetTotalDuration) / targetTotalDuration;
	return Math.min(100, Math.max(0, Math.round(100 - variance * 100)));
}

function calculatePauseReadinessScore(durationSeconds: number, slideCount: number): number {
	if (durationSeconds <= 0 || slideCount <= 0) return 0;
	const secondsPerSlide = durationSeconds / slideCount;
	if (secondsPerSlide >= 45 && secondsPerSlide <= 120) return 90;
	if (secondsPerSlide >= 30 && secondsPerSlide <= 150) return 75;
	return 60;
}

function countFillerWords(transcriptText: string): FillerWordCount[] {
	const normalized = transcriptText.toLowerCase();
	return [
		{ word: "um", pattern: /\bum\b/g },
		{ word: "uh", pattern: /\buh\b/g },
		{ word: "like", pattern: /\blike\b/g },
		{ word: "you know", pattern: /\byou know\b/g },
	].map(({ word, pattern }) => ({
		word,
		count: Array.from(normalized.matchAll(pattern)).length,
		timestamps: [],
	}));
}

/**
 * Get practice history for a presentation
 */
export async function getPracticeHistory(
	presentationId: string
): Promise<ActionResult<PracticeRecording[]>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);
		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const recordings = await db
			.select()
			.from(practiceRecordings)
			.where(eq(practiceRecordings.presentationId, presentationId))
			.orderBy(desc(practiceRecordings.recordedAt));

		return { success: true, data: recordings };
	} catch (error) {
		logger.error("Failed to get practice history:", error);
		return { success: false, error: "Failed to get practice history" };
	}
}

/**
 * Generate AI feedback on a practice session
 */
export async function generatePracticeFeedback(
	recordingId: string
): Promise<ActionResult<string>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedRecording(recordingId, context);
		const recording = scoped?.recording;

		if (!recording) {
			return { success: false, error: "Recording not found" };
		}

		const pacingAnalysis = recording.pacingAnalysis as PacingAnalysis | null;
		const fillerAnalysis = recording.fillerWordAnalysis as FillerWordCount[] | null;
		const coverageAnalysis = recording.contentCoverage as ContentCoverage[] | null;

		const prompt = `Generate constructive feedback for this oral presentation practice session.

PRACTICE SESSION METRICS:
- Duration: ${Math.ceil((recording.duration ?? 0) / 60)} minutes
- Overall Score: ${recording.overallScore ?? "N/A"}/100
- Pacing: ${pacingAnalysis?.averageWPM ?? "Unknown"} words per minute
- Pause Score: ${pacingAnalysis?.pauseScore ?? "Unknown"}/100
- Filler Words: ${fillerAnalysis?.reduce((sum, f) => sum + f.count, 0) ?? "Unknown"} total

${coverageAnalysis ? `SLIDE COVERAGE:\n${coverageAnalysis.slice(0, 5).map((c) => `- Slide ${c.slideNumber}: ${c.coverageScore}%`).join("\n")}` : ""}

Generate personalized feedback that:
1. Highlights what went well
2. Identifies specific areas for improvement
3. Provides actionable tips for the next practice
4. Encourages progress

Keep feedback constructive and motivating. Target 150-200 words.`;

		let feedback: string;

		try {
			const result = await complete(prompt, {
				maxTokens: 400,
				temperature: 0.7,
			});
			feedback = result.content;
		} catch (aiError) {
			logger.error("AI feedback generation failed:", aiError);
			feedback = generateFallbackFeedback(recording);
		}

		// Update recording with feedback
		await db
			.update(practiceRecordings)
			.set({
				aiFeedback: feedback,
			})
			.where(
				and(
					eq(practiceRecordings.id, recordingId),
					eq(practiceRecordings.presentationId, scoped.presentation.id)
				)
			);

		revalidatePath(`/presentations/${recording.presentationId}`);

		return { success: true, data: feedback };
	} catch (error) {
		logger.error("Failed to generate practice feedback:", error);
		return { success: false, error: "Failed to generate practice feedback" };
	}
}

/**
 * Generate fallback feedback when AI is unavailable
 */
function generateFallbackFeedback(recording: PracticeRecording): string {
	const score = recording.overallScore ?? 70;
	const durationMinutes = Math.ceil((recording.duration ?? 0) / 60);

	let feedback = `Practice Session Complete (${durationMinutes} minutes)\n\n`;

	if (score >= 80) {
		feedback += "Excellent work! Your pacing and content coverage are strong. ";
	} else if (score >= 60) {
		feedback += "Good progress! There's room for improvement in some areas. ";
	} else {
		feedback += "Thank you for practicing. Focus on the fundamentals to build confidence. ";
	}

	feedback += "Continue practicing regularly to build muscle memory and confidence. ";
	feedback += "Consider recording yourself and reviewing playback to identify patterns. ";
	feedback += "Remember: each practice session brings you closer to a polished delivery.";

	return feedback;
}

// ============================================================================
// Team Management Actions
// ============================================================================

/**
 * Assign a team member to the presentation
 */
export async function assignTeamMember(
	presentationId: string,
	data: z.infer<typeof TeamMemberInputSchema>
): Promise<ActionResult<PresentationTeamMember>> {
	try {
		const context = await requirePresentationContext();
		const validated = TeamMemberInputSchema.parse(data);

		// Verify presentation exists
		const presentation = await getScopedPresentation(presentationId, context);

		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const teamData: NewPresentationTeamMember = {
			presentationId,
			userId: validated.userId,
			name: validated.name,
			role: validated.role,
			assignedSlideIds: validated.assignedSlideIds ?? [],
			assignedTopics: validated.assignedTopics ?? [],
			estimatedSpeakingTime: validated.estimatedSpeakingTime,
			hasConfirmed: false,
		};

		const [inserted] = await db
			.insert(presentationTeam)
			.values(teamData)
			.returning();

		revalidatePath(`/presentations/${presentationId}`);

		return { success: true, data: inserted };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to assign team member:", error);
		return { success: false, error: "Failed to assign team member" };
	}
}

/**
 * Update a team assignment
 */
export async function updateTeamAssignment(
	id: string,
	data: z.infer<typeof UpdateTeamInputSchema>
): Promise<ActionResult<PresentationTeamMember>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedTeamMember(id, context);
		if (!scoped) {
			return { success: false, error: "Team member not found" };
		}
		const validated = UpdateTeamInputSchema.parse(data);

		const updateData: Partial<NewPresentationTeamMember> = {};

		if (validated.userId !== undefined) updateData.userId = validated.userId;
		if (validated.name !== undefined) updateData.name = validated.name;
		if (validated.role !== undefined) updateData.role = validated.role;
		if (validated.assignedSlideIds !== undefined) updateData.assignedSlideIds = validated.assignedSlideIds;
		if (validated.assignedTopics !== undefined) updateData.assignedTopics = validated.assignedTopics;
		if (validated.estimatedSpeakingTime !== undefined) updateData.estimatedSpeakingTime = validated.estimatedSpeakingTime;
		if (validated.hasConfirmed !== undefined) updateData.hasConfirmed = validated.hasConfirmed;

		const [updated] = await db
			.update(presentationTeam)
			.set(updateData)
			.where(
				and(
					eq(presentationTeam.id, id),
					eq(presentationTeam.presentationId, scoped.presentation.id)
				)
			)
			.returning();

		if (!updated) {
			return { success: false, error: "Team member not found" };
		}

		revalidatePath(`/presentations/${updated.presentationId}`);

		return { success: true, data: updated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		logger.error("Failed to update team assignment:", error);
		return { success: false, error: "Failed to update team assignment" };
	}
}

/**
 * Remove a team member from the presentation
 */
export async function removeTeamMember(id: string): Promise<ActionResult<void>> {
	try {
		const context = await requirePresentationContext();
		const scoped = await getScopedTeamMember(id, context);
		if (!scoped) {
			return { success: false, error: "Team member not found" };
		}

		const [deleted] = await db
			.delete(presentationTeam)
			.where(
				and(
					eq(presentationTeam.id, id),
					eq(presentationTeam.presentationId, scoped.presentation.id)
				)
			)
			.returning();

		if (!deleted) {
			return { success: false, error: "Team member not found" };
		}

		revalidatePath(`/presentations/${deleted.presentationId}`);

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Failed to remove team member:", error);
		return { success: false, error: "Failed to remove team member" };
	}
}

/**
 * List team members for a presentation
 */
export async function listTeamMembers(
	presentationId: string
): Promise<ActionResult<PresentationTeamMember[]>> {
	try {
		const context = await requirePresentationContext();
		const presentation = await getScopedPresentation(presentationId, context);
		if (!presentation) {
			return { success: false, error: "Presentation not found" };
		}

		const team = await db
			.select()
			.from(presentationTeam)
			.where(eq(presentationTeam.presentationId, presentationId));

		return { success: true, data: team };
	} catch (error) {
		logger.error("Failed to list team members:", error);
		return { success: false, error: "Failed to list team members" };
	}
}

// ============================================================================
// Export Actions
// ============================================================================

/**
 * Export presentation to specified format
 */
export async function exportPresentation(
	presentationId: string,
	format: "pptx" | "pdf" | "html"
): Promise<ActionResult<{ downloadUrl: string; format: string; filename: string; mimeType: string }>> {
	try {
		const presentationResult = await getPresentation(presentationId);

		if (!presentationResult.success) {
			return { success: false, error: (presentationResult as { success: false; error: string }).error };
		}

		const { presentation, slides, team } = presentationResult.data;

		const exportData: PresentationExportDeck = {
			title: presentation.title,
			description: presentation.description,
			presentationDate: presentation.presentationDate,
			venue: presentation.venue,
			isVirtual: presentation.isVirtual,
			theme: presentation.theme,
			customBranding: presentation.customBranding,
			slides: slides.map((slide) => ({
				slideNumber: slide.slideNumber,
				slideType: slide.slideType,
				title: slide.title,
				content: slide.content,
				speakerNotes: slide.speakerNotes,
				layout: slide.layout,
				backgroundImage: slide.backgroundImage,
				backgroundColor: slide.backgroundColor,
			})),
			team: team.map((member) => ({
				name: member.name,
				role: member.role,
				assignedSlideIds: member.assignedSlideIds,
			})),
		};

		// Generate unique filename
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = `presentation-${presentationId.slice(0, 8)}-${timestamp}.${format}`;
		const artifact = await buildPresentationExportArtifact(exportData, format, filename);

		return {
			success: true,
			data: {
				downloadUrl: artifact.downloadUrl,
				format,
				filename: artifact.filename,
				mimeType: artifact.mimeType,
			},
		};
	} catch (error) {
		logger.error("Failed to export presentation:", error);
		return { success: false, error: "Failed to export presentation" };
	}
}

/**
 * Generate audience handout
 */
export async function generateHandout(
	presentationId: string
): Promise<ActionResult<{ downloadUrl: string; pageCount: number }>> {
	try {
		const presentationResult = await getPresentation(presentationId);

		if (!presentationResult.success) {
			return { success: false, error: (presentationResult as { success: false; error: string }).error };
		}

		const { presentation, slides, team } = presentationResult.data;

		// Build handout content
		const handoutSections: Array<{
			title: string;
			content: string;
			slideNumber?: number;
		}> = [];

		// Title page
		handoutSections.push({
			title: presentation.title,
			content: presentation.description ?? "",
		});

		// Agenda
		handoutSections.push({
			title: "Agenda",
			content: slides
				.filter((s) => s.slideType === "section_divider" || s.slideNumber <= 3)
				.map((s) => `- ${s.title ?? "Untitled"}`)
				.join("\n"),
		});

		// Key slides summary
		for (const slide of slides) {
			if (slide.isHidden) continue;

			const content = slide.content as SlideContent[] | null;
			let slideContent = "";

			if (content) {
				for (const item of content) {
					if (item.type === "bullet" && Array.isArray(item.data)) {
						slideContent += (item.data as string[]).map((b) => `• ${b}`).join("\n");
					} else if (item.type === "text" && typeof item.data === "string") {
						slideContent += item.data;
					}
				}
			}

			handoutSections.push({
				title: slide.title ?? `Slide ${slide.slideNumber}`,
				content: slideContent,
				slideNumber: slide.slideNumber,
			});
		}

		// Team
		if (team.length > 0) {
			handoutSections.push({
				title: "Presentation Team",
				content: team.map((m) => `${m.name} - ${m.role}`).join("\n"),
			});
		}

		// Estimate page count (roughly 3 slides per page)
		const pageCount = Math.ceil(handoutSections.length / 3);

		// Generate download URL
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = `handout-${presentationId.slice(0, 8)}-${timestamp}.pdf`;
		const downloadUrl = `/api/presentations/handout?id=${presentationId}&filename=${encodeURIComponent(filename)}`;

		return {
			success: true,
			data: {
				downloadUrl,
				pageCount,
			},
		};
	} catch (error) {
		logger.error("Failed to generate handout:", error);
		return { success: false, error: "Failed to generate handout" };
	}
}
