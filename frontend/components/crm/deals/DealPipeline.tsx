"use client";

/**
 * Deal Pipeline Component
 *
 * Kanban-style pipeline view for sales deals.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
	DndContext,
	DragOverlay,
	closestCorners,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	GripVertical,
	Plus,
	DollarSign,
	Calendar,
	Building2,
	User,
	TrendingUp,
} from "lucide-react";
import type { DealRow } from "@/lib/db/schema-crm";
import { DEAL_STAGES } from "@/lib/types/crm";

interface DealPipelineProps {
	deals: DealRow[];
	onStageChange?: (dealId: string, newStage: string) => Promise<void>;
	onDealClick?: (deal: DealRow) => void;
	onAddDeal?: (stage: string) => void;
	className?: string;
}

interface PipelineColumn {
	id: string;
	label: string;
	color: string;
	probability: number;
	deals: DealRow[];
	totalValue: number;
}

export function DealPipeline({
	deals,
	onStageChange,
	onDealClick,
	onAddDeal,
	className,
}: DealPipelineProps) {
	const [activeId, setActiveId] = useState<string | null>(null);

	// Build columns from deal stages
	const columns: PipelineColumn[] = useMemo(() => {
		return DEAL_STAGES.map((stage) => {
			const stageDeals = deals.filter((d) => d.stage === stage.id);
			return {
				id: stage.id,
				label: stage.label,
				color: stage.color,
				probability: stage.probability ?? 0,
				deals: stageDeals,
				totalValue: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
			};
		});
	}, [deals]);

	// Calculate pipeline totals
	const pipelineTotals = useMemo(() => {
		const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
		const weightedValue = deals.reduce((sum, d) => {
			const stageConfig = DEAL_STAGES.find((s) => s.id === d.stage);
			const probability = stageConfig?.probability ?? 0;
			return sum + (d.value ?? 0) * (probability / 100);
		}, 0);
		return { totalValue, weightedValue, dealCount: deals.length };
	}, [deals]);

	// Find active deal for drag overlay
	const activeDeal = useMemo(
		() => deals.find((d) => d.id === activeId),
		[deals, activeId]
	);

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Handle drag start
	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	// Handle drag end
	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveId(null);

		if (!over || !onStageChange) return;

		const dealId = active.id as string;
		const overId = over.id as string;

		// Check if dropped on a column
		const targetColumn = columns.find((c) => c.id === overId);
		const targetDeal = deals.find((d) => d.id === overId);

		let newStage: string | undefined;

		if (targetColumn) {
			newStage = targetColumn.id;
		} else if (targetDeal) {
			newStage = targetDeal.stage;
		}

		if (!newStage) return;

		const deal = deals.find((d) => d.id === dealId);
		if (!deal || deal.stage === newStage) return;

		await onStageChange(dealId, newStage);
	};

	// Format currency
	const formatCurrency = (value: number, currency = "USD") => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Pipeline Summary */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Pipeline</p>
								<p className="text-2xl font-bold">
									{formatCurrency(pipelineTotals.totalValue)}
								</p>
							</div>
							<DollarSign className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Weighted Pipeline</p>
								<p className="text-2xl font-bold">
									{formatCurrency(pipelineTotals.weightedValue)}
								</p>
							</div>
							<TrendingUp className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Active Deals</p>
								<p className="text-2xl font-bold">{pipelineTotals.dealCount}</p>
							</div>
							<Building2 className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Pipeline Kanban */}
			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<div className="flex gap-4 overflow-x-auto pb-4">
					{columns.map((column) => (
						<PipelineColumn
							key={column.id}
							column={column}
							onDealClick={onDealClick}
							onAddDeal={onAddDeal}
							formatCurrency={formatCurrency}
						/>
					))}
				</div>

				{/* Drag overlay */}
				<DragOverlay>
					{activeDeal ? (
						<div className="opacity-80">
							<DealCard deal={activeDeal} formatCurrency={formatCurrency} />
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
}

// Pipeline Column Component
interface PipelineColumnProps {
	column: PipelineColumn;
	onDealClick?: (deal: DealRow) => void;
	onAddDeal?: (stage: string) => void;
	formatCurrency: (value: number, currency?: string) => string;
}

function PipelineColumn({
	column,
	onDealClick,
	onAddDeal,
	formatCurrency,
}: PipelineColumnProps) {
	const dealIds = column.deals.map((d) => d.id);

	return (
		<div className="flex-shrink-0 w-72 bg-muted/30 rounded-lg">
			{/* Column Header */}
			<div className="p-3 border-b">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<div
							className={cn(
								"h-3 w-3 rounded-full",
								column.color === "gray" && "bg-gray-400",
								column.color === "blue" && "bg-blue-400",
								column.color === "indigo" && "bg-indigo-400",
								column.color === "purple" && "bg-purple-400",
								column.color === "yellow" && "bg-yellow-400",
								column.color === "green" && "bg-green-400",
								column.color === "red" && "bg-red-400"
							)}
						/>
						<h3 className="font-medium text-sm">{column.label}</h3>
						<Badge variant="secondary" className="text-xs">
							{column.deals.length}
						</Badge>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0"
						onClick={() => onAddDeal?.(column.id)}
					>
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>{formatCurrency(column.totalValue)}</span>
					<span>{column.probability}% probability</span>
				</div>

				<Progress value={column.probability} className="h-1 mt-2" />
			</div>

			{/* Column Content */}
			<ScrollArea className="h-[calc(100vh-350px)]">
				<div className="p-2 space-y-2">
					<SortableContext
						items={dealIds}
						strategy={verticalListSortingStrategy}
					>
						{column.deals.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
								<DollarSign className="h-8 w-8 mb-2" />
								<p className="text-sm">No deals</p>
							</div>
						) : (
							column.deals.map((deal) => (
								<SortableDealCard
									key={deal.id}
									deal={deal}
									onClick={() => onDealClick?.(deal)}
									formatCurrency={formatCurrency}
								/>
							))
						)}
					</SortableContext>
				</div>
			</ScrollArea>
		</div>
	);
}

// Deal Card Component
interface DealCardProps {
	deal: DealRow;
	onClick?: () => void;
	formatCurrency: (value: number, currency?: string) => string;
}

function DealCard({ deal, onClick, formatCurrency }: DealCardProps) {
	const formatDate = (date: Date | string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	const isOverdue =
		deal.expectedCloseDate &&
		new Date(deal.expectedCloseDate) < new Date() &&
		deal.status === "open";

	return (
		<Card
			className={cn(
				"cursor-pointer hover:shadow-md transition-shadow",
				isOverdue && "border-red-200"
			)}
			onClick={onClick}
		>
			<CardContent className="p-3">
				<div className="space-y-2">
					<h4 className="font-medium text-sm truncate">{deal.name}</h4>

					<div className="flex items-center justify-between">
						<span className="text-lg font-semibold text-green-600">
							{formatCurrency(deal.value ?? 0, deal.currency ?? "USD")}
						</span>
						{deal.stageProbability && (
							<Badge variant="secondary" className="text-xs">
								{deal.stageProbability}%
							</Badge>
						)}
					</div>

					{deal.expectedCloseDate && (
						<div
							className={cn(
								"flex items-center gap-1 text-xs",
								isOverdue ? "text-red-600" : "text-muted-foreground"
							)}
						>
							<Calendar className="h-3 w-3" />
							{formatDate(deal.expectedCloseDate)}
							{isOverdue && " (overdue)"}
						</div>
					)}

					{deal.accountId && (
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<Building2 className="h-3 w-3" />
							Account linked
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// Sortable Deal Card
function SortableDealCard({
	deal,
	onClick,
	formatCurrency,
}: DealCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: deal.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn("group", isDragging && "opacity-50")}
		>
			<div className="relative">
				{/* Drag handle */}
				<div
					{...attributes}
					{...listeners}
					className="absolute -left-1 top-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing z-10"
				>
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</div>

				<DealCard deal={deal} onClick={onClick} formatCurrency={formatCurrency} />
			</div>
		</div>
	);
}

export default DealPipeline;
