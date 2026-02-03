/**
 * Privacy Policy Page - DocFusion
 *
 * Legal privacy policy for the platform.
 */

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Shield, Lock, Eye, Database, Globe, Mail } from "lucide-react";

export const metadata = {
	title: "Privacy Policy - DocFusion",
	description: "DocFusion privacy policy and data handling practices",
};

export default function PrivacyPage() {
	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
				<div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
					<Link href="/">
						<Button variant="ghost" size="sm">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back
						</Button>
					</Link>
					<div className="flex items-center gap-2">
						<Shield className="h-5 w-5 text-primary" />
						<h1 className="font-semibold">Privacy Policy</h1>
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="max-w-4xl mx-auto px-6 py-12">
				<div className="prose prose-neutral dark:prose-invert max-w-none">
					<p className="text-muted-foreground text-sm">
						Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
					</p>

					<h2 className="flex items-center gap-2 mt-8">
						<Database className="h-5 w-5 text-primary" />
						Information We Collect
					</h2>
					<p>
						DocFusion collects information necessary to provide our document intelligence and RFP response automation services:
					</p>
					<ul>
						<li><strong>Account Information:</strong> Name, email address, organization name, and role when you create an account.</li>
						<li><strong>Document Data:</strong> Documents, proposals, and RFP responses you create or upload to our platform.</li>
						<li><strong>Usage Data:</strong> How you interact with our services, including features used and time spent.</li>
						<li><strong>Technical Data:</strong> Browser type, device information, and IP address for security and performance.</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<Eye className="h-5 w-5 text-primary" />
						How We Use Your Information
					</h2>
					<p>We use collected information to:</p>
					<ul>
						<li>Provide and improve our document intelligence services</li>
						<li>Generate AI-powered content suggestions and compliance scoring</li>
						<li>Enable collaboration features between team members</li>
						<li>Send service updates and security notifications</li>
						<li>Analyze usage patterns to improve our platform</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<Lock className="h-5 w-5 text-primary" />
						Data Security
					</h2>
					<p>
						We implement enterprise-grade security measures to protect your data:
					</p>
					<ul>
						<li>End-to-end encryption for all document transfers</li>
						<li>AES-256 encryption for data at rest</li>
						<li>SOC 2 Type II compliant infrastructure</li>
						<li>Regular security audits and penetration testing</li>
						<li>Role-based access controls and audit logging</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<Globe className="h-5 w-5 text-primary" />
						Data Sharing
					</h2>
					<p>
						We do not sell your personal information. We may share data with:
					</p>
					<ul>
						<li><strong>Service Providers:</strong> Cloud hosting, AI processing, and analytics partners under strict data processing agreements.</li>
						<li><strong>Your Organization:</strong> Administrators in your organization may access usage data and documents per your organization's policies.</li>
						<li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						Your Rights
					</h2>
					<p>You have the right to:</p>
					<ul>
						<li>Access and export your data at any time</li>
						<li>Request correction of inaccurate information</li>
						<li>Delete your account and associated data</li>
						<li>Opt out of non-essential communications</li>
						<li>Lodge a complaint with a supervisory authority</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<Mail className="h-5 w-5 text-primary" />
						Contact Us
					</h2>
					<p>
						For privacy-related inquiries or to exercise your rights, contact our Data Protection Officer:
					</p>
					<ul>
						<li>Email: privacy@docfusion.io</li>
						<li>Address: DocFusion Inc., 123 Innovation Way, San Francisco, CA 94105</li>
					</ul>

					<h2 className="mt-8">Changes to This Policy</h2>
					<p>
						We may update this privacy policy periodically. We will notify you of significant changes via email or through our platform.
						Continued use of DocFusion after changes constitutes acceptance of the updated policy.
					</p>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t py-8 mt-12">
				<div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
					<span>© {new Date().getFullYear()} DocFusion. All rights reserved.</span>
					<div className="flex gap-6">
						<Link href="/terms" className="hover:text-foreground transition-colors">
							Terms of Service
						</Link>
						<Link href="/help" className="hover:text-foreground transition-colors">
							Help Center
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
