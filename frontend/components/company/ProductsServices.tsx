/**
 * Products and Services Component - DocFusion
 *
 * Manage company products and services catalog.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Plus, Trash2, Edit2, Package, Briefcase, X, Globe, ImageIcon, Loader2 } from "lucide-react";
import {
	getProducts,
	getServices,
	createProduct,
	updateProduct,
	deleteProduct,
	createService,
	updateService,
	deleteService,
} from "@/lib/actions/company-setup";
import type {
	Product,
	Service,
	CreateProductInput,
	CreateServiceInput,
	ProductStatus,
	ServiceStatus,
} from "@/lib/types/company";

// ============================================================================
// Types
// ============================================================================

interface ProductsServicesProps {
	type?: "products" | "services";
}

type ItemType = "product" | "service";

// ============================================================================
// Main Component
// ============================================================================

export function ProductsServices({ type }: ProductsServicesProps) {
	const [products, setProducts] = useState<Product[]>([]);
	const [services, setServices] = useState<Service[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<ItemType>(type === "services" ? "service" : "product");
	const [editingId, setEditingId] = useState<string | null>(null);

	// Load data on mount
	useEffect(() => {
		async function loadData() {
			try {
				const [productsData, servicesData] = await Promise.all([
					getProducts(),
					getServices(),
				]);
				setProducts(productsData);
				setServices(servicesData);
			} catch (error) {
				console.error("Failed to load products/services:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadData();
	}, []);

	const [productForm, setProductForm] = useState<CreateProductInput>({
		name: "",
		status: "active",
		features: [],
		shortDescription: "",
		longDescription: "",
		websiteUrl: "",
		logoUrl: "",
	});

	const [serviceForm, setServiceForm] = useState<CreateServiceInput>({
		name: "",
		status: "active",
		capabilities: [],
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSaving(true);

		try {
			if (activeTab === "product") {
				if (editingId) {
					const updated = await updateProduct(editingId, productForm);
					setProducts(products.map((p) => (p.id === editingId ? updated : p)));
				} else {
					const created = await createProduct(productForm);
					setProducts([...products, created]);
				}
				resetForm();
			} else {
				if (editingId) {
					const updated = await updateService(editingId, serviceForm);
					setServices(services.map((s) => (s.id === editingId ? updated : s)));
				} else {
					const created = await createService(serviceForm);
					setServices([...services, created]);
				}
				setServiceForm({ name: "", status: "active", capabilities: [] });
			}

			setIsDialogOpen(false);
			setEditingId(null);
		} catch (error) {
			console.error("Failed to save:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleEdit = (type: ItemType, item: Product | Service) => {
		setActiveTab(type);
		if (type === "product") {
			const product = item as Product;
			setEditingId(product.id);
			setProductForm({
				name: product.name,
				category: product.category || "",
				description: product.description || "",
				shortDescription: product.shortDescription || "",
				longDescription: product.longDescription || "",
				websiteUrl: product.websiteUrl || "",
				logoUrl: product.logoUrl || "",
				features: product.features,
				pricing: product.pricing || "",
				availability: product.availability || "",
				documentation: product.documentation || "",
				images: product.images || [],
				status: product.status,
			});
		} else {
			const service = item as Service;
			setEditingId(service.id);
			setServiceForm({
				name: service.name,
				category: service.category || "",
				description: service.description || "",
				capabilities: service.capabilities,
				pricing: service.pricing || "",
				turnaround: service.turnaround || "",
				certifications: service.certifications,
				status: service.status,
			});
		}
		setIsDialogOpen(true);
	};

	const handleDelete = async (type: ItemType, id: string) => {
		try {
			if (type === "product") {
				await deleteProduct(id);
				setProducts(products.filter((p) => p.id !== id));
			} else {
				await deleteService(id);
				setServices(services.filter((s) => s.id !== id));
			}
		} catch (error) {
			console.error("Failed to delete:", error);
		}
	};

	const addFeature = () => {
		setProductForm({
			...productForm,
			features: [...(productForm.features || []), { name: "" }],
		});
	};

	const updateFeature = (index: number, value: string) => {
		const newFeatures = [...(productForm.features || [])];
		newFeatures[index] = { ...newFeatures[index], name: value };
		setProductForm({ ...productForm, features: newFeatures });
	};

	const removeFeature = (index: number) => {
		setProductForm({
			...productForm,
			features: productForm.features?.filter((_, i) => i !== index) || [],
		});
	};

	const addCapability = () => {
		setServiceForm({
			...serviceForm,
			capabilities: [...(serviceForm.capabilities || []), { name: "" }],
		});
	};

	const updateCapability = (index: number, value: string) => {
		const newCaps = [...(serviceForm.capabilities || [])];
		newCaps[index] = { ...newCaps[index], name: value };
		setServiceForm({ ...serviceForm, capabilities: newCaps });
	};

	const removeCapability = (index: number) => {
		setServiceForm({
			...serviceForm,
			capabilities: serviceForm.capabilities?.filter((_, i) => i !== index) || [],
		});
	};

	const resetForm = () => {
		setProductForm({
			name: "",
			status: "active",
			features: [],
			shortDescription: "",
			longDescription: "",
			websiteUrl: "",
			logoUrl: "",
		});
		setServiceForm({ name: "", status: "active", capabilities: [] });
		setEditingId(null);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<Tabs
			value={activeTab}
			onValueChange={(v) => setActiveTab(v as ItemType)}
			className="space-y-6"
		>
			<div className="flex items-center justify-between">
				<TabsList>
					<TabsTrigger value="product" className="flex items-center gap-2">
						<Package className="h-4 w-4" />
						Products
						<span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
							{products.length}
						</span>
					</TabsTrigger>
					<TabsTrigger value="service" className="flex items-center gap-2">
						<Briefcase className="h-4 w-4" />
						Services
						<span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
							{services.length}
						</span>
					</TabsTrigger>
				</TabsList>

				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setEditingId(null);
								resetForm();
							}}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add {activeTab === "product" ? "Product" : "Service"}
							</Button>
							</DialogTrigger>
							<DialogContent className="max-w-2xl">
								<DialogHeader>
									<DialogTitle>
										{editingId ? "Edit" : "Create"}{" "}
										{activeTab === "product" ? "Product" : "Service"}
									</DialogTitle>
									<DialogDescription>
										{editingId
											? "Update the details."
											: `Add a new ${activeTab}.`}
									</DialogDescription>
								</DialogHeader>
								<form onSubmit={handleSubmit} className="space-y-4 mt-4">
									<div className="space-y-2">
										<Label>Name *</Label>
										<Input
											value={
												activeTab === "product"
													? productForm.name
													: serviceForm.name
											}
											onChange={(e) =>
												activeTab === "product"
													? setProductForm({
															...productForm,
															name: e.target.value,
														})
													: setServiceForm({
															...serviceForm,
															name: e.target.value,
														})
											}
											required
										/>
									</div>

									<div className="space-y-2">
										<Label>Category</Label>
										<Input
											value={
												activeTab === "product"
													? productForm.category || ""
													: serviceForm.category || ""
											}
											onChange={(e) =>
												activeTab === "product"
													? setProductForm({
															...productForm,
															category: e.target.value,
														})
													: setServiceForm({
															...serviceForm,
															category: e.target.value,
														})
											}
										/>
									</div>

									<div className="space-y-2">
										<Label>Description</Label>
										<Textarea
											value={
												activeTab === "product"
													? productForm.description || ""
													: serviceForm.description || ""
											}
											onChange={(e) =>
												activeTab === "product"
													? setProductForm({
															...productForm,
															description: e.target.value,
														})
													: setServiceForm({
															...serviceForm,
															description: e.target.value,
														})
											}
											rows={3}
										/>
									</div>

									{/* Product-specific fields */}
									{activeTab === "product" && (
										<>
											<div className="space-y-2">
												<Label>Short Description</Label>
												<Textarea
													value={productForm.shortDescription || ""}
													onChange={(e) =>
														setProductForm({
															...productForm,
															shortDescription: e.target.value,
														})
													}
													placeholder="Brief summary (max 500 characters)"
													rows={2}
													maxLength={500}
												/>
												<p className="text-xs text-muted-foreground">
													{(productForm.shortDescription?.length || 0)}/500 characters
												</p>
											</div>

											<div className="space-y-2">
												<Label>Long Description</Label>
												<Textarea
													value={productForm.longDescription || ""}
													onChange={(e) =>
														setProductForm({
															...productForm,
															longDescription: e.target.value,
														})
													}
													placeholder="Detailed product information..."
													rows={4}
												/>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="space-y-2">
													<Label>Product Website</Label>
													<div className="flex items-center gap-2">
														<Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
														<Input
															type="url"
															value={productForm.websiteUrl || ""}
															onChange={(e) =>
																setProductForm({
																	...productForm,
																	websiteUrl: e.target.value,
																})
															}
															placeholder="https://..."
														/>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Product Logo URL</Label>
													<div className="flex items-center gap-2">
														<ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
														<Input
															type="url"
															value={productForm.logoUrl || ""}
															onChange={(e) =>
																setProductForm({
																	...productForm,
																	logoUrl: e.target.value,
																})
															}
															placeholder="https://..."
														/>
													</div>
												</div>
											</div>
										</>
									)}

									{activeTab === "product" ? (
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<Label>Features</Label>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={addFeature}
												>
													<Plus className="h-4 w-4 mr-1" />
													Add
												</Button>
											</div>
											{(productForm.features || []).map((f, i) => (
												<div key={i} className="flex gap-2">
													<Input
														value={f.name}
														onChange={(e) => updateFeature(i, e.target.value)}
														placeholder={`Feature ${i + 1}`}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => removeFeature(i)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									) : (
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<Label>Capabilities</Label>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={addCapability}
												>
													<Plus className="h-4 w-4 mr-1" />
													Add
												</Button>
											</div>
											{(serviceForm.capabilities || []).map((c, i) => (
												<div key={i} className="flex gap-2">
													<Input
														value={c.name}
														onChange={(e) => updateCapability(i, e.target.value)}
														placeholder={`Capability ${i + 1}`}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => removeCapability(i)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									)}

									<div className="space-y-2">
										<Label>Status</Label>
										<Select
											value={
												activeTab === "product"
													? productForm.status
													: serviceForm.status
											}
											onValueChange={(value: ProductStatus | ServiceStatus) =>
												activeTab === "product"
													? setProductForm({
															...productForm,
															status: value as ProductStatus,
														})
													: setServiceForm({
															...serviceForm,
															status: value as ServiceStatus,
														})
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">Active</SelectItem>
												<SelectItem value="discontinued">Discontinued</SelectItem>
												{activeTab === "product" && (
													<SelectItem value="development">In Development</SelectItem>
												)}
												{activeTab === "service" && (
													<SelectItem value="limited">Limited</SelectItem>
												)}
											</SelectContent>
										</Select>
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
											{editingId ? "Update" : "Create"}
										</Button>
									</div>
								</form>
							</DialogContent>
						</Dialog>
					</div>

			<TabsContent value="product" className="space-y-4">
				{products.length === 0 ? (
					<Card>
						<CardContent className="p-8 text-center">
							<Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
							<p className="text-muted-foreground">No products yet.</p>
							<p className="text-sm text-muted-foreground">
								Click "Add Product" to get started.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{products.map((product) => (
							<Card key={product.id} className="hover:shadow-md transition-shadow">
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between">
										<div className="flex items-start gap-3">
											{product.logoUrl ? (
												<div className="h-10 w-10 rounded border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
													<img
														src={product.logoUrl}
														alt={product.name}
														className="max-h-full max-w-full object-contain"
													/>
												</div>
											) : (
												<div className="h-10 w-10 rounded border bg-muted flex items-center justify-center flex-shrink-0">
													<Package className="h-5 w-5 text-muted-foreground/50" />
												</div>
											)}
											<div>
												<CardTitle className="text-base">{product.name}</CardTitle>
												<CardDescription>{product.category}</CardDescription>
											</div>
										</div>
										<div className="flex items-center gap-1">
											<StatusBadge status={product.status} />
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={() => handleEdit("product", product)}
											>
												<Edit2 className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-destructive"
												onClick={() => handleDelete("product", product.id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-2 text-sm">
									{(product.shortDescription || product.description) && (
										<p className="line-clamp-2 text-muted-foreground">
											{product.shortDescription || product.description}
										</p>
									)}
									{product.websiteUrl && (
										<a
											href={product.websiteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
										>
											<Globe className="h-3 w-3" />
											Website
										</a>
									)}
									{product.features.length > 0 && (
										<div className="flex flex-wrap gap-1 pt-1">
											{product.features.slice(0, 5).map((f, i) => (
												<span key={i} className="px-2 py-0.5 text-xs rounded-full border bg-muted/50 text-muted-foreground">
													{f.name}
												</span>
											))}
											{product.features.length > 5 && (
												<span className="px-2 py-0.5 text-xs rounded-full border bg-muted/50 text-muted-foreground">
													+{product.features.length - 5}
												</span>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</TabsContent>

			<TabsContent value="service" className="space-y-4">
				{services.length === 0 ? (
					<Card>
						<CardContent className="p-8 text-center">
							<Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
							<p className="text-muted-foreground">No services yet.</p>
							<p className="text-sm text-muted-foreground">
								Click "Add Service" to get started.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{services.map((service) => (
							<Card key={service.id} className="hover:shadow-md transition-shadow">
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between">
										<div>
											<CardTitle className="text-base">{service.name}</CardTitle>
											<CardDescription>{service.category}</CardDescription>
										</div>
										<div className="flex items-center gap-1">
											<StatusBadge status={service.status} />
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={() => handleEdit("service", service)}
											>
												<Edit2 className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-destructive"
												onClick={() => handleDelete("service", service.id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-2 text-sm">
									{service.description && (
										<p className="line-clamp-2 text-muted-foreground">
											{service.description}
										</p>
									)}
									{service.capabilities.length > 0 && (
										<div className="flex flex-wrap gap-1 pt-1">
											{service.capabilities.slice(0, 5).map((c, i) => (
												<span key={i} className="px-2 py-0.5 text-xs rounded-full border bg-muted/50 text-muted-foreground">
													{c.name}
												</span>
											))}
											{service.capabilities.length > 5 && (
												<span className="px-2 py-0.5 text-xs rounded-full border bg-muted/50 text-muted-foreground">
													+{service.capabilities.length - 5}
												</span>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</TabsContent>
		</Tabs>
	);
}
