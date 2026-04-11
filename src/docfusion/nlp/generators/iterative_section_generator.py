#!/usr/bin/env python3
"""
Iterative Section Generator

Generates content section-by-section from enhanced outlines with repetition prevention,
psychology bias integration, and coherent narrative flow management.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    import aiohttp
    from aiohttp import ClientError, ClientTimeout
except ImportError:
    aiohttp = None

# Import outline structures and prompting strategies
from ..prompting_strategies import (
    AdvancedPromptBuilder,
    PromptingStrategy,
    ThoughtBranch,
    create_chain_of_thought_prompt,
    create_tree_of_thought_prompt,
    filter_thinking_tags,
)
from ...core.utils import uuid7str
from .document_outline_generator import (
import time
    DocumentOutline,
    DocumentType,
    OutlineElement,
    PsychologyBias,
)

class ContentGenerationStrategy(Enum):
    """Strategies for iterative content generation"""

    SEQUENTIAL = "sequential"  # Generate sections in order
    PRIORITY_FIRST = "priority_first"  # Generate high-priority sections first
    DEPENDENCY_AWARE = "dependency_aware"  # Respect section dependencies
    PSYCHOLOGY_OPTIMIZED = "psychology_optimized"  # Optimize for persuasive flow

class RepetitionPreventionMode(Enum):
    """Methods for preventing content repetition"""

    SEMANTIC_SIMILARITY = "semantic_similarity"  # Check semantic similarity
    KEYWORD_TRACKING = "keyword_tracking"  # Track key phrases and concepts
    CONTENT_FINGERPRINTING = "content_fingerprinting"  # Hash-based content tracking
    AI_REVIEW = "ai_review"  # AI-powered repetition detection

@dataclass
class SectionContent:
    """Generated content for a single section"""

    element_id: str = ""
    title: str = ""
    content: str = ""
    word_count: int = 0

    # Quality metrics
    psychology_integration_score: float = 0.0
    repetition_risk_score: float = 0.0  # 0=no repetition, 1=high repetition
    coherence_score: float = 0.0
    persuasiveness_score: float = 0.0

    # Content analysis
    key_concepts: List[str] = field(default_factory=list)
    psychology_biases_used: List[PsychologyBias] = field(default_factory=list)
    unique_value_propositions: List[str] = field(default_factory=list)

    # Generation metadata
    generation_time: float = 0.0
    model_calls: int = 0
    retries_due_to_repetition: int = 0

    # Narrative positioning
    narrative_role: str = ""  # intro, build, climax, resolution
    transition_in: str = ""  # How this section connects to previous
    transition_out: str = ""  # How this section connects to next

@dataclass
class ContentPipeline:
    """Complete pipeline of generated content"""

    outline_id: str = ""
    document_title: str = ""

    # Generated sections
    sections: List[SectionContent] = field(default_factory=list)
    total_word_count: int = 0

    # Quality assessment
    overall_coherence: float = 0.0
    repetition_minimization: float = 0.0
    psychology_effectiveness: float = 0.0
    narrative_flow: float = 0.0

    # Content tracking for repetition prevention
    used_concepts: Set[str] = field(default_factory=set)
    used_phrases: Set[str] = field(default_factory=set)
    section_fingerprints: Dict[str, str] = field(default_factory=dict)

    # Generation statistics
    total_generation_time: float = 0.0
    total_model_calls: int = 0
    total_repetition_retries: int = 0

@dataclass
class IterativeGenerationResult:
    """Result of complete iterative section generation"""

    success: bool = False
    pipeline: Optional[ContentPipeline] = None

    # Process metrics
    sections_generated: int = 0
    sections_failed: int = 0
    total_processing_time: float = 0.0

    # Quality scores
    content_quality: float = 0.0
    psychology_integration: float = 0.0
    repetition_prevention: float = 0.0

    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

class IterativeSectionGenerator:
    """Advanced iterative section-by-section content generator with repetition prevention"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 300.0,
        use_advanced_prompting: bool = True,
        generation_strategy: ContentGenerationStrategy = ContentGenerationStrategy.PSYCHOLOGY_OPTIMIZED,
        repetition_prevention: RepetitionPreventionMode = RepetitionPreventionMode.AI_REVIEW,
        max_retries_per_section: int = 3,
    ):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout
        self.use_advanced_prompting = use_advanced_prompting
        self.generation_strategy = generation_strategy
        self.repetition_prevention = repetition_prevention
        self.max_retries_per_section = max_retries_per_section
        self.logger = logging.getLogger(__name__)

        # Initialize advanced prompting
        if self.use_advanced_prompting:
            from ..prompting_strategies import create_advanced_prompt_builder

            self.prompt_builder = create_advanced_prompt_builder(ollama_model)
        else:
            self.prompt_builder = None

        # Initialize psychology bias application strategies
        self._initialize_psychology_applications()

        # Initialize narrative flow templates
        self._initialize_narrative_templates()

        # Initialize repetition prevention tools
        self._initialize_repetition_prevention()

        self.logger.info(
            f"IterativeSectionGenerator initialized with model: {ollama_model}"
        )

    def _initialize_psychology_applications(self):
        """Initialize specific applications for each psychology bias"""
        self.psychology_applications = {
            PsychologyBias.ANCHORING: {
                "intro_phrases": [
                    "Industry leaders report that",
                    "Recent studies show that organizations typically",
                    "The baseline cost of inaction is typically",
                ],
                "content_strategies": [
                    "Present high-impact statistics first",
                    "Establish premium reference points",
                    "Quote industry benchmarks early",
                ],
                "avoid_repetition": [
                    "Track statistical anchors used across sections",
                    "Vary reference point types (cost, time, quality)",
                    "Use different industry data sources",
                ],
            },
            PsychologyBias.SOCIAL_PROOF: {
                "intro_phrases": [
                    "Leading organizations like",
                    "Industry pioneers including",
                    "Companies such as [CLIENT_TYPE] have achieved",
                ],
                "content_strategies": [
                    "Include specific client success metrics",
                    "Reference industry adoption rates",
                    "Mention peer company transformations",
                ],
                "avoid_repetition": [
                    "Use different client examples per section",
                    "Vary social proof types (peers, experts, masses)",
                    "Track testimonial themes to prevent duplication",
                ],
            },
            PsychologyBias.AUTHORITY: {
                "intro_phrases": [
                    "Our certified experts have",
                    "Industry-recognized specialists on our team",
                    "Award-winning methodologies developed by",
                ],
                "content_strategies": [
                    "Highlight relevant credentials",
                    "Reference methodology certifications",
                    "Showcase industry recognition and awards",
                ],
                "avoid_repetition": [
                    "Distribute different team member expertise",
                    "Vary authority types (individual, organizational, industry)",
                    "Use unique credentials and certifications per section",
                ],
            },
            PsychologyBias.RECIPROCITY: {
                "intro_phrases": [
                    "As part of our commitment to your success, we provide",
                    "To demonstrate our partnership approach, we include",
                    "Beyond the core requirements, we offer",
                ],
                "content_strategies": [
                    "Offer valuable insights or tools upfront",
                    "Provide free assessments or consultations",
                    "Share proprietary frameworks or methodologies",
                ],
                "avoid_repetition": [
                    "Offer different value-adds per section",
                    "Vary reciprocity types (information, tools, services)",
                    "Track gifts offered to prevent duplication",
                ],
            },
            PsychologyBias.LOSS_AVERSION: {
                "intro_phrases": [
                    "Without this solution, organizations typically lose",
                    "The cost of maintaining the status quo includes",
                    "Delaying this initiative risks",
                ],
                "content_strategies": [
                    "Quantify costs of inaction",
                    "Highlight competitive disadvantages",
                    "Emphasize missed opportunities",
                ],
                "avoid_repetition": [
                    "Focus on different loss categories per section",
                    "Vary loss timeframes (immediate, short-term, long-term)",
                    "Use different risk scenarios and consequences",
                ],
            },
            PsychologyBias.SCARCITY: {
                "intro_phrases": [
                    "Given our limited engagement capacity",
                    "This exclusive opportunity is available",
                    "Time-sensitive market conditions require",
                ],
                "content_strategies": [
                    "Emphasize unique capabilities or timing",
                    "Highlight limited availability of resources",
                    "Reference market timing and opportunities",
                ],
                "avoid_repetition": [
                    "Use different scarcity types per section",
                    "Vary urgency drivers (time, resources, opportunity)",
                    "Apply scarcity to different value propositions",
                ],
            },
            PsychologyBias.EMOTIONAL_APPEAL: {
                "intro_phrases": [
                    "Imagine the transformation when your team",
                    "Picture the competitive advantage of",
                    "Envision the organizational impact of",
                ],
                "content_strategies": [
                    "Connect to professional pride and achievement",
                    "Appeal to organizational mission and vision",
                    "Link to personal success and recognition",
                ],
                "avoid_repetition": [
                    "Target different emotional drivers per section",
                    "Vary emotional appeal types (aspiration, pride, security)",
                    "Connect to different stakeholder motivations",
                ],
            },
            PsychologyBias.PROBLEM_AGITATION: {
                "intro_phrases": [
                    "The hidden costs of current inefficiencies include",
                    "Organizations continuing with legacy approaches face",
                    "The compounding impact of these challenges",
                ],
                "content_strategies": [
                    "Quantify specific pain points and inefficiencies",
                    "Connect problems to business outcomes",
                    "Show escalating consequences of inaction",
                ],
                "avoid_repetition": [
                    "Focus on different problem categories per section",
                    "Vary problem intensities and timeframes",
                    "Connect different problems to specific business impacts",
                ],
            },
        }

    def _initialize_narrative_templates(self):
        """Initialize templates for different narrative roles"""
        self.narrative_templates = {
            "intro": {
                "purpose": "Set context and capture attention",
                "psychology_focus": [
                    PsychologyBias.ANCHORING,
                    PsychologyBias.EMOTIONAL_APPEAL,
                ],
                "content_structure": ["hook", "context", "preview_of_value"],
                "transition_out": "Lead into problem or opportunity identification",
            },
            "problem_identification": {
                "purpose": "Establish need and urgency",
                "psychology_focus": [
                    PsychologyBias.PROBLEM_AGITATION,
                    PsychologyBias.LOSS_AVERSION,
                ],
                "content_structure": [
                    "current_state_analysis",
                    "pain_point_quantification",
                    "consequence_of_inaction",
                ],
                "transition_out": "Bridge to solution introduction",
            },
            "solution_presentation": {
                "purpose": "Present solution and build credibility",
                "psychology_focus": [
                    PsychologyBias.AUTHORITY,
                    PsychologyBias.SOCIAL_PROOF,
                ],
                "content_structure": [
                    "solution_overview",
                    "capabilities_demonstration",
                    "differentiation",
                ],
                "transition_out": "Connect to implementation and benefits",
            },
            "benefit_realization": {
                "purpose": "Demonstrate value and ROI",
                "psychology_focus": [
                    PsychologyBias.ANCHORING,
                    PsychologyBias.RECIPROCITY,
                ],
                "content_structure": [
                    "quantified_benefits",
                    "roi_analysis",
                    "success_stories",
                ],
                "transition_out": "Lead to implementation planning",
            },
            "credibility_building": {
                "purpose": "Establish trust and capability",
                "psychology_focus": [
                    PsychologyBias.AUTHORITY,
                    PsychologyBias.SOCIAL_PROOF,
                ],
                "content_structure": [
                    "team_expertise",
                    "past_successes",
                    "methodology_strength",
                ],
                "transition_out": "Connect to partnership and next steps",
            },
            "call_to_action": {
                "purpose": "Drive decision and commitment",
                "psychology_focus": [
                    PsychologyBias.SCARCITY,
                    PsychologyBias.RECIPROCITY,
                ],
                "content_structure": [
                    "clear_next_steps",
                    "urgency_drivers",
                    "partnership_invitation",
                ],
                "transition_out": "Close with confidence and availability",
            },
        }

    def _initialize_repetition_prevention(self):
        """Initialize repetition prevention mechanisms"""
        self.repetition_keywords = {
            "value_propositions": set(),
            "technical_concepts": set(),
            "benefit_statements": set(),
            "capability_claims": set(),
            "statistical_anchors": set(),
            "client_examples": set(),
        }

        # Common phrases to track and vary
        self.tracked_phrases = {
            "transition_phrases": [
                "Furthermore",
                "Additionally",
                "Moreover",
                "In addition",
                "Building on this",
                "Taking this further",
                "Expanding on this",
            ],
            "emphasis_phrases": [
                "Importantly",
                "Significantly",
                "Notably",
                "Crucially",
                "Key to success",
                "Essential for",
                "Critical to",
            ],
            "benefit_phrases": [
                "This results in",
                "This leads to",
                "The outcome is",
                "Organizations achieve",
                "Clients realize",
                "The impact includes",
            ],
        }

    async def generate_complete_document(
        self, outline: DocumentOutline, context: Optional[Dict[str, Any]] = None
    ) -> IterativeGenerationResult:
        """Generate complete document content from outline using iterative section generation"""
        start_time = time.monotonic()
        result = IterativeGenerationResult()

        try:
            if not aiohttp:
                raise ImportError("aiohttp required for content generation")

            # Initialize content pipeline
            pipeline = ContentPipeline(
                outline_id=outline.id, document_title=outline.title
            )

            # Determine generation order based on strategy
            ordered_elements = self._determine_generation_order(outline.elements)

            self.logger.info(
                f"Starting iterative generation of {len(ordered_elements)} sections"
            )

            # Generate content for each section iteratively
            for element in ordered_elements:
                try:
                    section_content = await self._generate_section_content(
                        element, outline, pipeline, context or {}
                    )

                    if section_content:
                        pipeline.sections.append(section_content)
                        pipeline.total_word_count += section_content.word_count
                        pipeline.total_model_calls += section_content.model_calls
                        pipeline.total_repetition_retries += (
                            section_content.retries_due_to_repetition
                        )

                        # Update content tracking for repetition prevention
                        self._update_content_tracking(pipeline, section_content)

                        result.sections_generated += 1
                        self.logger.info(
                            f"Generated section: {section_content.title} ({section_content.word_count} words)"
                        )
                    else:
                        result.sections_failed += 1
                        result.warnings.append(
                            f"Failed to generate content for section: {element.title}"
                        )

                except Exception as e:
                    result.sections_failed += 1
                    result.errors.append(
                        f"Error generating section '{element.title}': {str(e)}"
                    )
                    self.logger.error(f"Section generation error: {e}")

            # Post-process generated content
            await self._post_process_content(pipeline, outline)

            # Assess overall quality
            await self._assess_pipeline_quality(result, pipeline)

            result.pipeline = pipeline
            result.success = len(result.errors) == 0 and result.sections_generated > 0
            result.total_processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Document generation completed: {result.sections_generated} sections, "
                f"total {pipeline.total_word_count} words in {result.total_processing_time:.2f}s"
            )

        except Exception as e:
            result.errors.append(f"Document generation failed: {str(e)}")
            self.logger.error(f"Generation error: {e}")

        return result

    def _determine_generation_order(
        self, elements: List[OutlineElement]
    ) -> List[OutlineElement]:
        """Determine optimal order for section generation based on strategy"""
        all_elements = self._flatten_outline_elements(elements)

        if self.generation_strategy == ContentGenerationStrategy.SEQUENTIAL:
            return all_elements

        elif self.generation_strategy == ContentGenerationStrategy.PRIORITY_FIRST:
            # Sort by priority: high -> medium -> low
            priority_order = {"high": 3, "medium": 2, "low": 1}
            return sorted(
                all_elements,
                key=lambda x: priority_order.get(x.priority, 2),
                reverse=True,
            )

        elif self.generation_strategy == ContentGenerationStrategy.PSYCHOLOGY_OPTIMIZED:
            # Order sections to maximize persuasive narrative flow
            return self._optimize_for_psychology_flow(all_elements)

        elif self.generation_strategy == ContentGenerationStrategy.DEPENDENCY_AWARE:
            # Generate sections based on dependencies
            return self._resolve_dependencies(all_elements)

        return all_elements

    def _flatten_outline_elements(
        self, elements: List[OutlineElement]
    ) -> List[OutlineElement]:
        """Flatten hierarchical outline into ordered list of all elements"""
        flattened = []

        for element in elements:
            flattened.append(element)
            if element.children:
                flattened.extend(self._flatten_outline_elements(element.children))

        return flattened

    def _optimize_for_psychology_flow(
        self, elements: List[OutlineElement]
    ) -> List[OutlineElement]:
        """Order sections for optimal psychological narrative flow"""

        # Categorize elements by their likely narrative role
        intro_elements = []
        problem_elements = []
        solution_elements = []
        credibility_elements = []
        benefit_elements = []
        action_elements = []
        other_elements = []

        for element in elements:
            title_lower = element.title.lower()

            if any(
                word in title_lower for word in ["summary", "overview", "introduction"]
            ):
                intro_elements.append(element)
            elif any(
                word in title_lower
                for word in ["problem", "challenge", "need", "pain", "current"]
            ):
                problem_elements.append(element)
            elif any(
                word in title_lower
                for word in ["solution", "approach", "method", "strategy"]
            ):
                solution_elements.append(element)
            elif any(
                word in title_lower
                for word in ["team", "experience", "expertise", "credential", "about"]
            ):
                credibility_elements.append(element)
            elif any(
                word in title_lower
                for word in ["benefit", "value", "roi", "impact", "result"]
            ):
                benefit_elements.append(element)
            elif any(
                word in title_lower
                for word in ["next", "timeline", "implementation", "conclusion"]
            ):
                action_elements.append(element)
            else:
                other_elements.append(element)

        # Order for optimal persuasive flow: intro -> problem -> solution -> benefits -> credibility -> action
        ordered = (
            intro_elements
            + problem_elements
            + solution_elements
            + benefit_elements
            + credibility_elements
            + other_elements
            + action_elements
        )

        return ordered

    def _resolve_dependencies(
        self, elements: List[OutlineElement]
    ) -> List[OutlineElement]:
        """Order sections based on dependencies"""
        # Simple dependency resolution - elements without dependencies first
        no_deps = [e for e in elements if not e.dependencies]
        with_deps = [e for e in elements if e.dependencies]

        # For now, return simple ordering - could implement full dependency graph resolution
        return no_deps + with_deps

    async def _generate_section_content(
        self,
        element: OutlineElement,
        outline: DocumentOutline,
        pipeline: ContentPipeline,
        context: Dict[str, Any],
    ) -> Optional[SectionContent]:
        """Generate content for a single section with repetition prevention"""

        for attempt in range(self.max_retries_per_section):
            try:
                section_start_time = time.monotonic()

                # Determine narrative role for this section
                narrative_role = self._determine_narrative_role(element, pipeline)

                # Build section-specific prompt with repetition prevention
                prompt = await self._build_section_prompt(
                    element, outline, pipeline, context, narrative_role
                )

                # Generate content using advanced prompting
                generated_text = await self._call_generation_api(prompt, element)

                if not generated_text:
                    continue

                # Create section content object
                section_content = SectionContent(
                    element_id=element.id,
                    title=element.title,
                    content=generated_text,
                    word_count=len(generated_text.split()),
                    narrative_role=narrative_role,
                    generation_time=time.monotonic()
                    - section_start_time,
                    model_calls=1,
                    retries_due_to_repetition=attempt,
                )

                # Check for repetition against existing content
                repetition_score = await self._assess_repetition_risk(
                    section_content, pipeline
                )
                section_content.repetition_risk_score = repetition_score

                # If repetition risk is acceptable, process and return
                if repetition_score < 0.7:  # Threshold for acceptable repetition
                    await self._enhance_section_content(
                        section_content, element, pipeline
                    )
                    return section_content

                else:
                    self.logger.warning(
                        f"High repetition risk ({repetition_score:.3f}) for section {element.title}, retrying..."
                    )
                    continue

            except Exception as e:
                self.logger.error(
                    f"Error generating section content (attempt {attempt + 1}): {e}"
                )
                continue

        # If all retries failed
        self.logger.error(
            f"Failed to generate acceptable content for section: {element.title}"
        )
        return None

    def _determine_narrative_role(
        self, element: OutlineElement, pipeline: ContentPipeline
    ) -> str:
        """Determine the narrative role of this section in the overall document"""

        title_lower = element.title.lower()
        position = len(pipeline.sections)
        total_sections = len(pipeline.sections) + 1  # Estimate

        # Determine role based on title keywords and position
        if (
            any(word in title_lower for word in ["summary", "overview"])
            and position == 0
        ):
            return "intro"
        elif any(
            word in title_lower for word in ["problem", "challenge", "need", "current"]
        ):
            return "problem_identification"
        elif any(word in title_lower for word in ["solution", "approach", "method"]):
            return "solution_presentation"
        elif any(word in title_lower for word in ["benefit", "value", "roi", "impact"]):
            return "benefit_realization"
        elif any(word in title_lower for word in ["team", "experience", "expertise"]):
            return "credibility_building"
        elif (
            any(word in title_lower for word in ["next", "timeline", "conclusion"])
            or position > total_sections * 0.8
        ):
            return "call_to_action"
        else:
            return "solution_presentation"  # Default role

    async def _build_section_prompt(
        self,
        element: OutlineElement,
        outline: DocumentOutline,
        pipeline: ContentPipeline,
        context: Dict[str, Any],
        narrative_role: str,
    ) -> str:
        """Build comprehensive prompt for section generation with repetition prevention"""

        # Get Chain-of-Thought reasoning steps for this section
        reasoning_steps = self._get_section_reasoning_steps(element, narrative_role)

        # Build context that includes previous sections for coherence
        section_context = self._build_section_context(
            element, outline, pipeline, context
        )

        # Get repetition prevention instructions
        repetition_instructions = self._build_repetition_prevention_instructions(
            pipeline, element
        )

        # Get psychology bias application guidance
        psychology_guidance = self._build_psychology_guidance(element, narrative_role)

        # Create Chain-of-Thought prompt
        task = f"Generate compelling content for the '{element.title}' section of a {outline.document_type.value.replace('_', ' ')}"

        cot_prompt = create_chain_of_thought_prompt(
            task=task,
            context=section_context,
            reasoning_steps=reasoning_steps,
            output_format=f"Generate exactly {element.word_count_target} words of persuasive, professional content",
            examples=self._get_section_examples(element, narrative_role),
        )

        # Add specific instructions
        full_prompt = f"""{cot_prompt}

## Section-Specific Requirements:
- **Title**: {element.title}
- **Word Count Target**: {element.word_count_target} words
- **Priority**: {element.priority}
- **Narrative Role**: {narrative_role}
- **Description**: {element.description}
- **Rationale**: {element.rationale}
- **Content Guidance**: {element.content_guidance}

{psychology_guidance}

{repetition_instructions}

## Quality Requirements:
- Professional, persuasive tone appropriate for {outline.target_audience or "business decision makers"}
- Specific, actionable content that directly supports the proposal objectives
- Seamless integration with overall document narrative
- No repetition of concepts from previous sections
- Clear value proposition and business impact

Generate the section content now:"""

        return full_prompt

    def _get_section_reasoning_steps(
        self, element: OutlineElement, narrative_role: str
    ) -> List[str]:
        """Get Chain-of-Thought reasoning steps specific to this section and narrative role"""

        base_steps = [
            "Analyze the section purpose and requirements within the document context",
            "Review previously generated content to avoid repetition",
            "Identify key messages and value propositions for this section",
            "Apply appropriate psychology biases for maximum persuasive impact",
            "Structure content for optimal flow and reader engagement",
            "Generate specific, compelling content that advances the narrative",
            "Review for quality, coherence, and uniqueness",
        ]

        role_specific_steps = {
            "intro": [
                "Craft an engaging opening that captures attention immediately",
                "Establish credibility and set appropriate expectations",
                "Preview the value proposition without revealing everything",
                "Create smooth transition to problem identification",
            ],
            "problem_identification": [
                "Quantify specific pain points and business impacts",
                "Connect problems to reader's likely experiences",
                "Escalate consequences of inaction appropriately",
                "Bridge naturally to solution presentation",
            ],
            "solution_presentation": [
                "Present solution components clearly and logically",
                "Differentiate from competitive alternatives",
                "Demonstrate technical feasibility and business viability",
                "Connect solution features to business benefits",
            ],
            "benefit_realization": [
                "Quantify benefits with specific metrics and timelines",
                "Present ROI analysis with conservative assumptions",
                "Include qualitative benefits that resonate emotionally",
                "Support claims with evidence and examples",
            ],
            "credibility_building": [
                "Highlight relevant experience and proven track record",
                "Present team qualifications and industry recognition",
                "Share success stories and client testimonials",
                "Establish trust through transparency and expertise",
            ],
            "call_to_action": [
                "Create urgency without appearing pushy",
                "Outline clear, specific next steps",
                "Address potential objections proactively",
                "Close with confidence and partnership invitation",
            ],
        }

        specific_steps = role_specific_steps.get(narrative_role, [])
        return base_steps + specific_steps

    def _build_section_context(
        self,
        element: OutlineElement,
        outline: DocumentOutline,
        pipeline: ContentPipeline,
        context: Dict[str, Any],
    ) -> str:
        """Build comprehensive context for section generation"""

        context_parts = []

        # Document context
        context_parts.append(f"Document: {outline.title}")
        context_parts.append(f"Document Type: {outline.document_type.value}")

        if outline.executive_summary:
            context_parts.append(f"Executive Summary: {outline.executive_summary}")

        # Project context
        if context.get("project_name"):
            context_parts.append(f"Project: {context['project_name']}")
        if context.get("client_name"):
            context_parts.append(f"Client: {context['client_name']}")
        if context.get("industry"):
            context_parts.append(f"Industry: {context['industry']}")

        # Previous sections context for coherence
        if pipeline.sections:
            context_parts.append("\\n## Previously Generated Sections:")
            for prev_section in pipeline.sections[-2:]:  # Last 2 sections for context
                context_parts.append(
                    f"- {prev_section.title}: {prev_section.content[:200]}..."
                )

        # Section position and flow
        section_position = len(pipeline.sections) + 1
        context_parts.append(f"\\nThis is section #{section_position} in the document.")

        return "\\n".join(context_parts)

    def _build_repetition_prevention_instructions(
        self, pipeline: ContentPipeline, element: OutlineElement
    ) -> str:
        """Build instructions for preventing repetition"""

        if not pipeline.sections:
            return "## Repetition Prevention:\\nThis is the first section - establish key themes."

        instructions = ["## Repetition Prevention:"]

        # Track concepts and phrases used
        if pipeline.used_concepts:
            concepts_list = list(pipeline.used_concepts)[:10]  # Limit for readability
            instructions.append(
                f"**Avoid repeating these concepts**: {', '.join(concepts_list)}"
            )

        if pipeline.used_phrases:
            phrases_list = list(pipeline.used_phrases)[:8]  # Limit for readability
            instructions.append(f"**Vary these phrases**: {', '.join(phrases_list)}")

        # Psychology bias variation
        used_biases = set()
        for section in pipeline.sections:
            used_biases.update(section.psychology_biases_used)

        if used_biases and element.psychology_biases:
            available_biases = [
                bias for bias in element.psychology_biases if bias not in used_biases
            ]
            if available_biases:
                bias_names = [bias.value for bias in available_biases]
                instructions.append(
                    f"**Emphasize these fresh biases**: {', '.join(bias_names)}"
                )

        instructions.append(
            "**Generate unique content** that advances the narrative without repeating previous points."
        )

        return "\\n".join(instructions)

    def _build_psychology_guidance(
        self, element: OutlineElement, narrative_role: str
    ) -> str:
        """Build psychology bias application guidance for this section"""

        if not element.psychology_biases:
            return ""

        guidance_parts = ["## Psychology Integration:"]

        for bias in element.psychology_biases:
            if bias.value in self.psychology_applications:
                app = self.psychology_applications[bias.value]

                guidance_parts.append(f"\\n**{bias.value.replace('_', ' ').title()}**:")

                # Add intro phrase suggestions
                if app["intro_phrases"]:
                    phrases = app["intro_phrases"][:2]  # Limit suggestions
                    guidance_parts.append(
                        f"- Consider openings like: {' OR '.join(phrases)}"
                    )

                # Add content strategies
                strategies = app["content_strategies"][:2]  # Limit suggestions
                for strategy in strategies:
                    guidance_parts.append(f"- {strategy}")

        return "\\n".join(guidance_parts)

    def _get_section_examples(
        self, element: OutlineElement, narrative_role: str
    ) -> List[Dict[str, str]]:
        """Get examples for specific section types and narrative roles"""

        examples = {
            "intro": [
                {
                    "input": "Executive summary for AI transformation project",
                    "reasoning": "Hook with industry challenge, preview solution value, establish credibility",
                    "output": "Organizations lose $X annually to manual processes. Our AI solution delivers 40% efficiency gains with proven ROI.",
                }
            ],
            "problem_identification": [
                {
                    "input": "Current state analysis for legacy system replacement",
                    "reasoning": "Quantify specific pain points, show escalating costs, create urgency for change",
                    "output": "Legacy systems cost 35% more annually in maintenance while delivering 50% slower processing times...",
                }
            ],
            "solution_presentation": [
                {
                    "input": "Technical solution overview",
                    "reasoning": "Present capabilities clearly, differentiate from alternatives, demonstrate feasibility",
                    "output": "Our cloud-native platform uniquely combines AI with enterprise security, delivering...",
                }
            ],
        }

        return examples.get(narrative_role, [])

    async def _call_generation_api(
        self, prompt: str, element: OutlineElement
    ) -> Optional[str]:
        """Make API call to generate content for section"""

        timeout = ClientTimeout(total=self.ollama_timeout)

        # Generation parameters optimized for section content
        generation_params = {
            "temperature": 0.4,  # Balanced creativity and consistency
            "top_p": 0.9,
            "num_predict": element.word_count_target * 2,  # Allow for longer generation
        }

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "options": generation_params,
                    },
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        generated_text = result.get("response", "").strip()

                        # Filter thinking tags if using deepseek-r1
                        if "deepseek-r1" in self.ollama_model:
                            generated_text = filter_thinking_tags(generated_text)

                        return generated_text
                    else:
                        self.logger.error(f"Ollama API error: {response.status}")
                        return None

        except Exception as e:
            self.logger.error(f"Error calling generation API: {e}")
            return None

    async def _assess_repetition_risk(
        self, section_content: SectionContent, pipeline: ContentPipeline
    ) -> float:
        """Assess repetition risk of new section against existing content"""

        if self.repetition_prevention == RepetitionPreventionMode.KEYWORD_TRACKING:
            return self._assess_keyword_repetition(section_content, pipeline)

        elif self.repetition_prevention == RepetitionPreventionMode.SEMANTIC_SIMILARITY:
            return self._assess_semantic_similarity(section_content, pipeline)

        elif self.repetition_prevention == RepetitionPreventionMode.AI_REVIEW:
            return await self._assess_ai_repetition_review(section_content, pipeline)

        elif (
            self.repetition_prevention
            == RepetitionPreventionMode.CONTENT_FINGERPRINTING
        ):
            return self._assess_content_fingerprints(section_content, pipeline)

        return 0.0  # No repetition checking

    def _assess_keyword_repetition(
        self, section_content: SectionContent, pipeline: ContentPipeline
    ) -> float:
        """Assess repetition based on keyword overlap"""
        if not pipeline.sections:
            return 0.0

        # Extract key phrases from new content
        content_words = set(section_content.content.lower().split())

        # Calculate overlap with used concepts and phrases
        concept_overlap = len(content_words.intersection(pipeline.used_concepts))
        phrase_overlap = sum(
            1
            for phrase in pipeline.used_phrases
            if phrase.lower() in section_content.content.lower()
        )

        # Calculate repetition score
        total_concepts = len(content_words) if content_words else 1
        repetition_score = (concept_overlap + phrase_overlap * 2) / total_concepts

        return min(repetition_score, 1.0)

    def _assess_semantic_similarity(
        self, section_content: SectionContent, pipeline: ContentPipeline
    ) -> float:
        """Assess semantic similarity (simplified implementation)"""
        # This would ideally use embeddings or NLP similarity measures
        # For now, use a simplified approach based on shared meaningful words

        if not pipeline.sections:
            return 0.0

        # Extract meaningful words (excluding common stop words)
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "must",
            "can",
        }

        new_words = set(
            word.lower().strip(".,!?;:")
            for word in section_content.content.split()
            if word.lower() not in stop_words and len(word) > 3
        )

        # Compare with all previous sections
        max_similarity = 0.0
        for prev_section in pipeline.sections:
            prev_words = set(
                word.lower().strip(".,!?;:")
                for word in prev_section.content.split()
                if word.lower() not in stop_words and len(word) > 3
            )

            if prev_words:
                overlap = len(new_words.intersection(prev_words))
                similarity = overlap / len(new_words.union(prev_words))
                max_similarity = max(max_similarity, similarity)

        return max_similarity

    async def _assess_ai_repetition_review(
        self, section_content: SectionContent, pipeline: ContentPipeline
    ) -> float:
        """Use AI to assess repetition risk"""
        if not pipeline.sections or len(pipeline.sections) == 0:
            return 0.0

        # Build context of previous sections
        previous_content = "\\n\\n".join(
            [f"Section: {s.title}\\n{s.content}" for s in pipeline.sections[-2:]]
        )

        # Create prompt for repetition assessment
        assessment_prompt = f"""Analyze the following new section content for repetition against previously written sections.

Previous Sections:
{previous_content}

New Section: {section_content.title}
{section_content.content}

Rate the repetition risk on a scale of 0.0 (no repetition) to 1.0 (high repetition).
Consider:
- Repeated concepts, ideas, or value propositions
- Similar phrasing or sentence structures
- Overlapping examples or case studies
- Duplicate statistics or claims

Return only a single number between 0.0 and 1.0:"""

        try:
            timeout = ClientTimeout(total=30.0)  # Shorter timeout for assessment

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": assessment_prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,  # Very deterministic for assessment
                            "num_predict": 50,
                        },
                    },
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        response_text = result.get("response", "").strip()

                        # Extract numerical score
                        import re

                        score_match = re.search(
                            r"\\b(0\\.\\d+|1\\.0|0)\\b", response_text
                        )
                        if score_match:
                            return float(score_match.group())

        except Exception as e:
            self.logger.warning(f"AI repetition assessment failed: {e}")

        return 0.3  # Default moderate risk if assessment fails

    def _assess_content_fingerprints(
        self, section_content: SectionContent, pipeline: ContentPipeline
    ) -> float:
        """Assess repetition using content fingerprinting"""
        import hashlib

        # Create fingerprint of content (simplified)
        content_hash = hashlib.md5(section_content.content.encode()).hexdigest()

        # Check against existing fingerprints
        similarity_threshold = 0.8
        max_similarity = 0.0

        for section_id, existing_hash in pipeline.section_fingerprints.items():
            # Simple hash similarity (would use more sophisticated methods in production)
            similarity = self._hash_similarity(content_hash, existing_hash)
            max_similarity = max(max_similarity, similarity)

        return max_similarity

    def _hash_similarity(self, hash1: str, hash2: str) -> float:
        """Simple hash similarity calculation"""
        if len(hash1) != len(hash2):
            return 0.0

        matching_chars = sum(1 for c1, c2 in zip(hash1, hash2) if c1 == c2)
        return matching_chars / len(hash1)

    async def _enhance_section_content(
        self,
        section_content: SectionContent,
        element: OutlineElement,
        pipeline: ContentPipeline,
    ):
        """Enhance section content with metadata and analysis"""

        # Extract key concepts from content
        section_content.key_concepts = self._extract_key_concepts(
            section_content.content
        )

        # Record psychology biases used
        section_content.psychology_biases_used = element.psychology_biases.copy()

        # Extract value propositions
        section_content.unique_value_propositions = self._extract_value_propositions(
            section_content.content
        )

        # Assess quality scores
        section_content.psychology_integration_score = (
            self._assess_psychology_integration(section_content, element)
        )
        section_content.coherence_score = self._assess_section_coherence(
            section_content
        )
        section_content.persuasiveness_score = self._assess_persuasiveness(
            section_content
        )

        # Generate transitions
        section_content.transition_in = self._generate_transition_in(
            section_content, pipeline
        )
        section_content.transition_out = self._generate_transition_out(
            section_content, element
        )

    def _extract_key_concepts(self, content: str) -> List[str]:
        """Extract key concepts from section content"""
        # Simple keyword extraction (would use NLP in production)
        import re

        # Find important phrases (capitalized terms, technical terms, etc.)
        concepts = []

        # Extract capitalized phrases
        capitalized_phrases = re.findall(
            r"\\b[A-Z][a-z]*(?:\\s+[A-Z][a-z]*)*\\b", content
        )
        concepts.extend([phrase for phrase in capitalized_phrases if len(phrase) > 5])

        # Extract quoted terms
        quoted_terms = re.findall(r'"([^"]*)"', content)
        concepts.extend(quoted_terms)

        # Extract technical terms (simplified)
        technical_terms = re.findall(
            r"\\b\\w*(?:system|platform|solution|framework|methodology|approach)\\w*\\b",
            content,
            re.IGNORECASE,
        )
        concepts.extend(technical_terms)

        return list(set(concepts))[:10]  # Limit and deduplicate

    def _extract_value_propositions(self, content: str) -> List[str]:
        """Extract value propositions from content"""
        # Look for sentences that contain value indicators
        import re

        value_indicators = [
            "benefit",
            "advantage",
            "improvement",
            "increase",
            "reduce",
            "save",
            "roi",
            "return",
            "efficiency",
            "cost",
            "revenue",
            "profit",
        ]

        sentences = re.split(r"[.!?]+", content)
        value_props = []

        for sentence in sentences:
            if any(indicator in sentence.lower() for indicator in value_indicators):
                cleaned_sentence = sentence.strip()
                if len(cleaned_sentence) > 20:  # Meaningful length
                    value_props.append(cleaned_sentence)

        return value_props[:5]  # Limit to top 5

    def _assess_psychology_integration(
        self, section_content: SectionContent, element: OutlineElement
    ) -> float:
        """Assess how well psychology biases are integrated"""
        if not element.psychology_biases:
            return 0.5  # Neutral score if no biases assigned

        integration_score = 0.0
        content_lower = section_content.content.lower()

        for bias in element.psychology_biases:
            if bias.value in self.psychology_applications:
                app = self.psychology_applications[bias.value]

                # Check for integration indicators
                indicators_found = 0
                total_indicators = 0

                # Check intro phrases
                for phrase in app.get("intro_phrases", []):
                    total_indicators += 1
                    if phrase.lower() in content_lower:
                        indicators_found += 1

                # Check content strategies (simplified check)
                for strategy in app.get("content_strategies", []):
                    total_indicators += 1
                    strategy_words = strategy.lower().split()[:3]  # First few words
                    if all(word in content_lower for word in strategy_words):
                        indicators_found += 1

                if total_indicators > 0:
                    bias_integration = indicators_found / total_indicators
                    integration_score += bias_integration

        # Average across all biases
        if element.psychology_biases:
            integration_score /= len(element.psychology_biases)

        return min(integration_score, 1.0)

    def _assess_section_coherence(self, section_content: SectionContent) -> float:
        """Assess coherence of section content"""
        # Simple coherence assessment based on structure and flow
        content = section_content.content
        sentences = content.split(".")

        coherence_score = 0.7  # Base score

        # Check for logical flow indicators
        transition_words = [
            "however",
            "therefore",
            "furthermore",
            "additionally",
            "consequently",
            "moreover",
        ]
        transition_count = sum(
            1
            for sentence in sentences
            for word in transition_words
            if word in sentence.lower()
        )

        if len(sentences) > 1:
            transition_density = transition_count / len(sentences)
            coherence_score += min(transition_density * 0.3, 0.2)

        # Check for paragraph structure
        if "\\n" in content:
            coherence_score += 0.1

        return min(coherence_score, 1.0)

    def _assess_persuasiveness(self, section_content: SectionContent) -> float:
        """Assess persuasiveness of section content"""
        content_lower = section_content.content.lower()

        # Look for persuasive elements
        persuasive_indicators = [
            "proven",
            "results",
            "success",
            "achieve",
            "improve",
            "increase",
            "reduce",
            "save",
            "roi",
            "benefit",
            "advantage",
            "unique",
            "exclusive",
            "leading",
            "expert",
            "industry",
            "award",
            "recognized",
        ]

        indicator_count = sum(
            1 for indicator in persuasive_indicators if indicator in content_lower
        )

        # Calculate persuasiveness score
        word_count = len(section_content.content.split())
        persuasive_density = indicator_count / (word_count / 100)  # Per 100 words

        persuasiveness_score = min(persuasive_density * 0.2, 1.0)

        return max(persuasiveness_score, 0.3)  # Minimum baseline

    def _generate_transition_in(
        self, section_content: SectionContent, pipeline: ContentPipeline
    ) -> str:
        """Generate transition from previous section"""
        if not pipeline.sections:
            return "Opening section - sets the context and captures attention"

        prev_section = pipeline.sections[-1]
        return f"Builds upon {prev_section.title} to explore {section_content.title.lower()}"

    def _generate_transition_out(
        self, section_content: SectionContent, element: OutlineElement
    ) -> str:
        """Generate transition to next section"""
        if element.level == 1:  # Main section
            return f"Leads into detailed exploration of implementation and benefits"
        else:  # Subsection
            return f"Supports the broader argument in {element.parent_id or 'parent section'}"

    def _update_content_tracking(
        self, pipeline: ContentPipeline, section_content: SectionContent
    ):
        """Update pipeline tracking for repetition prevention"""

        # Add key concepts to tracking
        pipeline.used_concepts.update(
            concept.lower() for concept in section_content.key_concepts
        )

        # Add value propositions to tracking
        pipeline.used_phrases.update(
            prop.lower() for prop in section_content.unique_value_propositions
        )

        # Add content fingerprint
        import hashlib

        content_hash = hashlib.md5(section_content.content.encode()).hexdigest()
        pipeline.section_fingerprints[section_content.element_id] = content_hash

    async def _post_process_content(
        self, pipeline: ContentPipeline, outline: DocumentOutline
    ):
        """Post-process generated content for final optimization"""

        # Calculate pipeline statistics
        pipeline.total_generation_time = sum(
            section.generation_time for section in pipeline.sections
        )

        # Optimize transitions between sections
        await self._optimize_section_transitions(pipeline)

        # Final coherence check
        await self._ensure_document_coherence(pipeline, outline)

    async def _optimize_section_transitions(self, pipeline: ContentPipeline):
        """Optimize transitions between sections"""
        # This would add smooth transitions between sections
        # For now, just ensure each section has appropriate connectors

        for i, section in enumerate(pipeline.sections):
            if i > 0:
                # Add subtle connection to previous section
                prev_section = pipeline.sections[i - 1]
                section.transition_in = f"Building on {prev_section.narrative_role}, this section {section.narrative_role}"

    async def _ensure_document_coherence(
        self, pipeline: ContentPipeline, outline: DocumentOutline
    ):
        """Ensure overall document coherence and flow"""
        # This would perform final coherence checks and adjustments
        # For now, calculate overall coherence score

        if pipeline.sections:
            coherence_scores = [
                section.coherence_score for section in pipeline.sections
            ]
            pipeline.overall_coherence = sum(coherence_scores) / len(coherence_scores)
        else:
            pipeline.overall_coherence = 0.0

    async def _assess_pipeline_quality(
        self, result: IterativeGenerationResult, pipeline: ContentPipeline
    ):
        """Assess overall quality of generated content pipeline"""

        if not pipeline.sections:
            return

        # Content quality (average of section quality scores)
        quality_scores = []
        psychology_scores = []
        repetition_scores = []

        for section in pipeline.sections:
            # Overall section quality
            section_quality = (
                section.coherence_score + section.persuasiveness_score
            ) / 2
            quality_scores.append(section_quality)

            psychology_scores.append(section.psychology_integration_score)
            repetition_scores.append(
                1.0 - section.repetition_risk_score
            )  # Invert repetition risk

        result.content_quality = sum(quality_scores) / len(quality_scores)
        result.psychology_integration = sum(psychology_scores) / len(psychology_scores)
        result.repetition_prevention = sum(repetition_scores) / len(repetition_scores)

        # Set pipeline quality scores
        pipeline.psychology_effectiveness = result.psychology_integration
        pipeline.repetition_minimization = result.repetition_prevention
        pipeline.narrative_flow = pipeline.overall_coherence

    async def close(self):
        """Close generator and cleanup resources"""
        self.logger.info("IterativeSectionGenerator closed")

    def get_generator_info(self) -> Dict[str, Any]:
        """Get comprehensive generator information"""
        return {
            "generator_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "generation_strategy": self.generation_strategy.value,
            "repetition_prevention": self.repetition_prevention.value,
            "features": {
                "iterative_generation": True,
                "repetition_prevention": True,
                "psychology_integration": True,
                "narrative_flow_optimization": True,
                "quality_assessment": True,
                "section_transitions": True,
            },
            "psychology_applications": len(self.psychology_applications),
            "narrative_templates": len(self.narrative_templates),
            "max_retries_per_section": self.max_retries_per_section,
        }

# Factory function
def create_iterative_section_generator(
    config: Optional[Dict[str, Any]] = None,
) -> IterativeSectionGenerator:
    """Create IterativeSectionGenerator instance with configuration"""
    if config is None:
        config = {}

    generation_strategy = config.get("generation_strategy", "psychology_optimized")
    if isinstance(generation_strategy, str):
        generation_strategy = ContentGenerationStrategy(generation_strategy)

    repetition_prevention = config.get("repetition_prevention", "ai_review")
    if isinstance(repetition_prevention, str):
        repetition_prevention = RepetitionPreventionMode(repetition_prevention)

    return IterativeSectionGenerator(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "deepseek-r1:32b"),
        ollama_timeout=config.get("ollama_timeout", 300.0),
        use_advanced_prompting=config.get("use_advanced_prompting", True),
        generation_strategy=generation_strategy,
        repetition_prevention=repetition_prevention,
        max_retries_per_section=config.get("max_retries_per_section", 3),
    )
