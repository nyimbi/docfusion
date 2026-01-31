"use client";

/**
 * TemplateImporter - Import documents and convert to reusable templates
 *
 * Features:
 * - Multi-format input (paste, file upload, URL)
 * - AI-powered structure analysis
 * - Interactive preview and editing
 * - Progress tracking with stage indicators
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  FileText,
  Link,
  Clipboard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Edit3,
  Sparkles,
  Eye,
  Save,
  X,
  RefreshCw,
  Info,
  Wand2,
  FileCode,
  Layers,
  Target,
  Users,
  Clock,
  Tag,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeDocument,
  createTemplateFromAnalysis,
  validateTemplate,
  type DocumentAnalysis,
  type ImportedSection,
  type ImportProgress,
} from "@/lib/hdsi/template-importer";
import type { DocumentTemplate, TemplateNode } from "@/lib/hdsi/templates";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface TemplateImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (template: DocumentTemplate) => void;
}

type ImportStage = "input" | "analyzing" | "preview" | "editing" | "saving";

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Stage indicator showing import progress
 */
function StageIndicator({ currentStage }: { currentStage: ImportStage }) {
  const stages: { id: ImportStage; label: string; icon: React.ReactNode }[] = [
    { id: "input", label: "Input", icon: <FileText className="h-4 w-4" /> },
    { id: "analyzing", label: "Analyze", icon: <Sparkles className="h-4 w-4" /> },
    { id: "preview", label: "Preview", icon: <Eye className="h-4 w-4" /> },
    { id: "editing", label: "Edit", icon: <Edit3 className="h-4 w-4" /> },
    { id: "saving", label: "Save", icon: <Save className="h-4 w-4" /> },
  ];

  const currentIndex = stages.findIndex(s => s.id === currentStage);

  return (
    <div className="flex items-center justify-center gap-2 py-4 border-b border-border/50">
      {stages.map((stage, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        const isPending = index > currentIndex;

        return (
          <React.Fragment key={stage.id}>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                isActive && "bg-primary text-primary-foreground",
                isComplete && "bg-primary/20 text-primary",
                isPending && "bg-muted text-muted-foreground"
              )}
            >
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : stage.icon}
              <span className="hidden sm:inline">{stage.label}</span>
            </div>
            {index < stages.length - 1 && (
              <ChevronRight className={cn(
                "h-4 w-4",
                index < currentIndex ? "text-primary" : "text-muted-foreground/50"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Google connection status type
interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  valid: boolean;
  email: string | null;
  message: string;
}

/**
 * Input stage - document paste/upload
 */
function InputStage({
  onAnalyze,
  isAnalyzing,
}: {
  onAnalyze: (content: string) => void;
  isAnalyzing: boolean;
}) {
  const [inputMethod, setInputMethod] = React.useState<"paste" | "file" | "url" | "google">("paste");
  const [content, setContent] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Google Docs state
  const [googleStatus, setGoogleStatus] = React.useState<GoogleStatus | null>(null);
  const [googleDocUrl, setGoogleDocUrl] = React.useState("");
  const [isFetchingDoc, setIsFetchingDoc] = React.useState(false);
  const [loadedDocTitle, setLoadedDocTitle] = React.useState<string | null>(null);

  // Check Google connection status on mount and when tab changes to google
  React.useEffect(() => {
    if (inputMethod === "google") {
      checkGoogleStatus();
    }
  }, [inputMethod]);

  // Check for google_connected URL param (after OAuth redirect)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      setInputMethod("google");
      checkGoogleStatus();
      toast.success("Connected to Google!");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    const googleError = params.get("google_error");
    if (googleError) {
      toast.error(`Google connection failed: ${googleError.replace(/_/g, " ")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const response = await fetch("/api/v1/google/status");
      const status = await response.json();
      setGoogleStatus(status);
    } catch {
      setGoogleStatus({
        configured: false,
        connected: false,
        valid: false,
        email: null,
        message: "Failed to check Google connection status",
      });
    }
  };

  const handleGoogleConnect = () => {
    // Redirect to Google OAuth
    const returnUrl = encodeURIComponent(window.location.pathname + "?google_connected=true");
    window.location.href = `/api/v1/google/auth?returnUrl=${returnUrl}`;
  };

  const handleGoogleDisconnect = async () => {
    try {
      await fetch("/api/v1/google/status", { method: "DELETE" });
      setGoogleStatus({
        configured: googleStatus?.configured ?? false,
        connected: false,
        valid: false,
        email: null,
        message: "Disconnected from Google",
      });
      setContent("");
      setLoadedDocTitle(null);
      toast.success("Disconnected from Google");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  const extractDocIdFromUrl = (url: string): string | null => {
    // Handle various Google Docs URL formats
    // https://docs.google.com/document/d/DOCUMENT_ID/edit
    // https://docs.google.com/document/d/DOCUMENT_ID/
    // https://docs.google.com/document/d/DOCUMENT_ID
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleFetchGoogleDoc = async () => {
    const docId = extractDocIdFromUrl(googleDocUrl);
    if (!docId) {
      toast.error("Invalid Google Docs URL. Please paste a valid Google Docs link.");
      return;
    }

    setIsFetchingDoc(true);
    try {
      const response = await fetch(`/api/v1/google/docs/${docId}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.code === "NOT_AUTHENTICATED" || data.code === "TOKEN_EXPIRED") {
          toast.error("Please reconnect your Google account");
          setGoogleStatus(prev => prev ? { ...prev, connected: false, valid: false } : null);
          return;
        }
        toast.error(data.message || "Failed to fetch document");
        return;
      }

      setContent(data.content);
      setLoadedDocTitle(data.title);
      toast.success(`Loaded "${data.title}" (${data.wordCount.toLocaleString()} words)`);
    } catch (error) {
      toast.error("Failed to fetch Google Doc");
    } finally {
      setIsFetchingDoc(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const supportedTextFormats = ["txt", "md", "markdown", "text"];

      if (supportedTextFormats.includes(extension ?? "")) {
        const text = await file.text();
        setContent(text);
        setInputMethod("paste");
        toast.success(`Loaded ${file.name}`);
      } else if (extension === "docx") {
        // DOCX parsing requires mammoth.js or similar library
        toast.error("DOCX files are not supported. Please export to plain text or markdown, or copy-paste the content directly.");
      } else if (extension === "pdf") {
        // PDF parsing requires pdf.js or similar library
        toast.error("PDF files are not supported. Please copy-paste the content directly.");
      } else {
        // Try to read as text for unknown formats
        try {
          const text = await file.text();
          if (text && text.length > 0) {
            setContent(text);
            setInputMethod("paste");
            toast.success(`Loaded ${file.name}`);
          } else {
            toast.error(`File format .${extension} is not supported. Please use .txt or .md files.`);
          }
        } catch {
          toast.error(`File format .${extension} is not supported. Please use .txt or .md files.`);
        }
      }
    } catch {
      toast.error("Failed to read file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Failed to read clipboard");
    }
  };

  const handleAnalyze = () => {
    if (inputMethod === "url") {
      toast.error("URL import is not available. Please use paste, file upload, or Google Docs.");
      return;
    }
    if (!content.trim()) {
      toast.error("Please provide document content");
      return;
    }
    onAnalyze(content);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Input method tabs */}
      <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as typeof inputMethod)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="paste" className="gap-2">
            <Clipboard className="h-4 w-4" />
            Paste
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <GoogleIcon className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2">
            <Link className="h-4 w-4" />
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasteFromClipboard}
              className="gap-2"
            >
              <Clipboard className="h-4 w-4" />
              Paste from Clipboard
            </Button>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your document content here...

The importer works best with documents that have clear section headers:
• Markdown headers (# Chapter, ## Section)
• Numbered sections (1.0 Introduction, 1.1 Background)
• ALL CAPS HEADERS

The AI will analyze the structure and create appropriate prompts for each section."
            className="min-h-[300px] font-mono text-sm resize-none"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{content.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
            <span>{content.length.toLocaleString()} characters</span>
          </div>
        </TabsContent>

        <TabsContent value="file" className="mt-4">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Drop your document here</p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">.txt</Badge>
              <Badge variant="secondary">.md</Badge>
              <Badge variant="outline" className="opacity-50">.docx (soon)</Badge>
              <Badge variant="outline" className="opacity-50">.pdf (soon)</Badge>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.markdown"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </div>
          {content && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Document loaded: {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="google" className="space-y-4 mt-4">
          {/* Google connection status */}
          {googleStatus === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !googleStatus.configured ? (
            <div className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-amber-700 dark:text-amber-400">Google OAuth Not Configured</p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    To import from Google Docs, you need to configure Google OAuth credentials.
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1 mt-3 p-3 bg-background/50 rounded">
                    <p className="font-medium">Setup Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                      <li>Create a project and enable Google Docs API & Google Drive API</li>
                      <li>Create OAuth 2.0 credentials (Web application)</li>
                      <li>Add redirect URI: <code className="bg-muted px-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/v1/google/callback</code></li>
                      <li>Add to your .env.local:
                        <pre className="mt-1 p-2 bg-muted rounded text-[10px]">
{`GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret`}
                        </pre>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : !googleStatus.connected ? (
            <div className="flex flex-col items-center py-8 space-y-6">
              <div className="p-4 rounded-full bg-muted">
                <GoogleIcon className="h-12 w-12" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Connect to Google Docs</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Sign in with your Google account to import documents directly from Google Docs.
                  We only request read-only access to your documents.
                </p>
              </div>
              <Button onClick={handleGoogleConnect} size="lg" className="gap-3">
                <GoogleIcon className="h-5 w-5" />
                Connect Google Account
              </Button>
              <p className="text-xs text-muted-foreground">
                Your documents stay private. We only read the document you select.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected status */}
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Connected to Google</p>
                    {googleStatus.email && (
                      <p className="text-sm text-green-600 dark:text-green-500">{googleStatus.email}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleGoogleDisconnect}>
                  Disconnect
                </Button>
              </div>

              {/* Document URL input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Google Docs URL</label>
                <div className="flex gap-2">
                  <Input
                    value={googleDocUrl}
                    onChange={(e) => setGoogleDocUrl(e.target.value)}
                    placeholder="https://docs.google.com/document/d/..."
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handleFetchGoogleDoc}
                    disabled={!googleDocUrl.trim() || isFetchingDoc}
                    className="gap-2 flex-shrink-0"
                  >
                    {isFetchingDoc ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Fetch
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste the URL of a Google Doc you have access to. The document must be shared with your Google account.
                </p>
              </div>

              {/* Loaded document info */}
              {loadedDocTitle && content && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">{loadedDocTitle}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{content.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
                    <span>{content.length.toLocaleString()} characters</span>
                  </div>
                </div>
              )}

              {/* Preview area */}
              {content && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Document Preview</label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[200px] font-mono text-sm resize-none"
                    placeholder="Document content will appear here..."
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="url" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/document.md"
              className="font-mono"
              disabled
            />
            <p className="text-sm text-muted-foreground">
              Enter a URL to a publicly accessible document (Markdown, plain text)
            </p>
          </div>
          <div className="flex items-center gap-2 p-4 bg-muted text-muted-foreground rounded-lg">
            <Info className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">URL import is not available. Please use paste, file upload, or Google Docs instead.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Analyze button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={!content.trim() || isAnalyzing}
          size="lg"
          className="gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Analyze Document
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Analysis progress display
 */
function AnalyzingStage({ progress }: { progress: ImportProgress }) {
  const stageIcons: Record<ImportProgress["stage"], React.ReactNode> = {
    parsing: <FileCode className="h-5 w-5" />,
    "analyzing-structure": <Layers className="h-5 w-5" />,
    "extracting-sections": <FileText className="h-5 w-5" />,
    "generating-prompts": <Sparkles className="h-5 w-5" />,
    finalizing: <CheckCircle2 className="h-5 w-5" />,
    complete: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
      <div className="relative">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
          {progress.stage === "error" ? (
            <AlertCircle className="h-12 w-12 text-red-500" />
          ) : progress.stage === "complete" ? (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          ) : (
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          )}
        </div>
      </div>

      <div className="text-center space-y-2 max-w-md">
        <div className="flex items-center justify-center gap-2 text-lg font-medium">
          {stageIcons[progress.stage]}
          <span className="capitalize">{progress.stage.replace(/-/g, " ")}</span>
        </div>
        <p className="text-muted-foreground">{progress.message}</p>
        {progress.currentSection && (
          <p className="text-sm text-primary font-mono">{progress.currentSection}</p>
        )}
      </div>

      <div className="w-full max-w-md space-y-2">
        <Progress value={progress.progress} className="h-2" />
        <p className="text-center text-sm text-muted-foreground">{progress.progress}%</p>
      </div>
    </div>
  );
}

/**
 * Section preview with collapsible tree
 */
function SectionTree({
  sections,
  onEdit,
}: {
  sections: ImportedSection[];
  onEdit: (path: number[], section: ImportedSection) => void;
}) {
  const renderSection = (section: ImportedSection, path: number[], depth: number) => {
    const hasChildren = section.children && section.children.length > 0;
    const typeLabel = depth === 0 ? "Chapter" : depth === 1 ? "Section" : "Subsection";
    const typeColor = depth === 0 ? "bg-primary/20 text-primary" : depth === 1 ? "bg-blue-500/20 text-blue-600" : "bg-muted text-muted-foreground";

    return (
      <AccordionItem key={path.join("-")} value={path.join("-")} className="border-b-0">
        <AccordionTrigger className="hover:no-underline py-2 px-3 rounded-lg hover:bg-muted/50">
          <div className="flex items-start gap-3 text-left w-full">
            <Badge variant="outline" className={cn("text-xs flex-shrink-0", typeColor)}>
              {typeLabel}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{section.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">{section.purpose}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(path, section);
              }}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-6">
          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm"><strong>Summary:</strong> {section.contentSummary}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-background rounded">
                  ~{section.suggestedTokenBudget} tokens
                </span>
                <span className="px-2 py-1 bg-background rounded">
                  {Math.round(section.suggestedDensity * 100)}% density
                </span>
              </div>
            </div>
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-xs font-medium text-primary mb-1">AI Generation Prompt:</p>
              <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">
                {section.generatedPrompt}
              </p>
            </div>
            {hasChildren && (
              <Accordion type="multiple" className="pl-4 border-l-2 border-border">
                {section.children.map((child, i) => renderSection(child, [...path, i], depth + 1))}
              </Accordion>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <Accordion type="multiple" className="space-y-1">
      {sections.map((section, i) => renderSection(section, [i], 0))}
    </Accordion>
  );
}

/**
 * Update a section at a given path in the structure tree.
 * Path is an array of indices like [0, 2, 1] meaning: structure[0].children[2].children[1]
 */
function updateSectionAtPath(
  structure: ImportedSection[],
  path: number[],
  updatedSection: ImportedSection
): ImportedSection[] {
  if (path.length === 0) return structure;

  const [index, ...rest] = path;
  return structure.map((section, i) => {
    if (i !== index) return section;

    if (rest.length === 0) {
      // This is the target section
      return updatedSection;
    } else {
      // Recurse into children
      return {
        ...section,
        children: updateSectionAtPath(section.children || [], rest, updatedSection),
      };
    }
  });
}

/**
 * Preview stage - show analyzed structure
 */
function PreviewStage({
  analysis,
  onProceed,
  onReanalyze,
  onUpdateSection,
}: {
  analysis: DocumentAnalysis;
  onProceed: () => void;
  onReanalyze: () => void;
  onUpdateSection: (path: number[], section: ImportedSection) => void;
}) {
  const [editingSection, setEditingSection] = React.useState<{
    path: number[];
    section: ImportedSection;
  } | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Analysis summary header */}
      <div className="p-6 border-b border-border/50 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">{analysis.suggestedName}</h3>
            <p className="text-muted-foreground mt-1">{analysis.suggestedDescription}</p>
          </div>
          <Badge
            variant={
              analysis.structureQuality === "well-organized" ? "default" :
              analysis.structureQuality === "moderate" ? "secondary" : "destructive"
            }
          >
            {analysis.structureQuality}
          </Badge>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              Category
            </div>
            <p className="font-medium capitalize">{analysis.detectedType}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Audience
            </div>
            <p className="font-medium truncate">{analysis.inferredAudience}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Layers className="h-4 w-4" />
              Sections
            </div>
            <p className="font-medium">{analysis.totalSections} sections, {analysis.maxDepth} levels deep</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Est. Time
            </div>
            <p className="font-medium">{analysis.estimatedTime}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {analysis.suggestedTags.map(tag => (
            <Badge key={tag} variant="outline" className="gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
        </div>

        {/* Analysis notes */}
        {analysis.analysisNotes && (
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg flex items-start gap-2">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{analysis.analysisNotes}</p>
          </div>
        )}
      </div>

      {/* Section tree */}
      <ScrollArea className="flex-1 p-6">
        <h4 className="font-medium mb-4">Extracted Structure</h4>
        <SectionTree
          sections={analysis.structure}
          onEdit={(path, section) => setEditingSection({ path, section })}
        />
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border/50 flex justify-between">
        <Button variant="outline" onClick={onReanalyze} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Re-analyze
        </Button>
        <Button onClick={onProceed} className="gap-2">
          <Edit3 className="h-4 w-4" />
          Customize Template
        </Button>
      </div>

      {/* Section edit dialog */}
      {editingSection && (
        <SectionEditDialog
          section={editingSection.section}
          onClose={() => setEditingSection(null)}
          onSave={(updated) => {
            onUpdateSection(editingSection.path, updated);
            setEditingSection(null);
            toast.success("Section updated");
          }}
        />
      )}
    </div>
  );
}

/**
 * Section edit dialog
 */
function SectionEditDialog({
  section,
  onClose,
  onSave,
}: {
  section: ImportedSection;
  onClose: () => void;
  onSave: (section: ImportedSection) => void;
}) {
  const [edited, setEdited] = React.useState(section);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Section: {section.title}</DialogTitle>
          <DialogDescription>
            Customize how this section will appear in the template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={edited.title}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Purpose</label>
            <Textarea
              value={edited.purpose}
              onChange={(e) => setEdited({ ...edited, purpose: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">AI Generation Prompt</label>
            <Textarea
              value={edited.generatedPrompt}
              onChange={(e) => setEdited({ ...edited, generatedPrompt: e.target.value })}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{placeholders}}"} for dynamic content like {"{{company_name}}"}, {"{{project_scope}}"}, etc.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Token Budget</label>
              <Input
                type="number"
                value={edited.suggestedTokenBudget}
                onChange={(e) => setEdited({ ...edited, suggestedTokenBudget: parseInt(e.target.value) || 500 })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Density Target</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={edited.suggestedDensity}
                onChange={(e) => setEdited({ ...edited, suggestedDensity: parseFloat(e.target.value) || 0.7 })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(edited)}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Final editing stage - customize template metadata
 */
function EditingStage({
  analysis,
  onSave,
  onBack,
}: {
  analysis: DocumentAnalysis;
  onSave: (template: DocumentTemplate) => void;
  onBack: () => void;
}) {
  const [name, setName] = React.useState(analysis.suggestedName);
  const [description, setDescription] = React.useState(analysis.suggestedDescription);
  const [purpose, setPurpose] = React.useState(analysis.inferredPurpose);
  const [audience, setAudience] = React.useState(analysis.inferredAudience);
  const [usageAdvice, setUsageAdvice] = React.useState(
    `Use this template when creating ${analysis.detectedType} documents. Best suited for ${analysis.inferredAudience}.`
  );
  const [bestPractices, setBestPractices] = React.useState(
    analysis.keyThemes.slice(0, 3).map(t => `Focus on ${t}`)
  );
  const [color, setColor] = React.useState(analysis.suggestedColor);
  const [isSaving, setIsSaving] = React.useState(false);

  const colorOptions = [
    { value: "#dc2626", label: "Red" },
    { value: "#ea580c", label: "Orange" },
    { value: "#d97706", label: "Amber" },
    { value: "#65a30d", label: "Lime" },
    { value: "#059669", label: "Emerald" },
    { value: "#0891b2", label: "Cyan" },
    { value: "#2563eb", label: "Blue" },
    { value: "#7c3aed", label: "Violet" },
    { value: "#c026d3", label: "Fuchsia" },
    { value: "#64748b", label: "Slate" },
  ];

  const handleSave = () => {
    setIsSaving(true);
    try {
      const template = createTemplateFromAnalysis(analysis, {
        name,
        description,
        purpose,
        targetAudience: audience,
        usageAdvice,
        bestPractices,
      });

      // Override color
      template.color = color;

      const validation = validateTemplate(template);
      if (!validation.valid) {
        toast.error(`Validation failed: ${validation.errors.join(", ")}`);
        setIsSaving(false);
        return;
      }

      onSave(template);
    } catch (error) {
      toast.error("Failed to create template");
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h3 className="text-lg font-semibold mb-4">Customize Your Template</h3>
            <p className="text-muted-foreground">
              Review and customize the template metadata before saving.
            </p>
          </div>

          {/* Basic info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Technical Proposal Template"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of what this template is for..."
                rows={3}
              />
            </div>
          </div>

          {/* Audience & Purpose */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Purpose
              </label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What is this template designed to accomplish?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Target Audience
              </label>
              <Textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Who should use this template?"
                rows={3}
              />
            </div>
          </div>

          {/* Usage advice */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Usage Advice</label>
            <Textarea
              value={usageAdvice}
              onChange={(e) => setUsageAdvice(e.target.value)}
              placeholder="When and how should users employ this template?"
              rows={3}
            />
          </div>

          {/* Best practices */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Best Practices</label>
            {bestPractices.map((practice, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={practice}
                  onChange={(e) => {
                    const updated = [...bestPractices];
                    updated[i] = e.target.value;
                    setBestPractices(updated);
                  }}
                  placeholder={`Best practice ${i + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBestPractices(bestPractices.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {bestPractices.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBestPractices([...bestPractices, ""])}
              >
                Add Best Practice
              </Button>
            )}
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Template Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(opt => (
                <button
                  key={opt.value}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color === opt.value ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                  )}
                  style={{ backgroundColor: opt.value }}
                  onClick={() => setColor(opt.value)}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Preview card */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Preview</h4>
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: color }}
              >
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-semibold">{name || "Template Name"}</h5>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {description || "Template description..."}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary">{analysis.totalSections} sections</Badge>
                  <Badge variant="outline">{analysis.estimatedTime}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border/50 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to Preview
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Template
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TemplateImporter({ isOpen, onClose, onImport }: TemplateImporterProps) {
  const [stage, setStage] = React.useState<ImportStage>("input");
  const [progress, setProgress] = React.useState<ImportProgress>({
    stage: "parsing",
    progress: 0,
    message: "Ready to analyze",
  });
  const [analysis, setAnalysis] = React.useState<DocumentAnalysis | null>(null);
  const [documentContent, setDocumentContent] = React.useState("");

  const handleAnalyze = async (content: string) => {
    setDocumentContent(content);
    setStage("analyzing");

    try {
      const result = await analyzeDocument(content, setProgress);
      setAnalysis(result);
      setStage("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
      setStage("input");
    }
  };

  const handleReanalyze = () => {
    setStage("input");
    setAnalysis(null);
  };

  const handleSaveTemplate = (template: DocumentTemplate) => {
    onImport(template);
    toast.success("Template imported successfully!");
    handleClose();
  };

  const handleClose = () => {
    setStage("input");
    setProgress({ stage: "parsing", progress: 0, message: "Ready to analyze" });
    setAnalysis(null);
    setDocumentContent("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Document as Template
          </DialogTitle>
          <DialogDescription>
            Analyze an existing document to create a reusable template with AI-generated prompts
          </DialogDescription>
        </DialogHeader>

        <StageIndicator currentStage={stage} />

        <div className="flex-1 overflow-hidden">
          {stage === "input" && (
            <InputStage
              onAnalyze={handleAnalyze}
              isAnalyzing={false}
            />
          )}

          {stage === "analyzing" && (
            <AnalyzingStage progress={progress} />
          )}

          {stage === "preview" && analysis && (
            <PreviewStage
              analysis={analysis}
              onProceed={() => setStage("editing")}
              onReanalyze={handleReanalyze}
              onUpdateSection={(path, updated) => {
                setAnalysis((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    structure: updateSectionAtPath(prev.structure, path, updated),
                  };
                });
              }}
            />
          )}

          {stage === "editing" && analysis && (
            <EditingStage
              analysis={analysis}
              onSave={handleSaveTemplate}
              onBack={() => setStage("preview")}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateImporter;
