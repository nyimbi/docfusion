#!/usr/bin/env python3
"""
Opportunity Analyzer - Week 10 Implementation

Advanced opportunity classification and assessment system that analyzes
procurement opportunities for type, sector, value, competitive landscape,
timelines, and eligibility requirements.

Features:
- Multi-dimensional opportunity classification
- Competitive landscape assessment
- Timeline and deadline analysis
- Opportunity value estimation
- Eligibility requirement analysis
- Historical performance correlation
"""

import asyncio
import re
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple, Union, Set
from decimal import Decimal
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.naive_bayes import MultinomialNB
from sklearn.preprocessing import LabelEncoder
import pandas as pd

from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
import uuid

def uuid7str() -> str:
	"""Generate a UUID7-like string using UUID4"""
	return str(uuid.uuid4())


class OpportunityType(str, Enum):
	"""Types of procurement opportunities"""
	GOODS = "goods"
	SERVICES = "services"
	CONSTRUCTION = "construction"
	CONSULTING = "consulting"
	SOFTWARE = "software"
	MAINTENANCE = "maintenance"
	RESEARCH = "research"
	TRAINING = "training"
	DESIGN = "design"
	UNKNOWN = "unknown"


class OpportunitySector(str, Enum):
	"""Market sectors for opportunities"""
	GOVERNMENT_FEDERAL = "government_federal"
	GOVERNMENT_STATE = "government_state"
	GOVERNMENT_LOCAL = "government_local"
	DEFENSE = "defense"
	HEALTHCARE = "healthcare"
	EDUCATION = "education"
	FINANCE = "finance"
	ENERGY = "energy"
	TECHNOLOGY = "technology"
	INFRASTRUCTURE = "infrastructure"
	AEROSPACE = "aerospace"
	MANUFACTURING = "manufacturing"
	UNKNOWN = "unknown"


class CompetitionLevel(str, Enum):
	"""Competition intensity levels"""
	LOW = "low"			# 1-3 competitors expected
	MODERATE = "moderate"	# 4-8 competitors expected
	HIGH = "high"		# 9-15 competitors expected
	INTENSE = "intense"	# 15+ competitors expected
	UNKNOWN = "unknown"


class OpportunityClassification(BaseModel):
	"""Opportunity classification results"""
	type: OpportunityType
	sector: OpportunitySector
	complexity: str = Field(description="low, medium, high, expert")
	duration: Optional[str] = Field(None, description="Duration estimate in months")
	geographic_scope: str = Field(description="local, regional, national, international")
	contract_vehicle: Optional[str] = Field(None, description="GSA, SEWP, CIO-SP3, etc.")
	set_aside: Optional[str] = Field(None, description="Small business, veteran, etc.")
	confidence_score: float = Field(ge=0.0, le=1.0)
	classification_reasons: List[str] = Field(default_factory=list)


class CompetitiveAssessment(BaseModel):
	"""Competitive landscape analysis"""
	competition_level: CompetitionLevel
	expected_competitors: int = Field(ge=0)
	key_competitors: List[str] = Field(default_factory=list)
	competitive_advantages: List[str] = Field(default_factory=list)
	competitive_risks: List[str] = Field(default_factory=list)
	incumbent_advantage: bool = False
	incumbent_name: Optional[str] = None
	market_dynamics: Dict[str, Any] = Field(default_factory=dict)
	assessment_confidence: float = Field(ge=0.0, le=1.0)


class TimelineAnalysis(BaseModel):
	"""Timeline and deadline analysis"""
	proposal_deadline: Optional[datetime] = None
	questions_deadline: Optional[datetime] = None
	pre_proposal_conference: Optional[datetime] = None
	award_date: Optional[datetime] = None
	performance_start: Optional[datetime] = None
	performance_end: Optional[datetime] = None
	preparation_time_days: Optional[int] = None
	critical_milestones: List[Dict[str, Any]] = Field(default_factory=list)
	timeline_risks: List[str] = Field(default_factory=list)
	timeline_confidence: float = Field(ge=0.0, le=1.0)


class ValueEstimation(BaseModel):
	"""Opportunity value analysis"""
	estimated_value: Optional[Decimal] = None
	value_range_min: Optional[Decimal] = None
	value_range_max: Optional[Decimal] = None
	value_confidence: float = Field(ge=0.0, le=1.0)
	value_source: str = Field(description="stated, estimated, comparable")
	funding_type: str = Field(description="appropriated, fee-for-service, etc.")
	payment_terms: Optional[str] = None
	pricing_model: str = Field(description="fixed_price, cost_plus, time_materials")
	economic_factors: Dict[str, Any] = Field(default_factory=dict)


class EligibilityAnalysis(BaseModel):
	"""Eligibility and qualification requirements"""
	minimum_requirements: List[str] = Field(default_factory=list)
	preferred_qualifications: List[str] = Field(default_factory=list)
	security_clearance_required: Optional[str] = None
	certifications_required: List[str] = Field(default_factory=list)
	past_performance_requirements: List[str] = Field(default_factory=list)
	financial_requirements: Dict[str, Any] = Field(default_factory=dict)
	geographic_restrictions: List[str] = Field(default_factory=list)
	eligibility_score: float = Field(ge=0.0, le=1.0, description="How well we meet requirements")
	qualification_gaps: List[str] = Field(default_factory=list)


class OpportunityAnalysis(BaseModel):
	"""Complete opportunity analysis result"""
	opportunity_id: str = Field(default_factory=uuid7str)
	analysis_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	
	# Core analysis components
	classification: OpportunityClassification
	competitive_assessment: CompetitiveAssessment
	timeline_analysis: TimelineAnalysis
	value_estimation: ValueEstimation
	eligibility_analysis: EligibilityAnalysis
	
	# Overall scores and recommendations
	overall_attractiveness: float = Field(ge=0.0, le=1.0)
	strategic_alignment: float = Field(ge=0.0, le=1.0)
	win_probability_estimate: float = Field(ge=0.0, le=1.0)
	recommendation: str = Field(description="pursue, monitor, decline")
	recommendation_reasons: List[str] = Field(default_factory=list)
	
	# Analysis metadata
	analysis_confidence: float = Field(ge=0.0, le=1.0)
	data_quality_score: float = Field(ge=0.0, le=1.0)
	analysis_version: str = "1.0"


class OpportunityAnalyzer:
	"""
	Advanced opportunity analysis engine with ML-powered classification
	"""
	
	def __init__(self, 
				 model_cache_dir: Optional[Path] = None,
				 competitive_intelligence_db: Optional[Path] = None):
		
		self.logger = logging.getLogger(__name__)
		self.model_cache_dir = model_cache_dir or Path("/tmp/opportunity_models")
		self.model_cache_dir.mkdir(parents=True, exist_ok=True)
		
		# Classification models
		self.type_classifier = None
		self.sector_classifier = None
		self.complexity_classifier = None
		self.vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
		
		# Competitive intelligence database
		self.competitive_db_path = competitive_intelligence_db
		self.competitive_data = self._load_competitive_intelligence()
		
		# Pattern libraries
		self.type_patterns = self._load_type_patterns()
		self.sector_patterns = self._load_sector_patterns()
		self.value_patterns = self._load_value_patterns()
		self.deadline_patterns = self._load_deadline_patterns()
		
		self.analysis_stats = {
			'total_analyses': 0,
			'classification_accuracy': 0.0,
			'processing_times': [],
			'error_rate': 0.0
		}
	
	def _load_competitive_intelligence(self) -> Dict[str, Any]:
		"""Load competitive intelligence data"""
		if self.competitive_db_path and self.competitive_db_path.exists():
			try:
				with open(self.competitive_db_path, 'r') as f:
					return json.load(f)
			except Exception as e:
				self.logger.warning(f"Failed to load competitive intelligence: {e}")
		
		# Default competitive intelligence data
		return {
			'major_competitors': {
				'technology': ['IBM', 'Accenture', 'Deloitte', 'CACI', 'SAIC'],
				'consulting': ['McKinsey', 'BCG', 'Bain', 'Deloitte', 'PwC'],
				'defense': ['Lockheed Martin', 'Raytheon', 'Boeing', 'General Dynamics'],
				'construction': ['Bechtel', 'Fluor', 'AECOM', 'Jacobs']
			},
			'market_dynamics': {
				'technology': {'growth_rate': 0.15, 'competition_intensity': 'high'},
				'consulting': {'growth_rate': 0.08, 'competition_intensity': 'intense'},
				'defense': {'growth_rate': 0.05, 'competition_intensity': 'moderate'}
			}
		}
	
	def _load_type_patterns(self) -> Dict[str, List[str]]:
		"""Load opportunity type classification patterns"""
		return {
			'software': [
				r'software development', r'application development', r'system integration',
				r'cloud migration', r'database', r'web application', r'mobile app',
				r'artificial intelligence', r'machine learning', r'data analytics'
			],
			'consulting': [
				r'consulting services', r'advisory services', r'strategy', r'analysis',
				r'assessment', r'evaluation', r'study', r'review', r'planning'
			],
			'construction': [
				r'construction', r'building', r'renovation', r'infrastructure',
				r'facility', r'architectural', r'engineering', r'design-build'
			],
			'services': [
				r'professional services', r'support services', r'maintenance',
				r'operations', r'management', r'administration'
			],
			'goods': [
				r'equipment', r'supplies', r'materials', r'hardware',
				r'procurement', r'purchase', r'acquisition'
			],
			'training': [
				r'training', r'education', r'learning', r'curriculum',
				r'instruction', r'workshop', r'seminar'
			],
			'research': [
				r'research', r'development', r'innovation', r'prototype',
				r'pilot', r'feasibility study', r'investigation'
			]
		}
	
	def _load_sector_patterns(self) -> Dict[str, List[str]]:
		"""Load sector classification patterns"""
		return {
			'defense': [
				r'department of defense', r'dod', r'military', r'army', r'navy',
				r'air force', r'marines', r'defense', r'security clearance',
				r'classified', r'weapon', r'combat'
			],
			'healthcare': [
				r'health', r'medical', r'hospital', r'patient', r'clinical',
				r'healthcare', r'pharmacy', r'medicare', r'medicaid'
			],
			'education': [
				r'education', r'school', r'university', r'college', r'student',
				r'academic', r'learning', r'curriculum', r'teacher'
			],
			'technology': [
				r'information technology', r'it', r'cyber', r'digital',
				r'cloud', r'network', r'security', r'software', r'hardware'
			],
			'energy': [
				r'energy', r'power', r'electric', r'utility', r'renewable',
				r'solar', r'wind', r'grid', r'transmission'
			],
			'infrastructure': [
				r'infrastructure', r'transportation', r'road', r'bridge',
				r'airport', r'port', r'transit', r'highway'
			]
		}
	
	def _load_value_patterns(self) -> List[str]:
		"""Load value extraction patterns"""
		return [
			r'\$[\d,]+(?:\.\d{2})?(?:\s?(?:million|billion|thousand|M|B|K))?',
			r'(?:budget|value|amount|price|cost)[:=\s]+\$?[\d,]+',
			r'not to exceed \$?[\d,]+',
			r'estimated value[:=\s]+\$?[\d,]+',
			r'total contract value[:=\s]+\$?[\d,]+'
		]
	
	def _load_deadline_patterns(self) -> List[str]:
		"""Load deadline extraction patterns"""
		return [
			r'deadline[:=\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'due[:=\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'proposals must be received by[:=\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'closing date[:=\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})[\s]+at[\s]+(\d{1,2}:\d{2})'
		]
	
	async def analyze_opportunity(self, 
								  opportunity_data: Dict[str, Any],
								  historical_context: Optional[Dict[str, Any]] = None) -> OpportunityAnalysis:
		"""
		Perform comprehensive opportunity analysis
		
		Args:
			opportunity_data: Raw opportunity data from scraping
			historical_context: Historical performance and market data
			
		Returns:
			Complete opportunity analysis with all components
		"""
		start_time = datetime.now(timezone.utc)
		
		try:
			# Extract key content for analysis
			content = self._extract_analysis_content(opportunity_data)
			
			# Parallel analysis execution
			classification_task = self._classify_opportunity(content, opportunity_data)
			competitive_task = self._assess_competition(content, opportunity_data, historical_context)
			timeline_task = self._analyze_timeline(content, opportunity_data)
			value_task = self._estimate_value(content, opportunity_data)
			eligibility_task = self._analyze_eligibility(content, opportunity_data)
			
			# Await all analyses
			classification, competitive_assessment, timeline_analysis, value_estimation, eligibility_analysis = await asyncio.gather(
				classification_task,
				competitive_task, 
				timeline_task,
				value_task,
				eligibility_task,
				return_exceptions=True
			)
			
			# Handle any exceptions
			for result in [classification, competitive_assessment, timeline_analysis, value_estimation, eligibility_analysis]:
				if isinstance(result, Exception):
					self.logger.error(f"Analysis component failed: {result}")
			
			# Calculate overall scores
			overall_attractiveness = self._calculate_attractiveness(
				classification, competitive_assessment, value_estimation
			)
			
			strategic_alignment = self._calculate_strategic_alignment(
				classification, opportunity_data, historical_context
			)
			
			win_probability = self._estimate_win_probability(
				competitive_assessment, eligibility_analysis, historical_context
			)
			
			# Generate recommendation
			recommendation, reasons = self._generate_recommendation(
				overall_attractiveness, strategic_alignment, win_probability, 
				competitive_assessment, timeline_analysis
			)
			
			# Calculate confidence scores
			analysis_confidence = self._calculate_analysis_confidence(
				classification, competitive_assessment, timeline_analysis, 
				value_estimation, eligibility_analysis
			)
			
			data_quality_score = self._assess_data_quality(opportunity_data)
			
			# Create final analysis
			analysis = OpportunityAnalysis(
				classification=classification,
				competitive_assessment=competitive_assessment,
				timeline_analysis=timeline_analysis,
				value_estimation=value_estimation,
				eligibility_analysis=eligibility_analysis,
				overall_attractiveness=overall_attractiveness,
				strategic_alignment=strategic_alignment,
				win_probability_estimate=win_probability,
				recommendation=recommendation,
				recommendation_reasons=reasons,
				analysis_confidence=analysis_confidence,
				data_quality_score=data_quality_score
			)
			
			# Update statistics
			self._update_analysis_stats(start_time, True)
			
			return analysis
			
		except Exception as e:
			self.logger.error(f"Opportunity analysis failed: {e}")
			self._update_analysis_stats(start_time, False)
			raise
	
	def _extract_analysis_content(self, opportunity_data: Dict[str, Any]) -> str:
		"""Extract content for analysis"""
		content_parts = []
		
		# Combine all text fields for analysis
		for field in ['title', 'description', 'requirements', 'scope_of_work', 'summary']:
			if field in opportunity_data and opportunity_data[field]:
				content_parts.append(str(opportunity_data[field]))
		
		return ' '.join(content_parts)
	
	async def _classify_opportunity(self, content: str, data: Dict[str, Any]) -> OpportunityClassification:
		"""Classify opportunity type, sector, and complexity"""
		
		# Type classification
		opportunity_type = self._classify_type(content)
		
		# Sector classification
		sector = self._classify_sector(content)
		
		# Complexity assessment
		complexity = self._assess_complexity(content, data)
		
		# Duration estimation
		duration = self._estimate_duration(content, data)
		
		# Geographic scope
		geographic_scope = self._determine_geographic_scope(content, data)
		
		# Contract vehicle detection
		contract_vehicle = self._detect_contract_vehicle(content, data)
		
		# Set-aside detection
		set_aside = self._detect_set_aside(content, data)
		
		# Confidence calculation
		confidence = self._calculate_classification_confidence(
			content, opportunity_type, sector, complexity
		)
		
		return OpportunityClassification(
			type=opportunity_type,
			sector=sector,
			complexity=complexity,
			duration=duration,
			geographic_scope=geographic_scope,
			contract_vehicle=contract_vehicle,
			set_aside=set_aside,
			confidence_score=confidence,
			classification_reasons=self._get_classification_reasons(content, opportunity_type, sector)
		)
	
	def _classify_type(self, content: str) -> OpportunityType:
		"""Classify opportunity type using pattern matching"""
		content_lower = content.lower()
		type_scores = {}
		
		for opp_type, patterns in self.type_patterns.items():
			score = 0
			for pattern in patterns:
				matches = len(re.findall(pattern, content_lower))
				score += matches
			type_scores[opp_type] = score
		
		if not any(type_scores.values()):
			return OpportunityType.UNKNOWN
		
		best_type = max(type_scores, key=type_scores.get)
		return OpportunityType(best_type)
	
	def _classify_sector(self, content: str) -> OpportunitySector:
		"""Classify market sector using pattern matching"""
		content_lower = content.lower()
		sector_scores = {}
		
		for sector, patterns in self.sector_patterns.items():
			score = 0
			for pattern in patterns:
				matches = len(re.findall(pattern, content_lower))
				score += matches
			sector_scores[sector] = score
		
		if not any(sector_scores.values()):
			return OpportunitySector.UNKNOWN
		
		best_sector = max(sector_scores, key=sector_scores.get)
		return OpportunitySector(best_sector)
	
	def _assess_complexity(self, content: str, data: Dict[str, Any]) -> str:
		"""Assess opportunity complexity"""
		complexity_indicators = {
			'expert': [
				r'artificial intelligence', r'machine learning', r'quantum',
				r'classified', r'top secret', r'complex system', r'enterprise architecture'
			],
			'high': [
				r'integration', r'multiple systems', r'large scale',
				r'mission critical', r'24/7', r'high availability'
			],
			'medium': [
				r'professional services', r'consulting', r'analysis',
				r'implementation', r'deployment'
			],
			'low': [
				r'maintenance', r'support', r'simple', r'basic',
				r'standard', r'routine'
			]
		}
		
		content_lower = content.lower()
		scores = {}
		
		for level, indicators in complexity_indicators.items():
			score = sum(len(re.findall(indicator, content_lower)) for indicator in indicators)
			scores[level] = score
		
		# Add heuristics based on contract value
		if 'estimated_value' in data:
			try:
				value = float(data['estimated_value'].replace('$', '').replace(',', ''))
				if value > 10000000:  # $10M+
					scores['expert'] = scores.get('expert', 0) + 2
				elif value > 1000000:  # $1M+
					scores['high'] = scores.get('high', 0) + 1
			except (ValueError, TypeError, AttributeError) as e:
				logger.warning(f"Failed to parse estimated_value for complexity scoring: {e}")

		if not any(scores.values()):
			return 'medium'
		
		return max(scores, key=scores.get)
	
	def _estimate_duration(self, content: str, data: Dict[str, Any]) -> Optional[str]:
		"""Estimate project duration"""
		duration_patterns = [
			r'(\d+)\s*(?:year|yr)s?',
			r'(\d+)\s*(?:month|mo)s?', 
			r'(\d+)\s*(?:week|wk)s?'
		]
		
		for pattern in duration_patterns:
			matches = re.findall(pattern, content.lower())
			if matches:
				return f"{matches[0]} months"  # Normalize to months
		
		return None
	
	def _determine_geographic_scope(self, content: str, data: Dict[str, Any]) -> str:
		"""Determine geographic scope"""
		international_indicators = ['international', 'global', 'worldwide', 'overseas']
		national_indicators = ['national', 'federal', 'nationwide', 'conus']
		regional_indicators = ['regional', 'multi-state', 'northeast', 'southeast', 'midwest', 'west']
		
		content_lower = content.lower()
		
		if any(indicator in content_lower for indicator in international_indicators):
			return 'international'
		elif any(indicator in content_lower for indicator in national_indicators):
			return 'national'
		elif any(indicator in content_lower for indicator in regional_indicators):
			return 'regional'
		else:
			return 'local'
	
	def _detect_contract_vehicle(self, content: str, data: Dict[str, Any]) -> Optional[str]:
		"""Detect contract vehicle"""
		vehicles = ['GSA', 'SEWP', 'CIO-SP3', 'OASIS', 'ITSS', 'T4NG']
		content_upper = content.upper()
		
		for vehicle in vehicles:
			if vehicle in content_upper:
				return vehicle
		
		return None
	
	def _detect_set_aside(self, content: str, data: Dict[str, Any]) -> Optional[str]:
		"""Detect set-aside requirements"""
		set_asides = {
			'small business': r'small business|SB|8\(a\)',
			'veteran': r'veteran|VOSB|SDVOSB',
			'woman': r'woman|WOSB|WOB',
			'hubzone': r'hubzone|HUB',
			'minority': r'minority|MBE'
		}
		
		content_lower = content.lower()
		
		for set_aside, pattern in set_asides.items():
			if re.search(pattern, content_lower):
				return set_aside
		
		return None
	
	def _calculate_classification_confidence(self, content: str, opp_type: OpportunityType, 
											sector: OpportunitySector, complexity: str) -> float:
		"""Calculate confidence in classification"""
		factors = []
		
		# Content length factor
		if len(content) > 1000:
			factors.append(0.9)
		elif len(content) > 500:
			factors.append(0.7)
		else:
			factors.append(0.5)
		
		# Classification strength
		if opp_type != OpportunityType.UNKNOWN:
			factors.append(0.8)
		else:
			factors.append(0.3)
		
		if sector != OpportunitySector.UNKNOWN:
			factors.append(0.8)
		else:
			factors.append(0.3)
		
		return min(np.mean(factors), 1.0)
	
	def _get_classification_reasons(self, content: str, opp_type: OpportunityType, 
								   sector: OpportunitySector) -> List[str]:
		"""Get reasons for classification decisions"""
		reasons = []
		
		if opp_type != OpportunityType.UNKNOWN:
			type_patterns = self.type_patterns.get(opp_type.value, [])
			matched_patterns = [p for p in type_patterns if re.search(p, content.lower())]
			if matched_patterns:
				reasons.append(f"Type '{opp_type.value}' based on keywords: {matched_patterns[:3]}")
		
		if sector != OpportunitySector.UNKNOWN:
			sector_patterns = self.sector_patterns.get(sector.value, [])
			matched_patterns = [p for p in sector_patterns if re.search(p, content.lower())]
			if matched_patterns:
				reasons.append(f"Sector '{sector.value}' based on keywords: {matched_patterns[:3]}")
		
		return reasons
	
	async def _assess_competition(self, content: str, data: Dict[str, Any], 
								  historical_context: Optional[Dict[str, Any]]) -> CompetitiveAssessment:
		"""Assess competitive landscape"""
		
		# Determine competition level
		competition_level = self._determine_competition_level(content, data)
		
		# Estimate number of competitors
		expected_competitors = self._estimate_competitor_count(competition_level, data)
		
		# Identify key competitors
		key_competitors = self._identify_key_competitors(content, data, historical_context)
		
		# Analyze competitive advantages and risks
		advantages = self._identify_competitive_advantages(content, data, historical_context)
		risks = self._identify_competitive_risks(content, data, historical_context)
		
		# Check for incumbent advantage
		incumbent_advantage, incumbent_name = self._detect_incumbent(content, data)
		
		# Assess market dynamics
		market_dynamics = self._assess_market_dynamics(content, data, historical_context)
		
		# Calculate assessment confidence
		confidence = self._calculate_competitive_confidence(content, data, historical_context)
		
		return CompetitiveAssessment(
			competition_level=competition_level,
			expected_competitors=expected_competitors,
			key_competitors=key_competitors,
			competitive_advantages=advantages,
			competitive_risks=risks,
			incumbent_advantage=incumbent_advantage,
			incumbent_name=incumbent_name,
			market_dynamics=market_dynamics,
			assessment_confidence=confidence
		)
	
	def _determine_competition_level(self, content: str, data: Dict[str, Any]) -> CompetitionLevel:
		"""Determine expected competition level"""
		
		# High competition indicators
		high_competition = [
			r'highly competitive', r'significant competition', r'many qualified',
			r'popular contract', r'frequently competed'
		]
		
		# Low competition indicators  
		low_competition = [
			r'specialized', r'niche', r'unique requirements', r'limited qualified',
			r'specific expertise', r'security clearance required'
		]
		
		content_lower = content.lower()
		
		high_score = sum(1 for pattern in high_competition if re.search(pattern, content_lower))
		low_score = sum(1 for pattern in low_competition if re.search(pattern, content_lower))
		
		# Value-based heuristics
		try:
			if 'estimated_value' in data:
				value = float(data['estimated_value'].replace('$', '').replace(',', ''))
				if value > 50000000:  # $50M+ typically intense
					return CompetitionLevel.INTENSE
				elif value > 10000000:  # $10M+ typically high
					return CompetitionLevel.HIGH
		except (ValueError, TypeError, AttributeError) as e:
			logger.warning(f"Failed to parse estimated_value for competition level: {e}")
		
		if high_score > low_score:
			return CompetitionLevel.HIGH
		elif low_score > high_score:
			return CompetitionLevel.LOW
		else:
			return CompetitionLevel.MODERATE
	
	def _estimate_competitor_count(self, competition_level: CompetitionLevel, data: Dict[str, Any]) -> int:
		"""Estimate number of expected competitors"""
		base_counts = {
			CompetitionLevel.LOW: 2,
			CompetitionLevel.MODERATE: 6,
			CompetitionLevel.HIGH: 12,
			CompetitionLevel.INTENSE: 20,
			CompetitionLevel.UNKNOWN: 8
		}
		
		base_count = base_counts[competition_level]
		
		# Adjust based on contract value
		try:
			if 'estimated_value' in data:
				value = float(data['estimated_value'].replace('$', '').replace(',', ''))
				if value > 100000000:  # $100M+
					base_count = int(base_count * 1.5)
				elif value < 1000000:  # <$1M
					base_count = max(1, int(base_count * 0.7))
		except (ValueError, TypeError, AttributeError) as e:
			logger.warning(f"Failed to parse estimated_value for competitor count: {e}")
		
		return base_count
	
	def _identify_key_competitors(self, content: str, data: Dict[str, Any], 
								  historical_context: Optional[Dict[str, Any]]) -> List[str]:
		"""Identify likely key competitors"""
		competitors = []
		
		# Check competitive intelligence database
		sector = self._classify_sector(content).value
		if sector in self.competitive_data.get('major_competitors', {}):
			competitors.extend(self.competitive_data['major_competitors'][sector][:5])
		
		# Extract mentioned companies from content
		company_patterns = [
			r'\b[A-Z][a-z]+\s+(?:Inc\.?|LLC|Corp\.?|Corporation|Company)\b',
			r'\b(?:IBM|Microsoft|Oracle|SAP|Accenture|Deloitte|CACI|SAIC)\b'
		]
		
		for pattern in company_patterns:
			matches = re.findall(pattern, content)
			competitors.extend(matches[:3])
		
		# Remove duplicates and limit
		return list(dict.fromkeys(competitors))[:8]
	
	def _identify_competitive_advantages(self, content: str, data: Dict[str, Any],
										 historical_context: Optional[Dict[str, Any]]) -> List[str]:
		"""Identify potential competitive advantages"""
		advantages = []
		
		# Standard competitive advantages
		if historical_context:
			past_performance = historical_context.get('past_performance', {})
			if past_performance.get('win_rate', 0) > 0.7:
				advantages.append("Strong past performance record")
			
			if past_performance.get('customer_relationships'):
				advantages.append("Existing customer relationships")
		
		# Technical advantages based on content
		technical_indicators = [
			('proprietary technology', 'Proprietary technology solution'),
			('patent', 'Patented technology advantage'),
			('certified', 'Industry certifications'),
			('partnership', 'Strategic partnerships'),
			('exclusive', 'Exclusive capabilities')
		]
		
		content_lower = content.lower()
		for indicator, advantage in technical_indicators:
			if indicator in content_lower:
				advantages.append(advantage)
		
		return advantages
	
	def _identify_competitive_risks(self, content: str, data: Dict[str, Any],
									historical_context: Optional[Dict[str, Any]]) -> List[str]:
		"""Identify competitive risks"""
		risks = []
		
		# Standard competitive risks
		risk_indicators = [
			('incumbent', 'Strong incumbent advantage'),
			('preferred vendor', 'Buyer has preferred vendor'),
			('multiple award', 'Multiple award contract dilutes opportunity'),
			('price sensitive', 'Highly price-sensitive competition'),
			('commoditized', 'Commoditized service offering')
		]
		
		content_lower = content.lower()
		for indicator, risk in risk_indicators:
			if indicator in content_lower:
				risks.append(risk)
		
		# Market-based risks
		competition_level = self._determine_competition_level(content, data)
		if competition_level == CompetitionLevel.INTENSE:
			risks.append("Intense competition expected")
		
		return risks
	
	def _detect_incumbent(self, content: str, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
		"""Detect incumbent advantage"""
		incumbent_indicators = [
			r'current contractor', r'incumbent', r'existing vendor',
			r'currently providing', r'continuation of'
		]
		
		content_lower = content.lower()
		
		for indicator in incumbent_indicators:
			if re.search(indicator, content_lower):
				# Try to extract incumbent name
				context_match = re.search(f'{indicator}[^.]*', content_lower)
				if context_match:
					context = context_match.group()
					company_match = re.search(r'\b[A-Z][a-z]+\s+(?:Inc\.?|LLC|Corp\.?|Corporation)\b', context)
					if company_match:
						return True, company_match.group()
				return True, None
		
		return False, None
	
	def _assess_market_dynamics(self, content: str, data: Dict[str, Any],
								historical_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
		"""Assess market dynamics"""
		dynamics = {}
		
		sector = self._classify_sector(content).value
		if sector in self.competitive_data.get('market_dynamics', {}):
			dynamics.update(self.competitive_data['market_dynamics'][sector])
		
		# Add opportunity-specific dynamics
		dynamics.update({
			'opportunity_size': 'large' if self._is_large_opportunity(data) else 'medium',
			'complexity_level': self._assess_complexity(content, data),
			'time_pressure': self._assess_time_pressure(data)
		})
		
		return dynamics
	
	def _calculate_competitive_confidence(self, content: str, data: Dict[str, Any],
										  historical_context: Optional[Dict[str, Any]]) -> float:
		"""Calculate confidence in competitive assessment"""
		factors = []
		
		# Historical data availability
		if historical_context:
			factors.append(0.8)
		else:
			factors.append(0.4)
		
		# Content quality
		if len(content) > 1000:
			factors.append(0.8)
		else:
			factors.append(0.5)
		
		# Data completeness
		data_completeness = len([k for k in data.keys() if data[k]]) / max(len(data.keys()), 1)
		factors.append(min(data_completeness, 0.9))
		
		return min(np.mean(factors), 1.0)
	
	async def _analyze_timeline(self, content: str, data: Dict[str, Any]) -> TimelineAnalysis:
		"""Analyze timeline and deadlines"""
		
		# Extract key dates
		proposal_deadline = self._extract_proposal_deadline(content, data)
		questions_deadline = self._extract_questions_deadline(content, data)
		pre_proposal_conference = self._extract_conference_date(content, data)
		award_date = self._extract_award_date(content, data)
		performance_dates = self._extract_performance_period(content, data)
		
		# Calculate preparation time
		preparation_time = None
		if proposal_deadline:
			now = datetime.now(timezone.utc)
			if proposal_deadline > now:
				preparation_time = (proposal_deadline - now).days
		
		# Identify critical milestones
		milestones = self._identify_critical_milestones(content, data, {
			'proposal_deadline': proposal_deadline,
			'questions_deadline': questions_deadline,
			'pre_proposal_conference': pre_proposal_conference,
			'award_date': award_date
		})
		
		# Assess timeline risks
		timeline_risks = self._assess_timeline_risks(preparation_time, milestones)
		
		# Calculate confidence
		timeline_confidence = self._calculate_timeline_confidence(content, data)
		
		return TimelineAnalysis(
			proposal_deadline=proposal_deadline,
			questions_deadline=questions_deadline,
			pre_proposal_conference=pre_proposal_conference,
			award_date=award_date,
			performance_start=performance_dates[0] if performance_dates else None,
			performance_end=performance_dates[1] if performance_dates else None,
			preparation_time_days=preparation_time,
			critical_milestones=milestones,
			timeline_risks=timeline_risks,
			timeline_confidence=timeline_confidence
		)
	
	def _extract_proposal_deadline(self, content: str, data: Dict[str, Any]) -> Optional[datetime]:
		"""Extract proposal deadline"""
		# Check data first
		if 'deadline' in data and data['deadline']:
			try:
				return self._parse_date(data['deadline'])
			except (ValueError, TypeError, KeyError) as e:
				logger.warning(f"Failed to parse deadline from data: {e}")
		
		# Pattern matching in content
		deadline_patterns = [
			r'proposals?.*due.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'deadline.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'must be received by.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'closing date.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
		]
		
		for pattern in deadline_patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					return self._parse_date(match.group(1))
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse proposal deadline '{match.group(1)}': {e}")
					continue
		
		return None
	
	def _extract_questions_deadline(self, content: str, data: Dict[str, Any]) -> Optional[datetime]:
		"""Extract questions deadline"""
		patterns = [
			r'questions?.*due.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'inquiries?.*deadline.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'last date.*questions?.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
		]

		for pattern in patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					return self._parse_date(match.group(1))
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse questions deadline '{match.group(1)}': {e}")
					continue
		
		return None
	
	def _extract_conference_date(self, content: str, data: Dict[str, Any]) -> Optional[datetime]:
		"""Extract pre-proposal conference date"""
		patterns = [
			r'pre-proposal conference.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'bidders conference.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'information session.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
		]

		for pattern in patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					return self._parse_date(match.group(1))
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse conference date '{match.group(1)}': {e}")
					continue
		
		return None
	
	def _extract_award_date(self, content: str, data: Dict[str, Any]) -> Optional[datetime]:
		"""Extract expected award date"""
		patterns = [
			r'award.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'selection.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'anticipated award.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
		]

		for pattern in patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					return self._parse_date(match.group(1))
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse award date '{match.group(1)}': {e}")
					continue
		
		return None
	
	def _extract_performance_period(self, content: str, data: Dict[str, Any]) -> Tuple[Optional[datetime], Optional[datetime]]:
		"""Extract performance period start and end dates"""
		start_patterns = [
			r'performance.*start.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'work.*begin.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'contract.*start.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
		]
		
		end_patterns = [
			r'performance.*end.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'contract.*end.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
			r'completion.*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
		]
		
		start_date = None
		end_date = None
		
		for pattern in start_patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					start_date = self._parse_date(match.group(1))
					break
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse performance start date '{match.group(1)}': {e}")
					continue

		for pattern in end_patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					end_date = self._parse_date(match.group(1))
					break
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse performance end date '{match.group(1)}': {e}")
					continue
		
		return start_date, end_date
	
	def _parse_date(self, date_str: str) -> datetime:
		"""Parse date string to datetime"""
		from dateutil import parser
		return parser.parse(date_str).replace(tzinfo=timezone.utc)
	
	def _identify_critical_milestones(self, content: str, data: Dict[str, Any], dates: Dict[str, Optional[datetime]]) -> List[Dict[str, Any]]:
		"""Identify critical milestones"""
		milestones = []
		
		for milestone, date in dates.items():
			if date:
				importance = 'high' if milestone in ['proposal_deadline', 'award_date'] else 'medium'
				milestones.append({
					'name': milestone.replace('_', ' ').title(),
					'date': date.isoformat(),
					'importance': importance,
					'description': self._get_milestone_description(milestone)
				})
		
		return sorted(milestones, key=lambda x: x['date'])
	
	def _get_milestone_description(self, milestone: str) -> str:
		"""Get description for milestone"""
		descriptions = {
			'proposal_deadline': 'Final deadline for proposal submission',
			'questions_deadline': 'Last date to submit questions',
			'pre_proposal_conference': 'Pre-proposal conference or information session',
			'award_date': 'Expected contract award date',
			'performance_start': 'Performance period begins',
			'performance_end': 'Performance period ends'
		}
		return descriptions.get(milestone, 'Important milestone')
	
	def _assess_timeline_risks(self, preparation_time: Optional[int], milestones: List[Dict[str, Any]]) -> List[str]:
		"""Assess timeline risks"""
		risks = []
		
		if preparation_time is not None:
			if preparation_time < 14:
				risks.append("Very short preparation time - less than 2 weeks")
			elif preparation_time < 30:
				risks.append("Short preparation time - less than 1 month")
		
		if len(milestones) > 5:
			risks.append("Complex timeline with many milestones")
		
		# Check for compressed timeline
		if len(milestones) >= 2:
			first_date = datetime.fromisoformat(milestones[0]['date'])
			last_date = datetime.fromisoformat(milestones[-1]['date'])
			total_days = (last_date - first_date).days
			
			if total_days < 60 and len(milestones) > 3:
				risks.append("Compressed timeline with multiple milestones")
		
		return risks
	
	def _calculate_timeline_confidence(self, content: str, data: Dict[str, Any]) -> float:
		"""Calculate confidence in timeline analysis"""
		factors = []
		
		# Number of dates found
		date_count = len(re.findall(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', content))
		if date_count >= 3:
			factors.append(0.9)
		elif date_count >= 1:
			factors.append(0.7)
		else:
			factors.append(0.3)
		
		# Data quality
		if 'deadline' in data and data['deadline']:
			factors.append(0.8)
		else:
			factors.append(0.4)
		
		return min(np.mean(factors), 1.0)
	
	async def _estimate_value(self, content: str, data: Dict[str, Any]) -> ValueEstimation:
		"""Estimate opportunity value"""
		
		# Extract value from data first
		estimated_value = None
		value_confidence = 0.5
		value_source = "estimated"
		
		if 'estimated_value' in data and data['estimated_value']:
			try:
				value_str = str(data['estimated_value']).replace('$', '').replace(',', '')
				estimated_value = Decimal(value_str)
				value_confidence = 0.9
				value_source = "stated"
			except (ValueError, TypeError, ArithmeticError) as e:
				logger.warning(f"Failed to parse stated estimated_value: {e}")
		
		# Pattern matching for values in content
		if not estimated_value:
			estimated_value, value_confidence = self._extract_value_from_content(content)
			if estimated_value:
				value_source = "extracted"
		
		# Determine value range
		value_range_min, value_range_max = self._calculate_value_range(estimated_value)
		
		# Determine funding type
		funding_type = self._determine_funding_type(content, data)
		
		# Determine pricing model
		pricing_model = self._determine_pricing_model(content, data)
		
		# Payment terms
		payment_terms = self._extract_payment_terms(content, data)
		
		# Economic factors
		economic_factors = self._assess_economic_factors(content, data)
		
		return ValueEstimation(
			estimated_value=estimated_value,
			value_range_min=value_range_min,
			value_range_max=value_range_max,
			value_confidence=value_confidence,
			value_source=value_source,
			funding_type=funding_type,
			payment_terms=payment_terms,
			pricing_model=pricing_model,
			economic_factors=economic_factors
		)
	
	def _extract_value_from_content(self, content: str) -> Tuple[Optional[Decimal], float]:
		"""Extract value from content using patterns"""
		
		for pattern in self.value_patterns:
			matches = re.findall(pattern, content, re.IGNORECASE)
			if matches:
				for match in matches:
					try:
						# Clean the match
						value_str = re.sub(r'[^\d.,KMB]', '', match.upper())
						
						# Handle K, M, B suffixes
						multiplier = 1
						if value_str.endswith('K'):
							multiplier = 1000
							value_str = value_str[:-1]
						elif value_str.endswith('M'):
							multiplier = 1000000
							value_str = value_str[:-1]
						elif value_str.endswith('B'):
							multiplier = 1000000000
							value_str = value_str[:-1]
						
						# Convert to decimal
						value = Decimal(value_str.replace(',', '')) * multiplier
						
						# Confidence based on pattern type
						confidence = 0.8 if 'not to exceed' in match.lower() else 0.7
						
						return value, confidence

					except (ValueError, TypeError, ArithmeticError) as e:
						logger.warning(f"Failed to parse value from content pattern: {e}")
						continue
		
		return None, 0.0
	
	def _calculate_value_range(self, estimated_value: Optional[Decimal]) -> Tuple[Optional[Decimal], Optional[Decimal]]:
		"""Calculate value range"""
		if not estimated_value:
			return None, None
		
		# Typical government contract range is ±20%
		range_factor = Decimal('0.2')
		value_min = estimated_value * (1 - range_factor)
		value_max = estimated_value * (1 + range_factor)
		
		return value_min, value_max
	
	def _determine_funding_type(self, content: str, data: Dict[str, Any]) -> str:
		"""Determine funding type"""
		funding_indicators = {
			'appropriated': ['appropriated', 'annual funding', 'fiscal year'],
			'fee-for-service': ['fee for service', 'user fees', 'self-funded'],
			'grant': ['grant', 'awarded grant', 'grant funding'],
			'loan': ['loan', 'financing', 'borrowed funds']
		}
		
		content_lower = content.lower()
		
		for funding_type, indicators in funding_indicators.items():
			if any(indicator in content_lower for indicator in indicators):
				return funding_type
		
		return "appropriated"  # Default for government contracts
	
	def _determine_pricing_model(self, content: str, data: Dict[str, Any]) -> str:
		"""Determine pricing model"""
		pricing_indicators = {
			'fixed_price': ['fixed price', 'firm fixed price', 'FFP', 'lump sum'],
			'cost_plus': ['cost plus', 'cost reimbursable', 'CPFF', 'cost type'],
			'time_materials': ['time and materials', 'T&M', 'labor hour', 'hourly'],
			'indefinite': ['indefinite delivery', 'IDIQ', 'task order', 'delivery order']
		}
		
		content_lower = content.lower()
		
		for model, indicators in pricing_indicators.items():
			if any(indicator in content_lower for indicator in indicators):
				return model
		
		return "fixed_price"  # Default assumption
	
	def _extract_payment_terms(self, content: str, data: Dict[str, Any]) -> Optional[str]:
		"""Extract payment terms"""
		payment_patterns = [
			r'payment.*(\d+).*days',
			r'invoice.*(\d+).*days',
			r'net.*(\d+)',
			r'monthly payment',
			r'quarterly payment',
			r'annual payment'
		]
		
		for pattern in payment_patterns:
			match = re.search(pattern, content.lower())
			if match:
				return match.group(0)
		
		return None
	
	def _assess_economic_factors(self, content: str, data: Dict[str, Any]) -> Dict[str, Any]:
		"""Assess economic factors affecting value"""
		factors = {}
		
		# Budget constraints
		if 'budget' in content.lower():
			factors['budget_constrained'] = True
		
		# Multi-year funding
		if re.search(r'\d+\s*year', content.lower()):
			factors['multi_year'] = True
		
		# Options
		if 'option' in content.lower():
			factors['has_options'] = True
		
		# Competition impact
		if 'competitive' in content.lower():
			factors['competitive_pricing'] = True
		
		return factors
	
	async def _analyze_eligibility(self, content: str, data: Dict[str, Any]) -> EligibilityAnalysis:
		"""Analyze eligibility and qualification requirements"""
		
		# Extract requirements
		minimum_requirements = self._extract_minimum_requirements(content, data)
		preferred_qualifications = self._extract_preferred_qualifications(content, data)
		
		# Security clearance requirements
		security_clearance = self._extract_security_clearance(content, data)
		
		# Certification requirements
		certifications = self._extract_certifications(content, data)
		
		# Past performance requirements
		past_performance = self._extract_past_performance_requirements(content, data)
		
		# Financial requirements
		financial_requirements = self._extract_financial_requirements(content, data)
		
		# Geographic restrictions
		geographic_restrictions = self._extract_geographic_restrictions(content, data)
		
		# Calculate eligibility score (would be based on organization capabilities)
		eligibility_score = self._calculate_eligibility_score(
			minimum_requirements, preferred_qualifications, security_clearance, certifications
		)
		
		# Identify qualification gaps
		qualification_gaps = self._identify_qualification_gaps(
			minimum_requirements, certifications, security_clearance
		)
		
		return EligibilityAnalysis(
			minimum_requirements=minimum_requirements,
			preferred_qualifications=preferred_qualifications,
			security_clearance_required=security_clearance,
			certifications_required=certifications,
			past_performance_requirements=past_performance,
			financial_requirements=financial_requirements,
			geographic_restrictions=geographic_restrictions,
			eligibility_score=eligibility_score,
			qualification_gaps=qualification_gaps
		)
	
	def _extract_minimum_requirements(self, content: str, data: Dict[str, Any]) -> List[str]:
		"""Extract minimum requirements"""
		requirements = []
		
		# Pattern-based extraction
		requirement_patterns = [
			r'minimum.*?(?:requirements?|qualifications?).*?[.;:]',
			r'must have.*?[.;:]',
			r'required.*?[.;:]',
			r'mandatory.*?[.;:]'
		]
		
		for pattern in requirement_patterns:
			matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
			for match in matches[:5]:  # Limit to avoid noise
				clean_req = re.sub(r'minimum.*?(?:requirements?|qualifications?)', '', match, flags=re.IGNORECASE)
				clean_req = clean_req.strip(' .;:')
				if len(clean_req) > 10:
					requirements.append(clean_req[:200])  # Truncate long requirements
		
		return requirements[:10]  # Limit total requirements
	
	def _extract_preferred_qualifications(self, content: str, data: Dict[str, Any]) -> List[str]:
		"""Extract preferred qualifications"""
		qualifications = []
		
		# Pattern-based extraction
		preferred_patterns = [
			r'preferred.*?[.;:]',
			r'desired.*?[.;:]',
			r'plus.*?[.;:]',
			r'advantage.*?[.;:]'
		]
		
		for pattern in preferred_patterns:
			matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
			for match in matches[:3]:
				clean_qual = match.strip(' .;:')
				if len(clean_qual) > 10:
					qualifications.append(clean_qual[:200])
		
		return qualifications[:8]
	
	def _extract_security_clearance(self, content: str, data: Dict[str, Any]) -> Optional[str]:
		"""Extract security clearance requirements"""
		clearance_patterns = [
			r'(top secret)',
			r'(secret clearance)',
			r'(confidential clearance)',
			r'(public trust)',
			r'(security clearance required)'
		]
		
		content_lower = content.lower()
		
		for pattern in clearance_patterns:
			match = re.search(pattern, content_lower)
			if match:
				return match.group(1).title()
		
		return None
	
	def _extract_certifications(self, content: str, data: Dict[str, Any]) -> List[str]:
		"""Extract certification requirements"""
		certifications = []
		
		# Common certification patterns
		cert_patterns = [
			r'(ISO \d+)',
			r'(CMMI Level \d+)',
			r'(PMP certified)',
			r'(CISSP)',
			r'(CompTIA Security\+)',
			r'(FedRAMP)',
			r'(FISMA)',
			r'(SOC 2)',
			r'(AWS Certified)',
			r'(Microsoft Certified)'
		]
		
		for pattern in cert_patterns:
			matches = re.findall(pattern, content, re.IGNORECASE)
			certifications.extend(matches)
		
		return list(set(certifications))[:10]
	
	def _extract_past_performance_requirements(self, content: str, data: Dict[str, Any]) -> List[str]:
		"""Extract past performance requirements"""
		requirements = []
		
		performance_patterns = [
			r'past performance.*?[.;:]',
			r'previous experience.*?[.;:]',
			r'demonstrated experience.*?[.;:]',
			r'proven track record.*?[.;:]'
		]
		
		for pattern in performance_patterns:
			matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
			for match in matches[:3]:
				clean_req = match.strip(' .;:')
				if len(clean_req) > 20:
					requirements.append(clean_req[:200])
		
		return requirements
	
	def _extract_financial_requirements(self, content: str, data: Dict[str, Any]) -> Dict[str, Any]:
		"""Extract financial requirements"""
		requirements = {}
		
		# Look for financial indicators
		financial_patterns = [
			(r'bonding.*?\$?(\d+[,\d]*)', 'bonding_requirement'),
			(r'insurance.*?\$?(\d+[,\d]*)', 'insurance_requirement'),
			(r'line of credit.*?\$?(\d+[,\d]*)', 'credit_requirement'),
			(r'annual revenue.*?\$?(\d+[,\d]*)', 'revenue_requirement')
		]
		
		for pattern, req_type in financial_patterns:
			match = re.search(pattern, content.lower())
			if match:
				try:
					amount = match.group(1).replace(',', '')
					requirements[req_type] = float(amount)
				except (ValueError, TypeError) as e:
					logger.warning(f"Failed to parse financial requirement '{req_type}': {e}")
					requirements[req_type] = match.group(0)
		
		return requirements
	
	def _extract_geographic_restrictions(self, content: str, data: Dict[str, Any]) -> List[str]:
		"""Extract geographic restrictions"""
		restrictions = []
		
		geo_patterns = [
			r'must be located in ([^.;:]*)',
			r'headquarters.*?in ([^.;:]*)',
			r'domestic.*?only',
			r'us.*?based',
			r'conus.*?only'
		]
		
		for pattern in geo_patterns:
			matches = re.findall(pattern, content.lower())
			for match in matches:
				if isinstance(match, tuple):
					match = match[0]
				restrictions.append(match.strip())
		
		return restrictions[:5]
	
	def _calculate_eligibility_score(self, minimum_requirements: List[str], 
									 preferred_qualifications: List[str],
									 security_clearance: Optional[str],
									 certifications: List[str]) -> float:
		"""Calculate eligibility score based on requirements"""
		# This would be based on actual organizational capabilities
		# For now, return a placeholder score
		
		score_factors = []
		
		# Basic eligibility (assuming we meet most minimum requirements)
		if len(minimum_requirements) <= 3:
			score_factors.append(0.9)  # Easier to meet fewer requirements
		else:
			score_factors.append(0.7)  # More challenging
		
		# Security clearance impact
		if security_clearance:
			if 'top secret' in security_clearance.lower():
				score_factors.append(0.5)  # Harder to obtain
			else:
				score_factors.append(0.7)
		else:
			score_factors.append(0.9)  # No clearance required
		
		# Certification requirements
		if len(certifications) > 5:
			score_factors.append(0.6)  # Many certs required
		elif len(certifications) > 0:
			score_factors.append(0.8)
		else:
			score_factors.append(0.9)
		
		return min(np.mean(score_factors), 1.0)
	
	def _identify_qualification_gaps(self, minimum_requirements: List[str],
									 certifications: List[str],
									 security_clearance: Optional[str]) -> List[str]:
		"""Identify potential qualification gaps"""
		gaps = []
		
		# This would be based on actual organizational capabilities
		# For demonstration, identify some common gaps
		
		if security_clearance and 'top secret' in security_clearance.lower():
			gaps.append("Top Secret clearance required - may need to obtain")
		
		high_requirement_certifications = ['ISO 27001', 'CMMI Level 3', 'FedRAMP']
		for cert in certifications:
			if any(req in cert for req in high_requirement_certifications):
				gaps.append(f"May need to obtain: {cert}")
		
		return gaps[:5]
	
	def _calculate_attractiveness(self, classification: OpportunityClassification,
								  competitive_assessment: CompetitiveAssessment,
								  value_estimation: ValueEstimation) -> float:
		"""Calculate overall opportunity attractiveness"""
		factors = []
		
		# Value factor
		if value_estimation.estimated_value:
			value = float(value_estimation.estimated_value)
			if value > 10000000:  # $10M+
				factors.append(0.9)
			elif value > 1000000:  # $1M+
				factors.append(0.8)
			else:
				factors.append(0.6)
		else:
			factors.append(0.5)
		
		# Competition factor
		if competitive_assessment.competition_level == CompetitionLevel.LOW:
			factors.append(0.9)
		elif competitive_assessment.competition_level == CompetitionLevel.MODERATE:
			factors.append(0.7)
		else:
			factors.append(0.4)
		
		# Sector attractiveness
		attractive_sectors = [OpportunitySector.TECHNOLOGY, OpportunitySector.DEFENSE, OpportunitySector.HEALTHCARE]
		if classification.sector in attractive_sectors:
			factors.append(0.8)
		else:
			factors.append(0.6)
		
		return min(np.mean(factors), 1.0)
	
	def _calculate_strategic_alignment(self, classification: OpportunityClassification,
									   opportunity_data: Dict[str, Any],
									   historical_context: Optional[Dict[str, Any]]) -> float:
		"""Calculate strategic alignment score"""
		# This would be based on organizational strategy
		# For now, use sector and type alignment
		
		alignment_factors = []
		
		# Sector alignment (example preferences)
		preferred_sectors = [OpportunitySector.TECHNOLOGY, OpportunitySector.CONSULTING]
		if classification.sector in preferred_sectors:
			alignment_factors.append(0.9)
		else:
			alignment_factors.append(0.6)
		
		# Type alignment
		preferred_types = [OpportunityType.SOFTWARE, OpportunityType.CONSULTING, OpportunityType.SERVICES]
		if classification.type in preferred_types:
			alignment_factors.append(0.8)
		else:
			alignment_factors.append(0.5)
		
		# Historical performance alignment
		if historical_context and 'similar_opportunities' in historical_context:
			similar_perf = historical_context['similar_opportunities'].get('win_rate', 0.5)
			alignment_factors.append(similar_perf)
		else:
			alignment_factors.append(0.6)
		
		return min(np.mean(alignment_factors), 1.0)
	
	def _estimate_win_probability(self, competitive_assessment: CompetitiveAssessment,
								  eligibility_analysis: EligibilityAnalysis,
								  historical_context: Optional[Dict[str, Any]]) -> float:
		"""Estimate win probability"""
		probability_factors = []
		
		# Competition factor
		competition_probs = {
			CompetitionLevel.LOW: 0.8,
			CompetitionLevel.MODERATE: 0.6,
			CompetitionLevel.HIGH: 0.4,
			CompetitionLevel.INTENSE: 0.2,
			CompetitionLevel.UNKNOWN: 0.5
		}
		probability_factors.append(competition_probs[competitive_assessment.competition_level])
		
		# Eligibility factor
		probability_factors.append(eligibility_analysis.eligibility_score)
		
		# Incumbent disadvantage
		if competitive_assessment.incumbent_advantage:
			probability_factors.append(0.3)  # Much harder against incumbent
		else:
			probability_factors.append(0.7)
		
		# Historical performance
		if historical_context and 'overall_win_rate' in historical_context:
			probability_factors.append(historical_context['overall_win_rate'])
		else:
			probability_factors.append(0.5)  # Neutral assumption
		
		return min(np.mean(probability_factors), 1.0)
	
	def _generate_recommendation(self, attractiveness: float, strategic_alignment: float,
								 win_probability: float, competitive_assessment: CompetitiveAssessment,
								 timeline_analysis: TimelineAnalysis) -> Tuple[str, List[str]]:
		"""Generate pursue/monitor/decline recommendation"""
		
		reasons = []
		
		# Calculate composite score
		composite_score = (attractiveness * 0.3 + strategic_alignment * 0.3 + win_probability * 0.4)
		
		# Decision thresholds
		if composite_score >= 0.7:
			recommendation = "pursue"
			reasons.append(f"High overall score ({composite_score:.2f})")
			
			if win_probability >= 0.6:
				reasons.append(f"Good win probability ({win_probability:.2f})")
			if attractiveness >= 0.7:
				reasons.append(f"Attractive opportunity value and competition")
			if strategic_alignment >= 0.7:
				reasons.append(f"Strong strategic alignment")
		
		elif composite_score >= 0.5:
			recommendation = "monitor"
			reasons.append(f"Moderate overall score ({composite_score:.2f})")
			
			if timeline_analysis.preparation_time_days and timeline_analysis.preparation_time_days < 14:
				reasons.append("Short preparation time - monitor for similar future opportunities")
			else:
				reasons.append("Consider pursuing if additional intelligence becomes available")
		
		else:
			recommendation = "decline"
			reasons.append(f"Low overall score ({composite_score:.2f})")
			
			if win_probability < 0.3:
				reasons.append(f"Low win probability ({win_probability:.2f})")
			if competitive_assessment.competition_level == CompetitionLevel.INTENSE:
				reasons.append("Intense competition expected")
			if competitive_assessment.incumbent_advantage:
				reasons.append("Strong incumbent advantage")
		
		return recommendation, reasons
	
	def _calculate_analysis_confidence(self, *analysis_components) -> float:
		"""Calculate overall analysis confidence"""
		confidence_scores = []
		
		for component in analysis_components:
			if hasattr(component, 'confidence_score'):
				confidence_scores.append(component.confidence_score)
			elif hasattr(component, 'value_confidence'):
				confidence_scores.append(component.value_confidence)
			elif hasattr(component, 'timeline_confidence'):
				confidence_scores.append(component.timeline_confidence)
			elif hasattr(component, 'assessment_confidence'):
				confidence_scores.append(component.assessment_confidence)
			else:
				confidence_scores.append(0.7)  # Default
		
		return min(np.mean(confidence_scores), 1.0)
	
	def _assess_data_quality(self, opportunity_data: Dict[str, Any]) -> float:
		"""Assess quality of input data"""
		quality_factors = []
		
		# Data completeness
		total_fields = len(opportunity_data)
		populated_fields = len([k for k, v in opportunity_data.items() if v])
		completeness = populated_fields / max(total_fields, 1)
		quality_factors.append(completeness)
		
		# Key field availability
		key_fields = ['title', 'description', 'deadline', 'estimated_value']
		key_field_score = sum(1 for field in key_fields if field in opportunity_data and opportunity_data[field]) / len(key_fields)
		quality_factors.append(key_field_score)
		
		# Content length (proxy for detail)
		total_content_length = sum(len(str(v)) for v in opportunity_data.values() if v)
		if total_content_length > 2000:
			quality_factors.append(0.9)
		elif total_content_length > 500:
			quality_factors.append(0.7)
		else:
			quality_factors.append(0.4)
		
		return min(np.mean(quality_factors), 1.0)
	
	def _is_large_opportunity(self, data: Dict[str, Any]) -> bool:
		"""Check if this is a large opportunity"""
		try:
			if 'estimated_value' in data:
				value = float(data['estimated_value'].replace('$', '').replace(',', ''))
				return value > 5000000  # $5M+
		except (ValueError, TypeError, AttributeError) as e:
			logger.warning(f"Failed to parse estimated_value for large opportunity check: {e}")
		
		return False
	
	def _assess_time_pressure(self, data: Dict[str, Any]) -> str:
		"""Assess time pressure for the opportunity"""
		if 'deadline' in data:
			try:
				deadline = self._parse_date(data['deadline'])
				now = datetime.now(timezone.utc)
				days_remaining = (deadline - now).days
				
				if days_remaining < 14:
					return 'high'
				elif days_remaining < 30:
					return 'medium'
				else:
					return 'low'
			except (ValueError, TypeError) as e:
				logger.warning(f"Failed to parse deadline for time pressure assessment: {e}")
		
		return 'medium'
	
	def _update_analysis_stats(self, start_time: datetime, success: bool):
		"""Update analysis statistics"""
		duration = (datetime.now(timezone.utc) - start_time).total_seconds()
		
		self.analysis_stats['total_analyses'] += 1
		self.analysis_stats['processing_times'].append(duration)
		
		if not success:
			self.analysis_stats['error_rate'] = (
				self.analysis_stats.get('error_count', 0) + 1
			) / self.analysis_stats['total_analyses']
		
		# Keep only last 100 processing times
		if len(self.analysis_stats['processing_times']) > 100:
			self.analysis_stats['processing_times'] = self.analysis_stats['processing_times'][-100:]
	
	def get_analysis_statistics(self) -> Dict[str, Any]:
		"""Get analysis performance statistics"""
		stats = self.analysis_stats.copy()
		
		if self.analysis_stats['processing_times']:
			stats['avg_processing_time'] = np.mean(self.analysis_stats['processing_times'])
			stats['max_processing_time'] = np.max(self.analysis_stats['processing_times'])
		
		return stats


# Factory function for easy instantiation
def create_opportunity_analyzer(model_cache_dir: Optional[Path] = None,
								competitive_intelligence_db: Optional[Path] = None) -> OpportunityAnalyzer:
	"""Create OpportunityAnalyzer with optional custom configuration"""
	return OpportunityAnalyzer(
		model_cache_dir=model_cache_dir,
		competitive_intelligence_db=competitive_intelligence_db
	)