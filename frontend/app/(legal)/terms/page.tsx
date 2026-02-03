/**
 * Terms of Service Page - DocFusion
 *
 * Legal terms and conditions for using the platform.
 */

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, FileText, Scale, AlertTriangle, CheckCircle, XCircle, Globe } from "lucide-react";

export const metadata = {
	title: "Terms of Service - DocFusion",
	description: "DocFusion terms of service and usage conditions",
};

export default function TermsPage() {
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
						<Scale className="h-5 w-5 text-primary" />
						<h1 className="font-semibold">Terms of Service</h1>
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
						<FileText className="h-5 w-5 text-primary" />
						Agreement to Terms
					</h2>
					<p>
						By accessing or using DocFusion ("Service"), you agree to be bound by these Terms of Service ("Terms").
						If you disagree with any part of these terms, you may not access the Service.
					</p>

					<h2 className="flex items-center gap-2 mt-8">
						<CheckCircle className="h-5 w-5 text-primary" />
						Permitted Use
					</h2>
					<p>DocFusion grants you a limited, non-exclusive license to:</p>
					<ul>
						<li>Access and use the Service for your internal business purposes</li>
						<li>Create, edit, and manage documents and proposals</li>
						<li>Collaborate with authorized team members and partners</li>
						<li>Use AI-powered features for content generation and compliance scoring</li>
						<li>Export your content in supported formats</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<XCircle className="h-5 w-5 text-destructive" />
						Prohibited Activities
					</h2>
					<p>You agree not to:</p>
					<ul>
						<li>Use the Service for any unlawful purpose or in violation of any regulations</li>
						<li>Attempt to gain unauthorized access to any part of the Service</li>
						<li>Interfere with or disrupt the Service or servers</li>
						<li>Reverse engineer, decompile, or disassemble any part of the Service</li>
						<li>Use the Service to transmit malware, spam, or harmful content</li>
						<li>Resell or redistribute the Service without authorization</li>
						<li>Use automated systems to access the Service beyond normal usage</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						Intellectual Property
					</h2>
					<p>
						<strong>Your Content:</strong> You retain all rights to content you create or upload. By using DocFusion,
						you grant us a limited license to process and store your content solely to provide the Service.
					</p>
					<p>
						<strong>Our Service:</strong> DocFusion, including its design, features, and code, is protected by
						intellectual property laws. You may not copy, modify, or create derivative works without permission.
					</p>

					<h2 className="flex items-center gap-2 mt-8">
						AI-Generated Content
					</h2>
					<p>
						DocFusion uses artificial intelligence to assist with content generation. You acknowledge that:
					</p>
					<ul>
						<li>AI suggestions are provided as assistance and should be reviewed before use</li>
						<li>You are responsible for verifying accuracy and compliance of all content</li>
						<li>AI-generated content may not be used for purposes that violate applicable laws</li>
						<li>We do not guarantee the accuracy, completeness, or suitability of AI suggestions</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						Subscription and Payment
					</h2>
					<p>
						Paid features require a valid subscription. By subscribing, you agree to:
					</p>
					<ul>
						<li>Pay all fees associated with your chosen plan</li>
						<li>Provide accurate billing information</li>
						<li>Automatic renewal unless cancelled before the renewal date</li>
						<li>No refunds for partial subscription periods, except as required by law</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
						Limitation of Liability
					</h2>
					<p>
						To the maximum extent permitted by law:
					</p>
					<ul>
						<li>The Service is provided "as is" without warranties of any kind</li>
						<li>We are not liable for indirect, incidental, or consequential damages</li>
						<li>Our total liability is limited to amounts paid by you in the preceding 12 months</li>
						<li>We are not responsible for third-party services or content</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						Termination
					</h2>
					<p>
						We may suspend or terminate your access if you violate these Terms. Upon termination:
					</p>
					<ul>
						<li>Your right to use the Service immediately ceases</li>
						<li>You may export your data within 30 days</li>
						<li>We may delete your data after the export period</li>
						<li>Provisions that should survive termination will remain in effect</li>
					</ul>

					<h2 className="flex items-center gap-2 mt-8">
						<Globe className="h-5 w-5 text-primary" />
						Governing Law
					</h2>
					<p>
						These Terms are governed by the laws of the State of California, USA. Any disputes shall be resolved
						in the courts of San Francisco County, California.
					</p>

					<h2 className="mt-8">Changes to Terms</h2>
					<p>
						We reserve the right to modify these Terms at any time. Material changes will be notified via email
						or through the Service. Continued use after changes constitutes acceptance.
					</p>

					<h2 className="mt-8">Contact</h2>
					<p>
						For questions about these Terms, contact us at:
					</p>
					<ul>
						<li>Email: legal@docfusion.io</li>
						<li>Address: DocFusion Inc., 123 Innovation Way, San Francisco, CA 94105</li>
					</ul>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t py-8 mt-12">
				<div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
					<span>© {new Date().getFullYear()} DocFusion. All rights reserved.</span>
					<div className="flex gap-6">
						<Link href="/privacy" className="hover:text-foreground transition-colors">
							Privacy Policy
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
