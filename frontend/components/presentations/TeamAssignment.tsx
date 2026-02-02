"use client";

/**
 * TeamAssignment Component - DocFusion
 *
 * Assign team members to slides and Q&A topics for oral presentations.
 * Supports role assignment, time allocation, and backup designation.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Users,
	Plus,
	UserPlus,
	Edit,
	Trash2,
	MoreHorizontal,
	Clock,
	FileText,
	HelpCircle,
	Check,
	CheckCircle,
	X,
	GripVertical,
	ArrowUp,
	ArrowDown,
	Mail,
	User,
	Shield,
} from "lucide-react";
import { assignTeamMember, updateTeamAssignment, removeTeamMember } from "@/lib/actions/presentations";
import type { PresentationSlide, PresentationTeamMember, TeamRole } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface TeamAssignmentProps {
	/** Presentation ID */
	presentationId: string;
	/** Current team members */
	team: PresentationTeamMember[];
	/** All slides for assignment */
	slides: PresentationSlide[];
	/** Callback when team changes */
	onTeamChange?: (team: PresentationTeamMember[]) => void;
	/** Additional class names */
	className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; icon: typeof User }> = {
	presenter: { label: "Presenter", color: "blue", icon: User },
	backup: { label: "Backup", color: "gray", icon: Shield },
	qa_responder: { label: "Q&A Responder", color: "purple", icon: HelpCircle },
	technical_support: { label: "Technical Support", color: "green", icon: FileText },
};

// ============================================================================
// Component
// ============================================================================

export function TeamAssignment({
	presentationId,
	team: initialTeam,
	slides,
	onTeamChange,
	className,
}: TeamAssignmentProps) {
	// State
	const [team, setTeam] = useState<PresentationTeamMember[]>(initialTeam);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [editingMember, setEditingMember] = useState<PresentationTeamMember | null>(null);
	const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
	const [showAssignDialog, setShowAssignDialog] = useState(false);

	// Form state for add/edit
	const [formData, setFormData] = useState({
		name: "",
		role: "presenter" as TeamRole,
	});
	const [assignedSlides, setAssignedSlides] = useState<string[]>([]);

	// Derived state
	const selectedMember = useMemo(
		() => team.find((m) => m.id === selectedMemberId) ?? null,
		[team, selectedMemberId]
	);

	const memberSlideAssignments = useMemo(() => {
		const assignments: Record<string, string[]> = {};
		team.forEach((member) => {
			if (Array.isArray(member.assignedSlideIds)) {
				assignments[member.id] = member.assignedSlideIds as string[];
			} else {
				assignments[member.id] = [];
			}
		});
		return assignments;
	}, [team]);

	const unassignedSlides = useMemo(() => {
		const allAssigned = new Set(Object.values(memberSlideAssignments).flat());
		return slides.filter((s) => !allAssigned.has(s.id));
	}, [slides, memberSlideAssignments]);

	const totalAssignedTime = useMemo(() => {
		return (slideIds: string[]) => {
			return slides
				.filter((s) => slideIds.includes(s.id))
				.reduce((sum, s) => sum + (s.estimatedDuration ?? 60), 0);
		};
	}, [slides]);

	// Handlers
	const handleAddMember = useCallback(async () => {
		const result = await assignTeamMember(presentationId, {
			name: formData.name,
			role: formData.role as "presenter" | "backup" | "qa_responder" | "technical_support" | "coach",
		});

		if (result.success && result.data) {
			const updated = [...team, result.data];
			setTeam(updated);
			onTeamChange?.(updated);
			setShowAddDialog(false);
			resetForm();
		}
	}, [presentationId, formData, team, onTeamChange]);

	const handleUpdateMember = useCallback(async () => {
		if (!editingMember) return;

		const result = await updateTeamAssignment(editingMember.id, {
			name: formData.name,
			role: formData.role as "presenter" | "backup" | "qa_responder" | "technical_support" | "coach",
			assignedSlideIds: assignedSlides,
		});

		if (result.success && result.data) {
			const updated = team.map((m) =>
				m.id === editingMember.id ? result.data : m
			);
			setTeam(updated);
			onTeamChange?.(updated);
			setEditingMember(null);
			resetForm();
		}
	}, [editingMember, formData, assignedSlides, team, onTeamChange]);

	const handleDeleteMember = useCallback(async (memberId: string) => {
		const result = await removeTeamMember(memberId);
		if (result.success) {
			const updated = team.filter((m) => m.id !== memberId);
			setTeam(updated);
			if (selectedMemberId === memberId) {
				setSelectedMemberId(null);
			}
			onTeamChange?.(updated);
		}
	}, [team, selectedMemberId, onTeamChange]);

	const handleAssignSlides = useCallback(async () => {
		if (!selectedMember) return;

		const result = await updateTeamAssignment(selectedMember.id, {
			assignedSlideIds: assignedSlides,
		});

		if (result.success && result.data) {
			const updated = team.map((m) =>
				m.id === selectedMember.id ? result.data : m
			);
			setTeam(updated);
			onTeamChange?.(updated);
			setShowAssignDialog(false);
		}
	}, [selectedMember, assignedSlides, team, onTeamChange]);

	const handleEditMember = useCallback((member: PresentationTeamMember) => {
		setEditingMember(member);
		setFormData({
			name: member.name,
			role: (member.role ?? "presenter") as TeamRole,
		});
		setAssignedSlides(
			Array.isArray(member.assignedSlideIds)
				? (member.assignedSlideIds as string[])
				: []
		);
	}, []);

	const handleOpenAssignDialog = useCallback((member: PresentationTeamMember) => {
		setSelectedMemberId(member.id);
		setAssignedSlides(
			Array.isArray(member.assignedSlideIds)
				? (member.assignedSlideIds as string[])
				: []
		);
		setShowAssignDialog(true);
	}, []);

	const resetForm = () => {
		setFormData({ name: "", role: "presenter" });
		setAssignedSlides([]);
	};

	// Format time
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Get initials
	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	// Render member card
	const renderMemberCard = (member: PresentationTeamMember) => {
		const roleConfig = ROLE_CONFIG[member.role as TeamRole] ?? ROLE_CONFIG.presenter;
		const memberAssignedSlides = memberSlideAssignments[member.id] ?? [];
		const assignedTime = totalAssignedTime(memberAssignedSlides);

		return (
			<Card
				key={member.id}
				className={cn(
					"transition-all cursor-pointer",
					selectedMemberId === member.id && "ring-2 ring-primary"
				)}
				onClick={() => setSelectedMemberId(member.id)}
			>
				<CardContent className="p-3">
					<div className="flex items-start gap-3">
						{/* Avatar */}
						<Avatar className="h-10 w-10">
							<AvatarFallback>{getInitials(member.name)}</AvatarFallback>
						</Avatar>

						{/* Info */}
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium truncate">{member.name}</p>
									<p className="text-xs text-muted-foreground truncate">
										{ROLE_CONFIG[(member.role ?? "presenter") as TeamRole]?.label ?? member.role}
									</p>
								</div>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7"
											onClick={(e) => e.stopPropagation()}
										>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => handleOpenAssignDialog(member)}>
											<FileText className="h-4 w-4 mr-2" />
											Assign Slides
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleEditMember(member)}>
											<Edit className="h-4 w-4 mr-2" />
											Edit
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => handleDeleteMember(member.id)}
											className="text-destructive"
										>
											<Trash2 className="h-4 w-4 mr-2" />
											Remove
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							{/* Role Badge */}
							<div className="flex items-center gap-2 mt-2">
								<Badge variant="outline" className="text-[10px]">
									<roleConfig.icon className="h-3 w-3 mr-1" />
									{roleConfig.label}
								</Badge>

								{member.hasConfirmed && (
									<Badge variant="secondary" className="text-[10px]">
										<CheckCircle className="h-3 w-3 mr-1" />
										Confirmed
									</Badge>
								)}
							</div>

							{/* Assignment Stats */}
							<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
								<span className="flex items-center gap-1">
									<FileText className="h-3 w-3" />
									{memberAssignedSlides.length} slides
								</span>
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{formatDuration(assignedTime)}
								</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	};

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full", className)}>
				{/* Header */}
				<div className="p-3 border-b">
					<div className="flex items-center justify-between">
						<h3 className="font-medium flex items-center gap-2">
							<Users className="h-4 w-4" />
							Team ({team.length})
						</h3>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowAddDialog(true)}
						>
							<UserPlus className="h-3.5 w-3.5 mr-1" />
							Add
						</Button>
					</div>

					{/* Summary */}
					{team.length > 0 && (
						<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
							<Badge variant="secondary">
								{slides.length - unassignedSlides.length} / {slides.length} slides assigned
							</Badge>
							{unassignedSlides.length > 0 && (
								<Badge variant="outline" className="text-yellow-600">
									{unassignedSlides.length} unassigned
								</Badge>
							)}
						</div>
					)}
				</div>

				{/* Team List */}
				<ScrollArea className="flex-1">
					<div className="p-3 space-y-2">
						{team.length === 0 ? (
							<Card>
								<CardContent className="py-8">
									<div className="text-center text-muted-foreground">
										<Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
										<p className="font-medium">No Team Members</p>
										<p className="text-sm mt-1">
											Add team members to assign slides and Q&A responsibilities
										</p>
									</div>
								</CardContent>
							</Card>
						) : (
							team.map(renderMemberCard)
						)}
					</div>
				</ScrollArea>

				{/* Add Member Dialog */}
				<Dialog open={showAddDialog || !!editingMember} onOpenChange={(open) => {
					if (!open) {
						setShowAddDialog(false);
						setEditingMember(null);
						resetForm();
					}
				}}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editingMember ? "Edit Team Member" : "Add Team Member"}
							</DialogTitle>
							<DialogDescription>
								{editingMember
									? "Update team member information and assignments"
									: "Add a new team member to the presentation team"}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div>
								<label className="text-sm font-medium">Name *</label>
								<Input
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									placeholder="Full name"
									className="mt-1"
								/>
							</div>

							<div>
								<label className="text-sm font-medium">Role</label>
								<Select
									value={formData.role}
									onValueChange={(v) => setFormData({ ...formData, role: v as TeamRole })}
								>
									<SelectTrigger className="mt-1">
										<SelectValue placeholder="Select role" />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(ROLE_CONFIG).map(([key, config]) => (
											<SelectItem key={key} value={key}>
												<div className="flex items-center gap-2">
													<config.icon className="h-4 w-4" />
													{config.label}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setShowAddDialog(false);
									setEditingMember(null);
									resetForm();
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={editingMember ? handleUpdateMember : handleAddMember}
								disabled={!formData.name.trim()}
							>
								{editingMember ? "Save Changes" : "Add Member"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Assign Slides Dialog */}
				<Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>Assign Slides</DialogTitle>
							<DialogDescription>
								Select slides to assign to {selectedMember?.name}
							</DialogDescription>
						</DialogHeader>

						<ScrollArea className="max-h-[400px]">
							<div className="space-y-2 py-4">
								{slides.map((slide, index) => {
									const isAssigned = assignedSlides.includes(slide.id);
									const isAssignedToOther = Object.entries(memberSlideAssignments).some(
										([id, slideIds]) => id !== selectedMemberId && slideIds.includes(slide.id)
									);

									return (
										<div
											key={slide.id}
											className={cn(
												"flex items-center gap-3 p-2 rounded-md",
												isAssigned && "bg-primary/5",
												isAssignedToOther && "opacity-50"
											)}
										>
											<Checkbox
												checked={isAssigned}
												onCheckedChange={(checked) => {
													if (checked) {
														setAssignedSlides([...assignedSlides, slide.id]);
													} else {
														setAssignedSlides(assignedSlides.filter((id) => id !== slide.id));
													}
												}}
												disabled={isAssignedToOther}
											/>

											<Badge variant="outline" className="w-8 justify-center">
												{index + 1}
											</Badge>

											<div className="flex-1 min-w-0">
												<p className="text-sm truncate">
													{slide.title ?? `Slide ${index + 1}`}
												</p>
											</div>

											<span className="text-xs text-muted-foreground">
												{formatDuration(slide.estimatedDuration ?? 60)}
											</span>
										</div>
									);
								})}
							</div>
						</ScrollArea>

						<div className="flex items-center justify-between text-sm border-t pt-4">
							<span className="text-muted-foreground">
								{assignedSlides.length} slides selected
							</span>
							<span className="font-medium">
								Total: {formatDuration(totalAssignedTime(assignedSlides))}
							</span>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setShowAssignDialog(false)}>
								Cancel
							</Button>
							<Button onClick={handleAssignSlides}>
								Save Assignments
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	);
}
