/**
 * Help Page - DocFusion
 *
 * Documentation and support resources with full content.
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
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
	Mail,
	X,
} from "lucide-react";

// Help article content
const helpArticles: Record<string, { title: string; content: React.ReactNode }> = {
	"quick-start-guide": {
		title: "Quick Start Guide",
		content: (
			<div className="space-y-4">
				<p>Welcome to DocFusion! Here's how to get started in 5 minutes:</p>
				<ol className="list-decimal list-inside space-y-3">
					<li><strong>Create your first opportunity:</strong> Click "New Opportunity" from the dashboard and enter the RFP details.</li>
					<li><strong>Import requirements:</strong> Upload the RFP document or paste requirements directly.</li>
					<li><strong>Generate a proposal:</strong> Use AI to draft initial content based on your templates and past performance.</li>
					<li><strong>Collaborate:</strong> Invite team members to review and contribute sections.</li>
					<li><strong>Submit:</strong> Export your final document in PDF, DOCX, or compliance-ready formats.</li>
				</ol>
				<div className="mt-4 p-4 bg-muted rounded-lg">
					<p className="text-sm font-medium">Pro Tip:</p>
					<p className="text-sm text-muted-foreground">Use the Content Library to save reusable sections for faster proposals.</p>
				</div>
			</div>
		),
	},
	"creating-your-first-document": {
		title: "Creating Your First Document",
		content: (
			<div className="space-y-4">
				<p>Documents in DocFusion can be created from scratch or from templates:</p>
				<h4 className="font-semibold mt-4">From Template (Recommended)</h4>
				<ol className="list-decimal list-inside space-y-2 ml-2">
					<li>Navigate to Templates in the sidebar</li>
					<li>Browse or search for a suitable template</li>
					<li>Click "Use Template" and fill in the placeholders</li>
					<li>The document will be created with pre-filled structure</li>
				</ol>
				<h4 className="font-semibold mt-4">From Scratch</h4>
				<ol className="list-decimal list-inside space-y-2 ml-2">
					<li>Click "New Document" from the Documents page</li>
					<li>Choose "Blank Document" or paste content</li>
					<li>Use the editor toolbar to format your content</li>
					<li>Add sections using the outline panel</li>
				</ol>
			</div>
		),
	},
	"importing-opportunities": {
		title: "Importing Opportunities",
		content: (
			<div className="space-y-4">
				<p>DocFusion supports multiple import methods:</p>
				<h4 className="font-semibold mt-4">Excel/CSV Import</h4>
				<p>Upload a spreadsheet with columns for title, customer, deadline, value, and NAICS codes.</p>
				<h4 className="font-semibold mt-4">SAM.gov Integration</h4>
				<p>Search and import opportunities directly from SAM.gov using the opportunity number.</p>
				<h4 className="font-semibold mt-4">Manual Entry</h4>
				<p>Use the "New Opportunity" form for individual entries with full field customization.</p>
				<div className="mt-4 p-4 bg-muted rounded-lg">
					<p className="text-sm font-medium">Supported Fields:</p>
					<p className="text-sm text-muted-foreground">Title, Customer, Deadline, Contract Value, NAICS, Set-Asides, Requirements, and more.</p>
				</div>
			</div>
		),
	},
	"document-editor-basics": {
		title: "Document Editor Basics",
		content: (
			<div className="space-y-4">
				<p>The DocFusion editor provides a rich writing experience:</p>
				<h4 className="font-semibold mt-4">Formatting</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>Bold (⌘B), Italic (⌘I), Underline (⌘U)</li>
					<li>Headings (⌘1-6), Lists, Tables</li>
					<li>Block quotes, code blocks, horizontal rules</li>
				</ul>
				<h4 className="font-semibold mt-4">AI Features</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>AI Generate: Create content from prompts</li>
					<li>AI Improve: Enhance existing text</li>
					<li>AI Summarize: Condense long sections</li>
				</ul>
				<h4 className="font-semibold mt-4">Collaboration</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>Real-time co-editing with team members</li>
					<li>Comments and suggestions</li>
					<li>Version history and rollback</li>
				</ul>
			</div>
		),
	},
	"using-ai-assistance": {
		title: "Using AI Assistance",
		content: (
			<div className="space-y-4">
				<p>DocFusion's AI helps you write better proposals faster:</p>
				<h4 className="font-semibold mt-4">AI Generation</h4>
				<p>Select text or place cursor, press ⌘J, and describe what you want to write.</p>
				<h4 className="font-semibold mt-4">Content Improvement</h4>
				<p>Highlight text and choose "Improve" to enhance clarity, tone, or compliance.</p>
				<h4 className="font-semibold mt-4">Compliance Scoring</h4>
				<p>AI analyzes your content against RFP requirements and suggests improvements.</p>
				<div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
					<p className="text-sm font-medium text-amber-600 dark:text-amber-400">Important:</p>
					<p className="text-sm text-muted-foreground">Always review AI-generated content for accuracy and compliance.</p>
				</div>
			</div>
		),
	},
	"collaboration-features": {
		title: "Collaboration Features",
		content: (
			<div className="space-y-4">
				<p>Work together effectively with your team:</p>
				<h4 className="font-semibold mt-4">Real-time Editing</h4>
				<p>Multiple users can edit the same document simultaneously with live cursor presence.</p>
				<h4 className="font-semibold mt-4">Comments & Reviews</h4>
				<p>Add inline comments, mention team members, and track review status.</p>
				<h4 className="font-semibold mt-4">Task Assignment</h4>
				<p>Assign document sections to team members with deadlines.</p>
				<h4 className="font-semibold mt-4">Activity Feed</h4>
				<p>Track all changes, comments, and contributions in the activity panel.</p>
			</div>
		),
	},
	"importing-from-spreadsheets": {
		title: "Importing from Spreadsheets",
		content: (
			<div className="space-y-4">
				<p>Import opportunities from CSV or TSV files:</p>
				<ol className="list-decimal list-inside space-y-2">
					<li>Go to Opportunities → Import</li>
					<li>Upload your CSV or TSV file</li>
					<li>Map columns to DocFusion fields</li>
					<li>Preview and validate the data</li>
					<li>Click Import to create opportunities</li>
				</ol>
				<h4 className="font-semibold mt-4">Required Columns</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>Title (required)</li>
					<li>Customer Name</li>
					<li>Due Date (ISO format or MM/DD/YYYY)</li>
				</ul>
				<h4 className="font-semibold mt-4">Optional Columns</h4>
				<p className="text-sm text-muted-foreground">Contract Value, NAICS Code, Set-Aside Type, Description, Source URL</p>
			</div>
		),
	},
	"go-no-go-decisions": {
		title: "Go/No-Go Decisions",
		content: (
			<div className="space-y-4">
				<p>Make informed bid decisions with structured evaluation:</p>
				<h4 className="font-semibold mt-4">Evaluation Criteria</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>Strategic fit with company goals</li>
					<li>Technical capability match</li>
					<li>Resource availability</li>
					<li>Past performance relevance</li>
					<li>Competitive positioning</li>
					<li>Profitability potential</li>
				</ul>
				<h4 className="font-semibold mt-4">Win Probability</h4>
				<p>AI analyzes historical data to estimate win probability based on similar opportunities.</p>
			</div>
		),
	},
	"requirements-tracking": {
		title: "Requirements Tracking",
		content: (
			<div className="space-y-4">
				<p>Track and manage RFP requirements effectively:</p>
				<h4 className="font-semibold mt-4">Requirements Matrix</h4>
				<p>Automatically extract requirements from RFP documents and track compliance.</p>
				<h4 className="font-semibold mt-4">Compliance Status</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>✅ Compliant - Requirement fully addressed</li>
					<li>⚠️ Partial - Needs additional content</li>
					<li>❌ Non-compliant - Missing response</li>
				</ul>
				<h4 className="font-semibold mt-4">Traceability</h4>
				<p>Link proposal sections directly to requirements for audit trails.</p>
			</div>
		),
	},
	"inviting-team-members": {
		title: "Inviting Team Members",
		content: (
			<div className="space-y-4">
				<p>Add collaborators to your organization:</p>
				<ol className="list-decimal list-inside space-y-2">
					<li>Go to Settings → Team</li>
					<li>Click "Invite Member"</li>
					<li>Enter their email address</li>
					<li>Select their role (Admin, Editor, Viewer)</li>
					<li>They'll receive an invitation email</li>
				</ol>
				<h4 className="font-semibold mt-4">Roles</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li><strong>Admin:</strong> Full access, manage team and billing</li>
					<li><strong>Editor:</strong> Create and edit documents</li>
					<li><strong>Viewer:</strong> Read-only access</li>
				</ul>
			</div>
		),
	},
	"partner-management": {
		title: "Partner Management",
		content: (
			<div className="space-y-4">
				<p>Collaborate with external partners on proposals:</p>
				<h4 className="font-semibold mt-4">Adding Partners</h4>
				<p>Go to CRM → Partners to add teaming partners with their capabilities and past performance.</p>
				<h4 className="font-semibold mt-4">Partner Roles</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>Prime Contractor</li>
					<li>Subcontractor</li>
					<li>Teaming Partner</li>
					<li>Consultant</li>
				</ul>
				<h4 className="font-semibold mt-4">Secure Sharing</h4>
				<p>Share specific documents or sections with partners while protecting sensitive information.</p>
			</div>
		),
	},
	"permission-levels": {
		title: "Permission Levels",
		content: (
			<div className="space-y-4">
				<p>Control access at multiple levels:</p>
				<h4 className="font-semibold mt-4">Organization Level</h4>
				<p>Set default permissions for all organization members.</p>
				<h4 className="font-semibold mt-4">Document Level</h4>
				<p>Override permissions for specific documents (Public, Team, Private).</p>
				<h4 className="font-semibold mt-4">Section Level</h4>
				<p>Lock sensitive sections to specific users or roles.</p>
			</div>
		),
	},
	"data-encryption": {
		title: "Data Encryption",
		content: (
			<div className="space-y-4">
				<p>Your data is protected with enterprise-grade encryption:</p>
				<h4 className="font-semibold mt-4">In Transit</h4>
				<p>All data is encrypted using TLS 1.3 during transmission.</p>
				<h4 className="font-semibold mt-4">At Rest</h4>
				<p>Documents and data are encrypted using AES-256 encryption.</p>
				<h4 className="font-semibold mt-4">Key Management</h4>
				<p>Encryption keys are managed using industry-standard key management systems.</p>
			</div>
		),
	},
	"access-controls": {
		title: "Access Controls",
		content: (
			<div className="space-y-4">
				<p>Comprehensive access control features:</p>
				<ul className="list-disc list-inside space-y-2">
					<li>Role-based access control (RBAC)</li>
					<li>Single Sign-On (SSO) integration</li>
					<li>Multi-factor authentication (MFA)</li>
					<li>IP allowlisting</li>
					<li>Session management</li>
					<li>Audit logging</li>
				</ul>
			</div>
		),
	},
	"compliance-features": {
		title: "Compliance Features",
		content: (
			<div className="space-y-4">
				<p>Meet regulatory and contractual requirements:</p>
				<h4 className="font-semibold mt-4">Supported Frameworks</h4>
				<ul className="list-disc list-inside space-y-1 ml-2">
					<li>FAR/DFARS compliance</li>
					<li>CMMC readiness</li>
					<li>SOC 2 Type II certified infrastructure</li>
					<li>GDPR compliant data handling</li>
				</ul>
				<h4 className="font-semibold mt-4">Audit Trail</h4>
				<p>Complete history of all document changes, access, and exports.</p>
			</div>
		),
	},
	"editor-shortcuts": {
		title: "Editor Shortcuts",
		content: (
			<div className="space-y-4">
				<p>Speed up your editing with keyboard shortcuts:</p>
				<table className="w-full text-sm">
					<tbody className="divide-y">
						<tr><td className="py-2 font-mono">⌘ + B</td><td className="py-2">Bold</td></tr>
						<tr><td className="py-2 font-mono">⌘ + I</td><td className="py-2">Italic</td></tr>
						<tr><td className="py-2 font-mono">⌘ + U</td><td className="py-2">Underline</td></tr>
						<tr><td className="py-2 font-mono">⌘ + K</td><td className="py-2">Insert link</td></tr>
						<tr><td className="py-2 font-mono">⌘ + Z</td><td className="py-2">Undo</td></tr>
						<tr><td className="py-2 font-mono">⌘ + Shift + Z</td><td className="py-2">Redo</td></tr>
						<tr><td className="py-2 font-mono">⌘ + J</td><td className="py-2">AI Generate</td></tr>
						<tr><td className="py-2 font-mono">⌘ + S</td><td className="py-2">Save</td></tr>
					</tbody>
				</table>
			</div>
		),
	},
	"navigation-shortcuts": {
		title: "Navigation Shortcuts",
		content: (
			<div className="space-y-4">
				<p>Navigate DocFusion quickly:</p>
				<table className="w-full text-sm">
					<tbody className="divide-y">
						<tr><td className="py-2 font-mono">⌘ + /</td><td className="py-2">Command palette</td></tr>
						<tr><td className="py-2 font-mono">⌘ + P</td><td className="py-2">Quick open document</td></tr>
						<tr><td className="py-2 font-mono">⌘ + \\</td><td className="py-2">Toggle sidebar</td></tr>
						<tr><td className="py-2 font-mono">⌘ + 1-9</td><td className="py-2">Switch tabs</td></tr>
						<tr><td className="py-2 font-mono">Esc</td><td className="py-2">Close dialogs</td></tr>
					</tbody>
				</table>
			</div>
		),
	},
	"custom-keybindings": {
		title: "Custom Keybindings",
		content: (
			<div className="space-y-4">
				<p>Customize keyboard shortcuts to match your workflow:</p>
				<ol className="list-decimal list-inside space-y-2">
					<li>Go to Settings → Keyboard Shortcuts</li>
					<li>Search for the command you want to customize</li>
					<li>Click the current shortcut to edit</li>
					<li>Press your desired key combination</li>
					<li>Click Save</li>
				</ol>
				<div className="mt-4 p-4 bg-muted rounded-lg">
					<p className="text-sm font-medium">Note:</p>
					<p className="text-sm text-muted-foreground">Some system shortcuts cannot be overridden.</p>
				</div>
			</div>
		),
	},
};

const helpCategories = [
	{
		icon: BookOpen,
		title: "Getting Started",
		description: "Learn the basics of DocFusion",
		articles: [
			{ id: "quick-start-guide", title: "Quick start guide" },
			{ id: "creating-your-first-document", title: "Creating your first document" },
			{ id: "importing-opportunities", title: "Importing opportunities" },
		],
	},
	{
		icon: FileText,
		title: "Documents",
		description: "Working with proposals and templates",
		articles: [
			{ id: "document-editor-basics", title: "Document editor basics" },
			{ id: "using-ai-assistance", title: "Using AI assistance" },
			{ id: "collaboration-features", title: "Collaboration features" },
		],
	},
	{
		icon: Zap,
		title: "Opportunities",
		description: "Managing RFPs and bids",
		articles: [
			{ id: "importing-from-spreadsheets", title: "Importing from spreadsheets" },
			{ id: "go-no-go-decisions", title: "Go/No-Go decisions" },
			{ id: "requirements-tracking", title: "Requirements tracking" },
		],
	},
	{
		icon: Users,
		title: "Team & Partners",
		description: "Collaboration and access control",
		articles: [
			{ id: "inviting-team-members", title: "Inviting team members" },
			{ id: "partner-management", title: "Partner management" },
			{ id: "permission-levels", title: "Permission levels" },
		],
	},
	{
		icon: Shield,
		title: "Security & Privacy",
		description: "Protecting your data",
		articles: [
			{ id: "data-encryption", title: "Data encryption" },
			{ id: "access-controls", title: "Access controls" },
			{ id: "compliance-features", title: "Compliance features" },
		],
	},
	{
		icon: Keyboard,
		title: "Keyboard Shortcuts",
		description: "Work faster with shortcuts",
		articles: [
			{ id: "editor-shortcuts", title: "Editor shortcuts" },
			{ id: "navigation-shortcuts", title: "Navigation shortcuts" },
			{ id: "custom-keybindings", title: "Custom keybindings" },
		],
	},
];

export default function HelpPage() {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [selectedArticle, setSelectedArticle] = React.useState<string | null>(null);
	const [showContactForm, setShowContactForm] = React.useState(false);
	const [contactForm, setContactForm] = React.useState({ subject: "", message: "" });

	const handleOpenArticle = (articleId: string) => {
		setSelectedArticle(articleId);
	};

	const handleContactSubmit = () => {
		if (!contactForm.subject || !contactForm.message) {
			toast.error("Please fill in all fields");
			return;
		}
		// In production, this would send to a support system
		toast.success("Support request submitted", {
			description: "We'll respond within 24 hours",
		});
		setShowContactForm(false);
		setContactForm({ subject: "", message: "" });
	};

	// Filter articles based on search
	const filteredCategories = React.useMemo(() => {
		if (!searchQuery) return helpCategories;
		const query = searchQuery.toLowerCase();
		return helpCategories
			.map((category) => ({
				...category,
				articles: category.articles.filter((article) =>
					article.title.toLowerCase().includes(query) ||
					helpArticles[article.id]?.title.toLowerCase().includes(query)
				),
			}))
			.filter((category) => category.articles.length > 0);
	}, [searchQuery]);

	const currentArticle = selectedArticle ? helpArticles[selectedArticle] : null;

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="relative max-w-4xl mx-auto">
				{/* Page Header */}
				<div className="text-center mb-8">
					<h1 className="text-2xl font-bold text-foreground mb-2">
						How can we help?
					</h1>
					<p className="text-sm text-muted-foreground">
						Search our knowledge base or browse topics below
					</p>
				</div>

				{/* Search */}
				<div className="relative mb-8">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search for help articles..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className={cn(
							"w-full h-12 pl-12 pr-4 rounded-xl",
							"bg-background border border-input",
							"text-foreground placeholder:text-muted-foreground text-base",
							"focus:outline-none focus:ring-2 focus:ring-ring focus:border-input",
							"transition-all duration-200"
						)}
					/>
				</div>

				{/* Quick Links */}
				<div className="flex items-center justify-center gap-4 mb-8">
					<a
						href="https://www.youtube.com/@docfusion"
						target="_blank"
						rel="noopener noreferrer"
						className={cn(
							"flex items-center gap-2 px-4 py-2 rounded-xl",
							"bg-muted/50 text-muted-foreground",
							"hover:bg-muted hover:text-foreground",
							"transition-all duration-200"
						)}
					>
						<Video className="w-4 h-4" />
						<span className="text-sm font-medium">Video Tutorials</span>
						<ExternalLink className="w-3 h-3" />
					</a>
					<button
						onClick={() => setShowContactForm(true)}
						className={cn(
							"flex items-center gap-2 px-4 py-2 rounded-xl",
							"bg-muted/50 text-muted-foreground",
							"hover:bg-muted hover:text-foreground",
							"transition-all duration-200"
						)}
					>
						<MessageCircle className="w-4 h-4" />
						<span className="text-sm font-medium">Contact Support</span>
					</button>
					<a
						href="https://docs.docfusion.io/api"
						target="_blank"
						rel="noopener noreferrer"
						className={cn(
							"flex items-center gap-2 px-4 py-2 rounded-xl",
							"bg-muted/50 text-muted-foreground",
							"hover:bg-muted hover:text-foreground",
							"transition-all duration-200"
						)}
					>
						<ExternalLink className="w-4 h-4" />
						<span className="text-sm font-medium">API Documentation</span>
					</a>
				</div>

				{/* Help Categories */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{filteredCategories.map((category, index) => (
						<div
							key={category.title}
							className={cn(
								"group p-5 rounded-2xl",
								"bg-card",
								"border border-border shadow-sm hover:shadow-md",
								"transition-all duration-300 ease-out",
								"animate-fade-up"
							)}
							style={{
								animationDelay: `${index * 50}ms`,
								animationFillMode: "forwards",
							}}
						>
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
									<category.icon className="h-5 w-5 text-primary" />
								</div>
								<div className="flex-1 min-w-0">
									<h3 className="text-foreground font-semibold text-base mb-1 group-hover:text-primary transition-colors">
										{category.title}
									</h3>
									<p className="text-sm text-muted-foreground mb-3">
										{category.description}
									</p>
									<ul className="space-y-1">
										{category.articles.map((article) => (
											<li key={article.id}>
												<button
													onClick={() => handleOpenArticle(article.id)}
													className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left w-full"
												>
													<ChevronRight className="w-3 h-3" />
													{article.title}
												</button>
											</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					))}
				</div>

				{filteredCategories.length === 0 && (
					<div className="text-center py-12">
						<p className="text-muted-foreground">No articles found for "{searchQuery}"</p>
						<Button variant="ghost" onClick={() => setSearchQuery("")} className="mt-2">
							Clear search
						</Button>
					</div>
				)}

				{/* Contact Support */}
				<div className="mt-8 p-6 rounded-2xl border border-border bg-card text-center">
					<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
						<MessageCircle className="h-6 w-6 text-primary" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						Still need help?
					</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Our support team is here to assist you with any questions.
					</p>
					<Button onClick={() => setShowContactForm(true)}>
						Contact Support
					</Button>
				</div>
			</div>

			{/* Article Dialog */}
			<Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{currentArticle?.title}</DialogTitle>
					</DialogHeader>
					<div className="mt-4">
						{currentArticle?.content}
					</div>
				</DialogContent>
			</Dialog>

			{/* Contact Support Dialog */}
			<Dialog open={showContactForm} onOpenChange={setShowContactForm}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Mail className="h-5 w-5" />
							Contact Support
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 mt-4">
						<div>
							<span className="text-sm font-medium mb-1.5 block">Subject</span>
							<input
								type="text"
								placeholder="Brief description of your issue"
								value={contactForm.subject}
								onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
								className={cn(
									"w-full h-10 px-3 rounded-lg",
									"bg-background border border-input",
									"text-foreground placeholder:text-muted-foreground",
									"focus:outline-none focus:ring-2 focus:ring-ring"
								)}
							 aria-label="Subject"/>
						</div>
						<div>
							<span className="text-sm font-medium mb-1.5 block">Message</span>
							<textarea
								placeholder="Describe your issue in detail..."
								value={contactForm.message}
								onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
								rows={5}
								className={cn(
									"w-full px-3 py-2 rounded-lg resize-none",
									"bg-background border border-input",
									"text-foreground placeholder:text-muted-foreground",
									"focus:outline-none focus:ring-2 focus:ring-ring"
								)}
							 aria-label="Message"/>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<Button variant="outline" onClick={() => setShowContactForm(false)}>
								Cancel
							</Button>
							<Button onClick={handleContactSubmit}>
								Send Message
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
