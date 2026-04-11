#!/usr/bin/env python3
"""
Structure Recognizer

Advanced document structure recognition using pattern matching, machine learning,
and Ollama-based AI analysis for identifying document layouts, sections, and organization.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# Ollama integration for AI-powered structure recognition
import json

import httpx

# Optional libraries for enhanced processing
try:
	import numpy as np

	HAS_NUMPY = True
except ImportError:
	HAS_NUMPY = False

from ...core.utils import uuid7str

class StructureType(str, Enum):
    """Document structure types"""

    TITLE = "title"
    SUBTITLE = "subtitle"
    HEADING = "heading"
    SUBHEADING = "subheading"
    PARAGRAPH = "paragraph"
    BULLET_POINT = "bullet_point"
    NUMBERED_LIST = "numbered_list"
    TABLE = "table"
    FIGURE = "figure"
    CAPTION = "caption"
    FOOTER = "footer"
    HEADER = "header"
    SECTION = "section"
    SUBSECTION = "subsection"
    ABSTRACT = "abstract"
    CONCLUSION = "conclusion"
    REFERENCE = "reference"
    APPENDIX = "appendix"
    TOC = "table_of_contents"
    INDEX = "index"
    SIDEBAR = "sidebar"
    CALLOUT = "callout"
    QUOTE = "quote"
    CODE_BLOCK = "code_block"
    FORMULA = "formula"

class ConfidenceLevel(str, Enum):
    """Confidence levels for structure recognition"""

    VERY_HIGH = "very_high"  # 0.9+
    HIGH = "high"  # 0.7-0.89
    MEDIUM = "medium"  # 0.5-0.69
    LOW = "low"  # 0.3-0.49
    VERY_LOW = "very_low"  # 0.0-0.29

@dataclass
class StructureElement:
    """Individual structure element"""

    id: str
    structure_type: StructureType
    text: str
    level: int = 0  # Hierarchy level (0 = top level)
    start_char: int = 0
    end_char: int = 0
    confidence: float = 0.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM
    parent_id: Optional[str] = None
    children_ids: List[str] = None
    attributes: Dict[str, Any] = None
    formatting: Dict[str, Any] = None  # Font, size, style info if available
    ai_insights: Dict[str, Any] = None

    def __post_init__(self):
        if self.children_ids is None:
            self.children_ids = []
        if self.attributes is None:
            self.attributes = {}
        if self.formatting is None:
            self.formatting = {}
        if self.ai_insights is None:
            self.ai_insights = {}

        # Set confidence level based on score
        if self.confidence >= 0.9:
            self.confidence_level = ConfidenceLevel.VERY_HIGH
        elif self.confidence >= 0.7:
            self.confidence_level = ConfidenceLevel.HIGH
        elif self.confidence >= 0.5:
            self.confidence_level = ConfidenceLevel.MEDIUM
        elif self.confidence >= 0.3:
            self.confidence_level = ConfidenceLevel.LOW
        else:
            self.confidence_level = ConfidenceLevel.VERY_LOW

@dataclass
class DocumentStructure:
    """Complete document structure"""

    elements: List[StructureElement]
    hierarchy: Dict[str, List[str]]  # parent_id -> [child_ids]
    outline: List[Dict[str, Any]]  # Hierarchical outline
    statistics: Dict[str, Any]
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

class StructureRecognitionResult:
    """Result of structure recognition"""

    def __init__(self):
        self.success: bool = False
        self.original_text: str = ""
        self.structure: Optional[DocumentStructure] = None
        self.confidence: float = 0.0
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.processing_time: float = 0.0
        self.methods_used: List[str] = []
        self.ai_analysis: Dict[str, Any] = {}

class StructureRecognizer:
    """Advanced document structure recognizer with AI enhancement"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._get_default_config()
        self.logger = logging.getLogger(__name__)

        # Initialize Ollama client
        self.ollama_client = httpx.AsyncClient(
            base_url=self.config["ollama_base_url"],
            timeout=self.config["ollama_timeout"],
        )

        # Pattern compilations
        self._compile_patterns()

        self.logger.info("Structure recognizer initialized")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            # Ollama settings
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.2:3b",
            "ollama_timeout": 120.0,
            "use_ai_analysis": True,
            # Recognition methods
            "use_pattern_matching": True,
            "use_formatting_hints": True,
            "use_line_analysis": True,
            "use_indentation_analysis": True,
            "use_ai_enhancement": True,
            # Pattern recognition settings
            "title_patterns": [
                r"^[A-Z][A-Z\s]{10,}$",  # ALL CAPS titles
                r"^.{1,100}$",  # Short single lines (potential titles)
            ],
            "heading_patterns": [
                r"^\d+\.\s+.+",  # Numbered headings
                r"^[A-Z][a-zA-Z\s]+:?\s*$",  # Capitalized headings
                r"^#{1,6}\s+.+",  # Markdown headings
            ],
            "list_patterns": [
                r"^\s*[•\-\*]\s+.+",  # Bullet points
                r"^\s*\d+\.\s+.+",  # Numbered lists
                r"^\s*[a-zA-Z]\.\s+.+",  # Letter lists
            ],
            # AI enhancement settings
            "ai_chunk_size": 3000,  # Characters per chunk for AI analysis
            "min_confidence_threshold": 0.3,
            "use_hierarchical_analysis": True,
            # Output settings
            "include_formatting": True,
            "include_ai_insights": True,
            "calculate_statistics": True,
            "max_hierarchy_depth": 6,
        }

    def _compile_patterns(self):
        """Compile regex patterns for efficiency"""
        self.title_regexes = [
            re.compile(p, re.MULTILINE) for p in self.config["title_patterns"]
        ]
        self.heading_regexes = [
            re.compile(p, re.MULTILINE) for p in self.config["heading_patterns"]
        ]
        self.list_regexes = [
            re.compile(p, re.MULTILINE) for p in self.config["list_patterns"]
        ]

        # Additional patterns
        self.section_break_regex = re.compile(r"\n\s*\n\s*\n", re.MULTILINE)
        self.page_break_regex = re.compile(r"\n\s*[-=]{3,}\s*\n", re.MULTILINE)
        self.whitespace_regex = re.compile(r"\s+")

    async def recognize_structure(
        self,
        text: str,
        use_ai: Optional[bool] = None,
        include_formatting: Optional[bool] = None,
    ) -> StructureRecognitionResult:
        """Recognize document structure with multiple methods"""
        start_time = asyncio.get_event_loop().time()
        result = StructureRecognitionResult()
        result.original_text = text

        if not text or not text.strip():
            result.success = True
            result.structure = DocumentStructure([], {}, [], {})
            return result

        try:
            methods_used = []
            elements = []

            # Method 1: Pattern-based recognition
            if self.config["use_pattern_matching"]:
                pattern_elements = await self._pattern_based_recognition(text)
                elements.extend(pattern_elements)
                methods_used.append("pattern_matching")

            # Method 2: Line-by-line analysis
            if self.config["use_line_analysis"]:
                line_elements = await self._line_based_analysis(text)
                elements.extend(line_elements)
                methods_used.append("line_analysis")

            # Method 3: Indentation analysis
            if self.config["use_indentation_analysis"]:
                indent_elements = await self._indentation_analysis(text)
                elements.extend(indent_elements)
                methods_used.append("indentation_analysis")

            # Method 4: AI-enhanced analysis
            if (use_ai or self.config["use_ai_enhancement"]) and len(text) < 50000:
                ai_elements, ai_analysis = await self._ai_enhanced_recognition(text)
                elements.extend(ai_elements)
                result.ai_analysis = ai_analysis
                methods_used.append("ai_enhancement")

            # Merge and deduplicate elements
            merged_elements = self._merge_structure_elements(elements)

            # Build hierarchy
            hierarchy = self._build_hierarchy(merged_elements)

            # Create outline
            outline = self._create_outline(merged_elements, hierarchy)

            # Calculate statistics
            statistics = self._calculate_structure_statistics(merged_elements)

            # Create structure
            result.structure = DocumentStructure(
                elements=merged_elements,
                hierarchy=hierarchy,
                outline=outline,
                statistics=statistics,
            )

            result.confidence = self._calculate_overall_confidence(merged_elements)
            result.methods_used = methods_used
            result.success = True
            result.processing_time = asyncio.get_event_loop().time() - start_time

            self.logger.info(
                f"Structure recognized successfully, time: {result.processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Structure recognition failed: {str(e)}")
            self.logger.error(f"Structure recognition error: {e}")

        return result

    async def _pattern_based_recognition(self, text: str) -> List[StructureElement]:
        """Pattern-based structure recognition"""
        elements = []
        lines = text.split("\n")
        char_offset = 0

        for line_idx, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                char_offset += len(line) + 1
                continue

            start_char = char_offset + len(line) - len(line.lstrip())
            end_char = start_char + len(line_stripped)

            # Check for titles (all caps, short lines)
            if any(regex.match(line_stripped) for regex in self.title_regexes):
                if len(line_stripped) < 100 and line_stripped.isupper():
                    element = StructureElement(
                        id=uuid7str(),
                        structure_type=StructureType.TITLE,
                        text=line_stripped,
                        level=0,
                        start_char=start_char,
                        end_char=end_char,
                        confidence=0.8,
                    )
                    elements.append(element)

            # Check for headings
            elif any(regex.match(line_stripped) for regex in self.heading_regexes):
                # Determine heading level
                level = 1
                if re.match(r"^\d+\.\d+", line_stripped):
                    level = 2
                elif re.match(r"^\d+\.\d+\.\d+", line_stripped):
                    level = 3

                element = StructureElement(
                    id=uuid7str(),
                    structure_type=StructureType.HEADING
                    if level == 1
                    else StructureType.SUBHEADING,
                    text=line_stripped,
                    level=level,
                    start_char=start_char,
                    end_char=end_char,
                    confidence=0.7,
                )
                elements.append(element)

            # Check for lists
            elif any(regex.match(line) for regex in self.list_regexes):
                list_type = StructureType.BULLET_POINT
                if re.match(r"^\s*\d+\.", line):
                    list_type = StructureType.NUMBERED_LIST

                element = StructureElement(
                    id=uuid7str(),
                    structure_type=list_type,
                    text=line_stripped,
                    level=self._calculate_indentation_level(line),
                    start_char=start_char,
                    end_char=end_char,
                    confidence=0.9,
                )
                elements.append(element)

            char_offset += len(line) + 1

        return elements

    async def _line_based_analysis(self, text: str) -> List[StructureElement]:
        """Line-by-line structure analysis"""
        elements = []
        lines = text.split("\n")
        char_offset = 0

        # Analyze line characteristics
        line_stats = []
        for line in lines:
            stats = {
                "length": len(line.strip()),
                "is_empty": not line.strip(),
                "starts_with_number": bool(re.match(r"^\d+", line.strip())),
                "starts_with_bullet": bool(re.match(r"^[•\-\*]", line.strip())),
                "is_all_caps": line.strip().isupper() if line.strip() else False,
                "has_colon": ":" in line,
                "indent_level": len(line) - len(line.lstrip()),
            }
            line_stats.append(stats)

        # Identify potential structure based on line analysis
        for i, (line, stats) in enumerate(zip(lines, line_stats)):
            if stats["is_empty"]:
                char_offset += len(line) + 1
                continue

            line_stripped = line.strip()
            start_char = char_offset + stats["indent_level"]
            end_char = start_char + len(line_stripped)

            confidence = 0.5
            structure_type = StructureType.PARAGRAPH
            level = 0

            # Short lines likely to be headings
            if stats["length"] < 80 and not stats["starts_with_bullet"]:
                if i > 0 and line_stats[i - 1]["is_empty"]:  # Preceded by empty line
                    confidence = 0.6
                    if stats["is_all_caps"]:
                        structure_type = StructureType.TITLE
                        confidence = 0.7
                    elif stats["has_colon"]:
                        structure_type = StructureType.HEADING
                        confidence = 0.7
                    else:
                        structure_type = StructureType.HEADING

            # List items
            elif stats["starts_with_bullet"]:
                structure_type = StructureType.BULLET_POINT
                confidence = 0.8
                level = (
                    stats["indent_level"] // 4
                )  # Estimate level based on indentation

            elif stats["starts_with_number"]:
                structure_type = StructureType.NUMBERED_LIST
                confidence = 0.8
                level = stats["indent_level"] // 4

            element = StructureElement(
                id=uuid7str(),
                structure_type=structure_type,
                text=line_stripped,
                level=level,
                start_char=start_char,
                end_char=end_char,
                confidence=confidence,
            )
            elements.append(element)

            char_offset += len(line) + 1

        return elements

    async def _indentation_analysis(self, text: str) -> List[StructureElement]:
        """Indentation-based structure analysis"""
        elements = []
        lines = text.split("\n")
        char_offset = 0

        # Calculate indentation levels
        indent_levels = []
        for line in lines:
            if line.strip():
                indent = len(line) - len(line.lstrip())
                indent_levels.append(indent)

        # Find common indentation patterns
        if indent_levels:
            unique_indents = sorted(set(indent_levels))
            indent_mapping = {
                indent: level for level, indent in enumerate(unique_indents)
            }
        else:
            indent_mapping = {}

        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                char_offset += len(line) + 1
                continue

            indent = len(line) - len(line.lstrip())
            level = indent_mapping.get(indent, 0)

            start_char = char_offset + indent
            end_char = start_char + len(line_stripped)

            # Higher indentation levels are more likely to be subsections
            confidence = 0.4 + (level * 0.1)
            structure_type = StructureType.PARAGRAPH

            if level == 0:
                structure_type = StructureType.SECTION
                confidence = 0.6
            elif level == 1:
                structure_type = StructureType.SUBSECTION
                confidence = 0.7

            element = StructureElement(
                id=uuid7str(),
                structure_type=structure_type,
                text=line_stripped,
                level=level,
                start_char=start_char,
                end_char=end_char,
                confidence=confidence,
            )
            elements.append(element)

            char_offset += len(line) + 1

        return elements

    async def _ai_enhanced_recognition(
        self, text: str
    ) -> Tuple[List[StructureElement], Dict[str, Any]]:
        """AI-enhanced structure recognition using Ollama"""
        elements = []
        ai_analysis = {}

        try:
            # Process in chunks if text is large
            chunks = self._split_text_into_chunks(text, self.config["ai_chunk_size"])

            for chunk_idx, chunk in enumerate(chunks):
                chunk_elements, chunk_analysis = await self._analyze_chunk_structure(
                    chunk, chunk_idx
                )
                elements.extend(chunk_elements)
                ai_analysis[f"chunk_{chunk_idx}"] = chunk_analysis

            # Global AI analysis
            if len(text) < self.config["ai_chunk_size"]:
                global_analysis = await self._perform_global_structure_analysis(text)
                ai_analysis["global"] = global_analysis

        except Exception as e:
            self.logger.warning(f"AI structure recognition failed: {e}")
            ai_analysis["error"] = str(e)

        return elements, ai_analysis

    async def _analyze_chunk_structure(
        self, chunk: str, chunk_idx: int
    ) -> Tuple[List[StructureElement], Dict[str, Any]]:
        """Analyze structure of a text chunk using AI"""
        prompt = f"""Analyze the structure of this document text and identify structural elements.

For each structural element, identify:
1. Type (title, heading, subheading, paragraph, bullet_point, numbered_list, table, etc.)
2. Hierarchy level (0 = top level, 1 = first sublevel, etc.)
3. Text content
4. Confidence level (0.0-1.0)

Text to analyze:
{chunk}

Provide a JSON response with the structure analysis in this format:
{{
  "elements": [
    {{
      "type": "heading",
      "text": "Example Heading",
      "level": 1,
      "confidence": 0.9,
      "start_char": 0,
      "end_char": 15
    }}
  ],
  "document_type": "report|proposal|article|manual",
  "overall_confidence": 0.8
}}"""

        try:
            response = await self.ollama_client.post(
                "/api/generate",
                json={
                    "model": self.config["ollama_model"],
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "top_p": 0.9, "num_predict": 2048},
                },
            )

            if response.status_code == 200:
                ai_response = response.json()
                response_text = ai_response.get("response", "").strip()

                # Try to parse JSON response
                try:
                    ai_data = json.loads(response_text)
                    elements = self._convert_ai_elements_to_structure_elements(
                        ai_data.get("elements", []), chunk
                    )
                    analysis = {
                        "document_type": ai_data.get("document_type", "unknown"),
                        "overall_confidence": ai_data.get("overall_confidence", 0.5),
                        "raw_response": response_text,
                    }
                    return elements, analysis

                except json.JSONDecodeError:
                    # Fallback: parse response as text
                    elements = self._parse_ai_text_response(response_text, chunk)
                    analysis = {
                        "raw_response": response_text,
                        "parsing_method": "text_fallback",
                    }
                    return elements, analysis

        except Exception as e:
            self.logger.warning(f"AI chunk analysis failed: {e}")

        return [], {"error": "AI analysis failed"}

    async def _perform_global_structure_analysis(self, text: str) -> Dict[str, Any]:
        """Perform global document structure analysis"""
        prompt = f"""Analyze the overall structure and organization of this document.

Identify:
1. Document type (report, proposal, article, manual, etc.)
2. Main sections and their hierarchy
3. Overall organization pattern
4. Key structural features

Document text (first 2000 characters):
{text[:2000]}...

Provide analysis in JSON format:
{{
  "document_type": "type",
  "organization_pattern": "description",
  "main_sections": ["section1", "section2"],
  "structural_features": ["feature1", "feature2"],
  "confidence": 0.8
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
            self.logger.warning(f"Global structure analysis failed: {e}")

        return {"error": "Global analysis failed"}

    def _convert_ai_elements_to_structure_elements(
        self, ai_elements: List[Dict[str, Any]], chunk: str
    ) -> List[StructureElement]:
        """Convert AI analysis results to StructureElement objects"""
        elements = []

        for ai_element in ai_elements:
            try:
                # Map AI type to StructureType
                ai_type = ai_element.get("type", "paragraph").lower()
                structure_type = self._map_ai_type_to_structure_type(ai_type)

                element = StructureElement(
                    id=uuid7str(),
                    structure_type=structure_type,
                    text=ai_element.get("text", ""),
                    level=ai_element.get("level", 0),
                    start_char=ai_element.get("start_char", 0),
                    end_char=ai_element.get(
                        "end_char", len(ai_element.get("text", ""))
                    ),
                    confidence=min(ai_element.get("confidence", 0.5), 1.0),
                    ai_insights={"source": "ollama", "original_type": ai_type},
                )
                elements.append(element)

            except Exception as e:
                self.logger.warning(f"Failed to convert AI element: {e}")
                continue

        return elements

    def _map_ai_type_to_structure_type(self, ai_type: str) -> StructureType:
        """Map AI-detected type to StructureType enum"""
        type_mapping = {
            "title": StructureType.TITLE,
            "heading": StructureType.HEADING,
            "subheading": StructureType.SUBHEADING,
            "paragraph": StructureType.PARAGRAPH,
            "bullet_point": StructureType.BULLET_POINT,
            "numbered_list": StructureType.NUMBERED_LIST,
            "table": StructureType.TABLE,
            "figure": StructureType.FIGURE,
            "caption": StructureType.CAPTION,
            "section": StructureType.SECTION,
            "subsection": StructureType.SUBSECTION,
            "abstract": StructureType.ABSTRACT,
            "conclusion": StructureType.CONCLUSION,
            "reference": StructureType.REFERENCE,
            "quote": StructureType.QUOTE,
            "code_block": StructureType.CODE_BLOCK,
        }

        return type_mapping.get(ai_type, StructureType.PARAGRAPH)

    def _parse_ai_text_response(
        self, response_text: str, chunk: str
    ) -> List[StructureElement]:
        """Parse AI response as text when JSON parsing fails"""
        elements = []
        lines = response_text.split("\n")

        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue

            # Look for structure indicators in text
            if "heading" in line.lower() or "title" in line.lower():
                element = StructureElement(
                    id=uuid7str(),
                    structure_type=StructureType.HEADING,
                    text=line,
                    confidence=0.5,
                    ai_insights={"source": "text_parsing"},
                )
                elements.append(element)

        return elements

    def _merge_structure_elements(
        self, elements: List[StructureElement]
    ) -> List[StructureElement]:
        """Merge and deduplicate structure elements from different methods"""
        if not elements:
            return []

        # Sort by position
        elements.sort(key=lambda x: (x.start_char, x.end_char))

        # Simple deduplication based on text overlap
        merged = []
        for element in elements:
            # Check for overlap with existing elements
            overlap_found = False
            for existing in merged:
                if (
                    element.start_char >= existing.start_char
                    and element.start_char <= existing.end_char
                ):
                    # Merge if confidence is higher
                    if element.confidence > existing.confidence:
                        merged.remove(existing)
                        merged.append(element)
                    overlap_found = True
                    break

            if not overlap_found:
                merged.append(element)

        return sorted(merged, key=lambda x: x.start_char)

    def _build_hierarchy(
        self, elements: List[StructureElement]
    ) -> Dict[str, List[str]]:
        """Build hierarchical structure"""
        hierarchy = {}

        # Group by level and assign parent-child relationships
        for i, element in enumerate(elements):
            # Find parent (previous element with lower level)
            parent_id = None
            for j in range(i - 1, -1, -1):
                if elements[j].level < element.level:
                    parent_id = elements[j].id
                    break

            element.parent_id = parent_id

            if parent_id:
                if parent_id not in hierarchy:
                    hierarchy[parent_id] = []
                hierarchy[parent_id].append(element.id)

            # Initialize empty children list for this element
            if element.id not in hierarchy:
                hierarchy[element.id] = []

        return hierarchy

    def _create_outline(
        self, elements: List[StructureElement], hierarchy: Dict[str, List[str]]
    ) -> List[Dict[str, Any]]:
        """Create hierarchical outline"""
        outline = []

        # Find root elements (no parent)
        root_elements = [elem for elem in elements if elem.parent_id is None]

        def build_outline_recursive(element_id: str) -> Dict[str, Any]:
            element = next(elem for elem in elements if elem.id == element_id)

            outline_item = {
                "id": element.id,
                "type": element.structure_type.value,
                "text": element.text[:100] + "..."
                if len(element.text) > 100
                else element.text,
                "level": element.level,
                "confidence": element.confidence,
                "children": [],
            }

            # Add children recursively
            for child_id in hierarchy.get(element_id, []):
                outline_item["children"].append(build_outline_recursive(child_id))

            return outline_item

        for root_element in root_elements:
            outline.append(build_outline_recursive(root_element.id))

        return outline

    def _calculate_structure_statistics(
        self, elements: List[StructureElement]
    ) -> Dict[str, Any]:
        """Calculate structure statistics"""
        if not elements:
            return {}

        type_counts = {}
        level_counts = {}
        total_confidence = 0

        for element in elements:
            # Count by type
            type_key = element.structure_type.value
            type_counts[type_key] = type_counts.get(type_key, 0) + 1

            # Count by level
            level_counts[element.level] = level_counts.get(element.level, 0) + 1

            # Sum confidence
            total_confidence += element.confidence

        return {
            "total_elements": len(elements),
            "type_distribution": type_counts,
            "level_distribution": level_counts,
            "average_confidence": total_confidence / len(elements),
            "max_hierarchy_depth": max(element.level for element in elements),
            "elements_by_confidence": {
                "very_high": len([e for e in elements if e.confidence >= 0.9]),
                "high": len([e for e in elements if 0.7 <= e.confidence < 0.9]),
                "medium": len([e for e in elements if 0.5 <= e.confidence < 0.7]),
                "low": len([e for e in elements if 0.3 <= e.confidence < 0.5]),
                "very_low": len([e for e in elements if e.confidence < 0.3]),
            },
        }

    def _calculate_overall_confidence(self, elements: List[StructureElement]) -> float:
        """Calculate overall structure recognition confidence"""
        if not elements:
            return 0.0

        # Weighted average based on element importance
        total_weight = 0
        weighted_confidence = 0

        for element in elements:
            # Higher level elements get more weight
            weight = 1.0 + (1.0 / (element.level + 1))

            # Certain types get higher weights
            if element.structure_type in [StructureType.TITLE, StructureType.HEADING]:
                weight *= 1.5

            weighted_confidence += element.confidence * weight
            total_weight += weight

        return min(weighted_confidence / total_weight, 1.0) if total_weight > 0 else 0.0

    def _calculate_indentation_level(self, line: str) -> int:
        """Calculate indentation level from line"""
        return (len(line) - len(line.lstrip())) // 4

    def _split_text_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """Split text into processable chunks"""
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        sentences = re.split(r"[.!?]+", text)
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= chunk_size:
                current_chunk += sentence + ". "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    async def extract_document_outline(self, text: str) -> Dict[str, Any]:
        """Extract a simplified document outline"""
        result = await self.recognize_structure(text)

        if not result.success:
            return {"error": "Structure recognition failed", "outline": []}

        return {
            "outline": result.structure.outline,
            "statistics": result.structure.statistics,
            "confidence": result.confidence,
        }

    async def identify_document_type(self, text: str) -> Dict[str, Any]:
        """Identify document type based on structure"""
        if len(text) > 5000:
            text = text[:5000]  # Analyze first part for type identification

        prompt = f"""Analyze this document text and identify its type and characteristics.

Document text:
{text}

Identify:
1. Document type (report, proposal, article, manual, letter, etc.)
2. Formality level (formal, informal, technical)
3. Target audience (general, technical, academic, business)
4. Key structural characteristics

Provide JSON response:
{{
  "document_type": "type",
  "formality_level": "level",
  "target_audience": "audience",
  "characteristics": ["char1", "char2"],
  "confidence": 0.8
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
                    return {
                        "document_type": "unknown",
                        "raw_response": response_text,
                        "confidence": 0.3,
                    }

        except Exception as e:
            self.logger.warning(f"Document type identification failed: {e}")

        return {"document_type": "unknown", "confidence": 0.0}

    async def close(self):
        """Close the Ollama client"""
        await self.ollama_client.aclose()

    def get_recognizer_info(self) -> Dict[str, Any]:
        """Get recognizer information and capabilities"""
        return {
            "supported_methods": [
                "pattern_matching",
                "line_analysis",
                "indentation_analysis",
                "ai_enhancement",
            ],
            "supported_structure_types": [stype.value for stype in StructureType],
            "ai_model": self.config["ollama_model"],
            "config": self.config.copy(),
            "version": "1.0.0",
        }

# Factory function
def create_structure_recognizer(
    config: Optional[Dict[str, Any]] = None,
) -> StructureRecognizer:
    """Create StructureRecognizer instance with configuration"""
    return StructureRecognizer(config)
