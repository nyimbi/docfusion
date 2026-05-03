"use client";

/**
 * RFP Uploader Component
 *
 * Provides drag-and-drop file upload functionality for RFP documents
 * with format detection, validation, and progress tracking.
 *
 * Supports: PDF, DOCX, DOC, HTML file formats
 */

import * as React from "react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Upload,
	FileText,
	AlertCircle,
	CheckCircle2,
	X,
	File,
	Loader2,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface UploadedFile {
	file: File;
	id: string;
	status: "pending" | "uploading" | "processing" | "completed" | "error";
	progress: number;
	error?: string;
	rfpDocumentId?: string;
	parsingJobId?: string;
	currentStep?: string;
}

interface RfpParsingStatusResponse {
	status: "queued" | "processing" | "completed" | "failed" | "cancelled";
	currentStep: string | null;
	progress: number;
	errorMessage: string | null;
	documentId: string;
}

interface RFPUploaderProps {
	/** Opportunity ID to associate with uploaded RFPs */
	opportunityId?: string;
	/** Callback when upload completes successfully */
	onUploadComplete?: (rfpDocumentId: string, filename: string) => void;
	/** Callback on upload error */
	onUploadError?: (error: string, filename: string) => void;
	/** Allow multiple file uploads */
	multiple?: boolean;
	/** Maximum file size in bytes (default: 50MB) */
	maxFileSize?: number;
	/** Custom class name */
	className?: string;
}

// Supported file types
const ACCEPTED_TYPES = {
	"application/pdf": [".pdf"],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
	"application/msword": [".doc"],
	"text/html": [".html", ".htm"],
};

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".html", ".htm"];

// ============================================================================
// Component
// ============================================================================

export function RFPUploader({
	opportunityId,
	onUploadComplete,
	onUploadError,
	multiple = true,
	maxFileSize = 50 * 1024 * 1024, // 50MB
	className,
}: RFPUploaderProps) {
	const [files, setFiles] = useState<UploadedFile[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	const pollParsingStatus = useCallback(async (fileId: string, rfpDocumentId: string) => {
		let shouldContinue = true;
		let attempts = 0;

		while (shouldContinue && attempts < 80) {
			attempts += 1;
			await new Promise((resolve) => setTimeout(resolve, 1500));

			const response = await fetch(`/api/v1/rfp/${rfpDocumentId}/status`);
			if (!response.ok) {
				throw new Error("Failed to load parsing status");
			}

			const status = await response.json() as RfpParsingStatusResponse;
			const nextStatus: UploadedFile["status"] =
				status.status === "completed"
					? "completed"
					: status.status === "failed" || status.status === "cancelled"
						? "error"
						: "processing";

			setFiles((prev) =>
				prev.map((f) =>
					f.id === fileId
						? {
								...f,
								status: nextStatus,
								progress: status.progress,
								currentStep: status.currentStep ?? undefined,
								error: nextStatus === "error" ? status.errorMessage ?? "Parsing failed" : undefined,
						  }
						: f
				)
			);

			shouldContinue = status.status === "queued" || status.status === "processing";
		}

		if (shouldContinue) {
			throw new Error("Parsing status timed out");
		}
	}, []);

	// Validate file
	const validateFile = useCallback(
		(file: File): string | null => {
			// Check file size
			if (file.size > maxFileSize) {
				return `File exceeds maximum size of ${Math.round(maxFileSize / 1024 / 1024)}MB`;
			}

			// Check file type
			const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
			if (!ACCEPTED_EXTENSIONS.includes(extension)) {
				return `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`;
			}

			return null;
		},
		[maxFileSize]
	);

	// Upload a single file
	const uploadFile = useCallback(async (uploadedFile: UploadedFile) => {
		const formData = new FormData();
		formData.append("file", uploadedFile.file);
		if (opportunityId) {
			formData.append("opportunityId", opportunityId);
		}

		setFiles((prev) =>
			prev.map((f) =>
				f.id === uploadedFile.id ? { ...f, status: "uploading" as const, progress: 10 } : f
			)
		);

		try {
			const response = await fetch("/api/v1/rfp/upload", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Upload failed");
			}

			const result = await response.json();

			setFiles((prev) =>
				prev.map((f) =>
					f.id === uploadedFile.id
						? {
								...f,
								status: "processing" as const,
								progress: 10,
								rfpDocumentId: result.rfpDocumentId,
								parsingJobId: result.parsingJobId,
								currentStep: "Queued for parsing",
						  }
						: f
				)
			);

			onUploadComplete?.(result.rfpDocumentId, uploadedFile.file.name);
			await pollParsingStatus(uploadedFile.id, result.rfpDocumentId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Upload failed";

			setFiles((prev) =>
				prev.map((f) =>
					f.id === uploadedFile.id
						? { ...f, status: "error" as const, error: errorMessage }
						: f
				)
			);

			onUploadError?.(errorMessage, uploadedFile.file.name);
		}
	}, [onUploadComplete, onUploadError, opportunityId, pollParsingStatus]);

	// Add files to upload queue
	const addFiles = useCallback(
		(newFiles: FileList | File[]) => {
			const filesToAdd: UploadedFile[] = [];

			for (const file of Array.from(newFiles)) {
				const error = validateFile(file);
				filesToAdd.push({
					file,
					id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
					status: error ? "error" : "pending",
					progress: 0,
					error: error ?? undefined,
				});
			}

			if (!multiple && filesToAdd.length > 0) {
				setFiles([filesToAdd[0]]);
			} else {
				setFiles((prev) => [...prev, ...filesToAdd]);
			}

			// Auto-start upload for valid files
			filesToAdd
				.filter((f) => f.status === "pending")
				.forEach((f) => uploadFile(f));
		},
		[multiple, uploadFile, validateFile]
	);

	// Remove file from list
	const removeFile = useCallback((fileId: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== fileId));
	}, []);

	// Retry failed upload
	const retryUpload = useCallback((fileId: string) => {
		setFiles((prev) =>
			prev.map((f) =>
				f.id === fileId ? { ...f, status: "pending" as const, error: undefined, progress: 0 } : f
			)
		);
		const file = files.find((f) => f.id === fileId);
		if (file) {
			uploadFile({ ...file, status: "pending", error: undefined, progress: 0 });
		}
	}, [files, uploadFile]);

	const retryParsing = useCallback(async (fileId: string) => {
		const file = files.find((f) => f.id === fileId);
		if (!file?.rfpDocumentId) return;

		setFiles((prev) =>
			prev.map((f) =>
				f.id === fileId
					? { ...f, status: "processing" as const, error: undefined, progress: 0, currentStep: "Retry queued" }
					: f
			)
		);

		try {
			const response = await fetch(`/api/v1/rfp/${file.rfpDocumentId}/parse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to retry parsing");
			}
			await pollParsingStatus(fileId, file.rfpDocumentId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to retry parsing";
			setFiles((prev) =>
				prev.map((f) =>
					f.id === fileId ? { ...f, status: "error" as const, error: errorMessage } : f
				)
			);
			onUploadError?.(errorMessage, file.file.name);
		}
	}, [files, onUploadError, pollParsingStatus]);

	// Handle drag events
	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const droppedFiles = e.dataTransfer.files;
			if (droppedFiles.length > 0) {
				addFiles(droppedFiles);
			}
		},
		[addFiles]
	);

	// Handle file input change
	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				addFiles(e.target.files);
				e.target.value = ""; // Reset input
			}
		},
		[addFiles]
	);

	// Get file icon based on type
	const getFileIcon = (filename: string) => {
		const ext = filename.split(".").pop()?.toLowerCase();
		switch (ext) {
			case "pdf":
				return <FileText className="h-5 w-5 text-red-500" />;
			case "docx":
			case "doc":
				return <FileText className="h-5 w-5 text-blue-500" />;
			case "html":
			case "htm":
				return <FileText className="h-5 w-5 text-orange-500" />;
			default:
				return <File className="h-5 w-5 text-muted-foreground" />;
		}
	};

	// Get status icon
	const getStatusIcon = (status: UploadedFile["status"]) => {
		switch (status) {
			case "uploading":
			case "processing":
				return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
			case "completed":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "error":
				return <AlertCircle className="h-4 w-4 text-destructive" />;
			default:
				return null;
		}
	};

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Upload className="h-5 w-5" />
					Upload RFP Documents
				</CardTitle>
				<CardDescription>
					Upload RFP documents to extract requirements and build compliance matrices.
					Supports PDF, DOCX, DOC, and HTML formats.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Drop Zone */}
				<div
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onClick={() => inputRef.current?.click()}
					className={cn(
						"border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
						isDragging
							? "border-primary bg-primary/5"
							: "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
					)}

		role="button"
		tabIndex={0}
		onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
					<input
						ref={inputRef}
						type="file"
						accept={ACCEPTED_EXTENSIONS.join(",")}
						multiple={multiple}
						onChange={handleFileChange}
						className="hidden"
					/>
					<Upload
						className={cn(
							"h-10 w-10 mx-auto mb-4",
							isDragging ? "text-primary" : "text-muted-foreground"
						)}
					/>
					<p className="text-sm font-medium">
						{isDragging
							? "Drop files here..."
							: "Drag and drop RFP files, or click to browse"}
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						PDF, DOCX, DOC, HTML up to {Math.round(maxFileSize / 1024 / 1024)}MB
					</p>
				</div>

				{/* File List */}
				{files.length > 0 && (
					<div className="space-y-2">
						{files.map((uploadedFile) => (
							<div
								key={uploadedFile.id}
								className="flex items-center gap-3 p-3 rounded-lg border bg-card"
							>
								{getFileIcon(uploadedFile.file.name)}
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{uploadedFile.file.name}
									</p>
									<div className="flex items-center gap-2 mt-1">
										{(uploadedFile.status === "uploading" || uploadedFile.status === "processing") && (
											<Progress value={uploadedFile.progress} className="h-1 flex-1" />
										)}
										{uploadedFile.error && (
											<p className="text-xs text-destructive truncate">
												{uploadedFile.error}
											</p>
										)}
										{uploadedFile.status === "processing" && uploadedFile.currentStep && (
											<p className="text-xs text-muted-foreground truncate">
												{uploadedFile.currentStep}
											</p>
										)}
										{uploadedFile.status === "completed" && (
											<p className="text-xs text-green-600">
												Parsing completed
											</p>
										)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{getStatusIcon(uploadedFile.status)}
									{uploadedFile.status === "error" && (
										<>
											{uploadedFile.rfpDocumentId && (
												<Button
													variant="ghost"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														retryParsing(uploadedFile.id);
													}}
												>
													Retry Parse
												</Button>
											)}
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													retryUpload(uploadedFile.id);
												}}
											>
												Retry Upload
											</Button>
										</>
									)}
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={(e) => {
											e.stopPropagation();
											removeFile(uploadedFile.id);
										}}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default RFPUploader;
