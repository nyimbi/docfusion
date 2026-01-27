/**
 * OpportunityDetailView Component - DocFusion
 *
 * Displays the full details of an opportunity with tabbed sections
 * for Overview, Requirements, and Timeline.
 */

"use client";

import { useState } from "react";
import type { Opportunity } from "@/lib/types/opportunity";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OpportunityDetailViewProps {
	opportunity: Opportunity;
}

type TabId = "overview" | "requirements" | "scope" | "submission";

export function OpportunityDetailView({ opportunity }: OpportunityDetailViewProps) {
	const [activeTab, setActiveTab] = useState<TabId>("overview");

	const tabs: { id: TabId; label: string; available: boolean }[] = [
		{ id: "overview", label: "Overview", available: true },
		{
			id: "requirements",
			label: "Requirements",
			available: Boolean(opportunity.keyRequirements || opportunity.technicalRequirements),
		},
		{ id: "scope", label: "Scope", available: Boolean(opportunity.projectScope) },
		{
			id: "submission",
			label: "Submission",
			available: Boolean(opportunity.submissionMethod || opportunity.submissionRequirements),
		},
	];

	return (
		<div className="space-y-4">
			{/* Tab Navigation */}
			<div className="border-b border-border">
				<nav className="flex gap-6" aria-label="Tabs">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							disabled={!tab.available}
							className={cn(
								"relative py-3 text-sm font-medium transition-colors",
								"hover:text-foreground",
								"disabled:opacity-40 disabled:cursor-not-allowed",
								activeTab === tab.id
									? "text-foreground"
									: "text-muted-foreground"
							)}
						>
							{tab.label}
							{activeTab === tab.id && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
							)}
						</button>
					))}
				</nav>
			</div>

			{/* Tab Content */}
			<div className="min-h-[300px]">
				{activeTab === "overview" && <OverviewTab opportunity={opportunity} />}
				{activeTab === "requirements" && <RequirementsTab opportunity={opportunity} />}
				{activeTab === "scope" && <ScopeTab opportunity={opportunity} />}
				{activeTab === "submission" && <SubmissionTab opportunity={opportunity} />}
			</div>
		</div>
	);
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ opportunity }: { opportunity: Opportunity }) {
	return (
		<div className="space-y-6">
			{/* Project Summary */}
			{opportunity.projectSummary && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Project Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<p className="text-foreground whitespace-pre-wrap leading-relaxed">
								{opportunity.projectSummary}
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Key Details Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Organization & Funder */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Client Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{opportunity.organization && (
							<DetailRow label="Organization" value={opportunity.organization} />
						)}
						{opportunity.funder && (
							<DetailRow label="Funder" value={opportunity.funder} />
						)}
						{opportunity.countryRegion && (
							<DetailRow label="Location" value={opportunity.countryRegion} />
						)}
						{opportunity.sector && (
							<DetailRow label="Sector" value={opportunity.sector} />
						)}
					</CardContent>
				</Card>

				{/* Timeline & Budget */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Timeline & Budget</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{opportunity.deadline && (
							<DetailRow
								label="Deadline"
								value={formatDateLong(opportunity.deadline)}
								highlight={
									opportunity.daysLeft !== null && opportunity.daysLeft < 14
								}
							/>
						)}
						{opportunity.daysLeft !== null && (
							<DetailRow
								label="Days Remaining"
								value={
									opportunity.daysLeft < 0
										? `${Math.abs(opportunity.daysLeft)} days overdue`
										: `${opportunity.daysLeft} days`
								}
								highlight={opportunity.daysLeft < 7}
							/>
						)}
						{opportunity.budgetValue && (
							<DetailRow label="Budget" value={opportunity.budgetValue} />
						)}
						{opportunity.budgetCurrency && !opportunity.budgetValue && (
							<DetailRow label="Currency" value={opportunity.budgetCurrency} />
						)}
					</CardContent>
				</Card>
			</div>

			{/* Tags */}
			{opportunity.tags && opportunity.tags.length > 0 && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Tags</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							{opportunity.tags.map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground"
								>
									{tag}
								</span>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Strategic Notes */}
			{opportunity.strategicNotes && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Strategic Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-foreground whitespace-pre-wrap">
							{opportunity.strategicNotes}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function RequirementsTab({ opportunity }: { opportunity: Opportunity }) {
	return (
		<div className="space-y-6">
			{/* Key Requirements */}
			{opportunity.keyRequirements && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Key Requirements</CardTitle>
						<CardDescription>
							Core requirements extracted from the RFP
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<pre className="whitespace-pre-wrap font-sans text-foreground bg-transparent p-0 border-none">
								{opportunity.keyRequirements}
							</pre>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Technical Requirements */}
			{opportunity.technicalRequirements && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Technical Requirements</CardTitle>
						<CardDescription>
							Technical specifications and stack requirements
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<pre className="whitespace-pre-wrap font-sans text-foreground bg-transparent p-0 border-none">
								{opportunity.technicalRequirements}
							</pre>
						</div>
					</CardContent>
				</Card>
			)}

			{!opportunity.keyRequirements && !opportunity.technicalRequirements && (
				<EmptyState
					title="No requirements extracted"
					description="Requirements will appear here once extracted from the RFP document."
				/>
			)}
		</div>
	);
}

function ScopeTab({ opportunity }: { opportunity: Opportunity }) {
	return (
		<div className="space-y-6">
			{opportunity.projectScope ? (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Project Scope</CardTitle>
						<CardDescription>
							Full scope of work and deliverables
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<pre className="whitespace-pre-wrap font-sans text-foreground bg-transparent p-0 border-none leading-relaxed">
								{opportunity.projectScope}
							</pre>
						</div>
					</CardContent>
				</Card>
			) : (
				<EmptyState
					title="No scope defined"
					description="Project scope details will appear here once added."
				/>
			)}
		</div>
	);
}

function SubmissionTab({ opportunity }: { opportunity: Opportunity }) {
	return (
		<div className="space-y-6">
			{/* Submission Method */}
			{opportunity.submissionMethod && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Submission Method</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-foreground">{opportunity.submissionMethod}</p>
					</CardContent>
				</Card>
			)}

			{/* Submission Requirements */}
			{opportunity.submissionRequirements && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Submission Requirements</CardTitle>
						<CardDescription>
							Required format, documents, and procedures
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<pre className="whitespace-pre-wrap font-sans text-foreground bg-transparent p-0 border-none">
								{opportunity.submissionRequirements}
							</pre>
						</div>
					</CardContent>
				</Card>
			)}

			{/* RFP Link */}
			{opportunity.rfpLink && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Source Document</CardTitle>
					</CardHeader>
					<CardContent>
						<a
							href={opportunity.rfpLink}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 text-primary hover:underline"
						>
							<ExternalLinkIcon className="h-4 w-4" />
							View Original RFP Document
						</a>
					</CardContent>
				</Card>
			)}

			{!opportunity.submissionMethod &&
				!opportunity.submissionRequirements &&
				!opportunity.rfpLink && (
					<EmptyState
						title="No submission details"
						description="Submission requirements will appear here once added."
					/>
				)}
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

function DetailRow({
	label,
	value,
	highlight = false,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div className="flex justify-between items-start gap-4">
			<span className="text-sm text-muted-foreground shrink-0">{label}</span>
			<span
				className={cn(
					"text-sm font-medium text-right",
					highlight ? "text-destructive" : "text-foreground"
				)}
			>
				{value}
			</span>
		</div>
	);
}

function EmptyState({ title, description }: { title: string; description: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<div className="rounded-full bg-muted p-3 mb-4">
				<DocumentIcon className="h-6 w-6 text-muted-foreground" />
			</div>
			<h3 className="text-sm font-medium text-foreground">{title}</h3>
			<p className="text-sm text-muted-foreground mt-1 max-w-sm">
				{description}
			</p>
		</div>
	);
}

function formatDateLong(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(new Date(date));
}

// ============================================================================
// Icons
// ============================================================================

function DocumentIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	);
}

function ExternalLinkIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
			/>
		</svg>
	);
}
