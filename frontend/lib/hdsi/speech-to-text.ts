"use client";

/**
 * Speech-to-Text System
 * 
 * Provides speech recognition for all editable text fields.
 * 
 * Features:
 * - Global speech input toggle
 * - Per-field speech input
 * - Voice command support ("delete that", "new paragraph")
 * - Real-time transcription
 * - Multiple language support
 * - Visual feedback during listening
 */

import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================================
// Browser Speech Recognition API type declarations
// ============================================================================

interface HDSISpeechRecognitionResultAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface HDSISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: HDSISpeechRecognitionResultAlternative;
}

interface HDSISpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: HDSISpeechRecognitionResult;
}

interface HDSISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: HDSISpeechRecognitionResultList;
}

interface HDSISpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface HDSISpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: HDSISpeechRecognitionEvent) => void) | null;
  onerror: ((event: HDSISpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type HDSISpeechRecognitionConstructor = new () => HDSISpeechRecognitionInstance;

// Narrow browser SpeechRecognition vendors without altering the DOM Window contract.
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: HDSISpeechRecognitionConstructor;
  webkitSpeechRecognition?: HDSISpeechRecognitionConstructor;
};

// ============================================================================
// Types
// ============================================================================

export interface SpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechCommand {
  command: string;
  action: string;
  handler: (text: string) => string;
}

export interface SpeechState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  language: string;
}

// ============================================================================
// Voice Commands
// ============================================================================

export const DEFAULT_SPEECH_COMMANDS: SpeechCommand[] = [
  {
    command: "delete that",
    action: "delete_last",
    handler: (text) => {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      return sentences.slice(0, -1).join(" ").trim();
    },
  },
  {
    command: "new paragraph",
    action: "new_paragraph",
    handler: (text) => text + "\n\n",
  },
  {
    command: "new line",
    action: "new_line",
    handler: (text) => text + "\n",
  },
  {
    command: "period",
    action: "insert_period",
    handler: (text) => text.trimEnd() + ". ",
  },
  {
    command: "comma",
    action: "insert_comma",
    handler: (text) => text.trimEnd() + ", ",
  },
  {
    command: "question mark",
    action: "insert_question",
    handler: (text) => text.trimEnd() + "? ",
  },
  {
    command: "exclamation mark",
    action: "insert_exclamation",
    handler: (text) => text.trimEnd() + "! ",
  },
  {
    command: "clear all",
    action: "clear",
    handler: () => "",
  },
];

// ============================================================================
// React Hook
// ============================================================================

export function useSpeechToText(options?: {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  commands?: SpeechCommand[];
  onResult?: (result: SpeechResult) => void;
  onCommand?: (command: SpeechCommand, result: SpeechResult) => void;
}) {
  const {
    language = "en-US",
    continuous = true,
    interimResults = true,
    commands = DEFAULT_SPEECH_COMMANDS,
    onResult,
    onCommand,
  } = options || {};

  const recognitionRef = useRef<HDSISpeechRecognitionInstance | null>(null);
  
  const [state, setState] = useState<SpeechState>({
    isListening: false,
    isSupported: false,
    transcript: "",
    interimTranscript: "",
    confidence: 0,
    error: null,
    language,
  });

  // Check for support
  useEffect(() => {
    const w = window as WindowWithSpeechRecognition;
    const SpeechRecognition = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | HDSISpeechRecognitionConstructor
      | undefined;
    if (SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: true }));
    } else {
      setState(prev => ({ ...prev, isSupported: false, error: "Speech recognition not supported" }));
    }
  }, []);

  // Initialize recognition
  useEffect(() => {
    const w = window as WindowWithSpeechRecognition;
    const SpeechRecognition = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | HDSISpeechRecognitionConstructor
      | undefined;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }));
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onresult = (event: HDSISpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          
          // Check for commands
          const lowerTranscript = transcript.toLowerCase().trim();
          const matchedCommand = commands.find(cmd => 
            lowerTranscript.includes(cmd.command.toLowerCase())
          );

          if (matchedCommand && onCommand) {
            onCommand(matchedCommand, { transcript, confidence, isFinal: true });
          } else if (onResult) {
            onResult({ transcript, confidence, isFinal: true });
          }

          setState(prev => ({
            ...prev,
            transcript: prev.transcript + transcript,
            confidence,
          }));
        } else {
          interimTranscript += transcript;
        }
      }

      setState(prev => ({
        ...prev,
        interimTranscript,
      }));
    };

    recognition.onerror = (event: HDSISpeechRecognitionErrorEvent) => {
      setState(prev => ({
        ...prev,
        error: event.error || "Speech recognition error",
        isListening: false,
      }));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [language, continuous, interimResults, commands, onResult, onCommand]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: "",
      interimTranscript: "",
      confidence: 0,
    }));
  }, []);

  const setLanguage = useCallback((newLanguage: string) => {
    setState(prev => ({ ...prev, language: newLanguage }));
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLanguage;
    }
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setLanguage,
    commands,
  };
}

// ============================================================================
// Input Integration Hook
// ============================================================================

interface UseSpeechInputOptions {
  initialValue?: string;
  onChange?: (value: string) => void;
  onCommand?: (command: string, currentValue: string) => void;
  enableCommands?: boolean;
}

export function useSpeechInput(options: UseSpeechInputOptions = {}) {
  const { initialValue = "", onChange, onCommand, enableCommands = true } = options;
  
  const [value, setValue] = useState(initialValue);
  const [isInjecting, setIsInjecting] = useState(false);
  const lastTranscriptRef = useRef("");

  const handleSpeechResult = useCallback((result: SpeechResult) => {
    if (!result.isFinal) return;

    // Check for command if enabled
    if (enableCommands) {
      const lowerTranscript = result.transcript.toLowerCase().trim();
      const matchedCommand = DEFAULT_SPEECH_COMMANDS.find(cmd =>
        lowerTranscript.includes(cmd.command.toLowerCase())
      );

      if (matchedCommand) {
        setValue(prev => {
          const newValue = matchedCommand.handler(prev);
          onChange?.(newValue);
          onCommand?.(matchedCommand.action, newValue);
          return newValue;
        });
        return;
      }
    }

    // Append transcript
    setIsInjecting(true);
    setValue(prev => {
      // Calculate diff from last transcript to handle duplicates
      const newPart = result.transcript.startsWith(lastTranscriptRef.current)
        ? result.transcript.slice(lastTranscriptRef.current.length)
        : result.transcript;
      
      lastTranscriptRef.current = result.transcript;
      
      const separator = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
      const newValue = prev + separator + newPart.trim();
      onChange?.(newValue);
      return newValue;
    });
    
    setTimeout(() => setIsInjecting(false), 100);
  }, [onChange, onCommand, enableCommands]);

  const handleSpeechCommand = useCallback((command: SpeechCommand) => {
    setValue(prev => {
      const newValue = command.handler(prev);
      onChange?.(newValue);
      onCommand?.(command.action, newValue);
      return newValue;
    });
  }, [onChange, onCommand]);

  const speech = useSpeechToText({
    onResult: handleSpeechResult,
    onCommand: handleSpeechCommand,
    continuous: true,
    interimResults: true,
  });

  const setValueWithCallback = useCallback((newValue: string) => {
    setValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  return {
    value,
    setValue: setValueWithCallback,
    speech,
    isInjecting,
    // Helpers for form integration
    bind: {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(e.target.value);
        onChange?.(e.target.value);
      },
    },
  };
}

// ============================================================================
// Language Support
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
];

// ============================================================================
// Visual Feedback Component Helpers
// ============================================================================

export function getListeningIndicatorState(
  isListening: boolean,
  isSupported: boolean,
  error: string | null
): { color: string; message: string; icon: "mic" | "mic-off" | "error" } {
  if (!isSupported) {
    return { color: "#9ca3af", message: "Not supported", icon: "mic-off" };
  }
  if (error) {
    return { color: "#dc2626", message: "Error", icon: "error" };
  }
  if (isListening) {
    return { color: "#10b981", message: "Listening...", icon: "mic" };
  }
  return { color: "#6b7280", message: "Click to speak", icon: "mic" };
}

// ============================================================================
// Accessibility Helpers
// ============================================================================

export function createAriaLabelForSpeechButton(
  isListening: boolean,
  fieldLabel?: string
): string {
  const base = fieldLabel ? `voice input for ${fieldLabel}` : "voice input";
  if (isListening) {
    return `Stop listening to ${base}. Currently recording.`;
  }
  return `Start ${base}. Click to begin speech recognition.`;
}
