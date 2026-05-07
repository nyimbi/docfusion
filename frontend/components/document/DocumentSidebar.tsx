"use client";

import Image from "next/image";

/**
 * Document Sidebar - Right sidebar with document info and metadata.
 *
 * Features:
 * - Document metadata (title, status, created, modified)
 * - Version history
 * - Active collaborators
 * - Comments thread
 * - Review status
 * - AI suggestions
 * - Related documents
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
	FileText,
	History,
	Users,
	MessageSquare,
	Sparkles,
	Folder,
	Clock,
	User,
	Tag,
	Share2,
	Download,
	CheckCircle2,
	Circle,
	Clock4,
	AlertCircle,
	RefreshCcw,
	Check,
	MoreHorizontal,
	Search,
	Type as TypeIcon,
} from "lucide-react";
import type { Document, DocumentVersion, DocumentSummary } from "@/lib/types/document";
import type { Collaborator } from "@/lib/stores/collaboration-store";
import { useCollaborationStore } from "@/lib/stores/collaboration-store";
import { useCommentStore, type Comment as StoreComment } from "@/lib/stores/comment-store";
import { formatDistanceToNow, formatDate } from "date-fns";
import { VersionHistoryDialog } from "./VersionHistoryDialog";
import { getDocumentVersions, saveDocumentVersion } from "@/lib/actions/documents-enhanced";

interface DocumentSidebarProps {
	document: Document;
	wordCount: number;
	characterCount: number;
	saveStatus: string;
	saveError?: string | null;
	className?: string;
}

export function DocumentSidebar({
	document,
	wordCount,
	characterCount,
	saveStatus,
	saveError,
	className,
}: DocumentSidebarProps) {
	const [activeTab, setActiveTab] = React.useState("info");
	const [isVersionDialogOpen, setIsVersionDialogOpen] = React.useState(false);

	const collaborators = useCollaborationStore((s) => s.collaborators);
	const userPresence = useCollaborationStore((s) => s.userPresence);
	const comments = useCommentStore((s) => s.comments);
	const activeCommentCount = comments.filter((c) => !c.resolved).length;

	// Status badge configuration
	const statusConfig = {
		draft: { label: "Draft", icon: Circle, color: "bg-gray-500" },
		in_review: { label: "In Review", icon: Clock4, color: "bg-yellow-500" },
		approved: { label: "Approved", icon: CheckCircle2, color: "bg-green-500" },
		archived: { label: "Archived", icon: Folder, color: "bg-gray-400" },
	};

	const currentStatus = statusConfig[document.status];
	const StatusIcon = currentStatus.icon;

	return (
		<div
			className={cn(
				"flex flex-col h-full bg-[var(--background)]",
				className
			)}
		>
			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="flex-1 flex flex-col"
			>
				<TabsList className="mx-4 mt-4 mb-2 w-fit">
					<TabsTrigger value="info" className="gap-1">
						<Info className="h-4 w-4" />
						<span className="hidden sm:inline">Info</span>
					</TabsTrigger>
					<TabsTrigger value="versions" className="gap-1">
						<History className="h-4 w-4" />
						<span className="hidden sm:inline">Versions</span>
					</TabsTrigger>
					<TabsTrigger value="collaborators" className="gap-1">
						<Users className="h-4 w-4" />
						<span className="hidden sm:inline">Team</span>
					</TabsTrigger>
					<TabsTrigger value="comments" className="gap-1">
						<MessageSquare className="h-4 w-4" />
						{activeCommentCount > 0 && (
							<Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
								{activeCommentCount}
							</Badge>
						)}
					</TabsTrigger>
				</TabsList>

				<Separator />

				<ScrollArea className="flex-1">
					{/* Document Info Tab */}
					<TabsContent value="info" className="m-0">
						<DocumentInfoPanel
							document={document}
							wordCount={wordCount}
							characterCount={characterCount}
							currentStatus={currentStatus}
							StatusIcon={StatusIcon}
						/>
					</TabsContent>

					{/* Versions Tab */}
					<TabsContent value="versions" className="m-0">
						<VersionsPanel
							documentId={document.id}
							currentVersion={document.currentVersion}
							isDialogOpen={isVersionDialogOpen}
							setIsDialogOpen={setIsVersionDialogOpen}
						/>
					</TabsContent>

					{/* Collaborators Tab */}
					<TabsContent value="collaborators" className="m-0">
						<CollaboratorsPanel
							collaborators={collaborators}
							userPresence={userPresence}
							documentOwnerId={document.ownerId}
						/>
					</TabsContent>

					{/* Comments Tab */}
					<TabsContent value="comments" className="m-0">
						<CommentsPanel documentId={document.id} comments={comments} />
					</TabsContent>
				</ScrollArea>
			</Tabs>

			{/* Footer */}
			<div className="border-t p-4 space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Status</span>
					<Badge variant="outline" className="gap-1">
						<StatusIcon className="h-3 w-3" />
						{currentStatus.label}
					</Badge>
				</div>
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Save</span>
					<SaveStatus status={saveStatus} error={saveError} />
				</div>
			</div>

			{/* Version History Dialog */}
			<VersionHistoryDialog
				open={isVersionDialogOpen}
				onOpenChange={setIsVersionDialogOpen}
				documentId={document.id}
			/>
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

interface DocumentInfoPanelProps {
	document: Document;
	wordCount: number;
	characterCount: number;
	currentStatus: { label: string; icon: typeof Circle; color: string };
	StatusIcon: typeof Circle;
}

function DocumentInfoPanel({
	document,
	wordCount,
	characterCount,
	currentStatus,
	StatusIcon,
}: DocumentInfoPanelProps) {
	return (
		<div className="p-4 space-y-6">
			{/* Metadata */}
			<section className="space-y-3">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Document Details
				</h3>

				<div className="space-y-2">
					<InfoRow
						icon={FileText}
						label="Title"
						value={document.title}
					/>
					<InfoRow
						icon={User}
						label="Author"
						value={document.ownerId}
					/>
					<InfoRow
						icon={Clock}
						label="Created"
						value={formatDistanceToNow(new Date(document.createdAt)) + " ago"}
						tooltip={formatDate(new Date(document.createdAt), "PPp")}
					/>
					<InfoRow
						icon={RefreshCcw}
						label="Modified"
						value={formatDistanceToNow(new Date(document.updatedAt)) + " ago"}
						tooltip={formatDate(new Date(document.updatedAt), "PPp")}
					/>
					<InfoRow
						icon={Tag}
						label="Tags"
						value={document.tags.length > 0 ? document.tags.join(", ") : "None"}
					/>
				</div>
			</section>

			<Separator />

			{/* Statistics */}
			<section className="space-y-3">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Statistics
				</h3>

				<div className="grid grid-cols-2 gap-3">
					<StatCard
						label="Words"
						value={wordCount.toLocaleString()}
						icon={FileText}
					/>
					<StatCard
						label="Characters"
						value={characterCount.toLocaleString()}
						icon={Type}
					/>
					<StatCard
						label="Version"
						value={String(document.currentVersion)}
						icon={History}
					/>
					<StatCard
						label="Visibility"
						value={document.visibility}
						icon={Share2}
					/>
				</div>
			</section>

			{/* Metadata section */}
			{document.metadata && Object.keys(document.metadata).length > 0 && (
				<>
					<Separator />
					<section className="space-y-3">
						<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
							Metadata
						</h3>
						{document.metadata.rfpNumber && (
							<InfoRow
								icon={Folder}
								label="RFP Number"
								value={document.metadata.rfpNumber}
							/>
						)}
						{document.metadata.clientName && (
							<InfoRow
								icon={User}
								label="Client"
								value={document.metadata.clientName}
							/>
						)}
						{document.metadata.dueDate && (
							<InfoRow
								icon={Calendar}
								label="Due Date"
								value={formatDate(new Date(document.metadata.dueDate), "PP")}
							/>
						)}
					</section>
				</>
			)}
		</div>
	);
}

// ============================================================================
// Info Row Component
// ============================================================================

interface InfoRowProps {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	tooltip?: string;
}

function InfoRow({ icon: Icon, label, value, tooltip }: InfoRowProps) {
	return (
		<Tooltip>
			<div className="flex items-start gap-2 text-sm">
				<Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
				<div className="flex-1 min-w-0">
					<span className="text-muted-foreground block">{label}</span>
					<TooltipTrigger asChild>
						<span className="font-medium truncate block">{value}</span>
					</TooltipTrigger>
					{tooltip && <TooltipContent>{tooltip}</TooltipContent>}
				</div>
			</div>
		</Tooltip>
	);
}

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
	label: string;
	value: string;
	icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
	return (
		<div className="bg-muted/50 rounded-lg p-3 text-center">
			<Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
			<div className="text-lg font-semibold">{value}</div>
			<div className="text-xs text-muted-foreground">{label}</div>
		</div>
	);
}

// ============================================================================
// Versions Panel
// ============================================================================

interface VersionsPanelProps {
	documentId: string;
	currentVersion: number;
	isDialogOpen: boolean;
	setIsDialogOpen: (open: boolean) => void;
}

function VersionsPanel({
	documentId,
	currentVersion,
	isDialogOpen,
	setIsDialogOpen,
}: VersionsPanelProps) {
	const [versions, setVersions] = React.useState<DocumentVersion[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		async function loadVersions() {
			setIsLoading(true);
			try {
				const data = await getDocumentVersions(documentId);
				setVersions(data);
			} catch (error) {
				console.error("Failed to load versions:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadVersions();
	}, [documentId]);

	const handleRestore = (version: DocumentVersion) => {
		// Open the dialog for full version management
		setIsDialogOpen(true);
	};

	const handleSaveVersion = async () => {
		try {
			const newVersion = await saveDocumentVersion(documentId, "Quick save from sidebar");
			setVersions([newVersion, ...versions]);
			toast.success("New version saved");
		} catch (error) {
			console.error("Failed to save version:", error);
			toast.error("Failed to save version");
		}
	};

	return (
		<div className="p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Version History
				</h3>
				<Button variant="outline" size="sm" onClick={handleSaveVersion}>
					<Check className="h-4 w-4 mr-1" />
					Save Version
				</Button>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-16 bg-muted rounded animate-pulse"
						/>
					))}
				</div>
			) : (
				<div className="space-y-2">
					{versions.map((version) => (
						<div
							key={version.id}
							className={cn(
								"p-3 rounded-lg border cursor-pointer transition-colors",
								version.versionNumber === currentVersion
									? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
									: "hover:bg-muted/50"
							)}
							onClick={() => handleRestore(version)}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Badge variant="outline">v{version.versionNumber}</Badge>
									{version.versionNumber === currentVersion && (
										<Badge variant="secondary">Current</Badge>
									)}
								</div>
								<span className="text-xs text-muted-foreground">
									{formatDistanceToNow(new Date(version.createdAt))} ago
								</span>
							</div>
							{version.changeDescription && (
								<p className="text-sm mt-1 text-muted-foreground">
									{version.changeDescription}
								</p>
							)}
							<div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
								<User className="h-3 w-3" />
								<span>{version.createdBy}</span>
							</div>
						</div>
					))}
				</div>
			)}

			<Button
				variant="ghost"
				className="w-full"
				onClick={() => setIsDialogOpen(true)}
			>
				View Full History
			</Button>
		</div>
	);
}

// ============================================================================
// Collaborators Panel
// ============================================================================

interface CollaboratorsPanelProps {
	collaborators: Collaborator[];
	userPresence: unknown;
	documentOwnerId: string;
}

function CollaboratorsPanel({
	collaborators,
	userPresence,
	documentOwnerId,
}: CollaboratorsPanelProps) {
	const activeCollaborators = collaborators.filter((c) => c.status === "active");
	const idleCollaborators = collaborators.filter((c) => c.status === "idle");

	return (
		<div className="p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Team ({collaborators.length})
				</h3>
				<Button variant="outline" size="sm">
					<Share2 className="h-4 w-4 mr-1" />
					Invite
				</Button>
			</div>

			{/* Active users */}
			{activeCollaborators.length > 0 && (
				<section>
					<h4 className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
						<span className="w-2 h-2 rounded-full bg-green-500" />
						Active Now ({activeCollaborators.length})
					</h4>
					<div className="space-y-2">
						{activeCollaborators.map((collab) => (
							<CollaboratorCard
								key={collab.userId}
								collaborator={collab}
								isOwner={collab.userId === documentOwnerId}
							/>
						))}
					</div>
				</section>
			)}

			{/* Idle users */}
			{idleCollaborators.length > 0 && (
				<section>
					<h4 className="text-xs font-medium text-muted-foreground mb-2">
						Idle ({idleCollaborators.length})
					</h4>
					<div className="space-y-2">
						{idleCollaborators.map((collab) => (
							<CollaboratorCard
								key={collab.userId}
								collaborator={collab}
								isOwner={collab.userId === documentOwnerId}
							/>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

interface CollaboratorCardProps {
	collaborator: Collaborator;
	isOwner: boolean;
}

function CollaboratorCard({ collaborator, isOwner }: CollaboratorCardProps) {
	return (
		<div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
			<div className="relative">
				{collaborator.avatarUrl ? (
					<Image
						src={collaborator.avatarUrl}
						alt={collaborator.name}
						className="w-8 h-8 rounded-full object-cover"
						width={32}
						height={32}
						unoptimized
					/>
				) : (
					<div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
						{collaborator.name.charAt(0).toUpperCase()}
					</div>
				)}
				{collaborator.status === "active" && (
					<span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1">
					<span className="font-medium text-sm truncate">
						{collaborator.name}
					</span>
					{isOwner && (
						<Badge variant="outline" className="text-[10px] h-4 px-1">
							Owner
						</Badge>
					)}
				</div>
				<span className="text-xs text-muted-foreground block">
					{collaborator.status === "active"
						? "Editing now"
						: `Last seen ${formatDistanceToNow(collaborator.lastSeen)} ago`}
				</span>
			</div>
		</div>
	);
}

// ============================================================================
// Comments Panel
// ============================================================================

interface CommentsPanelProps {
	comments: StoreComment[];
	documentId: string;
}

function CommentsPanel({ comments, documentId }: CommentsPanelProps) {
	const unresolved = comments.filter((c) => !c.resolved);
	const resolved = comments.filter((c) => c.resolved);

	return (
		<div className="p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Comments
				</h3>
				<Button variant="outline" size="sm">
					<MessageSquare className="h-4 w-4 mr-1" />
					New Comment
				</Button>
			</div>

			{comments.length === 0 ? (
				<div className="text-center py-8 text-muted-foreground">
					<MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p>No comments yet</p>
					<p className="text-sm mt-1">Start the conversation!</p>
				</div>
			) : (
				<div className="space-y-4">
					{unresolved.length > 0 && (
						<section>
							<h4 className="text-xs font-medium text-muted-foreground mb-2">
								Open ({unresolved.length})
							</h4>
							<div className="space-y-2">
								{unresolved.map((comment) => (
									<CommentCard key={comment.id} comment={comment} />
								))}
							</div>
						</section>
					)}

					{resolved.length > 0 && (
						<section>
							<h4 className="text-xs font-medium text-muted-foreground mb-2">
								Resolved ({resolved.length})
							</h4>
							<div className="space-y-2">
								{resolved.map((comment) => (
									<CommentCard key={comment.id} comment={comment} />
								))}
							</div>
						</section>
					)}
				</div>
			)}
		</div>
	);
}

interface CommentCardProps {
	comment: StoreComment;
}

function CommentCard({ comment }: CommentCardProps) {
	return (
		<div
			className={cn(
				"p-3 rounded-lg border transition-colors cursor-pointer",
				comment.resolved
					? "bg-muted/30 border-muted-foreground/20 opacity-75"
					: "bg-card hover:bg-muted/50"
			)}
			onClick={() => {
				// Set this comment as active
				useCommentStore.getState().setActiveComment(comment.id);
				// If the comment has a block/section reference, select it
				if (comment.blockId) {
					useCommentStore.getState().setSelectedBlock(comment.blockId);
				} else if (comment.sectionId) {
					useCommentStore.getState().setSelectedBlock(comment.sectionId);
				}
			}}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
			<div className="flex items-start gap-2">
				<div className="w-6 h-6 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-xs font-medium">
					{comment.authorName.charAt(0).toUpperCase()}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">{comment.authorName}</span>
						<span className="text-xs text-muted-foreground">
							{formatDistanceToNow(new Date(comment.createdAt))} ago
						</span>
					</div>
					<p className="text-sm mt-1">{comment.content}</p>
				</div>
				{comment.resolved && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
			</div>
		</div>
	);
}

// ============================================================================
// Save Status Component
// ============================================================================

interface SaveStatusProps {
	status: string;
	error?: string | null;
}

function SaveStatus({ status, error }: SaveStatusProps) {
	if (error) {
		return (
			<div className="flex items-center gap-1 text-red-500">
				<AlertCircle className="h-3 w-3" />
				<span className="text-xs">Error</span>
			</div>
		);
	}

	const config = {
		idle: { icon: Check, color: "text-green-500", text: "Saved" },
		saving: { icon: RefreshCcw, color: "text-muted-foreground animate-spin", text: "Saving" },
		saved: { icon: Check, color: "text-green-500", text: "Saved" },
		error: { icon: AlertCircle, color: "text-red-500", text: "Error" },
	};

	const current = config[status as keyof typeof config] || config.idle;
	const Icon = current.icon;

	return (
		<div className={`flex items-center gap-1 ${current.color}`}>
			<Icon className="h-3 w-3" />
			<span className="text-xs">{current.text}</span>
		</div>
	);
}

// ============================================================================
// Icon Imports
// ============================================================================

const Info = Circle;
const Type = TypeIcon;
const Calendar = Clock;
