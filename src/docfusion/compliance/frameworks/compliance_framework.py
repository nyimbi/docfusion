"""
Compliance Framework Module

Provides framework definition and management for various compliance domains including:
- Framework hierarchy and inheritance
- Multi-jurisdiction support
- Rule versioning and updates
- Custom framework creation
- Framework comparison and mapping
"""

from typing import Any, Dict, List, Optional, Set, Union
from dataclasses import dataclass, field
from enum import Enum
import json
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict, validator
import asyncio
from ...core.utils import uuid7str

class FrameworkType(Enum):
	"""Types of compliance frameworks"""
	REGULATORY = "regulatory"
	INDUSTRY = "industry"
	ORGANIZATIONAL = "organizational"
	INTERNATIONAL = "international"
	CUSTOM = "custom"

class FrameworkStatus(Enum):
	"""Framework status enumeration"""
	ACTIVE = "active"
	DRAFT = "draft"
	DEPRECATED = "deprecated"
	ARCHIVED = "archived"

class JurisdictionLevel(Enum):
	"""Jurisdiction levels for compliance frameworks"""
	FEDERAL = "federal"
	STATE = "state"
	LOCAL = "local"
	INTERNATIONAL = "international"
	INDUSTRY = "industry"
	ORGANIZATIONAL = "organizational"

@dataclass
class FrameworkVersion:
	"""Represents a framework version"""
	version_id: str = field(default_factory=uuid7str)
	version_number: str = "1.0"
	effective_date: date = field(default_factory=date.today)
	expiration_date: Optional[date] = None
	description: str = ""
	changes: List[str] = field(default_factory=list)
	created_date: datetime = field(default_factory=datetime.now)
	created_by: str = ""
	status: FrameworkStatus = FrameworkStatus.DRAFT
	metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class FrameworkRule:
	"""Individual rule within a compliance framework"""
	rule_id: str = field(default_factory=uuid7str)
	rule_code: str = ""
	title: str = ""
	description: str = ""
	section: str = ""
	subsection: str = ""
	severity: str = "medium"  # critical, high, medium, low
	mandatory: bool = True
	category: str = ""
	keywords: List[str] = field(default_factory=list)
	related_rules: List[str] = field(default_factory=list)
	validation_criteria: Dict[str, Any] = field(default_factory=dict)
	exemptions: List[str] = field(default_factory=list)
	penalties: Dict[str, str] = field(default_factory=dict)
	references: List[str] = field(default_factory=list)
	effective_date: Optional[date] = None
	last_updated: datetime = field(default_factory=datetime.now)
	metadata: Dict[str, Any] = field(default_factory=dict)

class ComplianceFramework(BaseModel):
	"""
	Comprehensive compliance framework definition and management.
	
	Manages compliance frameworks including regulatory, industry, and organizational
	standards with support for versioning, jurisdiction handling, and rule management.
	"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	framework_id: str = Field(default_factory=uuid7str)
	name: str
	code: str  # Short identifier (e.g., "FAR", "HIPAA", "SOX")
	description: str = ""
	framework_type: FrameworkType
	jurisdiction: JurisdictionLevel
	jurisdiction_details: Dict[str, str] = Field(default_factory=dict)
	authority: str = ""  # Issuing authority
	website: str = ""
	contact_info: Dict[str, str] = Field(default_factory=dict)
	
	# Framework structure
	version: FrameworkVersion = Field(default_factory=FrameworkVersion)
	parent_framework: Optional[str] = None
	child_frameworks: List[str] = Field(default_factory=list)
	related_frameworks: List[str] = Field(default_factory=list)
	
	# Rules and requirements
	rules: List[FrameworkRule] = Field(default_factory=list)
	categories: Dict[str, str] = Field(default_factory=dict)
	sections: Dict[str, str] = Field(default_factory=dict)
	
	# Applicability
	applicable_industries: List[str] = Field(default_factory=list)
	applicable_entity_types: List[str] = Field(default_factory=list)
	applicable_document_types: List[str] = Field(default_factory=list)
	exclusions: List[str] = Field(default_factory=list)
	
	# Management
	created_date: datetime = Field(default_factory=datetime.now)
	created_by: str = ""
	last_updated: datetime = Field(default_factory=datetime.now)
	updated_by: str = ""
	status: FrameworkStatus = FrameworkStatus.DRAFT
	
	# Extensions
	custom_fields: Dict[str, Any] = Field(default_factory=dict)
	metadata: Dict[str, Any] = Field(default_factory=dict)
	
	def __init__(self, **data):
		super().__init__(**data)
		self._initialize_default_frameworks()
	
	def _initialize_default_frameworks(self) -> None:
		"""Initialize with default compliance frameworks if this is a new instance"""
		if not self.rules and self.name == "default":
			# This method would be called by a factory to create default frameworks
			pass
	
	@classmethod
	def create_far_framework(cls) -> "ComplianceFramework":
		"""Create Federal Acquisition Regulation (FAR) framework"""
		
		far_rules = [
			FrameworkRule(
				rule_code="FAR 15.204-5",
				title="Proposal Content Requirements",
				description="Proposals must contain technical approach, past performance, and cost/price information",
				section="Part 15",
				subsection="15.204-5",
				severity="high",
				mandatory=True,
				category="proposal_content",
				keywords=["technical approach", "past performance", "cost", "price"],
				validation_criteria={
					"required_sections": ["technical_approach", "past_performance", "cost_information"],
					"content_validation": "text_analysis"
				}
			),
			FrameworkRule(
				rule_code="FAR 52.204-8",
				title="Annual Representations and Certifications",
				description="Contractor must provide required representations and certifications",
				section="Part 52",
				subsection="52.204-8",
				severity="critical",
				mandatory=True,
				category="certifications",
				keywords=["representations", "certifications"],
				validation_criteria={
					"required_certifications": ["small_business", "socioeconomic", "tax_compliance"],
					"validation_method": "checklist"
				}
			),
			FrameworkRule(
				rule_code="FAR 9.104",
				title="Standards for Contractor Responsibility",
				description="Contractor must demonstrate financial resources, performance record, and integrity",
				section="Part 9",
				subsection="9.104",
				severity="high",
				mandatory=True,
				category="responsibility",
				keywords=["financial resources", "performance record", "integrity"],
				validation_criteria={
					"demonstration_areas": ["financial", "performance", "integrity"],
					"evidence_required": True
				}
			)
		]
		
		return cls(
			name="Federal Acquisition Regulation",
			code="FAR",
			description="The Federal Acquisition Regulation (FAR) governs the acquisition process by which the U.S. federal government purchases goods and services.",
			framework_type=FrameworkType.REGULATORY,
			jurisdiction=JurisdictionLevel.FEDERAL,
			jurisdiction_details={"country": "United States", "level": "Federal Government"},
			authority="General Services Administration (GSA)",
			website="https://www.acquisition.gov/",
			rules=far_rules,
			categories={
				"proposal_content": "Proposal Content and Structure",
				"certifications": "Required Certifications and Representations",
				"responsibility": "Contractor Responsibility Standards"
			},
			sections={
				"Part 9": "Contractor Qualifications",
				"Part 15": "Contracting by Negotiation",
				"Part 52": "Solicitation Provisions and Contract Clauses"
			},
			applicable_industries=["government_contracting", "federal_procurement"],
			applicable_entity_types=["contractor", "subcontractor", "vendor"],
			applicable_document_types=["proposal", "rfp_response", "contract"]
		)
	
	@classmethod
	def create_dfars_framework(cls) -> "ComplianceFramework":
		"""Create Defense Federal Acquisition Regulation Supplement (DFARS) framework"""
		
		dfars_rules = [
			FrameworkRule(
				rule_code="DFARS 252.204-7012",
				title="Cybersecurity Requirements",
				description="Contractor must implement adequate security to protect covered defense information",
				section="Part 252",
				subsection="252.204-7012",
				severity="critical",
				mandatory=True,
				category="cybersecurity",
				keywords=["cybersecurity", "NIST SP 800-171", "covered defense information"],
				validation_criteria={
					"security_standards": ["NIST_SP_800_171"],
					"coverage": "covered_defense_information",
					"implementation_required": True
				}
			),
			FrameworkRule(
				rule_code="DFARS 252.225-7001",
				title="Buy American Act and Balance of Payments",
				description="Contractor must comply with Buy American Act requirements",
				section="Part 252",
				subsection="252.225-7001",
				severity="high",
				mandatory=True,
				category="buy_american",
				keywords=["buy american", "domestic", "foreign", "end product"],
				validation_criteria={
					"origin_tracking": "required",
					"domestic_content": "percentage_based",
					"exceptions": "limited"
				}
			)
		]
		
		return cls(
			name="Defense Federal Acquisition Regulation Supplement",
			code="DFARS",
			description="The DFARS supplements the Federal Acquisition Regulation (FAR) with Defense Department-specific acquisition policies and procedures.",
			framework_type=FrameworkType.REGULATORY,
			jurisdiction=JurisdictionLevel.FEDERAL,
			jurisdiction_details={"country": "United States", "department": "Department of Defense"},
			authority="Department of Defense",
			website="https://www.acq.osd.mil/dpap/dars/",
			parent_framework="FAR",
			rules=dfars_rules,
			categories={
				"cybersecurity": "Cybersecurity and Information Security",
				"buy_american": "Buy American Act Compliance"
			},
			applicable_industries=["defense_contracting", "aerospace", "security_services"],
			applicable_entity_types=["defense_contractor", "subcontractor"],
			applicable_document_types=["proposal", "rfp_response", "defense_contract"]
		)
	
	@classmethod
	def create_hipaa_framework(cls) -> "ComplianceFramework":
		"""Create HIPAA compliance framework"""
		
		hipaa_rules = [
			FrameworkRule(
				rule_code="HIPAA 164.306",
				title="Security Standards for Protection of PHI",
				description="Covered entities must implement administrative, physical, and technical safeguards",
				section="164",
				subsection="164.306",
				severity="critical",
				mandatory=True,
				category="data_protection",
				keywords=["PHI", "protected health information", "safeguards"],
				validation_criteria={
					"safeguard_types": ["administrative", "physical", "technical"],
					"coverage": "all_phi",
					"implementation_guide": "required"
				}
			),
			FrameworkRule(
				rule_code="HIPAA 164.502",
				title="Uses and Disclosures of PHI",
				description="General rules for uses and disclosures of protected health information",
				section="164",
				subsection="164.502",
				severity="critical",
				mandatory=True,
				category="privacy",
				keywords=["uses", "disclosures", "authorization"],
				validation_criteria={
					"authorization_required": "most_uses",
					"minimum_necessary": "standard",
					"permitted_disclosures": "enumerated"
				}
			)
		]
		
		return cls(
			name="Health Insurance Portability and Accountability Act",
			code="HIPAA",
			description="HIPAA establishes national standards for the protection of certain health information.",
			framework_type=FrameworkType.REGULATORY,
			jurisdiction=JurisdictionLevel.FEDERAL,
			jurisdiction_details={"country": "United States", "sector": "Healthcare"},
			authority="Department of Health and Human Services (HHS)",
			website="https://www.hhs.gov/hipaa/",
			rules=hipaa_rules,
			categories={
				"data_protection": "Data Protection and Security",
				"privacy": "Privacy Rules and Requirements"
			},
			applicable_industries=["healthcare", "health_insurance", "healthcare_it"],
			applicable_entity_types=["covered_entity", "business_associate"],
			applicable_document_types=["privacy_policy", "security_policy", "baa", "contract"]
		)
	
	def add_rule(self, rule: FrameworkRule) -> None:
		"""Add a rule to the framework"""
		self.rules.append(rule)
		self.last_updated = datetime.now()
	
	def remove_rule(self, rule_id: str) -> bool:
		"""Remove a rule from the framework"""
		for i, rule in enumerate(self.rules):
			if rule.rule_id == rule_id:
				del self.rules[i]
				self.last_updated = datetime.now()
				return True
		return False
	
	def get_rule(self, rule_id: str) -> Optional[FrameworkRule]:
		"""Get a rule by ID"""
		for rule in self.rules:
			if rule.rule_id == rule_id:
				return rule
		return None
	
	def get_rules_by_category(self, category: str) -> List[FrameworkRule]:
		"""Get all rules in a specific category"""
		return [rule for rule in self.rules if rule.category == category]
	
	def get_rules_by_severity(self, severity: str) -> List[FrameworkRule]:
		"""Get all rules with a specific severity level"""
		return [rule for rule in self.rules if rule.severity == severity]
	
	def get_mandatory_rules(self) -> List[FrameworkRule]:
		"""Get all mandatory rules"""
		return [rule for rule in self.rules if rule.mandatory]
	
	def search_rules(self, query: str) -> List[FrameworkRule]:
		"""Search rules by title, description, or keywords"""
		query_lower = query.lower()
		matching_rules = []
		
		for rule in self.rules:
			if (query_lower in rule.title.lower() or
				query_lower in rule.description.lower() or
				any(query_lower in keyword.lower() for keyword in rule.keywords)):
				matching_rules.append(rule)
		
		return matching_rules
	
	def get_applicable_rules(
		self,
		document_type: str,
		industry: Optional[str] = None,
		entity_type: Optional[str] = None
	) -> List[FrameworkRule]:
		"""Get rules applicable to specific context"""
		if document_type not in self.applicable_document_types:
			return []
		
		if industry and industry not in self.applicable_industries:
			return []
		
		if entity_type and entity_type not in self.applicable_entity_types:
			return []
		
		# For now, return all rules - could be filtered further based on additional criteria
		return self.rules
	
	def create_new_version(
		self,
		version_number: str,
		description: str = "",
		changes: Optional[List[str]] = None
	) -> None:
		"""Create a new version of the framework"""
		if changes is None:
			changes = []
		
		new_version = FrameworkVersion(
			version_number=version_number,
			description=description,
			changes=changes,
			created_by=self.updated_by,
			status=FrameworkStatus.DRAFT
		)
		
		# Archive current version
		self.version.status = FrameworkStatus.ARCHIVED
		
		# Set new version
		self.version = new_version
		self.last_updated = datetime.now()
	
	def activate_framework(self) -> None:
		"""Activate the framework"""
		self.status = FrameworkStatus.ACTIVE
		self.version.status = FrameworkStatus.ACTIVE
		self.last_updated = datetime.now()
	
	def deprecate_framework(self, replacement_framework: Optional[str] = None) -> None:
		"""Deprecate the framework"""
		self.status = FrameworkStatus.DEPRECATED
		if replacement_framework:
			self.metadata["replacement_framework"] = replacement_framework
		self.last_updated = datetime.now()
	
	def inherit_from_parent(self, parent_framework: "ComplianceFramework") -> None:
		"""Inherit rules and structure from parent framework"""
		self.parent_framework = parent_framework.framework_id
		
		# Inherit applicable categories if not already set
		for category_key, category_name in parent_framework.categories.items():
			if category_key not in self.categories:
				self.categories[category_key] = category_name
		
		# Inherit applicable industries, entity types, and document types
		for industry in parent_framework.applicable_industries:
			if industry not in self.applicable_industries:
				self.applicable_industries.append(industry)
		
		for entity_type in parent_framework.applicable_entity_types:
			if entity_type not in self.applicable_entity_types:
				self.applicable_entity_types.append(entity_type)
		
		for doc_type in parent_framework.applicable_document_types:
			if doc_type not in self.applicable_document_types:
				self.applicable_document_types.append(doc_type)
		
		# Inherit rules (could be selective)
		inherited_rules = []
		for rule in parent_framework.rules:
			# Create a copy of the rule with reference to parent
			inherited_rule = FrameworkRule(
				rule_code=rule.rule_code,
				title=f"[Inherited] {rule.title}",
				description=rule.description,
				section=rule.section,
				subsection=rule.subsection,
				severity=rule.severity,
				mandatory=rule.mandatory,
				category=rule.category,
				keywords=rule.keywords.copy(),
				validation_criteria=rule.validation_criteria.copy(),
				metadata={**rule.metadata, "inherited_from": parent_framework.framework_id}
			)
			inherited_rules.append(inherited_rule)
		
		self.rules.extend(inherited_rules)
		self.last_updated = datetime.now()
	
	def compare_with_framework(self, other_framework: "ComplianceFramework") -> Dict[str, Any]:
		"""Compare this framework with another framework"""
		comparison = {
			"framework_1": {
				"id": self.framework_id,
				"name": self.name,
				"code": self.code,
				"rule_count": len(self.rules)
			},
			"framework_2": {
				"id": other_framework.framework_id,
				"name": other_framework.name,
				"code": other_framework.code,
				"rule_count": len(other_framework.rules)
			},
			"common_rules": [],
			"unique_to_framework_1": [],
			"unique_to_framework_2": [],
			"rule_differences": [],
			"category_overlap": [],
			"jurisdiction_compatibility": self.jurisdiction == other_framework.jurisdiction
		}
		
		# Compare rules by code and title
		self_rule_codes = {rule.rule_code for rule in self.rules}
		other_rule_codes = {rule.rule_code for rule in other_framework.rules}
		
		common_codes = self_rule_codes.intersection(other_rule_codes)
		comparison["common_rules"] = list(common_codes)
		comparison["unique_to_framework_1"] = list(self_rule_codes - common_codes)
		comparison["unique_to_framework_2"] = list(other_rule_codes - common_codes)
		
		# Compare categories
		self_categories = set(self.categories.keys())
		other_categories = set(other_framework.categories.keys())
		comparison["category_overlap"] = list(self_categories.intersection(other_categories))
		
		return comparison
	
	def generate_compliance_checklist(
		self,
		document_type: str,
		include_optional: bool = False
	) -> List[Dict[str, Any]]:
		"""Generate a compliance checklist for a specific document type"""
		applicable_rules = self.get_applicable_rules(document_type)
		
		if not include_optional:
			applicable_rules = [rule for rule in applicable_rules if rule.mandatory]
		
		checklist = []
		for rule in applicable_rules:
			checklist_item = {
				"rule_code": rule.rule_code,
				"title": rule.title,
				"description": rule.description,
				"category": rule.category,
				"severity": rule.severity,
				"mandatory": rule.mandatory,
				"validation_criteria": rule.validation_criteria,
				"checked": False,
				"notes": "",
				"evidence": []
			}
			checklist.append(checklist_item)
		
		return sorted(checklist, key=lambda x: (x["severity"], x["category"]))
	
	def export_framework(self, format: str = "json") -> str:
		"""Export framework definition"""
		export_data = {
			"framework_id": self.framework_id,
			"name": self.name,
			"code": self.code,
			"description": self.description,
			"framework_type": self.framework_type.value,
			"jurisdiction": self.jurisdiction.value,
			"jurisdiction_details": self.jurisdiction_details,
			"authority": self.authority,
			"website": self.website,
			"version": {
				"version_number": self.version.version_number,
				"effective_date": self.version.effective_date.isoformat(),
				"description": self.version.description,
				"status": self.version.status.value
			},
			"parent_framework": self.parent_framework,
			"child_frameworks": self.child_frameworks,
			"rules": [],
			"categories": self.categories,
			"sections": self.sections,
			"applicable_industries": self.applicable_industries,
			"applicable_entity_types": self.applicable_entity_types,
			"applicable_document_types": self.applicable_document_types,
			"status": self.status.value,
			"created_date": self.created_date.isoformat(),
			"last_updated": self.last_updated.isoformat()
		}
		
		# Export rules
		for rule in self.rules:
			rule_data = {
				"rule_id": rule.rule_id,
				"rule_code": rule.rule_code,
				"title": rule.title,
				"description": rule.description,
				"section": rule.section,
				"subsection": rule.subsection,
				"severity": rule.severity,
				"mandatory": rule.mandatory,
				"category": rule.category,
				"keywords": rule.keywords,
				"validation_criteria": rule.validation_criteria,
				"exemptions": rule.exemptions,
				"references": rule.references,
				"effective_date": rule.effective_date.isoformat() if rule.effective_date else None,
				"last_updated": rule.last_updated.isoformat(),
				"metadata": rule.metadata
			}
			export_data["rules"].append(rule_data)
		
		if format.lower() == "json":
			return json.dumps(export_data, indent=2, default=str)
		else:
			raise ValueError(f"Unsupported export format: {format}")
	
	@classmethod
	def import_framework(cls, data: str, format: str = "json") -> "ComplianceFramework":
		"""Import framework from exported data"""
		if format.lower() != "json":
			raise ValueError(f"Unsupported import format: {format}")
		
		framework_data = json.loads(data)
		
		# Create version
		version_data = framework_data.get("version", {})
		version = FrameworkVersion(
			version_number=version_data.get("version_number", "1.0"),
			effective_date=datetime.fromisoformat(version_data.get("effective_date", date.today().isoformat())).date(),
			description=version_data.get("description", ""),
			status=FrameworkStatus(version_data.get("status", "draft"))
		)
		
		# Create rules
		rules = []
		for rule_data in framework_data.get("rules", []):
			rule = FrameworkRule(
				rule_id=rule_data.get("rule_id", uuid7str()),
				rule_code=rule_data.get("rule_code", ""),
				title=rule_data.get("title", ""),
				description=rule_data.get("description", ""),
				section=rule_data.get("section", ""),
				subsection=rule_data.get("subsection", ""),
				severity=rule_data.get("severity", "medium"),
				mandatory=rule_data.get("mandatory", True),
				category=rule_data.get("category", ""),
				keywords=rule_data.get("keywords", []),
				validation_criteria=rule_data.get("validation_criteria", {}),
				exemptions=rule_data.get("exemptions", []),
				references=rule_data.get("references", []),
				effective_date=datetime.fromisoformat(rule_data["effective_date"]).date() if rule_data.get("effective_date") else None,
				metadata=rule_data.get("metadata", {})
			)
			rules.append(rule)
		
		# Create framework
		framework = cls(
			framework_id=framework_data.get("framework_id", uuid7str()),
			name=framework_data["name"],
			code=framework_data["code"],
			description=framework_data.get("description", ""),
			framework_type=FrameworkType(framework_data["framework_type"]),
			jurisdiction=JurisdictionLevel(framework_data["jurisdiction"]),
			jurisdiction_details=framework_data.get("jurisdiction_details", {}),
			authority=framework_data.get("authority", ""),
			website=framework_data.get("website", ""),
			version=version,
			parent_framework=framework_data.get("parent_framework"),
			child_frameworks=framework_data.get("child_frameworks", []),
			rules=rules,
			categories=framework_data.get("categories", {}),
			sections=framework_data.get("sections", {}),
			applicable_industries=framework_data.get("applicable_industries", []),
			applicable_entity_types=framework_data.get("applicable_entity_types", []),
			applicable_document_types=framework_data.get("applicable_document_types", []),
			status=FrameworkStatus(framework_data.get("status", "draft")),
			created_date=datetime.fromisoformat(framework_data.get("created_date", datetime.now().isoformat())),
			last_updated=datetime.fromisoformat(framework_data.get("last_updated", datetime.now().isoformat()))
		)
		
		return framework
	
	def get_framework_summary(self) -> Dict[str, Any]:
		"""Get a summary of the framework"""
		return {
			"framework_id": self.framework_id,
			"name": self.name,
			"code": self.code,
			"framework_type": self.framework_type.value,
			"jurisdiction": self.jurisdiction.value,
			"authority": self.authority,
			"version": self.version.version_number,
			"status": self.status.value,
			"rule_count": len(self.rules),
			"mandatory_rules": len([r for r in self.rules if r.mandatory]),
			"categories": list(self.categories.keys()),
			"applicable_industries": self.applicable_industries,
			"last_updated": self.last_updated.isoformat()
		}