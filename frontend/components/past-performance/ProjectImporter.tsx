/**
 * Project Importer Component
 *
 * Bulk import of past performance projects from various sources
 * including CPARS, spreadsheets, and legacy systems.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
	Upload,
	FileSpreadsheet,
	Database,
	Globe,
	CheckCircle,
	AlertCircle,
	AlertTriangle,
	Loader2,
	ArrowRight,
	X,
	Download,
	RefreshCw,
	MapPin,
	FileText,
	Wand2,
	Eye,
	Settings,
} from "lucide-react";
import type { NewProject } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

type ImportSource = "cpars" | "excel" | "csv" | "api" | "manual";

interface ImportField {
	sourceField: string;
	targetField: keyof NewProject;
	transform?: string;
	required: boolean;
}

interface ImportedProject extends Partial<NewProject> {
	_rowNumber?: number;
	_status?: "pending" | "valid" | "error" | "warning";
	_errors?: string[];
	_warnings?: string[];
}

interface ImportProgress {
	stage: "upload" | "parse" | "validate" | "preview" | "import" | "complete";
	current: number;
	total: number;
	errors: number;
	warnings: number;
}

interface ProjectImporterProps {
	onImport: (projects: NewProject[]) => Promise<{ success: number; errors: number }>;
	onCancel: () => void;
	existingProjects?: Array<{ name: string; contractNumber?: string }>;
}

// ============================================================================
// Field Mapping Configuration
// ============================================================================

const DEFAULT_FIELD_MAPPINGS: ImportField[] = [
	{ sourceField: "Project Name", targetField: "name", required: true },
	{ sourceField: "Contract Number", targetField: "contractNumber", required: false },
	{ sourceField: "Customer", targetField: "customerName", required: true },
	{ sourceField: "Agency", targetField: "customerAgency", required: false },
	{ sourceField: "Contract Type", targetField: "contractType", required: false },
	{ sourceField: "Contract Value", targetField: "contractValue", transform: "number", required: false },
	{ sourceField: "Start Date", targetField: "periodOfPerformance", transform: "date-start", required: false },
	{ sourceField: "End Date", targetField: "periodOfPerformance", transform: "date-end", required: false },
	{ sourceField: "Description", targetField: "description", required: false },
	{ sourceField: "CPAR Quality", targetField: "cparRatings", transform: "cpar-quality", required: false },
	{ sourceField: "CPAR Schedule", targetField: "cparRatings", transform: "cpar-schedule", required: false },
	{ sourceField: "CPAR Cost", targetField: "cparRatings", transform: "cpar-cost", required: false },
	{ sourceField: "CPAR Management", targetField: "cparRatings", transform: "cpar-management", required: false },
	{ sourceField: "POC Name", targetField: "customerPOC", required: false },
	{ sourceField: "POC Email", targetField: "customerPOCEmail", required: false },
	{ sourceField: "POC Phone", targetField: "customerPOCPhone", required: false },
	{ sourceField: "Peak Staffing", targetField: "peakStaffing", transform: "number", required: false },
];

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Import source selection card
 */
function ImportSourceCard({
	source,
	icon: Icon,
	title,
	description,
	isSelected,
	onClick,
	disabled = false,
}: {
	source: ImportSource;
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	isSelected: boolean;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`p-4 border rounded-lg text-left transition-all ${
				isSelected
					? "border-primary bg-primary/5 ring-2 ring-primary"
					: disabled
						? "opacity-50 cursor-not-allowed"
						: "hover:border-primary/50 hover:bg-muted/50"
			}`}
		>
			<div className="flex items-start gap-3">
				<div
					className={`p-2 rounded-lg ${
						isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
					}`}
				>
					<Icon className="h-5 w-5" />
				</div>
				<div>
					<p className="font-medium">{title}</p>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
			</div>
			{disabled && (
				<Badge variant="outline" className="mt-2">
					Coming Soon
				</Badge>
			)}
		</button>
	);
}

/**
 * File upload zone
 */
function FileUploadZone({
	onFileSelect,
	accept,
	isUploading,
}: {
	onFileSelect: (file: File) => void;
	accept: string;
	isUploading: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const file = e.dataTransfer.files[0];
			if (file) onFileSelect(file);
		},
		[onFileSelect]
	);

	return (
		<div
			className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
				isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
			}`}
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragging(true);
			}}
			onDragLeave={() => setIsDragging(false)}
			onDrop={handleDrop}
		>
			{isUploading ? (
				<div className="flex flex-col items-center gap-3">
					<Loader2 className="h-10 w-10 animate-spin text-primary" />
					<p className="text-sm text-muted-foreground">Processing file...</p>
				</div>
			) : (
				<>
					<Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
					<p className="font-medium mb-1">Drop file here or click to browse</p>
					<p className="text-sm text-muted-foreground mb-4">
						Supports Excel (.xlsx, .xls) and CSV files
					</p>
					<input
						ref={inputRef}
						type="file"
						accept={accept}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) onFileSelect(file);
						}}
						className="hidden"
					/>
					<Button variant="outline" onClick={() => inputRef.current?.click()}>
						Choose File
					</Button>
				</>
			)}
		</div>
	);
}

/**
 * Field mapping row
 */
function FieldMappingRow({
	mapping,
	sourceColumns,
	onChange,
}: {
	mapping: ImportField;
	sourceColumns: string[];
	onChange: (sourceField: string) => void;
}) {
	return (
		<div className="flex items-center gap-4 py-2">
			<div className="w-1/3">
				<Select
					value={mapping.sourceField}
					onValueChange={onChange}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select source column" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">-- Not Mapped --</SelectItem>
						{sourceColumns.map((col) => (
							<SelectItem key={col} value={col}>
								{col}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<ArrowRight className="h-4 w-4 text-muted-foreground" />
			<div className="flex-1 flex items-center gap-2">
				<span className="font-medium text-sm">{mapping.targetField}</span>
				{mapping.required && (
					<Badge variant="destructive" className="text-xs">
						Required
					</Badge>
				)}
			</div>
		</div>
	);
}

/**
 * Preview row status indicator
 */
function RowStatusBadge({ status }: { status: ImportedProject["_status"] }) {
	const config = {
		pending: { icon: Loader2, color: "bg-gray-500", animate: true },
		valid: { icon: CheckCircle, color: "bg-green-500", animate: false },
		warning: { icon: AlertTriangle, color: "bg-yellow-500", animate: false },
		error: { icon: AlertCircle, color: "bg-red-500", animate: false },
	};

	const current = config[status || "pending"];
	const Icon = current.icon;

	return (
		<div className={`w-6 h-6 rounded-full ${current.color} flex items-center justify-center`}>
			<Icon className={`h-4 w-4 text-white ${current.animate ? "animate-spin" : ""}`} />
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectImporter({
	onImport,
	onCancel,
	existingProjects = [],
}: ProjectImporterProps) {
	// State
	const [source, setSource] = useState<ImportSource>("excel");
	const [step, setStep] = useState<"source" | "upload" | "mapping" | "preview" | "importing" | "complete">("source");
	const [file, setFile] = useState<File | null>(null);
	const [sourceColumns, setSourceColumns] = useState<string[]>([]);
	const [fieldMappings, setFieldMappings] = useState<ImportField[]>(DEFAULT_FIELD_MAPPINGS);
	const [parsedData, setParsedData] = useState<ImportedProject[]>([]);
	const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
	const [progress, setProgress] = useState<ImportProgress>({
		stage: "upload",
		current: 0,
		total: 0,
		errors: 0,
		warnings: 0,
	});
	const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	// Handle file selection
	const handleFileSelect = useCallback(async (selectedFile: File) => {
		setFile(selectedFile);
		setIsProcessing(true);

		// Simulate parsing (in real implementation, use papaparse or xlsx)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Mock parsed columns
		const mockColumns = [
			"Project Name",
			"Contract Number",
			"Customer",
			"Agency",
			"Contract Value",
			"Start Date",
			"End Date",
			"Description",
			"CPAR Quality",
			"CPAR Schedule",
			"CPAR Cost",
			"CPAR Management",
			"POC Name",
			"POC Email",
		];
		setSourceColumns(mockColumns);

		// Auto-map fields
		const autoMapped = fieldMappings.map((mapping) => {
			const match = mockColumns.find(
				(col) => col.toLowerCase() === mapping.sourceField.toLowerCase()
			);
			return match ? { ...mapping, sourceField: match } : mapping;
		});
		setFieldMappings(autoMapped);

		setIsProcessing(false);
		setStep("mapping");
	}, [fieldMappings]);

	// Handle mapping change
	const handleMappingChange = useCallback((index: number, sourceField: string) => {
		setFieldMappings((prev) => {
			const updated = [...prev];
			updated[index] = { ...updated[index], sourceField };
			return updated;
		});
	}, []);

	// Process and preview
	const handlePreview = useCallback(async () => {
		setIsProcessing(true);
		setStep("preview");

		// Simulate validation
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Mock validated data
		const mockData: ImportedProject[] = [
			{
				_rowNumber: 1,
				_status: "valid",
				name: "Enterprise Cloud Migration",
				contractNumber: "GS-35F-0001X",
				customerName: "Department of Defense",
				customerAgency: "U.S. Army",
				contractValue: 15000000,
				_errors: [],
				_warnings: [],
			},
			{
				_rowNumber: 2,
				_status: "warning",
				name: "Cybersecurity Operations Center",
				contractNumber: "W15QKN-20-C-0001",
				customerName: "Department of Homeland Security",
				contractValue: 8500000,
				_errors: [],
				_warnings: ["Similar project already exists: 'Cyber Operations Support'"],
			},
			{
				_rowNumber: 3,
				_status: "error",
				name: "",
				customerName: "Department of Veterans Affairs",
				contractValue: 3200000,
				_errors: ["Project name is required"],
				_warnings: [],
			},
			{
				_rowNumber: 4,
				_status: "valid",
				name: "Healthcare IT Modernization",
				contractNumber: "VA-123-45-D-0001",
				customerName: "Department of Veterans Affairs",
				customerAgency: "VHA",
				contractValue: 12000000,
				_errors: [],
				_warnings: [],
			},
		];

		setParsedData(mockData);
		setSelectedRows(
			new Set(mockData.filter((d) => d._status !== "error").map((d) => d._rowNumber!))
		);
		setProgress({
			stage: "preview",
			current: mockData.length,
			total: mockData.length,
			errors: mockData.filter((d) => d._status === "error").length,
			warnings: mockData.filter((d) => d._status === "warning").length,
		});

		setIsProcessing(false);
	}, []);

	// Execute import
	const handleImport = useCallback(async () => {
		setStep("importing");
		setIsProcessing(true);

		const projectsToImport = parsedData
			.filter((p) => selectedRows.has(p._rowNumber!) && p._status !== "error")
			.map((p) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { _rowNumber, _status, _errors, _warnings, ...project } = p;
				return project as NewProject;
			});

		const result = await onImport(projectsToImport);
		setImportResult(result);
		setStep("complete");
		setIsProcessing(false);
	}, [parsedData, selectedRows, onImport]);

	// Toggle row selection
	const toggleRow = useCallback((rowNumber: number) => {
		setSelectedRows((prev) => {
			const next = new Set(prev);
			if (next.has(rowNumber)) {
				next.delete(rowNumber);
			} else {
				next.add(rowNumber);
			}
			return next;
		});
	}, []);

	// Select all valid rows
	const selectAllValid = useCallback(() => {
		setSelectedRows(
			new Set(parsedData.filter((d) => d._status !== "error").map((d) => d._rowNumber!))
		);
	}, [parsedData]);

	return (
		<div className="space-y-6">
			{/* Progress Indicator */}
			<div className="flex items-center gap-4">
				{["source", "upload", "mapping", "preview", "complete"].map((s, i) => (
					<div key={s} className="flex items-center">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center ${
								step === s
									? "bg-primary text-primary-foreground"
									: ["source", "upload", "mapping", "preview", "complete"].indexOf(step) > i
										? "bg-primary/20 text-primary"
										: "bg-muted text-muted-foreground"
							}`}
						>
							{i + 1}
						</div>
						{i < 4 && <div className="w-8 h-px bg-border mx-2" />}
					</div>
				))}
			</div>

			{/* Step: Source Selection */}
			{step === "source" && (
				<Card>
					<CardHeader>
						<CardTitle>Select Import Source</CardTitle>
						<CardDescription>
							Choose where to import past performance projects from
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2">
							<ImportSourceCard
								source="excel"
								icon={FileSpreadsheet}
								title="Excel / CSV"
								description="Import from spreadsheet files"
								isSelected={source === "excel"}
								onClick={() => setSource("excel")}
							/>
							<ImportSourceCard
								source="cpars"
								icon={Database}
								title="CPARS Export"
								description="Import from CPARS system export"
								isSelected={source === "cpars"}
								onClick={() => setSource("cpars")}
								disabled
							/>
							<ImportSourceCard
								source="api"
								icon={Globe}
								title="API Integration"
								description="Connect to external systems"
								isSelected={source === "api"}
								onClick={() => setSource("api")}
								disabled
							/>
							<ImportSourceCard
								source="manual"
								icon={FileText}
								title="Manual Entry"
								description="Enter projects manually"
								isSelected={source === "manual"}
								onClick={() => setSource("manual")}
								disabled
							/>
						</div>

						<div className="flex justify-end mt-6">
							<Button onClick={() => setStep("upload")}>
								Continue
								<ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Step: File Upload */}
			{step === "upload" && (
				<Card>
					<CardHeader>
						<CardTitle>Upload File</CardTitle>
						<CardDescription>
							Upload your Excel or CSV file containing past performance data
						</CardDescription>
					</CardHeader>
					<CardContent>
						<FileUploadZone
							onFileSelect={handleFileSelect}
							accept=".xlsx,.xls,.csv"
							isUploading={isProcessing}
						/>

						{file && (
							<div className="mt-4 flex items-center justify-between p-3 bg-muted rounded-lg">
								<div className="flex items-center gap-2">
									<FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
									<span className="font-medium">{file.name}</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setFile(null);
										setStep("upload");
									}}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						)}

						<div className="flex justify-between mt-6">
							<Button variant="outline" onClick={() => setStep("source")}>
								Back
							</Button>
							<Button onClick={handlePreview} disabled={!file || isProcessing}>
								{isProcessing ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : null}
								Continue
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Step: Field Mapping */}
			{step === "mapping" && (
				<Card>
					<CardHeader>
						<CardTitle>Map Fields</CardTitle>
						<CardDescription>
							Match your file columns to project fields
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="flex items-center gap-4 py-2 border-b font-medium text-sm">
								<div className="w-1/3">Source Column</div>
								<div className="w-4" />
								<div className="flex-1">Target Field</div>
							</div>
							{fieldMappings.map((mapping, index) => (
								<FieldMappingRow
									key={mapping.targetField}
									mapping={mapping}
									sourceColumns={sourceColumns}
									onChange={(sourceField) => handleMappingChange(index, sourceField)}
								/>
							))}
						</div>

						<div className="flex items-center justify-between mt-6 pt-4 border-t">
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="sm">
									<Wand2 className="h-4 w-4 mr-1" />
									Auto-Map
								</Button>
								<Button variant="ghost" size="sm">
									<Download className="h-4 w-4 mr-1" />
									Download Template
								</Button>
							</div>
							<div className="flex gap-2">
								<Button variant="outline" onClick={() => setStep("upload")}>
									Back
								</Button>
								<Button onClick={handlePreview} disabled={isProcessing}>
									{isProcessing ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Eye className="h-4 w-4 mr-2" />
									)}
									Preview Import
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Step: Preview */}
			{step === "preview" && (
				<Card>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle>Preview Import</CardTitle>
								<CardDescription>
									Review and select projects to import
								</CardDescription>
							</div>
							<div className="flex items-center gap-4 text-sm">
								<div className="flex items-center gap-1">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span>{parsedData.filter((d) => d._status === "valid").length} valid</span>
								</div>
								<div className="flex items-center gap-1">
									<AlertTriangle className="h-4 w-4 text-yellow-500" />
									<span>{progress.warnings} warnings</span>
								</div>
								<div className="flex items-center gap-1">
									<AlertCircle className="h-4 w-4 text-red-500" />
									<span>{progress.errors} errors</span>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="border rounded-lg overflow-hidden">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">
											<Checkbox
												checked={
													selectedRows.size ===
													parsedData.filter((d) => d._status !== "error").length
												}
												onCheckedChange={(checked) => {
													if (checked) {
														selectAllValid();
													} else {
														setSelectedRows(new Set());
													}
												}}
											/>
										</TableHead>
										<TableHead className="w-12">Status</TableHead>
										<TableHead>Project Name</TableHead>
										<TableHead>Customer</TableHead>
										<TableHead>Contract #</TableHead>
										<TableHead className="text-right">Value</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{parsedData.map((project) => (
										<TableRow
											key={project._rowNumber}
											className={
												project._status === "error" ? "bg-red-50 opacity-60" : ""
											}
										>
											<TableCell>
												<Checkbox
													checked={selectedRows.has(project._rowNumber!)}
													onCheckedChange={() => toggleRow(project._rowNumber!)}
													disabled={project._status === "error"}
												/>
											</TableCell>
											<TableCell>
												<RowStatusBadge status={project._status} />
											</TableCell>
											<TableCell>
												<div>
													{project.name || (
														<span className="text-red-500 italic">Missing</span>
													)}
													{project._errors && project._errors.length > 0 && (
														<p className="text-xs text-red-600 mt-1">
															{project._errors[0]}
														</p>
													)}
													{project._warnings && project._warnings.length > 0 && (
														<p className="text-xs text-yellow-600 mt-1">
															{project._warnings[0]}
														</p>
													)}
												</div>
											</TableCell>
											<TableCell>{project.customerName}</TableCell>
											<TableCell>{project.contractNumber || "—"}</TableCell>
											<TableCell className="text-right">
												{project.contractValue
													? `$${(project.contractValue / 1000000).toFixed(1)}M`
													: "—"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						<div className="flex items-center justify-between mt-6 pt-4 border-t">
							<p className="text-sm text-muted-foreground">
								{selectedRows.size} of {parsedData.length} projects selected for import
							</p>
							<div className="flex gap-2">
								<Button variant="outline" onClick={() => setStep("mapping")}>
									Back
								</Button>
								<Button
									onClick={handleImport}
									disabled={selectedRows.size === 0 || isProcessing}
								>
									{isProcessing ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : null}
									Import {selectedRows.size} Projects
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Step: Importing */}
			{step === "importing" && (
				<Card>
					<CardContent className="py-12 text-center">
						<Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
						<p className="text-lg font-medium">Importing projects...</p>
						<p className="text-muted-foreground">
							Please wait while we import your projects
						</p>
					</CardContent>
				</Card>
			)}

			{/* Step: Complete */}
			{step === "complete" && importResult && (
				<Card>
					<CardContent className="py-12 text-center">
						<CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
						<p className="text-xl font-medium mb-2">Import Complete</p>
						<p className="text-muted-foreground mb-6">
							Successfully imported {importResult.success} projects
							{importResult.errors > 0 && ` (${importResult.errors} errors)`}
						</p>
						<div className="flex justify-center gap-2">
							<Button variant="outline" onClick={onCancel}>
								Close
							</Button>
							<Button
								onClick={() => {
									setStep("source");
									setFile(null);
									setParsedData([]);
									setImportResult(null);
								}}
							>
								Import More
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default ProjectImporter;
