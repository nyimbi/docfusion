/**
 * Home Page - DocFusion
 * "Ink & Paper" Editorial Elegance
 *
 * A sophisticated landing page that communicates premium quality
 * through warm paper tones, elegant typography, and refined interactions.
 */

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import {
	FileText,
	Sparkles,
	Users,
	Shield,
	Zap,
	ArrowRight,
	GitBranch,
	Layers,
	CheckCircle,
	Feather,
} from "lucide-react";

export default function HomePage() {
	return (
		<div className="min-h-screen bg-background bg-paper">
			{/* Navigation */}
			<nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
				<div className="max-w-6xl mx-auto px-6 py-4">
					<div className="flex items-center justify-between">
						<Link href="/" className="flex items-center gap-3 group">
							<div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-primary-sm transition-shadow group-hover:shadow-primary-md">
								<Feather className="h-5 w-5 text-primary-foreground" />
							</div>
							<span className="font-display font-semibold text-xl text-foreground tracking-tight">
								DocFusion
							</span>
						</Link>

						<div className="hidden md:flex items-center gap-8">
							<Link
								href="#features"
								className="text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Features
							</Link>
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
						</div>

						<div className="flex items-center gap-3">
							<Button variant="ghost" size="sm" asChild>
								<Link href="/auth/sign-in">Sign In</Link>
							</Button>
							<Button variant="primary" size="sm" asChild>
								<Link href="/documents" className="flex items-center gap-2">
									Get Started
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="relative pt-40 pb-32 px-6 overflow-hidden">
				{/* Background decoration */}
				<div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
				<div className="absolute bottom-0 right-1/4 w-64 h-64 bg-warning/5 rounded-full blur-3xl pointer-events-none" />

				<div className="relative max-w-4xl mx-auto">
					<div className="text-center">
						{/* Badge */}
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-up">
							<Sparkles className="h-4 w-4" />
							<span>AI-Powered Document Intelligence</span>
						</div>

						{/* Headline */}
						<h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-8 tracking-tight leading-[1.1] animate-fade-up"
							style={{ animationDelay: "100ms" }}
						>
							Transform Documents into{" "}
							<span className="text-primary relative">
								Strategic Assets
								<svg
									className="absolute -bottom-2 left-0 w-full h-3 text-primary/30"
									viewBox="0 0 200 12"
									preserveAspectRatio="none"
								>
									<path
										d="M0,8 Q50,0 100,8 T200,8"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
									/>
								</svg>
							</span>
						</h1>

						{/* Subheadline */}
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-up"
							style={{ animationDelay: "200ms" }}
						>
							Create, collaborate, and deliver exceptional RFP responses with
							AI-powered composition, real-time collaboration, and predictive
							compliance checking.
						</p>

						{/* CTAs */}
						<div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up"
							style={{ animationDelay: "300ms" }}
						>
							<Button variant="primary" size="lg" asChild className="shadow-primary-md hover:shadow-primary-lg">
								<Link href="/documents" className="flex items-center gap-2">
									Start Writing Free
									<ArrowRight className="h-5 w-5" />
								</Link>
							</Button>
							<Button variant="outline" size="lg" asChild>
								<Link href="/auth/sign-in">Sign In to Your Account</Link>
							</Button>
						</div>

						{/* Social proof */}
						<div className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground animate-fade-up"
							style={{ animationDelay: "400ms" }}
						>
							<div className="flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-success" />
								<span>No credit card required</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-success" />
								<span>Free tier available</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-success" />
								<span>SOC 2 compliant</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-32 bg-secondary/30">
				<div className="max-w-6xl mx-auto px-6">
					<div className="text-center max-w-2xl mx-auto mb-20">
						<p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
							Features
						</p>
						<h2 className="font-display text-4xl font-bold text-foreground mb-6">
							Everything you need to create exceptional documents
						</h2>
						<p className="text-lg text-muted-foreground">
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
									"Generate, improve, and refine content with intelligent slash commands and context-aware suggestions.",
							},
							{
								icon: Users,
								title: "Real-Time Collaboration",
								description:
									"Work together seamlessly with live cursors, instant sync, and presence indicators.",
							},
							{
								icon: GitBranch,
								title: "Version Control",
								description:
									"Track every change with automatic versioning. Compare versions and restore with confidence.",
							},
							{
								icon: Shield,
								title: "Compliance Intelligence",
								description:
									"Built-in compliance checking against FAR/DFARS and industry standards.",
							},
							{
								icon: Layers,
								title: "Smart Templates",
								description:
									"Start from professionally designed templates with embedded AI instructions.",
							},
							{
								icon: Zap,
								title: "Lightning Fast",
								description:
									"Optimistic updates and local-first editing make every action feel instant.",
							},
						].map((feature, index) => (
							<div
								key={feature.title}
								className="group p-8 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg hover:border-border-strong transition-all duration-300 animate-fade-up"
								style={{ animationDelay: `${index * 100}ms` }}
							>
								<div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
									<feature.icon className="h-7 w-7 text-primary" />
								</div>
								<h3 className="font-display text-xl font-semibold text-foreground mb-3">
									{feature.title}
								</h3>
								<p className="text-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-32">
				<div className="max-w-4xl mx-auto px-6">
					<div className="relative rounded-3xl bg-gradient-to-br from-primary to-primary-hover p-12 md:p-16 text-center overflow-hidden">
						{/* Background texture */}
						<div className="absolute inset-0 opacity-10">
							<svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
								<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
									<path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
								</pattern>
								<rect width="100" height="100" fill="url(#grid)" />
							</svg>
						</div>

						<div className="relative">
							<h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
								Ready to transform your document workflow?
							</h2>
							<p className="text-lg text-primary-foreground/85 mb-10 max-w-2xl mx-auto">
								Join teams already creating better RFP responses faster
								with DocFusion. Start free, no credit card required.
							</p>
							<Button
								size="lg"
								className="bg-white text-primary hover:bg-white/90 shadow-lg hover:shadow-xl"
								asChild
							>
								<Link href="/documents" className="flex items-center gap-2">
									Get Started Free
									<ArrowRight className="h-5 w-5" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-16 border-t border-border bg-secondary/20">
				<div className="max-w-6xl mx-auto px-6">
					<div className="flex flex-col md:flex-row items-center justify-between gap-8">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
								<Feather className="h-5 w-5 text-primary-foreground" />
							</div>
							<span className="font-display font-semibold text-lg text-foreground">
								DocFusion
							</span>
						</div>

						<div className="flex items-center gap-8 text-sm text-muted-foreground">
							<button
								onClick={() => toast.info("Privacy policy coming soon")}
								className="hover:text-foreground transition-colors"
							>
								Privacy
							</button>
							<button
								onClick={() => toast.info("Terms of service coming soon")}
								className="hover:text-foreground transition-colors"
							>
								Terms
							</button>
							<Link href="/help" className="hover:text-foreground transition-colors">
								Support
							</Link>
							<Link href="/help" className="hover:text-foreground transition-colors">
								Documentation
							</Link>
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
