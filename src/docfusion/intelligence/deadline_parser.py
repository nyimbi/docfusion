"""
Deadline Parser for RFP Documents

Specialized parser for extracting deadlines and temporal expressions from RFP documents
with support for various date formats, relative dates, and RFP-specific deadline patterns.
Integrates with the intelligence module for comprehensive deadline intelligence.
"""

import calendar
import logging
import re
from datetime import datetime, timedelta, date
from typing import Any, Dict, List
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict
from ..core.utils import uuid7str
import time

class DeadlineType(str, Enum):
	"""Types of deadlines in RFP documents"""
	SUBMISSION = "submission"
	QUESTION_DEADLINE = "question_deadline"
	SITE_VISIT = "site_visit"
	PRE_BID_CONFERENCE = "pre_bid_conference"
	AMENDMENT_DEADLINE = "amendment_deadline"
	AWARD_DATE = "award_date"
	START_DATE = "start_date"
	PROPOSAL_DUE = "proposal_due"
	TECHNICAL_PROPOSAL = "technical_proposal"
	COST_PROPOSAL = "cost_proposal"
	ORAL_PRESENTATION = "oral_presentation"
	CONTRACT_START = "contract_start"
	MILESTONE = "milestone"
	OTHER = "other"

class DeadlineStatus(str, Enum):
	"""Status of a deadline"""
	UPCOMING = "upcoming"
	APPROACHING = "approaching"  # Within 7 days
	CRITICAL = "critical"  # Within 3 days
	OVERDUE = "overdue"
	COMPLETED = "completed"
	UNKNOWN = "unknown"

class DeadlinePriority(str, Enum):
	"""Priority level for deadline importance"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"

class Deadline(BaseModel):
	"""Extracted deadline from RFP document"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str, description="Unique identifier")
	deadline_type: DeadlineType = Field(description="Type of deadline")
	date: datetime = Field(description="Deadline date and time")
	description: str = Field(default="", description="Description of the deadline")
	source_text: str = Field(default="", description="Original text from document")
	confidence: float = Field(ge=0.0, le=1.0, default=0.0, description="Extraction confidence")
	section_reference: str | None = Field(default=None, description="Document section reference")
	is_critical: bool = Field(default=False, description="Whether deadline is critical")
	reminders_sent: int = Field(default=0, description="Number of reminders sent")
	calendar_event_id: str | None = Field(default=None, description="Linked calendar event ID")

	# Additional metadata
	document_id: str | None = Field(default=None, description="Source document ID")
	opportunity_id: str | None = Field(default=None, description="Associated opportunity ID")
	extracted_by: str = Field(default="deadline_parser", description="Extraction method")
	created_at: datetime = Field(default_factory=datetime.now, description="Extraction timestamp")

	# Computed fields
	status: DeadlineStatus = Field(default=DeadlineStatus.UNKNOWN, description="Current status")
	priority: DeadlinePriority = Field(default=DeadlinePriority.MEDIUM, description="Priority level")
	days_remaining: int = Field(default=0, description="Days until deadline")

	def compute_status(self, reference_date: datetime | None = None) -> DeadlineStatus:
		"""Compute the current status based on reference date"""
		ref = reference_date or datetime.now()
		delta = (self.date - ref).total_seconds() / 86400  # Days

		if delta < 0:
			return DeadlineStatus.OVERDUE
		elif delta <= 3:
			return DeadlineStatus.CRITICAL
		elif delta <= 7:
			return DeadlineStatus.APPROACHING
		else:
			return DeadlineStatus.UPCOMING

	def compute_priority(self) -> DeadlinePriority:
		"""Compute priority based on deadline type and criticality"""
		if self.is_critical:
			return DeadlinePriority.CRITICAL

		high_priority_types = {
			DeadlineType.SUBMISSION,
			DeadlineType.PROPOSAL_DUE,
			DeadlineType.TECHNICAL_PROPOSAL,
			DeadlineType.COST_PROPOSAL,
		}

		if self.deadline_type in high_priority_types:
			return DeadlinePriority.HIGH

		medium_priority_types = {
			DeadlineType.QUESTION_DEADLINE,
			DeadlineType.PRE_BID_CONFERENCE,
			DeadlineType.SITE_VISIT,
		}

		if self.deadline_type in medium_priority_types:
			return DeadlinePriority.MEDIUM

		return DeadlinePriority.LOW

class Milestone(BaseModel):
	"""A milestone in the timeline"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Milestone name")
	date: datetime = Field(description="Milestone date")
	description: str = Field(default="", description="Milestone description")
	deadline_ids: List[str] = Field(default_factory=list, description="Associated deadline IDs")
	dependencies: List[str] = Field(default_factory=list, description="Dependent milestone IDs")
	is_completed: bool = Field(default=False)
	completion_date: datetime | None = Field(default=None)

	# Progress tracking
	progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
	tasks_total: int = Field(default=0)
	tasks_completed: int = Field(default=0)

class Timeline(BaseModel):
	"""Complete timeline from RFP document"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str)
	name: str = Field(default="RFP Timeline", description="Timeline name")
	deadlines: List[Deadline] = Field(default_factory=list)
	milestones: List[Milestone] = Field(default_factory=list)

	# Timeline metadata
	document_id: str | None = Field(default=None)
	opportunity_id: str | None = Field(default=None)
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)

	# Computed statistics
	total_deadlines: int = Field(default=0)
	critical_count: int = Field(default=0)
	overdue_count: int = Field(default=0)
	nearest_deadline: datetime | None = Field(default=None)

	def add_deadline(self, deadline: Deadline) -> None:
		"""Add a deadline to the timeline"""
		self.deadlines.append(deadline)
		self._recompute_stats()

	def _recompute_stats(self) -> None:
		"""Recompute timeline statistics"""
		self.total_deadlines = len(self.deadlines)
		self.critical_count = sum(1 for d in self.deadlines if d.status == DeadlineStatus.CRITICAL)
		self.overdue_count = sum(1 for d in self.deadlines if d.status == DeadlineStatus.OVERDUE)

		valid_deadlines = [d for d in self.deadlines if d.status not in (DeadlineStatus.OVERDUE, DeadlineStatus.COMPLETED)]
		if valid_deadlines:
			self.nearest_deadline = min(d.date for d in valid_deadlines)
		else:
			self.nearest_deadline = None

		self.updated_at = datetime.now()

class DeadlineExtractionResult(BaseModel):
	"""Result of deadline extraction from document"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	success: bool = Field(default=False, description="Whether extraction succeeded")
	deadlines: List[Deadline] = Field(default_factory=list)
	timeline: Timeline | None = Field(default=None)

	# Extraction metadata
	document_text: str = Field(default="", description="Original document text")
	processing_time: float = Field(default=0.0, description="Processing time in seconds")
	methods_used: List[str] = Field(default_factory=list)
	confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)

	# Errors and warnings
	errors: List[str] = Field(default_factory=list)
	warnings: List[str] = Field(default_factory=list)

	# AI analysis (optional)
	ai_analysis: Dict[str, Any] = Field(default_factory=dict)

class DeadlineParser:
	"""
	Extract deadlines from RFP documents with support for various date formats,
	relative dates, and RFP-specific patterns.
	"""

	def __init__(self, config: Dict[str, Any] | None = None):
		"""Initialize the deadline parser with configuration"""
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)

		# Compile patterns
		self._compile_patterns()
		self._load_vocabularies()

		self.logger.info("DeadlineParser initialized")

	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			# Date parsing settings
			'reference_date': None,  # Use current date if None
			'timezone': 'UTC',
			'min_confidence_threshold': 0.5,
			'normalize_dates': True,
			'calculate_status': True,

			# Pattern matching settings
			'extract_absolute_dates': True,
			'extract_relative_dates': True,
			'extract_business_dates': True,
			'extract_rfp_specific': True,

			# RFP-specific settings
			'default_submission_offset_days': 30,  # Days from publication
			'default_question_offset_days': 7,
			'default_site_visit_offset_days': 14,

			# Date format preferences
			'preferred_date_formats': [
				'%Y-%m-%d',      # 2024-01-15
				'%m/%d/%Y',      # 01/15/2024
				'%d/%m/%Y',      # 15/01/2024
				'%B %d, %Y',     # January 15, 2024
				'%d %B %Y',      # 15 January 2024
				'%b %d, %Y',     # Jan 15, 2024
			],

			# Performance settings
			'max_text_length': 500000,
		}

	def _compile_patterns(self) -> None:
		"""Compile regex patterns for date extraction"""
		# Absolute date patterns
		self.absolute_date_patterns = [
			# ISO format: 2024-01-15, 2024/01/15
			re.compile(r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b'),

			# US format: 01/15/2024, 1/15/2024
			re.compile(r'\b\d{1,2}/\d{1,2}/\d{4}\b'),

			# Month day, year: January 15, 2024; January 15 2024
			re.compile(
				r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
				re.IGNORECASE
			),

			# Day month year: 15 January 2024; 15th January 2024
			re.compile(
				r'\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b',
				re.IGNORECASE
			),

			# Short month: Jan 15, 2024; Jan. 15, 2024
			re.compile(
				r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b',
				re.IGNORECASE
			),
		]

		# Time patterns
		self.time_patterns = [
			# 12-hour format: 3:00 PM, 3:00pm, 3 PM, 3PM
			re.compile(r'\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\b'),
			re.compile(r'\b\d{1,2}\s*(?:AM|PM|am|pm)\b'),
			# 24-hour format: 15:00, 15:30
			re.compile(r'\b(?:0?\d|1\d|2[0-3]):[0-5]\d\b'),
		]

		# Relative date patterns
		self.relative_date_patterns = [
			# "X days from [publication/notice/award]"
			re.compile(
				r'(\d+)\s+days?\s+from\s+(?:publication|notice|award|receipt|effective|issuance)',
				re.IGNORECASE
			),

			# "within X days"
			re.compile(r'within\s+(\d+)\s+days?', re.IGNORECASE),

			# "X days after/before"
			re.compile(r'(\d+)\s+days?\s+(?:after|before|following)', re.IGNORECASE),

			# "no later than X days"
			re.compile(r'no\s+later\s+than\s+(\d+)\s+days?', re.IGNORECASE),

			# "next/last week/month/year"
			re.compile(r'\b(?:next|last|this)\s+(?:week|month|quarter|year)\b', re.IGNORECASE),

			# "end of month/quarter/year"
			re.compile(r'\bend\s+of\s+(?:the\s+)?(?:month|quarter|year|fiscal\s+year)\b', re.IGNORECASE),

			# "beginning/start of..."
			re.compile(r'\b(?:beginning|start)\s+of\s+(?:the\s+)?(?:month|quarter|year)\b', re.IGNORECASE),
		]

		# RFP-specific deadline patterns
		self.rfp_deadline_patterns = [
			# Submission deadlines
			re.compile(
				r'(?:proposal|response|bid|application|submission)\s+(?:deadline|due\s+date|date):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),
			re.compile(
				r'(?:deadline|due\s+date)\s+(?:for|to)\s+(?:submit|submission\s+of)\s+(?:proposal|response|bid):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),
			re.compile(
				r'(?:proposals|responses|bids)\s+(?:must\s+be\s+)?(?:submitted|received)\s+(?:by|no\s+later\s+than|before):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),

			# Question deadlines
			re.compile(
				r'(?:questions|inquiries|clarifications)\s+(?:deadline|due):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),
			re.compile(
				r'(?:last\s+day\s+for|deadline\s+for)\s+(?:questions|inquiries):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),

			# Pre-bid conference/site visit
			re.compile(
				r'(?:pre-bid|pre-proposal|bidders)\s+(?:conference|meeting|briefing):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),
			re.compile(
				r'(?:site\s+visit|facility\s+tour|site\s+walk-through):?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),

			# Award dates
			re.compile(
				r'(?:anticipated|expected|projected|estimated)\s+(?:award|notification|selection)\s+(?:date)?:?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),

			# Start dates
			re.compile(
				r'(?:contract|project|performance)\s+(?:start|commencement)\s+(?:date)?:?\s*([^.!?]+?)(?:\.|,|;|$)',
				re.IGNORECASE
			),
		]

		# Duration patterns
		self.duration_patterns = [
			re.compile(r'(\d+)\s+(?:calendar\s+)?days?', re.IGNORECASE),
			re.compile(r'(\d+)\s+business\s+days?', re.IGNORECASE),
			re.compile(r'(\d+)\s+weeks?', re.IGNORECASE),
			re.compile(r'(\d+)\s+months?', re.IGNORECASE),
		]

		# Business date patterns
		self.business_date_patterns = [
			# Quarters: Q1, Q2, Q3, Q4
			re.compile(r'\b(?:Q[1-4]|(?:first|second|third|fourth)\s+quarter)\s*(?:\d{4}|FY\s*\d{2,4})?', re.IGNORECASE),

			# Fiscal year
			re.compile(r'\b(?:fiscal\s+year|FY)\s*\d{2,4}\b', re.IGNORECASE),

			# End of periods
			re.compile(r'\b(?:end|close)\s+of\s+(?:business\s+)?(?:day|week|month|quarter|year)\b', re.IGNORECASE),

			# Business days
			re.compile(r'\b\d+\s+business\s+days?\b', re.IGNORECASE),
		]

		# Deadline indicator keywords
		self.deadline_keywords = {
			DeadlineType.SUBMISSION: [
				'proposal due', 'submission deadline', 'response deadline', 'bid deadline',
				'application deadline', 'closing date', 'due date', 'deadline for submission',
				'proposals due', 'responses due', 'bids due'
			],
			DeadlineType.QUESTION_DEADLINE: [
				'question deadline', 'inquiry deadline', 'clarification deadline',
				'questions due', 'inquiries due', 'last day for questions'
			],
			DeadlineType.PRE_BID_CONFERENCE: [
				'pre-bid conference', 'pre-proposal conference', 'bidders conference',
				'pre-bid meeting', 'bidders meeting', 'pre-proposal meeting'
			],
			DeadlineType.SITE_VISIT: [
				'site visit', 'facility tour', 'site walk-through', 'site inspection',
				'facility visit', 'site tour'
			],
			DeadlineType.AWARD_DATE: [
				'award date', 'award notification', 'selection date', 'anticipated award',
				'expected award', 'projected award'
			],
			DeadlineType.START_DATE: [
				'start date', 'contract start', 'performance start', 'commencement date',
				'project start', 'work start'
			],
		}

	def _load_vocabularies(self) -> None:
		"""Load vocabularies for date parsing"""
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

		# Ordinal suffix mappings
		self.ordinal_pattern = re.compile(r'(\d+)(?:st|nd|rd|th)')

		# Relative time keywords
		self.relative_keywords = {
			'today': 0,
			'tomorrow': 1,
			'yesterday': -1,
			'next week': 7,
			'last week': -7,
			'next month': 30,
			'last month': -30,
		}

	async def extract_deadlines(
		self,
		text: str,
		reference_date: datetime | None = None,
		document_id: str | None = None,
		opportunity_id: str | None = None
	) -> DeadlineExtractionResult:
		"""
		Extract all deadlines from document text.

		Args:
			text: The document text to parse
			reference_date: Reference date for relative date calculations
			document_id: Optional document ID for metadata
			opportunity_id: Optional opportunity ID for metadata

		Returns:
			DeadlineExtractionResult with extracted deadlines and timeline
		"""
		start_time = time.monotonic()
		result = DeadlineExtractionResult(document_text=text[:10000])  # Store first 10k chars for reference

		if not text or not text.strip():
			result.success = True
			return result

		try:
			# Set reference date
			if reference_date is None:
				reference_date = datetime.now()

			# Truncate if needed
			if len(text) > self.config['max_text_length']:
				result.warnings.append(f"Text truncated to {self.config['max_text_length']} characters")
				text = text[:self.config['max_text_length']]

			methods_used = []
			all_deadlines = []

			# Method 1: Extract absolute dates
			if self.config['extract_absolute_dates']:
				absolute_deadlines = await self._extract_absolute_dates(text, reference_date)
				all_deadlines.extend(absolute_deadlines)
				methods_used.append("absolute_dates")

			# Method 2: Extract relative dates
			if self.config['extract_relative_dates']:
				relative_deadlines = await self._extract_relative_dates(text, reference_date)
				all_deadlines.extend(relative_deadlines)
				methods_used.append("relative_dates")

			# Method 3: Extract RFP-specific deadlines
			if self.config['extract_rfp_specific']:
				rfp_deadlines = await self._extract_rfp_deadlines(text, reference_date)
				all_deadlines.extend(rfp_deadlines)
				methods_used.append("rfp_specific")

			# Method 4: Extract business dates
			if self.config['extract_business_dates']:
				business_deadlines = await self._extract_business_dates(text, reference_date)
				all_deadlines.extend(business_deadlines)
				methods_used.append("business_dates")

			# Deduplicate and merge deadlines
			merged_deadlines = self._merge_deadlines(all_deadlines)

			# Filter by confidence
			filtered_deadlines = [
				d for d in merged_deadlines
				if d.confidence >= self.config['min_confidence_threshold']
			]

			# Add metadata
			for deadline in filtered_deadlines:
				if document_id:
					deadline.document_id = document_id
				if opportunity_id:
					deadline.opportunity_id = opportunity_id

				# Compute status and priority
				deadline.status = deadline.compute_status(reference_date)
				deadline.priority = deadline.compute_priority()
				deadline.days_remaining = max(0, (deadline.date - reference_date).days)

			# Sort by date
			filtered_deadlines.sort(key=lambda d: d.date)

			# Build timeline
			timeline = Timeline(
				name="RFP Timeline",
				deadlines=filtered_deadlines,
				document_id=document_id,
				opportunity_id=opportunity_id
			)
			timeline._recompute_stats()

			result.deadlines = filtered_deadlines
			result.timeline = timeline
			result.methods_used = methods_used
			result.success = True

			# Calculate overall confidence
			if filtered_deadlines:
				result.confidence_score = sum(d.confidence for d in filtered_deadlines) / len(filtered_deadlines)

			result.processing_time = time.monotonic() - start_time

			self.logger.info(
				f"Extracted {len(filtered_deadlines)} deadlines in {result.processing_time:.2f}s"
			)

		except Exception as e:
			result.errors.append(f"Deadline extraction failed: {str(e)}")
			self.logger.error(f"Deadline extraction error: {e}")

		return result

	async def _extract_absolute_dates(
		self,
		text: str,
		reference_date: datetime
	) -> List[Deadline]:
		"""Extract absolute date expressions from text"""
		deadlines = []

		for pattern in self.absolute_date_patterns:
			for match in pattern.finditer(text):
				date_text = match.group()
				parsed_date = self._parse_date_string(date_text)

				if parsed_date:
					# Get context around the date
					context = self._get_context(text, match.start(), match.end())
					deadline_type = self._infer_deadline_type(context)

					deadline = Deadline(
						deadline_type=deadline_type,
						date=parsed_date,
						source_text=date_text,
						description=context[:200],
						confidence=self._calculate_confidence(date_text, context),
						is_critical=self._is_critical_deadline(context)
					)
					deadlines.append(deadline)

		return deadlines

	async def _extract_relative_dates(
		self,
		text: str,
		reference_date: datetime
	) -> List[Deadline]:
		"""Extract relative date expressions from text"""
		deadlines = []

		for pattern in self.relative_date_patterns:
			for match in pattern.finditer(text):
				full_text = match.group()
				context = self._get_context(text, match.start(), match.end())

				# Try to parse relative date
				parsed_date = self._parse_relative_date(full_text, reference_date)

				if parsed_date:
					deadline_type = self._infer_deadline_type(context)

					deadline = Deadline(
						deadline_type=deadline_type,
						date=parsed_date,
						source_text=full_text,
						description=context[:200],
						confidence=self._calculate_confidence(full_text, context) * 0.8,  # Lower confidence for relative
						is_critical=self._is_critical_deadline(context)
					)
					deadlines.append(deadline)

		return deadlines

	async def _extract_rfp_deadlines(
		self,
		text: str,
		reference_date: datetime
	) -> List[Deadline]:
		"""Extract RFP-specific deadline patterns"""
		deadlines = []

		for pattern in self.rfp_deadline_patterns:
			for match in pattern.finditer(text):
				full_match = match.group()
				date_text = match.group(1) if match.lastindex else match.group()

				# Try to parse the date
				parsed_date = self._parse_date_string(date_text)

				# If no absolute date found, try relative parsing
				if not parsed_date:
					parsed_date = self._parse_relative_date(date_text, reference_date)

				if parsed_date:
					deadline_type = self._infer_deadline_type(full_match)

					deadline = Deadline(
						deadline_type=deadline_type,
						date=parsed_date,
						source_text=full_match,
						description=full_match[:200],
						confidence=0.85,  # Higher confidence for RFP-specific patterns
						is_critical=deadline_type in {
							DeadlineType.SUBMISSION,
							DeadlineType.PROPOSAL_DUE,
							DeadlineType.QUESTION_DEADLINE
						}
					)
					deadlines.append(deadline)

		return deadlines

	async def _extract_business_dates(
		self,
		text: str,
		reference_date: datetime
	) -> List[Deadline]:
		"""Extract business date expressions"""
		deadlines = []

		for pattern in self.business_date_patterns:
			for match in pattern.finditer(text):
				full_text = match.group()
				context = self._get_context(text, match.start(), match.end())

				parsed_date = self._parse_business_date(full_text, reference_date)

				if parsed_date:
					deadline_type = self._infer_deadline_type(context)

					deadline = Deadline(
						deadline_type=deadline_type,
						date=parsed_date,
						source_text=full_text,
						description=context[:200],
						confidence=0.7,  # Lower confidence for business dates
						is_critical=self._is_critical_deadline(context)
					)
					deadlines.append(deadline)

		return deadlines

	def _parse_date_string(self, date_text: str) -> datetime | None:
		"""Parse a date string into a datetime object"""
		# Clean the text
		date_text = date_text.strip()

		# Try each format
		for fmt in self.config['preferred_date_formats']:
			try:
				parsed = datetime.strptime(date_text, fmt)
				return parsed
			except ValueError:
				continue

		# Try parsing with month name
		month_day_year = re.match(
			r'(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})',
			date_text, re.IGNORECASE
		)
		if month_day_year:
			day = int(month_day_year.group(1))
			month_str = month_day_year.group(2).lower()
			year = int(month_day_year.group(3))
			if month_str in self.month_names:
				return datetime(year, self.month_names[month_str], day)

		# Try month day year format
		month_day_year2 = re.match(
			r'(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})',
			date_text, re.IGNORECASE
		)
		if month_day_year2:
			month_str = month_day_year2.group(1).lower()
			day = int(month_day_year2.group(2))
			year = int(month_day_year2.group(3))
			if month_str in self.month_names:
				return datetime(year, self.month_names[month_str], day)

		# Try ISO format with optional time
		iso_match = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?', date_text)
		if iso_match:
			year = int(iso_match.group(1))
			month = int(iso_match.group(2))
			day = int(iso_match.group(3))
			hour = int(iso_match.group(4)) if iso_match.group(4) else 0
			minute = int(iso_match.group(5)) if iso_match.group(5) else 0
			second = int(iso_match.group(6)) if iso_match.group(6) else 0
			return datetime(year, month, day, hour, minute, second)

		return None

	def _parse_relative_date(self, text: str, reference_date: datetime) -> datetime | None:
		"""Parse relative date expressions"""
		text_lower = text.lower()

		# "X days from [publication/notice/award]"
		days_from_match = re.search(r'(\d+)\s+days?\s+from', text_lower)
		if days_from_match:
			days = int(days_from_match.group(1))
			return reference_date + timedelta(days=days)

		# "within X days"
		within_match = re.search(r'within\s+(\d+)\s+days?', text_lower)
		if within_match:
			days = int(within_match.group(1))
			return reference_date + timedelta(days=days)

		# "X days after/before"
		days_offset_match = re.search(r'(\d+)\s+days?\s+(?:after|following)', text_lower)
		if days_offset_match:
			days = int(days_offset_match.group(1))
			return reference_date + timedelta(days=days)

		# "no later than X days"
		no_later_match = re.search(r'no\s+later\s+than\s+(\d+)\s+days?', text_lower)
		if no_later_match:
			days = int(no_later_match.group(1))
			return reference_date + timedelta(days=days)

		# Simple relative keywords
		for keyword, offset in self.relative_keywords.items():
			if keyword in text_lower:
				return reference_date + timedelta(days=offset)

		return None

	def _parse_business_date(self, text: str, reference_date: datetime) -> datetime | None:
		"""Parse business date expressions"""
		text_lower = text.lower()

		# Quarter patterns
		quarter_match = re.search(r'q(\d)(?:\s*(\d{2,4})|fy\s*(\d{2,4}))?', text_lower)
		if quarter_match:
			quarter = int(quarter_match.group(1))
			year_str = quarter_match.group(2) or quarter_match.group(3)

			if year_str:
				year = int(year_str)
				if year < 100:
					year += 2000
			else:
				year = reference_date.year

			# Calculate quarter end
			quarter_end_months = {1: 3, 2: 6, 3: 9, 4: 12}
			end_month = quarter_end_months.get(quarter, 12)
			return datetime(year, end_month, calendar.monthrange(year, end_month)[1])

		# "end of month"
		if 'end of month' in text_lower:
			next_month = reference_date.replace(day=28) + timedelta(days=4)  # Guarantee next month
			last_day = calendar.monthrange(next_month.year, next_month.month)[1]
			return reference_date.replace(day=last_day)

		# "end of quarter"
		if 'end of quarter' in text_lower:
			current_quarter = (reference_date.month - 1) // 3 + 1
			quarter_end_months = {1: 3, 2: 6, 3: 9, 4: 12}
			end_month = quarter_end_months[current_quarter]
			last_day = calendar.monthrange(reference_date.year, end_month)[1]
			return reference_date.replace(month=end_month, day=last_day)

		# "end of year"
		if 'end of year' in text_lower or 'end of fiscal year' in text_lower:
			return reference_date.replace(month=12, day=31)

		return None

	def _infer_deadline_type(self, context: str) -> DeadlineType:
		"""Infer the deadline type from context"""
		context_lower = context.lower()

		for deadline_type, keywords in self.deadline_keywords.items():
			for keyword in keywords:
				if keyword in context_lower:
					return deadline_type

		return DeadlineType.OTHER

	def _get_context(self, text: str, start: int, end: int, window: int = 100) -> str:
		"""Get context around a match position"""
		context_start = max(0, start - window)
		context_end = min(len(text), end + window)
		return text[context_start:context_end]

	def _calculate_confidence(self, date_text: str, context: str) -> float:
		"""Calculate confidence score for extracted date"""
		confidence = 0.5  # Base confidence

		# Boost for clear date format
		if re.match(r'\d{4}-\d{2}-\d{2}', date_text):
			confidence += 0.2

		# Boost for deadline keywords in context
		context_lower = context.lower()
		for keywords in self.deadline_keywords.values():
			for keyword in keywords:
				if keyword in context_lower:
					confidence += 0.1
					break

		# Boost for time specification
		if any(pattern.search(context) for pattern in self.time_patterns):
			confidence += 0.1

		return min(1.0, confidence)

	def _is_critical_deadline(self, context: str) -> bool:
		"""Determine if a deadline is critical based on context"""
		context_lower = context.lower()
		critical_indicators = [
			'submission deadline', 'proposal due', 'closing date',
			'final deadline', 'hard deadline', 'no extensions',
			'mandatory', 'required', 'must be submitted'
		]
		return any(indicator in context_lower for indicator in critical_indicators)

	def _merge_deadlines(self, deadlines: List[Deadline]) -> List[Deadline]:
		"""Merge duplicate deadlines and keep the best extraction"""
		# Group by approximate date (within 1 day)
		date_groups: Dict[date, List[Deadline]] = {}

		for deadline in deadlines:
			date_key = deadline.date.date()
			if date_key not in date_groups:
				date_groups[date_key] = []
			date_groups[date_key].append(deadline)

		# For each group, keep the highest confidence deadline
		merged = []
		for date_key, group in date_groups.items():
			if len(group) == 1:
				merged.append(group[0])
			else:
				# Sort by confidence and take the best
				group.sort(key=lambda d: d.confidence, reverse=True)
				best = group[0]

				# Merge source texts
				sources = {d.source_text for d in group if d.source_text}
				if len(sources) > 1:
					best.source_text = "; ".join(sources)

				merged.append(best)

		return merged

	def calculate_milestones(
		self,
		deadlines: List[Deadline],
		reference_date: datetime | None = None
	) -> List[Milestone]:
		"""
		Generate milestone timeline from deadlines.

		Args:
			deadlines: List of extracted deadlines
			reference_date: Reference date for calculations

		Returns:
			List of Milestone objects ordered by date
		"""
		if reference_date is None:
			reference_date = datetime.now()

		milestones = []

		# Group deadlines by type
		deadline_by_type: Dict[DeadlineType, List[Deadline]] = {}
		for deadline in deadlines:
			if deadline.deadline_type not in deadline_by_type:
				deadline_by_type[deadline.deadline_type] = []
			deadline_by_type[deadline.deadline_type].append(deadline)

		# Create milestones for critical deadline types
		milestone_names = {
			DeadlineType.PRE_BID_CONFERENCE: "Pre-Bid Conference",
			DeadlineType.SITE_VISIT: "Site Visit",
			DeadlineType.QUESTION_DEADLINE: "Questions Submission",
			DeadlineType.SUBMISSION: "Proposal Submission",
			DeadlineType.AWARD_DATE: "Award Notification",
			DeadlineType.START_DATE: "Contract Start",
		}

		for deadline_type, type_deadlines in deadline_by_type.items():
			name = milestone_names.get(deadline_type, deadline_type.value.replace('_', ' ').title())

			# Sort by date
			type_deadlines.sort(key=lambda d: d.date)

			for deadline in type_deadlines:
				milestone = Milestone(
					name=f"{name}: {deadline.description[:50]}",
					date=deadline.date,
					description=deadline.description,
					deadline_ids=[deadline.id]
				)
				milestones.append(milestone)

		# Sort milestones by date
		milestones.sort(key=lambda m: m.date)

		# Set dependencies (each milestone depends on previous)
		for i in range(1, len(milestones)):
			milestones[i].dependencies = [milestones[i-1].id]

		return milestones

	def parse_relative_date(
		self,
		text: str,
		reference_date: datetime | None = None,
		publication_date: datetime | None = None
	) -> datetime | None:
		"""
		Parse relative dates like '30 days from publication'.

		Args:
			text: The text containing relative date expression
			reference_date: Reference date for calculations (defaults to now)
			publication_date: Publication date if specified in the text

		Returns:
			Parsed datetime or None
		"""
		if reference_date is None:
			reference_date = datetime.now()

		text_lower = text.lower()

		# "X days from publication"
		pub_match = re.search(r'(\d+)\s+days?\s+from\s+publication', text_lower)
		if pub_match and publication_date:
			days = int(pub_match.group(1))
			return publication_date + timedelta(days=days)

		# "X days from notice"
		notice_match = re.search(r'(\d+)\s+days?\s+from\s+(?:notice|issuance|receipt)', text_lower)
		if notice_match:
			days = int(notice_match.group(1))
			return reference_date + timedelta(days=days)

		# "within X days"
		within_match = re.search(r'within\s+(\d+)\s+days?', text_lower)
		if within_match:
			days = int(within_match.group(1))
			return reference_date + timedelta(days=days)

		# "X business days"
		business_match = re.search(r'(\d+)\s+business\s+days?', text_lower)
		if business_match:
			days = int(business_match.group(1))
			# Approximate business days as weekdays
			return self._add_business_days(reference_date, days)

		return self._parse_relative_date(text, reference_date)

	def _add_business_days(self, start_date: datetime, days: int) -> datetime:
		"""Add business days to a date"""
		current = start_date
		days_added = 0

		while days_added < days:
			current += timedelta(days=1)
			# Skip weekends (5=Saturday, 6=Sunday)
			if current.weekday() < 5:
				days_added += 1

		return current

# Module-level exports
__all__ = [
	'DeadlineType',
	'DeadlineStatus',
	'DeadlinePriority',
	'Deadline',
	'Milestone',
	'Timeline',
	'DeadlineExtractionResult',
	'DeadlineParser',
]