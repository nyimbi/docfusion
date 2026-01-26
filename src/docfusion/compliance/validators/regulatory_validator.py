"""
Regulatory Validator Module

Provides comprehensive regulatory compliance validation including:
- FAR (Federal Acquisition Regulation) compliance
- DFARS (Defense Federal Acquisition Regulation Supplement)
- State and local regulations
- Industry-specific compliance requirements
"""

from typing import Any, Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import re
from datetime import datetime
import uuid
def uuid7str() -> str:
	return str(uuid.uuid4())
from pydantic import BaseModel, Field, ConfigDict, validator
import asyncio
import json


class ViolationSeverity(Enum):
	"""Severity levels for compliance violations"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium" 
	LOW = "low"
	WARNING = "warning"


class ComplianceStatus(Enum):
	"""Compliance status enumeration"""
	COMPLIANT = "compliant"
	NON_COMPLIANT = "non_compliant"
	PARTIAL_COMPLIANT = "partial_compliant"
	UNKNOWN = "unknown"
	EXEMPTED = "exempted"


@dataclass
class ComplianceViolation:
	"""Represents a compliance violation"""
	violation_id: str = field(default_factory=uuid7str)
	rule_id: str = ""
	rule_name: str = ""
	description: str = ""
	severity: ViolationSeverity = ViolationSeverity.MEDIUM
	location: str = ""
	recommendation: str = ""
	regulation: str = ""
	section: str = ""
	detected_at: datetime = field(default_factory=datetime.now)
	metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplianceRule:
	"""Defines a compliance rule"""
	rule_id: str = field(default_factory=uuid7str)
	name: str = ""
	description: str = ""
	regulation: str = ""
	section: str = ""
	severity: ViolationSeverity = ViolationSeverity.MEDIUM
	pattern: Optional[str] = None
	validator_function: Optional[str] = None
	active: bool = True
	exemptions: List[str] = field(default_factory=list)
	metadata: Dict[str, Any] = field(default_factory=dict)


class ComplianceReport(BaseModel):
	"""Comprehensive compliance report"""
	model_config = ConfigDict(extra='forbid', validate_default=True)
	
	report_id: str = Field(default_factory=uuid7str)
	document_id: str
	document_type: str
	assessment_date: datetime = Field(default_factory=datetime.now)
	overall_status: ComplianceStatus
	compliance_score: float = Field(ge=0.0, le=100.0)
	total_rules_checked: int
	violations_found: int
	critical_violations: int = 0
	high_violations: int = 0
	medium_violations: int = 0
	low_violations: int = 0
	violations: List[ComplianceViolation] = Field(default_factory=list)
	recommendations: List[str] = Field(default_factory=list)
	exemptions_applied: List[str] = Field(default_factory=list)
	processing_time_ms: float = 0.0
	metadata: Dict[str, Any] = Field(default_factory=dict)


class RegulatoryValidator:
	"""
	Comprehensive regulatory compliance validator.
	
	Validates documents against regulatory requirements including:
	- Federal Acquisition Regulation (FAR)
	- Defense Federal Acquisition Regulation Supplement (DFARS)
	- State and local procurement regulations
	- Industry-specific requirements
	"""
	
	def __init__(self):
		self.regulation_database: Dict[str, List[ComplianceRule]] = {}
		self.exemption_registry: Dict[str, List[str]] = {}
		self._initialize_default_regulations()
	
	def _initialize_default_regulations(self) -> None:
		"""Initialize default regulatory rules"""
		
		# FAR (Federal Acquisition Regulation) Rules
		far_rules = [
			ComplianceRule(
				name="FAR 15.204-5 - Proposal Content Requirements",
				description="Proposal must contain technical approach, past performance, and cost/price information",
				regulation="FAR",
				section="15.204-5",
				severity=ViolationSeverity.HIGH,
				pattern=r"(?i)(technical\s+approach|past\s+performance|cost|price)",
				validator_function="validate_proposal_content"
			),
			ComplianceRule(
				name="FAR 52.204-8 - Annual Representations and Certifications",
				description="Contractor must provide required representations and certifications",
				regulation="FAR",
				section="52.204-8",
				severity=ViolationSeverity.CRITICAL,
				pattern=r"(?i)(representations?|certifications?)",
				validator_function="validate_representations"
			),
			ComplianceRule(
				name="FAR 9.104 - Standards for Contractor Responsibility",
				description="Contractor must demonstrate financial resources, performance record, and integrity",
				regulation="FAR", 
				section="9.104",
				severity=ViolationSeverity.HIGH,
				pattern=r"(?i)(financial\s+resources|performance\s+record|integrity|responsibility)",
				validator_function="validate_contractor_responsibility"
			),
			ComplianceRule(
				name="FAR 52.219-9 - Small Business Subcontracting Plan",
				description="Large businesses must submit subcontracting plan for small business utilization",
				regulation="FAR",
				section="52.219-9", 
				severity=ViolationSeverity.MEDIUM,
				pattern=r"(?i)(small\s+business|subcontract|subcontracting\s+plan)",
				validator_function="validate_subcontracting_plan"
			)
		]
		
		# DFARS (Defense Federal Acquisition Regulation Supplement) Rules
		dfars_rules = [
			ComplianceRule(
				name="DFARS 252.204-7012 - Cybersecurity Requirements",
				description="Contractor must implement adequate security to protect covered defense information",
				regulation="DFARS",
				section="252.204-7012",
				severity=ViolationSeverity.CRITICAL,
				pattern=r"(?i)(cybersecurity|information\s+security|NIST\s+SP\s+800-171)",
				validator_function="validate_cybersecurity_requirements"
			),
			ComplianceRule(
				name="DFARS 252.225-7001 - Buy American Act and Balance of Payments",
				description="Contractor must comply with Buy American Act requirements",
				regulation="DFARS",
				section="252.225-7001",
				severity=ViolationSeverity.HIGH,
				pattern=r"(?i)(buy\s+american|domestic|foreign|end\s+product)",
				validator_function="validate_buy_american"
			),
			ComplianceRule(
				name="DFARS 252.239-7018 - Supply Chain Risk Assessment",
				description="Contractor must assess and mitigate supply chain risks",
				regulation="DFARS",
				section="252.239-7018",
				severity=ViolationSeverity.HIGH,
				pattern=r"(?i)(supply\s+chain|risk\s+assessment|telecommunications|video\s+surveillance)",
				validator_function="validate_supply_chain_risk"
			)
		]
		
		# State and Local Regulations (Examples)
		state_rules = [
			ComplianceRule(
				name="State Procurement - Minority Business Enterprise",
				description="Must meet minority and women-owned business participation requirements",
				regulation="STATE",
				section="MBE/WBE",
				severity=ViolationSeverity.MEDIUM,
				pattern=r"(?i)(minority|women.owned|MBE|WBE|disadvantaged)",
				validator_function="validate_mbe_wbe"
			),
			ComplianceRule(
				name="State Procurement - Prevailing Wage Requirements",
				description="Must comply with state prevailing wage requirements for construction",
				regulation="STATE", 
				section="PREVAILING_WAGE",
				severity=ViolationSeverity.HIGH,
				pattern=r"(?i)(prevailing\s+wage|davis.bacon|construction\s+wage)",
				validator_function="validate_prevailing_wage"
			)
		]
		
		# Industry-Specific Rules
		industry_rules = [
			ComplianceRule(
				name="HIPAA - Healthcare Data Protection",
				description="Must comply with HIPAA requirements for protected health information",
				regulation="HIPAA",
				section="164.306",
				severity=ViolationSeverity.CRITICAL,
				pattern=r"(?i)(HIPAA|PHI|protected\s+health|healthcare\s+data)",
				validator_function="validate_hipaa_compliance"
			),
			ComplianceRule(
				name="SOX - Financial Controls",
				description="Must comply with Sarbanes-Oxley financial control requirements",
				regulation="SOX",
				section="404",
				severity=ViolationSeverity.HIGH,
				pattern=r"(?i)(sarbanes.oxley|SOX|financial\s+controls|internal\s+controls)",
				validator_function="validate_sox_compliance"
			)
		]
		
		# Store rules by regulation type
		self.regulation_database = {
			"FAR": far_rules,
			"DFARS": dfars_rules,
			"STATE": state_rules,
			"INDUSTRY": industry_rules
		}
	
	async def validate_document(
		self,
		document_content: str,
		document_type: str = "proposal",
		regulations: Optional[List[str]] = None,
		document_id: Optional[str] = None
	) -> ComplianceReport:
		"""
		Validate document against regulatory requirements
		
		Args:
			document_content: Full document text content
			document_type: Type of document (proposal, contract, etc.)
			regulations: Specific regulations to check (default: all applicable)
			document_id: Unique document identifier
			
		Returns:
			ComplianceReport with validation results
		"""
		start_time = datetime.now()
		
		if document_id is None:
			document_id = uuid7str()
		
		# Determine applicable regulations
		if regulations is None:
			regulations = self._determine_applicable_regulations(document_content, document_type)
		
		# Collect all rules to check
		rules_to_check = []
		for regulation in regulations:
			if regulation in self.regulation_database:
				rules_to_check.extend(self.regulation_database[regulation])
		
		# Run validation checks
		violations = []
		for rule in rules_to_check:
			if rule.active:
				rule_violations = await self._check_rule(document_content, rule, document_type)
				violations.extend(rule_violations)
		
		# Calculate compliance metrics
		total_rules = len(rules_to_check)
		violation_counts = self._count_violations_by_severity(violations)
		compliance_score = self._calculate_compliance_score(total_rules, violation_counts)
		overall_status = self._determine_overall_status(compliance_score, violation_counts)
		
		# Generate recommendations
		recommendations = self._generate_recommendations(violations)
		
		# Calculate processing time
		processing_time = (datetime.now() - start_time).total_seconds() * 1000
		
		return ComplianceReport(
			document_id=document_id,
			document_type=document_type,
			overall_status=overall_status,
			compliance_score=compliance_score,
			total_rules_checked=total_rules,
			violations_found=len(violations),
			critical_violations=violation_counts[ViolationSeverity.CRITICAL],
			high_violations=violation_counts[ViolationSeverity.HIGH],
			medium_violations=violation_counts[ViolationSeverity.MEDIUM],
			low_violations=violation_counts[ViolationSeverity.LOW],
			violations=violations,
			recommendations=recommendations,
			processing_time_ms=processing_time
		)
	
	async def _check_rule(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Check a specific compliance rule against document"""
		violations = []
		
		try:
			# Check pattern-based rules
			if rule.pattern:
				pattern_violations = await self._check_pattern_rule(document_content, rule)
				violations.extend(pattern_violations)
			
			# Check function-based rules
			if rule.validator_function:
				function_violations = await self._check_function_rule(
					document_content, rule, document_type
				)
				violations.extend(function_violations)
				
		except Exception as e:
			# Log error but don't fail entire validation
			print(f"Error checking rule {rule.rule_id}: {str(e)}")
		
		return violations
	
	async def _check_pattern_rule(
		self,
		document_content: str,
		rule: ComplianceRule
	) -> List[ComplianceViolation]:
		"""Check pattern-based compliance rule"""
		violations = []
		
		if not rule.pattern:
			return violations
		
		try:
			# Check if required pattern is present
			pattern = re.compile(rule.pattern, re.IGNORECASE | re.MULTILINE)
			matches = pattern.findall(document_content)
			
			if not matches:
				violation = ComplianceViolation(
					rule_id=rule.rule_id,
					rule_name=rule.name,
					description=f"Required content not found: {rule.description}",
					severity=rule.severity,
					location="document",
					recommendation=f"Add required content matching pattern: {rule.pattern}",
					regulation=rule.regulation,
					section=rule.section,
					metadata={"pattern": rule.pattern, "matches_found": len(matches)}
				)
				violations.append(violation)
				
		except re.error as e:
			print(f"Invalid regex pattern in rule {rule.rule_id}: {str(e)}")
		
		return violations
	
	async def _check_function_rule(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Check function-based compliance rule"""
		violations = []
		
		if not rule.validator_function:
			return violations
		
		# Map function names to actual validation methods
		validator_methods = {
			"validate_proposal_content": self._validate_proposal_content,
			"validate_representations": self._validate_representations,
			"validate_contractor_responsibility": self._validate_contractor_responsibility,
			"validate_subcontracting_plan": self._validate_subcontracting_plan,
			"validate_cybersecurity_requirements": self._validate_cybersecurity_requirements,
			"validate_buy_american": self._validate_buy_american,
			"validate_supply_chain_risk": self._validate_supply_chain_risk,
			"validate_mbe_wbe": self._validate_mbe_wbe,
			"validate_prevailing_wage": self._validate_prevailing_wage,
			"validate_hipaa_compliance": self._validate_hipaa_compliance,
			"validate_sox_compliance": self._validate_sox_compliance
		}
		
		if rule.validator_function in validator_methods:
			try:
				method = validator_methods[rule.validator_function]
				result = await method(document_content, rule, document_type)
				if result:
					violations.extend(result)
			except Exception as e:
				print(f"Error in validator function {rule.validator_function}: {str(e)}")
		
		return violations
	
	async def _validate_proposal_content(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate FAR 15.204-5 proposal content requirements"""
		violations = []
		
		required_sections = [
			("technical approach", r"(?i)(technical\s+approach|methodology|solution)"),
			("past performance", r"(?i)(past\s+performance|experience|previous\s+work|track\s+record)"),
			("cost information", r"(?i)(cost|price|pricing|budget|financial)")
		]
		
		for section_name, pattern in required_sections:
			if not re.search(pattern, document_content):
				violation = ComplianceViolation(
					rule_id=rule.rule_id,
					rule_name=rule.name,
					description=f"Missing required section: {section_name}",
					severity=rule.severity,
					location=f"document - {section_name} section",
					recommendation=f"Add {section_name} section to proposal",
					regulation=rule.regulation,
					section=rule.section,
					metadata={"missing_section": section_name}
				)
				violations.append(violation)
		
		return violations
	
	async def _validate_representations(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate FAR 52.204-8 representations and certifications"""
		violations = []
		
		required_certifications = [
			"small business size certification",
			"socioeconomic certifications",
			"tax compliance certification"
		]
		
		cert_pattern = r"(?i)(represent|certif)"
		if not re.search(cert_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing required representations and certifications section",
				severity=rule.severity,
				location="document",
				recommendation="Include required representations and certifications",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_contractor_responsibility(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate FAR 9.104 contractor responsibility standards"""
		violations = []
		
		responsibility_elements = [
			("financial resources", r"(?i)(financial|resource|capital|funding)"),
			("performance record", r"(?i)(performance|track\s+record|experience)"),
			("integrity", r"(?i)(integrity|ethics|compliance|honesty)")
		]
		
		for element_name, pattern in responsibility_elements:
			if not re.search(pattern, document_content):
				violation = ComplianceViolation(
					rule_id=rule.rule_id,
					rule_name=rule.name,
					description=f"Insufficient demonstration of {element_name}",
					severity=ViolationSeverity.MEDIUM,
					location=f"document - {element_name}",
					recommendation=f"Provide evidence of {element_name}",
					regulation=rule.regulation,
					section=rule.section,
					metadata={"missing_element": element_name}
				)
				violations.append(violation)
		
		return violations
	
	async def _validate_subcontracting_plan(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate FAR 52.219-9 small business subcontracting plan"""
		violations = []
		
		subcontract_pattern = r"(?i)(small\s+business|subcontract|WOSB|VOSB|HUBZone)"
		if not re.search(subcontract_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing small business subcontracting plan or commitment",
				severity=rule.severity,
				location="document",
				recommendation="Include small business subcontracting plan with specific goals and procedures",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_cybersecurity_requirements(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate DFARS 252.204-7012 cybersecurity requirements"""
		violations = []
		
		cyber_keywords = r"(?i)(NIST\s+SP\s+800-171|cybersecurity|information\s+security|CUI|controlled\s+unclassified)"
		if not re.search(cyber_keywords, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing cybersecurity requirements compliance statement",
				severity=rule.severity,
				location="document",
				recommendation="Include compliance with NIST SP 800-171 and cybersecurity requirements",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_buy_american(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate DFARS 252.225-7001 Buy American Act requirements"""
		violations = []
		
		buy_american_pattern = r"(?i)(buy\s+american|domestic|U\.?S\.?\s+made|country\s+of\s+origin)"
		if not re.search(buy_american_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing Buy American Act compliance information",
				severity=rule.severity,
				location="document",
				recommendation="Include information about domestic content and Buy American Act compliance",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_supply_chain_risk(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate DFARS 252.239-7018 supply chain risk assessment"""
		violations = []
		
		supply_chain_pattern = r"(?i)(supply\s+chain|risk\s+assessment|vendor\s+risk|third.party\s+risk)"
		if not re.search(supply_chain_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing supply chain risk assessment",
				severity=rule.severity,
				location="document",
				recommendation="Include supply chain risk assessment and mitigation measures",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_mbe_wbe(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate minority and women-owned business enterprise requirements"""
		violations = []
		
		mbe_pattern = r"(?i)(MBE|WBE|minority|women.owned|disadvantaged\s+business|DBE)"
		if not re.search(mbe_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing minority/women-owned business participation plan",
				severity=rule.severity,
				location="document",
				recommendation="Include MBE/WBE participation goals and implementation plan",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_prevailing_wage(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate prevailing wage requirements"""
		violations = []
		
		wage_pattern = r"(?i)(prevailing\s+wage|davis.bacon|wage\s+determination|labor\s+standards)"
		if not re.search(wage_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing prevailing wage compliance information",
				severity=rule.severity,
				location="document",
				recommendation="Include prevailing wage compliance plan and wage determinations",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_hipaa_compliance(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate HIPAA compliance requirements"""
		violations = []
		
		hipaa_pattern = r"(?i)(HIPAA|PHI|protected\s+health|healthcare\s+data|medical\s+information)"
		if not re.search(hipaa_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing HIPAA compliance measures",
				severity=rule.severity,
				location="document",
				recommendation="Include HIPAA compliance plan and PHI protection measures",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_sox_compliance(
		self,
		document_content: str,
		rule: ComplianceRule,
		document_type: str
	) -> List[ComplianceViolation]:
		"""Validate Sarbanes-Oxley compliance requirements"""
		violations = []
		
		sox_pattern = r"(?i)(sarbanes.oxley|SOX|internal\s+controls|financial\s+controls|audit\s+controls)"
		if not re.search(sox_pattern, document_content):
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.name,
				description="Missing Sarbanes-Oxley compliance information",
				severity=rule.severity,
				location="document",
				recommendation="Include SOX compliance measures and internal control descriptions",
				regulation=rule.regulation,
				section=rule.section
			)
			violations.append(violation)
		
		return violations
	
	def _determine_applicable_regulations(
		self,
		document_content: str,
		document_type: str
	) -> List[str]:
		"""Determine which regulations apply based on document content and type"""
		applicable_regulations = []
		
		# Always check FAR for government proposals
		if document_type in ["proposal", "rfp_response", "government_contract"]:
			applicable_regulations.append("FAR")
		
		# Check for defense-related content
		defense_keywords = r"(?i)(defense|DoD|military|DFARS|security\s+clearance)"
		if re.search(defense_keywords, document_content):
			applicable_regulations.append("DFARS")
		
		# Check for healthcare content  
		healthcare_keywords = r"(?i)(healthcare|medical|hospital|HIPAA|PHI)"
		if re.search(healthcare_keywords, document_content):
			applicable_regulations.append("INDUSTRY")
		
		# Check for financial services content
		financial_keywords = r"(?i)(financial|banking|securities|SOX|sarbanes)"
		if re.search(financial_keywords, document_content):
			applicable_regulations.append("INDUSTRY")
		
		# Check for state/local indicators
		state_keywords = r"(?i)(state\s+of|city\s+of|county|municipality|local\s+government)"
		if re.search(state_keywords, document_content):
			applicable_regulations.append("STATE")
		
		# Default to FAR if nothing else matches
		if not applicable_regulations:
			applicable_regulations.append("FAR")
		
		return applicable_regulations
	
	def _count_violations_by_severity(
		self,
		violations: List[ComplianceViolation]
	) -> Dict[ViolationSeverity, int]:
		"""Count violations by severity level"""
		counts = {severity: 0 for severity in ViolationSeverity}
		
		for violation in violations:
			counts[violation.severity] += 1
		
		return counts
	
	def _calculate_compliance_score(
		self,
		total_rules: int,
		violation_counts: Dict[ViolationSeverity, int]
	) -> float:
		"""Calculate overall compliance score (0-100)"""
		if total_rules == 0:
			return 100.0
		
		# Weight violations by severity
		severity_weights = {
			ViolationSeverity.CRITICAL: 10,
			ViolationSeverity.HIGH: 5,
			ViolationSeverity.MEDIUM: 2,
			ViolationSeverity.LOW: 1,
			ViolationSeverity.WARNING: 0.5
		}
		
		total_deductions = 0
		for severity, count in violation_counts.items():
			total_deductions += count * severity_weights[severity]
		
		# Calculate score as percentage
		max_possible_deductions = total_rules * severity_weights[ViolationSeverity.CRITICAL]
		if max_possible_deductions == 0:
			return 100.0
		
		score = 100.0 - (total_deductions / max_possible_deductions * 100)
		return max(0.0, min(100.0, score))
	
	def _determine_overall_status(
		self,
		compliance_score: float,
		violation_counts: Dict[ViolationSeverity, int]
	) -> ComplianceStatus:
		"""Determine overall compliance status"""
		
		# Critical violations = non-compliant
		if violation_counts[ViolationSeverity.CRITICAL] > 0:
			return ComplianceStatus.NON_COMPLIANT
		
		# Score-based determination
		if compliance_score >= 90:
			return ComplianceStatus.COMPLIANT
		elif compliance_score >= 70:
			return ComplianceStatus.PARTIAL_COMPLIANT
		else:
			return ComplianceStatus.NON_COMPLIANT
	
	def _generate_recommendations(
		self,
		violations: List[ComplianceViolation]
	) -> List[str]:
		"""Generate actionable recommendations based on violations"""
		recommendations = []
		
		# Group violations by regulation
		regulation_violations = {}
		for violation in violations:
			reg = violation.regulation
			if reg not in regulation_violations:
				regulation_violations[reg] = []
			regulation_violations[reg].append(violation)
		
		# Generate regulation-specific recommendations
		for regulation, reg_violations in regulation_violations.items():
			if regulation == "FAR":
				recommendations.append(
					"Review Federal Acquisition Regulation requirements and ensure all mandatory "
					"proposal elements are included and properly documented."
				)
			elif regulation == "DFARS":
				recommendations.append(
					"Ensure compliance with Defense Federal Acquisition Regulation Supplement "
					"requirements, particularly cybersecurity and supply chain risk measures."
				)
			elif regulation == "STATE":
				recommendations.append(
					"Review state and local procurement requirements including minority business "
					"participation and prevailing wage compliance."
				)
			elif regulation == "INDUSTRY":
				recommendations.append(
					"Ensure industry-specific compliance requirements are addressed, including "
					"data protection and regulatory standards."
				)
		
		# Add priority-based recommendations
		critical_violations = [v for v in violations if v.severity == ViolationSeverity.CRITICAL]
		if critical_violations:
			recommendations.insert(0,
				f"Address {len(critical_violations)} critical compliance violations immediately "
				"as these may result in proposal rejection or legal issues."
			)
		
		return recommendations
	
	async def add_custom_rule(self, rule: ComplianceRule, regulation: str) -> None:
		"""Add a custom compliance rule to the validator"""
		if regulation not in self.regulation_database:
			self.regulation_database[regulation] = []
		
		self.regulation_database[regulation].append(rule)
	
	async def remove_rule(self, rule_id: str) -> bool:
		"""Remove a compliance rule by ID"""
		for regulation, rules in self.regulation_database.items():
			for i, rule in enumerate(rules):
				if rule.rule_id == rule_id:
					del rules[i]
					return True
		return False
	
	async def get_applicable_rules(
		self,
		document_content: str,
		document_type: str
	) -> List[ComplianceRule]:
		"""Get list of applicable rules for a document"""
		regulations = self._determine_applicable_regulations(document_content, document_type)
		
		applicable_rules = []
		for regulation in regulations:
			if regulation in self.regulation_database:
				applicable_rules.extend(self.regulation_database[regulation])
		
		return applicable_rules
	
	async def export_regulations_database(self) -> str:
		"""Export regulations database as JSON"""
		exportable_db = {}
		
		for regulation, rules in self.regulation_database.items():
			exportable_db[regulation] = []
			for rule in rules:
				rule_dict = {
					"rule_id": rule.rule_id,
					"name": rule.name,
					"description": rule.description,
					"regulation": rule.regulation,
					"section": rule.section,
					"severity": rule.severity.value,
					"pattern": rule.pattern,
					"validator_function": rule.validator_function,
					"active": rule.active,
					"exemptions": rule.exemptions,
					"metadata": rule.metadata
				}
				exportable_db[regulation].append(rule_dict)
		
		return json.dumps(exportable_db, indent=2)