"use client";

/**
 * PersonnelEditor Component
 *
 * Comprehensive multi-tab form for creating and editing personnel profiles.
 * Covers personal info, employment, skills, education, certifications,
 * clearance, and resume management.
 */

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	User,
	Briefcase,
	GraduationCap,
	Award,
	Shield,
	FileText,
	Save,
	X,
	Plus,
	Trash2,
	Upload,
	Calendar,
	Mail,
	Phone,
	MapPin,
	Link,
	AlertTriangle,
	CheckCircle,
	Clock
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Personnel, NewPersonnel } from "@/lib/db/schema-personnel";

// ============================================================================
// Schema
// ============================================================================

const educationSchema = z.object({
	degree: z.string().min(1, "Degree is required"),
	field: z.string().min(1, "Field of study is required"),
	institution: z.string().min(1, "Institution is required"),
	year: z.number().min(1900).max(2100),
	gpa: z.number().min(0).max(4).optional(),
	honors: z.string().optional(),
});

const certificationSchema = z.object({
	name: z.string().min(1, "Certification name is required"),
	issuer: z.string().min(1, "Issuer is required"),
	dateObtained: z.string().min(1, "Date obtained is required"),
	expirationDate: z.string().optional(),
	certificationNumber: z.string().optional(),
	status: z.enum(["active", "expired", "pending"]),
});

const skillSchema = z.object({
	skillId: z.string().optional(),
	skillName: z.string().min(1, "Skill name is required"),
	proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
	yearsExperience: z.number().min(0),
	lastUsed: z.string().optional(),
});

const languageSchema = z.object({
	language: z.string().min(1, "Language is required"),
	proficiency: z.enum(["basic", "conversational", "professional", "native"]),
});

const laborCategorySchema = z.object({
	contractVehicle: z.string().min(1, "Contract vehicle is required"),
	laborCategory: z.string().min(1, "Labor category is required"),
	rate: z.number().optional(),
});

const personnelFormSchema = z.object({
	// Basic Info
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	email: z.string().email("Invalid email").optional().or(z.literal("")),
	phone: z.string().optional(),
	photoUrl: z.string().url().optional().or(z.literal("")),

	// Employment
	employmentType: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	department: z.string().optional(),
	currentTitle: z.string().optional(),
	location: z.string().optional(),

	// Resume
	professionalSummary: z.string().optional(),
	linkedInUrl: z.string().url().optional().or(z.literal("")),

	// Clearance
	clearanceLevel: z.string().optional(),
	clearanceStatus: z.string().optional(),
	clearanceExpiration: z.string().optional(),
	clearanceInvestigationType: z.string().optional(),
	clearancePolygraph: z.boolean().optional(),

	// Availability
	availability: z.string().optional(),
	availableDate: z.string().optional(),
	maxCommitment: z.number().min(0).max(100).optional(),

	// Experience
	yearsOfExperience: z.number().min(0).optional(),

	// Arrays
	education: z.array(educationSchema).optional(),
	certifications: z.array(certificationSchema).optional(),
	skills: z.array(skillSchema).optional(),
	languages: z.array(languageSchema).optional(),
	laborCategories: z.array(laborCategorySchema).optional(),
	keyAchievements: z.array(z.string()).optional(),

	// Status
	isActive: z.boolean().optional(),
});

type PersonnelFormData = z.infer<typeof personnelFormSchema>;

// ============================================================================
// Types
// ============================================================================

interface PersonnelEditorProps {
	personnel?: Personnel;
	onSave: (data: NewPersonnel) => Promise<void>;
	onCancel: () => void;
	loading?: boolean;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const EMPLOYMENT_TYPES = [
	{ value: "employee", label: "Employee" },
	{ value: "contractor", label: "Contractor" },
	{ value: "consultant", label: "Consultant" },
	{ value: "partner", label: "Partner" },
];

const CLEARANCE_LEVELS = [
	{ value: "", label: "None" },
	{ value: "public_trust", label: "Public Trust" },
	{ value: "secret", label: "Secret" },
	{ value: "top_secret", label: "Top Secret" },
	{ value: "ts_sci", label: "TS/SCI" },
];

const CLEARANCE_STATUSES = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "pending", label: "Pending" },
	{ value: "expired", label: "Expired" },
];

const AVAILABILITY_OPTIONS = [
	{ value: "available", label: "Available" },
	{ value: "partial", label: "Partially Available" },
	{ value: "committed", label: "Committed" },
	{ value: "unavailable", label: "Unavailable" },
];

const PROFICIENCY_LEVELS = [
	{ value: "beginner", label: "Beginner" },
	{ value: "intermediate", label: "Intermediate" },
	{ value: "advanced", label: "Advanced" },
	{ value: "expert", label: "Expert" },
];

const LANGUAGE_PROFICIENCIES = [
	{ value: "basic", label: "Basic" },
	{ value: "conversational", label: "Conversational" },
	{ value: "professional", label: "Professional" },
	{ value: "native", label: "Native" },
];

// ============================================================================
// Main Component
// ============================================================================

export function PersonnelEditor({
	personnel,
	onSave,
	onCancel,
	loading = false,
	className,
}: PersonnelEditorProps) {
	const [activeTab, setActiveTab] = useState("basic");
	const [saving, setSaving] = useState(false);

	const isEditing = !!personnel;

	// Form setup
	const form = useForm<PersonnelFormData>({
		resolver: zodResolver(personnelFormSchema),
		defaultValues: {
			firstName: personnel?.firstName || "",
			lastName: personnel?.lastName || "",
			email: personnel?.email || "",
			phone: personnel?.phone || "",
			photoUrl: personnel?.photoUrl || "",
			employmentType: personnel?.employmentType || "",
			startDate: personnel?.startDate || "",
			endDate: personnel?.endDate || "",
			department: personnel?.department || "",
			currentTitle: personnel?.currentTitle || "",
			location: personnel?.location || "",
			professionalSummary: personnel?.professionalSummary || "",
			linkedInUrl: personnel?.linkedInUrl || "",
			clearanceLevel: personnel?.clearanceLevel || "",
			clearanceStatus: personnel?.clearanceStatus || "",
			clearanceExpiration: personnel?.clearanceExpiration || "",
			clearanceInvestigationType: personnel?.clearanceInvestigationType || "",
			clearancePolygraph: personnel?.clearancePolygraph || false,
			availability: personnel?.availability || "available",
			availableDate: personnel?.availableDate || "",
			maxCommitment: personnel?.maxCommitment || 100,
			yearsOfExperience: personnel?.yearsOfExperience || 0,
			education: personnel?.education || [],
			certifications: personnel?.certifications || [],
			skills: personnel?.skills || [],
			languages: personnel?.languages || [],
			laborCategories: personnel?.laborCategories || [],
			keyAchievements: personnel?.keyAchievements || [],
			isActive: personnel?.isActive ?? true,
		},
	});

	// Field arrays
	const {
		fields: educationFields,
		append: appendEducation,
		remove: removeEducation,
	} = useFieldArray({ control: form.control, name: "education" });

	const {
		fields: certificationFields,
		append: appendCertification,
		remove: removeCertification,
	} = useFieldArray({ control: form.control, name: "certifications" });

	const {
		fields: skillFields,
		append: appendSkill,
		remove: removeSkill,
	} = useFieldArray({ control: form.control, name: "skills" });

	const {
		fields: languageFields,
		append: appendLanguage,
		remove: removeLanguage,
	} = useFieldArray({ control: form.control, name: "languages" });

	const {
		fields: laborCategoryFields,
		append: appendLaborCategory,
		remove: removeLaborCategory,
	} = useFieldArray({ control: form.control, name: "laborCategories" });

	// Handlers
	const handleSubmit = async (data: PersonnelFormData) => {
		setSaving(true);
		try {
			await onSave(data as NewPersonnel);
		} finally {
			setSaving(false);
		}
	};

	// Tab validation indicators
	const tabErrors = {
		basic: !!form.formState.errors.firstName || !!form.formState.errors.lastName || !!form.formState.errors.email,
		employment: !!form.formState.errors.employmentType,
		skills: !!form.formState.errors.skills,
		education: !!form.formState.errors.education,
		certifications: !!form.formState.errors.certifications,
		clearance: !!form.formState.errors.clearanceLevel,
		resume: false,
	};

	return (
		<form onSubmit={form.handleSubmit(handleSubmit)} className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">
						{isEditing ? "Edit Personnel" : "Add Personnel"}
					</h2>
					<p className="text-muted-foreground">
						{isEditing
							? `Editing ${personnel.firstName} ${personnel.lastName}`
							: "Create a new personnel record"
						}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
						<X className="h-4 w-4 mr-2" />
						Cancel
					</Button>
					<Button type="submit" disabled={saving || loading}>
						<Save className="h-4 w-4 mr-2" />
						{saving ? "Saving..." : "Save"}
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid grid-cols-7 w-full">
					<TabsTrigger value="basic" className="relative">
						<User className="h-4 w-4 mr-2" />
						Basic
						{tabErrors.basic && (
							<span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
						)}
					</TabsTrigger>
					<TabsTrigger value="employment">
						<Briefcase className="h-4 w-4 mr-2" />
						Employment
					</TabsTrigger>
					<TabsTrigger value="skills">
						<Award className="h-4 w-4 mr-2" />
						Skills
					</TabsTrigger>
					<TabsTrigger value="education">
						<GraduationCap className="h-4 w-4 mr-2" />
						Education
					</TabsTrigger>
					<TabsTrigger value="certifications">
						<Award className="h-4 w-4 mr-2" />
						Certs
					</TabsTrigger>
					<TabsTrigger value="clearance">
						<Shield className="h-4 w-4 mr-2" />
						Clearance
					</TabsTrigger>
					<TabsTrigger value="resume">
						<FileText className="h-4 w-4 mr-2" />
						Resume
					</TabsTrigger>
				</TabsList>

				{/* Basic Info Tab */}
				<TabsContent value="basic" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Personal Information</CardTitle>
							<CardDescription>Basic contact and identification details</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="firstName">First Name *</Label>
									<Input
										id="firstName"
										{...form.register("firstName")}
										placeholder="John"
									/>
									{form.formState.errors.firstName && (
										<p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="lastName">Last Name *</Label>
									<Input
										id="lastName"
										{...form.register("lastName")}
										placeholder="Doe"
									/>
									{form.formState.errors.lastName && (
										<p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
									)}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<div className="relative">
										<Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											id="email"
											type="email"
											{...form.register("email")}
											placeholder="john.doe@example.com"
											className="pl-9"
										/>
									</div>
									{form.formState.errors.email && (
										<p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="phone">Phone</Label>
									<div className="relative">
										<Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											id="phone"
											{...form.register("phone")}
											placeholder="+1 (555) 123-4567"
											className="pl-9"
										/>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="location">Location</Label>
									<div className="relative">
										<MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											id="location"
											{...form.register("location")}
											placeholder="Washington, DC"
											className="pl-9"
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="linkedInUrl">LinkedIn</Label>
									<div className="relative">
										<Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											id="linkedInUrl"
											{...form.register("linkedInUrl")}
											placeholder="https://linkedin.com/in/johndoe"
											className="pl-9"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="photoUrl">Photo URL</Label>
								<Input
									id="photoUrl"
									{...form.register("photoUrl")}
									placeholder="https://example.com/photo.jpg"
								/>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="isActive"
									control={form.control}
									render={({ field }) => (
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									)}
								/>
								<Label>Active Personnel</Label>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Employment Tab */}
				<TabsContent value="employment" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Employment Details</CardTitle>
							<CardDescription>Current employment and availability information</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="currentTitle">Current Title</Label>
									<Input
										id="currentTitle"
										{...form.register("currentTitle")}
										placeholder="Senior Software Engineer"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="department">Department</Label>
									<Input
										id="department"
										{...form.register("department")}
										placeholder="Engineering"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="employmentType">Employment Type</Label>
									<Controller
										name="employmentType"
										control={form.control}
										render={({ field }) => (
											<Select value={field.value || ""} onValueChange={field.onChange}>
												<SelectTrigger>
													<SelectValue placeholder="Select type" />
												</SelectTrigger>
												<SelectContent>
													{EMPLOYMENT_TYPES.map(type => (
														<SelectItem key={type.value} value={type.value}>
															{type.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="yearsOfExperience">Years of Experience</Label>
									<Input
										id="yearsOfExperience"
										type="number"
										min={0}
										{...form.register("yearsOfExperience", { valueAsNumber: true })}
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="startDate">Start Date</Label>
									<Input
										id="startDate"
										type="date"
										{...form.register("startDate")}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="endDate">End Date</Label>
									<Input
										id="endDate"
										type="date"
										{...form.register("endDate")}
									/>
								</div>
							</div>

							<Separator />

							<h4 className="font-medium">Availability</h4>

							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label htmlFor="availability">Status</Label>
									<Controller
										name="availability"
										control={form.control}
										render={({ field }) => (
											<Select value={field.value || ""} onValueChange={field.onChange}>
												<SelectTrigger>
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
												<SelectContent>
													{AVAILABILITY_OPTIONS.map(opt => (
														<SelectItem key={opt.value} value={opt.value}>
															{opt.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="availableDate">Available From</Label>
									<Input
										id="availableDate"
										type="date"
										{...form.register("availableDate")}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="maxCommitment">Max Commitment (%)</Label>
									<Input
										id="maxCommitment"
										type="number"
										min={0}
										max={100}
										{...form.register("maxCommitment", { valueAsNumber: true })}
									/>
								</div>
							</div>

							<Separator />

							<h4 className="font-medium">Labor Categories</h4>

							{laborCategoryFields.map((field, index) => (
								<div key={field.id} className="flex items-end gap-4">
									<div className="flex-1 space-y-2">
										<Label>Contract Vehicle</Label>
										<Input
											{...form.register(`laborCategories.${index}.contractVehicle`)}
											placeholder="GSA IT 70"
										/>
									</div>
									<div className="flex-1 space-y-2">
										<Label>Labor Category</Label>
										<Input
											{...form.register(`laborCategories.${index}.laborCategory`)}
											placeholder="Senior Engineer"
										/>
									</div>
									<div className="w-32 space-y-2">
										<Label>Rate ($/hr)</Label>
										<Input
											type="number"
											{...form.register(`laborCategories.${index}.rate`, { valueAsNumber: true })}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeLaborCategory(index)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => appendLaborCategory({
									contractVehicle: "",
									laborCategory: "",
									rate: undefined
								})}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Labor Category
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Skills Tab */}
				<TabsContent value="skills" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Skills & Languages</CardTitle>
							<CardDescription>Technical and soft skills with proficiency levels</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<h4 className="font-medium">Skills</h4>

							{skillFields.map((field, index) => (
								<div key={field.id} className="flex items-end gap-4">
									<div className="flex-1 space-y-2">
										<Label>Skill Name</Label>
										<Input
											{...form.register(`skills.${index}.skillName`)}
											placeholder="Python"
										/>
									</div>
									<div className="w-40 space-y-2">
										<Label>Proficiency</Label>
										<Controller
											name={`skills.${index}.proficiency`}
											control={form.control}
											render={({ field: selectField }) => (
												<Select value={selectField.value} onValueChange={selectField.onChange}>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{PROFICIENCY_LEVELS.map(level => (
															<SelectItem key={level.value} value={level.value}>
																{level.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
									</div>
									<div className="w-24 space-y-2">
										<Label>Years</Label>
										<Input
											type="number"
											min={0}
											{...form.register(`skills.${index}.yearsExperience`, { valueAsNumber: true })}
										/>
									</div>
									<div className="w-32 space-y-2">
										<Label>Last Used</Label>
										<Input
											type="date"
											{...form.register(`skills.${index}.lastUsed`)}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeSkill(index)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => appendSkill({
									skillName: "",
									proficiency: "intermediate",
									yearsExperience: 1,
									lastUsed: new Date().toISOString().split("T")[0]
								})}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Skill
							</Button>

							<Separator />

							<h4 className="font-medium">Languages</h4>

							{languageFields.map((field, index) => (
								<div key={field.id} className="flex items-end gap-4">
									<div className="flex-1 space-y-2">
										<Label>Language</Label>
										<Input
											{...form.register(`languages.${index}.language`)}
											placeholder="Spanish"
										/>
									</div>
									<div className="w-40 space-y-2">
										<Label>Proficiency</Label>
										<Controller
											name={`languages.${index}.proficiency`}
											control={form.control}
											render={({ field: selectField }) => (
												<Select value={selectField.value} onValueChange={selectField.onChange}>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{LANGUAGE_PROFICIENCIES.map(level => (
															<SelectItem key={level.value} value={level.value}>
																{level.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeLanguage(index)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => appendLanguage({
									language: "",
									proficiency: "conversational"
								})}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Language
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Education Tab */}
				<TabsContent value="education" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Education</CardTitle>
							<CardDescription>Academic degrees and educational background</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{educationFields.map((field, index) => (
								<Card key={field.id} className="p-4">
									<div className="flex items-start justify-between mb-4">
										<h4 className="font-medium">Education #{index + 1}</h4>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => removeEducation(index)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Degree *</Label>
											<Input
												{...form.register(`education.${index}.degree`)}
												placeholder="Bachelor of Science"
											/>
										</div>
										<div className="space-y-2">
											<Label>Field of Study *</Label>
											<Input
												{...form.register(`education.${index}.field`)}
												placeholder="Computer Science"
											/>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-4 mt-4">
										<div className="space-y-2">
											<Label>Institution *</Label>
											<Input
												{...form.register(`education.${index}.institution`)}
												placeholder="MIT"
											/>
										</div>
										<div className="space-y-2">
											<Label>Year *</Label>
											<Input
												type="number"
												{...form.register(`education.${index}.year`, { valueAsNumber: true })}
												placeholder="2020"
											/>
										</div>
										<div className="space-y-2">
											<Label>GPA</Label>
											<Input
												type="number"
												step="0.01"
												min={0}
												max={4}
												{...form.register(`education.${index}.gpa`, { valueAsNumber: true })}
												placeholder="3.8"
											/>
										</div>
									</div>

									<div className="space-y-2 mt-4">
										<Label>Honors</Label>
										<Input
											{...form.register(`education.${index}.honors`)}
											placeholder="Magna Cum Laude"
										/>
									</div>
								</Card>
							))}

							<Button
								type="button"
								variant="outline"
								onClick={() => appendEducation({
									degree: "",
									field: "",
									institution: "",
									year: new Date().getFullYear(),
									gpa: undefined,
									honors: ""
								})}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Education
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Certifications Tab */}
				<TabsContent value="certifications" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Certifications</CardTitle>
							<CardDescription>Professional certifications and credentials</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{certificationFields.map((field, index) => {
								const cert = form.watch(`certifications.${index}`);
								const expirationDate = cert?.expirationDate ? new Date(cert.expirationDate) : null;
								const isExpiring = expirationDate && expirationDate > new Date() &&
									(expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 90;
								const isExpired = expirationDate && expirationDate <= new Date();

								return (
									<Card key={field.id} className="p-4">
										<div className="flex items-start justify-between mb-4">
											<div className="flex items-center gap-2">
												<h4 className="font-medium">Certification #{index + 1}</h4>
												{isExpired && (
													<Badge variant="destructive" className="text-xs">
														<AlertTriangle className="h-3 w-3 mr-1" />
														Expired
													</Badge>
												)}
												{isExpiring && !isExpired && (
													<Badge variant="outline" className="text-xs text-yellow-600 bg-yellow-50">
														<Clock className="h-3 w-3 mr-1" />
														Expiring Soon
													</Badge>
												)}
											</div>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeCertification(index)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label>Certification Name *</Label>
												<Input
													{...form.register(`certifications.${index}.name`)}
													placeholder="AWS Solutions Architect"
												/>
											</div>
											<div className="space-y-2">
												<Label>Issuing Organization *</Label>
												<Input
													{...form.register(`certifications.${index}.issuer`)}
													placeholder="Amazon Web Services"
												/>
											</div>
										</div>

										<div className="grid grid-cols-3 gap-4 mt-4">
											<div className="space-y-2">
												<Label>Date Obtained *</Label>
												<Input
													type="date"
													{...form.register(`certifications.${index}.dateObtained`)}
												/>
											</div>
											<div className="space-y-2">
												<Label>Expiration Date</Label>
												<Input
													type="date"
													{...form.register(`certifications.${index}.expirationDate`)}
												/>
											</div>
											<div className="space-y-2">
												<Label>Status</Label>
												<Controller
													name={`certifications.${index}.status`}
													control={form.control}
													render={({ field: selectField }) => (
														<Select value={selectField.value} onValueChange={selectField.onChange}>
															<SelectTrigger>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="active">Active</SelectItem>
																<SelectItem value="expired">Expired</SelectItem>
																<SelectItem value="pending">Pending</SelectItem>
															</SelectContent>
														</Select>
													)}
												/>
											</div>
										</div>

										<div className="space-y-2 mt-4">
											<Label>Certification Number</Label>
											<Input
												{...form.register(`certifications.${index}.certificationNumber`)}
												placeholder="ABC-123456"
											/>
										</div>
									</Card>
								);
							})}

							<Button
								type="button"
								variant="outline"
								onClick={() => appendCertification({
									name: "",
									issuer: "",
									dateObtained: new Date().toISOString().split("T")[0],
									expirationDate: "",
									certificationNumber: "",
									status: "active"
								})}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Certification
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Clearance Tab */}
				<TabsContent value="clearance" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Security Clearance</CardTitle>
							<CardDescription>Security clearance level and status</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="clearanceLevel">Clearance Level</Label>
									<Controller
										name="clearanceLevel"
										control={form.control}
										render={({ field }) => (
											<Select value={field.value || ""} onValueChange={field.onChange}>
												<SelectTrigger>
													<SelectValue placeholder="Select level" />
												</SelectTrigger>
												<SelectContent>
													{CLEARANCE_LEVELS.map(level => (
														<SelectItem key={level.value} value={level.value}>
															{level.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="clearanceStatus">Status</Label>
									<Controller
										name="clearanceStatus"
										control={form.control}
										render={({ field }) => (
											<Select value={field.value || ""} onValueChange={field.onChange}>
												<SelectTrigger>
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
												<SelectContent>
													{CLEARANCE_STATUSES.map(status => (
														<SelectItem key={status.value} value={status.value}>
															{status.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="clearanceExpiration">Expiration Date</Label>
									<Input
										id="clearanceExpiration"
										type="date"
										{...form.register("clearanceExpiration")}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="clearanceInvestigationType">Investigation Type</Label>
									<Input
										id="clearanceInvestigationType"
										{...form.register("clearanceInvestigationType")}
										placeholder="SSBI, NACLC, etc."
									/>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<Controller
									name="clearancePolygraph"
									control={form.control}
									render={({ field }) => (
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									)}
								/>
								<Label>Polygraph Completed</Label>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Resume Tab */}
				<TabsContent value="resume" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Resume & Summary</CardTitle>
							<CardDescription>Professional summary and key achievements</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="professionalSummary">Professional Summary</Label>
								<Textarea
									id="professionalSummary"
									{...form.register("professionalSummary")}
									placeholder="A brief professional summary highlighting key qualifications and experience..."
									rows={6}
								/>
							</div>

							<div className="space-y-2">
								<Label>Key Achievements</Label>
								<div className="space-y-2">
									{(form.watch("keyAchievements") || []).map((achievement, index) => (
										<div key={index} className="flex items-center gap-2">
											<Input
												value={achievement}
												onChange={(e) => {
													const achievements = form.getValues("keyAchievements") || [];
													achievements[index] = e.target.value;
													form.setValue("keyAchievements", achievements);
												}}
												placeholder="Describe an achievement..."
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => {
													const achievements = form.getValues("keyAchievements") || [];
													form.setValue("keyAchievements", achievements.filter((_, i) => i !== index));
												}}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											const achievements = form.getValues("keyAchievements") || [];
											form.setValue("keyAchievements", [...achievements, ""]);
										}}
									>
										<Plus className="h-4 w-4 mr-2" />
										Add Achievement
									</Button>
								</div>
							</div>

							<Separator />

							<div className="space-y-4">
								<h4 className="font-medium">Resume Documents</h4>
								<p className="text-sm text-muted-foreground">
									Upload or generate formatted resumes for different purposes.
								</p>
								<div className="flex gap-2">
									<Button type="button" variant="outline">
										<Upload className="h-4 w-4 mr-2" />
										Upload Resume
									</Button>
									<Button type="button" variant="outline">
										<FileText className="h-4 w-4 mr-2" />
										Generate Federal Format
									</Button>
									<Button type="button" variant="outline">
										<FileText className="h-4 w-4 mr-2" />
										Generate Commercial Format
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</form>
	);
}

export default PersonnelEditor;
