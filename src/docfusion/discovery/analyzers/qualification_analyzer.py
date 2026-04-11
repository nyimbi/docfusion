"""
Qualification Analyzer for Capability-Opportunity Matching

This module provides comprehensive analysis of organizational capabilities
against opportunity requirements to determine qualification levels and
match quality.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict, validator
from pydantic.dataclasses import dataclass as pydantic_dataclass

from ...core.models.base import BaseEntity
from ...nlp.services.text_analyzer import TextAnalyzer
from ...nlp.services.semantic_matcher import SemanticMatcher
from ..models.opportunity_models import OpportunityData


class CapabilityMatch(BaseModel):
	"""Individual capability match assessment"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	capability_name: str = Field(description="Name of the capability")
	required_level: str = Field(description="Required proficiency level")
	current_level: str = Field(description="Current organizational level")
	match_score: float = Field(ge=0.0, le=1.0, description="Match quality score")
	gap_analysis: str = Field(description="Description of capability gaps")
	evidence: List[str] = Field(default_factory=list, description="Supporting evidence")
	development_path: Optional[str] = Field(None, description="Path to close capability gap")


class ExperienceMatch(BaseModel):
	"""Experience requirement matching assessment"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	requirement_type: str = Field(description="Type of experience required")
	years_required: int = Field(ge=0, description="Years of experience required")
	years_available: int = Field(ge=0, description="Years of experience available")
	domain_match: float = Field(ge=0.0, le=1.0, description="Domain relevance score")
	project_examples: List[str] = Field(default_factory=list, description="Relevant project examples")
	team_members: List[str] = Field(default_factory=list, description="Team members with experience")


class CertificationMatch(BaseModel):
	"""Certification and credential matching"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	certification_name: str = Field(description="Required certification")
	is_required: bool = Field(description="Whether certification is mandatory")
	current_status: str = Field(description="Current certification status")
	holders: List[str] = Field(default_factory=list, description="Team members with certification")
	expiry_dates: Dict[str, datetime] = Field(default_factory=dict, description="Certification expiry dates")
	acquisition_timeline: Optional[timedelta] = Field(None, description="Time to acquire if missing")


class TechnicalMatch(BaseModel):
	"""Technical requirement matching assessment"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	technology_stack: List[str] = Field(description="Required technologies")
	proficiency_levels: Dict[str, float] = Field(description="Technology proficiency scores")
	infrastructure_match: float = Field(ge=0.0, le=1.0, description="Infrastructure compatibility")
	tooling_availability: Dict[str, bool] = Field(description="Required tooling availability")
	integration_complexity: str = Field(description="Integration complexity assessment")


class TeamMatch(BaseModel):
	"""Team composition and capacity matching"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	required_roles: List[str] = Field(description="Required team roles")
	available_capacity: Dict[str, float] = Field(description="Available capacity by role")
	skill_coverage: Dict[str, float] = Field(description="Skill coverage by area")
	team_size_match: float = Field(ge=0.0, le=1.0, description="Team size adequacy")
	leadership_match: float = Field(ge=0.0, le=1.0, description="Leadership capability match")
	collaboration_score: float = Field(ge=0.0, le=1.0, description="Team collaboration readiness")


class ComplianceMatch(BaseModel):
	"""Regulatory and compliance requirement matching"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	regulatory_requirements: List[str] = Field(description="Required regulatory compliance")
	current_compliance: Dict[str, bool] = Field(description="Current compliance status")
	certification_gaps: List[str] = Field(description="Missing compliance certifications")
	security_clearance: Optional[str] = Field(None, description="Required security clearance level")
	clearance_holders: List[str] = Field(default_factory=list, description="Team members with clearance")
	compliance_timeline: Dict[str, timedelta] = Field(default_factory=dict, description="Time to achieve compliance")


class QualificationGap(BaseModel):
	"""Identified qualification gap with remediation plan"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	gap_type: str = Field(description="Type of qualification gap")
	severity: str = Field(description="Gap severity (critical, major, minor)")
	description: str = Field(description="Detailed gap description")
	impact: str = Field(description="Impact on proposal success")
	remediation_plan: str = Field(description="Plan to address the gap")
	timeline: timedelta = Field(description="Time required to address gap")
	cost_estimate: Optional[float] = Field(None, description="Cost to address gap")
	probability_of_success: float = Field(ge=0.0, le=1.0, description="Success probability for remediation")


class QualificationAssessment(BaseModel):
	"""Complete qualification assessment result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	overall_match_score: float = Field(ge=0.0, le=1.0, description="Overall qualification score")
	qualification_level: str = Field(description="Qualification level (highly_qualified, qualified, partially_qualified, not_qualified)")
	
	capability_matches: List[CapabilityMatch] = Field(description="Individual capability assessments")
	experience_matches: List[ExperienceMatch] = Field(description="Experience requirement matches")
	certification_matches: List[CertificationMatch] = Field(description="Certification matches")
	technical_match: TechnicalMatch = Field(description="Technical requirement assessment")
	team_match: TeamMatch = Field(description="Team composition assessment")
	compliance_match: ComplianceMatch = Field(description="Compliance requirement assessment")
	
	qualification_gaps: List[QualificationGap] = Field(description="Identified qualification gaps")
	strengths: List[str] = Field(description="Key organizational strengths")
	differentiators: List[str] = Field(description="Competitive differentiators")
	
	win_probability: float = Field(ge=0.0, le=1.0, description="Estimated win probability")
	confidence_level: float = Field(ge=0.0, le=1.0, description="Assessment confidence level")
	
	recommendations: List[str] = Field(description="Strategic recommendations")
	next_steps: List[str] = Field(description="Recommended next steps")
	
	analysis_timestamp: datetime = Field(default_factory=datetime.now)
	analysis_version: str = Field(default="1.0")


@pydantic_dataclass
class OrganizationalCapabilities:
	"""Current organizational capabilities profile"""
	
	core_competencies: Dict[str, float] = field(default_factory=dict)
	technical_skills: Dict[str, float] = field(default_factory=dict)
	industry_experience: Dict[str, int] = field(default_factory=dict)
	certifications: Dict[str, List[str]] = field(default_factory=dict)
	security_clearances: Dict[str, List[str]] = field(default_factory=dict)
	team_composition: Dict[str, int] = field(default_factory=dict)
	past_performance: List[Dict[str, Any]] = field(default_factory=list)
	compliance_status: Dict[str, bool] = field(default_factory=dict)
	infrastructure: Dict[str, Any] = field(default_factory=dict)
	partnerships: List[str] = field(default_factory=list)


class QualificationAnalyzer:
	"""
	Advanced qualification analyzer for capability-opportunity matching
	
	Performs comprehensive analysis of organizational capabilities against
	opportunity requirements to determine qualification levels and develop
	strategic recommendations.
	"""
	
	def __init__(self, text_analyzer: Optional[TextAnalyzer] = None, 
	             semantic_matcher: Optional[SemanticMatcher] = None):
		self.text_analyzer = text_analyzer or TextAnalyzer()
		self.semantic_matcher = semantic_matcher or SemanticMatcher()
		
		self._capability_patterns = self._initialize_capability_patterns()
		self._experience_patterns = self._initialize_experience_patterns()
		self._certification_patterns = self._initialize_certification_patterns()
		self._technical_patterns = self._initialize_technical_patterns()
		self._compliance_patterns = self._initialize_compliance_patterns()
	
	def _initialize_capability_patterns(self) -> Dict[str, List[str]]:
		"""Initialize capability detection patterns"""
		return {
			'project_management': [
				r'project\s+management',
				r'program\s+management', 
				r'pmp\s+certified',
				r'agile\s+methodology',
				r'scrum\s+master'
			],
			'software_development': [
				r'software\s+development',
				r'full\s+stack\s+development',
				r'backend\s+development',
				r'frontend\s+development',
				r'devops\s+engineering'
			],
			'data_analytics': [
				r'data\s+analytics',
				r'business\s+intelligence',
				r'machine\s+learning',
				r'artificial\s+intelligence',
				r'predictive\s+modeling'
			],
			'cybersecurity': [
				r'cybersecurity',
				r'information\s+security',
				r'security\s+architecture',
				r'penetration\s+testing',
				r'incident\s+response'
			],
			'cloud_computing': [
				r'cloud\s+computing',
				r'aws\s+certified',
				r'azure\s+certified',
				r'cloud\s+architecture',
				r'containerization'
			]
		}
	
	def _initialize_experience_patterns(self) -> Dict[str, List[str]]:
		"""Initialize experience requirement patterns"""
		return {
			'years_experience': [
				r'(\d+)\+?\s*years?\s*of?\s*experience',
				r'minimum\s*(\d+)\s*years?',
				r'at\s*least\s*(\d+)\s*years?',
				r'(\d+)\s*or\s*more\s*years?'
			],
			'domain_experience': [
				r'experience\s+in\s+([^.]+)',
				r'background\s+in\s+([^.]+)',
				r'expertise\s+in\s+([^.]+)',
				r'specialized\s+in\s+([^.]+)'
			],
			'project_types': [
				r'similar\s+projects',
				r'comparable\s+engagements',
				r'related\s+initiatives',
				r'relevant\s+implementations'
			]
		}
	
	def _initialize_certification_patterns(self) -> Dict[str, List[str]]:
		"""Initialize certification requirement patterns"""
		return {
			'required_certifications': [
				r'must\s+have\s+([^.]+)\s+certification',
				r'required:\s*([^.]+)\s+certified',
				r'certification\s+required:\s*([^.]+)',
				r'([^.]+)\s+certification\s+mandatory'
			],
			'preferred_certifications': [
				r'preferred:\s*([^.]+)\s+certified',
				r'certification\s+preferred:\s*([^.]+)',
				r'([^.]+)\s+certification\s+preferred',
				r'bonus:\s*([^.]+)\s+certification'
			],
			'security_clearances': [
				r'security\s+clearance:\s*([^.]+)',
				r'clearance\s+level:\s*([^.]+)',
				r'must\s+have\s+([^.]+)\s+clearance',
				r'([^.]+)\s+clearance\s+required'
			]
		}
	
	def _initialize_technical_patterns(self) -> Dict[str, List[str]]:
		"""Initialize technical requirement patterns"""
		return {
			'programming_languages': [
				r'programming\s+languages?:\s*([^.]+)',
				r'proficiency\s+in\s+([^.]+)',
				r'experience\s+with\s+([^.]+)',
				r'skilled\s+in\s+([^.]+)'
			],
			'frameworks': [
				r'framework\s+experience:\s*([^.]+)',
				r'([^.]+)\s+framework',
				r'library\s+experience:\s*([^.]+)',
				r'([^.]+)\s+library'
			],
			'platforms': [
				r'platform\s+experience:\s*([^.]+)',
				r'([^.]+)\s+platform',
				r'environment:\s*([^.]+)',
				r'([^.]+)\s+environment'
			],
			'tools': [
				r'tools?:\s*([^.]+)',
				r'software:\s*([^.]+)',
				r'applications?:\s*([^.]+)',
				r'systems?:\s*([^.]+)'
			]
		}
	
	def _initialize_compliance_patterns(self) -> Dict[str, List[str]]:
		"""Initialize compliance requirement patterns"""
		return {
			'regulatory': [
				r'compliance\s+with\s+([^.]+)',
				r'regulatory\s+requirement:\s*([^.]+)',
				r'must\s+comply\s+with\s+([^.]+)',
				r'([^.]+)\s+compliance\s+required'
			],
			'standards': [
				r'standards?:\s*([^.]+)',
				r'([^.]+)\s+standard',
				r'methodology:\s*([^.]+)',
				r'([^.]+)\s+methodology'
			],
			'security': [
				r'security\s+requirements?:\s*([^.]+)',
				r'security\s+standards?:\s*([^.]+)',
				r'([^.]+)\s+security',
				r'security\s+([^.]+)'
			]
		}
	
	async def analyze_qualification(self, 
	                                opportunity_data: OpportunityData,
	                                org_capabilities: OrganizationalCapabilities,
	                                detailed_analysis: bool = True) -> QualificationAssessment:
		"""
		Perform comprehensive qualification analysis
		
		Args:
			opportunity_data: Opportunity requirements and details
			org_capabilities: Current organizational capabilities
			detailed_analysis: Whether to perform detailed gap analysis
			
		Returns:
			Complete qualification assessment
		"""
		try:
			# Extract requirements from opportunity
			requirements = await self._extract_requirements(opportunity_data)
			
			# Parallel analysis of different qualification aspects
			tasks = [
				self._analyze_capabilities(requirements, org_capabilities),
				self._analyze_experience(requirements, org_capabilities),
				self._analyze_certifications(requirements, org_capabilities),
				self._analyze_technical_requirements(requirements, org_capabilities),
				self._analyze_team_requirements(requirements, org_capabilities),
				self._analyze_compliance_requirements(requirements, org_capabilities)
			]
			
			results = await asyncio.gather(*tasks)
			
			capability_matches, experience_matches, certification_matches, \
			technical_match, team_match, compliance_match = results
			
			# Calculate overall match score
			overall_score = self._calculate_overall_match_score(
				capability_matches, experience_matches, certification_matches,
				technical_match, team_match, compliance_match
			)
			
			# Determine qualification level
			qualification_level = self._determine_qualification_level(overall_score)
			
			# Identify gaps if detailed analysis requested
			qualification_gaps = []
			if detailed_analysis:
				qualification_gaps = await self._identify_qualification_gaps(
					capability_matches, experience_matches, certification_matches,
					technical_match, team_match, compliance_match
				)
			
			# Generate strengths and differentiators
			strengths = self._identify_strengths(org_capabilities, requirements)
			differentiators = self._identify_differentiators(org_capabilities, requirements)
			
			# Calculate win probability
			win_probability = self._calculate_win_probability(
				overall_score, qualification_gaps, strengths, differentiators
			)
			
			# Generate recommendations
			recommendations = self._generate_recommendations(
				qualification_level, qualification_gaps, strengths
			)
			next_steps = self._generate_next_steps(qualification_level, qualification_gaps)
			
			return QualificationAssessment(
				opportunity_id=opportunity_data.id,
				overall_match_score=overall_score,
				qualification_level=qualification_level,
				capability_matches=capability_matches,
				experience_matches=experience_matches,
				certification_matches=certification_matches,
				technical_match=technical_match,
				team_match=team_match,
				compliance_match=compliance_match,
				qualification_gaps=qualification_gaps,
				strengths=strengths,
				differentiators=differentiators,
				win_probability=win_probability,
				confidence_level=self._calculate_confidence_level(overall_score, qualification_gaps),
				recommendations=recommendations,
				next_steps=next_steps
			)
			
		except Exception as e:
			self._log_analysis_error(f"Qualification analysis failed: {str(e)}")
			raise
	
	async def _extract_requirements(self, opportunity_data: OpportunityData) -> Dict[str, Any]:
		"""Extract detailed requirements from opportunity data"""
		requirements = {
			'capabilities': [],
			'experience': [],
			'certifications': [],
			'technical': [],
			'team': [],
			'compliance': []
		}
		
		# Combine all text sources
		text_sources = [
			opportunity_data.description,
			opportunity_data.requirements,
			opportunity_data.scope_of_work,
			*[doc.get('content', '') for doc in opportunity_data.documents]
		]
		
		combined_text = ' '.join(filter(None, text_sources))
		
		# Extract different types of requirements
		for req_type, patterns in self._capability_patterns.items():
			matches = []
			for pattern in patterns:
				matches.extend(re.findall(pattern, combined_text, re.IGNORECASE))
			requirements['capabilities'].extend(matches)
		
		# Extract experience requirements
		for req_type, patterns in self._experience_patterns.items():
			matches = []
			for pattern in patterns:
				matches.extend(re.findall(pattern, combined_text, re.IGNORECASE))
			requirements['experience'].extend(matches)
		
		# Extract certification requirements
		for req_type, patterns in self._certification_patterns.items():
			matches = []
			for pattern in patterns:
				matches.extend(re.findall(pattern, combined_text, re.IGNORECASE))
			requirements['certifications'].extend(matches)
		
		# Extract technical requirements
		for req_type, patterns in self._technical_patterns.items():
			matches = []
			for pattern in patterns:
				matches.extend(re.findall(pattern, combined_text, re.IGNORECASE))
			requirements['technical'].extend(matches)
		
		# Extract compliance requirements
		for req_type, patterns in self._compliance_patterns.items():
			matches = []
			for pattern in patterns:
				matches.extend(re.findall(pattern, combined_text, re.IGNORECASE))
			requirements['compliance'].extend(matches)
		
		return requirements
	
	async def _analyze_capabilities(self, requirements: Dict[str, Any], 
	                                org_capabilities: OrganizationalCapabilities) -> List[CapabilityMatch]:
		"""Analyze capability matching"""
		capability_matches = []
		
		for capability in requirements.get('capabilities', []):
			# Use semantic matching to find closest organizational capability
			best_match = await self.semantic_matcher.find_best_match(
				capability, list(org_capabilities.core_competencies.keys())
			)
			
			if best_match:
				current_level = org_capabilities.core_competencies.get(best_match, 0.0)
				match_score = min(current_level, 1.0)  # Cap at 1.0
				
				# Generate gap analysis
				gap_analysis = self._generate_capability_gap_analysis(
					capability, current_level, match_score
				)
				
				# Find supporting evidence
				evidence = self._find_capability_evidence(
					best_match, org_capabilities
				)
				
				capability_matches.append(CapabilityMatch(
					capability_name=capability,
					required_level="high",  # Default assumption
					current_level=self._level_to_string(current_level),
					match_score=match_score,
					gap_analysis=gap_analysis,
					evidence=evidence,
					development_path=self._generate_development_path(capability, current_level)
				))
		
		return capability_matches
	
	async def _analyze_experience(self, requirements: Dict[str, Any],
	                              org_capabilities: OrganizationalCapabilities) -> List[ExperienceMatch]:
		"""Analyze experience requirement matching"""
		experience_matches = []
		
		for experience_req in requirements.get('experience', []):
			# Parse years requirement if present
			years_pattern = r'(\d+)'
			years_match = re.search(years_pattern, str(experience_req))
			years_required = int(years_match.group(1)) if years_match else 0
			
			# Find matching domain experience
			domain_matches = []
			for domain, years_available in org_capabilities.industry_experience.items():
				similarity = await self.semantic_matcher.calculate_similarity(
					str(experience_req), domain
				)
				if similarity > 0.7:  # High similarity threshold
					domain_matches.append((domain, years_available, similarity))
			
			if domain_matches:
				# Take best domain match
				best_domain, years_available, domain_match = max(
					domain_matches, key=lambda x: x[2]
				)
				
				# Find relevant project examples
				project_examples = self._find_relevant_projects(
					best_domain, org_capabilities.past_performance
				)
				
				experience_matches.append(ExperienceMatch(
					requirement_type=str(experience_req),
					years_required=years_required,
					years_available=years_available,
					domain_match=domain_match,
					project_examples=project_examples,
					team_members=self._find_experienced_team_members(best_domain, org_capabilities)
				))
		
		return experience_matches
	
	async def _analyze_certifications(self, requirements: Dict[str, Any],
	                                  org_capabilities: OrganizationalCapabilities) -> List[CertificationMatch]:
		"""Analyze certification requirement matching"""
		certification_matches = []
		
		for cert_req in requirements.get('certifications', []):
			# Determine if certification is required or preferred
			is_required = any(word in str(cert_req).lower() 
			                  for word in ['required', 'must', 'mandatory'])
			
			# Find matching certifications
			matching_certs = []
			for cert_type, holders in org_capabilities.certifications.items():
				similarity = await self.semantic_matcher.calculate_similarity(
					str(cert_req), cert_type
				)
				if similarity > 0.8:  # Very high similarity for certifications
					matching_certs.append((cert_type, holders, similarity))
			
			if matching_certs:
				best_cert, holders, _ = max(matching_certs, key=lambda x: x[2])
				status = "held" if holders else "not_held"
				
				certification_matches.append(CertificationMatch(
					certification_name=str(cert_req),
					is_required=is_required,
					current_status=status,
					holders=holders,
					expiry_dates={},  # Would be populated from actual data
					acquisition_timeline=timedelta(days=90) if not holders else None
				))
			else:
				certification_matches.append(CertificationMatch(
					certification_name=str(cert_req),
					is_required=is_required,
					current_status="not_held",
					holders=[],
					expiry_dates={},
					acquisition_timeline=timedelta(days=180)
				))
		
		return certification_matches
	
	async def _analyze_technical_requirements(self, requirements: Dict[str, Any],
	                                          org_capabilities: OrganizationalCapabilities) -> TechnicalMatch:
		"""Analyze technical requirement matching"""
		tech_stack = requirements.get('technical', [])
		
		proficiency_levels = {}
		for tech in tech_stack:
			# Find matching technical skills
			best_match_score = 0.0
			for skill, level in org_capabilities.technical_skills.items():
				similarity = await self.semantic_matcher.calculate_similarity(
					str(tech), skill
				)
				if similarity > best_match_score:
					best_match_score = similarity * level
			
			proficiency_levels[str(tech)] = best_match_score
		
		# Assess infrastructure compatibility
		infrastructure_score = self._assess_infrastructure_compatibility(
			tech_stack, org_capabilities.infrastructure
		)
		
		# Check tooling availability
		tooling_availability = {
			str(tech): self._check_tooling_availability(tech, org_capabilities)
			for tech in tech_stack
		}
		
		return TechnicalMatch(
			technology_stack=[str(tech) for tech in tech_stack],
			proficiency_levels=proficiency_levels,
			infrastructure_match=infrastructure_score,
			tooling_availability=tooling_availability,
			integration_complexity=self._assess_integration_complexity(tech_stack)
		)
	
	async def _analyze_team_requirements(self, requirements: Dict[str, Any],
	                                     org_capabilities: OrganizationalCapabilities) -> TeamMatch:
		"""Analyze team composition and capacity requirements"""
		# Extract team requirements (would be more sophisticated in practice)
		required_roles = requirements.get('team', [])
		
		# Calculate available capacity by role
		available_capacity = {}
		for role, count in org_capabilities.team_composition.items():
			# Assume 80% capacity available for new projects
			available_capacity[role] = count * 0.8
		
		# Calculate skill coverage
		skill_coverage = {}
		for skill, level in org_capabilities.technical_skills.items():
			skill_coverage[skill] = min(level, 1.0)
		
		# Team size adequacy assessment
		total_required = len(required_roles)
		total_available = sum(org_capabilities.team_composition.values())
		team_size_match = min(total_available / max(total_required, 1), 1.0)
		
		return TeamMatch(
			required_roles=[str(role) for role in required_roles],
			available_capacity=available_capacity,
			skill_coverage=skill_coverage,
			team_size_match=team_size_match,
			leadership_match=0.9,  # Would be calculated based on leadership experience
			collaboration_score=0.85  # Would be calculated based on past performance
		)
	
	async def _analyze_compliance_requirements(self, requirements: Dict[str, Any],
	                                           org_capabilities: OrganizationalCapabilities) -> ComplianceMatch:
		"""Analyze compliance and regulatory requirements"""
		compliance_reqs = requirements.get('compliance', [])
		
		current_compliance = {}
		for req in compliance_reqs:
			req_str = str(req)
			# Check if we have compliance for this requirement
			is_compliant = any(
				await self.semantic_matcher.calculate_similarity(req_str, comp) > 0.8
				for comp in org_capabilities.compliance_status.keys()
			)
			current_compliance[req_str] = is_compliant
		
		# Identify certification gaps
		certification_gaps = [
			str(req) for req in compliance_reqs 
			if not current_compliance.get(str(req), False)
		]
		
		# Check security clearances
		clearance_holders = []
		for clearance_level, holders in org_capabilities.security_clearances.items():
			clearance_holders.extend(holders)
		
		return ComplianceMatch(
			regulatory_requirements=[str(req) for req in compliance_reqs],
			current_compliance=current_compliance,
			certification_gaps=certification_gaps,
			security_clearance="secret",  # Would be extracted from requirements
			clearance_holders=clearance_holders,
			compliance_timeline={gap: timedelta(days=120) for gap in certification_gaps}
		)
	
	def _calculate_overall_match_score(self, capability_matches: List[CapabilityMatch],
	                                   experience_matches: List[ExperienceMatch],
	                                   certification_matches: List[CertificationMatch],
	                                   technical_match: TechnicalMatch,
	                                   team_match: TeamMatch,
	                                   compliance_match: ComplianceMatch) -> float:
		"""Calculate weighted overall match score"""
		weights = {
			'capabilities': 0.25,
			'experience': 0.20,
			'certifications': 0.15,
			'technical': 0.20,
			'team': 0.10,
			'compliance': 0.10
		}
		
		# Capability score
		cap_score = sum(match.match_score for match in capability_matches) / max(len(capability_matches), 1)
		
		# Experience score
		exp_score = sum(min(match.years_available / max(match.years_required, 1), 1.0) * match.domain_match
		                for match in experience_matches) / max(len(experience_matches), 1)
		
		# Certification score
		cert_score = sum(1.0 if match.current_status == "held" else 0.0
		                 for match in certification_matches) / max(len(certification_matches), 1)
		
		# Technical score
		tech_score = (
			sum(technical_match.proficiency_levels.values()) / max(len(technical_match.proficiency_levels), 1) * 0.6 +
			technical_match.infrastructure_match * 0.4
		)
		
		# Team score
		team_score = (
			team_match.team_size_match * 0.4 +
			team_match.leadership_match * 0.3 +
			team_match.collaboration_score * 0.3
		)
		
		# Compliance score
		compliance_score = sum(compliance_match.current_compliance.values()) / max(len(compliance_match.current_compliance), 1)
		
		# Calculate weighted average
		overall_score = (
			cap_score * weights['capabilities'] +
			exp_score * weights['experience'] +
			cert_score * weights['certifications'] +
			tech_score * weights['technical'] +
			team_score * weights['team'] +
			compliance_score * weights['compliance']
		)
		
		return min(overall_score, 1.0)
	
	def _determine_qualification_level(self, overall_score: float) -> str:
		"""Determine qualification level based on overall score"""
		if overall_score >= 0.9:
			return "highly_qualified"
		elif overall_score >= 0.7:
			return "qualified"
		elif overall_score >= 0.5:
			return "partially_qualified"
		else:
			return "not_qualified"
	
	async def _identify_qualification_gaps(self, *match_results) -> List[QualificationGap]:
		"""Identify and prioritize qualification gaps"""
		gaps = []
		
		# Analyze capability gaps
		capability_matches = match_results[0]
		for match in capability_matches:
			if match.match_score < 0.7:
				gaps.append(QualificationGap(
					gap_type="capability",
					severity="major" if match.match_score < 0.5 else "minor",
					description=f"Limited capability in {match.capability_name}",
					impact="May impact technical delivery quality",
					remediation_plan="Hire specialist or provide training",
					timeline=timedelta(days=60),
					cost_estimate=50000.0,
					probability_of_success=0.8
				))
		
		# Analyze certification gaps
		certification_matches = match_results[2]
		for match in certification_matches:
			if match.current_status != "held" and match.is_required:
				gaps.append(QualificationGap(
					gap_type="certification",
					severity="critical" if match.is_required else "minor",
					description=f"Missing required certification: {match.certification_name}",
					impact="May disqualify from opportunity",
					remediation_plan="Obtain certification before proposal submission",
					timeline=match.acquisition_timeline or timedelta(days=90),
					cost_estimate=10000.0,
					probability_of_success=0.9
				))
		
		return sorted(gaps, key=lambda g: (g.severity == "critical", g.severity == "major"))
	
	def _identify_strengths(self, org_capabilities: OrganizationalCapabilities, 
	                        requirements: Dict[str, Any]) -> List[str]:
		"""Identify organizational strengths relevant to opportunity"""
		strengths = []
		
		# High proficiency capabilities
		for capability, level in org_capabilities.core_competencies.items():
			if level >= 0.8:
				strengths.append(f"Strong {capability} capabilities")
		
		# Extensive experience
		for domain, years in org_capabilities.industry_experience.items():
			if years >= 10:
				strengths.append(f"Extensive {years}-year experience in {domain}")
		
		# Strong team composition
		if sum(org_capabilities.team_composition.values()) >= 50:
			strengths.append("Large, experienced team with diverse skill sets")
		
		return strengths[:5]  # Return top 5 strengths
	
	def _identify_differentiators(self, org_capabilities: OrganizationalCapabilities,
	                              requirements: Dict[str, Any]) -> List[str]:
		"""Identify competitive differentiators"""
		differentiators = []
		
		# Unique partnerships
		if org_capabilities.partnerships:
			differentiators.append(f"Strategic partnerships with {', '.join(org_capabilities.partnerships[:3])}")
		
		# Advanced certifications
		advanced_certs = [cert for cert, holders in org_capabilities.certifications.items() 
		                  if holders and 'advanced' in cert.lower()]
		if advanced_certs:
			differentiators.append(f"Advanced certifications in {', '.join(advanced_certs[:2])}")
		
		# High security clearances
		high_clearances = [level for level, holders in org_capabilities.security_clearances.items()
		                   if holders and level.lower() in ['top_secret', 'secret']]
		if high_clearances:
			differentiators.append(f"Team members with {', '.join(high_clearances)} clearances")
		
		return differentiators
	
	def _calculate_win_probability(self, overall_score: float, gaps: List[QualificationGap],
	                               strengths: List[str], differentiators: List[str]) -> float:
		"""Calculate estimated win probability"""
		base_probability = overall_score * 0.6
		
		# Penalty for critical gaps
		critical_gap_penalty = sum(0.2 for gap in gaps if gap.severity == "critical")
		major_gap_penalty = sum(0.1 for gap in gaps if gap.severity == "major")
		
		# Bonus for strengths and differentiators
		strength_bonus = min(len(strengths) * 0.05, 0.2)
		differentiator_bonus = min(len(differentiators) * 0.08, 0.25)
		
		win_probability = (
			base_probability + 
			strength_bonus + 
			differentiator_bonus - 
			critical_gap_penalty - 
			major_gap_penalty
		)
		
		return max(0.0, min(win_probability, 1.0))
	
	def _calculate_confidence_level(self, overall_score: float, gaps: List[QualificationGap]) -> float:
		"""Calculate confidence level in the assessment"""
		# Higher confidence with more complete information
		base_confidence = 0.7
		
		# Increase confidence with higher scores (more data points align)
		score_confidence = overall_score * 0.2
		
		# Decrease confidence with many gaps (uncertainty in analysis)
		gap_uncertainty = min(len(gaps) * 0.05, 0.3)
		
		confidence = base_confidence + score_confidence - gap_uncertainty
		return max(0.5, min(confidence, 1.0))
	
	def _generate_recommendations(self, qualification_level: str, gaps: List[QualificationGap],
	                              strengths: List[str]) -> List[str]:
		"""Generate strategic recommendations"""
		recommendations = []
		
		if qualification_level == "highly_qualified":
			recommendations.append("Proceed with aggressive pursuit strategy")
			recommendations.append("Leverage key strengths in proposal positioning")
			recommendations.append("Consider premium pricing given strong qualification")
		
		elif qualification_level == "qualified":
			recommendations.append("Pursue opportunity with standard approach")
			recommendations.append("Address minor gaps proactively in proposal")
			recommendations.append("Highlight differentiators to stand out")
		
		elif qualification_level == "partially_qualified":
			recommendations.append("Consider teaming arrangements to fill gaps")
			recommendations.append("Focus on unique value propositions")
			recommendations.append("Address critical gaps before proposal submission")
		
		else:  # not_qualified
			recommendations.append("Recommend no-bid decision")
			recommendations.append("Consider opportunity for future after capability development")
		
		# Add gap-specific recommendations
		critical_gaps = [gap for gap in gaps if gap.severity == "critical"]
		if critical_gaps:
			recommendations.append(f"Must address {len(critical_gaps)} critical gaps to remain competitive")
		
		return recommendations
	
	def _generate_next_steps(self, qualification_level: str, gaps: List[QualificationGap]) -> List[str]:
		"""Generate specific next steps"""
		next_steps = []
		
		if qualification_level in ["highly_qualified", "qualified"]:
			next_steps.append("Begin proposal development immediately")
			next_steps.append("Assemble core proposal team")
			next_steps.append("Initiate customer engagement activities")
		
		elif qualification_level == "partially_qualified":
			next_steps.append("Evaluate teaming partner options")
			next_steps.append("Develop gap remediation timeline")
			next_steps.append("Assess cost-benefit of pursuing opportunity")
		
		else:
			next_steps.append("Document lessons learned for future opportunities")
			next_steps.append("Identify capability development priorities")
		
		# Add gap-specific next steps
		for gap in gaps[:3]:  # Top 3 gaps
			next_steps.append(f"Address {gap.gap_type} gap: {gap.remediation_plan}")
		
		return next_steps
	
	# Helper methods for various analysis components
	
	def _generate_capability_gap_analysis(self, capability: str, current_level: float, 
	                                       match_score: float) -> str:
		"""Generate capability gap analysis description"""
		if match_score >= 0.8:
			return f"Strong alignment with {capability} requirements"
		elif match_score >= 0.6:
			return f"Adequate {capability} capabilities with room for improvement"
		elif match_score >= 0.4:
			return f"Moderate {capability} gap requiring attention"
		else:
			return f"Significant {capability} gap requiring immediate action"
	
	def _level_to_string(self, level: float) -> str:
		"""Convert numeric level to string description"""
		if level >= 0.8:
			return "expert"
		elif level >= 0.6:
			return "proficient"
		elif level >= 0.4:
			return "intermediate"
		elif level >= 0.2:
			return "novice"
		else:
			return "none"
	
	def _generate_development_path(self, capability: str, current_level: float) -> Optional[str]:
		"""Generate development path for capability improvement"""
		if current_level >= 0.8:
			return None  # Already proficient
		
		paths = {
			'project_management': "Complete PMP certification and lead 2-3 complex projects",
			'software_development': "Enroll in advanced development bootcamp and complete portfolio projects",
			'cybersecurity': "Obtain security certifications and complete hands-on security training",
			'data_analytics': "Complete data science certification and work on real-world analytics projects"
		}
		
		return paths.get(capability, "Develop through training, certification, and practical experience")
	
	def _find_capability_evidence(self, capability: str, 
	                              org_capabilities: OrganizationalCapabilities) -> List[str]:
		"""Find evidence supporting capability claims"""
		evidence = []
		
		# Check past performance
		for project in org_capabilities.past_performance:
			if capability.lower() in project.get('description', '').lower():
				evidence.append(f"Successfully delivered {project.get('name', 'project')} involving {capability}")
		
		# Check certifications
		for cert, holders in org_capabilities.certifications.items():
			if capability.lower() in cert.lower() and holders:
				evidence.append(f"{len(holders)} team members certified in {cert}")
		
		return evidence[:3]  # Return top 3 pieces of evidence
	
	def _find_relevant_projects(self, domain: str, past_performance: List[Dict[str, Any]]) -> List[str]:
		"""Find relevant project examples from past performance"""
		relevant_projects = []
		
		for project in past_performance:
			if domain.lower() in project.get('description', '').lower():
				project_desc = f"{project.get('name', 'Unnamed project')} - {project.get('description', '')[:100]}..."
				relevant_projects.append(project_desc)
		
		return relevant_projects[:3]  # Return top 3 relevant projects
	
	def _find_experienced_team_members(self, domain: str, 
	                                   org_capabilities: OrganizationalCapabilities) -> List[str]:
		"""Find team members with experience in specific domain"""
		# This would be implemented with actual team member data
		# For now, return placeholder based on team composition
		experienced_members = []
		
		for role, count in org_capabilities.team_composition.items():
			if domain.lower() in role.lower():
				experienced_members.extend([f"{role}_{i+1}" for i in range(min(count, 3))])
		
		return experienced_members[:5]  # Return up to 5 team members
	
	def _assess_infrastructure_compatibility(self, tech_stack: List[str], 
	                                         infrastructure: Dict[str, Any]) -> float:
		"""Assess infrastructure compatibility with technical requirements"""
		if not tech_stack or not infrastructure:
			return 0.5  # Default neutral score
		
		compatibility_score = 0.0
		for tech in tech_stack:
			tech_str = str(tech).lower()
			
			# Check for cloud compatibility
			if 'cloud' in tech_str and infrastructure.get('cloud_platforms'):
				compatibility_score += 0.2
			
			# Check for specific platforms
			if any(platform in tech_str for platform in ['aws', 'azure', 'gcp']):
				if infrastructure.get('cloud_platforms'):
					compatibility_score += 0.3
			
			# Check for containerization
			if any(container in tech_str for container in ['docker', 'kubernetes']):
				if infrastructure.get('containerization'):
					compatibility_score += 0.2
		
		return min(compatibility_score / max(len(tech_stack), 1), 1.0)
	
	def _check_tooling_availability(self, tech: str, org_capabilities: OrganizationalCapabilities) -> bool:
		"""Check if required tooling is available"""
		# This would check against actual tooling inventory
		# For now, assume availability based on technical skills
		tech_str = str(tech).lower()
		
		for skill in org_capabilities.technical_skills.keys():
			if tech_str in skill.lower():
				return True
		
		return False  # Default to not available
	
	def _assess_integration_complexity(self, tech_stack: List[str]) -> str:
		"""Assess integration complexity of technology stack"""
		if len(tech_stack) <= 3:
			return "low"
		elif len(tech_stack) <= 6:
			return "medium"
		else:
			return "high"
	
	def _log_analysis_error(self, message: str) -> None:
		"""Log analysis errors"""
		# Would integrate with actual logging system
		logger.error(f"QualificationAnalyzer Error: {message}")


# Example usage and testing helpers
async def create_sample_qualification_analysis():
	"""Create sample qualification analysis for testing"""
	
	# Sample organizational capabilities
	org_caps = OrganizationalCapabilities(
		core_competencies={
			'software_development': 0.9,
			'project_management': 0.8,
			'cybersecurity': 0.7,
			'data_analytics': 0.6
		},
		technical_skills={
			'python': 0.9,
			'java': 0.8,
			'aws': 0.7,
			'docker': 0.6
		},
		industry_experience={
			'healthcare': 8,
			'finance': 12,
			'government': 5
		},
		certifications={
			'pmp': ['john_doe', 'jane_smith'],
			'aws_certified': ['bob_wilson'],
			'cissp': ['alice_brown']
		},
		team_composition={
			'senior_developer': 10,
			'project_manager': 3,
			'security_analyst': 2,
			'data_scientist': 4
		}
	)
	
	# Sample opportunity data
	opportunity = OpportunityData(
		id="test_opportunity_001",
		title="Healthcare Data Analytics Platform",
		description="Develop secure healthcare analytics platform",
		requirements="5+ years healthcare experience, PMP certification preferred, Python/AWS required",
		estimated_value=2500000.0,
		submission_deadline=datetime.now() + timedelta(days=45)
	)
	
	analyzer = QualificationAnalyzer()
	assessment = await analyzer.analyze_qualification(opportunity, org_caps)
	
	return assessment


if __name__ == "__main__":
	# Test the qualification analyzer
	import asyncio
	
	async def main():
		assessment = await create_sample_qualification_analysis()
		logger.info(f"Qualification Level: {assessment.qualification_level}")
		logger.info(f"Overall Match Score: {assessment.overall_match_score:.2f}")
		logger.info(f"Win Probability: {assessment.win_probability:.2f}")
		logger.info(f"Number of Gaps: {len(assessment.qualification_gaps)}")
		
	asyncio.run(main())