"use client";

/**
 * Server-Sent Events Streaming for AI Generation
 * Real-time token visualization with perplexity-style display
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export interface TokenStream {
  token: string;
  alternatives?: { token: string; probability: number }[];
  confidence: number;
  isComplete: boolean;
}

export interface StreamProgress {
  tokensGenerated: number;
  tokensTotal: number;
  charactersGenerated: number;
  latencyMs: number;
}

export interface GenerationStream {
  content: string;
  isComplete: boolean;
  progress: StreamProgress;
  error?: string;
}

// ============================================================================
// SSE Client
// ============================================================================

export async function* streamGeneration(
  endpoint: string,
  payload: {
    prompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    nodeId: string;
  }
): AsyncGenerator<TokenStream, GenerationStream, unknown> {
  const startTime = performance.now();
  let content = "";
  let tokensGenerated = 0;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          
          if (data === "[DONE]") {
            return {
              content,
              isComplete: true,
              progress: {
                tokensGenerated,
                tokensTotal: tokensGenerated,
                charactersGenerated: content.length,
                latencyMs: Math.round(performance.now() - startTime),
              },
            };
          }

          try {
            const token: TokenStream = JSON.parse(data);
            content += token.token;
            tokensGenerated++;
            yield token;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    return {
      content,
      isComplete: true,
      progress: {
        tokensGenerated,
        tokensTotal: tokensGenerated,
        charactersGenerated: content.length,
        latencyMs: Math.round(performance.now() - startTime),
      },
    };
  } catch (error) {
    return {
      content,
      isComplete: false,
      progress: {
        tokensGenerated,
        tokensTotal: payload.maxTokens,
        charactersGenerated: content.length,
        latencyMs: Math.round(performance.now() - startTime),
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// React Hook for Streaming
// ============================================================================

export function useStreamingGeneration() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
  const abortRef = useRef<(() => void) | null>(null);

  const startGeneration = useCallback(async (
    endpoint: string,
    payload: Parameters<typeof streamGeneration>[1],
    onToken?: (token: TokenStream) => void,
    onComplete?: (result: GenerationStream) => void
  ) => {
    setIsStreaming(true);
    setStreamContent("");
    setError(null);
    setIsComplete(false);

    let isAborted = false;
    abortRef.current = () => { isAborted = true; };

    try {
      const generator = streamGeneration(endpoint, payload);
      let fullContent = "";

      while (true) {
        if (isAborted) {
          break;
        }

        const result = await generator.next();
        
        if (result.done) {
          const finalResult = result.value as GenerationStream;
          setStreamContent(finalResult.content);
          setProgress(finalResult.progress);
          setIsComplete(true);
          setIsStreaming(false);
          onComplete?.(finalResult);
          break;
        } else {
          const token = result.value as TokenStream;
          fullContent += token.token;
          setStreamContent(fullContent);
          onToken?.(token);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setIsStreaming(false);
    }

    abortRef.current = null;
  }, []);

  const abortGeneration = useCallback(() => {
    abortRef.current?.();
    setIsStreaming(false);
  }, []);

  return {
    isStreaming,
    streamContent,
    progress,
    error,
    isComplete,
    startGeneration,
    abortGeneration,
  };
}

// ============================================================================
// Simulation Mode (for development)
// ============================================================================

export async function* simulateStreamingGeneration(
  content: string,
  delayMs: number = 50
): AsyncGenerator<TokenStream, GenerationStream, unknown> {
  const startTime = performance.now();
  const tokens = content.split(/(\s+|[.,!?;])/g).filter(Boolean);
  let generated = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    generated += token;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    yield {
      token,
      confidence: 0.8 + Math.random() * 0.19,
      isComplete: false,
    };
  }

  return {
    content: generated,
    isComplete: true,
    progress: {
      tokensGenerated: tokens.length,
      tokensTotal: tokens.length,
      charactersGenerated: generated.length,
      latencyMs: Math.round(performance.now() - startTime),
    },
  };
}

// ============================================================================
// Perplexity-style Token Visualization
// ============================================================================

export function useTokenVisualization() {
  const [tokens, setTokens] = useState<TokenStream[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const addToken = useCallback((token: TokenStream) => {
    setTokens(prev => [...prev, token]);
  }, []);

  const clearTokens = useCallback(() => {
    setTokens([]);
  }, []);

  const getTokenStyle = useCallback((confidence: number): React.CSSProperties => {
    // Opacity based on confidence (lower confidence = more transparent)
    return {
      opacity: 0.3 + confidence * 0.7,
      transition: "opacity 0.2s ease",
    };
  }, []);

  return {
    tokens,
    showAlternatives,
    setShowAlternatives,
    addToken,
    clearTokens,
    getTokenStyle,
  };
}
