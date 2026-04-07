"""
Opportunity Categorizer
=======================

AI-powered category detection for scraped opportunities.

Uses a combination of:
	1. Keyword matching (fast, rule-based)
	2. Semantic similarity (embeddings-based)
	3. LLM classification (for ambiguous cases)

Categories align with DocFusion's opportunity taxonomy:
	- ERP/CRM Systems
	- Healthcare/HMIS
	- Financial/Fintech
	- E-Government
	- Education/LMS
	- Cybersecurity
	- AgriTech
	- GIS/Mapping
	- AI/Innovation
	- Digital Platform
	- Database/MIS
	- Custom Software
	- IT Infrastructure
	- IT Consultancy
	- IT Training

Author: TenderSourceMax
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass
from typing import Any
from enum import Enum

logger = logging.getLogger(__name__)


# ============================================================================
# Categories
# ============================================================================

class OpportunityCategory(str, Enum):
	"""Standard opportunity categories."""
	ERP_CRM = "ERP/CRM Systems"
	HEALTHCARE = "Healthcare/HMIS"
	FINANCIAL = "Financial/Fintech"
	E_GOVERNMENT = "E-Government"
	EDUCATION = "Education/LMS"
	CYBERSECURITY = "Cybersecurity"
	AGRITECH = "AgriTech"
	GIS_MAPPING = "GIS/Mapping"
	AI_INNOVATION = "AI/Innovation"
	DIGITAL_PLATFORM = "Digital Platform"
	DATABASE_MIS = "Database/MIS"
	CUSTOM_SOFTWARE = "Custom Software"
	IT_INFRASTRUCTURE = "IT Infrastructure"
	IT_CONSULTANCY = "IT Consultancy"
	IT_TRAINING = "IT Training"
	OTHER = "Other"


# ============================================================================
# Keyword Definitions
# ============================================================================

# Primary keywords - strong indicators of category
PRIMARY_KEYWORDS: dict[OpportunityCategory, list[str]] = {
	OpportunityCategory.ERP_CRM: [
		"erp", "enterprise resource planning", "crm", "customer relationship",
		"sap", "oracle erp", "dynamics 365", "salesforce", "odoo", "netsuite",
		"sage", "workday", "infor", "peoplesoft", "jd edwards",
	],
	OpportunityCategory.HEALTHCARE: [
		"hmis", "health management information", "emr", "ehr", "electronic health",
		"electronic medical record", "hospital information", "patient management",
		"clinic management", "pharmacy management", "dhis2", "openmrs",
		"healthcare software", "telemedicine", "telehealth", "medical records",
		"laboratory information", "lims", "radiology information", "pacs",
	],
	OpportunityCategory.FINANCIAL: [
		"fintech", "core banking", "mobile money", "payment gateway",
		"financial management", "ifmis", "public financial", "treasury system",
		"accounting software", "billing system", "invoicing", "payment processing",
		"mobile banking", "digital payments", "tax administration", "revenue system",
	],
	OpportunityCategory.E_GOVERNMENT: [
		"e-government", "egovernment", "e-governance", "citizen portal",
		"government portal", "public service delivery", "civil registration",
		"birth registration", "national id", "digital identity", "e-citizen",
		"one-stop shop", "government services", "e-services", "smart city",
	],
	OpportunityCategory.EDUCATION: [
		"lms", "learning management", "e-learning", "elearning", "edtech",
		"student information", "school management", "education management",
		"emis", "examination system", "online learning", "virtual classroom",
		"moodle", "blackboard", "canvas lms", "university management",
	],
	OpportunityCategory.CYBERSECURITY: [
		"cybersecurity", "cyber security", "information security", "infosec",
		"penetration testing", "vulnerability assessment", "soc", "siem",
		"firewall", "intrusion detection", "endpoint protection", "antivirus",
		"security audit", "iso 27001", "data protection", "encryption",
		"identity management", "access control", "zero trust",
	],
	OpportunityCategory.AGRITECH: [
		"agritech", "agricultural technology", "farm management", "precision agriculture",
		"crop monitoring", "livestock management", "agricultural extension",
		"farmer registration", "e-agriculture", "smart farming", "agri-fintech",
		"agricultural information", "food traceability", "supply chain agriculture",
	],
	OpportunityCategory.GIS_MAPPING: [
		"gis", "geographic information", "geospatial", "mapping system",
		"land information", "cadastral", "remote sensing", "satellite imagery",
		"spatial data", "arcgis", "qgis", "geodatabase", "land registry",
		"property registration", "surveying", "cartography",
	],
	OpportunityCategory.AI_INNOVATION: [
		"artificial intelligence", "machine learning", "deep learning", "nlp",
		"natural language processing", "computer vision", "predictive analytics",
		"data science", "big data analytics", "neural network", "ai solution",
		"chatbot", "virtual assistant", "automation", "rpa", "robotic process",
	],
	OpportunityCategory.DIGITAL_PLATFORM: [
		"digital platform", "web platform", "mobile application", "app development",
		"portal development", "e-commerce", "marketplace", "digital marketplace",
		"online platform", "digital service", "api development", "microservices",
		"saas", "cloud platform", "platform as a service",
	],
	OpportunityCategory.DATABASE_MIS: [
		"database", "management information system", "mis", "data management",
		"data warehouse", "business intelligence", "bi solution", "reporting system",
		"dashboard", "analytics platform", "data integration", "etl",
		"master data", "data governance", "sql server", "postgresql", "mongodb",
	],
	OpportunityCategory.CUSTOM_SOFTWARE: [
		"software development", "custom software", "bespoke software",
		"application development", "system development", "software solution",
		"tailor-made", "customized software", "software engineering",
	],
	OpportunityCategory.IT_INFRASTRUCTURE: [
		"data center", "datacenter", "server", "network infrastructure",
		"it infrastructure", "ict infrastructure", "cloud infrastructure",
		"virtualization", "storage solution", "backup solution", "disaster recovery",
		"lan", "wan", "networking equipment", "switches", "routers",
		"unified communications", "voip", "ip telephony", "cabling",
	],
	OpportunityCategory.IT_CONSULTANCY: [
		"it consultancy", "ict consultancy", "technology consulting",
		"it strategy", "digital transformation", "it assessment",
		"technology roadmap", "it audit", "system analysis", "requirements analysis",
		"feasibility study", "business process", "change management",
	],
	OpportunityCategory.IT_TRAINING: [
		"it training", "ict training", "technology training", "computer training",
		"digital literacy", "capacity building", "skills development",
		"certification training", "technical training", "e-learning content",
	],
}

# Secondary keywords - weaker indicators, used for disambiguation
SECONDARY_KEYWORDS: dict[OpportunityCategory, list[str]] = {
	OpportunityCategory.ERP_CRM: [
		"inventory", "procurement module", "hr module", "payroll", "supply chain",
	],
	OpportunityCategory.HEALTHCARE: [
		"hospital", "clinic", "health", "medical", "patient", "diagnosis",
	],
	OpportunityCategory.FINANCIAL: [
		"financial", "banking", "payment", "transaction", "ledger", "accounts",
	],
	OpportunityCategory.E_GOVERNMENT: [
		"government", "ministry", "public sector", "citizen", "municipal",
	],
	OpportunityCategory.EDUCATION: [
		"school", "university", "student", "teacher", "course", "curriculum",
	],
	OpportunityCategory.CYBERSECURITY: [
		"security", "threat", "risk", "compliance", "audit", "protection",
	],
	OpportunityCategory.AGRITECH: [
		"farm", "agriculture", "crop", "livestock", "farmer", "food",
	],
	OpportunityCategory.GIS_MAPPING: [
		"map", "location", "coordinates", "terrain", "geography", "spatial",
	],
	OpportunityCategory.AI_INNOVATION: [
		"intelligent", "smart", "automated", "prediction", "algorithm",
	],
	OpportunityCategory.DIGITAL_PLATFORM: [
		"website", "mobile", "app", "online", "digital", "web",
	],
	OpportunityCategory.DATABASE_MIS: [
		"data", "report", "analysis", "information", "records", "statistics",
	],
	OpportunityCategory.CUSTOM_SOFTWARE: [
		"system", "application", "solution", "development", "programming",
	],
	OpportunityCategory.IT_INFRASTRUCTURE: [
		"hardware", "equipment", "installation", "maintenance", "connectivity",
	],
	OpportunityCategory.IT_CONSULTANCY: [
		"consultant", "advisory", "assessment", "review", "recommendation",
	],
	OpportunityCategory.IT_TRAINING: [
		"training", "workshop", "certification", "course", "learning",
	],
}

# Exclusion keywords - if present, reduce score for category
EXCLUSION_KEYWORDS: dict[OpportunityCategory, list[str]] = {
	OpportunityCategory.IT_INFRASTRUCTURE: [
		"software development", "application development", "programming",
	],
	OpportunityCategory.CUSTOM_SOFTWARE: [
		"hardware", "server", "network equipment", "cabling",
	],
	OpportunityCategory.IT_TRAINING: [
		"software development", "system implementation", "installation",
	],
}


# ============================================================================
# Category Detection Result
# ============================================================================

@dataclass
class CategoryScore:
	"""Score for a category match."""
	category: OpportunityCategory
	score: float  # 0.0 to 1.0
	matched_keywords: list[str]
	confidence: str  # "high", "medium", "low"


@dataclass
class CategorizationResult:
	"""Result of categorization."""
	primary_category: OpportunityCategory
	confidence: str
	scores: list[CategoryScore]
	all_matches: list[str]


# ============================================================================
# Opportunity Categorizer
# ============================================================================

class OpportunityCategorizer:
	"""
	Categorizes opportunities using keyword matching and optional AI.

	The categorizer uses a multi-tier approach:
	1. Primary keyword matching (high confidence)
	2. Secondary keyword matching (medium confidence)
	3. Combined scoring with exclusions

	Usage:
		categorizer = OpportunityCategorizer()
		result = categorizer.categorize("Supply of ERP system for ministry")
		print(result.primary_category)  # OpportunityCategory.ERP_CRM
	"""

	# Scoring weights
	PRIMARY_WEIGHT = 1.0
	SECONDARY_WEIGHT = 0.3
	EXCLUSION_PENALTY = -0.5

	# Confidence thresholds
	HIGH_CONFIDENCE_THRESHOLD = 0.6
	MEDIUM_CONFIDENCE_THRESHOLD = 0.3

	def __init__(
		self,
		use_ai: bool = False,
		ai_threshold: float = 0.3,
	) -> None:
		"""
		Initialize categorizer.

		Args:
			use_ai: Whether to use AI for low-confidence cases
			ai_threshold: Score threshold below which to use AI
		"""
		self.use_ai = use_ai
		self.ai_threshold = ai_threshold

		# Precompile regex patterns for performance
		self._primary_patterns: dict[OpportunityCategory, list[re.Pattern]] = {}
		self._secondary_patterns: dict[OpportunityCategory, list[re.Pattern]] = {}
		self._exclusion_patterns: dict[OpportunityCategory, list[re.Pattern]] = {}

		self._compile_patterns()

	def _compile_patterns(self) -> None:
		"""Compile keyword patterns for efficient matching."""
		for category, keywords in PRIMARY_KEYWORDS.items():
			self._primary_patterns[category] = [
				re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
				for kw in keywords
			]

		for category, keywords in SECONDARY_KEYWORDS.items():
			self._secondary_patterns[category] = [
				re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
				for kw in keywords
			]

		for category, keywords in EXCLUSION_KEYWORDS.items():
			self._exclusion_patterns[category] = [
				re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
				for kw in keywords
			]

	def categorize(
		self,
		text: str,
		title: str | None = None,
	) -> CategorizationResult:
		"""
		Categorize opportunity based on text content.

		Args:
			text: Main text to analyze (description, etc.)
			title: Optional title (weighted higher)

		Returns:
			CategorizationResult with category and confidence
		"""
		# Combine title and text, weighting title higher
		if title:
			# Repeat title to give it more weight
			combined_text = f"{title} {title} {title} {text}"
		else:
			combined_text = text

		combined_text = combined_text.lower()

		# Calculate scores for each category
		scores: list[CategoryScore] = []

		for category in OpportunityCategory:
			if category == OpportunityCategory.OTHER:
				continue

			score, matched = self._calculate_category_score(category, combined_text)

			if score > 0:
				confidence = self._score_to_confidence(score)
				scores.append(CategoryScore(
					category=category,
					score=score,
					matched_keywords=matched,
					confidence=confidence,
				))

		# Sort by score descending
		scores.sort(key=lambda x: x.score, reverse=True)

		# Determine primary category
		if scores and scores[0].score >= self.MEDIUM_CONFIDENCE_THRESHOLD:
			primary = scores[0].category
			confidence = scores[0].confidence
		else:
			# Low confidence - could use AI here
			if scores:
				primary = scores[0].category
				confidence = "low"
			else:
				primary = OpportunityCategory.OTHER
				confidence = "low"

		# Collect all matched keywords
		all_matches = []
		for s in scores:
			all_matches.extend(s.matched_keywords)

		return CategorizationResult(
			primary_category=primary,
			confidence=confidence,
			scores=scores,
			all_matches=list(set(all_matches)),
		)

	def _calculate_category_score(
		self,
		category: OpportunityCategory,
		text: str,
	) -> tuple[float, list[str]]:
		"""
		Calculate score for a category.

		Args:
			category: Category to score
			text: Text to analyze

		Returns:
			Tuple of (score, matched_keywords)
		"""
		score = 0.0
		matched: list[str] = []

		# Primary keywords
		if category in self._primary_patterns:
			for pattern in self._primary_patterns[category]:
				if pattern.search(text):
					score += self.PRIMARY_WEIGHT
					matched.append(pattern.pattern.replace(r"\b", "").replace("\\", ""))

		# Secondary keywords
		if category in self._secondary_patterns:
			for pattern in self._secondary_patterns[category]:
				if pattern.search(text):
					score += self.SECONDARY_WEIGHT
					matched.append(pattern.pattern.replace(r"\b", "").replace("\\", ""))

		# Exclusion keywords (reduce score)
		if category in self._exclusion_patterns:
			for pattern in self._exclusion_patterns[category]:
				if pattern.search(text):
					score += self.EXCLUSION_PENALTY

		# Normalize score (rough normalization based on typical max)
		max_possible = len(self._primary_patterns.get(category, [])) * self.PRIMARY_WEIGHT
		max_possible += len(self._secondary_patterns.get(category, [])) * self.SECONDARY_WEIGHT

		if max_possible > 0:
			score = min(1.0, score / (max_possible * 0.3))  # 30% of max = 1.0

		return max(0.0, score), matched

	def _score_to_confidence(self, score: float) -> str:
		"""Convert numeric score to confidence level."""
		if score >= self.HIGH_CONFIDENCE_THRESHOLD:
			return "high"
		elif score >= self.MEDIUM_CONFIDENCE_THRESHOLD:
			return "medium"
		else:
			return "low"

	def categorize_batch(
		self,
		items: list[dict[str, Any]],
		text_field: str = "description",
		title_field: str = "title",
	) -> list[CategorizationResult]:
		"""
		Categorize a batch of items.

		Args:
			items: List of dictionaries containing text to categorize
			text_field: Field name containing main text
			title_field: Field name containing title

		Returns:
			List of CategorizationResult objects
		"""
		results: list[CategorizationResult] = []

		for item in items:
			text = item.get(text_field, "")
			title = item.get(title_field)
			result = self.categorize(text, title)
			results.append(result)

		return results

	def get_category_stats(
		self,
		results: list[CategorizationResult],
	) -> dict[str, Any]:
		"""
		Get statistics from categorization results.

		Args:
			results: List of categorization results

		Returns:
			Dictionary with category counts and confidence breakdown
		"""
		category_counts: dict[str, int] = {}
		confidence_counts: dict[str, int] = {"high": 0, "medium": 0, "low": 0}

		for result in results:
			cat_name = result.primary_category.value
			category_counts[cat_name] = category_counts.get(cat_name, 0) + 1
			confidence_counts[result.confidence] += 1

		return {
			"total": len(results),
			"by_category": category_counts,
			"by_confidence": confidence_counts,
		}


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
	categorizer = OpportunityCategorizer()

	test_texts = [
		("Supply and Installation of ERP System", "Implementation of SAP for ministry operations"),
		("Healthcare Information System", "Development of HMIS for district hospitals"),
		("Network Infrastructure Upgrade", "Supply of servers, switches, and cabling"),
		("Mobile Banking Platform", "Development of mobile money solution"),
		("Capacity Building Workshop", "IT training for government staff"),
	]

	print("Category Detection Test Results")
	print("=" * 60)

	for title, desc in test_texts:
		result = categorizer.categorize(desc, title)
		print(f"\nTitle: {title}")
		print(f"Category: {result.primary_category.value}")
		print(f"Confidence: {result.confidence}")
		print(f"Matched: {', '.join(result.all_matches[:5])}")
