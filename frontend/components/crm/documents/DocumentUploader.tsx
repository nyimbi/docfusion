"use client";

/**
 * Document Uploader Component
 *
 * File upload component for CRM documents with metadata.
 */

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import {
	Upload,
	File,
	FileText,
	X,
	Calendar as CalendarIcon,
	Loader2,
	CheckCircle,
	AlertCircle,
} from "lucide-react";

interface UploadedFile {
	file: File;
	progress: number;
	status: "pending" | "uploading" | "success" | "error";
	error?: string;
}

interface DocumentUploaderProps {
	accountId?: string;
	contactId?: string;
	dealId?: string;
	activityId?: string;
	onUpload: (data: FormData) => Promise<void>;
	onClose?: () => void;
	isOpen?: boolean;
	maxFiles?: number;
	maxSize?: number; // In MB
	className?: string;
}

// Form schema for document metadata
const documentSchema = z.object({
	name: z.string().min(1, "Name is required").max(500),
	type: z.enum([
		"cv",
		"certification",
		"registration",
		"contract",
		"proposal",
		"nda",
		"invoice",
		"other",
	]),
	description: z.string().optional(),
	validFrom: z.date().optional(),
	validTo: z.date().optional(),
	issuedBy: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

const DOCUMENT_TYPES = [
	{ value: "cv", label: "CV/Resume" },
	{ value: "certification", label: "Certification" },
	{ value: "registration", label: "Registration" },
	{ value: "contract", label: "Contract" },
	{ value: "proposal", label: "Proposal" },
	{ value: "nda", label: "NDA" },
	{ value: "invoice", label: "Invoice" },
	{ value: "other", label: "Other" },
];

export function DocumentUploader({
	accountId,
	contactId,
	dealId,
	activityId,
	onUpload,
	onClose,
	isOpen = false,
	maxFiles = 5,
	maxSize = 10, // 10MB default
	className,
}: DocumentUploaderProps) {
	const [files, setFiles] = useState<UploadedFile[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [currentStep, setCurrentStep] = useState<"select" | "metadata">("select");

	const form = useForm<DocumentFormValues>({
		resolver: zodResolver(documentSchema),
		defaultValues: {
			name: "",
			type: "other",
			description: "",
		},
	});

	// Handle file drop
	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			const newFiles = acceptedFiles.slice(0, maxFiles - files.length).map((file) => ({
				file,
				progress: 0,
				status: "pending" as const,
			}));

			setFiles((prev) => [...prev, ...newFiles]);

			// Auto-populate name from first file
			if (newFiles.length > 0 && !form.getValues("name")) {
				const fileName = newFiles[0].file.name.replace(/\.[^/.]+$/, "");
				form.setValue("name", fileName);
			}

			// Move to metadata step
			if (newFiles.length > 0) {
				setCurrentStep("metadata");
			}
		},
		[files.length, maxFiles, form]
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"application/pdf": [".pdf"],
			"application/msword": [".doc"],
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
			"application/vnd.ms-excel": [".xls"],
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
			"image/*": [".png", ".jpg", ".jpeg", ".gif"],
			"text/plain": [".txt"],
		},
		maxSize: maxSize * 1024 * 1024,
		maxFiles: maxFiles - files.length,
		disabled: files.length >= maxFiles,
	});

	// Remove file
	const removeFile = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
		if (files.length <= 1) {
			setCurrentStep("select");
		}
	};

	// Format file size
	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	// Handle submit
	const handleSubmit = async (data: DocumentFormValues) => {
		if (files.length === 0) return;

		setIsUploading(true);

		try {
			// Upload each file
			for (let i = 0; i < files.length; i++) {
				setFiles((prev) =>
					prev.map((f, idx) =>
						idx === i ? { ...f, status: "uploading" as const, progress: 0 } : f
					)
				);

				const formData = new FormData();
				formData.append("file", files[i].file);
				formData.append("name", i === 0 ? data.name : `${data.name} (${i + 1})`);
				formData.append("type", data.type);
				if (data.description) formData.append("description", data.description);
				if (data.validFrom) formData.append("validFrom", data.validFrom.toISOString());
				if (data.validTo) formData.append("validTo", data.validTo.toISOString());
				if (data.issuedBy) formData.append("issuedBy", data.issuedBy);
				if (accountId) formData.append("accountId", accountId);
				if (contactId) formData.append("contactId", contactId);
				if (dealId) formData.append("dealId", dealId);
				if (activityId) formData.append("activityId", activityId);

				// Simulate progress (replace with actual upload progress)
				const progressInterval = setInterval(() => {
					setFiles((prev) =>
						prev.map((f, idx) =>
							idx === i && f.progress < 90
								? { ...f, progress: f.progress + 10 }
								: f
						)
					);
				}, 200);

				try {
					await onUpload(formData);

					clearInterval(progressInterval);
					setFiles((prev) =>
						prev.map((f, idx) =>
							idx === i ? { ...f, status: "success" as const, progress: 100 } : f
						)
					);
				} catch (error) {
					clearInterval(progressInterval);
					setFiles((prev) =>
						prev.map((f, idx) =>
							idx === i
								? {
										...f,
										status: "error" as const,
										error: error instanceof Error ? error.message : "Upload failed",
									}
								: f
						)
					);
				}
			}

			// Close after successful upload
			setTimeout(() => {
				onClose?.();
				setFiles([]);
				setCurrentStep("select");
				form.reset();
			}, 1500);
		} finally {
			setIsUploading(false);
		}
	};

	const content = (
		<div className={cn("space-y-6", className)}>
			{currentStep === "select" ? (
				<>
					{/* Dropzone */}
					<div
						{...getRootProps()}
						className={cn(
							"border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
							isDragActive
								? "border-primary bg-primary/5"
								: "border-muted-foreground/25 hover:border-primary/50",
							files.length >= maxFiles && "opacity-50 cursor-not-allowed"
						)}
					>
						<input {...getInputProps()} />
						<Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
						{isDragActive ? (
							<p className="text-primary">Drop the files here...</p>
						) : (
							<>
								<p className="text-muted-foreground">
									Drag & drop files here, or click to select
								</p>
								<p className="text-sm text-muted-foreground mt-2">
									Max {maxFiles} files, up to {maxSize}MB each
								</p>
							</>
						)}
					</div>

					{/* File list */}
					{files.length > 0 && (
						<div className="space-y-2">
							<h4 className="font-medium">Selected Files</h4>
							{files.map((uploadedFile, index) => (
								<div
									key={index}
									className="flex items-center gap-3 p-3 bg-muted rounded-md"
								>
									<FileText className="h-8 w-8 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<p className="font-medium truncate">
											{uploadedFile.file.name}
										</p>
										<p className="text-sm text-muted-foreground">
											{formatFileSize(uploadedFile.file.size)}
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => removeFile(index)}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
							<Button
								className="w-full"
								onClick={() => setCurrentStep("metadata")}
							>
								Continue
							</Button>
						</div>
					)}
				</>
			) : (
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
						{/* Selected files summary */}
						<div className="flex items-center gap-2 p-3 bg-muted rounded-md">
							<File className="h-5 w-5 text-muted-foreground" />
							<span className="text-sm">
								{files.length} file{files.length > 1 ? "s" : ""} selected
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="ml-auto"
								onClick={() => setCurrentStep("select")}
								disabled={isUploading}
							>
								Change
							</Button>
						</div>

						{/* Upload progress */}
						{isUploading && (
							<div className="space-y-2">
								{files.map((file, index) => (
									<div key={index} className="flex items-center gap-3">
										{file.status === "success" ? (
											<CheckCircle className="h-4 w-4 text-green-500" />
										) : file.status === "error" ? (
											<AlertCircle className="h-4 w-4 text-red-500" />
										) : (
											<Loader2 className="h-4 w-4 animate-spin" />
										)}
										<div className="flex-1">
											<p className="text-sm truncate">{file.file.name}</p>
											<Progress value={file.progress} className="h-1 mt-1" />
										</div>
									</div>
								))}
							</div>
						)}

						{/* Metadata form */}
						{!isUploading && (
							<>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Document Name *</FormLabel>
											<FormControl>
												<Input placeholder="Enter document name" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="type"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Document Type *</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{DOCUMENT_TYPES.map((type) => (
														<SelectItem key={type.value} value={type.value}>
															{type.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Add a description..."
													className="min-h-[60px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="validFrom"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Valid From</FormLabel>
												<Popover>
													<PopoverTrigger asChild>
														<FormControl>
															<Button
																variant="outline"
																className={cn(
																	"w-full justify-start text-left font-normal",
																	!field.value && "text-muted-foreground"
																)}
															>
																<CalendarIcon className="mr-2 h-4 w-4" />
																{field.value
																	? field.value.toLocaleDateString()
																	: "Pick a date"}
															</Button>
														</FormControl>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-0">
														<Calendar
															mode="single"
															selected={field.value}
															onSelect={field.onChange}
														/>
													</PopoverContent>
												</Popover>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="validTo"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Valid Until</FormLabel>
												<Popover>
													<PopoverTrigger asChild>
														<FormControl>
															<Button
																variant="outline"
																className={cn(
																	"w-full justify-start text-left font-normal",
																	!field.value && "text-muted-foreground"
																)}
															>
																<CalendarIcon className="mr-2 h-4 w-4" />
																{field.value
																	? field.value.toLocaleDateString()
																	: "Pick a date"}
															</Button>
														</FormControl>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-0">
														<Calendar
															mode="single"
															selected={field.value}
															onSelect={field.onChange}
														/>
													</PopoverContent>
												</Popover>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="issuedBy"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Issued By</FormLabel>
											<FormControl>
												<Input placeholder="Issuing organization" {...field} />
											</FormControl>
											<FormDescription>
												Organization that issued this document
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-4 border-t">
							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								disabled={isUploading}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isUploading || files.length === 0}>
								{isUploading ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Uploading...
									</>
								) : (
									<>
										<Upload className="h-4 w-4 mr-2" />
										Upload
									</>
								)}
							</Button>
						</div>
					</form>
				</Form>
			)}
		</div>
	);

	if (isOpen !== undefined) {
		return (
			<Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Upload Document</DialogTitle>
					</DialogHeader>
					{content}
				</DialogContent>
			</Dialog>
		);
	}

	return content;
}

export default DocumentUploader;
