/**
 * CrossReferenceEditor Component
 *
 * Allows manual editing of cross-references between RFP requirements
 * and response document sections.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Link,
	Unlink,
	Search,
	FileText,
	ChevronRight,
	CheckCircle,
	AlertCircle,
	Plus,
	Trash2,
	ExternalLink,
	ArrowRight,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Requirement {
	id: string;
	requirementNumber: string;
	title?: string;
	text: string;
	category: string;
	priority: string;
}

interface DocumentSection {
	id: string;
	documentId: string;
	documentTitle: string;
	sectionTitle: string;
	sectionNumber?: string;
	content: string;
}

interface CrossReference {
	id: string;
	requirementId: string;
	sectionId: string;
	confidence: number;
	status: "active" | "pending" | "removed";
	createdAt: string;
	createdBy?: string;
}

interface CrossReferenceEditorProps {
	requirement: Requirement;
	linkedSections: (DocumentSection & { reference: CrossReference })[];
	availableSections: DocumentSection[];
	onLink: (requirementId: string, sectionId: string) => Promise<void>;
	onUnlink: (referenceId: string) => Promise<void>;
	onSectionClick?: (section: DocumentSection) => void;
	isLoading?: boolean;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CrossReferenceEditor({
	requirement,
	linkedSections,
	availableSections,
	onLink,
	onUnlink,
	onSectionClick,
	isLoading = false,
	className,
}: CrossReferenceEditorProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [showAvailable, setShowAvailable] = useState(false);
	const [linkingSection, setLinkingSection] = useState<string | null>(null);
	const [unlinkingRef, setUnlinkingRef] = useState<string | null>(null);

	const filteredAvailable = availableSections.filter((section) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			section.sectionTitle.toLowerCase().includes(query) ||
			section.documentTitle.toLowerCase().includes(query) ||
			section.content.toLowerCase().includes(query)
		);
	});

	const handleLink = useCallback(
		async (sectionId: string) => {
			setLinkingSection(sectionId);
			try {
				await onLink(requirement.id, sectionId);
			} finally {
				setLinkingSection(null);
			}
		},
		[onLink, requirement.id]
	);

	const handleUnlink = useCallback(
		async (referenceId: string) => {
			setUnlinkingRef(referenceId);
			try {
				await onUnlink(referenceId);
			} finally {
				setUnlinkingRef(null);
			}
		},
		[onUnlink]
	);

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 0.8) return "text-green-600 bg-green-50";
		if (confidence >= 0.5) return "text-yellow-600 bg-yellow-50";
		return "text-red-600 bg-red-50";
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Requirement Header */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-start gap-3">
					<div
						className={cn(
							"px-2 py-1 rounded text-xs font-medium",
							requirement.priority === "mandatory"
								? "bg-red-100 text-red-700"
								: requirement.priority === "important"
								? "bg-orange-100 text-orange-700"
								: "bg-blue-100 text-blue-700"
						)}
					>
						{requirement.priority}
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span className="font-semibold">{requirement.requirementNumber}</span>
							{requirement.title && (
								<span className="text-gray-500">— {requirement.title}</span>
							)}
						</div>
						<p className="text-sm text-gray-700 line-clamp-2">
							{requirement.text}
						</p>
						<div className="text-xs text-gray-500 mt-1">
							Category: {requirement.category}
						</div>
					</div>
				</div>
			</div>

			{/* Linked Sections */}
			<div className="bg-white rounded-lg border">
				<div className="p-4 border-b flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Link className="w-5 h-5 text-green-600" />
						<h3 className="font-medium">
							Linked Response Sections ({linkedSections.length})
						</h3>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowAvailable(!showAvailable)}
					>
						<Plus className="w-4 h-4 mr-1" />
						Add Link
					</Button>
				</div>

				{linkedSections.length === 0 ? (
					<div className="p-8 text-center">
						<AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
						<h4 className="font-medium mb-1">No Linked Sections</h4>
						<p className="text-sm text-gray-500 mb-4">
							This requirement has no cross-references to response sections.
						</p>
						<Button
							variant="outline"
							onClick={() => setShowAvailable(true)}
						>
							<Plus className="w-4 h-4 mr-1" />
							Link a Section
						</Button>
					</div>
				) : (
					<div className="divide-y">
						{linkedSections.map(({ reference, ...section }) => (
							<div
								key={reference.id}
								className="p-4 hover:bg-gray-50 transition-colors"
							>
								<div className="flex items-start gap-3">
									<FileText className="w-5 h-5 text-blue-500 mt-0.5" />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium">{section.sectionTitle}</span>
											<span
												className={cn(
													"px-2 py-0.5 text-xs rounded-full",
													getConfidenceColor(reference.confidence)
												)}
											>
												{Math.round(reference.confidence * 100)}% match
											</span>
										</div>
										<p className="text-sm text-gray-500 mb-2">
											{section.documentTitle}
											{section.sectionNumber && ` • Section ${section.sectionNumber}`}
										</p>
										<p className="text-sm text-gray-700 line-clamp-2">
											{section.content}
										</p>
									</div>
									<div className="flex items-center gap-2">
										{onSectionClick && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => onSectionClick(section)}
											>
												<ExternalLink className="w-4 h-4" />
											</Button>
										)}
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleUnlink(reference.id)}
											disabled={unlinkingRef === reference.id}
											className="text-red-600 hover:text-red-700 hover:bg-red-50"
										>
											{unlinkingRef === reference.id ? (
												<span className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
											) : (
												<Unlink className="w-4 h-4" />
											)}
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Available Sections Picker */}
			{showAvailable && (
				<div className="bg-white rounded-lg border">
					<div className="p-4 border-b">
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-medium">Available Sections</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowAvailable(false)}
							>
								Close
							</Button>
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<Input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search sections..."
								className="pl-9"
							/>
						</div>
					</div>

					<div className="max-h-80 overflow-y-auto divide-y">
						{filteredAvailable.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								{searchQuery
									? "No sections match your search"
									: "No available sections to link"}
							</div>
						) : (
							filteredAvailable.map((section) => {
								const isLinked = linkedSections.some(
									(ls) => ls.id === section.id
								);
								const isLinking = linkingSection === section.id;

								return (
									<div
										key={section.id}
										className={cn(
											"p-4 transition-colors",
											isLinked
												? "bg-green-50 opacity-60"
												: "hover:bg-gray-50"
										)}
									>
										<div className="flex items-start gap-3">
											<FileText className="w-5 h-5 text-gray-400 mt-0.5" />
											<div className="flex-1 min-w-0">
												<div className="font-medium mb-1">
													{section.sectionTitle}
												</div>
												<p className="text-sm text-gray-500 mb-2">
													{section.documentTitle}
												</p>
												<p className="text-sm text-gray-700 line-clamp-2">
													{section.content}
												</p>
											</div>
											<div>
												{isLinked ? (
													<span className="flex items-center gap-1 text-green-600 text-sm">
														<CheckCircle className="w-4 h-4" />
														Linked
													</span>
												) : (
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleLink(section.id)}
														disabled={isLinking || isLoading}
													>
														{isLinking ? (
															<span className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
														) : (
															<>
																<Link className="w-4 h-4 mr-1" />
																Link
															</>
														)}
													</Button>
												)}
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{/* Visual Mapping */}
			{linkedSections.length > 0 && (
				<div className="bg-gray-50 rounded-lg border p-4">
					<h4 className="text-sm font-medium mb-3">Cross-Reference Map</h4>
					<div className="flex items-center gap-4">
						<div className="bg-white rounded-lg border p-3 flex-shrink-0 w-32">
							<div className="text-xs text-gray-500 mb-1">Requirement</div>
							<div className="font-medium truncate">
								{requirement.requirementNumber}
							</div>
						</div>
						<div className="flex-1 flex items-center">
							{linkedSections.map((section, index) => (
								<React.Fragment key={section.reference.id}>
									<ArrowRight className="w-5 h-5 text-gray-400" />
									<div className="bg-white rounded-lg border p-3 flex-shrink-0 max-w-xs">
										<div className="text-xs text-gray-500 mb-1 truncate">
											{section.documentTitle}
										</div>
										<div className="font-medium truncate">
											{section.sectionTitle}
										</div>
									</div>
								</React.Fragment>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
