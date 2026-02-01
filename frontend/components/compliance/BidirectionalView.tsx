/**
 * BidirectionalView Component
 *
 * Displays bidirectional validation results showing both:
 * - Requirements without responses
 * - Response sections without requirements
 * - Orphaned cross-references
 */

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	ArrowLeftRight,
	FileQuestion,
	FileText,
	Link2Off,
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	ExternalLink,
	Plus,
	Search,
} from "lucide-react";
import type { BidirectionalValidation, MissingReference } from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface BidirectionalViewProps {
	validation: BidirectionalValidation;
	onNavigateToRequirement?: (requirementId: string) => void;
	onNavigateToSection?: (sectionId: string) => void;
	onCreateCrossReference?: (requirementId: string) => void;
	onCreateRequirementLink?: (sectionId: string) => void;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BidirectionalView({
	validation,
	onNavigateToRequirement,
	onNavigateToSection,
	onCreateCrossReference,
	onCreateRequirementLink,
	className,
}: BidirectionalViewProps) {
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["requirements", "responses", "orphaned"])
	);

	const toggleSection = (section: string) => {
		const newExpanded = new Set(expandedSections);
		if (newExpanded.has(section)) {
			newExpanded.delete(section);
		} else {
			newExpanded.add(section);
		}
		setExpandedSections(newExpanded);
	};

	const totalIssues =
		validation.requirementsWithoutResponse.length +
		validation.responsesWithoutRequirement.length +
		validation.orphanedCrossReferences.length;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-center gap-3 mb-4">
					<div className="p-2 bg-blue-100 rounded-lg">
						<ArrowLeftRight className="w-6 h-6 text-blue-600" />
					</div>
					<div>
						<h3 className="font-semibold">Bidirectional Validation</h3>
						<p className="text-sm text-gray-500">
							Ensuring complete mapping between requirements and responses
						</p>
					</div>
				</div>

				{/* Summary Stats */}
				<div className="grid grid-cols-3 gap-4">
					<div
						className={cn(
							"p-3 rounded-lg text-center",
							validation.requirementsWithoutResponse.length > 0
								? "bg-red-50"
								: "bg-green-50"
						)}
					>
						<FileQuestion
							className={cn(
								"w-6 h-6 mx-auto mb-1",
								validation.requirementsWithoutResponse.length > 0
									? "text-red-600"
									: "text-green-600"
							)}
						/>
						<div
							className={cn(
								"text-2xl font-bold",
								validation.requirementsWithoutResponse.length > 0
									? "text-red-700"
									: "text-green-700"
							)}
						>
							{validation.requirementsWithoutResponse.length}
						</div>
						<div className="text-xs text-gray-600">Unaddressed Requirements</div>
					</div>
					<div
						className={cn(
							"p-3 rounded-lg text-center",
							validation.responsesWithoutRequirement.length > 0
								? "bg-yellow-50"
								: "bg-green-50"
						)}
					>
						<FileText
							className={cn(
								"w-6 h-6 mx-auto mb-1",
								validation.responsesWithoutRequirement.length > 0
									? "text-yellow-600"
									: "text-green-600"
							)}
						/>
						<div
							className={cn(
								"text-2xl font-bold",
								validation.responsesWithoutRequirement.length > 0
									? "text-yellow-700"
									: "text-green-700"
							)}
						>
							{validation.responsesWithoutRequirement.length}
						</div>
						<div className="text-xs text-gray-600">Orphan Response Sections</div>
					</div>
					<div
						className={cn(
							"p-3 rounded-lg text-center",
							validation.orphanedCrossReferences.length > 0
								? "bg-orange-50"
								: "bg-green-50"
						)}
					>
						<Link2Off
							className={cn(
								"w-6 h-6 mx-auto mb-1",
								validation.orphanedCrossReferences.length > 0
									? "text-orange-600"
									: "text-green-600"
							)}
						/>
						<div
							className={cn(
								"text-2xl font-bold",
								validation.orphanedCrossReferences.length > 0
									? "text-orange-700"
									: "text-green-700"
							)}
						>
							{validation.orphanedCrossReferences.length}
						</div>
						<div className="text-xs text-gray-600">Broken References</div>
					</div>
				</div>
			</div>

			{/* Requirements Without Response */}
			<div className="bg-white rounded-lg border overflow-hidden">
				<button
					onClick={() => toggleSection("requirements")}
					className={cn(
						"w-full p-4 flex items-center justify-between transition-colors",
						validation.requirementsWithoutResponse.length > 0
							? "bg-red-50 hover:bg-red-100"
							: "bg-gray-50 hover:bg-gray-100"
					)}
				>
					<div className="flex items-center gap-2">
						{expandedSections.has("requirements") ? (
							<ChevronDown className="w-5 h-5" />
						) : (
							<ChevronRight className="w-5 h-5" />
						)}
						<FileQuestion
							className={cn(
								"w-5 h-5",
								validation.requirementsWithoutResponse.length > 0
									? "text-red-600"
									: "text-gray-400"
							)}
						/>
						<span className="font-medium">
							Requirements Without Response ({validation.requirementsWithoutResponse.length})
						</span>
					</div>
					{validation.requirementsWithoutResponse.length > 0 && (
						<span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
							Action Required
						</span>
					)}
				</button>

				{expandedSections.has("requirements") && (
					<div className="divide-y">
						{validation.requirementsWithoutResponse.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								All requirements have been addressed
							</div>
						) : (
							validation.requirementsWithoutResponse.map((req) => (
								<RequirementItem
									key={req.requirementId}
									requirement={req}
									onNavigate={onNavigateToRequirement}
									onCreateReference={onCreateCrossReference}
								/>
							))
						)}
					</div>
				)}
			</div>

			{/* Responses Without Requirements */}
			<div className="bg-white rounded-lg border overflow-hidden">
				<button
					onClick={() => toggleSection("responses")}
					className={cn(
						"w-full p-4 flex items-center justify-between transition-colors",
						validation.responsesWithoutRequirement.length > 0
							? "bg-yellow-50 hover:bg-yellow-100"
							: "bg-gray-50 hover:bg-gray-100"
					)}
				>
					<div className="flex items-center gap-2">
						{expandedSections.has("responses") ? (
							<ChevronDown className="w-5 h-5" />
						) : (
							<ChevronRight className="w-5 h-5" />
						)}
						<FileText
							className={cn(
								"w-5 h-5",
								validation.responsesWithoutRequirement.length > 0
									? "text-yellow-600"
									: "text-gray-400"
							)}
						/>
						<span className="font-medium">
							Response Sections Without Requirements (
							{validation.responsesWithoutRequirement.length})
						</span>
					</div>
					{validation.responsesWithoutRequirement.length > 0 && (
						<span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
							Review Suggested
						</span>
					)}
				</button>

				{expandedSections.has("responses") && (
					<div className="divide-y">
						{validation.responsesWithoutRequirement.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								All response sections are linked to requirements
							</div>
						) : (
							validation.responsesWithoutRequirement.map((resp, index) => (
								<div key={index} className="p-4">
									<div className="flex items-start justify-between">
										<div className="flex-1 min-w-0">
											<div className="font-medium mb-1">
												{resp.documentSection}
											</div>
											<p className="text-sm text-gray-600 line-clamp-2 mb-2">
												{resp.content}
											</p>
											{resp.potentialMatches.length > 0 && (
												<div className="flex items-center gap-2 text-xs text-blue-600">
													<Search className="w-3 h-3" />
													<span>
														Potential matches: {resp.potentialMatches.join(", ")}
													</span>
												</div>
											)}
										</div>
										<div className="flex items-center gap-2 ml-4">
											{onNavigateToSection && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														onNavigateToSection(resp.documentSection)
													}
												>
													<ExternalLink className="w-4 h-4" />
												</Button>
											)}
											{onCreateRequirementLink && (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														onCreateRequirementLink(resp.documentSection)
													}
												>
													<Plus className="w-4 h-4 mr-1" />
													Link
												</Button>
											)}
										</div>
									</div>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{/* Orphaned Cross-References */}
			<div className="bg-white rounded-lg border overflow-hidden">
				<button
					onClick={() => toggleSection("orphaned")}
					className={cn(
						"w-full p-4 flex items-center justify-between transition-colors",
						validation.orphanedCrossReferences.length > 0
							? "bg-orange-50 hover:bg-orange-100"
							: "bg-gray-50 hover:bg-gray-100"
					)}
				>
					<div className="flex items-center gap-2">
						{expandedSections.has("orphaned") ? (
							<ChevronDown className="w-5 h-5" />
						) : (
							<ChevronRight className="w-5 h-5" />
						)}
						<Link2Off
							className={cn(
								"w-5 h-5",
								validation.orphanedCrossReferences.length > 0
									? "text-orange-600"
									: "text-gray-400"
							)}
						/>
						<span className="font-medium">
							Orphaned Cross-References ({validation.orphanedCrossReferences.length})
						</span>
					</div>
					{validation.orphanedCrossReferences.length > 0 && (
						<span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
							Fix Required
						</span>
					)}
				</button>

				{expandedSections.has("orphaned") && (
					<div className="divide-y">
						{validation.orphanedCrossReferences.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								No broken cross-references found
							</div>
						) : (
							validation.orphanedCrossReferences.map((ref, index) => (
								<div key={index} className="p-4">
									<div className="flex items-start gap-3">
										<AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
										<div className="flex-1 min-w-0">
											<div className="font-medium mb-1">{ref.location}</div>
											<p className="text-sm text-gray-600 mb-1">
												References: {ref.targetRequirement}
											</p>
											<p className="text-xs text-orange-600">
												Issue: {ref.issue}
											</p>
										</div>
										<Button variant="outline" size="sm">
											Fix Reference
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{/* All Clear State */}
			{totalIssues === 0 && (
				<div className="bg-green-50 rounded-lg border border-green-200 p-8 text-center">
					<div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
						<ArrowLeftRight className="w-8 h-8 text-green-600" />
					</div>
					<h4 className="font-semibold text-green-800 mb-2">
						Perfect Bidirectional Mapping
					</h4>
					<p className="text-sm text-green-600">
						All requirements are addressed and all response sections are properly linked.
					</p>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface RequirementItemProps {
	requirement: MissingReference;
	onNavigate?: (requirementId: string) => void;
	onCreateReference?: (requirementId: string) => void;
}

function RequirementItem({
	requirement,
	onNavigate,
	onCreateReference,
}: RequirementItemProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="p-4">
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="font-medium">{requirement.requirementNumber}</span>
						<span
							className={cn(
								"px-2 py-0.5 text-xs rounded-full",
								requirement.priority === "mandatory"
									? "bg-red-100 text-red-700"
									: requirement.priority === "important"
									? "bg-orange-100 text-orange-700"
									: "bg-blue-100 text-blue-700"
							)}
						>
							{requirement.priority}
						</span>
						<span className="text-xs text-gray-500">{requirement.category}</span>
					</div>
					<p
						className={cn(
							"text-sm text-gray-700",
							!expanded && "line-clamp-2"
						)}
					>
						{requirement.requirementText}
					</p>
					{requirement.requirementText.length > 150 && (
						<button
							onClick={() => setExpanded(!expanded)}
							className="text-xs text-blue-600 hover:underline mt-1"
						>
							{expanded ? "Show less" : "Show more"}
						</button>
					)}
					{requirement.suggestedSections.length > 0 && (
						<div className="mt-2 text-xs text-gray-500">
							<span className="font-medium">Suggested sections: </span>
							{requirement.suggestedSections.join(", ")}
						</div>
					)}
				</div>
				<div className="flex items-center gap-2 ml-4">
					{onNavigate && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onNavigate(requirement.requirementId)}
						>
							<ExternalLink className="w-4 h-4" />
						</Button>
					)}
					{onCreateReference && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => onCreateReference(requirement.requirementId)}
						>
							<Plus className="w-4 h-4 mr-1" />
							Add Response
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
