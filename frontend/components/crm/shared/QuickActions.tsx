"use client";

/**
 * Quick Actions Component
 *
 * Contextual action buttons for CRM entities with dropdown menus
 * and common operations.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	MoreHorizontal,
	Phone,
	Mail,
	Calendar,
	MessageSquare,
	FileText,
	Edit,
	Trash2,
	UserPlus,
	Building2,
	ArrowRight,
	Copy,
	ExternalLink,
	Archive,
	Star,
	CheckSquare,
} from "lucide-react";

interface QuickAction {
	id: string;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	variant?: "default" | "destructive";
	disabled?: boolean;
}

interface QuickActionsProps {
	entityType: "account" | "contact" | "deal" | "activity";
	entityId: string;
	onLogCall?: () => void;
	onSendEmail?: () => void;
	onScheduleMeeting?: () => void;
	onAddNote?: () => void;
	onCreateTask?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onArchive?: () => void;
	onViewDetails?: () => void;
	onConvert?: () => void;
	onClone?: () => void;
	additionalActions?: QuickAction[];
	size?: "sm" | "md";
	variant?: "icon" | "button";
	className?: string;
}

export function QuickActions({
	entityType,
	entityId,
	onLogCall,
	onSendEmail,
	onScheduleMeeting,
	onAddNote,
	onCreateTask,
	onEdit,
	onDelete,
	onArchive,
	onViewDetails,
	onConvert,
	onClone,
	additionalActions = [],
	size = "md",
	variant = "icon",
	className,
}: QuickActionsProps) {
	const [isOpen, setIsOpen] = useState(false);

	const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

	// Build actions list based on entity type and available handlers
	const communicationActions: QuickAction[] = [];
	const workflowActions: QuickAction[] = [];
	const managementActions: QuickAction[] = [];

	// Communication actions
	if (onLogCall) {
		communicationActions.push({
			id: "call",
			label: "Log Call",
			icon: <Phone className={iconSize} />,
			onClick: onLogCall,
		});
	}

	if (onSendEmail) {
		communicationActions.push({
			id: "email",
			label: "Send Email",
			icon: <Mail className={iconSize} />,
			onClick: onSendEmail,
		});
	}

	if (onScheduleMeeting) {
		communicationActions.push({
			id: "meeting",
			label: "Schedule Meeting",
			icon: <Calendar className={iconSize} />,
			onClick: onScheduleMeeting,
		});
	}

	if (onAddNote) {
		communicationActions.push({
			id: "note",
			label: "Add Note",
			icon: <MessageSquare className={iconSize} />,
			onClick: onAddNote,
		});
	}

	if (onCreateTask) {
		communicationActions.push({
			id: "task",
			label: "Create Task",
			icon: <CheckSquare className={iconSize} />,
			onClick: onCreateTask,
		});
	}

	// Workflow actions
	if (onConvert) {
		workflowActions.push({
			id: "convert",
			label: entityType === "account" ? "Convert to Customer" : "Convert",
			icon: <ArrowRight className={iconSize} />,
			onClick: onConvert,
		});
	}

	if (onClone) {
		workflowActions.push({
			id: "clone",
			label: "Clone",
			icon: <Copy className={iconSize} />,
			onClick: onClone,
		});
	}

	if (onViewDetails) {
		workflowActions.push({
			id: "view",
			label: "View Details",
			icon: <ExternalLink className={iconSize} />,
			onClick: onViewDetails,
		});
	}

	// Management actions
	if (onEdit) {
		managementActions.push({
			id: "edit",
			label: "Edit",
			icon: <Edit className={iconSize} />,
			onClick: onEdit,
		});
	}

	if (onArchive) {
		managementActions.push({
			id: "archive",
			label: "Archive",
			icon: <Archive className={iconSize} />,
			onClick: onArchive,
		});
	}

	if (onDelete) {
		managementActions.push({
			id: "delete",
			label: "Delete",
			icon: <Trash2 className={iconSize} />,
			onClick: onDelete,
			variant: "destructive",
		});
	}

	const allActions = [
		...communicationActions,
		...additionalActions,
		...workflowActions,
		...managementActions,
	];

	if (allActions.length === 0) {
		return null;
	}

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size={size === "sm" ? "sm" : "md"}
					className={cn(
						variant === "icon" && "h-8 w-8 p-0",
						className
					)}
				>
					<MoreHorizontal className={iconSize} />
					<span className="sr-only">Actions</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{communicationActions.length > 0 && (
					<>
						{communicationActions.map((action) => (
							<DropdownMenuItem
								key={action.id}
								onClick={() => {
									action.onClick();
									setIsOpen(false);
								}}
								disabled={action.disabled}
							>
								{action.icon}
								<span className="ml-2">{action.label}</span>
							</DropdownMenuItem>
						))}
						{(workflowActions.length > 0 || managementActions.length > 0 || additionalActions.length > 0) && (
							<DropdownMenuSeparator />
						)}
					</>
				)}

				{additionalActions.length > 0 && (
					<>
						{additionalActions.map((action) => (
							<DropdownMenuItem
								key={action.id}
								onClick={() => {
									action.onClick();
									setIsOpen(false);
								}}
								disabled={action.disabled}
								className={action.variant === "destructive" ? "text-red-600" : undefined}
							>
								{action.icon}
								<span className="ml-2">{action.label}</span>
							</DropdownMenuItem>
						))}
						{(workflowActions.length > 0 || managementActions.length > 0) && (
							<DropdownMenuSeparator />
						)}
					</>
				)}

				{workflowActions.length > 0 && (
					<>
						{workflowActions.map((action) => (
							<DropdownMenuItem
								key={action.id}
								onClick={() => {
									action.onClick();
									setIsOpen(false);
								}}
								disabled={action.disabled}
							>
								{action.icon}
								<span className="ml-2">{action.label}</span>
							</DropdownMenuItem>
						))}
						{managementActions.length > 0 && <DropdownMenuSeparator />}
					</>
				)}

				{managementActions.map((action) => (
					<DropdownMenuItem
						key={action.id}
						onClick={() => {
							action.onClick();
							setIsOpen(false);
						}}
						disabled={action.disabled}
						className={action.variant === "destructive" ? "text-red-600" : undefined}
					>
						{action.icon}
						<span className="ml-2">{action.label}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Inline quick action buttons for common operations
interface InlineActionsProps {
	onLogCall?: () => void;
	onSendEmail?: () => void;
	onScheduleMeeting?: () => void;
	onAddNote?: () => void;
	size?: "sm" | "md";
	className?: string;
}

export function InlineActions({
	onLogCall,
	onSendEmail,
	onScheduleMeeting,
	onAddNote,
	size = "sm",
	className,
}: InlineActionsProps) {
	const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
	const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

	return (
		<div className={cn("flex items-center gap-1", className)}>
			{onLogCall && (
				<Button
					variant="ghost"
					size="sm"
					className={cn(buttonSize, "p-0")}
					onClick={onLogCall}
					title="Log Call"
				>
					<Phone className={iconSize} />
				</Button>
			)}
			{onSendEmail && (
				<Button
					variant="ghost"
					size="sm"
					className={cn(buttonSize, "p-0")}
					onClick={onSendEmail}
					title="Send Email"
				>
					<Mail className={iconSize} />
				</Button>
			)}
			{onScheduleMeeting && (
				<Button
					variant="ghost"
					size="sm"
					className={cn(buttonSize, "p-0")}
					onClick={onScheduleMeeting}
					title="Schedule Meeting"
				>
					<Calendar className={iconSize} />
				</Button>
			)}
			{onAddNote && (
				<Button
					variant="ghost"
					size="sm"
					className={cn(buttonSize, "p-0")}
					onClick={onAddNote}
					title="Add Note"
				>
					<MessageSquare className={iconSize} />
				</Button>
			)}
		</div>
	);
}

export default QuickActions;
