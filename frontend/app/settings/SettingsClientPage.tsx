/**
 * SettingsClientPage Component - DocFusion
 *
 * Client-side settings management with tabbed interface.
 */

"use client";

import { useState, useTransition } from "react";
import type { CompanySettings, CompanySettingsInput, SmallBusinessCertification } from "@/lib/types/opportunity";
import { saveCompanySettings } from "@/lib/actions/company-settings";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SettingsClientPageProps {
	initialSettings: CompanySettings | null;
}

type SettingsTab = "company" | "contacts" | "capabilities" | "branding";

// ============================================================================
// Main Component
// ============================================================================

export function SettingsClientPage({ initialSettings }: SettingsClientPageProps) {
	const [isPending, startTransition] = useTransition();
	const [activeTab, setActiveTab] = useState<SettingsTab>("company");
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Form state
	const [formData, setFormData] = useState<Partial<CompanySettingsInput>>({
		companyName: initialSettings?.companyName ?? "",
		legalName: initialSettings?.legalName ?? "",
		registrationNumber: initialSettings?.registrationNumber ?? "",
		taxId: initialSettings?.taxId ?? "",
		dunsNumber: initialSettings?.dunsNumber ?? "",
		cageCode: initialSettings?.cageCode ?? "",
		samUei: initialSettings?.samUei ?? "",
		naicsCodes: initialSettings?.naicsCodes ?? [],
		industryDescription: initialSettings?.industryDescription ?? "",
		yearFounded: initialSettings?.yearFounded ?? undefined,
		employeeCount: initialSettings?.employeeCount ?? undefined,
		annualRevenue: initialSettings?.annualRevenue ?? "",
		certifications: initialSettings?.certifications ?? [],
		website: initialSettings?.website ?? "",
		addressLine1: initialSettings?.addressLine1 ?? "",
		addressLine2: initialSettings?.addressLine2 ?? "",
		city: initialSettings?.city ?? "",
		stateProvince: initialSettings?.stateProvince ?? "",
		postalCode: initialSettings?.postalCode ?? "",
		country: initialSettings?.country ?? "",
		primaryContactName: initialSettings?.primaryContactName ?? "",
		primaryContactTitle: initialSettings?.primaryContactTitle ?? "",
		primaryContactEmail: initialSettings?.primaryContactEmail ?? "",
		primaryContactPhone: initialSettings?.primaryContactPhone ?? "",
		contractsContactName: initialSettings?.contractsContactName ?? "",
		contractsContactEmail: initialSettings?.contractsContactEmail ?? "",
		contractsContactPhone: initialSettings?.contractsContactPhone ?? "",
		coreCapabilities: initialSettings?.coreCapabilities ?? [],
		differentiators: initialSettings?.differentiators ?? [],
		pastPerformanceSummary: initialSettings?.pastPerformanceSummary ?? "",
		companyBoilerplate: initialSettings?.companyBoilerplate ?? "",
		logoUrl: initialSettings?.logoUrl ?? "",
		primaryColor: initialSettings?.primaryColor ?? "#2563eb",
		secondaryColor: initialSettings?.secondaryColor ?? "#64748b",
	});

	const updateField = <K extends keyof CompanySettingsInput>(
		field: K,
		value: CompanySettingsInput[K]
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		setSaved(false);
	};

	const handleSave = () => {
		if (!formData.companyName) {
			setError("Company name is required");
			return;
		}

		setError(null);
		startTransition(async () => {
			try {
				await saveCompanySettings(formData as CompanySettingsInput);
				setSaved(true);
				setTimeout(() => setSaved(false), 3000);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to save settings");
			}
		});
	};

	const tabs: { id: SettingsTab; label: string }[] = [
		{ id: "company", label: "Company Profile" },
		{ id: "contacts", label: "Contacts" },
		{ id: "capabilities", label: "Capabilities" },
		{ id: "branding", label: "Branding" },
	];

	return (
		<div className="space-y-6">
			{/* Status messages */}
			{error && (
				<div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-4">
					{error}
				</div>
			)}
			{saved && (
				<div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg p-4">
					Settings saved successfully!
				</div>
			)}

			{/* Tabs */}
			<div className="border-b border-[var(--border)]">
				<nav className="flex gap-4">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
								activeTab === tab.id
									? "border-blue-600 text-blue-600"
									: "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
							)}
						>
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* Tab Content */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-6">
				{activeTab === "company" && (
					<CompanyProfileTab formData={formData} updateField={updateField} />
				)}
				{activeTab === "contacts" && (
					<ContactsTab formData={formData} updateField={updateField} />
				)}
				{activeTab === "capabilities" && (
					<CapabilitiesTab formData={formData} updateField={updateField} />
				)}
				{activeTab === "branding" && (
					<BrandingTab formData={formData} updateField={updateField} />
				)}
			</div>

			{/* Save Button */}
			<div className="flex justify-end">
				<Button onClick={handleSave} disabled={isPending}>
					{isPending ? "Saving..." : "Save Settings"}
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Tab Components
// ============================================================================

interface TabProps {
	formData: Partial<CompanySettingsInput>;
	updateField: <K extends keyof CompanySettingsInput>(
		field: K,
		value: CompanySettingsInput[K]
	) => void;
}

function CompanyProfileTab({ formData, updateField }: TabProps) {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Company Name" required>
					<input
						type="text"
						value={formData.companyName ?? ""}
						onChange={(e) => updateField("companyName", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="Your Company Name"
					/>
				</FormField>

				<FormField label="Legal Name">
					<input
						type="text"
						value={formData.legalName ?? ""}
						onChange={(e) => updateField("legalName", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="Legal entity name (if different)"
					/>
				</FormField>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField label="DUNS Number">
					<input
						type="text"
						value={formData.dunsNumber ?? ""}
						onChange={(e) => updateField("dunsNumber", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="123456789"
					/>
				</FormField>

				<FormField label="CAGE Code">
					<input
						type="text"
						value={formData.cageCode ?? ""}
						onChange={(e) => updateField("cageCode", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="XXXXX"
					/>
				</FormField>

				<FormField label="SAM.gov UEI">
					<input
						type="text"
						value={formData.samUei ?? ""}
						onChange={(e) => updateField("samUei", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="Unique Entity ID"
					/>
				</FormField>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Tax ID / EIN">
					<input
						type="text"
						value={formData.taxId ?? ""}
						onChange={(e) => updateField("taxId", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="XX-XXXXXXX"
					/>
				</FormField>

				<FormField label="Registration Number">
					<input
						type="text"
						value={formData.registrationNumber ?? ""}
						onChange={(e) => updateField("registrationNumber", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="Business registration #"
					/>
				</FormField>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField label="Year Founded">
					<input
						type="number"
						value={formData.yearFounded ?? ""}
						onChange={(e) => updateField("yearFounded", e.target.value ? parseInt(e.target.value) : undefined)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="2010"
					/>
				</FormField>

				<FormField label="Number of Employees">
					<input
						type="number"
						value={formData.employeeCount ?? ""}
						onChange={(e) => updateField("employeeCount", e.target.value ? parseInt(e.target.value) : undefined)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="50"
					/>
				</FormField>

				<FormField label="Annual Revenue">
					<input
						type="text"
						value={formData.annualRevenue ?? ""}
						onChange={(e) => updateField("annualRevenue", e.target.value)}
						className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						placeholder="$1M - $5M"
					/>
				</FormField>
			</div>

			<FormField label="Website">
				<input
					type="url"
					value={formData.website ?? ""}
					onChange={(e) => updateField("website", e.target.value)}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
					placeholder="https://www.example.com"
				/>
			</FormField>

			<div className="border-t border-[var(--border)] pt-4">
				<h3 className="font-medium text-[var(--foreground)] mb-4">Address</h3>
				<div className="space-y-4">
					<FormField label="Address Line 1">
						<input
							type="text"
							value={formData.addressLine1 ?? ""}
							onChange={(e) => updateField("addressLine1", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							placeholder="123 Main Street"
						/>
					</FormField>

					<FormField label="Address Line 2">
						<input
							type="text"
							value={formData.addressLine2 ?? ""}
							onChange={(e) => updateField("addressLine2", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							placeholder="Suite 100"
						/>
					</FormField>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<FormField label="City">
							<input
								type="text"
								value={formData.city ?? ""}
								onChange={(e) => updateField("city", e.target.value)}
								className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							/>
						</FormField>

						<FormField label="State/Province">
							<input
								type="text"
								value={formData.stateProvince ?? ""}
								onChange={(e) => updateField("stateProvince", e.target.value)}
								className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							/>
						</FormField>

						<FormField label="Postal Code">
							<input
								type="text"
								value={formData.postalCode ?? ""}
								onChange={(e) => updateField("postalCode", e.target.value)}
								className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							/>
						</FormField>

						<FormField label="Country">
							<input
								type="text"
								value={formData.country ?? ""}
								onChange={(e) => updateField("country", e.target.value)}
								className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							/>
						</FormField>
					</div>
				</div>
			</div>

			<FormField label="NAICS Codes">
				<TagInput
					value={formData.naicsCodes ?? []}
					onChange={(tags) => updateField("naicsCodes", tags)}
					placeholder="Add NAICS code and press Enter"
				/>
			</FormField>

			<FormField label="Certifications">
				<CertificationSelect
					value={formData.certifications ?? []}
					onChange={(certs) => updateField("certifications", certs)}
				/>
			</FormField>
		</div>
	);
}

function ContactsTab({ formData, updateField }: TabProps) {
	return (
		<div className="space-y-8">
			<div>
				<h3 className="font-medium text-[var(--foreground)] mb-4">Primary Contact</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<FormField label="Name">
						<input
							type="text"
							value={formData.primaryContactName ?? ""}
							onChange={(e) => updateField("primaryContactName", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>

					<FormField label="Title">
						<input
							type="text"
							value={formData.primaryContactTitle ?? ""}
							onChange={(e) => updateField("primaryContactTitle", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>

					<FormField label="Email">
						<input
							type="email"
							value={formData.primaryContactEmail ?? ""}
							onChange={(e) => updateField("primaryContactEmail", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>

					<FormField label="Phone">
						<input
							type="tel"
							value={formData.primaryContactPhone ?? ""}
							onChange={(e) => updateField("primaryContactPhone", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>
				</div>
			</div>

			<div>
				<h3 className="font-medium text-[var(--foreground)] mb-4">Contracts/BD Contact</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<FormField label="Name">
						<input
							type="text"
							value={formData.contractsContactName ?? ""}
							onChange={(e) => updateField("contractsContactName", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>

					<FormField label="Email">
						<input
							type="email"
							value={formData.contractsContactEmail ?? ""}
							onChange={(e) => updateField("contractsContactEmail", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>

					<FormField label="Phone">
						<input
							type="tel"
							value={formData.contractsContactPhone ?? ""}
							onChange={(e) => updateField("contractsContactPhone", e.target.value)}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
						/>
					</FormField>
				</div>
			</div>
		</div>
	);
}

function CapabilitiesTab({ formData, updateField }: TabProps) {
	return (
		<div className="space-y-6">
			<FormField label="Core Capabilities">
				<p className="text-sm text-[var(--foreground-muted)] mb-2">
					Key services and capabilities your company offers
				</p>
				<TagInput
					value={formData.coreCapabilities ?? []}
					onChange={(tags) => updateField("coreCapabilities", tags)}
					placeholder="Add capability and press Enter"
				/>
			</FormField>

			<FormField label="Key Differentiators">
				<p className="text-sm text-[var(--foreground-muted)] mb-2">
					What sets your company apart from competitors
				</p>
				<TagInput
					value={formData.differentiators ?? []}
					onChange={(tags) => updateField("differentiators", tags)}
					placeholder="Add differentiator and press Enter"
				/>
			</FormField>

			<FormField label="Industry Description">
				<textarea
					value={formData.industryDescription ?? ""}
					onChange={(e) => updateField("industryDescription", e.target.value)}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] min-h-[100px]"
					placeholder="Brief description of your industry focus and expertise..."
				/>
			</FormField>

			<FormField label="Past Performance Summary">
				<p className="text-sm text-[var(--foreground-muted)] mb-2">
					Summary of relevant past performance for proposals
				</p>
				<textarea
					value={formData.pastPerformanceSummary ?? ""}
					onChange={(e) => updateField("pastPerformanceSummary", e.target.value)}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] min-h-[150px]"
					placeholder="Describe your company's relevant past performance..."
				/>
			</FormField>

			<FormField label="Company Boilerplate">
				<p className="text-sm text-[var(--foreground-muted)] mb-2">
					Standard company description text for proposals
				</p>
				<textarea
					value={formData.companyBoilerplate ?? ""}
					onChange={(e) => updateField("companyBoilerplate", e.target.value)}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] min-h-[200px]"
					placeholder="Standard 'About Us' text that can be inserted into proposals..."
				/>
			</FormField>
		</div>
	);
}

function BrandingTab({ formData, updateField }: TabProps) {
	return (
		<div className="space-y-6">
			<FormField label="Logo URL">
				<input
					type="url"
					value={formData.logoUrl ?? ""}
					onChange={(e) => updateField("logoUrl", e.target.value)}
					className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
					placeholder="https://example.com/logo.png"
				/>
				{formData.logoUrl && (
					<div className="mt-2 p-4 bg-[var(--background-muted)] rounded-lg">
						<img
							src={formData.logoUrl}
							alt="Company logo preview"
							className="max-h-16 object-contain"
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = "none";
							}}
						/>
					</div>
				)}
			</FormField>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Primary Brand Color">
					<div className="flex gap-2">
						<input
							type="color"
							value={formData.primaryColor ?? "#2563eb"}
							onChange={(e) => updateField("primaryColor", e.target.value)}
							className="w-12 h-10 rounded border border-[var(--border)] cursor-pointer"
						/>
						<input
							type="text"
							value={formData.primaryColor ?? "#2563eb"}
							onChange={(e) => updateField("primaryColor", e.target.value)}
							className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							placeholder="#2563eb"
						/>
					</div>
				</FormField>

				<FormField label="Secondary Brand Color">
					<div className="flex gap-2">
						<input
							type="color"
							value={formData.secondaryColor ?? "#64748b"}
							onChange={(e) => updateField("secondaryColor", e.target.value)}
							className="w-12 h-10 rounded border border-[var(--border)] cursor-pointer"
						/>
						<input
							type="text"
							value={formData.secondaryColor ?? "#64748b"}
							onChange={(e) => updateField("secondaryColor", e.target.value)}
							className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
							placeholder="#64748b"
						/>
					</div>
				</FormField>
			</div>

			<div className="p-4 bg-[var(--background-muted)] rounded-lg">
				<h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Preview</h4>
				<div className="flex gap-4 items-center">
					<div
						className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-sm font-bold"
						style={{ backgroundColor: formData.primaryColor ?? "#2563eb" }}
					>
						Primary
					</div>
					<div
						className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-sm font-bold"
						style={{ backgroundColor: formData.secondaryColor ?? "#64748b" }}
					>
						Secondary
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Form Components
// ============================================================================

function FormField({
	label,
	required,
	children,
}: {
	label: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
				{label}
				{required && <span className="text-red-500 ml-1">*</span>}
			</label>
			{children}
		</div>
	);
}

function TagInput({
	value,
	onChange,
	placeholder,
}: {
	value: string[];
	onChange: (tags: string[]) => void;
	placeholder: string;
}) {
	const [input, setInput] = useState("");

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && input.trim()) {
			e.preventDefault();
			if (!value.includes(input.trim())) {
				onChange([...value, input.trim()]);
			}
			setInput("");
		}
	};

	const removeTag = (tag: string) => {
		onChange(value.filter((t) => t !== tag));
	};

	return (
		<div>
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
				placeholder={placeholder}
			/>
			{value.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-2">
					{value.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
						>
							{tag}
							<button
								type="button"
								onClick={() => removeTag(tag)}
								className="hover:text-blue-600 dark:hover:text-blue-100"
							>
								×
							</button>
						</span>
					))}
				</div>
			)}
		</div>
	);
}

const CERTIFICATIONS: { value: SmallBusinessCertification; label: string }[] = [
	{ value: "8a", label: "8(a) Business Development" },
	{ value: "hubzone", label: "HUBZone" },
	{ value: "wosb", label: "Women-Owned Small Business (WOSB)" },
	{ value: "edwosb", label: "Economically Disadvantaged WOSB (EDWOSB)" },
	{ value: "sdvosb", label: "Service-Disabled Veteran-Owned (SDVOSB)" },
	{ value: "vosb", label: "Veteran-Owned Small Business (VOSB)" },
	{ value: "sdb", label: "Small Disadvantaged Business (SDB)" },
	{ value: "mbe", label: "Minority Business Enterprise (MBE)" },
	{ value: "wbe", label: "Women's Business Enterprise (WBE)" },
	{ value: "dbe", label: "Disadvantaged Business Enterprise (DBE)" },
	{ value: "other", label: "Other" },
];

function CertificationSelect({
	value,
	onChange,
}: {
	value: SmallBusinessCertification[];
	onChange: (certs: SmallBusinessCertification[]) => void;
}) {
	const toggleCert = (cert: SmallBusinessCertification) => {
		if (value.includes(cert)) {
			onChange(value.filter((c) => c !== cert));
		} else {
			onChange([...value, cert]);
		}
	};

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
			{CERTIFICATIONS.map((cert) => (
				<label
					key={cert.value}
					className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--background-muted)]"
				>
					<input
						type="checkbox"
						checked={value.includes(cert.value)}
						onChange={() => toggleCert(cert.value)}
						className="w-4 h-4 rounded border-[var(--border)]"
					/>
					<span className="text-sm text-[var(--foreground)]">{cert.label}</span>
				</label>
			))}
		</div>
	);
}
