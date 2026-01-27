/**
 * PartnersClientPage Component - DocFusion
 *
 * Client-side partner management with filtering and dialogs.
 */

"use client";

import { useState, useMemo } from "react";
import type {
	PartnerListItem,
	Partner,
	PartnerType,
	PartnerStatus,
} from "@/lib/types/opportunity";
import {
	PartnerList,
	CreatePartnerDialog,
} from "@/components/partners";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PartnersClientPageProps {
	initialPartners: PartnerListItem[];
	capabilities: string[];
}

// ============================================================================
// Main Component
// ============================================================================

export function PartnersClientPage({
	initialPartners,
	capabilities,
}: PartnersClientPageProps) {
	const [partners, setPartners] = useState<PartnerListItem[]>(initialPartners);
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<PartnerType | "all">("all");
	const [statusFilter, setStatusFilter] = useState<PartnerStatus | "all">("all");
	const [capabilityFilter, setCapabilityFilter] = useState<string | "all">("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	// Filter partners
	const filteredPartners = useMemo(() => {
		return partners.filter((partner) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesSearch =
					partner.name.toLowerCase().includes(query) ||
					partner.contactName?.toLowerCase().includes(query) ||
					partner.contactEmail?.toLowerCase().includes(query) ||
					partner.capabilities.some((c) => c.toLowerCase().includes(query));
				if (!matchesSearch) return false;
			}

			// Type filter
			if (typeFilter !== "all" && partner.type !== typeFilter) {
				return false;
			}

			// Status filter
			if (statusFilter !== "all" && partner.status !== statusFilter) {
				return false;
			}

			// Capability filter
			if (
				capabilityFilter !== "all" &&
				!partner.capabilities.includes(capabilityFilter)
			) {
				return false;
			}

			return true;
		});
	}, [partners, searchQuery, typeFilter, statusFilter, capabilityFilter]);

	// Stats
	const stats = useMemo(() => {
		return {
			total: partners.length,
			active: partners.filter((p) => p.status === "active").length,
			totalCollaborations: partners.reduce(
				(sum, p) => sum + p.pastCollaborations,
				0
			),
			avgRating:
				partners.filter((p) => p.performanceRating).length > 0
					? partners
							.filter((p) => p.performanceRating)
							.reduce((sum, p) => sum + (p.performanceRating || 0), 0) /
						partners.filter((p) => p.performanceRating).length
					: null,
		};
	}, [partners]);

	const handlePartnerCreated = (partner: Partner) => {
		setPartners((prev) => [
			{
				...partner,
				activeOpportunities: 0,
			},
			...prev,
		]);
	};

	return (
		<div className="space-y-6">
			{/* Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard label="Total Partners" value={stats.total} />
				<StatCard label="Active Partners" value={stats.active} />
				<StatCard label="Total Collaborations" value={stats.totalCollaborations} />
				<StatCard
					label="Average Rating"
					value={stats.avgRating ? stats.avgRating.toFixed(1) : "—"}
					suffix={stats.avgRating ? "/5" : ""}
				/>
			</div>

			{/* Toolbar */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
				<div className="flex flex-col md:flex-row gap-4">
					{/* Search */}
					<div className="flex-1 relative">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--foreground-muted)]" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search partners..."
							className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>

					{/* Filters */}
					<div className="flex flex-wrap gap-2">
						<select
							value={typeFilter}
							onChange={(e) =>
								setTypeFilter(e.target.value as PartnerType | "all")
							}
							className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="all">All Types</option>
							<option value="prime">Prime Contractor</option>
							<option value="sub">Subcontractor</option>
							<option value="consultant">Consultant</option>
							<option value="vendor">Vendor</option>
							<option value="other">Other</option>
						</select>

						<select
							value={statusFilter}
							onChange={(e) =>
								setStatusFilter(e.target.value as PartnerStatus | "all")
							}
							className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="all">All Statuses</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
							<option value="pending">Pending</option>
							<option value="archived">Archived</option>
						</select>

						{capabilities.length > 0 && (
							<select
								value={capabilityFilter}
								onChange={(e) => setCapabilityFilter(e.target.value)}
								className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							>
								<option value="all">All Capabilities</option>
								{capabilities.map((cap) => (
									<option key={cap} value={cap}>
										{cap}
									</option>
								))}
							</select>
						)}
					</div>

					{/* View Toggle & Add Button */}
					<div className="flex gap-2">
						<div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
							<button
								onClick={() => setViewMode("grid")}
								className={cn(
									"px-3 py-2",
									viewMode === "grid"
										? "bg-blue-600 text-white"
										: "bg-[var(--background)] text-[var(--foreground)]"
								)}
							>
								<GridIcon className="h-4 w-4" />
							</button>
							<button
								onClick={() => setViewMode("list")}
								className={cn(
									"px-3 py-2",
									viewMode === "list"
										? "bg-blue-600 text-white"
										: "bg-[var(--background)] text-[var(--foreground)]"
								)}
							>
								<ListIcon className="h-4 w-4" />
							</button>
						</div>

						<Button onClick={() => setShowCreateDialog(true)}>
							Add Partner
						</Button>
					</div>
				</div>

				{/* Active Filters */}
				{(searchQuery ||
					typeFilter !== "all" ||
					statusFilter !== "all" ||
					capabilityFilter !== "all") && (
					<div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
						<span className="text-sm text-[var(--foreground-muted)]">
							Showing {filteredPartners.length} of {partners.length} partners
						</span>
						<button
							onClick={() => {
								setSearchQuery("");
								setTypeFilter("all");
								setStatusFilter("all");
								setCapabilityFilter("all");
							}}
							className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
						>
							Clear filters
						</button>
					</div>
				)}
			</div>

			{/* Partner List */}
			<PartnerList
				partners={filteredPartners}
				variant={viewMode}
				emptyMessage={
					searchQuery || typeFilter !== "all" || statusFilter !== "all"
						? "No partners match your filters"
						: "No partners yet. Add your first partner to get started."
				}
			/>

			{/* Create Dialog */}
			{showCreateDialog && (
				<CreatePartnerDialog
					onCreated={handlePartnerCreated}
					onClose={() => setShowCreateDialog(false)}
				/>
			)}
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
	label,
	value,
	suffix,
}: {
	label: string;
	value: string | number;
	suffix?: string;
}) {
	return (
		<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
			<p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
				{label}
			</p>
			<p className="text-2xl font-bold text-[var(--foreground)] mt-1">
				{value}
				{suffix && (
					<span className="text-sm font-normal text-[var(--foreground-muted)]">
						{suffix}
					</span>
				)}
			</p>
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function SearchIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
	);
}

function GridIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
		</svg>
	);
}

function ListIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	);
}
