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
import { searchProjects, deleteProject, duplicateProject } from "@/lib/actions/past-performance";
import type { Project } from "@/lib/db/schema-past-performance";

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
									onExport={(ids) => console.log("Export:", ids)}
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
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Relevance Calculator</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium">Target Opportunity</label>
						<Input placeholder="Select or enter opportunity" className="mt-1" />
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
					<Button className="w-full">Calculate Relevance</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function RelevanceMatrixPlaceholder() {
	const matrix = [
		{ project: "VA Health Modernization", opportunities: [95, 88, 72] },
		{ project: "DoD Cloud Migration", opportunities: [82, 95, 68] },
		{ project: "DHS Border Systems", opportunities: [75, 78, 92] },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Relevance Matrix</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b">
								<th className="text-left p-2">Project</th>
								<th className="text-center p-2">Opp A</th>
								<th className="text-center p-2">Opp B</th>
								<th className="text-center p-2">Opp C</th>
							</tr>
						</thead>
						<tbody>
							{matrix.map((row) => (
								<tr key={row.project} className="border-b">
									<td className="p-2 font-medium">{row.project}</td>
									{row.opportunities.map((score, idx) => (
										<td key={idx} className="text-center p-2">
											<Badge
												variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"}
											>
												{score}%
											</Badge>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}

function NarrativeGeneratorPlaceholder() {
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
							<Input placeholder="Choose a project" className="mt-1" />
						</div>
						<div>
							<label className="text-sm font-medium">Target Requirements</label>
							<Input placeholder="Enter key requirements to address" className="mt-1" />
						</div>
						<div>
							<label className="text-sm font-medium">Word Limit</label>
							<Input type="number" placeholder="500" className="mt-1" />
						</div>
						<Button className="w-full">
							<FileText className="h-4 w-4 mr-2" />
							Generate Narrative
						</Button>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Generated Narrative Preview</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
						Select a project and requirements to generate a tailored past performance narrative...
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function ReferenceTrackerPlaceholder() {
	const references = [
		{ id: "1", name: "John Smith", title: "Program Manager", org: "Veterans Affairs", project: "VA Health Modernization", lastContact: "2024-01-15", status: "active" },
		{ id: "2", name: "Mary Johnson", title: "CTO", org: "Dept of Defense", project: "DoD Cloud Migration", lastContact: "2024-02-01", status: "active" },
		{ id: "3", name: "Robert Williams", title: "Director", org: "DHS", project: "DHS Border Systems", lastContact: "2023-11-20", status: "needs_update" },
	];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Reference Contacts</h3>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Add Reference
				</Button>
			</div>
			<div className="space-y-4">
				{references.map((ref) => (
					<Card key={ref.id}>
						<CardContent className="p-4">
							<div className="flex items-start justify-between">
								<div>
									<h4 className="font-medium">{ref.name}</h4>
									<p className="text-sm text-muted-foreground">{ref.title} at {ref.org}</p>
									<p className="text-xs text-muted-foreground mt-1">Project: {ref.project}</p>
									<p className="text-xs text-muted-foreground">Last contact: {ref.lastContact}</p>
								</div>
								<Badge
									variant={ref.status === "active" ? "default" : "destructive"}
								>
									{ref.status === "active" ? "Active" : "Needs Update"}
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
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
