#!/usr/bin/env python3
"""
Deadline Extractor

Specialized extractor for identifying and parsing dates, times, deadlines, and
temporal expressions from documents with support for various date formats,
relative dates, and business temporal patterns.
"""

import asyncio
import logging
import re
from typing import Dict, List, Optional, Any, Union, Tuple, Set
from datetime import datetime, date, timedelta, timezone
from dataclasses import dataclass
from enum import Enum
import calendar

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

# Enhanced date parsing
try:
	import dateutil.parser as dateparser
	from dateutil.relativedelta import relativedelta
	HAS_DATEUTIL = True
except ImportError:
	HAS_DATEUTIL = False

# spaCy for temporal entity recognition
try:
	import spacy
	from spacy.tokens import Doc, Token, Span
	HAS_SPACY_SUPPORT = True
except ImportError:
	HAS_SPACY_SUPPORT = False
	# Create dummy types for when spaCy is not available
	class Doc: pass
	class Token: pass
	class Span: pass

# Ollama integration for AI-powered temporal understanding
import httpx
import json


class TemporalType(str, Enum):
	"""Types of temporal expressions"""
	ABSOLUTE_DATE = "absolute_date"        # "January 15, 2024"
	ABSOLUTE_TIME = "absolute_time"        # "3:00 PM"
	ABSOLUTE_DATETIME = "absolute_datetime" # "January 15, 2024 at 3:00 PM"
	RELATIVE_DATE = "relative_date"        # "next week", "in 3 days"
	RELATIVE_TIME = "relative_time"        # "in 2 hours"
	DURATION = "duration"                  # "2 weeks", "3 months"
	DEADLINE = "deadline"                  # "due by Friday"
	MILESTONE = "milestone"                # "Phase 1 completion: March 2024"
	BUSINESS_DATE = "business_date"        # "end of quarter", "fiscal year"
	RECURRING = "recurring"                # "weekly", "monthly"
	DATE_RANGE = "date_range"             # "January 1-15, 2024"
	FUZZY_DATE = "fuzzy_date"             # "early 2024", "mid-quarter"


class UrgencyLevel(str, Enum):
	"""Urgency levels for deadlines"""
	CRITICAL = "critical"    # Within 1 week
	HIGH = "high"           # Within 1 month
	MEDIUM = "medium"       # Within 3 months
	LOW = "low"            # Beyond 3 months
	UNKNOWN = "unknown"     # Cannot determine urgency


@dataclass
class TemporalExpression:
	"""Extracted temporal expression with metadata"""
	id: str
	text: str
	temporal_type: TemporalType
	start_char: int
	end_char: int
	confidence: float
	
	# Parsed temporal values
	parsed_date: Optional[datetime] = None
	start_date: Optional[datetime] = None
	end_date: Optional[datetime] = None
	duration_days: Optional[int] = None
	
	# Context and metadata
	context: Optional[str] = None
	associated_entity: Optional[str] = None  # Project, deliverable, etc.
	urgency_level: UrgencyLevel = UrgencyLevel.UNKNOWN
	is_deadline: bool = False
	is_milestone: bool = False
	is_recurring: bool = False
	
	# Extraction metadata
	extraction_method: str = ""
	original_format: str = ""
	normalization_confidence: float = 0.0
	ai_insights: Dict[str, Any] = None
	
	def __post_init__(self):
		if self.ai_insights is None:
			self.ai_insights = {}


@dataclass
class BusinessCalendar:
	"""Business calendar information for temporal calculations"""
	fiscal_year_start: int = 1  # January = 1
	business_days: Set[int] = None  # 0=Monday, 6=Sunday
	holidays: List[date] = None
	quarters: Dict[int, Tuple[int, int]] = None  # quarter -> (start_month, end_month)
	
	def __post_init__(self):
		if self.business_days is None:
			self.business_days = {0, 1, 2, 3, 4}  # Monday-Friday
		if self.holidays is None:
			self.holidays = []
		if self.quarters is None:
			self.quarters = {
				1: (1, 3),   # Q1: Jan-Mar
				2: (4, 6),   # Q2: Apr-Jun
				3: (7, 9),   # Q3: Jul-Sep
				4: (10, 12)  # Q4: Oct-Dec
			}


class DeadlineExtractionResult:
	"""Result of deadline/temporal extraction"""
	
	def __init__(self):
		self.success: bool = False
		self.original_text: str = ""
		self.temporal_expressions: List[TemporalExpression] = []
		self.deadlines: List[TemporalExpression] = []  # Filtered deadlines
		self.milestones: List[TemporalExpression] = []  # Filtered milestones
		self.timeline: List[Tuple[datetime, str]] = []  # Chronological timeline
		self.statistics: Dict[str, Any] = {}
		self.errors: List[str] = []
		self.warnings: List[str] = []
		self.processing_time: float = 0.0
		self.methods_used: List[str] = []
		self.ai_analysis: Dict[str, Any] = {}


class DeadlineExtractor:
	"""Advanced deadline and temporal expression extractor"""
	
	def __init__(self, config: Optional[Dict[str, Any]] = None):
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)
		
		# Business calendar
		self.business_calendar = BusinessCalendar()
		
		# spaCy model for temporal NER
		self.nlp_model = None
		
		# Initialize Ollama client
		self.ollama_client = httpx.AsyncClient(
			base_url=self.config['ollama_base_url'],
			timeout=self.config['ollama_timeout']
		)
		
		# Initialize components
		self._initialize_nlp_components()
		self._compile_temporal_patterns()
		self._load_temporal_vocabularies()
		
		self.logger.info("Deadline extractor initialized")
	
	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			# Model settings
			'spacy_model': 'en_core_web_sm',
			'use_spacy_temporal': HAS_SPACY_SUPPORT,
			'use_dateutil_parsing': HAS_DATEUTIL,
			'use_ai_enhancement': True,
			
			# Ollama settings
			'ollama_base_url': 'http://localhost:11434',
			'ollama_model': 'llama3.2:3b',
			'ollama_timeout': 120.0,
			
			# Extraction methods
			'extract_absolute_dates': True,
			'extract_relative_dates': True,
			'extract_business_dates': True,
			'extract_deadlines': True,
			'extract_milestones': True,
			'extract_durations': True,
			'extract_date_ranges': True,
			
			# Processing options
			'reference_date': None,  # Use current date if None
			'timezone': 'UTC',
			'min_confidence_threshold': 0.4,
			'normalize_dates': True,
			'calculate_urgency': True,
			'build_timeline': True,
			'context_window': 75,
			
			# Business calendar settings
			'fiscal_year_start_month': 1,  # January
			'include_weekends': False,
			'business_hours_start': 9,
			'business_hours_end': 17,
			
			# AI enhancement settings
			'ai_chunk_size': 3000,
			'ai_temporal_validation': True,
			'ai_implicit_deadlines': True,
			
			# Date format preferences
			'preferred_date_formats': [
				'%Y-%m-%d',      # 2024-01-15
				'%m/%d/%Y',      # 01/15/2024
				'%B %d, %Y',     # January 15, 2024
				'%d %B %Y',      # 15 January 2024
				'%b %d, %Y'      # Jan 15, 2024
			],
			
			# Performance settings
			'max_text_length': 300000,
			'parallel_processing': True
		}
	
	def _initialize_nlp_components(self):
		"""Initialize spaCy components"""
		if self.config['use_spacy_temporal'] and HAS_SPACY_SUPPORT:
			try:
				self.nlp_model = spacy.load(self.config['spacy_model'])
				self.logger.info(f"spaCy model '{self.config['spacy_model']}' loaded for temporal extraction")
			except IOError:
				self.logger.warning(f"Could not load spaCy model '{self.config['spacy_model']}'")
				self.nlp_model = None
	
	def _compile_temporal_patterns(self):
		"""Compile regex patterns for temporal extraction"""
		# Absolute date patterns
		self.absolute_date_patterns = [
			# ISO format: 2024-01-15
			re.compile(r'\b\d{4}-\d{2}-\d{2}\b'),
			
			# US format: 01/15/2024, 1/15/2024
			re.compile(r'\b\d{1,2}/\d{1,2}/\d{4}\b'),
			
			# European format: 15/01/2024
			re.compile(r'\b\d{1,2}/\d{1,2}/\d{4}\b'),
			
			# Month day, year: January 15, 2024
			re.compile(r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b', re.IGNORECASE),
			
			# Day month year: 15 January 2024
			re.compile(r'\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b', re.IGNORECASE),
			
			# Short month: Jan 15, 2024
			re.compile(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b', re.IGNORECASE)
		]
		
		# Time patterns
		self.time_patterns = [
			# 12-hour format: 3:00 PM, 3:00pm, 3 PM
			re.compile(r'\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\b'),
			re.compile(r'\b\d{1,2}\s*(?:AM|PM|am|pm)\b'),
			
			# 24-hour format: 15:00, 15:30
			re.compile(r'\b\d{1,2}:\d{2}\b'),
		]
		
		# Relative date patterns
		self.relative_date_patterns = [
			# "in X days/weeks/months"
			re.compile(r'\bin\s+\d+\s+(?:days?|weeks?|months?|years?)\b', re.IGNORECASE),
			
			# "X days/weeks/months from now"
			re.compile(r'\b\d+\s+(?:days?|weeks?|months?|years?)\s+from\s+now\b', re.IGNORECASE),
			
			# "next/last week/month/year"
			re.compile(r'\b(?:next|last)\s+(?:week|month|quarter|year)\b', re.IGNORECASE),
			
			# Days of week: "next Monday", "this Friday"
			re.compile(r'\b(?:this|next|last)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b', re.IGNORECASE),
			
			# "end of month/quarter/year"
			re.compile(r'\bend\s+of\s+(?:month|quarter|year|week)\b', re.IGNORECASE),
			
			# "beginning/start of..."
			re.compile(r'\b(?:beginning|start)\s+of\s+(?:month|quarter|year|week)\b', re.IGNORECASE)
		]
		
		# Deadline patterns
		self.deadline_patterns = [
			# "due by/on..."
			re.compile(r'\bdue\s+(?:by|on|before)\s+([^.!?]+?)(?:\.|,|$)', re.IGNORECASE),
			
			# "deadline is/of..."
			re.compile(r'\bdeadline\s+(?:is|of|for)\s+([^.!?]+?)(?:\.|,|$)', re.IGNORECASE),
			
			# "must be completed by..."
			re.compile(r'\bmust\s+be\s+completed\s+(?:by|before)\s+([^.!?]+?)(?:\.|,|$)', re.IGNORECASE),
			
			# "submit by..."
			re.compile(r'\b(?:submit|deliver|provide)\s+(?:by|before)\s+([^.!?]+?)(?:\.|,|$)', re.IGNORECASE),
			
			# "no later than..."
			re.compile(r'\bno\s+later\s+than\s+([^.!?]+?)(?:\.|,|$)', re.IGNORECASE)
		]
		
		# Duration patterns
		self.duration_patterns = [
			# "X days/weeks/months/years"
			re.compile(r'\b\d+\s+(?:days?|weeks?|months?|years?)\b', re.IGNORECASE),
			
			# "X-Y days"
			re.compile(r'\b\d+-\d+\s+(?:days?|weeks?|months?|years?)\b', re.IGNORECASE),
			
			# "up to X days"
			re.compile(r'\bup\s+to\s+\d+\s+(?:days?|weeks?|months?|years?)\b', re.IGNORECASE),
			
			# "within X days"
			re.compile(r'\bwithin\s+\d+\s+(?:days?|weeks?|months?|years?)\b', re.IGNORECASE)
		]
		
		# Business date patterns
		self.business_date_patterns = [
			# Quarters: Q1, Q2, Q3, Q4, first quarter, etc.
			re.compile(r'\b(?:Q[1-4]|(?:first|second|third|fourth)\s+quarter)\b', re.IGNORECASE),
			
			# Fiscal year
			re.compile(r'\bfiscal\s+year\s+\d{4}\b', re.IGNORECASE),
			re.compile(r'\bFY\s*\d{4}\b'),
			
			# End of fiscal periods
			re.compile(r'\bend\s+of\s+(?:fiscal\s+)?(?:year|quarter)\b', re.IGNORECASE),
			
			# Business days
			re.compile(r'\b\d+\s+business\s+days?\b', re.IGNORECASE)
		]
	
	def _load_temporal_vocabularies(self):
		"""Load temporal vocabularies and mappings"""
		# Month mappings
		self.month_names = {
			'january': 1, 'jan': 1,
			'february': 2, 'feb': 2,
			'march': 3, 'mar': 3,
			'april': 4, 'apr': 4,
			'may': 5,
			'june': 6, 'jun': 6,
			'july': 7, 'jul': 7,
			'august': 8, 'aug': 8,
			'september': 9, 'sep': 9, 'sept': 9,
			'october': 10, 'oct': 10,
			'november': 11, 'nov': 11,
			'december': 12, 'dec': 12
		}
		
		# Day mappings
		self.day_names = {
			'monday': 0, 'mon': 0,
			'tuesday': 1, 'tue': 1, 'tues': 1,
			'wednesday': 2, 'wed': 2,
			'thursday': 3, 'thu': 3, 'thur': 3, 'thurs': 3,
			'friday': 4, 'fri': 4,
			'saturday': 5, 'sat': 5,
			'sunday': 6, 'sun': 6
		}
		
		# Relative time keywords
		self.relative_keywords = {
			'today': 0,
			'tomorrow': 1,
			'yesterday': -1,
			'next week': 7,
			'last week': -7,
			'next month': 30,  # Approximate
			'last month': -30,
			'next year': 365,
			'last year': -365
		}
		
		# Quarter mappings
		self.quarter_mappings = {
			'q1': (1, 3), 'first quarter': (1, 3),
			'q2': (4, 6), 'second quarter': (4, 6),
			'q3': (7, 9), 'third quarter': (7, 9),
			'q4': (10, 12), 'fourth quarter': (10, 12)
		}
	
	async def extract_deadlines(
		self,
		text: str,
		reference_date: Optional[datetime] = None,
		use_ai: Optional[bool] = None
	) -> DeadlineExtractionResult:
		"""Extract deadlines and temporal expressions from text"""
		start_time = asyncio.get_event_loop().time()
		result = DeadlineExtractionResult()
		result.original_text = text
		
		if not text or not text.strip():
			result.success = True
			return result
		
		try:
			# Set reference date
			if reference_date is None:
				reference_date = datetime.now()
			
			# Check text length
			if len(text) > self.config['max_text_length']:
				result.warnings.append(f"Text truncated to {self.config['max_text_length']} characters")
				text = text[:self.config['max_text_length']]
			
			methods_used = []
			all_temporal_expressions = []
			
			# Method 1: spaCy temporal NER
			if self.config['use_spacy_temporal'] and self.nlp_model:
				spacy_expressions = await self._extract_with_spacy(text, reference_date)
				all_temporal_expressions.extend(spacy_expressions)
				methods_used.append("spacy_temporal")
			
			# Method 2: Pattern-based extraction
			pattern_expressions = await self._extract_with_patterns(text, reference_date)
			all_temporal_expressions.extend(pattern_expressions)
			methods_used.append("pattern_matching")
			
			# Method 3: Dateutil parsing
			if self.config['use_dateutil_parsing'] and HAS_DATEUTIL:
				dateutil_expressions = await self._extract_with_dateutil(text, reference_date)
				all_temporal_expressions.extend(dateutil_expressions)
				methods_used.append("dateutil_parsing")
			
			# Method 4: AI-enhanced extraction
			if (use_ai or self.config['use_ai_enhancement']) and len(text) < 50000:
				ai_expressions, ai_analysis = await self._extract_with_ai(text, reference_date)
				all_temporal_expressions.extend(ai_expressions)
				result.ai_analysis = ai_analysis
				methods_used.append("ai_enhancement")
			
			# Merge and deduplicate temporal expressions
			merged_expressions = self._merge_temporal_expressions(all_temporal_expressions)
			
			# Filter by confidence threshold
			filtered_expressions = [
				expr for expr in merged_expressions
				if expr.confidence >= self.config['min_confidence_threshold']
			]
			
			# Normalize dates
			if self.config['normalize_dates']:
				for expr in filtered_expressions:
					self._normalize_temporal_expression(expr, reference_date)
			
			# Calculate urgency levels
			if self.config['calculate_urgency']:
				for expr in filtered_expressions:
					expr.urgency_level = self._calculate_urgency(expr, reference_date)
			
			# Add context
			for expr in filtered_expressions:
				if not expr.context:
					expr.context = self._extract_temporal_context(text, expr)
			
			# Separate deadlines and milestones
			deadlines = [expr for expr in filtered_expressions if expr.is_deadline or expr.temporal_type == TemporalType.DEADLINE]
			milestones = [expr for expr in filtered_expressions if expr.is_milestone or expr.temporal_type == TemporalType.MILESTONE]
			
			# Build timeline
			timeline = []
			if self.config['build_timeline']:
				timeline = self._build_timeline(filtered_expressions)
			
			# Calculate statistics
			statistics = self._calculate_temporal_statistics(filtered_expressions, reference_date)
			
			result.temporal_expressions = filtered_expressions
			result.deadlines = deadlines
			result.milestones = milestones
			result.timeline = timeline
			result.statistics = statistics
			result.methods_used = methods_used
			result.success = True
			result.processing_time = asyncio.get_event_loop().time() - start_time
			
			self.logger.info(f"Deadlines extracted successfully, time: {result.processing_time:.2f}s")
		
		except Exception as e:
			result.errors.append(f"Deadline extraction failed: {str(e)}")
			self.logger.error(f"Deadline extraction error: {e}")
		
		return result
	
	async def _extract_with_spacy(self, text: str, reference_date: datetime) -> List[TemporalExpression]:
		"""Extract temporal expressions using spaCy"""
		expressions = []
		
		# Process text with spaCy
		doc = self.nlp_model(text)
		
		# Extract DATE and TIME entities
		for ent in doc.ents:
			if ent.label_ in ['DATE', 'TIME']:
				expr = self._create_temporal_expression_from_spacy(ent, reference_date)
				if expr:
					expressions.append(expr)
		
		return expressions
	
	def _create_temporal_expression_from_spacy(self, ent: Span, reference_date: datetime) -> Optional[TemporalExpression]:
		"""Create temporal expression from spaCy entity"""
		text = ent.text.strip()
		if not text:
			return None
		
		# Determine temporal type
		temporal_type = TemporalType.ABSOLUTE_DATE
		if ent.label_ == 'TIME':
			temporal_type = TemporalType.ABSOLUTE_TIME
		elif self._is_relative_expression(text):
			temporal_type = TemporalType.RELATIVE_DATE
		elif self._is_deadline_expression(text):
			temporal_type = TemporalType.DEADLINE
		
		# Try to parse the date
		parsed_date = self._parse_date_string(text, reference_date)
		
		expr = TemporalExpression(
			id=uuid7str(),
			text=text,
			temporal_type=temporal_type,
			start_char=ent.start_char,
			end_char=ent.end_char,
			confidence=0.8,  # spaCy base confidence
			parsed_date=parsed_date,
			extraction_method="spacy_ner",
			original_format=text
		)
		
		# Set flags based on type
		if temporal_type == TemporalType.DEADLINE:
			expr.is_deadline = True
		
		return expr
	
	async def _extract_with_patterns(self, text: str, reference_date: datetime) -> List[TemporalExpression]:
		"""Extract temporal expressions using regex patterns"""
		expressions = []
		
		# Extract absolute dates
		if self.config['extract_absolute_dates']:
			for pattern in self.absolute_date_patterns:
				for match in pattern.finditer(text):
					expr = self._create_temporal_expression_from_pattern(
						match, TemporalType.ABSOLUTE_DATE, reference_date, "absolute_date_pattern"
					)
					if expr:
						expressions.append(expr)
		
		# Extract relative dates
		if self.config['extract_relative_dates']:
			for pattern in self.relative_date_patterns:
				for match in pattern.finditer(text):
					expr = self._create_temporal_expression_from_pattern(
						match, TemporalType.RELATIVE_DATE, reference_date, "relative_date_pattern"
					)
					if expr:
						expressions.append(expr)
		
		# Extract deadlines
		if self.config['extract_deadlines']:
			for pattern in self.deadline_patterns:
				for match in pattern.finditer(text):
					# For deadline patterns, we typically capture the date part
					date_part = match.group(1) if match.groups() else match.group()
					
					expr = TemporalExpression(
						id=uuid7str(),
						text=date_part.strip(),
						temporal_type=TemporalType.DEADLINE,
						start_char=match.start(),
						end_char=match.end(),
						confidence=0.9,  # High confidence for deadline patterns
						is_deadline=True,
						extraction_method="deadline_pattern",
						original_format=match.group()
					)
					
					# Try to parse the date part
					expr.parsed_date = self._parse_date_string(date_part, reference_date)
					expressions.append(expr)
		
		# Extract durations
		if self.config['extract_durations']:
			for pattern in self.duration_patterns:
				for match in pattern.finditer(text):
					expr = self._create_temporal_expression_from_pattern(
						match, TemporalType.DURATION, reference_date, "duration_pattern"
					)
					if expr:
						# Calculate duration in days
						duration_text = match.group().lower()
						expr.duration_days = self._parse_duration_to_days(duration_text)
						expressions.append(expr)
		
		# Extract business dates
		if self.config['extract_business_dates']:
			for pattern in self.business_date_patterns:
				for match in pattern.finditer(text):
					expr = self._create_temporal_expression_from_pattern(
						match, TemporalType.BUSINESS_DATE, reference_date, "business_date_pattern"
					)
					if expr:
						# Try to resolve business date
						expr.parsed_date = self._parse_business_date(match.group(), reference_date)
						expressions.append(expr)
		
		return expressions
	
	def _create_temporal_expression_from_pattern(
		self,
		match: re.Match,
		temporal_type: TemporalType,
		reference_date: datetime,
		method: str
	) -> Optional[TemporalExpression]:
		"""Create temporal expression from regex match"""
		text = match.group().strip()
		if not text:
			return None
		
		parsed_date = self._parse_date_string(text, reference_date)
		confidence = 0.7  # Base confidence for pattern matches
		
		# Adjust confidence based on pattern quality
		if temporal_type == TemporalType.ABSOLUTE_DATE and parsed_date:
			confidence = 0.9
		elif temporal_type == TemporalType.RELATIVE_DATE:
			confidence = 0.6
		
		return TemporalExpression(
			id=uuid7str(),
			text=text,
			temporal_type=temporal_type,
			start_char=match.start(),
			end_char=match.end(),
			confidence=confidence,
			parsed_date=parsed_date,
			extraction_method=method,
			original_format=text
		)
	
	async def _extract_with_dateutil(self, text: str, reference_date: datetime) -> List[TemporalExpression]:
		"""Extract temporal expressions using dateutil parser"""
		expressions = []
		
		# Split text into sentences and try to parse each for dates
		sentences = re.split(r'[.!?]+', text)
		char_offset = 0
		
		for sentence in sentences:
			sentence = sentence.strip()
			if not sentence:
				char_offset += len(sentence) + 1
				continue
			
			# Look for potential date strings in the sentence
			words = sentence.split()
			for i, word in enumerate(words):
				# Try parsing individual words and word combinations
				for j in range(i + 1, min(i + 6, len(words) + 1)):  # Up to 5 words
					date_candidate = ' '.join(words[i:j])
					
					try:
						if HAS_DATEUTIL:
							parsed_date = dateparser.parse(date_candidate, fuzzy=True)
							if parsed_date:
								# Find position in original text
								start_pos = text.find(date_candidate, char_offset)
								if start_pos != -1:
									expr = TemporalExpression(
										id=uuid7str(),
										text=date_candidate,
										temporal_type=TemporalType.ABSOLUTE_DATE,
										start_char=start_pos,
										end_char=start_pos + len(date_candidate),
										confidence=0.6,  # dateutil can be fuzzy
										parsed_date=parsed_date,
										extraction_method="dateutil_parser",
										original_format=date_candidate
									)
									expressions.append(expr)
					except (ValueError, TypeError, OverflowError):
						continue
			
			char_offset += len(sentence) + 1
		
		return expressions
	
	async def _extract_with_ai(self, text: str, reference_date: datetime) -> Tuple[List[TemporalExpression], Dict[str, Any]]:
		"""Extract temporal expressions using AI enhancement"""
		expressions = []
		ai_analysis = {}
		
		try:
			# Split text into chunks if needed
			chunks = self._split_text_for_ai_analysis(text)
			
			for chunk_idx, chunk in enumerate(chunks):
				chunk_expressions, chunk_analysis = await self._analyze_chunk_for_temporal(
					chunk, chunk_idx, reference_date
				)
				expressions.extend(chunk_expressions)
				ai_analysis[f'chunk_{chunk_idx}'] = chunk_analysis
			
			# Global temporal analysis
			if len(text) < self.config['ai_chunk_size']:
				global_analysis = await self._perform_global_temporal_analysis(text, reference_date)
				ai_analysis['global'] = global_analysis
		
		except Exception as e:
			self.logger.warning(f"AI temporal extraction failed: {e}")
			ai_analysis['error'] = str(e)
		
		return expressions, ai_analysis
	
	async def _analyze_chunk_for_temporal(self, chunk: str, chunk_idx: int, reference_date: datetime) -> Tuple[List[TemporalExpression], Dict[str, Any]]:
		"""Analyze chunk for temporal expressions using AI"""
		ref_date_str = reference_date.strftime('%Y-%m-%d')
		
		prompt = f"""Analyze this text and identify all temporal expressions including dates, times, deadlines, milestones, and durations.

Reference date: {ref_date_str}

Look for:
- Absolute dates (January 15, 2024, 2024-01-15, 01/15/2024)
- Relative dates (next week, in 3 days, end of month)
- Times (3:00 PM, 15:30, morning, afternoon)
- Deadlines (due by Friday, must be completed by...)
- Milestones (Phase 1 completion, project kickoff)
- Durations (2 weeks, 3 months, 30 days)
- Business dates (Q1 2024, fiscal year end, end of quarter)

Text to analyze:
{chunk}

For each temporal expression provide:
{{
  "temporal_expressions": [
    {{
      "text": "January 15, 2024",
      "type": "ABSOLUTE_DATE",
      "parsed_date": "2024-01-15",
      "is_deadline": false,
      "is_milestone": false,
      "confidence": 0.9,
      "context": "Project deliverables are due January 15, 2024"
    }}
  ],
  "analysis": {{
    "temporal_density": "high|medium|low",
    "most_urgent_deadline": "January 15, 2024",
    "timeline_clarity": "clear|somewhat_clear|unclear"
  }}
}}"""
		
		try:
			response = await self.ollama_client.post("/api/generate", json={
				"model": self.config['ollama_model'],
				"prompt": prompt,
				"stream": False,
				"options": {
					"temperature": 0.1,
					"top_p": 0.9,
					"num_predict": 2000
				}
			})
			
			if response.status_code == 200:
				ai_response = response.json()
				response_text = ai_response.get('response', '').strip()
				
				try:
					ai_data = json.loads(response_text)
					expressions = self._convert_ai_temporal_expressions(
						ai_data.get('temporal_expressions', []), chunk, reference_date
					)
					analysis = ai_data.get('analysis', {})
					analysis['raw_response'] = response_text
					return expressions, analysis
				
				except json.JSONDecodeError:
					expressions = self._parse_ai_text_temporal(response_text, chunk, reference_date)
					analysis = {'raw_response': response_text, 'parsing_method': 'text_fallback'}
					return expressions, analysis
		
		except Exception as e:
			self.logger.warning(f"AI chunk temporal analysis failed: {e}")
		
		return [], {'error': 'AI analysis failed'}
	
	async def _perform_global_temporal_analysis(self, text: str, reference_date: datetime) -> Dict[str, Any]:
		"""Perform global temporal analysis"""
		prompt = f"""Analyze the overall temporal structure and timeline of this document.

Text (first 2500 characters):
{text[:2500]}...

Provide comprehensive temporal analysis:
{{
  "timeline_overview": {{
    "project_duration_estimated": "6 months",
    "key_phases": ["Planning", "Development", "Testing", "Deployment"],
    "critical_path_items": ["System design approval", "Development completion"],
    "temporal_complexity": "high|medium|low"
  }},
  "deadline_analysis": {{
    "total_deadlines": 5,
    "most_critical": "January 15, 2024 - Final delivery",
    "potential_conflicts": ["Design review overlaps with development start"],
    "missing_deadlines": ["Testing phase completion date not specified"]
  }},
  "milestone_structure": {{
    "major_milestones": ["Project kickoff", "Phase 1 completion", "Go-live"],
    "milestone_distribution": "well_distributed|clustered|sparse"
  }},
  "temporal_insights": ["Aggressive timeline", "Clear milestone structure", "Potential resource conflicts in Q2"]
}}"""
		
		try:
			response = await self.ollama_client.post("/api/generate", json={
				"model": self.config['ollama_model'],
				"prompt": prompt,
				"stream": False,
				"options": {"temperature": 0.1}
			})
			
			if response.status_code == 200:
				ai_response = response.json()
				response_text = ai_response.get('response', '').strip()
				
				try:
					return json.loads(response_text)
				except json.JSONDecodeError:
					return {'raw_response': response_text, 'parsed': False}
		
		except Exception as e:
			self.logger.warning(f"Global temporal analysis failed: {e}")
		
		return {'error': 'Global analysis failed'}
	
	def _convert_ai_temporal_expressions(
		self,
		ai_expressions: List[Dict[str, Any]],
		chunk: str,
		reference_date: datetime
	) -> List[TemporalExpression]:
		"""Convert AI temporal expressions to TemporalExpression objects"""
		expressions = []
		
		for ai_expr in ai_expressions:
			try:
				# Map AI type to TemporalType
				temporal_type = self._map_ai_type_to_temporal_type(ai_expr.get('type', 'ABSOLUTE_DATE'))
				
				# Parse the date if provided
				parsed_date = None
				if ai_expr.get('parsed_date'):
					try:
						parsed_date = datetime.fromisoformat(ai_expr['parsed_date'].replace('Z', '+00:00'))
					except (ValueError, TypeError) as e:
						self.logger.warning(f"Failed to parse AI-provided date '{ai_expr['parsed_date']}': {e}")
						parsed_date = self._parse_date_string(ai_expr['text'], reference_date)
				
				expr = TemporalExpression(
					id=uuid7str(),
					text=ai_expr.get('text', ''),
					temporal_type=temporal_type,
					confidence=min(ai_expr.get('confidence', 0.5), 1.0),
					parsed_date=parsed_date,
					context=ai_expr.get('context'),
					is_deadline=ai_expr.get('is_deadline', False),
					is_milestone=ai_expr.get('is_milestone', False),
					extraction_method="ai_enhancement",
					ai_insights={'source': 'ollama', 'original_data': ai_expr}
				)
				
				# Try to find position in chunk
				if expr.text in chunk:
					start_pos = chunk.find(expr.text)
					if start_pos != -1:
						expr.start_char = start_pos
						expr.end_char = start_pos + len(expr.text)
				
				expressions.append(expr)
			
			except Exception as e:
				self.logger.warning(f"Failed to convert AI temporal expression: {e}")
				continue
		
		return expressions
	
	def _parse_ai_text_temporal(self, response_text: str, chunk: str, reference_date: datetime) -> List[TemporalExpression]:
		"""Parse AI response as text when JSON parsing fails"""
		expressions = []
		lines = response_text.split('\n')
		
		for line in lines:
			line = line.strip()
			if not line:
				continue
			
			# Look for date-like patterns in AI response
			if any(keyword in line.lower() for keyword in ['date:', 'deadline:', 'due:', 'by:']):
				# Extract potential date strings
				date_matches = re.findall(r'\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b', line, re.IGNORECASE)
				
				for date_str in date_matches:
					parsed_date = self._parse_date_string(date_str, reference_date)
					if parsed_date:
						expr = TemporalExpression(
							id=uuid7str(),
							text=date_str,
							temporal_type=TemporalType.ABSOLUTE_DATE,
							confidence=0.4,
							parsed_date=parsed_date,
							extraction_method="ai_text_parsing",
							ai_insights={'source': 'text_parsing'}
						)
						expressions.append(expr)
		
		return expressions
	
	def _map_ai_type_to_temporal_type(self, ai_type: str) -> TemporalType:
		"""Map AI-detected type to TemporalType enum"""
		ai_type_upper = ai_type.upper()
		
		# Try direct mapping first
		try:
			return TemporalType(ai_type_upper)
		except ValueError:
			pass
		
		# Fallback mappings
		mapping = {
			'DATE': TemporalType.ABSOLUTE_DATE,
			'TIME': TemporalType.ABSOLUTE_TIME,
			'RELATIVE': TemporalType.RELATIVE_DATE,
			'DUE': TemporalType.DEADLINE,
			'MILESTONE': TemporalType.MILESTONE,
			'DURATION': TemporalType.DURATION,
			'QUARTER': TemporalType.BUSINESS_DATE,
			'FISCAL': TemporalType.BUSINESS_DATE
		}
		
		return mapping.get(ai_type_upper, TemporalType.ABSOLUTE_DATE)
	
	def _merge_temporal_expressions(self, expressions: List[TemporalExpression]) -> List[TemporalExpression]:
		"""Merge and deduplicate temporal expressions"""
		if not expressions:
			return []
		
		# Sort by position
		expressions.sort(key=lambda x: (x.start_char, x.end_char))
		
		merged = []
		for expr in expressions:
			# Check for overlaps with existing expressions
			overlap_found = False
			for existing in merged:
				if self._temporal_expressions_overlap(expr, existing):
					# Keep the one with higher confidence or better method
					if (expr.confidence > existing.confidence or
						self._get_temporal_method_priority(expr.extraction_method) >
						self._get_temporal_method_priority(existing.extraction_method)):
						merged.remove(existing)
						merged.append(expr)
					overlap_found = True
					break
			
			if not overlap_found:
				merged.append(expr)
		
		return merged
	
	def _temporal_expressions_overlap(self, expr1: TemporalExpression, expr2: TemporalExpression) -> bool:
		"""Check if two temporal expressions overlap"""
		# Text overlap
		if not (expr1.end_char <= expr2.start_char or expr2.end_char <= expr1.start_char):
			return True
		
		# Semantic overlap - same parsed date
		if (expr1.parsed_date and expr2.parsed_date and
			abs((expr1.parsed_date - expr2.parsed_date).days) <= 1):
			return True
		
		return False
	
	def _get_temporal_method_priority(self, method: str) -> int:
		"""Get priority score for different extraction methods"""
		priorities = {
			'deadline_pattern': 6,
			'absolute_date_pattern': 5,
			'spacy_ner': 4,
			'dateutil_parser': 3,
			'ai_enhancement': 2,
			'relative_date_pattern': 2,
			'ai_text_parsing': 1
		}
		return priorities.get(method, 0)
	
	def _normalize_temporal_expression(self, expr: TemporalExpression, reference_date: datetime):
		"""Normalize temporal expression to standard format"""
		if not expr.parsed_date:
			# Try to parse again with more aggressive methods
			expr.parsed_date = self._parse_date_string(expr.text, reference_date)
		
		if expr.parsed_date:
			expr.normalization_confidence = 0.9
		else:
			# Try business date parsing
			business_date = self._parse_business_date(expr.text, reference_date)
			if business_date:
				expr.parsed_date = business_date
				expr.normalization_confidence = 0.7
			else:
				expr.normalization_confidence = 0.0
	
	def _calculate_urgency(self, expr: TemporalExpression, reference_date: datetime) -> UrgencyLevel:
		"""Calculate urgency level for temporal expression"""
		if not expr.parsed_date or not expr.is_deadline:
			return UrgencyLevel.UNKNOWN
		
		days_until = (expr.parsed_date - reference_date).days
		
		if days_until < 0:
			return UrgencyLevel.CRITICAL  # Past due
		elif days_until <= 7:
			return UrgencyLevel.CRITICAL
		elif days_until <= 30:
			return UrgencyLevel.HIGH
		elif days_until <= 90:
			return UrgencyLevel.MEDIUM
		else:
			return UrgencyLevel.LOW
	
	def _extract_temporal_context(self, text: str, expr: TemporalExpression) -> str:
		"""Extract context around temporal expression"""
		window = self.config['context_window']
		start = max(0, expr.start_char - window)
		end = min(len(text), expr.end_char + window)
		
		context = text[start:end]
		return context.replace('\n', ' ').strip()
	
	def _build_timeline(self, expressions: List[TemporalExpression]) -> List[Tuple[datetime, str]]:
		"""Build chronological timeline from temporal expressions"""
		timeline_items = []
		
		for expr in expressions:
			if expr.parsed_date:
				timeline_items.append((expr.parsed_date, f"{expr.text} ({expr.temporal_type.value})"))
		
		# Sort by date
		timeline_items.sort(key=lambda x: x[0])
		return timeline_items
	
	def _calculate_temporal_statistics(self, expressions: List[TemporalExpression], reference_date: datetime) -> Dict[str, Any]:
		"""Calculate temporal statistics"""
		if not expressions:
			return {}
		
		type_counts = {}
		method_counts = {}
		urgency_counts = {}
		total_confidence = 0
		
		parsed_dates = []
		
		for expr in expressions:
			# Count by type
			expr_type = expr.temporal_type.value
			type_counts[expr_type] = type_counts.get(expr_type, 0) + 1
			
			# Count by method
			method = expr.extraction_method
			method_counts[method] = method_counts.get(method, 0) + 1
			
			# Count by urgency
			urgency = expr.urgency_level.value
			urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1
			
			# Sum confidence
			total_confidence += expr.confidence
			
			# Collect parsed dates
			if expr.parsed_date:
				parsed_dates.append(expr.parsed_date)
		
		# Calculate date range
		date_range = None
		if parsed_dates:
			min_date = min(parsed_dates)
			max_date = max(parsed_dates)
			date_range = {
				'earliest': min_date.isoformat(),
				'latest': max_date.isoformat(),
				'span_days': (max_date - min_date).days
			}
		
		return {
			'total_expressions': len(expressions),
			'type_distribution': type_counts,
			'method_distribution': method_counts,
			'urgency_distribution': urgency_counts,
			'average_confidence': total_confidence / len(expressions),
			'expressions_with_parsed_dates': len(parsed_dates),
			'date_range': date_range,
			'deadlines_count': len([e for e in expressions if e.is_deadline]),
			'milestones_count': len([e for e in expressions if e.is_milestone]),
			'overdue_items': len([e for e in expressions if e.parsed_date and e.parsed_date < reference_date]),
			'upcoming_week': len([e for e in expressions if e.parsed_date and 0 <= (e.parsed_date - reference_date).days <= 7]),
			'upcoming_month': len([e for e in expressions if e.parsed_date and 0 <= (e.parsed_date - reference_date).days <= 30])
		}
	
	def _parse_date_string(self, date_str: str, reference_date: datetime) -> Optional[datetime]:
		"""Parse date string using multiple methods"""
		date_str = date_str.strip()
		if not date_str:
			return None
		
		# Try dateutil parser first if available
		if HAS_DATEUTIL:
			try:
				return dateparser.parse(date_str, fuzzy=True)
			except (ValueError, TypeError, OverflowError):
				pass
		
		# Try standard datetime parsing with preferred formats
		for fmt in self.config['preferred_date_formats']:
			try:
				return datetime.strptime(date_str, fmt)
			except ValueError:
				continue
		
		# Try relative date parsing
		return self._parse_relative_date(date_str, reference_date)
	
	def _parse_relative_date(self, date_str: str, reference_date: datetime) -> Optional[datetime]:
		"""Parse relative date expressions"""
		date_str_lower = date_str.lower().strip()
		
		# Direct keyword matches
		if date_str_lower in self.relative_keywords:
			days_offset = self.relative_keywords[date_str_lower]
			return reference_date + timedelta(days=days_offset)
		
		# Pattern matching for "in X days/weeks/months"
		in_pattern = re.match(r'in\s+(\d+)\s+(days?|weeks?|months?|years?)', date_str_lower)
		if in_pattern:
			amount = int(in_pattern.group(1))
			unit = in_pattern.group(2).rstrip('s')  # Remove plural 's'
			
			if unit == 'day':
				return reference_date + timedelta(days=amount)
			elif unit == 'week':
				return reference_date + timedelta(weeks=amount)
			elif unit == 'month':
				if HAS_DATEUTIL:
					return reference_date + relativedelta(months=amount)
				else:
					return reference_date + timedelta(days=amount * 30)  # Approximate
			elif unit == 'year':
				if HAS_DATEUTIL:
					return reference_date + relativedelta(years=amount)
				else:
					return reference_date + timedelta(days=amount * 365)  # Approximate
		
		# Pattern for "next/last X"
		next_last_pattern = re.match(r'(next|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)', date_str_lower)
		if next_last_pattern:
			direction = next_last_pattern.group(1)
			unit = next_last_pattern.group(2)
			
			if unit in self.day_names:
				# Find next/last occurrence of weekday
				target_weekday = self.day_names[unit]
				current_weekday = reference_date.weekday()
				
				if direction == 'next':
					days_ahead = (target_weekday - current_weekday) % 7
					if days_ahead == 0:  # If it's the same day, move to next week
						days_ahead = 7
					return reference_date + timedelta(days=days_ahead)
				else:  # last
					days_behind = (current_weekday - target_weekday) % 7
					if days_behind == 0:  # If it's the same day, move to last week
						days_behind = 7
					return reference_date - timedelta(days=days_behind)
		
		return None
	
	def _parse_business_date(self, date_str: str, reference_date: datetime) -> Optional[datetime]:
		"""Parse business-specific date expressions"""
		date_str_lower = date_str.lower().strip()
		
		# Quarter parsing
		for quarter_str, months in self.quarter_mappings.items():
			if quarter_str in date_str_lower:
				# Find year if mentioned
				year_match = re.search(r'\b(20\d{2})\b', date_str)
				year = int(year_match.group(1)) if year_match else reference_date.year
				
				# Default to end of quarter
				quarter_end_month = months[1]
				last_day = calendar.monthrange(year, quarter_end_month)[1]
				return datetime(year, quarter_end_month, last_day)
		
		# Fiscal year
		if 'fiscal year' in date_str_lower or 'fy' in date_str_lower:
			year_match = re.search(r'\b(20\d{2})\b', date_str)
			if year_match:
				year = int(year_match.group(1))
				# Default to end of fiscal year (assume calendar year for now)
				return datetime(year, 12, 31)
		
		# End of month/quarter/year
		if 'end of month' in date_str_lower:
			year = reference_date.year
			month = reference_date.month
			last_day = calendar.monthrange(year, month)[1]
			return datetime(year, month, last_day)
		
		elif 'end of quarter' in date_str_lower:
			current_quarter = ((reference_date.month - 1) // 3) + 1
			quarter_end_month = current_quarter * 3
			last_day = calendar.monthrange(reference_date.year, quarter_end_month)[1]
			return datetime(reference_date.year, quarter_end_month, last_day)
		
		elif 'end of year' in date_str_lower:
			return datetime(reference_date.year, 12, 31)
		
		return None
	
	def _parse_duration_to_days(self, duration_str: str) -> Optional[int]:
		"""Parse duration string to days"""
		duration_str = duration_str.lower().strip()
		
		# Extract number and unit
		match = re.search(r'(\d+)\s*(days?|weeks?|months?|years?)', duration_str)
		if not match:
			return None
		
		amount = int(match.group(1))
		unit = match.group(2).rstrip('s')  # Remove plural 's'
		
		if unit == 'day':
			return amount
		elif unit == 'week':
			return amount * 7
		elif unit == 'month':
			return amount * 30  # Approximate
		elif unit == 'year':
			return amount * 365  # Approximate
		
		return None
	
	def _is_relative_expression(self, text: str) -> bool:
		"""Check if text contains relative temporal expressions"""
		text_lower = text.lower()
		relative_indicators = ['next', 'last', 'in', 'ago', 'from now', 'this', 'coming']
		return any(indicator in text_lower for indicator in relative_indicators)
	
	def _is_deadline_expression(self, text: str) -> bool:
		"""Check if text contains deadline indicators"""
		text_lower = text.lower()
		deadline_indicators = ['due', 'deadline', 'by', 'before', 'no later than', 'must be completed']
		return any(indicator in text_lower for indicator in deadline_indicators)
	
	def _split_text_for_ai_analysis(self, text: str) -> List[str]:
		"""Split text into chunks for AI analysis"""
		if len(text) <= self.config['ai_chunk_size']:
			return [text]
		
		chunks = []
		# Split by paragraphs to preserve temporal context
		paragraphs = text.split('\n\n')
		current_chunk = ""
		
		for paragraph in paragraphs:
			if len(current_chunk) + len(paragraph) <= self.config['ai_chunk_size']:
				current_chunk += paragraph + "\n\n"
			else:
				if current_chunk:
					chunks.append(current_chunk.strip())
				current_chunk = paragraph + "\n\n"
		
		if current_chunk:
			chunks.append(current_chunk.strip())
		
		return chunks
	
	async def identify_schedule_conflicts(self, expressions: List[TemporalExpression]) -> Dict[str, Any]:
		"""Identify potential schedule conflicts"""
		conflicts = []
		
		# Group expressions by date
		date_groups = {}
		for expr in expressions:
			if expr.parsed_date:
				date_key = expr.parsed_date.date()
				if date_key not in date_groups:
					date_groups[date_key] = []
				date_groups[date_key].append(expr)
		
		# Find dates with multiple deadlines/milestones
		for date_key, exprs in date_groups.items():
			if len(exprs) > 1:
				important_exprs = [e for e in exprs if e.is_deadline or e.is_milestone]
				if len(important_exprs) > 1:
					conflicts.append({
						'date': date_key.isoformat(),
						'conflicting_items': [e.text for e in important_exprs],
						'severity': 'high' if len(important_exprs) > 2 else 'medium'
					})
		
		return {
			'conflicts': conflicts,
			'total_conflicts': len(conflicts),
			'recommendations': self._generate_conflict_recommendations(conflicts)
		}
	
	def _generate_conflict_recommendations(self, conflicts: List[Dict[str, Any]]) -> List[str]:
		"""Generate recommendations for resolving conflicts"""
		recommendations = []
		
		if not conflicts:
			recommendations.append("No schedule conflicts detected.")
		else:
			recommendations.append(f"Found {len(conflicts)} potential schedule conflicts.")
			recommendations.append("Consider redistributing deadlines across different dates.")
			recommendations.append("Review resource allocation for conflicting deadlines.")
			
			high_severity = [c for c in conflicts if c.get('severity') == 'high']
			if high_severity:
				recommendations.append(f"Priority attention needed for {len(high_severity)} high-severity conflicts.")
		
		return recommendations
	
	async def close(self):
		"""Close the Ollama client"""
		await self.ollama_client.aclose()
	
	def get_extractor_info(self) -> Dict[str, Any]:
		"""Get extractor information and capabilities"""
		return {
			'supported_temporal_types': [ttype.value for ttype in TemporalType],
			'extraction_methods': ['spacy_temporal', 'pattern_matching', 'dateutil_parsing', 'ai_enhancement'],
			'spacy_available': HAS_SPACY_SUPPORT,
			'dateutil_available': HAS_DATEUTIL,
			'business_calendar': {
				'fiscal_year_start': self.business_calendar.fiscal_year_start,
				'business_days': list(self.business_calendar.business_days),
				'quarters': self.business_calendar.quarters
			},
			'ai_model': self.config['ollama_model'],
			'config': self.config.copy(),
			'version': '1.0.0'
		}


# Factory function
def create_deadline_extractor(config: Optional[Dict[str, Any]] = None) -> DeadlineExtractor:
	"""Create DeadlineExtractor instance with configuration"""
	return DeadlineExtractor(config)