"use client";

/**
 * HDSI Node Editor with Rich Text, Diagrams, Bibliography, Watermarks, Footnotes
 * 
 * Comprehensive editing for document sections including:
 * - Rich text editing (colors, fonts, formatting)
 * - Diagram insertion
 * - Bibliography and citations
 * - Footnotes and sidebars
 * - Watermarks and page layout
 * - AI content generation
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { HDSINode } from "@/lib/hdsi/types";

// Rich text editor
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import type { Editor } from "@tiptap/react";

// Publishing features
import {
  BibliographyManager,
} from "./BibliographyManager";
import {
  PublishingToolbar,
} from "./PublishingToolbar";
import { DiagramEditor } from "./DiagramEditor";

// Icons
import {
  Wand2,
  Loader2,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Indent,
  Outdent,
  Image,
  BookOpen,
  Droplets,
  Footprints,
  PanelLeft,
  Type,
  Palette,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Save,
  Highlighter,
  Sigma,
  Paperclip,
  Maximize2,
  Minimize2,
} from "lucide-react";

// ============================================================================
// Custom Prompt Editor Component
// ============================================================================

interface CustomPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  nodeTitle: string;
  nodeType: string;
  documentTitle: string;
}

function CustomPromptEditor({
  value,
  onChange,
  nodeTitle,
  nodeType,
  documentTitle,
}: CustomPromptEditorProps) {
  const [isImproving, setIsImproving] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const minHeight = isExpanded ? 400 : 200;
      const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
      textarea.style.height = `${Math.min(scrollHeight, isExpanded ? 600 : 300)}px`;
    }
  }, [isExpanded]);

  React.useEffect(() => {
    adjustHeight();
  }, [value, isExpanded, adjustHeight]);

  // Improve prompt using AI
  const handleImprovePrompt = async () => {
    if (!value.trim()) {
      toast.error("Please enter a prompt to improve");
      return;
    }

    setIsImproving(true);

    try {
      const response = await fetch("/api/v1/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are an expert prompt engineer specializing in document generation prompts. Your task is to enhance, extend, and improve writing prompts to produce higher quality content.

## Enhancement Guidelines:

1. **Add Specificity**: Include concrete details about what the content should cover
2. **Define Audience**: Clarify who the reader is and their knowledge level
3. **Specify Structure**: Suggest how the content should be organized
4. **Include Tone Guidance**: Define the voice (authoritative, conversational, technical, etc.)
5. **Add Quality Markers**: Specify what makes good content for this section
6. **Include Examples**: Suggest types of examples, data, or evidence to include
7. **Set Boundaries**: Define what should NOT be included
8. **Formatting Hints**: Suggest bullet points, tables, paragraphs as appropriate

## Context:
- Document Title: "${documentTitle}"
- Section Title: "${nodeTitle}"
- Section Type: ${nodeType}

Return ONLY the improved prompt, no explanations or preamble.`,
            },
            {
              role: "user",
              content: `Improve this writing prompt:\n\n${value}`,
            },
          ],
          temperature: 0.7,
          maxTokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to improve prompt");
      }

      const data = await response.json();
      const improvedPrompt = data.content?.trim();

      if (improvedPrompt) {
        onChange(improvedPrompt);
        toast.success("Prompt improved!");
      }
    } catch (error) {
      console.error("Error improving prompt:", error);
      toast.error("Failed to improve prompt. Please try again.");
    } finally {
      setIsImproving(false);
    }
  };

  const characterCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground">
          Custom AI Prompt
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {wordCount} words • {characterCount} chars
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-3 w-3 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3 mr-1" />
                Expand
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={cn(
        "relative border rounded-lg transition-all",
        isExpanded && "ring-2 ring-primary/20"
      )}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjustHeight();
          }}
          placeholder={`Write specific instructions for generating the "${nodeTitle}" section...

Example prompts:
• "Write a technical overview for senior engineers, focusing on architecture decisions and trade-offs. Include code examples where relevant."
• "Create an executive summary that highlights key findings and recommendations. Use bullet points for easy scanning."
• "Develop a step-by-step guide for beginners, with clear explanations and practical examples."`}
          className={cn(
            "w-full px-3 py-3 text-sm bg-transparent resize-none focus:outline-none",
            "placeholder:text-muted-foreground/50",
            isExpanded ? "min-h-[400px]" : "min-h-[200px]"
          )}
          style={{ overflow: "auto" }}
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Detailed prompts produce better AI-generated content
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImprovePrompt}
              disabled={isImproving || !value.trim()}
              className="h-7"
            >
              {isImproving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Improving...
                </>
              ) : (
                <>
                  <Wand2 className="h-3 w-3 mr-1" />
                  Improve with AI
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Tips Accordion */}
      <details className="text-xs">
        <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
          Tips for effective prompts
        </summary>
        <ul className="mt-2 space-y-1 text-muted-foreground pl-4">
          <li>• Specify the <strong>audience</strong> and their expertise level</li>
          <li>• Define the <strong>tone</strong> (formal, conversational, technical)</li>
          <li>• List specific <strong>topics or points</strong> to cover</li>
          <li>• Mention <strong>examples or evidence</strong> types to include</li>
          <li>• Set <strong>formatting preferences</strong> (bullets, tables, prose)</li>
          <li>• State what to <strong>avoid or exclude</strong></li>
        </ul>
      </details>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

interface HDSINodeEditorProps {
  node: HDSINode;
  documentId: string;
  documentTitle: string;
  onUpdate: (updates: Partial<HDSINode>) => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
  onAddChild: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  canOutdent: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function HDSINodeEditor({
  node,
  documentId,
  documentTitle,
  onUpdate,
  onGenerate,
  isGenerating,
  onAddChild,
  onDelete,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  canOutdent,
}: HDSINodeEditorProps) {
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [showDiagramEditor, setShowDiagramEditor] = React.useState(false);
  const [showBibliography, setShowBibliography] = React.useState(false);
  const [showPublishing, setShowPublishing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"content" | "settings" | "publishing">("content");

  // Handle content changes from Tiptap
  const handleContentChange = React.useCallback((content: any) => {
    onUpdate({ generatedContent: JSON.stringify(content) });
  }, [onUpdate]);

  // Parse existing content or create empty
  const initialContent = React.useMemo(() => {
    if (node.generatedContent) {
      try {
        return JSON.parse(node.generatedContent);
      } catch {
        // If not JSON, wrap as paragraph
        return {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: node.generatedContent }],
            },
          ],
        };
      }
    }
    return { type: "doc", content: [{ type: "paragraph" }] };
  }, [node.generatedContent]);

  // Insert diagram into editor
  const handleInsertDiagram = (svg: string, code: string, format: string) => {
    if (editor) {
      editor.chain().focus().insertContent({
        type: "image",
        attrs: { src: `data:image/svg+xml;base64,${btoa(svg)}`, alt: "Diagram" },
      }).run();
      toast.success("Diagram inserted");
    }
    setShowDiagramEditor(false);
  };

  // Insert citation
  const handleInsertCitation = (citation: string) => {
    if (editor) {
      editor.chain().focus().insertContent(` [${citation}] `).run();
      toast.success("Citation inserted");
    }
  };

  // Insert footnote
  const handleInsertFootnote = () => {
    if (editor) {
      const footnoteNumber = Math.floor(Math.random() * 100) + 1;
      editor.chain().focus()
        .insertContent([
          { type: "text", text: `${footnoteNumber}`, marks: [{ type: "superscript" }] },
        ])
        .run();
      toast.success(`Footnote ${footnoteNumber} inserted`);
    }
  };

  // Note: Color and font size require TextStyle/Color extensions
  // For now, these features use the Highlight extension for text marking
  
  return (
    <div className="h-full flex flex-col">
      {/* Header with Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{node.title}</h3>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            node.status === "outline" && "bg-slate-100 text-slate-700",
            node.status === "generating" && "bg-blue-100 text-blue-700",
            node.status === "generated" && "bg-green-100 text-green-700",
            node.status === "error" && "bg-red-100 text-red-700"
          )}>
            {node.status}
          </span>
          {node.status === "generated" && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Structure Controls */}
          <Button variant="ghost" size="icon" onClick={onMoveUp} title="Move up" aria-label="Move up">
            <MoveUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onMoveDown} title="Move down" aria-label="Move down">
            <MoveDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onIndent} title="Make subsection" aria-label="Make subsection">
            <Indent className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOutdent} disabled={!canOutdent} title="Move up level" aria-label="Move up level">
            <Outdent className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onAddChild} title="Add subsection" aria-label="Add subsection">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive" aria-label="Delete section">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("content")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "content"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "settings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          AI Settings
        </button>
        <button
          onClick={() => setActiveTab("publishing")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "publishing"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Publishing
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "content" && (
          <div className="p-4 space-y-4">
            {/* Rich Text Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Text Color */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Palette className="h-4 w-4 mr-1" />
                    Color
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setColor("#000000").run()}>
                    <span className="w-3 h-3 rounded-full bg-black mr-2" /> Black
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setColor("#dc2626").run()}>
                    <span className="w-3 h-3 rounded-full bg-red-600 mr-2" /> Red
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setColor("#16a34a").run()}>
                    <span className="w-3 h-3 rounded-full bg-green-600 mr-2" /> Green
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setColor("#2563eb").run()}>
                    <span className="w-3 h-3 rounded-full bg-blue-600 mr-2" /> Blue
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setColor("#9333ea").run()}>
                    <span className="w-3 h-3 rounded-full bg-purple-600 mr-2" /> Purple
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().unsetColor().run()}>
                    Reset Color
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Highlighting */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Highlighter className="h-4 w-4 mr-1" />
                    Highlight
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}>
                    <span className="w-3 h-3 rounded-full bg-yellow-200 mr-2" /> Yellow
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHighlight({ color: "#bbf7d0" }).run()}>
                    <span className="w-3 h-3 rounded-full bg-green-200 mr-2" /> Green
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHighlight({ color: "#bfdbfe" }).run()}>
                    <span className="w-3 h-3 rounded-full bg-blue-200 mr-2" /> Blue
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHighlight().run()}>
                    Remove Highlight
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Insert Equation */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Sigma className="h-4 w-4 mr-1" />
                    Equation
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().insertEquation("E = mc^2").run()}>
                    Block Equation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().insertContent(" $x^2$ ").run()}>
                    Inline Math
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Insert Diagram */}
              <Button variant="outline" size="sm" onClick={() => setShowDiagramEditor(true)}>
                <Image className="h-4 w-4 mr-1" />
                Diagram
              </Button>

              {/* Insert Citation */}
              <Button variant="outline" size="sm" onClick={() => setShowBibliography(true)}>
                <BookOpen className="h-4 w-4 mr-1" />
                Citation
              </Button>

              {/* Insert Footnote */}
              <Button variant="outline" size="sm" onClick={handleInsertFootnote}>
                <Footprints className="h-4 w-4 mr-1" />
                Footnote
              </Button>

              {/* External File */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file && editor) {
                      const url = URL.createObjectURL(file);
                      editor.chain().focus().insertExternalFile({
                        url,
                        filename: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                      }).run();
                    }
                  };
                  input.click();
                }}
              >
                <Paperclip className="h-4 w-4 mr-1" />
                Attach File
              </Button>

              {/* Generate Content */}
              <Button
                onClick={onGenerate}
                disabled={isGenerating}
                size="sm"
                className="ml-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>

            {/* Rich Text Editor */}
            <div className="border rounded-lg min-h-[400px]">
              <TiptapEditor
                content={initialContent}
                onContentChange={handleContentChange}
                onEditorReady={setEditor}
                showToolbar
                placeholder="Start writing or generate content with AI..."
              />
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-4 space-y-4 max-w-md">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Title</label>
              <input
                type="text"
                value={node.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Type</label>
              <select
                value={node.type}
                onChange={(e) => onUpdate({ type: e.target.value as HDSINode["type"] })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              >
                <option value="chapter">Chapter</option>
                <option value="section">Section</option>
                <option value="subsection">Subsection</option>
                <option value="paragraph">Paragraph</option>
              </select>
            </div>

            {/* Token Budget with Reading Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">
                  Token Budget
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                    {node.tokenBudget} tokens
                  </span>
                  <span className="text-muted-foreground">≈</span>
                  <span className="text-primary font-medium">
                    {Math.ceil(node.tokenBudget / 200)} min read
                  </span>
                </div>
              </div>
              <div className="relative pt-1">
                <input
                  type="range"
                  min="100"
                  max="3800"
                  step="50"
                  value={node.tokenBudget}
                  onChange={(e) => onUpdate({ tokenBudget: parseInt(e.target.value) })}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                {/* Budget markers */}
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
                  <span>100</span>
                  <span>1000</span>
                  <span>2000</span>
                  <span>3000</span>
                  <span className="text-amber-500 font-semibold">3800</span>
                </div>
              </div>
              {/* Visual progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-200",
                    node.tokenBudget < 1000 && "bg-emerald-500",
                    node.tokenBudget >= 1000 && node.tokenBudget < 2500 && "bg-blue-500",
                    node.tokenBudget >= 2500 && node.tokenBudget < 3500 && "bg-amber-500",
                    node.tokenBudget >= 3500 && "bg-red-500"
                  )}
                  style={{ width: `${(node.tokenBudget / 3800) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {node.tokenBudget < 1000 && "Brief section (~1-5 min read)"}
                {node.tokenBudget >= 1000 && node.tokenBudget < 2500 && "Standard section (~5-12 min read)"}
                {node.tokenBudget >= 2500 && node.tokenBudget < 3500 && "Comprehensive section (~12-18 min read)"}
                {node.tokenBudget >= 3500 && "Maximum length section (18+ min read)"}
              </p>
            </div>

            {/* Density Target */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Density Target: {node.densityTarget}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={node.densityTarget}
                onChange={(e) => onUpdate({ densityTarget: parseFloat(e.target.value) })}
                className="w-full mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How information-dense the content should be (1=sparse, 5=very dense)
              </p>
            </div>

            {/* Custom Prompt - Enhanced */}
            <CustomPromptEditor
              value={node.customPrompt}
              onChange={(value) => onUpdate({ customPrompt: value })}
              nodeTitle={node.title}
              nodeType={node.type}
              documentTitle={documentTitle}
            />
          </div>
        )}

        {activeTab === "publishing" && (
          <div className="p-4">
            <PublishingToolbar
              documentId={documentId}
              documentTitle={documentTitle}
              nodes={[node]}
            />
          </div>
        )}
      </div>

      {/* Diagram Editor Dialog */}
      <Dialog open={showDiagramEditor} onOpenChange={setShowDiagramEditor}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Insert Diagram</DialogTitle>
          </DialogHeader>
          <DiagramEditor
            mode="dialog"
            isOpen={showDiagramEditor}
            onInsert={handleInsertDiagram}
            onClose={() => setShowDiagramEditor(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Bibliography Dialog */}
      <Dialog open={showBibliography} onOpenChange={setShowBibliography}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Bibliography & Citations</DialogTitle>
          </DialogHeader>
          <BibliographyManager
            onCiteEntry={(entryId) => handleInsertCitation(entryId)}
            onClose={() => setShowBibliography(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
