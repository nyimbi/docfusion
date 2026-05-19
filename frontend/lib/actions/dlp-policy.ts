"use server";

import { db } from "@/lib/db";
import { documents, proposalDocuments } from "@/lib/db/schema";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import {
	hasBlockingDlpFindings,
	scanDocumentsForDlpFindings,
	type DlpFinding,
	type DlpSeverity,
} from "@/lib/security/dlp-policy";
import { and, eq, sql, type SQL } from "drizzle-orm";

export interface DlpPolicyEvaluationResult {
	opportunityId: string;
	allowed: boolean;
	findings: DlpFinding[];
	blockingCount: number;
	workflowInstanceIds: string[];
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleProposalDocumentsForOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

export async function evaluateDlpExportPolicyWorkflow(
	opportunityId: string
): Promise<DlpPolicyEvaluationResult> {
	const userContext = await requireUserContext();
	const docs = await db
		.select({
			documentId: proposalDocuments.documentId,
			title: documents.title,
			content: documents.content,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(proposalDocuments.documentId, documents.id))
		.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, userContext.userId));

	const findings = scanDocumentsForDlpFindings(docs.map((doc) => ({
		documentId: doc.documentId,
		title: doc.title,
		content: doc.content,
	})));
	const workflowInstanceIds: string[] = [];

	if (!findings.length) {
		const instance = await recordWorkflowRuntimeTransition({
			workflowKey: "privacy_dlp_export_gate",
			subjectType: "opportunity_dlp_scan",
			subjectId: opportunityId,
			opportunityId,
			toState: "cleared",
			eventType: "dlp_scan_cleared",
			actorId: userContext.userId,
			reason: "No DLP findings detected in proposal documents",
			priority: "low",
			metadata: { findingCount: 0 },
			terminal: true,
		});
		workflowInstanceIds.push(instance.id);
		return {
			opportunityId,
			allowed: true,
			findings,
			blockingCount: 0,
			workflowInstanceIds,
		};
	}

	for (const finding of findings) {
		const blocking = isBlockingSeverity(finding.severity);
		const instance = await recordWorkflowRuntimeTransition({
			workflowKey: "privacy_dlp_export_gate",
			subjectType: "dlp_finding",
			subjectId: finding.id,
			opportunityId,
			toState: blocking ? "review_required" : "advisory",
			eventType: "dlp_finding_detected",
			actorId: userContext.userId,
			reason: `${finding.label}: ${finding.recommendation}`,
			priority: priorityForSeverity(finding.severity),
			assignedRole: blocking ? "security_reviewer" : null,
			dueAt: blocking ? nextUtcDay() : null,
			metadata: {
				documentId: finding.documentId,
				title: finding.title,
				category: finding.category,
				severity: finding.severity,
				label: finding.label,
				excerpt: finding.excerpt,
			},
			terminal: !blocking,
			actionUrl: `/documents/${finding.documentId}`,
		});
		workflowInstanceIds.push(instance.id);

		if (blocking) {
			await upsertWorkflowRuntimeTask({
				workflowInstanceId: instance.id,
				taskKey: `dlp-review:${finding.id}`,
				title: `Review ${finding.label}`,
				description: `${finding.excerpt}\n\n${finding.recommendation}`,
				state: "blocked",
				priority: priorityForSeverity(finding.severity),
				assignedRole: "security_reviewer",
				dueAt: nextUtcDay(),
				metadata: {
					opportunityId,
					documentId: finding.documentId,
					findingId: finding.id,
					severity: finding.severity,
				},
			});
		}
	}

	const blockingCount = findings.filter((finding) => isBlockingSeverity(finding.severity)).length;
	return {
		opportunityId,
		allowed: !hasBlockingDlpFindings(findings),
		findings,
		blockingCount,
		workflowInstanceIds,
	};
}

function isBlockingSeverity(severity: DlpSeverity): boolean {
	return severity === "critical" || severity === "high";
}

function priorityForSeverity(severity: DlpSeverity): "critical" | "high" | "medium" | "low" {
	return severity;
}

function nextUtcDay(): Date {
	const dueAt = new Date();
	dueAt.setUTCDate(dueAt.getUTCDate() + 1);
	return dueAt;
}
