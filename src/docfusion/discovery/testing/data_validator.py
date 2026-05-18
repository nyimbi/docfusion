#!/usr/bin/env python3
"""
Data Quality Validator

Validates and ensures the quality of extracted procurement data,
including completeness, accuracy, consistency, and compliance
with data standards and business rules.
"""

import asyncio
import json
import logging
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import tempfile

from pydantic import BaseModel, Field
from ...core.utils import uuid7str

from ..models.opportunity_models import OpportunityData as Opportunity
from ..crawlers.source_databases.global_source_db import GlobalSourceDB
import time


class ValidationLevel(Enum):
	"""Validation severity level"""
	INFO = "info"
	WARNING = "warning"
	ERROR = "error"
	CRITICAL = "critical"


class ValidationCategory(Enum):
	"""Category of validation check"""
	COMPLETENESS = "completeness"
	ACCURACY = "accuracy"
	CONSISTENCY = "consistency"
	FORMAT = "format"
	BUSINESS_RULES = "business_rules"
	DUPLICATE_DETECTION = "duplicate_detection"


@dataclass
class ValidationIssue:
	"""Represents a data validation issue"""
	issue_id: str
	category: ValidationCategory
	level: ValidationLevel
	message: str
	field_name: Optional[str] = None
	opportunity_id: Optional[str] = None
	source_url: Optional[str] = None
	suggested_fix: Optional[str] = None
	metadata: Optional[Dict[str, Any]] = None


class QualityMetrics(BaseModel):
	"""Data quality metrics"""
	
	# Completeness metrics
	completeness_score: float = 0.0
	missing_required_fields: int = 0
	missing_optional_fields: int = 0
	empty_field_rate: float = 0.0
	
	# Accuracy metrics
	accuracy_score: float = 0.0
	format_violations: int = 0
	invalid_values: int = 0
	inconsistent_values: int = 0
	
	# Consistency metrics
	consistency_score: float = 0.0
	duplicate_opportunities: int = 0
	conflicting_deadlines: int = 0
	inconsistent_organizations: int = 0
	
	# Business rule compliance
	business_rule_score: float = 0.0
	rule_violations: int = 0
	
	# Overall quality
	overall_quality_score: float = 0.0
	total_opportunities_validated: int = 0
	total_issues_found: int = 0
	
	# Quality distribution
	excellent_quality_count: int = 0  # >90% quality
	good_quality_count: int = 0       # 70-90% quality
	fair_quality_count: int = 0       # 50-70% quality
	poor_quality_count: int = 0       # <50% quality


class ValidationRule(BaseModel):
	"""Validation rule definition"""
	rule_id: str = Field(default_factory=uuid7str)
	name: str
	description: str
	category: ValidationCategory
	level: ValidationLevel
	
	# Rule configuration
	field_name: Optional[str] = None
	pattern: Optional[str] = None  # Regex pattern for validation
	min_length: Optional[int] = None
	max_length: Optional[int] = None
	required: bool = False
	allowed_values: List[str] = Field(default_factory=list)
	
	# Custom validation function name
	validation_function: Optional[str] = None
	
	# Rule metadata
	enabled: bool = True
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	last_updated: Optional[datetime] = None


class ValidationConfig(BaseModel):
	"""Configuration for data validation"""
	config_id: str = Field(default_factory=uuid7str)
	
	# Validation scope
	validate_completeness: bool = True
	validate_accuracy: bool = True
	validate_consistency: bool = True
	validate_format: bool = True
	validate_business_rules: bool = True
	detect_duplicates: bool = True
	
	# Quality thresholds
	min_completeness_score: float = 0.8
	min_accuracy_score: float = 0.75
	min_consistency_score: float = 0.85
	min_overall_quality_score: float = 0.7
	
	# Processing settings
	batch_size: int = 100
	max_validation_time_minutes: int = 30
	parallel_validation: bool = True
	max_parallel_workers: int = 5
	
	# Issue handling
	auto_fix_minor_issues: bool = True
	quarantine_poor_quality_data: bool = True
	quality_threshold_for_quarantine: float = 0.4
	
	# Reporting
	generate_quality_report: bool = True
	export_validation_results: bool = True
	notify_on_critical_issues: bool = True


class ValidationResult(BaseModel):
	"""Result of data validation"""
	validation_id: str = Field(default_factory=uuid7str)
	started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	completed_at: Optional[datetime] = None
	duration_seconds: Optional[float] = None
	
	# Validation scope
	total_opportunities_processed: int = 0
	validation_config: Optional[str] = None  # Config ID used
	
	# Results
	quality_metrics: QualityMetrics = Field(default_factory=QualityMetrics)
	validation_issues: List[ValidationIssue] = Field(default_factory=list)
	
	# Issue summary
	issues_by_category: Dict[str, int] = Field(default_factory=dict)
	issues_by_level: Dict[str, int] = Field(default_factory=dict)
	
	# Recommendations
	recommendations: List[str] = Field(default_factory=list)
	auto_fixes_applied: int = 0
	opportunities_quarantined: int = 0


class DataValidator:
	"""
	Comprehensive data quality field_validator for procurement opportunities
	"""
	
	def __init__(
		self,
		global_db: Optional[GlobalSourceDB] = None,
		config: Optional[ValidationConfig] = None,
		validation_dir: Optional[Path] = None
	):
		self.logger = logging.getLogger(__name__)
		
		# Dependencies
		self.global_db = global_db or GlobalSourceDB()
		self.config = config or ValidationConfig()
		
		# Storage
		self.validation_dir = validation_dir or Path(tempfile.gettempdir()) / "data_validation"
		self.validation_dir.mkdir(exist_ok=True)
		
		# Validation rules
		self.validation_rules: Dict[str, ValidationRule] = {}
		self.custom_validators: Dict[str, callable] = {}
		
		# Validation cache for performance
		self.validation_cache: Dict[str, Any] = {}
		
		# Statistics
		self.validation_stats = {
			'total_validations': 0,
			'total_opportunities_validated': 0,
			'total_issues_found': 0,
			'auto_fixes_applied': 0,
			'opportunities_quarantined': 0,
			'avg_validation_time': 0.0,
			'last_validation': None
		}
		
		# Initialize validation rules
		self._initialize_validation_rules()
		self._initialize_custom_validators()
	
	def _initialize_validation_rules(self):
		"""Initialize default validation rules"""
		
		# Required field rules
		self.validation_rules['title_required'] = ValidationRule(
			name="Title Required",
			description="Opportunity title must be present and non-empty",
			category=ValidationCategory.COMPLETENESS,
			level=ValidationLevel.ERROR,
			field_name="title",
			required=True,
			min_length=5,
			max_length=500
		)
		
		self.validation_rules['source_url_required'] = ValidationRule(
			name="Source URL Required",
			description="Source URL must be present and valid",
			category=ValidationCategory.COMPLETENESS,
			level=ValidationLevel.ERROR,
			field_name="source_url",
			required=True,
			pattern=r'^https?://[^\s/$.?#].[^\s]*$'
		)
		
		self.validation_rules['organization_required'] = ValidationRule(
			name="Organization Required",
			description="Organization name should be present",
			category=ValidationCategory.COMPLETENESS,
			level=ValidationLevel.WARNING,
			field_name="organization",
			required=False,
			min_length=2,
			max_length=200
		)
		
		# Format validation rules
		self.validation_rules['deadline_format'] = ValidationRule(
			name="Deadline Format",
			description="Deadline must be a valid date in the future",
			category=ValidationCategory.FORMAT,
			level=ValidationLevel.ERROR,
			field_name="deadline",
			validation_function="validate_deadline_format"
		)
		
		self.validation_rules['estimated_value_format'] = ValidationRule(
			name="Estimated Value Format",
			description="Estimated value must be a positive number",
			category=ValidationCategory.FORMAT,
			level=ValidationLevel.WARNING,
			field_name="estimated_value",
			validation_function="validate_estimated_value"
		)
		
		self.validation_rules['email_format'] = ValidationRule(
			name="Contact Email Format",
			description="Contact email must be valid format",
			category=ValidationCategory.FORMAT,
			level=ValidationLevel.WARNING,
			field_name="contact_email",
			pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
		)
		
		# Business rule validation
		self.validation_rules['procurement_type_valid'] = ValidationRule(
			name="Procurement Type Valid",
			description="Procurement type must be from allowed values",
			category=ValidationCategory.BUSINESS_RULES,
			level=ValidationLevel.WARNING,
			field_name="procurement_type",
			allowed_values=[
				"goods", "services", "construction", "consulting",
				"it_services", "professional_services", "maintenance",
				"supplies", "equipment", "other"
			]
		)
		
		self.validation_rules['title_length'] = ValidationRule(
			name="Title Length Reasonable",
			description="Title should have reasonable length",
			category=ValidationCategory.BUSINESS_RULES,
			level=ValidationLevel.WARNING,
			field_name="title",
			min_length=10,
			max_length=300
		)
		
		# Consistency rules
		self.validation_rules['deadline_future'] = ValidationRule(
			name="Deadline in Future",
			description="Deadline should be in the future",
			category=ValidationCategory.CONSISTENCY,
			level=ValidationLevel.ERROR,
			field_name="deadline",
			validation_function="validate_deadline_future"
		)
	
	def _initialize_custom_validators(self):
		"""Initialize custom validation functions"""
		
		self.custom_validators['validate_deadline_format'] = self._validate_deadline_format
		self.custom_validators['validate_deadline_future'] = self._validate_deadline_future
		self.custom_validators['validate_estimated_value'] = self._validate_estimated_value
	
	async def validate_opportunities(
		self,
		opportunities: List[Opportunity],
		validation_config: Optional[ValidationConfig] = None
	) -> ValidationResult:
		"""
		Validate a list of opportunities
		
		Args:
			opportunities: List of opportunities to validate
			validation_config: Optional custom validation configuration
			
		Returns:
			ValidationResult with quality metrics and issues
		"""
		
		config = validation_config or self.config
		
		validation_result = ValidationResult(
			total_opportunities_processed=len(opportunities),
			validation_config=config.config_id
		)
		
		try:
			start_time = time.monotonic()
			
			# Initialize quality metrics
			quality_metrics = QualityMetrics()
			quality_metrics.total_opportunities_validated = len(opportunities)
			
			# Process opportunities in batches
			if config.parallel_validation:
				await self._validate_opportunities_parallel(
					opportunities, validation_result, quality_metrics, config
				)
			else:
				await self._validate_opportunities_sequential(
					opportunities, validation_result, quality_metrics, config
				)
			
			# Calculate overall quality scores
			quality_metrics = self._calculate_quality_scores(quality_metrics, validation_result)
			validation_result.quality_metrics = quality_metrics
			
			# Generate recommendations
			validation_result.recommendations = self._generate_recommendations(validation_result)
			
			# Apply auto-fixes if enabled
			if config.auto_fix_minor_issues:
				auto_fixes = await self._apply_auto_fixes(opportunities, validation_result)
				validation_result.auto_fixes_applied = auto_fixes
			
			# Quarantine poor quality data if enabled
			if config.quarantine_poor_quality_data:
				quarantined = await self._quarantine_poor_quality_data(
					opportunities, validation_result, config
				)
				validation_result.opportunities_quarantined = quarantined
			
			# Complete validation
			validation_result.completed_at = datetime.now(timezone.utc)
			validation_result.duration_seconds = time.monotonic() - start_time
			
			# Update statistics
			self._update_validation_stats(validation_result)
			
			# Generate report if enabled
			if config.generate_quality_report:
				await self._generate_quality_report(validation_result)
			
			self.logger.info(
				f"Validated {len(opportunities)} opportunities in "
				f"{validation_result.duration_seconds:.1f}s. "
				f"Quality score: {quality_metrics.overall_quality_score:.1%}"
			)
			
			return validation_result
			
		except Exception as e:
			validation_result.validation_issues.append(
				ValidationIssue(
					issue_id=uuid7str(),
					category=ValidationCategory.ACCURACY,
					level=ValidationLevel.CRITICAL,
					message=f"Validation process failed: {str(e)}"
				)
			)
			self.logger.error(f"Validation failed: {e}")
			return validation_result
	
	async def _validate_opportunities_sequential(
		self,
		opportunities: List[Opportunity],
		validation_result: ValidationResult,
		quality_metrics: QualityMetrics,
		config: ValidationConfig
	):
		"""Validate opportunities sequentially"""
		
		for i, opportunity in enumerate(opportunities):
			try:
				issues = await self._validate_single_opportunity(opportunity, config)
				validation_result.validation_issues.extend(issues)
				
				# Update quality metrics
				self._update_quality_metrics_for_opportunity(quality_metrics, opportunity, issues)
				
				# Check timeout
				if validation_result.started_at:
					elapsed = (datetime.now(timezone.utc) - validation_result.started_at).total_seconds()
					if elapsed > config.max_validation_time_minutes * 60:
						self.logger.warning(f"Validation timeout reached, processed {i+1}/{len(opportunities)}")
						break
				
			except Exception as e:
				validation_result.validation_issues.append(
					ValidationIssue(
						issue_id=uuid7str(),
						category=ValidationCategory.ACCURACY,
						level=ValidationLevel.ERROR,
						message=f"Failed to validate opportunity {i}: {str(e)}",
						opportunity_id=getattr(opportunity, 'opportunity_id', None)
					)
				)
	
	async def _validate_opportunities_parallel(
		self,
		opportunities: List[Opportunity],
		validation_result: ValidationResult,
		quality_metrics: QualityMetrics,
		config: ValidationConfig
	):
		"""Validate opportunities in parallel"""
		
		# Split into batches
		batch_size = config.batch_size
		batches = [
			opportunities[i:i + batch_size]
			for i in range(0, len(opportunities), batch_size)
		]
		
		# Process batches in parallel
		semaphore = asyncio.Semaphore(config.max_parallel_workers)
		
		async def process_batch(batch):
			async with semaphore:
				batch_issues = []
				for opportunity in batch:
					try:
						issues = await self._validate_single_opportunity(opportunity, config)
						batch_issues.extend(issues)
						self._update_quality_metrics_for_opportunity(quality_metrics, opportunity, issues)
					except Exception as e:
						batch_issues.append(
							ValidationIssue(
								issue_id=uuid7str(),
								category=ValidationCategory.ACCURACY,
								level=ValidationLevel.ERROR,
								message=f"Validation error: {str(e)}",
								opportunity_id=getattr(opportunity, 'opportunity_id', None)
							)
						)
				return batch_issues
		
		# Execute all batches
		batch_tasks = [process_batch(batch) for batch in batches]
		batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
		
		# Collect results
		for result in batch_results:
			if isinstance(result, list):
				validation_result.validation_issues.extend(result)
			else:
				# Handle exceptions
				validation_result.validation_issues.append(
					ValidationIssue(
						issue_id=uuid7str(),
						category=ValidationCategory.ACCURACY,
						level=ValidationLevel.CRITICAL,
						message=f"Batch processing error: {str(result)}"
					)
				)
	
	async def _validate_single_opportunity(
		self,
		opportunity: Opportunity,
		config: ValidationConfig
	) -> List[ValidationIssue]:
		"""Validate a single opportunity against all rules"""
		
		issues = []
		
		try:
			# Run each enabled validation rule
			for rule_id, rule in self.validation_rules.items():
				if not rule.enabled:
					continue
				
				# Skip rules based on config
				if rule.category == ValidationCategory.COMPLETENESS and not config.validate_completeness:
					continue
				elif rule.category == ValidationCategory.ACCURACY and not config.validate_accuracy:
					continue
				elif rule.category == ValidationCategory.CONSISTENCY and not config.validate_consistency:
					continue
				elif rule.category == ValidationCategory.FORMAT and not config.validate_format:
					continue
				elif rule.category == ValidationCategory.BUSINESS_RULES and not config.validate_business_rules:
					continue
				
				# Apply the validation rule
				rule_issues = await self._apply_validation_rule(opportunity, rule)
				issues.extend(rule_issues)
			
			# Detect duplicates if enabled
			if config.detect_duplicates:
				duplicate_issues = await self._detect_duplicates(opportunity)
				issues.extend(duplicate_issues)
			
		except Exception as e:
			issues.append(
				ValidationIssue(
					issue_id=uuid7str(),
					category=ValidationCategory.ACCURACY,
					level=ValidationLevel.ERROR,
					message=f"Validation rule application failed: {str(e)}",
					opportunity_id=getattr(opportunity, 'opportunity_id', None)
				)
			)
		
		return issues
	
	async def _apply_validation_rule(
		self,
		opportunity: Opportunity,
		rule: ValidationRule
	) -> List[ValidationIssue]:
		"""Apply a single validation rule to an opportunity"""
		
		issues = []
		
		try:
			# Get field value
			field_value = getattr(opportunity, rule.field_name, None) if rule.field_name else None
			
			# Required field check
			if rule.required and (field_value is None or field_value == ""):
				issues.append(
					ValidationIssue(
						issue_id=uuid7str(),
						category=rule.category,
						level=rule.level,
						message=f"Required field '{rule.field_name}' is missing or empty",
						field_name=rule.field_name,
						opportunity_id=getattr(opportunity, 'opportunity_id', None),
						source_url=opportunity.source_url,
						suggested_fix=f"Provide a value for {rule.field_name}"
					)
				)
				return issues
			
			# Skip validation if field is empty and not required
			if field_value is None or field_value == "":
				return issues
			
			# String field validations
			if isinstance(field_value, str):
				# Length validation
				if rule.min_length is not None and len(field_value) < rule.min_length:
					issues.append(
						ValidationIssue(
							issue_id=uuid7str(),
							category=rule.category,
							level=rule.level,
							message=f"Field '{rule.field_name}' is too short (minimum {rule.min_length} characters)",
							field_name=rule.field_name,
							opportunity_id=getattr(opportunity, 'opportunity_id', None),
							source_url=opportunity.source_url,
							suggested_fix=f"Expand {rule.field_name} to at least {rule.min_length} characters"
						)
					)
				
				if rule.max_length is not None and len(field_value) > rule.max_length:
					issues.append(
						ValidationIssue(
							issue_id=uuid7str(),
							category=rule.category,
							level=rule.level,
							message=f"Field '{rule.field_name}' is too long (maximum {rule.max_length} characters)",
							field_name=rule.field_name,
							opportunity_id=getattr(opportunity, 'opportunity_id', None),
							source_url=opportunity.source_url,
							suggested_fix=f"Truncate {rule.field_name} to {rule.max_length} characters"
						)
					)
				
				# Pattern validation
				if rule.pattern and not re.match(rule.pattern, field_value):
					issues.append(
						ValidationIssue(
							issue_id=uuid7str(),
							category=rule.category,
							level=rule.level,
							message=f"Field '{rule.field_name}' does not match required format",
							field_name=rule.field_name,
							opportunity_id=getattr(opportunity, 'opportunity_id', None),
							source_url=opportunity.source_url,
							suggested_fix=f"Format {rule.field_name} according to pattern: {rule.pattern}"
						)
					)
			
			# Allowed values validation
			if rule.allowed_values and str(field_value).lower() not in [v.lower() for v in rule.allowed_values]:
				issues.append(
					ValidationIssue(
						issue_id=uuid7str(),
						category=rule.category,
						level=rule.level,
						message=f"Field '{rule.field_name}' has invalid value '{field_value}'. Allowed: {rule.allowed_values}",
						field_name=rule.field_name,
						opportunity_id=getattr(opportunity, 'opportunity_id', None),
						source_url=opportunity.source_url,
						suggested_fix=f"Use one of: {', '.join(rule.allowed_values)}"
					)
				)
			
			# Custom validation function
			if rule.validation_function and rule.validation_function in self.custom_validators:
				validator_func = self.custom_validators[rule.validation_function]
				custom_issues = await validator_func(opportunity, field_value, rule)
				issues.extend(custom_issues)
		
		except Exception as e:
			issues.append(
				ValidationIssue(
					issue_id=uuid7str(),
					category=ValidationCategory.ACCURACY,
					level=ValidationLevel.ERROR,
					message=f"Validation rule '{rule.name}' failed: {str(e)}",
					field_name=rule.field_name,
					opportunity_id=getattr(opportunity, 'opportunity_id', None),
					source_url=opportunity.source_url
				)
			)
		
		return issues
	
	async def _validate_deadline_format(
		self,
		opportunity: Opportunity,
		field_value: Any,
		rule: ValidationRule
	) -> List[ValidationIssue]:
		"""Custom field_validator for deadline format"""
		
		issues = []
		
		try:
			if field_value and not isinstance(field_value, datetime):
				issues.append(
					ValidationIssue(
						issue_id=uuid7str(),
						category=rule.category,
						level=rule.level,
						message="Deadline must be a datetime object",
						field_name=rule.field_name,
						opportunity_id=getattr(opportunity, 'opportunity_id', None),
						source_url=opportunity.source_url,
						suggested_fix="Convert deadline to proper datetime format"
					)
				)
		
		except Exception as e:
			issues.append(
				ValidationIssue(
					issue_id=uuid7str(),
					category=ValidationCategory.ACCURACY,
					level=ValidationLevel.ERROR,
					message=f"Deadline format validation failed: {str(e)}",
					field_name=rule.field_name,
					opportunity_id=getattr(opportunity, 'opportunity_id', None),
					source_url=opportunity.source_url
				)
			)
		
		return issues
	
	async def _validate_deadline_future(
		self,
		opportunity: Opportunity,
		field_value: Any,
		rule: ValidationRule
	) -> List[ValidationIssue]:
		"""Custom field_validator to ensure deadline is in future"""
		
		issues = []
		
		try:
			if isinstance(field_value, datetime):
				now = datetime.now(timezone.utc)
				
				# Ensure deadline is timezone-aware
				if field_value.tzinfo is None:
					field_value = field_value.replace(tzinfo=timezone.utc)
				
				if field_value <= now:
					issues.append(
						ValidationIssue(
							issue_id=uuid7str(),
							category=rule.category,
							level=rule.level,
							message=f"Deadline {field_value} is in the past",
							field_name=rule.field_name,
							opportunity_id=getattr(opportunity, 'opportunity_id', None),
							source_url=opportunity.source_url,
							suggested_fix="Update deadline to future date or mark opportunity as expired"
						)
					)
		
		except Exception as e:
			issues.append(
				ValidationIssue(
					issue_id=uuid7str(),
					category=ValidationCategory.ACCURACY,
					level=ValidationLevel.ERROR,
					message=f"Deadline future validation failed: {str(e)}",
					field_name=rule.field_name,
					opportunity_id=getattr(opportunity, 'opportunity_id', None),
					source_url=opportunity.source_url
				)
			)
		
		return issues
	
	async def _validate_estimated_value(
		self,
		opportunity: Opportunity,
		field_value: Any,
		rule: ValidationRule
	) -> List[ValidationIssue]:
		"""Custom field_validator for estimated value"""
		
		issues = []
		
		try:
			if field_value is not None:
				if not isinstance(field_value, (int, float)):
					try:
						float(field_value)
					except (ValueError, TypeError):
						issues.append(
							ValidationIssue(
								issue_id=uuid7str(),
								category=rule.category,
								level=rule.level,
								message=f"Estimated value '{field_value}' is not a valid number",
								field_name=rule.field_name,
								opportunity_id=getattr(opportunity, 'opportunity_id', None),
								source_url=opportunity.source_url,
								suggested_fix="Convert to numeric value or remove if unknown"
							)
						)
				else:
					if field_value < 0:
						issues.append(
							ValidationIssue(
								issue_id=uuid7str(),
								category=rule.category,
								level=rule.level,
								message=f"Estimated value {field_value} cannot be negative",
								field_name=rule.field_name,
								opportunity_id=getattr(opportunity, 'opportunity_id', None),
								source_url=opportunity.source_url,
								suggested_fix="Use positive value or remove if unknown"
							)
						)
		
		except Exception as e:
			issues.append(
				ValidationIssue(
					issue_id=uuid7str(),
					category=ValidationCategory.ACCURACY,
					level=ValidationLevel.ERROR,
					message=f"Estimated value validation failed: {str(e)}",
					field_name=rule.field_name,
					opportunity_id=getattr(opportunity, 'opportunity_id', None),
					source_url=opportunity.source_url
				)
			)
		
		return issues
	
	async def _detect_duplicates(self, opportunity: Opportunity) -> List[ValidationIssue]:
		"""Detect potential duplicate opportunities"""
		
		issues = []
		
		try:
			# Simple duplicate detection based on title similarity and source
			cache_key = f"duplicate_check_{hash(opportunity.title or '')}"
			
			if cache_key in self.validation_cache:
				similar_opportunity = self.validation_cache[cache_key]
				
				# Check if it's a potential duplicate
				title_similarity = self._calculate_title_similarity(
					opportunity.title or "",
					similar_opportunity.get('title', '')
				)
				
				if (title_similarity > 0.8 and 
					opportunity.source_url == similar_opportunity.get('source_url')):
					
					issues.append(
						ValidationIssue(
							issue_id=uuid7str(),
							category=ValidationCategory.DUPLICATE_DETECTION,
							level=ValidationLevel.WARNING,
							message=f"Potential duplicate opportunity detected (similarity: {title_similarity:.1%})",
							opportunity_id=getattr(opportunity, 'opportunity_id', None),
							source_url=opportunity.source_url,
							suggested_fix="Review for duplicate content",
							metadata={
								'similar_to': similar_opportunity.get('opportunity_id'),
								'similarity_score': title_similarity
							}
						)
					)
			else:
				# Cache this opportunity for future duplicate checks
				self.validation_cache[cache_key] = {
					'opportunity_id': getattr(opportunity, 'opportunity_id', None),
					'title': opportunity.title,
					'source_url': opportunity.source_url
				}
		
		except Exception as e:
			self.logger.warning(f"Duplicate detection failed: {e}")
		
		return issues
	
	def _calculate_title_similarity(self, title1: str, title2: str) -> float:
		"""Calculate similarity between two titles"""
		
		try:
			if not title1 or not title2:
				return 0.0
			
			# Simple word overlap similarity
			words1 = set(title1.lower().split())
			words2 = set(title2.lower().split())
			
			if not words1 or not words2:
				return 0.0
			
			intersection = words1 & words2
			union = words1 | words2
			
			return len(intersection) / len(union) if union else 0.0
		
		except Exception as e:
			self.logger.warning(f"Failed to calculate word overlap: {e}")
			return 0.0
	
	def _update_quality_metrics_for_opportunity(
		self,
		quality_metrics: QualityMetrics,
		opportunity: Opportunity,
		issues: List[ValidationIssue]
	):
		"""Update quality metrics based on opportunity validation"""
		
		try:
			# Count issues by category and level
			format_issues = len([i for i in issues if i.category == ValidationCategory.FORMAT])
			business_rule_issues = len([i for i in issues if i.category == ValidationCategory.BUSINESS_RULES])
			
			# Update counts
			quality_metrics.missing_required_fields += len([
				i for i in issues 
				if i.category == ValidationCategory.COMPLETENESS and i.level == ValidationLevel.ERROR
			])
			quality_metrics.format_violations += format_issues
			quality_metrics.rule_violations += business_rule_issues
			
			# Calculate individual opportunity quality score
			total_issues = len(issues)
			critical_issues = len([i for i in issues if i.level == ValidationLevel.CRITICAL])
			error_issues = len([i for i in issues if i.level == ValidationLevel.ERROR])
			
			# Quality score calculation (0-1 scale)
			opportunity_quality = 1.0
			opportunity_quality -= critical_issues * 0.3  # Critical issues heavily penalized
			opportunity_quality -= error_issues * 0.15    # Error issues moderately penalized
			opportunity_quality -= (total_issues - critical_issues - error_issues) * 0.05  # Other issues lightly penalized
			opportunity_quality = max(0.0, opportunity_quality)
			
			# Update quality distribution
			if opportunity_quality >= 0.9:
				quality_metrics.excellent_quality_count += 1
			elif opportunity_quality >= 0.7:
				quality_metrics.good_quality_count += 1
			elif opportunity_quality >= 0.5:
				quality_metrics.fair_quality_count += 1
			else:
				quality_metrics.poor_quality_count += 1
		
		except Exception as e:
			self.logger.warning(f"Failed to update quality metrics: {e}")
	
	def _calculate_quality_scores(
		self,
		quality_metrics: QualityMetrics,
		validation_result: ValidationResult
	) -> QualityMetrics:
		"""Calculate overall quality scores"""
		
		try:
			total_opportunities = quality_metrics.total_opportunities_validated
			if total_opportunities == 0:
				return quality_metrics
			
			# Completeness score
			required_field_issues = len([
				i for i in validation_result.validation_issues
				if i.category == ValidationCategory.COMPLETENESS and i.level == ValidationLevel.ERROR
			])
			quality_metrics.completeness_score = max(
				0.0, 1.0 - (required_field_issues / total_opportunities)
			)
			
			# Accuracy score
			accuracy_issues = len([
				i for i in validation_result.validation_issues
				if i.category == ValidationCategory.ACCURACY
			])
			quality_metrics.accuracy_score = max(
				0.0, 1.0 - (accuracy_issues / total_opportunities)
			)
			
			# Consistency score
			consistency_issues = len([
				i for i in validation_result.validation_issues
				if i.category == ValidationCategory.CONSISTENCY
			])
			quality_metrics.consistency_score = max(
				0.0, 1.0 - (consistency_issues / total_opportunities)
			)
			
			# Business rule score
			business_rule_issues = len([
				i for i in validation_result.validation_issues
				if i.category == ValidationCategory.BUSINESS_RULES
			])
			quality_metrics.business_rule_score = max(
				0.0, 1.0 - (business_rule_issues / total_opportunities)
			)
			
			# Overall quality score (weighted average)
			quality_metrics.overall_quality_score = (
				quality_metrics.completeness_score * 0.3 +
				quality_metrics.accuracy_score * 0.25 +
				quality_metrics.consistency_score * 0.25 +
				quality_metrics.business_rule_score * 0.2
			)
			
			# Update total issues found
			quality_metrics.total_issues_found = len(validation_result.validation_issues)
			
			# Calculate issue summaries
			validation_result.issues_by_category = {}
			validation_result.issues_by_level = {}
			
			for issue in validation_result.validation_issues:
				# By category
				category = issue.category.value
				validation_result.issues_by_category[category] = validation_result.issues_by_category.get(category, 0) + 1
				
				# By level
				level = issue.level.value
				validation_result.issues_by_level[level] = validation_result.issues_by_level.get(level, 0) + 1
		
		except Exception as e:
			self.logger.error(f"Quality score calculation failed: {e}")
		
		return quality_metrics
	
	def _generate_recommendations(self, validation_result: ValidationResult) -> List[str]:
		"""Generate recommendations based on validation results"""
		
		recommendations = []
		
		try:
			metrics = validation_result.quality_metrics
			
			# Completeness recommendations
			if metrics.completeness_score < 0.8:
				recommendations.append(
					"Improve data completeness by ensuring all required fields are populated"
				)
			
			if metrics.missing_required_fields > 0:
				recommendations.append(
					f"Fix {metrics.missing_required_fields} missing required field issues"
				)
			
			# Accuracy recommendations
			if metrics.accuracy_score < 0.75:
				recommendations.append(
					"Enhance extraction accuracy by reviewing and improving extraction patterns"
				)
			
			if metrics.format_violations > 0:
				recommendations.append(
					f"Fix {metrics.format_violations} format violations to improve data quality"
				)
			
			# Consistency recommendations
			if metrics.consistency_score < 0.85:
				recommendations.append(
					"Improve data consistency by standardizing field formats and values"
				)
			
			# Business rule recommendations
			if metrics.business_rule_score < 0.8:
				recommendations.append(
					"Review business rule violations and update extraction logic accordingly"
				)
			
			# Duplicate detection recommendations
			if metrics.duplicate_opportunities > 0:
				recommendations.append(
					f"Review {metrics.duplicate_opportunities} potential duplicate opportunities"
				)
			
			# Overall quality recommendations
			if metrics.overall_quality_score < 0.7:
				recommendations.append(
					"Overall data quality is below threshold - consider comprehensive review of extraction processes"
				)
			
			# Performance recommendations
			poor_quality_rate = metrics.poor_quality_count / max(metrics.total_opportunities_validated, 1)
			if poor_quality_rate > 0.2:
				recommendations.append(
					f"High rate of poor quality data ({poor_quality_rate:.1%}) - review extraction sources and methods"
				)
		
		except Exception as e:
			self.logger.error(f"Recommendation generation failed: {e}")
		
		return recommendations
	
	async def _apply_auto_fixes(
		self,
		opportunities: List[Opportunity],
		validation_result: ValidationResult
	) -> int:
		"""Apply automatic fixes for minor issues"""
		
		fixes_applied = 0
		
		try:
			# Group issues that can be auto-fixed
			auto_fixable_issues = [
				issue for issue in validation_result.validation_issues
				if issue.level in [ValidationLevel.INFO, ValidationLevel.WARNING]
				and issue.suggested_fix
			]
			
			for issue in auto_fixable_issues:
				try:
					if issue.field_name and issue.opportunity_id:
						# Find the opportunity
						opportunity = next(
							(opp for opp in opportunities 
							 if getattr(opp, 'opportunity_id', None) == issue.opportunity_id),
							None
						)
						
						if opportunity:
							# Apply simple fixes
							if "trim whitespace" in (issue.suggested_fix or "").lower():
								field_value = getattr(opportunity, issue.field_name, None)
								if isinstance(field_value, str):
									setattr(opportunity, issue.field_name, field_value.strip())
									fixes_applied += 1
							
							elif "convert to lowercase" in (issue.suggested_fix or "").lower():
								field_value = getattr(opportunity, issue.field_name, None)
								if isinstance(field_value, str):
									setattr(opportunity, issue.field_name, field_value.lower())
									fixes_applied += 1
				
				except Exception as e:
					self.logger.warning(f"Auto-fix failed for issue {issue.issue_id}: {e}")
		
		except Exception as e:
			self.logger.error(f"Auto-fix process failed: {e}")
		
		return fixes_applied
	
	async def _quarantine_poor_quality_data(
		self,
		opportunities: List[Opportunity],
		validation_result: ValidationResult,
		config: ValidationConfig
	) -> int:
		"""Quarantine opportunities with poor quality"""
		
		quarantined = 0
		
		try:
			# Calculate quality score for each opportunity
			for opportunity in opportunities:
				# Find issues for this opportunity
				opp_issues = [
					issue for issue in validation_result.validation_issues
					if issue.opportunity_id == getattr(opportunity, 'opportunity_id', None)
				]
				
				# Calculate opportunity quality score
				critical_issues = len([i for i in opp_issues if i.level == ValidationLevel.CRITICAL])
				error_issues = len([i for i in opp_issues if i.level == ValidationLevel.ERROR])
				total_issues = len(opp_issues)
				
				quality_score = 1.0 - (critical_issues * 0.3 + error_issues * 0.15 + total_issues * 0.05)
				quality_score = max(0.0, quality_score)
				
				# Quarantine if below threshold
				if quality_score < config.quality_threshold_for_quarantine:
					# In a real implementation, this would move the data to a quarantine area
					self.logger.info(f"Quarantined opportunity {opportunity.title} (quality: {quality_score:.1%})")
					quarantined += 1
		
		except Exception as e:
			self.logger.error(f"Quarantine process failed: {e}")
		
		return quarantined
	
	def _update_validation_stats(self, validation_result: ValidationResult):
		"""Update validation statistics"""
		
		try:
			self.validation_stats['total_validations'] += 1
			self.validation_stats['total_opportunities_validated'] += validation_result.total_opportunities_processed
			self.validation_stats['total_issues_found'] += validation_result.quality_metrics.total_issues_found
			self.validation_stats['auto_fixes_applied'] += validation_result.auto_fixes_applied
			self.validation_stats['opportunities_quarantined'] += validation_result.opportunities_quarantined
			self.validation_stats['last_validation'] = validation_result.completed_at
			
			# Update average validation time
			if validation_result.duration_seconds:
				current_avg = self.validation_stats['avg_validation_time']
				total_validations = self.validation_stats['total_validations']
				
				self.validation_stats['avg_validation_time'] = (
					(current_avg * (total_validations - 1) + validation_result.duration_seconds) / total_validations
				)
		
		except Exception as e:
			self.logger.error(f"Stats update failed: {e}")
	
	async def _generate_quality_report(self, validation_result: ValidationResult):
		"""Generate detailed quality report"""
		
		try:
			report = {
				'validation_summary': {
					'validation_id': validation_result.validation_id,
					'validation_date': validation_result.completed_at.isoformat() if validation_result.completed_at else None,
					'duration_seconds': validation_result.duration_seconds,
					'opportunities_processed': validation_result.total_opportunities_processed
				},
				'quality_metrics': validation_result.quality_metrics.dict(),
				'issue_summary': {
					'total_issues': len(validation_result.validation_issues),
					'issues_by_category': validation_result.issues_by_category,
					'issues_by_level': validation_result.issues_by_level
				},
				'recommendations': validation_result.recommendations,
				'auto_fixes_applied': validation_result.auto_fixes_applied,
				'opportunities_quarantined': validation_result.opportunities_quarantined,
				'detailed_issues': [
					{
						'issue_id': issue.issue_id,
						'category': issue.category.value,
						'level': issue.level.value,
						'message': issue.message,
						'field_name': issue.field_name,
						'source_url': issue.source_url,
						'suggested_fix': issue.suggested_fix
					}
					for issue in validation_result.validation_issues[:100]  # Limit to first 100 issues
				]
			}
			
			# Save report
			report_file = self.validation_dir / f"quality_report_{validation_result.validation_id}.json"
			with open(report_file, 'w') as f:
				json.dump(report, f, indent=2, default=str)
			
			self.logger.info(f"Generated quality report: {report_file}")
		
		except Exception as e:
			self.logger.error(f"Quality report generation failed: {e}")
	
	def add_validation_rule(self, rule: ValidationRule) -> bool:
		"""Add a custom validation rule"""
		
		try:
			self.validation_rules[rule.rule_id] = rule
			self.logger.info(f"Added validation rule: {rule.name}")
			return True
		
		except Exception as e:
			self.logger.error(f"Failed to add validation rule: {e}")
			return False
	
	def get_validation_stats(self) -> Dict[str, Any]:
		"""Get validation statistics"""
		
		stats = self.validation_stats.copy()
		
		# Add current state
		stats.update({
			'validation_rules_loaded': len(self.validation_rules),
			'custom_validators': len(self.custom_validators),
			'cache_entries': len(self.validation_cache)
		})
		
		return stats
	
	async def cleanup(self):
		"""Clean up validation resources"""
		
		try:
			# Clear cache
			self.validation_cache.clear()
			
			self.logger.info("DataValidator cleanup completed")
		
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_data_validator(
	global_db: Optional[GlobalSourceDB] = None,
	config: Optional[ValidationConfig] = None
) -> DataValidator:
	"""Create a DataValidator instance"""
	return DataValidator(global_db, config)
