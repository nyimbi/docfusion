"use client";

/**
 * Speech-to-Text Input Component
 * 
 * Wraps any text input to add voice dictation capability.
 * 
 * Features:
 * - Microphone button for voice input
 * - Real-time transcription feedback
 * - Voice commands (delete that, new paragraph, etc.)
 * - Visual feedback during listening
 * - Accessibility support
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useSpeechInput, getListeningIndicatorState, SUPPORTED_LANGUAGES } from "@/lib/hdsi/speech-to-text";
import { Mic, MicOff, Loader2, Globe, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface SpeechInputProps {
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  enableCommands?: boolean;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

interface SpeechInputButtonProps {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  transcript: string;
  interimTranscript: string;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

// ============================================================================
// Speech Input Wrapper Component
// ============================================================================

export function SpeechInput(props: SpeechInputProps) {
  const { children, value, onChange, label, enableCommands = true, className, inputProps } = props;

  const { speech, isInjecting, bind } = useSpeechInput({
    initialValue: value,
    onChange,
    enableCommands,
    onCommand: (cmd, val) => {
      toast.info(`Voice command: ${cmd}`);
    },
  });

  // Update local value when external value changes
  React.useEffect(() => {
    if (value !== bind.value && !speech.isListening && !isInjecting) {
      bind.onChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [bind, isInjecting, speech.isListening, value]);

  const indicator = getListeningIndicatorState(speech.isListening, speech.isSupported, speech.error);

  return (
    <div className={cn("relative", className)}>
      {/* Input wrapper with visual feedback */}
      <div
        className={cn(
          "relative transition-all rounded-md",
          speech.isListening && "ring-2 ring-green-500 ring-opacity-50"
        )}
      >
        {children}

        {/* Speech button positioned absolutely */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <SpeechInputButton
            isListening={speech.isListening}
            isSupported={speech.isSupported}
            error={speech.error}
            transcript={speech.transcript}
            interimTranscript={speech.interimTranscript}
            onToggle={speech.toggleListening}
            size="sm"
          />
        </div>
      </div>

      {/* Live transcription overlay */}
      {speech.isListening && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="bg-background border rounded-md shadow-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: indicator.color }}>
                <Mic className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-medium">{indicator.message}</span>
              {speech.interimTranscript && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Processing...
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              {speech.transcript && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {speech.transcript}
                </p>
              )}
              {speech.interimTranscript && (
                <p className="text-sm text-foreground italic">
                  {speech.interimTranscript}
                </p>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Commands:</span>
              <Badge variant="secondary" className="text-xs">delete that</Badge>
              <Badge variant="secondary" className="text-xs">new paragraph</Badge>
              <Badge variant="secondary" className="text-xs">period</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {speech.error && !speech.isListening && (
        <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {speech.error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Speech Input Button Component
// ============================================================================

export function SpeechInputButton(props: SpeechInputButtonProps) {
  const { isListening, isSupported, error, transcript, interimTranscript, onToggle, className, size = "md" } = props;

  if (!isSupported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground/50 cursor-not-allowed", className)}
            disabled
          >
            <MicOff className={cn("text-muted-foreground/30", size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Speech recognition not supported in this browser</p>
          <p className="text-xs text-muted-foreground">Try Chrome, Edge, or Safari</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const indicator = getListeningIndicatorState(isListening, isSupported, error);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isListening ? "primary" : "ghost"}
          size="icon"
          className={cn(
            "relative transition-all",
            isListening && "bg-green-500 hover:bg-green-600 text-white",
            className
          )}
          onClick={onToggle}
        >
          {/* Pulse animation when listening */}
          {isListening && (
            <span className="absolute inset-0 rounded-full animate-ping bg-green-400 opacity-75" />
          )}

          {isListening ? (
            <Mic className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5 relative z-10")} />
          ) : (
            <Mic className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
          )}

          {/* Mini indicator dot */}
          <span
            className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white"
            style={{ backgroundColor: indicator.color }}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="space-y-1">
          <p>{isListening ? "Stop listening" : "Start voice input"}</p>
          {(transcript || interimTranscript) && (
            <p className="text-xs text-muted-foreground max-w-xs truncate">
              {interimTranscript || transcript}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Standalone Speech Input Field (for simple use cases)
// ============================================================================

interface SpeechTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

export function SpeechTextField(props: SpeechTextFieldProps) {
  const { value, onChange, placeholder, label, multiline = false, rows = 4, className } = props;

  const { speech, isInjecting, bind } = useSpeechInput({
    initialValue: value,
    onChange,
    enableCommands: true,
  });

  // Sync external value
  React.useEffect(() => {
    if (value !== bind.value && !speech.isListening && !isInjecting) {
      bind.onChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [bind, isInjecting, speech.isListening, value]);

  const inputClasses = cn(
    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "ring-offset-background placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    speech.isListening && "border-green-500 ring-1 ring-green-500",
    className
  );

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          <SpeechInputButton
            isListening={speech.isListening}
            isSupported={speech.isSupported}
            error={speech.error}
            transcript={speech.transcript}
            interimTranscript={speech.interimTranscript}
            onToggle={speech.toggleListening}
            size="sm"
          />
        </div>
      )}

      <div className="relative">
        {multiline ? (
          <textarea
            {...bind}
            rows={rows}
            placeholder={placeholder}
            className={cn(inputClasses, "min-h-[80px] resize-y")}
          />
        ) : (
          <input
            {...bind}
            type="text"
            placeholder={placeholder}
            className={inputClasses}
          />
        )}

        {/* Language selector when listening */}
        {speech.isSupported && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <select
              value={speech.language}
              onChange={(e) => speech.setLanguage(e.target.value)}
              className="text-xs bg-transparent border-none text-muted-foreground focus:outline-none cursor-pointer"
              title="Select language"
            >
              {SUPPORTED_LANGUAGES.slice(0, 5).map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.code.split("-")[0].toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Transcription feedback */}
      {(speech.isListening || speech.interimTranscript) && (
        <div className="bg-muted rounded-md p-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs text-muted-foreground">
              {speech.interimTranscript || "Listening..."}
            </span>
          </div>
        </div>
      )}

      {/* Commands hint */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Voice commands:</span>
        <span className="font-mono bg-muted px-1 rounded">delete that</span>
        <span className="font-mono bg-muted px-1 rounded">new paragraph</span>
        <span className="font-mono bg-muted px-1 rounded">period</span>
      </div>
    </div>
  );
}

// ============================================================================
// Global Speech Controller (for app-wide speech control)
// ============================================================================

interface GlobalSpeechControllerProps {
  children: React.ReactNode;
}

export function GlobalSpeechProvider({ children }: GlobalSpeechControllerProps) {
  const [activeField, setActiveField] = React.useState<string | null>(null);

  return (
    <SpeechContext.Provider value={{ activeField, setActiveField }}>
      {children}
    </SpeechContext.Provider>
  );
}

const SpeechContext = React.createContext<{
  activeField: string | null;
  setActiveField: (fieldId: string | null) => void;
}>({ activeField: null, setActiveField: () => {} });

export function useGlobalSpeech() {
  return React.useContext(SpeechContext);
}
