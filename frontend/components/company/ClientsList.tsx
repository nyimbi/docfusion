/**
 * Clients List Component - DocFusion
 *
 * Manage client database and relationships.
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Plus, Trash2, Edit2, Building2, Mail, Phone, Loader2 } from "lucide-react";
import { getClients, getClientStats, getClientsByIndustry, createClient, updateClient, deleteClient } from "@/lib/actions/clients";
import type { Client, ClientStatus, CreateClientInput } from "@/lib/types/company";

// ============================================================================
// Main Component
// ============================================================================

export function ClientsList() {
	const [clients, setClients] = useState<Client[]>([]);
	const [stats, setStats] = useState<{
		totalClients: number;
		activeClients: number;
		formerClients: number;
		prospectClients: number;
	} | null>(null);
	const [industries, setIndustries] = useState<{ industry: string; count: number; active: number }[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	// Load data on mount
	useEffect(() => {
		async function loadData() {
			try {
				const [clientsData, statsData, industriesData] = await Promise.all([
					getClients(),
					getClientStats(),
					getClientsByIndustry(),
				]);
				setClients(clientsData);
				setStats(statsData);
				setIndustries(industriesData);
			} catch (error) {
				console.error("Failed to load clients:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadData();
	}, []);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingClient, setEditingClient] = useState<Client | null>(null);
	const [formData, setFormData] = useState<CreateClientInput>({
		name: "",
		industry: "",
		status: "prospect",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSaving(true);

		try {
			if (editingClient) {
				const updated = await updateClient(editingClient.id, formData);
				setClients(clients.map((c) => (c.id === editingClient.id ? updated : c)));
			} else {
				const created = await createClient(formData);
				setClients([...clients, created]);
			}

			setIsDialogOpen(false);
			setEditingClient(null);
			setFormData({
				name: "",
				industry: "",
				status: "prospect",
			});
		} catch (error) {
			console.error("Failed to save client:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleEdit = (client: Client) => {
		setEditingClient(client);
		setFormData({
			name: client.name,
			industry: client.industry || "",
			status: client.status,
		});
		setIsDialogOpen(true);
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteClient(id);
			setClients(clients.filter((c) => c.id !== id));
		} catch (error) {
			console.error("Failed to delete client:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Active</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">{stats?.activeClients ?? 0}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Prospects</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-amber-600">{stats?.prospectClients ?? 0}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Former</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-muted-foreground">{stats?.formerClients ?? 0}</div>
					</CardContent>
				</Card>
			</div>

			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Building2 className="h-5 w-5" />
					<h2 className="text-lg font-semibold">Clients</h2>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={() => setEditingClient(null)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Client
						</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle>
									{editingClient ? "Edit Client" : "Add Client"}
								</DialogTitle>
								<DialogDescription>
									{editingClient
										? "Update client information."
										: "Add a new client to your database."}
								</DialogDescription>
							</DialogHeader>
							<form onSubmit={handleSubmit} className="space-y-4 mt-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Company Name *</Label>
										<Input
											value={formData.name}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											} 
											required
										/>
									</div>
									<div className="space-y-2">
										<Label>Status</Label>
										<Select
											value={formData.status}
											onValueChange={(value: ClientStatus) =>
												setFormData({
													...formData,
													status: value,
												})
											} 
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="prospect">Prospect</SelectItem>
												<SelectItem value="active">Active</SelectItem>
												<SelectItem value="former">Former</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<div className="flex justify-end gap-2 pt-4">
									<Button
										type="button"
										variant="outline"
										onClick={() => setIsDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button type="submit">
										{editingClient ? "Update" : "Create"} Client
									</Button>
								</div>
							</form>
						</DialogContent>
					</Dialog>
				</div>

			{/* Client Cards */}
			{clients.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
						<p className="text-muted-foreground">No clients yet.</p>
						<p className="text-sm text-muted-foreground">
							Click "Add Client" to get started.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{clients.map((client) => (
						<Card key={client.id} className="hover:shadow-md transition-shadow">
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between">
									<div>
										<CardTitle className="text-base">{client.name}</CardTitle>
										<CardDescription>
											{client.industry} {client.size && `• ${client.size}`}
										</CardDescription>
									</div>
									<div className="flex items-center gap-2">
										<StatusBadge status={client.status} />
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={() => handleEdit(client)}
											>
												<Edit2 className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-destructive"
												onClick={() => handleDelete(client.id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								{client.contactName && (
									<div className="flex items-center gap-2 text-muted-foreground">
										<span>Contact: {client.contactName}</span>
									</div>
								)}
								{client.contactEmail && (
									<div className="flex items-center gap-2">
										<Mail className="h-4 w-4" />
										<a
											href={`mailto:${client.contactEmail}`}
											className="text-blue-600 hover:underline"
										>
											{client.contactEmail}
										</a>
									</div>
								)}
								{client.contactPhone && (
									<div className="flex items-center gap-2">
										<Phone className="h-4 w-4" />
										<span>{client.contactPhone}</span>
									</div>
								)}
								{client.notes && (
									<p className="text-muted-foreground mt-2 line-clamp-2">
										{client.notes}
									</p>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
