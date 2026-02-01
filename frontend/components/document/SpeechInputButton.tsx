"use client";

/**
 * Speech Input Button - Standalone voice input control
 * 
 * Features:
 * - Toggle listening with visual feedback
 * - Real-time transcript display
 * - Error handling
 * - Mini mode for toolbar integration
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useSpeechInput } from "@/lib/hdsi/speech-to-text";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface SpeechInputButtonProps {
  onToggle?: () => void;
  onResult?: (text: string) => void;
  isListening?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SpeechInputButton({
  onToggle,
  onResult,
  isListening: controlledListening,
  size = "sm",
  className,
}: SpeechInputButtonProps) {
  const { speech } = useSpeechInput({
    onChange: (value: string) => {
      if (value && onResult) {
        onResult(value);
        speech.resetTranscript();
      }
    },
    onCommand: (cmd: string, val?: string) => {
      toast.info(`Voice command: ${cmd}${val ? ` "${val}"` : ""}`);
    },
  });

  const isListening = controlledListening !== undefined ? controlledListening : speech.isListening;
  const isSupported = speech.isSupported;
  const error = speech.error;

  const handleToggle = () => {
    if (!isSupported) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    speech.toggleListening();
    onToggle?.();
  };

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button
            variant={isListening ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              sizeClasses[size],
              "relative",
              isListening && "bg-green-100 hover:bg-green-200 text-green-700",
              !isSupported && "opacity-50",
              className
            )}
            onClick={handleToggle}
            disabled={!isSupported || false}
          >
            {false ? (
              <Loader2 className={cn(iconSizes[size], "animate-spin")} />
            ) : isListening ? (
              <Mic className={cn(iconSizes[size], "animate-pulse")} />
            ) : (
              <MicOff className={iconSizes[size]} />
            )}

            {/* Listening Animation Ring */}
            {isListening && (
              <span className="absolute inset-0 rounded-md ring-2 ring-green-500 ring-offset-2 animate-pulse" />
            )}
          </Button>

          {/* Live Transcript Badge */}
          {isListening && speech.transcript && (
            <Badge
              variant="secondary"
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs px-2 py-0.5 bg-green-100 text-green-700"
            >
              {speech.transcript.slice(0, 20)}...
            </Badge>
          )}

          {/* Error Indicator */}
          {error && (
            <div className="absolute -top-1 -right-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {!isSupported ? (
          "Speech recognition not supported"
        ) : isListening ? (
          <div className="text-center">
            <p className="font-medium">Listening...</p>
            {speech.transcript && <p className="text-xs text-muted-foreground max-w-[200px] truncate">{speech.transcript}</p>}
          </div>
        ) : (
          "Click to start voice input"
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default SpeechInputButton;
