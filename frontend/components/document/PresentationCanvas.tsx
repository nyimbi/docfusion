"use client";

/**
 * Presentation Canvas - Interactive slide editor and preview
 * 
 * McKinsey-grade presentation interface:
 * - Slide sorter view
 * - Slide editor with real-time preview
 * - Action title validation
 * - Chart insertion
 * - Theme switching (McKinsey, BCG, Bain)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Presentation system
import {
  usePresentations,
  MCKINSEY_THEME,
  BCG_THEME,
  BAIN_THEME,
  THEMES,
  validatePyramidPrinciple,
  type Presentation,
  type Slide,
  type SlideType,
  type StorylineFramework,
} from "@/lib/hdsi/presentations";
import type { HDSINode } from "@/lib/hdsi/types";

// Icons
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Monitor,
  Layout,
  BarChart3,
  Type,
  CheckCircle2,
  AlertCircle,
  Presentation as PresentationIcon,
  Download,
  Palette,
  Sparkles,
  Play,
  Grid3X3,
  FileText,
  MoreHorizontal,
  Maximize2,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface PresentationCanvasProps {
  documentNodes: HDSINode[];
  documentTitle: string;
  onExportPPTX?: (presentation: Presentation) => void;
  className?: string;
}

type ViewMode = "grid" | "split" | "preview";

// ============================================================================
// Main Component
// ============================================================================

export function PresentationCanvas(props: PresentationCanvasProps) {
  const { documentNodes, documentTitle, onExportPPTX, className } = props;
  
  const {
    activePresentation,
    currentSlide,
    currentSlideIndex,
    createFromDocument,
    updateSlide,
    nextSlide,
    prevSlide,
    goToSlide,
    validatePresentation,
  } = usePresentations();
  
  const [viewMode, setViewMode] = React.useState<ViewMode>("split");
  const [showValidation, setShowValidation] = React.useState(true);
  const [selectedFramework, setSelectedFramework] = React.useState<StorylineFramework>("SCR");
  
  // Create presentation on mount
  React.useEffect(() => {
    if (!activePresentation && documentNodes.length > 0) {
      createFromDocument(documentNodes, documentTitle, selectedFramework);
    }
  }, [documentNodes, documentTitle]);
  
  // Validation
  const validation = validatePresentation();
  
  if (!activePresentation) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full p-8", className)}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <PresentationIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Create Presentation</h3>
          <p className="text-muted-foreground mb-4">
            Transform your document into a consultant-grade presentation using the SCR framework
          </p>
          <div className="flex gap-2 justify-center">
            <select
              className="p-2 border rounded"
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value as StorylineFramework)}
            >
              <option value="SCR">SCR Framework</option>
              <option value="pyramid">Pyramid Principle</option>
              <option value="problem-solution-benefit">Problem-Solution-Benefit</option>
            </select>
            <Button 
              onClick={() => createFromDocument(documentNodes, documentTitle, selectedFramework)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Slides
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("flex h-full bg-background", className)}>
      {/* Sidebar - Slide Thumbnails */}
      {viewMode !== "preview" && (
        <div className="w-64 border-r bg-muted/20 flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">{activePresentation.slides.length} Slides</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {activePresentation.slides.map((slide, idx) => (
                <SlideThumbnail
                  key={slide.id}
                  slide={slide}
                  index={idx}
                  isActive={idx === currentSlideIndex}
                  isHidden={slide.hidden}
                  validation={showValidation ? validatePyramidPrinciple(slide) : null}
                  onClick={() => goToSlide(idx)}
                />
              ))}
            </div>
          </ScrollArea>
          
          {/* Overall Score */}
          {showValidation && (
            <div className="p-3 border-t">
              <div className={cn(
                "text-center p-2 rounded",
                validation.overallScore >= 80 ? "bg-green-100" :
                validation.overallScore >= 60 ? "bg-yellow-100" :
                "bg-red-100"
              )}>
                <p className="text-xs text-muted-foreground">Presentation Score</p>
                <p className={cn(
                  "text-2xl font-bold",
                  validation.overallScore >= 80 ? "text-green-700" :
                  validation.overallScore >= 60 ? "text-yellow-700" :
                  "text-red-700"
                )}>
                  {validation.overallScore}%
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-muted/20">
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "split" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("split")}
              >
                <Layout className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "preview" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("preview")}
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prevSlide}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-16 text-center">
                {currentSlideIndex + 1} / {activePresentation.slides.length}
              </span>
              <Button variant="ghost" size="icon" onClick={nextSlide}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Theme Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Palette className="h-4 w-4 mr-2" />
                  {activePresentation.theme.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => updateSlide(activePresentation.slides[0].id, { /* theme update would be on presentation */ })}>
                  McKinsey Classic
                </DropdownMenuItem>
                <DropdownMenuItem>BCG</DropdownMenuItem>
                <DropdownMenuItem>Bain</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Validation Toggle */}
            <Button
              variant={showValidation ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowValidation(!showValidation)}
            >
              {showValidation ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
              Validation
            </Button>
            
            {/* Export */}
            <Button onClick={() => onExportPPTX?.(activePresentation)}>
              <Download className="h-4 w-4 mr-2" />
              Export PPTX
            </Button>
          </div>
        </div>
        
        {/* Slide Editor / Preview */}
        <div className="flex-1 overflow-hidden flex">
          {viewMode === "grid" ? (
            // Grid View
            <ScrollArea className="flex-1 p-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activePresentation.slides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    onClick={() => goToSlide(idx)}
                    className="cursor-pointer"
                  >
                    <SlideCard slide={slide} theme={activePresentation.theme} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : viewMode === "preview" ? (
            // Full Preview
            <div className="flex-1 bg-neutral-900 flex items-center justify-center p-8">
              <SlidePreview
                slide={currentSlide!}
                theme={activePresentation.theme}
                scale={1.2}
              />
            </div>
          ) : (
            // Split View - Editor + Preview
            <>
              <div className="w-1/2 border-r overflow-auto">
                <SlideEditor
                  slide={currentSlide!}
                  onUpdate={(updates) => updateSlide(currentSlide!.id, updates)}
                  validation={showValidation ? validatePyramidPrinciple(currentSlide!) : null}
                />
              </div>
              <div className="w-1/2 bg-neutral-100 flex items-center justify-center p-8">
                <SlidePreview
                  slide={currentSlide!}
                  theme={activePresentation.theme}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Slide Thumbnail
// ============================================================================

function SlideThumbnail({
  slide,
  index,
  isActive,
  isHidden,
  validation,
  onClick,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
  isHidden?: boolean;
  validation: ReturnType<typeof validatePyramidPrinciple> | null;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg cursor-pointer transition-all border-2",
        isActive 
          ? "border-primary bg-primary/5" 
          : "border-transparent hover:bg-accent",
        isHidden && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground font-mono min-w-5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-tight">
            {slide.actionTitle}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="outline" className="text-xs px-1 py-0">
              {slide.type}
            </Badge>
            {slide.chart && (
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
            )}
            {isHidden && (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
      
      {validation && validation.score < 70 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="h-3 w-3" />
          {validation.issues.length} issues
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Slide Card (Grid View)
// ============================================================================

function SlideCard({ 
  slide, 
  theme 
}: { 
  slide: Slide; 
  theme: { name: string; colors: any; fonts: any };
}) {
  return (
    <div 
      className="aspect-video bg-white rounded-lg shadow-sm border overflow-hidden p-4"
      style={{ fontFamily: theme.fonts.body }}
    >
      <p 
        className="text-sm font-bold leading-tight mb-2"
        style={{ color: theme.colors.primary, fontFamily: theme.fonts.title }}
      >
        {slide.actionTitle}
      </p>
      
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className="text-xs space-y-1">
          {slide.bullets.slice(0, 3).map((bullet, i) => (
            <li key={i} className="truncate" style={{ color: theme.colors.text }}>
              • {bullet}
            </li>
          ))}
          {slide.bullets.length > 3 && (
            <li className="text-muted-foreground">...</li>
          )}
        </ul>
      )}
      
      {slide.chart && (
        <div className="mt-2 h-8 bg-accent/10 rounded flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-accent" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Slide Editor
// ============================================================================

function SlideEditor({
  slide,
  onUpdate,
  validation,
}: {
  slide: Slide;
  onUpdate: (updates: Partial<Slide>) => void;
  validation: ReturnType<typeof validatePyramidPrinciple> | null;
}) {
  const [localTitle, setLocalTitle] = React.useState(slide.actionTitle);
  const [localBullets, setLocalBullets] = React.useState(slide.bullets?.join("\n") || "");
  
  // Update parent when local changes (debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onUpdate({
        actionTitle: localTitle,
        bullets: localBullets.split("\n").filter(b => b.trim()),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [localTitle, localBullets]);
  
  return (
    <div className="p-6 space-y-6">
      {/* Action Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center justify-between">
          Action Title
          {validation && (
            <span className={cn(
              "text-xs",
              validation.score >= 80 ? "text-green-600" :
              validation.score >= 60 ? "text-yellow-600" :
              "text-red-600"
            )}>
              {validation.score >= 80 ? "✓ Strong" : 
               validation.score >= 60 ? "⚠ Okay" : 
               "✗ Needs Work"}
            </span>
          )}
        </label>
        <Textarea
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          placeholder="Start with action verb: 'We must...' 'To reduce...' 'Implement...'"
          className={cn(
            "text-lg font-semibold",
            validation && !validation.isValid && "border-amber-500"
          )}
          rows={2}
        />
        {validation?.issues.map((issue, i) => (
          <div key={i} className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            <strong>{issue.type}:</strong> {issue.message}
            <br />
            <em>Suggestion: {issue.suggestion}</em>
          </div>
        ))}
      </div>
      
      {/* Bullets */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center justify-between">
          Supporting Points
          <span className="text-xs text-muted-foreground">
            {localBullets.split("\n").filter(b => b.trim()).length} bullets (max 5)
          </span>
        </label>
        <Textarea
          value={localBullets}
          onChange={(e) => setLocalBullets(e.target.value)}
          placeholder="• Each bullet should be a complete thought&#10;• Keep under 2 lines&#10;• Lead with key insight&#10;• Mutually exclusive&#10;• Collectively exhaustive"
          rows={8}
        />
      </div>
      
      {/* Speaker Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Speaker Notes</label>
        <Textarea
          value={slide.speakerNotes || ""}
          onChange={(e) => onUpdate({ speakerNotes: e.target.value })}
          placeholder="What to say when presenting this slide..."
          className="text-sm"
          rows={3}
        />
      </div>
      
      {/* Slide Type */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Slide Type</label>
          <select
            className="w-full mt-1 p-2 rounded border"
            value={slide.type}
            onChange={(e) => onUpdate({ type: e.target.value as SlideType })}
          >
            <option value="executive-summary">Executive Summary</option>
            <option value="situation">Situation</option>
            <option value="complication">Complication</option>
            <option value="resolution">Resolution</option>
            <option value="supporting-point">Supporting Point</option>
            <option value="next-steps">Next Steps</option>
          </select>
        </div>
        
        <div className="flex-1">
          <label className="text-sm font-medium">Layout</label>
          <select
            className="w-full mt-1 p-2 rounded border"
            value={slide.layout}
            onChange={(e) => onUpdate({ layout: e.target.value as Slide['layout'] })}
          >
            <option value="title-only">Title Only</option>
            <option value="title-content">Title + Content</option>
            <option value="title-chart">Title + Chart</option>
            <option value="title-2col">Title + 2 Columns</option>
            <option value="full-chart">Full Chart</option>
          </select>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Button variant="outline" size="sm">
          <BarChart3 className="h-4 w-4 mr-2" />
          Add Chart
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onUpdate({ hidden: !slide.hidden })}
        >
          {slide.hidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {slide.hidden ? "Show" : "Hide"}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Slide Preview
// ============================================================================

function SlidePreview({
  slide,
  theme,
  scale = 1,
}: {
  slide: Slide;
  theme: { colors: any; fonts: any };
  scale?: number;
}) {
  return (
    <div
      className="bg-white shadow-xl"
      style={{
        width: `${10 * scale}in`,
        height: `${7.5 * scale}in`,
        fontFamily: theme.fonts.body,
        padding: `${0.5 * scale}in`,
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          fontSize: `${28 * scale}px`,
          fontWeight: 'bold',
          lineHeight: 1.2,
          marginBottom: `${0.3 * scale}in`,
        }}
      >
        {slide.actionTitle}
      </h2>
      
      {/* Content */}
      {slide.bullets && slide.bullets.length > 0 && (
        <ul style={{ fontSize: `${20 * scale}px`, lineHeight: 1.4 }}>
          {slide.bullets.map((bullet, i) => (
            <li 
              key={i}
              style={{ 
                marginBottom: `${0.15 * scale}in`,
                color: theme.colors.text,
              }}
            >
              • {bullet}
            </li>
          ))}
        </ul>
      )}
      
      {/* Chart Placeholder */}
      {slide.chart && (
        <div
          style={{
            marginTop: `${0.3 * scale}in`,
            height: `${3 * scale}in`,
            backgroundColor: theme.colors.accent + '20',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BarChart3 style={{ color: theme.colors.accent }} size={48 * scale} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PowerPoint Export Button
// ============================================================================

export function ExportPPTXButton({ 
  presentation 
}: { 
  presentation: Presentation;
}) {
  const handleExport = () => {
    // For now, generate JSON representation
    // In production, use pptxgenjs library
    const data = JSON.stringify(presentation, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presentation.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Presentation exported (JSON format)');
  };
  
  return (
    <Button onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      Export PPTX
    </Button>
  );
}
