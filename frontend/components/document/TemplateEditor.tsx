"use client";

/**
 * TemplateEditor - Comprehensive Template Editing Component
 *
 * Allows editing of:
 * - Template metadata (name, purpose, audience, usage advice)
 * - AI instructions for the entire template
 * - Section-level AI prompts
 * - Structure and organization
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import type { DocumentTemplate, TemplateNode } from "@/lib/hdsi/templates";
import {
  FileText,
  Users,
  Target,
  Lightbulb,
  Sparkles,
  Wand2,
  Save,
  X,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Info,
  BookOpen,
  Settings2,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TemplateEditorProps {
  template: DocumentTemplate;
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: DocumentTemplate) => void;
}

interface SectionPromptEditorProps {
  node: TemplateNode;
  path: string;
  onUpdate: (path: string, updates: Partial<TemplateNode>) => void;
  onImprovePrompt: (path: string, currentPrompt: string) => Promise<string>;
  depth?: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function TemplateEditor({
  template,
  isOpen,
  onClose,
  onSave,
}: TemplateEditorProps) {
  const [editedTemplate, setEditedTemplate] = React.useState<DocumentTemplate>({
    ...template,
  });
  const [activeTab, setActiveTab] = React.useState("metadata");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Reset state when template changes
  React.useEffect(() => {
    setEditedTemplate({ ...template });
    setHasChanges(false);
  }, [template]);

  // Update a field in the template
  const updateField = <K extends keyof DocumentTemplate>(
    field: K,
    value: DocumentTemplate[K]
  ) => {
    setEditedTemplate((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Update a section node
  const updateSectionNode = (path: string, updates: Partial<TemplateNode>) => {
    setEditedTemplate((prev) => {
      const newStructure = updateNodeAtPath(prev.structure, path, updates);
      return { ...prev, structure: newStructure };
    });
    setHasChanges(true);
  };

  // Improve AI prompt using AI
  const improvePrompt = async (currentPrompt: string, context: string): Promise<string> => {
    setIsImprovingPrompt(true);
    try {
      const response = await fetch("/api/v1/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are an expert prompt engineer. Enhance the given prompt to produce higher quality document content.

Template Context:
- Template Name: ${editedTemplate.name}
- Template Purpose: ${editedTemplate.purpose || editedTemplate.description}
- Target Audience: ${editedTemplate.targetAudience || "General professional audience"}
- Section Context: ${context}

Enhancement Guidelines:
1. Add specificity about content, structure, and examples to include
2. Define audience context and knowledge level
3. Specify tone (authoritative, collaborative, technical, etc.)
4. Include formatting guidance (bullets, tables, paragraphs)
5. Set boundaries on what NOT to include
6. Add quality markers for good content

Return ONLY the improved prompt, no explanations.`,
            },
            {
              role: "user",
              content: `Improve this section writing prompt:\n\n${currentPrompt || "Write content for this section."}`,
            },
          ],
          temperature: 0.7,
          maxTokens: 800,
        }),
      });

      if (!response.ok) throw new Error("Failed to improve prompt");

      const data = await response.json();
      return data.content?.trim() || currentPrompt;
    } catch (error) {
      console.error("Error improving prompt:", error);
      toast.error("Failed to improve prompt");
      return currentPrompt;
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  // Handle section prompt improvement
  const handleImproveSectionPrompt = async (
    path: string,
    currentPrompt: string
  ): Promise<string> => {
    const improved = await improvePrompt(currentPrompt, `Section at path: ${path}`);
    if (improved !== currentPrompt) {
      updateSectionNode(path, { aiPrompt: improved });
    }
    return improved;
  };

  // Improve main AI hint
  const handleImproveMainPrompt = async () => {
    const improved = await improvePrompt(
      editedTemplate.aiPromptHint,
      "Main template AI instructions"
    );
    if (improved !== editedTemplate.aiPromptHint) {
      updateField("aiPromptHint", improved);
      toast.success("AI instructions improved!");
    }
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const savedTemplate: DocumentTemplate = {
        ...editedTemplate,
        isCustom: true,
        lastModified: new Date(),
        baseTemplateId: editedTemplate.baseTemplateId || template.id,
      };
      onSave(savedTemplate);
      toast.success("Template saved!");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  // Add best practice
  const addBestPractice = () => {
    const practices = editedTemplate.bestPractices || [];
    updateField("bestPractices", [...practices, ""]);
  };

  // Update best practice
  const updateBestPractice = (index: number, value: string) => {
    const practices = [...(editedTemplate.bestPractices || [])];
    practices[index] = value;
    updateField("bestPractices", practices);
  };

  // Remove best practice
  const removeBestPractice = (index: number) => {
    const practices = (editedTemplate.bestPractices || []).filter(
      (_, i) => i !== index
    );
    updateField("bestPractices", practices);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Edit Template: {editedTemplate.name}
          </DialogTitle>
          <DialogDescription>
            Customize template metadata, AI instructions, and section prompts
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metadata" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Metadata
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Instructions
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Section Prompts
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto py-4">
            {/* Metadata Tab */}
            <TabsContent value="metadata" className="space-y-6 mt-0">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Template Name
                </Label>
                <Input
                  id="name"
                  value={editedTemplate.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g., Technical Proposal Template"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editedTemplate.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief description of what this template is for..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label htmlFor="purpose" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Purpose
                </Label>
                <Textarea
                  id="purpose"
                  value={editedTemplate.purpose || ""}
                  onChange={(e) => updateField("purpose", e.target.value)}
                  placeholder="What is this template designed to accomplish? What problems does it solve?"
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Explain the specific goals and outcomes this template helps achieve.
                </p>
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label htmlFor="audience" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Target Audience
                </Label>
                <Textarea
                  id="audience"
                  value={editedTemplate.targetAudience || ""}
                  onChange={(e) => updateField("targetAudience", e.target.value)}
                  placeholder="Who should use this template? What expertise level is expected?"
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Describe the ideal user: their role, industry, and experience level.
                </p>
              </div>

              {/* Usage Advice */}
              <div className="space-y-2">
                <Label htmlFor="usage" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  When to Use This Template
                </Label>
                <Textarea
                  id="usage"
                  value={editedTemplate.usageAdvice || ""}
                  onChange={(e) => updateField("usageAdvice", e.target.value)}
                  placeholder="When is this template most appropriate? What situations call for it?"
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Help users understand the ideal context and scenarios for this template.
                </p>
              </div>

              {/* Best Practices */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Best Practices & Tips
                </Label>
                <div className="space-y-2">
                  {(editedTemplate.bestPractices || []).map((practice, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-2">•</span>
                      <Input
                        value={practice}
                        onChange={(e) => updateBestPractice(index, e.target.value)}
                        placeholder="Enter a tip or best practice..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBestPractice(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addBestPractice}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Best Practice
                </Button>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {editedTemplate.suggestedTags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* AI Instructions Tab */}
            <TabsContent value="ai" className="space-y-6 mt-0">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      AI Generation Instructions
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      These instructions guide AI when generating content for documents
                      based on this template. Be specific about tone, style, and
                      requirements.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="aiPrompt">Main AI Instructions</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImproveMainPrompt}
                    disabled={isImprovingPrompt}
                  >
                    {isImprovingPrompt ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Improve with AI
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="aiPrompt"
                  value={editedTemplate.aiPromptHint}
                  onChange={(e) => updateField("aiPromptHint", e.target.value)}
                  placeholder="Enter instructions that will guide AI content generation for this template..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use placeholders like {"{{agency}}"}, {"{{technical_area}}"} for
                  dynamic content. Be specific about tone, compliance requirements,
                  and key themes.
                </p>
              </div>

              {/* Default Objectives */}
              <div className="space-y-2">
                <Label>Default Objectives</Label>
                <div className="flex flex-wrap gap-2">
                  {editedTemplate.defaultObjectives.map((obj, index) => (
                    <Badge key={index} variant="outline">
                      {obj.replace(/-/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Section Prompts Tab */}
            <TabsContent value="sections" className="space-y-4 mt-0">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-100">
                      Section-Level AI Prompts
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Customize the AI instructions for each section. Detailed prompts
                      produce better, more relevant content.
                    </p>
                  </div>
                </div>
              </div>

              <Accordion type="multiple" className="space-y-2">
                {editedTemplate.structure.map((node, index) => (
                  <SectionPromptEditor
                    key={`${node.title}-${index}`}
                    node={node}
                    path={String(index)}
                    onUpdate={updateSectionNode}
                    onImprovePrompt={handleImproveSectionPrompt}
                    depth={0}
                  />
                ))}
              </Accordion>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center gap-2 w-full justify-between">
            <div className="text-sm text-muted-foreground">
              {hasChanges && (
                <span className="text-amber-600">• Unsaved changes</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Section Prompt Editor Component
// ============================================================================

function SectionPromptEditor({
  node,
  path,
  onUpdate,
  onImprovePrompt,
  depth = 0,
}: SectionPromptEditorProps) {
  const [isImproving, setIsImproving] = React.useState(false);
  const [localPrompt, setLocalPrompt] = React.useState(node.aiPrompt || "");

  const handleImprove = async () => {
    setIsImproving(true);
    try {
      const improved = await onImprovePrompt(path, localPrompt);
      setLocalPrompt(improved);
      toast.success(`Improved prompt for "${node.title}"`);
    } finally {
      setIsImproving(false);
    }
  };

  const handlePromptChange = (value: string) => {
    setLocalPrompt(value);
    onUpdate(path, { aiPrompt: value });
  };

  const typeColors = {
    chapter: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    section: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    subsection: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    paragraph: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <AccordionItem value={path} className="border rounded-lg">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <div style={{ marginLeft: `${depth * 16}px` }} className="flex items-center gap-2">
            <Badge className={cn("text-xs", typeColors[node.type])}>
              {node.type}
            </Badge>
            <span className="font-medium">{node.title}</span>
          </div>
          {node.aiPrompt && (
            <Sparkles className="h-3 w-3 text-blue-500" />
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3" style={{ marginLeft: `${depth * 16}px` }}>
          {/* Description */}
          {node.description && (
            <p className="text-sm text-muted-foreground">{node.description}</p>
          )}

          {/* AI Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">AI Generation Prompt</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleImprove}
                disabled={isImproving}
                className="h-7 text-xs"
              >
                {isImproving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Improve
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={localPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder={`Write specific instructions for generating "${node.title}" content...`}
              className="min-h-[100px] text-sm"
            />
          </div>

          {/* Token Budget */}
          {node.tokenBudget && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Token Budget: {node.tokenBudget}</span>
              {node.densityTarget && (
                <span>• Density: {node.densityTarget}</span>
              )}
            </div>
          )}

          {/* Children */}
          {node.children && node.children.length > 0 && (
            <div className="mt-4 space-y-2">
              {node.children.map((child, index) => (
                <SectionPromptEditor
                  key={`${path}-${index}`}
                  node={child}
                  path={`${path}-${index}`}
                  onUpdate={onUpdate}
                  onImprovePrompt={onImprovePrompt}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update a node at a specific path in the structure tree
 */
function updateNodeAtPath(
  structure: TemplateNode[],
  path: string,
  updates: Partial<TemplateNode>
): TemplateNode[] {
  const pathParts = path.split("-").map(Number);

  const updateRecursive = (
    nodes: TemplateNode[],
    remainingPath: number[]
  ): TemplateNode[] => {
    if (remainingPath.length === 0) return nodes;

    const [currentIndex, ...rest] = remainingPath;

    return nodes.map((node, index) => {
      if (index !== currentIndex) return node;

      if (rest.length === 0) {
        // This is the target node
        return { ...node, ...updates };
      }

      // Recurse into children
      return {
        ...node,
        children: node.children
          ? updateRecursive(node.children, rest)
          : node.children,
      };
    });
  };

  return updateRecursive(structure, pathParts);
}

export default TemplateEditor;
