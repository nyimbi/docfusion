/**
 * CostElementEditor - Create/Edit Cost Element Interface
 *
 * Tabbed interface for creating and editing different types of cost elements
 * including labor, ODC, subcontract, travel, and material costs.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Users,
	Package,
	Building2,
	Plane,
	DollarSign,
	Clock,
	FileText,
	Calculator,
	Loader2,
	Search,
	AlertCircle,
	Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type {
	CostElement,
	CostElementType,
	CreateCostElementInput,
	LaborCategory,
	TravelDetails,
	ActionResult,
} from "@/lib/types/pricing";
import {
	createCostElement,
	updateCostElement,
	listLaborCategories,
} from "@/lib/actions/pricing";

// =============================================================================
// Local Types for UI Forms (not in database schema)
// These represent UI form state, not database records
// =============================================================================

interface LaborCostDetails {
	laborCategoryId?: string;
	laborCategoryName?: string;
	hours?: number;
	hourlyRate?: number;
	escalatedRate?: number | null;
}

interface ODCDetails {
	itemDescription?: string;
	vendor?: string;
	quoteNumber?: string;
	quantity?: number;
	unitPrice?: number;
}

interface SubcontractDetails {
	subcontractorName?: string;
	scopeOfWork?: string;
	laborHours?: number;
	laborCost?: number;
	odcCost?: number;
	travelCost?: number;
	totalCost?: number;
}

interface MaterialDetails {
	description?: string;
	partNumber?: string;
	vendor?: string;
	quantity?: number;
	unitPrice?: number;
	handlingRate?: number;
}

// =============================================================================
// Types
// =============================================================================

export interface CostElementEditorProps {
	/** Opportunity ID for the cost element */
	opportunityId: string;
	/** Existing element to edit (null for new) */
	element?: CostElement | null;
	/** WBS node to attach to */
	wbsNodeId?: string;
	/** Period to attach to */
	periodId?: string;
	/** Initial type for new elements */
	initialType?: CostElementType;
	/** Callback on save */
	onSave?: (element: CostElement) => void;
	/** Callback on cancel */
	onCancel?: () => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const COST_TYPE_TABS: { value: CostElementType; label: string; icon: typeof Users }[] = [
	{ value: "labor", label: "Labor", icon: Users },
	{ value: "odc", label: "ODC", icon: Package },
	{ value: "subcontract", label: "Subcontract", icon: Building2 },
	{ value: "travel", label: "Travel", icon: Plane },
	{ value: "material", label: "Material", icon: Package },
];

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

// =============================================================================
// Labor Category Picker
// =============================================================================

interface LaborCategoryPickerProps {
	selectedId: string | null;
	onSelect: (category: LaborCategory) => void;
}

function LaborCategoryPicker({ selectedId, onSelect }: LaborCategoryPickerProps) {
	const [open, setOpen] = useState(false);
	const [categories, setCategories] = useState<LaborCategory[]>([]);
	const [search, setSearch] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (open) {
			setIsLoading(true);
			// listLaborCategories takes optional organizationId, filter client-side by search
			listLaborCategories().then((result) => {
				if (result.success && result.data) {
					const filtered = search
						? result.data.filter((c) =>
								c.name.toLowerCase().includes(search.toLowerCase()) ||
								(c.code && c.code.toLowerCase().includes(search.toLowerCase()))
						  )
						: result.data;
					setCategories(filtered);
				}
				setIsLoading(false);
			});
		}
	}, [open, search]);

	const selectedCategory = categories.find((c) => c.id === selectedId);

	return (
		<>
			<Button
				variant="outline"
				className="justify-start w-full"
				onClick={() => setOpen(true)}
			>
				<Users className="h-4 w-4 mr-2" />
				{selectedCategory ? selectedCategory.name : "Select labor category..."}
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Select Labor Category</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search categories..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-9"
							/>
						</div>
						<ScrollArea className="h-[300px]">
							{isLoading ? (
								<div className="flex items-center justify-center h-full">
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								</div>
							) : categories.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									No categories found
								</div>
							) : (
								<div className="space-y-1">
									{categories.map((category) => (
										<button
											key={category.id}
											onClick={() => {
												onSelect(category);
												setOpen(false);
											}}
											className={cn(
												"w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left",
												selectedId === category.id && "bg-muted"
											)}
										>
											<div>
												<div className="font-medium">{category.name}</div>
												{category.code && (
													<div className="text-sm text-muted-foreground">
														{category.code}
													</div>
												)}
											</div>
											<div className="text-right">
												<div className="font-mono">
													{formatCurrency(category.fullyBurdenedRate ?? category.directRate ?? 0)}/hr
												</div>
												{category.gsaScheduleNumber && (
													<div className="text-xs text-green-600">GSA</div>
												)}
											</div>
										</button>
									))}
								</div>
							)}
						</ScrollArea>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

// =============================================================================
// Labor Form
// =============================================================================

interface LaborFormProps {
	details: Partial<LaborCostDetails>;
	onChange: (details: Partial<LaborCostDetails>) => void;
}

function LaborForm({ details, onChange }: LaborFormProps) {
	const [selectedCategory, setSelectedCategory] = useState<LaborCategory | null>(null);

	const handleCategorySelect = (category: LaborCategory) => {
		setSelectedCategory(category);
		onChange({
			...details,
			laborCategoryId: category.id,
			laborCategoryName: category.name,
			hourlyRate: category.fullyBurdenedRate ?? category.directRate ?? 0,
		});
	};

	const totalCost = (details.hourlyRate || 0) * (details.hours || 0);

	return (
		<div className="space-y-4">
			{/* Labor Category Picker */}
			<div className="space-y-2">
				<Label>Labor Category *</Label>
				<LaborCategoryPicker
					selectedId={details.laborCategoryId || null}
					onSelect={handleCategorySelect}
				/>
			</div>

			{/* Rate Display */}
			{details.hourlyRate !== undefined && details.hourlyRate > 0 && (
				<div className="p-3 bg-muted/50 rounded-lg">
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Hourly Rate</span>
						<span className="font-mono font-medium">
							{formatCurrency(details.hourlyRate)}/hr
						</span>
					</div>
					{details.escalatedRate && details.escalatedRate !== details.hourlyRate && (
						<div className="flex items-center justify-between mt-1">
							<span className="text-sm text-muted-foreground">Escalated Rate</span>
							<span className="font-mono font-medium">
								{formatCurrency(details.escalatedRate)}/hr
							</span>
						</div>
					)}
				</div>
			)}

			{/* Hours Input */}
			<div className="space-y-2">
				<Label htmlFor="hours">Hours *</Label>
				<div className="relative">
					<Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						id="hours"
						type="number"
						min="0"
						step="0.5"
						value={details.hours || ""}
						onChange={(e) =>
							onChange({ ...details, hours: parseFloat(e.target.value) || 0 })
						}
						className="pl-9"
						placeholder="0"
					/>
				</div>
			</div>

			{/* Hours Calculator */}
			<div className="p-3 border rounded-lg space-y-2">
				<div className="flex items-center gap-2 text-sm font-medium">
					<Calculator className="h-4 w-4" />
					Quick Calculator
				</div>
				<div className="grid grid-cols-3 gap-2">
					<div className="space-y-1">
						<Label className="text-xs">FTE</Label>
						<Input
							type="number"
							min="0"
							step="0.1"
							placeholder="1.0"
							onChange={(e) => {
								const fte = parseFloat(e.target.value) || 0;
								const months = 12; // Default to 1 year
								const hours = fte * 2080 * (months / 12);
								onChange({ ...details, hours });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Months</Label>
						<Input
							type="number"
							min="0"
							max="60"
							placeholder="12"
							onChange={(e) => {
								const months = parseFloat(e.target.value) || 0;
								const fte = 1; // Default to 1 FTE
								const hours = fte * 2080 * (months / 12);
								onChange({ ...details, hours });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Hrs/Week</Label>
						<Input
							type="number"
							min="0"
							max="60"
							placeholder="40"
							disabled
						/>
					</div>
				</div>
			</div>

			{/* Total */}
			<div className="p-4 bg-primary/10 rounded-lg">
				<div className="flex items-center justify-between">
					<span className="font-medium">Total Labor Cost</span>
					<span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
				</div>
				<div className="text-sm text-muted-foreground mt-1">
					{details.hours?.toLocaleString() || 0} hours @ {formatCurrency(details.hourlyRate || 0)}/hr
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// ODC Form
// =============================================================================

interface ODCFormProps {
	details: Partial<ODCDetails>;
	onChange: (details: Partial<ODCDetails>) => void;
}

function ODCForm({ details, onChange }: ODCFormProps) {
	const totalCost = (details.quantity || 0) * (details.unitPrice || 0);

	return (
		<div className="space-y-4">
			{/* Item Description */}
			<div className="space-y-2">
				<Label htmlFor="itemDescription">Item Description *</Label>
				<Textarea
					id="itemDescription"
					value={details.itemDescription || ""}
					onChange={(e) =>
						onChange({ ...details, itemDescription: e.target.value })
					}
					placeholder="Describe the item or service..."
					rows={2}
				/>
			</div>

			{/* Vendor Info */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="vendor">Vendor</Label>
					<Input
						id="vendor"
						value={details.vendor || ""}
						onChange={(e) => onChange({ ...details, vendor: e.target.value })}
						placeholder="Vendor name"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="quoteNumber">Quote Number</Label>
					<Input
						id="quoteNumber"
						value={details.quoteNumber || ""}
						onChange={(e) => onChange({ ...details, quoteNumber: e.target.value })}
						placeholder="Quote reference"
					/>
				</div>
			</div>

			{/* Quantity and Price */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="quantity">Quantity *</Label>
					<Input
						id="quantity"
						type="number"
						min="0"
						value={details.quantity || ""}
						onChange={(e) =>
							onChange({ ...details, quantity: parseInt(e.target.value) || 0 })
						}
						placeholder="1"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="unitPrice">Unit Price *</Label>
					<div className="relative">
						<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="unitPrice"
							type="number"
							min="0"
							step="0.01"
							value={details.unitPrice || ""}
							onChange={(e) =>
								onChange({ ...details, unitPrice: parseFloat(e.target.value) || 0 })
							}
							className="pl-9"
							placeholder="0.00"
						/>
					</div>
				</div>
			</div>

			{/* Total */}
			<div className="p-4 bg-primary/10 rounded-lg">
				<div className="flex items-center justify-between">
					<span className="font-medium">Total ODC Cost</span>
					<span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
				</div>
				<div className="text-sm text-muted-foreground mt-1">
					{details.quantity || 0} x {formatCurrency(details.unitPrice || 0)}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Subcontract Form
// =============================================================================

interface SubcontractFormProps {
	details: Partial<SubcontractDetails>;
	onChange: (details: Partial<SubcontractDetails>) => void;
}

function SubcontractForm({ details, onChange }: SubcontractFormProps) {
	const totalCost =
		(details.laborCost || 0) +
		(details.odcCost || 0) +
		(details.travelCost || 0);

	return (
		<div className="space-y-4">
			{/* Subcontractor Info */}
			<div className="space-y-2">
				<Label htmlFor="subcontractorName">Subcontractor Name *</Label>
				<Input
					id="subcontractorName"
					value={details.subcontractorName || ""}
					onChange={(e) =>
						onChange({ ...details, subcontractorName: e.target.value })
					}
					placeholder="Subcontractor company name"
				/>
			</div>

			{/* Scope */}
			<div className="space-y-2">
				<Label htmlFor="scopeOfWork">Scope of Work *</Label>
				<Textarea
					id="scopeOfWork"
					value={details.scopeOfWork || ""}
					onChange={(e) => onChange({ ...details, scopeOfWork: e.target.value })}
					placeholder="Describe the subcontractor's scope of work..."
					rows={3}
				/>
			</div>

			{/* Cost Breakdown */}
			<div className="space-y-3">
				<Label>Cost Breakdown</Label>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="laborHours" className="text-sm text-muted-foreground">
							Labor Hours
						</Label>
						<Input
							id="laborHours"
							type="number"
							min="0"
							value={details.laborHours || ""}
							onChange={(e) =>
								onChange({ ...details, laborHours: parseInt(e.target.value) || 0 })
							}
							placeholder="0"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="laborCost" className="text-sm text-muted-foreground">
							Labor Cost
						</Label>
						<div className="relative">
							<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="laborCost"
								type="number"
								min="0"
								step="0.01"
								value={details.laborCost || ""}
								onChange={(e) =>
									onChange({ ...details, laborCost: parseFloat(e.target.value) || 0 })
								}
								className="pl-9"
								placeholder="0.00"
							/>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="odcCost" className="text-sm text-muted-foreground">
							ODC Cost
						</Label>
						<div className="relative">
							<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="odcCost"
								type="number"
								min="0"
								step="0.01"
								value={details.odcCost || ""}
								onChange={(e) =>
									onChange({ ...details, odcCost: parseFloat(e.target.value) || 0 })
								}
								className="pl-9"
								placeholder="0.00"
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="travelCost" className="text-sm text-muted-foreground">
							Travel Cost
						</Label>
						<div className="relative">
							<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="travelCost"
								type="number"
								min="0"
								step="0.01"
								value={details.travelCost || ""}
								onChange={(e) =>
									onChange({ ...details, travelCost: parseFloat(e.target.value) || 0 })
								}
								className="pl-9"
								placeholder="0.00"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Total */}
			<div className="p-4 bg-primary/10 rounded-lg">
				<div className="flex items-center justify-between">
					<span className="font-medium">Total Subcontract Cost</span>
					<span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Travel Form
// =============================================================================

interface TravelFormProps {
	details: Partial<TravelDetails>;
	onChange: (details: Partial<TravelDetails>) => void;
}

function TravelForm({ details, onChange }: TravelFormProps) {
	const totalCost =
		((details.airfare || 0) +
			((details.lodging || 0) + (details.perDiem || 0)) * (details.daysPerTrip || 0) +
			(details.mileage || 0) * (details.mileageRate || 0.67) +
			(details.otherCosts || 0)) *
		(details.travelers || 1) *
		(details.trips || 1);

	return (
		<div className="space-y-4">
			{/* Trip Purpose */}
			<div className="space-y-2">
				<Label htmlFor="tripPurpose">Trip Purpose *</Label>
				<Input
					id="tripPurpose"
					value={details.tripPurpose || ""}
					onChange={(e) => onChange({ ...details, tripPurpose: e.target.value })}
					placeholder="e.g., Kickoff meeting, site visit"
				/>
			</div>

			{/* Locations */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="origin">Origin</Label>
					<Input
						id="origin"
						value={details.origin || ""}
						onChange={(e) => onChange({ ...details, origin: e.target.value })}
						placeholder="Departure city"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="destination">Destination *</Label>
					<Input
						id="destination"
						value={details.destination || ""}
						onChange={(e) => onChange({ ...details, destination: e.target.value })}
						placeholder="Arrival city"
					/>
				</div>
			</div>

			{/* Trip Details */}
			<div className="grid grid-cols-3 gap-4">
				<div className="space-y-2">
					<Label htmlFor="travelers">Travelers *</Label>
					<Input
						id="travelers"
						type="number"
						min="1"
						value={details.travelers || ""}
						onChange={(e) =>
							onChange({ ...details, travelers: parseInt(e.target.value) || 1 })
						}
						placeholder="1"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="trips">Number of Trips *</Label>
					<Input
						id="trips"
						type="number"
						min="1"
						value={details.trips || ""}
						onChange={(e) =>
							onChange({ ...details, trips: parseInt(e.target.value) || 1 })
						}
						placeholder="1"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="daysPerTrip">Days per Trip *</Label>
					<Input
						id="daysPerTrip"
						type="number"
						min="1"
						value={details.daysPerTrip || ""}
						onChange={(e) =>
							onChange({ ...details, daysPerTrip: parseInt(e.target.value) || 1 })
						}
						placeholder="1"
					/>
				</div>
			</div>

			{/* Costs */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="airfare">Airfare (per person/trip)</Label>
					<div className="relative">
						<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="airfare"
							type="number"
							min="0"
							step="0.01"
							value={details.airfare || ""}
							onChange={(e) =>
								onChange({ ...details, airfare: parseFloat(e.target.value) || 0 })
							}
							className="pl-9"
							placeholder="0.00"
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="lodging">Lodging (per night)</Label>
					<div className="relative">
						<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="lodging"
							type="number"
							min="0"
							step="0.01"
							value={details.lodging || ""}
							onChange={(e) =>
								onChange({ ...details, lodging: parseFloat(e.target.value) || 0 })
							}
							className="pl-9"
							placeholder="0.00"
						/>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="perDiem">Per Diem (per day)</Label>
					<div className="relative">
						<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="perDiem"
							type="number"
							min="0"
							step="0.01"
							value={details.perDiem || ""}
							onChange={(e) =>
								onChange({ ...details, perDiem: parseFloat(e.target.value) || 0 })
							}
							className="pl-9"
							placeholder="0.00"
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="mileage">Mileage (total miles)</Label>
					<Input
						id="mileage"
						type="number"
						min="0"
						value={details.mileage || ""}
						onChange={(e) =>
							onChange({ ...details, mileage: parseFloat(e.target.value) || 0 })
						}
						placeholder="0"
					/>
				</div>
			</div>

			{/* Total */}
			<div className="p-4 bg-primary/10 rounded-lg">
				<div className="flex items-center justify-between">
					<span className="font-medium">Total Travel Cost</span>
					<span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
				</div>
				<div className="text-sm text-muted-foreground mt-1">
					{details.travelers || 1} travelers x {details.trips || 1} trips x{" "}
					{details.daysPerTrip || 1} days
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Material Form
// =============================================================================

interface MaterialFormProps {
	details: Partial<MaterialDetails>;
	onChange: (details: Partial<MaterialDetails>) => void;
}

function MaterialForm({ details, onChange }: MaterialFormProps) {
	const subtotal = (details.quantity || 0) * (details.unitPrice || 0);
	const handling = subtotal * (details.handlingRate || 0);
	const totalCost = subtotal + handling;

	return (
		<div className="space-y-4">
			{/* Description */}
			<div className="space-y-2">
				<Label htmlFor="description">Description *</Label>
				<Textarea
					id="description"
					value={details.description || ""}
					onChange={(e) => onChange({ ...details, description: e.target.value })}
					placeholder="Describe the material..."
					rows={2}
				/>
			</div>

			{/* Part and Vendor */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="partNumber">Part Number</Label>
					<Input
						id="partNumber"
						value={details.partNumber || ""}
						onChange={(e) => onChange({ ...details, partNumber: e.target.value })}
						placeholder="Part/SKU number"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="vendor">Vendor</Label>
					<Input
						id="vendor"
						value={details.vendor || ""}
						onChange={(e) => onChange({ ...details, vendor: e.target.value })}
						placeholder="Vendor name"
					/>
				</div>
			</div>

			{/* Quantity and Price */}
			<div className="grid grid-cols-3 gap-4">
				<div className="space-y-2">
					<Label htmlFor="quantity">Quantity *</Label>
					<Input
						id="quantity"
						type="number"
						min="0"
						value={details.quantity || ""}
						onChange={(e) =>
							onChange({ ...details, quantity: parseInt(e.target.value) || 0 })
						}
						placeholder="1"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="unitPrice">Unit Price *</Label>
					<div className="relative">
						<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="unitPrice"
							type="number"
							min="0"
							step="0.01"
							value={details.unitPrice || ""}
							onChange={(e) =>
								onChange({ ...details, unitPrice: parseFloat(e.target.value) || 0 })
							}
							className="pl-9"
							placeholder="0.00"
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="handlingRate">Handling Rate (%)</Label>
					<Input
						id="handlingRate"
						type="number"
						min="0"
						max="1"
						step="0.01"
						value={details.handlingRate ? details.handlingRate * 100 : ""}
						onChange={(e) =>
							onChange({ ...details, handlingRate: (parseFloat(e.target.value) || 0) / 100 })
						}
						placeholder="0"
					/>
				</div>
			</div>

			{/* Total */}
			<div className="p-4 bg-primary/10 rounded-lg">
				<div className="space-y-1">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Subtotal</span>
						<span>{formatCurrency(subtotal)}</span>
					</div>
					{handling > 0 && (
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Material Handling</span>
							<span>{formatCurrency(handling)}</span>
						</div>
					)}
					<Separator className="my-2" />
					<div className="flex items-center justify-between">
						<span className="font-medium">Total Material Cost</span>
						<span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CostElementEditor({
	opportunityId,
	element,
	wbsNodeId,
	periodId,
	initialType = "labor",
	onSave,
	onCancel,
	className,
}: CostElementEditorProps) {
	// Helper to extract labor details from flat CostElement
	const extractLaborDetails = (el: CostElement | null | undefined): Partial<LaborCostDetails> => {
		if (!el) return {};
		return {
			laborCategoryId: el.laborCategoryId ?? undefined,
			laborCategoryName: el.laborCategoryName ?? undefined,
			hours: el.hours ?? undefined,
			hourlyRate: el.rate ?? undefined,
		};
	};

	// Helper to extract ODC details from flat CostElement
	const extractOdcDetails = (el: CostElement | null | undefined): Partial<ODCDetails> => {
		if (!el) return {};
		return {
			itemDescription: el.odcDescription ?? undefined,
			vendor: el.odcVendor ?? undefined,
			quoteNumber: el.odcQuoteReference ?? undefined,
			quantity: 1, // Schema doesn't have quantity, just amount
			unitPrice: el.odcAmount ?? undefined,
		};
	};

	// Helper to extract subcontract details from flat CostElement
	const extractSubcontractDetails = (el: CostElement | null | undefined): Partial<SubcontractDetails> => {
		if (!el) return {};
		return {
			subcontractorName: el.subcontractorName ?? undefined,
			scopeOfWork: el.subcontractorRole ?? undefined,
			laborCost: el.subcontractorCost ?? undefined,
			totalCost: el.subcontractorCost ?? undefined,
		};
	};

	// Helper to extract travel details from flat CostElement
	const extractTravelDetails = (el: CostElement | null | undefined): Partial<TravelDetails> => {
		if (!el) return {};
		return {
			tripPurpose: el.travelDescription ?? "",
			destination: "",
			origin: "",
			travelers: 1,
			trips: el.travelTrips ?? 1,
			daysPerTrip: el.travelDaysPerTrip ?? 1,
			airfare: el.travelCostPerTrip ?? null,
			lodging: null,
			perDiem: null,
			mileage: null,
			mileageRate: null,
			otherCosts: null,
			totalCost: el.travelCost ?? 0,
		};
	};

	// Helper to extract material details from flat CostElement
	const extractMaterialDetails = (el: CostElement | null | undefined): Partial<MaterialDetails> => {
		if (!el) return {};
		return {
			description: el.materialDescription ?? undefined,
			quantity: 1,
			unitPrice: el.materialCost ?? undefined,
		};
	};

	// State
	const [activeTab, setActiveTab] = useState<CostElementType>(
		element?.elementType || initialType
	);
	const [name, setName] = useState(element?.wbsTitle || "");
	const [description, setDescription] = useState(element?.wbsCode || "");
	const [boeNarrative, setBoeNarrative] = useState(element?.boeNarrative || "");
	const [laborDetails, setLaborDetails] = useState<Partial<LaborCostDetails>>(
		extractLaborDetails(element)
	);
	const [odcDetails, setOdcDetails] = useState<Partial<ODCDetails>>(
		extractOdcDetails(element)
	);
	const [subcontractDetails, setSubcontractDetails] = useState<Partial<SubcontractDetails>>(
		extractSubcontractDetails(element)
	);
	const [travelDetails, setTravelDetails] = useState<Partial<TravelDetails>>(
		extractTravelDetails(element)
	);
	const [materialDetails, setMaterialDetails] = useState<Partial<MaterialDetails>>(
		extractMaterialDetails(element)
	);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset form when element changes
	useEffect(() => {
		if (element) {
			setActiveTab(element.elementType || initialType);
			setName(element.wbsTitle || "");
			setDescription(element.wbsCode || "");
			setBoeNarrative(element.boeNarrative || "");
			setLaborDetails(extractLaborDetails(element));
			setOdcDetails(extractOdcDetails(element));
			setSubcontractDetails(extractSubcontractDetails(element));
			setTravelDetails(extractTravelDetails(element));
			setMaterialDetails(extractMaterialDetails(element));
		}
	}, [element, initialType]);

	// Handle save
	const handleSave = useCallback(async () => {
		if (!name.trim()) {
			setError("Name is required");
			return;
		}

		setIsSaving(true);
		setError(null);

		// Build the input using flat field structure matching CreateCostElementInput
		const input: CreateCostElementInput = {
			opportunityId,
			wbsCode: description.trim() || undefined,
			wbsTitle: name.trim(),
			technicalSectionId: undefined,
			elementType: activeTab,
			boeNarrative: boeNarrative.trim() || undefined,
		};

		// Add type-specific fields (flat, not nested)
		switch (activeTab) {
			case "labor":
				if (!laborDetails.laborCategoryId || !laborDetails.hours) {
					setError("Labor category and hours are required");
					setIsSaving(false);
					return;
				}
				input.laborCategoryId = laborDetails.laborCategoryId;
				input.laborCategoryName = laborDetails.laborCategoryName;
				input.hours = laborDetails.hours;
				input.rate = laborDetails.hourlyRate;
				break;
			case "odc":
				if (!odcDetails.itemDescription || !odcDetails.unitPrice) {
					setError("Item description and unit price are required");
					setIsSaving(false);
					return;
				}
				input.odcDescription = odcDetails.itemDescription;
				input.odcVendor = odcDetails.vendor;
				input.odcQuoteReference = odcDetails.quoteNumber;
				input.odcAmount = (odcDetails.quantity || 1) * (odcDetails.unitPrice || 0);
				break;
			case "subcontract":
				if (!subcontractDetails.subcontractorName || !subcontractDetails.scopeOfWork) {
					setError("Subcontractor name and scope are required");
					setIsSaving(false);
					return;
				}
				input.subcontractorName = subcontractDetails.subcontractorName;
				input.subcontractorRole = subcontractDetails.scopeOfWork;
				input.subcontractorCost =
					(subcontractDetails.laborCost || 0) +
					(subcontractDetails.odcCost || 0) +
					(subcontractDetails.travelCost || 0);
				break;
			case "travel":
				if (!travelDetails.tripPurpose || !travelDetails.destination) {
					setError("Trip purpose and destination are required");
					setIsSaving(false);
					return;
				}
				input.travelDescription = `${travelDetails.tripPurpose}: ${travelDetails.origin || "TBD"} to ${travelDetails.destination}`;
				input.travelTrips = travelDetails.trips || 1;
				input.travelDaysPerTrip = travelDetails.daysPerTrip || 1;
				// Calculate cost per trip from airfare + lodging + per diem
				input.travelCostPerTrip =
					(travelDetails.airfare || 0) +
					((travelDetails.lodging || 0) + (travelDetails.perDiem || 0)) * (travelDetails.daysPerTrip || 1) +
					(travelDetails.mileage || 0) * (travelDetails.mileageRate || 0.67) +
					(travelDetails.otherCosts || 0);
				break;
			case "material":
				if (!materialDetails.description || !materialDetails.unitPrice) {
					setError("Description and unit price are required");
					setIsSaving(false);
					return;
				}
				input.materialDescription = materialDetails.description;
				input.materialCost = (materialDetails.quantity || 1) * (materialDetails.unitPrice || 0) *
					(1 + (materialDetails.handlingRate || 0));
				break;
		}

		try {
			let result: ActionResult<CostElement>;
			if (element) {
				result = await updateCostElement(element.id, input);
			} else {
				result = await createCostElement(input);
			}

			if (result.success && result.data) {
				onSave?.(result.data);
			} else if (!result.success) {
				setError(result.error || "Failed to save cost element");
			}
		} catch (err) {
			setError("An unexpected error occurred");
		}

		setIsSaving(false);
	}, [
		opportunityId,
		element,
		activeTab,
		name,
		description,
		boeNarrative,
		laborDetails,
		odcDetails,
		subcontractDetails,
		travelDetails,
		materialDetails,
		onSave,
	]);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<DollarSign className="h-5 w-5" />
					{element ? "Edit Cost Element" : "New Cost Element"}
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Name and Description */}
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Element Name *</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Senior Developer - Task 1"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Brief description of this cost element..."
							rows={2}
						/>
					</div>
				</div>

				{/* Cost Type Tabs */}
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CostElementType)}>
					<TabsList className="w-full justify-start">
						{COST_TYPE_TABS.map((tab) => {
							const Icon = tab.icon;
							return (
								<TabsTrigger key={tab.value} value={tab.value} className="gap-1">
									<Icon className="h-4 w-4" />
									{tab.label}
								</TabsTrigger>
							);
						})}
					</TabsList>

					<TabsContent value="labor" className="mt-4">
						<LaborForm details={laborDetails} onChange={setLaborDetails} />
					</TabsContent>

					<TabsContent value="odc" className="mt-4">
						<ODCForm details={odcDetails} onChange={setOdcDetails} />
					</TabsContent>

					<TabsContent value="subcontract" className="mt-4">
						<SubcontractForm details={subcontractDetails} onChange={setSubcontractDetails} />
					</TabsContent>

					<TabsContent value="travel" className="mt-4">
						<TravelForm details={travelDetails} onChange={setTravelDetails} />
					</TabsContent>

					<TabsContent value="material" className="mt-4">
						<MaterialForm details={materialDetails} onChange={setMaterialDetails} />
					</TabsContent>
				</Tabs>

				{/* BOE Narrative */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="boeNarrative">Basis of Estimate (BOE)</Label>
						<Button variant="ghost" size="sm" className="gap-1 text-xs">
							<Sparkles className="h-3 w-3" />
							Generate with AI
						</Button>
					</div>
					<Textarea
						id="boeNarrative"
						value={boeNarrative}
						onChange={(e) => setBoeNarrative(e.target.value)}
						placeholder="Describe the basis for this cost estimate..."
						rows={4}
					/>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-end gap-2 pt-4 border-t">
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isSaving}>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : element ? (
							"Update Element"
						) : (
							"Create Element"
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default CostElementEditor;
