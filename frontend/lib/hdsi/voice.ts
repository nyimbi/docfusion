"use client";

/**
 * Voice Interface for HDSI
 * Whisper integration for hands-free structure editing
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { HDSINode } from "./types";

// ============================================================================
// Types
// ============================================================================

export type VoiceCommandType = 
  | "add_node"
  | "delete_node"
  | "move_node"
  | "rename_node"
  | "generate_content"
  | "expand_node"
  | "collapse_node"
  | "select_node"
  | "undo"
  | "redo"
  | "save"
  | "unknown";

export interface VoiceCommand {
  type: VoiceCommandType;
  confidence: number;  // Whisper confidence 0-1
  rawText: string;
  entities: {
    targetNode?: string;
    newName?: string;
    parentNode?: string;
    position?: "before" | "after" | "child";
    nodeType?: "chapter" | "section" | "subsection" | "paragraph";
  };
  parsedAt: Date;
}

export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  lastCommand: VoiceCommand | null;
  error: string | null;
  permissions: "granted" | "denied" | "prompt" | "unknown";
}

// ============================================================================
// Command Patterns
export // ============================================================================

interface CommandPattern {
  type: VoiceCommandType;
  patterns: RegExp[];
  extractEntities: (match: RegExpMatchArray, text: string) => VoiceCommand["entities"];
}

export const COMMAND_PATTERNS: CommandPattern[] = [
  {
    type: "add_node",
    patterns: [
      /add\s+(?:a\s+)?(?:new\s+)?(chapter|section|subsection|paragraph)\s+(?:called|named|titled)?\s*["']?([^"']+)["']?/i,
      /add\s+(?:a\s+)?(?:new\s+)?(?:node|item)\s+(?:called|named|titled)?\s*["']?([^"']+)["']?/i,
      /create\s+(?:a\s+)?(?:new\s+)?(chapter|section|subsection|paragraph)\s+(?:called|named|titled)?\s*["']?([^"']+)["']?/i,
      /insert\s+(?:a\s+)?(?:new\s+)?(chapter|section|subsection|paragraph)\s+(?:called|named|titled)?\s*["']?([^"']+)["']?\s+(?:as\s+)?(?:a\s+)?(child|under|in)\s+(?:the\s+)?["']?([^"']+)["']?/i,
    ],
    extractEntities: (match, text) => {
      // Try to find parent if mentioned
      const parentMatch = text.match(/(?:under|in|as a child of)\s+(?:the\s+)?["']?([^"']+)["']?/i);
      return {
        nodeType: (match[1] as HDSINode["type"]) || "section",
        newName: match[2] || match[3],
        parentNode: parentMatch ? parentMatch[1] : undefined,
        position: text.includes("before") ? "before" : text.includes("after") ? "after" : "child",
      };
    },
  },
  
  {
    type: "delete_node",
    patterns: [
      /delete\s+(?:the\s+)?(?:node\s+)?["']?([^"']+)["']?/i,
      /remove\s+(?:the\s+)?(?:node\s+)?["']?([^"']+)["']?/i,
      /delete\s+(?:the\s+)?(chapter|section|subsection|paragraph)\s+(?:called|named)?\s*["']?([^"']+)["']?/i,
      /remove\s+(?:the\s+)?(last\s+)?(chapter|section|subsection|paragraph)/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1] || match[2],
    }),
  },
  
  {
    type: "move_node",
    patterns: [
      /move\s+(?:the\s+)?["']?([^"']+)["']?\s+(?:to\s+)?(before|after|under|in)\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /move\s+(?:the\s+)?["']?([^"']+)["']?\s+to\s+(?:be\s+)?(?:a\s+)?(child|sibling)\s+(?:of\s+)?["']?([^"']+)["']?/i,
      /reparent\s+(?:the\s+)?["']?([^"']+)["']?\s+(?:to|under)\s+(?:the\s+)?["']?([^"']+)["']?/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1],
      parentNode: match[3] || match[4],
      position: match[2] === "before" ? "before" : match[2] === "after" ? "after" : "child",
    }),
  },
  
  {
    type: "rename_node",
    patterns: [
      /rename\s+(?:the\s+)?["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
      /change\s+(?:the\s+)?name\s+(?:of\s+)?["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i,
      /call\s+(?:the\s+)?["']?([^"']+)["']?\s+["']?([^"']+)["']?/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1],
      newName: match[2],
    }),
  },
  
  {
    type: "generate_content",
    patterns: [
      /generate\s+(?:content\s+)?(?:for\s+)?["']?([^"']+)["']?/i,
      /write\s+(?:the\s+)?content\s+(?:for\s+)?["']?([^"']+)["']?/i,
      /create\s+(?:content\s+)?(?:for\s+)?["']?([^"']+)["']?/i,
      /fill\s+in\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /generate\s+all/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1] || "all",
    }),
  },
  
  {
    type: "expand_node",
    patterns: [
      /expand\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /open\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /show\s+(?:the\s+)?(?:children\s+of\s+)?["']?([^"']+)["']?/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1],
    }),
  },
  
  {
    type: "collapse_node",
    patterns: [
      /collapse\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /close\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /hide\s+(?:the\s+)?(?:children\s+of\s+)?["']?([^"']+)["']?/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1],
    }),
  },
  
  {
    type: "select_node",
    patterns: [
      /select\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /go\s+to\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /navigate\s+to\s+(?:the\s+)?["']?([^"']+)["']?/i,
      /focus\s+(?:on\s+)?(?:the\s+)?["']?([^"']+)["']?/i,
    ],
    extractEntities: (match) => ({
      targetNode: match[1],
    }),
  },
  
  {
    type: "undo",
    patterns: [
      /undo\s*(?:that\s*)?/i,
      /go\s+back/i,
      /revert\s*(?:that\s*)?/i,
    ],
    extractEntities: () => ({}),
  },
  
  {
    type: "redo",
    patterns: [
      /redo\s*(?:that\s*)?/i,
      /do\s+that\s+again/i,
    ],
    extractEntities: () => ({}),
  },
  
  {
    type: "save",
    patterns: [
      /save\s*(?:the\s*document\s*)?/i,
      /save\s+my\s+(?:work|changes)/i,
    ],
    extractEntities: () => ({}),
  },
];

// ============================================================================
// Command Parser
// ============================================================================

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const normalized = transcript.toLowerCase().trim();
  
  for (const commandDef of COMMAND_PATTERNS) {
    for (const pattern of commandDef.patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return {
          type: commandDef.type,
          confidence: 0.8 + (match[0].length / transcript.length) * 0.2,
          rawText: transcript,
          entities: commandDef.extractEntities(match, normalized),
          parsedAt: new Date(),
        };
      }
    }
  }
  
  return {
    type: "unknown",
    confidence: 0,
    rawText: transcript,
    entities: {},
    parsedAt: new Date(),
  };
}

// ============================================================================
// Web Speech API Support
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ============================================================================
// Voice Manager
// ============================================================================

export class VoiceManager {
  private recognition: SpeechRecognition | null = null;
  private listeners = new Set<(state: VoiceState) => void>();
  private state: VoiceState = {
    isListening: false,
    isProcessing: false,
    transcript: "",
    lastCommand: null,
    error: null,
    permissions: "unknown",
  };

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      this.updateState({ error: "Speech recognition not supported in this browser" });
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.updateState({ isListening: true, error: null });
    };

    this.recognition.onend = () => {
      this.updateState({ isListening: false });
    };

    this.recognition.onresult = (event) => {
      const results = event.results;
      if (results.length > 0) {
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript;
        const isFinal = lastResult.isFinal;

        this.updateState({ transcript });

        if (isFinal) {
          this.processCommand(transcript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      this.updateState({ 
        error: event.error,
        isListening: false,
      });
    };
  }

  async requestPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
      this.updateState({ permissions: result.state as VoiceState["permissions"] });
      
      if (result.state === "granted") {
        return true;
      }
      
      // Try to trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.updateState({ permissions: "granted" });
      return true;
    } catch {
      this.updateState({ permissions: "denied" });
      return false;
    }
  }

  startListening() {
    if (!this.recognition) {
      this.updateState({ error: "Speech recognition not available" });
      return;
    }

    this.requestPermission().then(granted => {
      if (granted) {
        try {
          this.recognition?.start();
        } catch (error) {
          // Already started
        }
      }
    });
  }

  stopListening() {
    this.recognition?.stop();
  }

  private processCommand(transcript: string) {
    this.updateState({ isProcessing: true });
    
    const command = parseVoiceCommand(transcript);
    
    this.updateState({
      lastCommand: command,
      isProcessing: false,
    });

    return command;
  }

  private updateState(partial: Partial<VoiceState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: VoiceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Emit current state
    return () => this.listeners.delete(listener);
  }

  getState(): VoiceState {
    return { ...this.state };
  }
}

// ============================================================================
// React Hook
// ============================================================================

export function useVoiceInterface() {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    transcript: "",
    lastCommand: null,
    error: null,
    permissions: "unknown",
  });
  
  const managerRef = useRef<VoiceManager | null>(null);

  useEffect(() => {
    managerRef.current = new VoiceManager();
    const unsubscribe = managerRef.current.subscribe(setState);
    
    // Request permission on mount
    managerRef.current.requestPermission();
    
    return () => {
      unsubscribe();
      managerRef.current?.stopListening();
    };
  }, []);

  const startListening = useCallback(() => {
    managerRef.current?.startListening();
  }, []);

  const stopListening = useCallback(() => {
    managerRef.current?.stopListening();
  }, []);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    isSupported: typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}

// ============================================================================
// Command Executor
// ============================================================================

export interface CommandExecutor {
  addNode: (name: string, type: HDSINode["type"], parentId?: string, position?: "before" | "after" | "child") => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, targetId: string, position: "before" | "after" | "child") => void;
  renameNode: (nodeId: string, newName: string) => void;
  generateContent: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  findNodeByName: (name: string) => { id: string; node: HDSINode } | null;
}

export function executeVoiceCommand(
  command: VoiceCommand,
  executor: CommandExecutor,
  options: { confirmDestructive?: boolean } = {}
): { success: boolean; message: string } {
  const { type, entities } = command;

  // Helper to resolve node name to ID
  const resolveNode = (name?: string) => {
    if (!name) return null;
    return executor.findNodeByName(name);
  };

  switch (type) {
    case "add_node": {
      const parent = resolveNode(entities.parentNode);
      executor.addNode(
        entities.newName || "New Section",
        entities.nodeType || "section",
        parent?.id,
        entities.position || "child"
      );
      return { success: true, message: `Added "${entities.newName}"` };
    }

    case "delete_node": {
      const target = resolveNode(entities.targetNode);
      if (!target) {
        return { success: false, message: `Could not find "${entities.targetNode}"` };
      }
      if (options.confirmDestructive) {
        // Would show confirmation UI
        executor.deleteNode(target.id);
      } else {
        executor.deleteNode(target.id);
      }
      return { success: true, message: `Deleted "${target.node.title}"` };
    }

    case "move_node": {
      const target = resolveNode(entities.targetNode);
      const parent = resolveNode(entities.parentNode);
      if (!target) {
        return { success: false, message: `Could not find "${entities.targetNode}"` };
      }
      executor.moveNode(target.id, parent?.id || "", entities.position || "child");
      return { success: true, message: `Moved "${target.node.title}"` };
    }

    case "rename_node": {
      const target = resolveNode(entities.targetNode);
      if (!target) {
        return { success: false, message: `Could not find "${entities.targetNode}"` };
      }
      executor.renameNode(target.id, entities.newName || target.node.title);
      return { success: true, message: `Renamed to "${entities.newName}"` };
    }

    case "generate_content": {
      if (entities.targetNode === "all") {
        // Would trigger generate all
        return { success: true, message: "Generating all content" };
      }
      const target = resolveNode(entities.targetNode);
      if (!target) {
        return { success: false, message: `Could not find "${entities.targetNode}"` };
      }
      executor.generateContent(target.id);
      return { success: true, message: `Generating content for "${target.node.title}"` };
    }

    case "expand_node": {
      const target = resolveNode(entities.targetNode);
      if (target) {
        executor.expandNode(target.id);
        return { success: true, message: `Expanded "${target.node.title}"` };
      }
      return { success: false, message: `Could not find "${entities.targetNode}"` };
    }

    case "collapse_node": {
      const target = resolveNode(entities.targetNode);
      if (target) {
        executor.collapseNode(target.id);
        return { success: true, message: `Collapsed "${target.node.title}"` };
      }
      return { success: false, message: `Could not find "${entities.targetNode}"` };
    }

    case "select_node": {
      const target = resolveNode(entities.targetNode);
      if (target) {
        executor.selectNode(target.id);
        return { success: true, message: `Selected "${target.node.title}"` };
      }
      return { success: false, message: `Could not find "${entities.targetNode}"` };
    }

    case "undo":
      executor.undo();
      return { success: true, message: "Undid last action" };

    case "redo":
      executor.redo();
      return { success: true, message: "Redid last action" };

    case "save":
      executor.save();
      return { success: true, message: "Document saved" };

    case "unknown":
      return { success: false, message: "I didn't understand that command" };

    default:
      return { success: false, message: "Unknown command type" };
  }
}
