"use client";

/**
 * Version History Dialog - Manage document versions.
 *
 * Features:
 * - View all versions
 * - Compare versions
 * - Restore previous version
 * - Save new version with description
 * - Export version
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
	History,
	RotateCcw,
	Copy,
	Download,
	Eye,
	Check,
	X,
	MoreHorizontal,
	Clock,
	User,
	MessageSquare,
	GitCompare,
	GitBranch,
} from "lucide-react";
import { formatDistanceToNow, formatDate } from "date-fns";
import type { DocumentVersion, DocumentContent } from "@/lib/types/document";
import { generateId } from "@/lib/utils";
import {
	getDocumentVersions,
	restoreDocumentVersion,
	saveDocumentVersion,
} from "@/lib/actions/documents-enhanced";

interface VersionHistoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentId: string;
	className?: string;
}

export function VersionHistoryDialog({
	open,
	onOpenChange,
	documentId,
	className,
}: VersionHistoryDialogProps) {
	const [versions, setVersions] = React.useState<DocumentVersion[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [selectedVersion, setSelectedVersion] = React.useState<DocumentVersion | null>(null);
	const [isCreatingVersion, setIsCreatingVersion] = React.useState(false);
	const [newDescription, setNewDescription] = React.useState("");
	const [compareMode, setCompareMode] = React.useState(false);
	const [compareVersions, setCompareVersions] = React.useState<string[]>([]);

	// Fetch document versions from server
	React.useEffect(() => {
		if (!open) return;

		async function loadVersions() {
			setIsLoading(true);
			try {
				const data = await getDocumentVersions(documentId);
				setVersions(data);
			} catch (error) {
				console.error("Failed to load document versions:", error);
				toast.error("Failed to load version history");
			} finally {
				setIsLoading(false);
			}
		}

		loadVersions();
	}, [open, documentId]);

	const handleCreateVersion = async () => {
		if (!newDescription.trim()) {
			toast.error("Please provide a description");
			return;
		}

		setIsLoading(true);
		try {
			const newVersion = await saveDocumentVersion(documentId, newDescription);
			toast.success("Version saved");
			setIsCreatingVersion(false);
			setNewDescription("");

			// Add the new version to the list
			setVersions([newVersion, ...versions]);
		} catch (error) {
			console.error("Failed to save version:", error);
			toast.error("Failed to save version");
		} finally {
			setIsLoading(false);
		}
	};

	const handleRestore = async (version: DocumentVersion) => {
		const confirmed = window.confirm(
			`Are you sure you want to restore version ${version.versionNumber}?\n\nThis will replace your current document content.`
		);

		if (!confirmed) return;

		setIsLoading(true);
		try {
			await restoreDocumentVersion(documentId, version.id);
			toast.success(`Restored version ${version.versionNumber}`);
			onOpenChange(false);
		} catch (error) {
			toast.error("Failed to restore version");
		} finally {
			setIsLoading(false);
		}
	};

	const handleExport = (version: DocumentVersion, format: "json" | "md") => {
		toast.success(`Exported version ${version.versionNumber} as ${format.toUpperCase()}`);
	};

	const toggleCompareVersion = (versionId: string) => {
		setCompareVersions((prev) => {
			if (prev.includes(versionId)) {
				return prev.filter((id) => id !== versionId);
			}
			if (prev.length >= 2) {
				return [prev[1], versionId];
			}
			return [...prev, versionId];
		});
	};

	const handleCompare = () => {
		if (compareVersions.length !== 2) return;
		setCompareMode(true);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"max-w-4xl h-[85vh] flex flex-col gap-0",
					className
				)}
			>
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-muted">
							<History className="h-5 w-5" />
						</div>
						<div>
							<DialogTitle className="text-lg">Version History</DialogTitle>
							<DialogDescription>
								View and manage document versions
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{/* Toolbar */}
				<div className="px-6 py-3 border-b flex items-center gap-2 flex-wrap">
					<Button
						onClick={() => setIsCreatingVersion(true)}
						disabled={isCreatingVersion || compareMode}
					>
						<GitBranch className="h-4 w-4 mr-2" />
						Save Version
					</Button>
					<Button
						variant="outline"
						onClick={() => setCompareMode(!compareMode)}
						disabled={isCreatingVersion}
						className={cn(compareMode && "bg-accent")}
					>
						<GitCompare className="h-4 w-4 mr-2" />
						Compare
					</Button>
					{compareMode && compareVersions.length === 2 && (
						<Button onClick={handleCompare}>
							<Eye className="h-4 w-4 mr-2" />
							View Diff
						</Button>
					)}
					{compareMode && (
						<Button
							variant="ghost"
							onClick={() => {
								setCompareMode(false);
								setCompareVersions([]);
							}}
						>
							Cancel
						</Button>
					)}
					<div className="flex-1" />
					<span className="text-sm text-muted-foreground">
						{versions.length} versions
					</span>
				</div>

				{/* Create new version form */}
				{isCreatingVersion && (
					<div className="px-6 py-4 border-b bg-muted/50">
						<h4 className="text-sm font-medium mb-3">Save New Version</h4>
						<Textarea
							value={newDescription}
							onChange={(e) => setNewDescription(e.target.value)}
							placeholder="Describe what changed..."
							className="mb-3"
						/>
						<div className="flex gap-2 justify-end">
							<Button
								variant="outline"
								onClick={() => {
									setIsCreatingVersion(false);
									setNewDescription("");
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleCreateVersion}
								disabled={!newDescription.trim() || isLoading}
							>
								<Check className="h-4 w-4 mr-2" />
								Save Version
							</Button>
						</div>
					</div>
				)}

				{/* Compare mode info */}
				{compareMode && (
					<div className="px-6 py-3 border-b bg-muted/50">
						<p className="text-sm text-muted-foreground">
							Select two versions to compare (↑)
						</p>
						{compareVersions.length > 0 && (
							<div className="flex gap-2 mt-2">
								{compareVersions.map((id) => (
									<Badge key={id} variant="secondary">
										v{versions.find((v) => v.id === id)?.versionNumber}
									</Badge>
								))}
							</div>
						)}
					</div>
				)}

				{/* Versions list */}
				<ScrollArea className="flex-1 px-6 py-4">
					{isLoading ? (
						<div className="space-y-4">
							{[1, 2, 3].map((i) => (
								<div key={i} className="h-20 bg-muted rounded animate-pulse" />
							))}
						</div>
					) : (
						<div className="space-y-3">
							{versions.map((version, index) => (
								<VersionCard
									key={version.id}
									version={version}
									isCurrent={index === 0}
									isSelected={compareVersions.includes(version.id)}
									compareMode={compareMode}
									onSelect={() => toggleCompareVersion(version.id)}
									onRestore={() => handleRestore(version)}
									onExport={(format) => handleExport(version, format)}
								/>
							))}
						</div>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

// ============================================================================
// Version Card Component
// ============================================================================

interface VersionCardProps {
	version: DocumentVersion;
	isCurrent: boolean;
	isSelected: boolean;
	compareMode: boolean;
	onSelect: () => void;
	onRestore: () => void;
	onExport: (format: "json" | "md") => void;
}

function VersionCard({
	version,
	isCurrent,
	isSelected,
	compareMode,
	onSelect,
	onRestore,
	onExport,
}: VersionCardProps) {
	const [showMenu, setShowMenu] = React.useState(false);

	return (
		<div
			className={cn(
				"relative p-4 rounded-lg border transition-all",
				isCurrent
					? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
					: "bg-card",
				isSelected && "ring-2 ring-primary"
			)}
		>
			<div className="flex items-start gap-4">
				{/* Selection checkbox in compare mode */}
				{compareMode && (
					<input
						type="checkbox"
						checked={isSelected}
						onChange={onSelect}
						className="mt-1"
					/>
				)}

				<div className="flex-1">
					<div className="flex items-center flex-wrap gap-2 mb-2">
						<Badge variant={isCurrent ? "default" : "outline"}>
							v{version.versionNumber}
						</Badge>
						{isCurrent && (
							<Badge variant="secondary">Current</Badge>
						)}
						<span className="text-sm text-muted-foreground flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatDistanceToNow(new Date(version.createdAt))} ago
						</span>
					</div>

					<p className="text-sm font-medium mb-1">
						{version.changeDescription || "No description"}
					</p>

					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						<span className="flex items-center gap-1">
							<User className="h-3 w-3" />
							{version.createdBy}
						</span>
						<span className="text-muted-foreground">
							{formatDate(new Date(version.createdAt), "PPp")}
						</span>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={onRestore}
								disabled={isCurrent || compareMode}
							>
								<RotateCcw className="h-4 w-4 mr-2" />
								Restore
							</Button>
						</TooltipTrigger>
						<TooltipContent>Restore this version</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onExport("json")}
								disabled={compareMode}
							>
								<Download className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Export as JSON</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</div>
	);
}
