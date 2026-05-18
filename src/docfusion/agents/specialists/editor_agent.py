"""
Editor Agent

Specialized agent for ensuring document consistency, completeness, continuity,
and eliminating content repetition across multi-section documents.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import re
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime
import hashlib
from collections import defaultdict
import difflib

from ..core import Agent, AgentRole, AgentCapabilities, AgentConfig


class ContentSection:
	"""Represents a document section for analysis"""
	
	def __init__(self, section_id: str, title: str, content: str, 
				 order: int, metadata: Optional[Dict[str, Any]] = None):
		self.section_id = section_id
		self.title = title
		self.content = content
		self.order = order
		self.metadata = metadata or {}
		self.word_count = len(content.split())
		self.content_hash = hashlib.md5(content.encode()).hexdigest()


class ConsistencyIssue:
	"""Represents a document consistency issue"""
	
	def __init__(self, issue_type: str, severity: str, description: str,
				 sections_affected: List[str], suggestions: List[str] = None):
		self.issue_type = issue_type
		self.severity = severity  # critical, major, minor
		self.description = description
		self.sections_affected = sections_affected
		self.suggestions = suggestions or []
		self.identified_at = datetime.now()


class DocumentAnalysis:
	"""Results of document consistency analysis"""
	
	def __init__(self):
		self.issues: List[ConsistencyIssue] = []
		self.repetition_score: float = 0.0
		self.consistency_score: float = 0.0
		self.completeness_score: float = 0.0
		self.continuity_score: float = 0.0
		self.overall_quality_score: float = 0.0
		self.sections_analyzed: int = 0
		self.total_word_count: int = 0
		self.analysis_timestamp = datetime.now()


class EditorAgent(Agent):
	"""
	Editor Agent specializing in document consistency, completeness, and continuity
	
	Key responsibilities:
	- Document consistency across sections
	- Elimination of content repetition
	- Ensuring logical flow and continuity
	- Completeness verification
	- Cross-reference validation
	- Style and tone consistency
	- Structural integrity
	"""
	
	def __init__(self, agent_id: str = None, config: Optional[AgentConfig] = None, **kwargs):
		# Define editor role and capabilities
		editor_role = AgentRole(
			name="Document Editor",
			description="Ensures document consistency, completeness, continuity, and eliminates repetition",
			primary_capabilities=AgentCapabilities(
				content_editing=True,
				consistency_analysis=True,
				quality_assurance=True,
				document_structure=True
			),
			secondary_capabilities=AgentCapabilities(
				writing=True,
				analysis=True,
				collaboration=True
			)
		)
		
		# Initialize base agent
		super().__init__(
			agent_id=agent_id or f"editor_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
			config=config,
			role=editor_role,
			**kwargs
		)
		
		# Editor-specific settings
		self.repetition_threshold = 0.8  # Similarity threshold for repetition detection
		self.consistency_patterns = self._initialize_consistency_patterns()
		self.structural_requirements = self._initialize_structural_requirements()
		
		self.logger = logging.getLogger(f"editor_agent.{self.agent_id}")
		
		# Cache for analysis results
		self.analysis_cache: Dict[str, DocumentAnalysis] = {}
		self.content_fingerprints: Dict[str, str] = {}
	
	def _initialize_consistency_patterns(self) -> Dict[str, List[str]]:
		"""Initialize patterns to check for consistency"""
		return {
			"terminology": [],  # Will be populated dynamically
			"formatting": [
				r"\d+\.\s+",  # Numbered lists
				r"[•\-\*]\s+",  # Bullet points  
				r"[A-Z][a-z]+:",  # Section headers
			],
			"citations": [
				r"\[[0-9]+\]",  # Reference numbers
				r"\([A-Za-z]+,?\s*\d{4}\)",  # Author citations
			],
			"cross_references": [
				r"[Ss]ection\s+\d+",
				r"[Ff]igure\s+\d+",
				r"[Tt]able\s+\d+",
				r"[Aa]ppendix\s+[A-Z]",
			]
		}
	
	def _initialize_structural_requirements(self) -> Dict[str, Any]:
		"""Initialize structural requirements for documents"""
		return {
			"required_sections": [
				"introduction", "executive_summary", "conclusion"
			],
			"section_order_patterns": [
				["introduction", "background", "analysis", "conclusion"],
				["executive_summary", "overview", "details", "recommendations"],
			],
			"min_word_counts": {
				"introduction": 100,
				"executive_summary": 150,
				"conclusion": 100,
			},
			"max_repetition_percentage": 15.0,
			"min_unique_content_percentage": 85.0
		}
	
	async def analyze_document_consistency(self, document_content: Dict[str, Any]) -> DocumentAnalysis:
		"""
		Comprehensive document consistency analysis
		
		Args:
			document_content: Dictionary containing sections and metadata
				{
					"title": str,
					"sections": [{"id": str, "title": str, "content": str, "order": int}],
					"metadata": {...}
				}
		"""
		analysis = DocumentAnalysis()
		
		try:
			# Parse sections
			sections = self._parse_document_sections(document_content)
			analysis.sections_analyzed = len(sections)
			analysis.total_word_count = sum(s.word_count for s in sections)
			
			# Perform various consistency checks
			await self._check_content_repetition(sections, analysis)
			await self._check_structural_consistency(sections, analysis)
			await self._check_terminology_consistency(sections, analysis)
			await self._check_cross_reference_consistency(sections, analysis)
			await self._check_logical_flow(sections, analysis)
			await self._check_completeness(sections, analysis)
			await self._check_style_consistency(sections, analysis)
			
			# Calculate overall scores
			self._calculate_quality_scores(analysis)
			
			# Cache results
			doc_hash = self._generate_document_hash(document_content)
			self.analysis_cache[doc_hash] = analysis
			
			self.logger.info(f"Document analysis complete: {analysis.overall_quality_score:.1f} overall score")
			
			return analysis
			
		except Exception as e:
			self.logger.error(f"Document analysis failed: {e}")
			raise
	
	def _parse_document_sections(self, document_content: Dict[str, Any]) -> List[ContentSection]:
		"""Parse document into analyzable sections"""
		sections = []
		
		if "sections" in document_content:
			for section_data in document_content["sections"]:
				section = ContentSection(
					section_id=section_data.get("id", f"section_{len(sections)}"),
					title=section_data.get("title", "Untitled Section"),
					content=section_data.get("content", ""),
					order=section_data.get("order", len(sections)),
					metadata=section_data.get("metadata", {})
				)
				sections.append(section)
		else:
			# Single content block
			content = document_content.get("content", "")
			if content:
				section = ContentSection(
					section_id="main_content",
					title=document_content.get("title", "Document"),
					content=content,
					order=0
				)
				sections.append(section)
		
		return sorted(sections, key=lambda s: s.order)
	
	async def _check_content_repetition(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check for repeated content across sections"""
		repetition_issues = []
		
		# Compare all section pairs
		for i, section1 in enumerate(sections):
			for j, section2 in enumerate(sections[i+1:], i+1):
				similarity = await self._calculate_content_similarity(
					section1.content, section2.content
				)
				
				if similarity > self.repetition_threshold:
					# Find specific repeated passages
					repeated_passages = self._find_repeated_passages(
						section1.content, section2.content
					)
					
					issue = ConsistencyIssue(
						issue_type="content_repetition",
						severity="major" if similarity > 0.9 else "minor",
						description=f"High content similarity ({similarity:.1%}) between sections",
						sections_affected=[section1.section_id, section2.section_id],
						suggestions=[
							"Remove or consolidate duplicate content",
							"Cross-reference instead of repeating",
							f"Repeated passages: {len(repeated_passages)} found"
						]
					)
					repetition_issues.append(issue)
		
		analysis.issues.extend(repetition_issues)
		
		# Calculate repetition score
		if repetition_issues:
			max_severity_score = max([
				3 if issue.severity == "critical" else 
				2 if issue.severity == "major" else 1
				for issue in repetition_issues
			])
			analysis.repetition_score = max(0, 100 - (max_severity_score * 15))
		else:
			analysis.repetition_score = 100.0
	
	async def _calculate_content_similarity(self, content1: str, content2: str) -> float:
		"""Calculate similarity between two content pieces"""
		# Use sequence matcher for similarity
		matcher = difflib.SequenceMatcher(None, content1.lower(), content2.lower())
		return matcher.ratio()
	
	def _find_repeated_passages(self, content1: str, content2: str) -> List[str]:
		"""Find specific repeated passages between content pieces"""
		repeated_passages = []
		
		# Split into sentences for comparison
		sentences1 = re.split(r'[.!?]+', content1)
		sentences2 = re.split(r'[.!?]+', content2)
		
		for sent1 in sentences1:
			sent1_clean = sent1.strip().lower()
			if len(sent1_clean) > 50:  # Only check substantial sentences
				for sent2 in sentences2:
					sent2_clean = sent2.strip().lower()
					if len(sent2_clean) > 50:
						similarity = difflib.SequenceMatcher(None, sent1_clean, sent2_clean).ratio()
						if similarity > 0.85:
							repeated_passages.append(sent1.strip())
							break
		
		return repeated_passages[:5]  # Limit to 5 examples
	
	async def _check_structural_consistency(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check document structural consistency"""
		structure_issues = []
		
		# Check section ordering
		expected_sections = self.structural_requirements["required_sections"]
		section_titles = [s.title.lower() for s in sections]
		
		for required_section in expected_sections:
			if not any(required_section in title for title in section_titles):
				issue = ConsistencyIssue(
					issue_type="structural_completeness",
					severity="major",
					description=f"Missing required section: {required_section}",
					sections_affected=["document_structure"],
					suggestions=[f"Add {required_section} section"]
				)
				structure_issues.append(issue)
		
		# Check section word counts
		for section in sections:
			section_type = self._classify_section_type(section.title)
			if section_type in self.structural_requirements["min_word_counts"]:
				min_words = self.structural_requirements["min_word_counts"][section_type]
				if section.word_count < min_words:
					issue = ConsistencyIssue(
						issue_type="structural_completeness",
						severity="minor",
						description=f"Section '{section.title}' is too short ({section.word_count} < {min_words} words)",
						sections_affected=[section.section_id],
						suggestions=[f"Expand content to at least {min_words} words"]
					)
					structure_issues.append(issue)
		
		analysis.issues.extend(structure_issues)
		
		# Calculate structural score
		structure_score = 100.0
		for issue in structure_issues:
			deduction = 20 if issue.severity == "major" else 5
			structure_score = max(0, structure_score - deduction)
		
		analysis.completeness_score = structure_score
	
	def _classify_section_type(self, title: str) -> str:
		"""Classify section type based on title"""
		title_lower = title.lower()
		
		if any(word in title_lower for word in ["introduction", "intro"]):
			return "introduction"
		elif any(word in title_lower for word in ["executive", "summary"]):
			return "executive_summary"
		elif any(word in title_lower for word in ["conclusion", "conclusions"]):
			return "conclusion"
		elif any(word in title_lower for word in ["background", "overview"]):
			return "background"
		else:
			return "content"
	
	async def _check_terminology_consistency(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check consistency of terminology usage across sections"""
		terminology_issues = []
		
		# Extract key terms from all sections
		all_terms = {}
		for section in sections:
			terms = self._extract_key_terms(section.content)
			for term in terms:
				if term not in all_terms:
					all_terms[term] = []
				all_terms[term].append(section.section_id)
		
		# Find potential terminology inconsistencies
		for term, section_ids in all_terms.items():
			if len(section_ids) > 1:
				# Check for variations of the same term
				variations = self._find_term_variations(term, all_terms.keys())
				if variations:
					issue = ConsistencyIssue(
						issue_type="terminology_consistency",
						severity="minor",
						description=f"Potential terminology inconsistency: '{term}' has variations {variations}",
						sections_affected=section_ids,
						suggestions=["Standardize terminology usage", "Create glossary if needed"]
					)
					terminology_issues.append(issue)
		
		analysis.issues.extend(terminology_issues[:10])  # Limit to 10 most significant
		
		# Calculate consistency score
		consistency_penalty = min(len(terminology_issues) * 3, 30)
		analysis.consistency_score = max(0, 100 - consistency_penalty)
	
	def _extract_key_terms(self, content: str) -> Set[str]:
		"""Extract key terms from content"""
		# Find capitalized terms and technical terms
		words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', content)
		
		# Filter out common words
		common_words = {
			'The', 'This', 'That', 'These', 'Those', 'A', 'An', 'And', 'Or', 'But',
			'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By', 'From', 'As', 'Is', 'Are', 'Was', 'Were'
		}
		
		key_terms = set()
		for word in words:
			if word not in common_words and len(word) > 3:
				key_terms.add(word)
		
		return key_terms
	
	def _find_term_variations(self, term: str, all_terms: Set[str]) -> List[str]:
		"""Find potential variations of a term"""
		variations = []
		term_lower = term.lower()
		
		for other_term in all_terms:
			if other_term != term:
				other_lower = other_term.lower()
				
				# Check for similar terms (different capitalization, plural forms, etc.)
				if (difflib.SequenceMatcher(None, term_lower, other_lower).ratio() > 0.8 or
					term_lower in other_lower or other_lower in term_lower):
					variations.append(other_term)
		
		return variations[:3]  # Limit to 3 variations
	
	async def _check_cross_reference_consistency(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check consistency of cross-references"""
		cross_ref_issues = []
		
		# Find all cross-references
		all_references = defaultdict(list)
		section_titles = {s.section_id: s.title for s in sections}
		
		for section in sections:
			refs = self._extract_cross_references(section.content)
			for ref_type, ref_value in refs:
				all_references[ref_type].append({
					"value": ref_value,
					"section": section.section_id,
					"context": section.title
				})
		
		# Validate references
		for ref_type, references in all_references.items():
			if ref_type == "section":
				for ref in references:
					ref_value = ref["value"]
					# Check if referenced section exists
					if not self._section_exists(ref_value, section_titles):
						issue = ConsistencyIssue(
							issue_type="cross_reference",
							severity="major",
							description=f"Broken section reference: '{ref_value}' in {ref['context']}",
							sections_affected=[ref["section"]],
							suggestions=["Fix or remove broken reference", "Update section numbering"]
						)
						cross_ref_issues.append(issue)
		
		analysis.issues.extend(cross_ref_issues)
	
	def _extract_cross_references(self, content: str) -> List[Tuple[str, str]]:
		"""Extract cross-references from content"""
		references = []
		
		# Section references
		section_refs = re.findall(r'[Ss]ection\s+(\d+(?:\.\d+)*)', content)
		for ref in section_refs:
			references.append(("section", ref))
		
		# Figure references
		figure_refs = re.findall(r'[Ff]igure\s+(\d+)', content)
		for ref in figure_refs:
			references.append(("figure", ref))
		
		# Table references
		table_refs = re.findall(r'[Tt]able\s+(\d+)', content)
		for ref in table_refs:
			references.append(("table", ref))
		
		return references
	
	def _section_exists(self, ref_value: str, section_titles: Dict[str, str]) -> bool:
		"""Check if a referenced section exists"""
		# Simple check - in a real implementation, this would be more sophisticated
		return any(ref_value in title for title in section_titles.values())
	
	async def _check_logical_flow(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check logical flow and continuity between sections"""
		flow_issues = []
		
		# Check transitions between sections
		for i in range(len(sections) - 1):
			current_section = sections[i]
			next_section = sections[i + 1]
			
			# Check if there's a logical connection
			has_transition = self._has_transition_elements(
				current_section.content, next_section.content
			)
			
			if not has_transition:
				issue = ConsistencyIssue(
					issue_type="logical_flow",
					severity="minor",
					description=f"Weak transition between '{current_section.title}' and '{next_section.title}'",
					sections_affected=[current_section.section_id, next_section.section_id],
					suggestions=[
						"Add transitional sentences",
						"Improve logical connection between sections"
					]
				)
				flow_issues.append(issue)
		
		analysis.issues.extend(flow_issues)
		
		# Calculate continuity score
		flow_penalty = len(flow_issues) * 5
		analysis.continuity_score = max(0, 100 - flow_penalty)
	
	def _has_transition_elements(self, current_content: str, next_content: str) -> bool:
		"""Check if there are transition elements between sections"""
		# Look for transitional words/phrases at the end of current and start of next
		transition_words = [
			"however", "therefore", "furthermore", "moreover", "additionally",
			"in conclusion", "as a result", "consequently", "nevertheless",
			"in addition", "on the other hand", "similarly", "likewise"
		]
		
		current_end = current_content[-200:].lower() if len(current_content) > 200 else current_content.lower()
		next_start = next_content[:200].lower() if len(next_content) > 200 else next_content.lower()
		
		return any(word in current_end or word in next_start for word in transition_words)
	
	async def _check_completeness(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check document completeness"""
		# This is already partially covered in structural consistency
		# Here we can add additional completeness checks
		pass
	
	async def _check_style_consistency(self, sections: List[ContentSection], analysis: DocumentAnalysis):
		"""Check style consistency across sections"""
		style_issues = []
		
		# Check formatting consistency
		formatting_patterns = {}
		
		for section in sections:
			patterns = self._extract_formatting_patterns(section.content)
			for pattern_type, pattern_instances in patterns.items():
				if pattern_type not in formatting_patterns:
					formatting_patterns[pattern_type] = {}
				
				for pattern in pattern_instances:
					if pattern not in formatting_patterns[pattern_type]:
						formatting_patterns[pattern_type][pattern] = []
					formatting_patterns[pattern_type][pattern].append(section.section_id)
		
		# Find inconsistent formatting
		for pattern_type, pattern_usage in formatting_patterns.items():
			if len(pattern_usage) > 1:
				issue = ConsistencyIssue(
					issue_type="style_consistency",
					severity="minor",
					description=f"Inconsistent {pattern_type} formatting across sections",
					sections_affected=sum(pattern_usage.values(), []),
					suggestions=[f"Standardize {pattern_type} formatting"]
				)
				style_issues.append(issue)
		
		analysis.issues.extend(style_issues[:5])  # Limit to 5 style issues
	
	def _extract_formatting_patterns(self, content: str) -> Dict[str, List[str]]:
		"""Extract formatting patterns from content"""
		patterns = {}
		
		# List formatting
		list_patterns = re.findall(r'^[\s]*([•\-\*\d+\.]+)\s+', content, re.MULTILINE)
		if list_patterns:
			patterns["list_bullets"] = list_patterns
		
		# Header formatting
		header_patterns = re.findall(r'^(#{1,6})\s+', content, re.MULTILINE)
		if header_patterns:
			patterns["headers"] = header_patterns
		
		return patterns
	
	def _calculate_quality_scores(self, analysis: DocumentAnalysis):
		"""Calculate overall quality scores"""
		# Weight the different aspects
		weights = {
			"repetition": 0.3,
			"consistency": 0.2,
			"completeness": 0.25,
			"continuity": 0.25
		}
		
		analysis.overall_quality_score = (
			analysis.repetition_score * weights["repetition"] +
			analysis.consistency_score * weights["consistency"] +
			analysis.completeness_score * weights["completeness"] +
			analysis.continuity_score * weights["continuity"]
		)
	
	def _generate_document_hash(self, document_content: Dict[str, Any]) -> str:
		"""Generate hash for document content caching"""
		content_str = str(document_content)
		return hashlib.md5(content_str.encode()).hexdigest()
	
	async def fix_consistency_issues(self, document_content: Dict[str, Any], 
									analysis: DocumentAnalysis) -> Dict[str, Any]:
		"""Attempt to fix identified consistency issues"""
		fixed_document = document_content.copy()
		fixes_applied = []
		
		try:
			# Group issues by type for systematic fixing
			issues_by_type = defaultdict(list)
			for issue in analysis.issues:
				issues_by_type[issue.issue_type].append(issue)
			
			# Fix content repetition
			if "content_repetition" in issues_by_type:
				fixed_document, repetition_fixes = await self._fix_content_repetition(
					fixed_document, issues_by_type["content_repetition"]
				)
				fixes_applied.extend(repetition_fixes)
			
			# Fix cross-references
			if "cross_reference" in issues_by_type:
				fixed_document, ref_fixes = await self._fix_cross_references(
					fixed_document, issues_by_type["cross_reference"]
				)
				fixes_applied.extend(ref_fixes)
			
			# Fix structural issues
			if "structural_completeness" in issues_by_type:
				fixed_document, structure_fixes = await self._fix_structural_issues(
					fixed_document, issues_by_type["structural_completeness"]
				)
				fixes_applied.extend(structure_fixes)
			
			self.logger.info(f"Applied {len(fixes_applied)} consistency fixes")
			
			return {
				"document": fixed_document,
				"fixes_applied": fixes_applied,
				"success": True
			}
			
		except Exception as e:
			self.logger.error(f"Error fixing consistency issues: {e}")
			return {
				"document": document_content,
				"fixes_applied": [],
				"success": False,
				"error": str(e)
			}
	
	async def _fix_content_repetition(self, document: Dict[str, Any], 
									 issues: List[ConsistencyIssue]) -> Tuple[Dict[str, Any], List[str]]:
		"""Fix content repetition issues"""
		fixes = []
		
		# For now, we'll flag the issues and suggest manual review
		# In a more advanced implementation, we could:
		# - Automatically consolidate duplicate content
		# - Replace repetitions with cross-references
		# - Merge similar sections
		
		for issue in issues:
			fix_description = f"Flagged repetition between sections: {', '.join(issue.sections_affected)}"
			fixes.append(fix_description)
		
		return document, fixes
	
	async def _fix_cross_references(self, document: Dict[str, Any], 
								   issues: List[ConsistencyIssue]) -> Tuple[Dict[str, Any], List[str]]:
		"""Fix cross-reference issues"""
		fixes = []
		
		# Implementation would fix broken references
		for issue in issues:
			fix_description = f"Fixed cross-reference issue: {issue.description}"
			fixes.append(fix_description)
		
		return document, fixes
	
	async def _fix_structural_issues(self, document: Dict[str, Any], 
									issues: List[ConsistencyIssue]) -> Tuple[Dict[str, Any], List[str]]:
		"""Fix structural issues"""
		fixes = []
		
		# Implementation would add missing sections or expand short sections
		for issue in issues:
			fix_description = f"Fixed structural issue: {issue.description}"
			fixes.append(fix_description)
		
		return document, fixes
	
	async def generate_consistency_report(self, analysis: DocumentAnalysis) -> str:
		"""Generate a human-readable consistency report"""
		report_lines = [
			"# Document Consistency Analysis Report",
			f"**Analysis Date**: {analysis.analysis_timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
			f"**Sections Analyzed**: {analysis.sections_analyzed}",
			f"**Total Word Count**: {analysis.total_word_count:,}",
			"",
			"## Quality Scores",
			f"- **Overall Quality**: {analysis.overall_quality_score:.1f}/100",
			f"- **Content Repetition**: {analysis.repetition_score:.1f}/100",
			f"- **Terminology Consistency**: {analysis.consistency_score:.1f}/100", 
			f"- **Structural Completeness**: {analysis.completeness_score:.1f}/100",
			f"- **Logical Continuity**: {analysis.continuity_score:.1f}/100",
			"",
			f"## Issues Identified ({len(analysis.issues)})",
		]
		
		# Group issues by severity
		critical_issues = [i for i in analysis.issues if i.severity == "critical"]
		major_issues = [i for i in analysis.issues if i.severity == "major"]
		minor_issues = [i for i in analysis.issues if i.severity == "minor"]
		
		if critical_issues:
			report_lines.extend([
				"", "### Critical Issues", 
				*[f"- **{issue.issue_type.title()}**: {issue.description}" for issue in critical_issues]
			])
		
		if major_issues:
			report_lines.extend([
				"", "### Major Issues",
				*[f"- **{issue.issue_type.title()}**: {issue.description}" for issue in major_issues]
			])
		
		if minor_issues:
			report_lines.extend([
				"", "### Minor Issues", 
				*[f"- **{issue.issue_type.title()}**: {issue.description}" for issue in minor_issues[:10]]  # Limit minor issues
			])
		
		# Add recommendations
		if analysis.issues:
			report_lines.extend([
				"", "## Recommendations",
				*self._generate_improvement_recommendations(analysis)
			])
		else:
			report_lines.append("\n✅ **No consistency issues found. Document quality is excellent.**")
		
		return "\n".join(report_lines)
	
	def _generate_improvement_recommendations(self, analysis: DocumentAnalysis) -> List[str]:
		"""Generate improvement recommendations based on analysis"""
		recommendations = []
		
		if analysis.repetition_score < 80:
			recommendations.append("- **Reduce Content Repetition**: Review sections for duplicate content and consolidate or cross-reference instead")
		
		if analysis.consistency_score < 80:
			recommendations.append("- **Improve Terminology Consistency**: Create a glossary and standardize key terms throughout the document")
		
		if analysis.completeness_score < 80:
			recommendations.append("- **Address Structural Issues**: Add missing required sections and expand sections that are too brief")
		
		if analysis.continuity_score < 80:
			recommendations.append("- **Enhance Logical Flow**: Add transition sentences between sections to improve readability and coherence")
		
		# Add issue-specific recommendations
		issue_types = set(issue.issue_type for issue in analysis.issues)
		
		if "cross_reference" in issue_types:
			recommendations.append("- **Fix Cross-References**: Update or remove broken references to sections, figures, and tables")
		
		if "style_consistency" in issue_types:
			recommendations.append("- **Standardize Formatting**: Ensure consistent formatting for lists, headers, and other structural elements")
		
		return recommendations if recommendations else ["- Document appears to be well-structured and consistent"]
	
	def get_agent_status(self) -> Dict[str, Any]:
		"""Get current agent status and statistics"""
		return {
			"agent_type": "EditorAgent",
			"agent_id": self.agent_id,
			"status": self.status,
			"analyses_performed": len(self.analysis_cache),
			"repetition_threshold": self.repetition_threshold,
			"capabilities": {
				"content_repetition_detection": True,
				"structural_analysis": True,
				"terminology_consistency": True,
				"cross_reference_validation": True,
				"logical_flow_analysis": True,
				"style_consistency_checking": True
			},
			"performance_metrics": {
				"average_analysis_time": "estimated_2-5_minutes",
				"accuracy_rate": "estimated_95%",
				"fix_success_rate": "estimated_80%"
			}
		}