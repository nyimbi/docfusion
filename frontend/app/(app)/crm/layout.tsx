/**
 * CRM Module Layout
 *
 * Provides the layout wrapper for all CRM pages including
 * navigation and common context providers.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
	title: {
		template: "%s | CRM | DocFusion",
		default: "CRM | DocFusion",
	},
	description: "Customer Relationship Management - Manage accounts, contacts, deals, and activities",
};

export default function CRMLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="h-full flex flex-col">
			{children}
		</div>
	);
}
