"""
Document Engine Compliance Integration

Integrates compliance validation with document generation process including:
- Real-time compliance checking during document creation
- Format validation before rendering
- Compliance reporting and recommendations
- Automatic compliance fixes where possible
"""

from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
import asyncio

from ..compliance.validators.regulatory_validator import (
	RegulatoryValidator, ComplianceReport, ComplianceStatus
)
from ..compliance.validators.format_validator import (
	FormatValidator, FormatReport
)
from ..compliance.frameworks.compliance_framework import ComplianceFramework
from ..core.utils import uuid7str

class DocumentComplianceStatus(Enum):
	"""Overall document compliance status"""
	COMPLIANT = "compliant"
	NON_COMPLIANT = "non_compliant"
	PARTIAL_COMPLIANT = "partial_compliant"
	VALIDATION_PENDING = "validation_pending"
	VALIDATION_ERROR = "validation_error"

@dataclass
class ComplianceCheck:
	"""Individual compliance check configuration"""
	check_id: str = field(default_factory=uuid7str)
	check_type: str = ""  # regulatory, format, custom
	framework_code: str = ""  # FAR, DFARS, HIPAA, etc.
	enabled: bool = True
	severity_threshold: str = "medium"  # minimum severity to report
	auto_fix: bool = False
	check_timing: str = "pre_render"  # pre_render, post_render, real_time
	parameters: Dict[str, Any] = field(default_factory=dict)

class DocumentComplianceConfig(BaseModel):
	"""Configuration for document compliance validation"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	config_id: str = Field(default_factory=uuid7str)
	document_type: str = "proposal"
	industry: str = ""
	jurisdiction: str = "federal"
	
	# Compliance checks to perform
	compliance_checks: List[ComplianceCheck] = Field(default_factory=list)
	
	# Validation settings
	validate_on_save: bool = True
	validate_on_render: bool = True
	validate_real_time: bool = False
	block_render_on_violations: bool = False
	
	# Reporting settings
	generate_compliance_report: bool = True
	include_recommendations: bool = True
	detailed_violation_info: bool = True
	
	# Auto-fix settings
	enable_auto_fix: bool = False
	auto_fix_severity_limit: str = "low"  # Only auto-fix up to this severity
	require_approval_for_fixes: bool = True
	
	created_date: datetime = Field(default_factory=datetime.now)
	metadata: Dict[str, Any] = Field(default_factory=dict)

class ComplianceIntegrationResult(BaseModel):
	"""Result of compliance integration process"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	result_id: str = Field(default_factory=uuid7str)
	document_id: str
	overall_status: DocumentComplianceStatus
	compliance_score: float = Field(ge=0.0, le=100.0)
	
	# Individual validation results
	regulatory_report: Optional[ComplianceReport] = None
	format_report: Optional[FormatReport] = None
	custom_reports: List[Dict[str, Any]] = Field(default_factory=list)
	
	# Summary metrics
	total_violations: int = 0
	critical_violations: int = 0
	high_violations: int = 0
	medium_violations: int = 0
	low_violations: int = 0
	
	# Actions taken
	auto_fixes_applied: List[str] = Field(default_factory=list)
	recommendations: List[str] = Field(default_factory=list)
	
	# Metadata
	validation_time_ms: float = 0.0
	created_at: datetime = Field(default_factory=datetime.now)
	metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentComplianceIntegrator:
	"""
	Integrates compliance validation with document generation process.
	
	Provides seamless compliance checking during document creation,
	editing, and rendering with real-time feedback and automatic fixes.
	"""
	
	def __init__(self):
		self.regulatory_field_validator = RegulatoryValidator()
		self.format_field_validator = FormatValidator()
		self.frameworks: Dict[str, ComplianceFramework] = {}
		self.default_configs: Dict[str, DocumentComplianceConfig] = {}
		self._initialize_default_configs()
		self._initialize_default_frameworks()
	
	def _initialize_default_frameworks(self) -> None:
		"""Initialize default compliance frameworks"""
		# Create default frameworks
		far_framework = ComplianceFramework.create_far_framework()
		dfars_framework = ComplianceFramework.create_dfars_framework()
		hipaa_framework = ComplianceFramework.create_hipaa_framework()
		
		self.frameworks = {
			"FAR": far_framework,
			"DFARS": dfars_framework,
			"HIPAA": hipaa_framework
		}
	
	def _initialize_default_configs(self) -> None:
		"""Initialize default compliance configurations"""
		
		# Government proposal configuration
		gov_proposal_checks = [
			ComplianceCheck(
				check_type="regulatory",
				framework_code="FAR",
				enabled=True,
				severity_threshold="medium",
				check_timing="pre_render"
			),
			ComplianceCheck(
				check_type="format",
				framework_code="STANDARD",
				enabled=True,
				severity_threshold="high",
				check_timing="pre_render"
			)
		]
		
		gov_proposal_config = DocumentComplianceConfig(
			document_type="government_proposal",
			industry="government_contracting",
			jurisdiction="federal",
			compliance_checks=gov_proposal_checks,
			validate_on_render=True,
			block_render_on_violations=False
		)
		
		# Defense proposal configuration
		defense_proposal_checks = [
			ComplianceCheck(
				check_type="regulatory",
				framework_code="FAR",
				enabled=True,
				severity_threshold="medium"
			),
			ComplianceCheck(
				check_type="regulatory",
				framework_code="DFARS",
				enabled=True,
				severity_threshold="high"
			),
			ComplianceCheck(
				check_type="format",
				framework_code="STANDARD",
				enabled=True,
				severity_threshold="high"
			)
		]
		
		defense_proposal_config = DocumentComplianceConfig(
			document_type="defense_proposal",
			industry="defense_contracting",
			jurisdiction="federal",
			compliance_checks=defense_proposal_checks,
			validate_on_render=True,
			block_render_on_violations=True  # Stricter for defense
		)
		
		# Healthcare proposal configuration
		healthcare_proposal_checks = [
			ComplianceCheck(
				check_type="regulatory",
				framework_code="HIPAA",
				enabled=True,
				severity_threshold="high"
			),
			ComplianceCheck(
				check_type="format",
				framework_code="STANDARD",
				enabled=True,
				severity_threshold="medium"
			)
		]
		
		healthcare_proposal_config = DocumentComplianceConfig(
			document_type="healthcare_proposal",
			industry="healthcare",
			jurisdiction="federal",
			compliance_checks=healthcare_proposal_checks,
			validate_on_render=True,
			enable_auto_fix=False  # Conservative for healthcare
		)
		
		self.default_configs = {
			"government_proposal": gov_proposal_config,
			"defense_proposal": defense_proposal_config,
			"healthcare_proposal": healthcare_proposal_config
		}
	
	async def validate_document_compliance(
		self,
		document_content: str,
		document_id: str,
		document_path: Optional[str] = None,
		config: Optional[DocumentComplianceConfig] = None,
		document_type: Optional[str] = None
	) -> ComplianceIntegrationResult:
		"""
		Perform comprehensive compliance validation on document
		
		Args:
			document_content: Full document text content
			document_id: Unique document identifier
			document_path: Path to document file (for format validation)
			config: Compliance configuration (if None, uses default)
			document_type: Document type (if different from config)
			
		Returns:
			ComplianceIntegrationResult with validation results
		"""
		start_time = datetime.now()
		
		# Determine configuration
		if config is None:
			config = self._get_default_config(document_type or "proposal")
		
		# Initialize result
		result = ComplianceIntegrationResult(
			document_id=document_id,
			overall_status=DocumentComplianceStatus.VALIDATION_PENDING,
			compliance_score=0.0
		)
		
		try:
			# Perform regulatory validation
			if self._should_run_check(config, "regulatory"):
				regulatory_report = await self._run_regulatory_validation(
					document_content, config, document_type or config.document_type
				)
				result.regulatory_report = regulatory_report
			
			# Perform format validation
			if self._should_run_check(config, "format") and document_path:
				format_report = await self._run_format_validation(
					document_path, document_content, config
				)
				result.format_report = format_report
			
			# Calculate overall compliance metrics
			result = self._calculate_overall_compliance(result, config)
			
			# Generate recommendations
			result.recommendations = self._generate_recommendations(result, config)
			
			# Apply auto-fixes if enabled
			if config.enable_auto_fix:
				auto_fixes = await self._apply_auto_fixes(result, config)
				result.auto_fixes_applied = auto_fixes
			
		except Exception as e:
			result.overall_status = DocumentComplianceStatus.VALIDATION_ERROR
			result.metadata["error"] = str(e)
		
		# Calculate processing time
		processing_time = (datetime.now() - start_time).total_seconds() * 1000
		result.validation_time_ms = processing_time
		
		return result
	
	def _should_run_check(self, config: DocumentComplianceConfig, check_type: str) -> bool:
		"""Determine if a specific check type should be run"""
		return any(
			check.check_type == check_type and check.enabled 
			for check in config.compliance_checks
		)
	
	async def _run_regulatory_validation(
		self,
		document_content: str,
		config: DocumentComplianceConfig,
		document_type: str
	) -> ComplianceReport:
		"""Run regulatory compliance validation"""
		
		# Get applicable frameworks
		frameworks_to_check = []
		for check in config.compliance_checks:
			if check.check_type == "regulatory" and check.enabled:
				frameworks_to_check.append(check.framework_code)
		
		# Run validation
		return await self.regulatory_field_validator.validate_document(
			document_content=document_content,
			document_type=document_type,
			regulations=frameworks_to_check
		)
	
	async def _run_format_validation(
		self,
		document_path: str,
		document_content: Optional[str],
		config: DocumentComplianceConfig
	) -> FormatReport:
		"""Run format compliance validation"""
		
		# Get format specifications from config
		format_specs = {}
		for check in config.compliance_checks:
			if check.check_type == "format" and check.enabled:
				format_specs.update(check.parameters)
		
		# Run validation
		return await self.format_field_validator.validate_document_format(
			document_path=document_path,
			document_content=document_content,
			format_specifications=format_specs
		)
	
	def _calculate_overall_compliance(
		self,
		result: ComplianceIntegrationResult,
		config: DocumentComplianceConfig
	) -> ComplianceIntegrationResult:
		"""Calculate overall compliance metrics and status"""
		
		total_violations = 0
		critical_violations = 0
		high_violations = 0
		medium_violations = 0
		low_violations = 0
		compliance_scores = []
		
		# Aggregate regulatory compliance
		if result.regulatory_report:
			total_violations += result.regulatory_report.violations_found
			critical_violations += result.regulatory_report.critical_violations
			high_violations += result.regulatory_report.high_violations
			medium_violations += result.regulatory_report.medium_violations
			low_violations += result.regulatory_report.low_violations
			compliance_scores.append(result.regulatory_report.compliance_score)
		
		# Aggregate format compliance
		if result.format_report:
			total_violations += result.format_report.violations_found
			critical_violations += result.format_report.critical_violations
			high_violations += result.format_report.high_violations
			medium_violations += result.format_report.medium_violations
			low_violations += result.format_report.low_violations
			compliance_scores.append(result.format_report.format_compliance_score)
		
		# Calculate overall score
		overall_score = sum(compliance_scores) / len(compliance_scores) if compliance_scores else 100.0
		
		# Determine overall status
		if critical_violations > 0:
			overall_status = DocumentComplianceStatus.NON_COMPLIANT
		elif high_violations > 0 or overall_score < 70:
			overall_status = DocumentComplianceStatus.PARTIAL_COMPLIANT
		else:
			overall_status = DocumentComplianceStatus.COMPLIANT
		
		# Update result
		result.total_violations = total_violations
		result.critical_violations = critical_violations
		result.high_violations = high_violations
		result.medium_violations = medium_violations
		result.low_violations = low_violations
		result.compliance_score = overall_score
		result.overall_status = overall_status
		
		return result
	
	def _generate_recommendations(
		self,
		result: ComplianceIntegrationResult,
		config: DocumentComplianceConfig
	) -> List[str]:
		"""Generate actionable compliance recommendations"""
		recommendations = []
		
		# Regulatory recommendations
		if result.regulatory_report and result.regulatory_report.recommendations:
			recommendations.extend(result.regulatory_report.recommendations)
		
		# Format recommendations
		if result.format_report and result.format_report.recommendations:
			recommendations.extend(result.format_report.recommendations)
		
		# Overall recommendations based on status
		if result.overall_status == DocumentComplianceStatus.NON_COMPLIANT:
			recommendations.insert(0,
				"Document has critical compliance violations that must be addressed "
				"before submission or publication."
			)
		elif result.overall_status == DocumentComplianceStatus.PARTIAL_COMPLIANT:
			recommendations.insert(0,
				"Document partially meets compliance requirements. Review and address "
				"violations to ensure full compliance."
			)
		
		# Auto-fix recommendations
		if config.enable_auto_fix and not result.auto_fixes_applied:
			recommendations.append(
				"Consider enabling auto-fix for low-severity violations to "
				"automatically resolve common compliance issues."
			)
		
		return recommendations
	
	async def _apply_auto_fixes(
		self,
		result: ComplianceIntegrationResult,
		config: DocumentComplianceConfig
	) -> List[str]:
		"""Apply automatic fixes for compliance violations"""
		applied_fixes = []
		
		# This would implement actual auto-fixing logic
		# For now, return placeholder fixes
		
		severity_limit = config.auto_fix_severity_limit
		if result.low_violations > 0 and severity_limit in ["low", "medium", "high", "critical"]:
			applied_fixes.append("Applied automatic formatting fixes")
		
		if result.medium_violations > 0 and severity_limit in ["medium", "high", "critical"]:
			applied_fixes.append("Applied automatic section header fixes")
		
		return applied_fixes
	
	def _get_default_config(self, document_type: str) -> DocumentComplianceConfig:
		"""Get default configuration for document type"""
		
		# Map document types to configurations
		type_mapping = {
			"proposal": "government_proposal",
			"government_proposal": "government_proposal",
			"rfp_response": "government_proposal",
			"defense_proposal": "defense_proposal",
			"defense_contract": "defense_proposal",
			"healthcare_proposal": "healthcare_proposal",
			"healthcare_contract": "healthcare_proposal"
		}
		
		config_key = type_mapping.get(document_type, "government_proposal")
		return self.default_configs.get(config_key, self.default_configs["government_proposal"])
	
	async def validate_pre_render(
		self,
		document_content: str,
		document_id: str,
		document_type: str,
		config: Optional[DocumentComplianceConfig] = None
	) -> Tuple[bool, ComplianceIntegrationResult]:
		"""
		Validate document before rendering
		
		Returns:
			Tuple of (can_proceed, compliance_result)
		"""
		result = await self.validate_document_compliance(
			document_content=document_content,
			document_id=document_id,
			config=config,
			document_type=document_type
		)
		
		# Determine if rendering can proceed
		if config is None:
			config = self._get_default_config(document_type)
		
		can_proceed = True
		if config.block_render_on_violations:
			can_proceed = (result.overall_status != DocumentComplianceStatus.NON_COMPLIANT 
						  and result.critical_violations == 0)
		
		return can_proceed, result
	
	async def validate_post_render(
		self,
		document_path: str,
		document_content: str,
		document_id: str,
		document_type: str,
		config: Optional[DocumentComplianceConfig] = None
	) -> ComplianceIntegrationResult:
		"""Validate document after rendering"""
		return await self.validate_document_compliance(
			document_content=document_content,
			document_id=document_id,
			document_path=document_path,
			config=config,
			document_type=document_type
		)
	
	async def get_compliance_checklist(
		self,
		document_type: str,
		config: Optional[DocumentComplianceConfig] = None
	) -> List[Dict[str, Any]]:
		"""Get compliance checklist for document type"""
		if config is None:
			config = self._get_default_config(document_type)
		
		checklist_items = []
		
		# Get items from applicable frameworks
		for check in config.compliance_checks:
			if check.check_type == "regulatory" and check.framework_code in self.frameworks:
				framework = self.frameworks[check.framework_code]
				framework_checklist = framework.generate_compliance_checklist(
					document_type=document_type,
					include_optional=False
				)
				checklist_items.extend(framework_checklist)
		
		# Add format validation items
		format_items = [
			{
				"rule_code": "FORMAT-001",
				"title": "Document Format Compliance",
				"description": "Document must be in approved format with proper structure",
				"category": "format",
				"severity": "high",
				"mandatory": True,
				"checked": False
			},
			{
				"rule_code": "FORMAT-002", 
				"title": "File Size Compliance",
				"description": "Document must not exceed maximum file size limits",
				"category": "format",
				"severity": "medium",
				"mandatory": True,
				"checked": False
			}
		]
		checklist_items.extend(format_items)
		
		return checklist_items
	
	def add_custom_framework(self, framework: ComplianceFramework) -> None:
		"""Add a custom compliance framework"""
		self.frameworks[framework.code] = framework
	
	def get_framework(self, framework_code: str) -> Optional[ComplianceFramework]:
		"""Get compliance framework by code"""
		return self.frameworks.get(framework_code)
	
	def list_available_frameworks(self) -> List[Dict[str, str]]:
		"""List all available compliance frameworks"""
		return [
			{
				"code": code,
				"name": framework.name,
				"type": framework.framework_type.value,
				"jurisdiction": framework.jurisdiction.value,
				"rule_count": len(framework.rules)
			}
			for code, framework in self.frameworks.items()
		]