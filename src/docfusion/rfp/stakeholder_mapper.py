#!/usr/bin/env python3
"""
Stakeholder Mapper

Advanced stakeholder identification and mapping from RFP documents.
Extracts stakeholder roles, organizations, contact information, and builds
relationship graphs for proposal analysis and visualization.
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# spaCy integration for NER
try:
	import spacy
	from spacy.matcher import Matcher, PhraseMatcher
	from spacy.tokens import Doc, Span

	HAS_SPACY_SUPPORT = True
except ImportError:
	HAS_SPACY_SUPPORT = False

import httpx
import json
from ..core.utils import uuid7str

class StakeholderRole(str, Enum):
	"""Stakeholder roles in RFP processes"""

	# Evaluation roles
	EVALUATOR = "evaluator"
	REVIEWER = "reviewer"
	ASSESSOR = "assessor"
	JUDGE = "judge"
	SCORER = "scorer"
	TECHNICAL_EVALUATOR = "technical_evaluator"
	PRICE_EVALUATOR = "price_evaluator"

	# Decision-making roles
	DECISION_MAKER = "decision_maker"
	APPROVER = "approver"
	AUTHORITY = "authority"
	SIGNATORY = "signatory"
	FINAL_APPROVER = "final_approver"
	CONTRACTING_OFFICER = "contracting_officer"

	# Technical roles
	TECHNICAL_CONTACT = "technical_contact"
	TECHNICAL_LEAD = "technical_lead"
	ENGINEER = "engineer"
	ARCHITECT = "architect"
	SOLUTION_ARCHITECT = "solution_architect"
	SUBJECT_MATTER_EXPERT = "subject_matter_expert"

	# Procurement roles
	PROCUREMENT_OFFICER = "procurement_officer"
	CONTRACT_SPECIALIST = "contract_specialist"
	BUYER = "buyer"
	PROCUREMENT_MANAGER = "procurement_manager"
	SOURCING_SPECIALIST = "sourcing_specialist"

	# Program/Project roles
	PROGRAM_MANAGER = "program_manager"
	PROJECT_MANAGER = "project_manager"
	PM = "pm"
	PROGRAM_OFFICE = "program_office"
	PROJECT_LEAD = "project_lead"

	# Administrative roles
	ADMINISTRATOR = "administrator"
	COORDINATOR = "coordinator"
	LIAISON = "liaison"
	POINT_OF_CONTACT = "point_of_contact"
	PRIMARY_CONTACT = "primary_contact"

	# Executive roles
	EXECUTIVE_SPONSOR = "executive_sponsor"
	SPONSOR = "sponsor"
	STAKEHOLDER = "stakeholder"
	OWNER = "owner"

	# External roles
	VENDOR = "vendor"
	SUPPLIER = "supplier"
	CONTRACTOR = "contractor"
	CONSULTANT = "consultant"
	SUBCONTRACTOR = "subcontractor"

class StakeholderRoleCategory(str, Enum):
	"""Categories for grouping stakeholder roles"""

	EVALUATION = "evaluation"
	DECISION_MAKING = "decision_making"
	TECHNICAL = "technical"
	PROCUREMENT = "procurement"
	PROJECT_MANAGEMENT = "project_management"
	ADMINISTRATIVE = "administrative"
	EXECUTIVE = "executive"
	EXTERNAL = "external"
	UNKNOWN = "unknown"

@dataclass
class Stakeholder:
	"""Represents an identified stakeholder from RFP documents"""

	id: str = field(default_factory=uuid7str)
	name: str = ""
	roles: List[StakeholderRole] = field(default_factory=list)
	organization: Optional[str] = None
	organization_unit: Optional[str] = None
	email: Optional[str] = None
	phone: Optional[str] = None
	title: Optional[str] = None
	department: Optional[str] = None
	location: Optional[str] = None
	confidence: float = 0.0
	context: Optional[str] = None
	source_text: Optional[str] = None
	start_char: int = 0
	end_char: int = 0
	attributes: Dict[str, Any] = field(default_factory=dict)
	relationships: List[str] = field(default_factory=list)  # IDs of related stakeholders
	extraction_method: str = ""
	ai_insights: Dict[str, Any] = field(default_factory=dict)

	def __post_init__(self):
		"""Initialize derived attributes"""
		if not self.id:
			self.id = uuid7str()
		# Ensure roles is a list
		if self.roles is None:
			self.roles = []

	@property
	def primary_role(self) -> Optional[StakeholderRole]:
		"""Get the primary (first) role"""
		return self.roles[0] if self.roles else None

	@property
	def role_category(self) -> StakeholderRoleCategory:
		"""Get the category for the primary role"""
		return get_role_category(self.primary_role)

	def add_role(self, role: StakeholderRole) -> None:
		"""Add a role if not already present"""
		if role not in self.roles:
			self.roles.append(role)

	def to_dict(self) -> Dict[str, Any]:
		"""Convert to dictionary representation"""
		return {
			"id": self.id,
			"name": self.name,
			"roles": [r.value for r in self.roles],
			"primary_role": self.primary_role.value if self.primary_role else None,
			"role_category": self.role_category.value,
			"organization": self.organization,
			"organization_unit": self.organization_unit,
			"email": self.email,
			"phone": self.phone,
			"title": self.title,
			"department": self.department,
			"location": self.location,
			"confidence": self.confidence,
			"context": self.context,
			"source_text": self.source_text,
			"attributes": self.attributes,
			"relationships": self.relationships,
			"extraction_method": self.extraction_method,
		}

@dataclass
class StakeholderRelationship:
	"""Represents a relationship between stakeholders"""

	id: str
	source_id: str
	target_id: str
	relationship_type: str
	confidence: float
	evidence: Optional[str] = None
	context: Optional[str] = None
	attributes: Dict[str, Any] = field(default_factory=dict)

	def __post_init__(self):
		if not self.id:
			self.id = uuid7str()

@dataclass
class StakeholderGraph:
	"""Graph representation of stakeholder relationships"""

	stakeholders: List[Stakeholder] = field(default_factory=list)
	relationships: List[StakeholderRelationship] = field(default_factory=list)
	adjacency: Dict[str, List[str]] = field(default_factory=dict)
	clusters: List[Set[str]] = field(default_factory=list)
	statistics: Dict[str, Any] = field(default_factory=dict)
	visualization_data: Dict[str, Any] = field(default_factory=dict)

	def add_stakeholder(self, stakeholder: Stakeholder) -> None:
		"""Add a stakeholder to the graph"""
		self.stakeholders.append(stakeholder)
		if stakeholder.id not in self.adjacency:
			self.adjacency[stakeholder.id] = []

	def add_relationship(self, relationship: StakeholderRelationship) -> None:
		"""Add a relationship to the graph"""
		self.relationships.append(relationship)
		if relationship.source_id not in self.adjacency:
			self.adjacency[relationship.source_id] = []
		if relationship.target_id not in self.adjacency:
			self.adjacency[relationship.target_id] = []

		if relationship.target_id not in self.adjacency[relationship.source_id]:
			self.adjacency[relationship.source_id].append(relationship.target_id)
		if relationship.source_id not in self.adjacency[relationship.target_id]:
			self.adjacency[relationship.target_id].append(relationship.source_id)

	def get_stakeholder_by_id(self, stakeholder_id: str) -> Optional[Stakeholder]:
		"""Get a stakeholder by ID"""
		for s in self.stakeholders:
			if s.id == stakeholder_id:
				return s
		return None

	def get_stakeholders_by_role(self, role: StakeholderRole) -> List[Stakeholder]:
		"""Get all stakeholders with a specific role"""
		return [s for s in self.stakeholders if role in s.roles]

	def get_stakeholders_by_organization(self, organization: str) -> List[Stakeholder]:
		"""Get all stakeholders from an organization"""
		return [s for s in self.stakeholders if s.organization == organization]

	def get_connected_stakeholders(self, stakeholder_id: str) -> List[Stakeholder]:
		"""Get all stakeholders connected to a given stakeholder"""
		connected_ids = self.adjacency.get(stakeholder_id, [])
		return [self.get_stakeholder_by_id(sid) for sid in connected_ids if self.get_stakeholder_by_id(sid)]

	def to_visualization_dict(self) -> Dict[str, Any]:
		"""Generate visualization-ready data structure"""
		nodes = []
		for stakeholder in self.stakeholders:
			nodes.append({
				"id": stakeholder.id,
				"label": stakeholder.name,
				"type": stakeholder.primary_role.value if stakeholder.primary_role else "unknown",
				"category": stakeholder.role_category.value,
				"organization": stakeholder.organization,
				"confidence": stakeholder.confidence,
				"data": stakeholder.to_dict(),
			})

		edges = []
		for rel in self.relationships:
			edges.append({
				"id": rel.id,
				"source": rel.source_id,
				"target": rel.target_id,
				"type": rel.relationship_type,
				"confidence": rel.confidence,
				"evidence": rel.evidence,
			})

		return {
			"nodes": nodes,
			"edges": edges,
			"metadata": {
				"total_stakeholders": len(self.stakeholders),
				"total_relationships": len(self.relationships),
				"clusters": len(self.clusters),
				"statistics": self.statistics,
			},
		}

class StakeholderExtractionResult:
	"""Result of stakeholder extraction"""

	def __init__(self):
		self.success: bool = False
		self.original_text: str = ""
		self.stakeholders: List[Stakeholder] = []
		self.stakeholder_graph: Optional[StakeholderGraph] = None
		self.organizations: List[Dict[str, Any]] = []
		self.statistics: Dict[str, Any] = {}
		self.errors: List[str] = []
		self.warnings: List[str] = []
		self.processing_time: float = 0.0
		methods_used: List[str] = []
		ai_analysis: Dict[str, Any] = {}

# Role pattern definitions
ROLE_PATTERNS: Dict[StakeholderRole, List[str]] = {
	# Evaluation roles
	StakeholderRole.EVALUATOR: [
		"evaluator", "evaluation team member", "proposal evaluator",
		"technical evaluator", "price evaluator"
	],
	StakeholderRole.REVIEWER: [
		"reviewer", "proposal reviewer", "document reviewer",
		"review panel member", "peer reviewer"
	],
	StakeholderRole.ASSESSOR: [
		"assessor", "assessment team", "capability assessor",
		"risk assessor", "technical assessor"
	],
	StakeholderRole.JUDGE: [
		"judge", "adjudicator", "panel judge",
		"selection panel member", "award panel"
	],
	StakeholderRole.SCORER: [
		"scorer", "scoring team", "evaluation scorer",
		"technical scorer", "price scorer"
	],
	StakeholderRole.TECHNICAL_EVALUATOR: [
		"technical evaluator", "technical assessment team",
		"technical review board", "technical panel"
	],
	StakeholderRole.PRICE_EVALUATOR: [
		"price evaluator", "cost evaluator", "price analysis team",
		"cost analysis team", "pricing team"
	],

	# Decision-making roles
	StakeholderRole.DECISION_MAKER: [
		"decision maker", "decision authority", "final decision authority",
		"selection authority", "award authority"
	],
	StakeholderRole.APPROVER: [
		"approver", "approving authority", "approval authority",
		"approving official", "authorization authority"
	],
	StakeholderRole.AUTHORITY: [
		"authority", "responsible authority", "contracting authority",
		"procurement authority", "approval authority"
	],
	StakeholderRole.SIGNATORY: [
		"signatory", "authorized signatory", "signing authority",
		"authorized official", "contracting officer representative"
	],
	StakeholderRole.FINAL_APPROVER: [
		"final approver", "final approval authority", "final authorization",
		"head of contracting activity", "senior procurement executive"
	],
	StakeholderRole.CONTRACTING_OFFICER: [
		"contracting officer", "co", "contracting officer representative",
		"cor", "government contracting officer"
	],

	# Technical roles
	StakeholderRole.TECHNICAL_CONTACT: [
		"technical contact", "technical point of contact", "technical poc",
		"primary technical contact", "engineering contact"
	],
	StakeholderRole.TECHNICAL_LEAD: [
		"technical lead", "lead engineer", "senior engineer",
		"principal engineer", "chief engineer"
	],
	StakeholderRole.ENGINEER: [
		"engineer", "systems engineer", "software engineer",
		"hardware engineer", "network engineer"
	],
	StakeholderRole.ARCHITECT: [
		"architect", "solution architect", "enterprise architect",
		"systems architect", "technical architect"
	],
	StakeholderRole.SOLUTION_ARCHITECT: [
		"solution architect", "solutions architect", "lead architect",
		"principal architect", "senior architect"
	],
	StakeholderRole.SUBJECT_MATTER_EXPERT: [
		"subject matter expert", "sme", "domain expert",
		"technical expert", "expert advisor"
	],

	# Procurement roles
	StakeholderRole.PROCUREMENT_OFFICER: [
		"procurement officer", "procurement specialist", "purchasing officer",
		"acquisition specialist", "procurement agent"
	],
	StakeholderRole.CONTRACT_SPECIALIST: [
		"contract specialist", "contracts specialist", "acquisition specialist",
		"contract administrator", "contract administrator"
	],
	StakeholderRole.BUYER: [
		"buyer", "purchasing agent", "procurement agent",
		"acquisition agent", "buying agent"
	],
	StakeholderRole.PROCUREMENT_MANAGER: [
		"procurement manager", "acquisition manager", "purchasing manager",
		"contracts manager", "supply chain manager"
	],
	StakeholderRole.SOURCING_SPECIALIST: [
		"sourcing specialist", "strategic sourcing", "sourcing agent",
		"vendor management specialist", "supplier manager"
	],

	# Program/Project roles
	StakeholderRole.PROGRAM_MANAGER: [
		"program manager", "pm", "programme manager", "program director",
		"program lead", "senior program manager"
	],
	StakeholderRole.PROJECT_MANAGER: [
		"project manager", "pm", "project lead", "project director",
		"senior project manager", "project coordinator"
	],
	StakeholderRole.PM: [
		"pm", "program manager", "project manager"
	],
	StakeholderRole.PROGRAM_OFFICE: [
		"program office", "project management office", "pmo",
		"program management office", "project office"
	],
	StakeholderRole.PROJECT_LEAD: [
		"project lead", "lead", "team lead", "project team lead",
		"workstream lead", "task lead"
	],

	# Administrative roles
	StakeholderRole.ADMINISTRATOR: [
		"administrator", "admin", "system administrator",
		"administrative lead", "operations administrator"
	],
	StakeholderRole.COORDINATOR: [
		"coordinator", "project coordinator", "program coordinator",
		"administrative coordinator", "logistics coordinator"
	],
	StakeholderRole.LIAISON: [
		"liaison", "point of contact", "poc", "contact person",
		"interface", "primary interface"
	],
	StakeholderRole.POINT_OF_CONTACT: [
		"point of contact", "poc", "contact", "primary contact",
		"secondary contact", "designated contact"
	],
	StakeholderRole.PRIMARY_CONTACT: [
		"primary contact", "primary poc", "main contact",
		"primary point of contact", "key contact"
	],

	# Executive roles
	StakeholderRole.EXECUTIVE_SPONSOR: [
		"executive sponsor", "exec sponsor", "senior sponsor",
		"executive champion", "senior champion"
	],
	StakeholderRole.SPONSOR: [
		"sponsor", "project sponsor", "program sponsor",
		"funding sponsor", "business sponsor"
	],
	StakeholderRole.STAKEHOLDER: [
		"stakeholder", "key stakeholder", "business stakeholder",
		"technical stakeholder", "interested party"
	],
	StakeholderRole.OWNER: [
		"owner", "product owner", "project owner", "process owner",
		"business owner", "system owner"
	],

	# External roles
	StakeholderRole.VENDOR: [
		"vendor", "supplier", "contractor", "service provider",
		"prime contractor", "offeror"
	],
	StakeholderRole.SUPPLIER: [
		"supplier", "vendor", "provider", "manufacturer",
		"distributor", "subcontractor"
	],
	StakeholderRole.CONTRACTOR: [
		"contractor", "prime contractor", "subcontractor",
		"vendor", "service provider"
	],
	StakeholderRole.CONSULTANT: [
		"consultant", "advisor", "external consultant",
		"technical consultant", "management consultant"
	],
	StakeholderRole.SUBCONTRACTOR: [
		"subcontractor", "sub", "sub-contractor", "team member",
		"teaming partner", "partner contractor"
	],
}

# Role category mapping
ROLE_CATEGORIES: Dict[StakeholderRole, StakeholderRoleCategory] = {
	# Evaluation
	StakeholderRole.EVALUATOR: StakeholderRoleCategory.EVALUATION,
	StakeholderRole.REVIEWER: StakeholderRoleCategory.EVALUATION,
	StakeholderRole.ASSESSOR: StakeholderRoleCategory.EVALUATION,
	StakeholderRole.JUDGE: StakeholderRoleCategory.EVALUATION,
	StakeholderRole.SCORER: StakeholderRoleCategory.EVALUATION,
	StakeholderRole.TECHNICAL_EVALUATOR: StakeholderRoleCategory.EVALUATION,
	StakeholderRole.PRICE_EVALUATOR: StakeholderRoleCategory.EVALUATION,

	# Decision-making
	StakeholderRole.DECISION_MAKER: StakeholderRoleCategory.DECISION_MAKING,
	StakeholderRole.APPROVER: StakeholderRoleCategory.DECISION_MAKING,
	StakeholderRole.AUTHORITY: StakeholderRoleCategory.DECISION_MAKING,
	StakeholderRole.SIGNATORY: StakeholderRoleCategory.DECISION_MAKING,
	StakeholderRole.FINAL_APPROVER: StakeholderRoleCategory.DECISION_MAKING,
	StakeholderRole.CONTRACTING_OFFICER: StakeholderRoleCategory.DECISION_MAKING,

	# Technical
	StakeholderRole.TECHNICAL_CONTACT: StakeholderRoleCategory.TECHNICAL,
	StakeholderRole.TECHNICAL_LEAD: StakeholderRoleCategory.TECHNICAL,
	StakeholderRole.ENGINEER: StakeholderRoleCategory.TECHNICAL,
	StakeholderRole.ARCHITECT: StakeholderRoleCategory.TECHNICAL,
	StakeholderRole.SOLUTION_ARCHITECT: StakeholderRoleCategory.TECHNICAL,
	StakeholderRole.SUBJECT_MATTER_EXPERT: StakeholderRoleCategory.TECHNICAL,

	# Procurement
	StakeholderRole.PROCUREMENT_OFFICER: StakeholderRoleCategory.PROCUREMENT,
	StakeholderRole.CONTRACT_SPECIALIST: StakeholderRoleCategory.PROCUREMENT,
	StakeholderRole.BUYER: StakeholderRoleCategory.PROCUREMENT,
	StakeholderRole.PROCUREMENT_MANAGER: StakeholderRoleCategory.PROCUREMENT,
	StakeholderRole.SOURCING_SPECIALIST: StakeholderRoleCategory.PROCUREMENT,

	# Project management
	StakeholderRole.PROGRAM_MANAGER: StakeholderRoleCategory.PROJECT_MANAGEMENT,
	StakeholderRole.PROJECT_MANAGER: StakeholderRoleCategory.PROJECT_MANAGEMENT,
	StakeholderRole.PM: StakeholderRoleCategory.PROJECT_MANAGEMENT,
	StakeholderRole.PROGRAM_OFFICE: StakeholderRoleCategory.PROJECT_MANAGEMENT,
	StakeholderRole.PROJECT_LEAD: StakeholderRoleCategory.PROJECT_MANAGEMENT,

	# Administrative
	StakeholderRole.ADMINISTRATOR: StakeholderRoleCategory.ADMINISTRATIVE,
	StakeholderRole.COORDINATOR: StakeholderRoleCategory.ADMINISTRATIVE,
	StakeholderRole.LIAISON: StakeholderRoleCategory.ADMINISTRATIVE,
	StakeholderRole.POINT_OF_CONTACT: StakeholderRoleCategory.ADMINISTRATIVE,
	StakeholderRole.PRIMARY_CONTACT: StakeholderRoleCategory.ADMINISTRATIVE,

	# Executive
	StakeholderRole.EXECUTIVE_SPONSOR: StakeholderRoleCategory.EXECUTIVE,
	StakeholderRole.SPONSOR: StakeholderRoleCategory.EXECUTIVE,
	StakeholderRole.STAKEHOLDER: StakeholderRoleCategory.EXECUTIVE,
	StakeholderRole.OWNER: StakeholderRoleCategory.EXECUTIVE,

	# External
	StakeholderRole.VENDOR: StakeholderRoleCategory.EXTERNAL,
	StakeholderRole.SUPPLIER: StakeholderRoleCategory.EXTERNAL,
	StakeholderRole.CONTRACTOR: StakeholderRoleCategory.EXTERNAL,
	StakeholderRole.CONSULTANT: StakeholderRoleCategory.EXTERNAL,
	StakeholderRole.SUBCONTRACTOR: StakeholderRoleCategory.EXTERNAL,
}

# Organization patterns
ORGANIZATION_PATTERNS = [
	r"([A-Z][a-zA-Z\s]+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Company|Co\.?|GmbH|AG|SA|PLC))",
	r"([A-Z]{2,5})\s+(?:Agency|Department|Office|Bureau|Division|Service|Administration)",
	r"(?:Department|Dept\.?)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+)",
	r"(?:Agency|Administration|Authority|Commission|Service)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+)",
	r"([A-Z][a-zA-Z\s]+)\s+(?:Government|Federal|State|County|City|Town)",
	r"(?:U\.?S\.?\s+)?(?:Department|Agency|Administration)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+)",
]

# Contact extraction patterns
CONTACT_PATTERNS = {
	"email": r"[\w\.\-]+@[\w\.\-]+\.\w+",
	"phone": r"(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}",
	"phone_intl": r"\+?[1-9]\d{1,14}",
}

def get_role_category(role: Optional[StakeholderRole]) -> StakeholderRoleCategory:
	"""Get the category for a stakeholder role"""
	if role is None:
		return StakeholderRoleCategory.UNKNOWN
	return ROLE_CATEGORIES.get(role, StakeholderRoleCategory.UNKNOWN)

class StakeholderMapper:
	"""Maps stakeholder roles from RFP documents"""

	def __init__(self, config: Optional[Dict[str, Any]] = None):
		default_config = self._get_default_config()
		if config:
			# Merge provided config with defaults
			self.config = {**default_config, **config}
		else:
			self.config = default_config
		self.logger = logging.getLogger(__name__)

		# spaCy components
		self.nlp_model = None
		self.matcher = None
		self.phrase_matcher = None

		# Initialize Ollama client
		self.ollama_client = httpx.AsyncClient(
			base_url=self.config["ollama_base_url"],
			timeout=self.config["ollama_timeout"],
		)

		# Load patterns and initialize components
		self._load_role_patterns()
		self._initialize_nlp_components()
		self._compile_patterns()

		self.logger.info("Stakeholder mapper initialized")

	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			# Model settings
			"spacy_model": "en_core_web_sm",
			"use_spacy_ner": HAS_SPACY_SUPPORT,
			"use_custom_patterns": True,
			"use_ai_enhancement": True,
			# Ollama settings
			"ollama_base_url": "http://localhost:11434",
			"ollama_model": "llama3.2:3b",
			"ollama_timeout": 120.0,
			# Extraction options
			"extract_contact_info": True,
			"extract_organizations": True,
			"extract_relationships": True,
			"build_stakeholder_graph": True,
			"normalize_organizations": True,
			"min_confidence_threshold": 0.3,
			# Processing options
			"context_window": 100,
			"max_text_length": 500000,
			"ai_chunk_size": 3000,
			# Role detection settings
			"role_priority": [
				StakeholderRole.CONTRACTING_OFFICER,
				StakeholderRole.PROGRAM_MANAGER,
				StakeholderRole.TECHNICAL_CONTACT,
				StakeholderRole.PROCUREMENT_OFFICER,
				StakeholderRole.DECISION_MAKER,
			],
		}

	def _load_role_patterns(self):
		"""Load role detection patterns"""
		self.role_patterns = ROLE_PATTERNS
		self.role_categories = ROLE_CATEGORIES
		self.organization_patterns = ORGANIZATION_PATTERNS
		self.contact_patterns = CONTACT_PATTERNS

		# Build reverse lookup for quick role detection
		self._role_keyword_map: Dict[str, StakeholderRole] = {}
		for role, keywords in self.role_patterns.items():
			for keyword in keywords:
				keyword_lower = keyword.lower()
				if keyword_lower not in self._role_keyword_map:
					self._role_keyword_map[keyword_lower] = role

		# Common organization suffixes
		self.org_suffixes = {
			"inc": "Inc.",
			"inc.": "Inc.",
			"llc": "LLC",
			"ltd": "Ltd.",
			"ltd.": "Ltd.",
			"corp": "Corp.",
			"corp.": "Corp.",
			"corporation": "Corporation",
			"company": "Company",
			"co": "Co.",
			"co.": "Co.",
		}

		# Government agency prefixes
		self.gov_prefixes = [
			"U.S.", "US", "Department of", "Dept.", "Agency", "Administration",
			"Bureau", "Office", "Division", "Service", "Commission", "Authority",
		]

	def _initialize_nlp_components(self):
		"""Initialize spaCy components"""
		if self.config["use_spacy_ner"] and HAS_SPACY_SUPPORT:
			try:
				self.nlp_model = spacy.load(self.config["spacy_model"])
				self.matcher = Matcher(self.nlp_model.vocab)
				self.phrase_matcher = PhraseMatcher(self.nlp_model.vocab, attr="LOWER")
				self.logger.info(f"spaCy model '{self.config['spacy_model']}' loaded successfully")
			except IOError:
				self.logger.warning(f"Could not load spaCy model '{self.config['spacy_model']}'")
				self.nlp_model = None

	def _compile_patterns(self):
		"""Compile custom patterns for stakeholder extraction"""
		if not self.matcher:
			return

		# Contact information patterns
		email_pattern = [{"LIKE_EMAIL": True}]
		self.matcher.add("EMAIL", [email_pattern])

		phone_pattern = [
			{"TEXT": {"REGEX": r"^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$"}}
		]
		self.matcher.add("PHONE", [phone_pattern])

		# Add phrase patterns for role keywords
		if self.phrase_matcher and self.nlp_model:
			role_docs = []
			role_labels = []
			for role, keywords in self.role_patterns.items():
				for keyword in keywords:
					keyword_doc = self.nlp_model(keyword)
					role_docs.append(keyword_doc)
					role_labels.append(role.value)

			if role_docs:
				self.phrase_matcher.add("STAKEHOLDER_ROLE", role_docs)

	async def extract_stakeholders(self, text: str, use_ai: bool = True) -> StakeholderExtractionResult:
		"""Extract stakeholders with roles and organizations from text"""
		start_time = asyncio.get_event_loop().time()
		result = StakeholderExtractionResult()
		result.original_text = text

		if not text or not text.strip():
			result.success = True
			return result

		try:
			# Check text length
			if len(text) > self.config["max_text_length"]:
				result.warnings.append(f"Text truncated to {self.config['max_text_length']} characters")
				text = text[: self.config["max_text_length"]]

			methods_used = []
			all_stakeholders = []

			# Method 1: Pattern-based extraction
			if self.config["use_custom_patterns"]:
				pattern_stakeholders = await self._extract_with_patterns(text)
				all_stakeholders.extend(pattern_stakeholders)
				methods_used.append("pattern_matching")

			# Method 2: spaCy NER
			if self.config["use_spacy_ner"] and self.nlp_model:
				spacy_stakeholders = await self._extract_with_spacy(text)
				all_stakeholders.extend(spacy_stakeholders)
				methods_used.append("spacy_ner")

			# Method 3: AI-enhanced extraction
			if use_ai and self.config["use_ai_enhancement"] and len(text) < 50000:
				ai_stakeholders, ai_analysis = await self._extract_with_ai(text)
				all_stakeholders.extend(ai_stakeholders)
				result.ai_analysis = ai_analysis
				methods_used.append("ai_enhancement")

			# Merge and deduplicate stakeholders
			merged_stakeholders = self._merge_stakeholders(all_stakeholders)

			# Filter by confidence threshold
			filtered_stakeholders = [
				s for s in merged_stakeholders if s.confidence >= self.config["min_confidence_threshold"]
			]

			# Extract contact information
			if self.config["extract_contact_info"]:
				self._extract_contact_info(filtered_stakeholders, text)

			# Normalize organization names
			if self.config["normalize_organizations"]:
				for stakeholder in filtered_stakeholders:
					if stakeholder.organization:
						stakeholder.organization = self._normalize_organization(stakeholder.organization)

			# Extract organizations separately
			if self.config["extract_organizations"]:
				organizations = self._extract_organizations(text)
				result.organizations = organizations

			# Build stakeholder graph
			if self.config["build_stakeholder_graph"]:
				graph = self._build_stakeholder_graph(filtered_stakeholders, text)
				result.stakeholder_graph = graph

			# Calculate statistics
			statistics = self._calculate_statistics(filtered_stakeholders)

			result.stakeholders = filtered_stakeholders
			result.statistics = statistics
			result.methods_used = methods_used
			result.success = True
			result.processing_time = asyncio.get_event_loop().time() - start_time

			self.logger.info(f"Stakeholders extracted successfully, time: {result.processing_time:.2f}s")

		except Exception as e:
			result.errors.append(f"Stakeholder extraction failed: {str(e)}")
			self.logger.error(f"Stakeholder extraction error: {e}")

		return result

	async def _extract_with_patterns(self, text: str) -> List[Stakeholder]:
		"""Extract stakeholders using role patterns"""
		stakeholders = []
		text_lower = text.lower()

		# Find role mentions
		for keyword, role in self._role_keyword_map.items():
			pattern = rf"\b{re.escape(keyword)}\b"
			for match in re.finditer(pattern, text, re.IGNORECASE):
				# Extract context around the match
				start = max(0, match.start() - self.config["context_window"])
				end = min(len(text), match.end() + self.config["context_window"])
				context = text[start:end]

				# Extract potential name before the role
				name = self._extract_name_before_role(text, match.start())

				# Extract organization from context
				org = self._extract_organization_from_context(context)

				stakeholder = Stakeholder(
					id=uuid7str(),
					name=name or f"Unknown {role.value.replace('_', ' ').title()}",
					roles=[role],
					organization=org,
					confidence=0.7,
					context=context,
					source_text=match.group(),
					start_char=match.start(),
					end_char=match.end(),
					extraction_method="pattern_matching",
				)
				stakeholders.append(stakeholder)

		return stakeholders

	async def _extract_with_spacy(self, text: str) -> List[Stakeholder]:
		"""Extract stakeholders using spaCy NER"""
		stakeholders = []

		if not self.nlp_model:
			return stakeholders

		doc = self.nlp_model(text)

		# Extract persons with potential roles
		for ent in doc.ents:
			if ent.label_ == "PERSON":
				# Look for role context around the person
				role = self._find_role_in_context(doc, ent)
				if role:
					# Extract organization
					org = self._find_organization_in_context(doc, ent)

					stakeholder = Stakeholder(
						id=uuid7str(),
						name=ent.text,
						roles=[role],
						organization=org,
						confidence=0.8,
						context=text[max(0, ent.start_char - 50) : ent.end_char + 50],
						source_text=ent.text,
						start_char=ent.start_char,
						end_char=ent.end_char,
						extraction_method="spacy_ner",
					)
					stakeholders.append(stakeholder)

		return stakeholders

	async def _extract_with_ai(self, text: str) -> Tuple[List[Stakeholder], Dict[str, Any]]:
		"""Extract stakeholders using AI enhancement"""
		stakeholders = []
		ai_analysis = {}

		try:
			chunks = self._split_text_for_ai(text)

			for chunk_idx, chunk in enumerate(chunks):
				chunk_stakeholders, chunk_analysis = await self._analyze_chunk_for_stakeholders(chunk, chunk_idx)
				stakeholders.extend(chunk_stakeholders)
				ai_analysis[f"chunk_{chunk_idx}"] = chunk_analysis

		except Exception as e:
			self.logger.warning(f"AI stakeholder extraction failed: {e}")
			ai_analysis["error"] = str(e)

		return stakeholders, ai_analysis

	async def _analyze_chunk_for_stakeholders(
		self, chunk: str, chunk_idx: int
	) -> Tuple[List[Stakeholder], Dict[str, Any]]:
		"""Analyze a chunk for stakeholders using AI"""
		prompt = f"""Extract stakeholders from this RFP document section.

		Identify:
		1. Stakeholder names and their roles
		2. Organizations mentioned
		3. Contact information (emails, phone numbers)
		4. Relationships between stakeholders

		Role categories to identify:
		- Evaluator/Reviewer/Assessor: evaluation team members
		- Decision Maker/Approver/Authority: approval authority
		- Technical Contact/Lead/Architect: technical team
		- Procurement Officer/Contract Specialist: procurement team
		- Program Manager/Project Manager: project leadership
		- Coordinator/Liaison/Contact: administrative contacts
		- Sponsor/Owner/Executive: executive stakeholders
		- Vendor/Contractor/Consultant: external parties

		Text to analyze:
		{chunk}

		Provide JSON response:
		{{
		  "stakeholders": [
			{{
			  "name": "John Smith",
			  "roles": ["technical_contact"],
			  "organization": "Department of Defense",
			  "title": "Senior Engineer",
			  "email": "john.smith@defense.gov",
			  "phone": "+1-555-123-4567",
			  "confidence": 0.9,
			  "context": "surrounding context"
			}}
		  ],
		  "organizations": ["Org Name"],
		  "relationships": [
			{{
			  "source": "John Smith",
			  "target": "Jane Doe",
			  "type": "reports_to",
			  "confidence": 0.8
			}}
		  ],
		  "analysis": {{
			"total_stakeholders": 5,
			"dominant_roles": ["technical_contact", "program_manager"],
			"key_organizations": ["Defense Agency"]
		  }}
		}}"""

		try:
			response = await self.ollama_client.post(
				"/api/generate",
				json={
					"model": self.config["ollama_model"],
					"prompt": prompt,
					"stream": False,
					"options": {"temperature": 0.1, "top_p": 0.9, "num_predict": 3000},
				},
			)

			if response.status_code == 200:
				ai_response = response.json()
				response_text = ai_response.get("response", "").strip()

				try:
					ai_data = json.loads(response_text)
					stakeholders = self._convert_ai_stakeholders(ai_data.get("stakeholders", []))
					analysis = ai_data.get("analysis", {})
					analysis["raw_response"] = response_text
					return stakeholders, analysis

				except json.JSONDecodeError:
					stakeholders = self._parse_ai_text_stakeholders(response_text)
					return stakeholders, {"raw_response": response_text, "parsing_method": "text_fallback"}

		except Exception as e:
			self.logger.warning(f"AI chunk stakeholder analysis failed: {e}")

		return [], {"error": "AI analysis failed"}

	def _convert_ai_stakeholders(self, ai_stakeholders: List[Dict[str, Any]]) -> List[Stakeholder]:
		"""Convert AI stakeholder data to Stakeholder objects"""
		stakeholders = []

		for ai_data in ai_stakeholders:
			try:
				# Map role strings to enum values
				roles = []
				for role_str in ai_data.get("roles", []):
					try:
						role = StakeholderRole(role_str.lower().replace(" ", "_"))
						roles.append(role)
					except ValueError:
						# Try partial match
						for r in StakeholderRole:
							if role_str.lower() in [kw.lower() for kw in ROLE_PATTERNS.get(r, [])]:
								roles.append(r)
								break

				if not roles:
					roles = [StakeholderRole.STAKEHOLDER]

				stakeholder = Stakeholder(
					id=uuid7str(),
					name=ai_data.get("name", "Unknown"),
					roles=roles,
					organization=ai_data.get("organization"),
					title=ai_data.get("title"),
					email=ai_data.get("email"),
					phone=ai_data.get("phone"),
					confidence=min(ai_data.get("confidence", 0.5), 1.0),
					context=ai_data.get("context"),
					extraction_method="ai_enhancement",
					ai_insights={"source": "ollama", "original_data": ai_data},
				)
				stakeholders.append(stakeholder)

			except Exception as e:
				self.logger.warning(f"Failed to convert AI stakeholder: {e}")
				continue

		return stakeholders

	def _parse_ai_text_stakeholders(self, response_text: str) -> List[Stakeholder]:
		"""Parse AI response as text when JSON parsing fails"""
		stakeholders = []
		lines = response_text.split("\n")

		for line in lines:
			line = line.strip()
			if not line:
				continue

			# Look for role mentions
			for keyword, role in self._role_keyword_map.items():
				if keyword in line.lower():
					stakeholder = Stakeholder(
						id=uuid7str(),
						name="Unknown",
						roles=[role],
						confidence=0.4,
						context=line,
						extraction_method="ai_text_parsing",
					)
					stakeholders.append(stakeholder)
					break

		return stakeholders

	def _extract_name_before_role(self, text: str, role_start: int) -> Optional[str]:
		"""Extract a person name appearing before a role mention"""
		# Look for name patterns in the 100 characters before the role
		context_start = max(0, role_start - 100)
		context = text[context_start:role_start]

		# Pattern: "Name (Title)" or "Name - Title" or "Name, Title"
		name_patterns = [
			r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:\(|-|,)",
			r"([A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+)",
			r"([A-Z][a-z]+\s+[A-Z][a-z]+)",
		]

		for pattern in name_patterns:
			match = re.search(pattern, context)
			if match:
				return match.group(1).strip()

		return None

	def _extract_organization_from_context(self, context: str) -> Optional[str]:
		"""Extract organization name from context"""
		for pattern in self.organization_patterns:
			match = re.search(pattern, context, re.IGNORECASE)
			if match:
				return match.group(1).strip()

		# Look for capitalized multi-word names
		org_match = re.search(
			r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:Agency|Department|Office|Division|Service|Administration|Institute|Center)",
			context,
		)
		if org_match:
			return org_match.group(0).strip()

		return None

	def _find_role_in_context(self, doc: Doc, ent: Span) -> Optional[StakeholderRole]:
		"""Find role context around a named entity"""
		# Search window around the entity
		start = max(0, ent.start - 10)
		end = min(len(doc), ent.end + 10)

		context_tokens = doc[start:end]
		context_text = " ".join([t.text.lower() for t in context_tokens])

		# Find matching role
		for keyword, role in self._role_keyword_map.items():
			if keyword in context_text:
				return role

		return None

	def _find_organization_in_context(self, doc: Doc, ent: Span) -> Optional[str]:
		"""Find organization context around a named entity"""
		start = max(0, ent.start - 15)
		end = min(len(doc), ent.end + 15)

		context_text = doc[start:end].text

		for pattern in self.organization_patterns:
			match = re.search(pattern, context_text, re.IGNORECASE)
			if match:
				return match.group(1) if match.lastindex else match.group(0)

		# Look for ORG entities nearby
		for nearby_ent in doc.ents:
			if nearby_ent.label_ == "ORG" and abs(nearby_ent.start - ent.start) < 10:
				return nearby_ent.text

		return None

	def _extract_contact_info(self, stakeholders: List[Stakeholder], text: str) -> None:
		"""Extract contact information for stakeholders"""
		for stakeholder in stakeholders:
			if not stakeholder.context:
				continue

			# Extract email
			email_match = re.search(self.contact_patterns["email"], stakeholder.context)
			if email_match and not stakeholder.email:
				stakeholder.email = email_match.group()

			# Extract phone
			phone_match = re.search(self.contact_patterns["phone"], stakeholder.context)
			if phone_match and not stakeholder.phone:
				stakeholder.phone = phone_match.group()

	def _extract_organizations(self, text: str) -> List[Dict[str, Any]]:
		"""Extract organizations from text"""
		organizations = []
		seen_orgs = set()

		for pattern in self.organization_patterns:
			for match in re.finditer(pattern, text, re.IGNORECASE):
				org_name = match.group(1) if match.lastindex else match.group(0)
				org_name = self._normalize_organization(org_name)

				if org_name.lower() not in seen_orgs:
					seen_orgs.add(org_name.lower())
					organizations.append(
						{
							"name": org_name,
							"normalized": self._normalize_organization(org_name),
							"mentions": text.lower().count(org_name.lower()),
							"context": text[max(0, match.start() - 50) : match.end() + 50],
						}
					)

		return organizations

	def _normalize_organization(self, org_name: str) -> str:
		"""Normalize organization name"""
		org = org_name.strip()

		# Normalize common suffixes
		for suffix, normalized in self.org_suffixes.items():
			if org.lower().endswith(f" {suffix}"):
				org = org[: -len(suffix)].strip() + " " + normalized

		# Remove extra whitespace
		org = " ".join(org.split())

		# Title case
		org = org.title()

		# Preserve known acronyms
		acronyms = ["NASA", "DOD", "DOE", "DHS", "VA", "GSA", "NIH", "NSF", "EPA", "FBI", "CIA", "NSA"]
		for acronym in acronyms:
			org = re.sub(rf"\b{acronym.title()}\b", acronym, org)

		return org

	def _merge_stakeholders(self, stakeholders: List[Stakeholder]) -> List[Stakeholder]:
		"""Merge and deduplicate stakeholders"""
		if not stakeholders:
			return []

		# Group by normalized name
		name_groups: Dict[str, List[Stakeholder]] = {}
		for s in stakeholders:
			normalized_name = s.name.lower().strip()
			if normalized_name not in name_groups:
				name_groups[normalized_name] = []
			name_groups[normalized_name].append(s)

		merged = []
		for name, group in name_groups.items():
			if len(group) == 1:
				merged.append(group[0])
				continue

			# Merge stakeholders with same name
			primary = group[0]
			primary.confidence = max(s.confidence for s in group)

			# Combine roles
			all_roles = set()
			for s in group:
				all_roles.update(s.roles)
			primary.roles = list(all_roles)

			# Combine attributes
			for s in group[1:]:
				if s.organization and not primary.organization:
					primary.organization = s.organization
				if s.email and not primary.email:
					primary.email = s.email
				if s.phone and not primary.phone:
					primary.phone = s.phone
				if s.title and not primary.title:
					primary.title = s.title
				primary.relationships.extend(s.relationships)

			merged.append(primary)

		return merged

	def _build_stakeholder_graph(self, stakeholders: List[Stakeholder], text: str) -> StakeholderGraph:
		"""Build stakeholder relationship graph"""
		graph = StakeholderGraph()

		# Add all stakeholders
		for stakeholder in stakeholders:
			graph.add_stakeholder(stakeholder)

		# Build relationships based on co-occurrence and context
		relationships = self._extract_relationships(stakeholders, text)
		for rel in relationships:
			graph.add_relationship(rel)

		# Calculate statistics
		graph.statistics = self._calculate_graph_statistics(graph)

		# Generate visualization data
		graph.visualization_data = graph.to_visualization_dict()

		return graph

	def _extract_relationships(
		self, stakeholders: List[Stakeholder], text: str
	) -> List[StakeholderRelationship]:
		"""Extract relationships between stakeholders"""
		relationships = []

		# Group stakeholders by organization
		org_groups: Dict[str, List[Stakeholder]] = {}
		for s in stakeholders:
			if s.organization:
				org_key = s.organization.lower()
				if org_key not in org_groups:
					org_groups[org_key] = []
				org_groups[org_key].append(s)

		# Create same-organization relationships
		for org_key, org_stakeholders in org_groups.items():
			for i, s1 in enumerate(org_stakeholders):
				for s2 in org_stakeholders[i + 1 :]:
					# Check if they appear near each other in text
					if s1.start_char > 0 and s2.start_char > 0:
						distance = abs(s1.start_char - s2.start_char)
						if distance < 500:  # Within 500 characters
							rel = StakeholderRelationship(
								id=uuid7str(),
								source_id=s1.id,
								target_id=s2.id,
								relationship_type="same_organization",
								confidence=0.7 if s1.organization else 0.5,
								evidence=f"Both at {s1.organization}" if s1.organization else "Co-occurrence",
							)
							relationships.append(rel)

		# Look for reporting relationships
		reporting_patterns = [
			(r"reports to ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", "reports_to"),
			(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) manages ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", "manages"),
			(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) supervises ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", "supervises"),
		]

		for pattern, rel_type in reporting_patterns:
			for match in re.finditer(pattern, text):
				name1 = match.group(1).strip()
				name2 = match.group(2).strip() if len(match.groups()) > 1 else None

				# Find matching stakeholders
				s1 = next((s for s in stakeholders if s.name.lower() == name1.lower()), None)
				s2 = next((s for s in stakeholders if s.name.lower() == name2.lower()), None) if name2 else None

				if s1 and s2:
					rel = StakeholderRelationship(
						id=uuid7str(),
						source_id=s1.id,
						target_id=s2.id,
						relationship_type=rel_type,
						confidence=0.8,
						evidence=match.group(0),
						context=text[max(0, match.start() - 50) : match.end() + 50],
					)
					relationships.append(rel)

		return relationships

	def _calculate_graph_statistics(self, graph: StakeholderGraph) -> Dict[str, Any]:
		"""Calculate statistics for the stakeholder graph"""
		if not graph.stakeholders:
			return {}

		# Role distribution
		role_counts: Dict[str, int] = {}
		category_counts: Dict[str, int] = {}
		org_counts: Dict[str, int] = {}

		for s in graph.stakeholders:
			for role in s.roles:
				role_counts[role.value] = role_counts.get(role.value, 0) + 1
			cat = s.role_category.value
			category_counts[cat] = category_counts.get(cat, 0) + 1
			if s.organization:
				org_counts[s.organization] = org_counts.get(s.organization, 0) + 1

		# Graph metrics
		num_nodes = len(graph.stakeholders)
		num_edges = len(graph.relationships)
		avg_connections = num_edges * 2 / num_nodes if num_nodes > 0 else 0

		return {
			"total_stakeholders": num_nodes,
			"total_relationships": num_edges,
			"avg_connections_per_stakeholder": round(avg_connections, 2),
			"role_distribution": role_counts,
			"category_distribution": category_counts,
			"organizations": len(org_counts),
			"organization_distribution": org_counts,
			"stakeholders_with_contact_info": len(
				[s for s in graph.stakeholders if s.email or s.phone]
			),
		}

	def _calculate_statistics(self, stakeholders: List[Stakeholder]) -> Dict[str, Any]:
		"""Calculate stakeholder statistics"""
		if not stakeholders:
			return {}

		role_counts: Dict[str, int] = {}
		org_counts: Dict[str, int] = {}
		confidence_sum = 0

		for s in stakeholders:
			for role in s.roles:
				role_counts[role.value] = role_counts.get(role.value, 0) + 1
			if s.organization:
				org_counts[s.organization] = org_counts.get(s.organization, 0) + 1
			confidence_sum += s.confidence

		return {
			"total_stakeholders": len(stakeholders),
			"unique_organizations": len(org_counts),
			"role_distribution": role_counts,
			"organization_distribution": org_counts,
			"average_confidence": confidence_sum / len(stakeholders),
			"stakeholders_with_contact": len([s for s in stakeholders if s.email or s.phone]),
			"stakeholders_by_category": {
				cat.value: len([s for s in stakeholders if s.role_category == cat])
				for cat in StakeholderRoleCategory
			},
		}

	def _split_text_for_ai(self, text: str) -> List[str]:
		"""Split text into chunks for AI analysis"""
		if len(text) <= self.config["ai_chunk_size"]:
			return [text]

		chunks = []
		sentences = re.split(r"[.!?]+", text)
		current_chunk = ""

		for sentence in sentences:
			if len(current_chunk) + len(sentence) <= self.config["ai_chunk_size"]:
				current_chunk += sentence + ". "
			else:
				if current_chunk:
					chunks.append(current_chunk.strip())
				current_chunk = sentence + ". "

		if current_chunk:
			chunks.append(current_chunk.strip())

		return chunks

	async def build_relationship_graph(self, stakeholders: List[Stakeholder]) -> Dict[str, Any]:
		"""Build stakeholder relationship graph for visualization"""
		graph = StakeholderGraph()

		for stakeholder in stakeholders:
			graph.add_stakeholder(stakeholder)

		# Calculate graph statistics
		graph.statistics = self._calculate_graph_statistics(graph)

		return graph.to_visualization_dict()

	async def close(self):
		"""Close the Ollama client"""
		await self.ollama_client.aclose()

	def get_mapper_info(self) -> Dict[str, Any]:
		"""Get mapper information and capabilities"""
		return {
			"supported_roles": [r.value for r in StakeholderRole],
			"role_categories": [c.value for c in StakeholderRoleCategory],
			"total_role_keywords": len(self._role_keyword_map),
			"extraction_methods": ["pattern_matching", "spacy_ner", "ai_enhancement"],
			"spacy_available": HAS_SPACY_SUPPORT,
			"ai_model": self.config["ollama_model"],
			"config": {k: v for k, v in self.config.items() if k not in ["role_patterns", "organization_patterns"]},
			"version": "1.0.0",
		}

def create_stakeholder_mapper(config: Optional[Dict[str, Any]] = None) -> StakeholderMapper:
	"""Create StakeholderMapper instance with configuration"""
	return StakeholderMapper(config)