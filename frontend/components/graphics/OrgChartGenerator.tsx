"use client";

/**
 * OrgChartGenerator Component - DocFusion
 *
 * Form-based generator for creating organizational charts from staffing data.
 * Supports role definition, reporting relationships, and department grouping.
 *
 * Features:
 * - Add/edit/remove roles with title, name, reportsTo fields
 * - Department grouping for visual organization
 * - Live preview of generated chart
 * - AI-assisted role suggestions
 * - Validation of reporting hierarchy
 * - Export to proposal graphic
 *
 * @module components/graphics/OrgChartGenerator
 */

import * as React from "react";
import { useCallback, useState, useTransition } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { generateOrgChart, type StaffingData } from "@/lib/actions/graphics";
import { GraphicPreview } from "./GraphicPreview";
import {
	Plus,
	Trash2,
	Edit,
	User,
	Users,
	Building2,
	GitBranch,
	Wand2,
	Save,
	RefreshCw,
	AlertCircle,
	ChevronUp,
	ChevronDown,
	GripVertical,
} from "lucide-react";

interface Role {
	id: string;
	title: string;
	name?: string;
	reportsTo?: string;
	department?: string;
}

interface OrgChartGeneratorProps {
	/** Opportunity ID to associate the graphic with */
	opportunityId?: string;
	/** Initial roles to populate the form */
	initialRoles?: Role[];
	/** Callback when a graphic is generated */
	onGenerate?: (result: {
		diagramCode: string;
		format: "mermaid" | "d2";
		suggestedCaption: string;
		suggestedActionCaption: string;
	}) => void;
	/** Callback when the graphic is saved */
	onSave?: (graphicId: string) => void;
}

// Common role presets for quick addition
const ROLE_PRESETS = [
	{ title: "Program Manager", department: "Management" },
	{ title: "Project Manager", department: "Management" },
	{ title: "Technical Lead", department: "Engineering" },
	{ title: "Software Engineer", department: "Engineering" },
	{ title: "Systems Engineer", department: "Engineering" },
	{ title: "Quality Assurance Lead", department: "Quality" },
	{ title: "Business Analyst", department: "Analysis" },
	{ title: "Security Engineer", department: "Security" },
	{ title: "DevOps Engineer", department: "Operations" },
	{ title: "Data Scientist", department: "Data" },
];

// Common department options
const DEPARTMENTS = [
	"Management",
	"Engineering",
	"Quality",
	"Security",
	"Operations",
	"Analysis",
	"Data",
	"Support",
];

/**
 * Generate a unique ID for roles
 */
function generateId(): string {
	return `role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Individual role editor row
 */
function RoleRow({
	role,
	allRoles,
	onUpdate,
	onDelete,
	onMoveUp,
	onMoveDown,
	isFirst,
	isLast,
}: {
	role: Role;
	allRoles: Role[];
	onUpdate: (updates: Partial<Role>) => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	isFirst: boolean;
	isLast: boolean;
}) {
	// Get potential managers (roles this role could report to)
	const potentialManagers = allRoles.filter((r) => r.id !== role.id);

	return (
		<div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg group">
			{/* Drag handle */}
			<div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
				<Button
					variant="ghost"
					size="icon"
					className="h-5 w-5"
					onClick={onMoveUp}
					disabled={isFirst}
				>
					<ChevronUp className="h-3 w-3" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-5 w-5"
					onClick={onMoveDown}
					disabled={isLast}
				>
					<ChevronDown className="h-3 w-3" />
				</Button>
			</div>

			{/* Role fields */}
			<div className="flex-1 grid grid-cols-4 gap-2">
				<Input
					value={role.title}
					onChange={(e) => onUpdate({ title: e.target.value })}
					placeholder="Role Title *"
					className="text-sm"
				/>
				<Input
					value={role.name || ""}
					onChange={(e) => onUpdate({ name: e.target.value })}
					placeholder="Person Name"
					className="text-sm"
				/>
				<Select
					value={role.reportsTo || "none"}
					onValueChange={(v) => onUpdate({ reportsTo: v === "none" ? undefined : v })}
				>
					<SelectTrigger className="text-sm">
						<SelectValue placeholder="Reports To" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No Manager (Top Level)</SelectItem>
						{potentialManagers.map((r) => (
							<SelectItem key={r.id} value={r.title}>
								{r.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={role.department || "none"}
					onValueChange={(v) => onUpdate({ department: v === "none" ? undefined : v })}
				>
					<SelectTrigger className="text-sm">
						<SelectValue placeholder="Department" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No Department</SelectItem>
						{DEPARTMENTS.map((d) => (
							<SelectItem key={d} value={d}>
								{d}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Delete button */}
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
				onClick={onDelete}
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}

/**
 * OrgChartGenerator - Form for creating organizational charts from staffing data.
 *
 * @example
 * ```tsx
 * <OrgChartGenerator
 *   opportunityId={opportunityId}
 *   onGenerate={(result) => {
 *     console.log("Generated diagram:", result.diagramCode);
 *   }}
 * />
 * ```
 */
export function OrgChartGenerator({
	opportunityId,
	initialRoles = [],
	onGenerate,
	onSave,
}: OrgChartGeneratorProps) {
	// State
	const [roles, setRoles] = useState<Role[]>(
		initialRoles.length > 0
			? initialRoles
			: [{ id: generateId(), title: "Program Manager", department: "Management" }]
	);
	const [generatedCode, setGeneratedCode] = useState<string | null>(null);
	const [generatedCaption, setGeneratedCaption] = useState<string>("");
	const [generatedActionCaption, setGeneratedActionCaption] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Validation
	const validation = React.useMemo(() => {
		const issues: string[] = [];

		// Check for empty titles
		const emptyTitles = roles.filter((r) => !r.title.trim());
		if (emptyTitles.length > 0) {
			issues.push("All roles must have a title");
		}

		// Check for duplicate titles
		const titles = roles.map((r) => r.title.trim().toLowerCase());
		const duplicates = titles.filter((t, i) => t && titles.indexOf(t) !== i);
		if (duplicates.length > 0) {
			issues.push("Role titles must be unique");
		}

		// Check for circular reporting
		const checkCircular = (roleTitle: string, visited: Set<string>): boolean => {
			if (visited.has(roleTitle)) return true;
			visited.add(roleTitle);
			const role = roles.find((r) => r.title === roleTitle);
			if (role?.reportsTo) {
				return checkCircular(role.reportsTo, visited);
			}
			return false;
		};

		for (const role of roles) {
			if (role.reportsTo && checkCircular(role.title, new Set())) {
				issues.push("Circular reporting relationship detected");
				break;
			}
		}

		// Check for at least one top-level role
		const topLevel = roles.filter((r) => !r.reportsTo);
		if (topLevel.length === 0 && roles.length > 0) {
			issues.push("At least one role must be top-level (no manager)");
		}

		return {
			isValid: issues.length === 0 && roles.length > 0,
			issues,
		};
	}, [roles]);

	// Role management
	const addRole = useCallback((preset?: typeof ROLE_PRESETS[0]) => {
		const newRole: Role = {
			id: generateId(),
			title: preset?.title || "",
			department: preset?.department,
		};
		setRoles((prev) => [...prev, newRole]);
	}, []);

	const updateRole = useCallback((id: string, updates: Partial<Role>) => {
		setRoles((prev) =>
			prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
		);
	}, []);

	const deleteRole = useCallback((id: string) => {
		setRoles((prev) => prev.filter((r) => r.id !== id));
	}, []);

	const moveRole = useCallback((id: string, direction: "up" | "down") => {
		setRoles((prev) => {
			const index = prev.findIndex((r) => r.id === id);
			if (index === -1) return prev;

			const newIndex = direction === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= prev.length) return prev;

			const newRoles = [...prev];
			[newRoles[index], newRoles[newIndex]] = [newRoles[newIndex], newRoles[index]];
			return newRoles;
		});
	}, []);

	// Generate chart
	const handleGenerate = useCallback(() => {
		if (!validation.isValid) return;

		setError(null);

		startTransition(async () => {
			const staffingData: StaffingData = {
				roles: roles.map((r) => ({
					title: r.title,
					name: r.name,
					reportsTo: r.reportsTo,
					department: r.department,
				})),
				opportunityId,
			};

			const result = await generateOrgChart(staffingData);

			if (result.success) {
				setGeneratedCode(result.data.diagramCode);
				setGeneratedCaption(result.data.suggestedCaption);
				setGeneratedActionCaption(result.data.suggestedActionCaption);
				onGenerate?.(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [roles, opportunityId, validation.isValid, onGenerate]);

	// Clear all
	const handleClear = useCallback(() => {
		setRoles([{ id: generateId(), title: "", department: undefined }]);
		setGeneratedCode(null);
		setGeneratedCaption("");
		setGeneratedActionCaption("");
		setError(null);
	}, []);

	return (
		<div className="flex flex-col lg:flex-row gap-4 h-full">
			{/* Form panel */}
			<Card className="flex-1 flex flex-col">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<GitBranch className="h-5 w-5 text-primary" />
							<CardTitle>Organizational Chart</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleClear}
								disabled={isPending}
							>
								Clear All
							</Button>
						</div>
					</div>
					<CardDescription>
						Define roles and reporting relationships to generate an organizational chart.
					</CardDescription>
				</CardHeader>

				<CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
					{/* Quick add presets */}
					<div className="flex flex-wrap gap-1">
						<span className="text-xs text-muted-foreground mr-2 flex items-center">
							Quick add:
						</span>
						{ROLE_PRESETS.slice(0, 5).map((preset) => (
							<Button
								key={preset.title}
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={() => addRole(preset)}
							>
								<Plus className="h-3 w-3 mr-1" />
								{preset.title}
							</Button>
						))}
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm" className="h-7 text-xs">
									More...
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Add Role from Preset</DialogTitle>
									<DialogDescription>
										Select a common role to add to the organization chart.
									</DialogDescription>
								</DialogHeader>
								<div className="grid grid-cols-2 gap-2">
									{ROLE_PRESETS.map((preset) => (
										<Button
											key={preset.title}
											variant="outline"
											className="justify-start"
											onClick={() => {
												addRole(preset);
											}}
										>
											<User className="h-4 w-4 mr-2" />
											<div className="text-left">
												<div className="text-sm">{preset.title}</div>
												<div className="text-xs text-muted-foreground">
													{preset.department}
												</div>
											</div>
										</Button>
									))}
								</div>
							</DialogContent>
						</Dialog>
					</div>

					{/* Roles list */}
					<div className="flex-1 overflow-hidden">
						<div className="flex items-center justify-between mb-2">
							<Label className="text-sm font-medium">
								Roles ({roles.length})
							</Label>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => addRole()}
								className="h-7"
							>
								<Plus className="h-4 w-4 mr-1" />
								Add Role
							</Button>
						</div>

						<ScrollArea className="h-[300px] pr-4">
							<div className="space-y-2">
								{roles.map((role, index) => (
									<RoleRow
										key={role.id}
										role={role}
										allRoles={roles}
										onUpdate={(updates) => updateRole(role.id, updates)}
										onDelete={() => deleteRole(role.id)}
										onMoveUp={() => moveRole(role.id, "up")}
										onMoveDown={() => moveRole(role.id, "down")}
										isFirst={index === 0}
										isLast={index === roles.length - 1}
									/>
								))}
							</div>
						</ScrollArea>
					</div>

					{/* Validation issues */}
					{validation.issues.length > 0 && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
							<div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
								<AlertCircle className="h-4 w-4" />
								Validation Issues
							</div>
							<ul className="text-xs text-destructive/80 space-y-1 ml-6 list-disc">
								{validation.issues.map((issue, i) => (
									<li key={i}>{issue}</li>
								))}
							</ul>
						</div>
					)}

					{/* Error message */}
					{error && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
							<AlertCircle className="h-4 w-4" />
							{error}
						</div>
					)}
				</CardContent>

				<CardFooter className="border-t pt-4">
					<Button
						onClick={handleGenerate}
						disabled={!validation.isValid || isPending}
						isLoading={isPending}
						className="w-full"
					>
						<Wand2 className="h-4 w-4 mr-2" />
						Generate Chart
					</Button>
				</CardFooter>
			</Card>

			{/* Preview panel */}
			<Card className="flex-1 flex flex-col">
				<CardHeader>
					<CardTitle className="text-sm">Preview</CardTitle>
				</CardHeader>
				<CardContent className="flex-1 overflow-hidden">
					{generatedCode ? (
						<div className="h-full flex flex-col gap-3">
							<div className="flex-1 border rounded-lg overflow-hidden">
								<GraphicPreview
									code={generatedCode}
									format="mermaid"
									className="h-full"
								/>
							</div>

							{/* Captions */}
							<div className="space-y-2 text-sm">
								<div>
									<Label className="text-xs text-muted-foreground">Caption</Label>
									<p className="text-sm">{generatedCaption}</p>
								</div>
								<div>
									<Label className="text-xs text-muted-foreground">
										Action Caption
									</Label>
									<p className="text-sm italic">{generatedActionCaption}</p>
								</div>
							</div>
						</div>
					) : (
						<div className="h-full flex items-center justify-center text-muted-foreground">
							<div className="text-center">
								<Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
								<p className="text-sm">
									Add roles and click "Generate Chart" to see preview
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
