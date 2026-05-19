/**
 * Calendar & Deadline Server Actions - DocFusion
 *
 * Server actions for managing deadlines, calendar views, and milestone tracking.
 * Aggregates deadlines from opportunities, rfpRequirements, proposal documents,
 * and document sections into unified calendar views.
 */

"use server";

import { db } from "@/lib/db";
import {
	opportunities,
	rfpRequirements,
	proposalDocuments,
	documentSections,
	documents,
} from "@/lib/db/schema";
import { eq, gte, lte, and, or, isNotNull, desc, asc, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth-utils";
import type {
	DeadlineItem,
	DeadlineType,
	DeadlineUrgency,
	DeadlineFilters,
	DateRangeInput,
	UpcomingDeadlinesInput,
	DeadlinesByDate,
	CalendarMonthSummary,
	OpportunityMilestone,
	DeadlineStats,
	ICSEvent,
	ICSExportOptions,
} from "@/lib/types/opportunity";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate days until a deadline from now.
 */
function calculateDaysUntil(deadline: Date): number {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const deadlineDate = new Date(deadline);
	deadlineDate.setHours(0, 0, 0, 0);
	const diffMs = deadlineDate.getTime() - now.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine urgency based on days remaining.
 */
function calculateUrgency(daysUntil: number): DeadlineUrgency {
	if (daysUntil < 0) return "overdue";
	if (daysUntil <= 3) return "critical";
	if (daysUntil <= 7) return "urgent";
	if (daysUntil <= 14) return "upcoming";
	return "normal";
}

/**
 * Format date to ISO date string (YYYY-MM-DD).
 */
function toDateString(date: Date): string {
	return date.toISOString().split("T")[0];
}

/**
 * Parse date input (Date or string) to Date object.
 */
function parseDate(input: Date | string): Date {
	return input instanceof Date ? input : new Date(input);
}

/**
 * Check if a deadline item matches the filters.
 */
function matchesFilters(item: DeadlineItem, filters?: DeadlineFilters): boolean {
	if (!filters) return true;

	if (filters.types && !filters.types.includes(item.type)) {
		return false;
	}

	if (filters.urgencies && !filters.urgencies.includes(item.urgency)) {
		return false;
	}

	if (filters.opportunityIds && !filters.opportunityIds.includes(item.opportunityId)) {
		return false;
	}

	if (filters.assignedTo && item.assignedTo !== filters.assignedTo) {
		return false;
	}

	if (filters.search) {
		const searchLower = filters.search.toLowerCase();
		const matches =
			item.title.toLowerCase().includes(searchLower) ||
			item.opportunityTitle.toLowerCase().includes(searchLower) ||
			(item.description?.toLowerCase().includes(searchLower) ?? false);
		if (!matches) return false;
	}

	return true;
}

// ============================================================================
// Deadline Fetching Functions
// ============================================================================

/**
 * Fetch opportunity deadlines within a date range.
 */
async function fetchOpportunityDeadlines(
	startDate: Date,
	endDate: Date
): Promise<DeadlineItem[]> {
	const rows = await db
		.select({
			id: opportunities.id,
			title: opportunities.title,
			deadline: opportunities.deadline,
			organization: opportunities.organization,
			decisionStatus: opportunities.decisionStatus,
			assignedTo: opportunities.assignedTo,
		})
		.from(opportunities)
		.where(
			and(
				isNotNull(opportunities.deadline),
				gte(opportunities.deadline, startDate),
				lte(opportunities.deadline, endDate)
			)
		);

	return rows
		.filter((row) => row.deadline !== null)
		.map((row) => {
			const deadline = row.deadline!;
			const daysUntil = calculateDaysUntil(deadline);
			return {
				id: `opp-${row.id}`,
				type: "opportunity" as DeadlineType,
				title: row.title,
				description: row.organization,
				deadline,
				daysUntil,
				urgency: calculateUrgency(daysUntil),
				sourceId: row.id,
				opportunityId: row.id,
				opportunityTitle: row.title,
				assignedTo: row.assignedTo,
				status: row.decisionStatus,
			};
		});
}

/**
 * Fetch requirement deadlines within a date range.
 */
async function fetchRequirementDeadlines(
	startDate: Date,
	endDate: Date
): Promise<DeadlineItem[]> {
	const rows = await db
		.select({
			id: rfpRequirements.id,
			text: rfpRequirements.requirementText,
			requirementId: rfpRequirements.requirementNumber,
			dueDate: rfpRequirements.dueDate,
			complianceStatus: rfpRequirements.complianceStatus,
			assignedTo: rfpRequirements.assignedTo,
			opportunityId: rfpRequirements.opportunityId,
			opportunityTitle: opportunities.title,
		})
		.from(rfpRequirements)
		.innerJoin(opportunities, eq(rfpRequirements.opportunityId, opportunities.id))
		.where(
			and(
				isNotNull(rfpRequirements.dueDate),
				gte(rfpRequirements.dueDate, startDate),
				lte(rfpRequirements.dueDate, endDate)
			)
		);

	return rows
		.filter((row) => row.dueDate !== null)
		.map((row) => {
			const deadline = row.dueDate!;
			const daysUntil = calculateDaysUntil(deadline);
			const reqLabel = row.requirementId || `REQ-${row.id.slice(0, 8)}`;
			return {
				id: `req-${row.id}`,
				type: "requirement" as DeadlineType,
				title: `${reqLabel}: ${row.text.slice(0, 80)}${row.text.length > 80 ? "..." : ""}`,
				description: row.text,
				deadline,
				daysUntil,
				urgency: calculateUrgency(daysUntil),
				sourceId: row.id,
				opportunityId: row.opportunityId ?? "",
				opportunityTitle: row.opportunityTitle,
				assignedTo: row.assignedTo,
				status: row.complianceStatus,
			};
		});
}

/**
 * Fetch proposal document deadlines within a date range.
 */
async function fetchProposalDocumentDeadlines(
	startDate: Date,
	endDate: Date
): Promise<DeadlineItem[]> {
	const rows = await db
		.select({
			id: proposalDocuments.id,
			documentType: proposalDocuments.documentType,
			dueDate: proposalDocuments.dueDate,
			status: proposalDocuments.status,
			assignedTo: proposalDocuments.assignedTo,
			opportunityId: proposalDocuments.opportunityId,
			opportunityTitle: opportunities.title,
			documentTitle: documents.title,
		})
		.from(proposalDocuments)
		.innerJoin(opportunities, eq(proposalDocuments.opportunityId, opportunities.id))
		.innerJoin(documents, eq(proposalDocuments.documentId, documents.id))
		.where(
			and(
				isNotNull(proposalDocuments.dueDate),
				gte(proposalDocuments.dueDate, startDate),
				lte(proposalDocuments.dueDate, endDate)
			)
		);

	return rows
		.filter((row) => row.dueDate !== null)
		.map((row) => {
			const deadline = row.dueDate!;
			const daysUntil = calculateDaysUntil(deadline);
			return {
				id: `doc-${row.id}`,
				type: "proposal_document" as DeadlineType,
				title: row.documentTitle || formatDocumentType(row.documentType),
				description: `${formatDocumentType(row.documentType)} for ${row.opportunityTitle}`,
				deadline,
				daysUntil,
				urgency: calculateUrgency(daysUntil),
				sourceId: row.id,
				opportunityId: row.opportunityId,
				opportunityTitle: row.opportunityTitle,
				assignedTo: row.assignedTo,
				status: row.status,
			};
		});
}

/**
 * Fetch document section deadlines within a date range.
 */
async function fetchSectionDeadlines(
	startDate: Date,
	endDate: Date
): Promise<DeadlineItem[]> {
	const rows = await db
		.select({
			id: documentSections.id,
			sectionName: documentSections.sectionName,
			dueDate: documentSections.dueDate,
			status: documentSections.status,
			assignedTo: documentSections.assignedTo,
			proposalDocumentId: documentSections.proposalDocumentId,
			documentType: proposalDocuments.documentType,
			opportunityId: proposalDocuments.opportunityId,
			opportunityTitle: opportunities.title,
		})
		.from(documentSections)
		.innerJoin(
			proposalDocuments,
			eq(documentSections.proposalDocumentId, proposalDocuments.id)
		)
		.innerJoin(opportunities, eq(proposalDocuments.opportunityId, opportunities.id))
		.where(
			and(
				isNotNull(documentSections.dueDate),
				gte(documentSections.dueDate, startDate),
				lte(documentSections.dueDate, endDate)
			)
		);

	return rows
		.filter((row) => row.dueDate !== null)
		.map((row) => {
			const deadline = row.dueDate!;
			const daysUntil = calculateDaysUntil(deadline);
			return {
				id: `sec-${row.id}`,
				type: "document_section" as DeadlineType,
				title: row.sectionName,
				description: `Section in ${formatDocumentType(row.documentType)}`,
				deadline,
				daysUntil,
				urgency: calculateUrgency(daysUntil),
				sourceId: row.id,
				opportunityId: row.opportunityId,
				opportunityTitle: row.opportunityTitle,
				assignedTo: row.assignedTo,
				status: row.status,
			};
		});
}

/**
 * Format document type for display.
 */
function formatDocumentType(type: string): string {
	const labels: Record<string, string> = {
		technical_approach: "Technical Approach",
		management_plan: "Management Plan",
		past_performance: "Past Performance",
		cost_proposal: "Cost Proposal",
		cover_letter: "Cover Letter",
		executive_summary: "Executive Summary",
		staffing_plan: "Staffing Plan",
		quality_assurance: "Quality Assurance",
		risk_mitigation: "Risk Mitigation",
		appendix: "Appendix",
		other: "Other",
	};
	return labels[type] || type;
}

// ============================================================================
// Public Server Actions
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

/**
 * Get all deadlines within a date range.
 */
export async function getDeadlinesByDateRange(
	input: DateRangeInput
): Promise<DeadlineItem[]> {
	await requireCurrentUserId();

	const startDate = parseDate(input.startDate);
	const endDate = parseDate(input.endDate);

	// Fetch deadlines from all sources in parallel
	const [oppDeadlines, reqDeadlines, docDeadlines, secDeadlines] =
		await Promise.all([
			fetchOpportunityDeadlines(startDate, endDate),
			fetchRequirementDeadlines(startDate, endDate),
			fetchProposalDocumentDeadlines(startDate, endDate),
			fetchSectionDeadlines(startDate, endDate),
		]);

	// Combine and filter
	const allDeadlines = [
		...oppDeadlines,
		...reqDeadlines,
		...docDeadlines,
		...secDeadlines,
	].filter((item) => matchesFilters(item, input.filters));

	// Sort by deadline
	allDeadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

	return allDeadlines;
}

/**
 * Get upcoming deadlines within N days.
 */
export async function getUpcomingDeadlines(
	input: UpcomingDeadlinesInput
): Promise<DeadlineItem[]> {
	await requireCurrentUserId();

	const now = new Date();
	const endDate = new Date();
	endDate.setDate(endDate.getDate() + input.days);

	const deadlines = await getDeadlinesByDateRange({
		startDate: now,
		endDate,
		filters: input.filters,
	});

	// Apply limit if specified
	if (input.limit && deadlines.length > input.limit) {
		return deadlines.slice(0, input.limit);
	}

	return deadlines;
}

/**
 * Get all overdue items.
 */
export async function getOverdueItems(
	filters?: DeadlineFilters
): Promise<DeadlineItem[]> {
	await requireCurrentUserId();

	const now = new Date();
	const farPast = new Date("2000-01-01");

	// Get all items from far past to now
	const items = await getDeadlinesByDateRange({
		startDate: farPast,
		endDate: now,
		filters,
	});

	// Filter to only overdue (negative daysUntil)
	return items.filter((item) => item.daysUntil < 0);
}

/**
 * Get milestones for a specific opportunity.
 */
export async function getMilestones(
	opportunityId: string
): Promise<OpportunityMilestone[]> {
	await requireCurrentUserId();

	const milestones: OpportunityMilestone[] = [];
	const now = new Date();

	// 1. Get the opportunity deadline
	const [opportunity] = await db
		.select({
			id: opportunities.id,
			title: opportunities.title,
			deadline: opportunities.deadline,
			decisionStatus: opportunities.decisionStatus,
			assignedTo: opportunities.assignedTo,
		})
		.from(opportunities)
		.where(eq(opportunities.id, opportunityId))
		.limit(1);

	if (opportunity?.deadline) {
		const isOverdue = opportunity.deadline < now;
		const isCompleted = ["submitted", "won", "lost"].includes(
			opportunity.decisionStatus
		);
		milestones.push({
			id: `opp-${opportunity.id}`,
			type: "opportunity",
			title: "RFP Response Deadline",
			date: opportunity.deadline,
			status: isCompleted
				? "completed"
				: isOverdue
					? "overdue"
					: "pending",
			description: `Submit response for ${opportunity.title}`,
			assignedTo: opportunity.assignedTo,
		});
	}

	// 2. Get requirement deadlines for this opportunity
	const reqRows = await db
		.select({
			id: rfpRequirements.id,
			requirementId: rfpRequirements.requirementNumber,
			text: rfpRequirements.requirementText,
			dueDate: rfpRequirements.dueDate,
			complianceStatus: rfpRequirements.complianceStatus,
			assignedTo: rfpRequirements.assignedTo,
		})
		.from(rfpRequirements)
		.where(
			and(
				eq(rfpRequirements.opportunityId, opportunityId),
				isNotNull(rfpRequirements.dueDate)
			)
		);

	for (const req of reqRows) {
		if (!req.dueDate) continue;
		const isOverdue = req.dueDate < now;
		const isCompleted = ["compliant", "not_applicable"].includes(
			req.complianceStatus
		);
		const reqLabel = req.requirementId || `REQ-${req.id.slice(0, 8)}`;
		milestones.push({
			id: `req-${req.id}`,
			type: "requirement",
			title: `${reqLabel}: Address Requirement`,
			date: req.dueDate,
			status: isCompleted
				? "completed"
				: isOverdue
					? "overdue"
					: req.complianceStatus === "partial"
						? "in_progress"
						: "pending",
			description: req.text.slice(0, 100) + (req.text.length > 100 ? "..." : ""),
			assignedTo: req.assignedTo,
			requirementId: req.id,
		});
	}

	// 3. Get proposal document deadlines for this opportunity
	const docRows = await db
		.select({
			id: proposalDocuments.id,
			documentId: proposalDocuments.documentId,
			documentType: proposalDocuments.documentType,
			dueDate: proposalDocuments.dueDate,
			status: proposalDocuments.status,
			assignedTo: proposalDocuments.assignedTo,
			documentTitle: documents.title,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(proposalDocuments.documentId, documents.id))
		.where(
			and(
				eq(proposalDocuments.opportunityId, opportunityId),
				isNotNull(proposalDocuments.dueDate)
			)
		);

	for (const doc of docRows) {
		if (!doc.dueDate) continue;
		const isOverdue = doc.dueDate < now;
		const isCompleted = ["approved", "final"].includes(doc.status);
		milestones.push({
			id: `doc-${doc.id}`,
			type: "proposal_document",
			title: doc.documentTitle || formatDocumentType(doc.documentType),
			date: doc.dueDate,
			status: isCompleted
				? "completed"
				: isOverdue
					? "overdue"
					: ["drafting", "in_review", "revising"].includes(doc.status)
						? "in_progress"
						: "pending",
			description: `Complete ${formatDocumentType(doc.documentType)}`,
			assignedTo: doc.assignedTo,
			documentId: doc.documentId,
		});
	}

	// 4. Get document section deadlines for this opportunity
	const secRows = await db
		.select({
			id: documentSections.id,
			sectionName: documentSections.sectionName,
			dueDate: documentSections.dueDate,
			status: documentSections.status,
			assignedTo: documentSections.assignedTo,
			documentType: proposalDocuments.documentType,
		})
		.from(documentSections)
		.innerJoin(
			proposalDocuments,
			eq(documentSections.proposalDocumentId, proposalDocuments.id)
		)
		.where(
			and(
				eq(proposalDocuments.opportunityId, opportunityId),
				isNotNull(documentSections.dueDate)
			)
		);

	for (const sec of secRows) {
		if (!sec.dueDate) continue;
		const isOverdue = sec.dueDate < now;
		const isCompleted = ["approved", "final"].includes(sec.status);
		milestones.push({
			id: `sec-${sec.id}`,
			type: "document_section",
			title: sec.sectionName,
			date: sec.dueDate,
			status: isCompleted
				? "completed"
				: isOverdue
					? "overdue"
					: ["drafting", "in_review", "revising"].includes(sec.status)
						? "in_progress"
						: "pending",
			description: `Section in ${formatDocumentType(sec.documentType)}`,
			assignedTo: sec.assignedTo,
		});
	}

	// Sort by date
	milestones.sort((a, b) => a.date.getTime() - b.date.getTime());

	return milestones;
}

/**
 * Get deadlines grouped by date for calendar view.
 */
export async function getDeadlinesGroupedByDate(
	input: DateRangeInput
): Promise<DeadlinesByDate[]> {
	await requireCurrentUserId();

	const deadlines = await getDeadlinesByDateRange(input);

	// Group by date
	const byDate = new Map<string, DeadlineItem[]>();

	for (const item of deadlines) {
		const dateKey = toDateString(item.deadline);
		const existing = byDate.get(dateKey) || [];
		existing.push(item);
		byDate.set(dateKey, existing);
	}

	// Convert to array
	const result: DeadlinesByDate[] = [];
	for (const [date, items] of byDate.entries()) {
		result.push({
			date,
			items,
			count: items.length,
		});
	}

	// Sort by date
	result.sort((a, b) => a.date.localeCompare(b.date));

	return result;
}

/**
 * Get calendar month summary.
 */
export async function getCalendarMonthSummary(
	month: number,
	year: number,
	filters?: DeadlineFilters
): Promise<CalendarMonthSummary> {
	await requireCurrentUserId();

	// Calculate start and end of month
	const startDate = new Date(year, month - 1, 1);
	const endDate = new Date(year, month, 0, 23, 59, 59, 999);

	const byDate = await getDeadlinesGroupedByDate({
		startDate,
		endDate,
		filters,
	});

	// Calculate stats
	let totalDeadlines = 0;
	let overdueCount = 0;
	let criticalCount = 0;
	let urgentCount = 0;

	for (const day of byDate) {
		totalDeadlines += day.count;
		for (const item of day.items) {
			if (item.urgency === "overdue") overdueCount++;
			if (item.urgency === "critical") criticalCount++;
			if (item.urgency === "urgent") urgentCount++;
		}
	}

	return {
		month,
		year,
		totalDeadlines,
		byDate,
		overdueCount,
		criticalCount,
		urgentCount,
	};
}

/**
 * Get deadline statistics.
 */
export async function getDeadlineStats(
	filters?: DeadlineFilters
): Promise<DeadlineStats> {
	await requireCurrentUserId();

	const now = new Date();
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);

	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const endOfWeek = new Date(today);
	endOfWeek.setDate(endOfWeek.getDate() + 7);

	const endOfMonth = new Date(today);
	endOfMonth.setMonth(endOfMonth.getMonth() + 1);

	// Fetch all upcoming deadlines (next 90 days) + overdue
	const farPast = new Date("2000-01-01");
	const farFuture = new Date();
	farFuture.setDate(farFuture.getDate() + 90);

	const allDeadlines = await getDeadlinesByDateRange({
		startDate: farPast,
		endDate: farFuture,
		filters,
	});

	// Calculate stats
	const stats: DeadlineStats = {
		total: allDeadlines.length,
		overdue: 0,
		dueToday: 0,
		dueThisWeek: 0,
		dueThisMonth: 0,
		byType: {
			opportunity: 0,
			requirement: 0,
			proposal_document: 0,
			document_section: 0,
			review: 0,
			submission: 0,
		},
		byUrgency: {
			overdue: 0,
			critical: 0,
			urgent: 0,
			upcoming: 0,
			normal: 0,
		},
		nextDeadline: null,
	};

	for (const item of allDeadlines) {
		// Count by type
		stats.byType[item.type]++;

		// Count by urgency
		stats.byUrgency[item.urgency]++;

		// Count overdue
		if (item.daysUntil < 0) {
			stats.overdue++;
		}

		// Count due today
		if (item.daysUntil === 0) {
			stats.dueToday++;
		}

		// Count due this week
		if (item.daysUntil >= 0 && item.daysUntil <= 7) {
			stats.dueThisWeek++;
		}

		// Count due this month
		if (item.daysUntil >= 0 && item.daysUntil <= 30) {
			stats.dueThisMonth++;
		}

		// Track next deadline (first non-overdue)
		if (item.daysUntil >= 0 && !stats.nextDeadline) {
			stats.nextDeadline = item;
		}
	}

	return stats;
}

/**
 * Get deadlines for today.
 */
export async function getTodaysDeadlines(
	filters?: DeadlineFilters
): Promise<DeadlineItem[]> {
	await requireCurrentUserId();

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	return getDeadlinesByDateRange({
		startDate: today,
		endDate: tomorrow,
		filters,
	});
}

/**
 * Get deadlines assigned to a specific user.
 */
export async function getDeadlinesForUser(
	userId: string,
	days: number = 30
): Promise<DeadlineItem[]> {
	await requireCurrentUserId();

	return getUpcomingDeadlines({
		days,
		filters: { assignedTo: userId },
	});
}

// ============================================================================
// ICS Calendar Export (RFC 5545)
// ============================================================================

/**
 * Generate an ICS calendar file for deadlines.
 * Returns RFC 5545 compliant iCalendar format string.
 */
export async function exportToICS(
	options: ICSExportOptions = {}
): Promise<string> {
	await requireCurrentUserId();

	const {
		includeAlarm = true,
		alarmMinutes = 1440, // 24 hours before by default
		calendarName = "DocFusion Deadlines",
		filters,
	} = options;

	// Get upcoming deadlines (next 90 days)
	const deadlines = await getUpcomingDeadlines({
		days: 90,
		filters,
	});

	// Also get overdue items
	const overdueItems = await getOverdueItems(filters);

	// Combine and dedupe
	const allItems = [...overdueItems, ...deadlines];
	const uniqueItems = Array.from(
		new Map(allItems.map((item) => [item.id, item])).values()
	);

	// Convert to ICS events
	const events = uniqueItems.map((item) =>
		deadlineToICSEvent(item, includeAlarm, alarmMinutes)
	);

	// Generate ICS content
	return generateICSContent(events, calendarName);
}

/**
 * Export a single deadline to ICS.
 */
export async function exportDeadlineToICS(
	deadlineId: string,
	options: Omit<ICSExportOptions, "filters"> = {}
): Promise<string | null> {
	await requireCurrentUserId();

	const { includeAlarm = true, alarmMinutes = 1440 } = options;

	// Get all deadlines in a wide range to find the specific one
	const allDeadlines = await getDeadlinesByDateRange({
		startDate: new Date("2000-01-01"),
		endDate: new Date("2100-01-01"),
	});

	const deadline = allDeadlines.find((d) => d.id === deadlineId);
	if (!deadline) {
		return null;
	}

	const event = deadlineToICSEvent(deadline, includeAlarm, alarmMinutes);
	return generateICSContent([event], "DocFusion Deadline");
}

/**
 * Export milestones for an opportunity to ICS.
 */
export async function exportOpportunityMilestonesToICS(
	opportunityId: string,
	options: Omit<ICSExportOptions, "filters"> = {}
): Promise<string> {
	await requireCurrentUserId();

	const { includeAlarm = true, alarmMinutes = 1440 } = options;

	const milestones = await getMilestones(opportunityId);

	const events: ICSEvent[] = milestones.map((milestone) => ({
		uid: `${milestone.id}@docfusion`,
		summary: milestone.title,
		description: milestone.description,
		start: milestone.date,
		end: new Date(milestone.date.getTime() + 60 * 60 * 1000), // 1 hour duration
		location: null,
		url: `/opportunities/${opportunityId}`,
		categories: [milestone.type],
		alarm: includeAlarm
			? {
					trigger: alarmMinutes,
					action: "DISPLAY",
					description: `Reminder: ${milestone.title}`,
				}
			: undefined,
	}));

	return generateICSContent(events, "DocFusion Opportunity Milestones");
}

/**
 * Convert a deadline item to an ICS event.
 */
function deadlineToICSEvent(
	deadline: DeadlineItem,
	includeAlarm: boolean,
	alarmMinutes: number
): ICSEvent {
	// End time is 1 hour after start (for all-day events we could use DATE instead)
	const endTime = new Date(deadline.deadline.getTime() + 60 * 60 * 1000);

	return {
		uid: `${deadline.id}@docfusion`,
		summary: `[${formatDeadlineType(deadline.type)}] ${deadline.title}`,
		description: formatEventDescription(deadline),
		start: deadline.deadline,
		end: endTime,
		location: null,
		url: getDeadlineUrl(deadline),
		categories: [deadline.type, deadline.urgency],
		alarm: includeAlarm
			? {
					trigger: alarmMinutes,
					action: "DISPLAY",
					description: `Deadline approaching: ${deadline.title}`,
				}
			: undefined,
	};
}

/**
 * Format deadline type for display.
 */
function formatDeadlineType(type: DeadlineType): string {
	const labels: Record<DeadlineType, string> = {
		opportunity: "RFP",
		requirement: "REQ",
		proposal_document: "DOC",
		document_section: "SEC",
		review: "REV",
		submission: "SUB",
	};
	return labels[type] || type;
}

/**
 * Format event description with deadline details.
 */
function formatEventDescription(deadline: DeadlineItem): string {
	const lines: string[] = [];

	lines.push(`Opportunity: ${deadline.opportunityTitle}`);

	if (deadline.description) {
		lines.push(`Description: ${deadline.description}`);
	}

	if (deadline.assignedTo) {
		lines.push(`Assigned to: ${deadline.assignedTo}`);
	}

	if (deadline.status) {
		lines.push(`Status: ${deadline.status}`);
	}

	lines.push(`Type: ${formatDocumentType(deadline.type)}`);
	lines.push(`Urgency: ${deadline.urgency}`);

	return lines.join("\n");
}

/**
 * Get URL for a deadline item.
 */
function getDeadlineUrl(deadline: DeadlineItem): string {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

	switch (deadline.type) {
		case "opportunity":
			return `${baseUrl}/opportunities/${deadline.opportunityId}`;
		case "requirement":
			return `${baseUrl}/opportunities/${deadline.opportunityId}/requirements`;
		case "proposal_document":
		case "document_section":
			return `${baseUrl}/opportunities/${deadline.opportunityId}/documents`;
		case "submission":
			return `${baseUrl}/opportunities/${deadline.opportunityId}/submission`;
		default:
			return `${baseUrl}/opportunities/${deadline.opportunityId}`;
	}
}

/**
 * Generate RFC 5545 compliant ICS content.
 */
function generateICSContent(events: ICSEvent[], calendarName: string): string {
	const lines: string[] = [];

	// Calendar header
	lines.push("BEGIN:VCALENDAR");
	lines.push("VERSION:2.0");
	lines.push("PRODID:-//DocFusion//Deadline Calendar//EN");
	lines.push("CALSCALE:GREGORIAN");
	lines.push("METHOD:PUBLISH");
	lines.push(`X-WR-CALNAME:${escapeICSText(calendarName)}`);
	lines.push("X-WR-TIMEZONE:UTC");

	// Events
	for (const event of events) {
		lines.push("BEGIN:VEVENT");
		lines.push(`UID:${event.uid}`);
		lines.push(`DTSTAMP:${formatICSDateTime(new Date())}`);
		lines.push(`DTSTART:${formatICSDateTime(event.start)}`);
		lines.push(`DTEND:${formatICSDateTime(event.end)}`);
		lines.push(`SUMMARY:${escapeICSText(event.summary)}`);

		if (event.description) {
			lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
		}

		if (event.location) {
			lines.push(`LOCATION:${escapeICSText(event.location)}`);
		}

		if (event.url) {
			lines.push(`URL:${event.url}`);
		}

		if (event.categories.length > 0) {
			lines.push(`CATEGORIES:${event.categories.join(",")}`);
		}

		// Alarm
		if (event.alarm) {
			lines.push("BEGIN:VALARM");
			lines.push(`TRIGGER:-PT${event.alarm.trigger}M`);
			lines.push(`ACTION:${event.alarm.action}`);
			lines.push(`DESCRIPTION:${escapeICSText(event.alarm.description)}`);
			lines.push("END:VALARM");
		}

		lines.push("END:VEVENT");
	}

	// Calendar footer
	lines.push("END:VCALENDAR");

	return lines.join("\r\n");
}

/**
 * Format a Date to ICS datetime format (UTC).
 */
function formatICSDateTime(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	const hours = String(date.getUTCHours()).padStart(2, "0");
	const minutes = String(date.getUTCMinutes()).padStart(2, "0");
	const seconds = String(date.getUTCSeconds()).padStart(2, "0");

	return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text for ICS format.
 * Handles special characters and line folding.
 */
function escapeICSText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "");
}
