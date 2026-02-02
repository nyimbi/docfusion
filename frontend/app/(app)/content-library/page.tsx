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

function CollectionsPlaceholder() {
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
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Star className="h-4 w-4 text-amber-500" />
							Past Performance
						</CardTitle>
						<CardDescription>12 content blocks</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Reusable past performance narratives and project descriptions
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<FileText className="h-4 w-4 text-blue-500" />
							Technical Approach
						</CardTitle>
						<CardDescription>28 content blocks</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Technical methodology and approach templates
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Tag className="h-4 w-4 text-purple-500" />
							Management Plans
						</CardTitle>
						<CardDescription>15 content blocks</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Project management and staffing plan templates
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function AnalyticsPlaceholder() {
	return (
		<div className="space-y-6">
			<h2 className="text-lg font-medium">Content Analytics</h2>
			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Content Blocks</CardDescription>
						<CardTitle className="text-3xl">247</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Avg Win Rate</CardDescription>
						<CardTitle className="text-3xl text-green-600">68%</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Reuse Rate</CardDescription>
						<CardTitle className="text-3xl text-blue-600">4.2x</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Stale Content</CardDescription>
						<CardTitle className="text-3xl text-amber-600">23</CardTitle>
					</CardHeader>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Top Performing Content</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm">Cloud Migration Methodology</span>
							<span className="text-sm text-green-600">92% win rate</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm">Agile Development Approach</span>
							<span className="text-sm text-green-600">87% win rate</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm">24/7 Support Capability</span>
							<span className="text-sm text-green-600">85% win rate</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function ApprovalsPlaceholder() {
	return (
		<div className="space-y-6">
			<h2 className="text-lg font-medium">Pending Approvals</h2>
			<div className="space-y-3">
				<Card>
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium">New Cybersecurity Capability Statement</p>
								<p className="text-sm text-muted-foreground">Submitted by John Smith • 2 days ago</p>
							</div>
							<div className="flex gap-2">
								<Button variant="outline" size="sm">Reject</Button>
								<Button size="sm">Approve</Button>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium">Updated CMMC Compliance Section</p>
								<p className="text-sm text-muted-foreground">Submitted by Jane Doe • 3 days ago</p>
							</div>
							<div className="flex gap-2">
								<Button variant="outline" size="sm">Reject</Button>
								<Button size="sm">Approve</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
