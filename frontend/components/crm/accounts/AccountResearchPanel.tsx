"use client";

/**
 * Account Research Panel
 *
 * Component for researching and enriching account data using web search.
 * Provides a dialog interface to search multiple sources and save findings.
 *
 * Features:
 * - Multi-source web scraping via Firecrawl
 * - AI-powered data extraction
 * - Commercial insights and value proposition generation
 * - AI thinking trace for human review
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
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
	Target,
	Handshake,
	Package,
	MessageSquare,
	Brain,
	ChevronDown,
	TrendingUp,
	AlertTriangle,
} from "lucide-react";
import {
	saveResearchFindings,
	type ResearchCategory,
	type AccountUpdateSuggestion,
	type ResearchFindingsData,
} from "@/lib/actions/crm/account-research";
import type { AccountRow, CommercialInsights } from "@/lib/db/schema-crm";

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
	const [activeTab, setActiveTab] = useState<"search" | "results" | "commercial" | "save">("search");
	const [suggestedUpdates, setSuggestedUpdates] = useState<Partial<AccountUpdateSuggestion>>({});
	const [isSaving, setIsSaving] = useState(false);
	const [extractionSources, setExtractionSources] = useState<Array<{ url: string; title: string }>>([]);
	const [extractionStatus, setExtractionStatus] = useState<string>("");
	const [findings, setFindings] = useState<ResearchFindingsData | null>(null);
	const [commercialInsights, setCommercialInsights] = useState<CommercialInsights | null>(null);
	const [valueProposition, setValueProposition] = useState<string | null>(null);
	const [thinkingTrace, setThinkingTrace] = useState<string | null>(null);
	const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

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
		setCommercialInsights(null);
		setValueProposition(null);
		setThinkingTrace(null);

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

					// Store findings
					if (data.findings) {
						setFindings(data.findings);
					}

					// Store commercial insights
					if (data.commercialInsights) {
						setCommercialInsights(data.commercialInsights);
					}

					// Store value proposition
					if (data.valueProposition) {
						setValueProposition(data.valueProposition);
					}

					// Store thinking trace
					if (data.thinkingTrace) {
						setThinkingTrace(data.thinkingTrace);
					}

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

					// Auto-switch to commercial tab if we have insights
					if (data.commercialInsights) {
						setTimeout(() => setActiveTab("commercial"), 500);
					} else if (Object.keys(data.extracted || {}).length > 0 || data.findings) {
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
		const sourceUrls = extractionSources.map((s) => s.url);
		const result = await saveResearchFindings(
			account.id,
			suggestedUpdates,
			findings,
			sourceUrls,
			commercialInsights,
			valueProposition,
			thinkingTrace
		);

		if (result.success) {
			onResearchComplete?.(suggestedUpdates);
			setIsOpen(false);
		} else {
			console.error("Failed to save findings:", result.error);
		}
		setIsSaving(false);
	}, [account.id, suggestedUpdates, findings, extractionSources, commercialInsights, valueProposition, thinkingTrace, onResearchComplete]);

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

	// Check if we have commercial insights
	const hasCommercialInsights = commercialInsights && (
		commercialInsights.opportunities.length > 0 ||
		commercialInsights.partnerships.length > 0 ||
		commercialInsights.productsToOffer.length > 0
	);

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button variant="outline" size="sm">
					<Search className="h-4 w-4 mr-2" />
					Research Account
				</Button>
			</SheetTrigger>

			<SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						Research: {account.name}
					</SheetTitle>
					<SheetDescription>
						Search the web to enrich account data and identify commercial opportunities
					</SheetDescription>
				</SheetHeader>

				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-6">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="search">
							<Search className="h-4 w-4 mr-2" />
							Search
						</TabsTrigger>
						<TabsTrigger value="results" disabled={categoryResults.size === 0}>
							<Globe className="h-4 w-4 mr-2" />
							Results
						</TabsTrigger>
						<TabsTrigger value="commercial" disabled={!hasCommercialInsights}>
							<Target className="h-4 w-4 mr-2" />
							Commercial
							{hasCommercialInsights && (
								<Badge variant="default" className="ml-2 bg-green-500">
									New
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

					role="button"
					tabIndex={0}
					onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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
									<div className="space-y-2 max-h-64 overflow-y-auto">
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
										{Object.entries(suggestedUpdates).map(([key, value]) => {
											// Skip non-string values (objects, arrays)
											if (typeof value !== "string") return null;
											return (
												<div key={key} className="space-y-1">
													<div className="text-xs text-muted-foreground capitalize">
														{key.replace(/([A-Z])/g, " $1").trim()}
													</div>
													<div className="text-sm font-medium truncate" title={value}>
														{value}
													</div>
												</div>
											);
										})}
									</div>
									<div className="flex gap-2 mt-4">
										{hasCommercialInsights && (
											<Button
												variant="primary"
												className="flex-1"
												onClick={() => setActiveTab("commercial")}
											>
												<Target className="h-4 w-4 mr-2" />
												View Commercial Insights
											</Button>
										)}
										<Button
											variant={hasCommercialInsights ? "outline" : "primary"}
											className="flex-1"
											onClick={() => setActiveTab("save")}
										>
											<Save className="h-4 w-4 mr-2" />
											Review & Save
										</Button>
									</div>
								</CardContent>
							</Card>
						)}

						{!isSearching && (
							<Button variant="outline" className="w-full" onClick={startResearch}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Research Again
							</Button>
						)}
					</TabsContent>

					{/* Commercial Insights Tab */}
					<TabsContent value="commercial" className="space-y-4 mt-4">
						{/* Value Proposition Banner */}
						{valueProposition && (
							<Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base text-green-700 dark:text-green-400">
										<MessageSquare className="h-4 w-4" />
										Value Proposition
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm font-medium">{valueProposition}</p>
								</CardContent>
							</Card>
						)}

						{/* Commercial Opportunities */}
						{commercialInsights?.opportunities && commercialInsights.opportunities.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<TrendingUp className="h-4 w-4 text-blue-500" />
										Commercial Opportunities ({commercialInsights.opportunities.length})
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{commercialInsights.opportunities.map((opp, idx) => (
										<div key={idx} className="p-3 border rounded-lg space-y-2">
											<div className="flex items-start justify-between gap-2">
												<h4 className="font-semibold text-sm">{opp.title}</h4>
												<Badge variant={
													opp.confidence === "high" ? "default" :
													opp.confidence === "medium" ? "secondary" : "outline"
												}>
													{opp.confidence}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground">{opp.description}</p>
											<div className="flex gap-4 text-xs">
												{opp.potentialValue && (
													<span className="text-green-600">
														<strong>Value:</strong> {opp.potentialValue}
													</span>
												)}
												{opp.timeframe && (
													<span className="text-blue-600">
														<strong>Timeframe:</strong> {opp.timeframe}
													</span>
												)}
											</div>
										</div>
									))}
								</CardContent>
							</Card>
						)}

						{/* Partnership Opportunities */}
						{commercialInsights?.partnerships && commercialInsights.partnerships.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Handshake className="h-4 w-4 text-purple-500" />
										Partnership Opportunities ({commercialInsights.partnerships.length})
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{commercialInsights.partnerships.map((partnership, idx) => (
										<div key={idx} className="p-3 border rounded-lg space-y-2">
											<h4 className="font-semibold text-sm">{partnership.type}</h4>
											<p className="text-sm text-muted-foreground">{partnership.description}</p>
											{partnership.synergies.length > 0 && (
												<div className="space-y-1">
													<span className="text-xs font-medium">Synergies:</span>
													<div className="flex flex-wrap gap-1">
														{partnership.synergies.map((synergy, sIdx) => (
															<Badge key={sIdx} variant="outline" className="text-xs">
																{synergy}
															</Badge>
														))}
													</div>
												</div>
											)}
											{partnership.nextSteps && (
												<p className="text-xs text-primary">
													<strong>Next Step:</strong> {partnership.nextSteps}
												</p>
											)}
										</div>
									))}
								</CardContent>
							</Card>
						)}

						{/* Products to Offer */}
						{commercialInsights?.productsToOffer && commercialInsights.productsToOffer.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Package className="h-4 w-4 text-orange-500" />
										Products/Services to Offer ({commercialInsights.productsToOffer.length})
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{commercialInsights.productsToOffer.map((product, idx) => (
										<div key={idx} className="p-3 border rounded-lg space-y-2">
											<h4 className="font-semibold text-sm">{product.productName}</h4>
											<p className="text-sm text-muted-foreground">{product.relevance}</p>
											{product.painPointAddressed && (
												<p className="text-xs">
													<strong className="text-red-500">Pain Point:</strong> {product.painPointAddressed}
												</p>
											)}
											{product.suggestedApproach && (
												<p className="text-xs text-blue-600">
													<strong>Approach:</strong> {product.suggestedApproach}
												</p>
											)}
										</div>
									))}
								</CardContent>
							</Card>
						)}

						{/* Talking Points */}
						{commercialInsights?.talkingPoints && commercialInsights.talkingPoints.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<MessageSquare className="h-4 w-4 text-cyan-500" />
										Key Talking Points
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{commercialInsights.talkingPoints.map((point, idx) => (
											<li key={idx} className="text-sm flex items-start gap-2">
												<span className="text-cyan-500 mt-1">•</span>
												<span>{point}</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						)}

						{/* Competitive Positioning */}
						{commercialInsights?.competitivePositioning && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Target className="h-4 w-4 text-rose-500" />
										Competitive Positioning
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm">{commercialInsights.competitivePositioning}</p>
								</CardContent>
							</Card>
						)}

						{/* AI Thinking Trace */}
						{thinkingTrace && (
							<Collapsible open={isThinkingExpanded} onOpenChange={setIsThinkingExpanded}>
								<Card className="border-amber-500/30">
									<CollapsibleTrigger asChild>
										<CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
											<CardTitle className="flex items-center justify-between text-base">
												<span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
													<Brain className="h-4 w-4" />
													AI Reasoning (for review)
												</span>
												<ChevronDown className={`h-4 w-4 transition-transform ${isThinkingExpanded ? "rotate-180" : ""}`} />
											</CardTitle>
										</CardHeader>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<CardContent>
											<div className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-lg max-h-96 overflow-y-auto">
												{thinkingTrace}
											</div>
										</CardContent>
									</CollapsibleContent>
								</Card>
							</Collapsible>
						)}

						<Button className="w-full" onClick={() => setActiveTab("save")}>
							<Save className="h-4 w-4 mr-2" />
							Review & Save All Findings
						</Button>
					</TabsContent>

					{/* Save Tab */}
					<TabsContent value="save" className="space-y-4 mt-4">
						{/* AI-Generated Findings */}
						{findings && (
							<Card className="border-primary/20 bg-primary/5">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="flex items-center gap-2 text-base">
											<Sparkles className="h-4 w-4 text-primary" />
											Research Findings & Insights
										</CardTitle>
										<Badge variant={findings.confidenceScore >= 70 ? "default" : "secondary"}>
											{findings.confidenceScore}% confidence
										</Badge>
									</div>
									<CardDescription>
										AI-generated analysis based on {extractionSources.length} sources
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{/* Executive Summary */}
									{findings.summary && (
										<div>
											<h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
												<Building2 className="h-4 w-4" />
												Executive Summary
											</h4>
											<p className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md">
												{findings.summary}
											</p>
										</div>
									)}

									{/* Key Insights */}
									{findings.keyInsights.length > 0 && (
										<div>
											<h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
												<Sparkles className="h-4 w-4 text-amber-500" />
												Key Insights
											</h4>
											<ul className="space-y-1.5">
												{findings.keyInsights.map((insight, idx) => (
													<li key={idx} className="text-sm flex items-start gap-2">
														<span className="text-amber-500 mt-1">•</span>
														<span>{insight}</span>
													</li>
												))}
											</ul>
										</div>
									)}

									{/* Opportunities */}
									{findings.opportunities.length > 0 && (
										<div>
											<h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
												<Briefcase className="h-4 w-4 text-green-500" />
												Opportunities
											</h4>
											<ul className="space-y-1.5">
												{findings.opportunities.map((opp, idx) => (
													<li key={idx} className="text-sm flex items-start gap-2">
														<span className="text-green-500 mt-1">✓</span>
														<span>{opp}</span>
													</li>
												))}
											</ul>
										</div>
									)}

									{/* Risks */}
									{findings.risks.length > 0 && (
										<div>
											<h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
												<AlertTriangle className="h-4 w-4 text-red-500" />
												Risks & Concerns
											</h4>
											<ul className="space-y-1.5">
												{findings.risks.map((risk, idx) => (
													<li key={idx} className="text-sm flex items-start gap-2">
														<span className="text-red-500 mt-1">!</span>
														<span>{risk}</span>
													</li>
												))}
											</ul>
										</div>
									)}

									{/* Next Steps */}
									{findings.nextSteps.length > 0 && (
										<div>
											<h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
												<CheckCircle className="h-4 w-4 text-blue-500" />
												Recommended Next Steps
											</h4>
											<ol className="space-y-1.5">
												{findings.nextSteps.map((step, idx) => (
													<li key={idx} className="text-sm flex items-start gap-2">
														<span className="text-blue-500 font-medium min-w-[1.5rem]">{idx + 1}.</span>
														<span>{step}</span>
													</li>
												))}
											</ol>
										</div>
									)}
								</CardContent>
							</Card>
						)}

						{/* Value Proposition Summary */}
						{valueProposition && (
							<Card className="border-green-500/30">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center gap-2 text-sm text-green-700">
										<MessageSquare className="h-4 w-4" />
										Value Proposition (will be saved)
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm">{valueProposition}</p>
								</CardContent>
							</Card>
						)}

						<Separator />

						{/* Data Fields */}
						<div className="text-sm font-medium">Extracted Data Fields</div>
						<div className="text-xs text-muted-foreground mb-2">
							Review and edit the extracted information before saving:
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

						{/* Summary of what will be saved */}
						<Card className="bg-muted/50">
							<CardContent className="pt-4">
								<h4 className="text-sm font-medium mb-2">Will be saved:</h4>
								<ul className="text-xs text-muted-foreground space-y-1">
									{Object.keys(suggestedUpdates).length > 0 && (
										<li>✓ {Object.keys(suggestedUpdates).length} extracted fields</li>
									)}
									{findings && <li>✓ Research findings and insights</li>}
									{commercialInsights && <li>✓ Commercial insights and opportunities</li>}
									{valueProposition && <li>✓ Value proposition statement</li>}
									{thinkingTrace && <li>✓ AI reasoning trace</li>}
									{extractionSources.length > 0 && <li>✓ {extractionSources.length} source URLs</li>}
								</ul>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				<SheetFooter className="mt-6">
					{activeTab === "save" && (
						<Button
							onClick={handleSaveFindings}
							disabled={isSaving || (Object.keys(suggestedUpdates).length === 0 && !findings && !commercialInsights)}
							className="w-full"
						>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Save className="h-4 w-4 mr-2" />
									Save All Research Data
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
