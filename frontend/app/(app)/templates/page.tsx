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
					<h1 className="heading-display text-2xl text-[var(--ink-100)] mb-1">
						Templates
					</h1>
					<p className="text-sm text-[var(--ink-500)]">
						Reusable document templates for faster proposal development
					</p>
				</div>
				<Button className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)] font-semibold">
					<Plus className="h-4 w-4" />
					<span className="hidden sm:inline">New Template</span>
				</Button>
			</div>

			{/* Search */}
			<div className="relative mb-6">
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-500)]" />
				<input
					type="text"
					placeholder="Search templates..."
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

			{/* Templates Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredTemplates.map((template, index) => (
					<div
						key={template.id}
						className={cn(
							"group relative flex flex-col p-5 rounded-2xl",
							"bg-gradient-to-br from-[var(--ink-900)]/80 to-[var(--ink-900)]/40",
							"border border-[var(--ink-800)]/50 hover:border-[var(--ink-700)]",
							"transition-all duration-300 ease-out",
							"opacity-0 animate-fade-up"
						)}
						style={{
							animationDelay: `${index * 50}ms`,
							animationFillMode: "forwards",
						}}
					>
						{/* Icon */}
						<div className="w-10 h-10 rounded-xl bg-[var(--accent-500)]/10 flex items-center justify-center mb-4">
							<template.icon className="h-5 w-5 text-[var(--accent-400)]" />
						</div>

						{/* Content */}
						<h3 className="text-[var(--ink-100)] font-semibold text-base mb-2 group-hover:text-[var(--accent-300)] transition-colors">
							{template.name}
						</h3>
						<p className="text-sm text-[var(--ink-500)] mb-4 line-clamp-2 flex-1">
							{template.description}
						</p>

						{/* Meta */}
						<div className="flex items-center justify-between pt-3 border-t border-[var(--ink-800)]/50 text-xs text-[var(--ink-500)]">
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1">
									<Star className="w-3 h-3" />
									{template.usageCount} uses
								</span>
								<span>{template.lastUsed}</span>
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className="p-1.5 rounded-lg text-[var(--ink-500)] hover:text-[var(--ink-300)] hover:bg-[var(--ink-800)]/50 transition-all">
										<MoreVertical className="w-4 h-4" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="bg-[var(--ink-900)] border-[var(--ink-700)]">
									<DropdownMenuItem className="text-[var(--ink-300)]">
										<Copy className="w-4 h-4 mr-2" />
										Duplicate
									</DropdownMenuItem>
									<DropdownMenuItem className="text-[var(--ink-300)]">
										<Edit3 className="w-4 h-4 mr-2" />
										Edit
									</DropdownMenuItem>
									<DropdownMenuSeparator className="bg-[var(--ink-800)]" />
									<DropdownMenuItem className="text-[var(--error-400)]">
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
						<div className="absolute inset-0 bg-[var(--accent-500)]/20 rounded-3xl blur-2xl" />
						<div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center">
							<LayoutTemplate className="w-12 h-12 text-white" />
						</div>
					</div>

					<h3 className="heading-display text-2xl text-[var(--ink-100)] mb-3">
						{searchQuery ? "No matching templates" : "No templates yet"}
					</h3>
					<p className="text-[var(--ink-500)] text-center max-w-md mb-8 leading-relaxed">
						{searchQuery
							? "Try adjusting your search query."
							: "Create your first template to speed up proposal development."}
					</p>
				</div>
			)}
		</div>
	);
}
