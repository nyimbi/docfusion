"use client";

/**
 * StaffingMatrix Component
 *
 * Visual matrix showing position assignments across opportunities.
 * Displays personnel allocation, gaps, and availability at a glance.
 */

import { useState, useMemo } from "react";
import {
	Users,
	Grid,
	CheckCircle,
	AlertTriangle,
	XCircle,
	Filter,
	Download,
	ZoomIn,
	ZoomOut,
	ChevronRight,
	ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Personnel, PositionRequirement } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface StaffingMatrixProps {
	positions: PositionRequirement[];
	personnel: Personnel[];
	opportunities: { id: string; name: string; status: string }[];
	onAssign?: (personnelId: string, positionId: string) => void;
	onUnassign?: (positionId: string) => void;
	className?: string;
}

interface MatrixCell {
	positionId: string;
	position: PositionRequirement;
	assignedPersonnel: Personnel | null;
	matchScore: number | null;
	status: "assigned" | "open" | "gap";
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPersonnelById(personnel: Personnel[], id: string | null): Personnel | null {
	if (!id) return null;
	return personnel.find(p => p.id === id) || null;
}

function getCellColor(status: string, matchScore: number | null): string {
	if (status === "assigned") {
		if (matchScore === null || matchScore >= 80) return "bg-green-100 border-green-300";
		if (matchScore >= 60) return "bg-yellow-100 border-yellow-300";
		return "bg-orange-100 border-orange-300";
	}
	if (status === "gap") return "bg-red-100 border-red-300";
	return "bg-gray-50 border-gray-200";
}

// ============================================================================
// Sub-Components
// ============================================================================

function MatrixCellComponent({
	cell,
	onAssign,
	onUnassign,
}: {
	cell: MatrixCell;
	onAssign?: () => void;
	onUnassign?: () => void;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"min-w-[120px] h-16 border rounded-md p-2 cursor-pointer transition-all hover:shadow-md",
							getCellColor(cell.status, cell.matchScore)
						)}
						onClick={cell.assignedPersonnel ? onUnassign : onAssign}

		role="button"
		tabIndex={0}
		onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
						{cell.assignedPersonnel ? (
							<div className="flex items-center gap-2 h-full">
								<Avatar className="h-8 w-8 flex-shrink-0">
									<AvatarImage src={cell.assignedPersonnel.photoUrl || undefined} />
									<AvatarFallback className="text-xs">
										{cell.assignedPersonnel.firstName.charAt(0)}
										{cell.assignedPersonnel.lastName.charAt(0)}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium truncate">
										{cell.assignedPersonnel.firstName} {cell.assignedPersonnel.lastName.charAt(0)}.
									</p>
									{cell.matchScore !== null && (
										<Badge
											variant="outline"
											className={cn(
												"text-xs",
												cell.matchScore >= 80 && "text-green-700",
												cell.matchScore >= 60 && cell.matchScore < 80 && "text-yellow-700",
												cell.matchScore < 60 && "text-red-700"
											)}
										>
											{cell.matchScore}%
										</Badge>
									)}
								</div>
							</div>
						) : (
							<div className="flex items-center justify-center h-full">
								{cell.status === "gap" ? (
									<AlertTriangle className="h-5 w-5 text-red-500" />
								) : (
									<span className="text-xs text-muted-foreground">Open</span>
								)}
							</div>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="space-y-1">
						<p className="font-medium">{cell.position.positionTitle}</p>
						{cell.assignedPersonnel ? (
							<>
								<p className="text-sm">
									Assigned: {cell.assignedPersonnel.firstName} {cell.assignedPersonnel.lastName}
								</p>
								{cell.matchScore !== null && (
									<p className="text-sm">Match: {cell.matchScore}%</p>
								)}
							</>
						) : (
							<p className="text-sm text-muted-foreground">
								{cell.status === "gap" ? "Critical gap - needs staffing" : "Position open"}
							</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function StaffingMatrix({
	positions,
	personnel,
	opportunities,
	onAssign,
	onUnassign,
	className,
}: StaffingMatrixProps) {
	const [selectedOpportunity, setSelectedOpportunity] = useState<string>("all");
	const [zoom, setZoom] = useState(100);

	// Group positions by opportunity
	const positionsByOpportunity = useMemo(() => {
		const grouped = new Map<string, PositionRequirement[]>();

		positions.forEach(pos => {
			const oppId = pos.opportunityId || "unassigned";
			if (!grouped.has(oppId)) {
				grouped.set(oppId, []);
			}
			grouped.get(oppId)!.push(pos);
		});

		return grouped;
	}, [positions]);

	// Filter opportunities
	const filteredOpportunities = useMemo(() => {
		if (selectedOpportunity === "all") return opportunities;
		return opportunities.filter(o => o.id === selectedOpportunity);
	}, [opportunities, selectedOpportunity]);

	// Build matrix cells
	const buildMatrixCells = (oppPositions: PositionRequirement[]): MatrixCell[] => {
		return oppPositions.map(pos => ({
			positionId: pos.id,
			position: pos,
			assignedPersonnel: getPersonnelById(personnel, pos.assignedPersonnelId),
			matchScore: pos.matchScore || null,
			status: pos.assignedPersonnelId ? "assigned" : (pos.assignmentStatus === "open" ? "open" : "gap"),
		}));
	};

	// Stats
	const stats = useMemo(() => {
		const total = positions.length;
		const assigned = positions.filter(p => p.assignedPersonnelId).length;
		const gaps = positions.filter(p => !p.assignedPersonnelId && p.assignmentStatus !== "open").length;

		return {
			total,
			assigned,
			open: total - assigned,
			gaps,
			fillRate: total > 0 ? Math.round((assigned / total) * 100) : 0,
		};
	}, [positions]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<Grid className="h-6 w-6" />
						Staffing Matrix
					</h2>
					<p className="text-muted-foreground">
						Position assignments across opportunities
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => setZoom(z => Math.max(50, z - 10))}>
						<ZoomOut className="h-4 w-4" />
					</Button>
					<span className="text-sm w-12 text-center">{zoom}%</span>
					<Button variant="outline" onClick={() => setZoom(z => Math.min(150, z + 10))}>
						<ZoomIn className="h-4 w-4" />
					</Button>
					<Button variant="outline">
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-2xl font-bold">{stats.total}</p>
								<p className="text-xs text-muted-foreground">Total Positions</p>
							</div>
							<Users className="h-8 w-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-2xl font-bold text-green-600">{stats.assigned}</p>
								<p className="text-xs text-muted-foreground">Assigned</p>
							</div>
							<CheckCircle className="h-8 w-8 text-green-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-2xl font-bold text-red-600">{stats.gaps}</p>
								<p className="text-xs text-muted-foreground">Gaps</p>
							</div>
							<AlertTriangle className="h-8 w-8 text-red-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-2xl font-bold">{stats.fillRate}%</p>
								<p className="text-xs text-muted-foreground">Fill Rate</p>
							</div>
							<div className="h-8 w-8 rounded-full border-4 border-green-500" style={{
								background: `conic-gradient(#22c55e ${stats.fillRate}%, #e5e7eb ${stats.fillRate}%)`
							}} />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<Select value={selectedOpportunity} onValueChange={setSelectedOpportunity}>
					<SelectTrigger className="w-64">
						<SelectValue placeholder="Filter by opportunity" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Opportunities</SelectItem>
						{opportunities.map(opp => (
							<SelectItem key={opp.id} value={opp.id}>{opp.name}</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="flex items-center gap-4 ml-auto text-sm">
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
						<span>Assigned (80%+)</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
						<span>Partial Match</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
						<span>Gap</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
						<span>Open</span>
					</div>
				</div>
			</div>

			{/* Matrix */}
			<Card>
				<CardContent className="p-4">
					<ScrollArea className="w-full">
						<div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
							{filteredOpportunities.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<Grid className="h-12 w-12 mx-auto mb-4" />
									<p>No opportunities found</p>
								</div>
							) : (
								<div className="space-y-6">
									{filteredOpportunities.map(opp => {
										const oppPositions = positionsByOpportunity.get(opp.id) || [];
										if (oppPositions.length === 0) return null;

										const cells = buildMatrixCells(oppPositions);

										// Group by position category
										const keyPersonnel = cells.filter(c => c.position.positionCategory === "key_personnel");
										const technical = cells.filter(c => c.position.positionCategory === "technical");
										const management = cells.filter(c => c.position.positionCategory === "management");
										const support = cells.filter(c => c.position.positionCategory === "support");
										const other = cells.filter(c =>
											!["key_personnel", "technical", "management", "support"].includes(c.position.positionCategory || "")
										);

										return (
											<div key={opp.id} className="space-y-4">
												<div className="flex items-center gap-2">
													<h3 className="font-semibold">{opp.name}</h3>
													<Badge variant="outline">{opp.status}</Badge>
													<Badge variant="secondary">
														{oppPositions.filter(p => p.assignedPersonnelId).length}/{oppPositions.length} filled
													</Badge>
												</div>

												<div className="space-y-3">
													{keyPersonnel.length > 0 && (
														<div>
															<p className="text-xs font-medium text-muted-foreground mb-2">Key Personnel</p>
															<div className="flex gap-2 flex-wrap">
																{keyPersonnel.map(cell => (
																	<div key={cell.positionId} className="space-y-1">
																		<p className="text-xs text-center truncate max-w-[120px]">
																			{cell.position.positionTitle}
																		</p>
																		<MatrixCellComponent
																			cell={cell}
																			onAssign={onAssign ? () => onAssign("", cell.positionId) : undefined}
																			onUnassign={onUnassign ? () => onUnassign(cell.positionId) : undefined}
																		/>
																	</div>
																))}
															</div>
														</div>
													)}

													{technical.length > 0 && (
														<div>
															<p className="text-xs font-medium text-muted-foreground mb-2">Technical</p>
															<div className="flex gap-2 flex-wrap">
																{technical.map(cell => (
																	<div key={cell.positionId} className="space-y-1">
																		<p className="text-xs text-center truncate max-w-[120px]">
																			{cell.position.positionTitle}
																		</p>
																		<MatrixCellComponent
																			cell={cell}
																			onAssign={onAssign ? () => onAssign("", cell.positionId) : undefined}
																			onUnassign={onUnassign ? () => onUnassign(cell.positionId) : undefined}
																		/>
																	</div>
																))}
															</div>
														</div>
													)}

													{management.length > 0 && (
														<div>
															<p className="text-xs font-medium text-muted-foreground mb-2">Management</p>
															<div className="flex gap-2 flex-wrap">
																{management.map(cell => (
																	<div key={cell.positionId} className="space-y-1">
																		<p className="text-xs text-center truncate max-w-[120px]">
																			{cell.position.positionTitle}
																		</p>
																		<MatrixCellComponent
																			cell={cell}
																			onAssign={onAssign ? () => onAssign("", cell.positionId) : undefined}
																			onUnassign={onUnassign ? () => onUnassign(cell.positionId) : undefined}
																		/>
																	</div>
																))}
															</div>
														</div>
													)}

													{(support.length > 0 || other.length > 0) && (
														<div>
															<p className="text-xs font-medium text-muted-foreground mb-2">Support & Other</p>
															<div className="flex gap-2 flex-wrap">
																{[...support, ...other].map(cell => (
																	<div key={cell.positionId} className="space-y-1">
																		<p className="text-xs text-center truncate max-w-[120px]">
																			{cell.position.positionTitle}
																		</p>
																		<MatrixCellComponent
																			cell={cell}
																			onAssign={onAssign ? () => onAssign("", cell.positionId) : undefined}
																			onUnassign={onUnassign ? () => onUnassign(cell.positionId) : undefined}
																		/>
																	</div>
																))}
															</div>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
						<ScrollBar orientation="horizontal" />
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
}

export default StaffingMatrix;
