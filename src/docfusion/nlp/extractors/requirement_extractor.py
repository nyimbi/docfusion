#!/usr/bin/env python3
"""
Requirement Extractor

Specialized extractor for identifying and analyzing RFP (Request for Proposal)
requirements using pattern matching, NLP analysis, and Ollama-based AI understanding.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# Ollama integration for AI-powered requirement analysis
import json

import httpx
from ...core.utils import uuid7str
import time

class RequirementType(str, Enum):
    """Types of requirements in RFPs"""

    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non_functional"
    TECHNICAL = "technical"
    BUSINESS = "business"
    COMPLIANCE = "compliance"
    LEGAL = "legal"
    PERFORMANCE = "performance"
    SECURITY = "security"
    INTEGRATION = "integration"
    DELIVERABLE = "deliverable"
    TIMELINE = "timeline"
    BUDGET = "budget"
    STAFFING = "staffing"
    EXPERIENCE = "experience"
    CERTIFICATION = "certification"
    PROPOSAL_FORMAT = "proposal_format"
    EVALUATION = "evaluation"
    CONTRACT = "contract"

class RequirementPriority(str, Enum):
    """Priority levels for requirements"""

    MANDATORY = "mandatory"
    ESSENTIAL = "essential"
    PREFERRED = "preferred"
    DESIRABLE = "desirable"
    OPTIONAL = "optional"

class RequirementClarity(str, Enum):
    """Clarity assessment of requirements"""

    CLEAR = "clear"
    SOMEWHAT_CLEAR = "somewhat_clear"
    AMBIGUOUS = "ambiguous"
    UNCLEAR = "unclear"

@dataclass
class Requirement:
    """Individual requirement extracted from RFP"""

    id: str
    text: str
    requirement_type: RequirementType
    priority: RequirementPriority
    clarity: RequirementClarity
    section: Optional[str] = None
    subsection: Optional[str] = None
    start_char: int = 0
    end_char: int = 0
    confidence: float = 0.0
    related_requirements: List[str] = None
    keywords: List[str] = None
    entities: List[Dict[str, Any]] = None
    compliance_indicators: List[str] = None
    measurement_criteria: Optional[str] = None
    ai_analysis: Dict[str, Any] = None

    def __post_init__(self):
        if self.related_requirements is None:
            self.related_requirements = []
        if self.keywords is None:
            self.keywords = []
        if self.entities is None:
            self.entities = []
        if self.compliance_indicators is None:
            self.compliance_indicators = []
        if self.ai_analysis is None:
            self.ai_analysis = {}

@dataclass
class RequirementGroup:
    """Group of related requirements"""

    id: str
    name: str
    requirements: List[str]  # Requirement IDs
    group_type: str
    priority: RequirementPriority
    description: Optional[str] = None
    dependencies: List[str] = None

    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

class RequirementExtractionResult:
    """Result of requirement extraction"""

    def __init__(self):
        self.success: bool = False
        self.original_text: str = ""
        self.requirements: List[Requirement] = []
        self.requirement_groups: List[RequirementGroup] = []
        self.statistics: Dict[str, Any] = {}
        self.document_analysis: Dict[str, Any] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.processing_time: float = 0.0
        self.methods_used: List[str] = []

class RequirementExtractor:
    """Advanced RFP requirement extractor with AI enhancement"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._get_default_config()
        self.logger = logging.getLogger(__name__)

        # Initialize Ollama client
        self.ollama_client = httpx.AsyncClient(
            base_url=self.config["ollama_base_url"],
            timeout=self.config["ollama_timeout"],
        )

        # Compile patterns
        self._compile_patterns()

        # Load requirement vocabularies
        self._load_vocabularies()

        self.logger.info("Requirement extractor initialized")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            # Ollama settings
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.2:3b",
            "ollama_timeout": 180.0,
            "use_ai_analysis": True,
            # Extraction methods
            "use_pattern_matching": True,
            "use_keyword_detection": True,
            "use_section_analysis": True,
            "use_ai_enhancement": True,
            "use_context_analysis": True,
            # Pattern recognition settings
            "mandatory_indicators": [
                "must",
                "shall",
                "required",
                "mandatory",
                "essential",
                "needs to",
                "has to",
                "is required to",
                "obligated to",
            ],
            "optional_indicators": [
                "may",
                "should",
                "could",
                "preferred",
                "desirable",
                "nice to have",
                "optional",
                "if possible",
            ],
            "compliance_indicators": [
                "comply with",
                "accordance with",
                "conform to",
                "meet standards",
                "certification",
                "accreditation",
                "regulation",
                "policy",
            ],
            # Section identification
            "requirement_sections": [
                "requirements",
                "specifications",
                "scope of work",
                "technical requirements",
                "functional requirements",
                "deliverables",
                "objectives",
                "criteria",
                "standards",
            ],
            # AI processing settings
            "ai_chunk_size": 4000,
            "min_confidence_threshold": 0.4,
            "max_requirements_per_chunk": 50,
            # Output settings
            "group_related_requirements": True,
            "extract_measurement_criteria": True,
            "analyze_requirement_clarity": True,
            "identify_dependencies": True,
        }

    def _compile_patterns(self):
        """Compile regex patterns for requirement detection"""
        # Mandatory requirement patterns
        mandatory_words = "|".join(
            re.escape(word) for word in self.config["mandatory_indicators"]
        )
        self.mandatory_pattern = re.compile(
            rf"\b(?:{mandatory_words})\b.*?(?:\.|;|$)", re.IGNORECASE | re.MULTILINE
        )

        # Optional requirement patterns
        optional_words = "|".join(
            re.escape(word) for word in self.config["optional_indicators"]
        )
        self.optional_pattern = re.compile(
            rf"\b(?:{optional_words})\b.*?(?:\.|;|$)", re.IGNORECASE | re.MULTILINE
        )

        # Compliance patterns
        compliance_words = "|".join(
            re.escape(word) for word in self.config["compliance_indicators"]
        )
        self.compliance_pattern = re.compile(
            rf"\b(?:{compliance_words})\b.*?(?:\.|;|$)", re.IGNORECASE | re.MULTILINE
        )

        # Numbered requirements
        self.numbered_req_pattern = re.compile(
            r"^\s*\d+(?:\.\d+)*\.\s+(.+?)(?=^\s*\d+(?:\.\d+)*\.|$)",
            re.MULTILINE | re.DOTALL,
        )

        # Bullet point requirements
        self.bullet_req_pattern = re.compile(
            r"^\s*[•\-\*]\s+(.+?)(?=^\s*[•\-\*]|$)", re.MULTILINE | re.DOTALL
        )

        # Measurement criteria patterns
        self.measurement_pattern = re.compile(
            r"\b(?:minimum|maximum|at least|no more than|within|exceed)\s+\d+.*?(?:\.|;|$)",
            re.IGNORECASE,
        )

    def _load_vocabularies(self):
        """Load domain-specific vocabularies"""
        self.technical_keywords = {
            "software",
            "application",
            "system",
            "platform",
            "database",
            "api",
            "interface",
            "integration",
            "architecture",
            "framework",
            "security",
            "authentication",
            "authorization",
            "encryption",
            "performance",
            "scalability",
            "availability",
            "reliability",
            "backup",
            "recovery",
            "monitoring",
            "logging",
            "testing",
        }

        self.business_keywords = {
            "process",
            "workflow",
            "business rule",
            "governance",
            "compliance",
            "audit",
            "reporting",
            "analytics",
            "user experience",
            "training",
            "support",
            "maintenance",
            "budget",
            "cost",
            "timeline",
            "deliverable",
            "milestone",
        }

        self.compliance_keywords = {
            "gdpr",
            "hipaa",
            "sox",
            "pci",
            "iso",
            "nist",
            "cmmi",
            "regulation",
            "standard",
            "policy",
            "procedure",
            "certification",
            "accreditation",
            "audit",
        }

    async def extract_requirements(
        self,
        text: str,
        document_type: Optional[str] = None,
        use_ai: Optional[bool] = None,
    ) -> RequirementExtractionResult:
        """Extract requirements from RFP document"""
        start_time = time.monotonic()
        result = RequirementExtractionResult()
        result.original_text = text

        if not text or not text.strip():
            result.success = True
            return result

        try:
            methods_used = []
            all_requirements = []

            # Method 1: Pattern-based extraction
            if self.config["use_pattern_matching"]:
                pattern_reqs = await self._pattern_based_extraction(text)
                all_requirements.extend(pattern_reqs)
                methods_used.append("pattern_matching")

            # Method 2: Keyword-based extraction
            if self.config["use_keyword_detection"]:
                keyword_reqs = await self._keyword_based_extraction(text)
                all_requirements.extend(keyword_reqs)
                methods_used.append("keyword_detection")

            # Method 3: Section-based extraction
            if self.config["use_section_analysis"]:
                section_reqs = await self._section_based_extraction(text)
                all_requirements.extend(section_reqs)
                methods_used.append("section_analysis")

            # Method 4: AI-enhanced extraction
            if (use_ai or self.config["use_ai_enhancement"]) and len(text) < 100000:
                ai_reqs, doc_analysis = await self._ai_enhanced_extraction(
                    text, document_type
                )
                all_requirements.extend(ai_reqs)
                result.document_analysis = doc_analysis
                methods_used.append("ai_enhancement")

            # Merge and deduplicate requirements
            merged_requirements = self._merge_requirements(all_requirements)

            # Analyze and classify requirements
            analyzed_requirements = await self._analyze_requirements(
                merged_requirements, text
            )

            # Group related requirements
            requirement_groups = []
            if self.config["group_related_requirements"]:
                requirement_groups = self._group_requirements(analyzed_requirements)

            # Calculate statistics
            statistics = self._calculate_statistics(analyzed_requirements)

            result.requirements = analyzed_requirements
            result.requirement_groups = requirement_groups
            result.statistics = statistics
            result.methods_used = methods_used
            result.success = True
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Requirements extracted successfully, time: {result.processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Requirement extraction failed: {str(e)}")
            self.logger.error(f"Requirement extraction error: {e}")

        return result

    async def _pattern_based_extraction(self, text: str) -> List[Requirement]:
        """Extract requirements using pattern matching"""
        requirements = []

        # Extract mandatory requirements
        mandatory_matches = self.mandatory_pattern.finditer(text)
        for match in mandatory_matches:
            req = Requirement(
                id=uuid7str(),
                text=match.group().strip(),
                requirement_type=RequirementType.FUNCTIONAL,  # Default
                priority=RequirementPriority.MANDATORY,
                clarity=RequirementClarity.CLEAR,
                start_char=match.start(),
                end_char=match.end(),
                confidence=0.8,
            )
            requirements.append(req)

        # Extract optional requirements
        optional_matches = self.optional_pattern.finditer(text)
        for match in optional_matches:
            req = Requirement(
                id=uuid7str(),
                text=match.group().strip(),
                requirement_type=RequirementType.FUNCTIONAL,
                priority=RequirementPriority.PREFERRED,
                clarity=RequirementClarity.CLEAR,
                start_char=match.start(),
                end_char=match.end(),
                confidence=0.7,
            )
            requirements.append(req)

        # Extract compliance requirements
        compliance_matches = self.compliance_pattern.finditer(text)
        for match in compliance_matches:
            req = Requirement(
                id=uuid7str(),
                text=match.group().strip(),
                requirement_type=RequirementType.COMPLIANCE,
                priority=RequirementPriority.MANDATORY,
                clarity=RequirementClarity.CLEAR,
                start_char=match.start(),
                end_char=match.end(),
                confidence=0.9,
            )
            requirements.append(req)

        # Extract numbered requirements
        numbered_matches = self.numbered_req_pattern.finditer(text)
        for match in numbered_matches:
            req = Requirement(
                id=uuid7str(),
                text=match.group(1).strip(),
                requirement_type=RequirementType.FUNCTIONAL,
                priority=RequirementPriority.MANDATORY,
                clarity=RequirementClarity.CLEAR,
                start_char=match.start(),
                end_char=match.end(),
                confidence=0.7,
            )
            requirements.append(req)

        # Extract bullet point requirements
        bullet_matches = self.bullet_req_pattern.finditer(text)
        for match in bullet_matches:
            req = Requirement(
                id=uuid7str(),
                text=match.group(1).strip(),
                requirement_type=RequirementType.FUNCTIONAL,
                priority=RequirementPriority.ESSENTIAL,
                clarity=RequirementClarity.CLEAR,
                start_char=match.start(),
                end_char=match.end(),
                confidence=0.6,
            )
            requirements.append(req)

        return requirements

    async def _keyword_based_extraction(self, text: str) -> List[Requirement]:
        """Extract requirements using keyword detection"""
        requirements = []
        sentences = re.split(r"[.!?]+", text)
        char_offset = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence or len(sentence) < 10:
                char_offset += len(sentence) + 1
                continue

            # Check for technical keywords
            tech_score = sum(
                1
                for keyword in self.technical_keywords
                if keyword.lower() in sentence.lower()
            )

            # Check for business keywords
            business_score = sum(
                1
                for keyword in self.business_keywords
                if keyword.lower() in sentence.lower()
            )

            # Check for compliance keywords
            compliance_score = sum(
                1
                for keyword in self.compliance_keywords
                if keyword.lower() in sentence.lower()
            )

            # Determine if sentence contains requirements
            if tech_score >= 2 or business_score >= 2 or compliance_score >= 1:
                req_type = (
                    RequirementType.TECHNICAL
                    if tech_score > business_score
                    else RequirementType.BUSINESS
                )
                if compliance_score > 0:
                    req_type = RequirementType.COMPLIANCE

                priority = self._determine_priority_from_text(sentence)
                confidence = min(
                    0.9, 0.3 + (tech_score + business_score + compliance_score) * 0.1
                )

                req = Requirement(
                    id=uuid7str(),
                    text=sentence,
                    requirement_type=req_type,
                    priority=priority,
                    clarity=RequirementClarity.SOMEWHAT_CLEAR,
                    start_char=char_offset,
                    end_char=char_offset + len(sentence),
                    confidence=confidence,
                    keywords=self._extract_keywords_from_sentence(sentence),
                )
                requirements.append(req)

            char_offset += len(sentence) + 1

        return requirements

    async def _section_based_extraction(self, text: str) -> List[Requirement]:
        """Extract requirements based on document sections"""
        requirements = []

        # Find requirement sections
        for section_name in self.config["requirement_sections"]:
            pattern = rf"(?i)^.*{re.escape(section_name)}.*?$\s*(.*?)(?=^[A-Z][A-Za-z\s]*:?\s*$|\Z)"
            matches = re.finditer(pattern, text, re.MULTILINE | re.DOTALL)

            for match in matches:
                section_text = match.group(1).strip()
                if not section_text:
                    continue

                # Extract individual requirements from section
                section_requirements = await self._extract_from_section(
                    section_text, section_name, match.start()
                )
                requirements.extend(section_requirements)

        return requirements

    async def _extract_from_section(
        self, section_text: str, section_name: str, offset: int
    ) -> List[Requirement]:
        """Extract requirements from a specific section"""
        requirements = []

        # Split into potential requirements
        potential_reqs = re.split(r"\n(?=\s*(?:\d+\.|[•\-\*]|\w))", section_text)
        char_offset = offset

        for text_chunk in potential_reqs:
            text_chunk = text_chunk.strip()
            if len(text_chunk) < 15:  # Too short to be a meaningful requirement
                char_offset += len(text_chunk) + 1
                continue

            # Determine requirement type based on section
            req_type = self._map_section_to_requirement_type(section_name)
            priority = self._determine_priority_from_text(text_chunk)
            clarity = self._assess_requirement_clarity(text_chunk)

            req = Requirement(
                id=uuid7str(),
                text=text_chunk,
                requirement_type=req_type,
                priority=priority,
                clarity=clarity,
                section=section_name,
                start_char=char_offset,
                end_char=char_offset + len(text_chunk),
                confidence=0.6,
            )

            # Extract measurement criteria if present
            measurement_match = self.measurement_pattern.search(text_chunk)
            if measurement_match:
                req.measurement_criteria = measurement_match.group()
                req.confidence += 0.2

            requirements.append(req)
            char_offset += len(text_chunk) + 1

        return requirements

    async def _ai_enhanced_extraction(
        self, text: str, document_type: Optional[str]
    ) -> Tuple[List[Requirement], Dict[str, Any]]:
        """Extract requirements using AI analysis"""
        requirements = []
        document_analysis = {}

        try:
            # Split into chunks if text is large
            chunks = self._split_text_for_ai_analysis(text)

            for chunk_idx, chunk in enumerate(chunks):
                chunk_reqs, chunk_analysis = await self._analyze_chunk_for_requirements(
                    chunk, chunk_idx, document_type
                )
                requirements.extend(chunk_reqs)
                document_analysis[f"chunk_{chunk_idx}"] = chunk_analysis

            # Perform global analysis
            if len(text) < self.config["ai_chunk_size"]:
                global_analysis = await self._perform_global_requirement_analysis(
                    text, document_type
                )
                document_analysis["global"] = global_analysis

        except Exception as e:
            self.logger.warning(f"AI requirement extraction failed: {e}")
            document_analysis["error"] = str(e)

        return requirements, document_analysis

    async def _analyze_chunk_for_requirements(
        self, chunk: str, chunk_idx: int, document_type: Optional[str]
    ) -> Tuple[List[Requirement], Dict[str, Any]]:
        """Analyze a chunk of text for requirements using AI"""
        prompt = f"""Analyze this RFP document text and identify all requirements.

For each requirement, provide:
1. The requirement text
2. Type (functional, technical, business, compliance, performance, etc.)
3. Priority (mandatory, essential, preferred, desirable, optional)
4. Clarity assessment (clear, somewhat_clear, ambiguous, unclear)
5. Any measurement criteria mentioned
6. Confidence score (0.0-1.0)

Document type: {document_type or "Unknown"}

Text to analyze:
{chunk}

Provide JSON response with requirements array:
{{
  "requirements": [
    {{
      "text": "The system must support 1000 concurrent users",
      "type": "performance",
      "priority": "mandatory",
      "clarity": "clear",
      "measurement_criteria": "1000 concurrent users",
      "confidence": 0.9
    }}
  ],
  "document_insights": {{
    "requirement_density": "high|medium|low",
    "overall_clarity": 0.8,
    "dominant_requirement_types": ["technical", "functional"]
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
                    requirements = self._convert_ai_requirements(
                        ai_data.get("requirements", []), chunk
                    )
                    analysis = ai_data.get("document_insights", {})
                    analysis["raw_response"] = response_text
                    return requirements, analysis

                except json.JSONDecodeError:
                    # Fallback text parsing
                    requirements = self._parse_ai_text_requirements(
                        response_text, chunk
                    )
                    analysis = {
                        "raw_response": response_text,
                        "parsing_method": "text_fallback",
                    }
                    return requirements, analysis

        except Exception as e:
            self.logger.warning(f"AI chunk analysis failed: {e}")

        return [], {"error": "AI analysis failed"}

    async def _perform_global_requirement_analysis(
        self, text: str, document_type: Optional[str]
    ) -> Dict[str, Any]:
        """Perform global analysis of requirements"""
        prompt = f"""Analyze this RFP document comprehensively and provide insights about the requirements.

Document type: {document_type or "Unknown"}

Document text (first 3000 characters):
{text[:3000]}...

Provide analysis:
{{
  "document_type_assessment": "rfp|proposal|specification",
  "total_estimated_requirements": 25,
  "requirement_complexity": "high|medium|low",
  "clarity_assessment": "good|fair|poor",
  "key_requirement_categories": ["technical", "functional", "compliance"],
  "critical_areas": ["area1", "area2"],
  "missing_requirement_areas": ["area1", "area2"],
  "overall_assessment": "Well-structured RFP with clear requirements"
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
            self.logger.warning(f"Global requirement analysis failed: {e}")

        return {"error": "Global analysis failed"}

    def _convert_ai_requirements(
        self, ai_requirements: List[Dict[str, Any]], chunk: str
    ) -> List[Requirement]:
        """Convert AI analysis results to Requirement objects"""
        requirements = []

        for ai_req in ai_requirements:
            try:
                req = Requirement(
                    id=uuid7str(),
                    text=ai_req.get("text", ""),
                    requirement_type=self._map_ai_type_to_requirement_type(
                        ai_req.get("type", "functional")
                    ),
                    priority=self._map_ai_priority_to_requirement_priority(
                        ai_req.get("priority", "essential")
                    ),
                    clarity=self._map_ai_clarity_to_requirement_clarity(
                        ai_req.get("clarity", "clear")
                    ),
                    confidence=min(ai_req.get("confidence", 0.5), 1.0),
                    measurement_criteria=ai_req.get("measurement_criteria"),
                    ai_analysis={"source": "ollama", "original_data": ai_req},
                )

                # Find position in text (approximate)
                req_text = req.text[:50]  # First 50 chars for search
                start_pos = chunk.find(req_text)
                if start_pos != -1:
                    req.start_char = start_pos
                    req.end_char = start_pos + len(req.text)

                requirements.append(req)

            except Exception as e:
                self.logger.warning(f"Failed to convert AI requirement: {e}")
                continue

        return requirements

    def _parse_ai_text_requirements(
        self, response_text: str, chunk: str
    ) -> List[Requirement]:
        """Parse AI response as text when JSON parsing fails"""
        requirements = []
        lines = response_text.split("\n")

        current_requirement = None
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Look for requirement indicators
            if any(
                indicator in line.lower()
                for indicator in ["requirement:", "must", "shall", "should"]
            ):
                if current_requirement:
                    requirements.append(current_requirement)

                current_requirement = Requirement(
                    id=uuid7str(),
                    text=line,
                    requirement_type=RequirementType.FUNCTIONAL,
                    priority=RequirementPriority.ESSENTIAL,
                    clarity=RequirementClarity.SOMEWHAT_CLEAR,
                    confidence=0.4,
                    ai_analysis={"source": "text_parsing"},
                )

        if current_requirement:
            requirements.append(current_requirement)

        return requirements

    def _map_ai_type_to_requirement_type(self, ai_type: str) -> RequirementType:
        """Map AI-detected type to RequirementType enum"""
        type_mapping = {
            "functional": RequirementType.FUNCTIONAL,
            "non_functional": RequirementType.NON_FUNCTIONAL,
            "technical": RequirementType.TECHNICAL,
            "business": RequirementType.BUSINESS,
            "compliance": RequirementType.COMPLIANCE,
            "legal": RequirementType.LEGAL,
            "performance": RequirementType.PERFORMANCE,
            "security": RequirementType.SECURITY,
            "integration": RequirementType.INTEGRATION,
            "deliverable": RequirementType.DELIVERABLE,
            "timeline": RequirementType.TIMELINE,
            "budget": RequirementType.BUDGET,
        }

        return type_mapping.get(ai_type.lower(), RequirementType.FUNCTIONAL)

    def _map_ai_priority_to_requirement_priority(
        self, ai_priority: str
    ) -> RequirementPriority:
        """Map AI-detected priority to RequirementPriority enum"""
        priority_mapping = {
            "mandatory": RequirementPriority.MANDATORY,
            "essential": RequirementPriority.ESSENTIAL,
            "preferred": RequirementPriority.PREFERRED,
            "desirable": RequirementPriority.DESIRABLE,
            "optional": RequirementPriority.OPTIONAL,
        }

        return priority_mapping.get(ai_priority.lower(), RequirementPriority.ESSENTIAL)

    def _map_ai_clarity_to_requirement_clarity(
        self, ai_clarity: str
    ) -> RequirementClarity:
        """Map AI-detected clarity to RequirementClarity enum"""
        clarity_mapping = {
            "clear": RequirementClarity.CLEAR,
            "somewhat_clear": RequirementClarity.SOMEWHAT_CLEAR,
            "ambiguous": RequirementClarity.AMBIGUOUS,
            "unclear": RequirementClarity.UNCLEAR,
        }

        return clarity_mapping.get(
            ai_clarity.lower(), RequirementClarity.SOMEWHAT_CLEAR
        )

    def _merge_requirements(self, requirements: List[Requirement]) -> List[Requirement]:
        """Merge and deduplicate requirements from different extraction methods"""
        if not requirements:
            return []

        # Sort by position
        requirements.sort(key=lambda x: (x.start_char, x.end_char))

        # Simple deduplication based on text similarity
        merged = []
        for req in requirements:
            # Check for similar requirements
            is_duplicate = False
            for existing in merged:
                if self._calculate_text_similarity(req.text, existing.text) > 0.8:
                    # Keep the one with higher confidence
                    if req.confidence > existing.confidence:
                        merged.remove(existing)
                        merged.append(req)
                    is_duplicate = True
                    break

            if not is_duplicate:
                merged.append(req)

        return merged

    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple text similarity"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1.intersection(words2)
        union = words1.union(words2)

        return len(intersection) / len(union) if union else 0.0

    async def _analyze_requirements(
        self, requirements: List[Requirement], full_text: str
    ) -> List[Requirement]:
        """Analyze and enhance requirement data"""
        for req in requirements:
            # Extract keywords
            if not req.keywords:
                req.keywords = self._extract_keywords_from_sentence(req.text)

            # Assess clarity if not already done
            if req.clarity == RequirementClarity.SOMEWHAT_CLEAR:
                req.clarity = self._assess_requirement_clarity(req.text)

            # Extract compliance indicators
            req.compliance_indicators = self._extract_compliance_indicators(req.text)

            # Determine section/subsection context
            if not req.section:
                req.section = self._determine_section_context(req, full_text)

        return requirements

    def _group_requirements(
        self, requirements: List[Requirement]
    ) -> List[RequirementGroup]:
        """Group related requirements"""
        groups = []

        # Group by type
        type_groups = {}
        for req in requirements:
            req_type = req.requirement_type.value
            if req_type not in type_groups:
                type_groups[req_type] = []
            type_groups[req_type].append(req.id)

        for req_type, req_ids in type_groups.items():
            if len(req_ids) > 1:  # Only create groups with multiple requirements
                # Determine group priority based on constituent requirements
                req_priorities = [
                    req.priority for req in requirements if req.id in req_ids
                ]
                group_priority = (
                    min(req_priorities)
                    if req_priorities
                    else RequirementPriority.ESSENTIAL
                )

                group = RequirementGroup(
                    id=uuid7str(),
                    name=f"{req_type.title()} Requirements",
                    requirements=req_ids,
                    group_type=req_type,
                    priority=group_priority,
                    description=f"All {req_type} requirements grouped together",
                )
                groups.append(group)

        return groups

    def _calculate_statistics(self, requirements: List[Requirement]) -> Dict[str, Any]:
        """Calculate requirement statistics"""
        if not requirements:
            return {}

        type_counts = {}
        priority_counts = {}
        clarity_counts = {}
        total_confidence = 0

        for req in requirements:
            # Count by type
            req_type = req.requirement_type.value
            type_counts[req_type] = type_counts.get(req_type, 0) + 1

            # Count by priority
            priority = req.priority.value
            priority_counts[priority] = priority_counts.get(priority, 0) + 1

            # Count by clarity
            clarity = req.clarity.value
            clarity_counts[clarity] = clarity_counts.get(clarity, 0) + 1

            # Sum confidence
            total_confidence += req.confidence

        return {
            "total_requirements": len(requirements),
            "type_distribution": type_counts,
            "priority_distribution": priority_counts,
            "clarity_distribution": clarity_counts,
            "average_confidence": total_confidence / len(requirements),
            "requirements_with_measurements": len(
                [r for r in requirements if r.measurement_criteria]
            ),
            "compliance_requirements": len(
                [
                    r
                    for r in requirements
                    if r.requirement_type == RequirementType.COMPLIANCE
                ]
            ),
            "mandatory_requirements": len(
                [r for r in requirements if r.priority == RequirementPriority.MANDATORY]
            ),
            "unclear_requirements": len(
                [
                    r
                    for r in requirements
                    if r.clarity
                    in [RequirementClarity.AMBIGUOUS, RequirementClarity.UNCLEAR]
                ]
            ),
        }

    def _determine_priority_from_text(self, text: str) -> RequirementPriority:
        """Determine requirement priority from text"""
        text_lower = text.lower()

        if any(
            word in text_lower for word in ["must", "shall", "required", "mandatory"]
        ):
            return RequirementPriority.MANDATORY
        elif any(word in text_lower for word in ["should", "expected", "essential"]):
            return RequirementPriority.ESSENTIAL
        elif any(
            word in text_lower for word in ["preferred", "desirable", "nice to have"]
        ):
            return RequirementPriority.PREFERRED
        elif any(word in text_lower for word in ["may", "could", "optional"]):
            return RequirementPriority.OPTIONAL
        else:
            return RequirementPriority.ESSENTIAL  # Default

    def _assess_requirement_clarity(self, text: str) -> RequirementClarity:
        """Assess the clarity of a requirement"""
        # Simple heuristics for clarity assessment
        text_lower = text.lower()

        # Indicators of unclear requirements
        unclear_indicators = [
            "tbd",
            "tba",
            "appropriate",
            "reasonable",
            "sufficient",
            "adequate",
        ]
        ambiguous_indicators = ["may", "might", "could potentially", "as needed"]

        if any(indicator in text_lower for indicator in unclear_indicators):
            return RequirementClarity.UNCLEAR
        elif any(indicator in text_lower for indicator in ambiguous_indicators):
            return RequirementClarity.AMBIGUOUS
        elif len(text.split()) < 5:  # Very short requirements might be unclear
            return RequirementClarity.AMBIGUOUS
        else:
            return RequirementClarity.CLEAR

    def _extract_keywords_from_sentence(self, text: str) -> List[str]:
        """Extract relevant keywords from a sentence"""
        # Combine all keyword sets
        all_keywords = self.technical_keywords.union(self.business_keywords).union(
            self.compliance_keywords
        )

        text_lower = text.lower()
        found_keywords = []

        for keyword in all_keywords:
            if keyword.lower() in text_lower:
                found_keywords.append(keyword)

        return found_keywords

    def _extract_compliance_indicators(self, text: str) -> List[str]:
        """Extract compliance indicators from text"""
        indicators = []
        text_lower = text.lower()

        for indicator in self.config["compliance_indicators"]:
            if indicator in text_lower:
                indicators.append(indicator)

        return indicators

    def _map_section_to_requirement_type(self, section_name: str) -> RequirementType:
        """Map section name to requirement type"""
        section_lower = section_name.lower()

        if "technical" in section_lower:
            return RequirementType.TECHNICAL
        elif "functional" in section_lower:
            return RequirementType.FUNCTIONAL
        elif "business" in section_lower:
            return RequirementType.BUSINESS
        elif "compliance" in section_lower or "legal" in section_lower:
            return RequirementType.COMPLIANCE
        elif "deliverable" in section_lower:
            return RequirementType.DELIVERABLE
        elif "performance" in section_lower:
            return RequirementType.PERFORMANCE
        elif "security" in section_lower:
            return RequirementType.SECURITY
        else:
            return RequirementType.FUNCTIONAL

    def _determine_section_context(
        self, requirement: Requirement, full_text: str
    ) -> Optional[str]:
        """Determine which section a requirement belongs to"""
        # Simple implementation - would be enhanced in production
        req_position = requirement.start_char

        # Look for section headers before this position
        text_before = full_text[:req_position]
        lines = text_before.split("\n")

        # Find the most recent section header
        for line in reversed(lines[-20:]):  # Check last 20 lines
            line = line.strip()
            if any(
                section in line.lower()
                for section in self.config["requirement_sections"]
            ):
                return line

        return None

    def _split_text_for_ai_analysis(self, text: str) -> List[str]:
        """Split text into chunks for AI analysis"""
        if len(text) <= self.config["ai_chunk_size"]:
            return [text]

        chunks = []
        # Split by paragraphs first, then by sentences if needed
        paragraphs = re.split(r"\n\s*\n", text)
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

    async def identify_missing_requirements(
        self, text: str, domain: str = "general"
    ) -> Dict[str, Any]:
        """Identify potentially missing requirements"""
        prompt = f"""Analyze this RFP document and identify potentially missing requirement categories.

Domain: {domain}

Common requirement categories to check for:
- Functional requirements
- Non-functional requirements (performance, security, usability)
- Technical requirements (platforms, integrations)
- Business requirements (processes, workflows)
- Compliance requirements (regulations, standards)
- Legal requirements (contracts, liability)
- Operational requirements (support, maintenance)
- Timeline and budget requirements

Document text:
{text[:3000]}...

Identify what requirement categories might be missing:
{{
  "missing_categories": ["category1", "category2"],
  "weak_areas": ["area1", "area2"],
  "recommendations": ["rec1", "rec2"],
  "assessment": "Brief assessment of requirement completeness"
}}"""

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2},
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
            self.logger.warning(f"Missing requirements analysis failed: {e}")

        return {"error": "Analysis failed"}

    async def close(self):
        """Close the Ollama client"""
        await self.ollama_client.aclose()

    def get_extractor_info(self) -> Dict[str, Any]:
        """Get extractor information and capabilities"""
        return {
            "supported_requirement_types": [rtype.value for rtype in RequirementType],
            "supported_priorities": [
                priority.value for priority in RequirementPriority
            ],
            "extraction_methods": [
                "pattern_matching",
                "keyword_detection",
                "section_analysis",
                "ai_enhancement",
            ],
            "ai_model": self.config["ollama_model"],
            "config": self.config.copy(),
            "version": "1.0.0",
        }

# Factory function
def create_requirement_extractor(
    config: Optional[Dict[str, Any]] = None,
) -> RequirementExtractor:
    """Create RequirementExtractor instance with configuration"""
    return RequirementExtractor(config)
