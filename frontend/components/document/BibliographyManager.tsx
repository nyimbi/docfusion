"use client";

/**
 * Bibliography Manager - HDSI Publishing System
 *
 * A full bibliography management panel with:
 * - List of all entries with search/filter
 * - Add/Edit/Delete entries
 * - Import from BibTeX
 * - Export to BibTeX
 * - Citation style selector (APA, MLA, Chicago, IEEE, Vancouver)
 * - Preview of formatted bibliography
 * - Usage statistics
 *
 * Uses shadcn/ui components and follows the DocFusion "Ink & Paper" design system.
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Trash2,
  FileUp,
  FileDown,
  Quote,
  Filter,
  SortDesc,
  MoreHorizontal,
  Save,
  X,
  Check,
  Copy,
  Eye,
  BarChart3,
  Library,
  FileText,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  listBibliographyEntries,
  createBibliographyEntry,
  updateBibliographyEntry,
  deleteBibliographyEntry,
  importFromBibTeX,
  exportToBibTeX,
  type BibliographyEntry as DBBibliographyEntry,
  type CreateEntryInput,
} from "@/lib/actions/bibliography";

// ============================================================================
// Types
// ============================================================================

export type CitationStyle = "apa" | "mla" | "chicago" | "ieee" | "vancouver" | "harvard";

export type EntryType =
  | "article"
  | "book"
  | "booklet"
  | "conference"
  | "inbook"
  | "incollection"
  | "inproceedings"
  | "manual"
  | "mastersthesis"
  | "misc"
  | "phdthesis"
  | "proceedings"
  | "techreport"
  | "unpublished";

export interface BibliographyEntry {
  id: string;
  type: EntryType;
  citeKey: string;
  authors: string[];
  editors?: string[];
  title: string;
  journal?: string;
  booktitle?: string;
  publisher?: string;
  year: number;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  keywords?: string[];
  note?: string;
  // Citation tracking
  citationCount: number;
  lastCited?: Date;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface BibliographyStats {
  totalEntries: number;
  totalCitations: number;
  mostCitedEntry: BibliographyEntry | null;
  entriesByType: Record<EntryType, number>;
  entriesByYear: Record<number, number>;
  recentAdditions: BibliographyEntry[];
}

export interface BibliographyManagerProps {
  /** Initial bibliography entries */
  entries?: BibliographyEntry[];
  /** Currently selected citation style */
  currentStyle?: CitationStyle;
  /** Callback when entries change */
  onEntriesChange?: (entries: BibliographyEntry[]) => void;
  /** Callback when citation style changes */
  onStyleChange?: (style: CitationStyle) => void;
  /** Callback when entry is cited in document */
  onCiteEntry?: (entryId: string) => void;
  /** Callback to close the manager */
  onClose?: () => void;
  /** Whether the dialog is open */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Additional className */
  className?: string;
}

const citationStyleLabels: Record<CitationStyle, string> = {
  apa: "APA 7th Edition",
  mla: "MLA 9th Edition",
  chicago: "Chicago 17th Edition",
  ieee: "IEEE",
  vancouver: "Vancouver",
  harvard: "Harvard",
};

const entryTypeLabels: Record<EntryType, string> = {
  article: "Journal Article",
  book: "Book",
  booklet: "Booklet",
  conference: "Conference",
  inbook: "In Book",
  incollection: "In Collection",
  inproceedings: "In Proceedings",
  manual: "Manual",
  mastersthesis: "Master's Thesis",
  misc: "Miscellaneous",
  phdthesis: "PhD Thesis",
  proceedings: "Proceedings",
  techreport: "Technical Report",
  unpublished: "Unpublished",
};

const entryTypeIcons: Record<EntryType, React.ReactNode> = {
  article: <FileText className="h-4 w-4 text-blue-500" />,
  book: <BookOpen className="h-4 w-4 text-green-500" />,
  booklet: <FileText className="h-4 w-4 text-gray-500" />,
  conference: <ExternalLink className="h-4 w-4 text-purple-500" />,
  inbook: <BookOpen className="h-4 w-4 text-teal-500" />,
  incollection: <Library className="h-4 w-4 text-cyan-500" />,
  inproceedings: <ExternalLink className="h-4 w-4 text-indigo-500" />,
  manual: <FileText className="h-4 w-4 text-orange-500" />,
  mastersthesis: <BookOpen className="h-4 w-4 text-pink-500" />,
  misc: <MoreHorizontal className="h-4 w-4 text-gray-400" />,
  phdthesis: <BookOpen className="h-4 w-4 text-rose-500" />,
  proceedings: <ExternalLink className="h-4 w-4 text-violet-500" />,
  techreport: <FileText className="h-4 w-4 text-amber-500" />,
  unpublished: <FileText className="h-4 w-4 text-red-400" />,
};

// ============================================================================
// Main Component
// ============================================================================

export function BibliographyManager({
  entries: initialEntries,
  currentStyle = "apa",
  onEntriesChange,
  onStyleChange,
  onCiteEntry,
  open,
  onOpenChange,
  className,
}: BibliographyManagerProps) {
  const [entries, setEntries] = React.useState<BibliographyEntry[]>(initialEntries ?? []);
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterType, setFilterType] = React.useState<EntryType | "all">("all");
  const [sortBy, setSortBy] = React.useState<"citeKey" | "year" | "citations" | "title">("citeKey");
  const [activeTab, setActiveTab] = React.useState("entries");
  const [style, setStyle] = React.useState<CitationStyle>(currentStyle);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(!initialEntries);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch entries from database if no initial entries provided
  const fetchEntries = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listBibliographyEntries({
        search: searchQuery || undefined,
        type: filterType !== "all" ? filterType : undefined,
        sortBy: sortBy === "citations" ? "citations" : sortBy,
        sortOrder: "asc",
      });
      if (result.success && result.data) {
        // Convert DB entries to component entries
        const mappedEntries: BibliographyEntry[] = result.data.entries.map((e) => ({
          id: e.id,
          citeKey: e.citeKey,
          type: e.type,
          title: e.title,
          authors: e.authors,
          editors: e.editors,
          journal: e.journal,
          booktitle: e.booktitle,
          publisher: e.publisher,
          year: e.year,
          volume: e.volume,
          number: e.number,
          pages: e.pages,
          doi: e.doi,
          url: e.url,
          abstract: e.abstract,
          keywords: e.keywords,
          note: e.note,
          citationCount: e.citationCount,
          lastCited: e.lastCitedAt,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        }));
        setEntries(mappedEntries);
      } else {
        setError(result.error ?? "Failed to load entries");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterType, sortBy]);

  // Load entries on mount if not provided
  React.useEffect(() => {
    if (!initialEntries) {
      fetchEntries();
    }
  }, [initialEntries, fetchEntries]);


  // Calculate statistics
  const stats = React.useMemo((): BibliographyStats => {
    const byType: Record<string, number> = {};
    const byYear: Record<number, number> = {};
    let totalCitations = 0;
    let mostCited: BibliographyEntry | null = null;

    entries.forEach((entry) => {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byYear[entry.year] = (byYear[entry.year] || 0) + 1;
      totalCitations += entry.citationCount;
      if (!mostCited || entry.citationCount > mostCited.citationCount) {
        mostCited = entry;
      }
    });

    return {
      totalEntries: entries.length,
      totalCitations,
      mostCitedEntry: mostCited,
      entriesByType: byType as Record<EntryType, number>,
      entriesByYear: byYear,
      recentAdditions: [...entries]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    };
  }, [entries]);

  // Filter and sort entries
  const filteredEntries = React.useMemo(() => {
    let result = [...entries];

    // Filter
    if (filterType !== "all") {
      result = result.filter((e) => e.type === filterType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.citeKey.toLowerCase().includes(q) ||
          e.authors.some((a) => a.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "citeKey":
          return a.citeKey.localeCompare(b.citeKey);
        case "year":
          return b.year - a.year;
        case "citations":
          return b.citationCount - a.citationCount;
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [entries, searchQuery, filterType, sortBy]);

  const selectedEntry = React.useMemo(
    () => entries.find((e) => e.id === selectedEntryId) || null,
    [entries, selectedEntryId]
  );

  // Handlers
  const handleAddEntry = () => {
    setSelectedEntryId(null);
    setIsEditing(true);
  };

  const handleEditEntry = (entry: BibliographyEntry) => {
    setSelectedEntryId(entry.id);
    setIsEditing(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this entry?");
    if (!confirmed) return;

    const entry = entries.find((e) => e.id === entryId);
    if (entry && entry.citationCount > 0) {
      const force = window.confirm(
        `This entry has been cited ${entry.citationCount} time(s). Deleting it will break those citations. Continue?`
      );
      if (!force) return;
    }

    // Delete from database
    const result = await deleteBibliographyEntry(entryId);
    if (result.success) {
      const newEntries = entries.filter((e) => e.id !== entryId);
      setEntries(newEntries);
      onEntriesChange?.(newEntries);
      toast.success("Entry deleted");
    } else {
      toast.error(result.error ?? "Failed to delete entry");
    }
  };

  const handleSaveEntry = async (entry: BibliographyEntry) => {
    const isUpdate = entries.find((e) => e.id === entry.id);

    if (isUpdate) {
      // Update existing entry in database
      const result = await updateBibliographyEntry({
        id: entry.id,
        citeKey: entry.citeKey,
        entryType: entry.type,
        title: entry.title,
        authors: entry.authors,
        editors: entry.editors,
        journal: entry.journal,
        booktitle: entry.booktitle,
        publisher: entry.publisher,
        year: entry.year,
        volume: entry.volume,
        number: entry.number,
        pages: entry.pages,
        doi: entry.doi,
        url: entry.url,
        abstract: entry.abstract,
        keywords: entry.keywords,
        note: entry.note,
      });
      if (result.success) {
        const newEntries = entries.map((e) => (e.id === entry.id ? { ...entry, updatedAt: new Date() } : e));
        setEntries(newEntries);
        onEntriesChange?.(newEntries);
        toast.success("Entry updated");
      } else {
        toast.error(result.error ?? "Failed to update entry");
        return;
      }
    } else {
      // Create new entry in database
      const result = await createBibliographyEntry({
        citeKey: entry.citeKey,
        entryType: entry.type,
        title: entry.title,
        authors: entry.authors,
        editors: entry.editors,
        journal: entry.journal,
        booktitle: entry.booktitle,
        publisher: entry.publisher,
        year: entry.year,
        volume: entry.volume,
        number: entry.number,
        pages: entry.pages,
        doi: entry.doi,
        url: entry.url,
        abstract: entry.abstract,
        keywords: entry.keywords,
        note: entry.note,
      });
      if (result.success && result.data) {
        const newEntry: BibliographyEntry = {
          ...entry,
          id: result.data.id,
          createdAt: result.data.createdAt,
          updatedAt: result.data.updatedAt,
          citationCount: 0,
        };
        const newEntries = [...entries, newEntry];
        setEntries(newEntries);
        onEntriesChange?.(newEntries);
        toast.success("Entry added");
      } else {
        toast.error(result.error ?? "Failed to create entry");
        return;
      }
    }
    setIsEditing(false);
    setSelectedEntryId(entry.id);
  };

  const handleCiteEntry = (entryId: string) => {
    const newEntries = entries.map((e) =>
      e.id === entryId
        ? { ...e, citationCount: e.citationCount + 1, lastCited: new Date() }
        : e
    );
    setEntries(newEntries);
    onEntriesChange?.(newEntries);
    onCiteEntry?.(entryId);
    toast.success("Citation inserted");
  };

  const handleStyleChange = (newStyle: CitationStyle) => {
    setStyle(newStyle);
    onStyleChange?.(newStyle);
    toast.success(`Citation style changed to ${citationStyleLabels[newStyle]}`);
  };

  const handleExportBibTeX = async () => {
    const result = await exportToBibTeX();
    if (result.success && result.data) {
      // Download as file
      const blob = new Blob([result.data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bibliography.bib";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Bibliography exported successfully");
    } else {
      // Fallback to local export
      const bibtex = entriesToBibTeX(entries);
      copyToClipboard(bibtex, "Bibliography exported to clipboard (BibTeX format)");
    }
  };

  const handleExportFormatted = () => {
    const formatted = entries
      .map((e) => formatEntry(e, style))
      .filter(Boolean)
      .join("\n\n");
    copyToClipboard(formatted, "Formatted bibliography copied to clipboard");
  };

  const handleImportBibTeX = async (bibtex: string) => {
    try {
      // Try to import to database first
      const result = await importFromBibTeX(bibtex);
      if (result.success && result.data) {
        toast.success(`Imported ${result.data.imported} entries`);
        if (result.data.errors.length > 0) {
          toast.warning(`${result.data.errors.length} entries failed to import`);
        }
        // Refresh entries from database
        fetchEntries();
        setIsImportDialogOpen(false);
      } else {
        // Fallback to local parsing
        const imported = parseBibTeX(bibtex);
        const newEntries = [...entries, ...imported];
        setEntries(newEntries);
        onEntriesChange?.(newEntries);
        setIsImportDialogOpen(false);
        toast.success(`Imported ${imported.length} entries (local only)`);
      }
    } catch (error) {
      toast.error("Failed to parse BibTeX. Please check the format.");
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-w-5xl h-[85vh] p-0 flex flex-col", className)}>
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Library className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Bibliography Manager</DialogTitle>
                  <DialogDescription>
                    Manage references and citations ({entries.length} entries)
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Citation Style Selector */}
                <Select value={style} onValueChange={(v) => handleStyleChange(v as CitationStyle)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(citationStyleLabels) as CitationStyle[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {citationStyleLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b flex items-center justify-between">
              <TabsList className="bg-transparent p-0 h-12 gap-4">
                <TabsTrigger value="entries" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Entries
                </TabsTrigger>
                <TabsTrigger value="preview" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="stats" className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Statistics
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Import BibTeX
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportBibTeX}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button size="sm" onClick={handleAddEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            </div>

            {/* Entries Tab */}
            <TabsContent value="entries" className="flex-1 m-0 min-h-0">
              <div className="h-full flex flex-col">
                {/* Toolbar */}
                <div className="px-6 py-3 border-b flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, author, or cite key..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={filterType} onValueChange={(v) => setFilterType(v as EntryType | "all")}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {(Object.keys(entryTypeLabels) as EntryType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {entryTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-[150px]">
                      <SortDesc className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="citeKey">Cite Key</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="citations">Citations</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>{filteredEntries.length} of {entries.length}</span>
                  </div>
                </div>

                {/* Table */}
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Type</TableHead>
                        <TableHead>Citation Key</TableHead>
                        <TableHead>Authors</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[80px]">Year</TableHead>
                        <TableHead className="w-[100px]">Citations</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No entries found. Add one to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEntries.map((entry) => (
                          <TableRow
                            key={entry.id}
                            className={cn(
                              "cursor-pointer",
                              selectedEntryId === entry.id && "bg-accent"
                            )}
                            onClick={() => setSelectedEntryId(entry.id)}
                          >
                            <TableCell>{entryTypeIcons[entry.type]}</TableCell>
                            <TableCell className="font-mono text-sm">{entry.citeKey}</TableCell>
                            <TableCell className="text-sm">
                              {entry.authors.slice(0, 2).join(", ")}
                              {entry.authors.length > 2 && " et al."}
                            </TableCell>
                            <TableCell className="text-sm max-w-[300px] truncate" title={entry.title}>
                              {entry.title}
                            </TableCell>
                            <TableCell>{entry.year}</TableCell>
                            <TableCell>
                              <Badge variant={entry.citationCount > 0 ? "default" : "secondary"}>
                                <Quote className="h-3 w-3 mr-1" />
                                {entry.citationCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCiteEntry(entry.id);
                                      }}
                                    >
                                      <Quote className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cite this entry</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditEntry(entry);
                                      }}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEntry(entry.id);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="flex-1 m-0 min-h-0">
              <div className="h-full flex flex-col px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Formatted Bibliography</h3>
                  <Button variant="outline" size="sm" onClick={handleExportFormatted}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                </div>
                <ScrollArea className="flex-1 rounded-lg border bg-muted/30 p-6">
                  <div className="space-y-4">
                    {entries.map((entry, index) => (
                      <div key={entry.id} className="flex gap-4">
                        <span className="text-muted-foreground">[{index + 1}]</span>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">
                            {formatEntry(entry, style)}
                          </p>
                          {entry.doi && (
                            <a
                              href={`https://doi.org/${entry.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-1 inline-block"
                            >
                              DOI: {entry.doi}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="flex-1 m-0 min-h-0">
              <div className="h-full px-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <StatCard
                    title="Total Entries"
                    value={stats.totalEntries}
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Total Citations"
                    value={stats.totalCitations}
                    icon={<Quote className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Most Cited"
                    value={stats.mostCitedEntry?.citationCount || 0}
                    subtitle={stats.mostCitedEntry?.citeKey || "None"}
                    icon={<Sparkles className="h-5 w-5" />}
                  />
                </div>

                <Separator className="my-6" />

                <div className="grid grid-cols-2 gap-6">
                  {/* Entries by Type */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Entries by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(stats.entriesByType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              {entryTypeIcons[type as EntryType]}
                              {entryTypeLabels[type as EntryType]}
                            </span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Additions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Recent Additions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats.recentAdditions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No entries yet</p>
                        ) : (
                          stats.recentAdditions.slice(0, 5).map((entry) => (
                            <div
                              key={entry.id}
                              className="text-sm truncate cursor-pointer hover:text-primary"
                              onClick={() => {
                                setSelectedEntryId(entry.id);
                                setActiveTab("entries");
                              }}

														role="button"
														tabIndex={0}
														onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                              <span className="font-medium">{entry.citeKey}</span>
                              <span className="text-muted-foreground ml-2">{entry.title}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t">
            <div className="flex items-center gap-4 mr-auto text-xs text-muted-foreground">
              <span>Style: {citationStyleLabels[style]}</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{stats.totalCitations} total citations</span>
            </div>
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Entry Dialog */}
      <EntryEditDialog
        entry={isEditing ? selectedEntry : null}
        open={isEditing}
        onOpenChange={setIsEditing}
        onSave={handleSaveEntry}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleImportBibTeX}
      />
    </TooltipProvider>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-full text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Entry Edit Dialog
// ============================================================================

interface EntryEditDialogProps {
  entry: BibliographyEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: BibliographyEntry) => void;
}

function EntryEditDialog({ entry, open, onOpenChange, onSave }: EntryEditDialogProps) {
  const isNew = !entry;
  const [formData, setFormData] = React.useState<Partial<BibliographyEntry>>(
    entry || {
      type: "article",
      citeKey: "",
      title: "",
      authors: [],
      year: new Date().getFullYear(),
      citationCount: 0,
    }
  );

  React.useEffect(() => {
    setFormData(
      entry || {
        type: "article",
        citeKey: "",
        title: "",
        authors: [],
        year: new Date().getFullYear(),
        citationCount: 0,
      }
    );
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.citeKey || !formData.title || !formData.authors?.length) {
      toast.error("Please fill in required fields: Cite Key, Title, and Authors");
      return;
    }

    onSave({
      ...(entry || {
        id: `entry-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        citationCount: 0,
      }),
      ...formData,
      authors: formData.authors || [],
      year: formData.year || new Date().getFullYear(),
    } as BibliographyEntry);
  };

  const authorsString = formData.authors?.join("; ") || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Bibliography Entry" : "Edit Entry"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Create a new bibliography entry." : "Modify the selected bibliography entry."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Entry Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as EntryType })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(entryTypeLabels) as EntryType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {entryTypeIcons[t]}
                      <span className="ml-2">{entryTypeLabels[t]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="citeKey">
                Citation Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="citeKey"
                value={formData.citeKey}
                onChange={(e) => setFormData({ ...formData, citeKey: e.target.value })}
                placeholder="smith2023"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Article or book title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authors">
              Authors <span className="text-destructive">*</span>
              <span className="text-muted-foreground font-normal ml-1">(separate with semicolons)</span>
            </Label>
            <Input
              id="authors"
              value={authorsString}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  authors: e.target.value.split(";").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Smith, John; Doe, Jane"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doi">DOI</Label>
              <Input
                id="doi"
                value={formData.doi || ""}
                onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                placeholder="10.1000/example"
              />
            </div>
          </div>

          {(formData.type === "article" || formData.type === "inproceedings") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="journal">{formData.type === "article" ? "Journal" : "Book Title"}</Label>
                <Input
                  id="journal"
                  value={formData.journal || formData.booktitle || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      [formData.type === "article" ? "journal" : "booktitle"]: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume</Label>
                  <Input
                    id="volume"
                    value={formData.volume || ""}
                    onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">Number</Label>
                  <Input
                    id="number"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pages">Pages</Label>
                  <Input
                    id="pages"
                    value={formData.pages || ""}
                    onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                    placeholder="123-145"
                  />
                </div>
              </div>
            </>)}

          <div className="space-y-2">
            <Label htmlFor="abstract">Abstract</Label>
            <Textarea
              id="abstract"
              value={formData.abstract || ""}
              onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
              placeholder="Optional abstract or notes..."
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {isNew ? "Add Entry" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Import Dialog
// ============================================================================

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (bibtex: string) => void;
}

function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [text, setText] = React.useState("");

  const handleImport = () => {
    if (!text.trim()) {
      toast.error("Please paste BibTeX data");
      return;
    }
    onImport(text);
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from BibTeX</DialogTitle>
          <DialogDescription>
            Paste BibTeX entries below. Multiple entries are supported.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`@article{smith2023,
  title = {Title of the Article},
  author = {Smith, John and Doe, Jane},
  journal = {Journal Name},
  year = {2023},
  volume = {45},
  number = {3},
  pages = {123--145}
}`}
            rows={12}
            className="font-mono text-sm"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport}>
            <FileUp className="h-4 w-4 mr-2" />
            Import Entries
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function copyToClipboard(text: string, successMessage: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(successMessage),
    () => toast.error("Failed to copy to clipboard")
  );
}

function formatEntry(entry: BibliographyEntry, style: CitationStyle): string {
  const authors = formatAuthors(entry.authors, style);

  switch (style) {
    case "apa":
      return `${authors} (${entry.year}). ${entry.title}${entry.journal ? `. ${entry.journal}` : ""}${entry.volume ? `, ${entry.volume}` : ""}${entry.number ? `(${entry.number})` : ""}${entry.pages ? `, ${entry.pages}` : ""}. ${entry.doi ? `https://doi.org/${entry.doi}` : ""}`;

    case "mla":
      return `${authors}. "${entry.title}." ${entry.journal || entry.booktitle || ""}, vol. ${entry.volume || "n/a"}, no. ${entry.number || "n/a"}, ${entry.year}${entry.pages ? `, pp. ${entry.pages}` : ""}.`;

    case "ieee":
      return `${authors.replace(/,$/, "")}, "${entry.title}," ${entry.journal || entry.booktitle || ""}, vol. ${entry.volume || "n/a"}, no. ${entry.number || "n/a"}${entry.pages ? `, pp. ${entry.pages}` : ""}, ${entry.year}.`;

    case "vancouver":
      return `${authors.replace(/,$/, "")}. ${entry.title}. ${entry.journal || entry.booktitle || ""}. ${entry.year};${entry.volume || ""}${entry.number ? `(${entry.number})` : ""}:${entry.pages || ""}.`;

    case "chicago":
      return `${authors}. "${entry.title}." ${entry.journal || entry.booktitle || ""} ${entry.volume || ""}, no. ${entry.number || "n/a"} (${entry.year})${entry.pages ? `: ${entry.pages}` : ""}.`;

    case "harvard":
      return `${authors} (${entry.year}) '${entry.title}', ${entry.journal || entry.booktitle || ""}, ${entry.volume || "n/a"}(${entry.number || "n/a"})${entry.pages ? `, pp. ${entry.pages}` : ""}.`;

    default:
      return `${authors} (${entry.year}). ${entry.title}`;
  }
}

function formatAuthors(authors: string[], style: CitationStyle): string {
  if (!authors.length) return "Unknown Author";

  // Simple formatting
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;

  // For APA, list first 6 then et al., otherwise use et al. after first author
  if (style === "apa") {
    if (authors.length <= 6) return authors.join(", ") + ",";
    return authors.slice(0, 6).join(", ") + ", et al.";
  }

  // MLA: First author + et al.
  if (style === "mla") {
    return `${authors[0]}, et al.`;
  }

  return `${authors[0]} et al.`;
}

function entriesToBibTeX(entries: BibliographyEntry[]): string {
  return entries
    .map((entry) => {
      const lines = [`@${entry.type}{${entry.citeKey},`];
      if (entry.title) lines.push(`  title = {${entry.title}},`);
      if (entry.authors.length) lines.push(`  author = {${entry.authors.join(" and ")}},`);
      if (entry.year) lines.push(`  year = {${entry.year}},`);
      if (entry.journal) lines.push(`  journal = {${entry.journal}},`);
      if (entry.booktitle) lines.push(`  booktitle = {${entry.booktitle}},`);
      if (entry.publisher) lines.push(`  publisher = {${entry.publisher}},`);
      if (entry.volume) lines.push(`  volume = {${entry.volume}},`);
      if (entry.number) lines.push(`  number = {${entry.number}},`);
      if (entry.pages) lines.push(`  pages = {${entry.pages}},`);
      if (entry.doi) lines.push(`  doi = {${entry.doi}},`);
      if (entry.url) lines.push(`  url = {${entry.url}},`);
      lines.push("}");
      return lines.join("\n");
    })
    .join("\n\n");
}

function parseBibTeX(bibtex: string): BibliographyEntry[] {
  const entries: BibliographyEntry[] = [];
  const regex = /@(\w+)\s*\{([^,]+),\s*([^}]*)\}/g;
  let match;

  while ((match = regex.exec(bibtex)) !== null) {
    const type = match[1] as EntryType;
    const citeKey = match[2];
    const fieldsText = match[3];

    const fields: Record<string, string> = {};
    const fieldRegex = /(\w+)\s*=\s*\{([^}]*)\}/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(fieldsText)) !== null) {
      fields[fieldMatch[1]] = fieldMatch[2];
    }

    entries.push({
      id: `entry-${Date.now()}-${entries.length}`,
      type: entryTypeLabels[type] ? type : "misc",
      citeKey,
      title: fields.title || "Untitled",
      authors: fields.author ? fields.author.split(" and ").map((s) => s.trim()) : [],
      year: parseInt(fields.year) || new Date().getFullYear(),
      journal: fields.journal,
      booktitle: fields.booktitle,
      publisher: fields.publisher,
      volume: fields.volume,
      number: fields.number,
      pages: fields.pages,
      doi: fields.doi,
      url: fields.url,
      citationCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return entries;
}
