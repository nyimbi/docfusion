/**
 * CreatePartnerDialog Component - DocFusion
 *
 * Dialog for creating a new partner.
 */

"use client";

import { useState, useTransition } from "react";
import type { Partner, PartnerType, CreatePartnerInput } from "@/lib/types/opportunity";
import { createPartner } from "@/lib/actions/partners";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface CreatePartnerDialogProps {
	onCreated?: (partner: Partner) => void;
	onClose: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function CreatePartnerDialog({
	onCreated,
	onClose,
}: CreatePartnerDialogProps) {
	const [name, setName] = useState("");
	const [type, setType] = useState<PartnerType | "">("");
	const [contactName, setContactName] = useState("");
	const [contactEmail, setContactEmail] = useState("");
	const [contactPhone, setContactPhone] = useState("");
	const [capabilities, setCapabilities] = useState<string[]>([]);
	const [capabilityInput, setCapabilityInput] = useState("");
	const [notes, setNotes] = useState("");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const addCapability = () => {
		const cap = capabilityInput.trim();
		if (cap && !capabilities.includes(cap)) {
			setCapabilities([...capabilities, cap]);
			setCapabilityInput("");
		}
	};

	const removeCapability = (cap: string) => {
		setCapabilities(capabilities.filter((c) => c !== cap));
	};

	const handleSubmit = () => {
		if (!name.trim()) {
			setError("Partner name is required");
			return;
		}

		setError(null);
		startTransition(async () => {
			try {
				const partner = await createPartner({
					name: name.trim(),
					type: type || undefined,
					contactName: contactName.trim() || undefined,
					contactEmail: contactEmail.trim() || undefined,
					contactPhone: contactPhone.trim() || undefined,
					capabilities,
					notes: notes.trim() || undefined,
				});
				onCreated?.(partner);
				onClose();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to create partner");
			}
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50" onClick={onClose} />

			{/* Dialog */}
			<div className="relative w-full max-w-lg max-h-[90vh] bg-[var(--background)] rounded-lg shadow-xl flex flex-col">
				{/* Header */}
				<div className="px-6 py-4 border-b border-[var(--border)]">
					<h2 className="text-lg font-semibold text-[var(--foreground)]">
						Add New Partner
					</h2>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-4">
					{/* Name */}
					<div>
						<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
							Partner Name <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Organization name"
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>

					{/* Type */}
					<div>
						<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
							Partner Type
						</label>
						<select
							value={type}
							onChange={(e) => setType(e.target.value as PartnerType | "")}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="">Select type...</option>
							<option value="prime">Prime Contractor</option>
							<option value="sub">Subcontractor</option>
							<option value="consultant">Consultant</option>
							<option value="vendor">Vendor</option>
							<option value="other">Other</option>
						</select>
					</div>

					{/* Contact Information */}
					<div className="space-y-4">
						<p className="text-sm font-medium text-[var(--foreground)]">
							Contact Information
						</p>

						<div>
							<label className="block text-xs text-[var(--foreground-muted)] mb-1">
								Contact Name
							</label>
							<input
								type="text"
								value={contactName}
								onChange={(e) => setContactName(e.target.value)}
								placeholder="Primary contact name"
								className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-xs text-[var(--foreground-muted)] mb-1">
									Email
								</label>
								<input
									type="email"
									value={contactEmail}
									onChange={(e) => setContactEmail(e.target.value)}
									placeholder="email@example.com"
									className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
							<div>
								<label className="block text-xs text-[var(--foreground-muted)] mb-1">
									Phone
								</label>
								<input
									type="tel"
									value={contactPhone}
									onChange={(e) => setContactPhone(e.target.value)}
									placeholder="+1 (555) 000-0000"
									className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>
					</div>

					{/* Capabilities */}
					<div>
						<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
							Capabilities
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								value={capabilityInput}
								onChange={(e) => setCapabilityInput(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCapability())}
								placeholder="Add a capability..."
								className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
							<Button type="button" variant="secondary" onClick={addCapability}>
								Add
							</Button>
						</div>
						{capabilities.length > 0 && (
							<div className="flex flex-wrap gap-1.5 mt-2">
								{capabilities.map((cap) => (
									<span
										key={cap}
										className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
									>
										{cap}
										<button
											type="button"
											onClick={() => removeCapability(cap)}
											className="hover:text-blue-900 dark:hover:text-blue-100"
										>
											<XIcon className="h-3 w-3" />
										</button>
									</span>
								))}
							</div>
						)}
					</div>

					{/* Notes */}
					<div>
						<label className="block text-sm font-medium text-[var(--foreground)] mb-1">
							Notes
						</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Additional notes about this partner..."
							rows={3}
							className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
						/>
					</div>

					{/* Error */}
					{error && (
						<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
							{error}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isPending}
						isLoading={isPending}
					>
						Create Partner
					</Button>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function XIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}
