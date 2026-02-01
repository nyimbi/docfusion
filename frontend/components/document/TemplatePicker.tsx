"use client";

/**
 * Template Picker Component
 * 
 * Provides an intuitive interface for selecting and applying templates
 * to a blank HDSI document. Includes:
 * - Category-based browsing
 * - Search and filtering
 * - Template preview
 * - Quick-start options
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Template system
import {
  ALL_TEMPLATES,
  POPULAR_TEMPLATES,
  TEMPLATES_BY_CATEGORY,
  searchTemplates,
  getTemplateById,
  getSuggestedTemplates,
  convertTemplateToNodes,
  type DocumentTemplate,
  type TemplateCategory,
} from "@/lib/hdsi/templates";
import type { HDSINode } from "@/lib/hdsi/types";

// Icons
import {
  Search,
  FileText,
  Landmark,
  Shield,
  Lightbulb,
  Briefcase,
  Code,
  LayoutTemplate,
  Star,
  TrendingUp,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronRight,
  X,
  Layers,
  Target,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: DocumentTemplate) => void;
  onApplyNodes: (nodes: HDSINode[], template: DocumentTemplate) => void;
  context?: {
    documentType?: string;
    opportunityType?: string;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function TemplatePicker(props: TemplatePickerProps) {
  const { isOpen, onClose, onSelectTemplate, onApplyNodes, context } = props;
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<TemplateCategory | "all">("all");
  const [selectedTemplate, setSelectedTemplate] = React.useState<DocumentTemplate | null>(null);
  const [activeTab, setActiveTab] = React.useState<"browse" | "popular" | "suggested">("browse");
  
  // Get suggested templates based on context
  const suggestedTemplates = React.useMemo(() => {
    if (!context) return [];
    return getSuggestedTemplates(context.documentType, context.opportunityType);
  }, [context]);
  
  // Filter templates based on search and category
  const filteredTemplates = React.useMemo(() => {
    let templates = ALL_TEMPLATES;
    
    if (activeTab === "popular") {
      templates = POPULAR_TEMPLATES;
    } else if (activeTab === "suggested" && suggestedTemplates.length > 0) {
      templates = suggestedTemplates;
    } else if (selectedCategory !== "all") {
      templates = TEMPLATES_BY_CATEGORY[selectedCategory] || [];
    }
    
    if (searchQuery) {
      templates = searchTemplates(searchQuery, selectedCategory !== "all" ? selectedCategory : undefined);
    }
    
    return templates;
  }, [searchQuery, selectedCategory, activeTab, suggestedTemplates]);
  
  // Handle template selection
  const handleSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    onSelectTemplate(template);
  };
  
  // Handle apply
  const handleApply = () => {
    if (!selectedTemplate) return;
    
    const nodes = convertTemplateToNodes(selectedTemplate);
    onApplyNodes(nodes, selectedTemplate);
    
    toast.success(`Applied "${selectedTemplate.name}" template`, {
      description: `${nodes.length} top-level sections created`,
    });
    
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                Choose a Template
              </DialogTitle>
              <DialogDescription className="mt-1">
                Select a pre-defined structure to kickstart your document
              </DialogDescription>
            </div>
            
            {/* Quick Stat */}
            <div className="text-right text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{ALL_TEMPLATES.length} templates</p>
              <p>across 6 categories</p>
            </div>
          </div>
        </DialogHeader>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar: Categories & Tabs */}
          <div className="w-48 border-r bg-muted/20 flex flex-col">
            <div className="p-3 space-y-1">
              <button
                onClick={() => setActiveTab("browse")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  activeTab === "browse" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="h-4 w-4" />
                Browse All
              </button>
              
              <button
                onClick={() => setActiveTab("popular")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  activeTab === "popular" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                Popular
              </button>
              
              {suggestedTemplates.length > 0 && (
                <button
                  onClick={() => setActiveTab("suggested")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    activeTab === "suggested" 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Suggested
                  <Badge variant="secondary" className="ml-auto text-xs">{suggestedTemplates.length}</Badge>
                </button>
              )}
            </div>
            
            <Separator />
            
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase px-2 py-1">
                  Categories
                </p>
                
                {(
                  [
                    { id: "all", label: "All Categories", icon: Layers },
                    { id: "government", label: "Government", icon: Landmark },
                    { id: "commercial", label: "Commercial", icon: Briefcase },
                    { id: "technical", label: "Technical", icon: Code },
                    { id: "compliance", label: "Compliance", icon: Shield },
                    { id: "grants", label: "Grants", icon: Lightbulb },
                  ] as const
                ).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setActiveTab("browse");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                      selectedCategory === cat.id && activeTab === "browse"
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <cat.icon className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{cat.label}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* Template Grid */}
          <div className="flex-1 flex flex-col">
            {/* Search Bar */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Results */}
            <ScrollArea className="flex-1 p-4">
              {filteredTemplates.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Search className="h-12 w-12 mb-4 opacity-20" />
                  <p>No templates found</p>
                  <p className="text-sm">Try a different search or category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      onSelect={() => handleSelect(template)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          
          {/* Preview Panel */}
          {selectedTemplate && (
            <div className="w-80 border-l bg-muted/10 flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-start justify-between">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${selectedTemplate.color}20` }}
                  >
                    <TemplateIcon name={selectedTemplate.icon} className="h-5 w-5" style={{ color: selectedTemplate.color }} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTemplate(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="font-semibold mt-3">{selectedTemplate.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                      <Layers className="h-3.5 w-3.5" />
                      Sections
                    </div>
                    <p className="text-lg font-semibold">~{selectedTemplate.estimatedNodes}</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      Est. Time
                    </div>
                    <p className="text-lg font-semibold">{selectedTemplate.estimatedTime}</p>
                  </div>
                </div>
                
                {/* Structure Preview */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Structure Overview</h4>
                  <div className="space-y-1">
                    {selectedTemplate.structure.map((section, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex items-center gap-2 py-1">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{section.title}</span>
                        </div>
                        {section.children && section.children.length > 0 && (
                          <div className="pl-6 space-y-0.5">
                            {section.children.slice(0, 3).map((child, cidx) => (
                              <div key={cidx} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                {child.title}
                              </div>
                            ))}
                            {section.children.length > 3 && (
                              <div className="text-xs text-muted-foreground pl-4">
                                +{section.children.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Tags */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Suggested Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.suggestedTags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* AI Hint */}
                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-1.5 text-primary text-xs mb-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Generation Hint
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.aiPromptHint.replace(/\{\{([^}]+)\}\}/g, "[$1]")}
                  </p>
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t">
                <Button className="w-full" onClick={handleApply}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply Template
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selectedTemplate ? `Selected: ${selectedTemplate.name}` : "No template selected"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!selectedTemplate}>
                Apply Template
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface TemplateCardProps {
  template: DocumentTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard(props: TemplateCardProps) {
  const { template, isSelected, onSelect } = props;
  
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "border-primary ring-1 ring-primary"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${template.color}20` }}
            >
              <TemplateIcon name={template.icon} className="h-5 w-5" style={{ color: template.color }} />
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                {template.description}
              </CardDescription>
            </div>
          </div>
          
          {template.isPopular && (
            <Badge variant="secondary" className="text-xs">
              <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" />
              Popular
            </Badge>
          )}
          {template.isNew && (
            <Badge variant="outline" className="text-xs text-green-600">
              New
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              ~{template.estimatedNodes} sections
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {template.estimatedTime}
            </span>
          </div>
          
          <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-muted">
            {template.category}
          </span>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-3">
          {template.suggestedTags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const icons: Record<string, React.ReactNode> = {
    Landmark: <Landmark className={className} style={style} />,
    Shield: <Shield className={className} style={style} />,
    Lightbulb: <Lightbulb className={className} style={style} />,
    Briefcase: <Briefcase className={className} style={style} />,
    FileText: <FileText className={className} style={style} />,
    Code: <Code className={className} style={style} />,
    LayoutTemplate: <LayoutTemplate className={className} style={style} />,
  };
  return <>{icons[name] || <FileText className={className} style={style} />}</>;
}

// ============================================================================
// Simplified Blank Page Starter
// ============================================================================

interface BlankPageStarterProps {
  onCreateBlank: () => void;
  onOpenTemplatePicker: () => void;
  onGenerateWithAI?: () => void;
}

export function BlankPageStarter(props: BlankPageStarterProps) {
  const { onCreateBlank, onOpenTemplatePicker, onGenerateWithAI } = props;
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Create a New Document</h1>
          <p className="text-muted-foreground">
            Start with a template for faster drafting, or build from scratch
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Template Option */}
          <Card 
            className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm group"
            onClick={onOpenTemplatePicker}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/20">
                  <LayoutTemplate className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Start from Template
                  </CardTitle>
                  <CardDescription>
                    {ALL_TEMPLATES.length} pre-built structures
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["FAR Proposals", "SBIR", "SOWs", "Compliance"].map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* AI Generation Option */}
          {onGenerateWithAI && (
            <Card 
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm group"
              onClick={onGenerateWithAI}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/20">
                    <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      Generate with AI
                    </CardTitle>
                    <CardDescription>
                      Describe your document needs
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI will analyze your requirements and create a custom structure
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Blank Option */}
          <Card 
            className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm md:col-span-2 group"
            onClick={onCreateBlank}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Target className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Start from Blank
                  </CardTitle>
                  <CardDescription>
                    Build your document structure from scratch
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
