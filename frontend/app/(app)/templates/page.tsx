/**
 * Templates Page - DocFusion
 *
 * Reusable document templates for proposals.
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	LayoutTemplate,
	Plus,
	Search,
	FileText,
	Briefcase,
	Award,
	FileCheck,
	Star,
	MoreVertical,
	Copy,
	Edit3,
	Trash2,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Placeholder template data
const templates = [
	{
		id: "1",
		name: "Technical Proposal",
		description: "Standard technical approach template with methodology and deliverables sections",
		category: "Technical",
		usageCount: 24,
		lastUsed: "2 days ago",
		icon: FileText,
	},
	{
		id: "2",
		name: "Past Performance",
		description: "Template for showcasing relevant past performance and project experience",
		category: "Experience",
		usageCount: 18,
		lastUsed: "1 week ago",
		icon: Award,
	},
	{
		id: "3",
		name: "Management Plan",
		description: "Organizational structure, key personnel, and project management approach",
		category: "Management",
		usageCount: 15,
		lastUsed: "3 days ago",
		icon: Briefcase,
	},
	{
		id: "4",
		name: "Executive Summary",
		description: "High-impact executive summary with win themes and value proposition",
		category: "Summary",
		usageCount: 32,
		lastUsed: "1 day ago",
		icon: FileCheck,
	},
];

export default function TemplatesPage() {
	const [searchQuery, setSearchQuery] = React.useState("");

	const filteredTemplates = templates.filter(
		(t) =>
			t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.description.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="relative">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-foreground mb-1">
						Templates
					</h1>
					<p className="text-sm text-muted-foreground">
						Reusable document templates for faster proposal development
					</p>
				</div>
				<Button>
					<Plus className="h-4 w-4" />
					<span className="hidden sm:inline">New Template</span>
				</Button>
			</div>

			{/* Search */}
			<div className="relative mb-6">
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search templates..."
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

			{/* Templates Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredTemplates.map((template, index) => (
					<div
						key={template.id}
						className={cn(
							"group relative flex flex-col p-5 rounded-xl",
							"bg-card border border-border shadow-sm",
							"hover:shadow-md hover:border-primary/50",
							"transition-all duration-300 ease-out",
							"animate-fade-up"
						)}
						style={{
							animationDelay: `${index * 50}ms`,
							animationFillMode: "forwards",
						}}
					>
						{/* Icon */}
						<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
							<template.icon className="h-5 w-5 text-primary" />
						</div>

						{/* Content */}
						<h3 className="text-foreground font-semibold text-base mb-2 group-hover:text-primary transition-colors">
							{template.name}
						</h3>
						<p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
							{template.description}
						</p>

						{/* Meta */}
						<div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1">
									<Star className="w-3 h-3" />
									{template.usageCount} uses
								</span>
								<span>{template.lastUsed}</span>
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
										<MoreVertical className="w-4 h-4" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem>
										<Copy className="w-4 h-4 mr-2" />
										Duplicate
									</DropdownMenuItem>
									<DropdownMenuItem>
										<Edit3 className="w-4 h-4 mr-2" />
										Edit
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem className="text-destructive focus:text-destructive">
										<Trash2 className="w-4 h-4 mr-2" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				))}
			</div>

			{/* Empty State */}
			{filteredTemplates.length === 0 && (
				<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
					<div className="relative mb-8">
						<div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl" />
						<div className="relative w-24 h-24 rounded-2xl bg-primary flex items-center justify-center">
							<LayoutTemplate className="w-12 h-12 text-primary-foreground" />
						</div>
					</div>

					<h3 className="text-2xl font-bold text-foreground mb-3">
						{searchQuery ? "No matching templates" : "No templates yet"}
					</h3>
					<p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
						{searchQuery
							? "Try adjusting your search query."
							: "Create your first template to speed up proposal development."}
					</p>
				</div>
			)}
		</div>
	);
}
