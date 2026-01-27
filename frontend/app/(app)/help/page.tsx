/**
 * Help Page - DocFusion
 *
 * Documentation and support resources.
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	HelpCircle,
	BookOpen,
	MessageCircle,
	Video,
	FileText,
	Search,
	ExternalLink,
	ChevronRight,
	Keyboard,
	Zap,
	Shield,
	Users,
} from "lucide-react";

const helpCategories = [
	{
		icon: BookOpen,
		title: "Getting Started",
		description: "Learn the basics of DocFusion",
		articles: ["Quick start guide", "Creating your first document", "Importing opportunities"],
	},
	{
		icon: FileText,
		title: "Documents",
		description: "Working with proposals and templates",
		articles: ["Document editor basics", "Using AI assistance", "Collaboration features"],
	},
	{
		icon: Zap,
		title: "Opportunities",
		description: "Managing RFPs and bids",
		articles: ["Importing from spreadsheets", "Go/No-Go decisions", "Requirements tracking"],
	},
	{
		icon: Users,
		title: "Team & Partners",
		description: "Collaboration and access control",
		articles: ["Inviting team members", "Partner management", "Permission levels"],
	},
	{
		icon: Shield,
		title: "Security & Privacy",
		description: "Protecting your data",
		articles: ["Data encryption", "Access controls", "Compliance features"],
	},
	{
		icon: Keyboard,
		title: "Keyboard Shortcuts",
		description: "Work faster with shortcuts",
		articles: ["Editor shortcuts", "Navigation shortcuts", "Custom keybindings"],
	},
];

const quickLinks = [
	{ icon: Video, label: "Video Tutorials", href: "#" },
	{ icon: MessageCircle, label: "Contact Support", href: "#" },
	{ icon: ExternalLink, label: "API Documentation", href: "#" },
];

export default function HelpPage() {
	const [searchQuery, setSearchQuery] = React.useState("");

	return (
		<div className="relative max-w-4xl mx-auto">
			{/* Page Header */}
			<div className="text-center mb-8">
				<h1 className="heading-display text-2xl text-[var(--ink-100)] mb-2">
					How can we help?
				</h1>
				<p className="text-sm text-[var(--ink-500)]">
					Search our knowledge base or browse topics below
				</p>
			</div>

			{/* Search */}
			<div className="relative mb-8">
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--ink-500)]" />
				<input
					type="text"
					placeholder="Search for help articles..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className={cn(
						"w-full h-12 pl-12 pr-4 rounded-xl",
						"bg-[var(--ink-900)]/50 border border-[var(--ink-800)]",
						"text-[var(--ink-100)] placeholder-[var(--ink-500)] text-base",
						"focus:outline-none focus:border-[var(--accent-500)]/50 focus:ring-1 focus:ring-[var(--accent-500)]/20",
						"transition-all duration-200"
					)}
				/>
			</div>

			{/* Quick Links */}
			<div className="flex items-center justify-center gap-4 mb-8">
				{quickLinks.map((link) => (
					<a
						key={link.label}
						href={link.href}
						className={cn(
							"flex items-center gap-2 px-4 py-2 rounded-xl",
							"bg-[var(--ink-800)]/50 text-[var(--ink-400)]",
							"hover:bg-[var(--ink-800)] hover:text-[var(--ink-200)]",
							"transition-all duration-200"
						)}
					>
						<link.icon className="w-4 h-4" />
						<span className="text-sm font-medium">{link.label}</span>
					</a>
				))}
			</div>

			{/* Help Categories */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{helpCategories.map((category, index) => (
					<div
						key={category.title}
						className={cn(
							"group p-5 rounded-2xl",
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
						<div className="flex items-start gap-4">
							<div className="w-10 h-10 rounded-xl bg-[var(--accent-500)]/10 flex items-center justify-center flex-shrink-0">
								<category.icon className="h-5 w-5 text-[var(--accent-400)]" />
							</div>
							<div className="flex-1 min-w-0">
								<h3 className="text-[var(--ink-100)] font-semibold text-base mb-1 group-hover:text-[var(--accent-300)] transition-colors">
									{category.title}
								</h3>
								<p className="text-sm text-[var(--ink-500)] mb-3">
									{category.description}
								</p>
								<ul className="space-y-1">
									{category.articles.map((article) => (
										<li key={article}>
											<a
												href="#"
												className="flex items-center gap-2 text-sm text-[var(--ink-400)] hover:text-[var(--accent-400)] transition-colors"
											>
												<ChevronRight className="w-3 h-3" />
												{article}
											</a>
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Contact Support */}
			<div className="mt-8 p-6 rounded-2xl border border-[var(--ink-800)]/50 bg-[var(--ink-900)]/30 text-center">
				<div className="w-12 h-12 rounded-xl bg-[var(--accent-500)]/10 flex items-center justify-center mx-auto mb-4">
					<MessageCircle className="h-6 w-6 text-[var(--accent-400)]" />
				</div>
				<h3 className="text-lg font-semibold text-[var(--ink-100)] mb-2">
					Still need help?
				</h3>
				<p className="text-sm text-[var(--ink-500)] mb-4">
					Our support team is here to assist you with any questions.
				</p>
				<Button className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)]">
					Contact Support
				</Button>
			</div>
		</div>
	);
}
