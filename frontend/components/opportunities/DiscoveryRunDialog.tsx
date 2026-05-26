"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { discoverAndImportOpportunities } from "@/lib/actions/import-opportunities";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface DiscoveryRunDialogProps {
	open: boolean;
	onClose: () => void;
	onCompleted?: () => void;
}

interface DiscoveryRunSummary {
	importId: string;
	total: number;
	imported: number;
	updated: number;
	skipped: number;
	failed: number;
}

function parseQueries(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function DiscoveryRunDialog({
	open,
	onClose,
	onCompleted,
}: DiscoveryRunDialogProps) {
	const [queries, setQueries] = React.useState(
		[
			"software development RFP Africa",
			"ICT tender East Africa",
			"digital transformation request for proposals Kenya",
			"grant management system tender Africa",
		].join("\n")
	);
	const [countryRegion, setCountryRegion] = React.useState("");
	const [category, setCategory] = React.useState("External discovery");
	const [limitPerQuery, setLimitPerQuery] = React.useState(10);
	const [scrapeTopResults, setScrapeTopResults] = React.useState(true);
	const [scrapeLimit, setScrapeLimit] = React.useState(3);
	const [browserFallback, setBrowserFallback] = React.useState(true);
	const [includeUnmatchedResults, setIncludeUnmatchedResults] = React.useState(false);
	const [isRunning, startTransition] = React.useTransition();
	const [error, setError] = React.useState<string | null>(null);
	const [summary, setSummary] = React.useState<DiscoveryRunSummary | null>(null);

	const handleRun = () => {
		const queryList = parseQueries(queries);
		if (queryList.length === 0) {
			setError("At least one search query is required.");
			return;
		}

		setError(null);
		setSummary(null);
		startTransition(async () => {
			try {
				const result = await discoverAndImportOpportunities({
					queries: queryList,
					limitPerQuery,
					countryRegion: countryRegion.trim() || undefined,
					category: category.trim() || undefined,
					updateExisting: true,
					includeUnmatchedResults,
					scrapeTopResults,
					scrapeLimit,
					browserFallback,
					browserFallbackLimit: scrapeLimit,
				});
				setSummary({
					importId: result.importId,
					total: result.results.total,
					imported: result.results.imported,
					updated: result.results.updated,
					skipped: result.results.skipped,
					failed: result.results.failed,
				});
				onCompleted?.();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Discovery run failed.");
			}
		});
	};

	if (!open) return null;

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/50"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="discovery-run-title"
				className={cn(
					"fixed left-1/2 top-1/2 z-50 w-[min(92vw,680px)] -translate-x-1/2 -translate-y-1/2",
					"rounded-lg border border-border bg-background shadow-xl"
				)}
			>
				<div className="flex items-center justify-between border-b border-border px-5 py-4">
					<div>
						<h2 id="discovery-run-title" className="text-lg font-semibold text-foreground">
							Live Opportunity Discovery
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							SearXNG search with optional Firecrawl and browser enrichment.
						</p>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-4 px-5 py-4">
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground" htmlFor="discovery-queries">
							Queries
						</label>
						<textarea
							id="discovery-queries"
							value={queries}
							onChange={(event) => setQueries(event.target.value)}
							rows={5}
							className={cn(
								"w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
								"focus:outline-none focus:ring-2 focus:ring-ring"
							)}
						/>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div className="space-y-2">
							<label className="text-sm font-medium text-foreground" htmlFor="discovery-country">
								Region
							</label>
							<input
								id="discovery-country"
								value={countryRegion}
								onChange={(event) => setCountryRegion(event.target.value)}
								placeholder="East Africa"
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium text-foreground" htmlFor="discovery-category">
								Category
							</label>
							<input
								id="discovery-category"
								value={category}
								onChange={(event) => setCategory(event.target.value)}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium text-foreground" htmlFor="discovery-limit">
								Limit
							</label>
							<input
								id="discovery-limit"
								type="number"
								min={1}
								max={50}
								value={limitPerQuery}
								onChange={(event) => setLimitPerQuery(Number(event.target.value))}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
							<input
								type="checkbox"
								checked={scrapeTopResults}
								onChange={(event) => setScrapeTopResults(event.target.checked)}
							/>
							<span>Enrich top results</span>
						</label>
						<label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
							<input
								type="checkbox"
								checked={browserFallback}
								onChange={(event) => setBrowserFallback(event.target.checked)}
							/>
							<span>Browser fallback</span>
						</label>
						<label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
							<input
								type="checkbox"
								checked={includeUnmatchedResults}
								onChange={(event) => setIncludeUnmatchedResults(event.target.checked)}
							/>
							<span>Include broad matches</span>
						</label>
						<div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
							<label htmlFor="discovery-scrape-limit">Enrich</label>
							<input
								id="discovery-scrape-limit"
								type="number"
								min={0}
								max={10}
								value={scrapeLimit}
								onChange={(event) => setScrapeLimit(Number(event.target.value))}
								className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>

					{summary && (
						<div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
							{summary.imported} created, {summary.updated} updated, {summary.skipped} skipped, {summary.failed} failed from {summary.total} results.
						</div>
					)}
					{error && (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2 border-t border-border px-5 py-4">
					<Button variant="outline" onClick={onClose} disabled={isRunning}>
						Close
					</Button>
					<Button onClick={handleRun} disabled={isRunning} isLoading={isRunning} loadingText="Discovering">
						<Search className="h-4 w-4" />
						Run Discovery
					</Button>
				</div>
			</div>
		</>
	);
}
