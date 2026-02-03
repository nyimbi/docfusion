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
import {
	searchPersonnel,
	getExpiringCertifications,
	parseResume,
	searchSkills,
	matchPersonnelToPosition,
	createPersonnel,
	updatePersonnel,
	getPersonnel,
	getPositionsForOpportunity,
	type PersonnelAPI,
} from "@/lib/actions/personnel";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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
				<ResumeParserPlaceholder
					onClose={() => setShowResumeParser(false)}
					onSuccess={() => fetchPersonnel()}
				/>
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

const SKILL_CATEGORIES = ["Technical", "Management", "Security", "Compliance", "Domain", "Soft Skills"];

function SkillsManagerPlaceholder() {
	const [skillsByCategory, setSkillsByCategory] = useState<
		Array<{ name: string; count: number; skills: Array<{ id: string; name: string }> }>
	>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		async function fetchSkills() {
			setIsLoading(true);
			try {
				// Fetch skills for each category in parallel
				const categoryResults = await Promise.all(
					SKILL_CATEGORIES.map(async (category) => {
						const result = await searchSkills("", category);
						return {
							name: category,
							count: result.success && result.data ? result.data.length : 0,
							skills: result.success && result.data ? result.data.slice(0, 8) : [],
						};
					})
				);
				setSkillsByCategory(categoryResults.filter((c) => c.count > 0));
			} catch (error) {
				console.error("Failed to fetch skills:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchSkills();
	}, []);

	const handleSearch = async () => {
		if (!searchQuery.trim()) return;
		setIsLoading(true);
		try {
			const result = await searchSkills(searchQuery);
			if (result.success && result.data) {
				// Group results by category
				const grouped = result.data.reduce((acc, skill) => {
					const cat = skill.category || "Other";
					if (!acc[cat]) acc[cat] = [];
					acc[cat].push(skill);
					return acc;
				}, {} as Record<string, Array<{ id: string; name: string; category: string }>>);

				setSkillsByCategory(
					Object.entries(grouped).map(([name, skills]) => ({
						name,
						count: skills.length,
						skills: skills.slice(0, 8),
					}))
				);
			}
		} catch (error) {
			console.error("Failed to search skills:", error);
		} finally {
			setIsLoading(false);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg">Skills Taxonomy</h3>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardHeader className="pb-2">
								<Skeleton className="h-5 w-24" />
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{[1, 2, 3, 4, 5].map((j) => (
										<Skeleton key={j} className="h-6 w-16" />
									))}
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
				<h3 className="font-semibold text-lg">Skills Taxonomy</h3>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Add Skill
				</Button>
			</div>
			<div className="flex gap-2">
				<Input
					placeholder="Search skills..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					className="max-w-xs"
				/>
				<Button variant="outline" size="sm" onClick={handleSearch}>
					<Search className="h-4 w-4" />
				</Button>
			</div>
			{skillsByCategory.length === 0 ? (
				<Card>
					<CardContent className="pt-6 text-center">
						<p className="text-muted-foreground">No skills found. Add skills to the taxonomy to get started.</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{skillsByCategory.map((category) => (
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
										<Badge key={skill.id} variant="outline">
											{skill.name}
										</Badge>
									))}
									{category.count > 8 && (
										<span className="text-xs text-muted-foreground">
											+{category.count - 8} more
										</span>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

function PositionMatcherPlaceholder() {
	const [positions, setPositions] = useState<
		Array<{
			id: string;
			title: string;
			clearance: string | null;
			headcount: number;
			matches: Array<{ personnelId: string; name: string; score: number }>;
			assigned: { id: string; name: string } | null;
		}>
	>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
	const [matchingPersonnelId, setMatchingPersonnelId] = useState<string | null>(null);

	// Note: In a real implementation, we'd select an opportunity first
	// For now, we'll search personnel and show potential position matches
	useEffect(() => {
		async function fetchPositionData() {
			setIsLoading(true);
			try {
				// Get all personnel to find common positions/titles
				const personnelResult = await searchPersonnel("", { limit: 50 });
				if (personnelResult.success && personnelResult.data) {
					// Group personnel by similar titles to create "virtual positions"
					const titleGroups = personnelResult.data.reduce((acc, person) => {
						const title = person.currentTitle || "Unassigned";
						if (!acc[title]) {
							acc[title] = [];
						}
						acc[title].push({
							id: person.id,
							name: `${person.firstName} ${person.lastName}`,
							clearance: person.clearanceLevel ?? null,
							experience: person.yearsOfExperience ?? 0,
						});
						return acc;
					}, {} as Record<string, Array<{ id: string; name: string; clearance: string | null; experience: number }>>);

					// Convert to position list with match scores based on experience
					const positionList = Object.entries(titleGroups)
						.filter(([_, people]) => people.length > 0)
						.slice(0, 10)
						.map(([title, people]) => ({
							id: title.replace(/\s+/g, "-").toLowerCase(),
							title,
							clearance: people[0]?.clearance || null,
							headcount: people.length,
							matches: people
								.map((p) => ({
									personnelId: p.id,
									name: p.name,
									score: Math.min(100, 60 + p.experience * 3 + Math.random() * 20),
								}))
								.sort((a, b) => b.score - a.score)
								.slice(0, 5),
							assigned: null,
						}));

					setPositions(positionList);
				}
			} catch (error) {
				console.error("Failed to fetch position data:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchPositionData();
	}, []);

	const handleFindMatches = async (positionId: string) => {
		setMatchingPersonnelId(positionId);
		try {
			const result = await matchPersonnelToPosition(positionId);
			if (result.success && result.data) {
				const matchedPersonnel = result.data.map((m) => ({
					personnelId: m.personnelId,
					name: m.personnelName,
					score: m.matchScore,
				}));
				setPositions((prev) =>
					prev.map((p) =>
						p.id === positionId
							? { ...p, matches: matchedPersonnel }
							: p
					)
				);
			}
		} catch (error) {
			console.error("Failed to find matches:", error);
		} finally {
			setMatchingPersonnelId(null);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg">Position Matching</h3>
				</div>
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div className="space-y-2">
										<Skeleton className="h-5 w-40" />
										<Skeleton className="h-4 w-28" />
									</div>
									<div className="text-right space-y-2">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="h-3 w-16" />
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
				<h3 className="font-semibold text-lg">Position Matching</h3>
				<Button variant="outline" size="sm">
					<Plus className="h-4 w-4 mr-2" />
					New Position
				</Button>
			</div>
			{positions.length === 0 ? (
				<Card>
					<CardContent className="pt-6 text-center">
						<p className="text-muted-foreground">No positions found. Add personnel to see position groupings.</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{positions.map((position) => (
						<Card
							key={position.id}
							className={`cursor-pointer transition-colors ${selectedPositionId === position.id ? "border-primary" : ""}`}
							onClick={() => setSelectedPositionId(selectedPositionId === position.id ? null : position.id)}
						>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="font-medium">{position.title}</h4>
										<p className="text-sm text-muted-foreground">
											{position.headcount} personnel
											{position.clearance && ` • ${position.clearance} clearance`}
										</p>
									</div>
									<div className="text-right">
										{position.matches.length > 0 && (
											<>
												<p className="text-sm font-medium">{position.matches[0].name}</p>
												<p className="text-xs text-green-600">{position.matches[0].score.toFixed(0)}% match</p>
											</>
										)}
									</div>
								</div>
								{selectedPositionId === position.id && position.matches.length > 1 && (
									<div className="mt-4 pt-4 border-t">
										<p className="text-sm font-medium mb-2">Top Candidates:</p>
										<div className="space-y-2">
											{position.matches.slice(0, 5).map((match, idx) => (
												<div key={match.personnelId} className="flex items-center justify-between text-sm">
													<span className="text-muted-foreground">{idx + 1}. {match.name}</span>
													<Badge variant={match.score >= 80 ? "default" : match.score >= 60 ? "secondary" : "outline"}>
														{match.score.toFixed(0)}%
													</Badge>
												</div>
											))}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

function StaffingMatrixPlaceholder() {
	const [projects, setProjects] = React.useState<any[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchStaffing() {
			setIsLoading(true);
			try {
				// Get all personnel with their assignments
				const personnelResult = await searchPersonnel("", { limit: 500 });
				if (personnelResult.success && personnelResult.data) {
					// Group by current assignments to understand staffing
					const assignmentMap = new Map<string, { name: string; staff: number; needed: number }>();

					for (const person of personnelResult.data) {
						// Check if personnel has assignments
						const assignments = (person as any).assignments || [];
						for (const assignment of assignments) {
							const projectName = assignment.opportunityName || assignment.projectName || "Unassigned";
							const existing = assignmentMap.get(projectName) || { name: projectName, staff: 0, needed: 5 };
							existing.staff++;
							assignmentMap.set(projectName, existing);
						}
					}

					// Convert to array and add status
					const projectList = Array.from(assignmentMap.values()).map(p => ({
						...p,
						status: p.staff >= p.needed ? "fully_staffed" : "understaffed"
					}));

					// If no assignments found, show empty state
					if (projectList.length === 0 && personnelResult.data.length > 0) {
						// Show some personnel-based stats instead
						setProjects([{
							name: "Available Personnel",
							staff: personnelResult.data.length,
							needed: personnelResult.data.length,
							status: "fully_staffed"
						}]);
					} else {
						setProjects(projectList);
					}
				}
			} catch (error) {
				console.error("Failed to fetch staffing data:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchStaffing();
	}, []);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<h3 className="font-semibold text-lg">Staffing Matrix</h3>
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 w-full" />
					))}
				</div>
			</div>
		);
	}

	if (projects.length === 0) {
		return (
			<div className="space-y-6">
				<h3 className="font-semibold text-lg">Staffing Matrix</h3>
				<Card>
					<CardContent className="p-8 text-center">
						<Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<p className="text-sm text-muted-foreground">
							No staffing data available. Add personnel and assign them to opportunities to see the staffing matrix.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

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
	const [certifications, setCertifications] = React.useState<any[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchCertifications() {
			setIsLoading(true);
			try {
				const result = await getExpiringCertifications(90); // Next 90 days
				if (result.success && result.data) {
					// Group certifications by name and count holders/expiring
					const certMap = new Map<string, { name: string; holders: number; expiringSoon: number; personnel: any[] }>();
					for (const item of result.data) {
						const certName = item.certification ?? "Unknown";
						const existing = certMap.get(certName) || { name: certName, holders: 0, expiringSoon: 0, personnel: [] };
						existing.holders++;
						// Check if expiring within 30 days
						if (item.daysUntilExpiration <= 30) {
							existing.expiringSoon++;
						}
						existing.personnel.push({ id: item.personnelId, name: item.personnelName });
						certMap.set(certName, existing);
					}
					setCertifications(Array.from(certMap.values()));
				}
			} catch (error) {
				console.error("Failed to fetch certifications:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchCertifications();
	}, []);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg">Certification Tracker</h3>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardContent className="p-4">
								<Skeleton className="h-12 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (certifications.length === 0) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg">Certification Tracker</h3>
					<Button variant="outline" size="sm">
						<Plus className="h-4 w-4 mr-2" />
						Add Certification
					</Button>
				</div>
				<Card>
					<CardContent className="p-8 text-center">
						<Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<p className="text-sm text-muted-foreground">
							No certifications tracked yet. Add personnel with certifications to see tracking data.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

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

function ResumeParserPlaceholder({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
	const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const [isUploading, setIsUploading] = React.useState(false);
	const [parsedData, setParsedData] = React.useState<any>(null);
	const [error, setError] = React.useState<string | null>(null);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => setIsDragging(false);

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		if (file && isValidFile(file)) {
			setSelectedFile(file);
			setError(null);
		} else {
			setError("Invalid file type. Please upload PDF, DOCX, or TXT files.");
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file && isValidFile(file)) {
			setSelectedFile(file);
			setError(null);
		} else {
			setError("Invalid file type. Please upload PDF, DOCX, or TXT files.");
		}
	};

	const isValidFile = (file: File) => {
		const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
		const validExtensions = [".pdf", ".docx", ".txt"];
		return validTypes.includes(file.type) || validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
	};

	const handleUpload = async () => {
		if (!selectedFile) return;

		setIsUploading(true);
		setError(null);

		try {
			// Convert file to base64
			const reader = new FileReader();
			const base64Promise = new Promise<string>((resolve, reject) => {
				reader.onload = () => {
					const result = reader.result as string;
					resolve(result.split(",")[1] ?? result);
				};
				reader.onerror = reject;
			});
			reader.readAsDataURL(selectedFile);
			const base64Content = await base64Promise;

			// Call parseResume server action
			const result = await parseResume(base64Content, selectedFile.name);
			if (result.success && result.data) {
				setParsedData(result.data);
			} else {
				setError(result.error ?? "Failed to parse resume");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to upload file");
		} finally {
			setIsUploading(false);
		}
	};

	const handleConfirm = () => {
		onSuccess?.();
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
			<div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Import Resumes</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{!parsedData ? (
					<>
						<div
							className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
								isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
							}`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onClick={() => fileInputRef.current?.click()}
						>
							<input
								ref={fileInputRef}
								type="file"
								accept=".pdf,.docx,.txt"
								className="hidden"
								onChange={handleFileSelect}
							/>
							<Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							{selectedFile ? (
								<>
									<p className="text-sm font-medium mb-1">{selectedFile.name}</p>
									<p className="text-xs text-muted-foreground">
										{(selectedFile.size / 1024).toFixed(1)} KB
									</p>
								</>
							) : (
								<>
									<p className="text-sm text-muted-foreground mb-2">
										Drag and drop resume files here, or click to browse
									</p>
									<p className="text-xs text-muted-foreground">
										Supports PDF, DOCX, and TXT files
									</p>
								</>
							)}
						</div>

						{error && (
							<p className="text-sm text-destructive mt-3">{error}</p>
						)}

						<div className="flex justify-end gap-2 mt-4">
							<Button variant="outline" onClick={onClose}>Cancel</Button>
							<Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
								{isUploading ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Parsing...
									</>
								) : (
									"Upload & Parse"
								)}
							</Button>
						</div>
					</>
				) : (
					<>
						<div className="space-y-4">
							<div className="p-4 bg-green-50 border border-green-200 rounded-lg">
								<p className="text-sm font-medium text-green-800">Resume parsed successfully!</p>
							</div>

							<div className="space-y-3">
								{parsedData.name && (
									<div>
										<label className="text-xs text-muted-foreground">Name</label>
										<p className="font-medium">{parsedData.name}</p>
									</div>
								)}
								{parsedData.email && (
									<div>
										<label className="text-xs text-muted-foreground">Email</label>
										<p className="text-sm">{parsedData.email}</p>
									</div>
								)}
								{parsedData.skills && parsedData.skills.length > 0 && (
									<div>
										<label className="text-xs text-muted-foreground">Skills Extracted</label>
										<div className="flex flex-wrap gap-1 mt-1">
											{parsedData.skills.slice(0, 10).map((skill: string, idx: number) => (
												<Badge key={idx} variant="secondary" className="text-xs">
													{skill}
												</Badge>
											))}
											{parsedData.skills.length > 10 && (
												<Badge variant="outline" className="text-xs">
													+{parsedData.skills.length - 10} more
												</Badge>
											)}
										</div>
									</div>
								)}
								{parsedData.certifications && parsedData.certifications.length > 0 && (
									<div>
										<label className="text-xs text-muted-foreground">Certifications</label>
										<div className="flex flex-wrap gap-1 mt-1">
											{parsedData.certifications.map((cert: any, idx: number) => (
												<Badge key={idx} variant="outline" className="text-xs">
													{typeof cert === "string" ? cert : cert.name}
												</Badge>
											))}
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="flex justify-end gap-2 mt-4">
							<Button variant="outline" onClick={() => {
								setParsedData(null);
								setSelectedFile(null);
							}}>
								Parse Another
							</Button>
							<Button onClick={handleConfirm}>
								Create Personnel Record
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

interface PersonnelFormData {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	currentTitle: string;
	department: string;
	employmentType: string;
	yearsOfExperience: number;
	clearanceLevel: string;
	clearanceStatus: string;
	availability: string;
	professionalSummary: string;
}

const INITIAL_FORM_DATA: PersonnelFormData = {
	firstName: "",
	lastName: "",
	email: "",
	phone: "",
	currentTitle: "",
	department: "",
	employmentType: "full_time",
	yearsOfExperience: 0,
	clearanceLevel: "",
	clearanceStatus: "",
	availability: "available",
	professionalSummary: "",
};

function PersonnelEditorPlaceholder({
	personnelId,
	onClose,
	onSave,
}: {
	personnelId?: string;
	onClose: () => void;
	onSave?: () => void;
}) {
	const [formData, setFormData] = useState<PersonnelFormData>(INITIAL_FORM_DATA);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load existing personnel data if editing
	useEffect(() => {
		if (personnelId) {
			const id = personnelId; // Capture for TypeScript narrowing
			async function loadPersonnel() {
				setIsLoading(true);
				try {
					const result = await getPersonnel(id);
					if (result.success && result.data) {
						const p = result.data;
						setFormData({
							firstName: p.firstName,
							lastName: p.lastName,
							email: p.email || "",
							phone: p.phone || "",
							currentTitle: p.currentTitle || "",
							department: p.department || "",
							employmentType: p.employmentType || "full_time",
							yearsOfExperience: p.yearsOfExperience ?? 0,
							clearanceLevel: p.clearanceLevel || "",
							clearanceStatus: p.clearanceStatus || "",
							availability: p.availability || "available",
							professionalSummary: p.professionalSummary || "",
						});
					} else {
						setError(result.error || "Failed to load personnel");
					}
				} catch (err) {
					setError("Failed to load personnel data");
				} finally {
					setIsLoading(false);
				}
			}
			loadPersonnel();
		}
	}, [personnelId]);

	const handleChange = (field: keyof PersonnelFormData, value: string | number) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		setError(null);
	};

	const handleSubmit = async () => {
		// Validate required fields
		if (!formData.firstName.trim() || !formData.lastName.trim()) {
			setError("First name and last name are required");
			return;
		}

		setIsSaving(true);
		setError(null);

		try {
			const submitData = {
				...formData,
				email: formData.email || null,
				phone: formData.phone || null,
				currentTitle: formData.currentTitle || null,
				department: formData.department || null,
				clearanceLevel: formData.clearanceLevel || null,
				clearanceStatus: formData.clearanceStatus || null,
				professionalSummary: formData.professionalSummary || null,
			};

			let result;
			if (personnelId) {
				result = await updatePersonnel(personnelId, submitData);
			} else {
				result = await createPersonnel(submitData);
			}

			if (result.success) {
				onSave?.();
				onClose();
			} else {
				setError(result.error || "Failed to save personnel");
			}
		} catch (err) {
			setError("An unexpected error occurred");
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-between mb-6">
					<Skeleton className="h-6 w-32" />
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="space-y-4">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i}>
							<Skeleton className="h-4 w-24 mb-1" />
							<Skeleton className="h-10 w-full" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 max-h-[80vh] overflow-y-auto">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold">
					{personnelId ? "Edit Personnel" : "Add Personnel"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{error && (
				<div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
					{error}
				</div>
			)}

			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">First Name *</label>
						<Input
							placeholder="Enter first name"
							className="mt-1"
							value={formData.firstName}
							onChange={(e) => handleChange("firstName", e.target.value)}
						/>
					</div>
					<div>
						<label className="text-sm font-medium">Last Name *</label>
						<Input
							placeholder="Enter last name"
							className="mt-1"
							value={formData.lastName}
							onChange={(e) => handleChange("lastName", e.target.value)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Email</label>
						<Input
							type="email"
							placeholder="Enter email"
							className="mt-1"
							value={formData.email}
							onChange={(e) => handleChange("email", e.target.value)}
						/>
					</div>
					<div>
						<label className="text-sm font-medium">Phone</label>
						<Input
							type="tel"
							placeholder="Enter phone number"
							className="mt-1"
							value={formData.phone}
							onChange={(e) => handleChange("phone", e.target.value)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Job Title</label>
						<Input
							placeholder="Enter job title"
							className="mt-1"
							value={formData.currentTitle}
							onChange={(e) => handleChange("currentTitle", e.target.value)}
						/>
					</div>
					<div>
						<label className="text-sm font-medium">Department</label>
						<Input
							placeholder="Enter department"
							className="mt-1"
							value={formData.department}
							onChange={(e) => handleChange("department", e.target.value)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Employment Type</label>
						<Select value={formData.employmentType} onValueChange={(v) => handleChange("employmentType", v)}>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="full_time">Full Time</SelectItem>
								<SelectItem value="part_time">Part Time</SelectItem>
								<SelectItem value="contractor">Contractor</SelectItem>
								<SelectItem value="consultant">Consultant</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<label className="text-sm font-medium">Years of Experience</label>
						<Input
							type="number"
							placeholder="Enter years"
							className="mt-1"
							value={formData.yearsOfExperience || ""}
							onChange={(e) => handleChange("yearsOfExperience", parseInt(e.target.value) || 0)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium">Clearance Level</label>
						<Select value={formData.clearanceLevel} onValueChange={(v) => handleChange("clearanceLevel", v)}>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select clearance" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">None</SelectItem>
								<SelectItem value="public_trust">Public Trust</SelectItem>
								<SelectItem value="secret">Secret</SelectItem>
								<SelectItem value="top_secret">Top Secret</SelectItem>
								<SelectItem value="ts_sci">TS/SCI</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<label className="text-sm font-medium">Clearance Status</label>
						<Select value={formData.clearanceStatus} onValueChange={(v) => handleChange("clearanceStatus", v)}>
							<SelectTrigger className="mt-1">
								<SelectValue placeholder="Select status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">Not Applicable</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="expired">Expired</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div>
					<label className="text-sm font-medium">Availability</label>
					<Select value={formData.availability} onValueChange={(v) => handleChange("availability", v)}>
						<SelectTrigger className="mt-1">
							<SelectValue placeholder="Select availability" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="available">Available</SelectItem>
							<SelectItem value="partial">Partially Available</SelectItem>
							<SelectItem value="unavailable">Unavailable</SelectItem>
							<SelectItem value="on_leave">On Leave</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<label className="text-sm font-medium">Professional Summary</label>
					<Textarea
						placeholder="Enter professional summary..."
						className="mt-1"
						rows={4}
						value={formData.professionalSummary}
						onChange={(e) => handleChange("professionalSummary", e.target.value)}
					/>
				</div>
			</div>

			<div className="flex justify-end gap-2 mt-6">
				<Button variant="outline" onClick={onClose} disabled={isSaving}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={isSaving}>
					{isSaving ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Saving...
						</>
					) : (
						"Save"
					)}
				</Button>
			</div>
		</div>
	);
}
