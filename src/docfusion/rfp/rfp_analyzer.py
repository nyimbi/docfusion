#!/usr/bin/env python3
"""
RFP Analyzer

Orchestrates comprehensive RFP document analysis including requirement extraction,
stakeholder mapping, compliance analysis, and cross-reference detection.
Integrates with existing NLP pipeline for enhanced analysis.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, ConfigDict

from ..core.utils import uuid7str
from .requirement_extractor import (
	RequirementExtractor,
	Requirement,
	RequirementCategory,
	RequirementType,
	RequirementExtractionResult,
)

class RFPAnalysisResult(BaseModel):
	"""Complete RFP analysis result"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	analysis_id: str = Field(default_factory=uuid7str)
	success: bool = Field(default=False)
	requirements: list[Requirement] = Field(default_factory=list)
	requirement_summary: dict[str, Any] = Field(default_factory=dict)
	document_metadata: dict[str, Any] = Field(default_factory=dict)
	cross_reference_analysis: dict[str, Any] = Field(default_factory=dict)
	compliance_indicators: list[dict[str, Any]] = Field(default_factory=list)
	risk_assessment: dict[str, Any] = Field(default_factory=dict)
	recommendations: list[str] = Field(default_factory=list)
	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	processing_time: float = Field(default=0.0)
	analyzed_at: datetime = Field(default_factory=datetime.now)

class RFPAnalyzer:
	"""
	RFP Document Analyzer.

	Orchestrates comprehensive analysis of RFP documents including:
	- Requirement extraction and classification
	- Cross-reference detection and validation
	- Compliance indicator identification
	- Risk assessment
	- Strategic recommendations

	Integration Points:
	- Uses DoclingService for document parsing
	- Integrates with existing NLP pipeline
	- Connects with stakeholder mapper for relationship analysis
	"""

	def __init__(self, config: dict[str, Any] | None = None):
		"""
		Initialize the RFP analyzer.

		Args:
			config: Optional configuration dictionary
		"""
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)

		# Initialize requirement extractor
		extractor_config = self.config.get("requirement_extractor_config")
		self.requirement_extractor = RequirementExtractor(extractor_config)

		self._log_analyzer_initialized()

	def _get_default_config(self) -> dict[str, Any]:
		"""Get default configuration"""
		return {
			"requirement_extractor_config": None,
			"analyze_compliance": True,
			"assess_risks": True,
			"generate_recommendations": True,
			"min_confidence_threshold": 0.5,
			"cross_reference_tolerance": 0.8,
			"compliance_standards": [
				"GDPR",
				"HIPAA",
				"SOX",
				"PCI-DSS",
				"ISO 27001",
				"NIST",
				"FedRAMP",
				"FISMA",
			],
			"risk_factors": {
				"high_complexity_keywords": [
					"integration",
					"migration",
					"legacy",
					"custom",
					"real-time",
				],
				"tight_timeline_indicators": [
					"immediately",
					"asap",
					"urgent",
					"within days",
					"short timeframe",
				],
				"compliance_keywords": [
					"audit",
					"certification",
					"accreditation",
					"regulatory",
				],
			},
		}

	def _log_analyzer_initialized(self) -> None:
		"""Log analyzer initialization"""
		self.logger.info("RFPAnalyzer initialized")

	def _log_analysis_start(self, document_type: str) -> None:
		"""Log analysis start"""
		self.logger.info(f"Starting RFP analysis for {document_type} document")

	def _log_analysis_complete(self, req_count: int, time: float) -> None:
		"""Log analysis completion"""
		self.logger.info(f"RFP analysis complete: {req_count} requirements in {time:.2f}s")

	async def analyze_pdf(
		self,
		content: bytes,
		document_metadata: dict[str, Any] | None = None,
	) -> RFPAnalysisResult:
		"""
		Analyze an RFP PDF document.

		Args:
			content: PDF document bytes
			document_metadata: Optional metadata about the document

		Returns:
			RFPAnalysisResult with complete analysis
		"""
		start_time = asyncio.get_event_loop().time()
		result = RFPAnalysisResult()

		try:
			self._log_analysis_start("PDF")

			# Extract requirements
			extraction_result = await self.requirement_extractor.extract_from_pdf(
				content, document_metadata
			)

			if not extraction_result.success:
				result.errors.extend(extraction_result.errors)
				result.warnings.extend(extraction_result.warnings)
				return result

			# Populate requirements
			result.requirements = extraction_result.requirements
			result.document_metadata = extraction_result.document_metadata

			# Perform additional analysis
			await self._analyze_requirements(result)
			await self._analyze_cross_references(result)
			await self._analyze_compliance(result)
			await self._assess_risks(result)
			await self._generate_recommendations(result)

			result.success = True

		except Exception as e:
			result.errors.append(f"PDF analysis failed: {str(e)}")
			self.logger.error(f"RFP PDF analysis error: {e}")

		result.processing_time = asyncio.get_event_loop().time() - start_time
		self._log_analysis_complete(len(result.requirements), result.processing_time)

		return result

	async def analyze_docx(
		self,
		content: bytes,
		document_metadata: dict[str, Any] | None = None,
	) -> RFPAnalysisResult:
		"""
		Analyze an RFP DOCX document.

		Args:
			content: DOCX document bytes
			document_metadata: Optional metadata about the document

		Returns:
			RFPAnalysisResult with complete analysis
		"""
		start_time = asyncio.get_event_loop().time()
		result = RFPAnalysisResult()

		try:
			self._log_analysis_start("DOCX")

			# Extract requirements
			extraction_result = await self.requirement_extractor.extract_from_docx(
				content, document_metadata
			)

			if not extraction_result.success:
				result.errors.extend(extraction_result.errors)
				result.warnings.extend(extraction_result.warnings)
				return result

			# Populate requirements
			result.requirements = extraction_result.requirements
			result.document_metadata = extraction_result.document_metadata

			# Perform additional analysis
			await self._analyze_requirements(result)
			await self._analyze_cross_references(result)
			await self._analyze_compliance(result)
			await self._assess_risks(result)
			await self._generate_recommendations(result)

			result.success = True

		except Exception as e:
			result.errors.append(f"DOCX analysis failed: {str(e)}")
			self.logger.error(f"RFP DOCX analysis error: {e}")

		result.processing_time = asyncio.get_event_loop().time() - start_time
		self._log_analysis_complete(len(result.requirements), result.processing_time)

		return result

	async def analyze_text(
		self,
		text: str,
		document_metadata: dict[str, Any] | None = None,
	) -> RFPAnalysisResult:
		"""
		Analyze RFP text content.

		Args:
			text: Plain text content
			document_metadata: Optional metadata about the document

		Returns:
			RFPAnalysisResult with complete analysis
		"""
		start_time = asyncio.get_event_loop().time()
		result = RFPAnalysisResult()

		try:
			self._log_analysis_start("text")

			# Extract requirements
			extraction_result = await self.requirement_extractor.extract_from_text(
				text, document_metadata
			)

			if not extraction_result.success:
				result.errors.extend(extraction_result.errors)
				result.warnings.extend(extraction_result.warnings)
				return result

			# Populate requirements
			result.requirements = extraction_result.requirements
			result.document_metadata = extraction_result.document_metadata

			# Perform additional analysis
			await self._analyze_requirements(result)
			await self._analyze_cross_references(result)
			await self._analyze_compliance(result)
			await self._assess_risks(result)
			await self._generate_recommendations(result)

			result.success = True

		except Exception as e:
			result.errors.append(f"Text analysis failed: {str(e)}")
			self.logger.error(f"RFP text analysis error: {e}")

		result.processing_time = asyncio.get_event_loop().time() - start_time
		self._log_analysis_complete(len(result.requirements), result.processing_time)

		return result

	async def _analyze_requirements(self, result: RFPAnalysisResult) -> None:
		"""Analyze extracted requirements and create summary"""
		if not result.requirements:
			return

		# Category distribution
		category_counts: dict[str, int] = {}
		for req in result.requirements:
			cat = req.category.value
			category_counts[cat] = category_counts.get(cat, 0) + 1

		# Type distribution
		type_counts: dict[str, int] = {}
		for req in result.requirements:
			t = req.requirement_type.value
			type_counts[t] = type_counts.get(t, 0) + 1

		# Confidence statistics
		confidences = [req.confidence for req in result.requirements]
		avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

		# Section distribution
		section_counts: dict[str, int] = {}
		for req in result.requirements:
			section = req.section or "Unknown"
			section_counts[section] = section_counts.get(section, 0) + 1

		# High-confidence requirements
		high_confidence = [req for req in result.requirements if req.confidence >= 0.8]

		# Requirements needing attention (low confidence or ambiguous)
		needs_attention = [req for req in result.requirements if req.confidence < 0.5]

		result.requirement_summary = {
			"total_requirements": len(result.requirements),
			"category_distribution": category_counts,
			"type_distribution": type_counts,
			"average_confidence": round(avg_confidence, 3),
			"high_confidence_count": len(high_confidence),
			"needs_attention_count": len(needs_attention),
			"section_distribution": section_counts,
			"mandatory_count": category_counts.get("mandatory", 0),
			"optional_count": category_counts.get("optional", 0),
			"conditional_count": category_counts.get("conditional", 0),
		}

	async def _analyze_cross_references(self, result: RFPAnalysisResult) -> None:
		"""Analyze cross-references between requirements"""
		if not result.requirements:
			return

		# Build cross-reference graph
		ref_graph: dict[str, list[str]] = {}
		ref_counts: dict[str, int] = {}

		for req in result.requirements:
			if req.cross_references:
				ref_graph[req.id] = req.cross_references
				for ref_id in req.cross_references:
					ref_counts[ref_id] = ref_counts.get(ref_id, 0) + 1

		# Find most referenced requirements
		most_referenced = sorted(ref_counts.items(), key=lambda x: x[1], reverse=True)[
			:10
		]

		# Find requirements with no references (potential orphans)
		orphan_count = sum(1 for req in result.requirements if not req.cross_references)

		# Find circular references
		circular_refs = self._find_circular_references(ref_graph)

		result.cross_reference_analysis = {
			"total_references": sum(len(refs) for refs in ref_graph.values()),
			"requirements_with_refs": len(ref_graph),
			"most_referenced": [
				{"requirement_id": rid, "reference_count": count}
				for rid, count in most_referenced
			],
			"orphan_requirements": orphan_count,
			"circular_references": circular_refs,
			"reference_graph_size": len(ref_graph),
		}

	def _find_circular_references(self, ref_graph: dict[str, list[str]]) -> list[list[str]]:
		"""Find circular reference chains"""
		circular: list[list[str]] = []
		visited: set[str] = set()

		def dfs(node: str, path: list[str]) -> None:
			if node in visited:
				return

			visited.add(node)
			path.append(node)

			for neighbor in ref_graph.get(node, []):
				if neighbor in path:
					# Found cycle
					cycle_start = path.index(neighbor)
					circular.append(path[cycle_start:])
				else:
					dfs(neighbor, path)

			path.pop()

		for node in ref_graph:
			if node not in visited:
				dfs(node, [])

		return circular

	async def _analyze_compliance(self, result: RFPAnalysisResult) -> None:
		"""Analyze compliance indicators in requirements"""
		if not result.requirements:
			return

		compliance_indicators: list[dict[str, Any]] = []

		for req in result.requirements:
			# Check for compliance standard mentions
			for standard in self.config["compliance_standards"]:
				if standard.lower() in req.text.lower():
					compliance_indicators.append(
						{
							"requirement_id": req.id,
							"standard": standard,
							"text_snippet": req.text[
								:200
							],  # First 200 chars
							"category": req.category.value,
							"confidence": req.confidence,
						}
					)

		# Deduplicate
		seen: set[str] = set()
		unique_indicators = []
		for indicator in compliance_indicators:
			key = f"{indicator['requirement_id']}:{indicator['standard']}"
			if key not in seen:
				seen.add(key)
				unique_indicators.append(indicator)

		result.compliance_indicators = unique_indicators

	async def _assess_risks(self, result: RFPAnalysisResult) -> None:
		"""Assess risks in the RFP"""
		risk_factors = self.config["risk_factors"]
		risks: dict[str, list[dict[str, Any]]] = {
			"high_complexity": [],
			"tight_timeline": [],
			"compliance": [],
			"low_confidence": [],
		}

		for req in result.requirements:
			text_lower = req.text.lower()

			# High complexity
			for keyword in risk_factors.get("high_complexity_keywords", []):
				if keyword in text_lower:
					risks["high_complexity"].append(
						{
							"requirement_id": req.id,
							"keyword": keyword,
							"text_snippet": req.text[:150],
						}
					)
					break

			# Tight timeline
			for keyword in risk_factors.get("tight_timeline_indicators", []):
				if keyword in text_lower:
					risks["tight_timeline"].append(
						{
							"requirement_id": req.id,
							"keyword": keyword,
							"text_snippet": req.text[:150],
						}
					)
					break

			# Low confidence
			if req.confidence < self.config["min_confidence_threshold"]:
				risks["low_confidence"].append(
					{
						"requirement_id": req.id,
						"confidence": req.confidence,
						"text_snippet": req.text[:150],
					}
				)

		# Calculate overall risk score
		risk_counts = {k: len(v) for k, v in risks.items()}
		total_risks = sum(risk_counts.values())
		risk_score = min(total_risks / max(len(result.requirements), 1), 1.0)

		result.risk_assessment = {
			"risk_factors": risk_counts,
			"total_risk_items": total_risks,
			"risk_score": round(risk_score, 3),
			"risk_level": self._get_risk_level(risk_score),
			"details": risks,
		}

	def _get_risk_level(self, risk_score: float) -> str:
		"""Convert risk score to level"""
		if risk_score < 0.2:
			return "low"
		elif risk_score < 0.4:
			return "medium"
		elif risk_score < 0.6:
			return "high"
		else:
			return "critical"

	async def _generate_recommendations(self, result: RFPAnalysisResult) -> None:
		"""Generate strategic recommendations"""
		recommendations: list[str] = []

		# Based on requirement distribution
		if result.requirement_summary:
			mandatory = result.requirement_summary.get("mandatory_count", 0)
			optional = result.requirement_summary.get("optional_count", 0)
			total = result.requirement_summary.get("total_requirements", 1)

			mandatory_ratio = mandatory / total if total > 0 else 0

			if mandatory_ratio > 0.8:
				recommendations.append(
					"High proportion of mandatory requirements detected. "
					"Consider negotiating flexibility on non-critical items."
				)

			if optional / total > 0.3:
				recommendations.append(
					"Significant optional requirements present. "
					"Prioritize based on competitive advantage."
				)

		# Based on cross-reference analysis
		if result.cross_reference_analysis:
			circular = result.cross_reference_analysis.get("circular_references", [])
			if circular:
				recommendations.append(
					f"Found {len(circular)} circular reference(s). "
					"Request clarification on requirement dependencies."
				)

			orphans = result.cross_reference_analysis.get("orphan_requirements", 0)
			if orphans > len(result.requirements) * 0.5:
				recommendations.append(
					"Many requirements lack cross-references. "
					"Verify requirements are properly scoped and documented."
				)

		# Based on compliance indicators
		compliance_standards = set(
			ind["standard"] for ind in result.compliance_indicators
		)
		if len(compliance_standards) > 3:
			recommendations.append(
				f"Multiple compliance standards detected ({', '.join(compliance_standards)}). "
				"Ensure team has necessary certifications and expertise."
			)

		# Based on risk assessment
		if result.risk_assessment:
			risk_level = result.risk_assessment.get("risk_level", "low")
			if risk_level in ("high", "critical"):
				recommendations.append(
					f"Risk level is {risk_level}. "
					"Consider additional due diligence and risk mitigation strategies."
				)

			high_complexity = result.risk_assessment.get("risk_factors", {}).get(
				"high_complexity", 0
			)
			if high_complexity > 5:
				recommendations.append(
					"Multiple high-complexity requirements identified. "
					"Allocate senior resources and consider technical spikes."
				)

		# Based on confidence scores
		low_confidence = [
			req for req in result.requirements if req.confidence < 0.5
		]
		if len(low_confidence) > len(result.requirements) * 0.2:
			recommendations.append(
				"Many requirements have low extraction confidence. "
				"Manual review recommended for critical sections."
			)

		result.recommendations = recommendations

	async def close(self) -> None:
		"""Close resources"""
		await self.requirement_extractor.close()

	def get_analyzer_info(self) -> dict[str, Any]:
		"""Get analyzer information and capabilities"""
		return {
			"version": "1.0.0",
			"capabilities": [
				"requirement_extraction",
				"cross_reference_analysis",
				"compliance_detection",
				"risk_assessment",
				"recommendation_generation",
			],
			"supported_formats": ["pdf", "docx", "text"],
			"compliance_standards": self.config["compliance_standards"],
			"extractor_info": self.requirement_extractor.get_extractor_info(),
		}

def create_rfp_analyzer(config: dict[str, Any] | None = None) -> RFPAnalyzer:
	"""Create RFPAnalyzer instance with configuration"""
	return RFPAnalyzer(config)