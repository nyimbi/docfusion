/**
 * Content Library Page
 *
 * Semantic content library with AI-powered auto-tagging, search, and analytics.
 * Enables proposal teams to find, reuse, and track winning content.
 */

"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
	Search,
	Plus,
	Upload,
	Library,
	TrendingUp,
	Clock,
	Star,
	FileText,
	Tag,
	BarChart,
} from "lucide-react";
import { ContentLibraryBrowser } from "@/components/content-library/ContentLibraryBrowser";
import {
	getContentLibraryStats,
	getSnippetsNeedingReview,
	semanticSearch,
	updateSnippetFreshness,
} from "@/lib/actions/content-library";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContentLibraryPage() {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [activeTab, setActiveTab] = React.useState("browse");

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<Library className="h-6 w-6 text-primary" />
							Content Library
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Reusable content blocks with AI-powered search and win rate tracking
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline">
							<Upload className="h-4 w-4 mr-2" />
							Import
						</Button>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							New Content
						</Button>
					</div>
				</div>

				{/* Search Bar */}
				<div className="relative max-w-2xl">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search content semantically (e.g., 'cybersecurity experience for DoD')..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="h-full flex flex-col"
				>
					<div className="flex-shrink-0 border-b px-6">
						<TabsList className="h-12 bg-transparent border-b-0">
							<TabsTrigger
								value="browse"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Library className="h-4 w-4 mr-2" />
								Browse
							</TabsTrigger>
							<TabsTrigger
								value="collections"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Star className="h-4 w-4 mr-2" />
								Collections
							</TabsTrigger>
							<TabsTrigger
								value="analytics"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<TrendingUp className="h-4 w-4 mr-2" />
								Analytics
							</TabsTrigger>
							<TabsTrigger
								value="approvals"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Clock className="h-4 w-4 mr-2" />
								Pending Approval
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="browse" className="h-full m-0">
							<ContentLibraryBrowser />
						</TabsContent>
						<TabsContent value="collections" className="h-full m-0 p-6">
							<CollectionsPlaceholder />
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0 p-6">
							<AnalyticsPlaceholder />
						</TabsContent>
						<TabsContent value="approvals" className="h-full m-0 p-6">
							<ApprovalsPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
}

interface CollectionData {
	name: string;
	query: string;
	icon: React.ReactNode;
	iconColor: string;
	description: string;
}

const COLLECTION_DEFINITIONS: CollectionData[] = [
	{
		name: "Past Performance",
		query: "past performance project experience contract history",
		icon: <Star className="h-4 w-4" />,
		iconColor: "text-amber-500",
		description: "Reusable past performance narratives and project descriptions",
	},
	{
		name: "Technical Approach",
		query: "technical approach methodology solution architecture",
		icon: <FileText className="h-4 w-4" />,
		iconColor: "text-blue-500",
		description: "Technical methodology and approach templates",
	},
	{
		name: "Management Plans",
		query: "management plan staffing project management quality control",
		icon: <Tag className="h-4 w-4" />,
		iconColor: "text-purple-500",
		description: "Project management and staffing plan templates",
	},
	{
		name: "Compliance",
		query: "compliance security clearance FAR DFARS CMMC",
		icon: <BarChart className="h-4 w-4" />,
		iconColor: "text-green-500",
		description: "Compliance statements and certifications",
	},
	{
		name: "Corporate Capabilities",
		query: "corporate capability statement company overview qualifications",
		icon: <Library className="h-4 w-4" />,
		iconColor: "text-indigo-500",
		description: "Company capability statements and overviews",
	},
	{
		name: "Key Personnel",
		query: "key personnel resume biography qualifications team",
		icon: <Clock className="h-4 w-4" />,
		iconColor: "text-rose-500",
		description: "Key personnel bios and qualification summaries",
	},
];

function CollectionsPlaceholder() {
	const [collections, setCollections] = React.useState<
		Array<{ name: string; count: number; avgWinRate: number; description: string; icon: React.ReactNode; iconColor: string }>
	>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchCollections() {
			setIsLoading(true);
			try {
				// Fetch content for each collection definition in parallel
				const collectionResults = await Promise.all(
					COLLECTION_DEFINITIONS.map(async (def) => {
						const searchResult = await semanticSearch({
							query: def.query,
							limit: 100,
							contentTypes: ["snippet", "template"],
						});
						const snippetResults = searchResult.results.filter(r => r.contentType === "snippet" && r.snippet);
						const snippetsWithWinRate = snippetResults.filter(r => r.snippet?.analytics?.winRate !== undefined);
						const avgWinRate =
							snippetsWithWinRate.length > 0
								? snippetsWithWinRate.reduce((acc, r) => acc + (r.snippet?.analytics?.winRate ?? 0), 0) / snippetsWithWinRate.length
								: 0;
						return {
							name: def.name,
							count: searchResult.total,
							avgWinRate,
							description: def.description,
							icon: def.icon,
							iconColor: def.iconColor,
						};
					})
				);
				setCollections(collectionResults);
			} catch (error) {
				console.error("Failed to fetch collections:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchCollections();
	}, []);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-medium">Content Collections</h2>
					<Button size="sm" disabled>
						<Plus className="h-4 w-4 mr-2" />
						New Collection
					</Button>
				</div>
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-4 w-24 mt-1" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-4 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium">Content Collections</h2>
				<Button size="sm">
					<Plus className="h-4 w-4 mr-2" />
					New Collection
				</Button>
			</div>
			<div className="grid grid-cols-3 gap-4">
				{collections.map((collection) => (
					<Card key={collection.name} className="cursor-pointer hover:border-primary transition-colors">
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<span className={collection.iconColor}>{collection.icon}</span>
								{collection.name}
							</CardTitle>
							<CardDescription>
								{collection.count} content blocks
								{collection.avgWinRate > 0 && (
									<span className="ml-2 text-green-600">• {collection.avgWinRate.toFixed(0)}% win rate</span>
								)}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">{collection.description}</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function AnalyticsPlaceholder() {
	const [stats, setStats] = React.useState<any>(null);
	const [staleContent, setStaleContent] = React.useState<any[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchAnalytics() {
			setIsLoading(true);
			try {
				const [statsResult, staleResult] = await Promise.all([
					getContentLibraryStats(),
					getSnippetsNeedingReview(10),
				]);
				setStats(statsResult);
				setStaleContent(staleResult);
			} catch (error) {
				console.error("Failed to fetch content analytics:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchAnalytics();
	}, []);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<h2 className="text-lg font-medium">Content Analytics</h2>
				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardHeader className="pb-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-9 w-16 mt-1" />
							</CardHeader>
						</Card>
					))}
				</div>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-40" />
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-5 w-full" />
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	const totalContent = (stats?.totalSnippets ?? 0) + (stats?.totalTemplates ?? 0);
	const avgWinRate = stats?.snippetWinRateAvg ?? stats?.templateWinRateAvg ?? 0;
	const reuseRate = stats?.totalUsages > 0 && totalContent > 0
		? (stats.totalUsages / totalContent).toFixed(1)
		: "0";

	return (
		<div className="space-y-6">
			<h2 className="text-lg font-medium">Content Analytics</h2>
			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Content Blocks</CardDescription>
						<CardTitle className="text-3xl">{totalContent}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Avg Win Rate</CardDescription>
						<CardTitle className={`text-3xl ${avgWinRate >= 50 ? "text-green-600" : "text-amber-600"}`}>
							{avgWinRate > 0 ? `${avgWinRate.toFixed(0)}%` : "N/A"}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Reuse Rate</CardDescription>
						<CardTitle className="text-3xl text-blue-600">{reuseRate}x</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Needs Review</CardDescription>
						<CardTitle className="text-3xl text-amber-600">{staleContent.length}</CardTitle>
					</CardHeader>
				</Card>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Content Breakdown</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm">Snippets</span>
								<span className="text-sm font-medium">{stats?.totalSnippets ?? 0}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm">Templates</span>
								<span className="text-sm font-medium">{stats?.totalTemplates ?? 0}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm">Partials</span>
								<span className="text-sm font-medium">{stats?.totalPartials ?? 0}</span>
							</div>
							<div className="flex items-center justify-between pt-2 border-t">
								<span className="text-sm">Total Usages (30d)</span>
								<span className="text-sm font-medium text-blue-600">{stats?.monthlyUsages ?? 0}</span>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Clock className="h-4 w-4 text-amber-500" />
							Content Needing Review
						</CardTitle>
					</CardHeader>
					<CardContent>
						{staleContent.length > 0 ? (
							<div className="space-y-3">
								{staleContent.slice(0, 5).map((item: any) => (
									<div key={item.id} className="flex items-center justify-between">
										<span className="text-sm truncate max-w-[200px]">{item.title ?? item.name}</span>
										<span className="text-xs text-amber-600">{item.freshnessStatus ?? "review"}</span>
									</div>
								))}
								{staleContent.length > 5 && (
									<p className="text-xs text-muted-foreground">
										+{staleContent.length - 5} more items need review
									</p>
								)}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								All content is up to date!
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function ApprovalsPlaceholder() {
	const [pendingItems, setPendingItems] = React.useState<any[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [processingId, setProcessingId] = React.useState<string | null>(null);

	const fetchPendingItems = React.useCallback(async () => {
		setIsLoading(true);
		try {
			// Get snippets needing review as "pending approval" items
			const items = await getSnippetsNeedingReview(20);
			setPendingItems(items);
		} catch (error) {
			console.error("Failed to fetch pending approvals:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchPendingItems();
	}, [fetchPendingItems]);

	const handleApprove = async (id: string) => {
		setProcessingId(id);
		try {
			// Mark as current (approved)
			await updateSnippetFreshness(id, "current");
			// Refresh the list
			await fetchPendingItems();
		} catch (error) {
			console.error("Failed to approve item:", error);
		} finally {
			setProcessingId(null);
		}
	};

	const handleReject = async (id: string) => {
		setProcessingId(id);
		try {
			// Mark as stale (rejected/needs attention)
			await updateSnippetFreshness(id, "stale");
			// Refresh the list
			await fetchPendingItems();
		} catch (error) {
			console.error("Failed to reject item:", error);
		} finally {
			setProcessingId(null);
		}
	};

	const formatDate = (date: Date | string | null | undefined) => {
		if (!date) return "Unknown date";
		const d = new Date(date);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;
		return d.toLocaleDateString();
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<h2 className="text-lg font-medium">Pending Approvals</h2>
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardContent className="pt-4">
								<div className="flex items-center justify-between">
									<div className="space-y-2">
										<Skeleton className="h-5 w-64" />
										<Skeleton className="h-4 w-40" />
									</div>
									<div className="flex gap-2">
										<Skeleton className="h-8 w-16" />
										<Skeleton className="h-8 w-20" />
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium">Pending Approvals</h2>
				<span className="text-sm text-muted-foreground">
					{pendingItems.length} items need review
				</span>
			</div>
			{pendingItems.length === 0 ? (
				<Card>
					<CardContent className="pt-6 text-center">
						<p className="text-muted-foreground">No items pending approval</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{pendingItems.map((item) => (
						<Card key={item.id}>
							<CardContent className="pt-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">{item.title ?? "Untitled Content"}</p>
										<p className="text-sm text-muted-foreground">
											{item.category && <span className="capitalize">{item.category} • </span>}
											Status: <span className="text-amber-600 capitalize">{item.freshnessStatus ?? "needs review"}</span>
											{" • "}Last updated {formatDate(item.lastReviewDate ?? item.updatedAt)}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleReject(item.id)}
											disabled={processingId === item.id}
										>
											{processingId === item.id ? "..." : "Archive"}
										</Button>
										<Button
											size="sm"
											onClick={() => handleApprove(item.id)}
											disabled={processingId === item.id}
										>
											{processingId === item.id ? "..." : "Approve"}
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
