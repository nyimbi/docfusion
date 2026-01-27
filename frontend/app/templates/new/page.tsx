/**
 * Create Template Page (Stub) - DocFusion
 */

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Plus } from "lucide-react";

export default function CreateTemplatePage() {
	return (
		<div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
			<div className="text-center">
				<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--background-muted)] flex items-center justify-center">
					<Plus className="h-10 w-10 text-[var(--foreground-subtle)]" />
				</div>
				<h2 className="heading-display text-2xl text-[var(--foreground)] mb-3">
					Create Template
				</h2>
				<p className="text-[var(--foreground-muted)] max-w-sm mx-auto mb-8">
					Template creation coming soon. This feature is under development.
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
