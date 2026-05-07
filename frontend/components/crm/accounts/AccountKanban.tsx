"use client";

/**
 * Account Kanban Component
 *
 * Kanban board view for accounts organized by pipeline stage.
 * Supports drag-and-drop for stage transitions.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
	type DragOverEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AccountCard } from "./AccountCard";
import { StageIndicator } from "../shared";
import {
	GripVertical,
	Plus,
	MoreHorizontal,
	Building2,
} from "lucide-react";
import type { AccountRow } from "@/lib/db/schema-crm";
import type { AccountType } from "@/lib/types/crm";
import { ACCOUNT_STAGES } from "@/lib/types/crm";

interface AccountKanbanProps {
	accounts: AccountRow[];
	accountType: AccountType;
	onStageChange?: (accountId: string, newStage: string, reason?: string) => Promise<void>;
	onAccountClick?: (account: AccountRow) => void;
	onAddAccount?: (stage: string) => void;
	isLoading?: boolean;
	className?: string;
}

interface KanbanColumn {
	id: string;
	label: string;
	color: string;
	accounts: AccountRow[];
}

export function AccountKanban({
	accounts,
	accountType,
	onStageChange,
	onAccountClick,
	onAddAccount,
	isLoading = false,
	className,
}: AccountKanbanProps) {
	const [activeId, setActiveId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);

	// Get stages configuration for this account type
	const stagesConfig = useMemo(() => ACCOUNT_STAGES[accountType] || {}, [accountType]);

	// Build columns from stages
	const columns: KanbanColumn[] = useMemo(() => {
		return Object.entries(stagesConfig).map(([stageId, config]) => ({
			id: stageId,
			label: config.label,
			color: config.color,
			accounts: accounts.filter((a) => a.stage === stageId),
		}));
	}, [stagesConfig, accounts]);

	// Find active account for drag overlay
	const activeAccount = useMemo(
		() => accounts.find((a) => a.id === activeId),
		[accounts, activeId]
	);

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Handle drag start
	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id as string);
	};

	// Handle drag over
	const handleDragOver = (event: DragOverEvent) => {
		setOverId(event.over?.id as string | null);
	};

	// Handle drag end
	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		setActiveId(null);
		setOverId(null);

		if (!over || !onStageChange) return;

		const accountId = active.id as string;
		const overId = over.id as string;

		// Check if dropped on a column or another card
		const targetColumn = columns.find((c) => c.id === overId);
		const targetAccount = accounts.find((a) => a.id === overId);

		let newStage: string | undefined;

		if (targetColumn) {
			newStage = targetColumn.id;
		} else if (targetAccount) {
			newStage = targetAccount.stage ?? undefined;
		}

		if (!newStage) return;

		const account = accounts.find((a) => a.id === accountId);
		if (!account || account.stage === newStage) return;

		await onStageChange(accountId, newStage);
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			<div
				className={cn(
					"flex gap-4 overflow-x-auto pb-4",
					className
				)}
			>
				{columns.map((column) => (
					<KanbanColumnComponent
						key={column.id}
						column={column}
						accountType={accountType}
						isOver={overId === column.id}
						onAccountClick={onAccountClick}
						onAddAccount={onAddAccount}
					/>
				))}
			</div>

			{/* Drag overlay */}
			<DragOverlay>
				{activeAccount ? (
					<div className="opacity-80">
						<AccountCard account={activeAccount} variant="compact" />
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

// Kanban Column Component
interface KanbanColumnComponentProps {
	column: KanbanColumn;
	accountType: AccountType;
	isOver: boolean;
	onAccountClick?: (account: AccountRow) => void;
	onAddAccount?: (stage: string) => void;
}

function KanbanColumnComponent({
	column,
	accountType,
	isOver,
	onAccountClick,
	onAddAccount,
}: KanbanColumnComponentProps) {
	const accountIds = column.accounts.map((a) => a.id);

	return (
		<div
			className={cn(
				"flex-shrink-0 w-80 bg-muted/30 rounded-lg",
				isOver && "ring-2 ring-primary ring-offset-2"
			)}
		>
			{/* Column Header */}
			<div className="p-3 border-b flex items-center justify-between">
				<div className="flex items-center gap-2">
					<StageIndicator
						stage={column.id}
						type={accountType}
						variant="dot"
						size="sm"
						showLabel={false}
					/>
					<h3 className="font-medium">{column.label}</h3>
					<Badge variant="secondary" className="ml-1">
						{column.accounts.length}
					</Badge>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 w-8 p-0"
					onClick={() => onAddAccount?.(column.id)}
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			{/* Column Content */}
			<ScrollArea className="h-[calc(100vh-250px)]">
				<div className="p-2 space-y-2">
					<SortableContext
						items={accountIds}
						strategy={verticalListSortingStrategy}
					>
						{column.accounts.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
								<Building2 className="h-8 w-8 mb-2" />
								<p className="text-sm">No accounts</p>
							</div>
						) : (
							column.accounts.map((account) => (
								<SortableAccountCard
									key={account.id}
									account={account}
									onClick={() => onAccountClick?.(account)}
								/>
							))
						)}
					</SortableContext>
				</div>
			</ScrollArea>
		</div>
	);
}

// Sortable Account Card
interface SortableAccountCardProps {
	account: AccountRow;
	onClick?: () => void;
}

function SortableAccountCard({ account, onClick }: SortableAccountCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: account.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group",
				isDragging && "opacity-50"
			)}
		>
			<Card
				className="cursor-pointer hover:shadow-md transition-shadow"
				onClick={onClick}
			>
				<CardContent className="p-3">
					<div className="flex items-start gap-2">
						{/* Drag handle */}
						<div
							{...attributes}
							{...listeners}
							className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
						>
							<GripVertical className="h-4 w-4 text-muted-foreground" />
						</div>

						{/* Account info */}
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
									<Building2 className="h-4 w-4 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h4 className="font-medium text-sm truncate">
										{account.name}
									</h4>
									{account.industry && (
										<p className="text-xs text-muted-foreground truncate">
											{account.industry}
										</p>
									)}
								</div>
							</div>

							{/* Tags */}
							{(account.tags as string[])?.length > 0 && (
								<div className="flex flex-wrap gap-1 mt-2">
									{(account.tags as string[]).slice(0, 2).map((tag) => (
										<Badge key={tag} variant="outline" className="text-xs">
											{tag}
										</Badge>
									))}
									{(account.tags as string[]).length > 2 && (
										<Badge variant="outline" className="text-xs">
											+{(account.tags as string[]).length - 2}
										</Badge>
									)}
								</div>
							)}

							{/* Score indicator */}
							{account.leadScore !== null && (
								<div className="mt-2 flex items-center gap-2">
									<div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
										<div
											className={cn(
												"h-full rounded-full",
												account.leadScore >= 70
													? "bg-green-500"
													: account.leadScore >= 40
													? "bg-yellow-500"
													: "bg-red-500"
											)}
											style={{ width: `${account.leadScore}%` }}
										/>
									</div>
									<span className="text-xs text-muted-foreground">
										{account.leadScore}
									</span>
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default AccountKanban;
