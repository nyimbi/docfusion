"use client";

/**
 * Visual Generation for Diagrams
 * DALL-E, Mermaid.js, and other diagram types
 */

import { useState, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type DiagramType = 
  | "architecture"    // System architecture diagrams
  | "flowchart"       // Process flowcharts
  | "sequence"        // Sequence diagrams
  | "class"           // UML class diagrams
  | "er"              // Entity relationship
  | "mindmap"         // Mind maps
  | "gantt"           // Project timelines
  | "state"           // State machines
  | "infographic"     // Data visualization
  | "concept";        // Concept illustrations

export interface DiagramGeneration {
  type: DiagramType;
  prompt: string;
  format: "mermaid" | "svg" | "png" | "url";
  content: string;
  caption?: string;
  altText: string;
  generatedAt: Date;
  model: string;
}

export interface MermaidConfig {
  theme: "default" | "forest" | "dark" | "neutral";
  securityLevel: "strict" | "loose" | "antiscript";
  startOnLoad: boolean;
}

export interface DalleConfig {
  size: "1024x1024" | "1792x1024" | "1024x1792";
  quality: "standard" | "hd";
  style: "vivid" | "natural";
}

// ============================================================================
// Mermaid Templates
// ============================================================================

const MERMAID_TEMPLATES: Record<string, (description: string) => string> = {
  flowchart: (desc) => `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
    
    %% Description: ${desc}`,

  sequence: (desc) => `sequenceDiagram
    participant A as User
    participant B as System
    participant C as Database
    
    A->>B: Request
    B->>C: Query
    C-->>B: Data
    B-->>A: Response
    
    %% Description: ${desc}`,

  class: (desc) => `classDiagram
    class Base {
      +id: string
      +name: string
      +createdAt: Date
    }
    
    class Derived {
      +specificField: string
      +method(): void
    }
    
    Base <|-- Derived
    
    %% Description: ${desc}`,

  er: (desc) => `erDiagram
    USER ||--o{ ORDER : places
    USER {
      string id
      string name
      string email
    }
    ORDER {
      string id
      date createdAt
      float total
    }
    
    %% Description: ${desc}`,

  mindmap: (desc) => `mindmap
    root((Topic))
      Child1
        Grandchild1
        Grandchild2
      Child2
        Grandchild3
      Child3
    
    %% Description: ${desc}`,

  gantt: (desc) => `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    
    section Phase 1
    Task 1 :a1, 2024-01-01, 7d
    Task 2 :after a1, 14d
    
    section Phase 2
    Task 3 :2024-01-15, 10d
    
    %% Description: ${desc}`,

  state: (desc) => `stateDiagram-v2
    [*] --> Idle
    Idle --> Active: Trigger
    Active --> Processing: Start
    Processing --> Complete: Success
    Processing --> Error: Failure
    Complete --> [*]
    Error --> Idle: Retry
    
    %% Description: ${desc}`,
};

// ============================================================================
// Diagram Generation Functions
// ============================================================================

/**
 * Generate diagram using Mermaid.js
 */
export async function generateMermaidDiagram(
  description: string,
  type: DiagramType,
  config?: Partial<MermaidConfig>
): Promise<DiagramGeneration> {
  const template = MERMAID_TEMPLATES[type] || MERMAID_TEMPLATES.flowchart;
  const mermaidCode = template(description);
  
  return {
    type,
    prompt: description,
    format: "mermaid",
    content: mermaidCode,
    caption: `Mermaid ${type} diagram: ${description.slice(0, 50)}`,
    altText: `${type} diagram showing ${description}`,
    generatedAt: new Date(),
    model: "mermaid-js",
  };
}

/**
 * Generate diagram illustration using DALL-E
 * Note: Requires DALL-E API integration (OpenAI Images API)
 */
export async function generateDalleDiagram(
  description: string,
  type: DiagramType,
  config?: Partial<DalleConfig>
): Promise<DiagramGeneration> {
  const fullPrompt = buildDallePrompt(description, type);

  try {
    // Call image generation API
    const response = await fetch('/api/v1/ai/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: fullPrompt,
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        ...config
      })
    });

    if (!response.ok) {
      throw new Error('Image generation API not available');
    }

    const data = await response.json();

    return {
      type,
      prompt: fullPrompt,
      format: "url",
      content: data.url || data.imageUrl,
      caption: `${type} illustration: ${description.slice(0, 50)}`,
      altText: `${type} diagram showing ${description}`,
      generatedAt: new Date(),
      model: "dall-e-3",
    };
  } catch (error) {
    console.error('DALL-E generation error:', error);
    // Return a placeholder indicating the feature requires API setup
    // Using "url" format but with empty content to indicate failure
    return {
      type,
      prompt: fullPrompt,
      format: "url",
      content: "", // Empty indicates generation failed
      caption: `${type} illustration unavailable - DALL-E API not configured`,
      altText: `${type} diagram placeholder`,
      generatedAt: new Date(),
      model: "dall-e-3",
    };
  }
}

/**
 * Generate SVG diagram
 */
export async function generateSvgDiagram(
  description: string,
  type: DiagramType
): Promise<DiagramGeneration> {
  // Use simple SVG shapes or Satori for more complex diagrams
  const svgContent = generateSimpleSvg(description, type);
  
  return {
    type,
    prompt: description,
    format: "svg",
    content: svgContent,
    caption: `SVG ${type} diagram`,
    altText: `${type} diagram showing ${description}`,
    generatedAt: new Date(),
    model: "svg-generator",
  };
}

/**
 * Auto-detect and generate appropriate diagram
 */
export async function autoGenerateDiagram(
  description: string,
  options: {
    preferFormat?: "mermaid" | "dalle" | "svg";
    diagramType?: DiagramType;
  } = {}
): Promise<DiagramGeneration> {
  const { preferFormat = "mermaid" } = options;
  
  // Detect diagram type from description if not provided
  const detectedType = options.diagramType || detectDiagramType(description);
  
  switch (preferFormat) {
    case "dalle":
      return generateDalleDiagram(description, detectedType);
    case "svg":
      return generateSvgDiagram(description, detectedType);
    case "mermaid":
    default:
      return generateMermaidDiagram(description, detectedType);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function detectDiagramType(description: string): DiagramType {
  const text = description.toLowerCase();
  
  if (text.includes("flow") || text.includes("process") || text.includes("workflow")) {
    return "flowchart";
  }
  if (text.includes("sequence") || text.includes("interaction") || text.includes("api")) {
    return "sequence";
  }
  if (text.includes("class") || text.includes("object") || text.includes("uml")) {
    return "class";
  }
  if (text.includes("entity") || text.includes("database") || text.includes("relationship")) {
    return "er";
  }
  if (text.includes("mind") || text.includes("brainstorm") || text.includes("map")) {
    return "mindmap";
  }
  if (text.includes("timeline") || text.includes("schedule") || text.includes("gantt")) {
    return "gantt";
  }
  if (text.includes("state") || text.includes("finite") || text.includes("machine")) {
    return "state";
  }
  if (text.includes("architecture") || text.includes("system") || text.includes("infrastructure")) {
    return "architecture";
  }
  if (text.includes("data") || text.includes("chart") || text.includes("metric")) {
    return "infographic";
  }
  
  return "concept";
}

function buildDallePrompt(description: string, type: DiagramType): string {
  const basePrompt = `Professional ${type} diagram, technical illustration, clean design, labeled components, white background, vector-style, enterprise documentation quality, detailed and clear`;
  
  return `${basePrompt}. ${description}`;
}

function generateSimpleSvg(description: string, type: DiagramType): string {
  // Generate a simple placeholder SVG
  const colors: Record<DiagramType, string> = {
    architecture: "#3b82f6",
    flowchart: "#10b981",
    sequence: "#f59e0b",
    class: "#8b5cf6",
    er: "#ef4444",
    mindmap: "#ec4899",
    gantt: "#6366f1",
    state: "#14b8a6",
    infographic: "#f97316",
    concept: "#6b7280",
  };
  
  const color = colors[type] || colors.concept;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <rect width="100%" height="100%" fill="#f9fafb"/>
    <rect x="20" y="20" width="360" height="260" rx="8" fill="white" stroke="#e5e7eb" stroke-width="2"/>
    <text x="200" y="50" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="600" fill="#374151">
      ${type.charAt(0).toUpperCase() + type.slice(1)} Diagram
    </text>
    <rect x="50" y="80" width="300" height="160" rx="4" fill="${color}20" stroke="${color}" stroke-width="2" stroke-dasharray="5,5"/>
    <text x="200" y="165" text-anchor="middle" font-family="system-ui" font-size="12" fill="#6b7280">
      ${description.slice(0, 40)}${description.length > 40 ? "..." : ""}
    </text>
    <text x="200" y="250" text-anchor="middle" font-family="system-ui" font-size="10" fill="#9ca3af">
      Generated diagram placeholder
    </text>
  </svg>`;
}

// ============================================================================
// React Hooks
// ============================================================================

export function useDiagramGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagram, setDiagram] = useState<DiagramGeneration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    description: string,
    type: DiagramType,
    format: "mermaid" | "dalle" | "svg" = "mermaid"
  ) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      let result: DiagramGeneration;
      
      switch (format) {
        case "dalle":
          result = await generateDalleDiagram(description, type);
          break;
        case "svg":
          result = await generateSvgDiagram(description, type);
          break;
        case "mermaid":
        default:
          result = await generateMermaidDiagram(description, type);
      }
      
      setDiagram(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate diagram";
      setError(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const autoGenerate = useCallback(async (
    description: string,
    options?: Parameters<typeof autoGenerateDiagram>[1]
  ) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await autoGenerateDiagram(description, options);
      setDiagram(result);
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setDiagram(null);
    setError(null);
  }, []);

  return {
    diagram,
    isGenerating,
    error,
    generate,
    autoGenerate,
    clear,
  };
}

// ============================================================================
// Batch Operations
// ============================================================================

export async function generateDiagramsForDocument(
  sections: Array<{ id: string; title: string; content?: string }>,
  options: {
    preferFormat?: "mermaid" | "dalle" | "svg";
    autoDetect?: boolean;
  } = {}
): Promise<Map<string, DiagramGeneration>> {
  const results = new Map<string, DiagramGeneration>();
  
  for (const section of sections) {
    const description = section.content || section.title;
    const diagram = await autoGenerateDiagram(description, {
      preferFormat: options.preferFormat,
    });
    
    results.set(section.id, diagram);
  }
  
  return results;
}
