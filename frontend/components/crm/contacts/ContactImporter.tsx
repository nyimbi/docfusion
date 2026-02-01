"use client";

/**
 * Contact Importer Component
 *
 * Multi-step contact import wizard supporting vCard and CSV formats.
 * Features:
 * - Drag-and-drop file upload
 * - Automatic file type detection
 * - CSV field mapping with auto-detection
 * - Preview with existing contact/account detection
 * - Import progress tracking
 * - Error display with row numbers
 */

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Upload,
	FileText,
	FileSpreadsheet,
	Contact2,
	CheckCircle2,
	AlertCircle,
	AlertTriangle,
	X,
	ChevronRight,
	ChevronLeft,
	Loader2,
	Users,
	Building2,
} from "lucide-react";

// Types for parsed contacts
interface ParsedContactPreview {
	firstName?: string;
	lastName?: string;
	fullName?: string;
	email?: string;
	phone?: string;
	company?: string;
	title?: string;
	existingContact?: boolean;
	existingAccount?: string;
}

interface ImportPreview {
	contacts: ParsedContactPreview[];
	totalCount: number;
	previewCount: number;
}

interface CSVInfo {
	headers?: string[];
	suggestedMapping?: Record<string, string | null>;
	confidence?: Record<string, number>;
}

interface ParsingInfo {
	errors: Array<{ row?: number; message: string }>;
	warnings: Array<{ row?: number; message: string }>;
	errorCount: number;
	warningCount: number;
}

interface ImportStats {
	imported: number;
	updated: number;
	skipped: number;
	failed: number;
}

// Available contact fields for mapping
const CONTACT_FIELDS = [
	{ value: "firstName", label: "First Name" },
	{ value: "lastName", label: "Last Name" },
	{ value: "fullName", label: "Full Name" },
	{ value: "email", label: "Email" },
	{ value: "emailSecondary", label: "Secondary Email" },
	{ value: "phone", label: "Phone" },
	{ value: "phoneMobile", label: "Mobile Phone" },
	{ value: "phoneWork", label: "Work Phone" },
	{ value: "title", label: "Job Title" },
	{ value: "company", label: "Company" },
	{ value: "department", label: "Department" },
	{ value: "linkedinUrl", label: "LinkedIn URL" },
	{ value: "country", label: "Country" },
	{ value: "city", label: "City" },
	{ value: "address", label: "Address" },
	{ value: "birthday", label: "Birthday" },
	{ value: "notes", label: "Notes" },
	{ value: "tags", label: "Tags" },
];

// Steps in the import wizard
type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

interface ContactImporterProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onComplete?: (stats: ImportStats) => void;
	defaultAccountId?: string;
}

export function ContactImporter({
	open,
	onOpenChange,
	onComplete,
	defaultAccountId,
}: ContactImporterProps) {
	// State
	const [step, setStep] = useState<ImportStep>("upload");
	const [file, setFile] = useState<File | null>(null);
	const [fileContent, setFileContent] = useState<string>("");
	const [importId, setImportId] = useState<string | null>(null);
	const [preview, setPreview] = useState<ImportPreview | null>(null);
	const [csvInfo, setCsvInfo] = useState<CSVInfo | null>(null);
	const [parsing, setParsing] = useState<ParsingInfo | null>(null);
	const [mapping, setMapping] = useState<Record<string, string | null>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [importProgress, setImportProgress] = useState(0);
	const [importStats, setImportStats] = useState<ImportStats | null>(null);
	const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string; contact?: string }>>([]);

	// Import options
	const [updateExisting, setUpdateExisting] = useState(true);
	const [skipDuplicates, setSkipDuplicates] = useState(false);

	// Reset state when dialog closes
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			setStep("upload");
			setFile(null);
			setFileContent("");
			setImportId(null);
			setPreview(null);
			setCsvInfo(null);
			setParsing(null);
			setMapping({});
			setError(null);
			setImportProgress(0);
			setImportStats(null);
			setImportErrors([]);
		}
		onOpenChange(newOpen);
	};

	// File drop handler
	const onDrop = useCallback(async (acceptedFiles: File[]) => {
		const droppedFile = acceptedFiles[0];
		if (!droppedFile) return;

		setError(null);
		setFile(droppedFile);
		setIsLoading(true);

		try {
			// Read file content
			const content = await droppedFile.text();
			setFileContent(content);

			// Upload and parse
			const formData = new FormData();
			formData.append("file", droppedFile);

			const response = await fetch("/api/v1/contacts/import", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to parse file");
			}

			const data = await response.json();

			setImportId(data.importId);
			setPreview(data.preview);
			setParsing(data.parsing);

			if (data.csv) {
				setCsvInfo(data.csv);
				setMapping(data.csv.suggestedMapping || {});
				setStep("mapping");
			} else {
				setStep("preview");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to parse file");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Dropzone setup
	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"text/vcard": [".vcf", ".vcard"],
			"text/csv": [".csv"],
			"text/x-vcard": [".vcf"],
		},
		maxFiles: 1,
		disabled: isLoading,
	});

	// Confirm import
	const handleConfirmImport = async () => {
		if (!importId || !fileContent) return;

		setIsLoading(true);
		setStep("importing");
		setImportProgress(10);

		try {
			const response = await fetch("/api/v1/contacts/import", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					importId,
					fileContent: Buffer.from(fileContent).toString("base64"),
					mapping: csvInfo ? mapping : undefined,
					options: {
						updateExisting,
						skipDuplicates,
						defaultAccountId,
					},
				}),
			});

			setImportProgress(50);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Import failed");
			}

			const data = await response.json();

			setImportProgress(100);
			setImportStats(data.stats);
			setImportErrors(data.errors || []);
			setStep("complete");

			if (onComplete) {
				onComplete(data.stats);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import failed");
			setStep("preview");
		} finally {
			setIsLoading(false);
		}
	};

	// Render file type icon
	const getFileIcon = () => {
		if (!file) return <Upload className="h-12 w-12 text-muted-foreground" />;
		const ext = file.name.split(".").pop()?.toLowerCase();
		if (ext === "csv") return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
		return <Contact2 className="h-12 w-12 text-blue-500" />;
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Import Contacts
					</DialogTitle>
					<DialogDescription>
						Import contacts from vCard (.vcf) or CSV files
					</DialogDescription>
				</DialogHeader>

				{/* Step Indicator */}
				<div className="flex items-center justify-center gap-2 py-4 border-b">
					{["upload", "mapping", "preview", "importing", "complete"].map((s, i) => {
						const stepLabels: Record<string, string> = {
							upload: "Upload",
							mapping: "Map Fields",
							preview: "Preview",
							importing: "Import",
							complete: "Complete",
						};
						const isActive = s === step;
						const isPast = ["upload", "mapping", "preview", "importing", "complete"].indexOf(s) <
							["upload", "mapping", "preview", "importing", "complete"].indexOf(step);

						// Skip mapping step indicator for non-CSV
						if (s === "mapping" && !csvInfo && step !== "mapping") return null;

						return (
							<div key={s} className="flex items-center">
								{i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />}
								<div
									className={cn(
										"flex items-center gap-2 px-3 py-1 rounded-full text-sm",
										isActive && "bg-primary text-primary-foreground",
										isPast && "bg-primary/20 text-primary",
										!isActive && !isPast && "bg-muted text-muted-foreground"
									)}
								>
									{isPast && <CheckCircle2 className="h-4 w-4" />}
									{stepLabels[s]}
								</div>
							</div>
						);
					})}
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto p-4">
					{/* Upload Step */}
					{step === "upload" && (
						<div className="space-y-4">
							<div
								{...getRootProps()}
								className={cn(
									"border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
									isDragActive && "border-primary bg-primary/5",
									!isDragActive && "border-muted-foreground/25 hover:border-primary/50",
									isLoading && "opacity-50 cursor-not-allowed"
								)}
							>
								<input {...getInputProps()} />
								<div className="flex flex-col items-center gap-4">
									{isLoading ? (
										<Loader2 className="h-12 w-12 text-primary animate-spin" />
									) : (
										getFileIcon()
									)}
									{file ? (
										<div>
											<p className="font-medium">{file.name}</p>
											<p className="text-sm text-muted-foreground">
												{(file.size / 1024).toFixed(1)} KB
											</p>
										</div>
									) : (
										<div>
											<p className="font-medium">
												{isDragActive ? "Drop file here" : "Drag & drop a file here"}
											</p>
											<p className="text-sm text-muted-foreground">
												or click to browse
											</p>
											<p className="text-xs text-muted-foreground mt-2">
												Supports .vcf (vCard) and .csv files
											</p>
										</div>
									)}
								</div>
							</div>

							{error && (
								<div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
									<AlertCircle className="h-5 w-5 flex-shrink-0" />
									<p>{error}</p>
								</div>
							)}
						</div>
					)}

					{/* Mapping Step (CSV only) */}
					{step === "mapping" && csvInfo && (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Map your CSV columns to contact fields. We've auto-detected some mappings.
							</p>

							<ScrollArea className="h-[400px] border rounded-lg">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>CSV Column</TableHead>
											<TableHead>Maps To</TableHead>
											<TableHead className="w-[100px]">Confidence</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{csvInfo.headers?.map((header) => (
											<TableRow key={header}>
												<TableCell className="font-mono text-sm">{header}</TableCell>
												<TableCell>
													<Select
														value={mapping[header] || "_skip"}
														onValueChange={(value) => {
															setMapping((prev) => ({
																...prev,
																[header]: value === "_skip" ? null : value,
															}));
														}}
													>
														<SelectTrigger className="w-[200px]">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="_skip">
																<span className="text-muted-foreground">Skip this column</span>
															</SelectItem>
															{CONTACT_FIELDS.map((field) => (
																<SelectItem key={field.value} value={field.value}>
																	{field.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</TableCell>
												<TableCell>
													{csvInfo.confidence?.[header] !== undefined && (
														<Badge
															variant={
																csvInfo.confidence[header] > 0.5
																	? "default"
																	: csvInfo.confidence[header] > 0
																		? "secondary"
																		: "outline"
															}
														>
															{csvInfo.confidence[header] > 0.5
																? "High"
																: csvInfo.confidence[header] > 0
																	? "Medium"
																	: "Manual"}
														</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</ScrollArea>
						</div>
					)}

					{/* Preview Step */}
					{step === "preview" && preview && (
						<div className="space-y-4">
							{/* Stats */}
							<div className="grid grid-cols-4 gap-4">
								<div className="p-4 bg-muted rounded-lg text-center">
									<div className="text-2xl font-bold">{preview.totalCount}</div>
									<div className="text-sm text-muted-foreground">Total Contacts</div>
								</div>
								<div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
									<div className="text-2xl font-bold text-green-600">
										{preview.contacts.filter((c) => !c.existingContact).length}
									</div>
									<div className="text-sm text-muted-foreground">New</div>
								</div>
								<div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
									<div className="text-2xl font-bold text-blue-600">
										{preview.contacts.filter((c) => c.existingContact).length}
									</div>
									<div className="text-sm text-muted-foreground">Existing</div>
								</div>
								<div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-center">
									<div className="text-2xl font-bold text-amber-600">
										{parsing?.errorCount || 0}
									</div>
									<div className="text-sm text-muted-foreground">Errors</div>
								</div>
							</div>

							{/* Preview Table */}
							<ScrollArea className="h-[300px] border rounded-lg">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Name</TableHead>
											<TableHead>Email</TableHead>
											<TableHead>Company</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{preview.contacts.map((contact, i) => (
											<TableRow key={i}>
												<TableCell>
													{contact.fullName ||
														`${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
														"-"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{contact.email || "-"}
												</TableCell>
												<TableCell>
													{contact.existingAccount ? (
														<div className="flex items-center gap-1">
															<Building2 className="h-4 w-4 text-muted-foreground" />
															{contact.existingAccount}
														</div>
													) : (
														contact.company || "-"
													)}
												</TableCell>
												<TableCell>
													{contact.existingContact ? (
														<Badge variant="secondary">Existing</Badge>
													) : (
														<Badge className="bg-green-100 text-green-700">New</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</ScrollArea>

							{preview.previewCount < preview.totalCount && (
								<p className="text-sm text-muted-foreground text-center">
									Showing {preview.previewCount} of {preview.totalCount} contacts
								</p>
							)}

							{/* Warnings/Errors */}
							{parsing && (parsing.warningCount > 0 || parsing.errorCount > 0) && (
								<div className="space-y-2">
									{parsing.errors.slice(0, 5).map((err, i) => (
										<div
											key={i}
											className="flex items-start gap-2 p-2 bg-destructive/10 text-destructive text-sm rounded"
										>
											<AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
											<span>
												{err.row && `Row ${err.row}: `}
												{err.message}
											</span>
										</div>
									))}
									{parsing.warnings.slice(0, 5).map((warn, i) => (
										<div
											key={i}
											className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 text-sm rounded"
										>
											<AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
											<span>
												{warn.row && `Row ${warn.row}: `}
												{warn.message}
											</span>
										</div>
									))}
								</div>
							)}

							{/* Import Options */}
							<div className="p-4 bg-muted rounded-lg space-y-3">
								<h4 className="font-medium">Import Options</h4>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="updateExisting"
										checked={updateExisting}
										onCheckedChange={(checked) => setUpdateExisting(checked === true)}
									/>
									<label htmlFor="updateExisting" className="text-sm">
										Update existing contacts if email matches
									</label>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox
										id="skipDuplicates"
										checked={skipDuplicates}
										onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
									/>
									<label htmlFor="skipDuplicates" className="text-sm">
										Skip duplicates instead of updating
									</label>
								</div>
							</div>
						</div>
					)}

					{/* Importing Step */}
					{step === "importing" && (
						<div className="flex flex-col items-center justify-center py-12 space-y-4">
							<Loader2 className="h-12 w-12 text-primary animate-spin" />
							<h3 className="font-medium">Importing contacts...</h3>
							<Progress value={importProgress} className="w-64" />
							<p className="text-sm text-muted-foreground">
								This may take a moment for large files
							</p>
						</div>
					)}

					{/* Complete Step */}
					{step === "complete" && importStats && (
						<div className="space-y-6">
							<div className="flex flex-col items-center py-8">
								<CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
								<h3 className="text-xl font-semibold">Import Complete!</h3>
							</div>

							{/* Final Stats */}
							<div className="grid grid-cols-4 gap-4">
								<div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
									<div className="text-2xl font-bold text-green-600">
										{importStats.imported}
									</div>
									<div className="text-sm text-muted-foreground">Imported</div>
								</div>
								<div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
									<div className="text-2xl font-bold text-blue-600">
										{importStats.updated}
									</div>
									<div className="text-sm text-muted-foreground">Updated</div>
								</div>
								<div className="p-4 bg-muted rounded-lg text-center">
									<div className="text-2xl font-bold">{importStats.skipped}</div>
									<div className="text-sm text-muted-foreground">Skipped</div>
								</div>
								<div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
									<div className="text-2xl font-bold text-red-600">
										{importStats.failed}
									</div>
									<div className="text-sm text-muted-foreground">Failed</div>
								</div>
							</div>

							{/* Import Errors */}
							{importErrors.length > 0 && (
								<div className="space-y-2">
									<h4 className="font-medium">Errors ({importErrors.length})</h4>
									<ScrollArea className="h-[150px] border rounded-lg p-2">
										{importErrors.map((err, i) => (
											<div
												key={i}
												className="flex items-start gap-2 p-2 text-sm text-destructive"
											>
												<AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
												<span>
													Row {err.row}: {err.error}
													{err.contact && ` (${err.contact})`}
												</span>
											</div>
										))}
									</ScrollArea>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer Actions */}
				<div className="flex justify-between items-center pt-4 border-t">
					<div>
						{step === "preview" && error && (
							<p className="text-sm text-destructive">{error}</p>
						)}
					</div>
					<div className="flex gap-2">
						{step === "mapping" && (
							<Button
								variant="outline"
								onClick={() => setStep("preview")}
							>
								<ChevronRight className="h-4 w-4 mr-1" />
								Continue to Preview
							</Button>
						)}
						{step === "preview" && csvInfo && (
							<Button
								variant="outline"
								onClick={() => setStep("mapping")}
							>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Edit Mapping
							</Button>
						)}
						{step === "preview" && (
							<Button onClick={handleConfirmImport} disabled={isLoading}>
								{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
								Import {preview?.totalCount || 0} Contacts
							</Button>
						)}
						{step === "complete" && (
							<Button onClick={() => handleOpenChange(false)}>
								Done
							</Button>
						)}
						{step !== "complete" && step !== "importing" && (
							<Button variant="ghost" onClick={() => handleOpenChange(false)}>
								Cancel
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default ContactImporter;
