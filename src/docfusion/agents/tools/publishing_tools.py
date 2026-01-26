"""
Publishing & Quality Assurance Tools for Agents

Provides specialized tools for drafters, writers, researchers, proofreaders, 
auditors, quality assurance professionals, printers, publishers, packagers, 
and report delivery teams.
"""

import asyncio
import re
import json
import hashlib
import difflib
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from datetime import datetime
from pathlib import Path
import statistics
from urllib.parse import urlparse
import mimetypes
import zipfile
import tempfile
import os

from .base import AgentTool, ToolResult, ToolCapability, ToolError, ToolConfig


class GrammarCheckerTool(AgentTool):
	"""
	Advanced grammar, style, and readability analysis tool
	
	Essential for writers, proofreaders, and QA teams to ensure professional document quality.
	Provides comprehensive text analysis including grammar errors, style suggestions, 
	readability metrics, and writing quality assessment.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="grammar_checker",
			description="Advanced grammar, style, and readability analysis for professional writing",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, text: str, check_type: str = "comprehensive",
					 language: str = "en", style_guide: str = "professional", **kwargs) -> ToolResult:
		"""Execute grammar and style checking"""
		
		try:
			analysis_results = {
				"text_length": len(text),
				"word_count": len(text.split()),
				"sentence_count": len(re.findall(r'[.!?]+', text)),
				"paragraph_count": len([p for p in text.split('\n\n') if p.strip()]),
			}
			
			if check_type in ["grammar", "comprehensive"]:
				grammar_issues = await self._check_grammar(text)
				analysis_results["grammar_issues"] = grammar_issues
			
			if check_type in ["style", "comprehensive"]:
				style_suggestions = await self._analyze_style(text, style_guide)
				analysis_results["style_suggestions"] = style_suggestions
			
			if check_type in ["readability", "comprehensive"]:
				readability_metrics = await self._calculate_readability(text)
				analysis_results["readability_metrics"] = readability_metrics
			
			# Overall quality score
			quality_score = await self._calculate_quality_score(analysis_results)
			analysis_results["overall_quality_score"] = quality_score
			
			return ToolResult(
				success=True,
				data=analysis_results,
				tool_name=self.name,
				metadata={
					"check_type": check_type,
					"language": language,
					"style_guide": style_guide
				}
			)
			
		except Exception as e:
			raise ToolError(f"Grammar checking failed: {str(e)}", self.name, "GRAMMAR_CHECK_ERROR")
	
	async def _check_grammar(self, text: str) -> List[Dict[str, Any]]:
		"""Check for grammar issues using rule-based analysis"""
		issues = []
		
		# Common grammar patterns to check
		grammar_patterns = [
			# Subject-verb disagreement patterns
			(r'\b(he|she|it)\s+(are|were)\b', "Subject-verb disagreement", "high"),
			(r'\b(they|we|you)\s+(is|was)\b', "Subject-verb disagreement", "high"),
			
			# Double words
			(r'\b(\w+)\s+\1\b', "Repeated word", "medium"),
			
			# Apostrophe errors
			(r'\bits\s', "Consider 'it's' if you mean 'it is'", "low"),
			(r'\byour\s+welcome\b', "Should be 'you're welcome'", "medium"),
			
			# Common spelling errors
			(r'\baccommodate\b', "Check spelling: accommodate", "low"),
			(r'\boccured\b', "Should be 'occurred'", "medium"),
			
			# Passive voice detection
			(r'\b(is|are|was|were|been|being)\s+\w+ed\b', "Consider active voice", "low"),
		]
		
		for pattern, message, severity in grammar_patterns:
			matches = list(re.finditer(pattern, text, re.IGNORECASE))
			for match in matches:
				issues.append({
					"type": "grammar",
					"message": message,
					"severity": severity,
					"position": match.start(),
					"text": match.group(),
					"context": text[max(0, match.start()-20):match.end()+20]
				})
		
		return issues[:50]  # Limit to 50 issues
	
	async def _analyze_style(self, text: str, style_guide: str) -> List[Dict[str, Any]]:
		"""Analyze writing style and provide suggestions"""
		suggestions = []
		
		sentences = re.split(r'[.!?]+', text)
		words = text.split()
		
		# Sentence length analysis
		sentence_lengths = [len(s.split()) for s in sentences if s.strip()]
		if sentence_lengths:
			avg_length = statistics.mean(sentence_lengths)
			if avg_length > 25:
				suggestions.append({
					"type": "style",
					"category": "sentence_length",
					"message": f"Average sentence length ({avg_length:.1f} words) is quite long. Consider shorter sentences for clarity.",
					"severity": "medium",
					"suggestion": "Break long sentences into shorter ones"
				})
		
		# Word repetition
		word_freq = {}
		for word in [w.lower().strip('.,!?";') for w in words if len(w) > 4]:
			word_freq[word] = word_freq.get(word, 0) + 1
		
		overused_words = [(w, c) for w, c in word_freq.items() if c > 5]
		if overused_words:
			suggestions.append({
				"type": "style",
				"category": "word_repetition",
				"message": f"Frequently repeated words: {', '.join([f'{w} ({c}x)' for w, c in overused_words[:5]])}",
				"severity": "low",
				"suggestion": "Consider using synonyms for variety"
			})
		
		# Professional tone check for business writing
		if style_guide == "professional":
			casual_phrases = [
				"gonna", "wanna", "kinda", "sorta", "lots of", "a bunch of", 
				"really really", "super", "awesome", "cool", "stuff"
			]
			for phrase in casual_phrases:
				if phrase in text.lower():
					suggestions.append({
						"type": "style",
						"category": "tone",
						"message": f"Consider replacing '{phrase}' with more formal language",
						"severity": "low",
						"suggestion": "Use professional terminology"
					})
		
		return suggestions[:30]  # Limit suggestions
	
	async def _calculate_readability(self, text: str) -> Dict[str, float]:
		"""Calculate readability metrics"""
		words = text.split()
		sentences = re.split(r'[.!?]+', text)
		sentences = [s for s in sentences if s.strip()]
		
		if not words or not sentences:
			return {"flesch_score": 0, "grade_level": 0, "reading_ease": "unreadable"}
		
		# Basic metrics
		word_count = len(words)
		sentence_count = len(sentences)
		
		# Average sentence length
		avg_sentence_length = word_count / sentence_count
		
		# Syllable estimation (rough)
		syllable_count = sum(max(1, len(re.findall(r'[aeiouAEIOU]', word))) for word in words)
		avg_syllables_per_word = syllable_count / word_count
		
		# Flesch Reading Ease Score (simplified)
		flesch_score = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
		flesch_score = max(0, min(100, flesch_score))  # Clamp to 0-100
		
		# Reading level interpretation
		if flesch_score >= 90:
			reading_ease = "very easy"
		elif flesch_score >= 80:
			reading_ease = "easy"
		elif flesch_score >= 70:
			reading_ease = "fairly easy"
		elif flesch_score >= 60:
			reading_ease = "standard"
		elif flesch_score >= 50:
			reading_ease = "fairly difficult"
		elif flesch_score >= 30:
			reading_ease = "difficult"
		else:
			reading_ease = "very difficult"
		
		# Estimated grade level
		grade_level = 0.39 * avg_sentence_length + 11.8 * avg_syllables_per_word - 15.59
		grade_level = max(1, grade_level)
		
		return {
			"flesch_score": round(flesch_score, 1),
			"grade_level": round(grade_level, 1),
			"reading_ease": reading_ease,
			"avg_sentence_length": round(avg_sentence_length, 1),
			"avg_syllables_per_word": round(avg_syllables_per_word, 2)
		}
	
	async def _calculate_quality_score(self, analysis_results: Dict[str, Any]) -> float:
		"""Calculate overall writing quality score"""
		score = 100.0
		
		# Deduct points for grammar issues
		if "grammar_issues" in analysis_results:
			grammar_issues = analysis_results["grammar_issues"]
			high_severity = len([i for i in grammar_issues if i["severity"] == "high"])
			medium_severity = len([i for i in grammar_issues if i["severity"] == "medium"])
			
			score -= (high_severity * 5) + (medium_severity * 2)
		
		# Readability factor
		if "readability_metrics" in analysis_results:
			flesch_score = analysis_results["readability_metrics"]["flesch_score"]
			if flesch_score < 30:  # Very difficult
				score -= 10
			elif flesch_score > 90:  # Too simple for professional content
				score -= 5
		
		return max(0, min(100, score))
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for grammar checker"""
		return {
			"type": "object",
			"properties": {
				"text": {
					"type": "string",
					"description": "Text to analyze for grammar and style"
				},
				"check_type": {
					"type": "string",
					"enum": ["grammar", "style", "readability", "comprehensive"],
					"default": "comprehensive",
					"description": "Type of analysis to perform"
				},
				"language": {
					"type": "string",
					"default": "en",
					"description": "Language code for analysis"
				},
				"style_guide": {
					"type": "string",
					"enum": ["professional", "academic", "creative", "casual"],
					"default": "professional",
					"description": "Style guide to follow"
				}
			},
			"required": ["text"]
		}


class PlagiarismDetectorTool(AgentTool):
	"""
	Content originality verification tool
	
	Critical for publishers, auditors, and QA to ensure content authenticity.
	Detects potential plagiarism through text similarity analysis, pattern matching,
	and suspicious content identification.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="plagiarism_detector",
			description="Content originality verification and plagiarism detection",
			capabilities=[ToolCapability.DATA_PROCESSING, ToolCapability.WEB_SEARCH],
			config=config
		)
	
	async def execute(self, text: str, reference_texts: Optional[List[str]] = None,
					 check_online: bool = False, similarity_threshold: float = 0.7, **kwargs) -> ToolResult:
		"""Execute plagiarism detection"""
		
		try:
			analysis_results = {
				"text_fingerprint": self._generate_text_fingerprint(text),
				"text_length": len(text),
				"suspicious_patterns": [],
				"similarity_matches": [],
				"originality_score": 100.0
			}
			
			# Check against reference texts
			if reference_texts:
				similarity_results = await self._check_text_similarity(text, reference_texts, similarity_threshold)
				analysis_results["similarity_matches"] = similarity_results
			
			# Check for suspicious patterns
			suspicious_patterns = await self._detect_suspicious_patterns(text)
			analysis_results["suspicious_patterns"] = suspicious_patterns
			
			# Calculate originality score
			originality_score = await self._calculate_originality_score(analysis_results)
			analysis_results["originality_score"] = originality_score
			
			# Determine if content is likely plagiarized
			is_plagiarized = originality_score < 70 or len(analysis_results["similarity_matches"]) > 0
			analysis_results["likely_plagiarized"] = is_plagiarized
			
			return ToolResult(
				success=True,
				data=analysis_results,
				tool_name=self.name,
				metadata={
					"similarity_threshold": similarity_threshold,
					"reference_count": len(reference_texts) if reference_texts else 0
				}
			)
			
		except Exception as e:
			raise ToolError(f"Plagiarism detection failed: {str(e)}", self.name, "PLAGIARISM_CHECK_ERROR")
	
	def _generate_text_fingerprint(self, text: str) -> str:
		"""Generate a unique fingerprint for text content"""
		# Normalize text for fingerprinting
		normalized = re.sub(r'[^\w\s]', '', text.lower())
		normalized = ' '.join(normalized.split())  # Normalize whitespace
		return hashlib.md5(normalized.encode()).hexdigest()
	
	async def _check_text_similarity(self, text: str, reference_texts: List[str], 
									threshold: float) -> List[Dict[str, Any]]:
		"""Check similarity against reference texts"""
		matches = []
		
		text_words = set(text.lower().split())
		
		for i, ref_text in enumerate(reference_texts):
			ref_words = set(ref_text.lower().split())
			
			# Jaccard similarity
			intersection = len(text_words & ref_words)
			union = len(text_words | ref_words)
			jaccard_similarity = intersection / union if union > 0 else 0
			
			# Sequence matching for longer phrases
			sequence_matcher = difflib.SequenceMatcher(None, text.lower(), ref_text.lower())
			sequence_similarity = sequence_matcher.ratio()
			
			# Combined similarity score
			combined_similarity = (jaccard_similarity + sequence_similarity) / 2
			
			if combined_similarity >= threshold:
				# Find longest common subsequences
				longest_match = sequence_matcher.find_longest_match(0, len(text), 0, len(ref_text))
				common_text = text[longest_match.a:longest_match.a + longest_match.size]
				
				matches.append({
					"reference_index": i,
					"similarity_score": round(combined_similarity, 3),
					"jaccard_similarity": round(jaccard_similarity, 3),
					"sequence_similarity": round(sequence_similarity, 3),
					"common_text_length": longest_match.size,
					"common_text_sample": common_text[:200] if common_text else "",
					"suspected_plagiarism": combined_similarity > 0.8
				})
		
		return matches
	
	async def _detect_suspicious_patterns(self, text: str) -> List[Dict[str, Any]]:
		"""Detect patterns that might indicate plagiarism"""
		patterns = []
		
		# Inconsistent writing style (sudden changes in complexity)
		sentences = re.split(r'[.!?]+', text)
		sentence_complexities = []
		
		for sentence in sentences:
			if sentence.strip():
				words = sentence.split()
				avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
				sentence_complexities.append(avg_word_length)
		
		if len(sentence_complexities) > 5:
			complexity_variance = statistics.variance(sentence_complexities)
			if complexity_variance > 10:  # High variance in sentence complexity
				patterns.append({
					"type": "style_inconsistency",
					"description": "Inconsistent writing style detected",
					"severity": "medium",
					"metric": f"Complexity variance: {complexity_variance:.2f}"
				})
		
		# Multiple formatting styles
		format_indicators = [
			len(re.findall(r'[A-Z]{2,}', text)),  # All caps words
			len(re.findall(r'\b\w+\.\w+\b', text)),  # Words with periods
			len(re.findall(r'[\(\)\[\]]', text)),  # Brackets and parentheses
		]
		
		if max(format_indicators) > 10 and min(format_indicators) == 0:
			patterns.append({
				"type": "formatting_inconsistency",
				"description": "Inconsistent formatting patterns detected",
				"severity": "low",
				"metric": "Mixed formatting styles"
			})
		
		# Suspicious quotation patterns
		quote_count = len(re.findall(r'"[^"]{50,}"', text))  # Long quoted passages
		if quote_count > 3:
			patterns.append({
				"type": "excessive_quotations",
				"description": "High number of long quoted passages",
				"severity": "medium",
				"metric": f"{quote_count} long quoted passages"
			})
		
		return patterns
	
	async def _calculate_originality_score(self, analysis_results: Dict[str, Any]) -> float:
		"""Calculate content originality score"""
		score = 100.0
		
		# Deduct for similarity matches
		for match in analysis_results["similarity_matches"]:
			if match["suspected_plagiarism"]:
				score -= 30
			else:
				score -= 10
		
		# Deduct for suspicious patterns
		for pattern in analysis_results["suspicious_patterns"]:
			if pattern["severity"] == "high":
				score -= 15
			elif pattern["severity"] == "medium":
				score -= 10
			else:
				score -= 5
		
		return max(0, score)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for plagiarism detector"""
		return {
			"type": "object",
			"properties": {
				"text": {
					"type": "string",
					"description": "Text to check for plagiarism"
				},
				"reference_texts": {
					"type": "array",
					"items": {"type": "string"},
					"description": "Reference texts to compare against"
				},
				"check_online": {
					"type": "boolean",
					"default": False,
					"description": "Check against online sources (requires web search)"
				},
				"similarity_threshold": {
					"type": "number",
					"default": 0.7,
					"minimum": 0.0,
					"maximum": 1.0,
					"description": "Similarity threshold for flagging matches"
				}
			},
			"required": ["text"]
		}


class DocumentComparatorTool(AgentTool):
	"""
	Version comparison and change tracking tool
	
	Vital for editors, auditors, and QA to track revisions and ensure consistency.
	Provides detailed diff analysis, change statistics, and version comparison reports.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="document_comparator",
			description="Version comparison and change tracking for document revision management",
			capabilities=[ToolCapability.DATA_PROCESSING, ToolCapability.FILE_OPERATIONS],
			config=config
		)
	
	async def execute(self, document1: str, document2: str, comparison_type: str = "comprehensive",
					 ignore_whitespace: bool = False, context_lines: int = 3, **kwargs) -> ToolResult:
		"""Execute document comparison"""
		
		try:
			if ignore_whitespace:
				doc1_normalized = ' '.join(document1.split())
				doc2_normalized = ' '.join(document2.split())
			else:
				doc1_normalized = document1
				doc2_normalized = document2
			
			comparison_results = {
				"documents_identical": doc1_normalized == doc2_normalized,
				"document1_length": len(document1),
				"document2_length": len(document2),
				"length_difference": len(document2) - len(document1),
			}
			
			if comparison_type in ["diff", "comprehensive"]:
				diff_results = await self._generate_diff(doc1_normalized, doc2_normalized, context_lines)
				comparison_results["diff_analysis"] = diff_results
			
			if comparison_type in ["statistics", "comprehensive"]:
				change_stats = await self._calculate_change_statistics(doc1_normalized, doc2_normalized)
				comparison_results["change_statistics"] = change_stats
			
			if comparison_type in ["semantic", "comprehensive"]:
				semantic_changes = await self._analyze_semantic_changes(doc1_normalized, doc2_normalized)
				comparison_results["semantic_analysis"] = semantic_changes
			
			# Overall change score
			change_score = await self._calculate_change_score(comparison_results)
			comparison_results["change_score"] = change_score
			
			return ToolResult(
				success=True,
				data=comparison_results,
				tool_name=self.name,
				metadata={
					"comparison_type": comparison_type,
					"ignore_whitespace": ignore_whitespace,
					"context_lines": context_lines
				}
			)
			
		except Exception as e:
			raise ToolError(f"Document comparison failed: {str(e)}", self.name, "COMPARISON_ERROR")
	
	async def _generate_diff(self, doc1: str, doc2: str, context_lines: int) -> Dict[str, Any]:
		"""Generate detailed diff analysis"""
		diff_generator = difflib.unified_diff(
			doc1.splitlines(keepends=True),
			doc2.splitlines(keepends=True),
			fromfile='Document 1',
			tofile='Document 2',
			n=context_lines
		)
		
		diff_lines = list(diff_generator)
		
		# Parse diff statistics
		additions = len([line for line in diff_lines if line.startswith('+')])
		deletions = len([line for line in diff_lines if line.startswith('-')])
		modifications = min(additions, deletions)
		
		# Extract changed sections
		changed_sections = []
		current_section = []
		
		for line in diff_lines:
			if line.startswith('@@'):
				if current_section:
					changed_sections.append(''.join(current_section))
					current_section = []
			current_section.append(line)
		
		if current_section:
			changed_sections.append(''.join(current_section))
		
		return {
			"diff_text": ''.join(diff_lines),
			"total_changes": len(diff_lines),
			"additions": additions,
			"deletions": deletions,
			"modifications": modifications,
			"changed_sections": changed_sections[:10]  # Limit to first 10 sections
		}
	
	async def _calculate_change_statistics(self, doc1: str, doc2: str) -> Dict[str, Any]:
		"""Calculate detailed change statistics"""
		words1 = doc1.split()
		words2 = doc2.split()
		
		# Word-level changes
		seq_matcher = difflib.SequenceMatcher(None, words1, words2)
		
		word_changes = {
			"words_added": 0,
			"words_deleted": 0,
			"words_changed": 0,
			"similarity_ratio": seq_matcher.ratio()
		}
		
		for tag, i1, i2, j1, j2 in seq_matcher.get_opcodes():
			if tag == 'delete':
				word_changes["words_deleted"] += (i2 - i1)
			elif tag == 'insert':
				word_changes["words_added"] += (j2 - j1)
			elif tag == 'replace':
				word_changes["words_changed"] += max(i2 - i1, j2 - j1)
		
		# Sentence-level changes
		sentences1 = re.split(r'[.!?]+', doc1)
		sentences2 = re.split(r'[.!?]+', doc2)
		
		sentence_changes = {
			"sentences_original": len([s for s in sentences1 if s.strip()]),
			"sentences_new": len([s for s in sentences2 if s.strip()]),
			"sentences_difference": len(sentences2) - len(sentences1)
		}
		
		# Character-level changes
		char_similarity = difflib.SequenceMatcher(None, doc1, doc2).ratio()
		
		return {
			"word_changes": word_changes,
			"sentence_changes": sentence_changes,
			"character_similarity": round(char_similarity, 3),
			"overall_similarity": round((word_changes["similarity_ratio"] + char_similarity) / 2, 3)
		}
	
	async def _analyze_semantic_changes(self, doc1: str, doc2: str) -> Dict[str, Any]:
		"""Analyze semantic changes between documents"""
		# Extract key terms and concepts
		def extract_key_terms(text: str) -> Set[str]:
			# Simple key term extraction (can be enhanced with NLP)
			words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
			# Filter common words
			common_words = {'that', 'this', 'with', 'have', 'will', 'been', 'their', 'said', 'each', 'which', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also'}
			return set(word for word in words if word not in common_words)
		
		terms1 = extract_key_terms(doc1)
		terms2 = extract_key_terms(doc2)
		
		# Concept analysis
		terms_added = terms2 - terms1
		terms_removed = terms1 - terms2
		terms_retained = terms1 & terms2
		
		# Topic shift analysis (simplified)
		topic_similarity = len(terms_retained) / len(terms1 | terms2) if terms1 or terms2 else 1.0
		
		return {
			"key_terms_added": list(terms_added)[:20],
			"key_terms_removed": list(terms_removed)[:20],
			"key_terms_retained": len(terms_retained),
			"topic_similarity": round(topic_similarity, 3),
			"semantic_shift": "high" if topic_similarity < 0.6 else "medium" if topic_similarity < 0.8 else "low"
		}
	
	async def _calculate_change_score(self, comparison_results: Dict[str, Any]) -> float:
		"""Calculate overall change score (0-100, where 0 = identical, 100 = completely different)"""
		if comparison_results["documents_identical"]:
			return 0.0
		
		# Base score from similarity ratio
		if "change_statistics" in comparison_results:
			similarity = comparison_results["change_statistics"]["overall_similarity"]
			base_score = (1 - similarity) * 100
		else:
			base_score = 50.0  # Default if no stats available
		
		# Adjust based on semantic changes
		if "semantic_analysis" in comparison_results:
			topic_similarity = comparison_results["semantic_analysis"]["topic_similarity"]
			semantic_adjustment = (1 - topic_similarity) * 20
			base_score += semantic_adjustment
		
		return min(100.0, base_score)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for document comparator"""
		return {
			"type": "object",
			"properties": {
				"document1": {
					"type": "string",
					"description": "First document content for comparison"
				},
				"document2": {
					"type": "string", 
					"description": "Second document content for comparison"
				},
				"comparison_type": {
					"type": "string",
					"enum": ["diff", "statistics", "semantic", "comprehensive"],
					"default": "comprehensive",
					"description": "Type of comparison analysis to perform"
				},
				"ignore_whitespace": {
					"type": "boolean",
					"default": False,
					"description": "Ignore whitespace differences in comparison"
				},
				"context_lines": {
					"type": "integer",
					"default": 3,
					"minimum": 0,
					"maximum": 10,
					"description": "Number of context lines in diff output"
				}
			},
			"required": ["document1", "document2"]
		}


class CitationValidatorTool(AgentTool):
	"""
	Academic and professional citation verification tool
	
	Essential for researchers, writers, and editors to ensure proper citation formatting.
	Validates citations against multiple styles (APA, MLA, Chicago) and checks for 
	consistency and completeness in reference lists.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="citation_validator",
			description="Academic and professional citation verification and formatting validation",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, text: str, citation_style: str = "APA", 
					 check_consistency: bool = True, validate_urls: bool = False, **kwargs) -> ToolResult:
		"""Execute citation validation"""
		
		try:
			validation_results = {
				"citation_style": citation_style,
				"total_citations": 0,
				"in_text_citations": [],
				"reference_list": [],
				"validation_issues": [],
				"consistency_score": 100.0
			}
			
			# Extract citations from text
			in_text_citations = await self._extract_in_text_citations(text, citation_style)
			reference_citations = await self._extract_reference_list(text, citation_style)
			
			validation_results["in_text_citations"] = in_text_citations
			validation_results["reference_list"] = reference_citations
			validation_results["total_citations"] = len(in_text_citations) + len(reference_citations)
			
			# Validate citation format
			format_issues = await self._validate_citation_format(reference_citations, citation_style)
			validation_results["validation_issues"].extend(format_issues)
			
			# Check consistency if requested
			if check_consistency:
				consistency_issues = await self._check_citation_consistency(in_text_citations, reference_citations)
				validation_results["validation_issues"].extend(consistency_issues)
			
			# Validate URLs if requested
			if validate_urls:
				url_issues = await self._validate_citation_urls(reference_citations)
				validation_results["validation_issues"].extend(url_issues)
			
			# Calculate consistency score
			consistency_score = await self._calculate_consistency_score(validation_results)
			validation_results["consistency_score"] = consistency_score
			
			# Overall assessment
			high_issues = len([i for i in validation_results["validation_issues"] if i["severity"] == "high"])
			validation_results["needs_attention"] = high_issues > 0 or consistency_score < 80
			
			return ToolResult(
				success=True,
				data=validation_results,
				tool_name=self.name,
				metadata={
					"citation_style": citation_style,
					"check_consistency": check_consistency,
					"validate_urls": validate_urls
				}
			)
			
		except Exception as e:
			raise ToolError(f"Citation validation failed: {str(e)}", self.name, "CITATION_VALIDATION_ERROR")
	
	async def _extract_in_text_citations(self, text: str, style: str) -> List[Dict[str, Any]]:
		"""Extract in-text citations based on style"""
		citations = []
		
		if style.upper() == "APA":
			# APA style: (Author, Year) or (Author et al., Year)
			apa_pattern = r'\(([^\)]*\d{4}[^\)]*)\)'
			matches = re.finditer(apa_pattern, text)
			for match in matches:
				citations.append({
					"text": match.group(),
					"position": match.start(),
					"style": "APA",
					"type": "in_text"
				})
			
		elif style.upper() == "MLA":
			# MLA style: (Author page) or (Author)
			mla_pattern = r'\(([^\)]*[A-Za-z][^\)]*)\)'
			matches = re.finditer(mla_pattern, text)
			for match in matches:
				citations.append({
					"text": match.group(),
					"position": match.start(),
					"style": "MLA",
					"type": "in_text"
				})
			
		elif style.upper() == "CHICAGO":
			# Chicago style: footnote numbers or (Author Date)
			chicago_pattern = r'\(([^\)]*\d{4}[^\)]*)\)'
			matches = re.finditer(chicago_pattern, text)
			for match in matches:
				citations.append({
					"text": match.group(),
					"position": match.start(),
					"style": "Chicago",
					"type": "in_text"
				})
		
		return citations[:50]  # Limit to 50 citations
	
	async def _extract_reference_list(self, text: str, style: str) -> List[Dict[str, Any]]:
		"""Extract references from bibliography/works cited section"""
		references = []
		
		# Find reference section
		ref_section_patterns = [
			r'References\s*\n(.+?)(?=\n\n|\Z)',
			r'Bibliography\s*\n(.+?)(?=\n\n|\Z)',
			r'Works Cited\s*\n(.+?)(?=\n\n|\Z)'
		]
		
		ref_text = ""
		for pattern in ref_section_patterns:
			match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
			if match:
				ref_text = match.group(1)
				break
		
		if not ref_text:
			return references
		
		# Split into individual references
		ref_lines = [line.strip() for line in ref_text.split('\n') if line.strip()]
		
		for i, ref_line in enumerate(ref_lines):
			if len(ref_line) > 20:  # Skip short lines
				references.append({
					"text": ref_line,
					"index": i + 1,
					"style": style,
					"type": "reference",
					"has_doi": "doi:" in ref_line.lower() or "doi.org" in ref_line.lower(),
					"has_url": "http" in ref_line.lower()
				})
		
		return references
	
	async def _validate_citation_format(self, references: List[Dict[str, Any]], style: str) -> List[Dict[str, Any]]:
		"""Validate citation format against style guidelines"""
		issues = []
		
		for ref in references:
			ref_text = ref["text"]
			
			# Basic format checks
			if style.upper() == "APA":
				# APA checks: Author (Year). Title. Journal/Publisher.
				if not re.search(r'\(\d{4}\)', ref_text):
					issues.append({
						"type": "format",
						"reference_index": ref["index"],
						"message": "APA citation missing year in parentheses",
						"severity": "high",
						"reference_text": ref_text[:100]
					})
				
				if not ref_text.endswith('.'):
					issues.append({
						"type": "format",
						"reference_index": ref["index"],
						"message": "APA citation should end with period",
						"severity": "medium",
						"reference_text": ref_text[:100]
					})
			
			# Check for common formatting issues
			if ref_text.count('(') != ref_text.count(')'):
				issues.append({
					"type": "format",
					"reference_index": ref["index"],
					"message": "Mismatched parentheses in citation",
					"severity": "high",
					"reference_text": ref_text[:100]
				})
		
		return issues
	
	async def _check_citation_consistency(self, in_text: List[Dict[str, Any]], references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
		"""Check consistency between in-text citations and reference list"""
		issues = []
		
		# Extract author names from references
		ref_authors = set()
		for ref in references:
			# Simple author extraction (first word before comma or period)
			match = re.match(r'^([A-Za-z]+)', ref["text"])
			if match:
				ref_authors.add(match.group(1).lower())
		
		# Check if in-text citations have corresponding references
		for citation in in_text:
			citation_text = citation["text"].lower()
			found_match = False
			
			for author in ref_authors:
				if author in citation_text:
					found_match = True
					break
			
			if not found_match and len(in_text) > 0:
				issues.append({
					"type": "consistency",
					"message": f"In-text citation may not have corresponding reference: {citation['text']}",
					"severity": "medium",
					"citation_text": citation["text"]
				})
		
		return issues[:10]  # Limit to 10 consistency issues
	
	async def _validate_citation_urls(self, references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
		"""Validate URLs in citations"""
		issues = []
		
		url_pattern = r'https?://[^\s]+'
		
		for ref in references:
			urls = re.findall(url_pattern, ref["text"])
			for url in urls:
				# Basic URL format validation
				if not self._is_valid_url_format(url):
					issues.append({
						"type": "url",
						"reference_index": ref["index"],
						"message": f"Invalid URL format: {url}",
						"severity": "medium",
						"url": url
					})
		
		return issues
	
	def _is_valid_url_format(self, url: str) -> bool:
		"""Basic URL format validation"""
		try:
			parsed = urlparse(url)
			return bool(parsed.scheme and parsed.netloc)
		except:
			return False
	
	async def _calculate_consistency_score(self, validation_results: Dict[str, Any]) -> float:
		"""Calculate overall citation consistency score"""
		score = 100.0
		
		# Deduct points for issues
		for issue in validation_results["validation_issues"]:
			if issue["severity"] == "high":
				score -= 10
			elif issue["severity"] == "medium":
				score -= 5
			else:
				score -= 2
		
		return max(0, score)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for citation validator"""
		return {
			"type": "object",
			"properties": {
				"text": {
					"type": "string",
					"description": "Document text containing citations to validate"
				},
				"citation_style": {
					"type": "string",
					"enum": ["APA", "MLA", "Chicago", "Harvard"],
					"default": "APA",
					"description": "Citation style to validate against"
				},
				"check_consistency": {
					"type": "boolean",
					"default": True,
					"description": "Check consistency between in-text and reference citations"
				},
				"validate_urls": {
					"type": "boolean",
					"default": False,
					"description": "Validate URL formats in citations"
				}
			},
			"required": ["text"]
		}


class DocumentFormatterTool(AgentTool):
	"""
	Professional document formatting and styling tool
	
	Critical for publishers, printers, and editors to ensure consistent formatting.
	Handles document structure, typography, spacing, and style compliance
	according to various professional standards.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="document_formatter",
			description="Professional document formatting and style compliance tool",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, text: str, format_style: str = "professional",
					 fix_spacing: bool = True, fix_typography: bool = True, 
					 apply_headings: bool = True, **kwargs) -> ToolResult:
		"""Execute document formatting"""
		
		try:
			formatting_results = {
				"original_length": len(text),
				"format_style": format_style,
				"formatting_changes": [],
				"formatted_text": text,
				"style_compliance": 0.0
			}
			
			formatted_text = text
			changes = []
			
			# Fix spacing issues
			if fix_spacing:
				formatted_text, spacing_changes = await self._fix_spacing_issues(formatted_text)
				changes.extend(spacing_changes)
			
			# Fix typography
			if fix_typography:
				formatted_text, typo_changes = await self._fix_typography_issues(formatted_text)
				changes.extend(typo_changes)
			
			# Apply heading structure
			if apply_headings:
				formatted_text, heading_changes = await self._format_headings(formatted_text, format_style)
				changes.extend(heading_changes)
			
			# Apply style-specific formatting
			formatted_text, style_changes = await self._apply_style_formatting(formatted_text, format_style)
			changes.extend(style_changes)
			
			formatting_results["formatted_text"] = formatted_text
			formatting_results["formatting_changes"] = changes
			formatting_results["changes_made"] = len(changes)
			formatting_results["final_length"] = len(formatted_text)
			
			# Calculate style compliance score
			compliance_score = await self._calculate_style_compliance(formatted_text, format_style)
			formatting_results["style_compliance"] = compliance_score
			
			return ToolResult(
				success=True,
				data=formatting_results,
				tool_name=self.name,
				metadata={
					"format_style": format_style,
					"changes_applied": len(changes)
				}
			)
			
		except Exception as e:
			raise ToolError(f"Document formatting failed: {str(e)}", self.name, "FORMATTING_ERROR")
	
	async def _fix_spacing_issues(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
		"""Fix common spacing and whitespace issues"""
		changes = []
		formatted_text = text
		
		# Fix multiple spaces
		original_text = formatted_text
		formatted_text = re.sub(r' {2,}', ' ', formatted_text)
		if formatted_text != original_text:
			changes.append({
				"type": "spacing",
				"description": "Removed multiple consecutive spaces",
				"count": len(re.findall(r' {2,}', original_text))
			})
		
		# Fix paragraph spacing
		original_text = formatted_text
		formatted_text = re.sub(r'\n{3,}', '\n\n', formatted_text)
		if formatted_text != original_text:
			changes.append({
				"type": "spacing",
				"description": "Fixed paragraph spacing (removed excessive line breaks)",
				"count": len(re.findall(r'\n{3,}', original_text))
			})
		
		# Fix spaces before punctuation
		original_text = formatted_text
		formatted_text = re.sub(r' +([.,;:!?])', r'\1', formatted_text)
		if formatted_text != original_text:
			changes.append({
				"type": "spacing",
				"description": "Removed spaces before punctuation",
				"count": len(re.findall(r' +[.,;:!?]', original_text))
			})
		
		# Add space after punctuation where missing
		original_text = formatted_text
		formatted_text = re.sub(r'([.,;:!?])([A-Za-z])', r'\1 \2', formatted_text)
		if formatted_text != original_text:
			changes.append({
				"type": "spacing",
				"description": "Added missing spaces after punctuation",
				"count": len(re.findall(r'[.,;:!?][A-Za-z]', original_text))
			})
		
		return formatted_text, changes
	
	async def _fix_typography_issues(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
		"""Fix typography and character issues"""
		changes = []
		formatted_text = text
		
		# Fix smart quotes
		original_text = formatted_text
		formatted_text = formatted_text.replace('"', '"').replace('"', '"')
		formatted_text = formatted_text.replace(''', "'").replace(''', "'")
		if formatted_text != original_text:
			changes.append({
				"type": "typography",
				"description": "Converted smart quotes to standard quotes",
				"count": len(original_text) - len(formatted_text.replace('"', '').replace("'", ''))
			})
		
		# Fix em dashes
		original_text = formatted_text
		formatted_text = formatted_text.replace('—', ' -- ').replace('–', ' - ')
		if formatted_text != original_text:
			changes.append({
				"type": "typography",
				"description": "Converted em/en dashes to standard dashes",
				"count": original_text.count('—') + original_text.count('–')
			})
		
		# Fix ellipsis
		original_text = formatted_text
		formatted_text = formatted_text.replace('…', '...')
		if formatted_text != original_text:
			changes.append({
				"type": "typography",
				"description": "Converted ellipsis character to three dots",
				"count": original_text.count('…')
			})
		
		return formatted_text, changes
	
	async def _format_headings(self, text: str, style: str) -> Tuple[str, List[Dict[str, Any]]]:
		"""Format headings according to style guidelines"""
		changes = []
		formatted_text = text
		
		# Detect potential headings (lines that are short and followed by content)
		lines = formatted_text.split('\n')
		heading_indices = []
		
		for i, line in enumerate(lines):
			if (len(line.strip()) > 5 and len(line.strip()) < 80 and 
				not line.strip().endswith('.') and 
				i < len(lines) - 1 and 
				lines[i + 1].strip()):
				
				# Check if next line looks like content
				next_line = lines[i + 1].strip()
				if len(next_line) > 20 and (next_line[0].isupper() or next_line.startswith('The')):
					heading_indices.append(i)
		
		# Format detected headings
		if heading_indices and style == "professional":
			for i in reversed(heading_indices):  # Reverse to maintain indices
				heading = lines[i].strip()
				if not heading.isupper() and not heading.islower():
					# Title case for professional style
					formatted_heading = heading.title()
					lines[i] = formatted_heading
					changes.append({
						"type": "heading",
						"description": f"Formatted heading: '{heading}' -> '{formatted_heading}'",
						"original": heading,
						"formatted": formatted_heading
					})
		
		formatted_text = '\n'.join(lines)
		return formatted_text, changes
	
	async def _apply_style_formatting(self, text: str, style: str) -> Tuple[str, List[Dict[str, Any]]]:
		"""Apply style-specific formatting rules"""
		changes = []
		formatted_text = text
		
		if style == "professional":
			# Professional style: formal language, consistent punctuation
			original_text = formatted_text
			
			# Fix contractions for formal writing
			contractions = {
				"don't": "do not",
				"won't": "will not",
				"can't": "cannot",
				"isn't": "is not",
				"aren't": "are not",
				"wasn't": "was not",
				"weren't": "were not",
				"haven't": "have not",
				"hasn't": "has not",
				"hadn't": "had not"
			}
			
			for contraction, expansion in contractions.items():
				if contraction in formatted_text.lower():
					formatted_text = re.sub(contraction, expansion, formatted_text, flags=re.IGNORECASE)
					changes.append({
						"type": "style",
						"description": f"Expanded contraction: {contraction} -> {expansion}",
						"count": original_text.lower().count(contraction)
					})
		
		elif style == "academic":
			# Academic style: formal language, proper citations
			original_text = formatted_text
			
			# Ensure proper spacing around citations
			formatted_text = re.sub(r'([a-zA-Z])\(([^)]+)\)', r'\1 (\2)', formatted_text)
			if formatted_text != original_text:
				changes.append({
					"type": "style",
					"description": "Added proper spacing around citations",
					"count": len(re.findall(r'[a-zA-Z]\([^)]+\)', original_text))
				})
		
		return formatted_text, changes
	
	async def _calculate_style_compliance(self, text: str, style: str) -> float:
		"""Calculate style compliance score"""
		score = 100.0
		
		# General formatting checks
		if re.search(r' {2,}', text):  # Multiple spaces
			score -= 5
		
		if re.search(r'\n{3,}', text):  # Excessive line breaks
			score -= 5
		
		if re.search(r' +[.,;:!?]', text):  # Spaces before punctuation
			score -= 10
		
		# Style-specific checks
		if style == "professional":
			# Check for contractions
			contractions = len(re.findall(r"\b\w+'\w+\b", text))
			score -= min(contractions * 2, 20)  # Cap at 20 points
			
			# Check for informal language
			informal_words = ['gonna', 'wanna', 'kinda', 'sorta', 'lots of', 'tons of']
			for word in informal_words:
				if word in text.lower():
					score -= 5
		
		return max(0, score)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for document formatter"""
		return {
			"type": "object",
			"properties": {
				"text": {
					"type": "string",
					"description": "Document text to format"
				},
				"format_style": {
					"type": "string",
					"enum": ["professional", "academic", "technical", "creative"],
					"default": "professional",
					"description": "Formatting style to apply"
				},
				"fix_spacing": {
					"type": "boolean",
					"default": True,
					"description": "Fix spacing and whitespace issues"
				},
				"fix_typography": {
					"type": "boolean",
					"default": True,
					"description": "Fix typography and special characters"
				},
				"apply_headings": {
					"type": "boolean",
					"default": True,
					"description": "Format and standardize headings"
				}
			},
			"required": ["text"]
		}


class ReadabilityAnalyzerTool(AgentTool):
	"""
	Advanced readability and accessibility analysis tool
	
	Essential for QA teams and editors to ensure content accessibility.
	Provides comprehensive readability metrics, accessibility compliance,
	and recommendations for improving text clarity and comprehension.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="readability_analyzer",
			description="Advanced readability and accessibility analysis for content optimization",
			capabilities=[ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, text: str, target_audience: str = "general",
					 accessibility_check: bool = True, detailed_analysis: bool = True, **kwargs) -> ToolResult:
		"""Execute readability analysis"""
		
		try:
			analysis_results = {
				"text_length": len(text),
				"target_audience": target_audience,
				"readability_metrics": {},
				"accessibility_issues": [],
				"recommendations": [],
				"overall_score": 0.0
			}
			
			# Calculate comprehensive readability metrics
			readability_metrics = await self._calculate_comprehensive_readability(text)
			analysis_results["readability_metrics"] = readability_metrics
			
			# Check accessibility if requested
			if accessibility_check:
				accessibility_issues = await self._check_accessibility_compliance(text)
				analysis_results["accessibility_issues"] = accessibility_issues
			
			# Generate detailed analysis and recommendations
			if detailed_analysis:
				recommendations = await self._generate_improvement_recommendations(
					text, readability_metrics, target_audience
				)
				analysis_results["recommendations"] = recommendations
			
			# Calculate overall readability score
			overall_score = await self._calculate_overall_readability_score(
				readability_metrics, target_audience
			)
			analysis_results["overall_score"] = overall_score
			
			# Audience suitability assessment
			suitability = await self._assess_audience_suitability(readability_metrics, target_audience)
			analysis_results["audience_suitability"] = suitability
			
			return ToolResult(
				success=True,
				data=analysis_results,
				tool_name=self.name,
				metadata={
					"target_audience": target_audience,
					"accessibility_check": accessibility_check,
					"detailed_analysis": detailed_analysis
				}
			)
			
		except Exception as e:
			raise ToolError(f"Readability analysis failed: {str(e)}", self.name, "READABILITY_ERROR")
	
	async def _calculate_comprehensive_readability(self, text: str) -> Dict[str, Any]:
		"""Calculate comprehensive readability metrics"""
		words = text.split()
		sentences = re.split(r'[.!?]+', text)
		sentences = [s for s in sentences if s.strip()]
		paragraphs = [p for p in text.split('\n\n') if p.strip()]
		
		if not words or not sentences:
			return {"error": "Insufficient text for analysis"}
		
		word_count = len(words)
		sentence_count = len(sentences)
		paragraph_count = len(paragraphs)
		
		# Basic metrics
		avg_sentence_length = word_count / sentence_count
		avg_paragraph_length = sentence_count / paragraph_count if paragraph_count > 0 else 0
		
		# Syllable counting (simplified)
		total_syllables = 0
		complex_words = 0  # Words with 3+ syllables
		
		for word in words:
			clean_word = re.sub(r'[^a-zA-Z]', '', word.lower())
			if clean_word:
				syllables = max(1, len(re.findall(r'[aeiouAEIOU]', clean_word)))
				total_syllables += syllables
				if syllables >= 3:
					complex_words += 1
		
		avg_syllables_per_word = total_syllables / word_count
		complex_word_ratio = complex_words / word_count
		
		# Flesch Reading Ease Score
		flesch_score = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
		flesch_score = max(0, min(100, flesch_score))
		
		# Flesch-Kincaid Grade Level
		fk_grade_level = 0.39 * avg_sentence_length + 11.8 * avg_syllables_per_word - 15.59
		fk_grade_level = max(1, fk_grade_level)
		
		# SMOG Index (for complex text)
		smog_index = 1.043 * ((30 * complex_words / sentence_count) ** 0.5) + 3.1291
		smog_index = max(1, smog_index)
		
		# Gunning Fog Index
		gunning_fog = 0.4 * (avg_sentence_length + 100 * complex_word_ratio)
		
		# Coleman-Liau Index
		char_count = sum(len(re.sub(r'[^a-zA-Z]', '', word)) for word in words)
		avg_chars_per_100_words = (char_count / word_count) * 100
		avg_sentences_per_100_words = (sentence_count / word_count) * 100
		cli_index = 0.0588 * avg_chars_per_100_words - 0.296 * avg_sentences_per_100_words - 15.8
		
		return {
			"word_count": word_count,
			"sentence_count": sentence_count,
			"paragraph_count": paragraph_count,
			"avg_sentence_length": round(avg_sentence_length, 1),
			"avg_paragraph_length": round(avg_paragraph_length, 1),
			"avg_syllables_per_word": round(avg_syllables_per_word, 2),
			"complex_word_count": complex_words,
			"complex_word_ratio": round(complex_word_ratio, 3),
			"flesch_reading_ease": round(flesch_score, 1),
			"flesch_kincaid_grade": round(fk_grade_level, 1),
			"smog_index": round(smog_index, 1),
			"gunning_fog_index": round(gunning_fog, 1),
			"coleman_liau_index": round(cli_index, 1),
			"reading_level": self._interpret_flesch_score(flesch_score)
		}
	
	def _interpret_flesch_score(self, score: float) -> str:
		"""Interpret Flesch reading ease score"""
		if score >= 90:
			return "Very Easy (5th grade)"
		elif score >= 80:
			return "Easy (6th grade)"
		elif score >= 70:
			return "Fairly Easy (7th grade)"
		elif score >= 60:
			return "Standard (8th-9th grade)"
		elif score >= 50:
			return "Fairly Difficult (10th-12th grade)"
		elif score >= 30:
			return "Difficult (college level)"
		else:
			return "Very Difficult (graduate level)"
	
	async def _check_accessibility_compliance(self, text: str) -> List[Dict[str, Any]]:
		"""Check text for accessibility compliance issues"""
		issues = []
		
		# Check for all caps (accessibility issue)
		all_caps_matches = re.findall(r'\b[A-Z]{4,}\b', text)
		if all_caps_matches:
			issues.append({
				"type": "accessibility",
				"issue": "excessive_caps",
				"description": f"Found {len(all_caps_matches)} instances of ALL CAPS text (screen reader accessibility issue)",
				"severity": "medium",
				"examples": all_caps_matches[:3]
			})
		
		# Check for very long sentences (readability/accessibility issue)
		sentences = re.split(r'[.!?]+', text)
		long_sentences = [s for s in sentences if len(s.split()) > 40]
		if long_sentences:
			issues.append({
				"type": "accessibility",
				"issue": "long_sentences",
				"description": f"Found {len(long_sentences)} sentences with 40+ words (readability issue)",
				"severity": "high",
				"max_length": max(len(s.split()) for s in long_sentences)
			})
		
		# Check for complex jargon/technical terms
		complex_patterns = [
			r'\b\w{12,}\b',  # Very long words
			r'\b[A-Z]{3,}\b(?![a-z])',  # Acronyms without explanation
		]
		
		complex_terms = set()
		for pattern in complex_patterns:
			matches = re.findall(pattern, text)
			complex_terms.update(matches)
		
		if complex_terms:
			issues.append({
				"type": "accessibility",
				"issue": "complex_terms",
				"description": f"Found {len(complex_terms)} potentially complex terms or unexplained acronyms",
				"severity": "low",
				"examples": list(complex_terms)[:5]
			})
		
		# Check for lack of paragraph structure
		paragraphs = [p for p in text.split('\n\n') if p.strip()]
		if len(paragraphs) < 3 and len(text.split()) > 200:
			issues.append({
				"type": "accessibility",
				"issue": "poor_structure",
				"description": "Text lacks paragraph breaks, making it difficult to scan and read",
				"severity": "medium",
				"word_count": len(text.split())
			})
		
		return issues
	
	async def _generate_improvement_recommendations(self, text: str, metrics: Dict[str, Any], target_audience: str) -> List[Dict[str, Any]]:
		"""Generate recommendations for improving readability"""
		recommendations = []
		
		# Sentence length recommendations
		if metrics.get("avg_sentence_length", 0) > 25:
			recommendations.append({
				"category": "sentence_structure",
				"priority": "high",
				"issue": "Long sentences reduce readability",
				"recommendation": f"Average sentence length is {metrics['avg_sentence_length']} words. Consider breaking sentences into shorter segments (aim for 15-20 words).",
				"impact": "Improves comprehension and accessibility"
			})
		
		# Complex word recommendations
		if metrics.get("complex_word_ratio", 0) > 0.15:  # More than 15% complex words
			recommendations.append({
				"category": "vocabulary",
				"priority": "medium",
				"issue": "High concentration of complex words",
				"recommendation": f"Text contains {metrics['complex_word_count']} complex words ({metrics['complex_word_ratio']:.1%}). Consider simpler alternatives where possible.",
				"impact": "Makes content more accessible to broader audience"
			})
		
		# Grade level recommendations based on target audience
		target_grades = {
			"general": 8,
			"business": 10,
			"academic": 14,
			"technical": 12,
			"marketing": 6
		}
		
		target_grade = target_grades.get(target_audience, 8)
		current_grade = metrics.get("flesch_kincaid_grade", 0)
		
		if current_grade > target_grade + 2:
			recommendations.append({
				"category": "grade_level",
				"priority": "high",
				"issue": f"Content too complex for {target_audience} audience",
				"recommendation": f"Current grade level is {current_grade:.1f}, but {target_audience} content should target grade {target_grade}. Simplify language and sentence structure.",
				"impact": "Better matches audience expectations and comprehension level"
			})
		
		# Paragraph structure recommendations
		if metrics.get("avg_paragraph_length", 0) > 8:
			recommendations.append({
				"category": "structure",
				"priority": "medium",
				"issue": "Long paragraphs reduce readability",
				"recommendation": f"Average paragraph length is {metrics['avg_paragraph_length']:.1f} sentences. Break into shorter paragraphs (3-5 sentences each).",
				"impact": "Improves visual scanning and comprehension"
			})
		
		return recommendations
	
	async def _calculate_overall_readability_score(self, metrics: Dict[str, Any], target_audience: str) -> float:
		"""Calculate overall readability score (0-100)"""
		score = 100.0
		
		# Adjust based on Flesch score and target audience
		flesch_score = metrics.get("flesch_reading_ease", 50)
		
		if target_audience == "general":
			# General audience: aim for 60-80 Flesch score
			if flesch_score < 50:
				score -= (50 - flesch_score) * 0.8
			elif flesch_score > 90:
				score -= (flesch_score - 90) * 0.3
			
		elif target_audience == "academic":
			# Academic: can handle lower Flesch scores
			if flesch_score < 30:
				score -= (30 - flesch_score) * 0.5
			
		# Adjust for sentence length
		avg_sentence_length = metrics.get("avg_sentence_length", 15)
		if avg_sentence_length > 25:
			score -= (avg_sentence_length - 25) * 2
		
		# Adjust for complex words
		complex_ratio = metrics.get("complex_word_ratio", 0)
		if complex_ratio > 0.2:
			score -= (complex_ratio - 0.2) * 100
		
		return max(0, min(100, score))
	
	async def _assess_audience_suitability(self, metrics: Dict[str, Any], target_audience: str) -> Dict[str, Any]:
		"""Assess how well the content suits the target audience"""
		grade_level = metrics.get("flesch_kincaid_grade", 0)
		reading_ease = metrics.get("flesch_reading_ease", 50)
		
		audience_profiles = {
			"general": {"ideal_grade": 8, "min_ease": 60, "max_ease": 80},
			"business": {"ideal_grade": 10, "min_ease": 50, "max_ease": 70},
			"academic": {"ideal_grade": 14, "min_ease": 30, "max_ease": 60},
			"technical": {"ideal_grade": 12, "min_ease": 40, "max_ease": 65},
			"marketing": {"ideal_grade": 6, "min_ease": 70, "max_ease": 85}
		}
		
		profile = audience_profiles.get(target_audience, audience_profiles["general"])
		
		# Calculate suitability score
		grade_diff = abs(grade_level - profile["ideal_grade"])
		grade_score = max(0, 100 - (grade_diff * 10))
		
		ease_in_range = profile["min_ease"] <= reading_ease <= profile["max_ease"]
		ease_score = 100 if ease_in_range else max(0, 50 - abs(reading_ease - ((profile["min_ease"] + profile["max_ease"]) / 2)))
		
		overall_suitability = (grade_score + ease_score) / 2
		
		if overall_suitability >= 80:
			assessment = "Excellent match"
		elif overall_suitability >= 60:
			assessment = "Good match"
		elif overall_suitability >= 40:
			assessment = "Fair match - some adjustments recommended"
		else:
			assessment = "Poor match - significant adjustments needed"
		
		return {
			"suitability_score": round(overall_suitability, 1),
			"assessment": assessment,
			"target_grade_level": profile["ideal_grade"],
			"current_grade_level": round(grade_level, 1),
			"target_ease_range": f"{profile['min_ease']}-{profile['max_ease']}",
			"current_ease_score": round(reading_ease, 1)
		}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for readability analyzer"""
		return {
			"type": "object",
			"properties": {
				"text": {
					"type": "string",
					"description": "Text content to analyze for readability"
				},
				"target_audience": {
					"type": "string",
					"enum": ["general", "business", "academic", "technical", "marketing"],
					"default": "general",
					"description": "Target audience for content optimization"
				},
				"accessibility_check": {
					"type": "boolean",
					"default": True,
					"description": "Perform accessibility compliance analysis"
				},
				"detailed_analysis": {
					"type": "boolean",
					"default": True,
					"description": "Generate detailed improvement recommendations"
				}
			},
			"required": ["text"]
		}


class FactCheckerTool(AgentTool):
	"""
	Fact verification and source validation tool
	
	Essential for journalists, researchers, and QA teams to verify claims and sources.
	Analyzes statements for factual accuracy indicators, identifies claims that need verification,
	and validates source credibility.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="fact_checker",
			description="Fact verification and source validation for content accuracy",
			capabilities=[ToolCapability.DATA_PROCESSING, ToolCapability.WEB_SEARCH],
			config=config
		)
	
	async def execute(self, text: str, check_sources: bool = True,
					 verify_statistics: bool = True, check_dates: bool = True, **kwargs) -> ToolResult:
		"""Execute fact checking analysis"""
		
		try:
			verification_results = {
				"text_length": len(text),
				"claims_identified": [],
				"sources_found": [],
				"verification_flags": [],
				"credibility_score": 0.0,
				"needs_verification": []
			}
			
			# Identify factual claims
			claims = await self._identify_factual_claims(text)
			verification_results["claims_identified"] = claims
			
			# Extract and validate sources if requested
			if check_sources:
				sources = await self._extract_and_validate_sources(text)
				verification_results["sources_found"] = sources
			
			# Verify statistics and numbers if requested
			if verify_statistics:
				stat_flags = await self._verify_statistics_and_numbers(text)
				verification_results["verification_flags"].extend(stat_flags)
			
			# Check dates and temporal references if requested
			if check_dates:
				date_flags = await self._check_dates_and_timeline(text)
				verification_results["verification_flags"].extend(date_flags)
			
			# Assess overall credibility
			credibility_score = await self._calculate_credibility_score(verification_results)
			verification_results["credibility_score"] = credibility_score
			
			# Generate verification recommendations
			needs_verification = await self._generate_verification_recommendations(verification_results)
			verification_results["needs_verification"] = needs_verification
			
			return ToolResult(
				success=True,
				data=verification_results,
				tool_name=self.name,
				metadata={
					"check_sources": check_sources,
					"verify_statistics": verify_statistics,
					"check_dates": check_dates
				}
			)
			
		except Exception as e:
			raise ToolError(f"Fact checking failed: {str(e)}", self.name, "FACT_CHECK_ERROR")
	
	async def _identify_factual_claims(self, text: str) -> List[Dict[str, Any]]:
		"""Identify statements that make factual claims"""
		claims = []
		
		# Patterns that often indicate factual claims
		claim_patterns = [
			(r'\b\d+(?:\.\d+)?\s*(?:percent|%|million|billion|thousand)\b', "statistical_claim"),
			(r'\b(?:according to|studies show|research indicates|data reveals)\b', "research_claim"),
			(r'\b(?:in \d{4}|since \d{4}|by \d{4})\b', "temporal_claim"),
			(r'\b(?:always|never|all|none|every|no one)\b', "absolute_claim"),
			(r'\b(?:increase|decrease|rise|fall|grow|decline)\s+(?:by|of)\s+\d+', "trend_claim"),
			(r'\b(?:ranked|rated|listed)\s+(?:#\d+|first|second|top|best|worst)\b', "ranking_claim")
		]
		
		sentences = re.split(r'[.!?]+', text)
		
		for i, sentence in enumerate(sentences):
			if len(sentence.strip()) < 10:
				continue
				
			for pattern, claim_type in claim_patterns:
				matches = list(re.finditer(pattern, sentence, re.IGNORECASE))
				if matches:
					claims.append({
						"sentence": sentence.strip(),
						"claim_type": claim_type,
						"position": i,
						"matches": [match.group() for match in matches],
						"confidence": self._assess_claim_confidence(sentence, claim_type)
					})
		
		return claims[:20]  # Limit to 20 claims
	
	def _assess_claim_confidence(self, sentence: str, claim_type: str) -> str:
		"""Assess confidence level of a factual claim"""
		# Look for hedging words that indicate uncertainty
		hedging_words = ['might', 'could', 'may', 'possibly', 'likely', 'probably', 'seems', 'appears']
		strength_words = ['definitely', 'certainly', 'proves', 'demonstrates', 'confirms']
		
		sentence_lower = sentence.lower()
		
		if any(word in sentence_lower for word in strength_words):
			return "high"
		elif any(word in sentence_lower for word in hedging_words):
			return "low"
		else:
			return "medium"
	
	async def _extract_and_validate_sources(self, text: str) -> List[Dict[str, Any]]:
		"""Extract and validate sources mentioned in the text"""
		sources = []
		
		# Find URLs
		url_pattern = r'https?://[^\s]+'
		urls = re.findall(url_pattern, text)
		
		for url in urls:
			sources.append({
				"type": "url",
				"source": url,
				"domain": self._extract_domain(url),
				"credibility": self._assess_domain_credibility(url),
				"accessible": True  # Would need actual validation
			})
		
		# Find publication references
		pub_patterns = [
			r'\b(?:The |New York |Washington )?(?:Times|Post|Journal|Review|Magazine|Report)\b',
			r'\b(?:Nature|Science|PNAS|Cell|Lancet)\b',
			r'\b(?:Harvard|MIT|Stanford|Oxford|Cambridge)\b.*(?:study|research|report)'
		]
		
		for pattern in pub_patterns:
			matches = re.findall(pattern, text, re.IGNORECASE)
			for match in matches:
				sources.append({
					"type": "publication",
					"source": match,
					"credibility": self._assess_publication_credibility(match),
					"needs_citation": True
				})
		
		return sources[:15]  # Limit to 15 sources
	
	def _extract_domain(self, url: str) -> str:
		"""Extract domain from URL"""
		try:
			parsed = urlparse(url)
			return parsed.netloc.lower()
		except:
			return "unknown"
	
	def _assess_domain_credibility(self, url: str) -> str:
		"""Assess credibility of a domain"""
		domain = self._extract_domain(url)
		
		# High credibility domains
		high_credibility = [
			'nytimes.com', 'washingtonpost.com', 'wsj.com', 'reuters.com', 'bbc.com',
			'nature.com', 'science.org', 'pubmed.ncbi.nlm.nih.gov', 'arxiv.org',
			'harvard.edu', 'mit.edu', 'stanford.edu', 'oxford.ac.uk', 'cambridge.ac.uk'
		]
		
		# Medium credibility indicators
		medium_indicators = ['.edu', '.gov', '.org']
		
		# Low credibility indicators  
		low_indicators = ['blog', 'personal', 'wiki', '.tk', '.ml']
		
		if any(hc in domain for hc in high_credibility):
			return "high"
		elif any(domain.endswith(mi) for mi in medium_indicators):
			return "medium"
		elif any(li in domain for li in low_indicators):
			return "low"
		else:
			return "unknown"
	
	def _assess_publication_credibility(self, pub_name: str) -> str:
		"""Assess credibility of a publication"""
		pub_lower = pub_name.lower()
		
		high_credibility_pubs = ['nature', 'science', 'new york times', 'wall street journal', 'harvard', 'mit', 'stanford']
		
		if any(pub in pub_lower for pub in high_credibility_pubs):
			return "high"
		else:
			return "medium"
	
	async def _verify_statistics_and_numbers(self, text: str) -> List[Dict[str, Any]]:
		"""Check statistics and numerical claims for potential issues"""
		flags = []
		
		# Find percentage claims
		percentage_pattern = r'\b(\d+(?:\.\d+)?)\s*(?:percent|%)'
		percentages = re.findall(percentage_pattern, text, re.IGNORECASE)
		
		for pct in percentages:
			pct_val = float(pct)
			if pct_val > 100:
				flags.append({
					"type": "statistical_error",
					"issue": f"Percentage over 100%: {pct}%",
					"severity": "high",
					"recommendation": "Verify this percentage - values over 100% are unusual"
				})
		
		# Find suspiciously precise statistics
		precise_pattern = r'\b(\d{2,}\.\d{2,})\s*(?:percent|%|million|billion)'
		precise_stats = re.findall(precise_pattern, text, re.IGNORECASE)
		
		if len(precise_stats) > 3:
			flags.append({
				"type": "precision_warning",
				"issue": f"Many highly precise statistics found: {len(precise_stats)}",
				"severity": "medium",
				"recommendation": "Verify if such precision is warranted - rounded numbers are often more appropriate"
			})
		
		# Look for conflicting numbers
		numbers = re.findall(r'\b(\d+(?:,\d{3})*(?:\.\d+)?)\b', text)
		number_values = []
		for num_str in numbers:
			try:
				value = float(num_str.replace(',', ''))
				number_values.append(value)
			except:
				continue
		
		# Check for suspiciously round numbers
		round_numbers = [n for n in number_values if n >= 100 and n % 100 == 0]
		if len(round_numbers) > 5:
			flags.append({
				"type": "rounding_pattern",
				"issue": f"Many round numbers found: {len(round_numbers)}",
				"severity": "low",
				"recommendation": "Consider if such consistent rounding indicates estimates rather than precise measurements"
			})
		
		return flags
	
	async def _check_dates_and_timeline(self, text: str) -> List[Dict[str, Any]]:
		"""Check dates and timeline references for consistency"""
		flags = []
		
		# Find year references
		year_pattern = r'\b(19|20)\d{2}\b'
		years = [int(year) for year in re.findall(year_pattern, text)]
		
		if years:
			current_year = datetime.now().year
			future_years = [year for year in years if year > current_year]
			
			if future_years:
				flags.append({
					"type": "future_date",
					"issue": f"Future years mentioned: {future_years}",
					"severity": "medium",
					"recommendation": "Verify if future dates are intentional (predictions) or errors"
				})
			
			# Check for very old years in contemporary context
			old_years = [year for year in years if year < 1990 and 'history' not in text.lower()]
			if old_years and len(old_years) < len(years) / 2:  # Mixed old and recent years
				flags.append({
					"type": "temporal_inconsistency",
					"issue": f"Mix of very old dates {old_years} with recent dates",
					"severity": "low",
					"recommendation": "Ensure temporal references are contextually appropriate"
				})
		
		return flags
	
	async def _calculate_credibility_score(self, results: Dict[str, Any]) -> float:
		"""Calculate overall credibility score"""
		score = 100.0
		
		# Deduct for verification flags
		for flag in results["verification_flags"]:
			if flag["severity"] == "high":
				score -= 15
			elif flag["severity"] == "medium":
				score -= 8
			else:
				score -= 3
		
		# Adjust based on source credibility
		high_cred_sources = len([s for s in results["sources_found"] if s.get("credibility") == "high"])
		low_cred_sources = len([s for s in results["sources_found"] if s.get("credibility") == "low"])
		
		score += min(high_cred_sources * 5, 20)  # Bonus for high credibility sources
		score -= low_cred_sources * 10  # Penalty for low credibility sources
		
		# Adjust based on claim types
		absolute_claims = len([c for c in results["claims_identified"] if c["claim_type"] == "absolute_claim"])
		score -= min(absolute_claims * 5, 25)  # Penalty for absolute claims
		
		return max(0, min(100, score))
	
	async def _generate_verification_recommendations(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
		"""Generate recommendations for fact verification"""
		recommendations = []
		
		# High-confidence claims that need verification
		high_conf_claims = [c for c in results["claims_identified"] 
					   if c["confidence"] == "high" and c["claim_type"] in ["statistical_claim", "research_claim"]]
		
		for claim in high_conf_claims[:5]:  # Top 5
			recommendations.append({
				"type": "verify_claim",
				"priority": "high",
				"claim": claim["sentence"],
				"reason": f"High-confidence {claim['claim_type']} needs source verification",
				"suggested_action": "Find primary source or authoritative reference"
			})
		
		# Sources that need better attribution
		poor_sources = [s for s in results["sources_found"] if s.get("credibility") == "low"]
		for source in poor_sources[:3]:  # Top 3
			recommendations.append({
				"type": "improve_source",
				"priority": "medium",
				"source": source["source"],
				"reason": "Low credibility source",
				"suggested_action": "Replace with more authoritative source or add corroborating evidence"
			})
		
		return recommendations
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for fact checker"""
		return {
			"type": "object",
			"properties": {
				"text": {
					"type": "string",
					"description": "Text content to fact-check"
				},
				"check_sources": {
					"type": "boolean",
					"default": True,
					"description": "Validate sources and references"
				},
				"verify_statistics": {
					"type": "boolean",
					"default": True,
					"description": "Check statistical claims and numbers"
				},
				"check_dates": {
					"type": "boolean",
					"default": True,
					"description": "Verify dates and timeline consistency"
				}
			},
			"required": ["text"]
		}


class MetadataExtractorTool(AgentTool):
	"""
	Document metadata extraction and management tool
	
	Critical for publishers, packagers, and archivists to extract and manage document metadata.
	Extracts key information like titles, authors, keywords, dates, and technical specifications
	from various document formats and content types.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="metadata_extractor",
			description="Document metadata extraction and management for publishing workflows",
			capabilities=[ToolCapability.DATA_PROCESSING, ToolCapability.FILE_OPERATIONS],
			config=config
		)
	
	async def execute(self, content: str, content_type: str = "text", 
					 extract_keywords: bool = True, analyze_structure: bool = True, **kwargs) -> ToolResult:
		"""Execute metadata extraction"""
		
		try:
			metadata_results = {
				"content_type": content_type,
				"content_length": len(content),
				"basic_metadata": {},
				"structural_metadata": {},
				"content_metadata": {},
				"technical_metadata": {}
			}
			
			# Extract basic metadata
			basic_metadata = await self._extract_basic_metadata(content)
			metadata_results["basic_metadata"] = basic_metadata
			
			# Analyze document structure if requested
			if analyze_structure:
				structural_metadata = await self._analyze_document_structure(content)
				metadata_results["structural_metadata"] = structural_metadata
			
			# Extract content metadata
			content_metadata = await self._extract_content_metadata(content, extract_keywords)
			metadata_results["content_metadata"] = content_metadata
			
			# Generate technical metadata
			technical_metadata = await self._generate_technical_metadata(content, content_type)
			metadata_results["technical_metadata"] = technical_metadata
			
			# Create standardized metadata record
			standardized_record = await self._create_standardized_metadata_record(metadata_results)
			metadata_results["standardized_record"] = standardized_record
			
			return ToolResult(
				success=True,
				data=metadata_results,
				tool_name=self.name,
				metadata={
					"content_type": content_type,
					"extract_keywords": extract_keywords,
					"analyze_structure": analyze_structure
				}
			)
			
		except Exception as e:
			raise ToolError(f"Metadata extraction failed: {str(e)}", self.name, "METADATA_ERROR")
	
	async def _extract_basic_metadata(self, content: str) -> Dict[str, Any]:
		"""Extract basic document metadata"""
		basic_info = {
			"creation_date": datetime.now().isoformat(),
			"word_count": len(content.split()),
			"character_count": len(content),
			"line_count": len(content.splitlines()),
			"paragraph_count": len([p for p in content.split('\n\n') if p.strip()])
		}
		
		# Extract title (first line if it looks like a title)
		lines = [line.strip() for line in content.splitlines() if line.strip()]
		if lines:
			first_line = lines[0]
			if (len(first_line) < 100 and 
				not first_line.endswith('.') and 
				len(first_line.split()) > 2):
				basic_info["title"] = first_line
		
		# Extract author information (look for "by", "author:", etc.)
		author_patterns = [
			r'(?:by|author[s]?[:.]?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
			r'(?:written by|authored by)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
		]
		
		for pattern in author_patterns:
			match = re.search(pattern, content, re.IGNORECASE)
			if match:
				basic_info["author"] = match.group(1)
				break
		
		# Extract dates
		date_patterns = [
			r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b',
			r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b',
			r'\b(\d{4})-(\d{2})-(\d{2})\b'
		]
		
		dates_found = []
		for pattern in date_patterns:
			matches = re.findall(pattern, content)
			dates_found.extend([' '.join(match) if isinstance(match, tuple) else match for match in matches])
		
		if dates_found:
			basic_info["dates_referenced"] = dates_found[:5]  # Limit to 5 dates
		
		return basic_info
	
	async def _analyze_document_structure(self, content: str) -> Dict[str, Any]:
		"""Analyze document structure and organization"""
		structure_info = {}
		
		# Identify heading structure
		lines = content.splitlines()
		headings = []
		
		for i, line in enumerate(lines):
			line = line.strip()
			if (len(line) > 3 and len(line) < 80 and 
				not line.endswith('.') and 
				line[0].isupper() and
				i < len(lines) - 1 and 
				lines[i + 1].strip()):
				
				# Determine heading level based on formatting
				level = 1
				if line.isupper():
					level = 1
				elif re.match(r'^\d+\.', line):
					level = 2
				elif re.match(r'^[a-zA-Z]\)', line):
					level = 3
				
				headings.append({
					"text": line,
					"level": level,
					"line_number": i + 1
				})
		
		structure_info["headings"] = headings[:20]  # Limit to 20 headings
		structure_info["heading_count"] = len(headings)
		
		# Identify lists and numbered items
		lists = []
		list_patterns = [
			r'^\s*[-*•]\s+(.+)$',  # Bullet lists
			r'^\s*(\d+[\.\)])\s+(.+)$',  # Numbered lists
			r'^\s*([a-zA-Z][\.\)])\s+(.+)$'  # Lettered lists
		]
		
		for line in lines:
			for pattern in list_patterns:
				match = re.match(pattern, line)
				if match:
					lists.append(line.strip())
					break
		
		structure_info["list_items"] = len(lists)
		structure_info["has_structured_content"] = len(headings) > 0 or len(lists) > 5
		
		return structure_info
	
	async def _extract_content_metadata(self, content: str, extract_keywords: bool) -> Dict[str, Any]:
		"""Extract content-specific metadata"""
		content_info = {}
		
		# Extract keywords if requested
		if extract_keywords:
			keywords = await self._extract_keywords(content)
			content_info["keywords"] = keywords
		
		# Identify content themes
		themes = await self._identify_content_themes(content)
		content_info["themes"] = themes
		
		# Extract entities (names, organizations, locations)
		entities = await self._extract_named_entities(content)
		content_info["entities"] = entities
		
		# Analyze sentiment and tone
		tone_analysis = await self._analyze_tone(content)
		content_info["tone_analysis"] = tone_analysis
		
		return content_info
	
	async def _extract_keywords(self, content: str) -> List[str]:
		"""Extract key terms and phrases"""
		# Simple keyword extraction based on frequency and length
		words = re.findall(r'\b[a-zA-Z]{4,}\b', content.lower())
		
		# Remove common words
		common_words = {
			'that', 'this', 'with', 'have', 'will', 'been', 'their', 'said', 'each', 'which',
			'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also',
			'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now',
			'made', 'before', 'here', 'through', 'when', 'where', 'much', 'some', 'these',
			'many', 'then', 'them', 'well', 'were'
		}
		
		filtered_words = [word for word in words if word not in common_words]
		
		# Count frequency
		word_freq = {}
		for word in filtered_words:
			word_freq[word] = word_freq.get(word, 0) + 1
		
		# Sort by frequency and return top keywords
		sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
		return [word for word, freq in sorted_words[:20] if freq > 1]
	
	async def _identify_content_themes(self, content: str) -> List[str]:
		"""Identify main themes in the content"""
		themes = []
		
		# Define theme keywords
		theme_keywords = {
			'business': ['business', 'company', 'market', 'revenue', 'profit', 'strategy', 'management'],
			'technology': ['technology', 'software', 'digital', 'artificial', 'intelligence', 'data', 'system'],
			'research': ['study', 'research', 'analysis', 'findings', 'methodology', 'results', 'evidence'],
			'education': ['education', 'learning', 'student', 'teacher', 'curriculum', 'academic', 'university'],
			'health': ['health', 'medical', 'patient', 'treatment', 'disease', 'clinical', 'healthcare'],
			'finance': ['financial', 'money', 'investment', 'banking', 'economic', 'funding', 'budget']
		}
		
		content_lower = content.lower()
		
		for theme, keywords in theme_keywords.items():
			matches = sum(1 for keyword in keywords if keyword in content_lower)
			if matches >= 3:  # Threshold for theme identification
				themes.append({
					'theme': theme,
					'relevance_score': matches / len(keywords),
					'matched_keywords': [kw for kw in keywords if kw in content_lower]
				})
		
		return sorted(themes, key=lambda x: x['relevance_score'], reverse=True)
	
	async def _extract_named_entities(self, content: str) -> Dict[str, List[str]]:
		"""Extract named entities (simplified)"""
		entities = {
			'persons': [],
			'organizations': [],
			'locations': []
		}
		
		# Simple pattern-based entity extraction
		# Person names (capitalized words that follow certain patterns)
		person_pattern = r'\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b'
		persons = re.findall(person_pattern, content)
		entities['persons'] = list(set(persons))[:10]  # Unique persons, limit to 10
		
		# Organizations (words ending in common org suffixes)
		org_pattern = r'\b([A-Z][a-zA-Z\s]+(?:Inc|Corp|Ltd|LLC|Company|Corporation|Organization|Institute|University))\b'
		orgs = re.findall(org_pattern, content)
		entities['organizations'] = list(set(orgs))[:10]
		
		# Locations (capitalized words that might be places)
		location_indicators = ['City', 'State', 'Country', 'County', 'Province', 'District']
		location_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:' + '|'.join(location_indicators) + ')))\b'
		locations = re.findall(location_pattern, content)
		entities['locations'] = list(set(locations))[:10]
		
		return entities
	
	async def _analyze_tone(self, content: str) -> Dict[str, Any]:
		"""Analyze content tone and sentiment"""
		tone_analysis = {
			'sentiment': 'neutral',
			'confidence': 0.5,
			'tone_indicators': []
		}
		
		# Simple sentiment analysis based on word patterns
		positive_words = ['excellent', 'outstanding', 'successful', 'effective', 'beneficial', 'positive', 'good', 'great', 'amazing', 'wonderful']
		negative_words = ['terrible', 'awful', 'failed', 'problematic', 'negative', 'bad', 'poor', 'disappointing', 'concerning', 'alarming']
		
		content_lower = content.lower()
		positive_count = sum(1 for word in positive_words if word in content_lower)
		negative_count = sum(1 for word in negative_words if word in content_lower)
		
		if positive_count > negative_count + 2:
			tone_analysis['sentiment'] = 'positive'
			tone_analysis['confidence'] = min(0.8, 0.5 + (positive_count - negative_count) * 0.1)
		elif negative_count > positive_count + 2:
			tone_analysis['sentiment'] = 'negative'
			tone_analysis['confidence'] = min(0.8, 0.5 + (negative_count - positive_count) * 0.1)
		
		# Identify tone characteristics
		tone_patterns = {
			'formal': len(re.findall(r'\b(?:furthermore|moreover|consequently|therefore)\b', content_lower)),
			'casual': len(re.findall(r'\b(?:gonna|wanna|kinda|really|pretty)\b', content_lower)),
			'technical': len(re.findall(r'\b(?:algorithm|methodology|implementation|specification)\b', content_lower)),
			'persuasive': len(re.findall(r'\b(?:should|must|need to|important to|crucial)\b', content_lower))
		}
		
		tone_indicators = [tone for tone, count in tone_patterns.items() if count > 2]
		tone_analysis['tone_indicators'] = tone_indicators
		
		return tone_analysis
	
	async def _generate_technical_metadata(self, content: str, content_type: str) -> Dict[str, Any]:
		"""Generate technical metadata"""
		technical_info = {
			'content_type': content_type,
			'encoding': 'utf-8',  # Assuming UTF-8
			'hash': hashlib.md5(content.encode()).hexdigest(),
			'size_bytes': len(content.encode('utf-8')),
			'language': 'en',  # Simple language detection could be added
			'readability_score': 0
		}
		
		# Simple readability calculation (Flesch score)
		words = content.split()
		sentences = re.split(r'[.!?]+', content)
		sentences = [s for s in sentences if s.strip()]
		
		if words and sentences:
			avg_sentence_length = len(words) / len(sentences)
			# Simplified syllable count
			syllables = sum(max(1, len(re.findall(r'[aeiouAEIOU]', word))) for word in words)
			avg_syllables = syllables / len(words)
			
			flesch_score = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables)
			technical_info['readability_score'] = max(0, min(100, flesch_score))
		
		return technical_info
	
	async def _create_standardized_metadata_record(self, metadata_results: Dict[str, Any]) -> Dict[str, Any]:
		"""Create standardized metadata record (Dublin Core-like)"""
		basic = metadata_results.get('basic_metadata', {})
		content = metadata_results.get('content_metadata', {})
		technical = metadata_results.get('technical_metadata', {})
		
		record = {
			'title': basic.get('title', 'Untitled Document'),
			'creator': basic.get('author', 'Unknown'),
			'subject': [kw for kw in content.get('keywords', [])[:10]],
			'description': f"Document with {basic.get('word_count', 0)} words and {basic.get('paragraph_count', 0)} paragraphs",
			'publisher': 'Agent Publishing System',
			'date': basic.get('creation_date', datetime.now().isoformat()),
			'type': metadata_results.get('content_type', 'text'),
			'format': technical.get('content_type', 'text/plain'),
			'identifier': technical.get('hash', ''),
			'language': technical.get('language', 'en'),
			'coverage': '',  # Could be populated with location entities
			'rights': 'All rights reserved'
		}
		
		# Add themes as subjects
		themes = content.get('themes', [])
		if themes:
			record['subject'].extend([theme['theme'] for theme in themes[:5]])
		
		return record
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for metadata extractor"""
		return {
			"type": "object",
			"properties": {
				"content": {
					"type": "string",
					"description": "Document content to extract metadata from"
				},
				"content_type": {
					"type": "string",
					"enum": ["text", "html", "markdown", "xml", "json"],
					"default": "text",
					"description": "Type of content being processed"
				},
				"extract_keywords": {
					"type": "boolean",
					"default": True,
					"description": "Extract keywords and key phrases"
				},
				"analyze_structure": {
					"type": "boolean",
					"default": True,
					"description": "Analyze document structure and organization"
				}
			},
			"required": ["content"]
		}


class ReportGeneratorTool(AgentTool):
	"""
	Comprehensive report compilation and formatting tool
	
	Essential for report writers, analysts, and publishers to compile comprehensive reports.
	Automatically formats content, generates table of contents, adds executive summaries,
	and creates professional report layouts from multiple content sources.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="report_generator",
			description="Comprehensive report compilation and professional formatting tool",
			capabilities=[ToolCapability.DATA_PROCESSING, ToolCapability.FILE_OPERATIONS],
			config=config
		)
	
	async def execute(self, content_sections: List[Dict[str, Any]], report_title: str,
					 generate_toc: bool = True, add_executive_summary: bool = True,
					 report_style: str = "professional", **kwargs) -> ToolResult:
		"""Execute report generation"""
		
		try:
			report_results = {
				"report_title": report_title,
				"report_style": report_style,
				"sections_count": len(content_sections),
				"generated_components": [],
				"formatted_report": "",
				"metadata": {}
			}
			
			# Validate and process content sections
			processed_sections = await self._process_content_sections(content_sections)
			report_results["processed_sections"] = processed_sections
			
			# Generate executive summary if requested
			executive_summary = ""
			if add_executive_summary:
				executive_summary = await self._generate_executive_summary(processed_sections)
				report_results["generated_components"].append("executive_summary")
			
			# Generate table of contents if requested
			table_of_contents = ""
			if generate_toc:
				table_of_contents = await self._generate_table_of_contents(processed_sections)
				report_results["generated_components"].append("table_of_contents")
			
			# Compile the complete report
			formatted_report = await self._compile_report(
				report_title, executive_summary, table_of_contents, 
				processed_sections, report_style
			)
			report_results["formatted_report"] = formatted_report
			
			# Generate report metadata
			metadata = await self._generate_report_metadata(
				formatted_report, report_title, processed_sections
			)
			report_results["metadata"] = metadata
			
			# Calculate report statistics
			stats = await self._calculate_report_statistics(formatted_report, processed_sections)
			report_results["statistics"] = stats
			
			return ToolResult(
				success=True,
				data=report_results,
				tool_name=self.name,
				metadata={
					"report_title": report_title,
					"sections_count": len(content_sections),
					"report_style": report_style
				}
			)
			
		except Exception as e:
			raise ToolError(f"Report generation failed: {str(e)}", self.name, "REPORT_GENERATION_ERROR")
	
	async def _process_content_sections(self, sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
		"""Process and validate content sections"""
		processed = []
		
		for i, section in enumerate(sections):
			if not isinstance(section, dict) or "content" not in section:
				continue
			
			section_data = {
				"index": i + 1,
				"title": section.get("title", f"Section {i + 1}"),
				"content": section["content"],
				"section_type": section.get("type", "content"),
				"word_count": len(section["content"].split()),
				"subsections": await self._extract_subsections(section["content"])
			}
			
			# Add numbering if not present
			if not re.match(r'^\d+\.', section_data["title"]):
				section_data["title"] = f"{i + 1}. {section_data['title']}"
			
			processed.append(section_data)
		
		return processed
	
	async def _extract_subsections(self, content: str) -> List[Dict[str, str]]:
		"""Extract subsections from content"""
		subsections = []
		
		# Look for potential subsection headers
		lines = content.split('\n')
		for line_num, line in enumerate(lines):
			line = line.strip()
			
			# Check for subsection patterns
			if (len(line) > 5 and len(line) < 60 and
				not line.endswith('.') and
				(line.startswith(('a)', 'b)', 'c)')) or 
				 re.match(r'^\d+\.\d+', line) or
				 line.isupper())):
				
				subsections.append({
					"title": line,
					"line_number": line_num + 1
				})
		
		return subsections[:10]  # Limit to 10 subsections per section
	
	async def _generate_executive_summary(self, sections: List[Dict[str, Any]]) -> str:
		"""Generate executive summary from report sections"""
		
		# Collect key sentences from each section
		key_points = []
		
		for section in sections[:5]:  # Focus on first 5 sections for summary
			content = section["content"]
			sentences = re.split(r'[.!?]+', content)
			
			# Find sentences that might be key points
			for sentence in sentences:
				sentence = sentence.strip()
				if (len(sentence) > 30 and len(sentence) < 150 and
					any(indicator in sentence.lower() for indicator in 
						['important', 'key', 'significant', 'critical', 'essential', 
						 'shows', 'indicates', 'demonstrates', 'results', 'findings'])):
					key_points.append(sentence)
		
		# Create executive summary
		summary_parts = [
			"## Executive Summary\n",
			"This report presents a comprehensive analysis of the key topics addressed in the following sections.\n"
		]
		
		if key_points:
			summary_parts.append("\n**Key Findings:**\n")
			for i, point in enumerate(key_points[:5], 1):  # Top 5 key points
				summary_parts.append(f"{i}. {point.strip()}.\n")
		
		summary_parts.extend([
			f"\nThe report contains {len(sections)} main sections covering ",
			f"a total of {sum(s['word_count'] for s in sections)} words. ",
			"Each section provides detailed analysis and recommendations for the respective topic areas.\n\n"
		])
		
		return ''.join(summary_parts)
	
	async def _generate_table_of_contents(self, sections: List[Dict[str, Any]]) -> str:
		"""Generate table of contents"""
		toc_parts = ["## Table of Contents\n\n"]
		
		for section in sections:
			toc_parts.append(f"{section['index']}. {section['title']} ... Page {section['index']}\n")
			
			# Add subsections if present
			for subsection in section.get('subsections', []):
				toc_parts.append(f"   {subsection['title']} ... Page {section['index']}\n")
		
		toc_parts.append("\n---\n\n")
		return ''.join(toc_parts)
	
	async def _compile_report(self, title: str, executive_summary: str, 
							 table_of_contents: str, sections: List[Dict[str, Any]], 
							 style: str) -> str:
		"""Compile the complete report"""
		
		report_parts = []
		
		# Report header based on style
		if style == "professional":
			report_parts.extend([
				f"# {title}\n\n",
				f"**Date:** {datetime.now().strftime('%B %d, %Y')}\n",
				f"**Generated by:** Agent Publishing System\n\n",
				"---\n\n"
			])
		elif style == "academic":
			report_parts.extend([
				f"# {title}\n\n",
				f"**Abstract:** This document presents a comprehensive analysis of the subject matter.\n\n",
				f"**Date:** {datetime.now().strftime('%Y-%m-%d')}\n\n",
				"---\n\n"
			])
		else:  # technical or other styles
			report_parts.extend([
				f"# {title}\n\n",
				f"**Document Version:** 1.0\n",
				f"**Generated:** {datetime.now().isoformat()}\n\n",
				"---\n\n"
			])
		
		# Add executive summary
		if executive_summary:
			report_parts.append(executive_summary)
			report_parts.append("---\n\n")
		
		# Add table of contents
		if table_of_contents:
			report_parts.append(table_of_contents)
		
		# Add main content sections
		for section in sections:
			report_parts.extend([
				f"## {section['title']}\n\n",
				section['content'],
				"\n\n---\n\n"
			])
		
		# Add footer based on style
		if style == "professional":
			report_parts.extend([
				"## Report Summary\n\n",
				f"This report contains {len(sections)} sections with a total of ",
				f"{sum(s['word_count'] for s in sections)} words. ",
				"The analysis provided is based on the available information and methodology described in each section.\n\n",
				f"**Report Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}\n"
			])
		
		return ''.join(report_parts)
	
	async def _generate_report_metadata(self, report: str, title: str, 
									  sections: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Generate comprehensive report metadata"""
		return {
			"title": title,
			"generation_date": datetime.now().isoformat(),
			"total_word_count": len(report.split()),
			"total_character_count": len(report),
			"section_count": len(sections),
			"page_estimate": max(1, len(report.split()) // 250),  # ~250 words per page
			"report_hash": hashlib.md5(report.encode()).hexdigest(),
			"sections_metadata": [
				{
					"title": s["title"],
					"word_count": s["word_count"],
					"subsection_count": len(s.get("subsections", []))
				}
				for s in sections
			]
		}
	
	async def _calculate_report_statistics(self, report: str, sections: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Calculate detailed report statistics"""
		words = report.split()
		sentences = re.split(r'[.!?]+', report)
		sentences = [s for s in sentences if s.strip()]
		
		return {
			"total_words": len(words),
			"total_sentences": len(sentences),
			"avg_words_per_sentence": len(words) / len(sentences) if sentences else 0,
			"avg_words_per_section": sum(s['word_count'] for s in sections) / len(sections) if sections else 0,
			"longest_section": max(sections, key=lambda s: s['word_count'])['title'] if sections else None,
			"shortest_section": min(sections, key=lambda s: s['word_count'])['title'] if sections else None,
			"reading_time_minutes": max(1, len(words) // 200)  # ~200 words per minute
		}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for report generator"""
		return {
			"type": "object",
			"properties": {
				"content_sections": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"title": {"type": "string", "description": "Section title"},
							"content": {"type": "string", "description": "Section content"},
							"type": {"type": "string", "default": "content", "description": "Section type"}
						},
						"required": ["content"]
					},
					"description": "Array of content sections to include in the report"
				},
				"report_title": {
					"type": "string",
					"description": "Title of the generated report"
				},
				"generate_toc": {
					"type": "boolean",
					"default": True,
					"description": "Generate table of contents"
				},
				"add_executive_summary": {
					"type": "boolean",
					"default": True,
					"description": "Add executive summary to the report"
				},
				"report_style": {
					"type": "string",
					"enum": ["professional", "academic", "technical", "creative"],
					"default": "professional",
					"description": "Report formatting style"
				}
			},
			"required": ["content_sections", "report_title"]
		}


class DeliveryPackagerTool(AgentTool):
	"""
	Document packaging and delivery preparation tool
	
	Critical for publishers, packagers, and delivery teams to prepare final documents.
	Creates delivery packages with proper folder structure, metadata files,
	version control, and formats for different distribution channels.
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="delivery_packager",
			description="Document packaging and delivery preparation for distribution",
			capabilities=[ToolCapability.FILE_OPERATIONS, ToolCapability.DATA_PROCESSING],
			config=config
		)
	
	async def execute(self, documents: List[Dict[str, Any]], package_name: str,
					 include_metadata: bool = True, create_archive: bool = True,
					 delivery_format: str = "standard", **kwargs) -> ToolResult:
		"""Execute document packaging"""
		
		try:
			packaging_results = {
				"package_name": package_name,
				"delivery_format": delivery_format,
				"documents_count": len(documents),
				"package_structure": {},
				"generated_files": [],
				"package_metadata": {},
				"delivery_info": {}
			}
			
			# Create temporary directory for package preparation
			with tempfile.TemporaryDirectory() as temp_dir:
				package_dir = Path(temp_dir) / package_name
				package_dir.mkdir(exist_ok=True)
				
				# Process documents and create package structure
				package_structure = await self._create_package_structure(
					package_dir, documents, delivery_format
				)
				packaging_results["package_structure"] = package_structure
				
				# Generate metadata files if requested
				if include_metadata:
					metadata_files = await self._generate_metadata_files(
						package_dir, documents, package_name
					)
					packaging_results["generated_files"].extend(metadata_files)
				
				# Create delivery-specific files
				delivery_files = await self._create_delivery_files(
					package_dir, documents, delivery_format
				)
				packaging_results["generated_files"].extend(delivery_files)
				
				# Generate package manifest
				manifest = await self._generate_package_manifest(
					package_dir, documents, package_name
				)
				packaging_results["package_metadata"]["manifest"] = manifest
				
				# Create archive if requested
				archive_info = {}
				if create_archive:
					archive_info = await self._create_archive(
						package_dir, package_name, temp_dir
					)
				packaging_results["delivery_info"]["archive"] = archive_info
				
				# Calculate package statistics
				stats = await self._calculate_package_statistics(package_dir, documents)
				packaging_results["package_metadata"]["statistics"] = stats
				
				# Generate delivery instructions
				delivery_instructions = await self._generate_delivery_instructions(
					package_name, delivery_format, stats
				)
				packaging_results["delivery_info"]["instructions"] = delivery_instructions
			
			return ToolResult(
				success=True,
				data=packaging_results,
				tool_name=self.name,
				metadata={
					"package_name": package_name,
					"documents_count": len(documents),
					"delivery_format": delivery_format
				}
			)
			
		except Exception as e:
			raise ToolError(f"Document packaging failed: {str(e)}", self.name, "PACKAGING_ERROR")
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for delivery packager"""
		return {
			"type": "object",
			"properties": {
				"documents": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"filename": {"type": "string", "description": "Document filename"},
							"content": {"type": "string", "description": "Document content"},
							"type": {"type": "string", "default": "text", "description": "Document type"},
							"metadata": {"type": "object", "description": "Additional document metadata"}
						},
						"required": ["content"]
					},
					"description": "Array of documents to package"
				},
				"package_name": {
					"type": "string",
					"description": "Name for the delivery package"
				},
				"include_metadata": {
					"type": "boolean",
					"default": True,
					"description": "Include metadata files in package"
				},
				"create_archive": {
					"type": "boolean",
					"default": True,
					"description": "Create compressed archive of the package"
				},
				"delivery_format": {
					"type": "string",
					"enum": ["standard", "print", "digital", "archive"],
					"default": "standard",
					"description": "Target delivery format"
				}
			},
			"required": ["documents", "package_name"]
		}
	
	# Simplified implementation methods (full implementation would include all methods from final file)
	async def _create_package_structure(self, package_dir: Path, documents: List[Dict[str, Any]], 
									  delivery_format: str) -> Dict[str, Any]:
		"""Create basic package structure"""
		return {"directories_created": [], "document_placements": [], "structure_type": delivery_format}
	
	async def _generate_metadata_files(self, package_dir: Path, documents: List[Dict[str, Any]], 
									 package_name: str) -> List[str]:
		"""Generate metadata files"""
		return []
	
	async def _create_delivery_files(self, package_dir: Path, documents: List[Dict[str, Any]], 
								  delivery_format: str) -> List[str]:
		"""Create delivery files"""
		return []
	
	async def _generate_package_manifest(self, package_dir: Path, documents: List[Dict[str, Any]], 
									   package_name: str) -> Dict[str, Any]:
		"""Generate package manifest"""
		return {"manifest_version": "1.0", "package_name": package_name}
	
	async def _create_archive(self, package_dir: Path, package_name: str, 
							 temp_dir: str) -> Dict[str, Any]:
		"""Create archive"""
		return {"archive_created": False, "reason": "Simplified implementation"}
	
	async def _calculate_package_statistics(self, package_dir: Path, 
										  documents: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Calculate package statistics"""
		return {"total_files": 0, "total_size_mb": 0}
	
	async def _generate_delivery_instructions(self, package_name: str, delivery_format: str, 
										   stats: Dict[str, Any]) -> Dict[str, Any]:
		"""Generate delivery instructions"""
		return {"package_name": package_name, "instructions": "Simplified implementation"}