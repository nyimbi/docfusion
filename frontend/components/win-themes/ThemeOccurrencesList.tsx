/**
 * ThemeOccurrencesList - Where Themes Appear
 *
 * Lists all occurrences of a theme throughout the document with
 * location details, strength indicators, and verification toggles.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	FileText,
	MapPin,
	RefreshCw,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronRight,
	Check,
	X,
	ExternalLink,
	Filter,
	Eye,
	EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type {
	ThemeOccurrence,
	ThemeStrength,
} from "@/lib/types/win-themes";
import {
	getThemeOccurrences,
	verifyOccurrence,
	scanForOccurrences,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeOccurrencesListProps {
	/** Theme ID to show occurrences for */
	themeId: string;
	/** Theme name for display */
	themeName?: string;
	/** Callback when navigating to an occurrence */
	onNavigate?: (occurrence: ThemeOccurrence) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STRENGTH_CONFIG: Record<
	ThemeStrength,
	{ label: string; color: string; bgColor: string }
> = {
	strong: {
		label: "Strong",
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	moderate: {
		label: "Moderate",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	weak: {
		label: "Weak",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
	missing: {
		label: "Missing",
		color: "text-gray-500",
		bgColor: "bg-gray-200 dark:bg-gray-700",
	},
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function OccurrencesSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-44" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="p-3 border rounded-lg space-y-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-16" />
						</div>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Occurrence Card Component
// =============================================================================

interface OccurrenceCardProps {
	occurrence: ThemeOccurrence;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onNavigate: () => void;
	onVerify: (verified: boolean, notes?: string) => void;
	isVerifying: boolean;
}

function OccurrenceCard({
	occurrence,
	isExpanded,
	onToggleExpand,
	onNavigate,
	onVerify,
	isVerifying,
}: OccurrenceCardProps) {
	const strengthConfig = STRENGTH_CONFIG[occurrence.strength];
	const [notes, setNotes] = useState(occurrence.notes || "");

	return (
		<div
			className={cn(
				"border rounded-lg transition-all",
				occurrence.isVerified
					? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10"
					: "border-border"
			)}
		>
			<Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
				<div className="p-3">
					<div className="flex items-start gap-3">
						{/* Verification checkbox */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="pt-1">
										<Checkbox
											checked={occurrence.isVerified}
											onCheckedChange={(checked) =>
												onVerify(checked as boolean, notes)
											}
											disabled={isVerifying}
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									{occurrence.isVerified ? "Unverify" : "Mark as verified"}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{/* Expand toggle */}
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
								{isExpanded ? (
									<ChevronDown className="h-4 w-4" />
								) : (
									<ChevronRight className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>

						<div className="flex-1 min-w-0">
							{/* Location info */}
							<div className="flex items-center gap-2 mb-1 flex-wrap">
								<Badge variant="outline" className="text-xs gap-1">
									<FileText className="h-3 w-3" />
									{occurrence.sectionName}
								</Badge>
								{occurrence.page && (
									<Badge variant="outline" className="text-xs gap-1">
										<MapPin className="h-3 w-3" />
										Page {occurrence.page}
									</Badge>
								)}
								<Badge
									variant="secondary"
									className={cn("text-xs", strengthConfig.bgColor, strengthConfig.color)}
								>
									{strengthConfig.label}
								</Badge>
								{occurrence.isVerified && (
									<Badge className="text-xs bg-green-600">
										<Check className="h-3 w-3 mr-1" />
										Verified
									</Badge>
								)}
							</div>

							{/* Text excerpt */}
							<button
								type="button"
								className="text-left text-sm line-clamp-2 cursor-pointer hover:text-primary"
								onClick={onNavigate}
							>
								{occurrence.text}
							</button>
						</div>

						{/* Navigate button */}
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							onClick={onNavigate}
						>
							<ExternalLink className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Expanded Content */}
				<CollapsibleContent>
					<div className="px-3 pb-3 space-y-3 border-t pt-3 ml-12">
						{/* Full text */}
						<div>
							<span className="text-xs font-medium text-muted-foreground">
								Full Text
							</span>
							<p className="text-sm mt-1 p-2 bg-muted/50 rounded">
								{occurrence.text}
							</p>
						</div>

						{/* Location details */}
						<div className="grid grid-cols-3 gap-4 text-sm">
							<div>
								<span className="text-xs text-muted-foreground">Section</span>
								<p className="font-medium">{occurrence.sectionName}</p>
							</div>
							{occurrence.page && (
								<div>
									<span className="text-xs text-muted-foreground">Page</span>
									<p className="font-medium">{occurrence.page}</p>
								</div>
							)}
							{occurrence.paragraphIndex !== undefined && (
								<div>
									<span className="text-xs text-muted-foreground">Paragraph</span>
									<p className="font-medium">{occurrence.paragraphIndex + 1}</p>
								</div>
							)}
						</div>

						{/* Notes */}
						<div>
							<span className="text-xs font-medium text-muted-foreground">
								Notes
							</span>
							<Textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Add notes about this occurrence..."
								rows={2}
								className="mt-1"
							 aria-label="Notes"/>
						</div>

						{/* Verification info */}
						{occurrence.isVerified && occurrence.verifiedBy && (
							<div className="text-xs text-muted-foreground">
								Verified by {occurrence.verifiedBy}
								{occurrence.verifiedAt && (
									<> on {new Date(occurrence.verifiedAt).toLocaleDateString()}</>
								)}
							</div>
						)}

						{/* Save notes button */}
						{notes !== (occurrence.notes || "") && (
							<Button
								size="sm"
								onClick={() => onVerify(occurrence.isVerified, notes)}
								disabled={isVerifying}
							>
								{isVerifying ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Check className="h-4 w-4 mr-2" />
								)}
								Save Notes
							</Button>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeOccurrencesList({
	themeId,
	themeName,
	onNavigate,
	className,
}: ThemeOccurrencesListProps) {
	// State
	const [occurrences, setOccurrences] = useState<ThemeOccurrence[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isScanning, setIsScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedOccurrences, setExpandedOccurrences] = useState<Set<string>>(
		new Set()
	);
	const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());

	// Filter state
	const [filterStrength, setFilterStrength] = useState<ThemeStrength | "all">("all");
	const [filterVerified, setFilterVerified] = useState<"all" | "verified" | "unverified">(
		"all"
	);
	const [searchQuery, setSearchQuery] = useState("");

	// Load occurrences
	useEffect(() => {
		async function loadOccurrences() {
			setIsLoading(true);
			setError(null);
			const result = await getThemeOccurrences(themeId);
			if (result.success && result.data) {
				setOccurrences(result.data);
			} else {
				setError(result.error || "Failed to load occurrences");
			}
			setIsLoading(false);
		}
		loadOccurrences();
	}, [themeId]);

	// Filter occurrences
	const filteredOccurrences = useMemo(() => {
		return occurrences.filter((occ) => {
			if (filterStrength !== "all" && occ.strength !== filterStrength) return false;
			if (filterVerified === "verified" && !occ.isVerified) return false;
			if (filterVerified === "unverified" && occ.isVerified) return false;
			if (
				searchQuery &&
				!occ.text.toLowerCase().includes(searchQuery.toLowerCase()) &&
				!occ.sectionName.toLowerCase().includes(searchQuery.toLowerCase())
			) {
				return false;
			}
			return true;
		});
	}, [occurrences, filterStrength, filterVerified, searchQuery]);

	// Group by section
	const groupedBySections = useMemo(() => {
		const groups = new Map<string, ThemeOccurrence[]>();
		filteredOccurrences.forEach((occ) => {
			const existing = groups.get(occ.sectionName) || [];
			groups.set(occ.sectionName, [...existing, occ]);
		});
		return groups;
	}, [filteredOccurrences]);

	// Stats
	const stats = useMemo(() => {
		return {
			total: occurrences.length,
			verified: occurrences.filter((o) => o.isVerified).length,
			strong: occurrences.filter((o) => o.strength === "strong").length,
			moderate: occurrences.filter((o) => o.strength === "moderate").length,
			weak: occurrences.filter((o) => o.strength === "weak").length,
		};
	}, [occurrences]);

	// Toggle occurrence expansion
	const toggleExpanded = useCallback((occurrenceId: string) => {
		setExpandedOccurrences((prev) => {
			const next = new Set(prev);
			if (next.has(occurrenceId)) {
				next.delete(occurrenceId);
			} else {
				next.add(occurrenceId);
			}
			return next;
		});
	}, []);

	// Handle verify/unverify
	const handleVerify = useCallback(
		async (occurrenceId: string, verified: boolean, notes?: string) => {
			setVerifyingIds((prev) => new Set(prev).add(occurrenceId));

			try {
				const result = await verifyOccurrence({
					occurrenceId,
					isVerified: verified,
					notes,
				});

				if (result.success && result.data) {
					setOccurrences((prev) =>
						prev.map((o) => (o.id === occurrenceId ? result.data! : o))
					);
				} else {
					setError(result.error || "Failed to update verification");
				}
			} catch (err) {
				setError(`An error occurred: ${err}`);
			} finally {
				setVerifyingIds((prev) => {
					const next = new Set(prev);
					next.delete(occurrenceId);
					return next;
				});
			}
		},
		[]
	);

	// Handle navigate
	const handleNavigate = useCallback(
		(occurrence: ThemeOccurrence) => {
			onNavigate?.(occurrence);
		},
		[onNavigate]
	);

	// Rescan for occurrences
	const handleRescan = useCallback(async () => {
		setIsScanning(true);
		setError(null);

		try {
			const scanResult = await scanForOccurrences(themeId, themeId);
			if (scanResult.success) {
				// Reload occurrences
				const result = await getThemeOccurrences(themeId);
				if (result.success && result.data) {
					setOccurrences(result.data);
				}
			} else {
				setError(scanResult.error || "Failed to scan");
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setIsScanning(false);
		}
	}, [themeId]);

	// Loading state
	if (isLoading) {
		return <OccurrencesSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<MapPin className="h-5 w-5" />
						{themeName ? `Occurrences: ${themeName}` : "Theme Occurrences"}
						<Badge variant="secondary">{stats.total}</Badge>
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRescan}
						disabled={isScanning}
					>
						{isScanning ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Scanning...
							</>
						) : (
							<>
								<RefreshCw className="h-4 w-4 mr-2" />
								Rescan
							</>
						)}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Stats */}
				<div className="grid grid-cols-5 gap-2 text-center">
					<div className="p-2 bg-muted/50 rounded">
						<div className="text-lg font-bold">{stats.total}</div>
						<div className="text-xs text-muted-foreground">Total</div>
					</div>
					<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
						<div className="text-lg font-bold text-green-600">{stats.strong}</div>
						<div className="text-xs text-muted-foreground">Strong</div>
					</div>
					<div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
						<div className="text-lg font-bold text-amber-600">{stats.moderate}</div>
						<div className="text-xs text-muted-foreground">Moderate</div>
					</div>
					<div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
						<div className="text-lg font-bold text-red-600">{stats.weak}</div>
						<div className="text-xs text-muted-foreground">Weak</div>
					</div>
					<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
						<div className="text-lg font-bold text-blue-600">{stats.verified}</div>
						<div className="text-xs text-muted-foreground">Verified</div>
					</div>
				</div>

				{/* Filters */}
				<div className="flex items-center gap-2 flex-wrap">
					<Filter className="h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search text or section..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-[200px]"
					/>
					<Select
						value={filterStrength}
						onValueChange={(v) => setFilterStrength(v as ThemeStrength | "all")}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Strength" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Strengths</SelectItem>
							<SelectItem value="strong">Strong</SelectItem>
							<SelectItem value="moderate">Moderate</SelectItem>
							<SelectItem value="weak">Weak</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={filterVerified}
						onValueChange={(v) =>
							setFilterVerified(v as "all" | "verified" | "unverified")
						}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Verified" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="verified">
								<div className="flex items-center gap-1">
									<Eye className="h-3 w-3" />
									Verified
								</div>
							</SelectItem>
							<SelectItem value="unverified">
								<div className="flex items-center gap-1">
									<EyeOff className="h-3 w-3" />
									Unverified
								</div>
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Empty State */}
				{occurrences.length === 0 && !error && (
					<div className="text-center py-8">
						<MapPin className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No occurrences found</h3>
						<p className="text-sm text-muted-foreground mt-1">
							This theme hasn't been detected in the document yet
						</p>
						<Button onClick={handleRescan} className="mt-4" disabled={isScanning}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Scan Document
						</Button>
					</div>
				)}

				{/* Occurrences by Section */}
				{filteredOccurrences.length > 0 && (
					<div className="space-y-4">
						{Array.from(groupedBySections.entries()).map(([sectionName, sectionOccurrences]) => (
							<Collapsible key={sectionName} defaultOpen>
								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										className="w-full justify-start text-left"
									>
										<ChevronDown className="h-4 w-4 mr-2" />
										<FileText className="h-4 w-4 mr-2" />
										<span className="flex-1">{sectionName}</span>
										<Badge variant="secondary">{sectionOccurrences.length}</Badge>
									</Button>
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-2 mt-2 ml-6">
									{sectionOccurrences.map((occurrence) => (
										<OccurrenceCard
											key={occurrence.id}
											occurrence={occurrence}
											isExpanded={expandedOccurrences.has(occurrence.id)}
											onToggleExpand={() => toggleExpanded(occurrence.id)}
											onNavigate={() => handleNavigate(occurrence)}
											onVerify={(verified, notes) =>
												handleVerify(occurrence.id, verified, notes)
											}
											isVerifying={verifyingIds.has(occurrence.id)}
										/>
									))}
								</CollapsibleContent>
							</Collapsible>
						))}
					</div>
				)}

				{/* No results with filters */}
				{occurrences.length > 0 && filteredOccurrences.length === 0 && (
					<div className="text-center py-8">
						<p className="text-sm text-muted-foreground">
							No occurrences match your filters
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default ThemeOccurrencesList;
