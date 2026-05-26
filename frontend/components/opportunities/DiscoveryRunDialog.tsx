"use client";

import * as React from "react";
import { Save, Search, Trash2, X } from "lucide-react";
import { discoverAndImportOpportunities } from "@/lib/actions/import-opportunities";
import {
	createDiscoveryPreset,
	deleteDiscoveryPreset,
	listDiscoveryPresets,
	type DiscoveryPreset,
} from "@/lib/actions/saved-searches";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
	DiscoveryImportInput,
	DiscoveryRunWarning,
} from "@/lib/services/opportunity-discovery-import";

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
	warnings: DiscoveryRunWarning[];
	errors: Array<{
		rowIndex: number;
		error?: string;
		data?: { title?: string; rfpLink?: string };
	}>;
}

function parseQueries(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, Math.trunc(value)));
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
	const [presets, setPresets] = React.useState<DiscoveryPreset[]>([]);
	const [selectedPresetId, setSelectedPresetId] = React.useState("");
	const [presetName, setPresetName] = React.useState("");
	const [isLoadingPresets, setIsLoadingPresets] = React.useState(false);
	const [isSavingPreset, setIsSavingPreset] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [summary, setSummary] = React.useState<DiscoveryRunSummary | null>(null);

	const buildDiscoveryInput = React.useCallback((): DiscoveryImportInput => ({
		queries: parseQueries(queries),
		limitPerQuery: clampNumber(limitPerQuery, 1, 50),
		countryRegion: countryRegion.trim() || undefined,
		category: category.trim() || undefined,
		updateExisting: true,
		includeUnmatchedResults,
		scrapeTopResults,
		scrapeLimit: clampNumber(scrapeLimit, 0, 10),
		browserFallback,
		browserFallbackLimit: clampNumber(scrapeLimit, 0, 10),
	}), [
		browserFallback,
		category,
		countryRegion,
		includeUnmatchedResults,
		limitPerQuery,
		queries,
		scrapeLimit,
		scrapeTopResults,
	]);

	const loadPresets = React.useCallback(async () => {
		setIsLoadingPresets(true);
		try {
			setPresets(await listDiscoveryPresets());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load discovery presets.");
		} finally {
			setIsLoadingPresets(false);
		}
	}, []);

	React.useEffect(() => {
		if (open) {
			loadPresets();
		}
	}, [loadPresets, open]);

	const applyPreset = (preset: DiscoveryPreset) => {
		const input = preset.input;
		setSelectedPresetId(preset.id);
		setPresetName(preset.name);
		setQueries((input.queries ?? (input.query ? [input.query] : [])).join("\n"));
		setCountryRegion(input.countryRegion ?? "");
		setCategory(input.category ?? "External discovery");
		setLimitPerQuery(input.limitPerQuery ?? 10);
		setScrapeTopResults(input.scrapeTopResults ?? true);
		setScrapeLimit(input.scrapeLimit ?? 3);
		setBrowserFallback(input.browserFallback ?? true);
		setIncludeUnmatchedResults(input.includeUnmatchedResults ?? false);
		setSummary(null);
		setError(null);
	};

	const handlePresetSelect = (presetId: string) => {
		setSelectedPresetId(presetId);
		const preset = presets.find((item) => item.id === presetId);
		if (preset) applyPreset(preset);
	};

	const handleSavePreset = async () => {
		if (!presetName.trim()) {
			setError("Preset name is required.");
			return;
		}

		const input = buildDiscoveryInput();
		if ((input.queries ?? []).length === 0) {
			setError("At least one search query is required.");
			return;
		}

		setIsSavingPreset(true);
		setError(null);
		try {
			const preset = await createDiscoveryPreset({
				name: presetName.trim(),
				input,
			});
			setSelectedPresetId(preset.id);
			await loadPresets();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save discovery preset.");
		} finally {
			setIsSavingPreset(false);
		}
	};

	const handleDeletePreset = async () => {
		if (!selectedPresetId) return;

		setError(null);
		try {
			await deleteDiscoveryPreset(selectedPresetId);
			setPresets((items) => items.filter((item) => item.id !== selectedPresetId));
			setSelectedPresetId("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete discovery preset.");
		}
	};

	const handleRun = () => {
		const input = buildDiscoveryInput();
		if ((input.queries ?? []).length === 0) {
			setError("At least one search query is required.");
			return;
		}

		setError(null);
		setSummary(null);
		startTransition(async () => {
			try {
				const result = await discoverAndImportOpportunities(input);
				setSummary({
					importId: result.importId,
					total: result.results.total,
					imported: result.results.imported,
					updated: result.results.updated,
					skipped: result.results.skipped,
					failed: result.results.failed,
					warnings: result.warnings ?? [],
					errors: result.errors
						.filter((item) => item.status === "failed")
						.map((item) => ({
							rowIndex: item.rowIndex,
							error: item.error,
							data: {
								title: item.data?.title,
								rfpLink: item.data?.rfpLink,
							},
						})),
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
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
						<div className="space-y-2">
							<label className="text-sm font-medium text-foreground" htmlFor="discovery-preset">
								Preset
							</label>
							<select
								id="discovery-preset"
								value={selectedPresetId}
								onChange={(event) => handlePresetSelect(event.target.value)}
								disabled={isLoadingPresets}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="">{isLoadingPresets ? "Loading..." : "Select preset"}</option>
								{presets.map((preset) => (
									<option key={preset.id} value={preset.id}>
										{preset.name}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium text-foreground" htmlFor="discovery-preset-name">
								Name
							</label>
							<input
								id="discovery-preset-name"
								value={presetName}
								onChange={(event) => setPresetName(event.target.value)}
								placeholder="East Africa ICT"
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div className="flex items-end">
							<Button
								variant="outline"
								onClick={handleSavePreset}
								disabled={isSavingPreset || isRunning}
								isLoading={isSavingPreset}
								loadingText="Saving"
								className="h-10 w-full sm:w-auto"
							>
								<Save className="h-4 w-4" />
								Save
							</Button>
						</div>
						<div className="flex items-end">
							<Button
								variant="ghost"
								size="icon"
								onClick={handleDeletePreset}
								disabled={!selectedPresetId || isSavingPreset || isRunning}
								aria-label="Delete selected preset"
								className="h-10 w-10"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>

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
						<div
							className={cn(
								"space-y-2 rounded-md border px-3 py-2 text-sm",
								summary.failed > 0 || summary.warnings.length > 0
									? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
									: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
							)}
						>
							<p>
								{summary.imported} created, {summary.updated} updated, {summary.skipped} skipped, {summary.failed} failed from {summary.total} results.
							</p>
							{summary.warnings.length > 0 && (
								<div>
									<p className="font-medium">Discovery warnings ({summary.warnings.length})</p>
									<ul className="mt-1 list-disc space-y-1 pl-5">
										{summary.warnings.slice(0, 3).map((warning, index) => (
											<li key={`${warning.type}-${warning.url}-${index}`}>
												<span className="font-medium">{warning.title}:</span>{" "}
												{warning.message}
											</li>
										))}
									</ul>
								</div>
							)}
							{summary.errors.length > 0 && (
								<div>
									<p className="font-medium">Failed records ({summary.errors.length})</p>
									<ul className="mt-1 list-disc space-y-1 pl-5">
										{summary.errors.slice(0, 3).map((item) => (
											<li key={item.rowIndex}>
												<span className="font-medium">{item.data?.title ?? `Row ${item.rowIndex}`}:</span>{" "}
												{item.error ?? "Import failed"}
											</li>
										))}
									</ul>
								</div>
							)}
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
