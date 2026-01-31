"use client";

/**
 * Table Select Step Component
 *
 * Second step in the import wizard. Allows users to select
 * the destination table for their data import.
 *
 * Features:
 * - Visual table selection cards
 * - Table schema preview with required/optional fields
 * - Description of each table's purpose
 * - Auto-selection if only one valid target
 */

import { useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	useImportStore,
	useTargetTable,
	useTargetSchema,
	useParsedData,
} from "@/lib/stores/import-store";
import { IMPORT_TARGETS, TABLE_SCHEMAS } from "@/lib/import/table-schemas";
import type { ImportTargetTable } from "@/lib/types/import";
import {
	Target,
	Users,
	Building2,
	Handshake,
	CheckCircle2,
	Circle,
	ChevronRight,
	AlertCircle,
	Hash,
	Mail,
	Calendar,
	Type,
	ToggleLeft,
	Link2,
} from "lucide-react";

/**
 * Icon mapping for target tables
 */
const TABLE_ICONS: Record<ImportTargetTable, React.ComponentType<{ className?: string }>> = {
	opportunities: Target,
	contacts: Users,
	accounts: Building2,
	partners: Handshake,
};

/**
 * Icon mapping for column types
 */
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	string: Type,
	number: Hash,
	boolean: ToggleLeft,
	date: Calendar,
	email: Mail,
	url: Link2,
};

/**
 * Table Select Step Component
 */
export function TableSelectStep() {
	const { setTargetTable } = useImportStore();
	const targetTable = useTargetTable();
	const targetSchema = useTargetSchema();
	const parsedData = useParsedData();

	/**
	 * Handle table selection
	 */
	const handleSelectTable = useCallback(
		(table: ImportTargetTable) => {
			setTargetTable(table);
		},
		[setTargetTable]
	);

	/**
	 * Count required and optional fields for a table
	 */
	const getFieldCounts = useMemo(
		() => (table: ImportTargetTable) => {
			const schema = TABLE_SCHEMAS[table];
			if (!schema) return { required: 0, optional: 0 };

			const required = schema.columns.filter((c) => c.required).length;
			const optional = schema.columns.filter((c) => !c.required).length;
			return { required, optional };
		},
		[]
	);

	return (
		<div className="space-y-8 max-w-4xl mx-auto">
			{/* Table Selection Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{IMPORT_TARGETS.map((target) => {
					const isSelected = targetTable === target.value;
					const Icon = TABLE_ICONS[target.value];
					const counts = getFieldCounts(target.value);

					return (
						<button
							key={target.value}
							type="button"
							onClick={() => handleSelectTable(target.value)}
							className={cn(
								"relative flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all duration-200",
								"hover:border-primary/50 hover:bg-muted/30",
								isSelected
									? "border-primary bg-primary/5 ring-2 ring-primary/20"
									: "border-border"
							)}
						>
							{/* Selection Indicator */}
							<div
								className={cn(
									"absolute top-4 right-4 transition-all",
									isSelected ? "text-primary" : "text-muted-foreground/30"
								)}
							>
								{isSelected ? (
									<CheckCircle2 className="h-6 w-6" />
								) : (
									<Circle className="h-6 w-6" />
								)}
							</div>

							{/* Icon */}
							<div
								className={cn(
									"flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
									isSelected
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground"
								)}
							>
								<Icon className="h-6 w-6" />
							</div>

							{/* Content */}
							<div className="flex-1 min-w-0 pr-8">
								<h3 className="font-semibold text-base mb-1">
									{target.label}
								</h3>
								<p className="text-sm text-muted-foreground mb-3">
									{target.description}
								</p>

								{/* Field Counts */}
								<div className="flex items-center gap-3 text-xs">
									<span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
										<AlertCircle className="h-3 w-3" />
										{counts.required} required
									</span>
									<span className="text-muted-foreground">
										{counts.optional} optional
									</span>
								</div>
							</div>
						</button>
					);
				})}
			</div>

			{/* Selected Table Schema Preview */}
			{targetTable && targetSchema && (
				<div className="border rounded-xl overflow-hidden">
					{/* Header */}
					<div className="bg-muted/50 px-5 py-4 border-b">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{(() => {
									const Icon = TABLE_ICONS[targetTable];
									return <Icon className="h-5 w-5 text-primary" />;
								})()}
								<div>
									<h3 className="font-semibold">
										{IMPORT_TARGETS.find((t) => t.value === targetTable)?.label} Schema
									</h3>
									<p className="text-sm text-muted-foreground">
										{targetSchema.columns.length} fields available for mapping
									</p>
								</div>
							</div>

							{/* Legend */}
							<div className="flex items-center gap-4 text-xs">
								<span className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-amber-500" />
									Required
								</span>
								<span className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
									Optional
								</span>
							</div>
						</div>
					</div>

					{/* Field List */}
					<ScrollArea className="h-[300px]">
						<div className="divide-y">
							{targetSchema.columns.map((column) => {
								const TypeIcon = TYPE_ICONS[column.type] || Type;

								return (
									<div
										key={column.name}
										className={cn(
											"flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors",
											column.required && "bg-amber-50/50 dark:bg-amber-950/10"
										)}
									>
										{/* Required Indicator */}
										<div
											className={cn(
												"w-2 h-2 rounded-full flex-shrink-0",
												column.required
													? "bg-amber-500"
													: "bg-muted-foreground/30"
											)}
										/>

										{/* Field Info */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<span className="font-medium font-mono text-sm">
													{column.name}
												</span>
												{column.required && (
													<Badge
														variant="outline"
														className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
													>
														Required
													</Badge>
												)}
											</div>
											{column.description && (
												<p className="text-xs text-muted-foreground truncate">
													{column.description}
												</p>
											)}
										</div>

										{/* Type Badge */}
										<div className="flex items-center gap-2 text-muted-foreground">
											<TypeIcon className="h-4 w-4" />
											<span className="text-xs font-mono">
												{column.type}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</ScrollArea>
				</div>
			)}

			{/* Mapping Hint */}
			{targetTable && parsedData && (
				<div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
					<ChevronRight className="h-5 w-5 text-primary mt-0.5" />
					<div>
						<p className="font-medium text-sm">Next: Map Your Columns</p>
						<p className="text-sm text-muted-foreground">
							We'll auto-detect mappings between your {parsedData.headers.length} columns
							and the {IMPORT_TARGETS.find((t) => t.value === targetTable)?.label.toLowerCase()} fields.
							You can adjust or combine columns as needed.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

export default TableSelectStep;
