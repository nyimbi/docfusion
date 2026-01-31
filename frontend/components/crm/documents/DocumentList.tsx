"use client";

/**
 * Document List Component
 *
 * Displays and manages CRM documents with filtering and actions.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Search,
	Filter,
	FileText,
	File,
	FileImage,
	FileSpreadsheet,
	FileArchive,
	Download,
	Trash2,
	Eye,
	MoreHorizontal,
	Upload,
	Plus,
	AlertCircle,
	Clock,
} from "lucide-react";
import type { CrmDocumentRow } from "@/lib/db/schema-crm";

interface DocumentListProps {
	documents: CrmDocumentRow[];
	onView?: (document: CrmDocumentRow) => void;
	onDownload?: (document: CrmDocumentRow) => void;
	onDelete?: (document: CrmDocumentRow) => void;
	onUpload?: () => void;
	showFilters?: boolean;
	className?: string;
}

// Document type configuration
const documentTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
	cv: { label: "CV/Resume", icon: FileText, color: "blue" },
	certification: { label: "Certification", icon: FileText, color: "green" },
	registration: { label: "Registration", icon: FileText, color: "purple" },
	contract: { label: "Contract", icon: FileText, color: "indigo" },
	proposal: { label: "Proposal", icon: FileText, color: "yellow" },
	nda: { label: "NDA", icon: FileText, color: "red" },
	invoice: { label: "Invoice", icon: FileSpreadsheet, color: "orange" },
	other: { label: "Other", icon: File, color: "gray" },
};

// Get icon based on mime type
const getFileIcon = (mimeType?: string | null) => {
	if (!mimeType) return File;
	if (mimeType.startsWith("image/")) return FileImage;
	if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
	if (mimeType.includes("zip") || mimeType.includes("archive")) return FileArchive;
	return FileText;
};

// Format file size
const formatFileSize = (bytes?: number | null) => {
	if (!bytes) return "-";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function DocumentList({
	documents,
	onView,
	onDownload,
	onDelete,
	onUpload,
	showFilters = true,
	className,
}: DocumentListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [viewMode, setViewMode] = useState<"list" | "grid">("list");

	// Filter documents
	const filteredDocuments = useMemo(() => {
		let result = [...documents];

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(d) =>
					d.name.toLowerCase().includes(query) ||
					d.description?.toLowerCase().includes(query)
			);
		}

		// Type filter
		if (typeFilter !== "all") {
			result = result.filter((d) => d.type === typeFilter);
		}

		return result;
	}, [documents, searchQuery, typeFilter]);

	// Check if document is expiring soon (within 30 days)
	const isExpiringSoon = (doc: CrmDocumentRow) => {
		if (!doc.validTo) return false;
		const daysUntilExpiry = Math.ceil(
			(new Date(doc.validTo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
		);
		return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
	};

	// Check if document is expired
	const isExpired = (doc: CrmDocumentRow) => {
		if (!doc.validTo) return false;
		return new Date(doc.validTo) < new Date();
	};

	// Format date
	const formatDate = (date: Date | string | null) => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Document card for grid view
	const DocumentCard = ({ doc }: { doc: CrmDocumentRow }) => {
		const typeConfig = documentTypeConfig[doc.type] ?? documentTypeConfig.other;
		const FileIcon = getFileIcon(doc.mimeType);

		return (
			<Card
				className={cn(
					"hover:shadow-md transition-shadow cursor-pointer",
					isExpired(doc) && "border-red-200",
					isExpiringSoon(doc) && "border-yellow-200"
				)}
				onClick={() => onView?.(doc)}
			>
				<CardContent className="p-4">
					<div className="flex items-start gap-3">
						<div
							className={cn(
								"h-10 w-10 rounded-md flex items-center justify-center",
								typeConfig.color === "blue" && "bg-blue-100 text-blue-600",
								typeConfig.color === "green" && "bg-green-100 text-green-600",
								typeConfig.color === "purple" && "bg-purple-100 text-purple-600",
								typeConfig.color === "indigo" && "bg-indigo-100 text-indigo-600",
								typeConfig.color === "yellow" && "bg-yellow-100 text-yellow-600",
								typeConfig.color === "red" && "bg-red-100 text-red-600",
								typeConfig.color === "orange" && "bg-orange-100 text-orange-600",
								typeConfig.color === "gray" && "bg-gray-100 text-gray-600"
							)}
						>
							<FileIcon className="h-5 w-5" />
						</div>

						<div className="flex-1 min-w-0">
							<h4 className="font-medium truncate">{doc.name}</h4>
							<div className="flex items-center gap-2 mt-1">
								<Badge variant="secondary" className="text-xs">
									{typeConfig.label}
								</Badge>
								{isExpired(doc) && (
									<Badge variant="destructive" className="text-xs">
										Expired
									</Badge>
								)}
								{isExpiringSoon(doc) && (
									<Badge className="bg-yellow-100 text-yellow-700 text-xs">
										Expiring Soon
									</Badge>
								)}
							</div>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onView?.(doc)}>
									<Eye className="h-4 w-4 mr-2" />
									View
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onDownload?.(doc)}>
									<Download className="h-4 w-4 mr-2" />
									Download
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => onDelete?.(doc)}
									className="text-red-600"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<div className="mt-3 text-xs text-muted-foreground space-y-1">
						<div className="flex justify-between">
							<span>Size: {formatFileSize(doc.fileSize)}</span>
							{doc.version && doc.version > 1 && (
								<span>v{doc.version}</span>
							)}
						</div>
						{doc.validTo && (
							<div className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								Valid until: {formatDate(doc.validTo)}
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		);
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					{showFilters && (
						<>
							<div className="relative w-64">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search documents..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>

							<Select value={typeFilter} onValueChange={setTypeFilter}>
								<SelectTrigger className="w-[150px]">
									<SelectValue placeholder="Filter by type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									{Object.entries(documentTypeConfig).map(([key, config]) => (
										<SelectItem key={key} value={key}>
											{config.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					)}
				</div>

				<Button onClick={onUpload}>
					<Upload className="h-4 w-4 mr-2" />
					Upload Document
				</Button>
			</div>

			{/* View mode toggle */}
			{filteredDocuments.length > 0 && (
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">
						{filteredDocuments.length} documents
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant={viewMode === "list" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode("list")}
						>
							List
						</Button>
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode("grid")}
						>
							Grid
						</Button>
					</div>
				</div>
			)}

			{/* Document List */}
			{filteredDocuments.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<FileText className="h-12 w-12 mb-4" />
					<p>No documents found</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-4"
						onClick={onUpload}
					>
						Upload First Document
					</Button>
				</div>
			) : viewMode === "grid" ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredDocuments.map((doc) => (
						<DocumentCard key={doc.id} doc={doc} />
					))}
				</div>
			) : (
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Size</TableHead>
								<TableHead>Valid Until</TableHead>
								<TableHead>Uploaded</TableHead>
								<TableHead className="w-10"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredDocuments.map((doc) => {
								const typeConfig = documentTypeConfig[doc.type] ?? documentTypeConfig.other;
								const FileIcon = getFileIcon(doc.mimeType);

								return (
									<TableRow
										key={doc.id}
										className={cn(
											"cursor-pointer",
											isExpired(doc) && "bg-red-50",
											isExpiringSoon(doc) && "bg-yellow-50"
										)}
										onClick={() => onView?.(doc)}
									>
										<TableCell>
											<div className="flex items-center gap-3">
												<div
													className={cn(
														"h-8 w-8 rounded flex items-center justify-center",
														typeConfig.color === "blue" && "bg-blue-100 text-blue-600",
														typeConfig.color === "green" && "bg-green-100 text-green-600",
														typeConfig.color === "purple" && "bg-purple-100 text-purple-600",
														typeConfig.color === "indigo" && "bg-indigo-100 text-indigo-600",
														typeConfig.color === "yellow" && "bg-yellow-100 text-yellow-600",
														typeConfig.color === "red" && "bg-red-100 text-red-600",
														typeConfig.color === "orange" && "bg-orange-100 text-orange-600",
														typeConfig.color === "gray" && "bg-gray-100 text-gray-600"
													)}
												>
													<FileIcon className="h-4 w-4" />
												</div>
												<div>
													<span className="font-medium">{doc.name}</span>
													{doc.version && doc.version > 1 && (
														<Badge variant="outline" className="ml-2 text-xs">
															v{doc.version}
														</Badge>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{typeConfig.label}</Badge>
										</TableCell>
										<TableCell>{formatFileSize(doc.fileSize)}</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												{isExpired(doc) && (
													<AlertCircle className="h-4 w-4 text-red-500" />
												)}
												{isExpiringSoon(doc) && (
													<AlertCircle className="h-4 w-4 text-yellow-500" />
												)}
												{formatDate(doc.validTo)}
											</div>
										</TableCell>
										<TableCell>{formatDate(doc.createdAt)}</TableCell>
										<TableCell onClick={(e) => e.stopPropagation()}>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem onClick={() => onView?.(doc)}>
														<Eye className="h-4 w-4 mr-2" />
														View
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => onDownload?.(doc)}>
														<Download className="h-4 w-4 mr-2" />
														Download
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => onDelete?.(doc)}
														className="text-red-600"
													>
														<Trash2 className="h-4 w-4 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

export default DocumentList;
