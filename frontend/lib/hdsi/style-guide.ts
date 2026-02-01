"use client";

/**
 * Style Guide Enforcement Engine
 * Real-time rule checking for tone, terminology, readability, bias, accessibility
 */

import { useState, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type RuleSeverity = "error" | "warning" | "suggestion";
export type RuleCategory = 
  | "tone"          // Formal vs casual
  | "terminology"   // Whitelist/blacklist
  | "readability"   // Flesch-Kincaid, etc.
  | "bias"          // Gender, racial, age bias
  | "accessibility" // WCAG 2.1
  | "grammar"       // Grammar and syntax
  | "consistency";  // Internal consistency

export interface StyleRule {
  id: string;
  name: string;
  category: RuleCategory;
  description: string;
  severity: RuleSeverity;
  enabled: boolean;
  check: (text: string) => Violation[];
  autoFix?: (text: string, violation: Violation) => string;
}

export interface Violation {
  ruleId: string;
  category: RuleCategory;
  severity: RuleSeverity;
  message: string;
  start: number;      // Character position
  end: number;        // Character position
  suggestion?: string;
  context: string;    // Surrounding text
}

export interface StyleReport {
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  readabilityScore: number;  // 0-100
  gradeLevel: number;        // US grade level
  avgSentenceLength: number;
  avgWordLength: number;
  passiveVoicePercent: number;
}

// ============================================================================
// Default Rules
// ============================================================================

export const DEFAULT_RULES: StyleRule[] = [
  // TONE RULES
  {
    id: "tone-contractions",
    name: "Avoid Contractions",
    category: "tone",
    description: "Contractions are too informal for technical documents",
    severity: "warning",
    enabled: true,
    check: (text) => {
      const contractions = [
        /\bcan't\b/gi, /\bwon't\b/gi, /\bdon't\b/gi, /\bdoesn't\b/gi,
        /\bisn't\b/gi, /\baren't\b/gi, /\bwasn't\b/gi, /\bweren't\b/gi,
        /\bhaven't\b/gi, /\bhasn't\b/gi, /\bhadn't\b/gi, /\bwouldn't\b/gi,
        /\bcouldn't\b/gi, /\bshouldn't\b/gi, /\bmustn't\b/gi, /\blet's\b/gi,
        /\bthat's\b/gi, /\bwho's\b/gi, /\bwhat's\b/gi, /\bhere's\b/gi,
        /\bthere's\b/gi, /\bwhere's\b/gi, /\bhow's\b/gi, /\bit's\b/gi,
      ];
      
      const violations: Violation[] = [];
      for (const pattern of contractions) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          violations.push({
            ruleId: "tone-contractions",
            category: "tone",
            severity: "warning",
            message: `Avoid contraction "${match[0]}" in formal documents`,
            start: match.index,
            end: match.index + match[0].length,
            suggestion: match[0].replace(/n't/gi, " not").replace(/'s/gi, " is").replace(/'re/gi, " are"),
            context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          });
        }
      }
      return violations;
    },
    autoFix: (text, violation) => {
      return text.slice(0, violation.start) + 
             (violation.suggestion || violation.message) + 
             text.slice(violation.end);
    },
  },
  
  {
    id: "tone-first-person",
    name: "Limit First Person",
    category: "tone",
    description: "Avoid excessive use of first person pronouns",
    severity: "suggestion",
    enabled: true,
    check: (text) => {
      const firstPerson = /\b(I|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi;
      const violations: Violation[] = [];
      let match;
      let count = 0;
      
      while ((match = firstPerson.exec(text)) !== null) {
        count++;
        if (count > 3) { // Allow some first person
          violations.push({
            ruleId: "tone-first-person",
            category: "tone",
            severity: "suggestion",
            message: `Consider reducing first-person usage (found ${count} instances)`,
            start: match.index,
            end: match.index + match[0].length,
            context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          });
        }
      }
      return violations;
    },
  },
  
  // TERMINOLOGY RULES
  {
    id: "terminology-avoid",
    name: "Avoid Ambiguous Terms",
    category: "terminology",
    description: "Avoid terms that may be ambiguous or confusing",
    severity: "warning",
    enabled: true,
    check: (text) => {
      const ambiguous = [
        /\b(user-friendly|easy to use|intuitive)\b/gi,
        /\b(etc\.|and so on|and so forth)\b/gi,
        /\b(several|various|multiple)\b/gi,
        /\b(in a timely manner|at this point in time)\b/gi,
      ];
      
      const violations: Violation[] = [];
      const suggestions: Record<string, string> = {
        "user-friendly": "usable",
        "easy to use": "efficient",
        "intuitive": "self-explanatory",
        "etc.": "such as...",
        "several": "specify number",
        "various": "specify types",
      };
      
      for (const pattern of ambiguous) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const original = match[0].toLowerCase();
          violations.push({
            ruleId: "terminology-avoid",
            category: "terminology",
            severity: "warning",
            message: `"${match[0]}" is ambiguous. Be more specific.`,
            start: match.index,
            end: match.index + match[0].length,
            suggestion: suggestions[original],
            context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          });
        }
      }
      return violations;
    },
  },
  
  // BIAS RULES
  {
    id: "bias-gender",
    name: "Gender-Inclusive Language",
    category: "bias",
    description: "Avoid gender-specific language when unnecessary",
    severity: "error",
    enabled: true,
    check: (text) => {
      const gendered = [
        { pattern: /\b(mankind|man-made|manpower)\b/gi, replacement: "humanity, artificial, workforce" },
        { pattern: /\b(he|him|his)\b\s*(?=\w+(?:s|es)\b)/gi, replacement: "they/them/their" },
        { pattern: /\b(fireman|policeman|mailman)\b/gi, replacement: "firefighter, police officer, mail carrier" },
        { pattern: /\b(chairman|spokesman|businessman)\b/gi, replacement: "chair, spokesperson, business person" },
      ];
      
      const violations: Violation[] = [];
      for (const { pattern, replacement } of gendered) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          violations.push({
            ruleId: "bias-gender",
            category: "bias",
            severity: "error",
            message: `Replace "${match[0]}" with gender-neutral alternative`,
            start: match.index,
            end: match.index + match[0].length,
            suggestion: replacement,
            context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          });
        }
      }
      return violations;
    },
  },
  
  // READABILITY RULES (calculated separately)
  {
    id: "readability-complex",
    name: "Sentence Complexity",
    category: "readability",
    description: "Sentence may be too complex for general audiences",
    severity: "warning",
    enabled: true,
    check: (text) => {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const violations: Violation[] = [];
      let position = 0;
      
      for (const sentence of sentences) {
        const wordCount = sentence.trim().split(/\s+/).length;
        if (wordCount > 25) {
          violations.push({
            ruleId: "readability-complex",
            category: "readability",
            severity: "warning",
            message: `Long sentence (${wordCount} words). Consider breaking into 2-3 shorter sentences.`,
            start: position,
            end: position + sentence.length,
            context: sentence.slice(0, 50) + "...",
          });
        }
        position += sentence.length + 1;
      }
      return violations;
    },
  },
  
  // GRAMMAR RULES
  {
    id: "grammar-double-space",
    name: "Double Spaces",
    category: "grammar",
    description: "Use single spaces between sentences",
    severity: "suggestion",
    enabled: true,
    check: (text) => {
      const doubleSpace = /\.{2,}\s{2,}/g;
      const violations: Violation[] = [];
      let match;
      
      while ((match = doubleSpace.exec(text)) !== null) {
        violations.push({
          ruleId: "grammar-double-space",
          category: "grammar",
          severity: "suggestion",
          message: "Use single space after periods",
          start: match.index,
          end: match.index + match[0].length,
          suggestion: match[0].replace(/\s{2,}/g, " "),
          context: text.slice(Math.max(0, match.index - 10), match.index + match[0].length + 10),
        });
      }
      return violations;
    },
    autoFix: (text, violation) => {
      return text.slice(0, violation.start) + 
             (violation.suggestion || "") + 
             text.slice(violation.end);
    },
  },
];

// ============================================================================
// Readability Calculation
// ============================================================================

function calculateReadability(text: string): {
  score: number;
  gradeLevel: number;
  avgSentenceLength: number;
  avgWordLength: number;
  passiveVoicePercent: number;
} {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);
  
  // Flesch Reading Ease Score
  const avgSentenceLength = words.length / Math.max(1, sentences.length);
  const avgSyllablesPerWord = syllables / Math.max(1, words.length);
  const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  
  // Flesch-Kincaid Grade Level
  const gradeLevel = (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
  
  // Average word length (characters)
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(1, words.length);
  
  // Passive voice detection (simplified)
  const passiveIndicators = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
  const passiveMatches = text.match(passiveIndicators) || [];
  const passiveVoicePercent = (passiveMatches.length / Math.max(1, sentences.length)) * 100;
  
  return {
    score: Math.max(0, Math.min(100, fleschScore)),
    gradeLevel: Math.max(0, gradeLevel),
    avgSentenceLength,
    avgWordLength,
    passiveVoicePercent,
  };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export function analyzeStyle(text: string, customRules?: StyleRule[]): StyleReport {
  const rules = customRules || DEFAULT_RULES.filter(r => r.enabled);
  const violations: Violation[] = [];
  
  // Run all enabled rules
  for (const rule of rules) {
    try {
      const ruleViolations = rule.check(text);
      violations.push(...ruleViolations);
    } catch (error) {
      console.error(`Rule ${rule.id} failed:`, error);
    }
  }
  
  // Calculate readability
  const readability = calculateReadability(text);
  
  // Count by severity
  const errorCount = violations.filter(v => v.severity === "error").length;
  const warningCount = violations.filter(v => v.severity === "warning").length;
  const suggestionCount = violations.filter(v => v.severity === "suggestion").length;
  
  return {
    violations: violations.sort((a, b) => a.start - b.start),
    errorCount,
    warningCount,
    suggestionCount,
    readabilityScore: readability.score,
    gradeLevel: readability.gradeLevel,
    avgSentenceLength: readability.avgSentenceLength,
    avgWordLength: readability.avgWordLength,
    passiveVoicePercent: readability.passiveVoicePercent,
  };
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const STYLE_PRESETS = {
  formal: {
    name: "Formal Business",
    description: "Strict formal tone for contracts and legal documents",
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: r.id.startsWith("tone-") || r.id.startsWith("bias-") || r.id === "terminology-avoid",
      severity: r.severity === "suggestion" ? "warning" : r.severity,
    })),
  },
  
  technical: {
    name: "Technical Documentation",
    description: "Clear technical writing with consistency focus",
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: ["terminology-avoid", "readability-complex", "grammar-double-space"].includes(r.id),
    })),
  },
  
  academic: {
    name: "Academic Writing",
    description: "Formal academic tone with bias avoidance",
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: !r.id.startsWith("tone-contractions"), // Allow some contractions
    })),
  },
  
  accessible: {
    name: "Accessible/WCAG",
    description: "Maximum accessibility compliance",
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: true,
      severity: r.category === "accessibility" ? "error" : r.severity,
    })),
  },
};

// ============================================================================
// React Hooks
// ============================================================================

export function useStyleGuide() {
  const [report, setReport] = useState<StyleReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activePreset, setActivePreset] = useState<keyof typeof STYLE_PRESETS>("formal");
  const [customRules, setCustomRules] = useState<StyleRule[]>([]);

  const analyze = useCallback((text: string) => {
    setIsAnalyzing(true);
    try {
      const preset = STYLE_PRESETS[activePreset];
      const rules = customRules.length > 0 ? customRules : preset.rules;
      const result = analyzeStyle(text, rules);
      setReport(result);
      return result;
    } finally {
      setIsAnalyzing(false);
    }
  }, [activePreset, customRules]);

  const toggleRule = useCallback((ruleId: string) => {
    setCustomRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  }, []);

  const autoFix = useCallback((text: string): string => {
    if (!report) return text;
    
    let fixed = text;
    // Apply fixes from right to left to preserve positions
    const fixableViolations = report.violations
      .filter(v => v.severity !== "error") // Don't auto-fix errors
      .sort((a, b) => b.start - a.start);
    
    for (const violation of fixableViolations) {
      const rule = DEFAULT_RULES.find(r => r.id === violation.ruleId);
      if (rule?.autoFix) {
        fixed = rule.autoFix(fixed, { ...violation, start: violation.start, end: violation.end });
      }
    }
    
    return fixed;
  }, [report]);

  return {
    report,
    isAnalyzing,
    activePreset,
    setActivePreset,
    customRules,
    analyze,
    toggleRule,
    autoFix,
    presets: STYLE_PRESETS,
  };
}

export function useRealtimeStyleGuide(debounceMs: number = 500) {
  const [text, setText] = useState("");
  const styleGuide = useStyleGuide();
  
  // Debounced analysis
  useMemo(() => {
    const timer = setTimeout(() => {
      if (text.length > 0) {
        styleGuide.analyze(text);
      }
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  return {
    ...styleGuide,
    text,
    setText,
  };
}
