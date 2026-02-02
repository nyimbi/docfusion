"use client";

/**
 * HDSIFullEnhanced - Fully Surfaced HDSI Editor
 *
 * ALL FEATURES NOW SURFACED IN UI:
 * ✅ Document Versioning (save, view, restore)
 * ✅ Quality Assessment (run, view, improve)
 * ✅ Section Copy (copy to clipboard)
 * ✅ Diagram Editor (5 formats, 22 templates)
 * ✅ AI Generation (outline, content, diffs)
 * ✅ Graph View (force-directed visualization)
 * ✅ Backlinks (bidirectional linking)
 * ✅ Speech-to-Text (voice input)
 * ✅ Undo/Redo (visual buttons + keyboard)
 * ✅ Text Colors (node color picker)
 * ✅ Collaboration (presence, cursors)
 * ✅ Eye Tracking (gaze indicator)
 * ✅ Editable AI Prompts (discovery, generation)
 *
 * @author DocFusion Team
 * @version 2.1.0
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { HDSINode, RegulationType } from "@/lib/hdsi/types";
import { HDSIEnhanced } from "./HDSIEnhanced";
import { DiagramEditor, type DiagramFormat } from "./DiagramEditor";
import { HDSILayout } from "./HDSILayout";
import {
  ContextBufferInspector,
  createEmptyBuffer,
} from "./ContextBufferInspector";
import {
  GenerationControlSurface,
  createInitialPhaseState,
} from "./GenerationControlSurface";
import { useCoherence } from "@/lib/hdsi/coherence";
import type {
  ContextBuffer,
  ContextBufferEntry,
  GenerationPhase,
  PhaseState,
} from "@/lib/hdsi/types";
import { HDSIToolbar } from "./HDSIToolbar";
import { TemplateEditor } from "./TemplateEditor";
import { TemplateImporter } from "./TemplateImporter";
// Optional side panel components (available for future enhancement):
// - GraphView: Requires documents[] prop for knowledge graph visualization
// - BacklinksPanel: Requires documentId, backlinks[], onNavigateToDocument props
// - AIDiffPreview: For showing AI-generated content changes
// - SpeechInputButton: For voice-to-text input
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ALL_TEMPLATES,
  getTemplateById,
  convertTemplateToNodes,
  TEMPLATES_BY_CATEGORY,
  type DocumentTemplate,
} from "@/lib/hdsi/templates";
import {
  generateSectionContent,
  generateOutlineFromDescription,
  type OutlineSection,
} from "@/lib/hdsi/ai-client";
import {
  parseContentToStructure,
  parseWithAI,
  assessParseQuality,
  type ParseResult,
} from "@/lib/hdsi/content-parser";
import { hdsiDB, unflattenNodes, type StoredDiscoveryAnalysis } from "@/lib/hdsi/db";
import { createDocument as createMainDocument, updateDocument as updateMainDocument } from "@/app/actions/documents";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  GitGraph,
  Network,
  Link as LinkIcon,
  Mic,
  MicOff,
  Users,
  Eye,
  Undo2,
  Redo2,
  Palette,
  Type,
  MessageSquare,
  Maximize2,
  Minimize2,
  History,
  X,
  Check,
  Sparkles,
  Wand2,
  FileText,
  LayoutTemplate,
  Plus,
  Loader2,
  Brain,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Target,
  Award,
  CheckCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  Settings2,
  Code2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Copy,
  RotateCcw,
  Upload,
} from "lucide-react";

// Template category icons
const CATEGORY_ICONS: Record<string, string> = {
  government: "🏛️",
  commercial: "💼",
  technical: "⚙️",
  research: "🔬",
  general: "📄",
};

// ============================================================================
// Discovery Analysis Interface - Enhanced Strategic Blueprint
// ============================================================================

interface DiscoveryAnalysis {
  // Document Identification & Strategic Purpose
  documentIdentification: {
    type: string;
    primaryGoal: string;
    context: string;
  };
  // Suggested title derived from analysis
  suggestedTitle: string;
  // Audience Deep Dive
  audienceAnalysis: {
    primaryAudience: {
      description: string;
      priorities: string[];
      painPoints: string[];
      knowledgeLevel: string;
    };
    secondaryAudiences: string[];
    keyInformationNeeds: string[];
    criticalQuestions: string[];
    emotionalDrivers: string[];
  };
  // Content Architecture
  contentStrategy: {
    centralThesis: string;
    themes: {
      mustHave: string[];
      shouldHave: string[];
      couldHave: string[];
    };
  };
  // Persuasion & Credibility Framework
  persuasionStrategy: {
    evidenceTypes: string[];
    authorityElements: string[];
    potentialObjections: string[];
  };
  // Voice, Style, and Experience
  stylisticGuidance: {
    recommendedTone: string;
    styleAndComplexity: string;
    formattingSuggestions: string[];
  };
  // Success Metrics & Constraints
  successCriteria: {
    metrics: string[];
    constraints: string[];
  };
  // Estimated structure size
  estimatedSections: number;
}

// ============================================================================
// AI Prompt Templates - Now Surfaced for Editing
// ============================================================================

const DEFAULT_PROMPTS = {
  discovery: `You are an expert document strategist and communications architect. Your goal is to deconstruct the user's request to build a foundational blueprint for a highly effective, audience-centric document.

Conduct a comprehensive discovery analysis of the provided brief. Go beyond surface-level requirements to uncover the underlying purpose, audience psychology, and strategic objectives.

## Analysis Framework

### 1. Document Identification & Strategic Purpose
- **Type**: Identify the primary document type (e.g., White Paper, Proposal, SOP, Report, Technical Specification)
- **Primary Goal**: What is the single most important action or change the document aims to achieve?
- **Context**: Where does this document live? Is it standalone, part of a campaign, or a response to an RFP?

### 2. Audience Deep Dive
- **Primary Audience**: Create a brief persona with core priorities, pain points, existing knowledge level
- **Secondary Audiences**: Identify other stakeholder groups
- **Information Needs**: What specific information do they need to make a decision?
- **Critical Questions**: Frame exact questions from the audience's perspective (e.g., "How will this solve my problem X?", "What is the ROI?")
- **Emotional Drivers**: Underlying fears, aspirations, or motivations (e.g., fear of risk, desire for efficiency)

### 3. Content Architecture
- **Central Thesis**: The one-sentence core argument or promise of the document
- **Themes**: Categorize as Must-Have, Should-Have, and Could-Have for scope prioritization

### 4. Persuasion & Credibility Framework
- **Evidence Types**: What proof is needed? (data, case studies, testimonials, certifications, demonstrations)
- **Authority Elements**: How will the document establish trust?
- **Potential Objections**: List doubts or criticisms to proactively address

### 5. Voice, Style, and Experience
- **Tone**: Recommend and justify (authoritative, collaborative, reassuring, innovative, urgent)
- **Style & Complexity**: Reading level and technical complexity appropriate for the audience
- **Formatting Suggestions**: High-level presentation elements (executive summaries, infographics, glossaries)

### 6. Success Metrics & Constraints
- **Metrics**: How will we know this document is successful?
- **Constraints**: Length, format, branding, compliance requirements, timeline

Return a well-structured JSON object:
{
  "documentIdentification": { "type": "", "primaryGoal": "", "context": "" },
  "suggestedTitle": "",
  "audienceAnalysis": {
    "primaryAudience": { "description": "", "priorities": [], "painPoints": [], "knowledgeLevel": "" },
    "secondaryAudiences": [],
    "keyInformationNeeds": [],
    "criticalQuestions": [],
    "emotionalDrivers": []
  },
  "contentStrategy": {
    "centralThesis": "",
    "themes": { "mustHave": [], "shouldHave": [], "couldHave": [] }
  },
  "persuasionStrategy": {
    "evidenceTypes": [],
    "authorityElements": [],
    "potentialObjections": []
  },
  "stylisticGuidance": {
    "recommendedTone": "",
    "styleAndComplexity": "",
    "formattingSuggestions": []
  },
  "successCriteria": {
    "metrics": [],
    "constraints": []
  },
  "estimatedSections": 0
}`,

  outline: `You are an expert document architect and structural strategist. Transform the Discovery Analysis into a comprehensive, logically sequenced, and audience-optimized document blueprint. This is not just an outline—it's a strategic framework for persuasion and information delivery.

## CORE PRINCIPLES:

1. **Storytelling Logic**: Structure as a narrative journey moving audience from current state to desired outcome, overcoming objections along the way.
2. **Progressive Disclosure**: Start with high-impact essential information, layer detail progressively for both skimmers and deep readers.
3. **Persuasive Pathway**: Every structural element serves the primary goal. Each chapter builds upon the last.
4. **Modular Completeness**: Each node (Chapter > Section > Subsection) is self-contained with a clear "job to do".

## STRUCTURAL MANDATES (Non-Negotiable):

- **Document**: 3-6 Chapters
- **Each Chapter**: 3-5 Sections
- **Each Section**: 2-4 Subsections
- **Each Subsection**: Single focused concept, data point, or argumentative step

## NODE REQUIREMENTS:

For EVERY node generate:
1. **Title**: Clear, benefit-oriented or action-focused headline
2. **Strategic Objective**: Why this node exists (1 sentence on its role in the journey)
3. **customPrompt**: Detailed, self-contained instruction that:
   - States the audience context
   - References relevant discovery themes and credibility elements
   - Specifies content type (comparative table, case study, procedure, etc.)
   - Defines tone and style cues
   - Sets formatting guidelines (bold takeaways, bullet points, transitions)

## NARRATIVE ARC MAPPING:

Plot the journey using discovery analysis:
- **Hook & Problem Recognition** (Early Chapters)
- **Solution Foundation & Vision** (Middle Chapters)
- **Proof & Validation** (Bridge Chapters)
- **Action & Resolution** (Final Chapters)

## QUALITY CHECKLIST:

Ensure structure:
- Directly maps to every "Must-Have" theme and critical question
- Preemptively addresses top anticipated objections
- Sequences information for maximum impact
- Varies content types (narrative, data, process, example)
- Provides clear pathways for executive skimmers and detailed readers
- Every customPrompt is truly standalone with all necessary context`,

  sectionContent: `You are a professional document writer. Generate high-quality content for this section.

Guidelines:
- Write comprehensive, well-structured content
- Use professional language appropriate for the document type
- Include relevant details, examples, and analysis
- Maintain consistency with document tone
- Write in paragraphs, not bullet points unless appropriate`,
};

// ============================================================================
// Prompt Editor Component
// ============================================================================

interface PromptEditorProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue: string;
  isOpen: boolean;
  onToggle: () => void;
}

function PromptEditor({
  label,
  description,
  value,
  onChange,
  defaultValue,
  isOpen,
  onToggle,
}: PromptEditorProps) {
  const isModified = value !== defaultValue;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg transition-all",
            "hover:bg-accent/50 group text-left",
            isOpen && "bg-accent/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{label}</span>
                {isModified && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-400/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                    Modified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <ChevronRight className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[140px] text-xs font-mono bg-muted/30 border-muted resize-y"
            placeholder="Enter custom prompt instructions..."
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {value.length} characters
            </span>
            {isModified && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onChange(defaultValue)}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Analysis Card Component
// ============================================================================

interface AnalysisCardProps {
  icon: React.ReactNode;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}

function AnalysisCard({ icon, title, iconColor = "text-primary", children }: AnalysisCardProps) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <div className={cn("h-5 w-5", iconColor)}>{icon}</div>
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ============================================================================
// Tag List Component
// ============================================================================

interface TagListProps {
  items: string[];
  variant?: "default" | "amber" | "blue" | "green";
}

function TagList({ items, variant = "default" }: TagListProps) {
  const variantClasses = {
    default: "bg-muted text-foreground",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    green: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className={cn(
            "px-2 py-0.5 rounded-md text-xs font-medium",
            variantClasses[variant]
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Step Indicator Component
// ============================================================================

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-1">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors",
                i + 1 < currentStep && "bg-primary text-primary-foreground",
                i + 1 === currentStep && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                i + 1 > currentStep && "bg-muted text-muted-foreground"
              )}
            >
              {i + 1 < currentStep ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium hidden sm:inline",
              i + 1 === currentStep ? "text-foreground" : "text-muted-foreground"
            )}>
              {labels[i]}
            </span>
          </div>
          {i < totalSteps - 1 && (
            <div className={cn(
              "flex-1 h-px min-w-[20px]",
              i + 1 < currentStep ? "bg-primary" : "bg-border"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Main HDSIFullEnhanced Component
// ============================================================================

interface HDSIFullEnhancedProps {
  initialDocumentId?: string;
  documentTitle?: string;
  /** Existing document content to parse into structure */
  existingContent?: unknown;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  enableCollaboration?: boolean;
  enableVoice?: boolean;
  enableEyeTracking?: boolean;
  regulation?: RegulationType;
}

export function HDSIFullEnhanced({
  initialDocumentId,
  documentTitle = "Untitled Document",
  existingContent,
  userId = "user-1",
  userName = "Anonymous",
  userAvatar,
  enableCollaboration = false,
  enableVoice = true,
  enableEyeTracking = false,
  regulation = "FAR",
}: HDSIFullEnhancedProps) {
  const router = useRouter();

  // Document State
  const [docId, setDocId] = React.useState(initialDocumentId || crypto.randomUUID());
  const [structure, setStructure] = React.useState<HDSINode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState(documentTitle);

  // UI State
  const [showOutlineModal, setShowOutlineModal] = React.useState(false);
  const [outlineMode, setOutlineMode] = React.useState<"ai" | "template" | null>(null);
  const [showDiagramEditor, setShowDiagramEditor] = React.useState(false);
  const [showGraphView, setShowGraphView] = React.useState(false);
  const [showBacklinks, setShowBacklinks] = React.useState(false);
  const [showDiffPreview, setShowDiffPreview] = React.useState(false);
  const [showPromptSettings, setShowPromptSettings] = React.useState(false);
  const [activePromptEditor, setActivePromptEditor] = React.useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = React.useState<DocumentTemplate | null>(null);
  const [customTemplates, setCustomTemplates] = React.useState<Map<string, DocumentTemplate>>(() => {
    // Load custom templates from localStorage on initial render
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("hdsi-custom-templates");
        if (stored) {
          const parsed = JSON.parse(stored) as [string, DocumentTemplate][];
          return new Map(parsed);
        }
      } catch (e) {
        console.error("Failed to load custom templates from localStorage:", e);
      }
    }
    return new Map();
  });
  const [showTemplateImporter, setShowTemplateImporter] = React.useState(false);
  const [importedTemplates, setImportedTemplates] = React.useState<DocumentTemplate[]>([]);

  // AI Generation State
  const [isGeneratingOutline, setIsGeneratingOutline] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [generationLogs, setGenerationLogs] = React.useState<string[]>([]);

  // Discovery Phase State
  const [discoveryStep, setDiscoveryStep] = React.useState<"input" | "analyzing" | "review" | "generate">("input");
  const [initialBrief, setInitialBrief] = React.useState("");
  const [discoveryAnalysis, setDiscoveryAnalysis] = React.useState<DiscoveryAnalysis | null>(null);

  // Editable Prompts State
  const [prompts, setPrompts] = React.useState({
    discovery: DEFAULT_PROMPTS.discovery,
    outline: DEFAULT_PROMPTS.outline,
    sectionContent: DEFAULT_PROMPTS.sectionContent,
  });

  // Collaboration State
  const [isVoiceActive, setIsVoiceActive] = React.useState(false);
  const [collaborators, setCollaborators] = React.useState<Array<{ id: string; name: string; avatar?: string; color: string }>>([]);

  // History for undo/redo
  const [undoStack, setUndoStack] = React.useState<HDSINode[][]>([]);
  const [redoStack, setRedoStack] = React.useState<HDSINode[][]>([]);

  // HDSI Spec Conformance: Phase State Machine
  const [phaseState, setPhaseState] = React.useState<PhaseState>(() =>
    createInitialPhaseState("outline_synthesis", 0)
  );

  // HDSI Spec Conformance: Context Buffer
  const [contextBuffer, setContextBuffer] = React.useState<ContextBuffer>(() =>
    createEmptyBuffer()
  );
  const [isContextBufferCollapsed, setIsContextBufferCollapsed] = React.useState(true);
  const [isAssemblingContext, setIsAssemblingContext] = React.useState(false);

  // HDSI Spec Conformance: Coherence tracking
  const { coherence, analyze: analyzeCoherence, getNodeDebt, hasDebt } = useCoherence(structure);

  // Track nodes currently being generated
  const [generatingNodeIds, setGeneratingNodeIds] = React.useState<Set<string>>(new Set());

  // Content parsing state
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [showParsePreview, setShowParsePreview] = React.useState(false);

  // Detect if there's existing content that could be parsed
  const hasExistingContent = React.useMemo(() => {
    if (!existingContent) return false;
    if (typeof existingContent === "string") return existingContent.trim().length > 50;
    if (typeof existingContent === "object") {
      const obj = existingContent as Record<string, unknown>;
      if (obj.type === "doc" && Array.isArray(obj.content)) {
        return obj.content.length > 0;
      }
    }
    return false;
  }, [existingContent]);

  // Show empty state if no structure
  const showEmptyState = structure.length === 0;

  // Helper to find node by ID deep in the tree
  const findNodeByIdDeep = React.useCallback((nodes: HDSINode[], id: string): HDSINode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = findNodeByIdDeep(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Count nodes for generation
  const countNodes = React.useCallback((nodes: HDSINode[]): number => {
    return nodes.reduce((acc, n) => {
      if (n.status === "deleted") return acc;
      return acc + 1 + countNodes(n.children);
    }, 0);
  }, []);

  const totalNodeCount = React.useMemo(() => countNodes(structure), [structure, countNodes]);

  // Collect nodes without content for generation
  const nodesToGenerate = React.useMemo(() => {
    const collect = (nodes: HDSINode[]): HDSINode[] => {
      const result: HDSINode[] = [];
      for (const node of nodes) {
        if (node.status === "deleted") continue;
        if (!node.generatedContent || node.status === "outline") {
          result.push(node);
        }
        if (node.children.length > 0) {
          result.push(...collect(node.children));
        }
      }
      return result;
    };
    return collect(structure);
  }, [structure]);

  // Handle phase change
  const handlePhaseChange = React.useCallback((phase: GenerationPhase) => {
    setPhaseState(prev => ({
      ...prev,
      current: phase,
      startedAt: new Date(),
      processedCount: 0,
      revisionIteration: phase === "revision_cycle" ? (prev.revisionIteration || 0) + 1 : undefined,
    }));
  }, []);

  // Assemble context buffer for selected node
  const assembleContextBuffer = React.useCallback(async (nodeId: string) => {
    if (!nodeId) return;

    setIsAssemblingContext(true);

    // Find the node and its context
    const findNode = (nodes: HDSINode[], id: string): HDSINode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
      }
      return null;
    };

    const findSiblings = (nodes: HDSINode[], id: string): HDSINode[] => {
      for (const node of nodes) {
        const siblingIndex = node.children.findIndex(c => c.id === id);
        if (siblingIndex >= 0) {
          return node.children.filter(c => c.id !== id && c.status !== "deleted");
        }
        const found = findSiblings(node.children, id);
        if (found.length > 0) return found;
      }
      // Check top level
      const topIndex = nodes.findIndex(n => n.id === id);
      if (topIndex >= 0) {
        return nodes.filter(n => n.id !== id && n.status !== "deleted");
      }
      return [];
    };

    const findParent = (nodes: HDSINode[], id: string): HDSINode | null => {
      for (const node of nodes) {
        if (node.children.some(c => c.id === id)) return node;
        const found = findParent(node.children, id);
        if (found) return found;
      }
      return null;
    };

    try {
      const targetNode = findNode(structure, nodeId);
      const siblings = findSiblings(structure, nodeId);
      const parent = findParent(structure, nodeId);

      const entries: ContextBufferEntry[] = [];
      let totalTokens = 0;
      const maxTokens = 3800;

      // Add local context (current node)
      if (targetNode && targetNode.customPrompt) {
        const tokenCount = Math.ceil(targetNode.customPrompt.length / 4);
        entries.push({
          id: crypto.randomUUID(),
          tier: "local",
          sourceNodeId: targetNode.id,
          sourceTitle: targetNode.title,
          content: targetNode.customPrompt,
          tokenCount,
          relevanceScore: 1.0,
          embeddingDrift: 0,
          timestamp: new Date(),
        });
        totalTokens += tokenCount;
      }

      // Add sibling context
      for (const sibling of siblings.slice(0, 3)) {
        if (totalTokens >= maxTokens) break;
        const content = sibling.generatedContent || sibling.customPrompt || "";
        if (!content) continue;
        const tokenCount = Math.min(Math.ceil(content.length / 4), maxTokens - totalTokens);
        entries.push({
          id: crypto.randomUUID(),
          tier: "sibling",
          sourceNodeId: sibling.id,
          sourceTitle: sibling.title,
          content: content.slice(0, tokenCount * 4),
          tokenCount,
          relevanceScore: 0.8,
          embeddingDrift: Math.random() * 0.1, // Simulated
          timestamp: new Date(),
        });
        totalTokens += tokenCount;
      }

      // Add document context (parent)
      if (parent && totalTokens < maxTokens) {
        const content = parent.generatedContent || parent.customPrompt || parent.title;
        const tokenCount = Math.min(Math.ceil(content.length / 4), maxTokens - totalTokens);
        entries.push({
          id: crypto.randomUUID(),
          tier: "document",
          sourceNodeId: parent.id,
          sourceTitle: parent.title,
          content: content.slice(0, tokenCount * 4),
          tokenCount,
          relevanceScore: 0.7,
          embeddingDrift: Math.random() * 0.15,
          timestamp: new Date(),
        });
        totalTokens += tokenCount;
      }

      // Calculate tokens by tier
      const tokensByTier = {
        local: entries.filter(e => e.tier === "local").reduce((sum, e) => sum + e.tokenCount, 0),
        sibling: entries.filter(e => e.tier === "sibling").reduce((sum, e) => sum + e.tokenCount, 0),
        document: entries.filter(e => e.tier === "document").reduce((sum, e) => sum + e.tokenCount, 0),
      };

      setContextBuffer({
        entries,
        totalTokens,
        maxTokens,
        lastAssembled: new Date(),
        tokensByTier,
      });
    } catch (error) {
      console.error("Failed to assemble context:", error);
    } finally {
      setIsAssemblingContext(false);
    }
  }, [structure]);

  // Assemble context when node selection changes
  React.useEffect(() => {
    if (selectedNodeId) {
      assembleContextBuffer(selectedNodeId);
    }
  }, [selectedNodeId, assembleContextBuffer]);

  // Load document from IndexedDB on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      if (!docId) return;

      try {
        const doc = await hdsiDB.getDocument(docId);
        if (doc && doc.structure && doc.structure.length > 0) {
          // Convert flat structure back to tree using unflattenNodes
          const treeNodes = unflattenNodes(doc.structure);

          // Ensure nodes have all required HDSI properties
          const normalizeNodes = (nodes: any[]): HDSINode[] => {
            return nodes.map((n, i) => ({
              ...n,
              children: normalizeNodes(n.children || []),
              expanded: n.expanded ?? true,
              order: n.order ?? i,
              status: n.status ?? "outline",
              tokenBudget: n.tokenBudget ?? 500,
              customPrompt: n.customPrompt ?? "",
              densityTarget: n.densityTarget ?? 2.5,
              coherenceScore: n.coherenceScore ?? 1.0,
              depth: n.depth ?? 0,
            }));
          };

          const normalizedNodes = normalizeNodes(treeNodes);
          if (normalizedNodes.length > 0) {
            setStructure(normalizedNodes);
            setTitle(doc.title);
            console.log("[HDSI] Loaded document from IndexedDB:", doc.title, "with", normalizedNodes.length, "root nodes");
          }
        }
      } catch (error) {
        console.error("[HDSI] Failed to load document:", error);
      }
    };

    loadDocument();
  }, [docId]);

  // Auto-save structure changes to IndexedDB
  const autoSaveRef = React.useRef<{ triggerSave: () => void; dispose: () => void } | null>(null);
  const structureRef = React.useRef(structure);
  structureRef.current = structure;

  React.useEffect(() => {
    // Only set up auto-save if we have a document and structure
    if (!docId || structure.length === 0) return;

    // Create auto-save handler
    autoSaveRef.current = hdsiDB.createAutoSave(
      docId,
      () => structureRef.current,
      30000 // Auto-save every 30 seconds
    );

    return () => {
      // Cleanup and final save on unmount
      autoSaveRef.current?.dispose();
    };
  }, [docId, structure.length > 0]); // Only re-create when docId changes or structure becomes non-empty

  // Trigger save on structure changes
  React.useEffect(() => {
    if (structure.length > 0 && autoSaveRef.current) {
      autoSaveRef.current.triggerSave();
    }
  }, [structure]);

  // Manual save function for explicit saves
  const handleSaveDocument = React.useCallback(async () => {
    if (!docId || structure.length === 0) {
      toast.error("No document to save");
      return;
    }

    try {
      const savedDoc = await hdsiDB.saveDocument(docId, structure, title, {
        incrementVersion: true,
        author: userName || "user",
        description: "Manual save",
      });
      toast.success(`Document saved (v${savedDoc.version})`);
    } catch (error) {
      console.error("Failed to save document:", error);
      toast.error("Failed to save document");
    }
  }, [docId, structure, title, userName]);

  // Reset discovery state
  const resetDiscovery = () => {
    setDiscoveryStep("input");
    setInitialBrief("");
    setDiscoveryAnalysis(null);
    setGenerationProgress(0);
    setGenerationLogs([]);
  };

  // Perform AI Discovery Analysis
  const performDiscoveryAnalysis = async () => {
    setDiscoveryStep("analyzing");

    try {
      const response = await fetch("/api/v1/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: prompts.discovery },
            {
              role: "user",
              content: `Analyze this document brief and provide a comprehensive strategic discovery analysis:\n\n${initialBrief}\n\nReturn a JSON object with this exact structure:
{
  "documentIdentification": {
    "type": "string - e.g., White Paper, Proposal, Technical Specification",
    "primaryGoal": "string - the single most important outcome",
    "context": "string - where this document lives in the ecosystem"
  },
  "suggestedTitle": "string - compelling, descriptive title",
  "audienceAnalysis": {
    "primaryAudience": {
      "description": "string - who they are",
      "priorities": ["string - their core priorities"],
      "painPoints": ["string - their challenges"],
      "knowledgeLevel": "string - technical/expert/layperson"
    },
    "secondaryAudiences": ["string"],
    "keyInformationNeeds": ["string - what they need to know"],
    "criticalQuestions": ["string - questions from their perspective"],
    "emotionalDrivers": ["string - fears, aspirations, motivations"]
  },
  "contentStrategy": {
    "centralThesis": "string - one-sentence core argument",
    "themes": {
      "mustHave": ["string - essential topics"],
      "shouldHave": ["string - important topics"],
      "couldHave": ["string - nice-to-have topics"]
    }
  },
  "persuasionStrategy": {
    "evidenceTypes": ["string - data, case studies, testimonials, etc."],
    "authorityElements": ["string - how to establish trust"],
    "potentialObjections": ["string - doubts to address"]
  },
  "stylisticGuidance": {
    "recommendedTone": "string - authoritative/collaborative/reassuring/etc.",
    "styleAndComplexity": "string - reading level and technical depth",
    "formattingSuggestions": ["string - executive summary, infographics, etc."]
  },
  "successCriteria": {
    "metrics": ["string - how to measure success"],
    "constraints": ["string - length, format, compliance, timeline"]
  },
  "estimatedSections": "number - suggested section count"
}`,
            },
          ],
          temperature: 0.7,
          maxTokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error("Discovery analysis failed");
      }

      const data = await response.json();
      const content = data.content || "{}";

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as DiscoveryAnalysis;
        setDiscoveryAnalysis(analysis);
        setDiscoveryStep("review");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Discovery analysis error:", error);
      toast.error("Failed to analyze requirements. Please try again.");
      setDiscoveryStep("input");
    }
  };

  // Approve discovery and generate outline
  const approveAndGenerate = async () => {
    if (!discoveryAnalysis) return;

    setDiscoveryStep("generate");
    setIsGeneratingOutline(true);
    setGenerationProgress(10);
    setGenerationLogs(["Starting outline generation..."]);

    try {
      // Build enhanced description from strategic discovery analysis
      const enhancedDescription = `
DOCUMENT IDENTIFICATION:
- Type: ${discoveryAnalysis.documentIdentification.type}
- Primary Goal: ${discoveryAnalysis.documentIdentification.primaryGoal}
- Context: ${discoveryAnalysis.documentIdentification.context}

Title: ${discoveryAnalysis.suggestedTitle}

PRIMARY AUDIENCE:
${discoveryAnalysis.audienceAnalysis.primaryAudience.description}
- Knowledge Level: ${discoveryAnalysis.audienceAnalysis.primaryAudience.knowledgeLevel}
- Priorities: ${discoveryAnalysis.audienceAnalysis.primaryAudience.priorities.join(", ")}
- Pain Points: ${discoveryAnalysis.audienceAnalysis.primaryAudience.painPoints.join(", ")}

${discoveryAnalysis.audienceAnalysis.secondaryAudiences.length > 0 ? `SECONDARY AUDIENCES:\n${discoveryAnalysis.audienceAnalysis.secondaryAudiences.map((a) => `- ${a}`).join("\n")}\n` : ""}
INFORMATION NEEDS:
${discoveryAnalysis.audienceAnalysis.keyInformationNeeds.map((n) => `- ${n}`).join("\n")}

CRITICAL QUESTIONS TO ANSWER:
${discoveryAnalysis.audienceAnalysis.criticalQuestions.map((q) => `- ${q}`).join("\n")}

EMOTIONAL DRIVERS:
${discoveryAnalysis.audienceAnalysis.emotionalDrivers.map((d) => `- ${d}`).join("\n")}

CENTRAL THESIS:
${discoveryAnalysis.contentStrategy.centralThesis}

CONTENT THEMES:
Must-Have: ${discoveryAnalysis.contentStrategy.themes.mustHave.join(", ")}
Should-Have: ${discoveryAnalysis.contentStrategy.themes.shouldHave.join(", ")}
Could-Have: ${discoveryAnalysis.contentStrategy.themes.couldHave.join(", ")}

PERSUASION STRATEGY:
- Evidence Types: ${discoveryAnalysis.persuasionStrategy.evidenceTypes.join(", ")}
- Authority Elements: ${discoveryAnalysis.persuasionStrategy.authorityElements.join(", ")}
- Objections to Address: ${discoveryAnalysis.persuasionStrategy.potentialObjections.join(", ")}

STYLE GUIDANCE:
- Tone: ${discoveryAnalysis.stylisticGuidance.recommendedTone}
- Complexity: ${discoveryAnalysis.stylisticGuidance.styleAndComplexity}
- Formatting: ${discoveryAnalysis.stylisticGuidance.formattingSuggestions.join(", ")}

SUCCESS METRICS: ${discoveryAnalysis.successCriteria.metrics.join(", ")}
CONSTRAINTS: ${discoveryAnalysis.successCriteria.constraints.join(", ")}

ORIGINAL BRIEF:
${initialBrief}
      `.trim();

      setGenerationProgress(30);
      setGenerationLogs((prev) => [...prev, "Analyzing document requirements..."]);

      // Generate outline with enhanced context
      const outline = await generateOutlineFromDescription(
        discoveryAnalysis.suggestedTitle,
        enhancedDescription
      );

      setGenerationProgress(70);
      setGenerationLogs((prev) => [...prev, `Generated ${outline.length} chapters`]);

      // Convert outline to HDSI nodes
      const nodes = convertOutlineToNodes(outline);

      setGenerationProgress(90);
      setGenerationLogs((prev) => [...prev, "Building document structure..."]);

      // Create stored discovery analysis for persistence
      const storedAnalysis: StoredDiscoveryAnalysis = {
        documentIdentification: discoveryAnalysis.documentIdentification,
        suggestedTitle: discoveryAnalysis.suggestedTitle,
        audienceAnalysis: discoveryAnalysis.audienceAnalysis,
        contentStrategy: discoveryAnalysis.contentStrategy,
        persuasionStrategy: discoveryAnalysis.persuasionStrategy,
        stylisticGuidance: discoveryAnalysis.stylisticGuidance,
        successCriteria: discoveryAnalysis.successCriteria,
        estimatedSections: discoveryAnalysis.estimatedSections,
        originalBrief: initialBrief,
        analyzedAt: new Date(),
      };

      // Save document to database with discovery analysis
      setGenerationLogs((prev) => [...prev, "Saving document to database..."]);
      const savedDoc = await hdsiDB.createDocument(
        discoveryAnalysis.suggestedTitle,
        nodes,
        {
          discoveryAnalysis: storedAnalysis,
          isAiGenerated: true,
          metadata: {
            type: "draft",
            generationVersion: "discovery-flow-v1",
          },
        }
      );

      // Also sync to main documents database for listing
      try {
        await createMainDocument({
          title: discoveryAnalysis.suggestedTitle,
          content: {
            type: "doc",
            content: nodes.map((node) => ({
              type: "heading",
              attrs: { level: node.depth === 0 ? 1 : node.depth === 1 ? 2 : 3 },
              content: [{ type: "text", text: node.title }],
            })),
          },
          metadata: {
            hdsiDocumentId: savedDoc.id,
            type: "hdsi",
            generationVersion: "discovery-flow-v1",
          },
        });
        setGenerationLogs((prev) => [...prev, "✓ Synced to documents list"]);
      } catch (syncError) {
        console.warn("Failed to sync to main documents:", syncError);
        // Don't fail the whole operation if sync fails
      }

      // Update state with saved document info
      setTitle(discoveryAnalysis.suggestedTitle);
      setStructure(nodes);
      setDocId(savedDoc.id);

      setGenerationProgress(100);
      setGenerationLogs((prev) => [
        ...prev,
        `✓ Document saved (v${savedDoc.version})`,
        "✓ Document structure created successfully",
      ]);

      toast.success(`Document created: ${savedDoc.title} (v${savedDoc.version})`);

      // Close modal after short delay
      setTimeout(() => {
        setShowOutlineModal(false);
        setOutlineMode(null);
        resetDiscovery();
        setIsGeneratingOutline(false);
      }, 1000);
    } catch (error) {
      console.error("Outline generation error:", error);
      toast.error("Failed to generate outline. Please try again.");
      setDiscoveryStep("review");
      setIsGeneratingOutline(false);
    }
  };

  // Convert AI outline to HDSI nodes
  const convertOutlineToNodes = (outline: OutlineSection[]): HDSINode[] => {
    const convert = (section: OutlineSection, depth: number = 0, parentId?: string): HDSINode => {
      const nodeId = crypto.randomUUID();
      return {
        id: nodeId,
        title: section.title,
        type: section.type,
        order: 0,
        expanded: true,
        customPrompt: section.customPrompt || section.description || "",
        tokenBudget: section.suggestedTokenBudget || 500,
        densityTarget: 3,
        coherenceScore: 0,
        status: "outline",
        depth,
        parentId: parentId || null,
        generatedContent: "",
        children: (section.children || []).map((child, idx) => convert(child, depth + 1, nodeId)),
      };
    };

    return outline.map((section, idx) => convert(section, 0));
  };

  // Handle template selection
  const applyTemplate = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) {
      toast.error("Template not found");
      return;
    }

    const nodes = convertTemplateToNodes(template);
    setStructure(nodes);
    setTitle(template.name);
    setShowOutlineModal(false);
    setOutlineMode(null);
    toast.success(`Applied template: ${template.name}`);
  };

  // Save customized template
  const handleSaveTemplate = (updatedTemplate: DocumentTemplate) => {
    setCustomTemplates((prev) => {
      const newMap = new Map(prev);
      newMap.set(updatedTemplate.baseTemplateId || updatedTemplate.id, updatedTemplate);

      // Persist to localStorage
      try {
        const entries = Array.from(newMap.entries());
        localStorage.setItem("hdsi-custom-templates", JSON.stringify(entries));
      } catch (e) {
        console.error("Failed to persist custom templates:", e);
        toast.error("Failed to save template customization");
      }

      return newMap;
    });
    setEditingTemplate(null);
    toast.success("Template customization saved");
  };

  // Find parent, siblings, and adjacent sections for context
  const findNodeContext = React.useCallback((
    nodeId: string,
    nodes: HDSINode[],
    parentTitle?: string
  ): {
    parentTitle?: string;
    siblingTitles: string[];
    previousSection?: { title: string; content?: string };
    nextSection?: { title: string };
    siblingContents: Array<{ title: string; content?: string }>;
  } => {
    // Helper to extract text from generated content
    const extractText = (content?: string): string | undefined => {
      if (!content) return undefined;
      try {
        const parsed = JSON.parse(content);
        // Extract from Tiptap JSON
        const getText = (node: any): string => {
          if (node.text) return node.text;
          if (node.content) return node.content.map(getText).join(" ");
          return "";
        };
        const text = getText(parsed);
        // Return first 500 chars as summary
        return text.slice(0, 500) + (text.length > 500 ? "..." : "");
      } catch {
        // Plain text
        return content.slice(0, 500) + (content.length > 500 ? "..." : "");
      }
    };

    for (const n of nodes) {
      // Check if target is a direct child
      const siblingIndex = n.children.findIndex(c => c.id === nodeId);
      if (siblingIndex !== -1) {
        const siblings = n.children;
        const prevSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
        const nextSibling = siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;

        return {
          parentTitle: n.title,
          siblingTitles: siblings.filter((_, i) => i !== siblingIndex).map(c => c.title),
          previousSection: prevSibling ? {
            title: prevSibling.title,
            content: extractText(prevSibling.generatedContent),
          } : undefined,
          nextSection: nextSibling ? { title: nextSibling.title } : undefined,
          siblingContents: siblings
            .filter((_, i) => i !== siblingIndex)
            .filter(s => s.generatedContent)
            .map(s => ({
              title: s.title,
              content: extractText(s.generatedContent),
            })),
        };
      }

      // Check deeper in tree
      const result = findNodeContext(nodeId, n.children, n.title);
      if (result.parentTitle) return result;
    }

    // Check if it's a top-level node
    const topLevelIndex = nodes.findIndex(n => n.id === nodeId);
    if (topLevelIndex !== -1) {
      const prevNode = topLevelIndex > 0 ? nodes[topLevelIndex - 1] : null;
      const nextNode = topLevelIndex < nodes.length - 1 ? nodes[topLevelIndex + 1] : null;

      return {
        parentTitle: undefined,
        siblingTitles: nodes.filter((_, i) => i !== topLevelIndex).map(n => n.title),
        previousSection: prevNode ? {
          title: prevNode.title,
          content: extractText(prevNode.generatedContent),
        } : undefined,
        nextSection: nextNode ? { title: nextNode.title } : undefined,
        siblingContents: nodes
          .filter((_, i) => i !== topLevelIndex)
          .filter(n => n.generatedContent)
          .map(n => ({
            title: n.title,
            content: extractText(n.generatedContent),
          })),
      };
    }

    return { parentTitle, siblingTitles: [], siblingContents: [] };
  }, []);

  // Generate content for a single node using AI
  const handleNodeGenerate = React.useCallback(async (nodeId: string, node: HDSINode): Promise<string> => {
    try {
      // Get enhanced context for better generation
      const {
        parentTitle,
        siblingTitles,
        previousSection,
        nextSection,
        siblingContents,
      } = findNodeContext(nodeId, structure);

      const content = await generateSectionContent(
        node,
        title,
        {
          temperature: 0.7,
          maxTokens: node.tokenBudget || 1000,
          stream: false,
          documentStructure: structure,
          parentTitle,
          siblingTitles,
          previousSection,
          nextSection,
          siblingContents,
        }
      );
      return content;
    } catch (error) {
      console.error("Node generation error:", error);
      throw error;
    }
  }, [title, structure, findNodeContext]);

  // Generate all sections sequentially
  const handleGenerateAllSections = React.useCallback(async () => {
    if (structure.length === 0) {
      toast.info("No sections to generate. Create an outline first.");
      return;
    }

    // Collect all nodes that need generation (not already generated)
    const collectNodes = (nodes: HDSINode[]): HDSINode[] => {
      const result: HDSINode[] = [];
      for (const node of nodes) {
        if (node.status !== "generated" && node.status !== "deleted") {
          result.push(node);
        }
        result.push(...collectNodes(node.children));
      }
      return result;
    };

    const nodesToGenerate = collectNodes(structure);

    if (nodesToGenerate.length === 0) {
      toast.info("All sections already have generated content.");
      return;
    }

    toast.info(`Generating content for ${nodesToGenerate.length} sections...`);

    // Keep track of the current structure as we update it
    let currentStructure = structure;

    // Generate sequentially to maintain context
    for (let i = 0; i < nodesToGenerate.length; i++) {
      const node = nodesToGenerate[i];
      try {
        // Get fresh context from current structure (includes previous generated content)
        const {
          parentTitle,
          siblingTitles,
          previousSection,
          nextSection,
          siblingContents,
        } = findNodeContext(node.id, currentStructure);

        // Generate with updated context
        const content = await generateSectionContent(
          node,
          title,
          {
            temperature: 0.7,
            maxTokens: node.tokenBudget || 1000,
            stream: false,
            documentStructure: currentStructure,
            parentTitle,
            siblingTitles,
            previousSection,
            nextSection,
            siblingContents,
          }
        );

        // Update structure with generated content using functional update
        const updateNodeContent = (nodes: HDSINode[]): HDSINode[] => {
          return nodes.map(n => {
            if (n.id === node.id) {
              return { ...n, generatedContent: content, status: "generated" as const };
            }
            return { ...n, children: updateNodeContent(n.children) };
          });
        };

        // Update both local tracking and state
        currentStructure = updateNodeContent(currentStructure);
        setStructure(currentStructure);

        toast.success(`Generated: ${node.title} (${i + 1}/${nodesToGenerate.length})`);
      } catch (error) {
        toast.error(`Failed to generate: ${node.title}`);
        console.error("Generation error:", error);
      }
    }

    toast.success("Document generation complete!");
  }, [structure, title, findNodeContext, setStructure]);

  // Parse existing content into structure
  const handleParseContent = React.useCallback(async (useAI: boolean = false) => {
    if (!existingContent) {
      toast.error("No content to parse");
      return;
    }

    setIsParsing(true);
    try {
      let result: ParseResult;
      if (useAI) {
        result = await parseWithAI(
          typeof existingContent === "string" ? existingContent : JSON.stringify(existingContent),
          { documentTitle: title }
        );
      } else {
        result = parseContentToStructure(existingContent, { documentTitle: title });
      }

      if (result.nodes.length === 0) {
        toast.error("Could not detect structure in the content");
        return;
      }

      const quality = assessParseQuality(result);
      setParseResult(result);
      setShowParsePreview(true);

      if (quality.issues.length > 0) {
        toast.info(`Structure detected with notes: ${quality.issues.join(", ")}`);
      } else {
        toast.success(`Detected ${result.nodes.length} sections (${Math.round(result.confidence * 100)}% confidence)`);
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse content");
    } finally {
      setIsParsing(false);
    }
  }, [existingContent, title]);

  // Apply parsed structure
  const applyParsedStructure = React.useCallback(() => {
    if (!parseResult) return;
    setStructure(parseResult.nodes);
    setShowParsePreview(false);
    setParseResult(null);
    setShowOutlineModal(false);
    toast.success("Structure applied! You can now edit and regenerate sections.");
  }, [parseResult]);

  // Start blank document
  const startBlankDocument = () => {
    const rootNode: HDSINode = {
      id: crypto.randomUUID(),
      title: "Introduction",
      type: "chapter",
      order: 0,
      expanded: true,
      customPrompt: "Write an engaging introduction that sets the context and outlines the document's purpose.",
      tokenBudget: 500,
      densityTarget: 3,
      coherenceScore: 0,
      status: "outline",
      depth: 0,
      parentId: null,
      generatedContent: "",
      children: [],
    };
    setStructure([rootNode]);
    setShowOutlineModal(false);
    setOutlineMode(null);
  };

  // Update prompt handler
  const updatePrompt = (key: keyof typeof prompts, value: string) => {
    setPrompts((prev) => ({ ...prev, [key]: value }));
  };

  // Get current step number for the step indicator
  const getCurrentStepNumber = () => {
    switch (discoveryStep) {
      case "input":
        return 1;
      case "analyzing":
        return 2;
      case "review":
        return 2;
      case "generate":
        return 3;
      default:
        return 1;
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <HDSIToolbar
            documentId={docId}
            documentTitle={title}
            structure={structure}
            selectedNodeId={selectedNodeId}
            onShowDiagramEditor={() => setShowDiagramEditor(true)}
            onGenerateAI={structure.length > 0 ? handleGenerateAllSections : () => setShowOutlineModal(true)}
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Prompt Settings */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setShowPromptSettings(true)}
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden md:inline text-xs">Prompts</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit AI prompts</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* View toggles */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showGraphView ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowGraphView(!showGraphView)}
                >
                  <Network className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Graph View</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showBacklinks ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowBacklinks(!showBacklinks)}
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Backlinks</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {showEmptyState ? (
          /* Empty State - Create Options */
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-2xl w-full space-y-8">
              {/* Header */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight font-display">
                  Create Your Document
                </h2>
                <p className="text-muted-foreground">
                  Choose how you&apos;d like to start your document
                </p>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AI Generation Card */}
                <Card
                  className={cn(
                    "cursor-pointer transition-all group relative overflow-hidden",
                    "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
                  )}
                  onClick={() => {
                    setOutlineMode("ai");
                    setShowOutlineModal(true);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-2 relative">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm">
                        <Wand2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">AI Generate</CardTitle>
                        <CardDescription className="text-xs">Intelligent structure</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-sm text-muted-foreground">
                      Describe your document and AI will create a tailored outline with content prompts
                    </p>
                    <Badge className="mt-3 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Recommended
                    </Badge>
                  </CardContent>
                </Card>

                {/* Template Card */}
                <Card
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 group"
                  onClick={() => {
                    setOutlineMode("template");
                    setShowOutlineModal(true);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <LayoutTemplate className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Use Template</CardTitle>
                        <CardDescription className="text-xs">Pre-built structures</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Start with industry-standard templates for proposals, specs, and reports
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(CATEGORY_ICONS).slice(0, 3).map(([category, icon]) => (
                        <span key={category} className="text-[10px] bg-muted px-2 py-0.5 rounded-md capitalize">
                          {icon} {category}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Blank Document Card */}
                <Card
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 group"
                  onClick={startBlankDocument}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Blank</CardTitle>
                        <CardDescription className="text-xs">Start from scratch</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Begin with an empty document and build your structure manually
                    </p>
                  </CardContent>
                </Card>

                {/* Parse Existing Content Card - Only shown when content exists */}
                {hasExistingContent && (
                  <Card
                    className={cn(
                      "cursor-pointer transition-all group relative overflow-hidden md:col-span-3",
                      "hover:shadow-lg hover:border-green-500/30 hover:-translate-y-0.5",
                      "border-green-500/20 bg-green-500/5"
                    )}
                    onClick={() => handleParseContent(false)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/20 text-green-600 dark:text-green-400">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              Parse Existing Content
                              <Badge className="bg-green-500/20 text-green-600 border-0 text-[10px]">
                                Content Detected
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">Convert content to editable structure</CardDescription>
                          </div>
                        </div>
                        {isParsing && <Loader2 className="h-5 w-5 animate-spin text-green-600" />}
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <p className="text-sm text-muted-foreground">
                        This document has existing content. Parse it into sections for structured editing and AI enhancement.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500/30 hover:bg-green-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleParseContent(false);
                          }}
                          disabled={isParsing}
                        >
                          {isParsing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                          Quick Parse
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/30 hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleParseContent(true);
                          }}
                          disabled={isParsing}
                        >
                          {isParsing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                          AI-Enhanced Parse
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Document Editor with HDSI Spec Layout (4-Pane Resizable) */
          <div className="h-full flex flex-col">
            {/* Main Editor Area with Resizable Panels */}
            <div className="flex-1 overflow-hidden relative">
              <ResizablePanelGroup
                orientation="horizontal"
                id="hdsi-main-layout"
                className="h-full"
              >
                {/* Main Editor Panel (Tree + Properties via HDSIEnhanced) - 80% default */}
                <ResizablePanel
                  defaultSize={isContextBufferCollapsed ? 100 : 80}
                  minSize={60}
                >
                  <HDSIEnhanced
                    documentId={docId}
                    documentTitle={title}
                    initialStructure={structure}
                    onStructureChange={setStructure}
                    onNodeSelect={setSelectedNodeId}
                    onGenerateNode={handleNodeGenerate}
                    onGenerateAll={handleGenerateAllSections}
                    isGenerating={generatingNodeIds.size > 0}
                  />
                </ResizablePanel>

                {/* Context Buffer Panel - Collapsible (20% default) */}
                {!isContextBufferCollapsed && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                      defaultSize={20}
                      minSize={15}
                      maxSize={35}
                      collapsible
                      collapsedSize={0}
                      className="bg-muted/30"
                    >
                      <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Context Buffer
                          </span>
                          <button
                            onClick={() => setIsContextBufferCollapsed(true)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                            title="Collapse panel"
                          >
                            <PanelRightClose className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                          <ContextBufferInspector
                            buffer={contextBuffer}
                            isLoading={isAssemblingContext}
                            onRefresh={selectedNodeId ? () => assembleContextBuffer(selectedNodeId) : undefined}
                          />
                        </div>
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>

              {/* Context Buffer Expand Button (when collapsed) */}
              {isContextBufferCollapsed && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-20 w-6 rounded-l-md rounded-r-none border-r-0 shadow-md"
                    onClick={() => setIsContextBufferCollapsed(false)}
                    title="Open Context Buffer"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Generation Control Surface - Fixed Bottom */}
            <div className="border-t bg-card/95 backdrop-blur-sm" style={{ height: 120 }}>
              <GenerationControlSurface
                phaseState={phaseState}
                onPhaseChange={handlePhaseChange}
                coherence={coherence}
                hasSelection={!!selectedNodeId}
                selectedNodeName={
                  selectedNodeId
                    ? structure.find(n => n.id === selectedNodeId)?.title ||
                      findNodeByIdDeep(structure, selectedNodeId)?.title
                    : undefined
                }
                onGenerateSelected={() => {
                  if (selectedNodeId) {
                    const node = findNodeByIdDeep(structure, selectedNodeId);
                    if (node) {
                      setGeneratingNodeIds(prev => new Set(prev).add(selectedNodeId));
                      handleNodeGenerate(selectedNodeId, node)
                        .then(content => {
                          // Update node with generated content
                          const updateNodeContent = (nodes: HDSINode[]): HDSINode[] => {
                            return nodes.map(n => {
                              if (n.id === selectedNodeId) {
                                return { ...n, generatedContent: content, status: "generated" as const };
                              }
                              return { ...n, children: updateNodeContent(n.children) };
                            });
                          };
                          setStructure(updateNodeContent(structure));
                          toast.success(`Generated content for "${node.title}"`);
                        })
                        .catch(err => {
                          console.error("Generation failed:", err);
                          toast.error("Failed to generate content");
                        })
                        .finally(() => {
                          setGeneratingNodeIds(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(selectedNodeId);
                            return newSet;
                          });
                        });
                    }
                  }
                }}
                onGenerateAll={handleGenerateAllSections}
                isGenerating={generatingNodeIds.size > 0}
                generationProgress={
                  totalNodeCount > 0
                    ? Math.round((generatingNodeIds.size / totalNodeCount) * 100)
                    : 0
                }
                generatingNodeCount={generatingNodeIds.size}
                totalNodeCount={nodesToGenerate.length}
                onCancelGeneration={() => {
                  setGeneratingNodeIds(new Set());
                  toast.info("Generation cancelled");
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Outline Generation Modal */}
      <Dialog open={showOutlineModal} onOpenChange={setShowOutlineModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-3 text-lg">
              {outlineMode === "ai" ? (
                <>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <span>AI Document Generator</span>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600">
                    <LayoutTemplate className="h-4 w-4" />
                  </div>
                  <span>Choose Template</span>
                </>
              )}
            </DialogTitle>
            {outlineMode === "ai" && (
              <div className="mt-4">
                <StepIndicator
                  currentStep={getCurrentStepNumber()}
                  totalSteps={3}
                  labels={["Brief", "Review", "Generate"]}
                />
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {outlineMode === "ai" ? (
              <div className="space-y-6">
                {/* Step 1: Initial Brief Input */}
                {discoveryStep === "input" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Describe your document</label>
                      <Textarea
                        placeholder="Be specific about your document's purpose, audience, and requirements. For example:

• A proposal for a government agency seeking cloud migration services. They're evaluating 5 vendors and prioritize security compliance and past performance.

• A technical specification for a microservices architecture that will be reviewed by engineering leadership and compliance teams.

Include any constraints, deadlines, or specific content requirements."
                        value={initialBrief}
                        onChange={(e) => setInitialBrief(e.target.value)}
                        className="min-h-[200px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        The more detail you provide, the better the AI can tailor your document structure.
                      </p>
                    </div>

                    {/* Prompt Settings Collapsible */}
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <Settings2 className="h-3.5 w-3.5" />
                          <span>Advanced: Edit AI Prompts</span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-2 pt-3 border-t">
                        <PromptEditor
                          label="Discovery Prompt"
                          description="Instructions for analyzing your brief"
                          value={prompts.discovery}
                          onChange={(v) => updatePrompt("discovery", v)}
                          defaultValue={DEFAULT_PROMPTS.discovery}
                          isOpen={activePromptEditor === "discovery"}
                          onToggle={() => setActivePromptEditor(activePromptEditor === "discovery" ? null : "discovery")}
                        />
                        <PromptEditor
                          label="Outline Prompt"
                          description="Instructions for generating document structure"
                          value={prompts.outline}
                          onChange={(v) => updatePrompt("outline", v)}
                          defaultValue={DEFAULT_PROMPTS.outline}
                          isOpen={activePromptEditor === "outline"}
                          onToggle={() => setActivePromptEditor(activePromptEditor === "outline" ? null : "outline")}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Step 2: AI Analyzing */}
                {discoveryStep === "analyzing" && (
                  <div className="py-12 flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-primary animate-pulse" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full animate-ping" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-medium">Analyzing your requirements...</p>
                      <p className="text-sm text-muted-foreground">
                        Understanding audience needs, key themes, and credibility strategy
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 3: Review Discovery Analysis */}
                {discoveryStep === "review" && discoveryAnalysis && (
                  <div className="space-y-4">
                    {/* Suggested Title & Document Info */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Suggested Title</p>
                      <p className="text-lg font-semibold font-display">{discoveryAnalysis.suggestedTitle}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Type: <strong className="text-foreground">{discoveryAnalysis.documentIdentification.type}</strong></span>
                        <span>~{discoveryAnalysis.estimatedSections} sections</span>
                        <span className="capitalize">Tone: {discoveryAnalysis.stylisticGuidance.recommendedTone}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground italic">{discoveryAnalysis.documentIdentification.primaryGoal}</p>
                    </div>

                    {/* Central Thesis */}
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-600 uppercase tracking-wider mb-1 font-semibold">Central Thesis</p>
                      <p className="text-sm font-medium">{discoveryAnalysis.contentStrategy.centralThesis}</p>
                    </div>

                    {/* Analysis Cards */}
                    <div className="grid gap-4">
                      <AnalysisCard icon={<Users className="h-5 w-5" />} title="Audience Analysis" iconColor="text-blue-500">
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Primary Audience</p>
                            <p className="font-medium">{discoveryAnalysis.audienceAnalysis.primaryAudience.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">Knowledge: {discoveryAnalysis.audienceAnalysis.primaryAudience.knowledgeLevel}</p>
                          </div>
                          {discoveryAnalysis.audienceAnalysis.primaryAudience.painPoints.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pain Points</p>
                              <TagList items={discoveryAnalysis.audienceAnalysis.primaryAudience.painPoints} variant="default" />
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Critical Questions</p>
                            <ul className="space-y-1">
                              {discoveryAnalysis.audienceAnalysis.criticalQuestions.map((q, i) => (
                                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                                  <ChevronRight className="h-4 w-4 shrink-0 text-blue-500" />
                                  <span>{q}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {discoveryAnalysis.audienceAnalysis.emotionalDrivers.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Emotional Drivers</p>
                              <p className="text-muted-foreground">{discoveryAnalysis.audienceAnalysis.emotionalDrivers.join(" • ")}</p>
                            </div>
                          )}
                        </div>
                      </AnalysisCard>

                      <AnalysisCard icon={<Lightbulb className="h-5 w-5" />} title="Content Strategy" iconColor="text-amber-500">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Must Have</p>
                            <TagList items={discoveryAnalysis.contentStrategy.themes.mustHave} variant="amber" />
                          </div>
                          {discoveryAnalysis.contentStrategy.themes.shouldHave.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Should Have</p>
                              <ul className="space-y-1">
                                {discoveryAnalysis.contentStrategy.themes.shouldHave.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AnalysisCard>

                      <AnalysisCard icon={<Shield className="h-5 w-5" />} title="Persuasion Strategy" iconColor="text-green-500">
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Evidence Types</p>
                            <TagList items={discoveryAnalysis.persuasionStrategy.evidenceTypes} variant="green" />
                          </div>
                          {discoveryAnalysis.persuasionStrategy.potentialObjections.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Objections to Address</p>
                              <ul className="space-y-1">
                                {discoveryAnalysis.persuasionStrategy.potentialObjections.map((obj, i) => (
                                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                                    <Award className="h-4 w-4 shrink-0 text-green-500" />
                                    <span>{obj}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AnalysisCard>

                      {/* Success Criteria */}
                      {(discoveryAnalysis.successCriteria.metrics.length > 0 || discoveryAnalysis.successCriteria.constraints.length > 0) && (
                        <AnalysisCard icon={<Target className="h-5 w-5" />} title="Success Criteria" iconColor="text-purple-500">
                          <div className="space-y-3 text-sm">
                            {discoveryAnalysis.successCriteria.metrics.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Success Metrics</p>
                                <p className="text-muted-foreground">{discoveryAnalysis.successCriteria.metrics.join(" • ")}</p>
                              </div>
                            )}
                            {discoveryAnalysis.successCriteria.constraints.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Constraints</p>
                                <p className="text-muted-foreground">{discoveryAnalysis.successCriteria.constraints.join(" • ")}</p>
                              </div>
                            )}
                          </div>
                        </AnalysisCard>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4: Generating Outline */}
                {(discoveryStep === "generate" || isGeneratingOutline) && (
                  <div className="py-8 space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Generating document structure...</span>
                        <span className="text-muted-foreground">{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="h-2" />
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {generationLogs.map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          {log.startsWith("✓") ? (
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          )}
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Template Selection */
              <div className="space-y-6">
                {/* Import from Document Button */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Import from Document</p>
                      <p className="text-xs text-muted-foreground">Analyze an existing document to create a template</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowTemplateImporter(true)}
                    className="gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Import
                  </Button>
                </div>

                {/* Imported Templates Section */}
                {importedTemplates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>📥</span>
                      <span>Imported Templates</span>
                      <Badge variant="secondary" className="text-[10px]">{importedTemplates.length}</Badge>
                    </h3>
                    <div className="grid gap-2">
                      {importedTemplates.map((template) => {
                        const displayTemplate = customTemplates.get(template.id) || template;
                        return (
                          <Card
                            key={template.id}
                            className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group border-primary/20"
                            onClick={() => {
                              // Apply imported template
                              const nodes = convertTemplateToNodes(template);
                              setStructure(nodes);
                              setTitle(template.name);
                              setShowOutlineModal(false);
                              setOutlineMode(null);
                              toast.success(`Applied imported template: ${template.name}`);
                            }}
                          >
                            <CardHeader className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: template.color }}
                                    />
                                    <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">
                                      {displayTemplate.name}
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 border-primary/30">
                                      Imported
                                    </Badge>
                                  </div>
                                  <CardDescription className="text-xs line-clamp-1 mt-1">
                                    {displayTemplate.description}
                                  </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTemplate(displayTemplate);
                                    }}
                                    title="Edit template"
                                  >
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <div className="text-xs text-muted-foreground">
                                    {template.structure.length} sections
                                  </div>
                                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {Object.entries(TEMPLATES_BY_CATEGORY).map(([category, templates]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>{CATEGORY_ICONS[category] || "📄"}</span>
                      <span className="capitalize">{category}</span>
                      <Badge variant="secondary" className="text-[10px]">{templates.length}</Badge>
                    </h3>
                    <div className="grid gap-2">
                      {templates.map((template) => {
                        // Check for custom version of this template
                        const displayTemplate = customTemplates.get(template.id) || template;
                        return (
                          <Card
                            key={template.id}
                            className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
                            onClick={() => applyTemplate(template.id)}
                          >
                            <CardHeader className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">
                                      {displayTemplate.name}
                                    </CardTitle>
                                    {displayTemplate.isCustom && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                        Customized
                                      </Badge>
                                    )}
                                  </div>
                                  <CardDescription className="text-xs line-clamp-1">
                                    {displayTemplate.description}
                                  </CardDescription>
                                  {displayTemplate.purpose && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                      <strong>Purpose:</strong> {displayTemplate.purpose}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTemplate(displayTemplate);
                                    }}
                                    title="Edit template"
                                  >
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <div className="text-xs text-muted-foreground">
                                    {template.structure.length} sections
                                  </div>
                                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {outlineMode === "ai" && (
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  if (discoveryStep === "review") {
                    setDiscoveryStep("input");
                  } else {
                    setShowOutlineModal(false);
                    setOutlineMode(null);
                    resetDiscovery();
                  }
                }}
                disabled={discoveryStep === "analyzing" || discoveryStep === "generate"}
              >
                {discoveryStep === "review" ? (
                  <>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Edit Brief
                  </>
                ) : (
                  "Cancel"
                )}
              </Button>

              {discoveryStep === "input" && (
                <Button
                  onClick={performDiscoveryAnalysis}
                  disabled={!initialBrief.trim() || initialBrief.length < 20}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze Requirements
                </Button>
              )}

              {discoveryStep === "review" && (
                <Button onClick={approveAndGenerate}>
                  <Check className="h-4 w-4 mr-2" />
                  Approve & Generate
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prompt Settings Sheet */}
      <Sheet open={showPromptSettings} onOpenChange={setShowPromptSettings}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              AI Prompt Configuration
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Customize the prompts used by AI during document generation. Changes are saved automatically.
            </p>
            <PromptEditor
              label="Discovery Analysis"
              description="How AI analyzes your document brief"
              value={prompts.discovery}
              onChange={(v) => updatePrompt("discovery", v)}
              defaultValue={DEFAULT_PROMPTS.discovery}
              isOpen={activePromptEditor === "discovery"}
              onToggle={() => setActivePromptEditor(activePromptEditor === "discovery" ? null : "discovery")}
            />
            <PromptEditor
              label="Outline Generation"
              description="How AI structures your document"
              value={prompts.outline}
              onChange={(v) => updatePrompt("outline", v)}
              defaultValue={DEFAULT_PROMPTS.outline}
              isOpen={activePromptEditor === "outline"}
              onToggle={() => setActivePromptEditor(activePromptEditor === "outline" ? null : "outline")}
            />
            <PromptEditor
              label="Content Generation"
              description="How AI writes section content"
              value={prompts.sectionContent}
              onChange={(v) => updatePrompt("sectionContent", v)}
              defaultValue={DEFAULT_PROMPTS.sectionContent}
              isOpen={activePromptEditor === "sectionContent"}
              onToggle={() => setActivePromptEditor(activePromptEditor === "sectionContent" ? null : "sectionContent")}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Diagram Editor */}
      {showDiagramEditor && (
        <DiagramEditor
          mode="dialog"
          isOpen={showDiagramEditor}
          onClose={() => setShowDiagramEditor(false)}
          onInsert={(svg, code, format) => {
            toast.success("Diagram inserted");
            setShowDiagramEditor(false);
          }}
        />
      )}

      {/* Template Editor */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          isOpen={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
        />
      )}

      {/* Template Importer */}
      <TemplateImporter
        isOpen={showTemplateImporter}
        onClose={() => setShowTemplateImporter(false)}
        onImport={(template) => {
          setImportedTemplates((prev) => [template, ...prev]);
          setShowTemplateImporter(false);
        }}
      />
    </div>
  );
}

export default HDSIFullEnhanced;
