"use client";

/**
 * ResumeParser Component
 *
 * AI-powered resume parsing interface that extracts structured data
 * from uploaded resume files (PDF, DOCX, TXT). Provides preview,
 * field mapping, and correction capabilities.
 */

import { useState, useCallback } from "react";
import {
	Upload,
	FileText,
	Loader2,
	CheckCircle,
	AlertTriangle,
	X,
	Wand2,
	RefreshCw,
	Edit,
	Save,
	Eye,
	Download
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { parseResume } from "@/lib/actions/personnel";
import { cn } from "@/lib/utils";
import type { NewPersonnel } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface ResumeParserProps {
	onParsed: (data: Partial<NewPersonnel>) => void;
	onCancel?: () => void;
	existingData?: Partial<NewPersonnel>;
	className?: string;
}

interface ParsedField {
	field: string;
	value: string | number | object | null;
	confidence: number;
	source: string;
	needsReview: boolean;
}

interface ParseResult {
	status: "success" | "partial" | "error";
	fields: ParsedField[];
	rawText: string;
	warnings: string[];
	errors: string[];
}

type ParsingStep = "upload" | "processing" | "review" | "complete";

// ============================================================================
// Constants
// ============================================================================

const ACCEPTED_FILE_TYPES = [
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/msword",
	"text/plain",
];

const FIELD_LABELS: Record<string, string> = {
	firstName: "First Name",
	lastName: "Last Name",
	email: "Email",
	phone: "Phone",
	location: "Location",
	currentTitle: "Current Title",
	professionalSummary: "Professional Summary",
	yearsOfExperience: "Years of Experience",
	education: "Education",
	experience: "Work Experience",
	skills: "Skills",
	certifications: "Certifications",
	languages: "Languages",
	clearanceLevel: "Clearance Level",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getConfidenceBadge(confidence: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
	if (confidence >= 0.9) return { label: "High", variant: "default" };
	if (confidence >= 0.7) return { label: "Medium", variant: "secondary" };
	if (confidence >= 0.5) return { label: "Low", variant: "outline" };
	return { label: "Very Low", variant: "destructive" };
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// AI-Powered Resume Parsing
// ============================================================================

async function parseResumeFile(file: File): Promise<ParseResult> {
	try {
		// Read file content
		const fileContent = await readFileAsText(file);

		// Call AI parsing service
		const result = await parseResume(fileContent, file.name);

		if (!result.success || !result.data) {
			return {
				status: "error",
				fields: [],
				rawText: fileContent,
				warnings: [],
				errors: [result.error || "Failed to parse resume"],
			};
		}

		const parsed = result.data;
		const fields: ParsedField[] = [];
		const warnings: string[] = [];

		// Map parsed data to fields with confidence levels
		if (parsed.firstName) {
			fields.push({ field: "firstName", value: parsed.firstName, confidence: 0.95, source: "Header", needsReview: false });
		}
		if (parsed.lastName) {
			fields.push({ field: "lastName", value: parsed.lastName, confidence: 0.95, source: "Header", needsReview: false });
		}
		if (parsed.email) {
			fields.push({ field: "email", value: parsed.email, confidence: 0.98, source: "Contact Info", needsReview: false });
		}
		if (parsed.phone) {
			fields.push({ field: "phone", value: parsed.phone, confidence: 0.92, source: "Contact Info", needsReview: false });
		}
		if (parsed.currentTitle) {
			fields.push({ field: "currentTitle", value: parsed.currentTitle, confidence: 0.88, source: "Title", needsReview: false });
		}
		if (parsed.professionalSummary) {
			fields.push({ field: "professionalSummary", value: parsed.professionalSummary, confidence: 0.9, source: "Summary Section", needsReview: false });
		}

		// Calculate years of experience from work history
		if (parsed.experience && parsed.experience.length > 0) {
			const earliestYear = Math.min(
				...parsed.experience
					.map(exp => exp.startDate ? new Date(exp.startDate).getFullYear() : Infinity)
					.filter(y => y !== Infinity)
			);
			if (earliestYear < Infinity) {
				const yearsOfExperience = new Date().getFullYear() - earliestYear;
				fields.push({
					field: "yearsOfExperience",
					value: yearsOfExperience,
					confidence: 0.75,
					source: "Calculated",
					needsReview: true
				});
				warnings.push("Years of experience calculated from work history");
			}
		}

		// Map skills
		if (parsed.skills && parsed.skills.length > 0) {
			fields.push({
				field: "skills",
				value: parsed.skills.map(skill => ({
					skillName: skill.skillName,
					proficiency: skill.proficiency || "intermediate",
					yearsExperience: skill.yearsExperience || 0,
				})),
				confidence: 0.82,
				source: "Skills Section",
				needsReview: true
			});
		}

		// Map education
		if (parsed.education && parsed.education.length > 0) {
			fields.push({
				field: "education",
				value: parsed.education.map(edu => ({
					degree: edu.degree || "",
					field: edu.field || "",
					institution: edu.institution || "",
					year: edu.year,
				})),
				confidence: 0.9,
				source: "Education Section",
				needsReview: false
			});
		}

		// Map clearance if found
		if (parsed.clearance?.level) {
			fields.push({
				field: "clearanceLevel",
				value: parsed.clearance.level,
				confidence: 0.65,
				source: "Inferred",
				needsReview: true
			});
			warnings.push("Clearance level inferred from resume content");
		}

		return {
			status: "success",
			fields,
			rawText: fileContent,
			warnings,
			errors: [],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error parsing resume";
		return {
			status: "error",
			fields: [],
			rawText: "",
			warnings: [],
			errors: [message],
		};
	}
}

// Helper to read file content as text
async function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}

// ============================================================================
// Sub-Components
// ============================================================================

function FileDropzone({
	onFileSelect,
	disabled = false,
}: {
	onFileSelect: (file: File) => void;
	disabled?: boolean;
}) {
	const [isDragging, setIsDragging] = useState(false);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		if (disabled) return;

		const file = e.dataTransfer.files[0];
		if (file && ACCEPTED_FILE_TYPES.includes(file.type)) {
			onFileSelect(file);
		}
	}, [onFileSelect, disabled]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		if (!disabled) setIsDragging(true);
	}, [disabled]);

	const handleDragLeave = useCallback(() => {
		setIsDragging(false);
	}, []);

	const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) onFileSelect(file);
	}, [onFileSelect]);

	return (
		<div
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			className={cn(
				"border-2 border-dashed rounded-lg p-12 text-center transition-colors",
				isDragging && "border-primary bg-primary/5",
				disabled && "opacity-50 cursor-not-allowed",
				!isDragging && !disabled && "border-muted-foreground/25 hover:border-muted-foreground/50"
			)}
		>
			<Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-medium mb-2">Upload Resume</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Drag and drop a resume file, or click to browse
			</p>
			<input
				type="file"
				id="resume-upload"
				accept=".pdf,.docx,.doc,.txt"
				onChange={handleFileInput}
				className="hidden"
				disabled={disabled}
			/>
			<Button asChild variant="outline" disabled={disabled}>
				<label htmlFor="resume-upload" className="cursor-pointer">
					<FileText className="h-4 w-4 mr-2" />
					Select File
				</label>
			</Button>
			<p className="text-xs text-muted-foreground mt-4">
				Supported formats: PDF, DOCX, DOC, TXT (max 10MB)
			</p>
		</div>
	);
}

function FieldReviewCard({
	field,
	onUpdate,
	onApprove,
}: {
	field: ParsedField;
	onUpdate: (value: string | number | object | null) => void;
	onApprove: () => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(
		typeof field.value === "object" ? JSON.stringify(field.value, null, 2) : String(field.value ?? "")
	);

	const confidenceBadge = getConfidenceBadge(field.confidence);

	const handleSave = () => {
		try {
			const parsed = typeof field.value === "object"
				? JSON.parse(editValue)
				: field.field === "yearsOfExperience" ? parseInt(editValue) : editValue;
			onUpdate(parsed);
			setIsEditing(false);
		} catch {
			// Keep editing if JSON is invalid
		}
	};

	const isComplexField = typeof field.value === "object" && field.value !== null;

	return (
		<Card className={cn(field.needsReview && "border-yellow-200 bg-yellow-50/50")}>
			<CardContent className="p-4">
				<div className="flex items-start justify-between mb-2">
					<div className="flex items-center gap-2">
						<Label className="font-medium">{FIELD_LABELS[field.field] || field.field}</Label>
						<Badge variant={confidenceBadge.variant} className="text-xs">
							{Math.round(field.confidence * 100)}% {confidenceBadge.label}
						</Badge>
						{field.needsReview && (
							<Badge variant="outline" className="text-xs text-yellow-600 bg-yellow-50">
								<AlertTriangle className="h-3 w-3 mr-1" />
								Review
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-1">
						{!isEditing ? (
							<>
								<Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
									<Edit className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="sm" onClick={onApprove}>
									<CheckCircle className="h-4 w-4 text-green-600" />
								</Button>
							</>
						) : (
							<>
								<Button variant="ghost" size="sm" onClick={handleSave}>
									<Save className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
									<X className="h-4 w-4" />
								</Button>
							</>
						)}
					</div>
				</div>

				{isEditing ? (
					isComplexField ? (
						<Textarea
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
							rows={6}
							className="font-mono text-sm"
						/>
					) : (
						<Input
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
						/>
					)
				) : (
					<div className="text-sm">
						{isComplexField ? (
							<pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
								{JSON.stringify(field.value, null, 2)}
							</pre>
						) : (
							<p className="text-muted-foreground">{String(field.value)}</p>
						)}
					</div>
				)}

				<p className="text-xs text-muted-foreground mt-2">
					Source: {field.source}
				</p>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ResumeParser({
	onParsed,
	onCancel,
	existingData,
	className,
}: ResumeParserProps) {
	const [step, setStep] = useState<ParsingStep>("upload");
	const [file, setFile] = useState<File | null>(null);
	const [progress, setProgress] = useState(0);
	const [result, setResult] = useState<ParseResult | null>(null);
	const [editedFields, setEditedFields] = useState<Map<string, string | number | object | null>>(new Map());
	const [approvedFields, setApprovedFields] = useState<Set<string>>(new Set());
	const [showRawText, setShowRawText] = useState(false);

	const handleFileSelect = async (selectedFile: File) => {
		if (selectedFile.size > 10 * 1024 * 1024) {
			alert("File too large. Maximum size is 10MB.");
			return;
		}

		setFile(selectedFile);
		setStep("processing");
		setProgress(0);

		// Simulate progress
		const progressInterval = setInterval(() => {
			setProgress(p => Math.min(p + 10, 90));
		}, 200);

		try {
			const parseResult = await parseResumeFile(selectedFile);
			clearInterval(progressInterval);
			setProgress(100);
			setResult(parseResult);

			// Auto-approve high-confidence fields
			const autoApproved = new Set(
				parseResult.fields
					.filter(f => f.confidence >= 0.9 && !f.needsReview)
					.map(f => f.field)
			);
			setApprovedFields(autoApproved);

			setStep("review");
		} catch (error) {
			clearInterval(progressInterval);
			console.error("Parse error:", error);
			setStep("upload");
		}
	};

	const handleFieldUpdate = (field: string, value: string | number | object | null) => {
		setEditedFields(prev => new Map(prev).set(field, value));
	};

	const handleFieldApprove = (field: string) => {
		setApprovedFields(prev => new Set(prev).add(field));
	};

	const handleComplete = () => {
		if (!result) return;

		// Build the final data object
		const data: Partial<NewPersonnel> = { ...existingData };

		for (const field of result.fields) {
			const value = editedFields.has(field.field)
				? editedFields.get(field.field)
				: field.value;

			if (value !== null && value !== undefined) {
				(data as Record<string, unknown>)[field.field] = value;
			}
		}

		onParsed(data);
		setStep("complete");
	};

	const handleReset = () => {
		setFile(null);
		setResult(null);
		setEditedFields(new Map());
		setApprovedFields(new Set());
		setProgress(0);
		setStep("upload");
	};

	// Count fields needing review
	const fieldsNeedingReview = result?.fields.filter(
		f => f.needsReview && !approvedFields.has(f.field)
	).length || 0;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<Wand2 className="h-6 w-6" />
						AI Resume Parser
					</h2>
					<p className="text-muted-foreground">
						Extract structured data from resume files using AI
					</p>
				</div>
				{onCancel && (
					<Button variant="outline" onClick={onCancel}>
						<X className="h-4 w-4 mr-2" />
						Cancel
					</Button>
				)}
			</div>

			{/* Progress Steps */}
			<div className="flex items-center gap-4">
				{(["upload", "processing", "review", "complete"] as ParsingStep[]).map((s, i) => (
					<div key={s} className="flex items-center gap-2">
						<div className={cn(
							"w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
							step === s && "bg-primary text-primary-foreground",
							(["upload", "processing", "review", "complete"].indexOf(step) > i) && "bg-green-500 text-white",
							(["upload", "processing", "review", "complete"].indexOf(step) < i) && "bg-muted text-muted-foreground"
						)}>
							{["upload", "processing", "review", "complete"].indexOf(step) > i ? (
								<CheckCircle className="h-5 w-5" />
							) : (
								i + 1
							)}
						</div>
						<span className={cn(
							"text-sm font-medium capitalize",
							step === s ? "text-primary" : "text-muted-foreground"
						)}>
							{s}
						</span>
						{i < 3 && <div className="w-8 h-px bg-muted-foreground/25" />}
					</div>
				))}
			</div>

			{/* Upload Step */}
			{step === "upload" && (
				<FileDropzone onFileSelect={handleFileSelect} />
			)}

			{/* Processing Step */}
			{step === "processing" && (
				<Card>
					<CardContent className="py-12">
						<div className="text-center space-y-4">
							<Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
							<h3 className="text-lg font-medium">Parsing Resume</h3>
							<p className="text-sm text-muted-foreground">
								{file?.name} ({formatFileSize(file?.size || 0)})
							</p>
							<Progress value={progress} className="w-64 mx-auto" />
							<p className="text-xs text-muted-foreground">
								Extracting information using AI...
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Review Step */}
			{step === "review" && result && (
				<div className="space-y-4">
					{/* Summary */}
					<Card>
						<CardContent className="py-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4">
									<FileText className="h-8 w-8 text-muted-foreground" />
									<div>
										<p className="font-medium">{file?.name}</p>
										<p className="text-sm text-muted-foreground">
											{result.fields.length} fields extracted •{" "}
											{fieldsNeedingReview} need review
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Button variant="outline" size="sm" onClick={() => setShowRawText(!showRawText)}>
										<Eye className="h-4 w-4 mr-2" />
										{showRawText ? "Hide" : "Show"} Raw Text
									</Button>
									<Button variant="outline" size="sm" onClick={handleReset}>
										<RefreshCw className="h-4 w-4 mr-2" />
										Start Over
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Warnings */}
					{result.warnings.length > 0 && (
						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
							<h4 className="font-medium text-yellow-800 flex items-center gap-2 mb-2">
								<AlertTriangle className="h-4 w-4" />
								Warnings
							</h4>
							<ul className="text-sm text-yellow-700 space-y-1">
								{result.warnings.map((warning, i) => (
									<li key={i}>• {warning}</li>
								))}
							</ul>
						</div>
					)}

					{/* Raw Text Dialog */}
					<Dialog open={showRawText} onOpenChange={setShowRawText}>
						<DialogContent className="max-w-3xl max-h-[80vh]">
							<DialogHeader>
								<DialogTitle>Extracted Text</DialogTitle>
								<DialogDescription>
									Raw text extracted from the resume file
								</DialogDescription>
							</DialogHeader>
							<ScrollArea className="h-96">
								<pre className="text-sm whitespace-pre-wrap p-4 bg-muted rounded">
									{result.rawText}
								</pre>
							</ScrollArea>
						</DialogContent>
					</Dialog>

					{/* Fields Review */}
					<Tabs defaultValue="all">
						<TabsList>
							<TabsTrigger value="all">
								All Fields ({result.fields.length})
							</TabsTrigger>
							<TabsTrigger value="review" className="relative">
								Needs Review
								{fieldsNeedingReview > 0 && (
									<Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
										{fieldsNeedingReview}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="approved">
								Approved ({approvedFields.size})
							</TabsTrigger>
						</TabsList>

						<TabsContent value="all" className="mt-4">
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{result.fields.map(field => (
									<FieldReviewCard
										key={field.field}
										field={{
											...field,
											value: editedFields.has(field.field)
												? editedFields.get(field.field) ?? field.value
												: field.value,
											needsReview: field.needsReview && !approvedFields.has(field.field),
										}}
										onUpdate={(value) => handleFieldUpdate(field.field, value)}
										onApprove={() => handleFieldApprove(field.field)}
									/>
								))}
							</div>
						</TabsContent>

						<TabsContent value="review" className="mt-4">
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{result.fields
									.filter(f => f.needsReview && !approvedFields.has(f.field))
									.map(field => (
										<FieldReviewCard
											key={field.field}
											field={{
												...field,
												value: editedFields.has(field.field)
													? editedFields.get(field.field) ?? field.value
													: field.value,
											}}
											onUpdate={(value) => handleFieldUpdate(field.field, value)}
											onApprove={() => handleFieldApprove(field.field)}
										/>
									))}
								{fieldsNeedingReview === 0 && (
									<div className="col-span-2 text-center py-8 text-muted-foreground">
										<CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
										<p>All fields have been reviewed!</p>
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="approved" className="mt-4">
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{result.fields
									.filter(f => approvedFields.has(f.field))
									.map(field => (
										<FieldReviewCard
											key={field.field}
											field={{
												...field,
												value: editedFields.has(field.field)
													? editedFields.get(field.field) ?? field.value
													: field.value,
												needsReview: false,
											}}
											onUpdate={(value) => handleFieldUpdate(field.field, value)}
											onApprove={() => handleFieldApprove(field.field)}
										/>
									))}
							</div>
						</TabsContent>
					</Tabs>

					{/* Actions */}
					<div className="flex items-center justify-end gap-4">
						<Button variant="outline" onClick={handleReset}>
							Cancel
						</Button>
						<Button onClick={handleComplete}>
							<CheckCircle className="h-4 w-4 mr-2" />
							Accept & Continue
						</Button>
					</div>
				</div>
			)}

			{/* Complete Step */}
			{step === "complete" && (
				<Card>
					<CardContent className="py-12">
						<div className="text-center space-y-4">
							<CheckCircle className="h-16 w-16 mx-auto text-green-500" />
							<h3 className="text-xl font-medium">Resume Parsed Successfully</h3>
							<p className="text-muted-foreground">
								The extracted data has been applied to the personnel record.
							</p>
							<Button onClick={handleReset}>
								<Upload className="h-4 w-4 mr-2" />
								Parse Another Resume
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default ResumeParser;
