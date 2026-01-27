/**
 * Partners Page - DocFusion
 *
 * Team members and external collaborators management.
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Users,
	Plus,
	Search,
	Mail,
	Phone,
	Building2,
	Star,
	MoreVertical,
	UserPlus,
	Edit3,
	Trash2,
	ExternalLink,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Placeholder partner data
const partners = [
	{
		id: "1",
		name: "Acacia Consulting Ltd",
		type: "Prime",
		contactName: "Sarah Johnson",
		contactEmail: "sarah@acaciaconsulting.com",
		capabilities: ["IT Infrastructure", "Cybersecurity"],
		collaborations: 8,
		rating: 4.5,
		status: "active",
	},
	{
		id: "2",
		name: "TechBridge Solutions",
		type: "Subcontractor",
		contactName: "Michael Chen",
		contactEmail: "m.chen@techbridge.io",
		capabilities: ["Software Development", "Cloud Services"],
		collaborations: 5,
		rating: 4.2,
		status: "active",
	},
	{
		id: "3",
		name: "Impact Analytics Group",
		type: "Consultant",
		contactName: "Dr. Amina Osei",
		contactEmail: "aosei@impactanalytics.org",
		capabilities: ["M&E", "Data Analytics"],
		collaborations: 3,
		rating: 4.8,
		status: "active",
	},
	{
		id: "4",
		name: "Horizon Development Partners",
		type: "Subcontractor",
		contactName: "James Mwangi",
		contactEmail: "jmwangi@horizondp.co.ke",
		capabilities: ["Project Management", "Training"],
		collaborations: 6,
		rating: 4.0,
		status: "inactive",
	},
];

export default function PartnersPage() {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [typeFilter, setTypeFilter] = React.useState<string | "all">("all");

	const filteredPartners = partners.filter((p) => {
		const matchesSearch =
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.contactName.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesType = typeFilter === "all" || p.type === typeFilter;
		return matchesSearch && matchesType;
	});

	const typeColors = {
		Prime: "bg-[var(--accent-500)]/20 text-[var(--accent-400)]",
		Subcontractor: "bg-[var(--info-500)]/20 text-[var(--info-500)]",
		Consultant: "bg-[var(--success-500)]/20 text-[var(--success-500)]",
	};

	return (
		<div className="relative">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="heading-display text-2xl text-[var(--ink-100)] mb-1">
						Partners
					</h1>
					<p className="text-sm text-[var(--ink-500)]">
						Manage team members, subcontractors, and external collaborators
					</p>
				</div>
				<Button className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)] font-semibold">
					<UserPlus className="h-4 w-4" />
					<span className="hidden sm:inline">Add Partner</span>
				</Button>
			</div>

			{/* Search and Filter */}
			<div className="flex items-center gap-4 mb-6">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-500)]" />
					<input
						type="text"
						placeholder="Search partners..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className={cn(
							"w-full h-10 pl-11 pr-4 rounded-xl",
							"bg-[var(--ink-900)]/50 border border-[var(--ink-800)]",
							"text-[var(--ink-100)] placeholder-[var(--ink-500)]",
							"focus:outline-none focus:border-[var(--accent-500)]/50 focus:ring-1 focus:ring-[var(--accent-500)]/20",
							"transition-all duration-200"
						)}
					/>
				</div>

				<div className="flex items-center gap-2">
					{["all", "Prime", "Subcontractor", "Consultant"].map((type) => (
						<button
							key={type}
							onClick={() => setTypeFilter(type)}
							className={cn(
								"px-3 py-2 rounded-lg text-sm font-medium transition-all",
								typeFilter === type
									? "bg-[var(--accent-500)]/20 text-[var(--accent-400)] border border-[var(--accent-500)]/30"
									: "bg-[var(--ink-800)]/50 text-[var(--ink-400)] border border-[var(--ink-700)]/50 hover:text-[var(--ink-200)]"
							)}
						>
							{type === "all" ? "All" : type}
						</button>
					))}
				</div>
			</div>

			{/* Partners Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{filteredPartners.map((partner, index) => (
					<div
						key={partner.id}
						className={cn(
							"group relative flex flex-col p-5 rounded-2xl",
							"bg-gradient-to-br from-[var(--ink-900)]/80 to-[var(--ink-900)]/40",
							"border border-[var(--ink-800)]/50 hover:border-[var(--ink-700)]",
							"transition-all duration-300 ease-out",
							"opacity-0 animate-fade-up",
							partner.status === "inactive" && "opacity-60"
						)}
						style={{
							animationDelay: `${index * 50}ms`,
							animationFillMode: "forwards",
						}}
					>
						<div className="flex items-start justify-between mb-4">
							{/* Avatar & Name */}
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center text-white font-semibold text-lg">
									{partner.name.charAt(0)}
								</div>
								<div>
									<h3 className="text-[var(--ink-100)] font-semibold text-base group-hover:text-[var(--accent-300)] transition-colors">
										{partner.name}
									</h3>
									<span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", typeColors[partner.type as keyof typeof typeColors])}>
										{partner.type}
									</span>
								</div>
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className="p-1.5 rounded-lg text-[var(--ink-500)] hover:text-[var(--ink-300)] hover:bg-[var(--ink-800)]/50 transition-all">
										<MoreVertical className="w-4 h-4" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="bg-[var(--ink-900)] border-[var(--ink-700)]">
									<DropdownMenuItem className="text-[var(--ink-300)]">
										<Edit3 className="w-4 h-4 mr-2" />
										Edit
									</DropdownMenuItem>
									<DropdownMenuItem className="text-[var(--ink-300)]">
										<ExternalLink className="w-4 h-4 mr-2" />
										View Profile
									</DropdownMenuItem>
									<DropdownMenuSeparator className="bg-[var(--ink-800)]" />
									<DropdownMenuItem className="text-[var(--error-400)]">
										<Trash2 className="w-4 h-4 mr-2" />
										Remove
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						{/* Contact Info */}
						<div className="space-y-2 mb-4">
							<div className="flex items-center gap-2 text-sm text-[var(--ink-400)]">
								<Building2 className="w-4 h-4" />
								{partner.contactName}
							</div>
							<div className="flex items-center gap-2 text-sm text-[var(--ink-500)]">
								<Mail className="w-4 h-4" />
								{partner.contactEmail}
							</div>
						</div>

						{/* Capabilities */}
						<div className="flex flex-wrap gap-2 mb-4">
							{partner.capabilities.map((cap) => (
								<span
									key={cap}
									className="px-2 py-1 text-xs bg-[var(--ink-800)]/50 text-[var(--ink-400)] rounded-lg"
								>
									{cap}
								</span>
							))}
						</div>

						{/* Stats */}
						<div className="flex items-center justify-between pt-3 border-t border-[var(--ink-800)]/50 text-xs text-[var(--ink-500)]">
							<span>{partner.collaborations} collaborations</span>
							<div className="flex items-center gap-1">
								<Star className="w-3 h-3 fill-[var(--accent-400)] text-[var(--accent-400)]" />
								<span className="text-[var(--accent-400)]">{partner.rating}</span>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Empty State */}
			{filteredPartners.length === 0 && (
				<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
					<div className="relative mb-8">
						<div className="absolute inset-0 bg-[var(--accent-500)]/20 rounded-3xl blur-2xl" />
						<div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center">
							<Users className="w-12 h-12 text-white" />
						</div>
					</div>

					<h3 className="heading-display text-2xl text-[var(--ink-100)] mb-3">
						{searchQuery || typeFilter !== "all" ? "No matching partners" : "No partners yet"}
					</h3>
					<p className="text-[var(--ink-500)] text-center max-w-md mb-8 leading-relaxed">
						{searchQuery || typeFilter !== "all"
							? "Try adjusting your search or filter."
							: "Add your first partner to start collaborating on proposals."}
					</p>
				</div>
			)}
		</div>
	);
}
