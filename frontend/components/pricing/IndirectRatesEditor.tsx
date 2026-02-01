/**
 * IndirectRatesEditor - Indirect Rates Management Interface
 *
 * Manages overhead, G&A, fringe, and fee rates with DCAA approval tracking
 * and rate history.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Percent,
	Plus,
	MoreHorizontal,
	Edit2,
	Trash2,
	History,
	ShieldCheck,
	AlertCircle,
	Loader2,
	Calendar,
	CheckCircle2,
	Info,
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
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	IndirectRate,
	IndirectRateType,
	IndirectRateHistory,
	CostElementType,
} from "@/lib/types/pricing";
import type { IndirectRateInput } from "@/lib/actions/pricing";
import {
	listIndirectRates,
	createIndirectRate,
	updateIndirectRate,
	deleteIndirectRate,
} from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface IndirectRatesEditorProps {
	/** Organization ID to manage rates for */
	organizationId?: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RATE_TYPE_CONFIG: Record<
	IndirectRateType,
	{ label: string; description: string; color: string }
> = {
	overhead: {
		label: "Overhead",
		description: "Applied to direct labor costs",
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	},
	fringe: {
		label: "Fringe",
		description: "Employee benefits and taxes",
		color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	},
	ga: {
		label: "G&A",
		description: "General and Administrative",
		color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
	},
	fee: {
		label: "Fee/Profit",
		description: "Contract fee or profit margin",
		color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	},
	escalation: {
		label: "Escalation",
		description: "Annual cost escalation factors",
		color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
	},
};

const COST_TYPE_OPTIONS: { value: CostElementType; label: string }[] = [
	{ value: "labor", label: "Labor" },
	{ value: "odc", label: "ODC" },
	{ value: "subcontract", label: "Subcontract" },
	{ value: "travel", label: "Travel" },
	{ value: "material", label: "Material" },
	{ value: "other", label: "Other" },
];

// =============================================================================
// Utility Functions
// =============================================================================

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

function formatDate(date: Date | string | null): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function IndirectRatesEditorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Rate Form Dialog
// =============================================================================

/** Local form state that maps to IndirectRateInput when submitted */
interface RateFormState {
	rateType: IndirectRateType;
	rateName: string;
	rateValue: number;
	rateBase?: string;
	appliesTo: CostElementType[];
	effectiveStartDate: string;
	effectiveEndDate?: string;
	isApproved?: boolean;
	approvalDate?: string;
}

interface RateFormDialogProps {
	rate: IndirectRate | null;
	organizationId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (input: IndirectRateInput) => Promise<void>;
	isSaving: boolean;
}

function RateFormDialog({
	rate,
	organizationId,
	open,
	onOpenChange,
	onSave,
	isSaving,
}: RateFormDialogProps) {
	const [formData, setFormData] = useState<RateFormState>({
		rateType: "overhead",
		rateName: "",
		rateValue: 0,
		rateBase: "labor",
		appliesTo: ["labor"],
		effectiveStartDate: new Date().toISOString().split("T")[0],
	});

	useEffect(() => {
		if (rate) {
			// Format date string from Date or string
			const formatDateStr = (d: Date | string | null | undefined): string => {
				if (!d) return "";
				if (typeof d === "string") return d.split("T")[0];
				return d.toISOString().split("T")[0];
			};

			setFormData({
				rateType: rate.rateType || "overhead",
				rateName: rate.rateName || "",
				rateValue: rate.rateValue ?? 0,
				rateBase: rate.rateBase || "labor",
				appliesTo: ["labor"], // DB doesn't have appliesTo field
				effectiveStartDate: formatDateStr(rate.effectiveStartDate),
				effectiveEndDate: formatDateStr(rate.effectiveEndDate) || undefined,
				isApproved: rate.isApproved ?? false,
				approvalDate: formatDateStr(rate.approvalDate) || undefined,
			});
		} else {
			setFormData({
				rateType: "overhead",
				rateName: "",
				rateValue: 0,
				rateBase: "labor",
				appliesTo: ["labor"],
				effectiveStartDate: new Date().toISOString().split("T")[0],
			});
		}
	}, [rate, organizationId, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		// Transform form state to IndirectRateInput
		const input: IndirectRateInput = {
			rateName: formData.rateName,
			rateType: formData.rateType,
			rateValue: formData.rateValue,
			rateBase: formData.rateBase as any,
			effectiveStartDate: formData.effectiveStartDate,
			effectiveEndDate: formData.effectiveEndDate,
			isApproved: formData.isApproved,
			approvalDate: formData.approvalDate,
		};
		await onSave(input);
	};

	const toggleCostType = (type: CostElementType) => {
		setFormData((prev) => ({
			...prev,
			appliesTo: prev.appliesTo.includes(type)
				? prev.appliesTo.filter((t) => t !== type)
				: [...prev.appliesTo, type],
		}));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{rate ? "Edit Indirect Rate" : "Add Indirect Rate"}
						</DialogTitle>
						<DialogDescription>
							{rate
								? "Update the indirect rate details."
								: "Add a new indirect rate for cost calculations."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Rate Type */}
						<div className="space-y-2">
							<Label>Rate Type *</Label>
							<Select
								value={formData.rateType}
								onValueChange={(v) =>
									setFormData((prev) => ({ ...prev, rateType: v as IndirectRateType }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(RATE_TYPE_CONFIG).map(([type, config]) => (
										<SelectItem key={type} value={type}>
											<div className="flex flex-col">
												<span>{config.label}</span>
												<span className="text-xs text-muted-foreground">
													{config.description}
												</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Name */}
						<div className="space-y-2">
							<Label htmlFor="rateName">Rate Name *</Label>
							<Input
								id="rateName"
								value={formData.rateName}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, rateName: e.target.value }))
								}
								placeholder="e.g., Overhead Rate FY24"
								required
							/>
						</div>

						{/* Rate */}
						<div className="space-y-2">
							<Label htmlFor="rateValue">Rate (%) *</Label>
							<div className="relative">
								<Input
									id="rateValue"
									type="number"
									step="0.01"
									min="0"
									max="100"
									value={(formData.rateValue * 100).toFixed(2)}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											rateValue: parseFloat(e.target.value) / 100 || 0,
										}))
									}
									className="pr-8"
									required
								/>
								<Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							</div>
						</div>

						{/* Applies To */}
						<div className="space-y-2">
							<Label>Applies To *</Label>
							<div className="flex flex-wrap gap-2">
								{COST_TYPE_OPTIONS.map((option) => (
									<Button
										key={option.value}
										type="button"
										variant={formData.appliesTo.includes(option.value) ? "primary" : "outline"}
										size="sm"
										onClick={() => toggleCostType(option.value)}
									>
										{option.label}
									</Button>
								))}
							</div>
						</div>

						{/* Dates */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="effectiveStartDate">Effective Date *</Label>
								<Input
									id="effectiveStartDate"
									type="date"
									value={formData.effectiveStartDate || ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, effectiveStartDate: e.target.value }))
									}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="effectiveEndDate">Expiration Date</Label>
								<Input
									id="effectiveEndDate"
									type="date"
									value={formData.effectiveEndDate || ""}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											effectiveEndDate: e.target.value || undefined,
										}))
									}
								/>
							</div>
						</div>

						{/* Approval */}
						<div className="space-y-3 p-3 border rounded-lg">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label>Approved</Label>
									<p className="text-sm text-muted-foreground">
										Rate has been audited and approved
									</p>
								</div>
								<Switch
									checked={formData.isApproved || false}
									onCheckedChange={(checked) =>
										setFormData((prev) => ({ ...prev, isApproved: checked }))
									}
								/>
							</div>
							{formData.isApproved && (
								<div className="space-y-2">
									<Label htmlFor="approvalDate">Approval Date</Label>
									<Input
										id="approvalDate"
										type="date"
										value={formData.approvalDate || ""}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												approvalDate: e.target.value || undefined,
											}))
										}
									/>
								</div>
							)}
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
							) : rate ? (
								"Update Rate"
							) : (
								"Add Rate"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// History Dialog
// =============================================================================

interface HistoryDialogProps {
	rate: IndirectRate | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function HistoryDialog({ rate, open, onOpenChange }: HistoryDialogProps) {
	if (!rate) return null;

	const rateName = rate.rateName || "Unknown Rate";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rate History - {rateName}</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[400px]">
					{/* History is not stored in the current DB schema - show current rate only */}
					<div className="space-y-3">
						<div className="p-3 border rounded-lg">
							<div className="flex items-center justify-between">
								<div className="text-lg font-semibold">
									{formatPercent(rate.rateValue ?? 0)}
								</div>
								{rate.isApproved && (
									<Badge variant="secondary" className="gap-1">
										<ShieldCheck className="h-3 w-3" />
										Approved
									</Badge>
								)}
							</div>
							<div className="text-sm text-muted-foreground mt-1">
								Effective: {formatDate(rate.effectiveStartDate)}
								{rate.effectiveEndDate && ` - ${formatDate(rate.effectiveEndDate)}`}
							</div>
							{rate.updatedAt && (
								<div className="text-xs text-muted-foreground mt-1">
									Last updated: {formatDate(rate.updatedAt)}
								</div>
							)}
						</div>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function IndirectRatesEditor({
	organizationId,
	className,
}: IndirectRatesEditorProps) {
	// State
	const [rates, setRates] = useState<IndirectRate[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingRate, setEditingRate] = useState<IndirectRate | null>(null);
	const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
	const [historyRate, setHistoryRate] = useState<IndirectRate | null>(null);
	const [deleteDialogRate, setDeleteDialogRate] = useState<IndirectRate | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	// Load rates
	useEffect(() => {
		async function loadRates() {
			setIsLoading(true);
			setError(null);

			const result = await listIndirectRates(organizationId);
			if (result.success) {
				setRates(result.data);
			} else {
				setError(result.error);
			}
			setIsLoading(false);
		}
		loadRates();
	}, [organizationId]);

	// Handlers
	const handleSave = useCallback(
		async (input: IndirectRateInput) => {
			setIsSaving(true);
			try {
				if (editingRate) {
					const result = await updateIndirectRate(editingRate.id, input);
					if (result.success && result.data) {
						setRates((prev) =>
							prev.map((r) => (r.id === editingRate.id ? result.data! : r))
						);
					}
				} else {
					const result = await createIndirectRate(input);
					if (result.success && result.data) {
						setRates((prev) => [result.data!, ...prev]);
					}
				}
				setEditDialogOpen(false);
				setEditingRate(null);
			} finally {
				setIsSaving(false);
			}
		},
		[editingRate]
	);

	const handleDelete = useCallback(async () => {
		if (!deleteDialogRate) return;

		setIsDeleting(true);
		const result = await deleteIndirectRate(deleteDialogRate.id);
		if (result.success) {
			setRates((prev) => prev.filter((r) => r.id !== deleteDialogRate.id));
			setDeleteDialogRate(null);
		}
		setIsDeleting(false);
	}, [deleteDialogRate]);

	// Loading state
	if (isLoading) {
		return <IndirectRatesEditorSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Percent className="h-5 w-5" />
						Indirect Rates
						{rates.length > 0 && (
							<Badge variant="secondary">{rates.length}</Badge>
						)}
					</CardTitle>

					<Button
						onClick={() => {
							setEditingRate(null);
							setEditDialogOpen(true);
						}}
					>
						<Plus className="h-4 w-4 mr-2" />
						Add Rate
					</Button>
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
				{rates.length === 0 && !error && (
					<div className="text-center py-12">
						<Percent className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No indirect rates</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Add indirect rates for cost calculations
						</p>
						<Button
							onClick={() => {
								setEditingRate(null);
								setEditDialogOpen(true);
							}}
							className="mt-4"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add First Rate
						</Button>
					</div>
				)}

				{/* Rates Table */}
				{rates.length > 0 && (
					<div className="border rounded-lg overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Rate</TableHead>
									<TableHead>Type</TableHead>
									<TableHead className="text-right">Percentage</TableHead>
									<TableHead>Base</TableHead>
									<TableHead>Effective</TableHead>
									<TableHead>Approved</TableHead>
									<TableHead className="w-[50px]"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rates.map((rate) => {
									const rateTypeVal = rate.rateType || "overhead";
									const typeConfig = RATE_TYPE_CONFIG[rateTypeVal];
									const rateName = rate.rateName || "Unnamed Rate";
									const rateValue = rate.rateValue ?? 0;
									const rateBase = rate.rateBase || "labor";
									const effectiveDate = rate.effectiveStartDate;
									const expirationDate = rate.effectiveEndDate;
									const isApproved = rate.isApproved;
									const approvalDate = rate.approvalDate;

									return (
										<TableRow key={rate.id}>
											<TableCell>
												<div className="font-medium">{rateName}</div>
												{rate.rateBase && (
													<div className="text-xs text-muted-foreground capitalize">
														Applied to: {rateBase.replace("_", " ")}
													</div>
												)}
											</TableCell>
											<TableCell>
												<Badge variant="secondary" className={typeConfig?.color || "bg-gray-100"}>
													{typeConfig?.label || rateTypeVal}
												</Badge>
											</TableCell>
											<TableCell className="text-right font-mono text-lg">
												{formatPercent(rateValue)}
											</TableCell>
											<TableCell>
												<Badge variant="outline" className="text-xs capitalize">
													{rateBase.replace("_", " ")}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1 text-sm">
													<Calendar className="h-3 w-3 text-muted-foreground" />
													{formatDate(effectiveDate)}
												</div>
												{expirationDate && (
													<div className="text-xs text-muted-foreground">
														Exp: {formatDate(expirationDate)}
													</div>
												)}
											</TableCell>
											<TableCell>
												{isApproved ? (
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<div className="flex items-center gap-1 text-green-600">
																	<CheckCircle2 className="h-4 w-4" />
																</div>
															</TooltipTrigger>
															<TooltipContent>
																<p>
																	Approved{approvalDate ? `: ${formatDate(approvalDate)}` : ""}
																</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												) : (
													<span className="text-xs text-muted-foreground">Pending</span>
												)}
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon" className="h-8 w-8">
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() => {
																setEditingRate(rate);
																setEditDialogOpen(true);
															}}
														>
															<Edit2 className="h-4 w-4 mr-2" />
															Edit
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => {
																setHistoryRate(rate);
																setHistoryDialogOpen(true);
															}}
														>
															<History className="h-4 w-4 mr-2" />
															View History
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															onClick={() => setDeleteDialogRate(rate)}
															className="text-destructive"
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
			</CardContent>

			{/* Edit/Create Dialog */}
			<RateFormDialog
				rate={editingRate}
				organizationId={organizationId}
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				onSave={handleSave}
				isSaving={isSaving}
			/>

			{/* History Dialog */}
			<HistoryDialog
				rate={historyRate}
				open={historyDialogOpen}
				onOpenChange={setHistoryDialogOpen}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteDialogRate} onOpenChange={() => setDeleteDialogRate(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Indirect Rate</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteDialogRate?.rateName || "this rate"}"?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogRate(null)}
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

export default IndirectRatesEditor;
