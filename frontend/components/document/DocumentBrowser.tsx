"use client";

/**
 * Document Browser Component
 *
 * Provides comprehensive document organization with:
 * - Smart views (Active Work, Urgent, By Opportunity, etc.)
 * - Folder/workspace navigation
 * - Multi-dimensional filtering (type, objective, project, client, tags)
 * - Grouping and sorting
 * - Clutter-reducing defaults
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Document organization
import {
  useDocumentBrowser,
  SMART_VIEWS,
  type DocumentMetadata,
  type DocumentType,
  type DocumentObjective,
  type DocumentFilters,
  type GroupByOption,
  type SortOption,
} from "@/lib/hdsi/document-organization";

// Icons
import {
  Search,
  Plus,
  FileText,
  Folder,
  Star,
  Archive,
  MoreVertical,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Clock,
  Calendar,
  Target,
  User,
  Building,
  Tag,
  Zap,
  AlertCircle,
  LayoutTemplate,
  Files,
  Trash2,
  Edit3,
  Copy,
  Download,
  Settings,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface DocumentBrowserProps {
  initialViewId?: string;
  onSelectDocument?: (docId: string) => void;
  onCreateDocument?: () => void;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentBrowser(props: DocumentBrowserProps) {
  const { initialViewId = "active", onSelectDocument, onCreateDocument, className } = props;
  const router = useRouter();

  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedDocs, setSelectedDocs] = React.useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = React.useState<GroupByOption | null>("folder");
  const [sortBy, setSortBy] = React.useState<SortOption>("updated-desc");

  // Initialize document browser hook with smart view
  const initialView = React.useMemo(() =>
    SMART_VIEWS.find(v => v.id === initialViewId) || SMART_VIEWS[0],
    [initialViewId]
  );

  const {
    documents,
    folders,
    organizedDocuments,
    activeView,
    setActiveView,
    customFilters,
    setCustomFilters,
    isLoading,
    toggleFavorite,
    archiveDocument,
    smartViews,
    filteredCount,
    totalCount,
  } = useDocumentBrowser({ initialView });

  // Apply search query to filters
  React.useEffect(() => {
    setCustomFilters(prev => ({ ...prev, searchQuery }));
  }, [searchQuery, setCustomFilters]);

  // Handle document selection
  const handleSelect = (docId: string) => {
    if (onSelectDocument) {
      onSelectDocument(docId);
    } else {
      router.push(`/hdsi?id=${docId}`);
    }
  };

  // Bulk actions
  const handleBulkArchive = () => {
    selectedDocs.forEach(id => archiveDocument(id));
    setSelectedDocs(new Set());
    toast.success(`Archived ${selectedDocs.size} documents`);
  };

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {/* Sidebar: Views & Folders */}
      <div className="w-64 border-r flex flex-col bg-muted/20">
        <div className="p-4">
          <Button
            className="w-full"
            onClick={onCreateDocument}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {/* Smart Views */}
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Smart Views
            </h3>
            <div className="space-y-1">
              {smartViews.map(view => (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    activeView.id === view.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ViewIcon name={view.icon} className="h-4 w-4" />
                  <span className="flex-1 text-left">{view.name}</span>
                  {view.id === "active" && (
                    <Badge variant={activeView.id === view.id ? "secondary" : "outline"} className="text-xs">
                      {filteredCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator className="my-2" />

          {/* Folders */}
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Folders
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Folder className="h-4 w-4" style={{ color: folder.color }} />
                  <span className="flex-1 text-left">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">{folder.documentCount}</span>
                </button>
              ))}
              {folders.length === 0 && (
                <div className="text-xs text-muted-foreground px-3 py-2">
                  No folders yet
                </div>
              )}
            </div>
          </div>

          <Separator className="my-2" />

          {/* Quick Tags */}
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Quick Filters
            </h3>
            <div className="flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => setCustomFilters(prev => ({ ...prev, isFavorite: true }))}
              >
                <Star className="h-3 w-3 mr-1" /> Favorites
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => setCustomFilters(prev => ({ ...prev, isPinned: true }))}
              >
                <Zap className="h-3 w-3 mr-1" /> Pinned
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => setCustomFilters(prev => ({ ...prev, priority: ["high", "urgent"] }))}
              >
                <AlertCircle className="h-3 w-3 mr-1" /> High Priority
              </Badge>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="border-b px-4 py-3 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents, tags, clients..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none rounded-l-md"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none rounded-r-md"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated-desc">Recently Updated</SelectItem>
              <SelectItem value="created-desc">Recently Created</SelectItem>
              <SelectItem value="title-asc">Title A-Z</SelectItem>
              <SelectItem value="due-date-asc">Due Date</SelectItem>
              <SelectItem value="priority-desc">Priority</SelectItem>
            </SelectContent>
          </Select>

          {/* Group By */}
          <Select value={groupBy || "none"} onValueChange={(v) => setGroupBy(v === "none" ? null : v as GroupByOption)}>
            <SelectTrigger className="w-36">
              <FolderOpen className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Group by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="folder">Folder</SelectItem>
              <SelectItem value="type">Type</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="due-date">Due Date</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Button */}
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Active Filters Display */}
        {(customFilters.types?.length || customFilters.objectives?.length ||
          customFilters.tags?.length || customFilters.clients?.length) && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {customFilters.types?.map(type => (
              <Badge key={type} variant="secondary" className="text-xs">
                Type: {type}
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={() => setCustomFilters(prev => ({
                    ...prev,
                    types: prev.types?.filter(t => t !== type)
                  }))}
                >
                  ×
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setCustomFilters({})}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Results Count */}
        <div className="px-4 py-2 border-b bg-background">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredCount}</span> of{" "}
            <span className="font-medium text-foreground">{totalCount}</span> documents
            {activeView.id !== "all" && (
              <span> in <span className="font-medium">{activeView.name}</span></span>
            )}
          </p>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : organizedDocuments.size === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Files className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No documents found</p>
              <p className="text-sm">Try adjusting your filters or create a new document</p>
              <Button className="mt-4" onClick={onCreateDocument}>
                <Plus className="h-4 w-4 mr-2" />
                Create Document
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {Array.from(organizedDocuments.entries()).map(([groupKey, docs]) => (
                <div key={groupKey}>
                  {groupBy && groupKey !== "All" && (
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      {groupKey}
                      <span className="text-xs font-normal">({docs.length})</span>
                    </h3>
                  )}

                  <div className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "space-y-2"
                  )}>
                    {docs.map(doc => (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        viewMode={viewMode}
                        isSelected={selectedDocs.has(doc.id)}
                        onSelect={() => handleSelect(doc.id)}
                        onToggleSelect={() => {
                          const next = new Set(selectedDocs);
                          if (next.has(doc.id)) next.delete(doc.id);
                          else next.add(doc.id);
                          setSelectedDocs(next);
                        }}
                        onToggleFavorite={() => toggleFavorite(doc.id)}
                        onArchive={() => archiveDocument(doc.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with bulk actions */}
        {selectedDocs.size > 0 && (
          <div className="border-t px-4 py-2 bg-muted/30 flex items-center justify-between">
            <span className="text-sm">
              {selectedDocs.size} document{selectedDocs.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDocs(new Set())}>
                Clear Selection
              </Button>
              <Button variant="danger" size="sm" onClick={handleBulkArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filters Sidebar (collapsible) */}
      {showFilters && (
        <div className="w-72 border-l bg-muted/20 flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            <Button variant="ghost" size="sm" onClick={() => setCustomFilters({})}>
              Reset
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            {/* Document Type */}
            <FilterSection title="Document Type">
              <div className="space-y-1">
                {DOCUMENT_TYPES.map(type => (
                  <label key={type.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFilters.types?.includes(type.value)}
                      onChange={(e) => {
                        const current = customFilters.types || [];
                        if (e.target.checked) {
                          setCustomFilters(prev => ({ ...prev, types: [...current, type.value] }));
                        } else {
                          setCustomFilters(prev => ({ ...prev, types: current.filter(t => t !== type.value) }));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1">{type.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* Objectives */}
            <FilterSection title="Objective">
              <div className="space-y-1">
                {OBJECTIVES.map(obj => (
                  <label key={obj.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFilters.objectives?.includes(obj.value)}
                      onChange={(e) => {
                        const current = customFilters.objectives || [];
                        if (e.target.checked) {
                          setCustomFilters(prev => ({ ...prev, objectives: [...current, obj.value] }));
                        } else {
                          setCustomFilters(prev => ({ ...prev, objectives: current.filter(o => o !== obj.value) }));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1">{obj.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* Status */}
            <FilterSection title="Status">
              <div className="space-y-1">
                {STATUSES.map(status => (
                  <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFilters.statuses?.includes(status)}
                      onChange={(e) => {
                        const current = customFilters.statuses || [];
                        if (e.target.checked) {
                          setCustomFilters(prev => ({ ...prev, statuses: [...current, status] }));
                        } else {
                          setCustomFilters(prev => ({ ...prev, statuses: current.filter(s => s !== status) }));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1 capitalize">{status.replace("-", " ")}</span>
                  </label>
                ))}
              </div>
            </FilterSection>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      {children}
    </div>
  );
}

function ViewIcon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    Zap: <Zap className={className} />,
    AlertCircle: <AlertCircle className={className} />,
    Target: <Target className={className} />,
    FileEdit: <FileText className={className} />,
    User: <User className={className} />,
    Star: <Star className={className} />,
    LayoutTemplate: <LayoutTemplate className={className} />,
    Archive: <Archive className={className} />,
    Files: <Files className={className} />,
  };
  return <>{icons[name] || <FileText className={className} />}</>;
}

interface DocumentCardProps {
  doc: DocumentMetadata;
  viewMode: "list" | "grid";
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onToggleFavorite: () => void;
  onArchive: () => void;
}

function DocumentCard(props: DocumentCardProps) {
  const { doc, viewMode, isSelected, onSelect, onToggleSelect, onToggleFavorite, onArchive } = props;

  const [showActions, setShowActions] = React.useState(false);

  if (viewMode === "grid") {
    return (
      <div
        onClick={onSelect}
        className={cn(
          "group p-4 rounded-lg border cursor-pointer transition-all",
          isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:shadow-sm"
        )}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-primary/10">
              <DocumentTypeIcon type={doc.type} className="h-5 w-5" />
            </div>
            {doc.isFavorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
                <Star className="h-4 w-4 mr-2" />
                {doc.isFavorite ? "Remove Favorite" : "Add Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                <Edit3 className="h-4 w-4 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }} className="text-destructive">
                <Archive className="h-4 w-4 mr-2" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h4 className="font-medium text-sm truncate mb-1">{doc.title}</h4>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{doc.type.replace("-", " ")}</span>
          <span>•</span>
          <span>{formatRelativeTime(doc.updatedAt)}</span>
        </div>

        {doc.completionPercentage > 0 && (
          <div className="mt-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${doc.completionPercentage}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground mt-1">{doc.completionPercentage}% complete</span>
          </div>
        )}

        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {doc.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                {tag}
              </Badge>
            ))}
            {doc.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{doc.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer transition-all",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/30"
      )}

		role="button"
		tabIndex={0}
		onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
      <input
        type="checkbox"
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleSelect}
        className="rounded border-gray-300"
      />

      <div className="p-2 rounded bg-primary/10">
        <DocumentTypeIcon type={doc.type} className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{doc.title}</h4>
          {doc.isFavorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
          {doc.isPinned && <Zap className="h-3 w-3 text-blue-500 fill-blue-500" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="capitalize">{doc.type.replace("-", " ")}</span>
          {doc.clientName && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                {doc.clientName}
              </span>
            </>
          )}
          {doc.dueDate && (
            <>
              <span>•</span>
              <span className={cn(
                "flex items-center gap-1",
                isOverdue(doc.dueDate) && "text-destructive"
              )}>
                <Calendar className="h-3 w-3" />
                {formatRelativeDate(doc.dueDate)}
              </span>
            </>
          )}
        </div>
      </div>

      {doc.completionPercentage > 0 && (
        <div className="w-24">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${doc.completionPercentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{doc.completionPercentage}%</span>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {formatRelativeTime(doc.updatedAt)}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
            <Star className="h-4 w-4 mr-2" />
            {doc.isFavorite ? "Remove Favorite" : "Add Favorite"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
            <Edit3 className="h-4 w-4 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
            <Copy className="h-4 w-4 mr-2" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }} className="text-destructive">
            <Archive className="h-4 w-4 mr-2" /> Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DocumentTypeIcon({ type, className }: { type: DocumentType; className?: string }) {
  const icons: Record<DocumentType, typeof FileText> = {
    proposal: FileText,
    sow: FileText,
    contract: FileText,
    compliance: FileText,
    technical: FileText,
    whitepaper: FileText,
    presentation: FileText,
    report: FileText,
    template: LayoutTemplate,
    draft: FileText,
  };
  const Icon = icons[type] || FileText;
  return <Icon className={className} />;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days <= 7) return `${days} days`;
  return target.toLocaleDateString();
}

function isOverdue(date: Date): boolean {
  return new Date(date) < new Date() && !isToday(date);
}

function isToday(date: Date): boolean {
  const d = new Date(date);
  const now = new Date();
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

// Constants for filters
const DOCUMENT_TYPES = [
  { value: "proposal", label: "Proposal" },
  { value: "sow", label: "Statement of Work" },
  { value: "contract", label: "Contract" },
  { value: "compliance", label: "Compliance" },
  { value: "technical", label: "Technical Spec" },
  { value: "whitepaper", label: "Whitepaper" },
  { value: "presentation", label: "Presentation" },
  { value: "report", label: "Report" },
  { value: "template", label: "Template" },
] as const;

const OBJECTIVES = [
  { value: "win-bid", label: "Win Bid" },
  { value: "compliance-only", label: "Compliance Only" },
  { value: "relationship", label: "Build Relationship" },
  { value: "incumbent", label: "Retain Work" },
  { value: "strategic", label: "Strategic Position" },
] as const;

const STATUSES = ["draft", "in-review", "approved", "submitted", "won", "lost", "archived"] as const;
