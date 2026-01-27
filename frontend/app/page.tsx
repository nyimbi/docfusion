/**
 * Home Page - DocFusion
 *
 * A stunning, hypermodern landing experience that introduces
 * DocFusion's AI-powered document intelligence platform with
 * dramatic visual impact and sophisticated animations.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	FileText,
	Sparkles,
	Users,
	Shield,
	Zap,
	ArrowRight,
	Play,
	CheckCircle2,
	Wand2,
	GitBranch,
	Lock,
	BarChart3,
	Layers,
	Globe,
} from "lucide-react";

export default function HomePage() {
	return (
		<div className="min-h-screen bg-[var(--background)] overflow-x-hidden">
			{/* Navigation */}
			<Navigation />

			{/* Hero Section */}
			<HeroSection />

			{/* Features Grid */}
			<FeaturesSection />

			{/* How It Works */}
			<HowItWorksSection />

			{/* Stats Section */}
			<StatsSection />

			{/* CTA Section */}
			<CTASection />

			{/* Footer */}
			<Footer />
		</div>
	);
}

/**
 * Navigation header.
 */
function Navigation() {
	return (
		<nav className="fixed top-0 left-0 right-0 z-50">
			<div className="mx-4 mt-4">
				<div className="max-w-7xl mx-auto px-6 py-3 rounded-full glass border border-[var(--border)]">
					<div className="flex items-center justify-between">
						{/* Logo */}
						<Link href="/" className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center">
								<FileText className="h-4 w-4 text-white" />
							</div>
							<span className="font-semibold text-[var(--foreground)]">
								DocFusion
							</span>
						</Link>

						{/* Nav Links */}
						<div className="hidden md:flex items-center gap-8">
							<NavLink href="/documents">Documents</NavLink>
							<NavLink href="/opportunities">Opportunities</NavLink>
							<NavLink href="/templates">Templates</NavLink>
							<NavLink href="#features">Features</NavLink>
						</div>

						{/* Auth */}
						<div className="flex items-center gap-3">
							<Button variant="ghost" size="sm" asChild>
								<Link href="/login">Sign In</Link>
							</Button>
							<Button variant="accent" size="sm" asChild>
								<Link href="/documents">
									Get Started
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
}

function NavLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<a
			href={href}
			className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
		>
			{children}
		</a>
	);
}

/**
 * Hero section with dramatic visual impact.
 */
function HeroSection() {
	return (
		<section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden">
			{/* Background Elements */}
			<div className="absolute inset-0">
				{/* Gradient orbs */}
				<div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[var(--accent-200)] opacity-20 blur-3xl" />
				<div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[var(--accent-100)] opacity-30 blur-3xl" />

				{/* Grid pattern */}
				<div className="absolute inset-0 bg-grid opacity-30" />

				{/* Noise texture */}
				<div className="absolute inset-0 bg-noise" />
			</div>

			<div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
				<div className="text-center max-w-4xl mx-auto">
					{/* Badge */}
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-50)] border border-[var(--accent-200)] text-[var(--accent-700)] text-sm font-medium mb-8 animate-fade-down">
						<Sparkles className="h-4 w-4" />
						<span>AI-Powered Document Intelligence</span>
					</div>

					{/* Main Headline */}
					<h1 className="heading-display heading-display-xl text-[var(--foreground)] mb-6 animate-fade-up">
						Transform Documents into
						<br />
						<span className="text-gradient">Strategic Assets</span>
					</h1>

					{/* Subheadline */}
					<p className="text-xl text-[var(--foreground-muted)] max-w-2xl mx-auto mb-10 animate-fade-up stagger-1">
						Create, collaborate, and deliver exceptional documents with
						AI-powered composition, real-time collaboration, and predictive
						compliance checking.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up stagger-2">
						<Button variant="accent" size="lg" asChild>
							<Link href="/documents">
								Start Writing Free
								<ArrowRight className="h-5 w-5" />
							</Link>
						</Button>
						<Button variant="outline" size="lg">
							<Play className="h-5 w-5" />
							Watch Demo
						</Button>
					</div>

					{/* Trust Indicators */}
					<div className="mt-12 pt-12 border-t border-[var(--border)] animate-fade-up stagger-3">
						<p className="text-sm text-[var(--foreground-subtle)] mb-4">
							Trusted by forward-thinking teams
						</p>
						<div className="flex items-center justify-center gap-8 flex-wrap opacity-50">
							{["Acme Corp", "TechFlow", "Innovate Inc", "Scale Labs"].map(
								(company) => (
									<span
										key={company}
										className="text-lg font-semibold text-[var(--foreground-muted)]"
									>
										{company}
									</span>
								)
							)}
						</div>
					</div>
				</div>

				{/* Hero Visual */}
				<div className="mt-16 relative animate-fade-up stagger-4">
					<div className="relative mx-auto max-w-5xl">
						{/* Browser chrome */}
						<div className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-xl)] overflow-hidden">
							{/* Title bar */}
							<div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--background-subtle)]">
								<div className="flex gap-1.5">
									<div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
									<div className="w-3 h-3 rounded-full bg-[#febc2e]" />
									<div className="w-3 h-3 rounded-full bg-[#28c840]" />
								</div>
								<div className="flex-1 flex justify-center">
									<div className="px-4 py-1 rounded-md bg-[var(--background)] text-xs text-[var(--foreground-muted)]">
										docfusion.app/documents/proposal-draft
									</div>
								</div>
							</div>

							{/* Editor preview */}
							<div className="aspect-[16/10] bg-[var(--background)] p-8">
								<div className="h-full flex gap-6">
									{/* Editor pane */}
									<div className="flex-1 flex flex-col">
										<div className="flex items-center gap-2 mb-4">
											<div className="h-6 w-24 rounded bg-[var(--background-muted)]" />
											<div className="h-6 w-6 rounded bg-[var(--background-muted)]" />
											<div className="h-6 w-6 rounded bg-[var(--background-muted)]" />
										</div>
										<div className="flex-1 space-y-3">
											<div className="h-8 w-3/4 rounded bg-[var(--ink-100)]" />
											<div className="h-4 w-full rounded bg-[var(--background-muted)]" />
											<div className="h-4 w-full rounded bg-[var(--background-muted)]" />
											<div className="h-4 w-2/3 rounded bg-[var(--background-muted)]" />
											<div className="h-4 w-5/6 rounded bg-[var(--background-muted)]" />
											<div className="h-4 w-full rounded bg-[var(--background-muted)]" />
										</div>
									</div>

									{/* Markdown pane */}
									<div className="w-1/3 border-l border-[var(--border)] pl-6">
										<div className="text-xs text-[var(--foreground-subtle)] mb-3 font-mono">
											PREVIEW
										</div>
										<div className="space-y-2">
											<div className="h-3 w-full rounded bg-[var(--background-muted)]" />
											<div className="h-3 w-4/5 rounded bg-[var(--background-muted)]" />
											<div className="h-3 w-full rounded bg-[var(--background-muted)]" />
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Floating elements */}
						<div className="absolute -right-8 top-1/4 p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] shadow-[var(--shadow-lg)] animate-fade-up stagger-5">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-[var(--success-100)] flex items-center justify-center">
									<CheckCircle2 className="h-5 w-5 text-[var(--success-500)]" />
								</div>
								<div>
									<div className="text-sm font-medium text-[var(--foreground)]">
										Compliance Check
									</div>
									<div className="text-xs text-[var(--success-500)]">
										All requirements met
									</div>
								</div>
							</div>
						</div>

						<div className="absolute -left-8 bottom-1/4 p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] shadow-[var(--shadow-lg)] animate-fade-up stagger-6">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-[var(--accent-100)] flex items-center justify-center">
									<Wand2 className="h-5 w-5 text-[var(--accent-600)]" />
								</div>
								<div>
									<div className="text-sm font-medium text-[var(--foreground)]">
										AI Suggestion
									</div>
									<div className="text-xs text-[var(--foreground-muted)]">
										Improve clarity →
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

/**
 * Features grid section.
 */
function FeaturesSection() {
	const features = [
		{
			icon: Sparkles,
			title: "AI-Powered Writing",
			description:
				"Generate, improve, and refine content with intelligent slash commands. From summaries to full sections, AI does the heavy lifting.",
			color: "var(--accent-500)",
			bg: "var(--accent-100)",
		},
		{
			icon: Users,
			title: "Real-Time Collaboration",
			description:
				"Work together seamlessly with live cursors, presence indicators, and instant sync across all collaborators.",
			color: "var(--info-500)",
			bg: "var(--info-100)",
		},
		{
			icon: GitBranch,
			title: "Version Control",
			description:
				"Track every change with automatic versioning. Compare, restore, and branch documents like code.",
			color: "var(--success-500)",
			bg: "var(--success-100)",
		},
		{
			icon: Shield,
			title: "Compliance Intelligence",
			description:
				"Built-in compliance checking against industry standards. FAR/DFARS, SOC 2, and custom rules.",
			color: "var(--warning-500)",
			bg: "var(--warning-100)",
		},
		{
			icon: Layers,
			title: "Smart Templates",
			description:
				"Start from professionally designed templates with placeholders, AI instructions, and compliance markers.",
			color: "#7c3aed",
			bg: "#ede9fe",
		},
		{
			icon: Zap,
			title: "Lightning Fast",
			description:
				"Optimistic updates, local-first editing, and intelligent caching make every action feel instant.",
			color: "#ec4899",
			bg: "#fce7f3",
		},
	];

	return (
		<section id="features" className="py-24 bg-[var(--background-subtle)]">
			<div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
				{/* Section Header */}
				<div className="text-center max-w-2xl mx-auto mb-16">
					<p className="text-overline text-[var(--accent-600)] mb-4">
						Features
					</p>
					<h2 className="heading-display heading-display-md text-[var(--foreground)] mb-4">
						Everything you need to create exceptional documents
					</h2>
					<p className="text-[var(--foreground-muted)]">
						A complete platform for modern document workflows, from first draft
						to final delivery.
					</p>
				</div>

				{/* Features Grid */}
				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
					{features.map((feature, index) => (
						<div
							key={feature.title}
							className="group p-6 rounded-xl bg-[var(--background)] border border-[var(--border)] hover:shadow-[var(--shadow-lg)] hover:border-[var(--border-strong)] transition-all duration-[var(--transition-base)] animate-fade-up"
							style={{ animationDelay: `${index * 100}ms` }}
						>
							<div
								className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
								style={{ backgroundColor: feature.bg }}
							>
								<feature.icon
									className="h-6 w-6"
									style={{ color: feature.color }}
								/>
							</div>
							<h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
								{feature.title}
							</h3>
							<p className="text-sm text-[var(--foreground-muted)]">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/**
 * How it works section.
 */
function HowItWorksSection() {
	const steps = [
		{
			number: "01",
			title: "Start from a template or blank",
			description:
				"Choose from our library of professionally designed templates or start fresh with a blank document.",
		},
		{
			number: "02",
			title: "Write with AI assistance",
			description:
				"Use slash commands to generate content, improve writing, check compliance, and more.",
		},
		{
			number: "03",
			title: "Collaborate in real-time",
			description:
				"Invite team members, see their changes live, and work together seamlessly.",
		},
		{
			number: "04",
			title: "Review and deliver",
			description:
				"Run compliance checks, export in multiple formats, and track document performance.",
		},
	];

	return (
		<section id="how-it-works" className="py-24">
			<div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
				{/* Section Header */}
				<div className="text-center max-w-2xl mx-auto mb-16">
					<p className="text-overline text-[var(--accent-600)] mb-4">
						How It Works
					</p>
					<h2 className="heading-display heading-display-md text-[var(--foreground)] mb-4">
						From blank page to delivered document in minutes
					</h2>
				</div>

				{/* Steps */}
				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
					{steps.map((step, index) => (
						<div key={step.number} className="relative">
							{/* Connector line */}
							{index < steps.length - 1 && (
								<div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[var(--border)] to-transparent" />
							)}

							<div className="text-6xl font-bold text-[var(--accent-200)] mb-4">
								{step.number}
							</div>
							<h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
								{step.title}
							</h3>
							<p className="text-sm text-[var(--foreground-muted)]">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/**
 * Stats section.
 */
function StatsSection() {
	const stats = [
		{ value: "10x", label: "Faster document creation" },
		{ value: "85%", label: "Reduction in compliance errors" },
		{ value: "3hrs", label: "Saved per proposal on average" },
		{ value: "99.9%", label: "Uptime SLA" },
	];

	return (
		<section className="py-24 bg-[var(--ink-900)]">
			<div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
				<div className="grid md:grid-cols-4 gap-8">
					{stats.map((stat) => (
						<div key={stat.label} className="text-center">
							<div className="text-5xl font-bold text-[var(--accent-400)] mb-2">
								{stat.value}
							</div>
							<div className="text-[var(--ink-300)]">{stat.label}</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/**
 * CTA section.
 */
function CTASection() {
	return (
		<section className="py-24">
			<div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
				<div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] p-12 md:p-16">
					{/* Background decoration */}
					<div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
						<svg viewBox="0 0 400 400" className="w-full h-full">
							<circle cx="200" cy="200" r="150" fill="white" />
							<circle cx="300" cy="100" r="80" fill="white" />
						</svg>
					</div>

					<div className="relative max-w-2xl">
						<h2 className="heading-display heading-display-md text-white mb-4">
							Ready to transform your document workflow?
						</h2>
						<p className="text-lg text-white/80 mb-8">
							Join thousands of teams already creating better documents faster
							with DocFusion. Start free, no credit card required.
						</p>
						<div className="flex flex-col sm:flex-row gap-4">
							<Button
								size="lg"
								className="bg-white text-[var(--accent-700)] hover:bg-white/90"
								asChild
							>
								<Link href="/documents">
									Get Started Free
									<ArrowRight className="h-5 w-5" />
								</Link>
							</Button>
							<Button
								variant="outline"
								size="lg"
								className="border-white/30 text-white hover:bg-white/10"
							>
								Talk to Sales
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

/**
 * Footer.
 */
function Footer() {
	return (
		<footer className="py-12 border-t border-[var(--border)]">
			<div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
				<div className="flex flex-col md:flex-row items-center justify-between gap-6">
					{/* Logo */}
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center">
							<FileText className="h-4 w-4 text-white" />
						</div>
						<span className="font-semibold text-[var(--foreground)]">
							DocFusion
						</span>
					</div>

					{/* Links */}
					<div className="flex items-center gap-6 text-sm text-[var(--foreground-muted)]">
						<a href="#" className="hover:text-[var(--foreground)]">
							Privacy
						</a>
						<a href="#" className="hover:text-[var(--foreground)]">
							Terms
						</a>
						<a href="#" className="hover:text-[var(--foreground)]">
							Support
						</a>
						<a href="#" className="hover:text-[var(--foreground)]">
							Documentation
						</a>
					</div>

					{/* Copyright */}
					<div className="text-sm text-[var(--foreground-subtle)]">
						&copy; {new Date().getFullYear()} DocFusion. All rights reserved.
					</div>
				</div>
			</div>
		</footer>
	);
}
