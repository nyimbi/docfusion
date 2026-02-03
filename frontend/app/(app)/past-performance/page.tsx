/**
 * Past Performance Page
 *
 * Project history database with CPAR ratings, relevance scoring,
 * narrative generation, and reference tracking.
 */

"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Award,
	Search,
	Plus,
	Upload,
	FolderOpen,
	BarChart,
	FileText,
	Users,
	Star,
	DollarSign,
	Calendar,
	X,
	Loader2,
} from "lucide-react";
import { ProjectDatabase } from "@/components/past-performance/ProjectDatabase";
import {
	searchProjects,
	deleteProject,
	duplicateProject,
	calculateRelevanceScores,
	generateRelevanceMatrix,
	generateCPARNarrative,
	checkReferenceAvailability,
	exportPastPerformanceVolume,
} from "@/lib/actions/past-performance";
import { toast } from "sonner";
import type { Project } from "@/lib/db/schema-past-performance";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getOpportunities } from "@/lib/actions/opportunities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PastPerformancePage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("projects");
	const [showImporter, setShowImporter] = useState(false);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Fetch projects
	const fetchProjects = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await searchProjects({
				query: searchQuery || undefined,
				limit: 100,
				offset: 0,
			});
			if (result.success && result.data) {
				setProjects(result.data.projects as any);
			}
		} catch (error) {
			console.error("Failed to fetch projects:", error);
		} finally {
			setIsLoading(false);
		}
	}, [searchQuery]);

	useEffect(() => {
		const debounce = setTimeout(() => {
			fetchProjects();
		}, 300);
		return () => clearTimeout(debounce);
	}, [fetchProjects]);

	// Handlers for ProjectDatabase
	const handleDeleteProject = async (projectId: string) => {
		await deleteProject(projectId);
		fetchProjects();
	};

	const handleDuplicateProject = async (projectId: string) => {
		const result = await duplicateProject(projectId);
		if (result.success) {
			fetchProjects();
		}
	};

	// Export selected projects as CSV
	const handleExportProjects = (projectIds: string[]) => {
		const selectedProjects = projects.filter((p) => projectIds.includes(p.id));
		if (selectedProjects.length === 0) {
			toast.error("No projects selected for export");
			return;
		}

		// Build CSV content
		const headers = [
			"Name",
			"Customer",
			"Contract Number",
			"Contract Value",
			"Period of Performance",
			"CPAR Rating",
			"Description",
		];
		const rows = selectedProjects.map((p) => [
			p.name,
			p.customerName ?? "",
			p.contractNumber ?? "",
			p.contractValue?.toString() ?? "",
			p.periodOfPerformance?.start && p.periodOfPerformance?.end
				? `${p.periodOfPerformance.start} - ${p.periodOfPerformance.end}`
				: "",
			p.cparRatings?.overall?.toString() ?? "",
			(p.description ?? "").replace(/"/g, '""'),
		]);

		const csvContent = [
			headers.join(","),
			...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
		].join("\n");

		// Download the CSV
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `past-performance-export-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toast.success(`Exported ${selectedProjects.length} project(s) to CSV`);
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<Award className="h-6 w-6 text-primary" />
							Past Performance
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Project database with CPAR ratings and automated narrative generation
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => setShowImporter(true)}
						>
							<Upload className="h-4 w-4 mr-2" />
							Import Projects
						</Button>
						<Button onClick={() => setSelectedProjectId("new")}>
							<Plus className="h-4 w-4 mr-2" />
							Add Project
						</Button>
					</div>
				</div>

				{/* Search */}
				<div className="relative max-w-xl">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search projects by name, customer, contract number..."
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
								value="projects"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<FolderOpen className="h-4 w-4 mr-2" />
								All Projects
							</TabsTrigger>
							<TabsTrigger
								value="relevance"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<BarChart className="h-4 w-4 mr-2" />
								Relevance Scoring
							</TabsTrigger>
							<TabsTrigger
								value="narratives"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<FileText className="h-4 w-4 mr-2" />
								Narrative Generator
							</TabsTrigger>
							<TabsTrigger
								value="references"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Users className="h-4 w-4 mr-2" />
								References
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="projects" className="h-full m-0 p-6">
							{isLoading ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : projects.length > 0 ? (
								<ProjectDatabase
									projects={projects}
									isLoading={isLoading}
									onCreateProject={() => setSelectedProjectId("new")}
									onEditProject={(id) => setSelectedProjectId(id)}
									onDeleteProject={handleDeleteProject}
									onDuplicateProject={handleDuplicateProject}
									onViewProject={(id) => setSelectedProjectId(id)}
									onImport={() => setShowImporter(true)}
									onExport={handleExportProjects}
									onRefresh={fetchProjects}
								/>
							) : (
								<ProjectDatabasePlaceholder
									searchQuery={searchQuery}
									onSelectProject={setSelectedProjectId}
								/>
							)}
						</TabsContent>
						<TabsContent value="relevance" className="h-full m-0 p-6">
							<div className="grid grid-cols-2 gap-6 h-full">
								<RelevanceCalculatorPlaceholder />
								<RelevanceMatrixPlaceholder />
							</div>
						</TabsContent>
						<TabsContent value="narratives" className="h-full m-0 p-6">
							<NarrativeGeneratorPlaceholder />
						</TabsContent>
						<TabsContent value="references" className="h-full m-0 p-6">
							<ReferenceTrackerPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Project Importer Modal */}
			{showImporter && (
				<ProjectImporterPlaceholder onClose={() => setShowImporter(false)} />
			)}

			{/* Project Editor Side Panel */}
			{selectedProjectId && (
				<div className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<ProjectEditorPlaceholder
						projectId={selectedProjectId === "new" ? undefined : selectedProjectId}
						onClose={() => setSelectedProjectId(null)}
					/>
				</div>
			)}
		</div>
	);
}

// Placeholder Components

function ProjectDatabasePlaceholder({
	searchQuery,
	onSelectProject,
}: {
	searchQuery: string;
	onSelectProject: (id: string) => void;
}) {
	const projects = [
		{ id: "1", name: "VA Health Modernization", customer: "Veterans Affairs", value: "$45M", period: "2020-2024", cparRating: "Exceptional", relevance: 95 },
		{ id: "2", name: "DoD Cloud Migration", customer: "Dept of Defense", value: "$32M", period: "2019-2023", cparRating: "Very Good", relevance: 88 },
		{ id: "3", name: "DHS Border Systems", customer: "Homeland Security", value: "$28M", period: "2021-2024", cparRating: "Exceptional", relevance: 82 },
		{ id: "4", name: "NASA Data Analytics", customer: "NASA", value: "$18M", period: "2022-2024", cparRating: "Satisfactory", relevance: 75 },
		{ id: "5", name: "HHS Medicare Portal", customer: "Health & Human Services", value: "$52M", period: "2018-2023", cparRating: "Very Good", relevance: 90 },
	];

	const filtered = searchQuery
		? projects.filter(
				(p) =>
					p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					p.customer.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: projects;

	const getCparColor = (rating: string) => {
		switch (rating) {
			case "Exceptional":
				return "bg-green-500";
			case "Very Good":
				return "bg-blue-500";
			case "Satisfactory":
				return "bg-yellow-500";
			default:
				return "bg-gray-500";
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">{filtered.length} projects found</p>
			</div>
			<div className="space-y-4">
				{filtered.map((project) => (
					<Card
						key={project.id}
						className="cursor-pointer hover:shadow-md transition-shadow"
						onClick={() => onSelectProject(project.id)}
					>
						<CardContent className="p-4">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h4 className="font-medium">{project.name}</h4>
									<p className="text-sm text-muted-foreground">{project.customer}</p>
									<div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
										<span className="flex items-center gap-1">
											<DollarSign className="h-3 w-3" />
											{project.value}
										</span>
										<span className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{project.period}
										</span>
									</div>
								</div>
								<div className="flex flex-col items-end gap-2">
									<Badge className={`${getCparColor(project.cparRating)} text-white`}>
										{project.cparRating}
									</Badge>
									<span className="text-sm text-muted-foreground">{project.relevance}% relevance</span>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function RelevanceCalculatorPlaceholder() {
	const [opportunities, setOpportunities] = useState<Array<{ id: string; title: string }>>([]);
	const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>("");
	const [scores, setScores] = useState<Array<{
		projectId: string;
		projectName: string;
		overallScore: number;
		recencyScore: number;
		sizeScore: number;
		scopeScore: number;
		customerScore: number;
	}>>([]);
	const [isLoadingOpps, setIsLoadingOpps] = useState(true);
	const [isCalculating, setIsCalculating] = useState(false);

	useEffect(() => {
		async function fetchOpportunities() {
			setIsLoadingOpps(true);
			try {
				const result = await getOpportunities(undefined, undefined, { page: 1, pageSize: 50 });
				if (result.data) {
					setOpportunities(result.data.map((o) => ({ id: o.id, title: o.title })));
				}
			} catch (error) {
				console.error("Failed to fetch opportunities:", error);
			} finally {
				setIsLoadingOpps(false);
			}
		}
		fetchOpportunities();
	}, []);

	const handleCalculate = async () => {
		if (!selectedOpportunityId) return;
		setIsCalculating(true);
		try {
			const result = await calculateRelevanceScores(selectedOpportunityId);
			if (result.success && result.data) {
				setScores(
					result.data.slice(0, 10).map((s) => ({
						projectId: s.projectId,
						projectName: s.projectName,
						overallScore: s.overallScore,
						recencyScore: s.recencyScore,
						sizeScore: s.sizeScore,
						scopeScore: s.scopeScore,
						customerScore: s.customerScore,
					}))
				);
			}
		} catch (error) {
			console.error("Failed to calculate relevance:", error);
		} finally {
			setIsCalculating(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Relevance Calculator</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium">Target Opportunity</label>
						{isLoadingOpps ? (
							<Skeleton className="h-10 w-full mt-1" />
						) : (
							<Select value={selectedOpportunityId} onValueChange={setSelectedOpportunityId}>
								<SelectTrigger className="mt-1">
									<SelectValue placeholder="Select an opportunity" />
								</SelectTrigger>
								<SelectContent>
									{opportunities.map((opp) => (
										<SelectItem key={opp.id} value={opp.id}>
											{opp.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					<div className="space-y-2">
						<h4 className="text-sm font-medium">Scoring Factors</h4>
						{[
							{ factor: "Contract Size", weight: 20 },
							{ factor: "Technical Similarity", weight: 30 },
							{ factor: "Customer Type", weight: 25 },
							{ factor: "Recency", weight: 25 },
						].map((item) => (
							<div key={item.factor} className="flex items-center justify-between text-sm">
								<span>{item.factor}</span>
								<span className="text-muted-foreground">{item.weight}% weight</span>
							</div>
						))}
					</div>
					<Button
						className="w-full"
						onClick={handleCalculate}
						disabled={!selectedOpportunityId || isCalculating}
					>
						{isCalculating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Calculating...
							</>
						) : (
							"Calculate Relevance"
						)}
					</Button>
					{scores.length > 0 && (
						<div className="mt-4 pt-4 border-t space-y-2">
							<h4 className="text-sm font-medium">Top Matching Projects</h4>
							{scores.map((score) => (
								<div key={score.projectId} className="flex items-center justify-between text-sm">
									<span className="truncate max-w-[200px]">{score.projectName}</span>
									<Badge variant={score.overallScore >= 80 ? "default" : score.overallScore >= 60 ? "secondary" : "outline"}>
										{score.overallScore.toFixed(0)}%
									</Badge>
								</div>
							))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function RelevanceMatrixPlaceholder() {
	const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([]);
	const [opportunities, setOpportunities] = useState<Array<{ id: string; title: string }>>([]);
	const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
	const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>("");
	const [matrixData, setMatrixData] = useState<Array<{
		projectId: string;
		projectName: string;
		score: number;
		breakdown: Record<string, number>;
	}>>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);

	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				const [projectsResult, oppsResult] = await Promise.all([
					searchProjects({ offset: 0, limit: 20 }),
					getOpportunities(undefined, undefined, { page: 1, pageSize: 20 }),
				]);
				if (projectsResult.success && projectsResult.data) {
					setProjectsList(projectsResult.data.projects.map((p) => ({ id: p.id, name: p.name })));
					// Pre-select first 5 projects
					setSelectedProjectIds(projectsResult.data.projects.slice(0, 5).map((p) => p.id));
				}
				if (oppsResult.data) {
					setOpportunities(oppsResult.data.map((o) => ({ id: o.id, title: o.title })));
				}
			} catch (error) {
				console.error("Failed to fetch data:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchData();
	}, []);

	const handleGenerateMatrix = async () => {
		if (!selectedOpportunityId || selectedProjectIds.length === 0) return;
		setIsGenerating(true);
		try {
			const result = await generateRelevanceMatrix({
				opportunityId: selectedOpportunityId,
				projectIds: selectedProjectIds,
			});
			if (result.success && result.data) {
				setMatrixData(
					result.data.projects.map((ps) => ({
						projectId: ps.projectId,
						projectName: ps.projectName,
						score: ps.overallScore,
						breakdown: {
							size: ps.sizeScore,
							scope: ps.scopeScore,
							recency: ps.recencyScore,
							customer: ps.customerScore,
						},
					}))
				);
			}
		} catch (error) {
			console.error("Failed to generate matrix:", error);
		} finally {
			setIsGenerating(false);
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Relevance Matrix</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-32 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Relevance Matrix</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium">Target Opportunity</label>
						<Select value={selectedOpportunityId} onValueChange={setSelectedOpportunityId}>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select an opportunity" />
							</SelectTrigger>
							<SelectContent>
								{opportunities.map((opp) => (
									<SelectItem key={opp.id} value={opp.id}>
										{opp.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={handleGenerateMatrix}
						disabled={!selectedOpportunityId || selectedProjectIds.length === 0 || isGenerating}
					>
						{isGenerating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							"Generate Matrix"
						)}
					</Button>
					{matrixData.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b">
										<th className="text-left p-2">Project</th>
										<th className="text-center p-2">Score</th>
										<th className="text-center p-2">Size</th>
										<th className="text-center p-2">Scope</th>
										<th className="text-center p-2">Recency</th>
									</tr>
								</thead>
								<tbody>
									{matrixData.map((row) => (
										<tr key={row.projectId} className="border-b">
											<td className="p-2 font-medium truncate max-w-[150px]">{row.projectName}</td>
											<td className="text-center p-2">
												<Badge variant={row.score >= 80 ? "default" : row.score >= 60 ? "secondary" : "outline"}>
													{row.score.toFixed(0)}%
												</Badge>
											</td>
											<td className="text-center p-2 text-muted-foreground">
												{(row.breakdown?.size ?? 0).toFixed(0)}
											</td>
											<td className="text-center p-2 text-muted-foreground">
												{(row.breakdown?.scope ?? 0).toFixed(0)}
											</td>
											<td className="text-center p-2 text-muted-foreground">
												{(row.breakdown?.recency ?? 0).toFixed(0)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-center text-muted-foreground py-4 text-sm">
							Select an opportunity and generate the matrix to see relevance scores.
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function NarrativeGeneratorPlaceholder() {
	const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([]);
	const [selectedProjectId, setSelectedProjectId] = useState<string>("");
	const [generatedNarrative, setGeneratedNarrative] = useState<string>("");
	const [wordCount, setWordCount] = useState<number>(0);
	const [isLoadingProjects, setIsLoadingProjects] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);

	useEffect(() => {
		async function fetchProjects() {
			setIsLoadingProjects(true);
			try {
				const result = await searchProjects({ offset: 0, limit: 50 });
				if (result.success && result.data) {
					setProjectsList(result.data.projects.map((p) => ({ id: p.id, name: p.name })));
				}
			} catch (error) {
				console.error("Failed to fetch projects:", error);
			} finally {
				setIsLoadingProjects(false);
			}
		}
		fetchProjects();
	}, []);

	const handleGenerate = async () => {
		if (!selectedProjectId) return;
		setIsGenerating(true);
		setGeneratedNarrative("");
		try {
			const result = await generateCPARNarrative(selectedProjectId);
			if (result.success && result.data) {
				setGeneratedNarrative(result.data.narrative);
				setWordCount(result.data.wordCount);
			}
		} catch (error) {
			console.error("Failed to generate narrative:", error);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleCopy = () => {
		if (generatedNarrative) {
			navigator.clipboard.writeText(generatedNarrative);
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">AI Narrative Generator</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div>
							<label className="text-sm font-medium">Select Project</label>
							{isLoadingProjects ? (
								<Skeleton className="h-10 w-full mt-1" />
							) : (
								<Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
									<SelectTrigger className="mt-1">
										<SelectValue placeholder="Choose a project" />
									</SelectTrigger>
									<SelectContent>
										{projectsList.map((project) => (
											<SelectItem key={project.id} value={project.id}>
												{project.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
						<Button
							className="w-full"
							onClick={handleGenerate}
							disabled={!selectedProjectId || isGenerating}
						>
							{isGenerating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<FileText className="h-4 w-4 mr-2" />
									Generate CPAR Narrative
								</>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base">Generated Narrative</CardTitle>
					{generatedNarrative && (
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">{wordCount} words</span>
							<Button variant="ghost" size="sm" onClick={handleCopy}>
								Copy
							</Button>
						</div>
					)}
				</CardHeader>
				<CardContent>
					{isGenerating ? (
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
						</div>
					) : generatedNarrative ? (
						<div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
							{generatedNarrative}
						</div>
					) : (
						<div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
							Select a project to generate a tailored CPAR-style past performance narrative...
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function ReferenceTrackerPlaceholder() {
	const [projectsList, setProjectsList] = useState<Array<{
		id: string;
		name: string;
		customerPOC: string | null;
		customerAgency: string | null;
		lastReferenceCheck: string | null;
		referenceStatus: string | null;
	}>>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [checkingId, setCheckingId] = useState<string | null>(null);

	useEffect(() => {
		async function fetchProjects() {
			setIsLoading(true);
			try {
				const result = await searchProjects({ offset: 0, limit: 50 });
				if (result.success && result.data) {
					setProjectsList(
						(result.data.projects as any[])
							.filter((p) => p.customerPOC)
							.map((p) => ({
								id: p.id,
								name: p.name,
								customerPOC: p.customerPOC ?? null,
								customerAgency: p.customerAgency ?? null,
								lastReferenceCheck: p.lastReferenceCheck
									? new Date(p.lastReferenceCheck).toISOString().split("T")[0]
									: null,
								referenceStatus: p.referenceStatus ?? "unknown",
							}))
					);
				}
			} catch (error) {
				console.error("Failed to fetch projects:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchProjects();
	}, []);

	const handleCheckAvailability = async (projectId: string) => {
		setCheckingId(projectId);
		try {
			const result = await checkReferenceAvailability(projectId);
			if (result.success && result.data) {
				const { status, lastChecked } = result.data;
				setProjectsList((prev) =>
					prev.map((p) =>
						p.id === projectId
							? {
									...p,
									referenceStatus: status,
									lastReferenceCheck: lastChecked.split("T")[0],
								}
							: p
					)
				);
			}
		} catch (error) {
			console.error("Failed to check reference:", error);
		} finally {
			setCheckingId(null);
		}
	};

	const getStatusVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
		switch (status) {
			case "available":
				return "default";
			case "pending":
				return "secondary";
			case "unavailable":
				return "destructive";
			default:
				return "outline";
		}
	};

	const getStatusLabel = (status: string | null): string => {
		switch (status) {
			case "available":
				return "Available";
			case "pending":
				return "Pending";
			case "unavailable":
				return "Unavailable";
			default:
				return "Unknown";
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg">Reference Contacts</h3>
				</div>
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="space-y-2">
										<Skeleton className="h-5 w-40" />
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
									<Skeleton className="h-6 w-20" />
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
				<h3 className="font-semibold text-lg">Reference Contacts</h3>
				<span className="text-sm text-muted-foreground">
					{projectsList.length} references tracked
				</span>
			</div>
			{projectsList.length === 0 ? (
				<Card>
					<CardContent className="pt-6 text-center">
						<p className="text-muted-foreground">
							No reference contacts found. Add customer POC information to projects to track references.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{projectsList.map((project) => (
						<Card key={project.id}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div>
										<h4 className="font-medium">{project.customerPOC ?? "Unknown Contact"}</h4>
										<p className="text-sm text-muted-foreground">
											{project.customerAgency ?? "Unknown Agency"}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											Project: {project.name}
										</p>
										<p className="text-xs text-muted-foreground">
											Last checked: {project.lastReferenceCheck ?? "Never"}
										</p>
									</div>
									<div className="flex flex-col items-end gap-2">
										<Badge variant={getStatusVariant(project.referenceStatus)}>
											{getStatusLabel(project.referenceStatus)}
										</Badge>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleCheckAvailability(project.id)}
											disabled={checkingId === project.id}
										>
											{checkingId === project.id ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												"Check"
											)}
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

function ProjectImporterPlaceholder({ onClose }: { onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
			<div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Import Projects</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="border-2 border-dashed rounded-lg p-8 text-center">
					<Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-sm text-muted-foreground mb-2">
						Drag and drop project data files here, or click to browse
					</p>
					<p className="text-xs text-muted-foreground">
						Supports CSV, XLSX, and JSON files
					</p>
				</div>
				<div className="flex justify-end gap-2 mt-4">
					<Button variant="outline" onClick={onClose}>Cancel</Button>
					<Button>Upload</Button>
				</div>
			</div>
		</div>
	);
}

function ProjectEditorPlaceholder({
	projectId,
	onClose,
}: {
	projectId?: string;
	onClose: () => void;
}) {
	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">
					{projectId ? "Edit Project" : "Add Project"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="space-y-4">
				<div>
					<label className="text-sm font-medium">Project Name</label>
					<Input placeholder="Enter project name" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Customer</label>
					<Input placeholder="Enter customer name" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Contract Number</label>
					<Input placeholder="Enter contract number" className="mt-1" />
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Contract Value</label>
						<Input type="text" placeholder="$0" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">CPAR Rating</label>
						<Input placeholder="Select rating" className="mt-1" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Start Date</label>
						<Input type="date" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">End Date</label>
						<Input type="date" className="mt-1" />
					</div>
				</div>
				<div>
					<label className="text-sm font-medium">Description</label>
					<textarea
						className="w-full mt-1 p-2 border rounded-md text-sm"
						rows={4}
						placeholder="Enter project description..."
					/>
				</div>
			</div>
			<div className="flex justify-end gap-2 mt-6">
				<Button variant="outline" onClick={onClose}>Cancel</Button>
				<Button>Save</Button>
			</div>
		</div>
	);
}
