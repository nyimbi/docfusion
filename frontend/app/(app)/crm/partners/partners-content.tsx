/**
 * Partners Content - Client Component (CRM Module)
 *
 * Interactive partners UI with region/country organization and filtering.
 * Integrated with the CRM navigation for unified relationship management.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import {
	Users,
	Search,
	Mail,
	Phone,
	Building2,
	Star,
	MoreVertical,
	UserPlus,
	Edit3,
	ExternalLink,
	Globe,
	MapPin,
	ChevronDown,
	ChevronRight,
	Award,
	TrendingUp,
	Filter,
	X,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExtendedPartnerListItem } from "@/lib/actions/partners";

interface PartnersContentProps {
	groupedPartners: {
		regions: Array<{
			region: string;
			partnerCount: number;
			countries: Array<{
				country: string;
				partners: ExtendedPartnerListItem[];
			}>;
		}>;
		ungrouped: ExtendedPartnerListItem[];
	};
	stats: {
		totalPartners: number;
		tier1Count: number;
		tier2Count: number;
		tier3Count: number;
		regionCount: number;
		countryCount: number;
		averageFitScore: number;
	};
}

export function PartnersContent({ groupedPartners, stats }: PartnersContentProps) {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [selectedRegion, setSelectedRegion] = React.useState<string | null>(null);
	const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
	const [selectedTier, setSelectedTier] = React.useState<number | null>(null);
	const [expandedRegions, setExpandedRegions] = React.useState<Set<string>>(new Set());
	const [expandedCountries, setExpandedCountries] = React.useState<Set<string>>(new Set());
	const [viewMode, setViewMode] = React.useState<"tree" | "grid">("tree");

	// Toggle region expansion
	const toggleRegion = (region: string) => {
		setExpandedRegions((prev) => {
			const next = new Set(prev);
			if (next.has(region)) {
				next.delete(region);
			} else {
				next.add(region);
			}
			return next;
		});
	};

	// Toggle country expansion
	const toggleCountry = (countryKey: string) => {
		setExpandedCountries((prev) => {
			const next = new Set(prev);
			if (next.has(countryKey)) {
				next.delete(countryKey);
			} else {
				next.add(countryKey);
			}
			return next;
		});
	};

	// Filter partners based on search and filters
	const filterPartner = (partner: ExtendedPartnerListItem): boolean => {
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const matchesSearch =
				partner.name.toLowerCase().includes(query) ||
				partner.contactName?.toLowerCase().includes(query) ||
				partner.description?.toLowerCase().includes(query) ||
				partner.coreCapabilities?.toLowerCase().includes(query) ||
				partner.country?.toLowerCase().includes(query);
			if (!matchesSearch) return false;
		}

		if (selectedRegion && partner.region !== selectedRegion) return false;
		if (selectedCountry && partner.country !== selectedCountry) return false;
		if (selectedTier && partner.tier !== selectedTier) return false;

		return true;
	};

	// Get all partners as flat list for grid view
	const allPartners = React.useMemo(() => {
		const partners: ExtendedPartnerListItem[] = [];
		for (const region of groupedPartners.regions) {
			for (const country of region.countries) {
				partners.push(...country.partners);
			}
		}
		partners.push(...groupedPartners.ungrouped);
		return partners.filter(filterPartner);
	}, [groupedPartners, searchQuery, selectedRegion, selectedCountry, selectedTier]);

	// Clear all filters
	const clearFilters = () => {
		setSearchQuery("");
		setSelectedRegion(null);
		setSelectedCountry(null);
		setSelectedTier(null);
	};

	const hasFilters = !!(searchQuery || selectedRegion || selectedCountry || selectedTier !== null);

	// Get tier badge color
	const getTierColor = (tier: number | null) => {
		switch (tier) {
			case 1:
				return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
			case 2:
				return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
			case 3:
				return "bg-muted text-muted-foreground border-border";
			default:
				return "bg-muted/50 text-muted-foreground border-border";
		}
	};

	// Get fit score color
	const getScoreColor = (score: number | null) => {
		if (!score) return "text-muted-foreground";
		if (score >= 8) return "text-green-600 dark:text-green-400";
		if (score >= 6) return "text-amber-600 dark:text-amber-400";
		return "text-muted-foreground";
	};

	return (
		<div className="flex-1 flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="Partners"
				description={`${stats.totalPartners} partners across ${stats.countryCount} countries in ${stats.regionCount} regions`}
				actions={
					<Button asChild>
						<Link href="/crm/accounts/new?type=partner">
							<UserPlus className="h-4 w-4 mr-2" />
							<span className="hidden sm:inline">Add Partner</span>
						</Link>
					</Button>
				}
			/>

			{/* Filters and Content */}
			<div className="flex-1 flex flex-col overflow-hidden px-6 pt-4 pb-6">
				{/* Stats Cards */}
				<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
					<StatCard
						icon={Users}
						label="Total Partners"
						value={stats.totalPartners}
						color="primary"
					/>
					<StatCard
						icon={Award}
						label="Tier 1 Partners"
						value={stats.tier1Count}
						color="amber"
						onClick={() => setSelectedTier(selectedTier === 1 ? null : 1)}
						active={selectedTier === 1}
					/>
					<StatCard
						icon={TrendingUp}
						label="Tier 2 Partners"
						value={stats.tier2Count}
						color="blue"
						onClick={() => setSelectedTier(selectedTier === 2 ? null : 2)}
						active={selectedTier === 2}
					/>
					<StatCard
						icon={Building2}
						label="Tier 3 Partners"
						value={stats.tier3Count}
						color="muted"
						onClick={() => setSelectedTier(selectedTier === 3 ? null : 3)}
						active={selectedTier === 3}
					/>
					<StatCard icon={Globe} label="Regions" value={stats.regionCount} color="green" />
					<StatCard
						icon={Star}
						label="Avg Fit Score"
						value={stats.averageFitScore}
						color="purple"
					/>
				</div>

				{/* Search and Filter */}
				<div className="flex items-center gap-3 flex-wrap mb-4">
					<div className="relative flex-1 min-w-[280px] max-w-md">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search partners, capabilities, countries..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className={cn(
								"w-full h-10 pl-11 pr-4 rounded-xl",
								"bg-background border border-input",
								"text-foreground placeholder:text-muted-foreground",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:border-input",
								"transition-all duration-200"
							)}
						/>
					</div>

					{/* Region Filter */}
					<select
						value={selectedRegion || ""}
						onChange={(e) => setSelectedRegion(e.target.value || null)}
						className={cn(
							"h-10 px-4 rounded-xl text-sm",
							"bg-background border border-input",
							"text-foreground",
							"focus:outline-none focus:ring-2 focus:ring-ring"
						)}
					>
						<option value="">All Regions</option>
						{groupedPartners.regions.map((r) => (
							<option key={r.region} value={r.region}>
								{r.region} ({r.partnerCount})
							</option>
						))}
					</select>

					{/* View Mode Toggle */}
					<div className="flex items-center rounded-xl border border-input bg-background">
						<button
							onClick={() => setViewMode("tree")}
							className={cn(
								"px-3 py-2 text-sm font-medium rounded-l-xl transition-all",
								viewMode === "tree"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							Tree
						</button>
						<button
							onClick={() => setViewMode("grid")}
							className={cn(
								"px-3 py-2 text-sm font-medium rounded-r-xl transition-all",
								viewMode === "grid"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							Grid
						</button>
					</div>

					{hasFilters && (
						<Button variant="ghost" size="sm" onClick={clearFilters}>
							<X className="h-4 w-4 mr-1" />
							Clear
						</Button>
					)}
				</div>

				{/* Content Area */}
				<div className="flex-1 overflow-y-auto scrollbar-thin">
					{viewMode === "tree" ? (
						<TreeView
							groupedPartners={groupedPartners}
							filterPartner={filterPartner}
							expandedRegions={expandedRegions}
							expandedCountries={expandedCountries}
							toggleRegion={toggleRegion}
							toggleCountry={toggleCountry}
							getTierColor={getTierColor}
							getScoreColor={getScoreColor}
						/>
					) : (
						<GridView
							partners={allPartners}
							getTierColor={getTierColor}
							getScoreColor={getScoreColor}
						/>
					)}

					{allPartners.length === 0 && (
						<EmptyState hasFilters={hasFilters} clearFilters={clearFilters} />
					)}
				</div>
			</div>
		</div>
	);
}

// Stat Card Component
function StatCard({
	icon: Icon,
	label,
	value,
	color,
	onClick,
	active,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: number;
	color: "primary" | "amber" | "blue" | "green" | "purple" | "muted";
	onClick?: () => void;
	active?: boolean;
}) {
	const colorClasses = {
		primary: "text-primary bg-primary/10",
		amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
		blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
		green: "text-green-600 dark:text-green-400 bg-green-500/10",
		purple: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
		muted: "text-muted-foreground bg-muted/50",
	};

	return (
		<button
			onClick={onClick}
			disabled={!onClick}
			className={cn(
				"flex items-center gap-3 p-3 rounded-xl border transition-all",
				onClick ? "cursor-pointer hover:border-primary/50" : "cursor-default",
				active ? "border-primary bg-primary/5" : "border-border bg-card"
			)}
		>
			<div className={cn("p-2 rounded-lg", colorClasses[color])}>
				<Icon className="h-4 w-4" />
			</div>
			<div className="text-left">
				<p className="text-lg font-bold text-foreground">{value}</p>
				<p className="text-xs text-muted-foreground">{label}</p>
			</div>
		</button>
	);
}

// Tree View Component
function TreeView({
	groupedPartners,
	filterPartner,
	expandedRegions,
	expandedCountries,
	toggleRegion,
	toggleCountry,
	getTierColor,
	getScoreColor,
}: {
	groupedPartners: PartnersContentProps["groupedPartners"];
	filterPartner: (p: ExtendedPartnerListItem) => boolean;
	expandedRegions: Set<string>;
	expandedCountries: Set<string>;
	toggleRegion: (region: string) => void;
	toggleCountry: (countryKey: string) => void;
	getTierColor: (tier: number | null) => string;
	getScoreColor: (score: number | null) => string;
}) {
	return (
		<div className="space-y-2">
			{groupedPartners.regions.map((region) => {
				const filteredCountries = region.countries
					.map((country) => ({
						...country,
						partners: country.partners.filter(filterPartner),
					}))
					.filter((country) => country.partners.length > 0);

				if (filteredCountries.length === 0) return null;

				const isExpanded = expandedRegions.has(region.region);
				const totalFiltered = filteredCountries.reduce((sum, c) => sum + c.partners.length, 0);

				return (
					<div key={region.region} className="border border-border rounded-xl overflow-hidden">
						{/* Region Header */}
						<button
							onClick={() => toggleRegion(region.region)}
							className={cn(
								"w-full flex items-center justify-between p-4",
								"bg-muted/30 hover:bg-muted/50 transition-colors"
							)}
						>
							<div className="flex items-center gap-3">
								{isExpanded ? (
									<ChevronDown className="h-5 w-5 text-muted-foreground" />
								) : (
									<ChevronRight className="h-5 w-5 text-muted-foreground" />
								)}
								<Globe className="h-5 w-5 text-primary" />
								<span className="font-semibold text-foreground">{region.region}</span>
							</div>
							<span className="text-sm text-muted-foreground">
								{totalFiltered} partner{totalFiltered !== 1 ? "s" : ""} in{" "}
								{filteredCountries.length} countr{filteredCountries.length !== 1 ? "ies" : "y"}
							</span>
						</button>

						{/* Region Content */}
						{isExpanded && (
							<div className="border-t border-border">
								{filteredCountries.map((country) => {
									const countryKey = `${region.region}-${country.country}`;
									const isCountryExpanded = expandedCountries.has(countryKey);

									return (
										<div key={countryKey} className="border-b border-border last:border-b-0">
											{/* Country Header */}
											<button
												onClick={() => toggleCountry(countryKey)}
												className={cn(
													"w-full flex items-center justify-between p-3 pl-8",
													"hover:bg-muted/30 transition-colors"
												)}
											>
												<div className="flex items-center gap-2">
													{isCountryExpanded ? (
														<ChevronDown className="h-4 w-4 text-muted-foreground" />
													) : (
														<ChevronRight className="h-4 w-4 text-muted-foreground" />
													)}
													<MapPin className="h-4 w-4 text-muted-foreground" />
													<span className="font-medium text-foreground">{country.country}</span>
												</div>
												<span className="text-sm text-muted-foreground">
													{country.partners.length} partner{country.partners.length !== 1 ? "s" : ""}
												</span>
											</button>

											{/* Partners List */}
											{isCountryExpanded && (
												<div className="bg-background">
													{country.partners.map((partner) => (
														<PartnerRow
															key={partner.id}
															partner={partner}
															getTierColor={getTierColor}
															getScoreColor={getScoreColor}
														/>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

// Partner Row for Tree View
function PartnerRow({
	partner,
	getTierColor,
	getScoreColor,
}: {
	partner: ExtendedPartnerListItem;
	getTierColor: (tier: number | null) => string;
	getScoreColor: (score: number | null) => string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-4 p-3 pl-16 border-t border-border/50",
				"hover:bg-muted/20 transition-colors"
			)}
		>
			{/* Avatar */}
			<div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold">
				{partner.name.charAt(0)}
			</div>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-foreground truncate">{partner.name}</span>
					{partner.tier && (
						<span
							className={cn(
								"text-xs px-2 py-0.5 rounded-full border",
								getTierColor(partner.tier)
							)}
						>
							Tier {partner.tier}
						</span>
					)}
				</div>
				<p className="text-sm text-muted-foreground truncate">
					{partner.coreCapabilities?.slice(0, 100) || partner.description?.slice(0, 100) || "No description"}
					{(partner.coreCapabilities?.length || partner.description?.length || 0) > 100 && "..."}
				</p>
			</div>

			{/* Score */}
			{partner.partnershipFitScore && (
				<div className="flex items-center gap-1">
					<Star className={cn("h-4 w-4", getScoreColor(partner.partnershipFitScore))} />
					<span className={cn("text-sm font-medium", getScoreColor(partner.partnershipFitScore))}>
						{partner.partnershipFitScore}
					</span>
				</div>
			)}

			{/* Contact */}
			<div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
				{partner.contactEmail && (
					<a
						href={`mailto:${partner.contactEmail}`}
						className="hover:text-foreground transition-colors"
					>
						<Mail className="h-4 w-4" />
					</a>
				)}
				{partner.website && (
					<a
						href={partner.website}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-foreground transition-colors"
					>
						<ExternalLink className="h-4 w-4" />
					</a>
				)}
			</div>

			{/* Actions */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
						<MoreVertical className="w-4 h-4" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem>
						<Edit3 className="w-4 h-4 mr-2" />
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem>
						<ExternalLink className="w-4 h-4 mr-2" />
						View Details
					</DropdownMenuItem>
					{partner.website && (
						<DropdownMenuItem asChild>
							<a href={partner.website} target="_blank" rel="noopener noreferrer">
								<Globe className="w-4 h-4 mr-2" />
								Visit Website
							</a>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

// Grid View Component
function GridView({
	partners,
	getTierColor,
	getScoreColor,
}: {
	partners: ExtendedPartnerListItem[];
	getTierColor: (tier: number | null) => string;
	getScoreColor: (score: number | null) => string;
}) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{partners.map((partner, index) => (
				<PartnerCard
					key={partner.id}
					partner={partner}
					index={index}
					getTierColor={getTierColor}
					getScoreColor={getScoreColor}
				/>
			))}
		</div>
	);
}

// Partner Card for Grid View
function PartnerCard({
	partner,
	index,
	getTierColor,
	getScoreColor,
}: {
	partner: ExtendedPartnerListItem;
	index: number;
	getTierColor: (tier: number | null) => string;
	getScoreColor: (score: number | null) => string;
}) {
	return (
		<div
			className={cn(
				"group relative flex flex-col p-5 rounded-2xl",
				"bg-card border border-border shadow-sm",
				"hover:shadow-md hover:border-primary/50",
				"transition-all duration-300 ease-out"
			)}
			style={{
				animationDelay: `${index * 30}ms`,
			}}
		>
			{/* Header */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
						{partner.name.charAt(0)}
					</div>
					<div className="min-w-0">
						<h3 className="text-foreground font-semibold text-base group-hover:text-primary transition-colors truncate">
							{partner.name}
						</h3>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<MapPin className="h-3 w-3" />
							<span className="truncate">
								{partner.country}
								{partner.region && `, ${partner.region}`}
							</span>
						</div>
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
							<MoreVertical className="w-4 h-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>
							<Edit3 className="w-4 h-4 mr-2" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem>
							<ExternalLink className="w-4 h-4 mr-2" />
							View Details
						</DropdownMenuItem>
						{partner.website && (
							<DropdownMenuItem asChild>
								<a href={partner.website} target="_blank" rel="noopener noreferrer">
									<Globe className="w-4 h-4 mr-2" />
									Visit Website
								</a>
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Badges */}
			<div className="flex flex-wrap gap-2 mb-3">
				{partner.tier && (
					<span className={cn("text-xs px-2 py-0.5 rounded-full border", getTierColor(partner.tier))}>
						Tier {partner.tier}
					</span>
				)}
				{partner.corporateStatus && (
					<span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
						{partner.corporateStatus}
					</span>
				)}
			</div>

			{/* Description */}
			<p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
				{partner.coreCapabilities || partner.description || "No description available"}
			</p>

			{/* Contact Info */}
			<div className="space-y-1.5 mb-4 text-sm">
				{partner.contactEmail && (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Mail className="w-3.5 h-3.5" />
						<a href={`mailto:${partner.contactEmail}`} className="truncate hover:text-foreground">
							{partner.contactEmail}
						</a>
					</div>
				)}
				{partner.employeeCount && (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Users className="w-3.5 h-3.5" />
						<span>{partner.employeeCount} employees</span>
					</div>
				)}
			</div>

			{/* Footer Stats */}
			<div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
				<div className="flex items-center gap-1">
					{partner.revenueEstimate && <span>{partner.revenueEstimate}</span>}
				</div>
				{partner.partnershipFitScore && (
					<div className="flex items-center gap-1">
						<Star className={cn("w-3.5 h-3.5", getScoreColor(partner.partnershipFitScore))} />
						<span className={cn("font-medium", getScoreColor(partner.partnershipFitScore))}>
							{partner.partnershipFitScore}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

// Empty State
function EmptyState({
	hasFilters,
	clearFilters,
}: {
	hasFilters: boolean;
	clearFilters: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-24">
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl" />
				<div className="relative w-24 h-24 rounded-2xl bg-primary flex items-center justify-center">
					<Users className="w-12 h-12 text-primary-foreground" />
				</div>
			</div>

			<h3 className="text-2xl font-bold text-foreground mb-3">
				{hasFilters ? "No matching partners" : "No partners yet"}
			</h3>
			<p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
				{hasFilters
					? "Try adjusting your search or filter criteria."
					: "Import partners to see them organized by region and country."}
			</p>
			{hasFilters && (
				<Button variant="outline" onClick={clearFilters}>
					<X className="h-4 w-4 mr-2" />
					Clear Filters
				</Button>
			)}
		</div>
	);
}
