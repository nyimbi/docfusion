/**
 * CV Builder Component - DocFusion
 *
 * Create and edit team member CVs/resumes.
 * Fetches and saves data using server actions.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Plus,
	Trash2,
	Save,
	FileText,
	Briefcase,
	GraduationCap,
	Award,
	Globe,
	BookOpen,
	Loader2,
} from "lucide-react";
import { getCVs, createCV, updateCV } from "@/lib/actions/cv";
import type {
	CV,
	CVExperience,
	CVEducation,
	CVSkill,
	CVProject,
	CVLanguage,
} from "@/lib/types/company";

// ============================================================================
// Main Component
// ============================================================================

export function CVBuilder() {
	const [cvList, setCvList] = useState<CV[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [selectedCvId, setSelectedCvId] = useState<string | null>(null);
	const [cv, setCv] = useState<Partial<CV>>({
		fullName: "",
		title: "",
		email: "",
		phone: "",
		summary: "",
		experience: [],
		education: [],
		skills: [],
		certifications: [],
		projects: [],
		languages: [],
		publications: [],
	});

	// Load CVs on mount
	useEffect(() => {
		async function loadData() {
			try {
				const data = await getCVs();
				setCvList(data);
				if (data.length > 0) {
					setSelectedCvId(data[0].id);
					setCv(data[0]);
				}
			} catch (error) {
				console.error("Failed to load CVs:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadData();
	}, []);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			if (selectedCvId) {
				const updated = await updateCV(selectedCvId, {
					fullName: cv.fullName,
					title: cv.title ?? undefined,
					summary: cv.summary ?? undefined,
					experience: cv.experience,
					education: cv.education,
					skills: cv.skills,
					certifications: cv.certifications,
					projects: cv.projects,
					languages: cv.languages,
					publications: cv.publications,
					email: cv.email ?? undefined,
					phone: cv.phone ?? undefined,
					linkedinUrl: cv.linkedinUrl ?? undefined,
					portfolioUrl: cv.portfolioUrl ?? undefined,
				});
				setCvList(cvList.map((c) => (c.id === selectedCvId ? updated : c)));
			} else {
				const created = await createCV({
					fullName: cv.fullName || "",
					title: cv.title ?? undefined,
					summary: cv.summary ?? undefined,
					experience: cv.experience,
					education: cv.education,
					skills: cv.skills,
					certifications: cv.certifications,
					projects: cv.projects,
					languages: cv.languages,
					publications: cv.publications,
					email: cv.email ?? undefined,
					phone: cv.phone ?? undefined,
					linkedinUrl: cv.linkedinUrl ?? undefined,
					portfolioUrl: cv.portfolioUrl ?? undefined,
				});
				setCvList([...cvList, created]);
				setSelectedCvId(created.id);
			}
		} catch (error) {
			console.error("Failed to save CV:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const updateField = (field: keyof CV, value: unknown) => {
		setCv({ ...cv, [field]: value });
	};

	const addItem = <T,>(field: keyof CV, item: T) => {
		const current = (cv[field] as T[]) || [];
		updateField(field, [...current, item]);
	};

	const updateItem = <T,>(field: keyof CV, index: number, item: T) => {
		const current = (cv[field] as T[]) || [];
		const updated = [...current];
		updated[index] = item;
		updateField(field, updated);
	};

	const removeItem = (field: keyof CV, index: number) => {
		const current = (cv[field] as unknown[]) || [];
		updateField(field, current.filter((_, i) => i !== index));
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					<h2 className="text-lg font-semibold">Team CVs</h2>
				</div>
				<Button onClick={handleSave}>
					<Save className="h-4 w-4 mr-2" />
					Save CV
				</Button>
			</div>

			{/* Basic Info */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Basic Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>Full Name</Label>
						<Input
							value={cv.fullName || ""}
							onChange={(e) => updateField("fullName", e.target.value)}
							placeholder="John Doe"
						/>
					</div>
					<div className="space-y-2">
						<Label>Professional Title</Label>
						<Input
							value={cv.title || ""}
							onChange={(e) => updateField("title", e.target.value)}
							placeholder="Senior Consultant"
						/>
					</div>
					<div className="space-y-2">
						<Label>Email</Label>
						<Input
							type="email"
							value={cv.email || ""}
							onChange={(e) => updateField("email", e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>Phone</Label>
						<Input
							value={cv.phone || ""}
							onChange={(e) => updateField("phone", e.target.value)}
						/>
					</div>
					<div className="col-span-2 space-y-2">
						<Label>Professional Summary</Label>
						<Textarea
							value={cv.summary || ""}
							onChange={(e) => updateField("summary", e.target.value)}
							rows={4}
							placeholder="Brief overview of your career and expertise..."
						/>
					</div>
				</CardContent>
			</Card>

			{/* Experience */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base flex items-center gap-2">
						<Briefcase className="h-4 w-4" />
						Work Experience
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							addItem("experience", {
								company: "",
								title: "",
								startDate: "",
								endDate: "",
								isCurrent: false,
								description: "",
							} as CVExperience)
						}
					>
						<Plus className="h-4 w-4 mr-1" />
						Add
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{(cv.experience || []).map((exp, index) => (
						<div key={index} className="p-4 border rounded-lg space-y-3">
							<div className="flex justify-between items-start">
								<div className="flex-1 grid grid-cols-2 gap-3">
									<Input
										value={exp.company}
										onChange={(e) =>
											updateItem("experience", index, {
												...exp,
												company: e.target.value,
											})
										}
										placeholder="Company"
									/>
									<Input
										value={exp.title}
										onChange={(e) =>
											updateItem("experience", index, {
												...exp,
												title: e.target.value,
											})
										}
										placeholder="Position"
									/>
									<Input
										value={exp.startDate}
										onChange={(e) =>
											updateItem("experience", index, {
												...exp,
												startDate: e.target.value,
											})
										}
										placeholder="Start Date"
									/>
									<Input
										value={exp.endDate}
										onChange={(e) =>
											updateItem("experience", index, {
												...exp,
												endDate: e.target.value,
											})
										}
										placeholder="End Date (or Present)"
									/>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => removeItem("experience", index)}
									className="text-destructive ml-2"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Textarea
								value={exp.description || ""}
								onChange={(e) =>
									updateItem("experience", index, {
										...exp,
										description: e.target.value,
									})
								}
								placeholder="Description of responsibilities and achievements..."
								rows={2}
							/>
						</div>
					))}
					{(cv.experience || []).length === 0 && (
						<p className="text-center text-muted-foreground py-4">
							No work experience added yet.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Education */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base flex items-center gap-2">
						<GraduationCap className="h-4 w-4" />
						Education
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							addItem("education", {
								institution: "",
								degree: "",
								field: "",
								startDate: "",
								endDate: "",
							} as CVEducation)
						}
					>
						<Plus className="h-4 w-4 mr-1" />
						Add
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{(cv.education || []).map((edu, index) => (
						<div key={index} className="p-4 border rounded-lg space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<Input
									value={edu.institution}
									onChange={(e) =>
										updateItem("education", index, {
											...edu,
											institution: e.target.value,
										})
									}
									placeholder="Institution"
								/>
								<Input
									value={edu.degree}
									onChange={(e) =>
										updateItem("education", index, {
											...edu,
											degree: e.target.value,
										})
									}
									placeholder="Degree"
								/>
							</div>
							<div className="flex justify-end">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => removeItem("education", index)}
									className="text-destructive"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}
					{(cv.education || []).length === 0 && (
						<p className="text-center text-muted-foreground py-4">
							No education added yet.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Skills */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base flex items-center gap-2">
						<Award className="h-4 w-4" />
						Skills
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							addItem("skills", { name: "" } as CVSkill)
						}
					>
						<Plus className="h-4 w-4 mr-1" />
						Add
					</Button>
				</CardHeader>
				<CardContent className="space-y-2">
					{(cv.skills || []).map((skill, index) => (
						<div key={index} className="flex gap-2">
							<Input
								value={skill.name}
								onChange={(e) =>
									updateItem("skills", index, {
										...skill,
										name: e.target.value,
									})
								}
								placeholder="Skill name"
							/>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => removeItem("skills", index)}
								className="text-destructive"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))}
					{(cv.skills || []).length === 0 && (
						<p className="text-center text-muted-foreground py-4">
							No skills added yet.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Projects */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base flex items-center gap-2">
						<BookOpen className="h-4 w-4" />
						Key Projects
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							addItem("projects", {
								name: "",
								client: "",
								description: "",
								role: "",
							} as CVProject)
						}
					>
						<Plus className="h-4 w-4 mr-1" />
						Add
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{(cv.projects || []).map((project, index) => (
						<div key={index} className="p-4 border rounded-lg space-y-3">
							<Input
								value={project.name}
								onChange={(e) =>
									updateItem("projects", index, {
										...project,
										name: e.target.value,
									})
								}
								placeholder="Project name"
							/>
							<Input
								value={project.role || ""}
								onChange={(e) =>
									updateItem("projects", index, {
										...project,
										role: e.target.value,
									})
								}
								placeholder="Your role in the project"
							/>
							<Textarea
								value={project.description || ""}
								onChange={(e) =>
									updateItem("projects", index, {
										...project,
										description: e.target.value,
									})
								}
								placeholder="Brief description of the project..."
								rows={2}
							/>
							<div className="flex justify-end">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => removeItem("projects", index)}
									className="text-destructive"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}
					{(cv.projects || []).length === 0 && (
						<p className="text-center text-muted-foreground py-4">
							No projects added yet.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
