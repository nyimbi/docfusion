/**
 * Template Detail Page (Stub) - DocFusion
 */

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, LayoutTemplate } from "lucide-react";

export default function TemplateDetailPage() {
	return (
		<div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
			<div className="text-center">
				<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--background-muted)] flex items-center justify-center">
					<LayoutTemplate className="h-10 w-10 text-[var(--foreground-subtle)]" />
				</div>
				<h2 className="heading-display text-2xl text-[var(--foreground)] mb-3">
					Template Preview
				</h2>
				<p className="text-[var(--foreground-muted)] max-w-sm mx-auto mb-8">
					Template details coming soon. This feature is under development.
				</p>
				<Link href="/templates">
					<Button variant="secondary">
						<ArrowLeft className="h-4 w-4" />
						Back to Templates
					</Button>
				</Link>
			</div>
		</div>
	);
}
