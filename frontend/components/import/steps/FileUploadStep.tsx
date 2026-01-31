"use client";

/**
 * File Upload Step Component
 *
 * First step in the import wizard. Handles file selection via
 * drag-and-drop or file browser.
 */

import { useCallback, useState } from "react";
import { useDropzone, FileRejection, DropEvent } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { useImportStore } from "@/lib/stores/import-store";
import {
	Upload,
	FileSpreadsheet,
	FileText,
	AlertCircle,
	CheckCircle2,
	Loader2,
	X,
	FileUp,
	Table2,
	Columns3,
	Rows3,
} from "lucide-react";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = {
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
	"application/vnd.ms-excel": [".xls"],
	"text/csv": [".csv"],
	"text/tab-separated-values": [".tsv"],
	"text/plain": [".txt", ".csv", ".tsv"],
};

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string): React.ComponentType<{ className?: string }> {
	const ext = filename.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "xlsx":
		case "xls":
			return FileSpreadsheet;
		case "csv":
		case "tsv":
		case "txt":
			return FileText;
		default:
			return FileUp;
	}
}

function getFileTypeBadge(filename: string): { label: string; variant: "default" | "secondary" | "outline" } {
	const ext = filename.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "xlsx":
			return { label: "Excel (.xlsx)", variant: "default" };
		case "xls":
			return { label: "Excel (.xls)", variant: "default" };
		case "csv":
			return { label: "CSV", variant: "secondary" };
		case "tsv":
			return { label: "TSV", variant: "secondary" };
		default:
			return { label: ext?.toUpperCase() || "Unknown", variant: "outline" };
	}
}

export function FileUploadStep() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const file = useImportStore((s) => s.file);
	const parsedData = useImportStore((s) => s.parsedData);
	const setFile = useImportStore((s) => s.setFile);
	const setParsedData = useImportStore((s) => s.setParsedData);
	const clearFile = useImportStore((s) => s.clearFile);

	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			const droppedFile = acceptedFiles[0];
			if (!droppedFile) return;

			setError(null);
			setFile(droppedFile);
			setIsLoading(true);

			try {
				const formData = new FormData();
				formData.append("file", droppedFile);

				const response = await fetch("/api/v1/import/parse", {
					method: "POST",
					body: formData,
					credentials: "include",
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to parse file");
				}

				const data = await response.json();

				if (!data.success) {
					throw new Error(data.error || "Failed to parse file");
				}

				setParsedData(data.data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to parse file");
				clearFile();
			} finally {
				setIsLoading(false);
			}
		},
		[setFile, setParsedData, clearFile]
	);

	const onDropRejected = useCallback(
		(rejections: FileRejection[], event: DropEvent) => {
			const rejection = rejections[0];
			if (!rejection) return;

			const errorMessages = rejection.errors.map((e) => e.message).join(", ");
			setError(errorMessages);
		},
		[]
	);

	const handleClearFile = useCallback(() => {
		clearFile();
		setError(null);
	}, [clearFile]);

	const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } =
		useDropzone({
			onDrop,
			onDropRejected,
			accept: ACCEPTED_FILE_TYPES,
			maxFiles: 1,
			maxSize: MAX_FILE_SIZE,
			disabled: isLoading,
		});

	const FileIcon = file ? getFileIcon(file.name) : Upload;
	const fileBadge = file ? getFileTypeBadge(file.name) : null;

	return (
		<div className="space-y-6 max-w-3xl mx-auto">
			{/* Dropzone Area */}
			<div
				{...getRootProps()}
				className={cn(
					"relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200",
					"hover:border-primary/50 hover:bg-muted/30",
					isDragActive && "border-primary bg-primary/5 scale-[1.02]",
					isDragAccept && "border-green-500 bg-green-50 dark:bg-green-950/20",
					isDragReject && "border-red-500 bg-red-50 dark:bg-red-950/20",
					isLoading && "opacity-50 cursor-not-allowed pointer-events-none",
					file && parsedData && "border-green-500 bg-green-50/50 dark:bg-green-950/10"
				)}
			>
				<input {...getInputProps()} />

				{isLoading && (
					<div className="flex flex-col items-center gap-4">
						<Loader2 className="h-16 w-16 text-primary animate-spin" />
						<div>
							<p className="font-medium text-lg">Parsing file...</p>
							<p className="text-sm text-muted-foreground mt-1">
								Analyzing structure and detecting column types
							</p>
						</div>
					</div>
				)}

				{!isLoading && file && parsedData && (
					<div className="flex flex-col items-center gap-4">
						<div className="relative">
							<div className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
								<FileIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
							</div>
							<CheckCircle2 className="absolute -bottom-1 -right-1 h-8 w-8 text-green-500 bg-background rounded-full" />
						</div>

						<div className="space-y-2">
							<p className="font-medium text-lg">{file.name}</p>
							<div className="flex items-center justify-center gap-2 flex-wrap">
								<Badge variant={fileBadge?.variant}>{fileBadge?.label}</Badge>
								<Badge variant="outline">{formatFileSize(file.size)}</Badge>
							</div>
						</div>

						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								handleClearFile();
							}}
							className="gap-2 text-muted-foreground hover:text-foreground"
						>
							<X className="h-4 w-4" />
							Choose Different File
						</Button>
					</div>
				)}

				{!isLoading && !file && (
					<div className="flex flex-col items-center gap-4">
						<div
							className={cn(
								"w-20 h-20 rounded-2xl flex items-center justify-center transition-colors",
								isDragActive ? "bg-primary/10" : "bg-muted"
							)}
						>
							<Upload
								className={cn(
									"h-10 w-10 transition-colors",
									isDragActive ? "text-primary" : "text-muted-foreground"
								)}
							/>
						</div>

						<div className="space-y-2">
							<p className="font-medium text-lg">
								{isDragActive ? "Drop your file here" : "Drag & drop a file here"}
							</p>
							<p className="text-sm text-muted-foreground">or click to browse your files</p>
						</div>

						<div className="flex items-center gap-4 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<FileSpreadsheet className="h-4 w-4" />
								Excel (.xlsx, .xls)
							</span>
							<span className="flex items-center gap-1">
								<FileText className="h-4 w-4" />
								CSV, TSV
							</span>
						</div>

						<p className="text-xs text-muted-foreground">
							Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
						</p>
					</div>
				)}
			</div>

			{error && (
				<div className="flex items-start gap-3 p-4 bg-destructive/10 text-destructive rounded-lg">
					<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
					<div>
						<p className="font-medium">Upload Failed</p>
						<p className="text-sm opacity-90">{error}</p>
					</div>
				</div>
			)}

			{parsedData && (
				<div className="grid grid-cols-3 gap-4">
					<div className="p-4 bg-muted rounded-lg">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<Rows3 className="h-4 w-4" />
							<span className="text-sm font-medium">Total Rows</span>
						</div>
						<p className="text-2xl font-bold">
							{parsedData.totalRows.toLocaleString()}
						</p>
					</div>

					<div className="p-4 bg-muted rounded-lg">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<Columns3 className="h-4 w-4" />
							<span className="text-sm font-medium">Columns</span>
						</div>
						<p className="text-2xl font-bold">
							{parsedData.headers.length}
						</p>
					</div>

					<div className="p-4 bg-muted rounded-lg">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<Table2 className="h-4 w-4" />
							<span className="text-sm font-medium">Sheet</span>
						</div>
						<p className="text-2xl font-bold truncate">
							{parsedData.metadata?.sheetName || "Default"}
						</p>
					</div>
				</div>
			)}

			{parsedData && parsedData.headers.length > 0 && (
				<div className="space-y-3">
					<h3 className="text-sm font-medium text-muted-foreground">
						Detected Columns
					</h3>
					<div className="flex flex-wrap gap-2">
						{parsedData.headers.map((header: string, index: number) => (
							<Badge key={index} variant="secondary" className="font-mono text-xs">
								{header}
							</Badge>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export default FileUploadStep;
