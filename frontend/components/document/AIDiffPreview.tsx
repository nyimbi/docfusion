"use client";

/**
 * AI Diff Preview Component
 * 
 * Cursor-style edit preview showing AI edits as diffs before applying.
 * Users can accept or reject each individual change.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

import {
  useAIDiffPreview,
  generateDiff,
  type TextChange,
  type DiffResult,
  type PreviewSession,
  estimateReadingImpact,
} from "@/lib/hdsi/ai-diff-preview";
import {
  Check,
  X,
  CheckCheck,
  XCircle,
  RotateCcw,
  FileText,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Sparkles,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface AIDiffPreviewProps {
  nodeId: string;
  nodeTitle: string;
  originalText: string;
  onApply: (finalText: string) => void;
  onClose: () => void;
  granularity?: "word" | "sentence" | "paragraph";
}

interface DiffViewerProps {
  changes: TextChange[];
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  viewMode?: "split" | "unified";
}

// ============================================================================
// Main Component
// ============================================================================

export function AIDiffPreview(props: AIDiffPreviewProps) {
  const {
    nodeId,
    nodeTitle,
    originalText,
    onApply,
    onClose,
    granularity = "sentence",
  } = props;

  const {
    activeSession,
    createSession,
    updateChangeStatus,
    acceptAll,
    rejectAll,
    applySession,
    getAcceptanceStats,
    closeSession,
  } = useAIDiffPreview();

  const [generatedText, setGeneratedText] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"split" | "unified">("unified");

  // Create session when generated text changes
  React.useEffect(() => {
    if (!generatedText || generatedText === originalText) return;

    const session = createSession(
      nodeId,
      nodeTitle,
      originalText,
      generatedText,
      granularity
    );

    return () => {
      if (session.id) closeSession(session.id);
    };
  }, [generatedText]);

  // Generate AI suggestions using the completion API
  const handleGenerate = React.useCallback(async () => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/v1/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a professional writing assistant. Improve the given text for clarity, grammar, and readability while preserving its meaning and tone.

Your task is to enhance the text at the ${granularity} level - make targeted improvements to individual ${granularity}s rather than rewriting everything.

Output ONLY the improved text, no explanations or commentary.`,
            },
            {
              role: "user",
              content: `Please improve this text:\n\n${originalText}`,
            },
          ],
          temperature: 0.7,
          maxTokens: 2048,
        }),
      });

      if (!response.ok) {
        throw new Error("AI generation failed");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedText(data.content || originalText);
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error("Failed to generate AI suggestions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [originalText, granularity]);

  // Handle apply
  const handleApply = React.useCallback(() => {
    if (!activeSession) return;

    const finalText = applySession(activeSession.id);
    if (finalText) {
      onApply(finalText);
      toast.success("Changes applied successfully");
    }
  }, [activeSession, applySession, onApply]);

  const stats = activeSession ? getAcceptanceStats(activeSession.id) : null;

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">AI Edit Suggestions</h3>
              <p className="text-xs text-muted-foreground">
                Review and approve changes before applying
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!activeSession ? (
          // Initial State - No generated text yet
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">Generate AI Suggestions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                AI will analyze your content and suggest improvements. You can
                review each change and decide which to apply.
              </p>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Suggestions
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Granularity: {" "}
                  <span className="font-medium capitalize">{granularity}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Preview State - Show diff
          <>
            {/* Toolbar */}
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                    {stats?.accepted || 0} Accepted
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5" />
                    {stats?.rejected || 0} Rejected
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                    {stats?.pending || 0} Pending
                  </Badge>
                </div>

                <Separator orientation="vertical" className="h-4" />

                <div className="text-xs text-muted-foreground">
                  {stats && stats.total > 0 && (
                    <span>
                      {Math.round(((stats.accepted + stats.rejected) / stats.total) * 100)}% reviewed
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const sessionId = activeSession.id;
                    // Show confirmation if there are pending changes
                    const pending = stats?.pending || 0;
                    if (pending > 0) {
                      if (confirm(`${pending} changes still pending. Reject all?`)) {
                        rejectAll(sessionId);
                      }
                    } else {
                      rejectAll(sessionId);
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject All
                </Button>
                <Button variant="outline" size="sm" onClick={() => acceptAll(activeSession.id)}>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Accept All
                </Button>
              </div>
            </div>

            {/* Progress */}
            {stats && (
              <div className="px-4 py-2 border-b bg-muted/20">
                <Progress
                  value={stats.total > 0 ? ((stats.accepted + stats.rejected) / stats.total) * 100 : 0}
                  className="h-1"
                />
              </div>
            )}

            {/* Diff Content */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <DiffViewerV2
                    changes={activeSession.diffResult.changes}
                    onAcceptChange={id => activeSession && updateChangeStatus(activeSession.id, id, true)}
                    onRejectChange={id => activeSession && updateChangeStatus(activeSession.id, id, false)}
                  />
                </div>
              </ScrollArea>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const impact = estimateReadingImpact(originalText, generatedText);
                    return (
                      <span>
                        Est. reading time: {impact.estimatedTime} (
                        {impact.wordCountDelta > 0 ? "+" : ""}
                        {impact.wordCountDelta} words)
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => { onClose(); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleApply} disabled={stats?.accepted === 0 && stats?.rejected === 0}>
                    <Check className="h-4 w-4 mr-2" />
                    Apply Changes ({stats?.accepted || 0})
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Diff Viewer Component
// ============================================================================

function DiffViewerV2(props: {
  changes: TextChange[];
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
}) {
  const { changes, onAcceptChange, onRejectChange } = props;

  const [expandedGroups, setExpandedGroups] = React.useState<Set<number>>(new Set([0]));

  return (
    <div className="space-y-2">
      {changes.map((change, index) => (
        <DiffChangeRowV2
          key={change.id}
          change={change}
          index={index}
          total={changes.length}
          onAccept={() => onAcceptChange(change.id)}
          onReject={() => onRejectChange(change.id)}
          isExpanded={expandedGroups.has(index)}
          onToggle={() => {
            const next = new Set(expandedGroups);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            setExpandedGroups(next);
          }}
        />
      ))}
    </div>
  );
}

function DiffChangeRowV2(props: {
  change: TextChange;
  index: number;
  total: number;
  onAccept: () => void;
  onReject: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { change, index, total, onAccept, onReject, isExpanded, onToggle } = props;

  const status = change.isAccepted;

  const statusConfig = {
    true: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", dot: "bg-green-500" },
    false: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" },
    null: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  };

  const config = statusConfig[String(status) as "true" | "false" | "null"];

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        config.bg,
        config.border,
        status === false && "opacity-60"
      )}
    >
      <div className="flex items-start p-3">
        {/* Drag Handle */}
        <div className="mt-0.5 mr-2 text-muted-foreground/50">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Change Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("w-2 h-2 rounded-full", config.dot)} />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {change.type}
            </span>
            <span className="text-xs text-muted-foreground">
              #{index + 1} of {total}
            </span>
          </div>

          <div className={cn("text-sm", config.text)}>
            {change.type === "removed" ? (
              <span className="line-through decoration-red-400 decoration-2">
                {change.value}
              </span>
            ) : change.type === "added" ? (
              <span className="font-medium">{change.value}</span>
            ) : (
              <span className="text-muted-foreground">{change.value}</span>
            )}
          </div>

          {change.explanation && isExpanded && (
            <div className="mt-2 text-xs text-muted-foreground bg-background/50 rounded p-2">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              {change.explanation}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={status === true ? "primary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={onAccept}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={status === false ? "primary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={onReject}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject</TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label={isExpanded ? "Collapse diff" : "Expand diff"}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}



