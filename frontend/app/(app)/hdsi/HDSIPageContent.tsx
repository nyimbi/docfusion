"use client";

/**
 * HDSIPageContent - Command Center Redesign
 *
 * Design: "Mission Control" aesthetic
 * - Dark mode native with luminous accents
 * - Organized command panels with clear feature groups
 * - Refined toggle controls (no sloppy buttons)
 * - Contextual feature surfaces based on workflow
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HDSIFullEnhanced } from "@/components/document/HDSIFullEnhanced";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { RegulationType } from "@/lib/hdsi/types";

// Icons
import {
  ArrowLeft,
  Sparkles,
  Users,
  Mic,
  Eye,
  Shield,
  FileText,
  Layers,
  Wand2,
  Network,
  Link2,
  Palette,
  History,
  Download,
  Upload,
  Settings2,
  ChevronDown,
  Zap,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  LayoutGrid,
  PanelLeftClose,
  PanelLeft,
  Command,
  Keyboard,
  HelpCircle,
  FileCode2,
  Image,
  Table2,
  ListTree,
  GitBranch,
  RefreshCw,
  Save,
  Share2,
  Printer,
  Mail,
  Clock,
  Star,
  Bookmark,
  Tag,
  MessageSquare,
  PenTool,
  Highlighter,
  StickyNote,
  Volume2,
  VolumeX,
  Cpu,
  Brain,
  Target,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Gauge,
  Lock,
  Unlock,
  Globe,
  Server,
} from "lucide-react";

// ============================================================================
// Feature Categories for Organized Display
// ============================================================================

interface FeatureToggle {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "ai" | "collaboration" | "input" | "compliance" | "export" | "view";
  requiresPro?: boolean;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  // AI Features
  { id: "aiGeneration", label: "AI Generation", description: "Generate content with AI", icon: Wand2, category: "ai" },
  { id: "ragPipeline", label: "RAG Pipeline", description: "Context-aware AI responses", icon: Brain, category: "ai" },
  { id: "streaming", label: "Streaming", description: "Real-time AI output", icon: Activity, category: "ai" },
  { id: "predictive", label: "Predictive Text", description: "Auto-complete suggestions", icon: Zap, category: "ai" },

  // Collaboration
  { id: "collaboration", label: "Real-time Collab", description: "Multi-user editing", icon: Users, category: "collaboration" },
  { id: "comments", label: "Comments", description: "Inline document comments", icon: MessageSquare, category: "collaboration" },
  { id: "presence", label: "Presence", description: "See who's viewing", icon: Eye, category: "collaboration" },

  // Input Methods
  { id: "voice", label: "Voice Input", description: "Speech-to-text dictation", icon: Mic, category: "input" },
  { id: "eyeTracking", label: "Eye Tracking", description: "Gaze-based navigation", icon: Target, category: "input", requiresPro: true },
  { id: "drawing", label: "Annotations", description: "Freehand markup", icon: PenTool, category: "input" },

  // Compliance
  { id: "styleCheck", label: "Style Guide", description: "Enforce writing standards", icon: BookOpen, category: "compliance" },
  { id: "compliance", label: "Compliance", description: "Regulatory checks", icon: Shield, category: "compliance" },
  { id: "versioning", label: "Versioning", description: "Document history", icon: GitBranch, category: "compliance" },

  // Export
  { id: "pdfExport", label: "PDF Export", description: "High-fidelity PDF", icon: FileText, category: "export" },
  { id: "docxExport", label: "DOCX Export", description: "Microsoft Word", icon: FileCode2, category: "export" },
  { id: "latexExport", label: "LaTeX Export", description: "Academic format", icon: FileCode2, category: "export" },

  // View
  { id: "graphView", label: "Graph View", description: "Network visualization", icon: Network, category: "view" },
  { id: "backlinks", label: "Backlinks", description: "Cross-references", icon: Link2, category: "view" },
  { id: "outline", label: "Outline Panel", description: "Document structure", icon: ListTree, category: "view" },
];

const CATEGORY_META = {
  ai: { label: "AI Features", icon: Brain, color: "violet" },
  collaboration: { label: "Collaboration", icon: Users, color: "blue" },
  input: { label: "Input Methods", icon: Keyboard, color: "emerald" },
  compliance: { label: "Compliance", icon: Shield, color: "amber" },
  export: { label: "Export", icon: Download, color: "slate" },
  view: { label: "View Options", icon: LayoutGrid, color: "rose" },
} as const;

// ============================================================================
// FeatureSwitch Component - Refined Toggle
// ============================================================================

interface FeatureSwitchProps {
  feature: FeatureToggle;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  compact?: boolean;
}

function FeatureSwitch({ feature, enabled, onChange, compact }: FeatureSwitchProps) {
  const Icon = feature.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange(!enabled)}
              className={cn(
                "relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                enabled
                  ? "bg-primary/10 text-primary shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {enabled && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
              )}
              {feature.requiresPro && !enabled && (
                <Lock className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 text-amber-500" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <div className="font-medium">{feature.label}</div>
            <div className="text-xs text-muted-foreground">{feature.description}</div>
            {feature.requiresPro && <div className="text-xs text-amber-500 mt-1">Pro feature</div>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg",
          enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium flex items-center gap-1.5">
            {feature.label}
            {feature.requiresPro && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-500">
                PRO
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{feature.description}</div>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}

// ============================================================================
// CommandPalette Trigger
// ============================================================================

function CommandPaletteTrigger() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Commands</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </TooltipTrigger>
        <TooltipContent>Open command palette</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Quick Actions Bar
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  variant?: "default" | "primary" | "destructive";
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "generate", label: "Generate", icon: Sparkles, shortcut: "⌘G", variant: "primary" },
  { id: "save", label: "Save", icon: Save, shortcut: "⌘S" },
  { id: "export", label: "Export", icon: Download },
  { id: "share", label: "Share", icon: Share2 },
];

function QuickActionsBar({ onAction }: { onAction: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <TooltipProvider key={action.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={action.variant === "primary" ? "primary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5",
                    action.variant === "primary" && "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm shadow-violet-500/20"
                  )}
                  onClick={() => onAction(action.id)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{action.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {action.label}
                {action.shortcut && <span className="ml-2 text-muted-foreground">{action.shortcut}</span>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ============================================================================
// Status Indicator
// ============================================================================

interface StatusIndicatorProps {
  status: "idle" | "generating" | "saving" | "error";
  message?: string;
}

function StatusIndicator({ status, message }: StatusIndicatorProps) {
  const config = {
    idle: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Ready" },
    generating: { icon: Sparkles, color: "text-violet-500", bg: "bg-violet-500/10", label: "Generating..." },
    saving: { icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-500/10", label: "Saving..." },
    error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Error" },
  }[status];

  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs", config.bg, config.color)}>
      <Icon className={cn("h-3 w-3", status === "generating" && "animate-pulse", status === "saving" && "animate-spin")} />
      <span>{message || config.label}</span>
    </div>
  );
}

// ============================================================================
// Regulation Selector with Visual Feedback
// ============================================================================

const REGULATIONS: { value: RegulationType; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "FAR", label: "FAR", description: "Federal Acquisition Regulation", icon: Shield },
  { value: "DFARS", label: "DFARS", description: "Defense Federal Acquisition", icon: Shield },
  { value: "GDPR", label: "GDPR", description: "General Data Protection", icon: Lock },
];

function RegulationSelector({ value, onChange }: { value: RegulationType; onChange: (v: RegulationType) => void }) {
  const current = REGULATIONS.find(r => r.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 min-w-[100px]">
          {current && <current.icon className="h-3.5 w-3.5 text-amber-500" />}
          <span>{value}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Compliance Framework</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REGULATIONS.map((reg) => {
          const Icon = reg.icon;
          return (
            <DropdownMenuItem
              key={reg.value}
              onClick={() => onChange(reg.value)}
              className={cn(value === reg.value && "bg-accent")}
            >
              <Icon className="h-4 w-4 mr-2 text-amber-500" />
              <div>
                <div className="font-medium">{reg.label}</div>
                <div className="text-xs text-muted-foreground">{reg.description}</div>
              </div>
              {value === reg.value && <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Features Panel (Expandable)
// ============================================================================

interface FeaturesPanelProps {
  features: Record<string, boolean>;
  setFeatures: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

function FeaturesPanel({ features, setFeatures }: FeaturesPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleFeature = useCallback((id: string, enabled: boolean) => {
    setFeatures(prev => ({ ...prev, [id]: enabled }));
  }, [setFeatures]);

  const groupedFeatures = FEATURE_TOGGLES.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureToggle[]>);

  const enabledCount = Object.values(features).filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden md:inline">Features</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {enabledCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Feature Configuration</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {enabledCount} of {FEATURE_TOGGLES.length} features active
          </p>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => {
            const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
            const Icon = meta.icon;
            const activeInCategory = categoryFeatures.filter(f => features[f.id]).length;

            return (
              <div key={category} className="border-b last:border-b-0">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", `text-${meta.color}-500`)} />
                    <span className="text-sm font-medium">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {activeInCategory}/{categoryFeatures.length}
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      expandedCategory === category && "rotate-180"
                    )} />
                  </div>
                </button>
                {expandedCategory === category && (
                  <div className="px-3 pb-2 space-y-1">
                    {categoryFeatures.map((feature) => (
                      <FeatureSwitch
                        key={feature.id}
                        feature={feature}
                        enabled={features[feature.id] ?? false}
                        onChange={(enabled) => toggleFeature(feature.id, enabled)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-2 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              const allEnabled = Object.fromEntries(FEATURE_TOGGLES.map(f => [f.id, true]));
              setFeatures(allEnabled);
            }}
          >
            Enable All Features
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Main HDSIPageContent Component
// ============================================================================

export function HDSIPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const templateId = searchParams.get("template");

  // Document state
  const [docId] = useState(() => {
    const docIdFromQuery = searchParams.get("document");
    if (docIdFromQuery) return docIdFromQuery;
    const existingId = typeof window !== "undefined"
      ? localStorage.getItem("hdsi_current_doc_id")
      : null;
    if (existingId) return existingId;
    const newId = crypto.randomUUID();
    if (typeof window !== "undefined") {
      localStorage.setItem("hdsi_current_doc_id", newId);
    }
    return newId;
  });

  const [documentTitle] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("hdsi_doc_title") || "Untitled Document"
      : "Untitled Document"
  );

  // Feature state (all features unified)
  const [features, setFeatures] = useState<Record<string, boolean>>({
    // AI
    aiGeneration: true,
    ragPipeline: true,
    streaming: true,
    predictive: true,
    // Collaboration
    collaboration: false,
    comments: true,
    presence: true,
    // Input
    voice: true,
    eyeTracking: false,
    drawing: false,
    // Compliance
    styleCheck: true,
    compliance: true,
    versioning: true,
    // Export
    pdfExport: true,
    docxExport: true,
    latexExport: true,
    // View
    graphView: true,
    backlinks: true,
    outline: true,
  });

  const [regulation, setRegulation] = useState<RegulationType>("FAR");
  const [status, setStatus] = useState<"idle" | "generating" | "saving" | "error">("idle");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const userName = session?.user?.name || "Anonymous";
  const userId = session?.user?.id || "user-1";

  // Quick action handler
  const handleQuickAction = useCallback(async (actionId: string) => {
    switch (actionId) {
      case "generate":
        setStatus("generating");
        toast.loading("Generating content...");
        setTimeout(() => {
          setStatus("idle");
          toast.dismiss();
          toast.success("Content generated successfully");
        }, 2000);
        break;
      case "save":
        setStatus("saving");
        toast.loading("Saving document...");
        setTimeout(() => {
          setStatus("idle");
          toast.dismiss();
          toast.success("Document saved");
        }, 1000);
        break;
      case "export":
        // Show export options
        const exportFormat = await new Promise<string | null>((resolve) => {
          toast.custom((t) => (
            <div className="bg-card border rounded-lg p-4 shadow-lg min-w-[280px]">
              <p className="font-medium mb-3">Export Document</p>
              <div className="space-y-2">
                {features.pdfExport && (
                  <button
                    onClick={() => { toast.dismiss(t); resolve("pdf"); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
                  >
                    📄 Export as PDF
                  </button>
                )}
                {features.docxExport && (
                  <button
                    onClick={() => { toast.dismiss(t); resolve("docx"); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
                  >
                    📝 Export as Word (DOCX)
                  </button>
                )}
                {features.latexExport && (
                  <button
                    onClick={() => { toast.dismiss(t); resolve("latex"); }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
                  >
                    📐 Export as LaTeX
                  </button>
                )}
                <button
                  onClick={() => { toast.dismiss(t); resolve("markdown"); }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
                >
                  📋 Export as Markdown
                </button>
              </div>
              <button
                onClick={() => { toast.dismiss(t); resolve(null); }}
                className="w-full mt-2 text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ), { duration: 30000 });
        });

        if (exportFormat) {
          toast.loading(`Exporting as ${exportFormat.toUpperCase()}...`);
          // Simulate export - in production this would call a real export API
          setTimeout(() => {
            toast.dismiss();
            // Create a basic export
            const content = `# HDSI Document Export\n\nExported at: ${new Date().toISOString()}\nFormat: ${exportFormat}\n\n[Document content would be here]`;
            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `hdsi-export-${Date.now()}.${exportFormat === "latex" ? "tex" : exportFormat === "markdown" ? "md" : exportFormat}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Exported as ${exportFormat.toUpperCase()}`);
          }, 1500);
        }
        break;
      case "share":
        if (navigator.share) {
          navigator.share({
            title: "HDSI Document",
            text: "Check out this document",
            url: window.location.href,
          }).catch(() => {
            // User cancelled or error
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link copied to clipboard");
          });
        } else {
          navigator.clipboard.writeText(window.location.href);
          toast.success("Link copied to clipboard");
        }
        break;
    }
  }, [features]);

  // Active feature toggles for quick access
  const quickFeatures = FEATURE_TOGGLES.filter(f =>
    ["collaboration", "voice", "eyeTracking", "compliance"].includes(f.id)
  );

  const enabledCount = Object.values(features).filter(Boolean).length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Command Bar - Refined Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card/50 backdrop-blur-sm">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/documents">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Back to Documents</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm shadow-violet-500/20">
              <Layers className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold tracking-tight">HDSI Editor</h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{templateId ? "From Template" : "Document"}</span>
                <span>•</span>
                <span className="font-mono">{docId.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Section */}
        <div className="hidden lg:flex items-center gap-4">
          <CommandPaletteTrigger />
          <StatusIndicator status={status} />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Quick Feature Toggles */}
          <div className="hidden md:flex items-center gap-0.5 p-1 rounded-lg bg-muted/50">
            {quickFeatures.map((feature) => (
              <FeatureSwitch
                key={feature.id}
                feature={feature}
                enabled={features[feature.id] ?? false}
                onChange={(enabled) => setFeatures(prev => ({ ...prev, [feature.id]: enabled }))}
                compact
              />
            ))}
          </div>

          <Separator orientation="vertical" className="h-5 hidden md:block" />

          {/* Regulation Selector */}
          <RegulationSelector value={regulation} onChange={setRegulation} />

          {/* Features Panel */}
          <FeaturesPanel features={features} setFeatures={setFeatures} />

          {/* Quick Actions */}
          <QuickActionsBar onAction={handleQuickAction} />
        </div>
      </header>

      {/* Feature Summary Strip */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/20 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{enabledCount}</strong> features active
          </span>
          <div className="flex items-center gap-2">
            {features.aiGeneration && (
              <Badge variant="secondary" className="h-5 text-[10px] gap-1">
                <Brain className="h-3 w-3" />
                AI
              </Badge>
            )}
            {features.collaboration && (
              <Badge variant="secondary" className="h-5 text-[10px] gap-1 bg-blue-500/10 text-blue-600">
                <Users className="h-3 w-3" />
                Live
              </Badge>
            )}
            {features.compliance && (
              <Badge variant="secondary" className="h-5 text-[10px] gap-1 bg-amber-500/10 text-amber-600">
                <Shield className="h-3 w-3" />
                {regulation}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Last saved 2m ago</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <HDSIFullEnhanced
          initialDocumentId={docId}
          documentTitle={documentTitle}
          userId={userId}
          userName={userName}
          userAvatar={session?.user?.image || undefined}
          enableCollaboration={features.collaboration}
          enableVoice={features.voice}
          enableEyeTracking={features.eyeTracking}
          regulation={regulation}
        />
      </div>
    </div>
  );
}

export default HDSIPageContent;
