"use client";

/**
 * Account Research Panel
 *
 * Component for researching and enriching account data using web search.
 * Provides a dialog interface to search multiple sources and save findings.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
	Globe,
	Users,
	Building2,
	Briefcase,
	Linkedin,
	Twitter,
	Newspaper,
	Info,
	Loader2,
	ExternalLink,
	CheckCircle,
	Save,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import {
	saveResearchFindings,
	type ResearchCategory,
	type AccountUpdateSuggestion,
} from "@/lib/actions/crm/account-research";
import type { AccountRow } from "@/lib/db/schema-crm";

// ============================================================================
// Types
// ============================================================================

interface AccountResearchPanelProps {
	account: AccountRow;
	onResearchComplete?: (updates: Partial<AccountUpdateSuggestion>) => void;
}

interface SearchResult {
	title: string;
	snippet: string;
	url?: string;
	source?: string;
}

interface CategoryResult {
	category: ResearchCategory;
	title: string;
	query: string;
	results: SearchResult[];
	isLoading: boolean;
	isComplete: boolean;
	error?: string;
}

// ============================================================================
// Category Configuration
// ============================================================================

const RESEARCH_CATEGORIES: Array<{
	id: ResearchCategory;
	label: string;
	description: string;
	icon: React.ElementType;
}> = [
	{
		id: "company_info",
		label: "Company Profile",
		description: "General company information, overview, and about page",
		icon: Building2,
	},
	{
		id: "contacts",
		label: "Contact Information",
		description: "Email addresses, phone numbers, and physical addresses",
		icon: Globe,
	},
	{
		id: "management",
		label: "Leadership Team",
		description: "Executives, founders, CEO, and key decision makers",
		icon: Users,
	},
	{
		id: "clients",
		label: "Clients & Projects",
		description: "Customer testimonials, case studies, and notable projects",
		icon: Briefcase,
	},
	{
		id: "linkedin",
		label: "LinkedIn",
		description: "Company LinkedIn page and employee profiles",
		icon: Linkedin,
	},
	{
		id: "twitter",
		label: "Twitter/X & Social",
		description: "Social media presence and mentions",
		icon: Twitter,
	},
	{
		id: "news",
		label: "Recent News",
		description: "Press releases, announcements, and news articles",
		icon: Newspaper,
	},
	{
		id: "general",
		label: "General Search",
		description: "Broad web search for additional information",
		icon: Info,
	},
];

// ============================================================================
// Component
// ============================================================================

export function AccountResearchPanel({
	account,
	onResearchComplete,
}: AccountResearchPanelProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedCategories, setSelectedCategories] = useState<ResearchCategory[]>([
		"company_info",
		"contacts",
		"management",
	]);
	const [categoryResults, setCategoryResults] = useState<Map<ResearchCategory, CategoryResult>>(
		new Map()
	);
	const [isSearching, setIsSearching] = useState(false);
	const [activeTab, setActiveTab] = useState<"search" | "results" | "save">("search");
	const [suggestedUpdates, setSuggestedUpdates] = useState<Partial<AccountUpdateSuggestion>>({});
	const [isSaving, setIsSaving] = useState(false);
	const [extractionSources, setExtractionSources] = useState<Array<{ url: string; title: string }>>([]);
	const [extractionStatus, setExtractionStatus] = useState<string>("");

	// Toggle category selection
	const toggleCategory = useCallback((categoryId: ResearchCategory) => {
		setSelectedCategories((prev) =>
			prev.includes(categoryId)
				? prev.filter((c) => c !== categoryId)
				: [...prev, categoryId]
		);
	}, []);

	// Start research with AI extraction
	const startResearch = useCallback(async () => {
		if (selectedCategories.length === 0) return;

		setIsSearching(true);
		setActiveTab("results");
		setExtractionStatus("Searching the web and scraping sources...");
		setCategoryResults(new Map());
		setExtractionSources([]);

		try {
			// Call the AI extraction endpoint
			const response = await fetch("/api/v1/research/extract", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					accountName: account.name,
					website: account.website,
					country: account.country,
					currentData: {
						industry: account.industry,
						description: account.description,
					},
				}),
			});

			if (response.ok) {
				const data = await response.json();

				if (data.success) {
					setExtractionStatus(`AI extracted information from ${data.sources.length} sources`);
					setExtractionSources(data.sources || []);

					// Pre-populate suggested updates with extracted data
					setSuggestedUpdates(data.extracted || {});

					// Create a summary result for display
					const summaryResults = new Map<ResearchCategory, CategoryResult>();
					summaryResults.set("company_info", {
						category: "company_info",
						title: "AI Extracted Information",
						query: `Searched and scraped ${data.sources.length} pages`,
						results: data.sources.map((s: { url: string; title: string }) => ({
							title: s.title,
							snippet: `Source page scraped and analyzed`,
							url: s.url,
							source: new URL(s.url).hostname,
						})),
						isLoading: false,
						isComplete: true,
					});
					setCategoryResults(summaryResults);

					// Auto-switch to save tab if we have results
					if (Object.keys(data.extracted || {}).length > 0) {
						setTimeout(() => setActiveTab("save"), 500);
					}
				} else {
					setExtractionStatus("Extraction failed: " + (data.error || "Unknown error"));
				}
			} else {
				setExtractionStatus("API request failed");
			}
		} catch (error) {
			console.error("Research error:", error);
			setExtractionStatus("Research failed - please try again");
		}

		setIsSearching(false);
	}, [account.name, account.website, account.country, account.industry, account.description, selectedCategories.length]);

	// Save findings
	const handleSaveFindings = useCallback(async () => {
		setIsSaving(true);
		const result = await saveResearchFindings(account.id, suggestedUpdates);

		if (result.success) {
			onResearchComplete?.(suggestedUpdates);
			setIsOpen(false);
		} else {
			console.error("Failed to save findings:", result.error);
		}
		setIsSaving(false);
	}, [account.id, suggestedUpdates, onResearchComplete]);

	// Update suggested field
	const updateSuggestion = useCallback(
		(field: keyof AccountUpdateSuggestion, value: string) => {
			setSuggestedUpdates((prev) => ({
				...prev,
				[field]: value,
			}));
		},
		[]
	);

	// Get completed count
	const completedCount = Array.from(categoryResults.values()).filter(
		(r) => r.isComplete
	).length;
	const totalCount = categoryResults.size;

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button variant="outline" size="sm">
					<Search className="h-4 w-4 mr-2" />
					Research Account
				</Button>
			</SheetTrigger>

			<SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						Research: {account.name}
					</SheetTitle>
					<SheetDescription>
						Search the web to enrich account data with additional information
					</SheetDescription>
				</SheetHeader>

				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-6">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="search">
							<Search className="h-4 w-4 mr-2" />
							Search
						</TabsTrigger>
						<TabsTrigger value="results" disabled={categoryResults.size === 0}>
							<Globe className="h-4 w-4 mr-2" />
							Results
							{totalCount > 0 && (
								<Badge variant="secondary" className="ml-2">
									{completedCount}/{totalCount}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="save" disabled={categoryResults.size === 0}>
							<Save className="h-4 w-4 mr-2" />
							Save
						</TabsTrigger>
					</TabsList>

					{/* Search Configuration Tab */}
					<TabsContent value="search" className="space-y-4 mt-4">
						<div className="space-y-4">
							<div>
								<h4 className="font-medium mb-2">Account Details</h4>
								<div className="grid grid-cols-2 gap-2 text-sm">
									<div>
										<span className="text-muted-foreground">Name:</span>{" "}
										<span className="font-medium">{account.name}</span>
									</div>
									{account.website && (
										<div>
											<span className="text-muted-foreground">Website:</span>{" "}
											<span className="font-medium">{account.website}</span>
										</div>
									)}
									{account.country && (
										<div>
											<span className="text-muted-foreground">Country:</span>{" "}
											<span className="font-medium">{account.country}</span>
										</div>
									)}
									{account.industry && (
										<div>
											<span className="text-muted-foreground">Industry:</span>{" "}
											<span className="font-medium">{account.industry}</span>
										</div>
									)}
								</div>
							</div>

							<Separator />

							<div>
								<h4 className="font-medium mb-3">Select Research Categories</h4>
								<div className="space-y-3">
									{RESEARCH_CATEGORIES.map((category) => {
										const Icon = category.icon;
										const isSelected = selectedCategories.includes(category.id);

										return (
											<div
												key={category.id}
												className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
													isSelected
														? "border-primary bg-primary/5"
														: "border-border hover:bg-muted/50"
												}`}
												onClick={() => toggleCategory(category.id)}
											>
												<Checkbox
													checked={isSelected}
													onCheckedChange={() => toggleCategory(category.id)}
												/>
												<Icon className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
												<div className="flex-1">
													<div className="font-medium text-sm">{category.label}</div>
													<div className="text-xs text-muted-foreground">
														{category.description}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>

						<Button
							className="w-full"
							size="lg"
							onClick={startResearch}
							disabled={selectedCategories.length === 0 || isSearching}
						>
							{isSearching ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Searching...
								</>
							) : (
								<>
									<Search className="h-4 w-4 mr-2" />
									Start Research ({selectedCategories.length} categories)
								</>
							)}
						</Button>
					</TabsContent>

					{/* Results Tab */}
					<TabsContent value="results" className="space-y-4 mt-4">
						{/* Extraction Status */}
						{extractionStatus && (
							<div className={`p-4 rounded-lg ${isSearching ? "bg-blue-50 dark:bg-blue-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
								<div className="flex items-center gap-2">
									{isSearching ? (
										<Loader2 className="h-5 w-5 animate-spin text-blue-600" />
									) : (
										<CheckCircle className="h-5 w-5 text-green-600" />
									)}
									<span className={`font-medium ${isSearching ? "text-blue-700" : "text-green-700"}`}>
										{extractionStatus}
									</span>
								</div>
							</div>
						)}

						{/* Scraped Sources */}
						{extractionSources.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Globe className="h-4 w-4" />
										Sources Analyzed ({extractionSources.length})
									</CardTitle>
									<CardDescription>
										AI extracted information from these web pages
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										{extractionSources.map((source, idx) => (
											<div key={idx} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded">
												<div className="flex-1 min-w-0">
													<div className="font-medium text-sm truncate">{source.title}</div>
													<div className="text-xs text-muted-foreground truncate">{source.url}</div>
												</div>
												<a
													href={source.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-primary hover:underline flex-shrink-0"
												>
													<ExternalLink className="h-4 w-4" />
												</a>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}

						{/* Extracted Fields Preview */}
						{Object.keys(suggestedUpdates).length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Sparkles className="h-4 w-4 text-primary" />
										AI Extracted Data
									</CardTitle>
									<CardDescription>
										Review and edit before saving
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-3">
										{Object.entries(suggestedUpdates).map(([key, value]) => (
											<div key={key} className="space-y-1">
												<div className="text-xs text-muted-foreground capitalize">
													{key.replace(/([A-Z])/g, " $1").trim()}
												</div>
												<div className="text-sm font-medium truncate" title={value}>
													{value}
												</div>
											</div>
										))}
									</div>
									<Button
										className="w-full mt-4"
										onClick={() => setActiveTab("save")}
									>
										<Save className="h-4 w-4 mr-2" />
										Review & Save Extracted Data
									</Button>
								</CardContent>
							</Card>
						)}

						{/* Legacy category results */}
						{Array.from(categoryResults.values()).filter(r => r.results.length > 0 && r.category !== "company_info").map((result) => {
							const categoryConfig = RESEARCH_CATEGORIES.find(
								(c) => c.id === result.category
							);
							const Icon = categoryConfig?.icon || Info;

							return (
								<Card key={result.category}>
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<CardTitle className="flex items-center gap-2 text-base">
												<Icon className="h-4 w-4" />
												{result.title}
											</CardTitle>
											{result.isComplete && (
												<CheckCircle className="h-4 w-4 text-green-500" />
											)}
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{result.results.slice(0, 5).map((item, idx) => (
												<div key={idx} className="space-y-1">
													<div className="flex items-start justify-between gap-2">
														<h5 className="font-medium text-sm line-clamp-1">
															{item.title}
														</h5>
														{item.url && (
															<a
																href={item.url}
																target="_blank"
																rel="noopener noreferrer"
																className="text-primary hover:underline flex-shrink-0"
															>
																<ExternalLink className="h-3.5 w-3.5" />
															</a>
														)}
													</div>
													<p className="text-xs text-muted-foreground line-clamp-2">
														{item.snippet}
													</p>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							);
						})}

						{!isSearching && (
							<Button variant="outline" className="w-full" onClick={startResearch}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Research Again
							</Button>
						)}
					</TabsContent>

					{/* Save Tab */}
					<TabsContent value="save" className="space-y-4 mt-4">
						<div className="text-sm text-muted-foreground mb-4">
							Based on the research results, update the account with new information:
						</div>

						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="website">Website</Label>
								<Input
									id="website"
									placeholder={account.website || "https://example.com"}
									value={suggestedUpdates.website || ""}
									onChange={(e) => updateSuggestion("website", e.target.value)}
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										placeholder={account.email || "contact@company.com"}
										value={suggestedUpdates.email || ""}
										onChange={(e) => updateSuggestion("email", e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="phone">Phone</Label>
									<Input
										id="phone"
										placeholder={account.phone || "+1 (555) 000-0000"}
										value={suggestedUpdates.phone || ""}
										onChange={(e) => updateSuggestion("phone", e.target.value)}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="keyLeadership">Key Leadership</Label>
								<Textarea
									id="keyLeadership"
									placeholder={account.keyLeadership || "CEO: John Doe, CTO: Jane Smith..."}
									value={suggestedUpdates.keyLeadership || ""}
									onChange={(e) => updateSuggestion("keyLeadership", e.target.value)}
									rows={2}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="linkedinUrl">LinkedIn URL</Label>
								<Input
									id="linkedinUrl"
									placeholder={account.linkedinUrl || "https://linkedin.com/company/..."}
									value={suggestedUpdates.linkedinUrl || ""}
									onChange={(e) => updateSuggestion("linkedinUrl", e.target.value)}
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="industry">Industry</Label>
									<Input
										id="industry"
										placeholder={account.industry || "Technology"}
										value={suggestedUpdates.industry || ""}
										onChange={(e) => updateSuggestion("industry", e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="employeeCount">Employee Count</Label>
									<Input
										id="employeeCount"
										placeholder={account.employeeCount || "50-100"}
										value={suggestedUpdates.employeeCount || ""}
										onChange={(e) => updateSuggestion("employeeCount", e.target.value)}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="headquarters">Headquarters</Label>
								<Input
									id="headquarters"
									placeholder={account.headquarters || "City, Country"}
									value={suggestedUpdates.headquarters || ""}
									onChange={(e) => updateSuggestion("headquarters", e.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="notableClients">Notable Clients</Label>
								<Textarea
									id="notableClients"
									placeholder={account.notableClients || "Client 1, Client 2..."}
									value={suggestedUpdates.notableClients || ""}
									onChange={(e) => updateSuggestion("notableClients", e.target.value)}
									rows={2}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									placeholder={account.description || "Company description..."}
									value={suggestedUpdates.description || ""}
									onChange={(e) => updateSuggestion("description", e.target.value)}
									rows={3}
								/>
							</div>
						</div>
					</TabsContent>
				</Tabs>

				<SheetFooter className="mt-6">
					{activeTab === "save" && (
						<Button
							onClick={handleSaveFindings}
							disabled={isSaving || Object.keys(suggestedUpdates).length === 0}
						>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Save className="h-4 w-4 mr-2" />
									Save Updates
								</>
							)}
						</Button>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

export default AccountResearchPanel;
