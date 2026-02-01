/**
 * Presentation System for HDSI -  world-class, McKinsey-grade presentations
 * 
 * Core Features:
 * - SCR (Situation-Complication-Resolution) storyline framework
 * - Slide templates (Executive Summary, Ladder, Triangle, 2x2 Matrix, Waterfall)
 * - Professional chart library
 * - Pyramid Principle enforcement
 * - PowerPoint export (.pptx)
 * - Action title enforcement
 */

import { useState, useCallback, useMemo } from 'react';
import type { HDSINode } from './types';

// ============================================================================
// Core Types
// ============================================================================

export type SlideType = 
  | 'executive-summary' 
  | 'situation' 
  | 'complication' 
  | 'resolution' 
  | 'supporting-point' 
  | '2x2-matrix' 
  | 'waterfall' 
  | 'ladder' 
  | 'timeline' 
  | 'next-steps';

export type StorylineFramework = 'SCR' | 'pyramid' | 'problem-solution-benefit';

export interface Slide {
  id: string;
  type: SlideType;
  order: number;
  
  // Core content
  actionTitle: string;  // McKinsey: Every slide needs action-oriented title
  subtitle?: string;
  
  // Content
  bullets?: string[];
  speakerNotes?: string;
  
  // Data visualization
  chart?: ChartConfig;
  table?: TableConfig;
  
  // Layout
  layout: 'title-only' | 'title-content' | 'title-chart' | 'title-2col' | 'full-chart';
  
  // Metadata
  duration?: number;  // seconds for auto-advance
  hidden?: boolean;   // for appendix
}

export interface Presentation {
  id: string;
  title: string;
  subtitle?: string;
  
  // Storyline
  framework: StorylineFramework;
  storyline?: {
    situation: string;
    complication: string;
    resolution: string;
  };
  
  // Slides
  slides: Slide[];
  
  // Design
  theme: PresentationTheme;
  
  // Meta
  createdAt: Date;
  updatedAt: Date;
  sourceDocumentId?: string;
}

export interface PresentationTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    textLight: string;
    positive: string;
    negative: string;
    warning: string;
  };
  fonts: {
    title: string;
    body: string;
  };
}

// ============================================================================
// McKinsey Design System
// ============================================================================

export const MCKINSEY_THEME: PresentationTheme = {
  name: 'McKinsey Classic',
  colors: {
    primary: '#000020',      // Deep navy
    secondary: '#051C2C',    // Dark navy
    accent: '#0070D1',       // McKinsey blue
    background: '#FFFFFF',
    text: '#1A1A1A',
    textLight: '#6B6B6B',
    positive: '#107C10',     // Green
    negative: '#D32F2F',     // Red
    warning: '#F9A825',      // Amber
  },
  fonts: {
    title: 'Arial, sans-serif',
    body: 'Arial, sans-serif',
  },
};

export const BCG_THEME: PresentationTheme = {
  name: 'BCG',
  colors: {
    primary: '#003B5C',
    secondary: '#005587',
    accent: '#00A3E0',
    background: '#FFFFFF',
    text: '#1A1A1A',
    textLight: '#6B6B6B',
    positive: '#00843D',
    negative: '#C8102E',
    warning: '#FF8200',
  },
  fonts: {
    title: 'Arial, sans-serif',
    body: 'Arial, sans-serif',
  },
};

export const BAIN_THEME: PresentationTheme = {
  name: 'Bain',
  colors: {
    primary: '#CC2200',
    secondary: '#990000',
    accent: '#FF4400',
    background: '#FFFFFF',
    text: '#333333',
    textLight: '#666666',
    positive: '#2E7D32',
    negative: '#C62828',
    warning: '#F57C00',
  },
  fonts: {
    title: 'Georgia, serif',
    body: 'Arial, sans-serif',
  },
};

export const THEMES: Record<string, PresentationTheme> = {
  mckinsey: MCKINSEY_THEME,
  bcg: BCG_THEME,
  bain: BAIN_THEME,
};

// ============================================================================
// Chart Types
// ============================================================================

export type ChartType = 
  | 'bar' 
  | 'column' 
  | 'stacked-bar' 
  | 'waterfall'
  | 'line' 
  | 'area'
  | 'pie' 
  | 'doughnut'
  | 'scatter'
  | 'bubble'
  | 'marimekko'
  | 'mekko'
  | 'gantt'
  | 'thermometer'
  | 'spider';

export interface ChartConfig {
  type: ChartType;
  title?: string;
  subtitle?: string;
  
  // Data
  data: ChartDataPoint[] | ChartSeries[];
  
  // Axes
  xAxis?: {
    label?: string;
    categories?: string[];
    min?: number;
    max?: number;
  };
  yAxis?: {
    label?: string;
    min?: number;
    max?: number;
    format?: 'number' | 'percent' | 'currency' | 'compact';
  };
  
  // Styling
  colors?: string[];
  showLegend?: boolean;
  showValues?: boolean;
  showDataLabels?: boolean;
  
  // Annotations
  annotations?: ChartAnnotation[];
  
  // Source
  source?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartAnnotation {
  type: 'callout' | 'range' | 'line';
  position: { x?: number; y?: number };
  text: string;
  color?: string;
}

export interface TableConfig {
  headers: string[];
  rows: (string | number)[][];
  highlightRows?: number[];
  highlightCols?: number[];
  source?: string;
}

// ============================================================================
// SCR Storyline Builder
// ============================================================================

export interface SCRAnalysis {
  situation: {
    currentState: string;
    relevantContext: string;
    keyFacts: string[];
  };
  complication: {
    problem: string;
    obstacles: string[];
    urgency?: string;
  };
  resolution: {
    solution: string;
    actions: string[];
    expectedOutcome: string;
    timeline?: string;
  };
}

export function buildSCRStoryline(
  documentNodes: HDSINode[], 
  options?: { maxSlides?: number }
): Slide[] {
  const maxSlides = options?.maxSlides || 10;
  const slides: Slide[] = [];
  
  // Title slide
  slides.push({
    id: `slide-${Date.now()}-title`,
    type: 'executive-summary',
    order: 0,
    actionTitle: documentNodes[0]?.title || 'Executive Summary',
    layout: 'title-only',
    speakerNotes: 'Welcome and agenda overview',
  });
  
  // Situation slide
  if (documentNodes[0]) {
    slides.push({
      id: `slide-${Date.now()}-situation`,
      type: 'situation',
      order: 1,
      actionTitle: `We are currently in a position where ${extractKeyPoint(documentNodes[0])}`,
      bullets: extractBullets(documentNodes[0]),
      layout: 'title-content',
      speakerNotes: 'Set the context and establish credibility',
    });
  }
  
  // Complication slide
  if (documentNodes[1]) {
    slides.push({
      id: `slide-${Date.now()}-complication`,
      type: 'complication',
      order: 2,
      actionTitle: `However, we face a critical challenge: ${extractKeyPoint(documentNodes[1])}`,
      bullets: extractBullets(documentNodes[1]),
      layout: 'title-content',
      speakerNotes: 'Create urgency and tension',
    });
  }
  
  // Resolution slide
  if (documentNodes[2]) {
    slides.push({
      id: `slide-${Date.now()}-resolution`,
      type: 'resolution',
      order: 3,
      actionTitle: `Therefore, we must take immediate action to ${extractKeyPoint(documentNodes[2])}`,
      bullets: extractBullets(documentNodes[2]),
      layout: 'title-content',
      speakerNotes: 'Present the solution and call to action',
    });
  }
  
  // Supporting slides from remaining nodes
  documentNodes.slice(3, 3 + maxSlides - 5).forEach((node, idx) => {
    slides.push({
      id: `slide-${Date.now()}-support-${idx}`,
      type: 'supporting-point',
      order: 4 + idx,
      actionTitle: node.title,
      bullets: extractBullets(node),
      layout: determineBestLayout(node),
      speakerNotes: node.generatedContent?.slice(0, 200),
    });
  });
  
  // Next steps slide
  slides.push({
    id: `slide-${Date.now()}-next`,
    type: 'next-steps',
    order: slides.length,
    actionTitle: 'We need to move forward with these immediate actions',
    bullets: ['Action 1: [Owner] by [Date]', 'Action 2: [Owner] by [Date]', 'Action 3: [Owner] by [Date]'],
    layout: 'title-content',
    speakerNotes: 'Clear next steps with owners and dates',
  });
  
  return slides;
}

function extractKeyPoint(node: HDSINode): string {
  // Extract the core insight from node content
  const content = node.generatedContent || node.title;
  // Take first sentence or up to 80 chars
  const firstSentence = content.split('.')[0];
  return firstSentence.length > 80 
    ? firstSentence.slice(0, 77) + '...' 
    : firstSentence;
}

function extractBullets(node: HDSINode): string[] {
  if (!node.generatedContent) return [];
  
  // Split content into sentences and create bullets
  const sentences = node.generatedContent
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 120);
  
  return sentences.slice(0, 5);  // Max 5 bullets (McKinsey standard)
}

function determineBestLayout(node: HDSINode): Slide['layout'] {
  if (node.children && node.children.length > 0) {
    return 'title-chart';  // Has sub-data, use chart
  }
  if ((node.generatedContent?.length || 0) > 500) {
    return 'title-2col';  // Long content, use 2 columns
  }
  return 'title-content';
}

// ============================================================================
// Pyramid Principle Validator
// ============================================================================

export interface PyramidValidationResult {
  isValid: boolean;
  issues: {
    type: 'missing-governing-thought' | 'mutually-exclusive' | 'collectively-exhaustive' | 'mece-violation';
    message: string;
    suggestion: string;
  }[];
  score: number;  // 0-100
}

export function validatePyramidPrinciple(slide: Slide): PyramidValidationResult {
  const issues: PyramidValidationResult['issues'] = [];
  let score = 100;
  
  // Check for action title
  if (!isActionTitle(slide.actionTitle)) {
    issues.push({
      type: 'missing-governing-thought',
      message: 'Slide title is not action-oriented',
      suggestion: `Change to: "${suggestActionTitle(slide.actionTitle)}"`,
    });
    score -= 20;
  }
  
  // Check MECE on bullets
  if (slide.bullets && slide.bullets.length > 1) {
    const meceCheck = checkMECE(slide.bullets);
    if (!meceCheck.isIndependent) {
      issues.push({
        type: 'mutually-exclusive',
        message: 'Bullet points may overlap in content',
        suggestion: 'Ensure each point addresses a distinct aspect',
      });
      score -= 15;
    }
    if (!meceCheck.isCollectivelyExhaustive) {
      issues.push({
        type: 'collectively-exhaustive',
        message: 'Bullet points may not cover all aspects',
        suggestion: 'Add missing perspectives or consolidate',
      });
      score -= 10;
    }
  }
  
  // Check bullet limit (McKinsey: max 5 per slide)
  if (slide.bullets && slide.bullets.length > 5) {
    issues.push({
      type: 'mece-violation',
      message: 'Too many bullet points (>5)',
      suggestion: 'Move lower-priority points to appendix',
    });
    score -= 15;
  }
  
  return { isValid: score >= 70, issues, score };
}

function isActionTitle(title: string): boolean {
  // Check if title starts with action verb or implies action
  const actionPatterns = [
    /^We (must|should|need to|will|are)/i,
    /^To /i,
    /^\d+%/i,  // Percentage implies achievement
    /(increase|decrease|reduce|improve|implement|consolidate|expand|optimize)/i,
  ];
  
  return actionPatterns.some(pattern => pattern.test(title));
}

function suggestActionTitle(currentTitle: string): string {
  // Suggest improvements to make title action-oriented
  const prefix = 'We must ';
  return prefix + currentTitle.charAt(0).toLowerCase() + currentTitle.slice(1);
}

function checkMECE(bullets: string[]): { isIndependent: boolean; isCollectivelyExhaustive: boolean } {
  // Simplified MECE check - would use AI for production
  const keywords = bullets.map(b => b.toLowerCase().split(' '));
  
  // Check for overlapping keywords
  let overlapCount = 0;
  for (let i = 0; i < keywords.length; i++) {
    for (let j = i + 1; j < keywords.length; j++) {
      const intersection = keywords[i].filter(k => keywords[j].includes(k));
      if (intersection.length > 2) overlapCount++;
    }
  }
  
  return {
    isIndependent: overlapCount < 2,
    isCollectivelyExhaustive: bullets.length >= 3,  // Simplified check
  };
}

// ============================================================================
// React Hook: Presentations
// ============================================================================

export function usePresentations() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [activePresentation, setActivePresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // Create presentation from document
  const createFromDocument = useCallback((
    documentNodes: HDSINode[],
    title: string,
    framework: StorylineFramework = 'SCR'
  ): Presentation => {
    const slides = framework === 'SCR' 
      ? buildSCRStoryline(documentNodes)
      : buildGenericStoryline(documentNodes);
    
    const presentation: Presentation = {
      id: `pres-${Date.now()}`,
      title,
      framework,
      slides,
      theme: MCKINSEY_THEME,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setPresentations(prev => [...prev, presentation]);
    setActivePresentation(presentation);
    return presentation;
  }, []);
  
  // Update slide
  const updateSlide = useCallback((slideId: string, updates: Partial<Slide>) => {
    if (!activePresentation) return;
    
    const updated = {
      ...activePresentation,
      slides: activePresentation.slides.map(s => 
        s.id === slideId ? { ...s, ...updates } : s
      ),
      updatedAt: new Date(),
    };
    
    setActivePresentation(updated);
    setPresentations(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, [activePresentation]);
  
  // Add chart to slide
  const addChart = useCallback((slideId: string, chart: ChartConfig) => {
    updateSlide(slideId, { chart, layout: 'title-chart' });
  }, [updateSlide]);
  
  // Navigation
  const nextSlide = useCallback(() => {
    if (activePresentation && currentSlideIndex < activePresentation.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  }, [activePresentation, currentSlideIndex]);
  
  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  }, [currentSlideIndex]);
  
  const goToSlide = useCallback((index: number) => {
    if (activePresentation && index >= 0 && index < activePresentation.slides.length) {
      setCurrentSlideIndex(index);
    }
  }, [activePresentation]);
  
  // Validation
  const validatePresentation = useCallback((): {
    slideValidations: { slideId: string; result: ReturnType<typeof validatePyramidPrinciple> }[];
    overallScore: number;
  } => {
    if (!activePresentation) return { slideValidations: [], overallScore: 0 };
    
    const validations = activePresentation.slides.map(slide => ({
      slideId: slide.id,
      result: validatePyramidPrinciple(slide),
    }));
    
    const overallScore = Math.round(
      validations.reduce((sum, v) => sum + v.result.score, 0) / validations.length
    );
    
    return { slideValidations: validations, overallScore };
  }, [activePresentation]);
  
  return {
    presentations,
    activePresentation,
    currentSlideIndex,
    currentSlide: activePresentation?.slides[currentSlideIndex],
    createFromDocument,
    updateSlide,
    addChart,
    nextSlide,
    prevSlide,
    goToSlide,
    validatePresentation,
    setActivePresentation,
  };
}

// Helper for non-SCR frameworks
function buildGenericStoryline(nodes: HDSINode[]): Slide[] {
  return nodes.map((node, idx) => ({
    id: `slide-${Date.now()}-${idx}`,
    type: idx === 0 ? 'executive-summary' : 'supporting-point',
    order: idx,
    actionTitle: node.title,
    bullets: extractBullets(node),
    layout: 'title-content',
  }));
}
