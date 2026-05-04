/**
 * ContentBlockViewer Component
 *
 * Full content view with metadata, usage history, versions,
 * and related content suggestions.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	FileText,
	Copy,
	Check,
	Edit,
	Trash2,
	Clock,
	TrendingUp,
	Star,
	Tag,
	Folder,
	History,
	Eye,
	Link2,
	ChevronDown,
	ChevronRight,
	Calendar,
	User,
	AlertTriangle,
	CheckCircle,
	ArrowLeft,
	ExternalLink,
	MoreHorizontal,
} from "lucide-react";
import { FreshnessBadge } from "./FreshnessIndicator";

// ============================================================================
// Types
// ============================================================================

interface ContentVersion {
	id: string;
	version: number;
	createdAt: string;
	createdBy: string;
	changesSummary: string;
	wordCount: number;
}

interface UsageRecord {
	id: string;
	documentTitle: string;
	documentId: string;
	usedAt: string;
	outcome?: "won" | "lost" | "pending";
}

interface RelatedContent {
	id: string;
	title: string;
	category: string;
	similarity: number;
}

interface ContentBlock {
	id: string;
	title: string;
	content: string;
	category: string;
	contentType: string;
	tags: string[];
	description?: string;
	status: "draft" | "pending_approval" | "approved" | "archived";
	freshnessStatus: "current" | "stale" | "needs_review" | "expired";
	qualityScore?: number;
	winRate?: number;
	usageCount: number;
	lastUsedAt?: string;
	lastReviewedAt?: string;
	reviewDueDate?: string;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
	updatedBy: string;
}

interface ContentBlockViewerProps {
	block: ContentBlock;
	versions?: ContentVersion[];
	usageHistory?: UsageRecord[];
	relatedContent?: RelatedContent[];
	onEdit?: () => void;
	onDelete?: () => void;
	onInsert?: () => void;
	onViewVersion?: (versionId: string) => void;
	onViewDocument?: (documentId: string) => void;
	onViewRelated?: (blockId: string) => void;
	onBack?: () => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG = {
	draft: { label: "Draft", color: "bg-gray-100 text-gray-700" },
	pending_approval: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-700" },
	approved: { label: "Approved", color: "bg-green-100 text-green-700" },
	archived: { label: "Archived", color: "bg-red-100 text-red-700" },
};

const OUTCOME_CONFIG = {
	won: { label: "Won", color: "text-green-600", icon: CheckCircle },
	lost: { label: "Lost", color: "text-red-600", icon: AlertTriangle },
	pending: { label: "Pending", color: "text-gray-500", icon: Clock },
};

// ============================================================================
// Component
// ============================================================================

export function ContentBlockViewer({
	block,
	versions = [],
	usageHistory = [],
	relatedContent = [],
	onEdit,
	onDelete,
	onInsert,
	onViewVersion,
	onViewDocument,
	onViewRelated,
	onBack,
	className,
}: ContentBlockViewerProps) {
	const [copiedContent, setCopiedContent] = useState(false);
	const [activeTab, setActiveTab] = useState<"content" | "history" | "usage" | "related">("content");
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["metadata"])
	);

	const handleCopyContent = async () => {
		await navigator.clipboard.writeText(block.content);
		setCopiedContent(true);
		setTimeout(() => setCopiedContent(false), 2000);
	};

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	const statusConfig = STATUS_CONFIG[block.status];

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="p-4 border-b">
				<div className="flex items-start justify-between mb-3">
					<div className="flex items-center gap-3">
						{onBack && (
							<button
								onClick={onBack}
								className="p-1 hover:bg-gray-100 rounded"
							>
								<ArrowLeft className="w-5 h-5 text-gray-500" />
							</button>
						)}
						<div className="p-2 bg-blue-100 rounded-lg">
							<FileText className="w-6 h-6 text-blue-600" />
						</div>
						<div>
							<h2 className="text-lg font-semibold">{block.title}</h2>
							<div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
								<span className="flex items-center gap-1">
									<Folder className="w-4 h-4" />
									{block.category}
								</span>
								<span>•</span>
								<span>{block.contentType}</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className={cn("px-2 py-1 rounded text-xs font-medium", statusConfig.color)}>
							{statusConfig.label}
						</span>
						<FreshnessBadge status={block.freshnessStatus} />
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center gap-2">
					{onInsert && (
						<Button variant="primary" size="sm" onClick={onInsert}>
							<Link2 className="w-4 h-4 mr-1" />
							Insert
						</Button>
					)}
					<Button variant="outline" size="sm" onClick={handleCopyContent}>
						{copiedContent ? (
							<Check className="w-4 h-4 mr-1 text-green-600" />
						) : (
							<Copy className="w-4 h-4 mr-1" />
						)}
						{copiedContent ? "Copied" : "Copy"}
					</Button>
					{onEdit && (
						<Button variant="ghost" size="sm" onClick={onEdit}>
							<Edit className="w-4 h-4 mr-1" />
							Edit
						</Button>
					)}
					{onDelete && (
						<Button variant="ghost" size="sm" onClick={onDelete}>
							<Trash2 className="w-4 h-4 mr-1 text-red-500" />
							Delete
						</Button>
					)}
				</div>
			</div>

			{/* Tabs */}
			<div className="border-b">
				<div className="flex">
					{[
						{ id: "content" as const, label: "Content", icon: FileText },
						{ id: "history" as const, label: "Versions", icon: History, count: versions.length },
						{ id: "usage" as const, label: "Usage", icon: Eye, count: usageHistory.length },
						{ id: "related" as const, label: "Related", icon: Link2, count: relatedContent.length },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
								activeTab === tab.id
									? "border-blue-600 text-blue-600"
									: "border-transparent text-gray-500 hover:text-gray-700"
							)}
						>
							<tab.icon className="w-4 h-4" />
							{tab.label}
							{tab.count !== undefined && tab.count > 0 && (
								<span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
									{tab.count}
								</span>
							)}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div className="p-4">
				{/* Content Tab */}
				{activeTab === "content" && (
					<div className="space-y-4">
						{/* Description */}
						{block.description && (
							<div className="p-3 bg-gray-50 rounded-lg">
								<h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
								<p className="text-sm text-gray-600">{block.description}</p>
							</div>
						)}

						{/* Content */}
						<div>
							<h4 className="text-sm font-medium text-gray-700 mb-2">Content</h4>
							<div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
								<div className="whitespace-pre-wrap">{block.content}</div>
							</div>
						</div>

						{/* Tags */}
						{block.tags.length > 0 && (
							<div>
								<h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
								<div className="flex flex-wrap gap-2">
									{block.tags.map((tag) => (
										<span
											key={tag}
											className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
										>
											<Tag className="w-3 h-3" />
											{tag}
										</span>
									))}
								</div>
							</div>
						)}

						{/* Metadata */}
						<CollapsibleSection
							title="Metadata"
							isExpanded={expandedSections.has("metadata")}
							onToggle={() => toggleSection("metadata")}
						>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<MetadataItem
									label="Quality Score"
									value={
										block.qualityScore !== undefined
											? `${block.qualityScore}/100`
											: "N/A"
									}
									icon={<Star className="w-4 h-4" />}
								/>
								<MetadataItem
									label="Win Rate"
									value={
										block.winRate !== undefined
											? `${Math.round(block.winRate * 100)}%`
											: "N/A"
									}
									icon={<TrendingUp className="w-4 h-4" />}
								/>
								<MetadataItem
									label="Usage Count"
									value={block.usageCount.toString()}
									icon={<Eye className="w-4 h-4" />}
								/>
								<MetadataItem
									label="Last Used"
									value={
										block.lastUsedAt
											? new Date(block.lastUsedAt).toLocaleDateString()
											: "Never"
									}
									icon={<Clock className="w-4 h-4" />}
								/>
							</div>
						</CollapsibleSection>

						{/* Audit Info */}
						<CollapsibleSection
							title="Audit Information"
							isExpanded={expandedSections.has("audit")}
							onToggle={() => toggleSection("audit")}
						>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-gray-500">Created</p>
									<p className="font-medium">
										{new Date(block.createdAt).toLocaleDateString()} by {block.createdBy}
									</p>
								</div>
								<div>
									<p className="text-gray-500">Last Updated</p>
									<p className="font-medium">
										{new Date(block.updatedAt).toLocaleDateString()} by {block.updatedBy}
									</p>
								</div>
								{block.lastReviewedAt && (
									<div>
										<p className="text-gray-500">Last Reviewed</p>
										<p className="font-medium">
											{new Date(block.lastReviewedAt).toLocaleDateString()}
										</p>
									</div>
								)}
								{block.reviewDueDate && (
									<div>
										<p className="text-gray-500">Review Due</p>
										<p className="font-medium">
											{new Date(block.reviewDueDate).toLocaleDateString()}
										</p>
									</div>
								)}
							</div>
						</CollapsibleSection>
					</div>
				)}

				{/* Versions Tab */}
				{activeTab === "history" && (
					<div>
						{versions.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								<History className="w-12 h-12 mx-auto mb-3 opacity-50" />
								<p>No version history available</p>
							</div>
						) : (
							<div className="space-y-2">
								{versions.map((version, index) => (
									<div
										key={version.id}
										className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
										onClick={() => onViewVersion?.(version.id)}

				role="button"
				tabIndex={0}
				onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
										<div className="flex items-center justify-between mb-1">
											<div className="flex items-center gap-2">
												<span className="font-medium text-sm">
													Version {version.version}
													{index === 0 && (
														<span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
															Current
														</span>
													)}
												</span>
											</div>
											<div className="flex items-center gap-4 text-xs text-gray-500">
												<span className="flex items-center gap-1">
													<Calendar className="w-3 h-3" />
													{new Date(version.createdAt).toLocaleDateString()}
												</span>
												<span className="flex items-center gap-1">
													<User className="w-3 h-3" />
													{version.createdBy}
												</span>
												<span>{version.wordCount} words</span>
											</div>
										</div>
										<p className="text-sm text-gray-600">{version.changesSummary}</p>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* Usage Tab */}
				{activeTab === "usage" && (
					<div>
						{usageHistory.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								<Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
								<p>No usage history available</p>
							</div>
						) : (
							<div className="space-y-2">
								{usageHistory.map((usage) => {
									const outcomeConfig = usage.outcome
										? OUTCOME_CONFIG[usage.outcome]
										: null;

									return (
										<div
											key={usage.id}
											className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
											onClick={() => onViewDocument?.(usage.documentId)}

					role="button"
					tabIndex={0}
					onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
											<div className="flex items-center gap-3">
												<FileText className="w-5 h-5 text-gray-400" />
												<div>
													<p className="font-medium text-sm">{usage.documentTitle}</p>
													<p className="text-xs text-gray-500">
														Used {new Date(usage.usedAt).toLocaleDateString()}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{outcomeConfig && (
													<span
														className={cn(
															"flex items-center gap-1 text-xs font-medium",
															outcomeConfig.color
														)}
													>
														<outcomeConfig.icon className="w-4 h-4" />
														{outcomeConfig.label}
													</span>
												)}
												<ExternalLink className="w-4 h-4 text-gray-400" />
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* Related Tab */}
				{activeTab === "related" && (
					<div>
						{relatedContent.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								<Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
								<p>No related content found</p>
							</div>
						) : (
							<div className="space-y-2">
								{relatedContent.map((related) => (
									<div
										key={related.id}
										className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
										onClick={() => onViewRelated?.(related.id)}

				role="button"
				tabIndex={0}
				onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
										<div className="flex items-center gap-3">
											<FileText className="w-5 h-5 text-gray-400" />
											<div>
												<p className="font-medium text-sm">{related.title}</p>
												<p className="text-xs text-gray-500">{related.category}</p>
											</div>
										</div>
										<span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
											{Math.round(related.similarity * 100)}% similar
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface MetadataItemProps {
	label: string;
	value: string;
	icon: React.ReactNode;
}

function MetadataItem({ label, value, icon }: MetadataItemProps) {
	return (
		<div className="p-3 bg-gray-50 rounded-lg">
			<div className="flex items-center gap-2 text-gray-500 mb-1">
				{icon}
				<span className="text-xs">{label}</span>
			</div>
			<p className="font-medium">{value}</p>
		</div>
	);
}

interface CollapsibleSectionProps {
	title: string;
	isExpanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

function CollapsibleSection({
	title,
	isExpanded,
	onToggle,
	children,
}: CollapsibleSectionProps) {
	return (
		<div className="border rounded-lg">
			<button
				onClick={onToggle}
				className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
			>
				<span className="font-medium text-sm">{title}</span>
				{isExpanded ? (
					<ChevronDown className="w-4 h-4 text-gray-400" />
				) : (
					<ChevronRight className="w-4 h-4 text-gray-400" />
				)}
			</button>
			{isExpanded && <div className="p-3 pt-0 border-t">{children}</div>}
		</div>
	);
}
