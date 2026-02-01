/**
 * LaborCategoryManager - Labor Rate Management Interface
 *
 * Manages labor categories with rates, GSA schedule info,
 * effective dates, and CSV import capability.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
	Plus,
	Search,
	Filter,
	Upload,
	Download,
	MoreHorizontal,
	Edit2,
	Trash2,
	Archive,
	AlertCircle,
	Loader2,
	X,
	Users,
	DollarSign,
	Calendar,
	ShieldCheck,
	CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
// Note: LaborLevel type removed - LaborCategory schema doesn't have level field
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type {
	LaborCategory,
} from "@/lib/types/pricing";
import type {
	CreateLaborCategoryInput,
	UpdateLaborCategoryInput,
	LaborCategoryImport,
} from "@/lib/actions/pricing";
import {
	listLaborCategories,
	createLaborCategory,
	updateLaborCategory,
	deleteLaborCategory,
	importLaborCategories,
} from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface LaborCategoryManagerProps {
	/** Organization ID to filter categories */
	organizationId?: string;
	/** Callback when a category is selected */
	onSelect?: (category: LaborCategory) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

function formatDate(date: Date | string | null): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function LaborCategoryManagerSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-64" />
						<Skeleton className="h-9 w-24" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{[1, 2, 3, 4, 5].map((i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Category Form Dialog
// =============================================================================

interface CategoryFormDialogProps {
	category: LaborCategory | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (input: CreateLaborCategoryInput | UpdateLaborCategoryInput) => Promise<void>;
	isSaving: boolean;
}

function CategoryFormDialog({
	category,
	open,
	onOpenChange,
	onSave,
	isSaving,
}: CategoryFormDialogProps) {
	const [formData, setFormData] = useState<CreateLaborCategoryInput>({
		name: "",
		directRate: 0,
		effectiveDate: new Date().toISOString().split("T")[0],
	});

	useEffect(() => {
		if (category) {
			// Format date string helper
			const formatDateStr = (d: string | Date | null | undefined): string | undefined => {
				if (!d) return undefined;
				if (typeof d === "string") return d.split("T")[0];
				return d.toISOString().split("T")[0];
			};

			setFormData({
				name: category.name,
				code: category.code || undefined,
				description: category.description || undefined,
				directRate: category.directRate ?? 0,
				fullyBurdenedRate: category.fullyBurdenedRate ?? undefined,
				effectiveDate: formatDateStr(category.effectiveDate),
				expirationDate: formatDateStr(category.expirationDate),
				gsaScheduleNumber: category.gsaScheduleNumber || undefined,
				gsaSin: category.gsaSin || undefined,
				minExperience: category.minExperience ?? undefined,
				annualEscalation: category.annualEscalation ?? undefined,
			});
		} else {
			setFormData({
				name: "",
				directRate: 0,
				effectiveDate: new Date().toISOString().split("T")[0],
			});
		}
	}, [category, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await onSave(formData);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{category ? "Edit Labor Category" : "Add Labor Category"}
						</DialogTitle>
						<DialogDescription>
							{category
								? "Update the labor category details below."
								: "Enter the details for the new labor category."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Name */}
						<div className="space-y-2">
							<Label htmlFor="name">Category Name *</Label>
							<Input
								id="name"
								value={formData.name}
								onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
								placeholder="e.g., Senior Software Engineer"
								required
							/>
						</div>

						{/* Code */}
						<div className="space-y-2">
							<Label htmlFor="code">Code</Label>
							<Input
								id="code"
								value={formData.code || ""}
								onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value || undefined }))}
								placeholder="e.g., SSE-III"
							/>
						</div>

						{/* Direct Rate */}
						<div className="space-y-2">
							<Label htmlFor="directRate">Direct Rate ($/hr) *</Label>
							<div className="relative">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="directRate"
									type="number"
									step="0.01"
									min="0"
									value={formData.directRate ?? 0}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, directRate: parseFloat(e.target.value) || 0 }))
									}
									className="pl-9"
									required
								/>
							</div>
						</div>

						{/* Fully Burdened Rate */}
						<div className="space-y-2">
							<Label htmlFor="fullyBurdenedRate">Fully Burdened Rate ($/hr)</Label>
							<div className="relative">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="fullyBurdenedRate"
									type="number"
									step="0.01"
									min="0"
									value={formData.fullyBurdenedRate ?? ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, fullyBurdenedRate: parseFloat(e.target.value) || undefined }))
									}
									className="pl-9"
								/>
							</div>
						</div>

						{/* Dates */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="effectiveDate">Effective Date *</Label>
								<Input
									id="effectiveDate"
									type="date"
									value={typeof formData.effectiveDate === "string" ? formData.effectiveDate : ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, effectiveDate: e.target.value }))
									}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="expirationDate">Expiration Date</Label>
								<Input
									id="expirationDate"
									type="date"
									value={typeof formData.expirationDate === "string" ? formData.expirationDate : ""}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											expirationDate: e.target.value || undefined,
										}))
									}
								/>
							</div>
						</div>

						{/* GSA Details */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="gsaScheduleNumber">GSA Schedule Number</Label>
								<Input
									id="gsaScheduleNumber"
									value={formData.gsaScheduleNumber || ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, gsaScheduleNumber: e.target.value || undefined }))
									}
									placeholder="e.g., 47QSMD20R0001"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="gsaSin">GSA SIN</Label>
								<Input
									id="gsaSin"
									value={formData.gsaSin || ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, gsaSin: e.target.value || undefined }))
									}
									placeholder="e.g., 54151S"
								/>
							</div>
						</div>

						{/* Escalation Rate */}
						<div className="space-y-2">
							<Label htmlFor="annualEscalation">Annual Escalation Rate (%)</Label>
							<Input
								id="annualEscalation"
								type="number"
								step="0.1"
								min="0"
								max="100"
								value={formData.annualEscalation ?? ""}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										annualEscalation: parseFloat(e.target.value) || undefined,
									}))
								}
								placeholder="e.g., 3.0"
							/>
						</div>

						{/* Description */}
						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={formData.description || ""}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, description: e.target.value }))
								}
								placeholder="Optional description of this labor category..."
								rows={2}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving}>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : category ? (
								"Update Category"
							) : (
								"Add Category"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// Import Dialog
// =============================================================================

interface ImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImport: (rows: LaborCategoryImport[]) => Promise<void>;
	isImporting: boolean;
}

function ImportDialog({ open, onOpenChange, onImport, isImporting }: ImportDialogProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [previewData, setPreviewData] = useState<LaborCategoryImport[]>([]);
	const [error, setError] = useState<string | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setError(null);
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const text = event.target?.result as string;
				const lines = text.split("\n").filter((line) => line.trim());
				const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

				const rows: LaborCategoryImport[] = [];
				for (let i = 1; i < lines.length; i++) {
					const values = lines[i].split(",");
					const row: LaborCategoryImport = {
						name: values[headers.indexOf("name")] || "",
						code: values[headers.indexOf("code")] || undefined,
						description: values[headers.indexOf("description")] || undefined,
						directRate: parseFloat(values[headers.indexOf("direct_rate")] || values[headers.indexOf("hourly_rate")] || values[headers.indexOf("rate")] || "0"),
						fullyBurdenedRate: parseFloat(values[headers.indexOf("fully_burdened_rate")] || "0") || undefined,
						gsaScheduleNumber: values[headers.indexOf("gsa_schedule")] || values[headers.indexOf("gsa_schedule_number")] || undefined,
						gsaSin: values[headers.indexOf("gsa_sin")] || undefined,
						minExperience: parseInt(values[headers.indexOf("min_experience")] || "0") || undefined,
					};
					if (row.name && row.directRate > 0) {
						rows.push(row);
					}
				}
				setPreviewData(rows);
			} catch (err) {
				setError("Failed to parse CSV file");
			}
		};
		reader.readAsText(file);
	};

	const handleImport = async () => {
		await onImport(previewData);
		setPreviewData([]);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Import Labor Categories</DialogTitle>
					<DialogDescription>
						Upload a CSV file with labor categories. Required columns: name, direct_rate (or hourly_rate)
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="flex items-center gap-4">
						<Input
							ref={fileInputRef}
							type="file"
							accept=".csv"
							onChange={handleFileChange}
							className="flex-1"
						/>
						<Button
							variant="outline"
							onClick={() => {
								const template = "name,code,description,direct_rate,fully_burdened_rate,gsa_schedule_number,gsa_sin,min_experience\n";
								const blob = new Blob([template], { type: "text/csv" });
								const url = URL.createObjectURL(blob);
								const a = document.createElement("a");
								a.href = url;
								a.download = "labor_categories_template.csv";
								a.click();
							}}
						>
							<Download className="h-4 w-4 mr-2" />
							Template
						</Button>
					</div>

					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{previewData.length > 0 && (
						<div className="border rounded-lg overflow-hidden">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Code</TableHead>
										<TableHead>Direct Rate</TableHead>
										<TableHead>GSA Schedule</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{previewData.slice(0, 5).map((row, i) => (
										<TableRow key={i}>
											<TableCell>{row.name}</TableCell>
											<TableCell>{row.code || "-"}</TableCell>
											<TableCell>{formatCurrency(row.directRate)}</TableCell>
											<TableCell>{row.gsaScheduleNumber || "-"}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							{previewData.length > 5 && (
								<div className="p-2 text-center text-sm text-muted-foreground border-t">
									... and {previewData.length - 5} more rows
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleImport} disabled={isImporting || previewData.length === 0}>
						{isImporting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Importing...
							</>
						) : (
							<>
								<Upload className="h-4 w-4 mr-2" />
								Import {previewData.length} Categories
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function LaborCategoryManager({
	organizationId,
	onSelect,
	className,
}: LaborCategoryManagerProps) {
	// State
	const [categories, setCategories] = useState<LaborCategory[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [showGsaOnly, setShowGsaOnly] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<LaborCategory | null>(null);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [deleteDialogCategory, setDeleteDialogCategory] = useState<LaborCategory | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isImporting, setIsImporting] = useState(false);

	// Load categories
	useEffect(() => {
		async function loadCategories() {
			setIsLoading(true);
			setError(null);

			const result = await listLaborCategories(organizationId);
			if (result.success) {
				setCategories(result.data);
			} else {
				setError(result.error);
			}
			setIsLoading(false);
		}
		loadCategories();
	}, [organizationId]);

	// Filter categories locally
	// Note: LaborCategory type doesn't have `level` or `isGsaRate` fields - we derive GSA status from gsaScheduleNumber
	const filteredCategories = useMemo(() => {
		let filtered = categories;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(cat) =>
					cat.name.toLowerCase().includes(q) ||
					cat.description?.toLowerCase().includes(q) ||
					cat.gsaScheduleNumber?.toLowerCase().includes(q) ||
					cat.code?.toLowerCase().includes(q)
			);
		}

		// Note: Level filtering removed since LaborCategory doesn't have a level field
		// If you need level filtering, you would need to add it to the schema

		if (showGsaOnly) {
			// Derive GSA status from presence of gsaScheduleNumber
			filtered = filtered.filter((cat) => !!cat.gsaScheduleNumber);
		}

		return filtered;
	}, [categories, searchQuery, showGsaOnly]);

	// Handlers
	const handleSave = useCallback(
		async (input: CreateLaborCategoryInput | UpdateLaborCategoryInput) => {
			setIsSaving(true);
			try {
				if (editingCategory) {
					const result = await updateLaborCategory(editingCategory.id, input);
					if (result.success && result.data) {
						setCategories((prev) =>
							prev.map((cat) => (cat.id === editingCategory.id ? result.data! : cat))
						);
					}
				} else {
					const result = await createLaborCategory(input as CreateLaborCategoryInput);
					if (result.success && result.data) {
						setCategories((prev) => [result.data!, ...prev]);
					}
				}
				setEditDialogOpen(false);
				setEditingCategory(null);
			} finally {
				setIsSaving(false);
			}
		},
		[editingCategory]
	);

	const handleDelete = useCallback(async () => {
		if (!deleteDialogCategory) return;

		setIsDeleting(true);
		const result = await deleteLaborCategory(deleteDialogCategory.id);
		if (result.success) {
			setCategories((prev) => prev.filter((cat) => cat.id !== deleteDialogCategory.id));
			setDeleteDialogCategory(null);
		}
		setIsDeleting(false);
	}, [deleteDialogCategory]);

	const handleImport = useCallback(async (rows: LaborCategoryImport[]) => {
		setIsImporting(true);
		const result = await importLaborCategories(rows);
		if (result.success) {
			// Reload categories
			const listResult = await listLaborCategories(organizationId);
			if (listResult.success && listResult.data) {
				setCategories(listResult.data);
			}
			setImportDialogOpen(false);
		}
		setIsImporting(false);
	}, [organizationId]);

	// Loading state
	if (isLoading) {
		return <LaborCategoryManagerSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Labor Categories
						{categories.length > 0 && (
							<Badge variant="secondary">{filteredCategories.length}</Badge>
						)}
					</CardTitle>

					<div className="flex items-center gap-2">
						{/* Search */}
						<div className="relative flex-1 md:w-64">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search categories..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
									onClick={() => setSearchQuery("")}
								>
									<X className="h-3 w-3" />
								</Button>
							)}
						</div>

						{/* Filters */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon">
									<Filter className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuCheckboxItem
									checked={showGsaOnly}
									onCheckedChange={setShowGsaOnly}
								>
									<ShieldCheck className="h-4 w-4 mr-2" />
									GSA Rates Only
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Import */}
						<Button variant="outline" onClick={() => setImportDialogOpen(true)}>
							<Upload className="h-4 w-4 mr-2" />
							Import
						</Button>

						{/* Add */}
						<Button
							onClick={() => {
								setEditingCategory(null);
								setEditDialogOpen(true);
							}}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Category
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent>
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Empty State */}
				{filteredCategories.length === 0 && !error && (
					<div className="text-center py-12">
						<Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No labor categories</h3>
						<p className="text-sm text-muted-foreground mt-1">
							{searchQuery || showGsaOnly
								? "Try adjusting your filters"
								: "Add labor categories to start pricing"}
						</p>
						<Button
							onClick={() => {
								setEditingCategory(null);
								setEditDialogOpen(true);
							}}
							className="mt-4"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add First Category
						</Button>
					</div>
				)}

				{/* Categories Table */}
				{filteredCategories.length > 0 && (
					<div className="border rounded-lg overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Category</TableHead>
									<TableHead>Code</TableHead>
									<TableHead className="text-right">Direct Rate</TableHead>
									<TableHead>Effective Date</TableHead>
									<TableHead>GSA</TableHead>
									<TableHead className="w-[50px]"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredCategories.map((category) => (
									<TableRow
										key={category.id}
										className="cursor-pointer hover:bg-muted/50"
										onClick={() => onSelect?.(category)}
									>
										<TableCell>
											<div>
												<div className="font-medium">{category.name}</div>
												{category.description && (
													<div className="text-sm text-muted-foreground truncate max-w-[200px]">
														{category.description}
													</div>
												)}
											</div>
										</TableCell>
										<TableCell>
											{category.code && (
												<Badge variant="secondary">
													{category.code}
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-right font-mono">
											{formatCurrency(category.directRate ?? 0)}/hr
											{category.annualEscalation && (
												<div className="text-xs text-muted-foreground">
													+{category.annualEscalation}%/yr
												</div>
											)}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1 text-sm">
												<Calendar className="h-3 w-3 text-muted-foreground" />
												{formatDate(category.effectiveDate)}
											</div>
											{category.expirationDate && (
												<div className="text-xs text-muted-foreground">
													Expires: {formatDate(category.expirationDate)}
												</div>
											)}
										</TableCell>
										<TableCell>
											{category.gsaScheduleNumber && (
												<div className="flex items-center gap-1">
													<CheckCircle2 className="h-4 w-4 text-green-600" />
													<span className="text-xs text-muted-foreground">
														{category.gsaScheduleNumber}
													</span>
												</div>
											)}
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
													<Button variant="ghost" size="icon" className="h-8 w-8">
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation();
															setEditingCategory(category);
															setEditDialogOpen(true);
														}}
													>
														<Edit2 className="h-4 w-4 mr-2" />
														Edit
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation();
															setDeleteDialogCategory(category);
														}}
														className="text-destructive"
													>
														<Trash2 className="h-4 w-4 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>

			{/* Edit/Create Dialog */}
			<CategoryFormDialog
				category={editingCategory}
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				onSave={handleSave}
				isSaving={isSaving}
			/>

			{/* Import Dialog */}
			<ImportDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				onImport={handleImport}
				isImporting={isImporting}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteDialogCategory} onOpenChange={() => setDeleteDialogCategory(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Labor Category</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteDialogCategory?.name}"?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogCategory(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export default LaborCategoryManager;
