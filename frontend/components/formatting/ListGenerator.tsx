/**
 * ListGenerator Component
 *
 * Generates lists of figures, tables, and acronyms with preview
 * and insertion capability.
 */

"use client";

import * as React from "react";
import {
	Image,
	Table2,
	BookText,
	RefreshCw,
	Plus,
	List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type {
	FigureEntry,
	TableEntry,
	AcronymEntry,
	ListsResult,
} from "@/lib/types/formatting";
import { useListGenerator } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface ListGeneratorProps {
	/** Document ID to generate lists for */
	documentId: string;
	/** Which list types to show */
	type?: "figures" | "tables" | "acronyms" | "all";
	/** Callback when a list is inserted */
	onInsert?: (
		type: "figures" | "tables" | "acronyms",
		entries: FigureEntry[] | TableEntry[] | AcronymEntry[]
	) => void;
	/** Additional CSS classes */
	className?: string;
}

type ListType = "figures" | "tables" | "acronyms";

// =============================================================================
// Constants
// =============================================================================

const LIST_CONFIG: Record<
	ListType,
	{ label: string; title: string; icon: React.ElementType }
> = {
	figures: {
		label: "Figures",
		title: "List of Figures",
		icon: Image,
	},
	tables: {
		label: "Tables",
		title: "List of Tables",
		icon: Table2,
	},
	acronyms: {
		label: "Acronyms",
		title: "List of Acronyms",
		icon: BookText,
	},
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Figure list display.
 */
interface FigureListProps {
	figures: FigureEntry[];
	onInsert?: () => void;
	isInserting?: boolean;
}

function FigureList({ figures, onInsert, isInserting }: FigureListProps) {
	if (figures.length === 0) {
		return (
			<EmptyState
				icon={Image}
				message="No figures found in the document."
			/>
		);
	}

	return (
		<div className="space-y-3">
			<div className="border rounded-lg overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-muted/50">
						<tr>
							<th className="text-left px-4 py-2 font-medium w-16">
								Figure
							</th>
							<th className="text-left px-4 py-2 font-medium">Title</th>
							<th className="text-right px-4 py-2 font-medium w-16">
								Page
							</th>
						</tr>
					</thead>
					<tbody>
						{figures.map((figure, index) => (
							<tr
								key={figure.id}
								className={cn(
									"hover:bg-accent/30",
									index % 2 === 0 ? "bg-background" : "bg-muted/20"
								)}
							>
								<td className="px-4 py-2 font-mono text-muted-foreground">
									{figure.number}
								</td>
								<td className="px-4 py-2">{figure.title}</td>
								<td className="px-4 py-2 text-right tabular-nums">
									{figure.page}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{onInsert && (
				<Button onClick={onInsert} disabled={isInserting} className="w-full">
					{isInserting ? (
						<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Plus className="h-4 w-4 mr-2" />
					)}
					Insert List of Figures
				</Button>
			)}
		</div>
	);
}

/**
 * Table list display.
 */
interface TableListProps {
	tables: TableEntry[];
	onInsert?: () => void;
	isInserting?: boolean;
}

function TableList({ tables, onInsert, isInserting }: TableListProps) {
	if (tables.length === 0) {
		return (
			<EmptyState
				icon={Table2}
				message="No tables found in the document."
			/>
		);
	}

	return (
		<div className="space-y-3">
			<div className="border rounded-lg overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-muted/50">
						<tr>
							<th className="text-left px-4 py-2 font-medium w-16">
								Table
							</th>
							<th className="text-left px-4 py-2 font-medium">Title</th>
							<th className="text-right px-4 py-2 font-medium w-16">
								Page
							</th>
						</tr>
					</thead>
					<tbody>
						{tables.map((table, index) => (
							<tr
								key={table.id}
								className={cn(
									"hover:bg-accent/30",
									index % 2 === 0 ? "bg-background" : "bg-muted/20"
								)}
							>
								<td className="px-4 py-2 font-mono text-muted-foreground">
									{table.number}
								</td>
								<td className="px-4 py-2">{table.title}</td>
								<td className="px-4 py-2 text-right tabular-nums">
									{table.page}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{onInsert && (
				<Button onClick={onInsert} disabled={isInserting} className="w-full">
					{isInserting ? (
						<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Plus className="h-4 w-4 mr-2" />
					)}
					Insert List of Tables
				</Button>
			)}
		</div>
	);
}

/**
 * Acronym list display.
 */
interface AcronymListProps {
	acronyms: AcronymEntry[];
	onInsert?: () => void;
	isInserting?: boolean;
}

function AcronymList({ acronyms, onInsert, isInserting }: AcronymListProps) {
	if (acronyms.length === 0) {
		return (
			<EmptyState
				icon={BookText}
				message="No acronyms found in the document."
			/>
		);
	}

	return (
		<div className="space-y-3">
			<div className="border rounded-lg overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-muted/50">
						<tr>
							<th className="text-left px-4 py-2 font-medium w-24">
								Acronym
							</th>
							<th className="text-left px-4 py-2 font-medium">
								Definition
							</th>
							<th className="text-right px-4 py-2 font-medium w-20">
								First Use
							</th>
						</tr>
					</thead>
					<tbody>
						{acronyms.map((acronym, index) => (
							<tr
								key={acronym.id}
								className={cn(
									"hover:bg-accent/30",
									index % 2 === 0 ? "bg-background" : "bg-muted/20"
								)}
							>
								<td className="px-4 py-2 font-mono font-medium">
									{acronym.acronym}
								</td>
								<td className="px-4 py-2">{acronym.definition}</td>
								<td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
									{acronym.firstPage ? `p. ${acronym.firstPage}` : "-"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{onInsert && (
				<Button onClick={onInsert} disabled={isInserting} className="w-full">
					{isInserting ? (
						<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Plus className="h-4 w-4 mr-2" />
					)}
					Insert Acronym List
				</Button>
			)}
		</div>
	);
}

/**
 * Empty state display.
 */
interface EmptyStateProps {
	icon: React.ElementType;
	message: string;
}

function EmptyState({ icon: Icon, message }: EmptyStateProps) {
	return (
		<div className="text-center py-8 text-muted-foreground">
			<Icon className="h-10 w-10 mx-auto mb-3 opacity-50" />
			<p className="text-sm">{message}</p>
		</div>
	);
}

/**
 * Loading skeleton.
 */
function ListSkeleton() {
	return (
		<div className="space-y-3">
			<div className="border rounded-lg overflow-hidden">
				<div className="bg-muted/50 p-2">
					<Skeleton className="h-4 w-full" />
				</div>
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="p-2 border-t">
						<Skeleton className="h-4 w-full" />
					</div>
				))}
			</div>
			<Skeleton className="h-10 w-full" />
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ListGenerator({
	documentId,
	type = "all",
	onInsert,
	className,
}: ListGeneratorProps) {
	// Use hook for list generation
	const { figures, tables, acronyms, isGenerating, error, generate } = useListGenerator(documentId);

	// Local state
	const [insertingType, setInsertingType] = React.useState<ListType | null>(null);
	const [activeTab, setActiveTab] = React.useState<ListType>(
		type === "all" ? "figures" : type
	);

	// Determine which types to generate
	const typesToGenerate: ListType[] = React.useMemo(() => {
		if (type === "all") return ["figures", "tables", "acronyms"];
		return [type];
	}, [type]);

	// Handle generate
	const handleGenerate = React.useCallback(async () => {
		await generate(typesToGenerate);
	}, [generate, typesToGenerate]);

	// Handle insert
	const handleInsert = React.useCallback(
		async (listType: ListType) => {
			setInsertingType(listType);

			// Simulate insertion delay
			await new Promise((resolve) => setTimeout(resolve, 500));

			const entries =
				listType === "figures"
					? figures
					: listType === "tables"
					? tables
					: acronyms;

			if (entries && entries.length > 0) {
				onInsert?.(listType, entries);
			}

			setInsertingType(null);
		},
		[figures, tables, acronyms, onInsert]
	);

	// Generate on mount
	React.useEffect(() => {
		handleGenerate();
	}, [handleGenerate]);

	// Get counts
	const counts = React.useMemo(() => {
		return {
			figures: figures?.length || 0,
			tables: tables?.length || 0,
			acronyms: acronyms?.length || 0,
		};
	}, [figures, tables, acronyms]);

	// Create a result object for compatibility
	const result: ListsResult | null = React.useMemo(() => {
		if (figures.length === 0 && tables.length === 0 && acronyms.length === 0) {
			return null;
		}
		return { figures, tables, acronyms, generatedAt: new Date().toISOString() };
	}, [figures, tables, acronyms]);

	// Single type mode
	if (type !== "all") {
		const config = LIST_CONFIG[type];
		const Icon = config.icon;

		return (
			<Card className={className}>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Icon className="h-5 w-5" />
							{config.title}
						</CardTitle>
						<CardDescription>
							{counts[type]} {type} found
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleGenerate()}
						disabled={isGenerating}
					>
						<RefreshCw
							className={cn(
								"h-4 w-4 mr-2",
								isGenerating && "animate-spin"
							)}
						/>
						Refresh
					</Button>
				</CardHeader>

				<CardContent>
					{error && (
						<Alert variant="destructive" className="mb-4">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{isGenerating && !result ? (
						<ListSkeleton />
					) : (
						<>
							{type === "figures" && result?.figures && (
								<FigureList
									figures={result.figures}
									onInsert={() => handleInsert("figures")}
									isInserting={insertingType === "figures"}
								/>
							)}
							{type === "tables" && result?.tables && (
								<TableList
									tables={result.tables}
									onInsert={() => handleInsert("tables")}
									isInserting={insertingType === "tables"}
								/>
							)}
							{type === "acronyms" && result?.acronyms && (
								<AcronymList
									acronyms={result.acronyms}
									onInsert={() => handleInsert("acronyms")}
									isInserting={insertingType === "acronyms"}
								/>
							)}
						</>
					)}
				</CardContent>
			</Card>
		);
	}

	// All types mode with tabs
	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<List className="h-5 w-5" />
						Document Lists
					</CardTitle>
					<CardDescription>
						Generate lists of figures, tables, and acronyms
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={handleGenerate}
					disabled={isGenerating}
				>
					<RefreshCw
						className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")}
					/>
					Refresh
				</Button>
			</CardHeader>

			<CardContent>
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as ListType)}
				>
					<TabsList className="grid w-full grid-cols-3">
						{(Object.keys(LIST_CONFIG) as ListType[]).map((listType) => {
							const config = LIST_CONFIG[listType];
							const Icon = config.icon;
							const count = counts[listType];

							return (
								<TabsTrigger
									key={listType}
									value={listType}
									className="gap-2"
								>
									<Icon className="h-4 w-4" />
									<span className="hidden sm:inline">{config.label}</span>
									{count > 0 && (
										<Badge variant="secondary" className="h-5 px-1.5 text-xs">
											{count}
										</Badge>
									)}
								</TabsTrigger>
							);
						})}
					</TabsList>

					{isGenerating && !result ? (
						<div className="pt-4">
							<ListSkeleton />
						</div>
					) : (
						<>
							<TabsContent value="figures" className="mt-4">
								{result?.figures && (
									<FigureList
										figures={result.figures}
										onInsert={() => handleInsert("figures")}
										isInserting={insertingType === "figures"}
									/>
								)}
							</TabsContent>

							<TabsContent value="tables" className="mt-4">
								{result?.tables && (
									<TableList
										tables={result.tables}
										onInsert={() => handleInsert("tables")}
										isInserting={insertingType === "tables"}
									/>
								)}
							</TabsContent>

							<TabsContent value="acronyms" className="mt-4">
								{result?.acronyms && (
									<AcronymList
										acronyms={result.acronyms}
										onInsert={() => handleInsert("acronyms")}
										isInserting={insertingType === "acronyms"}
									/>
								)}
							</TabsContent>
						</>
					)}
				</Tabs>
			</CardContent>
		</Card>
	);
}

export default ListGenerator;
