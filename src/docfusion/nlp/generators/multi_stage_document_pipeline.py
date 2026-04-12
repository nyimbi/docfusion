#!/usr/bin/env python3
"""
Multi-Stage Document Generation Pipeline

Comprehensive orchestration system that combines outline generation, iterative content creation,
behavioral psychology integration, and repetition prevention for compelling document creation.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

# Import all pipeline components
from ..prompting_strategies import filter_thinking_tags
from .document_outline_generator import (
    DocumentOutline,
    DocumentOutlineGenerator,
    DocumentType,
    OutlineGenerationResult,
    PsychologyBias,
    create_document_outline_generator,
)
from ...core.utils import uuid7str
import time
from .iterative_section_generator import (
    ContentGenerationStrategy,
    ContentPipeline,
    IterativeGenerationResult,
    IterativeSectionGenerator,
    RepetitionPreventionMode,
    SectionContent,
    create_iterative_section_generator,
)

class DocumentComplexity(Enum):
    """Levels of document complexity"""

    SIMPLE = "simple"  # Basic structure, standard content
    MODERATE = "moderate"  # Enhanced structure, some psychology
    ADVANCED = "advanced"  # Full psychology integration, complex structure
    EXPERT = "expert"  # Maximum sophistication, all features

class GenerationMode(Enum):
    """Modes for document generation"""

    FAST = "fast"  # Quick generation with basic quality
    BALANCED = "balanced"  # Balance of speed and quality
    QUALITY = "quality"  # Maximum quality, longer generation time
    CUSTOM = "custom"  # Custom configuration

@dataclass
class DocumentRequirements:
    """High-level requirements for document generation"""

    document_type: DocumentType = DocumentType.BUSINESS_PROPOSAL
    title: str = ""

    # Context information
    project_name: str = ""
    client_name: str = ""
    industry: str = ""
    target_audience: str = "business_decision_makers"

    # Content requirements
    objectives: List[str] = field(default_factory=list)
    key_requirements: List[str] = field(default_factory=list)
    value_propositions: List[str] = field(default_factory=list)
    competitive_factors: List[str] = field(default_factory=list)

    # Document specifications
    target_word_count: int = 3000
    complexity_level: DocumentComplexity = DocumentComplexity.ADVANCED
    generation_mode: GenerationMode = GenerationMode.QUALITY

    # Psychology preferences
    primary_psychology_biases: List[PsychologyBias] = field(default_factory=list)
    persuasion_emphasis: str = "balanced"  # aggressive, balanced, subtle

    # Business context
    budget_range: str = ""
    timeline: str = ""
    urgency_level: str = "medium"  # low, medium, high
    competitive_situation: bool = False

    # Quality preferences
    enable_repetition_prevention: bool = True
    enable_psychology_optimization: bool = True
    enable_advanced_prompting: bool = True
    quality_over_speed: bool = True

@dataclass
class GeneratedDocument:
    """Complete generated document with all sections"""

    id: str = field(default_factory=uuid7str)
    title: str = ""
    document_type: DocumentType = DocumentType.BUSINESS_PROPOSAL

    # Document content
    sections: List[SectionContent] = field(default_factory=list)
    full_content: str = ""
    word_count: int = 0

    # Source outline and pipeline
    outline: Optional[DocumentOutline] = None
    content_pipeline: Optional[ContentPipeline] = None

    # Quality metrics
    overall_quality_score: float = 0.0
    psychology_effectiveness: float = 0.0
    persuasiveness_score: float = 0.0
    coherence_score: float = 0.0
    repetition_minimization: float = 0.0

    # Generation metadata
    generation_time: float = 0.0
    total_model_calls: int = 0
    stages_completed: int = 0

    # Document analysis
    key_value_propositions: List[str] = field(default_factory=list)
    psychology_biases_applied: List[PsychologyBias] = field(default_factory=list)
    competitive_differentiators: List[str] = field(default_factory=list)

    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

@dataclass
class PipelineResult:
    """Complete result of multi-stage document generation"""

    success: bool = False
    document: Optional[GeneratedDocument] = None

    # Stage results
    outline_result: Optional[OutlineGenerationResult] = None
    generation_result: Optional[IterativeGenerationResult] = None

    # Process metrics
    total_processing_time: float = 0.0
    stages_completed: int = 0
    total_model_calls: int = 0

    # Quality assessment
    document_quality: float = 0.0
    requirements_fulfillment: float = 0.0
    psychology_integration: float = 0.0

    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

class MultiStageDocumentPipeline:
    """Comprehensive multi-stage document generation pipeline"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 300.0,
        use_advanced_prompting: bool = True,
        enable_quality_optimization: bool = True,
    ):
        self.ollama_base_url = ollama_base_url
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout
        self.use_advanced_prompting = use_advanced_prompting
        self.enable_quality_optimization = enable_quality_optimization
        self.logger = logging.getLogger(__name__)

        # Initialize pipeline components
        self._initialize_components()

        # Initialize quality benchmarks
        self._initialize_quality_benchmarks()

        self.logger.info(
            f"MultiStageDocumentPipeline initialized with model: {ollama_model}"
        )

    def _initialize_components(self):
        """Initialize all pipeline components"""

        base_config = {
            "ollama_base_url": self.ollama_base_url,
            "ollama_model": self.ollama_model,
            "ollama_timeout": self.ollama_timeout,
            "use_advanced_prompting": self.use_advanced_prompting,
        }

        # Initialize outline generator
        self.outline_generator = create_document_outline_generator(base_config)

        # Initialize section generator with advanced configuration
        section_config = {
            **base_config,
            "generation_strategy": ContentGenerationStrategy.PSYCHOLOGY_OPTIMIZED,
            "repetition_prevention": RepetitionPreventionMode.AI_REVIEW,
            "max_retries_per_section": 3,
        }
        self.section_generator = create_iterative_section_generator(section_config)

    def _initialize_quality_benchmarks(self):
        """Initialize quality benchmarks for different document types"""
        self.quality_benchmarks = {
            DocumentType.BUSINESS_PROPOSAL: {
                "min_word_count": 2000,
                "max_word_count": 5000,
                "required_sections": [
                    "executive_summary",
                    "solution",
                    "team",
                    "timeline",
                ],
                "psychology_biases_expected": 4,
                "min_quality_score": 0.7,
                "min_persuasiveness": 0.75,
            },
            DocumentType.TECHNICAL_PROPOSAL: {
                "min_word_count": 2500,
                "max_word_count": 6000,
                "required_sections": [
                    "executive_summary",
                    "technical_solution",
                    "architecture",
                    "team",
                ],
                "psychology_biases_expected": 3,
                "min_quality_score": 0.75,
                "min_persuasiveness": 0.7,
            },
            DocumentType.RFP_RESPONSE: {
                "min_word_count": 3000,
                "max_word_count": 8000,
                "required_sections": [
                    "executive_summary",
                    "technical_response",
                    "management_approach",
                    "experience",
                ],
                "psychology_biases_expected": 5,
                "min_quality_score": 0.8,
                "min_persuasiveness": 0.8,
            },
        }

    async def generate_document(
        self, requirements: DocumentRequirements
    ) -> PipelineResult:
        """Execute complete multi-stage document generation pipeline"""
        start_time = time.monotonic()
        result = PipelineResult()

        try:
            self.logger.info(
                f"Starting multi-stage generation for: {requirements.title}"
            )

            # Stage 1: Generate Enhanced Outline
            self.logger.info("🏗️  Stage 1: Generating enhanced document outline...")
            result.outline_result = await self._stage_1_generate_outline(requirements)
            result.stages_completed += 1

            if not result.outline_result.success or not result.outline_result.outline:
                result.errors.append("Stage 1 failed: Could not generate outline")
                return result

            # Stage 2: Generate Content Iteratively
            self.logger.info("✍️  Stage 2: Generating content section-by-section...")
            result.generation_result = await self._stage_2_generate_content(
                result.outline_result.outline, requirements
            )
            result.stages_completed += 1

            if (
                not result.generation_result.success
                or not result.generation_result.pipeline
            ):
                result.errors.append("Stage 2 failed: Could not generate content")
                return result

            # Stage 3: Assemble and Optimize Document
            self.logger.info("🔧 Stage 3: Assembling and optimizing document...")
            document = await self._stage_3_assemble_document(
                result.outline_result.outline,
                result.generation_result.pipeline,
                requirements,
            )
            result.stages_completed += 1

            if not document:
                result.errors.append("Stage 3 failed: Could not assemble document")
                return result

            # Stage 4: Final Quality Assessment and Enhancement
            self.logger.info("🎯 Stage 4: Final quality assessment...")
            await self._stage_4_final_assessment(document, requirements, result)
            result.stages_completed += 1

            # Set final results
            result.document = document
            result.success = len(result.errors) == 0
            result.total_processing_time = time.monotonic() - start_time
            result.total_model_calls = (
                result.outline_result.total_tokens
                + result.generation_result.pipeline.total_model_calls
            )

            self.logger.info(
                f"Document generation completed: {document.word_count} words in {result.total_processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Pipeline execution failed: {str(e)}")
            self.logger.error(f"Pipeline error: {e}")

        return result

    async def _stage_1_generate_outline(
        self, requirements: DocumentRequirements
    ) -> OutlineGenerationResult:
        """Stage 1: Generate enhanced outline with improvements and psychology"""

        # Convert requirements to outline generator context
        context = {
            "project_name": requirements.project_name,
            "client_name": requirements.client_name,
            "industry": requirements.industry,
            "target_audience": requirements.target_audience,
            "objectives": requirements.objectives,
            "key_requirements": requirements.key_requirements,
            "budget_range": requirements.budget_range,
            "timeline": requirements.timeline,
            "competitive_situation": requirements.competitive_situation,
            "urgency_level": requirements.urgency_level,
        }

        # Generate complete outline with all stages
        outline_result = await self.outline_generator.generate_complete_outline(
            document_type=requirements.document_type,
            context=context,
            target_word_count=requirements.target_word_count,
        )

        return outline_result

    async def _stage_2_generate_content(
        self, outline: DocumentOutline, requirements: DocumentRequirements
    ) -> IterativeGenerationResult:
        """Stage 2: Generate content section-by-section with repetition prevention"""

        # Build context for content generation
        context = {
            "project_name": requirements.project_name,
            "client_name": requirements.client_name,
            "industry": requirements.industry,
            "target_audience": requirements.target_audience,
            "value_propositions": requirements.value_propositions,
            "competitive_factors": requirements.competitive_factors,
            "persuasion_emphasis": requirements.persuasion_emphasis,
        }

        # Generate complete document content
        generation_result = await self.section_generator.generate_complete_document(
            outline=outline, context=context
        )

        return generation_result

    async def _stage_3_assemble_document(
        self,
        outline: DocumentOutline,
        pipeline: ContentPipeline,
        requirements: DocumentRequirements,
    ) -> Optional[GeneratedDocument]:
        """Stage 3: Assemble complete document from generated sections"""

        try:
            document = GeneratedDocument(
                title=outline.title,
                document_type=outline.document_type,
                sections=pipeline.sections.copy(),
                outline=outline,
                content_pipeline=pipeline,
            )

            # Assemble full content
            content_parts = []

            # Add title
            content_parts.append(f"# {document.title}\\n")

            # Add sections with proper formatting
            for section in document.sections:
                # Add section title
                level_markers = "#" * (section.narrative_role == "intro" and 2 or 3)
                content_parts.append(f"{level_markers} {section.title}\\n")

                # Add section content
                content_parts.append(f"{section.content}\\n")

            document.full_content = "\\n".join(content_parts)
            document.word_count = len(document.full_content.split())

            # Extract document-level insights
            document.key_value_propositions = self._extract_document_value_propositions(
                document
            )
            document.psychology_biases_applied = self._extract_applied_biases(document)
            document.competitive_differentiators = self._extract_competitive_factors(
                document
            )

            # Set generation metadata
            document.generation_time = pipeline.total_generation_time
            document.total_model_calls = pipeline.total_model_calls
            document.stages_completed = 3

            return document

        except Exception as e:
            self.logger.error(f"Document assembly error: {e}")
            return None

    async def _stage_4_final_assessment(
        self,
        document: GeneratedDocument,
        requirements: DocumentRequirements,
        result: PipelineResult,
    ):
        """Stage 4: Final quality assessment and recommendations"""

        try:
            # Assess document against quality benchmarks
            benchmark = self.quality_benchmarks.get(
                requirements.document_type,
                self.quality_benchmarks[DocumentType.BUSINESS_PROPOSAL],
            )

            # Calculate quality scores
            document.overall_quality_score = await self._calculate_overall_quality(
                document, benchmark
            )
            document.psychology_effectiveness = (
                await self._assess_psychology_effectiveness(document)
            )
            document.persuasiveness_score = await self._assess_persuasiveness(document)
            document.coherence_score = await self._assess_document_coherence(document)
            document.repetition_minimization = (
                document.content_pipeline.repetition_minimization
            )

            # Calculate pipeline-level scores
            result.document_quality = document.overall_quality_score
            result.psychology_integration = document.psychology_effectiveness
            result.requirements_fulfillment = (
                await self._assess_requirements_fulfillment(document, requirements)
            )

            # Generate recommendations
            result.recommendations = await self._generate_recommendations(
                document, requirements, benchmark
            )

            # Generate warnings for quality issues
            if document.overall_quality_score < benchmark["min_quality_score"]:
                result.warnings.append(
                    f"Document quality ({document.overall_quality_score:.2f}) below target ({benchmark['min_quality_score']})"
                )

            if document.word_count < benchmark["min_word_count"]:
                result.warnings.append(
                    f"Document length ({document.word_count}) below minimum ({benchmark['min_word_count']})"
                )
            elif document.word_count > benchmark["max_word_count"]:
                result.warnings.append(
                    f"Document length ({document.word_count}) above maximum ({benchmark['max_word_count']})"
                )

        except Exception as e:
            result.warnings.append(f"Quality assessment error: {str(e)}")
            self.logger.error(f"Assessment error: {e}")

    def _extract_document_value_propositions(
        self, document: GeneratedDocument
    ) -> List[str]:
        """Extract key value propositions from document content"""
        value_props = []

        for section in document.sections:
            value_props.extend(section.unique_value_propositions)

        # Deduplicate and return top value propositions
        unique_props = list(set(value_props))
        return unique_props[:5]

    def _extract_applied_biases(
        self, document: GeneratedDocument
    ) -> List[PsychologyBias]:
        """Extract psychology biases applied across the document"""
        applied_biases = set()

        for section in document.sections:
            applied_biases.update(section.psychology_biases_used)

        return list(applied_biases)

    def _extract_competitive_factors(self, document: GeneratedDocument) -> List[str]:
        """Extract competitive differentiators from document"""
        # Simple extraction of competitive language
        competitive_terms = []
        full_content_lower = document.full_content.lower()

        competitive_indicators = [
            "unique",
            "exclusive",
            "only",
            "first",
            "leading",
            "innovative",
            "proprietary",
            "advanced",
            "superior",
            "differentiate",
            "advantage",
        ]

        import re

        for indicator in competitive_indicators:
            pattern = rf"\\b{indicator}\\b[^.!?]*[.!?]"
            matches = re.findall(pattern, full_content_lower, re.IGNORECASE)
            competitive_terms.extend(
                [match.strip() for match in matches[:2]]
            )  # Limit per indicator

        return competitive_terms[:5]  # Top 5 competitive factors

    async def _calculate_overall_quality(
        self, document: GeneratedDocument, benchmark: Dict[str, Any]
    ) -> float:
        """Calculate overall document quality score"""
        quality_factors = []

        # Section quality average
        if document.sections:
            section_qualities = []
            for section in document.sections:
                section_quality = (
                    section.coherence_score + section.persuasiveness_score
                ) / 2
                section_qualities.append(section_quality)
            quality_factors.append(sum(section_qualities) / len(section_qualities))

        # Word count appropriateness
        target_range = (benchmark["min_word_count"], benchmark["max_word_count"])
        if target_range[0] <= document.word_count <= target_range[1]:
            quality_factors.append(1.0)
        else:
            if document.word_count < target_range[0]:
                quality_factors.append(document.word_count / target_range[0])
            else:
                quality_factors.append(max(0.7, target_range[1] / document.word_count))

        # Psychology integration
        expected_biases = benchmark.get("psychology_biases_expected", 3)
        actual_biases = len(document.psychology_biases_applied)
        bias_score = min(actual_biases / expected_biases, 1.0)
        quality_factors.append(bias_score)

        # Content coherence
        if document.content_pipeline:
            quality_factors.append(document.content_pipeline.overall_coherence)

        return sum(quality_factors) / len(quality_factors) if quality_factors else 0.5

    async def _assess_psychology_effectiveness(
        self, document: GeneratedDocument
    ) -> float:
        """Assess effectiveness of psychology integration"""
        if not document.sections:
            return 0.0

        psychology_scores = [
            section.psychology_integration_score for section in document.sections
        ]
        return sum(psychology_scores) / len(psychology_scores)

    async def _assess_persuasiveness(self, document: GeneratedDocument) -> float:
        """Assess overall persuasiveness of document"""
        if not document.sections:
            return 0.0

        persuasiveness_scores = [
            section.persuasiveness_score for section in document.sections
        ]
        return sum(persuasiveness_scores) / len(persuasiveness_scores)

    async def _assess_document_coherence(self, document: GeneratedDocument) -> float:
        """Assess overall document coherence and flow"""
        if document.content_pipeline:
            return document.content_pipeline.overall_coherence

        # Fallback coherence assessment
        if document.sections:
            coherence_scores = [
                section.coherence_score for section in document.sections
            ]
            return sum(coherence_scores) / len(coherence_scores)

        return 0.0

    async def _assess_requirements_fulfillment(
        self, document: GeneratedDocument, requirements: DocumentRequirements
    ) -> float:
        """Assess how well the document fulfills original requirements"""

        fulfillment_factors = []
        content_lower = document.full_content.lower()

        # Check objective coverage
        if requirements.objectives:
            objectives_mentioned = sum(
                1 for obj in requirements.objectives if obj.lower() in content_lower
            )
            fulfillment_factors.append(
                objectives_mentioned / len(requirements.objectives)
            )

        # Check key requirements coverage
        if requirements.key_requirements:
            requirements_mentioned = sum(
                1
                for req in requirements.key_requirements
                if req.lower() in content_lower
            )
            fulfillment_factors.append(
                requirements_mentioned / len(requirements.key_requirements)
            )

        # Check value propositions coverage
        if requirements.value_propositions:
            props_mentioned = sum(
                1
                for prop in requirements.value_propositions
                if prop.lower() in content_lower
            )
            fulfillment_factors.append(
                props_mentioned / len(requirements.value_propositions)
            )

        # Check document type appropriateness
        if document.document_type == requirements.document_type:
            fulfillment_factors.append(1.0)
        else:
            fulfillment_factors.append(0.5)

        # Check word count target
        word_count_ratio = min(
            document.word_count / requirements.target_word_count, 1.0
        )
        if word_count_ratio > 0.8:  # Within 20% of target
            fulfillment_factors.append(1.0)
        else:
            fulfillment_factors.append(word_count_ratio)

        return (
            sum(fulfillment_factors) / len(fulfillment_factors)
            if fulfillment_factors
            else 0.5
        )

    async def _generate_recommendations(
        self,
        document: GeneratedDocument,
        requirements: DocumentRequirements,
        benchmark: Dict[str, Any],
    ) -> List[str]:
        """Generate recommendations for document improvement"""

        recommendations = []

        # Quality-based recommendations
        if document.overall_quality_score < benchmark["min_quality_score"]:
            recommendations.append(
                f"Consider enhancing content quality - current score {document.overall_quality_score:.2f}, target {benchmark['min_quality_score']}"
            )

        # Psychology integration recommendations
        expected_biases = benchmark.get("psychology_biases_expected", 3)
        if len(document.psychology_biases_applied) < expected_biases:
            missing_biases = expected_biases - len(document.psychology_biases_applied)
            recommendations.append(
                f"Consider integrating {missing_biases} additional psychology biases for stronger persuasion"
            )

        # Persuasiveness recommendations
        if document.persuasiveness_score < benchmark.get("min_persuasiveness", 0.7):
            recommendations.append(
                "Strengthen persuasive elements - add more compelling benefits, social proof, or authority indicators"
            )

        # Content length recommendations
        if document.word_count < benchmark["min_word_count"]:
            shortfall = benchmark["min_word_count"] - document.word_count
            recommendations.append(
                f"Expand content by approximately {shortfall} words to meet minimum length requirements"
            )

        # Repetition prevention recommendations
        if document.repetition_minimization < 0.8:
            recommendations.append(
                "Review content for repetitive themes or concepts that could be consolidated or varied"
            )

        # Section-specific recommendations
        low_quality_sections = [
            s
            for s in document.sections
            if (s.coherence_score + s.persuasiveness_score) / 2 < 0.6
        ]
        if low_quality_sections:
            section_names = [s.title for s in low_quality_sections[:3]]
            recommendations.append(
                f"Consider revising these sections for improved quality: {', '.join(section_names)}"
            )

        return recommendations[:6]  # Limit to top 6 recommendations

    async def export_document(
        self,
        document: GeneratedDocument,
        format: str = "markdown",
        include_metadata: bool = False,
    ) -> Dict[str, Any]:
        """Export generated document in various formats"""

        export_data = {
            "title": document.title,
            "document_type": document.document_type.value,
            "word_count": document.word_count,
            "created_at": document.created_at,
        }

        if format == "markdown":
            export_data["content"] = document.full_content

        elif format == "json":
            export_data.update(
                {
                    "sections": [
                        {
                            "title": section.title,
                            "content": section.content,
                            "word_count": section.word_count,
                            "narrative_role": section.narrative_role,
                            "psychology_biases": [
                                bias.value for bias in section.psychology_biases_used
                            ],
                        }
                        for section in document.sections
                    ]
                }
            )

        elif format == "html":
            html_content = (
                document.full_content.replace("\\n# ", "\\n<h1>")
                .replace("\\n## ", "\\n<h2>")
                .replace("\\n### ", "\\n<h3>")
            )
            html_content = html_content.replace("\\n\\n", "</p>\\n<p>").replace(
                "\\n", "<br>\\n"
            )
            export_data["content"] = f"<html><body><p>{html_content}</p></body></html>"

        if include_metadata:
            export_data["metadata"] = {
                "quality_scores": {
                    "overall_quality": document.overall_quality_score,
                    "psychology_effectiveness": document.psychology_effectiveness,
                    "persuasiveness": document.persuasiveness_score,
                    "coherence": document.coherence_score,
                    "repetition_minimization": document.repetition_minimization,
                },
                "psychology_biases_applied": [
                    bias.value for bias in document.psychology_biases_applied
                ],
                "key_value_propositions": document.key_value_propositions,
                "competitive_differentiators": document.competitive_differentiators,
                "generation_stats": {
                    "generation_time": document.generation_time,
                    "model_calls": document.total_model_calls,
                    "sections_count": len(document.sections),
                },
            }

        return export_data

    async def close(self):
        """Close pipeline and cleanup resources"""
        await self.outline_generator.close()
        await self.section_generator.close()
        self.logger.info("MultiStageDocumentPipeline closed")

    def get_pipeline_info(self) -> Dict[str, Any]:
        """Get comprehensive pipeline information"""
        return {
            "pipeline_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "components": {
                "outline_generator": self.outline_generator.get_generator_info(),
                "section_generator": self.section_generator.get_generator_info(),
            },
            "supported_document_types": [doc_type.value for doc_type in DocumentType],
            "supported_complexity_levels": [
                level.value for level in DocumentComplexity
            ],
            "supported_generation_modes": [mode.value for mode in GenerationMode],
            "quality_benchmarks": len(self.quality_benchmarks),
            "features": {
                "multi_stage_generation": True,
                "outline_improvement": True,
                "iterative_content_generation": True,
                "repetition_prevention": True,
                "psychology_integration": True,
                "behavioral_economics": True,
                "quality_assessment": True,
                "requirements_fulfillment": True,
                "document_export": True,
            },
        }

# Factory function
def create_multi_stage_pipeline(
    config: Optional[Dict[str, Any]] = None,
) -> MultiStageDocumentPipeline:
    """Create MultiStageDocumentPipeline instance with configuration"""
    if config is None:
        config = {}

    return MultiStageDocumentPipeline(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "deepseek-r1:32b"),
        ollama_timeout=config.get("ollama_timeout", 300.0),
        use_advanced_prompting=config.get("use_advanced_prompting", True),
        enable_quality_optimization=config.get("enable_quality_optimization", True),
    )
