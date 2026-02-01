"use client";

/**
 * Text Colors System
 * 
 * Provides colored text support for HDSI documents.
 * 
 * Features:
 * - Custom color picker
 * - Preset color palette
 * - Highlight colors
 * - Text color for emphasis
 * - Color persistence in document
 * - WCAG-compliant contrast checking
 */

import { useState, useCallback, useMemo } from "react";

// ============================================================================
// Color Palettes
// ============================================================================

export const COLOR_PRESETS = {
  // Standard text colors
  text: [
    { name: "Default", value: "inherit", color: "#000000" },
    { name: "Dark", value: "#1f2937", color: "#1f2937" },
    { name: "Slate", value: "#475569", color: "#475569" },
    { name: "Gray", value: "#6b7280", color: "#6b7280" },
    { name: "Primary", value: "#3b82f6", color: "#3b82f6" },
    { name: "Success", value: "#10b981", color: "#10b981" },
    { name: "Warning", value: "#f59e0b", color: "#f59e0b" },
    { name: "Danger", value: "#dc2626", color: "#dc2626" },
    { name: "Purple", value: "#8b5cf6", color: "#8b5cf6" },
    { name: "Pink", value: "#ec4899", color: "#ec4899" },
  ],
  
  // Highlight/Background colors
  highlight: [
    { name: "Yellow", value: "fef3c7", color: "#FCD34D", textColor: "#92400e" },
    { name: "Green", value: "d1fae5", color: "#6EE7B7", textColor: "#065f46" },
    { name: "Blue", value: "dbeafe", color: "#93C5FD", textColor: "#1e40af" },
    { name: "Purple", value: "ede9fe", color: "#C4B5FD", textColor: "#5b21b6" },
    { name: "Red", value: "fee2e2", color: "#FCA5A5", textColor: "#991b1b" },
    { name: "Orange", value: "ffedd5", color: "#FDBA74", textColor: "" },
  ],
  
  // Semantic colors (for specific use cases)
  semantic: {
    requirement: "#3b82f6",      // Blue - requirements
    deliverable: "#10b981",      // Green - deliverables
    milestone: "#f59e0b",        // Amber - milestones
    risk: "#dc2626",             // Red - risks
    assumption: "#8b5cf6",       // Purple - assumptions
    note: "#6b7280",             // Gray - notes
    todo: "#ec4899",             // Pink - action items
    approval: "#059669",         // Emerald - approvals
  },
};

// ============================================================================
// Types
// ============================================================================

export interface TextColor {
  foreground?: string;
  background?: string;
  isHighlight?: boolean;
}

export interface ColoredText {
  text: string;
  color?: TextColor;
}

export interface ColorRule {
  name: string;
  pattern: RegExp;
  color: TextColor;
  description: string;
}

// ============================================================================
// Contrast Checking (WCAG 2.1)
// ============================================================================

export function getLuminance(hexColor: string): number {
  const rgb = parseInt(hexColor.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;

  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function isContrastValid(
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA"
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const minRatio = level === "AAA" ? 7 : 4.5;
  return ratio >= minRatio;
}

export function suggestTextColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

// ============================================================================
// Color Formatting
// ============================================================================

export function formatColorForDom(color: TextColor): React.CSSProperties {
  const styles: React.CSSProperties = {};
  
  if (color.foreground) {
    styles.color = color.foreground;
  }
  
  if (color.background) {
    if (color.isHighlight) {
      styles.backgroundColor = `#${color.background}`;
    } else {
      styles.backgroundColor = color.background;
    }
  }
  
  return styles;
}

export function colorToCss(color: TextColor): string {
  const parts: string[] = [];
  
  if (color.foreground) {
    parts.push(`color: ${color.foreground}`);
  }
  
  if (color.background) {
    const bg = color.isHighlight ? `#${color.background}` : color.background;
    parts.push(`background-color: ${bg}`);
  }
  
  return parts.join("; ");
}

export function parseColorFromCss(cssString: string): TextColor {
  const color: TextColor = {};
  
  const colorMatch = cssString.match(/color:\s*([^;]+)/);
  if (colorMatch) {
    color.foreground = colorMatch[1].trim();
  }
  
  const bgMatch = cssString.match(/background-color:\s*#?([^;]+)/);
  if (bgMatch) {
    color.background = bgMatch[1].trim();
    color.isHighlight = cssString.includes("background-color: #");
  }
  
  return color;
}

// ============================================================================
// Semantic Color Detection
// ============================================================================

export const SEMANTIC_COLOR_RULES: ColorRule[] = [
  // Requirements
  {
    name: "requirement",
    pattern: /\b(?:shall|must|required|mandatory)\b/gi,
    color: { foreground: COLOR_PRESETS.semantic.requirement },
    description: "Contractual requirements",
  },
  // Deliverables
  {
    name: "deliverable",
    pattern: /\b(?:deliverable|deliverable|output|product)\b/gi,
    color: { foreground: COLOR_PRESETS.semantic.deliverable },
    description: "Project deliverables",
  },
  // Risks
  {
    name: "risk",
    pattern: /\b(?:risk| Risks |threat|vulnerability|concern)\b/gi,
    color: { foreground: COLOR_PRESETS.semantic.risk },
    description: "Identified risks",
  },
  // Milestones
  {
    name: "milestone",
    pattern: /\b(?:milestone|deadline|due date|target date)\b/gi,
    color: { foreground: COLOR_PRESETS.semantic.milestone },
    description: "Key dates and milestones",
  },
  // Assumptions
  {
    name: "assumption",
    pattern: /\b(?:assumes?|assuming|presumed)\b/gi,
    color: { foreground: COLOR_PRESETS.semantic.assumption },
    description: "Project assumptions",
  },
];

export function applySemanticColors(text: string): Array<{ text: string; color?: TextColor }> {
  const segments: Array<{ text: string; color?: TextColor }> = [];
  let lastIndex = 0;
  
  // Find all matches for all rules
  const allMatches: Array<{ index: number; length: number; rule: ColorRule }> = [];
  
  SEMANTIC_COLOR_RULES.forEach(rule => {
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        rule,
      });
    }
  });
  
  // Sort by index
  allMatches.sort((a, b) => a.index - b.index);
  
  // Remove overlapping matches (keep first)
  const nonOverlapping = allMatches.filter((match, i) => {
    if (i === 0) return true;
    const prev = allMatches[i - 1];
    return match.index >= prev.index + prev.length;
  });
  
  // Build segments
  nonOverlapping.forEach(match => {
    // Add text before match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    
    // Add colored match
    segments.push({
      text: text.slice(match.index, match.index + match.length),
      color: match.rule.color,
    });
    
    lastIndex = match.index + match.length;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }
  
  return segments.length > 0 ? segments : [{ text }];
}

// ============================================================================
// React Hook
// ============================================================================

export function useTextColors() {
  const [activeColor, setActiveColor] = useState<TextColor>({});
  const [isAutoApply, setIsAutoApply] = useState(false);

  const setColor = useCallback((color: TextColor) => {
    setActiveColor(color);
  }, []);

  const clearColor = useCallback(() => {
    setActiveColor({});
  }, []);

  const setForeground = useCallback((color: string) => {
    setActiveColor(prev => ({ ...prev, foreground: color }));
  }, []);

  const setBackground = useCallback((color: string, isHighlight = false) => {
    setActiveColor(prev => ({ ...prev, background: color, isHighlight }));
  }, []);

  const checkContrast = useCallback((background?: string, foreground?: string) => {
    const bg = background || activeColor.background;
    const fg = foreground || activeColor.foreground;
    
    if (!bg || !fg) return { valid: true, ratio: 21 };
    
    const bgHex = bg.startsWith("#") ? bg : `#${bg}`;
    const fgHex = fg.startsWith("#") ? fg : fg;
    
    const ratio = getContrastRatio(bgHex, fgHex);
    return {
      valid: ratio >= 4.5,
      ratio: Math.round(ratio * 10) / 10,
    };
  }, [activeColor]);

  const suggestColor = useCallback(() => {
    if (!activeColor.background) return "";
    const bg = activeColor.background.startsWith("#")
      ? activeColor.background
      : `#${activeColor.background}`;
    return suggestTextColor(bg);
  }, [activeColor]);

  return {
    activeColor,
    setColor,
    clearColor,
    setForeground,
    setBackground,
    isAutoApply,
    setIsAutoApply,
    checkContrast,
    suggestColor,
    presets: COLOR_PRESETS,
    semanticRules: SEMANTIC_COLOR_RULES,
  };
}

// ============================================================================
// Export/Import Helpers
// ============================================================================

export function colorsToMarkdown(color: TextColor, text: string): string {
  if (!color.foreground && !color.background) {
    return text;
  }

  const parts: string[] = [text];

  if (color.foreground) {
    parts.push(`<span style="color: ${color.foreground}">`);
  }

  if (color.background) {
    const bg = color.isHighlight ? `#${color.background}` : color.background;
    parts.push(`<span style="background-color: ${bg}">`);
  }

  return parts.join("");
}

export function colorsToLaTeX(color: TextColor, text: string): string {
  if (!color.background) {
    if (color.foreground) {
      // Convert hex to RGB
      const rgb = hexToRgb(color.foreground);
      if (rgb) {
        return `\\textcolor[RGB]{${rgb.r},${rgb.g},${rgb.b}}{${text}}`;
      }
    }
    return text;
  }

  if (color.isHighlight) {
    const colorName = color.background.toLowerCase();
    const colorMap: Record<string, string> = {
      "fef3c7": "yellow",
      "d1fae5": "green",
      "dbeafe": "cyan",
      "ede9fe": "magenta",
      "fee2e2": "red",
      "ffedd5": "orange",
    };
    return `\\colorbox{${colorMap[colorName] || "yellow"}}{${text}}`;
  }

  return text;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}