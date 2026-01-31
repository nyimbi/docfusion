"use client";

/**
 * Account Filters Component
 *
 * Advanced filtering panel for account lists with multiple filter criteria.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	SheetFooter,
} from "@/components/ui/sheet";
import {
	Filter,
	X,
	Calendar as CalendarIcon,
	ChevronDown,
	RotateCcw,
} from "lucide-react";
import type { AccountType, AccountFilters as AccountFiltersType, CompanySize } from "@/lib/types/crm";
import { ACCOUNT_STAGES } from "@/lib/types/crm";

interface AccountFiltersProps {
	filters?: AccountFiltersType;
	onFiltersChange?: (filters: AccountFiltersType) => void;
	/** Control Sheet open state externally */
	isOpen?: boolean;
	onClose?: () => void;
	onApply?: (filters: AccountFiltersType) => void;
	accountType?: AccountType;
	showTypeFilter?: boolean;
	className?: string;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
	{ value: "partner", label: "Partners" },
	{ value: "prospect", label: "Prospects" },
	{ value: "lead", label: "Leads" },
	{ value: "customer", label: "Customers" },
	{ value: "vendor", label: "Vendors" },
	{ value: "other", label: "Other" },
];

const INDUSTRIES = [
	"Technology",
	"Healthcare",
	"Finance",
	"Manufacturing",
	"Retail",
	"Education",
	"Government",
	"Energy",
	"Transportation",
	"Real Estate",
	"Professional Services",
	"Media & Entertainment",
	"Other",
];

const COMPANY_SIZES = [
	{ value: "micro", label: "Micro (1-10)" },
	{ value: "small", label: "Small (11-50)" },
	{ value: "medium", label: "Medium (51-200)" },
	{ value: "large", label: "Large (201-1000)" },
	{ value: "enterprise", label: "Enterprise (1000+)" },
];

export function AccountFilters({
	filters = {},
	onFiltersChange,
	isOpen: controlledOpen,
	onClose,
	onApply,
	accountType,
	showTypeFilter = true,
	className,
}: AccountFiltersProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isOpen = controlledOpen ?? internalOpen;
	const setIsOpen = onClose ? (open: boolean) => { if (!open) onClose(); } : setInternalOpen;
	const [localFilters, setLocalFilters] = useState<AccountFiltersType>(filters);

	// Get stages based on account type
	const getStages = useCallback(() => {
		const type = localFilters.type?.[0] || accountType;
		if (!type) return [];

		const stageConfig = ACCOUNT_STAGES[type as AccountType];
		if (!stageConfig) return [];

		return Object.entries(stageConfig).map(([value, config]) => ({
			value,
			label: config.label,
		}));
	}, [localFilters.type, accountType]);

	// Count active filters
	const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
		if (key === "search") return false;
		if (Array.isArray(value)) return value.length > 0;
		if (typeof value === "object" && value !== null) {
			return Object.values(value).some((v) => v !== undefined);
		}
		return value !== undefined && value !== null;
	}).length;

	// Update local filter
	const updateFilter = <K extends keyof AccountFiltersType>(
		key: K,
		value: AccountFiltersType[K]
	) => {
		setLocalFilters((prev) => ({ ...prev, [key]: value }));
	};

	// Apply filters
	const applyFilters = () => {
		if (onApply) {
			onApply(localFilters);
		} else if (onFiltersChange) {
			onFiltersChange(localFilters);
		}
		setIsOpen(false);
	};

	// Reset filters
	const resetFilters = () => {
		const emptyFilters: AccountFiltersType = {};
		setLocalFilters(emptyFilters);
		if (onFiltersChange) {
			onFiltersChange(emptyFilters);
		}
	};

	// Helper to ensure array format for filter values
	const asArray = <T,>(value: T | T[] | undefined): T[] => {
		if (!value) return [];
		return Array.isArray(value) ? value : [value];
	};

	// Quick filter chips
	const QuickFilters = () => (
		<div className="flex flex-wrap items-center gap-2">
			{/* Type filter chips */}
			{onFiltersChange && asArray(filters.type).map((type) => (
				<FilterChip
					key={type}
					label={ACCOUNT_TYPES.find((t) => t.value === type)?.label || type}
					onRemove={() => {
						const newTypes = asArray(filters.type).filter((t) => t !== type);
						onFiltersChange({
							...filters,
							type: newTypes.length ? newTypes : undefined,
						});
					}}
				/>
			))}

			{/* Stage filter chips */}
			{onFiltersChange && asArray(filters.stage).map((stage) => (
				<FilterChip
					key={stage}
					label={stage}
					onRemove={() => {
						const newStages = asArray(filters.stage).filter((s) => s !== stage);
						onFiltersChange({
							...filters,
							stage: newStages.length ? newStages : undefined,
						});
					}}
				/>
			))}

			{/* Industry filter chips */}
			{onFiltersChange && asArray(filters.industry).map((industry) => (
				<FilterChip
					key={industry}
					label={industry}
					onRemove={() => {
						const newIndustries = asArray(filters.industry).filter((i) => i !== industry);
						onFiltersChange({
							...filters,
							industry: newIndustries.length ? newIndustries : undefined,
						});
					}}
				/>
			))}

			{/* Score range chip */}
			{onFiltersChange && (filters.leadScoreMin !== undefined || filters.leadScoreMax !== undefined) && (
				<FilterChip
					label={`Score: ${filters.leadScoreMin ?? 0}-${filters.leadScoreMax ?? 100}`}
					onRemove={() => {
						onFiltersChange({
							...filters,
							leadScoreMin: undefined,
							leadScoreMax: undefined,
						});
					}}
				/>
			)}

			{/* Date range chip */}
			{onFiltersChange && (filters.lastContactAfter || filters.lastContactBefore) && (
				<FilterChip
					label="Last Contact"
					onRemove={() => {
						onFiltersChange({
							...filters,
							lastContactAfter: undefined,
							lastContactBefore: undefined,
						});
					}}
				/>
			)}

			{activeFilterCount > 0 && (
				<Button
					variant="ghost"
					size="sm"
					onClick={resetFilters}
					className="h-7 text-xs"
				>
					<RotateCcw className="h-3 w-3 mr-1" />
					Clear all
				</Button>
			)}
		</div>
	);

	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex items-center gap-2">
				<Sheet open={isOpen} onOpenChange={setIsOpen}>
					<SheetTrigger asChild>
						<Button variant="outline" size="sm" className="relative">
							<Filter className="h-4 w-4 mr-2" />
							Filters
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
									{activeFilterCount}
								</span>
							)}
						</Button>
					</SheetTrigger>
					<SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
						<SheetHeader>
							<SheetTitle>Filter Accounts</SheetTitle>
						</SheetHeader>

						<div className="space-y-6 py-6">
							{/* Account Type */}
							{showTypeFilter && (
								<div className="space-y-2">
									<Label>Account Type</Label>
									<div className="grid grid-cols-2 gap-2">
										{ACCOUNT_TYPES.map((type) => (
											<label
												key={type.value}
												className="flex items-center gap-2 cursor-pointer"
											>
												<Checkbox
													checked={asArray(localFilters.type).includes(type.value)}
													onCheckedChange={(checked) => {
														const current = asArray(localFilters.type);
														if (checked) {
															updateFilter("type", [...current, type.value]);
														} else {
															updateFilter(
																"type",
																current.filter((t) => t !== type.value)
															);
														}
													}}
												/>
												<span className="text-sm">{type.label}</span>
											</label>
										))}
									</div>
								</div>
							)}

							{/* Pipeline Stage */}
							<div className="space-y-2">
								<Label>Pipeline Stage</Label>
								<div className="grid grid-cols-2 gap-2">
									{getStages().map((stage) => (
										<label
											key={stage.value}
											className="flex items-center gap-2 cursor-pointer"
										>
											<Checkbox
												checked={asArray(localFilters.stage).includes(stage.value)}
												onCheckedChange={(checked) => {
													const current = asArray(localFilters.stage);
													if (checked) {
														updateFilter("stage", [...current, stage.value]);
													} else {
														updateFilter(
															"stage",
															current.filter((s) => s !== stage.value)
														);
													}
												}}
											/>
											<span className="text-sm">{stage.label}</span>
										</label>
									))}
								</div>
							</div>

							{/* Industry */}
							<div className="space-y-2">
								<Label>Industry</Label>
								<Select
									value={localFilters.industry?.[0] || ""}
									onValueChange={(value) => {
										updateFilter("industry", value ? [value] : undefined);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select industry" />
									</SelectTrigger>
									<SelectContent>
										{INDUSTRIES.map((industry) => (
											<SelectItem key={industry} value={industry}>
												{industry}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Company Size */}
							<div className="space-y-2">
								<Label>Company Size</Label>
								<Select
									value={asArray(localFilters.companySize)[0] || ""}
									onValueChange={(value) => {
										updateFilter("companySize", value ? [value as CompanySize] : undefined);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select size" />
									</SelectTrigger>
									<SelectContent>
										{COMPANY_SIZES.map((size) => (
											<SelectItem key={size.value} value={size.value}>
												{size.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Location */}
							<div className="space-y-2">
								<Label>Location</Label>
								<div className="grid grid-cols-2 gap-2">
									<Input
										placeholder="Country"
										value={localFilters.country?.[0] || ""}
										onChange={(e) =>
											updateFilter(
												"country",
												e.target.value ? [e.target.value] : undefined
											)
										}
									/>
									<Input
										placeholder="Region"
										value={localFilters.region?.[0] || ""}
										onChange={(e) =>
											updateFilter(
												"region",
												e.target.value ? [e.target.value] : undefined
											)
										}
									/>
								</div>
							</div>

							{/* Lead Score Range */}
							<div className="space-y-2">
								<Label>
									Lead Score Range: {localFilters.leadScoreMin ?? 0} -{" "}
									{localFilters.leadScoreMax ?? 100}
								</Label>
								<Slider
									min={0}
									max={100}
									step={5}
									value={[
										localFilters.leadScoreMin ?? 0,
										localFilters.leadScoreMax ?? 100,
									]}
									onValueChange={([min, max]) => {
										updateFilter("leadScoreMin", min > 0 ? min : undefined);
										updateFilter("leadScoreMax", max < 100 ? max : undefined);
									}}
								/>
							</div>

							{/* Last Contact Date Range */}
							<div className="space-y-2">
								<Label>Last Contact</Label>
								<div className="grid grid-cols-2 gap-2">
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className="justify-start text-left font-normal"
											>
												<CalendarIcon className="mr-2 h-4 w-4" />
												{localFilters.lastContactAfter
													? new Date(localFilters.lastContactAfter).toLocaleDateString()
													: "After..."}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={localFilters.lastContactAfter}
												onSelect={(date) =>
													updateFilter("lastContactAfter", date)
												}
											/>
										</PopoverContent>
									</Popover>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className="justify-start text-left font-normal"
											>
												<CalendarIcon className="mr-2 h-4 w-4" />
												{localFilters.lastContactBefore
													? new Date(localFilters.lastContactBefore).toLocaleDateString()
													: "Before..."}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={localFilters.lastContactBefore}
												onSelect={(date) =>
													updateFilter("lastContactBefore", date)
												}
											/>
										</PopoverContent>
									</Popover>
								</div>
							</div>

							{/* Tags */}
							<div className="space-y-2">
								<Label>Tags</Label>
								<Input
									placeholder="Enter tags (comma separated)"
									value={localFilters.tags?.join(", ") || ""}
									onChange={(e) => {
										const tags = e.target.value
											.split(",")
											.map((t) => t.trim())
											.filter(Boolean);
										updateFilter("tags", tags.length ? tags : undefined);
									}}
								/>
							</div>

							{/* Owner */}
							<div className="space-y-2">
								<Label>Owner</Label>
								<Input
									placeholder="Owner ID or name"
									value={localFilters.ownerId || ""}
									onChange={(e) =>
										updateFilter("ownerId", e.target.value || undefined)
									}
								/>
							</div>
						</div>

						<SheetFooter className="gap-2">
							<Button variant="outline" onClick={resetFilters}>
								Reset
							</Button>
							<Button onClick={applyFilters}>Apply Filters</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>

				<QuickFilters />
			</div>
		</div>
	);
}

// Filter chip component
function FilterChip({
	label,
	onRemove,
}: {
	label: string;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
			{label}
			<button
				onClick={onRemove}
				className="hover:bg-muted-foreground/20 rounded-full p-0.5"
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}

export default AccountFilters;
