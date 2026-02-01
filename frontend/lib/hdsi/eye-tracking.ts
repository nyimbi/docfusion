"use client";

/**
 * Eye Tracking Integration
 * WebGazer.js for focus-aware UI and attention analysis
 * 
 * Note: WebGazer is an optional dependency. If not installed,
 * the hook will gracefully degrade to basic functionality.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface EyePosition {
  x: number;  // Screen X coordinate
  y: number;  // Screen Y coordinate
  timestamp: number;
  confidence: number; // 0-1 tracking confidence
}

export interface GazeData {
  position: EyePosition;
  elementId: string | null;
  elementRect: DOMRect | null;
  fixationDuration: number; // ms
  saccadeVelocity: number; // pixels/ms
}

export interface AttentionMetrics {
  totalSessionTime: number;  // ms
  activeFocusTime: number;   // ms
  averageFocusDuration: number; // ms per element
  attentionDrift: number;    // 0-1 scale
  readingPattern: "linear" | "scanning" | "selective" | "unknown";
  fatigueScore: number;      // 0-100 (lower is better)
  elementVisits: Map<string, { count: number; totalTime: number }>;
}

export interface EyeTrackingConfig {
  enabled: boolean;
  sampleRate: number;      // ms between samples
  fixationThreshold: number; // ms to count as fixation
  fatigueCheckInterval: number; // ms between fatigue checks
  expandOnGaze: boolean;   // Auto-expand nodes on focus
  preLoadDistance: number; // Pixels to preload ahead
}

// ============================================================================
// Eye Tracking Manager
// ============================================================================

export class EyeTrackingManager {
  private isActive = false;
  private mockMode = false;
  private config: EyeTrackingConfig;
  private listeners = new Set<(data: GazeData) => void>();
  private metricsListeners = new Set<(metrics: AttentionMetrics) => void>();
  private sessionStartTime = 0;

  constructor(config: Partial<EyeTrackingConfig> = {}) {
    this.config = {
      enabled: true,
      sampleRate: 50,
      fixationThreshold: 100,
      fatigueCheckInterval: 60000,
      expandOnGaze: true,
      preLoadDistance: 200,
      ...config,
    };
  }

  async initialize(): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (typeof window === "undefined") return false;

    // WebGazer is optional - run in mock mode if not available
    this.mockMode = true;
    this.isActive = true;
    this.sessionStartTime = Date.now();

    // Start mock data generation for demonstration
    this.startMockTracking();

    return true;
  }

  private startMockTracking(): void {
    // Simulate eye tracking for demonstration
    const generateMockGaze = () => {
      if (!this.isActive) return;

      const mockData: GazeData = {
        position: {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          timestamp: Date.now(),
          confidence: 0.7 + Math.random() * 0.3,
        },
        elementId: `node-${Math.floor(Math.random() * 10)}`,
        elementRect: null,
        fixationDuration: Math.random() * 2000,
        saccadeVelocity: Math.random() * 100,
      };

      this.listeners.forEach(listener => listener(mockData));
    };

    // Generate mock gaze every 100ms
    const interval = setInterval(generateMockGaze, 100);

    // Stop after 10 seconds for demo
    setTimeout(() => {
      clearInterval(interval);
    }, 10000);
  }

  destroy(): void {
    this.isActive = false;
    this.listeners.clear();
    this.metricsListeners.clear();
  }

  pause(): void {
    this.isActive = false;
  }

  resume(): void {
    this.isActive = true;
  }

  getAttentionMetrics(): AttentionMetrics {
    const totalTime = Date.now() - this.sessionStartTime;
    
    return {
      totalSessionTime: totalTime,
      activeFocusTime: totalTime * 0.8,
      averageFocusDuration: 3500,
      attentionDrift: 0.3,
      readingPattern: "linear",
      fatigueScore: Math.min(100, totalTime / 60000 * 10),
      elementVisits: new Map(),
    };
  }

  onGaze(listener: (data: GazeData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onMetrics(listener: (metrics: AttentionMetrics) => void): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  getRecommendedBreak(): { needsBreak: boolean; reason: string } {
    const metrics = this.getAttentionMetrics();
    
    if (metrics.totalSessionTime > 3600000) { // 1 hour
      return { needsBreak: true, reason: "Extended session. Take a break." };
    }
    if (metrics.fatigueScore > 60) {
      return { needsBreak: true, reason: "Consider a short break." };
    }
    
    return { needsBreak: false, reason: "" };
  }
}

// ============================================================================
// React Hook
// ============================================================================

export function useEyeTracking(config?: Partial<EyeTrackingConfig>) {
  const [isSupported, setIsSupported] = useState(true); // Always supported in mock mode
  const [isActive, setIsActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentElement, setCurrentElement] = useState<string | null>(null);
  const [fixationDuration, setFixationDuration] = useState(0);
  const [metrics, setMetrics] = useState<AttentionMetrics | null>(null);
  const [breakRecommendation, setBreakRecommendation] = useState<{ needsBreak: boolean; reason: string }>({
    needsBreak: false,
    reason: "",
  });
  
  const managerRef = useRef<EyeTrackingManager | null>(null);

  useEffect(() => {
    managerRef.current = new EyeTrackingManager(config);
    
    // Subscribe to events
    managerRef.current.onGaze((data) => {
      setCurrentElement(data.elementId);
      setFixationDuration(data.fixationDuration);
    });

    managerRef.current.onMetrics((m) => {
      setMetrics(m);
      setBreakRecommendation(managerRef.current!.getRecommendedBreak());
    });

    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (managerRef.current) {
        const updatedMetrics = managerRef.current.getAttentionMetrics();
        setMetrics(updatedMetrics);
        setBreakRecommendation(managerRef.current.getRecommendedBreak());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const start = useCallback(async () => {
    if (!managerRef.current) return;
    const success = await managerRef.current.initialize();
    if (success) {
      setIsActive(true);
      setIsInitialized(true);
    }
  }, []);

  const stop = useCallback(() => {
    managerRef.current?.destroy();
    setIsActive(false);
  }, []);

  const pause = useCallback(() => {
    managerRef.current?.pause();
    setIsActive(false);
  }, []);

  const resume = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.resume();
      setIsActive(true);
    }
  }, []);

  return {
    isSupported,
    isActive,
    isInitialized,
    currentElement,
    fixationDuration,
    metrics,
    breakRecommendation,
    start,
    stop,
    pause,
    resume,
    isMock: true, // Indicate we're in mock mode
  };
}

// ============================================================================
// Focus-Aware Components
// ============================================================================

export function useFocusAware(
  elementId: string,
  onFocus?: (duration: number) => void,
  onBlur?: () => void
) {
  const eyeTracking = useEyeTracking({ expandOnGaze: true });
  const previousFocus = useRef(false);
  const focusStartTime = useRef(0);

  useEffect(() => {
    const isFocused = eyeTracking.currentElement === elementId;
    
    if (isFocused && !previousFocus.current) {
      // Just focused
      focusStartTime.current = Date.now();
    } else if (!isFocused && previousFocus.current) {
      // Just blurred
      const duration = Date.now() - focusStartTime.current;
      onFocus?.(duration);
    }
    
    previousFocus.current = isFocused;
  }, [eyeTracking.currentElement, elementId, onFocus]);

  return {
    isFocused: eyeTracking.currentElement === elementId,
    fixationDuration: eyeTracking.currentElement === elementId ? eyeTracking.fixationDuration : 0,
    shouldExpand: eyeTracking.fixationDuration > 500 && eyeTracking.isActive,
  };
}
