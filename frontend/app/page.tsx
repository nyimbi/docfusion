/**
 * Home Page - DocFusion
 *
 * Landing page for the DocFusion document intelligence platform.
 */

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
	FileText,
	Sparkles,
	Users,
	Shield,
	Zap,
	ArrowRight,
	GitBranch,
	Layers,
} from "lucide-react";

export default function HomePage() {
	return (
		<div className="min-h-screen bg-background">
			{/* Navigation */}
			<nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
				<div className="max-w-7xl mx-auto px-6 py-4">
					<div className="flex items-center justify-between">
						<Link href="/" className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
								<FileText className="h-4 w-4 text-primary-foreground" />
							</div>
							<span className="font-semibold text-foreground">DocFusion</span>
						</Link>

						<div className="hidden md:flex items-center gap-8">
							<Link
								href="/documents"
								className="text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Documents
							</Link>
							<Link
								href="/opportunities"
								className="text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Opportunities
							</Link>
							<a
								href="#features"
								className="text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Features
							</a>
						</div>

						<div className="flex items-center gap-3">
							<Button variant="ghost" size="sm" asChild>
								<Link href="/auth/sign-in">Sign In</Link>
							</Button>
							<Button variant="primary" size="sm" asChild>
								<Link href="/documents">
									Get Started
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="pt-32 pb-24 px-6">
				<div className="max-w-7xl mx-auto">
					<div className="text-center max-w-3xl mx-auto">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
							<Sparkles className="h-4 w-4" />
							<span>AI-Powered Document Intelligence</span>
						</div>

						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
							Transform Documents into
							<span className="text-primary"> Strategic Assets</span>
						</h1>

						<p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
							Create, collaborate, and deliver exceptional documents with
							AI-powered composition, real-time collaboration, and predictive
							compliance checking.
						</p>

						<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
							<Button variant="primary" size="lg" asChild>
								<Link href="/documents">
									Start Writing Free
									<ArrowRight className="h-5 w-5" />
								</Link>
							</Button>
							<Button variant="outline" size="lg" asChild>
								<Link href="/auth/sign-in">Sign In</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-24 bg-muted/30">
				<div className="max-w-7xl mx-auto px-6">
					<div className="text-center max-w-2xl mx-auto mb-16">
						<p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
							Features
						</p>
						<h2 className="text-3xl font-bold text-foreground mb-4">
							Everything you need to create exceptional documents
						</h2>
						<p className="text-muted-foreground">
							A complete platform for modern document workflows, from first draft
							to final delivery.
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						{[
							{
								icon: Sparkles,
								title: "AI-Powered Writing",
								description:
									"Generate, improve, and refine content with intelligent slash commands.",
							},
							{
								icon: Users,
								title: "Real-Time Collaboration",
								description:
									"Work together seamlessly with live cursors and instant sync.",
							},
							{
								icon: GitBranch,
								title: "Version Control",
								description:
									"Track every change with automatic versioning. Compare and restore.",
							},
							{
								icon: Shield,
								title: "Compliance Intelligence",
								description:
									"Built-in compliance checking against industry standards.",
							},
							{
								icon: Layers,
								title: "Smart Templates",
								description:
									"Start from professionally designed templates with AI instructions.",
							},
							{
								icon: Zap,
								title: "Lightning Fast",
								description:
									"Optimistic updates and local-first editing make every action instant.",
							},
						].map((feature) => (
							<div
								key={feature.title}
								className="p-6 rounded-xl bg-card border border-border hover:shadow-md transition-shadow"
							>
								<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
									<feature.icon className="h-6 w-6 text-primary" />
								</div>
								<h3 className="text-lg font-semibold text-foreground mb-2">
									{feature.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24">
				<div className="max-w-7xl mx-auto px-6">
					<div className="rounded-2xl bg-primary p-12 md:p-16 text-center">
						<h2 className="text-3xl font-bold text-primary-foreground mb-4">
							Ready to transform your document workflow?
						</h2>
						<p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
							Join thousands of teams already creating better documents faster
							with DocFusion. Start free, no credit card required.
						</p>
						<Button
							size="lg"
							className="bg-background text-foreground hover:bg-background/90"
							asChild
						>
							<Link href="/documents">
								Get Started Free
								<ArrowRight className="h-5 w-5" />
							</Link>
						</Button>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 border-t border-border">
				<div className="max-w-7xl mx-auto px-6">
					<div className="flex flex-col md:flex-row items-center justify-between gap-6">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
								<FileText className="h-4 w-4 text-primary-foreground" />
							</div>
							<span className="font-semibold text-foreground">DocFusion</span>
						</div>

						<div className="flex items-center gap-6 text-sm text-muted-foreground">
							<a href="#" className="hover:text-foreground transition-colors">
								Privacy
							</a>
							<a href="#" className="hover:text-foreground transition-colors">
								Terms
							</a>
							<a href="#" className="hover:text-foreground transition-colors">
								Support
							</a>
						</div>

						<div className="text-sm text-muted-foreground">
							© {new Date().getFullYear()} DocFusion. All rights reserved.
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
