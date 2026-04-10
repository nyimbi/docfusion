"""
Capability Matcher for Semantic Matching

This module provides advanced semantic matching capabilities to align
organizational competencies with opportunity requirements using NLP
and machine learning techniques.
"""

import asyncio
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4

import numpy as np
from pydantic import BaseModel, Field, ConfigDict, validator
from pydantic.dataclasses import dataclass as pydantic_dataclass
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans

from ...core.models.base import BaseEntity
from ...nlp.services.text_analyzer import TextAnalyzer
from ...nlp.services.semantic_matcher import SemanticMatcher


class CapabilityDefinition(BaseModel):
	"""Standardized capability definition"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	name: str = Field(description="Canonical capability name")
	category: str = Field(description="Capability category (technical, domain, process)")
	description: str = Field(description="Detailed capability description")
	synonyms: List[str] = Field(default_factory=list, description="Alternative names and synonyms")
	related_skills: List[str] = Field(default_factory=list, description="Related technical skills")
	industry_relevance: Dict[str, float] = Field(default_factory=dict, description="Relevance by industry")
	complexity_level: str = Field(description="Complexity level (basic, intermediate, advanced, expert)")
	measurable_outcomes: List[str] = Field(default_factory=list, description="Measurable success criteria")
	typical_evidence: List[str] = Field(default_factory=list, description="Typical evidence types")


class RequirementProfile(BaseModel):
	"""Parsed requirement profile from opportunity"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	raw_text: str = Field(description="Original requirement text")
	extracted_capabilities: List[str] = Field(description="Extracted capability keywords")
	required_experience: Dict[str, int] = Field(default_factory=dict, description="Experience requirements by area")
	technical_skills: List[str] = Field(default_factory=list, description="Technical skill requirements")
	certifications: List[str] = Field(default_factory=list, description="Required certifications")
	industry_context: List[str] = Field(default_factory=list, description="Industry-specific context")
	priority_level: str = Field(description="Requirement priority (must_have, preferred, nice_to_have)")
	confidence_score: float = Field(ge=0.0, le=1.0, description="Extraction confidence")


class CapabilityMatch(BaseModel):
	"""Individual capability matching result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	requirement_text: str = Field(description="Original requirement text")
	matched_capability: str = Field(description="Matched organizational capability")
	similarity_score: float = Field(ge=0.0, le=1.0, description="Semantic similarity score")
	context_relevance: float = Field(ge=0.0, le=1.0, description="Context relevance score")
	evidence_strength: float = Field(ge=0.0, le=1.0, description="Evidence strength score")
	
	match_type: str = Field(description="Match type (exact, semantic, contextual)")
	match_explanation: str = Field(description="Human-readable match explanation")
	confidence_level: float = Field(ge=0.0, le=1.0, description="Overall match confidence")
	
	supporting_evidence: List[str] = Field(default_factory=list, description="Supporting evidence")
	alternative_matches: List[Tuple[str, float]] = Field(default_factory=list, description="Alternative capability matches")


class MatchingStrategy(BaseModel):
	"""Matching strategy configuration"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity threshold")
	context_weight: float = Field(default=0.3, ge=0.0, le=1.0, description="Context relevance weight")
	evidence_weight: float = Field(default=0.2, ge=0.0, le=1.0, description="Evidence strength weight")
	semantic_weight: float = Field(default=0.5, ge=0.0, le=1.0, description="Semantic similarity weight")
	
	use_fuzzy_matching: bool = Field(default=True, description="Enable fuzzy string matching")
	use_contextual_embedding: bool = Field(default=True, description="Use contextual embeddings")
	use_industry_weighting: bool = Field(default=True, description="Apply industry-specific weighting")
	
	max_alternatives: int = Field(default=3, ge=1, description="Maximum alternative matches to return")


class CapabilityCluster(BaseModel):
	"""Clustered capability group"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	cluster_id: str = Field(description="Unique cluster identifier")
	cluster_name: str = Field(description="Human-readable cluster name")
	core_capabilities: List[str] = Field(description="Core capabilities in cluster")
	related_capabilities: List[str] = Field(description="Related capabilities")
	cluster_centroid: List[float] = Field(description="Cluster centroid vector")
	coherence_score: float = Field(ge=0.0, le=1.0, description="Cluster coherence measure")


class MatchingResults(BaseModel):
	"""Complete matching results"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	total_requirements: int = Field(description="Total number of requirements analyzed")
	matched_requirements: int = Field(description="Number of successfully matched requirements")
	
	capability_matches: List[CapabilityMatch] = Field(description="Individual capability matches")
	unmatched_requirements: List[str] = Field(description="Requirements without matches")
	
	overall_match_score: float = Field(ge=0.0, le=1.0, description="Overall matching score")
	coverage_percentage: float = Field(ge=0.0, le=100.0, description="Requirement coverage percentage")
	
	strong_matches: List[CapabilityMatch] = Field(description="High-confidence matches")
	weak_matches: List[CapabilityMatch] = Field(description="Low-confidence matches")
	suggested_improvements: List[str] = Field(description="Capability improvement suggestions")
	
	matching_timestamp: datetime = Field(default_factory=datetime.now)
	strategy_used: MatchingStrategy = Field(description="Strategy configuration used")


@pydantic_dataclass
class CapabilityKnowledgeBase:
	"""Comprehensive capability knowledge base"""
	
	capability_definitions: Dict[str, CapabilityDefinition] = field(default_factory=dict)
	capability_taxonomy: Dict[str, List[str]] = field(default_factory=dict)
	synonym_mapping: Dict[str, str] = field(default_factory=dict)
	skill_relationships: Dict[str, List[str]] = field(default_factory=dict)
	industry_mappings: Dict[str, Dict[str, float]] = field(default_factory=dict)
	capability_clusters: List[CapabilityCluster] = field(default_factory=list)


class CapabilityMatcher:
	"""
	Advanced capability matcher using semantic analysis and machine learning
	
	Provides sophisticated matching between opportunity requirements and
	organizational capabilities using multiple matching strategies and
	confidence scoring.
	"""
	
	def __init__(self, 
	             text_analyzer: Optional[TextAnalyzer] = None,
	             semantic_matcher: Optional[SemanticMatcher] = None,
	             knowledge_base: Optional[CapabilityKnowledgeBase] = None):
		self.text_analyzer = text_analyzer or TextAnalyzer()
		self.semantic_matcher = semantic_matcher or SemanticMatcher()
		self.knowledge_base = knowledge_base or self._initialize_knowledge_base()
		
		# Initialize ML components
		self.tfidf_vectorizer = TfidfVectorizer(
			max_features=5000,
			stop_words='english',
			ngram_range=(1, 3),
			lowercase=True
		)
		
		self._capability_embeddings = {}
		self._is_trained = False
		
		# Initialize pattern libraries
		self._capability_patterns = self._initialize_capability_patterns()
		self._skill_patterns = self._initialize_skill_patterns()
		self._experience_patterns = self._initialize_experience_patterns()
	
	def _initialize_knowledge_base(self) -> CapabilityKnowledgeBase:
		"""Initialize comprehensive capability knowledge base"""
		
		# Core capability definitions
		capability_definitions = {
			'software_development': CapabilityDefinition(
				name='software_development',
				category='technical',
				description='Design, develop, test, and maintain software applications',
				synonyms=['software engineering', 'application development', 'coding', 'programming'],
				related_skills=['python', 'java', 'javascript', 'git', 'testing'],
				industry_relevance={'technology': 1.0, 'finance': 0.8, 'healthcare': 0.7},
				complexity_level='intermediate',
				measurable_outcomes=['deployed applications', 'code quality metrics', 'user adoption'],
				typical_evidence=['github portfolio', 'deployed systems', 'technical certifications']
			),
			'project_management': CapabilityDefinition(
				name='project_management',
				category='process',
				description='Plan, execute, and deliver projects on time and within budget',
				synonyms=['program management', 'project coordination', 'delivery management'],
				related_skills=['planning', 'scheduling', 'risk management', 'stakeholder management'],
				industry_relevance={'construction': 1.0, 'consulting': 0.9, 'technology': 0.8},
				complexity_level='intermediate',
				measurable_outcomes=['on-time delivery', 'budget adherence', 'stakeholder satisfaction'],
				typical_evidence=['pmp certification', 'project portfolios', 'success metrics']
			),
			'data_analytics': CapabilityDefinition(
				name='data_analytics',
				category='technical',
				description='Analyze data to extract insights and support decision-making',
				synonyms=['data analysis', 'business intelligence', 'data science'],
				related_skills=['sql', 'python', 'tableau', 'statistics', 'machine learning'],
				industry_relevance={'finance': 1.0, 'healthcare': 0.9, 'retail': 0.8},
				complexity_level='advanced',
				measurable_outcomes=['actionable insights', 'model accuracy', 'business impact'],
				typical_evidence=['analytics dashboards', 'predictive models', 'data certifications']
			),
			'cybersecurity': CapabilityDefinition(
				name='cybersecurity',
				category='technical',
				description='Protect systems and data from cyber threats and vulnerabilities',
				synonyms=['information security', 'security engineering', 'cyber defense'],
				related_skills=['penetration testing', 'vulnerability assessment', 'incident response'],
				industry_relevance={'government': 1.0, 'finance': 0.9, 'healthcare': 0.8},
				complexity_level='advanced',
				measurable_outcomes=['security incidents prevented', 'compliance rates', 'risk reduction'],
				typical_evidence=['security certifications', 'security assessments', 'incident reports']
			),
			'cloud_computing': CapabilityDefinition(
				name='cloud_computing',
				category='technical',
				description='Design and manage cloud-based infrastructure and services',
				synonyms=['cloud architecture', 'cloud engineering', 'cloud services'],
				related_skills=['aws', 'azure', 'gcp', 'terraform', 'kubernetes'],
				industry_relevance={'technology': 1.0, 'finance': 0.8, 'healthcare': 0.7},
				complexity_level='advanced',
				measurable_outcomes=['system uptime', 'cost optimization', 'scalability metrics'],
				typical_evidence=['cloud certifications', 'infrastructure deployments', 'cost savings']
			)
		}
		
		# Capability taxonomy
		taxonomy = {
			'technical': ['software_development', 'data_analytics', 'cybersecurity', 'cloud_computing'],
			'process': ['project_management', 'quality_assurance', 'change_management'],
			'domain': ['healthcare_expertise', 'financial_services', 'government_contracting']
		}
		
		# Synonym mapping for fast lookup
		synonym_mapping = {}
		for cap_name, definition in capability_definitions.items():
			for synonym in definition.synonyms:
				synonym_mapping[synonym.lower()] = cap_name
		
		return CapabilityKnowledgeBase(
			capability_definitions=capability_definitions,
			capability_taxonomy=taxonomy,
			synonym_mapping=synonym_mapping,
			skill_relationships={},
			industry_mappings={}
		)
	
	def _initialize_capability_patterns(self) -> Dict[str, List[str]]:
		"""Initialize capability detection patterns"""
		return {
			'development': [
				r'software\s+development',
				r'application\s+development',
				r'web\s+development',
				r'full\s+stack',
				r'backend\s+development',
				r'frontend\s+development'
			],
			'management': [
				r'project\s+management',
				r'program\s+management',
				r'portfolio\s+management',
				r'delivery\s+management',
				r'stakeholder\s+management'
			],
			'analytics': [
				r'data\s+analytics',
				r'business\s+intelligence',
				r'data\s+science',
				r'machine\s+learning',
				r'predictive\s+analytics'
			],
			'security': [
				r'cybersecurity',
				r'information\s+security',
				r'security\s+architecture',
				r'penetration\s+testing',
				r'vulnerability\s+assessment'
			],
			'cloud': [
				r'cloud\s+computing',
				r'cloud\s+architecture',
				r'cloud\s+migration',
				r'devops',
				r'containerization'
			]
		}
	
	def _initialize_skill_patterns(self) -> Dict[str, List[str]]:
		"""Initialize technical skill patterns"""
		return {
			'programming': [
				r'python\b', r'java\b', r'javascript\b', r'c\+\+\b', r'c#\b',
				r'ruby\b', r'php\b', r'go\b', r'rust\b', r'scala\b'
			],
			'databases': [
				r'sql\b', r'mysql\b', r'postgresql\b', r'mongodb\b', r'oracle\b',
				r'redis\b', r'elasticsearch\b', r'cassandra\b'
			],
			'frameworks': [
				r'react\b', r'angular\b', r'vue\.js\b', r'django\b', r'flask\b',
				r'spring\b', r'node\.js\b', r'express\b'
			],
			'cloud_platforms': [
				r'aws\b', r'azure\b', r'gcp\b', r'google\s+cloud\b',
				r'amazon\s+web\s+services\b'
			],
			'tools': [
				r'git\b', r'docker\b', r'kubernetes\b', r'jenkins\b', r'terraform\b',
				r'ansible\b', r'chef\b', r'puppet\b'
			]
		}
	
	def _initialize_experience_patterns(self) -> Dict[str, List[str]]:
		"""Initialize experience requirement patterns"""
		return {
			'years': [
				r'(\d+)\+?\s*years?\s*of?\s*experience',
				r'minimum\s*(\d+)\s*years?',
				r'at\s*least\s*(\d+)\s*years?'
			],
			'level': [
				r'senior\s+level',
				r'junior\s+level',
				r'mid\s+level',
				r'expert\s+level',
				r'beginner'
			]
		}
	
	async def train_matcher(self, training_data: List[Dict[str, Any]]) -> None:
		"""Train the matcher with historical data"""
		try:
			# Extract capability texts for TF-IDF training
			capability_texts = []
			for cap_name, definition in self.knowledge_base.capability_definitions.items():
				text = f"{definition.name} {definition.description} {' '.join(definition.synonyms)}"
				capability_texts.append(text)
			
			# Train TF-IDF vectorizer
			self.tfidf_vectorizer.fit(capability_texts)
			
			# Generate capability embeddings
			capability_vectors = self.tfidf_vectorizer.transform(capability_texts)
			
			for i, (cap_name, _) in enumerate(self.knowledge_base.capability_definitions.items()):
				self._capability_embeddings[cap_name] = capability_vectors[i].toarray().flatten()
			
			# Cluster capabilities for better organization
			if len(self._capability_embeddings) > 3:
				await self._cluster_capabilities()
			
			self._is_trained = True
			self._log_training_complete(len(capability_texts))
			
		except Exception as e:
			self._log_training_error(f"Training failed: {str(e)}")
			raise
	
	async def match_capabilities(self, 
	                             requirements: List[str],
	                             organizational_capabilities: Dict[str, float],
	                             opportunity_context: Optional[Dict[str, Any]] = None,
	                             strategy: Optional[MatchingStrategy] = None) -> MatchingResults:
		"""
		Perform comprehensive capability matching
		
		Args:
			requirements: List of requirement texts to match
			organizational_capabilities: Dict of org capabilities with proficiency scores
			opportunity_context: Additional context about the opportunity
			strategy: Matching strategy configuration
			
		Returns:
			Complete matching results with scores and recommendations
		"""
		try:
			if not self._is_trained:
				await self.train_matcher([])  # Train with default data
			
			strategy = strategy or MatchingStrategy()
			
			# Parse requirements into structured profiles
			requirement_profiles = await self._parse_requirements(requirements)
			
			# Perform matching for each requirement
			all_matches = []
			unmatched = []
			
			for req_profile in requirement_profiles:
				matches = await self._match_single_requirement(
					req_profile, organizational_capabilities, opportunity_context, strategy
				)
				
				if matches:
					all_matches.extend(matches)
				else:
					unmatched.append(req_profile.raw_text)
			
			# Analyze and categorize matches
			strong_matches = [match for match in all_matches if match.confidence_level >= 0.8]
			weak_matches = [match for match in all_matches if match.confidence_level < 0.6]
			
			# Calculate overall scores
			overall_score = self._calculate_overall_match_score(all_matches)
			coverage_percentage = ((len(requirements) - len(unmatched)) / max(len(requirements), 1)) * 100
			
			# Generate improvement suggestions
			suggestions = self._generate_improvement_suggestions(
				unmatched, weak_matches, organizational_capabilities
			)
			
			return MatchingResults(
				opportunity_id=opportunity_context.get('opportunity_id', 'unknown') if opportunity_context else 'unknown',
				total_requirements=len(requirements),
				matched_requirements=len(all_matches),
				capability_matches=all_matches,
				unmatched_requirements=unmatched,
				overall_match_score=overall_score,
				coverage_percentage=coverage_percentage,
				strong_matches=strong_matches,
				weak_matches=weak_matches,
				suggested_improvements=suggestions,
				strategy_used=strategy
			)
			
		except Exception as e:
			self._log_matching_error(f"Capability matching failed: {str(e)}")
			raise
	
	async def _parse_requirements(self, requirements: List[str]) -> List[RequirementProfile]:
		"""Parse raw requirements into structured profiles"""
		profiles = []
		
		for req_text in requirements:
			# Extract capabilities using patterns
			extracted_capabilities = []
			for category, patterns in self._capability_patterns.items():
				for pattern in patterns:
					matches = re.findall(pattern, req_text, re.IGNORECASE)
					extracted_capabilities.extend(matches)
			
			# Extract technical skills
			technical_skills = []
			for category, patterns in self._skill_patterns.items():
				for pattern in patterns:
					matches = re.findall(pattern, req_text, re.IGNORECASE)
					technical_skills.extend(matches)
			
			# Extract experience requirements
			required_experience = {}
			for pattern in self._experience_patterns['years']:
				matches = re.findall(pattern, req_text, re.IGNORECASE)
				for match in matches:
					try:
						years = int(match)
						required_experience['general'] = years
					except ValueError:
						continue
			
			# Extract certifications (basic pattern matching)
			certifications = re.findall(
				r'([A-Z]{2,6})\s*certified|certification\s*in\s*([^.]+)',
				req_text, re.IGNORECASE
			)
			cert_list = [cert[0] or cert[1] for cert in certifications]
			
			# Determine priority level
			priority = self._determine_priority_level(req_text)
			
			# Calculate extraction confidence
			confidence = self._calculate_extraction_confidence(
				req_text, extracted_capabilities, technical_skills, cert_list
			)
			
			profiles.append(RequirementProfile(
				raw_text=req_text,
				extracted_capabilities=extracted_capabilities,
				required_experience=required_experience,
				technical_skills=technical_skills,
				certifications=cert_list,
				industry_context=[],  # Would be enhanced with NLP
				priority_level=priority,
				confidence_score=confidence
			))
		
		return profiles
	
	async def _match_single_requirement(self, 
	                                    req_profile: RequirementProfile,
	                                    org_capabilities: Dict[str, float],
	                                    context: Optional[Dict[str, Any]],
	                                    strategy: MatchingStrategy) -> List[CapabilityMatch]:
		"""Match a single requirement against organizational capabilities"""
		matches = []
		
		# Primary matching: extracted capabilities
		for capability in req_profile.extracted_capabilities:
			capability_matches = await self._find_capability_matches(
				capability, org_capabilities, context, strategy
			)
			matches.extend(capability_matches)
		
		# Secondary matching: technical skills
		for skill in req_profile.technical_skills:
			skill_matches = await self._find_skill_matches(
				skill, org_capabilities, context, strategy
			)
			matches.extend(skill_matches)
		
		# Semantic matching for unstructured text
		if not matches or all(match.confidence_level < 0.6 for match in matches):
			semantic_matches = await self._perform_semantic_matching(
				req_profile.raw_text, org_capabilities, context, strategy
			)
			matches.extend(semantic_matches)
		
		# Filter and rank matches
		filtered_matches = self._filter_and_rank_matches(matches, strategy)
		
		return filtered_matches
	
	async def _find_capability_matches(self, 
	                                   capability: str,
	                                   org_capabilities: Dict[str, float],
	                                   context: Optional[Dict[str, Any]],
	                                   strategy: MatchingStrategy) -> List[CapabilityMatch]:
		"""Find matches for a specific capability"""
		matches = []
		capability_lower = capability.lower()
		
		# Direct synonym matching
		if capability_lower in self.knowledge_base.synonym_mapping:
			canonical_name = self.knowledge_base.synonym_mapping[capability_lower]
			if canonical_name in org_capabilities:
				proficiency = org_capabilities[canonical_name]
				
				matches.append(CapabilityMatch(
					requirement_text=capability,
					matched_capability=canonical_name,
					similarity_score=1.0,  # Exact match
					context_relevance=self._calculate_context_relevance(canonical_name, context),
					evidence_strength=proficiency,
					match_type='exact',
					match_explanation=f"Direct match via synonym mapping",
					confidence_level=min(proficiency + 0.2, 1.0),
					supporting_evidence=self._find_supporting_evidence(canonical_name),
					alternative_matches=[]
				))
		
		# Semantic similarity matching
		for org_cap, proficiency in org_capabilities.items():
			if org_cap in self.knowledge_base.capability_definitions:
				similarity = await self.semantic_matcher.calculate_similarity(
					capability, self.knowledge_base.capability_definitions[org_cap].description
				)
				
				if similarity >= strategy.similarity_threshold:
					context_relevance = self._calculate_context_relevance(org_cap, context)
					
					# Calculate weighted confidence
					confidence = (
						similarity * strategy.semantic_weight +
						context_relevance * strategy.context_weight +
						proficiency * strategy.evidence_weight
					)
					
					matches.append(CapabilityMatch(
						requirement_text=capability,
						matched_capability=org_cap,
						similarity_score=similarity,
						context_relevance=context_relevance,
						evidence_strength=proficiency,
						match_type='semantic',
						match_explanation=f"Semantic similarity match ({similarity:.2f})",
						confidence_level=confidence,
						supporting_evidence=self._find_supporting_evidence(org_cap),
						alternative_matches=[]
					))
		
		return matches
	
	async def _find_skill_matches(self,
	                              skill: str,
	                              org_capabilities: Dict[str, float],
	                              context: Optional[Dict[str, Any]],
	                              strategy: MatchingStrategy) -> List[CapabilityMatch]:
		"""Find matches for technical skills"""
		matches = []
		skill_lower = skill.lower()
		
		# Direct skill matching
		for org_cap, proficiency in org_capabilities.items():
			if skill_lower in org_cap.lower():
				matches.append(CapabilityMatch(
					requirement_text=skill,
					matched_capability=org_cap,
					similarity_score=0.9,  # High similarity for direct skill match
					context_relevance=self._calculate_context_relevance(org_cap, context),
					evidence_strength=proficiency,
					match_type='exact',
					match_explanation=f"Direct skill match",
					confidence_level=min(proficiency + 0.1, 1.0),
					supporting_evidence=self._find_supporting_evidence(org_cap),
					alternative_matches=[]
				))
		
		# Related skill matching through capability definitions
		for cap_name, definition in self.knowledge_base.capability_definitions.items():
			if skill_lower in [s.lower() for s in definition.related_skills]:
				if cap_name in org_capabilities:
					proficiency = org_capabilities[cap_name]
					
					matches.append(CapabilityMatch(
						requirement_text=skill,
						matched_capability=cap_name,
						similarity_score=0.8,  # Good similarity for related skill
						context_relevance=self._calculate_context_relevance(cap_name, context),
						evidence_strength=proficiency,
						match_type='contextual',
						match_explanation=f"Related skill under {cap_name} capability",
						confidence_level=min(proficiency, 1.0),
						supporting_evidence=self._find_supporting_evidence(cap_name),
						alternative_matches=[]
					))
		
		return matches
	
	async def _perform_semantic_matching(self,
	                                     requirement_text: str,
	                                     org_capabilities: Dict[str, float],
	                                     context: Optional[Dict[str, Any]],
	                                     strategy: MatchingStrategy) -> List[CapabilityMatch]:
		"""Perform deep semantic matching using embeddings"""
		matches = []
		
		if not self._is_trained:
			return matches
		
		# Vectorize the requirement text
		req_vector = self.tfidf_vectorizer.transform([requirement_text])
		req_array = req_vector.toarray().flatten()
		
		# Compare against all capability embeddings
		for cap_name, cap_embedding in self._capability_embeddings.items():
			if cap_name in org_capabilities:
				# Calculate cosine similarity
				similarity = cosine_similarity(
					req_array.reshape(1, -1),
					cap_embedding.reshape(1, -1)
				)[0][0]
				
				if similarity >= strategy.similarity_threshold:
					proficiency = org_capabilities[cap_name]
					context_relevance = self._calculate_context_relevance(cap_name, context)
					
					confidence = (
						similarity * strategy.semantic_weight +
						context_relevance * strategy.context_weight +
						proficiency * strategy.evidence_weight
					)
					
					matches.append(CapabilityMatch(
						requirement_text=requirement_text,
						matched_capability=cap_name,
						similarity_score=similarity,
						context_relevance=context_relevance,
						evidence_strength=proficiency,
						match_type='semantic',
						match_explanation=f"Deep semantic embedding match ({similarity:.3f})",
						confidence_level=confidence,
						supporting_evidence=self._find_supporting_evidence(cap_name),
						alternative_matches=[]
					))
		
		return sorted(matches, key=lambda x: x.confidence_level, reverse=True)
	
	def _filter_and_rank_matches(self, matches: List[CapabilityMatch], 
	                             strategy: MatchingStrategy) -> List[CapabilityMatch]:
		"""Filter and rank matches by confidence and relevance"""
		# Remove duplicates (same capability matched multiple times)
		seen_capabilities = set()
		unique_matches = []
		
		for match in sorted(matches, key=lambda x: x.confidence_level, reverse=True):
			if match.matched_capability not in seen_capabilities:
				unique_matches.append(match)
				seen_capabilities.add(match.matched_capability)
			else:
				# Add as alternative match to existing entry
				for existing_match in unique_matches:
					if existing_match.matched_capability == match.matched_capability:
						existing_match.alternative_matches.append(
							(match.requirement_text, match.confidence_level)
						)
						break
		
		# Limit to top matches
		return unique_matches[:strategy.max_alternatives]
	
	def _calculate_context_relevance(self, capability: str, 
	                                 context: Optional[Dict[str, Any]]) -> float:
		"""Calculate context relevance score"""
		if not context:
			return 0.5  # Neutral relevance
		
		relevance_score = 0.5
		
		# Industry relevance
		if 'industry' in context and capability in self.knowledge_base.capability_definitions:
			industry = context['industry']
			definition = self.knowledge_base.capability_definitions[capability]
			
			if industry in definition.industry_relevance:
				relevance_score = definition.industry_relevance[industry]
		
		# Opportunity type relevance
		if 'opportunity_type' in context:
			opp_type = context['opportunity_type'].lower()
			if 'technical' in opp_type and capability in ['software_development', 'data_analytics']:
				relevance_score += 0.2
			elif 'management' in opp_type and capability == 'project_management':
				relevance_score += 0.3
		
		return min(relevance_score, 1.0)
	
	def _find_supporting_evidence(self, capability: str) -> List[str]:
		"""Find supporting evidence for capability claims"""
		evidence = []
		
		if capability in self.knowledge_base.capability_definitions:
			definition = self.knowledge_base.capability_definitions[capability]
			evidence.extend(definition.typical_evidence[:3])
		
		# Add generic evidence types
		evidence.extend([
			f"Team expertise in {capability}",
			f"Previous {capability} projects",
			f"Relevant {capability} certifications"
		])
		
		return evidence[:3]
	
	def _determine_priority_level(self, requirement_text: str) -> str:
		"""Determine requirement priority level"""
		text_lower = requirement_text.lower()
		
		if any(word in text_lower for word in ['must', 'required', 'mandatory', 'essential']):
			return 'must_have'
		elif any(word in text_lower for word in ['preferred', 'desired', 'nice']):
			return 'nice_to_have'
		else:
			return 'preferred'
	
	def _calculate_extraction_confidence(self, text: str, capabilities: List[str],
	                                     skills: List[str], certifications: List[str]) -> float:
		"""Calculate confidence in requirement extraction"""
		base_confidence = 0.5
		
		# Increase confidence with more extracted elements
		if capabilities:
			base_confidence += 0.2
		if skills:
			base_confidence += 0.2
		if certifications:
			base_confidence += 0.1
		
		# Text clarity indicators
		if len(text.split()) > 5:  # Detailed requirements
			base_confidence += 0.1
		
		return min(base_confidence, 1.0)
	
	def _calculate_overall_match_score(self, matches: List[CapabilityMatch]) -> float:
		"""Calculate overall matching score"""
		if not matches:
			return 0.0
		
		# Weighted average of confidence levels
		total_confidence = sum(match.confidence_level for match in matches)
		return min(total_confidence / len(matches), 1.0)
	
	def _generate_improvement_suggestions(self, unmatched: List[str],
	                                      weak_matches: List[CapabilityMatch],
	                                      org_capabilities: Dict[str, float]) -> List[str]:
		"""Generate capability improvement suggestions"""
		suggestions = []
		
		# Suggestions for unmatched requirements
		for req in unmatched[:3]:  # Top 3 unmatched
			suggestions.append(f"Develop capability for: {req}")
		
		# Suggestions for weak matches
		for match in weak_matches[:2]:  # Top 2 weak matches
			if match.evidence_strength < 0.5:
				suggestions.append(f"Strengthen {match.matched_capability} through training or hiring")
		
		# General capability gaps
		core_capabilities = ['software_development', 'project_management', 'cybersecurity']
		for cap in core_capabilities:
			if cap not in org_capabilities or org_capabilities[cap] < 0.6:
				suggestions.append(f"Invest in {cap} capability development")
		
		return suggestions[:5]  # Return top 5 suggestions
	
	async def _cluster_capabilities(self) -> None:
		"""Cluster capabilities for better organization"""
		try:
			# Prepare embedding matrix
			embeddings = list(self._capability_embeddings.values())
			capability_names = list(self._capability_embeddings.keys())
			
			if len(embeddings) < 3:
				return
			
			# Perform k-means clustering
			n_clusters = min(3, len(embeddings))  # Max 3 clusters
			kmeans = KMeans(n_clusters=n_clusters, random_state=42)
			cluster_labels = kmeans.fit_predict(embeddings)
			
			# Create capability clusters
			clusters = {}
			for i, label in enumerate(cluster_labels):
				if label not in clusters:
					clusters[label] = []
				clusters[label].append(capability_names[i])
			
			# Convert to CapabilityCluster objects
			capability_clusters = []
			for cluster_id, capabilities in clusters.items():
				cluster_name = self._generate_cluster_name(capabilities)
				centroid = kmeans.cluster_centers_[cluster_id].tolist()
				coherence = self._calculate_cluster_coherence(capabilities, embeddings, cluster_labels, cluster_id)
				
				capability_clusters.append(CapabilityCluster(
					cluster_id=f"cluster_{cluster_id}",
					cluster_name=cluster_name,
					core_capabilities=capabilities,
					related_capabilities=[],  # Could be populated with related caps
					cluster_centroid=centroid,
					coherence_score=coherence
				))
			
			self.knowledge_base.capability_clusters = capability_clusters
			self._log_clustering_complete(len(capability_clusters))
			
		except Exception as e:
			self._log_clustering_error(f"Clustering failed: {str(e)}")
	
	def _generate_cluster_name(self, capabilities: List[str]) -> str:
		"""Generate human-readable cluster name"""
		# Simple heuristic based on common themes
		if any('software' in cap or 'development' in cap for cap in capabilities):
			return "Software Development"
		elif any('data' in cap or 'analytics' in cap for cap in capabilities):
			return "Data & Analytics"
		elif any('security' in cap or 'cyber' in cap for cap in capabilities):
			return "Security & Compliance"
		elif any('management' in cap or 'project' in cap for cap in capabilities):
			return "Management & Leadership"
		else:
			return f"Cluster {capabilities[0].title()}"
	
	def _calculate_cluster_coherence(self, capabilities: List[str], embeddings: List,
	                                 labels: List[int], cluster_id: int) -> float:
		"""Calculate cluster coherence score"""
		cluster_embeddings = [embeddings[i] for i, label in enumerate(labels) if label == cluster_id]
		
		if len(cluster_embeddings) < 2:
			return 1.0  # Single item clusters are perfectly coherent
		
		# Calculate average pairwise similarity within cluster
		similarities = []
		for i in range(len(cluster_embeddings)):
			for j in range(i + 1, len(cluster_embeddings)):
				sim = cosine_similarity(
					np.array(cluster_embeddings[i]).reshape(1, -1),
					np.array(cluster_embeddings[j]).reshape(1, -1)
				)[0][0]
				similarities.append(sim)
		
		return np.mean(similarities) if similarities else 0.0
	
	# Logging methods
	
	def _log_training_complete(self, num_capabilities: int) -> None:
		"""Log training completion"""
		print(f"CapabilityMatcher: Training completed with {num_capabilities} capabilities")
	
	def _log_training_error(self, message: str) -> None:
		"""Log training errors"""
		print(f"CapabilityMatcher Training Error: {message}")
	
	def _log_matching_error(self, message: str) -> None:
		"""Log matching errors"""
		print(f"CapabilityMatcher Matching Error: {message}")
	
	def _log_clustering_complete(self, num_clusters: int) -> None:
		"""Log clustering completion"""
		print(f"CapabilityMatcher: Clustering completed with {num_clusters} clusters")
	
	def _log_clustering_error(self, message: str) -> None:
		"""Log clustering errors"""
		print(f"CapabilityMatcher Clustering Error: {message}")


# Example usage and testing
async def create_sample_capability_matching():
	"""Create sample capability matching for testing"""
	
	# Sample requirements
	requirements = [
		"5+ years of Python development experience",
		"Project management certification (PMP preferred)",
		"Experience with AWS cloud platforms",
		"Data analytics and machine learning expertise",
		"Cybersecurity knowledge with penetration testing experience"
	]
	
	# Sample organizational capabilities
	org_capabilities = {
		'software_development': 0.9,
		'python': 0.85,
		'project_management': 0.7,
		'cloud_computing': 0.8,
		'aws': 0.75,
		'data_analytics': 0.6,
		'machine_learning': 0.5,
		'cybersecurity': 0.4
	}
	
	# Opportunity context
	context = {
		'opportunity_id': 'test_opp_001',
		'industry': 'technology',
		'opportunity_type': 'technical development'
	}
	
	# Initialize and run matcher
	matcher = CapabilityMatcher()
	results = await matcher.match_capabilities(
		requirements, org_capabilities, context
	)
	
	return results


if __name__ == "__main__":
	# Test the capability matcher
	import asyncio
	
	async def main():
		results = await create_sample_capability_matching()
		print(f"Overall Match Score: {results.overall_match_score:.2f}")
		print(f"Coverage: {results.coverage_percentage:.1f}%")
		print(f"Strong Matches: {len(results.strong_matches)}")
		print(f"Weak Matches: {len(results.weak_matches)}")
		print(f"Unmatched: {len(results.unmatched_requirements)}")
		
		for match in results.strong_matches[:3]:
			print(f"\nMatch: {match.requirement_text} -> {match.matched_capability}")
			print(f"Confidence: {match.confidence_level:.2f}")
			print(f"Type: {match.match_type}")
		
	asyncio.run(main())