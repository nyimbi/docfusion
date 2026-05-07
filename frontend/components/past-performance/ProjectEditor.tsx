/**
 * Project Editor Component
 *
 * Comprehensive form for creating and editing past performance projects
 * with multi-section layout, validation, and AI-assisted content generation.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
	Building2,
	Calendar,
	DollarSign,
	Users,
	FileText,
	Star,
	Plus,
	Trash2,
	Save,
	Wand2,
	ChevronRight,
	AlertCircle,
	Loader2,
	Upload,
	Phone,
	Mail,
	ShieldCheck,
	Award,
	Target,
	TrendingUp,
} from "lucide-react";
import type { NewProject } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface CPARRatings {
	quality: number;
	schedule: number;
	cost: number;
	management: number;
	smallBusiness?: number;
	overall: number;
	narratives?: {
		quality?: string;
		schedule?: string;
		cost?: string;
		management?: string;
	};
}

interface KeyPersonnel {
	name: string;
	role: string;
	personnelId?: string;
}

interface QuantifiedResult {
	metric: string;
	value: string;
	context: string;
	impactArea?: string;
}

interface Challenge {
	challenge: string;
	resolution: string;
	outcome: string;
}

interface ProjectAward {
	name: string;
	date: string;
	issuingOrganization: string;
}

interface PeriodOfPerformance {
	start: string;
	end: string;
	options?: { start: string; end: string }[];
}

interface ProjectEditorProps {
	project?: Partial<NewProject>;
	onSave: (project: NewProject) => Promise<void>;
	onCancel: () => void;
	onGenerateNarrative?: (type: "cpar" | "brief" | "executive") => Promise<string>;
	isLoading?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Section header with optional action
 */
function SectionHeader({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-start justify-between mb-4">
			<div>
				<h3 className="font-semibold">{title}</h3>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{action}
		</div>
	);
}

/**
 * CPAR rating slider
 */
function CPARSlider({
	label,
	value,
	onChange,
	description,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	description?: string;
}) {
	const getRatingLabel = (v: number) => {
		if (v >= 4.5) return "Exceptional";
		if (v >= 3.5) return "Very Good";
		if (v >= 2.5) return "Satisfactory";
		if (v >= 1.5) return "Marginal";
		return "Unsatisfactory";
	};

	const getColor = (v: number) => {
		if (v >= 4.5) return "text-emerald-600";
		if (v >= 3.5) return "text-green-600";
		if (v >= 2.5) return "text-yellow-600";
		if (v >= 1.5) return "text-orange-600";
		return "text-red-600";
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label>{label}</Label>
				<div className="flex items-center gap-2">
					<span className={`font-medium ${getColor(value)}`}>
						{value.toFixed(1)}
					</span>
					<Badge variant="outline" className="text-xs">
						{getRatingLabel(value)}
					</Badge>
				</div>
			</div>
			<Slider
				value={[value]}
				min={1}
				max={5}
				step={0.1}
				onValueChange={([v]) => onChange(v)}
				className="w-full"
			/>
			{description && (
				<p className="text-xs text-muted-foreground">{description}</p>
			)}
		</div>
	);
}

/**
 * Repeatable field list
 */
function RepeatableField<T>({
	items,
	onAdd,
	onRemove,
	onUpdate,
	renderItem,
	emptyMessage,
	addLabel,
}: {
	items: T[];
	onAdd: () => void;
	onRemove: (index: number) => void;
	onUpdate: (index: number, item: T) => void;
	renderItem: (item: T, index: number, update: (item: T) => void) => React.ReactNode;
	emptyMessage: string;
	addLabel: string;
}) {
	if (items.length === 0) {
		return (
			<div className="text-center py-6 border-2 border-dashed rounded-lg">
				<p className="text-muted-foreground mb-2">{emptyMessage}</p>
				<Button variant="outline" size="sm" onClick={onAdd}>
					<Plus className="h-4 w-4 mr-1" />
					{addLabel}
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{items.map((item, index) => (
				<div key={index} className="relative p-4 border rounded-lg">
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-2 right-2 h-6 w-6"
						onClick={() => onRemove(index)}
					>
						<Trash2 className="h-4 w-4 text-muted-foreground" />
					</Button>
					{renderItem(item, index, (updated) => onUpdate(index, updated))}
				</div>
			))}
			<Button variant="outline" size="sm" onClick={onAdd}>
				<Plus className="h-4 w-4 mr-1" />
				{addLabel}
			</Button>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectEditor({
	project,
	onSave,
	onCancel,
	onGenerateNarrative,
	isLoading = false,
}: ProjectEditorProps) {
	// Form state
	const [formData, setFormData] = useState<Partial<NewProject>>({
		name: "",
		contractNumber: "",
		taskOrderNumber: "",
		customerName: "",
		customerAgency: "",
		customerPOC: "",
		customerPOCEmail: "",
		customerPOCPhone: "",
		contractType: "",
		contractValue: undefined,
		periodOfPerformance: { start: "", end: "" },
		description: "",
		scopeSummary: "",
		technicalAreas: [],
		naicsCode: "",
		peakStaffing: undefined,
		keyPersonnel: [],
		cparRatings: {
			quality: 3,
			schedule: 3,
			cost: 3,
			management: 3,
			overall: 3,
		},
		keyAccomplishments: [],
		quantifiedResults: [],
		challenges: [],
		awards: [],
		securityLevel: "",
		isActive: true,
		primeOrSub: "prime",
		primeContractorName: "",
		subcontractValue: undefined,
		referenceStatus: "available",
		referenceNotes: "",
		...project,
	});

	const [activeTab, setActiveTab] = useState("basic");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isGenerating, setIsGenerating] = useState(false);

	// Update field
	const updateField = useCallback(
		<K extends keyof NewProject>(field: K, value: NewProject[K]) => {
			setFormData((prev) => ({ ...prev, [field]: value }));
			// Clear error on change
			if (errors[field]) {
				setErrors((prev) => {
					const next = { ...prev };
					delete next[field];
					return next;
				});
			}
		},
		[errors]
	);

	// Validate form
	const validate = useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!formData.name?.trim()) {
			newErrors.name = "Project name is required";
		}
		if (!formData.customerName?.trim()) {
			newErrors.customerName = "Customer name is required";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [formData]);

	// Handle save
	const handleSave = useCallback(async () => {
		if (!validate()) return;

		// Calculate overall CPAR rating
		const ratings = formData.cparRatings as CPARRatings;
		if (ratings) {
			const overall =
				(ratings.quality + ratings.schedule + ratings.cost + ratings.management) / 4;
			ratings.overall = Math.round(overall * 10) / 10;
		}

		await onSave(formData as NewProject);
	}, [formData, validate, onSave]);

	// Generate narrative
	const handleGenerateNarrative = useCallback(
		async (type: "cpar" | "brief" | "executive") => {
			if (!onGenerateNarrative) return;

			setIsGenerating(true);
			try {
				const narrative = await onGenerateNarrative(type);
				if (type === "cpar") {
					updateField("cparNarrative", narrative);
				} else if (type === "brief") {
					updateField("briefDescription", narrative);
				} else {
					updateField("executiveSummary", narrative);
				}
			} finally {
				setIsGenerating(false);
			}
		},
		[onGenerateNarrative, updateField]
	);

	// CPAR ratings helpers
	const cparRatings = useMemo(() => (formData.cparRatings || {
		quality: 3,
		schedule: 3,
		cost: 3,
		management: 3,
		overall: 3,
	}) as CPARRatings, [formData.cparRatings]);

	const updateCPARRating = useCallback(
		(field: keyof CPARRatings, value: number) => {
			const updated = { ...cparRatings, [field]: value };
			// Recalculate overall
			updated.overall =
				Math.round(
					((updated.quality + updated.schedule + updated.cost + updated.management) / 4) * 10
				) / 10;
			updateField("cparRatings", updated);
		},
		[cparRatings, updateField]
	);

	// Technical areas
	const technicalAreas = (formData.technicalAreas || []) as string[];
	const [newTechArea, setNewTechArea] = useState("");

	// Key personnel
	const keyPersonnel = (formData.keyPersonnel || []) as KeyPersonnel[];

	// Accomplishments
	const accomplishments = (formData.keyAccomplishments || []) as string[];
	const [newAccomplishment, setNewAccomplishment] = useState("");

	// Quantified results
	const quantifiedResults = (formData.quantifiedResults || []) as QuantifiedResult[];

	// Challenges
	const challenges = (formData.challenges || []) as Challenge[];

	// Awards
	const awards = (formData.awards || []) as ProjectAward[];

	// Period of performance
	const period = (formData.periodOfPerformance || { start: "", end: "" }) as PeriodOfPerformance;

	return (
		<div className="space-y-6">
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-6">
					<TabsTrigger value="basic" className="gap-1">
						<FileText className="h-4 w-4" />
						Basic
					</TabsTrigger>
					<TabsTrigger value="customer" className="gap-1">
						<Building2 className="h-4 w-4" />
						Customer
					</TabsTrigger>
					<TabsTrigger value="team" className="gap-1">
						<Users className="h-4 w-4" />
						Team
					</TabsTrigger>
					<TabsTrigger value="performance" className="gap-1">
						<Star className="h-4 w-4" />
						CPAR
					</TabsTrigger>
					<TabsTrigger value="outcomes" className="gap-1">
						<TrendingUp className="h-4 w-4" />
						Outcomes
					</TabsTrigger>
					<TabsTrigger value="narratives" className="gap-1">
						<Wand2 className="h-4 w-4" />
						Narratives
					</TabsTrigger>
				</TabsList>

				{/* Basic Info Tab */}
				<TabsContent value="basic" className="mt-4 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Project Information</CardTitle>
							<CardDescription>
								Basic project details and contract information
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="name">
										Project Name <span className="text-destructive">*</span>
									</Label>
									<Input
										id="name"
										value={formData.name || ""}
										onChange={(e) => updateField("name", e.target.value)}
										placeholder="e.g., Enterprise IT Modernization"
										className={errors.name ? "border-destructive" : ""}
									/>
									{errors.name && (
										<p className="text-xs text-destructive flex items-center gap-1">
											<AlertCircle className="h-3 w-3" />
											{errors.name}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="contractNumber">Contract Number</Label>
									<Input
										id="contractNumber"
										value={formData.contractNumber || ""}
										onChange={(e) => updateField("contractNumber", e.target.value)}
										placeholder="e.g., GS-35F-0001X"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="taskOrderNumber">Task Order Number</Label>
									<Input
										id="taskOrderNumber"
										value={formData.taskOrderNumber || ""}
										onChange={(e) => updateField("taskOrderNumber", e.target.value)}
										placeholder="e.g., TO-001"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="contractType">Contract Type</Label>
									<Select
										value={formData.contractType || ""}
										onValueChange={(v) => updateField("contractType", v)}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="FFP">Firm Fixed Price (FFP)</SelectItem>
											<SelectItem value="T&M">Time & Materials (T&M)</SelectItem>
											<SelectItem value="CPFF">Cost Plus Fixed Fee (CPFF)</SelectItem>
											<SelectItem value="CPAF">Cost Plus Award Fee (CPAF)</SelectItem>
											<SelectItem value="IDIQ">IDIQ</SelectItem>
											<SelectItem value="BPA">BPA</SelectItem>
											<SelectItem value="GSA">GSA Schedule</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="contractValue">Contract Value ($)</Label>
									<Input
										id="contractValue"
										type="number"
										value={formData.contractValue || ""}
										onChange={(e) =>
											updateField("contractValue", parseFloat(e.target.value) || undefined)
										}
										placeholder="e.g., 5000000"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="naicsCode">NAICS Code</Label>
									<Input
										id="naicsCode"
										value={formData.naicsCode || ""}
										onChange={(e) => updateField("naicsCode", e.target.value)}
										placeholder="e.g., 541512"
									/>
								</div>
							</div>

							{/* Period of Performance */}
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="popStart">Period of Performance Start</Label>
									<Input
										id="popStart"
										type="date"
										value={period.start}
										onChange={(e) =>
											updateField("periodOfPerformance", {
												...period,
												start: e.target.value,
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="popEnd">Period of Performance End</Label>
									<Input
										id="popEnd"
										type="date"
										value={period.end}
										onChange={(e) =>
											updateField("periodOfPerformance", {
												...period,
												end: e.target.value,
											})
										}
									/>
								</div>
							</div>

							{/* Prime/Sub Selection */}
							<div className="space-y-4 p-4 border rounded-lg">
								<div className="flex items-center gap-4">
									<Label>Role</Label>
									<Select
										value={formData.primeOrSub || "prime"}
										onValueChange={(v) => updateField("primeOrSub", v)}
									>
										<SelectTrigger className="w-48">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="prime">Prime Contractor</SelectItem>
											<SelectItem value="subcontractor">Subcontractor</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{formData.primeOrSub === "subcontractor" && (
									<div className="grid gap-4 md:grid-cols-2 mt-4">
										<div className="space-y-2">
											<Label htmlFor="primeContractorName">Prime Contractor</Label>
											<Input
												id="primeContractorName"
												value={formData.primeContractorName || ""}
												onChange={(e) =>
													updateField("primeContractorName", e.target.value)
												}
												placeholder="Prime contractor name"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="subcontractValue">Subcontract Value ($)</Label>
											<Input
												id="subcontractValue"
												type="number"
												value={formData.subcontractValue || ""}
												onChange={(e) =>
													updateField(
														"subcontractValue",
														parseFloat(e.target.value) || undefined
													)
												}
												placeholder="Subcontract value"
											/>
										</div>
									</div>
								)}
							</div>

							{/* Description */}
							<div className="space-y-2">
								<Label htmlFor="description">Full Description</Label>
								<Textarea
									id="description"
									value={formData.description || ""}
									onChange={(e) => updateField("description", e.target.value)}
									placeholder="Detailed project description..."
									rows={4}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="scopeSummary">Scope Summary</Label>
								<Textarea
									id="scopeSummary"
									value={formData.scopeSummary || ""}
									onChange={(e) => updateField("scopeSummary", e.target.value)}
									placeholder="Brief scope summary..."
									rows={3}
								/>
							</div>

							{/* Technical Areas */}
							<div className="space-y-2">
								<Label>Technical Areas</Label>
								<div className="flex flex-wrap gap-2 mb-2">
									{technicalAreas.map((area, index) => (
										<Badge key={index} variant="secondary" className="gap-1">
											{area}
											<button
												type="button"
												onClick={() => {
													const updated = technicalAreas.filter((_, i) => i !== index);
													updateField("technicalAreas", updated);
												}}
												className="ml-1 hover:text-destructive"
											>
												×
											</button>
										</Badge>
									))}
								</div>
								<div className="flex gap-2">
									<Input
										value={newTechArea}
										onChange={(e) => setNewTechArea(e.target.value)}
										placeholder="Add technical area"
										onKeyDown={(e) => {
											if (e.key === "Enter" && newTechArea.trim()) {
												e.preventDefault();
												updateField("technicalAreas", [...technicalAreas, newTechArea.trim()]);
												setNewTechArea("");
											}
										}}
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											if (newTechArea.trim()) {
												updateField("technicalAreas", [...technicalAreas, newTechArea.trim()]);
												setNewTechArea("");
											}
										}}
									>
										Add
									</Button>
								</div>
							</div>

							{/* Security Level */}
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="securityLevel">Security Level</Label>
									<Select
										value={formData.securityLevel || ""}
										onValueChange={(v) => updateField("securityLevel", v)}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select level" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Unclassified">Unclassified</SelectItem>
											<SelectItem value="CUI">CUI</SelectItem>
											<SelectItem value="Secret">Secret</SelectItem>
											<SelectItem value="Top Secret">Top Secret</SelectItem>
											<SelectItem value="TS/SCI">TS/SCI</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center gap-4">
									<Label htmlFor="isActive">Active Project</Label>
									<Switch
										id="isActive"
										checked={formData.isActive !== false}
										onCheckedChange={(checked) => updateField("isActive", checked)}
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Customer Tab */}
				<TabsContent value="customer" className="mt-4 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Customer Information</CardTitle>
							<CardDescription>
								Customer details and reference contact information
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="customerName">
										Customer Name <span className="text-destructive">*</span>
									</Label>
									<Input
										id="customerName"
										value={formData.customerName || ""}
										onChange={(e) => updateField("customerName", e.target.value)}
										placeholder="e.g., Department of Defense"
										className={errors.customerName ? "border-destructive" : ""}
									/>
									{errors.customerName && (
										<p className="text-xs text-destructive flex items-center gap-1">
											<AlertCircle className="h-3 w-3" />
											{errors.customerName}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="customerAgency">Agency/Component</Label>
									<Input
										id="customerAgency"
										value={formData.customerAgency || ""}
										onChange={(e) => updateField("customerAgency", e.target.value)}
										placeholder="e.g., U.S. Army"
									/>
								</div>
							</div>

							<SectionHeader
								title="Point of Contact"
								description="Reference contact for this project"
							/>

							<div className="grid gap-4 md:grid-cols-3">
								<div className="space-y-2">
									<Label htmlFor="customerPOC">
										<Users className="h-3 w-3 inline mr-1" />
										POC Name
									</Label>
									<Input
										id="customerPOC"
										value={formData.customerPOC || ""}
										onChange={(e) => updateField("customerPOC", e.target.value)}
										placeholder="Contact name"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="customerPOCEmail">
										<Mail className="h-3 w-3 inline mr-1" />
										Email
									</Label>
									<Input
										id="customerPOCEmail"
										type="email"
										value={formData.customerPOCEmail || ""}
										onChange={(e) => updateField("customerPOCEmail", e.target.value)}
										placeholder="email@agency.gov"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="customerPOCPhone">
										<Phone className="h-3 w-3 inline mr-1" />
										Phone
									</Label>
									<Input
										id="customerPOCPhone"
										value={formData.customerPOCPhone || ""}
										onChange={(e) => updateField("customerPOCPhone", e.target.value)}
										placeholder="(555) 123-4567"
									/>
								</div>
							</div>

							{/* Reference Status */}
							<div className="p-4 border rounded-lg space-y-4">
								<SectionHeader
									title="Reference Status"
									description="Availability of this customer as a reference"
								/>

								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="referenceStatus">Status</Label>
										<Select
											value={formData.referenceStatus || "available"}
											onValueChange={(v) => updateField("referenceStatus", v)}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="available">Available</SelectItem>
												<SelectItem value="limited">Limited Availability</SelectItem>
												<SelectItem value="unavailable">Unavailable</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor="lastReferenceCheck">Last Verified</Label>
										<Input
											id="lastReferenceCheck"
											type="date"
											value={
												formData.lastReferenceCheck
													? new Date(formData.lastReferenceCheck)
															.toISOString()
															.split("T")[0]
													: ""
											}
											onChange={(e) =>
												updateField(
													"lastReferenceCheck",
													e.target.value ? new Date(e.target.value) : undefined
												)
											}
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="referenceNotes">Reference Notes</Label>
									<Textarea
										id="referenceNotes"
										value={formData.referenceNotes || ""}
										onChange={(e) => updateField("referenceNotes", e.target.value)}
										placeholder="Notes about reference availability, restrictions, etc."
										rows={2}
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Team Tab */}
				<TabsContent value="team" className="mt-4 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Team & Staffing</CardTitle>
							<CardDescription>
								Key personnel and staffing information
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="peakStaffing">Peak Staffing</Label>
								<Input
									id="peakStaffing"
									type="number"
									value={formData.peakStaffing || ""}
									onChange={(e) =>
										updateField("peakStaffing", parseInt(e.target.value) || undefined)
									}
									placeholder="Maximum number of personnel"
									className="w-48"
								/>
							</div>

							<SectionHeader
								title="Key Personnel"
								description="Project leadership and key technical staff"
							/>

							<RepeatableField
								items={keyPersonnel}
								onAdd={() =>
									updateField("keyPersonnel", [
										...keyPersonnel,
										{ name: "", role: "", personnelId: "" },
									])
								}
								onRemove={(index) => {
									const updated = keyPersonnel.filter((_, i) => i !== index);
									updateField("keyPersonnel", updated);
								}}
								onUpdate={(index, item) => {
									const updated = [...keyPersonnel];
									updated[index] = item;
									updateField("keyPersonnel", updated);
								}}
								renderItem={(item, _index, update) => (
									<div className="grid gap-4 md:grid-cols-3 pr-8">
										<div className="space-y-2">
											<Label>Name</Label>
											<Input
												value={item.name}
												onChange={(e) => update({ ...item, name: e.target.value })}
												placeholder="Full name"
											/>
										</div>
										<div className="space-y-2">
											<Label>Role</Label>
											<Input
												value={item.role}
												onChange={(e) => update({ ...item, role: e.target.value })}
												placeholder="e.g., Program Manager"
											/>
										</div>
										<div className="space-y-2">
											<Label>Personnel ID</Label>
											<Input
												value={item.personnelId || ""}
												onChange={(e) =>
													update({ ...item, personnelId: e.target.value })
												}
												placeholder="Optional link"
											/>
										</div>
									</div>
								)}
								emptyMessage="No key personnel added"
								addLabel="Add Key Personnel"
							/>
						</CardContent>
					</Card>
				</TabsContent>

				{/* CPAR Ratings Tab */}
				<TabsContent value="performance" className="mt-4 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>CPAR Ratings</CardTitle>
							<CardDescription>
								Contractor Performance Assessment Reporting System ratings (1-5 scale)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<CPARSlider
								label="Quality of Product/Service"
								value={cparRatings.quality}
								onChange={(v) => updateCPARRating("quality", v)}
								description="Technical quality, compliance with requirements, accuracy of reports"
							/>

							<CPARSlider
								label="Schedule"
								value={cparRatings.schedule}
								onChange={(v) => updateCPARRating("schedule", v)}
								description="Timeliness, milestone achievement, schedule management"
							/>

							<CPARSlider
								label="Cost Control"
								value={cparRatings.cost}
								onChange={(v) => updateCPARRating("cost", v)}
								description="Cost efficiency, budget management, cost realism"
							/>

							<CPARSlider
								label="Management"
								value={cparRatings.management}
								onChange={(v) => updateCPARRating("management", v)}
								description="Personnel management, communication, problem resolution"
							/>

							<div className="p-4 bg-muted/50 rounded-lg">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Overall Rating (Calculated)</p>
										<p className="text-sm text-muted-foreground">
											Average of all CPAR categories
										</p>
									</div>
									<div className="text-right">
										<p className="text-3xl font-bold">
											{cparRatings.overall.toFixed(1)}
										</p>
										<p className="text-sm text-muted-foreground">of 5.0</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Outcomes Tab */}
				<TabsContent value="outcomes" className="mt-4 space-y-6">
					{/* Key Accomplishments */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Award className="h-5 w-5" />
								Key Accomplishments
							</CardTitle>
							<CardDescription>
								Significant achievements and milestones
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{accomplishments.length > 0 && (
								<div className="space-y-2">
									{accomplishments.map((acc, index) => (
										<div
											key={index}
											className="flex items-start gap-2 p-3 border rounded-lg"
										>
											<span className="flex-1 text-sm">{acc}</span>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={() => {
													const updated = accomplishments.filter((_, i) => i !== index);
													updateField("keyAccomplishments", updated);
												}}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}
							<div className="flex gap-2">
								<Textarea
									value={newAccomplishment}
									onChange={(e) => setNewAccomplishment(e.target.value)}
									placeholder="Describe a key accomplishment..."
									rows={2}
								/>
								<Button
									variant="outline"
									onClick={() => {
										if (newAccomplishment.trim()) {
											updateField("keyAccomplishments", [
												...accomplishments,
												newAccomplishment.trim(),
											]);
											setNewAccomplishment("");
										}
									}}
								>
									Add
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Quantified Results */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								Quantified Results
							</CardTitle>
							<CardDescription>
								Measurable outcomes with metrics and context
							</CardDescription>
						</CardHeader>
						<CardContent>
							<RepeatableField
								items={quantifiedResults}
								onAdd={() =>
									updateField("quantifiedResults", [
										...quantifiedResults,
										{ metric: "", value: "", context: "", impactArea: "" },
									])
								}
								onRemove={(index) => {
									const updated = quantifiedResults.filter((_, i) => i !== index);
									updateField("quantifiedResults", updated);
								}}
								onUpdate={(index, item) => {
									const updated = [...quantifiedResults];
									updated[index] = item;
									updateField("quantifiedResults", updated);
								}}
								renderItem={(item, _index, update) => (
									<div className="space-y-3 pr-8">
										<div className="grid gap-3 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Metric</Label>
												<Input
													value={item.metric}
													onChange={(e) => update({ ...item, metric: e.target.value })}
													placeholder="e.g., Cost Savings"
												/>
											</div>
											<div className="space-y-2">
												<Label>Value</Label>
												<Input
													value={item.value}
													onChange={(e) => update({ ...item, value: e.target.value })}
													placeholder="e.g., $2.5M annually"
												/>
											</div>
										</div>
										<div className="grid gap-3 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Context</Label>
												<Input
													value={item.context}
													onChange={(e) => update({ ...item, context: e.target.value })}
													placeholder="How was this achieved?"
												/>
											</div>
											<div className="space-y-2">
												<Label>Impact Area</Label>
												<Input
													value={item.impactArea || ""}
													onChange={(e) =>
														update({ ...item, impactArea: e.target.value })
													}
													placeholder="e.g., Operations"
												/>
											</div>
										</div>
									</div>
								)}
								emptyMessage="No quantified results added"
								addLabel="Add Result"
							/>
						</CardContent>
					</Card>

					{/* Challenges */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								Challenges & Resolutions
							</CardTitle>
							<CardDescription>
								Problems overcome and solutions implemented
							</CardDescription>
						</CardHeader>
						<CardContent>
							<RepeatableField
								items={challenges}
								onAdd={() =>
									updateField("challenges", [
										...challenges,
										{ challenge: "", resolution: "", outcome: "" },
									])
								}
								onRemove={(index) => {
									const updated = challenges.filter((_, i) => i !== index);
									updateField("challenges", updated);
								}}
								onUpdate={(index, item) => {
									const updated = [...challenges];
									updated[index] = item;
									updateField("challenges", updated);
								}}
								renderItem={(item, _index, update) => (
									<div className="space-y-3 pr-8">
										<div className="space-y-2">
											<Label>Challenge</Label>
											<Textarea
												value={item.challenge}
												onChange={(e) => update({ ...item, challenge: e.target.value })}
												placeholder="Describe the challenge..."
												rows={2}
											/>
										</div>
										<div className="space-y-2">
											<Label>Resolution</Label>
											<Textarea
												value={item.resolution}
												onChange={(e) => update({ ...item, resolution: e.target.value })}
												placeholder="How was it resolved?"
												rows={2}
											/>
										</div>
										<div className="space-y-2">
											<Label>Outcome</Label>
											<Input
												value={item.outcome}
												onChange={(e) => update({ ...item, outcome: e.target.value })}
												placeholder="What was the result?"
											/>
										</div>
									</div>
								)}
								emptyMessage="No challenges documented"
								addLabel="Add Challenge"
							/>
						</CardContent>
					</Card>

					{/* Awards */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Award className="h-5 w-5" />
								Awards & Recognition
							</CardTitle>
						</CardHeader>
						<CardContent>
							<RepeatableField
								items={awards}
								onAdd={() =>
									updateField("awards", [
										...awards,
										{ name: "", date: "", issuingOrganization: "" },
									])
								}
								onRemove={(index) => {
									const updated = awards.filter((_, i) => i !== index);
									updateField("awards", updated);
								}}
								onUpdate={(index, item) => {
									const updated = [...awards];
									updated[index] = item;
									updateField("awards", updated);
								}}
								renderItem={(item, _index, update) => (
									<div className="grid gap-3 md:grid-cols-3 pr-8">
										<div className="space-y-2">
											<Label>Award Name</Label>
											<Input
												value={item.name}
												onChange={(e) => update({ ...item, name: e.target.value })}
												placeholder="Award name"
											/>
										</div>
										<div className="space-y-2">
											<Label>Date</Label>
											<Input
												type="date"
												value={item.date}
												onChange={(e) => update({ ...item, date: e.target.value })}
											/>
										</div>
										<div className="space-y-2">
											<Label>Issuing Organization</Label>
											<Input
												value={item.issuingOrganization}
												onChange={(e) =>
													update({ ...item, issuingOrganization: e.target.value })
												}
												placeholder="Organization"
											/>
										</div>
									</div>
								)}
								emptyMessage="No awards recorded"
								addLabel="Add Award"
							/>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Narratives Tab */}
				<TabsContent value="narratives" className="mt-4 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Wand2 className="h-5 w-5" />
								AI-Generated Narratives
							</CardTitle>
							<CardDescription>
								Auto-generated content for proposals and reports
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Brief Description */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="briefDescription">Brief Description</Label>
									{onGenerateNarrative && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleGenerateNarrative("brief")}
											disabled={isGenerating}
										>
											{isGenerating ? (
												<Loader2 className="h-4 w-4 mr-1 animate-spin" />
											) : (
												<Wand2 className="h-4 w-4 mr-1" />
											)}
											Generate
										</Button>
									)}
								</div>
								<Textarea
									id="briefDescription"
									value={formData.briefDescription || ""}
									onChange={(e) => updateField("briefDescription", e.target.value)}
									placeholder="2-3 sentence project summary..."
									rows={3}
								/>
							</div>

							{/* Executive Summary */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="executiveSummary">Executive Summary</Label>
									{onGenerateNarrative && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleGenerateNarrative("executive")}
											disabled={isGenerating}
										>
											{isGenerating ? (
												<Loader2 className="h-4 w-4 mr-1 animate-spin" />
											) : (
												<Wand2 className="h-4 w-4 mr-1" />
											)}
											Generate
										</Button>
									)}
								</div>
								<Textarea
									id="executiveSummary"
									value={formData.executiveSummary || ""}
									onChange={(e) => updateField("executiveSummary", e.target.value)}
									placeholder="Executive-level project summary..."
									rows={4}
								/>
							</div>

							{/* CPAR Narrative */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="cparNarrative">CPAR Narrative</Label>
									{onGenerateNarrative && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleGenerateNarrative("cpar")}
											disabled={isGenerating}
										>
											{isGenerating ? (
												<Loader2 className="h-4 w-4 mr-1 animate-spin" />
											) : (
												<Wand2 className="h-4 w-4 mr-1" />
											)}
											Generate
										</Button>
									)}
								</div>
								<Textarea
									id="cparNarrative"
									value={formData.cparNarrative || ""}
									onChange={(e) => updateField("cparNarrative", e.target.value)}
									placeholder="Performance narrative for past performance volumes..."
									rows={6}
								/>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Action Buttons */}
			<div className="flex items-center justify-end gap-3 pt-4 border-t">
				<Button variant="outline" onClick={onCancel} disabled={isLoading}>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={isLoading}>
					{isLoading ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Saving...
						</>
					) : (
						<>
							<Save className="h-4 w-4 mr-2" />
							Save Project
						</>
					)}
				</Button>
			</div>
		</div>
	);
}

export default ProjectEditor;
