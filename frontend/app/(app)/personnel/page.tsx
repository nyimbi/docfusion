/**
 * Personnel Page
 *
 * Resume & Qualification Database with skills taxonomy, position matching,
 * availability tracking, and certification management.
 */

"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	UserCircle,
	Search,
	Plus,
	Upload,
	Users,
	Award,
	Calendar,
	GitCompare,
	FileText,
	Mail,
	Phone,
	Briefcase,
	X,
	Loader2,
} from "lucide-react";
import { PersonnelDatabase } from "@/components/personnel/PersonnelDatabase";
import { searchPersonnel, type PersonnelAPI } from "@/lib/actions/personnel";

export default function PersonnelPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("database");
	const [showResumeParser, setShowResumeParser] = useState(false);
	const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
	const [personnel, setPersonnel] = useState<PersonnelAPI[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Fetch personnel data
	const fetchPersonnel = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await searchPersonnel(searchQuery, { limit: 100 });
			if (result.success && result.data) {
				setPersonnel(result.data);
			}
		} catch (error) {
			console.error("Failed to fetch personnel:", error);
		} finally {
			setIsLoading(false);
		}
	}, [searchQuery]);

	useEffect(() => {
		const debounce = setTimeout(() => {
			fetchPersonnel();
		}, 300);
		return () => clearTimeout(debounce);
	}, [fetchPersonnel]);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<UserCircle className="h-6 w-6 text-primary" />
							Personnel Database
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Resume management, skills tracking, and position matching
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => setShowResumeParser(true)}
						>
							<Upload className="h-4 w-4 mr-2" />
							Import Resumes
						</Button>
						<Button onClick={() => setSelectedPersonId("new")}>
							<Plus className="h-4 w-4 mr-2" />
							Add Person
						</Button>
					</div>
				</div>

				{/* Search */}
				<div className="relative max-w-xl">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search by name, skills, certifications..."
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
								value="database"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Users className="h-4 w-4 mr-2" />
								All Personnel
							</TabsTrigger>
							<TabsTrigger
								value="skills"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<GitCompare className="h-4 w-4 mr-2" />
								Skills Taxonomy
							</TabsTrigger>
							<TabsTrigger
								value="matching"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<FileText className="h-4 w-4 mr-2" />
								Position Matching
							</TabsTrigger>
							<TabsTrigger
								value="staffing"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Calendar className="h-4 w-4 mr-2" />
								Staffing Matrix
							</TabsTrigger>
							<TabsTrigger
								value="certifications"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Award className="h-4 w-4 mr-2" />
								Certifications
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="database" className="h-full m-0 p-6">
							{isLoading ? (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : personnel.length > 0 ? (
								<PersonnelDatabase
									personnel={personnel as any}
									loading={isLoading}
									onSearch={(query) => setSearchQuery(query)}
									onCreateNew={() => setSelectedPersonId("new")}
									onEdit={(id) => setSelectedPersonId(id)}
								/>
							) : (
								<PersonnelDatabasePlaceholder
									searchQuery={searchQuery}
									onSelectPerson={setSelectedPersonId}
								/>
							)}
						</TabsContent>
						<TabsContent value="skills" className="h-full m-0 p-6">
							<SkillsManagerPlaceholder />
						</TabsContent>
						<TabsContent value="matching" className="h-full m-0 p-6">
							<PositionMatcherPlaceholder />
						</TabsContent>
						<TabsContent value="staffing" className="h-full m-0 p-6">
							<StaffingMatrixPlaceholder />
						</TabsContent>
						<TabsContent value="certifications" className="h-full m-0 p-6">
							<CertificationTrackerPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Resume Parser Modal */}
			{showResumeParser && (
				<ResumeParserPlaceholder onClose={() => setShowResumeParser(false)} />
			)}

			{/* Personnel Editor Side Panel */}
			{selectedPersonId && (
				<div className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<PersonnelEditorPlaceholder
						personnelId={selectedPersonId === "new" ? undefined : selectedPersonId}
						onClose={() => setSelectedPersonId(null)}
					/>
				</div>
			)}
		</div>
	);
}

// Placeholder Components

function PersonnelDatabasePlaceholder({
	searchQuery,
	onSelectPerson,
}: {
	searchQuery: string;
	onSelectPerson: (id: string) => void;
}) {
	const personnel = [
		{ id: "1", name: "Sarah Johnson", title: "Program Manager", skills: ["PMP", "Agile", "DoD"], availability: "Available", yearsExp: 12 },
		{ id: "2", name: "Michael Chen", title: "Solutions Architect", skills: ["AWS", "Azure", "Kubernetes"], availability: "On Project", yearsExp: 8 },
		{ id: "3", name: "Emily Rodriguez", title: "Technical Writer", skills: ["RFP Writing", "Technical Docs", "508 Compliance"], availability: "Available", yearsExp: 6 },
		{ id: "4", name: "David Kim", title: "Security Engineer", skills: ["FISMA", "FedRAMP", "NIST 800-53"], availability: "Partial", yearsExp: 10 },
		{ id: "5", name: "Jennifer Williams", title: "Business Analyst", skills: ["Requirements", "BABOK", "Agile"], availability: "Available", yearsExp: 7 },
	];

	const filtered = searchQuery
		? personnel.filter(
				(p) =>
					p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					p.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
			)
		: personnel;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">{filtered.length} personnel found</p>
			</div>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{filtered.map((person) => (
					<Card
						key={person.id}
						className="cursor-pointer hover:shadow-md transition-shadow"
						onClick={() => onSelectPerson(person.id)}
					>
						<CardContent className="p-4">
							<div className="flex items-start gap-3">
								<Avatar className="h-10 w-10">
									<AvatarFallback>
										{person.name.split(" ").map((n) => n[0]).join("")}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<h4 className="font-medium">{person.name}</h4>
									<p className="text-sm text-muted-foreground">{person.title}</p>
									<p className="text-xs text-muted-foreground">{person.yearsExp} years experience</p>
								</div>
								<Badge
									variant={
										person.availability === "Available"
											? "default"
											: person.availability === "Partial"
											? "secondary"
											: "outline"
									}
									className="text-xs"
								>
									{person.availability}
								</Badge>
							</div>
							<div className="flex flex-wrap gap-1 mt-3">
								{person.skills.slice(0, 3).map((skill) => (
									<Badge key={skill} variant="outline" className="text-xs">
										{skill}
									</Badge>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function SkillsManagerPlaceholder() {
	const skillCategories = [
		{ name: "Technical", count: 45, skills: ["AWS", "Azure", "Python", "Java", "Kubernetes"] },
		{ name: "Management", count: 18, skills: ["PMP", "Agile", "Scrum", "ITIL", "Prince2"] },
		{ name: "Security", count: 22, skills: ["CISSP", "CISM", "FedRAMP", "FISMA", "NIST"] },
		{ name: "Compliance", count: 15, skills: ["FAR/DFARS", "508 Compliance", "ITAR", "EAR"] },
	];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Skills Taxonomy</h3>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Add Category
				</Button>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{skillCategories.map((category) => (
					<Card key={category.name}>
						<CardHeader className="pb-2">
							<CardTitle className="text-base flex items-center justify-between">
								{category.name}
								<Badge variant="secondary">{category.count} skills</Badge>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap gap-2">
								{category.skills.map((skill) => (
									<Badge key={skill} variant="outline">
										{skill}
									</Badge>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function PositionMatcherPlaceholder() {
	const positions = [
		{ title: "Lead Cloud Architect", matches: 5, topMatch: { name: "Michael Chen", score: 95 } },
		{ title: "Program Manager", matches: 3, topMatch: { name: "Sarah Johnson", score: 92 } },
		{ title: "Security Analyst", matches: 4, topMatch: { name: "David Kim", score: 88 } },
	];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Position Matching</h3>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					New Position
				</Button>
			</div>
			<div className="space-y-4">
				{positions.map((position) => (
					<Card key={position.title}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-medium">{position.title}</h4>
									<p className="text-sm text-muted-foreground">
										{position.matches} matching candidates
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm font-medium">{position.topMatch.name}</p>
									<p className="text-xs text-green-600">{position.topMatch.score}% match</p>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function StaffingMatrixPlaceholder() {
	const projects = [
		{ name: "DoD Cloud Migration", staff: 8, needed: 10, status: "understaffed" },
		{ name: "VA Health Portal", staff: 6, needed: 6, status: "fully_staffed" },
		{ name: "DHS Cyber Defense", staff: 4, needed: 5, status: "understaffed" },
	];

	return (
		<div className="space-y-6">
			<h3 className="font-semibold text-lg">Staffing Matrix</h3>
			<div className="space-y-4">
				{projects.map((project) => (
					<Card key={project.name}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-medium">{project.name}</h4>
									<p className="text-sm text-muted-foreground">
										{project.staff} of {project.needed} positions filled
									</p>
								</div>
								<Badge
									variant={project.status === "fully_staffed" ? "default" : "destructive"}
								>
									{project.status === "fully_staffed" ? "Fully Staffed" : "Understaffed"}
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function CertificationTrackerPlaceholder() {
	const certifications = [
		{ name: "PMP", holders: 12, expiringSoon: 2 },
		{ name: "CISSP", holders: 8, expiringSoon: 1 },
		{ name: "AWS Solutions Architect", holders: 15, expiringSoon: 3 },
		{ name: "Secret Clearance", holders: 25, expiringSoon: 0 },
	];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Certification Tracker</h3>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Add Certification
				</Button>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{certifications.map((cert) => (
					<Card key={cert.name}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-medium flex items-center gap-2">
										<Award className="h-4 w-4 text-primary" />
										{cert.name}
									</h4>
									<p className="text-sm text-muted-foreground">
										{cert.holders} certified personnel
									</p>
								</div>
								{cert.expiringSoon > 0 && (
									<Badge variant="destructive" className="text-xs">
										{cert.expiringSoon} expiring soon
									</Badge>
								)}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function ResumeParserPlaceholder({ onClose }: { onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
			<div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Import Resumes</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="border-2 border-dashed rounded-lg p-8 text-center">
					<Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-sm text-muted-foreground mb-2">
						Drag and drop resume files here, or click to browse
					</p>
					<p className="text-xs text-muted-foreground">
						Supports PDF, DOCX, and TXT files
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

function PersonnelEditorPlaceholder({
	personnelId,
	onClose,
}: {
	personnelId?: string;
	onClose: () => void;
}) {
	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">
					{personnelId ? "Edit Personnel" : "Add Personnel"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="space-y-4">
				<div>
					<label className="text-sm font-medium">Full Name</label>
					<Input placeholder="Enter full name" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Title</label>
					<Input placeholder="Enter job title" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Email</label>
					<Input type="email" placeholder="Enter email" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Phone</label>
					<Input type="tel" placeholder="Enter phone number" className="mt-1" />
				</div>
				<div>
					<label className="text-sm font-medium">Years of Experience</label>
					<Input type="number" placeholder="Enter years" className="mt-1" />
				</div>
			</div>
			<div className="flex justify-end gap-2 mt-6">
				<Button variant="outline" onClick={onClose}>Cancel</Button>
				<Button>Save</Button>
			</div>
		</div>
	);
}
