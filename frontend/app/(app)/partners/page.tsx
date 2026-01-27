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
		Prime: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
		Subcontractor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
		Consultant: "bg-green-500/10 text-green-600 dark:text-green-400",
	};

	return (
		<div className="relative">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-foreground mb-1">
						Partners
					</h1>
					<p className="text-sm text-muted-foreground">
						Manage team members, subcontractors, and external collaborators
					</p>
				</div>
				<Button>
					<UserPlus className="h-4 w-4" />
					<span className="hidden sm:inline">Add Partner</span>
				</Button>
			</div>

			{/* Search and Filter */}
			<div className="flex items-center gap-4 mb-6">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search partners..."
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

				<div className="flex items-center gap-2">
					{["all", "Prime", "Subcontractor", "Consultant"].map((type) => (
						<button
							key={type}
							onClick={() => setTypeFilter(type)}
							className={cn(
								"px-3 py-2 rounded-lg text-sm font-medium transition-all",
								typeFilter === type
									? "bg-primary/10 text-primary border border-primary/20"
									: "bg-muted/50 text-muted-foreground border border-transparent hover:text-foreground"
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
							"bg-card border border-border shadow-sm",
							"hover:shadow-md hover:border-primary/50",
							"transition-all duration-300 ease-out",
							"animate-fade-up",
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
								<div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
									{partner.name.charAt(0)}
								</div>
								<div>
									<h3 className="text-foreground font-semibold text-base group-hover:text-primary transition-colors">
										{partner.name}
									</h3>
									<span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", typeColors[partner.type as keyof typeof typeColors])}>
										{partner.type}
									</span>
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
										View Profile
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem className="text-destructive focus:text-destructive">
										<Trash2 className="w-4 h-4 mr-2" />
										Remove
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						{/* Contact Info */}
						<div className="space-y-2 mb-4">
							<div className="flex items-center gap-2 text-sm text-foreground/80">
								<Building2 className="w-4 h-4 text-muted-foreground" />
								{partner.contactName}
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Mail className="w-4 h-4" />
								{partner.contactEmail}
							</div>
						</div>

						{/* Capabilities */}
						<div className="flex flex-wrap gap-2 mb-4">
							{partner.capabilities.map((cap) => (
								<span
									key={cap}
									className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-lg"
								>
									{cap}
								</span>
							))}
						</div>

						{/* Stats */}
						<div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
							<span>{partner.collaborations} collaborations</span>
							<div className="flex items-center gap-1">
								<Star className="w-3 h-3 fill-amber-400 text-amber-400" />
								<span className="text-amber-500 font-medium">{partner.rating}</span>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Empty State */}
			{filteredPartners.length === 0 && (
				<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
					<div className="relative mb-8">
						<div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl" />
						<div className="relative w-24 h-24 rounded-2xl bg-primary flex items-center justify-center">
							<Users className="w-12 h-12 text-primary-foreground" />
						</div>
					</div>

					<h3 className="text-2xl font-bold text-foreground mb-3">
						{searchQuery || typeFilter !== "all" ? "No matching partners" : "No partners yet"}
					</h3>
					<p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
						{searchQuery || typeFilter !== "all"
							? "Try adjusting your search or filter."
							: "Add your first partner to start collaborating on proposals."}
					</p>
				</div>
			)}
		</div>
	);
}
