/**
 * Import Data Page
 *
 * Server component wrapper for the universal data import wizard.
 * Provides page-level metadata and renders the client content.
 */

import { Suspense } from "react";
import ImportContent from "./import-content";
import { Loader2 } from "lucide-react";

export const metadata = {
	title: "Import Data | DocFusion",
	description: "Import data from Excel or CSV files into DocFusion",
};

/**
 * Loading fallback component
 */
function ImportLoading() {
	return (
		<div className="flex items-center justify-center h-full">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="h-8 w-8 text-primary animate-spin" />
				<p className="text-sm text-muted-foreground">Loading import wizard...</p>
			</div>
		</div>
	);
}

/**
 * Import page server component
 */
export default function ImportPage() {
	return (
		<Suspense fallback={<ImportLoading />}>
			<ImportContent />
		</Suspense>
	);
}
