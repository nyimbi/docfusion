/**
 * Roles Manager Component - DocFusion
 *
 * Manage job roles, responsibilities, and skill requirements.
 * Fetches data using server actions and provides full CRUD functionality.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, Users, X, Loader2 } from "lucide-react";
import { getRoles, getDepartments, createRole, updateRole, deleteRole } from "@/lib/actions/company-setup";
import type { Role, CreateRoleInput } from "@/lib/types/company";

// ============================================================================
// Types
// ============================================================================

interface RoleFormData {
	name: string;
	description: string;
	department: string;
	level: string;
	responsibilities: string[];
	skillsRequired: string[];
}

// ============================================================================
// Main Component
// ============================================================================

export function RolesManager() {
	const [roles, setRoles] = useState<Role[]>([]);
	const [departments, setDepartments] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	// Load data on mount
	useEffect(() => {
		async function loadData() {
			try {
				const [rolesData, depsData] = await Promise.all([
					getRoles(),
					getDepartments(),
				]);
				setRoles(rolesData);
				setDepartments(depsData);
			} catch (error) {
				console.error("Failed to load roles:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadData();
	}, []);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);
	const [formData, setFormData] = useState<RoleFormData>({
		name: "",
		description: "",
		department: "",
		level: "",
		responsibilities: [],
		skillsRequired: [],
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSaving(true);

		try {
			if (editingRole) {
				const updated = await updateRole(editingRole.id, formData);
				setRoles(roles.map((r) => (r.id === editingRole.id ? updated : r)));
			} else {
				const created = await createRole(formData as CreateRoleInput);
				setRoles([...roles, created]);
			}

			setIsDialogOpen(false);
			setEditingRole(null);
			resetForm();
		} catch (error) {
			console.error("Failed to save role:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const resetForm = () => {
		setFormData({
			name: "",
			description: "",
			department: "",
			level: "",
			responsibilities: [],
			skillsRequired: [],
		});
	};

	const handleEdit = (role: Role) => {
		setEditingRole(role);
		setFormData({
			name: role.name,
			description: role.description || "",
			department: role.department || "",
			level: role.level || "",
			responsibilities: role.responsibilities || [],
			skillsRequired: role.skillsRequired || [],
		});
		setIsDialogOpen(true);
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteRole(id);
			setRoles(roles.filter((r) => r.id !== id));
		} catch (error) {
			console.error("Failed to delete role:", error);
		}
	};

	const addItem = (field: "responsibilities" | "skillsRequired") => {
		setFormData({
			...formData,
			[field]: [...formData[field], ""],
		});
	};

	const updateItem = (
		field: "responsibilities" | "skillsRequired",
		index: number,
		value: string
	) => {
		const newItems = [...formData[field]];
		newItems[index] = value;
		setFormData({ ...formData, [field]: newItems });
	};

	const removeItem = (
		field: "responsibilities" | "skillsRequired",
		index: number
	) => {
		setFormData({
			...formData,
			[field]: formData[field].filter((_, i) => i !== index),
		});
	};

	const rolesByDepartment = roles.reduce(
		(acc, role) => {
			const dept = role.department || "Unassigned";
			if (!acc[dept]) acc[dept] = [];
			acc[dept].push(role);
			return acc;
		},
		{} as Record<string, Role[]>
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Users className="h-5 w-5" />
					<h2 className="text-lg font-semibold">Team Roles</h2>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setEditingRole(null);
								resetForm();
							}}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Role
						</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>
									{editingRole ? "Edit Role" : "Create Role"}
								</DialogTitle>
								<DialogDescription>
									Add or update a role in your organization.
								</DialogDescription>
							</DialogHeader>
							<form onSubmit={handleSubmit} className="space-y-4 mt-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="name">Role Name *</Label>
										<Input
											id="name"
											value={formData.name}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="department">Department</Label>
										<Select
											value={formData.department}
											onValueChange={(value) =>
												setFormData({ ...formData, department: value })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select or type new" />
											</SelectTrigger>
											<SelectContent>
												{departments.map((dept) => (
													<SelectItem key={dept} value={dept}>
														{dept}
													</SelectItem>
												))}
												<SelectItem value="other">+ New Department</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="description">Description</Label>
									<Textarea
										id="description"
										value={formData.description}
										onChange={(e) =>
											setFormData({ ...formData, description: e.target.value })
										}
										rows={3}
									/
								></div>

								<div className="space-y-2">
									<Label>Level</Label>
									<Select
										value={formData.level}
										onValueChange={(value) =>
											setFormData({ ...formData, level: value })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select level" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="entry">Entry Level</SelectItem>
											<SelectItem value="mid">Mid Level</SelectItem>
											<SelectItem value="senior">Senior Level</SelectItem>
											<SelectItem value="lead">Lead/Principal</SelectItem>
											<SelectItem value="exec">Executive</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label>Responsibilities</Label>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => addItem("responsibilities")}
										>
											<Plus className="h-4 w-4 mr-1" />
											Add
										</Button>
									</div>
									{formData.responsibilities.map((resp, index) => (
										<div key={index} className="flex gap-2">
											<Input
												value={resp}
												onChange={(e) =>
													updateItem("responsibilities", index, e.target.value)
												}
												placeholder={`Responsibility ${index + 1}`}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => removeItem("responsibilities", index)}
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label>Required Skills</Label>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => addItem("skillsRequired")}
										>
											<Plus className="h-4 w-4 mr-1" />
											Add
										</Button>
									</div>
									{formData.skillsRequired.map((skill, index) => (
										<div key={index} className="flex gap-2">
											<Input
												value={skill}
												onChange={(e) =>
													updateItem("skillsRequired", index, e.target.value)
												}
												placeholder={`Skill ${index + 1}`}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => removeItem("skillsRequired", index)}
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>

								<div className="flex justify-end gap-2 pt-4">
									<Button
										type="button"
										variant="outline"
										onClick={() => setIsDialogOpen(false)}
										disabled={isSaving}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isSaving}>
										{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
										{editingRole ? "Update" : "Create"} Role
									</Button>
								</div>
							</form>
						</DialogContent>
					</Dialog>
				</div>

			{/* Roles by Department */}
			{Object.keys(rolesByDepartment).length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
						<p className="text-muted-foreground">No roles defined yet.</p>
						<p className="text-sm text-muted-foreground">
							Click "Add Role" to get started.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6">
					{Object.entries(rolesByDepartment).map(([dept, deptRoles]) => (
						<div key={dept}>
							<h3 className="text-lg font-medium mb-3 flex items-center gap-2">
								<span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
									{dept}
								</span>
								<span className="text-muted-foreground text-sm">
									{deptRoles.length} role{deptRoles.length !== 1 ? "s" : ""}
								</span>
							</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{deptRoles.map((role) => (
									<RoleCard
										key={role.id}
										role={role}
										onEdit={() => handleEdit(role)}
										onDelete={() => handleDelete(role.id)}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Role Card Component
// ============================================================================

interface RoleCardProps {
	role: Role;
	onEdit: () => void;
	onDelete: () => void;
}

function RoleCard({ role, onEdit, onDelete }: RoleCardProps) {
	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="text-base">{role.name}</CardTitle>
						<CardDescription>
							{role.level ? `${role.level} Level` : "No level set"}
						</CardDescription>
					</div>
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={onEdit}
						>
							<Edit2 className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-destructive"
							onClick={onDelete}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				{role.description && (
					<p className="line-clamp-2 text-muted-foreground">
						{role.description}
					</p>
				)}
				{role.responsibilities.length > 0 && (
					<div>
						<p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
							Responsibilities ({role.responsibilities.length})
						</p>
						<ul className="space-y-0.5 text-xs">
							{role.responsibilities.slice(0, 3).map((resp, i) => (
								<li key={i} className="line-clamp-1">
									• {resp}
								</li>
							))}
							{role.responsibilities.length > 3 && (
								<li className="text-muted-foreground">
									...+{role.responsibilities.length - 3} more
								</li>
							)}
						</ul>
					</div>
				)}
				{role.skillsRequired.length > 0 && (
					<div className="flex flex-wrap gap-1 pt-1">
						{role.skillsRequired.slice(0, 4).map((skill, i) => (
							<span key={i} className="px-2 py-0.5 text-xs rounded-full border bg-muted/50 text-muted-foreground">
								{skill}
							</span>
						))}
						{role.skillsRequired.length > 4 && (
							<span className="px-2 py-0.5 text-xs rounded-full border bg-muted/50 text-muted-foreground">
								+{role.skillsRequired.length - 4}
							</span>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
