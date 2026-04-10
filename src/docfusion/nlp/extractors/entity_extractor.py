#!/usr/bin/env python3
"""
Entity Extractor

Advanced named entity recognition with custom domain entities for proposal
writing, including organizations, technologies, deadlines, and domain-specific terms.
"""

import asyncio
import logging
import re
from typing import Dict, List, Optional, Any, Union, Tuple, Set
from datetime import datetime, date
from dataclasses import dataclass
from enum import Enum

# spaCy integration for NER
try:
	import spacy
	from spacy.tokens import Doc, Token, Span
	from spacy.matcher import Matcher, PhraseMatcher
	from spacy.lang.en import English
	HAS_SPACY_SUPPORT = True
except ImportError:
	HAS_SPACY_SUPPORT = False

# Ollama integration for AI-powered entity extraction
import httpx
import json
from ...core.utils import uuid7str

class EntityType(str, Enum):
	"""Entity types for extraction"""
	# Standard NER entities
	PERSON = "PERSON"
	ORGANIZATION = "ORG"
	LOCATION = "GPE"
	DATE = "DATE"
	TIME = "TIME"
	MONEY = "MONEY"
	PERCENT = "PERCENT"
	
	# Technical entities
	TECHNOLOGY = "TECHNOLOGY"
	SOFTWARE = "SOFTWARE"
	PLATFORM = "PLATFORM"
	PROGRAMMING_LANGUAGE = "PROG_LANG"
	DATABASE = "DATABASE"
	FRAMEWORK = "FRAMEWORK"
	API = "API"
	PROTOCOL = "PROTOCOL"
	
	# Business entities
	PROJECT = "PROJECT"
	DEPARTMENT = "DEPARTMENT"
	ROLE = "ROLE"
	SKILL = "SKILL"
	CERTIFICATION = "CERTIFICATION"
	METHODOLOGY = "METHODOLOGY"
	
	# Document-specific entities
	REQUIREMENT = "REQUIREMENT"
	DELIVERABLE = "DELIVERABLE"
	MILESTONE = "MILESTONE"
	DEADLINE = "DEADLINE"
	CONTRACT_TERM = "CONTRACT_TERM"
	
	# Domain-specific entities
	COMPLIANCE_STANDARD = "COMPLIANCE"
	SECURITY_FRAMEWORK = "SECURITY"
	INDUSTRY_STANDARD = "INDUSTRY_STD"
	REGULATION = "REGULATION"
	
	# Contact information
	EMAIL = "EMAIL"
	PHONE = "PHONE"
	URL = "URL"
	ADDRESS = "ADDRESS"

class EntityConfidence(str, Enum):
	"""Confidence levels for entity extraction"""
	VERY_HIGH = "very_high"  # 0.9+
	HIGH = "high"           # 0.7-0.89
	MEDIUM = "medium"       # 0.5-0.69
	LOW = "low"            # 0.3-0.49
	VERY_LOW = "very_low"  # 0.0-0.29

@dataclass
class Entity:
	"""Extracted entity with metadata"""
	id: str
	text: str
	entity_type: EntityType
	start_char: int
	end_char: int
	confidence: float
	confidence_level: EntityConfidence
	label: str = ""  # Original NER label
	context: Optional[str] = None
	normalized_value: Optional[str] = None
	attributes: Dict[str, Any] = None
	relations: List[str] = None  # IDs of related entities
	source_method: str = ""  # How this entity was extracted
	ai_insights: Dict[str, Any] = None
	
	def __post_init__(self):
		if self.attributes is None:
			self.attributes = {}
		if self.relations is None:
			self.relations = []
		if self.ai_insights is None:
			self.ai_insights = {}
		
		# Set confidence level based on score
		if self.confidence >= 0.9:
			self.confidence_level = EntityConfidence.VERY_HIGH
		elif self.confidence >= 0.7:
			self.confidence_level = EntityConfidence.HIGH
		elif self.confidence >= 0.5:
			self.confidence_level = EntityConfidence.MEDIUM
		elif self.confidence >= 0.3:
			self.confidence_level = EntityConfidence.LOW
		else:
			self.confidence_level = EntityConfidence.VERY_LOW

@dataclass
class EntityGroup:
	"""Group of related entities"""
	id: str
	name: str
	entity_ids: List[str]
	group_type: str
	description: Optional[str] = None
	confidence: float = 0.0

class EntityExtractionResult:
	"""Result of entity extraction"""
	
	def __init__(self):
		self.success: bool = False
		self.original_text: str = ""
		self.entities: List[Entity] = []
		self.entity_groups: List[EntityGroup] = []
		self.statistics: Dict[str, Any] = {}
		self.errors: List[str] = []
		self.warnings: List[str] = []
		self.processing_time: float = 0.0
		self.methods_used: List[str] = []
		self.ai_analysis: Dict[str, Any] = {}

class EntityExtractor:
	"""Advanced entity extractor with custom domain recognition"""
	
	def __init__(self, config: Optional[Dict[str, Any]] = None):
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)
		
		# spaCy NER model
		self.nlp_model = None
		self.matcher = None
		self.phrase_matcher = None
		
		# Initialize Ollama client
		self.ollama_client = httpx.AsyncClient(
			base_url=self.config['ollama_base_url'],
			timeout=self.config['ollama_timeout']
		)
		
		# Load domain vocabularies and patterns
		self._load_domain_vocabularies()
		self._initialize_nlp_components()
		self._compile_patterns()
		
		self.logger.info("Entity extractor initialized")
	
	def _get_default_config(self) -> Dict[str, Any]:
		"""Get default configuration"""
		return {
			# Model settings
			'spacy_model': 'en_core_web_sm',
			'use_spacy_ner': HAS_SPACY_SUPPORT,
			'use_custom_patterns': True,
			'use_domain_vocabularies': True,
			'use_ai_enhancement': True,
			
			# Ollama settings
			'ollama_base_url': 'http://localhost:11434',
			'ollama_model': 'llama3.2:3b',
			'ollama_timeout': 120.0,
			
			# Entity types to extract
			'extract_standard_entities': True,
			'extract_technical_entities': True,
			'extract_business_entities': True,
			'extract_document_entities': True,
			'extract_compliance_entities': True,
			'extract_contact_entities': True,
			
			# Processing options
			'min_confidence_threshold': 0.3,
			'normalize_entities': True,
			'group_related_entities': True,
			'extract_entity_relations': True,
			'include_context': True,
			'context_window': 50,  # Characters before/after entity
			
			# AI enhancement settings
			'ai_chunk_size': 3000,
			'ai_entity_validation': True,
			'ai_custom_entity_detection': True,
			
			# Performance settings
			'max_text_length': 500000,
			'batch_processing': True,
			'parallel_processing': True
		}
	
	def _load_domain_vocabularies(self):
		"""Load domain-specific vocabularies"""
		# Technology entities
		self.technologies = {
			'python', 'java', 'javascript', 'c++', 'c#', 'ruby', 'go', 'rust',
			'react', 'angular', 'vue', 'node.js', 'spring', 'django', 'flask',
			'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'jenkins', 'git',
			'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
			'rest', 'graphql', 'soap', 'microservices', 'serverless'
		}
		
		# Business methodologies
		self.methodologies = {
			'agile', 'scrum', 'kanban', 'waterfall', 'devops', 'lean',
			'six sigma', 'prince2', 'pmp', 'itil', 'cobit', 'togaf'
		}
		
		# Compliance standards
		self.compliance_standards = {
			'gdpr', 'hipaa', 'sox', 'pci-dss', 'iso 27001', 'iso 9001',
			'nist', 'cmmi', 'fips', 'common criteria', 'fedramp'
		}
		
		# Certifications
		self.certifications = {
			'cissp', 'cism', 'cisa', 'aws certified', 'azure certified',
			'google cloud certified', 'pmp', 'scrum master', 'safe'
		}
		
		# Industries
		self.industries = {
			'healthcare', 'finance', 'banking', 'insurance', 'retail',
			'manufacturing', 'automotive', 'aerospace', 'defense',
			'telecommunications', 'media', 'entertainment', 'education'
		}
	
	def _initialize_nlp_components(self):
		"""Initialize spaCy components"""
		if self.config['use_spacy_ner'] and HAS_SPACY_SUPPORT:
			try:
				self.nlp_model = spacy.load(self.config['spacy_model'])
				self.matcher = Matcher(self.nlp_model.vocab)
				self.phrase_matcher = PhraseMatcher(self.nlp_model.vocab, attr="LOWER")
				self.logger.info(f"spaCy model '{self.config['spacy_model']}' loaded successfully")
			except IOError:
				self.logger.warning(f"Could not load spaCy model '{self.config['spacy_model']}'")
				self.nlp_model = None
	
	def _compile_patterns(self):
		"""Compile custom patterns for entity extraction"""
		if not self.matcher:
			return
		
		# Email pattern
		email_pattern = [{"LIKE_EMAIL": True}]
		self.matcher.add("EMAIL", [email_pattern])
		
		# URL pattern
		url_pattern = [{"LIKE_URL": True}]
		self.matcher.add("URL", [url_pattern])
		
		# Phone patterns
		phone_patterns = [
			[{"TEXT": {"REGEX": r"^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$"}}],
			[{"TEXT": {"REGEX": r"^\+?[1-9]\d{1,14}$"}}]  # International format
		]
		self.matcher.add("PHONE", phone_patterns)
		
		# Version patterns (software versions)
		version_pattern = [
			{"TEXT": {"REGEX": r"^v?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)?$"}}
		]
		self.matcher.add("VERSION", [version_pattern])
		
		# Currency patterns
		currency_patterns = [
			[{"TEXT": "$"}, {"LIKE_NUM": True}],
			[{"LIKE_NUM": True}, {"LOWER": {"IN": ["dollars", "usd", "euro", "eur"]}}]
		]
		self.matcher.add("CURRENCY", currency_patterns)
		
		# Add phrase patterns for domain vocabularies
		if self.phrase_matcher:
			# Technology patterns
			tech_patterns = [self.nlp_model(text) for text in self.technologies if self.nlp_model]
			if tech_patterns:
				self.phrase_matcher.add("TECHNOLOGY", tech_patterns)
			
			# Methodology patterns
			method_patterns = [self.nlp_model(text) for text in self.methodologies if self.nlp_model]
			if method_patterns:
				self.phrase_matcher.add("METHODOLOGY", method_patterns)
			
			# Compliance patterns
			compliance_patterns = [self.nlp_model(text) for text in self.compliance_standards if self.nlp_model]
			if compliance_patterns:
				self.phrase_matcher.add("COMPLIANCE", compliance_patterns)
	
	async def extract_entities(
		self,
		text: str,
		entity_types: Optional[List[EntityType]] = None,
		use_ai: Optional[bool] = None
	) -> EntityExtractionResult:
		"""Extract entities from text"""
		start_time = asyncio.get_event_loop().time()
		result = EntityExtractionResult()
		result.original_text = text
		
		if not text or not text.strip():
			result.success = True
			return result
		
		try:
			# Check text length
			if len(text) > self.config['max_text_length']:
				result.warnings.append(f"Text truncated to {self.config['max_text_length']} characters")
				text = text[:self.config['max_text_length']]
			
			methods_used = []
			all_entities = []
			
			# Method 1: spaCy NER
			if self.config['use_spacy_ner'] and self.nlp_model:
				spacy_entities = await self._extract_with_spacy(text)
				all_entities.extend(spacy_entities)
				methods_used.append("spacy_ner")
			
			# Method 2: Custom pattern matching
			if self.config['use_custom_patterns']:
				pattern_entities = await self._extract_with_patterns(text)
				all_entities.extend(pattern_entities)
				methods_used.append("pattern_matching")
			
			# Method 3: Domain vocabulary matching
			if self.config['use_domain_vocabularies']:
				domain_entities = await self._extract_domain_entities(text)
				all_entities.extend(domain_entities)
				methods_used.append("domain_vocabularies")
			
			# Method 4: AI-enhanced extraction
			if (use_ai or self.config['use_ai_enhancement']) and len(text) < 50000:
				ai_entities, ai_analysis = await self._extract_with_ai(text, entity_types)
				all_entities.extend(ai_entities)
				result.ai_analysis = ai_analysis
				methods_used.append("ai_enhancement")
			
			# Merge and deduplicate entities
			merged_entities = self._merge_entities(all_entities)
			
			# Filter by confidence threshold
			filtered_entities = [
				entity for entity in merged_entities
				if entity.confidence >= self.config['min_confidence_threshold']
			]
			
			# Add context if requested
			if self.config['include_context']:
				for entity in filtered_entities:
					entity.context = self._extract_context(text, entity)
			
			# Normalize entity values
			if self.config['normalize_entities']:
				for entity in filtered_entities:
					entity.normalized_value = self._normalize_entity_value(entity)
			
			# Group related entities
			entity_groups = []
			if self.config['group_related_entities']:
				entity_groups = self._group_entities(filtered_entities)
			
			# Extract entity relations
			if self.config['extract_entity_relations']:
				self._extract_entity_relations(filtered_entities, text)
			
			# Calculate statistics
			statistics = self._calculate_entity_statistics(filtered_entities)
			
			result.entities = filtered_entities
			result.entity_groups = entity_groups
			result.statistics = statistics
			result.methods_used = methods_used
			result.success = True
			result.processing_time = asyncio.get_event_loop().time() - start_time
			
			self.logger.info(f"Entities extracted successfully, time: {result.processing_time:.2f}s")
		
		except Exception as e:
			result.errors.append(f"Entity extraction failed: {str(e)}")
			self.logger.error(f"Entity extraction error: {e}")
		
		return result
	
	async def _extract_with_spacy(self, text: str) -> List[Entity]:
		"""Extract entities using spaCy NER"""
		entities = []
		
		# Process text with spaCy
		doc = self.nlp_model(text)
		
		# Extract named entities
		for ent in doc.ents:
			entity_type = self._map_spacy_label_to_entity_type(ent.label_)
			
			if entity_type:  # Only include if we have a mapping
				entity = Entity(
					id=uuid7str(),
					text=ent.text,
					entity_type=entity_type,
					start_char=ent.start_char,
					end_char=ent.end_char,
					confidence=0.8,  # spaCy default confidence
					label=ent.label_,
					source_method="spacy_ner"
				)
				entities.append(entity)
		
		return entities
	
	async def _extract_with_patterns(self, text: str) -> List[Entity]:
		"""Extract entities using custom patterns"""
		entities = []
		
		if not self.matcher:
			return entities
		
		# Process text with spaCy for pattern matching
		doc = self.nlp_model(text) if self.nlp_model else None
		
		if doc:
			matches = self.matcher(doc)
			
			for match_id, start, end in matches:
				span = doc[start:end]
				label = self.nlp_model.vocab.strings[match_id]
				
				entity_type = self._map_pattern_label_to_entity_type(label)
				if entity_type:
					entity = Entity(
						id=uuid7str(),
						text=span.text,
						entity_type=entity_type,
						start_char=span.start_char,
						end_char=span.end_char,
						confidence=0.9,  # High confidence for pattern matches
						label=label,
						source_method="pattern_matching"
					)
					entities.append(entity)
		
		return entities
	
	async def _extract_domain_entities(self, text: str) -> List[Entity]:
		"""Extract domain-specific entities"""
		entities = []
		text_lower = text.lower()
		
		# Technology entities
		for tech in self.technologies:
			pattern = rf'\b{re.escape(tech)}\b'
			for match in re.finditer(pattern, text, re.IGNORECASE):
				entity = Entity(
					id=uuid7str(),
					text=match.group(),
					entity_type=EntityType.TECHNOLOGY,
					start_char=match.start(),
					end_char=match.end(),
					confidence=0.7,
					source_method="domain_vocabulary"
				)
				entities.append(entity)
		
		# Methodology entities
		for method in self.methodologies:
			pattern = rf'\b{re.escape(method)}\b'
			for match in re.finditer(pattern, text, re.IGNORECASE):
				entity = Entity(
					id=uuid7str(),
					text=match.group(),
					entity_type=EntityType.METHODOLOGY,
					start_char=match.start(),
					end_char=match.end(),
					confidence=0.8,
					source_method="domain_vocabulary"
				)
				entities.append(entity)
		
		# Compliance standards
		for standard in self.compliance_standards:
			pattern = rf'\b{re.escape(standard)}\b'
			for match in re.finditer(pattern, text, re.IGNORECASE):
				entity = Entity(
					id=uuid7str(),
					text=match.group(),
					entity_type=EntityType.COMPLIANCE_STANDARD,
					start_char=match.start(),
					end_char=match.end(),
					confidence=0.9,
					source_method="domain_vocabulary"
				)
				entities.append(entity)
		
		return entities
	
	async def _extract_with_ai(self, text: str, entity_types: Optional[List[EntityType]]) -> Tuple[List[Entity], Dict[str, Any]]:
		"""Extract entities using AI enhancement"""
		entities = []
		ai_analysis = {}
		
		try:
			# Split text into chunks if needed
			chunks = self._split_text_for_ai_analysis(text)
			
			for chunk_idx, chunk in enumerate(chunks):
				chunk_entities, chunk_analysis = await self._analyze_chunk_for_entities(
					chunk, chunk_idx, entity_types
				)
				entities.extend(chunk_entities)
				ai_analysis[f'chunk_{chunk_idx}'] = chunk_analysis
			
			# Global entity analysis if text is small enough
			if len(text) < self.config['ai_chunk_size']:
				global_analysis = await self._perform_global_entity_analysis(text, entity_types)
				ai_analysis['global'] = global_analysis
		
		except Exception as e:
			self.logger.warning(f"AI entity extraction failed: {e}")
			ai_analysis['error'] = str(e)
		
		return entities, ai_analysis
	
	async def _analyze_chunk_for_entities(self, chunk: str, chunk_idx: int, entity_types: Optional[List[EntityType]]) -> Tuple[List[Entity], Dict[str, Any]]:
		"""Analyze chunk for entities using AI"""
		entity_types_str = ", ".join([et.value for et in entity_types]) if entity_types else "all types"
		
		prompt = f"""Extract named entities from this text. Focus on identifying:

Standard entities: Person, Organization, Location, Date, Time, Money, Percent
Technical entities: Technologies, Software, Platforms, Programming Languages, APIs, Protocols
Business entities: Projects, Departments, Roles, Skills, Certifications, Methodologies
Document entities: Requirements, Deliverables, Milestones, Deadlines, Contract Terms
Compliance entities: Standards, Regulations, Security Frameworks
Contact entities: Emails, Phone numbers, URLs, Addresses

Target entity types: {entity_types_str}

Text to analyze:
{chunk}

For each entity provide:
{{
  "entities": [
    {{
      "text": "entity text",
      "type": "TECHNOLOGY|PERSON|ORG|etc",
      "start_pos": 0,
      "end_pos": 10,
      "confidence": 0.9,
      "context": "surrounding context"
    }}
  ],
  "analysis": {{
    "total_entities": 5,
    "entity_density": "high|medium|low",
    "dominant_types": ["TECHNOLOGY", "ORG"]
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
					"num_predict": 2500
				}
			})
			
			if response.status_code == 200:
				ai_response = response.json()
				response_text = ai_response.get('response', '').strip()
				
				try:
					ai_data = json.loads(response_text)
					entities = self._convert_ai_entities(ai_data.get('entities', []), chunk)
					analysis = ai_data.get('analysis', {})
					analysis['raw_response'] = response_text
					return entities, analysis
				
				except json.JSONDecodeError:
					entities = self._parse_ai_text_entities(response_text, chunk)
					analysis = {'raw_response': response_text, 'parsing_method': 'text_fallback'}
					return entities, analysis
		
		except Exception as e:
			self.logger.warning(f"AI chunk entity analysis failed: {e}")
		
		return [], {'error': 'AI analysis failed'}
	
	async def _perform_global_entity_analysis(self, text: str, entity_types: Optional[List[EntityType]]) -> Dict[str, Any]:
		"""Perform global entity analysis"""
		prompt = f"""Analyze the overall entity distribution and patterns in this document.

Text (first 2000 characters):
{text[:2000]}...

Provide analysis:
{{
  "entity_summary": {{
    "total_entities_estimated": 50,
    "most_common_types": ["TECHNOLOGY", "ORG", "PERSON"],
    "entity_density": "high|medium|low",
    "domain_assessment": "technical|business|legal|mixed"
  }},
  "notable_entities": [
    {{"type": "ORG", "text": "Microsoft", "importance": "high"}},
    {{"type": "TECHNOLOGY", "text": "Azure", "importance": "medium"}}
  ],
  "entity_relationships": [
    {{"entity1": "Microsoft", "entity2": "Azure", "relationship": "owns"}}
  ],
  "insights": ["This appears to be a technical proposal focusing on cloud solutions"]
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
			self.logger.warning(f"Global entity analysis failed: {e}")
		
		return {'error': 'Global analysis failed'}
	
	def _convert_ai_entities(self, ai_entities: List[Dict[str, Any]], chunk: str) -> List[Entity]:
		"""Convert AI entities to Entity objects"""
		entities = []
		
		for ai_entity in ai_entities:
			try:
				entity_type = self._map_ai_type_to_entity_type(ai_entity.get('type', 'PERSON'))
				
				entity = Entity(
					id=uuid7str(),
					text=ai_entity.get('text', ''),
					entity_type=entity_type,
					start_char=ai_entity.get('start_pos', 0),
					end_char=ai_entity.get('end_pos', len(ai_entity.get('text', ''))),
					confidence=min(ai_entity.get('confidence', 0.5), 1.0),
					context=ai_entity.get('context'),
					source_method="ai_enhancement",
					ai_insights={'source': 'ollama', 'original_data': ai_entity}
				)
				entities.append(entity)
			
			except Exception as e:
				self.logger.warning(f"Failed to convert AI entity: {e}")
				continue
		
		return entities
	
	def _parse_ai_text_entities(self, response_text: str, chunk: str) -> List[Entity]:
		"""Parse AI response as text when JSON parsing fails"""
		entities = []
		lines = response_text.split('\n')
		
		for line in lines:
			line = line.strip()
			if not line or not any(keyword in line.lower() for keyword in ['entity:', 'person:', 'org:', 'tech:']):
				continue
			
			# Simple text parsing for entities
			if ':' in line:
				parts = line.split(':', 1)
				if len(parts) == 2:
					entity_type_str = parts[0].strip()
					entity_text = parts[1].strip()
					
					entity_type = self._map_simple_type_to_entity_type(entity_type_str)
					
					entity = Entity(
						id=uuid7str(),
						text=entity_text,
						entity_type=entity_type,
						confidence=0.4,
						source_method="ai_text_parsing",
						ai_insights={'source': 'text_parsing'}
					)
					entities.append(entity)
		
		return entities
	
	def _map_spacy_label_to_entity_type(self, spacy_label: str) -> Optional[EntityType]:
		"""Map spaCy NER labels to EntityType enum"""
		mapping = {
			'PERSON': EntityType.PERSON,
			'ORG': EntityType.ORGANIZATION,
			'GPE': EntityType.LOCATION,
			'DATE': EntityType.DATE,
			'TIME': EntityType.TIME,
			'MONEY': EntityType.MONEY,
			'PERCENT': EntityType.PERCENT,
			'PRODUCT': EntityType.TECHNOLOGY,
			'EVENT': EntityType.PROJECT,
			'LAW': EntityType.REGULATION,
			'LANGUAGE': EntityType.PROGRAMMING_LANGUAGE
		}
		
		return mapping.get(spacy_label)
	
	def _map_pattern_label_to_entity_type(self, pattern_label: str) -> Optional[EntityType]:
		"""Map pattern labels to EntityType enum"""
		mapping = {
			'EMAIL': EntityType.EMAIL,
			'URL': EntityType.URL,
			'PHONE': EntityType.PHONE,
			'VERSION': EntityType.SOFTWARE,
			'CURRENCY': EntityType.MONEY,
			'TECHNOLOGY': EntityType.TECHNOLOGY,
			'METHODOLOGY': EntityType.METHODOLOGY,
			'COMPLIANCE': EntityType.COMPLIANCE_STANDARD
		}
		
		return mapping.get(pattern_label)
	
	def _map_ai_type_to_entity_type(self, ai_type: str) -> EntityType:
		"""Map AI-detected type to EntityType enum"""
		ai_type_upper = ai_type.upper()
		
		# Try direct mapping first
		try:
			return EntityType(ai_type_upper)
		except ValueError:
			self.logger.warning("ValueError in _map_ai_type_to_entity_type")
		
		# Fallback mappings
		mapping = {
			'TECH': EntityType.TECHNOLOGY,
			'COMPANY': EntityType.ORGANIZATION,
			'CORP': EntityType.ORGANIZATION,
			'BUSINESS': EntityType.ORGANIZATION,
			'STANDARD': EntityType.COMPLIANCE_STANDARD,
			'CERT': EntityType.CERTIFICATION,
			'LANG': EntityType.PROGRAMMING_LANGUAGE,
			'DB': EntityType.DATABASE,
			'CONTACT': EntityType.EMAIL
		}
		
		return mapping.get(ai_type_upper, EntityType.ORGANIZATION)
	
	def _map_simple_type_to_entity_type(self, simple_type: str) -> EntityType:
		"""Map simple type strings to EntityType enum"""
		simple_type_lower = simple_type.lower()
		
		if 'person' in simple_type_lower:
			return EntityType.PERSON
		elif 'org' in simple_type_lower or 'company' in simple_type_lower:
			return EntityType.ORGANIZATION
		elif 'tech' in simple_type_lower:
			return EntityType.TECHNOLOGY
		elif 'date' in simple_type_lower:
			return EntityType.DATE
		elif 'email' in simple_type_lower:
			return EntityType.EMAIL
		else:
			return EntityType.ORGANIZATION
	
	def _merge_entities(self, entities: List[Entity]) -> List[Entity]:
		"""Merge and deduplicate entities"""
		if not entities:
			return []
		
		# Sort by position
		entities.sort(key=lambda x: (x.start_char, x.end_char))
		
		merged = []
		for entity in entities:
			# Check for overlaps with existing entities
			overlap_found = False
			for existing in merged:
				if self._entities_overlap(entity, existing):
					# Keep the entity with higher confidence or from a more reliable source
					if (entity.confidence > existing.confidence or
						self._get_source_priority(entity.source_method) > self._get_source_priority(existing.source_method)):
						merged.remove(existing)
						merged.append(entity)
					overlap_found = True
					break
			
			if not overlap_found:
				merged.append(entity)
		
		return merged
	
	def _entities_overlap(self, entity1: Entity, entity2: Entity) -> bool:
		"""Check if two entities overlap"""
		return not (entity1.end_char <= entity2.start_char or entity2.end_char <= entity1.start_char)
	
	def _get_source_priority(self, source_method: str) -> int:
		"""Get priority score for different extraction methods"""
		priorities = {
			'spacy_ner': 4,
			'pattern_matching': 5,
			'domain_vocabulary': 3,
			'ai_enhancement': 2,
			'ai_text_parsing': 1
		}
		return priorities.get(source_method, 0)
	
	def _extract_context(self, text: str, entity: Entity) -> str:
		"""Extract context around an entity"""
		window = self.config['context_window']
		start = max(0, entity.start_char - window)
		end = min(len(text), entity.end_char + window)
		
		context = text[start:end]
		
		# Clean up context
		context = context.replace('\n', ' ').strip()
		if len(context) > window * 2:
			context = context[:window * 2] + "..."
		
		return context
	
	def _normalize_entity_value(self, entity: Entity) -> Optional[str]:
		"""Normalize entity values"""
		text = entity.text.strip()
		
		if entity.entity_type == EntityType.EMAIL:
			return text.lower()
		elif entity.entity_type == EntityType.URL:
			return text.lower()
		elif entity.entity_type == EntityType.TECHNOLOGY:
			return text.lower()
		elif entity.entity_type == EntityType.ORGANIZATION:
			# Remove common suffixes
			suffixes = [' inc', ' llc', ' corp', ' ltd', ' company', ' co']
			text_lower = text.lower()
			for suffix in suffixes:
				if text_lower.endswith(suffix):
					return text[:-len(suffix)].strip()
			return text
		elif entity.entity_type == EntityType.PERSON:
			# Capitalize properly
			return ' '.join(word.capitalize() for word in text.split())
		
		return text
	
	def _group_entities(self, entities: List[Entity]) -> List[EntityGroup]:
		"""Group related entities"""
		groups = []
		
		# Group by type
		type_groups = {}
		for entity in entities:
			entity_type = entity.entity_type.value
			if entity_type not in type_groups:
				type_groups[entity_type] = []
			type_groups[entity_type].append(entity.id)
		
		# Create groups for types with multiple entities
		for entity_type, entity_ids in type_groups.items():
			if len(entity_ids) > 1:
				avg_confidence = sum(
					entity.confidence for entity in entities
					if entity.id in entity_ids
				) / len(entity_ids)
				
				group = EntityGroup(
					id=uuid7str(),
					name=f"{entity_type.title()} Entities",
					entity_ids=entity_ids,
					group_type=entity_type,
					description=f"All {entity_type} entities found in the document",
					confidence=avg_confidence
				)
				groups.append(group)
		
		return groups
	
	def _extract_entity_relations(self, entities: List[Entity], text: str):
		"""Extract relations between entities (simple implementation)"""
		for i, entity1 in enumerate(entities):
			for j, entity2 in enumerate(entities[i+1:], i+1):
				# Check if entities are mentioned close to each other
				distance = abs(entity1.start_char - entity2.start_char)
				
				# If entities are within 100 characters, consider them related
				if distance < 100:
					entity1.relations.append(entity2.id)
					entity2.relations.append(entity1.id)
	
	def _calculate_entity_statistics(self, entities: List[Entity]) -> Dict[str, Any]:
		"""Calculate entity statistics"""
		if not entities:
			return {}
		
		type_counts = {}
		confidence_sum = 0
		source_counts = {}
		
		for entity in entities:
			# Count by type
			entity_type = entity.entity_type.value
			type_counts[entity_type] = type_counts.get(entity_type, 0) + 1
			
			# Sum confidence
			confidence_sum += entity.confidence
			
			# Count by source
			source = entity.source_method
			source_counts[source] = source_counts.get(source, 0) + 1
		
		return {
			'total_entities': len(entities),
			'type_distribution': type_counts,
			'source_distribution': source_counts,
			'average_confidence': confidence_sum / len(entities),
			'confidence_distribution': {
				'very_high': len([e for e in entities if e.confidence >= 0.9]),
				'high': len([e for e in entities if 0.7 <= e.confidence < 0.9]),
				'medium': len([e for e in entities if 0.5 <= e.confidence < 0.7]),
				'low': len([e for e in entities if 0.3 <= e.confidence < 0.5]),
				'very_low': len([e for e in entities if e.confidence < 0.3])
			},
			'entities_with_context': len([e for e in entities if e.context]),
			'entities_with_relations': len([e for e in entities if e.relations]),
			'unique_normalized_values': len(set(e.normalized_value for e in entities if e.normalized_value))
		}
	
	def _split_text_for_ai_analysis(self, text: str) -> List[str]:
		"""Split text into chunks for AI analysis"""
		if len(text) <= self.config['ai_chunk_size']:
			return [text]
		
		chunks = []
		# Split by sentences to preserve context
		sentences = re.split(r'[.!?]+', text)
		current_chunk = ""
		
		for sentence in sentences:
			if len(current_chunk) + len(sentence) <= self.config['ai_chunk_size']:
				current_chunk += sentence + ". "
			else:
				if current_chunk:
					chunks.append(current_chunk.strip())
				current_chunk = sentence + ". "
		
		if current_chunk:
			chunks.append(current_chunk.strip())
		
		return chunks
	
	async def extract_entity_relationships(self, entities: List[Entity], text: str) -> Dict[str, Any]:
		"""Extract detailed relationships between entities using AI"""
		if len(entities) < 2 or len(text) > 10000:
			return {'relationships': [], 'analysis': 'Skipped due to size or entity count'}
		
		# Create entity list for AI
		entity_list = []
		for entity in entities[:20]:  # Limit to first 20 entities
			entity_list.append({
				'id': entity.id,
				'text': entity.text,
				'type': entity.entity_type.value
			})
		
		prompt = f"""Analyze relationships between these entities in the given text.

Entities:
{json.dumps(entity_list, indent=2)}

Text context:
{text[:3000]}...

Identify relationships like:
- Person works at Organization
- Technology is used by Organization  
- Project is managed by Person
- Certification is held by Person
- Compliance standard applies to Project

Provide JSON response:
{{
  "relationships": [
    {{
      "entity1_id": "id1",
      "entity2_id": "id2", 
      "relationship_type": "works_at|uses|manages|holds|applies_to",
      "confidence": 0.8,
      "evidence": "text evidence for relationship"
    }}
  ]
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
			self.logger.warning(f"Entity relationship extraction failed: {e}")
		
		return {'error': 'Relationship extraction failed'}
	
	async def validate_entities(self, entities: List[Entity], text: str) -> Dict[str, Any]:
		"""Validate extracted entities using AI"""
		if not entities or len(text) > 10000:
			return {'validation': 'skipped', 'reason': 'size or entity count'}
		
		# Sample entities for validation (max 10)
		sample_entities = entities[:10]
		entity_data = []
		
		for entity in sample_entities:
			entity_data.append({
				'text': entity.text,
				'type': entity.entity_type.value,
				'context': entity.context or text[max(0, entity.start_char-50):entity.end_char+50]
			})
		
		prompt = f"""Validate these extracted entities. Check if the entity type is correct and if the entity is actually present in the context.

Entities to validate:
{json.dumps(entity_data, indent=2)}

For each entity, assess:
1. Is the entity type correct?
2. Is the entity text accurate?
3. Does the entity make sense in context?

Provide validation results:
{{
  "validation_results": [
    {{
      "entity_text": "Microsoft",
      "is_valid": true,
      "type_correct": true,
      "accuracy_score": 0.9,
      "issues": []
    }}
  ],
  "overall_accuracy": 0.85
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
			self.logger.warning(f"Entity validation failed: {e}")
		
		return {'error': 'Validation failed'}
	
	async def close(self):
		"""Close the Ollama client"""
		await self.ollama_client.aclose()
	
	def get_extractor_info(self) -> Dict[str, Any]:
		"""Get extractor information and capabilities"""
		return {
			'supported_entity_types': [etype.value for etype in EntityType],
			'extraction_methods': ['spacy_ner', 'pattern_matching', 'domain_vocabularies', 'ai_enhancement'],
			'domain_vocabularies': {
				'technologies': len(self.technologies),
				'methodologies': len(self.methodologies),
				'compliance_standards': len(self.compliance_standards),
				'certifications': len(self.certifications),
				'industries': len(self.industries)
			},
			'spacy_available': HAS_SPACY_SUPPORT,
			'ai_model': self.config['ollama_model'],
			'config': self.config.copy(),
			'version': '1.0.0'
		}

# Factory function
def create_entity_extractor(config: Optional[Dict[str, Any]] = None) -> EntityExtractor:
	"""Create EntityExtractor instance with configuration"""
	return EntityExtractor(config)