"""
Feature Engineer

Extracts and engineers features from RFP requirements and compliance matrix
for use in scoring and win probability prediction models.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

# Import from completed dependencies
from ...rfp.requirement_extractor import Requirement, RequirementCategory, RequirementType
from ...rfp.compliance_matrix import ComplianceMatrix, ComplianceStatus


class EngineeredFeatures(BaseModel):
	"""
	Engineered features from RFP analysis.

	Contains all extracted and computed features for prediction models.
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	# Document-level features
	requirement_count: int = Field(default=0, ge=0, description="Total number of requirements")
	mandatory_count: int = Field(default=0, ge=0, description="Number of mandatory requirements")
	optional_count: int = Field(default=0, ge=0, description="Number of optional requirements")
	conditional_count: int = Field(default=0, ge=0, description="Number of conditional requirements")

	# Compliance features
	compliance_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Overall compliance rate")
	mandatory_compliance_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Mandatory compliance rate")
	optional_compliance_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Optional compliance rate")
	coverage_percentage: float = Field(default=0.0, ge=0.0, le=100.0, description="Coverage percentage")

	# Requirement type distribution
	technical_requirement_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of technical requirements")
	functional_requirement_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of functional requirements")
	performance_requirement_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of performance requirements")
	security_requirement_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of security requirements")
	compliance_requirement_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of compliance requirements")

	# Quality features
	average_confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Average extraction confidence")
	requirement_completeness: float = Field(default=0.0, ge=0.0, le=1.0, description="Completeness of requirements")
	cross_reference_count: int = Field(default=0, ge=0, description="Number of cross-references")

	# Section-level features (keyed by section type)
	section_features: Dict[str, Dict[str, float]] = Field(
		default_factory=dict,
		description="Section-specific feature dictionaries"
	)

	# Gap analysis features
	gap_count: int = Field(default=0, ge=0, description="Number of compliance gaps")
	critical_gap_count: int = Field(default=0, ge=0, description="Number of critical gaps")
	gap_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Ratio of gaps to total requirements")

	# Temporal features
	requirements_per_section: float = Field(default=0.0, ge=0, description="Average requirements per section")
	requirement_density: float = Field(default=0.0, ge=0, description="Requirement density score")

	# Metadata
	feature_version: str = Field(default="1.0.0", description="Version of feature engineering")
	extracted_at: datetime = Field(default_factory=datetime.now)
	metadata: Dict[str, Any] = Field(default_factory=dict)


@dataclass
class SectionFeatureConfig:
	"""Configuration for section-level feature extraction"""

	# Content quality weights
	word_count_weight: float = 0.15
	unique_concepts_weight: float = 0.10
	technical_depth_weight: float = 0.12
	clarity_weight: float = 0.10

	# Requirements alignment weights
	requirement_coverage_weight: float = 0.15
	compliance_weight: float = 0.12

	# Evidence weights
	quantitative_evidence_weight: float = 0.08
	case_study_weight: float = 0.08
	reference_quality_weight: float = 0.05

	# Team/experience weights
	team_expertise_weight: float = 0.05
	past_performance_weight: float = 0.05

	# Innovation/differentiation weights
	innovation_weight: float = 0.03
	differentiation_weight: float = 0.02

	# Risk weights
	risk_identification_weight: float = 0.05
	mitigation_quality_weight: float = 0.05


class FeatureEngineer:
	"""
	Engineers features from RFP requirements and compliance matrix.

	Extracts meaningful features for machine learning models including:
	- Section-level features from requirements
	- Compliance features from compliance matrix
	- Gap analysis features
	- Quality and completeness features
	"""

	def __init__(self, config: Dict[str, Any] | None = None):
		"""
		Initialize the feature engineer.

		Args:
			config: Optional configuration dictionary
		"""
		self.config = config or self._get_default_config()
		self.section_config = SectionFeatureConfig()
		self.logger = logging.getLogger(__name__)
		self._log_initialization()

	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			"normalize_features": True,
			"include_temporal": True,
			"section_weight_adjustment": {
				"technical_approach": 1.2,
				"management_approach": 1.0,
				"past_performance": 1.1,
				"price_cost": 1.3,
			},
			"quality_thresholds": {
				"min_confidence": 0.3,
				"min_completeness": 0.5,
			},
		}

	def _log_initialization(self) -> None:
		"""Log initialization"""
		self.logger.info("FeatureEngineer initialized")

	def extract_features(
		self,
		requirements: List[Requirement],
		compliance_matrix: ComplianceMatrix | None = None
	) -> EngineeredFeatures:
		"""
		Extract features from requirements and compliance matrix.

		Args:
			requirements: List of extracted requirements
			compliance_matrix: Optional compliance matrix

		Returns:
			EngineeredFeatures with all extracted features
		"""
		features = EngineeredFeatures()

		# Extract document-level features
		self._extract_requirement_features(requirements, features)

		# Extract compliance features if matrix provided
		if compliance_matrix:
			self._extract_compliance_features(compliance_matrix, features)

		# Extract gap analysis features
		self._extract_gap_features(requirements, features)

		# Extract section-level features
		self._extract_section_features(requirements, compliance_matrix, features)

		# Calculate derived features
		self._calculate_derived_features(features)

		# Normalize if configured
		if self.config["normalize_features"]:
			self._normalize_features(features)

		features.extracted_at = datetime.now()
		return features

	def _extract_requirement_features(
		self,
		requirements: List[Requirement],
		features: EngineeredFeatures
	) -> None:
		"""Extract features from requirements list"""
		if not requirements:
			return

		features.requirement_count = len(requirements)

		# Category counts
		for req in requirements:
			if req.category == RequirementCategory.MANDATORY:
				features.mandatory_count += 1
			elif req.category == RequirementCategory.OPTIONAL:
				features.optional_count += 1
			elif req.category == RequirementCategory.CONDITIONAL:
				features.conditional_count += 1

		# Type distribution
		type_counts: Dict[str, int] = {}
		for req in requirements:
			req_type = req.requirement_type.value
			type_counts[req_type] = type_counts.get(req_type, 0) + 1

		total = len(requirements)
		features.technical_requirement_ratio = type_counts.get("technical", 0) / total
		features.functional_requirement_ratio = type_counts.get("functional", 0) / total
		features.performance_requirement_ratio = type_counts.get("performance", 0) / total
		features.security_requirement_ratio = type_counts.get("security", 0) / total
		features.compliance_requirement_ratio = type_counts.get("compliance", 0) / total

		# Quality features
		confidences = [req.confidence for req in requirements]
		features.average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

		# Cross-references
		for req in requirements:
			features.cross_reference_count += len(req.cross_references)

		# Completeness (based on confidence and presence of source location)
		complete_count = sum(
			1 for req in requirements
			if req.confidence >= self.config["quality_thresholds"]["min_confidence"]
			and req.source_location
		)
		features.requirement_completeness = complete_count / total if total > 0 else 0.0

		# Requirements per section
		sections: Dict[str, int] = {}
		for req in requirements:
			section = req.section or "unknown"
			sections[section] = sections.get(section, 0) + 1

		if sections:
			features.requirements_per_section = len(requirements) / len(sections)

		# Requirement density (complexity metric)
		# Higher density = more requirements in fewer sections = higher complexity
		if len(sections) > 0:
			avg_per_section = len(requirements) / len(sections)
			variance = sum(
				(count - avg_per_section) ** 2
				for count in sections.values()
			) / len(sections)
			features.requirement_density = min(1.0, (avg_per_section * 0.1) + (variance * 0.01))

	def _extract_compliance_features(
		self,
		compliance_matrix: ComplianceMatrix,
		features: EngineeredFeatures
	) -> None:
		"""Extract features from compliance matrix"""
		summary = compliance_matrix.get_summary()

		features.compliance_rate = summary["coverage_percentage"] / 100.0
		features.coverage_percentage = summary["coverage_percentage"]

		# Calculate compliance rates by category
		mappings = compliance_matrix.mappings

		# Mandatory compliance
		mandatory_mappings = [
			m for m in mappings
			if m.category == RequirementCategory.MANDATORY
		]
		if mandatory_mappings:
			addressed = sum(
				1 for m in mandatory_mappings
				if m.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED)
			)
			features.mandatory_compliance_rate = addressed / len(mandatory_mappings)

		# Optional compliance
		optional_mappings = [
			m for m in mappings
			if m.category == RequirementCategory.OPTIONAL
		]
		if optional_mappings:
			addressed = sum(
				1 for m in optional_mappings
				if m.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED)
			)
			features.optional_compliance_rate = addressed / len(optional_mappings)

	def _extract_gap_features(
		self,
		requirements: List[Requirement],
		features: EngineeredFeatures
	) -> None:
		"""Extract gap analysis features"""
		# Count requirements without complete information
		incomplete_count = sum(
			1 for req in requirements
			if req.confidence < self.config["quality_thresholds"]["min_confidence"]
			or not req.source_location
		)

		features.gap_count = incomplete_count
		features.gap_ratio = incomplete_count / len(requirements) if requirements else 0.0

		# Critical gaps (low confidence mandatory requirements)
		critical_count = sum(
			1 for req in requirements
			if req.category == RequirementCategory.MANDATORY
			and req.confidence < self.config["quality_thresholds"]["min_confidence"]
		)
		features.critical_gap_count = critical_count

	def _extract_section_features(
		self,
		requirements: List[Requirement],
		compliance_matrix: ComplianceMatrix | None,
		features: EngineeredFeatures
	) -> None:
		"""Extract section-level features"""

		# Group requirements by section
		section_requirements: Dict[str, List[Requirement]] = {}
		for req in requirements:
			section = req.section or "unknown"
			if section not in section_requirements:
				section_requirements[section] = []
			section_requirements[section].append(req)

		# Calculate features for each section
		for section, reqs in section_requirements.items():
			section_key = self._normalize_section_name(section)
			section_feat = self._calculate_section_features(reqs, compliance_matrix)
			features.section_features[section_key] = section_feat

	def _calculate_section_features(
		self,
		requirements: List[Requirement],
		compliance_matrix: ComplianceMatrix | None
	) -> Dict[str, float]:
		"""Calculate features for a single section"""

		# Basic counts
		req_count = len(requirements)
		mandatory_count = sum(
			1 for r in requirements
			if r.category == RequirementCategory.MANDATORY
		)

		# Average confidence
		avg_confidence = sum(r.confidence for r in requirements) / req_count if req_count > 0 else 0.0

		# Type distribution within section
		technical_ratio = sum(
			1 for r in requirements
			if r.requirement_type == RequirementType.TECHNICAL
		) / req_count if req_count > 0 else 0.0

		functional_ratio = sum(
			1 for r in requirements
			if r.requirement_type == RequirementType.FUNCTIONAL
		) / req_count if req_count > 0 else 0.0

		# Compliance within section (if matrix available)
		compliance_rate = 0.0
		if compliance_matrix:
			section_mappings = [
				m for m in compliance_matrix.mappings
				if any(m.requirement_id == r.id for r in requirements)
			]
			if section_mappings:
				addressed = sum(
					1 for m in section_mappings
					if m.status in (ComplianceStatus.ADDRESSED, ComplianceStatus.VERIFIED)
				)
				compliance_rate = addressed / len(section_mappings)

		# Cross-reference density
		total_refs = sum(len(r.cross_references) for r in requirements)
		ref_density = total_refs / req_count if req_count > 0 else 0.0

		# Estimated section scores (heuristic)
		technical_depth_score = min(1.0, technical_ratio * 2.0 + avg_confidence * 0.5)
		clarity_score = avg_confidence
		requirement_coverage_ratio = compliance_rate
		compliance_score = compliance_rate

		# Estimated quality metrics
		word_count_estimate = sum(len(r.text.split()) for r in requirements)
		unique_concepts_estimate = len(set(
			word for r in requirements
			for word in r.text.lower().split()
			if len(word) > 3
		))

		return {
			"requirement_count": float(req_count),
			"mandatory_count": float(mandatory_count),
			"average_confidence": avg_confidence,
			"technical_ratio": technical_ratio,
			"functional_ratio": functional_ratio,
			"compliance_rate": compliance_rate,
			"cross_reference_density": ref_density,
			"technical_depth_score": technical_depth_score,
			"clarity_score": clarity_score,
			"requirement_coverage_ratio": requirement_coverage_ratio,
			"compliance_score": compliance_score,
			"word_count": float(word_count_estimate),
			"unique_concepts_count": float(unique_concepts_estimate),
			"quantitative_evidence_count": float(total_refs),  # Use cross-refs as proxy
			"section_completion_percentage": compliance_rate,  # Use compliance as proxy
		}

	def _normalize_section_name(self, section: str) -> str:
		"""Normalize section name to standard format"""
		section_lower = section.lower()

		# Map common section names
		section_mappings = {
			"technical": "technical_approach",
			"technical approach": "technical_approach",
			"management": "management_approach",
			"management approach": "management_approach",
			"past performance": "past_performance",
			"experience": "past_performance",
			"personnel": "personnel_qualifications",
			"qualifications": "personnel_qualifications",
			"price": "price_cost",
			"cost": "price_cost",
			"pricing": "price_cost",
			"security": "risk_management",
			"risk": "risk_management",
		}

		for key, value in section_mappings.items():
			if key in section_lower:
				return value

		# Default to normalized version
		return section_lower.replace(" ", "_").replace("-", "_")

	def _calculate_derived_features(self, features: EngineeredFeatures) -> None:
		"""Calculate derived features from raw features"""

		# Requirement complexity score
		if features.requirement_count > 0:
			complexity = (
				features.technical_requirement_ratio * 0.3 +
				features.security_requirement_ratio * 0.25 +
				features.performance_requirement_ratio * 0.2 +
				features.compliance_requirement_ratio * 0.15 +
				features.functional_requirement_ratio * 0.1
			)
			features.metadata["complexity_score"] = complexity

		# Quality score
		quality = (
			features.average_confidence * 0.4 +
			features.requirement_completeness * 0.3 +
			(1 - features.gap_ratio) * 0.3
		)
		features.metadata["quality_score"] = quality

		# Compliance health score
		if features.compliance_rate > 0:
			health = (
				features.compliance_rate * 0.5 +
				features.mandatory_compliance_rate * 0.3 +
				features.optional_compliance_rate * 0.2
			)
			features.metadata["compliance_health"] = health

	def _normalize_features(self, features: EngineeredFeatures) -> None:
		"""Normalize features to standard ranges"""

		# Normalize counts by logarithmic scaling
		if features.requirement_count > 0:
			import math
			features.metadata["log_requirement_count"] = math.log1p(features.requirement_count)

		if features.cross_reference_count > 0:
			import math
			features.metadata["log_cross_ref_count"] = math.log1p(features.cross_reference_count)

	def get_section_features(
		self,
		requirements: List[Requirement],
		compliance_matrix: ComplianceMatrix | None,
		section_type: str
	) -> Dict[str, float]:
		"""
		Get features for a specific section type.

		Args:
			requirements: List of requirements
			compliance_matrix: Optional compliance matrix
			section_type: Section type to get features for

		Returns:
			Dictionary of section features
		"""
		# Filter requirements by section
		section_reqs = [
			req for req in requirements
			if self._normalize_section_name(req.section) == section_type
		]

		if not section_reqs:
			# Return default features
			return self._get_default_section_features()

		return self._calculate_section_features(section_reqs, compliance_matrix)

	def _get_default_section_features(self) -> Dict[str, float]:
		"""Get default section features when no data available"""
		return {
			"requirement_count": 0.0,
			"mandatory_count": 0.0,
			"average_confidence": 0.5,
			"technical_ratio": 0.0,
			"functional_ratio": 0.0,
			"compliance_rate": 0.0,
			"cross_reference_density": 0.0,
			"technical_depth_score": 0.5,
			"clarity_score": 0.5,
			"requirement_coverage_ratio": 0.0,
			"compliance_score": 0.0,
			"word_count": 0.0,
			"unique_concepts_count": 0.0,
			"quantitative_evidence_count": 0.0,
			"section_completion_percentage": 0.0,
		}

	def compute_section_score_features(
		self,
		requirements: List[Requirement],
		compliance_matrix: ComplianceMatrix | None,
		section_type: str
	) -> Dict[str, float]:
		"""
		Compute features specifically for section score prediction.

		This matches the SectionFeatures model from scoring_predictor.py.

		Args:
			requirements: List of requirements
			compliance_matrix: Optional compliance matrix
			section_type: Section type for features

		Returns:
			Dictionary matching SectionFeatures fields
		"""
		section_features = self.get_section_features(
			requirements, compliance_matrix, section_type
		)

		# Map to SectionFeatures fields
		return {
			"word_count": section_features.get("word_count", 1000.0),
			"unique_concepts_count": section_features.get("unique_concepts_count", 10.0),
			"technical_depth_score": section_features.get("technical_depth_score", 0.5),
			"clarity_score": section_features.get("clarity_score", 0.5),
			"requirement_coverage_ratio": section_features.get("requirement_coverage_ratio", 0.5),
			"compliance_score": section_features.get("compliance_score", 0.5),
			"quantitative_evidence_count": section_features.get("quantitative_evidence_count", 3.0),
			"case_study_relevance": 0.5,  # Default value
			"reference_quality_score": section_features.get("average_confidence", 0.5),
			"team_expertise_match": 0.5,  # Default value
			"past_performance_relevance": 0.5,  # Default value
			"innovation_score": 0.5,  # Default value
			"differentiation_strength": 0.5,  # Default value
			"risk_identification_completeness": 0.5,  # Default value
			"mitigation_strategy_quality": 0.5,  # Default value
			"section_completion_percentage": section_features.get("section_completion_percentage", 0.5),
		}

	def compute_win_probability_features(
		self,
		requirements: List[Requirement],
		compliance_matrix: ComplianceMatrix | None,
		opportunity_data: Dict[str, Any] | None = None
	) -> Dict[str, float]:
		"""
		Compute features for win probability prediction.

		This matches the PredictionFeatures model from win_probability_predictor.py.

		Args:
			requirements: List of requirements
			compliance_matrix: Optional compliance matrix
			opportunity_data: Additional opportunity metadata

		Returns:
			Dictionary matching PredictionFeatures fields
		"""
		features = self.extract_features(requirements, compliance_matrix)

		# Map to PredictionFeatures fields
		return {
			"opportunity_value": opportunity_data.get("opportunity_value", 0.0) if opportunity_data else 0.0,
			"submission_days_remaining": opportunity_data.get("submission_days_remaining", 30) if opportunity_data else 30,
			"requirements_complexity": features.metadata.get("complexity_score", 0.5),
			"capability_match_score": opportunity_data.get("capability_match_score", 0.5) if opportunity_data else 0.5,
			"past_performance_score": features.compliance_rate,
			"team_experience_score": opportunity_data.get("team_experience_score", 0.5) if opportunity_data else 0.5,
			"competitive_intensity": opportunity_data.get("competitive_intensity", 0.5) if opportunity_data else 0.5,
			"incumbent_advantage": float(opportunity_data.get("incumbent_advantage", False)) if opportunity_data else 0.0,
			"estimated_competitors": opportunity_data.get("estimated_competitors", 5) if opportunity_data else 5,
			"market_familiarity": features.metadata.get("quality_score", 0.5),
			"industry_experience_years": opportunity_data.get("industry_experience_years", 5) if opportunity_data else 5,
			"client_relationship_score": features.coverage_percentage / 100.0,
			"strategic_importance": opportunity_data.get("strategic_importance", 0.5) if opportunity_data else 0.5,
			"resource_availability": opportunity_data.get("resource_availability", 0.5) if opportunity_data else 0.5,
			"pricing_competitiveness": opportunity_data.get("pricing_competitiveness", 0.5) if opportunity_data else 0.5,
		}

	def get_feature_importance_ranking(
		self,
		features: EngineeredFeatures
	) -> List[Tuple[str, float]]:
		"""
		Get feature importance ranking based on configuration.

		Args:
			features: Engineered features

		Returns:
			List of (feature_name, importance_score) tuples sorted by importance
		"""
		importance_scores = [
			("compliance_rate", features.compliance_rate * 0.15),
			("mandatory_compliance_rate", features.mandatory_compliance_rate * 0.12),
			("requirement_completeness", features.requirement_completeness * 0.10),
			("average_confidence", features.average_confidence * 0.10),
			("technical_requirement_ratio", features.technical_requirement_ratio * 0.08),
			("coverage_percentage", features.coverage_percentage / 100.0 * 0.08),
			("gap_ratio", (1 - features.gap_ratio) * 0.07),
			("requirement_count", min(1.0, features.requirement_count / 100) * 0.05),
			("functional_requirement_ratio", features.functional_requirement_ratio * 0.05),
			("security_requirement_ratio", features.security_requirement_ratio * 0.05),
		]

		# Sort by importance score descending
		return sorted(importance_scores, key=lambda x: x[1], reverse=True)


# Convenience factory function
def create_feature_engineer(
	config: Dict[str, Any] | None = None
) -> FeatureEngineer:
	"""
	Create a FeatureEngineer instance.

	Args:
		config: Optional configuration dictionary

	Returns:
		Configured FeatureEngineer instance
	"""
	return FeatureEngineer(config)