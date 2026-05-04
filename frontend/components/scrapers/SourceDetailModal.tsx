/**
 * Source Detail Modal
 *
 * Full-featured modal for viewing and editing scraper source details.
 * Tabs: Overview | Run History | Configuration | Errors
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
	type ScraperSource,
	type ScraperRun,
	getSourceRuns,
	updateScraperSource,
} from "@/lib/actions/scraper-sources";
import {
	X,
	Globe,
	Clock,
	Activity,
	Settings,
	AlertTriangle,
	CheckCircle,
	XCircle,
	AlertCircle,
	ExternalLink,
	Loader2,
	Save,
	RefreshCw,
	Pause,
	Calendar,
	Timer,
	BarChart3,
	TrendingUp,
	Database,
	History,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

// ============================================================================
// Types
// ============================================================================

interface SourceDetailModalProps {
	source: ScraperSource;
	onClose: () => void;
	onUpdate?: () => void;
}

type TabId = "overview" | "history" | "config" | "errors";

interface Tab {
	id: TabId;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

// ============================================================================
// Constants
// ============================================================================

const TABS: Tab[] = [
	{ id: "overview", label: "Overview", icon: Activity },
	{ id: "history", label: "Run History", icon: History },
	{ id: "config", label: "Configuration", icon: Settings },
	{ id: "errors", label: "Errors", icon: AlertTriangle },
];

const HealthConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
	healthy: { label: "Healthy", icon: CheckCircle, color: "text-green-500" },
	degraded: { label: "Degraded", icon: AlertTriangle, color: "text-amber-500" },
	failing: { label: "Failing", icon: XCircle, color: "text-red-500" },
	unknown: { label: "Unknown", icon: AlertCircle, color: "text-muted-foreground" },
	disabled: { label: "Disabled", icon: Pause, color: "text-muted-foreground" },
};

const TierConfig: Record<number, { label: string; schedule: string }> = {
	1: { label: "Tier 1", schedule: "Every 6 hours" },
	2: { label: "Tier 2", schedule: "Every 12 hours" },
	3: { label: "Tier 3", schedule: "Daily" },
};

// ============================================================================
// Component
// ============================================================================

export function SourceDetailModal({ source, onClose, onUpdate }: SourceDetailModalProps) {
	const [activeTab, setActiveTab] = React.useState<TabId>("overview");
	const [runs, setRuns] = React.useState<ScraperRun[]>([]);
	const [isLoadingRuns, setIsLoadingRuns] = React.useState(false);
	const [isEditing, setIsEditing] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);

	// Editable fields
	const [editedUrl, setEditedUrl] = React.useState(source.url);
	const [editedRateLimit, setEditedRateLimit] = React.useState(source.rateLimit);
	const [editedTimeout, setEditedTimeout] = React.useState(source.timeout);
	const [editedMaxPages, setEditedMaxPages] = React.useState(source.maxPages);
	const [editedTier, setEditedTier] = React.useState(source.scheduleTier);
	const [editedPriority, setEditedPriority] = React.useState(source.priority);

	const loadRuns = React.useCallback(async () => {
		setIsLoadingRuns(true);
		try {
			const data = await getSourceRuns(source.id, { limit: 50 });
			setRuns(data);
		} catch (error) {
			console.error("Failed to load runs:", error);
		} finally {
			setIsLoadingRuns(false);
		}
	}, [source.id]);

	// Load run history when switching to history tab
	React.useEffect(() => {
		if (activeTab === "history" && runs.length === 0) {
			loadRuns();
		}
	}, [activeTab, loadRuns, runs.length]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await updateScraperSource(source.id, {
				url: editedUrl,
				rateLimit: editedRateLimit,
				timeout: editedTimeout,
				maxPages: editedMaxPages,
				scheduleTier: editedTier,
				priority: editedPriority,
			});
			setIsEditing(false);
			onUpdate?.();
		} catch (error) {
			console.error("Failed to save:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const healthInfo = HealthConfig[source.healthStatus] || HealthConfig.unknown;
	const HealthIcon = healthInfo.icon;
	const tierInfo = TierConfig[source.scheduleTier] || TierConfig[3];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}/>

			{/* Modal */}
			<div className="relative w-full max-w-4xl max-h-[90vh] bg-card rounded-2xl shadow-2xl border overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
					<div className="flex items-center gap-4">
						<div className="p-2 rounded-xl bg-primary/10">
							<Globe className="h-6 w-6 text-primary" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								{source.name}
							</h2>
							<p className="text-sm text-muted-foreground">
								{source.sourceId}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className={cn("inline-flex items-center gap-1 text-sm font-medium", healthInfo.color)}>
							<HealthIcon className="h-4 w-4" />
							{healthInfo.label}
						</span>
						<button
							onClick={onClose}
							className="p-2 rounded-lg hover:bg-muted transition-colors"
						>
							<X className="h-5 w-5 text-muted-foreground" />
						</button>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 px-6 pt-4 border-b">
					{TABS.map((tab) => {
						const Icon = tab.icon;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									"flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px",
									activeTab === tab.id
										? "bg-card border border-b-card text-foreground"
										: "text-muted-foreground hover:text-foreground"
								)}
							>
								<Icon className="h-4 w-4" />
								{tab.label}
							</button>
						);
					})}
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					{activeTab === "overview" && (
						<OverviewTab source={source} tierInfo={tierInfo} />
					)}
					{activeTab === "history" && (
						<HistoryTab
							runs={runs}
							isLoading={isLoadingRuns}
							onRefresh={loadRuns}
						/>
					)}
					{activeTab === "config" && (
						<ConfigTab
							source={source}
							isEditing={isEditing}
							isSaving={isSaving}
							editedUrl={editedUrl}
							editedRateLimit={editedRateLimit}
							editedTimeout={editedTimeout}
							editedMaxPages={editedMaxPages}
							editedTier={editedTier}
							editedPriority={editedPriority}
							setEditedUrl={setEditedUrl}
							setEditedRateLimit={setEditedRateLimit}
							setEditedTimeout={setEditedTimeout}
							setEditedMaxPages={setEditedMaxPages}
							setEditedTier={setEditedTier}
							setEditedPriority={setEditedPriority}
							onEdit={() => setIsEditing(true)}
							onCancel={() => {
								setIsEditing(false);
								setEditedUrl(source.url);
								setEditedRateLimit(source.rateLimit);
								setEditedTimeout(source.timeout);
								setEditedMaxPages(source.maxPages);
								setEditedTier(source.scheduleTier);
								setEditedPriority(source.priority);
							}}
							onSave={handleSave}
						/>
					)}
					{activeTab === "errors" && (
						<ErrorsTab source={source} runs={runs} />
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({
	source,
	tierInfo,
}: {
	source: ScraperSource;
	tierInfo: { label: string; schedule: string };
}) {
	const coverage = (source.coverage as string[]) || [];

	return (
		<div className="space-y-6">
			{/* Quick Stats */}
			<div className="grid grid-cols-4 gap-4">
				<StatCard
					label="Total RFPs"
					value={(source.totalOpportunitiesScraped || 0).toLocaleString()}
					icon={TrendingUp}
				/>
				<StatCard
					label="Success Rate"
					value={source.successRate !== null ? `${source.successRate.toFixed(0)}%` : "N/A"}
					icon={BarChart3}
				/>
				<StatCard
					label="Avg Duration"
					value={source.avgRunDurationSeconds !== null ? `${source.avgRunDurationSeconds.toFixed(0)}s` : "N/A"}
					icon={Timer}
				/>
				<StatCard
					label="Total Runs"
					value={((source.successfulRuns || 0) + (source.failedRuns || 0)).toLocaleString()}
					icon={Activity}
				/>
			</div>

			{/* Details Grid */}
			<div className="grid md:grid-cols-2 gap-6">
				{/* Source Info */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-foreground">Source Information</h3>
					<div className="space-y-3">
						<DetailRow label="Source ID" value={source.sourceId} />
						<DetailRow label="Type" value={source.sourceType} />
						<DetailRow
							label="URL"
							value={
								<a
									href={source.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline flex items-center gap-1"
								>
									{source.url.slice(0, 50)}...
									<ExternalLink className="h-3 w-3" />
								</a>
							}
						/>
						<DetailRow label="Language" value={source.language || "en"} />
						<DetailRow
							label="Coverage"
							value={coverage.length > 0 ? coverage.join(", ") : "Global"}
						/>
					</div>
				</div>

				{/* Schedule Info */}
				<div className="space-y-4">
					<h3 className="text-sm font-semibold text-foreground">Schedule & Status</h3>
					<div className="space-y-3">
						<DetailRow label="Schedule Tier" value={`${tierInfo.label} (${tierInfo.schedule})`} />
						<DetailRow
							label="Priority"
							value={source.priority === 1 ? "Critical" : source.priority === 2 ? "Important" : "Standard"}
						/>
						<DetailRow
							label="Last Run"
							value={source.lastRunAt ? new Date(source.lastRunAt).toLocaleString() : "Never"}
						/>
						<DetailRow
							label="Last Success"
							value={source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleString() : "Never"}
						/>
						<DetailRow
							label="Status"
							value={source.enabled ? "Enabled" : "Disabled"}
						/>
					</div>
				</div>
			</div>

			{/* Notes */}
			{source.notes && (
				<div className="space-y-2">
					<h3 className="text-sm font-semibold text-foreground">Notes</h3>
					<p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
						{source.notes}
					</p>
				</div>
			)}
		</div>
	);
}

function HistoryTab({
	runs,
	isLoading,
	onRefresh,
}: {
	runs: ScraperRun[];
	isLoading: boolean;
	onRefresh: () => void;
}) {
	const statusConfig: Record<string, { label: string; color: string }> = {
		pending: { label: "Pending", color: "bg-gray-500" },
		running: { label: "Running", color: "bg-blue-500" },
		success: { label: "Success", color: "bg-green-500" },
		partial: { label: "Partial", color: "bg-amber-500" },
		failed: { label: "Failed", color: "bg-red-500" },
		timeout: { label: "Timeout", color: "bg-orange-500" },
		cancelled: { label: "Cancelled", color: "bg-gray-500" },
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-foreground">Recent Runs</h3>
				<Button variant="ghost" size="sm" onClick={onRefresh} className="gap-2">
					<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
					Refresh
				</Button>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : runs.length === 0 ? (
				<div className="text-center py-12 text-muted-foreground">
					No run history available
				</div>
			) : (
				<div className="space-y-2">
					{runs.map((run) => {
						const status = statusConfig[run.status] || statusConfig.pending;
						return (
							<div
								key={run.id}
								className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
							>
								<div className="flex items-center gap-4">
									<div className={cn("w-2 h-2 rounded-full", status.color)} />
									<div>
										<p className="text-sm font-medium text-foreground">
											{new Date(run.startedAt).toLocaleString()}
										</p>
										<p className="text-xs text-muted-foreground">
											{run.runId}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-6 text-sm">
									<div className="text-right">
										<p className="font-medium text-foreground">
											{run.opportunitiesFound || 0} found
										</p>
										<p className="text-xs text-muted-foreground">
											{run.opportunitiesNew || 0} new
										</p>
									</div>
									<div className="text-right">
										<p className="font-medium text-foreground">
											{run.durationSeconds?.toFixed(1) || 0}s
										</p>
										<p className="text-xs text-muted-foreground">
											{run.pagesScraped || 0} pages
										</p>
									</div>
									<span className={cn(
										"px-2 py-1 text-xs font-medium rounded-full text-white",
										status.color
									)}>
										{status.label}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ConfigTab({
	source,
	isEditing,
	isSaving,
	editedUrl,
	editedRateLimit,
	editedTimeout,
	editedMaxPages,
	editedTier,
	editedPriority,
	setEditedUrl,
	setEditedRateLimit,
	setEditedTimeout,
	setEditedMaxPages,
	setEditedTier,
	setEditedPriority,
	onEdit,
	onCancel,
	onSave,
}: {
	source: ScraperSource;
	isEditing: boolean;
	isSaving: boolean;
	editedUrl: string;
	editedRateLimit: number;
	editedTimeout: number;
	editedMaxPages: number;
	editedTier: number;
	editedPriority: number;
	setEditedUrl: (v: string) => void;
	setEditedRateLimit: (v: number) => void;
	setEditedTimeout: (v: number) => void;
	setEditedMaxPages: (v: number) => void;
	setEditedTier: (v: number) => void;
	setEditedPriority: (v: number) => void;
	onEdit: () => void;
	onCancel: () => void;
	onSave: () => void;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-foreground">Scraper Configuration</h3>
				{isEditing ? (
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" onClick={onCancel}>
							Cancel
						</Button>
						<Button size="sm" onClick={onSave} disabled={isSaving} className="gap-2">
							{isSaving ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Save className="h-4 w-4" />
							)}
							Save
						</Button>
					</div>
				) : (
					<Button variant="outline" size="sm" onClick={onEdit}>
						Edit
					</Button>
				)}
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				{/* URL */}
				<div className="md:col-span-2 space-y-2">
					<span className="text-sm font-medium text-foreground">URL</span>
					{isEditing ? (
						<input
							type="url"
							value={editedUrl}
							onChange={(e) => setEditedUrl(e.target.value)}
							className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
						/>
					) : (
						<p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
							{source.url}
						</p>
					)}
				</div>

				{/* Rate Limit */}
				<div className="space-y-2">
					<span className="text-sm font-medium text-foreground">Rate Limit (req/s)</span>
					{isEditing ? (
						<input
							type="number"
							step="0.1"
							value={editedRateLimit}
							onChange={(e) => setEditedRateLimit(parseFloat(e.target.value))}
							className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
						/>
					) : (
						<p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
							{source.rateLimit}
						</p>
					)}
				</div>

				{/* Timeout */}
				<div className="space-y-2">
					<span className="text-sm font-medium text-foreground">Timeout (seconds)</span>
					{isEditing ? (
						<input
							type="number"
							value={editedTimeout}
							onChange={(e) => setEditedTimeout(parseInt(e.target.value))}
							className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
						/>
					) : (
						<p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
							{source.timeout}
						</p>
					)}
				</div>

				{/* Max Pages */}
				<div className="space-y-2">
					<span className="text-sm font-medium text-foreground">Max Pages</span>
					{isEditing ? (
						<input
							type="number"
							value={editedMaxPages}
							onChange={(e) => setEditedMaxPages(parseInt(e.target.value))}
							className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
						/>
					) : (
						<p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
							{source.maxPages}
						</p>
					)}
				</div>

				{/* Schedule Tier */}
				<div className="space-y-2">
					<span className="text-sm font-medium text-foreground">Schedule Tier</span>
					{isEditing ? (
						<select
							value={editedTier}
							onChange={(e) => setEditedTier(parseInt(e.target.value))}
							className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
						>
							<option value={1}>Tier 1 (Every 6 hours)</option>
							<option value={2}>Tier 2 (Every 12 hours)</option>
							<option value={3}>Tier 3 (Daily)</option>
						</select>
					) : (
						<p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
							Tier {source.scheduleTier}
						</p>
					)}
				</div>

				{/* Priority */}
				<div className="space-y-2">
					<span className="text-sm font-medium text-foreground">Priority</span>
					{isEditing ? (
						<select
							value={editedPriority}
							onChange={(e) => setEditedPriority(parseInt(e.target.value))}
							className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
						>
							<option value={1}>Critical (1)</option>
							<option value={2}>Important (2)</option>
							<option value={3}>Standard (3)</option>
						</select>
					) : (
						<p className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
							{source.priority === 1 ? "Critical" : source.priority === 2 ? "Important" : "Standard"}
						</p>
					)}
				</div>
			</div>

			{/* Flags */}
			<div className="space-y-4">
				<h4 className="text-sm font-medium text-foreground">Scraper Requirements</h4>
				<div className="grid grid-cols-3 gap-4">
					<FlagBadge label="JavaScript" enabled={source.requiresJavascript} />
					<FlagBadge label="Authentication" enabled={source.requiresAuth} />
					<FlagBadge label="Proxy" enabled={source.requiresProxy} />
				</div>
			</div>
		</div>
	);
}

function ErrorsTab({
	source,
	runs,
}: {
	source: ScraperSource;
	runs: ScraperRun[];
}) {
	const failedRuns = runs.filter(r => r.status === "failed" || r.status === "timeout");

	return (
		<div className="space-y-6">
			{/* Last Error */}
			{source.lastError && (
				<div className="space-y-2">
					<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
						<AlertTriangle className="h-4 w-4 text-red-500" />
						Last Error
					</h3>
					<div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
						<p className="text-sm text-red-400 font-mono whitespace-pre-wrap">
							{source.lastError}
						</p>
					</div>
				</div>
			)}

			{/* Failed Runs */}
			<div className="space-y-4">
				<h3 className="text-sm font-semibold text-foreground">Recent Failed Runs</h3>
				{failedRuns.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
						<p>No recent failures</p>
					</div>
				) : (
					<div className="space-y-2">
						{failedRuns.slice(0, 10).map((run) => (
							<div
								key={run.id}
								className="p-4 rounded-lg bg-muted/30 space-y-2"
							>
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium text-foreground">
										{new Date(run.startedAt).toLocaleString()}
									</span>
									<span className={cn(
										"px-2 py-0.5 text-xs font-medium rounded-full text-white",
										run.status === "timeout" ? "bg-orange-500" : "bg-red-500"
									)}>
										{run.status}
									</span>
								</div>
								{run.errorMessage && (
									<p className="text-sm text-red-400 font-mono bg-red-500/10 p-2 rounded">
										{run.errorMessage}
									</p>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{/* Health Tips */}
			{source.healthStatus === "failing" && (
				<div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
					<h4 className="text-sm font-medium text-amber-400 mb-2">Troubleshooting Tips</h4>
					<ul className="text-sm text-amber-300 space-y-1 list-disc list-inside">
						<li>Check if the source website is accessible</li>
						<li>Verify the URL hasn&apos;t changed</li>
						<li>Review rate limiting settings</li>
						<li>Check if authentication credentials are valid</li>
						<li>Try increasing timeout values</li>
					</ul>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Utility Components
// ============================================================================

function StatCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: React.ComponentType<{ className?: string }>;
}) {
	return (
		<div className="p-4 rounded-lg bg-muted/30">
			<div className="flex items-center gap-2 mb-1">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-xs text-muted-foreground">{label}</span>
			</div>
			<p className="text-lg font-semibold text-foreground">{value}</p>
		</div>
	);
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-sm text-muted-foreground whitespace-nowrap">{label}</span>
			<span className="text-sm text-foreground text-right">{value}</span>
		</div>
	);
}

function FlagBadge({
	label,
	enabled,
}: {
	label: string;
	enabled: boolean;
}) {
	return (
		<div className={cn(
			"px-3 py-2 rounded-lg text-sm font-medium text-center",
			enabled
				? "bg-primary/10 text-primary"
				: "bg-muted text-muted-foreground"
		)}>
			{label}: {enabled ? "Yes" : "No"}
		</div>
	);
}
