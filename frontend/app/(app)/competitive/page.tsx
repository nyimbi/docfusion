/**
 * Competitive Intelligence Page
 *
 * Competitor database with capabilities tracking, discriminator engine,
 * ghost themes, and teaming recommendations.
 */

"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import {
	Swords,
	Users,
	Target,
	Lightbulb,
	GitCompare,
	TrendingUp,
	X,
} from "lucide-react";

// Import real competitive intelligence components
import { CompetitorList } from "@/components/competitive/CompetitorList";
import { CompetitorForm } from "@/components/competitive/CompetitorForm";
import { DiscriminatorLibrary } from "@/components/competitive/DiscriminatorLibrary";
import { GhostThemeGenerator } from "@/components/competitive/GhostThemeGenerator";
import { WinLossTracker } from "@/components/competitive/WinLossTracker";
// SWOTAnalysis requires opportunityId - use in opportunity detail instead
import type { Competitor } from "@/lib/types/competitive";

export default function CompetitivePage() {
	const [activeTab, setActiveTab] = useState("competitors");
	const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
	const [showCompetitorForm, setShowCompetitorForm] = useState(false);
	const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const handleCompetitorSelect = useCallback((competitor: Competitor) => {
		setSelectedCompetitor(competitor);
	}, []);

	const handleAddCompetitor = useCallback(() => {
		setEditingCompetitor(null);
		setShowCompetitorForm(true);
	}, []);

	const handleEditCompetitor = useCallback((competitor: Competitor) => {
		setEditingCompetitor(competitor);
		setShowCompetitorForm(true);
	}, []);

	const handleCompetitorSaved = useCallback(() => {
		setShowCompetitorForm(false);
		setEditingCompetitor(null);
		setRefreshKey(prev => prev + 1);
	}, []);

	const handleCloseCompetitorForm = useCallback(() => {
		setShowCompetitorForm(false);
		setEditingCompetitor(null);
	}, []);

	const handleCloseDetail = useCallback(() => {
		setSelectedCompetitor(null);
	}, []);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<Swords className="h-6 w-6 text-primary" />
							Competitive Intelligence
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Track competitors, develop discriminators, and identify teaming partners
						</p>
					</div>
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
								SWOT Analysis
							</TabsTrigger>
							<TabsTrigger
								value="analytics"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<TrendingUp className="h-4 w-4 mr-2" />
								Win/Loss Tracking
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto p-6">
						<TabsContent value="competitors" className="h-full m-0">
							<CompetitorList
								key={`competitors-${refreshKey}`}
								onSelect={handleCompetitorSelect}
								showAddButton={true}
								onCompetitorCreated={handleCompetitorSaved}
							/>
						</TabsContent>
						<TabsContent value="discriminators" className="h-full m-0">
							<DiscriminatorLibrary
								showAddButton={true}
							/>
						</TabsContent>
						<TabsContent value="ghost-themes" className="h-full m-0">
							<GhostThemeGenerator
								competitorId={selectedCompetitor?.id}
							/>
						</TabsContent>
						<TabsContent value="teaming" className="h-full m-0">
							{/* SWOTAnalysis requires opportunityId - show placeholder when not in opportunity context */}
							<div className="h-full flex flex-col items-center justify-center text-center p-8">
								<GitCompare className="h-16 w-16 text-muted-foreground/30 mb-4" />
								<h3 className="text-lg font-medium mb-2">SWOT Analysis</h3>
								<p className="text-sm text-muted-foreground max-w-md">
									SWOT analysis is available in the opportunity detail view where you can analyze
									strengths, weaknesses, opportunities, and threats relative to a specific pursuit.
								</p>
								<Button
									variant="outline"
									className="mt-4"
									onClick={() => window.location.href = "/opportunities"}
								>
									Go to Opportunities
								</Button>
							</div>
						</TabsContent>
						<TabsContent value="analytics" className="h-full m-0">
							<WinLossTracker
								competitorId={selectedCompetitor?.id}
							/>
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Competitor Form Modal */}
			{showCompetitorForm && (
				<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
					<div className="bg-background rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
						<CompetitorForm
							competitor={editingCompetitor ?? undefined}
							onSubmit={handleCompetitorSaved}
							onCancel={handleCloseCompetitorForm}
						/>
					</div>
				</div>
			)}

			{/* Competitor Detail Side Panel */}
			{selectedCompetitor && (
				<div className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<div className="p-6">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-lg font-semibold">{selectedCompetitor.name}</h2>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleEditCompetitor(selectedCompetitor)}
								>
									Edit
								</Button>
								<Button variant="ghost" size="sm" onClick={handleCloseDetail}>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Competitor Details */}
						<div className="space-y-6">
							<div>
								<h3 className="text-sm font-medium text-muted-foreground mb-2">Type</h3>
								<p>{selectedCompetitor.competitorType || "Not specified"}</p>
							</div>

							{selectedCompetitor.naicsCodes && selectedCompetitor.naicsCodes.length > 0 && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground mb-2">NAICS Codes</h3>
									<div className="flex flex-wrap gap-1">
										{selectedCompetitor.naicsCodes.map((code, i) => (
											<span key={i} className="px-2 py-1 bg-muted rounded text-sm">
												{code}
											</span>
										))}
									</div>
								</div>
							)}

							{selectedCompetitor.capabilities && selectedCompetitor.capabilities.length > 0 && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground mb-2">Capabilities</h3>
									<div className="flex flex-wrap gap-1">
										{(selectedCompetitor.capabilities as Array<{ area: string; strength: string; notes?: string }>).map((cap, i) => (
											<span
												key={i}
												className={`px-2 py-1 rounded text-sm ${
													cap.strength === "strong"
														? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
														: cap.strength === "moderate"
														? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
														: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
												}`}
												title={cap.notes || `Strength: ${cap.strength}`}
											>
												{cap.area}
											</span>
										))}
									</div>
								</div>
							)}

							{selectedCompetitor.strengths && selectedCompetitor.strengths.length > 0 && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground mb-2">Strengths</h3>
									<ul className="list-disc list-inside space-y-1 text-sm">
										{selectedCompetitor.strengths.map((s, i) => (
											<li key={i}>{s}</li>
										))}
									</ul>
								</div>
							)}

							{selectedCompetitor.weaknesses && selectedCompetitor.weaknesses.length > 0 && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground mb-2">Weaknesses</h3>
									<ul className="list-disc list-inside space-y-1 text-sm">
										{selectedCompetitor.weaknesses.map((w, i) => (
											<li key={i}>{w}</li>
										))}
									</ul>
								</div>
							)}

							<div className="pt-4 border-t">
								<h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setActiveTab("ghost-themes");
										}}
									>
										<Lightbulb className="h-4 w-4 mr-2" />
										Generate Ghost Theme
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setActiveTab("teaming");
										}}
									>
										<GitCompare className="h-4 w-4 mr-2" />
										SWOT Analysis
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
