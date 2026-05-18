#!/usr/bin/env python3
"""
Relationship Extractor

Advanced relationship and dependency extraction using spaCy dependency parsing,
pattern matching, and Ollama-based AI analysis for understanding connections
between entities and concepts in documents.
"""

import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

# spaCy integration for dependency parsing
try:
    import spacy
    from spacy.matcher import DependencyMatcher, Matcher
    from spacy.tokens import Doc, Span, Token

    HAS_SPACY_SUPPORT = True
except ImportError:
    HAS_SPACY_SUPPORT = False

    # Create dummy types for when spaCy is not available
    class Doc:
        pass

    class Token:
        pass

    class Span:
        pass

# Ollama integration for AI-powered relationship extraction
import json

import httpx
from ...core.utils import uuid7str
import time

class RelationshipType(str, Enum):
    """Types of relationships that can be extracted"""

    # Entity relationships
    PERSON_ORGANIZATION = "person_works_at_org"
    PERSON_ROLE = "person_has_role"
    PERSON_SKILL = "person_has_skill"
    ORGANIZATION_LOCATION = "org_located_in"
    ORGANIZATION_INDUSTRY = "org_in_industry"

    # Technical relationships
    TECHNOLOGY_ORGANIZATION = "tech_used_by_org"
    SOFTWARE_PLATFORM = "software_runs_on_platform"
    API_SERVICE = "api_provides_service"
    SYSTEM_INTEGRATION = "system_integrates_with"
    DEPENDENCY = "depends_on"

    # Project relationships
    PROJECT_ORGANIZATION = "project_owned_by_org"
    PROJECT_PERSON = "project_managed_by_person"
    PROJECT_TECHNOLOGY = "project_uses_tech"
    PROJECT_REQUIREMENT = "project_has_requirement"
    PROJECT_DELIVERABLE = "project_produces_deliverable"

    # Document relationships
    REQUIREMENT_DELIVERABLE = "requirement_produces_deliverable"
    REQUIREMENT_CONSTRAINT = "requirement_has_constraint"
    REQUIREMENT_DEPENDENCY = "requirement_depends_on"
    DELIVERABLE_MILESTONE = "deliverable_due_at_milestone"

    # Temporal relationships
    PRECEDES = "precedes"
    FOLLOWS = "follows"
    CONCURRENT = "concurrent_with"
    DEADLINE_DEPENDENCY = "deadline_depends_on"

    # Compliance relationships
    COMPLIES_WITH = "complies_with"
    REGULATED_BY = "regulated_by"
    CERTIFIED_FOR = "certified_for"
    AUDITED_BY = "audited_by"

    # Business relationships
    CLIENT_VENDOR = "client_vendor"
    PARTNERSHIP = "partnership"
    COMPETITION = "competes_with"
    SUBSIDIARY = "subsidiary_of"

    # Logical relationships
    IMPLIES = "implies"
    CONTRADICTS = "contradicts"
    SUPPORTS = "supports"
    REQUIRED_FOR = "required_for"
    ENABLES = "enables"

class RelationshipConfidence(str, Enum):
    """Confidence levels for relationship extraction"""

    VERY_HIGH = "very_high"  # 0.9+
    HIGH = "high"  # 0.7-0.89
    MEDIUM = "medium"  # 0.5-0.69
    LOW = "low"  # 0.3-0.49
    VERY_LOW = "very_low"  # 0.0-0.29

@dataclass
class Relationship:
    """Extracted relationship between entities or concepts"""

    id: str
    relationship_type: RelationshipType
    source_entity: str  # Entity text or ID
    target_entity: str  # Entity text or ID
    confidence: float
    confidence_level: RelationshipConfidence
    evidence: str  # Text that supports this relationship
    context: Optional[str] = None
    start_char: int = 0
    end_char: int = 0
    source_entity_id: Optional[str] = None
    target_entity_id: Optional[str] = None
    attributes: Dict[str, Any] = None
    extraction_method: str = ""
    dependency_path: Optional[str] = None  # spaCy dependency path
    ai_insights: Dict[str, Any] = None

    def __post_init__(self):
        if self.attributes is None:
            self.attributes = {}
        if self.ai_insights is None:
            self.ai_insights = {}

        # Set confidence level based on score
        if self.confidence >= 0.9:
            self.confidence_level = RelationshipConfidence.VERY_HIGH
        elif self.confidence >= 0.7:
            self.confidence_level = RelationshipConfidence.HIGH
        elif self.confidence >= 0.5:
            self.confidence_level = RelationshipConfidence.MEDIUM
        elif self.confidence >= 0.3:
            self.confidence_level = RelationshipConfidence.LOW
        else:
            self.confidence_level = RelationshipConfidence.VERY_LOW

@dataclass
class RelationshipGraph:
    """Graph representation of relationships"""

    relationships: List[Relationship]
    entities: Set[str]
    adjacency_matrix: Dict[str, List[str]]
    clusters: List[Set[str]] = None
    statistics: Dict[str, Any] = None

    def __post_init__(self):
        if self.clusters is None:
            self.clusters = []
        if self.statistics is None:
            self.statistics = {}

class RelationshipExtractionResult:
    """Result of relationship extraction"""

    def __init__(self):
        self.success: bool = False
        self.original_text: str = ""
        self.relationships: List[Relationship] = []
        self.relationship_graph: Optional[RelationshipGraph] = None
        self.statistics: Dict[str, Any] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.processing_time: float = 0.0
        self.methods_used: List[str] = []
        self.ai_analysis: Dict[str, Any] = {}

class RelationshipExtractor:
    """Advanced relationship extractor with dependency parsing and AI enhancement"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        defaults = self._get_default_config()
        if config:
            self.config = {**defaults, **config}
        else:
            self.config = defaults
        self.logger = logging.getLogger(__name__)

        # spaCy components
        self.nlp_model = None
        self.dependency_matcher = None
        self.matcher = None

        # Initialize Ollama client
        self.ollama_client = httpx.AsyncClient(
            base_url=self.config["ollama_base_url"],
            timeout=self.config["ollama_timeout"],
        )

        # Initialize NLP components
        self._initialize_nlp_components()

        # Compile relationship patterns
        self._compile_relationship_patterns()

        self.logger.info("Relationship extractor initialized")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            # Model settings
            "spacy_model": "en_core_web_sm",
            "use_spacy_deps": HAS_SPACY_SUPPORT,
            "use_dependency_patterns": True,
            "use_textual_patterns": True,
            "use_ai_enhancement": True,
            # Ollama settings
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.2:3b",
            "ollama_timeout": 150.0,
            # Extraction methods
            "extract_entity_relationships": True,
            "extract_temporal_relationships": True,
            "extract_logical_relationships": True,
            "extract_business_relationships": True,
            "extract_technical_relationships": True,
            "extract_compliance_relationships": True,
            # Processing options
            "min_confidence_threshold": 0.4,
            "max_sentence_length": 200,  # Skip very long sentences
            "context_window": 100,  # Context around relationships
            "merge_similar_relationships": True,
            "build_relationship_graph": True,
            "detect_relationship_clusters": True,
            # AI enhancement settings
            "ai_chunk_size": 2500,
            "ai_relationship_validation": True,
            "ai_implicit_relationships": True,
            "max_relationships_per_chunk": 30,
            # Performance settings
            "max_text_length": 200000,
            "parallel_processing": True,
            "batch_sentences": True,
        }

    def _initialize_nlp_components(self):
        """Initialize spaCy components"""
        if self.config["use_spacy_deps"] and HAS_SPACY_SUPPORT:
            try:
                self.nlp_model = spacy.load(self.config["spacy_model"])

                # Ensure we have dependency parser
                if "parser" not in self.nlp_model.pipe_names:
                    self.logger.warning(
                        "spaCy model does not include dependency parser"
                    )
                else:
                    self.dependency_matcher = DependencyMatcher(self.nlp_model.vocab)
                    self.matcher = Matcher(self.nlp_model.vocab)
                    self.logger.info(
                        f"spaCy dependency parser loaded with '{self.config['spacy_model']}'"
                    )

            except IOError:
                self.logger.warning(
                    f"Could not load spaCy model '{self.config['spacy_model']}'"
                )
                self.nlp_model = None

    def _compile_relationship_patterns(self):
        """Compile patterns for relationship extraction"""
        if not self.dependency_matcher or not self.matcher:
            return

        # Dependency patterns for common relationships
        # Person works at Organization
        person_org_pattern = [
            {"RIGHT_ID": "person", "RIGHT_ATTRS": {"ENT_TYPE": "PERSON"}},
            {
                "LEFT_ID": "person",
                "REL_OP": ">",
                "RIGHT_ID": "works",
                "RIGHT_ATTRS": {"LEMMA": {"IN": ["work", "employ", "join"]}},
            },
            {
                "LEFT_ID": "works",
                "REL_OP": ">",
                "RIGHT_ID": "org",
                "RIGHT_ATTRS": {"ENT_TYPE": "ORG"},
            },
        ]
        self.dependency_matcher.add("PERSON_WORKS_ORG", [person_org_pattern])

        # Technology used by Organization
        tech_org_pattern = [
            {"RIGHT_ID": "org", "RIGHT_ATTRS": {"ENT_TYPE": "ORG"}},
            {
                "LEFT_ID": "org",
                "REL_OP": ">",
                "RIGHT_ID": "uses",
                "RIGHT_ATTRS": {
                    "LEMMA": {"IN": ["use", "adopt", "implement", "deploy"]}
                },
            },
            {
                "LEFT_ID": "uses",
                "REL_OP": ">",
                "RIGHT_ID": "tech",
                "RIGHT_ATTRS": {"ENT_TYPE": {"IN": ["PRODUCT", "ORG"]}},
            },
        ]
        self.dependency_matcher.add("ORG_USES_TECH", [tech_org_pattern])

        # Project managed by Person
        project_person_pattern = [
            {
                "RIGHT_ID": "project",
                "RIGHT_ATTRS": {"LOWER": {"IN": ["project", "initiative", "program"]}},
            },
            {
                "LEFT_ID": "project",
                "REL_OP": ">",
                "RIGHT_ID": "managed",
                "RIGHT_ATTRS": {
                    "LEMMA": {"IN": ["manage", "lead", "direct", "oversee"]}
                },
            },
            {
                "LEFT_ID": "managed",
                "REL_OP": ">",
                "RIGHT_ID": "person",
                "RIGHT_ATTRS": {"ENT_TYPE": "PERSON"},
            },
        ]
        self.dependency_matcher.add("PROJECT_MANAGED_BY", [project_person_pattern])

        # Textual patterns using Matcher
        # Compliance relationships
        compliance_pattern = [
            {"LOWER": {"IN": ["comply", "complies", "compliance"]}},
            {"LOWER": "with"},
            {"ENT_TYPE": {"IN": ["LAW", "ORG"]}, "OP": "+"},
        ]
        self.matcher.add("COMPLIANCE_WITH", [compliance_pattern])

        # Dependency relationships
        dependency_pattern = [
            {"LOWER": {"IN": ["depends", "requires", "needs"]}},
            {"LOWER": {"IN": ["on", "upon"]}, "OP": "?"},
            {"IS_ALPHA": True, "OP": "+"},
        ]
        self.matcher.add("DEPENDENCY", [dependency_pattern])

        # Integration relationships
        integration_pattern = [
            {"LOWER": {"IN": ["integrates", "connects", "interfaces"]}},
            {"LOWER": "with"},
            {"IS_ALPHA": True, "OP": "+"},
        ]
        self.matcher.add("INTEGRATION", [integration_pattern])

    async def extract_relationships(
        self,
        text: str,
        entities: Optional[List[Any]] = None,
        use_ai: Optional[bool] = None,
    ) -> RelationshipExtractionResult:
        """Extract relationships from text"""
        start_time = time.monotonic()
        result = RelationshipExtractionResult()
        result.original_text = text

        if not text or not text.strip():
            result.success = True
            return result

        try:
            # Check text length
            if len(text) > self.config["max_text_length"]:
                result.warnings.append(
                    f"Text truncated to {self.config['max_text_length']} characters"
                )
                text = text[: self.config["max_text_length"]]

            methods_used = []
            all_relationships = []

            # Method 1: spaCy dependency parsing
            if self.config["use_spacy_deps"] and self.nlp_model:
                dep_relationships = await self._extract_with_dependencies(text)
                all_relationships.extend(dep_relationships)
                methods_used.append("dependency_parsing")

            # Method 2: Pattern-based extraction
            if self.config["use_textual_patterns"]:
                pattern_relationships = await self._extract_with_patterns(text)
                all_relationships.extend(pattern_relationships)
                methods_used.append("pattern_matching")

            # Method 3: AI-enhanced extraction
            if (use_ai or self.config["use_ai_enhancement"]) and len(text) < 75000:
                ai_relationships, ai_analysis = await self._extract_with_ai(
                    text, entities
                )
                all_relationships.extend(ai_relationships)
                result.ai_analysis = ai_analysis
                methods_used.append("ai_enhancement")

            # Merge and filter relationships
            merged_relationships = self._merge_relationships(all_relationships)

            # Filter by confidence threshold
            filtered_relationships = [
                rel
                for rel in merged_relationships
                if rel.confidence >= self.config["min_confidence_threshold"]
            ]

            # Add context to relationships
            for relationship in filtered_relationships:
                if not relationship.context:
                    relationship.context = self._extract_relationship_context(
                        text, relationship
                    )

            # Build relationship graph
            relationship_graph = None
            if self.config["build_relationship_graph"]:
                relationship_graph = self._build_relationship_graph(
                    filtered_relationships
                )

            # Detect clusters if requested
            if self.config["detect_relationship_clusters"] and relationship_graph:
                relationship_graph.clusters = self._detect_relationship_clusters(
                    relationship_graph
                )

            # Calculate statistics
            statistics = self._calculate_relationship_statistics(filtered_relationships)

            result.relationships = filtered_relationships
            result.relationship_graph = relationship_graph
            result.statistics = statistics
            result.methods_used = methods_used
            result.success = True
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Relationships extracted successfully, time: {result.processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Relationship extraction failed: {str(e)}")
            self.logger.error(f"Relationship extraction error: {e}")

        return result

    async def _extract_with_dependencies(self, text: str) -> List[Relationship]:
        """Extract relationships using spaCy dependency parsing"""
        relationships = []

        # Process text with spaCy
        doc = self.nlp_model(text)

        # Extract using dependency matcher
        if self.dependency_matcher:
            matches = self.dependency_matcher(doc)

            for match_id, token_ids in matches:
                label = self.nlp_model.vocab.strings[match_id]
                tokens = [doc[i] for i in token_ids]

                # Extract the specific relationship based on pattern
                relationship = self._create_relationship_from_dependency_match(
                    label, tokens, doc
                )
                if relationship:
                    relationships.append(relationship)

        # Extract using sentence-level dependency analysis
        for sent in doc.sents:
            if len(sent) > self.config["max_sentence_length"]:
                continue

            sent_relationships = self._analyze_sentence_dependencies(sent)
            relationships.extend(sent_relationships)

        return relationships

    def _create_relationship_from_dependency_match(
        self, label: str, tokens: List[Token], doc: Doc
    ) -> Optional[Relationship]:
        """Create relationship from dependency matcher result"""
        if label == "PERSON_WORKS_ORG":
            person_token = next((t for t in tokens if t.ent_type_ == "PERSON"), None)
            org_token = next((t for t in tokens if t.ent_type_ == "ORG"), None)
            verb_token = next(
                (t for t in tokens if t.lemma_ in ["work", "employ", "join"]), None
            )

            if person_token and org_token and verb_token:
                return Relationship(
                    id=uuid7str(),
                    relationship_type=RelationshipType.PERSON_ORGANIZATION,
                    source_entity=person_token.text,
                    target_entity=org_token.text,
                    confidence=0.8,
                    evidence=f"{person_token.text} {verb_token.text} at {org_token.text}",
                    start_char=min(t.idx for t in tokens),
                    end_char=max(t.idx + len(t.text) for t in tokens),
                    extraction_method="dependency_pattern",
                    dependency_path=f"{person_token.dep_}->{verb_token.dep_}->{org_token.dep_}",
                )

        elif label == "ORG_USES_TECH":
            org_token = next((t for t in tokens if t.ent_type_ == "ORG"), None)
            tech_token = next(
                (t for t in tokens if t.ent_type_ in ["PRODUCT", "ORG"]), None
            )
            verb_token = next(
                (
                    t
                    for t in tokens
                    if t.lemma_ in ["use", "adopt", "implement", "deploy"]
                ),
                None,
            )

            if org_token and tech_token and verb_token:
                return Relationship(
                    id=uuid7str(),
                    relationship_type=RelationshipType.TECHNOLOGY_ORGANIZATION,
                    source_entity=tech_token.text,
                    target_entity=org_token.text,
                    confidence=0.7,
                    evidence=f"{org_token.text} {verb_token.text} {tech_token.text}",
                    start_char=min(t.idx for t in tokens),
                    end_char=max(t.idx + len(t.text) for t in tokens),
                    extraction_method="dependency_pattern",
                    dependency_path=f"{org_token.dep_}->{verb_token.dep_}->{tech_token.dep_}",
                )

        return None

    def _analyze_sentence_dependencies(self, sent: Span) -> List[Relationship]:
        """Analyze sentence for relationships using dependency parsing"""
        relationships = []

        # Look for subject-verb-object relationships
        for token in sent:
            if token.dep_ == "ROOT" and token.pos_ == "VERB":
                # Find subject
                subjects = [
                    child
                    for child in token.children
                    if child.dep_ in ["nsubj", "nsubjpass"]
                ]
                # Find objects
                objects = [
                    child
                    for child in token.children
                    if child.dep_ in ["dobj", "pobj", "iobj"]
                ]

                for subj in subjects:
                    for obj in objects:
                        # Check if this forms a meaningful relationship
                        relationship = self._create_relationship_from_svo(
                            subj, token, obj, sent
                        )
                        if relationship:
                            relationships.append(relationship)

        return relationships

    def _create_relationship_from_svo(
        self, subject: Token, verb: Token, obj: Token, sent: Span
    ) -> Optional[Relationship]:
        """Create relationship from subject-verb-object pattern"""
        # Determine relationship type based on verb and entities
        verb_lemma = verb.lemma_.lower()

        # Get entity types for subject and object
        subj_ent = (
            subject.ent_type_
            if subject.ent_type_
            else self._classify_token_entity_type(subject)
        )
        obj_ent = (
            obj.ent_type_ if obj.ent_type_ else self._classify_token_entity_type(obj)
        )

        # Map to relationship types
        relationship_type = self._map_svo_to_relationship_type(
            subj_ent, verb_lemma, obj_ent
        )

        if relationship_type:
            return Relationship(
                id=uuid7str(),
                relationship_type=relationship_type,
                source_entity=subject.text,
                target_entity=obj.text,
                confidence=0.6,  # Medium confidence for SVO patterns
                evidence=f"{subject.text} {verb.text} {obj.text}",
                start_char=min(subject.idx, verb.idx, obj.idx),
                end_char=max(
                    subject.idx + len(subject.text),
                    verb.idx + len(verb.text),
                    obj.idx + len(obj.text),
                ),
                extraction_method="dependency_svo",
                dependency_path=f"{subject.dep_}->{verb.dep_}->{obj.dep_}",
            )

        return None

    def _classify_token_entity_type(self, token: Token) -> str:
        """Classify token entity type for dependency analysis"""
        text_lower = token.text.lower()

        # Technical terms
        if text_lower in [
            "system",
            "application",
            "software",
            "platform",
            "api",
            "service",
        ]:
            return "TECH"

        # Business terms
        if text_lower in [
            "project",
            "initiative",
            "program",
            "requirement",
            "deliverable",
        ]:
            return "PROJECT"

        # Process terms
        if text_lower in ["process", "workflow", "procedure", "method"]:
            return "PROCESS"

        return token.pos_

    def _map_svo_to_relationship_type(
        self, subj_type: str, verb: str, obj_type: str
    ) -> Optional[RelationshipType]:
        """Map subject-verb-object pattern to relationship type"""
        # Person-Organization relationships
        if (
            subj_type == "PERSON"
            and verb in ["work", "join", "employ"]
            and obj_type == "ORG"
        ):
            return RelationshipType.PERSON_ORGANIZATION

        # Technology relationships
        if verb in ["use", "implement", "deploy", "adopt"]:
            if obj_type in ["TECH", "PRODUCT"]:
                return RelationshipType.TECHNOLOGY_ORGANIZATION

        # Project relationships
        if (
            subj_type == "PROJECT"
            and verb in ["require", "need"]
            and obj_type in ["TECH", "PRODUCT"]
        ):
            return RelationshipType.PROJECT_TECHNOLOGY

        # Dependency relationships
        if verb in ["depend", "require", "need", "rely"]:
            return RelationshipType.DEPENDENCY

        # Compliance relationships
        if verb in ["comply", "conform", "adhere"] and "with" in verb:
            return RelationshipType.COMPLIES_WITH

        return None

    async def _extract_with_patterns(self, text: str) -> List[Relationship]:
        """Extract relationships using textual patterns"""
        relationships = []

        if not self.matcher:
            return relationships

        # Process with spaCy for pattern matching
        doc = self.nlp_model(text)
        matches = self.matcher(doc)

        for match_id, start, end in matches:
            span = doc[start:end]
            label = self.nlp_model.vocab.strings[match_id]

            relationship = self._create_relationship_from_pattern_match(
                label, span, doc
            )
            if relationship:
                relationships.append(relationship)

        # Additional regex-based patterns
        regex_relationships = self._extract_with_regex_patterns(text)
        relationships.extend(regex_relationships)

        return relationships

    def _create_relationship_from_pattern_match(
        self, label: str, span: Span, doc: Doc
    ) -> Optional[Relationship]:
        """Create relationship from pattern matcher result"""
        if label == "COMPLIANCE_WITH":
            # Extract entities from the span
            entities = [ent for ent in span.ents]
            if entities:
                return Relationship(
                    id=uuid7str(),
                    relationship_type=RelationshipType.COMPLIES_WITH,
                    source_entity="System",  # Inferred
                    target_entity=entities[0].text,
                    confidence=0.7,
                    evidence=span.text,
                    start_char=span.start_char,
                    end_char=span.end_char,
                    extraction_method="pattern_matching",
                )

        elif label == "DEPENDENCY":
            # Find the dependent entities
            dependency_text = span.text
            # Simple extraction - in production would be more sophisticated
            words = [token.text for token in span if token.is_alpha]
            if len(words) >= 2:
                return Relationship(
                    id=uuid7str(),
                    relationship_type=RelationshipType.DEPENDENCY,
                    source_entity=words[0],
                    target_entity=" ".join(words[1:]),
                    confidence=0.6,
                    evidence=dependency_text,
                    start_char=span.start_char,
                    end_char=span.end_char,
                    extraction_method="pattern_matching",
                )

        return None

    def _extract_with_regex_patterns(self, text: str) -> List[Relationship]:
        """Extract relationships using regex patterns"""
        relationships = []

        # Pattern: X is managed by Y
        managed_by_pattern = r"(.+?)\s+is\s+managed\s+by\s+(.+?)(?:\.|,|$)"
        for match in re.finditer(managed_by_pattern, text, re.IGNORECASE):
            project = match.group(1).strip()
            manager = match.group(2).strip()

            relationship = Relationship(
                id=uuid7str(),
                relationship_type=RelationshipType.PROJECT_PERSON,
                source_entity=project,
                target_entity=manager,
                confidence=0.7,
                evidence=match.group(),
                start_char=match.start(),
                end_char=match.end(),
                extraction_method="regex_pattern",
            )
            relationships.append(relationship)

        # Pattern: X requires Y
        requires_pattern = r"(.+?)\s+requires?\s+(.+?)(?:\.|,|$)"
        for match in re.finditer(requires_pattern, text, re.IGNORECASE):
            source = match.group(1).strip()
            target = match.group(2).strip()

            relationship = Relationship(
                id=uuid7str(),
                relationship_type=RelationshipType.DEPENDENCY,
                source_entity=source,
                target_entity=target,
                confidence=0.6,
                evidence=match.group(),
                start_char=match.start(),
                end_char=match.end(),
                extraction_method="regex_pattern",
            )
            relationships.append(relationship)

        # Pattern: X integrates with Y
        integration_pattern = r"(.+?)\s+integrates?\s+with\s+(.+?)(?:\.|,|$)"
        for match in re.finditer(integration_pattern, text, re.IGNORECASE):
            system1 = match.group(1).strip()
            system2 = match.group(2).strip()

            relationship = Relationship(
                id=uuid7str(),
                relationship_type=RelationshipType.SYSTEM_INTEGRATION,
                source_entity=system1,
                target_entity=system2,
                confidence=0.8,
                evidence=match.group(),
                start_char=match.start(),
                end_char=match.end(),
                extraction_method="regex_pattern",
            )
            relationships.append(relationship)

        return relationships

    async def _extract_with_ai(
        self, text: str, entities: Optional[List[Any]]
    ) -> Tuple[List[Relationship], Dict[str, Any]]:
        """Extract relationships using AI enhancement"""
        relationships = []
        ai_analysis = {}

        try:
            # Split text into chunks if needed
            chunks = self._split_text_for_ai_analysis(text)

            for chunk_idx, chunk in enumerate(chunks):
                (
                    chunk_relationships,
                    chunk_analysis,
                ) = await self._analyze_chunk_for_relationships(
                    chunk, chunk_idx, entities
                )
                relationships.extend(chunk_relationships)
                ai_analysis[f"chunk_{chunk_idx}"] = chunk_analysis

            # Global relationship analysis
            if len(text) < self.config["ai_chunk_size"]:
                global_analysis = await self._perform_global_relationship_analysis(
                    text, entities
                )
                ai_analysis["global"] = global_analysis

        except Exception as e:
            self.logger.warning(f"AI relationship extraction failed: {e}")
            ai_analysis["error"] = str(e)

        return relationships, ai_analysis

    async def _analyze_chunk_for_relationships(
        self, chunk: str, chunk_idx: int, entities: Optional[List[Any]]
    ) -> Tuple[List[Relationship], Dict[str, Any]]:
        """Analyze chunk for relationships using AI"""
        entity_context = ""
        if entities:
            entity_list = [
                f"- {entity.text} ({entity.entity_type.value})"
                for entity in entities[:15]
            ]
            entity_context = f"\nKnown entities in document:\n" + "\n".join(entity_list)

        prompt = f"""Analyze this text and identify relationships between entities, concepts, and ideas.

Look for these relationship types:
- Person-Organization (works at, employed by)
- Technology-Organization (used by, implemented by)
- Project-Person (managed by, led by)
- Project-Technology (uses, requires)
- Dependencies (depends on, requires)
- Compliance (complies with, adheres to)
- Integration (integrates with, connects to)
- Temporal (precedes, follows)
- Business (client-vendor, partnership)

{entity_context}

Text to analyze:
{chunk}

For each relationship provide:
{{
  "relationships": [
    {{
      "source_entity": "Microsoft",
      "target_entity": "Azure",
      "relationship_type": "TECHNOLOGY_ORGANIZATION",
      "evidence": "Microsoft uses Azure for cloud services",
      "confidence": 0.9
    }}
  ],
  "analysis": {{
    "relationship_density": "high|medium|low",
    "dominant_relationship_types": ["TECHNOLOGY_ORGANIZATION"],
    "implicit_relationships": ["Azure enables Microsoft's cloud strategy"]
  }}
}}"""

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "top_p": 0.9, "num_predict": 2000},
                },
            )

            if response.status_code == 200:
                ai_response = response.json()
                response_text = ai_response.get("response", "").strip()

                try:
                    ai_data = json.loads(response_text)
                    relationships = self._convert_ai_relationships(
                        ai_data.get("relationships", []), chunk
                    )
                    analysis = ai_data.get("analysis", {})
                    analysis["raw_response"] = response_text
                    return relationships, analysis

                except json.JSONDecodeError:
                    relationships = self._parse_ai_text_relationships(
                        response_text, chunk
                    )
                    analysis = {
                        "raw_response": response_text,
                        "parsing_method": "text_fallback",
                    }
                    return relationships, analysis

        except Exception as e:
            self.logger.warning(f"AI chunk relationship analysis failed: {e}")

        return [], {"error": "AI analysis failed"}

    async def _perform_global_relationship_analysis(
        self, text: str, entities: Optional[List[Any]]
    ) -> Dict[str, Any]:
        """Perform global relationship analysis"""
        prompt = f"""Analyze the overall relationship patterns in this document.

Text (first 2500 characters):
{text[:2500]}...

Provide comprehensive analysis:
{{
  "relationship_overview": {{
    "total_relationships_estimated": 25,
    "relationship_complexity": "high|medium|low",
    "dominant_patterns": ["tech-org relationships", "project dependencies"],
    "document_domain": "technical|business|legal|mixed"
  }},
  "key_relationship_clusters": [
    {{"cluster_name": "Technology Stack", "entities": ["AWS", "Docker", "Kubernetes"], "relationship_type": "technical_dependencies"}},
    {{"cluster_name": "Project Team", "entities": ["John Smith", "Development Team", "Project Alpha"], "relationship_type": "organizational"}}
  ],
  "implicit_relationships": [
    {{"source": "AWS", "target": "High Availability", "type": "ENABLES", "reasoning": "AWS infrastructure supports high availability requirements"}}
  ],
  "relationship_gaps": ["Missing clear ownership relationships", "Unclear technical dependencies"]
}}"""

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )

            if response.status_code == 200:
                ai_response = response.json()
                response_text = ai_response.get("response", "").strip()

                try:
                    return json.loads(response_text)
                except json.JSONDecodeError:
                    return {"raw_response": response_text, "parsed": False}

        except Exception as e:
            self.logger.warning(f"Global relationship analysis failed: {e}")

        return {"error": "Global analysis failed"}

    def _convert_ai_relationships(
        self, ai_relationships: List[Dict[str, Any]], chunk: str
    ) -> List[Relationship]:
        """Convert AI relationships to Relationship objects"""
        relationships = []

        for ai_rel in ai_relationships:
            try:
                relationship_type = self._map_ai_type_to_relationship_type(
                    ai_rel.get("relationship_type", "DEPENDENCY")
                )

                relationship = Relationship(
                    id=uuid7str(),
                    relationship_type=relationship_type,
                    source_entity=ai_rel.get("source_entity", ""),
                    target_entity=ai_rel.get("target_entity", ""),
                    confidence=min(ai_rel.get("confidence", 0.5), 1.0),
                    evidence=ai_rel.get("evidence", ""),
                    extraction_method="ai_enhancement",
                    ai_insights={"source": "ollama", "original_data": ai_rel},
                )

                # Try to find positions in text
                evidence = relationship.evidence
                if evidence and evidence in chunk:
                    start_pos = chunk.find(evidence)
                    if start_pos != -1:
                        relationship.start_char = start_pos
                        relationship.end_char = start_pos + len(evidence)

                relationships.append(relationship)

            except Exception as e:
                self.logger.warning(f"Failed to convert AI relationship: {e}")
                continue

        return relationships

    def _parse_ai_text_relationships(
        self, response_text: str, chunk: str
    ) -> List[Relationship]:
        """Parse AI response as text when JSON parsing fails"""
        relationships = []
        lines = response_text.split("\n")

        current_source = None
        current_target = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Look for relationship indicators
            if (
                "->" in line
                or "relates to" in line.lower()
                or "connected to" in line.lower()
            ):
                parts = line.split("->")
                if len(parts) == 2:
                    current_source = parts[0].strip()
                    current_target = parts[1].strip()

                    relationship = Relationship(
                        id=uuid7str(),
                        relationship_type=RelationshipType.DEPENDENCY,  # Default
                        source_entity=current_source,
                        target_entity=current_target,
                        confidence=0.4,
                        evidence=line,
                        extraction_method="ai_text_parsing",
                        ai_insights={"source": "text_parsing"},
                    )
                    relationships.append(relationship)

        return relationships

    def _map_ai_type_to_relationship_type(self, ai_type: str) -> RelationshipType:
        """Map AI-detected type to RelationshipType enum"""
        ai_type_upper = ai_type.upper()

        # Try direct mapping first
        try:
            return RelationshipType(ai_type_upper)
        except ValueError:
            self.logger.warning("ValueError in _map_ai_type_to_relationship_type")

        # Fallback mappings
        mapping = {
            "WORKS_AT": RelationshipType.PERSON_ORGANIZATION,
            "USES": RelationshipType.TECHNOLOGY_ORGANIZATION,
            "MANAGED_BY": RelationshipType.PROJECT_PERSON,
            "REQUIRES": RelationshipType.DEPENDENCY,
            "INTEGRATES": RelationshipType.SYSTEM_INTEGRATION,
            "COMPLIES": RelationshipType.COMPLIES_WITH,
            "ENABLES": RelationshipType.ENABLES,
        }

        return mapping.get(ai_type_upper, RelationshipType.DEPENDENCY)

    def _merge_relationships(
        self, relationships: List[Relationship]
    ) -> List[Relationship]:
        """Merge and deduplicate similar relationships"""
        if not relationships:
            return []

        merged = []

        for relationship in relationships:
            # Check for similar relationships
            is_duplicate = False
            for existing in merged:
                if self._relationships_similar(relationship, existing):
                    # Keep the one with higher confidence
                    if relationship.confidence > existing.confidence:
                        merged.remove(existing)
                        merged.append(relationship)
                    is_duplicate = True
                    break

            if not is_duplicate:
                merged.append(relationship)

        return merged

    def _relationships_similar(self, rel1: Relationship, rel2: Relationship) -> bool:
        """Check if two relationships are similar"""
        return (
            rel1.relationship_type == rel2.relationship_type
            and self._entities_similar(rel1.source_entity, rel2.source_entity)
            and self._entities_similar(rel1.target_entity, rel2.target_entity)
        )

    def _entities_similar(self, entity1: str, entity2: str) -> bool:
        """Check if two entity strings are similar"""
        # Simple similarity check - could be enhanced with fuzzy matching
        return entity1.lower().strip() == entity2.lower().strip()

    def _extract_relationship_context(
        self, text: str, relationship: Relationship
    ) -> str:
        """Extract context around a relationship"""
        if relationship.start_char == 0 and relationship.end_char == 0:
            # No position information, try to find the evidence text
            if relationship.evidence in text:
                start_pos = text.find(relationship.evidence)
                end_pos = start_pos + len(relationship.evidence)
            else:
                return relationship.evidence
        else:
            start_pos = relationship.start_char
            end_pos = relationship.end_char

        # Extract context window
        window = self.config["context_window"]
        context_start = max(0, start_pos - window)
        context_end = min(len(text), end_pos + window)

        context = text[context_start:context_end]
        return context.replace("\n", " ").strip()

    def _build_relationship_graph(
        self, relationships: List[Relationship]
    ) -> RelationshipGraph:
        """Build a graph representation of relationships"""
        # Extract all entities
        entities = set()
        adjacency_matrix = {}

        for rel in relationships:
            entities.add(rel.source_entity)
            entities.add(rel.target_entity)

            if rel.source_entity not in adjacency_matrix:
                adjacency_matrix[rel.source_entity] = []
            adjacency_matrix[rel.source_entity].append(rel.target_entity)

        # Calculate graph statistics
        statistics = {
            "total_entities": len(entities),
            "total_relationships": len(relationships),
            "average_connections_per_entity": len(relationships)
            / max(len(entities), 1),
            "most_connected_entities": self._find_most_connected_entities(
                adjacency_matrix
            ),
            "relationship_type_distribution": self._get_relationship_type_distribution(
                relationships
            ),
        }

        return RelationshipGraph(
            relationships=relationships,
            entities=entities,
            adjacency_matrix=adjacency_matrix,
            statistics=statistics,
        )

    def _detect_relationship_clusters(self, graph: RelationshipGraph) -> List[Set[str]]:
        """Detect clusters of related entities"""
        # Simple clustering based on shared connections
        clusters = []
        processed_entities = set()

        for entity in graph.entities:
            if entity in processed_entities:
                continue

            # Find all entities connected to this one
            cluster = {entity}
            to_process = [entity]

            while to_process:
                current = to_process.pop()
                if current in graph.adjacency_matrix:
                    for connected in graph.adjacency_matrix[current]:
                        if connected not in cluster:
                            cluster.add(connected)
                            to_process.append(connected)

            if len(cluster) > 1:
                clusters.append(cluster)
                processed_entities.update(cluster)

        return clusters

    def _find_most_connected_entities(
        self, adjacency_matrix: Dict[str, List[str]]
    ) -> List[Tuple[str, int]]:
        """Find entities with the most connections"""
        connection_counts = {}

        for entity, connections in adjacency_matrix.items():
            connection_counts[entity] = len(connections)

        # Also count incoming connections
        for connections in adjacency_matrix.values():
            for target in connections:
                if target not in connection_counts:
                    connection_counts[target] = 0
                connection_counts[target] += 1

        # Sort by connection count
        sorted_entities = sorted(
            connection_counts.items(), key=lambda x: x[1], reverse=True
        )
        return sorted_entities[:10]  # Top 10

    def _get_relationship_type_distribution(
        self, relationships: List[Relationship]
    ) -> Dict[str, int]:
        """Get distribution of relationship types"""
        type_counts = {}
        for rel in relationships:
            rel_type = rel.relationship_type.value
            type_counts[rel_type] = type_counts.get(rel_type, 0) + 1
        return type_counts

    def _calculate_relationship_statistics(
        self, relationships: List[Relationship]
    ) -> Dict[str, Any]:
        """Calculate relationship statistics"""
        if not relationships:
            return {}

        confidence_sum = sum(rel.confidence for rel in relationships)
        method_counts = {}
        type_counts = {}

        for rel in relationships:
            # Count by extraction method
            method = rel.extraction_method
            method_counts[method] = method_counts.get(method, 0) + 1

            # Count by relationship type
            rel_type = rel.relationship_type.value
            type_counts[rel_type] = type_counts.get(rel_type, 0) + 1

        return {
            "total_relationships": len(relationships),
            "average_confidence": confidence_sum / len(relationships),
            "method_distribution": method_counts,
            "type_distribution": type_counts,
            "confidence_distribution": {
                "very_high": len([r for r in relationships if r.confidence >= 0.9]),
                "high": len([r for r in relationships if 0.7 <= r.confidence < 0.9]),
                "medium": len([r for r in relationships if 0.5 <= r.confidence < 0.7]),
                "low": len([r for r in relationships if 0.3 <= r.confidence < 0.5]),
                "very_low": len([r for r in relationships if r.confidence < 0.3]),
            },
            "relationships_with_evidence": len(
                [r for r in relationships if r.evidence]
            ),
            "dependency_parsing_relationships": len(
                [r for r in relationships if r.dependency_path]
            ),
        }

    def _split_text_for_ai_analysis(self, text: str) -> List[str]:
        """Split text into chunks for AI analysis"""
        if len(text) <= self.config["ai_chunk_size"]:
            return [text]

        chunks = []
        # Split by paragraphs to preserve context
        paragraphs = text.split("\n\n")
        current_chunk = ""

        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) <= self.config["ai_chunk_size"]:
                current_chunk += paragraph + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = paragraph + "\n\n"

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    async def analyze_relationship_patterns(
        self, relationships: List[Relationship]
    ) -> Dict[str, Any]:
        """Analyze patterns in extracted relationships"""
        if not relationships:
            return {"patterns": [], "analysis": "No relationships to analyze"}

        # Convert relationships to a format suitable for AI analysis
        rel_data = []
        for rel in relationships[:20]:  # Limit for AI analysis
            rel_data.append(
                {
                    "type": rel.relationship_type.value,
                    "source": rel.source_entity,
                    "target": rel.target_entity,
                    "evidence": rel.evidence,
                    "confidence": rel.confidence,
                }
            )

        prompt = f"""Analyze these relationship patterns and identify insights.

Relationships:
{json.dumps(rel_data, indent=2)}

Identify:
1. Common relationship patterns
2. Central entities (hubs)
3. Relationship chains or dependencies
4. Missing or implied relationships
5. Anomalies or inconsistencies

Provide analysis:
{{
  "patterns": [
    {{"pattern": "Technology Hub", "description": "Microsoft appears central to many technology relationships", "entities": ["Microsoft", "Azure", "Office 365"]}},
    {{"pattern": "Project Dependencies", "description": "Multiple projects depend on similar technologies", "relationships": ["Project A -> Azure", "Project B -> Azure"]}}
  ],
  "central_entities": [
    {{"entity": "Microsoft", "connection_count": 8, "importance": "high"}},
    {{"entity": "Azure", "connection_count": 5, "importance": "medium"}}
  ],
  "insights": ["Strong technology focus", "Clear organizational structure"],
  "gaps": ["Missing timeline relationships", "Unclear ownership structures"]
}}"""

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )

            if response.status_code == 200:
                ai_response = response.json()
                response_text = ai_response.get("response", "").strip()

                try:
                    return json.loads(response_text)
                except json.JSONDecodeError:
                    return {"raw_response": response_text, "parsed": False}

        except Exception as e:
            self.logger.warning(f"Relationship pattern analysis failed: {e}")

        return {"error": "Pattern analysis failed"}

    async def close(self):
        """Close the Ollama client"""
        await self.ollama_client.aclose()

    def get_extractor_info(self) -> Dict[str, Any]:
        """Get extractor information and capabilities"""
        return {
            "supported_relationship_types": [rtype.value for rtype in RelationshipType],
            "extraction_methods": [
                "dependency_parsing",
                "pattern_matching",
                "ai_enhancement",
            ],
            "spacy_available": HAS_SPACY_SUPPORT,
            "dependency_parsing_available": bool(
                self.nlp_model and "parser" in self.nlp_model.pipe_names
            ),
            "ai_model": self.config["ollama_model"],
            "config": self.config.copy(),
            "version": "1.0.0",
        }

# Factory function
def create_relationship_extractor(
    config: Optional[Dict[str, Any]] = None,
) -> RelationshipExtractor:
    """Create RelationshipExtractor instance with configuration"""
    return RelationshipExtractor(config)
