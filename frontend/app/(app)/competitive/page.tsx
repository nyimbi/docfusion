/**
 * Competitive Intelligence Page
 *
 * Competitor database with capabilities tracking, discriminator engine,
 * ghost themes, and teaming recommendations.
 */

"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Swords,
	Search,
	Plus,
	Users,
	Target,
	Lightbulb,
	GitCompare,
	TrendingUp,
} from "lucide-react";

// Import competitive intelligence components
// Note: These components exist in components/evidence/ based on the schema
// We'll create placeholder imports and use what exists

export default function CompetitivePage() {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [activeTab, setActiveTab] = React.useState("competitors");
	const [selectedCompetitorId, setSelectedCompetitorId] = React.useState<string | null>(null);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<Swords className="h-6 w-6 text-primary" />
							Competitive Intelligence
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Track competitors, develop discriminators, and identify teaming partners
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button onClick={() => setSelectedCompetitorId("new")}>
							<Plus className="h-4 w-4 mr-2" />
							Add Competitor
						</Button>
					</div>
				</div>

				{/* Search */}
				<div className="relative max-w-xl">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search competitors by name, capabilities..."
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
								value="competitors"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Users className="h-4 w-4 mr-2" />
								Competitors
							</TabsTrigger>
							<TabsTrigger
								value="discriminators"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Target className="h-4 w-4 mr-2" />
								Discriminators
							</TabsTrigger>
							<TabsTrigger
								value="ghost-themes"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Lightbulb className="h-4 w-4 mr-2" />
								Ghost Themes
							</TabsTrigger>
							<TabsTrigger
								value="teaming"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<GitCompare className="h-4 w-4 mr-2" />
								Teaming Partners
							</TabsTrigger>
							<TabsTrigger
								value="analytics"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<TrendingUp className="h-4 w-4 mr-2" />
								Win/Loss vs Competitors
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto p-6">
						<TabsContent value="competitors" className="h-full m-0">
							<CompetitorDatabase
								searchQuery={searchQuery}
								onSelectCompetitor={setSelectedCompetitorId}
							/>
						</TabsContent>
						<TabsContent value="discriminators" className="h-full m-0">
							<DiscriminatorLibrary />
						</TabsContent>
						<TabsContent value="ghost-themes" className="h-full m-0">
							<GhostThemeGenerator />
						</TabsContent>
						<TabsContent value="teaming" className="h-full m-0">
							<TeamingRecommendations />
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0">
							<CompetitiveAnalytics />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Competitor Detail Side Panel */}
			{selectedCompetitorId && (
				<div className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<CompetitorEditor
						competitorId={selectedCompetitorId === "new" ? undefined : selectedCompetitorId}
						onClose={() => setSelectedCompetitorId(null)}
					/>
				</div>
			)}
		</div>
	);
}

// Placeholder components - these would use the actual components from components/
function CompetitorDatabase({ searchQuery, onSelectCompetitor }: { searchQuery: string; onSelectCompetitor: (id: string) => void }) {
	const mockCompetitors = [
		{ id: "1", name: "Acme Corp", type: "Prime", wins: 12, losses: 5 },
		{ id: "2", name: "Tech Solutions Inc", type: "Prime", wins: 8, losses: 3 },
		{ id: "3", name: "Global Services LLC", type: "Sub", wins: 15, losses: 8 },
	];

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-3 gap-4">
				{mockCompetitors
					.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
					.map(competitor => (
						<div
							key={competitor.id}
							className="p-4 bg-card rounded-lg border cursor-pointer hover:border-primary transition-colors"
							onClick={() => onSelectCompetitor(competitor.id)}
						>
							<h3 className="font-medium">{competitor.name}</h3>
							<p className="text-sm text-muted-foreground">{competitor.type} Contractor</p>
							<div className="flex gap-4 mt-2 text-sm">
								<span className="text-green-600">{competitor.wins} wins</span>
								<span className="text-red-600">{competitor.losses} losses</span>
							</div>
						</div>
					))}
			</div>
		</div>
	);
}

function CompetitorEditor({ competitorId, onClose }: { competitorId?: string; onClose: () => void }) {
	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">
					{competitorId ? "Edit Competitor" : "New Competitor"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>×</Button>
			</div>
			<div className="space-y-4">
				<div>
					<label className="text-sm font-medium">Company Name</label>
					<Input placeholder="Enter competitor name" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Type</label>
					<Input placeholder="Prime / Subcontractor" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Capabilities</label>
					<textarea
						className="w-full mt-1 p-2 border rounded-md min-h-[100px]"
						placeholder="List key capabilities..."
					/>
				</div>
				<div>
					<label className="text-sm font-medium">Strengths</label>
					<textarea
						className="w-full mt-1 p-2 border rounded-md min-h-[80px]"
						placeholder="Known strengths..."
					/>
				</div>
				<div>
					<label className="text-sm font-medium">Weaknesses</label>
					<textarea
						className="w-full mt-1 p-2 border rounded-md min-h-[80px]"
						placeholder="Known weaknesses..."
					/>
				</div>
				<Button className="w-full">Save Competitor</Button>
			</div>
		</div>
	);
}

function DiscriminatorLibrary() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium">Discriminator Library</h2>
				<Button size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Add Discriminator
				</Button>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="p-4 bg-card rounded-lg border">
					<h3 className="font-medium">24/7 NOC Support</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Unlike competitors with limited support hours, our Network Operations Center provides 24/7/365 monitoring and response.
					</p>
					<div className="mt-2">
						<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
							85% win rate when used
						</span>
					</div>
				</div>
				<div className="p-4 bg-card rounded-lg border">
					<h3 className="font-medium">Cleared Personnel Pool</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Immediate access to 200+ TS/SCI cleared professionals, eliminating ramp-up delays.
					</p>
					<div className="mt-2">
						<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
							78% win rate when used
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function GhostThemeGenerator() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium">Ghost Themes</h2>
				<Button size="sm">
					<Lightbulb className="h-4 w-4 mr-2" />
					Generate Ghost Theme
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">
				Ghost themes highlight competitor weaknesses without naming them directly.
			</p>
			<div className="space-y-3">
				<div className="p-4 bg-card rounded-lg border">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
							Target: Acme Corp
						</span>
					</div>
					<p className="text-sm font-medium">Weakness: Limited cloud migration experience</p>
					<div className="mt-2 p-3 bg-muted rounded text-sm">
						<strong>Ghost Language:</strong> "Our team brings proven AWS and Azure migration expertise from 15+ federal modernization projects, ensuring your agency avoids the costly missteps common in first-time cloud transitions."
					</div>
				</div>
			</div>
		</div>
	);
}

function TeamingRecommendations() {
	return (
		<div className="space-y-4">
			<h2 className="text-lg font-medium">Teaming Partner Recommendations</h2>
			<p className="text-sm text-muted-foreground">
				AI-suggested teaming partners based on capability gaps for current opportunities.
			</p>
			<div className="grid grid-cols-2 gap-4">
				<div className="p-4 bg-card rounded-lg border">
					<h3 className="font-medium">CyberSecure Inc</h3>
					<p className="text-sm text-muted-foreground">8(a) Certified, CMMC Level 3</p>
					<div className="mt-2">
						<span className="text-xs text-primary">Fills gap: Security Assessment</span>
					</div>
				</div>
				<div className="p-4 bg-card rounded-lg border">
					<h3 className="font-medium">DataViz Solutions</h3>
					<p className="text-sm text-muted-foreground">SDVOSB, Tableau Partner</p>
					<div className="mt-2">
						<span className="text-xs text-primary">Fills gap: Data Visualization</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function CompetitiveAnalytics() {
	return (
		<div className="space-y-4">
			<h2 className="text-lg font-medium">Competitive Win/Loss Analysis</h2>
			<div className="grid grid-cols-3 gap-4">
				<div className="p-4 bg-card rounded-lg border text-center">
					<div className="text-3xl font-bold text-green-600">67%</div>
					<div className="text-sm text-muted-foreground">Overall Win Rate</div>
				</div>
				<div className="p-4 bg-card rounded-lg border text-center">
					<div className="text-3xl font-bold text-blue-600">42</div>
					<div className="text-sm text-muted-foreground">Competitions Tracked</div>
				</div>
				<div className="p-4 bg-card rounded-lg border text-center">
					<div className="text-3xl font-bold text-purple-600">8</div>
					<div className="text-sm text-muted-foreground">Active Competitors</div>
				</div>
			</div>
			<div className="p-4 bg-card rounded-lg border">
				<h3 className="font-medium mb-4">Head-to-Head Performance</h3>
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span>vs Acme Corp</span>
						<span className="text-green-600">5-2 (71%)</span>
					</div>
					<div className="flex items-center justify-between">
						<span>vs Tech Solutions</span>
						<span className="text-amber-600">3-3 (50%)</span>
					</div>
					<div className="flex items-center justify-between">
						<span>vs Global Services</span>
						<span className="text-red-600">2-4 (33%)</span>
					</div>
				</div>
			</div>
		</div>
	);
}
