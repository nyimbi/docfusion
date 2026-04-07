/**
 * Company Profile Form Component - DocFusion
 *
 * Comprehensive form for managing company profile information organized
 * into collapsible sections: Identity, Address, Contacts, and Legal/Tax.
 */

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Building2,
	Save,
	Plus,
	X,
	MapPin,
	Users,
	FileText,
	ChevronDown,
	ChevronRight,
	Upload,
	Globe,
	Loader2,
} from "lucide-react";
import {
	AREA_OF_BUSINESS_OPTIONS,
	AREA_OF_BUSINESS_LABELS,
	type AreaOfBusiness,
} from "@/lib/types/company";
import type { CompanySettingsInput } from "@/lib/types/opportunity";
import { getCompanySettings, saveCompanySettings } from "@/lib/actions/company-settings";

// ============================================================================
// Types
// ============================================================================

interface CompanyProfileData {
	// Identity
	companyName: string;
	shortName: string;
	colloquialName: string;
	legalName: string;
	logoImageUrl: string;
	logoIconUrl: string;
	website: string;
	areaOfBusiness: AreaOfBusiness | "";
	// Address
	addressLine1: string;
	addressLine2: string;
	addressSuite: string;
	city: string;
	stateProvince: string;
	postalCode: string;
	country: string;
	// General Contact
	generalEmail: string;
	generalPhone: string;
	// Primary Contact
	primaryContactName: string;
	primaryContactTitle: string;
	primaryContactEmail: string;
	primaryContactPhone: string;
	// Contracts Contact
	contractsContactName: string;
	contractsContactTitle: string;
	contractsContactEmail: string;
	contractsContactPhone: string;
	// Legal/Tax
	registrationNumber: string;
	registrationCountry: string;
	taxId: string;
	vatNumber: string;
	dunsNumber: string;
	cageCode: string;
	samUei: string;
	naicsCodes: string[];
	// Metadata
	yearFounded: string;
	employeeCount: string;
	annualRevenue: string;
	industryDescription: string;
	// Content
	mission: string;
	vision: string;
	description: string;
	specialties: { name: string; description?: string }[];
	certifications: { name: string; issuer?: string; date?: string }[];
	awards: { name: string; issuer?: string; year?: number }[];
}

interface SectionState {
	identity: boolean;
	address: boolean;
	contacts: boolean;
	legal: boolean;
	content: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

interface CollapsibleSectionProps {
	title: string;
	description?: string;
	icon: React.ReactNode;
	isOpen: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

function CollapsibleSection({
	title,
	description,
	icon,
	isOpen,
	onToggle,
	children,
}: CollapsibleSectionProps) {
	return (
		<Collapsible open={isOpen} onOpenChange={onToggle}>
			<Card>
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{icon}
								<div>
									<CardTitle className="text-base">{title}</CardTitle>
									{description && (
										<CardDescription className="text-sm">
											{description}
										</CardDescription>
									)}
								</div>
							</div>
							{isOpen ? (
								<ChevronDown className="h-5 w-5 text-muted-foreground" />
							) : (
								<ChevronRight className="h-5 w-5 text-muted-foreground" />
							)}
						</div>
					</CardHeader>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<CardContent className="pt-0 border-t">{children}</CardContent>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}

interface ContactCardProps {
	title: string;
	name: string;
	jobTitle: string;
	email: string;
	phone: string;
	onNameChange: (value: string) => void;
	onTitleChange: (value: string) => void;
	onEmailChange: (value: string) => void;
	onPhoneChange: (value: string) => void;
}

function ContactCard({
	title,
	name,
	jobTitle,
	email,
	phone,
	onNameChange,
	onTitleChange,
	onEmailChange,
	onPhoneChange,
}: ContactCardProps) {
	return (
		<div className="p-4 rounded-lg border bg-muted/30 space-y-3">
			<h4 className="font-medium text-sm">{title}</h4>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label className="text-xs">Name</Label>
					<Input
						value={name}
						onChange={(e) => onNameChange(e.target.value)}
						placeholder="Full name"
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs">Title</Label>
					<Input
						value={jobTitle}
						onChange={(e) => onTitleChange(e.target.value)}
						placeholder="Job title"
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs">Email</Label>
					<Input
						type="email"
						value={email}
						onChange={(e) => onEmailChange(e.target.value)}
						placeholder="email@company.com"
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs">Phone</Label>
					<Input
						type="tel"
						value={phone}
						onChange={(e) => onPhoneChange(e.target.value)}
						placeholder="+1 (555) 123-4567"
					/>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyProfileForm() {
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [showSuccess, setShowSuccess] = useState(false);
	const [sections, setSections] = useState<SectionState>({
		identity: true,
		address: false,
		contacts: false,
		legal: false,
		content: false,
	});

	const [formData, setFormData] = useState<CompanyProfileData>({
		// Identity
		companyName: "",
		shortName: "",
		colloquialName: "",
		legalName: "",
		logoImageUrl: "",
		logoIconUrl: "",
		website: "",
		areaOfBusiness: "",
		// Address
		addressLine1: "",
		addressLine2: "",
		addressSuite: "",
		city: "",
		stateProvince: "",
		postalCode: "",
		country: "",
		// General Contact
		generalEmail: "",
		generalPhone: "",
		// Primary Contact
		primaryContactName: "",
		primaryContactTitle: "",
		primaryContactEmail: "",
		primaryContactPhone: "",
		// Contracts Contact
		contractsContactName: "",
		contractsContactTitle: "",
		contractsContactEmail: "",
		contractsContactPhone: "",
		// Legal/Tax
		registrationNumber: "",
		registrationCountry: "",
		taxId: "",
		vatNumber: "",
		dunsNumber: "",
		cageCode: "",
		samUei: "",
		naicsCodes: [],
		// Metadata
		yearFounded: "",
		employeeCount: "",
		annualRevenue: "",
		industryDescription: "",
		// Content
		mission: "",
		vision: "",
		description: "",
		specialties: [],
		certifications: [],
		awards: [],
	});

	// Load data on mount
	useEffect(() => {
		async function loadData() {
			try {
				const settings = await getCompanySettings();
				if (settings) {
					setFormData((prev) => ({
						...prev,
						companyName: settings.companyName || "",
						legalName: settings.legalName || "",
						logoImageUrl: settings.logoUrl || "",
						website: settings.website || "",
						addressLine1: settings.addressLine1 || "",
						addressLine2: settings.addressLine2 || "",
						city: settings.city || "",
						stateProvince: settings.stateProvince || "",
						postalCode: settings.postalCode || "",
						country: settings.country || "",
						primaryContactName: settings.primaryContactName || "",
						primaryContactTitle: settings.primaryContactTitle || "",
						primaryContactEmail: settings.primaryContactEmail || "",
						primaryContactPhone: settings.primaryContactPhone || "",
						contractsContactName: settings.contractsContactName || "",
						contractsContactEmail: settings.contractsContactEmail || "",
						contractsContactPhone: settings.contractsContactPhone || "",
						registrationNumber: settings.registrationNumber || "",
						taxId: settings.taxId || "",
						dunsNumber: settings.dunsNumber || "",
						cageCode: settings.cageCode || "",
						samUei: settings.samUei || "",
						naicsCodes: settings.naicsCodes || [],
						yearFounded: settings.yearFounded?.toString() || "",
						employeeCount: settings.employeeCount?.toString() || "",
						annualRevenue: settings.annualRevenue || "",
						industryDescription: settings.industryDescription || "",
					}));
				}
			} catch (error) {
				console.error("Failed to load company settings:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadData();
	}, []);

	const toggleSection = (section: keyof SectionState) => {
		setSections((prev) => ({ ...prev, [section]: !prev[section] }));
	};

	const updateField = <K extends keyof CompanyProfileData>(
		field: K,
		value: CompanyProfileData[K]
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			// Map form data to CompanySettingsInput (only fields supported by schema)
			const input: CompanySettingsInput = {
				companyName: formData.companyName || "Unnamed Company",
				legalName: formData.legalName || undefined,
				registrationNumber: formData.registrationNumber || undefined,
				taxId: formData.taxId || undefined,
				dunsNumber: formData.dunsNumber || undefined,
				cageCode: formData.cageCode || undefined,
				samUei: formData.samUei || undefined,
				naicsCodes: formData.naicsCodes,
				industryDescription: formData.industryDescription || undefined,
				yearFounded: formData.yearFounded ? parseInt(formData.yearFounded) : undefined,
				employeeCount: formData.employeeCount ? parseInt(formData.employeeCount) : undefined,
				annualRevenue: formData.annualRevenue || undefined,
				website: formData.website || undefined,
				addressLine1: formData.addressLine1 || undefined,
				addressLine2: formData.addressLine2 || undefined,
				city: formData.city || undefined,
				stateProvince: formData.stateProvince || undefined,
				postalCode: formData.postalCode || undefined,
				country: formData.country || undefined,
				primaryContactName: formData.primaryContactName || undefined,
				primaryContactTitle: formData.primaryContactTitle || undefined,
				primaryContactEmail: formData.primaryContactEmail || undefined,
				primaryContactPhone: formData.primaryContactPhone || undefined,
				contractsContactName: formData.contractsContactName || undefined,
				contractsContactEmail: formData.contractsContactEmail || undefined,
				contractsContactPhone: formData.contractsContactPhone || undefined,
				// Map logoImageUrl to logoUrl (schema field name)
				logoUrl: formData.logoImageUrl || undefined,
			};
			await saveCompanySettings(input);
			setShowSuccess(true);
			setTimeout(() => setShowSuccess(false), 3000);
		} catch (error) {
			console.error("Failed to save company settings:", error);
		} finally {
			setIsSaving(false);
		}
	};

	// Specialty management
	const addSpecialty = () => {
		updateField("specialties", [...formData.specialties, { name: "" }]);
	};

	const removeSpecialty = (index: number) => {
		updateField(
			"specialties",
			formData.specialties.filter((_, i) => i !== index)
		);
	};

	const updateSpecialty = (
		index: number,
		field: "name" | "description",
		value: string
	) => {
		const newSpecialties = [...formData.specialties];
		newSpecialties[index] = { ...newSpecialties[index], [field]: value };
		updateField("specialties", newSpecialties);
	};

	// NAICS codes management
	const [naicsInput, setNaicsInput] = useState("");

	const addNaicsCode = () => {
		if (naicsInput.trim() && !formData.naicsCodes.includes(naicsInput.trim())) {
			updateField("naicsCodes", [...formData.naicsCodes, naicsInput.trim()]);
			setNaicsInput("");
		}
	};

	const removeNaicsCode = (code: string) => {
		updateField(
			"naicsCodes",
			formData.naicsCodes.filter((c) => c !== code)
		);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{showSuccess && (
				<div className="p-4 rounded-lg bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-2">
					<div className="h-2 w-2 rounded-full bg-green-500" />
					Profile saved successfully!
				</div>
			)}

			{/* Identity Section */}
			<CollapsibleSection
				title="Company Identity"
				description="Names, logo, website, and area of business"
				icon={<Building2 className="h-5 w-5 text-primary" />}
				isOpen={sections.identity}
				onToggle={() => toggleSection("identity")}
			>
				<div className="space-y-4 pt-4">
					{/* Names */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label htmlFor="companyName">Formal Name *</Label>
							<Input
								id="companyName"
								value={formData.companyName}
								onChange={(e) => updateField("companyName", e.target.value)}
								placeholder="Full legal company name"
							/>
							<p className="text-xs text-muted-foreground">
								Used in official documents
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="shortName">Short Name</Label>
							<Input
								id="shortName"
								value={formData.shortName}
								onChange={(e) => updateField("shortName", e.target.value)}
								placeholder="e.g., DC"
							/>
							<p className="text-xs text-muted-foreground">
								Abbreviated version
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="colloquialName">Colloquial Name</Label>
							<Input
								id="colloquialName"
								value={formData.colloquialName}
								onChange={(e) => updateField("colloquialName", e.target.value)}
								placeholder="e.g., Datacraft Team"
							/>
							<p className="text-xs text-muted-foreground">
								Informal/friendly name
							</p>
						</div>
					</div>

					{/* Legal Name and Area of Business */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="legalName">Legal Entity Name</Label>
							<Input
								id="legalName"
								value={formData.legalName}
								onChange={(e) => updateField("legalName", e.target.value)}
								placeholder="If different from formal name"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="areaOfBusiness">Area of Business</Label>
							<Select
								value={formData.areaOfBusiness}
								onValueChange={(value) =>
									updateField("areaOfBusiness", value as AreaOfBusiness)
								}
							>
								<SelectTrigger id="areaOfBusiness">
									<SelectValue placeholder="Select industry..." />
								</SelectTrigger>
								<SelectContent>
									{AREA_OF_BUSINESS_OPTIONS.map((area) => (
										<SelectItem key={area} value={area}>
											{AREA_OF_BUSINESS_LABELS[area]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Website */}
					<div className="space-y-2">
						<Label htmlFor="website">Website</Label>
						<div className="flex items-center gap-2">
							<Globe className="h-4 w-4 text-muted-foreground" />
							<Input
								id="website"
								type="url"
								value={formData.website}
								onChange={(e) => updateField("website", e.target.value)}
								placeholder="https://www.company.com"
								className="flex-1"
							/>
						</div>
					</div>

					{/* Logos */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Company Logo</Label>
							<div className="flex items-center gap-3">
								{formData.logoImageUrl ? (
									<div className="relative h-16 w-32 border rounded bg-muted flex items-center justify-center overflow-hidden">
										<Image
											src={formData.logoImageUrl}
											alt="Logo"
											className="max-h-full max-w-full object-contain"
											width={128}
											height={64}
											unoptimized
										/>
									</div>
								) : (
									<div className="h-16 w-32 border rounded bg-muted flex items-center justify-center">
										<Building2 className="h-8 w-8 text-muted-foreground/50" />
									</div>
								)}
								<div className="flex-1">
									<Input
										value={formData.logoImageUrl}
										onChange={(e) =>
											updateField("logoImageUrl", e.target.value)
										}
										placeholder="Logo URL"
									/>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">
								Full logo for documents
							</p>
						</div>
						<div className="space-y-2">
							<Label>Icon/Favicon</Label>
							<div className="flex items-center gap-3">
								{formData.logoIconUrl ? (
									<div className="relative h-16 w-16 border rounded bg-muted flex items-center justify-center overflow-hidden">
										<Image
											src={formData.logoIconUrl}
											alt="Icon"
											className="max-h-full max-w-full object-contain"
											width={64}
											height={64}
											unoptimized
										/>
									</div>
								) : (
									<div className="h-16 w-16 border rounded bg-muted flex items-center justify-center">
										<Building2 className="h-6 w-6 text-muted-foreground/50" />
									</div>
								)}
								<div className="flex-1">
									<Input
										value={formData.logoIconUrl}
										onChange={(e) => updateField("logoIconUrl", e.target.value)}
										placeholder="Icon URL"
									/>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">
								Small mark/icon version
							</p>
						</div>
					</div>

					{/* Year Founded and Employees */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label htmlFor="yearFounded">Year Founded</Label>
							<Input
								id="yearFounded"
								type="number"
								min="1800"
								max={new Date().getFullYear()}
								value={formData.yearFounded}
								onChange={(e) => updateField("yearFounded", e.target.value)}
								placeholder="e.g., 2020"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="employeeCount">Number of Employees</Label>
							<Input
								id="employeeCount"
								type="number"
								min="1"
								value={formData.employeeCount}
								onChange={(e) => updateField("employeeCount", e.target.value)}
								placeholder="e.g., 50"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="annualRevenue">Annual Revenue</Label>
							<Input
								id="annualRevenue"
								value={formData.annualRevenue}
								onChange={(e) => updateField("annualRevenue", e.target.value)}
								placeholder="e.g., $1M - $5M"
							/>
						</div>
					</div>
				</div>
			</CollapsibleSection>

			{/* Address Section */}
			<CollapsibleSection
				title="Address"
				description="Physical location and mailing address"
				icon={<MapPin className="h-5 w-5 text-primary" />}
				isOpen={sections.address}
				onToggle={() => toggleSection("address")}
			>
				<div className="space-y-4 pt-4">
					<div className="grid grid-cols-1 gap-4">
						<div className="space-y-2">
							<Label htmlFor="addressLine1">Street Address</Label>
							<Input
								id="addressLine1"
								value={formData.addressLine1}
								onChange={(e) => updateField("addressLine1", e.target.value)}
								placeholder="123 Main Street"
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="addressLine2">Address Line 2</Label>
								<Input
									id="addressLine2"
									value={formData.addressLine2}
									onChange={(e) => updateField("addressLine2", e.target.value)}
									placeholder="Building name, floor, etc."
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="addressSuite">Suite/Unit</Label>
								<Input
									id="addressSuite"
									value={formData.addressSuite}
									onChange={(e) => updateField("addressSuite", e.target.value)}
									placeholder="Suite 100"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="space-y-2">
								<Label htmlFor="city">City</Label>
								<Input
									id="city"
									value={formData.city}
									onChange={(e) => updateField("city", e.target.value)}
									placeholder="City"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="stateProvince">State/Province</Label>
								<Input
									id="stateProvince"
									value={formData.stateProvince}
									onChange={(e) => updateField("stateProvince", e.target.value)}
									placeholder="State"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="postalCode">Postal Code</Label>
								<Input
									id="postalCode"
									value={formData.postalCode}
									onChange={(e) => updateField("postalCode", e.target.value)}
									placeholder="12345"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="country">Country</Label>
								<Input
									id="country"
									value={formData.country}
									onChange={(e) => updateField("country", e.target.value)}
									placeholder="United States"
								/>
							</div>
						</div>
					</div>
				</div>
			</CollapsibleSection>

			{/* Contacts Section */}
			<CollapsibleSection
				title="Contacts"
				description="Primary contact, contracts contact, and general inquiries"
				icon={<Users className="h-5 w-5 text-primary" />}
				isOpen={sections.contacts}
				onToggle={() => toggleSection("contacts")}
			>
				<div className="space-y-4 pt-4">
					{/* General Contact */}
					<div className="p-4 rounded-lg border bg-muted/30 space-y-3">
						<h4 className="font-medium text-sm">General Inquiries</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label className="text-xs">Email</Label>
								<Input
									type="email"
									value={formData.generalEmail}
									onChange={(e) => updateField("generalEmail", e.target.value)}
									placeholder="info@company.com"
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Phone</Label>
								<Input
									type="tel"
									value={formData.generalPhone}
									onChange={(e) => updateField("generalPhone", e.target.value)}
									placeholder="+1 (555) 000-0000"
								/>
							</div>
						</div>
					</div>

					{/* Primary Contact */}
					<ContactCard
						title="Primary Contact"
						name={formData.primaryContactName}
						jobTitle={formData.primaryContactTitle}
						email={formData.primaryContactEmail}
						phone={formData.primaryContactPhone}
						onNameChange={(v) => updateField("primaryContactName", v)}
						onTitleChange={(v) => updateField("primaryContactTitle", v)}
						onEmailChange={(v) => updateField("primaryContactEmail", v)}
						onPhoneChange={(v) => updateField("primaryContactPhone", v)}
					/>

					{/* Contracts Contact */}
					<ContactCard
						title="Contracts / Business Development Contact"
						name={formData.contractsContactName}
						jobTitle={formData.contractsContactTitle}
						email={formData.contractsContactEmail}
						phone={formData.contractsContactPhone}
						onNameChange={(v) => updateField("contractsContactName", v)}
						onTitleChange={(v) => updateField("contractsContactTitle", v)}
						onEmailChange={(v) => updateField("contractsContactEmail", v)}
						onPhoneChange={(v) => updateField("contractsContactPhone", v)}
					/>
				</div>
			</CollapsibleSection>

			{/* Legal/Tax Section */}
			<CollapsibleSection
				title="Legal & Tax Information"
				description="Registration, Tax ID, VAT, DUNS, CAGE, SAM UEI"
				icon={<FileText className="h-5 w-5 text-primary" />}
				isOpen={sections.legal}
				onToggle={() => toggleSection("legal")}
			>
				<div className="space-y-4 pt-4">
					{/* Registration */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="registrationNumber">Registration Number</Label>
							<Input
								id="registrationNumber"
								value={formData.registrationNumber}
								onChange={(e) =>
									updateField("registrationNumber", e.target.value)
								}
								placeholder="Company registration number"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="registrationCountry">Registration Country</Label>
							<Input
								id="registrationCountry"
								value={formData.registrationCountry}
								onChange={(e) =>
									updateField("registrationCountry", e.target.value)
								}
								placeholder="Country of incorporation"
							/>
						</div>
					</div>

					{/* Tax IDs */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="taxId">Tax ID / EIN</Label>
							<Input
								id="taxId"
								value={formData.taxId}
								onChange={(e) => updateField("taxId", e.target.value)}
								placeholder="XX-XXXXXXX"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="vatNumber">VAT Number</Label>
							<Input
								id="vatNumber"
								value={formData.vatNumber}
								onChange={(e) => updateField("vatNumber", e.target.value)}
								placeholder="For international tax"
							/>
						</div>
					</div>

					{/* Government Contract IDs */}
					<div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 space-y-4">
						<h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">
							Government Contract Identifiers
						</h4>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="space-y-2">
								<Label htmlFor="dunsNumber" className="text-xs">
									DUNS Number
								</Label>
								<Input
									id="dunsNumber"
									value={formData.dunsNumber}
									onChange={(e) => updateField("dunsNumber", e.target.value)}
									placeholder="9-digit DUNS"
									maxLength={9}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="cageCode" className="text-xs">
									CAGE Code
								</Label>
								<Input
									id="cageCode"
									value={formData.cageCode}
									onChange={(e) => updateField("cageCode", e.target.value)}
									placeholder="5-character code"
									maxLength={5}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="samUei" className="text-xs">
									SAM UEI
								</Label>
								<Input
									id="samUei"
									value={formData.samUei}
									onChange={(e) => updateField("samUei", e.target.value)}
									placeholder="12-character UEI"
									maxLength={12}
								/>
							</div>
						</div>
					</div>

					{/* NAICS Codes */}
					<div className="space-y-2">
						<Label>NAICS Codes</Label>
						<div className="flex items-center gap-2">
							<Input
								value={naicsInput}
								onChange={(e) => setNaicsInput(e.target.value)}
								placeholder="Enter NAICS code"
								className="flex-1"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addNaicsCode();
									}
								}}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addNaicsCode}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
						{formData.naicsCodes.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-2">
								{formData.naicsCodes.map((code) => (
									<span
										key={code}
										className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border bg-muted"
									>
										{code}
										<button
											type="button"
											onClick={() => removeNaicsCode(code)}
											className="hover:text-destructive"
										>
											<X className="h-3 w-3" />
										</button>
									</span>
								))}
							</div>
						)}
						<p className="text-xs text-muted-foreground">
							North American Industry Classification System codes
						</p>
					</div>
				</div>
			</CollapsibleSection>

			{/* Company Content Section */}
			<CollapsibleSection
				title="Company Content"
				description="Mission, vision, description, and specialties"
				icon={<FileText className="h-5 w-5 text-primary" />}
				isOpen={sections.content}
				onToggle={() => toggleSection("content")}
			>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label htmlFor="mission">Mission Statement</Label>
						<Textarea
							id="mission"
							value={formData.mission}
							onChange={(e) => updateField("mission", e.target.value)}
							placeholder="Your company's mission..."
							rows={3}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="vision">Vision Statement</Label>
						<Textarea
							id="vision"
							value={formData.vision}
							onChange={(e) => updateField("vision", e.target.value)}
							placeholder="Your company's vision for the future..."
							rows={3}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Company Description</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) => updateField("description", e.target.value)}
							placeholder="Detailed description of your company..."
							rows={5}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="industryDescription">Industry Description</Label>
						<Textarea
							id="industryDescription"
							value={formData.industryDescription}
							onChange={(e) =>
								updateField("industryDescription", e.target.value)
							}
							placeholder="Describe your industry and market position..."
							rows={3}
						/>
					</div>

					{/* Specialties */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<Label>Specialties & Services</Label>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addSpecialty}
							>
								<Plus className="h-4 w-4 mr-1" />
								Add Specialty
							</Button>
						</div>
						{formData.specialties.map((specialty, index) => (
							<div key={index} className="flex gap-2 items-start">
								<Input
									value={specialty.name}
									onChange={(e) => updateSpecialty(index, "name", e.target.value)}
									placeholder="e.g., Data Analytics"
									className="flex-1"
								/>
								<Input
									value={specialty.description || ""}
									onChange={(e) =>
										updateSpecialty(index, "description", e.target.value)
									}
									placeholder="Description (optional)"
									className="flex-[2]"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => removeSpecialty(index)}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				</div>
			</CollapsibleSection>

			{/* Save Button */}
			<div className="flex justify-end pt-4">
				<Button onClick={handleSave} disabled={isSaving} size="lg">
					{isSaving ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Save className="h-4 w-4 mr-2" />
					)}
					{isSaving ? "Saving..." : "Save Profile"}
				</Button>
			</div>
		</div>
	);
}
