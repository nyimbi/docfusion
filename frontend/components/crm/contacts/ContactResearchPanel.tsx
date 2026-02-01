"use client";

/**
 * Contact Research Panel
 *
 * Component for researching and enriching contact data using web search.
 * Searches LinkedIn, publications, news mentions, and career history.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	SheetFooter,
} from "@/components/ui/sheet";
import {
	Search,
	Linkedin,
	Twitter,
	Newspaper,
	BookOpen,
	Briefcase,
	Info,
	Loader2,
	ExternalLink,
	CheckCircle,
	Save,
} from "lucide-react";
import {
	researchContact,
	saveContactResearch,
	type ContactResearchCategory,
	type ContactResearchResult,
} from "@/lib/actions/crm/contact-research";
import type { ContactRow } from "@/lib/db/schema-crm";
import type { UserContext } from "@/lib/actions/crm/contacts";

// ============================================================================
// Types
// ============================================================================

interface ContactResearchPanelProps {
	contact: ContactRow;
	userContext: UserContext;
	onResearchComplete?: () => void;
}

interface CategoryConfig {
	id: ContactResearchCategory;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	description: string;
}

// ============================================================================
// Category Configuration
// ============================================================================

const RESEARCH_CATEGORIES: CategoryConfig[] = [
	{ id: "linkedin", label: "LinkedIn", icon: Linkedin, description: "Find LinkedIn profile" },
	{ id: "twitter", label: "Twitter/X", icon: Twitter, description: "Find Twitter profile" },
	{ id: "publications", label: "Publications", icon: BookOpen, description: "Articles and papers" },
	{ id: "news", label: "News", icon: Newspaper, description: "News mentions" },
	{ id: "career", label: "Career", icon: Briefcase, description: "Career history" },
	{ id: "general", label: "General", icon: Info, description: "General information" },
];

// ============================================================================
// Component
// ============================================================================

export function ContactResearchPanel({
	contact,
	userContext,
	onResearchComplete,
}: ContactResearchPanelProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [selectedCategories, setSelectedCategories] = useState<ContactResearchCategory[]>([
		"linkedin",
		"career",
		"general",
	]);
	const [results, setResults] = useState<ContactResearchResult[]>([]);
	const [summary, setSummary] = useState<string>("");

	const fullName = `${contact.firstName} ${contact.lastName}`.trim();

	const toggleCategory = (category: ContactResearchCategory) => {
		setSelectedCategories((prev) =>
			prev.includes(category)
				? prev.filter((c) => c !== category)
				: [...prev, category]
		);
	};

	const handleSearch = async () => {
		if (selectedCategories.length === 0) return;

		setIsSearching(true);
		setResults([]);

		try {
			const response = await researchContact(
				{
					contactId: contact.id,
					fullName,
					email: contact.email,
					company: null, // Could get from account if linked
					title: contact.title,
					categories: selectedCategories,
				},
				userContext
			);

			if (response.success) {
				setResults(response.results);
				setSummary(response.summary || "");
			}
		} catch (error) {
			console.error("Research error:", error);
		} finally {
			setIsSearching(false);
		}
	};

	const handleSave = async () => {
		if (results.length === 0) return;

		setIsSaving(true);
		try {
			await saveContactResearch(
				contact.id,
				{
					summary: summary || "Research completed",
					keyInsights: [],
					talkingPoints: [],
					connectionOpportunities: [],
					confidenceScore: 70,
				},
				userContext
			);
			onResearchComplete?.();
			setIsOpen(false);
		} catch (error) {
			console.error("Save error:", error);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button variant="outline" size="sm">
					<Search className="h-4 w-4 mr-2" />
					Research
				</Button>
			</SheetTrigger>
			<SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Research {fullName}</SheetTitle>
					<SheetDescription>
						Search web sources to enrich contact information
					</SheetDescription>
				</SheetHeader>

				<div className="py-6 space-y-6">
					{/* Category Selection */}
					<div className="space-y-3">
						<Label className="text-sm font-medium">Search Categories</Label>
						<div className="grid grid-cols-2 gap-2">
							{RESEARCH_CATEGORIES.map((category) => (
								<div
									key={category.id}
									className="flex items-center space-x-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
									onClick={() => toggleCategory(category.id)}
								>
									<Checkbox
										checked={selectedCategories.includes(category.id)}
										onCheckedChange={() => toggleCategory(category.id)}
									/>
									<category.icon className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">{category.label}</span>
								</div>
							))}
						</div>
					</div>

					{/* Search Button */}
					<Button
						onClick={handleSearch}
						disabled={isSearching || selectedCategories.length === 0}
						className="w-full"
					>
						{isSearching ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Searching...
							</>
						) : (
							<>
								<Search className="h-4 w-4 mr-2" />
								Search ({selectedCategories.length} categories)
							</>
						)}
					</Button>

					{/* Results */}
					{results.length > 0 && (
						<div className="space-y-4">
							{results.map((result) => (
								<Card key={result.category}>
									<CardHeader className="py-3">
										<CardTitle className="text-sm flex items-center gap-2">
											{result.title}
											{result.results.length > 0 ? (
												<Badge variant="secondary" className="ml-auto">
													{result.results.length} results
												</Badge>
											) : (
												<Badge variant="outline" className="ml-auto">
													No results
												</Badge>
											)}
										</CardTitle>
									</CardHeader>
									{result.results.length > 0 && (
										<CardContent className="py-2 space-y-2">
											{result.results.slice(0, 3).map((item, idx) => (
												<div
													key={idx}
													className="text-sm p-2 bg-muted/50 rounded"
												>
													<div className="font-medium truncate">
														{item.title}
													</div>
													<div className="text-muted-foreground text-xs line-clamp-2">
														{item.snippet}
													</div>
													{item.url && (
														<a
															href={item.url}
															target="_blank"
															rel="noopener noreferrer"
															className="text-xs text-primary flex items-center gap-1 mt-1"
														>
															<ExternalLink className="h-3 w-3" />
															View source
														</a>
													)}
												</div>
											))}
										</CardContent>
									)}
								</Card>
							))}
						</div>
					)}
				</div>

				<SheetFooter>
					{results.length > 0 && (
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Save className="h-4 w-4 mr-2" />
									Save Findings
								</>
							)}
						</Button>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

export default ContactResearchPanel;
