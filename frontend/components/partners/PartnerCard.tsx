/**
 * PartnerCard Component - DocFusion
 *
 * Displays partner information in a card format.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import type { PartnerListItem, PartnerType } from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PartnerCardProps {
	partner: PartnerListItem;
	variant?: "default" | "compact";
	onEdit?: (partner: PartnerListItem) => void;
	onAssign?: (partner: PartnerListItem) => void;
	showActions?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function PartnerCard({
	partner,
	variant = "default",
	onEdit,
	onAssign,
	showActions = true,
}: PartnerCardProps) {
	const [showAllCapabilities, setShowAllCapabilities] = useState(false);

	const displayCapabilities = showAllCapabilities
		? partner.capabilities
		: partner.capabilities.slice(0, 3);
	const hasMoreCapabilities = partner.capabilities.length > 3;

	if (variant === "compact") {
		return (
			<div className="flex items-center gap-3 p-3 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:border-[var(--foreground-muted)] transition-colors">
				<div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--background-muted)] flex items-center justify-center">
					<span className="text-lg">{getPartnerTypeIcon(partner.type)}</span>
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-medium text-[var(--foreground)] truncate">
						{partner.name}
					</p>
					<p className="text-xs text-[var(--foreground-muted)]">
						{partner.contactName || "No contact"} • {partner.pastCollaborations} collaborations
					</p>
				</div>
				{partner.performanceRating && (
					<div className="flex items-center gap-1">
						<StarIcon className="h-4 w-4 text-amber-500" />
						<span className="text-sm font-medium text-[var(--foreground)]">
							{partner.performanceRating.toFixed(1)}
						</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg overflow-hidden hover:shadow-md transition-shadow">
			{/* Header */}
			<div className="p-4 border-b border-[var(--border)]">
				<div className="flex items-start gap-3">
					<div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--background-muted)] flex items-center justify-center">
						<span className="text-2xl">{getPartnerTypeIcon(partner.type)}</span>
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-[var(--foreground)] truncate">
							{partner.name}
						</h3>
						<p className="text-sm text-[var(--foreground-muted)]">
							{formatPartnerType(partner.type)}
						</p>
					</div>
					<StatusBadge status={partner.status} />
				</div>
			</div>

			{/* Contact Info */}
			<div className="p-4 space-y-2">
				{partner.contactName && (
					<div className="flex items-center gap-2 text-sm">
						<UserIcon className="h-4 w-4 text-[var(--foreground-muted)]" />
						<span className="text-[var(--foreground)]">{partner.contactName}</span>
					</div>
				)}
				{partner.contactEmail && (
					<div className="flex items-center gap-2 text-sm">
						<EmailIcon className="h-4 w-4 text-[var(--foreground-muted)]" />
						<a
							href={`mailto:${partner.contactEmail}`}
							className="text-blue-600 dark:text-blue-400 hover:underline truncate"
						>
							{partner.contactEmail}
						</a>
					</div>
				)}
			</div>

			{/* Capabilities */}
			{partner.capabilities.length > 0 && (
				<div className="px-4 pb-4">
					<p className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-2">
						Capabilities
					</p>
					<div className="flex flex-wrap gap-1.5">
						{displayCapabilities.map((cap) => (
							<span
								key={cap}
								className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
							>
								{cap}
							</span>
						))}
						{hasMoreCapabilities && !showAllCapabilities && (
							<button
								onClick={() => setShowAllCapabilities(true)}
								className="px-2 py-0.5 text-xs rounded-full bg-[var(--background-muted)] text-[var(--foreground-muted)] hover:bg-[var(--border)]"
							>
								+{partner.capabilities.length - 3} more
							</button>
						)}
					</div>
				</div>
			)}

			{/* Stats */}
			<div className="px-4 pb-4 grid grid-cols-3 gap-2">
				<div className="text-center p-2 rounded-lg bg-[var(--background-muted)]">
					<p className="text-lg font-semibold text-[var(--foreground)]">
						{partner.pastCollaborations}
					</p>
					<p className="text-xs text-[var(--foreground-muted)]">Collaborations</p>
				</div>
				<div className="text-center p-2 rounded-lg bg-[var(--background-muted)]">
					<p className="text-lg font-semibold text-[var(--foreground)]">
						{partner.activeOpportunities}
					</p>
					<p className="text-xs text-[var(--foreground-muted)]">Active</p>
				</div>
				<div className="text-center p-2 rounded-lg bg-[var(--background-muted)]">
					{partner.performanceRating ? (
						<>
							<p className="text-lg font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
								<StarIcon className="h-4 w-4" />
								{partner.performanceRating.toFixed(1)}
							</p>
							<p className="text-xs text-[var(--foreground-muted)]">Rating</p>
						</>
					) : (
						<>
							<p className="text-lg font-semibold text-[var(--foreground-muted)]">
								—
							</p>
							<p className="text-xs text-[var(--foreground-muted)]">No rating</p>
						</>
					)}
				</div>
			</div>

			{/* Actions */}
			{showActions && (
				<div className="px-4 pb-4 flex gap-2">
					{onEdit && (
						<button
							onClick={() => onEdit(partner)}
							className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-muted)] transition-colors"
						>
							Edit
						</button>
					)}
					{onAssign && (
						<button
							onClick={() => onAssign(partner)}
							className="flex-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
						>
							Assign
						</button>
					)}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Partner List Component
// ============================================================================

interface PartnerListProps {
	partners: PartnerListItem[];
	variant?: "grid" | "list";
	emptyMessage?: string;
	onEdit?: (partner: PartnerListItem) => void;
	onAssign?: (partner: PartnerListItem) => void;
}

export function PartnerList({
	partners,
	variant = "grid",
	emptyMessage = "No partners found",
	onEdit,
	onAssign,
}: PartnerListProps) {
	if (partners.length === 0) {
		return (
			<div className="text-center py-12">
				<TeamIcon className="h-12 w-12 mx-auto text-[var(--foreground-muted)] opacity-50 mb-3" />
				<p className="text-[var(--foreground-muted)]">{emptyMessage}</p>
			</div>
		);
	}

	if (variant === "list") {
		return (
			<div className="space-y-2">
				{partners.map((partner) => (
					<PartnerCard
						key={partner.id}
						partner={partner}
						variant="compact"
						onEdit={onEdit}
						onAssign={onAssign}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{partners.map((partner) => (
				<PartnerCard
					key={partner.id}
					partner={partner}
					onEdit={onEdit}
					onAssign={onAssign}
				/>
			))}
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
	const styles: Record<string, string> = {
		active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
		pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
		archived: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	};

	return (
		<span
			className={cn(
				"text-xs px-2 py-0.5 rounded-full capitalize",
				styles[status] || styles.inactive
			)}
		>
			{status}
		</span>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function getPartnerTypeIcon(type: PartnerType | null): string {
	const icons: Record<PartnerType, string> = {
		prime: "🏛️",
		sub: "🤝",
		consultant: "💼",
		vendor: "📦",
		other: "🔗",
	};
	return type ? icons[type] : "🔗";
}

function formatPartnerType(type: PartnerType | null): string {
	const labels: Record<PartnerType, string> = {
		prime: "Prime Contractor",
		sub: "Subcontractor",
		consultant: "Consultant",
		vendor: "Vendor",
		other: "Partner",
	};
	return type ? labels[type] : "Partner";
}

// ============================================================================
// Icons
// ============================================================================

function StarIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="currentColor" viewBox="0 0 20 20">
			<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
		</svg>
	);
}

function UserIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
		</svg>
	);
}

function EmailIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
		</svg>
	);
}

function TeamIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
		</svg>
	);
}
